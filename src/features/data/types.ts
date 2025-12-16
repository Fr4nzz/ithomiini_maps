// Sequencing status enum
export type SequencingStatus =
  | 'Sequenced'
  | 'Tissue Available'
  | 'Preserved Specimen'
  | 'Published'

// Data source enum
export type DataSource = 'Dore et al. (2025)' | 'Sanger Institute' | 'GBIF'

// Individual record from map_points.json
export interface Record {
  id: string
  scientific_name: string
  genus: string
  species: string
  subspecies: string | null
  family: string
  tribe: string
  lat: number
  lng: number
  mimicry_ring: string | null
  sequencing_status: SequencingStatus | null
  source: DataSource
  country: string
  image_url: string | null
  collection_location: string | null
  observation_date: string | null
}

// Filter state for the application
export interface FilterState {
  // Taxonomic cascade (advanced, hidden by default)
  family: string | null
  tribe: string | null
  genus: string | null
  // Primary filters (multi-select)
  species: string[]
  subspecies: string[]
  // Parallel filters
  mimicryRings: string[]
  statuses: SequencingStatus[]
  sources: DataSource[]
  country: string | null
  // Search
  camidSearch: string
  // Date range
  dateStart: string | null
  dateEnd: string | null
}

// UI state
export interface UIState {
  view: 'map' | 'table'
  selectedPointId: string | null
  sidebarOpen: boolean
  showAdvancedFilters: boolean
  showMimicryFilter: boolean
  showThumbnail: boolean
}

// Map viewport state
export interface ViewportState {
  center: [number, number] // [lng, lat]
  zoom: number
  bearing: number
  pitch: number
}

// Default filter state
export const defaultFilters: FilterState = {
  family: null,
  tribe: null,
  genus: null,
  species: [],
  subspecies: [],
  mimicryRings: [],
  statuses: [],
  sources: ['Sanger Institute'],
  country: null,
  camidSearch: '',
  dateStart: null,
  dateEnd: null,
}

// Default UI state
export const defaultUIState: UIState = {
  view: 'map',
  selectedPointId: null,
  sidebarOpen: true,
  showAdvancedFilters: false,
  showMimicryFilter: false,
  showThumbnail: true,
}

// Default viewport
export const defaultViewport: ViewportState = {
  center: [-60, -5],
  zoom: 4,
  bearing: 0,
  pitch: 0,
}
