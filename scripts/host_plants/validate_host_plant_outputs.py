#!/usr/bin/env python3
"""Validate generated host-plant web data files."""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
HOST_PLANT_DIR = PROJECT_ROOT / "public" / "data" / "host_plants"


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate(output_dir: Path = HOST_PLANT_DIR) -> list[str]:
    errors: list[str] = []
    manifest_path = output_dir / "host_plant_layers_manifest.json"
    taxa_path = output_dir / "host_plant_taxa.json"
    associations_path = output_dir / "host_plant_associations.json"

    for path in (manifest_path, taxa_path, associations_path):
      if not path.exists():
        errors.append(f"Missing required file: {path}")

    if errors:
        return errors

    manifest = load_json(manifest_path)
    taxa_doc = load_json(taxa_path)
    associations_doc = load_json(associations_path)
    occurrence_dataset_name = manifest.get("metadata", {}).get("occurrence_dataset", "host_plant_occurrences.json")
    occurrence_core_name = manifest.get("metadata", {}).get("occurrence_core_dataset", "host_plant_occurrence_core.json")
    gallery_dataset_name = manifest.get("metadata", {}).get("gallery_dataset", occurrence_core_name)
    occurrence_dataset_path = output_dir / occurrence_dataset_name
    occurrence_core_path = output_dir / occurrence_core_name
    gallery_dataset_path = output_dir / gallery_dataset_name
    taxa = manifest.get("taxa", [])
    slugs = {taxon.get("slug") for taxon in taxa}

    if len(taxa_doc.get("taxa", [])) != len(taxa):
        errors.append("Taxon manifest and host_plant_taxa.json disagree on taxon count.")

    for association in associations_doc.get("associations", []):
        slug = association.get("host_taxon_slug")
        if slug not in slugs:
            errors.append(f"Association references unknown host taxon slug: {slug}")

    if not occurrence_dataset_path.exists():
        errors.append(f"Missing occurrence dataset: {occurrence_dataset_path}")
        return errors
    if not occurrence_core_path.exists():
        errors.append(f"Missing occurrence core dataset: {occurrence_core_path}")
    if not gallery_dataset_path.exists():
        errors.append(f"Missing gallery dataset: {gallery_dataset_path}")

    occurrence_dataset = load_json(occurrence_dataset_path)
    if occurrence_dataset.get("type") != "FeatureCollection":
        errors.append(f"{occurrence_dataset_path} is not a FeatureCollection.")
    features_by_slug: dict[str, int] = {}
    for index, feature in enumerate(occurrence_dataset.get("features", [])):
        props = feature.get("properties", {})
        slug = props.get("host_taxon_slug")
        if slug not in slugs:
            errors.append(f"{occurrence_dataset_path} feature {index} references unknown slug: {slug}")
        features_by_slug[slug] = features_by_slug.get(slug, 0) + 1
        coords = feature.get("geometry", {}).get("coordinates")
        if not isinstance(coords, list) or len(coords) != 2:
            errors.append(f"{occurrence_dataset_path} feature {index} lacks point coordinates.")
            continue
        lon, lat = coords
        if not (-120 <= lon <= -30 and -60 <= lat <= 35):
            errors.append(f"{occurrence_dataset_path} feature {index} is outside study extent: {coords}")

    for taxon in taxa:
        occurrence_count = taxon.get("occurrence_count", 0)
        mapped_count = features_by_slug.get(taxon.get("slug"), 0)
        if occurrence_count != mapped_count:
            errors.append(
                f"{taxon.get('canonical_name')} has {mapped_count} mapped rows but manifest says {occurrence_count}."
            )
        if taxon.get("rank") == "family" and mapped_count:
            errors.append(f"Family-level taxon {taxon.get('canonical_name')} has mapped occurrences.")

    if gallery_dataset_path.exists():
        gallery_dataset = load_json(gallery_dataset_path)
        gallery_records = gallery_dataset.get("items")
        if gallery_records is None:
            gallery_records = [
                record for record in gallery_dataset.get("records", [])
                if record.get("image_url")
            ]
        for index, item in enumerate(gallery_records):
            slug = item.get("host_taxon_slug")
            if slug not in slugs:
                errors.append(f"{gallery_dataset_path} gallery item {index} references unknown slug: {slug}")
            if not item.get("image_url"):
                errors.append(f"{gallery_dataset_path} gallery item {index} lacks image_url.")
        stats_slugs = set(gallery_dataset.get("stats_by_slug", {}).keys())
        unknown_stats = stats_slugs - slugs
        for slug in sorted(unknown_stats):
            errors.append(f"{gallery_dataset_path} stats reference unknown slug: {slug}")

    if occurrence_core_path.exists():
        occurrence_core = load_json(occurrence_core_path)
        if not isinstance(occurrence_core.get("records"), list):
            errors.append(f"{occurrence_core_path} lacks records list.")
        core_by_slug: dict[str, int] = {}
        for index, record in enumerate(occurrence_core.get("records", [])):
            slug = record.get("host_taxon_slug")
            if slug not in slugs:
                errors.append(f"{occurrence_core_path} record {index} references unknown slug: {slug}")
            core_by_slug[slug] = core_by_slug.get(slug, 0) + 1
            lon = record.get("lng")
            lat = record.get("lat")
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                errors.append(f"{occurrence_core_path} record {index} lacks numeric coordinates.")
                continue
            if not (-120 <= lon <= -30 and -60 <= lat <= 35):
                errors.append(f"{occurrence_core_path} record {index} is outside study extent: {[lon, lat]}")
        if core_by_slug != features_by_slug:
            errors.append("Occurrence core counts do not match the full occurrence dataset.")

    return errors


def main() -> int:
    errors = validate()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("Host plant outputs validated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
