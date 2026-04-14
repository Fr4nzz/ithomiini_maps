<script setup>
import { useDataStore } from '../../stores/data'
import { useLegendStore } from '../../stores/legend'
import { usePersistenceStore } from '../../stores/persistence'
import SidebarMapSettings from '../SidebarMapSettings.vue'

defineProps({
  currentView: {
    type: String,
    default: 'map'
  }
})

const store = useDataStore()
const legendStore = useLegendStore()
const persistenceStore = usePersistenceStore()

function togglePersistence() {
  persistenceStore.setEnabled(!persistenceStore.enabled)
  if (persistenceStore.enabled) {
    persistenceStore.saveAllState({
      legendStore,
      dataStore: store
    })
  }
}
</script>

<template>
  <div class="tab-panel style-tab">
    <div class="filter-section">
      <label class="thumbnail-toggle">
        <input v-model="store.showThumbnail" type="checkbox">
        <span>Show thumbnails</span>
      </label>
    </div>

    <SidebarMapSettings v-if="currentView === 'map'" />

    <div v-else class="filter-section style-placeholder">
      <p class="style-placeholder-title">Map styling is available in map view.</p>
      <p class="filter-hint">Switch back to the map to tune visualization mode, clustering, heatmaps, legend visibility, and point styling.</p>
    </div>

    <div class="filter-section remember-settings">
      <div class="setting-row toggle-row persist-row">
        <div class="setting-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Remember Settings</span>
        </div>
        <button
          class="toggle-button"
          :class="{ active: persistenceStore.enabled }"
          :title="persistenceStore.enabled ? 'Settings will be saved on page refresh' : 'Settings will reset on page refresh'"
          @click="togglePersistence"
        >
          {{ persistenceStore.enabled ? 'ON' : 'OFF' }}
        </button>
      </div>
      <p class="filter-hint">{{ persistenceStore.enabled ? 'All settings saved to browser' : 'Settings reset on refresh' }}</p>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  display: flex;
  flex-direction: column;
}

.style-placeholder {
  padding: 16px;
  border: 1px dashed var(--color-border, #3d3d5c);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.style-placeholder-title {
  margin: 0 0 8px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.95rem;
  font-weight: 600;
}

.persist-row {
  justify-content: space-between;
  align-items: center;
}
</style>
