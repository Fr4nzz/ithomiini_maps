# Phase 3 targeted method and resource checks

Date: 22 September 2026. Baseline: `3b2fee94d15c891952494f4a9074576febc12a00`. This record supplements, but does not rewrite, the Phase 1 evidence ledger.

## Environmental predictors and retained SDM parameters

The April release's `sdm/config.yaml`, `02_download_env_data.py`, `04_run_sdm.py` and `06_tune_weak_species.py` have the same Git blobs as the inspected baseline files. Thus these are release-matched source checks, not assumptions based on later documentation. The release is `1cdde9bc8d5f4375def888b5796e71493ee60d68`.

| Item | Source and outcome | Manuscript decision |
|---|---|---|
| CHELSA | `config.yaml`, `02_download_env_data.py`: `CHELSA_bio{1,2,4,5,6,12,13,14,15}_1981-2010_V.2.1.tif`, 30 arc seconds. [Dataset DOI](https://doi.org/10.16904/envidat.228) specifies v2.1. | Added exact version, baseline, variables and Karger et al. (2021). |
| Elevation | Downloader requests `wc2.1_30s_elev.zip` from WorldClim v2.1 endpoints. The configuration's CGIAR-SRTM label does not identify the executed download. [WorldClim documentation](https://www.worldclim.org/data/worldclim21.html) describes SRTM-derived elevation. | Cited Fick & Hijmans (2017), WorldClim v2.1, 30 arc seconds. |
| Cloud frequency | Configured EarthEnv `MODCF_meanannual.tif`, locally named `MODCF_meanannual_01.tif`. [EarthEnv](https://www.earthenv.org/cloud) identifies Global 1-km Cloud Frequency, version 1, and Wilson & Jetz (2016). | Added dataset/version and primary citation. |
| Actual input bytes | The downloader can reuse existing files. Historical input-raster hashes were not available. | Exact configured sources established, not independent attestation of every raster byte consumed by the April fit. Optional reproducibility enhancement only. |
| Thinning and extent | `config.yaml`, `01_prepare_occurrences.py`, `scripts/spatial_qc.py`: 5 km, 120°W–30°W and 40°S–25°N. | Retained. |
| Coordinate screening | `spatial_qc.py`: uncertainty above 100,000 m, placeholder locality, extent and ocean checks. | Retained the specified screening criteria. |
| Coastline | GSHHS path supports 5 km coastal tolerance. A coarser Natural Earth mask can be used, and a missing/failed mask can skip filtering. | Qualified the ocean-check statement. No assertion that every historical run used the same mask. |
| Accessible areas | DBSCAN eps 500 km, minimum three points. Range-scaled buffer is 0.25 times cluster diameter, bounded at 50–500 km. | Retained 50/500 km bounds. Extra settings remain in this provenance record rather than bloating the manuscript. |
| Algorithm tiers | `04_run_sdm.py`: 20–49 presences uses MaxEnt/jackknife. At least 50 uses MaxEnt, `RandomForestClassifier` and `XGBClassifier` with spatial-block validation where feasible. | Corrected the old fewer-than-30 leave-one-out wording. Added random forest and XGBoost citations. |
| Small-sample diagnostics | `jackknife_cv`, lines 622–681: individual held-out predictions are collected, but AUC and Boyce are calculated through `evaluate_model(y, all_pred)` from a model fitted on all rows. | Explicitly states that these summaries are not held-out validation. No algorithm, evaluation or raster was rerun. |
| Tuning | Candidate regularisation multipliers 0.5–4.0 in increments of 0.5, feature classes L/LQ/LQH/LQHP, approximately 0.01 score tie tolerance and simpler-model selection. Default comparison is not strictly “retain only if improvement”. | Narrowed to candidate/default comparison with similar-score preference for simplicity. Small-sample metric limitation remains attached. |
| Grid | Common prediction resolution 0.1°. | Retained. No maximum simultaneous layer count is asserted. |
| Released population | Phase 1's 145 complete species sets, three product types, retained. | No 155-model performance statistics restored. |

## Camera and protocol

The original `paper/Photos Processing Protocol.md` supports the articulated mount, levelling, manual focus, CAMID/colour reference, dorsal/ventral handling, dated batches, reviewed renaming, storage and indexing. The archived author's setup message supports Canon EOS 550D, EF-S 18–55 mm f/4–5.6 IS STM and approximately 28 cm lens-to-table distance.

The numerical exposure example (33 mm, 1/100 s, f/8, ISO 100, manual exposure, flash off) was traceable only to an older assistant's image-metadata report. Its source photograph was not available. Those numbers and the unsupported taped-zoom assertion were removed rather than presented as freshly checked observations. They are not necessary to apply S1.

S1 uses the processor README at `49fe6ed226ed4914ed793e4252b74e18cf6ad8a4` and Gallery README/indexer/processing/update sources at `f5cb03f17f3ba639090b32fbedde6d6645ff847b`. Current spreadsheet menu labels replace obsolete protocol labels. This was a documentation/code check, not a new end-to-end photography or database-update test.

The archived setup ZIP and `CAM077884v.jpg` were not available in the manuscript repository or located through the available Project/Library search. The processor repository has a historical 2025 screenshot, not a dated capture of the documented manuscript interface. It was not reused as a current Figure 2 panel.

## Occurrence identifier and timestamp

The exact checkout's manifest gives `generated_at: 2026-05-09T13:14:47Z` and a 104,297-record total. It does not itself contain the cited GBIF DOI. The Phase 2 Data Availability timestamp and attribution of the DOI to the manifest were therefore removed. The manuscript reports the date without unnecessary timestamp precision and calls the DOI project-recorded. The original ledger is unchanged. DOI `10.15468/dl.6zagkz` did not resolve through the DOI resolver, DataCite or Handle APIs. Scope confirmation requires the original download receipt, not another occurrence audit.

## Runtime source identity and access

The old full Space source SHA `3aa72a36c37ce8b383f8f5a5f9ec5763f52e5e42` returned HTTP 404. The public Space API and a pinned source fetch identify `3aa72a33946f2da661d1ed96f0929e92cd9413e6`. Inspection of its uploaded-photo `CosineHead` preserves the Phase 2 LayerNorm, normalisation and scale-30 description without a residual adapter. Only the invalid source identifier was corrected. Runtime-loaded head/segmenter bytes were not independently attested.

The BioCLIP resource revision is `6e3d04e3d6522012c88181085c5ae666e14c45cd`. Its public model card declares MIT. The fitted classifier repository, at `61c8fb58578a2ea64c6972e17b5101697729eaa8`, declares CC BY-NC 4.0. Publication, resource revision, published object identity and runtime-loaded identity remain separate.

Gallery and Atlas root interfaces returned HTTP 200. Direct Gallery `ai_identifier` HTTP access returned 404, while the pinned application source defines that route and an SPA fallback. The manuscript therefore links the root interface and identifies the tab, rather than claiming a successful standalone deep-link test.

GitHub reported the working Atlas, public Atlas, Gallery and processor repositories as public. Their repository metadata did not establish a licence, and the inspected processor/Gallery trees had no licence file. The Atlas README's MIT statement did not have an accompanying licence file in the inspected tree. Repository visibility was not changed. “Source-available” replaces the unsupported toolkit-wide “open-source” claim. Authors must settle code and asset licensing before a public submission archive. No DOI deposit or release tag was created.

## Deliberately unchanged scientific scope

All Phase 2 classifier architecture distinctions, rank-specific benchmark denominators and scores, geographic percentage-point effects, selected sex-prediction cohort, May occurrence total, 145-species complete raster population, sequencing-status caveat, non-quantitative host treatment and mixed vector/raster export description are retained. No training, evaluation, environmental download, host-count reconciliation or occurrence rebuild was performed.
