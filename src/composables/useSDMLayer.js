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

  async function fetchTiffValues(url) {
    const response = await fetch(url)
    if (!response.ok) return null
    const GeoTIFF = await import('geotiff')
    const arrayBuffer = await response.arrayBuffer()
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    const data = await image.readRasters()
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
    return { values: data[0], width, height, bbox }
  }

  async function loadAndRenderGeoTIFF(speciesName, index, colorRamp) {
    const layerId = `${SDM_LAYER_PREFIX}-${index}`
    const sourceId = `${SDM_SOURCE_PREFIX}-${index}`
    try { removeLayerAndSource(map.value, layerId, sourceId) } catch { /* */ }
    if (!map.value) return

    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const safeName = speciesName.replace(/ /g, '_').toLowerCase()
      const coreUrl = `${basePath}data/sdm/species/${safeName}_ensemble_core.tif`
      const extUrl = `${basePath}data/sdm/species/${safeName}_ensemble_extension.tif`
      const fallbackUrl = `${basePath}data/sdm/species/${safeName}_ensemble.tif`

      // Try core/extension split first (new pipeline). Fall back to the
      // single full-ensemble raster if the split files aren't available
      // (legacy data, partial deploys).
      let coreData = await fetchTiffValues(coreUrl)
      let extData = sdmStore.showFullExtent ? await fetchTiffValues(extUrl) : null
      let usingSplit = !!coreData

      if (!usingSplit) {
        coreData = await fetchTiffValues(fallbackUrl)
        if (!coreData) { log.map.warn(`SDM: Could not load ${fallbackUrl}`); return }
      }

      const { width, height, bbox } = coreData
      // Merge core + extension into a single value buffer. Core wins where
      // it has data; extension fills the rest. Both rasters share the same
      // grid (they're co-registered by construction in step 5).
      const values = new Float32Array(coreData.values.length)
      for (let i = 0; i < values.length; i++) {
        const c = coreData.values[i]
        if (c > -9990 && !isNaN(c)) {
          values[i] = c
        } else if (extData) {
          const e = extData.values[i]
          values[i] = (e > -9990 && !isNaN(e)) ? e : -9999
        } else {
          values[i] = -9999
        }
      }

      // Reproject from equirectangular (EPSG:4326) to Web Mercator (EPSG:3857)
      // so the raster aligns with MapLibre's basemap. Without this, the canvas is
      // drawn as if each row is equal-height in lat — but Mercator stretches rows
      // more toward the poles. This causes a latitude-dependent shift.
      const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))
      const latToRow = (lat, topMerc, bottomMerc, h) =>
        ((topMerc - mercY(lat)) / (topMerc - bottomMerc)) * h

      const topMerc = mercY(bbox[3])
      const bottomMerc = mercY(bbox[1])
      const outHeight = height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = outHeight
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(width, outHeight)

      const latStep = (bbox[3] - bbox[1]) / height
      for (let outY = 0; outY < outHeight; outY++) {
        // Convert output canvas row (Mercator Y) back to latitude, then to source row
        const frac = outY / outHeight
        const mercVal = topMerc - frac * (topMerc - bottomMerc)
        const lat = (Math.atan(Math.sinh(mercVal)) * 180) / Math.PI
        const srcY = Math.min(height - 1, Math.max(0, Math.floor((bbox[3] - lat) / latStep)))

        for (let x = 0; x < width; x++) {
          const srcIdx = srcY * width + x
          const [r, g, b, a] = colorRamp(values[srcIdx], sdmStore.opacity)
          const dstIdx = (outY * width + x) * 4
          imageData.data[dstIdx] = r
          imageData.data[dstIdx + 1] = g
          imageData.data[dstIdx + 2] = b
          imageData.data[dstIdx + 3] = a
        }
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
  watch(() => sdmStore.showFullExtent, () => { if (activeSpecies.value.length > 0) updateLayer() })

  sdmStore.loadMetadata()

  return { removeAllLayers, updateLayer, cursorValue, cursorPos }
}
