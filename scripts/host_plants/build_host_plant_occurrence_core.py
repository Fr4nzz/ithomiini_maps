#!/usr/bin/env python3
"""Build a compact shared host-plant occurrence core for map and gallery views."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
HOST_PLANT_DIR = PROJECT_ROOT / "public" / "data" / "host_plants"
CORE_DATASET_NAME = "host_plant_occurrence_core.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def parse_json_property(value: Any, fallback: Any) -> Any:
    if not isinstance(value, str):
        return value or fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def first_image(properties: dict[str, Any]) -> dict[str, Any] | None:
    media = parse_json_property(properties.get("media"), [])
    if isinstance(media, list):
        for item in media:
            if isinstance(item, dict) and item.get("url"):
                return {"url": item["url"], "fallback": False}
    fallback = parse_json_property(properties.get("fallback_media"), None)
    if isinstance(fallback, dict) and fallback.get("url"):
        return {"url": fallback["url"], "fallback": True}
    return None


def compact_record(feature: dict[str, Any], taxon: dict[str, Any]) -> dict[str, Any] | None:
    properties = feature.get("properties", {}) or {}
    coordinates = feature.get("geometry", {}).get("coordinates") or []
    if len(coordinates) != 2:
        return None
    lon, lat = coordinates
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        return None

    slug = properties.get("host_taxon_slug")
    image = first_image(properties)
    gbif_id = properties.get("gbifID")
    host_name = taxon.get("canonical_name") or properties.get("host_taxon_name") or properties.get("species") or properties.get("scientificName")
    occurrence_group = (
        properties.get("species")
        or properties.get("scientificName")
        or properties.get("taxonRank")
        or properties.get("host_taxon_rank")
        or "GBIF occurrences"
    )

    record = {
        "id": gbif_id or f"{slug}-{lat},{lon}",
        "gbifID": gbif_id,
        "host_taxon_slug": slug,
        "host_taxon_rank": taxon.get("rank") or properties.get("host_taxon_rank"),
        "host_taxon_name": taxon.get("canonical_name") or properties.get("host_taxon_name"),
        "host_family": taxon.get("family") or properties.get("family"),
        "scientific_name": host_name,
        "species": properties.get("species"),
        "genus": properties.get("genus"),
        "family": properties.get("family") or taxon.get("family"),
        "taxonRank": properties.get("taxonRank"),
        "taxonKey": properties.get("taxonKey"),
        "acceptedTaxonKey": properties.get("acceptedTaxonKey"),
        "speciesKey": properties.get("speciesKey"),
        "resolved_taxon_key": properties.get("resolved_taxon_key"),
        "eventDate": properties.get("eventDate"),
        "country": properties.get("country"),
        "coordinateUncertaintyInMeters": properties.get("coordinateUncertaintyInMeters"),
        "lat": lat,
        "lng": lon,
        "gallery_kind": "host-plants",
    }
    return {
        key: value for key, value in record.items()
        if value is not None and value != "" and value != []
    }


def build_occurrence_core(output_dir: Path = HOST_PLANT_DIR) -> dict[str, Any]:
    manifest_path = output_dir / "host_plant_layers_manifest.json"
    manifest = load_json(manifest_path)
    occurrence_name = manifest.get("metadata", {}).get("occurrence_dataset", "host_plant_occurrences.json")
    occurrence_doc = load_json(output_dir / occurrence_name)
    taxa_by_slug = {taxon.get("slug"): taxon for taxon in manifest.get("taxa", [])}

    stats_by_slug: dict[str, dict[str, int]] = {}
    records: list[dict[str, Any]] = []
    for feature in occurrence_doc.get("features", []):
        slug = (feature.get("properties") or {}).get("host_taxon_slug")
        if not slug:
            continue
        taxon = taxa_by_slug.get(slug, {})
        record = compact_record(feature, taxon)
        if not record:
            continue
        stats = stats_by_slug.setdefault(slug, {"total_records": 0, "records_with_images": 0, "records_without_images": 0})
        stats["total_records"] += 1
        if record.get("image_url"):
            stats["records_with_images"] += 1
        else:
            stats["records_without_images"] += 1
        records.append(record)

    records_with_images = sum(stats["records_with_images"] for stats in stats_by_slug.values())
    records_without_images = sum(stats["records_without_images"] for stats in stats_by_slug.values())
    return {
        "metadata": {
            "generated_at": utc_now(),
            "source_occurrence_dataset": occurrence_name,
            "total_records": len(records),
            "records_with_images": records_with_images,
            "records_without_images": records_without_images,
            "purpose": "Shared compact host-plant occurrence core used by map views; image data lives in host_plant_gallery.json.",
        },
        "stats_by_slug": stats_by_slug,
        "records": records,
    }


def main() -> int:
    core = build_occurrence_core()
    write_json(HOST_PLANT_DIR / CORE_DATASET_NAME, core)
    print(
        f"Wrote {CORE_DATASET_NAME}: {core['metadata']['total_records']} records "
        f"({core['metadata']['records_with_images']} with images)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
