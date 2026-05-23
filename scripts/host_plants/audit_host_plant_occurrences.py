#!/usr/bin/env python3
"""Write a compact audit report for host-plant associations and mapped occurrences."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
HOST_PLANT_DIR = PROJECT_ROOT / "public" / "data" / "host_plants"


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def build_audit(output_dir: Path = HOST_PLANT_DIR) -> dict[str, Any]:
    manifest = load_json(output_dir / "host_plant_layers_manifest.json")
    taxa_doc = load_json(output_dir / "host_plant_taxa.json")
    associations_doc = load_json(output_dir / "host_plant_associations.json")
    occurrence_name = manifest.get("metadata", {}).get("occurrence_dataset", "host_plant_occurrences.json")
    occurrences = load_json(output_dir / occurrence_name)

    taxa = taxa_doc.get("taxa", [])
    associations = associations_doc.get("associations", [])
    features = occurrences.get("features", [])
    taxa_by_slug = {taxon.get("slug"): taxon for taxon in taxa}

    associations_by_rank_confidence: Counter[tuple[str, str]] = Counter()
    for association in associations:
        taxon = taxa_by_slug.get(association.get("host_taxon_slug"), {})
        rank = taxon.get("rank") or association.get("host_taxon_rank") or "unknown"
        confidence = association.get("confidence_bucket") or association.get("confidence") or "unknown"
        associations_by_rank_confidence[(rank, confidence)] += 1

    occurrences_by_slug: Counter[str] = Counter()
    for feature in features:
        slug = feature.get("properties", {}).get("host_taxon_slug")
        if slug:
            occurrences_by_slug[slug] += 1

    unresolved = [
        {
            "slug": taxon.get("slug"),
            "name": taxon.get("canonical_name"),
            "rank": taxon.get("rank"),
            "gbif_status": taxon.get("gbif_status"),
            "note": (taxon.get("gbif_resolution") or {}).get("note"),
        }
        for taxon in taxa
        if taxon.get("resolvable_to_gbif") and not taxon.get("gbif_taxon_key")
    ]

    suppressed = (
        manifest.get("metadata", {})
        .get("download_request", {})
        .get("suppressed_species_downloads", {})
    )

    mapped_taxa = [
        {
            "slug": slug,
            "name": taxa_by_slug.get(slug, {}).get("canonical_name", slug),
            "rank": taxa_by_slug.get(slug, {}).get("rank"),
            "occurrence_count": count,
        }
        for slug, count in occurrences_by_slug.most_common()
    ]

    return {
        "metadata": {
            "occurrence_dataset": occurrence_name,
            "association_count": len(associations),
            "host_taxon_count": len(taxa),
            "mapped_occurrence_count": len(features),
        },
        "associations_by_rank_confidence": {
            f"{rank}:{confidence}": count
            for (rank, confidence), count in sorted(associations_by_rank_confidence.items())
        },
        "mapped_occurrences_by_host_taxon": mapped_taxa,
        "unresolved_or_skipped_taxa": unresolved,
        "suppressed_species_downloads": suppressed,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=HOST_PLANT_DIR / "host_plant_occurrence_audit.json",
        help="Path for the JSON audit report.",
    )
    args = parser.parse_args()
    audit = build_audit()
    write_json(args.output, audit)
    print(f"Wrote host plant occurrence audit: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
