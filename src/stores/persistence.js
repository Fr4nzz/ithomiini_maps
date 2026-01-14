import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * Centralized persistence store
 * Controls whether application state is saved to localStorage
 */
export const usePersistenceStore = defineStore('persistence', () => {
  // Whether to persist settings across page refresh
  const enabled = ref(getStoredEnabled())

  // Get stored enabled state (this always persists)
  function getStoredEnabled() {
    try {
      const stored = localStorage.getItem('app-persist-enabled')
      return stored ? JSON.parse(stored) : false
    } catch {
      return false
    }
  }

  // Toggle persistence
  function setEnabled(value) {
    enabled.value = value
    try {
      localStorage.setItem('app-persist-enabled', JSON.stringify(value))
      if (!value) {
        // Clear all persisted data when disabling
        clearAllPersistedData()
      }
    } catch {
      // Storage unavailable
    }
  }

  // Clear all persisted application data
  function clearAllPersistedData() {
    const keysToRemove = [
      // Legend settings
      'legend-position',
      'legend-size',
      'legend-text-scale',
      'legend-dot-scale',
      'legend-max-items',
      'legend-sticky',
      'legend-custom-labels',
      'legend-custom-colors',
      'legend-hidden-items',
      'legend-item-order',
      // Legend grouping settings
      'legend-grouping',
      'legend-species-styling',
      'legend-species-borders',
      'legend-species-hues',
      // Legend abbreviation settings
      'legend-species-abbreviations',
      'legend-species-abbrev-visible',
      // Legend shape settings
      'legend-shape-settings',
      'legend-group-shapes',
      // Map settings
      'map-view',
      'map-style',
      'map-color-by',
      // Filter settings
      'app-filters',
      'app-show-advanced-filters',
      'app-show-mimicry-filter',
      // Cluster settings
      'app-clustering-enabled',
      'app-cluster-settings',
      'app-scatter-overlapping',
      // Export settings
      'app-export-settings',
      // Theme
      'app-theme'
    ]

    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ignore errors
      }
    }
  }

  // Helper to get from storage (respects persistence setting)
  function get(key, defaultValue) {
    try {
      if (!enabled.value) {
        return defaultValue
      }
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  }

  // Helper to set to storage (respects persistence setting)
  function set(key, value) {
    try {
      if (!enabled.value) {
        return
      }
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full or unavailable
    }
  }

  // Save all current state (called when enabling persistence)
  function saveAllState(stores) {
    if (!enabled.value) return

    const { legendStore, dataStore, themeStore } = stores

    // Save legend state
    if (legendStore) {
      set('legend-position', legendStore.position)
      set('legend-size', legendStore.size)
      set('legend-text-scale', legendStore.textScale)
      set('legend-dot-scale', legendStore.dotScale)
      set('legend-max-items', legendStore.maxItems)
      set('legend-sticky', legendStore.stickyEdges)
      set('legend-custom-labels', legendStore.customLabels)
      set('legend-custom-colors', legendStore.customColors)
      set('legend-hidden-items', legendStore.hiddenItems)
      set('legend-item-order', legendStore.itemOrder)
      set('legend-grouping', legendStore.groupingSettings)
      set('legend-species-styling', legendStore.speciesStyling)
      set('legend-species-borders', legendStore.speciesBorderColors)
      set('legend-species-hues', legendStore.speciesBaseHues)
      set('legend-species-abbreviations', legendStore.speciesAbbreviations)
      set('legend-species-abbrev-visible', legendStore.speciesAbbreviationVisible)
      set('legend-shape-settings', legendStore.shapeSettings)
      set('legend-group-shapes', legendStore.groupShapes)
    }

    // Save data store state
    if (dataStore) {
      set('map-view', dataStore.mapView)
      set('map-style', dataStore.mapStyle)
      set('map-color-by', dataStore.colorBy)
      set('app-filters', dataStore.filters)
      set('app-show-advanced-filters', dataStore.showAdvancedFilters)
      set('app-show-mimicry-filter', dataStore.showMimicryFilter)
      set('app-clustering-enabled', dataStore.clusteringEnabled)
      set('app-cluster-settings', dataStore.clusterSettings)
      set('app-scatter-overlapping', dataStore.scatterOverlappingPoints)
      set('app-export-settings', dataStore.exportSettings)
    }

    // Save theme
    if (themeStore) {
      set('app-theme', themeStore.currentTheme)
    }
  }

  return {
    enabled,
    setEnabled,
    get,
    set,
    saveAllState,
    clearAllPersistedData
  }
})
