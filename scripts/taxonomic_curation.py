#!/usr/bin/env python3
"""
Taxonomic Name Curation Pipeline
=================================
Validates and curates taxonomic names in the Ithomiini dataset against the
GBIF Backbone Taxonomy (built on the Catalogue of Life).

Methodology follows Grenié et al. (2023) best practices for taxonomic
harmonization:
  1. Bulk-fetch all Ithomiini taxa from GBIF backbone (one request per genus)
  2. Build local lookup cache for species/subspecies/synonyms
  3. Match dataset names against local cache (zero API calls)
  4. Targeted API fallback only for unresolved names (fuzzy matching)
  5. Flag problematic records for expert review

This approach reduces ~5000+ individual API calls to ~50 bulk requests.

References:
  - Grenié M et al. (2023) Methods Ecol Evol 14:12-25
  - Lamas G (2004) Checklist: Hesperioidea - Papilionoidea
  - Willmott KR et al. (2020, 2021) Trop Lepid Res

Usage:
  # Curate the app's merged dataset (default)
  python scripts/taxonomic_curation.py
  python scripts/taxonomic_curation.py --apply

  # Curate a specific file (CSV, TSV, Excel, or JSON)
  python scripts/taxonomic_curation.py --input Dore_Ithomiini_records.xlsx
  python scripts/taxonomic_curation.py --input Dore_Ithomiini_records.xlsx --apply
  python scripts/taxonomic_curation.py --input my_data.csv --apply

  # Other options
  python scripts/taxonomic_curation.py --test            # Test subset (~50 names)
  python scripts/taxonomic_curation.py --test --limit 20
  python scripts/taxonomic_curation.py --report-only     # Just show data quality
  python scripts/taxonomic_curation.py --rebuild-cache   # Force rebuild GBIF cache
"""

import csv
import json
import re
import sys
import time
import argparse
import logging
from pathlib import Path
from collections import Counter

import requests

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
DATA_FILE = PROJECT_ROOT / "public" / "data" / "map_points.json"
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"
CURATION_REPORT = OUTPUT_DIR / "taxonomic_curation_report.json"
TAXONOMY_CACHE_FILE = OUTPUT_DIR / "gbif_taxonomy_cache.json"
TAXON_KEYS_FILE = OUTPUT_DIR / "gbif_taxon_keys.json"
CORRECTIONS_FILE = SCRIPTS_DIR / "taxonomic_corrections.json"

GBIF_API = "https://api.gbif.org/v1"
GBIF_MATCH_URL = f"{GBIF_API}/species/match"
GBIF_SEARCH_URL = f"{GBIF_API}/species/search"
GBIF_USAGE_URL = f"{GBIF_API}/species"

# Higher taxonomy constraints for disambiguation (Grenié et al. 2023)
HIGHER_TAXONOMY = {
    "kingdom": "Animalia",
    "phylum": "Arthropoda",
    "class": "Insecta",
    "order": "Lepidoptera",
    "family": "Nymphalidae",
}

# Rate limiting: GBIF asks for reasonable use
REQUEST_DELAY = 0.1  # 100ms between requests (~10/sec)
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0  # seconds, multiplied by attempt number

# Known placeholder values to skip
PLACEHOLDER_GENERA = {"Unknown", "MISSING", "Genus1", "Genus2"}
PLACEHOLDER_SPECIES = {"species", "sp.", "(family)", "(tribe)"}
UNDESCRIBED_PATTERNS = re.compile(
    r"^(n\.\s*ssp|ssp\.?\s*n|ssp\.?\s*nov|ssp\.?\??|cf\.|or\s)",
    re.IGNORECASE,
)

# Patterns for non-standard subspecies names to flag but not match
FREE_TEXT_PATTERNS = re.compile(
    r"[?/\(\)]|^f\.\s|^\d+$|WESTERN$|EASTERN$|NORTHERN$|SOUTHERN$",
    re.IGNORECASE,
)

# ═══════════════════════════════════════════════════════════════════════════════
# LITERATURE-BASED CORRECTIONS
# Loaded from external file: scripts/taxonomic_corrections.json
# See that file for full documentation, references, and contribution guide.
# ═══════════════════════════════════════════════════════════════════════════════

def _load_corrections(corrections_file=None):
    """
    Load taxonomic corrections from the external JSON file.

    Returns (SPELLING_CORRECTIONS, DATASET_CORRECT_OVER_GBIF,
             SUBSPECIES_AS_SPECIES, VALID_SPECIES_NOT_IN_GBIF) dicts/set.
    """
    path = corrections_file or CORRECTIONS_FILE
    if not Path(path).exists():
        log_msg = f"Corrections file not found: {path}"
        # Only warn if logging is set up, otherwise print
        try:
            log.warning(log_msg)
        except Exception:
            print(f"WARNING: {log_msg}", file=sys.stderr)
        return {}, {}, {}, set()

    with open(path) as f:
        data = json.load(f)

    # Spelling corrections: {original: corrected}
    spelling = {}
    for entry in data.get("spelling_corrections", []):
        spelling[entry["original"]] = entry["corrected"]

    # Dataset correct over GBIF: {name_lower: (gbif_wrong_name, reason)}
    overrides = {}
    for entry in data.get("dataset_correct_over_gbif", []):
        key = entry["dataset_name"].lower()
        overrides[key] = (entry["gbif_suggestion"], entry["reason"])

    # Subspecies as species: {name_lower: (correct_species, ssp_epithet, source)}
    subspecies_remap = {}
    for entry in data.get("subspecies_as_species", []):
        key = entry["dataset_name"].lower()
        subspecies_remap[key] = (
            entry["correct_species"],
            entry["subspecies_epithet"],
            entry["reference"],
        )

    # Valid species not in GBIF: set of lowered names
    valid_not_in_gbif = set()
    gbif_section = data.get("valid_species_not_in_gbif", {})
    # Genus-level issues
    for genus_data in gbif_section.get("genus_issues", {}).values():
        for sp in genus_data.get("species", []):
            valid_not_in_gbif.add(sp.lower())
    # Individual species
    individual = gbif_section.get("individual_species", {})
    for sp in individual.get("ithomiini", []):
        valid_not_in_gbif.add(sp.lower())
    for sp in individual.get("non_ithomiini", []):
        valid_not_in_gbif.add(sp.lower())

    return spelling, overrides, subspecies_remap, valid_not_in_gbif


# Load corrections at module level (used throughout the pipeline)
SPELLING_CORRECTIONS, DATASET_CORRECT_OVER_GBIF, SUBSPECIES_AS_SPECIES, \
    VALID_SPECIES_NOT_IN_GBIF = _load_corrections()


# ═══════════════════════════════════════════════════════════════════════════════
# COLUMN MAPPING — support different input file formats
# ═══════════════════════════════════════════════════════════════════════════════

# Known column mappings for different data sources.
# Each maps the source column name to our internal field name.
COLUMN_PRESETS = {
    "map_points": {
        # JSON from process_data.py — already normalized
        "scientific_name": "scientific_name",
        "genus": "genus",
        "species": "species",
        "subspecies": "subspecies",
    },
    "dore_excel": {
        # Dore_Ithomiini_records.xlsx
        "Genus": "genus",
        "Species": "species",
        "Sub.species": "subspecies",
        # scientific_name is derived: Genus + Species
    },
    "csv_standard": {
        # Generic CSV with standard column names
        "scientific_name": "scientific_name",
        "genus": "genus",
        "species": "species",
        "subspecies": "subspecies",
    },
}


def _detect_column_preset(columns):
    """Auto-detect column mapping from available column names."""
    col_set = set(columns)
    if "Genus" in col_set and "Species" in col_set and "Sub.species" in col_set:
        return "dore_excel"
    if "scientific_name" in col_set:
        return "map_points"
    if "genus" in col_set and "species" in col_set:
        return "csv_standard"
    return None


def _normalize_record(row, preset_name):
    """
    Normalize a record from any supported format into our internal format.
    Returns a dict with: scientific_name, genus, species, subspecies,
    plus all other columns passed through.
    """
    preset = COLUMN_PRESETS[preset_name]
    out = {}

    # Copy all original columns (pass through extras like lat, lng, country, etc.)
    for k, v in row.items():
        out[k] = v

    # Map known columns to internal names
    genus = str(row.get(next((k for k, v in preset.items() if v == "genus"), "genus"), "")).strip()
    species_epithet = str(row.get(next((k for k, v in preset.items() if v == "species"), "species"), "")).strip()

    ssp_key = next((k for k, v in preset.items() if v == "subspecies"), None)
    subspecies_raw = row.get(ssp_key, "") if ssp_key else ""
    subspecies = str(subspecies_raw).strip() if subspecies_raw and str(subspecies_raw).strip() not in ("nan", "None", "NA", "") else None

    # Build scientific_name if not present
    sci_key = next((k for k, v in preset.items() if v == "scientific_name"), None)
    if sci_key and sci_key in row and row[sci_key]:
        scientific_name = str(row[sci_key]).strip()
    else:
        scientific_name = f"{genus} {species_epithet}".strip()

    out["scientific_name"] = scientific_name
    out["genus"] = genus
    out["species"] = species_epithet
    out["subspecies"] = subspecies

    return out

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# DATA LOADING & QUALITY ASSESSMENT
# ═══════════════════════════════════════════════════════════════════════════════


def load_data(input_file=None):
    """
    Load a dataset from JSON, CSV, TSV, or Excel (.xlsx).

    Auto-detects format from file extension and column preset from headers.
    Normalizes all records to internal format with: scientific_name, genus,
    species, subspecies (plus all other columns passed through).

    Args:
        input_file: Path to input file. If None, uses the default DATA_FILE
                    (public/data/map_points.json).

    Returns:
        (records, preset_name, input_path) tuple.
    """
    path = Path(input_file) if input_file else DATA_FILE
    if not path.is_absolute():
        path = PROJECT_ROOT / path

    log.info(f"Loading data from {path}")
    ext = path.suffix.lower()

    if ext == ".json":
        with open(path) as f:
            raw = json.load(f)
        if raw:
            preset = _detect_column_preset(raw[0].keys())
        else:
            preset = "map_points"
        records = [_normalize_record(r, preset) for r in raw]

    elif ext in (".csv", ".tsv"):
        delimiter = "\t" if ext == ".tsv" else ","
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            raw = list(reader)
        if raw:
            preset = _detect_column_preset(raw[0].keys())
        else:
            preset = "csv_standard"
        if not preset:
            log.error(
                f"Could not detect column mapping for {path}. "
                f"Expected columns: genus/Genus + species/Species, or scientific_name. "
                f"Found: {list(raw[0].keys()) if raw else '(empty)'}"
            )
            sys.exit(1)
        records = [_normalize_record(r, preset) for r in raw]

    elif ext in (".xlsx", ".xls"):
        try:
            import pandas as pd
        except ImportError:
            log.error("pandas and openpyxl are required to read Excel files. "
                      "Install with: pip install pandas openpyxl")
            sys.exit(1)
        df = pd.read_excel(path)
        preset = _detect_column_preset(df.columns)
        if not preset:
            log.error(
                f"Could not detect column mapping for {path}. "
                f"Expected columns: Genus + Species + Sub.species, or scientific_name. "
                f"Found: {list(df.columns)}"
            )
            sys.exit(1)
        # Convert DataFrame to list of dicts, handling NaN
        raw = df.where(df.notna(), None).to_dict("records")
        records = [_normalize_record(r, preset) for r in raw]

    else:
        log.error(f"Unsupported file format: {ext}. Use .json, .csv, .tsv, or .xlsx")
        sys.exit(1)

    log.info(f"Loaded {len(records):,} records (format: {preset}, file: {path.name})")
    return records, preset, path


def assess_data_quality(records):
    """
    Generate a data quality report identifying issues before curation.
    Returns a dict summarizing quality issues.
    """
    report = {
        "total_records": len(records),
        "unique_genera": set(),
        "unique_species": set(),
        "unique_subspecies": set(),
        "unique_scientific_names": set(),
        "issues": {
            "placeholder_genera": Counter(),
            "placeholder_species": Counter(),
            "undescribed_subspecies": Counter(),
            "free_text_subspecies": Counter(),
            "missing_subspecies": 0,
            "not_found_taxonomy": 0,
            "malformed_names": [],
            "casing_issues": [],
            "geographic_suffixes": [],
            "question_marks": Counter(),
            "form_names": Counter(),
            "slash_alternatives": Counter(),
        },
    }

    subspecies_variants = {}  # Track casing variants

    for rec in records:
        genus = rec.get("genus", "")
        species = rec.get("species", "")
        subspecies = rec.get("subspecies")
        sci_name = rec.get("scientific_name", "")

        report["unique_genera"].add(genus)
        report["unique_species"].add(sci_name)
        if subspecies:
            report["unique_subspecies"].add(subspecies)
        report["unique_scientific_names"].add(sci_name)

        # Check placeholder genera
        if genus in PLACEHOLDER_GENERA:
            report["issues"]["placeholder_genera"][genus] += 1

        # Check placeholder species
        if species in PLACEHOLDER_SPECIES:
            report["issues"]["placeholder_species"][species] += 1

        # Check NOT_FOUND
        if rec.get("family") == "NOT_FOUND" or rec.get("tribe") == "NOT_FOUND":
            report["issues"]["not_found_taxonomy"] += 1

        # Check subspecies issues
        if not subspecies or subspecies in ("None", "NA", "NaN", ""):
            report["issues"]["missing_subspecies"] += 1
        elif UNDESCRIBED_PATTERNS.match(subspecies):
            report["issues"]["undescribed_subspecies"][subspecies] += 1
        else:
            # Detailed subspecies pattern detection
            if "?" in subspecies:
                report["issues"]["question_marks"][subspecies] += 1
            if subspecies.startswith("f.") or subspecies.startswith("f "):
                report["issues"]["form_names"][subspecies] += 1
            if "/" in subspecies:
                report["issues"]["slash_alternatives"][subspecies] += 1
            if re.search(r'(WESTERN|EASTERN|NORTHERN|SOUTHERN)$', subspecies):
                report["issues"]["geographic_suffixes"].append(subspecies)

        # Check malformed scientific names
        parts = sci_name.split()
        if len(parts) < 2 and genus not in PLACEHOLDER_GENERA:
            if sci_name not in [p for p in report["issues"]["malformed_names"]]:
                report["issues"]["malformed_names"].append(sci_name)

        # Track casing variants for subspecies
        if subspecies:
            key = subspecies.lower()
            if key not in subspecies_variants:
                subspecies_variants[key] = set()
            subspecies_variants[key].add(subspecies)

    # Find casing inconsistencies
    for key, variants in subspecies_variants.items():
        if len(variants) > 1:
            report["issues"]["casing_issues"].append(sorted(variants))

    # Convert sets to counts for JSON serialization
    report["unique_genera"] = len(report["unique_genera"])
    report["unique_species"] = len(report["unique_species"])
    report["unique_subspecies"] = len(report["unique_subspecies"])
    report["unique_scientific_names"] = len(report["unique_scientific_names"])

    return report


def print_quality_report(report):
    """Print a formatted data quality report."""
    print("\n" + "=" * 70)
    print("DATA QUALITY ASSESSMENT")
    print("=" * 70)
    print(f"Total records:           {report['total_records']:,}")
    print(f"Unique genera:           {report['unique_genera']}")
    print(f"Unique scientific names:  {report['unique_scientific_names']}")
    print(f"Unique subspecies:        {report['unique_subspecies']}")

    issues = report["issues"]
    print(f"\n--- Issues ---")
    print(f"Placeholder genera:       {sum(issues['placeholder_genera'].values()):,}")
    for g, c in issues["placeholder_genera"].most_common():
        print(f"  {g}: {c:,}")

    print(f"Placeholder species:      {sum(issues['placeholder_species'].values()):,}")
    for s, c in issues["placeholder_species"].most_common():
        print(f"  {s}: {c:,}")

    print(f"Missing subspecies:       {issues['missing_subspecies']:,}")
    print(f"NOT_FOUND taxonomy:       {issues['not_found_taxonomy']}")

    undesc = issues["undescribed_subspecies"]
    print(f"Undescribed subspecies:   {sum(undesc.values()):,} records, {len(undesc)} patterns")
    for p, c in undesc.most_common(5):
        print(f"  '{p}': {c:,}")
    if len(undesc) > 5:
        print(f"  ... and {len(undesc) - 5} more patterns")

    qmarks = issues["question_marks"]
    if qmarks:
        print(f"Question marks:           {sum(qmarks.values()):,} records, {len(qmarks)} patterns")
        for p, c in qmarks.most_common(3):
            print(f"  '{p}': {c:,}")

    forms = issues["form_names"]
    if forms:
        print(f"Form names (f. xxx):      {sum(forms.values()):,} records, {len(forms)} patterns")
        for p, c in forms.most_common(3):
            print(f"  '{p}': {c:,}")

    slashes = issues["slash_alternatives"]
    if slashes:
        print(f"Slash alternatives:       {sum(slashes.values()):,} records, {len(slashes)} patterns")
        for p, c in slashes.most_common(3):
            print(f"  '{p}': {c:,}")

    geo = issues["geographic_suffixes"]
    if geo:
        print(f"Geographic suffixes:      {len(geo)} patterns")
        for g in geo[:3]:
            print(f"  '{g}'")

    if issues["malformed_names"]:
        print(f"Malformed names:          {len(issues['malformed_names'])}")
        for n in issues["malformed_names"][:5]:
            print(f"  '{n}'")

    if issues["casing_issues"]:
        print(f"Casing inconsistencies:   {len(issues['casing_issues'])}")
        for variants in issues["casing_issues"][:5]:
            print(f"  {variants}")
    print()


# ═══════════════════════════════════════════════════════════════════════════════
# GBIF API INTERACTION
# ═══════════════════════════════════════════════════════════════════════════════


def gbif_request(url, params, retries=MAX_RETRIES):
    """
    Make a GBIF API request with retry logic and rate limiting.
    Retries on 429 (rate limit), 5xx (server error), and network errors.
    """
    for attempt in range(retries):
        try:
            time.sleep(REQUEST_DELAY)
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429 or resp.status_code >= 500:
                wait = RETRY_BACKOFF * (attempt + 1) * 2
                log.warning(
                    f"HTTP {resp.status_code} (attempt {attempt+1}/{retries}), "
                    f"retrying in {wait:.1f}s"
                )
                time.sleep(wait)
            else:
                log.warning(f"HTTP {resp.status_code} for {params}")
                return None
        except requests.RequestException as e:
            wait = RETRY_BACKOFF * (attempt + 1)
            log.warning(f"Request error (attempt {attempt+1}): {e}, retrying in {wait:.1f}s")
            time.sleep(wait)
    log.error(f"All {retries} retries exhausted for {url}")
    return None


def match_species(name, rank="SPECIES", strict=False):
    """
    Match a scientific name against the GBIF Backbone Taxonomy.
    Uses higher taxonomy constraints for disambiguation (Grenié et al. 2023).
    """
    params = {
        "name": name,
        "rank": rank,
        "strict": str(strict).lower(),
        "verbose": "true",
        **HIGHER_TAXONOMY,
    }
    return gbif_request(GBIF_MATCH_URL, params)


# ═══════════════════════════════════════════════════════════════════════════════
# BULK GBIF CACHE — fetch all dataset genera in bulk
# ═══════════════════════════════════════════════════════════════════════════════


def resolve_genus_keys(records):
    """
    Build a complete genus → GBIF taxon key mapping from:
    1. Pre-cached Ithomiini genus keys (gbif_taxon_keys.json)
    2. Auto-discovered genera from the dataset (looked up via GBIF match API)

    This ensures ALL genera in the dataset are covered, not just Ithomiini.
    """
    # Load pre-cached Ithomiini keys
    cached_keys = {}
    if TAXON_KEYS_FILE.exists():
        with open(TAXON_KEYS_FILE) as f:
            data = json.load(f)
        cached_keys = data.get("genera", {})
        log.info(f"Loaded {len(cached_keys)} pre-cached genus keys")

    # Extract all unique genera from the dataset
    all_genera = set()
    for rec in records:
        genus = rec.get("genus", "")
        if genus and genus not in PLACEHOLDER_GENERA:
            all_genera.add(genus)

    log.info(f"Dataset contains {len(all_genera)} unique genera")

    # Find genera that need GBIF lookup
    missing = all_genera - set(cached_keys.keys())
    if missing:
        log.info(f"Looking up {len(missing)} genera not in cache...")
        for i, genus in enumerate(sorted(missing), 1):
            if (i % 20 == 0) or i == 1:
                log.info(f"  [{i}/{len(missing)}] Looking up {genus}...")
            params = {
                "name": genus,
                "rank": "GENUS",
                "kingdom": "Animalia",
                "class": "Insecta",
                "order": "Lepidoptera",
            }
            result = gbif_request(GBIF_MATCH_URL, params)
            if result and result.get("matchType") != "NONE":
                matched_rank = result.get("rank", "")
                if matched_rank == "GENUS":
                    cached_keys[genus] = result.get("usageKey")
                else:
                    log.warning(
                        f"  Genus '{genus}' matched at {matched_rank} level "
                        f"(key={result.get('usageKey')}), skipping"
                    )
            else:
                log.warning(f"  Genus '{genus}' not found in GBIF backbone")

        # Save expanded keys back to disk
        cache_data = {
            "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "genera": cached_keys,
        }
        with open(TAXON_KEYS_FILE, "w") as f:
            json.dump(cache_data, f, indent=2)
        log.info(f"Updated genus keys file: {len(cached_keys)} total genera")

    # Only return genera that are actually in the dataset
    return {g: k for g, k in cached_keys.items() if g in all_genera}


def fetch_genus_taxa(genus_name, genus_key):
    """
    Fetch ALL taxa (species, subspecies, synonyms) under a genus from GBIF.
    Uses the species search API with higherTaxonKey — one request per genus.
    Returns a list of taxon dicts.
    """
    all_results = []
    offset = 0
    limit = 1000

    while True:
        params = {
            "higherTaxonKey": genus_key,
            "limit": limit,
            "offset": offset,
        }
        data = gbif_request(GBIF_SEARCH_URL, params)
        if not data:
            break

        results = data.get("results", [])
        all_results.extend(results)

        # Check if there are more pages
        total = data.get("count", 0)
        offset += limit
        if offset >= total:
            break

    return all_results


def build_taxonomy_cache(genus_keys):
    """
    Build a comprehensive taxonomy cache by bulk-fetching from GBIF.
    For each genus, fetches all species, subspecies, and synonyms in one request.

    Cache structure:
    {
        "metadata": {...},
        "species": {
            "genus epithet": {  # canonical binomial, lowercased
                "key": int,
                "canonicalName": str,
                "scientificName": str,
                "status": str,  # ACCEPTED / SYNONYM / DOUBTFUL
                "acceptedKey": int | null,
                "acceptedName": str | null,
                "rank": str,
            }, ...
        },
        "subspecies": {
            "genus epithet subsp": {  # canonical trinomial, lowercased
                ... same fields ...
            }, ...
        },
        "synonyms": {
            "synonym name lowered": {
                ... same fields plus acceptedKey/acceptedName ...
            }, ...
        },
        "species_by_key": {
            "12345": { ... species entry ... }, ...
        },
        "children": {
            "species_key": ["subsp1_canonical", "subsp2_canonical", ...]
        }
    }
    """
    cache = {
        "metadata": {
            "built_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "source": "GBIF Backbone Taxonomy via species/search API",
            "genera_fetched": len(genus_keys),
        },
        "species": {},
        "subspecies": {},
        "synonyms": {},
        "species_by_key": {},
        "children": {},  # species_key -> list of subspecies canonical names
    }

    total_taxa = 0
    total_genera = len(genus_keys)

    for i, (genus, key) in enumerate(genus_keys.items(), 1):
        log.info(f"[{i}/{total_genera}] Fetching {genus} (key={key})...")
        taxa = fetch_genus_taxa(genus, key)
        genus_species = 0
        genus_subspecies = 0
        genus_synonyms = 0

        for taxon in taxa:
            rank = taxon.get("rank", "")
            canonical = taxon.get("canonicalName", "")
            status = taxon.get("taxonomicStatus", "")

            if not canonical or rank == "UNRANKED":
                continue

            entry = {
                "key": taxon.get("key"),
                "canonicalName": canonical,
                "scientificName": taxon.get("scientificName", ""),
                "status": status,
                "acceptedKey": taxon.get("acceptedKey"),
                "acceptedName": taxon.get("accepted", ""),
                "rank": rank,
                "genus": genus,
            }

            key_lower = canonical.lower()
            is_synonym = status == "SYNONYM"

            if rank == "SPECIES":
                if is_synonym:
                    cache["synonyms"][key_lower] = entry
                    genus_synonyms += 1
                else:
                    cache["species"][key_lower] = entry
                    cache["species_by_key"][str(entry["key"])] = entry
                    genus_species += 1

            elif rank == "SUBSPECIES":
                if is_synonym:
                    cache["synonyms"][key_lower] = entry
                    genus_synonyms += 1
                else:
                    cache["subspecies"][key_lower] = entry
                    genus_subspecies += 1

                    # Track children for the parent species
                    parts = canonical.split()
                    if len(parts) >= 3:
                        parent_binomial = f"{parts[0]} {parts[1]}"
                        parent_lower = parent_binomial.lower()
                        # Find parent key
                        parent = cache["species"].get(parent_lower)
                        if parent:
                            parent_key = str(parent["key"])
                            if parent_key not in cache["children"]:
                                cache["children"][parent_key] = []
                            cache["children"][parent_key].append(canonical)

        total_taxa += len(taxa)
        log.info(
            f"  -> {genus_species} species, {genus_subspecies} subspecies, "
            f"{genus_synonyms} synonyms"
        )

    cache["metadata"]["total_taxa"] = total_taxa
    cache["metadata"]["total_species"] = len(cache["species"])
    cache["metadata"]["total_subspecies"] = len(cache["subspecies"])
    cache["metadata"]["total_synonyms"] = len(cache["synonyms"])

    log.info(
        f"Cache built: {len(cache['species'])} species, "
        f"{len(cache['subspecies'])} subspecies, "
        f"{len(cache['synonyms'])} synonyms"
    )
    return cache


def load_or_build_cache(records, force_rebuild=False):
    """Load taxonomy cache from disk, or build it from GBIF if not found."""
    if not force_rebuild and TAXONOMY_CACHE_FILE.exists():
        log.info(f"Loading taxonomy cache from {TAXONOMY_CACHE_FILE}")
        with open(TAXONOMY_CACHE_FILE) as f:
            cache = json.load(f)
        log.info(
            f"Cache loaded: {len(cache.get('species', {}))} species, "
            f"{len(cache.get('subspecies', {}))} subspecies, "
            f"{len(cache.get('synonyms', {}))} synonyms "
            f"(built {cache.get('metadata', {}).get('built_at', '?')})"
        )
        return cache

    log.info("Building taxonomy cache from GBIF (bulk fetch)...")
    genus_keys = resolve_genus_keys(records)
    cache = build_taxonomy_cache(genus_keys)

    # Save to disk
    with open(TAXONOMY_CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2, default=str)
    log.info(f"Cache saved to {TAXONOMY_CACHE_FILE}")

    return cache


# ═══════════════════════════════════════════════════════════════════════════════
# NAME EXTRACTION & CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════════════


def classify_subspecies(subspecies):
    """
    Classify a subspecies string into categories for appropriate handling.
    Returns: (category, cleaned_name)

    Categories:
      - "standard"        — normal subspecies epithet, safe to match
      - "undescribed"     — n. ssp. [N], ssp. nov, etc.
      - "question_mark"   — contains ? uncertainty marker
      - "form_name"       — f. xxx form name
      - "slash_alt"       — slash-delimited alternatives
      - "free_text"       — parenthetical remarks, annotations
      - "geographic"      — species with geographic suffix (e.g., timnaWESTERN)
      - "nominotypical"   — subspecies epithet = species epithet
    """
    if not subspecies:
        return ("absent", None)

    ssp = subspecies.strip()

    if UNDESCRIBED_PATTERNS.match(ssp):
        return ("undescribed", ssp)
    if "?" in ssp:
        return ("question_mark", ssp.replace("?", "").strip())
    if ssp.startswith("f.") or ssp.startswith("f "):
        return ("form_name", ssp)
    if "/" in ssp:
        return ("slash_alt", ssp)
    if re.search(r'(WESTERN|EASTERN|NORTHERN|SOUTHERN)$', ssp):
        return ("geographic", re.sub(r'(WESTERN|EASTERN|NORTHERN|SOUTHERN)$', '', ssp).strip())
    if re.search(r'[()]', ssp):
        return ("free_text", ssp)
    if re.match(r'^\d+$', ssp):
        return ("free_text", ssp)

    return ("standard", ssp.lower())


def extract_unique_names(records, limit=None):
    """
    Extract unique taxonomic name combinations to curate.
    Returns a list of dicts with genus, species, subspecies, scientific_name,
    plus classification metadata.
    """
    seen = set()
    names = []

    for rec in records:
        genus = rec.get("genus", "")
        species_epithet = rec.get("species", "")
        subspecies = rec.get("subspecies")
        sci_name = rec.get("scientific_name", "")

        # Skip placeholders
        if genus in PLACEHOLDER_GENERA:
            continue
        if species_epithet in PLACEHOLDER_SPECIES:
            continue

        # Create a unique key
        key = (sci_name, subspecies or "")
        if key in seen:
            continue
        seen.add(key)

        ssp_category, ssp_cleaned = classify_subspecies(subspecies)

        # Detect nominotypical subspecies (ssp epithet == species epithet)
        is_nominotypical = False
        if ssp_category == "standard" and ssp_cleaned:
            if ssp_cleaned == species_epithet.lower():
                is_nominotypical = True

        names.append({
            "genus": genus,
            "species_epithet": species_epithet,
            "subspecies": subspecies or None,
            "scientific_name": sci_name,
            "ssp_category": ssp_category,
            "ssp_cleaned": ssp_cleaned,
            "is_nominotypical": is_nominotypical,
        })

        if limit and len(names) >= limit:
            break

    return names


# ═══════════════════════════════════════════════════════════════════════════════
# CURATION PIPELINE — cache-first with targeted API fallback
# ═══════════════════════════════════════════════════════════════════════════════


# Track API calls for performance reporting
_api_call_count = 0


def curate_name(name_entry, cache):
    """
    Run the full curation pipeline on a single taxonomic name.

    Phase 0: Apply literature-based corrections (spelling, subspecies-as-species)
    Phase 1: Look up in local cache (zero API calls)
    Phase 2: Targeted API fallback for unresolved names
    Phase 3: Override GBIF results with literature findings where appropriate

    Returns a curation result dict.
    """
    global _api_call_count

    sci_name = name_entry["scientific_name"]
    subspecies = name_entry["subspecies"]
    ssp_category = name_entry["ssp_category"]
    ssp_cleaned = name_entry["ssp_cleaned"]

    result = {
        "input": name_entry,
        "species_match": None,
        "subspecies_match": None,
        "accepted_name": None,
        "recognized_subspecies": [],
        "curated_name": None,       # Final corrected name after all curation
        "literature_action": None,   # What the literature review determined
        "status": "pending",
        "flags": [],
        "notes": [],
    }

    # ── Phase 0: Literature-based pre-corrections ────────────────────────

    # 0a. Spelling corrections (dataset has a typo, literature confirms correct form)
    if sci_name in SPELLING_CORRECTIONS:
        corrected = SPELLING_CORRECTIONS[sci_name]
        result["flags"].append("SPELLING_CORRECTED")
        result["notes"].append(
            f"Spelling correction (literature): '{sci_name}' -> '{corrected}'"
        )
        result["literature_action"] = f"spelling_corrected:{corrected}"
        sci_name = corrected
        # Update name_entry so downstream steps use the corrected name
        name_entry = dict(name_entry)
        name_entry["scientific_name"] = corrected
        parts = corrected.split()
        if len(parts) >= 2:
            name_entry["genus"] = parts[0]
            name_entry["species_epithet"] = parts[1]

    # 0b. Subspecies-as-species: dataset treats a subspecies epithet as a species
    ssp_remap = SUBSPECIES_AS_SPECIES.get(sci_name.lower())
    if ssp_remap:
        correct_species, ssp_epithet, source = ssp_remap
        result["flags"].append("SUBSPECIES_AS_SPECIES")
        result["notes"].append(
            f"Literature correction: '{sci_name}' is actually a subspecies. "
            f"Correct name: {correct_species} {ssp_epithet} ({source})"
        )
        result["literature_action"] = (
            f"subspecies_reclassified:{correct_species} {ssp_epithet}"
        )
        result["curated_name"] = f"{correct_species} {ssp_epithet}"
        # Try to match the correct parent species instead
        sci_name = correct_species
        name_entry = dict(name_entry)
        name_entry["scientific_name"] = correct_species
        parts = correct_species.split()
        if len(parts) >= 2:
            name_entry["genus"] = parts[0]
            name_entry["species_epithet"] = parts[1]

    # ── Step 1: Look up binomial in local cache ──────────────────────────
    binomial_lower = sci_name.lower()

    # Check accepted species
    species_entry = cache["species"].get(binomial_lower)
    synonym_entry = cache["synonyms"].get(binomial_lower) if not species_entry else None

    if species_entry:
        result["species_match"] = {
            "matchType": "EXACT",
            "source": "cache",
            "status": species_entry["status"],
            "gbifKey": species_entry["key"],
            "canonicalName": species_entry["canonicalName"],
            "scientificName": species_entry["scientificName"],
            "rank": species_entry["rank"],
            "synonym": False,
        }
        result["accepted_name"] = {
            "key": species_entry["key"],
            "canonicalName": species_entry["canonicalName"],
            "scientificName": species_entry["scientificName"],
            "status": species_entry["status"],
            "rank": species_entry["rank"],
        }

        # Get recognized subspecies from children
        sp_key = str(species_entry["key"])
        children_names = cache.get("children", {}).get(sp_key, [])
        result["recognized_subspecies"] = [
            {"name": c, "status": "ACCEPTED"}
            for c in children_names
        ]

    elif synonym_entry:
        result["species_match"] = {
            "matchType": "EXACT",
            "source": "cache",
            "status": synonym_entry["status"],
            "gbifKey": synonym_entry["key"],
            "canonicalName": synonym_entry["canonicalName"],
            "scientificName": synonym_entry["scientificName"],
            "rank": synonym_entry["rank"],
            "synonym": True,
        }
        result["flags"].append("SYNONYM")

        # Resolve to accepted name
        accepted_key = synonym_entry.get("acceptedKey")
        if accepted_key:
            accepted = cache["species_by_key"].get(str(accepted_key))
            if accepted:
                result["accepted_name"] = {
                    "key": accepted["key"],
                    "canonicalName": accepted["canonicalName"],
                    "scientificName": accepted["scientificName"],
                    "status": accepted["status"],
                    "rank": accepted["rank"],
                }
                result["notes"].append(
                    f"SYNONYM: '{sci_name}' -> accepted: "
                    f"'{accepted['canonicalName']}'"
                )
                # Get children of accepted species
                acc_key_str = str(accepted["key"])
                children_names = cache.get("children", {}).get(acc_key_str, [])
                result["recognized_subspecies"] = [
                    {"name": c, "status": "ACCEPTED"}
                    for c in children_names
                ]
            else:
                # Accepted name references something outside our cache
                # (e.g., accepted name is in a different genus)
                accepted_name_str = synonym_entry.get("acceptedName", "")
                result["accepted_name"] = {
                    "key": accepted_key,
                    "canonicalName": accepted_name_str.split("(")[0].strip()
                        if accepted_name_str else "?",
                    "scientificName": accepted_name_str,
                    "status": "ACCEPTED",
                    "rank": "SPECIES",
                }
                result["notes"].append(
                    f"SYNONYM: '{sci_name}' -> accepted: '{accepted_name_str}' "
                    f"(outside cache, key={accepted_key})"
                )
    else:
        # Not in cache at all — use individual match API as fallback
        _api_call_count += 1
        species_result = match_species(sci_name, rank="SPECIES")

        if not species_result:
            result["status"] = "api_error"
            result["flags"].append("GBIF_API_ERROR")
            return result

        match_type = species_result.get("matchType", "NONE")
        confidence = species_result.get("confidence", 0)

        result["species_match"] = {
            "matchType": match_type,
            "source": "api_fallback",
            "confidence": confidence,
            "status": species_result.get("status", ""),
            "gbifKey": species_result.get("usageKey"),
            "canonicalName": species_result.get("canonicalName"),
            "scientificName": species_result.get("scientificName"),
            "rank": species_result.get("rank"),
            "synonym": species_result.get("synonym", False),
            "note": species_result.get("note", ""),
        }

        if match_type == "NONE":
            result["status"] = "not_found"
            result["flags"].append("SPECIES_NOT_IN_BACKBONE")
            result["notes"].append(
                f"'{sci_name}' not found in GBIF Backbone (cache miss + API). "
                "May be a recently described species or a spelling error."
            )
            return result

        if match_type == "HIGHERRANK":
            matched_rank = species_result.get("rank", "")

            # Check if literature confirms this species as valid
            if sci_name.lower() in VALID_SPECIES_NOT_IN_GBIF:
                result["status"] = "verified_literature"
                result["flags"].append("LITERATURE_VERIFIED")
                result["notes"].append(
                    f"'{sci_name}' not in GBIF backbone (matched {matched_rank}) "
                    f"but VERIFIED in specialist literature "
                    f"(Lamas 2004 / Willmott et al. / nymphalidae.net)."
                )
                result["literature_action"] = (
                    f"verified_not_in_gbif:{sci_name}"
                )
                result["curated_name"] = sci_name
                return result

            result["status"] = "higher_rank_only"
            result["flags"].append("MATCHED_HIGHER_RANK")
            result["notes"].append(
                f"'{sci_name}' matched only at {matched_rank} level. "
                "The species may not be in the backbone."
            )
            return result

        if match_type == "FUZZY":
            matched_name = species_result.get("canonicalName", "")

            # Check if literature says the dataset name is correct (GBIF is wrong)
            lit_override = DATASET_CORRECT_OVER_GBIF.get(sci_name.lower())
            if lit_override:
                gbif_wrong, reason = lit_override
                result["flags"].append("GBIF_FUZZY_OVERRIDDEN")
                result["notes"].append(
                    f"GBIF suggested fuzzy match '{matched_name}' REJECTED. "
                    f"Dataset name '{sci_name}' is correct per literature: {reason}"
                )
                result["literature_action"] = (
                    f"dataset_correct_over_gbif:{sci_name}"
                )
                result["curated_name"] = sci_name
                # Override species match to reflect the dataset is correct
                result["species_match"]["matchType"] = "LITERATURE_VERIFIED"
                result["species_match"]["literature_override"] = True
                result["species_match"]["gbif_suggestion_rejected"] = matched_name
            else:
                result["flags"].append("FUZZY_MATCH")
                result["notes"].append(
                    f"Fuzzy match: '{sci_name}' -> '{matched_name}' "
                    f"(confidence: {confidence}%). Possible spelling correction."
                )

        if species_result.get("synonym"):
            result["flags"].append("SYNONYM")
            acc_key = species_result.get("acceptedUsageKey")
            if acc_key:
                accepted = cache["species_by_key"].get(str(acc_key))
                if accepted:
                    result["accepted_name"] = {
                        "key": accepted["key"],
                        "canonicalName": accepted["canonicalName"],
                        "scientificName": accepted["scientificName"],
                        "status": accepted["status"],
                        "rank": accepted["rank"],
                    }
                result["notes"].append(
                    f"SYNONYM via API: '{sci_name}' -> "
                    f"acceptedKey={acc_key}"
                )
        else:
            result["accepted_name"] = {
                "key": species_result.get("usageKey"),
                "canonicalName": species_result.get("canonicalName"),
                "scientificName": species_result.get("scientificName"),
                "status": species_result.get("status"),
                "rank": species_result.get("rank"),
            }

    # ── Step 2: Validate subspecies ──────────────────────────────────────

    if ssp_category == "absent":
        # No subspecies to validate
        pass

    elif ssp_category == "undescribed":
        result["flags"].append("UNDESCRIBED_SUBSPECIES")
        result["notes"].append(
            f"Undescribed subspecies marker: '{subspecies}' — skipped GBIF lookup."
        )

    elif ssp_category == "question_mark":
        result["flags"].append("QUESTION_MARK_SUBSPECIES")
        result["notes"].append(
            f"Uncertainty marker in subspecies: '{subspecies}'. "
            f"Cleaned: '{ssp_cleaned}'"
        )
        # Try to validate cleaned version
        if ssp_cleaned:
            _validate_subspecies(
                sci_name, ssp_cleaned, subspecies, cache, result
            )

    elif ssp_category == "form_name":
        result["flags"].append("FORM_NAME")
        result["notes"].append(
            f"Form name in subspecies field: '{subspecies}'. "
            "Form names are infrasubspecific and not tracked by GBIF."
        )

    elif ssp_category == "slash_alt":
        result["flags"].append("SLASH_ALTERNATIVE")
        alternatives = [s.strip() for s in subspecies.split("/")]
        result["notes"].append(
            f"Slash-delimited alternatives: '{subspecies}' -> {alternatives}. "
            "Needs expert review to select correct name."
        )
        # Try to validate each alternative
        for alt in alternatives:
            if alt and not UNDESCRIBED_PATTERNS.match(alt):
                _validate_subspecies(
                    sci_name, alt.lower(), subspecies, cache, result,
                    note_prefix=f"Alternative '{alt}': "
                )

    elif ssp_category == "geographic":
        result["flags"].append("GEOGRAPHIC_SUFFIX")
        result["notes"].append(
            f"Geographic suffix in subspecies: '{subspecies}'. "
            f"Cleaned: '{ssp_cleaned}'"
        )
        if ssp_cleaned:
            _validate_subspecies(
                sci_name, ssp_cleaned, subspecies, cache, result
            )

    elif ssp_category == "free_text":
        result["flags"].append("FREE_TEXT_SUBSPECIES")
        result["notes"].append(
            f"Non-standard text in subspecies field: '{subspecies}'"
        )

    elif ssp_category == "standard":
        # Normal subspecies — validate against cache
        if name_entry.get("is_nominotypical"):
            result["flags"].append("NOMINOTYPICAL")
            result["notes"].append(
                f"Nominotypical subspecies: '{subspecies}' "
                f"(matches species epithet '{name_entry['species_epithet']}')."
            )

        _validate_subspecies(
            sci_name, ssp_cleaned, subspecies, cache, result
        )

    # ── Step 3: Determine overall status ─────────────────────────────────
    _determine_status(result)

    return result


def _validate_subspecies(sci_name, ssp_cleaned, ssp_original, cache, result,
                          note_prefix=""):
    """
    Validate a subspecies name against the cache, falling back to API.

    Checks:
    1. Trinomial in cache (accepted or synonym)
    2. Cross-reference against recognized children of the parent species
    3. API fallback for fuzzy matching
    """
    global _api_call_count

    trinomial_lower = f"{sci_name.lower()} {ssp_cleaned}"

    # Check accepted subspecies in cache
    ssp_entry = cache["subspecies"].get(trinomial_lower)
    ssp_synonym = cache["synonyms"].get(trinomial_lower) if not ssp_entry else None

    if ssp_entry:
        result["subspecies_match"] = {
            "matchType": "EXACT",
            "source": "cache",
            "status": ssp_entry["status"],
            "gbifKey": ssp_entry["key"],
            "canonicalName": ssp_entry["canonicalName"],
            "rank": ssp_entry["rank"],
            "synonym": False,
        }
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' found in GBIF backbone (cache)."
        )
        return

    if ssp_synonym:
        result["subspecies_match"] = {
            "matchType": "EXACT",
            "source": "cache",
            "status": ssp_synonym["status"],
            "gbifKey": ssp_synonym["key"],
            "canonicalName": ssp_synonym["canonicalName"],
            "rank": ssp_synonym["rank"],
            "synonym": True,
        }
        result["flags"].append("SUBSPECIES_SYNONYM")
        accepted_name = ssp_synonym.get("acceptedName", "?")
        result["notes"].append(
            f"{note_prefix}Subspecies synonym: '{ssp_original}' -> '{accepted_name}'"
        )
        return

    # Not in cache — check if it's in the recognized children list
    recognized_epithets = set()
    for child in result.get("recognized_subspecies", []):
        parts = child["name"].split()
        if len(parts) >= 3:
            recognized_epithets.add(parts[-1].lower())

    if ssp_cleaned in recognized_epithets:
        # This means the children list has it even though we didn't cache it
        # separately (shouldn't happen, but handle gracefully)
        result["subspecies_match"] = {
            "matchType": "EXACT",
            "source": "children_crossref",
            "status": "ACCEPTED",
            "canonicalName": f"{sci_name} {ssp_cleaned}",
            "rank": "SUBSPECIES",
            "synonym": False,
        }
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' confirmed via children list."
        )
        return

    # Not in cache or children list.
    # OPTIMIZATION: If the parent species IS in our cache, we already have
    # its complete children list from GBIF. No need to make another API call —
    # we can directly determine the subspecies is not in the backbone.
    # Only fall back to API when the parent species was NOT in our cache
    # (in which case we don't have children data and need to check GBIF).
    binomial_lower = sci_name.lower()
    parent_in_cache = (
        binomial_lower in cache.get("species", {})
        or binomial_lower in cache.get("synonyms", {})
    )

    if parent_in_cache:
        # Parent species is in cache → we have complete children data.
        # Subspecies not found = definitively not in GBIF backbone.
        result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' not in GBIF backbone "
            f"(parent species cached, children list checked)."
        )
        return

    # Parent species NOT in cache — API fallback for fuzzy matching
    trinomial_full = f"{sci_name} {ssp_cleaned}"
    _api_call_count += 1
    ssp_result = match_species(trinomial_full, rank="SUBSPECIES")

    if not ssp_result:
        result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' not found (API error)."
        )
        return

    ssp_match_type = ssp_result.get("matchType", "NONE")
    ssp_confidence = ssp_result.get("confidence", 0)
    ssp_canonical = ssp_result.get("canonicalName", "")

    result["subspecies_match"] = {
        "matchType": ssp_match_type,
        "source": "api_fallback",
        "confidence": ssp_confidence,
        "status": ssp_result.get("status", ""),
        "gbifKey": ssp_result.get("usageKey"),
        "canonicalName": ssp_canonical,
        "rank": ssp_result.get("rank"),
        "synonym": ssp_result.get("synonym", False),
    }

    if ssp_match_type == "NONE":
        result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' not found in GBIF backbone."
        )
    elif ssp_match_type == "HIGHERRANK":
        result["flags"].append("SUBSPECIES_MATCHED_HIGHER")
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' matched only at species level "
            f"(trinomial not recognized)."
        )
    elif ssp_match_type == "FUZZY":
        # Detect false positives
        matched_parts = ssp_canonical.split()
        matched_ssp_epithet = matched_parts[-1] if len(matched_parts) >= 3 else ""
        if ssp_cleaned != matched_ssp_epithet.lower():
            result["flags"].append("SUBSPECIES_FUZZY_FALSE_POSITIVE")
            result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
            result["notes"].append(
                f"{note_prefix}Fuzzy FALSE POSITIVE: '{ssp_cleaned}' matched to "
                f"'{matched_ssp_epithet}' (different subspecies)."
            )
        else:
            result["flags"].append("SUBSPECIES_FUZZY")
            result["notes"].append(
                f"{note_prefix}Subspecies fuzzy match: '{ssp_cleaned}' -> "
                f"'{ssp_canonical}' (confidence: {ssp_confidence}%)"
            )
    elif ssp_result.get("synonym"):
        result["flags"].append("SUBSPECIES_SYNONYM")
        result["notes"].append(
            f"{note_prefix}Subspecies synonym via API: '{trinomial_full}'"
        )
    else:
        # Exact match via API (was missing from cache — shouldn't happen often)
        result["notes"].append(
            f"{note_prefix}Subspecies '{ssp_cleaned}' found via API "
            f"(was not in local cache)."
        )


def _determine_status(result):
    """Determine the overall curation status based on flags."""
    flags = set(result["flags"])

    if not flags:
        result["status"] = "verified"
        _set_curated_name(result)
        return

    # Priority ordering for status
    # Literature corrections take highest priority
    if "SUBSPECIES_AS_SPECIES" in flags:
        result["status"] = "corrected_literature"
    elif "SPELLING_CORRECTED" in flags:
        result["status"] = "corrected_literature"
    elif "GBIF_FUZZY_OVERRIDDEN" in flags:
        result["status"] = "verified_literature"
    elif "LITERATURE_VERIFIED" in flags:
        result["status"] = "verified_literature"
    elif "GBIF_API_ERROR" in flags:
        result["status"] = "api_error"
    elif "SPECIES_NOT_IN_BACKBONE" in flags or "MATCHED_HIGHER_RANK" in flags:
        result["status"] = "higher_rank_only"
    elif "SYNONYM" in flags:
        result["status"] = "synonym_resolved"
    elif "FUZZY_MATCH" in flags:
        result["status"] = "review_spelling"
    elif "UNDESCRIBED_SUBSPECIES" in flags:
        result["status"] = "undescribed"
    elif flags & {"QUESTION_MARK_SUBSPECIES", "FORM_NAME", "SLASH_ALTERNATIVE",
                   "FREE_TEXT_SUBSPECIES", "GEOGRAPHIC_SUFFIX"}:
        result["status"] = "non_standard_subspecies"
    elif flags & {"SUBSPECIES_FUZZY_FALSE_POSITIVE", "SUBSPECIES_NOT_IN_BACKBONE",
                   "SUBSPECIES_MATCHED_HIGHER"}:
        result["status"] = "subspecies_unresolved"
    elif "SUBSPECIES_SYNONYM" in flags:
        result["status"] = "subspecies_synonym"
    elif "SUBSPECIES_FUZZY" in flags:
        result["status"] = "review_subspecies_spelling"
    elif "NOMINOTYPICAL" in flags:
        result["status"] = "verified_nominotypical"
    else:
        result["status"] = "verified"

    _set_curated_name(result)


def _set_curated_name(result):
    """
    Set the curated_name field — the final recommended name after all corrections.
    Priority: literature_action > accepted_name (synonym resolution) > input name.
    """
    # Already set by literature correction
    if result.get("curated_name"):
        return

    # Synonym resolution: use the accepted name
    if result.get("accepted_name") and "SYNONYM" in result.get("flags", []):
        accepted = result["accepted_name"]
        ssp = result["input"].get("subspecies")
        if ssp and result["input"].get("ssp_category") == "standard":
            result["curated_name"] = (
                f"{accepted['canonicalName']} {result['input']['ssp_cleaned']}"
            )
        else:
            result["curated_name"] = accepted["canonicalName"]
        return

    # Spelling correction via GBIF fuzzy (not overridden by literature)
    if "FUZZY_MATCH" in result.get("flags", []):
        sm = result.get("species_match")
        if sm:
            ssp = result["input"].get("subspecies")
            if ssp and result["input"].get("ssp_category") == "standard":
                result["curated_name"] = (
                    f"{sm['canonicalName']} {result['input']['ssp_cleaned']}"
                )
            else:
                result["curated_name"] = sm["canonicalName"]
        return

    # Default: input name is correct
    inp = result["input"]
    sci = inp.get("scientific_name", "")
    ssp = inp.get("subspecies")
    if ssp and inp.get("ssp_category") == "standard":
        result["curated_name"] = f"{sci} {inp['ssp_cleaned']}"
    else:
        result["curated_name"] = sci


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTING
# ═══════════════════════════════════════════════════════════════════════════════


def print_curation_summary(results, cache):
    """Print a summary of curation results."""
    print("\n" + "=" * 70)
    print("CURATION RESULTS SUMMARY")
    print("=" * 70)

    total = len(results)
    statuses = Counter(r["status"] for r in results)
    print(f"\nTotal names curated: {total}")
    print(f"\nStatus breakdown:")
    for status, count in statuses.most_common():
        pct = count / total * 100
        print(f"  {status:30s}  {count:4d}  ({pct:5.1f}%)")

    # Resolution rates by rank
    species_resolved = sum(
        1 for r in results
        if r["species_match"]
        and r["species_match"]["matchType"] in ("EXACT", "FUZZY")
    )
    with_ssp = [r for r in results
                if r["input"].get("subspecies")
                and r["input"]["ssp_category"] == "standard"]
    ssp_resolved = sum(
        1 for r in with_ssp
        if r.get("subspecies_match")
        and r["subspecies_match"]["matchType"] == "EXACT"
    )

    print(f"\n--- Resolution Rates ---")
    print(f"  Species-level:     {species_resolved}/{total} "
          f"({species_resolved/total*100:.1f}%) matched in GBIF backbone")
    if with_ssp:
        print(f"  Subspecies-level:  {ssp_resolved}/{len(with_ssp)} "
              f"({ssp_resolved/len(with_ssp)*100:.1f}%) exactly matched")

    # Subspecies category breakdown
    ssp_cats = Counter(r["input"]["ssp_category"] for r in results)
    print(f"\n--- Subspecies Categories ---")
    for cat, count in ssp_cats.most_common():
        pct = count / total * 100
        print(f"  {cat:25s}  {count:4d}  ({pct:5.1f}%)")

    flags = Counter()
    for r in results:
        for f in r["flags"]:
            flags[f] += 1

    if flags:
        print(f"\nAll flags:")
        for flag, count in flags.most_common():
            print(f"  {flag:40s}  {count:4d}")

    # Show specific interesting cases
    synonyms = [r for r in results if "SYNONYM" in r["flags"]]
    if synonyms:
        print(f"\n--- Species Synonyms Found ({len(synonyms)}) ---")
        for r in synonyms[:15]:
            inp = r["input"]["scientific_name"]
            acc = r["accepted_name"]["canonicalName"] if r.get("accepted_name") else "?"
            print(f"  {inp:40s} -> {acc}")
        if len(synonyms) > 15:
            print(f"  ... and {len(synonyms) - 15} more")

    fuzzy = [r for r in results if "FUZZY_MATCH" in r["flags"]]
    if fuzzy:
        print(f"\n--- Species Fuzzy Matches ({len(fuzzy)}) ---")
        for r in fuzzy[:15]:
            inp = r["input"]["scientific_name"]
            matched = r["species_match"]["canonicalName"] if r["species_match"] else "?"
            conf = r["species_match"].get("confidence", "?") if r["species_match"] else "?"
            print(f"  {inp:40s} -> {matched} ({conf}%)")

    ssp_fuzzy_fp = [r for r in results if "SUBSPECIES_FUZZY_FALSE_POSITIVE" in r["flags"]]
    if ssp_fuzzy_fp:
        print(f"\n--- Subspecies Fuzzy False Positives ({len(ssp_fuzzy_fp)}) ---")
        for r in ssp_fuzzy_fp[:10]:
            for note in r["notes"]:
                if "FALSE POSITIVE" in note:
                    print(f"  {note}")

    # Literature-based corrections
    lit_verified = [r for r in results if r["status"] == "verified_literature"]
    if lit_verified:
        print(f"\n--- Literature-Verified ({len(lit_verified)}) ---")
        gbif_overrides = [r for r in lit_verified if "GBIF_FUZZY_OVERRIDDEN" in r["flags"]]
        gbif_missing = [r for r in lit_verified if "LITERATURE_VERIFIED" in r["flags"]
                        and "GBIF_FUZZY_OVERRIDDEN" not in r["flags"]]
        if gbif_overrides:
            print(f"  GBIF fuzzy suggestions rejected (dataset correct): {len(gbif_overrides)}")
            for r in gbif_overrides[:5]:
                inp = r["input"]["scientific_name"]
                rejected = r["species_match"].get("gbif_suggestion_rejected", "?")
                print(f"    {inp:35s} (GBIF wrongly suggested: {rejected})")
            if len(gbif_overrides) > 5:
                print(f"    ... and {len(gbif_overrides) - 5} more")
        if gbif_missing:
            print(f"  Valid species not in GBIF backbone: {len(gbif_missing)}")
            for r in gbif_missing[:10]:
                print(f"    {r['input']['scientific_name']}")
            if len(gbif_missing) > 10:
                print(f"    ... and {len(gbif_missing) - 10} more")

    lit_corrected = [r for r in results if r["status"] == "corrected_literature"]
    if lit_corrected:
        print(f"\n--- Literature Corrections Applied ({len(lit_corrected)}) ---")
        for r in lit_corrected[:10]:
            action = r.get("literature_action", "")
            inp_name = r["input"]["scientific_name"]
            curated = r.get("curated_name", "?")
            print(f"  {inp_name:35s} -> {curated}")
        if len(lit_corrected) > 10:
            print(f"  ... and {len(lit_corrected) - 10} more")

    not_found = [r for r in results if "SPECIES_NOT_IN_BACKBONE" in r["flags"]]
    if not_found:
        print(f"\n--- Species Not Found in GBIF ({len(not_found)}) ---")
        for r in not_found:
            print(f"  {r['input']['scientific_name']}")

    higher = [r for r in results
              if "MATCHED_HIGHER_RANK" in r["flags"]
              and r["status"] != "verified_literature"]
    if higher:
        print(f"\n--- Matched Higher Rank Only ({len(higher)}) ---")
        for r in higher[:15]:
            inp = r["input"]["scientific_name"]
            rank = r["species_match"]["rank"] if r["species_match"] else "?"
            print(f"  {inp:40s} -> {rank}")

    ssp_missing = [r for r in results
                   if "SUBSPECIES_NOT_IN_BACKBONE" in r["flags"]
                   or "SUBSPECIES_MATCHED_HIGHER" in r["flags"]]
    if ssp_missing:
        print(f"\n--- Subspecies Not in Backbone ({len(ssp_missing)}) ---")
        for r in ssp_missing[:20]:
            inp = r["input"]["scientific_name"]
            ssp = r["input"]["subspecies"]
            recognized = [
                s["name"].split()[-1]
                for s in r.get("recognized_subspecies", [])
                if s.get("status") == "ACCEPTED"
            ]
            rec_str = ", ".join(recognized[:8]) if recognized else "none listed"
            print(f"  {inp} {ssp}")
            print(f"    GBIF recognized: [{rec_str}]")
        if len(ssp_missing) > 20:
            print(f"  ... and {len(ssp_missing) - 20} more")

    ssp_syn = [r for r in results if "SUBSPECIES_SYNONYM" in r["flags"]]
    if ssp_syn:
        print(f"\n--- Subspecies Synonyms ({len(ssp_syn)}) ---")
        for r in ssp_syn[:15]:
            for note in r["notes"]:
                if "synonym" in note.lower():
                    print(f"  {note}")

    nom = [r for r in results if "NOMINOTYPICAL" in r["flags"]]
    if nom:
        print(f"\n--- Nominotypical Subspecies ({len(nom)}) ---")
        shown = set()
        for r in nom[:10]:
            key = r["input"]["scientific_name"]
            if key not in shown:
                print(f"  {key} {r['input']['subspecies']}")
                shown.add(key)
        if len(nom) > 10:
            print(f"  ... and {len(nom) - len(shown)} more unique")

    # Performance
    print(f"\n--- Performance ---")
    cache_species = len(cache.get("species", {}))
    cache_subspecies = len(cache.get("subspecies", {}))
    cache_synonyms = len(cache.get("synonyms", {}))
    print(f"  Cache: {cache_species} species, {cache_subspecies} subspecies, "
          f"{cache_synonyms} synonyms")
    print(f"  API fallback calls: {_api_call_count}")
    cache_resolved = total - _api_call_count
    print(f"  Cache-resolved: {cache_resolved}/{total} "
          f"({cache_resolved/total*100:.1f}%)")

    print()


def save_report(quality_report, results, cache):
    """Save full curation report to JSON."""
    output = {
        "metadata": {
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "gbif_api": GBIF_API,
            "backbone": "GBIF Backbone Taxonomy",
            "higher_constraints": HIGHER_TAXONOMY,
            "methodology": (
                "Phase 1: Bulk-fetched all Ithomiini taxa from GBIF backbone "
                "(one search request per genus, ~45 total). "
                "Phase 2: Matched dataset names against local cache with zero "
                "API calls. Phase 3: Targeted API fallback only for unresolved "
                "names (fuzzy matching, names outside known genera). "
                "Follows Grenié et al. (2023) higher taxonomy constraints for "
                "disambiguation."
            ),
            "cache_stats": cache.get("metadata", {}),
            "api_fallback_calls": _api_call_count,
        },
        "quality_assessment": {
            k: v
            for k, v in quality_report.items()
            if k != "issues"
        },
        "quality_issues": {
            k: (dict(v) if isinstance(v, Counter) else v)
            for k, v in quality_report["issues"].items()
        },
        "curation_summary": {
            "total_curated": len(results),
            "statuses": dict(Counter(r["status"] for r in results)),
            "flags": dict(Counter(f for r in results for f in r["flags"])),
            "subspecies_categories": dict(
                Counter(r["input"]["ssp_category"] for r in results)
            ),
        },
        "results": results,
    }

    with open(CURATION_REPORT, "w") as f:
        json.dump(output, f, indent=2, default=str)
    log.info(f"Report saved to {CURATION_REPORT}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(
        description="Taxonomic name curation for Ithomiini dataset"
    )
    parser.add_argument(
        "--input", "-i", type=str, default=None,
        help="Input file to curate (CSV, TSV, Excel, or JSON). "
             "Default: public/data/map_points.json"
    )
    parser.add_argument(
        "--output", "-o", type=str, default=None,
        help="Output file for curated data. Default: auto-generated from input "
             "filename (e.g. data.csv -> data_curated.csv)"
    )
    parser.add_argument(
        "--test", action="store_true",
        help="Run on a test subset (~50 names) for quick validation"
    )
    parser.add_argument(
        "--limit", type=int, default=50,
        help="Max names to curate in test mode (default: 50)"
    )
    parser.add_argument(
        "--report-only", action="store_true",
        help="Only run data quality assessment, no GBIF queries"
    )
    parser.add_argument(
        "--rebuild-cache", action="store_true",
        help="Force rebuild of GBIF taxonomy cache"
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Apply corrections and write curated dataset"
    )
    parser.add_argument(
        "--corrections", type=str, default=None,
        help="Path to custom corrections JSON file. "
             "Default: scripts/taxonomic_corrections.json"
    )
    args = parser.parse_args()

    # Reload corrections from custom file if specified
    if args.corrections:
        global SPELLING_CORRECTIONS, DATASET_CORRECT_OVER_GBIF, \
               SUBSPECIES_AS_SPECIES, VALID_SPECIES_NOT_IN_GBIF
        SPELLING_CORRECTIONS, DATASET_CORRECT_OVER_GBIF, \
            SUBSPECIES_AS_SPECIES, VALID_SPECIES_NOT_IN_GBIF = \
            _load_corrections(args.corrections)
        log.info(f"Loaded custom corrections from {args.corrections}")

    # Load data
    records, preset, input_path = load_data(args.input)

    # Step 1: Data quality assessment
    log.info("Running data quality assessment...")
    quality = assess_data_quality(records)
    print_quality_report(quality)

    if args.report_only:
        return

    # Step 2: Build/load GBIF taxonomy cache
    cache = load_or_build_cache(records, force_rebuild=args.rebuild_cache)

    # Step 3: Extract unique names
    limit = args.limit if args.test else None
    names = extract_unique_names(records, limit=limit)
    log.info(f"Extracted {len(names)} unique name combinations to curate")

    if not names:
        log.warning("No names to curate")
        return

    # Step 4: Curate each name against cache
    results = []
    total = len(names)
    start_time = time.time()

    print(f"\nCurating {total} names against GBIF backbone (cache-first)...")
    print("-" * 70)

    for i, name in enumerate(names):
        if (i + 1) % 100 == 0 or i == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            log.info(
                f"[{i+1}/{total}] Processing: {name['scientific_name']}"
                f" ({rate:.1f} names/sec, API calls: {_api_call_count})"
            )

        result = curate_name(name, cache)
        results.append(result)

    elapsed = time.time() - start_time
    log.info(
        f"Curation complete in {elapsed:.1f}s "
        f"({len(results)/elapsed:.1f} names/sec, "
        f"{_api_call_count} API calls)"
    )

    # Step 5: Report
    print_curation_summary(results, cache)
    save_report(quality, results, cache)

    # Step 6: Print actionable items
    needs_review = [
        r for r in results
        if r["status"] in ("higher_rank_only", "api_error", "review_spelling")
    ]
    if needs_review:
        print("=" * 70)
        print(f"ACTION NEEDED: {len(needs_review)} names require expert review")
        print("=" * 70)
        print(f"See full report: {CURATION_REPORT}")
    else:
        print("All names processed. See report for details.")

    # Step 7: Apply corrections if requested
    if args.apply:
        apply_corrections(records, results, input_path=input_path,
                          output_file=args.output, preset=preset)


# ═══════════════════════════════════════════════════════════════════════════════
# APPLY CORRECTIONS TO DATASET
# ═══════════════════════════════════════════════════════════════════════════════

CURATED_DATA_FILE = OUTPUT_DIR / "map_points_curated.json"
CORRECTIONS_LOG_FILE = OUTPUT_DIR / "taxonomic_corrections_applied.json"


def apply_corrections(records, results, input_path=None, output_file=None,
                      preset=None):
    """
    Apply all curation corrections to the dataset and write a curated copy.

    Corrections applied:
    1. Spelling corrections (literature-confirmed)
    2. Synonym resolution (GBIF accepted names)
    3. Subspecies-as-species reclassification
    4. GBIF fuzzy overrides marked (dataset name kept)
    5. Literature-verified species marked

    For the app's map_points.json: writes corrections in-place so the app
    picks them up. Also writes a separate curated copy and corrections log.

    For external files (CSV, Excel): writes a curated copy next to the
    original with _curated suffix (or to --output path).
    """
    is_app_data = (input_path is None or
                   Path(input_path).resolve() == DATA_FILE.resolve())
    log.info("Applying corrections to dataset...")

    # Build lookup: (scientific_name, subspecies) -> curation result
    result_lookup = {}
    for r in results:
        inp = r["input"]
        key = (inp.get("scientific_name", ""), inp.get("subspecies") or "")
        # Use original input (before corrections) as key
        # We need to reconstruct the original name if it was corrected
        original_sci = inp.get("scientific_name", "")
        # Check if this was spelling-corrected — original is in notes
        if "SPELLING_CORRECTED" in r.get("flags", []):
            for note in r.get("notes", []):
                if "Spelling correction (literature):" in note:
                    # Extract original from "'original' -> 'corrected'"
                    parts = note.split("'")
                    if len(parts) >= 2:
                        original_sci = parts[1]
                        break
        # Check if this was subspecies-as-species — original is in notes
        if "SUBSPECIES_AS_SPECIES" in r.get("flags", []):
            for note in r.get("notes", []):
                if "is actually a subspecies" in note:
                    parts = note.split("'")
                    if len(parts) >= 2:
                        original_sci = parts[1]
                        break
        key = (original_sci, inp.get("subspecies") or "")
        result_lookup[key] = r

    # Apply corrections
    corrections_log = []
    curated_records = []
    stats = Counter()

    for rec in records:
        curated = dict(rec)  # shallow copy
        sci_name = rec.get("scientific_name", "")
        subspecies = rec.get("subspecies") or ""
        key = (sci_name, subspecies)

        curation = result_lookup.get(key)
        if not curation:
            curated["curation_status"] = "not_curated"
            curated_records.append(curated)
            stats["not_curated"] += 1
            continue

        status = curation["status"]
        curated["curation_status"] = status
        curated["curated_name"] = curation.get("curated_name", sci_name)
        curated["literature_action"] = curation.get("literature_action")

        # Apply specific corrections
        changed = False

        # Spelling corrections
        if "SPELLING_CORRECTED" in curation.get("flags", []):
            corrected = SPELLING_CORRECTIONS.get(sci_name)
            if corrected:
                parts = corrected.split()
                curated["scientific_name"] = corrected
                if len(parts) >= 2:
                    curated["genus"] = parts[0]
                    curated["species"] = parts[1]
                corrections_log.append({
                    "type": "spelling_correction",
                    "original": sci_name,
                    "corrected": corrected,
                    "subspecies": subspecies,
                    "source": "literature review",
                })
                changed = True

        # Synonym resolution — update scientific_name to accepted name
        if status == "synonym_resolved" and curation.get("accepted_name"):
            accepted = curation["accepted_name"]
            acc_name = accepted.get("canonicalName", "")
            if acc_name and acc_name != sci_name:
                parts = acc_name.split()
                curated["scientific_name_original"] = sci_name
                curated["scientific_name"] = acc_name
                if len(parts) >= 2:
                    curated["genus"] = parts[0]
                    curated["species"] = parts[1]
                corrections_log.append({
                    "type": "synonym_resolution",
                    "original": sci_name,
                    "accepted": acc_name,
                    "subspecies": subspecies,
                    "source": "GBIF backbone",
                })
                changed = True

        # Subspecies-as-species reclassification
        ssp_remap = SUBSPECIES_AS_SPECIES.get(sci_name.lower())
        if ssp_remap:
            correct_species, ssp_epithet, source = ssp_remap
            parts = correct_species.split()
            curated["scientific_name_original"] = sci_name
            curated["scientific_name"] = correct_species
            if len(parts) >= 2:
                curated["genus"] = parts[0]
                curated["species"] = parts[1]
            # The subspecies from the original record becomes a sub-subspecies
            # identifier; the species epithet itself was a subspecies
            if not subspecies:
                curated["subspecies"] = ssp_epithet
            corrections_log.append({
                "type": "subspecies_reclassification",
                "original_species": sci_name,
                "correct_species": correct_species,
                "subspecies_epithet": ssp_epithet,
                "source": source,
            })
            changed = True

        if changed:
            stats["corrected"] += 1
        else:
            stats[status] += 1

        curated_records.append(curated)

    # ─── Write output ───────────────────────────────────────────────────────

    if is_app_data:
        # App pipeline: write curated JSON + in-place update + corrections log
        _write_app_outputs(curated_records, corrections_log, records, stats)
    else:
        # External file: write curated copy in same format as input
        _write_external_output(curated_records, corrections_log, records,
                               stats, input_path, output_file, preset)


def _write_app_outputs(curated_records, corrections_log, records, stats):
    """Write outputs for the app's map_points.json pipeline."""
    # Write curated dataset (separate copy with curation metadata fields)
    with open(CURATED_DATA_FILE, "w") as f:
        json.dump(curated_records, f, indent=2, default=str)

    # Write corrections back into the main map_points.json (in-place)
    # Only modifies scientific_name, genus, species, subspecies fields.
    # Preserves all other fields (lat, lng, source, etc.).
    inplace_records = []
    for rec in curated_records:
        # Strip curation metadata fields — keep only the data fields the app uses
        cleaned = {
            k: v for k, v in rec.items()
            if k not in ("curation_status", "curated_name", "literature_action")
        }
        inplace_records.append(cleaned)

    with open(DATA_FILE, "w") as f:
        json.dump(inplace_records, f, separators=(",", ":"), default=str)
    log.info(f"Updated {DATA_FILE} in-place with corrections")

    # Write corrections log
    _write_corrections_log(corrections_log, records, stats)

    log.info(f"Curated dataset written to {CURATED_DATA_FILE}")
    _print_summary(records, corrections_log, stats, CURATED_DATA_FILE)


def _write_external_output(curated_records, corrections_log, records,
                           stats, input_path, output_file, preset):
    """
    Write curated output for external files (CSV, TSV, Excel).
    Adds curation columns alongside original data.
    """
    input_path = Path(input_path)
    ext = input_path.suffix.lower()

    # Determine output path
    if output_file:
        out_path = Path(output_file)
        if not out_path.is_absolute():
            out_path = PROJECT_ROOT / out_path
    else:
        out_path = input_path.parent / f"{input_path.stem}_curated{ext}"

    # Prepare output records — include curation columns for transparency
    out_records = []
    for rec in curated_records:
        out = dict(rec)
        # Ensure curation columns are present even for uncurated records
        out.setdefault("curation_status", "not_curated")
        out.setdefault("scientific_name_original", None)
        out.setdefault("curated_name", out.get("scientific_name", ""))
        # Remove internal metadata not useful in output files
        out.pop("literature_action", None)
        out_records.append(out)

    if ext == ".json":
        with open(out_path, "w") as f:
            json.dump(out_records, f, indent=2, default=str)

    elif ext in (".csv", ".tsv"):
        if out_records:
            fieldnames = list(out_records[0].keys())
            delimiter = "\t" if ext == ".tsv" else ","
            with open(out_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames,
                                        delimiter=delimiter)
                writer.writeheader()
                writer.writerows(out_records)

    elif ext in (".xlsx", ".xls"):
        try:
            import pandas as pd
        except ImportError:
            log.error("pandas and openpyxl are required to write Excel files.")
            # Fall back to CSV
            csv_path = out_path.with_suffix(".csv")
            log.info(f"Falling back to CSV: {csv_path}")
            fieldnames = list(out_records[0].keys()) if out_records else []
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(out_records)
            out_path = csv_path
        else:
            df = pd.DataFrame(out_records)
            df.to_excel(out_path, index=False)

    log.info(f"Curated dataset written to {out_path}")

    # Write corrections log next to the output file
    log_path = out_path.parent / f"{out_path.stem}_corrections.json"
    _write_corrections_log(corrections_log, records, stats, log_path)

    _print_summary(records, corrections_log, stats, out_path)


def _write_corrections_log(corrections_log, records, stats, log_file=None):
    """Write corrections log JSON."""
    out_path = log_file or CORRECTIONS_LOG_FILE
    corrections_summary = {
        "applied_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "total_records": len(records),
        "stats": dict(stats),
        "total_corrections": len(corrections_log),
        "corrections": corrections_log,
        "correction_tables": {
            "spelling_corrections": SPELLING_CORRECTIONS,
            "dataset_correct_over_gbif": {
                k: v[1] for k, v in DATASET_CORRECT_OVER_GBIF.items()
            },
            "subspecies_as_species": {
                k: f"{v[0]} {v[1]}" for k, v in SUBSPECIES_AS_SPECIES.items()
            },
            "valid_species_not_in_gbif_count": len(VALID_SPECIES_NOT_IN_GBIF),
        },
    }
    with open(out_path, "w") as f:
        json.dump(corrections_summary, f, indent=2, default=str)
    log.info(f"Corrections log written to {out_path}")


def _print_summary(records, corrections_log, stats, output_path):
    """Print correction summary to console."""
    print(f"\n{'=' * 70}")
    print(f"CORRECTIONS APPLIED")
    print(f"{'=' * 70}")
    print(f"Total records:        {len(records):,}")
    print(f"Records corrected:    {stats.get('corrected', 0):,}")
    print(f"Total corrections:    {len(corrections_log)}")
    print(f"\nCorrection breakdown:")
    type_counts = Counter(c["type"] for c in corrections_log)
    for ctype, count in type_counts.most_common():
        print(f"  {ctype:35s}  {count:,}")
    print(f"\nOutput: {output_path}")


if __name__ == "__main__":
    main()
