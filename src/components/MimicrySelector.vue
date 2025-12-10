<script setup>
import { ref, computed, reactive, nextTick } from 'vue'
import { useDataStore } from '../stores/data'
import { getThumbnailUrl } from '../utils/imageProxy'

const store = useDataStore()
const emit = defineEmits(['close'])

// Search within mimicry rings
const searchQuery = ref('')
const showDropdown = ref(false)
const dropdownInput = ref(null)

// All rings for the dropdown (combines available + unavailable)
const allRingsForDropdown = computed(() => {
  const available = store.availableMimicryRings || []
  const unavailable = store.unavailableMimicryRings || []
  return [...available, ...unavailable].sort()
})

// Fuzzy search filter for dropdown
const filteredDropdownRings = computed(() => {
  if (!searchQuery.value) return allRingsForDropdown.value
  const query = searchQuery.value.toLowerCase()
  return allRingsForDropdown.value.filter(ring => {
    // Fuzzy match: check if all characters appear in order
    let ringLower = ring.toLowerCase()
    let queryIndex = 0
    for (let i = 0; i < ringLower.length && queryIndex < query.length; i++) {
      if (ringLower[i] === query[queryIndex]) {
        queryIndex++
      }
    }
    return queryIndex === query.length
  })
})

// Toggle dropdown
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
  if (showDropdown.value) {
    nextTick(() => {
      dropdownInput.value?.focus()
    })
  }
}

// Close dropdown when clicking outside
const closeDropdown = () => {
  showDropdown.value = false
  searchQuery.value = ''
}

// Select from dropdown
const selectFromDropdown = (ring) => {
  toggleRing(ring)
  searchQuery.value = ''
}

// Track species and subspecies indices separately for each ring
const ringSpeciesIndex = reactive({})
const ringSubspeciesIndex = reactive({})

// Get grouped data for a ring: species -> subspecies[]
const getGroupedReps = (ring) => {
  const reps = store.mimicryPhotoLookup[ring]?.representatives || []
  const grouped = {}

  for (const rep of reps) {
    const species = rep.scientific_name || 'Unknown'
    if (!grouped[species]) {
      grouped[species] = []
    }
    grouped[species].push(rep)
  }

  // Convert to array of { species, subspecies[] }
  return Object.keys(grouped).sort().map(species => ({
    species,
    subspecies: grouped[species]
  }))
}

// Get species list for a ring
const getSpeciesList = (ring) => {
  return getGroupedReps(ring)
}

// Get current species index for a ring
const getSpeciesIndex = (ring) => {
  const list = getSpeciesList(ring)
  const idx = ringSpeciesIndex[ring] || 0
  return Math.min(idx, list.length - 1)
}

// Get current subspecies index for a ring
const getSubspeciesIndex = (ring) => {
  return ringSubspeciesIndex[ring] || 0
}

// Get current species data for a ring
const getCurrentSpecies = (ring) => {
  const list = getSpeciesList(ring)
  if (list.length === 0) return null
  const idx = getSpeciesIndex(ring)
  return list[idx]
}

// Get current subspecies data for a ring
const getCurrentSubspecies = (ring) => {
  const speciesData = getCurrentSpecies(ring)
  if (!speciesData) return null
  const idx = getSubspeciesIndex(ring)
  const validIdx = Math.min(idx, speciesData.subspecies.length - 1)
  return speciesData.subspecies[validIdx]
}

// Get current representative (for photo display)
const getCurrentRep = (ring) => {
  return getCurrentSubspecies(ring)
}

// Navigate species
const prevSpecies = (ring, event) => {
  event.stopPropagation()
  const list = getSpeciesList(ring)
  if (list.length <= 1) return
  const current = getSpeciesIndex(ring)
  ringSpeciesIndex[ring] = (current - 1 + list.length) % list.length
  ringSubspeciesIndex[ring] = 0 // Reset subspecies when species changes
}

const nextSpecies = (ring, event) => {
  event.stopPropagation()
  const list = getSpeciesList(ring)
  if (list.length <= 1) return
  const current = getSpeciesIndex(ring)
  ringSpeciesIndex[ring] = (current + 1) % list.length
  ringSubspeciesIndex[ring] = 0 // Reset subspecies when species changes
}

// Navigate subspecies
const prevSubspecies = (ring, event) => {
  event.stopPropagation()
  const speciesData = getCurrentSpecies(ring)
  if (!speciesData || speciesData.subspecies.length <= 1) return
  const current = getSubspeciesIndex(ring)
  ringSubspeciesIndex[ring] = (current - 1 + speciesData.subspecies.length) % speciesData.subspecies.length
}

const nextSubspecies = (ring, event) => {
  event.stopPropagation()
  const speciesData = getCurrentSpecies(ring)
  if (!speciesData || speciesData.subspecies.length <= 1) return
  const current = getSubspeciesIndex(ring)
  ringSubspeciesIndex[ring] = (current + 1) % speciesData.subspecies.length
}

// Count records per mimicry ring
const ringCounts = computed(() => {
  const counts = {}
  const features = store.allFeatures || []
  features.forEach(f => {
    const ring = f.mimicry_ring || 'Unknown'
    counts[ring] = (counts[ring] || 0) + 1
  })
  return counts
})

// Available rings (would return results with current taxonomy filter)
const availableRings = computed(() => {
  const available = store.availableMimicryRings || []
  if (!searchQuery.value) return available
  const q = searchQuery.value.toLowerCase()
  return available.filter(r => r.toLowerCase().includes(q))
})

// Unavailable rings (would return no results with current taxonomy filter)
const unavailableRings = computed(() => {
  const unavailable = store.unavailableMimicryRings || []
  if (!searchQuery.value) return unavailable
  const q = searchQuery.value.toLowerCase()
  return unavailable.filter(r => r.toLowerCase().includes(q))
})

// Check if there's an active taxonomy filter
const hasTaxonomyFilter = computed(() => {
  return store.filters.genus !== 'All' ||
         store.filters.species.length > 0 ||
         store.filters.subspecies.length > 0
})

// Currently selected rings (now an array for multi-select)
const selectedRings = computed(() => store.filters.mimicry)

// Toggle a ring selection (multi-select)
const toggleRing = (ring) => {
  const index = store.filters.mimicry.indexOf(ring)
  if (index === -1) {
    // Add to selection
    store.filters.mimicry.push(ring)
  } else {
    // Remove from selection
    store.filters.mimicry.splice(index, 1)
  }
}

// Remove a specific ring from selection
const removeRing = (ring) => {
  const index = store.filters.mimicry.indexOf(ring)
  if (index !== -1) {
    store.filters.mimicry.splice(index, 1)
  }
}

// Clear all selections
const clearSelection = () => {
  store.filters.mimicry = []
  emit('close')
}
</script>

<template>
  <div class="mimicry-selector">
    <!-- Header -->
    <div class="selector-header">
      <h3>
        <img src="../assets/Mimicry_bttn.svg" alt="Mimicry" class="header-icon" />
        Mimicry Rings
      </h3>
      <button class="btn-close" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Dropdown Filter -->
    <div class="selector-dropdown-wrapper">
      <button
        class="dropdown-trigger"
        @click="toggleDropdown"
        :class="{ active: showDropdown }"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <span v-if="selectedRings.length === 0">Select mimicry rings...</span>
        <span v-else>{{ selectedRings.length }} ring{{ selectedRings.length > 1 ? 's' : '' }} selected</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      <!-- Dropdown list -->
      <div v-if="showDropdown" class="dropdown-list" @click.stop>
        <div class="dropdown-search">
          <input
            ref="dropdownInput"
            type="text"
            v-model="searchQuery"
            placeholder="Type to filter..."
            @keydown.escape="closeDropdown"
          />
        </div>
        <div class="dropdown-options">
          <button
            v-for="ring in filteredDropdownRings"
            :key="ring"
            class="dropdown-option"
            :class="{ selected: selectedRings.includes(ring) }"
            @click="selectFromDropdown(ring)"
          >
            <span class="option-check">
              <svg v-if="selectedRings.includes(ring)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
            <span class="option-name">{{ ring }}</span>
            <span class="option-count">{{ ringCounts[ring] || 0 }}</span>
          </button>
          <div v-if="filteredDropdownRings.length === 0" class="dropdown-empty">
            No rings match "{{ searchQuery }}"
          </div>
        </div>
      </div>

      <!-- Click outside to close -->
      <div v-if="showDropdown" class="dropdown-backdrop" @click="closeDropdown"></div>
    </div>

    <!-- Current Selection -->
    <div v-if="selectedRings.length > 0" class="current-selection">
      <span class="selection-label">Selected:</span>
      <button
        v-for="ring in selectedRings"
        :key="ring"
        class="selection-tag"
        @click="removeRing(ring)"
      >
        {{ ring }}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Ring Sections -->
    <div class="ring-sections">
      <!-- Available Rings Section -->
      <div class="ring-section" v-if="availableRings.length > 0">
        <div class="section-header" v-if="hasTaxonomyFilter">
          <span class="section-title">Available for current filter</span>
          <span class="section-count">{{ availableRings.length }}</span>
        </div>

        <div class="ring-grid">
          <button
            v-for="ring in availableRings"
            :key="ring"
            class="ring-card"
            :class="{ selected: selectedRings.includes(ring) }"
            @click="toggleRing(ring)"
          >
            <!-- Photo Display -->
            <div class="ring-photo-container">
              <div
                v-if="getCurrentRep(ring)"
                class="ring-photo"
              >
                <img
                  :src="getThumbnailUrl(getCurrentRep(ring).image_url)"
                  :alt="getCurrentRep(ring).scientific_name"
                  loading="lazy"
                  @error="$event.target.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 60 60%22><rect fill=%22%232d2d4a%22 width=%2260%22 height=%2260%22/><text x=%2230%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2210%22>No image</text></svg>'"
                />

                <!-- Source badge -->
                <span
                  class="source-badge"
                  :class="getCurrentRep(ring)?.source === 'Sanger Institute' ? 'sanger' : 'gbif'"
                >
                  {{ getCurrentRep(ring)?.source === 'Sanger Institute' ? 'Sanger' : 'GBIF' }}
                </span>
              </div>

              <!-- No photo placeholder -->
              <div v-else class="ring-photo-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>No photo</span>
              </div>
            </div>

            <!-- Species navigation row -->
            <div class="taxonomy-nav" v-if="getCurrentRep(ring)">
              <div class="nav-row">
                <button
                  class="nav-btn"
                  :class="{ disabled: getSpeciesList(ring).length <= 1 }"
                  :disabled="getSpeciesList(ring).length <= 1"
                  @click="prevSpecies(ring, $event)"
                  title="Previous species"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <span class="nav-label">
                  <span class="nav-prefix">Spp ({{ getSpeciesIndex(ring) + 1 }}/{{ getSpeciesList(ring).length }}):</span>
                  <strong class="species-name">{{ getCurrentSpecies(ring)?.species }}</strong>
                </span>
                <button
                  class="nav-btn"
                  :class="{ disabled: getSpeciesList(ring).length <= 1 }"
                  :disabled="getSpeciesList(ring).length <= 1"
                  @click="nextSpecies(ring, $event)"
                  title="Next species"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>

              <!-- Subspecies navigation row -->
              <div class="nav-row subsp-row">
                <button
                  class="nav-btn"
                  :class="{ disabled: (getCurrentSpecies(ring)?.subspecies.length || 0) <= 1 }"
                  :disabled="(getCurrentSpecies(ring)?.subspecies.length || 0) <= 1"
                  @click="prevSubspecies(ring, $event)"
                  title="Previous subspecies"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <span class="nav-label">
                  <span class="nav-prefix">Subsp ({{ getSubspeciesIndex(ring) + 1 }}/{{ getCurrentSpecies(ring)?.subspecies.length || 0 }}):</span>
                  <span class="subsp-name">{{ getCurrentSubspecies(ring)?.subspecies || '—' }}</span>
                </span>
                <button
                  class="nav-btn"
                  :class="{ disabled: (getCurrentSpecies(ring)?.subspecies.length || 0) <= 1 }"
                  :disabled="(getCurrentSpecies(ring)?.subspecies.length || 0) <= 1"
                  @click="nextSubspecies(ring, $event)"
                  title="Next subspecies"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Ring Info -->
            <div class="ring-info">
              <span class="ring-name">{{ ring }}</span>
              <span class="ring-count">{{ ringCounts[ring] || 0 }} records</span>
            </div>

            <!-- Selection indicator -->
            <div class="select-indicator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </button>
        </div>
      </div>

      <!-- Unavailable Rings Section -->
      <div class="ring-section unavailable-section" v-if="unavailableRings.length > 0 && hasTaxonomyFilter">
        <div class="section-header">
          <span class="section-title">Not in current filter</span>
          <span class="section-count">{{ unavailableRings.length }}</span>
        </div>

        <div class="ring-grid unavailable">
          <button
            v-for="ring in unavailableRings"
            :key="ring"
            class="ring-card unavailable"
            :class="{ selected: selectedRings.includes(ring) }"
            @click="toggleRing(ring)"
          >
            <!-- Photo Display -->
            <div class="ring-photo-container">
              <div
                v-if="getCurrentRep(ring)"
                class="ring-photo"
              >
                <img
                  :src="getThumbnailUrl(getCurrentRep(ring).image_url)"
                  :alt="getCurrentRep(ring).scientific_name"
                  loading="lazy"
                />
              </div>

              <div v-else class="ring-photo-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
            </div>

            <!-- Species navigation row -->
            <div class="taxonomy-nav" v-if="getCurrentRep(ring)">
              <div class="nav-row">
                <button
                  class="nav-btn"
                  :class="{ disabled: getSpeciesList(ring).length <= 1 }"
                  :disabled="getSpeciesList(ring).length <= 1"
                  @click="prevSpecies(ring, $event)"
                  title="Previous species"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <span class="nav-label">
                  <span class="nav-prefix">Spp ({{ getSpeciesIndex(ring) + 1 }}/{{ getSpeciesList(ring).length }}):</span>
                  <strong class="species-name">{{ getCurrentSpecies(ring)?.species }}</strong>
                </span>
                <button
                  class="nav-btn"
                  :class="{ disabled: getSpeciesList(ring).length <= 1 }"
                  :disabled="getSpeciesList(ring).length <= 1"
                  @click="nextSpecies(ring, $event)"
                  title="Next species"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>

              <!-- Subspecies navigation row -->
              <div class="nav-row subsp-row">
                <button
                  class="nav-btn"
                  :class="{ disabled: (getCurrentSpecies(ring)?.subspecies.length || 0) <= 1 }"
                  :disabled="(getCurrentSpecies(ring)?.subspecies.length || 0) <= 1"
                  @click="prevSubspecies(ring, $event)"
                  title="Previous subspecies"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <span class="nav-label">
                  <span class="nav-prefix">Subsp ({{ getSubspeciesIndex(ring) + 1 }}/{{ getCurrentSpecies(ring)?.subspecies.length || 0 }}):</span>
                  <span class="subsp-name">{{ getCurrentSubspecies(ring)?.subspecies || '—' }}</span>
                </span>
                <button
                  class="nav-btn"
                  :class="{ disabled: (getCurrentSpecies(ring)?.subspecies.length || 0) <= 1 }"
                  :disabled="(getCurrentSpecies(ring)?.subspecies.length || 0) <= 1"
                  @click="nextSubspecies(ring, $event)"
                  title="Next subspecies"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Ring Info -->
            <div class="ring-info">
              <span class="ring-name">{{ ring }}</span>
              <span class="ring-count unavailable-text">Not in filter</span>
            </div>

            <!-- Selection indicator -->
            <div class="select-indicator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="availableRings.length === 0 && unavailableRings.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <p>No mimicry rings found</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="selector-footer">
      <p class="footer-note">
        Mimicry ring data from Dore et al. (2025) • Photos prioritize Sanger Institute
      </p>
      <div class="footer-actions">
        <button class="btn-clear" @click="clearSelection" :disabled="selectedRings.length === 0">
          Clear Selection
        </button>
        <button class="btn-apply" @click="emit('close')">
          Apply Filter
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mimicry-selector {
  background: var(--color-bg-secondary, #252540);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  width: 700px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.selector-header h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
  margin: 0;
}

.selector-header h3 svg {
  width: 22px;
  height: 22px;
  color: var(--color-accent, #4ade80);
}

.selector-header h3 .header-icon {
  width: 28px;
  height: 28px;
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

/* Dropdown Filter */
.selector-dropdown-wrapper {
  position: relative;
  margin: 16px 20px 0;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.dropdown-trigger:hover {
  border-color: #5d5d7c;
}

.dropdown-trigger.active {
  border-color: var(--color-accent, #4ade80);
}

.dropdown-trigger svg {
  width: 18px;
  height: 18px;
  color: var(--color-text-muted, #666);
  flex-shrink: 0;
}

.dropdown-trigger svg.chevron {
  margin-left: auto;
  transition: transform 0.2s;
}

.dropdown-trigger.active svg.chevron {
  transform: rotate(180deg);
}

.dropdown-trigger span {
  flex: 1;
  text-align: left;
}

.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.dropdown-search {
  padding: 10px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.dropdown-search input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  outline: none;
}

.dropdown-search input:focus {
  border-color: var(--color-accent, #4ade80);
}

.dropdown-search input::placeholder {
  color: var(--color-text-muted, #666);
}

.dropdown-options {
  max-height: 250px;
  overflow-y: auto;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.dropdown-option:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dropdown-option.selected {
  background: rgba(74, 222, 128, 0.1);
}

.option-check {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  flex-shrink: 0;
}

.dropdown-option.selected .option-check {
  background: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
}

.option-check svg {
  width: 12px;
  height: 12px;
  color: var(--color-bg-primary, #1a1a2e);
}

.option-name {
  flex: 1;
}

.option-count {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
  padding: 2px 8px;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 10px;
}

.dropdown-empty {
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted, #666);
  font-size: 0.85rem;
}

/* Current Selection */
.current-selection {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 20px 0;
  padding: 10px 14px;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 8px;
}

.selection-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #aaa);
}

.selection-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 4px;
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.selection-tag svg {
  width: 14px;
  height: 14px;
}

/* Ring Sections */
.ring-sections {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.ring-section {
  margin-bottom: 24px;
}

.ring-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary, #aaa);
}

.section-count {
  font-size: 0.7rem;
  padding: 2px 6px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 10px;
  color: var(--color-text-muted, #666);
}

.unavailable-section .section-title {
  color: var(--color-text-muted, #666);
}

/* Ring Grid */
.ring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.ring-grid.unavailable {
  opacity: 0.6;
}

.ring-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.ring-card:hover {
  background: #353558;
  transform: translateY(-2px);
}

.ring-card.selected {
  border-color: var(--color-accent, #4ade80);
  background: rgba(74, 222, 128, 0.1);
}

.ring-card.unavailable {
  opacity: 0.7;
}

.ring-card.unavailable:hover {
  opacity: 0.9;
}

/* Photo Container */
.ring-photo-container {
  width: 100%;
  aspect-ratio: 1;
  margin-bottom: 8px;
  position: relative;
}

.ring-photo {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.ring-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ring-photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary, #1a1a2e);
  border-radius: 6px;
  color: var(--color-text-muted, #666);
}

.ring-photo-placeholder svg {
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
}

.ring-photo-placeholder span {
  font-size: 0.7rem;
}

/* Taxonomy Navigation */
.taxonomy-nav {
  width: 100%;
  margin-bottom: 8px;
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 4px;
}

.nav-row.subsp-row {
  margin-bottom: 0;
}

.nav-label {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 0.65rem;
  line-height: 1.3;
  color: var(--color-text-secondary, #aaa);
}

.nav-prefix {
  display: block;
  font-size: 0.6rem;
  color: var(--color-text-muted, #666);
}

.species-name {
  display: block;
  font-weight: 600;
  font-style: italic;
  color: var(--color-text-primary, #e0e0e0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subsp-name {
  display: block;
  font-style: italic;
  color: var(--color-text-secondary, #aaa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.nav-btn:hover:not(.disabled) {
  background: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

.nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn svg {
  width: 10px;
  height: 10px;
}

/* Source Badge */
.source-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
}

.source-badge.sanger {
  background: rgba(59, 130, 246, 0.9);
  color: white;
}

.source-badge.gbif {
  background: rgba(107, 114, 128, 0.9);
  color: white;
}

/* Ring Info */
.ring-info {
  text-align: center;
  width: 100%;
}

.ring-name {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-primary, #e0e0e0);
  margin-bottom: 4px;
}

.ring-count {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
}

.ring-count.unavailable-text {
  color: #ef4444;
  font-style: italic;
}

/* Selection Indicator */
.select-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: var(--color-accent, #4ade80);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s;
  z-index: 10;
}

.ring-card.selected .select-indicator {
  opacity: 1;
  transform: scale(1);
}

.select-indicator svg {
  width: 12px;
  height: 12px;
  color: var(--color-bg-primary, #1a1a2e);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--color-text-muted, #666);
}

.empty-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 0.9rem;
}

/* Footer */
.selector-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-primary, #1a1a2e);
}

.footer-note {
  font-size: 0.75rem;
  color: var(--color-text-muted, #666);
  margin: 0 0 12px 0;
  font-style: italic;
}

.footer-actions {
  display: flex;
  gap: 10px;
}

.btn-clear,
.btn-apply {
  flex: 1;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear {
  background: transparent;
  border: 1px solid var(--color-border, #3d3d5c);
  color: var(--color-text-secondary, #aaa);
}

.btn-clear:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
}

.btn-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-apply {
  background: var(--color-accent, #4ade80);
  border: none;
  color: var(--color-bg-primary, #1a1a2e);
}

.btn-apply:hover {
  background: #5eeb94;
}

/* Responsive */
@media (max-width: 640px) {
  .ring-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
