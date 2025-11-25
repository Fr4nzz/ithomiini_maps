<script setup>
import { useDataStore } from '../stores/data'
const store = useDataStore()

const toggleStatus = (status) => {
  const index = store.filters.status.indexOf(status)
  if (index === -1) store.filters.status.push(status)
  else store.filters.status.splice(index, 1)
}
</script>

<template>
  <div class="sidebar">
    <div class="header">
      <h2>Ithomiini Map</h2>
      <small>{{ store.filteredGeoJSON?.features.length || 0 }} Records Found</small>
    </div>

    <div class="controls">
      <!-- Species Filter -->
      <div class="group">
        <label>Species</label>
        <select v-model="store.filters.species">
          <option value="">All Species</option>
          <option v-for="sp in store.uniqueSpecies" :key="sp" :value="sp">
            {{ sp }}
          </option>
        </select>
      </div>

      <!-- Mimicry Filter -->
      <div class="group">
        <label>Mimicry Ring</label>
        <select v-model="store.filters.mimicry">
          <option value="">All Patterns</option>
          <option v-for="m in store.uniqueMimicry" :key="m" :value="m">
            {{ m }}
          </option>
        </select>
      </div>

      <!-- Sequencing Status (Toggles) -->
      <div class="group">
        <label>Sequencing Status</label>
        <div class="status-toggles">
          <button 
            @click="toggleStatus('Sequenced')"
            :class="{ active: store.filters.status.includes('Sequenced') }"
            class="btn-seq"
          >
            <span class="dot blue"></span> Sequenced
          </button>
          
          <button 
            @click="toggleStatus('Tissue Available')"
            :class="{ active: store.filters.status.includes('Tissue Available') }"
            class="btn-seq"
          >
            <span class="dot green"></span> Tissue
          </button>

          <button 
            @click="toggleStatus('Preserved Specimen')"
            :class="{ active: store.filters.status.includes('Preserved Specimen') }"
            class="btn-seq"
          >
            <span class="dot red"></span> Preserved
          </button>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <button class="reset" @click="store.filters = { species: '', mimicry: '', status: [] }">
        Reset Filters
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 300px;
  height: 100vh;
  background: #1e1e1e;
  color: white;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
  z-index: 20; /* Above map */
}
.header { padding: 20px; border-bottom: 1px solid #333; }
.controls { padding: 20px; flex-grow: 1; overflow-y: auto; }
.group { margin-bottom: 25px; }
label { display: block; font-size: 0.85em; color: #aaa; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }

select {
  width: 100%;
  padding: 10px;
  background: #2a2a2a;
  border: 1px solid #444;
  color: white;
  border-radius: 4px;
}

.status-toggles { display: flex; flex-direction: column; gap: 8px; }
.btn-seq {
  background: #2a2a2a;
  border: 1px solid #333;
  color: #888;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
}
.btn-seq.active { background: #333; color: white; border-color: #555; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.blue { background: #3b82f6; }
.green { background: #10b981; }
.red { background: #ef4444; }

.footer { padding: 20px; border-top: 1px solid #333; }
.reset { width: 100%; padding: 10px; background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 4px; cursor: pointer; }
.reset:hover { background: #ef4444; color: white; }
</style>