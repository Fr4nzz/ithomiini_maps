<script setup>
import { useDataStore } from '../stores/data'

const store = useDataStore()

const toggleStatus = (status) => {
  const index = store.filters.status.indexOf(status)
  if (index === -1) store.filters.status.push(status)
  else store.filters.status.splice(index, 1)
}

// Status color mapping
const statusColors = {
  'Sequenced': { dot: 'blue', label: 'Sequenced' },
  'Tissue Available': { dot: 'green', label: 'Tissue' },
  'Preserved Specimen': { dot: 'orange', label: 'Preserved' },
  'Published': { dot: 'purple', label: 'Published' }
}
</script>

<template>
  <div class="sidebar">
    <!-- Header -->
    <div class="header">
      <h2>Ithomiini Map</h2>
      <div class="record-count">
        <span class="count">{{ store.filteredGeoJSON?.features.length || 0 }}</span>
        <span class="label">records</span>
      </div>
    </div>

    <!-- Filters Container -->
    <div class="controls">
      
      <!-- ═══════════════════════════════════════════════════════════════ -->
      <!-- ADVANCED FILTERS (Expandable) -->
      <!-- ═══════════════════════════════════════════════════════════════ -->
      <div class="filter-section">
        <button 
          class="section-toggle"
          :class="{ expanded: store.showAdvancedFilters }"
          @click="store.toggleAdvancedFilters"
        >
          <span class="toggle-icon">{{ store.showAdvancedFilters ? '▼' : '▶' }}</span>
          <span>Advanced Taxonomy</span>
          <span class="hint" v-if="!store.showAdvancedFilters">Family, Tribe, Genus</span>
        </button>

        <div class="collapsible" :class="{ open: store.showAdvancedFilters }">
          <!-- Family -->
          <div class="group">
            <label>Family</label>
            <select v-model="store.filters.family">
              <option value="All">All Families</option>
              <option v-for="f in store.uniqueFamilies" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>

          <!-- Tribe -->
          <div class="group">
            <label>Tribe</label>
            <select v-model="store.filters.tribe">
              <option value="All">All Tribes</option>
              <option v-for="t in store.uniqueTribes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <!-- Genus -->
          <div class="group">
            <label>Genus</label>
            <select v-model="store.filters.genus">
              <option value="All">All Genera</option>
              <option v-for="g in store.uniqueGenera" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════ -->
      <!-- PRIMARY FILTERS (Always Visible) -->
      <!-- ═══════════════════════════════════════════════════════════════ -->
      <div class="filter-section primary">
        <div class="section-label">Species Filters</div>

        <!-- Species -->
        <div class="group">
          <label>
            Species
            <span class="option-count">({{ store.uniqueSpecies.length }})</span>
          </label>
          <select v-model="store.filters.species">
            <option value="All">All Species</option>
            <option v-for="sp in store.uniqueSpecies" :key="sp" :value="sp">{{ sp }}</option>
          </select>
        </div>

        <!-- Subspecies -->
        <div class="group">
          <label>
            Subspecies
            <span class="option-count">({{ store.uniqueSubspecies.length }})</span>
          </label>
          <select v-model="store.filters.subspecies" :disabled="store.uniqueSubspecies.length === 0">
            <option value="All">All Subspecies</option>
            <option v-for="ssp in store.uniqueSubspecies" :key="ssp" :value="ssp">{{ ssp }}</option>
          </select>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════ -->
      <!-- MIMICRY FILTER (Expandable) -->
      <!-- ═══════════════════════════════════════════════════════════════ -->
      <div class="filter-section">
        <button 
          class="section-toggle"
          :class="{ expanded: store.showMimicryFilter }"
          @click="store.toggleMimicryFilter"
        >
          <span class="toggle-icon">{{ store.showMimicryFilter ? '▼' : '▶' }}</span>
          <span>Mimicry Ring</span>
          <span class="active-badge" v-if="store.filters.mimicry !== 'All'">
            {{ store.filters.mimicry }}
          </span>
        </button>

        <div class="collapsible" :class="{ open: store.showMimicryFilter }">
          <div class="group">
            <label>
              Pattern
              <span class="option-count">({{ store.uniqueMimicry.length }})</span>
            </label>
            <select v-model="store.filters.mimicry">
              <option value="All">All Patterns</option>
              <option v-for="m in store.uniqueMimicry" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════ -->
      <!-- SEQUENCING STATUS (Always Visible) -->
      <!-- ═══════════════════════════════════════════════════════════════ -->
      <div class="filter-section">
        <div class="section-label">Sequencing Status</div>
        <div class="status-toggles">
          <button 
            v-for="status in store.uniqueStatuses"
            :key="status"
            @click="toggleStatus(status)"
            :class="{ active: store.filters.status.includes(status) }"
            class="btn-status"
          >
            <span 
              class="dot" 
              :class="statusColors[status]?.dot || 'gray'"
            ></span>
            {{ statusColors[status]?.label || status }}
          </button>
        </div>
        <p class="status-hint" v-if="store.filters.status.length === 0">
          Click to filter by status
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div class="footer">
      <button class="reset" @click="store.resetAllFilters">
        ✕ Reset All Filters
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 320px;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #2d2d44;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.header {
  padding: 20px;
  border-bottom: 1px solid #2d2d44;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.header h2 {
  margin: 0 0 8px 0;
  font-size: 1.4em;
  font-weight: 600;
  color: #fff;
}

.record-count {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.record-count .count {
  font-size: 1.8em;
  font-weight: 700;
  color: #4ade80;
}

.record-count .label {
  font-size: 0.85em;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Controls Container */
.controls {
  flex-grow: 1;
  overflow-y: auto;
  padding: 10px 0;
}

/* Filter Sections */
.filter-section {
  border-bottom: 1px solid #2d2d44;
  padding: 0;
}

.filter-section.primary {
  background: rgba(74, 222, 128, 0.05);
}

.section-label {
  padding: 12px 20px 8px;
  font-size: 0.75em;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 600;
}

/* Section Toggle Button */
.section-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: transparent;
  border: none;
  color: #e0e0e0;
  font-size: 0.95em;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.section-toggle:hover {
  background: rgba(255, 255, 255, 0.05);
}

.section-toggle.expanded {
  background: rgba(255, 255, 255, 0.03);
}

.toggle-icon {
  font-size: 0.7em;
  color: #666;
  width: 12px;
}

.section-toggle .hint {
  margin-left: auto;
  font-size: 0.8em;
  color: #555;
}

.active-badge {
  margin-left: auto;
  background: #4ade80;
  color: #1a1a2e;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75em;
  font-weight: 600;
}

/* Collapsible Content */
.collapsible {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out, padding 0.3s ease-out;
  padding: 0 20px;
}

.collapsible.open {
  max-height: 500px;
  padding: 0 20px 15px;
}

/* Filter Groups */
.group {
  margin-bottom: 16px;
}

.group:last-child {
  margin-bottom: 0;
}

.filter-section.primary .group {
  padding: 0 20px;
  margin-bottom: 16px;
}

.filter-section.primary .group:last-child {
  padding-bottom: 15px;
}

label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8em;
  color: #aaa;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.option-count {
  color: #666;
  font-weight: normal;
}

/* Select Inputs */
select {
  width: 100%;
  padding: 10px 12px;
  background: #252540;
  border: 1px solid #3d3d5c;
  color: #e0e0e0;
  border-radius: 6px;
  font-size: 0.9em;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

select:hover {
  border-color: #4d4d6d;
}

select:focus {
  outline: none;
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2);
}

select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

select option {
  background: #252540;
  color: #e0e0e0;
}

/* Status Toggles */
.status-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 20px 15px;
}

.btn-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #252540;
  border: 1px solid #3d3d5c;
  color: #888;
  border-radius: 20px;
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-status:hover {
  background: #2d2d4a;
  border-color: #4d4d6d;
}

.btn-status.active {
  background: #2d2d4a;
  color: #fff;
  border-color: #4ade80;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.blue { background: #3b82f6; }
.dot.green { background: #10b981; }
.dot.orange { background: #f59e0b; }
.dot.purple { background: #a855f7; }
.dot.gray { background: #6b7280; }

.status-hint {
  padding: 0 20px 15px;
  margin: 0;
  font-size: 0.75em;
  color: #555;
  font-style: italic;
}

/* Footer */
.footer {
  padding: 15px 20px;
  border-top: 1px solid #2d2d44;
  background: #16162a;
}

.reset {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
  border-radius: 6px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s;
}

.reset:hover {
  background: #ef4444;
  color: white;
}

/* Scrollbar Styling */
.controls::-webkit-scrollbar {
  width: 6px;
}

.controls::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.controls::-webkit-scrollbar-thumb {
  background: #3d3d5c;
  border-radius: 3px;
}

.controls::-webkit-scrollbar-thumb:hover {
  background: #4d4d6d;
}
</style>
