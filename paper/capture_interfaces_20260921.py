#!/usr/bin/env python3
"""Capture real deployed interfaces, never mock predictions or alter application code.
Requires playwright, requests and Chromium. Run from the repository root.
A public collection image is used only as an interface demonstration, not a test set.
"""
from pathlib import Path
import datetime
import hashlib
import json
import requests
from playwright.sync_api import sync_playwright

OUT = Path('paper/figures')
OUT.mkdir(parents=True, exist_ok=True)
receipt = {'captured_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'errors': []}
ATLAS = 'https://rapidspeciation.github.io/ithomiini_maps/'
GALLERY = 'https://rapidspeciation.github.io/Shiny_Ikiam_Wings_Gallery/'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width':1800,'height':1100},device_scale_factor=1.5)
    page = context.new_page()
    try:
        page.goto(ATLAS, wait_until='domcontentloaded', timeout=120000)
        page.wait_for_timeout(15000)
        page.evaluate("() => {window._paperPinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia}")
        page.evaluate("async()=>{const p=window._paperPinia;const f=p._s.get('filters');const ds=p._s.get('dataset');f.filters.source=Object.keys(ds.sourceConfig);await Promise.all(f.filters.source.map(s=>ds.loadSource(s)));const t=p._s.get('theme');if(t&&t.setMode)t.setMode('light');const v=p._s.get('view');if(v)v.colorBy='source';}")
        page.wait_for_timeout(12000)
        page.screenshot(path=str(OUT/'figure2_atlas_interface.png'))
        receipt['atlas_overview']={'url':ATLAS,'sources':'all five occurrence sources','body_text':page.locator('body').inner_text()}
        page.evaluate("async()=>{const p=window._paperPinia;const f=p._s.get('filters');f.filters.species=['Mechanitis polymnia'];const s=p._s.get('sdm');await s.loadMetadata();s.selectedSpecies=['Mechanitis polymnia'];s.enabled=true;s.opacity=0.55;const h=p._s.get('hostPlants');await h.loadMetadata();h.setSelectedTaxa(['species_solanum_stramonifolium']);await h.loadOccurrences(['species_solanum_stramonifolium']);const v=p._s.get('view');if(v)v.colorBy='subspecies';}")
        page.wait_for_timeout(16000)
        host_state=page.evaluate("()=>{const h=window._paperPinia._s.get('hostPlants');return {selected:h.selectedTaxonSlugs,enabled:h.enabled,error:h.occurrenceError,datasetType:h.occurrenceDataset?.type,features:h.occurrenceDataset?.features?.length,activeTaxa:h.activeTaxa.map(t=>({name:t.canonical_name,count:t.occurrence_count}))}}")
        assert host_state['enabled'] and host_state['selected']==['species_solanum_stramonifolium'],host_state
        assert not host_state['error'],host_state
        page.screenshot(path=str(OUT/'figure3_mechanitis_context.png'))
        receipt['mechanitis_context']={'url':ATLAS,'butterfly':'Mechanitis polymnia','host':'Solanum stramonifolium','host_state':host_state,'body_text':page.locator('body').inner_text()}
    except Exception as e:
        receipt['errors'].append({'atlas':str(e)})
    page.close()
    page=context.new_page()
    try:
        rows=json.loads(Path('public/data/map_points_sanger.json').read_text())
        candidates=[r for r in rows if r.get('scientific_name','').startswith('Mechanitis polymnia') and r.get('image_url')]
        row=candidates[0]
        image_url=row['image_url'].replace('&w=400','&w=1200')
        r=requests.get(image_url,timeout=120)
        r.raise_for_status()
        assert r.headers.get('content-type','').startswith('image/'), r.headers
        image_path=OUT/'identifier_example_input.webp'
        image_path.write_bytes(r.content)
        receipt['identifier_input']={'specimen_id':row['id'],'recorded_name':row['scientific_name'],'image_url':image_url,'source':'Public Sanger collection image link in frozen Atlas record','sha256':hashlib.sha256(r.content).hexdigest(),'not_a_heldout_evaluation':True}
        page.goto(GALLERY,wait_until='domcontentloaded',timeout=120000)
        page.wait_for_timeout(10000)
        page.get_by_text('AI Identifier',exact=True).first.click()
        page.wait_for_timeout(4000)
        # Supply independently recorded country before inference, avoiding automatic guessing.
        country=page.get_by_placeholder('Any country')
        country.fill('Ecuador')
        page.wait_for_timeout(1000)
        option=page.get_by_text('Ecuador',exact=True)
        if option.count():option.last.click()
        page.locator('input[type=file]').first.set_input_files(str(image_path))
        page.wait_for_timeout(3000)
        buttons=page.locator('button').all()
        clicked=False
        for button in buttons:
            label=button.inner_text().strip().lower()
            if button.is_enabled() and ('identify' in label or 'identif' in label) and 'all photos identified' not in label and label!='ai identifier':
                button.click();clicked=True;break
        receipt['identifier_button_clicked']=clicked
        for _ in range(18):
            page.wait_for_timeout(10000)
            text=page.locator('body').inner_text()
            if 'Species' in text and '%' in text and ('Subspecies' in text or 'Genus' in text):break
        text=page.locator('body').inner_text()
        receipt['identifier_body_text']=text
        receipt['identifier_url']=GALLERY
        receipt['identifier_controls']=page.locator('button').all_inner_texts()
        page.screenshot(path=str(OUT/'figure4_ai_identifier.png'),full_page=True)
        # Retain successful API responses as evidence, but do not label an empty UI as a result.
        receipt['identifier_has_predictions']=('Species' in text and '%' in text)
    except Exception as e:
        receipt['errors'].append({'identifier':str(e)})
    browser.close()
receipt['files']={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in OUT.glob('*.png')}
(OUT/'interface_capture_receipt_20260921.json').write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k in ['errors','identifier_has_predictions','identifier_button_clicked','files']},indent=2))
