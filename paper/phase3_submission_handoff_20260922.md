# Phase 3 submission handoff: 22 September 2026

## Repository state

- Branch: `manuscript/submission-ready-20260922`.
- Verified starting branch: `manuscript/final-draft-20260921` at `3b2fee94d15c891952494f4a9074576febc12a00`. It had not moved.
- Final manuscript commit: [`e0cbc9422b3ea0c254a0a9988b20861dc70ebcdb`](https://github.com/Fr4nzz/ithomiini_maps/commit/e0cbc9422b3ea0c254a0a9988b20861dc70ebcdb), **Finalize submission-ready Ithomiini manuscript**. Subsequent handoff/PNG commits do not change the manuscript text.
- Manuscript SHA-256: `d6435bc526a950454e05bc0de97ce66b14ca7e3fd4e9b5814731aa258472e724`.
- No changes to `main`, application code, the Phase 1 evidence ledger or the Phase 2 handoff. Temporary Actions helpers and transfer parts are removed from the completed branch tree.

**Readiness:** the evidence-supported text, Figure 1 and textual S1 are complete. The submission must still wait for the authentic Figure 2 plate, the original GBIF download receipt and author approval of submission details. These are explicit actions in [the author checklist](phase3_author_actions_20260922.md), not hidden drafting markers.

## Reference audit

All 28 original entries were checked. The final bibliography has 38 cited entries in one alphabetical sequence, with no detected unmatched citation or orphan reference. Each entry has a verification source in `phase3_reference_records_20260922.json`. See `phase3_reference_audit_20260922.md` for the complete audit, primary sources and HTTP failures.

Added Ba et al. (2016), Beccaloni et al. (2008), Breiman (2001), Chen & Guestrin (2016), Costa (1999), Fick & Hijmans (2017), Karger et al. (2021), McClure & Elias (2016), Wahlberg (n.d.) and Wilson & Jetz (2016). Corrected elapid authorship/year to Anderson (2023), Chazot to 2016, Rosser & Mallet pagination, Valavi's issue year/article number and the Butterflies of America author list/version. Updated BioCLIP to the NeurIPS publication plus its distinct 2026 model DOI, and Ultralytics to its general software citation. Checked Doré's accent and authors. The older McClure et al., Gauthier, van der Heijden and Ben Chehida citations were already absent from Phase 2 and were not restored as orphans.

Environmental sources are now specific: CHELSA v2.1, 1981–2010, 30 arc seconds, Karger et al. (2021), DOI `10.16904/envidat.228`. Elevation follows the executed WorldClim v2.1 downloader, not the conflicting CGIAR label, with Fick & Hijmans (2017), DOI `10.1002/joc.5086`. Cloud frequency is EarthEnv Global 1-km Cloud Frequency version 1, with Wilson & Jetz (2016), DOI `10.1371/journal.pbio.1002415`. These identify configured sources, not historical input-byte checksums.

## Figures and supplementary protocol

**Figure 1:** final editable `figures/figure1_workflow.svg`, generator `figures/make_figure1.py` and 3,100 × 3,325 PNG preview. Six panels separate photography, Gallery, uploaded-image inference, paired-collection inference, Atlas integration and component versions. The manuscript links the SVG. No specimen photographs or simulated interface captures were used.

**Figure 2:** final caption, no fabricated plate and no broken image path. The author checklist specifies the four real captures, filenames, authorised images, full revisions, capture timestamps, filters and source-data releases. The reading copy explicitly identifies the missing plate.

**S1:** `supplementary_protocol_S1.md` is complete as a textual protocol. It covers the project camera/setup example, both wing surfaces, CAMID/colour reference, batch organisation, configurable processor use, review, d/v renaming, shared storage, current Apps Script/Sheets menu actions, Gallery update and acceptance checks. Unverified exposure settings were removed. Optional original setup photographs are requested by exact filenames. Software instructions were checked against source/documentation, not by executing a new live database update.

## Data Availability and acknowledgements

Verified source/deployment/model destinations are distinguished, including the processor browser application's HTTP 200 receipt. The invalid full Hugging Face Space source SHA was corrected to `3aa72a33946f2da661d1ed96f0929e92cd9413e6`. The Gallery root works, but direct `ai_identifier` HTTP access returned 404, so the manuscript identifies tab navigation without asserting a successful deep link.

Public visibility does not establish licences. The toolkit-wide description is now **source-available**. No visibility setting or licence was changed. Model/source availability does not imply redistribution rights to third-party images. No release tag, Zenodo deposit or new DOI was created. The authors should archive the approved submission after settling rights and the final plate.

The project-recorded butterfly GBIF DOI `10.15468/dl.6zagkz` returned 404 in resolver/registry checks. It remains explicitly qualified, without a replacement DOI, invented bibliography entry or change to the frozen 104,297-record snapshot. Its original receipt and scope require confirmation before submission.

Acknowledgements retain Neil Rosser, James Mallet, GBIF and its data publishers. AI assistance includes manuscript preparation as well as software development. No funding, permit or contributor information was invented. Authors must approve funding/permits, contributors, competing interests, title-page details and the journal-specific disclosure location.

## Scientific consistency and remaining reproducibility limits

Phase 2's architecture, supervised versus zero-shot distinction, separate upload and paired workflows, rank-specific evaluation denominators, 91.33% paired species accuracy, modest geographic effects, selected sex cohort, 145-species SDM release, non-quantitative host treatment, sequencing caution and mixed vector/raster export remain intact.

Targeted SDM checks corrected the small-sample tier to 20–49 records. The manuscript now states that its AUC/Boyce summaries use the full fit, despite collection of leave-one-out predictions. No held-out aggregate performance is inferred. Conditional coastline filtering and tuning/default selection are described more narrowly. Details are in `phase3_method_checks_20260922.md`.

Optional enhancements remain runtime-loaded model receipts, matched training/evaluation manifests and fold assignments, historical environmental input hashes and any later host-layer reconciliation. They do not block the current narrower text. No experiments, raster fitting or occurrence rebuilds were run.

## Validation and reading copies

Pandoc **3.1.11.1** successfully generated standalone HTML for the manuscript and S1, both locally and on the GitHub runner. The committed HTML files match the locally inspected copies byte-for-byte. `paper/tools/` contains regeneration and validation scripts. Desktop 1,440 px and narrow 390 px checks passed for both documents, with no horizontal overflow, broken tables, missing SVG, replacement characters or internal Phase 3 instructions. The SVG marker-reference issue introduced by Pandoc embedding was repaired in the renderer.

The main text contains no em dashes or semicolons. Published reference-title punctuation and spelling are preserved. Figure paths, 38 references, two tables, scientific invariants and protected-source hashes passed. `git diff --check` passed before commit and against the original baseline. Final runner [35742512497](https://github.com/Fr4nzz/ithomiini_maps/actions/runs/35742512497) completed successfully, committed and pushed the manuscript, and returned a clean tracked worktree. All 16 transferred text files matched the reviewed package exactly after download.

Reading copies: `reading_copies/manuscript.html` and `reading_copies/supplementary_protocol_S1.html` are committed. Chromium PDF reading copies were also produced and visually checked, 17 manuscript pages and five S1 pages, and supplied with the conversation download package. No DOCX was produced. PDF/HTML rendering validates presentation, not the scientific experiments or author permissions.
