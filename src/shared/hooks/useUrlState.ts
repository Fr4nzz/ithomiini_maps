import { useEffect } from 'react'
import { useQueryStates, parseAsFloat, parseAsString, parseAsArrayOf } from 'nuqs'
import { useDataStore } from '@/features/data'

// URL state schema
const urlStateSchema = {
  // Viewport
  lat: parseAsFloat.withDefault(-5),
  lng: parseAsFloat.withDefault(-60),
  zoom: parseAsFloat.withDefault(4),
  // View
  view: parseAsString.withDefault('map'),
  // Selected species (multi-select)
  species: parseAsArrayOf(parseAsString, ',').withDefault([]),
}

export function useUrlState() {
  const [urlState, setUrlState] = useQueryStates(urlStateSchema, {
    history: 'push',
    shallow: false,
  })

  const viewport = useDataStore((s) => s.viewport)
  const setViewport = useDataStore((s) => s.setViewport)
  const view = useDataStore((s) => s.ui.view)
  const setView = useDataStore((s) => s.setView)
  const filters = useDataStore((s) => s.filters)
  const setFilters = useDataStore((s) => s.setFilters)

  // Initialize from URL on mount
  useEffect(() => {
    // Set viewport from URL
    if (urlState.lat !== viewport.center[1] || urlState.lng !== viewport.center[0]) {
      setViewport({
        center: [urlState.lng, urlState.lat],
        zoom: urlState.zoom,
      })
    }

    // Set view from URL
    if (urlState.view === 'map' || urlState.view === 'table') {
      if (urlState.view !== view) {
        setView(urlState.view)
      }
    }

    // Set species filter from URL
    if (urlState.species.length > 0 && urlState.species.join(',') !== filters.species.join(',')) {
      setFilters({ species: urlState.species })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Sync view to URL
  useEffect(() => {
    if (view !== urlState.view) {
      setUrlState({ view })
    }
  }, [view, urlState.view, setUrlState])

  // Sync viewport to URL (debounced by store moveend handler)
  useEffect(() => {
    const [lng, lat] = viewport.center
    const zoom = viewport.zoom

    // Only update if significantly different to avoid URL spam
    const latDiff = Math.abs(lat - urlState.lat)
    const lngDiff = Math.abs(lng - urlState.lng)
    const zoomDiff = Math.abs(zoom - urlState.zoom)

    if (latDiff > 0.001 || lngDiff > 0.001 || zoomDiff > 0.1) {
      setUrlState({
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        zoom: Math.round(zoom * 10) / 10,
      })
    }
  }, [viewport.center, viewport.zoom, urlState.lat, urlState.lng, urlState.zoom, setUrlState])

  // Sync species filter to URL
  useEffect(() => {
    const currentSpecies = filters.species.join(',')
    const urlSpecies = urlState.species.join(',')

    if (currentSpecies !== urlSpecies) {
      setUrlState({ species: filters.species.length > 0 ? filters.species : null })
    }
  }, [filters.species, urlState.species, setUrlState])

  return { urlState, setUrlState }
}
