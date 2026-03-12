"""
Apply curation corrections to dataset records.
"""

import csv
import json
import sys
import logging
from pathlib import Path
from collections import Counter

from .config import (
    DATA_FILE, PROJECT_ROOT, COLUMN_PRESETS,
)
from .corrections import detect_subspecies_typos
from .output import (
    sanitize_for_json, write_app_outputs, write_external_output,
)

log = logging.getLogger(__name__)


# ── Column mapping ───────────────────────────────────────────────────────────

def detect_column_preset(columns):
    """Auto-detect column mapping from available column names."""
    col_set = set(columns)
    if "Genus" in col_set and "Species" in col_set and "Sub.species" in col_set:
        return "dore_excel"
    if "scientific_name" in col_set:
        return "map_points"
    if "genus" in col_set and "species" in col_set:
        return "csv_standard"
    return None


def normalize_record(row, preset_name):
    """Normalize a record from any supported format into internal format."""
    preset = COLUMN_PRESETS[preset_name]
    col_for = {v: k for k, v in preset.items()}  # reverse: internal -> source column

    out = dict(row)  # pass through all columns

    genus = str(row.get(col_for.get("genus", "genus"), "")).strip()
    species_epithet = str(row.get(col_for.get("species", "species"), "")).strip()

    ssp_col = col_for.get("subspecies")
    ssp_raw = row.get(ssp_col, "") if ssp_col else ""
    subspecies = str(ssp_raw).strip() if ssp_raw and str(ssp_raw).strip() not in ("nan", "None", "NA", "") else None

    sci_col = col_for.get("scientific_name")
    if sci_col and sci_col in row and row[sci_col]:
        scientific_name = str(row[sci_col]).strip()
    else:
        scientific_name = f"{genus} {species_epithet}".strip()

    out["scientific_name"] = scientific_name
    out["genus"] = genus
    out["species"] = species_epithet
    out["subspecies"] = subspecies
    return out


# ── Data loading ─────────────────────────────────────────────────────────────

def load_data(input_file=None):
    """
    Load a dataset from JSON, CSV, TSV, or Excel.
    Returns: (records, preset_name, input_path)
    """
    path = Path(input_file) if input_file else DATA_FILE
    if not path.is_absolute():
        path = PROJECT_ROOT / path

    log.info(f"Loading data from {path}")
    ext = path.suffix.lower()

    if ext == ".json":
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        preset = detect_column_preset(raw[0].keys()) if raw else "map_points"
        records = [normalize_record(r, preset) for r in raw]

    elif ext in (".csv", ".tsv"):
        delimiter = "\t" if ext == ".tsv" else ","
        with open(path, newline="", encoding="utf-8") as f:
            raw = list(csv.DictReader(f, delimiter=delimiter))
        preset = detect_column_preset(raw[0].keys()) if raw else "csv_standard"
        if not preset:
            log.error(f"Could not detect column mapping for {path}.")
            sys.exit(1)
        records = [normalize_record(r, preset) for r in raw]

    elif ext in (".xlsx", ".xls"):
        try:
            import pandas as pd
        except ImportError:
            log.error("pandas and openpyxl required for Excel files.")
            sys.exit(1)
        df = pd.read_excel(path)
        preset = detect_column_preset(df.columns)
        if not preset:
            log.error(f"Could not detect column mapping for {path}.")
            sys.exit(1)
        raw = df.where(df.notna(), None).to_dict("records")
        records = [normalize_record(r, preset) for r in raw]
    else:
        log.error(f"Unsupported file format: {ext}")
        sys.exit(1)

    log.info(f"Loaded {len(records):,} records (format: {preset}, file: {path.name})")
    return records, preset, path


# ── Apply corrections ────────────────────────────────────────────────────────

def apply_corrections(records, results, correction_tables, sanger_species,
                      input_path=None, output_file=None, preset=None):
    """
    Apply all curation corrections to the dataset and write output.

    Uses result['original_scientific_name'] to map results back to records
    (no fragile note-parsing needed).
    """
    is_app_data = (input_path is None or
                   Path(input_path).resolve() == DATA_FILE.resolve())
    log.info("Applying corrections to dataset...")

    # Build lookup: (original_scientific_name, subspecies) -> result
    result_lookup = {}
    for r in results:
        original = r.get("original_scientific_name", r["input"]["scientific_name"])
        ssp = r["input"].get("subspecies") or ""
        result_lookup[(original, ssp)] = r

    # Detect + merge subspecies typos (auto-detected + manual)
    auto_ssp_typos = detect_subspecies_typos(records)
    manual_typos = correction_tables.get("ssp_typos", {})
    merged_ssp_typos = dict(auto_ssp_typos)
    merged_ssp_typos.update(manual_typos)  # manual wins
    if auto_ssp_typos:
        auto_only = set(auto_ssp_typos) - set(manual_typos)
        overlap = set(auto_ssp_typos) & set(manual_typos)
        log.info(
            f"Subspecies typo detection: {len(auto_ssp_typos)} auto-detected, "
            f"{len(manual_typos)} manual, {len(auto_only)} new from auto, "
            f"{len(overlap)} confirmed by both -> {len(merged_ssp_typos)} total"
        )

    # Apply corrections
    corrections_log = []
    curated_records = []
    stats = Counter()

    spelling = correction_tables.get("spelling", {})
    subspecies_remap = correction_tables.get("subspecies_remap", {})

    for rec in records:
        curated = dict(rec)
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
        curated["curation_basis"] = curation.get("curation_basis")
        curated["literature_action"] = curation.get("literature_action")

        changed = False

        # Spelling corrections
        if "SPELLING_CORRECTED" in curation.get("flags", []):
            corrected = spelling.get(sci_name)
            if corrected:
                parts = corrected.split()
                curated["scientific_name"] = corrected
                if len(parts) >= 2:
                    curated["genus"] = parts[0]
                    curated["species"] = parts[1]
                corrections_log.append({
                    "type": "spelling_correction",
                    "original": sci_name, "corrected": corrected,
                    "subspecies": subspecies, "source": "literature review",
                })
                changed = True

        # Synonym resolution (skip if Sanger taxonomy keeps original)
        if status == "synonym_resolved" and curation.get("accepted_name"):
            accepted = curation["accepted_name"]
            acc_name = accepted.get("canonicalName", "")
            acc_rank = accepted.get("rank", "")
            if acc_name and acc_name != sci_name:
                if sci_name.lower() in sanger_species:
                    curated["curation_basis"] = "Ref. Taxonomy"
                    corrections_log.append({
                        "type": "sanger_taxonomy_override",
                        "original": sci_name, "gbif_wanted": acc_name,
                        "kept": sci_name, "source": "reference taxonomy (BoA / nymphalidae.net)",
                    })
                else:
                    parts = acc_name.split()
                    curated["scientific_name_original"] = sci_name
                    if acc_rank == "SUBSPECIES" and len(parts) >= 3:
                        curated["scientific_name"] = f"{parts[0]} {parts[1]}"
                        curated["genus"] = parts[0]
                        curated["species"] = parts[1]
                        if not subspecies:
                            curated["subspecies"] = parts[2]
                        corrections_log.append({
                            "type": "synonym_resolution",
                            "original": sci_name, "accepted": acc_name,
                            "accepted_species": f"{parts[0]} {parts[1]}",
                            "accepted_subspecies": parts[2],
                            "accepted_rank": acc_rank,
                            "subspecies": subspecies, "source": "GBIF backbone",
                        })
                    else:
                        curated["scientific_name"] = acc_name
                        if len(parts) >= 2:
                            curated["genus"] = parts[0]
                            curated["species"] = parts[1]
                        corrections_log.append({
                            "type": "synonym_resolution",
                            "original": sci_name, "accepted": acc_name,
                            "subspecies": subspecies, "source": "GBIF backbone",
                        })
                    changed = True

        # Subspecies-as-species reclassification
        ssp_remap = subspecies_remap.get(sci_name.lower())
        if ssp_remap:
            correct_species, ssp_epithet, source = ssp_remap
            parts = correct_species.split()
            curated["scientific_name_original"] = sci_name
            curated["scientific_name"] = correct_species
            if len(parts) >= 2:
                curated["genus"] = parts[0]
                curated["species"] = parts[1]
            if not subspecies:
                curated["subspecies"] = ssp_epithet
            corrections_log.append({
                "type": "subspecies_reclassification",
                "original_species": sci_name,
                "correct_species": correct_species,
                "subspecies_epithet": ssp_epithet, "source": source,
            })
            changed = True

        # Subspecies typo corrections
        if subspecies and not changed:
            ssp_key = (sci_name.lower(), subspecies.lower())
            ssp_fix = merged_ssp_typos.get(ssp_key)
            if ssp_fix:
                correct_ssp, ssp_source = ssp_fix
                curated["subspecies_original"] = subspecies
                curated["subspecies"] = correct_ssp
                curated["curation_basis"] = "Typo Detection"
                corrections_log.append({
                    "type": "subspecies_typo",
                    "species": sci_name,
                    "original_subspecies": subspecies,
                    "corrected_subspecies": correct_ssp, "source": ssp_source,
                })
                changed = True

        stats["corrected" if changed else status] += 1
        curated_records.append(curated)

    # Write output
    if is_app_data:
        write_app_outputs(curated_records, corrections_log, records, stats,
                          correction_tables, sanger_species, merged_ssp_typos)
    else:
        write_external_output(curated_records, corrections_log, records,
                              stats, input_path, output_file, preset,
                              correction_tables, sanger_species, merged_ssp_typos)
