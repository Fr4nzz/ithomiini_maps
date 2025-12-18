# CRITICAL FIX: Remove Duplicate Code

## What Went Wrong

The previous optimization **ADDED 3,500 lines instead of removing 2,000**. 

**Root cause:** New utility files were created but the OLD DUPLICATE CODE was NEVER DELETED from the original components.

The code now exists in MULTIPLE places:
- `ASPECT_RATIOS` → exists in `constants.js` AND `App.vue` AND `ExportPanel.vue` AND `MapExport.vue`
- `loadImage`, `roundRect`, `drawLegendOnCanvas`, etc. → exists in `canvasHelpers.js` AND `App.vue` AND `ExportPanel.vue`
- Composables exist but are NOT IMPORTED anywhere

---

## THE FIX: Delete Duplicate Code

**CRITICAL INSTRUCTION FOR CLAUDE CODE:**
> For each task below, you must DELETE the old code from the component files. The utilities already exist - you just need to IMPORT them and DELETE the duplicates.

---

## Task 1: Fix App.vue

### Step 1.1: Add imports at top of `<script setup>`
```javascript
import { ASPECT_RATIOS } from './utils/constants'
import { 
  loadImage, 
  roundRect, 
  drawLegendOnCanvas, 
  drawScaleBarOnCanvas, 
  drawAttributionOnCanvas 
} from './utils/canvasHelpers'
```

### Step 1.2: DELETE these local definitions (they're duplicates)

**DELETE the `ASPECT_RATIOS` constant** (around line 1014-1022):
```javascript
// DELETE THIS ENTIRE BLOCK:
const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1600, height: 1200 },
  '1:1': { width: 1200, height: 1200 },
  '3:2': { width: 1800, height: 1200 },
  'A4': { width: 2480, height: 3508 },
  'A4L': { width: 3508, height: 2480 },
}
```

**DELETE the `loadImage` function** (around line 1024-1032):
```javascript
// DELETE THIS ENTIRE BLOCK:
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}
```

**DELETE the `roundRect` function** (around line 1034-1046):
```javascript
// DELETE THIS ENTIRE BLOCK:
const roundRect = (ctx, x, y, w, h, r) => {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  return ctx
}
```

**DELETE the `drawLegendOnCanvas` function** (around line 1048-1104):
This is a ~55 line function. DELETE IT ENTIRELY.

**DELETE the `drawScaleBarOnCanvas` function** (around line 1107-1140):
This is a ~33 line function. DELETE IT ENTIRELY.

**DELETE the `drawAttributionOnCanvas` function** (around line 1142-1161):
This is a ~19 line function. DELETE IT ENTIRELY.

### Step 1.3: Update function calls to use imported versions

In `directExportMap()`, the canvas drawing functions now need store data passed as options. Update these calls:

```javascript
// Change FROM:
drawLegendOnCanvas(ctx, canvas.width, canvas.height)

// Change TO:
drawLegendOnCanvas(ctx, canvas.width, canvas.height, {
  colorMap: store.activeColorMap,
  legendSettings: store.legendSettings,
  exportSettings: store.exportSettings,
  colorBy: store.colorBy,
  legendTitle: store.legendTitle,
})
```

```javascript
// Change FROM:
drawScaleBarOnCanvas(ctx, canvas.width, canvas.height)

// Change TO:
drawScaleBarOnCanvas(ctx, canvas.width, canvas.height, {
  legendSettings: store.legendSettings,
  exportSettings: store.exportSettings,
})
```

```javascript
// Change FROM:
drawAttributionOnCanvas(ctx, canvas.width, canvas.height)

// Change TO:
drawAttributionOnCanvas(ctx, canvas.width, canvas.height, {
  exportSettings: store.exportSettings,
})
```

**Expected reduction in App.vue: ~150 lines**

---

## Task 2: Fix ExportPanel.vue

### Step 2.1: Add imports at top of `<script setup>`
```javascript
import { ASPECT_RATIOS } from '../utils/constants'
import { 
  loadImage, 
  roundRect, 
  calculateExportRegion,
  drawLegendOnCanvas, 
  drawScaleBarOnCanvas, 
  drawAttributionOnCanvas 
} from '../utils/canvasHelpers'
```

### Step 2.2: DELETE these local definitions

**DELETE `ASPECT_RATIOS`** (around line 3315-3323)

**DELETE `calculateExportRegion`** (around line 3334-3375) - ~40 lines

**DELETE `loadImage`** (around line 3571-3579)

**DELETE `roundRect`** (should be around line 3710-3722 or similar)

**DELETE `drawLegendOnCanvas`** (around line 3582-3715) - ~130 lines!

**DELETE `drawScaleBarOnCanvas`** (around line 3718-3770) - ~50 lines

**DELETE `drawAttributionOnCanvas`** (around line 3773-3800) - ~27 lines

### Step 2.3: Update function calls (same as App.vue)

Pass options objects to the drawing functions.

**Expected reduction in ExportPanel.vue: ~300 lines**

---

## Task 3: Delete MapExport.vue Entirely

`MapExport.vue` duplicates functionality already in `ExportPanel.vue`. 

### Step 3.1: Delete the file
```bash
rm src/components/MapExport.vue
```

### Step 3.2: Update App.vue

**Remove the import:**
```javascript
// DELETE THIS LINE:
import MapExport from './components/MapExport.vue'
```

**Remove the modal state:**
```javascript
// DELETE THIS LINE:
const showMapExport = ref(false)

// DELETE THESE LINES:
const openMapExport = () => { showMapExport.value = true }
const closeMapExport = () => { showMapExport.value = false }
```

**Remove the provide:**
```javascript
// DELETE THIS LINE:
provide('openMapExport', openMapExport)
```

**Remove the template modal block:**
```vue
<!-- DELETE THIS ENTIRE BLOCK: -->
<Teleport to="body">
  <Transition name="modal">
    <div 
      v-if="showMapExport" 
      class="modal-overlay"
      @click.self="closeMapExport"
    >
      <MapExport :map="mapRef" @close="closeMapExport" />
    </div>
  </Transition>
</Teleport>
```

**Expected reduction: ~400 lines** (MapExport.vue was ~400 lines)

---

## Task 4: Delete Unused Composables (or use them)

The composables were created but never used. Either:

**Option A: Delete them** (simpler - do this)
```bash
rm src/composables/useMapExport.js
rm src/composables/useModal.js  
rm src/composables/useSpeciesSelection.js
```

**Option B: Actually use them** (more complex, skip for now)

**Expected reduction: ~300 lines**

---

## Task 5: Delete Unused UI Components (or use them)

The UI components were created but never used in templates.

**Option A: Delete them** (simpler - do this)
```bash
rm src/components/ui/BaseModal.vue
rm src/components/ui/Icon.vue
rm src/components/ui/SectionHeader.vue
rm src/components/ui/index.js
rmdir src/components/ui
```

**Option B: Actually use them** (skip for now)

**Expected reduction: ~150 lines**

---

## Task 6: Delete Unused CSS File

```bash
rm src/styles/components.css
rmdir src/styles
```

**Expected reduction: ~100 lines**

---

## Summary

| Task | Action | Lines Removed |
|------|--------|---------------|
| 1 | Fix App.vue - delete duplicates | ~150 |
| 2 | Fix ExportPanel.vue - delete duplicates | ~300 |
| 3 | Delete MapExport.vue entirely | ~400 |
| 4 | Delete unused composables | ~300 |
| 5 | Delete unused UI components | ~150 |
| 6 | Delete unused CSS file | ~100 |
| **Total** | | **~1,400 lines** |

After this fix, codebase should be ~10,700 lines (down from 12,135).

---

## Verification

After each task, run:
```bash
wc -l src/**/*.vue src/**/*.js
npm run dev
```

Make sure the app still works:
- [ ] Map loads
- [ ] Export image works
- [ ] All modals open/close

---

## CRITICAL REMINDER

**DO NOT create new files. DO NOT add new abstractions. ONLY DELETE duplicate code and add imports.**

The goal is LESS code, not more.
