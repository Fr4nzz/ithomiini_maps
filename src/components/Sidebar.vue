<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import FilterSelect from './FilterSelect.vue'
import DateFilter from './DateFilter.vue'
import SidebarMapSettings from './SidebarMapSettings.vue'
import { useCamidAutocomplete } from '../composables/useCamidAutocomplete'
import { ASPECT_RATIOS } from '../utils/constants'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'set-view'])

const store = useDataStore()

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

// Show advanced taxonomy (Family/Tribe/Genus) within Taxonomy section
const showAdvancedTaxonomy = ref(false)

// Show URL share settings section
const showUrlSettings = ref(false)

// Show citation section
const showCitation = ref(false)

// Database Update section
const showUpdateDatabase = ref(false)
const updateSanger = ref(true)  // Default checked
const updateGbif = ref(false)
const updatePassword = ref('')
const updateStatus = ref('') // '', 'loading', 'success', 'error'
const updateMessage = ref('')

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
    const response = await fetch('https://ithomiini-db-updater.franz-chandi.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: updatePassword.value,
        update_sanger: updateSanger.value,
        update_gbif: updateGbif.value
      })
    })

    if (response.ok) {
      updateStatus.value = 'success'
      const estimatedTime = updateGbif.value ? '15-20 minutes' : '2-3 minutes'
      updateMessage.value = `Update started! The database will refresh in approximately ${estimatedTime}. Check back later.`
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
      <a href="https://github.com/Fr4nzz/ithomiini_maps/" target="_blank" rel="noopener noreferrer" class="logo">
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

      <!-- Date Filter (Collapsible) -->
      <div class="filter-section collapsible">
        <button 
          class="collapse-toggle"
          @click="showDateFilter = !showDateFilter"
          :class="{ expanded: showDateFilter }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Date Range
          <span v-if="store.filters.dateStart || store.filters.dateEnd" class="active-badge">
            Active
          </span>
        </button>

        <div v-show="showDateFilter" class="collapse-content no-padding">
          <DateFilter />
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

      <!-- Data Source (Multi-select, default Sanger) -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
          </svg>
          Data Source
        </label>
        <FilterSelect
          v-model="store.filters.source"
          :options="store.uniqueSources"
          placeholder="Select sources..."
          :multiple="true"
        />
        <p class="filter-hint" v-if="store.filters.source.length === 0">
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

      <!-- URL Share Settings -->
      <div class="filter-section collapsible">
        <button
          class="collapse-toggle"
          @click="showUrlSettings = !showUrlSettings"
          :class="{ expanded: showUrlSettings }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          URL Share Settings
        </button>

        <div v-show="showUrlSettings" class="collapse-content">
          <p class="filter-hint" style="margin-top: 0; margin-bottom: 12px;">
            Choose which settings to include when sharing URLs
          </p>

          <div class="setting-row checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="store.urlSettings.includeFilters" />
              <span>Include Filters</span>
            </label>
            <p class="checkbox-hint">Taxonomy, mimicry, status, source filters</p>

            <label class="checkbox-label">
              <input type="checkbox" v-model="store.urlSettings.includeMapView" />
              <span>Include Map View</span>
            </label>
            <p class="checkbox-hint">Map center, zoom, rotation</p>

            <label class="checkbox-label">
              <input type="checkbox" v-model="store.urlSettings.includeStyleSettings" />
              <span>Include Style Settings</span>
            </label>
            <p class="checkbox-hint">Color by, legend, point style</p>
          </div>
        </div>
      </div>

    </div>

    <!-- GBIF Citation -->
    <div v-if="store.gbifCitation" class="citation-section">
      <button class="citation-toggle" @click="showCitation = !showCitation">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        <span>Data Citation</span>
        <svg class="chevron" :class="{ rotated: showCitation }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <Transition name="slide">
        <div v-if="showCitation" class="citation-content">
          <p class="citation-text">{{ store.gbifCitation.citation_text }}</p>
          <a
            v-if="store.gbifCitation.doi_url"
            :href="store.gbifCitation.doi_url"
            target="_blank"
            rel="noopener noreferrer"
            class="citation-link"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            View on GBIF
          </a>
          <div class="citation-stats">
            <div class="stat">
              <span class="stat-value">{{ store.gbifCitation.dataset_breakdown?.iNaturalist?.toLocaleString() || 0 }}</span>
              <span class="stat-label">iNaturalist</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ store.gbifCitation.dataset_breakdown?.['Other GBIF']?.toLocaleString() || 0 }}</span>
              <span class="stat-label">Other GBIF</span>
            </div>
          </div>
        </div>
      </Transition>
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

<style scoped>
.sidebar {
  width: 340px;
  min-width: 340px;
  height: 100vh;
  background: var(--color-bg-secondary, #252540);
  border-right: 1px solid var(--color-border, #3d3d5c);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-primary, #1a1a2e);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  transition: opacity 0.2s;
}

.logo:hover {
  opacity: 0.85;
}

.logo svg {
  width: 36px;
  height: 36px;
  color: var(--color-accent, #4ade80);
}

.logo-icon {
  width: 40px;
  height: 40px;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-text .title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
  letter-spacing: -0.5px;
}

.logo-text .subtitle {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Scrollable Content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* View Toggle */
.view-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  padding: 4px;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 8px;
}

.view-toggle button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle button:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-secondary, #aaa);
}

.view-toggle button.active {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

.view-toggle button svg {
  width: 16px;
  height: 16px;
}

/* Record Count */
.record-count {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, rgba(74, 222, 128, 0.05) 100%);
  border: 1px solid rgba(74, 222, 128, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  text-align: center;
}

.record-count .count {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-accent, #4ade80);
  font-variant-numeric: tabular-nums;
}

.record-count .label {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #aaa);
  margin-left: 6px;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.action-btn:hover:not(:disabled) {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
  border-color: var(--color-accent, #4ade80);
}

.action-btn.active {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
}

.action-btn.active:hover {
  background: rgba(74, 222, 128, 0.25);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

.action-btn .mimicry-icon {
  width: 22px;
  height: 22px;
}

.action-btn .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.6rem;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* Filter Sections */
.filter-section {
  margin-bottom: 20px;
}

/* Export Settings Panel */
.export-settings-panel {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.08) 0%, rgba(74, 222, 128, 0.03) 100%);
  border: 1px solid rgba(74, 222, 128, 0.2);
  border-radius: 8px;
  padding: 14px;
}

.export-settings-panel .section-label {
  color: var(--color-accent, #4ade80);
}

.btn-export-now {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  margin-top: 16px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 6px;
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-export-now:hover {
  background: #5eeb94;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);
}

.btn-export-now svg {
  width: 18px;
  height: 18px;
}

/* Format and DPI Toggle Buttons */
.format-toggle,
.dpi-toggle {
  display: flex;
  gap: 6px;
}

.format-toggle button,
.dpi-toggle button {
  flex: 1;
  padding: 8px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.format-toggle button:hover,
.dpi-toggle button:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.format-toggle button.active,
.dpi-toggle button.active {
  background: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-secondary, #aaa);
  margin-bottom: 10px;
}

.section-label svg {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

/* Thumbnail Toggle */
.thumbnail-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.thumbnail-toggle:hover {
  background: var(--color-bg-hover, #363653);
}

.thumbnail-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-accent, #4ade80);
}

.thumbnail-toggle span {
  font-size: 0.9rem;
  color: var(--color-text-primary, #e0e0e0);
  font-weight: 500;
}

/* CAMID Autocomplete */
.camid-autocomplete {
  position: relative;
}

.camid-textarea {
  width: 100%;
  min-height: 38px;
  max-height: 120px; /* ~5 lines */
  padding: 10px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  font-family: monospace;
  line-height: 1.4;
  resize: vertical;
  overflow: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  transition: border-color 0.2s;
}

.camid-textarea:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1);
}

.camid-textarea::placeholder {
  color: var(--color-text-muted, #666);
  font-family: inherit;
}

.camid-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-top: none;
  border-radius: 0 0 6px 6px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.camid-suggestion {
  width: 100%;
  padding: 8px 14px;
  background: transparent;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  font-family: monospace;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.camid-suggestion:hover,
.camid-suggestion.selected {
  background: var(--color-bg-hover, #363653);
}

.camid-suggestion.selected {
  color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1);
}

/* Collapsible Sections */
.collapsible {
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  /* overflow: visible to allow dropdowns to extend outside */
}

.collapse-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: none;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.collapse-toggle:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.collapse-toggle svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.collapse-toggle.expanded svg {
  transform: rotate(90deg);
}

.active-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
  border-radius: 4px;
  font-size: 0.7rem;
}

.collapse-content {
  padding: 12px 14px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.collapse-content.no-padding {
  padding: 0;
}

/* Subsection Toggle (used within filter sections for nested expandable content) */
.subsection-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  margin-top: 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-muted, #666);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.subsection-toggle:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-secondary, #aaa);
  border-color: var(--color-text-muted, #666);
}

.subsection-toggle svg {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.subsection-toggle.expanded svg {
  transform: rotate(90deg);
}

.subsection-toggle .active-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent, #4ade80);
  margin-left: auto;
}

.subsection-content {
  padding: 12px;
  margin-top: 8px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
}

.filter-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
  margin-top: 8px;
}

/* Footer */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-primary, #1a1a2e);
  position: relative;
}

.footer-row {
  display: flex;
  gap: 8px;
}

.btn-reset,
.btn-share,
.btn-export {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset {
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  color: var(--color-text-secondary, #aaa);
}

.btn-reset:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
}

.btn-share {
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  color: var(--color-text-secondary, #aaa);
}

.btn-share:hover {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
}

.btn-export {
  background: var(--color-accent, #4ade80);
  border: none;
  color: var(--color-bg-primary, #1a1a2e);
}

.btn-export:hover {
  background: #5eeb94;
}

.btn-reset svg,
.btn-share svg,
.btn-export svg {
  width: 14px;
  height: 14px;
}

/* Toast */
.toast {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  margin-bottom: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-row label {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #aaa);
  font-weight: 500;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-group input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 2px;
  outline: none;
}

.slider-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent, #4ade80);
  cursor: pointer;
  transition: transform 0.15s;
}

.slider-group input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.slider-group input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: var(--color-accent, #4ade80);
  cursor: pointer;
}

.slider-value {
  min-width: 45px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-accent, #4ade80);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.setting-input {
  width: 55px;
  padding: 4px 6px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-accent, #4ade80);
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
}

.setting-input::-webkit-outer-spin-button,
.setting-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.setting-input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

.setting-hint {
  font-weight: 400;
  font-size: 0.65rem;
  color: var(--color-text-muted, #666);
}

/* Style Select */
.style-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.style-select:hover {
  border-color: var(--color-text-muted, #666);
}

.style-select:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

/* Sex Select */
.sex-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.sex-select:hover {
  border-color: var(--color-text-muted, #666);
}

.sex-select:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

/* Export Settings */
.dimension-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dimension-field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dimension-input {
  width: 70px !important;
}

.dimension-label {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
}

.dimension-x {
  color: var(--color-text-muted, #666);
  font-size: 0.9rem;
}

/* Checkbox Group */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 0;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-accent, #4ade80);
}

.checkbox-label span {
  font-size: 0.85rem;
  color: var(--color-text-primary, #e0e0e0);
}

.checkbox-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  margin: -4px 0 4px 26px;
  font-style: italic;
}

/* Citation Section */
.citation-section {
  border-top: 1px solid var(--color-border, #3d3d5c);
  padding: 12px 16px;
}

.citation-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.citation-toggle:hover {
  background: var(--color-bg-primary, #1a1a2e);
  color: var(--color-text-primary, #e0e0e0);
}

.citation-toggle svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.citation-toggle .chevron {
  margin-left: auto;
  transition: transform 0.2s;
}

.citation-toggle .chevron.rotated {
  transform: rotate(180deg);
}

.citation-content {
  margin-top: 12px;
  padding: 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 6px;
  border: 1px solid var(--color-border, #3d3d5c);
}

.citation-text {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.5;
  margin: 0 0 12px 0;
}

.citation-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 4px;
  color: var(--color-accent, #4ade80);
  font-size: 0.75rem;
  text-decoration: none;
  transition: all 0.2s;
}

.citation-link:hover {
  background: rgba(74, 222, 128, 0.2);
  border-color: rgba(74, 222, 128, 0.5);
}

.citation-link svg {
  width: 14px;
  height: 14px;
}

.citation-stats {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.citation-stats .stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.citation-stats .stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-accent, #4ade80);
}

.citation-stats .stat-label {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
}

/* Slide transition for citation */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Update Database Section */
.update-database-section {
  padding: 0 20px 16px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.update-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  background: none;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
}

.update-toggle:hover {
  color: var(--color-accent, #4ade80);
}

.update-toggle svg:first-child {
  width: 18px;
  height: 18px;
  color: var(--color-accent, #4ade80);
}

.update-toggle .chevron {
  width: 16px;
  height: 16px;
  margin-left: auto;
  transition: transform 0.2s;
}

.update-toggle .chevron.rotated {
  transform: rotate(180deg);
}

.update-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.update-sources {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.update-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #b0b0b0);
}

.update-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent, #4ade80);
  cursor: pointer;
}

.update-checkbox:hover {
  color: var(--color-text-primary, #e0e0e0);
}

.update-password input {
  width: 100%;
  padding: 10px 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
}

.update-password input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

.update-password input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.update-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 6px;
  color: #1a1a2e;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.update-btn:hover:not(:disabled) {
  background: #3fcd73;
  transform: translateY(-1px);
}

.update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.update-btn svg {
  width: 18px;
  height: 18px;
}

.update-btn .spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.update-message {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.4;
}

.update-message.success {
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
}

.update-message.error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    min-width: 100%;
    height: auto;
    max-height: 50vh;
  }

  .view-toggle {
    display: none;
  }
}
</style>
