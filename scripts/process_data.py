"""
Ithomiini Maps - Data Processing Pipeline
==========================================
Merges data from multiple sources into a unified JSON format.

Sources:
  1. Local Excel (Dore et al.) - Published occurrence data (source of mimicry ring data)
  2. Google Sheets (Sanger) - Live collection/sequencing data
  3. GBIF API - External occurrence enrichment

Key Feature:
  - Mimicry ring lookup table built from Dore database
  - Applied to Sanger and GBIF records based on species/subspecies matching

Output:
  - public/data/map_points.json (for map rendering)
"""

import pandas as pd
import requests
import re
import os
import json
import sys
import time
from pathlib import Path

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"

LOCAL_EXCEL_PATH = "Dore_Ithomiini_records.xlsx"
GOOGLE_SHEET_ID = "1QZj6YgHAJ9NmFXFPCtu-i-1NDuDmAdMF2Wogts7S2_4"
SHEET_GIDS = {
    "Collection_data": "900206579",
    "Photo_links": "439406691"
}

# GBIF Configuration
USE_GBIF_BULK_DOWNLOAD = True
GBIF_BULK_FILE = OUTPUT_DIR / "gbif_occurrences.json"
GBIF_SEARCH_FALLBACK = False
GBIF_SPECIES_LIMIT = 5
GBIF_RECORDS_PER_SPECIES = 50

# ══════════════════════════════════════════════════════════════════════════════
# MIMICRY RING LOOKUP TABLE
# ══════════════════════════════════════════════════════════════════════════════

# Global lookup table: (scientific_name, subspecies) -> (male_mimicry, female_mimicry)
MIMICRY_LOOKUP = {}


def build_mimicry_lookup(dore_df):
    """
    Build a lookup table from Dore database for mimicry rings.
    Creates mappings at multiple levels of specificity:
    1. Full match: (scientific_name, subspecies) -> mimicry
    2. Species-only fallback: (scientific_name, None) -> mimicry
    
    This allows matching even when subspecies data is missing.
    """
    global MIMICRY_LOOKUP
    
    print(">> Building Mimicry Ring Lookup Table...")
    
    for _, row in dore_df.iterrows():
        sci_name = f"{row['Genus']} {row['Species']}".strip()
        subspecies = row.get('Sub.species')
        male_mim = row.get('M.mimicry')
        female_mim = row.get('F.mimicry')
        
        # Clean subspecies
        if pd.isna(subspecies) or str(subspecies).strip() in ['nan', '', 'None']:
            subspecies = None
        else:
            subspecies = str(subspecies).strip()
        
        # Normalize mimicry values
        male_mim = normalize_mimicry(male_mim)
        female_mim = normalize_mimicry(female_mim)
        
        # Store with full key (species + subspecies)
        if subspecies:
            key = (sci_name.lower(), subspecies.lower())
            if key not in MIMICRY_LOOKUP:
                MIMICRY_LOOKUP[key] = (male_mim, female_mim)
        
        # Also store species-only key (for fallback matching)
        species_key = (sci_name.lower(), None)
        if species_key not in MIMICRY_LOOKUP:
            MIMICRY_LOOKUP[species_key] = (male_mim, female_mim)
    
    print(f"   Built lookup with {len(MIMICRY_LOOKUP)} unique entries")
    
    # Statistics
    unique_species = len(set(k[0] for k in MIMICRY_LOOKUP.keys()))
    unique_mimicry = len(set(v[0] for v in MIMICRY_LOOKUP.values() if v[0] != 'Unknown'))
    print(f"   Covers {unique_species} species, {unique_mimicry} mimicry rings")


def lookup_mimicry(scientific_name, subspecies=None):
    """
    Look up mimicry ring for a given species/subspecies.
    Returns (male_mimicry, female_mimicry) tuple.
    
    Matching priority:
    1. Exact match (species + subspecies)
    2. Species-only fallback
    3. Return ('Unknown', 'Unknown') if no match
    """
    if not scientific_name:
        return ('Unknown', 'Unknown')
    
    sci_name_lower = scientific_name.lower().strip()
    
    # Try exact match first (species + subspecies)
    if subspecies:
        ssp_lower = str(subspecies).lower().strip()
        key = (sci_name_lower, ssp_lower)
        if key in MIMICRY_LOOKUP:
            return MIMICRY_LOOKUP[key]
    
    # Fallback to species-only match
    species_key = (sci_name_lower, None)
    if species_key in MIMICRY_LOOKUP:
        return MIMICRY_LOOKUP[species_key]
    
    return ('Unknown', 'Unknown')


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def clean_id(series):
    """Normalizes IDs: removes spaces, uppercase, handles NaNs."""
    s = series.astype(str).str.upper().str.strip()
    s = s.replace({'NAN': '', 'NONE': '', 'NA': ''})
    return s


def normalize_mimicry(value):
    """Convert mimicry ring to Title Case for consistency."""
    if pd.isna(value) or value in ['', 'nan', 'NAN', 'Unknown', 'UNKNOWN']:
        return 'Unknown'
    return str(value).strip().title()


def get_google_export_url(gid):
    """Generate CSV export URL for a Google Sheet tab."""
    return f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}/export?format=csv&gid={gid}"


def determine_sequencing_status(row):
    """
    Determine sequencing status based on Sanger tube/rack data.
    Returns: 'Sequenced', 'Tissue Available', or 'Preserved Specimen'
    """
    rack_1 = str(row.get('Tube_1_rack', ''))
    if 'Not in TOL' not in rack_1 and len(rack_1) > 5:
        return "Sequenced"
    
    tissue_1 = str(row.get('Tube_1_tissue', ''))
    if 'NOT_COLLECTED' not in tissue_1 and tissue_1 not in ['nan', '']:
        return "Tissue Available"
    
    return "Preserved Specimen"


def split_scientific_name(name):
    """
    Split a scientific name into genus, species epithet, and subspecies.
    Input: "Mechanitis menophilus nevadensis" or "Mechanitis menophilus"
    Output: (genus, species_epithet, subspecies)
    """
    if pd.isna(name) or not name:
        return ('Unknown', 'unknown', None)
    
    parts = str(name).strip().split()
    genus = parts[0] if len(parts) > 0 else 'Unknown'
    species_epithet = parts[1] if len(parts) > 1 else 'sp.'
    subspecies = ' '.join(parts[2:]) if len(parts) > 2 else None
    
    return (genus, species_epithet, subspecies)


# ══════════════════════════════════════════════════════════════════════════════
# DATA LOADERS
# ══════════════════════════════════════════════════════════════════════════════

def load_local_data():
    """Load and process the Dore et al. Excel dataset."""
    print(">> Loading Local Excel Data (Dore et al.)...")
    
    try:
        df = pd.read_excel(LOCAL_EXCEL_PATH)
        print(f"   Loaded {len(df)} records from Excel")
        
        # Build scientific name from Genus + Species
        df['scientific_name'] = df['Genus'].astype(str) + ' ' + df['Species'].astype(str)
        
        # Extract taxonomy components
        df['genus'] = df['Genus'].astype(str).str.strip()
        df['species'] = df['Species'].astype(str).str.strip()  # Just the epithet
        df['subspecies'] = df['Sub.species'].apply(
            lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None
        )
        
        # All Ithomiini are in Nymphalidae family
        df['family'] = 'Nymphalidae'
        df['tribe'] = 'Ithomiini'
        
        # Coordinates
        df['lat'] = pd.to_numeric(df['Latitude'], errors='coerce')
        df['lng'] = pd.to_numeric(df['Longitude'], errors='coerce')
        
        # Mimicry ring (use male mimicry, normalize to Title Case)
        # Dore is the SOURCE of mimicry data
        df['mimicry_ring'] = df['M.mimicry'].apply(normalize_mimicry)
        df['mimicry_ring_female'] = df['F.mimicry'].apply(normalize_mimicry)
        
        # Metadata
        df['source'] = "Dore et al. (2025)"
        df['sequencing_status'] = "Published"
        df['image_url'] = None
        df['country'] = df['Country']
        
        # Generate ID
        df['id'] = 'DORE_' + df['ID_obs'].astype(str)

        # Collection location and observation date
        # Dore database may have location and date columns
        if 'Locality' in df.columns:
            df['collection_location'] = df['Locality'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None
            )
        else:
            df['collection_location'] = None

        # Try various date column names
        date_col = None
        for col_name in ['Date', 'Collection_date', 'Year', 'Event_date']:
            if col_name in df.columns:
                date_col = col_name
                break

        if date_col:
            df['observation_date'] = df[date_col].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None
            )
        else:
            df['observation_date'] = None

        # Select final columns
        result = df[[
            'id', 'scientific_name', 'genus', 'species', 'subspecies',
            'family', 'tribe', 'lat', 'lng', 'mimicry_ring',
            'sequencing_status', 'source', 'image_url', 'country',
            'collection_location', 'observation_date'
        ]].copy()
        
        # Drop rows without coordinates
        result = result.dropna(subset=['lat', 'lng'])
        print(f"   Output: {len(result)} records with coordinates")
        
        # Build mimicry lookup from this data BEFORE returning
        build_mimicry_lookup(df)
        
        return result
        
    except FileNotFoundError:
        print(f"   WARNING: File not found: {LOCAL_EXCEL_PATH}")
        return pd.DataFrame()
    except Exception as e:
        print(f"   ERROR loading local excel: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


def load_sanger_data():
    """Load and process the Sanger Institute Google Sheets data."""
    print(">> Loading Sanger (Google Sheets) Data...")
    
    try:
        # Download sheets
        df_col = pd.read_csv(get_google_export_url(SHEET_GIDS["Collection_data"]), dtype=str)
        df_photo = pd.read_csv(get_google_export_url(SHEET_GIDS["Photo_links"]), dtype=str)
        print(f"   Downloaded {len(df_col)} collection records, {len(df_photo)} photo links")
        
        # ── ID Selection (prioritize CAM_ID, fallback to CAM_ID_insectary) ──
        if 'CAM_ID' in df_col.columns:
            target_id = df_col['CAM_ID'].copy()
            if 'CAM_ID_insectary' in df_col.columns:
                target_id = target_id.fillna(df_col['CAM_ID_insectary'])
        else:
            target_id = df_col.iloc[:, 0]
            
        df_col['clean_id'] = clean_id(target_id)
        
        # ── Photo Matching ──
        # Filter out RAW files
        mask_raw = df_photo['Name'].str.contains(r'\.(?:ORF|CR2|NEF|ARW)$', case=False, regex=True, na=False)
        df_photo = df_photo[~mask_raw].copy()
        
        # Extract CAM_ID from filename
        extracted_ids = df_photo['Name'].str.extract(r'(CAM\d+)', flags=re.IGNORECASE)[0]
        df_photo['clean_id'] = clean_id(extracted_ids)
        
        # Create proxy URLs via wsrv.nl
        df_photo['google_id'] = df_photo['URL'].str.extract(r'file/d/(.*?)/view', expand=False)
        df_photo['proxy_url'] = "https://wsrv.nl/?url=https://drive.google.com/uc?id=" + df_photo['google_id'] + "&w=400&output=webp"
        
        # Group photos by CAM_ID (take first photo)
        photo_map = df_photo.groupby('clean_id')['proxy_url'].first()
        
        # ── Process Collection Data ──
        df_col['sequencing_status'] = df_col.apply(determine_sequencing_status, axis=1)
        df_col['image_url'] = df_col['clean_id'].map(photo_map)
        
        # Taxonomy fields (from Google Sheets columns)
        df_col['family'] = df_col.get(' Family', df_col.get('Family', pd.Series(['Nymphalidae'] * len(df_col))))
        df_col['family'] = df_col['family'].fillna('Nymphalidae').replace({'': 'Nymphalidae'})
        
        df_col['tribe'] = df_col.get('Tribe', pd.Series(['Ithomiini'] * len(df_col)))
        df_col['tribe'] = df_col['tribe'].fillna('Ithomiini').replace({'': 'Ithomiini'})
        
        df_col['genus'] = df_col.get('Genus', pd.Series(['Unknown'] * len(df_col)))
        df_col['genus'] = df_col['genus'].fillna('Unknown')
        
        # Scientific name (full binomial from SPECIES column)
        df_col['scientific_name'] = df_col.get('SPECIES', pd.Series(['Unknown species'] * len(df_col)))
        df_col['scientific_name'] = df_col['scientific_name'].fillna('Unknown species')
        
        # Extract species epithet from scientific name
        df_col['species'] = df_col['scientific_name'].apply(
            lambda x: str(x).split()[1] if pd.notna(x) and len(str(x).split()) > 1 else 'sp.'
        )
        
        # Subspecies
        df_col['subspecies'] = df_col.get('Subspecies_Form', pd.Series([None] * len(df_col)))
        df_col['subspecies'] = df_col['subspecies'].apply(
            lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', '', 'NA'] else None
        )
        
        # Coordinates (try multiple column names)
        if 'DECIMAL_LATITUDE' in df_col.columns:
            df_col['lat'] = pd.to_numeric(df_col['DECIMAL_LATITUDE'], errors='coerce')
            df_col['lng'] = pd.to_numeric(df_col['DECIMAL_LONGITUDE'], errors='coerce')
        elif 'Latitude' in df_col.columns:
            df_col['lat'] = pd.to_numeric(df_col['Latitude'], errors='coerce')
            df_col['lng'] = pd.to_numeric(df_col['Longitude'], errors='coerce')
        else:
            df_col['lat'] = None
            df_col['lng'] = None
        
        # ═══════════════════════════════════════════════════════════════════
        # MIMICRY RING LOOKUP (from Dore database)
        # ═══════════════════════════════════════════════════════════════════
        print("   Applying mimicry ring lookup from Dore database...")
        
        def get_mimicry_for_row(row):
            sci_name = row.get('scientific_name', '')
            subspecies = row.get('subspecies')
            male_mim, _ = lookup_mimicry(sci_name, subspecies)
            return male_mim
        
        df_col['mimicry_ring'] = df_col.apply(get_mimicry_for_row, axis=1)
        
        matched = (df_col['mimicry_ring'] != 'Unknown').sum()
        print(f"   Mimicry ring matched for {matched}/{len(df_col)} records")
        
        # Metadata
        df_col['source'] = 'Sanger Institute'
        df_col['country'] = df_col.get('Country', pd.Series([None] * len(df_col)))
        df_col['id'] = df_col['clean_id']

        # Collection location from Sanger data
        if 'Collection_location' in df_col.columns:
            df_col['collection_location'] = df_col['Collection_location'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', '', 'NA'] else None
            )
        elif 'Locality' in df_col.columns:
            df_col['collection_location'] = df_col['Locality'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', '', 'NA'] else None
            )
        else:
            df_col['collection_location'] = None

        # Observation date from Sanger data
        if 'Collection_date' in df_col.columns:
            df_col['observation_date'] = df_col['Collection_date'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', '', 'NA'] else None
            )
        elif 'Date' in df_col.columns:
            df_col['observation_date'] = df_col['Date'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', '', 'NA'] else None
            )
        else:
            df_col['observation_date'] = None

        # Select final columns
        result = df_col[[
            'id', 'scientific_name', 'genus', 'species', 'subspecies',
            'family', 'tribe', 'lat', 'lng', 'mimicry_ring',
            'sequencing_status', 'source', 'image_url', 'country',
            'collection_location', 'observation_date'
        ]].copy()
        
        # Drop rows without coordinates or with empty IDs
        result = result.dropna(subset=['lat', 'lng'])
        result = result[result['id'] != '']
        
        print(f"   Output: {len(result)} records with coordinates")
        return result
        
    except Exception as e:
        print(f"   ERROR loading Sanger data: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


def load_gbif_bulk_download():
    """
    Load pre-downloaded GBIF data from gbif_download.py.
    Applies mimicry ring lookup from Dore database.
    Maps basisOfRecord to user-friendly sequencing_status.
    """
    gbif_path = Path(GBIF_BULK_FILE)
    
    if not gbif_path.exists():
        print(f">> GBIF bulk download not found: {gbif_path}")
        print("   Run `python scripts/gbif_download.py` first to download GBIF data.")
        return pd.DataFrame()
    
    print(f">> Loading GBIF bulk download: {gbif_path}")
    
    try:
        with open(gbif_path, encoding='utf-8') as f:
            records = json.load(f)
        
        df = pd.DataFrame(records)
        print(f"   Loaded {len(df):,} GBIF records")
        
        # ═══════════════════════════════════════════════════════════════════
        # MAP BASIS OF RECORD TO STATUS
        # ═══════════════════════════════════════════════════════════════════
        # GBIF basisOfRecord values:
        # - HUMAN_OBSERVATION: iNaturalist/citizen science (like "Research Grade")
        # - PRESERVED_SPECIMEN: Museum specimens
        # - MACHINE_OBSERVATION: Camera trap, etc.
        # - OCCURRENCE: Generic occurrence
        
        status_map = {
            'HUMAN_OBSERVATION': 'Observation',
            'PRESERVED_SPECIMEN': 'Museum Specimen',
            'MACHINE_OBSERVATION': 'Observation',
            'OCCURRENCE': 'GBIF Record',
            'MATERIAL_SAMPLE': 'Museum Specimen',
            'LIVING_SPECIMEN': 'Living Specimen',
        }
        
        if 'basis_of_record' in df.columns:
            df['sequencing_status'] = df['basis_of_record'].map(status_map).fillna('GBIF Record')
        else:
            df['sequencing_status'] = 'GBIF Record'
        
        # ═══════════════════════════════════════════════════════════════════
        # CLEAN SPECIES NAMES (remove any remaining author citations)
        # ═══════════════════════════════════════════════════════════════════
        def clean_species_name(name):
            if not name or pd.isna(name):
                return None
            name = str(name).strip()
            # Remove author citations
            name = re.sub(r'\s*\([A-Z][a-zA-Z&\s\.\-]+,?\s*\d{4}\)', '', name)
            name = re.sub(r'\s+[A-Z][a-zA-Z&\s\.\-]+,\s*\d{4}$', '', name)
            name = ' '.join(name.split())
            return name if name else None
        
        df['scientific_name'] = df['scientific_name'].apply(clean_species_name)
        
        # Remove rows with invalid species names
        df = df[df['scientific_name'].notna()]
        print(f"   After cleaning species names: {len(df):,} records")
        
        # ═══════════════════════════════════════════════════════════════════
        # CLEAN SUBSPECIES (remove taxonomic status values)
        # ═══════════════════════════════════════════════════════════════════
        def clean_subspecies(ssp):
            if not ssp or pd.isna(ssp):
                return None
            ssp = str(ssp).strip()
            # Remove if it's a taxonomic status
            if ssp.upper() in ['ACCEPTED', 'SYNONYM', 'DOUBTFUL', 'UNKNOWN', 'NA', 'NONE', '']:
                return None
            return ssp
        
        df['subspecies'] = df['subspecies'].apply(clean_subspecies)
        
        # Ensure required columns exist
        required_cols = ['id', 'scientific_name', 'genus', 'species', 'subspecies',
                        'family', 'tribe', 'lat', 'lng', 'mimicry_ring',
                        'sequencing_status', 'source', 'image_url', 'country',
                        'collection_location', 'observation_date', 'observation_url']

        for col in required_cols:
            if col not in df.columns:
                df[col] = None if col in ['subspecies', 'image_url', 'collection_location', 'observation_date', 'observation_url'] else 'Unknown'

        # Preserve source field from download (iNaturalist or GBIF)
        # If source is not set, default to GBIF
        if 'source' in df.columns:
            df['source'] = df['source'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else 'GBIF'
            )
        else:
            df['source'] = 'GBIF'

        # Process GBIF collection_location (already set by gbif_download.py with fallbacks)
        # Only use locality as fallback if collection_location is not already set
        if 'collection_location' in df.columns:
            df['collection_location'] = df['collection_location'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None
            )
        elif 'locality' in df.columns:
            df['collection_location'] = df['locality'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None
            )
        # Handle observation_date from various source columns
        if 'observation_date' not in df.columns or df['observation_date'].isna().all():
            for date_col in ['collection_date', 'event_date']:
                if date_col in df.columns:
                    df['observation_date'] = df[date_col].apply(
                        lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None
                    )
                    break

        # Clean observation_url
        if 'observation_url' in df.columns:
            df['observation_url'] = df['observation_url'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None
            )
        
        # ═══════════════════════════════════════════════════════════════════
        # MIMICRY RING LOOKUP (from Dore database)
        # ═══════════════════════════════════════════════════════════════════
        print("   Applying mimicry ring lookup from Dore database...")
        
        def get_mimicry_for_row(row):
            sci_name = row.get('scientific_name', '')
            subspecies = row.get('subspecies')
            male_mim, _ = lookup_mimicry(sci_name, subspecies)
            return male_mim
        
        df['mimicry_ring'] = df.apply(get_mimicry_for_row, axis=1)
        
        matched = (df['mimicry_ring'] != 'Unknown').sum()
        print(f"   Mimicry ring matched for {matched:,}/{len(df):,} records")
        
        return df[required_cols]
        
    except Exception as e:
        print(f"   ERROR loading GBIF data: {e}")
        return pd.DataFrame()


def fetch_gbif_data(species_list):
    """Fetch occurrence data from GBIF API for given species (LEGACY - use gbif_download.py instead)."""
    if GBIF_SPECIES_LIMIT == 0:
        print(">> GBIF search API disabled")
        return pd.DataFrame()
    
    print(f">> Fetching GBIF Data via Search API for up to {GBIF_SPECIES_LIMIT} species...")
    print("   ⚠️  Note: For bulk data, use gbif_download.py instead!")
    all_records = []
    
    # Get unique species, limit count
    targets = [s for s in set(species_list) if isinstance(s, str) and len(s) > 3]
    targets = targets[:GBIF_SPECIES_LIMIT]
    
    for i, sp in enumerate(targets):
        try:
            print(f"   [{i+1}/{len(targets)}] Querying: {sp}")
            
            # Step 1: Match species name to GBIF backbone
            match_url = "https://api.gbif.org/v1/species/match"
            r = requests.get(match_url, params={'name': sp, 'kingdom': 'Animalia'}, timeout=10)
            data = r.json()
            
            usage_key = data.get('usageKey')
            if not usage_key:
                print(f"      No match found")
                continue
            
            # Step 2: Search occurrences
            search_url = "https://api.gbif.org/v1/occurrence/search"
            params = {
                'taxonKey': usage_key,
                'hasCoordinate': 'true',
                'limit': GBIF_RECORDS_PER_SPECIES
            }
            r_occ = requests.get(search_url, params=params, timeout=15)
            results = r_occ.json().get('results', [])
            
            print(f"      Found {len(results)} occurrences")
            
            for rec in results:
                # Extract image URL if available
                image_url = None
                if 'media' in rec:
                    for m in rec['media']:
                        if m.get('type') == 'StillImage' and m.get('identifier'):
                            image_url = m['identifier']
                            break
                
                # Parse scientific name for components
                sci_name = rec.get('species', rec.get('scientificName', sp))
                genus, species_epithet, subspecies = split_scientific_name(sci_name)
                
                # Lookup mimicry ring
                male_mim, _ = lookup_mimicry(sci_name, subspecies)
                
                all_records.append({
                    'id': f"GBIF_{rec.get('key', '')}",
                    'scientific_name': sci_name,
                    'genus': rec.get('genus', genus),
                    'species': species_epithet,
                    'subspecies': subspecies,
                    'family': rec.get('family', 'Nymphalidae'),
                    'tribe': 'Ithomiini',
                    'lat': rec.get('decimalLatitude'),
                    'lng': rec.get('decimalLongitude'),
                    'mimicry_ring': male_mim,  # From Dore lookup
                    'sequencing_status': 'GBIF Record',
                    'source': 'GBIF',
                    'image_url': image_url,
                    'country': rec.get('country'),
                    'collection_location': rec.get('locality'),
                    'observation_date': rec.get('eventDate')
                })
            
            # Rate limiting
            time.sleep(0.5)
            
        except Exception as e:
            print(f"      ERROR: {e}")
            continue
    
    if all_records:
        df = pd.DataFrame(all_records)
        print(f"   Total GBIF records: {len(df)}")
        return df
    
    return pd.DataFrame()


# ══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("ITHOMIINI MAPS - DATA PROCESSING PIPELINE")
    print("=" * 70)
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: Load Dore data FIRST (builds mimicry lookup table)
    # ═══════════════════════════════════════════════════════════════════════
    df_local = load_local_data()
    
    if df_local.empty:
        print("\n⚠️  WARNING: Dore data not loaded - mimicry lookup will be empty!")
        print("   Other data sources will have 'Unknown' mimicry rings.")
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: Load other sources (uses mimicry lookup)
    # ═══════════════════════════════════════════════════════════════════════
    df_sanger = load_sanger_data()
    
    # Merge local and sanger
    all_dfs = [df for df in [df_local, df_sanger] if not df.empty]
    
    if not all_dfs:
        print("\nERROR: No data loaded from any source!")
        sys.exit(1)
    
    df_merged = pd.concat(all_dfs, ignore_index=True)
    print(f"\n>> Merged dataset: {len(df_merged):,} records")
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 3: GBIF Data (uses mimicry lookup)
    # ═══════════════════════════════════════════════════════════════════════
    if USE_GBIF_BULK_DOWNLOAD:
        df_gbif = load_gbif_bulk_download()
        if not df_gbif.empty:
            df_merged = pd.concat([df_merged, df_gbif], ignore_index=True)
            print(f">> After GBIF bulk merge: {len(df_merged):,} records")
        elif GBIF_SEARCH_FALLBACK:
            print(">> Falling back to GBIF Search API...")
            species_list = df_merged['scientific_name'].unique().tolist()
            df_gbif = fetch_gbif_data(species_list)
            if not df_gbif.empty:
                df_merged = pd.concat([df_merged, df_gbif], ignore_index=True)
                print(f">> After GBIF search merge: {len(df_merged):,} records")
    
    # ═══════════════════════════════════════════════════════════════════════
    # FINAL CLEANING
    # ═══════════════════════════════════════════════════════════════════════
    
    # Ensure all string fields are properly typed
    str_cols = ['id', 'scientific_name', 'genus', 'species', 'family', 'tribe',
                'mimicry_ring', 'sequencing_status', 'source', 'country']
    for col in str_cols:
        if col in df_merged.columns:
            df_merged[col] = df_merged[col].fillna('Unknown').astype(str)

    # Handle subspecies (can be null)
    df_merged['subspecies'] = df_merged['subspecies'].apply(
        lambda x: x if pd.notna(x) and x not in ['None', 'nan', ''] else None
    )

    # Handle image_url (can be null)
    df_merged['image_url'] = df_merged['image_url'].apply(
        lambda x: x if pd.notna(x) and x not in ['None', 'nan', ''] else None
    )

    # Handle collection_location (can be null)
    if 'collection_location' not in df_merged.columns:
        df_merged['collection_location'] = None
    else:
        df_merged['collection_location'] = df_merged['collection_location'].apply(
            lambda x: x if pd.notna(x) and x not in ['None', 'nan', ''] else None
        )

    # Handle observation_date (can be null)
    if 'observation_date' not in df_merged.columns:
        df_merged['observation_date'] = None
    else:
        df_merged['observation_date'] = df_merged['observation_date'].apply(
            lambda x: x if pd.notna(x) and x not in ['None', 'nan', ''] else None
        )

    # Handle observation_url (can be null)
    if 'observation_url' not in df_merged.columns:
        df_merged['observation_url'] = None
    else:
        df_merged['observation_url'] = df_merged['observation_url'].apply(
            lambda x: x if pd.notna(x) and x not in ['None', 'nan', ''] else None
        )
    
    # ═══════════════════════════════════════════════════════════════════════
    # OUTPUT STATISTICS
    # ═══════════════════════════════════════════════════════════════════════
    
    print("\n" + "=" * 70)
    print("OUTPUT STATISTICS")
    print("=" * 70)
    print(f"Total Records: {len(df_merged):,}")
    print(f"Unique Species: {df_merged['scientific_name'].nunique():,}")
    print(f"Unique Genera: {df_merged['genus'].nunique()}")
    print(f"Unique Mimicry Rings: {df_merged['mimicry_ring'].nunique()}")
    print(f"Records with Known Mimicry: {(df_merged['mimicry_ring'] != 'Unknown').sum():,}")
    print(f"Records with Images: {df_merged['image_url'].notna().sum():,}")
    
    print("\nBy Source:")
    print(df_merged['source'].value_counts().to_string())
    
    print("\nBy Sequencing Status:")
    print(df_merged['sequencing_status'].value_counts().to_string())
    
    print("\nTop 10 Mimicry Rings:")
    mim_counts = df_merged[df_merged['mimicry_ring'] != 'Unknown']['mimicry_ring'].value_counts().head(10)
    print(mim_counts.to_string())
    
    # ═══════════════════════════════════════════════════════════════════════
    # SAVE OUTPUT
    # ═══════════════════════════════════════════════════════════════════════
    
    output_path = os.path.join(OUTPUT_DIR, "map_points.json")
    
    # Convert to list of dicts for JSON
    records = df_merged.to_dict(orient='records')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False)
    
    print(f"\n>> Saved to: {output_path}")
    print(f">> File size: {os.path.getsize(output_path) / 1024:.1f} KB")
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
