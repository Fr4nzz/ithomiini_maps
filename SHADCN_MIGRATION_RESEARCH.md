# shadcn-vue Migration & UI Optimization Research Report

**Date:** January 2026
**Project:** Ithomiini Maps
**Current Stack:** Vue 3.5.24 + Vite 7.2.4 + Plain CSS + MapLibre GL + Pinia
**Target Stack:** Vue 3 + Vite + shadcn-vue + Tailwind CSS v4 + VueUse

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Codebase Analysis](#current-codebase-analysis)
3. [shadcn-vue Component Library Overview](#shadcn-vue-component-library-overview)
4. [Component Mapping: Current UI to shadcn-vue](#component-mapping-current-ui-to-shadcn-vue)
5. [Theming System Design](#theming-system-design)
6. [tweakcn Integration for Theme Customization](#tweakcn-integration-for-theme-customization)
7. [Code Redundancy Analysis & Optimization Opportunities](#code-redundancy-analysis--optimization-opportunities)
8. [Migration Strategy](#migration-strategy)
9. [Implementation Phases](#implementation-phases)
10. [Sources & References](#sources--references)

---

## Executive Summary

This report provides comprehensive research on migrating the Ithomiini Maps application to **shadcn-vue** with **Tailwind CSS v4**, enabling a unified design system with theme customization capabilities similar to tweakcn.

### Key Findings

| Area | Current State | Recommended Solution |
|------|---------------|---------------------|
| **UI Components** | Custom CSS + vue-multiselect | shadcn-vue (64+ components) |
| **CSS Framework** | Plain CSS with CSS variables | Tailwind CSS v4 |
| **Theming** | Hardcoded dark theme | CSS Variables + Dark Mode Toggle |
| **Theme Customization** | None | tweakcn-inspired theme editor |
| **Form Components** | vue-multiselect + custom | shadcn-vue Select, Combobox, Input |
| **Modals/Dialogs** | Custom Teleport implementation | shadcn-vue Dialog, Sheet |
| **Code Reduction** | ~4000 lines of custom CSS | Estimated 60-70% reduction |

### Benefits of Migration

1. **Unified Design System** - All components share consistent styling
2. **Theme Customization** - Users can customize colors, fonts, radius
3. **Map Export Theming** - Exported maps reflect custom themes
4. **Code Reduction** - Remove ~2500-3000 lines of custom CSS
5. **Accessibility** - shadcn-vue built on Reka UI (WAI-ARIA compliant)
6. **Maintainability** - Component code you own and can modify

---

## Current Codebase Analysis

### Project Structure

```
src/
├── App.vue                     (533 lines - root component)
├── main.js                     (19 lines - entry point)
├── style.css                   (261 lines - global CSS variables)
├── components/
│   ├── Sidebar.vue             (1797 lines - LARGEST, needs refactor)
│   ├── MapEngine.vue           (100+ lines - map integration)
│   ├── DataTable.vue           (808 lines - data grid)
│   ├── FilterSelect.vue        (228 lines - vue-multiselect wrapper)
│   ├── DateFilter.vue          (385 lines - date picker)
│   ├── ExportPanel.vue         (1019 lines - export modal)
│   ├── MimicrySelector.vue     (1218 lines - mimicry filter modal)
│   ├── PointPopup.vue          (921 lines - map popup)
│   ├── SidebarMapSettings.vue  (settings panel)
│   ├── ImageGallery.vue        (image carousel)
│   └── GallerySidebar.vue      (gallery nav)
├── stores/
│   └── data.js                 (1312 lines - Pinia store)
├── composables/                (3 composables)
└── utils/                      (6 utility modules)
```

### Current CSS Approach

The project uses **CSS custom properties** (variables) defined in `style.css`:

```css
:root {
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #252540;
  --color-bg-tertiary: #2d2d4a;
  --color-border: #3d3d5c;
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #aaa;
  --color-text-muted: #666;
  --color-accent: #4ade80;
  --color-danger: #ef4444;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --transition-fast: 150ms;
  --transition-base: 200ms;
  --transition-slow: 300ms;
}
```

**Observation:** This is an excellent foundation that aligns perfectly with shadcn-vue's CSS variable approach.

### Current UI Elements Inventory

| Element Type | Current Implementation | Count | Location |
|--------------|----------------------|-------|----------|
| **Dropdowns/Selects** | vue-multiselect | 10+ | Sidebar, FilterSelect |
| **Buttons** | Custom CSS buttons | 50+ | All components |
| **Modals/Dialogs** | Teleport + custom CSS | 4 | App.vue |
| **Tabs** | Custom CSS tabs | 2 | ExportPanel |
| **Toggles/Switches** | Custom checkboxes | 8 | Sidebar, Settings |
| **Sliders/Range** | Native input[type=range] | 6 | Sidebar |
| **Date Inputs** | Native input[type=date] | 2 | DateFilter |
| **Text Inputs** | Native input[type=text] | 5 | Various |
| **Popovers/Tooltips** | Custom CSS | 3 | PointPopup, Mimicry |
| **Cards/Panels** | Custom CSS | 15+ | All components |
| **Badges/Tags** | Custom CSS | 8 | DataTable, Popup |
| **Pagination** | Custom CSS | 1 | DataTable |
| **Collapsibles** | Custom CSS | 3 | Sidebar |
| **Loading States** | None | 0 | - |

---

## shadcn-vue Component Library Overview

### What is shadcn-vue?

shadcn-vue is a **code distribution platform** - not a traditional component library. Components are copied into your project, giving you full ownership and customization control. It's built on:

- **Reka UI** (Vue port of Radix UI) - Accessible primitives
- **Tailwind CSS** - Utility-first styling
- **Class Variance Authority (CVA)** - Variant management

### Available Components (64 Total)

#### Form Components
| Component | Description | Use Case in Ithomiini |
|-----------|-------------|----------------------|
| **Button** | Clickable button with variants | All buttons throughout app |
| **Button Group** | Grouped buttons | Tab-style selectors |
| **Checkbox** | Toggle checkbox | Filter toggles |
| **Combobox** | Searchable select | Replace vue-multiselect |
| **Field** | Form field wrapper | All form fields |
| **Input** | Text input | Search, CAMID input |
| **Input Group** | Input with icons/buttons | Search with icon |
| **Input OTP** | PIN code input | - |
| **Label** | Form labels | All labels |
| **Native Select** | HTML select | Simple dropdowns |
| **Number Field** | Numeric input | Size inputs |
| **Pin Input** | PIN input | - |
| **Radio Group** | Mutually exclusive options | Sex filter, view toggle |
| **Select** | Styled dropdown | Color-by, aspect ratio |
| **Slider** | Range slider | Point size, opacity |
| **Switch** | Toggle switch | Boolean toggles |
| **Tags Input** | Multiple tag input | Multi-select filters |
| **Textarea** | Multi-line input | - |
| **Toggle** | Pressable button | Toggle clustering |
| **Toggle Group** | Multiple toggles | View mode selection |

#### Overlay Components
| Component | Description | Use Case in Ithomiini |
|-----------|-------------|----------------------|
| **Alert Dialog** | Confirmation dialog | Delete confirmation |
| **Context Menu** | Right-click menu | Legend item options |
| **Dialog** | Modal window | Export, Mimicry, Gallery |
| **Drawer** | Slide-out panel | Mobile sidebar |
| **Dropdown Menu** | Dropdown actions | Settings menus |
| **Hover Card** | Hover tooltip card | Image previews |
| **Popover** | Floating panel | Color pickers, filters |
| **Sheet** | Side panel | Sidebar replacement |
| **Tooltip** | Simple tooltip | Button hints |

#### Display Components
| Component | Description | Use Case in Ithomiini |
|-----------|-------------|----------------------|
| **Accordion** | Collapsible sections | Sidebar filter groups |
| **Alert** | Notification banner | Error/success messages |
| **Avatar** | User/item image | Species thumbnails |
| **Badge** | Small label | Status indicators |
| **Breadcrumb** | Navigation path | - |
| **Calendar** | Date picker | Replace native date input |
| **Card** | Content container | Panels, sections |
| **Carousel** | Image slider | Image gallery |
| **Chart** | Data visualization | - |
| **Collapsible** | Expandable section | Filter groups |
| **Data Table** | Structured data | Replace custom table |
| **Date Picker** | Calendar date select | Date filter |
| **Empty** | Empty state display | No results |
| **Item** | List item | Legend items |
| **Kbd** | Keyboard key | Shortcuts |
| **Pagination** | Page navigation | Table pagination |
| **Progress** | Progress bar | Export progress |
| **Range Calendar** | Date range | Date range filter |
| **Scroll Area** | Custom scrollbar | Long lists |
| **Separator** | Visual divider | Section separators |
| **Skeleton** | Loading placeholder | Loading states |
| **Spinner** | Loading indicator | Export in progress |
| **Stepper** | Step process | - |
| **Table** | Data table structure | Data display |
| **Tabs** | Tab navigation | Export panel tabs |

#### Layout Components
| Component | Description | Use Case in Ithomiini |
|-----------|-------------|----------------------|
| **Aspect Ratio** | Fixed ratio container | Image containers |
| **Menubar** | Menu bar | - |
| **Navigation Menu** | Nav structure | - |
| **Resizable** | Resizable panels | Legend, sidebar |
| **Sidebar** | App sidebar | Main sidebar |

#### Utility Components
| Component | Description | Use Case in Ithomiini |
|-----------|-------------|----------------------|
| **Sonner** | Toast notifications | Success/error toasts |
| **Toast** | Temporary notification | Feedback messages |
| **Typography** | Text styling | Consistent text |

---

## Component Mapping: Current UI to shadcn-vue

### High Priority Replacements

| Current Element | Location | shadcn-vue Component | Benefit |
|-----------------|----------|---------------------|---------|
| `vue-multiselect` | FilterSelect.vue | **Combobox** | Native Vue, better a11y, consistent styling |
| Custom buttons (50+) | All files | **Button** | Variant system, consistent states |
| Custom modal | App.vue | **Dialog** | Accessibility, animations |
| Native date input | DateFilter.vue | **Date Picker + Calendar** | Better UX, consistent styling |
| Custom tabs | ExportPanel | **Tabs** | Keyboard navigation, a11y |
| Native checkbox | Sidebar | **Checkbox** / **Switch** | Better styling, a11y |
| Native range input | Sidebar | **Slider** | Better UX, labels |
| Custom pagination | DataTable | **Pagination** | Consistent, accessible |
| Native select | Various | **Select** | Consistent styling |

### Medium Priority Replacements

| Current Element | Location | shadcn-vue Component | Benefit |
|-----------------|----------|---------------------|---------|
| Collapsible sections | Sidebar | **Accordion** / **Collapsible** | Smooth animations |
| Card-like containers | All | **Card** | Consistent layout |
| Status badges | DataTable, Popup | **Badge** | Consistent variants |
| Loading states (none) | N/A | **Skeleton** / **Spinner** | Better UX |
| Success/error feedback | ExportPanel | **Sonner** (Toast) | Professional feedback |
| Section dividers | Various | **Separator** | Semantic |

### Component-by-Component Migration Map

#### Sidebar.vue (1797 lines) - MAJOR REFACTOR

```
Current Implementation          →  shadcn-vue Replacement
─────────────────────────────────────────────────────────
Custom sidebar container        →  <Sidebar> component
Filter group collapsibles       →  <Accordion> or <Collapsible>
vue-multiselect wrappers        →  <Combobox> for searchable
                                   <Select> for simple dropdowns
Native checkboxes               →  <Checkbox> or <Switch>
Range sliders (point size, etc) →  <Slider>
Button variants                 →  <Button variant="...">
Toggle buttons                  →  <Toggle> or <ToggleGroup>
Section headers                 →  <Typography> + <Separator>
```

**Estimated line reduction:** 1797 → ~600 lines (65% reduction)

#### ExportPanel.vue (1019 lines)

```
Current Implementation          →  shadcn-vue Replacement
─────────────────────────────────────────────────────────
Custom modal container          →  <Dialog>
Tab navigation                  →  <Tabs>
Export buttons                  →  <Button>
Format selection                →  <ToggleGroup>
DPI selection                   →  <ToggleGroup> or <RadioGroup>
Success toast                   →  <Sonner> (Toast)
Copy button                     →  <Button> + toast feedback
Progress indicator              →  <Progress> or <Spinner>
```

**Estimated line reduction:** 1019 → ~400 lines (60% reduction)

#### FilterSelect.vue (228 lines)

```
Current Implementation          →  shadcn-vue Replacement
─────────────────────────────────────────────────────────
vue-multiselect wrapper         →  <Combobox> for multi-select
                                   <Select> for single-select
Custom styling (150+ lines)     →  Tailwind utilities (10 lines)
```

**Estimated line reduction:** 228 → ~50 lines (78% reduction)

#### DateFilter.vue (385 lines)

```
Current Implementation          →  shadcn-vue Replacement
─────────────────────────────────────────────────────────
Native date inputs              →  <DatePicker> with <Calendar>
Quick range buttons             →  <ToggleGroup>
Date range display              →  <Badge> or custom
Clear button                    →  <Button variant="ghost">
```

**Estimated line reduction:** 385 → ~150 lines (61% reduction)

#### MimicrySelector.vue (1218 lines)

```
Current Implementation          →  shadcn-vue Replacement
─────────────────────────────────────────────────────────
Modal container                 →  <Dialog> or <Sheet>
Dropdown filter                 →  <Combobox>
Selection tags                  →  <Badge> with close button
Grid cards                      →  <Card> components
Navigation buttons              →  <Button>
Footer actions                  →  <Button> variants
```

**Estimated line reduction:** 1218 → ~500 lines (59% reduction)

#### DataTable.vue (808 lines)

```
Current Implementation          →  shadcn-vue Replacement
─────────────────────────────────────────────────────────
Custom table                    →  <DataTable> with TanStack
Column settings dropdown        →  <DropdownMenu>
Page size select                →  <Select>
Pagination                      →  <Pagination>
Checkboxes                      →  <Checkbox>
Status badges                   →  <Badge>
```

**Estimated line reduction:** 808 → ~300 lines (63% reduction)

#### PointPopup.vue (921 lines)

```
Current Implementation          →  shadcn-vue Replacement
─────────────────────────────────────────────────────────
Popup container                 →  <Card>
Species/subspecies dropdowns    →  <Select>
Status badges                   →  <Badge>
Photo container                 →  <AspectRatio>
External link                   →  <Button variant="link">
```

**Estimated line reduction:** 921 → ~400 lines (57% reduction)

---

## Theming System Design

### shadcn-vue CSS Variables

shadcn-vue uses a comprehensive CSS variable system that aligns perfectly with your existing approach:

```css
:root {
  /* Backgrounds */
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0 0);

  /* Card/Panel */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0 0);

  /* Popover */
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0 0);

  /* Interactive */
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.965 0 0);
  --secondary-foreground: oklch(0.205 0 0);

  /* States */
  --muted: oklch(0.965 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.965 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);

  /* UI Elements */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Radius */
  --radius: 0.625rem;

  /* Charts */
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);

  /* Sidebar */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.141 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.965 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.141 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... dark mode values */
}
```

### Mapping Current Variables to shadcn-vue

| Current Variable | shadcn-vue Variable | Notes |
|------------------|---------------------|-------|
| `--color-bg-primary` | `--background` | Main background |
| `--color-bg-secondary` | `--card` | Card/panel background |
| `--color-bg-tertiary` | `--secondary` | Tertiary elements |
| `--color-border` | `--border` | Border color |
| `--color-text-primary` | `--foreground` | Main text |
| `--color-text-secondary` | `--muted-foreground` | Secondary text |
| `--color-text-muted` | `--muted-foreground` | Muted text |
| `--color-accent` | `--primary` | Accent/interactive |
| `--color-danger` | `--destructive` | Error/danger |
| `--radius-sm/md/lg/xl` | `--radius` | Border radius |

### Dark Mode Implementation

Using VueUse's `useColorMode`:

```vue
<script setup>
import { useColorMode } from '@vueuse/core'

const mode = useColorMode({
  attribute: 'class',
  modes: {
    light: 'light',
    dark: 'dark'
  }
})
</script>

<template>
  <Switch v-model="mode" />
</template>
```

---

## tweakcn Integration for Theme Customization

### What is tweakcn?

[tweakcn](https://tweakcn.com/) is a visual no-code theme editor for shadcn/ui that allows customization of:

- **Colors** (background, foreground, primary, secondary, etc.)
- **Typography** (font families, sizes)
- **Spacing** (border radius, gaps)
- **Shadows** (color, opacity, blur, spread)
- **Both light and dark modes independently**

### Implementing tweakcn-style Customization

While tweakcn itself is designed for React/shadcn-ui, we can implement similar functionality for shadcn-vue:

#### Option 1: Direct CSS Variable Manipulation

Create a theme customizer component that modifies CSS variables:

```vue
<!-- components/ThemeCustomizer.vue -->
<script setup>
import { ref, watch } from 'vue'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

const themeSettings = ref({
  // Colors
  primary: '#4ade80',
  background: '#1a1a2e',
  foreground: '#e0e0e0',
  accent: '#4ade80',

  // Typography
  fontFamily: 'Inter',

  // Sizing
  radius: 8,

  // Shadows
  shadowOpacity: 0.4
})

watch(themeSettings, (newVal) => {
  // Apply to CSS variables
  document.documentElement.style.setProperty('--primary', newVal.primary)
  document.documentElement.style.setProperty('--background', newVal.background)
  document.documentElement.style.setProperty('--radius', `${newVal.radius}px`)
  // ... etc
}, { deep: true })
</script>
```

#### Option 2: Preset Themes

Define preset themes that users can switch between:

```js
// themes/presets.js
export const themes = {
  default: {
    name: 'Default Dark',
    colors: {
      background: 'oklch(0.12 0.02 280)',
      foreground: 'oklch(0.93 0.01 280)',
      primary: 'oklch(0.72 0.19 160)', // Green accent
      card: 'oklch(0.16 0.02 280)',
      border: 'oklch(0.28 0.02 280)',
    }
  },
  scientific: {
    name: 'Scientific Blue',
    colors: {
      background: 'oklch(0.14 0.02 250)',
      foreground: 'oklch(0.95 0.01 250)',
      primary: 'oklch(0.65 0.18 250)', // Blue accent
      card: 'oklch(0.18 0.02 250)',
      border: 'oklch(0.30 0.02 250)',
    }
  },
  nature: {
    name: 'Nature Green',
    colors: {
      background: 'oklch(0.13 0.03 140)',
      foreground: 'oklch(0.94 0.02 140)',
      primary: 'oklch(0.68 0.16 140)', // Forest green
      card: 'oklch(0.17 0.03 140)',
      border: 'oklch(0.28 0.03 140)',
    }
  },
  ocean: {
    name: 'Ocean Deep',
    colors: {
      background: 'oklch(0.12 0.04 230)',
      foreground: 'oklch(0.95 0.01 230)',
      primary: 'oklch(0.60 0.15 200)', // Teal accent
      card: 'oklch(0.16 0.04 230)',
      border: 'oklch(0.26 0.04 230)',
    }
  },
  sunset: {
    name: 'Sunset Warm',
    colors: {
      background: 'oklch(0.14 0.02 30)',
      foreground: 'oklch(0.94 0.01 30)',
      primary: 'oklch(0.70 0.18 50)', // Orange accent
      card: 'oklch(0.18 0.02 30)',
      border: 'oklch(0.30 0.02 30)',
    }
  },
  light: {
    name: 'Light Mode',
    colors: {
      background: 'oklch(0.98 0.01 250)',
      foreground: 'oklch(0.20 0.02 250)',
      primary: 'oklch(0.55 0.18 160)',
      card: 'oklch(1.0 0 0)',
      border: 'oklch(0.90 0.01 250)',
    }
  }
}
```

### Theme Customization Features to Implement

Based on tweakcn's capabilities, here are the **most useful for map export**:

| Feature | Impact on Map Export | Priority |
|---------|---------------------|----------|
| **Primary Color** | Legend dots, highlights | High |
| **Background Color** | Legend background | High |
| **Text Color** | Legend labels | High |
| **Border Radius** | Legend, buttons shape | Medium |
| **Font Family** | Legend text appearance | Medium |
| **Border Color** | Legend border | Medium |
| **Shadow** | Legend drop shadow | Low |
| **Chart Colors** | Point colors on map | High |

### Simplified Theme Editor UI

```vue
<!-- components/ThemeEditor.vue -->
<template>
  <Sheet>
    <SheetTrigger as-child>
      <Button variant="outline" size="icon">
        <Palette class="h-4 w-4" />
      </Button>
    </SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Theme Customization</SheetTitle>
        <SheetDescription>
          Customize colors and styling. Changes affect map exports.
        </SheetDescription>
      </SheetHeader>

      <!-- Preset Themes -->
      <div class="grid grid-cols-3 gap-2 mb-6">
        <Button
          v-for="(theme, key) in themes"
          :key="key"
          :variant="currentTheme === key ? 'default' : 'outline'"
          @click="applyTheme(key)"
        >
          {{ theme.name }}
        </Button>
      </div>

      <Separator />

      <!-- Custom Colors -->
      <div class="space-y-4 mt-4">
        <div class="space-y-2">
          <Label>Primary Color</Label>
          <div class="flex gap-2">
            <div
              class="w-10 h-10 rounded border cursor-pointer"
              :style="{ background: customColors.primary }"
              @click="showColorPicker('primary')"
            />
            <Input v-model="customColors.primary" />
          </div>
        </div>

        <div class="space-y-2">
          <Label>Border Radius</Label>
          <Slider
            v-model="customRadius"
            :min="0"
            :max="20"
            :step="1"
          />
          <span class="text-sm text-muted-foreground">{{ customRadius }}px</span>
        </div>

        <div class="space-y-2">
          <Label>Font</Label>
          <Select v-model="customFont">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inter">Inter</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="roboto">Roboto</SelectItem>
              <SelectItem value="poppins">Poppins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SheetFooter class="mt-6">
        <Button variant="outline" @click="resetTheme">Reset</Button>
        <Button @click="saveTheme">Save Theme</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
```

---

## Code Redundancy Analysis & Optimization Opportunities

### 1. Sidebar.vue Decomposition

**Problem:** Sidebar.vue is 1797 lines - too large and handles too many concerns.

**Solution:** Split into focused sub-components:

```
components/
└── Sidebar/
    ├── Sidebar.vue              (100 lines - container)
    ├── SidebarHeader.vue        (50 lines - logo, collapse)
    ├── SidebarFilters.vue       (200 lines - filter controls)
    ├── SidebarTaxonomy.vue      (150 lines - family/genus/species)
    ├── SidebarQuickFilters.vue  (100 lines - status, source, sex)
    ├── SidebarMapSettings.vue   (existing, 150 lines)
    ├── SidebarExportSettings.vue(100 lines - aspect ratio, DPI)
    └── SidebarActions.vue       (80 lines - buttons)
```

**Estimated reduction:** 1797 → 930 lines (48% reduction through better organization)

### 2. Duplicate Button Styles

**Problem:** Button styles are repeated across 8+ components with slight variations.

**Current pattern (repeated):**
```css
.btn-primary {
  padding: 10px 16px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 6px;
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
```

**Solution:** Use shadcn-vue Button with variants:
```vue
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

**Estimated reduction:** ~300 lines of duplicate button CSS removed

### 3. Duplicate Modal/Dialog Patterns

**Problem:** Similar modal patterns in ExportPanel, MimicrySelector, ImageGallery.

**Current pattern (repeated):**
```css
.modal-container {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: var(--color-bg-secondary);
  border-radius: 12px;
  /* ... more styles */
}
```

**Solution:** Use shadcn-vue Dialog:
```vue
<Dialog v-model:open="isOpen">
  <DialogTrigger as-child>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <!-- Content -->
    <DialogFooter>
      <Button @click="isOpen = false">Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Estimated reduction:** ~400 lines of duplicate modal CSS removed

### 4. Duplicate Form Field Patterns

**Problem:** Label + input patterns repeated with slight variations.

**Solution:** Use shadcn-vue Field component:
```vue
<Field name="species">
  <FieldLabel>Species</FieldLabel>
  <Combobox v-model="selectedSpecies" :options="speciesOptions" />
  <FieldMessage />
</Field>
```

### 5. Color Constants Consolidation

**Problem:** Status colors defined in multiple places:
- `constants.js` - STATUS_COLORS object
- `style.css` - CSS variables
- Inline in components

**Solution:** Single source of truth:
```js
// constants.js
export const STATUS_COLORS = {
  'Sequenced': 'oklch(0.65 0.15 250)', // Blue
  'Tissue Available': 'oklch(0.68 0.16 160)', // Green
  'Preserved Specimen': 'oklch(0.72 0.15 80)', // Orange
  // ...
}

// Generate CSS variables from constants
export function generateStatusCSSVars() {
  return Object.entries(STATUS_COLORS)
    .map(([status, color]) => `--status-${kebabCase(status)}: ${color};`)
    .join('\n')
}
```

### 6. SVG Icon Duplication

**Problem:** Inline SVG icons repeated across components.

**Solution:** Use Lucide Vue icons (recommended by shadcn-vue):
```bash
npm install lucide-vue-next
```

```vue
<script setup>
import { X, ChevronDown, Search, Calendar } from 'lucide-vue-next'
</script>

<template>
  <Button>
    <Search class="h-4 w-4 mr-2" />
    Search
  </Button>
</template>
```

**Estimated reduction:** ~200 lines of inline SVG removed

### Overall Code Reduction Summary

| Area | Current Lines | After Migration | Reduction |
|------|---------------|-----------------|-----------|
| Sidebar.vue | 1797 | 600 | 67% |
| ExportPanel.vue | 1019 | 400 | 61% |
| MimicrySelector.vue | 1218 | 500 | 59% |
| DataTable.vue | 808 | 300 | 63% |
| PointPopup.vue | 921 | 400 | 57% |
| FilterSelect.vue | 228 | 50 | 78% |
| DateFilter.vue | 385 | 150 | 61% |
| style.css (global) | 261 | 100 | 62% |
| **Total Component CSS** | **~4000** | **~1500** | **62%** |

---

## Migration Strategy

### Prerequisites

1. **Install Tailwind CSS v4**
```bash
pnpm add tailwindcss @tailwindcss/vite
```

2. **Update vite.config.js**
```js
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

3. **Create src/index.css**
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Your theme variables using OKLCH */
  --background: oklch(0.12 0.02 280);
  --foreground: oklch(0.93 0.01 280);
  --primary: oklch(0.72 0.19 160);
  /* ... rest of variables */
}

.dark {
  --background: oklch(0.12 0.02 280);
  /* ... dark mode values */
}
```

4. **Initialize shadcn-vue**
```bash
pnpm dlx shadcn-vue@latest init
```

5. **Install VueUse**
```bash
pnpm add @vueuse/core
```

6. **Install Lucide Icons**
```bash
pnpm add lucide-vue-next
```

### Migration Order

**Phase 1: Foundation (No Breaking Changes)**
1. Install Tailwind CSS alongside existing CSS
2. Initialize shadcn-vue
3. Add utility components (Button, Badge, Separator)
4. Both systems coexist

**Phase 2: Form Components**
5. Replace vue-multiselect with Combobox
6. Add Select, Slider, Switch components
7. Update FilterSelect, DateFilter

**Phase 3: Overlay Components**
8. Replace custom modals with Dialog
9. Add Sheet for mobile sidebar
10. Update ExportPanel, MimicrySelector

**Phase 4: Layout & Data**
11. Refactor Sidebar into sub-components
12. Update DataTable with shadcn-vue Table
13. Add Accordion for filter groups

**Phase 5: Theme System**
14. Implement theme customizer
15. Add preset themes
16. Connect to map export

**Phase 6: Cleanup**
17. Remove vue-multiselect dependency
18. Remove unused custom CSS
19. Final testing

---

## Implementation Phases

### Phase 1: Foundation Setup

**Files to create/modify:**
- `vite.config.ts` - Add Tailwind plugin, path alias
- `src/index.css` - Tailwind imports, CSS variables
- `tsconfig.json` / `tsconfig.app.json` - Path aliases
- `components.json` - shadcn-vue configuration

**Components to add:**
```bash
pnpm dlx shadcn-vue@latest add button badge separator card
```

**Duration:** 1-2 hours

### Phase 2: Form Components Migration

**Components to add:**
```bash
pnpm dlx shadcn-vue@latest add select combobox slider switch checkbox input label field
```

**Files to update:**
- `FilterSelect.vue` → Rewrite using Combobox
- `DateFilter.vue` → Add Calendar, DatePicker
- `Sidebar.vue` → Replace inputs with shadcn components

**Duration:** 4-6 hours

### Phase 3: Overlay Components

**Components to add:**
```bash
pnpm dlx shadcn-vue@latest add dialog sheet popover dropdown-menu tooltip
```

**Files to update:**
- `App.vue` → Replace Teleport modals with Dialog
- `ExportPanel.vue` → Wrap in Dialog
- `MimicrySelector.vue` → Wrap in Dialog

**Duration:** 4-6 hours

### Phase 4: Layout Refactoring

**Components to add:**
```bash
pnpm dlx shadcn-vue@latest add accordion collapsible tabs table pagination scroll-area
```

**Files to create:**
```
components/
└── Sidebar/
    ├── Sidebar.vue
    ├── SidebarHeader.vue
    ├── SidebarFilters.vue
    ├── SidebarTaxonomy.vue
    └── SidebarActions.vue
```

**Duration:** 6-8 hours

### Phase 5: Theme System

**Components to add:**
```bash
pnpm dlx shadcn-vue@latest add sonner toggle-group
```

**Files to create:**
- `stores/theme.js` - Theme state management
- `themes/presets.js` - Preset theme definitions
- `components/ThemeCustomizer.vue` - Theme editor UI
- `composables/useTheme.js` - Theme composable

**Duration:** 4-6 hours

### Phase 6: Cleanup & Testing

**Tasks:**
1. Remove `vue-multiselect` from package.json
2. Delete unused CSS from `style.css`
3. Remove unused scoped CSS from components
4. Run build and fix any errors
5. Test all functionality
6. Test map export with different themes

**Duration:** 2-4 hours

### Total Estimated Duration

| Phase | Hours |
|-------|-------|
| Phase 1: Foundation | 1-2 |
| Phase 2: Form Components | 4-6 |
| Phase 3: Overlay Components | 4-6 |
| Phase 4: Layout Refactoring | 6-8 |
| Phase 5: Theme System | 4-6 |
| Phase 6: Cleanup & Testing | 2-4 |
| **Total** | **21-32 hours** |

---

## Sources & References

### shadcn-vue
- [shadcn-vue Documentation](https://www.shadcn-vue.com/)
- [shadcn-vue Components](https://www.shadcn-vue.com/docs/components)
- [shadcn-vue Theming](https://www.shadcn-vue.com/docs/theming)
- [shadcn-vue Dark Mode](https://www.shadcn-vue.com/docs/dark-mode)
- [shadcn-vue Tailwind v4 Guide](https://www.shadcn-vue.com/docs/tailwind-v4)
- [shadcn-vue Vite Installation](https://www.shadcn-vue.com/docs/installation/vite)
- [GitHub - unovue/shadcn-vue](https://github.com/unovue/shadcn-vue)

### tweakcn Theme Editor
- [tweakcn Official Site](https://tweakcn.com/)
- [tweakcn Theme Generator](https://tweakcn.com/editor/theme)
- [GitHub - jnsahaj/tweakcn](https://github.com/jnsahaj/tweakcn)

### Tailwind CSS
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Tailwind v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)

### Vue Ecosystem
- [VueUse Documentation](https://vueuse.org/)
- [Reka UI (Radix Vue)](https://reka-ui.com/)
- [Lucide Vue Icons](https://lucide.dev/guide/packages/lucide-vue-next)

### Design Resources
- [OKLCH Color Format](https://oklch.com/)
- [shadcn Theme Generator](https://shadcn-ui-theme-generator.vercel.app/)

---

## Conclusion

This migration to shadcn-vue with Tailwind CSS v4 will provide:

1. **~60% code reduction** in custom CSS
2. **Unified design system** across all components
3. **Accessible components** out of the box
4. **Theme customization** for users and map exports
5. **Better maintainability** with component ownership
6. **Modern tooling** with Tailwind v4 and OKLCH colors

The migration can be done incrementally, allowing both systems to coexist during transition. Start with Phase 1 (Foundation) to validate the setup before proceeding with component replacements.

### Next Steps

1. Create a new branch for migration work
2. Complete Phase 1 (Foundation Setup)
3. Validate build works with both CSS systems
4. Proceed with Phase 2 (Form Components)
5. Continue iteratively through remaining phases

The investment in this migration will significantly improve developer experience, user customization options, and the overall polish of the application.
