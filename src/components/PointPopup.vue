<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'

const props = defineProps({
  coordinates: {
    type: Object, // { lat, lng }
    required: true
  },
  points: {
    type: Array, // Array of point properties at this location
    required: true
  },
  initialSpecies: {
    type: String,
    default: null
  },
  initialSubspecies: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close'])

const store = useDataStore()

// State
const selectedSpecies = ref(null)
const selectedSubspecies = ref(null)
const selectedIndividualIndex = ref(0)

// Status colors
const STATUS_COLORS = {
  'Sequenced': '#3b82f6',
  'Tissue Available': '#10b981',
  'Preserved Specimen': '#f59e0b',
  'Published': '#a855f7',
  'GBIF Record': '#6b7280',
  'Observation': '#22c55e',
  'Museum Specimen': '#8b5cf6',
  'Living Specimen': '#14b8a6',
}

// Group points by species
const groupedBySpecies = computed(() => {
  return store.groupPointsBySpecies(props.points)
})

// Get sorted species list (by count, with photos first)
const speciesList = computed(() => {
  return store.getSpeciesWithPhotos(props.points)
})

// Get subspecies list for selected species
const subspeciesList = computed(() => {
  if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
    return []
  }
  const speciesGroup = groupedBySpecies.value[selectedSpecies.value]
  return Object.entries(speciesGroup.subspecies)
    .map(([name, data]) => ({
      name,
      count: data.count,
      hasPhoto: data.individuals.some(i => i.image_url)
    }))
    .sort((a, b) => {
      if (a.hasPhoto && !b.hasPhoto) return -1
      if (!a.hasPhoto && b.hasPhoto) return 1
      return b.count - a.count
    })
})

// Get individuals list for selected species+subspecies
const individualsList = computed(() => {
  if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
    return props.points
  }
  const speciesGroup = groupedBySpecies.value[selectedSpecies.value]

  if (selectedSubspecies.value && speciesGroup.subspecies[selectedSubspecies.value]) {
    return speciesGroup.subspecies[selectedSubspecies.value].individuals
  }

  // Return all individuals for this species
  return Object.values(speciesGroup.subspecies)
    .flatMap(s => s.individuals)
})

// Current individual based on selection
const currentIndividual = computed(() => {
  const list = individualsList.value
  if (list.length === 0) return null
  const idx = Math.min(selectedIndividualIndex.value, list.length - 1)
  return list[idx]
})

// Get photo for current individual (with fallback)
const currentPhoto = computed(() => {
  if (!currentIndividual.value) return null
  return store.getPhotoForItem(currentIndividual.value)
})

// Handle species selection - update subspecies and individual to first available
const selectSpecies = (species) => {
  selectedSpecies.value = species

  if (species && groupedBySpecies.value[species]) {
    // Get first subspecies for this species
    const speciesGroup = groupedBySpecies.value[species]
    const subspeciesNames = Object.keys(speciesGroup.subspecies)

    // Sort subspecies by those with photos first, then by count
    const sortedSubspecies = subspeciesNames
      .map(name => ({
        name,
        data: speciesGroup.subspecies[name],
        hasPhoto: speciesGroup.subspecies[name].individuals.some(i => i.image_url)
      }))
      .sort((a, b) => {
        if (a.hasPhoto && !b.hasPhoto) return -1
        if (!a.hasPhoto && b.hasPhoto) return 1
        return b.data.count - a.data.count
      })

    if (sortedSubspecies.length > 0) {
      selectedSubspecies.value = sortedSubspecies[0].name
    } else {
      selectedSubspecies.value = null
    }
  } else {
    selectedSubspecies.value = null
  }

  selectedIndividualIndex.value = 0
}

// Handle subspecies selection - update individual to first available
const selectSubspecies = (subspecies) => {
  selectedSubspecies.value = subspecies
  selectedIndividualIndex.value = 0
}

// Handle individual selection
const selectIndividual = (index) => {
  selectedIndividualIndex.value = index
}

// Initialize with specified or first individual's species/subspecies on mount
const initializeSelection = () => {
  if (props.points.length === 0) return

  // Check if we have initial species/subspecies from a scattered point click
  if (props.initialSpecies && groupedBySpecies.value[props.initialSpecies]) {
    selectedSpecies.value = props.initialSpecies
    const speciesGroup = groupedBySpecies.value[props.initialSpecies]

    // Use initial subspecies if provided and valid
    if (props.initialSubspecies && speciesGroup.subspecies[props.initialSubspecies]) {
      selectedSubspecies.value = props.initialSubspecies
    } else {
      // Set first subspecies
      const subspeciesNames = Object.keys(speciesGroup.subspecies)
      if (subspeciesNames.length > 0) {
        selectedSubspecies.value = subspeciesNames[0]
      }
    }
    selectedIndividualIndex.value = 0
    return
  }

  // Default behavior: Get first point with photo, or just first point
  const pointsWithPhoto = props.points.filter(p => p.image_url)
  const firstPoint = pointsWithPhoto.length > 0 ? pointsWithPhoto[0] : props.points[0]

  // Set species
  const species = firstPoint.scientific_name
  if (species && groupedBySpecies.value[species]) {
    selectedSpecies.value = species

    // Set subspecies
    const subspecies = firstPoint.subspecies
    const speciesGroup = groupedBySpecies.value[species]
    if (subspecies && speciesGroup.subspecies[subspecies]) {
      selectedSubspecies.value = subspecies

      // Find index of this individual within the subspecies list
      const individuals = speciesGroup.subspecies[subspecies].individuals
      const idx = individuals.findIndex(ind => ind.id === firstPoint.id)
      selectedIndividualIndex.value = idx >= 0 ? idx : 0
    } else {
      // Set first subspecies
      const subspeciesNames = Object.keys(speciesGroup.subspecies)
      if (subspeciesNames.length > 0) {
        selectedSubspecies.value = subspeciesNames[0]
      }
      selectedIndividualIndex.value = 0
    }
  }
}

// Initialize on mount
initializeSelection()

// Watch for points changes to reinitialize selection
watch(() => props.points, () => {
  initializeSelection()
}, { deep: true })

// Total counts
const totalSpecies = computed(() => Object.keys(groupedBySpecies.value).length)
const totalIndividuals = computed(() => props.points.length)

// Subspecies count for selected species
const subspeciesCount = computed(() => {
  if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
    return 0
  }
  return Object.keys(groupedBySpecies.value[selectedSpecies.value].subspecies).length
})

// Individual count for current species+subspecies
const individualsCount = computed(() => individualsList.value.length)

// Location name from current individual or first point
const locationName = computed(() => {
  const point = currentIndividual.value || props.points[0]
  return point?.collection_location || null
})
</script>

<template>
  <div class="point-popup">
    <!-- Close button -->
    <button class="popup-close" @click="emit('close')" title="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <div class="popup-layout">
      <!-- Left Column: Photo & Individual Details -->
      <div class="popup-left-section">
        <!-- Photo -->
        <div class="photo-container">
          <img
            v-if="currentPhoto?.url"
            :src="currentPhoto.url"
            :alt="currentIndividual?.id || 'Specimen'"
            loading="lazy"
            @error="$event.target.style.display = 'none'"
          />
          <div v-else class="no-photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>No photo</span>
          </div>

          <!-- Photo indicator -->
          <div v-if="!currentPhoto?.sameIndividual && currentPhoto?.url" class="photo-indicator">
            Same species
          </div>
        </div>

        <!-- Individual ID Badge -->
        <div class="individual-id">
          {{ currentIndividual?.id || 'N/A' }}
        </div>

        <!-- Individuals Dropdown -->
        <div class="individuals-section">
          <div class="section-header">
            <span class="count-badge">{{ individualsCount }}</span>
            <span class="section-label">Individuals</span>
          </div>
          <select
            v-if="individualsList.length > 1"
            :value="selectedIndividualIndex"
            @change="selectIndividual(Number($event.target.value))"
            class="individual-select"
          >
            <option
              v-for="(ind, idx) in individualsList"
              :key="ind.id"
              :value="idx"
            >
              {{ ind.id }}
            </option>
          </select>
        </div>

        <!-- Individual Details -->
        <div class="details-section">
          <!-- Observation Date -->
          <div v-if="currentIndividual?.observation_date" class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">{{ currentIndividual.observation_date }}</span>
          </div>

          <!-- Mimicry Ring -->
          <div v-if="currentIndividual?.mimicry_ring && currentIndividual.mimicry_ring !== 'Unknown'" class="detail-row">
            <span class="detail-label">Mimicry Ring:</span>
            <span class="detail-value">{{ currentIndividual.mimicry_ring }}</span>
          </div>

          <!-- Source -->
          <div class="detail-row">
            <span class="detail-label">Source:</span>
            <span class="detail-value">{{ currentIndividual?.source || 'Unknown' }}</span>
          </div>

          <!-- Status -->
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span
              class="detail-value status-badge"
              :style="{ color: STATUS_COLORS[currentIndividual?.sequencing_status] || '#6b7280' }"
            >
              <span class="status-dot" :style="{ background: STATUS_COLORS[currentIndividual?.sequencing_status] || '#6b7280' }"></span>
              {{ currentIndividual?.sequencing_status || 'Unknown' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Right Column: Species, Subspecies & Location -->
      <div class="popup-right-section">
        <!-- Species Section -->
        <div class="taxonomy-section">
          <div class="section-header">
            <span class="count-badge">{{ totalSpecies }}</span>
            <span class="section-label">Species</span>
          </div>
          <select
            :value="selectedSpecies || ''"
            @change="selectSpecies($event.target.value || null)"
            class="taxonomy-select"
          >
            <option
              v-for="sp in speciesList"
              :key="sp.species"
              :value="sp.species"
            >
              {{ sp.species }} ({{ sp.count }})
            </option>
          </select>
        </div>

        <!-- Subspecies Section -->
        <div v-if="subspeciesList.length > 0" class="taxonomy-section">
          <div class="section-header">
            <span class="count-badge">{{ subspeciesCount }}</span>
            <span class="section-label">Subspecies</span>
          </div>
          <select
            :value="selectedSubspecies || ''"
            @change="selectSubspecies($event.target.value || null)"
            class="taxonomy-select"
          >
            <option
              v-for="ssp in subspeciesList"
              :key="ssp.name"
              :value="ssp.name"
            >
              {{ ssp.name }} ({{ ssp.count }})
            </option>
          </select>
        </div>

        <div class="divider"></div>

        <!-- Location Summary -->
        <div class="location-summary">
          <div class="summary-title">Location Summary</div>

          <div v-if="locationName" class="detail-row">
            <span class="detail-label">Location:</span>
            <span class="detail-value location-name">{{ locationName }}</span>
          </div>

          <div v-if="currentIndividual?.country && currentIndividual.country !== 'Unknown'" class="detail-row">
            <span class="detail-label">Country:</span>
            <span class="detail-value">{{ currentIndividual.country }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Coordinates:</span>
            <span class="detail-value coords">
              {{ coordinates.lat.toFixed(4) }}, {{ coordinates.lng.toFixed(4) }}
            </span>
          </div>

          <div class="location-stats">
            <div class="stat">
              <span class="stat-value">{{ totalSpecies }}</span>
              <span class="stat-label">species</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ totalIndividuals }}</span>
              <span class="stat-label">individuals</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.point-popup {
  position: relative;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 10px;
  padding: 16px;
  min-width: 420px;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  border: 1px solid #3d3d5c;
}

.popup-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  z-index: 10;
}

.popup-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.popup-close svg {
  width: 16px;
  height: 16px;
}

.popup-layout {
  display: flex;
  gap: 16px;
}

/* Left Column: Photo & Individual Details */
.popup-left-section {
  flex-shrink: 0;
  width: 170px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.photo-container {
  position: relative;
  width: 170px;
  height: 170px;
  background: #252540;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #3d3d5c;
}

.photo-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-photo {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
  gap: 8px;
}

.no-photo svg {
  width: 40px;
  height: 40px;
  opacity: 0.5;
}

.no-photo span {
  font-size: 0.75rem;
}

.photo-indicator {
  position: absolute;
  bottom: 6px;
  left: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.7);
  color: #888;
  font-size: 0.65rem;
  padding: 3px 6px;
  border-radius: 3px;
  text-align: center;
}

.individual-id {
  font-size: 0.85rem;
  font-weight: 600;
  color: #14b8a6;
  text-align: center;
  font-family: monospace;
  background: rgba(20, 184, 166, 0.15);
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(20, 184, 166, 0.3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Section Header with count badge */
.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.count-badge {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 20px;
  text-align: center;
}

.section-label {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Individuals Section */
.individuals-section {
  display: flex;
  flex-direction: column;
}

.individual-select {
  width: 100%;
  padding: 8px 10px;
  background: #252540;
  border: 1px solid #3d3d5c;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.8rem;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.2s;
}

.individual-select:hover {
  border-color: #5d5d7c;
}

.individual-select:focus {
  outline: none;
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

/* Details Section */
.details-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid #3d3d5c;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.75rem;
}

.detail-label {
  color: #888;
  flex-shrink: 0;
  min-width: 55px;
}

.detail-value {
  color: #e0e0e0;
  word-break: break-word;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Right Column: Species, Subspecies & Location */
.popup-right-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.taxonomy-section {
  display: flex;
  flex-direction: column;
}

.taxonomy-select {
  width: 100%;
  padding: 8px 10px;
  background: #252540;
  border: 1px solid #3d3d5c;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.85rem;
  font-style: italic;
  cursor: pointer;
  transition: all 0.2s;
}

.taxonomy-select:hover {
  border-color: #5d5d7c;
}

.taxonomy-select:focus {
  outline: none;
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

.divider {
  height: 1px;
  background: #3d3d5c;
  margin: 4px 0;
}

.location-summary {
  background: rgba(74, 222, 128, 0.05);
  border: 1px solid rgba(74, 222, 128, 0.15);
  border-radius: 6px;
  padding: 10px;
}

.summary-title {
  font-size: 0.7rem;
  color: #4ade80;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.location-name {
  font-style: italic;
}

.coords {
  font-family: monospace;
  font-size: 0.7rem;
}

.location-stats {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(74, 222, 128, 0.15);
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #4ade80;
}

.stat-label {
  font-size: 0.7rem;
  color: #888;
}
</style>
