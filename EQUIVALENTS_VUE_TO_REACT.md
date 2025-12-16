# Vue → React Migration Guide: Framework Equivalents & Best Practices

This document provides recommended React equivalents for patterns and libraries used in the Vue version of Ithomiini Maps, optimized for **performance with ~30,000 records**, **active maintenance**, and **modern best practices (2024-2025)**.

---

## 1) Core Mental Model Mapping

### Vue Composition API → React Hooks

| Vue | React | Notes |
|-----|-------|-------|
| `ref()` / `reactive()` | `useState`, `useReducer`, or Zustand | Prefer Zustand for shared state |
| `computed()` | `useMemo` or store selectors | **Never** compute derived state in `useEffect` |
| `watch()` | `useEffect` | Side effects only, not derived state |
| `provide/inject` | React Context | Only for cross-cutting concerns (theme, i18n) |
| `onMounted` | `useEffect(() => {}, [])` | Empty dependency array |
| `onUnmounted` | `useEffect` cleanup function | `return () => { cleanup() }` |

### Vue Templates → JSX

| Vue | React |
|-----|-------|
| `v-if` | `{condition && <A/>}` or ternary `{cond ? <A/> : <B/>}` |
| `v-for` | `array.map(item => <Item key={item.id} />)` |
| `v-model` | Controlled inputs: `value` + `onChange` |
| `v-show` | `style={{ display: cond ? 'block' : 'none' }}` or CSS classes |
| `v-bind:class` | `className={cn('base', condition && 'active')}` |
| `@click` | `onClick` |
| `slot` | `children` prop or render props |

---

## 2) State Management

### ❌ Avoid: React Context for Frequently-Changing State

**Critical warning:** React Context triggers re-renders in ALL consuming components when ANY part of the context value changes. For map applications where viewport state (lat/lng/zoom) changes 60 times per second during drag, this is fatal for performance.

### ✅ Recommended: Zustand (Global Store)

**Why Zustand:**
- Smallest API surface of major state libraries
- Slice-based subscriptions prevent unnecessary re-renders
- 41% adoption in new React projects (2024 State of React survey)
- Highest satisfaction rating among state management solutions

**Installation:**
```bash
npm install zustand
```

**Pattern for map applications:**
```typescript
// src/stores/mapStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface MapState {
  // Viewport (changes frequently during interaction)
  viewport: { lat: number; lng: number; zoom: number }
  setViewport: (v: Partial<MapState['viewport']>) => void
  
  // Filters (changes on user input)
  filters: FilterState
  setFilters: (f: Partial<FilterState>) => void
  
  // UI state
  selectedPointId: string | null
  setSelectedPoint: (id: string | null) => void
}

export const useMapStore = create<MapState>()(
  subscribeWithSelector((set) => ({
    viewport: { lat: -0.5, lng: -78.5, zoom: 8 },
    setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),
    
    filters: initialFilters,
    setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
    
    selectedPointId: null,
    setSelectedPoint: (id) => set({ selectedPointId: id }),
  }))
)

// Components subscribe to SLICES, not the whole store
// This component only re-renders when selectedPointId changes
const DetailsPanel = () => {
  const pointId = useMapStore((s) => s.selectedPointId)
  // ...
}

// This component only re-renders when filters change
const FilterPanel = () => {
  const filters = useMapStore((s) => s.filters)
  // ...
}
```

### Alternative: Jotai (for Complex Derived State)

If filter states become highly interdependent (filter A affects filter B affects display), Jotai's atomic model with automatic dependency tracking can outperform manual Zustand selectors.

```bash
npm install jotai
```

### Alternative: Legend State (Maximum Performance)

If performance issues materialize, Legend State (signals-based) beats all alternatives in benchmarks, including vanilla JS for array operations.

```bash
npm install @legendapp/state
```

---

## 3) Data Loading & Caching

### Recommended: TanStack Query

Even for data loaded once at startup, TanStack Query provides built-in loading/error states and cache management.

**Installation:**
```bash
npm install @tanstack/react-query
```

**Configuration for static data:**
```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,      // Data never goes stale
      gcTime: Infinity,         // Never garbage collect
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
})

// src/hooks/useRecords.ts
import { useQuery } from '@tanstack/react-query'

export function useRecords() {
  return useQuery({
    queryKey: ['records'],
    queryFn: async () => {
      const res = await fetch('/data/map_points.json')
      return res.json()
    },
  })
}
```

---

## 4) URL State Management

### ✅ Recommended: nuqs (Type-Safe URL State)

**nuqs** is the leading type-safe URL state manager, used by Sentry, Vercel, Supabase. At 6KB gzipped, it eliminates custom URL synchronization code.

**Installation:**
```bash
npm install nuqs
```

**Setup for React SPA (`src/main.tsx`):**
```typescript
import { NuqsAdapter } from 'nuqs/adapters/react'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <NuqsAdapter>
    <App />
  </NuqsAdapter>
)
```

**Usage:**
```typescript
import { useQueryStates, parseAsFloat, parseAsInteger, parseAsString, parseAsArrayOf } from 'nuqs'

// Define URL state with type-safe parsers
const [mapState, setMapState] = useQueryStates({
  lat: parseAsFloat.withDefault(-0.5),
  lng: parseAsFloat.withDefault(-78.5),
  zoom: parseAsInteger.withDefault(8),
  species: parseAsString,
  tribes: parseAsArrayOf(parseAsString).withDefault([]),
})

// Update URL (automatically syncs)
setMapState({ zoom: 10, species: 'Ithomia' })

// URL becomes: ?lat=-0.5&lng=-78.5&zoom=10&species=Ithomia
```

### Alternative: Manual URL State (if simpler is preferred)

```typescript
// src/shared/lib/urlState.ts
export function serializeFilters(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.species) params.set('species', filters.species)
  if (filters.tribes.length) params.set('tribes', filters.tribes.join(','))
  // ...
  return params
}

export function parseFiltersFromUrl(): Partial<FilterState> {
  const params = new URLSearchParams(window.location.search)
  return {
    species: params.get('species') || undefined,
    tribes: params.get('tribes')?.split(',').filter(Boolean) || [],
    // ...
  }
}

// Update URL without navigation
window.history.replaceState(null, '', `?${serializeFilters(filters)}`)
```

---

## 5) Map Integration (MapLibre GL JS)

### Recommended: Imperative Approach with React Wrapper

Use MapLibre directly (no heavy wrapper) for maximum control and performance.

**Installation:**
```bash
npm install maplibre-gl
npm install -D @types/maplibre-gl
```

**Pattern:**
```typescript
// src/features/map/MapView.tsx
import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-78.5, -0.5],
      zoom: 8,
      preserveDrawingBuffer: true, // Required for canvas export
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
```

### Alternative: react-map-gl v8 (Declarative)

If you prefer declarative JSX for map layers:

```bash
npm install react-map-gl maplibre-gl
```

```typescript
import Map from 'react-map-gl/maplibre'  // Note: /maplibre endpoint

<Map
  initialViewState={{ longitude: -78.5, latitude: -0.5, zoom: 8 }}
  mapStyle="..."
>
  <Source type="geojson" data={geojson}>
    <Layer {...layerStyle} />
  </Source>
</Map>
```

---

## 6) Spiderfying Overlapping Points

### ✅ Recommended: @nazka/map-gl-js-spiderfy

This library renders spiderfied points **in the canvas** (not DOM overlays), which is essential for screenshot functionality.

**Installation:**
```bash
npm install @nazka/map-gl-js-spiderfy
```

**Usage:**
```typescript
import { Spiderfy } from '@nazka/map-gl-js-spiderfy'

// After map loads
const spiderfy = new Spiderfy(map, {
  onLeafClick: (e, properties) => {
    setSelectedPoint(properties.id)
  },
  minZoomLevel: 12,
  zoomIncrement: 2,
  spiderLegColor: '#888',
  spiderLegWidth: 1,
})

// Set the source to spiderfy
spiderfy.applyTo('points-source')
```

**Architecture pattern:**
1. MapLibre built-in clustering (uses Supercluster internally) handles zoom levels 0-11
2. At zoom 12+, click on cluster → spiderifier spreads overlapping points
3. All rendering happens in WebGL canvas (screenshot-friendly)

---

## 7) Tables & Virtualization

### ✅ Recommended: TanStack Table + TanStack Virtual

For 30,000 records, virtualization is mandatory.

**Installation:**
```bash
npm install @tanstack/react-table @tanstack/react-virtual
```

**Pattern:**
```typescript
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

function DataTable({ data, columns }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = table.getRowModel()
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // row height
    overscan: 10,
    // Firefox fix
    measureElement: navigator.userAgent.indexOf('Firefox') === -1
      ? (el) => el?.getBoundingClientRect().height
      : undefined,
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          return (
            <div
              key={row.id}
              style={{
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
              }}
            >
              {/* Render row */}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### Alternative: react-virtuoso (Batteries Included)

If you prefer simpler API with automatic row height handling:

```bash
npm install react-virtuoso
```

```typescript
import { TableVirtuoso } from 'react-virtuoso'

<TableVirtuoso
  data={records}
  fixedHeaderContent={() => <tr>...</tr>}
  itemContent={(index, record) => (
    <>
      <td>{record.species}</td>
      <td>{record.locality}</td>
    </>
  )}
/>
```

---

## 8) Fuzzy Search

### ✅ Recommended: uFuzzy (for 30,000 records)

**Critical:** `cmdk` (shadcn Command) is designed for ~100-500 items, not 30,000 taxonomic records. Use **uFuzzy** for search with cmdk as the UI shell.

**uFuzzy benchmarks on 162,000 phrases:** 5-18ms search time, 7.5KB bundle

**Installation:**
```bash
npm install @leeoniya/ufuzzy
```

**Usage:**
```typescript
import uFuzzy from '@leeoniya/ufuzzy'

// Initialize once
const uf = new uFuzzy({
  intraMode: 1,        // Allow character swaps (typo tolerance)
  intraIns: 1,         // Allow insertions
  intraSub: 1,         // Allow substitutions
  intraTrn: 1,         // Allow transpositions
  intraDel: 1,         // Allow deletions
})

// Search
const haystack = records.map(r => `${r.species} ${r.subspecies} ${r.camid}`)
const [idxs, info, order] = uf.search(haystack, searchQuery)

// Get results
const results = order?.map(i => records[idxs[i]]) ?? []
```

**Integration with shadcn Command:**
```typescript
import { Command } from '@/components/ui/command'

<Command filter={(value, search) => {
  const [idxs] = uf.search([value], search)
  return idxs?.length ? 1 : 0
}}>
  {/* ... */}
</Command>
```

### Alternative: Fuse.js (if simpler API needed)

Fuse.js is easier to set up but 1000x slower at scale. Only use if dataset is under 5,000 records.

---

## 9) Image Gallery & Pan/Zoom

### ✅ Recommended: react-zoom-pan-pinch

**Installation:**
```bash
npm install react-zoom-pan-pinch
```

**Usage:**
```typescript
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

<TransformWrapper
  initialScale={1}
  minScale={0.5}
  maxScale={4}
  doubleClick={{ mode: 'toggle' }}
>
  <TransformComponent>
    <img src={imageUrl} alt={description} />
  </TransformComponent>
</TransformWrapper>
```

### Horizontal Thumbnail Strip (Virtualized)

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const horizontalVirtualizer = useVirtualizer({
  horizontal: true,
  count: thumbnails.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 100, // thumbnail width
  overscan: 3,
})
```

### Lightbox: Yet Another React Lightbox (YARL)

```bash
npm install yet-another-react-lightbox
```

---

## 10) Canvas/Map Export

### ✅ Recommended: html-to-image + MapLibre Canvas

**For DOM elements (legend, attribution):**
```bash
npm install html-to-image
```

**For map canvas:**
```typescript
// Ensure preserveDrawingBuffer: true on map init
const mapCanvas = map.getCanvas()
const mapImage = mapCanvas.toDataURL('image/png')
```

**Compositing pattern:**
```typescript
import { toPng } from 'html-to-image'

async function exportMapWithLegend() {
  // 1. Get map canvas
  const mapCanvas = map.getCanvas()
  
  // 2. Capture legend as image
  const legendElement = document.getElementById('legend')
  const legendDataUrl = await toPng(legendElement)
  
  // 3. Composite onto offscreen canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = mapCanvas.width
  canvas.height = mapCanvas.height
  
  // Draw map
  ctx.drawImage(mapCanvas, 0, 0)
  
  // Draw legend
  const legendImg = new Image()
  legendImg.src = legendDataUrl
  await legendImg.decode()
  ctx.drawImage(legendImg, 20, 20)
  
  // 4. Export
  return canvas.toDataURL('image/png')
}
```

### Alternative: @watergis/maplibre-gl-export

Dedicated MapLibre export plugin with PDF/PNG/JPEG/SVG support:

```bash
npm install @watergis/maplibre-gl-export
```

---

## 11) Modals & Overlays

### Vue popup components → shadcn equivalents:

| Vue Component | React Equivalent | Notes |
|---------------|------------------|-------|
| MapLibre Popup | `Sheet` | Side panel for details (recommended) |
| Details popup | `Sheet` | Consistent with sidebar |
| Mimicry selector | `Dialog` | Modal dialog |
| Export panel | `Dialog` | Modal dialog |
| Full-screen gallery | `Dialog` or custom overlay | With pan/zoom |

**Why Sheet over MapLibre Popup:**
- Consistent styling with shadcn
- Better accessibility
- No fighting with map z-index
- Keyboard navigation built-in

---

## 12) Routing

### ✅ Recommended: HashRouter (for GitHub Pages)

```bash
npm install react-router-dom
```

```typescript
import { HashRouter, Routes, Route } from 'react-router-dom'

// URLs: /ithomiini_maps/#/map, /ithomiini_maps/#/table
<HashRouter>
  <Routes>
    <Route path="/" element={<MapView />} />
    <Route path="/table" element={<TableView />} />
  </Routes>
</HashRouter>
```

### Alternative: No Router (Single Page with URL State)

For a map app, you may not need routes at all. Use `nuqs` for filter/view state in URL params:

```
/ithomiini_maps/?view=table&species=Ithomia&zoom=10
```

---

## 13) Summary: Recommended Stack

| Concern | Library | Why |
|---------|---------|-----|
| UI Components | shadcn/ui (Mira) | Dense interfaces, full ownership |
| State Management | Zustand | Slice subscriptions, minimal API |
| Server State | TanStack Query | Cache, loading/error states |
| URL State | nuqs | Type-safe, 6KB, production-proven |
| Tables | TanStack Table + Virtual | Scale to 30K rows |
| Map | MapLibre GL JS (imperative) | WebGL performance |
| Spiderfying | @nazka/map-gl-js-spiderfy | Canvas-native, screenshot-friendly |
| Fuzzy Search | uFuzzy | 1000x faster than Fuse.js at scale |
| Pan/Zoom | react-zoom-pan-pinch | Touch support, simple API |
| Canvas Export | html-to-image | Actively maintained |
| Routing | HashRouter or none | GitHub Pages compatible |
| Toasts | Sonner | shadcn default |
| Validation | Zod | URL state, data schemas |

---

## 14) Performance Rules

1. **Single map instance** — update data via `setData()`, never recreate map
2. **Virtualize lists** — any list that can exceed ~200 rows
3. **Derived state in selectors** — `useMemo` or Zustand selectors, **never** in `useEffect`
4. **Zustand slice subscriptions** — components subscribe to specific slices, not whole store
5. **Debounce filter inputs** — 200-300ms for search, prevents excessive recalculation
6. **Memoize expensive computations** — filtered GeoJSON, sorted records
7. **Lazy load heavy components** — gallery, export dialogs

---

## 15) Migration Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|---------|------|
| Store viewport in Context | Use Zustand with slice subscription |
| Compute derived state in useEffect | Use useMemo or store selectors |
| Re-create map on filter change | Update GeoJSON source via setData() |
| Render 30K rows without virtualization | Use TanStack Virtual or react-virtuoso |
| Use Fuse.js for 30K records | Use uFuzzy |
| Use BrowserRouter on GitHub Pages | Use HashRouter or URL params |
| Manual URL serialization | Use nuqs |
