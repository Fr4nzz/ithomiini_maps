#!/usr/bin/env python3
"""
Taxonomic Name Curation Pipeline
=================================
Validates and curates taxonomic names in the Ithomiini dataset against the
GBIF Backbone Taxonomy (built on the Catalogue of Life).

Methodology follows Grenié et al. (2023) best practices for taxonomic
harmonization:
  1. Bulk-fetch all Ithomiini taxa from GBIF backbone (one request per genus)
  2. Build local lookup cache for species/subspecies/synonyms
  3. Match dataset names against local cache (zero API calls)
  4. Targeted API fallback only for unresolved names (fuzzy matching)
  5. Flag problematic records for expert review

Usage:
  python scripts/taxonomic_curation.py                    # Curate (report only)
  python scripts/taxonomic_curation.py --apply            # Curate and apply
  python scripts/taxonomic_curation.py --input data.xlsx  # External file
  python scripts/taxonomic_curation.py --test             # Test subset
  python scripts/taxonomic_curation.py --rebuild-cache    # Force rebuild
"""

import time
import argparse
import logging

from curation.config import CURATION_REPORT
from curation.corrections import load_corrections, load_sanger_taxonomy
from curation.classify import extract_unique_names
from curation.gbif import load_or_build_cache
from curation.curate import curate_name
from curation.apply import load_data, apply_corrections
from curation.report import (
    assess_data_quality, print_quality_report,
    print_curation_summary, save_report,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Taxonomic name curation for Ithomiini dataset"
    )
    parser.add_argument("--input", "-i", type=str, default=None,
                        help="Input file (CSV, TSV, Excel, JSON)")
    parser.add_argument("--output", "-o", type=str, default=None,
                        help="Output file for curated data")
    parser.add_argument("--test", action="store_true",
                        help="Run on a test subset")
    parser.add_argument("--limit", type=int, default=50,
                        help="Max names in test mode (default: 50)")
    parser.add_argument("--report-only", action="store_true",
                        help="Only run data quality assessment")
    parser.add_argument("--rebuild-cache", action="store_true",
                        help="Force rebuild of GBIF taxonomy cache")
    parser.add_argument("--apply", action="store_true",
                        help="Apply corrections and write curated dataset")
    parser.add_argument("--corrections", type=str, default=None,
                        help="Path to custom corrections JSON file")
    args = parser.parse_args()

    # Load correction tables and Sanger taxonomy
    correction_tables = load_corrections(args.corrections)
    sanger_species = load_sanger_taxonomy()

    # Load data
    records, preset, input_path = load_data(args.input)

    # Step 1: Data quality assessment
    log.info("Running data quality assessment...")
    quality = assess_data_quality(records)
    print_quality_report(quality)

    if args.report_only:
        return

    # Step 2: Build/load GBIF taxonomy cache
    cache = load_or_build_cache(records, force_rebuild=args.rebuild_cache)

    # Step 3: Extract unique names
    limit = args.limit if args.test else None
    names = extract_unique_names(records, limit=limit)
    log.info(f"Extracted {len(names)} unique name combinations to curate")
    if not names:
        log.warning("No names to curate")
        return

    # Step 4: Curate each name
    ctx = {"api_call_count": 0}
    results = []
    total = len(names)
    start_time = time.time()

    print(f"\nCurating {total} names against GBIF backbone (cache-first)...")
    print("-" * 70)

    for i, name in enumerate(names):
        if (i + 1) % 100 == 0 or i == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            log.info(
                f"[{i+1}/{total}] Processing: {name['scientific_name']}"
                f" ({rate:.1f} names/sec, API calls: {ctx['api_call_count']})"
            )
        result = curate_name(name, cache, correction_tables, sanger_species, ctx)
        results.append(result)

    elapsed = time.time() - start_time
    log.info(
        f"Curation complete in {elapsed:.1f}s "
        f"({len(results)/elapsed:.1f} names/sec, "
        f"{ctx['api_call_count']} API calls)"
    )

    # Step 5: Report
    print_curation_summary(results, cache, ctx["api_call_count"])
    save_report(quality, results, cache, ctx["api_call_count"])

    # Step 6: Actionable items
    needs_review = [
        r for r in results
        if r["status"] in ("higher_rank_only", "api_error", "not_found")
    ]
    if needs_review:
        print("=" * 70)
        print(f"ACTION NEEDED: {len(needs_review)} names require expert review")
        print("=" * 70)
        print(f"See full report: {CURATION_REPORT}")
    else:
        print("All names processed. See report for details.")

    # Step 7: Apply corrections if requested
    if args.apply:
        apply_corrections(records, results, correction_tables, sanger_species,
                          input_path=input_path, output_file=args.output,
                          preset=preset)


if __name__ == "__main__":
    main()
