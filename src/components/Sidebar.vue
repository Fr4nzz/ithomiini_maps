<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import { usePersistenceStore } from '../stores/persistence'
import { useLegendStore } from '../stores/legend'
import FilterSelect from './FilterSelect.vue'
import DateFilter from './DateFilter.vue'
import TimeSlider from './TimeSlider.vue'
import SidebarMapSettings from './SidebarMapSettings.vue'
import { useCamidAutocomplete } from '../composables/useCamidAutocomplete'
import { ASPECT_RATIOS } from '../utils/constants'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'export-for-r', 'set-view'])

const store = useDataStore()
const persistenceStore = usePersistenceStore()
const legendStore = useLegendStore()

// Toggle persistence
function togglePersistence() {
  const newValue = !persistenceStore.enabled
  persistenceStore.setEnabled(newValue)

  // If enabling, save all current state
  if (newValue) {
    persistenceStore.saveAllState({
      legendStore,
      dataStore: store
    })
  }
}

// CAMID autocomplete from composable
const {
  camidInput,
  camidTextarea,
  showCamidDropdown,
  selectedSuggestionIndex,
  camidSuggestions,
  handleCamidInput,
  selectCamid,
  handleCamidKeydown,
  handleCamidBlur,
  handleCamidClick
} = useCamidAutocomplete(store)

// Computed: Record counts
const totalRecords = computed(() => store.allFeatures.length)
const filteredRecords = computed(() => {
  const geo = store.filteredGeoJSON
  return geo ? geo.features.length : 0
})

// Image count
const imageCount = computed(() => {
  const geo = store.filteredGeoJSON
  if (!geo || !geo.features) return 0
  return geo.features.filter(f => f.properties?.image_url).length
})

// Share URL functionality
const copyShareUrl = () => {
  navigator.clipboard.writeText(window.location.href)
  showCopiedToast.value = true
  setTimeout(() => { showCopiedToast.value = false }, 2000)
}

const showCopiedToast = ref(false)

// Show date filter section
const showDateFilter = ref(false)
const showExactDates = ref(false)

// ── Source filter with Apply/Cancel ────────────────────────────────────────
// Sources are grouped: top-level items + GBIF parent with sub-datasets
const GBIF_CHILDREN = ['iNaturalist', 'GBIF (UNAM)', 'GBIF (Other Institutions)']
const TOP_LEVEL_SOURCES = computed(() =>
  store.uniqueSources.filter(s => !GBIF_CHILDREN.includes(s))
)

// Staged selection (applied only on Apply)
const stagedSources = ref([...store.filters.source])
const sourceFilterDirty = computed(() => {
  const a = [...stagedSources.value].sort()
  const b = [...store.filters.source].sort()
  return JSON.stringify(a) !== JSON.stringify(b)
})

// GBIF parent checkbox state
const gbifAllSelected = computed(() => GBIF_CHILDREN.every(c => stagedSources.value.includes(c)))
const gbifSomeSelected = computed(() => GBIF_CHILDREN.some(c => stagedSources.value.includes(c)))
const gbifIndeterminate = computed(() => gbifSomeSelected.value && !gbifAllSelected.value)

const toggleStagedSource = (source) => {
  const idx = stagedSources.value.indexOf(source)
  if (idx >= 0) {
    stagedSources.value.splice(idx, 1)
  } else {
    stagedSources.value.push(source)
  }
}

const toggleGbifParent = () => {
  if (gbifAllSelected.value) {
    // Deselect all GBIF children
    stagedSources.value = stagedSources.value.filter(s => !GBIF_CHILDREN.includes(s))
  } else {
    // Select all GBIF children
    for (const child of GBIF_CHILDREN) {
      if (!stagedSources.value.includes(child)) {
        stagedSources.value.push(child)
      }
    }
  }
}

const applySourceFilter = () => {
  store.filters.source = [...stagedSources.value]
}

const cancelSourceFilter = () => {
  stagedSources.value = [...store.filters.source]
}

// Show advanced taxonomy (Family/Tribe/Genus) within Taxonomy section
const showAdvancedTaxonomy = ref(false)

// Database Update section
const showUpdateDatabase = ref(false)
const updateSanger = ref(true)  // Default checked
const updateGbif = ref(false)
const updatePassword = ref('')
const updateStatus = ref('') // '', 'loading', 'success', 'error'
const updateMessage = ref('')

// ============================================
// DATABASE UPDATE CONFIGURATION
// Update these values when deploying to a different repository
// ============================================
const WORKER_URL = 'https://ithomiini-maps-db-updater.franz-chandi.workers.dev/'
const GITHUB_OWNER = 'rapidspeciation'
const GITHUB_REPO = 'ithomiini_maps'
// ============================================

const triggerDatabaseUpdate = async () => {
  // Verify password
  if (updatePassword.value !== 'Hyalyris') {
    updateStatus.value = 'error'
    updateMessage.value = 'Incorrect password'
    return
  }

  // Must select at least one source
  if (!updateSanger.value && !updateGbif.value) {
    updateStatus.value = 'error'
    updateMessage.value = 'Please select at least one data source'
    return
  }

  updateStatus.value = 'loading'
  updateMessage.value = 'Contacting server...'

  try {
    // Call the Cloudflare Worker to trigger GitHub Action
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: updatePassword.value,
        update_sanger: updateSanger.value,
        update_gbif: updateGbif.value,
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO
      })
    })

    if (response.ok) {
      updateStatus.value = 'success'
      const estimatedTime = updateGbif.value ? '15-20 minutes' : '2-3 minutes'
      updateMessage.value = `Update started on ${GITHUB_OWNER}/${GITHUB_REPO}! The database will refresh in approximately ${estimatedTime}. Check back later.`
    } else {
      const error = await response.text()
      updateStatus.value = 'error'
      updateMessage.value = `Update failed: ${error}`
    }
  } catch (err) {
    updateStatus.value = 'error'
    updateMessage.value = `Network error: ${err.message}. Please try again.`
  }
}

// Aspect ratio options - derived from shared constants
const aspectRatioLabels = {
  '16:9': '16:9 (Widescreen)',
  '4:3': '4:3 (Standard)',
  '1:1': '1:1 (Square)',
  '3:2': '3:2 (Photo)',
  'A4': 'A4 Portrait',
  'A4L': 'A4 Landscape',
}

const aspectRatioOptions = [
  ...Object.entries(ASPECT_RATIOS).map(([key, dims]) => ({
    value: key,
    label: aspectRatioLabels[key] || key,
    ...dims
  })),
  { value: 'custom', label: 'Custom', width: null, height: null },
]

// Get current aspect ratio dimensions
const currentExportDimensions = computed(() => {
  const option = aspectRatioOptions.find(o => o.value === store.exportSettings.aspectRatio)
  if (option && option.value !== 'custom') {
    return { width: option.width, height: option.height }
  }
  return { width: store.exportSettings.customWidth, height: store.exportSettings.customHeight }
})

// Calculate actual export pixel dimensions based on scale multiplier
const exportPixelDimensions = computed(() => {
  const base = currentExportDimensions.value
  const scale = store.exportSettings.dpi / 100
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale)
  }
})

// Update export dimensions - switches to custom mode when editing
const updateExportWidth = (value) => {
  const width = parseInt(value, 10)
  if (!isNaN(width) && width >= 100 && width <= 8000) {
    store.exportSettings.aspectRatio = 'custom'
    store.exportSettings.customWidth = width
  }
}

const updateExportHeight = (value) => {
  const height = parseInt(value, 10)
  if (!isNaN(height) && height >= 100 && height <= 8000) {
    store.exportSettings.aspectRatio = 'custom'
    store.exportSettings.customHeight = height
  }
}
</script>

<template>
  <aside class="sidebar">
    <!-- Header -->
    <header class="sidebar-header">
      <a href="https://github.com/rapidspeciation/ithomiini_maps/" target="_blank" rel="noopener noreferrer" class="logo">
        <img src="../assets/Map_icon.svg" alt="Ithomiini Maps" class="logo-icon" />
        <div class="logo-text">
          <span class="title">Ithomiini</span>
          <span class="subtitle">Distribution Maps</span>
        </div>
      </a>
    </header>

    <!-- Scrollable Content -->
    <div class="sidebar-content">
      
      <!-- View Toggle -->
      <div class="view-toggle">
        <button 
          :class="{ active: currentView === 'map' }"
          @click="emit('set-view', 'map')"
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
          @click="emit('set-view', 'table')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          Table
        </button>
      </div>

      <!-- Record Count Banner -->
      <div class="record-count">
        <span class="count">{{ filteredRecords.toLocaleString() }}</span>
        <span class="label">of {{ totalRecords.toLocaleString() }} records</span>
      </div>

      <!-- Bounding Box Active Indicator -->
      <div v-if="store.boundingBox" class="bbox-indicator">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <rect x="3" y="3" width="18" height="18" rx="0"/>
        </svg>
        <span>Spatial filter active</span>
        <button class="bbox-clear" @click="store.boundingBox = null">Clear</button>
      </div>

      <!-- Quick Actions Row -->
      <div class="quick-actions">
        <button class="action-btn" @click="emit('open-gallery')" :disabled="imageCount === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Gallery</span>
          <span class="badge" v-if="imageCount > 0">{{ imageCount }}</span>
        </button>
        <button class="action-btn" @click="emit('open-mimicry')">
          <img src="../assets/Mimicry_bttn.svg" alt="Mimicry" class="mimicry-icon" />
          <span>Mimicry</span>
          <span class="badge" v-if="store.filters.mimicry.length > 0">{{ store.filters.mimicry.length }}</span>
        </button>
        <button
          class="action-btn"
          :class="{ active: store.exportSettings.enabled }"
          @click="store.exportSettings.enabled = !store.exportSettings.enabled"
          v-if="currentView === 'map'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Preview Export</span>
        </button>
      </div>

      <!-- Export Settings (appears when Preview Export is active) -->
      <div v-if="store.exportSettings.enabled && currentView === 'map'" class="filter-section export-settings-panel">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Export Settings
        </label>

        <!-- Aspect Ratio -->
        <div class="setting-row">
          <label>Aspect Ratio</label>
          <select v-model="store.exportSettings.aspectRatio" class="style-select">
            <option v-for="opt in aspectRatioOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Dimensions (editable) -->
        <div class="setting-row">
          <label>Resolution</label>
          <div class="dimension-inputs">
            <div class="dimension-field">
              <input
                type="number"
                class="setting-input dimension-input"
                :value="currentExportDimensions.width"
                @input="updateExportWidth($event.target.value)"
                min="100"
                max="8000"
                @keydown.enter="$event.target.blur()"
              />
              <span class="dimension-label">W</span>
            </div>
            <span class="dimension-x">×</span>
            <div class="dimension-field">
              <input
                type="number"
                class="setting-input dimension-input"
                :value="currentExportDimensions.height"
                @input="updateExportHeight($event.target.value)"
                min="100"
                max="8000"
                @keydown.enter="$event.target.blur()"
              />
              <span class="dimension-label">H</span>
            </div>
          </div>
        </div>

        <!-- Include Options -->
        <div class="setting-row checkbox-group" style="margin-top: 12px;">
          <label class="checkbox-label">
            <input type="checkbox" v-model="store.exportSettings.includeLegend" />
            <span>Include Legend</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="store.exportSettings.includeScaleBar" />
            <span>Include Scale Bar</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="store.exportSettings.includeAttribution" />
            <span>Include Attribution</span>
          </label>
        </div>

        <!-- UI Scale -->
        <div class="setting-row" style="margin-top: 12px;">
          <label>UI Scale <span class="setting-hint">(legend, scale bar size)</span></label>
          <div class="slider-group">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              v-model.number="store.exportSettings.uiScale"
            />
            <span class="slider-value">{{ Math.round(store.exportSettings.uiScale * 100) }}%</span>
          </div>
        </div>

        <!-- Format Selection -->
        <div class="setting-row" style="margin-top: 12px;">
          <label>Format</label>
          <div class="format-toggle">
            <button
              :class="{ active: store.exportSettings.format === 'png' }"
              @click="store.exportSettings.format = 'png'"
            >PNG</button>
            <button
              :class="{ active: store.exportSettings.format === 'jpg' }"
              @click="store.exportSettings.format = 'jpg'"
            >JPG</button>
          </div>
        </div>

        <!-- DPI/Scale Selection -->
        <div class="setting-row" style="margin-top: 12px;">
          <label>Output Scale <span class="setting-hint">({{ exportPixelDimensions.width }}×{{ exportPixelDimensions.height }}px)</span></label>
          <div class="dpi-toggle">
            <button
              :class="{ active: store.exportSettings.dpi === 100 }"
              @click="store.exportSettings.dpi = 100"
            >1×</button>
            <button
              :class="{ active: store.exportSettings.dpi === 150 }"
              @click="store.exportSettings.dpi = 150"
            >1.5×</button>
            <button
              :class="{ active: store.exportSettings.dpi === 200 }"
              @click="store.exportSettings.dpi = 200"
            >2×</button>
            <button
              :class="{ active: store.exportSettings.dpi === 300 }"
              @click="store.exportSettings.dpi = 300"
            >3×</button>
          </div>
        </div>

        <!-- Export Button -->
        <button class="btn-export-now" @click="emit('open-map-export')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Image
        </button>

        <!-- Export for R Button -->
        <button class="btn-export-r" @click="emit('export-for-r')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export for R (Vector)
        </button>
      </div>

      <!-- CAMID Search with Autocomplete (Multi-value) -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          Search CAMIDs
        </label>
        <p class="filter-hint" style="margin-top: 0; margin-bottom: 6px;">
          Enter or paste multiple IDs (comma/space/newline separated)
        </p>
        <div class="camid-autocomplete">
          <textarea
            ref="camidTextarea"
            class="camid-textarea"
            placeholder="e.g. CAM012345, CAM012346..."
            :value="camidInput"
            @input="handleCamidInput"
            @keydown="handleCamidKeydown"
            @click="handleCamidClick"
            @focus="handleCamidClick"
            @blur="handleCamidBlur"
            autocomplete="off"
            spellcheck="false"
            rows="1"
          ></textarea>
          <div
            v-if="showCamidDropdown && camidSuggestions.length > 0"
            class="camid-dropdown"
          >
            <button
              v-for="(suggestion, index) in camidSuggestions"
              :key="suggestion"
              class="camid-suggestion"
              :class="{ selected: index === selectedSuggestionIndex }"
              @mousedown.prevent="selectCamid(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>
      </div>

      <!-- Taxonomy Section (Species/Subspecies visible, Family/Tribe/Genus expandable) -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v18m-6-6 6 6 6-6"/>
          </svg>
          Taxonomy
        </label>

        <!-- Species Multi-select with Fuzzy Search -->
        <FilterSelect
          label="Species"
          v-model="store.filters.species"
          :options="store.uniqueSpecies"
          placeholder="Search species..."
          :multiple="true"
        />

        <!-- Subspecies Multi-select -->
        <FilterSelect
          label="Subspecies"
          v-model="store.filters.subspecies"
          :options="store.uniqueSubspecies"
          placeholder="Search subspecies..."
          :multiple="true"
        />

        <!-- Advanced Taxonomy Toggle (Family/Tribe/Genus) -->
        <button
          class="subsection-toggle"
          @click="showAdvancedTaxonomy = !showAdvancedTaxonomy"
          :class="{ expanded: showAdvancedTaxonomy }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Family / Tribe / Genus
          <span v-if="store.filters.family !== 'All' || store.filters.tribe !== 'All' || store.filters.genus !== 'All'" class="active-indicator"></span>
        </button>

        <div v-show="showAdvancedTaxonomy" class="subsection-content">
          <FilterSelect
            label="Family"
            v-model="store.filters.family"
            :options="['All', ...store.uniqueFamilies]"
            placeholder="All Families"
            :multiple="false"
            :show-count="false"
          />

          <FilterSelect
            label="Tribe"
            v-model="store.filters.tribe"
            :options="['All', ...store.uniqueTribes]"
            placeholder="All Tribes"
            :multiple="false"
            :show-count="false"
          />

          <FilterSelect
            label="Genus"
            v-model="store.filters.genus"
            :options="['All', ...store.uniqueGenera]"
            placeholder="All Genera"
            :multiple="false"
          />
        </div>
      </div>

      <!-- Date Filter with Time Slider -->
      <div class="filter-section collapsible">
        <button
          class="collapse-toggle"
          @click="showDateFilter = !showDateFilter"
          :class="{ expanded: showDateFilter }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Time Range
          <span v-if="store.filters.dateStart || store.filters.dateEnd" class="active-badge">
            Active
          </span>
        </button>

        <div v-show="showDateFilter" class="collapse-content no-padding">
          <TimeSlider />

          <!-- Expandable exact date inputs -->
          <div class="exact-dates-section">
            <button
              class="subsection-toggle"
              @click="showExactDates = !showExactDates"
              :class="{ expanded: showExactDates }"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
              Exact Dates
            </button>
            <div v-show="showExactDates" class="subsection-content">
              <DateFilter />
            </div>
          </div>
        </div>
      </div>

      <!-- Sequencing Status (Dropdown with All default) -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Sequencing Status
        </label>

        <FilterSelect
          v-model="store.filters.status"
          :options="store.uniqueStatuses"
          placeholder="All Statuses"
          :multiple="true"
        />
        <p class="filter-hint" v-if="store.filters.status.length > 0">
          {{ store.filters.status.length }} status{{ store.filters.status.length > 1 ? 'es' : '' }} selected
        </p>
      </div>

      <!-- Data Source (Checkbox panel with Apply/Cancel) -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
          </svg>
          Data Source
        </label>
        <div class="source-checkbox-panel">
          <!-- Top-level sources (non-GBIF) -->
          <label v-for="source in TOP_LEVEL_SOURCES" :key="source" class="source-checkbox">
            <input
              type="checkbox"
              :checked="stagedSources.includes(source)"
              @change="toggleStagedSource(source)"
            />
            <span>{{ source }}</span>
          </label>

          <!-- GBIF parent group -->
          <label class="source-checkbox gbif-parent">
            <input
              type="checkbox"
              :checked="gbifAllSelected"
              :indeterminate="gbifIndeterminate"
              @change="toggleGbifParent"
            />
            <span>GBIF</span>
          </label>
          <!-- GBIF children (indented) -->
          <label v-for="child in GBIF_CHILDREN" :key="child" class="source-checkbox gbif-child">
            <input
              type="checkbox"
              :checked="stagedSources.includes(child)"
              @change="toggleStagedSource(child)"
            />
            <span>{{ child }}</span>
          </label>

          <!-- Apply / Cancel buttons -->
          <div class="source-filter-actions" v-if="sourceFilterDirty">
            <button class="btn-source-cancel" @click="cancelSourceFilter">Cancel</button>
            <button class="btn-source-apply" @click="applySourceFilter">Apply</button>
          </div>
        </div>
        <p class="filter-hint" v-if="store.sourceLoading.size > 0">
          Loading {{ [...store.sourceLoading].join(', ') }}...
        </p>
        <p class="filter-hint" v-else-if="store.filters.source.length === 0">
          No sources selected - showing all data
        </p>
      </div>

      <!-- Country Filter -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          Country
        </label>
        <FilterSelect
          v-model="store.filters.country"
          :options="['All', ...store.uniqueCountries]"
          placeholder="All Countries"
          :multiple="false"
          :show-count="false"
        />
      </div>

      <!-- Sex Filter -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="9" r="5"/>
            <path d="M9 14v7M6 18h6"/>
            <circle cx="17" cy="15" r="5"/>
            <path d="M21 11l-2.5 2.5M21 11h-4M21 11v4"/>
          </svg>
          Sex
        </label>
        <select class="sex-select" v-model="store.filters.sex">
          <option value="all">All (♂ + ♀)</option>
          <option value="male">♂ Male only</option>
          <option value="female">♀ Female only</option>
        </select>
      </div>

      <!-- UI Preferences -->
      <div class="filter-section">
        <label class="thumbnail-toggle">
          <input type="checkbox" v-model="store.showThumbnail" />
          <span>Show thumbnails</span>
        </label>
      </div>

      <!-- Map-specific Settings (Scatter, Clustering, Legend, Point Style) -->
      <SidebarMapSettings v-if="currentView === 'map'" />

      <!-- Remember Settings -->
      <div class="filter-section remember-settings">
        <div class="setting-row toggle-row">
          <div class="setting-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Remember Settings</span>
          </div>
          <button
            class="toggle-button"
            :class="{ active: persistenceStore.enabled }"
            @click="togglePersistence"
            :title="persistenceStore.enabled ? 'Settings will be saved on page refresh' : 'Settings will reset on page refresh'"
          >
            {{ persistenceStore.enabled ? 'ON' : 'OFF' }}
          </button>
        </div>
        <p class="filter-hint" style="margin-top: 4px;">
          {{ persistenceStore.enabled ? 'All settings saved to browser' : 'Settings reset on refresh' }}
        </p>
      </div>

    </div>

    <!-- Update Database Section -->
    <div class="update-database-section">
      <button
        class="collapse-toggle update-toggle"
        @click="showUpdateDatabase = !showUpdateDatabase"
        :class="{ expanded: showUpdateDatabase }"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/>
        </svg>
        Update Database
        <svg class="chevron" :class="{ rotated: showUpdateDatabase }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      <Transition name="slide">
        <div v-if="showUpdateDatabase" class="update-content">
          <p class="filter-hint">
            Refresh data from external sources. GBIF updates take ~15 minutes.
          </p>

          <!-- Source checkboxes -->
          <div class="update-sources">
            <label class="update-checkbox">
              <input type="checkbox" v-model="updateSanger" />
              <span>Sanger Institute</span>
            </label>
            <label class="update-checkbox">
              <input type="checkbox" v-model="updateGbif" />
              <span>GBIF (includes iNaturalist)</span>
            </label>
          </div>

          <!-- Password input -->
          <div class="update-password">
            <input
              type="password"
              v-model="updatePassword"
              placeholder="Enter password"
              :disabled="updateStatus === 'loading'"
              @keyup.enter="triggerDatabaseUpdate"
            />
          </div>

          <!-- Update button -->
          <button
            class="update-btn"
            @click="triggerDatabaseUpdate"
            :disabled="updateStatus === 'loading'"
          >
            <svg v-if="updateStatus !== 'loading'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 0 1-9 9"/>
              <path d="M21 3v6h-6"/>
              <path d="M3 12a9 9 0 0 1 9-9"/>
              <path d="M3 21v-6h6"/>
            </svg>
            <svg v-else class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-dasharray="62" stroke-dashoffset="20"/>
            </svg>
            {{ updateStatus === 'loading' ? 'Updating...' : 'Start Update' }}
          </button>

          <!-- Status message -->
          <div
            v-if="updateMessage"
            class="update-message"
            :class="{ success: updateStatus === 'success', error: updateStatus === 'error' }"
          >
            {{ updateMessage }}
          </div>
        </div>
      </Transition>
    </div>

    <!-- Footer Actions -->
    <footer class="sidebar-footer">
      <div class="footer-row">
        <button class="btn-reset" @click="store.resetAllFilters">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Reset
        </button>

        <button class="btn-share" @click="copyShareUrl">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <path d="m8.59 13.51 6.83 3.98m-.01-10.98-6.82 3.98"/>
          </svg>
          Share
        </button>

        <button class="btn-export" @click="emit('open-export')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>

      <!-- Toast notification -->
      <Transition name="toast">
        <div v-if="showCopiedToast" class="toast">
          URL copied to clipboard!
        </div>
      </Transition>
    </footer>
  </aside>
</template>

<style scoped src="./sidebar-styles.css"></style>
