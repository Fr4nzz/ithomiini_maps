#!/usr/bin/env python3
"""
Step 4: Species Distribution Models (v3 — research-backed improvements).

Tiered modelling by sample size:
  n < 20:  Skip (insufficient data)
  n 20-49: MaxEnt only (RM 2.0, LQ features)
  n >= 50: MaxEnt + RF + XGBoost ensemble

Key changes from v1/v2:
  - Sample-size tiered algorithm selection (Wisz et al. 2008)
  - MaxEnt RM raised to 1.5-2.5 (Morales et al. 2017, Radosavljevic & Anderson 2014)
  - XGBoost depth 2-3, lr 0.01, early stopping (Elith et al. 2008)
  - RF max_depth capped at 8 (Valavi et al. 2021)
  - Jackknife CV for n < 30 (Pearson et al. 2007)
  - Spatial block CV for n >= 30
  - Species-specific accessible area (buffered convex hull, Barve et al. 2011)
  - Confidence ratings per species
  - Full Neotropical prediction extent
  - Exclude algorithms with AUC < 0.5 from ensemble
"""

import json
import yaml
import fnmatch
import numpy as np
import pandas as pd
import geopandas as gpd
from pathlib import Path
from scipy.spatial import ConvexHull
import warnings
import sys
import argparse

from sklearn.cluster import DBSCAN
from shapely.geometry import (
    Polygon as ShapelyPolygon,
    Point as ShapelyPoint,
    LineString,
)
from shapely.ops import unary_union

from utils.spatial import (
    create_bias_raster,
    generate_background_points,
    extract_values_at_points,
    create_prediction_grid,
    save_prediction_raster,
    filter_by_vif,
    compute_mess,
)
from utils.evaluation import (
    evaluate_model,
    spatial_block_cv,
)

warnings.filterwarnings("ignore")

CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH) as f:
    config = yaml.safe_load(f)

OCC_DIR = Path(__file__).parent / config["paths"]["occurrences"]
ENV_DIR = Path(__file__).parent / config["paths"]["env_variables"]
PRED_DIR = Path(__file__).parent / config["paths"]["predictions"]
OVERRIDES_PATH = Path(__file__).parent / "species_overrides.json"
PRED_DIR.mkdir(parents=True, exist_ok=True)


def load_species_overrides():
    """Per-species MaxEnt parameter overrides produced by 06_tune_weak_species.py.

    Returns a {safe_species_name: {maxent_rm, maxent_features, ...}} dict, or
    an empty dict if no overrides file exists yet.
    """
    if not OVERRIDES_PATH.exists():
        return {}
    try:
        return json.loads(OVERRIDES_PATH.read_text()).get("species", {})
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  ⚠ species_overrides.json unreadable ({exc}); ignoring")
        return {}


def apply_override(tier_config, species_name, overrides):
    """Return a copy of tier_config with species-specific params applied.

    Returns (adjusted_config, note) where note is a human-readable summary
    of what was overridden, or None if no override applies.
    """
    safe = species_name.replace(" ", "_").lower()
    ov = overrides.get(safe)
    if not ov:
        return tier_config, None

    adjusted = dict(tier_config)
    if "maxent_rm" in ov:
        adjusted["maxent_rm"] = ov["maxent_rm"]
    if "maxent_features" in ov:
        adjusted["maxent_features"] = list(ov["maxent_features"])

    parts = [
        f"RM={adjusted['maxent_rm']}",
        f"FC={'+'.join(adjusted['maxent_features'])}",
    ]
    if "tuned_boyce" in ov:
        parts.append(f"tuned Boyce={ov['tuned_boyce']:+.3f}")
    return adjusted, " ".join(parts)


# ── Tier configuration (Wisz et al. 2008, Morales et al. 2017) ──────────────

TIERS = {
    "small": {
        "min_records": 20,
        "max_records": 49,
        "algorithms": ["maxent"],
        "maxent_rm": 2.0,
        "maxent_features": ["linear", "quadratic"],
        "cv_strategy": "jackknife",
        "confidence": "low",
    },
    "medium": {
        "min_records": 50,
        "max_records": 99,
        "algorithms": ["maxent", "random_forest", "gbm"],
        "maxent_rm": 1.5,
        "maxent_features": ["linear", "quadratic", "hinge"],
        "cv_strategy": "spatial_block",
        "confidence": "medium",
    },
    "large": {
        "min_records": 100,
        "max_records": 99999,
        "algorithms": ["maxent", "random_forest", "gbm"],
        "maxent_rm": 1.5,
        "maxent_features": ["linear", "quadratic", "hinge"],
        "cv_strategy": "spatial_block",
        "confidence": "high",
    },
}


def get_tier(n_records):
    for tier_name, tier in TIERS.items():
        if tier["min_records"] <= n_records <= tier["max_records"]:
            return tier_name, tier
    return None, None


def get_env_rasters():
    cropped_dir = ENV_DIR / "cropped"
    exclude = config["env_data"].get("exclude_patterns", [])
    rasters = []
    for r in sorted(cropped_dir.glob("*.tif")):
        if not any(fnmatch.fnmatch(r.name, pat) for pat in exclude):
            rasters.append(r)

    if not rasters:
        print("ERROR: No environmental rasters found. Run step 02 first.")
        sys.exit(1)

    print(f"  {len(rasters)} environmental layers:")
    for r in rasters:
        print(f"    - {r.name}")
    return rasters


def load_species_data(species_name):
    safe_name = species_name.replace(" ", "_").lower()
    sp_path = OCC_DIR / "species" / f"{safe_name}.parquet"
    if not sp_path.exists():
        return None
    return gpd.read_parquet(sp_path)


def load_all_occurrences():
    all_path = OCC_DIR / "all_ithomiini_occurrences.parquet"
    if not all_path.exists():
        return None
    gdf = gpd.read_parquet(all_path)
    return np.array([(g.x, g.y) for g in gdf.geometry])


# ── Species-specific accessible area (Barve et al. 2011) ────────────────────


def compute_accessible_area(pres_coords, buffer_deg=3.0):
    """
    Legacy single-hull accessible area (Barve et al. 2011).

    Buffered convex hull of occurrences, clipped to study area. Falls back to
    a buffered centroid for fewer than 3 unique points. Kept for backward
    compatibility; prefer compute_accessible_area_v2 with config-driven options.
    """
    unique = np.unique(pres_coords, axis=0)
    study = config["study_area"]

    if len(unique) < 3:
        cx, cy = unique.mean(axis=0)
        return {
            "west": max(cx - buffer_deg, study["west"]),
            "east": min(cx + buffer_deg, study["east"]),
            "south": max(cy - buffer_deg, study["south"]),
            "north": min(cy + buffer_deg, study["north"]),
        }

    try:
        hull = ConvexHull(unique)
        hull_pts = unique[hull.vertices]
    except Exception:
        hull_pts = unique

    return {
        "west": max(hull_pts[:, 0].min() - buffer_deg, study["west"]),
        "east": min(hull_pts[:, 0].max() + buffer_deg, study["east"]),
        "south": max(hull_pts[:, 1].min() - buffer_deg, study["south"]),
        "north": min(hull_pts[:, 1].max() + buffer_deg, study["north"]),
    }


# ── Multi-cluster accessible area (DBSCAN + per-cluster buffered hulls) ──────


def _km_to_deg(km):
    """Approximate degrees-per-km at mid-latitudes; 1 deg lat ≈ 111 km."""
    return km / 111.0


def _polygon_area_km2(poly):
    """Approximate polygon area in km^2 from degree-units geometry.

    Uses a per-polygon mid-latitude correction: km_per_deg_lon shrinks with
    cos(latitude). Accurate enough for accessible-area sizing decisions; not
    suitable as a publication-quality area metric.
    """
    if poly is None or poly.is_empty:
        return 0.0
    cy = poly.centroid.y
    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.0 * np.cos(np.radians(cy))
    return float(poly.area * km_per_deg_lat * km_per_deg_lon)


def _buffer_for_cluster(cluster_pts, opts):
    """Return buffer distance in degrees for a single cluster of points."""
    strategy = opts.get("buffer_strategy", "fixed")
    if strategy == "fixed":
        return _km_to_deg(opts.get("buffer_fixed_km", 555.0))

    coords = np.asarray(cluster_pts)
    if len(coords) >= 3:
        try:
            hull = ConvexHull(coords)
            hull_pts = coords[hull.vertices]
        except Exception:
            hull_pts = coords
    else:
        hull_pts = coords
    if len(hull_pts) < 2:
        return _km_to_deg(opts.get("buffer_min_km", 50.0))

    diffs = hull_pts[:, None, :] - hull_pts[None, :, :]
    diam_deg = float(np.max(np.linalg.norm(diffs, axis=2)))
    diam_km = diam_deg * 111.0
    chosen_km = max(
        opts.get("buffer_min_km", 50.0),
        min(opts.get("buffer_max_km", 500.0), opts.get("buffer_fraction", 0.25) * diam_km),
    )
    return _km_to_deg(chosen_km)


def _hull_polygon(cluster_pts, buffer_deg):
    """Build a buffered hull polygon for a cluster, with sensible fallbacks."""
    pts = np.asarray(cluster_pts)
    if len(pts) >= 3:
        try:
            hull = ConvexHull(pts)
            return ShapelyPolygon(pts[hull.vertices]).buffer(buffer_deg)
        except Exception:
            pass
    if len(pts) == 2:
        return LineString(pts).buffer(buffer_deg)
    return ShapelyPoint(pts[0]).buffer(buffer_deg)


def compute_accessible_area_v2(pres_coords, opts):
    """
    Compute the accessible area (Barve et al. 2011) under a configurable strategy.

    Two strategies are supported, controlled by opts["strategy"]:

    "single_hull" (default, legacy behaviour)
        One convex hull around all unique presence points, expanded by a
        buffer that may be fixed or scaled to the hull diameter.

    "dbscan_clusters" (new, recommended for spatially disjunct distributions)
        Cluster presences with DBSCAN. Build a buffered hull per cluster.
        Noise points (DBSCAN label -1) are kept as buffered points so that
        outliers are not dropped silently. The accessible area is the
        unary union of these buffered hulls.

    Returns
    -------
    extent : dict
        Bounding box of the accessible area, clipped to the study area,
        with keys "west", "east", "south", "north". This is consumed by
        downstream functions that expect a rectangular extent (prediction
        grid, fallback random background sampling).
    accessible : shapely geometry or None
        The accessible-area polygon (Polygon or MultiPolygon) for
        polygon-masked background sampling. None for "single_hull" strategy
        to preserve legacy behaviour.
    """
    unique = np.unique(pres_coords, axis=0)
    study = config["study_area"]
    strategy = opts.get("strategy", "single_hull")

    if strategy == "single_hull":
        if opts.get("buffer_strategy", "fixed") == "fixed":
            buf_deg = _km_to_deg(opts.get("buffer_fixed_km", 555.0))
        else:
            buf_deg = _buffer_for_cluster(unique, opts)
        if len(unique) < 3:
            cx, cy = unique.mean(axis=0)
            extent = {
                "west": max(cx - buf_deg, study["west"]),
                "east": min(cx + buf_deg, study["east"]),
                "south": max(cy - buf_deg, study["south"]),
                "north": min(cy + buf_deg, study["north"]),
            }
            return extent, None
        try:
            hull = ConvexHull(unique)
            hull_pts = unique[hull.vertices]
        except Exception:
            hull_pts = unique
        extent = {
            "west": max(hull_pts[:, 0].min() - buf_deg, study["west"]),
            "east": min(hull_pts[:, 0].max() + buf_deg, study["east"]),
            "south": max(hull_pts[:, 1].min() - buf_deg, study["south"]),
            "north": min(hull_pts[:, 1].max() + buf_deg, study["north"]),
        }
        return extent, None

    eps_deg = _km_to_deg(opts.get("dbscan_eps_km", 500.0))
    min_samples = max(1, int(opts.get("dbscan_min_samples", 3)))
    if len(unique) >= min_samples:
        labels = DBSCAN(eps=eps_deg, min_samples=min_samples).fit_predict(unique)
    else:
        labels = np.full(len(unique), -1, dtype=int)

    polygons = []
    for label in sorted(set(labels)):
        if label == -1:
            for pt in unique[labels == -1]:
                polygons.append(ShapelyPoint(pt).buffer(_buffer_for_cluster([pt], opts)))
        else:
            cluster_pts = unique[labels == label]
            polygons.append(_hull_polygon(cluster_pts, _buffer_for_cluster(cluster_pts, opts)))

    if not polygons:
        return compute_accessible_area_v2(pres_coords, {**opts, "strategy": "single_hull"})

    accessible = unary_union(polygons)
    minx, miny, maxx, maxy = accessible.bounds
    extent = {
        "west": max(minx, study["west"]),
        "east": min(maxx, study["east"]),
        "south": max(miny, study["south"]),
        "north": min(maxy, study["north"]),
    }
    return extent, accessible


def compute_n_background(accessible_polygon, extent, opts):
    """
    Choose number of background points using a configurable strategy.

    "fixed" (legacy default): returns opts["fixed_n"] regardless of area.

    "density_based": scales with accessible-area size, clipped to a floor and
    ceiling. Area is computed from the polygon when available, else from the
    bounding box, with a per-centroid mid-latitude correction. The default
    density 0.0005 pt/km^2 corresponds roughly to the legacy 10,000 points
    across a Neotropics-scale extent.
    """
    if opts.get("strategy", "fixed") == "fixed":
        return int(opts.get("fixed_n", 10000))

    if accessible_polygon is not None:
        area_km2 = _polygon_area_km2(accessible_polygon)
    else:
        cy = (extent["north"] + extent["south"]) / 2
        km_per_deg_lon = 111.0 * np.cos(np.radians(cy))
        area_deg2 = (extent["east"] - extent["west"]) * (extent["north"] - extent["south"])
        area_km2 = float(area_deg2 * 111.0 * km_per_deg_lon)

    density = float(opts.get("density_per_km2", 0.0005))
    floor = int(opts.get("floor", 2000))
    ceiling = int(opts.get("ceiling", 15000))
    n = int(area_km2 * density)
    return max(floor, min(ceiling, n))


def _accessible_opts():
    """Read accessible-area options from config with backward-compatible defaults."""
    m = config.get("modelling", {})
    legacy_buffer_deg = m.get("accessible_area_buffer", 3.0)
    return {
        "strategy": m.get("accessible_area_strategy", "single_hull"),
        "dbscan_eps_km": m.get("dbscan_eps_km", 500.0),
        "dbscan_min_samples": m.get("dbscan_min_samples", 3),
        "buffer_strategy": m.get("buffer_strategy", "fixed"),
        "buffer_fixed_km": m.get("buffer_fixed_km", legacy_buffer_deg * 111.0),
        "buffer_fraction": m.get("buffer_fraction_of_diameter", 0.25),
        "buffer_min_km": m.get("buffer_min_km", 50.0),
        "buffer_max_km": m.get("buffer_max_km", 500.0),
    }


def _background_opts():
    """Read background-count options from config with backward-compatible defaults."""
    m = config.get("modelling", {})
    return {
        "strategy": m.get("n_background_strategy", "fixed"),
        "fixed_n": m.get("n_background", 10000),
        "density_per_km2": m.get("background_density_per_km2", 0.0005),
        "floor": m.get("background_floor", 2000),
        "ceiling": m.get("background_ceiling", 15000),
    }


# ── Prediction extent (full Neotropics) ─────────────────────────────────────


def get_prediction_extent():
    return {
        "west": config["study_area"]["west"],
        "east": config["study_area"]["east"],
        "south": config["study_area"]["south"],
        "north": config["study_area"]["north"],
    }


# ── Training data preparation ────────────────────────────────────────────────


def prepare_training_data(
    species_gdf,
    env_rasters,
    all_coords,
    tier_config,
    bias_weights=None,
    bias_grid_coords=None,
):
    modelling = config["modelling"]
    pres_coords = np.array([(g.x, g.y) for g in species_gdf.geometry])

    accessible, accessible_polygon = compute_accessible_area_v2(
        pres_coords, _accessible_opts()
    )

    n_bg = compute_n_background(accessible_polygon, accessible, _background_opts())
    if (
        "gbm" not in tier_config["algorithms"]
        and "random_forest" not in tier_config["algorithms"]
    ):
        n_bg = min(n_bg, 10000)

    bg_gdf = generate_background_points(
        n_points=n_bg,
        extent=accessible,
        accessible_polygon=accessible_polygon,
        occurrence_coords=pres_coords,
        target_group_coords=all_coords,
        bias_weights=bias_weights,
        bias_grid_coords=bias_grid_coords,
    )

    pres_env = extract_values_at_points(env_rasters, species_gdf)
    bg_env = extract_values_at_points(env_rasters, bg_gdf)

    pres_env["presence"] = 1
    bg_env["presence"] = 0

    data = pd.concat([pres_env, bg_env], ignore_index=True)

    pres_xy = pd.DataFrame(pres_coords, columns=["lon", "lat"])
    bg_xy = pd.DataFrame([(g.x, g.y) for g in bg_gdf.geometry], columns=["lon", "lat"])
    coords_df = pd.concat([pres_xy, bg_xy], ignore_index=True)
    data["lon"] = coords_df["lon"].values
    data["lat"] = coords_df["lat"].values

    env_cols = [c for c in data.columns if c not in ["presence", "lon", "lat"]]
    initial_len = len(data)
    data = data.dropna(subset=env_cols)
    if len(data) < initial_len:
        dropped = initial_len - len(data)
        pres_remaining = int(data["presence"].sum())
        print(f"    Dropped {dropped} NaN rows ({pres_remaining} presences remain)")

    vif_threshold = modelling.get("vif_threshold", 0)
    if vif_threshold > 0 and len(env_cols) > 2:
        X_env = data[env_cols].values
        _, selected_cols, removed_cols = filter_by_vif(
            X_env, env_cols, threshold=vif_threshold
        )
        if removed_cols:
            print(f"    VIF removed: {removed_cols}")
            env_cols = selected_cols
        print(f"    {len(env_cols)} variables after VIF")

    return data, env_cols, accessible


# ── Algorithm fitting (tier-aware) ───────────────────────────────────────────


def fit_maxent(X_train, y_train, X_test=None, tier_config=None):
    try:
        from elapid import MaxentModel

        tc = tier_config or TIERS["medium"]
        model = MaxentModel(
            feature_types=tc["maxent_features"],
            beta_multiplier=tc["maxent_rm"],
            tau=0.5,
            transform="cloglog",
            clamp=True,
            n_hinge_features=10 if "hinge" in tc["maxent_features"] else 0,
            n_threshold_features=0,
        )
        model.fit(X_train, y_train)
        if X_test is not None:
            return model, model.predict(X_test)
        return model, None
    except Exception as e:
        print(f"    MaxEnt failed: {e}")
        return None, None


def fit_random_forest(X_train, y_train, X_test=None, tier_config=None):
    """RF with capped depth and down-sampling (Valavi et al. 2021)."""
    from sklearn.ensemble import RandomForestClassifier

    n_pres = int(y_train.sum())
    n_bg = len(y_train) - n_pres
    weight_ratio = n_bg / n_pres if n_pres > 0 else 1

    model = RandomForestClassifier(
        n_estimators=500,
        max_depth=15,
        max_features="sqrt",
        min_samples_leaf=max(5, n_pres // 20),
        class_weight={0: 1, 1: weight_ratio},
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    if X_test is not None:
        return model, model.predict_proba(X_test)[:, 1]
    return model, None


def fit_gbm(X_train, y_train, X_test=None, tier_config=None):
    """XGBoost: depth 2-3, lr 0.01, early stopping (Elith et al. 2008)."""
    import xgboost as xgb

    n_pres = int(y_train.sum())
    n_bg = len(y_train) - n_pres
    scale_pos = n_bg / n_pres if n_pres > 0 else 1

    n_trees = 500 if n_pres < 200 else 1500
    lr = 0.05 if n_pres < 200 else 0.01

    model = xgb.XGBClassifier(
        n_estimators=n_trees,
        max_depth=3,
        learning_rate=lr,
        scale_pos_weight=scale_pos,
        subsample=0.75,
        colsample_bytree=0.75,
        early_stopping_rounds=30,
        random_state=42,
        eval_metric="logloss",
        n_jobs=-1,
        verbosity=0,
    )

    # Split 15% for early stopping validation
    n_total = len(X_train)
    val_size = max(20, int(n_total * 0.15))
    indices = np.arange(n_total)
    np.random.seed(42)
    np.random.shuffle(indices)
    val_idx = indices[:val_size]
    train_idx = indices[val_size:]

    model.fit(
        X_train[train_idx],
        y_train[train_idx],
        eval_set=[(X_train[val_idx], y_train[val_idx])],
        verbose=False,
    )

    if X_test is not None:
        return model, model.predict_proba(X_test)[:, 1]
    return model, None


ALGORITHM_MAP = {
    "maxent": fit_maxent,
    "random_forest": fit_random_forest,
    "gbm": fit_gbm,
}


# ── Cross-validation (tier-aware) ────────────────────────────────────────────


def jackknife_cv(data, env_cols, algorithm_name, tier_config):
    """Leave-one-out CV on presence points only (Pearson et al. 2007)."""
    X = data[env_cols].values
    y = data["presence"].values
    pres_idx = np.where(y == 1)[0]
    bg_idx = np.where(y == 0)[0]

    fit_fn = ALGORITHM_MAP[algorithm_name]
    fold_metrics = []

    for i, left_out in enumerate(pres_idx):
        train_idx = np.concatenate([pres_idx[pres_idx != left_out], bg_idx])
        test_idx = np.array([left_out])

        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        model, y_pred = fit_fn(X_train, y_train, X_test, tier_config=tier_config)
        if y_pred is not None:
            fold_metrics.append({"pred": y_pred[0], "true": 1})

    if len(fold_metrics) < 3:
        return {
            "auc": np.nan,
            "tss": np.nan,
            "boyce": np.nan,
            "threshold": 0.5,
            "cv_method": "jackknife",
        }

    preds = np.array([m["pred"] for m in fold_metrics])

    # Compute omission rate at 10th percentile threshold
    threshold_10p = np.percentile(preds, 10)
    omission_rate = np.mean(preds < threshold_10p)

    # AUC from full model on all data
    model_full, _ = fit_fn(X, y, tier_config=tier_config)
    if model_full is not None:
        try:
            if algorithm_name == "maxent":
                all_pred = model_full.predict(X)
            else:
                all_pred = model_full.predict_proba(X)[:, 1]
            metrics = evaluate_model(y, all_pred)
            metrics["cv_method"] = "jackknife"
            metrics["omission_10p"] = omission_rate
            metrics["jackknife_mean_pred"] = float(np.mean(preds))
            return metrics
        except Exception:
            pass

    return {
        "auc": np.nan,
        "tss": np.nan,
        "boyce": np.nan,
        "threshold": 0.5,
        "cv_method": "jackknife",
        "omission_10p": omission_rate,
    }


def spatial_block_cv_model(data, env_cols, algorithm_name, tier_config):
    coords = data[["lon", "lat"]].values
    X = data[env_cols].values
    y = data["presence"].values

    n_folds = config["modelling"]["cv_folds"]
    folds = spatial_block_cv(coords, n_folds=n_folds)

    fold_metrics = []
    fit_fn = ALGORITHM_MAP[algorithm_name]

    for train_idx, test_idx in folds:
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        if y_test.sum() == 0 or y_train.sum() == 0:
            continue

        model, y_pred = fit_fn(X_train, y_train, X_test, tier_config=tier_config)
        if y_pred is None:
            continue

        metrics = evaluate_model(y_test, y_pred)
        fold_metrics.append(metrics)

    if not fold_metrics:
        return {
            "auc": np.nan,
            "tss": np.nan,
            "boyce": np.nan,
            "threshold": 0.5,
            "cv_method": "spatial_block",
        }

    result = {
        k: np.nanmean([m[k] for m in fold_metrics]) for k in fold_metrics[0].keys()
    }
    result["cv_method"] = "spatial_block"
    return result


def cross_validate(data, env_cols, algorithm_name, tier_config):
    n_pres = int(data["presence"].sum())
    if tier_config["cv_strategy"] == "jackknife" or n_pres < 30:
        return jackknife_cv(data, env_cols, algorithm_name, tier_config)
    return spatial_block_cv_model(data, env_cols, algorithm_name, tier_config)


# ── Prediction generation ────────────────────────────────────────────────────


def load_land_mask():
    land_dir = ENV_DIR / "ne_110m_land"
    if not land_dir.exists():
        return None
    try:
        return gpd.read_file(land_dir)
    except Exception:
        return None


LAND_MASK_GDF = None


def apply_land_mask(grid_gdf, predictions):
    """Set ocean pixels to NaN using Natural Earth land polygons."""
    global LAND_MASK_GDF
    if LAND_MASK_GDF is None:
        LAND_MASK_GDF = load_land_mask()
    if LAND_MASK_GDF is None:
        return predictions

    from shapely.prepared import prep
    from shapely.ops import unary_union

    land_union = unary_union(LAND_MASK_GDF.geometry)
    land_prep = prep(land_union)

    on_land = np.array([land_prep.contains(pt) for pt in grid_gdf.geometry])
    masked = predictions.copy()
    masked[~on_land] = np.nan
    return masked


ENV_LABELS = {
    "CHELSA_bio1": ("Mean Temp.", "°C", 0.1, -273.15),
    "CHELSA_bio2": ("Diurnal Range", "°C", 0.1, 0),
    "CHELSA_bio4": ("Temp. Seasonality", "", 1, 0),
    "CHELSA_bio5": ("Max Temp.", "°C", 0.1, -273.15),
    "CHELSA_bio6": ("Min Temp.", "°C", 0.1, -273.15),
    "CHELSA_bio12": ("Annual Precip.", "mm", 0.1, 0),
    "CHELSA_bio13": ("Wettest Month", "mm", 0.1, 0),
    "CHELSA_bio14": ("Driest Month", "mm", 0.1, 0),
    "CHELSA_bio15": ("Precip. Seasonality", "", 1, 0),
    "elevation": ("Elevation", "m", 1, 0),
    "cloud_cover": ("Cloud Cover", "", 0.01, 0),
}


def get_env_label(col_name):
    best_match = None
    best_len = 0
    for key, val in ENV_LABELS.items():
        if key in col_name and len(key) > best_len:
            best_match = val
            best_len = len(key)
    if best_match:
        return best_match
    return col_name.split("_")[0], "", 1, 0


def generate_response_curves(data, env_cols, fitted_predictions, X, y, tier_config):
    pres_data = data[data["presence"] == 1]
    n_steps = 50

    variables = []
    for col_idx, col in enumerate(env_cols):
        label, unit, scale, offset = get_env_label(col)
        col_values = X[:, col_idx]
        pres_values = X[y == 1, col_idx]

        vmin, vmax = np.nanpercentile(col_values, [2, 98])
        gradient = np.linspace(vmin, vmax, n_steps)

        X_partial = np.tile(X[y == 1].mean(axis=0), (n_steps, 1))
        X_partial[:, col_idx] = gradient

        algo_responses = {}
        for algo_name, pred_array in fitted_predictions.items():
            fit_fn = ALGORITHM_MAP.get(algo_name)
            if fit_fn is None:
                continue
            model, _ = fit_fn(X, y, tier_config=tier_config)
            if model is None:
                continue
            try:
                if algo_name == "maxent":
                    response = model.predict(X_partial)
                else:
                    response = model.predict_proba(X_partial)[:, 1]
                algo_responses[algo_name] = response.tolist()
            except Exception:
                continue

        if not algo_responses:
            continue

        response_arrays = np.array(list(algo_responses.values()))
        mean_response = response_arrays.mean(axis=0)
        std_response = (
            response_arrays.std(axis=0)
            if len(response_arrays) > 1
            else np.zeros(n_steps)
        )

        display_gradient = (gradient * scale + offset).tolist()
        display_pres = (pres_values * scale + offset).tolist()

        optimal_mask = mean_response >= mean_response.max() * 0.8
        if optimal_mask.any():
            opt_vals = gradient[optimal_mask] * scale + offset
            optimal_min = float(opt_vals.min())
            optimal_max = float(opt_vals.max())
        else:
            optimal_min = optimal_max = float(
                gradient[mean_response.argmax()] * scale + offset
            )

        peak_idx = int(mean_response.argmax())
        peak_confidence = 1.0 - float(
            std_response[peak_idx] / max(mean_response[peak_idx], 0.01)
        )
        peak_confidence = max(0, min(1, peak_confidence))

        importance = float(mean_response.max() - mean_response.min())

        variables.append(
            {
                "variable": col,
                "label": label,
                "unit": unit,
                "gradient": display_gradient,
                "response_mean": mean_response.tolist(),
                "response_std": std_response.tolist(),
                "presence_values": display_pres,
                "optimal_range": [round(optimal_min, 1), round(optimal_max, 1)],
                "importance": round(importance, 4),
                "confidence": round(peak_confidence, 3),
            }
        )

    variables.sort(key=lambda v: -v["importance"])

    return {
        "variables": variables,
        "n_steps": n_steps,
    }


def generate_predictions(
    data, env_cols, env_rasters, species_name, tier_name, tier_config
):
    X = data[env_cols].values
    y = data["presence"].values
    n_pres = int(y.sum())

    algorithms = tier_config["algorithms"]
    resolution = config["modelling"]["prediction_resolution"]

    # Predict within accessible area only (Barve et al. 2011)
    pres_mask = data["presence"] == 1
    pres_coords = data.loc[pres_mask, ["lon", "lat"]].values
    accessible, _ = compute_accessible_area_v2(pres_coords, _accessible_opts())
    print(f"    Prediction grid: accessible area ({resolution}°)...")
    grid_gdf, grid_shape, transform, lons, lats = create_prediction_grid(
        accessible, resolution
    )

    all_raster_paths = list(env_rasters)
    grid_env_all = extract_values_at_points(all_raster_paths, grid_gdf)
    grid_env = (
        grid_env_all[env_cols]
        if all(c in grid_env_all.columns for c in env_cols)
        else grid_env_all
    )

    valid_mask = grid_env.notna().all(axis=1)
    X_grid = grid_env.values
    X_grid_valid = X_grid[valid_mask]

    predictions = {}
    cv_results = {}

    for algo_name in algorithms:
        print(f"    {algo_name}...", end=" ", flush=True)
        fit_fn = ALGORITHM_MAP.get(algo_name)
        if fit_fn is None:
            continue

        cv_metrics = cross_validate(data, env_cols, algo_name, tier_config)
        cv_results[algo_name] = cv_metrics

        auc_str = (
            f"AUC={cv_metrics['auc']:.3f}"
            if not np.isnan(cv_metrics.get("auc", np.nan))
            else "AUC=N/A"
        )
        boyce_str = (
            f"Boyce={cv_metrics.get('boyce', np.nan):.3f}"
            if not np.isnan(cv_metrics.get("boyce", np.nan))
            else ""
        )
        cv_method = cv_metrics.get("cv_method", "?")
        print(f"{auc_str} {boyce_str} [{cv_method}]")

        # Skip algorithm with AUC < 0.5 for ensemble (but still report metrics)
        algo_auc = cv_metrics.get("auc", 0.5)
        if not np.isnan(algo_auc) and algo_auc < 0.5:
            print(f"      ⚠ Below random — excluded from ensemble")
            continue

        model, _ = fit_fn(X, y, tier_config=tier_config)
        if model is None:
            continue

        try:
            if algo_name == "maxent":
                pred_valid = model.predict(X_grid_valid)
            else:
                pred_valid = model.predict_proba(X_grid_valid)[:, 1]
        except Exception as e:
            print(f"      Prediction failed: {e}")
            continue

        pred_full = np.full(len(X_grid), np.nan)
        pred_full[valid_mask] = pred_valid
        predictions[algo_name] = pred_full

    if not predictions:
        print(f"    ⚠ No successful models for {species_name}")
        return None

    # Ensemble: AUC-weighted mean, excluding below-random
    pred_arrays = np.array(list(predictions.values()))
    weights = []
    for algo_name in predictions.keys():
        auc = cv_results.get(algo_name, {}).get("auc", 0.5)
        if np.isnan(auc):
            auc = 0.5
        weights.append(max(0, auc - 0.5))
    weights = np.array(weights)

    if weights.sum() > 0:
        weights = weights / weights.sum()
    else:
        weights = np.ones(len(weights)) / len(weights)

    if len(pred_arrays) == 1:
        ensemble = pred_arrays[0]
    else:
        ensemble = np.average(pred_arrays, axis=0, weights=weights)

    ensemble = apply_land_mask(grid_gdf, ensemble)
    ensemble = np.where(np.isnan(ensemble), -9999.0, ensemble)

    safe_name = species_name.replace(" ", "_").lower()
    output_path = PRED_DIR / f"{safe_name}_ensemble.tif"
    save_prediction_raster(ensemble, grid_shape, transform, output_path)
    print(f"    Saved: {output_path.name}")

    for algo_name, pred in predictions.items():
        pred = np.where(np.isnan(pred), -9999.0, pred)
        save_prediction_raster(
            pred, grid_shape, transform, PRED_DIR / f"{safe_name}_{algo_name}.tif"
        )

    if config["modelling"].get("generate_mess", False):
        training_env = data[data["presence"] == 1][env_cols].values
        mess_values = compute_mess(training_env, X_grid)
        mess_values = np.where(np.isnan(mess_values), -9999.0, mess_values)
        save_prediction_raster(
            mess_values, grid_shape, transform, PRED_DIR / f"{safe_name}_mess.tif"
        )

    best_auc = max(
        (
            cv.get("auc", 0)
            for cv in cv_results.values()
            if not np.isnan(cv.get("auc", 0))
        ),
        default=0,
    )
    best_boyce = max(
        (
            cv.get("boyce", 0)
            for cv in cv_results.values()
            if cv.get("boyce") is not None and not np.isnan(cv.get("boyce", 0))
        ),
        default=0,
    )

    confidence = tier_config["confidence"]
    if best_auc < 0.5 or (np.isnan(best_auc) and best_boyce <= 0):
        confidence = "exploratory"

    response_data = generate_response_curves(
        data, env_cols, predictions, X, y, tier_config
    )

    safe_name = species_name.replace(" ", "_").lower()
    response_path = PRED_DIR / f"{safe_name}_response.json"
    with open(response_path, "w") as f:
        json.dump(response_data, f)

    return {
        "species": species_name,
        "cv_results": cv_results,
        "ensemble_method": "weighted_mean",
        "algorithms_used": list(predictions.keys()),
        "algorithms_excluded": [a for a in algorithms if a not in predictions],
        "n_presences": n_pres,
        "n_background": int(len(y) - y.sum()),
        "n_env_variables": len(env_cols),
        "env_variables": env_cols,
        "tier": tier_name,
        "confidence": confidence,
        "best_auc": best_auc,
        "best_boyce": best_boyce,
        "prediction_file": str(output_path),
        "response_curves": response_data,
    }


# ── Main ─────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Run SDM v3 for Ithomiini species")
    parser.add_argument("--species", nargs="*", help="Specific species to model")
    parser.add_argument(
        "--poc", action="store_true", help="Run proof-of-concept species"
    )
    parser.add_argument(
        "--pilot", action="store_true", help="Run 8-species diagnostic pilot"
    )
    parser.add_argument(
        "--tuned-only",
        action="store_true",
        help="Re-run only species listed in sdm/species_overrides.json "
        "(merges new results into existing summary JSON)",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("STEP 4: SPECIES DISTRIBUTION MODELS (v3)")
    print("=" * 70)
    print("\nTiered approach:")
    for name, t in TIERS.items():
        print(
            f"  {name} (n={t['min_records']}-{t['max_records']}): "
            f"{t['algorithms']}, RM={t.get('maxent_rm', '—')}, CV={t['cv_strategy']}"
        )

    print("\n1. Loading environmental layers...")
    env_rasters = get_env_rasters()

    print("\n2. Loading target-group background...")
    all_coords = load_all_occurrences()
    if all_coords is None:
        print("  WARNING: No target-group data.")
    else:
        print(f"  {len(all_coords)} Ithomiini coordinates")

    bias_weights = None
    bias_grid_coords = None
    if config["modelling"].get("use_bias_raster", False) and all_coords is not None:
        print("\n3. Creating bias raster...")
        bandwidth = config["modelling"].get("bias_bandwidth", 1.0)
        bias_weights, bias_grid_coords, _ = create_bias_raster(
            all_coords, config["study_area"], resolution=0.1, bandwidth=bandwidth
        )
        print(f"  Bias raster: {len(bias_weights)} cells (bandwidth={bandwidth}°)")
    else:
        print("\n3. Bias raster: disabled")

    PILOT_SPECIES = [
        "Mechanitis polymnia",  # 505 records, large widespread
        "Hypothyris euclea",  # 372 records, large moderate
        "Mechanitis messenoides",  # 154 records, medium good
        "Greta morgane",  # 102 records, medium poor
        "Elzunia pavonii",  # 37 records, small excellent
        "Episcada sulphurea",  # 32 records, small terrible
        "Oleria fumata",  # 21 records, minimum viable
        "Ithomia heraldica",  # 23 records, failed in v1
    ]

    overrides = load_species_overrides()

    if args.species:
        species_list = args.species
    elif args.tuned_only:
        if not overrides:
            print("ERROR: --tuned-only requires sdm/species_overrides.json")
            sys.exit(1)
        species_list = [k.replace("_", " ").capitalize() for k in overrides.keys()]
    elif args.poc:
        species_list = config["species"]["proof_of_concept"]
    elif args.pilot:
        species_list = PILOT_SPECIES
    else:
        viable_path = OCC_DIR / "viable_species.json"
        with open(viable_path) as f:
            species_list = json.load(f)

    if overrides:
        print(f"\n   species_overrides.json: {len(overrides)} species tuned")

    print(f"\n4. Modelling {len(species_list)} species...")

    all_results = []
    skipped = {"insufficient": 0, "no_tier": 0, "no_env": 0}
    species_times = []
    import time as _time

    run_start = _time.time()

    for i, species_name in enumerate(species_list):
        sp_start = _time.time()

        if species_times:
            avg_time = sum(species_times) / len(species_times)
            remaining = (len(species_list) - i) * avg_time
            mins, secs = divmod(int(remaining), 60)
            hrs, mins = divmod(mins, 60)
            eta_str = f"{hrs}h{mins:02d}m" if hrs else f"{mins}m{secs:02d}s"
            elapsed = _time.time() - run_start
            el_mins, el_secs = divmod(int(elapsed), 60)
            el_hrs, el_mins = divmod(el_mins, 60)
            elapsed_str = (
                f"{el_hrs}h{el_mins:02d}m" if el_hrs else f"{el_mins}m{el_secs:02d}s"
            )
            print(
                f"\n── [{i + 1}/{len(species_list)}] {species_name}  [elapsed {elapsed_str} | ETA {eta_str} | avg {avg_time:.0f}s/sp] ──"
            )
        else:
            print(f"\n── [{i + 1}/{len(species_list)}] {species_name} ──")

        species_gdf = load_species_data(species_name)
        if species_gdf is None:
            print(f"  Skip: no data file")
            skipped["insufficient"] += 1
            continue

        n_records = len(species_gdf)
        tier_name, tier_config = get_tier(n_records)

        if tier_config is None:
            print(
                f"  Skip: {n_records} records (below minimum {TIERS['small']['min_records']})"
            )
            skipped["no_tier"] += 1
            continue

        print(
            f"  {n_records} records → tier={tier_name}, algorithms={tier_config['algorithms']}, "
            f"RM={tier_config.get('maxent_rm', '—')}, CV={tier_config['cv_strategy']}"
        )

        tier_config, override_note = apply_override(
            tier_config, species_name, overrides
        )
        if override_note:
            print(f"  Override: {override_note}")

        data, env_cols, accessible = prepare_training_data(
            species_gdf,
            env_rasters,
            all_coords,
            tier_config,
            bias_weights=bias_weights,
            bias_grid_coords=bias_grid_coords,
        )
        n_pres = int(data["presence"].sum())
        print(
            f"  Training: {n_pres} presences, {int(len(data) - n_pres)} background, {len(env_cols)} vars"
        )

        if n_pres < 10:
            print(f"  Skip: too few presences after env extraction ({n_pres})")
            skipped["no_env"] += 1
            continue

        result = generate_predictions(
            data, env_cols, env_rasters, species_name, tier_name, tier_config
        )
        if result:
            all_results.append(result)

        sp_elapsed = _time.time() - sp_start
        species_times.append(sp_elapsed)
        print(f"  ⏱ {sp_elapsed:.0f}s")

    if all_results:
        summary_path = PRED_DIR / "sdm_results_summary.json"
        merged = []
        processed_names = {r["species"] for r in all_results}
        if summary_path.exists():
            try:
                existing = json.loads(summary_path.read_text())
                merged = [
                    r for r in existing if r.get("species") not in processed_names
                ]
                if merged:
                    print(
                        f"\n  Summary merge: kept {len(merged)} pre-existing entries, "
                        f"added/replaced {len(all_results)} from this run"
                    )
            except (json.JSONDecodeError, OSError) as exc:
                print(f"  ⚠ Existing summary unreadable ({exc}); overwriting")
                merged = []
        merged.extend(all_results)
        with open(summary_path, "w") as f:
            json.dump(merged, f, indent=2, default=str)

        print(
            f"\n\n{'Species':<35} {'N':>5} {'Tier':<7} {'Algos':<15} {'AUC':>7} {'Boyce':>7} {'Conf':<12}"
        )
        print("─" * 95)
        for r in all_results:
            algos = "+".join(a[:3] for a in r["algorithms_used"]) or "none"
            print(
                f"  {r['species']:<33} {r['n_presences']:>5} {r['tier']:<7} {algos:<15} "
                f"{r['best_auc']:>7.3f} {r['best_boyce']:>7.3f} {r['confidence']:<12}"
            )

    total_skip = sum(skipped.values())
    print(
        f"\n\nDone: {len(all_results)} modelled, {total_skip} skipped "
        f"(insufficient={skipped['insufficient']}, below_min={skipped['no_tier']}, no_env={skipped['no_env']})"
    )


if __name__ == "__main__":
    main()
