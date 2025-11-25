"""
GBIF Bulk Download for Ithomiini Maps
=====================================
Uses GBIF's Download API to request ALL Ithomiini occurrences at once.
Much more efficient than the Search API for large datasets.

Usage:
    python scripts/gbif_download.py

Requirements:
    - GBIF account (free): https://www.gbif.org/user/profile
    - Create gbif_credentials.env file with your credentials

Output:
    - data/gbif_raw/occurrence.txt (Darwin Core Archive)
    - public/data/gbif_occurrences.json (processed for the map)
"""

import os
import sys
import json
import time
import hashlib
import zipfile
import requests
import pandas as pd
from pathlib import Path
from getpass import getpass
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

# Ithomiini tribe taxon key in GBIF backbone
# Found via: https://api.gbif.org/v1/species/match?name=Ithomiini&rank=TRIBE
ITHOMIINI_TAXON_KEY = 9322  # Tribe Ithomiini

# Optional: Restrict to Neotropical region (South & Central America)
# Set to None to get worldwide data
NEOTROPICS_WKT = """POLYGON((-117 32, -117 8, -82 8, -77 5, -77 -5, -81 -5, 
-80 -18, -70 -18, -70 -56, -55 -56, -55 -34, -35 -34, -35 5, 
-60 5, -60 12, -75 12, -85 12, -85 22, -98 22, -98 32, -117 32))"""

# Output directories
RAW_DIR = Path("data/gbif_raw")
OUTPUT_DIR = Path("public/data")
CACHE_FILE = Path("data/gbif_download_cache.json")

# ══════════════════════════════════════════════════════════════════════════════
# CREDENTIALS MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

def load_credentials():
    """
    Load GBIF credentials from environment, file, or interactive input.
    """
    user = os.environ.get("GBIF_USERNAME")
    pwd = os.environ.get("GBIF_PASSWORD")
    email = os.environ.get("GBIF_EMAIL")
    
    # Try loading from credentials file
    creds_file = Path("gbif_credentials.env")
    if creds_file.exists() and not all([user, pwd, email]):
        print(f"🔑 Loading credentials from {creds_file}")
        with open(creds_file) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key == "GBIF_USERNAME": user = user or val
                    elif key == "GBIF_PASSWORD": pwd = pwd or val
                    elif key == "GBIF_EMAIL": email = email or val
    
    # Interactive input if still missing
    if not all([user, pwd, email]):
        print("\n⚠️  GBIF credentials not found.")
        print("   Create a free account at: https://www.gbif.org/user/profile\n")
        user = user or input("GBIF Username: ")
        pwd = pwd or getpass("GBIF Password: ")
        email = email or input("GBIF Email: ")
        
        save = input("\n💾 Save credentials to gbif_credentials.env? (y/n): ")
        if save.lower() == 'y':
            with open("gbif_credentials.env", "w") as f:
                f.write(f"GBIF_USERNAME={user}\n")
                f.write(f"GBIF_PASSWORD={pwd}\n")
                f.write(f"GBIF_EMAIL={email}\n")
            print("✅ Credentials saved.\n")
    
    return user, pwd, email


# ══════════════════════════════════════════════════════════════════════════════
# GBIF DOWNLOAD API
# ══════════════════════════════════════════════════════════════════════════════

def get_request_hash(predicate):
    """Generate a hash of the predicate for caching."""
    return hashlib.md5(json.dumps(predicate, sort_keys=True).encode()).hexdigest()[:12]


def load_cache():
    """Load the download cache."""
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache):
    """Save the download cache."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


def request_download(username, password, email, predicate):
    """
    Submit a download request to GBIF.
    Returns the download key if successful.
    """
    payload = {
        "creator": username,
        "notificationAddresses": [email],
        "sendNotification": True,  # Get email when ready
        "format": "SIMPLE_CSV",    # Easier to parse than DWCA
        "predicate": predicate
    }
    
    print("📤 Submitting download request to GBIF...")
    print(f"   Predicate hash: {get_request_hash(predicate)}")
    
    response = requests.post(
        "https://api.gbif.org/v1/occurrence/download/request",
        auth=(username, password),
        headers={"Content-Type": "application/json"},
        json=payload
    )
    
    if response.status_code == 201:
        download_key = response.text
        print(f"✅ Request accepted! Download key: {download_key}")
        return download_key
    else:
        print(f"❌ Request failed: {response.status_code}")
        print(f"   {response.text}")
        return None


def check_download_status(download_key):
    """Check the status of a download request."""
    response = requests.get(f"https://api.gbif.org/v1/occurrence/download/{download_key}")
    if response.ok:
        return response.json()
    return None


def wait_for_download(download_key, max_wait_minutes=60):
    """
    Poll GBIF until the download is ready.
    """
    print(f"\n⏳ Waiting for download to be prepared...")
    print(f"   Check status: https://www.gbif.org/occurrence/download/{download_key}")
    
    start_time = time.time()
    max_wait_seconds = max_wait_minutes * 60
    
    while True:
        status_data = check_download_status(download_key)
        
        if not status_data:
            print("   ❌ Could not fetch status")
            return False
        
        status = status_data.get("status", "UNKNOWN")
        
        if status == "SUCCEEDED":
            total_records = status_data.get("totalRecords", 0)
            download_link = status_data.get("downloadLink", "")
            print(f"\n✅ Download ready!")
            print(f"   Records: {total_records:,}")
            print(f"   Link: {download_link}")
            return True
        
        elif status in ["FAILED", "KILLED", "CANCELLED"]:
            print(f"\n❌ Download {status}")
            return False
        
        elif status in ["PREPARING", "RUNNING", "PENDING"]:
            elapsed = int(time.time() - start_time)
            print(f"   [{elapsed}s] Status: {status}...", end="\r")
            
            if elapsed > max_wait_seconds:
                print(f"\n⏰ Timeout after {max_wait_minutes} minutes.")
                print(f"   GBIF will email you when ready. Re-run this script later.")
                return False
            
            time.sleep(30)  # Check every 30 seconds
        
        else:
            print(f"   Unknown status: {status}")
            time.sleep(30)


def download_and_extract(download_key):
    """Download and extract the ZIP file from GBIF."""
    status_data = check_download_status(download_key)
    if not status_data:
        return False
    
    download_link = status_data.get("downloadLink")
    if not download_link:
        print("❌ No download link found")
        return False
    
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RAW_DIR / f"{download_key}.zip"
    
    # Download ZIP
    print(f"\n📥 Downloading: {download_link}")
    response = requests.get(download_link, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    
    downloaded = 0
    with open(zip_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total_size:
                pct = (downloaded / total_size) * 100
                print(f"   {downloaded / 1024 / 1024:.1f} MB ({pct:.1f}%)", end="\r")
    
    print(f"\n✅ Downloaded: {zip_path}")
    
    # Extract
    print("📦 Extracting...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(RAW_DIR)
    
    print(f"✅ Extracted to: {RAW_DIR}")
    return True


# ══════════════════════════════════════════════════════════════════════════════
# DATA PROCESSING
# ══════════════════════════════════════════════════════════════════════════════

def process_gbif_data():
    """
    Convert the GBIF CSV to our JSON format for the map.
    """
    # Find the CSV file (SIMPLE_CSV format creates a single .csv)
    csv_files = list(RAW_DIR.glob("*.csv"))
    if not csv_files:
        # Try occurrence.txt (DWCA format)
        csv_files = list(RAW_DIR.glob("occurrence.txt"))
    
    if not csv_files:
        print("❌ No GBIF data file found in", RAW_DIR)
        return
    
    csv_path = csv_files[0]
    print(f"\n📊 Processing: {csv_path}")
    
    # Load data
    df = pd.read_csv(csv_path, sep="\t" if csv_path.suffix == ".txt" else ",", 
                     low_memory=False, on_bad_lines='skip')
    
    print(f"   Raw records: {len(df):,}")
    
    # Select and rename columns
    column_map = {
        'gbifID': 'id',
        'species': 'scientific_name',
        'genus': 'genus',
        'specificEpithet': 'species_epithet',
        'infraspecificEpithet': 'subspecies',
        'family': 'family',
        'decimalLatitude': 'lat',
        'decimalLongitude': 'lng',
        'countryCode': 'country',
        'eventDate': 'date',
        'basisOfRecord': 'basis',
        'mediaType': 'media_type'
    }
    
    # Keep only columns that exist
    available_cols = {k: v for k, v in column_map.items() if k in df.columns}
    df = df[list(available_cols.keys())].rename(columns=available_cols)
    
    # Add required fields
    df['id'] = 'GBIF_' + df['id'].astype(str)
    df['tribe'] = 'Ithomiini'
    df['family'] = df.get('family', 'Nymphalidae').fillna('Nymphalidae')
    df['mimicry_ring'] = 'Unknown'  # GBIF doesn't have this
    df['sequencing_status'] = 'GBIF Record'
    df['source'] = 'GBIF'
    
    # Extract species epithet if not present
    if 'species_epithet' not in df.columns or df['species_epithet'].isna().all():
        df['species_epithet'] = df['scientific_name'].apply(
            lambda x: str(x).split()[1] if pd.notna(x) and len(str(x).split()) > 1 else 'sp.'
        )
    df = df.rename(columns={'species_epithet': 'species'})
    
    # Handle subspecies
    df['subspecies'] = df['subspecies'].apply(
        lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['', 'nan'] else None
    )
    
    # Image URL from GBIF (if available)
    # Note: SIMPLE_CSV doesn't include media URLs, would need DWCA for that
    df['image_url'] = None
    
    # Filter: must have coordinates
    df = df.dropna(subset=['lat', 'lng'])
    print(f"   With coordinates: {len(df):,}")
    
    # Final column selection
    output_cols = [
        'id', 'scientific_name', 'genus', 'species', 'subspecies',
        'family', 'tribe', 'lat', 'lng', 'mimicry_ring',
        'sequencing_status', 'source', 'image_url', 'country'
    ]
    
    # Only keep columns that exist
    output_cols = [c for c in output_cols if c in df.columns]
    df = df[output_cols]
    
    # Save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "gbif_occurrences.json"
    
    records = df.to_dict(orient='records')
    with open(output_path, 'w') as f:
        json.dump(records, f)
    
    print(f"\n✅ Saved: {output_path}")
    print(f"   Records: {len(records):,}")
    print(f"   Unique species: {df['scientific_name'].nunique():,}")
    
    return df


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("ITHOMIINI MAPS - GBIF BULK DOWNLOAD")
    print("=" * 60)
    
    # Check if we already have data
    existing_data = OUTPUT_DIR / "gbif_occurrences.json"
    if existing_data.exists():
        size = existing_data.stat().st_size / 1024 / 1024
        print(f"\n⚠️  Existing GBIF data found: {existing_data} ({size:.1f} MB)")
        choice = input("   Reprocess existing data (r) or request new download (n)? [r/n]: ")
        if choice.lower() == 'r':
            process_gbif_data()
            return
    
    # Load credentials
    user, pwd, email = load_credentials()
    if not all([user, pwd, email]):
        print("❌ Credentials required for GBIF download")
        return
    
    # Build predicate
    predicates = [
        {"type": "equals", "key": "TAXON_KEY", "value": str(ITHOMIINI_TAXON_KEY)},
        {"type": "equals", "key": "HAS_COORDINATE", "value": "true"},
        {"type": "equals", "key": "HAS_GEOSPATIAL_ISSUE", "value": "false"}
    ]
    
    # Optional: Add geographic filter
    if NEOTROPICS_WKT:
        # Clean up WKT (remove newlines)
        wkt_clean = " ".join(NEOTROPICS_WKT.split())
        predicates.append({"type": "within", "geometry": wkt_clean})
    
    # Optional: Only records with images
    # predicates.append({"type": "equals", "key": "MEDIA_TYPE", "value": "StillImage"})
    
    predicate = {
        "type": "and",
        "predicates": predicates
    }
    
    # Check cache
    cache = load_cache()
    request_hash = get_request_hash(predicate)
    
    download_key = None
    
    if request_hash in cache:
        cached_key = cache[request_hash]["download_key"]
        print(f"\n♻️  Found cached download: {cached_key}")
        
        # Check if it's still valid
        status = check_download_status(cached_key)
        if status and status.get("status") == "SUCCEEDED":
            print("   Status: SUCCEEDED ✓")
            download_key = cached_key
        else:
            print(f"   Status: {status.get('status') if status else 'UNKNOWN'}")
            print("   Requesting new download...")
    
    # Request new download if needed
    if not download_key:
        download_key = request_download(user, pwd, email, predicate)
        if download_key:
            cache[request_hash] = {
                "download_key": download_key,
                "requested_at": datetime.now().isoformat()
            }
            save_cache(cache)
    
    if not download_key:
        print("❌ Failed to get download key")
        return
    
    # Wait for download (or check if already ready)
    if not wait_for_download(download_key, max_wait_minutes=30):
        print("\n💡 Tip: GBIF will email you when ready. Run this script again later.")
        return
    
    # Download and extract if needed
    occurrence_file = RAW_DIR / f"{download_key}.csv"
    if not occurrence_file.exists():
        occurrence_files = list(RAW_DIR.glob("*.csv")) + list(RAW_DIR.glob("occurrence.txt"))
        if not occurrence_files:
            download_and_extract(download_key)
    
    # Process to JSON
    process_gbif_data()
    
    print("\n" + "=" * 60)
    print("✅ GBIF download complete!")
    print("   Run `python scripts/process_data.py` to merge with other sources.")
    print("=" * 60)


if __name__ == "__main__":
    main()
