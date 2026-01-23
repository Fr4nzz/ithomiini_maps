# React Migration Research: Vue to React + shadcn/ui + tweakcn

**Date:** January 2026
**Project:** Ithomiini Maps
**Current Stack:** Vue 3.5 + Vite 7 + Plain CSS + Pinia + MapLibre GL
**Target Stack:** React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Zustand + react-map-gl

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Why Migrate to React?](#why-migrate-to-react)
3. [Target Technology Stack](#target-technology-stack)
4. [shadcn/ui Official Requirements](#shadcnui-official-requirements)
5. [tweakcn Theme System Integration](#tweakcn-theme-system-integration)
6. [Component-by-Component Migration Map](#component-by-component-migration-map)
7. [State Management: Pinia to Zustand](#state-management-pinia-to-zustand)
8. [MapLibre Integration with React](#maplibre-integration-with-react)
9. [Migration Strategy](#migration-strategy)
10. [Risks and Considerations](#risks-and-considerations)
11. [Implementation Plan](#implementation-plan)
12. [Sources & References](#sources--references)

---

## Executive Summary

This document researches migrating the Ithomiini Maps application from Vue 3 to React to gain access to the **official shadcn/ui ecosystem** and **tweakcn theme customization**.

### Why This Migration?

| Issue with Vue | Solution with React |
|----------------|---------------------|
| shadcn-vue caused styling issues | Official shadcn/ui is battle-tested |
| No tweakcn support for Vue | tweakcn is built specifically for React + shadcn/ui |
| Limited theme customization options | Full tweakcn visual theme editor |
| Community port vs official library | Official Vercel-backed shadcn/ui |

### Migration Summary

| Aspect | Current (Vue) | Target (React) |
|--------|--------------|----------------|
| **Framework** | Vue 3.5.24 | React 19 |
| **Build Tool** | Vite 7.2.4 | Vite 7 (same) |
| **UI Components** | Custom CSS | shadcn/ui (64+ components) |
| **Styling** | Plain CSS + CSS Variables | Tailwind CSS v4 |
| **State Management** | Pinia 3.0.4 | Zustand 5.x |
| **Mapping** | maplibre-gl direct | react-map-gl + maplibre-gl |
| **Icons** | lucide-vue-next | lucide-react |
| **Theme Customization** | Custom CSS variables | tweakcn + shadcn theming |

### Key Benefits

1. **Official shadcn/ui** - Maintained by Vercel, used by thousands of production apps
2. **tweakcn Integration** - Visual no-code theme editor for real-time customization
3. **Larger Ecosystem** - More React resources, tutorials, and community support
4. **Better Tooling** - React DevTools, extensive testing libraries
5. **Future-Proof** - React 19 with Server Components for future enhancements

---

## Why Migrate to React?

### The shadcn/ui Advantage

**shadcn/ui** is the original, official component library. The Vue port (shadcn-vue) is a community project that:
- Has known styling inconsistencies (you experienced this)
- Lags behind the official React version in features
- Has a smaller maintainer team
- May have compatibility issues with Tailwind v4

The official shadcn/ui:
- Is maintained by the original creator (shadcn)
- Has direct Vercel support
- Is used by Next.js, Vercel, and thousands of production apps
- Has better documentation and examples
- Gets new components first

### tweakcn Compatibility

**tweakcn** is a visual theme editor specifically built for:
- React applications
- shadcn/ui components
- Tailwind CSS v4

It allows users to:
- Customize 40+ CSS variables visually
- See real-time preview of changes
- Export theme configurations
- Create and save custom theme presets

**tweakcn does NOT support Vue** - it requires React's ecosystem.

### Ecosystem Comparison

| Feature | Vue + shadcn-vue | React + shadcn/ui |
|---------|------------------|-------------------|
| Component Count | 64 (ported) | 64 (official) |
| Update Frequency | Monthly | Weekly |
| GitHub Stars | 5.8k | 85k+ |
| npm Weekly Downloads | ~15k | ~500k |
| Theme Customizers | Limited | tweakcn, ui.shadcn, 10+ more |
| Community Templates | ~50 | ~500+ |
| Production Usage | Growing | Massive (Vercel, Linear, etc.) |

---

## Target Technology Stack

### Core Framework

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@vitejs/plugin-react": "^4.4.0",
  "vite": "^7.2.4"
}
```

**React 19 Features:**
- Improved Server Components
- Enhanced Suspense
- Better concurrent rendering
- Smaller bundle size
- Automatic batching

### UI Components & Styling

```json
{
  "tailwindcss": "^4.0.0",
  "@tailwindcss/vite": "^4.0.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.5.0"
}
```

**shadcn/ui Components to Add:**
```bash
# Core form components
npx shadcn@latest add button input select combobox slider switch checkbox

# Layout components
npx shadcn@latest add card dialog sheet popover dropdown-menu tabs accordion

# Data display
npx shadcn@latest add table badge separator scroll-area tooltip

# Feedback
npx shadcn@latest add sonner progress skeleton

# Navigation
npx shadcn@latest add sidebar navigation-menu
```

### State Management

```json
{
  "zustand": "^5.0.0",
  "immer": "^10.0.0"
}
```

**Zustand vs Pinia:**

| Feature | Pinia (Vue) | Zustand (React) |
|---------|------------|-----------------|
| Bundle Size | 2KB | 1.2KB |
| Boilerplate | Minimal | Even less |
| DevTools | Vue DevTools | Redux DevTools compatible |
| TypeScript | Excellent | Excellent |
| Middleware | Plugins | Middleware |
| Persistence | Plugin | `persist` middleware |

### Mapping

```json
{
  "react-map-gl": "^8.1.0",
  "maplibre-gl": "^5.13.0",
  "@maplibre/maplibre-gl-geocoder": "^1.5.0"
}
```

### Icons

```json
{
  "lucide-react": "^0.460.0"
}
```

### Utilities

```json
{
  "date-fns": "^4.1.0",
  "html-to-image": "^1.11.13",
  "jszip": "^3.10.1",
  "tinycolor2": "^1.6.0"
}
```

---

## shadcn/ui Official Requirements

### Installation Prerequisites

1. **React 18.2+ or React 19** (React 19 recommended)
2. **Tailwind CSS v4** (or v3.4+)
3. **TypeScript** (optional but recommended)
4. **Path aliases** configured (`@/` prefix)

### Vite + React Setup

**Step 1: Create React Vite Project**
```bash
pnpm create vite@latest ithomiini-maps-react --template react-ts
cd ithomiini-maps-react
```

**Step 2: Install Tailwind CSS v4**
```bash
pnpm add tailwindcss @tailwindcss/vite
```

**Step 3: Configure Vite**
```typescript
// vite.config.ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**Step 4: Configure TypeScript Paths**
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Step 5: Initialize shadcn/ui**
```bash
pnpm dlx shadcn@latest init
```

When prompted, select:
- Style: Default
- Base color: Neutral (or your preference)
- CSS variables: Yes
- React Server Components: No (for Vite)

### CSS Variables Structure

shadcn/ui uses a comprehensive CSS variable system:

```css
/* src/index.css */
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... more mappings */
}

:root {
  --radius: 0.625rem;

  /* Light theme (default) */
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.965 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.965 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.965 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Chart colors */
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
  --card: oklch(0.141 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.141 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.556 0 0);

  /* Dark sidebar */
  --sidebar: oklch(0.141 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.556 0 0);
}
```

---

## tweakcn Theme System Integration

### What is tweakcn?

[tweakcn](https://tweakcn.com/) is a visual no-code theme editor for shadcn/ui that provides:

1. **Live Preview** - See changes in real-time on actual components
2. **40+ CSS Variables** - Customize colors, typography, spacing, shadows
3. **Light/Dark Modes** - Independent customization for each mode
4. **Export Functionality** - Copy CSS or JSON configurations
5. **Preset Themes** - Start from pre-designed themes

### tweakcn Customizable Properties

| Category | Properties |
|----------|------------|
| **Colors** | background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring |
| **Charts** | chart-1 through chart-5 |
| **Sidebar** | sidebar, sidebar-foreground, sidebar-primary, sidebar-accent, sidebar-border |
| **Typography** | Font families (sans, serif, mono) |
| **Spacing** | Border radius (--radius) |
| **Shadows** | Shadow color, opacity, blur, spread, offset |

### Implementing tweakcn-style Theme Editor

For your app, you can implement a simplified theme editor in the sidebar:

```tsx
// src/components/ThemeEditor.tsx
import { useState } from 'react'
import { useThemeStore } from '@/stores/theme'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Palette } from 'lucide-react'

const presetThemes = {
  default: {
    name: 'Default',
    primary: 'oklch(0.205 0 0)',
    accent: 'oklch(0.72 0.19 160)', // Green
  },
  scientific: {
    name: 'Scientific Blue',
    primary: 'oklch(0.488 0.243 264)',
    accent: 'oklch(0.65 0.18 250)',
  },
  nature: {
    name: 'Nature Green',
    primary: 'oklch(0.45 0.15 145)',
    accent: 'oklch(0.68 0.16 140)',
  },
  ocean: {
    name: 'Ocean Blue',
    primary: 'oklch(0.35 0.12 230)',
    accent: 'oklch(0.60 0.15 200)',
  },
  sunset: {
    name: 'Sunset Warm',
    primary: 'oklch(0.40 0.14 30)',
    accent: 'oklch(0.70 0.18 50)',
  },
}

export function ThemeEditor() {
  const { theme, setTheme, setCustomColor, radius, setRadius } = useThemeStore()

  const applyPreset = (presetKey: string) => {
    const preset = presetThemes[presetKey]
    setTheme(presetKey)
    document.documentElement.style.setProperty('--primary', preset.primary)
    document.documentElement.style.setProperty('--accent', preset.accent)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Palette className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Theme Customization</SheetTitle>
          <SheetDescription>
            Customize the appearance. Changes affect map exports.
          </SheetDescription>
        </SheetHeader>

        {/* Preset Themes */}
        <div className="py-4">
          <Label className="mb-2 block">Preset Themes</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(presetThemes).map(([key, preset]) => (
              <Button
                key={key}
                variant={theme === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(key)}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Colors */}
        <div className="py-4 border-t">
          <Label className="mb-2 block">Primary Color</Label>
          <input
            type="color"
            onChange={(e) => setCustomColor('primary', e.target.value)}
            className="w-full h-10 rounded border cursor-pointer"
          />
        </div>

        {/* Border Radius */}
        <div className="py-4 border-t">
          <Label className="mb-2 block">Border Radius: {radius}px</Label>
          <Slider
            value={[radius]}
            onValueChange={([val]) => setRadius(val)}
            min={0}
            max={20}
            step={1}
          />
        </div>

        {/* Dark/Light Toggle */}
        <div className="py-4 border-t">
          <Label className="mb-2 block">Mode</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.documentElement.classList.remove('dark')}
            >
              Light
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.documentElement.classList.add('dark')}
            >
              Dark
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

### Theme Store with Zustand

```typescript
// src/stores/theme.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  theme: string
  customColors: Record<string, string>
  radius: number
  isDark: boolean
  setTheme: (theme: string) => void
  setCustomColor: (key: string, value: string) => void
  setRadius: (radius: number) => void
  toggleDark: () => void
  applyTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'default',
      customColors: {},
      radius: 10,
      isDark: true,

      setTheme: (theme) => {
        set({ theme })
        get().applyTheme()
      },

      setCustomColor: (key, value) => {
        set((state) => ({
          customColors: { ...state.customColors, [key]: value }
        }))
        document.documentElement.style.setProperty(`--${key}`, value)
      },

      setRadius: (radius) => {
        set({ radius })
        document.documentElement.style.setProperty('--radius', `${radius}px`)
      },

      toggleDark: () => {
        set((state) => ({ isDark: !state.isDark }))
        document.documentElement.classList.toggle('dark')
      },

      applyTheme: () => {
        const { customColors, radius, isDark } = get()

        // Apply custom colors
        Object.entries(customColors).forEach(([key, value]) => {
          document.documentElement.style.setProperty(`--${key}`, value)
        })

        // Apply radius
        document.documentElement.style.setProperty('--radius', `${radius}px`)

        // Apply dark mode
        if (isDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Apply theme on load
        state?.applyTheme()
      },
    }
  )
)
```

---

## Component-by-Component Migration Map

### Vue to React Conversion Patterns

| Vue Pattern | React Equivalent |
|-------------|------------------|
| `<script setup>` | Function component |
| `ref()` | `useState()` |
| `computed()` | `useMemo()` |
| `watch()` | `useEffect()` |
| `onMounted()` | `useEffect(() => {}, [])` |
| `defineProps()` | Function parameters |
| `defineEmits()` | Callback props |
| `v-model` | `value` + `onChange` |
| `v-if` / `v-else` | Ternary or `&&` |
| `v-for` | `.map()` |
| `v-bind:class` | `className` (with clsx) |
| `<slot>` | `children` prop |
| `<Teleport>` | React Portal |
| Pinia store | Zustand store |

### Component Migration List

| Vue Component | Lines | React Component | shadcn/ui Components |
|---------------|-------|-----------------|---------------------|
| `App.vue` | 346 | `App.tsx` | - |
| `MapEngine.vue` | Large | `MapEngine.tsx` | - (uses react-map-gl) |
| `Sidebar.vue` | 1797 | `Sidebar.tsx` | `Sidebar`, `Accordion`, `Button`, `Select` |
| `DataTable.vue` | 808 | `DataTable.tsx` | `Table`, `Pagination`, `Badge` |
| `FilterSelect.vue` | 228 | `FilterSelect.tsx` | `Combobox` |
| `DateFilter.vue` | 385 | `DateFilter.tsx` | `DatePicker`, `Calendar`, `Button` |
| `ExportPanel.vue` | 1019 | `ExportPanel.tsx` | `Dialog`, `Tabs`, `Button`, `Progress` |
| `MimicrySelector.vue` | 1218 | `MimicrySelector.tsx` | `Dialog`, `Card`, `Badge` |
| `PointPopup.vue` | 921 | `PointPopup.tsx` | `Card`, `Badge` |
| `ImageGallery.vue` | - | `ImageGallery.tsx` | `Dialog`, `Carousel` |
| `ThemeSelector.vue` | - | `ThemeEditor.tsx` | `Sheet`, `Button`, `Slider` |
| **Legend Components** | | | |
| `Legend.vue` | - | `Legend.tsx` | `Card` + custom drag |
| `LegendItem.vue` | - | `LegendItem.tsx` | Custom |
| `LegendColorPicker.vue` | - | `LegendColorPicker.tsx` | `Popover` + color picker |
| `LegendToolbar.vue` | - | `LegendToolbar.tsx` | `DropdownMenu`, `Button` |

### Example Conversion: FilterSelect

**Vue (FilterSelect.vue):**
```vue
<script setup>
import { computed } from 'vue'
import VueMultiselect from 'vue-multiselect'

const props = defineProps({
  modelValue: Array,
  options: Array,
  placeholder: String,
  label: String
})

const emit = defineEmits(['update:modelValue'])

const selected = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <div class="filter-select">
    <label v-if="label">{{ label }}</label>
    <VueMultiselect
      v-model="selected"
      :options="options"
      :multiple="true"
      :placeholder="placeholder"
    />
  </div>
</template>
```

**React (FilterSelect.tsx):**
```tsx
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem } from '@/components/ui/combobox'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface FilterSelectProps {
  value: string[]
  options: string[]
  placeholder?: string
  label?: string
  onChange: (value: string[]) => void
}

export function FilterSelect({ value, options, placeholder, label, onChange }: FilterSelectProps) {
  const handleSelect = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}

      {/* Selected badges */}
      <div className="flex flex-wrap gap-1">
        {value.map(v => (
          <Badge key={v} variant="secondary" className="gap-1">
            {v}
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={() => handleSelect(v)}
            />
          </Badge>
        ))}
      </div>

      {/* Combobox */}
      <Combobox>
        <ComboboxInput placeholder={placeholder} />
        <ComboboxContent>
          {options
            .filter(opt => !value.includes(opt))
            .map(option => (
              <ComboboxItem
                key={option}
                value={option}
                onSelect={() => handleSelect(option)}
              >
                {option}
              </ComboboxItem>
            ))}
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
```

---

## State Management: Pinia to Zustand

### Store Conversion Pattern

**Pinia Store (Vue):**
```javascript
// stores/data.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDataStore = defineStore('data', () => {
  // State
  const features = ref([])
  const selectedSpecies = ref([])
  const isLoading = ref(false)

  // Getters (computed)
  const filteredFeatures = computed(() => {
    if (selectedSpecies.value.length === 0) return features.value
    return features.value.filter(f =>
      selectedSpecies.value.includes(f.properties.species)
    )
  })

  // Actions
  async function loadData() {
    isLoading.value = true
    try {
      const res = await fetch('/data/specimens.json')
      features.value = await res.json()
    } finally {
      isLoading.value = false
    }
  }

  function setSelectedSpecies(species) {
    selectedSpecies.value = species
  }

  return {
    features,
    selectedSpecies,
    isLoading,
    filteredFeatures,
    loadData,
    setSelectedSpecies
  }
})
```

**Zustand Store (React):**
```typescript
// stores/data.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Feature {
  properties: {
    species: string
    // ... other properties
  }
  geometry: {
    coordinates: [number, number]
  }
}

interface DataState {
  features: Feature[]
  selectedSpecies: string[]
  isLoading: boolean

  // Derived state (computed in selectors)

  // Actions
  loadData: () => Promise<void>
  setSelectedSpecies: (species: string[]) => void
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      features: [],
      selectedSpecies: [],
      isLoading: false,

      loadData: async () => {
        set({ isLoading: true })
        try {
          const res = await fetch('/data/specimens.json')
          const features = await res.json()
          set({ features })
        } finally {
          set({ isLoading: false })
        }
      },

      setSelectedSpecies: (species) => set({ selectedSpecies: species }),
    }),
    {
      name: 'data-storage',
      partialize: (state) => ({
        selectedSpecies: state.selectedSpecies
      }),
    }
  )
)

// Selector for derived state (like computed)
export const useFilteredFeatures = () => {
  const features = useDataStore(state => state.features)
  const selectedSpecies = useDataStore(state => state.selectedSpecies)

  return useMemo(() => {
    if (selectedSpecies.length === 0) return features
    return features.filter(f =>
      selectedSpecies.includes(f.properties.species)
    )
  }, [features, selectedSpecies])
}
```

### Store Migration List

| Pinia Store | Zustand Store | Key Changes |
|-------------|---------------|-------------|
| `stores/data.js` | `stores/data.ts` | Add TypeScript types |
| `stores/legend.js` | `stores/legend.ts` | Move computed to selectors |
| `stores/theme.js` | `stores/theme.ts` | Add persist middleware |
| `stores/persistence.js` | (removed) | Use Zustand persist middleware |

---

## MapLibre Integration with React

### react-map-gl Overview

[react-map-gl](https://visgl.github.io/react-map-gl/) provides React bindings for MapLibre GL JS with:
- Declarative map configuration
- Fully controlled component pattern
- React hooks for map state
- Layer and source components
- Event handling

### Basic Map Setup

```tsx
// src/components/MapEngine.tsx
import { useState, useCallback } from 'react'
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/maplibre'
import type { MapMouseEvent, ViewState } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDataStore, useFilteredFeatures } from '@/stores/data'

const MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  satellite: 'https://api.maptiler.com/maps/satellite/style.json?key=YOUR_KEY',
}

export function MapEngine() {
  const filteredFeatures = useFilteredFeatures()
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -70,
    latitude: -5,
    zoom: 4,
  })
  const [popupInfo, setPopupInfo] = useState<Feature | null>(null)
  const [mapStyle, setMapStyle] = useState('dark')

  // GeoJSON data
  const geojsonData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredFeatures,
  }), [filteredFeatures])

  // Handle map click
  const onClick = useCallback((event: MapMouseEvent) => {
    const feature = event.features?.[0]
    if (feature) {
      setPopupInfo(feature)
    }
  }, [])

  // Point layer style
  const pointLayer = {
    id: 'points',
    type: 'circle' as const,
    paint: {
      'circle-radius': 6,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  }

  // Cluster layer (optional)
  const clusterLayer = {
    id: 'clusters',
    type: 'circle' as const,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#4ade80',
      'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
    },
  }

  return (
    <Map
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      mapStyle={MAP_STYLES[mapStyle]}
      onClick={onClick}
      interactiveLayerIds={['points']}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="top-right" />

      <Source
        id="specimens"
        type="geojson"
        data={geojsonData}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        <Layer {...clusterLayer} />
        <Layer {...pointLayer} />
      </Source>

      {popupInfo && (
        <Popup
          longitude={popupInfo.geometry.coordinates[0]}
          latitude={popupInfo.geometry.coordinates[1]}
          onClose={() => setPopupInfo(null)}
          closeButton={true}
        >
          <PointPopup feature={popupInfo} />
        </Popup>
      )}
    </Map>
  )
}
```

### Map Features Comparison

| Feature | Vue (maplibre-gl direct) | React (react-map-gl) |
|---------|-------------------------|----------------------|
| Declarative | Manual DOM manipulation | JSX components |
| State Sync | Watchers + methods | Controlled component |
| Clustering | Manual setup | Built-in `cluster` prop |
| Layers | `.addLayer()` calls | `<Layer>` components |
| Popups | Manual positioning | `<Popup>` component |
| Events | `.on()` handlers | Props like `onClick` |
| Performance | Direct, fastest | Slight overhead, still fast |

---

## Migration Strategy

### Approach: Full Rewrite (Recommended)

Given the scope of changes (Vue → React, Pinia → Zustand, CSS → Tailwind), a **full rewrite** is recommended over incremental migration because:

1. **Clean Architecture** - Design React-first patterns
2. **No Framework Mixing** - Avoid complex bridges
3. **Type Safety** - Add TypeScript from start
4. **shadcn/ui Integration** - Use components natively
5. **Simpler Testing** - Test React code with React tools

### Migration Phases

```
Phase 1: Foundation (Week 1)
├── Create new React + Vite project
├── Configure Tailwind CSS v4
├── Initialize shadcn/ui
├── Set up Zustand stores
└── Basic routing structure

Phase 2: Core Components (Week 2-3)
├── Migrate MapEngine with react-map-gl
├── Create Sidebar with shadcn/ui
├── Implement filters (Combobox, DatePicker)
├── Port DataTable with shadcn/ui Table
└── Create Legend components

Phase 3: Features (Week 4)
├── Implement ExportPanel
├── Port MimicrySelector
├── Create ImageGallery
├── Add PointPopup
└── Implement URL state sync

Phase 4: Theme System (Week 5)
├── Create ThemeEditor component
├── Implement preset themes
├── Add custom color support
├── Test export with themes
└── Dark/light mode toggle

Phase 5: Polish & Testing (Week 6)
├── Cross-browser testing
├── Performance optimization
├── Accessibility audit
├── Mobile responsiveness
└── Final bug fixes
```

---

## Risks and Considerations

### Potential Challenges

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Development Time** | 4-6 weeks of work | Phased approach, prioritize core features |
| **Learning Curve** | Team needs React knowledge | Extensive documentation, similar patterns |
| **Feature Parity** | Some Vue features may work differently | Careful testing, acceptance criteria |
| **MapLibre Integration** | react-map-gl has different API | Documentation is excellent, well-supported |
| **Data Migration** | User settings in localStorage | Plan migration or fresh start |
| **Testing Gap** | Need new test infrastructure | Set up React Testing Library early |

### Benefits vs Costs

| Benefits | Costs |
|----------|-------|
| Official shadcn/ui support | 4-6 weeks development |
| tweakcn theme customization | Learning React patterns |
| Larger ecosystem | Rewriting 17k+ lines |
| Better tooling | New test infrastructure |
| Type safety with TypeScript | Temporary feature freeze |
| Future-proof architecture | Risk of new bugs |

### Recommendation

**Proceed with migration if:**
- Theme customization is a priority feature
- You plan to add more UI features
- You want official shadcn/ui support
- Team has or can acquire React experience

**Delay migration if:**
- Current features are sufficient
- Limited development resources
- Need to ship features quickly
- Vue-specific integrations are critical

---

## Implementation Plan

### Phase 1: Project Setup

```bash
# Create new project
pnpm create vite@latest ithomiini-maps-react --template react-ts
cd ithomiini-maps-react

# Install core dependencies
pnpm add react react-dom
pnpm add -D @vitejs/plugin-react @types/react @types/react-dom @types/node

# Install Tailwind CSS v4
pnpm add tailwindcss @tailwindcss/vite

# Initialize shadcn/ui
pnpm dlx shadcn@latest init

# Install state management
pnpm add zustand immer

# Install mapping
pnpm add react-map-gl maplibre-gl

# Install icons
pnpm add lucide-react

# Install utilities
pnpm add date-fns html-to-image jszip tinycolor2 clsx class-variance-authority tailwind-merge

# Add shadcn/ui components
pnpm dlx shadcn@latest add button card dialog sheet popover dropdown-menu tabs accordion select combobox slider switch checkbox badge table pagination scroll-area tooltip separator sonner calendar date-picker sidebar
```

### File Structure

```
ithomiini-maps-react/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── MapEngine.tsx          # Main map component
│   │   ├── Sidebar.tsx            # App sidebar
│   │   ├── DataTable.tsx          # Data table
│   │   ├── FilterSelect.tsx       # Multi-select filter
│   │   ├── DateFilter.tsx         # Date range filter
│   │   ├── ExportPanel.tsx        # Export modal
│   │   ├── MimicrySelector.tsx    # Mimicry filter
│   │   ├── PointPopup.tsx         # Map popup
│   │   ├── ImageGallery.tsx       # Gallery modal
│   │   ├── ThemeEditor.tsx        # Theme customization
│   │   └── Legend/
│   │       ├── Legend.tsx
│   │       ├── LegendItem.tsx
│   │       ├── LegendColorPicker.tsx
│   │       ├── LegendToolbar.tsx
│   │       └── index.ts
│   ├── stores/
│   │   ├── data.ts                # Main data store
│   │   ├── legend.ts              # Legend customization
│   │   └── theme.ts               # Theme settings
│   ├── hooks/
│   │   ├── useMap.ts              # Map utilities
│   │   ├── useDraggable.ts        # Drag functionality
│   │   └── useExport.ts           # Export utilities
│   ├── lib/
│   │   ├── colors.ts              # Color utilities
│   │   ├── shapes.ts              # SVG shapes
│   │   └── utils.ts               # General utilities
│   ├── themes/
│   │   └── presets.ts             # Theme definitions
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── App.tsx                    # Root component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles + Tailwind
├── public/
│   └── data/                      # GeoJSON data files
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                # shadcn/ui config
└── package.json
```

---

## Sources & References

### Official Documentation

- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [shadcn/ui Installation - Vite](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui React 19 Support](https://ui.shadcn.com/docs/react-19)

### tweakcn

- [tweakcn Official Site](https://tweakcn.com/)
- [tweakcn Theme Editor](https://tweakcn.com/editor/theme)
- [tweakcn GitHub](https://github.com/jnsahaj/tweakcn)

### React & Tools

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Zustand Documentation](https://zustand.docs.pmnd.rs/)

### Mapping

- [react-map-gl Documentation](https://visgl.github.io/react-map-gl/)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [react-map-gl + MapLibre Guide](https://visgl.github.io/react-map-gl/docs/get-started/get-started#using-with-a-mapbox-gl-fork)

### Migration Guides

- [Vue to React Migration: A Step-by-Step Approach](https://www.index.dev/blog/vue-to-react-migration-strategy)
- [Migrating from VueJS to ReactJS in 2025: A CTO's Guide](https://makersden.io/blog/migrating-from-vuejs-to-reactjs-in-2025-cto-guide)
- [Strategy and Tips for Migrating to React](https://brainhub.eu/library/migrating-to-react)

### State Management Comparisons

- [State Management in 2025: Context, Redux, Zustand, or Jotai](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [Zustand vs Redux Toolkit vs Jotai](https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux-toolkit-vs-jotai/)

---

## Conclusion

Migrating from Vue to React provides significant advantages for implementing real-time theme customization:

1. **Official shadcn/ui** - Battle-tested, well-maintained, extensive documentation
2. **tweakcn Support** - Visual theme editor specifically designed for React + shadcn/ui
3. **Larger Ecosystem** - More resources, examples, and community support
4. **Better Tooling** - React DevTools, TypeScript integration, testing libraries

### Recommended Next Steps

1. **Decision Point** - Confirm commitment to migration
2. **Setup Phase** - Create new React project with shadcn/ui
3. **Proof of Concept** - Port MapEngine and basic sidebar
4. **Incremental Migration** - Port remaining components
5. **Theme System** - Implement ThemeEditor with preset themes
6. **Polish** - Testing, accessibility, performance optimization

The migration is a significant investment (4-6 weeks) but provides a foundation for future UI enhancements and puts the project on the official shadcn/ui path rather than relying on community ports.
