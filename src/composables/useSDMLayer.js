/**
 * Composable for rendering SDM prediction rasters on the MapLibre map.
 *
 * Strategy: SDM predictions are stored as small GeoTIFF files (~5km resolution).
 * We render them as raster image sources in MapLibre by converting the GeoTIFF
 * to a colored PNG canvas on the client side.
 *
 * Future upgrade: switch to PMTiles for production use.
 */
import { watch, ref } from 'vue'
import { useSDMStore } from '../stores/sdm'
import { removeLayerAndSource } from '../utils/mapHelpers'
import { log } from '../utils/logger'

const SDM_LAYER_ID = 'sdm-prediction-layer'
const SDM_SOURCE_ID = 'sdm-prediction-source'

// Color ramp for SDM suitability (0=transparent → 1=red)
// Using a warm color ramp: transparent → yellow → orange → red
function suitabilityToColor(value) {
  if (value <= 0 || isNaN(value)) return [0, 0, 0, 0]

  const v = Math.min(1, Math.max(0, value))

  // Low (0-0.3): transparent to light yellow
  // Medium (0.3-0.6): yellow to orange
  // High (0.6-1.0): orange to dark red

  let r, g, b, a
  if (v < 0.3) {
    const t = v / 0.3
    r = Math.round(255 * t)
    g = Math.round(255 * t)
    b = Math.round(50 * t)
    a = Math.round(180 * t)
  } else if (v < 0.6) {
    const t = (v - 0.3) / 0.3
    r = 255
    g = Math.round(255 - 130 * t)
    b = Math.round(50 - 50 * t)
    a = Math.round(180 + 50 * t)
  } else {
    const t = (v - 0.6) / 0.4
    r = Math.round(255 - 60 * t)
    g = Math.round(125 - 95 * t)
    b = Math.round(20 * t)
    a = Math.round(230 + 25 * t)
  }

  return [r, g, b, a]
}

// Color ramp for species richness (0=transparent → max=purple)
function richnessToColor(value, maxValue) {
  if (value <= 0 || isNaN(value)) return [0, 0, 0, 0]

  const v = Math.min(1, value / maxValue)

  // Viridis-inspired: dark purple → blue → green → yellow
  let r, g, b, a
  if (v < 0.25) {
    const t = v / 0.25
    r = Math.round(68 * t)
    g = Math.round(1 + 57 * t)
    b = Math.round(84 + 84 * t)
    a = Math.round(200 * t)
  } else if (v < 0.5) {
    const t = (v - 0.25) / 0.25
    r = Math.round(68 - 36 * t)
    g = Math.round(58 + 90 * t)
    b = Math.round(168 - 40 * t)
    a = Math.round(200 + 30 * t)
  } else if (v < 0.75) {
    const t = (v - 0.5) / 0.25
    r = Math.round(32 + 93 * t)
    g = Math.round(148 + 52 * t)
    b = Math.round(128 - 88 * t)
    a = Math.round(230 + 15 * t)
  } else {
    const t = (v - 0.75) / 0.25
    r = Math.round(125 + 128 * t)
    g = Math.round(200 + 53 * t)
    b = Math.round(40 - 35 * t)
    a = 245
  }

  return [r, g, b, a]
}

export function useSDMLayer(map) {
  const sdmStore = useSDMStore()
  const currentRasterUrl = ref(null)

  function removeLayers() {
    if (!map.value) return
    try {
      removeLayerAndSource(map.value, SDM_LAYER_ID, SDM_SOURCE_ID)
    } catch (e) {
      // Layer might not exist
    }
    currentRasterUrl.value = null
  }

  async function loadAndRenderGeoTIFF(url, colorFn) {
    removeLayers()

    if (!map.value || !url) return

    try {
      // Dynamically import GeoTIFF library
      const GeoTIFF = await import('geotiff')

      const response = await fetch(url)
      if (!response.ok) {
        log.map.warn(`SDM: Could not load ${url}`)
        return
      }

      const arrayBuffer = await response.arrayBuffer()
      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer)
      const image = await tiff.getImage()
      const data = await image.readRasters()
      const values = data[0]

      const width = image.getWidth()
      const height = image.getHeight()
      const bbox = image.getBoundingBox() // [west, south, east, north]

      // Create canvas with colored pixels
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(width, height)

      for (let i = 0; i < values.length; i++) {
        const val = values[i]
        const [r, g, b, a] = colorFn(val)
        const idx = i * 4
        imageData.data[idx] = r
        imageData.data[idx + 1] = g
        imageData.data[idx + 2] = b
        imageData.data[idx + 3] = Math.round(a * sdmStore.opacity)
      }

      ctx.putImageData(imageData, 0, 0)

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png')

      // Add as image source to MapLibre
      map.value.addSource(SDM_SOURCE_ID, {
        type: 'image',
        url: dataUrl,
        coordinates: [
          [bbox[0], bbox[3]], // top-left
          [bbox[2], bbox[3]], // top-right
          [bbox[2], bbox[1]], // bottom-right
          [bbox[0], bbox[1]], // bottom-left
        ]
      })

      // Insert below point layers
      const beforeLayer = map.value.getLayer('points-layer') ? 'points-layer' : undefined

      map.value.addLayer({
        id: SDM_LAYER_ID,
        type: 'raster',
        source: SDM_SOURCE_ID,
        paint: {
          'raster-opacity': sdmStore.opacity,
          'raster-fade-duration': 300,
        }
      }, beforeLayer)

      currentRasterUrl.value = url
      log.map.info(`SDM: Loaded ${url} (${width}x${height})`)

    } catch (e) {
      log.map.error('SDM: Error loading GeoTIFF:', e)
    }
  }

  async function updateLayer() {
    if (!sdmStore.enabled) {
      removeLayers()
      return
    }

    const basePath = import.meta.env.BASE_URL || '/'

    if (sdmStore.showRichness) {
      await loadAndRenderGeoTIFF(
        `${basePath}data/sdm/species_richness.tif`,
        (val) => richnessToColor(val, sdmStore.metadata?.n_species || 100)
      )
    } else if (sdmStore.selectedSpecies) {
      const species = sdmStore.speciesList.find(s => s.name === sdmStore.selectedSpecies)
      if (species) {
        const safeName = species.name.replace(/ /g, '_').toLowerCase()
        await loadAndRenderGeoTIFF(
          `${basePath}data/sdm/species/${safeName}_ensemble.tif`,
          suitabilityToColor
        )
      }
    } else {
      removeLayers()
    }
  }

  // Watch for changes
  watch(() => sdmStore.enabled, updateLayer)
  watch(() => sdmStore.selectedSpecies, updateLayer)
  watch(() => sdmStore.showRichness, updateLayer)
  watch(() => sdmStore.opacity, () => {
    if (map.value?.getLayer(SDM_LAYER_ID)) {
      map.value.setPaintProperty(SDM_LAYER_ID, 'raster-opacity', sdmStore.opacity)
    }
  })

  // Load metadata on init
  sdmStore.loadMetadata()

  return {
    removeLayers,
    updateLayer,
  }
}
