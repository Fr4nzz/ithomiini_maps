<script setup>
import { ref, onMounted, provide } from 'vue'
import { useDataStore } from './stores/data'
import Sidebar from './components/Sidebar.vue'
import MapEngine from './components/MapEngine.vue'
import DataTable from './components/DataTable.vue'
import ExportPanel from './components/ExportPanel.vue'
import MimicrySelector from './components/MimicrySelector.vue'
import ImageGallery from './components/ImageGallery.vue'
import { ASPECT_RATIOS } from './utils/constants'
import {
  loadImage,
  drawLegendOnCanvas,
  drawScaleBarOnCanvas,
  drawAttributionOnCanvas,
  calculateScaleBarParams
} from './utils/canvasHelpers'

const store = useDataStore()

// View state
const currentView = ref('map') // 'map' or 'table'

// Modal states
const showExportPanel = ref(false)
const showMimicrySelector = ref(false)
const showImageGallery = ref(false)
const exportPanelInitialTab = ref('export') // 'export' for data, 'citation' for citation

// Map reference for export
const mapRef = ref(null)

// View control
const setView = (view) => {
  currentView.value = view
}

// Modal controls
const openExport = () => {
  exportPanelInitialTab.value = 'export'
  showExportPanel.value = true
}
const openExportForR = () => {
  exportPanelInitialTab.value = 'export'  // R export is in the export tab
  showExportPanel.value = true
}
const closeExport = () => { showExportPanel.value = false }

const openMimicrySelector = () => { showMimicrySelector.value = true }
const closeMimicrySelector = () => { showMimicrySelector.value = false }

const openImageGallery = () => { showImageGallery.value = true }
const closeImageGallery = () => { showImageGallery.value = false }

// Calculate export hole position (same as preview overlay)
const calculateExportHole = (containerWidth, containerHeight) => {
  const ratio = store.exportSettings.aspectRatio
  let targetWidth, targetHeight
  if (ratio === 'custom') {
    targetWidth = store.exportSettings.customWidth
    targetHeight = store.exportSettings.customHeight
  } else {
    const dims = ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
    targetWidth = dims.width
    targetHeight = dims.height
  }
  const targetAspectRatio = targetWidth / targetHeight
  const containerAspectRatio = containerWidth / containerHeight
  const maxPercent = 92
  let holeWidthPercent, holeHeightPercent
  if (targetAspectRatio > containerAspectRatio) {
    holeWidthPercent = maxPercent
    holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
  } else {
    holeHeightPercent = maxPercent
    holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio
  }
  const xPercent = Math.max(2, (100 - holeWidthPercent) / 2)
  const yPercent = Math.max(2, (100 - holeHeightPercent) / 2)
  return {
    x: (xPercent / 100) * containerWidth,
    y: (yPercent / 100) * containerHeight,
    width: (Math.min(96, holeWidthPercent) / 100) * containerWidth,
    height: (Math.min(96, holeHeightPercent) / 100) * containerHeight
  }
}

// Direct export function for Export Map button
const directExportMap = async () => {
  if (!mapRef.value) {
    alert('Map not available. Please ensure you are on the Map view.')
    return
  }

  try {
    const map = mapRef.value

    // Ensure map style is loaded
    if (!map.isStyleLoaded()) {
      await new Promise(resolve => map.once('style.load', resolve))
    }

    // Wait for map to be idle (all tiles loaded)
    if (!map.areTilesLoaded()) {
      await new Promise(resolve => map.once('idle', resolve))
    }

    // Force a fresh render
    map.triggerRepaint()
    await new Promise(resolve => map.once('idle', resolve))

    // Get the map canvas and container dimensions
    const mapCanvas = map.getCanvas()
    const container = map.getContainer()
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const pixelRatio = window.devicePixelRatio || 1

    // Calculate the export hole (preview region) in container pixels
    const hole = calculateExportHole(containerWidth, containerHeight)

    // Scale to canvas pixels (accounting for devicePixelRatio)
    const cropX = Math.round(hole.x * pixelRatio)
    const cropY = Math.round(hole.y * pixelRatio)
    const cropW = Math.round(hole.width * pixelRatio)
    const cropH = Math.round(hole.height * pixelRatio)

    // Calculate output dimensions with DPI scale
    const ratio = store.exportSettings.aspectRatio
    let baseWidth, baseHeight
    if (ratio === 'custom') {
      baseWidth = store.exportSettings.customWidth
      baseHeight = store.exportSettings.customHeight
    } else {
      const dims = ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
      baseWidth = dims.width
      baseHeight = dims.height
    }
    const dpiScale = store.exportSettings.dpi / 100
    const exportWidth = Math.round(baseWidth * dpiScale)
    const exportHeight = Math.round(baseHeight * dpiScale)

    console.log('[Export] Cropping preview region:', {
      container: `${containerWidth}x${containerHeight}`,
      pixelRatio,
      cropRegion: `${cropX},${cropY} ${cropW}x${cropH}`,
      canvasSize: `${mapCanvas.width}x${mapCanvas.height}`,
      outputSize: `${exportWidth}x${exportHeight}`
    })

    // Create output canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = exportWidth
    canvas.height = exportHeight

    // Fill with dark background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Capture the map as image
    const mapDataUrl = mapCanvas.toDataURL('image/png')
    const mapImage = await loadImage(mapDataUrl)

    // Draw ONLY the cropped region (preview rectangle), scaled to output
    ctx.drawImage(
      mapImage,
      cropX, cropY, cropW, cropH,  // Source: preview rectangle
      0, 0, canvas.width, canvas.height  // Destination: full output
    )

    // Draw legend if enabled
    if (store.exportSettings.includeLegend && store.legendSettings.showLegend) {
      drawLegendOnCanvas(ctx, canvas.width, canvas.height, {
        colorMap: store.activeColorMap,
        legendSettings: store.legendSettings,
        exportSettings: store.exportSettings,
        colorBy: store.colorBy,
        legendTitle: store.legendTitle,
      })
    }

    // Draw scale bar if enabled
    if (store.exportSettings.includeScaleBar) {
      // Calculate accurate scale bar parameters for the preview rectangle
      const scaleBarParams = calculateScaleBarParams(map, hole, exportWidth)
      drawScaleBarOnCanvas(ctx, canvas.width, canvas.height, {
        legendSettings: store.legendSettings,
        exportSettings: store.exportSettings,
        scaleBarText: scaleBarParams.text,
        scaleBarWidth: scaleBarParams.barWidth,
      })
    }

    // Draw attribution
    drawAttributionOnCanvas(ctx, canvas.width, canvas.height, {
      exportSettings: store.exportSettings,
    })

    // Download the image in selected format
    const format = store.exportSettings.format || 'png'
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
    const quality = format === 'jpg' ? 0.95 : 1.0
    const dataUrl = canvas.toDataURL(mimeType, quality)
    const link = document.createElement('a')
    link.download = `ithomiini_map_${exportWidth}x${exportHeight}_${Date.now()}.${format}`
    link.href = dataUrl
    link.click()

  } catch (e) {
    console.error('Image export failed:', e)
    alert('Export failed: ' + e.message)
  }
}

// Receive map instance from MapEngine
const onMapReady = (map) => {
  mapRef.value = map
}

// Provide modal openers to children
provide('openMimicrySelector', openMimicrySelector)
provide('openImageGallery', openImageGallery)

onMounted(() => {
  store.loadMapData()
  
  // Check URL for view param
  const params = new URLSearchParams(window.location.search)
  if (params.get('view') === 'table') {
    currentView.value = 'table'
  }
})
</script>

<template>
  <div class="app-container">
    <!-- Sidebar with filters -->
    <Sidebar
      @open-export="openExport"
      @open-mimicry="openMimicrySelector"
      @open-gallery="openImageGallery"
      @open-map-export="directExportMap"
      @export-for-r="openExportForR"
      :current-view="currentView"
      @set-view="setView"
    />
    
    <!-- Main content area -->
    <main class="main-content">
      <!-- View Toggle (visible on mobile) -->
      <div class="view-toggle-bar">
        <button 
          :class="{ active: currentView === 'map' }"
          @click="setView('map')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/>
            <line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          Map
        </button>
        <button 
          :class="{ active: currentView === 'table' }"
          @click="setView('table')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          Table
        </button>
        <button 
          class="btn-gallery-mobile"
          @click="openImageGallery"
          title="Open Gallery"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <button 
          class="btn-export-mobile"
          @click="openExport"
          title="Export Data"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="store.loading" class="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-text">Loading distribution data...</p>
          <p class="loading-subtext">Preparing records</p>
        </div>
      </div>

      <!-- Map View -->
      <MapEngine
        v-else-if="currentView === 'map'"
        class="view-container"
        @map-ready="onMapReady"
        @open-gallery="openImageGallery"
      />

      <!-- Table View -->
      <DataTable 
        v-else-if="currentView === 'table'"
        class="view-container"
      />
    </main>

    <!-- MODALS -->
    
    <!-- Export Panel Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showExportPanel" 
          class="modal-overlay"
          @click.self="closeExport"
        >
          <ExportPanel :map="mapRef" :initial-tab="exportPanelInitialTab" @close="closeExport" />
        </div>
      </Transition>
    </Teleport>

    <!-- Mimicry Selector Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showMimicrySelector"
          class="modal-overlay"
          @click.self="closeMimicrySelector"
        >
          <MimicrySelector @close="closeMimicrySelector" />
        </div>
      </Transition>
    </Teleport>

    <!-- Image Gallery (Full screen) -->
    <Teleport to="body">
      <Transition name="fade">
        <ImageGallery 
          v-if="showImageGallery" 
          @close="closeImageGallery" 
        />
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* Global Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.main-content {
  flex: 1;
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary, #1a1a2e);
}

.view-container {
  flex: 1;
  width: 100%;
  height: 100%;
}

/* View Toggle Bar (Desktop: hidden in sidebar, Mobile: visible) */
.view-toggle-bar {
  display: none;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--color-bg-secondary, #252540);
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.view-toggle-bar button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle-bar button:hover {
  background: #353558;
  color: var(--color-text-secondary, #aaa);
}

.view-toggle-bar button.active {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-color: var(--color-accent, #4ade80);
}

.view-toggle-bar button svg {
  width: 16px;
  height: 16px;
}

.btn-gallery-mobile {
  margin-left: auto;
}

.btn-export-mobile {
  margin-left: 4px;
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #252540 100%);
  z-index: 100;
}

.loading-content {
  text-align: center;
}

.spinner {
  width: 60px;
  height: 60px;
  margin: 0 auto 24px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4ade80;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 1.2em;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.loading-subtext {
  font-size: 0.9em;
  color: #666;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active > *,
.modal-leave-active > * {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > *,
.modal-leave-to > * {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}

/* Fade transition for gallery */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive Layout */
@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }
  
  .view-toggle-bar {
    display: flex;
  }
}
</style>
