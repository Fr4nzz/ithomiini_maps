"""
Ithomiini Maps - Data Processing Pipeline
==========================================
Merges data from multiple sources into a unified JSON format.

Sources:
  1. Local Excel (Dore et al.) - Published occurrence data
  2. Google Sheets (Sanger) - Live collection/sequencing data
  3. GBIF API - External occurrence enrichment

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

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

LOCAL_EXCEL_PATH = "Dore_Ithomiini_records.xlsx"
GOOGLE_SHEET_ID = "1QZj6YgHAJ9NmFXFPCtu-i-1NDuDmAdMF2Wogts7S2_4"
SHEET_GIDS = {
    "Collection_data": "900206579",
    "Photo_links": "439406691"
}
OUTPUT_DIR = "public/data"

# GBIF fetch limit (set to 0 to disable)
GBIF_SPECIES_LIMIT = 5  # Number of species to fetch from GBIF (use 0 for none)
GBIF_RECORDS_PER_SPECIES = 50

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
    if pd.isna(value) or value in ['', 'nan', 'NAN', 'Unknown']:
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
    print(">> Loading Local Excel Data...")
    
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
        df['mimicry_ring'] = df['M.mimicry'].apply(normalize_mimicry)
        
        # Metadata
        df['source'] = "Dore et al. (2025)"
        df['sequencing_status'] = "Published"
        df['image_url'] = None
        df['country'] = df['Country']
        
        # Generate ID
        df['id'] = 'DORE_' + df['ID_obs'].astype(str)
        
        # Select final columns
        result = df[[
            'id', 'scientific_name', 'genus', 'species', 'subspecies',
            'family', 'tribe', 'lat', 'lng', 'mimicry_ring',
            'sequencing_status', 'source', 'image_url', 'country'
        ]].copy()
        
        # Drop rows without coordinates
        result = result.dropna(subset=['lat', 'lng'])
        print(f"   Output: {len(result)} records with coordinates")
        
        return result
        
    except FileNotFoundError:
        print(f"   WARNING: File not found: {LOCAL_EXCEL_PATH}")
        return pd.DataFrame()
    except Exception as e:
        print(f"   ERROR loading local excel: {e}")
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
        # Note: Sheet has ' Family' with leading space
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
        
        # Mimicry (Sanger data doesn't have it, mark as Unknown)
        df_col['mimicry_ring'] = 'Unknown'
        
        # Metadata
        df_col['source'] = 'Sanger Institute'
        df_col['country'] = df_col.get('Country', pd.Series([None] * len(df_col)))
        df_col['id'] = df_col['clean_id']
        
        # Select final columns
        result = df_col[[
            'id', 'scientific_name', 'genus', 'species', 'subspecies',
            'family', 'tribe', 'lat', 'lng', 'mimicry_ring',
            'sequencing_status', 'source', 'image_url', 'country'
        ]].copy()
        
        # Drop rows without coordinates or with empty IDs
        result = result.dropna(subset=['lat', 'lng'])
        result = result[result['id'] != '']
        result.loc[result['id'] == '', 'id'] = 'NO_ID'
        
        print(f"   Output: {len(result)} records with coordinates")
        return result
        
    except Exception as e:
        print(f"   ERROR loading Sanger data: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


def fetch_gbif_data(species_list):
    """Fetch occurrence data from GBIF API for given species."""
    if GBIF_SPECIES_LIMIT == 0:
        print(">> GBIF fetch disabled (GBIF_SPECIES_LIMIT = 0)")
        return pd.DataFrame()
    
    print(f">> Fetching GBIF Data for up to {GBIF_SPECIES_LIMIT} species...")
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
                
                all_records.append({
                    'id': f"GBIF_{rec.get('key', '')}",
                    'scientific_name': sci_name,
                    'genus': rec.get('genus', genus),
                    'species': species_epithet,
                    'subspecies': subspecies,
                    'family': rec.get('family', 'Nymphalidae'),
                    'tribe': 'Ithomiini',  # GBIF doesn't return tribe
                    'lat': rec.get('decimalLatitude'),
                    'lng': rec.get('decimalLongitude'),
                    'mimicry_ring': 'Unknown',  # GBIF doesn't have mimicry data
                    'sequencing_status': 'GBIF Record',
                    'source': 'GBIF',
                    'image_url': image_url,
                    'country': rec.get('country')
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
    print("=" * 60)
    print("ITHOMIINI MAPS - DATA PROCESSING PIPELINE")
    print("=" * 60)
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Load all data sources
    df_local = load_local_data()
    df_sanger = load_sanger_data()
    
    # Merge local and sanger
    all_dfs = [df for df in [df_local, df_sanger] if not df.empty]
    
    if not all_dfs:
        print("\nERROR: No data loaded from any source!")
        sys.exit(1)
    
    df_merged = pd.concat(all_dfs, ignore_index=True)
    print(f"\n>> Merged dataset: {len(df_merged)} records")
    
    # Optional: Fetch GBIF data for enrichment
    if GBIF_SPECIES_LIMIT > 0:
        species_list = df_merged['scientific_name'].unique().tolist()
        df_gbif = fetch_gbif_data(species_list)
        if not df_gbif.empty:
            df_merged = pd.concat([df_merged, df_gbif], ignore_index=True)
            print(f">> After GBIF enrichment: {len(df_merged)} records")
    
    # ── Final Cleaning ──
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
    
    # ── Output Statistics ──
    print("\n" + "=" * 60)
    print("OUTPUT STATISTICS")
    print("=" * 60)
    print(f"Total Records: {len(df_merged)}")
    print(f"Unique Species: {df_merged['scientific_name'].nunique()}")
    print(f"Unique Genera: {df_merged['genus'].nunique()}")
    print(f"Unique Mimicry Rings: {df_merged['mimicry_ring'].nunique()}")
    print(f"Records with Images: {df_merged['image_url'].notna().sum()}")
    print("\nBy Source:")
    print(df_merged['source'].value_counts().to_string())
    print("\nBy Sequencing Status:")
    print(df_merged['sequencing_status'].value_counts().to_string())
    
    # ── Save Output ──
    output_path = os.path.join(OUTPUT_DIR, "map_points.json")
    
    # Convert to list of dicts for JSON
    records = df_merged.to_dict(orient='records')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False)
    
    print(f"\n>> Saved to: {output_path}")
    print(f">> File size: {os.path.getsize(output_path) / 1024:.1f} KB")
    print("\nDone!")


if __name__ == "__main__":
    main()
