#!/usr/bin/env python3
"""Render standalone reading copies and inspect their browser layout.

Requires Pandoc, Beautiful Soup and Playwright with Chromium. PDF is optional.
The browser is fed rendered HTML directly, with no live data or inference calls.
Only reading-copy links are remapped. Manuscript and S1 source are not changed.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import platform
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PAPER = ROOT / 'paper'
OUT = PAPER / 'reading_copies'
QA = PAPER / 'validation'
BASE = '0cbf510b5de3afd99cd39729a297671afcfbd241'


def render(source: str, title: str) -> Path:
    output = OUT / f'{Path(source).stem}.html'
    subprocess.run([
        'pandoc', str(PAPER / source), '--from=markdown-implicit_figures', '--to=html5',
        '--standalone', '--embed-resources', '--fail-if-warnings',
        f'--resource-path={PAPER}', f'--css={PAPER / "tools/reading.css"}',
        f'--metadata=pagetitle:{title}', '--metadata=lang:en-GB', '-o', str(output),
    ], check=True, cwd=ROOT)
    soup = BeautifulSoup(output.read_text(encoding='utf-8'), 'html.parser')
    assert soup.body is not None
    first_p = soup.body.find('p', recursive=False)
    if source == 'manuscript.md' and first_p is not None:
        first_p['class'] = ['manuscript-title']
    image = soup.find(id='figure-1') or soup.find('svg') or soup.find('img')
    if image is not None and image.name == 'svg':
        # Pandoc may prefix SVG IDs without rewriting marker/ARIA references.
        # Embed the original SVG bytes to preserve arrows, aspect ratio and labels.
        original = (PAPER / 'figures/figure1_workflow.svg').read_bytes()
        replacement = soup.new_tag('img', attrs={
            'id': 'figure-1', 'alt': image.get('alt', 'Specimen digitisation and distinct classifier workflows'),
            'src': 'data:image/svg+xml;base64,' + base64.b64encode(original).decode('ascii'),
            'style': 'width:100%',
        })
        image.replace_with(replacement)
        image = replacement
    if image is not None:
        paragraph = image.parent
        caption = paragraph.find_next_sibling('p')
        assert caption and caption.get_text().startswith('Figure 1.')
        wrapper = soup.new_tag('div', attrs={'class': 'figure-block', 'id': 'figure-1-block'})
        paragraph.insert_before(wrapper)
        wrapper.append(paragraph.extract())
        caption['class'] = ['figure-caption']
        wrapper.append(caption.extract())
    for table in list(soup.find_all('table')):
        caption = table.find_previous_sibling('p')
        if caption and caption.get_text().startswith('Table '):
            wrapper = soup.new_tag('div', attrs={'class': 'table-group'})
            caption.insert_before(wrapper)
            wrapper.append(caption.extract())
            wrapper.append(table.extract())
    remapped = []
    for link in soup.find_all('a', href=True):
        href = link['href']
        if href == 'supplementary_protocol_S1.md':
            link['href'] = 'supplementary_protocol_S1.html'
            remapped.append({'from': href, 'to': link['href']})
        elif not urlparse(href).scheme and not href.startswith('#'):
            target = (PAPER / unquote(href)).resolve()
            relative = target.relative_to(ROOT).as_posix()
            # These source links remain attached to the Phase 3A source version.
            link['href'] = f'https://github.com/Fr4nzz/ithomiini_maps/blob/{BASE}/{relative.replace(" ", "%20")}'
            remapped.append({'from': href, 'to': link['href']})
    output.write_text(str(soup), encoding='utf-8')
    (QA / f'{Path(source).stem}_link_remapping.json').write_text(json.dumps(remapped, indent=2) + '\n')
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', action='store_true')
    parser.add_argument('--screenshots', action='store_true')
    parser.add_argument('--chromium', help='System Chromium executable, otherwise Playwright managed browser')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    QA.mkdir(exist_ok=True)
    copies = [render('manuscript.md', 'Ithomiini Maps manuscript'),
              render('supplementary_protocol_S1.md', 'Supplementary Protocol S1')]
    report = {
        'validation_utc': datetime.now(timezone.utc).isoformat(),
        'pandoc': subprocess.check_output(['pandoc', '--version'], text=True).splitlines()[0],
        'python': platform.python_version(),
        'load_method': 'Direct set_content of standalone, embedded-resource HTML. Not a network navigation test.',
        'documents': [],
        'scope': 'Layout, links, image loading and text structure only. No experiments, inference or public services tested.',
    }
    with sync_playwright() as playwright:
        options = {'args': ['--no-sandbox']}
        if args.chromium:
            options['executable_path'] = args.chromium
        elif shutil.which('chromium'):
            options['executable_path'] = shutil.which('chromium')
        browser = playwright.chromium.launch(**options)
        report['chromium'] = browser.version
        for copy in copies:
            html = copy.read_text(encoding='utf-8')
            doc = {'file': str(copy.relative_to(ROOT)), 'viewports': []}
            page = browser.new_page(viewport={'width': 1280, 'height': 1050}, device_scale_factor=1)
            page.set_content(html, wait_until='load')
            page.evaluate('document.fonts.ready')
            page.locator('img').evaluate_all('(imgs) => Promise.all(imgs.map(i => i.decode()))')
            for width in (1280, 650):
                page.set_viewport_size({'width': width, 'height': 1050})
                metrics = page.evaluate('''() => ({
                  viewport: window.innerWidth,
                  scrollWidth: document.documentElement.scrollWidth,
                  headings: document.querySelectorAll('h1,h2,h3').length,
                  tables: document.querySelectorAll('table').length,
                  images: [...document.images].map(i => ({alt:i.alt, loaded:i.complete && i.naturalWidth>0,
                    displayedWidth:i.getBoundingClientRect().width})),
                  overflowingElements: [...document.querySelectorAll('body *')].filter(e => {
                    const r=e.getBoundingClientRect(); return r.width && (r.right>innerWidth+1 || r.left < -1);
                  }).map(e => e.tagName + ':' + (e.id || e.className || '')).slice(0,20)
                })''')
                assert metrics['scrollWidth'] <= width, metrics
                assert not metrics['overflowingElements'], metrics
                assert all(i['loaded'] and i['alt'] for i in metrics['images']), metrics
                assert metrics['tables'] == 2
                assert metrics['headings'] == (35 if copy.stem == 'manuscript' else 13)
                doc['viewports'].append(metrics)
                if args.screenshots:
                    page.evaluate('window.scrollTo(0,0)')
                    page.screenshot(path=str(QA / f'{copy.stem}_opening_{width}.png'))
            page.set_viewport_size({'width': 1280, 'height': 1050})
            if args.screenshots and copy.stem == 'manuscript':
                landmarks = {
                    'classifier': '#uploaded-photo-identification',
                    'paired_classifier': '#paired-dorsalventral-collection-classification',
                    'atlas_methods': '#wings-atlas',
                    'conclusions': '#conclusions',
                    'data_availability': '#data-availability',
                    'acknowledgements': '#acknowledgements',
                    'references': '#references',
                }
                for name, selector in landmarks.items():
                    item = page.locator(selector)
                    assert item.count() == 1, selector
                    item.evaluate('(e) => window.scrollTo(0, window.scrollY + e.getBoundingClientRect().top - 22)')
                    page.screenshot(path=str(QA / f'manuscript_{name}.png'))
                page.locator('#figure-1-block').screenshot(path=str(QA / 'manuscript_figure1.png'))
                page.locator('.table-group').nth(1).screenshot(path=str(QA / 'manuscript_benchmark.png'))
            if args.pdf:
                pdf = copy.with_suffix('.pdf')
                page.pdf(path=str(pdf), prefer_css_page_size=True, print_background=True,
                         display_header_footer=True, header_template='<div></div>',
                         footer_template='<div style="width:100%;font-family:Arial;font-size:9px;text-align:center"><span class="pageNumber"></span></div>')
                doc['pdf'] = str(pdf.relative_to(ROOT))
            doc['html_sha256'] = hashlib.sha256(copy.read_bytes()).hexdigest()
            report['documents'].append(doc)
            page.close()
        # Check every diagram node using the browser's actual text metrics.
        page = browser.new_page()
        page.set_content((PAPER / 'figures/figure1_workflow.svg').read_text(encoding='utf-8'))
        geometry = page.evaluate('''() => [...document.querySelectorAll('g.node')].flatMap(g => {
            const r=g.querySelector('rect').getBBox(), t=g.querySelector('text').getBBox();
            return t.x < r.x+5 || t.x+t.width > r.x+r.width-5 || t.y < r.y+3 || t.y+t.height > r.y+r.height-3 ? [g.id] : [];
        })''')
        assert not geometry, geometry
        report['figure1_text_overflow'] = geometry
        browser.close()
    # Validate all local reading-copy links and internal anchors without network access.
    for copy in copies:
        soup = BeautifulSoup(copy.read_text(encoding='utf-8'), 'html.parser')
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('#'):
                assert soup.find(id=unquote(href[1:])) is not None, href
            elif not urlparse(href).scheme:
                assert (copy.parent / unquote(href)).is_file(), href
    (QA / 'phase3b_layout_validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
