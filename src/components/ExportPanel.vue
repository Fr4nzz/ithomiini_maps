<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import { exportForR as exportForRUtil } from '../utils/rExport'

const store = useDataStore()

const emit = defineEmits(['close'])

const props = defineProps({
  map: {
    type: Object,
    default: null
  },
  initialTab: {
    type: String,
    default: 'export'
  }
})

// Export state
const isExporting = ref(false)
const exportSuccess = ref(false)
const citationCopied = ref(false)
const exportError = ref(null)

// Get filtered data
const filteredData = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return []
  return geo.features.map(f => f.properties)
})

// Build info (injected by Vite)
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
  const url = window.location.href.split('?')[0]

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

    const columns = [
      'id', 'scientific_name', 'genus', 'species', 'subspecies',
      'family', 'tribe', 'mimicry_ring', 'sequencing_status',
      'source', 'country', 'lat', 'lng', 'sex', 'image_url'
    ]

    const header = columns.join(',')
    const rows = data.map(row => {
      return columns.map(col => {
        let val = row[col]
        if (val === null || val === undefined) val = ''
        val = String(val)
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = '"' + val.replace(/"/g, '""') + '"'
        }
        return val
      }).join(',')
    })

    const csv = [header, ...rows].join('\n')
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

// R Script Export - uses shared utility
const exportForR = async () => {
  if (!props.map) {
    exportError.value = 'Map not available. Please ensure you are on the Map view.'
    return
  }

  isExporting.value = true
  exportError.value = null

  try {
    await exportForRUtil(props.map)
    exportSuccess.value = true
    setTimeout(() => {
      isExporting.value = false
      exportSuccess.value = false
    }, 2000)
  } catch (e) {
    console.error('[Export] R export failed:', e)
    exportError.value = e.message || 'Export failed'
    isExporting.value = false
  }
}

// Active tab - use prop as initial value
const activeTab = ref(props.initialTab || 'export')
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

      <!-- Export Data Tab -->
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

          <!-- R Export Button for True Vector Output -->
          <button
            class="export-btn r-export"
            @click="exportForR"
            :disabled="!map || isExporting || filteredData.length === 0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div class="btn-text">
              <span class="btn-title">Export for R (Vector)</span>
              <span class="btn-desc">ZIP with GeoJSON + R script for SVG/PDF</span>
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
  gap: 16px;
}

.info-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
  margin: 0;
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

/* Option Groups */
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

.option-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
}

/* Format Buttons */
.format-buttons,
.dpi-buttons {
  display: flex;
  gap: 8px;
}

.format-buttons button,
.dpi-buttons button {
  flex: 1;
  padding: 10px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.format-buttons button:hover,
.dpi-buttons button:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.format-buttons button.active,
.dpi-buttons button.active {
  background: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

/* Select Input */
.select-input {
  padding: 10px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  cursor: pointer;
}

.select-input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

/* Custom Size */
.custom-size .size-inputs {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.size-input {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.size-input label {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
}

.size-input input {
  padding: 8px 10px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
}

.size-input input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

.size-separator {
  color: var(--color-text-muted, #666);
  font-size: 1.2rem;
  padding-bottom: 8px;
}

/* Export Options */
.export-options,
.export-buttons {
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

.export-btn.r-export {
  border-color: #6366f1;
}

.export-btn.r-export svg {
  color: #6366f1;
}

.export-btn.r-export:hover:not(:disabled) {
  border-color: #818cf8;
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

/* Export Image Button */
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

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

  .format-buttons,
  .dpi-buttons {
    flex-wrap: wrap;
  }

  .format-buttons button,
  .dpi-buttons button {
    min-width: calc(33% - 8px);
  }
}
</style>
