"""
Spatial utilities for the SDM pipeline.
Handles raster processing, spatial thinning, bias correction, VIF, and MESS.
"""

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, box
from scipy.spatial import cKDTree
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
from pathlib import Path


def spatial_thin(points_gdf, distance_km):
    """
    Spatially thin occurrence points so no two points are within distance_km.
    """
    if len(points_gdf) == 0:
        return points_gdf

    distance_deg = distance_km / 111.0
    coords = np.array([(g.x, g.y) for g in points_gdf.geometry])
    tree = cKDTree(coords)

    keep = np.ones(len(coords), dtype=bool)
    order = np.random.permutation(len(coords))

    for i in order:
        if not keep[i]:
            continue
        neighbors = tree.query_ball_point(coords[i], distance_deg)
        for j in neighbors:
            if j != i and keep[j]:
                keep[j] = False

    return points_gdf[keep].copy()


# ══════════════════════════════════════════════════════════════════════════════
# BIAS RASTER
# ══════════════════════════════════════════════════════════════════════════════


def create_bias_raster(all_coords, extent, resolution=0.1, bandwidth=1.0):
    """
    Create a kernel density estimate (KDE) bias raster from all occurrence records.
    Used to weight background point sampling so it matches collector effort.

    Args:
        all_coords: Array of (lon, lat) for all target-group records
        extent: Dict with west, east, south, north
        resolution: Grid resolution in degrees
        bandwidth: KDE bandwidth in degrees

    Returns:
        Tuple of (bias_values_1d, grid_coords_2d, grid_shape)
        where bias_values_1d can be used as sampling weights
    """
    from scipy.ndimage import gaussian_filter

    # Create grid
    lons = np.arange(extent["west"], extent["east"], resolution)
    lats = np.arange(extent["south"], extent["north"], resolution)
    grid_coords = np.column_stack([g.ravel() for g in np.meshgrid(lons, lats)])

    # Fast approach: bin counts + Gaussian smoothing (much faster than sklearn KDE)
    grid = np.zeros((len(lats), len(lons)), dtype=np.float64)
    for lon, lat in all_coords:
        col = int((lon - extent["west"]) / resolution)
        row = int((lat - extent["south"]) / resolution)
        if 0 <= row < len(lats) and 0 <= col < len(lons):
            grid[row, col] += 1

    # Gaussian smoothing (sigma in grid cells, bandwidth in degrees / resolution)
    sigma = bandwidth / resolution
    grid = gaussian_filter(grid, sigma=sigma)

    # Flatten to match grid_coords order (meshgrid is row-major)
    density = grid.ravel()

    # Normalize to probabilities
    density = density / density.sum()

    return density, grid_coords, (len(lats), len(lons))


def generate_background_points(
    n_points,
    extent,
    occurrence_coords=None,
    target_group_coords=None,
    bias_weights=None,
    bias_grid_coords=None,
    min_distance_km=1.0,
    accessible_polygon=None,
):
    """
    Generate pseudo-absence / background points.

    If bias_weights provided, sample proportional to bias surface.
    If accessible_polygon provided (shapely Polygon/MultiPolygon in lon/lat),
    candidates falling outside the polygon are discarded so background
    sampling respects spatially disjunct accessible-area shapes (e.g. a union
    of per-cluster buffered hulls). The function still falls back to the
    rectangular extent for the legacy single-hull strategy when polygon is None.
    """
    min_distance_deg = min_distance_km / 111.0

    if bias_weights is not None and bias_grid_coords is not None:
        indices = np.random.choice(
            len(bias_grid_coords), size=n_points * 3, replace=True, p=bias_weights
        )
        candidates = bias_grid_coords[indices].copy()
        jitter = np.random.uniform(-0.05, 0.05, candidates.shape)
        candidates += jitter
    elif target_group_coords is not None and len(target_group_coords) > 0:
        indices = np.random.choice(
            len(target_group_coords), size=n_points * 3, replace=True
        )
        candidates = target_group_coords[indices].copy()
        candidates[:, 0] += np.random.normal(0, 0.05, len(candidates))
        candidates[:, 1] += np.random.normal(0, 0.05, len(candidates))
    else:
        lons = np.random.uniform(extent["west"], extent["east"], n_points * 3)
        lats = np.random.uniform(extent["south"], extent["north"], n_points * 3)
        candidates = np.column_stack([lons, lats])

    mask = (
        (candidates[:, 0] >= extent["west"])
        & (candidates[:, 0] <= extent["east"])
        & (candidates[:, 1] >= extent["south"])
        & (candidates[:, 1] <= extent["north"])
    )
    candidates = candidates[mask]

    if accessible_polygon is not None and len(candidates) > 0:
        from shapely.prepared import prep
        prepared = prep(accessible_polygon)
        keep = np.array(
            [prepared.contains(Point(c[0], c[1])) for c in candidates], dtype=bool
        )
        candidates = candidates[keep]

    if occurrence_coords is not None and len(occurrence_coords) > 0:
        occ_tree = cKDTree(occurrence_coords)
        distances, _ = occ_tree.query(candidates)
        candidates = candidates[distances > min_distance_deg]

    if len(candidates) > n_points:
        indices = np.random.choice(len(candidates), size=n_points, replace=False)
        candidates = candidates[indices]

    points = [Point(lon, lat) for lon, lat in candidates]
    return gpd.GeoDataFrame(geometry=points, crs="EPSG:4326")


# ══════════════════════════════════════════════════════════════════════════════
# VIF (Variance Inflation Factor)
# ══════════════════════════════════════════════════════════════════════════════


def compute_vif(X, columns):
    """
    Compute Variance Inflation Factor for each variable.

    Args:
        X: 2D array of environmental values (samples x variables)
        columns: List of variable names

    Returns:
        DataFrame with variable names and VIF values
    """
    from numpy.linalg import lstsq

    n_vars = X.shape[1]
    vifs = []

    for i in range(n_vars):
        y_i = X[:, i]
        X_others = np.delete(X, i, axis=1)
        # Add intercept
        X_others = np.column_stack([np.ones(len(X_others)), X_others])
        # OLS regression
        coeffs, _, _, _ = lstsq(X_others, y_i, rcond=None)
        y_pred = X_others @ coeffs
        ss_res = np.sum((y_i - y_pred) ** 2)
        ss_tot = np.sum((y_i - y_i.mean()) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        vif = 1 / (1 - r_squared) if r_squared < 1 else np.inf
        vifs.append(vif)

    return pd.DataFrame({"variable": columns, "vif": vifs})


def filter_by_vif(X, columns, threshold=10.0):
    """
    Iteratively remove variables with VIF > threshold until all are below.

    Returns:
        Tuple of (filtered X array, filtered column names, removed columns)
    """
    cols = list(columns)
    removed = []

    while True:
        if len(cols) <= 2:
            break

        # Rebuild X for current columns
        col_indices = [columns.index(c) for c in cols]
        X_sub = X[:, col_indices]

        # Remove NaN rows for VIF computation
        valid = ~np.isnan(X_sub).any(axis=1)
        X_valid = X_sub[valid]

        if len(X_valid) < 10:
            break

        vif_df = compute_vif(X_valid, cols)
        max_vif = vif_df["vif"].max()

        if max_vif <= threshold:
            break

        # Remove variable with highest VIF
        worst = vif_df.loc[vif_df["vif"].idxmax(), "variable"]
        cols.remove(worst)
        removed.append(worst)

    col_indices = [columns.index(c) for c in cols]
    return X[:, col_indices], cols, removed


# ══════════════════════════════════════════════════════════════════════════════
# MESS (Multivariate Environmental Similarity Surface)
# ══════════════════════════════════════════════════════════════════════════════


def compute_mess(training_env, prediction_env):
    """
    Compute MESS (Multivariate Environmental Similarity Surface).
    Identifies areas where prediction grid is outside training data range.

    Values:
      > 0: within training envelope (higher = more similar)
      < 0: outside training envelope (extrapolation)
      Most negative variable determines the MESS value.

    Args:
        training_env: 2D array (n_train x n_vars) of training environmental values
        prediction_env: 2D array (n_pred x n_vars) of prediction grid values

    Returns:
        1D array of MESS values for each prediction point
    """
    n_pred = prediction_env.shape[0]
    n_vars = prediction_env.shape[1]

    # For each variable, compute the similarity
    similarities = np.full((n_pred, n_vars), np.nan)

    for j in range(n_vars):
        train_vals = training_env[:, j]
        train_vals = train_vals[~np.isnan(train_vals)]
        if len(train_vals) == 0:
            continue

        f_min = train_vals.min()
        f_max = train_vals.max()
        f_range = f_max - f_min

        if f_range == 0:
            similarities[:, j] = 0
            continue

        pred_vals = prediction_env[:, j]

        for i in range(n_pred):
            p = pred_vals[i]
            if np.isnan(p):
                similarities[i, j] = np.nan
                continue

            if p < f_min:
                # Below minimum: % of training below this value = 0
                similarities[i, j] = ((p - f_min) / f_range) * 100
            elif p > f_max:
                # Above maximum
                similarities[i, j] = ((f_max - p) / f_range) * 100
            else:
                # Within range: compute percentile
                f = np.sum(train_vals <= p) / len(train_vals) * 100
                similarities[i, j] = min(f, 100 - f)  # Distance from nearest edge

    # MESS = minimum similarity across all variables
    mess = np.nanmin(similarities, axis=1)
    return mess


# ══════════════════════════════════════════════════════════════════════════════
# RASTER I/O
# ══════════════════════════════════════════════════════════════════════════════


def extract_values_at_points(raster_paths, points_gdf):
    """Extract raster values at point locations using efficient rasterio sampling."""
    coords = [(p.x, p.y) for p in points_gdf.geometry]
    results = {}

    for raster_path in raster_paths:
        path = Path(raster_path)
        var_name = path.stem

        with rasterio.open(raster_path) as src:
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
    """Create a regular grid of points for prediction."""
    lons = np.arange(extent["west"], extent["east"], resolution)
    lats = np.arange(extent["south"], extent["north"], resolution)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    points = [Point(lon, lat) for lon, lat in zip(lon_grid.ravel(), lat_grid.ravel())]
    gdf = gpd.GeoDataFrame(geometry=points, crs="EPSG:4326")

    grid_shape = (len(lats), len(lons))
    actual_east = lons[-1] + resolution
    actual_north = lats[-1] + resolution
    transform = from_bounds(
        extent["west"], extent["south"], actual_east, actual_north, len(lons), len(lats)
    )

    return gdf, grid_shape, transform, lons, lats


def save_prediction_raster(
    predictions, grid_shape, transform, output_path, crs="EPSG:4326"
):
    """Save prediction array as a GeoTIFF."""
    prediction_grid = predictions.reshape(grid_shape)
    prediction_grid = np.flipud(prediction_grid)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with rasterio.open(
        output_path,
        "w",
        driver="GTiff",
        height=grid_shape[0],
        width=grid_shape[1],
        count=1,
        dtype="float32",
        crs=crs,
        transform=transform,
        nodata=-9999.0,
        compress="deflate",
    ) as dst:
        dst.write(prediction_grid.astype(np.float32), 1)


def crop_raster_to_extent(input_path, output_path, extent):
    """Crop a raster to the study area extent."""
    from rasterio.mask import mask as rasterio_mask

    bbox = box(extent["west"], extent["south"], extent["east"], extent["north"])
    bbox_gdf = gpd.GeoDataFrame(geometry=[bbox], crs="EPSG:4326")

    with rasterio.open(input_path) as src:
        out_image, out_transform = rasterio_mask(src, bbox_gdf.geometry, crop=True)
        out_meta = src.meta.copy()
        out_meta.update(
            {
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform,
                "compress": "deflate",
            }
        )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(output_path, "w", **out_meta) as dest:
        dest.write(out_image)
