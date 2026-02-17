<script setup>
import { computed, ref } from 'vue'
import { STATUS_COLORS } from '../utils/constants'
import { getProxyState, setProxyMode } from '../utils/imageProxy'

const props = defineProps({
  currentSpecimen: Object,
  selectedSpecies: String,
  selectedSubspecies: String,
  speciesList: Array,
  subspeciesList: Array,
  individualsList: Array,
  totalSpecies: Number,
  totalIndividuals: Number,
  totalSubspeciesCount: Number,
  allFilteredTotal: Number,
  allFilteredWithoutImages: Number,
  coordinates: Object,
  locationName: String
})

const emit = defineEmits([
  'select-species',
  'select-subspecies',
  'select-individual',
  'view-on-map'
])

const subspeciesCount = computed(() => props.subspeciesList?.length || 0)

const showImageCache = ref(false)
const proxyState = getProxyState()
const proxyOptions = [
  { value: 'auto', label: 'Auto', desc: 'wsrv.nl \u2192 lh3 \u2192 thumbnail' },
  { value: 'wsrv', label: 'wsrv.nl', desc: 'Cached, fastest' },
  { value: 'lh3', label: 'Google CDN', desc: 'Direct, highest quality' },
  { value: 'thumbnail', label: 'Thumbnail', desc: 'Direct, lower quality' },
]
function statusClass(tier) {
  const s = proxyState.tierStatus.value[tier]
  if (s === 'ok') return 'status-ok'
  if (s === 'blocked') return 'status-blocked'
  return 'status-unknown'
}
</script>

<template>
  <div class="gallery-sidebar">
    <!-- Species Section -->
    <div class="sidebar-section">
      <div class="section-header">
        <span class="count-badge">{{ totalSpecies }}</span>
        <span class="section-label">Species</span>
      </div>
      <select
        :value="selectedSpecies || ''"
        @change="emit('select-species', $event.target.value || null)"
        class="sidebar-select"
      >
        <option value="" disabled>Select species...</option>
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
    <div v-if="subspeciesList?.length > 0" class="sidebar-section">
      <div class="section-header">
        <span class="count-badge">{{ subspeciesCount }}</span>
        <span class="section-label">Subspecies</span>
      </div>
      <select
        :value="selectedSubspecies || ''"
        @change="emit('select-subspecies', $event.target.value || null)"
        class="sidebar-select"
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

    <!-- Individuals Section -->
    <div class="sidebar-section">
      <div class="section-header">
        <span class="count-badge">{{ individualsList?.length || 0 }}</span>
        <span class="section-label">Individuals</span>
      </div>
      <select
        v-if="individualsList?.length > 1"
        :value="currentSpecimen?.id || ''"
        @change="emit('select-individual', $event.target.value)"
        class="sidebar-select individual-select"
      >
        <option
          v-for="ind in individualsList"
          :key="ind.id"
          :value="ind.id"
        >
          {{ ind.id }}
        </option>
      </select>
      <div v-else class="single-individual-id">
        {{ currentSpecimen?.id || 'N/A' }}
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Details Section -->
    <div class="sidebar-details">
      <!-- Observation Date -->
      <div v-if="currentSpecimen?.observation_date" class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">{{ currentSpecimen.observation_date }}</span>
      </div>

      <!-- Mimicry Ring -->
      <div v-if="currentSpecimen?.mimicry_ring && currentSpecimen.mimicry_ring !== 'Unknown'" class="detail-row">
        <span class="detail-label">Mimicry:</span>
        <span class="detail-value">{{ currentSpecimen.mimicry_ring }}</span>
      </div>

      <!-- Source -->
      <div class="detail-row">
        <span class="detail-label">Source:</span>
        <span class="detail-value">{{ currentSpecimen?.source || 'Unknown' }}</span>
      </div>

      <!-- Status -->
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span
          class="detail-value status-badge"
          :style="{ color: STATUS_COLORS[currentSpecimen?.sequencing_status] || '#6b7280' }"
        >
          <span class="status-dot" :style="{ background: STATUS_COLORS[currentSpecimen?.sequencing_status] || '#6b7280' }"></span>
          {{ currentSpecimen?.sequencing_status || 'Unknown' }}
        </span>
      </div>

      <!-- Country -->
      <div v-if="currentSpecimen?.country && currentSpecimen.country !== 'Unknown'" class="detail-row">
        <span class="detail-label">Country:</span>
        <span class="detail-value">{{ currentSpecimen.country }}</span>
      </div>

      <!-- Location -->
      <div v-if="locationName" class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value location-name">{{ locationName }}</span>
      </div>

      <!-- Coordinates -->
      <div v-if="coordinates" class="detail-row">
        <span class="detail-label">Coords:</span>
        <span class="detail-value coords">{{ coordinates.lat.toFixed(4) }}, {{ coordinates.lng.toFixed(4) }}</span>
      </div>

      <!-- Observation URL Link -->
      <a
        v-if="currentSpecimen?.observation_url"
        :href="currentSpecimen.observation_url"
        target="_blank"
        rel="noopener noreferrer"
        class="observation-link"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <span v-if="currentSpecimen?.source === 'iNaturalist'">View on iNaturalist</span>
        <span v-else>View on GBIF</span>
      </a>

      <!-- View on Map Button -->
      <button
        v-if="coordinates"
        class="view-on-map-btn"
        @click="emit('view-on-map')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        View on Map
      </button>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Search Summary -->
    <div class="search-summary">
      <div class="summary-title">Search Summary</div>
      <div class="summary-stats-grid">
        <div class="stat-row">
          <span class="stat-label">Species:</span>
          <span class="stat-value">{{ totalSpecies }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Subspecies:</span>
          <span class="stat-value">{{ totalSubspeciesCount }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">With images:</span>
          <span class="stat-value">{{ totalIndividuals }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Without images:</span>
          <span class="stat-value">{{ allFilteredWithoutImages }}</span>
        </div>
        <div class="stat-row total-row">
          <span class="stat-label">Total individuals:</span>
          <span class="stat-value">{{ allFilteredTotal }}</span>
        </div>
      </div>
    </div>

    <!-- Image Cache -->
    <div class="sidebar-section collapsible-section">
      <button class="collapse-toggle"
        @click="showImageCache = !showImageCache"
        :class="{ expanded: showImageCache }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
        Image cache
      </button>
      <div v-show="showImageCache" class="collapse-content">
        <label class="proxy-option" v-for="opt in proxyOptions" :key="opt.value">
          <input type="radio" name="gallery-proxy-mode"
            :value="opt.value"
            :checked="proxyState.mode.value === opt.value"
            @change="setProxyMode(opt.value)" />
          <div class="proxy-option-content">
            <div class="proxy-option-header">
              <span class="proxy-option-name">{{ opt.label }}</span>
              <span v-if="opt.value !== 'auto'" class="proxy-status-dot"
                    :class="statusClass(opt.value)" />
            </div>
            <small class="proxy-option-desc">{{ opt.desc }}</small>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--color-bg-primary);
  border-right: 1px solid var(--color-border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.count-badge {
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 20px;
  text-align: center;
}

.section-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-select {
  width: 100%;
  padding: 8px 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 0.8rem;
  font-style: italic;
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-select:hover {
  border-color: var(--color-border-light);
}

.sidebar-select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}

.sidebar-select.individual-select {
  font-style: normal;
  font-family: monospace;
}

.single-individual-id {
  padding: 8px 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-accent);
  font-size: 0.8rem;
  font-family: monospace;
}

.sidebar-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.sidebar-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.75rem;
}

.detail-label {
  color: var(--color-text-muted);
  flex-shrink: 0;
  min-width: 50px;
}

.detail-value {
  color: var(--color-text-primary);
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

.observation-link {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent);
  border-radius: 5px;
  color: var(--color-accent);
  font-size: 0.75rem;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
}

.observation-link:hover {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent-hover);
  color: var(--color-accent-hover);
}

.observation-link svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.view-on-map-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 8px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--color-info) 15%, transparent);
  border: 1px solid var(--color-info);
  border-radius: 5px;
  color: var(--color-info);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-on-map-btn:hover {
  background: color-mix(in srgb, var(--color-info) 25%, transparent);
  border-color: var(--color-info);
  color: var(--color-info);
}

.view-on-map-btn svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.location-name {
  font-style: italic;
}

.coords {
  font-family: monospace;
  font-size: 0.7rem;
}

.search-summary {
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  padding: 10px;
}

.summary-title {
  font-size: 0.7rem;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.summary-stats-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}

.stat-row .stat-label {
  color: var(--color-text-muted);
}

.stat-row .stat-value {
  color: var(--color-accent);
  font-weight: 600;
}

.stat-row.total-row {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border);
}

.stat-row.total-row .stat-value {
  font-size: 0.9rem;
}

/* Collapsible Section */
.collapsible-section {
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
}

.collapse-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
}

.collapse-toggle:hover { color: var(--color-text-primary); }

.collapse-toggle svg {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
}

.collapse-toggle.expanded svg {
  transform: rotate(90deg);
}

.collapse-content {
  padding-top: 4px;
}

/* Proxy Options */
.proxy-option {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 2px;
  cursor: pointer;
  border-radius: 4px;
  user-select: none;
}

.proxy-option:hover {
  background: var(--color-bg-tertiary);
}

.proxy-option input[type="radio"] {
  margin-top: 3px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.proxy-option-name {
  font-size: 0.78rem;
  color: var(--color-text-primary);
}

.proxy-option-desc {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  display: block;
  margin-top: 1px;
}

.proxy-option-header {
  display: flex;
  align-items: center;
  gap: 5px;
}

.proxy-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.status-ok { background: var(--color-accent); }
.status-blocked { background: var(--color-danger); }
.status-unknown { background: var(--color-text-muted); }

/* Responsive */
@media (max-width: 768px) {
  .gallery-sidebar {
    display: none;
  }
}
</style>
