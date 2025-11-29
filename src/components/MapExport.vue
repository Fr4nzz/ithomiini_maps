<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  map: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

// Export settings
const exportWidth = ref(1920)
const exportHeight = ref(1080)
const exportDpi = ref(300)
const includeScaleBar = ref(true)
const includeLegend = ref(true)
const includeAttribution = ref(true)
const exportFormat = ref('png')

// Export state
const isExporting = ref(false)
const exportProgress = ref(0)
const exportError = ref(null)

// Preset sizes
const presetSizes = [
  { name: 'HD (16:9)', width: 1920, height: 1080 },
  { name: '4K (16:9)', width: 3840, height: 2160 },
  { name: 'A4 Landscape', width: 3508, height: 2480 },
  { name: 'A4 Portrait', width: 2480, height: 3508 },
  { name: 'Square', width: 2000, height: 2000 },
  { name: 'Letter Landscape', width: 3300, height: 2550 },
]

const applyPreset = (preset) => {
  exportWidth.value = preset.width
  exportHeight.value = preset.height
}

// Calculated dimensions at DPI
const physicalWidth = computed(() => {
  return (exportWidth.value / exportDpi.value).toFixed(2)
})

const physicalHeight = computed(() => {
  return (exportHeight.value / exportDpi.value).toFixed(2)
})

// Export function
const exportMap = async () => {
  if (!props.map) {
    exportError.value = 'Map not available'
    return
  }

  isExporting.value = true
  exportProgress.value = 0
  exportError.value = null

  try {
    // Get the map canvas
    const mapCanvas = props.map.getCanvas()
    const originalWidth = mapCanvas.width
    const originalHeight = mapCanvas.height

    exportProgress.value = 10

    // Create a high-resolution canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Set canvas size
    canvas.width = exportWidth.value
    canvas.height = exportHeight.value

    // Fill background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    exportProgress.value = 20

    // Get current map image
    const mapImage = await new Promise((resolve, reject) => {
      try {
        const dataUrl = mapCanvas.toDataURL('image/png')
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Failed to load map image'))
        img.src = dataUrl
      } catch (e) {
        reject(e)
      }
    })

    exportProgress.value = 50

    // Calculate scaling to fit
    const scale = Math.min(
      canvas.width / mapImage.width,
      canvas.height / mapImage.height
    )
    const scaledWidth = mapImage.width * scale
    const scaledHeight = mapImage.height * scale
    const offsetX = (canvas.width - scaledWidth) / 2
    const offsetY = (canvas.height - scaledHeight) / 2

    // Draw map
    ctx.drawImage(mapImage, offsetX, offsetY, scaledWidth, scaledHeight)

    exportProgress.value = 70

    // Add scale bar if enabled
    if (includeScaleBar.value) {
      drawScaleBar(ctx, canvas.width, canvas.height)
    }

    exportProgress.value = 80

    // Add legend if enabled
    if (includeLegend.value) {
      drawLegend(ctx, canvas.width, canvas.height)
    }

    exportProgress.value = 90

    // Add attribution if enabled
    if (includeAttribution.value) {
      drawAttribution(ctx, canvas.width, canvas.height)
    }

    exportProgress.value = 95

    // Download the image
    const dataUrl = canvas.toDataURL(`image/${exportFormat.value}`, 1.0)
    const link = document.createElement('a')
    link.download = `ithomiini_map_${exportWidth.value}x${exportHeight.value}_${exportDpi.value}dpi.${exportFormat.value}`
    link.href = dataUrl
    link.click()

    exportProgress.value = 100

    // Reset after short delay
    setTimeout(() => {
      isExporting.value = false
      exportProgress.value = 0
    }, 1500)

  } catch (e) {
    console.error('Export failed:', e)
    exportError.value = e.message || 'Export failed'
    isExporting.value = false
  }
}

// Draw scale bar
const drawScaleBar = (ctx, width, height) => {
  const padding = 30
  const barWidth = 200
  const barHeight = 8
  const x = padding
  const y = height - padding - barHeight

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.roundRect(x - 10, y - 25, barWidth + 20, 50, 6)
  ctx.fill()

  // Scale bar
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, barWidth, barHeight)
  
  // Alternating segments
  ctx.fillStyle = '#333'
  ctx.fillRect(x + barWidth * 0.25, y, barWidth * 0.25, barHeight)
  ctx.fillRect(x + barWidth * 0.75, y, barWidth * 0.25, barHeight)

  // Text
  ctx.fillStyle = '#fff'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Scale varies with latitude', x + barWidth / 2, y - 8)
}

// Draw legend
const drawLegend = (ctx, width, height) => {
  const statuses = [
    { label: 'Sequenced', color: '#3b82f6' },
    { label: 'Tissue Available', color: '#10b981' },
    { label: 'Preserved Specimen', color: '#f59e0b' },
    { label: 'Published', color: '#a855f7' },
    { label: 'GBIF Record', color: '#6b7280' },
  ]

  const padding = 20
  const itemHeight = 24
  const legendWidth = 180
  const legendHeight = statuses.length * itemHeight + 40
  const x = width - legendWidth - padding
  const y = padding

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.roundRect(x, y, legendWidth, legendHeight, 8)
  ctx.fill()

  // Title
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Sequencing Status', x + 12, y + 22)

  // Items
  ctx.font = '12px system-ui, sans-serif'
  statuses.forEach((status, i) => {
    const itemY = y + 40 + i * itemHeight
    
    // Dot
    ctx.beginPath()
    ctx.arc(x + 18, itemY, 5, 0, Math.PI * 2)
    ctx.fillStyle = status.color
    ctx.fill()
    
    // Label
    ctx.fillStyle = '#ccc'
    ctx.fillText(status.label, x + 30, itemY + 4)
  })
}

// Draw attribution
const drawAttribution = (ctx, width, height) => {
  const text = 'Ithomiini Distribution Maps | Data: Dore et al., Sanger Institute, GBIF'
  const padding = 20
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.font = '12px system-ui, sans-serif'
  const textWidth = ctx.measureText(text).width
  
  // Background
  ctx.roundRect(width - textWidth - padding - 16, height - 36, textWidth + 16, 26, 4)
  ctx.fill()
  
  // Text
  ctx.fillStyle = '#aaa'
  ctx.textAlign = 'right'
  ctx.fillText(text, width - padding, height - 18)
}

// Add roundRect polyfill if needed
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    this.beginPath()
    this.moveTo(x + r, y)
    this.arcTo(x + w, y, x + w, y + h, r)
    this.arcTo(x + w, y + h, x, y + h, r)
    this.arcTo(x, y + h, x, y, r)
    this.arcTo(x, y, x + w, y, r)
    this.closePath()
    return this
  }
}
</script>

<template>
  <div class="map-export">
    <!-- Header -->
    <div class="export-header">
      <h3>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        Export Map Image
      </h3>
      <button class="btn-close" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="export-content">
      <!-- Preset sizes -->
      <div class="export-section">
        <label class="section-label">Preset Sizes</label>
        <div class="preset-grid">
          <button
            v-for="preset in presetSizes"
            :key="preset.name"
            class="preset-btn"
            :class="{ active: exportWidth === preset.width && exportHeight === preset.height }"
            @click="applyPreset(preset)"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- Custom dimensions -->
      <div class="export-section">
        <label class="section-label">Dimensions (pixels)</label>
        <div class="dimension-inputs">
          <div class="input-group">
            <label>Width</label>
            <input type="number" v-model.number="exportWidth" min="100" max="8000" />
          </div>
          <span class="dimension-x">×</span>
          <div class="input-group">
            <label>Height</label>
            <input type="number" v-model.number="exportHeight" min="100" max="8000" />
          </div>
        </div>
      </div>

      <!-- DPI selection -->
      <div class="export-section">
        <label class="section-label">Resolution (DPI)</label>
        <div class="dpi-options">
          <button 
            :class="{ active: exportDpi === 72 }"
            @click="exportDpi = 72"
          >
            72 (Screen)
          </button>
          <button 
            :class="{ active: exportDpi === 150 }"
            @click="exportDpi = 150"
          >
            150 (Draft)
          </button>
          <button 
            :class="{ active: exportDpi === 300 }"
            @click="exportDpi = 300"
          >
            300 (Print)
          </button>
        </div>
        <p class="dimension-info">
          Physical size: {{ physicalWidth }}" × {{ physicalHeight }}" at {{ exportDpi }} DPI
        </p>
      </div>

      <!-- Options -->
      <div class="export-section">
        <label class="section-label">Include Elements</label>
        <div class="option-list">
          <label class="option-item">
            <input type="checkbox" v-model="includeScaleBar" />
            <span>Scale bar</span>
          </label>
          <label class="option-item">
            <input type="checkbox" v-model="includeLegend" />
            <span>Status legend</span>
          </label>
          <label class="option-item">
            <input type="checkbox" v-model="includeAttribution" />
            <span>Attribution</span>
          </label>
        </div>
      </div>

      <!-- Format -->
      <div class="export-section">
        <label class="section-label">Format</label>
        <div class="format-options">
          <button 
            :class="{ active: exportFormat === 'png' }"
            @click="exportFormat = 'png'"
          >
            PNG (Lossless)
          </button>
          <button 
            :class="{ active: exportFormat === 'jpeg' }"
            @click="exportFormat = 'jpeg'"
          >
            JPEG (Smaller)
          </button>
        </div>
      </div>

      <!-- Error message -->
      <div v-if="exportError" class="export-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ exportError }}
      </div>
    </div>

    <!-- Footer -->
    <div class="export-footer">
      <!-- Progress bar -->
      <div v-if="isExporting" class="export-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: exportProgress + '%' }"></div>
        </div>
        <span class="progress-text">
          {{ exportProgress < 100 ? 'Exporting...' : 'Complete!' }}
        </span>
      </div>

      <div v-else class="footer-actions">
        <button class="btn-cancel" @click="emit('close')">Cancel</button>
        <button class="btn-export" @click="exportMap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Image
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-export {
  background: var(--color-bg-secondary, #252540);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  width: 440px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.export-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.export-header h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
  margin: 0;
}

.export-header h3 svg {
  width: 20px;
  height: 20px;
  color: var(--color-accent, #4ade80);
}

.btn-close {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* Content */
.export-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.export-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-secondary, #aaa);
  margin-bottom: 10px;
}

/* Preset grid */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-btn {
  padding: 8px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.preset-btn.active {
  background: rgba(74, 222, 128, 0.15);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-accent, #4ade80);
}

/* Dimension inputs */
.dimension-inputs {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.input-group {
  flex: 1;
}

.input-group label {
  display: block;
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  margin-bottom: 4px;
}

.input-group input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.input-group input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

.dimension-x {
  color: var(--color-text-muted, #666);
  font-size: 1.2rem;
  padding-bottom: 8px;
}

.dimension-info {
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
}

/* DPI options */
.dpi-options,
.format-options {
  display: flex;
  gap: 8px;
}

.dpi-options button,
.format-options button {
  flex: 1;
  padding: 10px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.dpi-options button:hover,
.format-options button:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.dpi-options button.active,
.format-options button.active {
  background: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

/* Options list */
.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.option-item input {
  accent-color: var(--color-accent, #4ade80);
}

.option-item span {
  font-size: 0.85rem;
  color: var(--color-text-primary, #e0e0e0);
}

/* Error */
.export-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.85rem;
}

.export-error svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Footer */
.export-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-primary, #1a1a2e);
}

.footer-actions {
  display: flex;
  gap: 10px;
}

.btn-cancel {
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
}

.btn-export {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 6px;
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-export:hover {
  background: #5eeb94;
}

.btn-export svg {
  width: 18px;
  height: 18px;
}

/* Progress */
.export-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  height: 8px;
  background: var(--color-bg-tertiary, #2d2d4a);
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

/* Responsive */
@media (max-width: 480px) {
  .preset-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .dpi-options,
  .format-options {
    flex-direction: column;
  }
}
</style>
