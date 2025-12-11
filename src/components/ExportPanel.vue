<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'

const store = useDataStore()
const emit = defineEmits(['close'])

const props = defineProps({
  map: {
    type: Object,
    default: null
  }
})

// Export state
const isExporting = ref(false)
const exportSuccess = ref(false)
const citationCopied = ref(false)
const imageExportProgress = ref(0)
const imageExportError = ref(null)

// Get filtered data
const filteredData = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return []
  return geo.features.map(f => f.properties)
})

// Build info (injected by Vite)
const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()
const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'
const shortHash = commitHash.substring(0, 7)

// Generate citation text
const citationText = computed(() => {
  const date = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const recordCount = filteredData.value.length
  const url = window.location.href
  
  return `Ithomiini Distribution Maps. Data accessed on ${date}. ` +
    `${recordCount.toLocaleString()} records retrieved. ` +
    `Version: ${shortHash}. ` +
    `URL: ${url}`
})

// BibTeX citation
const bibtexCitation = computed(() => {
  const year = new Date().getFullYear()
  const month = new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase()
  const url = window.location.href.split('?')[0] // Base URL without params
  
  return `@misc{ithomiini_maps_${year},
  title = {Ithomiini Distribution Maps},
  author = {Meier, Joana and Dore, M. and {Sanger Institute}},
  year = {${year}},
  month = {${month}},
  note = {Data version ${shortHash}},
  howpublished = {\\url{${url}}},
}`
})

// Export to CSV
const exportCSV = () => {
  isExporting.value = true
  
  try {
    const data = filteredData.value
    if (data.length === 0) {
      alert('No data to export')
      return
    }
    
    // Define columns in order
    const columns = [
      'id', 'scientific_name', 'genus', 'species', 'subspecies',
      'family', 'tribe', 'mimicry_ring', 'sequencing_status',
      'source', 'country', 'lat', 'lng', 'image_url'
    ]
    
    // Build CSV content
    const header = columns.join(',')
    const rows = data.map(row => {
      return columns.map(col => {
        let val = row[col]
        if (val === null || val === undefined) val = ''
        // Escape quotes and wrap in quotes if contains comma
        val = String(val)
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = '"' + val.replace(/"/g, '""') + '"'
        }
        return val
      }).join(',')
    })
    
    const csv = [header, ...rows].join('\n')
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ithomiini_data_${shortHash}_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    
    exportSuccess.value = true
    setTimeout(() => { exportSuccess.value = false }, 3000)
    
  } catch (e) {
    console.error('CSV export failed:', e)
    alert('Export failed: ' + e.message)
  } finally {
    isExporting.value = false
  }
}

// Export to GeoJSON
const exportGeoJSON = () => {
  isExporting.value = true
  
  try {
    const geo = store.filteredGeoJSON
    if (!geo || !geo.features || geo.features.length === 0) {
      alert('No data to export')
      return
    }
    
    // Add metadata to GeoJSON
    const exportData = {
      type: 'FeatureCollection',
      metadata: {
        title: 'Ithomiini Distribution Data',
        version: shortHash,
        exportDate: new Date().toISOString(),
        recordCount: geo.features.length,
        source: 'https://fr4nzz.github.io/ithomiini_maps/'
      },
      features: geo.features
    }
    
    const json = JSON.stringify(exportData, null, 2)
    
    // Create download
    const blob = new Blob([json], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ithomiini_data_${shortHash}_${Date.now()}.geojson`
    link.click()
    URL.revokeObjectURL(url)
    
    exportSuccess.value = true
    setTimeout(() => { exportSuccess.value = false }, 3000)
    
  } catch (e) {
    console.error('GeoJSON export failed:', e)
    alert('Export failed: ' + e.message)
  } finally {
    isExporting.value = false
  }
}

// Copy citation
const copyCitation = (type = 'plain') => {
  const text = type === 'bibtex' ? bibtexCitation.value : citationText.value
  navigator.clipboard.writeText(text)
  citationCopied.value = true
  setTimeout(() => { citationCopied.value = false }, 2000)
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE EXPORT
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

// Get export dimensions
const exportDimensions = computed(() => {
  const ratio = store.exportSettings.aspectRatio
  if (ratio === 'custom') {
    return { width: store.exportSettings.customWidth, height: store.exportSettings.customHeight }
  }
  return ASPECT_RATIOS[ratio] || { width: 1920, height: 1080 }
})

// Calculate the export region position (same logic as MapEngine)
const calculateExportRegion = (containerWidth, containerHeight, targetWidth, targetHeight) => {
  const targetAspectRatio = targetWidth / targetHeight
  const containerAspectRatio = containerWidth / containerHeight

  // Use 92% of container as maximum (same as MapEngine)
  const maxPercent = 92

  let holeWidthPercent, holeHeightPercent

  if (targetAspectRatio > containerAspectRatio) {
    // Target is wider than container - constrained by width
    holeWidthPercent = maxPercent
    holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
  } else {
    // Target is taller than container - constrained by height
    holeHeightPercent = maxPercent
    holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio
  }

  // Center the hole
  const x = (100 - holeWidthPercent) / 2
  const y = (100 - holeHeightPercent) / 2

  const result = {
    x: Math.max(2, x),
    y: Math.max(2, y),
    width: Math.min(96, holeWidthPercent),
    height: Math.min(96, holeHeightPercent)
  }

  console.log('[Export] calculateExportRegion:', {
    input: { containerWidth, containerHeight, targetWidth, targetHeight },
    aspectRatios: { target: targetAspectRatio.toFixed(3), container: containerAspectRatio.toFixed(3) },
    result: {
      x: result.x.toFixed(2) + '%',
      y: result.y.toFixed(2) + '%',
      width: result.width.toFixed(2) + '%',
      height: result.height.toFixed(2) + '%'
    }
  })

  return result
}

// Export map as image
const exportImage = async () => {
  if (!props.map) {
    imageExportError.value = 'Map not available. Please ensure you are on the Map view.'
    return
  }

  isExporting.value = true
  imageExportProgress.value = 0
  imageExportError.value = null

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('[Export] Starting image export...')
  console.log('[Export] Export settings:', {
    enabled: store.exportSettings.enabled,
    aspectRatio: store.exportSettings.aspectRatio,
    includeLegend: store.exportSettings.includeLegend,
    includeScaleBar: store.exportSettings.includeScaleBar,
    uiScale: store.exportSettings.uiScale
  })

  try {
    const map = props.map

    // Ensure map style is loaded
    if (!map.isStyleLoaded()) {
      console.log('[Export] Waiting for map style to load...')
      await new Promise(resolve => map.once('style.load', resolve))
    }

    // Force the map to recalculate its size (important after window resize)
    console.log('[Export] Forcing map resize...')
    map.resize()

    // Wait for the resize to take effect and tiles to load
    console.log('[Export] Waiting for map to be idle after resize...')
    await new Promise(resolve => map.once('idle', resolve))

    // Force a fresh render
    map.triggerRepaint()

    // Wait for the render to complete
    await new Promise(resolve => {
      map.once('render', () => {
        // Add delay after render for WebGL to finish
        setTimeout(resolve, 200)
      })
      // Fallback in case render doesn't fire
      setTimeout(resolve, 1000)
    })

    imageExportProgress.value = 10

    // Get the map canvas
    const mapCanvas = map.getCanvas()

    // Check if map container is large enough for reliable export
    const minWidth = 800
    const minHeight = 400
    if (mapCanvas.clientWidth < minWidth || mapCanvas.clientHeight < minHeight) {
      console.warn('[Export] Map container too small:', {
        clientWidth: mapCanvas.clientWidth,
        clientHeight: mapCanvas.clientHeight,
        minRequired: `${minWidth}x${minHeight}`
      })
      throw new Error(`Map area too small for export. Please resize your browser window larger (need at least ${minWidth}x${minHeight}px map area, currently ${mapCanvas.clientWidth}x${mapCanvas.clientHeight}px). Try maximizing your browser or closing the sidebar.`)
    }

    console.log('[Export] Map canvas info:', {
      width: mapCanvas.width,
      height: mapCanvas.height,
      clientWidth: mapCanvas.clientWidth,
      clientHeight: mapCanvas.clientHeight,
      aspectRatio: (mapCanvas.width / mapCanvas.height).toFixed(3)
    })

    // Determine export dimensions
    const { width: exportWidth, height: exportHeight } = exportDimensions.value

    console.log('[Export] Target export dimensions:', {
      width: exportWidth,
      height: exportHeight,
      aspectRatio: (exportWidth / exportHeight).toFixed(3)
    })

    // Create output canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = exportWidth
    canvas.height = exportHeight

    // Fill with dark background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    imageExportProgress.value = 20

    // Capture the map as image
    const mapDataUrl = mapCanvas.toDataURL('image/png')
    const mapImage = await loadImage(mapDataUrl)

    // Check if map image was captured properly
    const dataUrlLength = mapDataUrl.length
    const isLikelyEmpty = dataUrlLength < 10000 // Very small data URL indicates empty/black canvas
    console.log('[Export] Map image captured:', {
      width: mapImage.width,
      height: mapImage.height,
      dataUrlLength: dataUrlLength,
      isLikelyEmpty: isLikelyEmpty,
      dataUrlPreview: mapDataUrl.substring(0, 100) + '...'
    })

    if (isLikelyEmpty) {
      console.warn('[Export] WARNING: Map canvas data URL is very small - may be black/empty!')
    }

    imageExportProgress.value = 40

    // Calculate how to draw the map
    // If export settings enabled, crop to the exact export preview region
    if (store.exportSettings.enabled) {
      // Calculate the export region exactly as shown in the preview
      const region = calculateExportRegion(
        mapImage.width,
        mapImage.height,
        exportWidth,
        exportHeight
      )

      // Convert percentages to pixels
      const srcX = (region.x / 100) * mapImage.width
      const srcY = (region.y / 100) * mapImage.height
      const srcW = (region.width / 100) * mapImage.width
      const srcH = (region.height / 100) * mapImage.height

      console.log('[Export] Crop region (pixels):', {
        srcX: Math.round(srcX),
        srcY: Math.round(srcY),
        srcW: Math.round(srcW),
        srcH: Math.round(srcH),
        srcAspectRatio: (srcW / srcH).toFixed(3)
      })

      console.log('[Export] Drawing cropped region:', {
        source: `(${Math.round(srcX)}, ${Math.round(srcY)}) ${Math.round(srcW)}x${Math.round(srcH)}`,
        destination: `(0, 0) ${canvas.width}x${canvas.height}`
      })

      // Draw the cropped region scaled to fill the export canvas
      ctx.drawImage(
        mapImage,
        srcX, srcY, srcW, srcH,  // Source rectangle (crop region)
        0, 0, canvas.width, canvas.height  // Destination (full canvas)
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

      console.log('[Export] Letterbox mode (export preview OFF):', {
        scale: scale.toFixed(3),
        scaledWidth: Math.round(scaledWidth),
        scaledHeight: Math.round(scaledHeight),
        offsetX: Math.round(offsetX),
        offsetY: Math.round(offsetY)
      })

      ctx.drawImage(mapImage, offsetX, offsetY, scaledWidth, scaledHeight)
    }

    imageExportProgress.value = 60

    // Draw legend if enabled
    if (store.exportSettings.includeLegend && store.legendSettings.showLegend) {
      drawLegendOnCanvas(ctx, canvas.width, canvas.height)
    }

    imageExportProgress.value = 75

    // Draw scale bar if enabled
    if (store.exportSettings.includeScaleBar) {
      drawScaleBarOnCanvas(ctx, canvas.width, canvas.height)
    }

    imageExportProgress.value = 85

    // Draw attribution
    drawAttributionOnCanvas(ctx, canvas.width, canvas.height)

    imageExportProgress.value = 95

    // Download the image
    const dataUrl = canvas.toDataURL('image/png', 1.0)
    const link = document.createElement('a')
    link.download = `ithomiini_map_${exportWidth}x${exportHeight}_${Date.now()}.png`
    link.href = dataUrl
    link.click()

    console.log('[Export] Export complete:', {
      outputSize: `${exportWidth}x${exportHeight}`,
      outputDataUrlLength: dataUrl.length,
      filename: link.download
    })
    console.log('═══════════════════════════════════════════════════════════════')

    imageExportProgress.value = 100
    exportSuccess.value = true

    setTimeout(() => {
      isExporting.value = false
      imageExportProgress.value = 0
      exportSuccess.value = false
    }, 2000)

  } catch (e) {
    console.error('[Export] Image export failed:', e)
    imageExportError.value = e.message || 'Export failed'
    isExporting.value = false
  }
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

// Draw legend on canvas
const drawLegendOnCanvas = (ctx, width, height) => {
  const colorMap = store.activeColorMap
  const entries = Object.entries(colorMap).slice(0, store.legendSettings.maxItems)
  const uiScale = store.exportSettings.uiScale || 1

  // Calculate resolution scale factor to match preview appearance
  // Preview frame is typically ~650px tall; scale legend proportionally to output size
  const referenceHeight = 650
  const resolutionScale = height / referenceHeight

  // Combined scale: user's UI scale * resolution scaling
  const scale = uiScale * resolutionScale

  console.log('[Export] Drawing legend:', {
    totalEntries: Object.keys(colorMap).length,
    displayedEntries: entries.length,
    maxItems: store.legendSettings.maxItems,
    uiScale: uiScale,
    resolutionScale: resolutionScale.toFixed(2),
    combinedScale: scale.toFixed(2),
    position: store.legendSettings.position,
    colorBy: store.colorBy
  })

  // Match CSS preview padding (15px bottom/sides, 50px top)
  // These are scaled proportionally to output size
  const sidePadding = 15 * resolutionScale * uiScale
  const topPadding = 50 * resolutionScale * uiScale
  const bottomPadding = 15 * resolutionScale * uiScale

  const itemHeight = 24 * scale
  const leftPadding = 12 * scale
  const dotSpace = 32 * scale // space for dot + gap
  const rightPadding = 12 * scale

  // Calculate legend width based on content
  const isItalic = ['species', 'subspecies', 'genus'].includes(store.colorBy)
  ctx.font = isItalic
    ? `italic ${13 * scale}px system-ui, sans-serif`
    : `${13 * scale}px system-ui, sans-serif`

  let maxLabelWidth = 0
  let longestLabel = ''
  entries.forEach(([label]) => {
    const labelWidth = ctx.measureText(label).width
    if (labelWidth > maxLabelWidth) {
      maxLabelWidth = labelWidth
      longestLabel = label
    }
  })

  // Also check title width
  ctx.font = `bold ${12 * scale}px system-ui, sans-serif`
  const titleWidth = ctx.measureText(store.legendTitle.toUpperCase()).width

  // Calculate legend width with padding, minimum 180px scaled
  const contentWidth = Math.max(maxLabelWidth + dotSpace, titleWidth) + leftPadding + rightPadding
  const legendWidth = Math.max(180 * scale, Math.min(contentWidth, 300 * scale))
  const legendHeight = entries.length * itemHeight + 45 * scale

  console.log('[Export] Legend dimensions:', {
    legendWidth: Math.round(legendWidth),
    legendHeight: Math.round(legendHeight),
    maxLabelWidth: Math.round(maxLabelWidth),
    longestLabel: longestLabel,
    titleWidth: Math.round(titleWidth),
    contentWidth: Math.round(contentWidth),
    canvasWidth: width,
    canvasHeight: height
  })

  // Position based on settings (matching CSS preview from MapEngine.vue)
  let x, y
  const pos = store.legendSettings.position
  if (pos === 'top-left') { x = sidePadding; y = topPadding }
  else if (pos === 'top-right') { x = width - legendWidth - sidePadding; y = topPadding }
  else if (pos === 'bottom-right') { x = width - legendWidth - sidePadding; y = height - legendHeight - bottomPadding }
  else { x = sidePadding; y = height - legendHeight - bottomPadding } // bottom-left default

  console.log('[Export] Legend position:', {
    position: pos,
    x: Math.round(x),
    y: Math.round(y),
    legendRight: Math.round(x + legendWidth),
    legendBottom: Math.round(y + legendHeight)
  })

  // Background
  ctx.fillStyle = 'rgba(26, 26, 46, 0.95)'
  roundRect(ctx, x, y, legendWidth, legendHeight, 8 * scale)
  ctx.fill()

  // Title
  ctx.fillStyle = '#888'
  ctx.font = `bold ${12 * scale}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(store.legendTitle.toUpperCase(), x + leftPadding, y + 22 * scale)

  // Maximum width for label text (with some padding from edge)
  const maxTextWidth = legendWidth - dotSpace - rightPadding

  // Items
  ctx.font = isItalic
    ? `italic ${13 * scale}px system-ui, sans-serif`
    : `${13 * scale}px system-ui, sans-serif`

  entries.forEach(([label, color], i) => {
    const itemY = y + 40 * scale + i * itemHeight

    // Dot
    ctx.beginPath()
    ctx.arc(x + 18 * scale, itemY, 5 * scale, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Label - truncate if too long
    ctx.fillStyle = '#e0e0e0'
    let displayLabel = label
    let labelWidth = ctx.measureText(displayLabel).width
    if (labelWidth > maxTextWidth) {
      // Truncate with ellipsis
      while (labelWidth > maxTextWidth && displayLabel.length > 0) {
        displayLabel = displayLabel.slice(0, -1)
        labelWidth = ctx.measureText(displayLabel + '…').width
      }
      displayLabel += '…'
    }
    ctx.fillText(displayLabel, x + dotSpace, itemY + 4 * scale)
  })

  // "More" indicator
  if (Object.keys(colorMap).length > store.legendSettings.maxItems) {
    const moreY = y + legendHeight - 12 * scale
    ctx.fillStyle = '#666'
    ctx.font = `italic ${11 * scale}px system-ui, sans-serif`
    ctx.fillText(`+ ${Object.keys(colorMap).length - store.legendSettings.maxItems} more`, x + 12 * scale, moreY)
  }
}

// Draw scale bar on canvas
const drawScaleBarOnCanvas = (ctx, width, height) => {
  const uiScale = store.exportSettings.uiScale || 1
  // Scale proportionally to output resolution (same as legend)
  const referenceHeight = 650
  const resolutionScale = height / referenceHeight
  const scale = uiScale * resolutionScale

  // Match CSS preview padding
  const sidePadding = 15 * resolutionScale * uiScale
  const bottomPadding = 15 * resolutionScale * uiScale

  const barWidth = 100 * scale
  const barHeight = 4 * scale

  // Position: bottom-right, or bottom-left if legend is bottom-right
  let x
  if (store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend) {
    x = sidePadding
  } else {
    x = width - barWidth - sidePadding
  }
  const y = height - bottomPadding - barHeight - 20 * scale

  // Scale bar line
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, barWidth, barHeight)

  // End caps
  ctx.fillRect(x, y - 4 * scale, 2 * scale, barHeight + 8 * scale)
  ctx.fillRect(x + barWidth - 2 * scale, y - 4 * scale, 2 * scale, barHeight + 8 * scale)

  // Text - approximate scale based on zoom
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${11 * scale}px system-ui, sans-serif`
  ctx.textAlign = store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend ? 'left' : 'right'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 3
  ctx.fillText('Scale varies with latitude', store.legendSettings.position === 'bottom-right' && store.exportSettings.includeLegend ? x : x + barWidth, y + barHeight + 6 * scale)
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

// Active tab - default to 'image' for Export Image tab
const activeTab = ref('image')
</script>

<template>
  <div class="export-panel">
    <!-- Header -->
    <div class="panel-header">
      <h3>Export & Citation</h3>
      <button class="btn-close" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Tabs -->
    <div class="panel-tabs">
      <button
        :class="{ active: activeTab === 'image' }"
        @click="activeTab = 'image'"
      >
        Export Image
      </button>
      <button
        :class="{ active: activeTab === 'export' }"
        @click="activeTab = 'export'"
      >
        Export Data
      </button>
      <button
        :class="{ active: activeTab === 'citation' }"
        @click="activeTab = 'citation'"
      >
        Citation
      </button>
    </div>

    <!-- Content -->
    <div class="panel-content">
      
      <!-- Export Tab -->
      <div v-if="activeTab === 'export'" class="tab-content">
        <div class="data-summary">
          <div class="summary-item">
            <span class="summary-value">{{ filteredData.length.toLocaleString() }}</span>
            <span class="summary-label">Records</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ shortHash }}</span>
            <span class="summary-label">Version</span>
          </div>
        </div>

        <div class="export-options">
          <button 
            class="export-btn"
            @click="exportCSV"
            :disabled="isExporting || filteredData.length === 0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div class="btn-text">
              <span class="btn-title">Download CSV</span>
              <span class="btn-desc">Spreadsheet format</span>
            </div>
          </button>

          <button 
            class="export-btn"
            @click="exportGeoJSON"
            :disabled="isExporting || filteredData.length === 0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div class="btn-text">
              <span class="btn-title">Download GeoJSON</span>
              <span class="btn-desc">GIS/mapping format</span>
            </div>
          </button>
        </div>

        <Transition name="fade">
          <div v-if="exportSuccess && activeTab === 'export'" class="success-toast">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Export complete!
          </div>
        </Transition>
      </div>

      <!-- Export Image Tab -->
      <div v-if="activeTab === 'image'" class="tab-content">
        <div class="image-export-info">
          <div class="export-mode-badge" :class="{ active: store.exportSettings.enabled }">
            {{ store.exportSettings.enabled ? 'Export Preview Mode ON' : 'Export Preview Mode OFF' }}
          </div>
          <p class="info-text">
            <template v-if="store.exportSettings.enabled">
              Will export the area shown in the export preview rectangle.
            </template>
            <template v-else>
              Will export the current map view. Enable Export Preview in sidebar to define a specific region.
            </template>
          </p>
        </div>

        <div class="data-summary">
          <div class="summary-item">
            <span class="summary-value">{{ exportDimensions.width }}</span>
            <span class="summary-label">Width (px)</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ exportDimensions.height }}</span>
            <span class="summary-label">Height (px)</span>
          </div>
        </div>

        <div class="image-options">
          <div class="option-group">
            <label class="option-label">Include in Export:</label>
            <div class="option-list">
              <label class="option-item">
                <input type="checkbox" v-model="store.exportSettings.includeLegend" />
                <span>Legend</span>
              </label>
              <label class="option-item">
                <input type="checkbox" v-model="store.exportSettings.includeScaleBar" />
                <span>Scale Bar</span>
              </label>
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">UI Scale: {{ Math.round(store.exportSettings.uiScale * 100) }}%</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              v-model.number="store.exportSettings.uiScale"
              class="scale-slider"
            />
          </div>
        </div>

        <!-- Error message -->
        <div v-if="imageExportError" class="export-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ imageExportError }}
        </div>

        <!-- Progress bar -->
        <div v-if="isExporting" class="export-progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: imageExportProgress + '%' }"></div>
          </div>
          <span class="progress-text">
            {{ imageExportProgress < 100 ? 'Exporting...' : 'Complete!' }}
          </span>
        </div>

        <!-- Export button -->
        <button
          v-else
          class="export-image-btn"
          @click="exportImage"
          :disabled="!map"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <div class="btn-text">
            <span class="btn-title">Download PNG Image</span>
            <span class="btn-desc">{{ exportDimensions.width }} × {{ exportDimensions.height }} pixels</span>
          </div>
        </button>

        <Transition name="fade">
          <div v-if="exportSuccess && activeTab === 'image'" class="success-toast">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Image exported!
          </div>
        </Transition>
      </div>

      <!-- Citation Tab -->
      <div v-if="activeTab === 'citation'" class="tab-content">
        <div class="citation-section">
          <label class="citation-label">Plain Text</label>
          <div class="citation-box">
            <p class="citation-text">{{ citationText }}</p>
            <button 
              class="copy-btn"
              @click="copyCitation('plain')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <div class="citation-section">
          <label class="citation-label">BibTeX</label>
          <div class="citation-box bibtex">
            <pre class="citation-code">{{ bibtexCitation }}</pre>
            <button 
              class="copy-btn"
              @click="copyCitation('bibtex')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <div class="citation-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <p>
            Citations include a version hash for reproducibility. 
            The URL preserves your current filter settings.
          </p>
        </div>

        <Transition name="fade">
          <div v-if="citationCopied" class="success-toast">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Citation copied!
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-panel {
  background: var(--color-bg-secondary, #252540);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  width: 420px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.panel-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
  margin: 0;
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
}

.btn-close svg {
  width: 18px;
  height: 18px;
}

/* Tabs */
.panel-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: var(--color-bg-primary, #1a1a2e);
}

.panel-tabs button {
  flex: 1;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-tabs button:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-secondary, #aaa);
}

.panel-tabs button.active {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

/* Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Data Summary */
.data-summary {
  display: flex;
  gap: 16px;
}

.summary-item {
  flex: 1;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.summary-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-accent, #4ade80);
  font-variant-numeric: tabular-nums;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Export Options */
.export-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  color: var(--color-text-primary, #e0e0e0);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.export-btn:hover:not(:disabled) {
  background: #353558;
  border-color: var(--color-accent, #4ade80);
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn svg {
  width: 24px;
  height: 24px;
  color: var(--color-accent, #4ade80);
  flex-shrink: 0;
}

.btn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.btn-title {
  font-size: 0.95rem;
  font-weight: 500;
}

.btn-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
}

/* Citation Section */
.citation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.citation-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.citation-box {
  position: relative;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  padding: 14px;
  padding-right: 70px;
}

.citation-text {
  font-size: 0.85rem;
  color: var(--color-text-primary, #e0e0e0);
  line-height: 1.6;
  margin: 0;
  word-break: break-word;
}

.citation-box.bibtex {
  padding-right: 14px;
  padding-bottom: 50px;
}

.citation-code {
  font-family: var(--font-family-mono, monospace);
  font-size: 0.75rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.copy-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.citation-box.bibtex .copy-btn {
  top: auto;
  bottom: 10px;
}

.copy-btn:hover {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-color: var(--color-accent, #4ade80);
}

.copy-btn svg {
  width: 12px;
  height: 12px;
}

/* Citation Info */
.citation-info {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #aaa);
}

.citation-info svg {
  width: 18px;
  height: 18px;
  color: var(--color-accent, #4ade80);
  flex-shrink: 0;
  margin-top: 2px;
}

.citation-info p {
  margin: 0;
  line-height: 1.5;
}

/* Success Toast */
.success-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
}

.success-toast svg {
  width: 18px;
  height: 18px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Export Image Tab */
.image-export-info {
  margin-bottom: 16px;
}

.export-mode-badge {
  display: inline-block;
  padding: 6px 12px;
  background: rgba(107, 114, 128, 0.2);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #888;
  margin-bottom: 10px;
}

.export-mode-badge.active {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
}

.info-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
  margin: 0;
}

.image-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-secondary, #aaa);
}

.option-list {
  display: flex;
  gap: 16px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.option-item input {
  accent-color: var(--color-accent, #4ade80);
}

.option-item span {
  font-size: 0.85rem;
  color: var(--color-text-primary, #e0e0e0);
}

.scale-slider {
  width: 100%;
  accent-color: var(--color-accent, #4ade80);
}

.export-progress-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 8px;
}

.progress-bar {
  height: 8px;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent, #4ade80);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #aaa);
  text-align: center;
}

.export-image-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 8px;
  color: var(--color-bg-primary, #1a1a2e);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.export-image-btn:hover:not(:disabled) {
  background: #5eeb94;
}

.export-image-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-image-btn svg {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.export-image-btn .btn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.export-image-btn .btn-title {
  font-size: 1rem;
  font-weight: 600;
}

.export-image-btn .btn-desc {
  font-size: 0.8rem;
  opacity: 0.8;
}

.export-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.export-error svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 480px) {
  .export-panel {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    max-height: 100vh;
  }

  .data-summary {
    flex-direction: column;
  }
}
</style>
