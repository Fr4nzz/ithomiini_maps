import { watch } from 'vue'
import { useHostPlantStore } from '../stores/hostPlants'
import { removeLayerAndSource } from '../utils/mapHelpers'
import { log } from '../utils/logger'
import { generateColoredShapeImage, getColoredShapeImageName } from '../utils/shapes'

const SOURCE_PREFIX = 'host-plant-source'
const LAYER_PREFIX = 'host-plant-layer'
const COLORS = ['#16a34a', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6']

export function useHostPlantLayer(map, options = {}) {
  const hostPlantStore = useHostPlantStore()
  const { onShowPopup } = options
  const layerHandlers = new Map()

  function layerId(slug) {
    return `${LAYER_PREFIX}-${slug}`
  }

  function sourceId(slug) {
    return `${SOURCE_PREFIX}-${slug}`
  }

  function triangleImageName(color) {
    return getColoredShapeImageName('triangle', color, '#ffffff', 2)
  }

  function ensureTriangleImage(color) {
    const imageName = triangleImageName(color)
    if (!map.value.hasImage(imageName)) {
      const imageData = generateColoredShapeImage('triangle', color, '#ffffff', 2, 64)
      map.value.addImage(imageName, imageData, { pixelRatio: 2 })
    }
    return imageName
  }

  function removeAllLayers() {
    if (!map.value) return
    for (const slug of hostPlantStore.selectedTaxonSlugs) {
      removeLayerHandlers(layerId(slug))
      try { removeLayerAndSource(map.value, layerId(slug), sourceId(slug)) }
      catch { /* layer may already be absent */ }
    }
    const style = map.value.getStyle?.()
    for (const layer of style?.layers || []) {
      if (layer.id.startsWith(LAYER_PREFIX)) {
        const slug = layer.id.replace(`${LAYER_PREFIX}-`, '')
        removeLayerHandlers(layer.id)
        try { removeLayerAndSource(map.value, layer.id, sourceId(slug)) }
        catch { /* layer may already be absent */ }
      }
    }
  }

  function removeLayerHandlers(lid) {
    const handlers = layerHandlers.get(lid)
    if (!handlers || !map.value) return
    map.value.off('click', lid, handlers.click)
    map.value.off('mouseenter', lid, handlers.mouseenter)
    map.value.off('mouseleave', lid, handlers.mouseleave)
    layerHandlers.delete(lid)
  }

  function registerLayerHandlers(lid, taxon) {
    if (!map.value) return
    removeLayerHandlers(lid)
    const handlers = {
      click: (event) => {
        if (!event.features || event.features.length === 0 || !onShowPopup) return
        const feature = event.features[0]
        const props = feature.properties || {}
        const coords = feature.geometry.coordinates.slice()
        onShowPopup({
          type: 'plant',
          coordinates: {
            lat: Number(props.decimalLatitude ?? coords[1]),
            lng: Number(props.decimalLongitude ?? coords[0]),
          },
          lngLat: coords,
          occurrence: props,
          taxon,
        })
      },
      mouseenter: () => {
        map.value.getCanvas().style.cursor = 'pointer'
      },
      mouseleave: () => {
        map.value.getCanvas().style.cursor = ''
      },
    }
    map.value.on('click', lid, handlers.click)
    map.value.on('mouseenter', lid, handlers.mouseenter)
    map.value.on('mouseleave', lid, handlers.mouseleave)
    layerHandlers.set(lid, handlers)
  }

  async function addTaxonLayer(taxon, index) {
    const collection = await hostPlantStore.loadOccurrences(taxon.slug)
    if (!collection || !map.value) return

    const sid = sourceId(taxon.slug)
    const lid = layerId(taxon.slug)
    try { removeLayerAndSource(map.value, lid, sid) } catch { /* */ }

    map.value.addSource(sid, { type: 'geojson', data: collection })
    const beforeLayer = map.value.getLayer('points-layer') ? 'points-layer' : undefined
    const color = COLORS[index % COLORS.length]
    map.value.addLayer({
      id: lid,
      type: 'symbol',
      source: sid,
      layout: {
        'icon-image': ensureTriangleImage(color),
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          2, 0.18,
          8, 0.34,
          12, 0.5,
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-opacity': hostPlantStore.opacity,
      },
    }, beforeLayer)
    registerLayerHandlers(lid, taxon)
  }

  async function updateLayer() {
    if (!map.value) return
    removeAllLayers()
    if (!hostPlantStore.enabled) return
    const taxa = hostPlantStore.activeTaxa.filter(taxon => taxon.occurrence_count > 0)
    await Promise.all(taxa.map((taxon, index) => addTaxonLayer(taxon, index)))
  }

  watch(
    () => [hostPlantStore.enabled, hostPlantStore.selectedTaxonSlugs.slice().join('|')],
    () => { updateLayer().catch(error => log.map.error('Host plants: layer update failed', error)) }
  )

  watch(
    () => hostPlantStore.opacity,
    () => {
      if (!map.value) return
      for (const taxon of hostPlantStore.activeTaxa) {
        const id = layerId(taxon.slug)
        if (map.value.getLayer(id)) {
          map.value.setPaintProperty(id, 'icon-opacity', hostPlantStore.opacity)
        }
      }
    }
  )

  hostPlantStore.loadMetadata().catch(() => {})

  return { updateLayer, removeAllLayers }
}
