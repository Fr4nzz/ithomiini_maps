<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'
import { usePersistenceStore } from '../stores/persistence'
import { useLegendStore } from '../stores/legend'
import { useSDMStore } from '../stores/sdm'
import FilterSelect from './FilterSelect.vue'
import DateFilter from './DateFilter.vue'
import TimeSlider from './TimeSlider.vue'
import SidebarMapSettings from './SidebarMapSettings.vue'
import DatabaseUpdateSection from './DatabaseUpdateSection.vue'
import { useCamidAutocomplete } from '../composables/useCamidAutocomplete'
import { ASPECT_RATIOS } from '../utils/constants'
import config from '../config'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'export-for-r', 'set-view', 'open-global-search'])

const store = useDataStore()
const persistenceStore = usePersistenceStore()
const legendStore = useLegendStore()
const sdmStore = useSDMStore()

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
const goatChromosomeMinInput = ref('')
const goatChromosomeMaxInput = ref('')
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

watch(() => store.filters.source, (newSource) => {
  stagedSources.value = [...newSource]
}, { deep: true })

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

const toggleGoatSource = (source) => {
  const idx = store.filters.goatDataSource.indexOf(source)
  if (idx >= 0) {
    store.filters.goatDataSource.splice(idx, 1)
  } else {
    store.filters.goatDataSource.push(source)
  }
}

// Show advanced taxonomy (Family/Tribe/Genus) within Taxonomy section
const showAdvancedTaxonomy = ref(false)

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
      <a :href="config.repoUrl" target="_blank" rel="noopener noreferrer" class="logo">
        <img :src="config.logoPath" :alt="`${config.title} Maps`" class="logo-icon" />
        <div class="logo-text">
          <span class="title">{{ config.title }}</span>
          <span class="subtitle">{{ config.subtitle }}</span>
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
        <button v-if="config.features.imageGallery" class="action-btn" @click="emit('open-gallery')" :disabled="imageCount === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Gallery</span>
          <span class="badge" v-if="imageCount > 0">{{ imageCount }}</span>
        </button>
        <button v-if="config.features.mimicrySelector" class="action-btn" @click="emit('open-mimicry')">
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
          <button
            type="button"
            class="shortcut-hint"
            title="Search across all taxa, countries, and mimicry rings"
            @click="$emit('open-global-search')"
          >
            <span class="shortcut-hint-label">Global search</span>
            <kbd>⌘/Ctrl+K</kbd>
          </button>
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
          <span v-if="store.filters.family.length || store.filters.tribe.length || store.filters.genus.length" class="active-indicator"></span>
        </button>

        <div v-show="showAdvancedTaxonomy" class="subsection-content">
          <FilterSelect
            label="Family"
            v-model="store.filters.family"
            :options="store.uniqueFamilies"
            placeholder="All Families"
            :multiple="true"
            :show-count="false"
          />

          <FilterSelect
            label="Tribe"
            v-model="store.filters.tribe"
            :options="store.uniqueTribes"
            placeholder="All Tribes"
            :multiple="true"
            :show-count="false"
          />

          <FilterSelect
            label="Genus"
            v-model="store.filters.genus"
            :options="store.uniqueGenera"
            placeholder="All Genera"
            :multiple="true"
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

      <div v-if="config.features.goatIntegration" class="filter-section collapsible">
        <button
          class="collapse-toggle"
          @click="store.showGoatFilter = !store.showGoatFilter"
          :class="{ expanded: store.showGoatFilter }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Genomic Data (GoaT)
          <span v-if="store.filters.goatCoverage !== 'all' || store.filters.goatDataSource.length > 0 || store.filters.goatChromosomeMin != null || store.filters.goatChromosomeMax != null" class="active-badge">
            Active
          </span>
          <span v-if="store.goatLoading" class="active-badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">
            Loading...
          </span>
        </button>

        <div v-show="store.showGoatFilter" class="collapse-content">
          <div class="goat-filter-group">
            <label class="goat-filter-label">GoaT Coverage</label>
            <div class="goat-toggle-group">
              <button
                :class="{ active: store.filters.goatCoverage === 'all' }"
                @click="store.filters.goatCoverage = 'all'"
              >All</button>
              <button
                :class="{ active: store.filters.goatCoverage === 'in_goat' }"
                @click="store.filters.goatCoverage = 'in_goat'"
              >In GoaT</button>
              <button
                :class="{ active: store.filters.goatCoverage === 'not_in_goat' }"
                @click="store.filters.goatCoverage = 'not_in_goat'"
              >Not in GoaT</button>
            </div>
          </div>

          <div class="goat-filter-group">
            <label class="goat-filter-label">Genome Data Source</label>
            <div class="goat-checkboxes">
              <label class="source-checkbox">
                <input
                  type="checkbox"
                  :checked="store.filters.goatDataSource.includes('direct')"
                  @change="toggleGoatSource('direct')"
                />
                <span>Direct (measured)</span>
              </label>
              <label class="source-checkbox">
                <input
                  type="checkbox"
                  :checked="store.filters.goatDataSource.includes('estimated')"
                  @change="toggleGoatSource('estimated')"
                />
                <span>Estimated (phylogenetic)</span>
              </label>
              <label class="source-checkbox">
                <input
                  type="checkbox"
                  :checked="store.filters.goatDataSource.includes('none')"
                  @change="toggleGoatSource('none')"
                />
                <span>No GoaT data</span>
              </label>
            </div>
          </div>

          <div class="goat-filter-group">
            <label class="goat-filter-label">Chromosome Number (2n)</label>
            <div class="chr-range-inputs">
              <input
                type="number"
                class="chr-input"
                placeholder="Min"
                v-model="goatChromosomeMinInput"
                @change="store.filters.goatChromosomeMin = goatChromosomeMinInput ? Number(goatChromosomeMinInput) : null"
                :min="store.chromosomeRange.min"
                :max="store.chromosomeRange.max"
              />
              <span class="chr-separator">–</span>
              <input
                type="number"
                class="chr-input"
                placeholder="Max"
                v-model="goatChromosomeMaxInput"
                @change="store.filters.goatChromosomeMax = goatChromosomeMaxInput ? Number(goatChromosomeMaxInput) : null"
                :min="store.chromosomeRange.min"
                :max="store.chromosomeRange.max"
              />
            </div>
          </div>

          <p v-if="store.goatLoaded && store.goatMeta" class="filter-hint">
            {{ store.goatMeta.totalSpecies.toLocaleString() }} species from GoaT
          </p>
          <p v-else-if="!store.goatLoaded && !store.goatLoading" class="filter-hint">
            GoaT data not available
          </p>
        </div>
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
          :options="store.uniqueCountries"
          placeholder="All Countries"
          :multiple="true"
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

      <!-- SDM Predicted Distributions -->
      <div v-if="currentView === 'map' && sdmStore.hasData" class="filter-section collapsible">
        <button
          class="collapse-toggle"
          @click="sdmStore.toggle()"
          :class="{ expanded: sdmStore.enabled }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Predicted Distribution
          <span v-if="sdmStore.selectedSpecies.length > 0" class="active-badge">
            {{ sdmStore.selectedSpecies.length }} selected
          </span>
        </button>

        <div v-show="sdmStore.enabled" class="collapse-content">
          <FilterSelect
            label="SDM Species"
            v-model="sdmStore.selectedSpecies"
            :options="sdmStore.availableSpecies"
            placeholder="Select up to 2 species..."
            :multiple="true"
          />

          <p v-if="sdmStore.selectedSpecies.length > 2" class="filter-hint" style="color: var(--error-color, #f87171);">
            Max 2 species for overlay comparison
          </p>

          <div v-if="sdmStore.selectedSpecies.length > 0" class="sdm-legend">
            <div class="sdm-legend-item" v-for="(sp, idx) in sdmStore.selectedSpecies.slice(0, 2)" :key="sp">
              <span class="sdm-legend-species">{{ sp }}</span>
              <span v-if="sdmStore.getSDMInfo(sp)" class="sdm-confidence-badge" :class="sdmStore.getSDMInfo(sp).confidence">
                {{ sdmStore.getSDMInfo(sp).confidence }}
              </span>
              <div class="sdm-gradient-bar" :class="idx === 0 ? 'warm' : 'cool'">
                <span class="sdm-gradient-label-low">Low</span>
                <span class="sdm-gradient-label-high">High</span>
              </div>
              <div v-if="sdmStore.getSDMInfo(sp)" class="sdm-model-info">
                <div class="sdm-info-grid">
                  <span class="sdm-info-label">Records</span>
                  <span class="sdm-info-value">{{ sdmStore.getSDMInfo(sp).n_records }}</span>
                  <span class="sdm-info-label">AUC</span>
                  <span class="sdm-info-value">{{ sdmStore.getSDMInfo(sp).auc }}</span>
                  <span class="sdm-info-label">Boyce</span>
                  <span class="sdm-info-value">{{ sdmStore.getSDMInfo(sp).boyce || '—' }}</span>
                  <span class="sdm-info-label">Tier</span>
                  <span class="sdm-info-value">{{ sdmStore.getSDMInfo(sp).tier }}</span>
                  <span class="sdm-info-label">Algorithms</span>
                  <span class="sdm-info-value">{{ (sdmStore.getSDMInfo(sp).algorithms_used || []).join(', ') || '—' }}</span>
                </div>
              </div>
              <div v-if="sdmStore.getSDMInfo(sp)?.env_summary?.length" class="sdm-env-section">
                <div
                  v-for="env in sdmStore.getSDMInfo(sp).env_summary.slice(0, 5)"
                  :key="env.variable"
                  class="sdm-env-card"
                >
                  <div class="sdm-env-header">
                    <span class="sdm-env-name">{{ env.label }}</span>
                    <span class="sdm-env-range">{{ env.optimal_range[0] }}–{{ env.optimal_range[1] }}{{ env.unit }}</span>
                  </div>
                  <div class="sdm-chart-wrap">
                    <span class="sdm-y-label">Suitability</span>
                    <svg class="sdm-sparkline" viewBox="0 0 200 40" preserveAspectRatio="none">
                      <polyline
                        :points="env.response_mean.map((v, i) => `${i * 200 / (env.response_mean.length - 1)},${40 - v * 40}`).join(' ')"
                        fill="none"
                        stroke="var(--color-accent, #4ade80)"
                        stroke-width="1.5"
                      />
                      <polygon
                        :points="[
                          ...env.response_mean.map((v, i) => `${i * 200 / (env.response_mean.length - 1)},${40 - (v + (env.response_std?.[i] || 0)) * 40}`),
                          ...env.response_mean.map((v, i) => `${(env.response_mean.length - 1 - i) * 200 / (env.response_mean.length - 1)},${40 - (env.response_mean[env.response_mean.length - 1 - i] - (env.response_std?.[env.response_mean.length - 1 - i] || 0)) * 40}`),
                        ].join(' ')"
                        fill="var(--color-accent, #4ade80)"
                        fill-opacity="0.15"
                      />
                    </svg>
                  </div>
                  <div class="sdm-x-axis">
                    <span>{{ Math.round(env.gradient[0] * 10) / 10 }}</span>
                    <span class="sdm-x-axis-label">{{ env.label }} ({{ env.unit || 'index' }})</span>
                    <span>{{ Math.round(env.gradient[env.gradient.length - 1] * 10) / 10 }}</span>
                  </div>
                  <div class="sdm-env-footer">
                    <span class="sdm-env-importance" :style="{ width: (env.importance * 100) + '%' }"></span>
                    <span class="sdm-env-conf">{{ Math.round(env.confidence * 100) }}%</span>
                  </div>
                </div>
              </div>
            </div>
            <span class="sdm-legend-caption">Habitat suitability</span>
          </div>

          <div v-if="sdmStore.selectedSpecies.length > 0" class="sdm-opacity-row">
            <span class="sdm-opacity-label">Opacity</span>
            <input
              type="range" min="0.1" max="1" step="0.1"
              :value="sdmStore.opacity"
              @input="sdmStore.setOpacity(parseFloat($event.target.value))"
            />
            <span class="sdm-opacity-value">{{ Math.round(sdmStore.opacity * 100) }}%</span>
          </div>

          <p class="filter-hint">
            {{ sdmStore.nSpecies }} species modelled · Tiered ensemble
          </p>
        </div>
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

    <DatabaseUpdateSection v-if="config.features.databaseUpdate" />

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
