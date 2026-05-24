#!/usr/bin/env python3
"""Build per-host-taxon lazy-load occurrence and gallery shards.

This reads the large host_plant_occurrences.json as a stream and writes compact
per-taxon shards so the app does not fetch all host-plant records up front.
Large shards are split into parts below a conservative file-size target.
"""
from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

try:
    import ijson
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: pip install ijson") from exc

PROJECT_ROOT = Path(__file__).resolve().parents[2]
HOST_PLANT_DIR = PROJECT_ROOT / "public" / "data" / "host_plants"
MAX_SHARD_BYTES = 60 * 1024 * 1024
MAX_GALLERY_ITEMS_PER_TAXON = 1000


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def file_slug(slug: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", slug.lower())


def clean(record: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in record.items() if value is not None and value != "" and value != []}


def media_urls(properties: dict[str, Any]) -> list[tuple[str, bool]]:
    urls: list[tuple[str, bool]] = []
    for key, is_fallback in (("media", False), ("fallback_media", True)):
        value = properties.get(key)
        values = value if isinstance(value, list) else ([value] if isinstance(value, dict) else [])
        for item in values:
            if isinstance(item, dict) and item.get("url"):
                urls.append((item["url"], is_fallback))
    return urls


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def write_sharded_doc(base_dir: Path, rel_path: str, doc: dict[str, Any], item_key: str) -> str | list[str]:
    path = base_dir / rel_path
    write_json(path, doc)
    if path.stat().st_size <= MAX_SHARD_BYTES:
        return rel_path

    items = doc[item_key]
    parts = max(2, math.ceil(path.stat().st_size / MAX_SHARD_BYTES))
    chunk_size = math.ceil(len(items) / parts)
    part_paths: list[str] = []
    for index in range(parts):
        chunk = items[index * chunk_size:(index + 1) * chunk_size]
        if not chunk:
            continue
        part_rel = str(Path(rel_path).with_name(f"{Path(rel_path).stem}_part{index + 1:02d}.json"))
        part_doc = {
            **doc,
            item_key: chunk,
            "metadata": {
                **doc.get("metadata", {}),
                "part": index + 1,
                "parts": parts,
                "record_count": len(chunk),
            },
        }
        write_json(base_dir / part_rel, part_doc)
        part_paths.append(part_rel)
    path.unlink()
    return part_paths


def build_taxon_shards(output_dir: Path = HOST_PLANT_DIR) -> dict[str, Any]:
    manifest_path = output_dir / "host_plant_layers_manifest.json"
    manifest = json.load(manifest_path.open(encoding="utf-8"))
    taxa_by_slug = {taxon.get("slug"): taxon for taxon in manifest.get("taxa", [])}

    occurrence_path = output_dir / "host_plant_occurrences.json"
    core_by_slug: dict[str, list[dict[str, Any]]] = defaultdict(list)
    core_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"total_records": 0, "records_with_images": 0, "records_without_images": 0})
    gallery_by_slug: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    gallery_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"total_records": 0, "records_with_images": 0, "records_without_images": 0})

    with occurrence_path.open("rb") as handle:
        for feature in ijson.items(handle, "features.item"):
            properties = feature.get("properties") or {}
            slug = properties.get("host_taxon_slug")
            if not slug:
                continue
            coordinates = feature.get("geometry", {}).get("coordinates") or []
            if len(coordinates) != 2:
                continue
            lon = float(coordinates[0]) if isinstance(coordinates[0], Decimal) else coordinates[0]
            lat = float(coordinates[1]) if isinstance(coordinates[1], Decimal) else coordinates[1]
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                continue

            taxon = taxa_by_slug.get(slug, {})
            images = media_urls(properties)
            image_url = images[0][0] if images else None
            image_is_fallback = images[0][1] if images else None
            record = clean({
                "id": properties.get("gbifID") or f"{slug}-{lat},{lon}",
                "gbifID": properties.get("gbifID"),
                "host_taxon_slug": slug,
                "host_taxon_rank": taxon.get("rank") or properties.get("host_taxon_rank"),
                "host_taxon_name": taxon.get("canonical_name") or properties.get("host_taxon_name"),
                "host_family": taxon.get("family") or properties.get("family"),
                "scientificName": properties.get("scientificName"),
                "species": properties.get("species"),
                "genus": properties.get("genus"),
                "family": properties.get("family") or taxon.get("family"),
                "eventDate": properties.get("eventDate"),
                "country": properties.get("country"),
                "datasetName": properties.get("datasetName"),
                "publisher": properties.get("publisher"),
                "image_url": image_url,
                "image_is_fallback": image_is_fallback,
                "lat": lat,
                "lng": lon,
                "gallery_kind": "host-plants",
            })
            core_by_slug[slug].append(record)
            stats = core_stats[slug]
            stats["total_records"] += 1
            stats["records_with_images" if image_url else "records_without_images"] += 1

            gallery_stat = gallery_stats[slug]
            gallery_stat["total_records"] += 1
            if not images:
                gallery_stat["records_without_images"] += 1
                continue
            gallery_stat["records_with_images"] += 1
            if len(gallery_by_slug[slug]) >= MAX_GALLERY_ITEMS_PER_TAXON:
                continue
            occurrence_group = properties.get("species") or properties.get("scientificName") or properties.get("taxonRank") or properties.get("host_taxon_rank") or "GBIF occurrences"
            for url, is_fallback in images:
                if len(gallery_by_slug[slug]) >= MAX_GALLERY_ITEMS_PER_TAXON:
                    break
                key = "|".join([slug, str(occurrence_group), url])
                gbif_id = properties.get("gbifID")
                if key in gallery_by_slug[slug]:
                    item = gallery_by_slug[slug][key]
                    item["duplicate_image_record_count"] += 1
                    if gbif_id:
                        item.setdefault("duplicate_image_gbif_ids", []).append(gbif_id)
                    continue
                gallery_by_slug[slug][key] = clean({
                    "id": gbif_id or f"{slug}-{lat},{lon}",
                    "gbifID": gbif_id,
                    "image_url": url,
                    "image_is_fallback": is_fallback,
                    "scientific_name": taxon.get("canonical_name") or properties.get("host_taxon_name") or properties.get("species") or properties.get("scientificName"),
                    "subspecies": occurrence_group,
                    "observation_date": properties.get("eventDate"),
                    "source": properties.get("datasetName") or properties.get("publisher") or "GBIF",
                    "country": properties.get("country"),
                    "lat": lat,
                    "lng": lon,
                    "observation_url": f"https://www.gbif.org/occurrence/{gbif_id}" if gbif_id else None,
                    "host_taxon_slug": slug,
                    "host_taxon_rank": taxon.get("rank") or properties.get("host_taxon_rank"),
                    "host_family": taxon.get("family") or properties.get("family"),
                    "duplicate_image_record_count": 1,
                    "duplicate_image_gbif_ids": [gbif_id] if gbif_id else [],
                    "gallery_kind": "host-plants",
                })

    occurrence_shards: dict[str, str | list[str]] = {}
    gallery_shards: dict[str, str | list[str]] = {}
    for slug, records in core_by_slug.items():
        rel_path = f"occurrence_taxa/{file_slug(slug)}.json"
        doc = {
            "metadata": {"generated_at": utc_now(), "host_taxon_slug": slug, "total_records": len(records), "purpose": "Per-host-taxon compact occurrence shard for lazy loading."},
            "stats_by_slug": {slug: core_stats[slug]},
            "records": records,
        }
        occurrence_shards[slug] = write_sharded_doc(output_dir, rel_path, doc, "records")

    for slug, item_map in gallery_by_slug.items():
        items = list(item_map.values())
        rel_path = f"gallery_taxa/{file_slug(slug)}.json"
        doc = {
            "metadata": {"generated_at": utc_now(), "host_taxon_slug": slug, "item_count": len(items), **gallery_stats[slug], "purpose": "Per-host-taxon image gallery shard for lazy loading."},
            "stats_by_slug": {slug: gallery_stats[slug]},
            "items": items,
        }
        gallery_shards[slug] = write_sharded_doc(output_dir, rel_path, doc, "items")

    metadata = manifest.setdefault("metadata", {})
    metadata["occurrence_core_dataset"] = None
    metadata["occurrence_core_shards_by_taxon"] = occurrence_shards
    metadata["occurrence_core_shard_strategy"] = "host_taxon"
    metadata["occurrence_core_shard_count"] = len(occurrence_shards)
    metadata["gallery_dataset"] = None
    metadata["gallery_shards_by_taxon"] = gallery_shards
    metadata["gallery_shard_strategy"] = "host_taxon"
    metadata["gallery_shard_count"] = len(gallery_shards)
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return {"occurrence_shards": len(occurrence_shards), "gallery_shards": len(gallery_shards)}


def main() -> int:
    result = build_taxon_shards()
    print(f"Wrote {result['occurrence_shards']} occurrence taxon shards and {result['gallery_shards']} gallery taxon shards.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
