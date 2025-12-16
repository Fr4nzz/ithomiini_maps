# Ithomiini Maps — React + Vite + shadcn/ui Migration Plan

This document is the **single source of truth** for rebuilding Ithomiini Maps as a React + Vite application using shadcn/ui.

---

## 🤖 Instructions for AI Assistant

**Before starting, read these companion documents:**
- `DOCS_REACT_VITE_SHADCN.md` — Setup and configuration details
- `EQUIVALENTS_VUE_TO_REACT.md` — Library choices and patterns

**Key workflow:**
1. You're working on the `react/rebuild` branch
2. Reference Vue code using `git show claude/refactor-shadcn-ui-HT92U:path/to/file`
3. Follow this plan step-by-step, completing each checkpoint before moving on
4. Use layout primitives (Stack, Panel, Section) — no scattered padding/margin
5. Check this document frequently to stay on track

**Vue branch reference commands:**
```bash
# View a specific file
git show claude/refactor-shadcn-ui-HT92U:src/components/Sidebar.vue

# List directory contents
git ls-tree --name-only claude/refactor-shadcn-ui-HT92U:src/components/

# View the Vue store
git show claude/refactor-shadcn-ui-HT92U:src/stores/data.js
```

---

## Project Configuration

| Setting | Value |
|---------|-------|
| Style | mira (dense interface) |
| Component Library | Base UI (fallback: Radix) |
| Base Color | gray |
| Theme | lime |
| Icon Library | Hugeicons |
| Template | Vite |

**Preset URL:**
```
https://ui.shadcn.com/create?style=mira&base=base&baseColor=gray&theme=lime&iconLibrary=hugeicons&template=vite
```

---

## Hard Constraints

1. **Keep existing Python pipeline** (`scripts/`) — do not modify
2. **Do not copy generated data files** — regenerate by running scripts
3. **Deploy to GitHub Pages** at: `https://fr4nzz.github.io/ithomiini_maps/`
4. **Preserve all features** from Vue reference branch
5. **Use layout primitives** — no scattered padding/margin, promote reusability

---

## 0) Workspace Setup

### For Claude Code Web / Cloud Environments (Recommended)

Claude Code web clones the repo into a container. Use a **single clone** approach with `git show` to reference Vue files:

```bash
# You're already in the cloned repo on main branch
# Create and switch to the new React branch
git checkout -b react/rebuild

# Fetch all branches to access the Vue reference
git fetch --all
```

**To read Vue reference files without switching branches:**
```bash
# Read any file from the Vue branch:
git show claude/refactor-shadcn-ui-HT92U:src/components/Sidebar.vue
git show claude/refactor-shadcn-ui-HT92U:src/stores/data.js
git show claude/refactor-shadcn-ui-HT92U:src/components/MapEngine.vue

# List files in a directory on Vue branch:
git ls-tree --name-only claude/refactor-shadcn-ui-HT92U:src/components/
```

This approach lets you:
- Work on `react/rebuild` branch
- Reference Vue code anytime with `git show`
- No branch switching, no risk of committing to wrong branch

### For Local Development (Alternative)

#### Option A: Git Worktrees

```bash
mkdir -p ~/dev/ithomiini_maps-work
cd ~/dev/ithomiini_maps-work
git clone https://github.com/Fr4nzz/ithomiini_maps.git repo
cd repo

# Create worktree for Vue reference branch
git fetch --all
git worktree add ../ref-vue claude/refactor-shadcn-ui-HT92U

# Create worktree for new React branch
git worktree add -b react/rebuild ../new-react origin/main
```

#### Option B: Two Separate Clones

```bash
mkdir -p ~/dev/ithomiini_maps-work
cd ~/dev/ithomiini_maps-work

# Reference (Vue)
git clone https://github.com/Fr4nzz/ithomiini_maps.git ref-vue
cd ref-vue
git checkout claude/refactor-shadcn-ui-HT92U
cd ..

# New (React)
git clone https://github.com/Fr4nzz/ithomiini_maps.git new-react
cd new-react
git checkout -b react/rebuild
```

---

## 1) Project Scaffolding

### Step 1.1: Prepare Directory

You're working in the repo root on the `react/rebuild` branch. Keep only:
- `.github/workflows/` (will update later)
- `scripts/gbif_download_api.py`
- `scripts/process_data.py`
- `scripts/requirements.txt`
- `gbif_credentials.env` (template only, no secrets)
- `src/assets/Map_icon.svg`
- `src/assets/Mimicry_bttn.svg`
- `REFACTORING_PLAN_REACT.md`, `DOCS_REACT_VITE_SHADCN.md`, `EQUIVALENTS_VUE_TO_REACT.md` (keep these!)

Delete everything else (we'll regenerate via Vite + shadcn).

```bash
# Backup files to keep
mkdir -p ../temp-backup/src/assets ../temp-backup/.github/workflows ../temp-backup/scripts
cp src/assets/Map_icon.svg src/assets/Mimicry_bttn.svg ../temp-backup/src/assets/
cp -r .github/workflows/* ../temp-backup/.github/workflows/
cp scripts/gbif_download_api.py scripts/process_data.py scripts/requirements.txt ../temp-backup/scripts/
cp gbif_credentials.env ../temp-backup/
cp *.md ../temp-backup/

# Remove Vue files (keep .git!)
rm -rf src public node_modules .vscode
rm -f *.js *.json *.html *.xlsx index.html package-lock.json

# Restore backups after Vite scaffolding (Step 1.2)
```

### Step 1.2: Scaffold Vite + React + TypeScript

**Note:** The `shadcn create` command has issues on Windows. Use the manual 2-step approach:

**Step 1: Create Vite project**
```bash
# Make sure directory is empty (except .git)
npm create vite@latest . -- --template react-ts
npm install
```

**Step 2: Install Tailwind CSS v4**
```bash
npm install tailwindcss @tailwindcss/vite
```

**Step 3: Configure Vite** (`vite.config.ts`):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 4: Configure TypeScript path aliases**

Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Add to `tsconfig.app.json` (inside `compilerOptions`):
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

**Step 5: Update CSS** (`src/index.css`):
```css
@import "tailwindcss";
```

**Step 6: Initialize shadcn**
```bash
npx shadcn@latest init
```

When prompted, select:
- Style: **mira**
- Base color: **gray**  
- CSS variables: **yes**
- Base library: **Base UI** (or Radix if Base UI has issues)

**Step 7: Set lime theme**

After init, update the CSS variables in `src/index.css` to use lime theme colors (shadcn will have generated base variables).

**Step 8: Restore backed-up files**
```bash
cp -r ../temp-backup/src/assets/* src/assets/
cp -r ../temp-backup/.github/workflows/* .github/workflows/
mkdir -p scripts
cp ../temp-backup/scripts/* scripts/
cp ../temp-backup/gbif_credentials.env .
cp ../temp-backup/*.md .
```

### Step 1.3: Install Core Dependencies

```bash
npm install

# State management
npm install zustand

# Data fetching
npm install @tanstack/react-query

# URL state
npm install nuqs

# Map
npm install maplibre-gl
npm install @nazka/map-gl-js-spiderfy

# Table
npm install @tanstack/react-table @tanstack/react-virtual

# Search
npm install @leeoniya/ufuzzy

# Schema validation
npm install zod

# Gallery
npm install react-zoom-pan-pinch

# Export
npm install html-to-image

# Dev dependencies
npm install -D @types/maplibre-gl
```

### Step 1.4: Verify Dev Server

```bash
npm run dev
```

**✅ Checkpoint A — Must Pass:**
- [ ] App boots locally at `http://localhost:5173`
- [ ] Tailwind styles apply (check button styling)
- [ ] shadcn components render (add a test Button)
- [ ] Dark mode toggle works
- [ ] No TypeScript errors

---

## 2) Configure Vite for Production

### Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'child_process'

export default defineConfig({
  base: '/ithomiini_maps/',
  
  plugins: [react(), tailwindcss()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(
      process.env.GITHUB_SHA ||
      (() => {
        try {
          return execSync('git rev-parse --short HEAD').toString().trim()
        } catch {
          return 'dev'
        }
      })()
    ),
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          map: ['maplibre-gl'],
          table: ['@tanstack/react-table', '@tanstack/react-virtual'],
        },
      },
    },
  },
})
```

### Add TypeScript declarations (`src/vite-env.d.ts`):

```typescript
/// <reference types="vite/client" />

declare const __BUILD_TIME__: string
declare const __COMMIT_HASH__: string
```

### Ensure both tsconfig files have path aliases:

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**`tsconfig.app.json`:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 3) GitHub Pages Deployment

### Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [react/rebuild, main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          GITHUB_SHA: ${{ github.sha }}
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**✅ Checkpoint B — Must Pass:**
- [ ] `npm run build` produces `dist/` without errors
- [ ] Push to branch triggers GitHub Action
- [ ] Deployed site loads at `https://fr4nzz.github.io/ithomiini_maps/`
- [ ] Assets (JS, CSS) load correctly (check Network tab)

---

## 4) Port Non-Frontend Assets

### Copy Python pipeline and workflows

The backup should already have these from Step 1.1. If not, get them from the Vue branch:

```bash
# View files from Vue branch
git show claude/refactor-shadcn-ui-HT92U:scripts/gbif_download_api.py > scripts/gbif_download_api.py
git show claude/refactor-shadcn-ui-HT92U:scripts/process_data.py > scripts/process_data.py
git show claude/refactor-shadcn-ui-HT92U:scripts/requirements.txt > scripts/requirements.txt
git show claude/refactor-shadcn-ui-HT92U:gbif_credentials.env > gbif_credentials.env

# Copy workflow files
mkdir -p .github/workflows
git show claude/refactor-shadcn-ui-HT92U:.github/workflows/update_data.yml > .github/workflows/update_data.yml
```

### Update `.gitignore`:

```gitignore
# Dependencies
node_modules/

# Build
dist/

# Generated data (regenerate via scripts)
public/data/

# Secrets
.env
.env.local
gbif_credentials.env
!gbif_credentials.env.template

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

### Regenerate data:

```bash
cd new-react
pip install -r scripts/requirements.txt
# Set up gbif_credentials.env with your credentials
python scripts/gbif_download_api.py
python scripts/process_data.py
```

---

## 5) Target Architecture

### Folder Structure

```
src/
├── app/
│   ├── App.tsx                 # Main app component
│   ├── AppShell.tsx            # Layout wrapper
│   └── providers/
│       ├── QueryProvider.tsx   # TanStack Query
│       ├── ThemeProvider.tsx   # Dark mode
│       └── NuqsProvider.tsx    # URL state
│
├── shared/
│   ├── ui/                     # shadcn components (generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── sheet.tsx
│   │   └── ...
│   │
│   ├── layout/                 # YOUR layout primitives
│   │   ├── Panel.tsx
│   │   ├── PanelHeader.tsx
│   │   ├── Section.tsx
│   │   ├── Stack.tsx
│   │   ├── Cluster.tsx
│   │   └── Toolbar.tsx
│   │
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   └── useMediaQuery.ts
│   │
│   └── lib/
│       ├── cn.ts               # shadcn class merger
│       ├── imageProxy.ts       # Image URL proxy
│       └── export/
│           ├── exportCsv.ts
│           ├── exportGeojson.ts
│           └── exportMapImage.ts
│
├── features/
│   ├── data/
│   │   ├── types.ts            # Record, FilterState types
│   │   ├── store.ts            # Zustand store
│   │   ├── selectors.ts        # Derived state
│   │   ├── loadRecords.ts      # Data fetching
│   │   └── schema.ts           # Zod schemas
│   │
│   ├── map/
│   │   ├── MapView.tsx         # Main map component
│   │   ├── useMaplibre.ts      # Map initialization hook
│   │   ├── layers.ts           # Layer configurations
│   │   ├── Legend.tsx          # Map legend
│   │   └── PointDetailsSheet.tsx
│   │
│   ├── filters/
│   │   ├── Sidebar.tsx         # Filter sidebar
│   │   ├── TaxonomySelect.tsx  # Cascading taxonomy
│   │   ├── DateRangeFilter.tsx
│   │   ├── SearchInput.tsx     # CAMID fuzzy search
│   │   └── MimicrySelectorDialog.tsx
│   │
│   ├── table/
│   │   ├── TableView.tsx       # Virtualized table
│   │   ├── columns.tsx         # Column definitions
│   │   └── TableToolbar.tsx
│   │
│   ├── gallery/
│   │   ├── ImageGallery.tsx    # Full-screen gallery
│   │   └── ThumbnailStrip.tsx  # Horizontal virtualized strip
│   │
│   └── export/
│       ├── ExportDialog.tsx    # CSV/GeoJSON export
│       └── MapExportDialog.tsx # Map image export
│
├── main.tsx                    # Entry point
└── index.css                   # Global styles
```

### Layout Primitives (Create Early!)

These prevent "padding soup" and ensure consistent spacing:

```typescript
// src/shared/layout/Stack.tsx
import { cn } from '@/shared/lib/cn'

interface StackProps {
  children: React.ReactNode
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

export function Stack({ children, gap = 'md', className }: StackProps) {
  return (
    <div className={cn('flex flex-col', gapMap[gap], className)}>
      {children}
    </div>
  )
}

// src/shared/layout/Panel.tsx
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      {children}
    </div>
  )
}

// src/shared/layout/PanelHeader.tsx
export function PanelHeader({ 
  title, 
  actions 
}: { 
  title: string
  actions?: React.ReactNode 
}) {
  return (
    <div className="flex items-center justify-between pb-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {actions}
    </div>
  )
}

// src/shared/layout/Section.tsx (collapsible)
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'

export function Section({ 
  title, 
  children, 
  defaultOpen = true 
}: { 
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:underline">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Rule:** No raw `p-4`, `gap-3`, `mb-2` in feature components. Use primitives.

---

## 6) Migration Steps (Feature-by-Feature)

### Step 1: Types + Data Loading

**Port from:** `ref-vue/src/stores/data.js`

**Create:**
- `src/features/data/types.ts` — TypeScript types for Record
- `src/features/data/schema.ts` — Zod schema for validation
- `src/features/data/loadRecords.ts` — Fetch function

**Deliverable:** Minimal page that prints total record count.

```typescript
// src/features/data/types.ts
export interface Record {
  id: string
  camid: string
  species: string
  subspecies: string | null
  genus: string
  tribe: string
  family: string
  lat: number
  lng: number
  locality: string
  country: string
  date: string | null
  image_url: string | null
  source: 'gbif' | 'manual'
  sequenced: boolean
}

export interface FilterState {
  search: string
  family: string | null
  tribe: string | null
  genus: string | null
  species: string | null
  subspecies: string | null
  sequencedOnly: boolean
  dateRange: [Date | null, Date | null]
  sources: ('gbif' | 'manual')[]
}
```

---

### Step 2: State Management (Zustand)

**Port from:** `ref-vue/src/stores/data.js`

**Create:**
- `src/features/data/store.ts` — Zustand store
- `src/features/data/selectors.ts` — Derived state (filteredIds, geojson, etc.)

**Key patterns:**
```typescript
// src/features/data/store.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface DataState {
  records: Record[]
  recordsById: Map<string, Record>
  filters: FilterState
  ui: {
    view: 'map' | 'table'
    selectedPointId: string | null
    sidebarOpen: boolean
  }
  
  // Actions
  setRecords: (records: Record[]) => void
  setFilters: (filters: Partial<FilterState>) => void
  setSelectedPoint: (id: string | null) => void
  setView: (view: 'map' | 'table') => void
}

export const useDataStore = create<DataState>()(
  subscribeWithSelector((set) => ({
    // ... implementation
  }))
)
```

```typescript
// src/features/data/selectors.ts
import { useMemo } from 'react'
import { useDataStore } from './store'

// Selector: filtered record IDs
export function useFilteredIds() {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)
  
  return useMemo(() => {
    return records
      .filter((r) => matchesFilters(r, filters))
      .map((r) => r.id)
  }, [records, filters])
}

// Selector: GeoJSON for map
export function useFilteredGeoJSON() {
  const records = useDataStore((s) => s.records)
  const filteredIds = useFilteredIds()
  const filteredSet = useMemo(() => new Set(filteredIds), [filteredIds])
  
  return useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: records
      .filter((r) => filteredSet.has(r.id))
      .map((r) => ({
        type: 'Feature' as const,
        id: r.id,
        geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
        properties: { ...r },
      })),
  }), [records, filteredSet])
}
```

**Deliverable:** Filter changes update derived counts correctly.

---

### Step 3: Map Engine (MapLibre)

**Port from:** `ref-vue/src/components/MapEngine.vue`

**Create:**
- `src/features/map/MapView.tsx`
- `src/features/map/useMaplibre.ts`
- `src/features/map/layers.ts`

**Key considerations:**
- Initialize map ONCE (use refs to prevent double-init in Strict Mode)
- Update data via `source.setData()`, never recreate map
- Use `@nazka/map-gl-js-spiderfy` for overlapping points
- Set `preserveDrawingBuffer: true` for screenshot export

**Deliverable:** Map shows clustered points; clicking selects; filters update display.

---

### Step 4: Sidebar (Filters)

**Port from:** `ref-vue/src/components/Sidebar.vue`

**Create:**
- `src/features/filters/Sidebar.tsx`
- `src/features/filters/TaxonomySelect.tsx` (cascading dropdowns)
- `src/features/filters/SearchInput.tsx` (uFuzzy for CAMID)
- `src/features/filters/DateRangeFilter.tsx`
- `src/features/filters/MimicrySelectorDialog.tsx`

**Use layout primitives:**
```typescript
<Panel>
  <Stack gap="sm">
    <Section title="Taxonomy">
      <TaxonomySelect />
    </Section>
    <Section title="Filters">
      <DateRangeFilter />
      <SequencingToggle />
    </Section>
    <Section title="Legend">
      <LegendControls />
    </Section>
  </Stack>
</Panel>
```

**Deliverable:** Sidebar changes update map.

---

### Step 5: Details UI (Sheet)

**Port from:** `ref-vue/src/components/PointPopup.vue`

**Create:** `src/features/map/PointDetailsSheet.tsx`

Use shadcn `Sheet` instead of MapLibre popup:
- Consistent styling
- Better accessibility
- No z-index fighting

**Deliverable:** Clicking map point opens details sheet.

---

### Step 6: Image Gallery

**Port from:** `ref-vue/src/components/ImageGallery.vue`

**Create:**
- `src/features/gallery/ImageGallery.tsx`
- `src/features/gallery/ThumbnailStrip.tsx` (virtualized)

**Use:**
- `react-zoom-pan-pinch` for pan/zoom
- `@tanstack/react-virtual` with `horizontal: true` for thumbnail strip
- Keyboard navigation (arrow keys)

**Deliverable:** Gallery opens from details; pan/zoom works; no regressions.

---

### Step 7: Table View

**Port from:** `ref-vue/src/components/DataTable.vue`

**Create:**
- `src/features/table/TableView.tsx`
- `src/features/table/columns.tsx`

**Requirements:**
- TanStack Table for logic
- TanStack Virtual for 30K row performance
- Thumbnail column with fallback logic
- Sortable columns
- Click row to select point

**Deliverable:** Table view matches filtering/sorting from Vue.

---

### Step 8: Export & Citations

**Port from:** `ref-vue/src/components/ExportPanel.vue`, `MapExport.vue`, `App.vue`

**Create:**
- `src/features/export/ExportDialog.tsx`
- `src/features/export/MapExportDialog.tsx`
- `src/shared/lib/export/exportCsv.ts`
- `src/shared/lib/export/exportGeojson.ts`
- `src/shared/lib/export/exportMapImage.ts`

**Citation section:** Use `__BUILD_TIME__` and `__COMMIT_HASH__` constants.

**Deliverable:** All exports work on deployed site.

---

### Step 9: URL State Parity

**Port from:** Vue URL handling

**Use nuqs:**
```typescript
// src/app/App.tsx
import { useQueryStates, parseAsFloat, parseAsString } from 'nuqs'

const [urlState, setUrlState] = useQueryStates({
  lat: parseAsFloat.withDefault(-0.5),
  lng: parseAsFloat.withDefault(-78.5),
  zoom: parseAsFloat.withDefault(8),
  species: parseAsString,
  view: parseAsString.withDefault('map'),
})
```

**Deliverable:** Copy/paste URL reproduces exact state.

---

## 7) File Migration Checklist

**To view any Vue file for reference:**
```bash
git show claude/refactor-shadcn-ui-HT92U:path/to/file
```

| Vue File | Command to View | React Equivalent |
|----------|-----------------|------------------|
| `src/components/Sidebar.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/Sidebar.vue` | `src/features/filters/Sidebar.tsx` |
| `src/components/MapEngine.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/MapEngine.vue` | `src/features/map/MapView.tsx` + `useMaplibre.ts` |
| `src/components/PointPopup.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/PointPopup.vue` | `src/features/map/PointDetailsSheet.tsx` |
| `src/components/MimicrySelector.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/MimicrySelector.vue` | `src/features/filters/MimicrySelectorDialog.tsx` |
| `src/components/ImageGallery.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/ImageGallery.vue` | `src/features/gallery/ImageGallery.tsx` |
| `src/components/DataTable.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/DataTable.vue` | `src/features/table/TableView.tsx` |
| `src/components/ExportPanel.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/ExportPanel.vue` | `src/features/export/ExportDialog.tsx` |
| `src/components/MapExport.vue` | `git show claude/refactor-shadcn-ui-HT92U:src/components/MapExport.vue` | `src/features/export/MapExportDialog.tsx` |
| `src/stores/data.js` | `git show claude/refactor-shadcn-ui-HT92U:src/stores/data.js` | `src/features/data/store.ts` + `selectors.ts` |
| `src/utils/imageProxy.js` | `git show claude/refactor-shadcn-ui-HT92U:src/utils/imageProxy.js` | `src/shared/lib/imageProxy.ts` |
| `src/composables/useTheme.js` | `git show claude/refactor-shadcn-ui-HT92U:src/composables/useTheme.js` | `src/app/providers/ThemeProvider.tsx` |
| `src/lib/utils.js` | `git show claude/refactor-shadcn-ui-HT92U:src/lib/utils.js` | `src/shared/lib/cn.ts` |

**List all Vue components:**
```bash
git ls-tree --name-only claude/refactor-shadcn-ui-HT92U:src/components/
```

**Also port:**
- `index.html` meta tags (OG tags, favicon)
- `vite.config.js` chunking strategy
- `.github/workflows/` paths

---

## 8) Quality Gates

Every PR must satisfy:

### Layout
- [ ] Uses layout primitives (Panel, Stack, Section) — no scattered spacing
- [ ] Consistent with Mira dense style
- [ ] Dark mode works correctly

### Performance
- [ ] Lists >200 rows use virtualization
- [ ] Map updates via `setData()`, not recreation
- [ ] Derived state in selectors/useMemo, not useEffect
- [ ] No unnecessary re-renders (check React DevTools)

### Code Quality
- [ ] TypeScript strict mode passes
- [ ] No `any` types
- [ ] Feature modules isolated (map logic in map/, not in filters/)
- [ ] Utilities are pure functions

### Functionality
- [ ] All Vue features preserved
- [ ] URL state shareable
- [ ] Exports work on production build
- [ ] Mobile responsive

---

## 9) Timeline

| Phase | Deliverable | Checkpoint |
|-------|-------------|------------|
| 1 | Scaffold + deploy | A, B |
| 2 | Data + store + selectors | Filter counts work |
| 3 | Map + clustering + spiderfy | Map interactive |
| 4 | Sidebar + filters | Full filtering |
| 5 | Details sheet | Point selection |
| 6 | Table view | Virtualized table |
| 7 | Gallery | Image zoom/pan |
| 8 | Exports + citations | All exports work |
| 9 | URL state | Shareable links |
| 10 | Polish | Feature parity |

---

## 10) Troubleshooting

### "dispatcher is null" or ghost markers
- React 18 Strict Mode issue
- Ensure map init is in useEffect with proper cleanup
- Use refs to prevent double initialization

### Assets 404 on GitHub Pages
- Check `vite.config.ts` has `base: '/ithomiini_maps/'`
- Verify asset paths in Network tab

### Slow table rendering
- Enable virtualization
- Check TanStack Virtual overscan value
- Memoize row data

### Spiderfy not working
- Ensure map zoom level >= minZoomLevel
- Check @nazka/map-gl-js-spiderfy is applied to correct source

### URL params not updating
- Wrap app with NuqsAdapter
- Check nuqs imports
