# Vue to React + shadcn/ui + tweakcn Migration PRD

**Project:** Ithomiini Maps
**Goal:** Migrate from Vue 3 to React + Vite + shadcn/ui + Tailwind, implement real-time theme customization with tweakcn presets

---

## ⚠️ CRITICAL: Verify Plan Against Documentation

**Before implementing ANY step, the AI agent MUST:**
1. Verify commands and APIs against official documentation
2. Check if package versions or APIs have changed
3. Confirm shadcn/ui installation steps at https://ui.shadcn.com/docs/installation/vite
4. Verify tweakcn theme URLs at https://tweakcn.com/r/themes
5. Check react-map-gl docs for MapLibre integration
6. **If documentation differs from this plan, follow the documentation**

**When encountering UI/styling issues (ugly UI, missing paddings, broken layouts):**
- **STOP and review official documentation FIRST** before attempting fixes
- AI tends to hallucinate shadcn/ui solutions that are not documentation-grounded
- Check shadcn/ui component docs for correct usage, props, and CSS classes
- Check Tailwind CSS docs for correct utility classes
- Do NOT guess at fixes - verify the correct approach in docs first
- This prevents wasted iterations on incorrect solutions

---

## Background

This app was built with Vue 3 + Vite. We attempted shadcn-vue but it caused styling issues. The solution is to migrate to **React** which has first-class shadcn/ui support plus **tweakcn** compatibility for theme customization.

### Current Stack (Vue - to be replaced)
- Vue 3.5 + Vite 7 + Plain CSS + Pinia + MapLibre GL
- Dependencies: vue-multiselect, vue-color, vue-contenteditable

### Target Stack (React)
- React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui + Zustand + react-map-gl
- tweakcn preset themes for customization

---

## Phase 1: Research & Setup

### 1.1 Codebase Analysis
- Read and understand ALL files in `src/` directory
- Document every Vue component and its purpose
- List all third-party dependencies and find React equivalents
- Identify MapLibre GL integration patterns for React

### 1.2 Vue to React Conversion Patterns

| Vue Pattern | React Equivalent |
|-------------|------------------|
| `<script setup>` | Function component |
| `ref()`, `reactive()` | `useState()` |
| `computed()` | `useMemo()` |
| `watch()`, `watchEffect()` | `useEffect()` |
| `onMounted()` | `useEffect(() => {}, [])` |
| `onUnmounted()` | `useEffect` cleanup function |
| `defineProps()` | Function parameters with TypeScript interface |
| `defineEmits()` | Callback props (`onChange`, `onClick`) |
| `v-model` | `value` + `onChange` controlled pattern |
| `v-if` / `v-else` | Ternary `? :` or `&&` |
| `v-for` | `.map()` |
| `v-show` | Conditional style display |
| `v-bind:class` | `className` with `cn()` utility |
| `<slot>` | `children` prop |
| `<Teleport>` | `createPortal()` |
| Pinia store | Zustand store |
| `provide/inject` | React Context |

### 1.3 Online Documentation to Research
- shadcn/ui Vite installation: https://ui.shadcn.com/docs/installation/vite
- shadcn/ui theming: https://ui.shadcn.com/docs/theming
- tweakcn themes registry: https://tweakcn.com/r/themes
- react-map-gl + MapLibre: https://visgl.github.io/react-map-gl
- Zustand docs: https://zustand.docs.pmnd.rs

---

## Phase 2: Project Scaffolding

### 2.1 Create React + Vite Project
- Back up existing data files (public/, *.xlsx, etc.) to a temp location
- Run: `pnpm create vite@latest . --template react-ts`
- Restore data files
- Configure path aliases (`@/` prefix) in tsconfig.json and vite.config.ts

### 2.2 Install Tailwind CSS v4
- Run: `pnpm add tailwindcss @tailwindcss/vite`
- Configure vite.config.ts with tailwindcss plugin and path aliases

### 2.3 Initialize shadcn/ui
- Run: `pnpm dlx shadcn@latest init`
- Select: Default style, Neutral base color, CSS variables enabled, No RSC (for Vite)

### 2.4 Install shadcn/ui Components
Add these components: button, card, dialog, sheet, popover, dropdown-menu, tabs, accordion, select, combobox, slider, switch, checkbox, badge, table, pagination, scroll-area, tooltip, separator, calendar, sidebar, input, label

### 2.5 Install tweakcn Preset Themes
Install pre-built themes from tweakcn registry (verify URLs exist before running):
- cyberpunk theme
- claude theme
- catppuccin theme

Check https://tweakcn.com/r/themes for available themes. If URLs fail, skip and create custom themes manually.

### 2.6 Install Additional Dependencies
- **State management:** zustand, immer
- **Mapping:** react-map-gl, maplibre-gl
- **Icons:** lucide-react
- **Utilities:** date-fns, html-to-image, jszip, tinycolor2, clsx, tailwind-merge
- **Drag and drop:** @dnd-kit/core, @dnd-kit/sortable

---

## Phase 3: Component Migration

### 3.1 Component Migration Map

| Vue Component | React Component | shadcn/ui Components to Use |
|---------------|-----------------|----------------------------|
| `App.vue` (346 lines) | `App.tsx` | Layout structure |
| `Sidebar.vue` (1797 lines) | `Sidebar.tsx` + sub-components | Sidebar, Accordion, Select, Switch, Slider |
| `MapEngine.vue` (~500 lines) | `MapEngine.tsx` | Uses react-map-gl |
| `DataTable.vue` (808 lines) | `DataTable.tsx` | Table, Pagination, Badge |
| `FilterSelect.vue` (228 lines) | `FilterSelect.tsx` | Combobox |
| `DateFilter.vue` (385 lines) | `DateFilter.tsx` | Calendar, Popover, Button |
| `ExportPanel.vue` (1019 lines) | `ExportPanel.tsx` | Dialog, Tabs, Button |
| `MimicrySelector.vue` (1218 lines) | `MimicrySelector.tsx` | Dialog, Card, Badge, Checkbox |
| `PointPopup.vue` (921 lines) | `PointPopup.tsx` | Card, Badge |

### 3.2 New Components to Create

**Legend Components:**
- `Legend.tsx` - Main container with drag support using @dnd-kit
- `LegendItem.tsx` - Individual legend entry with editable label
- `LegendColorPicker.tsx` - Color picker using Popover
- `LegendToolbar.tsx` - Hover controls using DropdownMenu

**Theme Components:**
- `ThemeEditor.tsx` - Theme customization panel using Sheet, Slider, color inputs

### 3.3 State Management Migration (Pinia → Zustand)

Create Zustand stores with persist middleware:
- **data.ts** - Main data store for features, filters, loading state
- **legend.ts** - Legend customization (position, colors, labels, visibility)
- **theme.ts** - Theme settings (current theme, dark mode, custom colors, radius)

The theme store should apply CSS variables to document.documentElement on changes and rehydrate on app load.

### 3.4 MapEngine with react-map-gl

Use react-map-gl with MapLibre backend:
- Declarative Map component with controlled viewState
- Source and Layer components for GeoJSON data
- Popup component for point details
- NavigationControl for zoom/pan

Map styles: Use CartoDB dark-matter and positron basemaps.

### 3.5 Legend Component Features

- Draggable positioning using @dnd-kit
- Sticky edges (snap to container edges, toggleable)
- Resizable with proportional content scaling
- Inline editable labels (click to edit)
- Color picker for each item (click dot to change)
- Hover controls (visible on hover, hidden in export)
- Remove/hide individual items

---

## Phase 4: Theme System Implementation

### 4.1 Theme Presets

Configure preset themes including:
- Default Dark (current app style)
- Cyberpunk (from tweakcn)
- Claude (from tweakcn)
- Catppuccin (from tweakcn)
- Scientific Blue (custom)
- Nature Green (custom)

### 4.2 Theme Editor in Sidebar

Add a "Themes" section with:
- Theme preset dropdown
- Dark/Light mode toggle
- Color pickers for: primary, accent, background
- Border radius slider (0-20px)
- Save custom theme button
- Reset to default button

### 4.3 Real-time Theme Application

Themes update in real-time by:
1. Changing CSS class on `<html>` element for preset themes
2. Updating CSS variables via JavaScript for custom colors
3. shadcn components automatically respond to variable changes
4. Map legend and exports reflect theme changes

---

## File Structure

### Target React Structure
```
src/
├── App.tsx
├── main.tsx
├── index.css
├── components/
│   ├── ui/                      # shadcn/ui (auto-generated)
│   ├── map/
│   │   ├── MapEngine.tsx
│   │   └── Legend/
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   └── ThemeEditor.tsx
│   ├── data/
│   │   └── DataTable.tsx
│   ├── filters/
│   └── dialogs/
├── stores/
│   ├── data.ts
│   ├── legend.ts
│   └── theme.ts
├── hooks/
├── lib/
├── themes/
│   └── presets.ts
└── types/
```

---

## Success Criteria

### Must Have
- Full React + Vite + shadcn/ui migration complete
- All original features work identically
- Theme customization panel in sidebar
- At least 5 preset themes (including tweakcn themes)
- Real-time theme switching
- Dark/Light mode toggle
- UI quality matches or exceeds original
- Legend is customizable (drag, resize, edit labels, change colors)
- Exports work with theme applied

### Nice to Have
- Custom theme creation and saving
- More tweakcn preset themes
- Full TypeScript coverage

---

## Important Notes

1. **Verify documentation before implementing** - APIs may have changed
2. **Visual quality is critical** - UI must not look worse
3. **Iterate until correct** - Fix issues before moving on
4. **Preserve data files** - Excel, GeoJSON, credentials untouched

---

## Reference Documentation

- shadcn/ui: https://ui.shadcn.com/docs
- shadcn/ui Vite: https://ui.shadcn.com/docs/installation/vite
- shadcn/ui Theming: https://ui.shadcn.com/docs/theming
- tweakcn: https://tweakcn.com
- tweakcn Themes: https://tweakcn.com/r/themes
- Tailwind CSS v4: https://tailwindcss.com/docs
- Zustand: https://zustand.docs.pmnd.rs
- react-map-gl: https://visgl.github.io/react-map-gl
- @dnd-kit: https://dndkit.com
- html-to-image: https://github.com/bubkoo/html-to-image
