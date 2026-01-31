# Codebase Optimization Plan

Full audit of all source files. Findings organized by priority and category.

**Codebase stats**: ~18,400 lines frontend (JS/Vue/CSS), ~4,000 lines backend (Python).

---

## Table of Contents

1. [Dead Code Removal](#1-dead-code-removal)
2. [File Splitting (Large Files)](#2-file-splitting-large-files)
3. [Code Duplication](#3-code-duplication)
4. [Hacky Implementations](#4-hacky-implementations)
5. [Performance Issues](#5-performance-issues)
6. [CSS Cleanup](#6-css-cleanup)
7. [Python Backend](#7-python-backend)

---

## 1. Dead Code Removal

Estimated **~600+ lines** of dead JS/TS code and **~200+ lines** of dead CSS that can be removed immediately.

### 1.1 `src/utils/canvasHelpers.js` -- 95% dead (HIGH)

Only `loadImage` (8 lines) is used (by `App.vue`). The remaining **161 lines** are unused:
- `roundRect` (line 2)
- `calculateExportRegion` (line 26)
- `drawLegendOnCanvas` (line 50) -- 87 lines
- `drawAttributionOnCanvas` (line 140)

**Action**: Move `loadImage` to a smaller utility or inline it into `App.vue`. Delete the rest of the file.

### 1.2 `src/utils/colors.js` -- 13 dead exports (~180 lines) (HIGH)

| Lines | Export | Why dead |
|-------|--------|----------|
| 6 | Re-exports (`STATUS_COLORS`, `SOURCE_COLORS`, `DYNAMIC_COLORS`, `getStatusColor`) | Consumers import directly from `constants.js` |
| 51 | `lightenColor` | Never imported |
| 69 | `darkenColor` | Never imported |
| 87 | `colorWithAlpha` | Never imported |
| 115 | `getContrastTextColor` | Never imported |
| 130 | `generateColorPalette` | Shadowed by local version in `stores/data.js:1253` |
| 155 | `getColorForValue` | Never imported |
| 182 | `getStatusCSSVars` | Never imported |
| 195 | `getSourceCSSVars` | Never imported |
| 231 | `COLOR_PICKER_SWATCHES` | Never imported |

**Action**: Remove all dead exports. Keep only: `generateSpeciesBorderColors`, `generateSpeciesBaseHues`, `generateGroupedColorMap`, `generateSpeciesGradientColors`, `COLOR_PICKER_PALETTE`, `generate3ColorPreview`, `hslToHex`.

### 1.3 `src/utils/shapes.js` -- 6 dead exports (~80 lines) (MEDIUM)

| Lines | Export | Why dead |
|-------|--------|----------|
| 20 | `SHAPE_NAMES` | Never imported |
| 35 | `SHAPE_ROTATION` | Only used by dead `generateShapeAssignments` |
| 177 | `ensureColoredShapeImage` | `useMapEngine.js` inlines equivalent logic |
| 199 | `loadColoredShapeImages` | Never imported |
| 231 | `cleanupUnusedShapeImages` | No-op function (does nothing) |
| 250 | `generateShapeAssignments` | Never imported |

**Action**: Remove dead exports. Keep only: `SHAPE_OPTIONS`, `generateColoredShapeImage`, `getColoredShapeImageName`, `buildColoredShapeExpression`.

### 1.4 `src/stores/data.js` -- dead computeds and exports (MEDIUM)

| Lines | Item | Why dead |
|-------|------|----------|
| 1069-1105 | `speciesGroups` computed | Never referenced anywhere |
| 1111-1147 | `genusGroups` computed | Never referenced anywhere |
| 530-538 | `toggleAdvancedFilters` | Never called externally |
| 540-546 | `toggleMimicryFilter` | Never called externally |
| 121-123 | `customColors` ref | Always empty; legend store has the real one |
| 113-118 | `urlSettings` ref | Never consumed to control behavior |
| 912-937 | `coordinateGroups` export | Only used internally |

**Action**: Remove dead computeds/exports. Unexport internal-only items.

### 1.5 `src/stores/legend.js` -- 16+ unused exports (MEDIUM)

These functions are exported but never imported by any component:
`canGroup`, `groupByOptions`, `shouldShowPrefix`, `getDisplayLabel`, `getDisplayColor`, `getDefaultAbbreviation`, `toggleHeaders`, `toggleSortOrder`, `resetPosition`, `resetSize`, `resetAll`, `resetSpeciesStyling`, `resetShapeSettings`, `setGroupingEnabled`, `setGroupBy`, `setAbbreviationStyle`, `setPrefixEnabled`, `setSpeciesBorderColorEnabled`, `setSpeciesGradientEnabled`, `setShapesEnabled`, `setShapeAssignBy`, `setWrapLabels`, `setShowCounts`.

**Action**: Remove unused exports or make them private (un-exported).

### 1.6 `src/stores/theme.js` -- 2 dead exports (LOW)

- `cycleTheme` (line 123) -- never called
- `getCurrentThemeData` (line 133) -- never called

### 1.7 Other dead code (LOW)

| File | Item |
|------|------|
| `useMapEngine.js` | `generateCirclePolygon` and `generateGeoCircle` are identical -- remove one |
| `useMapEngine.js` | `boundariesLoaded`, `setBoundaries` exports -- never used |
| `clusterStats.js` | `kmToMeters`, `geoRadiusToPixels` -- never imported |
| `abbreviations.js` | `ABBREVIATION_FORMATS`, `getFormatLabel` -- never imported |
| `dateHelpers.js` | `formatDate` -- never imported |
| `presets.js` | `getThemeNames` -- never imported |
| `rExport.js` | Unused imports: `SHAPE_OPTIONS`, `generateAbbreviationOptions`; dead vars: `rLegendX`, `rLegendY`, `legendPosX`, `legendPosY` |
| `ExportPanel.vue` | `exportError` ref defined (line 25) but never displayed in template; ~120 lines dead CSS |
| `ImageGallery.vue` | `subspeciesCount` computed (line 156) never used; `allFilteredIndividuals` destructured but unused |
| `Legend.vue` | `adjustPositionForNewBounds()` (line 741) never called; empty watcher (line 1407) |
| `MapEngine.vue` | Empty watcher for `legendStore.groupingSettings` (line 520); console.log left in (line 422) |
| `persistence.js` | `watch` import unused; `saveAllState` references non-existent `legendStore.itemOrder` |
| `SidebarMapSettings.vue` | ~77 lines dead CSS (`.section-label`, `.setting-hint`, `.slider-value`, `.style-select`, `.color-picker-row`, etc.) |
| `LegendToolbar.vue` | ~20 lines dead CSS (`.settings-select`) |
| `LegendItem.vue` | Dead CSS `.legend-dot` class |

### 1.8 Unused Vue imports in components (LOW)

| File | Unused import |
|------|--------------|
| `PointPopup.vue` | `getStatusColor` |
| `LegendGroupHeader.vue` | `generateAbbreviationOptions` |
| `LegendGroupStylePopup.vue` | `watch` |
| `AbbreviationDropdown.vue` | `watch`, `ChevronDown` |

---

## 2. File Splitting (Large Files)

Six files exceed 1,000 lines. Two composable/store files exceed 1,400 lines and contain multiple independent concerns.

### 2.1 `src/composables/useMapEngine.js` (1,462 lines) -- Split into ~6 files (HIGH)

This file contains **8 independent composable functions** bundled together. Each has its own state, its own parameters, and no shared mutable state:

| Composable | Lines | Proposed file |
|------------|-------|---------------|
| `MAP_STYLES` + `getBasemapPair` + `getStylesByTheme` | ~185 | `utils/mapStyles.js` |
| `useLocationSearch` | ~120 | `composables/useLocationSearch.js` |
| `useExportPreview` | ~75 | `composables/useExportPreview.js` |
| `useScatterVisualization` | ~100 | `composables/useScatterVisualization.js` |
| `useDataLayer` | ~770 | `composables/useDataLayer.js` (still large but cohesive) |
| `useStyleSwitcher` | ~55 | `composables/useStyleSwitcher.js` |
| `useScaleBar` | ~40 | `composables/useScaleBar.js` |
| `useCountryBoundaries` | ~95 | `composables/useCountryBoundaries.js` |

### 2.2 `src/stores/data.js` (1,545 lines) -- Split into ~4 modules (HIGH)

| Concern | Lines | Proposed file |
|---------|-------|---------------|
| Filter state + cascade watchers + URL sync | ~400 | `stores/filters.js` |
| Photo lookup logic | ~200 | `stores/photoLookup.js` |
| Color/palette logic | ~170 | `stores/colorMapping.js` |
| Data loading/source management | ~100 | `stores/dataLoader.js` |
| Core store (remaining) | ~675 | `stores/data.js` |

### 2.3 `src/components/Sidebar.vue` (1,899 lines) (MEDIUM)

Extractable sub-components:
- **Database update section** (lines 86-147 script + 721-793 template) -> `DatabaseUpdateSection.vue`
- **Export settings** (lines 149-202 script + 286-426 template) -> Already exists as `ExportPanel.vue`; verify no duplication
- **CSS** (lines 836-1899 = 1,060 lines of CSS): Shared styles (`.style-select` / `.sex-select` duplication) should use shared classes

### 2.4 `src/components/Legend/Legend.vue` (1,891 lines) (MEDIUM)

Extractable composables:
- **Drag handling** (lines 631-731) -> `composables/useLegendDrag.js`
- **Position management** (lines 741-892) -> `composables/useLegendPosition.js`
- **Attribution observer** (lines 1036-1105) -> `composables/useAttributionObserver.js`
- **Auto-sizing** (lines 1308-1370) -> `composables/useLegendAutoSize.js`

### 2.5 `src/components/MapEngine.vue` (1,592 lines) (MEDIUM)

- **All watchers** (lines 372-580) -> `composables/useMapReactivity.js` -- reactive bridge between stores and map
- **Map layer/theme dropdown** (lines 122-175) -> `MapControls.vue` sub-component

### 2.6 `src/utils/rExport.js` (1,532 lines) (LOW)

Contains a 982-line R template literal. This is inherently hard to split, but the `generateMapHTML` function (lines 1112-1260) could be a separate file `utils/htmlExport.js`.

### 2.7 Other files over 1,000 lines (LOW priority, less clear splits)

- `ImageGallery.vue` (1,392) -- Thumbnail strip (lines 670-793) could be `ThumbnailStrip.vue`
- `MimicrySelector.vue` (1,217) -- Ring cards are duplicated; see duplication section

---

## 3. Code Duplication

### 3.1 Click-outside handler -- 5 implementations (HIGH)

**5 components** each implement their own `handleClickOutside` + `onMounted`/`onUnmounted` lifecycle:
- `LegendColorPicker.vue` (lines 117-130) -- uses `click` event
- `LegendToolbar.vue` (lines 119-138) -- uses `mousedown`
- `AbbreviationDropdown.vue` (lines 125-137) -- uses `mousedown`
- `LegendGroupStylePopup.vue` (lines 85-97) -- uses `mousedown`
- `Legend.vue` (lines 1147-1204)

Also inconsistent: one uses `click`, others use `mousedown`.

**Action**: Create `composables/useClickOutside.js`. VueUse has `onClickOutside` which is already a dependency.

### 3.2 Species navigation logic -- 3 components (HIGH)

`PointPopup.vue`, `ImageGallery.vue`, and `GallerySidebar.vue` all independently implement:
- `subspeciesList` computed with identical sort logic
- `individualsList` computed
- `selectSpecies()` handler
- `selectSubspecies()` handler
- `locationName` computed (identical expression in 2 files)

`useGalleryData.js` exists but only provides `groupedBySpecies` and `speciesList`, not the navigation logic.

**Action**: Extend `useGalleryData.js` to include `subspeciesList`, `individualsList`, `selectSpecies`, `selectSubspecies`, `locationName`. (~120 lines saved)

### 3.3 `generateCirclePolygon` == `generateGeoCircle` in `useMapEngine.js` (HIGH)

Lines 385-398 and 528-541 are **byte-for-byte identical functions**. Direct copy-paste.

**Action**: Delete one, rename the other. (~15 lines)

### 3.4 SVG shape rendering -- 2 identical blocks (MEDIUM)

`LegendColorPicker.vue` (lines 143-175) and `LegendItem.vue` (lines 133-172) render identical SVG shapes (circle/square/triangle/rhombus) with the same viewBox and coordinates.

**Action**: Extract to `ShapeIcon.vue` component. (~40 lines saved)

### 3.5 Specimen detail section -- 2 components (MEDIUM)

`PointPopup.vue` (lines 392-438) and `GallerySidebar.vue` (lines 104-168) render identical specimen detail views (Date, Mimicry Ring, Source, Status dot, Country, Coordinates, Observation link).

**Action**: Create `SpecimenDetails.vue` component. (~60 lines saved)

### 3.6 MimicrySelector template duplication (MEDIUM)

"Available Rings" (lines 310-435) and "Unavailable Rings" (lines 437-549) are ~200 lines of near-identical template. Species/subspecies navigation arrows are duplicated verbatim (~60 lines each).

**Action**: Extract `MimicryRingCard.vue` component. (~200 lines saved)

### 3.7 Map layer cleanup pattern -- 7 repetitions in `useMapEngine.js` (MEDIUM)

The `if (map.getLayer(id)) removeLayer(id); if (map.getSource(id)) removeSource(id)` pattern is repeated at lines 427, 551, 616, 646, 788, 805, 1395.

**Action**: Extract `removeLayerAndSource(map, layerId, sourceId)` helper. (~50 lines saved)

### 3.8 MapEngine watchers -- 8 identical watchers (MEDIUM)

Lines 438-518 have 8 consecutive watchers all doing the exact same thing: `watch(() => storeProperty, () => { if (map && loaded) addDataLayer({ skipZoom: true }) }, { deep: true })`.

**Action**: Consolidate into a single watcher watching an array of sources.

### 3.9 `uniqueX` computed properties in `data.js` -- 9 near-identical (MEDIUM)

Lines 592-716: `uniqueFamilies`, `uniqueTribes`, `uniqueGenera`, `uniqueSpecies`, `uniqueSubspecies`, `uniqueMimicry`, `uniqueStatuses`, `uniqueCountries`, `uniqueCamids` all follow `Array.from(new Set(data.map(f => f.FIELD).filter(isValidValue))).sort()`.

**Action**: Create `uniqueValuesOf(data, field)` helper. (~80 lines saved)

### 3.10 `getStorage`/`setStorage` duplicated between stores (LOW)

`data.js` (lines 16-17) and `legend.js` (lines 8-16) define identical persistence helpers.

**Action**: Move to a shared `utils/storageHelpers.js`.

### 3.11 `@keyframes spin` -- 4 identical definitions (LOW)

Defined in `App.vue`, `ImageGallery.vue`, `Sidebar.vue`, `MapEngine.vue`.

**Action**: Move to global `style.css`.

### 3.12 `imageProxy.js` -- 3 functions sharing same pattern (LOW)

All three exported functions repeat the same null-check/extract/encode/return pattern.

**Action**: Extract internal `buildProxyUrl(url, params)` helper.

---

## 4. Hacky Implementations

### 4.1 Double `nextTick` pattern (HIGH)

Appears in 3+ places in `Legend.vue` (lines 623, 1297-1301, 1350) and `MapEngine.vue` (lines 80-103, 555-575):
```js
nextTick(() => { nextTick(() => { /* actual logic */ }) })
```
This is fragile timing-dependent code.

**Action**: Replace with `ResizeObserver`, `MutationObserver`, or `requestAnimationFrame` depending on context.

### 4.2 `setTimeout` for style-change waiting (HIGH)

`MapEngine.vue` lines 137-141 and 169-173 use `setTimeout(..., 500)` to wait for map style to load before re-adding boundaries.

**Action**: Use MapLibre's `style.load` event instead.

### 4.3 Nested `setTimeout` for initialization (MEDIUM)

`Legend.vue` lines 1151-1197 use `setTimeout(..., 150)` and `setTimeout(..., 300)` with magic numbers for DOM settling.

**Action**: Use `ResizeObserver` waiting for stable container size.

### 4.4 Timing-based race condition mitigation in `useMapEngine.js` (MEDIUM)

- Line 776: `if (timeSinceUpdate < 200)` -- 200ms gate
- Line 1313: `setTimeout(() => setStyleChanging(false), 100)` -- 100ms delay
- Line 525: `Date.now()` timestamp tracking

**Action**: Replace with explicit state flags or promise chains.

### 4.5 Hardcoded password in client-side code (MEDIUM)

`Sidebar.vue` line 104: `if (updatePassword.value !== 'Hyalyris')` -- visible in JS bundle. Also `cloudflare-worker.js` line 15 has it in a comment.

**Action**: Move validation entirely server-side. Remove client-side password check.

### 4.6 Hardcoded deployment config (LOW)

`Sidebar.vue` lines 97-100: `WORKER_URL`, `GITHUB_OWNER`, `GITHUB_REPO` hardcoded in component.

**Action**: Move to `import.meta.env` environment variables.

### 4.7 Canvas-based text measurement (LOW)

`Legend.vue` lines 379-387 create a hidden canvas for text measurement with hardcoded font stack.

**Action**: Measure actual DOM elements instead.

### 4.8 Inline SVG data URL for error fallback (LOW)

`MimicrySelector.vue` line 336: Long inline SVG data URI in template `@error` handler. Inconsistently applied (missing from unavailable section).

**Action**: Extract to a constant. Apply consistently.

### 4.9 Reactive Sets stored in `ref` (LOW)

`ImageGallery.vue` lines 39-40: `ref(new Set())` -- Vue doesn't track `Set.add()`/`Set.delete()`. Code works around this by creating new Sets on every toggle.

**Action**: Use `reactive(new Set())` (Vue 3.4+) or use a plain object.

### 4.10 MimicrySelector navigation functions not memoized (LOW)

Lines 65-121: `getGroupedReps()`, `getSpeciesList()`, `getCurrentSpecies()`, `getCurrentSubspecies()`, `getCurrentRep()` are plain functions called from template for every ring card. They recalculate on every render.

**Action**: Convert to a single computed `Map<ringName, navigationState>`.

---

## 5. Performance Issues

### 5.1 Deep watchers on large GeoJSON (HIGH)

- `MapEngine.vue` line 372: `watch(() => store.displayGeoJSON, ..., { deep: true })` -- deep watches potentially thousands of Feature objects
- `MapEngine.vue` lines 438-518: 8 separate `{ deep: true }` watchers on legend store properties

**Action**: Replace with shallow comparison. Use a version counter that increments on any styling change, so a single watcher can detect all changes.

### 5.2 O(N) linear scan in `getPointsAtCoordinates` (MEDIUM)

`data.js` lines 839-849: Scans all features on every point click.

**Action**: Use coordinate groups (already computed) or a spatial index.

### 5.3 CAMID search inefficiency (MEDIUM)

`data.js` lines 765-778: `searchTerms` are split and uppercased inside the loop for every item. `useCamidAutocomplete.js` line 43 uses `.includes()` (substring) despite data being sorted "for binary search potential."

**Action**: Compute search terms once before the loop. Remove misleading sort comment.

### 5.4 Template function calls per row (MEDIUM)

`DataTable.vue`: `getPhotoInfo(row)` called 4 times per row; `getCorrectionInfo(row)` called 4 times per row.

**Action**: Compute once per row using a local variable.

### 5.5 `filteredGeoJSON` creates new objects every recomputation (LOW)

`data.js` lines 818-825: Every item wrapped in `{ type: 'Feature', geometry: ..., properties: item }` on every filter change.

**Action**: Consider caching Feature wrappers or using a version counter.

### 5.6 Shape image regeneration on every data update (LOW)

`useMapEngine.js` lines 945-971: Re-generates colored shape images even when colors haven't changed.

**Action**: Cache shape images by color/shape key. Only regenerate on color or shape changes.

---

## 6. CSS Cleanup

### 6.1 Hardcoded accent colors -- 80+ occurrences across 18 files (HIGH)

`rgba(74, 222, 128, ...)` is hardcoded as raw values in 80+ places. Similarly, `#3d3d5c`, `#4ade80`, `#1a1a2e`, `#2a2a4a` appear 300+ times, often without CSS variable wrappers.

**Action**: Define opacity variants in `index.css` (e.g., `--color-accent-5`, `--color-accent-10`, `--color-accent-15`). Replace all raw values with `var()` references. This also enables theme switching.

### 6.2 `GallerySidebar.vue` -- entirely hardcoded colors (HIGH)

This component does not use any CSS custom properties. All colors are hardcoded dark-theme values. It will not respond to theme changes.

**Action**: Replace all hardcoded colors with `var(--color-*)` references.

### 6.3 Conflicting CSS variable definitions (MEDIUM)

`index.css` (lines 31-34) and `style.css` (lines 34-37) both define `--radius-sm/md/lg/xl` with different values. Two separate `body` rules. Two different `--font-*` variable names for the same font stack.

**Action**: Consolidate into one file. Remove duplicates.

### 6.4 Unused CSS variables in `style.css` (MEDIUM)

13 CSS custom properties defined but never used:
- `--font-size-xs/sm/base/lg/xl` (5 vars)
- `--spacing-xs/sm/md/lg/xl` (5 vars)
- `--shadow-sm`, `--shadow-lg`
- `--transition-slow`

**Action**: Remove all 13 unused CSS variables.

### 6.5 Unused legacy theme variables in `index.css` (MEDIUM)

4 CSS variables defined in every theme block but never consumed:
- `--color-danger-hover`, `--color-warning`, `--color-info`, `--color-success`

With 10 theme blocks, that's 40 unused declarations.

**Action**: Remove from all theme blocks.

### 6.6 MapLibre control overrides use hardcoded colors (LOW)

`style.css` lines 188-226 and `MapEngine.vue` lines 893-981 use hardcoded dark-theme colors for MapLibre controls. These break on light themes.

**Action**: Use CSS variables for MapLibre control overrides.

### 6.7 Scoped CSS duplicated across components (LOW)

| Pattern | Components | Est. lines |
|---------|-----------|------------|
| `.section-header` | PointPopup, GallerySidebar, MimicrySelector, LegendGroupStylePopup | 4x ~6 lines |
| `.count-badge` | PointPopup, GallerySidebar | 2x ~10 lines |
| `.taxonomy-select` / `.sidebar-select` | PointPopup, GallerySidebar | 2x ~22 lines |
| `.toggle-badge` / `.toggle-badge-inline` | SidebarMapSettings | Internal duplication ~30 lines |

**Action**: Move shared patterns to global CSS or use Tailwind utility classes consistently.

---

## 7. Python Backend

### 7.1 Dead code in `process_data.py` (~100 lines) (HIGH)

| Lines | Item | Why dead |
|-------|------|----------|
| 622-709 | `fetch_gbif_data()` | Legacy function, unreachable (gated by `GBIF_SEARCH_FALLBACK = False`) |
| 196-210 | `split_scientific_name()` | Only called by dead `fetch_gbif_data()` |
| 45-46 | `GBIF_SPECIES_LIMIT`, `GBIF_RECORDS_PER_SPECIES` | Only used by dead function |
| 26 | `import time` | Only used by dead function |

**Action**: Remove the dead legacy function and its dependencies.

### 7.2 Duplicated NaN-cleaning lambda -- 13 occurrences (HIGH)

The pattern `lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['nan', ''] else None` appears 13 times in `process_data.py`.

**Action**: Create a `clean_optional_str(value)` function. (~20 lines saved, much better readability)

### 7.3 Duplicated functions across files (MEDIUM)

| Function | Location 1 | Location 2 | Location 3 |
|----------|-----------|-----------|-----------|
| Author-citation stripping | `process_data.py:514` (`clean_species_name`) | `gbif_download_api.py:336` (`clean_scientific_name`) | `curation/corrections.py:104` (`strip_author_from_name`) |
| NaN-to-None sanitization | `process_data.py:877` (inline `math.isnan`) | `curation/output.py:24` (`sanitize_for_json`) | -- |
| `get_mimicry_for_row()` | `process_data.py:395` | `process_data.py:604` (identical copy) | -- |
| iNaturalist detection | `gbif_download_api.py:408` | `gbif_download_api.py:447` | -- |

**Action**: Consolidate into shared utility functions.

### 7.4 Inconsistent sentinel value handling (MEDIUM)

Different files check different combinations of `['None', 'nan', '', 'NA']` for NaN/null values. No canonical list exists.

**Action**: Define a single `NULL_SENTINELS` constant in a shared config.

### 7.5 `sys.exit(1)` in utility functions (LOW)

`gbif_download_api.py` and `curation/apply.py` call `sys.exit()` in utility functions (8+ locations), making the code untestable.

**Action**: Raise exceptions instead. Only call `sys.exit()` in `main()`.

### 7.6 Global mutable state (LOW)

`process_data.py` uses `MIMICRY_LOOKUP` as module-level mutable state with `global` keyword. Implicit ordering dependency between functions.

**Action**: Pass the lookup dict explicitly or use a class.

### 7.7 Dead constant in `curation/config.py` (LOW)

`FREE_TEXT_PATTERNS` (line 53) is defined but never used. `classify.py` reimplements the same regex patterns inline.

**Action**: Either use `FREE_TEXT_PATTERNS` in `classify.py` or remove it.

### 7.8 Unused import in `curation/corrections.py` (LOW)

`Counter` imported from `collections` but never used.

### 7.9 Unused import in `curation/apply.py` (LOW)

`csv` imported but never used.

---

## Bugs Found During Audit

These are not optimizations but actual bugs discovered:

1. **Mimicry filter type mismatch** (`data.js`): `restoreFiltersFromURL` (line 485) sets `filters.value.mimicry` as a string, but it's declared as an array (`mimicry: []`). `toggleMimicryFilter` (line 544) resets to string `'All'` instead of `[]`. URL sync watcher (line 1426) compares with `!== 'All'` instead of checking array length.

2. **Non-existent property reference** (`persistence.js` line 139): `saveAllState` saves `legendStore.itemOrder` which doesn't exist on the legend store.

3. **Missing watch for prop sync** (`LegendGroupStylePopup.vue` line 46): `localHue` initialized from `props.baseHue` but never synced on updates. `watch` is imported but unused -- this looks like an incomplete implementation.

4. **Inconsistent click-outside event** (`LegendColorPicker.vue`): Uses `click` event while all other components use `mousedown`. This can cause the color picker to not close properly when opening other popups.

---

## Execution Priority

| Phase | Items | Impact |
|-------|-------|--------|
| **Phase 1: Dead code removal** | 1.1-1.8, 7.1 | ~800 lines removed, zero risk |
| **Phase 2: Extract composables** | 3.1 (click-outside), 3.2 (species nav), 2.1 (useMapEngine split) | ~300 lines saved, better maintainability |
| **Phase 3: Fix hacks** | 4.1 (double nextTick), 4.2 (setTimeout), 4.3, 4.4 | Reliability improvement |
| **Phase 4: CSS cleanup** | 6.1-6.5 | Theme consistency, ~200 lines removed |
| **Phase 5: Component extraction** | 3.4-3.6, 2.3-2.5 | Template deduplication |
| **Phase 6: Store splitting** | 2.2 (data.js), 3.9 (uniqueX helper) | AI-friendlier file sizes |
| **Phase 7: Performance** | 5.1-5.6 | Runtime improvements |
| **Phase 8: Python cleanup** | 7.1-7.9 | Backend maintainability |
