# Phase 2 manuscript revision and Phase 3 handoff

## Delivered manuscript

The revised source is `paper/manuscript.md` on `manuscript/final-draft-20260921`. The rewrite commit is `9c7e76aa17f2590ac29344dfe727f40ba9e6ed7c`, whose parent is the Phase 1 commit `67eb756639aa99b7ce8307a7f435c1635e0787a7`.

The Phase 1 branch was checked before editing and still pointed to its expected commit. The local July baseline was checked byte-for-byte against Git blob `683f79a263706b15e51f06322393f831bd5e7aaa`. The revised manuscript was committed through the connected GitHub contents API. The returned blob matches the locally validated manuscript:

- Git blob: `f01cb342794f3096a6ec985fbf42dca07831fcce`
- SHA-256: `4b358de8589225c0d61581a66fa1a9031c4feb5c329f288c98e4d04843c32055`
- Size: 57,519 bytes

The rewrite changes 170 lines and removes 150 lines relative to the July baseline. These large paragraph-level changes include heading normalisation and reordered material, not only new scientific claims. The Phase 1 evidence ledger and application code were not edited.

## Scientific decisions applied

The primary guide remains [the Phase 1 ledger](final_manuscript_evidence_20260921.md). This handoff records editorial decisions and validation, not a replacement forensic audit.

| Topic | Decision in the revised manuscript | Evidence basis |
| --- | --- | --- |
| Uploaded-image inference | Frozen BioCLIP 2.5-H, 1,024 image features, LayerNorm, L2-normalised features and weights, cosine similarity at scale 30, finest-rank softmax and downstream rank aggregation | Phase 1 upload architecture and inspected inference path |
| Unsupported architecture details | No residual adapter. No additional fitted calibration temperature. No claims about the released subcentre count, training angular margin, optimiser or epochs | Phase 1 distinction between established inference and unresolved training configuration |
| Image localisation | Ultralytics-based wing localisation, padded RGB crops, 6% documented margin and full-image fallback. No assertion of a release-matched YOLO26s-seg checkpoint or SAM 3 training provenance | Phase 1 preprocessing evidence and segmentation limits |
| Scores and geography | Top 64 returned leaves constrain aggregation. Model scores are not calibrated correctness probabilities. Geography reweights candidates after classification, including a soft 0.02 penalty rather than hard exclusion | Phase 1 code evidence |
| Paired collection workflow | Separate fitted release using concatenated 2,048-dimensional dorsal/ventral representations. Single-view fallback handling is not counted as a verified pair | Phase 1 paired release evidence |
| Model coverage | Reported release coverage of 7,933 finest-rank classes, 4,478 species and 4,958 named subspecies. No claim of an independent accepted-name audit | Phase 1 published coverage |
| Collection benchmark | All four rank-specific Top-1/Top-5 rows retained, with 3,829 verified pairs, three seeds, five held-out folds and the reported geography/species-context configuration | Phase 1 published results, corroborated against pinned Gallery About text |
| Upload benchmark | No upload accuracy claim. The abstract explicitly confines 91.33% to eligible paired Sanger specimens with geographic re-ranking | Phase 1 absence of a release-matched single-photo benchmark |
| Sex prediction | One Methods paragraph and one Results paragraph. Predictions for 1,586 specimens are separate from the 1,220-specimen, 57-species benchmark at approximately 89.7% | Phase 1 published collection scope |
| Occurrences | Frozen 9 May 2026 total of 104,297 records and GBIF DOI 10.15468/dl.6zagkz retained. Source, country, taxonomy, curation and mimicry-count breakdowns omitted | Phase 1 also leaves these detailed May-snapshot breakdowns unreconciled |
| Table 1 | Replaced the unreconciled count table with a qualitative five-source table | Avoids mixing the selected occurrence snapshot with other builds |
| SDMs | 145 species with full, accessible-area core and extrapolated-extension products. No old aggregate AUC, Boyce or confidence-category summaries | Phase 1 release history for 28 April 2026 |
| Host plants | Retained qualitative methods and ecological context. Omitted association, taxon, support-category and mapped-occurrence totals and an unreconciled plant-download DOI | Phase 1 quantitative state unresolved |
| Sequencing | Used recorded pipeline status. ToLID assignment is not completion, rack/tissue fields are proxies, and residual categories do not prove availability | Phase 1 processing-code interpretation |
| R export | Occurrence points and range polygons can remain vector. Basemaps and image overlays remain raster. Not all interactive layers are independent editable data | Phase 1 export-code evidence, without claiming end-to-end execution |

The four retained taxonomic benchmark rows are:

| Rank | Eligible specimens | Top-1 | Top-5 |
| --- | ---: | ---: | ---: |
| Named subspecies | 2,613 | 87.93% | 97.33% |
| Species | 3,355 | 91.33% | 97.91% |
| Genus | 3,806 | 95.55% | 99.26% |
| Family | 3,824 | 99.32% | 99.90% |

Geographic Top-1 changes remain +0.21 percentage points for species, +0.74 for named subspecies and -0.16 for genus. These are published collection results, not new calculations.

## Targeted checks, without repeating Phase 1

The following Gallery files were read at `f5cb03f17f3ba639090b32fbedde6d6645ff847b`: `src/components/AIIdTab.vue`, `tests/aboutTool.test.mjs`, `tests/paired-release.test.mjs` and selected portions of `src/utils/aiPredict.js`. Tests were inspected, not executed. The About text corroborates the benchmark populations, metrics, collection/upload distinction, sex scope and reference-label sources. Butterflies of America, Sangay, Noreste and Cotacachi are described as the Gallery's stated reference sources, not as an enumerated release-bound training manifest.

Primary sources consulted for the revised classifier citations were the BioCLIP 2 paper (`arXiv:2505.23883v2`), the official BioCLIP 2.5 Huge model resource (`imageomics/bioclip-2.5-vith14`) and the Ultralytics project documentation/repository. The paper reference does not establish the exact BioCLIP 2.5 weight revision. No CLIP-Adapter, ArcFace or SAM 3 citation was introduced as an implemented Wings training method.

The required personal-writing-style skill, voice evidence, scientific-writing guidance and anti-slop audit were read. British English was applied to prose. Publication titles in the bibliography were not globally converted to British spellings. Repeated feature lists, unsupported superiority comparisons and outdated model-development claims were removed.

## Validation performed

A local validation script passed 38 checks covering baseline byte identity, obsolete numbers, internal model labels, unsupported training counts, the four exact benchmark rows, paired/upload scope, geographic weighting, interpretation of scores, occurrence snapshot consistency, SDM and host claims, sequencing terminology, partial vector export, punctuation, British spelling, headings, tables and drafting markers. `git diff --check` passed. The complete manuscript diff was inspected before the rewrite commit.

Pandoc 3.1.11.1 rendered the revised Markdown to standalone HTML5 with no warnings. No dedicated manuscript-rendering GitHub Actions workflow was found in the inspected workflow directory. The local rendering command was:

```sh
pandoc paper/manuscript.md \
  --from=markdown --to=html5 --standalone --embed-resources \
  --css=qa/render.css \
  --metadata pagetitle='Ithomiini Maps manuscript: Phase 2 draft' \
  --metadata lang=en-GB -o qa/manuscript.html
```

The `qa` directory in that command is the local validation workspace, not a committed repository directory. A plain repository-only rendering can omit `--css=qa/render.css` and write to a temporary output file.

Chromium loaded the rendered HTML through Playwright. Both Markdown tables rendered as tables and the document contained 35 headings. Desktop and 650-pixel-wide viewport checks found no horizontal overflow. The opening, benchmark table and data-availability layout were visually inspected. The manuscript still contains figure instructions, not fabricated screenshots. This rendering check does not validate the Atlas R export or a PDF/DOCX submission layout.

No model was retrained, no out-of-fold evaluation was rerun, no SDM release was reconstructed, and no host-plant or occurrence table was recounted. The rendering and text checks must not be cited as validation of those scientific results.

## Phase 3 items

Five visible markers remain in the manuscript:

| Marker | Required completion |
| --- | --- |
| FIG1 | Final workflow figure showing the separate upload and paired-collection routes |
| S1 | Assemble and validate the supplementary photography-to-gallery protocol and authorised setup assets |
| FIG2 | Dated, authorised Gallery/Atlas interface panels matching the captions and component versions |
| DATA1 | Public code-release destinations and access terms, submission archive, runtime model receipt, release-matched manifests where available, and any reconciled host-layer citations |
| ACK1 | Author confirmation of funding, contributions, permits, acknowledgements and journal disclosures |

The exhaustive bibliography audit remains Phase 3. Verify publication details, years, journal styles and DOI links. Check the environmental predictor datasets and versions, including CHELSA, elevation and cloud cover, and add the appropriate primary citations. The camera settings and several SDM/occurrence-filter parameters were retained from the July Methods, not newly independently verified in Phase 2. Confirm those parameters against the release-matched configuration rather than presenting this rewrite as a fresh audit of them.

For stronger evaluation reproducibility, obtain the paired specimen/fold/seed and eligibility manifests, including the exact Top-1 species-context rule used for named subspecies, duplicate handling, out-of-vocabulary handling and model-selection separation. Do not infer the paired classifier's internal architecture from the upload classifier. The model's frozen encoder does not by itself guarantee that a tested image was absent from foundation-model pretraining.

Quantitative occurrence breakdowns, host totals, sequencing counts and aggregate SDM diagnostics may remain omitted. Restore them only from a coherent identified record population and its matched source files. A later live website total is not a replacement for one cell in the May table. For SDM diagnostics, enumerate the complete 145-species raster population, preserve missing metrics and join matching validation data before reporting aggregate statistics.

Run representative R exports with occurrence points, range polygons, SDMs, hosts and heatmaps before making stronger export claims. Inspect which elements are omitted, rasterised or supplied as independent data. Final figures must not place paired-collection accuracy next to an arbitrary upload in a way that implies the upload was evaluated.
