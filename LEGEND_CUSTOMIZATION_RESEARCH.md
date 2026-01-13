# Customizable Legend Implementation Research Report

**Date:** January 2026
**Project:** Ithomiini Maps
**Current Stack:** Vue 3 + Vite + Plain CSS + MapLibre GL + Pinia

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Tech Stack Analysis](#current-tech-stack-analysis)
3. [Feature Requirements](#feature-requirements)
4. [UI Component Libraries](#ui-component-libraries)
5. [Drag & Drop Solutions](#drag--drop-solutions)
6. [Color Picker Libraries](#color-picker-libraries)
7. [Resize & Transform Libraries](#resize--transform-libraries)
8. [Inline Text Editing](#inline-text-editing)
9. [Theming Solutions](#theming-solutions)
10. [CSS Framework Migration](#css-framework-migration)
11. [Framework Migration Considerations](#framework-migration-considerations)
12. [Recommended Architecture](#recommended-architecture)
13. [Implementation Roadmap](#implementation-roadmap)
14. [Sources & References](#sources--references)

---

## Executive Summary

This research evaluates the best tools and libraries for implementing a fully customizable, interactive legend component with the following capabilities:

- **Inline editable text labels**
- **Clickable color pickers for each legend item**
- **Draggable positioning with sticky edges (toggleable)**
- **Resizable legend with smooth scaling**
- **Theme support across the entire application**
- **Hover-to-reveal edit controls (clean export appearance)**

### Key Recommendations

| Feature | Recommended Solution | Alternative |
|---------|---------------------|-------------|
| **UI Components** | shadcn-vue + Reka UI | PrimeVue |
| **CSS Framework** | Tailwind CSS v4 | Keep plain CSS |
| **Drag & Drop** | VueUse `useDraggable` | @vueuse/gesture |
| **Color Picker** | vue-color (ckpack) | Radix-style custom |
| **Resize** | VueUse `useResizeObserver` + CSS resize | interact.js |
| **Inline Editing** | vue-contenteditable | Native contenteditable |
| **Theming** | CSS Variables + Tailwind | Pinia theme store |
| **Framework** | **Keep Vue 3** | No migration needed |

**Verdict:** Vue 3 is an excellent choice for this project. No framework migration is needed. The recommended approach is to adopt **shadcn-vue** (built on Reka UI) with **Tailwind CSS v4** for the component library and theming, combined with **VueUse** composables for drag/resize functionality.

---

## Current Tech Stack Analysis

### What You Have Now

```
├── Framework:     Vue 3.5.24 (Composition API)
├── Build Tool:    Vite 7.2.4
├── CSS:           Plain CSS with CSS Variables (custom properties)
├── State:         Pinia 3.0.4
├── Mapping:       MapLibre GL 5.13.0
├── UI Library:    None (custom components)
└── Legend:        Built inline in MapEngine.vue
```

### Current Legend Implementation

The legend is currently:
- **Location:** Embedded in `MapEngine.vue` (lines 440-465)
- **Styling:** Scoped CSS with 4 fixed positions
- **State:** Managed via Pinia (`legendSettings`)
- **Controls:** Sidebar panel with dropdowns/sliders
- **Export:** Captured via `html-to-image` library

### Strengths of Current Setup
- Clean, well-organized codebase
- CSS variables already in place for theming
- Pinia provides centralized state management
- Modern Vue 3 Composition API throughout

### Gaps to Address
- No drag-and-drop capability
- Fixed position options only (4 corners)
- No inline editing of labels
- No per-item color customization
- Limited resize options
- No dark/light theme toggle

---

## Feature Requirements

### Core Legend Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Editable Labels | Click on text to edit in-place | High |
| Color Pickers | Click legend dots to change fill color | High |
| Draggable | Move legend anywhere on map | High |
| Sticky Edges | Snap to edges (toggleable) | Medium |
| Resizable | Resize the entire legend container | Medium |
| Proportional Scaling | Text and dots scale with container | Medium |
| Remove Items | Delete individual legend entries | Medium |
| Reorder Items | Drag to reorder legend entries | Low |

### UI/UX Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Hover Controls | Show edit UI on hover, hide on export | High |
| Floating Toolbar | Color-by, settings appear on legend hover | High |
| Theme Support | Dark/light/custom themes app-wide | Medium |
| Precision Mode | Disable sticky for fine positioning | Low |
| Context Menu | Right-click for more options | Low |

---

## UI Component Libraries

### Option 1: shadcn-vue (Recommended)

**What it is:** A Vue port of the popular shadcn/ui library. It's not a traditional component library—it's a collection of reusable components that you copy into your project and own.

**Built on:** Reka UI (formerly Radix Vue) primitives

**Key Features:**
- Beautiful, accessible components by default
- Full styling control (you own the code)
- Built on Tailwind CSS
- TypeScript support
- Active development and large community
- CLI for adding components: `npx shadcn-vue@latest add [component]`

**Components Useful for Legend:**
- `Popover` - For color picker dropdowns
- `DropdownMenu` - For context menus
- `Dialog` - For settings modals
- `Slider` - For size controls
- `Toggle` - For sticky mode
- `Tooltip` - For hover hints
- `ContextMenu` - Right-click menus

**Installation:**
```bash
# Initialize shadcn-vue (requires Tailwind CSS)
npx shadcn-vue@latest init

# Add specific components
npx shadcn-vue@latest add popover dropdown-menu slider toggle
```

**Pros:**
- Components live in your codebase (full control)
- Excellent accessibility (WAI-ARIA compliant)
- Beautiful defaults, easy to customize
- Very active community
- Works perfectly with Vue 3 + Vite

**Cons:**
- Requires Tailwind CSS (migration needed)
- More setup than drop-in libraries
- You maintain the component code

**GitHub:** 5,800+ stars
**Weekly Downloads:** Growing rapidly
**Website:** https://www.shadcn-vue.com/

---

### Option 2: Reka UI (Direct)

**What it is:** The Vue port of Radix UI primitives. It's what shadcn-vue is built on, but without pre-styled components.

**Key Features:**
- 40+ unstyled, accessible primitive components
- WAI-ARIA compliant
- Composable architecture
- Used by Nuxt UI v3

**When to Choose:**
- If you want maximum styling flexibility
- If you don't want Tailwind CSS
- If you prefer building your own design system

**Installation:**
```bash
npm install reka-ui
```

**Components Available:**
- Popover, Dialog, DropdownMenu
- Slider, Toggle, Switch
- ContextMenu, Tooltip
- Collapsible, Accordion

**Pros:**
- Maximum flexibility
- Zero styling opinions
- Excellent accessibility
- Works with any CSS approach

**Cons:**
- More work to style from scratch
- No pre-built beautiful designs

**GitHub:** 4,000+ stars
**Website:** https://reka-ui.com/

---

### Option 3: PrimeVue

**What it is:** A comprehensive UI library with 90+ components, including a built-in ColorPicker.

**Key Features:**
- 90+ production-ready components
- Multiple themes (Lara, Aura, Material, etc.)
- Tailwind CSS integration available
- Built-in ColorPicker component
- Extensive documentation

**Components for Legend:**
- `ColorPicker` - Built-in color selection
- `OverlayPanel` - Floating panels
- `ContextMenu` - Right-click menus
- `Slider` - Range controls
- `InputText` - Editable fields

**Installation:**
```bash
npm install primevue @primeuix/themes
```

**Pros:**
- Batteries included (ColorPicker built-in)
- Very comprehensive
- Good documentation
- Active development

**Cons:**
- Heavier bundle size
- Less flexible styling
- Opinionated design

**GitHub:** 11,000+ stars
**Weekly Downloads:** 280,000+
**Website:** https://primevue.org/

---

### Option 4: Vuetify

**What it is:** Material Design component framework for Vue.

**Key Features:**
- 80+ Material Design components
- Comprehensive theming system
- Large ecosystem

**Pros:**
- Very mature and stable
- Excellent documentation
- Large community

**Cons:**
- Material Design only (may not fit research aesthetic)
- Heavy bundle size
- Opinionated styling

**GitHub:** 40,000+ stars
**Weekly Downloads:** 600,000+
**Website:** https://vuetifyjs.com/

---

### Comparison Matrix

| Criteria | shadcn-vue | Reka UI | PrimeVue | Vuetify |
|----------|-----------|---------|----------|---------|
| Styling Control | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ |
| Accessibility | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Bundle Size | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ |
| Components | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★★★ |
| Learning Curve | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★★★★ |
| Customization | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ |
| Active Dev | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★☆ |

**Recommendation:** **shadcn-vue** provides the best balance of beautiful defaults and full customization control, which is ideal for a research application where you want a professional look but may need to customize extensively.

---

## Drag & Drop Solutions

### Option 1: VueUse `useDraggable` (Recommended)

**What it is:** A composable from the VueUse collection that makes any element draggable.

**Key Features:**
- Simple, reactive API
- Touch support
- Boundary constraints
- Position persistence
- Lightweight

**Usage Example:**
```vue
<script setup>
import { ref } from 'vue'
import { useDraggable } from '@vueuse/core'

const legendRef = ref(null)
const { x, y, style, isDragging } = useDraggable(legendRef, {
  initialValue: { x: 40, y: 40 },
  onMove(position, event) {
    // Implement sticky edges here
  }
})
</script>

<template>
  <div ref="legendRef" :style="style" class="legend">
    <!-- Legend content -->
  </div>
</template>
```

**Sticky Edges Implementation:**
```javascript
const SNAP_THRESHOLD = 20 // pixels

function snapToEdges(x, y, containerWidth, containerHeight, legendWidth, legendHeight) {
  let snappedX = x
  let snappedY = y

  // Snap to left edge
  if (x < SNAP_THRESHOLD) snappedX = 0
  // Snap to right edge
  if (x > containerWidth - legendWidth - SNAP_THRESHOLD) {
    snappedX = containerWidth - legendWidth
  }
  // Snap to top edge
  if (y < SNAP_THRESHOLD) snappedY = 0
  // Snap to bottom edge
  if (y > containerHeight - legendHeight - SNAP_THRESHOLD) {
    snappedY = containerHeight - legendHeight
  }

  return { x: snappedX, y: snappedY }
}
```

**Pros:**
- Already using VueUse patterns in Vue ecosystem
- Minimal bundle impact
- Perfect Vue 3 integration
- Active maintenance

**Cons:**
- Need to implement sticky edges manually

**Installation:**
```bash
npm install @vueuse/core
```

---

### Option 2: @vueuse/gesture

**What it is:** A gesture library for Vue based on @use-gesture/vanilla.

**Key Features:**
- Advanced gesture recognition
- Pinch, rotate, drag, scroll
- Velocity and direction tracking

**When to Choose:**
- If you need more than simple dragging
- If you want gesture-based interactions

---

### Option 3: vue-draggable-plus

**What it is:** A Vue 3 wrapper for Sortable.js.

**Key Features:**
- Drag to reorder lists
- Multi-drag support
- Animation support

**When to Choose:**
- If you need to reorder legend items
- If you want sortable lists

**Installation:**
```bash
npm install vue-draggable-plus
```

---

### Option 4: interact.js

**What it is:** A powerful drag/resize/gesture library.

**Key Features:**
- Drag and drop
- Resize handles
- Multi-touch gestures
- Snap/restrict targets
- Inertia

**Built-in Snap Feature:**
```javascript
interact('.legend').draggable({
  modifiers: [
    interact.modifiers.snap({
      targets: [
        interact.snappers.grid({ x: 10, y: 10 }),
        // Snap to edges
        { x: 0, y: 0 },
        { x: containerWidth, y: 0 }
      ],
      range: 20,
      relativePoints: [{ x: 0, y: 0 }]
    })
  ]
})
```

**Pros:**
- Battle-tested library
- Built-in snapping
- Resize + drag in one library

**Cons:**
- Not Vue-specific (needs wrapper)
- Larger bundle

**Installation:**
```bash
npm install interactjs
```

---

### Recommendation

**Primary:** VueUse `useDraggable` for simple, Vue-native dragging with custom sticky edge logic.

**Alternative:** interact.js if you need built-in snapping and combined drag/resize functionality.

---

## Color Picker Libraries

### Option 1: vue-color (ckpack/vue-color) - Recommended

**What it is:** A comprehensive color picker library for Vue 3 with multiple picker styles.

**Picker Styles Available:**
- Chrome (Google Chrome DevTools style)
- Sketch (Sketch app style)
- Photoshop (Adobe Photoshop style)
- Compact (minimal swatch grid)
- Grayscale (grayscale only)
- Slider (hue slider)
- Material (Material Design)
- Swatches (preset color swatches)

**Key Features:**
- Vue 3 support (v3.x branch)
- Multiple picker styles
- Supports hex, rgb, hsl, hsv formats
- Built on tinycolor2
- Tree-shakable

**Usage Example:**
```vue
<script setup>
import { Chrome } from '@ckpack/vue-color'

const color = ref({ hex: '#4ade80' })
</script>

<template>
  <Chrome v-model="color" />
</template>
```

**For Legend Integration (Compact Picker):**
```vue
<script setup>
import { Compact } from '@ckpack/vue-color'

const legendColors = ref({
  'Species A': '#4ade80',
  'Species B': '#3b82f6'
})

function updateColor(label, colorData) {
  legendColors.value[label] = colorData.hex
}
</script>

<template>
  <div v-for="(color, label) in legendColors" class="legend-item">
    <Popover>
      <PopoverTrigger>
        <span class="legend-dot" :style="{ backgroundColor: color }" />
      </PopoverTrigger>
      <PopoverContent>
        <Compact :model-value="{ hex: color }" @update:model-value="updateColor(label, $event)" />
      </PopoverContent>
    </Popover>
    <span>{{ label }}</span>
  </div>
</template>
```

**Installation:**
```bash
npm install @ckpack/vue-color
```

**GitHub:** https://github.com/ckpack/vue-color

---

### Option 2: vue-color-kit

**What it is:** A lightweight, configurable color picker for Vue 3.

**Key Features:**
- Theme support (dark/light)
- Eyedropper tool (color sucker)
- Color history
- Preset colors

**Pros:**
- Very lightweight
- Nice theme support
- Modern API

**Cons:**
- Fewer picker style options

---

### Option 3: PrimeVue ColorPicker

**What it is:** Built-in color picker if you're using PrimeVue.

**Key Features:**
- Inline or overlay mode
- Multiple formats (hex, rgb, hsb)
- Part of PrimeVue ecosystem

**Accessibility Note:** Currently not fully accessible (no WAI-ARIA support for color picking). Future versions will add text field inputs.

---

### Option 4: Custom with Reka UI

Build a custom color picker using Reka UI primitives:

```vue
<script setup>
import { PopoverRoot, PopoverTrigger, PopoverContent } from 'reka-ui'
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger class="color-swatch" :style="{ background: color }" />
    <PopoverContent class="color-picker-panel">
      <!-- Custom color picker UI -->
      <input type="color" v-model="color" />
      <!-- Or build custom sliders -->
    </PopoverContent>
  </PopoverRoot>
</template>
```

---

### Comparison

| Library | Styles | Size | Vue 3 | Accessibility |
|---------|--------|------|-------|---------------|
| vue-color | 8 styles | Medium | Yes | Good |
| vue-color-kit | 1 style | Small | Yes | Good |
| PrimeVue | 1 style | Large* | Yes | Limited |
| Native `<input type="color">` | 1 style | Zero | Yes | Excellent |

*PrimeVue size is for the whole library

**Recommendation:** Use **vue-color** for its variety of styles and good Vue 3 support. The Compact or Chrome style would work well for legend color editing.

---

## Resize & Transform Libraries

### Option 1: VueUse + CSS (Recommended)

**Approach:** Combine VueUse's `useResizeObserver` with CSS `resize` property.

**CSS Resize Property:**
```css
.legend {
  resize: both;
  overflow: auto;
  min-width: 150px;
  max-width: 400px;
  min-height: 100px;
  max-height: 600px;
}
```

**Watch for Size Changes:**
```vue
<script setup>
import { ref, computed } from 'vue'
import { useResizeObserver } from '@vueuse/core'

const legendRef = ref(null)
const legendSize = ref({ width: 200, height: 300 })

useResizeObserver(legendRef, (entries) => {
  const { width, height } = entries[0].contentRect
  legendSize.value = { width, height }
})

// Scale factor for proportional content
const scaleFactor = computed(() => {
  const baseWidth = 200 // Original width
  return legendSize.value.width / baseWidth
})
</script>

<template>
  <div ref="legendRef" class="legend">
    <div :style="{ transform: `scale(${scaleFactor})`, transformOrigin: 'top left' }">
      <!-- Legend content scales proportionally -->
    </div>
  </div>
</template>
```

**Pros:**
- Native browser resize handle
- Minimal JavaScript
- Smooth performance

**Cons:**
- Limited styling of resize handle
- May not work on all browsers

---

### Option 2: interact.js Resizable

**What it is:** Full programmatic resize control with interact.js.

**Features:**
- Resize from any edge/corner
- Preserve aspect ratio option
- Min/max constraints
- Resize events

**Usage:**
```javascript
import interact from 'interactjs'

interact('.legend').resizable({
  edges: { left: true, right: true, bottom: true, top: true },
  modifiers: [
    interact.modifiers.restrictSize({
      min: { width: 150, height: 100 },
      max: { width: 400, height: 600 }
    })
  ],
  listeners: {
    move(event) {
      const { width, height } = event.rect
      event.target.style.width = `${width}px`
      event.target.style.height = `${height}px`
    }
  }
})
```

**Pros:**
- Full control over resize behavior
- Custom resize handles
- Works everywhere

**Cons:**
- More code
- Larger bundle

---

### Option 3: vue-resizable

**What it is:** A Vue component wrapper for resizable elements.

**Installation:**
```bash
npm install vue-resizable
```

**Usage:**
```vue
<template>
  <VueResizable
    :width="200"
    :height="300"
    :min-width="150"
    :max-width="400"
    @resize:end="onResizeEnd"
  >
    <div class="legend">
      <!-- Content -->
    </div>
  </VueResizable>
</template>
```

---

### Proportional Scaling Strategy

For smooth legend content scaling during resize:

```vue
<script setup>
const baseSize = { width: 200, height: 300, fontSize: 14, dotSize: 10 }
const currentSize = ref({ width: 200, height: 300 })

const scaledStyles = computed(() => {
  const scale = currentSize.value.width / baseSize.width
  return {
    fontSize: `${baseSize.fontSize * scale}px`,
    dotSize: `${baseSize.dotSize * scale}px`,
    gap: `${10 * scale}px`,
    padding: `${12 * scale}px ${16 * scale}px`
  }
})
</script>

<template>
  <div class="legend" :style="{ fontSize: scaledStyles.fontSize }">
    <div
      v-for="item in items"
      class="legend-item"
      :style="{ gap: scaledStyles.gap }"
    >
      <span
        class="legend-dot"
        :style="{
          width: scaledStyles.dotSize,
          height: scaledStyles.dotSize
        }"
      />
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>
```

---

### Recommendation

**For simplicity:** Use CSS `resize` property with `useResizeObserver` to detect changes.

**For full control:** Use interact.js for both drag and resize in one package.

---

## Inline Text Editing

### Option 1: vue-contenteditable (Recommended)

**What it is:** A Vue 3 component that wraps `contenteditable` with v-model support.

**Key Features:**
- v-model binding
- Prevent HTML paste
- Prevent new lines
- Placeholder support
- Blur/Enter events

**Installation:**
```bash
npm install vue-contenteditable
```

**Usage:**
```vue
<script setup>
import ContentEditable from 'vue-contenteditable'

const legendLabel = ref('Species A')
</script>

<template>
  <div class="legend-item">
    <span class="legend-dot" />
    <ContentEditable
      v-model="legendLabel"
      tag="span"
      :no-html="true"
      :no-nl="true"
      class="editable-label"
    />
  </div>
</template>

<style>
.editable-label {
  outline: none;
  cursor: text;
  border-bottom: 1px dashed transparent;
}

.editable-label:hover {
  border-bottom-color: #4ade80;
}

.editable-label:focus {
  border-bottom-color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}
</style>
```

**Pros:**
- Simple, focused functionality
- Good Vue 3 support
- Lightweight

**Cons:**
- Some edge cases with selection
- May need careful styling

---

### Option 2: Native contenteditable

**What it is:** Use the HTML contenteditable attribute directly with Vue.

**Implementation:**
```vue
<script setup>
const label = ref('Species A')

function onInput(event) {
  label.value = event.target.innerText
}

function onKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    event.target.blur()
  }
}
</script>

<template>
  <span
    contenteditable="true"
    @input="onInput"
    @keydown="onKeydown"
    @blur="onBlur"
    v-text="label"
  />
</template>
```

**Pros:**
- No dependencies
- Full control
- Native performance

**Cons:**
- More code to handle edge cases
- Need to sync manually

---

### Option 3: Input Field Toggle

**What it is:** Show an input field on click, hide on blur.

**Implementation:**
```vue
<script setup>
const isEditing = ref(false)
const label = ref('Species A')
const inputRef = ref(null)

function startEditing() {
  isEditing.value = true
  nextTick(() => inputRef.value?.focus())
}

function finishEditing() {
  isEditing.value = false
}
</script>

<template>
  <span v-if="!isEditing" @dblclick="startEditing">{{ label }}</span>
  <input
    v-else
    ref="inputRef"
    v-model="label"
    @blur="finishEditing"
    @keydown.enter="finishEditing"
  />
</template>
```

**Pros:**
- Simple mental model
- Clear editing state

**Cons:**
- Layout shift during editing
- Less elegant UX

---

### Recommendation

Use **vue-contenteditable** for a clean, tested solution. For maximum control, implement native contenteditable with proper event handling.

---

## Theming Solutions

### Current State

Your project already uses CSS variables for theming:

```css
:root {
  --color-bg-primary: #0f0f1a;
  --color-bg-secondary: #1a1a2e;
  --color-text-primary: #e0e0e0;
  --color-accent: #4ade80;
  /* ... more variables */
}
```

This is an excellent foundation for theming.

### Option 1: CSS Variables + Theme Class (Recommended)

**Implementation:**
```css
/* Light theme (default) */
:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text-primary: #1a1a2e;
  --color-accent: #10b981;
}

/* Dark theme */
.dark {
  --color-bg-primary: #0f0f1a;
  --color-bg-secondary: #1a1a2e;
  --color-text-primary: #e0e0e0;
  --color-accent: #4ade80;
}

/* Scientific theme */
.theme-scientific {
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #252544;
  --color-text-primary: #e8e8f0;
  --color-accent: #60a5fa;
}
```

**Vue Integration:**
```vue
<script setup>
import { useColorMode } from '@vueuse/core'

const mode = useColorMode({
  modes: {
    light: 'light',
    dark: 'dark',
    scientific: 'theme-scientific'
  }
})
</script>

<template>
  <select v-model="mode">
    <option value="light">Light</option>
    <option value="dark">Dark</option>
    <option value="scientific">Scientific</option>
  </select>
</template>
```

---

### Option 2: Tailwind CSS Dark Mode

If migrating to Tailwind CSS, use its built-in dark mode:

```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <!-- Content adapts to dark mode -->
</div>
```

**Configuration (tailwind.config.js):**
```javascript
module.exports = {
  darkMode: 'class', // or 'media' for system preference
  // ...
}
```

---

### Option 3: Pinia Theme Store

**Implementation:**
```javascript
// stores/theme.js
export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref('dark')
  const themes = {
    light: {
      bgPrimary: '#ffffff',
      textPrimary: '#1a1a2e',
      accent: '#10b981'
    },
    dark: {
      bgPrimary: '#0f0f1a',
      textPrimary: '#e0e0e0',
      accent: '#4ade80'
    }
  }

  const colors = computed(() => themes[currentTheme.value])

  function setTheme(theme) {
    currentTheme.value = theme
    // Apply to CSS variables
    Object.entries(themes[theme]).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--color-${kebabCase(key)}`, value)
    })
  }

  return { currentTheme, colors, setTheme }
})
```

---

### Recommendation

Keep your **CSS variables approach** and enhance it with:
1. A theme class on `<html>` or `<body>`
2. VueUse's `useColorMode` for persistence
3. Multiple theme definitions in CSS

If migrating to Tailwind, use its dark mode utilities alongside CSS variables for custom colors.

---

## CSS Framework Migration

### Should You Migrate to Tailwind CSS?

**Current State:** Plain CSS with CSS variables (well-organized)

### Pros of Migrating to Tailwind

1. **shadcn-vue compatibility** - Required for shadcn-vue
2. **Rapid prototyping** - Faster styling with utility classes
3. **Consistent spacing/sizing** - Built-in design system
4. **Dark mode utilities** - Easy theme switching
5. **Smaller production CSS** - PurgeCSS removes unused styles
6. **Active ecosystem** - Plugins, tools, community

### Cons of Migration

1. **Migration effort** - Need to convert existing CSS
2. **Learning curve** - New class naming conventions
3. **Verbose templates** - Long class strings in HTML
4. **Build time** - Additional build step

### Migration Strategy

**Phase 1: Install Tailwind alongside existing CSS**
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Phase 2: Configure for Vue + Vite**
```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        // Map your existing CSS variables
        primary: 'var(--color-bg-primary)',
        secondary: 'var(--color-bg-secondary)',
        accent: 'var(--color-accent)'
      }
    }
  },
  plugins: []
}
```

**Phase 3: Import Tailwind in main CSS**
```css
/* style.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Keep your existing CSS variables */
:root {
  --color-bg-primary: #0f0f1a;
  /* ... */
}
```

**Phase 4: Gradually convert components**
- Start with new components (Legend)
- Convert existing components over time
- Both CSS approaches can coexist

### Tailwind v4 Considerations

Tailwind v4 was released and brings:
- CSS-first configuration (no JS config needed)
- 3-10x faster builds
- New `@theme` directive
- Requires modern browsers (Safari 16.4+, Chrome 111+, Firefox 128+)

**Recommendation:** Start with Tailwind v3 for stability, plan v4 upgrade later.

---

## Framework Migration Considerations

### Should You Switch from Vue to React?

**Short Answer: No.**

### Analysis

| Aspect | Vue 3 | React |
|--------|-------|-------|
| Your current code | 100% Vue | Would need rewrite |
| shadcn availability | shadcn-vue ✅ | shadcn/ui ✅ |
| Mapping libraries | MapLibre GL works ✅ | MapLibre GL works ✅ |
| Drag libraries | VueUse ✅ | react-dnd, dnd-kit |
| State management | Pinia (excellent) | Redux, Zustand |
| Learning curve | Already know it | Would need to learn |

### Key Points

1. **shadcn-vue exists** - You don't need React for shadcn
2. **VueUse is excellent** - Comparable to React hooks
3. **Reka UI is Vue-native** - Same quality as Radix UI
4. **No library gaps** - Everything you need exists for Vue
5. **Migration cost** - Complete rewrite would take significant time

### Verdict

**Stay with Vue 3.** There's no compelling reason to migrate. Vue 3 has:
- Excellent TypeScript support
- Great composition API
- Active ecosystem
- All the libraries you need

---

## Recommended Architecture

### Legend Component Structure

```
src/
├── components/
│   └── Legend/
│       ├── Legend.vue              # Main container
│       ├── LegendItem.vue          # Individual items
│       ├── LegendColorPicker.vue   # Color editing popover
│       ├── LegendEditableLabel.vue # Inline text editing
│       ├── LegendToolbar.vue       # Hover controls
│       └── useLegendDrag.js        # Draggable composable
├── stores/
│   └── legend.js                   # Legend-specific state
└── composables/
    └── useSticky.js                # Sticky edge logic
```

### Component Responsibilities

**Legend.vue** (Container)
- Draggable positioning
- Resize handling
- Export mode detection
- Toolbar visibility

**LegendItem.vue** (Row)
- Color picker trigger
- Editable label
- Remove button
- Drag handle (for reordering)

**LegendToolbar.vue** (Floating Controls)
- Color-by dropdown
- Settings toggles
- Appears on hover

### State Management

```javascript
// stores/legend.js
export const useLegendStore = defineStore('legend', () => {
  // Position & size
  const position = ref({ x: 40, y: 40 })
  const size = ref({ width: 200, height: 'auto' })

  // Display settings
  const showLegend = ref(true)
  const textScale = ref(1)
  const dotScale = ref(1)

  // Behavior
  const stickyEdges = ref(true)
  const snapThreshold = ref(20)

  // Items
  const items = ref([
    { id: 1, label: 'Species A', color: '#4ade80', visible: true },
    { id: 2, label: 'Species B', color: '#3b82f6', visible: true }
  ])

  // Actions
  function updateItemColor(id, color) { ... }
  function updateItemLabel(id, label) { ... }
  function removeItem(id) { ... }
  function reorderItems(fromIndex, toIndex) { ... }

  return { position, size, items, /* ... */ }
})
```

---

## Implementation Roadmap

### Phase 1: Foundation (Prerequisites)

1. **Install Tailwind CSS**
   - Add Tailwind v3 to project
   - Configure with existing CSS variables
   - Update vite.config.js

2. **Install shadcn-vue**
   - Run init command
   - Add core components (Popover, Button, Slider, Toggle)
   - Configure path aliases

3. **Install VueUse**
   - Add @vueuse/core
   - Import needed composables

### Phase 2: Legend Refactor

4. **Extract Legend Component**
   - Create `Legend/` directory
   - Move legend from MapEngine.vue
   - Create Pinia store for legend state

5. **Implement Draggable**
   - Add useDraggable
   - Implement sticky edges
   - Add precision mode toggle

6. **Implement Resizable**
   - Add resize handles or CSS resize
   - Implement proportional scaling
   - Add min/max constraints

### Phase 3: Interactive Features

7. **Inline Text Editing**
   - Add vue-contenteditable
   - Style editable state
   - Handle blur/enter

8. **Color Pickers**
   - Install vue-color
   - Create LegendColorPicker component
   - Wire to item colors

9. **Item Management**
   - Add remove button per item
   - Implement reordering (optional)
   - Add "restore defaults" option

### Phase 4: UI/UX Polish

10. **Hover Controls**
    - Create LegendToolbar
    - Show/hide on hover
    - Move settings from sidebar

11. **Export Mode**
    - Hide interactive elements for screenshot
    - Ensure consistent appearance
    - Test with html-to-image

12. **Theming**
    - Add theme toggle
    - Create 2-3 theme presets
    - Persist preference

### Phase 5: Testing & Refinement

13. **Cross-browser testing**
14. **Touch device support**
15. **Accessibility audit**
16. **Performance optimization**

---

## Sources & References

### UI Libraries
- [shadcn-vue Documentation](https://www.shadcn-vue.com/)
- [Reka UI (formerly Radix Vue)](https://reka-ui.com/)
- [PrimeVue](https://primevue.org/)
- [Vuetify](https://vuetifyjs.com/)

### Utilities
- [VueUse - useDraggable](https://vueuse.org/core/usedraggable/)
- [VueUse - useResizeObserver](https://vueuse.org/core/useresizeobserver/)
- [VueUse - useColorMode](https://vueuse.org/core/usecolormode/)

### Color Pickers
- [vue-color (ckpack)](https://github.com/ckpack/vue-color)
- [Vue Color Picker Components](https://www.vuescript.com/best-color-picker/)

### Inline Editing
- [vue-contenteditable](https://github.com/hl037/vue-contenteditable)
- [Vue 3 contenteditable guide](https://dev.to/pyrsmk/how-to-use-the-contenteditable-attribute-in-vue-3-a89)

### CSS Framework
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Tailwind + shadcn Integration](https://ui.shadcn.com/docs/tailwind-v4)

### Vue 3 UI Comparisons
- [Vue 3 UI Libraries for 2025](https://dev.to/vue-pdf-viewer/vue-3-ui-libraries-6-most-popular-picks-for-2025-2m7l)
- [Best Vue Component Libraries](https://uideck.com/blog/best-vue-component-libraries)
- [Vuetify vs Radix Vue](https://medium.com/@dwincahya8/vuetify-vs-radix-vue-a-comparison-of-ui-component-libraries-for-vue-js-fb2df04bcd2d)

---

## Conclusion

Your current Vue 3 + Vite stack is excellent and doesn't need framework migration. The recommended path is:

1. **Add Tailwind CSS** - Enables shadcn-vue and modern utilities
2. **Add shadcn-vue** - Beautiful, accessible, customizable components
3. **Use VueUse** - For drag, resize, and other composables
4. **Add vue-color** - For color picker functionality
5. **Add vue-contenteditable** - For inline text editing

This combination gives you:
- Professional UI out of the box
- Full customization control
- Excellent accessibility
- Active maintenance and community support
- Minimal bundle size impact
- Perfect Vue 3 integration

The legend can be transformed into a fully interactive, customizable component while maintaining clean export appearance and smooth user experience.
