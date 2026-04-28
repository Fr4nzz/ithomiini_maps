# SDM uniform-extent rasters + GBIF filter parity

**Date:** 2026-04-28
**Author:** Franz / Claude
**Status:** Approved (verbal), executing

## Problem

Two issues observed on the deployed map:

1. **Per-species rasters have different extents.** *Mechanitis messenoides* renders smaller than *Mechanitis polymnia* because each species's prediction grid is built from its own DBSCAN-clustered accessible area. Visually inconsistent and hard to compare species side-by-side.
2. **Web-map GBIF refresh path doesn't apply the full SDM-input filter set.** `01_prepare_occurrences.py` removes ocean points (Natural Earth land mask) and clips to a Neotropical bbox; `process_data.py` (the script that runs on a GBIF refresh and rebuilds `map_points*.json`) only has the d67a515 quality filters (uncertainty / lat>35°N / museum keywords). Ocean and bbox filters are not aligned across the two paths.

## Goals

- Every species's `_ensemble.tif` covers the same study extent (full Neotropics, `study_area` in `config.yaml`: -120°W → -30°E, -40°S → +25°N, 0.1°).
- Front-end can toggle between "full Neotropics" (default) and "accessible area only" without re-fetching rasters.
- `process_data.py` applies the same ocean-mask + bbox clip as `01_prepare_occurrences.py` so the next GBIF refresh is consistent across SDM input and web map.
- Trained SDM models are persisted to disk so future extent / grid changes don't require retraining.
- Manuscript proposed edits (`proposed_edits_v3.md`) reflect the changes.

## Non-goals

- No fresh GBIF download this iteration (existing dump is recent enough, per user).
- No MESS-based front-end styling for extrapolation regions yet (deferred).
- No history rewrite for the leaked `gbif_credentials.env` (separate task).

## Design

### 1. Filter parity in `scripts/process_data.py`

Append two new filter steps to the existing coordinate-quality block (added in d67a515) so the order matches `01_prepare_occurrences.py`:

```
1. Coordinate uncertainty > 100 km           (already present)
2. Latitude > 35°N                            (already present)
3. Museum / zoo / no-locality keywords        (already present)
4. Outside Neotropical bbox (study_area)      (NEW)
5. Ocean points (Natural Earth land mask)     (NEW)
```

Implementation notes:
- Re-use `sdm/data/env_variables/ne_110m_land/` (Natural Earth shapefile already on disk).
- Bbox values pulled from `sdm/config.yaml::study_area`.
- Both filters wrapped in graceful fallback if `geopandas` / Natural Earth shapefile is missing — log a warning, skip the filter, don't crash the GBIF refresh.

### 2. Predict on full Neotropics grid in `sdm/04_run_sdm_tuned.py`

Currently `generate_predictions()` builds a per-species `accessible` polygon and calls `create_prediction_grid(accessible, resolution)`. Change:

- Build the prediction grid from `study_area` (full Neotropics) once, share it across species.
- Train SDMs unchanged (still use accessible-area background sampling — only the *prediction* grid widens).
- For each species, also retain the accessible-area polygon so step 5 can split the raster.

### 3. Persist trained models

Add `sdm/data/models/` directory. After fitting each species's algorithm in `04_run_sdm_tuned.py`:

- sklearn (`random_forest`, `gbm`): `joblib.dump(model, MODEL_DIR / f"{species}_{algo}.joblib")`.
- maxent: save the wrapper's coefficients/lambda file (whatever artifact `ALGORITHM_MAP['maxent']` returns) under the same naming.
- Save the fitted env-column list and any per-species feature pipeline alongside the model so it can be reloaded.

This is preparation for a future `predict_only.py`. Not implementing the predict-only entry point yet — just persisting so we have the option.

### 4. Split ensemble raster (core / extension) in `sdm/05_export_predictions.py`

For each species:

- Read `{species}_ensemble.tif` (full Neotropics).
- Read accessible-area polygon (saved as `sdm/data/predictions/{species}_accessible.geojson` from step 04).
- Produce two rasters with identical CRS / shape / transform:
  - `{species}_ensemble_core.tif` — values inside accessible area, NaN outside.
  - `{species}_ensemble_extension.tif` — values outside accessible area, NaN inside.
- Both compress well (mostly NaN), so storage cost ≈ one full-extent raster.

The original full-Neotropics `{species}_ensemble.tif` is also kept (as the canonical artifact for downstream analysis and as the source the splits are derived from).

PMTiles conversion: build separate PMTiles archives for `_core` and `_extension` so the front-end can load each as its own MapLibre source.

Per-algorithm rasters (`_maxent`, `_random_forest`, `_gbm`, `_mess`) are **not** split — they remain full-Neotropics single rasters (or revert to accessible-area-only if storage is a concern; default = full Neotropics for consistency).

### 5. Front-end toggle

Add a checkbox in the SDM controls panel: **"Show full Neotropics"** (default ON).

- ON: load both core + extension PMTiles layers → looks like full Neotropics prediction.
- OFF: unload extension layer → falls back to accessible-area-only view (matches the current production behavior).

No re-fetch on toggle; layers are already on the map, opacity / visibility flipped client-side.

### 6. Manuscript update

Edit `proposed_edits_v3.md` on `claude/review-manuscript-citations-nkMok` to add:

- Web-map data path now applies the same ocean mask + Neotropical bbox clip as the SDM input path (filter parity).
- SDM predictions are projected over the full Neotropical study extent, then split into accessible-area (core) and extrapolation (extension) layers; users can toggle the extrapolation layer.
- Note that predictions outside the accessible area are environmental projections beyond the model's training domain and should be interpreted with caution (suggest pairing with MESS in a future iteration).

## Execution order

1. Write spec ← here.
2. Patch `process_data.py` with ocean + bbox filters; rerun on existing GBIF dump.
3. Rerun `01_prepare_occurrences.py` (likely identical input/output, but kept for cleanliness).
4. Patch `04_run_sdm_tuned.py`: full-extent prediction grid + model serialization + accessible-area GeoJSON export.
5. Patch `05_export_predictions.py`: ensemble core/extension split + PMTiles for both.
6. Run full pipeline on Manuel's WSL2 PC (~2h).
7. Rsync results back to claudeclaw.
8. Front-end checkbox.
9. Update `proposed_edits_v3.md`.
10. Commit + push `main` and `claude/review-manuscript-citations-nkMok`.

## Risks / caveats

- **Storage size:** 143 species × (core + extension) PMTiles. At 0.1° / Neotropics, each ensemble is ~600 KB compressed; total ≈ 170 MB across the two layer sets. Tolerable for GitHub Pages.
- **Extrapolation:** predictions outside accessible area are statistically less defensible. Mitigated by the toggle (default ON for visibility) and a manuscript caveat.
- **Pipeline runtime:** ~2h on Manuel's PC. Single-shot retrain because last-run models weren't serialized; subsequent extent changes will be cheap.
- **Manuscript branch separation:** still not merged into `main`; this spec preserves that boundary.
