import { ref } from 'vue'
import { removeLayerAndSource } from '../utils/mapHelpers'

const BOUNDARIES_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

export function useCountryBoundaries(map) {
  const showBoundaries = ref(false)
  let boundariesData = null

  const loadBoundaries = async () => {
    if (boundariesData) return boundariesData

    try {
      const response = await fetch(BOUNDARIES_URL)
      boundariesData = await response.json()
      return boundariesData
    } catch (error) {
      console.error('Failed to load country boundaries:', error)
      return null
    }
  }

  const addBoundariesLayer = async () => {
    if (!map.value || !map.value.isStyleLoaded()) return

    removeLayerAndSource(map.value, 'country-boundaries-fill')
    removeLayerAndSource(map.value, 'country-boundaries-line', 'country-boundaries')

    if (!showBoundaries.value) return

    const data = await loadBoundaries()
    if (!data) return

    map.value.addSource('country-boundaries', {
      type: 'geojson',
      data: data
    })

    map.value.addLayer({
      id: 'country-boundaries-fill',
      type: 'fill',
      source: 'country-boundaries',
      paint: { 'fill-color': 'transparent', 'fill-opacity': 0 }
    }, 'points-layer')

    map.value.addLayer({
      id: 'country-boundaries-line',
      type: 'line',
      source: 'country-boundaries',
      paint: {
        'line-color': '#ffffff',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          2, 0.5,
          6, 1,
          10, 1.5
        ],
        'line-opacity': 0.5
      }
    }, 'points-layer')
  }

  const toggleBoundaries = () => {
    showBoundaries.value = !showBoundaries.value
    addBoundariesLayer()
  }

  return {
    showBoundaries,
    toggleBoundaries,
    addBoundariesLayer
  }
}
