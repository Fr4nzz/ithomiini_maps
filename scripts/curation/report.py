"""
Data quality assessment, curation summary printing, and JSON report generation.
"""

import json
import time
import logging
from collections import Counter

from .config import CURATION_REPORT, PLACEHOLDER_GENERA, PLACEHOLDER_SPECIES, UNDESCRIBED_PATTERNS, HIGHER_TAXONOMY, GBIF_API

log = logging.getLogger(__name__)


# ── Data quality ─────────────────────────────────────────────────────────────

def assess_data_quality(records):
    """Generate a data quality report identifying issues before curation."""
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

    subspecies_variants = {}

    for rec in records:
        genus = rec.get("genus", "")
        species = rec.get("species", "")
        subspecies = rec.get("subspecies")
        sci_name = rec.get("scientific_name", "")

        report["unique_genera"].add(genus)
        report["unique_species"].add(sci_name)
        report["unique_scientific_names"].add(sci_name)
        if subspecies:
            report["unique_subspecies"].add(subspecies)

        if genus in PLACEHOLDER_GENERA:
            report["issues"]["placeholder_genera"][genus] += 1
        if species in PLACEHOLDER_SPECIES:
            report["issues"]["placeholder_species"][species] += 1
        if rec.get("family") == "NOT_FOUND" or rec.get("tribe") == "NOT_FOUND":
            report["issues"]["not_found_taxonomy"] += 1

        if not subspecies or subspecies in ("None", "NA", "NaN", ""):
            report["issues"]["missing_subspecies"] += 1
        elif UNDESCRIBED_PATTERNS.match(subspecies):
            report["issues"]["undescribed_subspecies"][subspecies] += 1
        else:
            if "?" in subspecies:
                report["issues"]["question_marks"][subspecies] += 1
            if subspecies.startswith("f.") or subspecies.startswith("f "):
                report["issues"]["form_names"][subspecies] += 1
            if "/" in subspecies:
                report["issues"]["slash_alternatives"][subspecies] += 1

        parts = sci_name.split()
        if len(parts) < 2 and genus not in PLACEHOLDER_GENERA:
            if sci_name not in report["issues"]["malformed_names"]:
                report["issues"]["malformed_names"].append(sci_name)

        if subspecies:
            key = subspecies.lower()
            subspecies_variants.setdefault(key, set()).add(subspecies)

    for key, variants in subspecies_variants.items():
        if len(variants) > 1:
            report["issues"]["casing_issues"].append(sorted(variants))

    # Convert sets to counts for serialization
    for k in ("unique_genera", "unique_species", "unique_subspecies", "unique_scientific_names"):
        report[k] = len(report[k])

    return report


def print_quality_report(report):
    """Print formatted data quality report."""
    print("\n" + "=" * 70)
    print("DATA QUALITY ASSESSMENT")
    print("=" * 70)
    print(f"Total records:           {report['total_records']:,}")
    print(f"Unique genera:           {report['unique_genera']}")
    print(f"Unique scientific names:  {report['unique_scientific_names']}")
    print(f"Unique subspecies:        {report['unique_subspecies']}")

    issues = report["issues"]
    print(f"\n--- Issues ---")

    _print_counter("Placeholder genera", issues["placeholder_genera"])
    _print_counter("Placeholder species", issues["placeholder_species"])
    print(f"Missing subspecies:       {issues['missing_subspecies']:,}")
    print(f"NOT_FOUND taxonomy:       {issues['not_found_taxonomy']}")

    undesc = issues["undescribed_subspecies"]
    print(f"Undescribed subspecies:   {sum(undesc.values()):,} records, {len(undesc)} patterns")
    for p, c in undesc.most_common(5):
        print(f"  '{p}': {c:,}")
    if len(undesc) > 5:
        print(f"  ... and {len(undesc) - 5} more patterns")

    _print_counter_if("Question marks", issues["question_marks"], 3)
    _print_counter_if("Form names (f. xxx)", issues["form_names"], 3)
    _print_counter_if("Slash alternatives", issues["slash_alternatives"], 3)

    if issues["malformed_names"]:
        print(f"Malformed names:          {len(issues['malformed_names'])}")
        for n in issues["malformed_names"][:5]:
            print(f"  '{n}'")

    if issues["casing_issues"]:
        print(f"Casing inconsistencies:   {len(issues['casing_issues'])}")
        for variants in issues["casing_issues"][:5]:
            print(f"  {variants}")
    print()


def _print_counter(label, counter, limit=None):
    """Print a Counter with label."""
    total = sum(counter.values())
    print(f"{label + ':':26s} {total:,}")
    for item, count in counter.most_common(limit):
        print(f"  {item}: {count:,}")


def _print_counter_if(label, counter, limit=3):
    """Print a Counter only if non-empty."""
    if counter:
        total = sum(counter.values())
        print(f"{label + ':':26s} {total:,} records, {len(counter)} patterns")
        for p, c in counter.most_common(limit):
            print(f"  '{p}': {c:,}")


# ── Curation summary ────────────────────────────────────────────────────────

# Data-driven summary sections: (title, filter_fn, format_fn, max_items)
_SUMMARY_SECTIONS = [
    ("Species Synonyms Found", lambda r: "SYNONYM" in r["flags"],
     lambda r: f"  {r['input']['scientific_name']:40s} -> "
               f"{r.get('accepted_name', {}).get('canonicalName', '?')}", 15),

    ("Species Fuzzy Matches (Rejected)", lambda r: "FUZZY_MATCH_REJECTED" in r["flags"],
     lambda r: "  " + next((n for n in r["notes"] if "REJECTED" in n), ""), 15),

    ("Subspecies Fuzzy False Positives", lambda r: "SUBSPECIES_FUZZY_FALSE_POSITIVE" in r["flags"],
     lambda r: "  " + next((n for n in r["notes"] if "FALSE POSITIVE" in n), ""), 10),

    ("Species Not Found in GBIF", lambda r: "SPECIES_NOT_IN_BACKBONE" in r["flags"],
     lambda r: f"  {r['input']['scientific_name']}", None),

    ("Matched Higher Rank Only",
     lambda r: "MATCHED_HIGHER_RANK" in r["flags"] and r["status"] != "verified_literature",
     lambda r: f"  {r['input']['scientific_name']:40s} -> "
               f"{r['species_match']['rank'] if r['species_match'] else '?'}", 15),
]


def print_curation_summary(results, cache, api_call_count=0):
    """Print a summary of curation results."""
    print("\n" + "=" * 70)
    print("CURATION RESULTS SUMMARY")
    print("=" * 70)

    total = len(results)
    statuses = Counter(r["status"] for r in results)
    print(f"\nTotal names curated: {total}")
    print(f"\nStatus breakdown:")
    for status, count in statuses.most_common():
        print(f"  {status:30s}  {count:4d}  ({count/total*100:5.1f}%)")

    # Resolution rates
    species_resolved = sum(
        1 for r in results
        if r.get("species_match") and r["species_match"]["matchType"] == "EXACT"
    )
    with_ssp = [r for r in results if r["input"].get("ssp_category") == "standard"]
    ssp_resolved = sum(
        1 for r in with_ssp
        if r.get("subspecies_match") and r["subspecies_match"]["matchType"] == "EXACT"
    )
    print(f"\n--- Resolution Rates ---")
    print(f"  Species-level:     {species_resolved}/{total} ({species_resolved/total*100:.1f}%)")
    if with_ssp:
        print(f"  Subspecies-level:  {ssp_resolved}/{len(with_ssp)} ({ssp_resolved/len(with_ssp)*100:.1f}%)")

    # Subspecies categories
    ssp_cats = Counter(r["input"]["ssp_category"] for r in results)
    print(f"\n--- Subspecies Categories ---")
    for cat, count in ssp_cats.most_common():
        print(f"  {cat:25s}  {count:4d}  ({count/total*100:5.1f}%)")

    # Curation basis breakdown
    basis_counts = Counter(r.get("curation_basis") or "Unresolved" for r in results)
    print(f"\n--- Curation Basis ---")
    for basis, count in basis_counts.most_common():
        print(f"  {basis:25s}  {count:4d}  ({count/total*100:5.1f}%)")

    # All flags
    all_flags = Counter(f for r in results for f in r["flags"])
    if all_flags:
        print(f"\nAll flags:")
        for flag, count in all_flags.most_common():
            print(f"  {flag:40s}  {count:4d}")

    # Data-driven sections
    for title, filter_fn, format_fn, max_items in _SUMMARY_SECTIONS:
        matches = [r for r in results if filter_fn(r)]
        if matches:
            print(f"\n--- {title} ({len(matches)}) ---")
            for r in matches[:max_items]:
                print(format_fn(r))
            if max_items and len(matches) > max_items:
                print(f"  ... and {len(matches) - max_items} more")

    # Literature verified/corrected
    lit_verified = [r for r in results if r["status"] == "verified_literature"]
    if lit_verified:
        print(f"\n--- Literature-Verified ({len(lit_verified)}) ---")
        overrides = [r for r in lit_verified if "GBIF_FUZZY_OVERRIDDEN" in r["flags"]]
        if overrides:
            print(f"  GBIF fuzzy suggestions rejected: {len(overrides)}")
            for r in overrides[:5]:
                print(f"    {r['input']['scientific_name']:35s} "
                      f"(rejected: {r['species_match'].get('gbif_suggestion_rejected', '?')})")

    lit_corrected = [r for r in results if r["status"] == "corrected_literature"]
    if lit_corrected:
        print(f"\n--- Literature Corrections Applied ({len(lit_corrected)}) ---")
        for r in lit_corrected[:10]:
            print(f"  {r['input']['scientific_name']:35s} -> {r.get('curated_name', '?')}")

    # Subspecies not in backbone
    ssp_missing = [r for r in results
                   if {"SUBSPECIES_NOT_IN_BACKBONE", "SUBSPECIES_MATCHED_HIGHER"} & set(r["flags"])]
    if ssp_missing:
        print(f"\n--- Subspecies Not in Backbone ({len(ssp_missing)}) ---")
        for r in ssp_missing[:20]:
            recognized = [s["name"].split()[-1] for s in r.get("recognized_subspecies", [])
                         if s.get("status") == "ACCEPTED" and len(s["name"].split()) >= 3]
            print(f"  {r['input']['scientific_name']} {r['input']['subspecies']}")
            print(f"    GBIF recognized: [{', '.join(recognized[:8]) or 'none listed'}]")
        if len(ssp_missing) > 20:
            print(f"  ... and {len(ssp_missing) - 20} more")

    # Subspecies synonyms
    ssp_syn = [r for r in results if "SUBSPECIES_SYNONYM" in r["flags"]]
    if ssp_syn:
        print(f"\n--- Subspecies Synonyms ({len(ssp_syn)}) ---")
        for r in ssp_syn[:15]:
            for note in r["notes"]:
                if "synonym" in note.lower():
                    print(f"  {note}")

    # Synonym epithet -> subspecies inferences
    epithet_inferred = [r for r in results if "SYNONYM_EPITHET_AS_SUBSPECIES" in r["flags"]]
    if epithet_inferred:
        print(f"\n--- Synonym Epithet → Subspecies (confirmed: {len(epithet_inferred)}) ---")
        for r in epithet_inferred[:15]:
            orig = r["input"]["scientific_name"]
            accepted = r.get("accepted_name", {}).get("canonicalName", "?")
            print(f"  {orig:40s} -> {accepted}")
        if len(epithet_inferred) > 15:
            print(f"  ... and {len(epithet_inferred) - 15} more")

    epithet_unconfirmed = [r for r in results if "SYNONYM_EPITHET_UNCONFIRMED" in r["flags"]]
    if epithet_unconfirmed:
        print(f"\n--- Synonym Epithet → Subspecies (unconfirmed: {len(epithet_unconfirmed)}) ---")
        print(f"  These species synonyms may need a subspecies designation.")
        print(f"  Add to corrections file if appropriate:")
        for r in epithet_unconfirmed[:20]:
            orig = r["input"]["scientific_name"]
            accepted = r.get("accepted_name", {}).get("canonicalName", "?")
            orig_epithet = orig.split()[1] if len(orig.split()) >= 2 else "?"
            print(f"  {orig:40s} -> {accepted} {orig_epithet}  ?")
        if len(epithet_unconfirmed) > 20:
            print(f"  ... and {len(epithet_unconfirmed) - 20} more")

    # Nominotypical
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
    print(f"  Cache: {len(cache.get('species', {}))} species, "
          f"{len(cache.get('subspecies', {}))} subspecies, "
          f"{len(cache.get('synonyms', {}))} synonyms")
    print(f"  API fallback calls: {api_call_count}")
    cache_resolved = total - api_call_count
    print(f"  Cache-resolved: {cache_resolved}/{total} ({cache_resolved/total*100:.1f}%)")
    print()


# ── JSON report ──────────────────────────────────────────────────────────────

def save_report(quality_report, results, cache, api_call_count=0):
    """Save full curation report to JSON."""
    output = {
        "metadata": {
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "gbif_api": GBIF_API,
            "backbone": "GBIF Backbone Taxonomy",
            "higher_constraints": HIGHER_TAXONOMY,
            "cache_stats": cache.get("metadata", {}),
            "api_fallback_calls": api_call_count,
        },
        "quality_assessment": {k: v for k, v in quality_report.items() if k != "issues"},
        "quality_issues": {
            k: (dict(v) if isinstance(v, Counter) else v)
            for k, v in quality_report["issues"].items()
        },
        "curation_summary": {
            "total_curated": len(results),
            "statuses": dict(Counter(r["status"] for r in results)),
            "flags": dict(Counter(f for r in results for f in r["flags"])),
            "subspecies_categories": dict(Counter(r["input"]["ssp_category"] for r in results)),
        },
        "results": results,
    }
    with open(CURATION_REPORT, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, default=str)
    log.info(f"Report saved to {CURATION_REPORT}")
