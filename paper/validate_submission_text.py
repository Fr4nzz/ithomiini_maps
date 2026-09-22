#!/usr/bin/env python3
"""Validate Phase 3A manuscript text without rerunning scientific analyses.

Run from the repository root:
    python paper/validate_submission_text.py
For an exported manuscript tree, pass the exact Phase 2 source with --baseline.
"""
from __future__ import annotations

import argparse
import hashlib
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

    markers = re.findall(r"\[PHASE 3: ([A-Z0-9]+)\.[^\n]*\]", body)
    check(markers == ["FIG1", "FIG2"], "only FIG1 and FIG2 production markers remain")
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
    print(f"SUMMARY: {len(keys)} reference keys, {len(dois)} unique DOI links. Structural checks passed.")
    print("LIMIT: URL syntax is not URL reachability. GBIF receipt metadata remains an author action.")
    print("LIMIT: Formatting and text validation do not reproduce experiments or establish runtime model weights.")


if __name__ == "__main__":
    main()
