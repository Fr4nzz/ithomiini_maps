# Ithomiini Maps - Comprehensive Coding Plan for Claude Code

## Executive Summary

This document provides a detailed coding plan to complete the Ithomiini butterfly mapping website. The project is approximately 70% complete with a solid foundation. This plan addresses remaining features, bug fixes, code cleanup, and improvements to the GBIF download process.

---

## Current State Assessment

### ✅ Completed Features (Working)
- Vue.js 3 + Vite + Pinia architecture
- MapLibre GL JS with 5 base layer styles
- Basic taxonomic filtering (Family → Tribe → Genus → Species → Subspecies)
- Sequencing status filter with multi-select
- Data source filter
- CAMID search
- URL deep linking for filter state
- Data table with sorting and pagination
- CSV/GeoJSON export with citation generator
- Mimicry ring visual selector modal
- Image gallery with zoom/pan
- Map export for publications
- Date range filter component
- GitHub Actions for deployment
- Python ETL pipeline (process_data.py)

### ⚠️ Partially Working / Needs Fixes
1. **GBIF Download** - Only fetching 47 records (should be thousands)
2. **Mimicry Ring Propagation** - Working for Sanger (5,258/7,855) but 0/47 for GBIF
3. **Multi-select filters** - vue-multiselect installed but may need refinement

### ❌ Missing from Original Plan
1. **Predictive Modeling Visualization** (Step 3 - Advanced)
2. **Historical Satellite Layers** (Step 3 - Advanced)
3. **Taxonomic Synonym Resolution** (Step 3 - Advanced)
4. **Heatmap/Polygon Generation** for publications

---

## PART 1: Critical Bug Fixes (Priority: HIGH)

### Task 1.1: Fix GBIF Download Script

**Problem:** The current `gbif_download.py` only retrieves 47 records when there should be thousands of Ithomiini occurrences.

**Root Cause Analysis:**
Looking at the console output:
```
Total records available: 319
Batch 1: fetching records 1 - 300...
Batch 2: fetching records 301 - 319...
Total records processed: 47
```

The script found 319 records but only processed 47. This suggests the filtering/cleaning logic is too aggressive.

**Compare with Reference Implementation (from Insect Vision project):**
The `src/data/gbif_loader.py` in the Insect Vision project uses a different approach:
- Uses GBIF's async download system (`/v1/occurrence/download/request`)
- Downloads Darwin Core Archive (DWCA) files
- Processes `occurrence.txt` and `multimedia.txt` files
- Has robust caching and error handling

**Fix Instructions for Claude Code:**

```
FILE: scripts/gbif_download.py

CHANGES NEEDED:

1. INCREASE RECORD RETRIEVAL:
   - The current script queries with taxonKey=5568 (tribe Ithomiini)
   - But GBIF's occurrence/search endpoint has a limit of 100,000 records
   - The issue is likely in the clean_scientific_name() function being too strict

2. RELAX SPECIES NAME CLEANING:
   - Current regex removes valid records with author citations
   - Many GBIF records have species like "Mechanitis polymnia" with no author
   - The BOLD:xxx filter is good, keep that
   - But don't reject records just because species name format is unusual

3. ADD SEARCH BY FAMILY AS FALLBACK:
   - If tribe search returns few results, also search by:
     - Family: Nymphalidae (familyKey)
     - Subfamily: Danainae (if available)
   - Then filter client-side for Ithomiini

4. IMPLEMENT OCCURRENCE DOWNLOAD API (RECOMMENDED):
   Use the bulk download approach like Insect Vision project:
   
   def request_bulk_download():
       # 1. Submit download request to GBIF
       # 2. Wait for processing (can take minutes)
       # 3. Download ZIP file
       # 4. Extract and parse occurrence.txt
   
   This gets ALL records, not just API-limited results.

5. ADD BETTER LOGGING:
   - Log WHY records are being rejected
   - Show sample of rejected records for debugging
```

**New Function to Add:**

```python
def debug_rejected_records(records, max_show=10):
    """
    Log why records are being rejected during cleaning.
    Helps identify overly aggressive filtering.
    """
    rejected = []
    for rec in records[:100]:  # Sample first 100
        sci_name = rec.get('scientificName', '')
        species = rec.get('species', '')
        
        # Test each rejection criterion
        reasons = []
        if not species and not sci_name:
            reasons.append("no species name")
        if 'BOLD:' in str(species):
            reasons.append("BOLD sequence ID")
        # ... etc
        
        if reasons:
            rejected.append({
                'gbifID': rec.get('key'),
                'species': species,
                'scientificName': sci_name,
                'reasons': reasons
            })
    
    print(f"\n=== DEBUG: Sample Rejected Records ===")
    for r in rejected[:max_show]:
        print(f"  {r['gbifID']}: {r['scientificName']} - {r['reasons']}")
```

---

### Task 1.2: Fix Mimicry Ring Propagation for GBIF

**Problem:** Console shows "Mimicry ring matched for 0/47 records" for GBIF data.

**Root Cause:** The lookup is case-sensitive or species names don't match format.

**Fix Instructions:**

```
FILE: scripts/process_data.py

FUNCTION: lookup_mimicry()

ISSUE: The lookup uses lowercase keys but GBIF species names might have 
different formatting than Dore database.

DEBUGGING NEEDED:
1. Print sample GBIF species names before lookup
2. Print sample Dore lookup keys
3. Compare formats

LIKELY FIX:
- Normalize both sides: strip whitespace, lowercase, remove extra spaces
- Try fuzzy matching for close matches (e.g., using difflib.get_close_matches)

ADD THIS DEBUG CODE:
```python
def lookup_mimicry_debug(scientific_name, subspecies=None):
    """Debug version that logs misses"""
    result = lookup_mimicry(scientific_name, subspecies)
    if result == ('Unknown', 'Unknown'):
        # Log the miss
        print(f"  MISS: '{scientific_name}' / '{subspecies}'")
        # Show closest matches
        from difflib import get_close_matches
        all_keys = [k[0] for k in MIMICRY_LOOKUP.keys()]
        close = get_close_matches(scientific_name.lower(), all_keys, n=3, cutoff=0.8)
        if close:
            print(f"    Close matches: {close}")
    return result
```

---

## PART 2: Code Cleanup (Priority: MEDIUM)

### Task 2.1: Remove Redundant/Unused Files

**Files to Review and Potentially Remove:**

```
scripts/step1_probe_local.py     - Probe script, keep for debugging
scripts/step1_probe_gsheets.py   - Probe script, keep for debugging  
scripts/step1_probe_gbif.py      - Probe script, keep for debugging
scripts/debug_gbif.py            - Debug script, keep for debugging

src/components/HelloWorld.vue    - DELETE - Default Vite template file, not used

src/assets/vue.svg               - DELETE if not used in UI
```

**Check These Files:**
- Review if `HelloWorld.vue` is imported anywhere (likely not)
- Check if `vue.svg` is referenced in any component

### Task 2.2: Consolidate GBIF Scripts

Currently there are multiple GBIF-related scripts:
- `scripts/gbif_download.py` - Main download script
- `scripts/debug_gbif.py` - Debug/inspection script
- `scripts/step1_probe_gbif.py` - API structure probe

**Recommendation:** Keep them separate for now but add clear docstrings explaining purpose.

---

## PART 3: New Features to Implement (Priority: MEDIUM-LOW)

### Task 3.1: Add Country Filter

**Why:** The data has country information, users might want to filter by region.

**Implementation:**

```
FILE: src/stores/data.js

ADD to filters object:
  country: 'All',

ADD computed property:
  const uniqueCountries = computed(() => {
    const set = new Set(
      allFeatures.value
        .map(i => i.country)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

ADD to filteredGeoJSON filter logic:
  if (filters.value.country !== 'All' && item.country !== filters.value.country) return false

ADD to URL sync:
  if (newFilters.country !== 'All') params.set('country', newFilters.country)


FILE: src/components/Sidebar.vue

ADD in filter sections (after Data Source):
  <div class="filter-section">
    <label class="section-label">
      <svg>...</svg>
      Country
    </label>
    <FilterSelect
      v-model="store.filters.country"
      :options="['All', ...store.uniqueCountries]"
      placeholder="All Countries"
      :multiple="false"
    />
  </div>
```

### Task 3.2: Add Observation Quality Filter for GBIF

**Why:** GBIF has `basisOfRecord` which indicates data quality (HUMAN_OBSERVATION = citizen science like iNaturalist, PRESERVED_SPECIMEN = museum specimen).

**Implementation:**

The `sequencing_status` field already maps these:
- `HUMAN_OBSERVATION` → 'Observation'
- `PRESERVED_SPECIMEN` → 'Museum Specimen'

These are already filterable via the Status filter. No additional work needed, but could add tooltips explaining what each means.

### Task 3.3: Improve Photo Thumbnail in Table

**Current State:** Photo thumbnails show in DataTable with indicator for "not same individual".

**Enhancement:** Add hover tooltip showing full species name and whether it's from same individual.

```
FILE: src/components/DataTable.vue

CHANGE the photo-wrapper div to include more info:

<div 
  class="photo-wrapper" 
  :class="{ 'other-individual': !getPhotoInfo(row).sameIndividual }"
  :title="getPhotoTooltip(row)"
>

ADD method:
const getPhotoTooltip = (row) => {
  const info = getPhotoInfo(row)
  if (!info) return 'No photo available'
  if (info.sameIndividual) return `Photo of ${row.id}`
  return `Reference photo from ${info.fromId} (same species)`
}
```

---

## PART 4: Advanced Features (Priority: LOW - Future)

These are from the original Step 3 plan but are complex and can be deferred:

### Task 4.1: Historical Satellite Layers
- Requires external tile server or Cloud-Optimized GeoTIFFs
- Google Earth Engine integration possible but needs API key
- **Recommendation:** Defer until core features stable

### Task 4.2: Predictive Modeling (SDMs)
- Requires offline Python processing with bioclimatic data
- Would need to integrate WorldClim or similar datasets
- Output as GeoJSON polygons/heatmaps
- **Recommendation:** Separate project, load results as additional layer

### Task 4.3: Taxonomic Synonym Resolution
- GBIF API has backbone taxonomy with synonyms
- Could auto-correct old names to accepted names
- **Recommendation:** Add as enhancement to process_data.py

---

## PART 5: Step-by-Step Implementation Order

### Phase 1: Bug Fixes (Do First)

1. **Debug GBIF download issue**
   - Run `debug_gbif.py` to see full record count
   - Identify why records are being filtered out
   - Fix `clean_scientific_name()` function
   - Re-run download and verify thousands of records

2. **Fix mimicry ring propagation**
   - Add debug logging to lookup function
   - Identify name format mismatches
   - Implement fuzzy matching if needed
   - Verify GBIF records get mimicry rings

3. **Test full data pipeline**
   - Run `python scripts/gbif_download.py`
   - Run `python scripts/process_data.py`
   - Verify output statistics show proper GBIF count

### Phase 2: Code Cleanup

4. **Remove unused files**
   - Delete `HelloWorld.vue`
   - Delete unused assets
   - Run `npm run build` to verify no broken imports

5. **Add documentation**
   - Update README with current feature list
   - Add comments to complex functions
   - Document GBIF download process

### Phase 3: Enhancements

6. **Add Country filter** (if desired)

7. **Improve photo tooltips**

8. **Add loading states for slow operations**

---

## Files Reference Summary

### Files to Modify:
| File | Changes |
|------|---------|
| `scripts/gbif_download.py` | Fix record filtering, add debug logging |
| `scripts/process_data.py` | Fix mimicry lookup, add fuzzy matching |
| `src/stores/data.js` | Add country filter (optional) |
| `src/components/Sidebar.vue` | Add country dropdown (optional) |
| `src/components/DataTable.vue` | Improve photo tooltips |

### Files to Delete:
| File | Reason |
|------|--------|
| `src/components/HelloWorld.vue` | Unused template file |

### Files to Keep (No Changes):
- All other Vue components are working correctly
- GitHub Actions workflows are properly configured
- Vite config is correctly set up for GitHub Pages

---

## Testing Checklist

After implementing fixes, verify:

- [ ] GBIF download retrieves 1000+ records
- [ ] Mimicry rings assigned to GBIF records (check console output)
- [ ] Map displays points from all three sources
- [ ] Filters cascade correctly
- [ ] URL sharing works (copy URL, open in new tab, filters restore)
- [ ] Data table shows all records with proper formatting
- [ ] Export CSV includes all columns
- [ ] Gallery shows images (if any have photos)
- [ ] Deploy to GitHub Pages works

---

## Commands for Claude Code

```bash
# 1. Navigate to project
cd /path/to/ithomiini_maps

# 2. Debug GBIF issue
cd scripts
python debug_gbif.py > gbif_debug_output.txt

# 3. After fixing, re-download
python gbif_download.py

# 4. Process all data
python process_data.py

# 5. Test locally
cd ..
npm run dev

# 6. Build for production
npm run build

# 7. Preview build
npm run preview
```

---

## Appendix: Improved GBIF Download Script (Reference)

Here's a more robust version of the GBIF download approach, inspired by the Insect Vision project:

```python
"""
IMPROVED GBIF DOWNLOAD STRATEGY

Option A: Use occurrence/search API with relaxed filtering
- Faster, simpler
- Limited to 100,000 records

Option B: Use async download API (DWCA)
- Gets ALL records
- Slower (requires waiting for GBIF to prepare)
- More reliable for large datasets

For Ithomiini with ~30,000+ GBIF records, Option A should work.
The issue is likely overly aggressive filtering.
"""

def fetch_ithomiini_relaxed():
    """
    Fetch Ithomiini with minimal filtering to maximize records.
    """
    # Try multiple taxon keys
    TAXON_KEYS = {
        'tribe_ithomiini': 5568,
        # Add subfamily/family as backup
    }
    
    all_records = []
    
    for name, key in TAXON_KEYS.items():
        params = {
            'taxonKey': key,
            'hasCoordinate': 'true',
            'limit': 300,
            'offset': 0
        }
        
        # Fetch all pages
        while True:
            response = requests.get(
                'https://api.gbif.org/v1/occurrence/search',
                params=params,
                timeout=60
            )
            data = response.json()
            
            results = data.get('results', [])
            if not results:
                break
            
            # MINIMAL FILTERING - only reject truly invalid records
            for rec in results:
                # Must have coordinates
                if not rec.get('decimalLatitude') or not rec.get('decimalLongitude'):
                    continue
                
                # Must have some species identification
                species = rec.get('species') or rec.get('scientificName')
                if not species:
                    continue
                
                # Reject obvious non-species (BOLD IDs, etc)
                if species.startswith('BOLD:') or species.startswith('SAMN'):
                    continue
                
                all_records.append(rec)
            
            params['offset'] += 300
            
            # Safety limit
            if params['offset'] > 50000:
                break
    
    return all_records
```

---

*End of Coding Plan*
