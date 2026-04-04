"""
Spatial utilities for the SDM pipeline.
Handles raster processing, spatial thinning, and coordinate operations.
"""

import numpy as np
import geopandas as gpd
from shapely.geometry import Point, box
from scipy.spatial import cKDTree
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
from pathlib import Path


def spatial_thin(points_gdf, distance_km):
    """
    Spatially thin occurrence points so no two points are within `distance_km` of each other.
    Uses a greedy algorithm with KD-tree for efficiency.

    Args:
        points_gdf: GeoDataFrame with geometry column (EPSG:4326)
        distance_km: Minimum distance between retained points in kilometers

    Returns:
        Thinned GeoDataFrame
    """
    if len(points_gdf) == 0:
        return points_gdf

    # Convert km to approximate degrees (rough: 1 degree ≈ 111 km at equator)
    distance_deg = distance_km / 111.0

    coords = np.array([(g.x, g.y) for g in points_gdf.geometry])
    tree = cKDTree(coords)

    keep = np.ones(len(coords), dtype=bool)
    # Randomize order to avoid spatial bias in thinning
    order = np.random.permutation(len(coords))

    for i in order:
        if not keep[i]:
            continue
        neighbors = tree.query_ball_point(coords[i], distance_deg)
        for j in neighbors:
            if j != i and keep[j]:
                keep[j] = False

    return points_gdf[keep].copy()


def generate_background_points(n_points, extent, occurrence_coords=None,
                               target_group_coords=None, min_distance_km=1.0):
    """
    Generate pseudo-absence / background points.

    Args:
        n_points: Number of background points to generate
        extent: Dict with west, east, south, north bounds
        occurrence_coords: Array of (lon, lat) occurrence points to avoid
        target_group_coords: Array of (lon, lat) for target-group background sampling
        min_distance_km: Minimum distance from occurrence points (km)

    Returns:
        GeoDataFrame of background points
    """
    min_distance_deg = min_distance_km / 111.0

    if target_group_coords is not None and len(target_group_coords) > 0:
        # Target-group background: sample from the distribution of all Ithomiini records
        # Add random jitter to avoid exact duplicates
        indices = np.random.choice(len(target_group_coords), size=n_points * 3, replace=True)
        candidates = target_group_coords[indices].copy()
        # Add jitter (~5km)
        candidates[:, 0] += np.random.normal(0, 0.05, len(candidates))
        candidates[:, 1] += np.random.normal(0, 0.05, len(candidates))
    else:
        # Random background within extent
        lons = np.random.uniform(extent['west'], extent['east'], n_points * 3)
        lats = np.random.uniform(extent['south'], extent['north'], n_points * 3)
        candidates = np.column_stack([lons, lats])

    # Clip to extent
    mask = (
        (candidates[:, 0] >= extent['west']) & (candidates[:, 0] <= extent['east']) &
        (candidates[:, 1] >= extent['south']) & (candidates[:, 1] <= extent['north'])
    )
    candidates = candidates[mask]

    # Remove points too close to occurrences
    if occurrence_coords is not None and len(occurrence_coords) > 0:
        occ_tree = cKDTree(occurrence_coords)
        distances, _ = occ_tree.query(candidates)
        candidates = candidates[distances > min_distance_deg]

    # Take requested number
    if len(candidates) > n_points:
        indices = np.random.choice(len(candidates), size=n_points, replace=False)
        candidates = candidates[indices]

    points = [Point(lon, lat) for lon, lat in candidates]
    return gpd.GeoDataFrame(geometry=points, crs="EPSG:4326")


def extract_values_at_points(raster_paths, points_gdf):
    """
    Extract raster values at point locations using efficient rasterio sampling.

    Args:
        raster_paths: List of paths to raster files
        points_gdf: GeoDataFrame with point geometries

    Returns:
        DataFrame with extracted values (columns named after raster files)
    """
    import pandas as pd

    coords = [(p.x, p.y) for p in points_gdf.geometry]
    results = {}

    for raster_path in raster_paths:
        path = Path(raster_path)
        var_name = path.stem

        with rasterio.open(raster_path) as src:
            # Use rasterio's efficient sample() method
            sampled = list(src.sample(coords))
            values = []
            for val_array in sampled:
                val = float(val_array[0])
                if src.nodata is not None and val == src.nodata:
                    values.append(np.nan)
                else:
                    values.append(val)

            results[var_name] = values

    return pd.DataFrame(results)


def create_prediction_grid(extent, resolution):
    """
    Create a regular grid of points for prediction.

    Args:
        extent: Dict with west, east, south, north
        resolution: Grid resolution in degrees

    Returns:
        GeoDataFrame of grid points, along with grid shape (rows, cols) and transform
    """
    lons = np.arange(extent['west'], extent['east'], resolution)
    lats = np.arange(extent['south'], extent['north'], resolution)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    points = [Point(lon, lat) for lon, lat in zip(lon_grid.ravel(), lat_grid.ravel())]
    gdf = gpd.GeoDataFrame(geometry=points, crs="EPSG:4326")

    grid_shape = (len(lats), len(lons))
    transform = from_bounds(
        extent['west'], extent['south'],
        extent['east'], extent['north'],
        len(lons), len(lats)
    )

    return gdf, grid_shape, transform, lons, lats


def save_prediction_raster(predictions, grid_shape, transform, output_path, crs="EPSG:4326"):
    """
    Save prediction array as a GeoTIFF.

    Args:
        predictions: 1D array of prediction values
        grid_shape: (rows, cols) tuple
        transform: Rasterio transform
        output_path: Path to save GeoTIFF
        crs: Coordinate reference system
    """
    prediction_grid = predictions.reshape(grid_shape)
    # Flip vertically because rasterio expects top-to-bottom
    prediction_grid = np.flipud(prediction_grid)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with rasterio.open(
        output_path, 'w',
        driver='GTiff',
        height=grid_shape[0],
        width=grid_shape[1],
        count=1,
        dtype='float32',
        crs=crs,
        transform=transform,
        nodata=-9999.0,
        compress='deflate'
    ) as dst:
        dst.write(prediction_grid.astype(np.float32), 1)


def crop_raster_to_extent(input_path, output_path, extent):
    """
    Crop a raster to the study area extent.

    Args:
        input_path: Path to input raster
        output_path: Path for cropped output
        extent: Dict with west, east, south, north
    """
    from rasterio.mask import mask as rasterio_mask

    bbox = box(extent['west'], extent['south'], extent['east'], extent['north'])
    bbox_gdf = gpd.GeoDataFrame(geometry=[bbox], crs="EPSG:4326")

    with rasterio.open(input_path) as src:
        out_image, out_transform = rasterio_mask(src, bbox_gdf.geometry, crop=True)
        out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform,
            "compress": "deflate"
        })

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(output_path, "w", **out_meta) as dest:
        dest.write(out_image)
