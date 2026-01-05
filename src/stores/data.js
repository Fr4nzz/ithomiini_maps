import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { parseDate } from '../utils/dateHelpers'
import { STATUS_COLORS, SOURCE_COLORS, DYNAMIC_COLORS } from '../utils/constants'

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

  // Focus point - when set, map should zoom to this point and show popup
  // { lat, lng, properties } - set to null after map handles it
  const focusPoint = ref(null)

  // Gallery selection - when set, gallery should open with this pre-selected
  // { species, subspecies, individualId } - set to null after gallery handles it
  const gallerySelection = ref(null)

  // Clustering settings
  const clusteringEnabled = ref(false)
  const clusterSettings = ref({
    radiusPixels: 80,  // Cluster radius in pixels (default 80px)
    countMode: 'subspecies',  // What clusters count: 'species', 'subspecies', 'individuals'
  })

  // Scatter overlapping points settings
  const scatterOverlappingPoints = ref(false)  // When enabled, evenly distributes overlapping points

  // Map styling settings
  const colorBy = ref('subspecies')  // What attribute to color points by: 'status', 'subspecies', 'species', 'genus', 'mimicry', 'source'

  const mapStyle = ref({
    pointSize: 8,           // Base point size in pixels
    borderWidth: 1.5,       // Point border width
    borderColor: '#ffffff', // Point border color
    fillOpacity: 0.85,      // Point fill opacity (0-1)
    borderOpacity: 0.6      // Point border opacity (0-1)
  })

  // Current basemap style (synced from MapEngine)
  const basemapStyle = ref('dark')  // 'dark', 'light', 'stadia-smooth', 'terrain', etc.

  const legendSettings = ref({
    position: 'bottom-left',  // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    textSize: 0.8,            // Font size multiplier
    showLegend: true,         // Whether to show legend
    maxItems: 15              // Max items before "more" indicator
  })

  // Export settings
  const exportSettings = ref({
    enabled: false,           // Whether export preview mode is active
    aspectRatio: '16:9',      // '16:9', '4:3', '1:1', '3:2', 'A4', 'custom'
    customWidth: 1920,
    customHeight: 1080,
    showCoordinates: true,    // Show export area coordinates
    includeLegend: true,
    includeScaleBar: true,
    uiScale: 1.0,             // Scale factor for UI elements in export (0.5 to 2.0)
    format: 'png',            // 'png' or 'jpg'
    dpi: 150                  // Export DPI multiplier (1x=100%, 1.5x=150%, 2x=200%, 3x=300%)
  })

  // Map view state (for URL sync)
  const mapView = ref({
    center: [-60, -5],        // [lng, lat]
    zoom: 4,
    bearing: 0,
    pitch: 0
  })

  // URL sharing settings
  const urlSettings = ref({
    includeFilters: true,     // Include taxonomy, mimicry, status filters
    includeMapView: false,    // Include center, zoom, bearing, pitch
    includeExportSettings: false,
    includeStyleSettings: false
  })

  // Custom color palettes for different colorBy modes
  const customColors = ref({
    // Users can customize these
  })

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
    mimicry: [],        // Array for multi-select mimicry rings
    status: [],
    source: ['Sanger Institute'],  // Multi-select array, default to Sanger
    sex: 'all',         // Sex filter: 'all', 'male', 'female'
    country: 'All',     // Country filter
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

  // GBIF citation data
  const gbifCitation = ref(null)

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
        throw new Error(`Failed to load data: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Validate data format
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format: expected array')
      }

      allFeatures.value = data
      console.log(`✓ Loaded ${data.length} records`)

      // Build photo lookup table
      buildPhotoLookup(data)

      // Build mimicry ring photo lookup
      buildMimicryPhotoLookup(data)

      // Load GBIF citation data
      loadGbifCitation()

      // Initialize filters from URL
      restoreFiltersFromURL()
    } catch (e) {
      console.error('❌ Failed to load data:', e)
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
   * Load GBIF citation data if available
   */
  const loadGbifCitation = async () => {
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/gbif_citation.json`)

      if (response.ok) {
        gbifCitation.value = await response.json()
        console.log('✓ Loaded GBIF citation data')
      }
    } catch (e) {
      // Citation file is optional, don't log error
      gbifCitation.value = null
    }
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
    if (params.get('country')) {
      filters.value.country = params.get('country')
    }
    if (params.get('sex')) {
      filters.value.sex = params.get('sex')
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
      mimicry: [],
      status: [],
      source: ['Sanger Institute'],  // Default to Sanger
      sex: 'all',
      country: 'All',
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

    // Always filter by source first (so dropdowns only show values from selected sources)
    if (filters.value.source.length > 0) {
      data = data.filter(i => filters.value.source.includes(i.source))
    }

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

  // Unique countries
  const uniqueCountries = computed(() => {
    const set = new Set(
      allFeatures.value
        .map(i => i.country)
        .filter(isValidValue)
    )
    return Array.from(set).sort()
  })

  // Unique CAMIDs for autocomplete (sorted for binary search potential)
  const uniqueCamids = computed(() => {
    return allFeatures.value
      .map(i => i.id)
      .filter(id => id && typeof id === 'string')
      .sort()
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
      // CAMID Search - supports multiple IDs separated by comma, space, or newline
      if (filters.value.camidSearch) {
        // Parse multiple CAMIDs from input (split by comma, space, newline)
        const searchTerms = filters.value.camidSearch
          .toUpperCase()
          .split(/[\s,\n]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0)

        if (searchTerms.length > 0) {
          const itemId = (item.id || '').toUpperCase()
          // Check if item ID matches ANY of the search terms (substring match)
          const matches = searchTerms.some(term => itemId.includes(term))
          if (!matches) return false
        }
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
      if (filters.value.mimicry.length > 0 && !filters.value.mimicry.includes(item.mimicry_ring)) return false
      if (filters.value.status.length > 0 && !filters.value.status.includes(item.sequencing_status)) return false
      // Source filter (multi-select array)
      if (filters.value.source.length > 0 && !filters.value.source.includes(item.source)) return false
      // Country filter
      if (filters.value.country !== 'All' && item.country !== filters.value.country) return false
      // Sex filter
      if (filters.value.sex !== 'all') {
        if (filters.value.sex === 'male' && item.sex !== 'male') return false
        if (filters.value.sex === 'female' && item.sex !== 'female') return false
      }

      // Date filtering
      if (filters.value.dateStart || filters.value.dateEnd) {
        const itemDateStr = item.observation_date || item.date || item.preservation_date
        const d = parseDate(itemDateStr)
        if (!d) return false // Exclude items without valid dates when filtering by date

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
  // COORDINATE GROUPING & SCATTER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all points at the same coordinates (within tolerance)
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} tolerance - Coordinate tolerance (default ~10m)
   * @returns {Array} Array of items at this location
   */
  const getPointsAtCoordinates = (lat, lng, tolerance = 0.0001) => {
    const geo = filteredGeoJSON.value
    if (!geo || !geo.features) return []

    return geo.features
      .filter(f => {
        const [fLng, fLat] = f.geometry.coordinates
        return Math.abs(fLat - lat) < tolerance && Math.abs(fLng - lng) < tolerance
      })
      .map(f => f.properties)
  }

  /**
   * Group points by species, then by subspecies
   * @param {Array} points - Array of point properties
   * @returns {Object} Grouped structure { speciesName: { count, subspecies: { subspName: { count, individuals: [] } } } }
   */
  const groupPointsBySpecies = (points) => {
    const groups = {}

    for (const point of points) {
      const species = point.scientific_name || 'Unknown'
      const subspecies = point.subspecies || 'No subspecies'

      if (!groups[species]) {
        groups[species] = { count: 0, subspecies: {} }
      }

      groups[species].count++

      if (!groups[species].subspecies[subspecies]) {
        groups[species].subspecies[subspecies] = { count: 0, individuals: [] }
      }

      groups[species].subspecies[subspecies].count++
      groups[species].subspecies[subspecies].individuals.push(point)
    }

    return groups
  }

  /**
   * Get species list prioritized by those with photos
   * @param {Array} points - Array of point properties
   * @returns {Array} Sorted species list with photo info
   */
  const getSpeciesWithPhotos = (points) => {
    const speciesMap = {}

    for (const point of points) {
      const species = point.scientific_name || 'Unknown'
      if (!speciesMap[species]) {
        speciesMap[species] = { species, hasPhoto: false, photoUrl: null, count: 0 }
      }
      speciesMap[species].count++
      if (point.image_url && !speciesMap[species].hasPhoto) {
        speciesMap[species].hasPhoto = true
        speciesMap[species].photoUrl = point.image_url
      }
    }

    // Sort: species with photos first, then by count
    return Object.values(speciesMap).sort((a, b) => {
      if (a.hasPhoto && !b.hasPhoto) return -1
      if (!a.hasPhoto && b.hasPhoto) return 1
      return b.count - a.count
    })
  }

  /**
   * Groups all points in filteredGeoJSON by their exact coordinates
   * @returns {Map} "lat,lng" -> array of point IDs at that location
   */
  const coordinateGroups = computed(() => {
    const groups = new Map()
    const geo = filteredGeoJSON.value
    if (!geo || !geo.features) return groups

    for (const feature of geo.features) {
      const [lng, lat] = feature.geometry.coordinates
      // Round to ~10m precision for grouping
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key).push(feature.properties)
    }

    // Only return groups with 2+ points
    const multiGroups = new Map()
    for (const [key, points] of groups) {
      if (points.length >= 2) {
        multiGroups.set(key, points)
      }
    }

    return multiGroups
  })

  /**
   * Calculate scattered positions for overlapping points using Fibonacci spiral
   * This distributes points evenly throughout the circle interior, not just on the perimeter
   * @param {number} radiusKm - Radius in kilometers (default 2km)
   */
  const calculateScatteredPosition = (originalLat, originalLng, index, totalPoints, radiusKm = 2) => {
    // Golden angle in radians: π * (3 - √5) ≈ 137.5 degrees
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    // Calculate angle and radius for this point using Fibonacci/sunflower spiral
    const angle = index * goldenAngle
    // Radius increases with sqrt to ensure even area distribution
    const radiusFraction = Math.sqrt(index / totalPoints)
    const pointRadius = radiusFraction * radiusKm

    // Convert km to degrees (approximate)
    const kmPerDegreeLat = 111.32
    const kmPerDegreeLng = 111.32 * Math.cos(originalLat * Math.PI / 180)

    const offsetLat = (pointRadius / kmPerDegreeLat) * Math.cos(angle)
    const offsetLng = (pointRadius / kmPerDegreeLng) * Math.sin(angle)

    return {
      lat: originalLat + offsetLat,
      lng: originalLng + offsetLng
    }
  }

  /**
   * Group points by subspecies at each coordinate location
   * Returns Map: "lat,lng" -> { subspeciesKey -> { representative, allPoints, species, subspecies } }
   */
  const subspeciesGroups = computed(() => {
    const groups = new Map()
    const geo = filteredGeoJSON.value
    if (!geo || !geo.features) return groups

    for (const feature of geo.features) {
      const [lng, lat] = feature.geometry.coordinates
      const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const props = feature.properties
      const species = props.scientific_name || 'Unknown'
      const subspecies = props.subspecies || 'No subspecies'
      const subspeciesKey = `${species}|${subspecies}`

      if (!groups.has(coordKey)) {
        groups.set(coordKey, new Map())
      }

      const locationGroup = groups.get(coordKey)

      if (!locationGroup.has(subspeciesKey)) {
        // First point of this subspecies - it becomes the representative
        locationGroup.set(subspeciesKey, {
          representative: props,
          allPoints: [props],
          species,
          subspecies
        })
      } else {
        // Add to existing subspecies group
        const subspGroup = locationGroup.get(subspeciesKey)
        subspGroup.allPoints.push(props)
        // Prefer representative with photo
        if (props.image_url && !subspGroup.representative.image_url) {
          subspGroup.representative = props
        }
      }
    }

    return groups
  })

  /**
   * Computed property for scattered positions - one per subspecies at each location
   * Returns Map: pointId -> { scatteredLat, scatteredLng, originalLat, originalLng, subspeciesKey }
   */
  const scatteredPositions = computed(() => {
    const positions = new Map()
    if (!scatterOverlappingPoints.value) return positions

    for (const [coordKey, subspeciesMap] of subspeciesGroups.value) {
      const [lat, lng] = coordKey.split(',').map(Number)
      const subspeciesList = Array.from(subspeciesMap.entries())
      const totalSubspecies = subspeciesList.length

      // Only scatter if there are multiple subspecies at this location
      if (totalSubspecies < 2) continue

      subspeciesList.forEach(([subspeciesKey, data], index) => {
        const scattered = calculateScatteredPosition(lat, lng, index, totalSubspecies)
        const representative = data.representative

        positions.set(representative.id, {
          scatteredLat: scattered.lat,
          scatteredLng: scattered.lng,
          originalLat: lat,
          originalLng: lng,
          subspeciesKey,
          species: data.species,
          subspecies: data.subspecies,
          isRepresentative: true
        })

        // Mark other points in this subspecies group as hidden (they share the representative's position)
        data.allPoints.forEach(point => {
          if (point.id !== representative.id) {
            positions.set(point.id, {
              scatteredLat: scattered.lat,
              scatteredLng: scattered.lng,
              originalLat: lat,
              originalLng: lng,
              subspeciesKey,
              species: data.species,
              subspecies: data.subspecies,
              isRepresentative: false,
              representativeId: representative.id
            })
          }
        })
      })
    }

    return positions
  })

  /**
   * Group points by species at each coordinate location (for species count mode)
   * Returns Map: "lat,lng" -> { speciesKey -> { representative, allPoints, species } }
   */
  const speciesGroups = computed(() => {
    const groups = new Map()
    const geo = filteredGeoJSON.value
    if (!geo || !geo.features) return groups

    for (const feature of geo.features) {
      const [lng, lat] = feature.geometry.coordinates
      const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const props = feature.properties
      const species = props.scientific_name || 'Unknown'

      if (!groups.has(coordKey)) {
        groups.set(coordKey, new Map())
      }

      const locationGroup = groups.get(coordKey)

      if (!locationGroup.has(species)) {
        // First point of this species - it becomes the representative
        locationGroup.set(species, {
          representative: props,
          allPoints: [props],
          species
        })
      } else {
        // Add to existing species group
        const speciesGroup = locationGroup.get(species)
        speciesGroup.allPoints.push(props)
        // Prefer representative with photo
        if (props.image_url && !speciesGroup.representative.image_url) {
          speciesGroup.representative = props
        }
      }
    }

    return groups
  })

  /**
   * The GeoJSON to display - handles scatter, clustering count modes, and aggregation
   * When scatter is enabled: shows one point per subspecies at each location with scattered coordinates
   * When clustering is enabled with species/subspecies count mode: aggregates to one point per taxon per location
   */
  const displayGeoJSON = computed(() => {
    const geo = filteredGeoJSON.value
    if (!geo) return geo

    // Scatter mode takes priority (includes subspecies aggregation with visual scatter)
    if (scatterOverlappingPoints.value) {
      const positions = scatteredPositions.value
      if (positions.size === 0) return geo

      // Filter and update coordinates for scattered points
      const features = []
      const seenRepresentatives = new Set()

      for (const feature of geo.features) {
        const pos = positions.get(feature.properties.id)

        if (pos) {
          // This point is in a scatter group
          if (pos.isRepresentative) {
            // Show representative points with scattered coordinates
            features.push({
              ...feature,
              geometry: {
                ...feature.geometry,
                coordinates: [pos.scatteredLng, pos.scatteredLat]
              },
              properties: {
                ...feature.properties,
                _originalLat: pos.originalLat,
                _originalLng: pos.originalLng,
                _isScattered: true,
                _subspeciesKey: pos.subspeciesKey,
                _scatteredSpecies: pos.species,
                _scatteredSubspecies: pos.subspecies
              }
            })
            seenRepresentatives.add(feature.properties.id)
          }
          // Non-representative points are hidden (not added to features)
        } else {
          // Point is not in a scatter group (single point or single subspecies at location)
          features.push(feature)
        }
      }

      return {
        type: 'FeatureCollection',
        features
      }
    }

    // Clustering mode with aggregation (when scatter is not enabled)
    if (clusteringEnabled.value) {
      const countMode = clusterSettings.value.countMode

      // For 'individuals' mode, use all points (default behavior)
      if (countMode === 'individuals') {
        return geo
      }

      // For 'subspecies' mode: aggregate to one point per subspecies per location
      if (countMode === 'subspecies') {
        const features = []
        const seenIds = new Set()

        for (const [coordKey, subspeciesMap] of subspeciesGroups.value) {
          const [lat, lng] = coordKey.split(',').map(Number)

          for (const [subspeciesKey, data] of subspeciesMap) {
            const rep = data.representative
            if (!seenIds.has(rep.id)) {
              seenIds.add(rep.id)
              // Find the original feature to maintain structure
              const origFeature = geo.features.find(f => f.properties.id === rep.id)
              if (origFeature) {
                features.push({
                  ...origFeature,
                  properties: {
                    ...origFeature.properties,
                    _aggregatedCount: data.allPoints.length,
                    _aggregationType: 'subspecies'
                  }
                })
              }
            }
          }
        }

        return {
          type: 'FeatureCollection',
          features
        }
      }

      // For 'species' mode: aggregate to one point per species per location
      if (countMode === 'species') {
        const features = []
        const seenIds = new Set()

        for (const [coordKey, speciesMap] of speciesGroups.value) {
          const [lat, lng] = coordKey.split(',').map(Number)

          for (const [speciesKey, data] of speciesMap) {
            const rep = data.representative
            if (!seenIds.has(rep.id)) {
              seenIds.add(rep.id)
              // Find the original feature to maintain structure
              const origFeature = geo.features.find(f => f.properties.id === rep.id)
              if (origFeature) {
                features.push({
                  ...origFeature,
                  properties: {
                    ...origFeature.properties,
                    _aggregatedCount: data.allPoints.length,
                    _aggregationType: 'species'
                  }
                })
              }
            }
          }
        }

        return {
          type: 'FeatureCollection',
          features
        }
      }
    }

    // Default: return filtered GeoJSON as-is
    return geo
  })

  /**
   * Data needed to draw scatter visualization (circle polygons)
   * Only shows circles for locations with multiple subspecies
   */
  const scatterVisualizationData = computed(() => {
    if (!scatterOverlappingPoints.value) {
      return { circles: [] }
    }

    const circles = []

    for (const [coordKey, subspeciesMap] of subspeciesGroups.value) {
      // Only add circle if there are multiple subspecies at this location
      if (subspeciesMap.size < 2) continue

      const [lat, lng] = coordKey.split(',').map(Number)

      circles.push({
        center: [lng, lat],
        radiusKm: 2
      })
    }

    return { circles }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC COLOR PALETTE GENERATOR
  // ═══════════════════════════════════════════════════════════════════════════

  // Predefined color palettes (using imported constants)
  const COLOR_PALETTES = {
    status: STATUS_COLORS,
    source: SOURCE_COLORS
  }

  // Generate colors for dynamic categories (using imported dynamic colors)
  const generateColorPalette = (values) => {
    const palette = {}
    values.forEach((val, idx) => {
      palette[val] = DYNAMIC_COLORS[idx % DYNAMIC_COLORS.length]
    })
    return palette
  }

  // Get the color map based on current colorBy setting
  // This now derives colors from DISPLAYED data only (for accurate legend)
  const activeColorMap = computed(() => {
    const mode = colorBy.value
    const attr = colorByAttribute.value
    const geo = displayGeoJSON.value

    // Check for custom colors first
    if (customColors.value[mode]) {
      return customColors.value[mode]
    }

    // Get unique values from DISPLAYED data only
    const displayedValues = geo?.features
      ? [...new Set(
          geo.features
            .map(f => f.properties[attr])
            .filter(v => v && v !== 'Unknown' && v !== 'NA' && v !== 'null')
        )].sort()
      : []

    // Use predefined palettes for status and source (filtered to displayed values)
    if (mode === 'status') {
      const filtered = {}
      for (const val of displayedValues) {
        if (COLOR_PALETTES.status[val]) {
          filtered[val] = COLOR_PALETTES.status[val]
        }
      }
      return Object.keys(filtered).length > 0 ? filtered : COLOR_PALETTES.status
    }
    if (mode === 'source') {
      const filtered = {}
      for (const val of displayedValues) {
        if (COLOR_PALETTES.source[val]) {
          filtered[val] = COLOR_PALETTES.source[val]
        }
      }
      return Object.keys(filtered).length > 0 ? filtered : COLOR_PALETTES.source
    }

    // Generate dynamic palette for taxonomy and mimicry using displayed values
    return generateColorPalette(displayedValues)
  })

  // Get the attribute key for the current colorBy mode
  const colorByAttribute = computed(() => {
    const mapping = {
      'status': 'sequencing_status',
      'subspecies': 'subspecies',
      'species': 'scientific_name',
      'genus': 'genus',
      'mimicry': 'mimicry_ring',
      'source': 'source'
    }
    return mapping[colorBy.value] || 'sequencing_status'
  })

  // Get legend title based on colorBy
  const legendTitle = computed(() => {
    const titles = {
      'status': 'Sequencing Status',
      'subspecies': 'Subspecies',
      'species': 'Species',
      'genus': 'Genus',
      'mimicry': 'Mimicry Ring',
      'source': 'Data Source'
    }
    return titles[colorBy.value] || 'Legend'
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
      if (newFilters.country !== 'All') params.set('country', newFilters.country)
      if (newFilters.sex !== 'all') params.set('sex', newFilters.sex)
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
    focusPoint,
    gallerySelection,
    clusteringEnabled,
    clusterSettings,
    scatterOverlappingPoints,
    photoLookup,
    mimicryPhotoLookup,
    gbifCitation,

    // Map styling state
    colorBy,
    mapStyle,
    basemapStyle,
    legendSettings,
    exportSettings,
    mapView,
    urlSettings,
    customColors,

    // Actions
    loadMapData,
    resetAllFilters,
    toggleAdvancedFilters,
    toggleMimicryFilter,
    getPhotoForItem,

    // Coordinate grouping helpers
    getPointsAtCoordinates,
    groupPointsBySpecies,
    getSpeciesWithPhotos,

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
    uniqueCountries,
    uniqueCamids,

    // Computed (color mapping)
    activeColorMap,
    colorByAttribute,
    legendTitle,

    // Final output
    filteredGeoJSON,
    displayGeoJSON,
    coordinateGroups,
    scatteredPositions,
    scatterVisualizationData,
  }
})
