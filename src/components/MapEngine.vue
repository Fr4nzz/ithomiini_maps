<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDataStore } from '../stores/data'

const store = useDataStore()
const mapContainer = ref(null)
let map = null
let popup = null

// Map style options
const MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  satellite: 'https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_key'
}

const currentStyle = ref('dark')

// Color mapping for sequencing status
const STATUS_COLORS = {
  'Sequenced': '#3b82f6',        // Blue
  'Tissue Available': '#10b981', // Green  
  'Preserved Specimen': '#f59e0b', // Orange
  'Published': '#a855f7',        // Purple
  'GBIF Record': '#6b7280'       // Gray
}

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

const initMap = () => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: MAP_STYLES[currentStyle.value],
    center: [-60, -5], // South America center
    zoom: 4,
    attributionControl: false
  })

  // Add controls
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200 }), 'bottom-right')
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

  map.on('load', () => {
    addDataLayer()
  })
}

const addDataLayer = () => {
  if (!map) return

  // Remove existing layers/sources if they exist
  if (map.getLayer('points-layer')) map.removeLayer('points-layer')
  if (map.getSource('points-source')) map.removeSource('points-source')

  const geojson = store.filteredGeoJSON
  if (!geojson) return

  // Add source
  map.addSource('points-source', {
    type: 'geojson',
    data: geojson
  })

  // Add layer with data-driven styling
  map.addLayer({
    id: 'points-layer',
    type: 'circle',
    source: 'points-source',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        3, 3,
        8, 6,
        12, 10
      ],
      'circle-color': [
        'match',
        ['get', 'sequencing_status'],
        'Sequenced', STATUS_COLORS['Sequenced'],
        'Tissue Available', STATUS_COLORS['Tissue Available'],
        'Preserved Specimen', STATUS_COLORS['Preserved Specimen'],
        'Published', STATUS_COLORS['Published'],
        'GBIF Record', STATUS_COLORS['GBIF Record'],
        '#6b7280' // default gray
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.5
    }
  })

  // Click handler for popups
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
      maxWidth: '320px'
    })
      .setLngLat(coords)
      .setHTML(content)
      .addTo(map)
  })

  // Cursor change on hover
  map.on('mouseenter', 'points-layer', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'points-layer', () => {
    map.getCanvas().style.cursor = ''
  })

  // Fit bounds to data
  fitBoundsToData(geojson)
}

const buildPopupContent = (props) => {
  // Parse props (MapLibre stringifies nested objects)
  const p = typeof props === 'string' ? JSON.parse(props) : props
  
  const statusColor = STATUS_COLORS[p.sequencing_status] || '#6b7280'
  
  let html = `
    <div class="popup-content">
      <div class="popup-header">
        <span class="status-dot" style="background: ${statusColor}"></span>
        <strong>${p.scientific_name || 'Unknown'}</strong>
      </div>
  `

  if (p.subspecies && p.subspecies !== 'null') {
    html += `<div class="popup-row"><span class="label">Subspecies:</span> ${p.subspecies}</div>`
  }
  
  html += `
    <div class="popup-row"><span class="label">ID:</span> ${p.id || 'N/A'}</div>
    <div class="popup-row"><span class="label">Status:</span> ${p.sequencing_status || 'Unknown'}</div>
    <div class="popup-row"><span class="label">Source:</span> ${p.source || 'Unknown'}</div>
  `

  if (p.mimicry_ring && p.mimicry_ring !== 'Unknown') {
    html += `<div class="popup-row"><span class="label">Mimicry:</span> ${p.mimicry_ring}</div>`
  }

  if (p.country && p.country !== 'null') {
    html += `<div class="popup-row"><span class="label">Country:</span> ${p.country}</div>`
  }

  // Image thumbnail if available
  if (p.image_url && p.image_url !== 'null') {
    html += `
      <div class="popup-image">
        <img src="${p.image_url}" alt="Specimen" loading="lazy" />
      </div>
    `
  }

  html += '</div>'
  return html
}

const fitBoundsToData = (geojson) => {
  if (!geojson || !geojson.features || geojson.features.length === 0) return

  const bounds = new maplibregl.LngLatBounds()
  
  geojson.features.forEach(f => {
    bounds.extend(f.geometry.coordinates)
  })

  map.fitBounds(bounds, {
    padding: 50,
    maxZoom: 10,
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
    } else {
      addDataLayer()
    }
  },
  { deep: true }
)

// Style switcher
const switchStyle = (styleName) => {
  if (!map || !MAP_STYLES[styleName]) return
  currentStyle.value = styleName
  
  map.setStyle(MAP_STYLES[styleName])
  
  // Re-add data layer after style loads
  map.once('style.load', () => {
    addDataLayer()
  })
}
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map"></div>
    
    <!-- Style Switcher -->
    <div class="style-switcher">
      <button 
        v-for="(url, name) in MAP_STYLES" 
        :key="name"
        :class="{ active: currentStyle === name }"
        @click="switchStyle(name)"
        :disabled="name === 'satellite'"
        :title="name === 'satellite' ? 'Requires API key' : ''"
      >
        {{ name }}
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

/* Style Switcher */
.style-switcher {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 4px;
  background: rgba(26, 26, 46, 0.9);
  padding: 6px;
  border-radius: 8px;
  z-index: 10;
}

.style-switcher button {
  padding: 6px 12px;
  background: #252540;
  border: 1px solid #3d3d5c;
  color: #aaa;
  border-radius: 4px;
  font-size: 0.75em;
  text-transform: capitalize;
  cursor: pointer;
  transition: all 0.2s;
}

.style-switcher button:hover:not(:disabled) {
  background: #2d2d4a;
  color: #fff;
}

.style-switcher button.active {
  background: #4ade80;
  color: #1a1a2e;
  border-color: #4ade80;
}

.style-switcher button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Legend */
.legend {
  position: absolute;
  bottom: 30px;
  left: 10px;
  background: rgba(26, 26, 46, 0.95);
  padding: 12px 16px;
  border-radius: 8px;
  z-index: 10;
  min-width: 150px;
}

.legend-title {
  font-size: 0.75em;
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
}

/* Popup Styles */
:deep(.maplibregl-popup-content) {
  background: #1a1a2e !important;
  color: #e0e0e0 !important;
  border-radius: 8px;
  padding: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  border: 1px solid #3d3d5c;
}

:deep(.maplibregl-popup-close-button) {
  color: #888 !important;
  font-size: 18px;
  padding: 4px 8px;
}

:deep(.maplibregl-popup-close-button:hover) {
  color: #fff !important;
  background: transparent !important;
}

:deep(.maplibregl-popup-tip) {
  border-top-color: #1a1a2e !important;
}

:deep(.popup-content) {
  padding: 12px 16px;
}

:deep(.popup-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05em;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #3d3d5c;
}

:deep(.popup-header strong) {
  font-style: italic;
}

:deep(.status-dot) {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

:deep(.popup-row) {
  font-size: 0.85em;
  margin-bottom: 4px;
  color: #ccc;
}

:deep(.popup-row .label) {
  color: #888;
  margin-right: 4px;
}

:deep(.popup-image) {
  margin-top: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: #252540;
}

:deep(.popup-image img) {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  display: block;
}
</style>
