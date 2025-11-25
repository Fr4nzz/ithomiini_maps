import pandas as pd
import os

FILE_PATH = "Dore_Ithomiini_records.xlsx"

def probe_local_excel():
    print(f"--- PROBING LOCAL FILE: {FILE_PATH} ---")
    
    if not os.path.exists(FILE_PATH):
        print(f"ERROR: File {FILE_PATH} not found in the root directory.")
        return

    try:
        df = pd.read_excel(FILE_PATH)
        
        # 1. Structure
        print(f"\n[1] DATAFRAME SHAPE: {df.shape}")
        print(f"[2] COLUMN NAMES: {list(df.columns)}")
        
        # 2. Data Types
        print("\n[3] DATA TYPES:")
        print(df.dtypes)
        
        # 3. Missing Coordinates Check
        # Adjusting for likely column names based on your description
        lat_col = next((c for c in df.columns if 'lat' in c.lower()), None)
        lon_col = next((c for c in df.columns if 'lon' in c.lower()), None)
        
        if lat_col and lon_col:
            missing_coords = df[df[lat_col].isna() | df[lon_col].isna()]
            print(f"\n[4] MISSING COORDINATES: {len(missing_coords)} records")
        else:
            print("\n[4] COORDINATE COLUMNS NOT FOUND (Check column names)")

        # 4. Categorical Sampling
        print("\n[5] CATEGORICAL SAMPLES (First 5 unique values):")
        for col in ['Genus', 'Species', 'Sub.species', 'M.mimicry', 'Country']:
            if col in df.columns:
                uniques = df[col].dropna().unique()
                print(f"   - {col}: {uniques[:5]} ({len(uniques)} total variations)")

    except Exception as e:
        print(f"CRITICAL ERROR reading Excel: {e}")

if __name__ == "__main__":
    probe_local_excel()