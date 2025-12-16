import { useRef, useEffect, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { toPng, toJpeg } from 'html-to-image'
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
  const mapLoadedRef = useRef(false)
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
      mapLoadedRef.current = true

      // Click handler for points
      map.on('click', 'points-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const ids = e.features
            .map((f) => f.properties?.id as string)
            .filter((id): id is string => !!id)

          if (ids.length > 0) {
            const feature = e.features[0]
            const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
            setSelectedPoint(ids[0])
            options.onPointClick?.(ids.length === 1 ? ids[0] : ids, { lat, lng })
          }
        }
      })

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
      mapLoadedRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, []) // Only run once on mount

  // Add or update data source when geojson changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !geojson) return

    // Wait for map to be loaded
    const updateSource = () => {
      if (!map.isStyleLoaded()) {
        // If style not loaded yet, wait for it
        map.once('load', updateSource)
        return
      }

      const source = map.getSource('points-source') as maplibregl.GeoJSONSource

      if (source) {
        // Source exists, just update data
        source.setData(geojson)
      } else {
        // Source doesn't exist, create it with layer
        map.addSource('points-source', {
          type: 'geojson',
          data: geojson,
          cluster: false,
        })

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
            'circle-color': '#22c55e',
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.6,
          },
        })
      }
    }

    updateSource()
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

  // Export map as image
  const exportMapImage = useCallback(
    async (format: 'png' | 'jpeg' = 'png', filename?: string): Promise<void> => {
      const map = mapRef.current
      if (!map) {
        throw new Error('Map not initialized')
      }

      const container = map.getContainer()
      if (!container) {
        throw new Error('Map container not found')
      }

      const date = new Date().toISOString().split('T')[0]
      const finalFilename = filename || `ithomiini_map_${date}`

      try {
        const dataUrl =
          format === 'jpeg'
            ? await toJpeg(container, {
                quality: 0.95,
                backgroundColor: '#ffffff',
              })
            : await toPng(container, {
                pixelRatio: 2,
              })

        const link = document.createElement('a')
        link.download = `${finalFilename}.${format}`
        link.href = dataUrl
        link.click()
      } catch (err) {
        console.error('Map export failed:', err)
        throw err
      }
    },
    []
  )

  return {
    mapRef,
    flyTo,
    getMap,
    exportMapImage,
  }
}
