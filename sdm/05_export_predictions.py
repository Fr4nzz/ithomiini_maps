#!/usr/bin/env python3
"""
Step 5: Export SDM predictions for web visualization.
- Generates species richness map
- Converts GeoTIFFs to PMTiles for MapLibre
- Creates GeoJSON contours for lightweight web layers
- Generates summary statistics and metadata
"""

import json
import yaml
import numpy as np
import rasterio
from rasterio.merge import merge
from pathlib import Path
import subprocess
import sys

CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH) as f:
    config = yaml.safe_load(f)

PRED_DIR = Path(__file__).parent / config["paths"]["predictions"]
FIG_DIR = Path(__file__).parent / config["paths"]["figures"]
FIG_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data" / "sdm"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def generate_richness_map():
    """
    Stack all ensemble predictions and create a species richness map.
    Richness = count of species predicted present (probability > threshold).
    """
    print("\n── Generating Species Richness Map ──")

    threshold = config["output"]["threshold"]
    ensemble_files = sorted(PRED_DIR.glob("*_ensemble.tif"))

    if not ensemble_files:
        print("  No ensemble predictions found. Run step 04 first.")
        return None

    print(
        f"  Stacking {len(ensemble_files)} species predictions (threshold={threshold})..."
    )

    # Create a common grid covering the full study area
    study = config["study_area"]
    resolution = config["modelling"]["prediction_resolution"]

    lons = np.arange(study["west"], study["east"], resolution)
    lats = np.arange(study["south"], study["north"], resolution)
    n_cols, n_rows = len(lons), len(lats)
    nodata = -9999.0

    richness = np.zeros((n_rows, n_cols), dtype=np.float32)
    mean_suitability = np.zeros((n_rows, n_cols), dtype=np.float32)
    n_valid = np.zeros((n_rows, n_cols), dtype=np.int32)

    from rasterio.transform import from_bounds

    common_transform = from_bounds(
        study["west"], study["south"], study["east"], study["north"], n_cols, n_rows
    )

    for f in ensemble_files:
        with rasterio.open(f) as src:
            data = src.read(1)
            bounds = src.bounds

            # Map this raster's pixels into the common grid
            col_start = max(0, int((bounds.left - study["west"]) / resolution))
            col_end = min(n_cols, col_start + src.width)
            row_start = max(0, int((study["north"] - bounds.top) / resolution))
            row_end = min(n_rows, row_start + src.height)

            # Slice the data to match the common grid window
            src_row_start = (
                max(0, int((study["north"] - bounds.top) / resolution) - row_start)
                if row_start == 0
                else 0
            )
            src_col_start = (
                max(0, int((bounds.left - study["west"]) / resolution) - col_start)
                if col_start == 0
                else 0
            )

            h = min(row_end - row_start, data.shape[0] - src_row_start)
            w = min(col_end - col_start, data.shape[1] - src_col_start)

            if h <= 0 or w <= 0:
                continue

            window = data[
                src_row_start : src_row_start + h, src_col_start : src_col_start + w
            ]
            valid = (window != nodata) & (window >= 0) & (window <= 1)

            target_slice = (
                slice(row_start, row_start + h),
                slice(col_start, col_start + w),
            )
            richness[target_slice][valid] += (window[valid] >= threshold).astype(
                np.float32
            )
            mean_suitability[target_slice][valid] += window[valid]
            n_valid[target_slice][valid] += 1

    # Average suitability
    mask = n_valid > 0
    mean_suitability[mask] /= n_valid[mask]
    mean_suitability[~mask] = nodata

    # Save richness
    richness_path = PRED_DIR / "species_richness.tif"
    profile = {
        "driver": "GTiff",
        "height": n_rows,
        "width": n_cols,
        "count": 1,
        "dtype": "float32",
        "crs": "EPSG:4326",
        "transform": common_transform,
        "nodata": nodata,
        "compress": "deflate",
    }
    with rasterio.open(richness_path, "w", **profile) as dst:
        richness_float = richness.astype(np.float32)
        richness_float[~mask] = nodata
        dst.write(richness_float, 1)
    print(f"  Saved: {richness_path.name} (max richness: {int(richness.max())})")

    # Save mean suitability
    suitability_path = PRED_DIR / "mean_suitability.tif"
    with rasterio.open(suitability_path, "w", **profile) as dst:
        dst.write(mean_suitability, 1)
    print(f"  Saved: {suitability_path.name}")

    return richness_path, suitability_path


def generate_contours(raster_path, output_path, levels=None):
    """
    Convert a raster to GeoJSON contour polygons using GDAL.
    Lighter than full raster tiles for web display.
    """
    if levels is None:
        levels = [0.3, 0.5, 0.7, 0.9]

    try:
        # Use gdal_contour to generate contour lines
        for level in levels:
            contour_path = (
                output_path.parent / f"{output_path.stem}_{int(level * 100)}.geojson"
            )
            cmd = [
                "gdal_contour",
                "-a",
                "probability",
                "-fl",
                str(level),
                "-f",
                "GeoJSON",
                str(raster_path),
                str(contour_path),
            ]
            subprocess.run(cmd, capture_output=True, check=True)

        return True
    except FileNotFoundError:
        print("  WARNING: gdal_contour not found. Install GDAL CLI tools.")
        return False
    except subprocess.CalledProcessError as e:
        print(f"  WARNING: gdal_contour failed: {e.stderr.decode()}")
        return False


def generate_web_metadata():
    """
    Create metadata JSON for the web app to discover SDM layers.
    """
    print("\n── Generating Web Metadata ──")

    # Load results summary
    summary_path = PRED_DIR / "sdm_results_summary.json"
    if not summary_path.exists():
        print("  No results summary found.")
        return

    with open(summary_path) as f:
        results = json.load(f)

    # Build metadata for web app
    species_layers = []
    for r in results:
        species_name = r["species"]
        safe_name = species_name.replace(" ", "_").lower()

        # Get best AUC across algorithms
        best_auc = max((cv.get("auc", 0) for cv in r["cv_results"].values()), default=0)

        best_boyce = r.get("best_boyce", 0)
        if isinstance(best_boyce, float) and (best_boyce != best_boyce):
            best_boyce = 0

        response_curves = r.get("response_curves", {}).get("variables", [])

        env_summary = []
        for v in response_curves:
            env_summary.append(
                {
                    "variable": v["variable"],
                    "label": v["label"],
                    "unit": v["unit"],
                    "optimal_range": v["optimal_range"],
                    "importance": v["importance"],
                    "confidence": v["confidence"],
                    "gradient": v["gradient"],
                    "response_mean": v["response_mean"],
                    "response_std": v["response_std"],
                }
            )

        species_layers.append(
            {
                "species": species_name,
                "file": f"{safe_name}_ensemble.tif",
                "n_records": r["n_presences"],
                "auc": round(best_auc, 3),
                "boyce": round(best_boyce, 3) if best_boyce else 0,
                "tier": r.get("tier", "unknown"),
                "confidence": r.get("confidence", "unknown"),
                "algorithms_used": r.get(
                    "algorithms_used", list(r["cv_results"].keys())
                ),
                "ensemble_method": r["ensemble_method"],
                "env_summary": env_summary,
            }
        )

    metadata = {
        "type": "sdm_predictions",
        "n_species": len(species_layers),
        "threshold": config["output"]["threshold"],
        "env_variables": [
            "CHELSA bioclimatic (BIO1,2,4,5,6,12,13,14,15)",
            "Elevation (WorldClim 30s)",
            "Cloud cover (EarthEnv)",
        ],
        "modelling": {
            "algorithms": config["modelling"]["algorithms"],
            "cv_strategy": config["modelling"]["cv_strategy"],
            "cv_folds": config["modelling"]["cv_folds"],
            "background_strategy": config["modelling"]["background_strategy"],
            "thinning_distance_km": config["modelling"]["thinning_distance_km"],
        },
        "species": species_layers,
    }

    metadata_path = OUTPUT_DIR / "sdm_metadata.json"
    # Replace NaN with null for valid JSON
    import math

    def sanitize(obj):
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [sanitize(v) for v in obj]
        return obj

    with open(metadata_path, "w") as f:
        json.dump(sanitize(metadata), f, indent=2)
    print(f"  Saved: {metadata_path}")

    return metadata


def split_ensemble_rasters():
    """
    Split each `{species}_ensemble.tif` into two co-registered rasters:

      • {species}_ensemble_core.tif       — values inside the accessible-area
                                            polygon, NaN/-9999 outside.
      • {species}_ensemble_extension.tif  — values outside the accessible-area
                                            polygon, NaN/-9999 inside.

    The original full-Neotropics `_ensemble.tif` is preserved as the canonical
    artifact. The core/extension pair lets the web app load each as its own
    layer and toggle the extension off to fall back to the accessible-area
    view without a re-fetch.
    """
    print("\n── Splitting ensemble rasters (core / extension) ──")

    try:
        import geopandas as gpd
        from rasterio.features import geometry_mask
    except Exception as exc:
        print(f"  Skipped (deps missing: {exc})")
        return

    ensemble_files = sorted(PRED_DIR.glob("*_ensemble.tif"))
    nodata = -9999.0
    n_split = 0
    n_skipped = 0

    for ens_path in ensemble_files:
        safe_name = ens_path.stem.replace("_ensemble", "")
        poly_path = PRED_DIR / f"{safe_name}_accessible.geojson"
        if not poly_path.exists():
            n_skipped += 1
            continue

        try:
            poly_gdf = gpd.read_file(poly_path)
            if poly_gdf.empty:
                n_skipped += 1
                continue

            with rasterio.open(ens_path) as src:
                data = src.read(1)
                profile = src.profile.copy()
                # geometry_mask returns True where geom does NOT cover the pixel.
                outside_mask = geometry_mask(
                    geometries=poly_gdf.geometry,
                    out_shape=data.shape,
                    transform=src.transform,
                    invert=False,  # True = outside polygon
                    all_touched=False,
                )

            valid = data != nodata
            inside = valid & ~outside_mask
            outside = valid & outside_mask

            core = np.full_like(data, nodata, dtype=np.float32)
            core[inside] = data[inside].astype(np.float32)

            ext = np.full_like(data, nodata, dtype=np.float32)
            ext[outside] = data[outside].astype(np.float32)

            profile.update(dtype="float32", nodata=nodata, compress="deflate")
            with rasterio.open(PRED_DIR / f"{safe_name}_ensemble_core.tif", "w", **profile) as dst:
                dst.write(core, 1)
            with rasterio.open(PRED_DIR / f"{safe_name}_ensemble_extension.tif", "w", **profile) as dst:
                dst.write(ext, 1)
            n_split += 1
        except Exception as exc:
            print(f"  Failed split for {safe_name}: {exc}")
            n_skipped += 1

    print(f"  Split {n_split} ensemble rasters ({n_skipped} skipped — missing/bad polygons)")


def copy_key_outputs():
    """Copy key prediction files to public/data/sdm/ for web serving."""
    print("\n── Copying Outputs to public/data/sdm/ ──")

    import shutil

    # Copy richness and suitability maps
    for name in ["species_richness.tif", "mean_suitability.tif"]:
        src = PRED_DIR / name
        if src.exists():
            dst = OUTPUT_DIR / name
            shutil.copy2(src, dst)
            print(f"  Copied: {name}")

    species_dir = OUTPUT_DIR / "species"
    species_dir.mkdir(exist_ok=True)

    # Copy ensemble + core + extension rasters for every species. The full
    # ensemble is kept as the canonical artifact; core/extension are the
    # split pair the web app uses for its toggle.
    patterns = ["*_ensemble.tif", "*_ensemble_core.tif", "*_ensemble_extension.tif"]
    total = 0
    for pat in patterns:
        files = sorted(PRED_DIR.glob(pat))
        for f in files:
            shutil.copy2(f, species_dir / f.name)
        print(f"  Copied {len(files)} files matching {pat}")
        total += len(files)
    print(f"  Total per-species rasters copied: {total}")


def main():
    print("=" * 70)
    print("STEP 5: EXPORT SDM PREDICTIONS")
    print("=" * 70)

    # Generate richness map
    richness_result = generate_richness_map()

    # Split each species's full-Neotropics ensemble raster into a "core"
    # (inside accessible area) and "extension" (outside) pair so the web
    # app can toggle the extrapolation layer on/off.
    split_ensemble_rasters()

    # Generate web metadata
    generate_web_metadata()

    # Copy outputs
    copy_key_outputs()

    # Summary
    ensemble_count = len(list(PRED_DIR.glob("*_ensemble.tif")))
    print(f"\n  Summary:")
    print(f"    Species models: {ensemble_count}")
    print(f"    Output directory: {OUTPUT_DIR}")
    print(f"    Files for web app: {OUTPUT_DIR / 'sdm_metadata.json'}")

    if richness_result:
        print(f"    Richness map: {richness_result[0].name}")
        print(f"    Suitability map: {richness_result[1].name}")

    print("\nStep 5 complete!")
    print(
        "\nNext: Add SDM layer toggle to the Vue web app (src/components/SDMLayer.vue)"
    )


if __name__ == "__main__":
    main()
