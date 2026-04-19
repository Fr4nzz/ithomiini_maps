# Ithomiini Species Distribution Modelling Pipeline

Ensemble SDM pipeline for ~400 Neotropical Ithomiini butterfly species, using occurrence records from the Ithomiini Maps project.

## Quick Start

```bash
# Create virtual environment and install dependencies
python3 -m venv sdm/.venv
source sdm/.venv/bin/activate
pip install -r sdm/requirements.txt

# Also need GDAL CLI tools for raster processing
sudo apt install gdal-bin libgdal-dev

# Run proof-of-concept (5 species)
cd sdm
python run_pipeline.py --poc

# Run full pipeline (all ~236 viable species)
python run_pipeline.py
```

## Pipeline Steps

| Step | Script | Description | Time (est.) |
|------|--------|-------------|-------------|
| 1 | `01_prepare_occurrences.py` | Extract Ithomiini records, clean coords, spatial thinning | 1 min |
| 2 | `02_download_env_data.py` | Download CHELSA bioclim, elevation, cloud cover | 30-60 min |
| 3 | `03_host_plants.py` | Download Solanaceae GBIF records, create host plant layers | 10-20 min |
| 4 | `04_run_sdm.py` | Fit MaxEnt + RF + GBM ensembles per species | 1-6 hours |
| 5 | `05_export_predictions.py` | Generate richness maps, web metadata, copy to public/ | 2 min |

Run individual steps: `python run_pipeline.py --step 2`
Run a range: `python run_pipeline.py --step 1-3`
Run specific species: `python run_pipeline.py --species "Mechanitis polymnia" "Tithorea harmonia"`

## Methods

### Algorithms
- **MaxEnt** (via `elapid`) — Gold standard for presence-only data
- **Random Forest** (via `scikit-learn`) — Presence/pseudo-absence classification
- **XGBoost GBM** — Gradient boosted machines for ensemble diversity

### Environmental Variables
- **CHELSA v2.1** bioclimatic (BIO1,2,4,5,6,12,13,14,15) — Temperature and precipitation
- **Elevation** (WorldClim 30s) — Topographic control
- **Cloud cover** (EarthEnv) — Moisture/cloud forest proxy
- **Host plant density** (GBIF Solanaceae occurrences) — Biotic predictor

### Key Design Decisions
- **Target-group background sampling** — Background points drawn from all Ithomiini collection locations (corrects for collector bias)
- **Spatial block cross-validation** — Prevents spatial autocorrelation from inflating metrics
- **Weighted ensemble** — Algorithms weighted by cross-validation AUC
- **5 km spatial thinning** — Reduces sampling bias from dense field station collections

### Host Plants
Ithomiini larvae feed almost exclusively on Solanaceae (nightshades). Host plant distributions from GBIF are rasterized as an additional environmental predictor. See `data/host_plants/ithomiini_host_plants.json` for the genus-level host plant database compiled from literature.

## Output

### For Web App (`public/data/sdm/`)
- `sdm_metadata.json` — Species list, metrics, layer metadata
- `species_richness.tif` — Predicted species richness map
- `mean_suitability.tif` — Mean habitat suitability across species
- `species/*.tif` — Per-species ensemble prediction rasters

### For Analysis (`sdm/data/predictions/`)
- Per-species rasters for each algorithm and ensemble
- `sdm_results_summary.json` — Full metrics and configuration

## Configuration

Edit `config.yaml` to customize:
- Study area extent
- Environmental variables
- Modelling parameters (thinning distance, background strategy, algorithms)
- Species selection
- Output options

## References

- Doré et al. (2022) — Ithomiini diversity mapping (388 species SDM)
- Van der Burg et al. (2021) — Heliconius SDM pipeline (CHELSA + ensemble)
- Phillips et al. (2009) — Target-group background sampling
- Barbet-Massin et al. (2012) — Pseudo-absence strategies
- Willmott & Freitas (2006) — Ithomiini host plants
