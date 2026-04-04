#!/usr/bin/env python3
"""
Step 4: Run Species Distribution Models.
Fits MaxEnt, Random Forest, and GBM for each viable species,
evaluates with spatial cross-validation (AUC, TSS, Boyce index),
applies VIF-based variable selection and bias-weighted background,
generates MESS extrapolation maps, and creates ensemble predictions.
"""

import json
import yaml
import fnmatch
import numpy as np
import pandas as pd
import geopandas as gpd
from pathlib import Path
import warnings
import sys
import argparse

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

warnings.filterwarnings('ignore')

CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH) as f:
    config = yaml.safe_load(f)

OCC_DIR = Path(__file__).parent / config['paths']['occurrences']
ENV_DIR = Path(__file__).parent / config['paths']['env_variables']
PRED_DIR = Path(__file__).parent / config['paths']['predictions']
PRED_DIR.mkdir(parents=True, exist_ok=True)

FIG_DIR = Path(__file__).parent / config['paths']['figures']
FIG_DIR.mkdir(parents=True, exist_ok=True)


def get_env_rasters():
    """Get list of environmental raster paths, excluding host plant layers."""
    cropped_dir = ENV_DIR / "cropped"
    exclude = config['env_data'].get('exclude_patterns', [])

    rasters = []
    for r in sorted(cropped_dir.glob("*.tif")):
        excluded = any(fnmatch.fnmatch(r.name, pat) for pat in exclude)
        if not excluded:
            rasters.append(r)

    if not rasters:
        print("ERROR: No environmental rasters found. Run step 02 first.")
        sys.exit(1)

    print(f"  Using {len(rasters)} environmental layers:")
    for r in rasters:
        print(f"    - {r.name}")

    if exclude:
        excluded_files = [r for r in sorted(cropped_dir.glob("*.tif"))
                         if any(fnmatch.fnmatch(r.name, pat) for pat in exclude)]
        if excluded_files:
            print(f"  Excluded {len(excluded_files)} layers (host plants etc.):")
            for r in excluded_files:
                print(f"    - {r.name}")

    return rasters


def load_species_data(species_name):
    """Load occurrence data for a species."""
    safe_name = species_name.replace(' ', '_').lower()
    sp_path = OCC_DIR / "species" / f"{safe_name}.parquet"
    if not sp_path.exists():
        return None
    return gpd.read_parquet(sp_path)


def load_all_occurrences():
    """Load all Ithomiini occurrences for target-group background."""
    all_path = OCC_DIR / "all_ithomiini_occurrences.parquet"
    if not all_path.exists():
        return None
    gdf = gpd.read_parquet(all_path)
    coords = np.array([(g.x, g.y) for g in gdf.geometry])
    return coords


def prepare_training_data(species_gdf, env_rasters, all_coords,
                          bias_weights=None, bias_grid_coords=None):
    """
    Prepare training data with bias-weighted background and VIF filtering.
    """
    modelling = config['modelling']

    pres_coords = np.array([(g.x, g.y) for g in species_gdf.geometry])

    buffer = modelling['accessible_area_buffer']
    extent = {
        'west': max(pres_coords[:, 0].min() - buffer, config['study_area']['west']),
        'east': min(pres_coords[:, 0].max() + buffer, config['study_area']['east']),
        'south': max(pres_coords[:, 1].min() - buffer, config['study_area']['south']),
        'north': min(pres_coords[:, 1].max() + buffer, config['study_area']['north']),
    }

    # Generate background points (bias-weighted if available)
    bg_gdf = generate_background_points(
        n_points=modelling['n_background'],
        extent=extent,
        occurrence_coords=pres_coords,
        target_group_coords=all_coords,
        bias_weights=bias_weights,
        bias_grid_coords=bias_grid_coords,
    )

    # Extract environmental values
    pres_env = extract_values_at_points(env_rasters, species_gdf)
    bg_env = extract_values_at_points(env_rasters, bg_gdf)

    pres_env['presence'] = 1
    bg_env['presence'] = 0

    data = pd.concat([pres_env, bg_env], ignore_index=True)

    # Add coordinates for spatial CV
    pres_xy = pd.DataFrame(pres_coords, columns=['lon', 'lat'])
    bg_xy = pd.DataFrame([(g.x, g.y) for g in bg_gdf.geometry], columns=['lon', 'lat'])
    coords_df = pd.concat([pres_xy, bg_xy], ignore_index=True)
    data['lon'] = coords_df['lon'].values
    data['lat'] = coords_df['lat'].values

    # Drop rows with NaN
    env_cols = [c for c in data.columns if c not in ['presence', 'lon', 'lat']]
    initial_len = len(data)
    data = data.dropna(subset=env_cols)
    if len(data) < initial_len:
        dropped = initial_len - len(data)
        pres_remaining = data['presence'].sum()
        print(f"    Dropped {dropped} rows with NaN env values ({int(pres_remaining)} presences remain)")

    # VIF-based variable selection
    vif_threshold = modelling.get('vif_threshold', 0)
    if vif_threshold > 0 and len(env_cols) > 2:
        X_env = data[env_cols].values
        _, selected_cols, removed_cols = filter_by_vif(X_env, env_cols, threshold=vif_threshold)
        if removed_cols:
            print(f"    VIF removed {len(removed_cols)} correlated variables: {removed_cols}")
            env_cols = selected_cols
        print(f"    Using {len(env_cols)} variables after VIF filtering")

    return data, env_cols, extent


def fit_maxent(X_train, y_train, X_test=None):
    """Fit MaxEnt model using elapid."""
    try:
        from elapid import MaxentModel
        model = MaxentModel(
            feature_types=['linear', 'quadratic', 'hinge'],
            tau=0.5,
            n_hinge_features=10,
            n_threshold_features=10,
        )
        model.fit(X_train, y_train)
        if X_test is not None:
            return model, model.predict(X_test)
        return model, None
    except Exception as e:
        print(f"    MaxEnt failed: {e}")
        return None, None


def fit_random_forest(X_train, y_train, X_test=None):
    """Fit Random Forest model."""
    from sklearn.ensemble import RandomForestClassifier

    n_pres = y_train.sum()
    n_bg = len(y_train) - n_pres
    weight_ratio = n_bg / n_pres if n_pres > 0 else 1

    model = RandomForestClassifier(
        n_estimators=500, max_depth=None, min_samples_leaf=5,
        class_weight={0: 1, 1: weight_ratio},
        random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)
    if X_test is not None:
        return model, model.predict_proba(X_test)[:, 1]
    return model, None


def fit_gbm(X_train, y_train, X_test=None):
    """Fit Gradient Boosted Machine using XGBoost."""
    import xgboost as xgb

    n_pres = y_train.sum()
    n_bg = len(y_train) - n_pres
    scale_pos = n_bg / n_pres if n_pres > 0 else 1

    model = xgb.XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.1,
        scale_pos_weight=scale_pos, subsample=0.8, colsample_bytree=0.8,
        random_state=42, eval_metric='logloss', n_jobs=-1,
    )
    model.fit(X_train, y_train)
    if X_test is not None:
        return model, model.predict_proba(X_test)[:, 1]
    return model, None


ALGORITHM_MAP = {
    'maxent': fit_maxent,
    'random_forest': fit_random_forest,
    'gbm': fit_gbm,
}


def cross_validate_model(data, env_cols, algorithm_name):
    """Run spatial block cross-validation for a single algorithm."""
    coords = data[['lon', 'lat']].values
    X = data[env_cols].values
    y = data['presence'].values

    n_folds = config['modelling']['cv_folds']
    folds = spatial_block_cv(coords, n_folds=n_folds)

    fold_metrics = []
    fit_fn = ALGORITHM_MAP[algorithm_name]

    for train_idx, test_idx in folds:
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        if y_test.sum() == 0 or y_train.sum() == 0:
            continue

        model, y_pred = fit_fn(X_train, y_train, X_test)
        if y_pred is None:
            continue

        metrics = evaluate_model(y_test, y_pred)
        fold_metrics.append(metrics)

    if not fold_metrics:
        return {'auc': np.nan, 'tss': np.nan, 'boyce': np.nan, 'threshold': 0.5}

    return {k: np.nanmean([m[k] for m in fold_metrics]) for k in fold_metrics[0].keys()}


def generate_predictions(data, env_cols, env_rasters, species_name, extent):
    """
    Fit all algorithms, generate ensemble prediction and MESS map.
    """
    X = data[env_cols].values
    y = data['presence'].values

    algorithms = config['modelling']['algorithms']
    ensemble_method = config['modelling']['ensemble_method']
    resolution = config['modelling']['prediction_resolution']

    print(f"    Creating prediction grid (resolution={resolution}°)...")
    grid_gdf, grid_shape, transform, lons, lats = create_prediction_grid(extent, resolution)

    # Extract env values at grid — only for selected (VIF-filtered) columns
    all_raster_paths = [r for r in env_rasters]
    grid_env_all = extract_values_at_points(all_raster_paths, grid_gdf)
    # Keep only VIF-selected columns
    grid_env = grid_env_all[env_cols] if all(c in grid_env_all.columns for c in env_cols) else grid_env_all

    valid_mask = grid_env.notna().all(axis=1)
    X_grid = grid_env.values
    X_grid_valid = X_grid[valid_mask]

    # Fit each algorithm and predict
    predictions = {}
    cv_results = {}

    for algo_name in algorithms:
        print(f"    Fitting {algo_name}...")
        fit_fn = ALGORITHM_MAP.get(algo_name)
        if fit_fn is None:
            continue

        cv_metrics = cross_validate_model(data, env_cols, algo_name)
        cv_results[algo_name] = cv_metrics
        boyce_str = f", Boyce={cv_metrics.get('boyce', np.nan):.3f}" if 'boyce' in cv_metrics else ""
        print(f"      CV AUC={cv_metrics['auc']:.3f}, TSS={cv_metrics['tss']:.3f}{boyce_str}")

        model, _ = fit_fn(X, y)
        if model is None:
            continue

        try:
            if algo_name == 'maxent':
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
        print(f"    WARNING: No successful models for {species_name}")
        return None

    # Ensemble
    pred_arrays = np.array(list(predictions.values()))

    if ensemble_method == 'weighted_mean':
        weights = []
        for algo_name in predictions.keys():
            auc = cv_results.get(algo_name, {}).get('auc', 0.5)
            weights.append(max(0, auc - 0.5))
        weights = np.array(weights)
        if weights.sum() > 0:
            weights = weights / weights.sum()
        else:
            weights = np.ones(len(weights)) / len(weights)
        ensemble = np.average(pred_arrays, axis=0, weights=weights)
    elif ensemble_method == 'median':
        ensemble = np.nanmedian(pred_arrays, axis=0)
    else:
        ensemble = np.nanmean(pred_arrays, axis=0)

    ensemble = np.where(np.isnan(ensemble), -9999.0, ensemble)

    safe_name = species_name.replace(' ', '_').lower()
    output_path = PRED_DIR / f"{safe_name}_ensemble.tif"
    save_prediction_raster(ensemble, grid_shape, transform, output_path)
    print(f"    Saved: {output_path.name}")

    # Save per-algorithm predictions
    for algo_name, pred in predictions.items():
        pred = np.where(np.isnan(pred), -9999.0, pred)
        save_prediction_raster(pred, grid_shape, transform,
                               PRED_DIR / f"{safe_name}_{algo_name}.tif")

    # MESS map
    if config['modelling'].get('generate_mess', False):
        training_env = data[data['presence'] == 1][env_cols].values
        mess_values = compute_mess(training_env, X_grid)
        mess_values = np.where(np.isnan(mess_values), -9999.0, mess_values)
        save_prediction_raster(mess_values, grid_shape, transform,
                               PRED_DIR / f"{safe_name}_mess.tif")

    return {
        'species': species_name,
        'cv_results': cv_results,
        'ensemble_method': ensemble_method,
        'n_presences': int(y.sum()),
        'n_background': int(len(y) - y.sum()),
        'n_env_variables': len(env_cols),
        'env_variables': env_cols,
        'prediction_file': str(output_path),
    }


def main():
    parser = argparse.ArgumentParser(description='Run SDM for Ithomiini species')
    parser.add_argument('--species', nargs='*', help='Specific species to model')
    parser.add_argument('--poc', action='store_true', help='Run proof-of-concept species only')
    args = parser.parse_args()

    print("=" * 70)
    print("STEP 4: RUN SPECIES DISTRIBUTION MODELS")
    print("=" * 70)

    # Load environmental rasters (excluding host plant layers)
    print("\n1. Loading environmental layers...")
    env_rasters = get_env_rasters()

    # Load target-group background
    print("\n2. Loading target-group background data...")
    all_coords = load_all_occurrences()
    if all_coords is None:
        print("WARNING: No target-group data. Using random background.")
    else:
        print(f"  {len(all_coords)} total Ithomiini coordinates for background sampling")

    # Create bias raster if enabled
    bias_weights = None
    bias_grid_coords = None
    if config['modelling'].get('use_bias_raster', False) and all_coords is not None:
        print("\n3. Creating bias raster (KDE of all occurrences)...")
        bandwidth = config['modelling'].get('bias_bandwidth', 1.0)
        bias_weights, bias_grid_coords, _ = create_bias_raster(
            all_coords, config['study_area'], resolution=0.1, bandwidth=bandwidth
        )
        print(f"  Bias raster created (bandwidth={bandwidth}°, {len(bias_weights)} cells)")
    else:
        print("\n3. Bias raster: disabled")

    # Species list
    if args.species:
        species_list = args.species
    elif args.poc:
        species_list = config['species']['proof_of_concept']
    else:
        viable_path = OCC_DIR / "viable_species.json"
        with open(viable_path) as f:
            species_list = json.load(f)

    print(f"\n4. Modelling {len(species_list)} species...")
    print(f"   Algorithms: {config['modelling']['algorithms']}")
    print(f"   CV: {config['modelling']['cv_strategy']} ({config['modelling']['cv_folds']} folds)")
    print(f"   Ensemble: {config['modelling']['ensemble_method']}")
    print(f"   VIF threshold: {config['modelling'].get('vif_threshold', 'disabled')}")
    print(f"   Bias raster: {'yes' if bias_weights is not None else 'no'}")
    print(f"   MESS maps: {config['modelling'].get('generate_mess', False)}")

    all_results = []

    for i, species_name in enumerate(species_list):
        print(f"\n── [{i+1}/{len(species_list)}] {species_name} ──")

        species_gdf = load_species_data(species_name)
        if species_gdf is None or len(species_gdf) < config['modelling']['min_records']:
            print(f"  Skipping: insufficient data")
            continue

        print(f"  {len(species_gdf)} occurrence records")

        print(f"  Preparing training data...")
        data, env_cols, extent = prepare_training_data(
            species_gdf, env_rasters, all_coords,
            bias_weights=bias_weights, bias_grid_coords=bias_grid_coords,
        )
        n_pres = data['presence'].sum()
        print(f"  Training data: {int(n_pres)} presences, {int(len(data) - n_pres)} background")

        if n_pres < 10:
            print(f"  Skipping: too few presences after env extraction ({int(n_pres)})")
            continue

        result = generate_predictions(data, env_cols, env_rasters, species_name, extent)
        if result:
            all_results.append(result)

    # Save summary
    if all_results:
        summary_path = PRED_DIR / "sdm_results_summary.json"
        with open(summary_path, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)
        print(f"\n\nSaved results summary: {summary_path}")

        print(f"\n{'Species':<35} {'N':>5} {'AUC':>7} {'TSS':>7} {'Boyce':>7} {'Vars':>5}")
        print("─" * 70)
        for r in all_results:
            n = r['n_presences']
            best_auc = max((cv.get('auc', 0) for cv in r['cv_results'].values()), default=0)
            best_tss = max((cv.get('tss', 0) for cv in r['cv_results'].values()), default=0)
            best_boyce = max((cv.get('boyce', 0) for cv in r['cv_results'].values() if cv.get('boyce') is not None), default=0)
            n_vars = r['n_env_variables']
            print(f"  {r['species']:<33} {n:>5} {best_auc:>7.3f} {best_tss:>7.3f} {best_boyce:>7.3f} {n_vars:>5}")

    print(f"\n\nStep 4 complete! Modelled {len(all_results)}/{len(species_list)} species.")


if __name__ == "__main__":
    main()
