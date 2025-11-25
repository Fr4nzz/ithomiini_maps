import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useDataStore = defineStore('data', () => {
  // --- STATE ---
  const allFeatures = ref([])
  const loading = ref(true)

  // Filter visibility state (for expand/collapse)
  const showAdvancedFilters = ref(false)
  const showMimicryFilter = ref(false)

  // The Active Filters
  const filters = ref({
    // Advanced filters (hidden by default)
    family: 'All',
    tribe: 'All',
    genus: 'All',
    // Primary filters (always visible)
    species: 'All',
    subspecies: 'All',
    // Parallel filters
    mimicry: 'All',
    status: [],
  })

  // --- ACTIONS ---
  const loadMapData = async () => {
    loading.value = true
    try {
      const response = await fetch('./data/map_points.json')
      const data = await response.json()
      allFeatures.value = data

      // Initialize filters from URL
      restoreFiltersFromURL()
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      loading.value = false
    }
  }

  const restoreFiltersFromURL = () => {
    const params = new URLSearchParams(window.location.search)
    
    // Restore in cascade order (parents first)
    if (params.get('family')) {
      filters.value.family = params.get('family')
      showAdvancedFilters.value = true
    }
    if (params.get('tribe')) {
      filters.value.tribe = params.get('tribe')
      showAdvancedFilters.value = true
    }
    if (params.get('genus')) {
      filters.value.genus = params.get('genus')
      showAdvancedFilters.value = true
    }
    if (params.get('sp')) filters.value.species = params.get('sp')
    if (params.get('ssp')) filters.value.subspecies = params.get('ssp')
    if (params.get('mim')) {
      filters.value.mimicry = params.get('mim')
      showMimicryFilter.value = true
    }
    if (params.get('status')) {
      filters.value.status = params.get('status').split(',')
    }
  }

  const resetAllFilters = () => {
    filters.value = {
      family: 'All',
      tribe: 'All',
      genus: 'All',
      species: 'All',
      subspecies: 'All',
      mimicry: 'All',
      status: [],
    }
  }

  const toggleAdvancedFilters = () => {
    showAdvancedFilters.value = !showAdvancedFilters.value
    // Reset advanced filters when hiding
    if (!showAdvancedFilters.value) {
      filters.value.family = 'All'
      filters.value.tribe = 'All'
      filters.value.genus = 'All'
    }
  }

  const toggleMimicryFilter = () => {
    showMimicryFilter.value = !showMimicryFilter.value
    // Reset mimicry when hiding
    if (!showMimicryFilter.value) {
      filters.value.mimicry = 'All'
    }
  }

  // --- CASCADING COMPUTED PROPERTIES ---
  
  // Helper: filter data up to a certain level
  const getFilteredSubset = (upToLevel) => {
    let data = allFeatures.value

    if (upToLevel >= 1 && filters.value.family !== 'All') {
      data = data.filter(i => i.family === filters.value.family)
    }
    if (upToLevel >= 2 && filters.value.tribe !== 'All') {
      data = data.filter(i => i.tribe === filters.value.tribe)
    }
    if (upToLevel >= 3 && filters.value.genus !== 'All') {
      data = data.filter(i => i.genus === filters.value.genus)
    }
    if (upToLevel >= 4 && filters.value.species !== 'All') {
      data = data.filter(i => i.scientific_name === filters.value.species)
    }

    return data
  }

  // Unique values at each level (based on parent selections)
  const uniqueFamilies = computed(() => {
    const set = new Set(allFeatures.value.map(i => i.family).filter(Boolean))
    return Array.from(set).sort()
  })

  const uniqueTribes = computed(() => {
    const subset = getFilteredSubset(1) // After family filter
    const set = new Set(subset.map(i => i.tribe).filter(Boolean))
    return Array.from(set).sort()
  })

  const uniqueGenera = computed(() => {
    const subset = getFilteredSubset(2) // After tribe filter
    const set = new Set(subset.map(i => i.genus).filter(Boolean))
    return Array.from(set).sort()
  })

  const uniqueSpecies = computed(() => {
    const subset = getFilteredSubset(3) // After genus filter
    const set = new Set(subset.map(i => i.scientific_name).filter(Boolean))
    return Array.from(set).sort()
  })

  const uniqueSubspecies = computed(() => {
    const subset = getFilteredSubset(4) // After species filter
    const set = new Set(subset.map(i => i.subspecies).filter(Boolean))
    return Array.from(set).sort()
  })

  // Mimicry rings - always show ALL options (non-cascading)
  const uniqueMimicry = computed(() => {
    const set = new Set(allFeatures.value.map(i => i.mimicry_ring).filter(Boolean))
    return Array.from(set).sort()
  })

  // Unique sequencing statuses
  const uniqueStatuses = computed(() => {
    const set = new Set(allFeatures.value.map(i => i.sequencing_status).filter(Boolean))
    return Array.from(set).sort()
  })

  // --- CASCADE RESET WATCHERS ---
  // When parent changes, reset children to 'All'
  
  watch(() => filters.value.family, () => {
    filters.value.tribe = 'All'
    filters.value.genus = 'All'
    filters.value.species = 'All'
    filters.value.subspecies = 'All'
  })

  watch(() => filters.value.tribe, () => {
    filters.value.genus = 'All'
    filters.value.species = 'All'
    filters.value.subspecies = 'All'
  })

  watch(() => filters.value.genus, () => {
    filters.value.species = 'All'
    filters.value.subspecies = 'All'
  })

  watch(() => filters.value.species, () => {
    filters.value.subspecies = 'All'
  })

  // --- FINAL FILTERED DATA ---
  const filteredGeoJSON = computed(() => {
    if (!allFeatures.value.length) return null

    const filtered = allFeatures.value.filter(item => {
      // Taxonomic cascade
      if (filters.value.family !== 'All' && item.family !== filters.value.family) return false
      if (filters.value.tribe !== 'All' && item.tribe !== filters.value.tribe) return false
      if (filters.value.genus !== 'All' && item.genus !== filters.value.genus) return false
      if (filters.value.species !== 'All' && item.scientific_name !== filters.value.species) return false
      if (filters.value.subspecies !== 'All' && item.subspecies !== filters.value.subspecies) return false
      
      // Parallel filters
      if (filters.value.mimicry !== 'All' && item.mimicry_ring !== filters.value.mimicry) return false
      if (filters.value.status.length > 0 && !filters.value.status.includes(item.sequencing_status)) return false
      
      return true
    })

    return {
      type: 'FeatureCollection',
      features: filtered.map(item => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
        properties: item
      }))
    }
  })

  // --- URL SYNC WATCHER ---
  watch(
    filters,
    (newFilters) => {
      const params = new URLSearchParams()
      
      if (newFilters.family !== 'All') params.set('family', newFilters.family)
      if (newFilters.tribe !== 'All') params.set('tribe', newFilters.tribe)
      if (newFilters.genus !== 'All') params.set('genus', newFilters.genus)
      if (newFilters.species !== 'All') params.set('sp', newFilters.species)
      if (newFilters.subspecies !== 'All') params.set('ssp', newFilters.subspecies)
      if (newFilters.mimicry !== 'All') params.set('mim', newFilters.mimicry)
      if (newFilters.status.length > 0) params.set('status', newFilters.status.join(','))

      const newURL = params.toString() 
        ? `${window.location.pathname}?${params}` 
        : window.location.pathname
      window.history.replaceState({}, '', newURL)
    },
    { deep: true }
  )

  return {
    // State
    loading,
    allFeatures,
    filters,
    showAdvancedFilters,
    showMimicryFilter,
    
    // Actions
    loadMapData,
    resetAllFilters,
    toggleAdvancedFilters,
    toggleMimicryFilter,
    
    // Computed (cascading options)
    uniqueFamilies,
    uniqueTribes,
    uniqueGenera,
    uniqueSpecies,
    uniqueSubspecies,
    uniqueMimicry,
    uniqueStatuses,
    
    // Final output
    filteredGeoJSON,
  }
})
