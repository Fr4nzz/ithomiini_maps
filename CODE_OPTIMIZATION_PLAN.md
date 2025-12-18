# Ithomiini Maps - Code Optimization Plan

## Overview

This document outlines a systematic plan to reduce code redundancy and improve maintainability in the Vue.js codebase. Analysis of the original code revealed **~2000+ lines of redundant code** that can be eliminated through consolidation and abstraction.

---

## Phase 1: Extract Shared Constants & Utilities

### Task 1.1: Create `src/utils/constants.js`

**Purpose:** Centralize all repeated constants.

```javascript
// Create new file: src/utils/constants.js

export const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1600, height: 1200 },
  '1:1': { width: 1200, height: 1200 },
  '3:2': { width: 1800, height: 1200 },
  'A4': { width: 2480, height: 3508 },
  'A4L': { width: 3508, height: 2480 },
}

export const STATUS_COLORS = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Record': '#6b7280',
  'Observation': '#22c55e',
  'Museum Specimen': '#8b5cf6',
  'Living Specimen': '#14b8a6',
}

export const PRESET_SIZES = [
  { name: 'HD (16:9)', width: 1920, height: 1080 },
  { name: '4K (16:9)', width: 3840, height: 2160 },
  { name: 'A4 Landscape', width: 3508, height: 2480 },
  { name: 'A4 Portrait', width: 2480, height: 3508 },
  { name: 'Square', width: 2000, height: 2000 },
  { name: 'Letter Landscape', width: 3300, height: 2550 },
]
```

**Files to update:**
- Remove `ASPECT_RATIOS` from: `App.vue`, `ExportPanel.vue`, `MapExport.vue`
- Remove `STATUS_COLORS` from: `PointPopup.vue`
- Import from new constants file

**Estimated reduction:** ~50 lines

---

### Task 1.2: Create `src/utils/canvasHelpers.js`

**Purpose:** Extract ALL canvas drawing functions that are duplicated across 3 files.

```javascript
// Create new file: src/utils/canvasHelpers.js

/**
 * Draw a rounded rectangle path
 */
export const roundRect = (ctx, x, y, w, h, r) => {
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

/**
 * Load an image from a data URL
 */
export const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * Calculate export region for map cropping
 */
export const calculateExportRegion = (containerWidth, containerHeight, targetWidth, targetHeight) => {
  const targetAspectRatio = targetWidth / targetHeight
  const containerAspectRatio = containerWidth / containerHeight
  const maxPercent = 92

  let holeWidthPercent, holeHeightPercent

  if (targetAspectRatio > containerAspectRatio) {
    holeWidthPercent = maxPercent
    holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
  } else {
    holeHeightPercent = maxPercent
    holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio
  }

  return {
    x: Math.max(2, (100 - holeWidthPercent) / 2),
    y: Math.max(2, (100 - holeHeightPercent) / 2),
    width: Math.min(96, holeWidthPercent),
    height: Math.min(96, holeHeightPercent)
  }
}

/**
 * Draw legend on canvas for export
 */
export const drawLegendOnCanvas = (ctx, width, height, options) => {
  const { colorMap, legendSettings, exportSettings, colorBy, legendTitle } = options
  // ... (move entire function body here)
}

/**
 * Draw scale bar on canvas for export
 */
export const drawScaleBarOnCanvas = (ctx, width, height, options) => {
  const { legendSettings, exportSettings } = options
  // ... (move entire function body here)
}

/**
 * Draw attribution on canvas for export
 */
export const drawAttributionOnCanvas = (ctx, width, height, options) => {
  const { exportSettings } = options
  // ... (move entire function body here)
}
```

**Files to update:**
- Remove these functions from: `App.vue` (~120 lines), `ExportPanel.vue` (~150 lines), `MapExport.vue` (~100+ lines)
- Import from new utility file

**Estimated reduction:** ~350 lines

---

### Task 1.3: Create `src/utils/dateHelpers.js`

**Purpose:** Centralize date parsing and formatting.

```javascript
// Create new file: src/utils/dateHelpers.js

/**
 * Parse date strings in various formats (DD-MMM-YY, YYYY-MM-DD, etc.)
 */
export function parseDate(dateStr) {
  if (!dateStr) return null

  // Handle DD-MMM-YY format (e.g., "18-Jan-22")
  const ddMmmYy = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/
  const match = dateStr.match(ddMmmYy)
  if (match) {
    const [, day, monthStr, yearShort] = match
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
    const month = months[monthStr.toLowerCase()]
    if (month !== undefined) {
      const year = parseInt(yearShort) + (parseInt(yearShort) > 50 ? 1900 : 2000)
      return new Date(year, month, parseInt(day))
    }
  }

  // Fallback to standard Date parsing
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Get date offset from today
 */
export function getDateOffset(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

/**
 * Format coordinates for display
 */
export function formatCoordinate(value, decimals = 4) {
  return value ? parseFloat(value).toFixed(decimals) : '—'
}
```

**Files to update:**
- `DateFilter.vue`: Import instead of defining locally

**Estimated reduction:** ~30 lines

---

## Phase 2: Create Reusable Composables

### Task 2.1: Create `src/composables/useSpeciesSelection.js`

**Purpose:** Extract the repeated species/subspecies/individual selection logic.

```javascript
// Create new file: src/composables/useSpeciesSelection.js

import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'

export function useSpeciesSelection(pointsRef, options = {}) {
  const store = useDataStore()
  
  const selectedSpecies = ref(null)
  const selectedSubspecies = ref(null)
  const selectedIndividualIndex = ref(0)

  // Group points by species
  const groupedBySpecies = computed(() => {
    return store.groupPointsBySpecies(pointsRef.value)
  })

  // Get sorted species list
  const speciesList = computed(() => {
    return store.getSpeciesWithPhotos(pointsRef.value)
  })

  // Get subspecies list for selected species
  const subspeciesList = computed(() => {
    if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
      return []
    }
    const speciesGroup = groupedBySpecies.value[selectedSpecies.value]
    return Object.entries(speciesGroup.subspecies)
      .map(([name, data]) => ({
        name,
        count: data.count,
        hasPhoto: data.individuals.some(i => i.image_url)
      }))
      .sort((a, b) => {
        if (a.hasPhoto && !b.hasPhoto) return -1
        if (!a.hasPhoto && b.hasPhoto) return 1
        return b.count - a.count
      })
  })

  // Get individuals list
  const individualsList = computed(() => {
    if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
      return pointsRef.value
    }
    const speciesGroup = groupedBySpecies.value[selectedSpecies.value]
    
    if (selectedSubspecies.value && speciesGroup.subspecies[selectedSubspecies.value]) {
      return speciesGroup.subspecies[selectedSubspecies.value].individuals
    }
    
    return Object.values(speciesGroup.subspecies).flatMap(s => s.individuals)
  })

  // Current individual
  const currentIndividual = computed(() => {
    const list = individualsList.value
    if (list.length === 0) return null
    const idx = Math.min(selectedIndividualIndex.value, list.length - 1)
    return list[idx]
  })

  // Selection handlers
  const selectSpecies = (species) => {
    selectedSpecies.value = species
    if (species && groupedBySpecies.value[species]) {
      const speciesGroup = groupedBySpecies.value[species]
      const subspeciesNames = Object.keys(speciesGroup.subspecies)
      
      const sortedSubspecies = subspeciesNames
        .map(name => ({
          name,
          data: speciesGroup.subspecies[name],
          hasPhoto: speciesGroup.subspecies[name].individuals.some(i => i.image_url)
        }))
        .sort((a, b) => {
          if (a.hasPhoto && !b.hasPhoto) return -1
          if (!a.hasPhoto && b.hasPhoto) return 1
          return b.data.count - a.data.count
        })
      
      selectedSubspecies.value = sortedSubspecies.length > 0 ? sortedSubspecies[0].name : null
    } else {
      selectedSubspecies.value = null
    }
    selectedIndividualIndex.value = 0
  }

  const selectSubspecies = (subspecies) => {
    selectedSubspecies.value = subspecies
    selectedIndividualIndex.value = 0
  }

  const selectIndividual = (index) => {
    selectedIndividualIndex.value = index
  }

  // Counts
  const totalSpecies = computed(() => Object.keys(groupedBySpecies.value).length)
  const subspeciesCount = computed(() => subspeciesList.value.length)
  const individualsCount = computed(() => individualsList.value.length)

  return {
    selectedSpecies,
    selectedSubspecies,
    selectedIndividualIndex,
    groupedBySpecies,
    speciesList,
    subspeciesList,
    individualsList,
    currentIndividual,
    selectSpecies,
    selectSubspecies,
    selectIndividual,
    totalSpecies,
    subspeciesCount,
    individualsCount,
  }
}
```

**Files to update:**
- `ImageGallery.vue`: Replace ~150 lines with composable import
- `PointPopup.vue`: Replace ~120 lines with composable import

**Estimated reduction:** ~200 lines

---

### Task 2.2: Create `src/composables/useMapExport.js`

**Purpose:** Consolidate ALL map export logic into one composable.

```javascript
// Create new file: src/composables/useMapExport.js

import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import { 
  ASPECT_RATIOS, 
  loadImage, 
  roundRect, 
  calculateExportRegion,
  drawLegendOnCanvas,
  drawScaleBarOnCanvas,
  drawAttributionOnCanvas 
} from '../utils/canvasHelpers'

export function useMapExport(mapRef) {
  const store = useDataStore()
  
  const isExporting = ref(false)
  const exportProgress = ref(0)
  const exportError = ref(null)
  const exportSuccess = ref(false)

  const exportDimensions = computed(() => {
    const ratio = store.exportSettings.aspectRatio
    if (ratio === 'custom') {
      return { 
        width: store.exportSettings.customWidth, 
        height: store.exportSettings.customHeight 
      }
    }
    return ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
  })

  const exportMap = async () => {
    if (!mapRef.value) {
      exportError.value = 'Map not available'
      return
    }

    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      const map = mapRef.value

      // Wait for map to be ready
      if (!map.isStyleLoaded()) {
        await new Promise(resolve => map.once('style.load', resolve))
      }

      map.triggerRepaint()
      await new Promise(resolve => map.once('idle', resolve))

      exportProgress.value = 10

      const mapCanvas = map.getCanvas()
      const { width: exportWidth, height: exportHeight } = exportDimensions.value

      // Create output canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = exportWidth
      canvas.height = exportHeight

      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      exportProgress.value = 20

      const mapDataUrl = mapCanvas.toDataURL('image/png')
      const mapImage = await loadImage(mapDataUrl)

      exportProgress.value = 40

      // Draw map (with or without cropping)
      if (store.exportSettings.enabled) {
        const region = calculateExportRegion(
          mapImage.width, mapImage.height,
          exportWidth, exportHeight
        )
        const srcX = (region.x / 100) * mapImage.width
        const srcY = (region.y / 100) * mapImage.height
        const srcW = (region.width / 100) * mapImage.width
        const srcH = (region.height / 100) * mapImage.height

        ctx.drawImage(mapImage, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
      } else {
        const scale = Math.min(canvas.width / mapImage.width, canvas.height / mapImage.height)
        const scaledWidth = mapImage.width * scale
        const scaledHeight = mapImage.height * scale
        const offsetX = (canvas.width - scaledWidth) / 2
        const offsetY = (canvas.height - scaledHeight) / 2
        ctx.drawImage(mapImage, offsetX, offsetY, scaledWidth, scaledHeight)
      }

      exportProgress.value = 60

      // Draw overlays
      const exportOptions = {
        colorMap: store.activeColorMap,
        legendSettings: store.legendSettings,
        exportSettings: store.exportSettings,
        colorBy: store.colorBy,
        legendTitle: store.legendTitle,
      }

      if (store.exportSettings.includeLegend && store.legendSettings.showLegend) {
        drawLegendOnCanvas(ctx, canvas.width, canvas.height, exportOptions)
      }

      exportProgress.value = 75

      if (store.exportSettings.includeScaleBar) {
        drawScaleBarOnCanvas(ctx, canvas.width, canvas.height, exportOptions)
      }

      exportProgress.value = 85

      drawAttributionOnCanvas(ctx, canvas.width, canvas.height, exportOptions)

      exportProgress.value = 95

      // Download
      const dataUrl = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      link.download = `ithomiini_map_${exportWidth}x${exportHeight}_${Date.now()}.png`
      link.href = dataUrl
      link.click()

      exportProgress.value = 100
      exportSuccess.value = true

      setTimeout(() => {
        isExporting.value = false
        exportProgress.value = 0
        exportSuccess.value = false
      }, 2000)

    } catch (e) {
      console.error('Export failed:', e)
      exportError.value = e.message || 'Export failed'
      isExporting.value = false
    }
  }

  return {
    isExporting,
    exportProgress,
    exportError,
    exportSuccess,
    exportDimensions,
    exportMap,
  }
}
```

**Files to update:**
- `App.vue`: Remove ~200 lines of export logic, use composable
- `ExportPanel.vue`: Remove ~250 lines, use composable
- `MapExport.vue`: Consider DELETING entirely if redundant with ExportPanel

**Estimated reduction:** ~400 lines

---

### Task 2.3: Create `src/composables/useModal.js`

**Purpose:** Simplify modal state management.

```javascript
// Create new file: src/composables/useModal.js

import { ref } from 'vue'

export function useModal(initialState = false) {
  const isOpen = ref(initialState)
  
  const open = () => { isOpen.value = true }
  const close = () => { isOpen.value = false }
  const toggle = () => { isOpen.value = !isOpen.value }
  
  return { isOpen, open, close, toggle }
}

export function useMultipleModals(names) {
  const modals = {}
  
  names.forEach(name => {
    modals[name] = useModal()
  })
  
  return modals
}
```

**Files to update:**
- `App.vue`: Replace 12 lines of modal state/functions with composable

**Estimated reduction:** ~20 lines

---

## Phase 3: Create Reusable Components

### Task 3.1: Create `src/components/ui/BaseModal.vue`

**Purpose:** Generic modal wrapper to replace repeated Teleport+Transition patterns.

```vue
<!-- Create new file: src/components/ui/BaseModal.vue -->
<script setup>
defineProps({
  modelValue: Boolean,
  closeOnOverlay: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

const close = () => emit('update:modelValue', false)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="modelValue" 
        class="modal-overlay"
        @click.self="closeOnOverlay && close()"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* Move modal styles here - shared across all modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
```

**Files to update:**
- `App.vue`: Replace 4 repeated Teleport+Transition blocks (~40 lines) with `<BaseModal>`

**Estimated reduction:** ~30 lines + cleaner template

---

### Task 3.2: Create `src/components/ui/SectionHeader.vue`

**Purpose:** Replace repeated section header pattern.

```vue
<!-- Create new file: src/components/ui/SectionHeader.vue -->
<script setup>
defineProps({
  count: [Number, String],
  label: String
})
</script>

<template>
  <div class="section-header">
    <span class="count-badge">{{ count }}</span>
    <span class="section-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.count-badge {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 20px;
  text-align: center;
}

.section-label {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
```

**Files to update:**
- `PointPopup.vue`: Use component instead of inline markup (appears 5+ times)
- `ImageGallery.vue`: Use component (appears 3+ times)

**Estimated reduction:** ~60 lines of repeated markup and CSS

---

### Task 3.3: Create `src/components/ui/Icon.vue` or use Lucide Icons

**Purpose:** Replace ~50+ inline SVGs with icon component.

**Option A - Simple Icon Component:**
```vue
<!-- Create new file: src/components/ui/Icon.vue -->
<script setup>
const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 }
})

const icons = {
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  // ... add more icons
}
</script>

<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2"
    v-html="icons[name]"
  />
</template>
```

**Option B - Install lucide-vue-next:**
```bash
npm install lucide-vue-next
```

**Estimated reduction:** ~200 lines of inline SVG code

---

## Phase 4: Consolidate/Remove Redundant Components

### Task 4.1: Evaluate MapExport.vue vs ExportPanel.vue

**Analysis:** `MapExport.vue` appears to duplicate most of `ExportPanel.vue` functionality.

**Action:**
1. Compare both components thoroughly
2. If significant overlap exists, merge into `ExportPanel.vue`
3. Delete `MapExport.vue` if redundant
4. Update `App.vue` to remove MapExport modal if deleted

**Estimated reduction:** ~300 lines (if MapExport is deleted)

---

### Task 4.2: Move Store Methods from Components

**Purpose:** Several computed properties should be in the store, not components.

**Move to `src/stores/data.js`:**

```javascript
// Add to store

// Already there but verify:
// groupPointsBySpecies(points)
// getSpeciesWithPhotos(points)
// getPhotoForItem(item)

// Add if not present:
getStatusColor(status) {
  const STATUS_COLORS = {
    'Sequenced': '#3b82f6',
    'Tissue Available': '#10b981',
    // ...
  }
  return STATUS_COLORS[status] || '#888'
}
```

**Files to update:**
- `DataTable.vue`: Use `store.getStatusColor()` instead of local function
- `PointPopup.vue`: Same

**Estimated reduction:** ~20 lines

---

## Phase 5: CSS Consolidation

### Task 5.1: Create `src/styles/components.css`

**Purpose:** Extract repeated component styles.

```css
/* Create new file: src/styles/components.css */

/* Buttons */
.btn-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* Badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.75rem;
}

.mimicry-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Form elements */
.select-base {
  width: 100%;
  padding: 8px 10px;
  background: #252540;
  border: 1px solid #3d3d5c;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.select-base:hover {
  border-color: #5d5d7c;
}

.select-base:focus {
  outline: none;
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

/* Cards/Panels */
.panel-base {
  background: #252540;
  border: 1px solid #3d3d5c;
  border-radius: 8px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
```

**Files to update:**
- Import in `main.js` or `App.vue`
- Replace duplicated styles in: `DataTable.vue`, `PointPopup.vue`, `ExportPanel.vue`, `MimicrySelector.vue`, `ImageGallery.vue`

**Estimated reduction:** ~400 lines of CSS

---

## Implementation Order

Execute in this order to minimize conflicts:

1. **Phase 1** - Constants & Utilities (no component changes yet)
2. **Phase 2** - Composables (test thoroughly)
3. **Phase 3** - UI Components (one at a time)
4. **Phase 4** - Remove redundant code/components
5. **Phase 5** - CSS consolidation (last, as it affects all components)

---

## Summary of Expected Reductions

| Phase | Task | Lines Reduced |
|-------|------|---------------|
| 1.1 | Constants file | ~50 |
| 1.2 | Canvas helpers | ~350 |
| 1.3 | Date helpers | ~30 |
| 2.1 | useSpeciesSelection | ~200 |
| 2.2 | useMapExport | ~400 |
| 2.3 | useModal | ~20 |
| 3.1 | BaseModal | ~30 |
| 3.2 | SectionHeader | ~60 |
| 3.3 | Icon component | ~200 |
| 4.1 | Remove MapExport | ~300 |
| 4.2 | Store methods | ~20 |
| 5.1 | CSS consolidation | ~400 |
| **Total** | | **~2,060 lines** |

---

## Testing Checklist

After each phase, verify:

- [ ] Map view loads and displays points correctly
- [ ] Table view shows data with sorting/filtering
- [ ] All filters work (genus, species, subspecies, mimicry, date)
- [ ] Export to CSV/GeoJSON works
- [ ] Map image export produces correct output
- [ ] Image gallery navigation works
- [ ] Popup displays correct info for clicked points
- [ ] Mimicry selector filters correctly
- [ ] All modals open/close properly
- [ ] Mobile responsive layout intact

---

## Notes for Claude Code

- Run `npm run dev` after each change to verify no build errors
- Use `git diff --stat` to track actual line reduction
- Commit after each task completion
- If a task causes issues, it can be reverted independently
- The store file (`src/stores/data.js`) wasn't included in analysis - review it for additional consolidation opportunities
