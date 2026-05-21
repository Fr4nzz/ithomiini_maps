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
    taxa = manifest.get("taxa", [])
    slugs = {taxon.get("slug") for taxon in taxa}

    if len(taxa_doc.get("taxa", [])) != len(taxa):
        errors.append("Taxon manifest and host_plant_taxa.json disagree on taxon count.")

    for association in associations_doc.get("associations", []):
        slug = association.get("host_taxon_slug")
        if slug not in slugs:
            errors.append(f"Association references unknown host taxon slug: {slug}")

    for taxon in taxa:
        occurrence_count = taxon.get("occurrence_count", 0)
        if occurrence_count <= 0:
            continue
        occurrence_file = taxon.get("occurrence_file")
        if not occurrence_file:
            errors.append(f"{taxon.get('canonical_name')} has occurrences but no occurrence_file.")
            continue
        geojson_path = output_dir / occurrence_file
        if not geojson_path.exists():
            errors.append(f"Missing occurrence file: {geojson_path}")
            continue
        geojson = load_json(geojson_path)
        if geojson.get("type") != "FeatureCollection":
            errors.append(f"{geojson_path} is not a FeatureCollection.")
        features = geojson.get("features", [])
        if len(features) != occurrence_count:
            errors.append(
                f"{geojson_path} has {len(features)} features but manifest says {occurrence_count}."
            )
        for index, feature in enumerate(features):
            coords = feature.get("geometry", {}).get("coordinates")
            if not isinstance(coords, list) or len(coords) != 2:
                errors.append(f"{geojson_path} feature {index} lacks point coordinates.")
                continue
            lon, lat = coords
            if not (-120 <= lon <= -30 and -60 <= lat <= 35):
                errors.append(f"{geojson_path} feature {index} is outside study extent: {coords}")

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
