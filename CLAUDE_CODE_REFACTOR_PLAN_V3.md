# Ithomiini Maps — React Refactor Plan V3

## 🚨 CRITICAL: Read This First

This is a **continuation** of the React + shadcn/ui refactor. The goal is **feature parity** with the Vue version while keeping improvements made in the React version (like the right-side PointDetailsSheet).

**Golden Rule:** When fixing issues, ALWAYS check how the original Vue code handled it first. Match that behavior.

**Before starting each task:**
```bash
git fetch --all

# Reference Vue code for original behavior:
git show main:src/components/ImageGallery.vue
git show main:src/components/Sidebar.vue
git show main:src/components/PointPopup.vue
git show main:src/components/MapEngine.vue
git show main:src/stores/data.js
git show main:src/App.vue
git show main:src/index.css
git show main:src/style.css

# List all Vue components:
git ls-tree --name-only main:src/components/
```

---

## 📋 Issues to Fix (Priority Order)

### 🔴 P0 — Critical UX Bugs

| Issue | Current Behavior | Expected Behavior |
|-------|------------------|-------------------|
| **Sidebar scroll** | Scrolling sidebar scrolls entire page including map, showing empty space below | Only sidebar content should scroll; map stays fixed |
| **Sheet auto-close** | Clicking map to drag closes PointDetailsSheet | Sheet closes ONLY via Esc key or X button |
| **Map grey overlay** | Map turns grey/uninteractive when sheet opens | Map fully visible and interactive |
| **No selected point highlight** | No visual feedback for which point is selected | Visual indicator around selected point on map |

### 🟡 P1 — Missing Features

| Feature | Description |
|---------|-------------|
| **Gallery thumbnail grouping** | Thumbnails should be grouped by species → subspecies, collapsed by default (like Vue version) |
| **PointDetailsSheet image** | Image uses low-res thumbnail, should match gallery's full-res with panzoom |
| **Panzoom speed** | Scroll-to-zoom is too slow compared to original Vue behavior |

---

## PHASE 1: Fix Critical Layout Issues

### Step 1.1: Fix Sidebar Scrolling (P0)

**Problem:** Scrolling in the sidebar scrolls the entire page. The map also scrolls and empty space appears below.

**Action:** 
1. Review how Vue handles this layout:
   ```bash
   git show main:src/App.vue
   git show main:src/components/Sidebar.vue
   git show main:src/index.css
   ```
2. Look at the CSS structure — how does the Vue app prevent page scroll?
3. Look at the sidebar — how is the scrollable area contained?
4. Apply the same layout pattern to the React version

**Files to modify:**
- `src/App.tsx`
- `src/features/filters/Sidebar.tsx`
- Possibly `src/index.css`

**Key questions to answer from Vue code:**
- Does the app container have `overflow: hidden`?
- Does the sidebar use a specific scroll container?
- How is the map container sized to fill remaining space?

**Verify:**
- [ ] Scrolling sidebar does NOT scroll the map
- [ ] No empty space visible below the map
- [ ] Sidebar scroll bar is only in the filter content area
- [ ] Header and footer sections stay fixed

---

### Step 1.2: Fix PointDetailsSheet Click-to-Close (P0)

**Problem:** Clicking anywhere on the map (to pan/drag) closes the PointDetailsSheet.

**Context:** The Vue version used a MapLibre popup (`PointPopup.vue`), not a Sheet. Since we're keeping the Sheet UI (user preference), we need to configure it properly for this use case.

**Action:**
1. The Sheet should NOT close when clicking outside (on the map)
2. The Sheet should ONLY close via:
   - Pressing Escape key
   - Clicking the X close button
3. Configure the shadcn Sheet component to prevent outside click dismissal
4. Check if `modal={false}` is set and if additional props like `onInteractOutside` need to be handled

**Files to modify:**
- `src/features/map/PointDetailsSheet.tsx`
- `src/shared/ui/sheet.tsx` (if the component needs modification)

**Verify:**
- [ ] Can click on map to pan without closing sheet
- [ ] Can click on other points — sheet updates to new point
- [ ] Pressing Escape closes the sheet
- [ ] Clicking X button closes the sheet
- [ ] Sheet stays open during map zoom/pan operations

---

### Step 1.3: Fix Map Grey Overlay (P0)

**Problem:** When PointDetailsSheet opens, the map becomes greyed out.

**Root Cause:** The Sheet overlay/backdrop is rendering even though we want a non-modal sheet.

**Action:**
1. Ensure `modal={false}` is passed to the Sheet component
2. Check if the SheetOverlay is rendering — it shouldn't for non-modal sheets
3. Modify the sheet component if needed to conditionally render the overlay only for modal sheets

**Files to modify:**
- `src/features/map/PointDetailsSheet.tsx`
- `src/shared/ui/sheet.tsx`

**Verify:**
- [ ] Map is fully visible when sheet is open
- [ ] Map colors are not dimmed/greyed
- [ ] No semi-transparent overlay visible
- [ ] Map is fully interactive (pan, zoom, click points)

---

### Step 1.4: Add Selected Point Highlight on Map (P0)

**Problem:** No visual indication on the map of which point is selected.

**Action:**
1. Review how Vue's MapEngine handles point selection visually:
   ```bash
   git show main:src/components/MapEngine.vue
   ```
2. Look for any highlight layers, feature-state styling, or other visual feedback mechanisms
3. Check the Vue store for how `selectedPointId` or `focusPoint` is used
   ```bash
   git show main:src/stores/data.js
   ```
4. Implement similar visual feedback in the React MapLibre setup

**Files to modify:**
- `src/features/map/useMaplibre.ts`

**Verify:**
- [ ] Clicking a point shows visible highlight/indicator
- [ ] When clicking a different point, the highlight moves
- [ ] When closing the sheet, the highlight disappears
- [ ] Highlight is visible on both light and dark map tiles

---

## PHASE 2: Fix Image Viewing Experience

### Step 2.1: Fix Panzoom Speed in ImageGallery

**Problem:** The scroll-to-zoom is too slow in the gallery. Need to scroll many times to achieve the same zoom as the Vue version.

**Action:**
1. Review how Vue's ImageGallery handles panzoom:
   ```bash
   git show main:src/components/ImageGallery.vue
   ```
2. Look at the `@panzoom/panzoom` initialization and configuration
3. Check the `zoomWithWheel` behavior and any options passed
4. Compare with current `react-zoom-pan-pinch` configuration
5. Adjust React's panzoom settings to match the Vue zoom speed/feel

**Note:** Vue uses `@panzoom/panzoom` library, React uses `react-zoom-pan-pinch`. The APIs differ, but the goal is matching the user experience (zoom amount per scroll).

**Files to modify:**
- `src/features/gallery/ImageGallery.tsx`

**Verify:**
- [ ] Zoom speed feels similar to Vue version
- [ ] 3-4 scroll steps achieves noticeable zoom (not 10+)
- [ ] Zoom out is equally responsive
- [ ] Pan/drag behavior feels natural

---

### Step 2.2: Add Full-Res Image with Panzoom to PointDetailsSheet

**Problem:** The image in PointDetailsSheet uses `getThumbnailUrl` (400px width) and has no zoom capability.

**Action:**
1. Review how Vue's ImageGallery loads and displays the main image:
   ```bash
   git show main:src/components/ImageGallery.vue
   ```
2. Check `src/utils/imageProxy.js` for `getProxiedUrl` vs `getThumbnailUrl`:
   ```bash
   git show main:src/utils/imageProxy.js
   ```
3. Apply the same image loading approach to PointDetailsSheet
4. Reuse or adapt the panzoom setup from ImageGallery for the PointDetailsSheet image
5. Consider extracting a shared `ZoomableImage` component if it makes sense

**Files to modify:**
- `src/features/map/PointDetailsSheet.tsx`
- Possibly create a shared component

**Verify:**
- [ ] Image loads at full resolution (check Network tab — should be ~2000px not 400px)
- [ ] Can zoom in/out with scroll wheel
- [ ] Can pan/drag the image when zoomed
- [ ] Image quality is sharp even when zoomed in

---

## PHASE 3: Implement Grouped Thumbnail Strip in Gallery

### Step 3.1: Replace Flat Thumbnail Strip with Grouped Version

**Problem:** Current gallery shows a flat list of thumbnails. Original Vue version groups by species → subspecies with collapsible sections.

**Action:**
1. **Carefully study** the Vue ImageGallery thumbnail strip implementation:
   ```bash
   git show main:src/components/ImageGallery.vue
   ```
2. Look for:
   - `groupedThumbnails` computed property structure
   - `collapsedSpecies` and `collapsedSubspecies` state
   - `collapseAll`, `expandOnly`, `toggleSpeciesCollapse`, `toggleSubspeciesCollapse` functions
   - The template section rendering the grouped thumbnails (search for `groupedThumbnails` in template)
3. Port this logic to React, maintaining the same:
   - Data structure for grouped thumbnails
   - Collapse/expand behavior (collapsed by default)
   - Auto-expand when navigating to a specimen
   - Visual styling (borders, colors, badges)
4. The Vue version has color-coding per species — review `speciesColors` and `getSubspeciesColor` computed properties

**Files to modify:**
- `src/features/gallery/ImageGallery.tsx`

**Key Vue code sections to reference:**
- `groupedThumbnails` computed (~line 1853)
- `collapseAll`, `expandOnly` functions (~line 1855-1858)
- Template for thumbnail strip (~lines 1966-2012)
- Species color generation (~line 1850-1851)

**Verify:**
- [ ] Species groups are visible with distinct visual separation
- [ ] Each species has a header with name and image count
- [ ] Species groups are collapsed by default (only preview thumbnail visible)
- [ ] Clicking header or + button expands the group
- [ ] Subspecies are nested within species (also collapsible)
- [ ] Currently selected image's group auto-expands
- [ ] Active thumbnail has highlight (green border)
- [ ] Scroll buttons work to navigate the strip

---

## PHASE 4: Final Verification

### Full Feature Checklist

Compare React app against Vue app for each feature:

**Layout:**
- [ ] Sidebar scrolls independently from map
- [ ] No page scroll, no empty space below map
- [ ] Map fills available space correctly
- [ ] Mobile responsive (sidebar becomes drawer)

**PointDetailsSheet (new UI, but should feel natural):**
- [ ] Does not close when clicking on map
- [ ] Closes only with Esc or X button
- [ ] No grey overlay on map
- [ ] Full-res image with panzoom (matching gallery behavior)
- [ ] Selected point has visual indicator on map
- [ ] Can navigate between multiple points at same location

**Gallery:**
- [ ] Thumbnails grouped by species → subspecies
- [ ] Groups collapsed by default
- [ ] Current image's group auto-expands
- [ ] Panzoom speed matches Vue version
- [ ] Keyboard navigation works (arrows, Esc, +/-)
- [ ] Species/subspecies color coding

**Filters (should already work, verify no regressions):**
- [ ] All filter sections present and functional
- [ ] Taxonomy cascade works (genus → species → subspecies)
- [ ] Mimicry selector dialog works
- [ ] Date filter works
- [ ] Map settings (color by, legend, point style) work
- [ ] Reset filters works

**Map (verify no regressions):**
- [ ] Points render with correct colors
- [ ] Legend displays correctly
- [ ] Clustering/spiderfy works (if implemented)
- [ ] Map export works

**Other:**
- [ ] Dark mode works correctly
- [ ] Light mode works correctly
- [ ] URL state sync works
- [ ] Export (CSV, GeoJSON) works
- [ ] No console errors
- [ ] Build succeeds

---

## 🔧 Quick Reference Commands

```bash
# View Vue reference files
git show main:src/components/ImageGallery.vue
git show main:src/components/Sidebar.vue
git show main:src/components/PointPopup.vue
git show main:src/components/MapEngine.vue
git show main:src/components/MimicrySelector.vue
git show main:src/components/DateFilter.vue
git show main:src/components/ExportPanel.vue
git show main:src/App.vue
git show main:src/stores/data.js
git show main:src/utils/imageProxy.js
git show main:src/index.css
git show main:src/style.css

# List Vue components
git ls-tree --name-only main:src/components/

# Run dev server
npm run dev

# Build and preview
npm run build
npm run preview
```

---

## 📝 Key Principles for Claude Code

1. **Always check Vue code first** — Before implementing a fix, review how Vue handled it
2. **Match behavior, not just appearance** — The goal is same UX, not just similar looks
3. **Test incrementally** — After each step, verify it works before moving on
4. **Don't break existing features** — Run through the app after each change
5. **Keep the Sheet UI** — User prefers the right-side panel over MapLibre popups
6. **When in doubt, ask** — If Vue code is unclear, note it rather than guessing

---

## 🔄 Workflow for Each Issue

1. Read the issue description
2. Run `git show main:src/components/[RelevantFile].vue` to see Vue implementation
3. Understand the Vue approach
4. Implement equivalent in React
5. Test the fix
6. Verify no regressions
7. Move to next issue
