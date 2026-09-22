#!/usr/bin/env python3
"""Render standalone reading copies. Requires Pandoc and beautifulsoup4.
Run from any directory. Outputs HTML under paper/reading_copies by default.
PDFs are optional and are not required for Markdown validation.
"""
from pathlib import Path
import argparse, subprocess, re
from bs4 import BeautifulSoup

PAPER = Path(__file__).resolve().parents[1]

def render(source: Path, output: Path) -> None:
    subprocess.run(['pandoc', str(source), '--from=markdown-implicit_figures',
                    '--to=html5', '--standalone', '--embed-resources',
                    f'--resource-path={PAPER}', f'--css={PAPER / "tools/reading.css"}',
                    '--metadata=lang:en-GB', f'--metadata=pagetitle:{source.stem} reading copy',
                    '--output', str(output)], check=True, cwd=PAPER)
    soup=BeautifulSoup(output.read_text(), 'html.parser')
    # Pandoc prefixes inline SVG ids but can leave marker/ARIA references unchanged.
    for svg in soup.find_all('svg'):
        prefix=svg.get('id','')+'_'
        mapping={tag['id'].removeprefix(prefix):tag['id'] for tag in svg.find_all(id=True)}
        for tag in [svg,*svg.find_all(True)]:
            for attr,value in list(tag.attrs.items()):
                if isinstance(value,str):
                    value=re.sub(r'url\(#([^)]*)\)',lambda m:'url(#'+mapping.get(m[1],m[1])+')',value)
                    if attr=='aria-labelledby':value=' '.join(mapping.get(token,token) for token in value.split())
                    tag[attr]=value
    for link in soup.find_all('a', href=True):
        if link['href']=='supplementary_protocol_S1.md':link['href']='supplementary_protocol_S1.html'
    if source.name=='manuscript.md':
        paragraphs=soup.body.find_all('p',recursive=False)
        paragraphs[0]['class']='manuscript-title'
        paragraphs[1]['class']='authors'
        note=soup.new_tag('aside',attrs={'class':'production-note'})
        note.string='Reading copy. Figure 1 and Supplementary Protocol S1 are complete. Figure 2 has a final caption but its authentic four-panel plate still requires author capture. Consult the author-action record before submission.'
        soup.body.insert(0,note)
        for image in list(soup.find_all(['img','svg'])):
            parent=image.parent
            caption=parent.find_next_sibling('p')
            if caption and caption.get_text().startswith('Figure 1.'):
                figure=soup.new_tag('figure'); parent.insert_before(figure)
                figure.append(image.extract());parent.decompose()
                cap=soup.new_tag('figcaption')
                for child in list(caption.contents):cap.append(child.extract())
                figure.append(cap);caption.decompose()
        refs=soup.find(id='references')
        if refs:
            for para in refs.find_next_siblings('p'):para['class']='reference'
    for table in list(soup.find_all('table')):
        caption=table.find_previous_sibling('p')
        if caption and caption.get_text().startswith(('Table 1.','Table 2.')):
            wrap=soup.new_tag('div',attrs={'class':'table-block'});caption.insert_before(wrap)
            wrap.append(caption.extract());wrap.append(table.extract())
    output.write_text(str(soup),encoding='utf-8')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=PAPER/'reading_copies')
    args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
    for name in ['manuscript','supplementary_protocol_S1']:
        dest=args.output_dir/f'{name}.html';render(PAPER/f'{name}.md',dest);print(dest)
if __name__=='__main__':main()
