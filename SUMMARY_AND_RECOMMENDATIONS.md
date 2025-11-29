# Ithomiini Maps - Summary & Recommendations

## GBIF Download Comparison

### Current Approach (`scripts/gbif_download.py`)
- Uses GBIF occurrence/search API directly
- Paginates through results (300 at a time)
- **Issue:** Too aggressive filtering - only 47 of 319 records pass

### Reference Approach (`Insect Vision - src/data/gbif_loader.py`)
- Uses GBIF async download API
- Downloads Darwin Core Archive (DWCA) ZIP files
- Processes `occurrence.txt` and `multimedia.txt`
- Has caching and retry logic
- **Advantage:** Gets ALL records, more reliable for large datasets

### Recommendation
For Ithomiini (~30K GBIF records), the current approach SHOULD work. The issue is the filtering logic, not the API choice. Fix the `clean_scientific_name()` function first. If still having issues, consider switching to the DWCA approach.

---

## Feature Completion Status

| Feature | Status | Notes |
|---------|--------|-------|
| Interactive Map | ✅ Complete | 5 base layers, popups, legend |
| Taxonomic Filters | ✅ Complete | Cascading dropdowns work |
| Multi-select Species | ✅ Complete | vue-multiselect integrated |
| Sequencing Status | ✅ Complete | Multi-select toggle buttons |
| Mimicry Ring Filter | ✅ Complete | Visual selector modal |
| CAMID Search | ✅ Complete | Instant filter |
| URL Deep Linking | ✅ Complete | All filters saved to URL |
| Data Table | ✅ Complete | Sorting, pagination, photos |
| Export CSV/GeoJSON | ✅ Complete | With citation generator |
| Image Gallery | ✅ Complete | Zoom, pan, keyboard nav |
| Map Export | ✅ Complete | High-res PNG/JPEG |
| Date Range Filter | ✅ Complete | Quick ranges + custom |
| GitHub Actions | ✅ Complete | Auto-deploy + manual data refresh |
| GBIF Integration | ⚠️ Needs Fix | Only 47 records loading |
| Mimicry Propagation | ⚠️ Partial | Works for Sanger, not GBIF |
| Country Filter | ❌ Not Added | Optional enhancement |
| Historical Layers | ❌ Not Started | Complex, defer |
| SDM Visualization | ❌ Not Started | Complex, defer |

---

## Priority Order for Fixes

1. **HIGH: Fix GBIF download** - This is blocking useful external data
2. **HIGH: Fix mimicry lookup** - GBIF records should show mimicry rings
3. **MEDIUM: Code cleanup** - Remove HelloWorld.vue
4. **LOW: Country filter** - Nice to have
5. **DEFERRED: Advanced features** - Historical layers, SDMs

---

## Files to Modify (Summary)

### Must Fix
- `scripts/gbif_download.py` - Relax filtering logic
- `scripts/process_data.py` - Fix mimicry lookup

### Should Clean
- `src/components/HelloWorld.vue` - DELETE

### Optional Enhancements
- `src/stores/data.js` - Add country filter
- `src/components/Sidebar.vue` - Add country dropdown
- `src/components/MapEngine.vue` - Add new status colors

---

## Quick Debug Commands

```bash
# Check how many GBIF records are available
curl "https://api.gbif.org/v1/occurrence/search?taxonKey=5568&hasCoordinate=true&limit=0" | jq '.count'

# Should return a number like 5000-50000

# Check current downloaded count
cat public/data/gbif_occurrences.json | jq 'length'

# Should match or be close to the API count
```

---

## Next Steps for User

1. Share these documents with Claude Code
2. Have Claude Code run the diagnostic commands first
3. Apply the fixes in order of priority
4. Test locally before deploying
5. Push to GitHub to trigger deployment

---

*Documents created:*
- `ITHOMIINI_MAPS_CODING_PLAN.md` - Detailed explanation and context
- `CLAUDE_CODE_TASKS.md` - Actionable task list with code snippets
