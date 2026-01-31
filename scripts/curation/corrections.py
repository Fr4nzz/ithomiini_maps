"""
Literature-based corrections, Sanger taxonomy loading, and
programmatic subspecies typo detection.
"""

import csv
import json
import re
import logging
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

from .config import (
    CORRECTIONS_FILE, SANGER_TAXONOMY_FILE, PLACEHOLDER_GENERA,
    PLACEHOLDER_SPECIES, SSP_MAX_RARE_COUNT, SSP_MIN_RATIO,
    SSP_MIN_SIMILARITY, SSP_MAX_EDIT_DISTANCE,
)
from .classify import classify_subspecies

log = logging.getLogger(__name__)


# ── Literature corrections ───────────────────────────────────────────────────

def load_corrections(corrections_file=None):
    """
    Load taxonomic corrections from the external JSON file.

    Returns a CorrectionTables namedtuple-like dict with:
      spelling, overrides, subspecies_remap, valid_not_in_gbif, ssp_typos
    """
    path = Path(corrections_file) if corrections_file else CORRECTIONS_FILE
    if not path.exists():
        log.warning(f"Corrections file not found: {path}")
        return {"spelling": {}, "overrides": {}, "subspecies_remap": {},
                "valid_not_in_gbif": set(), "ssp_typos": {}}

    with open(path) as f:
        data = json.load(f)

    # Spelling corrections: {original: corrected}
    spelling = {e["original"]: e["corrected"]
                for e in data.get("spelling_corrections", [])}

    # Dataset correct over GBIF: {name_lower: (gbif_wrong_name, reason)}
    overrides = {e["dataset_name"].lower(): (e["gbif_suggestion"], e["reason"])
                 for e in data.get("dataset_correct_over_gbif", [])}

    # Subspecies as species: {name_lower: (correct_species, ssp_epithet, source)}
    subspecies_remap = {
        e["dataset_name"].lower(): (e["correct_species"], e["subspecies_epithet"], e["reference"])
        for e in data.get("subspecies_as_species", [])
    }

    # Valid species not in GBIF
    valid_not_in_gbif = set()
    gbif_section = data.get("valid_species_not_in_gbif", {})
    for genus_data in gbif_section.get("genus_issues", {}).values():
        for sp in genus_data.get("species", []):
            valid_not_in_gbif.add(sp.lower())
    individual = gbif_section.get("individual_species", {})
    for sp in individual.get("ithomiini", []):
        valid_not_in_gbif.add(sp.lower())
    for sp in individual.get("non_ithomiini", []):
        valid_not_in_gbif.add(sp.lower())

    # Subspecies typos: {(species_lower, wrong_ssp_lower): (correct_ssp, reference)}
    ssp_typos = {}
    for entry in data.get("subspecies_corrections", {}).get("typos", []):
        key = (entry["species"].lower(), entry["wrong"].lower())
        ssp_typos[key] = (entry["correct"], entry.get("reference", ""))

    return {
        "spelling": spelling,
        "overrides": overrides,
        "subspecies_remap": subspecies_remap,
        "valid_not_in_gbif": valid_not_in_gbif,
        "ssp_typos": ssp_typos,
    }


def load_sanger_taxonomy(taxonomy_file=None):
    """Load the authoritative Sanger taxonomy reference (set of valid species names)."""
    path = Path(taxonomy_file) if taxonomy_file else SANGER_TAXONOMY_FILE
    if not path.exists():
        log.info(f"Sanger taxonomy file not found: {path}")
        return set()

    valid = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("taxon_rank") == "species":
                name = row.get("species", "").strip()
                if name:
                    valid.add(name.lower())
    log.info(f"Sanger taxonomy loaded: {len(valid)} valid species")
    return valid


# ── Author-stripping fallback ────────────────────────────────────────────────

def strip_author_from_name(name_str):
    """
    Extract canonical name from a scientific name with author citations.
    Fallback for when the GBIF API is unavailable.

    Examples:
        'Mechanitis lysimnia macrinus Hewitson, 1860' -> 'Mechanitis lysimnia macrinus'
        'Hyposcada illinissa (Hewitson, 1852)'         -> 'Hyposcada illinissa'
    """
    if not name_str:
        return "?"
    cleaned = re.sub(r'\([^)]*\)', '', name_str).strip()
    parts = []
    for word in cleaned.split():
        if parts and (word[0].isupper() or any(c.isdigit() for c in word)
                      or ',' in word):
            break
        parts.append(word)
    return " ".join(parts) if parts else "?"


# ── Subspecies typo detection ────────────────────────────────────────────────

def _levenshtein_distance(s1, s2):
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
        prev = curr
    return prev[-1]


def detect_subspecies_typos(records):
    """
    Detect likely subspecies typos via frequency analysis and string similarity.

    Within each species, rare subspecies (count <= 5) similar to an abundant name
    (similarity >= 0.85 OR edit distance <= 1, abundant >= 3x rare) are flagged.

    Returns: {(species_lower, wrong_ssp_lower): (correct_ssp, source_note)}
    """
    ssp_counts = {}  # {species_lower: Counter({ssp_lower: count})}
    for rec in records:
        sci_name = rec.get("scientific_name", "").strip()
        ssp = (rec.get("subspecies") or "").strip()
        if not sci_name or not ssp:
            continue
        parts = sci_name.split()
        if len(parts) < 2:
            continue
        if parts[0] in PLACEHOLDER_GENERA or parts[1].lower() in PLACEHOLDER_SPECIES:
            continue
        ssp_cat, ssp_cleaned = classify_subspecies(ssp)
        if ssp_cat != "standard" or not ssp_cleaned:
            continue
        ssp_counts.setdefault(sci_name.lower(), Counter())[ssp_cleaned] += 1

    detected = {}
    for species, counts in ssp_counts.items():
        rare = [(n, c) for n, c in counts.items() if c <= SSP_MAX_RARE_COUNT]
        abundant = [(n, c) for n, c in counts.items() if c > SSP_MAX_RARE_COUNT]
        if not rare or not abundant:
            continue

        for rare_name, rare_cnt in rare:
            best_match = None
            best_sim = 0
            for abund_name, abund_cnt in abundant:
                if rare_name == abund_name or abund_cnt < SSP_MIN_RATIO * rare_cnt:
                    continue
                sim = SequenceMatcher(None, rare_name, abund_name).ratio()
                edit_dist = _levenshtein_distance(rare_name, abund_name)
                if (sim >= SSP_MIN_SIMILARITY or edit_dist <= SSP_MAX_EDIT_DISTANCE) and sim > best_sim:
                    best_match = (abund_name, abund_cnt, sim, edit_dist)
                    best_sim = sim
            if best_match:
                correct_name, abund_cnt, sim, edit_dist = best_match
                detected[(species, rare_name)] = (
                    correct_name,
                    f"auto-detected (sim={sim:.2f}, edit_dist={edit_dist}, "
                    f"counts: {rare_cnt} vs {abund_cnt})",
                )
    return detected
