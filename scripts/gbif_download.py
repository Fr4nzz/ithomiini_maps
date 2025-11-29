#!/usr/bin/env python3
"""
GBIF Ithomiini Download Script
==============================
Downloads ALL Ithomiini occurrences from GBIF with proper field parsing.

Key Features:
- Downloads complete tribe Ithomiini dataset
- Properly parses species names (removes author citations)
- Extracts subspecies from infraspecificEpithet (not taxonomicStatus!)
- Includes basisOfRecord for quality filtering
- Extracts media/images where available
- Handles pagination for large datasets

Usage:
    python scripts/gbif_download.py

Output:
    public/data/gbif_occurrences.json
"""

import requests
import json
import re
import os
import time
from datetime import datetime

# Configuration
ITHOMIINI_TAXON_KEY = 5568  # GBIF taxonKey for tribe Ithomiini
OUTPUT_FILE = "public/data/gbif_occurrences.json"
BATCH_SIZE = 300  # GBIF max per request
MAX_RECORDS = 50000  # Safety limit (adjust as needed)
REQUEST_DELAY = 0.3  # Seconds between requests to be polite

# Quality filters
REQUIRE_COORDINATES = True
EXCLUDE_GEOSPATIAL_ISSUES = True


def clean_scientific_name(name):
    """
    Remove author citations from scientific names.
    
    Examples:
    - "Pteronymia ticida (Hewitson, 1869)" -> "Pteronymia ticida"
    - "Mechanitis polymnia Linnaeus, 1758" -> "Mechanitis polymnia"
    - "Melinaea ludovica lilis (Reakirt, 1866)" -> "Melinaea ludovica lilis"
    
    Also handles BOLD sequence IDs that shouldn't be species names.
    """
    if not name:
        return None
    
    name = str(name).strip()
    
    # Skip BOLD sequence IDs and other non-species identifiers
    if name.startswith('BOLD:') or name.startswith('SAMN') or re.match(r'^[A-Z]{2,}\d+', name):
        return None
    
    # Remove author citation patterns:
    # 1. Parenthetical: (Author, Year)
    # 2. Non-parenthetical: Author, Year
    # 3. Also handle Author Year without comma
    
    # Pattern 1: Remove (Author, Year) or (Author & Author, Year)
    name = re.sub(r'\s*\([A-Z][a-zA-Z&\s\.\-]+,?\s*\d{4}\)', '', name)
    
    # Pattern 2: Remove Author, Year at end (but keep subspecies)
    name = re.sub(r'\s+[A-Z][a-zA-Z&\s\.\-]+,\s*\d{4}$', '', name)
    
    # Pattern 3: Handle "Author Year" without comma
    name = re.sub(r'\s+[A-Z][a-zA-Z]+\s+\d{4}$', '', name)
    
    # Clean up any double spaces
    name = ' '.join(name.split())
    
    # Validate: should have at least genus + species
    parts = name.split()
    if len(parts) < 2:
        return None
    
    # First word should be capitalized (genus), second lowercase (species)
    if not (parts[0][0].isupper() and parts[1][0].islower()):
        return None
    
    return name


def extract_species_parts(record):
    """
    Extract genus, species epithet, and subspecies from GBIF record.
    
    Uses GBIF's parsed fields when available, falls back to parsing scientificName.
    """
    genus = record.get('genus', '')
    specific_epithet = record.get('specificEpithet', '')
    infraspecific = record.get('infraspecificEpithet')  # Actual subspecies field
    
    # Build scientific_name from parsed fields if available
    if genus and specific_epithet:
        scientific_name = f"{genus} {specific_epithet}"
    else:
        # Fallback: use 'species' field or clean scientificName
        scientific_name = record.get('species')
        if not scientific_name:
            scientific_name = clean_scientific_name(record.get('scientificName'))
        
        if scientific_name:
            parts = scientific_name.split()
            genus = parts[0] if parts else ''
            specific_epithet = parts[1] if len(parts) > 1 else ''
            # Check if there's a subspecies in the name
            if len(parts) > 2 and not infraspecific:
                infraspecific = ' '.join(parts[2:])
    
    # Clean subspecies
    if infraspecific:
        infraspecific = str(infraspecific).strip()
        # Remove if it's actually a taxonomic status
        if infraspecific.upper() in ['ACCEPTED', 'SYNONYM', 'DOUBTFUL', 'UNKNOWN', 'NA']:
            infraspecific = None
    
    return {
        'genus': genus if genus else 'Unknown',
        'species_epithet': specific_epithet if specific_epithet else 'sp.',
        'subspecies': infraspecific,
        'scientific_name': f"{genus} {specific_epithet}" if genus and specific_epithet else None
    }


def get_image_url(record):
    """Extract first image URL from GBIF media field."""
    media = record.get('media', [])
    for m in media:
        if m.get('type') == 'StillImage':
            url = m.get('identifier')
            if url:
                return url
    return None


def fetch_all_ithomiini():
    """
    Fetch all Ithomiini occurrences from GBIF using pagination.
    """
    base_url = "https://api.gbif.org/v1/occurrence/search"
    
    params = {
        'taxonKey': ITHOMIINI_TAXON_KEY,
        'hasCoordinate': str(REQUIRE_COORDINATES).lower(),
        'hasGeospatialIssue': str(not EXCLUDE_GEOSPATIAL_ISSUES).lower(),
        'limit': BATCH_SIZE,
        'offset': 0,
    }
    
    all_records = []
    
    # First request to get total count
    print(f"Querying GBIF for tribe Ithomiini (taxonKey={ITHOMIINI_TAXON_KEY})...")
    
    try:
        response = requests.get(base_url, params={**params, 'limit': 0}, timeout=30)
        response.raise_for_status()
        total = response.json().get('count', 0)
        print(f"Total records available: {total:,}")
        
        if total > MAX_RECORDS:
            print(f"WARNING: Limiting download to {MAX_RECORDS:,} records")
            total = MAX_RECORDS
        
    except Exception as e:
        print(f"Error querying GBIF: {e}")
        return []
    
    # Paginate through results
    offset = 0
    batch_num = 0
    
    while offset < total:
        batch_num += 1
        params['offset'] = offset
        
        try:
            print(f"  Batch {batch_num}: fetching records {offset+1:,} - {min(offset+BATCH_SIZE, total):,}...")
            response = requests.get(base_url, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            results = data.get('results', [])
            if not results:
                break
            
            # Process each record
            for rec in results:
                processed = process_record(rec)
                if processed:
                    all_records.append(processed)
            
            offset += BATCH_SIZE
            
            # Rate limiting
            time.sleep(REQUEST_DELAY)
            
        except Exception as e:
            print(f"  Error fetching batch: {e}")
            time.sleep(2)  # Longer wait on error
            continue
    
    print(f"\nTotal records processed: {len(all_records):,}")
    return all_records


def process_record(rec):
    """
    Process a single GBIF occurrence record into our format.
    """
    # Extract taxonomy
    parts = extract_species_parts(rec)
    
    # Skip records without valid scientific name
    if not parts['scientific_name']:
        return None
    
    # Skip records without coordinates (double-check)
    lat = rec.get('decimalLatitude')
    lng = rec.get('decimalLongitude')
    if lat is None or lng is None:
        return None
    
    # Get image if available
    image_url = get_image_url(rec)
    
    return {
        'id': str(rec.get('gbifID', rec.get('key', ''))),
        'scientific_name': parts['scientific_name'],
        'genus': parts['genus'],
        'species': parts['species_epithet'],
        'subspecies': parts['subspecies'],
        'family': rec.get('family', 'Nymphalidae'),
        'tribe': 'Ithomiini',
        'lat': lat,
        'lng': lng,
        'mimicry_ring': 'Unknown',  # Will be filled by process_data.py from Dore lookup
        'sequencing_status': rec.get('basisOfRecord', 'Observation'),
        'source': 'GBIF',
        'image_url': image_url,
        'country': rec.get('country'),
        # Additional GBIF-specific fields for filtering
        'basis_of_record': rec.get('basisOfRecord'),
        'dataset_name': rec.get('datasetName'),
        'collection_date': rec.get('eventDate'),
        'coordinate_uncertainty': rec.get('coordinateUncertaintyInMeters'),
        'institution_code': rec.get('institutionCode'),
    }


def main():
    print("=" * 70)
    print("GBIF ITHOMIINI DOWNLOAD")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    # Fetch all records
    records = fetch_all_ithomiini()
    
    if not records:
        print("\nNo records fetched. Exiting.")
        return
    
    # Statistics
    print("\n" + "=" * 70)
    print("DOWNLOAD STATISTICS")
    print("=" * 70)
    
    # Count by basis of record
    basis_counts = {}
    for r in records:
        basis = r.get('basis_of_record', 'Unknown')
        basis_counts[basis] = basis_counts.get(basis, 0) + 1
    
    print("\nBy Basis of Record (for quality filtering):")
    for k, v in sorted(basis_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v:,}")
    
    # Count with images
    with_images = sum(1 for r in records if r.get('image_url'))
    print(f"\nRecords with images: {with_images:,}")
    
    # Unique species
    species_set = set(r['scientific_name'] for r in records if r['scientific_name'])
    print(f"Unique species: {len(species_set):,}")
    
    # With subspecies
    with_subsp = sum(1 for r in records if r.get('subspecies'))
    print(f"Records with subspecies: {with_subsp:,}")
    
    # Save to file
    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False)
    
    file_size = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"File size: {file_size:.2f} MB")
    
    print("\n" + "=" * 70)
    print("DOWNLOAD COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Run `python scripts/process_data.py` to merge with other sources")
    print("2. GBIF records will have mimicry rings applied from Dore database")
    print("\nQuality tips:")
    print("- HUMAN_OBSERVATION records are similar to 'Research Grade' on iNaturalist")
    print("- PRESERVED_SPECIMEN records are museum specimens")
    print("- Filter in the app by 'Observation' status to see citizen science data")


if __name__ == "__main__":
    main()
