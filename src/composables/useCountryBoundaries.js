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
    if (boundariesData) {
      console.log('[Borders] GeoJSON already cached, skipping fetch')
      return boundariesData
    }

    console.log('[Borders] Fetching GeoJSON from:', BOUNDARIES_URL)
    try {
      const response = await fetch(BOUNDARIES_URL)
      boundariesData = await response.json()
      console.log('[Borders] GeoJSON fetched successfully, features:', boundariesData?.features?.length)
      return boundariesData
    } catch (error) {
      console.error('[Borders] Failed to load country boundaries:', error)
      return null
    }
  }

  const addBoundariesLayer = async () => {
    console.log('[Borders] addBoundariesLayer called — showBoundaries:', showBoundaries.value, 'currentStyle:', currentStyle.value)
    console.log('[Borders]   map exists:', !!map.value, 'isStyleLoaded:', map.value?.isStyleLoaded?.())

    if (!map.value) {
      console.warn('[Borders]   EARLY RETURN: no map')
      return
    }

    // If toggling off, just remove
    if (!showBoundaries.value) {
      console.log('[Borders]   Toggling OFF — removing layers')
      removeLayerAndSource(map.value, 'country-boundaries-fill')
      removeLayerAndSource(map.value, 'country-boundaries-line', 'country-boundaries')
      return
    }

    // Load data BEFORE removing old layers to avoid a gap if load is slow
    console.log('[Borders]   Loading boundary data...')
    const data = await loadBoundaries()
    if (!data) {
      console.warn('[Borders]   EARLY RETURN: no data after load')
      return
    }

    // Verify map is still valid after async load
    console.log('[Borders]   Post-load check — map exists:', !!map.value, 'isStyleLoaded:', map.value?.isStyleLoaded?.())
    if (!map.value || !map.value.isStyleLoaded()) {
      console.warn('[Borders]   EARLY RETURN: map invalid after async load')
      return
    }

    // Atomic remove + add: no gap where borders are missing
    console.log('[Borders]   Removing old layers...')
    removeLayerAndSource(map.value, 'country-boundaries-fill')
    removeLayerAndSource(map.value, 'country-boundaries-line', 'country-boundaries')

    const borderStyle = getBorderStyle(currentStyle.value)
    const hasPointsLayer = !!map.value.getLayer('points-layer')
    const beforeLayer = hasPointsLayer ? 'points-layer' : undefined
    console.log('[Borders]   borderStyle:', borderStyle, 'hasPointsLayer:', hasPointsLayer, 'beforeLayer:', beforeLayer)

    try {
      map.value.addSource('country-boundaries', {
        type: 'geojson',
        data: data
      })
      console.log('[Borders]   Source added successfully')

      map.value.addLayer({
        id: 'country-boundaries-fill',
        type: 'fill',
        source: 'country-boundaries',
        paint: { 'fill-color': 'transparent', 'fill-opacity': 0 }
      }, beforeLayer)
      console.log('[Borders]   Fill layer added')

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
      console.log('[Borders]   Line layer added — BORDERS VISIBLE')

      // Verify layers actually exist on the map
      const allLayers = map.value.getStyle().layers.map(l => l.id)
      console.log('[Borders]   All map layers:', allLayers)
    } catch (err) {
      console.error('[Borders]   ERROR adding layers:', err)
    }
  }

  const toggleBoundaries = () => {
    showBoundaries.value = !showBoundaries.value
    console.log('[Borders] toggleBoundaries — now:', showBoundaries.value)
    addBoundariesLayer()
  }

  return {
    showBoundaries,
    toggleBoundaries,
    addBoundariesLayer
  }
}
