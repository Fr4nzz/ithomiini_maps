import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useDataStore = defineStore('data', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
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
    source: 'All',
    // Search
    camidSearch: '',
    // Date range
    dateStart: null,
    dateEnd: null,
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const loadMapData = async () => {
    loading.value = true
    try {
      // Determine base path (handles both dev and GitHub Pages)
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/map_points.json`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      allFeatures.value = data
      console.log(`Loaded ${data.length} records`)

      // Initialize filters from URL
      restoreFiltersFromURL()
    } catch (e) {
      console.error('Failed to load data:', e)
      // Set empty array to prevent errors
      allFeatures.value = []
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
    if (params.get('source')) {
      filters.value.source = params.get('source')
    }
    if (params.get('cam')) {
      filters.value.camidSearch = params.get('cam')
    }
    // Date filters
    if (params.get('from')) {
      filters.value.dateStart = params.get('from')
    }
    if (params.get('to')) {
      filters.value.dateEnd = params.get('to')
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
      source: 'All',
      camidSearch: '',
      dateStart: null,
      dateEnd: null,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCADING COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════
  
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
    const set = new Set(
      allFeatures.value
        .map(i => i.mimicry_ring)
        .filter(v => v && v !== 'Unknown')
    )
    return Array.from(set).sort()
  })

  // Unique sequencing statuses
  const uniqueStatuses = computed(() => {
    const set = new Set(allFeatures.value.map(i => i.sequencing_status).filter(Boolean))
    return Array.from(set).sort()
  })

  // Unique data sources
  const uniqueSources = computed(() => {
    const set = new Set(allFeatures.value.map(i => i.source).filter(Boolean))
    return Array.from(set).sort()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCADE RESET WATCHERS
  // ═══════════════════════════════════════════════════════════════════════════
  
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

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL FILTERED DATA
  // ═══════════════════════════════════════════════════════════════════════════
  
  const filteredGeoJSON = computed(() => {
    if (!allFeatures.value.length) return null

    const filtered = allFeatures.value.filter(item => {
      // CAMID Search (takes priority - instant filter)
      if (filters.value.camidSearch) {
        const searchTerm = filters.value.camidSearch.toUpperCase()
        const itemId = (item.id || '').toUpperCase()
        if (!itemId.includes(searchTerm)) return false
      }

      // Taxonomic cascade
      if (filters.value.family !== 'All' && item.family !== filters.value.family) return false
      if (filters.value.tribe !== 'All' && item.tribe !== filters.value.tribe) return false
      if (filters.value.genus !== 'All' && item.genus !== filters.value.genus) return false
      if (filters.value.species !== 'All' && item.scientific_name !== filters.value.species) return false
      if (filters.value.subspecies !== 'All' && item.subspecies !== filters.value.subspecies) return false
      
      // Parallel filters
      if (filters.value.mimicry !== 'All' && item.mimicry_ring !== filters.value.mimicry) return false
      if (filters.value.status.length > 0 && !filters.value.status.includes(item.sequencing_status)) return false
      if (filters.value.source !== 'All' && item.source !== filters.value.source) return false
      
      // Date filtering
      if (filters.value.dateStart || filters.value.dateEnd) {
        const itemDate = item.date || item.preservation_date
        if (!itemDate) return false // Exclude items without dates when filtering by date
        
        const d = new Date(itemDate)
        if (filters.value.dateStart && d < new Date(filters.value.dateStart)) return false
        if (filters.value.dateEnd && d > new Date(filters.value.dateEnd)) return false
      }
      
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

  // ═══════════════════════════════════════════════════════════════════════════
  // URL SYNC WATCHER
  // ═══════════════════════════════════════════════════════════════════════════
  
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
      if (newFilters.source !== 'All') params.set('source', newFilters.source)
      if (newFilters.camidSearch) params.set('cam', newFilters.camidSearch)
      if (newFilters.dateStart) params.set('from', newFilters.dateStart)
      if (newFilters.dateEnd) params.set('to', newFilters.dateEnd)

      const newURL = params.toString() 
        ? `${window.location.pathname}?${params}` 
        : window.location.pathname
      window.history.replaceState({}, '', newURL)
    },
    { deep: true }
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  
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
    uniqueSources,
    
    // Final output
    filteredGeoJSON,
  }
})
