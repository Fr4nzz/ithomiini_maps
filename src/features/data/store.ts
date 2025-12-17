import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  Record,
  FilterState,
  UIState,
  ViewportState,
} from './types'
import { defaultFilters, defaultUIState, defaultViewport } from './types'

// Type for map export function
type MapExportFn = (format: 'png' | 'jpeg', filename?: string) => Promise<void>

// Color/Legend settings types
type ColorByField = 'species' | 'subspecies' | 'genus' | 'mimicry_ring' | 'sequencing_status' | 'source'

interface LegendSettings {
  showLegend: boolean
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  maxItems: number
}

interface MapStyleSettings {
  pointRadius: number
  pointOpacity: number
  fillOpacity: number
  borderColor: string
}

interface ExportSettings {
  aspectRatio: '16:9' | '4:3' | '1:1' | '3:2' | 'A4' | 'A4L' | 'custom'
  customWidth: number
  customHeight: number
  uiScale: number
  includeLegend: boolean
  includeScaleBar: boolean
  enabled: boolean
}

interface GbifCitation {
  citation_text: string
  doi_url: string
  dataset_breakdown: { iNaturalist?: number; 'Other GBIF'?: number }
}

// Default values
const defaultLegendSettings: LegendSettings = {
  showLegend: true,
  position: 'bottom-left',
  maxItems: 10,
}

const defaultMapStyle: MapStyleSettings = {
  pointRadius: 6,
  pointOpacity: 0.85,
  fillOpacity: 0.85,
  borderColor: '#ffffff',
}

const defaultExportSettings: ExportSettings = {
  aspectRatio: '16:9',
  customWidth: 1920,
  customHeight: 1080,
  uiScale: 1,
  includeLegend: true,
  includeScaleBar: true,
  enabled: true,
}

interface DataState {
  // Data
  records: Record[]
  recordsById: Map<string, Record>
  isLoading: boolean

  // Filters
  filters: FilterState

  // UI
  ui: UIState

  // Map viewport
  viewport: ViewportState

  // Map export function reference
  mapExportFn: MapExportFn | null

  // Color/Legend settings
  colorBy: ColorByField
  legendSettings: LegendSettings
  mapStyle: MapStyleSettings
  exportSettings: ExportSettings
  gbifCitation: GbifCitation | null

  // Actions
  setRecords: (records: Record[]) => void
  setLoading: (loading: boolean) => void
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  setUI: (ui: Partial<UIState>) => void
  setSelectedPoint: (id: string | null) => void
  setView: (view: 'map' | 'table') => void
  setViewport: (viewport: Partial<ViewportState>) => void
  toggleAdvancedFilters: () => void
  toggleMimicryFilter: () => void
  setMapExportFn: (fn: MapExportFn | null) => void
  setColorBy: (colorBy: ColorByField) => void
  setLegendSettings: (settings: Partial<LegendSettings>) => void
  setMapStyle: (style: Partial<MapStyleSettings>) => void
  setExportSettings: (settings: Partial<ExportSettings>) => void
  setGbifCitation: (citation: GbifCitation | null) => void
}

export const useDataStore = create<DataState>()(
  subscribeWithSelector((set) => ({
    // Initial state
    records: [],
    recordsById: new Map(),
    isLoading: true,
    filters: defaultFilters,
    ui: defaultUIState,
    viewport: defaultViewport,
    mapExportFn: null,
    colorBy: 'source',
    legendSettings: defaultLegendSettings,
    mapStyle: defaultMapStyle,
    exportSettings: defaultExportSettings,
    gbifCitation: null,

    // Actions
    setRecords: (records) =>
      set(() => {
        const recordsById = new Map<string, Record>()
        for (const record of records) {
          recordsById.set(record.id, record)
        }
        return { records, recordsById, isLoading: false }
      }),

    setLoading: (isLoading) => set({ isLoading }),

    setFilters: (newFilters) =>
      set((state) => ({
        filters: { ...state.filters, ...newFilters },
      })),

    resetFilters: () =>
      set({
        filters: defaultFilters,
        ui: {
          ...defaultUIState,
          showAdvancedFilters: false,
          showMimicryFilter: false,
        },
      }),

    setUI: (newUI) =>
      set((state) => ({
        ui: { ...state.ui, ...newUI },
      })),

    setSelectedPoint: (id) =>
      set((state) => ({
        ui: { ...state.ui, selectedPointId: id },
      })),

    setView: (view) =>
      set((state) => ({
        ui: { ...state.ui, view },
      })),

    setViewport: (newViewport) =>
      set((state) => ({
        viewport: { ...state.viewport, ...newViewport },
      })),

    toggleAdvancedFilters: () =>
      set((state) => {
        const show = !state.ui.showAdvancedFilters
        // Reset advanced filters when hiding
        if (!show) {
          return {
            ui: { ...state.ui, showAdvancedFilters: show },
            filters: {
              ...state.filters,
              family: null,
              tribe: null,
              genus: null,
            },
          }
        }
        return { ui: { ...state.ui, showAdvancedFilters: show } }
      }),

    toggleMimicryFilter: () =>
      set((state) => {
        const show = !state.ui.showMimicryFilter
        // Reset mimicry when hiding
        if (!show) {
          return {
            ui: { ...state.ui, showMimicryFilter: show },
            filters: { ...state.filters, mimicryRings: [] },
          }
        }
        return { ui: { ...state.ui, showMimicryFilter: show } }
      }),

    setMapExportFn: (fn) => set({ mapExportFn: fn }),

    setColorBy: (colorBy) => set({ colorBy }),

    setLegendSettings: (settings) =>
      set((state) => ({
        legendSettings: { ...state.legendSettings, ...settings },
      })),

    setMapStyle: (style) =>
      set((state) => ({
        mapStyle: { ...state.mapStyle, ...style },
      })),

    setExportSettings: (settings) =>
      set((state) => ({
        exportSettings: { ...state.exportSettings, ...settings },
      })),

    setGbifCitation: (citation) => set({ gbifCitation: citation }),
  }))
)

// Helper to check if a value is valid (not empty, unknown, etc.)
function isValidValue(val: string | null | undefined): val is string {
  if (!val) return false
  const cleaned = val.trim().toLowerCase()
  return (
    cleaned !== '' &&
    cleaned !== 'unknown' &&
    cleaned !== 'na' &&
    cleaned !== 'nan' &&
    cleaned !== 'null' &&
    cleaned !== 'none'
  )
}

// Helper to parse date strings
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null

  // Handle DD-MMM-YY format (e.g., "18-Jan-22")
  const ddMmmYy = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/
  const match = dateStr.match(ddMmmYy)
  if (match) {
    const [, day, monthStr, yearShort] = match
    const months: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    }
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

// Check if a record matches the current filters
function matchesFilters(record: Record, filters: FilterState): boolean {
  // CAMID Search
  if (filters.camidSearch) {
    const searchTerms = filters.camidSearch
      .toUpperCase()
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (searchTerms.length > 0) {
      const recordId = record.id.toUpperCase()
      const matches = searchTerms.some((term) => recordId.includes(term))
      if (!matches) return false
    }
  }

  // Taxonomic cascade
  if (filters.family && record.family !== filters.family) return false
  if (filters.tribe && record.tribe !== filters.tribe) return false
  if (filters.genus && record.genus !== filters.genus) return false

  // Species filter (multi-select)
  if (filters.species.length > 0 && !filters.species.includes(record.scientific_name)) {
    return false
  }

  // Subspecies filter (multi-select)
  if (filters.subspecies.length > 0) {
    if (!record.subspecies || !filters.subspecies.includes(record.subspecies)) {
      return false
    }
  }

  // Mimicry rings (multi-select)
  if (filters.mimicryRings.length > 0) {
    if (!record.mimicry_ring || !filters.mimicryRings.includes(record.mimicry_ring)) {
      return false
    }
  }

  // Sequencing status (multi-select)
  if (filters.statuses.length > 0) {
    if (!record.sequencing_status || !filters.statuses.includes(record.sequencing_status)) {
      return false
    }
  }

  // Source (multi-select)
  if (filters.sources.length > 0 && !filters.sources.includes(record.source)) {
    return false
  }

  // Country
  if (filters.country && record.country !== filters.country) return false

  // Date filtering
  if (filters.dateStart || filters.dateEnd) {
    const itemDate = parseDate(record.observation_date)
    if (!itemDate) return false

    if (filters.dateStart && itemDate < new Date(filters.dateStart)) return false
    if (filters.dateEnd && itemDate > new Date(filters.dateEnd)) return false
  }

  return true
}

// Export helper functions for selectors
export { isValidValue, parseDate, matchesFilters }
