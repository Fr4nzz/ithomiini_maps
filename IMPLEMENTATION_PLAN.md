# Customizable Legend & UI Improvements Implementation Plan

**Date:** January 2026
**Project:** Ithomiini Maps
**Status:** Planning

---

## Overview

This plan merges the goals from `LEGEND_CUSTOMIZATION_RESEARCH.md` and `SHADCN_MIGRATION_RESEARCH.md` into a single implementation strategy **without using shadcn-vue** (abandoned due to styling issues).

### Key Goals

1. **Customizable Legend** - Editable labels, color pickers, draggable, resizable
2. **Code Reduction** - Refactor large components into smaller modules
3. **Theme System** - Preset themes using CSS variables
4. **UI Polish** - Lucide icons, VueUse utilities, better organization

### Tech Stack (No Changes to Framework)

- **Keep:** Vue 3 + Vite + Plain CSS + Pinia + MapLibre GL
- **Add:** VueUse, Lucide Vue icons, vue-color, vue-contenteditable
- **Remove:** Nothing (keep vue-multiselect)

---

## Phase 1: Foundation & Dependencies

### 1.1 Install VueUse
**Purpose:** Provides composables for drag, resize, color mode, and many utilities

```bash
pnpm add @vueuse/core
```

**Key composables we'll use:**
- `useDraggable` - Make legend draggable
- `useResizeObserver` - Detect legend size changes
- `useColorMode` - Theme switching
- `useLocalStorage` - Persist user preferences
- `useElementBounding` - Get element dimensions
- `onClickOutside` - Close popovers

### 1.2 Install Lucide Vue Icons
**Purpose:** Replace inline SVGs with consistent icon library

```bash
pnpm add lucide-vue-next
```

**Benefits:**
- 1500+ icons available
- Tree-shakable (only import what you use)
- Consistent sizing and styling
- TypeScript support

**Icons we'll use:**
- `Calendar`, `Filter`, `Info`, `X`, `Check` - Already in components
- `GripVertical` - Drag handle
- `Palette` - Color picker
- `Type` - Text editing
- `Settings`, `Eye`, `EyeOff` - Legend controls
- `Move`, `Maximize2`, `Lock`, `Unlock` - Position/resize controls

### 1.3 Install vue-color
**Purpose:** Color picker for legend items

```bash
pnpm add @ckpack/vue-color
```

**Picker styles available:**
- `Compact` - Small swatch grid (recommended for legend)
- `Chrome` - Full-featured picker
- `Sketch` - Sketch-app style

### 1.4 Install vue-contenteditable
**Purpose:** Inline text editing for legend labels

```bash
pnpm add vue-contenteditable
```

---

## Phase 2: Legend Component Refactor

### 2.1 Create Legend Directory Structure

```
src/components/Legend/
├── Legend.vue                 # Main container (draggable, resizable)
├── LegendItem.vue             # Single legend entry
├── LegendColorPicker.vue      # Color picker popover
├── LegendEditableLabel.vue    # Inline text editing
├── LegendToolbar.vue          # Hover controls (color-by, settings)
├── LegendResizeHandle.vue     # Custom resize handle
└── index.js                   # Exports
```

### 2.2 Create Legend Pinia Store

**File:** `src/stores/legend.js`

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export const useLegendStore = defineStore('legend', () => {
  // Position (x, y coordinates for free positioning)
  const position = useLocalStorage('legend-position', { x: 40, y: 40 })

  // Size
  const size = useLocalStorage('legend-size', { width: 200, height: 'auto' })

  // Display settings
  const showLegend = ref(true)
  const textScale = useLocalStorage('legend-text-scale', 1)
  const dotScale = useLocalStorage('legend-dot-scale', 1)

  // Behavior
  const stickyEdges = useLocalStorage('legend-sticky', true)
  const snapThreshold = ref(20) // pixels

  // Custom labels (overrides for auto-generated labels)
  const customLabels = useLocalStorage('legend-custom-labels', {})

  // Custom colors (overrides for auto-generated colors)
  const customColors = useLocalStorage('legend-custom-colors', {})

  // Hidden items
  const hiddenItems = useLocalStorage('legend-hidden-items', [])

  // Item order (for reordering)
  const itemOrder = useLocalStorage('legend-item-order', [])

  // Actions
  function updatePosition(x, y) {
    position.value = { x, y }
  }

  function updateSize(width, height) {
    size.value = { width, height }
  }

  function setCustomLabel(originalLabel, customLabel) {
    customLabels.value[originalLabel] = customLabel
  }

  function setCustomColor(label, color) {
    customColors.value[label] = color
  }

  function toggleItemVisibility(label) {
    const index = hiddenItems.value.indexOf(label)
    if (index > -1) {
      hiddenItems.value.splice(index, 1)
    } else {
      hiddenItems.value.push(label)
    }
  }

  function resetCustomizations() {
    customLabels.value = {}
    customColors.value = {}
    hiddenItems.value = []
    itemOrder.value = []
  }

  return {
    position,
    size,
    showLegend,
    textScale,
    dotScale,
    stickyEdges,
    snapThreshold,
    customLabels,
    customColors,
    hiddenItems,
    itemOrder,
    updatePosition,
    updateSize,
    setCustomLabel,
    setCustomColor,
    toggleItemVisibility,
    resetCustomizations
  }
})
```

### 2.3 Implement Legend.vue (Main Container)

**Features:**
- Draggable with VueUse `useDraggable`
- Sticky edges (snap to container edges)
- Resizable with proportional scaling
- Hover state to show edit controls
- Export mode (hide edit UI)

**Key implementation:**

```vue
<script setup>
import { ref, computed, watch } from 'vue'
import { useDraggable, useElementBounding, useResizeObserver } from '@vueuse/core'
import { useLegendStore } from '@/stores/legend'
import { useDataStore } from '@/stores/data'
import LegendItem from './LegendItem.vue'
import LegendToolbar from './LegendToolbar.vue'

const legendStore = useLegendStore()
const dataStore = useDataStore()

const legendRef = ref(null)
const containerRef = ref(null) // Map container
const isHovered = ref(false)

// Draggable
const { x, y, isDragging } = useDraggable(legendRef, {
  initialValue: legendStore.position,
  onMove(pos) {
    if (legendStore.stickyEdges) {
      return snapToEdges(pos.x, pos.y)
    }
    return pos
  },
  onEnd(pos) {
    legendStore.updatePosition(pos.x, pos.y)
  }
})

// Sticky edges logic
const container = useElementBounding(containerRef)
const legend = useElementBounding(legendRef)

function snapToEdges(posX, posY) {
  const threshold = legendStore.snapThreshold
  let x = posX
  let y = posY

  // Snap to left
  if (x < threshold) x = 10
  // Snap to right
  if (x > container.width.value - legend.width.value - threshold) {
    x = container.width.value - legend.width.value - 10
  }
  // Snap to top
  if (y < threshold) y = 60 // Account for controls
  // Snap to bottom
  if (y > container.height.value - legend.height.value - threshold) {
    y = container.height.value - legend.height.value - 30
  }

  return { x, y }
}

// Resize observer for proportional scaling
const baseSize = { width: 200, fontSize: 14, dotSize: 10 }
const currentWidth = ref(200)

useResizeObserver(legendRef, (entries) => {
  currentWidth.value = entries[0].contentRect.width
})

const scaleFactor = computed(() => currentWidth.value / baseSize.width)

// Export mode detection
const isExportMode = computed(() => dataStore.exportSettings.enabled)
</script>
```

### 2.4 Implement LegendItem.vue

**Features:**
- Editable label (click to edit)
- Color picker (click dot to change color)
- Remove/hide button
- Drag handle for reordering (future)

### 2.5 Implement LegendColorPicker.vue

**Features:**
- Click on legend dot opens color picker popover
- Uses vue-color Compact picker
- Saves to legendStore.customColors

### 2.6 Implement LegendEditableLabel.vue

**Features:**
- Uses vue-contenteditable
- Shows edit indicator on hover
- Saves to legendStore.customLabels
- Escape to cancel, Enter to save

### 2.7 Implement LegendToolbar.vue

**Features:**
- Appears on legend hover
- Contains:
  - Color-by dropdown (moved from sidebar)
  - Toggle sticky edges
  - Reset customizations
  - Close legend button

---

## Phase 3: Migrate Settings from Sidebar

### 3.1 Remove Legend Settings from Sidebar

**Current location:** `SidebarMapSettings.vue`

Move these controls to LegendToolbar:
- Color-by dropdown
- Max items setting
- Text size slider
- Show/hide legend toggle

Keep in sidebar (or remove):
- Legend position dropdown (replaced by drag)

### 3.2 Update Sidebar.vue

- Remove legend settings section
- Update imports
- Reduce component size

---

## Phase 4: Theme System

### 4.1 Create Theme Presets

**File:** `src/themes/presets.js`

```javascript
export const themes = {
  dark: {
    name: 'Dark Scientific',
    colors: {
      bgPrimary: '#1a1a2e',
      bgSecondary: '#252540',
      bgTertiary: '#2d2d4a',
      border: '#3d3d5c',
      textPrimary: '#e0e0e0',
      textSecondary: '#aaa',
      textMuted: '#666',
      accent: '#4ade80',
      accentHover: '#5eeb94',
      danger: '#ef4444'
    }
  },
  light: {
    name: 'Light Mode',
    colors: {
      bgPrimary: '#f5f5f5',
      bgSecondary: '#ffffff',
      bgTertiary: '#e8e8e8',
      border: '#d0d0d0',
      textPrimary: '#1a1a2e',
      textSecondary: '#555',
      textMuted: '#888',
      accent: '#10b981',
      accentHover: '#059669',
      danger: '#dc2626'
    }
  },
  ocean: {
    name: 'Ocean Blue',
    colors: {
      bgPrimary: '#0f172a',
      bgSecondary: '#1e293b',
      bgTertiary: '#334155',
      border: '#475569',
      textPrimary: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textMuted: '#64748b',
      accent: '#38bdf8',
      accentHover: '#7dd3fc',
      danger: '#f87171'
    }
  },
  forest: {
    name: 'Forest Green',
    colors: {
      bgPrimary: '#14201a',
      bgSecondary: '#1c2b23',
      bgTertiary: '#243830',
      border: '#3d5c4a',
      textPrimary: '#e0ebe5',
      textSecondary: '#a0c0aa',
      textMuted: '#607860',
      accent: '#22c55e',
      accentHover: '#4ade80',
      danger: '#ef4444'
    }
  }
}
```

### 4.2 Create Theme Store

**File:** `src/stores/theme.js`

```javascript
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { themes } from '@/themes/presets'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = useLocalStorage('app-theme', 'dark')

  function applyTheme(themeName) {
    const theme = themes[themeName]
    if (!theme) return

    currentTheme.value = themeName

    // Apply CSS variables
    const root = document.documentElement
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--color-${kebabCase(key)}`
      root.style.setProperty(cssVar, value)
    })

    // Add theme class for potential CSS selectors
    root.className = `theme-${themeName}`
  }

  // Apply theme on init
  applyTheme(currentTheme.value)

  return {
    currentTheme,
    themes,
    applyTheme
  }
})

function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
```

### 4.3 Create Theme Selector Component

**File:** `src/components/ThemeSelector.vue`

Simple dropdown to switch themes, placed in header or settings.

---

## Phase 5: Code Organization & Cleanup

### 5.1 Replace Inline SVGs with Lucide Icons

**Files to update:**
- `DateFilter.vue` - Calendar, Filter, Info icons
- `FilterSelect.vue` - Chevron icon
- `Sidebar.vue` - Various icons
- `ExportPanel.vue` - Export icons
- `MimicrySelector.vue` - Various icons
- `DataTable.vue` - Sort, filter icons

**Example replacement:**

Before:
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
  <line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8" y1="2" x2="8" y2="6"/>
  <line x1="3" y1="10" x2="21" y2="10"/>
</svg>
```

After:
```vue
<script setup>
import { Calendar } from 'lucide-vue-next'
</script>

<template>
  <Calendar class="w-4 h-4" />
</template>
```

### 5.2 Refactor Sidebar.vue (Future)

**Current size:** 1797 lines

**Proposed structure:**
```
src/components/Sidebar/
├── Sidebar.vue              # Container (~200 lines)
├── SidebarHeader.vue        # Logo, collapse button
├── SidebarSearch.vue        # CAMID search
├── SidebarFilters.vue       # Taxonomy filters
├── SidebarQuickFilters.vue  # Status, source, sex
├── SidebarDateFilter.vue    # Date range (existing component)
├── SidebarStats.vue         # Record counts
├── SidebarActions.vue       # Load data, export buttons
└── index.js
```

**Note:** This is lower priority than legend features.

### 5.3 Consolidate Color Constants

**File:** `src/utils/colors.js`

```javascript
// Status colors - single source of truth
export const STATUS_COLORS = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Only': '#6b7280'
}

// Generate CSS variables
export function getStatusCSSVars() {
  return Object.entries(STATUS_COLORS)
    .map(([status, color]) => {
      const key = status.toLowerCase().replace(/\s+/g, '-')
      return `--color-status-${key}: ${color};`
    })
    .join('\n')
}

// Default color palettes for colorBy
export const COLOR_PALETTES = {
  categorical: [
    '#4ade80', '#f472b6', '#60a5fa', '#fbbf24', '#a78bfa',
    '#fb923c', '#34d399', '#f87171', '#38bdf8', '#c084fc'
  ],
  sequential: {
    green: ['#dcfce7', '#86efac', '#4ade80', '#22c55e', '#16a34a'],
    blue: ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb']
  }
}
```

---

## Phase 6: Testing & Polish

### 6.1 Legend Export Testing

Ensure legend looks correct in exported images:
- Hide all edit UI (hover controls, handles)
- Preserve custom colors and labels
- Test with html-to-image library

### 6.2 Persistence Testing

Verify localStorage persistence:
- Legend position
- Custom colors and labels
- Theme preference
- Hidden items

### 6.3 Cross-browser Testing

- Chrome, Firefox, Safari, Edge
- Test drag/resize functionality
- Test color picker popover positioning

### 6.4 Accessibility

- Keyboard navigation for legend items
- ARIA labels for interactive elements
- Focus indicators

---

## Implementation Order

### Week 1: Foundation
1. Install dependencies (VueUse, Lucide, vue-color, vue-contenteditable)
2. Create Legend store
3. Create basic Legend.vue with drag support

### Week 2: Legend Features
4. Implement LegendItem with editable label
5. Implement color picker
6. Add sticky edges toggle
7. Add resize functionality

### Week 3: UI Migration
8. Create LegendToolbar with color-by dropdown
9. Move settings from sidebar to legend hover
10. Replace inline SVGs with Lucide icons

### Week 4: Theme System
11. Create theme presets
12. Create theme store
13. Add theme selector
14. Test theme application

### Week 5: Cleanup & Testing
15. Refactor Sidebar (optional)
16. Consolidate color constants
17. Cross-browser testing
18. Export testing

---

## Dependencies Summary

| Package | Purpose | Version |
|---------|---------|---------|
| `@vueuse/core` | Composables (drag, resize, storage) | latest |
| `lucide-vue-next` | Icon library | latest |
| `@ckpack/vue-color` | Color picker | latest |
| `vue-contenteditable` | Inline text editing | latest |

**Install command:**
```bash
pnpm add @vueuse/core lucide-vue-next @ckpack/vue-color vue-contenteditable
```

---

## Files to Create

1. `src/stores/legend.js` - Legend state management
2. `src/stores/theme.js` - Theme state management
3. `src/themes/presets.js` - Theme definitions
4. `src/components/Legend/Legend.vue` - Main container
5. `src/components/Legend/LegendItem.vue` - Item row
6. `src/components/Legend/LegendColorPicker.vue` - Color picker
7. `src/components/Legend/LegendEditableLabel.vue` - Text editing
8. `src/components/Legend/LegendToolbar.vue` - Hover controls
9. `src/components/Legend/index.js` - Exports
10. `src/components/ThemeSelector.vue` - Theme dropdown
11. `src/utils/colors.js` - Color constants

---

## Files to Modify

1. `src/components/MapEngine.vue` - Replace inline legend with Legend component
2. `src/components/SidebarMapSettings.vue` - Remove legend settings
3. `src/components/Sidebar.vue` - Update structure
4. `src/components/DateFilter.vue` - Replace SVGs with Lucide
5. `src/style.css` - Add theme classes
6. `src/main.js` - Initialize theme store

---

## Success Criteria

- [ ] Legend is draggable to any position
- [ ] Legend snaps to edges (toggleable)
- [ ] Legend is resizable with proportional content scaling
- [ ] Legend labels are editable inline
- [ ] Legend colors are customizable via picker
- [ ] Legend items can be hidden/shown
- [ ] Custom settings persist across sessions
- [ ] Edit UI hidden in export mode
- [ ] Multiple theme presets available
- [ ] Theme persists across sessions
- [ ] Inline SVGs replaced with Lucide icons
- [ ] Code is better organized

---

## Notes

- **No shadcn-vue** - Previous migration attempts caused styling issues
- **Keep vue-multiselect** - Works well, no need to replace
- **Keep plain CSS** - CSS variables provide sufficient theming
- **Incremental approach** - Each phase can be deployed independently
