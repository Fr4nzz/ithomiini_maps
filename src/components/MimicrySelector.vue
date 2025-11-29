<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/data'

const store = useDataStore()
const emit = defineEmits(['close'])

// Search within mimicry rings
const searchQuery = ref('')

// Mimicry ring color palette (based on common wing patterns)
const mimicryColors = {
  'Agnosia': { primary: '#8B4513', secondary: '#D2691E', pattern: 'spots' },
  'Aureliana': { primary: '#FFD700', secondary: '#FFA500', pattern: 'bands' },
  'Banjana': { primary: '#2F4F4F', secondary: '#708090', pattern: 'solid' },
  'Clearwing': { primary: '#E0E0E0', secondary: '#FFFFFF', pattern: 'clear' },
  'Confusa': { primary: '#8B0000', secondary: '#FF6347', pattern: 'stripes' },
  'Derasa': { primary: '#4169E1', secondary: '#87CEEB', pattern: 'gradient' },
  'Egena': { primary: '#228B22', secondary: '#90EE90', pattern: 'spots' },
  'Eurimedia': { primary: '#FF4500', secondary: '#FFD700', pattern: 'bands' },
  'Hermias': { primary: '#9932CC', secondary: '#DDA0DD', pattern: 'stripes' },
  'Hewitsoni': { primary: '#DC143C', secondary: '#FF69B4', pattern: 'spots' },
  'Lerida': { primary: '#006400', secondary: '#32CD32', pattern: 'gradient' },
  'Mamercus': { primary: '#B8860B', secondary: '#F0E68C', pattern: 'bands' },
  'Mantineus': { primary: '#4B0082', secondary: '#8A2BE2', pattern: 'solid' },
  'Makrena': { primary: '#FF8C00', secondary: '#FFDAB9', pattern: 'stripes' },
  'Mothone': { primary: '#2E8B57', secondary: '#98FB98', pattern: 'spots' },
  'Orestilla': { primary: '#CD5C5C', secondary: '#FFC0CB', pattern: 'gradient' },
  'Panthyale': { primary: '#483D8B', secondary: '#7B68EE', pattern: 'bands' },
  'Philomela': { primary: '#556B2F', secondary: '#9ACD32', pattern: 'stripes' },
  'Praxilla': { primary: '#8B008B', secondary: '#EE82EE', pattern: 'spots' },
  'Salvinia': { primary: '#20B2AA', secondary: '#AFEEEE', pattern: 'solid' },
  'Sarepta': { primary: '#A0522D', secondary: '#DEB887', pattern: 'bands' },
  'Tiger': { primary: '#FF8C00', secondary: '#000000', pattern: 'tiger' },
  'Unknown': { primary: '#808080', secondary: '#C0C0C0', pattern: 'unknown' },
}

// Get default colors for rings not in our palette
const getColors = (ring) => {
  if (mimicryColors[ring]) return mimicryColors[ring]
  // Generate consistent colors from ring name
  let hash = 0
  for (let i = 0; i < ring.length; i++) {
    hash = ring.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return {
    primary: `hsl(${hue}, 60%, 40%)`,
    secondary: `hsl(${hue}, 60%, 70%)`,
    pattern: 'default'
  }
}

// Filtered mimicry rings based on search
const filteredRings = computed(() => {
  const rings = store.uniqueMimicry || []
  if (!searchQuery.value) return rings
  const q = searchQuery.value.toLowerCase()
  return rings.filter(r => r.toLowerCase().includes(q))
})

// Count records per mimicry ring
const ringCounts = computed(() => {
  const counts = {}
  const features = store.allFeatures || []
  features.forEach(f => {
    const ring = f.properties?.mimicry_ring || 'Unknown'
    counts[ring] = (counts[ring] || 0) + 1
  })
  return counts
})

// Currently selected ring
const selectedRing = computed(() => store.filters.mimicry)

// Select a ring
const selectRing = (ring) => {
  if (store.filters.mimicry === ring) {
    store.filters.mimicry = 'All'
  } else {
    store.filters.mimicry = ring
  }
}

// Clear selection
const clearSelection = () => {
  store.filters.mimicry = 'All'
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
    <div v-if="selectedRing !== 'All'" class="current-selection">
      <span class="selection-label">Selected:</span>
      <button class="selection-tag" @click="clearSelection">
        <span 
          class="tag-icon"
          :style="{ background: getColors(selectedRing).primary }"
        ></span>
        {{ selectedRing }}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Ring Grid -->
    <div class="ring-grid">
      <button
        v-for="ring in filteredRings"
        :key="ring"
        class="ring-card"
        :class="{ selected: selectedRing === ring }"
        @click="selectRing(ring)"
      >
        <!-- Wing Pattern Icon -->
        <div class="wing-icon" :style="{ '--primary': getColors(ring).primary, '--secondary': getColors(ring).secondary }">
          <svg viewBox="0 0 60 40" class="wing-svg">
            <!-- Left wing -->
            <ellipse 
              cx="20" cy="20" rx="18" ry="16" 
              :fill="getColors(ring).primary"
              opacity="0.9"
            />
            <!-- Right wing -->
            <ellipse 
              cx="40" cy="20" rx="18" ry="16" 
              :fill="getColors(ring).primary"
              opacity="0.9"
            />
            <!-- Pattern overlay based on type -->
            <template v-if="getColors(ring).pattern === 'tiger'">
              <rect x="8" y="12" width="3" height="16" :fill="getColors(ring).secondary" rx="1"/>
              <rect x="14" y="10" width="3" height="20" :fill="getColors(ring).secondary" rx="1"/>
              <rect x="43" y="10" width="3" height="20" :fill="getColors(ring).secondary" rx="1"/>
              <rect x="49" y="12" width="3" height="16" :fill="getColors(ring).secondary" rx="1"/>
            </template>
            <template v-else-if="getColors(ring).pattern === 'bands'">
              <rect x="5" y="16" width="50" height="8" :fill="getColors(ring).secondary" opacity="0.7"/>
            </template>
            <template v-else-if="getColors(ring).pattern === 'spots'">
              <circle cx="15" cy="18" r="4" :fill="getColors(ring).secondary"/>
              <circle cx="45" cy="18" r="4" :fill="getColors(ring).secondary"/>
              <circle cx="20" cy="26" r="3" :fill="getColors(ring).secondary"/>
              <circle cx="40" cy="26" r="3" :fill="getColors(ring).secondary"/>
            </template>
            <template v-else-if="getColors(ring).pattern === 'stripes'">
              <line x1="10" y1="10" x2="25" y2="30" :stroke="getColors(ring).secondary" stroke-width="2"/>
              <line x1="15" y1="8" x2="28" y2="28" :stroke="getColors(ring).secondary" stroke-width="2"/>
              <line x1="35" y1="30" x2="50" y2="10" :stroke="getColors(ring).secondary" stroke-width="2"/>
              <line x1="32" y1="28" x2="45" y2="8" :stroke="getColors(ring).secondary" stroke-width="2"/>
            </template>
            <template v-else-if="getColors(ring).pattern === 'clear'">
              <ellipse cx="20" cy="20" rx="12" ry="10" fill="rgba(255,255,255,0.6)"/>
              <ellipse cx="40" cy="20" rx="12" ry="10" fill="rgba(255,255,255,0.6)"/>
            </template>
            <template v-else-if="getColors(ring).pattern === 'gradient'">
              <defs>
                <linearGradient :id="'grad-' + ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" :stop-color="getColors(ring).secondary"/>
                  <stop offset="100%" :stop-color="getColors(ring).primary"/>
                </linearGradient>
              </defs>
              <ellipse cx="20" cy="20" rx="14" ry="12" :fill="'url(#grad-' + ring + ')'" opacity="0.8"/>
              <ellipse cx="40" cy="20" rx="14" ry="12" :fill="'url(#grad-' + ring + ')'" opacity="0.8"/>
            </template>
            <!-- Body -->
            <ellipse cx="30" cy="20" rx="4" ry="12" fill="#1a1a2e"/>
            <!-- Antennae -->
            <line x1="28" y1="8" x2="24" y2="2" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="32" y1="8" x2="36" y2="2" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
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

    <!-- Footer -->
    <div class="selector-footer">
      <p class="footer-note">
        Mimicry ring data from Dore et al. (2025)
      </p>
      <div class="footer-actions">
        <button class="btn-clear" @click="clearSelection" :disabled="selectedRing === 'All'">
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
  width: 600px;
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
  gap: 10px;
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

.selection-tag .tag-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.selection-tag svg {
  width: 14px;
  height: 14px;
}

/* Ring Grid */
.ring-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
  padding: 16px 20px;
  overflow-y: auto;
}

.ring-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
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

/* Wing Icon */
.wing-icon {
  width: 70px;
  height: 50px;
  margin-bottom: 10px;
}

.wing-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

/* Ring Info */
.ring-info {
  text-align: center;
}

.ring-name {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-primary, #e0e0e0);
  margin-bottom: 2px;
}

.ring-count {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
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
