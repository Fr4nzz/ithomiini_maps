#!/usr/bin/env python3
"""Apply the bounded Phase 3B figure integration to the exact Phase 3A source.

This is an idempotent, guarded production step, not a manuscript rewrite.
Unrecognised manuscript or validator edits cause a failure rather than being
silently overwritten. Scientific analyses and application code are not touched.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = '0cbf510b5de3afd99cd39729a297671afcfbd241'
BRANCH = 'manuscript/submission-ready-phase3b-20260922'
MANUSCRIPT_SHA = '428cebf4c931e10edf5f7138854cdffa02a745d000dde0e6a8f94c9126ae4ed3'
VALIDATOR_SHA = '4b2bcfc274291320368448e3a12696e6c1d499aa2bc161e903df47fb6c878020'
S1_SHA = 'd8cd641b1eb8bcd19165b218f1af88a94233469277feb3640dca23dde3f82245'
AUTHOR_SHA = 'd8184d9bbeec7d84abcab90dd2a278d66d8d1157c579dea1f1e3a415e1d90444'
IMAGE = '![Workflow showing reviewed specimen identifiers, separate upload and paired-collection classifiers, distinct Wings Atlas data types and separately versioned releases.](figures/figure1_workflow.svg)'

CAPTURE_SPEC = '''# Figure 2: required authentic interface captures

Status: not produced in Phase 3B. Retain the scientifically final manuscript caption. No mock interface, specimen photograph, candidate score or map layer has been substituted.

## Capture requirements shared by all panels

Use the current public applications in a normal browser. Capture at 1440 × 1000 CSS pixels or larger, with a device-pixel ratio of 2 where available. Save unmodified lossless PNG originals before assembling the panels. Use one consistent font scale. Keep controls needed to interpret the panel, source labels, legends and required map attribution. Close developer tools, About/benchmark sections, update controls and unrelated browser panels. Hide credentials, API keys, tokens, internal Drive identifiers and unrelated or sensitive specimen information. Select a specimen whose displayed locality may be published.

For each panel, record the application, exact URL including filter parameters, capture timestamp with timezone, displayed taxon and CAMID where applicable, active filters/layers, and source revision. Identify the deployed revision from its release/deployment record where possible. Do not equate a current repository head with the deployed revision without evidence. Record the inference-service/model receipt separately if exposed, otherwise mark it unavailable. Keep the manuscript's May occurrence, April SDM and September classifier releases unchanged. A later interface capture illustrates access, not a new result population.

For every photograph, record its original filename or asset URL, actual specimen identity, photographer/rights holder, publication permission or applicable licence, required credit and whether it is a reference image. Public display alone does not establish permission to reproduce a specimen photograph in a journal. Use an authorised project specimen or an explicit reusable demonstration image. Do not select a third-party reference photograph solely because it is visible in the Gallery.

## Panel a: specimen-linked dorsal and ventral views

Page: <https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/>.

Select **Collection**, clear unrelated filters, and search one author-authorised CAMID with verified dorsal and ventral photographs. Set the taxonomic filter to that specimen's species if needed. Display both surfaces at comparable scale, their side labels and the common CAMID, with enough Gallery controls to establish the collection view. Do not turn a duplicated single-view fallback into a pair. Record the selected CAMID and species in the panel metadata. A particular specimen is deliberately not prescribed without access and image-rights confirmation.

## Panel b: actual single-photo candidate output

Page: <https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/ai_identifier>.

Upload one authorised photograph, preferably one view of the specimen in panel a. Use the normal single-photo workflow, not a paired prediction file. Set country and side-of-Andes context to **Any** or their unset equivalents and leave inferred geographic context off, so the demonstration has no added locality prior. Run inference and wait for its actual response. Show the uploaded photograph, candidate taxonomic names and their displayed model scores, with the input/output interface context. Use the species-level candidate display where available. Preserve the returned ordering and score labels. Record the chosen image, filters and response time.

Do not expose the paired-collection About table, 91.33% benchmark, or collection sex-prediction results next to this upload. Do not fill an empty or failed response with examples. If inference is unavailable, retain this panel as pending rather than displaying invented output.

## Panel c: occurrence source and specimen identity

Page: <https://rapidspeciation.github.io/ithomiini_maps/>.

Use occurrence-point mode. Set source to **Sanger Institute collection** and search the panel-a CAMID when that specimen is mapped and its locality is cleared for publication. Otherwise choose another documented, authorised specimen and identify it explicitly in the metadata. Turn heatmaps, SDMs and host-plant occurrences off. Open the selected point's information panel. Retain the source identity, CAMID, taxon and specimen information, plus the linked photograph when it actually depicts that individual.

If the app substitutes another individual's reference image, retain the app's reference label and add an explicit panel/caption statement: 'Reference image of another individual'. Do not present it as a photograph of the mapped specimen. Do not alter the point's identity or source to fit an available photograph.

## Panel d: accessible-area core and extrapolated extension

Page: <https://rapidspeciation.github.io/ithomiini_maps/>.

Clear the CAMID filter. Select one butterfly species with both accessible-area core and extension products in the complete 28 April 2026 release. Prefer the panel-a species only when both products are available. Record the actual species selected. Leave all relevant butterfly occurrence sources enabled and use occurrence-point mode, with heatmaps and host-plant layers off.

Activate the SDM accessible-area/core product and its extrapolated extension, with distinguishable styling and visible layer legends. Use a map extent that shows observed points inside the core and part of the extension. If the interface permits only one product at a time, make two authentic captures at identical extent, zoom and opacity and assemble them as subviews within panel d, explicitly labelled 'Accessible-area core' and 'Extrapolated extension'. Preserve the suitability legend and observed-point symbols. Label the raster as relative habitat suitability, not occurrence probability. Hide unrelated diagnostics and unreconciled aggregate counts.

Host-plant occurrences are optional and are best omitted for this figure. If included, retain a separate plant-occurrence symbol and legend and identify them as independent botanical records, not local butterfly-host observations or SDM predictions.

## Assembly and acceptance

Use panel labels a–d and the existing Figure 2 caption. Store originals under `paper/figures/figure2_sources/`, a provenance JSON/CSV beside them, and the assembled figure at `paper/figures/figure2_interfaces.png` with an editable layout source where practical. Add its Markdown image reference immediately before the existing caption. Match panel contents to that caption and document capture dates/revisions in the caption or accompanying provenance. Do not place commit hashes over specimen details. Check all panel text at the intended journal width, image rights, colour/shape distinctions, map attribution and the absence of an upload-accuracy claim before treating Figure 2 as complete.

Phase 3B access evidence: the web fetcher returned DisabledError for all three public routes, and Chromium navigation returned net::ERR_BLOCKED_BY_ADMINISTRATOR for each. These are restrictions in the validation environment, not evidence that the public applications are down. A targeted repository screenshot search and the Gallery README did not establish a publication-ready, authorised four-panel set. No live inference response or specimen-image licence was fabricated.
'''

FIGURE_README = '''# Manuscript figures

## Figure 1

`figure1_workflow.svg` is the primary editable artwork. Text and shapes remain vector. Its intended width is 180 mm and its height is 194.25 mm. `figure1_workflow.png` is a 4320 × 4662-pixel, 600-dpi preview. Colours are restrained and supplemented by text labels and different outlines, so data types do not depend on colour alone.

Rebuild with:

```sh
python paper/figures/make_figure1.py --png
```

SVG generation uses the Python standard library. PNG rendering also needs CairoSVG and Pillow. No font files are distributed. The scientific source is the manuscript at Phase 3A commit `0cbf510b5de3afd99cd39729a297671afcfbd241`, not a new audit or experiment. Figure 1 contains no specimen photographs, reconstructed interfaces or performance estimates. Its six panels keep human review, upload inference, paired collection classification, Atlas data types and separate releases explicit.

## Figure 2

No Figure 2 asset is supplied. Its caption remains in the manuscript, without an internal drafting instruction or broken image reference. The exact remaining work is in [figure2_capture_spec.md](figure2_capture_spec.md). Actual application captures and image-rights confirmation are required.

`figure_provenance.json` records both figure states. Rendering and geometry checks concern layout only, not biological or model validation.
'''


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get_base(path: str, exported: Path | None, filename: str) -> bytes:
    if exported is not None:
        return (exported / filename).read_bytes()
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT)


def guarded_write(path: Path, old: str, new: str) -> None:
    current = path.read_text(encoding='utf-8')
    if current not in (old, new):
        raise SystemExit(f'Refusing to overwrite unrecognised edits in {path}')
    path.write_text(new, encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-dir', type=Path, help='Exact exported baseline files for local QA')
    args = parser.parse_args()
    paper = ROOT / 'paper'
    old_bytes = get_base('paper/manuscript.md', args.baseline_dir, 'phase3a_manuscript.md')
    assert digest(old_bytes) == MANUSCRIPT_SHA, 'Phase 3A manuscript byte identity'
    old = old_bytes.decode('utf-8')
    markers = re.findall(r'\[PHASE 3: FIG[12]\.[^\n]*\]\n\n', old)
    assert len(markers) == 2
    new = old.replace(markers[0], IMAGE + '\n\n').replace(markers[1], '')
    guarded_write(paper / 'manuscript.md', old, new)
    normalised = old.replace(markers[0], '').replace(markers[1], '')
    assert new.replace(IMAGE + '\n\n', '') == normalised
    assert digest((paper / 'supplementary_protocol_S1.md').read_bytes()) == S1_SHA

    validator_bytes = get_base('paper/validate_submission_text.py', args.baseline_dir, 'phase3a_validator.py')
    assert digest(validator_bytes) == VALIDATOR_SHA
    validator = validator_bytes.decode('utf-8')
    validator_new = validator.replace('Validate Phase 3A manuscript text', 'Validate final manuscript text and figure integration')
    validator_new = validator_new.replace('import hashlib\n', 'import hashlib\nimport json\nimport struct\nimport xml.etree.ElementTree as ET\n')
    old_marker_checks = '''    markers = re.findall(r"\\[PHASE 3: ([A-Z0-9]+)\\.[^\\n]*\\]", body)
    check(markers == ["FIG1", "FIG2"], "only FIG1 and FIG2 production markers remain")'''
    new_marker_checks = '''    check(not re.search(r"PHASE 3|\\b(?:FIG1|FIG2)\\b", body),
          "no internal figure-production markers remain")
    check(not re.search(r"^\\s*\\[(?:Insert|TODO|TBD|VERIFY|NEEDS|PHASE)\\b", body, re.M | re.I),
          "no square-bracketed drafting instructions")'''
    assert old_marker_checks in validator_new
    validator_new = validator_new.replace(old_marker_checks, new_marker_checks)
    extra = f'''    # Preserve all Phase 3A prose, bibliography and S1. Only figure production changed.
    image_line = {IMAGE!r}
    check(text.count(image_line) == 1, "exactly one accessible Figure 1 image reference")
    stripped = text.replace(image_line + "\\n\\n", "")
    check(hashlib.sha256(stripped.encode("utf-8")).hexdigest() == {digest(normalised.encode())!r},
          "all Phase 3A manuscript text unchanged apart from figure integration")
    check(hashlib.sha256((root / "supplementary_protocol_S1.md").read_bytes()).hexdigest() == {S1_SHA!r},
          "S1 byte-for-byte unchanged from Phase 3A")
    for number in (1, 2):
        check(body.count(f"**Figure {{number}}.**") == 1, f"one Figure {{number}} caption")
    figures = root / "figures"
    svg_path = figures / "figure1_workflow.svg"
    png_path = figures / "figure1_workflow.png"
    check(svg_path.is_file() and png_path.is_file(), "Figure 1 SVG and PNG exist at committed paths")
    svg = ET.fromstring(svg_path.read_bytes())
    ns = {{"s": "http://www.w3.org/2000/svg"}}
    check(svg.find("s:title", ns) is not None and svg.find("s:desc", ns) is not None,
          "Figure 1 has accessible title and description")
    check(not svg.findall(".//s:image", ns) and not svg.findall(".//s:script", ns),
          "Figure 1 is vector artwork without external images or scripts")
    svg_text = " ".join(svg.itertext())
    for label in ("HUMAN REVIEW", "Single-photo AI Identifier", "Separate paired-collection classifier",
                  "Supervised taxonomic classifier", "Independent plant occurrences",
                  "Predictions, not observations", "9 May 2026", "28 April 2026", "September 2026"):
        check(label in svg_text, "Figure 1 scientific label: " + label)
    check("91.33" not in svg_text and "%" not in svg_text,
          "Figure 1 does not attach collection accuracy to uploads")
    png = png_path.read_bytes()
    check(png[:8] == b"\\x89PNG\\r\\n\\x1a\\n" and struct.unpack(">II", png[16:24]) == (4320, 4662),
          "high-resolution PNG has expected dimensions")
    provenance = json.loads((figures / "figure_provenance.json").read_text(encoding="utf-8"))
    check(provenance["figure2"]["status"] == "pending-author-captures",
          "missing Figure 2 is explicitly recorded outside manuscript")
    check(not re.search(r"!\\[[^\\]]*\\]\\([^)]*figure2", body, re.I),
          "no missing Figure 2 image link")
    check((figures / "figure2_capture_spec.md").is_file(), "exact Figure 2 author capture specification exists")
    for row in ("| Named subspecies | 2,613 | 87.93% | 97.33% |",
                "| Species | 3,355 | 91.33% | 97.91% |",
                "| Genus | 3,806 | 95.55% | 99.26% |",
                "| Family | 3,824 | 99.32% | 99.90% |"):
        check(row in body, "exact paired benchmark row: " + row)
'''
    insert_before = '    print(f"SUMMARY: {len(keys)} reference keys, {len(dois)} unique DOI links. Structural checks passed.")'
    assert insert_before in validator_new
    validator_new = validator_new.replace(insert_before, extra + insert_before)
    guarded_write(paper / 'validate_submission_text.py', validator, validator_new)

    author_bytes = get_base('paper/phase3a_author_actions_20260922.md', args.baseline_dir, 'phase3a_author_actions.md')
    assert digest(author_bytes) == AUTHOR_SHA
    author = author_bytes.decode('utf-8')
    old_figure_status = 'Figure 1 and Figure 2 remain Phase 3B work. Their manuscript captions are retained. Capture dates and source revisions must accompany the actual interface panels, and any reference-image substitution must be identified.'
    new_figure_status = 'Figure 1 was completed in Phase 3B. Figure 2 still requires authentic, authorised interface captures. Follow the exact [Figure 2 capture specification](figures/figure2_capture_spec.md), including view states, image rights, capture dates, source revisions and explicit identification of reference-image substitutions. Both manuscript captions are retained.'
    assert old_figure_status in author
    guarded_write(paper / 'phase3a_author_actions_20260922.md', author, author.replace(old_figure_status, new_figure_status))

    figures = paper / 'figures'
    figures.mkdir(exist_ok=True)
    (figures / 'figure2_capture_spec.md').write_text(CAPTURE_SPEC, encoding='utf-8')
    (figures / 'README.md').write_text(FIGURE_README, encoding='utf-8')
    provenance = {
        'source_manuscript_commit': BASE,
        'figure1': {'status': 'complete', 'kind': 'editable scientific workflow',
                    'svg': 'paper/figures/figure1_workflow.svg', 'png': 'paper/figures/figure1_workflow.png',
                    'generator': 'paper/figures/make_figure1.py', 'external_images': [],
                    'module_dates': {'occurrences': '2026-05-09', 'sdm_products': '2026-04-28', 'classifier_gallery': '2026-09'}},
        'figure2': {'status': 'pending-author-captures', 'assets': [],
                    'capture_specification': 'paper/figures/figure2_capture_spec.md',
                    'reason': 'Browser access blocked in this environment and no publication-authorised four-panel asset set established. No live inference output or image permission invented.'}
    }
    (figures / 'figure_provenance.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
    subprocess.run(['python', str(figures / 'make_figure1.py'), '--png'], check=True, cwd=ROOT)
    print('Phase 3B integration complete. Phase 3A scientific prose and S1 are unchanged.')


if __name__ == '__main__':
    main()
