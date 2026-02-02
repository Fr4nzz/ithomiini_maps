import { ref } from 'vue'
import { removeLayerAndSource } from '../utils/mapHelpers'
import { MAP_STYLES } from '../utils/mapStyles'

const BOUNDARIES_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

// Styles with light/white land where borders need to be dark
const DARK_BORDER_STYLES = new Set([
  'stadia-toner' // White land despite being a "night" theme
])

function getBorderStyle(styleKey) {
  const config = MAP_STYLES[styleKey]
  const needsDarkBorders = DARK_BORDER_STYLES.has(styleKey) ||
    (config && config.theme === 'day')
  const isToner = styleKey === 'stadia-toner'

  return {
    color: needsDarkBorders ? '#000000' : '#ffffff',
    widthMultiplier: isToner ? 2 : 1
  }
}

export function useCountryBoundaries(map, currentStyle) {
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
    if (!map.value) return

    // If toggling off, just remove
    if (!showBoundaries.value) {
      removeLayerAndSource(map.value, 'country-boundaries-fill')
      removeLayerAndSource(map.value, 'country-boundaries-line', 'country-boundaries')
      return
    }

    // Load data BEFORE removing old layers to avoid a gap if load is slow
    const data = await loadBoundaries()
    if (!data) return

    // Verify map is still valid after async load
    if (!map.value || !map.value.isStyleLoaded()) return

    // Atomic remove + add: no gap where borders are missing
    removeLayerAndSource(map.value, 'country-boundaries-fill')
    removeLayerAndSource(map.value, 'country-boundaries-line', 'country-boundaries')

    const borderStyle = getBorderStyle(currentStyle.value)
    const beforeLayer = map.value.getLayer('points-layer') ? 'points-layer' : undefined

    map.value.addSource('country-boundaries', {
      type: 'geojson',
      data: data
    })

    map.value.addLayer({
      id: 'country-boundaries-fill',
      type: 'fill',
      source: 'country-boundaries',
      paint: { 'fill-color': 'transparent', 'fill-opacity': 0 }
    }, beforeLayer)

    map.value.addLayer({
      id: 'country-boundaries-line',
      type: 'line',
      source: 'country-boundaries',
      paint: {
        'line-color': borderStyle.color,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          2, 0.5 * borderStyle.widthMultiplier,
          6, 1 * borderStyle.widthMultiplier,
          10, 1.5 * borderStyle.widthMultiplier
        ],
        'line-opacity': 0.5
      }
    }, beforeLayer)
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
