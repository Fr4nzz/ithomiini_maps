# Final manuscript evidence ledger — 21 September 2026

**Phase 1 handoff. No manuscript rewrite. This is a qualified evidence ledger, not a certificate that every requested verification was completed.**

Use this final version rather than earlier intermediate commits of the ledger. Those versions contained transcription and source-reconciliation errors. This version withdraws ambiguous quantities rather than choosing a plausible value.

## Source register, status rules and audit limitations

| Alias | Repository/resource | Inspected revision |
|---|---|---|
| IM | `Fr4nzz/ithomiini_maps` | `935cc42740aefbe70640eb15d79bf4f6c21e1089` |
| WG | `rapidspeciation/Shiny_Ikiam_Wings_Gallery` | `f5cb03f17f3ba639090b32fbedde6d6645ff847b` |
| IA | `Fr4nzz/insect-ai-thesis-ml` | `e80ac06a27329f7b01e10aecba1d0c1133251958` |
| HF-S | `https://huggingface.co/spaces/fr4nzzch/butterfly-id` | Inspected source/repository commit `3aa72a36c37ce8b383f8f5a5f9ec5763f52e5e42`; runtime-loaded files not attested |
| HF-M | `https://huggingface.co/fr4nzzch/butterfly-id-classifier` | Repository head displayed as `61c8fb5`; individual published weight-object identifiers below |

The three supplied GitHub branch heads matched the expected commits when checked. An IM/WG/IA path below always means its pinned revision above. The inspection date is 21 September 2026 unless stated otherwise; that is not necessarily the date of the source data, training run or deployment.

Status vocabulary:

- **VERIFIED—CODE:** the inspected implementation supports the statement; not necessarily exercised live.
- **VERIFIED—ARTIFACT:** supported by a generated artifact, release receipt or Git history. Published metadata is not represented as an independent row-level recount.
- **VERIFIED—PUBLISHED RESULT:** the current application/report states the value. Source tests asserting the same value are consistency checks, not re-execution of the experiment.
- **SUPERSEDED / DIFFERENT SCOPE:** inappropriate for the named current pipeline or population, although it may remain historically correct.
- **UNRESOLVED:** insufficient reliable inspected evidence to settle the claim.
- **AUTHOR CONFIRMATION:** requires a scientific interpretation, terminology decision or unavailable project record.

The intended hierarchy is executable code, artifacts and Git history; verified deployment artifacts; traceable analyses; archived user messages; assistant messages as leads only; old documentation; inference.

### What this audit did not establish

The audit did not deserialize all model checkpoints, reproduce training or evaluation, execute the Gallery test suite, attest a live Space container, enumerate and load all deployed rasters, or run the generated R export. Consequently it does not certify absence of data leakage, calibration, live-model identity or complete application correctness.

Repeated connector reads also returned inconsistent content/metadata for some ostensibly identical pinned paths. This is a **retrieval-integrity limitation**, not proof that immutable Git files changed or that every inconsistent number represents a real historical snapshot. Ambiguous counts are withheld below. A clean checkout of the pinned Git objects, byte hashes and local parsing is required to settle them. Do not turn a conflicting connector response into a scientific result.

## 1. Manuscript baseline and snapshot policy

**Source:** IM `paper/manuscript.md`; branch `manuscript/chat-archive-20260920`; commit `935cc42740aefbe70640eb15d79bf4f6c21e1089`. **Status: VERIFIED—ARTIFACT.**

This is already the recovered July 8 manuscript. Reconstructing that manuscript is not a pending task. The audit branch is `manuscript/fact-lock-20260921`; manuscript editing belongs to phase 2, not this ledger.

**Recommendation: retain the explicitly frozen 9 May 2026 occurrence snapshot with 104,297 records.** This value is supported by the manuscript's stated snapshot and `public/data/data_manifest.json`. Reconcile every dependent occurrence table and figure to that selected population.

Do not replace only the headline total with a number from `paper/statistics.json` or `paper/statistics_report.txt`. Those outputs include a different total, 103,093, and problematic country normalization. They cannot be assumed to summarize the selected 104,297-record population.

A newer snapshot is an alternative only if all dependent statistics are regenerated together: source contributions, unique/duplicate definitions, taxonomic counts, countries, sequencing categories and figures, with input hashes. That regeneration was not performed here.

The classifier, host-plant compilation and SDM products are separately versioned modules. Reporting a September classifier alongside a May occurrence snapshot is acceptable when dates and populations are explicit; silently presenting them as a single simultaneous dataset is not.

**Safe wording:** “Occurrence summaries refer to the 9 May 2026 snapshot. Classifier, host-plant and distribution-model results refer to separately identified releases.”

## 2. Wings taxonomic classifier

### Uploaded-photo architecture

**Primary sources:** HF-S `inference.py`; WG `src/utils/aiPredict.js` and `src/components/AIIdTab.vue`. **Status: VERIFIED—CODE, with the checkpoint and runtime limitations specified below.**

| Component | Finding | Scope limitation |
|---|---|---|
| Encoder | Frozen BioCLIP 2.5-H image encoder, loaded through `hf-hub:imageomics/bioclip-2.5-vitH14` | The complete system includes a supervised head; it is not zero-shot classification. |
| Single-image feature dimension | 1,024; loader obtains `feat_dim` from the checkpoint with a 1024 default | The actual checkpoint tensor shapes were not independently deserialized. |
| Residual adapter | No residual adapter in the inspected uploaded-image `CosineHead` path | Do not import the Insect AI residual module into Wings methods. |
| Layer normalization | LayerNorm before cosine classification | Confirmed in inference code. |
| L2 normalization | Normalizes post-LayerNorm features and classifier weights | Confirmed in inference code. |
| Classifier | Cosine dot products followed by finest-rank softmax | Direct leaf prediction, not a demonstrated cascade of separately trained rank heads. |
| Cosine scale | 30 | A logit scale is not evidence of a fitted calibration temperature. |
| Subcentres | Supports K subcentres and takes the maximum per class when K > 1; checkpoint K defaults to 1 | Actual stored K is UNRESOLVED. A loader default is not proof of the checkpoint value. |
| ArcFace/angular margin | No angular margin is applied by this inference path | Training-time loss/margin remains UNRESOLVED for the matching checkpoint. |
| Calibration | No additional fitted temperature is applied in the inspected path | Effective additional temperature is 1. Do not copy IA's T = 0.8. |
| Rank aggregation | Coarser candidates are constructed downstream from leaf scores | The API returns only the top 64 leaves, rounded to five decimal places; browser aggregation is truncated. |

The browser normalizes returned/reweighted scores and aggregates them at coarser ranks. A resulting display score is not necessarily a calibrated full-taxonomy posterior because omitted leaf mass is unavailable. A geographic prior cannot recover a candidate omitted from the API's returned set.

**Manuscript-safe architecture:** “For uploaded photographs, a frozen BioCLIP 2.5-H image encoder supplies features to a supervised head comprising layer normalization and an L2-normalized cosine classifier. The inspected implementation uses a cosine scale of 30 and no residual adapter. It predicts finest-rank labels directly, with coarser candidates obtained by downstream aggregation of returned leaf scores.”

Do not add exact K, ArcFace margin, optimizer, epochs or fitted temperature until the release-specific checkpoint and training configuration are inspected.

### Published model-object identity versus running deployment

HF-M `head_hier.pt` has the published LFS SHA-256:

`e461eb4eda24c919711d7497833916305259a712753323ff9431aad9b9e07d6f6`

The inspected object page associates this approximately 33 MB artifact with upload commit `d6f8cbb`. This is a published object identifier, not a checksum freshly calculated from downloaded bytes in this audit.

The Space's asset resolution checks local files before its configured model repository and does not explicitly pin the revision in the inspected fallback download. Therefore, Space source commit, model-repository head, bundled/local weights, environment overrides and actual loaded bytes are separate facts.

**UNRESOLVED:** a runtime receipt identifying the loaded encoder revision, head hash, segmenter hash, resolved local paths, Space commit and relevant environment settings. The code-and-artifact evidence is stronger than model-card prose alone, but does not attest the running container.

### Insect AI architecture is not transferable wholesale

**Sources:** IA `reports/eda_insect_ai_pipeline.html`, classifier-method passages; IA `docs/chat-transcripts/t3-code/update-full-frame-ecology-tab-2d8166ec.md`.

The IA report describes a custom residual adapter `1024 → 64 → 1024`, GELU, `x + 0.2 Δx`, followed by LayerNorm, L2 normalization and a cosine classifier, plus calibration at T = 0.8. These are IA report parameters, not verified Wings parameters. Its explanation of frozen features and supervised versus genuine image/text zero-shot prediction is useful conceptual context; its adapter, data sizes, calibration and benchmark values must not be copied into Wings methods.

**Resolved distinction:** the inspected uploaded-photo Wings head has LayerNorm plus cosine classification without a residual adapter. The paired collection head is a separate release and needs its own architectural verification.

## 3. Training data and coverage

**Sources:** WG `public/data/prediction_coverage_receipt.json`, `src/components/AIIdTab.vue`; HF-M label/head descriptions.

| Quantity | Supported current statement | Status |
|---|---|---|
| Finest-rank classes | 7,933 | VERIFIED—ARTIFACT in the collection coverage receipt; also reported for the model vocabulary. Full class-map enumeration not rerun. |
| Species | 4,478 | VERIFIED—PUBLISHED COVERAGE in the Gallery/model description, not a fresh accepted-name audit. |
| Named subspecies | 4,958 | VERIFIED—PUBLISHED COVERAGE; alias/abbreviation normalization not independently reproduced. |
| Genera | No approved count established | UNRESOLVED. |
| Broader corpus | Proposed 63,307 rows not confirmed | UNRESOLVED against a release-bound manifest. |
| Exact-label training population | Proposed 58,165 images not confirmed | UNRESOLVED against the matching eligibility/filter output. |
| Final training-run image count | Not established | Must distinguish dataset rows, files, unique content, specimens and samples actually consumed. |
| Source contributions | Not established for the final checkpoint | Requires source-labelled training manifest. |
| Rare-class treatment | Not established for the final checkpoint | Benchmark eligibility is not automatically the full training rule. |
| Contradictory labels / exclusions | No complete executed curation ledger tied to the checkpoint | Archive descriptions of fixes do not prove every contradiction was resolved before the release. |
| Adult/immature/background filtering | No executed release-bound receipt inspected | Do not assert comprehensive adult filtering. |

Species and named-subspecies counts are not disjoint additive categories: subspecies leaves share species parents. Labels in a model vocabulary are also not automatically taxonomically validated accepted names.

Historical model-card prose, training script names and archived training discussions are leads. None alone verifies that a particular training manifest or ArcFace script produced the currently loaded head.

**Safe interim wording:** “The released vocabulary is reported to contain 7,933 finest-rank classes spanning 4,478 species, with 4,958 named subspecies reported in the Gallery.” Before submission, enumerate the actual class map and bind all training counts and filters to the checkpoint hash.

## 4. Image preprocessing and segmentation

**Primary sources:** HF-S `inference.py`; HF-M `wing_seg.pt` object/history; WG descriptive text.

The uploaded-image path loads `wing_seg.pt` using `ultralytics.YOLO`, with an optional `WING_SEG_WEIGHTS` override. It uses detected regions to define padded rectangular RGB crops, rather than necessarily feeding pixel-masked images on a black background to the classifier. The inspected code includes a 6% crop margin, confidence threshold 0.05, maximum 32 detections and containment/overlap deduplication using intersection over minimum area 0.5. The combined target uses a union of selected boxes; no usable detections can lead to full-image fallback.

**Status: VERIFIED—CODE for this path, not a segmentation-quality evaluation.**

HF-M `wing_seg.pt` has published LFS SHA-256:

`012e95bb092d01936a8a0cd1897b4e073bf49447ea6f7cc36f97f7fef0c9f0eba`

Its approximately 23.4 MB object is associated with June 29 upload commit `45992a4`, labelled “Replace wing_seg.pt with corrected wings_v3 YOLO model.” This is evidence about that artifact's release history, not proof that subsequent Wings-v6/v7 development replaced the uploaded-image segmenter.

The Gallery describes a YOLO26s-seg model trained using SAM 3-generated wing masks. **VERIFIED—PUBLISHED DESCRIPTION only:** this audit did not close the provenance chain from the exact weight hash to model architecture, training configuration and teacher-mask receipt. Ultralytics loading is independently supported by code; exact family and SAM 3 training provenance remain unresolved for the actual loaded artifact.

**Safe wording until that chain is closed:** “An Ultralytics-based wing-localization model defines padded image regions for classification, with a full-image fallback when no usable region is available.” Add the exact family and SAM 3 procedure only after checking the matching training receipt. Internal v3/v6/v7 labels should be technical provenance, not unexplained names in the main manuscript.

## 5. Paired dorsal/ventral collection workflow

**Sources:** WG `public/data/prediction_coverage_receipt.json`, `tests/paired-release.test.mjs`, `scripts/validate-curation-data.mjs`, current collection prediction assets and About section.

The coverage receipt is dated **2026-09-14T15:39:58.647516+00:00**. It identifies model `candidate_d_pairdv_r1024_seed314159`, representation/head kind **CONCAT_DV**, **2,048-dimensional** input features and **7,933 classes**. The head identity recorded in the receipt is:

`34ecd53f64b3f9dc600710af5ca8df7cd94845653a9ce9f916dcd08adc520167`

The expanded prediction asset identity is:

`2f75987de896889ee8ed9c09a77a4c97551a5f1934708bf8f63424d8a073fe70`

These are receipt identifiers, not freshly calculated hashes. The paired head is distinct from uploaded `head_hier.pt`. Its exact residual components, normalization, loss, subcentre count and calibration cannot simply be inferred from the upload implementation.

| Receipt population | Count | Scope |
|---|---:|---|
| Verified dorsal/ventral benchmark pairs | 3,829 | Specimens, not individual photographs. |
| Paired-expanded payload | 3,849 | Includes 3,829 verified pairs plus 20 single-image fallbacks according to the receipt. |
| Live payload | 269 | Separate payload. |
| Live/expanded union before fill-in | 4,118 | Coverage, not an evaluation denominator. |
| Coverage fill-in specimens | 402 | Brings the union to 4,520. |
| Active specimen universe / final prediction union | 4,520 | Not the paired benchmark population. |
| Photographed CAMIDs | 4,388 | A separate photographic-coverage count. |
| Missing after merge | 0 | Receipt coverage assertion, not proof of prediction correctness. |
| Fill-in images | 799 | Five single-view fallbacks use duplicated-view feature handling. |

Single-view fallback vectors must not be called genuine observed dorsal/ventral pairs. Final-fit prediction coverage must not be represented as held-out accuracy. An output checksum identifies an artifact but does not prove its evaluation protocol.

### Fold leakage

Photographs of the same specimen must be grouped before fold assignment. Dorsal and ventral images cannot independently occupy train and test folds. The published collection evaluation is specimen-based, but this audit did not inspect the complete taxonomic fold table or all cross-source duplicate hashes. It therefore does not certify absence of pair leakage, corpus overlap or foundation-pretraining exposure. CAMID-grouped metadata for the sex workflow is not proof of correct grouping in the taxonomic workflow.

## 6. Geographic re-ranking

**Primary sources:** WG `src/utils/geoPrior.js`, `src/utils/aiPredict.js`, `src/components/AIIdTab.vue` and the checklist loaded by the application. **Status: VERIFIED—CODE.**

Geography is a **post-classification re-ranking step**, not part of BioCLIP's encoder or pretraining. Candidate lookup attempts the exact taxon and then a binomial fallback. Missing checklist entries receive weight 1 rather than being excluded.

The inspected weight helper behaves as follows:

- No checklist entry: weight 1.
- Country supplied and not `Any`, but no positive support for that country: weight 0.02.
- East/West side supplied, but no positive support for that side: weight 0.02.
- Otherwise: weight 1.

Country and side failures do not compound into 0.0004 because the helper returns at a failing check. With neither country nor side supplied, weighting is the identity. A side supplied without country can still activate the helper's side check. The intended side interpretation is Ecuador's Andes, but the helper itself does not enforce country equals Ecuador; complete caller/UI gating was not interaction-tested.

The code also supports geographic inference from the photographic candidate distribution. Such guessed context is not independent location metadata and must not be treated as the same condition as a verified locality or a no-prior baseline.

Candidate probabilities are multiplied, renormalized and aggregated. Missing occurrence support is not proof of biological absence. Returned-candidate truncation limits what re-ranking can recover.

| Rank | Published change in held-out Top-1 |
|---|---:|
| Species | +0.21 percentage points |
| Named subspecies | +0.74 percentage points |
| Genus | −0.16 percentage points |

**Status of changes: VERIFIED—PUBLISHED RESULT**, not a rerun of the with/without-prior comparison. The effect is modest and rank-dependent; do not claim uniform improvement or confuse percentage points with relative percentages.

**Safe wording:** “Optional geographic information reweights taxonomic candidate scores after classification. The reported collection evaluation showed small gains at species and named-subspecies ranks and a small decrease at genus rank.”

## 7. Taxonomic evaluation

**Sources:** WG `src/components/AIIdTab.vue`, `tests/aboutTool.test.mjs`, `tests/paired-release.test.mjs` and release receipts. **Status: VERIFIED—PUBLISHED RESULT. Tests were inspected, not executed, and raw out-of-fold predictions were not reanalysed.**

### Current published paired collection result

| Rank | Eligible specimens | Top-1 | Top-5 |
|---|---:|---:|---:|
| Named subspecies | 2,613 | 87.93% | 97.33% |
| Species | 3,355 | 91.33% | 97.91% |
| Genus | 3,806 | 95.55% | 99.26% |
| Family | 3,824 | 99.32% | 99.90% |

The published population is **3,829 verified paired dorsal/ventral Sanger specimens**, with **three seeds and five held-out folds**. The current default description includes **exact-Top-1 species context and the current geographic prior**. Keep that condition attached to the result rather than treating every reported rank as an unconditional independent classification experiment.

Denominators are rank-specific: an eligible specimen needs usable reference truth at that rank. A species identification does not automatically supply a named-subspecies reference. The named-subspecies context/filtering rules must also be preserved. The current description counts eligible out-of-vocabulary truths as misses rather than silently removing them. A per-CAMID eligibility and fold manifest is needed to reproduce those rules precisely.

These are **collection-workflow** results on curated paired photographs. They do not establish accuracy for arbitrary uploads, ecological field images, segmentation or unseen species.

### Uploaded-photo AI Identifier evaluation

No independently inspectable, release-matched single-photo benchmark was established here. Historical model-card results are not approved substitutes without matching encoder, head, preprocessing and cohort identifiers. Neither the paired benchmark nor Insect AI's benchmark can fill that gap.

**Safe wording:** “In the reported held-out evaluation of paired Sanger collection photographs, species Top-1 accuracy was 91.33% among 3,355 eligible specimens. This evaluation does not estimate accuracy for unrestricted user-uploaded photographs.”

## 8. Sex prediction

**Sources:** WG `public/data/sex_predictions.json`, `docs/sex-predictions-20260909.md`, `src/components/AIIdTab.vue`; HF-S optional sex-head path.

| Claim | Supported published scope |
|---|---|
| Collection specimens with predictions | 1,586 |
| Formal benchmark specimens | 1,220 |
| Species in formal benchmark | 57 |
| Reported accuracy | Approximately 89.7% |
| Evaluation grouping | Specimen/CAMID-grouped folds; reported three-seed, five-fold workflow |
| Representations | Separate frozen BioCLIP representations of ventral forewings and dorsal hindwings |
| Output support | Taxon-specific Supported/Uncertain criteria |
| Ordinary Gallery uploads | Do not expose the validated collection sex workflow |

**Status: VERIFIED—PUBLISHED RESULT / workflow description**, not an independent reconstruction of the evaluation.

The 1,586 prediction population is not the 1,220 benchmark population. Additional predictions must not be represented as independent held-out observations. Damaged-specimen inclusion/exclusion and the exact primary accuracy denominator need reconciliation with the full evaluation artifact before giving more decimal places, confidence intervals or a different denominator.

Global Supported/Uncertain counts are **UNRESOLVED** in this audit. Intermediate/top-up counts and About summaries were not reliably reconciled against an enumeration of the entire asset; do not copy support totals from earlier ledger commits.

The optional image-only sex head in the Space is not the validated collection workflow. Its unsupported output does not justify a claim of sex prediction for arbitrary Gallery uploads. Conversely, saying no sex-related code exists anywhere in the Space would be false.

**Safe wording:** “A separate sex-prediction workflow is provided for supported Sanger collection taxa. Its reported specimen-grouped evaluation achieved approximately 89.7% accuracy across 1,220 benchmark specimens from 57 species. This does not validate sex prediction for arbitrary uploads or all taxa covered by the taxonomic classifier.”

## 9. Wings Atlas occurrence data

**Sources:** IM `public/data/data_manifest.json`, `paper/statistics.json`, `paper/statistics_report.txt`, `paper/manuscript.md`.

**Approved snapshot recommendation:** retain **104,297 occurrence records on 9 May 2026**. The manifest timestamp inspected was `2026-05-09T17:38:04.759685+00:00`. The butterfly GBIF download DOI recorded in the manifest is **10.15468/dl.6zagkz**.

The statistics report inspected describes **103,093 records**, not the selected 104,297 population. Its country entries mix full names and codes, including multiple forms of Ecuador, Brazil and Peru, with an additional questionable geographic entry. Its nominal country-entry count must not be called a normalized country count.

**UNRESOLVED:** an approved source-contribution breakdown, deduplication accounting, species/subspecies/genera totals, coordinate coverage and country summary for the exact selected occurrence bytes. Repeated retrievals produced incompatible summaries for some pinned paths, so this final ledger deliberately withdraws the detailed contribution tables in its earlier versions. Do not select one conflicting response as the authoritative table without a clean local parse.

Raw source sizes, combined-source contributions, unique contents and sampling events are different units. In particular, a Sanger input-table size need not equal its contribution after merging/deduplication. All final figures should use an explicit record-level input hash and the selected counting rule.

## 10. Sequencing-status definitions

**Primary source:** IM `scripts/process_data.py`, function `determine_sequencing_status`. **Status: VERIFIED—CODE; scientific interpretation and final counts unresolved.**

| Application label | Implemented proxy | Manuscript-safe interpretation |
|---|---|---|
| `Sequenced` | Qualifying nonempty ToLID after placeholder exclusions | ToLID assigned; the function does not independently check sequencing completion. |
| `Tissue at Sanger` | Without a qualifying ToLID, rack field passes the implemented checks | Rack-based submission proxy; confirm physical receipt in the source system. |
| `Tissue Available` | No preceding state, but first tissue field is present and not an excluded placeholder | Tissue recorded in project fields. |
| `Preserved Specimen` | No preceding check passes | Residual application category, not independent proof of preservation/availability. |

A comment equating ToLID with sequencing completion is not independent completion evidence. The code checks no sequencing-run accession, assembly accession or completed-sequencing flag in this function.

`Registered for Sequencing` is not returned by this function. Its upstream/GoaT and aggregation path was not fully traced. Do not invent its relationship to the other states.

**AUTHOR CONFIRMATION:** either use ToLID-assigned/recorded-pipeline terminology or supply actual sequencing-completion evidence. **UNRESOLVED:** current counts and whether each count represents specimens, species, taxonomic statuses or records. Old report counts are not approved for the selected snapshot.

**Safe wording:** “Sequencing-related layers describe recorded project pipeline status; assignment of a ToLID is not treated here as independent evidence of completed sequencing.”

## 11. Host plants

**Relevant sources:** IM `public/data/host_plants/host_plant_associations.json`, `host_plant_layers_manifest.json`, `host_taxa.json`, occurrence-layer files; IM `public/data/data_manifest.json`; build inputs and scripts under `scripts/host_plants/`.

**Overall status: UNRESOLVED for a single current quantitative state.** Repeated reads of these pinned paths produced incompatible metadata and counts. This audit cannot distinguish every genuine historical build from a retrieval inconsistency without a clean local checkout. Earlier ledger totals for associations, host taxa, support categories and mapped occurrences are therefore withdrawn; do not cite them as established manuscript facts.

A layer-manifest read identified a June 13, 2026 build, a focused literature-review seed, explicit confidence rules, and this scientific caveat: host-plant occurrence overlays are contextual, not SDM predictors or proof of local host use. The seed's record count is not automatically the exported association count. Source-extraction counts also do not establish independent review of every extracted association.

The top-level manifest inspected separately reports **71 host taxa, 1,341,868 plant occurrences and 113 butterfly species**, with plant GBIF DOI **10.15468/dl.c7gyd2**. These are **provisional top-level metadata values**, not a reconciled row-level audit of the latest host layers. A later layer manifest reports no DOI in its own DOI field; that is not proof the top-level DOI is wrong, but the chain between download and exported build remains unverified.

Do not automatically call the aggregate plant-occurrence total a GBIF-only count: alternative-source rows may be present. Do not equate species-resolution association rows with distinct plant species, association support with confidence, or mapped-row counts with mapped unique taxa.

The following required quantities remain unapproved until locally recomputed:

| Requested quantity | Required verification |
|---|---|
| Total associations | Count retained/deduplicated association rows under a documented inclusion rule. |
| Butterfly taxa | Normalize names and distinguish species, subspecies, genus-level entries and non-target taxa. |
| Host taxa | Normalize accepted names and synonym/indeterminate-name handling. |
| Species/genus/family resolution | Count association rows and unique taxa separately. |
| Support categories | Parse source-backed, curated, unreviewed/tentative fields without substituting confidence labels. |
| Confidence categories | Count actual retained high/medium/low values under the executed policy. |
| Mapped host taxa | Join accepted taxa to nonempty exported layers and confirm UI filtering. |
| Plant occurrences | Separate raw download, filtered/deduplicated exported occurrences and alternate-source additions. |
| GBIF DOI | Match the download receipt to the precise GBIF component used in that layer build. |

**Safe non-quantitative wording:** “The host-plant module links butterfly–plant associations to optional plant-occurrence overlays, with separate evidence-support and confidence annotations. These overlays do not demonstrate local host use and are not SDM predictors.” Quantitative host claims should wait for the missing reconciliation.

## 12. Species distribution models

### The 155 versus 145 discrepancy

**Primary sources:** IM Git history for `public/data/sdm/species/`; release commit `1cdde9bc8d5f4375def888b5796e71493ee60d68`, dated **28 April 2026, 12:16:03 UTC**; `public/data/sdm/sdm_metadata.json`; `sdm/05_export_predictions.py` and associated scripts.

The April 28 release records **145 species** and removal of **ten orphan ensembles without matching accessible-area products**. This supplies an explanation for a legacy 155-model metadata/manuscript state coexisting with a 145-species complete raster release.

The released product types are full projection, accessible-area core and extension. A reported directory inventory of **435 TIFF files** is consistent with 145 three-product sets, not 435 separately modelled species. This audit did not execute a fresh complete stem-grouping check and all live HTTP requests.

**Recommended manuscript count:** **145 species with complete released raster products**. **Status: VERIFIED—RELEASE HISTORY; live served count not fully independently tested.** A stale metadata-driven picker may still advertise species lacking complete products; the actual picker/error behavior needs a focused deployed-application check.

Removal from a product release is not proof that all removed historical fits were scientifically invalid. It records missing corresponding products at release time.

### Validation summaries are not repaired by changing the count

**UNRESOLVED:** correct high/medium/low confidence counts, AUC summary, continuous Boyce summary and metric-specific valid n for exactly the 145 released species. Earlier ledger copies of historical summary values are not approved for this release.

Changing a headline denominator from 155 to 145 does not update confidence categories or mean AUC/Boyce. Exported display metrics can also differ from raw validation values through algorithm selection, rounding and missing-value handling. A missing/sentinel value must not be silently treated as a measured zero.

Required computation: enumerate complete raster stems; join them to the matching raw fit/validation table; verify confidence rules; preserve missingness; report metric-specific n and unrounded summaries; save input/output hashes. That computation was not performed here.

**Safe wording now:** “The checked SDM release provides full, accessible-area and extension products for 145 species.” Withhold aggregate performance summaries until recomputed for that exact population.

## 13. R/vector export

**Primary sources:** IM `src/utils/rExport.js`, `src/utils/rExport/rScriptGenerator.js`. **Status: VERIFIED—CODE for inspected export structure; no complete export/render execution.**

The export supplies filtered butterfly-point data, view/legend configuration, an R plotting script and supporting files. Range polygons are supplied as data when applicable; captured basemap imagery is raster. The filtered point set is not necessarily restricted to the current visible viewport.

| Layer/element | Supported export interpretation |
|---|---|
| Butterfly occurrence points | Data export; can remain vector in suitable R output. |
| Range polygons | Polygon-data export where applicable; can remain vector. |
| Basemap | Raster imagery, even inside SVG/PDF. |
| SDM layers | No independent SDM data export established in the inspected path. |
| Host-plant layers | No independent host-layer data export established in that path. |
| Heatmaps | No independent vector heatmap export established. |
| Other visible overlays | May be baked into a captured image rather than preserved as editable data layers. |

The capture path hides selected butterfly layers while obtaining background imagery. Other visible overlays may remain baked into that image. The generated R setup can instead request a fresh tile basemap, so screenshot-only overlays are not guaranteed to survive that alternative path. Pixel-identical reproduction of every interactive layer is not established.

The browser uses `fflate`. Inspected R setup includes spatial/plotting/tile/image dependencies such as `sf`, `ggplot2`, `dplyr`, `tidyr`, `jsonlite`, `maptiles`, `tidyterra`, `ggspatial`, `grid`, `png` and `stringr`. Network access, package versions and system libraries remain relevant. This is not verified as fully offline or dependency-free.

PDF/SVG containers can hold both vectors and raster images. Device-level behavior, font portability, transparency and successful generation were not tested here. **Do not describe the feature as fully vector export of every map layer.**

**Safe wording:** “The export supplies occurrence and range data with an R plotting script. Points and polygons can remain vector in suitable output formats, whereas basemaps and image-based overlays remain raster. Not all interactive layers are exported as independent editable data.”

## 14. Figures and interface state

**Sources:** IM manuscript and archived figure-review discussions; WG current component/tests. **Status: source-state review, not completed visual QA.**

No new figures/screenshots were produced or validated in this phase. Archived proposals are not proof that figures were implemented, checked against current data or deployed. Missing figure work is not a reason to reconstruct the recovered July manuscript.

The principal figure distinction is between uploaded-photo inference and the paired collection evaluation. Do not place the 91.33% paired-species result beside an arbitrary uploaded image in a way that implies the latter was the evaluated population. Sex panels require their narrower taxonomic/specimen scope.

Every quantitative caption should identify its module snapshot and denominator. Occurrence country/source charts, sequencing funnels, host-count diagrams and SDM confidence bars require reconciled inputs. Private working repositories, public mirrors and live sites are separate resources and need separate link/version checks.

## 15. References needing verification

A complete bibliographic and DOI audit was not performed. Primary-source verification remains necessary; archived assistant warnings are leads, not proof of current omissions.

| Topic | Required check |
|---|---|
| BioCLIP 2.5-H | Appropriate primary publication and exact model release; a paper citation alone does not identify weights. |
| Supervised versus zero-shot | The Wings head is supervised even though the encoder is frozen. |
| Ultralytics / YOLO26s-seg | Match the actual checkpoint architecture and software version before asserting the specific family. |
| SAM 3 | Verify teacher-mask provenance for the exact segmenter, then cite the corresponding method. |
| CLIP-Adapter | Context for IA's residual adapter, not evidence that Wings upload inference includes it. |
| ArcFace / subcentres | Include as training methods only if a release-matched configuration verifies their use. |
| Butterfly GBIF | DOI `10.15468/dl.6zagkz`, with correct download and integrated-snapshot scope. |
| Plant GBIF | DOI `10.15468/dl.c7gyd2`, matched to the actual exported build; exclude attribution of alternate-source records to that DOI. |
| SDM methods | Match algorithms, accessible-area rules, cross-validation and Boyce definition to the exact release and metric population. |
| Host-plant literature | Distinguish extraction, catalogue support and independently checked primary evidence. |
| Bibliography and author details | Recheck all cited works, spellings, dates, institutional acknowledgments and URLs against the recovered manuscript and primary sources. |

## 16. Unresolved evidence and author-confirmation items

| Priority item | Evidence/action needed |
|---|---|
| Retrieval integrity | Obtain a clean local checkout of pinned revisions, calculate hashes, parse artifacts locally and resolve conflicting connector payloads. |
| Uploaded versus paired checkpoint methods | Inspect trusted checkpoint tensors/configuration separately for dimension, K, normalization, residual components, training margin and calibration. |
| Live deployment identity | Runtime receipt linking Space source, encoder, resolved paths, overrides and actual loaded byte hashes. |
| Training data | Release-bound manifest confirming or rejecting 58,165/63,307 hypotheses, source contributions, eligibility, duplicates, contradictions, rare classes and adult filtering. |
| Exact coverage taxonomy | Enumerate the released labels, normalize names and separate aliases/abbreviations from accepted species/subspecies/genus counts. |
| Paired taxonomic evaluation | CAMID/fold/seed/eligibility manifests, duplicate audit and raw rank-specific out-of-fold predictions. |
| Upload evaluation | Exact single-photo pipeline benchmark, or omit an upload-accuracy claim. |
| Segmentation provenance | Matching weight/config/teacher-mask receipts; no inference from later v6/v7 development alone. |
| Geographic comparison | Raw same-cohort before/after results; verify country/side UI gating and inferred-location mode. |
| Sex evaluation | Reconcile primary cohort and damaged specimens, enumerate global support totals, and bind feature/head receipts. |
| Occurrence statistics | Regenerate every dependent statistic from the selected 104,297-record bytes or deliberately replace the whole snapshot. |
| Host-plant state | Reconcile association table, taxonomy ledger, layer manifest, source downloads and live filtering through the build scripts. |
| Sequencing | Trace registration/GoaT aggregation, identify units, and decide terminology for ToLID assignment versus completed sequencing. |
| SDM | Enumerate/live-test released products; recompute confidence/AUC/Boyce for the exact 145-species population. |
| Export | Run representative R/SVG/PDF exports with SDM, hosts and heatmap toggled; inspect omitted or baked-in layers. |
| Submission assets | Update figures, references and acknowledgments against reconciled module versions. |

### Context inspected and remaining archive work

The archive README/index were used for orientation. Targeted passages were consulted in the requested Ithomiini search, summarization and manuscript-review transcripts and the Wings reconciliation, overnight-work and `update-wings-classifier-context-195a1f49.md` transcripts. IA classifier-method report passages and its requested ecology transcript were consulted. These archives were not all read exhaustively.

Remaining targeted context includes `docs/chat-transcripts/t3-code-wings/update-wings-classifier-context-1afb5240.md`, `docs/chat-transcripts/t3-code-wings/audit-subspecies-image-datasets-5d7e3dd7.md` and, where needed, the longer manuscript transcript. The separately located `Fr4nzz/WingsClassificator` repository is another provenance lead; its historical state must not automatically be treated as the September release.

### Rule for phase 2

Use verified code/artifact facts only with their scope qualifications. Attribute published benchmark numbers to the paired collection or sex workflow actually evaluated. Resolve remaining blocking items or omit their unsupported details. Do not combine the uploaded taxonomic head, paired head, collection sex workflow, IA residual model, occurrence snapshot, host-plant compilation and SDM release into one supposedly uniform model/data state.
