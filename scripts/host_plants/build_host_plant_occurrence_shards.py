#!/usr/bin/env python3
"""Split compact host-plant occurrence records into family shards."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
HOST_PLANT_DIR = PROJECT_ROOT / "public" / "data" / "host_plants"
SHARD_PREFIX = "host_plant_occurrence_core"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_") or "unknown"


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def family_for_record(record: dict[str, Any], taxa_by_slug: dict[str, dict[str, Any]]) -> str:
    taxon = taxa_by_slug.get(record.get("host_taxon_slug"), {})
    return record.get("family") or record.get("host_family") or taxon.get("family") or "Unknown"


def build_occurrence_shards(output_dir: Path = HOST_PLANT_DIR) -> dict[str, Any]:
    manifest_path = output_dir / "host_plant_layers_manifest.json"
    manifest = load_json(manifest_path)
    core_name = manifest.get("metadata", {}).get("occurrence_core_dataset", "host_plant_occurrence_core.json")
    core = load_json(output_dir / core_name)
    taxa_by_slug = {taxon.get("slug"): taxon for taxon in manifest.get("taxa", [])}

    records_by_family: dict[str, list[dict[str, Any]]] = {}
    for record in core.get("records", []):
        family = family_for_record(record, taxa_by_slug)
        records_by_family.setdefault(family, []).append(record)

    shard_map: dict[str, str] = {}
    shard_stats: dict[str, dict[str, Any]] = {}
    for family, records in sorted(records_by_family.items()):
        filename = f"{SHARD_PREFIX}_{slugify(family)}.json"
        stats_by_slug: dict[str, dict[str, int]] = {}
        for record in records:
            slug = record.get("host_taxon_slug")
            if not slug:
                continue
            stats = stats_by_slug.setdefault(slug, {"total_records": 0})
            stats["total_records"] += 1
        shard = {
            "metadata": {
                "generated_at": utc_now(),
                "family": family,
                "source_occurrence_core_dataset": core_name,
                "total_records": len(records),
            },
            "stats_by_slug": stats_by_slug,
            "records": records,
        }
        write_json(output_dir / filename, shard)
        shard_map[family] = filename
        shard_stats[family] = {"file": filename, "records": len(records), "taxa": len(stats_by_slug)}

    metadata = manifest.setdefault("metadata", {})
    metadata["occurrence_core_dataset"] = None
    metadata["occurrence_core_shards"] = shard_map
    metadata["occurrence_core_shard_stats"] = shard_stats
    metadata["occurrence_core_shard_strategy"] = "family"
    write_json(manifest_path, manifest)
    return {"shards": shard_stats, "manifest": str(manifest_path)}


def main() -> int:
    result = build_occurrence_shards()
    for family, stats in result["shards"].items():
        print(f"{family}: {stats['records']} records -> {stats['file']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
