<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import FilterSelect from './FilterSelect.vue'
import DateFilter from './DateFilter.vue'

// shadcn-vue components
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Map, Table2, Image, Download, RotateCcw, Share2, ChevronRight, Info } from 'lucide-vue-next'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'set-view'])

const store = useDataStore()

// Local state for CAMID search with autocomplete (multi-value textarea)
const camidInput = ref('')
const camidTextarea = ref(null)
const showCamidDropdown = ref(false)
const selectedSuggestionIndex = ref(-1)
const currentWordInfo = ref({ word: '', start: 0, end: 0 })
let debounceTimer = null

// Get the current word at cursor position for autocomplete
const getCurrentWord = (text, cursorPos) => {
  // Find word boundaries (split by comma, space, newline)
  const beforeCursor = text.slice(0, cursorPos)
  const afterCursor = text.slice(cursorPos)

  // Find start of current word (last separator before cursor)
  const startMatch = beforeCursor.match(/[\s,\n]*([^\s,\n]*)$/)
  const wordStart = startMatch ? cursorPos - startMatch[1].length : cursorPos

  // Find end of current word (first separator after cursor)
  const endMatch = afterCursor.match(/^([^\s,\n]*)/)
  const wordEnd = cursorPos + (endMatch ? endMatch[1].length : 0)

  const word = text.slice(wordStart, wordEnd)
  return { word, start: wordStart, end: wordEnd }
}

// Filtered CAMID suggestions based on current word
const camidSuggestions = computed(() => {
  const query = currentWordInfo.value.word.trim().toUpperCase()
  if (!query || query.length < 2) return []

  // Filter and limit to 15 suggestions for performance
  const matches = []
  for (const id of store.uniqueCamids) {
    if (id.toUpperCase().includes(query)) {
      matches.push(id)
      if (matches.length >= 15) break
    }
  }
  return matches
})

const handleCamidInput = (e) => {
  const textarea = e.target
  const value = textarea.value
  const cursorPos = textarea.selectionStart

  camidInput.value = value
  currentWordInfo.value = getCurrentWord(value, cursorPos)
  showCamidDropdown.value = currentWordInfo.value.word.length >= 2
  selectedSuggestionIndex.value = -1

  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    store.filters.camidSearch = value.trim().toUpperCase()
  }, 300)
}

const selectCamid = (camid) => {
  const { start, end } = currentWordInfo.value
  const before = camidInput.value.slice(0, start)
  const after = camidInput.value.slice(end)

  // Insert selected CAMID, add separator if there's more text after
  const separator = after.trim() ? '' : ' '
  camidInput.value = before + camid + separator + after

  // Update the store filter
  store.filters.camidSearch = camidInput.value.trim().toUpperCase()

  showCamidDropdown.value = false
  selectedSuggestionIndex.value = -1

  // Focus back and position cursor after inserted CAMID
  if (camidTextarea.value) {
    const newCursorPos = start + camid.length + separator.length
    camidTextarea.value.focus()
    camidTextarea.value.setSelectionRange(newCursorPos, newCursorPos)
  }
}

const handleCamidKeydown = (e) => {
  // Update current word on cursor movement
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    setTimeout(() => {
      const textarea = e.target
      currentWordInfo.value = getCurrentWord(textarea.value, textarea.selectionStart)
      showCamidDropdown.value = currentWordInfo.value.word.length >= 2
    }, 0)
    return
  }

  if (!showCamidDropdown.value || camidSuggestions.value.length === 0) return

  if (e.key === 'ArrowDown' && !e.altKey) {
    e.preventDefault()
    selectedSuggestionIndex.value = Math.min(
      selectedSuggestionIndex.value + 1,
      camidSuggestions.value.length - 1
    )
  } else if (e.key === 'ArrowUp' && !e.altKey) {
    e.preventDefault()
    selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1)
  } else if (e.key === 'Enter' && selectedSuggestionIndex.value >= 0) {
    e.preventDefault()
    selectCamid(camidSuggestions.value[selectedSuggestionIndex.value])
  } else if (e.key === 'Tab' && camidSuggestions.value.length > 0) {
    e.preventDefault()
    const idx = selectedSuggestionIndex.value >= 0 ? selectedSuggestionIndex.value : 0
    selectCamid(camidSuggestions.value[idx])
  } else if (e.key === 'Escape') {
    showCamidDropdown.value = false
  }
}

const handleCamidBlur = () => {
  // Delay to allow click on suggestion
  setTimeout(() => {
    showCamidDropdown.value = false
  }, 150)
}

const handleCamidClick = (e) => {
  const textarea = e.target
  currentWordInfo.value = getCurrentWord(textarea.value, textarea.selectionStart)
  showCamidDropdown.value = currentWordInfo.value.word.length >= 2
}

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

// Status filter helpers
const isStatusSelected = (status) => store.filters.status.includes(status)

const toggleStatus = (status) => {
  const idx = store.filters.status.indexOf(status)
  if (idx > -1) {
    store.filters.status.splice(idx, 1)
  } else {
    store.filters.status.push(status)
  }
}

// Status color mapping
const statusColors = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Record': '#6b7280',
  'Observation': '#22c55e',        // Research Grade equivalent
  'Museum Specimen': '#8b5cf6',
  'Living Specimen': '#14b8a6',
}

// Share URL functionality
const copyShareUrl = () => {
  navigator.clipboard.writeText(window.location.href)
  showCopiedToast.value = true
  setTimeout(() => { showCopiedToast.value = false }, 2000)
}

const showCopiedToast = ref(false)

// Show date filter section
const showDateFilter = ref(false)

// Show cluster settings section
const showClusterSettings = ref(false)

// Show advanced taxonomy (Family/Tribe/Genus) within Taxonomy section
const showAdvancedTaxonomy = ref(false)

// Show additional legend settings (Position/Text Size/Max Items)
const showAdvancedLegend = ref(false)

// Show point style settings section
const showPointStyle = ref(false)

// Show URL share settings section
const showUrlSettings = ref(false)

// Show citation section
const showCitation = ref(false)

// Aspect ratio options
const aspectRatioOptions = [
  { value: '16:9', label: '16:9 (Widescreen)', width: 1920, height: 1080 },
  { value: '4:3', label: '4:3 (Standard)', width: 1600, height: 1200 },
  { value: '1:1', label: '1:1 (Square)', width: 1200, height: 1200 },
  { value: '3:2', label: '3:2 (Photo)', width: 1800, height: 1200 },
  { value: 'A4', label: 'A4 Portrait', width: 2480, height: 3508 },
  { value: 'A4L', label: 'A4 Landscape', width: 3508, height: 2480 },
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
      <Tabs :model-value="currentView" @update:model-value="emit('set-view', $event)" class="view-toggle-tabs">
        <TabsList class="view-toggle-list">
          <TabsTrigger value="map" class="view-toggle-trigger">
            <Map class="h-4 w-4" />
            Map
          </TabsTrigger>
          <TabsTrigger value="table" class="view-toggle-trigger">
            <Table2 class="h-4 w-4" />
            Table
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
          <Label class="setting-label">Aspect Ratio</Label>
          <Select
            :model-value="store.exportSettings.aspectRatio"
            @update:model-value="store.exportSettings.aspectRatio = $event"
          >
            <SelectTrigger class="select-trigger">
              <SelectValue placeholder="Select ratio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in aspectRatioOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
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
          <div class="flex items-center gap-2">
            <Checkbox
              id="includeLegend"
              :checked="store.exportSettings.includeLegend"
              @update:checked="store.exportSettings.includeLegend = $event"
            />
            <Label for="includeLegend" class="checkbox-text">Include Legend</Label>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox
              id="includeScaleBar"
              :checked="store.exportSettings.includeScaleBar"
              @update:checked="store.exportSettings.includeScaleBar = $event"
            />
            <Label for="includeScaleBar" class="checkbox-text">Include Scale Bar</Label>
          </div>
        </div>

        <!-- UI Scale -->
        <div class="setting-row" style="margin-top: 12px;">
          <Label class="setting-label">UI Scale <span class="setting-hint">(legend, scale bar size)</span></Label>
          <div class="slider-group">
            <Slider
              :model-value="[store.exportSettings.uiScale]"
              @update:model-value="store.exportSettings.uiScale = $event[0]"
              :min="0.5"
              :max="2"
              :step="0.1"
              class="slider-control"
            />
            <span class="slider-value">{{ Math.round(store.exportSettings.uiScale * 100) }}%</span>
          </div>
        </div>

        <!-- Export Button -->
        <Button variant="default" class="btn-export-now" @click="emit('open-map-export')">
          <Download class="h-4 w-4" />
          Export Image
        </Button>
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

      <!-- UI Preferences -->
      <div class="filter-section">
        <div class="toggle-row">
          <Checkbox
            id="showThumbnail"
            :checked="store.showThumbnail"
            @update:checked="store.showThumbnail = $event"
          />
          <Label for="showThumbnail" class="toggle-label">Show thumbnails</Label>
        </div>
      </div>

      <!-- Scatter Overlapping Points (Map View Only) -->
      <div class="filter-section" v-if="currentView === 'map'">
        <div class="toggle-row scatter-toggle">
          <Checkbox
            id="scatterPoints"
            :checked="store.scatterOverlappingPoints"
            @update:checked="store.scatterOverlappingPoints = $event"
          />
          <Label for="scatterPoints" class="toggle-label">Scatter overlapping points</Label>
        </div>
        <p class="filter-hint" style="margin-top: 6px;">
          Evenly distribute overlapping points within 2.5km radius with connecting lines
        </p>
      </div>

      <!-- Clustering Settings (Map View Only) -->
      <div class="filter-section collapsible" v-if="currentView === 'map'">
        <button
          class="collapse-toggle"
          @click="showClusterSettings = !showClusterSettings"
          :class="{ expanded: showClusterSettings }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Point Clustering
          <span
            class="clustering-toggle-badge"
            :class="{ active: store.clusteringEnabled }"
            @click.stop="store.clusteringEnabled = !store.clusteringEnabled"
            title="Click to toggle clustering"
          >
            {{ store.clusteringEnabled ? 'ON' : 'OFF' }}
          </span>
        </button>

        <div v-show="showClusterSettings" class="collapse-content">
          <p class="filter-hint" style="margin-top: 0; margin-bottom: 12px;">
            Groups nearby points into clusters. Click a cluster to view all points.
          </p>

          <!-- Cluster Settings (only visible when clustering is enabled) -->
          <div v-if="store.clusteringEnabled" class="cluster-settings">
            <!-- Cluster Radius in pixels -->
            <div class="setting-row">
              <Label class="setting-label">Cluster Radius <span class="setting-hint">(px)</span></Label>
              <div class="slider-group">
                <Slider
                  :model-value="[store.clusterSettings.radiusPixels]"
                  @update:model-value="store.clusterSettings.radiusPixels = $event[0]"
                  :min="20"
                  :max="200"
                  :step="10"
                  class="slider-control"
                />
                <input
                  type="number"
                  class="setting-input"
                  min="10"
                  max="500"
                  v-model.number.lazy="store.clusterSettings.radiusPixels"
                  @keydown.enter="$event.target.blur()"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend Settings (Map View Only) - Color by visible, Position/Text/Max expandable -->
      <div class="filter-section" v-if="currentView === 'map'">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="8" y1="9" x2="8" y2="9.01"/>
            <line x1="8" y1="13" x2="8" y2="13.01"/>
            <line x1="8" y1="17" x2="8" y2="17.01"/>
            <line x1="12" y1="9" x2="18" y2="9"/>
            <line x1="12" y1="13" x2="18" y2="13"/>
            <line x1="12" y1="17" x2="18" y2="17"/>
          </svg>
          Legend Settings
          <span
            class="toggle-badge-inline"
            :class="{ active: store.legendSettings.showLegend }"
            @click.stop="store.legendSettings.showLegend = !store.legendSettings.showLegend"
            title="Click to toggle legend"
          >
            {{ store.legendSettings.showLegend ? 'ON' : 'OFF' }}
          </span>
        </label>

        <!-- Color By (always visible) -->
        <div class="setting-row">
          <Label class="setting-label">Color by</Label>
          <Select
            :model-value="store.colorBy"
            @update:model-value="store.colorBy = $event"
          >
            <SelectTrigger class="select-trigger">
              <SelectValue placeholder="Select color by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subspecies">Subspecies</SelectItem>
              <SelectItem value="species">Species</SelectItem>
              <SelectItem value="genus">Genus</SelectItem>
              <SelectItem value="status">Sequencing Status</SelectItem>
              <SelectItem value="mimicry">Mimicry Ring</SelectItem>
              <SelectItem value="source">Data Source</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Advanced Legend Settings Toggle -->
        <button
          class="subsection-toggle"
          @click="showAdvancedLegend = !showAdvancedLegend"
          :class="{ expanded: showAdvancedLegend }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Position / Text Size / Max Items
        </button>

        <div v-show="showAdvancedLegend" class="subsection-content">
          <!-- Legend Position -->
          <div class="setting-row">
            <Label class="setting-label">Position</Label>
            <Select
              :model-value="store.legendSettings.position"
              @update:model-value="store.legendSettings.position = $event"
            >
              <SelectTrigger class="select-trigger">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Text Size -->
          <div class="setting-row">
            <Label class="setting-label">Text Size</Label>
            <div class="slider-group">
              <Slider
                :model-value="[store.legendSettings.textSize]"
                @update:model-value="store.legendSettings.textSize = $event[0]"
                :min="0.6"
                :max="1.2"
                :step="0.05"
                class="slider-control"
              />
              <span class="slider-value">{{ Math.round(store.legendSettings.textSize * 100) }}%</span>
            </div>
          </div>

          <!-- Max Items -->
          <div class="setting-row">
            <Label class="setting-label">Max Items Shown</Label>
            <div class="slider-group">
              <Slider
                :model-value="[store.legendSettings.maxItems]"
                @update:model-value="store.legendSettings.maxItems = $event[0]"
                :min="5"
                :max="30"
                :step="1"
                class="slider-control"
              />
              <input
                type="number"
                class="setting-input"
                min="3"
                max="50"
                v-model.number.lazy="store.legendSettings.maxItems"
                @keydown.enter="$event.target.blur()"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Point Style (Map View Only) - Separate section for point appearance -->
      <div class="filter-section collapsible" v-if="currentView === 'map'">
        <button
          class="collapse-toggle"
          @click="showPointStyle = !showPointStyle"
          :class="{ expanded: showPointStyle }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Point Style
        </button>

        <div v-show="showPointStyle" class="collapse-content">
          <!-- Point Size -->
          <div class="setting-row">
            <Label class="setting-label">Point Size</Label>
            <div class="slider-group">
              <Slider
                :model-value="[store.mapStyle.pointSize]"
                @update:model-value="store.mapStyle.pointSize = $event[0]"
                :min="4"
                :max="20"
                :step="1"
                class="slider-control"
              />
              <input
                type="number"
                class="setting-input"
                min="2"
                max="30"
                v-model.number.lazy="store.mapStyle.pointSize"
                @keydown.enter="$event.target.blur()"
              />
            </div>
          </div>

          <!-- Border Width -->
          <div class="setting-row">
            <Label class="setting-label">Border Width</Label>
            <div class="slider-group">
              <Slider
                :model-value="[store.mapStyle.borderWidth]"
                @update:model-value="store.mapStyle.borderWidth = $event[0]"
                :min="0"
                :max="5"
                :step="0.5"
                class="slider-control"
              />
              <input
                type="number"
                class="setting-input"
                min="0"
                max="10"
                step="0.5"
                v-model.number.lazy="store.mapStyle.borderWidth"
                @keydown.enter="$event.target.blur()"
              />
            </div>
          </div>

          <!-- Fill Opacity -->
          <div class="setting-row">
            <Label class="setting-label">Fill Opacity</Label>
            <div class="slider-group">
              <Slider
                :model-value="[store.mapStyle.fillOpacity]"
                @update:model-value="store.mapStyle.fillOpacity = $event[0]"
                :min="0.1"
                :max="1"
                :step="0.05"
                class="slider-control"
              />
              <span class="slider-value">{{ Math.round(store.mapStyle.fillOpacity * 100) }}%</span>
            </div>
          </div>

          <!-- Border Color -->
          <div class="setting-row">
            <Label class="setting-label">Border Color</Label>
            <div class="color-picker-row">
              <input
                type="color"
                v-model="store.mapStyle.borderColor"
                class="color-picker"
              />
              <input
                type="text"
                class="setting-input color-input"
                v-model="store.mapStyle.borderColor"
                @keydown.enter="$event.target.blur()"
              />
            </div>
          </div>
        </div>
      </div>

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
            <div class="flex items-center gap-2">
              <Checkbox
                id="includeFilters"
                :checked="store.urlSettings.includeFilters"
                @update:checked="store.urlSettings.includeFilters = $event"
              />
              <Label for="includeFilters" class="checkbox-text">Include Filters</Label>
            </div>
            <p class="checkbox-hint">Taxonomy, mimicry, status, source filters</p>

            <div class="flex items-center gap-2">
              <Checkbox
                id="includeMapView"
                :checked="store.urlSettings.includeMapView"
                @update:checked="store.urlSettings.includeMapView = $event"
              />
              <Label for="includeMapView" class="checkbox-text">Include Map View</Label>
            </div>
            <p class="checkbox-hint">Map center, zoom, rotation</p>

            <div class="flex items-center gap-2">
              <Checkbox
                id="includeStyleSettings"
                :checked="store.urlSettings.includeStyleSettings"
                @update:checked="store.urlSettings.includeStyleSettings = $event"
              />
              <Label for="includeStyleSettings" class="checkbox-text">Include Style Settings</Label>
            </div>
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

    <!-- Footer Actions -->
    <footer class="sidebar-footer">
      <div class="footer-row">
        <Button variant="outline" size="sm" class="footer-btn" @click="store.resetAllFilters">
          <RotateCcw class="h-3.5 w-3.5" />
          Reset
        </Button>

        <Button variant="outline" size="sm" class="footer-btn" @click="copyShareUrl">
          <Share2 class="h-3.5 w-3.5" />
          Share
        </Button>

        <Button variant="default" size="sm" class="footer-btn footer-btn-export" @click="emit('open-export')">
          <Download class="h-3.5 w-3.5" />
          Export
        </Button>
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

/* Scatter toggle specific styles */
.scatter-toggle {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.scatter-toggle:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%);
  border-color: rgba(59, 130, 246, 0.3);
}

/* Search Input */
.search-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.9rem;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
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

.search-input::placeholder {
  color: var(--color-text-muted, #666);
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

/* Toggle Badge Inline (used in section headers) */
.toggle-badge-inline {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(107, 114, 128, 0.2);
  color: #888;
  border: 1px solid transparent;
}

.toggle-badge-inline:hover {
  background: rgba(107, 114, 128, 0.3);
  border-color: rgba(107, 114, 128, 0.4);
}

.toggle-badge-inline.active {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
  border-color: rgba(74, 222, 128, 0.3);
}

.toggle-badge-inline.active:hover {
  background: rgba(74, 222, 128, 0.25);
  border-color: rgba(74, 222, 128, 0.5);
}

.filter-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
  margin-top: 8px;
}

/* Visual Selector Button */
.btn-visual-selector {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  margin-top: 10px;
  background: rgba(74, 222, 128, 0.1);
  border: 1px dashed rgba(74, 222, 128, 0.3);
  border-radius: 6px;
  color: var(--color-accent, #4ade80);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-visual-selector:hover {
  background: rgba(74, 222, 128, 0.15);
  border-style: solid;
}

.btn-visual-selector svg {
  width: 16px;
  height: 16px;
}

/* Clear Selection Button */
.btn-clear-selection {
  width: 100%;
  padding: 6px 12px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-selection:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* Selected Tags (for multi-select filters) */
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.selected-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 4px;
  color: var(--color-accent, #4ade80);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}

.selected-tag:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.selected-tag svg {
  width: 12px;
  height: 12px;
}

/* Status Grid */
.status-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.status-btn:hover {
  background: #353558;
}

.status-btn.active {
  background: rgba(255, 255, 255, 0.05);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-label {
  font-size: 0.8rem;
  color: var(--color-text-primary, #e0e0e0);
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

/* Clustering Toggle Badge */
.clustering-toggle-badge {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(107, 114, 128, 0.2);
  color: #888;
  border: 1px solid transparent;
}

.clustering-toggle-badge:hover {
  background: rgba(107, 114, 128, 0.3);
  border-color: rgba(107, 114, 128, 0.4);
}

.clustering-toggle-badge.active {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
  border-color: rgba(74, 222, 128, 0.3);
}

.clustering-toggle-badge.active:hover {
  background: rgba(74, 222, 128, 0.25);
  border-color: rgba(74, 222, 128, 0.5);
}

/* Cluster Settings */
.cluster-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 6px;
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

/* Color Picker */
.color-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 2px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  cursor: pointer;
  background: none;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker::-webkit-color-swatch {
  border-radius: 4px;
  border: none;
}

.color-input {
  flex: 1;
  width: auto;
  font-family: monospace;
  text-transform: uppercase;
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

.export-dimensions-preview {
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 4px;
  text-align: center;
}

.dimension-text {
  font-size: 0.8rem;
  color: var(--color-accent, #4ade80);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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

/* shadcn-vue Tabs Styles */
.view-toggle-tabs {
  margin-bottom: 16px;
}

.view-toggle-list {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 8px;
}

.view-toggle-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px !important;
  font-size: 0.8rem !important;
  font-weight: 500;
}

.view-toggle-trigger[data-state="active"] {
  background: var(--color-accent, #4ade80) !important;
  color: var(--color-bg-primary, #1a1a2e) !important;
}

/* shadcn-vue Checkbox Styles */
.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-row:hover {
  background: var(--color-bg-hover, #363653);
}

.toggle-row.scatter-toggle {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.toggle-row.scatter-toggle:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%);
  border-color: rgba(59, 130, 246, 0.3);
}

.toggle-label {
  font-size: 0.9rem !important;
  color: var(--color-text-primary, #e0e0e0);
  font-weight: 500;
  cursor: pointer;
}

.checkbox-text {
  font-size: 0.85rem !important;
  color: var(--color-text-primary, #e0e0e0);
  cursor: pointer;
}

/* shadcn-vue Slider Styles */
.slider-control {
  flex: 1;
}

/* shadcn-vue Select Styles */
.select-trigger {
  background: var(--color-bg-primary, #1a1a2e);
  border-color: var(--color-border, #3d3d5c);
  color: var(--color-text-primary, #e0e0e0);
}

.select-trigger:hover {
  border-color: var(--color-text-muted, #666);
}

.select-trigger:focus {
  border-color: var(--color-accent, #4ade80);
}

/* shadcn-vue Label Styles */
.setting-label {
  font-size: 0.75rem !important;
  color: var(--color-text-secondary, #aaa);
  font-weight: 500;
}

/* Footer Button Styles */
.footer-row {
  display: flex;
  gap: 8px;
}

.footer-btn {
  flex: 1;
}

.footer-btn-export {
  background: var(--color-accent, #4ade80) !important;
  color: var(--color-bg-primary, #1a1a2e) !important;
  border: none !important;
}

.footer-btn-export:hover {
  background: #5eeb94 !important;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    min-width: 100%;
    height: auto;
    max-height: 50vh;
  }

  .view-toggle-tabs {
    display: none;
  }
}
</style>
