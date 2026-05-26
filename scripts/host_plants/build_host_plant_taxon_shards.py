#!/usr/bin/env python3
"""Build compact lazy-load host-plant occurrence indexes and paged gallery shards.

This reads the large ignored host_plant_occurrences.json stream once and emits:
- occurrence_chunks/: each GBIF occurrence stored once, without host-taxon wrapper fields
- taxon_occurrence_refs/: per-host-taxon references into occurrence chunks
- gallery_taxa/<slug>/: image-only gallery indexes and pages

The app can then load only refs/chunks for selected host taxa and only the first
few gallery images per taxon until the user asks for more.
"""
from __future__ import annotations

import json
import math
import re
import shutil
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
OCCURRENCE_CHUNK_SIZE = 20_000
GALLERY_PAGE_SIZE = 100
MAX_GALLERY_ITEMS_PER_TAXON = 1000
GALLERY_PREVIEW_PER_CATEGORY = 10

PHOTO_CONTEXTS = {
    "field": {
        "label": "Field observation",
        "basis": {"HUMAN_OBSERVATION", "MACHINE_OBSERVATION", "OBSERVATION"},
    },
    "ambiguous": {
        "label": "Ambiguous",
        "basis": {"OCCURRENCE"},
    },
    "preserved": {
        "label": "Preserved specimen",
        "basis": {"PRESERVED_SPECIMEN", "MATERIAL_SAMPLE", "MATERIAL_CITATION"},
    },
}
PHOTO_CONTEXT_ORDER = ["field", "ambiguous", "preserved"]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def file_slug(slug: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", slug.lower())


def clean(record: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in record.items() if value is not None and value != "" and value != []}


def clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def decimal_to_float(value: Any) -> Any:
    return float(value) if isinstance(value, Decimal) else value


def photo_context_for_basis(basis: Any) -> str:
    normalized = str(basis or "").upper()
    for key, config in PHOTO_CONTEXTS.items():
        if normalized in config["basis"]:
            return key
    return "ambiguous"


def sort_date_value(value: Any) -> int:
    # Convert ISO-ish dates to an integer prefix so recent records sort first.
    digits = re.sub(r"\D+", "", str(value or ""))[:8]
    return int(digits.ljust(8, "0")) if digits else 0


def gallery_sort_key(item: dict[str, Any]) -> tuple[int, int, str]:
    context_order = {key: index for index, key in enumerate(PHOTO_CONTEXT_ORDER)}
    return (
        context_order.get(item.get("photo_context"), len(context_order)),
        -sort_date_value(item.get("observation_date")),
        str(item.get("gbifID") or item.get("id") or ""),
    )


def media_urls(properties: dict[str, Any]) -> list[tuple[str, bool]]:
    urls: list[tuple[str, bool]] = []
    for key, is_fallback in (("media", False), ("fallback_media", True)):
        value = properties.get(key)
        values = value if isinstance(value, list) else ([value] if isinstance(value, dict) else [])
        for item in values:
            if isinstance(item, dict) and item.get("url"):
                urls.append((item["url"], is_fallback))
    return urls


def write_json(path: Path, data: Any, *, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
        handle.write("\n")


def occurrence_key(properties: dict[str, Any], lat: float, lon: float) -> str:
    gbif_id = properties.get("gbifID")
    if gbif_id:
        return f"gbif:{gbif_id}"
    return "coord:" + "|".join([
        str(properties.get("scientificName") or properties.get("species") or properties.get("taxonKey") or ""),
        f"{lat:.6f}",
        f"{lon:.6f}",
        str(properties.get("eventDate") or ""),
    ])


def compact_occurrence(properties: dict[str, Any], lat: float, lon: float) -> dict[str, Any]:
    return clean({
        "id": properties.get("gbifID") or f"{lat},{lon}",
        "gbifID": properties.get("gbifID"),
        "lat": lat,
        "lng": lon,
        "eventDate": properties.get("eventDate"),
        "country": properties.get("country"),
        "coordinateUncertaintyInMeters": properties.get("coordinateUncertaintyInMeters"),
        "scientific_name": properties.get("scientificName") or properties.get("species"),
        "species": properties.get("species"),
        "genus": properties.get("genus"),
        "family": properties.get("family"),
        "taxonRank": properties.get("taxonRank"),
        "taxonKey": properties.get("taxonKey"),
        "acceptedTaxonKey": properties.get("acceptedTaxonKey"),
        "speciesKey": properties.get("speciesKey"),
        "resolved_taxon_key": properties.get("resolved_taxon_key"),
        "basisOfRecord": properties.get("basisOfRecord"),
    })


def gallery_item(properties: dict[str, Any], taxon: dict[str, Any], slug: str, lat: float, lon: float, url: str, is_fallback: bool) -> dict[str, Any]:
    gbif_id = properties.get("gbifID")
    item_id = gbif_id or f"{slug}-{lat},{lon}"
    occurrence_group = properties.get("species") or properties.get("scientificName") or properties.get("taxonRank") or taxon.get("rank") or "GBIF occurrences"
    return clean({
        "id": item_id,
        "gallery_id": f"{item_id}|{url}",
        "gbifID": gbif_id,
        "image_url": url,
        "image_is_fallback": is_fallback,
        "scientific_name": taxon.get("canonical_name") or properties.get("host_taxon_name") or properties.get("species") or properties.get("scientificName"),
        "accepted_name": taxon.get("accepted_name") or taxon.get("canonical_name"),
        "subspecies": occurrence_group,
        "observation_date": properties.get("eventDate"),
        "basisOfRecord": properties.get("basisOfRecord"),
        "photo_context": photo_context_for_basis(properties.get("basisOfRecord")),
        "source": properties.get("datasetName") or properties.get("publisher") or "GBIF",
        "country": properties.get("country"),
        "lat": lat,
        "lng": lon,
        "observation_url": f"https://www.gbif.org/occurrence/{gbif_id}" if gbif_id else None,
        "host_taxon_slug": slug,
        "host_taxon_rank": taxon.get("rank") or properties.get("host_taxon_rank"),
        "host_family": taxon.get("family") or properties.get("family"),
        "duplicate_image_record_count": 1,
        "gallery_kind": "host-plants",
    })


def build_taxon_shards(output_dir: Path = HOST_PLANT_DIR) -> dict[str, Any]:
    manifest_path = output_dir / "host_plant_layers_manifest.json"
    manifest = json.load(manifest_path.open(encoding="utf-8"))
    taxa_by_slug = {taxon.get("slug"): taxon for taxon in manifest.get("taxa", [])}
    occurrence_path = output_dir / "host_plant_occurrences.json"
    if not occurrence_path.exists():
        raise SystemExit(f"Missing ignored raw occurrence file: {occurrence_path}")

    occurrence_chunk_dir = output_dir / "occurrence_chunks"
    ref_dir = output_dir / "taxon_occurrence_refs"
    gallery_dir = output_dir / "gallery_taxa"
    clean_dir(occurrence_chunk_dir)
    clean_dir(ref_dir)
    clean_dir(gallery_dir)

    occurrence_records: list[dict[str, Any]] = []
    occurrence_lookup: dict[str, tuple[str, int]] = {}
    refs_by_slug: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    seen_refs_by_slug: dict[str, set[tuple[str, int]]] = defaultdict(set)
    occurrence_stats_by_slug: dict[str, dict[str, int]] = defaultdict(lambda: {"total_records": 0})
    gallery_by_slug: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    gallery_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"total_records": 0, "records_with_images": 0, "records_without_images": 0})

    with occurrence_path.open("rb") as handle:
        for feature in ijson.items(handle, "features.item"):
            properties = feature.get("properties") or {}
            slug = properties.get("host_taxon_slug")
            if not slug or slug not in taxa_by_slug:
                continue
            coordinates = feature.get("geometry", {}).get("coordinates") or []
            if len(coordinates) != 2:
                continue
            lon = decimal_to_float(coordinates[0])
            lat = decimal_to_float(coordinates[1])
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                continue

            key = occurrence_key(properties, lat, lon)
            if key not in occurrence_lookup:
                chunk_index = len(occurrence_records) // OCCURRENCE_CHUNK_SIZE
                rel_chunk = f"occurrence_chunks/chunk_{chunk_index + 1:03d}.json"
                local_index = len(occurrence_records) % OCCURRENCE_CHUNK_SIZE
                occurrence_lookup[key] = (rel_chunk, local_index)
                occurrence_records.append(compact_occurrence(properties, lat, lon))
            rel_chunk, local_index = occurrence_lookup[key]
            ref_key = (rel_chunk, local_index)
            if ref_key not in seen_refs_by_slug[slug]:
                refs_by_slug[slug][rel_chunk].append(local_index)
                seen_refs_by_slug[slug].add(ref_key)
                occurrence_stats_by_slug[slug]["total_records"] += 1

            images = media_urls(properties)
            stat = gallery_stats[slug]
            stat["total_records"] += 1
            if not images:
                stat["records_without_images"] += 1
                continue
            stat["records_with_images"] += 1
            taxon = taxa_by_slug[slug]
            occurrence_group = properties.get("species") or properties.get("scientificName") or properties.get("taxonRank") or taxon.get("rank") or "GBIF occurrences"
            gbif_id = properties.get("gbifID")
            for url, is_fallback in images:
                image_key = "|".join([slug, str(occurrence_group), url])
                if image_key in gallery_by_slug[slug]:
                    item = gallery_by_slug[slug][image_key]
                    item["duplicate_image_record_count"] = item.get("duplicate_image_record_count", 1) + 1
                    continue
                gallery_by_slug[slug][image_key] = gallery_item(properties, taxon, slug, lat, lon, url, is_fallback)

    # Write unique occurrence chunks.
    occurrence_chunks: dict[str, dict[str, int]] = {}
    for chunk_index in range(math.ceil(len(occurrence_records) / OCCURRENCE_CHUNK_SIZE)):
        start = chunk_index * OCCURRENCE_CHUNK_SIZE
        chunk = occurrence_records[start:start + OCCURRENCE_CHUNK_SIZE]
        rel = f"occurrence_chunks/chunk_{chunk_index + 1:03d}.json"
        write_json(output_dir / rel, {
            "metadata": {"generated_at": utc_now(), "chunk": chunk_index + 1, "record_count": len(chunk), "purpose": "Unique compact host-plant occurrence records."},
            "records": chunk,
        })
        occurrence_chunks[rel] = {"records": len(chunk)}

    occurrence_refs_by_taxon: dict[str, str] = {}
    for slug, chunk_map in refs_by_slug.items():
        rel = f"taxon_occurrence_refs/{file_slug(slug)}.json"
        total = sum(len(indexes) for indexes in chunk_map.values())
        write_json(output_dir / rel, {
            "metadata": {"generated_at": utc_now(), "host_taxon_slug": slug, "total_records": total, "purpose": "References from a host taxon to unique occurrence chunks."},
            "stats_by_slug": {slug: occurrence_stats_by_slug[slug]},
            "chunks": {chunk: indexes for chunk, indexes in sorted(chunk_map.items())},
        })
        occurrence_refs_by_taxon[slug] = rel

    gallery_indexes_by_taxon: dict[str, str] = {}
    preview_items: list[dict[str, Any]] = []
    preview_stats_by_slug: dict[str, dict[str, int]] = {}
    for slug, item_map in gallery_by_slug.items():
        items = sorted(item_map.values(), key=gallery_sort_key)[:MAX_GALLERY_ITEMS_PER_TAXON]
        taxon_dir = gallery_dir / file_slug(slug)
        taxon_dir.mkdir(parents=True, exist_ok=True)
        page_paths: list[str] = []
        for page_index in range(math.ceil(len(items) / GALLERY_PAGE_SIZE)):
            page_items = items[page_index * GALLERY_PAGE_SIZE:(page_index + 1) * GALLERY_PAGE_SIZE]
            rel = f"gallery_taxa/{file_slug(slug)}/page_{page_index + 1:03d}.json"
            write_json(output_dir / rel, {
                "metadata": {"generated_at": utc_now(), "host_taxon_slug": slug, "page": page_index + 1, "page_size": GALLERY_PAGE_SIZE, "item_count": len(page_items)},
                "items": page_items,
            })
            page_paths.append(rel)
        index_rel = f"gallery_taxa/{file_slug(slug)}/index.json"
        write_json(output_dir / index_rel, {
            "metadata": {"generated_at": utc_now(), "host_taxon_slug": slug, "purpose": "Paged image-only gallery index for a host taxon."},
            "stats_by_slug": {slug: gallery_stats[slug]},
            "total_images": len(items),
            "page_size": GALLERY_PAGE_SIZE,
            "pages": page_paths,
        })
        gallery_indexes_by_taxon[slug] = index_rel
        preview_by_context: dict[str, int] = defaultdict(int)
        for item in items:
            context = item.get("photo_context", "ambiguous")
            if preview_by_context[context] >= GALLERY_PREVIEW_PER_CATEGORY:
                continue
            preview_items.append(item)
            preview_by_context[context] += 1
        preview_stats_by_slug[slug] = {
            **gallery_stats[slug],
            "preview_records": sum(preview_by_context.values()),
            "preview_field": preview_by_context["field"],
            "preview_ambiguous": preview_by_context["ambiguous"],
            "preview_preserved": preview_by_context["preserved"],
        }

    gallery_preview_dataset = "host_plant_gallery_preview.json"
    write_json(output_dir / gallery_preview_dataset, {
        "metadata": {
            "generated_at": utc_now(),
            "purpose": "Fast host-plant gallery preview: up to 10 images per photo context per host taxon.",
            "preview_per_category": GALLERY_PREVIEW_PER_CATEGORY,
            "photo_context_order": PHOTO_CONTEXT_ORDER,
            "photo_contexts": {key: {"label": value["label"]} for key, value in PHOTO_CONTEXTS.items()},
            "item_count": len(preview_items),
        },
        "stats_by_slug": preview_stats_by_slug,
        "items": sorted(preview_items, key=lambda item: (item.get("scientific_name", ""), gallery_sort_key(item))),
    })

    metadata = manifest.setdefault("metadata", {})
    # v2 compact lazy-loading fields.
    metadata["occurrence_store_version"] = 2
    metadata["occurrence_chunk_size"] = OCCURRENCE_CHUNK_SIZE
    metadata["occurrence_chunks"] = occurrence_chunks
    metadata["occurrence_refs_by_taxon"] = occurrence_refs_by_taxon
    metadata["occurrence_ref_count"] = len(occurrence_refs_by_taxon)
    metadata["unique_occurrence_count"] = len(occurrence_records)
    metadata["gallery_page_size"] = GALLERY_PAGE_SIZE
    metadata["gallery_initial_limit"] = 10
    metadata["gallery_preview_dataset"] = gallery_preview_dataset
    metadata["gallery_preview_per_category"] = GALLERY_PREVIEW_PER_CATEGORY
    metadata["gallery_photo_context_order"] = PHOTO_CONTEXT_ORDER
    metadata["gallery_photo_contexts"] = {key: {"label": value["label"]} for key, value in PHOTO_CONTEXTS.items()}
    metadata["gallery_indexes_by_taxon"] = gallery_indexes_by_taxon
    metadata["gallery_index_count"] = len(gallery_indexes_by_taxon)
    # Disable old monolithic/current shard fields for v2 consumers; runtime keeps fallback support.
    metadata["occurrence_core_dataset"] = None
    metadata["occurrence_core_shards_by_taxon"] = {}
    metadata["occurrence_core_shard_strategy"] = "unique_occurrence_chunks_by_taxon_refs"
    metadata["gallery_dataset"] = None
    metadata["gallery_shards_by_taxon"] = {}
    metadata["gallery_shard_strategy"] = "paged_host_taxon_images"

    for taxon in manifest.get("taxa", []):
        slug = taxon.get("slug")
        if slug in occurrence_stats_by_slug:
            taxon["occurrence_count"] = occurrence_stats_by_slug[slug]["total_records"]
            taxon["occurrence_mode"] = "chunked_refs"
        if slug in gallery_stats:
            taxon["gallery_count"] = gallery_stats[slug]["records_with_images"]
            taxon["gallery_total_records"] = gallery_stats[slug]["total_records"]

    write_json(manifest_path, manifest, indent=2)
    return {
        "unique_occurrences": len(occurrence_records),
        "occurrence_refs": len(occurrence_refs_by_taxon),
        "gallery_indexes": len(gallery_indexes_by_taxon),
    }


def main() -> int:
    result = build_taxon_shards()
    print(
        "Wrote compact host plant lazy data: "
        f"{result['unique_occurrences']:,} unique occurrences, "
        f"{result['occurrence_refs']:,} taxon ref files, "
        f"{result['gallery_indexes']:,} gallery indexes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
