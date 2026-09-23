# Phase 3A author actions

Date: 22 September 2026. These decisions are outside the manuscript text. The evidence ledger and Phase 2 scientific conclusions have not been reopened.

## Required author confirmation before submission

- [ ] **GBIF receipt.** Retrieve the GBIF citation/download receipt for DOI `10.15468/dl.6zagkz`. Confirm its creation date, query scope and contributing GBIF datasets, and supply the authoritative citation year. The selected butterfly DOI and frozen 9 May 2026, 104,297-record snapshot are retained. The DOI resolver could not be retrieved during this pass, so the bibliography uses `n.d.` rather than an invented date. The DOI refers to the GBIF component, not the whole merged snapshot or plant occurrences. Do not substitute a later download or unrelated counts.
- [ ] **Funding.** Franz, Patricio and Joana should confirm the funding bodies, grant numbers and any prescribed funding wording applicable to this toolkit manuscript. Funding from another paper has not been transferred into this manuscript.
- [ ] **Permits.** Confirm which collecting, research, specimen-transfer or other permits apply to the material described here and which must be cited. Supply exact identifiers and the appropriate section. No permit numbers have been inferred.
- [ ] **Contributors and institutions.** Confirm field, curation, photography, data-management and software contributors who should be acknowledged, including whether Joana or Patricio require additional institutional acknowledgements. The supported thanks to Neil Rosser, James Mallet, GBIF and its data publishers remain. Confirm contributor names and consent where relevant.
- [ ] **AI disclosure.** Confirm the target journal's required location and scope for disclosure. The current Acknowledgements describe use of OpenAI, Gemini and Claude coding assistants. This manuscript has also received AI-assisted text revision and reference checking. Decide the journal-compliant wording for that assistance and verify it with all authors. Do not present AI tools as authors or imply independent human verification that has not occurred.
- [ ] **Example camera metadata.** Supply the original `CAM077884v.jpg` or an exported EXIF record. The author's archive confirms the Canon EOS 550D, EF-S 18–55 mm f/4–5.6 IS STM lens and corrected approximate 28 cm working height. The 33 mm, 1/100 s, f/8, ISO 100 and manual-mode example is reported in the archived setup discussion, but could not be freshly checked against the image. Confirm these values and the reference point for measuring working height. The unsupported flash-off detail was removed. If the example cannot be confirmed, remove the example exposure sentence and table rows, not the supported general workflow.

## Assets for the supplementary protocol and Phase 3B

The textual S1 protocol is complete and usable without illustrations. The archive refers to setup images in an external local bundle under `ithomiini-gpt-pro-manuscript-protocol-20260520/images/Setup photos/`. Those referenced originals were not available among the inspected protocol materials. Supply authorised originals and credits for any illustrations chosen for submission:

- [ ] A wide view showing the camera support, imaging board and lighting arrangement.
- [ ] A close view showing wing positioning, CAMID label, ruler and colour reference.
- [ ] A view documenting the camera/lens and the working-height measurement.
- [ ] The example specimen image `CAM077884v.jpg` with its metadata.
- [ ] Current AI Photo Processor crop/grid and Review Results screenshots, with credentials hidden.
- [ ] A current `Photo Database Tools` / `Photo_links` example and Gallery `Update DB` screenshot if these are useful to the journal. Hide internal folder IDs, access tokens and unrelated specimen information.

Figure 1 was completed in Phase 3B. Figure 2 still requires authentic, authorised interface captures. Follow the exact [Figure 2 capture specification](figures/figure2_capture_spec.md), including view states, image rights, capture dates, source revisions and explicit identification of reference-image substitutions. Both manuscript captions are retained.

## Optional decisions, not blockers for the text phase

A Zenodo, Figshare or other formal archive requires an author decision and authorised deposit. No deposit or DOI was created. Existing immutable source commits are cited, and the Phase 3A commit can identify this textual submission state. A final archive can follow figure completion. Confirm repository and source-data access for reviewers without changing permissions merely to satisfy manuscript prose.

Runtime model receipts, release-matched training/evaluation manifests and checksummed environmental-input manifests would improve future reproducibility. They are not needed to add claims in this pass, and no new classifier or SDM audit was undertaken. A quantitative host-layer release likewise requires a separate reconciliation before its totals or plant-download DOI can be reported.
