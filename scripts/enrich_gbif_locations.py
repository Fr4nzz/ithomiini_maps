#!/usr/bin/env python3
"""
Script to enrich GBIF records with location data from the GBIF API.

This script:
1. Reads map_points.json
2. Finds all GBIF records (where source == 'GBIF')
3. Fetches location data from GBIF API for each record
4. Adds location fields to the records
5. Saves the enriched data

Usage:
    python scripts/enrich_gbif_locations.py

The script will create a new file: public/data/map_points_enriched.json
Review the output and rename it to map_points.json if satisfied.
"""

import json
import requests
import time
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# GBIF API endpoint
GBIF_API_BASE = "https://api.gbif.org/v1/occurrence"

# Rate limiting settings
REQUESTS_PER_SECOND = 10
BATCH_SIZE = 50

def fetch_gbif_occurrence(gbif_id):
    """Fetch occurrence data from GBIF API."""
    try:
        url = f"{GBIF_API_BASE}/{gbif_id}"
        response = requests.get(url, timeout=30)

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404:
            return None
        else:
            print(f"  Warning: Got status {response.status_code} for ID {gbif_id}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"  Error fetching {gbif_id}: {e}")
        return None

def extract_location_fields(gbif_data):
    """Extract all relevant location fields from GBIF occurrence data."""
    if not gbif_data:
        return {}

    # All potential location-related fields from GBIF
    location_fields = {
        'locality': gbif_data.get('locality'),
        'verbatimLocality': gbif_data.get('verbatimLocality'),
        'stateProvince': gbif_data.get('stateProvince'),
        'county': gbif_data.get('county'),
        'municipality': gbif_data.get('municipality'),
        'waterBody': gbif_data.get('waterBody'),
        'island': gbif_data.get('island'),
        'islandGroup': gbif_data.get('islandGroup'),
        'continent': gbif_data.get('continent'),
        'higherGeography': gbif_data.get('higherGeography'),
        'locationRemarks': gbif_data.get('locationRemarks'),
        'habitat': gbif_data.get('habitat'),
        # Also grab some other potentially useful fields
        'recordedBy': gbif_data.get('recordedBy'),
        'identifiedBy': gbif_data.get('identifiedBy'),
        'eventDate': gbif_data.get('eventDate'),
        'year': gbif_data.get('year'),
        'month': gbif_data.get('month'),
        'day': gbif_data.get('day'),
    }

    # Remove None values
    return {k: v for k, v in location_fields.items() if v is not None}

def process_batch(records, progress_callback=None):
    """Process a batch of records and fetch their GBIF data."""
    results = []

    for i, record in enumerate(records):
        gbif_id = record.get('id')
        gbif_data = fetch_gbif_occurrence(gbif_id)
        location_fields = extract_location_fields(gbif_data)

        results.append({
            'id': gbif_id,
            'location_fields': location_fields
        })

        if progress_callback:
            progress_callback(i + 1, len(records))

        # Rate limiting
        time.sleep(1.0 / REQUESTS_PER_SECOND)

    return results

def main():
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    input_file = project_root / "public" / "data" / "map_points.json"
    output_file = project_root / "public" / "data" / "map_points_enriched.json"
    stats_file = project_root / "public" / "data" / "gbif_location_stats.json"

    print("=" * 60)
    print("GBIF Location Data Enrichment Script")
    print("=" * 60)

    # Load data
    print(f"\nLoading data from {input_file}...")
    with open(input_file, 'r') as f:
        data = json.load(f)

    print(f"Total records: {len(data)}")

    # Filter GBIF records
    gbif_records = [r for r in data if r.get('source') == 'GBIF']
    non_gbif_records = [r for r in data if r.get('source') != 'GBIF']

    print(f"GBIF records: {len(gbif_records)}")
    print(f"Non-GBIF records: {len(non_gbif_records)}")

    if not gbif_records:
        print("No GBIF records found. Exiting.")
        return

    # Check how many already have collection_location
    already_have_location = sum(1 for r in gbif_records if r.get('collection_location'))
    print(f"GBIF records already with location: {already_have_location}")

    # Ask for confirmation
    print(f"\nThis will fetch data from GBIF API for {len(gbif_records)} records.")
    print(f"Estimated time: {len(gbif_records) / REQUESTS_PER_SECOND / 60:.1f} minutes")

    response = input("\nProceed? (y/n): ").strip().lower()
    if response != 'y':
        print("Aborted.")
        return

    # Process records
    print("\nFetching GBIF data...")

    # Create a lookup for GBIF data
    gbif_location_data = {}
    field_stats = {}

    total = len(gbif_records)
    start_time = time.time()

    for i, record in enumerate(gbif_records):
        gbif_id = record.get('id')

        # Progress
        if (i + 1) % 100 == 0 or i == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (total - i - 1) / rate if rate > 0 else 0
            print(f"  Progress: {i + 1}/{total} ({(i + 1) / total * 100:.1f}%) - "
                  f"Rate: {rate:.1f}/s - ETA: {remaining / 60:.1f} min")

        # Fetch data
        gbif_data = fetch_gbif_occurrence(gbif_id)
        location_fields = extract_location_fields(gbif_data)

        gbif_location_data[str(gbif_id)] = location_fields

        # Track stats
        for field in location_fields:
            field_stats[field] = field_stats.get(field, 0) + 1

        # Rate limiting
        time.sleep(1.0 / REQUESTS_PER_SECOND)

    elapsed = time.time() - start_time
    print(f"\nCompleted in {elapsed / 60:.1f} minutes")

    # Print field statistics
    print("\n" + "=" * 60)
    print("LOCATION FIELD STATISTICS")
    print("=" * 60)
    print(f"{'Field':<25} {'Count':<10} {'Percentage':<10}")
    print("-" * 60)

    for field, count in sorted(field_stats.items(), key=lambda x: -x[1]):
        pct = count / len(gbif_records) * 100
        print(f"{field:<25} {count:<10} {pct:.1f}%")

    # Save stats
    stats = {
        'total_gbif_records': len(gbif_records),
        'field_counts': field_stats,
        'field_percentages': {k: v / len(gbif_records) * 100 for k, v in field_stats.items()}
    }

    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"\nStats saved to {stats_file}")

    # Update records with location data
    print("\nUpdating records with location data...")

    updated_records = []
    for record in data:
        if record.get('source') == 'GBIF':
            gbif_id = str(record.get('id'))
            location_fields = gbif_location_data.get(gbif_id, {})

            # Create updated record
            updated_record = record.copy()

            # Add all location fields with gbif_ prefix
            for field, value in location_fields.items():
                updated_record[f'gbif_{field}'] = value

            # Set collection_location to best available location
            # Priority: locality > verbatimLocality > stateProvince > county
            best_location = (
                location_fields.get('locality') or
                location_fields.get('verbatimLocality') or
                location_fields.get('stateProvince') or
                location_fields.get('county') or
                location_fields.get('municipality')
            )
            if best_location:
                updated_record['collection_location'] = best_location

            updated_records.append(updated_record)
        else:
            updated_records.append(record)

    # Save enriched data
    with open(output_file, 'w') as f:
        json.dump(updated_records, f, indent=2)

    print(f"\nEnriched data saved to {output_file}")

    # Summary
    enriched_count = sum(1 for r in updated_records
                        if r.get('source') == 'GBIF' and r.get('collection_location'))
    print(f"\nSummary:")
    print(f"  GBIF records with collection_location: {enriched_count}/{len(gbif_records)}")
    print(f"\nReview the output file and rename to map_points.json if satisfied:")
    print(f"  mv {output_file} {input_file}")

if __name__ == "__main__":
    main()
