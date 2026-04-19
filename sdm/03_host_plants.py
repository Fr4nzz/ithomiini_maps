#!/usr/bin/env python3
"""
Step 3: Build host plant distribution layers.
Downloads Solanaceae (and Apocynaceae) occurrence records from GBIF,
then rasterizes them as environmental predictors for SDM.
"""

import json
import yaml
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import rasterio
from rasterio.transform import from_bounds
from pathlib import Path
from tqdm import tqdm
import requests
import time

CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH) as f:
    config = yaml.safe_load(f)

HOST_PLANTS_PATH = Path(__file__).parent / "data/host_plants/ithomiini_host_plants.json"
ENV_DIR = Path(__file__).parent / config['paths']['env_variables']
HOST_DIR = Path(__file__).parent / config['paths']['host_plants']
HOST_DIR.mkdir(parents=True, exist_ok=True)

EXTENT = config['study_area']


def get_gbif_taxon_key(genus_name):
    """Look up the GBIF taxon key for a genus."""
    try:
        r = requests.get(
            'https://api.gbif.org/v1/species/match',
            params={'name': genus_name, 'rank': 'GENUS'},
            timeout=30
        )
        r.raise_for_status()
        data = r.json()
        key = data.get('usageKey')
        if key:
            print(f"    GBIF taxon key for {genus_name}: {key}")
        return key
    except Exception as e:
        print(f"    Could not get taxon key for {genus_name}: {e}")
        return None


def download_gbif_occurrences(genus, family, max_records=50000):
    """
    Download occurrence records for a plant genus from GBIF using the API.
    Returns a DataFrame with lat/lng coordinates.
    """
    cache_file = HOST_DIR / f"gbif_{genus.lower()}_occurrences.csv"
    if cache_file.exists():
        print(f"  Using cached {genus} occurrences")
        return pd.read_csv(cache_file)

    print(f"  Downloading {genus} ({family}) occurrences from GBIF...")

    # Get taxon key first
    taxon_key = get_gbif_taxon_key(genus)
    if not taxon_key:
        print(f"    Could not resolve {genus} in GBIF taxonomy")
        return pd.DataFrame()

    base_url = "https://api.gbif.org/v1/occurrence/search"

    all_records = []
    offset = 0
    limit = 300  # GBIF max per request

    while offset < min(max_records, 10000):  # Cap at 10K to avoid long waits
        params = {
            'taxonKey': taxon_key,
            'hasCoordinate': 'true',
            'decimalLatitude': f'{EXTENT["south"]},{EXTENT["north"]}',
            'decimalLongitude': f'{EXTENT["west"]},{EXTENT["east"]}',
            'limit': limit,
            'offset': offset,
        }

        try:
            response = requests.get(base_url, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"    GBIF API error at offset {offset}: {e}")
            break

        results = data.get('results', [])
        if not results:
            break

        for r in results:
            lat = r.get('decimalLatitude')
            lng = r.get('decimalLongitude')
            if lat is not None and lng is not None:
                all_records.append({
                    'genus': genus,
                    'species': r.get('species', ''),
                    'lat': lat,
                    'lng': lng,
                })

        offset += limit

        if data.get('endOfRecords', False):
            break

        time.sleep(0.3)  # Be nice to GBIF API

    df = pd.DataFrame(all_records)
    print(f"    Downloaded {len(df)} records for {genus}")

    if len(df) > 0:
        df.to_csv(cache_file, index=False)

    return df


def rasterize_host_plant_occurrences(df, output_path, resolution=0.08333):
    """
    Create a raster layer from host plant occurrence points.
    Values represent the density of host plant records per cell.

    Args:
        df: DataFrame with lat/lng columns
        output_path: Path for output GeoTIFF
        resolution: Cell size in degrees (~10km default for host plants)
    """
    if output_path.exists():
        print(f"  Already rasterized: {output_path.name}")
        return

    if len(df) == 0:
        print(f"  WARNING: No records to rasterize for {output_path.name}")
        return

    # Create grid
    lons = np.arange(EXTENT['west'], EXTENT['east'], resolution)
    lats = np.arange(EXTENT['south'], EXTENT['north'], resolution)
    grid = np.zeros((len(lats), len(lons)), dtype=np.float32)

    # Count points per cell
    for _, row in df.iterrows():
        col = int((row['lng'] - EXTENT['west']) / resolution)
        r = int((row['lat'] - EXTENT['south']) / resolution)
        if 0 <= r < len(lats) and 0 <= col < len(lons):
            grid[r, col] += 1

    # Normalize to 0-1 (log scale to handle heavy-tailed distributions)
    mask = grid > 0
    if mask.any():
        grid[mask] = np.log1p(grid[mask])
        grid[mask] = grid[mask] / grid[mask].max()

    # Flip vertically for rasterio (top-to-bottom)
    grid = np.flipud(grid)

    # Save
    transform = from_bounds(
        EXTENT['west'], EXTENT['south'],
        EXTENT['east'], EXTENT['north'],
        len(lons), len(lats)
    )

    with rasterio.open(
        output_path, 'w',
        driver='GTiff',
        height=len(lats),
        width=len(lons),
        count=1,
        dtype='float32',
        crs='EPSG:4326',
        transform=transform,
        nodata=-9999.0,
        compress='deflate'
    ) as dst:
        dst.write(grid, 1)

    print(f"  Rasterized: {output_path.name} ({len(lons)}x{len(lats)}, "
          f"{mask.sum()} cells with data)")


def main():
    print("=" * 70)
    print("STEP 3: BUILD HOST PLANT DISTRIBUTION LAYERS")
    print("=" * 70)

    # Load host plant database
    with open(HOST_PLANTS_PATH) as f:
        host_data = json.load(f)

    target_genera = host_data['host_plant_gbif_search']['target_genera']

    # Download occurrences for each target genus
    print("\n1. Downloading host plant occurrences from GBIF...")
    all_host_records = []

    for entry in target_genera:
        genus = entry['genus']
        family = entry['family']
        priority = entry['priority']

        max_records = {'critical': 30000, 'high': 15000, 'medium': 5000}.get(priority, 3000)
        df = download_gbif_occurrences(genus, family, max_records=max_records)
        if len(df) > 0:
            all_host_records.append(df)

    if not all_host_records:
        print("\nWARNING: No host plant records downloaded!")
        print("Step 3 complete (no host plant layers created).")
        return

    # Create individual genus rasters
    print("\n2. Creating per-genus host plant rasters...")
    cropped_dir = ENV_DIR / "cropped"
    cropped_dir.mkdir(parents=True, exist_ok=True)

    for entry in target_genera:
        genus = entry['genus']
        cache_file = HOST_DIR / f"gbif_{genus.lower()}_occurrences.csv"
        if cache_file.exists():
            df = pd.read_csv(cache_file)
            output_path = cropped_dir / f"host_{genus.lower()}_density.tif"
            rasterize_host_plant_occurrences(df, output_path)

    # Create combined Solanaceae raster (all host plant genera merged)
    print("\n3. Creating combined host plant availability raster...")
    combined = pd.concat(all_host_records, ignore_index=True)
    combined_path = cropped_dir / "host_solanaceae_combined_density.tif"
    rasterize_host_plant_occurrences(combined, combined_path)

    # Summary
    print(f"\n  Summary:")
    print(f"    Total host plant records: {len(combined)}")
    for entry in target_genera:
        genus = entry['genus']
        cache_file = HOST_DIR / f"gbif_{genus.lower()}_occurrences.csv"
        if cache_file.exists():
            count = len(pd.read_csv(cache_file))
            print(f"    {genus}: {count} records")

    print("\nStep 3 complete!")


if __name__ == "__main__":
    main()
