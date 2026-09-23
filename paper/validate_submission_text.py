#!/usr/bin/env python3
"""Validate final manuscript text and figure integration without rerunning scientific analyses.

Run from the repository root:
    python paper/validate_submission_text.py
For an exported manuscript tree, pass the exact Phase 2 source with --baseline.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import xml.etree.ElementTree as ET
import re
import subprocess
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

BASE = "3b2fee94d15c891952494f4a9074576febc12a00"
BASE_SHA256 = "4b358de8589225c0d61581a66fa1a9031c4feb5c329f288c98e4d04843c32055"


def check(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit("FAIL: " + message)
    print("PASS: " + message)


def section(text: str, start: str, end: str) -> str:
    return text.split(start, 1)[1].split(end, 1)[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    if args.baseline:
        baseline_bytes = args.baseline.read_bytes()
    else:
        try:
            baseline_bytes = subprocess.check_output(
                ["git", "show", f"{BASE}:paper/manuscript.md"], cwd=root
            )
        except subprocess.CalledProcessError as exc:
            raise SystemExit("Cannot read Phase 2 commit. Use --baseline with its exact manuscript.") from exc
    check(hashlib.sha256(baseline_bytes).hexdigest() == BASE_SHA256,
          "exact Phase 2 baseline SHA-256")
    baseline = baseline_bytes.decode("utf-8")
    text = (root / "manuscript.md").read_text(encoding="utf-8")
    protocol = (root / "supplementary_protocol_S1.md").read_text(encoding="utf-8")
    body, bibliography = text.split("# References\n\n", 1)
    refs = [p.strip() for p in bibliography.strip().split("\n\n")]
    check(len(refs) == 39, "39 bibliography entries")
    sort_key = lambda value: unicodedata.normalize("NFKD", value).casefold()
    check(refs == sorted(refs, key=sort_key), "one alphabetical bibliography")

    keys: set[tuple[str, str]] = set()
    dois: list[str] = []
    for entry in refs:
        match = re.match(r"(.+?) \((\d{4}|n\.d\.(?:-[ab])?)\)\. ", entry)
        check(match is not None, "reference format: " + entry.split(" (")[0])
        assert match is not None
        authors, year = match.groups()
        first = authors.split(",", 1)[0]
        if ", et al." in authors or authors.count(",") > 2:
            label = first + " et al."
        elif " & " in authors:
            label = first + " & " + authors.split(" & ")[-1].split(",", 1)[0]
        else:
            label = first
        keys.add((label, year))
        uses = re.findall(re.escape(label) + r"(?:, | \()" + re.escape(year), body)
        check(bool(uses), f"cited reference: {label} {year}")
        urls = re.findall(r"<([^<>]+)>", entry)
        check(bool(urls), "DOI/authority URL present: " + label)
        for url in urls:
            parsed = urlparse(url)
            check(parsed.scheme == "https" and bool(parsed.netloc) and not re.search(r"\s", url),
                  "URL syntax: " + url)
            if parsed.netloc == "doi.org":
                check(bool(re.fullmatch(r"/10\.\d{4,9}/\S+", parsed.path)), "DOI syntax")
                dois.append(url.casefold())
    check(len(dois) == len(set(dois)), "no duplicate DOI entries")
    # Independent scan for author-year citations, including narrative and grouped citations.
    word = r"[A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ.-]*"
    name = rf"(?:van der Heijden|{word}(?: {word}){{0,3}})"
    label_pattern = rf"{name}(?: et al\.| & {name})?"
    found = set(re.findall(rf"({label_pattern})(?:, | \()(\d{{4}}|n\.d\.(?:-[ab])?)", body))
    check(found <= keys, "all independently detected citations have entries: " + str(sorted(found - keys)))
    check(keys <= found, "all reference labels recognised by independent scan")

    check(not re.search(r"PHASE 3|\b(?:FIG1|FIG2)\b", body),
          "no internal figure-production markers remain")
    check(not re.search(r"^\s*\[(?:Insert|TODO|TBD|VERIFY|NEEDS|PHASE)\b", body, re.M | re.I),
          "no square-bracketed drafting instructions")
    check(not re.search(r"\b(?:TODO|TBD|VERIFY|NEEDS|DATA1|ACK1)\b|\[PHASE 3: S1", body),
          "no text-only drafting markers")
    check("[Supplementary Protocol S1](supplementary_protocol_S1.md)" in body,
          "manuscript links to existing S1")
    for name_, content in [("manuscript prose", body), ("S1", protocol)]:
        check("—" not in content, name_ + " has no em dash")
        check(";" not in content, name_ + " has no semicolon")
        check(not re.search(r"\b(?:color|colors|coloration|modeling|analyze|analyzed|normalization|caliber|license|artifacts|visualization)\b", content),
              name_ + " British spelling screen")
    check(re.findall(r"^#{1,3} .+$", text, re.M) == re.findall(r"^#{1,3} .+$", baseline, re.M),
          "manuscript headings and numbering preserved")
    for begin, end in [
        ("# Abstract\n", "# 1. Introduction\n"),
        ("## 2.2 AI Photo Processor\n", "## 2.4 Photography-to-gallery workflow\n"),
        ("# 3. Results\n", "# 4. Discussion\n"),
        ("# 5. Conclusions\n", "# 6. Data availability\n"),
    ]:
        check(section(text, begin, end) == section(baseline, begin, end),
              "unchanged protected block: " + begin.strip())
    check(section(text, "# 4. Discussion\n", "# 5. Conclusions\n") ==
          section(baseline, "# 4. Discussion\n", "# 5. Conclusions\n").replace("classifier artifacts", "classifier artefacts"),
          "Discussion unchanged except British artefacts spelling")
    for number in (1, 2):
        pattern = rf"\*\*Figure {number}\.\*\*[^\n]+"
        check(re.search(pattern, text).group() == re.search(pattern, baseline).group(),
              f"Figure {number} caption preserved")
    for phrase in ["1,024-dimensional", "2,048-dimensional", "CONCAT_DV", "scale of 30", "top 64",
                   "0.02", "104,297", "91.33%", "3,355", "145 species", "1,220", "57 species", "89.7%"]:
        check(phrase in body, "protected value: " + phrase)
    # Preserve all Phase 3A prose, bibliography and S1. Only figure production changed.
    image_line = '![Workflow showing reviewed specimen identifiers, separate upload and paired-collection classifiers, distinct Wings Atlas data types and separately versioned releases.](figures/figure1_workflow.svg)'
    check(text.count(image_line) == 1, "exactly one accessible Figure 1 image reference")
    stripped = text.replace(image_line + "\n\n", "")
    check(hashlib.sha256(stripped.encode("utf-8")).hexdigest() == '2cb86bffd4fe211da32204f6d47c49221bfce75653e6a0a29c1797c2395aebab',
          "all Phase 3A manuscript text unchanged apart from figure integration")
    check(hashlib.sha256((root / "supplementary_protocol_S1.md").read_bytes()).hexdigest() == 'd8cd641b1eb8bcd19165b218f1af88a94233469277feb3640dca23dde3f82245',
          "S1 byte-for-byte unchanged from Phase 3A")
    for number in (1, 2):
        check(body.count(f"**Figure {number}.**") == 1, f"one Figure {number} caption")
    figures = root / "figures"
    svg_path = figures / "figure1_workflow.svg"
    png_path = figures / "figure1_workflow.png"
    check(svg_path.is_file() and png_path.is_file(), "Figure 1 SVG and PNG exist at committed paths")
    svg = ET.fromstring(svg_path.read_bytes())
    ns = {"s": "http://www.w3.org/2000/svg"}
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
    check(png[:8] == b"\x89PNG\r\n\x1a\n" and struct.unpack(">II", png[16:24]) == (4320, 4662),
          "high-resolution PNG has expected dimensions")
    provenance = json.loads((figures / "figure_provenance.json").read_text(encoding="utf-8"))
    check(provenance["figure2"]["status"] == "pending-author-captures",
          "missing Figure 2 is explicitly recorded outside manuscript")
    check(not re.search(r"!\[[^\]]*\]\([^)]*figure2", body, re.I),
          "no missing Figure 2 image link")
    check((figures / "figure2_capture_spec.md").is_file(), "exact Figure 2 author capture specification exists")
    for row in ("| Named subspecies | 2,613 | 87.93% | 97.33% |",
                "| Species | 3,355 | 91.33% | 97.91% |",
                "| Genus | 3,806 | 95.55% | 99.26% |",
                "| Family | 3,824 | 99.32% | 99.90% |"):
        check(row in body, "exact paired benchmark row: " + row)
    print(f"SUMMARY: {len(keys)} reference keys, {len(dois)} unique DOI links. Structural checks passed.")
    print("LIMIT: URL syntax is not URL reachability. GBIF receipt metadata remains an author action.")
    print("LIMIT: Formatting and text validation do not reproduce experiments or establish runtime model weights.")


if __name__ == "__main__":
    main()
