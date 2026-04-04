/**
 * SDM (Species Distribution Model) store
 * Manages SDM prediction layers on the map
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSDMStore = defineStore('sdm', () => {
  // State
  const metadata = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const enabled = ref(false)
  const selectedSpecies = ref(null)
  const showRichness = ref(false)
  const opacity = ref(0.6)

  // Computed
  const speciesList = computed(() => {
    if (!metadata.value) return []
    return metadata.value.species
      .map(s => ({
        name: s.species,
        file: s.file,
        records: s.n_records,
        auc: s.auc,
      }))
      .sort((a, b) => b.records - a.records)
  })

  const hasData = computed(() => metadata.value !== null && metadata.value.n_species > 0)

  // Actions
  async function loadMetadata() {
    if (metadata.value) return

    loading.value = true
    error.value = null

    try {
      const response = await fetch('/data/sdm/sdm_metadata.json')
      if (!response.ok) {
        // SDM data not available yet
        metadata.value = null
        return
      }
      metadata.value = await response.json()
    } catch (e) {
      // Silently fail — SDM is optional
      metadata.value = null
    } finally {
      loading.value = false
    }
  }

  function selectSpecies(speciesName) {
    selectedSpecies.value = speciesName
    showRichness.value = false
  }

  function toggleRichness() {
    showRichness.value = !showRichness.value
    if (showRichness.value) {
      selectedSpecies.value = null
    }
  }

  function setOpacity(val) {
    opacity.value = val
  }

  function toggle() {
    enabled.value = !enabled.value
    if (enabled.value && !metadata.value) {
      loadMetadata()
    }
  }

  return {
    metadata,
    loading,
    error,
    enabled,
    selectedSpecies,
    showRichness,
    opacity,
    speciesList,
    hasData,
    loadMetadata,
    selectSpecies,
    toggleRichness,
    setOpacity,
    toggle,
  }
})
