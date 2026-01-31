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

### Architecture — Bulk-Fetch Cache Pipeline

The pipeline is designed for efficiency, reducing ~5000+ individual API calls to ~177 bulk requests + ~334 targeted fallbacks:

```
Phase 1: Build Cache (~177 genus-level requests)
  ┌─────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
  │ gbif_taxon_keys  │ ──→  │ GBIF species/search  │ ──→  │ gbif_taxonomy    │
  │ .json (genus→key)│      │ per genus (bulk)      │      │ _cache.json      │
  └─────────────────┘      └──────────────────────┘      │ 9111 species     │
         ↑                                                │ 3703 subspecies  │
  Auto-discovers all 177                                  │ 8265 synonyms    │
  genera from dataset                                     └──────────────────┘
  (not just Ithomiini)

Phase 2: Match Names Against Cache (zero API calls)
  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
  │ map_points.json  │ ──→  │ Extract 2548     │ ──→  │ Match against    │
  │ (102,561 records)│      │ unique names     │      │ local cache      │
  └──────────────────┘      └──────────────────┘      │ (86.9% resolved) │
                                                       └──────────────────┘

Phase 3: API Fallback (only ~334 requests for unresolved)
  Only names NOT found in cache → individual GBIF match API
  (fuzzy matching, names outside known genera, etc.)
```

### Methodology (Publication-Ready, follows Grenié et al. 2023)

1. **Data quality assessment** — scans records, identifies placeholders, undescribed subspecies markers (n. ssp. patterns), malformed names, casing inconsistencies

2. **Bulk GBIF cache build** — for each genus in the dataset, fetches ALL species, subspecies, and synonyms from the GBIF Backbone Taxonomy via the species/search API (one paginated request per genus). Stores as persistent disk cache.

3. **Name extraction & classification** — deduplicates to unique (scientific_name, subspecies) combinations, classifies subspecies patterns (standard, undescribed, form name, slash alternatives, etc.)

4. **Cache-first matching** — matches binomials/trinomials against local cache (zero API calls). Falls back to individual match API only for names not in cache.

5. **Synonym resolution** — resolves synonyms to currently accepted names via `acceptedKey`

6. **Subspecies validation** — matches trinomials, cross-references against recognized children. If parent species is cached, skips API entirely.

### GBIF Species API Endpoints Used

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `GET /v1/species/search?higherTaxonKey={key}` | Bulk fetch all taxa under a genus | No |
| `GET /v1/species/match?name=...&kingdom=...` | Individual name matching (fallback) | No |

Key response fields:
| Field | What it tells us |
|-------|------------------|
| `matchType = EXACT` | Name found in GBIF backbone |
| `matchType = HIGHERRANK` | Subspecies NOT found (matched to species only) |
| `matchType = FUZZY` | Spelling was corrected |
| `status = SYNONYM` | Name is a synonym, `acceptedKey` gives accepted name |

### Usage Commands
```bash
python scripts/taxonomic_curation.py                   # Full run (uses cache)
python scripts/taxonomic_curation.py --rebuild-cache   # Force cache rebuild
python scripts/taxonomic_curation.py --test            # 50 names subset
python scripts/taxonomic_curation.py --test --limit 20 # smaller subset
python scripts/taxonomic_curation.py --report-only     # data quality only
```

## Full Run Results (2,548 unique names)

### Performance
| Metric | Value |
|--------|-------|
| Total API calls (cache build) | ~177 (one per genus) |
| Total API calls (curation) | 334 |
| Cache-resolved | 86.9% (2,214/2,548) |
| Runtime (with cache) | 198 seconds |
| Runtime (cache rebuild) | ~8 min |
| Cache size | 9,111 species, 3,703 subspecies, 8,265 synonyms |

### Curation Status Breakdown
| Status | Count | % | Description |
|--------|-------|---|-------------|
| verified | 1,021 | 40.1% | Exact match in GBIF backbone |
| subspecies_unresolved | 596 | 23.4% | Subspecies not in backbone (expected for Lamas/Willmott taxa) |
| undescribed | 360 | 14.1% | n. ssp. markers — undescribed taxa |
| higher_rank_only | 191 | 7.5% | Species not in GBIF, matched genus only |
| verified_nominotypical | 172 | 6.8% | Nominotypical subspecies (ssp == species) |
| synonym_resolved | 95 | 3.7% | Synonym resolved to accepted name |
| non_standard_subspecies | 59 | 2.3% | Form names, slash alternatives, etc. |
| review_spelling | 50 | 2.0% | Fuzzy match — possible spelling error |
| subspecies_synonym | 4 | 0.2% | Subspecies is a synonym |

### Resolution Rates
| Level | Resolved | Rate |
|-------|----------|------|
| Species | 2,357/2,548 | **92.5%** |
| Subspecies | 671/1,410 | **47.6%** |

### Key Findings

1. **Species coverage excellent (92.5%)** — GBIF backbone covers nearly all Ithomiini species
2. **Subspecies gap expected (47.6%)** — Many subspecies from Lamas (2004) and Willmott et al. (2020, 2021) are not yet in GBIF backbone. Example: *Brevioleria aelia* has 5 subspecies in dataset but GBIF only recognizes 2.
3. **95 synonyms detected** — e.g., *Hyposcada zarepha* → *Oleria zarepha*, *Ithomia adelinda* → *Hyalyris oulita adelinda*
4. **50 fuzzy matches** — e.g., *Elzunia humboldt* → *Elzunia humboldtii*, *Episcada hymen* → *Episcada hymenaea*
5. **191 species not in GBIF** — matched only at genus level, likely recently described species
6. **25 fuzzy false positives caught** — e.g., "bomplandii" ≠ "bonplandii" correctly flagged

### Dataset Family Composition
The dataset is 98.9% Ithomiini but contains 132 non-Ithomiini genera:
| Family | Records | % |
|--------|---------|---|
| Nymphalidae (Ithomiini) | 101,417 | 98.9% |
| Nymphalidae (other tribes) | 845 | 0.8% |
| Riodinidae | 110 | 0.1% |
| Pieridae | 75 | 0.1% |
| Other (Hesperiidae, Lycaenidae, etc.) | 34 | <0.1% |

## Important Caveat About Sanger Institute Data
Many subspecies represent recently described or undescribed taxa (`n. ssp. [1]`, `n. ssp. [2]`). GBIF returns "not found" for these, which is **expected and correct** — these are cutting-edge taxonomy that GBIF hasn't indexed yet. The curation system treats `subspecies_not_found` as "not yet in GBIF" rather than "invalid."

## Curation Categories

1. **verified** — Name matches GBIF backbone exactly
2. **verified_nominotypical** — Nominotypical subspecies (auto-validated)
3. **synonym_resolved** — Synonym resolved to accepted name
4. **subspecies_synonym** — Subspecies is a synonym
5. **subspecies_unresolved** — Subspecies not in GBIF (expected for recent taxonomy)
6. **undescribed** — Undescribed subspecies markers (n. ssp. etc.)
7. **higher_rank_only** — Species not in GBIF, matched genus only
8. **non_standard_subspecies** — Form names, slash alternatives, question marks
9. **review_spelling** — Fuzzy match, possible spelling error (ACTION NEEDED)

## Generated Files

| File | Purpose |
|------|---------|
| `public/data/gbif_taxonomy_cache.json` (9.1 MB) | Persistent GBIF backbone cache — all taxa for all dataset genera |
| `public/data/gbif_taxon_keys.json` | Genus name → GBIF taxon key mapping (177 genera) |
| `public/data/taxonomic_curation_report.json` (3.8 MB) | Full curation report with per-name results |

## References for Paper

- **Grenié et al. (2023)** Methods Ecol Evol 14:12-25 — definitive review of taxonomic harmonization best practices
- **Lamas (2004)** — authoritative Ithomiini checklist
- **Willmott et al. (2020, 2021)** — recent Ithomiini taxonomic revisions
- **GBIF Backbone Taxonomy** — reference database used for matching

## Literature Review Results

A comprehensive literature review of all flagged names has been completed. See
**`taxonomic-literature-review.md`** for full details.

### Key Findings
1. **12 of 16 fuzzy species matches**: Dataset is correct, GBIF is outdated (e.g., *Actinote* not *Altinote*; *Elzunia humboldt* not *humboldtii*; *Heliconius numata* not *numatus*)
2. **2 spelling corrections needed**: *Lycorea cleobea* → *cleobaea*; *Thyridia aedessa* → *aedesia*
3. **1 fuzzy false positive**: *Episcada hymen* and *E. hymenaea* are different valid species
4. **All 14 Hypomenitis species**: Valid — GBIF incorrectly treats the genus as a synonym of *Greta*
5. **Ollantaya and Pachacutia**: Valid genera despite GBIF DOUBTFUL status
6. **5 names are subspecies treated as species**: *Hypothyris dionaea*, *H. maenas*, *Hyposcada adelphina*, *H. gallardi*, *Veladyris cytharista*
7. **Overall**: The dataset (Lamas 2004 / Willmott et al.) is more taxonomically current than the GBIF backbone for Ithomiini

## Next Steps

### Immediate (ACTION NEEDED)
1. **Apply 2 spelling corrections** — *Lycorea cleobea* → *cleobaea*, *Thyridia aedessa* → *aedesia*
2. **Flag 5 subspecies-as-species** — *Hypothyris dionaea/maenas*, *Hyposcada adelphina/gallardi*, *Veladyris cytharista*
3. **Expert review of 9 uncertain names** — See literature review §5.4

### Future Enhancements
1. **Apply corrections to map_points.json** — update synonym names to accepted names, fix confirmed spelling errors
2. **Add Lamas (2004) checklist as secondary reference** — for subspecies not in GBIF backbone
3. **Integrate with map UI** — show curation status flags in the application
4. **Periodic cache refresh** — rebuild cache when GBIF backbone is updated

## Branch
`claude/default-syllabus-taxonomy-xDg7M-dH4Zh`

## Data File
`map_points.json` — contains 102,561 records with fields including `scientific_name`, `subspecies`, `genus`, etc.
