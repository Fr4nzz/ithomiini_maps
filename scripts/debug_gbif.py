#!/usr/bin/env python3
"""
Debug script to inspect GBIF Ithomiini data structure
Run this to understand what fields are available and how to properly parse them
"""

import requests
import json

# GBIF API for Ithomiini occurrences
ITHOMIINI_TAXON_KEY = 5568  # Tribe Ithomiini

def fetch_sample_gbif_records():
    """Fetch sample records to inspect structure"""
    
    # Get more records with full details
    url = "https://api.gbif.org/v1/occurrence/search"
    params = {
        "taxonKey": ITHOMIINI_TAXON_KEY,
        "limit": 50,  # Get 50 samples
        "hasCoordinate": True,
        "hasGeospatialIssue": False,
    }
    
    print("Fetching GBIF sample records...")
    response = requests.get(url, params=params)
    data = response.json()
    
    print(f"\nTotal records available: {data.get('count', 0)}")
    print(f"Records in this sample: {len(data.get('results', []))}")
    
    if not data.get('results'):
        print("No results found!")
        return
    
    # Analyze first record structure
    print("\n" + "="*80)
    print("SAMPLE RECORD STRUCTURE (First Record)")
    print("="*80)
    
    sample = data['results'][0]
    
    # Print all keys
    print("\nAll available fields:")
    for key in sorted(sample.keys()):
        value = sample[key]
        if isinstance(value, str) and len(value) > 100:
            value = value[:100] + "..."
        print(f"  {key}: {value}")
    
    # Focus on taxonomy fields
    print("\n" + "="*80)
    print("TAXONOMY FIELDS ANALYSIS")
    print("="*80)
    
    taxonomy_fields = [
        'kingdom', 'phylum', 'class', 'order', 'family', 'subfamily',
        'genus', 'species', 'specificEpithet', 'infraspecificEpithet',
        'scientificName', 'verbatimScientificName', 'acceptedScientificName',
        'taxonRank', 'taxonomicStatus', 'genericName',
        'scientificNameAuthorship', 'acceptedTaxonKey', 'speciesKey'
    ]
    
    print("\nTaxonomy fields in first record:")
    for field in taxonomy_fields:
        if field in sample:
            print(f"  {field}: {sample.get(field)}")
    
    # Quality/grade fields
    print("\n" + "="*80)
    print("QUALITY/GRADE FIELDS")
    print("="*80)
    
    quality_fields = [
        'basisOfRecord', 'occurrenceStatus', 'issues', 'license',
        'institutionCode', 'collectionCode', 'datasetName',
        'coordinateUncertaintyInMeters', 'coordinatePrecision'
    ]
    
    print("\nQuality fields in first record:")
    for field in quality_fields:
        if field in sample:
            print(f"  {field}: {sample.get(field)}")
    
    # Media/images
    print("\n" + "="*80)
    print("MEDIA/IMAGES")
    print("="*80)
    
    if 'media' in sample:
        print(f"\nMedia present: {len(sample['media'])} items")
        for i, media in enumerate(sample['media'][:3]):
            print(f"\n  Media {i+1}:")
            for k, v in media.items():
                print(f"    {k}: {v}")
    else:
        print("\nNo media field in this record")
    
    # Analyze multiple records for variety
    print("\n" + "="*80)
    print("ANALYSIS OF ALL SAMPLE RECORDS")
    print("="*80)
    
    # Count basisOfRecord types
    basis_counts = {}
    taxonomy_status_counts = {}
    has_subspecies = 0
    has_media = 0
    species_formats = set()
    
    for rec in data['results']:
        basis = rec.get('basisOfRecord', 'UNKNOWN')
        basis_counts[basis] = basis_counts.get(basis, 0) + 1
        
        status = rec.get('taxonomicStatus', 'UNKNOWN')
        taxonomy_status_counts[status] = taxonomy_status_counts.get(status, 0) + 1
        
        if rec.get('infraspecificEpithet'):
            has_subspecies += 1
        
        if rec.get('media'):
            has_media += 1
        
        # Check species name format
        sp = rec.get('species', '')
        if sp:
            species_formats.add(sp[:50])
    
    print(f"\nBasis of Record distribution:")
    for k, v in sorted(basis_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    
    print(f"\nTaxonomic Status distribution:")
    for k, v in sorted(taxonomy_status_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    
    print(f"\nRecords with subspecies (infraspecificEpithet): {has_subspecies}/{len(data['results'])}")
    print(f"Records with media/images: {has_media}/{len(data['results'])}")
    
    print(f"\nSample species name formats:")
    for sp in list(species_formats)[:10]:
        print(f"  {sp}")
    
    # Find a record with media
    print("\n" + "="*80)
    print("RECORD WITH MEDIA (if available)")
    print("="*80)
    
    for rec in data['results']:
        if rec.get('media'):
            print(f"\nFound record with media: {rec.get('gbifID')}")
            print(f"  scientificName: {rec.get('scientificName')}")
            print(f"  species: {rec.get('species')}")
            print(f"  media count: {len(rec['media'])}")
            for m in rec['media'][:2]:
                print(f"  - type: {m.get('type')}, format: {m.get('format')}")
                print(f"    identifier: {m.get('identifier', 'N/A')[:100]}")
            break
    
    # Find a record with subspecies
    print("\n" + "="*80)
    print("RECORD WITH SUBSPECIES (if available)")
    print("="*80)
    
    for rec in data['results']:
        if rec.get('infraspecificEpithet'):
            print(f"\nFound record with subspecies: {rec.get('gbifID')}")
            print(f"  scientificName: {rec.get('scientificName')}")
            print(f"  species: {rec.get('species')}")
            print(f"  genus: {rec.get('genus')}")
            print(f"  specificEpithet: {rec.get('specificEpithet')}")
            print(f"  infraspecificEpithet: {rec.get('infraspecificEpithet')}")
            print(f"  taxonRank: {rec.get('taxonRank')}")
            break
    
    # Save full sample for inspection
    with open('gbif_sample_debug.json', 'w') as f:
        json.dump(data['results'][:10], f, indent=2)
    print("\n\nFull sample saved to gbif_sample_debug.json")
    
    return data

def check_total_ithomiini_records():
    """Check how many total Ithomiini records exist"""
    
    print("\n" + "="*80)
    print("TOTAL ITHOMIINI RECORDS IN GBIF")
    print("="*80)
    
    url = "https://api.gbif.org/v1/occurrence/search"
    
    # All records
    params = {"taxonKey": ITHOMIINI_TAXON_KEY, "limit": 0}
    r = requests.get(url, params=params)
    total = r.json().get('count', 0)
    print(f"\nAll Ithomiini records: {total:,}")
    
    # With coordinates
    params["hasCoordinate"] = True
    r = requests.get(url, params=params)
    with_coords = r.json().get('count', 0)
    print(f"With coordinates: {with_coords:,}")
    
    # Research grade equivalent (HUMAN_OBSERVATION)
    params["basisOfRecord"] = "HUMAN_OBSERVATION"
    r = requests.get(url, params=params)
    human_obs = r.json().get('count', 0)
    print(f"Human observations with coords: {human_obs:,}")
    
    # Preserved specimens
    params["basisOfRecord"] = "PRESERVED_SPECIMEN"
    r = requests.get(url, params=params)
    preserved = r.json().get('count', 0)
    print(f"Preserved specimens with coords: {preserved:,}")
    
    # With images
    del params["basisOfRecord"]
    params["mediaType"] = "StillImage"
    r = requests.get(url, params=params)
    with_images = r.json().get('count', 0)
    print(f"With images and coords: {with_images:,}")

if __name__ == "__main__":
    check_total_ithomiini_records()
    fetch_sample_gbif_records()
