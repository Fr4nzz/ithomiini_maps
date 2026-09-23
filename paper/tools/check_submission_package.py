#!/usr/bin/env python3
"""Check final output identities and PDF text without rerunning experiments."""
from __future__ import annotations
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[2]
BASE = '0cbf510b5de3afd99cd39729a297671afcfbd241'


def main() -> None:
    qa = ROOT / 'paper/validation'
    report = {'checked_utc': datetime.now(timezone.utc).isoformat(),
              'phase3a_commit': BASE, 'pdfs': [], 'protected_files': [], 'outputs': {}}
    for path in ('paper/supplementary_protocol_S1.md',
                 'paper/final_manuscript_evidence_20260921.md',
                 'paper/phase2_revision_handoff_20260921.md',
                 'paper/phase3a_reference_audit_20260922.md',
                 'paper/phase3a_text_handoff_20260922.md'):
        baseline = subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT)
        current = (ROOT / path).read_bytes()
        assert current == baseline, f'Protected file changed: {path}'
        report['protected_files'].append({'path': path, 'unchanged': True,
                                         'sha256': hashlib.sha256(current).hexdigest()})
    # Source-document links remapped in S1 reading copies must exist at the pinned commit.
    for path in ('paper/Photos Processing Protocol.md',
                 'docs/chat-transcripts/codex-ithomiini/ithomiini-maps-manuscript-019dd1d3.md'):
        subprocess.run(['git', 'cat-file', '-e', f'{BASE}:{path}'], cwd=ROOT, check=True)
    for name in ('manuscript', 'supplementary_protocol_S1'):
        path = ROOT / f'paper/reading_copies/{name}.pdf'
        with fitz.open(path) as doc:
            pages = [p.get_text() for p in doc]
            assert pages and all(len(t.strip()) > 100 for t in pages), 'Empty PDF page'
            assert '\ufffd' not in ''.join(pages), 'Replacement glyph in PDF text'
            assert not any('[PHASE 3:' in t for t in pages), 'Drafting marker in PDF'
            assert ('91.33%' in ''.join(pages)) if name == 'manuscript' else True
            if name == 'manuscript':
                assert any('HUMAN REVIEW' in t and 'Figure 1.' in t for t in pages), 'Figure/caption split or missing'
                assert any('Table 2.' in t and '99.90%' in t for t in pages), 'Benchmark table split or missing'
            report['pdfs'].append({'path': str(path.relative_to(ROOT)), 'pages': len(pages),
                                   'text_extraction': 'passed', 'blank_pages': False,
                                   'replacement_glyphs': False})
    for directory in ('paper/figures', 'paper/reading_copies'):
        for path in sorted((ROOT / directory).glob('*')):
            if path.is_file():
                report['outputs'][str(path.relative_to(ROOT))] = {
                    'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
    report['git_diff_check'] = 'passed'
    report['scope'] = 'Identity, structure and rendering only. No new experimental validation.'
    (qa / 'phase3b_package_validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
