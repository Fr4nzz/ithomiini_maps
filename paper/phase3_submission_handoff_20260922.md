# Final submission handoff: Phase 3B

Date: 22 September 2026 (Ecuador). Validation ran on 23 September UTC.

## Release identity

Final branch: `manuscript/submission-ready-phase3b-20260922`.

Starting Phase 3A commit: `0cbf510b5de3afd99cd39729a297671afcfbd241`, verified before editing. The pre-existing `manuscript/submission-ready-20260922` branch diverged before Phase 3A and was left untouched. `main` was not modified.

Final validated manuscript/figure commit: `e06e8fd259b7cd92b8826786e1ff5f2f688e3515` (`Finalize manuscript figures and submission package`). This handoff is the following documentation-only commit. Its identifier, and therefore the final branch head at delivery, is resolved by `git log -1 --format=%H -- paper/phase3_submission_handoff_20260922.md` and is reported in the delivered package.

## Manuscript text complete

`paper/manuscript.md` retains the Phase 3A scientific text, bibliography, Data Availability and Acknowledgements. Its only changes are the Figure 1 image reference and removal of the two internal figure-production instructions. Both captions remain unchanged. No broken Figure 2 image reference is inserted. The Figure 2 caption is retained for production, not presented as evidence that its panels exist.

The alphabetical bibliography remains at 39 references and 27 unique DOI links, with bidirectional citation matching. The Phase 3A bibliography audit was not repeated. The GBIF citation remains undated pending the original receipt. Data Availability still distinguishes code, public interfaces, model assets, restricted source records and third-party image rights. No archive DOI or permissions change was made.

`paper/supplementary_protocol_S1.md` is byte-for-byte unchanged from Phase 3A. It is complete as a textual protocol. Its optional illustrations were not fabricated. The two S1 source-document links and the manuscript-to-S1 link are remapped only in the reading copies, not in either Markdown source.

## Visual assets

**Figure 1 is complete and integrated.** Primary editable artwork: `paper/figures/figure1_workflow.svg`. High-resolution preview: `paper/figures/figure1_workflow.png` (4320 × 4662 pixels, 600 dpi). Generator: `paper/figures/make_figure1.py`. Intended artwork width: 180 mm. Text and shapes remain vector in the SVG, with an accessible title, description and manuscript alt text.

The six panels explicitly separate human identifier review, Gallery browsing, uploaded-photo inference, paired collection classification, Atlas observations/context/predictions and separately dated releases. No paired benchmark percentage is attached to the upload path. No specimen photographs, generated interface images or new scientific estimates are included.

**Figure 2 remains an author production requirement.** No Figure 2 image file is supplied. Web access was disabled and local browser navigation to all three public routes was administratively blocked in this environment. Repository checks did not establish an authorised, publication-ready panel set. These limitations do not establish that the public services are unavailable. No live candidate response, capture date, deployment identity or image permission was invented.

The exact production specification is [figures/figure2_capture_spec.md](figures/figure2_capture_spec.md). It gives URLs, filters, specimen and image requirements, layers, items to hide, attribution and revision/capture metadata. The required panels are:

- Gallery Collection: a publication-authorised, verified dorsal/ventral pair with the same visible CAMID and side labels.
- AI Identifier: one authorised photograph and its actual live ranked output, with geography unset for the demonstration and no paired-collection accuracy annotation.
- Atlas occurrences: source identity and a selected specimen record, with an actual linked photograph or an explicitly labelled image from another individual.
- Atlas SDM: a species with complete core and extension products, observed butterfly points, distinct core/extension interpretation and relative-suitability legends. Leave plant layers off unless independently symbolised and explained.

`paper/figures/figure_provenance.json` records Figure 1 as complete and Figure 2 as pending author captures. Supply Figure 2, integrate its stable image path and update the figure checks before submitting the illustrated manuscript.

## Author confirmations still required

Retain [phase3a_author_actions_20260922.md](phase3a_author_actions_20260922.md). Only its figure-status paragraph changed. All original unresolved items remain: the GBIF download receipt and citation year, funding and grant wording, applicable permits, contributor/institutional acknowledgements and consent, journal-specific AI disclosure, and the original `CAM077884v.jpg` EXIF/working-height confirmation. No answers were inferred.

Optional S1 setup photographs and interface screenshots, a formal archive deposit, release-matched manifests and runtime/environmental-input receipts are not new blockers created by this phase. Their necessity depends on author and journal requirements. Confirm reviewer access to the cited resources without changing access permissions merely to make a claim true.

## Validation and reading copies

The strengthened `paper/validate_submission_text.py` passes 246 checks. It retains the original scientific, citation and style checks and adds whole-Phase-3A text identity, unchanged S1, figure-file existence, SVG accessibility, PNG dimensions, exact benchmark rows and explicit Figure 2 status checks. This protects the upload/paired distinction, geographic effects, sex-prediction scope, occurrence snapshot, 145-species raster release, host-plant caution, sequencing interpretation and mixed vector/raster export wording without repeating their audits.

Pandoc 3.1.11.1 rendered both documents as standalone HTML with `--fail-if-warnings`, without warnings. Chromium checks at 1280 and 650 pixels found no horizontal overflow, clipped diagram labels or unloaded figure images. The manuscript has 35 headings, two tables and one supplied figure. S1 has 13 headings and two tables. Internal and reading-copy links were checked. Network reachability of every external URL or DOI was not retested.

Visual inspection covered the title/abstract, Figure 1 and caption, classifier Methods, benchmark table, Atlas Methods, Conclusions, Data Availability, Acknowledgements, References, narrow-screen opening and PDF page layouts. `git diff --check` passed. Scientific prose, captions, bibliography, S1 and the Phase 1 ledger were not rewritten.

Reading copies are in `paper/reading_copies/`: `manuscript.html`, `manuscript.pdf`, `supplementary_protocol_S1.html` and `supplementary_protocol_S1.pdf`. The committed PDF reading copies contain 16 and five pages respectively. These are reading copies, not a target-journal template. Rendering validates layout, not experimental results, live inference, image rights or deployment identity.

Reproduce from a full checkout with:

```sh
python paper/validate_submission_text.py
python -m pip install -r paper/tools/requirements-reading.txt
python -m playwright install chromium
python paper/tools/render_submission.py --pdf --screenshots
```

Pandoc 3.1.11.1 and Cairo are required separately. Regenerate Figure 1 with `python paper/figures/make_figure1.py --png`. The full-checkout run of `python paper/validate_submission_text.py`, Pandoc, layout checks, protected-file checks and non-forced push all passed in [GitHub Actions run 35809174665](https://github.com/Fr4nzz/ithomiini_maps/actions/runs/35809174665). Its downloaded artifact matched the locally inspected manuscript, validator, SVG and both HTML copies byte-for-byte. The committed PNG and PDF outputs were inspected separately. The temporary build workflow was removed from the final tree. Layout results are in `paper/validation/phase3b_layout_validation.json`, with file hashes and protected-source checks in `paper/validation/phase3b_package_validation.json`. The implementation helper `paper/tools/finalise_phase3b.py` is baseline-guarded and is not intended to overwrite subsequent author revisions.

## What still prevents actual journal submission

The manuscript text and Figure 1 package are complete for this phase. The intended illustrated submission still needs authentic, authorised Figure 2 panels and the required author confirmations above. Final journal formatting, author approval and submission-system requirements remain author responsibilities. Optional S1 illustrations or a new scientific audit are not prerequisites for using this handoff.
