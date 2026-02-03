<script setup>
import { getThumbnailUrl } from '../utils/imageProxy'

/**
 * Inline SVG data URL used as a fallback when a ring photo fails to load.
 * Extracted as a constant to avoid embedding a long data URI in the template.
 */
const NO_IMAGE_FALLBACK =
  "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 60 60%22>" +
  "<rect fill=%22%232d2d4a%22 width=%2260%22 height=%2260%22/>" +
  "<text x=%2230%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2210%22>No image</text></svg>"

const props = defineProps({
  /** The mimicry ring name */
  ring: { type: String, required: true },
  /** Whether this ring is unavailable under the current taxonomy filter */
  unavailable: { type: Boolean, default: false },
  /** Whether this ring is currently selected */
  selected: { type: Boolean, default: false },
  /** Current representative record (for photo display), or null */
  currentRep: { type: Object, default: null },
  /** Current species group { species, subspecies[] }, or null */
  currentSpecies: { type: Object, default: null },
  /** Current subspecies record, or null */
  currentSubspecies: { type: Object, default: null },
  /** Zero-based index of the current species within the ring */
  speciesIndex: { type: Number, default: 0 },
  /** Total number of species in this ring */
  speciesCount: { type: Number, default: 0 },
  /** Zero-based index of the current subspecies within the current species */
  subspeciesIndex: { type: Number, default: 0 },
  /** Total number of subspecies in the current species */
  subspeciesCount: { type: Number, default: 0 },
  /** Number of occurrence records for this ring */
  recordCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'toggle',
  'prev-species',
  'next-species',
  'prev-subspecies',
  'next-subspecies',
])

const onImageError = (event) => {
  event.target.src = NO_IMAGE_FALLBACK
}

const onPrevSpecies = (event) => {
  event.stopPropagation()
  emit('prev-species')
}

const onNextSpecies = (event) => {
  event.stopPropagation()
  emit('next-species')
}

const onPrevSubspecies = (event) => {
  event.stopPropagation()
  emit('prev-subspecies')
}

const onNextSubspecies = (event) => {
  event.stopPropagation()
  emit('next-subspecies')
}
</script>

<template>
  <button
    class="ring-card"
    :class="{ selected, unavailable }"
    @click="emit('toggle')"
  >
    <!-- Photo Display -->
    <div class="ring-photo-container">
      <div
        v-if="currentRep"
        class="ring-photo"
      >
        <img
          :src="getThumbnailUrl(currentRep.image_url)"
          :alt="currentRep.scientific_name"
          loading="lazy"
          @error="onImageError"
        />

        <!-- Source badge -->
        <span
          class="source-badge"
          :class="currentRep.source === 'Sanger Institute' ? 'sanger' : 'gbif'"
        >
          {{ currentRep.source === 'Sanger Institute' ? 'Sanger' : 'GBIF' }}
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
    <div class="taxonomy-nav" v-if="currentRep">
      <div class="nav-row">
        <button
          class="nav-btn"
          :class="{ disabled: speciesCount <= 1 }"
          :disabled="speciesCount <= 1"
          @click="onPrevSpecies"
          title="Previous species"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span class="nav-label">
          <span class="nav-prefix">Spp ({{ speciesIndex + 1 }}/{{ speciesCount }}):</span>
          <strong class="species-name">{{ currentSpecies?.species }}</strong>
        </span>
        <button
          class="nav-btn"
          :class="{ disabled: speciesCount <= 1 }"
          :disabled="speciesCount <= 1"
          @click="onNextSpecies"
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
          :class="{ disabled: subspeciesCount <= 1 }"
          :disabled="subspeciesCount <= 1"
          @click="onPrevSubspecies"
          title="Previous subspecies"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span class="nav-label">
          <span class="nav-prefix">Subsp ({{ subspeciesIndex + 1 }}/{{ subspeciesCount }}):</span>
          <span class="subsp-name">{{ currentSubspecies?.subspecies || '\u2014' }}</span>
        </span>
        <button
          class="nav-btn"
          :class="{ disabled: subspeciesCount <= 1 }"
          :disabled="subspeciesCount <= 1"
          @click="onNextSubspecies"
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
      <span v-if="unavailable" class="ring-count unavailable-text">Not in filter</span>
      <span v-else class="ring-count">{{ recordCount }} records</span>
    </div>

    <!-- Selection indicator -->
    <div class="select-indicator">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
  </button>
</template>

<style scoped>
/* Ring Card */
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
</style>
