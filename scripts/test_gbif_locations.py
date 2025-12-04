#!/usr/bin/env python3
"""
Quick test script to sample GBIF records and show available location fields.

This script fetches data for just 20 sample GBIF records to show you
what location fields are available before running the full enrichment.

Usage:
    python scripts/test_gbif_locations.py
"""

import json
import requests
import time
import random
from pathlib import Path

GBIF_API_BASE = "https://api.gbif.org/v1/occurrence"

def fetch_gbif_occurrence(gbif_id):
    """Fetch occurrence data from GBIF API."""
    try:
        url = f"{GBIF_API_BASE}/{gbif_id}"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None

def main():
    # Load data
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    input_file = project_root / "public" / "data" / "map_points.json"

    print("Loading data...")
    with open(input_file, 'r') as f:
        data = json.load(f)

    # Get GBIF records
    gbif_records = [r for r in data if r.get('source') == 'GBIF']
    print(f"Total GBIF records: {len(gbif_records)}")

    # Sample 20 random records
    sample_size = min(20, len(gbif_records))
    sample = random.sample(gbif_records, sample_size)

    print(f"\nFetching data for {sample_size} sample records...\n")

    # Location fields to check
    location_fields = [
        'locality', 'verbatimLocality', 'stateProvince', 'county',
        'municipality', 'waterBody', 'island', 'islandGroup',
        'continent', 'higherGeography', 'locationRemarks', 'habitat'
    ]

    field_examples = {field: [] for field in location_fields}
    field_counts = {field: 0 for field in location_fields}

    for i, record in enumerate(sample):
        gbif_id = record.get('id')
        species = record.get('scientific_name', 'Unknown')
        country = record.get('country', 'Unknown')

        print(f"[{i+1}/{sample_size}] Fetching ID: {gbif_id} ({species}, {country})")

        gbif_data = fetch_gbif_occurrence(gbif_id)

        if gbif_data:
            for field in location_fields:
                value = gbif_data.get(field)
                if value:
                    field_counts[field] += 1
                    if len(field_examples[field]) < 3:
                        field_examples[field].append({
                            'id': gbif_id,
                            'species': species,
                            'country': country,
                            'value': value[:100] + '...' if len(str(value)) > 100 else value
                        })

        time.sleep(0.2)  # Rate limiting

    # Print results
    print("\n" + "=" * 70)
    print("LOCATION FIELD AVAILABILITY (from sample)")
    print("=" * 70)

    for field in location_fields:
        count = field_counts[field]
        pct = count / sample_size * 100
        print(f"\n{field}: {count}/{sample_size} ({pct:.0f}%)")

        if field_examples[field]:
            print("  Examples:")
            for ex in field_examples[field]:
                print(f"    - [{ex['country']}] {ex['value']}")

    # Recommendation
    print("\n" + "=" * 70)
    print("RECOMMENDATION")
    print("=" * 70)

    best_fields = sorted(field_counts.items(), key=lambda x: -x[1])
    print("\nBest fields to use for collection_location (by availability):")
    for field, count in best_fields[:5]:
        if count > 0:
            pct = count / sample_size * 100
            print(f"  {field}: {pct:.0f}% available")

    print("\nThe full enrichment script will use this priority:")
    print("  locality > verbatimLocality > stateProvince > county > municipality")
    print("\nRun the full enrichment with:")
    print("  python scripts/enrich_gbif_locations.py")

if __name__ == "__main__":
    main()
