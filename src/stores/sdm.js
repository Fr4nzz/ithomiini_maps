/**
 * SDM (Species Distribution Model) store
 * Manages SDM prediction layers on the map.
 * Reacts to the species filter in the data store — shows SDM automatically
 * when 1-2 species are selected.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSDMStore = defineStore('sdm', () => {
  // State
  const metadata = ref(null)
  const loading = ref(false)
  const enabled = ref(false)
  const opacity = ref(0.6)

  // Computed
  const speciesLookup = computed(() => {
    if (!metadata.value) return new Map()
    const map = new Map()
    for (const s of metadata.value.species) {
      map.set(s.species, s)
    }
    return map
  })

  const hasData = computed(() => metadata.value !== null && metadata.value.n_species > 0)

  const nSpecies = computed(() => metadata.value?.n_species || 0)

  // Actions
  async function loadMetadata() {
    if (metadata.value) return

    loading.value = true
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/sdm/sdm_metadata.json`)
      if (!response.ok) {
        metadata.value = null
        return
      }
      metadata.value = await response.json()
    } catch {
      metadata.value = null
    } finally {
      loading.value = false
    }
  }

  function hasSDMForSpecies(speciesName) {
    return speciesLookup.value.has(speciesName)
  }

  function getSDMInfo(speciesName) {
    return speciesLookup.value.get(speciesName) || null
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
    enabled,
    opacity,
    speciesLookup,
    hasData,
    nSpecies,
    loadMetadata,
    hasSDMForSpecies,
    getSDMInfo,
    setOpacity,
    toggle,
  }
})
