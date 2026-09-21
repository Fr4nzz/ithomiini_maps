# Final manuscript evidence ledger — 21 September 2026

**Phase 1 factual handoff. This is not a revised manuscript.**

The purpose of this ledger is to separate facts supported by the inspected source state from historical claims, published-but-not-recomputed benchmark results, and missing evidence. It must not be read as a certificate that every requested verification was completed. Several important provenance and recomputation tasks remain open in section 16. In particular, the training manifest and checkpoint internals were not fully inspected, and the 145-species SDM performance summaries were not recomputed.

## Evidence conventions and pinned repositories

| Alias | Repository / resource | Inspected revision |
|---|---|---|
| IM | `Fr4nzz/ithomiini_maps` | `935cc42740aefbe70640eb15d79bf4f6c21e1089` |
| WG | `rapidspeciation/Shiny_Ikiam_Wings_Gallery` | `f5cb03f17f3ba639090b32fbedde6d6645ff847b` |
| IA | `Fr4nzz/insect-ai-thesis-ml` | `e80ac06a27329f7b01e10aecba1d0c1133251958` |
| WC | `Fr4nzz/WingsClassificator` | `f5db5de8212c36997e0220a1d2542f082fe9abdb` |
| HF-M | `https://huggingface.co/fr4nzzch/butterfly-id-classifier` | repository revision `61c8fb58578a2ea64c6972e17b5101697729eaa8` |
| HF-S | `https://huggingface.co/spaces/fr4nzzch/butterfly-id` | repository revision `3aa72a33946f2da661d1ed96f0929e92cd9413e6` |

All IM, WG, IA, and WC paths below mean the exact revision in this table, not a floating `main`. Unless a row supplies a different date, the verification date is 21 September 2026; a verification date is not a data-collection or model-training date. The three branch heads supplied in the phase-1 request matched the expected commits when checked. WC was located separately as a provenance lead; its September 7 state does not automatically contain the September 10–14 collection release.

Statuses:

- **VERIFIED—CODE/ARTIFACT:** the inspected implementation, generated payload, Git object, or release receipt supports the stated fact. Metadata counts are identified as metadata counts, not represented as independent row enumerations.
- **VERIFIED—PUBLISHED RESULT:** the value is present in the current application/report and, where indicated, protected by source tests. This does not mean this audit reran the experiment or regenerated its out-of-fold predictions.
- **SUPERSEDED / INAPPLICABLE:** not an appropriate description of the specified current pipeline or snapshot. Historical values can still be correct for their original scope.
- **UNRESOLVED:** insufficient evidence inspected to settle the claim.
- **AUTHOR CONFIRMATION:** a scientific interpretation, naming decision, or missing project artifact needs explicit confirmation.

Priority is executable code, artifacts and Git history; then verifiable deployment evidence; then traceable reports; then user messages in archives. Assistant archive responses are leads only. A test that asserts an About-page number proves consistency of the application with that number, not validity of the experiment that produced it.

**Operational limits:** this audit used repository/API and public Hugging Face source inspection. It did not obtain a complete executable local checkout, run the Gallery test suite, run inference against a confirmed live container, deserialize all model checkpoints, or reconstruct the raw evaluation cohorts. No test-passing, retraining, calibration, or deployment claim should be inferred from this ledger. No scientific prose in `paper/manuscript.md` is intentionally changed by this audit.

## 1. Manuscript baseline and snapshot policy

**Source:** IM `paper/manuscript.md`; branch `manuscript/chat-archive-20260920`; commit `935cc42740aefbe70640eb15d79bf4f6c21e1089`.

The manuscript is the already recovered July 8 version. Reconstructing that version is not a pending task. The audit branch starts from that commit; `main` is not the editing target.

### Snapshot decision

**Recommendation: retain the explicitly frozen 9 May 2026 occurrence snapshot, with 104,297 records, for the manuscript's core occurrence inventory.** Do not replace only that total with a value from `paper/statistics.json` or `paper/statistics_report.txt`. Those files describe a different generated state, even though their timestamp is also May 9. Every occurrence-derived table, country total, map-density summary, source contribution, taxonomic count, and sequencing summary must either be reconciled to the selected snapshot or withheld.

This recommendation is not a claim that every current JSON file belongs to that snapshot. The repository contains internally different manifests, especially for host plants. The September classifier and collection results may be reported as separately dated modules, not silently described as part of a single May dataset.

**Safe wording:** “Occurrence summaries refer to the 9 May 2026 snapshot. Classifier and collection-prediction results refer to the separately identified September 2026 releases.”

A newer single-snapshot analysis remains an alternative, but requires regeneration of *all* dependent statistics, a record-level input hash, corrected country normalization, and an explicit manuscript-wide date change. That regeneration was not performed in phase 1.

## 2. Wings taxonomic classifier

### 2.1 Uploaded-photo inference: supported implementation

**Primary sources:** HF-S `inference.py`; WG `src/utils/aiPredict.js`, `src/components/AIIdTab.vue`. HF-S revision is pinned above. The following describes the inspected source path, not a cryptographically attested running container.

| Component | Finding | Status / manuscript constraint |
|---|---|---|
| Image backbone | Frozen BioCLIP 2.5-H image encoder, loaded through `hf-hub:imageomics/bioclip-2.5-vith14`; image encoding runs in evaluation/no-gradient mode | VERIFIED—CODE. Do not call the complete supervised system “zero-shot BioCLIP.” |
| Single-image feature size | The backbone is described as providing 1,024-dimensional features. The head loader obtains its actual input size from checkpoint `feat_dim` | Supported by backbone/report descriptions; checkpoint tensor-shape confirmation remains open. |
| Residual adapter | No residual adapter in the inspected uploaded-photo `CosineHead` path | VERIFIED—CODE. The Insect AI residual head must not be substituted into this description. |
| Layer normalization | `LayerNorm` before cosine classification | VERIFIED—CODE |
| L2 normalization | Features and classifier weights are normalized before their dot product | VERIFIED—CODE |
| Classifier | Cosine-similarity classifier with a directly predicted finest-rank label space | VERIFIED—CODE |
| Scale | Cosine logits use scale 30 in the inspected inference implementation | VERIFIED—CODE. This is not evidence of a separately fitted calibration temperature. |
| Subcentres | Code supports K subcentres and takes the maximum per class when K > 1; loader uses checkpoint K, defaulting to 1 | VERIFIED—CODE for support/default; **UNRESOLVED** actual released K without checkpoint inspection. |
| Angular margin | No training-time angular margin is applied by this inference path | VERIFIED—CODE for inference only. Whether ArcFace or another margin was used during training is UNRESOLVED. |
| Calibration | No additional fitted temperature is read/applied in this path; effective additional temperature is 1 | VERIFIED—CODE. Do not import Insect AI's T = 0.8. |
| Output hierarchy | Finest-rank leaf probabilities are produced first; the Gallery derives coarser ranks downstream | VERIFIED—CODE. Not a demonstrated cascade of independently trained family/genus/species heads. |
| Truncation | The API returns the top 64 leaf probabilities, rounded to five decimals | VERIFIED—CODE. Browser aggregation is over these returned candidates, not necessarily the complete leaf posterior. |

The browser normalizes the returned/reweighted candidate scores and aggregates them for species/genus and named-subspecies displays. Consequently, displayed coarser-rank scores should be called candidate scores or aggregated probabilities with a truncation qualification; this audit does not establish calibrated probabilities over the full taxonomy.

**Manuscript-safe architectural description:** “For uploaded photographs, a frozen BioCLIP 2.5-H image encoder supplies features to a supervised taxonomic head consisting of layer normalization and an L2-normalized cosine classifier. The inspected inference implementation uses a cosine scale of 30 and contains no residual adapter. It predicts finest-rank labels directly; coarser taxonomic candidates are obtained by downstream aggregation of the returned leaf scores.”

Do not add an exact subcentre count, ArcFace margin, optimizer, training epoch count, or fitted temperature until the matching checkpoint and training receipt are inspected.

### 2.2 Model identity and deployment caveat

HF-M `head_hier.pt` is identified by the published LFS object SHA-256:

`e461eb4eda24c179b9ae450c86ee38547aa89b689627bcd5ba5551d0f1d2e1f1`

Reported file size: 32,992,738 bytes. These are repository artifact identifiers, not a fresh hash of bytes downloaded and deserialized in this audit.

The Space asset helper checks local assets before falling back to the configured Hugging Face weights repository. The fallback does not pin an explicit revision in the inspected path. Therefore, the source commit, model-repository head, and the actual files loaded by a running Space must not be treated as interchangeable identifiers. **UNRESOLVED:** a runtime receipt tying the loaded `head_hier.pt`, `wing_seg.pt`, encoder revision, environment overrides and Space commit together.

### 2.3 Why the Insect AI architecture is not transferable wholesale

**Source:** IA `reports/eda_insect_ai_pipeline.html`, blob `ad8d124a298b4c4cdafc5127a52572692ff7f79d`, particularly its classifier methodology near source lines 1850–1950; IA `docs/chat-transcripts/t3-code/update-full-frame-ecology-tab-2d8166ec.md`, blob `1cb05ee0b5d1ae0f6d45fd70b10bcae55ce02257`.

The report explicitly describes a different supervised classifier: a custom residual `1024 → 64 → 1024` adapter with GELU and `x + 0.2 Δx`, followed by LayerNorm, L2 normalization and a cosine classifier over 47,560 species. It reports separate calibration at T = 0.8 and checkpoint SHA-256 `2a560e837b4cf6b07aca94154902b0ef34bcd773a5121b0aaa09868c3d573995`. These are **IA report claims, not Wings model parameters**.

The report also distinguishes genuine image/text zero-shot BioCLIP inference from a trained supervised head. Its conceptual explanation is useful, but its architecture, training sample size, epoch, calibration, crop protocol and test scores must not be copied into the Wings methods. The archived user instructions explicitly require distinguishing historical benchmarks from the exact production configuration.

## 3. Training data and label coverage

**Sources:** HF-M model release metadata and class/head assets; WG `src/components/AIIdTab.vue`, `tests/aboutTool.test.mjs`; IM Wings archives listed in the source inventory below.

| Quantity / claim | Supported state | Status |
|---|---|---|
| Finest-rank classes | Current release metadata reports **7,933** | VERIFIED—ARTIFACT METADATA; independent enumeration of the complete class map not completed. |
| Species represented | Current release reports **4,478** | VERIFIED—ARTIFACT METADATA / application description; complete taxonomic-normalization recount remains open. |
| Named subspecies | Gallery description reports **4,958** | VERIFIED—PUBLISHED COVERAGE; independent named-trinomial/alias count remains open. |
| Genera represented | No final independently checked count established | UNRESOLVED |
| Broader corpus rows | **63,307** is a hypothesis supplied for checking, not established by an inspected release-bound manifest in this audit | UNRESOLVED; do not present as independently verified. |
| Exact-label eligible images | **58,165** is likewise not established here from the matching training manifest | UNRESOLVED |
| Number of images actually used by the final released training run | A complete row-level manifest tied to the deployed checkpoint was not inspected | UNRESOLVED |
| Major source contributions | Archived discussions contain changing corpora; a source-count table tied to the final checkpoint was not recovered | UNRESOLVED |
| Rare classes / class weighting / minimum support | Must be read from the matching training config, not inferred from the existence of rare labels in the vocabulary | UNRESOLVED |
| Excluded labels or photographs | No complete checkpoint-bound exclusion ledger inspected | UNRESOLVED |
| Contradictory labels, aliases and spelling splits | Archives describe curation work, but this does not prove all contradictions were removed before the released training run | UNRESOLVED |
| Adult/immature/background filtering | No complete executed filter receipt tied to the head | UNRESOLVED |

Species coverage and named-subspecies coverage are not disjoint additive categories. A species can be represented through one or more subspecies leaves; adding 4,478 and 4,958 is not a valid way to recover the number of finest-rank classes. The paper should also distinguish “labels in the model vocabulary” from biologically or taxonomically validated accepted taxa.

WC `dataset.csv` and `tools/train_finetune_arcface.py` / `tools/train_finetune_arcface_ensemble.py` are provenance leads, not proof of the September release's precise dataset or loss function. WC's inspected head predates later collection-release receipts. Do not infer that an ArcFace-named historical script trained the uploaded checkpoint.

**Safe wording pending the training-manifest check:** “The released label vocabulary is reported to contain 7,933 finest-rank classes spanning 4,478 species; the Gallery reports 4,958 named subspecies. Training-set size, filtering, and rare-class treatment require confirmation against the release-specific training manifest.” For submission, either close that gap or omit unsupported sample-size and training-procedure claims.

## 4. Image preprocessing and segmentation

**Primary source:** HF-S `inference.py`; HF-M `wing_seg.pt` artifact history.

The uploaded-photo path loads `wing_seg.pt`, optionally overridden by `WING_SEG_WEIGHTS`, through `ultralytics.YOLO`. Segmentation/detection boxes are used to construct rectangular RGB crops; the inspected classifier path is not a pixel-mask-on-black classification pipeline. The crop routine uses a 6% margin, detection confidence 0.05, a maximum of 32 detections and containment/overlap deduplication with an intersection-over-minimum-area criterion of 0.5. The default combined target is the union of selected boxes. Missing segmentation weights or no usable detections can lead to full-image fallback. These are code-path facts, not measured segmentation quality.

HF-M `wing_seg.pt`:

- published object SHA-256: `012e95bb092d075d816e480414edbb30512c9812ccf5e8601ed9620fedcf03e1`;
- reported size: 23,357,526 bytes;
- relevant upload commit: `45992a486a9f38b729297f86febdc51cbcaeb02e`, June 29;
- the release history labels this the corrected **wings_v3** artifact.

**VERIFIED:** Ultralytics loading, artifact identity and crop logic in the inspected uploaded-photo source/repository. **UNRESOLVED:** runtime hash attestation, checkpoint architecture deserialization, exact training images/masks and a teacher-mask receipt.

The Gallery's descriptive material associates its wing segmenter with YOLO26s-seg and SAM 3-derived training masks. That is weaker evidence than a checkpoint/config/data receipt. **Do not state that SAM 3 teacher masks definitively trained this exact uploaded `wing_seg.pt` until the provenance chain is closed.** Similarly, later Wings-v6/v7 development is not evidence that v6/v7 is deployed in the uploaded-image Space. Collection segmentation and uploaded-image segmentation can have different histories.

**Publication-level wording supported now:** “An Ultralytics-based wing-localization model is used to define padded rectangular image regions for classification, with a full-image fallback when no usable region is available.” Add the exact YOLO model family and SAM 3 teacher-mask procedure only after the matching training receipt is verified. Internal v3/v6/v7 labels belong in provenance, not as unexplained model names in the main paper.

## 5. Paired dorsal/ventral collection workflow

**Sources:** WG `public/data/prediction_coverage_receipt.json`, `tests/paired-release.test.mjs`, `scripts/validate-curation-data.mjs` and the collection prediction assets they validate.

The collection release is separate from the uploaded-photo head. Its receipt identifies a paired representation as **CONCAT_DV**, with **2,048-dimensional** dorsal/ventral concatenated features. The explicit paired population is **3,829 verified pairs**. This is not the total number of arbitrary uploads and is not a count of individual photographs.

The expanded collection payload contains **3,849 specimens: 3,829 paired specimens and 20 uploaded-head fallbacks**. The coverage receipt additionally distinguishes a 269-record live payload, their 4,118-record union, and a 402-record coverage addition reaching 4,520 active specimens. The receipt's photographic coverage fields include 4,388 photographed CAMIDs and zero missing visible predictions. These refer to different sets; none should be substituted for the 3,829 paired benchmark population.

The coverage addition records 799 input images and five single-view fallbacks represented by a duplicated feature vector. Such fallback representations are not genuinely observed two-view pairs and must not be counted as verified pairs in the benchmark.

The paired release head is identified in the receipt/tests by SHA-256:

`34ecd53f64b3f9dc600710af5ca8df7cd94845653a9ce9f916dcd08adc520167`

The paired release tests pin an expanded-prediction asset SHA-256:

`2f75987de896889ee8ed9c09a77a4c97551a5f1934708bf8f63424d8a073fe70`

These identities differ from the uploaded `head_hier.pt` identity. **Do not describe the 2,048-dimensional collection head as merely the verified 1,024-dimensional uploaded head with an extra photograph.** Its exact layer structure, margin, subcentre count and calibration remain to be traced to its own checkpoint and training/evaluation config.

The published final-fit collection predictions are not themselves an out-of-fold evaluation table. Population coverage and prediction-file integrity are distinct from held-out accuracy.

### Leakage qualification

Pairing must be grouped by specimen/CAMID before assignment to folds; dorsal and ventral images of the same specimen cannot be independent train/test examples. The current paired benchmark is described as specimen-based, but this audit did not inspect the complete taxonomic fold-assignment table and all cross-source duplicate hashes. Thus it does not certify absence of cross-fold, cross-corpus, or foundation-pretraining exposure. Explicit CAMID-grouped folds are visible in the sex-prediction metadata, which is a separate evaluation.

## 6. Geographic re-ranking

**Primary sources:** WG `src/utils/geoPrior.js` (blob `db3325bc076e232acc8e05eaae676e7ffb4c5b10`), `src/utils/aiPredict.js` (blob `ad3cc730cbb1c6b2d86ac3181600906ec88deb52`), and `src/components/AIIdTab.vue`.

This is a **post-classification re-ranking step**, not part of BioCLIP's encoder or pretraining. The implementation looks up the exact candidate taxon, with a binomial fallback where necessary. A taxon absent from the prior table is not automatically excluded: its multiplier is 1. With no/any-country selection the multiplier is 1.

For a taxon with prior information, observed support in the selected country retains weight 1; absent country support applies a soft multiplier of **0.02**, not a hard zero. East/west support is similarly used for the side-of-Andes input. Multiple absent-support checks do not imply a compounded 0.0004 multiplier in the inspected implementation: the unsupported outcome remains 0.02. The intended interface use is Ecuador side-of-Andes refinement; the full country/side UI-gating path was not exhaustively interaction-tested in this audit.

The candidate probabilities are multiplied, renormalized and then aggregated for display. Because the API returns only its top leaf candidates, this re-ranking cannot recover a taxon that was not returned by the API. An absence in the occurrence prior is not demonstrated biological absence.

**Published held-out effects** in the current Gallery description:

| Rank | Change in Top-1 accuracy |
|---|---:|
| Species | +0.21 percentage points |
| Named subspecies | +0.74 percentage points |
| Genus | approximately −0.16 percentage points |

Status: VERIFIED—PUBLISHED RESULT in the inspected Gallery state; the raw paired with/without-prior experiment was not rerun. Report these as modest, rank-dependent changes, not a uniform improvement. The units are percentage points, not relative percent.

**Safe wording:** “Optional country and Ecuador side-of-Andes information reweights taxonomic candidate scores after classification. In the reported held-out collection evaluation, the geographic adjustment improved species and named-subspecies Top-1 accuracy slightly but reduced genus accuracy slightly.”

## 7. Taxonomic evaluation

**Sources:** WG `src/components/AIIdTab.vue`, including the benchmark/About section; `tests/aboutTool.test.mjs`; `tests/paired-release.test.mjs`; collection release receipts. The About component blob is `19c54d5fea4611c5afd21d39102a8811d4edd4c3`; About test blob is `84611edec74e24fe1decd114798090dd7667d40` where available from the inspected response; the repository commit remains the authoritative locator if a copied blob identifier is unavailable.

### Current published collection benchmark

| Rank | Eligible specimens | Top-1 | Top-5 |
|---|---:|---:|---:|
| Named subspecies | 2,613 | 87.93% | 97.33% |
| Species | 3,355 | 91.33% | 97.91% |
| Genus | 3,806 | 95.55% | 99.26% |
| Family | 3,824 | 99.32% | 99.90% |

The current description specifies **3,829 verified paired dorsal/ventral collection specimens, three seeds and five held-out folds**, with the reported geographic-prior configuration. These values are verified as published/test-locked application values, **not independently regenerated by this audit**. Source tests were inspected but not executed here.

Denominators differ because eligibility is rank-specific: a specimen needs a usable reference identification at the evaluated rank. A specimen identified to species does not automatically provide a named-subspecies reference. Likewise, not all paired specimens have eligible reference labels at every coarser rank. The current evaluation description treats eligible labels absent from the fold's training vocabulary as misses rather than silently removing them. The exact per-CAMID eligibility and fold manifests should accompany the final supplement before claiming a reproduced experiment.

**Scope:** these are Sanger collection-workflow results on curated paired views. They are not measured accuracy for arbitrary photographs submitted to the AI Identifier. They also are not a general ecological field-image benchmark, a segmentation benchmark, or proof of performance on unseen species.

### Single-photo AI Identifier

No release-matched, independently inspectable single-photo held-out benchmark was established in this audit. Historical scores, generic model-card descriptions, the paired collection benchmark, and the Insect AI 2,000-photo benchmark cannot fill this gap. The final manuscript should report the collection benchmark separately and explicitly state that the arbitrary-upload interface has not been validated here by that benchmark.

**Safe wording:** “In the reported specimen-level held-out evaluation of paired Sanger collection photographs, species Top-1 accuracy was 91.33% among 3,355 eligible specimens. These results do not estimate accuracy for unrestricted user uploads.”

## 8. Sex prediction

**Primary sources:** WG `public/data/sex_predictions.json` (blob `eab05471c1d134576f222cc5e37781edb4986688`); `docs/sex-predictions-20260909.md` (blob `c3997b59db0ad507e8fcacba8831ff2b2ed8e9bf`); WG upload response handling; HF-S optional sex-head path.

### Collection predictions and benchmark

| Claim | Verified payload/report state |
|---|---|
| Collection predictions exported | **1,586** specimens |
| Benchmark cohort | **1,220** specimens, reported across **57 species** |
| Later top-up | **366** specimens outside that benchmark cohort |
| Primary reported analysis | **1,215**, excluding five damaged specimens |
| Primary accuracy | **0.897119341563786**, approximately **89.7%** |
| Accuracy including all 1,220 | **0.8967213114754098**, also approximately 89.7% after rounding |
| Primary MCC | **0.7949735280937963** |
| Primary reported Wilson 95% interval | **0.878766368739088–0.9129491746986645** |
| Splitting | CAMID-grouped five folds, three seeds: 1701, 314159, 20260830 |

These are metadata/report values inspected in the published prediction asset, not a fresh reanalysis. The difference between 1,586 predictions and 1,220 benchmark specimens is therefore not a contradiction. The primary 1,215 denominator must not be silently paired with the all-1,220 result.

The collection method uses separate frozen BioCLIP representations of ventral forewing and dorsal hindwing regions, rather than simply reusing the ordinary uploaded-photo taxonomic prediction. The recorded design uses four region representations (two ventral forewings and two dorsal hindwings) in the collection sex workflow. Exact deployment/training reproduction still requires the matching crop/feature and model receipts.

The Supported/Uncertain output is taxon-specific, not just a universal score threshold. The metadata includes a candidate confidence threshold of 0.8 and support rules involving sample sizes per sex, balanced accuracy, and recall uncertainty. The species/genus rule includes at least 20 per sex, balanced accuracy at least 0.95 and a recall Wilson lower-bound criterion of 0.8; a child-taxon check uses at least five per sex and balanced accuracy at least 0.8. Such support derived from the same out-of-fold evaluation is not independent prospective validation.

The 366-record top-up contains **274 Supported and 92 Uncertain** predictions. Those two counts belong to the top-up, not automatically to the entire 1,586-record asset. Do not repeat 274 as the total supported population without enumerating the full file.

### Ordinary uploads

The Gallery's normal AI Identifier does not expose the collection sex prediction. Its upload response handling discards the optional `sex_prediction` field. The Space source nevertheless includes an optional image-only sex head whose output is explicitly unsupported; that is not the collection benchmark above. The optional HF-M sex-head artifact has SHA-256 `57a3d4d0533c12da4afadd95b4bbf04d37e7013ba547ceb7728b0ac8313621b2` and a LayerNorm/linear binary head, not proof of a validated upload sex classifier.

**Safe wording:** “A separate sex-prediction workflow is provided for supported Sanger collection taxa. Its reported specimen-grouped evaluation achieved approximately 89.7% agreement with recorded sex labels. The Gallery does not offer this validated collection workflow for ordinary AI Identifier uploads.” Do not claim universally reliable sex determination or infer applicability to all 4,478 taxonomic species.

## 9. Wings Atlas occurrence data

**Source:** IM `public/data/data_manifest.json`, blob `594132b38c282430b28742605b3c0e49c5ba76d3`.

The manifest was generated at **2026-05-09T17:38:04.759685Z** and records **104,297 combined occurrences**. Its source contributions are:

| Source key | Combined contribution |
|---|---:|
| GBIF | 65,708 |
| Chazot 2021 | 36,871 |
| NHM_Lep | 220 |
| Sanger | 879 |
| Strong_2014 | 34 |
| INABIO_QCNE | 585 |
| **Total** | **104,297** |

These contributions are not raw-download sizes. The same manifest records 66,199 downloaded GBIF records, 5,946 Sanger records, 622 GoaT species and 40 corrections. The GBIF occurrence download DOI is **10.15468/dl.6zagkz**, with a March 11 download date in the manifest. Do not report 5,946 as Sanger's contribution to the combined deduplicated map when the contribution field is 879.

### Conflicting statistics output

IM `paper/statistics_report.txt` (blob `4b67deb33c6c915e7d99682f0a364c477ce27cde6a`) is timestamped **2026-05-09T11:37:24.755227**, earlier than the above manifest. It reports **103,093** records, 102,829 with coordinates, 264 without coordinates, 373 species, 237 subspecies and 46 genera. It has a different source breakdown. Its country summary mixes country names and codes (for example Ecuador and EC), and includes a Congo entry requiring investigation. Its nominal country count is not a clean normalized-country count.

Status: both generated-file states exist; the statistics output is **INAPPLICABLE as an interchangeable summary of the selected 104,297-record snapshot**. The date alone does not make these datasets identical. The taxonomic and country figures in that report must not be combined with the manifest's occurrence total without regeneration.

## 10. Sequencing-status definitions

**Primary source:** IM `scripts/process_data.py`, blob `12004e24d3067b0aea9d52a6c306600b348f4c90`, function `determine_sequencing_status` near lines 276–311.

The current source function actually implements the following priority:

| Application string | Executed condition in the inspected function | Manuscript-safe interpretation |
|---|---|---|
| `Sequenced` | A nonempty ToLID passing the function's exclusions (`nan`, `Not in STS`, `NOT_FOUND`) | **ToLID assigned / represented in the identification pipeline**, not independently demonstrated completion of sequencing |
| `Tissue at Sanger` | No qualifying ToLID; rack string passes the code's `Not in TOL` and length checks | Rack-based submitted-tissue proxy; physical receipt should be confirmed from the source system |
| `Tissue Available` | Neither earlier condition; first tissue field is nonempty and not `NOT_COLLECTED`/`nan` | Tissue recorded as collected/available in the project fields |
| `Preserved Specimen` | None of the preceding checks pass | Residual category in this code; not independent proof of specimen condition or availability |

The code comment claims that a ToLID means sequencing was completed, but the function checks no sequencing-run accession, assembly accession or completion flag. The correct scientific conclusion is therefore: **the application currently uses ToLID assignment as its `Sequenced` proxy; the audit does not establish that this proxy means sequencing is complete.** The user-requested distinction is material, even though the code uses the stronger label.

`Registered for Sequencing` is not returned by this specific function. Its complete upstream/GoaT/aggregation path was not traced in this audit. Do not invent a registered-versus-sequenced ordering or convert all ToLID records into a count of completed genomes.

The conflicting statistics report contains counts labelled Sequenced 148, Preserved Specimen 113, Tissue Available 58, Registered for Sequencing 56 and Tissue at Sanger 17. Their unit, aggregation and applicability to the chosen occurrence snapshot were not established here. They are **historical report values, not approved current specimen or species counts**.

**AUTHOR CONFIRMATION required:** decide whether to relabel the UI category as ToLID assigned/registered or supply a separately verified completed-sequencing field. For the manuscript, describe recorded pipeline status rather than biological sequencing completion. Current counts for the five requested categories remain UNRESOLVED pending source-level category and unit reconciliation.

## 11. Host plants

### 11.1 Association table: verified current repository artifact

**Primary source:** IM `public/data/host_plants/host_associations.json`, blob `1c694451a201d767325f30613470293a1f08a100`. This is the actual filename in the inspected branch; do not substitute an unverified `ithomiini_hostplant_associations.json` or `meta.json` path.

Generated **2026-04-29T14:36:02.333000+00:00** from `public/data/host_plants/host_associations.csv`, source CSV SHA-256:

`5aa139b8d8f2b191175af363689fde4f26c18f19c2a01deed155b640fb94d1a2b17`

| Metadata quantity | Value |
|---|---:|
| Associations | **470** |
| Butterfly taxa | **132** |
| Host taxa | **167** |
| Host resolution: species-level association rows | **437** |
| Host resolution: genus-level association rows | **30** |
| Host resolution: family-level association rows | **3** |
| Association support: source-backed | **456** |
| Association support: curated assertion | **14** |
| Confidence: high | **314** |
| Confidence: medium | **152** |
| Confidence: low | **4** |
| Plant support on association rows: mapped species | **445** |
| Plant support on association rows: accepted but unmapped | **23** |
| Plant support on association rows: unresolved host name | **2** |

The resolution, association-support and confidence categories each partition 470 **association rows**. They are not counts of unique host taxa. Confidence and support status are different fields: a source-backed record is not automatically high-confidence, and a curated assertion is not automatically false.

These values are VERIFIED—GENERATED METADATA, not a fresh deduplication of the underlying literature. The file's April 29 generation date means it must not be described as a newly collected September host-plant compilation. A later manuscript claim is not disproved solely by this older generated artifact; any different claimed host total needs its own archived build and source CSV.

### 11.2 Mapped plant taxa and occurrence quantities

**Primary source:** IM `public/data/host_plants/host_plant_layers_manifest.json`, blob `b7c3b1a49f790cbdc23a261e15f61e7da61acbe56`; companion `host_taxa.json`, blob `35e7e419a7e176b4417e689e4aed419d7a493707a`; directory `plant_occurrences/`.

The layer manifest records **167 plant taxa**, **71 with map layers** and **96 without layers**. Coverage statuses are: mapped 71, accepted-but-unmapped 87, unresolved 2, host-genus-not-mapped 6, host-family-not-mapped 1. It reports **116 butterfly species with host data**. These denominators differ from the 132 butterfly taxa in the association table.

Keep the following occurrence quantities separate:

| Quantity | Manifest value / scope |
|---|---|
| GBIF source occurrence count | **1,340,663** |
| Mapped GBIF IDs in layers | **1,028,153** |
| Mapped alternative-source IDs in layers | **1,205** |
| Source-breakdown occurrences represented in mapped layers | **1,029,358** = 1,028,153 + 1,205 |
| Alternative merged source file | `ithomiini_hostplants_merged_deduplicated_GBIFformat.csv` |

The top-level IM `public/data/data_manifest.json` contains a **different host summary**: 71 taxa, **1,341,868 occurrences** (1,340,663 GBIF source occurrences + 1,205 alternatives), and **113 butterfly species**, updated May 6. The layer manifest instead reports 116 butterfly species and the smaller mapped-layer count above. **This cross-manifest discrepancy is unresolved.** The raw/input occurrence total must not be described as the number of distinct mapped plant features.

The plant GBIF download DOI in the top-level manifest is **10.15468/dl.c7gyd2**, downloaded April 28. The DOI identifies the GBIF download, not the additional alternative records. DOI resolution and the complete filter/deduplication chain were not independently revalidated in this audit.

**Safe wording:** “The inspected host-association artifact contains 470 associations involving 132 butterfly taxa and 167 host taxa; mapped occurrence layers are available for 71 host taxa.” Add plant-occurrence totals only with the explicit raw-download versus mapped-layer distinction and the relevant snapshot. Do not combine the 113/116 species summaries as though they were the same population.

The complete `scripts/host_plants/` build chain and any later supplements still need comparison against the published CSV hash before declaring a comprehensive current literature audit.

## 12. Species distribution models

### 12.1 The 155 versus 145 discrepancy

**Primary sources:** IM Git history for `public/data/sdm/species/`; release commit **`1cdde9bc8d5f4375def888b5796e71493ee60d68`**, **28 April 2026, 12:16:03 UTC**; raster directory tree `d6e23918cd93cc78cf8025709115aac1f8e9dede`; `public/data/sdm/sdm_metadata.json` (blob `1606f32ca572756a8715a3fb04f3b14079d76f91`); `sdm/05_export_predictions.py` (blob `760d2495a2f21ea14c5c23fe6eeb28289e799cea`).

The release history supports **145 species with a three-product raster release**, consistent with **435 .tif files**: a full projection, an accessible-area core and an extension per species. These are three products per species, not 435 separately modelled species.

The April 28 release removed **ten orphan ensembles lacking the corresponding accessible-area products**. This explains why a legacy 155-species metadata/statistics state can coexist with the 145-species served-file release. The 155 figure is not the correct count of complete species triplets in the checked raster release.

The ten removed names recorded by that release are: `Dryas_iulia`, `Heliconius_erato`, `Heliconius_numata`, `Heliconius_sara`, `Greta_dercetis`, `Hyalyris_oulita`, `Hypothyris_mansuetus`, `Napeogenes_peridia`, `Oleria_aegle`, and `Elzunia_bomplandii`. Their removal from this product release is not evidence that all associated historical model fits were scientifically invalid.

**Resolved count:** use **145 species with complete released raster products**, not 155, when describing the checked repository-backed SDM release. **Deployment qualification:** this audit did not make and verify all 435 live HTTP requests or fully exercise the current map's species picker. A stale metadata-driven menu may still advertise species without matching products; that behavior requires a focused application check. Do not say the audit confirmed every layer loading live.

### 12.2 Performance summaries: not resolved by changing the count

The old statistics report describes 155 models with confidence counts **65 high, 56 medium, 34 low**. It reports AUC mean **0.9021061224489796**, median **0.915**, range **0.569–1**, n = **147**, and continuous Boyce mean **0.5864962962962962**, median **0.6807**, range **−0.9972–1**, n = **135**. These are historical report values, **not verified summaries of the 145-species release**.

Another earlier April 28 release (`457a2170e60b6ad207a2c94a6440212da7525f18`) refers to a 143-species state. Its performance summary cannot be substituted for the later 145-species state either.

The exporter reads the model-results summary and writes metadata; it uses the maximum available algorithm cross-validation AUC, rounds to three decimals, and writes the stored best Boyce value, also rounded. Its missing-value handling can replace non-finite Boyce values with zero. Consequently, recomputing a mean from exported display values is not necessarily the same as averaging the underlying cross-validation metrics. The scientific methods must specify which quantity is summarized.

**UNRESOLVED:** correct high/medium/low counts and AUC/Boyce summaries for the exact 145 released species. Do not guess these by subtracting ten from a denominator, retain old means under the new count, or treat a missing-value sentinel as a measured zero.

Required resolution procedure: enumerate the 145 complete stem triplets; join them to the correct raw fit/validation summary by normalized species name; preserve missing metrics; report metric-specific n, confidence definitions and rounding; save a machine-readable receipt with input hashes. This was not executed here.

**Safe wording now:** “The checked SDM raster release provides full, accessible-area and extension products for 145 species.” Withhold aggregate validation statistics until the matching analysis is generated.

## 13. R/vector export

**Primary sources:** IM `src/utils/rExport.js`, blob `3451966891542a1664f1ddf0993cd9b629595d14`; `src/utils/rExport/rScriptGenerator.js`, blob `070be4d5c18abf41a6bf5ccc8cab503340917eb8`.

The browser constructs an export ZIP using `fflate`. It includes filtered butterfly-point GeoJSON, view configuration and legend information, `generate_map.R`, `map.html`, a README, and where applicable `range_polygons.geojson` and `basemap.png`. The point dataset is the filtered result set; it is not necessarily restricted to the current visible map viewport.

| Element | Export behavior supported by inspected source |
|---|---|
| Butterfly occurrence points | Exported as point data; R can render editable/vector point layers |
| Range polygons | Optional GeoJSON polygon data; can remain vector |
| Basemap | Captured/loaded as raster imagery; does not become vector just because the output container is SVG/PDF |
| SDM layers | No independently exported SDM GeoTIFF/vector data layer established in this ZIP path |
| Host-plant layers | No independent host-layer data export established in this ZIP path |
| Heatmaps | No independent vector heatmap export established |
| Other overlays visible during map capture | May be baked into the raster image, not preserved as individually editable scientific layers |

The capture code hides butterfly points, ranges and clusters while obtaining the basemap image. Other visible overlays can therefore be baked into the captured PNG. The R script initially tries a newly downloaded CartoDB.DarkMatter basemap via `maptiles`, with the exported PNG as fallback. Thus a successful fresh basemap download can omit overlays that existed only in the screenshot. Do not promise pixel-identical reproduction of every browser layer.

The inspected generated-script setup lists R dependencies including `sf`, `ggplot2`, `dplyr`, `tidyr`, `jsonlite`, `maptiles`, `tidyterra`, `ggspatial`, `grid`, `png`, and `stringr`, with installation logic. Network/package/system-library requirements remain relevant; the ZIP is not proven fully offline or dependency-free.

The script advertises PDF, SVG and PNG products. The complete final device/export section and a generated-file round trip were not verified in this audit. **UNRESOLVED:** exact device-level SVG/PDF behavior, fonts, transparency and portability for the generated script. The supported distinction is mixed vector/raster export, not a fully vector map.

**Safe wording:** “The export supplies occurrence and range data together with an R plotting script. Point and polygon layers can remain vector in suitable output formats, whereas basemaps and image-based overlays remain raster. Not all interactive map layers are exported as separate editable data.”

## 14. Figures and interface state

The current Gallery component and source tests explicitly distinguish paired collection evaluation from upload inference. Manuscript figures must preserve that distinction. A pipeline diagram must not put the 91.33% paired-collection benchmark beside an arbitrary uploaded photograph in a way that implies the latter was the evaluated input.

The July manuscript and archived figure-review discussions are historical baselines, not proof that proposed figures were generated, reviewed against current artifacts, or deployed. No new screenshots or figures were produced in this phase, and interface behavior was not tested across desktop/mobile.

For phase 2/3, bind every quantitative figure to one of: the frozen occurrence snapshot; the dated host artifact; the 145-species raster release; the September paired taxonomic evaluation; or the separate sex evaluation. Captions need the population, rank eligibility, geographic-prior condition and whether numbers are published results or regenerated analysis. Do not reuse old source-coverage bars, sequencing funnels or SDM confidence bars without checking their input hashes.

The archived July review mentions an updated Figure 1 placeholder and additional acknowledgments. Treat these as author/figure checks, not reasons to reconstruct the already recovered manuscript. Public-repository and deployment URLs should also be reconciled deliberately; a private working repository, a public mirror and a live app are different resources.

## 15. References needing verification

This phase did not complete a bibliographic audit. Do not turn assistant archive warnings into verified missing-reference claims.

| Reference / attribution | Required check before submission |
|---|---|
| BioCLIP 2.5-H | Cite the exact model release and appropriate primary paper; distinguish the checkpoint version from the title/version of the underlying BioCLIP publication. Preserve the model revision/hash separately from the citation. |
| Ultralytics segmenter | Confirm the actual checkpoint model family and matching software/version citation. Historical assistant unfamiliarity with YOLO26 is not evidence it is an internal or nonexistent model. |
| SAM 3 | Verify the actual mask-generation provenance first; then cite the matching primary method/version. Do not cite it merely because a later development chat mentions teacher masks. |
| CLIP-Adapter | Relevant as contextual inspiration for the IA custom residual adapter, not evidence that the Wings upload head contains that adapter. Do not label the Wings head CLIP-Adapter. |
| ArcFace / subcentre methods | Include only if the release-bound training config establishes their use. An old script filename is insufficient. |
| GBIF occurrence download | Preserve DOI `10.15468/dl.6zagkz` with the correct download/snapshot scope. |
| GBIF plant download | Preserve DOI `10.15468/dl.c7gyd2`; do not attribute alternative-source records to this DOI. |
| SDM methods and validation | Reconcile algorithm/CV/accessible-area/Boyce definitions to the exact served release before citing performance claims. |
| Manuscript citation completeness | The archived review flags McClure, Gauthier, van der Heijden and Ben Chehida as leads; verify against the actual recovered manuscript and bibliography rather than accepting that old assistant audit as fact. |
| Author names / dates / institutional tools | Check Doré spelling/year and the primary references/URLs for GoaT, Sanger/ToL, photography tools and Earthcape against original sources. |

## 16. Unresolved author-confirmation and evidence items

These items are not permission to invent fluent missing methods. They delimit what the writing phase may safely state.

| Priority | Open item | Evidence needed / decision |
|---|---|---|
| Blocking for complete classifier methods | Actual upload and paired checkpoint internals | Deserialize trusted checkpoints safely; record tensor shapes, input dimension, K, normalization, margin configuration, scale and calibration; tie each to SHA-256. |
| Blocking for deployment identity | Files actually loaded by the Space | Runtime/startup receipt with Space commit, resolved asset paths/hashes, encoder revision and environment overrides. |
| Blocking for training sample sizes | 58,165 eligible / 63,307 broader rows; source contributions | Release-bound training manifest, labels/exclusions and row/file/specimen counts. Reconcile duplicates and ambiguous labels. |
| Blocking for full taxonomic coverage statement | Exact named-subspecies/genus counts | Enumerate the released class map; separate species parents, species leaves, named subspecies, abbreviations and aliases. |
| Blocking for reproducible paired benchmark | Fold and eligibility manifests | CAMID-grouped split table, seeds, train-vocabulary handling, geography condition and per-rank OOF outputs; reproduce the published numbers. |
| Blocking for an upload-accuracy claim | Single-photo evaluation | A benchmark of the exact upload checkpoint and preprocessing, distinct from collection pairs and Insect AI. Otherwise omit upload accuracy. |
| Blocking for precise segmentation methods | YOLO family and SAM 3 provenance | Matching training config, mask-generation receipt and final artifact hash. Do not substitute v7 development for v3 upload history. |
| Blocking for SDM results | 145-species confidence/AUC/Boyce summaries | Exact released-stem join and metric-specific valid n, using raw metrics rather than missing-value sentinels. |
| Blocking for sequencing results | Category meaning, count units and current counts | Trace registered status, specimen/species aggregation and actual sequencing-completion evidence; author decision on misleading ToLID-derived label. |
| Important snapshot consistency | Occurrence tables | Rebuild tables from the 104,297-record frozen snapshot, or explicitly regenerate every dependent result from a new snapshot. |
| Important host consistency | 113 versus 116 butterfly species; raw versus mapped occurrence totals | Reconcile top-level and layer manifests against their CSV hash/build scripts; establish which host snapshot the manuscript describes. |
| Important sex qualification | Full support distribution and external validity | Enumerate all 1,586 outputs; do not reuse the 274/92 top-up counts as global counts; keep exploratory support separate from independent prospective validation. |
| Important export validation | SVG/PDF and omitted overlays | Run an actual export with SDM/host/heatmap toggled; inspect ZIP contents, generated R devices and rendered outputs. |
| Submission preparation | Figures, references and acknowledgments | Update against the selected module snapshots; verify primary references and resolve author placeholders. |

### Archive inspection and remaining context

The archive README and index were used to orient the audit. Targeted passages were read from the following IM sources: `docs/chat-transcripts/t3-code-ithomiini/search-ithomiini-maps-chat-history-eb7fad5d.md`; `docs/chat-transcripts/codex-ithomiini/summarize-ithomiini-maps-chats-019f3cdd.md`; `docs/chat-transcripts/claude-code-ithomiini/review-ithomiini-manuscript-and-figures-1d1ffc5c.md`; `docs/chat-transcripts/t3-code-wings/reconcile-gallery-taxonomy-corrections-9692496f.md`; `docs/chat-transcripts/t3-code-wings/plan-overnight-butterfly-classifier-work-a81155d1.md`; and `docs/chat-transcripts/t3-code-wings/update-wings-classifier-context-195a1f49.md`. These were not all exhaustively read. The IA report's classifier-method passages and the opening user instructions of its requested full-frame ecology transcript were also read.

Remaining targeted context includes IM `docs/chat-transcripts/t3-code-wings/update-wings-classifier-context-1afb5240.md`, `docs/chat-transcripts/t3-code-wings/audit-subspecies-image-datasets-5d7e3dd7.md`, and, where needed, the long `docs/chat-transcripts/codex-ithomiini/ithomiini-maps-manuscript-019dd1d3.md`. Use them to locate missing artifacts, not as substitutes for those artifacts. No assertion in this ledger that training/deployment occurred rests solely on an assistant transcript response.

### Handoff rule for the writing phase

Use VERIFIED code/artifact facts with their stated scope. Attribute published evaluation numbers to their precise collection protocol. Preserve UNRESOLVED items as explicit author checks or omit the unsupported detail. Do not collapse the single-photo head, paired collection head, sex head, Insect AI residual head, occurrence snapshot and SDM release into one supposedly uniform model/data state.
