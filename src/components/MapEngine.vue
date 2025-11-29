<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDataStore } from '../stores/data'

const store = useDataStore()
const emit = defineEmits(['map-ready'])
const mapContainer = ref(null)
let map = null
let popup = null

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
// STATUS COLORS
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_COLORS = {
  'Sequenced': '#3b82f6',        // Blue
  'Tissue Available': '#10b981', // Green
  'Preserved Specimen': '#f59e0b', // Orange
  'Published': '#a855f7',        // Purple
  'GBIF Record': '#6b7280',      // Gray
  'Observation': '#22c55e',      // Green - Research Grade equivalent
  'Museum Specimen': '#8b5cf6',  // Purple
  'Living Specimen': '#14b8a6',  // Teal
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
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
    minZoom: 2
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
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA LAYER WITH CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════

const addDataLayer = () => {
  if (!map) return

  // Remove existing layers/sources if they exist
  const layersToRemove = [
    'clusters',
    'cluster-count',
    'points-layer',
    'points-highlight'
  ]
  layersToRemove.forEach(layer => {
    if (map.getLayer(layer)) map.removeLayer(layer)
  })
  if (map.getSource('points-source')) map.removeSource('points-source')

  const geojson = store.filteredGeoJSON
  if (!geojson) return

  // Add source with clustering enabled for performance
  map.addSource('points-source', {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14,    // Max zoom to cluster points
    clusterRadius: 50,      // Radius of each cluster in pixels
    clusterMinPoints: 3     // Minimum points to form a cluster
  })

  // ─────────────────────────────────────────────────────────────────────────
  // CLUSTER CIRCLES - sized by point count
  // ─────────────────────────────────────────────────────────────────────────
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'points-source',
    filter: ['has', 'point_count'],
    paint: {
      // Size clusters based on point count
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        15,      // 15px for count < 10
        10, 20,  // 20px for count >= 10
        50, 25,  // 25px for count >= 50
        100, 30, // 30px for count >= 100
        500, 40  // 40px for count >= 500
      ],
      // Color clusters based on count - gradient from green to orange to red
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#4ade80',   // Green for small clusters
        10, '#22d3ee', // Cyan
        50, '#facc15', // Yellow
        100, '#fb923c', // Orange
        500, '#ef4444'  // Red for large clusters
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.8
    }
  })

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
      'text-size': 12,
      'text-allow-overlap': true
    },
    paint: {
      'text-color': '#1a1a2e'
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // INDIVIDUAL POINTS (unclustered)
  // ─────────────────────────────────────────────────────────────────────────
  map.addLayer({
    id: 'points-layer',
    type: 'circle',
    source: 'points-source',
    filter: ['!', ['has', 'point_count']], // Only unclustered points
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        3, 3,
        6, 5,
        10, 8,
        14, 12
      ],
      'circle-color': [
        'match',
        ['get', 'sequencing_status'],
        'Sequenced', STATUS_COLORS['Sequenced'],
        'Tissue Available', STATUS_COLORS['Tissue Available'],
        'Preserved Specimen', STATUS_COLORS['Preserved Specimen'],
        'Published', STATUS_COLORS['Published'],
        'GBIF Record', STATUS_COLORS['GBIF Record'],
        'Observation', STATUS_COLORS['Observation'],
        'Museum Specimen', STATUS_COLORS['Museum Specimen'],
        'Living Specimen', STATUS_COLORS['Living Specimen'],
        '#6b7280' // default gray
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': [
        'interpolate', ['linear'], ['zoom'],
        3, 0.5,
        10, 1.5
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.6
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // HIGHLIGHT LAYER (for hover on individual points)
  // ─────────────────────────────────────────────────────────────────────────
  map.addLayer({
    id: 'points-highlight',
    type: 'circle',
    source: 'points-source',
    filter: ['all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'id'], '']
    ],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        3, 6,
        6, 10,
        10, 14,
        14, 18
      ],
      'circle-color': 'transparent',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // CLUSTER CLICK - zoom into cluster
  // ─────────────────────────────────────────────────────────────────────────
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
    if (!features.length) return

    const clusterId = features[0].properties.cluster_id
    const source = map.getSource('points-source')

    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return

      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom + 0.5
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // INDIVIDUAL POINT CLICK - show popup
  // ─────────────────────────────────────────────────────────────────────────
  map.on('click', 'points-layer', (e) => {
    if (!e.features || e.features.length === 0) return

    const feature = e.features[0]
    const props = feature.properties
    const coords = feature.geometry.coordinates.slice()

    // Close existing popup
    if (popup) popup.remove()

    // Build popup content
    const content = buildPopupContent(props)

    popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '340px',
      className: 'custom-popup'
    })
      .setLngLat(coords)
      .setHTML(content)
      .addTo(map)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // HOVER EFFECTS
  // ─────────────────────────────────────────────────────────────────────────
  map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer'
  })

  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = ''
  })

  map.on('mouseenter', 'points-layer', (e) => {
    map.getCanvas().style.cursor = 'pointer'

    if (e.features && e.features.length > 0) {
      const id = e.features[0].properties.id
      map.setFilter('points-highlight', ['all',
        ['!', ['has', 'point_count']],
        ['==', ['get', 'id'], id]
      ])
    }
  })

  map.on('mouseleave', 'points-layer', () => {
    map.getCanvas().style.cursor = ''
    map.setFilter('points-highlight', ['all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'id'], '']
    ])
  })

  // Fit bounds to data (with padding)
  fitBoundsToData(geojson)
}

// ═══════════════════════════════════════════════════════════════════════════
// POPUP BUILDER
// ═══════════════════════════════════════════════════════════════════════════

const buildPopupContent = (props) => {
  // Parse props (MapLibre stringifies nested objects)
  const p = typeof props === 'string' ? JSON.parse(props) : props

  const statusColor = STATUS_COLORS[p.sequencing_status] || '#6b7280'
  const showThumbnail = store.showThumbnail
  const hasImage = p.image_url && p.image_url !== 'null' && p.image_url !== ''

  let html = `<div class="popup-content">`

  // Header with species name
  html += `
    <div class="popup-header">
      <span class="status-dot" style="background: ${statusColor}"></span>
      <strong>${p.scientific_name || 'Unknown'}</strong>
    </div>
    <div class="popup-body">
  `

  // Thumbnail on the left (if enabled and available)
  if (showThumbnail && hasImage) {
    html += `
      <div class="popup-thumbnail">
        <img src="${p.image_url}" alt="Specimen ${p.id}" loading="lazy" onerror="this.style.display='none'" />
      </div>
    `
  }

  // Info section
  html += `<div class="popup-info">`

  // Subspecies
  if (p.subspecies && p.subspecies !== 'null' && p.subspecies !== 'None') {
    html += `<div class="popup-row"><span class="label">Subspecies:</span> <em>${p.subspecies}</em></div>`
  }

  // Core info
  html += `
    <div class="popup-row"><span class="label">ID:</span> ${p.id || 'N/A'}</div>
    <div class="popup-row"><span class="label">Status:</span> <span style="color: ${statusColor}">${p.sequencing_status || 'Unknown'}</span></div>
    <div class="popup-row"><span class="label">Source:</span> ${p.source || 'Unknown'}</div>
  `

  // Mimicry ring
  if (p.mimicry_ring && p.mimicry_ring !== 'Unknown' && p.mimicry_ring !== 'null') {
    html += `<div class="popup-row"><span class="label">Mimicry Ring:</span> ${p.mimicry_ring}</div>`
  }

  // Country
  if (p.country && p.country !== 'null' && p.country !== 'Unknown') {
    html += `<div class="popup-row"><span class="label">Country:</span> ${p.country}</div>`
  }

  // Coordinates
  if (p.lat && p.lng) {
    html += `<div class="popup-row"><span class="label">Coordinates:</span> ${parseFloat(p.lat).toFixed(4)}, ${parseFloat(p.lng).toFixed(4)}</div>`
  }

  html += `</div>` // close popup-info
  html += `</div>` // close popup-body
  html += `</div>` // close popup-content
  return html
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

// Watch for filter changes and update the map
watch(
  () => store.filteredGeoJSON,
  (newData) => {
    if (!map || !map.isStyleLoaded()) return

    const source = map.getSource('points-source')
    if (source) {
      source.setData(newData || { type: 'FeatureCollection', features: [] })

      // Auto-zoom to fit filtered data
      fitBoundsToData(newData)
    } else {
      addDataLayer()
    }
  },
  { deep: true }
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
      // Re-add the data layer with current filtered data
      addDataLayer()
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
      addDataLayer()
    }
  })
}
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map"></div>
    
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

    <!-- Legend -->
    <div class="legend">
      <div class="legend-title">Sequencing Status</div>
      <div 
        v-for="(color, status) in STATUS_COLORS" 
        :key="status" 
        class="legend-item"
      >
        <span class="legend-dot" :style="{ background: color }"></span>
        <span>{{ status }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map {
  width: 100%;
  height: 100%;
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
  bottom: 30px;
  left: 10px;
  background: rgba(26, 26, 46, 0.95);
  padding: 12px 16px;
  border-radius: 8px;
  z-index: 10;
  min-width: 160px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

.legend-title {
  font-size: 0.7rem;
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
  font-size: 0.8em;
  color: #e0e0e0;
  margin-bottom: 6px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
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
</style>
