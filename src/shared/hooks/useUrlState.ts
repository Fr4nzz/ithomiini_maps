import { useEffect, useRef } from 'react'
import {
  useQueryStates,
  parseAsFloat,
  parseAsString,
  parseAsArrayOf,
} from 'nuqs'
import { useDataStore } from '@/features/data'
import type { DataSource } from '@/features/data/types'
import { useDebounce } from './useDebounce'

// Valid data sources for type checking
const VALID_SOURCES: DataSource[] = ['Dore et al. (2025)', 'Sanger Institute', 'GBIF']

// URL state schema with all parameters
const urlStateSchema = {
  // Viewport (debounced)
  lat: parseAsFloat.withDefault(-5),
  lng: parseAsFloat.withDefault(-60),
  zoom: parseAsFloat.withDefault(4),
  bearing: parseAsFloat.withDefault(0),
  pitch: parseAsFloat.withDefault(0),

  // View
  view: parseAsString.withDefault('map'),

  // ColorBy setting
  colorBy: parseAsString.withDefault('source'),

  // Selected point for deep linking
  selected: parseAsString,

  // Taxonomy filters
  genus: parseAsString,
  species: parseAsArrayOf(parseAsString, ',').withDefault([]),
  subspecies: parseAsArrayOf(parseAsString, ',').withDefault([]),

  // Other filters
  mimicry: parseAsArrayOf(parseAsString, ',').withDefault([]),
  sources: parseAsArrayOf(parseAsString, ',').withDefault([]),
  country: parseAsString,
  camid: parseAsString,
  dateStart: parseAsString,
  dateEnd: parseAsString,
}

// Debounce delay for viewport updates (ms)
const VIEWPORT_DEBOUNCE_MS = 500

export function useUrlState() {
  const [urlState, setUrlState] = useQueryStates(urlStateSchema, {
    history: 'replace', // Use replace to avoid cluttering browser history
    shallow: false,
  })

  // Track if this is the initial mount
  const isInitialMount = useRef(true)
  const hasInitializedFromUrl = useRef(false)

  // Store state
  const viewport = useDataStore((s) => s.viewport)
  const setViewport = useDataStore((s) => s.setViewport)
  const view = useDataStore((s) => s.ui.view)
  const setView = useDataStore((s) => s.setView)
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)
  const colorBy = useDataStore((s) => s.colorBy)
  const setColorBy = useDataStore((s) => s.setColorBy)
  const selectedPointId = useDataStore((s) => s.ui.selectedPointId)
  const setSelectedPoint = useDataStore((s) => s.setSelectedPoint)

  // Debounce viewport for URL updates
  const debouncedViewport = useDebounce(viewport, VIEWPORT_DEBOUNCE_MS)

  // Initialize from URL on mount (runs once)
  useEffect(() => {
    if (hasInitializedFromUrl.current) return
    hasInitializedFromUrl.current = true

    // Set viewport from URL
    const urlCenter: [number, number] = [urlState.lng, urlState.lat]
    if (urlState.lat !== -5 || urlState.lng !== -60 || urlState.zoom !== 4) {
      setViewport({
        center: urlCenter,
        zoom: urlState.zoom,
        bearing: urlState.bearing,
        pitch: urlState.pitch,
      })
    }

    // Set view from URL
    if (urlState.view === 'map' || urlState.view === 'table') {
      setView(urlState.view)
    }

    // Set colorBy from URL
    const validColorBy = ['species', 'subspecies', 'genus', 'mimicry_ring', 'sequencing_status', 'source']
    if (urlState.colorBy && validColorBy.includes(urlState.colorBy)) {
      setColorBy(urlState.colorBy as typeof colorBy)
    }

    // Set selected point from URL
    if (urlState.selected) {
      setSelectedPoint(urlState.selected)
    }

    // Set filters from URL
    const urlFilters: Parameters<typeof setFilters>[0] = {}

    if (urlState.genus) {
      urlFilters.genus = urlState.genus
    }
    if (urlState.species.length > 0) {
      urlFilters.species = urlState.species
    }
    if (urlState.subspecies.length > 0) {
      urlFilters.subspecies = urlState.subspecies
    }
    if (urlState.mimicry.length > 0) {
      urlFilters.mimicryRings = urlState.mimicry
    }
    if (urlState.sources.length > 0) {
      // Filter to only valid DataSource values
      urlFilters.sources = urlState.sources.filter(
        (s): s is DataSource => VALID_SOURCES.includes(s as DataSource)
      )
    }
    if (urlState.country) {
      urlFilters.country = urlState.country
    }
    if (urlState.camid) {
      urlFilters.camidSearch = urlState.camid
    }
    if (urlState.dateStart) {
      urlFilters.dateStart = urlState.dateStart
    }
    if (urlState.dateEnd) {
      urlFilters.dateEnd = urlState.dateEnd
    }

    if (Object.keys(urlFilters).length > 0) {
      setFilters(urlFilters)
    }

    isInitialMount.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Sync view to URL
  useEffect(() => {
    if (isInitialMount.current) return
    if (view !== urlState.view) {
      setUrlState({ view })
    }
  }, [view, urlState.view, setUrlState])

  // Sync colorBy to URL
  useEffect(() => {
    if (isInitialMount.current) return
    if (colorBy !== urlState.colorBy) {
      setUrlState({ colorBy })
    }
  }, [colorBy, urlState.colorBy, setUrlState])

  // Sync selected point to URL
  useEffect(() => {
    if (isInitialMount.current) return
    if (selectedPointId !== urlState.selected) {
      setUrlState({ selected: selectedPointId || null })
    }
  }, [selectedPointId, urlState.selected, setUrlState])

  // Sync debounced viewport to URL
  useEffect(() => {
    if (isInitialMount.current) return

    const [lng, lat] = debouncedViewport.center
    const { zoom, bearing, pitch } = debouncedViewport

    // Only update if significantly different to avoid URL spam
    const latDiff = Math.abs(lat - urlState.lat)
    const lngDiff = Math.abs(lng - urlState.lng)
    const zoomDiff = Math.abs(zoom - urlState.zoom)
    const bearingDiff = Math.abs(bearing - urlState.bearing)
    const pitchDiff = Math.abs(pitch - urlState.pitch)

    if (latDiff > 0.001 || lngDiff > 0.001 || zoomDiff > 0.1 || bearingDiff > 0.5 || pitchDiff > 0.5) {
      setUrlState({
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        zoom: Math.round(zoom * 10) / 10,
        bearing: Math.round(bearing * 10) / 10,
        pitch: Math.round(pitch * 10) / 10,
      })
    }
  }, [debouncedViewport, urlState.lat, urlState.lng, urlState.zoom, urlState.bearing, urlState.pitch, setUrlState])

  // Sync genus filter to URL
  useEffect(() => {
    if (isInitialMount.current) return
    if (filters.genus !== urlState.genus) {
      setUrlState({ genus: filters.genus || null })
    }
  }, [filters.genus, urlState.genus, setUrlState])

  // Sync species filter to URL
  useEffect(() => {
    if (isInitialMount.current) return
    const currentSpecies = filters.species.join(',')
    const urlSpecies = urlState.species.join(',')

    if (currentSpecies !== urlSpecies) {
      setUrlState({ species: filters.species.length > 0 ? filters.species : null })
    }
  }, [filters.species, urlState.species, setUrlState])

  // Sync subspecies filter to URL
  useEffect(() => {
    if (isInitialMount.current) return
    const currentSubspecies = filters.subspecies.join(',')
    const urlSubspecies = urlState.subspecies.join(',')

    if (currentSubspecies !== urlSubspecies) {
      setUrlState({ subspecies: filters.subspecies.length > 0 ? filters.subspecies : null })
    }
  }, [filters.subspecies, urlState.subspecies, setUrlState])

  // Sync mimicry rings to URL
  useEffect(() => {
    if (isInitialMount.current) return
    const currentMimicry = filters.mimicryRings.join(',')
    const urlMimicry = urlState.mimicry.join(',')

    if (currentMimicry !== urlMimicry) {
      setUrlState({ mimicry: filters.mimicryRings.length > 0 ? filters.mimicryRings : null })
    }
  }, [filters.mimicryRings, urlState.mimicry, setUrlState])

  // Sync sources to URL
  useEffect(() => {
    if (isInitialMount.current) return
    const currentSources = filters.sources.join(',')
    const urlSources = urlState.sources.join(',')

    if (currentSources !== urlSources) {
      setUrlState({ sources: filters.sources.length > 0 ? filters.sources : null })
    }
  }, [filters.sources, urlState.sources, setUrlState])

  // Sync country to URL
  useEffect(() => {
    if (isInitialMount.current) return
    if (filters.country !== urlState.country) {
      setUrlState({ country: filters.country || null })
    }
  }, [filters.country, urlState.country, setUrlState])

  // Sync camid search to URL
  useEffect(() => {
    if (isInitialMount.current) return
    if (filters.camidSearch !== urlState.camid) {
      setUrlState({ camid: filters.camidSearch || null })
    }
  }, [filters.camidSearch, urlState.camid, setUrlState])

  // Sync date range to URL
  useEffect(() => {
    if (isInitialMount.current) return
    if (filters.dateStart !== urlState.dateStart) {
      setUrlState({ dateStart: filters.dateStart || null })
    }
  }, [filters.dateStart, urlState.dateStart, setUrlState])

  useEffect(() => {
    if (isInitialMount.current) return
    if (filters.dateEnd !== urlState.dateEnd) {
      setUrlState({ dateEnd: filters.dateEnd || null })
    }
  }, [filters.dateEnd, urlState.dateEnd, setUrlState])

  return { urlState, setUrlState }
}
