<script setup>
import { ref, computed, reactive } from 'vue'
import { useDataStore } from '../stores/data'

const store = useDataStore()
const emit = defineEmits(['close'])

// Search within mimicry rings
const searchQuery = ref('')

// Track current photo index for each ring
const ringPhotoIndex = reactive({})

// Get current photo index for a ring
const getPhotoIndex = (ring) => {
  return ringPhotoIndex[ring] || 0
}

// Navigate to next photo for a ring
const nextPhoto = (ring, event) => {
  event.stopPropagation()
  const reps = store.mimicryPhotoLookup[ring]?.representatives || []
  if (reps.length > 1) {
    const current = getPhotoIndex(ring)
    ringPhotoIndex[ring] = (current + 1) % reps.length
  }
}

// Navigate to previous photo for a ring
const prevPhoto = (ring, event) => {
  event.stopPropagation()
  const reps = store.mimicryPhotoLookup[ring]?.representatives || []
  if (reps.length > 1) {
    const current = getPhotoIndex(ring)
    ringPhotoIndex[ring] = (current - 1 + reps.length) % reps.length
  }
}

// Get current representative for a ring
const getCurrentRep = (ring) => {
  const lookup = store.mimicryPhotoLookup[ring]
  if (!lookup || !lookup.representatives.length) return null
  const idx = getPhotoIndex(ring)
  return lookup.representatives[idx]
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
          <path d="M12 2c-2.5 0-5 4-5 10s2.5 10 5 10"/>
          <path d="M12 2c2.5 0 5 4 5 10s-2.5 10-5 10"/>
        </svg>
        Mimicry Rings
      </h3>
      <button class="btn-close" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Search -->
    <div class="selector-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search mimicry rings..."
      />
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
                  :src="getCurrentRep(ring).image_url"
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

            <!-- Species name under photo with navigation -->
            <div class="rep-name" v-if="getCurrentRep(ring)">
              <em>{{ getCurrentRep(ring).scientific_name }}</em>
              <!-- Navigation row with arrows and counter -->
              <div class="rep-nav-row" v-if="store.mimicryPhotoLookup[ring]?.representatives.length > 1">
                <button
                  class="nav-btn"
                  @click="prevPhoto(ring, $event)"
                  title="Previous subspecies"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <span class="rep-counter">
                  {{ getPhotoIndex(ring) + 1 }}/{{ store.mimicryPhotoLookup[ring].representatives.length }}
                </span>
                <button
                  class="nav-btn"
                  @click="nextPhoto(ring, $event)"
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
                  :src="getCurrentRep(ring).image_url"
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

            <!-- Species name with navigation -->
            <div class="rep-name" v-if="getCurrentRep(ring)">
              <em>{{ getCurrentRep(ring).scientific_name }}</em>
              <!-- Navigation row with arrows and counter -->
              <div class="rep-nav-row" v-if="store.mimicryPhotoLookup[ring]?.representatives.length > 1">
                <button
                  class="nav-btn"
                  @click="prevPhoto(ring, $event)"
                  title="Previous subspecies"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <span class="rep-counter">
                  {{ getPhotoIndex(ring) + 1 }}/{{ store.mimicryPhotoLookup[ring].representatives.length }}
                </span>
                <button
                  class="nav-btn"
                  @click="nextPhoto(ring, $event)"
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

/* Search */
.selector-search {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 20px 0;
  padding: 10px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
}

.selector-search svg {
  width: 18px;
  height: 18px;
  color: var(--color-text-muted, #666);
  flex-shrink: 0;
}

.selector-search input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.9rem;
  outline: none;
}

.selector-search input::placeholder {
  color: var(--color-text-muted, #666);
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

/* Navigation Buttons (below photo) */
.rep-nav-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.nav-btn:hover {
  background: var(--color-accent, #4ade80);
  border-color: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
}

.nav-btn svg {
  width: 12px;
  height: 12px;
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

/* Representative Name */
.rep-name {
  width: 100%;
  text-align: center;
  margin-bottom: 6px;
  font-size: 0.7rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.3;
}

.rep-name em {
  display: block;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rep-name .subspecies {
  display: block;
  font-size: 0.65rem;
  color: var(--color-text-muted, #666);
}

.rep-nav-row .rep-counter {
  font-size: 0.65rem;
  color: var(--color-accent, #4ade80);
  min-width: 28px;
  text-align: center;
}

/* Ring Info */
.ring-info {
  text-align: center;
  width: 100%;
}

.ring-name {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
  margin-bottom: 2px;
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
