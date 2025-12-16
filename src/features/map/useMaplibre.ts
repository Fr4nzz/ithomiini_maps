import { useRef, useEffect, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import Spiderfy from '@nazka/map-gl-js-spiderfy'
import { useDataStore, useFilteredGeoJSON } from '@/features/data'

// Map style configurations
const MAP_STYLES = {
  carto_light: {
    name: 'Carto Positron',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
  carto_dark: {
    name: 'Carto Dark Matter',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
} as const

interface UseMaplibreOptions {
  onMapReady?: (map: maplibregl.Map) => void
  onPointClick?: (ids: string | string[], coordinates: { lat: number; lng: number }) => void
}

export function useMaplibre(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseMaplibreOptions = {}
) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const spiderfyRef = useRef<Spiderfy | null>(null)
  const viewport = useDataStore((s) => s.viewport)
  const setViewport = useDataStore((s) => s.setViewport)
  const setSelectedPoint = useDataStore((s) => s.setSelectedPoint)
  const geojson = useFilteredGeoJSON()

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES.carto_light.style,
      center: viewport.center,
      zoom: viewport.zoom,
      bearing: viewport.bearing,
      pitch: viewport.pitch,
      attributionControl: false,
      maxZoom: 18,
      minZoom: 2,
      canvasContextAttributes: {
        preserveDrawingBuffer: true, // Required for canvas export
      },
    })

    // Add controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }),
      'bottom-right'
    )
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left'
    )

    // Store viewport changes
    map.on('moveend', () => {
      const center = map.getCenter()
      setViewport({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      })
    })

    // Handle map load
    map.on('load', () => {
      addDataSource(map)

      // Initialize spiderfy for overlapping points
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spiderfyRef.current = new Spiderfy(map as any, {
        onLeafClick: (feature: GeoJSON.Feature) => {
          const id = feature.properties?.id as string
          if (id) {
            const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
            setSelectedPoint(id)
            options.onPointClick?.(id, { lat, lng })
          }
        },
        minZoomLevel: 12,
        zoomIncrement: 2,
        closeOnLeafClick: true,
        circleFootSeparation: 40,
        spiralFootSeparation: 30,
        spiralLengthStart: 20,
        spiralLengthFactor: 5,
      })

      // Apply spiderfy to points layer
      spiderfyRef.current.applyTo('points-layer')

      options.onMapReady?.(map)
    })

    // Change cursor on hover
    map.on('mouseenter', 'points-layer', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'points-layer', () => {
      map.getCanvas().style.cursor = ''
    })

    mapRef.current = map

    return () => {
      spiderfyRef.current?.unsppidefyAll?.()
      spiderfyRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, []) // Only run once on mount

  // Add data source and layers
  const addDataSource = useCallback((map: maplibregl.Map) => {
    if (!geojson) return

    // Add source
    map.addSource('points-source', {
      type: 'geojson',
      data: geojson,
      cluster: false,
    })

    // Add points layer
    map.addLayer({
      id: 'points-layer',
      type: 'circle',
      source: 'points-source',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 3,
          6, 5,
          10, 8,
          14, 12,
        ],
        'circle-color': '#22c55e', // lime-500
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.6,
      },
    })
  }, [geojson])

  // Update data when geojson changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !geojson) return

    const source = map.getSource('points-source') as maplibregl.GeoJSONSource
    if (source) {
      source.setData(geojson)
    }
  }, [geojson])

  // Fly to point
  const flyTo = useCallback((lng: number, lat: number, zoom = 12) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom,
      duration: 1500,
    })
  }, [])

  // Get map instance
  const getMap = useCallback(() => mapRef.current, [])

  return {
    mapRef,
    flyTo,
    getMap,
  }
}
