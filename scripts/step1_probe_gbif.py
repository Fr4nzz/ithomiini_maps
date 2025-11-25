import requests
import json

def probe_gbif():
    print("--- PROBING GBIF API STRUCTURE ---")
    
    species_name = "Aeria elara"
    print(f"Target Species: {species_name}")

    # 1. MATCH SPECIES NAME TO ID (USAGE KEY)
    match_url = "https://api.gbif.org/v1/species/match"
    params = {'name': species_name, 'kingdom': 'Animalia'}
    
    try:
        r = requests.get(match_url, params=params)
        data = r.json()
        usage_key = data.get('usageKey')
        print(f"\n[1] BACKBONE MATCH:")
        print(f"   - Match Type: {data.get('matchType')}")
        print(f"   - Accepted Name: {data.get('scientificName')}")
        print(f"   - Usage Key: {usage_key}")
        
        if not usage_key:
            print("   - No usage key found. Aborting.")
            return

        # 2. SEARCH FOR OCCURRENCES WITH IMAGES
        search_url = "https://api.gbif.org/v1/occurrence/search"
        search_params = {
            'taxonKey': usage_key,
            'mediaType': 'StillImage', # We specifically want records with photos
            'limit': 1
        }
        
        r_occ = requests.get(search_url, params=search_params)
        occ_data = r_occ.json()
        
        count = occ_data.get('count', 0)
        print(f"\n[2] OCCURRENCE SEARCH:")
        print(f"   - Total records with images: {count}")
        
        if count > 0:
            record = occ_data['results'][0]
            print("\n[3] SAMPLE RECORD STRUCTURE (Keys found):")
            print(list(record.keys()))
            
            print("\n[4] CRITICAL FIELDS INSPECTION:")
            print(f"   - decimalLatitude: {record.get('decimalLatitude')}")
            print(f"   - decimalLongitude: {record.get('decimalLongitude')}")
            print(f"   - eventDate: {record.get('eventDate')}")
            print(f"   - basisOfRecord: {record.get('basisOfRecord')}")
            
            print("\n[5] MEDIA/IMAGE STRUCTURE:")
            # This is often where developers get stuck. Let's see how GBIF nests images.
            if 'media' in record:
                print(json.dumps(record['media'], indent=2))
            elif 'extensions' in record:
                print("   - Images might be in 'extensions'...")
                print(list(record['extensions'].keys()))
        else:
            print("   - No records found to analyze structure.")

    except Exception as e:
        print(f"CRITICAL ERROR querying GBIF: {e}")

if __name__ == "__main__":
    probe_gbif()