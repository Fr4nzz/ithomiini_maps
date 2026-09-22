# Phase 3A text handoff

Date: 22 September 2026. Branch: `manuscript/submission-text-20260922`.

The starting branch `manuscript/final-draft-20260921` was verified at `3b2fee94d15c891952494f4a9074576febc12a00` before the new branch was created. The locally reconstructed baseline manuscript was checked against Git blob `f01cb342794f3096a6ec985fbf42dca07831fcce` and its Phase 2 SHA-256. The Phase 1 evidence ledger and Phase 2 handoff remain unchanged.

## Delivered text

- `manuscript.md`: submission-text cleanup with the two figure-production markers retained.
- `supplementary_protocol_S1.md`: photography, identifier review, filename conventions, shared storage, indexing, Gallery updating and failure checks.
- `phase3a_reference_audit_20260922.md`: entry-by-entry bibliographic decisions, primary sources and targeted provenance checks.
- `phase3a_author_actions_20260922.md`: author confirmations and optional assets, outside the manuscript.
- `validate_submission_text.py`: repeatable citation, style, marker and protected-text checks.

## References and environmental sources

The bibliography audit covered all 28 original entries and produced 39 cited entries in one alphabetical sequence. Eleven sources were added: McClure, Gauthier, van der Heijden, Ben Chehida, Beccaloni, Costa, Karger, Fick & Hijmans, Wilson & Jetz, GBIF.org and Wahlberg. Major corrections concern Anderson (2023) for elapid, Chazot (2016), Rosser & Mallet's issue/pages, Valavi's 2022 issue year and article identifier, and the Butterflies of America citation. Missing DOIs and published title spellings were corrected. Undated software documentation has access dates rather than founding-year dates.

The downloader identifies CHELSA v2.1, 1981–2010, nine bioclimatic layers at 30 arc seconds, WorldClim v2.1 SRTM-derived elevation at 30 arc seconds, and EarthEnv Global 1-km Cloud Frequency v1, mean annual. The elevation download path overrides the misleading configuration label. These are intended input products, not newly checksummed historical rasters.

The selected butterfly DOI `10.15468/dl.6zagkz` and frozen 9 May 2026 snapshot are unchanged. Its external receipt could not be retrieved. The bibliography uses `n.d.` pending the author's original GBIF citation and query metadata. This remaining verification is explicit in the audit and action file. No later download, source breakdown or plant DOI was substituted.

## Protocol, availability and acknowledgements

S1 uses the current browser workflow, not obsolete desktop instructions or historical API quotas. Project equipment is distinguished from configurable settings and recommendations. The original example photograph was unavailable for fresh EXIF inspection. Its archived exposure settings remain explicitly an example, and author confirmation is requested. The unsupported flash-off detail was removed. No setup images or screenshots were fabricated.

Data Availability separates source code, public interfaces, model assets, restricted source records and third-party image rights. Existing Git commits identify immutable source versions. The commit containing this handoff identifies the Phase 3A text state. No formal DOI archive was created. Repository instructions verify destinations that the web fetcher could not open. No end-to-end inference or application update was tested.

Acknowledgements retain the supported thanks to Neil Rosser, James Mallet, GBIF and its publishers, and the existing coding-assistant disclosure. Funding, permits, additional contributors, institutional wording, camera metadata and journal-specific AI disclosure require author confirmation. Runtime model receipts, release-matched manifests, environmental-input hashes and a formal archive are optional improvements, not a restarted scientific audit.

## Markers and scientific consistency

Removed `S1`, `DATA1` and `ACK1` agent-instruction blocks. Only `FIG1` and `FIG2` remain, with their Phase 2 captions unchanged. Their production belongs to Phase 3B.

The uploaded-photo and paired-collection classifiers, score interpretation, geographic reweighting, all benchmark values, sex-prediction scope, frozen occurrence snapshot, 145-species SDM release, host-plant caution, sequencing caution and mixed vector/raster export interpretation are preserved. No application code or evidence-ledger file was changed.

## Validation

The text validator passed 219 checks: 39 citation keys, 27 unique DOI links, bidirectional citation coverage, alphabetical order, URL/DOI syntax, punctuation, British-spelling screen, unchanged headings, S1 linkage, marker restrictions and protected scientific blocks. The complete manuscript diff and new supporting files were reviewed. `git diff --check` passed.

Pandoc 3.1.11.1 rendered the manuscript and S1 to standalone HTML5 with `--fail-if-warnings`, with no warnings. Chromium/Playwright inspected the rendered HTML at 1280-pixel and 650-pixel widths without horizontal overflow. The manuscript has 35 headings and two tables. S1 has 13 headings and two tables. Abstract, photography Methods, SDM Methods, Data Availability, Acknowledgements, References and S1 layouts were visually inspected. The S1 callout target exists. Browser navigation to local files was restricted, so HTML was loaded directly for layout inspection, not represented as a successful network-navigation test.

A repository-only rendering is:

```sh
python paper/validate_submission_text.py
pandoc paper/manuscript.md --standalone --fail-if-warnings \
  --metadata pagetitle='Ithomiini Maps manuscript' --metadata lang=en-GB \
  -o /tmp/ithomiini-manuscript.html
pandoc paper/supplementary_protocol_S1.md --standalone --fail-if-warnings \
  --metadata pagetitle='Supplementary Protocol S1' --metadata lang=en-GB \
  -o /tmp/ithomiini-protocol-S1.html
```

The QA rendering used local CSS and a local link remapping for the separately rendered S1. Those QA assets are not application changes. Rendering validates formatting, not experiments, dataset completeness, live model identity or scientific performance.
