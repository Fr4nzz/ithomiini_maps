import pandas as pd
import re
import sys
import warnings

# Suppress warnings for cleaner output
warnings.simplefilter(action='ignore', category=FutureWarning)
warnings.simplefilter(action='ignore', category=UserWarning)

# CONFIG FROM YOUR PROVIDED CODE
SHEET_ID = "1QZj6YgHAJ9NmFXFPCtu-i-1NDuDmAdMF2Wogts7S2_4"
SHEET_GIDS = {
    "Collection_data": "900206579",
    "Photo_links": "439406691"
}

def get_export_url(gid):
    return f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"

def probe_google_sheets():
    print("--- PROBING GOOGLE SHEETS DATA ---")
    
    try:
        # 1. DOWNLOAD
        print("Downloading Collection Data...")
        collection = pd.read_csv(get_export_url(SHEET_GIDS["Collection_data"]), dtype=str)
        print("Downloading Photo Links...")
        photos = pd.read_csv(get_export_url(SHEET_GIDS["Photo_links"]), dtype=str)
        
        # 2. ANALYZE COLLECTION COLUMNS
        print(f"\n[1] COLLECTION COLUMNS FOUND: {list(collection.columns)}")
        
        # 3. HUNT FOR SEQUENCING COLUMNS
        # We look for keywords related to the project scope
        potential_seq_cols = [c for c in collection.columns if any(x in c.lower() for x in ['tube', 'rack', 'seq', 'dna', 'status'])]
        print(f"\n[2] POTENTIAL SEQUENCING COLUMNS FOUND: {potential_seq_cols}")
        
        if potential_seq_cols:
            print("    Sample values from these columns:")
            for c in potential_seq_cols:
                print(f"    - {c}: {collection[c].dropna().unique()[:5]}")

        # 4. ANALYZE PHOTO LINKAGE
        # Reuse your regex logic to see if CAM_IDs match
        print("\n[3] PHOTO LINKAGE CHECK")
        
        # Extract CAM_ID from Photos
        mask_raw = photos['Name'].str.contains(r'\.(?:ORF|CR2|NEF|ARW)$', case=False, regex=True, na=False)
        photos_clean = photos[~mask_raw].copy()
        photos_clean['CAM_ID'] = photos_clean['Name'].str.extract(r'(CAM\d+)', flags=re.IGNORECASE)
        unique_photo_ids = set(photos_clean['CAM_ID'].dropna())
        
        # Extract CAM_ID from Collection
        # (Assuming 'CAM_ID' column exists, otherwise we look for it)
        col_cam_col = next((c for c in collection.columns if 'cam' in c.lower() and 'id' in c.lower()), 'CAM_ID')
        unique_col_ids = set(collection[col_cam_col].dropna())
        
        print(f"   - Unique Photo IDs found: {len(unique_photo_ids)}")
        print(f"   - Unique Collection IDs found: {len(unique_col_ids)}")
        print(f"   - Intersection (Matches): {len(unique_photo_ids.intersection(unique_col_ids))}")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    probe_google_sheets()