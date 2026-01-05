<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDataStore } from '../stores/data'
import PointPopup from './PointPopup.vue'
import { ASPECT_RATIOS } from '../utils/constants'
import {
  MAP_STYLES,
  getStylesByTheme,
  useLocationSearch,
  useExportPreview,
  useScatterVisualization,
  useDataLayer,
  useStyleSwitcher,
  useCountryBoundaries
} from '../composables/useMapEngine'

const store = useDataStore()
const emit = defineEmits(['map-ready', 'open-gallery'])
const mapWrapper = ref(null) // Parent wrapper element
const mapContainer = ref(null)
const pointPopupContainer = ref(null)
const map = ref(null)
let popup = null

// Wrapper size (the available space) for accurate export preview calculations
const wrapperSize = ref({ width: 1600, height: 900 })
let wrapperResizeObserver = null
let mapContainerResizeObserver = null

// Enhanced popup state for multi-point locations
const showEnhancedPopup = ref(false)
const enhancedPopupData = ref({
  coordinates: { lat: 0, lng: 0 },
  points: []
})

// Initialize composables
const {
  searchQuery,
  searchResults,
  isSearching,
  showSearchResults,
  searchInputRef,
  onSearchInput,
  selectSearchResult,
  handleClickOutside,
  clearSearch,
  cleanup: cleanupSearch
} = useLocationSearch(map)

const { legendTransformOrigin } = useExportPreview(wrapperSize)
const { updateScatterVisualization } = useScatterVisualization(map)

// Popup handler for data layer
const handleShowPopup = (data) => {
  if (popup) popup.remove()
  showEnhancedPopup.value = false

  enhancedPopupData.value = {
    coordinates: data.coordinates,
    points: data.points,
    initialSpecies: data.initialSpecies || null,
    initialSubspecies: data.initialSubspecies || null
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
          .setLngLat(data.lngLat)
          .setDOMContent(pointPopupContainer.value)
          .addTo(map.value)

        popup.on('close', () => {
          showEnhancedPopup.value = false
        })
      }
    })
  })
}

const { addDataLayer, fitBoundsToData } = useDataLayer(map, { onShowPopup: handleShowPopup })
const { currentStyle, switchStyle } = useStyleSwitcher(map, addDataLayer)
const { showBoundaries, toggleBoundaries, addBoundariesLayer } = useCountryBoundaries(map)

// Map layer dropdown
const showMapLayerDropdown = ref(false)
const stylesByTheme = getStylesByTheme()
const mapLayerDropdownRef = ref(null)

// Select a map style from dropdown
const selectMapStyle = (styleKey) => {
  switchStyle(styleKey)
  showMapLayerDropdown.value = false
  // Re-add boundaries after style change
  setTimeout(() => {
    if (showBoundaries.value) {
      addBoundariesLayer()
    }
  }, 500)
}

// Get current style name
const currentStyleName = computed(() => {
  return MAP_STYLES[currentStyle.value]?.name || 'Dark'
})

// Close dropdown when clicking outside
const handleMapLayerClickOutside = (event) => {
  if (mapLayerDropdownRef.value && !mapLayerDropdownRef.value.contains(event.target)) {
    showMapLayerDropdown.value = false
  }
}

// Legend position class based on store settings
const legendPositionClass = computed(() => {
  return `legend-${store.legendSettings.position}`
})

// Compute map container styles for export aspect ratio
const mapContainerStyle = computed(() => {
  if (!store.exportSettings.enabled) {
    return {} // Full size when not in export mode
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
    return {}
  }

  const targetAspectRatio = targetWidth / targetHeight
  const wrapperWidth = wrapperSize.value.width
  const wrapperHeight = wrapperSize.value.height
  const wrapperAspectRatio = wrapperWidth / wrapperHeight

  // Calculate actual pixel dimensions that fit within wrapper while maintaining aspect ratio
  let mapWidth, mapHeight
  if (targetAspectRatio >= wrapperAspectRatio) {
    // Target is wider - constrain by width, calculate height
    mapWidth = wrapperWidth
    mapHeight = wrapperWidth / targetAspectRatio
  } else {
    // Target is taller - constrain by height, calculate width
    mapHeight = wrapperHeight
    mapWidth = wrapperHeight * targetAspectRatio
  }

  // Debug logging
  console.log('[Export Preview Debug]', {
    wrapperSize: `${wrapperWidth.toFixed(0)}x${wrapperHeight.toFixed(0)}`,
    wrapperAspectRatio: wrapperAspectRatio.toFixed(3),
    targetRatio: ratio,
    targetAspectRatio: targetAspectRatio.toFixed(3),
    calculatedMapSize: `${mapWidth.toFixed(0)}x${mapHeight.toFixed(0)}`,
    comparison: targetAspectRatio >= wrapperAspectRatio ? 'target WIDER - constrain by width' : 'target TALLER - constrain by height'
  })

  const style = {
    width: `${mapWidth}px`,
    height: `${mapHeight}px`
  }
  console.log('[Export Preview] Applied style:', style)
  return style
})

// Limit color map items for legend display
const limitedColorMap = computed(() => {
  const colorMap = store.activeColorMap
  const maxItems = store.legendSettings.maxItems
  const entries = Object.entries(colorMap)

  if (entries.length <= maxItems) {
    return colorMap
  }

  const limited = {}
  entries.slice(0, maxItems).forEach(([key, value]) => {
    limited[key] = value
  })
  return limited
})

// Lifecycle
onMounted(() => {
  initMap()
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('click', handleMapLayerClickOutside)

  // Set up ResizeObserver on WRAPPER for calculating export preview dimensions
  if (mapWrapper.value) {
    wrapperSize.value = {
      width: mapWrapper.value.clientWidth,
      height: mapWrapper.value.clientHeight
    }
    console.log('[Export Preview] Initial wrapper size:', wrapperSize.value)

    wrapperResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        wrapperSize.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.height
        }
        console.log('[Export Preview] Wrapper resized:', wrapperSize.value)
      }
    })
    wrapperResizeObserver.observe(mapWrapper.value)
  }

  // Set up ResizeObserver on MAP CONTAINER to trigger MapLibre resize when container dimensions change
  // This is critical: MapLibre needs to resize its canvas when the container size changes
  if (mapContainer.value) {
    mapContainerResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        console.log('[Export Preview] Map container resized to:', {
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
        // Tell MapLibre to resize its canvas to match the new container dimensions
        if (map.value) {
          map.value.resize()
          console.log('[Export Preview] Called map.resize()')
        }
      }
    })
    mapContainerResizeObserver.observe(mapContainer.value)
  }
})

onUnmounted(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
  if (wrapperResizeObserver) {
    wrapperResizeObserver.disconnect()
    wrapperResizeObserver = null
  }
  if (mapContainerResizeObserver) {
    mapContainerResizeObserver.disconnect()
    mapContainerResizeObserver = null
  }
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleMapLayerClickOutside)
  cleanupSearch()
})

// Map initialization
const initMap = () => {
  const styleConfig = MAP_STYLES[currentStyle.value]

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: styleConfig.style,
    center: [-60, -5],
    zoom: 4,
    attributionControl: false,
    maxZoom: 18,
    minZoom: 2,
    canvasContextAttributes: {
      preserveDrawingBuffer: true
    }
  })

  map.value.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.value.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-right')
  map.value.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
  map.value.addControl(new maplibregl.FullscreenControl(), 'top-right')

  map.value.on('load', () => {
    addDataLayer()
    emit('map-ready', map.value)
  })
}

// Track previous data length to detect actual data changes
let previousDataLength = 0
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

// Watch for displayGeoJSON changes
watch(
  () => store.displayGeoJSON,
  (newData) => {
    if (!map.value || !map.value.isStyleLoaded()) return

    const newLength = newData?.features?.length || 0
    const currentScatterState = store.scatterOverlappingPoints

    const scatterJustToggled = currentScatterState !== previousScatterState
    previousScatterState = currentScatterState

    const dataLengthChanged = newLength !== previousDataLength
    previousDataLength = newLength

    const shouldSkipZoom = !dataLengthChanged || scatterJustToggled

    addDataLayer({ skipZoom: shouldSkipZoom })

    if (store.scatterOverlappingPoints) {
      updateScatterVisualization()
    }
  },
  { deep: true }
)

// Watch for scatter toggle changes
watch(
  () => store.scatterOverlappingPoints,
  () => {
    if (!map.value || !map.value.isStyleLoaded()) return
    updateScatterVisualization()
  }
)

// Watch for clustering settings changes
watch(
  [() => store.clusteringEnabled, () => store.clusterSettings],
  () => {
    if (!map.value || !map.value.isStyleLoaded()) return
    addDataLayer({ skipZoom: true })
  },
  { deep: true }
)

// Watch for color and style settings changes
watch(
  [() => store.colorBy, () => store.mapStyle],
  () => {
    if (!map.value || !map.value.isStyleLoaded()) return
    addDataLayer({ skipZoom: true })
  },
  { deep: true }
)

// Watch for export settings changes
// Note: map.resize() is handled by the mapContainerResizeObserver when container dimensions change
watch(
  [() => store.exportSettings.enabled, () => store.exportSettings.aspectRatio, () => store.exportSettings.customWidth, () => store.exportSettings.customHeight],
  () => {
    // Debug: log when export settings change
    console.log('[Export Preview] Export settings changed:', {
      enabled: store.exportSettings.enabled,
      aspectRatio: store.exportSettings.aspectRatio
    })
  }
)

// Watch for focusPoint changes
watch(
  () => store.focusPoint,
  (point) => {
    if (!point || !map.value) return

    if (popup) popup.remove()
    showEnhancedPopup.value = false

    map.value.flyTo({
      center: [point.lng, point.lat],
      zoom: 12,
      duration: 1500
    })

    map.value.once('moveend', () => {
      const pointsAtLocation = store.getPointsAtCoordinates(point.lat, point.lng)

      enhancedPopupData.value = {
        coordinates: { lat: point.lat, lng: point.lng },
        points: pointsAtLocation.length > 0 ? pointsAtLocation : [point.properties],
        initialSpecies: point.properties?.scientific_name,
        initialSubspecies: point.properties?.subspecies
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
              .setLngLat([point.lng, point.lat])
              .setDOMContent(pointPopupContainer.value)
              .addTo(map.value)

            popup.on('close', () => {
              showEnhancedPopup.value = false
            })
          }
        })
      })

      store.focusPoint = null
    })
  }
)
</script>

<template>
  <div ref="mapWrapper" class="map-wrapper" :class="{ 'export-mode': store.exportSettings.enabled }">
    <div
      ref="mapContainer"
      class="map"
      :class="{ 'map-export-preview': store.exportSettings.enabled }"
      :style="mapContainerStyle"
    >
      <!-- Legend INSIDE map container so it gets captured in export -->
      <div
        v-if="store.legendSettings.showLegend"
        class="legend"
        :class="[legendPositionClass, { 'legend-export': store.exportSettings.enabled && store.exportSettings.includeLegend }]"
        :style="{
          fontSize: store.exportSettings.enabled
            ? (store.legendSettings.textSize * store.exportSettings.uiScale) + 'rem'
            : store.legendSettings.textSize + 'rem',
          transform: store.exportSettings.enabled ? 'scale(' + store.exportSettings.uiScale + ')' : 'none',
          transformOrigin: legendTransformOrigin,
          display: store.exportSettings.enabled && !store.exportSettings.includeLegend ? 'none' : 'block'
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
    </div>

    <!-- Export info badge (shown when in export mode) -->
    <div v-if="store.exportSettings.enabled" class="export-info-badge">
      <span class="export-ratio">{{ store.exportSettings.aspectRatio }}</span>
      <span class="export-dimensions">{{ ASPECT_RATIOS[store.exportSettings.aspectRatio]?.width || store.exportSettings.customWidth }} × {{ ASPECT_RATIOS[store.exportSettings.aspectRatio]?.height || store.exportSettings.customHeight }}</span>
    </div>

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

    <!-- Map Layer Controls -->
    <div ref="mapLayerDropdownRef" class="map-layer-controls">
      <!-- Base Map Dropdown -->
      <div class="map-layer-dropdown">
        <button
          class="dropdown-trigger"
          @click.stop="showMapLayerDropdown = !showMapLayerDropdown"
        >
          <svg class="layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          <span>{{ currentStyleName }}</span>
          <svg class="chevron" :class="{ open: showMapLayerDropdown }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <Transition name="dropdown">
          <div v-if="showMapLayerDropdown" class="dropdown-menu">
            <!-- Day Themes -->
            <div class="theme-group">
              <div class="theme-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                Day
              </div>
              <button
                v-for="style in stylesByTheme.day"
                :key="style.key"
                :class="{ active: currentStyle === style.key }"
                @click="selectMapStyle(style.key)"
              >
                {{ style.name }}
              </button>
            </div>

            <!-- Night Themes -->
            <div class="theme-group">
              <div class="theme-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                Night
              </div>
              <button
                v-for="style in stylesByTheme.night"
                :key="style.key"
                :class="{ active: currentStyle === style.key }"
                @click="selectMapStyle(style.key)"
              >
                {{ style.name }}
              </button>
            </div>

            <!-- Divider -->
            <div class="dropdown-divider"></div>

            <!-- Overlays -->
            <div class="overlay-section">
              <label class="overlay-toggle">
                <input
                  type="checkbox"
                  :checked="showBoundaries"
                  @change="toggleBoundaries"
                />
                <span>Country Borders</span>
              </label>
            </div>
          </div>
        </Transition>
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

/* Export mode: center the aspect-ratio constrained map */
.map-wrapper.export-mode {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d0d1a;
}

.map {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Export preview: map resizes to aspect ratio */
/* Width/height set dynamically via inline style based on aspect ratio comparison */
.map.map-export-preview {
  /* Reset to allow inline styles to control dimensions */
  width: auto;
  height: auto;
  /* CRITICAL: Clip MapLibre canvas to container bounds */
  overflow: hidden;
  border: 2px dashed rgba(74, 222, 128, 0.9);
  border-radius: 4px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
}

/* Force MapLibre's internal elements to respect container bounds */
.map.map-export-preview :deep(.maplibregl-canvas-container),
.map.map-export-preview :deep(.maplibregl-canvas),
.map.map-export-preview :deep(.maplibregl-control-container) {
  /* Override MapLibre's absolute positioning to respect container size */
  max-width: 100% !important;
  max-height: 100% !important;
}

.map.map-export-preview :deep(.maplibregl-canvas) {
  /* Force canvas to fit within container */
  width: 100% !important;
  height: 100% !important;
  object-fit: contain;
}

/* Export info badge */
.export-info-badge {
  position: absolute;
  top: 15px;
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
  z-index: 20;
}

.export-info-badge .export-ratio {
  font-size: 0.85em;
  font-weight: 700;
  color: #4ade80;
}

.export-info-badge .export-dimensions {
  font-size: 0.75em;
  color: #aaa;
  font-family: monospace;
}

/* MapLibre Controls Customization */
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

:deep(.maplibregl-ctrl-compass) {
  position: relative;
}

:deep(.maplibregl-ctrl-compass .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-compass:hover .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(80%) sepia(50%) saturate(500%) hue-rotate(90deg) brightness(100%) contrast(100%);
}

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

:deep(.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon),
:deep(.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-zoom-in:hover .maplibregl-ctrl-icon),
:deep(.maplibregl-ctrl-zoom-out:hover .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(80%) sepia(50%) saturate(500%) hue-rotate(90deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-fullscreen:hover .maplibregl-ctrl-icon) {
  filter: brightness(0) saturate(100%) invert(80%) sepia(50%) saturate(500%) hue-rotate(90deg) brightness(100%) contrast(100%);
}

:deep(.maplibregl-ctrl-scale) {
  background: rgba(26, 26, 46, 0.8) !important;
  border: 1px solid #3d3d5c !important;
  border-radius: 4px !important;
  color: #aaa !important;
  font-size: 10px !important;
  padding: 2px 6px !important;
}

/* Location Search */
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

/* Map Layer Controls */
.map-layer-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 20;
}

.map-layer-dropdown {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid #3d3d5c;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

.dropdown-trigger:hover {
  background: rgba(37, 37, 64, 0.98);
  border-color: #4d4d6c;
}

.dropdown-trigger .layer-icon {
  width: 16px;
  height: 16px;
  color: #4ade80;
}

.dropdown-trigger .chevron {
  width: 14px;
  height: 14px;
  color: #888;
  transition: transform 0.2s;
}

.dropdown-trigger .chevron.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 180px;
  background: rgba(26, 26, 46, 0.98);
  border: 1px solid #3d3d5c;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.theme-group {
  padding: 8px 0;
}

.theme-group:first-child {
  padding-top: 4px;
}

.theme-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
}

.theme-label svg {
  width: 12px;
  height: 12px;
}

.theme-group button {
  display: block;
  width: 100%;
  padding: 8px 12px 8px 30px;
  background: transparent;
  border: none;
  color: #c0c0c0;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.theme-group button:hover {
  background: #2d2d4a;
  color: #fff;
}

.theme-group button.active {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.theme-group button.active::before {
  content: '✓';
  position: absolute;
  left: 12px;
  color: #4ade80;
}

.dropdown-divider {
  height: 1px;
  background: #3d3d5c;
  margin: 4px 0;
}

.overlay-section {
  padding: 8px 12px;
}

.overlay-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #c0c0c0;
}

.overlay-toggle:hover {
  color: #e0e0e0;
}

.overlay-toggle input[type="checkbox"] {
  accent-color: #4ade80;
  width: 14px;
  height: 14px;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Legend */
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

.legend-bottom-left { bottom: 30px; left: 10px; }
.legend-bottom-right { bottom: 30px; right: 10px; }
.legend-top-left { top: 60px; left: 10px; }
.legend-top-right { top: 60px; right: 10px; }

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

.legend-item:last-child { margin-bottom: 0; }
.legend-label-italic { font-style: italic; }

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

/* Popup Styles */
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

:deep(.popup-content) { padding: 14px 18px; }

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

/* Responsive */
@media (max-width: 768px) {
  .location-search {
    top: 56px;
    left: 10px;
    right: 10px;
    width: auto;
  }

  .map-layer-controls {
    top: 10px;
    left: 10px;
  }

  .dropdown-trigger {
    padding: 6px 10px;
    font-size: 0.75rem;
  }

  .dropdown-trigger .layer-icon {
    width: 14px;
    height: 14px;
  }

  .dropdown-menu {
    min-width: 160px;
  }

  .legend {
    bottom: 100px;
    font-size: 0.9em;
  }
}

/* Enhanced Popup */
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
