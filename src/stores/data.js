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

  // UI preferences
  const showThumbnail = ref(true)

  // The Active Filters
  // NOTE: species is now an ARRAY for multi-select (like Wings Gallery)
  const filters = ref({
    // Advanced filters (hidden by default)
    family: 'All',
    tribe: 'All',
    genus: 'All',
    // Primary filters (multi-select arrays)
    species: [],        // Array for multi-select
    subspecies: [],     // Array for multi-select
    // Parallel filters
    mimicry: 'All',
    status: [],
    source: ['Sanger Institute'],  // Multi-select array, default to Sanger
    // Search
    camidSearch: '',
    // Date range
    dateStart: null,
    dateEnd: null,
  })

  // Photo lookup cache: { 'Genus species subspecies': image_url }
  const photoLookup = ref({})

  // Mimicry ring photo lookup: { 'RingName': { representatives: [...], currentIndex: 0 } }
  const mimicryPhotoLookup = ref({})

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
      
      // Build photo lookup table
      buildPhotoLookup(data)

      // Build mimicry ring photo lookup
      buildMimicryPhotoLookup(data)

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

  /**
   * Build photo lookup table for finding photos by species/subspecies
   * Used when an individual doesn't have a photo but another individual
   * of the same species does.
   */
  const buildPhotoLookup = (data) => {
    const lookup = {}
    
    for (const item of data) {
      if (!item.image_url) continue
      
      // Key: "genus species subspecies" (lowercase for matching)
      const subspeciesKey = `${item.scientific_name || ''} ${item.subspecies || ''}`.toLowerCase().trim()
      const speciesKey = (item.scientific_name || '').toLowerCase().trim()
      
      // Prioritize subspecies match, then species match
      if (subspeciesKey && !lookup[subspeciesKey]) {
        lookup[subspeciesKey] = {
          url: item.image_url,
          id: item.id,
          exact: false
        }
      }
      if (speciesKey && !lookup[speciesKey]) {
        lookup[speciesKey] = {
          url: item.image_url,
          id: item.id,
          exact: false
        }
      }
    }
    
    photoLookup.value = lookup
    console.log(`Built photo lookup with ${Object.keys(lookup).length} entries`)
  }

  /**
   * Build mimicry ring photo lookup for the visual selector
   * Groups individuals by mimicry ring, prioritizing Sanger photos then GBIF
   */
  const buildMimicryPhotoLookup = (data) => {
    const lookup = {}

    // First pass: collect all individuals with photos by mimicry ring
    for (const item of data) {
      const ring = item.mimicry_ring
      if (!ring || ring === 'Unknown' || !item.image_url) continue

      if (!lookup[ring]) {
        lookup[ring] = {
          representatives: [],
          currentIndex: 0
        }
      }

      // Add this individual as a potential representative
      lookup[ring].representatives.push({
        scientific_name: item.scientific_name,
        subspecies: item.subspecies,
        image_url: item.image_url,
        source: item.source,
        id: item.id
      })
    }

    // Second pass: sort representatives - Sanger first, then GBIF, dedupe by subspecies
    for (const ring of Object.keys(lookup)) {
      const reps = lookup[ring].representatives

      // Sort: Sanger Institute first, then by species name
      reps.sort((a, b) => {
        if (a.source === 'Sanger Institute' && b.source !== 'Sanger Institute') return -1
        if (a.source !== 'Sanger Institute' && b.source === 'Sanger Institute') return 1
        const nameA = `${a.scientific_name} ${a.subspecies || ''}`
        const nameB = `${b.scientific_name} ${b.subspecies || ''}`
        return nameA.localeCompare(nameB)
      })

      // Dedupe by subspecies (keep first = best source)
      const seen = new Set()
      lookup[ring].representatives = reps.filter(rep => {
        const key = `${rep.scientific_name}|${rep.subspecies || ''}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    mimicryPhotoLookup.value = lookup
    console.log(`Built mimicry photo lookup for ${Object.keys(lookup).length} rings`)
  }

  /**
   * Get photo for an item. Returns object with url and whether it's the same individual.
   */
  const getPhotoForItem = (item) => {
    // If item has its own photo
    if (item.image_url) {
      return { url: item.image_url, sameIndividual: true }
    }
    
    // Try subspecies match first
    const subspeciesKey = `${item.scientific_name || ''} ${item.subspecies || ''}`.toLowerCase().trim()
    if (subspeciesKey && photoLookup.value[subspeciesKey]) {
      return { 
        url: photoLookup.value[subspeciesKey].url, 
        sameIndividual: false,
        fromId: photoLookup.value[subspeciesKey].id
      }
    }
    
    // Try species match
    const speciesKey = (item.scientific_name || '').toLowerCase().trim()
    if (speciesKey && photoLookup.value[speciesKey]) {
      return { 
        url: photoLookup.value[speciesKey].url, 
        sameIndividual: false,
        fromId: photoLookup.value[speciesKey].id
      }
    }
    
    return null
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
    // Species as array
    if (params.get('sp')) {
      filters.value.species = params.get('sp').split(',')
    }
    // Subspecies as array
    if (params.get('ssp')) {
      filters.value.subspecies = params.get('ssp').split(',')
    }
    if (params.get('mim')) {
      filters.value.mimicry = params.get('mim')
      showMimicryFilter.value = true
    }
    if (params.get('status')) {
      filters.value.status = params.get('status').split(',')
    }
    if (params.get('source')) {
      filters.value.source = params.get('source').split(',')
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
      species: [],
      subspecies: [],
      mimicry: 'All',
      status: [],
      source: ['Sanger Institute'],  // Default to Sanger
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
    // Level 4: species (now array-based)
    if (upToLevel >= 4 && filters.value.species.length > 0) {
      data = data.filter(i => filters.value.species.includes(i.scientific_name))
    }

    return data
  }

  // Helper: clean and validate field values
  const isValidValue = (val) => {
    if (!val) return false
    if (typeof val !== 'string') return false
    const cleaned = val.trim().toLowerCase()
    return cleaned && 
           cleaned !== 'unknown' && 
           cleaned !== 'na' && 
           cleaned !== 'nan' &&
           cleaned !== 'null' &&
           cleaned !== 'none'
  }

  // Unique values at each level (based on parent selections)
  const uniqueFamilies = computed(() => {
    const set = new Set(
      allFeatures.value
        .map(i => i.family)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  const uniqueTribes = computed(() => {
    const subset = getFilteredSubset(1) // After family filter
    const set = new Set(
      subset
        .map(i => i.tribe)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  const uniqueGenera = computed(() => {
    const subset = getFilteredSubset(2) // After tribe filter
    const set = new Set(
      subset
        .map(i => i.genus)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  const uniqueSpecies = computed(() => {
    const subset = getFilteredSubset(3) // After genus filter
    const set = new Set(
      subset
        .map(i => i.scientific_name)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  const uniqueSubspecies = computed(() => {
    const subset = getFilteredSubset(4) // After species filter
    const set = new Set(
      subset
        .map(i => i.subspecies)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  // Mimicry rings - always show ALL options (non-cascading)
  const uniqueMimicry = computed(() => {
    const set = new Set(
      allFeatures.value
        .map(i => i.mimicry_ring)
        .filter(v => v && v !== 'Unknown' && isValidValue(v))
    )
    return Array.from(set).sort()
  })

  // Available mimicry rings based on current taxonomy filter (species/genus)
  // These are rings that would return results if selected
  const availableMimicryRings = computed(() => {
    // Get data filtered by taxonomy only (not mimicry or source)
    let data = allFeatures.value

    if (filters.value.family !== 'All') {
      data = data.filter(i => i.family === filters.value.family)
    }
    if (filters.value.tribe !== 'All') {
      data = data.filter(i => i.tribe === filters.value.tribe)
    }
    if (filters.value.genus !== 'All') {
      data = data.filter(i => i.genus === filters.value.genus)
    }
    if (filters.value.species.length > 0) {
      data = data.filter(i => filters.value.species.includes(i.scientific_name))
    }
    if (filters.value.subspecies.length > 0) {
      data = data.filter(i => filters.value.subspecies.includes(i.subspecies))
    }

    const set = new Set(
      data
        .map(i => i.mimicry_ring)
        .filter(v => v && v !== 'Unknown' && isValidValue(v))
    )
    return Array.from(set).sort()
  })

  // Unavailable mimicry rings - rings that exist but would return no results
  const unavailableMimicryRings = computed(() => {
    const available = new Set(availableMimicryRings.value)
    return uniqueMimicry.value.filter(ring => !available.has(ring))
  })

  // Unique sequencing statuses
  const uniqueStatuses = computed(() => {
    const set = new Set(
      allFeatures.value
        .map(i => i.sequencing_status)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  // Unique data sources
  const uniqueSources = computed(() => {
    const set = new Set(
      allFeatures.value
        .map(i => i.source)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCADE RESET WATCHERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  watch(() => filters.value.family, () => {
    filters.value.tribe = 'All'
    filters.value.genus = 'All'
    filters.value.species = []
    filters.value.subspecies = []
  })

  watch(() => filters.value.tribe, () => {
    filters.value.genus = 'All'
    filters.value.species = []
    filters.value.subspecies = []
  })

  watch(() => filters.value.genus, () => {
    filters.value.species = []
    filters.value.subspecies = []
  })

  // When species changes, reset subspecies
  watch(() => filters.value.species, () => {
    filters.value.subspecies = []
  }, { deep: true })

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
      
      // Species filter (multi-select array)
      if (filters.value.species.length > 0 && !filters.value.species.includes(item.scientific_name)) return false
      
      // Subspecies filter (multi-select array)
      if (filters.value.subspecies.length > 0 && !filters.value.subspecies.includes(item.subspecies)) return false
      
      // Parallel filters
      if (filters.value.mimicry !== 'All' && item.mimicry_ring !== filters.value.mimicry) return false
      if (filters.value.status.length > 0 && !filters.value.status.includes(item.sequencing_status)) return false
      // Source filter (multi-select array)
      if (filters.value.source.length > 0 && !filters.value.source.includes(item.source)) return false
      
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
      // Species as comma-separated array
      if (newFilters.species.length > 0) params.set('sp', newFilters.species.join(','))
      // Subspecies as comma-separated array
      if (newFilters.subspecies.length > 0) params.set('ssp', newFilters.subspecies.join(','))
      if (newFilters.mimicry !== 'All') params.set('mim', newFilters.mimicry)
      if (newFilters.status.length > 0) params.set('status', newFilters.status.join(','))
      // Source as comma-separated array (only if not default)
      if (newFilters.source.length > 0 && !(newFilters.source.length === 1 && newFilters.source[0] === 'Sanger Institute')) {
        params.set('source', newFilters.source.join(','))
      }
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
    showThumbnail,
    photoLookup,
    mimicryPhotoLookup,

    // Actions
    loadMapData,
    resetAllFilters,
    toggleAdvancedFilters,
    toggleMimicryFilter,
    getPhotoForItem,

    // Computed (cascading options)
    uniqueFamilies,
    uniqueTribes,
    uniqueGenera,
    uniqueSpecies,
    uniqueSubspecies,
    uniqueMimicry,
    availableMimicryRings,
    unavailableMimicryRings,
    uniqueStatuses,
    uniqueSources,

    // Final output
    filteredGeoJSON,
  }
})
