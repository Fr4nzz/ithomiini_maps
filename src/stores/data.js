import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useDataStore = defineStore('data', () => {
  // --- STATE ---
  const allFeatures = ref([]) // Store raw array, not GeoJSON yet
  const loading = ref(true)
  
  // The Active Filters
  const filters = ref({
    species: '',
    subspecies: '',
    country: '',
    mimicry: '',
    status: [], // Array for multiple selections
  })

  // --- ACTIONS ---
  const loadMapData = async () => {
    loading.value = true
    try {
      const response = await fetch('./data/map_points.json')
      const data = await response.json()
      // Store raw data for fast filtering
      allFeatures.value = data
      
      // Initialize URL filters if present (Deep Linking)
      const params = new URLSearchParams(window.location.search)
      if (params.get('sp')) filters.value.species = params.get('sp')
      if (params.get('mim')) filters.value.mimicry = params.get('mim')
      
    } catch (e) {
      console.error("Failed to load data:", e)
    } finally {
      loading.value = false
    }
  }

  // --- GETTERS (COMPUTED) ---

  // 1. Get Unique Values for Dropdowns (Dynamic)
  const uniqueSpecies = computed(() => {
    return [...new Set(allFeatures.value.map(i => i.scientific_name))].sort().filter(Boolean)
  })
  
  const uniqueMimicry = computed(() => {
    return [...new Set(allFeatures.value.map(i => i.mimicry_ring))].sort().filter(Boolean)
  })

  // 2. The Master Filter Logic
  const filteredGeoJSON = computed(() => {
    if (!allFeatures.value.length) return null

    const filtered = allFeatures.value.filter(item => {
      // Species Filter
      if (filters.value.species && item.scientific_name !== filters.value.species) return false
      
      // Mimicry Filter
      if (filters.value.mimicry && item.mimicry_ring !== filters.value.mimicry) return false
      
      // Status Filter (Multi-select)
      if (filters.value.status.length > 0 && !filters.value.status.includes(item.sequencing_status)) return false

      return true
    })

    // Return as GeoJSON for MapLibre
    return {
      type: 'FeatureCollection',
      features: filtered.map(item => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
        properties: item // Pass all properties to map
      }))
    }
  })

  // --- URL SYNC WATCHER ---
  watch(filters, (newFilters) => {
    const params = new URLSearchParams()
    if (newFilters.species) params.set('sp', newFilters.species)
    if (newFilters.mimicry) params.set('mim', newFilters.mimicry)
    
    // Update URL without reloading
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
  }, { deep: true })

  return { 
    loading, 
    filters, 
    uniqueSpecies, 
    uniqueMimicry,
    filteredGeoJSON, 
    loadMapData 
  }
})