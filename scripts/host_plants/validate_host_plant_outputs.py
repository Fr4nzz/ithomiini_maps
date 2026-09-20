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
    metadata = manifest.get("metadata", {})
    taxa = manifest.get("taxa", [])
    slugs = {taxon.get("slug") for taxon in taxa}

    if len(taxa_doc.get("taxa", [])) != len(taxa):
        errors.append("Taxon manifest and host_plant_taxa.json disagree on taxon count.")

    for association in associations_doc.get("associations", []):
        slug = association.get("host_taxon_slug")
        if slug not in slugs:
            errors.append(f"Association references unknown host taxon slug: {slug}")

    if metadata.get("occurrence_store_version") == 2:
        validate_v2(output_dir, metadata, taxa, slugs, errors)
    else:
        validate_legacy(output_dir, metadata, taxa, slugs, errors)

    return errors


def validate_v2(output_dir: Path, metadata: dict, taxa: list[dict], slugs: set[str], errors: list[str]) -> None:
    refs_by_taxon = metadata.get("occurrence_refs_by_taxon") or {}
    chunks = metadata.get("occurrence_chunks") or {}
    gallery_indexes = metadata.get("gallery_indexes_by_taxon") or {}
    if not refs_by_taxon:
        errors.append("Manifest v2 lacks occurrence_refs_by_taxon.")
    if not chunks:
        errors.append("Manifest v2 lacks occurrence_chunks.")

    occurrence_counts: dict[str, int] = {}
    for slug, rel_path in refs_by_taxon.items():
        if slug not in slugs:
            errors.append(f"Occurrence refs reference unknown slug: {slug}")
        path = output_dir / rel_path
        if not path.exists():
            errors.append(f"Missing occurrence ref file: {path}")
            continue
        ref = load_json(path)
        total = 0
        for chunk_name, indexes in (ref.get("chunks") or {}).items():
            total += len(indexes)
            chunk_path = output_dir / chunk_name
            if chunk_name not in chunks:
                errors.append(f"{path} references unknown occurrence chunk: {chunk_name}")
            if not chunk_path.exists():
                errors.append(f"Missing occurrence chunk: {chunk_path}")
                continue
            chunk_doc = load_json(chunk_path)
            record_count = len(chunk_doc.get("records", []))
            bad_indexes = [index for index in indexes if not isinstance(index, int) or index < 0 or index >= record_count]
            if bad_indexes:
                errors.append(f"{path} has invalid indexes for {chunk_name}: {bad_indexes[:5]}")
        occurrence_counts[slug] = total

    for taxon in taxa:
        slug = taxon.get("slug")
        mapped_count = occurrence_counts.get(slug, 0)
        if taxon.get("occurrence_count", 0) != mapped_count:
            errors.append(f"{taxon.get('canonical_name')} has {mapped_count} refs but manifest says {taxon.get('occurrence_count', 0)}.")
        if taxon.get("rank") == "family" and mapped_count:
            errors.append(f"Family-level taxon {taxon.get('canonical_name')} has mapped occurrences.")

    for slug, rel_path in gallery_indexes.items():
        if slug not in slugs:
            errors.append(f"Gallery index references unknown slug: {slug}")
        path = output_dir / rel_path
        if not path.exists():
            errors.append(f"Missing gallery index file: {path}")
            continue
        index_doc = load_json(path)
        for page in index_doc.get("pages", []):
            page_path = output_dir / page
            if not page_path.exists():
                errors.append(f"Missing gallery page: {page_path}")
                continue
            page_doc = load_json(page_path)
            for item_index, item in enumerate(page_doc.get("items", [])):
                if item.get("host_taxon_slug") != slug:
                    errors.append(f"{page_path} item {item_index} has wrong host taxon slug.")
                if not item.get("image_url"):
                    errors.append(f"{page_path} item {item_index} lacks image_url.")


def validate_legacy(output_dir: Path, metadata: dict, taxa: list[dict], slugs: set[str], errors: list[str]) -> None:
    occurrence_dataset_name = metadata.get("occurrence_dataset", "host_plant_occurrences.json")
    occurrence_core_name = metadata.get("occurrence_core_dataset", "host_plant_occurrence_core.json")
    gallery_dataset_name = metadata.get("gallery_dataset", occurrence_core_name)
    occurrence_dataset_path = output_dir / occurrence_dataset_name
    occurrence_core_path = output_dir / occurrence_core_name
    gallery_dataset_path = output_dir / gallery_dataset_name

    if not occurrence_dataset_path.exists():
        errors.append(f"Missing occurrence dataset: {occurrence_dataset_path}")
        return
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
            errors.append(f"{taxon.get('canonical_name')} has {mapped_count} mapped rows but manifest says {occurrence_count}.")
        if taxon.get("rank") == "family" and mapped_count:
            errors.append(f"Family-level taxon {taxon.get('canonical_name')} has mapped occurrences.")

    if gallery_dataset_path.exists():
        gallery_dataset = load_json(gallery_dataset_path)
        gallery_records = gallery_dataset.get("items")
        if gallery_records is None:
            gallery_records = [record for record in gallery_dataset.get("records", []) if record.get("image_url")]
        for index, item in enumerate(gallery_records):
            slug = item.get("host_taxon_slug")
            if slug not in slugs:
                errors.append(f"{gallery_dataset_path} gallery item {index} references unknown slug: {slug}")
            if not item.get("image_url"):
                errors.append(f"{gallery_dataset_path} gallery item {index} lacks image_url.")


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
