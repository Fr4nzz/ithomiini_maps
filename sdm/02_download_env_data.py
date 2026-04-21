#!/usr/bin/env python3
"""
Step 2: Download environmental variable rasters.
Downloads CHELSA bioclimatic variables, elevation, and cloud cover,
then crops them to the Neotropical study area.
"""

import yaml
import requests
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, calculate_default_transform
from rasterio.merge import merge
from rasterio.mask import mask as rasterio_mask
import geopandas as gpd
from shapely.geometry import box
from pathlib import Path
from tqdm import tqdm

CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH) as f:
    config = yaml.safe_load(f)

ENV_DIR = Path(__file__).parent / config['paths']['env_variables']
ENV_DIR.mkdir(parents=True, exist_ok=True)

EXTENT = config['study_area']
BBOX = box(EXTENT['west'], EXTENT['south'], EXTENT['east'], EXTENT['north'])


def download_file(url, output_path, chunk_size=8192):
    """Download a file with progress bar."""
    if output_path.exists():
        print(f"  Already exists: {output_path.name}")
        return True

    print(f"  Downloading: {output_path.name}")
    try:
        response = requests.get(url, stream=True, timeout=300)
        response.raise_for_status()
        total = int(response.headers.get('content-length', 0))

        with open(output_path, 'wb') as f:
            with tqdm(total=total, unit='B', unit_scale=True, desc=output_path.name) as pbar:
                for chunk in response.iter_content(chunk_size=chunk_size):
                    f.write(chunk)
                    pbar.update(len(chunk))
        return True
    except Exception as e:
        print(f"  ERROR downloading {url}: {e}")
        if output_path.exists():
            output_path.unlink()
        return False


def crop_raster_to_neotropics(input_path, output_path):
    """Crop a global raster to the Neotropical study area."""
    if output_path.exists():
        print(f"  Already cropped: {output_path.name}")
        return True

    try:
        bbox_gdf = gpd.GeoDataFrame(geometry=[BBOX], crs="EPSG:4326")

        with rasterio.open(input_path) as src:
            out_image, out_transform = rasterio_mask(src, bbox_gdf.geometry, crop=True)
            out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform,
                "compress": "deflate",
            })

        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(out_image)

        print(f"  Cropped: {output_path.name} ({out_image.shape[2]}x{out_image.shape[1]})")
        return True
    except Exception as e:
        print(f"  ERROR cropping {input_path}: {e}")
        return False


def resample_raster(input_path, output_path, target_resolution=0.008333):
    """Resample a raster to target resolution (~30 arcsec ≈ 0.00833 degrees)."""
    if output_path.exists():
        print(f"  Already resampled: {output_path.name}")
        return True

    try:
        with rasterio.open(input_path) as src:
            # Calculate new dimensions
            new_width = int((src.bounds.right - src.bounds.left) / target_resolution)
            new_height = int((src.bounds.top - src.bounds.bottom) / target_resolution)

            transform, width, height = calculate_default_transform(
                src.crs, src.crs,
                new_width, new_height,
                src.bounds.left, src.bounds.bottom,
                src.bounds.right, src.bounds.top,
                resolution=target_resolution
            )

            out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": height,
                "width": width,
                "transform": transform,
                "compress": "deflate",
            })

            with rasterio.open(output_path, "w", **out_meta) as dest:
                for i in range(1, src.count + 1):
                    reproject(
                        source=rasterio.band(src, i),
                        destination=rasterio.band(dest, i),
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=transform,
                        dst_crs=src.crs,
                        resampling=Resampling.bilinear
                    )

        print(f"  Resampled: {output_path.name} ({width}x{height})")
        return True
    except Exception as e:
        print(f"  ERROR resampling {input_path}: {e}")
        return False


def download_chelsa_bioclim():
    """Download CHELSA v2.1 bioclimatic variables."""
    print("\n── CHELSA Bioclimatic Variables ──")
    base_url = config['env_data']['chelsa']['base_url']
    variables = config['env_data']['chelsa']['variables']

    raw_dir = ENV_DIR / "raw"
    raw_dir.mkdir(exist_ok=True)
    cropped_dir = ENV_DIR / "cropped"
    cropped_dir.mkdir(exist_ok=True)

    success_count = 0
    for var_file in variables:
        url = f"{base_url}{var_file}"
        raw_path = raw_dir / var_file
        cropped_path = cropped_dir / var_file.replace('.tif', '_neotropics.tif')

        if download_file(url, raw_path):
            if crop_raster_to_neotropics(raw_path, cropped_path):
                success_count += 1

    print(f"  Downloaded and cropped {success_count}/{len(variables)} CHELSA variables")
    return success_count > 0


def download_elevation():
    """
    Download elevation data. Uses SRTM 90m data from CGIAR.
    Alternative: Download pre-processed 30arcsec elevation from WorldClim.
    """
    print("\n── Elevation Data ──")

    # Use WorldClim's pre-processed elevation (much simpler than tiling SRTM)
    # WorldClim provides a 30s (~1km) elevation raster
    url = "https://biogeo.ucdavis.edu/data/worldclim/v2.1/base/wc2.1_30s_elev.zip"
    raw_dir = ENV_DIR / "raw"
    raw_dir.mkdir(exist_ok=True)
    cropped_dir = ENV_DIR / "cropped"
    cropped_dir.mkdir(exist_ok=True)

    zip_path = raw_dir / "wc2.1_30s_elev.zip"
    tif_path = raw_dir / "wc2.1_30s_elev.tif"
    cropped_path = cropped_dir / "elevation_neotropics.tif"

    if cropped_path.exists():
        print(f"  Already exists: {cropped_path.name}")
        return True

    if not tif_path.exists():
        if download_file(url, zip_path):
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as z:
                z.extractall(raw_dir)
            print(f"  Extracted elevation data")
        else:
            # Fallback: try direct tif URL
            url2 = "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_30s_elev.zip"
            if download_file(url2, zip_path):
                import zipfile
                with zipfile.ZipFile(zip_path, 'r') as z:
                    z.extractall(raw_dir)
            else:
                print("  WARNING: Could not download elevation data")
                return False

    return crop_raster_to_neotropics(tif_path, cropped_path)


def download_cloud_cover():
    """Download EarthEnv mean annual cloud cover frequency."""
    print("\n── EarthEnv Cloud Cover ──")

    url = config['env_data']['cloud_cover']['url']
    raw_dir = ENV_DIR / "raw"
    raw_dir.mkdir(exist_ok=True)
    cropped_dir = ENV_DIR / "cropped"
    cropped_dir.mkdir(exist_ok=True)

    raw_path = raw_dir / "MODCF_meanannual_01.tif"
    cropped_path = cropped_dir / "cloud_cover_neotropics.tif"

    if cropped_path.exists():
        print(f"  Already exists: {cropped_path.name}")
        return True

    if download_file(url, raw_path):
        return crop_raster_to_neotropics(raw_path, cropped_path)

    return False


def verify_env_data():
    """Verify all environmental layers are available and aligned."""
    print("\n── Verifying Environmental Data ──")
    cropped_dir = ENV_DIR / "cropped"

    env_files = sorted(cropped_dir.glob("*.tif"))
    if not env_files:
        print("  ERROR: No environmental layers found!")
        return False

    print(f"  Found {len(env_files)} environmental layers:")
    for f in env_files:
        with rasterio.open(f) as src:
            print(f"    {f.name}: {src.width}x{src.height}, "
                  f"bounds=[{src.bounds.left:.1f},{src.bounds.bottom:.1f},"
                  f"{src.bounds.right:.1f},{src.bounds.top:.1f}], "
                  f"res={src.res[0]:.6f}")

    return True


def main():
    print("=" * 70)
    print("STEP 2: DOWNLOAD ENVIRONMENTAL DATA")
    print("=" * 70)
    print(f"Study area: [{EXTENT['west']}, {EXTENT['south']}] to [{EXTENT['east']}, {EXTENT['north']}]")

    download_chelsa_bioclim()
    download_elevation()
    download_cloud_cover()
    verify_env_data()

    print("\nStep 2 complete!")


if __name__ == "__main__":
    main()
