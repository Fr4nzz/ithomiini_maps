/**
 * Composable for rendering SDM prediction rasters on the MapLibre map.
 * Uses sdmStore.selectedSpecies (independent from occurrence filter).
 *
 * - 1 species → single warm heatmap
 * - 2 species → dual overlay (warm + cool) for range comparison
 */
import { watch, computed, ref } from 'vue'
import { useSDMStore } from '../stores/sdm'
import { removeLayerAndSource } from '../utils/mapHelpers'
import { log } from '../utils/logger'

const SDM_LAYER_PREFIX = 'sdm-layer'
const SDM_SOURCE_PREFIX = 'sdm-source'

// Nodata in the GeoTIFFs is -9999. Values 0..1 are suitability.
// Minimum visible threshold: values below this are transparent.
const SUITABILITY_MIN = 0.05

const COLOR_RAMPS = {
  warm: (value, alpha) => {
    if (value < SUITABILITY_MIN || value <= -9990 || isNaN(value)) return [0, 0, 0, 0]
    const v = Math.min(1, Math.max(0, value))
    const a = Math.round(alpha * 255)
    // Low: pale yellow (visible!) → Mid: orange → High: deep red
    if (v < 0.3) {
      const t = (v - SUITABILITY_MIN) / (0.3 - SUITABILITY_MIN)
      return [255, Math.round(230 - 30 * t), Math.round(100 - 100 * t), Math.round(a * (0.3 + 0.7 * t))]
    } else if (v < 0.6) {
      const t = (v - 0.3) / 0.3
      return [255, Math.round(200 - 130 * t), 0, a]
    } else {
      const t = (v - 0.6) / 0.4
      return [Math.round(255 - 40 * t), Math.round(70 - 40 * t), 0, a]
    }
  },
  cool: (value, alpha) => {
    if (value < SUITABILITY_MIN || value <= -9990 || isNaN(value)) return [0, 0, 0, 0]
    const v = Math.min(1, Math.max(0, value))
    const a = Math.round(alpha * 255)
    // Low: pale cyan (visible!) → Mid: blue → High: deep purple
    if (v < 0.3) {
      const t = (v - SUITABILITY_MIN) / (0.3 - SUITABILITY_MIN)
      return [Math.round(100 - 100 * t), Math.round(220 - 40 * t), 255, Math.round(a * (0.3 + 0.7 * t))]
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
  const cursorValue = ref(null)
  const cursorPos = ref({ x: 0, y: 0 })
  const loadedRasters = new Map()

  const activeSpecies = computed(() => {
    if (!sdmStore.enabled || !sdmStore.hasData) return []
    return sdmStore.selectedSpecies.filter(sp => sdmStore.hasSDMForSpecies(sp)).slice(0, 2)
  })

  function removeAllLayers() {
    if (!map.value) return
    for (let i = 0; i < 2; i++) {
      try { removeLayerAndSource(map.value, `${SDM_LAYER_PREFIX}-${i}`, `${SDM_SOURCE_PREFIX}-${i}`) }
      catch { /* */ }
    }
  }

  async function loadAndRenderGeoTIFF(speciesName, index, colorRamp) {
    const layerId = `${SDM_LAYER_PREFIX}-${index}`
    const sourceId = `${SDM_SOURCE_PREFIX}-${index}`
    try { removeLayerAndSource(map.value, layerId, sourceId) } catch { /* */ }
    if (!map.value) return

    try {
      const GeoTIFF = await import('geotiff')
      const basePath = import.meta.env.BASE_URL || '/'
      const safeName = speciesName.replace(/ /g, '_').toLowerCase()
      const url = `${basePath}data/sdm/species/${safeName}_ensemble.tif`

      const response = await fetch(url)
      if (!response.ok) { log.map.warn(`SDM: Could not load ${url}`); return }

      const arrayBuffer = await response.arrayBuffer()
      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer)
      const image = await tiff.getImage()
      const data = await image.readRasters()
      const values = data[0]
      const width = image.getWidth()
      const height = image.getHeight()
      const origin = image.getOrigin()
      const resolution = image.getResolution()
      const bbox = [
        origin[0],
        origin[1] + resolution[1] * height,
        origin[0] + resolution[0] * width,
        origin[1],
      ]

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(width, height)

      for (let i = 0; i < values.length; i++) {
        const [r, g, b, a] = colorRamp(values[i], sdmStore.opacity)
        const idx = i * 4
        imageData.data[idx] = r
        imageData.data[idx + 1] = g
        imageData.data[idx + 2] = b
        imageData.data[idx + 3] = a
      }

      ctx.putImageData(imageData, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')

      loadedRasters.set(speciesName, { values, width, height, bbox })

      map.value.addSource(sourceId, {
        type: 'image', url: dataUrl,
        coordinates: [[bbox[0], bbox[3]], [bbox[2], bbox[3]], [bbox[2], bbox[1]], [bbox[0], bbox[1]]]
      })

      const beforeLayer = map.value.getLayer('points-layer') ? 'points-layer' : undefined
      map.value.addLayer({
        id: layerId, type: 'raster', source: sourceId,
        paint: { 'raster-opacity': 1, 'raster-fade-duration': 300 }
      }, beforeLayer)

      log.map.info(`SDM: Loaded ${speciesName} (${width}x${height})`)
    } catch (e) {
      log.map.error('SDM: Error loading GeoTIFF:', e)
    }
  }

  async function updateLayer() {
    removeAllLayers()
    const species = activeSpecies.value
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

  function getSuitabilityAt(lng, lat) {
    const species = activeSpecies.value
    if (species.length === 0) return null

    const results = []
    for (const sp of species) {
      const raster = loadedRasters.get(sp)
      if (!raster) continue

      const { values, width, height, bbox } = raster
      const col = Math.floor((lng - bbox[0]) / (bbox[2] - bbox[0]) * width)
      const row = Math.floor((bbox[3] - lat) / (bbox[3] - bbox[1]) * height)

      if (col < 0 || col >= width || row < 0 || row >= height) continue

      const val = values[row * width + col]
      if (val <= -9990 || isNaN(val) || val < SUITABILITY_MIN) continue
      results.push({ species: sp, value: val })
    }

    return results.length > 0 ? results : null
  }

  function onMouseMove(e) {
    if (activeSpecies.value.length === 0) { cursorValue.value = null; return }
    cursorValue.value = getSuitabilityAt(e.lngLat.lng, e.lngLat.lat)
    cursorPos.value = { x: e.point.x, y: e.point.y }
  }

  watch(activeSpecies, (species) => {
    updateLayer()
    if (map.value) {
      map.value.off('mousemove', onMouseMove)
      if (species.length > 0) map.value.on('mousemove', onMouseMove)
    }
  }, { deep: true })

  watch(() => sdmStore.enabled, (en) => {
    if (en) { updateLayer() }
    else {
      removeAllLayers()
      loadedRasters.clear()
      cursorValue.value = null
      if (map.value) map.value.off('mousemove', onMouseMove)
    }
  })
  watch(() => sdmStore.opacity, () => { if (activeSpecies.value.length > 0) updateLayer() })

  sdmStore.loadMetadata()

  return { removeAllLayers, updateLayer, cursorValue, cursorPos }
}
