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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Map, Table2, Download, RotateCcw, Share2, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  currentView: { type: String, default: 'map' }
})

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'set-view'])
const store = useDataStore()

// CAMID search state
const camidInput = ref('')
const camidTextarea = ref(null)
const showCamidDropdown = ref(false)
const selectedSuggestionIndex = ref(-1)
const currentWordInfo = ref({ word: '', start: 0, end: 0 })
let debounceTimer = null

const getCurrentWord = (text, cursorPos) => {
  const beforeCursor = text.slice(0, cursorPos)
  const afterCursor = text.slice(cursorPos)
  const startMatch = beforeCursor.match(/[\s,\n]*([^\s,\n]*)$/)
  const wordStart = startMatch ? cursorPos - startMatch[1].length : cursorPos
  const endMatch = afterCursor.match(/^([^\s,\n]*)/)
  const wordEnd = cursorPos + (endMatch ? endMatch[1].length : 0)
  return { word: text.slice(wordStart, wordEnd), start: wordStart, end: wordEnd }
}

const camidSuggestions = computed(() => {
  const query = currentWordInfo.value.word.trim().toUpperCase()
  if (!query || query.length < 2) return []
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
  const { value, selectionStart } = e.target
  camidInput.value = value
  currentWordInfo.value = getCurrentWord(value, selectionStart)
  showCamidDropdown.value = currentWordInfo.value.word.length >= 2
  selectedSuggestionIndex.value = -1
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { store.filters.camidSearch = value.trim().toUpperCase() }, 300)
}

const selectCamid = (camid) => {
  const { start, end } = currentWordInfo.value
  const before = camidInput.value.slice(0, start)
  const after = camidInput.value.slice(end)
  const separator = after.trim() ? '' : ' '
  camidInput.value = before + camid + separator + after
  store.filters.camidSearch = camidInput.value.trim().toUpperCase()
  showCamidDropdown.value = false
  selectedSuggestionIndex.value = -1
  if (camidTextarea.value) {
    const newCursorPos = start + camid.length + separator.length
    camidTextarea.value.focus()
    camidTextarea.value.setSelectionRange(newCursorPos, newCursorPos)
  }
}

const handleCamidKeydown = (e) => {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    setTimeout(() => {
      currentWordInfo.value = getCurrentWord(e.target.value, e.target.selectionStart)
      showCamidDropdown.value = currentWordInfo.value.word.length >= 2
    }, 0)
    return
  }
  if (!showCamidDropdown.value || camidSuggestions.value.length === 0) return
  if (e.key === 'ArrowDown' && !e.altKey) {
    e.preventDefault()
    selectedSuggestionIndex.value = Math.min(selectedSuggestionIndex.value + 1, camidSuggestions.value.length - 1)
  } else if (e.key === 'ArrowUp' && !e.altKey) {
    e.preventDefault()
    selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1)
  } else if (e.key === 'Enter' && selectedSuggestionIndex.value >= 0) {
    e.preventDefault()
    selectCamid(camidSuggestions.value[selectedSuggestionIndex.value])
  } else if (e.key === 'Tab' && camidSuggestions.value.length > 0) {
    e.preventDefault()
    selectCamid(camidSuggestions.value[selectedSuggestionIndex.value >= 0 ? selectedSuggestionIndex.value : 0])
  } else if (e.key === 'Escape') {
    showCamidDropdown.value = false
  }
}

const handleCamidBlur = () => setTimeout(() => { showCamidDropdown.value = false }, 150)
const handleCamidClick = (e) => {
  currentWordInfo.value = getCurrentWord(e.target.value, e.target.selectionStart)
  showCamidDropdown.value = currentWordInfo.value.word.length >= 2
}

// Computed values
const totalRecords = computed(() => store.allFeatures.length)
const filteredRecords = computed(() => store.filteredGeoJSON?.features.length ?? 0)
const imageCount = computed(() => store.filteredGeoJSON?.features.filter(f => f.properties?.image_url).length ?? 0)

// UI state
const showCopiedToast = ref(false)
const showDateFilter = ref(false)
const showClusterSettings = ref(false)
const showAdvancedTaxonomy = ref(false)
const showAdvancedLegend = ref(false)
const showPointStyle = ref(false)
const showUrlSettings = ref(false)
const showCitation = ref(false)

const copyShareUrl = () => {
  navigator.clipboard.writeText(window.location.href)
  showCopiedToast.value = true
  setTimeout(() => { showCopiedToast.value = false }, 2000)
}

const aspectRatioOptions = [
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '3:2', label: '3:2 (Photo)' },
  { value: 'A4', label: 'A4 Portrait' },
  { value: 'A4L', label: 'A4 Landscape' },
  { value: 'custom', label: 'Custom' },
]

const ASPECT_DIMS = { '16:9': [1920, 1080], '4:3': [1600, 1200], '1:1': [1200, 1200], '3:2': [1800, 1200], 'A4': [2480, 3508], 'A4L': [3508, 2480] }

const currentExportDimensions = computed(() => {
  const dims = ASPECT_DIMS[store.exportSettings.aspectRatio]
  return dims ? { width: dims[0], height: dims[1] } : { width: store.exportSettings.customWidth, height: store.exportSettings.customHeight }
})

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
  <aside class="sidebar-aside w-[340px] min-w-[340px] h-screen bg-secondary border-r border-border flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="p-5 border-b border-border bg-background">
      <div class="flex items-center justify-between">
        <a href="https://github.com/Fr4nzz/ithomiini_maps/" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 no-underline hover:opacity-85 transition-opacity">
          <img src="../assets/Map_icon.svg" alt="Ithomiini Maps" class="w-10 h-10" />
          <div class="flex flex-col">
            <span class="text-xl font-semibold text-foreground tracking-tight">Ithomiini</span>
            <span class="text-xs text-muted-foreground uppercase tracking-wider">Distribution Maps</span>
          </div>
        </a>
        <ThemeToggle />
      </div>
    </header>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-5">
      <!-- View Toggle -->
      <Tabs :model-value="currentView" @update:model-value="emit('set-view', $event)" class="mb-4">
        <TabsList class="w-full grid grid-cols-2 gap-1 p-1 bg-background rounded-lg">
          <TabsTrigger value="map" class="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Map class="h-4 w-4" /> Map
          </TabsTrigger>
          <TabsTrigger value="table" class="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Table2 class="h-4 w-4" /> Table
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <!-- Record Count -->
      <div class="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 text-center">
        <span class="text-2xl font-bold text-primary tabular-nums">{{ filteredRecords.toLocaleString() }}</span>
        <span class="text-sm text-muted-foreground ml-1.5">of {{ totalRecords.toLocaleString() }} records</span>
      </div>

      <!-- Quick Actions -->
      <div class="flex gap-2.5 mb-6">
        <button class="action-btn" @click="emit('open-gallery')" :disabled="imageCount === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Gallery</span>
          <span v-if="imageCount > 0" class="badge">{{ imageCount }}</span>
        </button>
        <button class="action-btn" @click="emit('open-mimicry')">
          <img src="../assets/Mimicry_bttn.svg" alt="Mimicry" class="w-5 h-5" />
          <span>Mimicry</span>
          <span v-if="store.filters.mimicry.length > 0" class="badge">{{ store.filters.mimicry.length }}</span>
        </button>
        <button v-if="currentView === 'map'" class="action-btn" :class="{ active: store.exportSettings.enabled }" @click="store.exportSettings.enabled = !store.exportSettings.enabled">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Export</span>
        </button>
      </div>

      <!-- Export Settings Panel -->
      <div v-if="store.exportSettings.enabled && currentView === 'map'" class="filter-section bg-primary/5 border border-primary/20 rounded-lg p-3.5">
        <label class="section-label text-primary">Export Settings</label>

        <div class="space-y-3">
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Aspect Ratio</Label>
            <Select :model-value="store.exportSettings.aspectRatio" @update:model-value="store.exportSettings.aspectRatio = $event">
              <SelectTrigger class="h-9"><SelectValue placeholder="Select ratio" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in aspectRatioOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Resolution</Label>
            <div class="flex items-center gap-2">
              <input type="number" class="input-sm w-16" :value="currentExportDimensions.width" @input="updateExportWidth($event.target.value)" min="100" max="8000" />
              <span class="text-muted-foreground">×</span>
              <input type="number" class="input-sm w-16" :value="currentExportDimensions.height" @input="updateExportHeight($event.target.value)" min="100" max="8000" />
            </div>
          </div>

          <div class="flex flex-col gap-2 pt-2">
            <div class="flex items-center gap-2">
              <Checkbox id="includeLegend" :checked="store.exportSettings.includeLegend" @update:checked="store.exportSettings.includeLegend = $event" />
              <Label for="includeLegend" class="text-sm cursor-pointer">Include Legend</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="includeScaleBar" :checked="store.exportSettings.includeScaleBar" @update:checked="store.exportSettings.includeScaleBar = $event" />
              <Label for="includeScaleBar" class="text-sm cursor-pointer">Include Scale Bar</Label>
            </div>
          </div>

          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">UI Scale</Label>
            <div class="flex items-center gap-3">
              <Slider :model-value="[store.exportSettings.uiScale]" @update:model-value="store.exportSettings.uiScale = $event[0]" :min="0.5" :max="2" :step="0.1" class="flex-1" />
              <span class="text-sm font-semibold text-primary w-12 text-right">{{ Math.round(store.exportSettings.uiScale * 100) }}%</span>
            </div>
          </div>

          <Button class="w-full mt-2" @click="emit('open-map-export')">
            <Download class="h-4 w-4 mr-2" /> Export Image
          </Button>
        </div>
      </div>

      <!-- CAMID Search -->
      <div class="filter-section">
        <label class="section-label">Search CAMIDs</label>
        <p class="text-xs text-muted-foreground italic mb-1.5">Enter or paste multiple IDs (comma/space/newline separated)</p>
        <div class="relative">
          <textarea ref="camidTextarea" class="camid-textarea" placeholder="e.g. CAM012345, CAM012346..." :value="camidInput" @input="handleCamidInput" @keydown="handleCamidKeydown" @click="handleCamidClick" @focus="handleCamidClick" @blur="handleCamidBlur" autocomplete="off" spellcheck="false" rows="1" />
          <div v-if="showCamidDropdown && camidSuggestions.length > 0" class="camid-dropdown">
            <button v-for="(s, i) in camidSuggestions" :key="s" class="camid-suggestion" :class="{ selected: i === selectedSuggestionIndex }" @mousedown.prevent="selectCamid(s)">{{ s }}</button>
          </div>
        </div>
      </div>

      <!-- Taxonomy -->
      <div class="filter-section">
        <label class="section-label">Taxonomy</label>
        <FilterSelect label="Species" v-model="store.filters.species" :options="store.uniqueSpecies" placeholder="Search species..." :multiple="true" />
        <FilterSelect label="Subspecies" v-model="store.filters.subspecies" :options="store.uniqueSubspecies" placeholder="Search subspecies..." :multiple="true" />
        <button class="subsection-toggle" :class="{ expanded: showAdvancedTaxonomy }" @click="showAdvancedTaxonomy = !showAdvancedTaxonomy">
          <ChevronRight class="h-3.5 w-3.5 transition-transform" :class="{ 'rotate-90': showAdvancedTaxonomy }" />
          Family / Tribe / Genus
          <span v-if="store.filters.family !== 'All' || store.filters.tribe !== 'All' || store.filters.genus !== 'All'" class="w-1.5 h-1.5 rounded-full bg-primary ml-auto" />
        </button>
        <div v-show="showAdvancedTaxonomy" class="subsection-content">
          <FilterSelect label="Family" v-model="store.filters.family" :options="['All', ...store.uniqueFamilies]" placeholder="All Families" :multiple="false" :show-count="false" />
          <FilterSelect label="Tribe" v-model="store.filters.tribe" :options="['All', ...store.uniqueTribes]" placeholder="All Tribes" :multiple="false" :show-count="false" />
          <FilterSelect label="Genus" v-model="store.filters.genus" :options="['All', ...store.uniqueGenera]" placeholder="All Genera" :multiple="false" />
        </div>
      </div>

      <!-- Date Filter -->
      <div class="filter-section collapsible">
        <button class="collapse-toggle" :class="{ expanded: showDateFilter }" @click="showDateFilter = !showDateFilter">
          <ChevronRight class="h-4 w-4 transition-transform" :class="{ 'rotate-90': showDateFilter }" />
          Date Range
          <span v-if="store.filters.dateStart || store.filters.dateEnd" class="active-badge">Active</span>
        </button>
        <div v-show="showDateFilter" class="p-0"><DateFilter /></div>
      </div>

      <!-- Sequencing Status -->
      <div class="filter-section">
        <label class="section-label">Sequencing Status</label>
        <FilterSelect v-model="store.filters.status" :options="store.uniqueStatuses" placeholder="All Statuses" :multiple="true" />
        <p v-if="store.filters.status.length > 0" class="text-xs text-muted-foreground italic mt-2">{{ store.filters.status.length }} status{{ store.filters.status.length > 1 ? 'es' : '' }} selected</p>
      </div>

      <!-- Data Source -->
      <div class="filter-section">
        <label class="section-label">Data Source</label>
        <FilterSelect v-model="store.filters.source" :options="store.uniqueSources" placeholder="Select sources..." :multiple="true" />
        <p v-if="store.filters.source.length === 0" class="text-xs text-muted-foreground italic mt-2">No sources selected - showing all data</p>
      </div>

      <!-- Country -->
      <div class="filter-section">
        <label class="section-label">Country</label>
        <FilterSelect v-model="store.filters.country" :options="['All', ...store.uniqueCountries]" placeholder="All Countries" :multiple="false" :show-count="false" />
      </div>

      <!-- UI Toggles -->
      <div class="filter-section">
        <div class="toggle-row">
          <Checkbox id="showThumbnail" :checked="store.showThumbnail" @update:checked="store.showThumbnail = $event" />
          <Label for="showThumbnail" class="text-sm font-medium cursor-pointer">Show thumbnails</Label>
        </div>
      </div>

      <div v-if="currentView === 'map'" class="filter-section">
        <div class="toggle-row scatter">
          <Checkbox id="scatterPoints" :checked="store.scatterOverlappingPoints" @update:checked="store.scatterOverlappingPoints = $event" />
          <Label for="scatterPoints" class="text-sm font-medium cursor-pointer">Scatter overlapping points</Label>
        </div>
        <p class="text-xs text-muted-foreground italic mt-1.5">Evenly distribute overlapping points within 2.5km radius</p>
      </div>

      <!-- Clustering (Map only) -->
      <div v-if="currentView === 'map'" class="filter-section collapsible">
        <button class="collapse-toggle" :class="{ expanded: showClusterSettings }" @click="showClusterSettings = !showClusterSettings">
          <ChevronRight class="h-4 w-4 transition-transform" :class="{ 'rotate-90': showClusterSettings }" />
          Point Clustering
          <span class="toggle-badge" :class="{ active: store.clusteringEnabled }" @click.stop="store.clusteringEnabled = !store.clusteringEnabled">{{ store.clusteringEnabled ? 'ON' : 'OFF' }}</span>
        </button>
        <div v-show="showClusterSettings" class="collapse-content">
          <p class="text-xs text-muted-foreground italic mb-3">Groups nearby points into clusters. Click a cluster to view all points.</p>
          <div v-if="store.clusteringEnabled">
            <Label class="text-xs text-muted-foreground mb-1.5 block">Cluster Radius (px)</Label>
            <div class="flex items-center gap-3">
              <Slider :model-value="[store.clusterSettings.radiusPixels]" @update:model-value="store.clusterSettings.radiusPixels = $event[0]" :min="20" :max="200" :step="10" class="flex-1" />
              <input type="number" class="input-sm w-14 text-center" min="10" max="500" v-model.number.lazy="store.clusterSettings.radiusPixels" />
            </div>
          </div>
        </div>
      </div>

      <!-- Legend Settings (Map only) -->
      <div v-if="currentView === 'map'" class="filter-section">
        <label class="section-label">
          Legend Settings
          <span class="toggle-badge ml-auto" :class="{ active: store.legendSettings.showLegend }" @click.stop="store.legendSettings.showLegend = !store.legendSettings.showLegend">{{ store.legendSettings.showLegend ? 'ON' : 'OFF' }}</span>
        </label>
        <div class="mb-3">
          <Label class="text-xs text-muted-foreground mb-1.5 block">Color by</Label>
          <Select :model-value="store.colorBy" @update:model-value="store.colorBy = $event">
            <SelectTrigger class="h-9"><SelectValue /></SelectTrigger>
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
        <button class="subsection-toggle" :class="{ expanded: showAdvancedLegend }" @click="showAdvancedLegend = !showAdvancedLegend">
          <ChevronRight class="h-3.5 w-3.5 transition-transform" :class="{ 'rotate-90': showAdvancedLegend }" />
          Position / Text Size / Max Items
        </button>
        <div v-show="showAdvancedLegend" class="subsection-content space-y-3">
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Position</Label>
            <Select :model-value="store.legendSettings.position" @update:model-value="store.legendSettings.position = $event">
              <SelectTrigger class="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Text Size</Label>
            <div class="flex items-center gap-3">
              <Slider :model-value="[store.legendSettings.textSize]" @update:model-value="store.legendSettings.textSize = $event[0]" :min="0.6" :max="1.2" :step="0.05" class="flex-1" />
              <span class="text-sm font-semibold text-primary w-12 text-right">{{ Math.round(store.legendSettings.textSize * 100) }}%</span>
            </div>
          </div>
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Max Items Shown</Label>
            <div class="flex items-center gap-3">
              <Slider :model-value="[store.legendSettings.maxItems]" @update:model-value="store.legendSettings.maxItems = $event[0]" :min="5" :max="30" :step="1" class="flex-1" />
              <input type="number" class="input-sm w-14 text-center" min="3" max="50" v-model.number.lazy="store.legendSettings.maxItems" />
            </div>
          </div>
        </div>
      </div>

      <!-- Point Style (Map only) -->
      <div v-if="currentView === 'map'" class="filter-section collapsible">
        <button class="collapse-toggle" :class="{ expanded: showPointStyle }" @click="showPointStyle = !showPointStyle">
          <ChevronRight class="h-4 w-4 transition-transform" :class="{ 'rotate-90': showPointStyle }" />
          Point Style
        </button>
        <div v-show="showPointStyle" class="collapse-content space-y-3">
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Point Size</Label>
            <div class="flex items-center gap-3">
              <Slider :model-value="[store.mapStyle.pointSize]" @update:model-value="store.mapStyle.pointSize = $event[0]" :min="4" :max="20" :step="1" class="flex-1" />
              <input type="number" class="input-sm w-14 text-center" min="2" max="30" v-model.number.lazy="store.mapStyle.pointSize" />
            </div>
          </div>
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Border Width</Label>
            <div class="flex items-center gap-3">
              <Slider :model-value="[store.mapStyle.borderWidth]" @update:model-value="store.mapStyle.borderWidth = $event[0]" :min="0" :max="5" :step="0.5" class="flex-1" />
              <input type="number" class="input-sm w-14 text-center" min="0" max="10" step="0.5" v-model.number.lazy="store.mapStyle.borderWidth" />
            </div>
          </div>
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Fill Opacity</Label>
            <div class="flex items-center gap-3">
              <Slider :model-value="[store.mapStyle.fillOpacity]" @update:model-value="store.mapStyle.fillOpacity = $event[0]" :min="0.1" :max="1" :step="0.05" class="flex-1" />
              <span class="text-sm font-semibold text-primary w-12 text-right">{{ Math.round(store.mapStyle.fillOpacity * 100) }}%</span>
            </div>
          </div>
          <div>
            <Label class="text-xs text-muted-foreground mb-1.5 block">Border Color</Label>
            <div class="flex items-center gap-2">
              <input type="color" v-model="store.mapStyle.borderColor" class="color-picker" />
              <input type="text" class="input-sm flex-1 font-mono uppercase" v-model="store.mapStyle.borderColor" />
            </div>
          </div>
        </div>
      </div>

      <!-- URL Share Settings -->
      <div class="filter-section collapsible">
        <button class="collapse-toggle" :class="{ expanded: showUrlSettings }" @click="showUrlSettings = !showUrlSettings">
          <ChevronRight class="h-4 w-4 transition-transform" :class="{ 'rotate-90': showUrlSettings }" />
          URL Share Settings
        </button>
        <div v-show="showUrlSettings" class="collapse-content">
          <p class="text-xs text-muted-foreground italic mb-3">Choose which settings to include when sharing URLs</p>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Checkbox id="includeFilters" :checked="store.urlSettings.includeFilters" @update:checked="store.urlSettings.includeFilters = $event" />
              <Label for="includeFilters" class="text-sm cursor-pointer">Include Filters</Label>
            </div>
            <p class="text-xs text-muted-foreground italic ml-6">Taxonomy, mimicry, status, source filters</p>
            <div class="flex items-center gap-2">
              <Checkbox id="includeMapView" :checked="store.urlSettings.includeMapView" @update:checked="store.urlSettings.includeMapView = $event" />
              <Label for="includeMapView" class="text-sm cursor-pointer">Include Map View</Label>
            </div>
            <p class="text-xs text-muted-foreground italic ml-6">Map center, zoom, rotation</p>
            <div class="flex items-center gap-2">
              <Checkbox id="includeStyleSettings" :checked="store.urlSettings.includeStyleSettings" @update:checked="store.urlSettings.includeStyleSettings = $event" />
              <Label for="includeStyleSettings" class="text-sm cursor-pointer">Include Style Settings</Label>
            </div>
            <p class="text-xs text-muted-foreground italic ml-6">Color by, legend, point style</p>
          </div>
        </div>
      </div>
    </div>

    <!-- GBIF Citation -->
    <div v-if="store.gbifCitation" class="border-t border-border p-3">
      <button class="w-full flex items-center gap-2 p-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors" @click="showCitation = !showCitation">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>Data Citation</span>
        <ChevronRight class="h-4 w-4 ml-auto transition-transform" :class="{ 'rotate-90': showCitation }" />
      </button>
      <Transition name="slide">
        <div v-if="showCitation" class="mt-3 p-3 bg-background rounded-md border border-border">
          <p class="text-xs text-muted-foreground leading-relaxed mb-3">{{ store.gbifCitation.citation_text }}</p>
          <a v-if="store.gbifCitation.doi_url" :href="store.gbifCitation.doi_url" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/30 rounded text-xs text-primary hover:bg-primary/20 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View on GBIF
          </a>
          <div class="flex gap-4 mt-3 pt-3 border-t border-border">
            <div><span class="block text-base font-semibold text-primary">{{ store.gbifCitation.dataset_breakdown?.iNaturalist?.toLocaleString() || 0 }}</span><span class="text-xs text-muted-foreground">iNaturalist</span></div>
            <div><span class="block text-base font-semibold text-primary">{{ store.gbifCitation.dataset_breakdown?.['Other GBIF']?.toLocaleString() || 0 }}</span><span class="text-xs text-muted-foreground">Other GBIF</span></div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Footer -->
    <footer class="p-4 border-t border-border bg-background relative">
      <div class="flex gap-2">
        <Button variant="outline" size="sm" class="flex-1" @click="store.resetAllFilters"><RotateCcw class="h-3.5 w-3.5 mr-1" />Reset</Button>
        <Button variant="outline" size="sm" class="flex-1" @click="copyShareUrl"><Share2 class="h-3.5 w-3.5 mr-1" />Share</Button>
        <Button size="sm" class="flex-1" @click="emit('open-export')"><Download class="h-3.5 w-3.5 mr-1" />Export</Button>
      </div>
      <Transition name="toast">
        <div v-if="showCopiedToast" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium shadow-lg whitespace-nowrap">URL copied to clipboard!</div>
      </Transition>
    </footer>
  </aside>
</template>

<!-- Styles moved to src/styles/components.css for reliable Tailwind v4 processing -->
