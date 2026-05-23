#!/usr/bin/env python3
"""Build a compact host-plant gallery index from the occurrence dataset."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from build_host_plant_occurrence_core import first_image


PROJECT_ROOT = Path(__file__).resolve().parents[2]
HOST_PLANT_DIR = PROJECT_ROOT / "public" / "data" / "host_plants"
GALLERY_DATASET_NAME = "host_plant_gallery.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def build_gallery_index(output_dir: Path = HOST_PLANT_DIR) -> dict[str, Any]:
    manifest_path = output_dir / "host_plant_layers_manifest.json"
    manifest = load_json(manifest_path)
    occurrence_name = manifest.get("metadata", {}).get("occurrence_dataset", "host_plant_occurrences.json")
    occurrence_doc = load_json(output_dir / occurrence_name)

    taxa_by_slug = {taxon.get("slug"): taxon for taxon in manifest.get("taxa", [])}
    stats_by_slug: dict[str, dict[str, int]] = {}
    items_by_key: dict[str, dict[str, Any]] = {}

    for feature in occurrence_doc.get("features", []):
        properties = feature.get("properties", {}) or {}
        slug = properties.get("host_taxon_slug")
        if not slug:
            continue
        coordinates = feature.get("geometry", {}).get("coordinates") or []
        if len(coordinates) != 2:
            continue
        lon, lat = coordinates
        if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
            continue

        stats = stats_by_slug.setdefault(slug, {"total_records": 0, "records_with_images": 0, "records_without_images": 0})
        stats["total_records"] += 1

        image = first_image(properties)
        if not image:
            stats["records_without_images"] += 1
            continue
        stats["records_with_images"] += 1

        taxon = taxa_by_slug.get(slug, {})
        occurrence_group = (
            properties.get("species")
            or properties.get("scientificName")
            or properties.get("taxonRank")
            or properties.get("host_taxon_rank")
            or "GBIF occurrences"
        )
        key = "|".join([slug, str(occurrence_group), image["url"]])
        gbif_id = properties.get("gbifID")
        if key in items_by_key:
            items_by_key[key]["duplicate_image_record_count"] += 1
            if gbif_id:
                items_by_key[key].setdefault("duplicate_image_gbif_ids", []).append(gbif_id)
            continue

        host_name = taxon.get("canonical_name") or properties.get("host_taxon_name") or properties.get("species") or properties.get("scientificName")
        item = {
            "id": gbif_id or f"{slug}-{lat},{lon}",
            "gbifID": gbif_id,
            "image_url": image["url"],
            "image_is_fallback": bool(image.get("fallback")),
            "scientific_name": host_name,
            "subspecies": occurrence_group,
            "observation_date": properties.get("eventDate"),
            "source": properties.get("datasetName") or properties.get("publisher") or "GBIF",
            "country": properties.get("country"),
            "collection_location": properties.get("locality") or properties.get("stateProvince"),
            "lat": lat,
            "lng": lon,
            "observation_url": f"https://www.gbif.org/occurrence/{gbif_id}" if gbif_id else None,
            "host_taxon_slug": slug,
            "host_taxon_rank": taxon.get("rank") or properties.get("host_taxon_rank"),
            "host_family": taxon.get("family") or properties.get("family"),
            "duplicate_image_record_count": 1,
            "duplicate_image_gbif_ids": [gbif_id] if gbif_id else [],
            "gallery_kind": "host-plants",
        }
        items_by_key[key] = {
            item_key: item_value for item_key, item_value in item.items()
            if item_value is not None and item_value != "" and item_value != []
        }

    total_records = sum(stats["total_records"] for stats in stats_by_slug.values())
    records_with_images = sum(stats["records_with_images"] for stats in stats_by_slug.values())
    records_without_images = sum(stats["records_without_images"] for stats in stats_by_slug.values())
    return {
        "metadata": {
            "generated_at": utc_now(),
            "source_occurrence_dataset": occurrence_name,
            "item_count": len(items_by_key),
            "total_records": total_records,
            "records_with_images": records_with_images,
            "records_without_images": records_without_images,
            "dedupe_key": "host_taxon_slug + occurrence species/group + image URL",
            "purpose": "Compact host-plant image index; map coordinates are loaded from occurrence_core_dataset.",
        },
        "stats_by_slug": stats_by_slug,
        "items": list(items_by_key.values()),
    }


def main() -> int:
    index = build_gallery_index()
    write_json(HOST_PLANT_DIR / GALLERY_DATASET_NAME, index)
    print(
        f"Wrote {GALLERY_DATASET_NAME}: {index['metadata']['item_count']} images "
        f"from {index['metadata']['total_records']} records."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
