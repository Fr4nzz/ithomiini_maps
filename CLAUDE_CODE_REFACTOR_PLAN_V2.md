# Ithomiini Maps — React Refactor Continuation Plan

## 🔴 CRITICAL CONTEXT FOR CLAUDE CODE

**Read this first:**
- This is a **continuation** of an in-progress refactor from Vue.js to React + shadcn/ui
- The goal is **feature parity** with the Vue version, NOT simplification
- The user LIKES the new PointDetailsSheet (right panel) UI — keep it
- Some features were lost during refactoring — they must be restored

**Reference documents:**
- `REFACTORING_PLAN_REACT.md` — Original migration plan
- `EQUIVALENTS_VUE_TO_REACT.md` — Pattern mappings
- `DOCS_REACT_VITE_SHADCN.md` — Setup reference

**Vue reference branch:**
```bash
git fetch --all
git show claude/refactor-shadcn-ui-HT92U:src/components/Sidebar.vue
git show claude/refactor-shadcn-ui-HT92U:src/stores/data.js
```

---

## 📋 Issue Summary

### 🔴 Bugs (Fix First)
1. **Map turns grey** when PointDetailsSheet opens
2. **No selected point indicator** on the map (no visual feedback)
3. **Map interaction blocked** when sheet is open

### 🟡 Missing Features (Restore)
1. **Sidebar**: Most filter sections stripped out
2. **DateFilter**: Quick ranges, custom dates, date stats
3. **MimicrySelector**: Visual ring selector with photos
4. **Legend**: Color-coded legend on map
5. **ColorBy**: Dynamic point coloring (species, status, source, mimicry)
6. **Map styling**: Point radius, opacity, border controls
7. **Export**: Full settings (aspect ratio, DPI, legend position, scale bar)
8. **CAMID Search**: Autocomplete with multi-ID support
9. **GBIF Citation**: Citation panel with DOI link
10. **URL State**: Full shareable URL with all filters

### 🟢 Layout Changes (Polish)
1. Header taking too much space — consider integrating with sidebar
2. Mobile view toggle bar missing
3. Footer with Reset/Share/Export buttons missing from sidebar

---

## PHASE 1: Fix Critical Bugs

### Step 1.1: Fix Map Grey Overlay Issue

**Problem:** When PointDetailsSheet opens, the map becomes greyed out and uninteractive.

**Root cause:** The Sheet component may be applying a backdrop or the modal overlay is covering the map.

**Files to modify:**
- `src/features/map/MapView.tsx`
- `src/features/map/PointDetailsSheet.tsx`
- `src/shared/ui/sheet.tsx`

**Solution:**
```tsx
// In PointDetailsSheet.tsx
// Use Sheet with modal={false} to prevent backdrop overlay
<Sheet open={open} onOpenChange={onOpenChange} modal={false}>
  <SheetContent side="right" className="w-[400px] sm:w-[540px]">
    {/* content */}
  </SheetContent>
</Sheet>
```

**Verify:**
- [ ] Map remains fully interactive when sheet is open
- [ ] Map tiles render correctly (not grey)
- [ ] Can pan/zoom map while viewing point details

---

### Step 1.2: Add Selected Point Indicator on Map

**Problem:** No visual indication of which point is selected on the map.

**Files to modify:**
- `src/features/map/useMaplibre.ts`

**Solution:** Add a second layer for highlighting the selected point.

```typescript
// In useMaplibre.ts, after creating points-layer, add:

// Add highlight layer for selected point
map.addLayer({
  id: 'points-highlight',
  type: 'circle',
  source: 'points-source',
  filter: ['==', ['get', 'id'], ''], // Initially show nothing
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      3, 8,
      6, 12,
      10, 16,
      14, 22,
    ],
    'circle-color': 'transparent',
    'circle-stroke-width': 3,
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': 1,
  },
})

// Add pulsing animation layer
map.addLayer({
  id: 'points-pulse',
  type: 'circle',
  source: 'points-source',
  filter: ['==', ['get', 'id'], ''],
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      3, 12,
      6, 18,
      10, 24,
      14, 32,
    ],
    'circle-color': '#22c55e',
    'circle-opacity': 0.3,
  },
})

// Function to update highlight
const setHighlightedPoint = (id: string | null) => {
  const filter = id ? ['==', ['get', 'id'], id] : ['==', ['get', 'id'], '']
  map.setFilter('points-highlight', filter)
  map.setFilter('points-pulse', filter)
}
```

**Also subscribe to selectedPointId from store:**
```typescript
// Subscribe to store changes to update highlight
useDataStore.subscribe(
  (state) => state.ui.selectedPointId,
  (selectedId) => {
    if (mapRef.current && mapLoadedRef.current) {
      setHighlightedPoint(selectedId)
    }
  }
)
```

**Verify:**
- [ ] Clicking a point shows a visible highlight ring
- [ ] Highlight follows selected point
- [ ] Highlight clears when sheet closes

---

### Step 1.3: Ensure Map Remains Interactive

**Problem:** Map interactions may be blocked when sheet is open.

**Files to check:**
- `src/features/map/MapView.tsx`
- CSS for overlays

**Solution:** Ensure no pointer-events blocking overlays exist.

```tsx
// In MapView.tsx, ensure the map container has proper z-index
<div className="relative h-full w-full">
  <div ref={containerRef} className="absolute inset-0 z-0" />
  
  {/* Overlays should not block map interaction */}
  <div className="pointer-events-none absolute left-4 top-4 z-10">
    <div className="pointer-events-auto rounded-lg bg-background/90 px-3 py-2">
      {/* record count */}
    </div>
  </div>
  
  {/* Sheet doesn't need to be inside this div */}
</div>

{/* Sheet outside map container */}
<PointDetailsSheet ... />
```

**Verify:**
- [ ] Can click other points while sheet is open
- [ ] Can pan/zoom map with sheet open
- [ ] New point click updates sheet content

---

### Step 1.4: Add Next/Prev Navigation for Multi-Point Selection

**Problem:** When clicking a cluster or overlapping points, multiple IDs are passed. Need UI to navigate between them.

**File:** `src/features/map/PointDetailsSheet.tsx`

```tsx
export function PointDetailsSheet({
  open,
  onOpenChange,
  pointIds,  // Can be multiple when clicking cluster/overlap
  coordinates,
}: PointDetailsSheetProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Reset index when pointIds change
  useEffect(() => {
    setCurrentIndex(0)
  }, [pointIds])
  
  const hasMultiple = pointIds.length > 1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < pointIds.length - 1
  
  const goToPrev = () => {
    if (hasPrev) setCurrentIndex(i => i - 1)
  }
  
  const goToNext = () => {
    if (hasNext) setCurrentIndex(i => i + 1)
  }
  
  // Current point ID
  const currentPointId = pointIds[currentIndex]
  const currentRecord = recordsById.get(currentPointId)
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {/* Selected indicator */}
              <Badge variant="secondary" className="gap-1">
                <MapPin className="h-3 w-3" />
                Selected
              </Badge>
              {currentRecord?.scientific_name}
            </SheetTitle>
            
            {/* Navigation for multiple points */}
            {hasMultiple && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToPrev}
                  disabled={!hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] text-center text-sm text-muted-foreground">
                  {currentIndex + 1} / {pointIds.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToNext}
                  disabled={!hasNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <SheetDescription>
            {coordinates && (
              <span className="font-mono text-xs">
                {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        
        {/* Rest of content using currentRecord */}
        <ScrollArea className="flex-1">
          {/* ... */}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
```

**Also update the map highlight to follow current selection:**
```tsx
// Update selected point in store when navigating
useEffect(() => {
  if (currentPointId) {
    setSelectedPoint(currentPointId)
  }
}, [currentPointId, setSelectedPoint])
```

**Verify:**
- [ ] Clicking cluster passes all point IDs
- [ ] Next/Prev buttons appear for multiple points
- [ ] Navigation updates both sheet content AND map highlight
- [ ] Counter shows correct position

---

## PHASE 2: Restore Data Store Features

### Step 2.1: Add Missing Store State

**File:** `src/features/data/store.ts`

Add the following state that exists in Vue but is missing in React:

```typescript
// Add to DataState interface:
interface DataState {
  // ... existing ...
  
  // Color/Legend settings
  colorBy: 'species' | 'subspecies' | 'genus' | 'mimicry_ring' | 'sequencing_status' | 'source'
  legendSettings: {
    showLegend: boolean
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    maxItems: number
  }
  
  // Map style settings
  mapStyle: {
    pointRadius: number
    pointOpacity: number
    fillOpacity: number
    borderColor: string
  }
  
  // Export settings
  exportSettings: {
    aspectRatio: '16:9' | '4:3' | '1:1' | '3:2' | 'A4' | 'A4L' | 'custom'
    customWidth: number
    customHeight: number
    uiScale: number
    includeLegend: boolean
    includeScaleBar: boolean
    enabled: boolean
  }
  
  // URL settings
  urlSettings: {
    includeFilters: boolean
    includeMapView: boolean
    includeStyleSettings: boolean
  }
  
  // GBIF citation
  gbifCitation: {
    citation_text: string
    doi_url: string
    dataset_breakdown: { iNaturalist?: number; 'Other GBIF'?: number }
  } | null
  
  // Actions
  setColorBy: (colorBy: DataState['colorBy']) => void
  setLegendSettings: (settings: Partial<DataState['legendSettings']>) => void
  setMapStyle: (style: Partial<DataState['mapStyle']>) => void
  setExportSettings: (settings: Partial<DataState['exportSettings']>) => void
  setGbifCitation: (citation: DataState['gbifCitation']) => void
}

// Default values
const defaultLegendSettings = {
  showLegend: true,
  position: 'bottom-left' as const,
  maxItems: 10,
}

const defaultMapStyle = {
  pointRadius: 6,
  pointOpacity: 0.85,
  fillOpacity: 0.85,
  borderColor: '#ffffff',
}

const defaultExportSettings = {
  aspectRatio: '16:9' as const,
  customWidth: 1920,
  customHeight: 1080,
  uiScale: 1,
  includeLegend: true,
  includeScaleBar: true,
  enabled: true,
}
```

**Verify:**
- [ ] New state properties exist in store
- [ ] Actions update state correctly
- [ ] Default values are sensible

---

### Step 2.2: Add Color Mapping Selector

**File:** `src/features/data/selectors.ts`

```typescript
// Color palette (from Vue store)
const SEQUENCING_COLORS = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
}

const SOURCE_COLORS = {
  'Sanger Institute': '#22c55e',
  'GBIF': '#6b7280',
  'Dore et al. (2025)': '#f97316',
}

// Dynamic color generation for taxonomy
function generateColors(values: string[]): Record<string, string> {
  const hueStep = 360 / Math.max(values.length, 1)
  return Object.fromEntries(
    values.map((v, i) => [v, `hsl(${i * hueStep}, 70%, 50%)`])
  )
}

// Selector: active color map based on colorBy setting
export function useActiveColorMap() {
  const colorBy = useDataStore((s) => s.colorBy)
  const records = useDataStore((s) => s.records)
  
  return useMemo(() => {
    if (colorBy === 'sequencing_status') return SEQUENCING_COLORS
    if (colorBy === 'source') return SOURCE_COLORS
    
    // For taxonomy fields, generate colors dynamically
    const uniqueValues = [...new Set(
      records
        .map(r => r[colorBy as keyof typeof r])
        .filter((v): v is string => typeof v === 'string' && v !== '')
    )].sort()
    
    return generateColors(uniqueValues)
  }, [colorBy, records])
}

// Selector: legend title based on colorBy
export function useLegendTitle() {
  const colorBy = useDataStore((s) => s.colorBy)
  
  const titles: Record<string, string> = {
    species: 'Species',
    subspecies: 'Subspecies',
    genus: 'Genus',
    mimicry_ring: 'Mimicry Ring',
    sequencing_status: 'Status',
    source: 'Source',
  }
  
  return titles[colorBy] || 'Legend'
}
```

**Verify:**
- [ ] Color map updates when colorBy changes
- [ ] Taxonomy colors are generated dynamically
- [ ] Legend title reflects current colorBy

---

### Step 2.3: Load GBIF Citation

**File:** `src/features/data/loadRecords.ts`

```typescript
// Add function to load GBIF citation
export async function loadGbifCitation() {
  const response = await fetch('/data/gbif_citation.json')
  if (!response.ok) return null
  return response.json()
}

// In useRecords hook or App.tsx, also load citation
useEffect(() => {
  loadGbifCitation().then(citation => {
    if (citation) {
      useDataStore.getState().setGbifCitation(citation)
    }
  })
}, [])
```

**Verify:**
- [ ] Citation loads from JSON file
- [ ] Citation available in store
- [ ] Null handled gracefully if file missing

---

## PHASE 3: Restore Sidebar Features

### Step 3.1: Restructure Sidebar Layout

**File:** `src/features/filters/Sidebar.tsx`

The current sidebar is missing most features. Restore the full structure from Vue:

```tsx
export function Sidebar() {
  const [showMapSettings, setShowMapSettings] = useState(false)
  const [showExportSettings, setShowExportSettings] = useState(false)
  const [showUrlSettings, setShowUrlSettings] = useState(false)
  const [showCitation, setShowCitation] = useState(false)
  
  return (
    <Card className="flex h-full w-80 flex-col border-r">
      {/* Header with logo and view toggle */}
      <SidebarHeader />
      
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4 p-4">
          {/* Stats banner */}
          <StatsBanner />
          
          {/* CAMID Search */}
          <CamidSearch />
          
          {/* Taxonomy Filters */}
          <TaxonomyFilters />
          
          {/* Parallel Filters */}
          <ParallelFilters />
          
          {/* Date Filter */}
          <DateFilter />
          
          {/* Map Settings (Collapsible) */}
          <MapSettingsSection open={showMapSettings} onOpenChange={setShowMapSettings} />
          
          {/* Export Settings (Collapsible) */}
          <ExportSettingsSection open={showExportSettings} onOpenChange={setShowExportSettings} />
          
          {/* URL Share Settings (Collapsible) */}
          <UrlSettingsSection open={showUrlSettings} onOpenChange={setShowUrlSettings} />
        </CardContent>
      </ScrollArea>
      
      {/* GBIF Citation (Collapsible) */}
      <GbifCitationSection open={showCitation} onOpenChange={setShowCitation} />
      
      {/* Footer with buttons */}
      <SidebarFooter />
    </Card>
  )
}
```

**Create these sub-components:**
- `src/features/filters/SidebarHeader.tsx`
- `src/features/filters/StatsBanner.tsx`
- `src/features/filters/CamidSearch.tsx`
- `src/features/filters/TaxonomyFilters.tsx`
- `src/features/filters/ParallelFilters.tsx`
- `src/features/filters/DateFilter.tsx`
- `src/features/filters/MapSettingsSection.tsx`
- `src/features/filters/ExportSettingsSection.tsx`
- `src/features/filters/UrlSettingsSection.tsx`
- `src/features/filters/GbifCitationSection.tsx`
- `src/features/filters/SidebarFooter.tsx`

**Verify:**
- [ ] All sections render
- [ ] Collapsible sections work
- [ ] Scroll area works for long content

---

### Step 3.2: Create DateFilter Component

**File:** `src/features/filters/DateFilter.tsx`

Port from `vue/src/components/DateFilter.vue`:

```tsx
const QUICK_RANGES = [
  { label: 'All Time', start: '', end: '' },
  { label: 'Last Year', start: getDateOffset(-365), end: '' },
  { label: 'Last 5 Years', start: getDateOffset(-365 * 5), end: '' },
  { label: 'Last 10 Years', start: getDateOffset(-365 * 10), end: '' },
  { label: '2020s', start: '2020-01-01', end: '2029-12-31' },
  { label: '2010s', start: '2010-01-01', end: '2019-12-31' },
  { label: '2000s', start: '2000-01-01', end: '2009-12-31' },
  { label: 'Pre-2000', start: '', end: '1999-12-31' },
]

export function DateFilter() {
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const dateStats = useDateStats() // Create this selector
  
  const [startDate, setStartDate] = useState(filters.dateStart || '')
  const [endDate, setEndDate] = useState(filters.dateEnd || '')
  
  const applyFilter = () => {
    setFilters({
      dateStart: startDate || null,
      dateEnd: endDate || null,
    })
  }
  
  const clearFilter = () => {
    setStartDate('')
    setEndDate('')
    setFilters({ dateStart: null, dateEnd: null })
  }
  
  const applyQuickRange = (range: typeof QUICK_RANGES[0]) => {
    setStartDate(range.start)
    setEndDate(range.end)
    setFilters({
      dateStart: range.start || null,
      dateEnd: range.end || null,
    })
  }
  
  const isActive = !!filters.dateStart || !!filters.dateEnd
  
  return (
    <div className="rounded-lg bg-muted p-3.5">
      {/* Header with stats */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-primary" />
          Date Filter
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-primary">{dateStats.withDates.toLocaleString()} with dates</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{dateStats.withoutDates.toLocaleString()} without</span>
        </div>
      </div>
      
      {/* Date range info */}
      {dateStats.earliest && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md bg-background px-2.5 py-2 text-xs text-muted-foreground">
          <span>Data range:</span>
          <strong className="font-medium text-secondary-foreground">{dateStats.earliest}</strong>
          <span>to</span>
          <strong className="font-medium text-secondary-foreground">{dateStats.latest}</strong>
        </div>
      )}
      
      {/* Quick ranges */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {QUICK_RANGES.map((range) => (
          <Button
            key={range.label}
            variant="outline"
            size="sm"
            className={cn(
              'h-7 px-2.5 text-[11px]',
              startDate === range.start && endDate === range.end &&
                'border-primary bg-primary/15 text-primary'
            )}
            onClick={() => applyQuickRange(range)}
          >
            {range.label}
          </Button>
        ))}
      </div>
      
      {/* Custom date inputs */}
      <div className="mb-3 flex items-end gap-2.5">
        <div className="flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            From
          </label>
          <input
            type="date"
            value={startDate}
            max={endDate || dateStats.latest || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={applyFilter}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <span className="pb-1.5 text-muted-foreground">—</span>
        <div className="flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            To
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate || dateStats.earliest || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={applyFilter}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      
      {/* Active filter indicator */}
      {isActive && (
        <div className="mb-2.5 flex items-center justify-between rounded-md bg-primary/10 px-2.5 py-2">
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <Filter className="h-3 w-3" />
            Date filter active
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2.5 text-[11px] text-primary hover:bg-primary/15"
            onClick={clearFilter}
          >
            Clear
          </Button>
        </div>
      )}
      
      {/* Note */}
      <p className="m-0 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        Records without dates are hidden when a date filter is active.
      </p>
    </div>
  )
}
```

**Verify:**
- [ ] Quick ranges apply correctly
- [ ] Custom date inputs work
- [ ] Date stats show correct counts
- [ ] Clear button resets filter

---

### Step 3.3: Create CAMID Search with Autocomplete

**File:** `src/features/filters/CamidSearch.tsx`

Port the fuzzy CAMID search from Vue:

```tsx
export function CamidSearch() {
  const [input, setInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const setFilters = useDataStore((s) => s.setFilters)
  const uniqueCamids = useUniqueCamids() // Selector for unique IDs
  
  // Get current word at cursor for autocomplete
  const currentWord = useMemo(() => {
    if (!textareaRef.current) return ''
    const { value, selectionStart } = textareaRef.current
    // Extract word at cursor position
    // ... implementation from Vue
  }, [input])
  
  // Fuzzy search suggestions
  const suggestions = useMemo(() => {
    if (!currentWord || currentWord.length < 2) return []
    const query = currentWord.toUpperCase()
    return uniqueCamids
      .filter(id => id.toUpperCase().includes(query))
      .slice(0, 15)
  }, [currentWord, uniqueCamids])
  
  // Handle input change with debounce
  const handleInput = useDebounce((value: string) => {
    setFilters({ camidSearch: value.trim().toUpperCase() })
  }, 300)
  
  const selectSuggestion = (camid: string) => {
    // Insert selected CAMID at cursor position
    // ... implementation from Vue
    setShowDropdown(false)
    setSelectedIndex(-1)
  }
  
  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIndex])
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIndex >= 0 ? selectedIndex : 0])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }
  
  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        CAMID Search
      </label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            handleInput(e.target.value)
            setShowDropdown(currentWord.length >= 2)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(currentWord.length >= 2)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Enter CAMID(s)... (comma/space separated)"
          className="min-h-[60px] w-full resize-y rounded-md border bg-muted pl-9 pr-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>
      
      {/* Dropdown suggestions */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[200px] overflow-y-auto rounded-md border bg-popover shadow-lg">
          {suggestions.map((camid, i) => (
            <button
              key={camid}
              onClick={() => selectSuggestion(camid)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm font-mono hover:bg-accent',
                i === selectedIndex && 'bg-accent'
              )}
            >
              {camid}
            </button>
          ))}
        </div>
      )}
      
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Supports multiple IDs separated by commas, spaces, or newlines
      </p>
    </div>
  )
}
```

**Verify:**
- [ ] Typing shows autocomplete suggestions
- [ ] Keyboard navigation works
- [ ] Multiple IDs can be entered
- [ ] Filter applies after debounce

---

### Step 3.4: Create SidebarFooter with Actions

**File:** `src/features/filters/SidebarFooter.tsx`

```tsx
export function SidebarFooter() {
  const resetFilters = useDataStore((s) => s.resetFilters)
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  
  const copyShareUrl = async () => {
    // Generate shareable URL with current state
    const url = generateShareUrl() // Create this utility
    await navigator.clipboard.writeText(url)
    setShowCopiedToast(true)
    setTimeout(() => setShowCopiedToast(false), 2000)
  }
  
  return (
    <footer className="relative border-t bg-background p-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={resetFilters}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={copyShareUrl}
        >
          <Share2 className="mr-1 h-3.5 w-3.5" />
          Share
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={() => setExportOpen(true)}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          Export
        </Button>
      </div>
      
      {/* Copied toast */}
      {showCopiedToast && (
        <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
          URL copied to clipboard!
        </div>
      )}
      
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </footer>
  )
}
```

**Verify:**
- [ ] Reset clears all filters
- [ ] Share copies URL to clipboard
- [ ] Toast appears and fades
- [ ] Export opens dialog

---

## PHASE 4: Restore Map Features

### Step 4.0: Better Highlight Approach (Feature-State)

**UPDATED:** Use MapLibre `feature-state` instead of separate highlight layers. This is more performant.

**File:** `src/features/map/useMaplibre.ts`

```typescript
// Ensure GeoJSON features have stable IDs
map.addSource('points-source', {
  type: 'geojson',
  data: geojson,
  generateId: false, // We provide our own IDs
  promoteId: 'id',   // Use the 'id' property as feature ID
})

// Update layer paint to use feature-state
map.addLayer({
  id: 'points-layer',
  type: 'circle',
  source: 'points-source',
  paint: {
    'circle-radius': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      ['interpolate', ['linear'], ['zoom'], 3, 8, 6, 12, 10, 16, 14, 22],
      ['interpolate', ['linear'], ['zoom'], 3, 4, 6, 6, 10, 8, 14, 12],
    ],
    'circle-color': colorExpression, // Dynamic based on colorBy
    'circle-opacity': 0.85,
    'circle-stroke-width': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      3,
      1.5,
    ],
    'circle-stroke-color': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      '#ffffff',
      'rgba(255,255,255,0.6)',
    ],
  },
})

// Function to update selection
let currentSelectedId: string | null = null

const setSelectedFeature = (id: string | null) => {
  // Clear previous selection
  if (currentSelectedId) {
    map.setFeatureState(
      { source: 'points-source', id: currentSelectedId },
      { selected: false }
    )
  }
  
  // Set new selection
  if (id) {
    map.setFeatureState(
      { source: 'points-source', id },
      { selected: true }
    )
  }
  
  currentSelectedId = id
}

// Subscribe to store selection changes
useDataStore.subscribe(
  (state) => state.ui.selectedPointId,
  (selectedId) => {
    if (mapRef.current && mapLoadedRef.current) {
      setSelectedFeature(selectedId)
    }
  }
)
```

**Verify:**
- [ ] Selected point visually enlarges and gets thicker stroke
- [ ] Selection clears when sheet closes
- [ ] No separate highlight layers needed

---

### Step 4.1: Add Dynamic Point Coloring

**File:** `src/features/map/useMaplibre.ts`

Update point layer paint to use color from data:

```typescript
// Subscribe to colorBy changes and update layer paint
useEffect(() => {
  const map = mapRef.current
  if (!map || !mapLoadedRef.current) return
  
  const colorMap = useDataStore.getState().activeColorMap
  const colorBy = useDataStore.getState().colorBy
  
  // Build match expression for colors
  const colorExpression: any = ['match', ['get', colorBy]]
  
  Object.entries(colorMap).forEach(([value, color]) => {
    colorExpression.push(value, color)
  })
  colorExpression.push('#808080') // Default fallback
  
  map.setPaintProperty('points-layer', 'circle-color', colorExpression)
}, [colorBy, activeColorMap])
```

**Also update when filters change to ensure colors stay in sync.**

**Verify:**
- [ ] Points colored by selected attribute
- [ ] Colors update when colorBy changes
- [ ] Default color for unknown values

---

### Step 4.2: Add Legend Component

**File:** `src/features/map/Legend.tsx`

```tsx
export function Legend() {
  const colorBy = useDataStore((s) => s.colorBy)
  const legendSettings = useDataStore((s) => s.legendSettings)
  const activeColorMap = useActiveColorMap()
  const legendTitle = useLegendTitle()
  
  if (!legendSettings.showLegend) return null
  
  const entries = Object.entries(activeColorMap).slice(0, legendSettings.maxItems)
  const hasMore = Object.keys(activeColorMap).length > legendSettings.maxItems
  
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }
  
  const isItalic = ['species', 'subspecies', 'genus'].includes(colorBy)
  
  return (
    <div className={cn(
      'absolute z-10 rounded-lg bg-card/95 p-3 shadow-lg backdrop-blur',
      positionClasses[legendSettings.position]
    )}>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {legendTitle}
      </h4>
      <div className="space-y-1.5">
        {entries.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color as string }}
            />
            <span className={cn(
              'text-sm text-foreground',
              isItalic && 'italic'
            )}>
              {label}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <p className="mt-2 text-xs italic text-muted-foreground">
          + {Object.keys(activeColorMap).length - legendSettings.maxItems} more
        </p>
      )}
    </div>
  )
}
```

**Add to MapView:**
```tsx
<div className="relative h-full w-full">
  <div ref={containerRef} className="h-full w-full" />
  <Legend />
  {/* ... other overlays */}
</div>
```

**Verify:**
- [ ] Legend shows correct colors
- [ ] Position changes with settings
- [ ] Max items limits display
- [ ] "more" indicator shows when truncated

---

### Step 4.3: Add Map Style Controls

**File:** `src/features/filters/MapSettingsSection.tsx`

Port map styling controls from Vue Sidebar:

```tsx
export function MapSettingsSection({ open, onOpenChange }) {
  const colorBy = useDataStore((s) => s.colorBy)
  const setColorBy = useDataStore((s) => s.setColorBy)
  const mapStyle = useDataStore((s) => s.mapStyle)
  const setMapStyle = useDataStore((s) => s.setMapStyle)
  const legendSettings = useDataStore((s) => s.legendSettings)
  const setLegendSettings = useDataStore((s) => s.setLegendSettings)
  
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 rounded-lg border p-3.5 text-sm font-medium">
        <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
        Map & Legend Settings
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 p-3.5 pt-0">
        {/* Color By selector */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Color By</Label>
          <Select value={colorBy} onValueChange={setColorBy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="species">Species</SelectItem>
              <SelectItem value="subspecies">Subspecies</SelectItem>
              <SelectItem value="genus">Genus</SelectItem>
              <SelectItem value="mimicry_ring">Mimicry Ring</SelectItem>
              <SelectItem value="sequencing_status">Sequencing Status</SelectItem>
              <SelectItem value="source">Source</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Legend position */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Legend Position</Label>
          <Select 
            value={legendSettings.position} 
            onValueChange={(v) => setLegendSettings({ position: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Point radius */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Point Radius</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[mapStyle.pointRadius]}
              onValueChange={([v]) => setMapStyle({ pointRadius: v })}
              min={2}
              max={15}
              step={1}
              className="flex-1"
            />
            <span className="w-8 text-right text-sm font-semibold text-primary">
              {mapStyle.pointRadius}px
            </span>
          </div>
        </div>
        
        {/* Point opacity */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Point Opacity</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[mapStyle.pointOpacity]}
              onValueChange={([v]) => setMapStyle({ pointOpacity: v })}
              min={0.1}
              max={1}
              step={0.05}
              className="flex-1"
            />
            <span className="w-12 text-right text-sm font-semibold text-primary">
              {Math.round(mapStyle.pointOpacity * 100)}%
            </span>
          </div>
        </div>
        
        {/* Border color */}
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Border Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={mapStyle.borderColor}
              onChange={(e) => setMapStyle({ borderColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border"
            />
            <input
              type="text"
              value={mapStyle.borderColor}
              onChange={(e) => setMapStyle({ borderColor: e.target.value })}
              className="flex-1 rounded border bg-background px-2 py-1 font-mono text-sm uppercase"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Verify:**
- [ ] ColorBy selector updates map colors
- [ ] Legend position updates
- [ ] Point radius changes on map
- [ ] Opacity changes on map
- [ ] Border color changes on map

---

## PHASE 4B: Clustering + Spiderfy (CRITICAL - Was Missing!)

This was completely missing from the original plan. The Vue app has clustering enabled and uses `@nazka/map-gl-js-spiderfy` for overlapping points.

### Step 4B.1: Add Cluster Settings to Store

**File:** `src/features/data/store.ts`

```typescript
// Add to DataState interface:
interface DataState {
  // ... existing ...
  
  // Cluster settings
  clusterSettings: {
    enabled: boolean
    radius: number      // Cluster radius in pixels (default: 50)
    maxZoom: number     // Max zoom to cluster at (default: 14)
  }
  
  setClusterSettings: (settings: Partial<DataState['clusterSettings']>) => void
}

// Default values
const defaultClusterSettings = {
  enabled: true,
  radius: 50,
  maxZoom: 14,
}
```

---

### Step 4B.2: Enable Clustering in MapLibre

**File:** `src/features/map/useMaplibre.ts`

```typescript
import Spiderfy from '@nazka/map-gl-js-spiderfy'

// Get cluster settings from store
const clusterSettings = useDataStore((s) => s.clusterSettings)

// Configure source with clustering
map.addSource('points-source', {
  type: 'geojson',
  data: geojson,
  cluster: clusterSettings.enabled,
  clusterRadius: clusterSettings.radius,
  clusterMaxZoom: clusterSettings.maxZoom,
  promoteId: 'id',
})

// Add cluster circle layer
map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'points-source',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#51bbd6',  // < 10
      10, '#f1f075', // 10-50
      50, '#f28cb1', // 50-100
      100, '#e55e5e', // > 100
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      15,   // < 10
      10, 20,  // 10-50
      50, 25,  // 50-100
      100, 30, // > 100
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  },
})

// Add cluster count label
map.addLayer({
  id: 'cluster-count',
  type: 'symbol',
  source: 'points-source',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    'text-size': 12,
  },
  paint: {
    'text-color': '#ffffff',
  },
})

// Add unclustered points layer (existing points-layer)
map.addLayer({
  id: 'points-layer',
  type: 'circle',
  source: 'points-source',
  filter: ['!', ['has', 'point_count']], // Only non-clustered points
  paint: {
    // ... existing paint config
  },
})

// Click handler for clusters
map.on('click', 'clusters', async (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
  if (!features.length) return
  
  const clusterId = features[0].properties?.cluster_id
  const source = map.getSource('points-source') as maplibregl.GeoJSONSource
  
  // Get cluster expansion zoom
  const zoom = await source.getClusterExpansionZoom(clusterId)
  
  map.easeTo({
    center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
    zoom: zoom,
  })
})

// Change cursor on cluster hover
map.on('mouseenter', 'clusters', () => {
  map.getCanvas().style.cursor = 'pointer'
})
map.on('mouseleave', 'clusters', () => {
  map.getCanvas().style.cursor = ''
})
```

---

### Step 4B.3: Add Spiderfy for Overlapping Points

**File:** `src/features/map/useMaplibre.ts`

```typescript
import Spiderfy from '@nazka/map-gl-js-spiderfy'

// Initialize spiderfy after map loads
const spiderfyRef = useRef<Spiderfy | null>(null)

map.on('load', () => {
  // ... existing load logic ...
  
  // Initialize spiderfy
  spiderfyRef.current = new Spiderfy(map, {
    onLeafClick: (e, feature) => {
      // Handle click on spiderfied point
      const id = feature.properties?.id
      if (id) {
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
        setSelectedPoint(id)
        options.onPointClick?.(id, { lat, lng })
      }
    },
    minZoomLevel: clusterSettings.maxZoom, // Start spiderfying after clusters end
    zoomIncrement: 2,
    spiderLegsAreHidden: false,
    circleSpiralSwitchover: 10,
    circleFootSeparation: 30,
    spiralFootSeparation: 28,
    spiralLengthStart: 15,
    spiralLengthFactor: 4,
  })
  
  // Apply spiderfy to unclustered points
  spiderfyRef.current.applyTo('points-layer')
})

// Cleanup
return () => {
  spiderfyRef.current?.remove()
  map.remove()
}
```

---

### Step 4B.4: Add Cluster Settings UI

**File:** `src/features/filters/ClusterSettingsSection.tsx`

```tsx
export function ClusterSettingsSection() {
  const clusterSettings = useDataStore((s) => s.clusterSettings)
  const setClusterSettings = useDataStore((s) => s.setClusterSettings)
  
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 rounded-lg border p-3.5 text-sm font-medium">
        <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
        Clustering Settings
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 p-3.5 pt-2">
        {/* Enable clustering */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">Enable Clustering</Label>
          <Switch
            checked={clusterSettings.enabled}
            onCheckedChange={(checked) => setClusterSettings({ enabled: checked })}
          />
        </div>
        
        {clusterSettings.enabled && (
          <>
            {/* Cluster radius */}
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Cluster Radius
              </Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[clusterSettings.radius]}
                  onValueChange={([v]) => setClusterSettings({ radius: v })}
                  min={20}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="w-12 text-right text-sm font-semibold">
                  {clusterSettings.radius}px
                </span>
              </div>
            </div>
            
            {/* Max zoom for clustering */}
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Cluster Until Zoom
              </Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[clusterSettings.maxZoom]}
                  onValueChange={([v]) => setClusterSettings({ maxZoom: v })}
                  min={8}
                  max={18}
                  step={1}
                  className="flex-1"
                />
                <span className="w-8 text-right text-sm font-semibold">
                  {clusterSettings.maxZoom}
                </span>
              </div>
            </div>
          </>
        )}
        
        <p className="text-[11px] text-muted-foreground">
          Clustering groups nearby points. Spiderfying separates overlapping points at high zoom.
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Add to Sidebar:**
```tsx
// In Sidebar.tsx, add ClusterSettingsSection
<ClusterSettingsSection />
```

**Verify:**
- [ ] Clusters appear at low zoom levels
- [ ] Clicking cluster zooms in
- [ ] Cluster count labels show correct numbers
- [ ] Overlapping points spiderfy at high zoom
- [ ] Clicking spiderfied point selects it
- [ ] Cluster settings UI controls work
- [ ] Disabling clustering shows all individual points

---

## PHASE 5: Create MimicrySelector

### Step 5.1: Create MimicrySelector Dialog

**File:** `src/features/filters/MimicrySelectorDialog.tsx`

This is a complex component. Port from `vue/src/components/MimicrySelector.vue`:

```tsx
interface MimicrySelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MimicrySelectorDialog({ open, onOpenChange }: MimicrySelectorDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownInputRef = useRef<HTMLInputElement>(null)
  
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const records = useDataStore((s) => s.records)
  
  // Get all mimicry rings with counts
  const ringCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach(r => {
      const ring = r.mimicry_ring || 'Unknown'
      counts[ring] = (counts[ring] || 0) + 1
    })
    return counts
  }, [records])
  
  // All rings sorted
  const allRings = useMemo(() => 
    Object.keys(ringCounts).sort(),
    [ringCounts]
  )
  
  // Filtered rings based on search
  const filteredRings = useMemo(() => {
    if (!searchQuery) return allRings
    const query = searchQuery.toLowerCase()
    return allRings.filter(ring => ring.toLowerCase().includes(query))
  }, [allRings, searchQuery])
  
  // Available rings (those that have records with current taxonomy filter)
  const availableRings = useAvailableMimicryRings() // Create this selector
  
  const selectedRings = filters.mimicryRings
  
  const toggleRing = (ring: string) => {
    const newRings = selectedRings.includes(ring)
      ? selectedRings.filter(r => r !== ring)
      : [...selectedRings, ring]
    setFilters({ mimicryRings: newRings })
  }
  
  const removeRing = (ring: string) => {
    setFilters({ mimicryRings: selectedRings.filter(r => r !== ring) })
  }
  
  const clearSelection = () => {
    setFilters({ mimicryRings: [] })
    onOpenChange(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <img src="/src/assets/Mimicry_bttn.svg" alt="Mimicry" className="h-7 w-7" />
            Mimicry Rings
          </DialogTitle>
        </DialogHeader>
        
        {/* Search dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDropdown(!showDropdown)
              if (!showDropdown) {
                setTimeout(() => dropdownInputRef.current?.focus(), 0)
              }
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg border bg-muted px-3.5 py-2.5 text-sm',
              showDropdown && 'border-primary'
            )}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-left">
              {selectedRings.length === 0 
                ? 'Select mimicry rings...' 
                : `${selectedRings.length} ring${selectedRings.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', showDropdown && 'rotate-180')} />
          </button>
          
          {showDropdown && (
            <>
              <div 
                className="fixed inset-0 z-[99]" 
                onClick={() => setShowDropdown(false)} 
              />
              <div className="absolute top-full left-0 right-0 z-[100] mt-1 rounded-lg border bg-muted shadow-xl">
                <div className="border-b p-2.5">
                  <input
                    ref={dropdownInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowDropdown(false)}
                    placeholder="Type to filter..."
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <ScrollArea className="max-h-[250px]">
                  {filteredRings.map(ring => (
                    <button
                      key={ring}
                      onClick={() => toggleRing(ring)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-white/5',
                        selectedRings.includes(ring) && 'bg-primary/10'
                      )}
                    >
                      <span className={cn(
                        'flex h-4.5 w-4.5 items-center justify-center rounded border-2',
                        selectedRings.includes(ring) 
                          ? 'border-primary bg-primary' 
                          : 'border-border'
                      )}>
                        {selectedRings.includes(ring) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </span>
                      <span className="flex-1">{ring}</span>
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {ringCounts[ring] || 0}
                      </span>
                    </button>
                  ))}
                  {filteredRings.length === 0 && (
                    <div className="py-5 text-center text-sm text-muted-foreground">
                      No rings match "{searchQuery}"
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>
        
        {/* Selected rings badges */}
        {selectedRings.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/10 px-3.5 py-2.5">
            <span className="text-sm text-secondary-foreground">Selected:</span>
            {selectedRings.map(ring => (
              <button
                key={ring}
                onClick={() => removeRing(ring)}
                className="flex items-center gap-2 rounded bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground"
              >
                {ring}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
        
        {/* Ring grid with photos */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-1">
            {availableRings.map(ring => (
              <MimicryRingCard
                key={ring}
                ring={ring}
                count={ringCounts[ring] || 0}
                selected={selectedRings.includes(ring)}
                onToggle={() => toggleRing(ring)}
              />
            ))}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={clearSelection}>
            Clear All
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sub-component for ring card with photo
function MimicryRingCard({ ring, count, selected, onToggle }) {
  const representative = useMimicryRepresentative(ring) // Selector for photo
  
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative flex flex-col items-center rounded-lg border-2 bg-muted p-2.5 transition-all hover:-translate-y-0.5 hover:bg-accent/50',
        selected ? 'border-primary bg-primary/10' : 'border-transparent'
      )}
    >
      {/* Photo */}
      <div className="mb-2 aspect-square w-full overflow-hidden rounded-md">
        {representative?.image_url ? (
          <img
            src={getThumbnailUrl(representative.image_url)}
            alt={ring}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect fill="%232d2d4a" width="60" height="60"/></svg>'
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted-foreground/20">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
      </div>
      
      {/* Label */}
      <span className="text-center text-xs font-medium leading-tight">{ring}</span>
      <span className="text-[10px] text-muted-foreground">{count} records</span>
      
      {/* Selected indicator */}
      {selected && (
        <div className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  )
}
```

**Verify:**
- [ ] Dialog opens and closes
- [ ] Search filters rings
- [ ] Clicking toggles selection
- [ ] Photos load for rings
- [ ] Selected badges show and remove

---

## PHASE 5B: Cross-View Interactions (Map ↔ Table ↔ Gallery)

### Goal
All views coordinate selection consistently, matching Vue behavior.

### Step 5B.1: Table Row Click → Map Selection

**File:** `src/features/table/TableView.tsx`

```tsx
const handleRowClick = (record: DataRecord) => {
  // Set selection in store
  setSelectedPoint(record.id)
  
  // Switch to map view (or stay if already on map)
  const currentView = useDataStore.getState().ui.view
  if (currentView === 'table') {
    setView('map')
  }
  
  // Pan map to point location
  // This needs to be done after view switch, so use a small delay
  setTimeout(() => {
    const map = getMapInstance() // Need to expose this from useMaplibre
    if (map) {
      map.flyTo({
        center: [record.lng, record.lat],
        zoom: Math.max(map.getZoom(), 10),
        duration: 1000,
      })
    }
  }, 100)
  
  // Open details sheet
  setUI({ selectedPointId: record.id })
}
```

---

### Step 5B.2: Gallery Stays in Sync with Selection

**File:** `src/features/gallery/ImageGallery.tsx`

```tsx
// When selection changes externally, update gallery position
useEffect(() => {
  const selectedId = useDataStore.getState().ui.selectedPointId
  if (selectedId && open) {
    const idx = specimensWithImages.findIndex(s => s.id === selectedId)
    if (idx >= 0) {
      setCurrentIndex(idx)
    }
  }
}, [selectedPointId, open, specimensWithImages])

// When gallery selection changes, update store
const selectSpecimen = (id: string) => {
  const idx = specimensWithImages.findIndex(s => s.id === id)
  if (idx >= 0) {
    setCurrentIndex(idx)
    setSelectedPoint(id)
  }
}
```

---

### Step 5B.3: Sheet Navigation Updates All Views

**File:** `src/features/map/PointDetailsSheet.tsx`

When navigating with Next/Prev in the sheet:

```tsx
// Update selection and trigger map pan
const navigateToPoint = (index: number) => {
  setCurrentIndex(index)
  const pointId = pointIds[index]
  const record = recordsById.get(pointId)
  
  if (record) {
    // Update store selection
    setSelectedPoint(pointId)
    
    // Pan map to new point
    const map = getMapInstance()
    if (map) {
      map.easeTo({
        center: [record.lng, record.lat],
        duration: 500,
      })
    }
  }
}
```

**Verify:**
- [ ] Table row click selects point AND opens sheet
- [ ] Table row click switches to map view and pans
- [ ] Gallery updates when selection changes
- [ ] Sheet Next/Prev updates map highlight
- [ ] Closing sheet clears selection everywhere
- [ ] No stale selection state

---

## PHASE 6: Restore Export Features

### Step 6.1: Enhance ExportDialog

**File:** `src/features/export/ExportDialog.tsx`

The current export dialog is basic. Restore full functionality from Vue:

```tsx
// Add these additional tabs/sections:

// 1. Map Export tab with settings
<TabsContent value="map" className="space-y-4">
  {/* Aspect ratio presets */}
  <div>
    <Label className="mb-2.5 block text-xs uppercase tracking-wider">Preset Sizes</Label>
    <div className="grid grid-cols-3 gap-2">
      {ASPECT_RATIOS.map(({ name, width, height }) => (
        <Button
          key={name}
          variant="outline"
          size="sm"
          className={cn(
            'text-xs',
            exportSettings.aspectRatio === name && 'border-primary bg-primary/15 text-primary'
          )}
          onClick={() => setExportSettings({ aspectRatio: name, customWidth: width, customHeight: height })}
        >
          {name}
        </Button>
      ))}
    </div>
  </div>
  
  {/* Custom dimensions */}
  <div>
    <Label className="mb-2.5 block text-xs uppercase tracking-wider">Dimensions (pixels)</Label>
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-[11px] text-muted-foreground">Width</label>
        <input
          type="number"
          value={exportSettings.customWidth}
          onChange={(e) => setExportSettings({ customWidth: parseInt(e.target.value) || 1920 })}
          min={100}
          max={8000}
          className="w-full rounded-md border bg-muted px-3 py-2 text-sm tabular-nums"
        />
      </div>
      <span className="pb-2 text-lg text-muted-foreground">×</span>
      <div className="flex-1">
        <label className="mb-1 block text-[11px] text-muted-foreground">Height</label>
        <input
          type="number"
          value={exportSettings.customHeight}
          onChange={(e) => setExportSettings({ customHeight: parseInt(e.target.value) || 1080 })}
          min={100}
          max={8000}
          className="w-full rounded-md border bg-muted px-3 py-2 text-sm tabular-nums"
        />
      </div>
    </div>
  </div>
  
  {/* Include options */}
  <div>
    <Label className="mb-2.5 block text-xs uppercase tracking-wider">Include Elements</Label>
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2.5">
        <Checkbox
          checked={exportSettings.includeLegend}
          onCheckedChange={(c) => setExportSettings({ includeLegend: !!c })}
        />
        <span className="text-sm">Legend</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2.5">
        <Checkbox
          checked={exportSettings.includeScaleBar}
          onCheckedChange={(c) => setExportSettings({ includeScaleBar: !!c })}
        />
        <span className="text-sm">Scale bar</span>
      </label>
    </div>
  </div>
  
  {/* UI Scale slider */}
  <div>
    <Label className="mb-2.5 block text-xs uppercase tracking-wider">UI Scale</Label>
    <div className="flex items-center gap-2">
      <Slider
        value={[exportSettings.uiScale]}
        onValueChange={([v]) => setExportSettings({ uiScale: v })}
        min={0.5}
        max={2}
        step={0.1}
        className="flex-1"
      />
      <span className="w-12 text-right text-sm font-semibold">{exportSettings.uiScale}x</span>
    </div>
  </div>
  
  {/* Export buttons */}
  <div className="flex gap-2">
    <Button
      className="flex-1"
      onClick={() => handleExportMapImage('png')}
      disabled={!mapExportFn || view !== 'map' || isExporting}
    >
      <Download className="mr-2 h-4 w-4" />
      Export PNG
    </Button>
    <Button
      variant="outline"
      className="flex-1"
      onClick={() => handleExportMapImage('jpeg')}
      disabled={!mapExportFn || view !== 'map' || isExporting}
    >
      Export JPEG
    </Button>
  </div>
  
  {view !== 'map' && (
    <p className="text-center text-sm text-muted-foreground">
      Switch to Map view to export map image
    </p>
  )}
</TabsContent>
```

**Verify:**
- [ ] Aspect ratio presets work
- [ ] Custom dimensions update
- [ ] Include toggles work
- [ ] UI scale slider works
- [ ] Export generates correct image

---

### Step 6.2: Improve Map Image Export

**File:** `src/features/map/useMaplibre.ts`

Enhance `exportMapImage` to support legend, scale bar, and attribution:

```typescript
const exportMapImage = useCallback(
  async (
    format: 'png' | 'jpeg' = 'png',
    filename?: string,
    options?: {
      width?: number
      height?: number
      includeLegend?: boolean
      includeScaleBar?: boolean
      uiScale?: number
    }
  ): Promise<void> => {
    const map = mapRef.current
    if (!map) throw new Error('Map not initialized')
    
    const {
      width = 1920,
      height = 1080,
      includeLegend = true,
      includeScaleBar = true,
      uiScale = 1,
    } = options || {}
    
    // Wait for map to be idle
    if (!map.isStyleLoaded()) {
      await new Promise(resolve => map.once('style.load', resolve))
    }
    map.triggerRepaint()
    await new Promise(resolve => map.once('idle', resolve))
    
    // Create output canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = width
    canvas.height = height
    
    // Fill background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)
    
    // Draw map
    const mapCanvas = map.getCanvas()
    const mapImage = await loadImage(mapCanvas.toDataURL('image/png'))
    
    // Scale to fill
    const scale = Math.max(width / mapImage.width, height / mapImage.height)
    const scaledWidth = mapImage.width * scale
    const scaledHeight = mapImage.height * scale
    const offsetX = (width - scaledWidth) / 2
    const offsetY = (height - scaledHeight) / 2
    ctx.drawImage(mapImage, offsetX, offsetY, scaledWidth, scaledHeight)
    
    // Draw legend if enabled
    if (includeLegend) {
      drawLegendOnCanvas(ctx, width, height, uiScale)
    }
    
    // Draw scale bar if enabled
    if (includeScaleBar) {
      drawScaleBarOnCanvas(ctx, width, height, uiScale)
    }
    
    // Draw attribution
    drawAttributionOnCanvas(ctx, width, height, uiScale)
    
    // Download
    const dataUrl = canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.95 : undefined)
    const link = document.createElement('a')
    link.download = `${filename || 'ithomiini_map'}.${format}`
    link.href = dataUrl
    link.click()
  },
  []
)

// Helper functions (port from Vue App.vue)
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function drawLegendOnCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, uiScale: number) {
  // Port implementation from Vue App.vue drawLegendOnCanvas
  const store = useDataStore.getState()
  const colorMap = store.activeColorMap
  const entries = Object.entries(colorMap).slice(0, store.legendSettings.maxItems)
  
  // ... rest of implementation
}

function drawScaleBarOnCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, uiScale: number) {
  // Port implementation from Vue App.vue
}

function drawAttributionOnCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, uiScale: number) {
  // Port implementation from Vue App.vue
}
```

**Verify:**
- [ ] Export includes legend when enabled
- [ ] Export includes scale bar when enabled
- [ ] Attribution always included
- [ ] UI scale affects overlay sizes
- [ ] Custom dimensions work

---

## PHASE 7: Restore URL State

### Step 7.1: Complete URL State Sync with Debouncing

**File:** `src/shared/hooks/useUrlState.ts`

**Key improvements:**
1. Debounce viewport updates to avoid URL spam while dragging
2. Include selected point ID (optional)
3. Properly serialize all filter types

```typescript
import { useQueryStates, parseAsString, parseAsFloat, parseAsArrayOf, parseAsStringEnum } from 'nuqs'
import { useEffect, useRef } from 'react'
import { useDataStore } from '@/features/data'
import { useDebounce } from './useDebounce'

export function useUrlState() {
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const viewport = useDataStore((s) => s.viewport)
  const setViewport = useDataStore((s) => s.setViewport)
  const ui = useDataStore((s) => s.ui)
  const setUI = useDataStore((s) => s.setUI)
  const colorBy = useDataStore((s) => s.colorBy)
  const setColorBy = useDataStore((s) => s.setColorBy)
  const urlSettings = useDataStore((s) => s.urlSettings)
  const selectedPointId = useDataStore((s) => s.ui.selectedPointId)
  const setSelectedPoint = useDataStore((s) => s.setSelectedPoint)
  
  // Track if this is initial load
  const isInitialLoad = useRef(true)
  
  const [urlState, setUrlState] = useQueryStates({
    // View
    view: parseAsStringEnum(['map', 'table']).withDefault('map'),
    
    // Viewport (debounced updates)
    lat: parseAsFloat,
    lng: parseAsFloat,
    zoom: parseAsFloat,
    bearing: parseAsFloat,
    pitch: parseAsFloat,
    
    // Filters
    family: parseAsString,
    tribe: parseAsString,
    genus: parseAsString,
    species: parseAsArrayOf(parseAsString).withDefault([]),
    subspecies: parseAsArrayOf(parseAsString).withDefault([]),
    mimicry: parseAsArrayOf(parseAsString).withDefault([]),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    source: parseAsArrayOf(parseAsString).withDefault([]),
    country: parseAsString,
    camid: parseAsString,
    dateStart: parseAsString,
    dateEnd: parseAsString,
    
    // Style
    colorBy: parseAsStringEnum(['species', 'subspecies', 'genus', 'mimicry_ring', 'sequencing_status', 'source']),
    
    // Selected point (optional - for deep linking)
    selected: parseAsString,
  })
  
  // Debounced viewport for URL updates (prevents spam while dragging)
  const debouncedViewport = useDebounce(viewport, 500)
  
  // Initialize from URL on mount
  useEffect(() => {
    if (!isInitialLoad.current) return
    isInitialLoad.current = false
    
    const updates: Partial<typeof filters> = {}
    
    // View
    if (urlState.view && urlState.view !== ui.view) {
      setUI({ view: urlState.view as 'map' | 'table' })
    }
    
    // Viewport
    if (urlState.lat !== null && urlState.lng !== null) {
      setViewport({
        center: [urlState.lng, urlState.lat],
        zoom: urlState.zoom ?? viewport.zoom,
        bearing: urlState.bearing ?? viewport.bearing,
        pitch: urlState.pitch ?? viewport.pitch,
      })
    }
    
    // Filters
    if (urlState.family) updates.family = urlState.family
    if (urlState.tribe) updates.tribe = urlState.tribe
    if (urlState.genus) updates.genus = urlState.genus
    if (urlState.species.length) updates.species = urlState.species
    if (urlState.subspecies.length) updates.subspecies = urlState.subspecies
    if (urlState.mimicry.length) updates.mimicryRings = urlState.mimicry
    if (urlState.status.length) updates.statuses = urlState.status as any
    if (urlState.source.length) updates.sources = urlState.source as any
    if (urlState.country) updates.country = urlState.country
    if (urlState.camid) updates.camidSearch = urlState.camid
    if (urlState.dateStart) updates.dateStart = urlState.dateStart
    if (urlState.dateEnd) updates.dateEnd = urlState.dateEnd
    
    if (Object.keys(updates).length > 0) {
      setFilters(updates)
    }
    
    // ColorBy
    if (urlState.colorBy) {
      setColorBy(urlState.colorBy as any)
    }
    
    // Selected point (for deep linking)
    if (urlState.selected) {
      setSelectedPoint(urlState.selected)
      // Optionally open the details sheet
      setUI({ selectedPointId: urlState.selected })
    }
  }, []) // Only on mount
  
  // Sync store changes to URL (with debounced viewport)
  useEffect(() => {
    // Skip during initial load
    if (isInitialLoad.current) return
    
    const newState: Record<string, any> = {}
    
    // Only include what urlSettings allows
    if (urlSettings.includeMapView) {
      // Use debounced viewport to avoid spam while dragging
      newState.lat = debouncedViewport.center[1]
      newState.lng = debouncedViewport.center[0]
      newState.zoom = Math.round(debouncedViewport.zoom * 100) / 100 // Round to 2 decimals
      newState.bearing = debouncedViewport.bearing || null
      newState.pitch = debouncedViewport.pitch || null
    }
    
    if (urlSettings.includeFilters) {
      newState.view = ui.view
      newState.family = filters.family
      newState.tribe = filters.tribe
      newState.genus = filters.genus
      newState.species = filters.species.length ? filters.species : null
      newState.subspecies = filters.subspecies.length ? filters.subspecies : null
      newState.mimicry = filters.mimicryRings.length ? filters.mimicryRings : null
      newState.status = filters.statuses.length ? filters.statuses : null
      newState.source = filters.sources.length ? filters.sources : null
      newState.country = filters.country
      newState.camid = filters.camidSearch || null
      newState.dateStart = filters.dateStart
      newState.dateEnd = filters.dateEnd
    }
    
    if (urlSettings.includeStyleSettings) {
      newState.colorBy = colorBy
    }
    
    // Optionally include selected point for deep linking
    // (can be toggled in urlSettings if desired)
    if (urlSettings.includeSelectedPoint && selectedPointId) {
      newState.selected = selectedPointId
    } else {
      newState.selected = null
    }
    
    setUrlState(newState, { shallow: true })
  }, [filters, debouncedViewport, ui.view, colorBy, selectedPointId, urlSettings])
}
```

**Add to store types:**
```typescript
// In types.ts, update urlSettings
urlSettings: {
  includeFilters: boolean
  includeMapView: boolean
  includeStyleSettings: boolean
  includeSelectedPoint: boolean  // NEW: deep link to selected point
}
```

**Verify:**
- [ ] URL reflects current state
- [ ] Loading URL restores state
- [ ] URL doesn't update rapidly while dragging map
- [ ] Viewport updates are debounced (500ms)
- [ ] Selected point can be deep-linked (if enabled)
- [ ] URL settings control what's included
- [ ] Share button generates correct URL

---

## PHASE 8: Layout & Polish

### Step 8.1: Integrate Header into Sidebar

**Problem:** Current header takes vertical space. Vue version integrates it with sidebar.

**File:** `src/App.tsx` and `src/features/filters/Sidebar.tsx`

Move header content into sidebar header:

```tsx
// In Sidebar.tsx, create SidebarHeader:
function SidebarHeader() {
  const view = useDataStore((s) => s.ui.view)
  const setView = useDataStore((s) => s.setView)
  
  return (
    <div className="border-b p-4">
      {/* Logo */}
      <a
        href="https://github.com/Fr4nzz/ithomiini_maps"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-4 flex items-center gap-3"
      >
        <img src={MapIcon} alt="Ithomiini Maps" className="h-10 w-10" />
        <div>
          <span className="text-xl font-semibold tracking-tight">Ithomiini</span>
          <span className="block text-xs uppercase tracking-wider text-muted-foreground">
            Distribution Maps
          </span>
        </div>
      </a>
      
      {/* View toggle */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'map' | 'table')}>
        <TabsList className="w-full">
          <TabsTrigger value="map" className="flex-1 gap-1.5">
            <Map className="h-4 w-4" />
            Map
          </TabsTrigger>
          <TabsTrigger value="table" className="flex-1 gap-1.5">
            <Table2 className="h-4 w-4" />
            Table
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={openGallery}>
          <ImageIcon className="h-4 w-4" />
          Gallery
        </Button>
        <ModeToggle />
      </div>
    </div>
  )
}

// In App.tsx, remove the header component
function App() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="relative flex-1">
        {/* ... */}
      </main>
    </div>
  )
}
```

**Verify:**
- [ ] Logo in sidebar header
- [ ] View toggle in sidebar
- [ ] More vertical space for map
- [ ] Mobile layout still works

---

### Step 8.2: Add Mobile View Toggle Bar

**File:** `src/App.tsx`

Add responsive view toggle for mobile:

```tsx
{/* Mobile view toggle bar - only visible on small screens */}
<div className="flex items-center gap-1 border-b bg-card p-2 md:hidden">
  <Button
    variant={view === 'map' ? 'default' : 'secondary'}
    size="sm"
    className="flex-1 gap-1.5"
    onClick={() => setView('map')}
  >
    <Map className="h-4 w-4" />
    Map
  </Button>
  <Button
    variant={view === 'table' ? 'default' : 'secondary'}
    size="sm"
    className="flex-1 gap-1.5"
    onClick={() => setView('table')}
  >
    <Table2 className="h-4 w-4" />
    Table
  </Button>
  <Button
    variant="secondary"
    size="sm"
    onClick={() => openGallery()}
  >
    <ImageIcon className="h-4 w-4" />
  </Button>
  <Button
    variant="secondary"
    size="sm"
    onClick={() => setExportOpen(true)}
  >
    <Download className="h-4 w-4" />
  </Button>
</div>
```

**And make sidebar collapsible on mobile:**
```tsx
// Add to Sidebar
const [isOpen, setIsOpen] = useState(true)

// On mobile, sidebar should be a sheet/drawer
<>
  {/* Desktop sidebar */}
  <div className="hidden md:flex">
    <Card className="flex h-full w-80 flex-col border-r">
      {/* ... content */}
    </Card>
  </div>
  
  {/* Mobile drawer */}
  <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
    <SheetContent side="left" className="w-80 p-0">
      {/* Same sidebar content */}
    </SheetContent>
  </Sheet>
  
  {/* Mobile toggle button */}
  <Button
    variant="outline"
    size="icon"
    className="fixed bottom-4 left-4 z-50 md:hidden"
    onClick={() => setIsMobileOpen(true)}
  >
    <Menu className="h-4 w-4" />
  </Button>
</>
```

**Verify:**
- [ ] Mobile toggle bar visible on small screens
- [ ] Sidebar is drawer on mobile
- [ ] Menu button opens sidebar
- [ ] Desktop layout unchanged

---

## PHASE 9: Final Verification

### Step 9.1: Feature Parity Checklist

Go through each Vue feature and verify it exists in React:

**Sidebar Features:**
- [ ] Logo and title
- [ ] View toggle (Map/Table)
- [ ] Stats banner (total/filtered counts)
- [ ] CAMID search with autocomplete
- [ ] Taxonomy cascade (Family → Tribe → Genus → Species → Subspecies)
- [ ] Mimicry ring filter with selector dialog
- [ ] Sequencing status filter
- [ ] Source filter
- [ ] Country filter
- [ ] Date filter with quick ranges
- [ ] Map settings (color by, legend, point style)
- [ ] Export settings
- [ ] URL share settings
- [ ] GBIF citation panel
- [ ] Footer buttons (Reset, Share, Export)

**Map Features:**
- [ ] Points render with correct colors
- [ ] Legend displays with correct position
- [ ] Clicking point selects it
- [ ] Selected point has visual indicator
- [ ] Point details sheet opens
- [ ] Map remains interactive with sheet open
- [ ] Map export with overlays

**Table Features:**
- [ ] Virtualized scrolling
- [ ] Sortable columns
- [ ] Thumbnail column
- [ ] Click row to select
- [ ] Filtered data

**Gallery Features:**
- [ ] Opens from multiple places
- [ ] Thumbnail strip (virtualized)
- [ ] Pan/zoom on image
- [ ] Keyboard navigation
- [ ] Species/subspecies navigation

**Export Features:**
- [ ] CSV export
- [ ] GeoJSON export
- [ ] Map image export
- [ ] Citation copy

**URL State:**
- [ ] Filters in URL
- [ ] Viewport in URL
- [ ] Style settings in URL
- [ ] Loading URL restores state

---

### Step 9.2: Performance Verification

- [ ] Table scrolls smoothly with 30K rows
- [ ] Map pans/zooms smoothly
- [ ] Filter changes don't cause lag
- [ ] No console errors
- [ ] No memory leaks (check DevTools)

---

### Step 9.3: Build & Deploy

```bash
npm run build
npm run preview  # Test production build locally
```

**Check:**
- [ ] Build completes without errors
- [ ] Assets load correctly (check base path)
- [ ] All features work in production build
- [ ] GitHub Pages deployment works

---

## 📌 Summary of Files to Create/Modify

### New Files:
- `src/features/filters/SidebarHeader.tsx`
- `src/features/filters/StatsBanner.tsx`
- `src/features/filters/CamidSearch.tsx`
- `src/features/filters/TaxonomyFilters.tsx`
- `src/features/filters/ParallelFilters.tsx`
- `src/features/filters/DateFilter.tsx`
- `src/features/filters/MapSettingsSection.tsx`
- `src/features/filters/ExportSettingsSection.tsx`
- `src/features/filters/UrlSettingsSection.tsx`
- `src/features/filters/GbifCitationSection.tsx`
- `src/features/filters/SidebarFooter.tsx`
- `src/features/filters/MimicrySelectorDialog.tsx`
- `src/features/filters/ClusterSettingsSection.tsx` ← NEW
- `src/features/map/Legend.tsx`

### Files to Modify:
- `src/features/data/store.ts` — Add missing state (colorBy, legend, cluster, export settings)
- `src/features/data/selectors.ts` — Add color/legend selectors
- `src/features/data/types.ts` — Add new types
- `src/features/map/useMaplibre.ts` — Add feature-state highlighting, clustering, spiderfy, colors, export
- `src/features/map/MapView.tsx` — Add Legend component
- `src/features/map/PointDetailsSheet.tsx` — Fix modal behavior, add Next/Prev navigation
- `src/features/filters/Sidebar.tsx` — Restructure with all sections
- `src/features/export/ExportDialog.tsx` — Add map export settings
- `src/features/table/TableView.tsx` — Add row click → map pan behavior
- `src/features/gallery/ImageGallery.tsx` — Sync with selection
- `src/shared/hooks/useUrlState.ts` — Complete URL sync with debouncing
- `src/shared/ui/sheet.tsx` — Add modal/overlay control prop
- `src/App.tsx` — Layout adjustments

---

## 🚨 Important Notes for Claude Code

1. **Don't simplify** — The goal is feature parity, not minimalism
2. **Port carefully** — Reference Vue code for exact behavior
3. **Test incrementally** — Verify each phase before moving on
4. **Keep the Sheet UI** — User likes the right panel for point details
5. **Fix bugs first** — Map grey/blocking issues are critical
6. **Preserve styling** — Match the Vue app's look and feel

---

## ✅ Regression Checklist (Run After Each Phase!)

After completing each phase, verify these don't break:

### Core Functionality
- [ ] Map renders and is interactive
- [ ] Points display correctly
- [ ] Filters update point display
- [ ] Point selection works
- [ ] Details sheet opens/closes
- [ ] Table view works
- [ ] Gallery opens and displays images

### Performance
- [ ] No map re-initialization on filter change
- [ ] Table scrolls smoothly (30K rows)
- [ ] No console errors
- [ ] No memory leaks

### Visual
- [ ] Dark mode looks correct
- [ ] Light mode looks correct
- [ ] Colors are consistent
- [ ] No layout shifts

### Data Integrity
- [ ] Filtered counts match Vue for same filters
- [ ] Export produces valid CSV/GeoJSON
- [ ] URL state roundtrips correctly

---

## 🔗 Quick Reference: Vue File Locations

```bash
# View any Vue file:
git show claude/refactor-shadcn-ui-HT92U:src/components/Sidebar.vue
git show claude/refactor-shadcn-ui-HT92U:src/components/PointPopup.vue
git show claude/refactor-shadcn-ui-HT92U:src/components/MimicrySelector.vue
git show claude/refactor-shadcn-ui-HT92U:src/components/DateFilter.vue
git show claude/refactor-shadcn-ui-HT92U:src/components/ExportPanel.vue
git show claude/refactor-shadcn-ui-HT92U:src/components/MapExport.vue
git show claude/refactor-shadcn-ui-HT92U:src/components/ImageGallery.vue
git show claude/refactor-shadcn-ui-HT92U:src/components/DataTable.vue
git show claude/refactor-shadcn-ui-HT92U:src/stores/data.js
git show claude/refactor-shadcn-ui-HT92U:src/App.vue

# List all components:
git ls-tree --name-only claude/refactor-shadcn-ui-HT92U:src/components/
```