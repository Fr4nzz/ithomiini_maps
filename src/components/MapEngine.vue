<script setup>
import { onMounted, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDataStore } from '../stores/data'

const mapContainer = ref(null)
const store = useDataStore()
let map = null

onMounted(async () => {
  // 1. Initialize Map
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://demotiles.maplibre.org/style.json', // Free open vector style
    center: [-75, -5], // Focus on South America
    zoom: 4
  })

  // 2. Load Data (if not already loaded)
  if (!store.allFeatures.length) {
    await store.loadMapData()
  }

  // 3. Add Data & Layers when Map is Ready
  map.on('load', () => {
    initializeLayers()
  })
})

// --- REACTIVITY: Watch for Filter Changes ---
watch(() => store.filteredGeoJSON, (newData) => {
  if (map && map.getSource('butterflies') && newData) {
    // efficient update without reloading map
    map.getSource('butterflies').setData(newData)
  }
})

const initializeLayers = () => {
  if (!store.filteredGeoJSON) return

  // Add Source (Using the Filtered Data)
  map.addSource('butterflies', {
    type: 'geojson',
    data: store.filteredGeoJSON
  })

  // Add Layer: Circles colored by Status
  map.addLayer({
    id: 'butterfly-points',
    type: 'circle',
    source: 'butterflies',
    paint: {
      // Dynamic Size
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        3, 2,
        10, 6
      ],
      // Dynamic Color
      'circle-color': [
        'match',
        ['get', 'status'],
        'Sequenced', '#3b82f6',         // Blue
        'Tissue Available', '#10b981',  // Green
        'Preserved Specimen', '#ef4444',// Red
        '#888888'                       // Grey Default
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff'
    }
  })

  // Add Popups
  map.on('click', 'butterfly-points', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice()
    const props = e.features[0].properties

    // Handle "No ID" case for display
    const displayId = props.id || 'No ID'

    new maplibregl.Popup()
      .setLngLat(coordinates)
      .setHTML(`
        <div style="font-family: sans-serif; padding: 5px;">
          <strong style="font-size:1.1em">${displayId}</strong><br>
          <hr style="margin: 5px 0; opacity: 0.3">
          <strong>Status:</strong> ${props.status}<br>
          <strong>Scientific Name:</strong> <i>${props.scientific_name}</i><br>
          <strong>Mimicry:</strong> ${props.mimicry}<br>
          <small style="color:#666">${props.source}</small>
        </div>
      `)
      .addTo(map)
  })

  // Cursor Effects
  map.on('mouseenter', 'butterfly-points', () => map.getCanvas().style.cursor = 'pointer')
  map.on('mouseleave', 'butterfly-points', () => map.getCanvas().style.cursor = '')
}
</script>

<template>
  <div class="map-wrap">
    <div ref="mapContainer" class="map"></div>
    
    <!-- Loading Indicator -->
    <div v-if="store.loading" class="loading-overlay">
      <div class="spinner"></div>
      <div>Loading Records...</div>
    </div>
  </div>
</template>

<style scoped>
.map-wrap {
  position: relative;
  width: 100%; /* Take full available width */
  height: 100%; /* Take full available height */
}
.map {
  width: 100%;
  height: 100%;
}

/* Loading Styles */
.loading-overlay {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  color: black;
  padding: 10px 20px;
  border-radius: 30px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  z-index: 10;
}
.spinner {
  width: 15px;
  height: 15px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* --- POPUP CSS FIXES (Overrides Dark Mode) --- */
:deep(.maplibregl-popup-content) {
  background: white !important;
  color: #333 !important;
  border-radius: 8px;
  padding: 15px 10px 10px 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  min-width: 200px;
}

:deep(.maplibregl-popup-close-button) {
  color: #555 !important;
  font-size: 20px;
  right: 5px;
  top: 5px;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  outline: none !important;
  width: auto !important;
  height: auto !important;
  cursor: pointer !important;
}

:deep(.maplibregl-popup-close-button:hover) {
  color: #000 !important;
  background-color: transparent !important;
}
</style>