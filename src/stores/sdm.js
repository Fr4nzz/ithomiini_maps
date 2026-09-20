/**
 * SDM (Species Distribution Model) store
 * Manages SDM prediction layers on the map.
 * Has its own species selection, independent from the occurrence data filter.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSDMStore = defineStore('sdm', () => {
  // State
  const metadata = ref(null)
  const loading = ref(false)
  const enabled = ref(false)
  const opacity = ref(0.6)
  const selectedSpecies = ref([])  // Up to 2 species for dual overlay
  // When true (default), render the full-Neotropics prediction by loading
  // both the accessible-area "core" raster and the extrapolation
  // "extension" raster. When false, load only the core raster (matches
  // the legacy accessible-area-only view).
  const showFullExtent = ref(true)

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

  // List of all species with SDM data, sorted by record count
  const availableSpecies = computed(() => {
    if (!metadata.value) return []
    return metadata.value.species
      .map(s => s.species)
      .sort()
  })

  // Actions
  async function loadMetadata() {
    if (metadata.value) return
    loading.value = true
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/sdm/sdm_metadata.json`)
      if (!response.ok) { metadata.value = null; return }
      metadata.value = await response.json()
    } catch { metadata.value = null }
    finally { loading.value = false }
  }

  function hasSDMForSpecies(speciesName) {
    return speciesLookup.value.has(speciesName)
  }

  function getSDMInfo(speciesName) {
    return speciesLookup.value.get(speciesName) || null
  }

  function setOpacity(val) { opacity.value = val }

  function toggle() {
    enabled.value = !enabled.value
    if (enabled.value && !metadata.value) loadMetadata()
  }

  function setShowFullExtent(val) { showFullExtent.value = !!val }

  return {
    metadata, loading, enabled, opacity, selectedSpecies, showFullExtent,
    speciesLookup, hasData, nSpecies, availableSpecies,
    loadMetadata, hasSDMForSpecies, getSDMInfo, setOpacity, toggle,
    setShowFullExtent,
  }
})
