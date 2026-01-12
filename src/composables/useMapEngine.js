import { ref, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import { useDataStore } from '../stores/data'
import { ASPECT_RATIOS } from '../utils/constants'
import { computeClusterStats, haversineDistance } from '../utils/clusterStats'

// Map style configurations - organized by theme
export const MAP_STYLES = {
  // Day themes
  light: {
    name: 'Light',
    theme: 'day',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  },
  'stadia-smooth': {
    name: 'Smooth',
    theme: 'day',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json'
  },
  terrain: {
    name: 'Terrain',
    theme: 'day',
    style: {
      version: 8,
      sources: {
        'osm-terrain': {
          type: 'raster',
          tiles: [
            'https://tile.opentopomap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenTopoMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-terrain-layer',
          type: 'raster',
          source: 'osm-terrain',
          minzoom: 0,
          maxzoom: 17
        }
      ]
    }
  },
  'stadia-terrain': {
    name: 'Stamen Terrain',
    theme: 'day',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/stamen_terrain.json'
  },
  streets: {
    name: 'Streets',
    theme: 'day',
    style: {
      version: 8,
      sources: {
        'osm-streets': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-streets-layer',
          type: 'raster',
          source: 'osm-streets',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    }
  },
  satellite: {
    name: 'Satellite',
    theme: 'day',
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics'
        }
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    }
  },
  // Night themes
  dark: {
    name: 'Dark',
    theme: 'night',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  },
  'stadia-dark': {
    name: 'Smooth Dark',
    theme: 'night',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'
  },
  'stadia-toner': {
    name: 'Toner',
    theme: 'night',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/stamen_toner.json'
  }
}

// Get styles grouped by theme
export const getStylesByTheme = () => {
  const day = []
  const night = []

  Object.entries(MAP_STYLES).forEach(([key, config]) => {
    const item = { key, ...config }
    if (config.theme === 'night') {
      night.push(item)
    } else {
      day.push(item)
    }
  })

  return { day, night }
}

// Location search composable
export function useLocationSearch(map) {
  const searchQuery = ref('')
  const searchResults = ref([])
  const isSearching = ref(false)
  const showSearchResults = ref(false)
  const searchInputRef = ref(null)
  let searchDebounceTimer = null

  // Geocode using Nominatim (OpenStreetMap)
  const searchLocation = async (query) => {
    if (!query || query.length < 2) {
      searchResults.value = []
      return
    }

    isSearching.value = true

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: query,
          format: 'json',
          limit: '8',
          addressdetails: '1'
        }),
        {
          headers: {
            'Accept-Language': 'en'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        searchResults.value = data.map(item => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          importance: item.importance,
          boundingbox: item.boundingbox
        }))
        showSearchResults.value = searchResults.value.length > 0
      }
    } catch (error) {
      console.error('Geocoding error:', error)
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }

  // Debounced search handler
  const onSearchInput = () => {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      searchLocation(searchQuery.value)
    }, 300)
  }

  // Select a search result and fly to location
  const selectSearchResult = (result) => {
    if (!map.value) return

    showSearchResults.value = false
    searchQuery.value = ''

    // If we have a bounding box, use fitBounds for better framing
    if (result.boundingbox) {
      const [south, north, west, east] = result.boundingbox.map(parseFloat)
      map.value.fitBounds(
        [[west, south], [east, north]],
        { padding: 50, maxZoom: 14, duration: 1500 }
      )
    } else {
      // Otherwise just fly to the point
      map.value.flyTo({
        center: [result.lng, result.lat],
        zoom: 12,
        duration: 1500
      })
    }
  }

  // Close search results when clicking outside
  const handleClickOutside = (event) => {
    if (searchInputRef.value && !searchInputRef.value.contains(event.target)) {
      showSearchResults.value = false
    }
  }

  // Clear search
  const clearSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
    showSearchResults.value = false
  }

  // Cleanup function
  const cleanup = () => {
    clearTimeout(searchDebounceTimer)
  }

  return {
    searchQuery,
    searchResults,
    isSearching,
    showSearchResults,
    searchInputRef,
    onSearchInput,
    selectSearchResult,
    handleClickOutside,
    clearSearch,
    cleanup
  }
}

// Export preview composable
export function useExportPreview(containerSize) {
  const store = useDataStore()

  // Computed transform origin for legend based on position
  const legendTransformOrigin = computed(() => {
    const pos = store.legendSettings.position
    if (pos === 'top-left') return 'top left'
    if (pos === 'top-right') return 'top right'
    if (pos === 'bottom-left') return 'bottom left'
    if (pos === 'bottom-right') return 'bottom right'
    return 'bottom left'
  })

  // Calculate the export hole position as percentages
  const exportHolePosition = computed(() => {
    if (!store.exportSettings.enabled) {
      return { x: 10, y: 10, width: 80, height: 80 }
    }

    const ratio = store.exportSettings.aspectRatio
    let targetWidth, targetHeight

    if (ratio === 'custom') {
      targetWidth = store.exportSettings.customWidth
      targetHeight = store.exportSettings.customHeight
    } else if (ASPECT_RATIOS[ratio]) {
      targetWidth = ASPECT_RATIOS[ratio].width
      targetHeight = ASPECT_RATIOS[ratio].height
    } else {
      return { x: 10, y: 10, width: 80, height: 80 }
    }

    const targetAspectRatio = targetWidth / targetHeight

    // Use actual container dimensions for accurate calculation
    const containerW = containerSize.value.width || 1600
    const containerH = containerSize.value.height || 900
    const containerAspectRatio = containerW / containerH

    // Use 92% of container as maximum (leaving small margin)
    const maxPercent = 92

    let holeWidthPercent, holeHeightPercent

    if (targetAspectRatio > containerAspectRatio) {
      // Target is wider than container - constrained by width
      holeWidthPercent = maxPercent
      // Calculate height based on the width and target aspect ratio
      holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
    } else {
      // Target is taller than container - constrained by height
      holeHeightPercent = maxPercent
      // Calculate width based on the height and target aspect ratio
      holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio
    }

    // Center the hole
    const x = (100 - holeWidthPercent) / 2
    const y = (100 - holeHeightPercent) / 2

    return {
      x: Math.max(2, x),
      y: Math.max(2, y),
      width: Math.min(96, holeWidthPercent),
      height: Math.min(96, holeHeightPercent)
    }
  })

  return {
    legendTransformOrigin,
    exportHolePosition
  }
}

// Scatter visualization helpers
export function useScatterVisualization(map) {
  const store = useDataStore()

  // Generate a circle polygon approximation for a given center and radius
  const generateCirclePolygon = (centerLng, centerLat, radiusKm, points = 64) => {
    const coords = []
    const kmPerDegreeLat = 111.32
    const kmPerDegreeLng = 111.32 * Math.cos(centerLat * Math.PI / 180)

    for (let i = 0; i <= points; i++) {
      const angle = (2 * Math.PI * i) / points
      const latOffset = (radiusKm / kmPerDegreeLat) * Math.cos(angle)
      const lngOffset = (radiusKm / kmPerDegreeLng) * Math.sin(angle)
      coords.push([centerLng + lngOffset, centerLat + latOffset])
    }

    return coords
  }

  // Build GeoJSON for scatter visualization (circle polygons only)
  const buildScatterVisualizationGeoJSON = () => {
    const data = store.scatterVisualizationData

    // Build circles FeatureCollection
    const circleFeatures = data.circles.map((circle, index) => ({
      type: 'Feature',
      properties: { id: `circle-${index}` },
      geometry: {
        type: 'Polygon',
        coordinates: [generateCirclePolygon(circle.center[0], circle.center[1], circle.radiusKm)]
      }
    }))

    return {
      circles: { type: 'FeatureCollection', features: circleFeatures }
    }
  }

  // Add or update scatter visualization layers (circles only, no lines)
  const updateScatterVisualization = () => {
    if (!map.value || !map.value.isStyleLoaded()) return

    const layerIds = ['scatter-circles-fill', 'scatter-circles-outline']
    const sourceIds = ['scatter-circles-source']

    // Remove existing layers and sources
    layerIds.forEach(id => {
      if (map.value.getLayer(id)) map.value.removeLayer(id)
    })
    sourceIds.forEach(id => {
      if (map.value.getSource(id)) map.value.removeSource(id)
    })

    // Only add if scatter is enabled and there's data
    if (!store.scatterOverlappingPoints) return

    const geoJSON = buildScatterVisualizationGeoJSON()

    if (geoJSON.circles.features.length === 0) return

    // Add circles source
    map.value.addSource('scatter-circles-source', {
      type: 'geojson',
      data: geoJSON.circles
    })

    // Try to add below points layer if it exists, otherwise just add
    const beforeLayer = map.value.getLayer('points-layer') ? 'points-layer' : undefined

    // Add circle fill layer (semi-transparent)
    map.value.addLayer({
      id: 'scatter-circles-fill',
      type: 'fill',
      source: 'scatter-circles-source',
      paint: {
        'fill-color': 'rgba(59, 130, 246, 0.08)'
      }
    }, beforeLayer)

    // Add circle outline layer (dashed line)
    map.value.addLayer({
      id: 'scatter-circles-outline',
      type: 'line',
      source: 'scatter-circles-source',
      paint: {
        'line-color': 'rgba(59, 130, 246, 0.3)',
        'line-width': 1.5,
        'line-dasharray': [4, 4]
      }
    }, beforeLayer)
  }

  return {
    updateScatterVisualization
  }
}

// Data layer management
export function useDataLayer(map, options = {}) {
  const store = useDataStore()
  const { onShowPopup } = options

  // Hover popup for cluster preview
  let clusterHoverPopup = null

  // Track if event handlers are registered (to prevent duplicates)
  let clusterHandlersRegistered = false
  let pointsHandlersRegistered = false

  // Generate a circle polygon for geographic radius display
  const generateGeoCircle = (centerLng, centerLat, radiusKm, points = 64) => {
    const coords = []
    const kmPerDegreeLat = 111.32
    const kmPerDegreeLng = 111.32 * Math.cos(centerLat * Math.PI / 180)

    for (let i = 0; i <= points; i++) {
      const angle = (2 * Math.PI * i) / points
      const latOffset = (radiusKm / kmPerDegreeLat) * Math.cos(angle)
      const lngOffset = (radiusKm / kmPerDegreeLng) * Math.sin(angle)
      coords.push([centerLng + lngOffset, centerLat + latOffset])
    }

    return coords
  }

  // Update or create the cluster extent circle with actual geographic radius
  const updateClusterExtentCircle = (centerLat, centerLng, radiusKm) => {
    if (!map.value || !map.value.isStyleLoaded()) return

    // Remove existing dynamic extent layer if present
    if (map.value.getLayer('cluster-extent-dynamic')) {
      map.value.removeLayer('cluster-extent-dynamic')
    }
    if (map.value.getLayer('cluster-extent-dynamic-outline')) {
      map.value.removeLayer('cluster-extent-dynamic-outline')
    }
    if (map.value.getSource('cluster-extent-dynamic-source')) {
      map.value.removeSource('cluster-extent-dynamic-source')
    }

    // Don't draw if radius is 0 or very small
    if (radiusKm < 0.1) return

    // Create GeoJSON circle polygon
    const circleCoords = generateGeoCircle(centerLng, centerLat, radiusKm)
    const circleGeoJSON = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoords]
        }
      }]
    }

    // Add source
    map.value.addSource('cluster-extent-dynamic-source', {
      type: 'geojson',
      data: circleGeoJSON
    })

    // Add fill layer (semi-transparent)
    map.value.addLayer({
      id: 'cluster-extent-dynamic',
      type: 'fill',
      source: 'cluster-extent-dynamic-source',
      paint: {
        'fill-color': 'rgba(74, 222, 128, 0.1)',
        'fill-opacity': 1
      }
    }, 'clusters')

    // Add outline layer
    map.value.addLayer({
      id: 'cluster-extent-dynamic-outline',
      type: 'line',
      source: 'cluster-extent-dynamic-source',
      paint: {
        'line-color': 'rgba(74, 222, 128, 0.5)',
        'line-width': 2
      }
    }, 'clusters')
  }

  // Clear the dynamic cluster extent circle
  const clearClusterExtentCircle = () => {
    if (!map.value) return

    if (map.value.getLayer('cluster-extent-dynamic')) {
      map.value.removeLayer('cluster-extent-dynamic')
    }
    if (map.value.getLayer('cluster-extent-dynamic-outline')) {
      map.value.removeLayer('cluster-extent-dynamic-outline')
    }
    if (map.value.getSource('cluster-extent-dynamic-source')) {
      map.value.removeSource('cluster-extent-dynamic-source')
    }
  }

  const addDataLayer = (layerOptions = {}) => {
    const { skipZoom = false } = layerOptions

    console.log('🗺️ addDataLayer called', { skipZoom, clusteringEnabled: store.clusteringEnabled })

    if (!map.value) return

    // Remove existing layers/sources if they exist
    const layersToRemove = [
      'clusters',
      'cluster-count',
      'cluster-extent-dynamic',
      'cluster-extent-dynamic-outline',
      'points-layer',
      'points-highlight'
    ]
    layersToRemove.forEach(layer => {
      if (map.value.getLayer(layer)) map.value.removeLayer(layer)
    })
    if (map.value.getSource('points-source')) map.value.removeSource('points-source')
    if (map.value.getSource('cluster-extent-dynamic-source')) map.value.removeSource('cluster-extent-dynamic-source')

    const geojson = store.displayGeoJSON
    if (!geojson) return

    const pointCount = geojson.features.length
    const shouldCluster = store.clusteringEnabled
    const settings = store.clusterSettings

    // Use the pixel radius directly from settings
    const clusterRadiusPixels = settings.radiusPixels

    // Add source - use store settings for clustering
    map.value.addSource('points-source', {
      type: 'geojson',
      data: geojson,
      cluster: shouldCluster,
      clusterMaxZoom: 14,
      clusterRadius: clusterRadiusPixels,
      clusterMinPoints: 2
    })

    // Only add cluster layers if clustering is enabled
    if (shouldCluster) {
      // Cluster circles - sized by point count
      map.value.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'points-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            12,      // 12px for count < 20
            20, 16,  // 16px for count >= 20
            50, 20,  // 20px for count >= 50
            100, 25, // 25px for count >= 100
            500, 32  // 32px for count >= 500
          ],
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#4ade80',   // Green for small clusters
            20, '#22d3ee', // Cyan
            50, '#facc15', // Yellow
            100, '#fb923c', // Orange
            500, '#ef4444'  // Red for large clusters
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9
        }
      })

      // Note: cluster-extent circles are now drawn dynamically when clicking a cluster
      // using actual geographic radius instead of pixel-based radius

      // Cluster count labels
      map.value.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'points-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#1a1a2e'
        }
      })
    }

    // Individual points
    const colorMap = store.activeColorMap
    const colorAttr = store.colorByAttribute
    const style = store.mapStyle

    // Build MapLibre match expression for colors
    const colorExpression = ['match', ['get', colorAttr]]
    Object.entries(colorMap).forEach(([value, color]) => {
      colorExpression.push(value, color)
    })
    colorExpression.push('#6b7280') // default gray

    // Calculate point sizes based on style settings
    const baseSize = style.pointSize
    const sizeExpression = [
      'interpolate', ['linear'], ['zoom'],
      3, baseSize * 0.375,
      6, baseSize * 0.625,
      10, baseSize,
      14, baseSize * 1.5
    ]

    map.value.addLayer({
      id: 'points-layer',
      type: 'circle',
      source: 'points-source',
      filter: shouldCluster ? ['!', ['has', 'point_count']] : ['all'],
      paint: {
        'circle-radius': sizeExpression,
        'circle-color': colorExpression,
        'circle-opacity': style.fillOpacity,
        'circle-stroke-width': [
          'interpolate', ['linear'], ['zoom'],
          3, style.borderWidth * 0.33,
          10, style.borderWidth
        ],
        'circle-stroke-color': style.borderColor,
        'circle-stroke-opacity': style.borderOpacity
      }
    })

    // Highlight layer (for hover on individual points)
    const highlightSizeExpression = [
      'interpolate', ['linear'], ['zoom'],
      3, baseSize * 0.75,
      6, baseSize * 1.25,
      10, baseSize * 1.75,
      14, baseSize * 2.25
    ]

    map.value.addLayer({
      id: 'points-highlight',
      type: 'circle',
      source: 'points-source',
      filter: shouldCluster
        ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']]
        : ['==', ['get', 'id'], ''],
      paint: {
        'circle-radius': highlightSizeExpression,
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    })

    // Cluster event handlers
    if (shouldCluster) {
      if (clusterHandlersRegistered) {
        map.value.off('click', 'clusters')
        map.value.off('mouseenter', 'clusters')
        map.value.off('mouseleave', 'clusters')
      }
      clusterHandlersRegistered = true

      // Cluster click - show enhanced popup with all cluster points
      map.value.on('click', 'clusters', async (e) => {
        console.log('🔵 Cluster clicked')
        const features = map.value.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        if (!features.length) {
          console.log('🔵 No cluster features found at click point')
          return
        }

        const cluster = features[0]
        const coords = cluster.geometry.coordinates
        const clusterId = cluster.properties.cluster_id
        const pointCount = cluster.properties.point_count

        console.log(`🔵 Cluster ID: ${clusterId}, Point count: ${pointCount}, Coords:`, coords)

        const clusterLng = coords[0]
        const clusterLat = coords[1]

        // Helper function to find cluster points using proximity search
        const findClusterPointsByProximity = () => {
          console.log('🔵 Using proximity-based search as fallback')
          const allPoints = store.displayGeoJSON?.features || []
          const zoom = map.value.getZoom()
          const clusterRadiusPx = store.clusterSettings.radiusPixels

          // Calculate search radius based on zoom level
          // At equator: 1 pixel = 40075km / (256 * 2^zoom)
          // Adjust for latitude
          const metersPerPixel = 40075000 * Math.cos(clusterLat * Math.PI / 180) / (256 * Math.pow(2, zoom))
          const searchRadiusKm = (clusterRadiusPx * metersPerPixel / 1000) * 2.0 // 2x to ensure we catch all candidates

          console.log(`🔵 Search radius: ${searchRadiusKm.toFixed(2)} km at zoom ${zoom.toFixed(1)}`)

          // Find points and their distances from cluster center
          const pointsWithDistance = allPoints.map(f => {
            const [lng, lat] = f.geometry.coordinates
            const distKm = haversineDistance(clusterLat, clusterLng, lat, lng)
            return { feature: f, distance: distKm }
          }).filter(p => p.distance <= searchRadiusKm)

          // Sort by distance (closest first) and take only pointCount points
          pointsWithDistance.sort((a, b) => a.distance - b.distance)
          const limitedPoints = pointsWithDistance.slice(0, pointCount)

          console.log(`🔵 Found ${pointsWithDistance.length} candidates, limited to ${limitedPoints.length} (expected ${pointCount})`)

          return limitedPoints.map(p => p.feature)
        }

        // Use MapLibre's getClusterLeaves with short timeout, fallback to proximity search
        const source = map.value.getSource('points-source')
        let clusterFeatures = null

        if (source && typeof source.getClusterLeaves === 'function') {
          console.log('🔵 Trying getClusterLeaves...')

          try {
            clusterFeatures = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.log('🔵 getClusterLeaves timed out, using fallback')
                resolve(null) // Resolve with null to trigger fallback
              }, 500) // Short 500ms timeout

              source.getClusterLeaves(clusterId, pointCount, 0, (error, features) => {
                clearTimeout(timeout)
                if (error) {
                  console.log('🔵 getClusterLeaves error, using fallback:', error.message)
                  resolve(null)
                } else {
                  console.log(`🔵 getClusterLeaves returned ${features?.length || 0} features`)
                  resolve(features)
                }
              })
            })
          } catch (err) {
            console.log('🔵 getClusterLeaves exception, using fallback')
            clusterFeatures = null
          }
        }

        // Fallback to proximity search if getClusterLeaves didn't work
        if (!clusterFeatures || clusterFeatures.length === 0) {
          clusterFeatures = findClusterPointsByProximity()
        }

        if (!clusterFeatures || clusterFeatures.length === 0) {
          console.log('🔵 No cluster features found')
          return
        }

        const clusterPoints = clusterFeatures.map(f => f.properties)
        console.log(`🔵 Cluster has ${clusterPoints.length} points`)

        if (clusterPoints.length > 0 && onShowPopup) {
          // Compute cluster statistics including geographic radius
          const clusterStats = computeClusterStats(clusterFeatures, clusterLat, clusterLng)
          console.log('🔵 Cluster stats:', clusterStats)

          // Update the cluster extent circle to show actual geographic radius
          updateClusterExtentCircle(clusterLat, clusterLng, clusterStats?.radiusKm || 0)

          onShowPopup({
            type: 'cluster',
            coordinates: { lat: clusterLat, lng: clusterLng },
            lngLat: coords,
            points: clusterPoints,
            isCluster: true,
            clusterStats
          })
        } else {
          console.log('🔵 onShowPopup not available or no points:', { hasCallback: !!onShowPopup, pointCount: clusterPoints.length })
        }
      })

      // Cluster hover
      map.value.on('mouseenter', 'clusters', () => {
        map.value.getCanvas().style.cursor = 'pointer'
      })

      map.value.on('mouseleave', 'clusters', () => {
        map.value.getCanvas().style.cursor = ''
      })
    }

    // Individual point click
    map.value.off('click', 'points-layer')
    map.value.on('click', 'points-layer', (e) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const props = feature.properties
      const coords = feature.geometry.coordinates.slice()

      // Check if point was scattered - use original coordinates for grouping
      const lat = props._originalLat || coords[1]
      const lng = props._originalLng || coords[0]

      // Check if this is a scattered point with subspecies info
      const isScattered = props._isScattered
      const scatteredSpecies = props._scatteredSpecies
      const scatteredSubspecies = props._scatteredSubspecies

      // Get all points at this location
      const pointsAtLocation = store.getPointsAtCoordinates(lat, lng)

      if (onShowPopup) {
        onShowPopup({
          type: 'point',
          coordinates: { lat, lng },
          lngLat: coords,
          points: pointsAtLocation.length > 0 ? pointsAtLocation : [props],
          initialSpecies: isScattered ? scatteredSpecies : null,
          initialSubspecies: isScattered ? scatteredSubspecies : null
        })
      }
    })

    // Points layer hover effects
    if (!pointsHandlersRegistered) {
      pointsHandlersRegistered = true

      map.value.on('mouseenter', 'points-layer', (e) => {
        map.value.getCanvas().style.cursor = 'pointer'

        if (e.features && e.features.length > 0) {
          const id = e.features[0].properties.id
          const isClustering = store.clusteringEnabled
          const filter = isClustering
            ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], id]]
            : ['==', ['get', 'id'], id]
          map.value.setFilter('points-highlight', filter)
        }
      })

      map.value.on('mouseleave', 'points-layer', () => {
        map.value.getCanvas().style.cursor = ''
        const isClustering = store.clusteringEnabled
        const filter = isClustering
          ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']]
          : ['==', ['get', 'id'], '']
        map.value.setFilter('points-highlight', filter)
      })
    }

    // Fit bounds to data
    if (!skipZoom) {
      fitBoundsToData(geojson)
    }

    // Log clustering status
    if (shouldCluster) {
      console.log(`📍 ${pointCount} points loaded. Clustering: ON (radius: ${clusterRadiusPixels}px)`)
    } else {
      console.log(`📍 ${pointCount} points loaded. Clustering: OFF`)
    }
  }

  const fitBoundsToData = (geojson) => {
    if (!geojson || !geojson.features || geojson.features.length === 0) return

    // If only one point, just center on it
    if (geojson.features.length === 1) {
      const coords = geojson.features[0].geometry.coordinates
      map.value.flyTo({
        center: coords,
        zoom: 8,
        duration: 1000
      })
      return
    }

    const bounds = new maplibregl.LngLatBounds()

    geojson.features.forEach(f => {
      bounds.extend(f.geometry.coordinates)
    })

    map.value.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 12,
      duration: 1000
    })
  }

  return {
    addDataLayer,
    fitBoundsToData,
    clearClusterExtentCircle
  }
}

// Style switcher
export function useStyleSwitcher(map, addDataLayer) {
  const currentStyle = ref('dark')

  const switchStyle = (styleName) => {
    if (!map.value || !MAP_STYLES[styleName]) return

    // Save current view state before style change
    const center = map.value.getCenter()
    const zoom = map.value.getZoom()
    const bearing = map.value.getBearing()
    const pitch = map.value.getPitch()

    currentStyle.value = styleName
    const styleConfig = MAP_STYLES[styleName]

    map.value.setStyle(styleConfig.style)

    // Wait for style to be fully loaded
    const waitForStyleAndAddLayer = () => {
      if (map.value.isStyleLoaded()) {
        map.value.jumpTo({ center, zoom, bearing, pitch })
        addDataLayer({ skipZoom: true })
      } else {
        setTimeout(waitForStyleAndAddLayer, 50)
      }
    }

    map.value.once('style.load', () => {
      setTimeout(waitForStyleAndAddLayer, 100)
    })

    map.value.once('idle', () => {
      if (!map.value.getSource('points-source')) {
        map.value.jumpTo({ center, zoom, bearing, pitch })
        addDataLayer({ skipZoom: true })
      }
    })
  }

  return {
    currentStyle,
    switchStyle
  }
}

// Scale bar helper
export function useScaleBar(map) {
  const scaleBarText = ref('500 km')

  const updateScaleBar = () => {
    if (!map.value) return

    try {
      const zoom = map.value.getZoom()
      const center = map.value.getCenter()
      const lat = center.lat

      // Calculate meters per pixel at this latitude and zoom
      const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)

      // Scale bar is approximately 100px wide
      const distance = metersPerPixel * 100

      // Choose appropriate unit and round to nice numbers
      if (distance >= 1000) {
        const km = distance / 1000
        if (km >= 500) scaleBarText.value = Math.round(km / 100) * 100 + ' km'
        else if (km >= 50) scaleBarText.value = Math.round(km / 10) * 10 + ' km'
        else if (km >= 5) scaleBarText.value = Math.round(km) + ' km'
        else scaleBarText.value = km.toFixed(1) + ' km'
      } else {
        if (distance >= 100) scaleBarText.value = Math.round(distance / 10) * 10 + ' m'
        else scaleBarText.value = Math.round(distance) + ' m'
      }
    } catch (e) {
      scaleBarText.value = '—'
    }
  }

  return {
    scaleBarText,
    updateScaleBar
  }
}

// Country boundaries overlay
// Uses Natural Earth data hosted on GitHub
const BOUNDARIES_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

export function useCountryBoundaries(map) {
  const showBoundaries = ref(false)
  const boundariesLoaded = ref(false)
  let boundariesData = null

  const loadBoundaries = async () => {
    if (boundariesData) return boundariesData

    try {
      const response = await fetch(BOUNDARIES_URL)
      boundariesData = await response.json()
      boundariesLoaded.value = true
      return boundariesData
    } catch (error) {
      console.error('Failed to load country boundaries:', error)
      return null
    }
  }

  const addBoundariesLayer = async () => {
    if (!map.value || !map.value.isStyleLoaded()) return

    // Remove existing layers if present
    if (map.value.getLayer('country-boundaries-fill')) {
      map.value.removeLayer('country-boundaries-fill')
    }
    if (map.value.getLayer('country-boundaries-line')) {
      map.value.removeLayer('country-boundaries-line')
    }
    if (map.value.getSource('country-boundaries')) {
      map.value.removeSource('country-boundaries')
    }

    if (!showBoundaries.value) return

    const data = await loadBoundaries()
    if (!data) return

    // Add source
    map.value.addSource('country-boundaries', {
      type: 'geojson',
      data: data
    })

    // Add fill layer (very subtle)
    map.value.addLayer({
      id: 'country-boundaries-fill',
      type: 'fill',
      source: 'country-boundaries',
      paint: {
        'fill-color': 'transparent',
        'fill-opacity': 0
      }
    }, 'points-layer') // Add below points

    // Add line layer
    map.value.addLayer({
      id: 'country-boundaries-line',
      type: 'line',
      source: 'country-boundaries',
      paint: {
        'line-color': '#ffffff',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          2, 0.5,
          6, 1,
          10, 1.5
        ],
        'line-opacity': 0.5
      }
    }, 'points-layer') // Add below points
  }

  const toggleBoundaries = () => {
    showBoundaries.value = !showBoundaries.value
    addBoundariesLayer()
  }

  const setBoundaries = (value) => {
    showBoundaries.value = value
    addBoundariesLayer()
  }

  return {
    showBoundaries,
    boundariesLoaded,
    toggleBoundaries,
    setBoundaries,
    addBoundariesLayer
  }
}
