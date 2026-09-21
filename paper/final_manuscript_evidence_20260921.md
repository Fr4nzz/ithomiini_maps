# Final manuscript evidence ledger — 21 September 2026

**Phase 1 factual handoff, not a revised manuscript. Read the status and scope qualifications with every number.**

This ledger separates executable-source facts, generated-artifact metadata, published evaluation results, and unresolved provenance. It does not certify that all requested checks were completed. In particular, this audit did not deserialize the model checkpoints, rerun model evaluation, execute the Gallery tests, attest the files loaded by a running Hugging Face container, or recompute SDM performance for the final raster population. Those limitations are material, not merely editorial.

This corrected version supersedes the initial ledger commit. Use the latest audit-branch version; the initial version contained transcription and snapshot errors identified during source validation. No changes to `paper/manuscript.md` are intended or required by this audit.

## Evidence conventions and source register

| Alias | Repository | Pinned source revision |
|---|---|---|
| IM | `Fr4nzz/ithomiini_maps` | `935cc42740aefbe70640eb15d79bf4f6c21e1089` |
| WG | `rapidspeciation/Shiny_Ikiam_Wings_Gallery` | `f5cb03f17f3ba639090b32fbedde6d6645ff847b` |
| IA | `Fr4nzz/insect-ai-thesis-ml` | `e80ac06a27329f7b01e10aecba1d0c1133251958` |
| HF-S | `https://huggingface.co/spaces/fr4nzzch/butterfly-id` | Source inspected on 21 September 2026; repository commit `3aa72a36c37ce8b383f8f5a5f9ec5763f52e5e42` |
| HF-M | `https://huggingface.co/fr4nzzch/butterfly-id-classifier` | Repository head displayed as `61c8fb5`; individual weight objects identified below by their published LFS SHA-256 |

The three supplied GitHub branch heads matched their expected commits when checked. Every IM, WG or IA path below refers to the corresponding pinned revision, not a floating branch. Unless a different date is specified, 21 September 2026 is the inspection date, not a training date or dataset snapshot date. Repository files can themselves describe different, older snapshots.

For GitHub sources, immutable links can be formed as `https://github.com/<repository>/blob/<revision>/<path>`. For Hugging Face, distinguish the Space source revision, model repository revision, published weight-object hash and actual runtime-loaded bytes. These are not interchangeable.

Status vocabulary:

- **VERIFIED—CODE:** supported by inspected implementation; not necessarily exercised live.
- **VERIFIED—ARTIFACT:** supported by a generated file, receipt or Git history. Metadata values are not represented as a fresh row-level recount.
- **VERIFIED—PUBLISHED RESULT:** present in the current application/report; not independently regenerated here. A source test asserting the same value is a consistency check, not a rerun of the underlying experiment.
- **SUPERSEDED / DIFFERENT SCOPE:** not appropriate for the specified current population or pipeline; it may remain valid historically.
- **UNRESOLVED:** insufficient inspected evidence to settle the claim.
- **AUTHOR CONFIRMATION:** requires a scientific interpretation, terminology decision or unavailable project record.

Use executable code, artifacts and Git history before reports, archived user messages, assistant responses, old documentation or inference. Assistant archive responses were used as search leads, not evidence that training, validation or deployment actually happened.

## 1. Manuscript baseline and snapshot policy

**Source:** IM `paper/manuscript.md`; baseline branch `manuscript/chat-archive-20260920`; revision in the register above. **Status: VERIFIED—ARTIFACT.**

The baseline is the recovered July 8 manuscript. Reconstructing the July version is not a pending prerequisite. The audit branch is `manuscript/fact-lock-20260921`; `main` and the manuscript source are not editing targets in this phase.

**Recommendation: retain the frozen 9 May 2026 occurrence snapshot with 104,297 records.** Reconcile or regenerate every occurrence-derived statistic against that snapshot before writing final results. Do not substitute isolated values from `paper/statistics.json` or `paper/statistics_report.txt`: the latter describes a different state, including a different total and mixed country names/codes.

A newer occurrence snapshot would be defensible only with a complete regeneration of dependent totals, source contributions, taxonomic summaries, country normalization, sequencing-status summaries and figures, accompanied by input hashes. That regeneration was not performed here.

Classifier, host-plant and SDM releases must be separately dated. A September classifier does not turn an April host-plant file or May occurrence table into a September dataset. In particular, the host-plant files are not internally a single synchronized snapshot; section 11 records the conflicting scopes.

**Manuscript-safe wording:** “Occurrence summaries refer to the 9 May 2026 snapshot. Classifier and collection-prediction results refer to separately identified September releases.” Host-plant and SDM dates should likewise be explicit where their quantities are given.

## 2. Wings taxonomic classifier

### Uploaded photographs: verified inference architecture

**Primary sources:** HF-S `inference.py`; WG `src/utils/aiPredict.js`, `src/components/AIIdTab.vue`. **Status: VERIFIED—CODE, with checkpoint/runtime limitations below.**

| Component | Finding | Scope limitation |
|---|---|---|
| Encoder | Frozen BioCLIP 2.5-H image encoder, loaded using `hf-hub:imageomics/bioclip-2.5-vitH14` | The complete system has a supervised head and is not zero-shot inference. |
| Image representation | 1,024-dimensional single-image features; the checkpoint loader reads `feat_dim`, defaulting to 1024 | Backbone dimensionality is supported by code and current Gallery description; the checkpoint tensor shapes were not independently deserialized. |
| Residual adapter | No residual adapter in the inspected uploaded-image `CosineHead` path | Do not import the Insect AI adapter into Wings methods. |
| LayerNorm | Applied before cosine classification | Confirmed in the head implementation. |
| L2 normalization | Normalizes the features after LayerNorm and normalizes classifier weights | Encoder outputs are also normalized in the inference path. |
| Classification | Cosine dot products followed by a finest-rank softmax | Direct leaf prediction, not a demonstrated cascade of independently trained rank classifiers. |
| Cosine scale | 30 in the inspected implementation | Not a fitted calibration temperature. |
| Subcentres | Code supports K subcentres, takes the per-class maximum, and reads K from checkpoint with default 1 | Actual released K remains unconfirmed without checkpoint inspection; a default is not proof of the stored value. |
| ArcFace/angular margin | No margin applied during inference | Training-time margin remains unverified for the matching release. Old scripts/model-card prose do not close this gap. |
| Calibration | No additional fitted temperature is applied in this inference path | Effective additional temperature is 1; do not copy IA's T = 0.8. |
| Hierarchical aggregation | Coarser taxonomic candidates are constructed downstream from leaf scores | The API returns only the top 64 leaf probabilities, rounded to five decimals. Browser aggregation is therefore truncated, not necessarily a full-taxonomy posterior. |

**Safe wording:** “For uploaded photographs, a frozen BioCLIP 2.5-H image encoder supplies features to a supervised head comprising layer normalization and an L2-normalized cosine classifier. The inspected inference implementation uses a cosine scale of 30 and no residual adapter. It predicts finest-rank labels directly, with coarser candidates obtained by downstream aggregation of returned leaf scores.”

Do not add exact K, ArcFace margin, optimizer, epochs or calibration fitting to the final methods until the release-specific checkpoint and training configuration are inspected.

### Weight identity and deployment boundary

HF-M `head_hier.pt` has published LFS SHA-256:

`e461eb4eda24c919711d7497833916305259a712753323ff9431aad9b9e07d6f6`

The inspected object page reports an approximately 33 MB file, associated with upload commit `d6f8cbb`. This is the repository's published object identity, not a fresh local checksum or proof that a particular running container loaded those bytes.

The Space checks local assets first, then can download from its configured weights repository without an explicit revision pin in the fallback call. Environment overrides and bundled files can therefore matter. **UNRESOLVED:** a runtime receipt tying together Space revision, encoder revision, resolved model paths, actual weight hashes and environment settings. The code-and-artifact audit is stronger than a model-card-only description, but is not runtime attestation.

### Insect AI is a related but different classifier

**Sources:** IA `reports/eda_insect_ai_pipeline.html`, classifier-method passages; IA `docs/chat-transcripts/t3-code/update-full-frame-ecology-tab-2d8166ec.md`.

The IA report describes a custom residual adapter `1024 → 64 → 1024`, GELU, `x + 0.2 Δx`, LayerNorm, L2 normalization, a cosine classifier and separate calibration at T = 0.8. Those are IA report parameters, not verified Wings parameters. Its discussion of zero-shot image/text matching versus a supervised taxonomic head is conceptually useful, but its class counts, training data, crop protocol, calibration and benchmarks must not be copied into Wings methods.

**Resolved distinction:** the inspected Wings uploaded-image head has LayerNorm plus cosine classification without a residual adapter. The paired collection head is a separate release and needs its own architectural verification.

## 3. Training data and label coverage

**Sources:** WG `public/data/prediction_coverage_receipt.json`, `src/components/AIIdTab.vue`; HF-M class/head descriptions. The receipt and application are authoritative for their stated release metadata, not substitutes for training manifests.

| Quantity | Supported value | Status and limitation |
|---|---:|---|
| Finest-rank classes | 7,933 | VERIFIED—ARTIFACT: explicitly in the current paired coverage receipt; also reported by HF-M. Complete class-map enumeration was not rerun. |
| Species represented | 4,478 | VERIFIED—PUBLISHED COVERAGE in the current Gallery and model description; not a fresh accepted-name/alias audit. |
| Named subspecies | 4,958 | VERIFIED—PUBLISHED COVERAGE in the current Gallery; independent class-map normalization remains open. |
| Genera | Not established | UNRESOLVED. |
| Broader corpus rows | Proposed 63,307 not confirmed | UNRESOLVED against a checkpoint-bound manifest. |
| Exact-label training images | Proposed 58,165 not confirmed | UNRESOLVED against the matching eligibility/filter output. |
| Final training-run image count | Not established | Do not equate a vocabulary count, embedding-cache size and final supervised sample count. |
| Major sources and source contributions | Not established for the final checkpoint | Requires source-labelled training manifest. |
| Rare-class treatment | Final policy not established | The collection benchmark's supported-class criterion is not automatically the full training eligibility rule. |
| Exclusions, contradictions, aliases | No complete release-bound exclusion ledger inspected | Curation discussions do not prove all duplicate contradictions were resolved before the released run. |
| Adult/immature/background filtering | No executed filter receipt tied to the checkpoint inspected | Do not assert comprehensive adult filtering. |

Species and named-subspecies counts are not additive disjoint categories. Multiple subspecies leaves can share a species parent. Model labels must also be distinguished from independently validated accepted biological taxa.

HF-M model-card training descriptions and archived discussions describe changing corpora and model versions. They are not sufficient to confirm the proposed 58,165/63,307 figures for the actual uploaded checkpoint. A historical ArcFace-named training script likewise does not prove that it trained the inspected release.

**Safe interim wording:** “The released classifier vocabulary is reported to comprise 7,933 finest-rank classes spanning 4,478 species, with 4,958 named subspecies reported in the Gallery.” Before submission, reconcile these numbers by enumerating the exact class map and identify the training manifest by hash. Omit unsupported image-count and filtering claims until that is done.

## 4. Image preprocessing and segmentation

**Primary sources:** HF-S `inference.py`; HF-M `wing_seg.pt` object and upload history; WG descriptive text. **Status: VERIFIED—CODE / ARTIFACT for loading and crop logic; provenance partly unresolved.**

The uploaded-image inference path loads `wing_seg.pt` through `ultralytics.YOLO`, with an optional `WING_SEG_WEIGHTS` override. The inspected code uses detection/segmentation boxes to define padded RGB crops, rather than necessarily passing a pixel mask on a black background to the classifier. It includes a 6% rectangular margin, confidence threshold 0.05, maximum 32 detections and containment/overlap deduplication using intersection over minimum area 0.5. The combined target uses the union of selected boxes. Missing usable detections can lead to full-image fallback.

HF-M `wing_seg.pt` has published LFS SHA-256:

`012e95bb092d01936a8a0cd1897b4e073bf49447ea6f7cc36f97f7fef0c9f0eba`

The approximately 23.4 MB object is associated with June 29 upload commit `45992a4`, labelled “Replace wing_seg.pt with corrected wings_v3 YOLO model.” That release history is evidence about this artifact. It is not proof that later Wings-v6/v7 experiments replaced the uploaded-image segmenter.

The current Gallery describes YOLO26s-seg trained on wing masks generated with SAM 3. **VERIFIED—PUBLISHED DESCRIPTION only:** this audit did not close the chain from the exact `wing_seg.pt` hash to a training configuration and SAM 3 teacher-mask receipt. The framework is independently confirmed by loading code; the exact checkpoint architecture and teacher provenance remain unresolved.

**Safe wording supported without that missing receipt:** “An Ultralytics-based wing-localization model defines padded image regions for classification, with a full-image fallback when no usable region is available.” Add YOLO26s-seg and SAM 3 training details once the matching checkpoint/config/mask receipt is verified. Internal v3/v6/v7 labels belong in technical provenance, not unexplained publication-level names.

## 5. Paired dorsal/ventral collection workflow

**Primary sources:** WG `public/data/prediction_coverage_receipt.json`, `tests/paired-release.test.mjs`, `scripts/validate-curation-data.mjs`, current prediction assets and About section.

The current coverage receipt, generated **2026-09-14T15:39:58.647516+00:00**, identifies a **CONCAT_DV** head with **2,048-dimensional** features and **7,933 classes**. Its recorded head SHA-256 is:

`9cdcd7209c0a831b1043468998501841d8e469681f6f577a8060c3651e91afe93e`

This differs from the uploaded `head_hier.pt` identity. Do not describe the 2,048-dimensional paired head as if every verified architectural detail of the 1,024-dimensional upload head necessarily applies. Its exact normalization, residual components, loss, subcentres and calibration still require its own checkpoint/config inspection.

The receipt records the following distinct populations:

| Receipt field / population | Count |
|---|---:|
| Paired-expanded prediction payload | 3,849 |
| Updated live rerun payload | 269 |
| Union before coverage fill-in | 4,118 |
| Missing before fill-in / fill-in specimens | 402 |
| Model-visible active specimens | 4,520 |
| Model-visible photographic CAMIDs | 4,388 |
| Missing after fill-in | 0 |
| Fill-in input rows | 799 |
| Unpaired-vector rows in fill-in | 5 |

These are payload/coverage quantities, not accuracy denominators. The reported benchmark comprises **3,829 verified paired specimens**, not all 3,849 expanded predictions or all 4,520 active specimens. The 20-record difference between expanded payload size and verified benchmark pairs requires an explicit record-level scope join before naming its composition.

The fill-in receipt identifies `predictions_sanger_head_hier.npz` with SHA-256 `c632de90d36cfa597f5d6a4cfe26607fca04f8799866a1277e43d42095a89d420ba`. An integrity hash proves which output is referenced; it does not turn final-fit predictions into held-out predictions.

The About text describes a combination of simple feature averaging and learned dorsal/ventral combination. Treat this as a published workflow description until the precise evaluated ensemble and its component checkpoints are tied to the evaluation receipt. It does not justify presenting only the uploaded head as the complete collection method.

### Leakage boundary

Dorsal and ventral photographs from the same specimen must remain in the same fold. A paired specimen is the relevant unit, not an independently sampled pair of photographs. The published taxonomic evaluation is specimen-based, but the full fold assignment and cross-source duplicate tables were not inspected here. Consequently, this audit does not certify absence of pair leakage, cross-corpus duplicates or foundation-model pretraining exposure. CAMID-grouped fold metadata in the separate sex workflow does not by itself validate the taxonomic folds.

## 6. Geographic re-ranking

**Primary sources:** WG `src/utils/geoPrior.js`, `src/utils/aiPredict.js`, `src/components/AIIdTab.vue`; checklist obtained through `src/composables/useCurationData.js`. **Status: VERIFIED—CODE.**

The prior is a post-classification candidate re-ranking step, not part of BioCLIP's encoder or pretraining. `entryFor` attempts the exact taxon name, then a binomial fallback. A candidate absent from the checklist receives weight 1: unknown coverage is not a hard exclusion.

`geoWeight` uses the following rules:

1. If there is no checklist entry, return 1.
2. If a country other than empty/`Any` is supplied and the candidate has no positive record count for that country, return **0.02**.
3. If side is `East` or `West` and the corresponding positive support is absent, return **0.02**.
4. Otherwise return 1.

Country and side failures do not multiply into 0.0004: the function returns at the first failing condition. With neither country nor side supplied, weights are 1. With a side supplied but no country, the helper still checks the side. The intended interface interpretation of the East/West split is Ecuador's Andes; the helper itself does not enforce `country === 'Ecuador'`. Full caller/UI gating was not interaction-tested.

The module also supports an explicit “guess from photo” mode: it sums raw candidate probability mass across checklist countries and estimates East/West support. That is inferred geographic context, not independent location metadata. It should not be silently equated with either a true supplied locality or a no-prior condition.

Returned leaf scores are multiplied, normalized and aggregated for display. The API's top-64 truncation means geography cannot recover a candidate omitted from the returned set. Lack of a checklist occurrence is not demonstrated biological absence.

**Published held-out Top-1 changes:** species **+0.21 percentage points**, named subspecies **+0.74 pp**, genus **−0.16 pp**. **Status: VERIFIED—PUBLISHED RESULT** in the current Gallery, not a recomputed paired with/without-prior experiment. Report rank-dependent effects rather than claiming uniform improvement.

**Safe wording:** “Optional geographic information reweights candidate scores after classification. The reported collection evaluation showed small improvements at species and named-subspecies ranks and a small decrease at genus rank.”

## 7. Taxonomic evaluation

**Sources:** WG `src/components/AIIdTab.vue`, `tests/aboutTool.test.mjs`, `tests/paired-release.test.mjs` and release receipts. **Status: VERIFIED—PUBLISHED RESULT; tests inspected, not executed; predictions not independently reanalysed.**

### Current collection benchmark

| Rank | Eligible specimens | Top-1 | Top-5 |
|---|---:|---:|---:|
| Named subspecies | 2,613 | 87.93% | 97.33% |
| Species | 3,355 | 91.33% | 97.91% |
| Genus | 3,806 | 95.55% | 99.19% |
| Family | 3,824 | 99.32% | 100.00% |

The current Gallery describes **3,829 verified paired dorsal/ventral specimens, three seeds and five held-out folds**. It discusses a supported finest-class criterion of at least ten examples and rank-specific eligibility based on clean reference identifications after contextual filtering. These descriptions need the matching raw cohort/configuration as supplementary reproducibility evidence.

Rank denominators differ because each evaluated specimen must have usable truth at that rank. Species-level truth does not automatically supply a named-subspecies truth label. The published description counts eligible truth labels absent from the checkpoint/training vocabulary as wrong rather than silently removing them. Exact eligibility and filtering should be documented by CAMID, not reconstructed from the denominators alone.

These figures evaluate the Sanger collection workflow on curated paired photographs. They are not an unrestricted-upload, ecological field-image, segmentation or unseen-species benchmark. The geographic-prior condition and ensemble identity must remain attached to the reported configuration.

### Single-photo AI Identifier

No independently inspectable, release-matched single-photo held-out benchmark was established here. The model card contains training/evaluation descriptions, but their match to the actual loaded upload head, encoder and preprocessing was not demonstrated. They are leads, not an approved upload-accuracy result. Neither the paired benchmark nor the Insect AI report's benchmark can substitute for this missing evaluation.

**Safe wording:** “In the reported held-out evaluation of paired Sanger collection photographs, species Top-1 accuracy was 91.33% among 3,355 eligible specimens. This evaluation does not estimate accuracy for unrestricted user-uploaded photographs.”

## 8. Sex prediction

**Sources:** WG `public/data/sex_predictions.json`, `docs/sex-predictions-20260909.md`, `src/components/AIIdTab.vue`; HF-S optional sex-head implementation. **Status: published collection scope verified; complete raw benchmark and support counts not recomputed.**

The current Gallery About section reports:

| Quantity | Current published value |
|---|---:|
| Sanger specimens with sex predictions | 1,586 |
| Supported outputs | 274 |
| Uncertain outputs | 1,312 |
| Formal benchmark specimens | 1,220 |
| Species in benchmark | 57 |
| Reported accuracy | Approximately 89.7% |
| Evaluation description | Three seeds, five CAMID-grouped folds |

The 1,586 output population is not the 1,220 benchmark population. Do not claim all displayed predictions were independent held-out test observations. The 274/1,312 split above is specifically the current About-page statement; reconcile it against a complete enumeration of `sex_predictions.json` before publishing it as a freshly verified artifact count.

The collection method uses separate BioCLIP representations from **ventral forewings and dorsal hindwings**, with taxon-conditioned prediction and taxon-specific Supported/Uncertain output. It is not simply the taxonomic head reinterpreted as a universal binary sex detector. The exact crop/feature concatenation and model components should be taken from the matching training/inference receipt, not inferred from a picture of the pipeline.

The benchmark discussion includes damaged specimens and alternative inclusion conventions. This audit has not reproduced the exact primary-versus-all-specimen accuracy calculation or confidence interval. Report the approximate published value with its 1,220-specimen collection scope unless the complete evaluation artifact resolves those details. Do not mix a damaged-specimen-excluded denominator with the all-specimen result.

Ordinary Gallery AI Identifier uploads do not expose this collection sex workflow. The Space source contains an optional image-only sex head whose output is unsupported; Gallery upload handling does not present that as the validated collection prediction. Therefore, “the Gallery does not offer the validated collection sex classifier for ordinary uploads” is supported; “no sex code exists anywhere in the backend” is not.

**Safe wording:** “A separate, taxon-conditioned sex-prediction workflow is provided for supported Sanger collection taxa. Its reported specimen-grouped evaluation achieved approximately 89.7% accuracy across 1,220 benchmark specimens from 57 species. This result does not validate sex prediction for arbitrary uploads or all taxa covered by the taxonomic model.”

## 9. Wings Atlas occurrence data

**Primary source:** IM `public/data/data_manifest.json`, generated **2026-05-09T17:38:04.759685+00:00**. **Status: VERIFIED—ARTIFACT METADATA.**

| Combined-dataset source key | Records |
|---|---:|
| GBIF | 64,467 |
| Chazot2021 | 36,400 |
| NHM_Lep | 220 |
| Sanger | 2,943 |
| Strong_2014 | 260 |
| INABIO_QCNE | 7 |
| **Combined total** | **104,297** |

These contributions sum to 104,297. They are combined-dataset contributions, not raw source-download sizes. The same manifest separately reports 66,226 GBIF input records, 5,946 Sanger records, 622 GoaT species and 40 corrections. Do not substitute those raw/input quantities for contributions in the combined table.

The GBIF download key is `0118295-260423084646046`, DOI **10.15468/dl.6zagkz**; the manifest records GBIF last updated **2026-04-28T19:27:13.444786+00:00**. The DOI identifies the download, not every subsequently integrated record.

### Conflicting statistics output

IM `paper/statistics_report.txt` is timestamped **2026-05-09T11:37:24.755227**, earlier than the manifest above. It reports **103,093** total records, 102,829 with coordinates and 264 without, with a different source breakdown. Its taxonomic summary gives 373 species, 237 subspecies and 46 genera. Those values are not independently established for the selected 104,297-record population.

Its country distribution mixes names and codes, including Ecuador/EC, Brazil/BR and Peru/PE, and contains a Congo entry requiring investigation. Its nominal count of 36 country entries must not be called a normalized country count. Status: **DIFFERENT SNAPSHOT / NOT APPROVED for direct combination with the 104,297 total.**

## 10. Sequencing-status definitions

**Primary source:** IM `scripts/process_data.py`, function `determine_sequencing_status`. **Status: VERIFIED—CODE; scientific interpretation and current count units unresolved.**

| Application string | Code condition | Safe interpretation |
|---|---|---|
| `Sequenced` | Qualifying nonempty ToLID, excluding values such as `nan`, `Not in STS`, `NOT_FOUND` | ToLID assigned; the function does not independently check completed sequencing. |
| `Tissue at Sanger` | Without qualifying ToLID, rack field passes the implemented checks | Rack-based tissue-submission proxy; verify against the source system for physical receipt. |
| `Tissue Available` | Neither earlier condition, but first tissue field is present and not an excluded placeholder | Tissue recorded in project fields. |
| `Preserved Specimen` | None of the previous checks pass | Residual application category, not independent confirmation of specimen preservation/availability. |

A code comment equates ToLID with sequencing completion, but the function checks no sequencing-run accession, assembly accession or completion flag. The manuscript must therefore distinguish **the application's ToLID-derived label** from evidence that sequencing actually finished.

`Registered for Sequencing` is not returned by this specific function. Its upstream/GoaT and aggregation path was not fully traced. Do not invent its hierarchy relative to the other states.

The different-snapshot statistics report labels counts as Sequenced 148, Preserved Specimen 113, Tissue Available 58, Registered for Sequencing 56 and Tissue at Sanger 17. Their aggregation unit and applicability to the selected occurrence snapshot were not established. They are **not approved current specimen/species counts**.

**AUTHOR CONFIRMATION:** either describe ToLID assignment/recorded pipeline status explicitly or provide an actual completed-sequencing field. Current counts for registered, tissue at Sanger, tissue available, preserved and genuinely sequenced remain unresolved pending unit and source reconciliation.

## 11. Host plants

**Important: the association artifact, layer manifest and top-level data manifest represent different dates and populations. Do not combine their numbers into a single undated host dataset.**

### Association artifact — 6 May 2026

**Source:** IM `public/data/host_plants/host_plant_associations.json`, Git blob `1c694451a201d767325f30613470293a1f08a100`; metadata generated **2026-05-06T17:17:09+00:00**. **Status: VERIFIED—ARTIFACT METADATA.**

| Quantity | Value |
|---|---:|
| Deduplicated associations | 863 |
| Raw lookup association rows | 1,971 |
| Duplicate lookup rows removed | 1,108 |
| Butterfly/lepidopteran taxa (`total_lep_taxa`) | 215 |
| Unique plant taxa | 167 |
| Unique references | 260 |
| Species-resolution association rows | 771 |
| Genus-resolution association rows | 85 |
| Family-resolution association rows | 7 |
| Confidence: high | 586 |
| Confidence: medium | 277 |
| Association support: unreviewed | 692 |
| Association support: source-backed | 165 |
| Association support: curated assertion | 6 |

The confidence metadata lists no low category. Resolution and support counts refer to association rows, not unique host taxa. A high-confidence field must not be rewritten as “source-verified” when the separate support field says unreviewed.

Plant-support association-row counts are: mapped species 423; accepted but not mapped 342; mapped alias 4; genus-level host 82; unresolved 5; family-level host 7. These partition the 863 association rows. Do not call 423 the number of mapped host taxa.

Input identifiers recorded in this artifact include:

- `public/data/host_plants/sources/hostplant_lookup_compact.json`, SHA-256 `981b7077c714666ef4cf71a16e9b6a2c57b244bf04957e98c31022aa8af1d17f6998`;
- `public/data/host_plants/sources/ithomiini_hostplant_links.tsv`, SHA-256 `af85f10b4e85d77aa1210b474586317b4e6864b251abfaced042a9ed4a5a58bf9e3`;
- alternative-source CSV `public/data/host_plants/sources/ithomiini_hostplants_merged_deduplicated_GBIFformat.csv`, SHA-256 `5e1a14bfc56f1831f93c1b929147cba81dfb4b8e541f6560bfa9174b9c609325475`.

Metadata records a broad document-extraction process. Counts of documents scanned or parsed do not establish that every extracted association was independently reviewed. The 215 `total_lep_taxa` must also be checked for accepted taxonomic scope before calling it 215 distinct Ithomiini species.

### Layer manifest — 8 May 2026

**Source:** IM `public/data/host_plants/host_plant_layers_manifest.json`; generated **2026-05-08T17:10:35+00:00**, pipeline `hostplants_master_curation_2026-05-08`. **Status: VERIFIED—ARTIFACT METADATA, not a live-map recount.**

| Manifest field | Value / scope |
|---|---:|
| `total_taxa` | 90 |
| Host taxa with retained evidence | 90 |
| Taxa with layers | 88 |
| Total exported occurrences | 201,453 |
| GBIF occurrences in this exported layer state | 198,946 |
| Alternative-source occurrences | 2,507 |
| Butterfly species in this layer-manifest summary | 63 |
| `accepted_map_taxa_with_occurrences` | 71 |
| Taxonomy-ledger records / inferred available taxa | 106 |

The manifest distinguishes 88 taxa with layers from 71 accepted map taxa with occurrences. Do not collapse these fields into a single “mapped host taxa” number without inspecting the taxonomy/layer join and UI behavior. It records a seed/audit population of **847 association rows**, 171 retained-evidence audit rows and one excluded audit row; these are not interchangeable with the 863-row association artifact above.

The source breakdown totals **198,946 + 2,507 = 201,453** exported occurrences. The alternative feed is labelled `BW_Dirzo` in the exported source breakdown. Additional intermediate filter counts describe input/kept/excluded records and can overlap; they should not be added as independent losses without checking the pipeline.

### Top-level host summary — another state

**Source:** IM `public/data/data_manifest.json`, `host_plants` entry, last updated **2026-05-06T17:30:00+00:00**.

This entry reports **71 taxa, 1,341,868 occurrences and 113 butterfly species**, GBIF download key `0118276-260423084646046`, plant DOI **10.15468/dl.c7gyd2**. Those are not the May 8 layer-manifest quantities of 88 layer taxa, 201,453 exported occurrences and 63 butterfly species.

**Resolved:** multiple inconsistent/scoped host summaries exist in the same manuscript baseline. **UNRESOLVED:** which exact joined host snapshot the final manuscript should designate, and which live layer count follows from the current UI and exported data. The DOI identifies the GBIF download, not alternative-source records or every later filtered layer.

**Safe interim wording:** “The 6 May association artifact contains 863 deduplicated associations involving 215 recorded lepidopteran taxa and 167 host taxa. The separate 8 May layer manifest reports 201,453 exported plant occurrences.” Do not publish this as a single synchronized dataset until the build scripts under `scripts/host_plants/`, taxonomy ledger and generated files are reconciled. Do not reuse the initial audit's erroneous 470-association summary.

## 12. Species distribution models

### Why 155 and 145 coexist

**Primary sources:** IM Git history for `public/data/sdm/species/`; release commit **`1cdde9bc8d5f4375def888b5796e71493ee60d68`**, **28 April 2026, 12:16:03 UTC**; `public/data/sdm/sdm_metadata.json`; `sdm/05_export_predictions.py`; old statistics output.

The April 28 release explicitly regenerated SDM rasters for **145 species** and removed **ten orphan ensembles without matching accessible-area products**. Its products are full projection, accessible-area core and extension. This supports the distinction between a 155-model historical/metadata state and the 145-species complete raster release.

The release lists these ten removed names:

`Athesis_clearista`, `Ceratinia_lycaste`, `Dircenna_klugii`, `Dircenna_veracruzana`, `Epityches_eupompe`, `Greta_annette`, `Greta_morgane`, `Ithomia_diastropha`, `Ithomia_patilla`, `Ithomia_pseudoagalla`.

Their removal from the product release is not proof that every historical fit for those taxa was invalid. It records absence of the corresponding accessible-area products at release time.

**Recommended manuscript release count: 145 species with complete released raster products, not 155.** The reported directory state of 435 `.tif` files is consistent with 145 three-product sets. This audit did not execute a complete fresh file-stem grouping and live HTTP test for every raster; therefore, distinguish the release-backed count from an independently verified live served count. A metadata-driven species picker can remain stale even when the raster release is correct.

### Confidence and validation summaries remain open

The different-snapshot `paper/statistics_report.txt` summarizes **155** models: **65 high, 56 medium, 34 low** confidence. Its historical metric summary is:

| Metric | Mean | Median | Range | Valid n |
|---|---:|---:|---|---:|
| AUC | 0.943188661971831 | 0.961 | 0.72–1 | 142 |
| Continuous Boyce | 0.8962537142857143 | 0.9962069999999998 | −0.4916–1 | 140 |

These are verified values in the old report, **not approved summaries for the 145-species release**. Changing the headline count to 145 does not repair confidence counts or metric denominators. Earlier intermediate releases cannot substitute either.

The export path rounds displayed metrics and has missing-value handling, so a mean computed from exported display values may not reproduce the underlying validation summary. Preserve missing values and distinguish algorithm selection, cross-validation summaries and exported display metrics.

**UNRESOLVED:** correct high/medium/low counts and AUC/Boyce summaries for exactly the 145 complete released species. Required procedure: enumerate complete raster stems, join to the matching raw model-results table, verify confidence rules, retain missingness, report metric-specific valid n and save input/output hashes. That recomputation was not performed here.

**Safe wording now:** “The checked SDM release provides full, accessible-area and extension products for 145 species.” Withhold aggregate validation statistics until their population is reconciled. Also verify the current deployed picker and missing-layer behavior before claiming every advertised species loads successfully.

## 13. R/vector export

**Primary sources:** IM `src/utils/rExport.js`, `src/utils/rExport/rScriptGenerator.js`. **Status: VERIFIED—CODE for inspected export structure; generated-file execution not performed.**

The ZIP export includes filtered butterfly-point data, configuration/legend information, an R plotting script and supporting files. Range polygons are exported as data when applicable; a captured basemap is image data. The filtered point set is not necessarily restricted to the visible map viewport.

| Map element | Supported export interpretation |
|---|---|
| Butterfly occurrence points | Exported as data; can remain vector in R output. |
| Range polygons | Exported as polygon data when applicable; can remain vector. |
| Basemap | Raster imagery, even inside an SVG/PDF container. |
| SDM layers | No independent SDM data export established in the inspected ZIP path. |
| Host-plant layers | No independent host-layer data export established in that path. |
| Heatmaps | No independent vector heatmap export established. |
| Other overlays visible in a capture | Can be baked into a raster image rather than preserved as editable layers. |

The capture path hides selected butterfly layers while obtaining the background image. Other visible overlays may remain in that image. The generated R setup can also download a fresh basemap, so screenshot-only overlays are not guaranteed to survive that alternative path. Do not promise pixel-identical reproduction of every interactive map layer.

The browser uses `fflate`; generated R setup includes packages for spatial data, plotting, tiles and image handling, including `sf`, `ggplot2`, `dplyr`, `tidyr`, `jsonlite`, `maptiles`, `tidyterra`, `ggspatial`, `grid`, `png` and `stringr`. Package installation, network access and system libraries are relevant dependencies. The export is not proven fully offline or dependency-free.

PDF/SVG output can contain both vector objects and raster images. The final device calls, fonts, transparency, portability and a complete generated-R run were not verified here. **Do not describe this as a fully vector export of all map layers.**

**Safe wording:** “The export supplies occurrence and range data with an R plotting script. Points and polygons can remain vector in suitable output formats, whereas basemaps and image-based overlays remain raster. Not all interactive layers are exported as separate editable data.”

## 14. Figures and interface state

**Sources:** IM manuscript and archived figure discussions; WG current component/tests. **Status: source-state review, not a completed figure or visual QA pass.**

No new figures, screenshots or figure package were generated in this phase. Proposed or discussed figures in archives are not proof of their final implementation or validation. The manuscript is already the recovered July draft; missing figure work is not a reason to reconstruct it.

The critical figure distinction is between uploaded-photo inference and the paired collection evaluation. Do not place the 91.33% paired-species benchmark beside an arbitrary photograph in a way that implies uploads were the evaluated population. Likewise, a sex-prediction panel must identify its narrower taxonomic and specimen scope.

Every quantitative caption should name the relevant module snapshot: frozen occurrence inventory, reconciled host build, 145-species raster release, paired taxonomic evaluation or separate sex evaluation. Old country/source bars, sequencing funnels and SDM confidence plots need regenerated or reconciled inputs. Public mirrors, private working repositories and live application URLs should be checked separately.

## 15. References needing verification

A complete bibliography/DOI audit was not performed. The writing phase must verify primary sources rather than copy citations from assistant archives.

| Topic | Required verification |
|---|---|
| BioCLIP 2.5-H | Appropriate primary publication and exact model release/revision; a paper citation does not identify the loaded weights. |
| Supervised versus zero-shot | Describe the Wings head as supervised. Do not call all frozen-encoder inference zero-shot. |
| Ultralytics / YOLO26s-seg | Confirm exact checkpoint architecture and software version before using the specific family in methods. |
| SAM 3 | Confirm teacher-mask provenance for the actual segmenter, then cite the matching primary method. |
| CLIP-Adapter | Context for IA's residual adapter, not evidence that the Wings upload head uses it. |
| ArcFace / subcentres | Cite as implemented training methods only after a release-matched config verifies them. |
| Butterfly GBIF download | DOI `10.15468/dl.6zagkz`, with correct download and combined-snapshot scope. |
| Plant GBIF download | DOI `10.15468/dl.c7gyd2`, excluding attribution of alternative-source rows to that DOI. |
| SDM methods and validation | Match algorithms, accessible-area procedure, cross-validation and Boyce definition to the exact released products and metric population. |
| Host-plant references | Separate extracted references, unreviewed associations and source-backed records; do not imply literature validation from extraction counts. |
| Bibliography completeness | Recheck the recovered manuscript's citations against its actual bibliography. Archived warnings are leads, not proof of current omissions. |

## 16. Unresolved evidence and author-confirmation items

| Priority | Open item | What closes it |
|---|---|---|
| Classifier methods | Exact uploaded and paired checkpoint architecture, K, training margin, calibration | Safe checkpoint/config inspection tied to weight hashes; separate the two model lineages. |
| Deployment identity | Files actually loaded by running Space | Runtime receipt with source revision, encoder revision, resolved asset paths and byte hashes. |
| Training data | 58,165 / 63,307 hypotheses; source counts; exclusions; rare classes; contradictory labels; adult filtering | Release-bound row-level training/eligibility manifest and executed filter/config receipts. |
| Coverage | Exact accepted species/subspecies/genus counts | Enumerate and normalize the actual released label map; retain aliases and ambiguous labels explicitly. |
| Evaluation | Reproduction of paired taxonomic results and leakage checks | CAMID/fold/seed/eligibility manifest, duplicate audit and rank-specific out-of-fold predictions. |
| Uploaded-image accuracy | Release-matched single-photo benchmark | Exact upload pipeline evaluated separately; otherwise omit an upload-accuracy claim. |
| Segmentation | Exact model family and SAM 3 teacher-mask chain | Checkpoint metadata plus matching training/mask-generation receipts; no inference from v6/v7 development alone. |
| Geographic evaluation | Exact collection before/after prior run | Same eligible population and folds with raw paired results; verify caller gating and inferred-location mode. |
| Sex prediction | Exact primary cohort, full support count, crop/head receipt | Enumerate the asset and reconcile damaged-specimen handling, current About totals and model provenance. |
| Occurrence inventory | Dependent statistics for 104,297 frozen records | Regenerate normalized-country, taxonomy and source tables from the selected data bytes. |
| Host plants | One coherent association/layer/UI snapshot | Reconcile May 6 association data, May 8 layer build and top-level summary through scripts and input hashes. |
| Sequencing | Definitions, unit of counts and genuine completion state | Trace registered/GoaT aggregation and inspect sequencing evidence; author decision on ToLID-derived naming. |
| SDM | Actual live served population and 145-species metrics | Raster-stem enumeration, live layer/picker checks, joined raw metrics and confidence rules. |
| Export | Actual SVG/PDF results and missing overlay behavior | Run representative exports with SDM, hosts and heatmap enabled; inspect data contents and rendered output. |
| Submission | Figures, bibliography, acknowledgments | Review against the selected module snapshots and primary sources. |

### Context read and provenance limits

The archive README/index were used for orientation. Targeted passages were consulted from the requested Ithomiini search/summarization/review transcripts and the Wings reconciliation, overnight-work and `update-wings-classifier-context-195a1f49.md` transcripts. The IA report's classifier-method passages and requested ecology transcript were also consulted. These archives were not all read exhaustively.

Remaining targeted archive context includes `docs/chat-transcripts/t3-code-wings/update-wings-classifier-context-1afb5240.md`, `docs/chat-transcripts/t3-code-wings/audit-subspecies-image-datasets-5d7e3dd7.md` and, where necessary, the long manuscript transcript. Use them to locate missing executable artifacts, not as substitutes for those artifacts. The separately located `Fr4nzz/WingsClassificator` repository is another provenance lead; its older state should not automatically be treated as the September collection release.

### Rule for phase 2

Use verified code/artifact facts only with their stated scope. Attribute published benchmark values to the paired collection or sex workflow they evaluate. Resolve blocking items or omit the unsupported details; do not invent methods to make the manuscript read smoothly. In particular, keep separate the uploaded taxonomic head, paired collection head, collection sex workflow, IA residual classifier, frozen occurrence dataset, host-plant build and SDM product release.
