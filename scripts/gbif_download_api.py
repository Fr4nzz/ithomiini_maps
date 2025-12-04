#!/usr/bin/env python3
"""
GBIF Ithomiini Download API Script
===================================
Downloads ALL Ithomiini occurrences from GBIF using the async Download API.

This provides:
- Complete, citable datasets with DOI
- Research-grade quality filters
- Separation of iNaturalist records as distinct source
- Proper observation URLs for each record

Usage:
    python scripts/gbif_download_api.py           # Normal run (uses cache if recent)
    python scripts/gbif_download_api.py --force   # Force new download
    python scripts/gbif_download_api.py --keys-only  # Just get taxon keys

Output:
    public/data/gbif_occurrences.json  - Occurrence data
    public/data/gbif_citation.json     - Citation/DOI info
    public/data/gbif_taxon_keys.json   - Cached taxon keys
"""

import requests
import json
import os
import sys
import time
import zipfile
import csv
import re
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

PROJECT_ROOT = Path(__file__).parent.parent
CREDENTIALS_FILE = PROJECT_ROOT / "gbif_credentials.env"
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"
TEMP_DIR = PROJECT_ROOT / "temp_gbif_download"

OUTPUT_FILE = OUTPUT_DIR / "gbif_occurrences.json"
CITATION_FILE = OUTPUT_DIR / "gbif_citation.json"
TAXON_KEYS_FILE = OUTPUT_DIR / "gbif_taxon_keys.json"

# Cache duration - skip new download if citation is less than this old
CACHE_DAYS = 30

# Polling interval for download status
POLL_INTERVAL_SECONDS = 30
MAX_POLL_ATTEMPTS = 120  # 60 minutes max wait

# iNaturalist Research-grade dataset key
INATURALIST_DATASET_KEY = "50c9509d-22c7-4a22-a47d-8c48425ef4a7"

# All Ithomiini genera (from Dore et al. database)
ITHOMIINI_GENERA = [
    'Aeria', 'Athesis', 'Athyrtis', 'Brevioleria', 'Callithomia', 'Ceratinia',
    'Dircenna', 'Elzunia', 'Episcada', 'Epityches', 'Eutresis', 'Forbestra',
    'Godyris', 'Greta', 'Haenschia', 'Heterosais', 'Hyalenna', 'Hyalyris',
    'Hypoleria', 'Hypomenitis', 'Hyposcada', 'Hypothyris', 'Ithomia',
    'Mcclungia', 'Mechanitis', 'Megoleria', 'Melinaea', 'Methona',
    'Napeogenes', 'Oleria', 'Ollantaya', 'Olyras', 'Pachacutia', 'Pagyris',
    'Paititia', 'Patricia', 'Placidina', 'Pseudoscada', 'Pteronymia', 'Sais',
    'Scada', 'Thyridia', 'Tithorea', 'Veladyris', 'Velamysta'
]


# ═══════════════════════════════════════════════════════════════════
# CREDENTIALS
# ═══════════════════════════════════════════════════════════════════

def load_credentials():
    """Load GBIF credentials from env file."""
    if not CREDENTIALS_FILE.exists():
        print(f"ERROR: Credentials file not found: {CREDENTIALS_FILE}")
        print("Create gbif_credentials.env with:")
        print("  GBIF_USERNAME=your_username")
        print("  GBIF_PASSWORD=your_password")
        print("  GBIF_EMAIL=your_email")
        sys.exit(1)

    credentials = {}
    with open(CREDENTIALS_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                credentials[key.strip()] = value.strip()

    required = ['GBIF_USERNAME', 'GBIF_PASSWORD', 'GBIF_EMAIL']
    for key in required:
        if key not in credentials:
            print(f"ERROR: Missing {key} in credentials file")
            sys.exit(1)

    return credentials


# ═══════════════════════════════════════════════════════════════════
# TAXON KEY LOOKUP
# ═══════════════════════════════════════════════════════════════════

def get_genus_taxon_key(genus_name):
    """Look up the GBIF taxon key for a genus."""
    try:
        match_url = "https://api.gbif.org/v1/species/match"
        params = {
            'name': genus_name,
            'rank': 'GENUS',
            'kingdom': 'Animalia',
            'class': 'Insecta',
            'order': 'Lepidoptera',
            'family': 'Nymphalidae'
        }
        response = requests.get(match_url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        # Verify it's in Nymphalidae
        if data.get('family') == 'Nymphalidae' and data.get('matchType') != 'NONE':
            return data.get('usageKey')
        return None
    except Exception as e:
        print(f"    Error looking up {genus_name}: {e}")
        return None


def get_all_taxon_keys(use_cache=True):
    """Get taxon keys for all Ithomiini genera."""
    # Try to load from cache
    if use_cache and TAXON_KEYS_FILE.exists():
        try:
            with open(TAXON_KEYS_FILE, 'r') as f:
                cached = json.load(f)
            if cached.get('genera') and len(cached['genera']) > 0:
                print(f"Loaded {len(cached['genera'])} taxon keys from cache")
                return cached['genera']
        except Exception as e:
            print(f"Cache load failed: {e}")

    print(f"Looking up taxon keys for {len(ITHOMIINI_GENERA)} genera...")
    genera_keys = {}

    for i, genus in enumerate(ITHOMIINI_GENERA, 1):
        print(f"  [{i}/{len(ITHOMIINI_GENERA)}] {genus}...", end=" ")
        key = get_genus_taxon_key(genus)
        if key:
            genera_keys[genus] = key
            print(f"key={key}")
        else:
            print("not found")
        time.sleep(0.2)  # Be polite

    # Save to cache
    cache_data = {
        'created': datetime.now().isoformat(),
        'genera': genera_keys
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(TAXON_KEYS_FILE, 'w') as f:
        json.dump(cache_data, f, indent=2)

    print(f"\nFound {len(genera_keys)} genera with taxon keys")
    return genera_keys


# ═══════════════════════════════════════════════════════════════════
# DOWNLOAD API
# ═══════════════════════════════════════════════════════════════════

def submit_download_request(credentials, taxon_keys):
    """Submit async download request to GBIF."""
    print("\nSubmitting download request to GBIF...")

    # Build predicate
    predicate = {
        "type": "and",
        "predicates": [
            # Taxon filter - all Ithomiini genera
            {
                "type": "in",
                "key": "TAXON_KEY",
                "values": list(taxon_keys.values())
            },
            # Quality filters
            {"type": "equals", "key": "HAS_COORDINATE", "value": "true"},
            {"type": "equals", "key": "HAS_GEOSPATIAL_ISSUE", "value": "false"},
            {"type": "equals", "key": "OCCURRENCE_STATUS", "value": "PRESENT"},
            # Exclude fossils and living specimens
            {
                "type": "not",
                "predicate": {
                    "type": "in",
                    "key": "BASIS_OF_RECORD",
                    "values": ["FOSSIL_SPECIMEN", "LIVING_SPECIMEN"]
                }
            }
        ]
    }

    request_body = {
        "creator": credentials['GBIF_USERNAME'],
        "notificationAddresses": [credentials['GBIF_EMAIL']],
        "sendNotification": True,
        "format": "DWCA",
        "predicate": predicate
    }

    url = "https://api.gbif.org/v1/occurrence/download/request"

    try:
        response = requests.post(
            url,
            json=request_body,
            auth=(credentials['GBIF_USERNAME'], credentials['GBIF_PASSWORD']),
            headers={'Content-Type': 'application/json'},
            timeout=60
        )
        response.raise_for_status()

        download_key = response.text.strip()
        print(f"Download request submitted: {download_key}")
        return download_key

    except requests.exceptions.HTTPError as e:
        print(f"ERROR: Failed to submit download request")
        print(f"Status: {e.response.status_code}")
        print(f"Response: {e.response.text}")
        sys.exit(1)


def wait_for_download(download_key, credentials):
    """Poll until download is ready."""
    print(f"\nWaiting for download to complete...")
    url = f"https://api.gbif.org/v1/occurrence/download/{download_key}"

    for attempt in range(MAX_POLL_ATTEMPTS):
        try:
            response = requests.get(
                url,
                auth=(credentials['GBIF_USERNAME'], credentials['GBIF_PASSWORD']),
                timeout=30
            )
            response.raise_for_status()
            data = response.json()

            status = data.get('status')
            print(f"  [{attempt+1}] Status: {status}", end="")

            if status == 'SUCCEEDED':
                print(" - Download ready!")
                return data
            elif status in ['FAILED', 'KILLED', 'CANCELLED']:
                print(f"\nERROR: Download {status}")
                sys.exit(1)
            else:
                print(f" (waiting {POLL_INTERVAL_SECONDS}s...)")
                time.sleep(POLL_INTERVAL_SECONDS)

        except Exception as e:
            print(f"\n  Error checking status: {e}")
            time.sleep(POLL_INTERVAL_SECONDS)

    print("\nERROR: Timed out waiting for download")
    sys.exit(1)


def download_and_extract(download_info):
    """Download and extract the ZIP file (DWCA format)."""
    download_link = download_info.get('downloadLink')
    if not download_link:
        print("ERROR: No download link in response")
        sys.exit(1)

    print(f"\nDownloading from: {download_link}")

    # Create temp directory
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = TEMP_DIR / "gbif_download.zip"

    # Download with progress
    try:
        response = requests.get(download_link, stream=True, timeout=600)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0

        with open(zip_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    pct = downloaded * 100 / total_size
                    print(f"\r  Downloaded: {downloaded/1024/1024:.1f} MB ({pct:.1f}%)", end="")

        print(f"\n  Download complete: {zip_path}")

    except Exception as e:
        print(f"\nERROR downloading: {e}")
        sys.exit(1)

    # Extract
    print("  Extracting...")
    extract_dir = TEMP_DIR / "extracted"
    extract_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(extract_dir)

    # DWCA format contains occurrence.txt and multimedia.txt
    occurrence_file = extract_dir / "occurrence.txt"
    multimedia_file = extract_dir / "multimedia.txt"

    if not occurrence_file.exists():
        print("ERROR: occurrence.txt not found in download")
        sys.exit(1)

    print(f"  Occurrence file: {occurrence_file.name}")
    if multimedia_file.exists():
        print(f"  Multimedia file: {multimedia_file.name}")
    else:
        print("  No multimedia file found (some records may lack images)")

    return extract_dir


# ═══════════════════════════════════════════════════════════════════
# DATA PROCESSING
# ═══════════════════════════════════════════════════════════════════

def clean_scientific_name(name):
    """Remove author citations from scientific names."""
    if not name:
        return None

    name = str(name).strip()

    # Skip BOLD sequence IDs
    if name.startswith('BOLD:') or re.match(r'^[A-Z]{2,}\d+', name):
        return None

    # Remove author citations
    name = re.sub(r'\s*\([A-Z][a-zA-Z&\s\.\-]+,?\s*\d{4}\)', '', name)
    name = re.sub(r'\s+[A-Z][a-zA-Z&\s\.\-]+,\s*\d{4}$', '', name)
    name = re.sub(r'\s+[A-Z][a-zA-Z]+\s+\d{4}$', '', name)

    name = ' '.join(name.split())

    parts = name.split()
    if len(parts) < 2:
        return None

    if not (parts[0][0].isupper() and parts[1][0].islower()):
        return None

    return name


def load_multimedia_lookup(extract_dir):
    """
    Load multimedia.txt and create lookup: gbifID -> image_url.
    Returns dict mapping gbifID to first StillImage URL.
    """
    multimedia_path = extract_dir / "multimedia.txt"

    if not multimedia_path.exists():
        print("  No multimedia.txt found - images will not be available")
        return {}

    print("  Loading multimedia data...")
    lookup = {}
    count = 0

    with open(multimedia_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')

        for row in reader:
            count += 1
            gbif_id = row.get('gbifID')
            media_type = row.get('type', '')
            identifier = row.get('identifier', '')

            # Only keep StillImage, skip audio/video
            if gbif_id and 'StillImage' in media_type and identifier:
                # Keep first image per gbifID
                if gbif_id not in lookup:
                    lookup[gbif_id] = identifier

    print(f"  Processed {count:,} multimedia records")
    print(f"  Found images for {len(lookup):,} occurrences")
    return lookup


def get_observation_url(record):
    """Build the observation URL for a record."""
    gbif_id = record.get('gbifID', '')
    occurrence_id = record.get('occurrenceID', '') or ''
    references = record.get('references', '') or ''
    institution = record.get('institutionCode', '') or ''
    dataset_key = record.get('datasetKey', '') or ''

    # iNaturalist detection
    is_inaturalist = (
        dataset_key == INATURALIST_DATASET_KEY or
        institution.lower() == 'inaturalist' or
        'inaturalist.org' in occurrence_id.lower()
    )

    if is_inaturalist:
        # Try to extract iNaturalist observation ID
        if occurrence_id.startswith('https://www.inaturalist.org/observations/'):
            return occurrence_id

        # Try to extract ID from URL
        match = re.search(r'inaturalist\.org/observations/(\d+)', occurrence_id)
        if match:
            return f"https://www.inaturalist.org/observations/{match.group(1)}"

        # Check if it's just a number
        if occurrence_id.isdigit():
            return f"https://www.inaturalist.org/observations/{occurrence_id}"

        # Try URN format: urn:catalog:iNaturalist:Observation:12345
        match = re.search(r':(\d+)$', occurrence_id)
        if match:
            return f"https://www.inaturalist.org/observations/{match.group(1)}"

    # Fallback to references if it's a URL
    if references and references.startswith('http'):
        return references

    # Default to GBIF occurrence page
    return f"https://www.gbif.org/occurrence/{gbif_id}"


def get_source(record):
    """Determine the data source for a record."""
    dataset_key = record.get('datasetKey', '') or ''
    institution = record.get('institutionCode', '') or ''
    occurrence_id = record.get('occurrenceID', '') or ''

    is_inaturalist = (
        dataset_key == INATURALIST_DATASET_KEY or
        institution.lower() == 'inaturalist' or
        'inaturalist.org' in occurrence_id.lower()
    )

    return 'iNaturalist' if is_inaturalist else 'GBIF'


def get_collection_location(record):
    """
    Get collection location with priority:
    locality > verbatimLocality > municipality > county > stateProvince
    """
    for field in ['locality', 'verbatimLocality', 'municipality', 'county', 'stateProvince']:
        value = record.get(field)
        if value and str(value).strip() and str(value).strip().lower() not in ['na', 'nan', 'none', '']:
            return str(value).strip()
    return None


def process_occurrence_file(occurrence_path, multimedia_lookup=None):
    """Process the DWCA occurrence.txt file into our format."""
    print(f"\nProcessing {occurrence_path}...")

    if multimedia_lookup is None:
        multimedia_lookup = {}

    records = []
    skipped = 0
    source_counts = {'iNaturalist': 0, 'GBIF': 0}
    with_images = 0

    # DWCA uses tab-separated values
    with open(occurrence_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')

        for row in reader:
            # Skip records without coordinates
            lat = row.get('decimalLatitude')
            lng = row.get('decimalLongitude')

            if not lat or not lng:
                skipped += 1
                continue

            try:
                lat = float(lat)
                lng = float(lng)
            except (ValueError, TypeError):
                skipped += 1
                continue

            # Extract taxonomy
            genus = row.get('genus', '') or ''
            species_epithet = row.get('specificEpithet', '') or ''
            subspecies = row.get('infraspecificEpithet') or None

            # Build scientific name
            if genus and species_epithet:
                scientific_name = f"{genus} {species_epithet}"
            else:
                scientific_name = clean_scientific_name(row.get('species') or row.get('scientificName'))
                if scientific_name:
                    parts = scientific_name.split()
                    genus = parts[0] if parts else ''
                    species_epithet = parts[1] if len(parts) > 1 else ''

            if not scientific_name:
                skipped += 1
                continue

            # Clean subspecies
            if subspecies:
                subspecies = str(subspecies).strip()
                if subspecies.upper() in ['ACCEPTED', 'SYNONYM', 'DOUBTFUL', 'UNKNOWN', 'NA', 'NAN', '']:
                    subspecies = None

            # Determine source and build URL
            source = get_source(row)
            observation_url = get_observation_url(row)
            source_counts[source] += 1

            # Get location
            collection_location = get_collection_location(row)

            # Get image URL from multimedia lookup
            gbif_id = str(row.get('gbifID', ''))
            image_url = multimedia_lookup.get(gbif_id)
            if image_url:
                with_images += 1

            record = {
                'id': gbif_id,
                'scientific_name': scientific_name,
                'genus': genus or 'Unknown',
                'species': species_epithet or 'sp.',
                'subspecies': subspecies,
                'family': row.get('family', 'Nymphalidae'),
                'tribe': 'Ithomiini',
                'lat': lat,
                'lng': lng,
                'country': row.get('countryCode') or row.get('country'),
                'collection_location': collection_location,
                'state_province': row.get('stateProvince'),
                'collection_date': row.get('eventDate'),
                'source': source,
                'observation_url': observation_url,
                'basis_of_record': row.get('basisOfRecord'),
                'image_url': image_url,
                'mimicry_ring': 'Unknown',  # Will be filled by process_data.py
                'dataset_name': row.get('datasetName'),
                'institution_code': row.get('institutionCode'),
            }

            records.append(record)

    print(f"  Processed: {len(records):,} records")
    print(f"  Skipped: {skipped:,} (missing coordinates or invalid)")
    print(f"  With images: {with_images:,}")
    print(f"  Sources: iNaturalist={source_counts['iNaturalist']:,}, GBIF={source_counts['GBIF']:,}")

    return records, source_counts


def save_citation(download_info, source_counts, total_records):
    """Save citation information."""
    doi = download_info.get('doi')
    download_key = download_info.get('key')
    created = download_info.get('created')

    # Format date
    if created:
        try:
            dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
            date_str = dt.strftime('%Y-%m-%d')
        except Exception:
            date_str = datetime.now().strftime('%Y-%m-%d')
    else:
        date_str = datetime.now().strftime('%Y-%m-%d')

    citation = {
        'doi': doi,
        'doi_url': f"https://doi.org/{doi}" if doi else None,
        'download_key': download_key,
        'download_date': date_str,
        'total_records': total_records,
        'citation_text': f"GBIF Occurrence Download https://doi.org/{doi} accessed via GBIF.org on {date_str}",
        'dataset_breakdown': {
            'iNaturalist': source_counts.get('iNaturalist', 0),
            'Other GBIF': source_counts.get('GBIF', 0)
        },
        'filters_applied': 'Ithomiini genera, coordinates present, no geospatial issues, present occurrences, excludes fossils/living specimens'
    }

    with open(CITATION_FILE, 'w') as f:
        json.dump(citation, f, indent=2)

    print(f"\nCitation saved to {CITATION_FILE}")
    print(f"  DOI: {doi}")
    print(f"  Citation: {citation['citation_text']}")


def should_use_cache():
    """Check if we should use cached data instead of new download."""
    if not CITATION_FILE.exists():
        return False

    try:
        with open(CITATION_FILE, 'r') as f:
            citation = json.load(f)

        download_date = citation.get('download_date')
        if not download_date:
            return False

        dt = datetime.strptime(download_date, '%Y-%m-%d')
        age = datetime.now() - dt

        if age.days < CACHE_DAYS:
            print(f"Cache is {age.days} days old (threshold: {CACHE_DAYS} days)")
            return True
        else:
            print(f"Cache is {age.days} days old, exceeds threshold of {CACHE_DAYS} days")
            return False

    except Exception as e:
        print(f"Error checking cache: {e}")
        return False


def cleanup_temp():
    """Clean up temporary files."""
    import shutil
    if TEMP_DIR.exists():
        try:
            shutil.rmtree(TEMP_DIR)
            print("Cleaned up temporary files")
        except PermissionError:
            print(f"Note: Could not delete temp directory (files may be locked): {TEMP_DIR}")
            print("You can manually delete this folder later.")


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Download Ithomiini occurrences from GBIF')
    parser.add_argument('--force', action='store_true', help='Force new download, ignore cache')
    parser.add_argument('--keys-only', action='store_true', help='Only get taxon keys, do not download')
    args = parser.parse_args()

    print("=" * 70)
    print("GBIF ITHOMIINI DOWNLOAD (Download API)")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # Check cache
    if not args.force and not args.keys_only:
        if should_use_cache():
            print("\nUsing cached data. Use --force to download fresh data.")
            return

    # Load credentials
    credentials = load_credentials()
    print(f"Credentials loaded for: {credentials['GBIF_USERNAME']}")

    # Get taxon keys
    taxon_keys = get_all_taxon_keys(use_cache=True)

    if not taxon_keys:
        print("ERROR: No taxon keys found")
        sys.exit(1)

    if args.keys_only:
        print("\n--keys-only specified, exiting")
        return

    # Submit download request
    download_key = submit_download_request(credentials, taxon_keys)

    # Wait for completion
    download_info = wait_for_download(download_key, credentials)

    # Download and extract
    extract_dir = download_and_extract(download_info)

    # Load multimedia lookup for image URLs
    multimedia_lookup = load_multimedia_lookup(extract_dir)

    # Process occurrence data
    occurrence_file = extract_dir / "occurrence.txt"
    records, source_counts = process_occurrence_file(occurrence_file, multimedia_lookup)

    if not records:
        print("ERROR: No records processed")
        sys.exit(1)

    # Save occurrences
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False)

    file_size = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"\nSaved {len(records):,} records to {OUTPUT_FILE}")
    print(f"File size: {file_size:.2f} MB")

    # Save citation
    save_citation(download_info, source_counts, len(records))

    # Statistics
    print("\n" + "=" * 70)
    print("DOWNLOAD STATISTICS")
    print("=" * 70)

    # By source
    print(f"\nBy Source:")
    print(f"  iNaturalist: {source_counts['iNaturalist']:,}")
    print(f"  Other GBIF: {source_counts['GBIF']:,}")

    # By basis of record
    basis_counts = {}
    for r in records:
        basis = r.get('basis_of_record', 'Unknown')
        basis_counts[basis] = basis_counts.get(basis, 0) + 1

    print(f"\nBy Basis of Record:")
    for k, v in sorted(basis_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v:,}")

    # Unique species
    species_set = set(r['scientific_name'] for r in records if r['scientific_name'])
    print(f"\nUnique species: {len(species_set):,}")

    # With subspecies
    with_subsp = sum(1 for r in records if r.get('subspecies'))
    print(f"Records with subspecies: {with_subsp:,}")

    # Location coverage
    with_location = sum(1 for r in records if r.get('collection_location'))
    print(f"Records with location: {with_location:,} ({with_location/len(records)*100:.1f}%)")

    # Image coverage
    with_images = sum(1 for r in records if r.get('image_url'))
    print(f"Records with images: {with_images:,} ({with_images/len(records)*100:.1f}%)")

    # Cleanup
    cleanup_temp()

    print("\n" + "=" * 70)
    print("DOWNLOAD COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Run `python scripts/process_data.py` to merge with other sources")
    print("2. iNaturalist records will be filterable as separate source")
    print("3. DOI citation available in gbif_citation.json")


if __name__ == "__main__":
    main()
