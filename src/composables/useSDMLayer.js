/**
 * Composable for rendering SDM prediction rasters on the MapLibre map.
 * Reacts to the species filter in the data store.
 *
 * - 1 species selected → single-color heatmap (warm ramp)
 * - 2 species selected → dual-color overlay (red + blue, overlap = purple)
 * - 0 or 3+ species → no SDM layer
 */
import { watch, computed } from 'vue'
import { useSDMStore } from '../stores/sdm'
import { useDataStore } from '../stores/data'
import { removeLayerAndSource } from '../utils/mapHelpers'
import { log } from '../utils/logger'

const SDM_LAYER_PREFIX = 'sdm-layer'
const SDM_SOURCE_PREFIX = 'sdm-source'

// Two distinct color ramps for dual-species overlay
const COLOR_RAMPS = {
  // Species 1: warm (yellow → orange → red)
  warm: (value, alpha) => {
    if (value <= 0 || isNaN(value)) return [0, 0, 0, 0]
    const v = Math.min(1, Math.max(0, value))
    const a = Math.round(alpha * 255)
    if (v < 0.3) {
      const t = v / 0.3
      return [Math.round(255 * t), Math.round(200 * t), 0, Math.round(a * t)]
    } else if (v < 0.6) {
      const t = (v - 0.3) / 0.3
      return [255, Math.round(200 - 130 * t), 0, a]
    } else {
      const t = (v - 0.6) / 0.4
      return [Math.round(255 - 40 * t), Math.round(70 - 40 * t), 0, a]
    }
  },
  // Species 2: cool (cyan → blue → purple)
  cool: (value, alpha) => {
    if (value <= 0 || isNaN(value)) return [0, 0, 0, 0]
    const v = Math.min(1, Math.max(0, value))
    const a = Math.round(alpha * 255)
    if (v < 0.3) {
      const t = v / 0.3
      return [0, Math.round(180 * t), Math.round(255 * t), Math.round(a * t)]
    } else if (v < 0.6) {
      const t = (v - 0.3) / 0.3
      return [Math.round(80 * t), Math.round(180 - 100 * t), 255, a]
    } else {
      const t = (v - 0.6) / 0.4
      return [Math.round(80 + 80 * t), Math.round(80 - 50 * t), Math.round(255 - 30 * t), a]
    }
  },
}

export function useSDMLayer(map) {
  const sdmStore = useSDMStore()
  const dataStore = useDataStore()

  // Which species have their SDM visible
  const sdmSpecies = computed(() => {
    if (!sdmStore.enabled || !sdmStore.hasData) return []
    const filtered = dataStore.filters.species
    if (filtered.length === 0 || filtered.length > 2) return []
    return filtered.filter(sp => sdmStore.hasSDMForSpecies(sp))
  })

  function removeAllLayers() {
    if (!map.value) return
    for (let i = 0; i < 2; i++) {
      try {
        removeLayerAndSource(map.value, `${SDM_LAYER_PREFIX}-${i}`, `${SDM_SOURCE_PREFIX}-${i}`)
      } catch { /* may not exist */ }
    }
  }

  async function loadAndRenderGeoTIFF(speciesName, index, colorRamp) {
    const layerId = `${SDM_LAYER_PREFIX}-${index}`
    const sourceId = `${SDM_SOURCE_PREFIX}-${index}`

    try {
      removeLayerAndSource(map.value, layerId, sourceId)
    } catch { /* */ }

    if (!map.value) return

    try {
      const GeoTIFF = await import('geotiff')
      const basePath = import.meta.env.BASE_URL || '/'
      const safeName = speciesName.replace(/ /g, '_').toLowerCase()
      const url = `${basePath}data/sdm/species/${safeName}_ensemble.tif`

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
      const bbox = image.getBoundingBox()

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(width, height)

      for (let i = 0; i < values.length; i++) {
        const val = values[i]
        const [r, g, b, a] = colorRamp(val, sdmStore.opacity)
        const idx = i * 4
        imageData.data[idx] = r
        imageData.data[idx + 1] = g
        imageData.data[idx + 2] = b
        imageData.data[idx + 3] = a
      }

      ctx.putImageData(imageData, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')

      map.value.addSource(sourceId, {
        type: 'image',
        url: dataUrl,
        coordinates: [
          [bbox[0], bbox[3]], [bbox[2], bbox[3]],
          [bbox[2], bbox[1]], [bbox[0], bbox[1]],
        ]
      })

      const beforeLayer = map.value.getLayer('points-layer') ? 'points-layer' : undefined

      map.value.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': 1, 'raster-fade-duration': 300 }
      }, beforeLayer)

      log.map.info(`SDM: Loaded ${speciesName} (${width}x${height})`)
    } catch (e) {
      log.map.error('SDM: Error loading GeoTIFF:', e)
    }
  }

  async function updateLayer() {
    removeAllLayers()

    const species = sdmSpecies.value
    if (species.length === 0) return

    if (species.length === 1) {
      await loadAndRenderGeoTIFF(species[0], 0, COLOR_RAMPS.warm)
    } else if (species.length === 2) {
      await Promise.all([
        loadAndRenderGeoTIFF(species[0], 0, COLOR_RAMPS.warm),
        loadAndRenderGeoTIFF(species[1], 1, COLOR_RAMPS.cool),
      ])
    }
  }

  // Watch species filter changes
  watch(sdmSpecies, updateLayer, { deep: true })
  watch(() => sdmStore.enabled, (enabled) => {
    if (enabled) updateLayer()
    else removeAllLayers()
  })
  watch(() => sdmStore.opacity, () => {
    // Re-render with new opacity (need to recreate canvas)
    if (sdmSpecies.value.length > 0) updateLayer()
  })

  // Load metadata on init
  sdmStore.loadMetadata()

  return { removeAllLayers, updateLayer }
}
