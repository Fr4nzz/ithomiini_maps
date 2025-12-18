/**
 * Composable for map export functionality
 * Consolidates export logic from App.vue, ExportPanel.vue, and MapExport.vue
 */

import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import { ASPECT_RATIOS } from '../utils/constants'
import {
  loadImage,
  calculateExportRegion,
  drawLegendOnCanvas,
  drawScaleBarOnCanvas,
  drawAttributionOnCanvas
} from '../utils/canvasHelpers'

/**
 * @param {Ref<Object>} mapRef - Reactive reference to maplibre-gl map instance
 * @returns {Object} Export state and methods
 */
export function useMapExport(mapRef) {
  const store = useDataStore()

  const isExporting = ref(false)
  const exportProgress = ref(0)
  const exportError = ref(null)
  const exportSuccess = ref(false)

  // Get export dimensions from store settings
  const exportDimensions = computed(() => {
    const ratio = store.exportSettings.aspectRatio
    if (ratio === 'custom') {
      return {
        width: store.exportSettings.customWidth,
        height: store.exportSettings.customHeight
      }
    }
    return ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
  })

  /**
   * Wait for map to be fully ready for export
   * @param {Object} map - MapLibre GL map instance
   */
  const waitForMapReady = async (map) => {
    // Ensure map style is loaded
    if (!map.isStyleLoaded()) {
      await new Promise(resolve => map.once('style.load', resolve))
    }

    // Trigger repaint and wait for idle
    map.triggerRepaint()
    await new Promise(resolve => map.once('idle', resolve))

    // Extra frame to ensure GPU completion
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })
  }

  /**
   * Export map as PNG image
   * @param {Object} options - Export options override
   */
  const exportMap = async (options = {}) => {
    const map = mapRef?.value
    if (!map) {
      exportError.value = 'Map not available. Please ensure you are on the Map view.'
      return
    }

    isExporting.value = true
    exportProgress.value = 0
    exportError.value = null

    try {
      await waitForMapReady(map)
      exportProgress.value = 10

      // Get the map canvas
      const mapCanvas = map.getCanvas()

      // Determine export dimensions
      const { width: exportWidth, height: exportHeight } = exportDimensions.value

      // Create output canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = exportWidth
      canvas.height = exportHeight

      // Fill with dark background
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      exportProgress.value = 20

      // Capture the map as image
      const mapDataUrl = mapCanvas.toDataURL('image/png')
      const mapImage = await loadImage(mapDataUrl)

      exportProgress.value = 40

      // Calculate how to draw the map
      if (store.exportSettings.enabled) {
        // Draw the cropped region from export preview
        const region = calculateExportRegion(
          mapImage.width,
          mapImage.height,
          exportWidth,
          exportHeight
        )

        const srcX = (region.x / 100) * mapImage.width
        const srcY = (region.y / 100) * mapImage.height
        const srcW = (region.width / 100) * mapImage.width
        const srcH = (region.height / 100) * mapImage.height

        ctx.drawImage(
          mapImage,
          srcX, srcY, srcW, srcH,
          0, 0, canvas.width, canvas.height
        )
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

      exportProgress.value = 60

      // Prepare drawing options
      const exportOptions = {
        colorMap: store.activeColorMap,
        legendSettings: store.legendSettings,
        exportSettings: store.exportSettings,
        colorBy: store.colorBy,
        legendTitle: store.legendTitle,
      }

      // Draw legend if enabled
      if (store.exportSettings.includeLegend && store.legendSettings.showLegend) {
        drawLegendOnCanvas(ctx, canvas.width, canvas.height, exportOptions)
      }

      exportProgress.value = 75

      // Draw scale bar if enabled
      if (store.exportSettings.includeScaleBar) {
        drawScaleBarOnCanvas(ctx, canvas.width, canvas.height, exportOptions)
      }

      exportProgress.value = 85

      // Draw attribution
      drawAttributionOnCanvas(ctx, canvas.width, canvas.height, exportOptions)

      exportProgress.value = 95

      // Download the image
      const dataUrl = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      link.download = `ithomiini_map_${exportWidth}x${exportHeight}_${Date.now()}.png`
      link.href = dataUrl
      link.click()

      exportProgress.value = 100
      exportSuccess.value = true

      setTimeout(() => {
        isExporting.value = false
        exportProgress.value = 0
        exportSuccess.value = false
      }, 2000)

    } catch (e) {
      console.error('Export failed:', e)
      exportError.value = e.message || 'Export failed'
      isExporting.value = false
    }
  }

  /**
   * Reset export state
   */
  const resetExportState = () => {
    isExporting.value = false
    exportProgress.value = 0
    exportError.value = null
    exportSuccess.value = false
  }

  return {
    // State
    isExporting,
    exportProgress,
    exportError,
    exportSuccess,

    // Computed
    exportDimensions,

    // Methods
    exportMap,
    resetExportState,
  }
}
