import { ref } from 'vue'

export function useLocationSearch(map) {
  const searchQuery = ref('')
  const searchResults = ref([])
  const isSearching = ref(false)
  const showSearchResults = ref(false)
  const searchInputRef = ref(null)
  let searchDebounceTimer = null

  const searchLocation = async (query) => {
    if (!query || query.length < 2) {
      searchResults.value = []
      return
    }

    isSearching.value = true

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: query,
          format: 'json',
          limit: '8',
          addressdetails: '1'
        }),
        { headers: { 'Accept-Language': 'en' } }
      )

      if (response.ok) {
        const data = await response.json()
        searchResults.value = data.map(item => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          importance: item.importance,
          boundingbox: item.boundingbox
        }))
        showSearchResults.value = searchResults.value.length > 0
      }
    } catch (error) {
      console.error('Geocoding error:', error)
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }

  const onSearchInput = () => {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      searchLocation(searchQuery.value)
    }, 300)
  }

  const selectSearchResult = (result) => {
    if (!map.value) return

    showSearchResults.value = false
    searchQuery.value = ''

    if (result.boundingbox) {
      const [south, north, west, east] = result.boundingbox.map(parseFloat)
      map.value.fitBounds(
        [[west, south], [east, north]],
        { padding: 50, maxZoom: 14, duration: 1500 }
      )
    } else {
      map.value.flyTo({
        center: [result.lng, result.lat],
        zoom: 12,
        duration: 1500
      })
    }
  }

  const handleClickOutside = (event) => {
    if (searchInputRef.value && !searchInputRef.value.contains(event.target)) {
      showSearchResults.value = false
    }
  }

  const clearSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
    showSearchResults.value = false
  }

  const cleanup = () => {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }

  return {
    searchQuery,
    searchResults,
    isSearching,
    showSearchResults,
    searchInputRef,
    onSearchInput,
    selectSearchResult,
    handleClickOutside,
    clearSearch,
    cleanup
  }
}
