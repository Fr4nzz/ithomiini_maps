import pandas as pd
import requests
import re
import os
import json
import sys
import time

# --- CONFIGURATION ---
LOCAL_EXCEL_PATH = "Dore_Ithomiini_records.xlsx"
GOOGLE_SHEET_ID = "1QZj6YgHAJ9NmFXFPCtu-i-1NDuDmAdMF2Wogts7S2_4"
SHEET_GIDS = {
    "Collection_data": "900206579",
    "Photo_links": "439406691"
}
OUTPUT_DIR = "public/data"

# --- HELPER FUNCTIONS ---

def clean_id(series):
    """Normalizes IDs: removes spaces, uppercase, handles NaNs."""
    # Convert to string, upper case, strip whitespace
    s = series.astype(str).str.upper().str.strip()
    # Replace 'NAN', 'NONE', 'NA' with empty string
    s = s.replace({'NAN': '', 'NONE': '', 'NA': ''})
    return s

def get_google_export_url(gid):
    return f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}/export?format=csv&gid={gid}"

def determine_sequencing_status(row):
    """
    Returns: 'Sequenced', 'Tissue Available', or 'Preserved Specimen'
    """
    rack_1 = str(row.get('Tube_1_rack', ''))
    if 'Not in TOL' not in rack_1 and len(rack_1) > 5:
        return "Sequenced"
    
    tissue_1 = str(row.get('Tube_1_tissue', ''))
    if 'NOT_COLLECTED' not in tissue_1 and tissue_1 != 'nan' and tissue_1 != '':
        return "Tissue Available"
    
    return "Preserved Specimen"

# --- DATA LOADERS ---

def load_local_data():
    print(">> Loading Local Excel Data...")
    try:
        df = pd.read_excel(LOCAL_EXCEL_PATH)
        df = df.rename(columns={
            'Latitude': 'lat', 'Longitude': 'lng', 'Sub.species': 'subspecies',
            'M.mimicry': 'mimicry_ring', 'ID_obs': 'id'
        })
        
        df['source'] = "Dore et al. (2025)"
        df['sequencing_status'] = "Published"
        df['image_url'] = None
        df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
        df['lng'] = pd.to_numeric(df['lng'], errors='coerce')
        df['scientific_name'] = df['Genus'] + ' ' + df['Species']
        
        # Ensure ID is clean
        df['id'] = clean_id(df['id'])
        
        return df[['id', 'scientific_name', 'subspecies', 'lat', 'lng', 'mimicry_ring', 'source', 'sequencing_status', 'image_url', 'Country']]
    except Exception as e:
        print(f"Error loading local excel: {e}")
        return pd.DataFrame()

def load_sanger_data():
    print(">> Loading Sanger (Google Sheets) Data...")
    try:
        # 1. Load Data
        df_col = pd.read_csv(get_google_export_url(SHEET_GIDS["Collection_data"]), dtype=str)
        df_photo = pd.read_csv(get_google_export_url(SHEET_GIDS["Photo_links"]), dtype=str)
        
        # 2. Smart ID Selection (The Fix)
        # We prioritize 'CAM_ID'. If missing, try 'CAM_ID_insectary'.
        # We fill NAs in the preferred column with values from the fallback column.
        if 'CAM_ID' in df_col.columns:
            target_id = df_col['CAM_ID']
            if 'CAM_ID_insectary' in df_col.columns:
                target_id = target_id.fillna(df_col['CAM_ID_insectary'])
        else:
            # Fallback if names are weird
            target_id = df_col.iloc[:, 0] # First column?
            
        df_col['clean_id'] = clean_id(target_id)
        
        # 3. Photo Matching
        # Clean Photo IDs
        mask_raw = df_photo['Name'].str.contains(r'\.(?:ORF|CR2|NEF|ARW)$', case=False, regex=True, na=False)
        df_photo = df_photo[~mask_raw].copy()
        
        # Extract ID from filename
        extracted_ids = df_photo['Name'].str.extract(r'(CAM\d+)', flags=re.IGNORECASE)[0]
        df_photo['clean_id'] = clean_id(extracted_ids)
        
        # Create Proxy Links
        df_photo['google_id'] = df_photo['URL'].str.extract(r'file/d/(.*?)/view', expand=False)
        df_photo['proxy_url'] = "https://wsrv.nl/?url=https://drive.google.com/uc?id=" + df_photo['google_id'] + "&w=400&output=webp"
        
        photo_map = df_photo.groupby('clean_id')['proxy_url'].first()
        
        # 4. Process Columns
        df_col['sequencing_status'] = df_col.apply(determine_sequencing_status, axis=1)
        df_col['image_url'] = df_col['clean_id'].map(photo_map)
        
        df_col = df_col.rename(columns={
            'DECIMAL_LATITUDE': 'lat', 'DECIMAL_LONGITUDE': 'lng',
            'SPECIES': 'scientific_name', 'Subspecies_Form': 'subspecies'
        })
        
        # Coord fallback
        if 'lat' not in df_col.columns and 'Latitude' in df_col.columns:
            df_col['lat'] = df_col['Latitude']
            df_col['lng'] = df_col['Longitude']

        df_col['lat'] = pd.to_numeric(df_col['lat'], errors='coerce')
        df_col['lng'] = pd.to_numeric(df_col['lng'], errors='coerce')
        df_col['source'] = "Sanger Institute"
        df_col['mimicry_ring'] = "Unknown"
        df_col['id'] = df_col['clean_id']

        # Filter: Must have coordinates AND valid ID (optional, but "NAN" IDs are useless)
        df_col = df_col.dropna(subset=['lat', 'lng'])
        
        # If ID is empty string, label it "Unlabeled" instead of "NAN"
        df_col.loc[df_col['id'] == '', 'id'] = 'No ID'
        
        return df_col[['id', 'scientific_name', 'subspecies', 'lat', 'lng', 'mimicry_ring', 'source', 'sequencing_status', 'image_url', 'Country']]
        
    except Exception as e:
        print(f"Error loading Sanger data: {e}")
        return pd.DataFrame()

def fetch_gbif_data(species_list):
    print(f">> Fetching GBIF Data for {len(species_list)} species...")
    all_records = []
    # Using first 5 for speed in testing. REMOVE [:5] in production!
    targets = [s for s in set(species_list) if isinstance(s, str) and len(s) > 3]
    
    for sp in targets[:5]: 
        try:
            match_url = "https://api.gbif.org/v1/species/match"
            r = requests.get(match_url, params={'name': sp, 'kingdom': 'Animalia'})
            data = r.json()
            usage_key = data.get('usageKey')
            
            if not usage_key: continue
                
            search_url = "https://api.gbif.org/v1/occurrence/search"
            params = {'taxonKey': usage_key, 'hasCoordinate': 'true', 'limit': 50}
            r_occ = requests.get(search_url, params=params)
            results = r_occ.json().get('results', [])
            
            for rec in results:
                img_url = None
                if 'media' in rec:
                    for m in rec['media']:
                        if m.get('type') == 'StillImage':
                            img_url = m.get('identifier'); break
                
                all_records.append({
                    'id': str(rec.get('key')),
                    'scientific_name': rec.get('scientificName'),
                    'subspecies': rec.get('taxonomicStatus'),
                    'lat': rec.get('decimalLatitude'),
                    'lng': rec.get('decimalLongitude'),
                    'mimicry_ring': 'Unknown',
                    'source': 'GBIF',
                    'sequencing_status': 'Observation',
                    'image_url': img_url,
                    'Country': rec.get('country')
                })
        except Exception: continue
            
    return pd.DataFrame(all_records)

# --- MAIN ---

def main():
    if not os.path.exists(OUTPUT_DIR): os.makedirs(OUTPUT_DIR)

    df_local = load_local_data()
    df_sanger = load_sanger_data()
    
    species_list = df_local['scientific_name'].unique().tolist()
    df_gbif = fetch_gbif_data(species_list)
    
    print(">> Merging Datasets...")
    master_df = pd.concat([df_local, df_sanger, df_gbif], ignore_index=True)
    
    master_df['lat'] = master_df['lat'].astype(float)
    master_df['lng'] = master_df['lng'].astype(float)
    master_df = master_df.dropna(subset=['lat', 'lng'])
    
    map_cols = ['id', 'lat', 'lng', 'source', 'sequencing_status', 'mimicry_ring', 'scientific_name', 'subspecies', 'Country']
    master_df[map_cols].to_json(f"{OUTPUT_DIR}/map_points.json", orient='records')
    master_df.to_json(f"{OUTPUT_DIR}/full_dataset.json", orient='records')
    
    print(f"SUCCESS! Total records: {len(master_df)}")

if __name__ == "__main__":
    main()