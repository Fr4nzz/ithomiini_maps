# Taxonomic Curation Pipeline - Session Summary

## Project Context
This is for an Ithomiini butterfly distribution mapping application. The dataset contains 102,561 records from Sanger Institute and GBIF with various taxonomic labeling inconsistencies that need programmatic curation for publication-quality data.

## Dataset Analysis Results (102,561 records)

### Issues Identified
| Issue | Unique Combos | Records |
|-------|---------------|---------|
| Nominotypical subspecies (ssp == species epithet) | 343 | 16,651 |
| genus='MISSING' placeholder | -- | 110 |
| n. ssp. [N] undescribed subspecies | 469 (36 patterns) | 2,643 |
| Free-text in subspecies field | ~90 | ~350 |
| Question marks / uncertainty markers | ~30 | ~50 |
| Form names (f. xxx) | ~15 | ~40 |
| Slash-delimited alternatives | ~10 | ~20 |
| Probable spelling variants (e.g., humboldtii/humboldt) | ~5 pairs | -- |
| Species with geographic suffix (e.g., timnaWESTERN) | ~3 | -- |

## Script Created
**Location:** `scripts/taxonomic_curation.py`

### Methodology (Publication-Ready, follows Grenié et al. 2023)

The pipeline has 5 steps:

1. **Data quality assessment** — scans records, identifies placeholders, undescribed subspecies markers (n. ssp. patterns), malformed names, casing inconsistencies

2. **Name extraction** — deduplicates to unique (scientific_name, subspecies) combinations, skipping placeholders

3. **GBIF backbone matching** — matches binomials with higher taxonomy constraints (kingdom → family) for disambiguation, per Grenié et al. (2023)

4. **Synonym resolution** — resolves synonyms to currently accepted names via `acceptedUsageKey`

5. **Subspecies validation** — matches trinomials, detects fuzzy false positives, cross-references against recognized children

### GBIF Species Match API
**Endpoint:** `GET https://api.gbif.org/v1/species/match?name=...&kingdom=Animalia`

Key response fields:
| Field | What it tells us |
|-------|------------------|
| `matchType = EXACT` | Name found in GBIF backbone |
| `matchType = HIGHERRANK` | Subspecies NOT found (matched to species only) |
| `matchType = FUZZY` | Spelling was corrected |
| `status = SYNONYM` | Name is a synonym, `acceptedUsageKey` gives accepted name |

### Usage Commands
```bash
python scripts/taxonomic_curation.py --test           # 50 names (~30s)
python scripts/taxonomic_curation.py --test --limit 20 # smaller subset
python scripts/taxonomic_curation.py --report-only     # data quality only
python scripts/taxonomic_curation.py                   # full run (all names)
```

## Test Results (50 names, 30 seconds)

| Metric | Result |
|--------|--------|
| Species resolution | 100% (50/50 matched) |
| Subspecies resolution | 54.3% (19/35 exactly matched) |
| Fuzzy false positives | 1 detected ("elarina" ≠ "elara") |
| API errors | 0 (503 retry logic works) |
| Cache efficiency | 14 species cached, ~72 API calls saved |

### Key Finding
GBIF has excellent species coverage for Ithomiini but limited subspecies coverage. Many subspecies from Lamas (2004) and Willmott et al. (2020, 2021) are not yet in GBIF backbone. Example: *Brevioleria aelia* has 5 subspecies in dataset but GBIF only recognizes 2.

## Important Caveat About Sanger Institute Data
Many subspecies represent recently described or undescribed taxa (`n. ssp. [1]`, `n. ssp. [2]`). GBIF returns "not found" for these, which is **expected and correct** — these are cutting-edge taxonomy that GBIF hasn't indexed yet. The curation system should treat `subspecies_not_found` as "not yet in GBIF" rather than "invalid."

## Proposed Curation Categories

1. **accepted** — No action needed, name is valid
2. **synonym** — Flag with accepted name from GBIF, add `gbif_accepted_name` field
3. **fuzzy_match** — Flag potential typos, needs manual review
4. **subspecies_not_found** — Mark as "not in GBIF" (expected for Sanger data)
5. **species_not_found** — More serious issue, investigate
6. **not_matchable** — `n. ssp.`, question marks, free-text entries need special handling

## Programmatic Cleanup Rules (for database updates)

1. Parse `genus='MISSING'`: Extract genus from `scientific_name` field
2. Flag non-standard subspecies: Detect `n. ssp.`, `?`, `f.`, `/`, parenthetical remarks via regex
3. Normalize spelling: Apply GBIF fuzzy match corrections where confidence >= 95%
4. Split geographic suffixes: `timnaWESTERN` → `species=timna`, add geographic note field
5. Store GBIF metadata: `gbif_key`, `gbif_status`, `gbif_accepted_name` for each validated taxon

## References for Paper

- **Grenié et al. (2023)** Methods Ecol Evol 14:12-25 — definitive review of taxonomic harmonization best practices
- **Lamas (2004)** — authoritative Ithomiini checklist
- **Willmott et al. (2020, 2021)** — recent Ithomiini taxonomic revisions
- **GBIF Backbone Taxonomy** — reference database used for matching

## Next Steps - TASK FOR THIS SESSION

### Goal
Run the taxonomic curation script on the **entire Sanger Institute dataset** and iterate to make it robust enough to handle all edge cases.

### Approach
1. Run `python scripts/taxonomic_curation.py` (full run, all names)
2. Analyze failures and edge cases
3. Iterate on the script to handle:
   - All the patterns identified (n. ssp., question marks, form names, etc.)
   - API rate limiting and 503 errors gracefully
   - Caching to avoid redundant API calls
   - Generate comprehensive validation report
4. Make the code resilient and production-ready
5. Output should be suitable for publication methodology section

### Cache File
Results should be cached in `gbif_validation_cache.json` keyed by trinomial name to avoid re-querying GBIF on future runs.

### Expected Runtime
For ~2,600 unique taxonomic combinations with caching and rate limiting (5 parallel requests, 100ms delay between batches), initial run should take approximately 1-2 minutes. Subsequent runs after database updates only check new/changed names.

## Branch
`claude/default-syllabus-taxonomy-xDg7M`

## Data File
`map_points.json` — contains 102,561 records with fields including `scientific_name`, `subspecies`, `genus`, etc.
