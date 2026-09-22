#!/usr/bin/env python3
"""Check standalone HTML at desktop/mobile widths and optionally print PDF.
Requires playwright and a Chromium executable. Never contacts the live apps.
"""
from pathlib import Path
import argparse,json,shutil
from playwright.sync_api import sync_playwright
PAPER=Path(__file__).resolve().parents[1]
def main():
    a=argparse.ArgumentParser();a.add_argument('--output-dir',type=Path,required=True);a.add_argument('--pdf',action='store_true');args=a.parse_args()
    out=args.output_dir;out.mkdir(parents=True,exist_ok=True)
    reports=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('chromium-browser'),args=['--no-sandbox'])
        for name in ['manuscript','supplementary_protocol_S1']:
            for width in [1440,390]:
                page=browser.new_page(viewport={'width':width,'height':1000},device_scale_factor=1)
                page.set_content((PAPER/'reading_copies'/f'{name}.html').read_text(),wait_until='load')
                page.evaluate('document.fonts.ready')
                r=page.evaluate('''() => ({viewport:innerWidth,document_width:document.documentElement.scrollWidth,
                  images:[...document.images].map(i=>({loaded:i.complete&&i.naturalWidth>0,width:i.width})),
                  overflow:[...document.querySelectorAll('table,pre,img,svg')].filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1).map(e=>e.tagName),
                  tables:document.querySelectorAll('table').length,
                  inline_svg:document.querySelectorAll('svg').length,
                  missing_svg_markers:[...document.querySelectorAll('[marker-end]')].map(e=>e.getAttribute('marker-end').match(/#([^)]*)/)[1]).filter(id=>!document.getElementById(id)),
                  references:document.querySelectorAll('.reference').length,
                  replacement_characters:document.body.textContent.includes('\\uFFFD')})''')
                r.update(document=name,width=width)
                r['pass']=r['document_width']<=width+1 and not r['overflow'] and all(i['loaded'] for i in r['images']) and not r['replacement_characters'] and not r['missing_svg_markers']
                reports.append(r)
                page.screenshot(path=str(out/f'{name}_{width}_top.png'))
                if name=='manuscript':
                    for target,slug in [('figure','figure1'),('#species-distribution-modelling','sdm'),('#data-availability','data_availability'),('#references','references')]:
                        loc=page.locator(target)
                        if loc.count():
                            loc.first.scroll_into_view_if_needed();page.screenshot(path=str(out/f'{slug}_{width}.png'))
                    for i in range(page.locator('.table-block').count()):
                        page.locator('.table-block').nth(i).screenshot(path=str(out/f'table{i+1}_{width}.png'))
                if args.pdf and width==1440:
                    page.emulate_media(media='print')
                    page.pdf(path=str(out/f'{name}.pdf'),format='A4',print_background=True,prefer_css_page_size=True,display_header_footer=True,header_template='<span></span>',footer_template='<div style="width:100%;text-align:center;font-size:8px;color:#555"><span class="pageNumber"></span> / <span class="totalPages"></span></div>')
                page.close()
        browser.close()
    result={'checks':reports,'passed':all(r['pass'] for r in reports),'note':'Checks cover manuscript reading copies, not live interfaces or model experiments.'}
    (out/'layout_validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
    if not result['passed']:raise SystemExit(1)
if __name__=='__main__':main()
