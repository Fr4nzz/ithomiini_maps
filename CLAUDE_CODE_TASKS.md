# Claude Code Task List - Ithomiini Maps

## Quick Reference

**Project:** Ithomiini Butterfly Distribution Maps
**Repository:** https://github.com/Fr4nzz/ithomiini_maps
**Tech Stack:** Vue 3, Vite, Pinia, MapLibre GL JS, Python (Pandas)

---

## TASK 1: Fix GBIF Download (CRITICAL)

### Problem
The `scripts/gbif_download.py` only returns 47 records when there should be thousands.

### Diagnosis Steps
Run this command to see what's being rejected:

```bash
cd scripts
python -c "
import requests
import json

# Check total available
url = 'https://api.gbif.org/v1/occurrence/search'
params = {'taxonKey': 5568, 'hasCoordinate': 'true', 'limit': 0}
r = requests.get(url, params=params)
print(f'Total Ithomiini with coordinates: {r.json().get(\"count\", 0)}')

# Get sample records
params['limit'] = 10
r = requests.get(url, params=params)
for rec in r.json().get('results', []):
    print(f\"ID: {rec.get('key')} | species: {rec.get('species')} | scientificName: {rec.get('scientificName')}\")
"
```

### File Changes Required

**FILE:** `scripts/gbif_download.py`

**CHANGE 1:** Relax the `clean_scientific_name()` function

Find this function and modify it:

```python
def clean_scientific_name(name):
    """
    Clean species name - LESS AGGRESSIVE VERSION
    Only reject truly invalid records, not just unusual formats.
    """
    if not name:
        return None
    
    name = str(name).strip()
    
    # Only reject clear non-species identifiers
    if name.startswith('BOLD:') or name.startswith('SAMN'):
        return None
    
    # Remove author citations but keep the name
    # Pattern: "Genus species Author, Year" -> "Genus species"
    import re
    
    # Remove parenthetical authors: (Author, Year)
    cleaned = re.sub(r'\s*\([A-Z][a-zA-Z&\s\.\-]+,?\s*\d{4}\)', '', name)
    
    # Remove trailing author citations: Author, Year
    cleaned = re.sub(r'\s+[A-Z][a-zA-Z&\s\.\-]+,\s*\d{4}$', '', cleaned)
    
    # Clean whitespace
    cleaned = ' '.join(cleaned.split())
    
    # Must have at least two words (Genus species)
    if len(cleaned.split()) < 2:
        return None
    
    return cleaned
```

**CHANGE 2:** Add debug logging to see what's rejected

Add after line ~120 (in the `process_record` function):

```python
def process_record(rec):
    """Process a single GBIF occurrence record."""
    # ... existing code ...
    
    # Add debug counter at module level
    global _debug_stats
    if '_debug_stats' not in dir():
        _debug_stats = {'total': 0, 'no_coords': 0, 'no_name': 0, 'accepted': 0}
    
    _debug_stats['total'] += 1
    
    lat = rec.get('decimalLatitude')
    lng = rec.get('decimalLongitude')
    if lat is None or lng is None:
        _debug_stats['no_coords'] += 1
        return None
    
    # Get species - try multiple fields
    species_name = rec.get('species') or rec.get('scientificName') or rec.get('verbatimScientificName')
    cleaned_name = clean_scientific_name(species_name) if species_name else None
    
    if not cleaned_name:
        _debug_stats['no_name'] += 1
        return None
    
    _debug_stats['accepted'] += 1
    
    # ... rest of function
```

**CHANGE 3:** Print debug stats at end of download

Add at end of `main()`:

```python
def main():
    # ... existing code ...
    
    # After fetching all records, print debug stats
    if '_debug_stats' in dir():
        print("\n=== Record Processing Stats ===")
        print(f"Total examined: {_debug_stats['total']}")
        print(f"Rejected (no coords): {_debug_stats['no_coords']}")
        print(f"Rejected (invalid name): {_debug_stats['no_name']}")
        print(f"Accepted: {_debug_stats['accepted']}")
```

---

## TASK 2: Fix Mimicry Ring Lookup for GBIF

### Problem
Console shows: "Mimicry ring matched for 0/47 records" for GBIF

### Diagnosis
Add this debug code to `scripts/process_data.py`:

After line ~70 (after building MIMICRY_LOOKUP):

```python
def build_mimicry_lookup(dore_df):
    # ... existing code to build lookup ...
    
    # Debug: print sample keys
    print("   Sample lookup keys (first 5):")
    for i, key in enumerate(list(MIMICRY_LOOKUP.keys())[:5]):
        print(f"     '{key}'")
```

Then in `load_gbif_bulk_download()`, add before the mimicry lookup:

```python
# Debug: print sample GBIF species names
print("   Sample GBIF species names (first 5):")
for _, row in df.head().iterrows():
    sci = row.get('scientific_name', '')
    ssp = row.get('subspecies', '')
    print(f"     '{sci}' / '{ssp}'")
```

### Likely Fix
The issue is probably whitespace or case sensitivity. Update `lookup_mimicry()`:

```python
def lookup_mimicry(scientific_name, subspecies=None):
    """Look up mimicry ring with fuzzy matching."""
    if not scientific_name:
        return ('Unknown', 'Unknown')
    
    # Normalize: lowercase, strip whitespace, collapse multiple spaces
    sci_name_lower = ' '.join(scientific_name.lower().strip().split())
    
    # Try exact match with subspecies
    if subspecies:
        ssp_lower = ' '.join(str(subspecies).lower().strip().split())
        key = (sci_name_lower, ssp_lower)
        if key in MIMICRY_LOOKUP:
            return MIMICRY_LOOKUP[key]
    
    # Try species-only match
    species_key = (sci_name_lower, None)
    if species_key in MIMICRY_LOOKUP:
        return MIMICRY_LOOKUP[species_key]
    
    # Try partial match (genus + species only)
    parts = sci_name_lower.split()
    if len(parts) >= 2:
        short_key = (f"{parts[0]} {parts[1]}", None)
        if short_key in MIMICRY_LOOKUP:
            return MIMICRY_LOOKUP[short_key]
    
    return ('Unknown', 'Unknown')
```

---

## TASK 3: Delete Unused Files

### Files to Delete

```bash
rm src/components/HelloWorld.vue
```

Verify it's not imported anywhere:
```bash
grep -r "HelloWorld" src/
```

If no results, safe to delete.

---

## TASK 4: Add Country Filter (Optional Enhancement)

### File: `src/stores/data.js`

**ADD** to the `filters` ref (around line 25):
```javascript
const filters = ref({
    // ... existing filters ...
    country: 'All',  // ADD THIS LINE
})
```

**ADD** computed property (around line 180, near other unique* properties):
```javascript
const uniqueCountries = computed(() => {
    const set = new Set(
        allFeatures.value
            .map(i => i.country)
            .filter(isValidValue)
    )
    return Array.from(set).sort()
})
```

**ADD** to `filteredGeoJSON` filter logic (around line 250):
```javascript
// After the source filter check, add:
if (filters.value.country !== 'All' && item.country !== filters.value.country) return false
```

**ADD** to URL sync watcher (around line 280):
```javascript
if (newFilters.country !== 'All') params.set('country', newFilters.country)
```

**ADD** to `restoreFiltersFromURL()` (around line 95):
```javascript
if (params.get('country')) {
    filters.value.country = params.get('country')
}
```

**ADD** to `resetAllFilters()`:
```javascript
country: 'All',
```

**ADD** to return statement:
```javascript
uniqueCountries,
```

### File: `src/components/Sidebar.vue`

**ADD** after the "Data Source" filter section (around line 180):

```vue
<!-- Country Filter -->
<div class="filter-section">
  <label class="section-label">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
    Country
  </label>
  <FilterSelect
    v-model="store.filters.country"
    :options="['All', ...store.uniqueCountries]"
    placeholder="All Countries"
    :multiple="false"
    :show-count="false"
  />
</div>
```

---

## TASK 5: Update Status Colors

### File: `src/components/Sidebar.vue`

Find the `statusColors` object and ensure these new GBIF statuses are included:

```javascript
const statusColors = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Record': '#6b7280',
  'Observation': '#22c55e',        // ADD - Research Grade equivalent
  'Museum Specimen': '#8b5cf6',    // ADD - PRESERVED_SPECIMEN
  'Living Specimen': '#14b8a6',    // ADD - if present
}
```

Also update in:
- `src/components/MapEngine.vue` (STATUS_COLORS object)
- `src/components/DataTable.vue` (getStatusColor function)

---

## TASK 6: Improve Error Handling

### File: `src/stores/data.js`

Update `loadMapData()` to handle network errors gracefully:

```javascript
const loadMapData = async () => {
    loading.value = true
    try {
        const basePath = import.meta.env.BASE_URL || '/'
        const response = await fetch(`${basePath}data/map_points.json`)
        
        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format: expected array')
        }
        
        allFeatures.value = data
        console.log(`✓ Loaded ${data.length} records`)
        
        // Build photo lookup
        buildPhotoLookup(data)
        
        // Restore filters from URL
        restoreFiltersFromURL()
        
    } catch (e) {
        console.error('❌ Failed to load data:', e)
        allFeatures.value = []
        // Could emit an event or set an error state for UI display
    } finally {
        loading.value = false
    }
}
```

---

## Testing Commands

After making changes, test:

```bash
# 1. Rebuild GBIF data
cd scripts
python gbif_download.py
# Should show 1000+ records

# 2. Process all data
python process_data.py
# Check output:
# - "Mimicry ring matched for X/Y records" where X > 0 for GBIF
# - Total records should be ~35,000+

# 3. Start dev server
cd ..
npm run dev
# Open http://localhost:5173

# 4. Test in browser:
# - Select "GBIF" in Data Source filter
# - Verify table shows records with species names
# - Verify some GBIF records have mimicry rings

# 5. Build for production
npm run build

# 6. Deploy (push to main branch)
git add -A
git commit -m "Fix GBIF download and mimicry lookup"
git push
```

---

## Success Criteria

- [ ] GBIF download retrieves 1,000+ records
- [ ] At least 50% of GBIF records get mimicry rings assigned
- [ ] Map shows points from all three sources (Dore, Sanger, GBIF)
- [ ] Filters work correctly with GBIF data
- [ ] No console errors in browser
- [ ] GitHub Pages deployment succeeds
