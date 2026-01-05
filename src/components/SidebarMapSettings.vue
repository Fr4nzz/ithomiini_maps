<script setup>
import { ref } from 'vue'
import { useDataStore } from '../stores/data'

const store = useDataStore()

// UI state for collapsible sections
const showClusterSettings = ref(false)
const showAdvancedLegend = ref(false)
const showPointStyle = ref(false)
</script>

<template>
  <!-- Scatter Overlapping Points -->
  <div class="filter-section">
    <label class="toggle-row scatter-toggle">
      <input type="checkbox" v-model="store.scatterOverlappingPoints" />
      <span>Scatter overlapping points</span>
    </label>
    <p class="filter-hint">
      Evenly distribute overlapping points within 2.5km radius with connecting lines
    </p>
  </div>

  <!-- Clustering Settings -->
  <div class="filter-section collapsible">
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
        class="toggle-badge"
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

      <div v-if="store.clusteringEnabled" class="settings-panel">
        <div class="setting-row">
          <label>Cluster Radius <span class="setting-hint">(px)</span></label>
          <div class="slider-group">
            <input
              type="range"
              min="20"
              max="200"
              step="10"
              v-model.number="store.clusterSettings.radiusPixels"
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

        <div class="setting-row">
          <label>Cluster Count Shows</label>
          <select v-model="store.clusterSettings.countMode" class="style-select">
            <option value="individuals">Individuals (records)</option>
            <option value="subspecies">Subspecies (unique)</option>
            <option value="species">Species (unique)</option>
          </select>
          <p class="count-mode-hint">
            {{ store.clusterSettings.countMode === 'individuals' ? 'Total specimen records in cluster' :
               store.clusterSettings.countMode === 'subspecies' ? 'Unique subspecies in cluster' :
               'Unique species in cluster' }}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Legend Settings -->
  <div class="filter-section">
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

    <!-- Color By -->
    <div class="setting-row">
      <label>Color by</label>
      <select v-model="store.colorBy" class="style-select">
        <option value="subspecies">Subspecies</option>
        <option value="species">Species</option>
        <option value="genus">Genus</option>
        <option value="status">Sequencing Status</option>
        <option value="mimicry">Mimicry Ring</option>
        <option value="source">Data Source</option>
      </select>
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
      <div class="setting-row">
        <label>Position</label>
        <select v-model="store.legendSettings.position" class="style-select">
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
        </select>
      </div>

      <div class="setting-row">
        <label>Text Size</label>
        <div class="slider-group">
          <input
            type="range"
            min="0.6"
            max="1.2"
            step="0.05"
            v-model.number="store.legendSettings.textSize"
          />
          <span class="slider-value">{{ Math.round(store.legendSettings.textSize * 100) }}%</span>
        </div>
      </div>

      <div class="setting-row">
        <label>Max Items Shown</label>
        <div class="slider-group">
          <input
            type="range"
            min="5"
            max="30"
            step="1"
            v-model.number="store.legendSettings.maxItems"
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

  <!-- Point Style -->
  <div class="filter-section collapsible">
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
      <div class="setting-row">
        <label>Point Size</label>
        <div class="slider-group">
          <input
            type="range"
            min="4"
            max="20"
            step="1"
            v-model.number="store.mapStyle.pointSize"
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

      <div class="setting-row">
        <label>Border Width</label>
        <div class="slider-group">
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            v-model.number="store.mapStyle.borderWidth"
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

      <div class="setting-row">
        <label>Fill Opacity</label>
        <div class="slider-group">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            v-model.number="store.mapStyle.fillOpacity"
          />
          <span class="slider-value">{{ Math.round(store.mapStyle.fillOpacity * 100) }}%</span>
        </div>
      </div>

      <div class="setting-row">
        <label>Border Color</label>
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
</template>

<style scoped>
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

.filter-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
  margin-top: 6px;
}

/* Toggle Row */
.toggle-row {
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

.toggle-row:hover {
  background: var(--color-bg-hover, #363653);
}

.toggle-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-accent, #4ade80);
}

.toggle-row span {
  font-size: 0.9rem;
  color: var(--color-text-primary, #e0e0e0);
  font-weight: 500;
}

.scatter-toggle {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.scatter-toggle:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%);
  border-color: rgba(59, 130, 246, 0.3);
}

/* Collapsible Sections */
.collapsible {
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 8px;
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

/* Toggle Badges */
.toggle-badge {
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

.toggle-badge:hover {
  background: rgba(107, 114, 128, 0.3);
  border-color: rgba(107, 114, 128, 0.4);
}

.toggle-badge.active {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
  border-color: rgba(74, 222, 128, 0.3);
}

.toggle-badge.active:hover {
  background: rgba(74, 222, 128, 0.25);
  border-color: rgba(74, 222, 128, 0.5);
}

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

/* Subsection Toggle */
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

.subsection-content {
  padding: 12px;
  margin-top: 8px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
}

/* Settings Panel & Rows */
.settings-panel {
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

.setting-hint {
  font-weight: 400;
  font-size: 0.65rem;
  color: var(--color-text-muted, #666);
}

.count-mode-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
  margin-top: 4px;
  margin-bottom: 0;
}

/* Slider Group */
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

/* Setting Input */
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
</style>
