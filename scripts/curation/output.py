"""
File writing: split-by-source JSON, image supplement, data manifest,
corrections log, and external output formats.
"""

import csv
import json
import math
import time
import logging
from collections import Counter
from pathlib import Path

from .config import (
    OUTPUT_DIR, SOURCE_DATA_FILES, IMAGE_SUPPLEMENT_FILE,
    CORRECTIONS_LOG_FILE, MANIFEST_FILE, PROJECT_ROOT,
)

log = logging.getLogger(__name__)


# ── Utilities ────────────────────────────────────────────────────────────────

def sanitize_for_json(records):
    """Replace float NaN with None so json.dump writes null (NaN is not valid JSON)."""
    for rec in records:
        for k, v in rec.items():
            if isinstance(v, float) and math.isnan(v):
                rec[k] = None
    return records


# ── App outputs (split by source) ────────────────────────────────────────────

def write_app_outputs(curated_records, corrections_log, records, stats,
                      correction_tables, sanger_species, merged_ssp_typos=None):
    """Write split-by-source outputs for the app's lazy-loading pipeline."""
    sanitize_for_json(curated_records)

    # Group records by source
    source_groups = {}
    for rec in curated_records:
        source = rec.get("source", "Unknown")
        source_groups.setdefault(source, []).append(rec)

    # Write each source as a separate minified JSON file
    for source, source_recs in source_groups.items():
        filename = SOURCE_DATA_FILES.get(source)
        if not filename:
            log.warning(f"Unknown source '{source}' ({len(source_recs)} records) - skipped")
            continue
        filepath = OUTPUT_DIR / filename
        with open(filepath, "w") as f:
            json.dump(source_recs, f, separators=(",", ":"), default=str)
        log.info(f"  {source}: {len(source_recs)} records -> {filepath.name}")

    # Generate image supplement
    _write_image_supplement(curated_records, source_groups)

    # Generate data manifest for the app
    _write_manifest(source_groups)

    # Remove legacy curated file if it exists
    legacy = OUTPUT_DIR / "map_points_curated.json"
    if legacy.exists():
        legacy.unlink()
        log.info(f"  Removed legacy file: {legacy.name}")

    # Write corrections log
    write_corrections_log(corrections_log, records, stats,
                          correction_tables, sanger_species,
                          merged_ssp_typos=merged_ssp_typos)

    print_correction_summary(records, corrections_log, stats, OUTPUT_DIR)


def _write_image_supplement(curated_records, source_groups):
    """
    Generate image supplement: non-Sanger records filling Sanger image gaps.
    iNaturalist images preferred over GBIF.
    """
    sanger_records = source_groups.get("Sanger Institute", [])

    sanger_has_image = set()
    sanger_species = set()
    sanger_ring_images = set()

    for rec in sanger_records:
        key = (rec.get("scientific_name", ""), rec.get("subspecies", ""))
        sanger_species.add(key)
        if rec.get("image_url"):
            sanger_has_image.add(key)
            ring = rec.get("mimicry_ring")
            if ring and ring != "Unknown":
                sanger_ring_images.add(ring)

    species_needing_images = sanger_species - sanger_has_image
    all_rings = {rec.get("mimicry_ring") for rec in curated_records
                 if rec.get("mimicry_ring") and rec["mimicry_ring"] != "Unknown"}
    rings_needing_images = all_rings - sanger_ring_images

    # One representative per gap, preferring iNaturalist
    non_sanger_with_img = [
        r for r in curated_records
        if r.get("source") != "Sanger Institute" and r.get("image_url")
    ]
    non_sanger_with_img.sort(key=lambda r: (0 if r.get("source") == "iNaturalist" else 1))

    supplement = []
    filled_species = set()
    filled_rings = set()

    for rec in non_sanger_with_img:
        key = (rec.get("scientific_name", ""), rec.get("subspecies", ""))
        ring = rec.get("mimicry_ring", "")
        need_species = key in species_needing_images and key not in filled_species
        need_ring = ring in rings_needing_images and ring not in filled_rings
        if need_species or need_ring:
            supplement.append(rec)
            if need_species:
                filled_species.add(key)
            if need_ring:
                filled_rings.add(ring)

    with open(IMAGE_SUPPLEMENT_FILE, "w") as f:
        json.dump(supplement, f, separators=(",", ":"), default=str)
    log.info(f"  Image supplement: {len(supplement)} records -> "
             f"{IMAGE_SUPPLEMENT_FILE.name} "
             f"(species gaps: {len(filled_species)}, ring gaps: {len(filled_rings)})")


def _write_manifest(source_groups):
    """Write data_manifest.json so the app knows available sources and files."""
    sources = {}
    for source_name, filename in SOURCE_DATA_FILES.items():
        recs = source_groups.get(source_name, [])
        sources[source_name] = {
            "file": filename,
            "records": len(recs),
            "default": source_name == "Sanger Institute",
        }
    manifest = {
        "sources": sources,
        "image_supplement": IMAGE_SUPPLEMENT_FILE.name,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with open(MANIFEST_FILE, "w") as f:
        json.dump(manifest, f, indent=2)
    log.info(f"  Manifest: {MANIFEST_FILE.name}")


def write_corrections_log(corrections_log, records, stats,
                          correction_tables, sanger_species,
                          log_file=None, merged_ssp_typos=None):
    """Write corrections log JSON."""
    out_path = log_file or CORRECTIONS_LOG_FILE
    ssp_typos = merged_ssp_typos or correction_tables.get("ssp_typos", {})
    summary = {
        "applied_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "total_records": len(records),
        "stats": dict(stats),
        "total_corrections": len(corrections_log),
        "corrections": corrections_log,
        "correction_tables": {
            "spelling_corrections": correction_tables.get("spelling", {}),
            "dataset_correct_over_gbif": {
                k: v[1] for k, v in correction_tables.get("overrides", {}).items()
            },
            "subspecies_as_species": {
                k: f"{v[0]} {v[1]}" for k, v in correction_tables.get("subspecies_remap", {}).items()
            },
            "valid_species_not_in_gbif_count": len(correction_tables.get("valid_not_in_gbif", set())),
            "subspecies_typos": {
                f"{k[0]} {k[1]}": v[0] for k, v in ssp_typos.items()
            },
            "subspecies_typos_manual_count": len(correction_tables.get("ssp_typos", {})),
            "subspecies_typos_total_count": len(ssp_typos),
            "sanger_taxonomy_species_count": len(sanger_species),
        },
    }
    with open(out_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    log.info(f"Corrections log written to {out_path}")


def print_correction_summary(records, corrections_log, stats, output_path):
    """Print correction summary to console."""
    print(f"\n{'=' * 70}")
    print("CORRECTIONS APPLIED")
    print(f"{'=' * 70}")
    print(f"Total records:        {len(records):,}")
    print(f"Records corrected:    {stats.get('corrected', 0):,}")
    print(f"Total corrections:    {len(corrections_log)}")
    print(f"\nCorrection breakdown:")
    for ctype, count in Counter(c["type"] for c in corrections_log).most_common():
        print(f"  {ctype:35s}  {count:,}")
    print(f"\nOutput: {output_path}")


# ── External file output (CSV, Excel, etc.) ──────────────────────────────────

def write_external_output(curated_records, corrections_log, records,
                          stats, input_path, output_file, preset,
                          correction_tables, sanger_species,
                          merged_ssp_typos=None):
    """Write curated output for external files (CSV, TSV, Excel)."""
    input_path = Path(input_path)
    ext = input_path.suffix.lower()

    if output_file:
        out_path = Path(output_file)
        if not out_path.is_absolute():
            out_path = PROJECT_ROOT / out_path
    else:
        out_path = input_path.parent / f"{input_path.stem}_curated{ext}"

    out_records = []
    for rec in curated_records:
        out = dict(rec)
        out.setdefault("curation_status", "not_curated")
        out.setdefault("scientific_name_original", None)
        out.setdefault("curated_name", out.get("scientific_name", ""))
        out.pop("literature_action", None)
        out_records.append(out)

    if ext == ".json":
        with open(out_path, "w") as f:
            json.dump(out_records, f, indent=2, default=str)
    elif ext in (".csv", ".tsv"):
        if out_records:
            delimiter = "\t" if ext == ".tsv" else ","
            with open(out_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=list(out_records[0].keys()),
                                        delimiter=delimiter)
                writer.writeheader()
                writer.writerows(out_records)
    elif ext in (".xlsx", ".xls"):
        try:
            import pandas as pd
        except ImportError:
            log.error("pandas and openpyxl required for Excel. Falling back to CSV.")
            csv_path = out_path.with_suffix(".csv")
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=list(out_records[0].keys()))
                writer.writeheader()
                writer.writerows(out_records)
            out_path = csv_path
        else:
            pd.DataFrame(out_records).to_excel(out_path, index=False)

    log.info(f"Curated dataset written to {out_path}")

    log_path = out_path.parent / f"{out_path.stem}_corrections.json"
    write_corrections_log(corrections_log, records, stats,
                          correction_tables, sanger_species,
                          log_path, merged_ssp_typos)

    print_correction_summary(records, corrections_log, stats, out_path)
