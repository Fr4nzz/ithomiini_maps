# Taxonomy Curation Code Audit & Optimization Plan

Audit of the three files involved in the taxonomy curation pipeline:
- `scripts/taxonomic_curation.py` (2,611 lines)
- `scripts/process_data.py` (892 lines)
- `src/stores/data.js` (1,475 lines)

---

## 1. `taxonomic_curation.py` — Critical Issues

### 1.1 File is too large (2,611 lines) — should be split into modules

The file mixes 6 distinct responsibilities in a single file:
1. **GBIF API / cache** — fetching, caching, rate limiting (~300 lines)
2. **Name classification** — subspecies categorization, name extraction (~100 lines)
3. **Curation logic** — the `curate_name()` pipeline (~450 lines)
4. **Correction application** — `apply_corrections()` and output writing (~350 lines)
5. **Reporting** — `print_curation_summary()`, `save_report()` (~200 lines)
6. **Data quality** — `assess_data_quality()`, `print_quality_report()` (~160 lines)

**Proposed structure:**
```
scripts/
  taxonomic_curation.py          # CLI entrypoint + orchestration (~150 lines)
  curation/
    __init__.py
    gbif.py                      # GBIF API, cache building, rate limiting
    classify.py                  # Name classification, subspecies categorization
    curate.py                    # Core curate_name() pipeline
    corrections.py               # apply_corrections(), literature loading
    output.py                    # File writing (split JSON, image supplement)
    report.py                    # Summary printing, JSON report generation
    quality.py                   # Data quality assessment
    config.py                    # All constants, paths, thresholds
```

**Impact:** Each module would be 100-300 lines — easy for AI and humans to reason about. Changes to output format don't require reading the curation logic.

---

### 1.2 `curate_name()` is a 420-line monolith with deeply nested control flow

`curate_name()` (lines 1093-1513) handles:
- Phase 0: Literature pre-corrections (spelling, subspecies-as-species)
- Step 1: Cache lookup (species, synonym, outside-cache, API fallback)
- Step 2: Subspecies validation (8 category branches)
- Step 3: Status determination

The function has **4+ levels of nesting** in the synonym resolution path (lines 1199-1279) and the API fallback path (lines 1280-1432).

**Proposed refactor:** Extract into focused functions:
```python
def curate_name(name_entry, cache):
    result = _init_result(name_entry)
    name_entry, sci_name = _apply_literature_pre_corrections(name_entry, result)
    _resolve_species(sci_name, cache, result)
    _validate_subspecies_field(name_entry, cache, result)
    _determine_status(result)
    return result

def _resolve_species(sci_name, cache, result):
    """Try cache → synonym → API fallback. Populates result['species_match'] and result['accepted_name']."""
    if _try_cache_species(sci_name, cache, result):
        return
    if _try_cache_synonym(sci_name, cache, result):
        return
    _try_api_fallback(sci_name, cache, result)
```

Each sub-function would be 30-50 lines max with clear single responsibility.

---

### 1.3 Repetitive `accepted_name` dict construction (6 times)

The same dict structure `{"key": ..., "canonicalName": ..., "scientificName": ..., "status": ..., "rank": ...}` is built at 6 different locations (lines 1183, 1217, 1245, 1268, 1414, 1426).

**Fix:** Extract a helper:
```python
def _make_accepted(entry, key_field="key"):
    return {
        "key": entry.get(key_field) or entry.get("key"),
        "canonicalName": entry.get("canonicalName", ""),
        "scientificName": entry.get("scientificName", ""),
        "status": entry.get("status") or entry.get("taxonomicStatus", "ACCEPTED"),
        "rank": entry.get("rank", "SPECIES"),
    }
```

---

### 1.4 Repetitive Sanger taxonomy check (4 identical blocks)

The pattern `if sci_name.lower() in SANGER_VALID_SPECIES` appears at lines 1308, 1348, 1374, and 2267 — each with a near-identical block setting status, flags, notes, literature_action, and curated_name.

**Fix:** Extract:
```python
def _check_sanger_verified(sci_name, result, context_note=""):
    if sci_name.lower() not in SANGER_VALID_SPECIES:
        return False
    result["status"] = "verified_literature"
    result["flags"].append("SANGER_TAXONOMY_VERIFIED")
    result["notes"].append(f"'{sci_name}' verified in Sanger taxonomy. {context_note}")
    result["literature_action"] = f"sanger_taxonomy_verified:{sci_name}"
    result["curated_name"] = sci_name
    return True
```

Reduces 4 blocks of ~10 lines each to 4 one-liners.

---

### 1.5 `species_match` dict construction (4 times)

The `result["species_match"] = { "matchType": ..., "source": ..., ... }` pattern is built at lines 1173, 1200, 1293, and again implicitly modified at 1384/1398. Same 8-10 fields each time.

**Fix:** Helper function:
```python
def _make_species_match(entry, source="cache", synonym=False):
    return {
        "matchType": entry.get("matchType", "EXACT"),
        "source": source,
        "status": entry.get("status", ""),
        "gbifKey": entry.get("key") or entry.get("usageKey"),
        "canonicalName": entry.get("canonicalName", ""),
        "scientificName": entry.get("scientificName", ""),
        "rank": entry.get("rank", ""),
        "synonym": synonym,
    }
```

---

### 1.6 `print_curation_summary()` is 180 lines of repetitive printing (lines 1775-1956)

Each section follows the same pattern: filter results by flag/status, print header, iterate and format. This is ~12 repetitive blocks.

**Fix:** Data-driven approach:
```python
SUMMARY_SECTIONS = [
    {"title": "Species Synonyms Found", "filter": lambda r: "SYNONYM" in r["flags"],
     "format": lambda r: f"  {r['input']['scientific_name']:40s} -> {r.get('accepted_name',{}).get('canonicalName','?')}"},
    {"title": "Species Fuzzy Matches", "filter": lambda r: "FUZZY_MATCH" in r["flags"],
     "format": lambda r: f"  {r['input']['scientific_name']:40s} -> {r['species_match']['canonicalName']} ({r['species_match'].get('confidence','?')}%)"},
    # ... etc
]

def print_curation_summary(results, cache):
    # Status breakdown (compact)
    _print_status_table(results)
    _print_resolution_rates(results)
    for section in SUMMARY_SECTIONS:
        _print_section(results, **section)
    _print_performance(results, cache)
```

---

### 1.7 Global mutable state (`_api_call_count`)

`_api_call_count` is a module-level global incremented with `global _api_call_count` in multiple functions. This makes the code untestable and non-reentrant.

**Fix:** Pass a context/stats object through the pipeline:
```python
@dataclass
class CurationContext:
    cache: dict
    api_call_count: int = 0
    sanger_species: set = field(default_factory=set)
    spelling_corrections: dict = field(default_factory=dict)
    # ... other correction tables
```

---

### 1.8 Module-level side effects on import

Lines 232-237 execute `_load_corrections()` and `_load_sanger_taxonomy()` at import time. This means importing the module triggers file I/O, which breaks testing and makes the module slow to import.

**Fix:** Lazy-load in `main()` or use a `@functools.cache` wrapper.

---

### 1.9 `apply_corrections()` duplicates curation logic

`apply_corrections()` (lines 2152-2371) re-checks spelling corrections, synonym resolution, subspecies-as-species, and subspecies typos — repeating logic that `curate_name()` already computed. The function re-parses notes strings to extract original names (lines 2183-2198), which is fragile.

**Fix:** Store the original name directly in the curation result during `curate_name()` instead of parsing it back from notes:
```python
# In curate_name(), Phase 0:
result["original_scientific_name"] = name_entry["scientific_name"]  # before any correction
```

Then `apply_corrections()` can use `result["original_scientific_name"]` directly instead of the note-parsing hack.

---

### 1.10 Legacy constant `CURATED_DATA_FILE`

Line 2139: `CURATED_DATA_FILE = OUTPUT_DIR / "map_points_curated.json"  # legacy, removed`

This constant is dead code — only used in the cleanup check. Should be a local string in the cleanup code, not a module constant.

---

### 1.11 `import math` and `import csv` inside functions

`_sanitize_for_json()` (line 2376) imports `math` inside the function body. `_load_sanger_taxonomy()` (line 207) imports `csv` inside the function body. Both are already imported at the top of the file (line 40: `import csv`; `math` is not at top-level but should be).

**Fix:** Move `import math` to the top-level imports. Remove the redundant `import csv` at line 207.

---

### 1.12 `_normalize_record()` has hard-to-read column lookups

Lines 410-411 use nested `next()` with generator expressions to find column mappings:
```python
genus = str(row.get(next((k for k, v in preset.items() if v == "genus"), "genus"), "")).strip()
```

This is a one-liner that's hard to parse. The same pattern appears 4 times.

**Fix:** Build a reverse lookup once:
```python
def _normalize_record(row, preset_name):
    preset = COLUMN_PRESETS[preset_name]
    col_for = {v: k for k, v in preset.items()}  # {"genus": "Genus", "species": "Species", ...}

    genus = str(row.get(col_for.get("genus", "genus"), "")).strip()
    species = str(row.get(col_for.get("species", "species"), "")).strip()
    # ... cleaner
```

---

## 2. `process_data.py` — Issues

### 2.1 NaN sanitization is duplicated

The NaN→None loop at lines 876-881 is identical to `_sanitize_for_json()` in `taxonomic_curation.py`. Both scripts independently handle the same pandas-to-JSON issue.

**Fix:** Share a utility function (e.g., in `curation/utils.py`) or just use `json.dumps(records, default=...)` with a custom default handler:
```python
def json_default(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return None
    raise TypeError

json.dump(records, f, default=json_default)
```

Actually, `json.dump` calls `default` only for non-serializable types, and `float('nan')` IS serializable (to invalid JSON). So the post-processing loop is needed. But it should be a shared utility, not duplicated.

### 2.2 Inline `import math` at line 877

`math` is imported inside the save block. Should be at the top.

---

## 3. `src/stores/data.js` — Issues

### 3.1 File is 1,475 lines — one of the largest single Vue stores

This store handles: data loading, filtering, photo lookups, color mapping, URL serialization, persistence, clustering, export settings, and more.

**Proposed split** (only for the taxonomy/data-loading parts this audit covers):
```
stores/
  data.js            # Core state, filters, computed options (~500 lines)
  data-loading.js    # loadMapData, loadSource, photo lookups (~200 lines)
  data-colors.js     # Color mapping, legend (~300 lines)
  data-url.js        # URL serialization/restore (~200 lines)
```

Or use composables to extract logically grouped functionality.

### 3.2 `buildPhotoLookup` and `buildMimicryPhotoLookup` are called together every time

Every call to `rebuildPhotoLookups()` recreates both lookups by copying the full `allFeatures + imageSupplement` array. As more sources load, this becomes expensive (100K+ records iterated twice).

**Fix:** Make the lookups incremental — only add new records from the newly loaded source instead of rebuilding from scratch:
```javascript
const addToPhotoLookups = (newRecords) => {
    // Only process the new records, add to existing lookups
    for (const item of newRecords) {
        // ... add to photoLookup and mimicryPhotoLookup
    }
}
```

### 3.3 `allFeatures` array grows by full copy on each source load

Line 216: `allFeatures.value = [...allFeatures.value, ...data]`

When loading 49K GBIF records after 7K Sanger records, this creates a new 56K-element array from scratch. With 4 sources, the last load copies 104K records.

**Fix:** Use `push()` to append in-place:
```javascript
allFeatures.value.push(...data)
```

Vue's reactivity will still trigger since the ref content is mutated. However, for computed properties to react, you may need to trigger reactivity explicitly or use `shallowRef` with manual triggering.

### 3.4 `Set` reactivity issue

`loadedSources` and `sourceLoading` use `ref(new Set())`, but Vue 3 `ref()` does not deeply track `Set` mutations. Creating new Sets on every change (lines 208, 217, 225-227) works but is awkward.

**Fix:** Use `reactive(new Set())` or `shallowRef` with manual trigger, or just use a plain reactive object `{ 'Sanger Institute': true, 'GBIF': false, ... }` which Vue tracks natively.

---

## 4. Cross-Cutting Issues

### 4.1 No shared constants between Python and JS

The source names (`"Sanger Institute"`, `"GBIF"`, `"Dore et al. (2025)"`, `"iNaturalist"`) and file names (`map_points_sanger.json`, etc.) are hardcoded in both `taxonomic_curation.py` and `data.js`. If a source name changes, both must be updated.

**Fix:** Generate a small `data_manifest.json` during the pipeline that lists available sources and their files. The app reads this manifest instead of hardcoding:
```json
{
  "sources": {
    "Sanger Institute": { "file": "map_points_sanger.json", "records": 6722, "default": true },
    "GBIF": { "file": "map_points_gbif.json", "records": 49405 },
    "Dore et al. (2025)": { "file": "map_points_dore.json", "records": 28927 },
    "iNaturalist": { "file": "map_points_inaturalist.json", "records": 19328 }
  },
  "image_supplement": "map_points_images.json",
  "generated_at": "2026-01-31T01:32:05Z"
}
```

This also lets the app show record counts in the source dropdown before loading.

---

## 5. Priority Order for Implementation

| # | Change | Impact | Effort | Files Reduced |
|---|--------|--------|--------|---------------|
| 1 | Split `taxonomic_curation.py` into modules | High (maintainability) | Medium | 2611 → 8 files, ~200 each |
| 2 | Extract `curate_name()` sub-functions | High (readability) | Low | -150 lines of nesting |
| 3 | Extract repeated dict builders (1.3, 1.4, 1.5) | Medium (DRY) | Low | -100 lines |
| 4 | Store original name in result (1.9) | Medium (fragility) | Low | -20 lines of note parsing |
| 5 | Data-driven `print_curation_summary()` (1.6) | Medium (DRY) | Medium | -120 lines |
| 6 | Remove global state (1.7) + module-level I/O (1.8) | Medium (testability) | Medium | — |
| 7 | Generate `data_manifest.json` (4.1) | Medium (sync) | Low | — |
| 8 | Incremental photo lookups (3.2) | Low (perf) | Medium | — |
| 9 | Split `data.js` into composables (3.1) | Low (maintainability) | Medium | — |
| 10 | Shared NaN utility (2.1) | Low (DRY) | Low | -10 lines |

Items 1-4 are the highest value changes — they address the main maintainability bottleneck (2,611-line monolith) with relatively straightforward mechanical refactoring.
