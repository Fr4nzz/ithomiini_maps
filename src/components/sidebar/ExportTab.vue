<script setup>
import { computed, ref } from 'vue'
import { useDataStore } from '../../stores/data'
import DatabaseUpdateSection from '../DatabaseUpdateSection.vue'
import config from '../../config'
import { ASPECT_RATIOS } from '../../utils/constants'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-map-export', 'export-for-r'])

const store = useDataStore()

const exportSuccess = ref(false)
const copiedState = ref('')

const filteredData = computed(() => store.filteredGeoJSON?.features?.map(feature => feature.properties) ?? [])
const shareUrl = computed(() => window.location.href)
const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'
const shortHash = commitHash.substring(0, 7)

const aspectRatioLabels = {
  '16:9': '16:9 (Widescreen)',
  '4:3': '4:3 (Standard)',
  '1:1': '1:1 (Square)',
  '3:2': '3:2 (Photo)',
  'A4': 'A4 Portrait',
  'A4L': 'A4 Landscape'
}

const aspectRatioOptions = [
  ...Object.entries(ASPECT_RATIOS).map(([key, dims]) => ({ value: key, label: aspectRatioLabels[key] || key, ...dims })),
  { value: 'custom', label: 'Custom', width: null, height: null }
]

const currentExportDimensions = computed(() => {
  const option = aspectRatioOptions.find(item => item.value === store.exportSettings.aspectRatio)
  if (option && option.value !== 'custom') return { width: option.width, height: option.height }
  return { width: store.exportSettings.customWidth, height: store.exportSettings.customHeight }
})

const exportPixelDimensions = computed(() => {
  const base = currentExportDimensions.value
  const scale = store.exportSettings.dpi / 100
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale)
  }
})

const citationText = computed(() => {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `Ithomiini Distribution Maps. Data accessed on ${date}. ${filteredData.value.length.toLocaleString()} records retrieved. Version: ${shortHash}. URL: ${shareUrl.value}`
})

const bibtexCitation = computed(() => {
  const year = new Date().getFullYear()
  const month = new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase()
  const url = window.location.href.split('?')[0]
  return `@misc{ithomiini_maps_${year},\n  title = {Ithomiini Distribution Maps},\n  author = {Meier, Joana and Dore, M. and {Sanger Institute}},\n  year = {${year}},\n  month = {${month}},\n  note = {Data version ${shortHash}},\n  howpublished = {\\url{${url}}},\n}`
})

const flashSuccess = () => {
  exportSuccess.value = true
  setTimeout(() => {
    exportSuccess.value = false
  }, 2500)
}

const updateExportWidth = (value) => {
  const width = parseInt(value, 10)
  if (!Number.isNaN(width) && width >= 100 && width <= 8000) {
    store.exportSettings.aspectRatio = 'custom'
    store.exportSettings.customWidth = width
  }
}

const updateExportHeight = (value) => {
  const height = parseInt(value, 10)
  if (!Number.isNaN(height) && height >= 100 && height <= 8000) {
    store.exportSettings.aspectRatio = 'custom'
    store.exportSettings.customHeight = height
  }
}

const downloadBlob = (content, mimeType, filename) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  flashSuccess()
}

const exportCSV = () => {
  if (filteredData.value.length === 0) {
    alert('No data to export')
    return
  }

  const columns = ['id', 'scientific_name', 'genus', 'species', 'subspecies', 'family', 'tribe', 'mimicry_ring', 'sequencing_status', 'source', 'country', 'lat', 'lng', 'sex', 'image_url']
  const header = columns.join(',')
  const rows = filteredData.value.map((row) => columns.map((column) => {
    let value = row[column]
    if (value == null) value = ''
    value = String(value)
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }).join(','))

  downloadBlob([header, ...rows].join('\n'), 'text/csv;charset=utf-8;', `ithomiini_data_${shortHash}_${Date.now()}.csv`)
}

const exportGeoJSON = () => {
  const geo = store.filteredGeoJSON
  if (!geo?.features?.length) {
    alert('No data to export')
    return
  }

  const exportData = {
    type: 'FeatureCollection',
    metadata: {
      title: 'Ithomiini Distribution Data',
      version: shortHash,
      exportDate: new Date().toISOString(),
      recordCount: geo.features.length,
      source: 'https://rapidspeciation.github.io/ithomiini_maps/'
    },
    features: geo.features
  }

  downloadBlob(JSON.stringify(exportData, null, 2), 'application/geo+json', `ithomiini_data_${shortHash}_${Date.now()}.geojson`)
}

const copyText = async (value, key) => {
  await navigator.clipboard.writeText(value)
  copiedState.value = key
  setTimeout(() => {
    if (copiedState.value === key) copiedState.value = ''
  }, 2000)
}
</script>

<template>
  <div class="tab-panel export-tab">
    <div class="filter-section export-summary-grid">
      <div class="summary-card">
        <span class="summary-value">{{ filteredData.length.toLocaleString() }}</span>
        <span class="summary-label">Records</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{{ shortHash }}</span>
        <span class="summary-label">Version</span>
      </div>
    </div>

    <div class="filter-section">
      <label class="section-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        Preview Export
      </label>

      <button class="preview-toggle-button" :class="{ active: store.exportSettings.enabled }" @click="store.exportSettings.enabled = !store.exportSettings.enabled">
        <span>{{ store.exportSettings.enabled ? 'Preview enabled' : 'Preview disabled' }}</span>
        <span class="toggle-chip">{{ store.exportSettings.enabled ? 'ON' : 'OFF' }}</span>
      </button>

      <div v-if="props.currentView === 'map'" class="export-settings-panel">
        <label class="section-label export-settings-label">Export Settings</label>

        <div class="setting-row">
          <label>Aspect Ratio</label>
          <select v-model="store.exportSettings.aspectRatio" class="style-select">
            <option v-for="option in aspectRatioOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>

        <div class="setting-row">
          <label>Resolution</label>
          <div class="dimension-inputs">
            <div class="dimension-field">
              <input class="setting-input dimension-input" type="number" :value="currentExportDimensions.width" min="100" max="8000" @input="updateExportWidth($event.target.value)" @keydown.enter="$event.target.blur()">
              <span class="dimension-label">W</span>
            </div>
            <span class="dimension-x">×</span>
            <div class="dimension-field">
              <input class="setting-input dimension-input" type="number" :value="currentExportDimensions.height" min="100" max="8000" @input="updateExportHeight($event.target.value)" @keydown.enter="$event.target.blur()">
              <span class="dimension-label">H</span>
            </div>
          </div>
        </div>

        <div class="setting-row checkbox-group export-checkbox-group">
          <label class="checkbox-label"><input v-model="store.exportSettings.includeLegend" type="checkbox"><span>Include Legend</span></label>
          <label class="checkbox-label"><input v-model="store.exportSettings.includeScaleBar" type="checkbox"><span>Include Scale Bar</span></label>
          <label class="checkbox-label"><input v-model="store.exportSettings.includeAttribution" type="checkbox"><span>Include Attribution</span></label>
        </div>

        <div class="setting-row">
          <label>UI Scale <span class="setting-hint">(legend, scale bar size)</span></label>
          <div class="slider-group">
            <input v-model.number="store.exportSettings.uiScale" type="range" min="0.5" max="2" step="0.1">
            <span class="slider-value">{{ Math.round(store.exportSettings.uiScale * 100) }}%</span>
          </div>
        </div>

        <div class="setting-row">
          <label>Format</label>
          <div class="format-toggle">
            <button :class="{ active: store.exportSettings.format === 'png' }" @click="store.exportSettings.format = 'png'">PNG</button>
            <button :class="{ active: store.exportSettings.format === 'jpg' }" @click="store.exportSettings.format = 'jpg'">JPG</button>
          </div>
        </div>

        <div class="setting-row">
          <label>Output Scale <span class="setting-hint">({{ exportPixelDimensions.width }}×{{ exportPixelDimensions.height }}px)</span></label>
          <div class="dpi-toggle">
            <button :class="{ active: store.exportSettings.dpi === 100 }" @click="store.exportSettings.dpi = 100">1×</button>
            <button :class="{ active: store.exportSettings.dpi === 150 }" @click="store.exportSettings.dpi = 150">1.5×</button>
            <button :class="{ active: store.exportSettings.dpi === 200 }" @click="store.exportSettings.dpi = 200">2×</button>
            <button :class="{ active: store.exportSettings.dpi === 300 }" @click="store.exportSettings.dpi = 300">3×</button>
          </div>
        </div>

        <button class="btn-export-now" :disabled="props.currentView !== 'map'" @click="emit('open-map-export')">Export Image</button>
      </div>

      <p v-else class="filter-hint">Map image export controls are available when the map view is active.</p>
    </div>

    <div class="filter-section export-actions-grid">
      <button class="export-action-card" :disabled="filteredData.length === 0" @click="exportCSV">
        <span class="action-title">Download CSV</span>
        <span class="action-desc">Spreadsheet format</span>
      </button>
      <button class="export-action-card" :disabled="filteredData.length === 0" @click="exportGeoJSON">
        <span class="action-title">Download GeoJSON</span>
        <span class="action-desc">GIS / mapping format</span>
      </button>
      <button class="export-action-card export-action-r" :disabled="props.currentView !== 'map' || filteredData.length === 0" @click="emit('export-for-r')">
        <span class="action-title">Export for R</span>
        <span class="action-desc">Vector-friendly package</span>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="exportSuccess" class="success-toast">Export complete!</div>
    </Transition>

    <div class="filter-section citation-block">
      <label class="section-label">Citation</label>
      <div class="citation-box">
        <p class="citation-text">{{ citationText }}</p>
        <button class="copy-btn" @click="copyText(citationText, 'plain')">{{ copiedState === 'plain' ? 'Copied' : 'Copy' }}</button>
      </div>
    </div>

    <div class="filter-section citation-block">
      <label class="section-label">BibTeX</label>
      <div class="citation-box bibtex">
        <pre class="citation-code">{{ bibtexCitation }}</pre>
        <button class="copy-btn bibtex-copy" @click="copyText(bibtexCitation, 'bibtex')">{{ copiedState === 'bibtex' ? 'Copied' : 'Copy' }}</button>
      </div>
    </div>

    <div class="filter-section citation-block">
      <label class="section-label">Share URL</label>
      <div class="citation-box">
        <p class="citation-text share-url-text">{{ shareUrl }}</p>
        <button class="copy-btn" @click="copyText(shareUrl, 'share')">{{ copiedState === 'share' ? 'Copied' : 'Copy' }}</button>
      </div>
    </div>

    <div v-if="store.gbifCitation" class="filter-section gbif-citation-section">
      <label class="section-label">Data Source Citation</label>
      <div class="gbif-citation-box">
        <p class="gbif-citation-text">{{ store.gbifCitation.citation_text }}</p>
        <a v-if="store.gbifCitation.doi_url" :href="store.gbifCitation.doi_url" target="_blank" rel="noopener noreferrer" class="gbif-link">View on GBIF</a>
      </div>
    </div>

    <DatabaseUpdateSection v-if="config.features.databaseUpdate" />
  </div>
</template>

<style scoped>
.tab-panel {
  display: flex;
  flex-direction: column;
}

.export-summary-grid,
.export-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-card,
.export-action-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-tertiary, #2d2d4a);
}

.summary-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-accent, #4ade80);
}

.summary-label,
.action-desc {
  font-size: 0.72rem;
  color: var(--color-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.export-action-card {
  text-align: left;
  cursor: pointer;
  color: var(--color-text-primary, #e0e0e0);
  transition: all 0.2s ease;
}

.export-action-card:hover:not(:disabled) {
  border-color: var(--color-accent, #4ade80);
  background: #353558;
}

.export-action-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-action-r {
  grid-column: 1 / -1;
  border-color: #6366f1;
}

.action-title {
  font-size: 0.95rem;
  font-weight: 600;
}

.preview-toggle-button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
  cursor: pointer;
}

.preview-toggle-button.active {
  border-color: var(--color-accent, #4ade80);
  background: rgba(74, 222, 128, 0.12);
}

.toggle-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
  font-size: 0.68rem;
  font-weight: 700;
}

.export-settings-label {
  margin-bottom: 14px;
}

.export-checkbox-group {
  margin-top: 12px;
}

.citation-block {
  margin-top: 4px;
}

.share-url-text {
  word-break: break-all;
}

.bibtex-copy {
  top: auto;
  bottom: 10px;
}

.success-toast {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  margin-bottom: 18px;
  border-radius: 8px;
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.8rem;
  font-weight: 700;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
