#!/usr/bin/env python3
"""Report host-plant data size and duplicate occurrence references."""
from __future__ import annotations

import gzip
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data" / "host_plants"


def json_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    return sorted(path.rglob("*.json")) if path.exists() else []


def size(paths: list[Path]) -> tuple[int, int]:
    raw = 0
    gz = 0
    for path in paths:
        data = path.read_bytes()
        raw += len(data)
        gz += len(gzip.compress(data, compresslevel=9))
    return raw, gz


def mib(n: int) -> str:
    return f"{n / 1024 / 1024:.2f} MiB"


def main() -> int:
    groups = {
        "metadata": [DATA / "host_plant_layers_manifest.json", DATA / "host_plant_associations.json", DATA / "host_plant_taxa.json"],
        "occurrence_chunks": json_files(DATA / "occurrence_chunks"),
        "taxon_occurrence_refs": json_files(DATA / "taxon_occurrence_refs"),
        "gallery_taxa": json_files(DATA / "gallery_taxa"),
        "legacy_occurrence_taxa": json_files(DATA / "occurrence_taxa"),
        "legacy_family_core": sorted(DATA.glob("host_plant_occurrence_core_*.json")),
    }
    print("Host plant data size report")
    for name, paths in groups.items():
        paths = [p for p in paths if p.exists()]
        raw, gz = size(paths)
        print(f"{name:24s} {len(paths):6d} files  raw {mib(raw):>10s}  gzip {mib(gz):>10s}")

    ids = Counter()
    for path in json_files(DATA / "occurrence_chunks"):
        doc = json.loads(path.read_text(encoding="utf-8"))
        for record in doc.get("records", []):
            gbif_id = record.get("gbifID") or record.get("id")
            if gbif_id:
                ids[str(gbif_id)] += 1
    duplicate_rows = sum(count - 1 for count in ids.values() if count > 1)
    print(f"unique occurrence IDs: {len(ids):,}")
    print(f"duplicate occurrence rows in v2 chunks: {duplicate_rows:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
