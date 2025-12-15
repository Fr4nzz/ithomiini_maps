<script setup>
import { ref, onMounted, provide } from 'vue'
import { useDataStore } from './stores/data'
import Sidebar from './components/Sidebar.vue'
import MapEngine from './components/MapEngine.vue'
import DataTable from './components/DataTable.vue'
import ExportPanel from './components/ExportPanel.vue'
import MimicrySelector from './components/MimicrySelector.vue'
import ImageGallery from './components/ImageGallery.vue'
import MapExport from './components/MapExport.vue'
import { Toaster } from '@/components/ui/sonner'

const store = useDataStore()

// View state
const currentView = ref('map') // 'map' or 'table'

// Modal states
const showExportPanel = ref(false)
const showMimicrySelector = ref(false)
const showImageGallery = ref(false)
const showMapExport = ref(false)

// Map reference for export
const mapRef = ref(null)

// View control
const setView = (view) => {
  currentView.value = view
}

// Modal controls
const openExport = () => { showExportPanel.value = true }
const closeExport = () => { showExportPanel.value = false }

const openMimicrySelector = () => { showMimicrySelector.value = true }
const closeMimicrySelector = () => { showMimicrySelector.value = false }

const openImageGallery = () => { showImageGallery.value = true }
const closeImageGallery = () => { showImageGallery.value = false }

const openMapExport = () => { showMapExport.value = true }
const closeMapExport = () => { showMapExport.value = false }

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT MAP EXPORT (used by top Export Map button)
// ═══════════════════════════════════════════════════════════════════════════

// Aspect ratio dimensions
const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1600, height: 1200 },
  '1:1': { width: 1200, height: 1200 },
  '3:2': { width: 1800, height: 1200 },
  'A4': { width: 2480, height: 3508 },
  'A4L': { width: 3508, height: 2480 },
}

// Helper to load image from data URL
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

// RoundRect helper
const roundRect = (ctx, x, y, w, h, r) => {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  return ctx
}

// Draw legend on canvas
const drawLegendOnCanvas = (ctx, width, height) => {
  const colorMap = store.activeColorMap
  const entries = Object.entries(colorMap).slice(0, store.legendSettings.maxItems)
  const uiScale = store.exportSettings.uiScale || 1

  const padding = 20 * uiScale
  const itemHeight = 24 * uiScale
  const legendWidth = 200 * uiScale
  const legendHeight = entries.length * itemHeight + 45 * uiScale

  // Position based on settings
  let x, y
  const pos = store.legendSettings.position
  if (pos === 'top-left') { x = padding; y = padding }
  else if (pos === 'top-right') { x = width - legendWidth - padding; y = padding }
  else if (pos === 'bottom-right') { x = width - legendWidth - padding; y = height - legendHeight - padding }
  else { x = padding; y = height - legendHeight - padding } // bottom-left default

  // Background
  ctx.fillStyle = 'rgba(26, 26, 46, 0.95)'
  roundRect(ctx, x, y, legendWidth, legendHeight, 8 * uiScale)
  ctx.fill()

  // Title
  ctx.fillStyle = '#888'
  ctx.font = `bold ${12 * uiScale}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(store.legendTitle.toUpperCase(), x + 12 * uiScale, y + 22 * uiScale)

  // Items
  ctx.font = `${13 * uiScale}px system-ui, sans-serif`
  entries.forEach(([label, color], i) => {
    const itemY = y + 40 * uiScale + i * itemHeight

    // Dot
    ctx.beginPath()
    ctx.arc(x + 18 * uiScale, itemY, 5 * uiScale, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Label
    ctx.fillStyle = '#e0e0e0'
    const isItalic = ['species', 'subspecies', 'genus'].includes(store.colorBy)
    ctx.font = isItalic
      ? `italic ${13 * uiScale}px system-ui, sans-serif`
      : `${13 * uiScale}px system-ui, sans-serif`
    ctx.fillText(label, x + 32 * uiScale, itemY + 4 * uiScale)
  })

  // "More" indicator
  if (Object.keys(colorMap).length > store.legendSettings.maxItems) {
    const moreY = y + legendHeight - 12 * uiScale
    ctx.fillStyle = '#666'
    ctx.font = `italic ${11 * uiScale}px system-ui, sans-serif`
    ctx.fillText(`+ ${Object.keys(colorMap).length - store.legendSettings.maxItems} more`, x + 12 * uiScale, moreY)
  }
}

// Draw scale bar on canvas
const drawScaleBarOnCanvas = (ctx, width, height) => {
  const uiScale = store.exportSettings.uiScale || 1
  const padding = 20 * uiScale
  const barWidth = 100 * uiScale
  const barHeight = 4 * uiScale

  // Position: bottom-right, or bottom-left if legend is bottom-right
  let x
  if (store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend) {
    x = padding
  } else {
    x = width - barWidth - padding
  }
  const y = height - padding - barHeight - 20 * uiScale

  // Scale bar line
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, barWidth, barHeight)

  // End caps
  ctx.fillRect(x, y - 4 * uiScale, 2 * uiScale, barHeight + 8 * uiScale)
  ctx.fillRect(x + barWidth - 2 * uiScale, y - 4 * uiScale, 2 * uiScale, barHeight + 8 * uiScale)

  // Text
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${11 * uiScale}px system-ui, sans-serif`
  ctx.textAlign = store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend ? 'left' : 'right'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 3
  ctx.fillText('Scale varies with latitude', store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend ? x : x + barWidth, y + barHeight + 6 * uiScale)
  ctx.shadowBlur = 0
}

// Draw attribution on canvas
const drawAttributionOnCanvas = (ctx, width, height) => {
  const uiScale = store.exportSettings.uiScale || 1
  const text = 'Ithomiini Distribution Maps | Data: Dore et al., Sanger Institute, GBIF'
  const padding = 15 * uiScale

  ctx.font = `${11 * uiScale}px system-ui, sans-serif`
  const textWidth = ctx.measureText(text).width

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  roundRect(ctx, width - textWidth - padding - 12 * uiScale, height - 28 * uiScale, textWidth + 12 * uiScale, 22 * uiScale, 4 * uiScale)
  ctx.fill()

  // Text
  ctx.fillStyle = '#aaa'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width - padding, height - 17 * uiScale)
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

    // Wait for GPU to complete using double requestAnimationFrame
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })

    // Get the map canvas
    const mapCanvas = map.getCanvas()

    // Determine export dimensions
    const ratio = store.exportSettings.aspectRatio
    let exportWidth, exportHeight
    if (ratio === 'custom') {
      exportWidth = store.exportSettings.customWidth
      exportHeight = store.exportSettings.customHeight
    } else {
      const dims = ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
      exportWidth = dims.width
      exportHeight = dims.height
    }

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

    // Calculate how to draw the map
    if (store.exportSettings.enabled) {
      // Draw the map scaled to fill the export canvas
      const scale = Math.max(
        canvas.width / mapImage.width,
        canvas.height / mapImage.height
      )
      const scaledWidth = mapImage.width * scale
      const scaledHeight = mapImage.height * scale
      const offsetX = (canvas.width - scaledWidth) / 2
      const offsetY = (canvas.height - scaledHeight) / 2

      ctx.drawImage(mapImage, offsetX, offsetY, scaledWidth, scaledHeight)
    } else {
      // Draw the map scaled to fit (letterboxed)
      const scale = Math.min(
        canvas.width / mapImage.width,
        canvas.height / mapImage.height
      )
      const scaledWidth = mapImage.width * scale
      const scaledHeight = mapImage.height * scale
      const offsetX = (canvas.width - scaledWidth) / 2
      const offsetY = (canvas.height - scaledHeight) / 2

      ctx.drawImage(mapImage, offsetX, offsetY, scaledWidth, scaledHeight)
    }

    // Draw legend if enabled
    if (store.exportSettings.includeLegend && store.legendSettings.showLegend) {
      drawLegendOnCanvas(ctx, canvas.width, canvas.height)
    }

    // Draw scale bar if enabled
    if (store.exportSettings.includeScaleBar) {
      drawScaleBarOnCanvas(ctx, canvas.width, canvas.height)
    }

    // Draw attribution
    drawAttributionOnCanvas(ctx, canvas.width, canvas.height)

    // Download the image
    const dataUrl = canvas.toDataURL('image/png', 1.0)
    const link = document.createElement('a')
    link.download = `ithomiini_map_${exportWidth}x${exportHeight}_${Date.now()}.png`
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
provide('openMapExport', openMapExport)

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
          <ExportPanel :map="mapRef" @close="closeExport" />
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

    <!-- Map Export Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showMapExport" 
          class="modal-overlay"
          @click.self="closeMapExport"
        >
          <MapExport :map="mapRef" @close="closeMapExport" />
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

    <!-- Toast Notifications -->
    <Toaster position="bottom-right" :rich-colors="true" />
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

.btn-gallery-mobile,
.btn-export-mobile {
  margin-left: auto;
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
