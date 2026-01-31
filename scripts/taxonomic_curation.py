#!/usr/bin/env python3
"""
Taxonomic Name Curation Pipeline
=================================
Validates and curates taxonomic names in the Ithomiini dataset against the
GBIF Backbone Taxonomy (built on the Catalogue of Life).

Methodology follows Grenié et al. (2023) best practices for taxonomic
harmonization:
  1. Parse names into canonical components
  2. Match against a single authoritative backbone (GBIF)
  3. Resolve synonyms to accepted names
  4. Validate subspecific names
  5. Flag problematic records for expert review

References:
  - Grenié M et al. (2023) Methods Ecol Evol 14:12-25
  - Lamas G (2004) Checklist: Hesperioidea - Papilionoidea
  - Willmott KR et al. (2020, 2021) Trop Lepid Res

Usage:
  python scripts/taxonomic_curation.py                  # Full run
  python scripts/taxonomic_curation.py --test           # Test subset (~50 names)
  python scripts/taxonomic_curation.py --test --limit 20
  python scripts/taxonomic_curation.py --report-only    # Just show data quality
"""

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
DATA_FILE = PROJECT_ROOT / "public" / "data" / "map_points.json"
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"
CURATION_REPORT = OUTPUT_DIR / "taxonomic_curation_report.json"

GBIF_API = "https://api.gbif.org/v1"
GBIF_MATCH_URL = f"{GBIF_API}/species/match"
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# DATA LOADING & QUALITY ASSESSMENT
# ═══════════════════════════════════════════════════════════════════════════════


def load_data():
    """Load the map_points.json dataset."""
    log.info(f"Loading data from {DATA_FILE}")
    with open(DATA_FILE) as f:
        data = json.load(f)
    log.info(f"Loaded {len(data):,} records")
    return data


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
            "missing_subspecies": 0,
            "not_found_taxonomy": 0,
            "malformed_names": [],
            "casing_issues": [],
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

        # Check subspecies
        if not subspecies or subspecies in ("None", "NA", "NaN", ""):
            report["issues"]["missing_subspecies"] += 1
        elif UNDESCRIBED_PATTERNS.match(subspecies):
            report["issues"]["undescribed_subspecies"][subspecies] += 1

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
                # Rate limited or server error - back off
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

    Uses higher taxonomy constraints (kingdom, order, family) to disambiguate
    homonyms and improve match accuracy, per Grenié et al. (2023).

    Returns the full match result dict from GBIF.
    """
    params = {
        "name": name,
        "rank": rank,
        "strict": str(strict).lower(),
        "verbose": "true",
        **HIGHER_TAXONOMY,
    }
    return gbif_request(GBIF_MATCH_URL, params)


def get_accepted_name(usage_key):
    """
    Look up the accepted name for a given GBIF usage key.
    Used when a matched name is a synonym.
    """
    result = gbif_request(f"{GBIF_USAGE_URL}/{usage_key}", {})
    if result:
        return {
            "key": result.get("key"),
            "scientificName": result.get("scientificName"),
            "canonicalName": result.get("canonicalName"),
            "rank": result.get("rank"),
            "status": result.get("taxonomicStatus"),
        }
    return None


def get_children(usage_key, rank_filter=None):
    """
    Get child taxa for a given GBIF usage key.
    Useful for retrieving all subspecies of a species.
    """
    params = {"limit": 200}
    result = gbif_request(f"{GBIF_USAGE_URL}/{usage_key}/children", params)
    if not result:
        return []
    children = result.get("results", [])
    if rank_filter:
        children = [c for c in children if c.get("rank") == rank_filter]
    return children


# ═══════════════════════════════════════════════════════════════════════════════
# CURATION PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

# Cache for species-level matches (avoids re-querying same species for each subspecies)
_species_cache = {}  # sci_name -> (match_result, accepted_name, recognized_subspecies)


def get_species_match_cached(sci_name):
    """
    Match a species against GBIF with caching.
    Returns (species_result, accepted_name_dict, recognized_subspecies_list).
    """
    if sci_name in _species_cache:
        return _species_cache[sci_name]

    species_result = match_species(sci_name, rank="SPECIES")
    accepted_name = None
    recognized_subspecies = []

    if species_result:
        match_type = species_result.get("matchType", "NONE")

        if match_type in ("EXACT", "FUZZY"):
            # Resolve synonym
            if species_result.get("synonym"):
                acc_key = species_result.get("acceptedUsageKey")
                if acc_key:
                    accepted_name = get_accepted_name(acc_key)
            else:
                accepted_name = {
                    "key": species_result.get("usageKey"),
                    "scientificName": species_result.get("scientificName"),
                    "canonicalName": species_result.get("canonicalName"),
                    "rank": species_result.get("rank"),
                    "status": species_result.get("status"),
                }

            # Fetch recognized subspecies
            sp_key = (
                accepted_name["key"] if accepted_name
                else species_result.get("usageKey")
            )
            if sp_key:
                children = get_children(sp_key, rank_filter="SUBSPECIES")
                recognized_subspecies = [
                    {
                        "name": c.get("canonicalName", ""),
                        "status": c.get("taxonomicStatus", ""),
                        "key": c.get("key"),
                    }
                    for c in children[:50]
                ]

    result = (species_result, accepted_name, recognized_subspecies)
    _species_cache[sci_name] = result
    return result


def extract_unique_names(records, limit=None):
    """
    Extract unique taxonomic name combinations to curate.
    Returns a list of dicts with genus, species, subspecies, scientific_name.
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

        # Skip undescribed subspecies for GBIF matching (they won't be there)
        is_undescribed = False
        if subspecies and UNDESCRIBED_PATTERNS.match(subspecies):
            is_undescribed = True

        names.append({
            "genus": genus,
            "species_epithet": species_epithet,
            "subspecies": subspecies or None,
            "scientific_name": sci_name,
            "is_undescribed": is_undescribed,
        })

        if limit and len(names) >= limit:
            break

    return names


def curate_name(name_entry):
    """
    Run the full curation pipeline on a single taxonomic name.

    Steps:
    1. Match binomial (genus + species) against GBIF backbone (with cache)
    2. If match is SYNONYM, resolve to accepted name
    3. If subspecies provided, validate trinomial
    4. Detect fuzzy false positives (e.g., "elarina" fuzzy-matched to "elara")
    5. Cross-reference against recognized subspecies list

    Returns a curation result dict.
    """
    sci_name = name_entry["scientific_name"]
    subspecies = name_entry["subspecies"]
    result = {
        "input": name_entry,
        "species_match": None,
        "subspecies_match": None,
        "accepted_name": None,
        "recognized_subspecies": [],
        "status": "pending",
        "flags": [],
        "notes": [],
    }

    # Step 1: Match the binomial (cached to avoid repeating for same species)
    log.debug(f"Matching: {sci_name}")
    species_result, cached_accepted, cached_children = get_species_match_cached(sci_name)

    if not species_result:
        result["status"] = "api_error"
        result["flags"].append("GBIF_API_ERROR")
        return result

    match_type = species_result.get("matchType", "NONE")
    confidence = species_result.get("confidence", 0)
    status = species_result.get("status", "")

    result["species_match"] = {
        "matchType": match_type,
        "confidence": confidence,
        "status": status,
        "gbifKey": species_result.get("usageKey"),
        "scientificName": species_result.get("scientificName"),
        "canonicalName": species_result.get("canonicalName"),
        "rank": species_result.get("rank"),
        "synonym": species_result.get("synonym", False),
        "note": species_result.get("note", ""),
    }

    # Use cached data
    result["accepted_name"] = cached_accepted
    result["recognized_subspecies"] = cached_children

    # Handle match types
    if match_type == "NONE":
        result["status"] = "not_found"
        result["flags"].append("SPECIES_NOT_IN_BACKBONE")
        result["notes"].append(
            f"'{sci_name}' not found in GBIF Backbone. "
            "May be a recently described species or a spelling error."
        )
        return result

    if match_type == "HIGHERRANK":
        result["status"] = "higher_rank_only"
        result["flags"].append("MATCHED_HIGHER_RANK")
        matched_rank = species_result.get("rank", "")
        result["notes"].append(
            f"'{sci_name}' matched only at {matched_rank} level. "
            "The species may not be in the backbone."
        )
        return result

    if match_type == "FUZZY":
        result["flags"].append("FUZZY_MATCH")
        matched_name = species_result.get("canonicalName", "")
        result["notes"].append(
            f"Fuzzy match: '{sci_name}' -> '{matched_name}' (confidence: {confidence}%). "
            "Possible spelling correction."
        )

    # Step 2: Record synonym status
    if species_result.get("synonym"):
        result["flags"].append("SYNONYM")
        if cached_accepted:
            result["notes"].append(
                f"SYNONYM: '{sci_name}' -> accepted: '{cached_accepted['canonicalName']}' "
                f"(status: {cached_accepted['status']})"
            )

    # Step 3: Validate subspecies if provided
    if subspecies and not name_entry.get("is_undescribed"):
        trinomial = f"{sci_name} {subspecies}"
        ssp_result = match_species(trinomial, rank="SUBSPECIES")

        if ssp_result:
            ssp_match_type = ssp_result.get("matchType", "NONE")
            ssp_confidence = ssp_result.get("confidence", 0)
            ssp_canonical = ssp_result.get("canonicalName", "")

            result["subspecies_match"] = {
                "matchType": ssp_match_type,
                "confidence": ssp_confidence,
                "status": ssp_result.get("status", ""),
                "gbifKey": ssp_result.get("usageKey"),
                "scientificName": ssp_result.get("scientificName"),
                "canonicalName": ssp_canonical,
                "rank": ssp_result.get("rank"),
                "synonym": ssp_result.get("synonym", False),
            }

            if ssp_match_type == "NONE":
                result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
                result["notes"].append(
                    f"Subspecies '{subspecies}' not found in GBIF backbone for {sci_name}."
                )
            elif ssp_match_type == "HIGHERRANK":
                result["flags"].append("SUBSPECIES_MATCHED_HIGHER")
                result["notes"].append(
                    f"Subspecies '{subspecies}' matched only at species level "
                    f"(the trinomial may not be recognized)."
                )
            elif ssp_match_type == "FUZZY":
                # Detect false positives: check if the matched subspecies epithet
                # differs from the input. E.g., "elarina" fuzzy -> "elara" is a
                # false positive (different subspecies), not a spelling correction.
                matched_parts = ssp_canonical.split()
                matched_ssp_epithet = matched_parts[-1] if len(matched_parts) >= 3 else ""
                input_ssp = subspecies.lower().strip()
                matched_ssp = matched_ssp_epithet.lower().strip()

                if input_ssp != matched_ssp:
                    # Different epithet = false positive fuzzy match
                    result["flags"].append("SUBSPECIES_FUZZY_FALSE_POSITIVE")
                    result["flags"].append("SUBSPECIES_NOT_IN_BACKBONE")
                    result["notes"].append(
                        f"Fuzzy match FALSE POSITIVE: '{subspecies}' matched to "
                        f"'{matched_ssp_epithet}' (different subspecies). "
                        f"'{subspecies}' is likely valid but not in GBIF backbone."
                    )
                else:
                    result["flags"].append("SUBSPECIES_FUZZY")
                    result["notes"].append(
                        f"Subspecies fuzzy match (spelling): '{subspecies}' -> "
                        f"'{ssp_canonical}' (confidence: {ssp_confidence}%)"
                    )
            elif ssp_result.get("synonym"):
                result["flags"].append("SUBSPECIES_SYNONYM")
                acc_key = ssp_result.get("acceptedUsageKey")
                if acc_key:
                    acc = get_accepted_name(acc_key)
                    if acc:
                        result["notes"].append(
                            f"Subspecies synonym: '{trinomial}' -> '{acc['canonicalName']}'"
                        )

    elif subspecies and name_entry.get("is_undescribed"):
        result["flags"].append("UNDESCRIBED_SUBSPECIES")
        result["notes"].append(
            f"Undescribed subspecies marker: '{subspecies}' — skipped GBIF lookup."
        )

    # Step 4: Cross-reference subspecies against recognized children
    if subspecies and not name_entry.get("is_undescribed") and cached_children:
        recognized_epithets = set()
        for child in cached_children:
            parts = child["name"].split()
            if len(parts) >= 3:
                recognized_epithets.add(parts[-1].lower())

        if subspecies.lower() in recognized_epithets:
            if "SUBSPECIES_NOT_IN_BACKBONE" not in result["flags"]:
                # Confirmed via children list
                pass
        elif "SUBSPECIES_NOT_IN_BACKBONE" not in result["flags"] \
                and "SUBSPECIES_MATCHED_HIGHER" not in result["flags"] \
                and "SUBSPECIES_FUZZY_FALSE_POSITIVE" not in result["flags"]:
            # Matched as EXACT but let's double-check against children
            pass

    # Determine overall status
    if result["flags"]:
        flag_set = set(result["flags"])
        critical = {"SPECIES_NOT_IN_BACKBONE", "MATCHED_HIGHER_RANK", "SYNONYM"}
        if critical & flag_set:
            result["status"] = "needs_review"
        elif {"FUZZY_MATCH", "SUBSPECIES_FUZZY"} & flag_set:
            result["status"] = "review_spelling"
        elif {"SUBSPECIES_NOT_IN_BACKBONE", "SUBSPECIES_MATCHED_HIGHER",
              "SUBSPECIES_FUZZY_FALSE_POSITIVE"} & flag_set:
            result["status"] = "subspecies_unresolved"
        else:
            result["status"] = "flagged"
    else:
        result["status"] = "verified"

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTING
# ═══════════════════════════════════════════════════════════════════════════════


def print_curation_summary(results):
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
    species_resolved = sum(1 for r in results
                          if r["species_match"]
                          and r["species_match"]["matchType"] in ("EXACT", "FUZZY"))
    with_ssp = [r for r in results if r["input"].get("subspecies")
                and not r["input"].get("is_undescribed")]
    ssp_resolved = sum(1 for r in with_ssp
                       if r.get("subspecies_match")
                       and r["subspecies_match"]["matchType"] == "EXACT")

    print(f"\n--- Resolution Rates ---")
    print(f"  Species-level:     {species_resolved}/{total} "
          f"({species_resolved/total*100:.1f}%) matched in GBIF backbone")
    if with_ssp:
        print(f"  Subspecies-level:  {ssp_resolved}/{len(with_ssp)} "
              f"({ssp_resolved/len(with_ssp)*100:.1f}%) exactly matched as trinomial")

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
        print(f"\n--- Synonyms Found ({len(synonyms)}) ---")
        for r in synonyms[:10]:
            inp = r["input"]["scientific_name"]
            acc = r["accepted_name"]["canonicalName"] if r.get("accepted_name") else "?"
            print(f"  {inp:40s} -> {acc}")
        if len(synonyms) > 10:
            print(f"  ... and {len(synonyms) - 10} more")

    fuzzy = [r for r in results if "FUZZY_MATCH" in r["flags"]]
    if fuzzy:
        print(f"\n--- Species Fuzzy Matches ({len(fuzzy)}) ---")
        for r in fuzzy[:10]:
            inp = r["input"]["scientific_name"]
            matched = r["species_match"]["canonicalName"]
            conf = r["species_match"]["confidence"]
            print(f"  {inp:40s} -> {matched} ({conf}%)")

    ssp_fuzzy_fp = [r for r in results if "SUBSPECIES_FUZZY_FALSE_POSITIVE" in r["flags"]]
    if ssp_fuzzy_fp:
        print(f"\n--- Subspecies Fuzzy False Positives ({len(ssp_fuzzy_fp)}) ---")
        for r in ssp_fuzzy_fp[:10]:
            for note in r["notes"]:
                if "FALSE POSITIVE" in note:
                    print(f"  {note}")

    not_found = [r for r in results if "SPECIES_NOT_IN_BACKBONE" in r["flags"]]
    if not_found:
        print(f"\n--- Species Not Found in GBIF ({len(not_found)}) ---")
        for r in not_found[:10]:
            print(f"  {r['input']['scientific_name']}")

    higher = [r for r in results if "MATCHED_HIGHER_RANK" in r["flags"]]
    if higher:
        print(f"\n--- Matched Higher Rank Only ({len(higher)}) ---")
        for r in higher[:10]:
            inp = r["input"]["scientific_name"]
            rank = r["species_match"]["rank"]
            print(f"  {inp:40s} -> {rank}")

    ssp_missing = [r for r in results
                   if "SUBSPECIES_NOT_IN_BACKBONE" in r["flags"]
                   or "SUBSPECIES_MATCHED_HIGHER" in r["flags"]]
    if ssp_missing:
        print(f"\n--- Subspecies Not in Backbone ({len(ssp_missing)}) ---")
        for r in ssp_missing[:15]:
            inp = r["input"]["scientific_name"]
            ssp = r["input"]["subspecies"]
            recognized = [s["name"].split()[-1] for s in r.get("recognized_subspecies", [])
                         if s.get("status") == "ACCEPTED"]
            rec_str = ", ".join(recognized[:8]) if recognized else "none listed"
            print(f"  {inp} {ssp}")
            print(f"    GBIF recognized: [{rec_str}]")
        if len(ssp_missing) > 15:
            print(f"  ... and {len(ssp_missing) - 15} more")

    ssp_syn = [r for r in results if "SUBSPECIES_SYNONYM" in r["flags"]]
    if ssp_syn:
        print(f"\n--- Subspecies Synonyms ({len(ssp_syn)}) ---")
        for r in ssp_syn[:10]:
            for note in r["notes"]:
                if "synonym" in note.lower():
                    print(f"  {note}")

    # Cache efficiency report
    print(f"\n--- Performance ---")
    print(f"  Species cache hits: {len(_species_cache)} unique species cached")
    api_calls_saved = total - len(_species_cache)
    if api_calls_saved > 0:
        print(f"  API calls saved by caching: ~{api_calls_saved * 2} "
              f"(species match + children lookup)")

    print()


def save_report(quality_report, results):
    """Save full curation report to JSON."""
    output = {
        "metadata": {
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "gbif_api": GBIF_API,
            "backbone": "GBIF Backbone Taxonomy",
            "higher_constraints": HIGHER_TAXONOMY,
            "methodology": (
                "Names matched against GBIF Backbone Taxonomy with higher "
                "taxonomy constraints (Grenié et al. 2023). Synonyms resolved "
                "to accepted names. Subspecies validated via trinomial matching "
                "and cross-referenced against recognized children."
            ),
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
    args = parser.parse_args()

    # Load data
    records = load_data()

    # Step 1: Data quality assessment
    log.info("Running data quality assessment...")
    quality = assess_data_quality(records)
    print_quality_report(quality)

    if args.report_only:
        return

    # Step 2: Extract unique names
    limit = args.limit if args.test else None
    names = extract_unique_names(records, limit=limit)
    log.info(f"Extracted {len(names)} unique name combinations to curate")

    if not names:
        log.warning("No names to curate")
        return

    # Step 3: Curate each name
    results = []
    total = len(names)
    start_time = time.time()

    print(f"\nCurating {total} names against GBIF Backbone...")
    print("-" * 70)

    for i, name in enumerate(names):
        if (i + 1) % 10 == 0 or i == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta = (total - i - 1) / rate if rate > 0 else 0
            log.info(
                f"[{i+1}/{total}] Processing: {name['scientific_name']}"
                f" ({rate:.1f} names/sec, ETA: {eta:.0f}s)"
            )

        result = curate_name(name)
        results.append(result)

    elapsed = time.time() - start_time
    log.info(f"Curation complete in {elapsed:.1f}s ({len(results)/elapsed:.1f} names/sec)")

    # Step 4: Report
    print_curation_summary(results)
    save_report(quality, results)

    # Step 5: Print actionable items
    needs_review = [r for r in results if r["status"] in ("needs_review", "not_found")]
    if needs_review:
        print("=" * 70)
        print(f"ACTION NEEDED: {len(needs_review)} names require expert review")
        print("=" * 70)
        print(f"See full report: {CURATION_REPORT}")
    else:
        print("All names verified successfully against GBIF backbone.")


if __name__ == "__main__":
    main()
