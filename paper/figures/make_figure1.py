#!/usr/bin/env python3
"""Rebuild the manuscript workflow diagram. SVG uses only standard-library code.
Optional PNG: install cairosvg, then run this script with --png.
No photographs, interface reconstructions or numerical performance plots are used.
"""
from pathlib import Path
import argparse
from html import escape

OUT = Path(__file__).resolve().parent
W, H = 1240, 1330
parts = []
def add(s): parts.append(s)
def rect(x,y,w,h,fill='white',stroke='#687078',sw=1.4):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
def text(x,y,lines,size=20,weight='normal',fill='#192127',dy=28):
    if isinstance(lines,str): lines=[lines]
    add(f'<text x="{x}" y="{y}" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}">')
    for i,line in enumerate(lines): add(f'<tspan x="{x}" dy="{0 if i==0 else dy}">{escape(line)}</tspan>')
    add('</text>')
def panel(letter,title,x,y,w,h):
    rect(x,y,w,h,stroke='#66727b')
    rect(x,y,w,44,fill='#edf0f2',stroke='#66727b')
    text(x+16,y+29,f'{letter}  {title}',23,'bold')
def arrow(x1,y1,x2,y2):
    add(f'<path d="M{x1},{y1} L{x2},{y2}" fill="none" stroke="#334550" stroke-width="2" marker-end="url(#arrow)"/>')
def node(x,y,w,h,lines):
    rect(x,y,w,h,fill='#f9fafb',stroke='#a0a8ae')
    text(x+13,y+30,lines,19,dy=26)

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">')
add('<title id="title">Specimen photography, separate classifier workflows and Wings Atlas data layers</title>')
add('<desc id="desc">Six panels distinguish photography and CAMID review, Gallery indexing, single-photo inference, paired collection classification, observed and inferred Atlas layers, and separate module releases. The paired collection benchmark does not measure upload accuracy.</desc>')
add('<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#334550"/></marker></defs>')
rect(0,0,W,H,stroke='none')
panel('A','Photography and specimen identifiers',30,25,1180,170)
node(48,89,255,82,['Dorsal and ventral views','CAMID + colour reference'])
node(340,89,247,82,['AI Photo Processor','Read visible identifiers'])
node(624,89,245,82,['Human review','Correct or withhold IDs'])
node(906,89,285,82,['Rename + retain logs','CAMID + d / v suffix'])
for x1,x2 in [(303,340),(587,624),(869,906)]: arrow(x1+4,130,x2-5,130)
arrow(620,195,620,234)
panel('B','Collection indexing and Wings Gallery',30,235,1180,162)
node(48,302,255,71,['Shared image storage','Reviewed collection files'])
node(340,302,247,71,['Apps Script → Sheets','Photo index'])
node(624,302,245,71,['Python processing','Static display records'])
node(906,302,285,71,['Wings Gallery','Browse and review by CAMID'])
for x1,x2 in [(303,340),(587,624),(869,906)]: arrow(x1+4,337,x2-5,337)
arrow(1046,397,1046,439)
text(859,423,'collection photographs',17)
panel('C','Single uploaded-photo inference',30,440,574,327)
text(48,511,['Uploaded photograph → padded RGB crop','or full-image fallback'],20,dy=26)
arrow(307,549,307,572)
text(48,602,['Frozen BioCLIP 2.5-H → 1,024 features','LayerNorm + normalised cosine classifier','Finest-rank scores → taxonomic aggregation'],20,dy=29)
text(48,709,['Optional geography reweights candidates afterwards.','No release-matched upload accuracy is reported.'],18,dy=25)
panel('D','Separate paired-collection classification',636,440,574,327)
text(654,511,['Verified dorsal + ventral views of one specimen','Frozen image features concatenated: 2,048'],20,dy=26)
arrow(923,549,923,572)
text(654,602,['Distinct fitted collection classifier','Precomputed prediction release for the Gallery','Paired Sanger benchmark only (Table 2)'],20,dy=29)
text(654,709,['Single-view fallbacks are not verified pairs.','This benchmark does not evaluate arbitrary uploads.'],18,dy=25)
panel('E','Wings Atlas: observed records, context and predictions',30,811,1180,280)
node(48,879,355,162,['Butterfly occurrence records','Published, GBIF and collection sources','Taxonomic and mimicry annotations','Recorded genomic-sampling status'])
node(442,879,355,162,['Host-plant context','Literature association evidence','Independent plant occurrences','Overlap does not establish host use'])
node(836,879,355,162,['Relative habitat suitability','Environmental predictors + records','Accessible-area core / extension','Modelled values are not observations'])
text(49,1067,'CAMID links specimens and collection images. Reference-image substitutions must be identified.',19)
panel('F','Separate version identifiers, not a single combined snapshot',30,1135,1180,170)
text(50,1214,['Occurrence snapshot','9 May 2026'],21,'bold',dy=31)
text(442,1214,['Complete SDM products','28 April 2026'],21,'bold',dy=31)
text(836,1214,['Classifier source and releases','September 2026'],21,'bold',dy=31)
text(50,1281,'Code commits, source-download identifiers and model or output receipts identify different resources.',18)
add('</svg>')
svg='\n'.join(parts)+'\n'
(OUT/'figure1_workflow.svg').write_text(svg,encoding='utf-8')
if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--png',action='store_true'); args=p.parse_args()
    if args.png:
        import cairosvg
        cairosvg.svg2png(bytestring=svg.encode(),write_to=str(OUT/'figure1_workflow.png'),output_width=3100,output_height=3325)
    print(OUT/'figure1_workflow.svg')
