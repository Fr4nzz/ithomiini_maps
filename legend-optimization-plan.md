# Legend Code Optimization Plan

Audit of 12 legend-related files (6,472 lines total). Focused on removing dead code, reducing duplication, simplifying complex logic, and improving maintainability.

## Current File Sizes

| File | Lines | Notes |
|------|-------|-------|
| Legend.vue | 2,038 | Too large — hard for AI and humans to reason about |
| legend.js (store) | 870 | Contains dead state and actions |
| LegendToolbar.vue | 768 | |
| LegendGroupHeader.vue | 523 | |
| LegendColorPicker.vue | 411 | |
| LegendItem.vue | 323 | |
| AbbreviationDropdown.vue | 352 | |
| LegendGroupStylePopup.vue | 406 | |
| LegendEditableLabel.vue | 203 | |
| LegendResizeHandle.vue | 173 | **Unused — replaced by inline resize zones** |
| LegendPrefixModal.vue | 248 | **Unused — replaced by AbbreviationDropdown** |
| LegendGroupByRow.vue | 157 | **Unused — replaced by toolbar controls** |

---

## Phase 1: Delete Dead Code (est. −250 lines)

### 1.1 Delete 3 unused component files (−578 lines)
- `LegendResizeHandle.vue` (173 lines) — replaced by inline resize zones in Legend.vue
- `LegendPrefixModal.vue` (248 lines) — replaced by AbbreviationDropdown.vue
- `LegendGroupByRow.vue` (157 lines) — replaced by toolbar grouping controls
- Also remove their exports from `index.js`

### 1.2 Delete dead computed in Legend.vue (−5 lines)
- `hiddenCount` (line 369) — defined but never referenced in template or script

### 1.3 Delete dead store state and actions in legend.js (−50 lines)
- `expandedGroups` ref + `toggleGroupExpanded`, `isGroupExpanded`, `expandAllGroups`, `collapseAllGroups` — defined but never called from any component
- `itemOrder` ref + `setItemOrder` — defined but never called from any component
- `groupingSettings.labelFormat` — set to `'abbreviated'` but never read by any component
- Remove from exports and from `resetCustomizations()`/`resetToDefaults()`

### 1.4 Merge identical computeds in Legend.vue (−3 lines)
- `showToolbar` and `showEditUI` compute the same value: `isHovered || hasOpenPopup`
- Keep `showEditUI`, assign `const showToolbar = showEditUI`

---

## Phase 2: Extract Composables (reduces Legend.vue by ~300 lines)

### 2.1 `useElementResize(elementRef, options)` composable (~120 lines extracted)
Extract from Legend.vue lines 37-41 (resize state) + 746-861 (resize functions):
- Multi-directional resize (8 directions)
- Touch + mouse support
- `resizeOverride` for immediate visual feedback
- Returns: `{ resizeState, startResize, isResizing }`

Benefits: Legend.vue loses ~120 lines, resize logic becomes testable and reusable.

### 2.2 `useStickyPosition(elementRef, containerBounds, options)` composable (~100 lines extracted)
Extract from Legend.vue:
- `stickyEdge` detection (lines 928-957)
- `adjustPositionForNewBounds` (lines 871-920)
- `applyPositionForBounds` (lines 964-1022)
- `repositionIfBottomSticky` (lines 1498-1512)
- `repositionForAttributionChange` (lines 1183-1200)

Currently these 5 functions contain heavily duplicated sticky-edge logic. Merging them into one composable would remove ~40 lines of duplication while also making the logic easier to follow.

### 2.3 `useClickOutside(elementRef, callback)` composable (~15 lines, removes ~60 lines total)
Currently duplicated across 4 components:
- LegendToolbar.vue (lines 119-129)
- LegendColorPicker.vue (lines 117-122)
- AbbreviationDropdown.vue (lines 125-129)
- LegendGroupStylePopup.vue (lines 85-89)

VueUse provides this, but a minimal 15-line composable avoids the dependency.

### 2.4 `useAutoFitItems(contentRef, maxHeight, options)` composable (~80 lines extracted)
Extract from Legend.vue:
- `adjustItemsToFit` (lines 1432-1492)
- `adjustedDuringHover` tracking
- `itemLimitOverride`, `adjustingUp`, `settledMaxItems` refs
- The watcher that resets and triggers adjustment (lines 1413-1430)

This is the most complex algorithm in the file. Isolating it makes Legend.vue dramatically easier to understand.

---

## Phase 3: Simplify Complex Logic

### 3.1 Add iteration limit to adjustItemsToFit
Currently the recursive `nextTick → nextTick → adjustItemsToFit` chain has no max iteration cap. If the estimate is very wrong, it could iterate many times. Add `const MAX_ADJUST_ITERATIONS = 15` and break if exceeded.

### 3.2 Simplify resize direction handling with lookup table
Replace the if/else chain in `onResizeDrag` (lines 767-806) with a direction map:
```javascript
// Before: 40 lines of if/else
if (dir.includes('e')) { newWidth = ... }
else if (dir.includes('w')) { newX = ... ; newWidth = ... }

// After: ~15 lines with lookup
const axis = {
  e: { dim: 'width', grow: 1 },
  w: { dim: 'width', grow: -1, moveAxis: 'x' },
  s: { dim: 'height', grow: 1 },
  n: { dim: 'height', grow: -1, moveAxis: 'y' },
}
```

### 3.3 Template: Use v-for for resize zones
Replace 8 near-identical `<div class="resize-zone">` blocks with:
```vue
<div v-for="dir in resizeDirections" :key="dir"
     :class="['resize-zone', `resize-${dir}`]"
     @mousedown.stop.prevent="startResize($event, dir)"
     @touchstart.stop.prevent="startResizeTouch($event, dir)" />
```

### 3.4 Template: Use v-for for sort dropdown options
Replace 4 near-identical sort buttons with a data-driven loop:
```javascript
const sortOptions = [
  { by: 'alphabetical', order: 'asc', icon: ArrowUpAZ, label: 'A → Z' },
  { by: 'alphabetical', order: 'desc', icon: ArrowDownZA, label: 'Z → A' },
  { by: 'abundance', order: 'desc', icon: ChartBarDecreasing, label: 'Most abundant' },
  { by: 'abundance', order: 'asc', icon: ChartBarIncreasing, label: 'Least abundant' },
]
```

### 3.5 Extract groupedLegendData helper functions
The 80-line computed (lines 287-366) does grouping + labeling + sorting. Split into:
- `groupItemsBySpecies(items)` — pure function
- `sortGroups(groups, sortBy, sortOrder, counts)` — pure function

This makes the computed a 10-line orchestrator calling testable helpers.

### 3.6 Simplify `resetCustomizations()` in legend.js
Currently 58 lines manually resetting 50+ keys. Replace with:
```javascript
const STORAGE_KEYS = ['legend-custom-labels', 'legend-custom-colors', ...]
function resetCustomizations() {
  for (const key of STORAGE_KEYS) removeStorage(key)
  // Reset refs in batch
  Object.assign(state, getDefaultState())
}
```

---

## Phase 4: Reduce Prop Drilling

### 4.1 Use provide/inject for shared legend state
Legend.vue passes the same props to every LegendItem and LegendGroupHeader:
- `isExportMode`, `dotSize`, `fontSize`, `showEditUI`, `wrapLabel`, `showCounts`

Using `provide` at the Legend level and `inject` in children removes ~10 props per component instance from the template, making it much shorter.

### 4.2 Remove unused props
- `LegendGroupHeader.isExportMode` — passed but the `.is-export` CSS class has no visible effect when headers are hidden
- `LegendGroupHeader.hasCustomizedStyle` — passed but never referenced in template

---

## Phase 5: CSS Consolidation

### 5.1 Extract shared scrollbar styles (~15 lines saved)
Identical scrollbar CSS exists in both Legend.vue and LegendToolbar.vue. Move to a shared class or CSS file.

### 5.2 Define transition CSS variables
Currently 4+ different transition timings scattered across components:
```css
/* Inconsistent */
transition: all 0.15s ease;   /* Legend.vue */
transition: all 0.1s ease;    /* Legend.vue (different place) */
transition: all 0.2s ease;    /* LegendToolbar.vue */
```
Standardize with CSS custom properties.

### 5.3 Unify button styles
`.toolbar-button`, `.title-control-button`, `.hide-headers-button`, `.show-headers-button` all share hover/active patterns. Extract common `btn-icon` class.

---

## Phase 6: Extract ShapeIcon Component

SVG shape rendering (circle, square, triangle, rhombus) is duplicated:
- `LegendItem.vue` lines 133-172 (display mode)
- `LegendColorPicker.vue` lines 143-176 (picker mode)

Extract to `<ShapeIcon :shape="shape" :color="color" :size="size" :borderColor="..." />`. ~40 lines saved, single source of truth for shape rendering.

---

## Impact Summary

| Phase | Lines Removed | Lines Added | Net Change | Effort |
|-------|-------------|-------------|------------|--------|
| 1. Delete dead code | ~636 | 0 | **−636** | Low |
| 2. Extract composables | ~315 from Legend.vue | ~230 in composables | **−85 net, Legend.vue −315** | Medium |
| 3. Simplify logic | ~180 | ~80 | **−100** | Medium |
| 4. Reduce prop drilling | ~120 | ~30 | **−90** | Low |
| 5. CSS consolidation | ~50 | ~20 | **−30** | Low |
| 6. ShapeIcon component | ~80 | ~50 | **−30** | Low |
| **Total** | **~1,381** | **~410** | **~−971** | |

### Legend.vue specifically: ~2,038 → ~1,400 lines (−31%)

---

## Priority Order

1. **Phase 1** — Zero risk, immediate cleanup, no behavior change
2. **Phase 3.1** — Safety fix (iteration limit), quick
3. **Phase 2.3** — `useClickOutside` is small, high-reuse
4. **Phase 3.3–3.4** — v-for template cleanups, quick wins
5. **Phase 2.1** — Extract resize composable (biggest single reduction)
6. **Phase 3.5** — Extract groupedLegendData helpers
7. **Phase 2.4** — Extract auto-fit composable
8. **Phase 2.2** — Extract sticky position composable
9. **Phase 4** — provide/inject refactor
10. **Phase 5–6** — CSS and ShapeIcon (polish)
