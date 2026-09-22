#!/usr/bin/env python3
"""Text/reference/assets checks. This is not experimental or runtime validation."""
from pathlib import Path
import argparse,hashlib,json,re,unicodedata
from xml.etree import ElementTree
PAPER=Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path);args=parser.parse_args()
    s=(PAPER/'manuscript.md').read_text();body,refs=s.split('# References\n',1)
    records=json.loads((PAPER/'phase3_reference_records_20260922.json').read_text())['records']
    errors=[]
    def check(name,ok):
        if not ok:errors.append(name)
    check('No em dashes or semicolons in manuscript prose','—' not in body and ';' not in body)
    check('No internal drafting markers',not re.search(r'PHASE 3|\b(?:FIG1|FIG2|DATA1|ACK1|TODO|TBD|VERIFY|NEEDS)\b|\[(?:Insert|Supply|Confirm|Authors to)|docs\.google\.com/document',body,re.I))
    entries=[x.strip() for x in refs.strip().split('\n\n')]
    check('One alphabetical reference sequence',entries==sorted(entries,key=str.casefold))
    check('Reference register matches exact bibliography',entries==[r['entry'] for r in records])
    normal=re.sub(r'\s+',' ',body)
    normal=normal.replace('Gu et al., 2025, 2026','Gu et al., 2025, Gu et al., 2026').replace('GitHub, n.d.-a, n.d.-b','GitHub, n.d.-a, GitHub, n.d.-b')
    for r in records:
        authors,year=r['key'].rsplit(', ',1)
        patt=re.escape(authors)+r'\s*(?:,\s*|\(\s*)'+re.escape(year)
        check('Cited bibliography entry: '+r['key'],bool(re.search(patt,normal)))
    # Every author/year unit in the manuscript must resolve to the manually verified register.
    author_pattern=r'(?:[A-ZÁÉ][A-Za-zÀ-ÿ.\-]+(?: et al\.| & [A-Z][A-Za-zÀ-ÿ.\-]+)?|Python Software Foundation|MapLibre Contributors|Vue\.js Contributors|GitHub)'
    found=re.findall(r'('+author_pattern+r')\s*(?:,\s*|\(\s*)(\d{4}|n\.d\.(?:-[ab])?)',normal)
    known={r['key'] for r in records}
    for a,y in found:check('In-text citation has entry: '+a+', '+y,a+', '+y in known)
    for required in ['1,024-dimensional','2,048-dimensional','LayerNorm','scale of 30','top 64','3,829','3,355','2,613','3,806','3,824','91.33%','97.91%','87.93%','97.33%','95.55%','99.26%','99.32%','99.90%','+0.21','+0.74','−0.16','1,586','1,220','57 species','89.7%','104,297','145 species','9 May 2026','28 April 2026','10.15468/dl.6zagkz']:
        check('Preserved required value: '+required,required in body)
    for bad in ['YOLO26s-seg','SAM 3','CLIP-Adapter','ArcFace','155 models','17:38:04.759685','3aa72a36c37ce8b383f8f5a5f9ec5763f52e5e42']:
        check('No unsupported or corrected claim: '+bad,bad not in body)
    for text in [body,(PAPER/'supplementary_protocol_S1.md').read_text()]:
        for path in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',text):
            if not re.match(r'https?://|#',path):check('Local link exists: '+path,(PAPER/path).exists())
    ElementTree.parse(PAPER/'figures/figure1_workflow.svg')
    check('Exactly two manuscript tables',len(re.findall(r'^\|\s*:?-{3,}',body,re.M))==2)
    check('No broken Figure 2 image reference','![' not in body[body.index('**Figure 2.**')-100:body.index('**Figure 2.**')])
    report={'validation_type':'text, references and assets only; not scientific experiment validation','manuscript_sha256':digest(PAPER/'manuscript.md'),'evidence_ledger_sha256':digest(PAPER/'final_manuscript_evidence_20260921.md'),'phase2_handoff_sha256':digest(PAPER/'phase2_revision_handoff_20260921.md'),'references':len(entries),'in_text_citation_units_detected':len(found),'figure1':'SVG parsed and manuscript link exists','figure2':'caption final; four authorised screenshots still required','supplementary_protocol':'text complete','internal_phase3_markers':0 if not re.search('PHASE 3',body) else body.count('PHASE 3'),'errors':errors}
    out=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(out)
    print(out)
    if errors:raise SystemExit(1)
if __name__=='__main__':main()
