#!/usr/bin/env python3
"""Build Figure 1 as editable SVG, with an optional high-resolution PNG.

Scientific content is limited to the Phase 3A manuscript. No specimen images,
interface reconstructions or performance estimates are included.
Run: python paper/figures/make_figure1.py --png
"""
from __future__ import annotations

import argparse
from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1440, 1554
INK = "#202e37"
LINE = "#50616b"
BLUE = "#285e78"
GREEN = "#386356"
AMBER = "#986119"


def make_svg() -> str:
    parts: list[str] = []
    add = parts.append

    def rect(x: float, y: float, w: float, h: float, fill: str = "#ffffff",
             stroke: str = LINE, weight: float = 1.5, dash: str = "") -> None:
        dashed = f' stroke-dasharray="{dash}"' if dash else ""
        add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{weight}"{dashed}/>')

    def text(x: float, y: float, lines: str | list[str], size: float = 24,
             bold: bool = False, anchor: str = "start", fill: str = INK,
             leading: float = 29) -> None:
        if isinstance(lines, str):
            lines = [lines]
        add(f'<text x="{x}" y="{y}" font-family="Arial, Liberation Sans, Helvetica, sans-serif" '
            f'font-size="{size}" font-weight="{700 if bold else 400}" '
            f'text-anchor="{anchor}" fill="{fill}">')
        for i, line in enumerate(lines):
            add(f'<tspan x="{x}" dy="{0 if i == 0 else leading}">{escape(line)}</tspan>')
        add('</text>')

    def panel(key: str, title: str, x: int, y: int, w: int, h: int) -> None:
        add(f'<g id="panel-{key}" aria-label="{escape(title)}">')
        rect(x, y, w, h, stroke="#85939b", weight=1.5)
        text(x + 20, y + 36, f'{key}  {title}', 27, True)
        add('</g>')

    def node(key: str, x: int, y: int, w: int, h: int, lines: list[str],
             size: float = 24, fill: str = "#f5f8fa", stroke: str = BLUE,
             bold: bool = False, weight: float = 1.7) -> None:
        add(f'<g class="node" id="{key}">')
        rect(x, y, w, h, fill, stroke, weight)
        leading = size + 5
        baseline = y + h / 2 - (len(lines) - 1) * leading / 2 + size * 0.34
        text(x + w / 2, baseline, lines, size, bold, "middle", leading=leading)
        add('</g>')

    def arrow(x1: int, y1: int, x2: int, y2: int) -> None:
        add(f'<path d="M {x1} {y1} L {x2} {y2}" fill="none" stroke="{LINE}" '
            'stroke-width="2" marker-end="url(#arrow)"/>')

    add(f'<svg xmlns="http://www.w3.org/2000/svg" width="180mm" height="194.25mm" '
        f'viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="figure-title figure-desc">')
    add('<title id="figure-title">Specimen digitisation, separate taxonomic classifiers and Wings Atlas</title>')
    add('<desc id="figure-desc">A: visible specimen identifiers are read, reviewed by a person, '
        'renamed by wing surface and indexed in shared storage. B: reviewed collection photographs '
        'support specimen-linked browsing and taxonomic review in Wings Gallery. C: one uploaded '
        'photograph is localised and cropped, encoded with frozen BioCLIP 2.5-H and classified by '
        'a supervised taxonomic classifier. Optional geography follows classification. '
        'D: verified dorsal and ventral views form a 2,048-dimensional representation for a distinct '
        'fitted collection classifier and precomputed predictions. E: butterfly occurrence records '
        'and annotations, independent plant occurrences and modelled relative habitat suitability '
        'are distinct Wings Atlas inputs. F: occurrence, SDM and classifier releases are versioned '
        'separately. No collection accuracy is attributed to uploaded photographs.</desc>')
    add(f'<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" '
        f'markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" '
        f'fill="{LINE}"/></marker></defs>')
    rect(0, 0, WIDTH, HEIGHT, stroke="none")

    panel('A', 'Specimen photography and reviewed identifiers', 24, 24, 1392, 204)
    xs = [44, 320, 596, 872, 1148]
    rows = [
        ['Specimen / wing photos', 'Visible identifier', '(CAMID)'],
        ['AI Photo Processor', 'Read visible identifier'],
        ['HUMAN REVIEW', 'Confirm CAMID + side', 'Check flagged records'],
        ['Renamed photographs', 'Dorsal d / ventral v'],
        ['Shared image storage', 'Reviewed, indexed files'],
    ]
    for i, (x, lines) in enumerate(zip(xs, rows)):
        node(f'A{i+1}', x, 85, 244, 108, lines, 21.5,
             fill='#fff3da' if i == 2 else '#f5f8fa',
             stroke=AMBER if i == 2 else BLUE, bold=i == 2,
             weight=2.5 if i == 2 else 1.7)
        if i < 4:
            arrow(x + 248, 139, xs[i+1] - 6, 139)
    text(720, 214, 'Identifier readings are checked before final renaming.', 22, anchor='middle')

    panel('B', 'Wings Gallery collection workflow', 24, 248, 1392, 160)
    node('B1', 44, 310, 375, 70, ['Reviewed collection', 'photographs (A)'])
    node('B2', 533, 310, 376, 70, ['Indexed Wings Gallery'])
    node('B3', 1021, 310, 375, 70, ['Specimen-linked browsing', 'and taxonomic review'])
    arrow(425, 345, 526, 345)
    arrow(915, 345, 1014, 345)

    panel('C', 'Single-photo AI Identifier', 24, 428, 684, 520)
    node('C1', 48, 488, 636, 54, ['One uploaded photograph'])
    node('C2', 48, 565, 636, 64, ['Wing / butterfly localisation', 'Padded RGB crop or full-image fallback'])
    node('C3', 48, 652, 636, 64, ['Frozen BioCLIP 2.5-H', '1,024-dimensional image representation'])
    node('C4', 48, 739, 636, 64, ['Supervised taxonomic classifier', 'LayerNorm + L2-normalised cosine, scale 30'])
    node('C5', 48, 826, 636, 64, ['Ranked taxonomic candidates', 'Finest-rank scores → rank aggregation'])
    for y1, y2 in [(545, 559), (632, 646), (719, 733), (806, 820)]:
        arrow(366, y1, 366, y2)
    text(366, 915, 'Optional geography re-ranks candidates after classification.', 20, anchor='middle')
    text(366, 939, 'Paired-collection accuracy does not apply to this path.', 20, anchor='middle')

    panel('D', 'Separate paired-collection classifier', 732, 428, 684, 520)
    node('D1', 756, 488, 298, 74, ['Verified dorsal', 'photograph'])
    node('D2', 1094, 488, 298, 74, ['Verified ventral', 'photograph'])
    text(1074, 535, '+', 32, True, 'middle')
    add(f'<path d="M 905 565 L 905 580 L 1243 580 L 1243 565" fill="none" stroke="{LINE}" stroke-width="2"/>')
    arrow(1074, 580, 1074, 594)
    node('D3', 756, 600, 636, 92, ['Combined dorsal/ventral representation', 'Two frozen 1,024-feature image representations', 'Concatenated to 2,048 features'], 23)
    arrow(1074, 696, 1074, 716)
    node('D4', 756, 722, 636, 64, ['Distinct fitted collection classifier'])
    arrow(1074, 790, 1074, 820)
    node('D5', 756, 826, 636, 64, ['Precomputed collection predictions', 'Separate release for Wings Gallery'])
    text(1074, 915, 'The paired benchmark uses verified specimens (Table 2).', 20, anchor='middle')
    text(1074, 939, 'Single-view fallbacks are not observed pairs.', 20, anchor='middle')

    panel('E', 'Wings Atlas: observations, annotations and predictions', 24, 968, 1392, 386)
    cards = [(44, 429, BLUE, ''), (506, 429, GREEN, '7 4'), (968, 428, LINE, '2 4')]
    for i, (x, w, colour, dash) in enumerate(cards):
        add(f'<g class="card" id="E{i+1}">')
        rect(x, 1028, w, 224, '#ffffff', colour, 2, dash)
        add('</g>')
    text(64, 1065, 'Butterfly records + annotations', 24, True)
    text(64, 1104, ['Observed occurrence data', 'Taxonomic curation', 'Mimicry-ring information',
                     'Recorded genomic-sampling status'], 22, leading=34)
    text(526, 1065, 'Host-plant information', 24, True)
    text(526, 1104, ['Literature associations', 'Independent plant occurrences'], 22, leading=34)
    text(526, 1192, ['Plant records do not establish', 'local butterfly-host use.'], 21, leading=28)
    text(988, 1065, 'Species distribution models', 24, True)
    text(988, 1104, ['Relative habitat suitability', 'Accessible-area core', 'Extrapolated extension'], 22, leading=34)
    text(988, 1220, 'Predictions, not observations', 21)
    for x in [258, 720, 1182]:
        arrow(x, 1256, x, 1278)
    node('E4', 44, 1284, 1352, 46, ['Wings Atlas: specimen, taxonomic and geographic context'],
         24, fill='#eef3f5', stroke=LINE, bold=True)

    panel('F', 'Separately versioned data and model releases', 24, 1376, 1392, 154)
    for x, heading, date in [
        (44, 'Occurrence snapshot', '9 May 2026'),
        (506, 'SDM product release', '28 April 2026'),
        (968, 'Classifier / Gallery release', 'September 2026'),
    ]:
        text(x, 1455, heading, 23)
        text(x, 1497, date, 27, True)
    add('</svg>')
    return '\n'.join(parts) + '\n'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--png', action='store_true', help='Also render 4320 × 4662 PNG at 600 dpi')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    svg = make_svg()
    (OUT / 'figure1_workflow.svg').write_text(svg, encoding='utf-8')
    if args.png:
        import cairosvg
        from PIL import Image
        png = OUT / 'figure1_workflow.png'
        cairosvg.svg2png(bytestring=svg.encode('utf-8'), write_to=str(png), output_width=4320, output_height=4662)
        with Image.open(png) as image:
            image.save(png, dpi=(600, 600))
    print(OUT / 'figure1_workflow.svg')


if __name__ == '__main__':
    main()
