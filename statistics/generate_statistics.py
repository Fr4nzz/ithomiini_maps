#!/usr/bin/env python3
"""
Paper Statistics Generator
===========================
Extracts all statistics needed for the manuscript results section
and supplementary tables from the processed data files.

Output: statistics/statistics_report.txt  (human-readable)
        statistics/statistics.json        (machine-readable for filling in manuscript)
"""

import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
from country_utils import standardize_country
DATA_DIR = PROJECT_ROOT / "public" / "data"
OUTPUT_DIR = Path(__file__).parent

MANIFEST_FILE = DATA_DIR / "data_manifest.json"
GBIF_CITATION_FILE = DATA_DIR / "gbif_citation.json"
TAXONOMY_CACHE_FILE = DATA_DIR / "gbif_taxonomy_cache.json"


def load_json(filepath):
    """Load a JSON file."""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def safe_set_add(s, val):
    """Add a value to a set if it's truthy and not a placeholder."""
    if val and str(val).strip() not in ("", "None", "nan", "NA", "NaN", "Unknown", "NOT_FOUND"):
        s.add(str(val).strip())


def compute_source_stats(records, source_name):
    """Compute stats for a list of records from one source."""
    genera = set()
    species = set()
    subspecies = set()
    scientific_names = set()
    countries = set()
    mimicry_rings = set()
    sequencing_statuses = Counter()
    curation_bases = Counter()
    curation_statuses = Counter()
    with_images = 0
    with_coords = 0
    with_date = 0
    basis_of_record = Counter()

    for rec in records:
        safe_set_add(genera, rec.get("genus"))
        sci = rec.get("scientific_name", "")
        safe_set_add(scientific_names, sci)
        safe_set_add(species, rec.get("species"))
        safe_set_add(subspecies, rec.get("subspecies"))
        safe_set_add(countries, rec.get("country"))
        safe_set_add(mimicry_rings, rec.get("mimicry_ring"))

        seq = rec.get("sequencing_status", "")
        if seq:
            sequencing_statuses[seq] += 1

        cb = rec.get("curation_basis", "")
        if cb:
            curation_bases[cb] += 1

        cs = rec.get("curation_status", "")
        if cs:
            curation_statuses[cs] += 1

        if rec.get("image_url"):
            with_images += 1
        if rec.get("lat") and rec.get("lng"):
            with_coords += 1
        if rec.get("observation_date"):
            with_date += 1

        bor = rec.get("basis_of_record", "")
        if bor:
            basis_of_record[bor] += 1

    return {
        "source": source_name,
        "total_records": len(records),
        "unique_genera": len(genera),
        "unique_species": len(species),
        "unique_subspecies": len(subspecies),
        "unique_scientific_names": len(scientific_names),
        "unique_countries": len(countries),
        "unique_mimicry_rings": len(mimicry_rings),
        "records_with_images": with_images,
        "records_with_coords": with_coords,
        "records_with_date": with_date,
        "genera_list": sorted(genera),
        "mimicry_rings_list": sorted(mimicry_rings),
        "countries_list": sorted(countries),
        "sequencing_statuses": dict(sequencing_statuses.most_common()),
        "curation_bases": dict(curation_bases.most_common()),
        "curation_statuses": dict(curation_statuses.most_common()),
        "basis_of_record": dict(basis_of_record.most_common()),
    }


def compute_merged_stats(all_records):
    """Compute stats across all sources combined."""
    genera = set()
    species = set()
    subspecies = set()
    scientific_names = set()
    countries = set()
    mimicry_rings = set()

    for rec in all_records:
        safe_set_add(genera, rec.get("genus"))
        safe_set_add(scientific_names, rec.get("scientific_name"))
        safe_set_add(species, rec.get("species"))
        safe_set_add(subspecies, rec.get("subspecies"))
        safe_set_add(countries, rec.get("country"))
        safe_set_add(mimicry_rings, rec.get("mimicry_ring"))

    return {
        "total_records": len(all_records),
        "unique_genera": len(genera),
        "unique_species": len(species),
        "unique_subspecies": len(subspecies),
        "unique_scientific_names": len(scientific_names),
        "unique_countries": len(countries),
        "unique_mimicry_rings": len(mimicry_rings),
        "genera_list": sorted(genera),
        "mimicry_rings_list": sorted(mimicry_rings),
        "countries_list": sorted(countries),
    }


def compute_mimicry_ring_table(all_records):
    """Build Table S1: mimicry ring breakdown with representative species and counts per source."""
    ring_data = defaultdict(lambda: {
        "total": 0,
        "species": set(),
        "subspecies": set(),
        "by_source": Counter(),
    })

    for rec in all_records:
        ring = rec.get("mimicry_ring", "")
        if not ring or ring in ("Unknown", "nan", "None", ""):
            continue
        ring_data[ring]["total"] += 1
        sci = rec.get("scientific_name", "")
        if sci:
            ring_data[ring]["species"].add(sci)
        ssp = rec.get("subspecies", "")
        if ssp and ssp not in ("None", "nan", ""):
            full = f"{sci} {ssp}" if sci else ssp
            ring_data[ring]["subspecies"].add(full)
        src = rec.get("source", "")
        if src:
            ring_data[ring]["by_source"][src] += 1

    table = []
    for ring_name in sorted(ring_data.keys()):
        rd = ring_data[ring_name]
        # Pick up to 3 representative species (sorted alphabetically)
        representatives = sorted(rd["species"])[:3]
        table.append({
            "mimicry_ring": ring_name,
            "total_records": rd["total"],
            "unique_species": len(rd["species"]),
            "unique_subspecies": len(rd["subspecies"]),
            "representative_species": representatives,
            "records_by_source": dict(rd["by_source"].most_common()),
        })

    return table


def compute_curation_stats(all_records):
    """Build Table S2: curation pipeline statistics."""
    bases = Counter()
    statuses = Counter()

    for rec in all_records:
        cb = rec.get("curation_basis", "")
        if cb:
            bases[cb] += 1
        cs = rec.get("curation_status", "")
        if cs:
            statuses[cs] += 1

    total = len(all_records)
    return {
        "total_records": total,
        "curation_basis_breakdown": {
            k: {"count": v, "percentage": round(v / total * 100, 1)}
            for k, v in bases.most_common()
        },
        "curation_status_breakdown": {
            k: {"count": v, "percentage": round(v / total * 100, 1)}
            for k, v in statuses.most_common()
        },
    }


def compute_file_sizes():
    """Compute data file sizes for data efficiency section."""
    sizes = {}
    for f in DATA_DIR.glob("map_points_*.json"):
        sizes[f.name] = os.path.getsize(f)

    # Also check built JS/CSS
    dist_dir = PROJECT_ROOT / "dist"
    js_total = 0
    css_total = 0
    if dist_dir.exists():
        for f in dist_dir.rglob("*.js"):
            js_total += os.path.getsize(f)
        for f in dist_dir.rglob("*.css"):
            css_total += os.path.getsize(f)

    total_data = sum(sizes.values())
    return {
        "data_files": {k: {"bytes": v, "mb": round(v / 1024 / 1024, 2)} for k, v in sorted(sizes.items())},
        "total_data_bytes": total_data,
        "total_data_mb": round(total_data / 1024 / 1024, 2),
        "js_total_bytes": js_total,
        "css_total_bytes": css_total,
        "app_total_kb": round((js_total + css_total) / 1024, 1) if js_total else "N/A (run npm build first)",
    }


def format_report(source_stats, merged_stats, mimicry_table, curation_stats,
                  file_sizes, gbif_citation, generated_at=None):
    """Format a human-readable report."""
    lines = []
    lines.append("=" * 80)
    lines.append("PAPER STATISTICS REPORT")
    lines.append("=" * 80)
    if generated_at:
        lines.append(f"Statistics calculated from app data generated at: {generated_at}")

    # ── Data Summary Table (for Results 3.1) ──
    lines.append("\n\n## TABLE 1: Data Summary by Source")
    if generated_at:
        lines.append(f"Data snapshot: {generated_at}")
    lines.append("-" * 80)
    lines.append(f"{'Source':<30} {'Records':>8} {'Species':>8} {'Subspecies':>10} {'Genera':>8} {'Countries':>10}")
    lines.append("-" * 80)
    for s in source_stats:
        lines.append(f"{s['source']:<30} {s['total_records']:>8,} {s['unique_species']:>8} {s['unique_subspecies']:>10} {s['unique_genera']:>8} {s['unique_countries']:>10}")
    lines.append("-" * 80)
    lines.append(f"{'TOTAL (merged, all sources)':<30} {merged_stats['total_records']:>8,} {merged_stats['unique_species']:>8} {merged_stats['unique_subspecies']:>10} {merged_stats['unique_genera']:>8} {merged_stats['unique_countries']:>10}")
    lines.append("")

    # ── Sequencing status (Sanger only) ──
    sanger = next((s for s in source_stats if s["source"] == "Sanger Institute"), None)
    if sanger:
        lines.append("\n## Sanger Institute Sequencing Status Breakdown")
        if generated_at:
            lines.append(f"Data snapshot: {generated_at}")
        lines.append("-" * 50)
        for status, count in sanger["sequencing_statuses"].items():
            pct = count / sanger["total_records"] * 100
            lines.append(f"  {status:<25} {count:>6,} ({pct:.1f}%)")

    # ── GBIF basis of record ──
    lines.append("\n## GBIF Basis of Record (all GBIF sub-sources combined)")
    lines.append("-" * 50)
    combined_bor = Counter()
    for s in source_stats:
        if "GBIF" in s["source"] or "iNaturalist" in s["source"]:
            for k, v in s["basis_of_record"].items():
                combined_bor[k] += v
    total_gbif = sum(combined_bor.values())
    for bor, count in combined_bor.most_common():
        pct = count / total_gbif * 100 if total_gbif else 0
        lines.append(f"  {bor:<30} {count:>8,} ({pct:.1f}%)")

    # ── Curation Stats (Table S2) ──
    lines.append("\n\n## TABLE S2: Taxonomic Curation Pipeline Statistics")
    if generated_at:
        lines.append(f"Data snapshot: {generated_at}")
    lines.append("-" * 60)
    lines.append(f"Total records curated: {curation_stats['total_records']:,}")
    lines.append("\nCuration basis breakdown:")
    for basis, info in curation_stats["curation_basis_breakdown"].items():
        lines.append(f"  {basis:<30} {info['count']:>8,} ({info['percentage']}%)")
    lines.append("\nCuration status breakdown:")
    for status, info in curation_stats["curation_status_breakdown"].items():
        lines.append(f"  {status:<30} {info['count']:>8,} ({info['percentage']}%)")

    # ── Mimicry Rings (Table S1) ──
    lines.append("\n\n## TABLE S1: Mimicry Rings")
    lines.append("-" * 100)
    lines.append(f"{'Ring':<20} {'Records':>8} {'Species':>8} {'Subspecies':>10}  Representative Species")
    lines.append("-" * 100)
    for row in mimicry_table:
        reps = ", ".join(row["representative_species"][:3])
        lines.append(f"{row['mimicry_ring']:<20} {row['total_records']:>8,} {row['unique_species']:>8} {row['unique_subspecies']:>10}  {reps}")
    lines.append(f"\nTotal mimicry rings: {len(mimicry_table)}")

    # ── File Sizes ──
    lines.append("\n\n## Data File Sizes (for data efficiency section)")
    lines.append("-" * 60)
    for fname, info in file_sizes["data_files"].items():
        lines.append(f"  {fname:<40} {info['mb']:>8.2f} MB")
    lines.append(f"  {'TOTAL DATA':<40} {file_sizes['total_data_mb']:>8.2f} MB")
    lines.append(f"  App bundle (JS + CSS):  {file_sizes['app_total_kb']}")

    # ── GBIF Citation ──
    if gbif_citation:
        lines.append("\n\n## GBIF Download Citation")
        lines.append("-" * 60)
        lines.append(f"  DOI: {gbif_citation.get('doi', 'N/A')}")
        lines.append(f"  Download date: {gbif_citation.get('download_date', 'N/A')}")
        lines.append(f"  Total records downloaded: {gbif_citation.get('total_records', 'N/A'):,}")
        lines.append(f"  Filters: {gbif_citation.get('filters_applied', 'N/A')}")

    # ── Geographic coverage ──
    lines.append("\n\n## Geographic Coverage (all sources merged)")
    lines.append("-" * 60)
    lines.append(f"Countries represented: {merged_stats['unique_countries']}")
    for c in merged_stats["countries_list"]:
        lines.append(f"  - {c}")

    return "\n".join(lines)


def main():
    print("Loading data manifest...")
    manifest = load_json(MANIFEST_FILE)
    generated_at = manifest.get("generated_at")

    # Load all source files
    all_records = []
    source_stats = []

    for source_name, source_info in manifest["sources"].items():
        filepath = DATA_DIR / source_info["file"]
        if not filepath.exists():
            print(f"  WARNING: {filepath} not found, skipping {source_name}")
            continue

        print(f"  Loading {source_name} from {source_info['file']}...")
        records = load_json(filepath)
        print(f"    -> {len(records):,} records")

        # Standardize country names before computing stats
        for rec in records:
            rec['country'] = standardize_country(rec.get('country', ''))

        stats = compute_source_stats(records, source_name)
        source_stats.append(stats)
        all_records.extend(records)

    print(f"\nTotal records across all sources: {len(all_records):,}")

    # Merged stats
    print("Computing merged statistics...")
    merged_stats = compute_merged_stats(all_records)

    # Mimicry ring table
    print("Building mimicry ring table (Table S1)...")
    mimicry_table = compute_mimicry_ring_table(all_records)

    # Curation stats
    print("Computing curation statistics (Table S2)...")
    curation_stats = compute_curation_stats(all_records)

    # File sizes
    print("Computing file sizes...")
    file_sizes = compute_file_sizes()

    # GBIF citation
    gbif_citation = None
    if GBIF_CITATION_FILE.exists():
        gbif_citation = load_json(GBIF_CITATION_FILE)

    # Generate report
    print("\nGenerating report...")
    report = format_report(
        source_stats, merged_stats, mimicry_table, curation_stats,
        file_sizes, gbif_citation, generated_at=generated_at
    )

    # Write human-readable report
    report_path = OUTPUT_DIR / "statistics_report.txt"
    with open(report_path, "w") as f:
        f.write(report)
    print(f"\nHuman-readable report: {report_path}")

    # Write machine-readable JSON
    json_output = {
        "data_snapshot_generated_at": generated_at,
        "source_stats": source_stats,
        "merged_stats": merged_stats,
        "mimicry_ring_table": mimicry_table,
        "curation_stats": curation_stats,
        "file_sizes": file_sizes,
        "gbif_citation": gbif_citation,
    }
    # Convert sets to lists for JSON serialization
    json_path = OUTPUT_DIR / "statistics.json"
    with open(json_path, "w") as f:
        json.dump(json_output, f, indent=2, default=str)
    print(f"Machine-readable JSON:  {json_path}")

    # Print report to stdout too
    print("\n" + report)


if __name__ == "__main__":
    main()
