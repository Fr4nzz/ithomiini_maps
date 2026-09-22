# Author actions before submission

The manuscript contains no internal Phase 3 drafting markers. The following are real production or author decisions, not a request to restart the scientific audit.

## Required before sending the submission

| Owner | Action | Acceptance condition |
|---|---|---|
| Franz | Recover the original butterfly GBIF download receipt for `10.15468/dl.6zagkz`. The resolver and registry checks returned 404. | Confirm the exact identifier, download date and butterfly filter/predicate. Match the receipt to the selected input without silently substituting a later download or changing the 104,297-record snapshot. Replace the current qualified wording only after confirmation. |
| Franz, with image owners | Produce the four authentic Figure 2 captures specified below. | Supply unaltered captures, publication permission, per-panel source/capture metadata and the assembled plate. Final caption is already in the manuscript. There is intentionally no fake or broken Figure 2 image link. |
| All authors | Confirm title, author order and affiliations, select the corresponding author and supply a publication email. Choose target journal and check its word limit, reference style and required declarations. | Author-approved title page and journal-specific submission fields. The current affiliations and author order were not independently changed. |
| Joana, Patricio and Franz | Confirm funding bodies and grant numbers, any collection/export/research permits requiring citation, field/photography/collection contributors, competing interests and acknowledgements. | Exact approved wording, or explicit confirmation that a statement is not applicable. No grant, permit or new contributor name has been inferred. |
| All authors | Review the AI-assistance disclosure, including manuscript preparation, and place it in the journal's required section. | Journal-compliant disclosure approved by the authors. Existing thanks to Neil Rosser, James Mallet, GBIF and data publishers are retained. |
| Repository maintainers and authors | Confirm intended public repository visibility and the licences applicable to code, manuscript, images, model artifacts and environmental products. | Add or identify authoritative licences. Public GitHub visibility alone is not permission to reuse everything. The manuscript currently says source-available. No repository visibility or licence was changed. |
| Corresponding author | Decide the final archival destination after rights and Figure 2 are settled. | Archive the approved submission commit and permitted assets, with access terms. A Zenodo DOI deposit or public release requires the authors' decision. Existing immutable commits and source identifiers are already documented. |

## Exact Figure 2 capture specification

Use the manuscript caption unchanged unless a captured feature genuinely requires correction. Capture clean application states, not a mock-up. Preserve enough interface context to identify the feature and keep the original screenshot beside the assembled plate. No unreconciled occurrence, host or sequencing charts.

| Panel / filename | Required content | Metadata and safeguards |
|---|---|---|
| (a) `figure2a_gallery_collection.png` | Gallery collection view with dorsal and ventral photographs of one authorised specimen. Show its CAMID and sufficient taxonomy/record context to establish that the two views belong together. | Gallery source `f5cb03f17f3ba639090b32fbedde6d6645ff847b`, or document the exact revision actually captured. Record UTC capture date/time, viewport, CAMID, image owner and publication permission. |
| (b) `figure2b_uploaded_candidates.png` | AI Identifier tab with one authorised uploaded photograph and returned candidate names/scores. Show the supplied geographic options or their absence. | Record Gallery revision and actual Space source/runtime receipt if available. Current verified source is `3aa72a33946f2da661d1ed96f0929e92cd9413e6`. Do not place 91.33% collection accuracy beside this upload, imply calibrated correctness probabilities or add ordinary-upload sex accuracy. Test tab navigation and direct reload separately. |
| (c) `figure2c_atlas_occurrence.png` | Atlas occurrence records with source identity and one open specimen popup. Include a specimen photograph if authorised, or explicitly label a substitute as a reference image from another individual. | Record Atlas revision, layer snapshot, URL/filter state, source record/CAMID and photo credit. Prefer the documented May occurrence population. The photograph must not be presented as evidence for an individual it does not depict. |
| (d) `figure2d_atlas_suitability.png` | A species with complete released SDM products. Show the accessible-area core and extrapolated extension with their legend, separate from butterfly points and any independent plant layer. | Record species, Atlas revision, extent, layer/opacity settings and the 28 April 2026 raster release `1cdde9bc8d5f4375def888b5796e71493ee60d68`. Use relative suitability, not occurrence probability. Plant points do not establish host use. |

For each panel, record: panel filename, application URL, repository and full commit SHA, source-data/model release, UTC capture timestamp, browser/viewport, filters and layer settings, image IDs and rights/credit. Assemble the four authentic panels as `paper/figures/figure2_interfaces.png` with readable labels (a)–(d), then insert its relative image link immediately before the existing Figure 2 caption. Rerun the rendering checks. The current reading copies intentionally contain the final caption without a plate.

## Optional additions, not blockers for the current text

**Setup photographs.** Franz can supply the original `images_for_upload.zip`, including `images/image1.png`, `images/image2.png`, `images/image3.png` and the setup/lens/ruler photographs, with permission to publish. Recover `images/Setup photos/CAM077884v.jpg` only if its original exposure metadata are to be reinstated. A setup illustration should show the actual mount, camera-to-table distance, label, colour reference and wing positioning. S1 is complete as text without these assets.

**Reproducibility enhancements.** Preserve runtime encoder/head/segmenter hashes and resolved paths, release-matched training and per-CAMID evaluation manifests, taxonomic fold assignments, and environmental input checksums when readily available. These would support stronger reproducibility claims, but the manuscript does not claim to have independently established them. Keep upload accuracy, exact training totals, host totals, sequencing totals and aggregate SDM metrics omitted until matched evidence exists.

**Small-sample SDM validation.** The present text discloses that the 20–49-record tier's AUC/Boyce summaries use the full fit. Recomputing genuinely held-out summaries is a separate analysis, not a condition for retaining the current exploratory, non-aggregate SDM description.
