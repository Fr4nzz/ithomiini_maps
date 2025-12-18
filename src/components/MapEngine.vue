<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDataStore } from '../stores/data'
import PointPopup from './PointPopup.vue'
import { ASPECT_RATIOS, STATUS_COLORS } from '../utils/constants'

const store = useDataStore()
const emit = defineEmits(['map-ready', 'open-gallery'])
const mapContainer = ref(null)
const pointPopupContainer = ref(null)
let map = null
let popup = null

// Container size for accurate export preview calculations
const containerSize = ref({ width: 1600, height: 900 })
let resizeObserver = null

// Enhanced popup state for multi-point locations
const showEnhancedPopup = ref(false)
const enhancedPopupData = ref({
  coordinates: { lat: 0, lng: 0 },
  points: []
})

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION SEARCH
// ═══════════════════════════════════════════════════════════════════════════

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
  if (!map) return

  showSearchResults.value = false
  searchQuery.value = ''

  // If we have a bounding box, use fitBounds for better framing
  if (result.boundingbox) {
    const [south, north, west, east] = result.boundingbox.map(parseFloat)
    map.fitBounds(
      [[west, south], [east, north]],
      { padding: 50, maxZoom: 14, duration: 1500 }
    )
  } else {
    // Otherwise just fly to the point
    map.flyTo({
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

// Legend position class based on store settings
const legendPositionClass = computed(() => {
  return `legend-${store.legendSettings.position}`
})

// Limit color map items for legend display
const limitedColorMap = computed(() => {
  const colorMap = store.activeColorMap
  const maxItems = store.legendSettings.maxItems
  const entries = Object.entries(colorMap)

  if (entries.length <= maxItems) {
    return colorMap
  }

  // Return only the first maxItems entries
  const limited = {}
  entries.slice(0, maxItems).forEach(([key, value]) => {
    limited[key] = value
  })
  return limited
})

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT PREVIEW OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

// Computed transform origin for legend based on position
const legendTransformOrigin = computed(() => {
  const pos = store.legendSettings.position
  if (pos === 'top-left') return 'top left'
  if (pos === 'top-right') return 'top right'
  if (pos === 'bottom-left') return 'bottom left'
  if (pos === 'bottom-right') return 'bottom right'
  return 'bottom left'
})

// Scale bar text - calculated from map zoom level
const scaleBarText = ref('500 km')

// Update scale bar text when map moves
const updateScaleBar = () => {
  if (!map) return

  try {
    const zoom = map.getZoom()
    const center = map.getCenter()
    const lat = center.lat

    // Calculate meters per pixel at this latitude and zoom
    const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)

    // Scale bar is approximately 100px wide, calculate what distance that represents
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

// Calculate the export hole position as percentages
// This creates the largest rectangle that fits the container while maintaining the target aspect ratio
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

// ═══════════════════════════════════════════════════════════════════════════
// MAP STYLES - Free tile sources
// ═══════════════════════════════════════════════════════════════════════════

const MAP_STYLES = {
  dark: {
    name: 'Dark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  },
  light: {
    name: 'Light',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  },
  satellite: {
    name: 'Satellite',
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
  terrain: {
    name: 'Terrain',
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
  streets: {
    name: 'Streets',
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
  }
}

const currentStyle = ref('dark')

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(() => {
  initMap()
  document.addEventListener('click', handleClickOutside)

  // Set up ResizeObserver for accurate export preview calculations
  if (mapContainer.value) {
    containerSize.value = {
      width: mapContainer.value.clientWidth,
      height: mapContainer.value.clientHeight
    }

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerSize.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.height
        }
      }
    })
    resizeObserver.observe(mapContainer.value)
  }
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  document.removeEventListener('click', handleClickOutside)
  clearTimeout(searchDebounceTimer)
})

// ═══════════════════════════════════════════════════════════════════════════
// MAP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const initMap = () => {
  const styleConfig = MAP_STYLES[currentStyle.value]

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: styleConfig.style,
    center: [-60, -5], // South America center (Ithomiini range)
    zoom: 4,
    attributionControl: false,
    maxZoom: 18,
    minZoom: 2,
    // For MapLibre v5.0+, preserveDrawingBuffer must be in canvasContextAttributes
    canvasContextAttributes: {
      preserveDrawingBuffer: true // Required for canvas export
    }
  })

  // Add controls
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-right')
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
  
  // Fullscreen control
  map.addControl(new maplibregl.FullscreenControl(), 'top-right')

  map.on('load', () => {
    addDataLayer()
    emit('map-ready', map)
    updateScaleBar()
  })

  // Update scale bar when map moves/zooms
  map.on('moveend', updateScaleBar)
  map.on('zoomend', updateScaleBar)
}

// ═══════════════════════════════════════════════════════════════════════════
// SCATTER VISUALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a circle polygon approximation for a given center and radius
 * @param {number} centerLng - Center longitude
 * @param {number} centerLat - Center latitude
 * @param {number} radiusKm - Radius in kilometers
 * @param {number} points - Number of points for circle approximation
 * @returns {Array} Array of coordinate pairs forming a closed polygon
 */
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

/**
 * Build GeoJSON for scatter visualization (circle polygons only)
 */
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

/**
 * Add or update scatter visualization layers (circles only, no lines)
 */
const updateScatterVisualization = () => {
  if (!map || !map.isStyleLoaded()) return

  const layerIds = ['scatter-circles-fill', 'scatter-circles-outline']
  const sourceIds = ['scatter-circles-source']

  // Remove existing layers and sources
  layerIds.forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
  sourceIds.forEach(id => {
    if (map.getSource(id)) map.removeSource(id)
  })

  // Only add if scatter is enabled and there's data
  if (!store.scatterOverlappingPoints) return

  const geoJSON = buildScatterVisualizationGeoJSON()

  if (geoJSON.circles.features.length === 0) return

  // Add circles source
  map.addSource('scatter-circles-source', {
    type: 'geojson',
    data: geoJSON.circles
  })

  // Try to add below points layer if it exists, otherwise just add
  const beforeLayer = map.getLayer('points-layer') ? 'points-layer' : undefined

  // Add circle fill layer (semi-transparent)
  map.addLayer({
    id: 'scatter-circles-fill',
    type: 'fill',
    source: 'scatter-circles-source',
    paint: {
      'fill-color': 'rgba(59, 130, 246, 0.08)'
    }
  }, beforeLayer)

  // Add circle outline layer (dashed line)
  map.addLayer({
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

// ═══════════════════════════════════════════════════════════════════════════
// DATA LAYER WITH SMART CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════

// Hover popup for cluster preview
let clusterHoverPopup = null

// Track if event handlers are registered (to prevent duplicates)
let clusterHandlersRegistered = false
let pointsHandlersRegistered = false

const addDataLayer = (options = {}) => {
  const { skipZoom = false } = options

  if (!map) return

  // Remove existing layers/sources if they exist
  const layersToRemove = [
    'clusters',
    'cluster-count',
    'cluster-extent',
    'points-layer',
    'points-highlight'
  ]
  layersToRemove.forEach(layer => {
    if (map.getLayer(layer)) map.removeLayer(layer)
  })
  if (map.getSource('points-source')) map.removeSource('points-source')

  const geojson = store.displayGeoJSON
  if (!geojson) return

  const pointCount = geojson.features.length
  const shouldCluster = store.clusteringEnabled
  const settings = store.clusterSettings

  // Use the pixel radius directly from settings
  const clusterRadiusPixels = settings.radiusPixels

  // Add source - use store settings for clustering
  map.addSource('points-source', {
    type: 'geojson',
    data: geojson,
    cluster: shouldCluster,
    clusterMaxZoom: 14,
    clusterRadius: clusterRadiusPixels,
    clusterMinPoints: 2
  })

  // Only add cluster layers if clustering is enabled
  if (shouldCluster) {
    // ─────────────────────────────────────────────────────────────────────────
    // CLUSTER CIRCLES - sized by point count
    // ─────────────────────────────────────────────────────────────────────────
    map.addLayer({
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

    // ─────────────────────────────────────────────────────────────────────────
    // CLUSTER EXTENT CIRCLES - shows the clustering radius area
    // ─────────────────────────────────────────────────────────────────────────
    map.addLayer({
      id: 'cluster-extent',
      type: 'circle',
      source: 'points-source',
      filter: ['has', 'point_count'],
      paint: {
        // The extent circle is the cluster radius (in pixels)
        'circle-radius': clusterRadiusPixels,
        'circle-color': 'rgba(74, 222, 128, 0.08)',
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(74, 222, 128, 0.25)',
        'circle-stroke-opacity': 1
      }
    }, 'clusters') // Add below the clusters layer

    // ─────────────────────────────────────────────────────────────────────────
    // CLUSTER COUNT LABELS
    // ─────────────────────────────────────────────────────────────────────────
    map.addLayer({
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

  // ─────────────────────────────────────────────────────────────────────────
  // INDIVIDUAL POINTS
  // ─────────────────────────────────────────────────────────────────────────

  // Build dynamic color expression based on store settings
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

  map.addLayer({
    id: 'points-layer',
    type: 'circle',
    source: 'points-source',
    filter: shouldCluster ? ['!', ['has', 'point_count']] : ['all'], // All points if no clustering
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

  // ─────────────────────────────────────────────────────────────────────────
  // HIGHLIGHT LAYER (for hover on individual points)
  // ─────────────────────────────────────────────────────────────────────────
  const highlightSizeExpression = [
    'interpolate', ['linear'], ['zoom'],
    3, baseSize * 0.75,
    6, baseSize * 1.25,
    10, baseSize * 1.75,
    14, baseSize * 2.25
  ]

  map.addLayer({
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

  // ─────────────────────────────────────────────────────────────────────────
  // CLUSTER EVENT HANDLERS - click and hover
  // ─────────────────────────────────────────────────────────────────────────
  if (shouldCluster) {
    // Remove old handlers first to prevent duplicates
    if (clusterHandlersRegistered) {
      map.off('click', 'clusters')
      map.off('mouseenter', 'clusters')
      map.off('mouseleave', 'clusters')
    }
    clusterHandlersRegistered = true

    // CLUSTER CLICK - show enhanced popup with all cluster points
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      if (!features.length) return

      const cluster = features[0]
      const coords = cluster.geometry.coordinates

      // Close existing popup
      if (popup) popup.remove()
      showEnhancedPopup.value = false

      // Get cluster points using proximity-based filtering
      // Note: getClusterLeaves doesn't work reliably in this MapLibre version
      const clusterLng = coords[0]
      const clusterLat = coords[1]

      // Get all points from the store and filter by proximity to cluster center
      const allPoints = store.displayGeoJSON?.features || []

      // Calculate approximate radius based on zoom level and cluster radius setting
      // At lower zoom, clusters cover more area
      // Use a generous multiplier to ensure we capture all cluster points
      const zoom = map.getZoom()
      const clusterRadiusPx = store.clusterSettings.radiusPixels

      // Convert pixel radius to approximate km at current zoom
      // At zoom 0, 1 pixel ≈ 156km; halves with each zoom level
      const kmPerPixel = 156 / Math.pow(2, zoom)
      const radiusKm = Math.max(20, clusterRadiusPx * kmPerPixel * 2) // 2x for safety margin

      const nearbyPoints = allPoints
        .filter(f => {
          const [lng, lat] = f.geometry.coordinates
          const dLat = Math.abs(lat - clusterLat)
          const dLng = Math.abs(lng - clusterLng) * Math.cos(clusterLat * Math.PI / 180) // Adjust for latitude
          const distKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111
          return distKm < radiusKm
        })
        .map(f => f.properties)

      if (nearbyPoints.length > 0) {
        enhancedPopupData.value = {
          coordinates: { lat: clusterLat, lng: clusterLng },
          points: nearbyPoints,
          initialSpecies: null,
          initialSubspecies: null
        }

        nextTick(() => {
          showEnhancedPopup.value = true

          nextTick(() => {
            if (pointPopupContainer.value) {
              popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: true,
                maxWidth: '500px',
                className: 'custom-popup enhanced-popup'
              })
                .setLngLat(coords)
                .setDOMContent(pointPopupContainer.value)
                .addTo(map)

              popup.on('close', () => {
                showEnhancedPopup.value = false
              })
            }
          })
        })
      }
    })

    // CLUSTER HOVER - change cursor and show preview
    map.on('mouseenter', 'clusters', (e) => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = ''
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INDIVIDUAL POINT CLICK - show popup (enhanced for multiple points)
  // ─────────────────────────────────────────────────────────────────────────
  // Remove old handler to prevent duplicates
  map.off('click', 'points-layer')
  map.on('click', 'points-layer', (e) => {
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

    // Close existing popup
    if (popup) popup.remove()
    showEnhancedPopup.value = false

    // Always use enhanced popup (even for single points)
    // If clicked on a scattered point, pre-select that subspecies
    enhancedPopupData.value = {
      coordinates: { lat, lng },
      points: pointsAtLocation.length > 0 ? pointsAtLocation : [props],
      initialSpecies: isScattered ? scatteredSpecies : null,
      initialSubspecies: isScattered ? scatteredSubspecies : null
    }

    // Create popup with the Vue component container
    nextTick(() => {
      showEnhancedPopup.value = true

      nextTick(() => {
        if (pointPopupContainer.value) {
          popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: true,
            maxWidth: '500px',
            className: 'custom-popup enhanced-popup'
          })
            .setLngLat(coords)
            .setDOMContent(pointPopupContainer.value)
            .addTo(map)

          popup.on('close', () => {
            showEnhancedPopup.value = false
          })
        }
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // POINTS LAYER HOVER EFFECTS
  // ─────────────────────────────────────────────────────────────────────────
  // Register points-layer handlers only once
  if (!pointsHandlersRegistered) {
    pointsHandlersRegistered = true

    map.on('mouseenter', 'points-layer', (e) => {
      map.getCanvas().style.cursor = 'pointer'

      if (e.features && e.features.length > 0) {
        const id = e.features[0].properties.id
        // Check current clustering state dynamically
        const isClustering = store.clusteringEnabled
        const filter = isClustering
          ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], id]]
          : ['==', ['get', 'id'], id]
        map.setFilter('points-highlight', filter)
      }
    })

    map.on('mouseleave', 'points-layer', () => {
      map.getCanvas().style.cursor = ''
      // Check current clustering state dynamically
      const isClustering = store.clusteringEnabled
      const filter = isClustering
        ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']]
        : ['==', ['get', 'id'], '']
      map.setFilter('points-highlight', filter)
    })
  }

  // Fit bounds to data (with padding) - only if not skipping zoom
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

// ═══════════════════════════════════════════════════════════════════════════
// MAP UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const fitBoundsToData = (geojson) => {
  if (!geojson || !geojson.features || geojson.features.length === 0) return

  // If only one point, just center on it
  if (geojson.features.length === 1) {
    const coords = geojson.features[0].geometry.coordinates
    map.flyTo({
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

  map.fitBounds(bounds, {
    padding: { top: 50, bottom: 50, left: 50, right: 50 },
    maxZoom: 12,
    duration: 1000
  })
}

// Track previous data length to detect actual data changes vs just settings changes
let previousDataLength = 0

// Track previous scatter state to detect scatter toggles vs actual data changes
let previousScatterState = false

// Close enhanced popup
const closeEnhancedPopup = () => {
  if (popup) popup.remove()
  showEnhancedPopup.value = false
}

// Handle open gallery from popup
const handleOpenGallery = () => {
  closeEnhancedPopup()
  emit('open-gallery')
}

// Watch for displayGeoJSON changes and update the map
watch(
  () => store.displayGeoJSON,
  (newData) => {
    if (!map || !map.isStyleLoaded()) return

    const newLength = newData?.features?.length || 0
    const currentScatterState = store.scatterOverlappingPoints

    // Detect if this change is from scatter toggle vs actual data change
    const scatterJustToggled = currentScatterState !== previousScatterState
    previousScatterState = currentScatterState

    // Only consider it a "data change" if the length changed (not just scatter coordinates)
    const dataLengthChanged = newLength !== previousDataLength
    previousDataLength = newLength

    // Skip zoom if:
    // - Data length didn't change, OR
    // - Scatter was just toggled (coordinates changed but not actual data)
    const shouldSkipZoom = !dataLengthChanged || scatterJustToggled

    addDataLayer({ skipZoom: shouldSkipZoom })

    // Update scatter visualization if enabled
    if (store.scatterOverlappingPoints) {
      updateScatterVisualization()
    }
  },
  { deep: true }
)

// Watch for scatter toggle changes - rebuild layers and visualization without zoom
watch(
  () => store.scatterOverlappingPoints,
  () => {
    if (!map || !map.isStyleLoaded()) return
    // Note: The displayGeoJSON watcher will also fire, but it will detect scatter toggle
    // and skip zoom appropriately
    updateScatterVisualization()
  }
)

// Watch for clustering settings changes - rebuild layers without zoom
watch(
  [() => store.clusteringEnabled, () => store.clusterSettings],
  () => {
    if (!map || !map.isStyleLoaded()) return
    // Rebuild the data layer with new clustering settings - skip zoom
    addDataLayer({ skipZoom: true })
  },
  { deep: true }
)

// Watch for color and style settings changes - rebuild layers without zoom
watch(
  [() => store.colorBy, () => store.mapStyle],
  () => {
    if (!map || !map.isStyleLoaded()) return
    // Rebuild the data layer with new color/style settings - skip zoom
    addDataLayer({ skipZoom: true })
  },
  { deep: true }
)

// Watch for focusPoint changes - zoom to point and show popup
watch(
  () => store.focusPoint,
  (point) => {
    if (!point || !map) return

    // Close any existing popup
    if (popup) popup.remove()
    showEnhancedPopup.value = false

    // Fly to the point
    map.flyTo({
      center: [point.lng, point.lat],
      zoom: 12,
      duration: 1500
    })

    // After flight completes, show popup
    map.once('moveend', () => {
      // Get all points at this location
      const pointsAtLocation = store.getPointsAtCoordinates(point.lat, point.lng)

      // Setup enhanced popup data
      enhancedPopupData.value = {
        coordinates: { lat: point.lat, lng: point.lng },
        points: pointsAtLocation.length > 0 ? pointsAtLocation : [point.properties],
        initialSpecies: point.properties?.scientific_name,
        initialSubspecies: point.properties?.subspecies
      }

      // Create popup
      nextTick(() => {
        showEnhancedPopup.value = true

        nextTick(() => {
          if (pointPopupContainer.value) {
            popup = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: true,
              maxWidth: '500px',
              className: 'custom-popup enhanced-popup'
            })
              .setLngLat([point.lng, point.lat])
              .setDOMContent(pointPopupContainer.value)
              .addTo(map)

            popup.on('close', () => {
              showEnhancedPopup.value = false
            })
          }
        })
      })

      // Clear the focus point so it can be triggered again
      store.focusPoint = null
    })
  }
)

// ═══════════════════════════════════════════════════════════════════════════
// STYLE SWITCHER
// ═══════════════════════════════════════════════════════════════════════════

const switchStyle = (styleName) => {
  if (!map || !MAP_STYLES[styleName]) return

  // Save current view state before style change
  const center = map.getCenter()
  const zoom = map.getZoom()
  const bearing = map.getBearing()
  const pitch = map.getPitch()

  currentStyle.value = styleName
  const styleConfig = MAP_STYLES[styleName]

  map.setStyle(styleConfig.style)

  // Use a more robust approach: wait for style to be fully loaded
  const waitForStyleAndAddLayer = () => {
    if (map.isStyleLoaded()) {
      // Restore view state
      map.jumpTo({ center, zoom, bearing, pitch })
      // Re-add the data layer with current filtered data - skip zoom to preserve view
      addDataLayer({ skipZoom: true })
    } else {
      // Style not ready yet, try again
      setTimeout(waitForStyleAndAddLayer, 50)
    }
  }

  // Start checking after style.load event (or immediately for inline styles)
  map.once('style.load', () => {
    // Give it a small delay then check if truly ready
    setTimeout(waitForStyleAndAddLayer, 100)
  })

  // Fallback: also try on idle event
  map.once('idle', () => {
    if (!map.getSource('points-source')) {
      map.jumpTo({ center, zoom, bearing, pitch })
      addDataLayer({ skipZoom: true })
    }
  })
}
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map"></div>

    <!-- Enhanced Popup Container (rendered via MapLibre popup) -->
    <div v-show="false">
      <div ref="pointPopupContainer">
        <PointPopup
          v-if="showEnhancedPopup"
          :coordinates="enhancedPopupData.coordinates"
          :points="enhancedPopupData.points"
          :initial-species="enhancedPopupData.initialSpecies"
          :initial-subspecies="enhancedPopupData.initialSubspecies"
          @close="closeEnhancedPopup"
          @open-gallery="handleOpenGallery"
        />
      </div>
    </div>

    <!-- Location Search -->
    <div ref="searchInputRef" class="location-search">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search location..."
          @input="onSearchInput"
          @focus="showSearchResults = searchResults.length > 0"
          @keydown.escape="clearSearch"
        />
        <svg
          v-if="isSearching"
          class="search-spinner"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/>
        </svg>
        <button
          v-else-if="searchQuery"
          class="search-clear"
          @click="clearSearch"
          title="Clear search"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Search Results Dropdown -->
      <div v-if="showSearchResults && searchResults.length > 0" class="search-results">
        <button
          v-for="(result, index) in searchResults"
          :key="index"
          class="search-result-item"
          @click="selectSearchResult(result)"
        >
          <svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span class="result-name">{{ result.name }}</span>
        </button>
      </div>
    </div>

    <!-- Style Switcher -->
    <div class="style-switcher">
      <button 
        v-for="(config, key) in MAP_STYLES" 
        :key="key"
        :class="{ active: currentStyle === key }"
        @click="switchStyle(key)"
        :title="config.name"
      >
        {{ config.name }}
      </button>
    </div>

    <!-- Legend (shown when NOT in export mode) -->
    <div
      v-if="store.legendSettings.showLegend && !store.exportSettings.enabled"
      class="legend"
      :class="legendPositionClass"
      :style="{ fontSize: store.legendSettings.textSize + 'rem' }"
    >
      <div class="legend-title">{{ store.legendTitle }}</div>
      <div
        v-for="(color, label) in limitedColorMap"
        :key="label"
        class="legend-item"
      >
        <span class="legend-dot" :style="{ backgroundColor: color }"></span>
        <span :class="{ 'legend-label-italic': store.colorBy === 'species' || store.colorBy === 'subspecies' || store.colorBy === 'genus' }">{{ label }}</span>
      </div>
      <div v-if="Object.keys(store.activeColorMap).length > store.legendSettings.maxItems" class="legend-more">
        + {{ Object.keys(store.activeColorMap).length - store.legendSettings.maxItems }} more
      </div>
    </div>

    <!-- Export Preview Overlay -->
    <div v-if="store.exportSettings.enabled" class="export-overlay">
      <!-- Dark mask with transparent hole in center -->
      <svg class="export-mask" width="100%" height="100%">
        <defs>
          <mask id="export-hole">
            <rect width="100%" height="100%" fill="white"/>
            <rect
              class="export-hole-rect"
              :x="exportHolePosition.x + '%'"
              :y="exportHolePosition.y + '%'"
              :width="exportHolePosition.width + '%'"
              :height="exportHolePosition.height + '%'"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#export-hole)"/>
      </svg>

      <!-- Export region border -->
      <div
        class="export-region-frame"
        :style="{
          left: exportHolePosition.x + '%',
          top: exportHolePosition.y + '%',
          width: exportHolePosition.width + '%',
          height: exportHolePosition.height + '%'
        }"
      >
        <!-- Corner handles -->
        <div class="export-corner export-corner-tl"></div>
        <div class="export-corner export-corner-tr"></div>
        <div class="export-corner export-corner-bl"></div>
        <div class="export-corner export-corner-br"></div>

        <!-- Export info badge -->
        <div class="export-info">
          <span class="export-ratio">{{ store.exportSettings.aspectRatio }}</span>
          <span class="export-dimensions">{{ ASPECT_RATIOS[store.exportSettings.aspectRatio]?.width || store.exportSettings.customWidth }} × {{ ASPECT_RATIOS[store.exportSettings.aspectRatio]?.height || store.exportSettings.customHeight }}</span>
        </div>

        <!-- Legend inside export region (scaled) -->
        <div
          v-if="store.legendSettings.showLegend && store.exportSettings.includeLegend"
          class="export-legend"
          :class="'export-legend-' + store.legendSettings.position"
          :style="{
            fontSize: (store.legendSettings.textSize * store.exportSettings.uiScale) + 'rem',
            transform: 'scale(' + store.exportSettings.uiScale + ')',
            transformOrigin: legendTransformOrigin
          }"
        >
          <div class="legend-title">{{ store.legendTitle }}</div>
          <div
            v-for="(color, label) in limitedColorMap"
            :key="label"
            class="legend-item"
          >
            <span class="legend-dot" :style="{ backgroundColor: color }"></span>
            <span :class="{ 'legend-label-italic': store.colorBy === 'species' || store.colorBy === 'subspecies' || store.colorBy === 'genus' }">{{ label }}</span>
          </div>
          <div v-if="Object.keys(store.activeColorMap).length > store.legendSettings.maxItems" class="legend-more">
            + {{ Object.keys(store.activeColorMap).length - store.legendSettings.maxItems }} more
          </div>
        </div>

        <!-- Scale bar inside export region -->
        <div
          v-if="store.exportSettings.includeScaleBar"
          class="export-scale-bar"
          :class="{ 'export-scale-bar-left': store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend }"
          :style="{
            transform: 'scale(' + store.exportSettings.uiScale + ')',
            transformOrigin: store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend ? 'bottom left' : 'bottom right'
          }"
        >
          <div class="scale-bar-line"></div>
          <span class="scale-bar-text">{{ scaleBarText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map {
  width: 100%;
  height: 100%;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAPLIBRE CONTROLS CUSTOMIZATION
   ═══════════════════════════════════════════════════════════════════════════ */

/* Style the navigation control container */
:deep(.maplibregl-ctrl-top-right) {
  top: 10px;
  right: 10px;
}

:deep(.maplibregl-ctrl-group) {
  background: rgba(26, 26, 46, 0.95) !important;
  border: 1px solid #3d3d5c !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(4px);
  overflow: hidden;
}

:deep(.maplibregl-ctrl-group button) {
  width: 32px !important;
  height: 32px !important;
  background-color: transparent !important;
  border: none !important;
  border-bottom: 1px solid #3d3d5c !important;
}

:deep(.maplibregl-ctrl-group button:last-child) {
  border-bottom: none !important;
}

:deep(.maplibregl-ctrl-group button:hover) {
  background-color: #2d2d4a !important;
}

/* Compass button - make it more intuitive */
:deep(.maplibregl-ctrl-compass) {
  position: relative;
}

/* Style the compass icon */
:deep(.maplibregl-ctrl-compass .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-compass:hover .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(80%) sepia(50%) saturate(500%) hue-rotate(90deg) brightness(100%) contrast(100%);
}

/* Add rotate label tooltip */
:deep(.maplibregl-ctrl-compass::after) {
  content: 'Rotate';
  position: absolute;
  right: 40px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(26, 26, 46, 0.95);
  color: #aaa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

:deep(.maplibregl-ctrl-compass:hover::after) {
  opacity: 1;
}

/* Zoom buttons */
:deep(.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon),
:deep(.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-zoom-in:hover .maplibregl-ctrl-icon),
:deep(.maplibregl-ctrl-zoom-out:hover .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(80%) sepia(50%) saturate(500%) hue-rotate(90deg) brightness(100%) contrast(100%);
}

/* Fullscreen button */
:deep(.maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-fullscreen:hover .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(80%) sepia(50%) saturate(500%) hue-rotate(90deg) brightness(100%) contrast(100%);
}

/* Scale control */
:deep(.maplibregl-ctrl-scale) {
  background: rgba(26, 26, 46, 0.8) !important;
  border: 1px solid #3d3d5c !important;
  border-radius: 4px !important;
  color: #aaa !important;
  font-size: 10px !important;
  padding: 2px 6px !important;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOCATION SEARCH
   ═══════════════════════════════════════════════════════════════════════════ */

.location-search {
  position: absolute;
  top: 56px;
  left: 10px;
  z-index: 10;
  width: 280px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid #3d3d5c;
  border-radius: 8px;
  padding: 0 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: #4ade80;
  box-shadow: 0 2px 15px rgba(74, 222, 128, 0.2);
}

.search-icon {
  width: 16px;
  height: 16px;
  color: #666;
  flex-shrink: 0;
}

.search-input-wrapper:focus-within .search-icon {
  color: #4ade80;
}

.location-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e0e0e0;
  font-size: 0.875rem;
  padding: 10px 10px;
  width: 100%;
}

.location-search input::placeholder {
  color: #666;
}

.search-spinner {
  width: 18px;
  height: 18px;
  color: #4ade80;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #666;
  transition: color 0.2s;
}

.search-clear:hover {
  color: #e0e0e0;
}

.search-clear svg {
  width: 14px;
  height: 14px;
}

/* Search Results Dropdown */
.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: rgba(26, 26, 46, 0.98);
  border: 1px solid #3d3d5c;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
}

.search-result-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #2d2d4a;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #2d2d4a;
}

.result-icon {
  width: 16px;
  height: 16px;
  color: #4ade80;
  flex-shrink: 0;
  margin-top: 2px;
}

.result-name {
  font-size: 0.8rem;
  color: #c0c0c0;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.search-result-item:hover .result-name {
  color: #e0e0e0;
}

/* Scrollbar styling for search results */
.search-results::-webkit-scrollbar {
  width: 6px;
}

.search-results::-webkit-scrollbar-track {
  background: transparent;
}

.search-results::-webkit-scrollbar-thumb {
  background: #3d3d5c;
  border-radius: 3px;
}

.search-results::-webkit-scrollbar-thumb:hover {
  background: #4d4d6c;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLE SWITCHER
   ═══════════════════════════════════════════════════════════════════════════ */

.style-switcher {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 4px;
  background: rgba(26, 26, 46, 0.95);
  padding: 6px;
  border-radius: 8px;
  z-index: 10;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

.style-switcher button {
  padding: 6px 12px;
  background: #252540;
  border: 1px solid #3d3d5c;
  color: #aaa;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.style-switcher button:hover {
  background: #2d2d4a;
  color: #fff;
}

.style-switcher button.active {
  background: #4ade80;
  color: #1a1a2e;
  border-color: #4ade80;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEGEND
   ═══════════════════════════════════════════════════════════════════════════ */

.legend {
  position: absolute;
  background: rgba(26, 26, 46, 0.95);
  padding: 12px 16px;
  border-radius: 8px;
  z-index: 10;
  min-width: 160px;
  max-width: 220px;
  max-height: 400px;
  overflow-y: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

/* Legend positioning */
.legend-bottom-left {
  bottom: 30px;
  left: 10px;
}

.legend-bottom-right {
  bottom: 30px;
  right: 10px;
}

.legend-top-left {
  top: 60px;
  left: 10px;
}

.legend-top-right {
  top: 60px;
  right: 10px;
}

.legend-title {
  font-size: 0.875em;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #3d3d5c;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1em;
  color: #e0e0e0;
  margin-bottom: 6px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-label-italic {
  font-style: italic;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
}

.legend-more {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3d3d5c;
  font-size: 0.85em;
  color: #666;
  font-style: italic;
}

/* ═══════════════════════════════════════════════════════════════════════════
   POPUP STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

:deep(.maplibregl-popup-content) {
  background: #1a1a2e !important;
  color: #e0e0e0 !important;
  border-radius: 10px;
  padding: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  border: 1px solid #3d3d5c;
  max-width: 340px;
}

:deep(.maplibregl-popup-close-button) {
  color: #888 !important;
  font-size: 20px;
  padding: 6px 10px;
  line-height: 1;
}

:deep(.maplibregl-popup-close-button:hover) {
  color: #fff !important;
  background: transparent !important;
}

:deep(.maplibregl-popup-tip) {
  border-top-color: #1a1a2e !important;
}

:deep(.popup-content) {
  padding: 14px 18px;
}

:deep(.popup-header) {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1em;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #3d3d5c;
}

:deep(.popup-header strong) {
  font-style: italic;
  color: #fff;
}

:deep(.status-dot) {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

:deep(.popup-row) {
  font-size: 0.85em;
  margin-bottom: 5px;
  color: #ccc;
  line-height: 1.4;
}

:deep(.popup-row .label) {
  color: #888;
  margin-right: 6px;
}

:deep(.popup-body) {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

:deep(.popup-thumbnail) {
  flex-shrink: 0;
  width: 100px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  background: #252540;
  border: 1px solid #3d3d5c;
}

:deep(.popup-thumbnail img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

:deep(.popup-info) {
  flex: 1;
  min-width: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .location-search {
    top: 10px;
    left: 10px;
    right: 10px;
    width: auto;
  }

  .style-switcher {
    top: auto;
    bottom: 100px;
    left: 10px;
    flex-wrap: wrap;
    max-width: calc(100% - 20px);
  }

  .style-switcher button {
    padding: 8px 10px;
    font-size: 0.7em;
  }

  .legend {
    bottom: 160px;
    font-size: 0.9em;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT PREVIEW OVERLAY
   ═══════════════════════════════════════════════════════════════════════════ */

.export-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
}

.export-mask {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.export-region-frame {
  position: absolute;
  border: 2px dashed rgba(74, 222, 128, 0.9);
  border-radius: 2px;
  box-sizing: border-box;
}

/* Corner handles */
.export-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #4ade80;
  background: transparent;
}

.export-corner-tl {
  top: -2px;
  left: -2px;
  border-right: none;
  border-bottom: none;
}

.export-corner-tr {
  top: -2px;
  right: -2px;
  border-left: none;
  border-bottom: none;
}

.export-corner-bl {
  bottom: -2px;
  left: -2px;
  border-right: none;
  border-top: none;
}

.export-corner-br {
  bottom: -2px;
  right: -2px;
  border-left: none;
  border-top: none;
}

/* Export info display */
.export-info {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(26, 26, 46, 0.95);
  padding: 8px 14px;
  border-radius: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

.export-ratio {
  font-size: 0.85em;
  font-weight: 700;
  color: #4ade80;
}

.export-dimensions {
  font-size: 0.75em;
  color: #aaa;
  font-family: monospace;
}

/* Export Legend (inside export region) */
.export-legend {
  position: absolute;
  background: rgba(26, 26, 46, 0.95);
  border-radius: 8px;
  padding: 12px 16px;
  max-height: 60%;
  overflow-y: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  z-index: 2;
}

.export-legend-bottom-left {
  bottom: 15px;
  left: 15px;
}

.export-legend-bottom-right {
  bottom: 15px;
  right: 15px;
}

.export-legend-top-left {
  top: 50px;
  left: 15px;
}

.export-legend-top-right {
  top: 50px;
  right: 15px;
}

.export-legend .legend-title {
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #3d3d5c;
}

.export-legend .legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 0.85em;
  color: #e0e0e0;
}

.export-legend .legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.export-legend .legend-label-italic {
  font-style: italic;
}

.export-legend .legend-more {
  font-size: 0.75em;
  color: #888;
  font-style: italic;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #3d3d5c;
}

/* Export Scale Bar */
.export-scale-bar {
  position: absolute;
  bottom: 15px;
  right: 15px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  z-index: 2;
}

.export-scale-bar-left {
  right: auto;
  left: 15px;
  align-items: flex-start;
}

.scale-bar-line {
  width: 100px;
  height: 4px;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  position: relative;
}

.scale-bar-line::before,
.scale-bar-line::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 8px;
  background: #fff;
  top: -2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.scale-bar-line::before {
  left: 0;
}

.scale-bar-line::after {
  right: 0;
}

.scale-bar-text {
  font-size: 0.7em;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENHANCED POPUP (for multi-point locations)
   ═══════════════════════════════════════════════════════════════════════════ */

:deep(.enhanced-popup .maplibregl-popup-content) {
  background: transparent !important;
  padding: 0 !important;
  border: none !important;
  box-shadow: none !important;
  max-width: 500px !important;
}

:deep(.enhanced-popup .maplibregl-popup-tip) {
  border-top-color: #1a1a2e !important;
}
</style>
