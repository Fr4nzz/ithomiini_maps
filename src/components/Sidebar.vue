<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'

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
  'GBIF Record': '#6b7280'
}

// Share URL functionality
const copyShareUrl = () => {
  navigator.clipboard.writeText(window.location.href)
  showCopiedToast.value = true
  setTimeout(() => { showCopiedToast.value = false }, 2000)
}

const showCopiedToast = ref(false)
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
      
      <!-- Record Count Banner -->
      <div class="record-count">
        <span class="count">{{ filteredRecords.toLocaleString() }}</span>
        <span class="label">of {{ totalRecords.toLocaleString() }} records</span>
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

      <!-- Primary Filters: Species & Subspecies -->
      <div class="filter-section">
        <label class="section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v18m-6-6 6 6 6-6"/>
          </svg>
          Taxonomy
        </label>

        <div class="filter-group">
          <label class="filter-label">Species</label>
          <select 
            v-model="store.filters.species" 
            class="filter-select"
          >
            <option value="All">All Species ({{ store.uniqueSpecies.length }})</option>
            <option 
              v-for="sp in store.uniqueSpecies" 
              :key="sp" 
              :value="sp"
            >
              {{ sp }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Subspecies</label>
          <select 
            v-model="store.filters.subspecies" 
            class="filter-select"
            :disabled="store.filters.species === 'All'"
          >
            <option value="All">All Subspecies ({{ store.uniqueSubspecies.length }})</option>
            <option 
              v-for="ssp in store.uniqueSubspecies" 
              :key="ssp" 
              :value="ssp"
            >
              {{ ssp }}
            </option>
          </select>
        </div>
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
          <div class="filter-group">
            <label class="filter-label">Family</label>
            <select v-model="store.filters.family" class="filter-select">
              <option value="All">All Families</option>
              <option v-for="f in store.uniqueFamilies" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Tribe</label>
            <select v-model="store.filters.tribe" class="filter-select">
              <option value="All">All Tribes</option>
              <option v-for="t in store.uniqueTribes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Genus</label>
            <select v-model="store.filters.genus" class="filter-select">
              <option value="All">All Genera ({{ store.uniqueGenera.length }})</option>
              <option v-for="g in store.uniqueGenera" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
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
        </button>

        <div v-show="store.showMimicryFilter" class="collapse-content">
          <div class="filter-group">
            <select v-model="store.filters.mimicry" class="filter-select">
              <option value="All">All Mimicry Rings ({{ store.uniqueMimicry.length }})</option>
              <option v-for="m in store.uniqueMimicry" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <p class="filter-hint">
            Mimicry data from Dore et al. (2025)
          </p>
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
        <div class="filter-group">
          <select v-model="store.filters.source" class="filter-select">
            <option value="All">All Sources</option>
            <option v-for="s in store.uniqueSources" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
      </div>

    </div>

    <!-- Footer Actions -->
    <footer class="sidebar-footer">
      <button class="btn-reset" @click="store.resetAllFilters">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        Reset Filters
      </button>

      <button class="btn-share" @click="copyShareUrl">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <path d="m8.59 13.51 6.83 3.98m-.01-10.98-6.82 3.98"/>
        </svg>
        Share View
      </button>

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
  width: 320px;
  min-width: 320px;
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

/* Record Count */
.record-count {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, rgba(74, 222, 128, 0.05) 100%);
  border: 1px solid rgba(74, 222, 128, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
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

/* Filter Groups */
.filter-group {
  margin-bottom: 10px;
}

.filter-label {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
  margin-bottom: 4px;
}

.filter-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.filter-select:hover:not(:disabled) {
  border-color: #4d4d6d;
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

.filter-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.filter-select option {
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
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

.collapse-content {
  padding: 12px 14px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.filter-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
  margin-top: 8px;
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
  display: flex;
  gap: 10px;
  position: relative;
}

.btn-reset,
.btn-share {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
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
  background: var(--color-accent, #4ade80);
  border: none;
  color: var(--color-bg-primary, #1a1a2e);
}

.btn-share:hover {
  background: #5eeb94;
}

.btn-reset svg,
.btn-share svg {
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
}
</style>
