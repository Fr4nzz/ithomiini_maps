<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'
import FilterSelect from './FilterSelect.vue'
import DateFilter from './DateFilter.vue'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const emit = defineEmits(['open-export', 'open-mimicry', 'open-gallery', 'open-map-export', 'set-view'])

const store = useDataStore()

// Local state for CAMID search with debounce
const camidInput = ref('')
let debounceTimer = null

const handleCamidSearch = (e) => {
  const value = e.target.value
  camidInput.value = value
  
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    store.filters.camidSearch = value.trim().toUpperCase()
  }, 300)
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
  'Observation': '#6b7280',
  'Museum Specimen': '#8b5cf6'
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
</script>

<template>
  <aside class="sidebar">
    <!-- Header -->
    <header class="sidebar-header">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
          <path d="M12 6c-2 0-4 3-4 6s2 6 4 6 4-3 4-6-2-6-4-6z"/>
          <path d="M2 12h20"/>
        </svg>
        <div class="logo-text">
          <span class="title">Ithomiini</span>
          <span class="subtitle">Distribution Maps</span>
        </div>
      </div>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
            <path d="M12 2c-2.5 0-5 4-5 10s2.5 10 5 10"/>
            <path d="M12 2c2.5 0 5 4 5 10s-2.5 10-5 10"/>
          </svg>
          <span>Mimicry</span>
        </button>
        <button class="action-btn" @click="emit('open-map-export')" v-if="currentView === 'map'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Export Map</span>
        </button>
      </div>

      <!-- CAMID Search -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          Quick Search (CAMID)
        </label>
        <input 
          type="text" 
          class="search-input"
          placeholder="e.g. CAM012345"
          :value="camidInput"
          @input="handleCamidSearch"
        />
      </div>

      <!-- Primary Filters: Species & Subspecies with Multi-select -->
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
          :disabled="store.filters.species.length === 0"
        />
      </div>

      <!-- Advanced Taxonomy (Collapsible) -->
      <div class="filter-section collapsible">
        <button 
          class="collapse-toggle"
          @click="store.toggleAdvancedFilters"
          :class="{ expanded: store.showAdvancedFilters }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Advanced Taxonomy
        </button>

        <div v-show="store.showAdvancedFilters" class="collapse-content">
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

      <!-- Mimicry Ring Filter (Collapsible) -->
      <div class="filter-section collapsible">
        <button 
          class="collapse-toggle"
          @click="store.toggleMimicryFilter"
          :class="{ expanded: store.showMimicryFilter }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Mimicry Ring
          <span v-if="store.filters.mimicry !== 'All'" class="active-badge">
            {{ store.filters.mimicry }}
          </span>
        </button>

        <div v-show="store.showMimicryFilter" class="collapse-content">
          <FilterSelect
            label="Mimicry Ring"
            v-model="store.filters.mimicry"
            :options="['All', ...store.uniqueMimicry]"
            placeholder="All Mimicry Rings"
            :multiple="false"
          />
          <button class="btn-visual-selector" @click="emit('open-mimicry')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Open Visual Selector
          </button>
          <p class="filter-hint">
            Mimicry data from Dore et al. (2025)
          </p>
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

      <!-- Sequencing Status -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Sequencing Status
        </label>

        <div class="status-grid">
          <button
            v-for="status in store.uniqueStatuses"
            :key="status"
            class="status-btn"
            :class="{ active: isStatusSelected(status) }"
            :style="{ 
              '--status-color': statusColors[status] || '#6b7280',
              borderColor: isStatusSelected(status) ? statusColors[status] : 'transparent'
            }"
            @click="toggleStatus(status)"
          >
            <span 
              class="status-dot" 
              :style="{ background: statusColors[status] || '#6b7280' }"
            ></span>
            <span class="status-label">{{ status }}</span>
          </button>
        </div>
        <p class="filter-hint" v-if="store.filters.status.length > 0">
          {{ store.filters.status.length }} status{{ store.filters.status.length > 1 ? 'es' : '' }} selected
        </p>
      </div>

      <!-- Data Source -->
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
          :options="['All', ...store.uniqueSources]"
          placeholder="All Sources"
          :multiple="false"
          :show-count="false"
        />
      </div>

      <!-- UI Preferences -->
      <div class="filter-section">
        <label class="thumbnail-toggle">
          <input type="checkbox" v-model="store.showThumbnail" />
          <span>Show thumbnails</span>
        </label>
      </div>

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
}

.logo svg {
  width: 36px;
  height: 36px;
  color: var(--color-accent, #4ade80);
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

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn svg {
  width: 18px;
  height: 18px;
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
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1);
}

.search-input::placeholder {
  color: var(--color-text-muted, #666);
}

/* Collapsible Sections */
.collapsible {
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  overflow: hidden;
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
