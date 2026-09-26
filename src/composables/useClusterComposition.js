import { useDataStore } from '../stores/data'
import { useLegendStore } from '../stores/legend'
import { readClusterLeaves } from '../utils/clusterLeaves'
import { clusterComposition, drawCompositionRing } from '../utils/clusterComposition'

const SOURCE = 'cluster-composition-source'
const LAYER = 'cluster-composition-rings'

/** MapLibre symbol images stay in map screenshots and exports. */
export function useClusterComposition(map) {
  const store = useDataStore()
  const legend = useLegendStore()
  const memberCache = new Map()
  const imageBySignature = new Map()
  const registeredImages = new Set()
  let generation = 0
  let lastKey = ''
  let lastPointSource = null
  let lastStyleKey = ''
  let pendingKey = ''
  let attached = false
  let disposed = false

  function removeImages(m, keep = new Set()) {
    for (const name of registeredImages) {
      if (keep.has(name)) continue
      if (m.hasImage(name)) {
        try { m.removeImage(name) } catch { /* Style may have changed. */ }
      }
      registeredImages.delete(name)
    }
  }

  function clear() {
    const m = map.value
    if (!m) return
    if (pendingKey) generation++
    if (m.getLayer(LAYER)) m.removeLayer(LAYER)
    if (m.getSource(SOURCE)) m.removeSource(SOURCE)
    removeImages(m)
    lastKey = ''
    pendingKey = ''
  }

  function invalidate() {
    generation++
    lastKey = ''
    pendingKey = ''
    lastPointSource = null
    memberCache.clear()
    imageBySignature.clear()
  }

  function colorSettings() {
    return {
      colorBy: store.colorBy,
      colorAttribute: store.colorByAttribute,
      activeColorMap: store.activeColorMap,
      speciesColorMap: store.speciesColorMap,
      collapsedSpecies: store.colorBy === 'subspecies' ? legend.collapsedSpecies : [],
      shownLabels: legend.shownLabels,
    }
  }

  function render(m, rings) {
    const usedImages = new Set()
    const features = rings.map(({ feature, composition }) => {
      const signature = JSON.stringify([feature.properties.point_count, composition.segments])
      let image = imageBySignature.get(signature)
      if (!image) {
        image = `cluster-ring-${generation}-${imageBySignature.size}`
        imageBySignature.set(signature, image)
      }
      if (!m.hasImage(image)) {
        m.addImage(image, drawCompositionRing(composition.segments, feature.properties.point_count), { pixelRatio: 2 })
      }
      registeredImages.add(image)
      usedImages.add(image)
      return {
        type: 'Feature',
        geometry: feature.geometry,
        properties: { image },
      }
    })

    const data = { type: 'FeatureCollection', features }
    const source = m.getSource(SOURCE)
    if (source) source.setData(data)
    else m.addSource(SOURCE, { type: 'geojson', data })
    if (!m.getLayer(LAYER)) m.addLayer({
      id: LAYER,
      type: 'symbol',
      source: SOURCE,
      layout: {
        'icon-image': ['get', 'image'],
        'icon-padding': 0,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        'icon-anchor': 'center',
      },
    })
    else m.moveLayer(LAYER)
    removeImages(m, usedImages)
  }

  async function refresh() {
    const m = map.value
    if (disposed || !m?.isStyleLoaded()) return
    if (store.visualizationMode !== 'clusters' || store.clusterSettings.compositionRings === false ||
        !m.getLayer('clusters') || !m.getLayer('cluster-count')) {
      clear()
      return
    }
    const pointSource = m.getSource('points-source')
    if (!pointSource) return
    if (pointSource !== lastPointSource) {
      invalidate()
      lastPointSource = pointSource
    }

    const colors = colorSettings()
    const styleKey = JSON.stringify([
      colors.colorBy, colors.colorAttribute, colors.activeColorMap, colors.speciesColorMap,
      colors.collapsedSpecies, [...colors.shownLabels].sort(),
    ])
    if (styleKey !== lastStyleKey) {
      invalidate()
      lastPointSource = pointSource
      lastStyleKey = styleKey
    }

    const visible = m.queryRenderedFeatures({ layers: ['clusters'] })
    const clusters = [...new Map(visible
      .filter(feature => Number.isInteger(feature.properties.cluster_id) && feature.properties.point_count > 0)
      .map(feature => [feature.properties.cluster_id, feature])).values()]
    const key = `${generation}:${clusters.map(feature => `${feature.properties.cluster_id}/${feature.properties.point_count}`).sort().join(',')}`
    if (key === lastKey && (m.getLayer(LAYER) || pendingKey === key)) return
    lastKey = key
    pendingKey = key
    const epoch = generation
    const rings = new Array(clusters.length)
    let next = 0
    await Promise.all(Array.from({ length: Math.min(4, clusters.length) }, async () => {
      while (next < clusters.length) {
        const index = next++
        const feature = clusters[index]
        const memberKey = `${feature.properties.cluster_id}/${feature.properties.point_count}`
        let composition = memberCache.get(memberKey)
        if (!composition) {
          try {
            const members = await readClusterLeaves(pointSource, feature.properties.cluster_id, feature.properties.point_count)
            // A partial worker result must not produce a misleading ring.
            composition = members.length === feature.properties.point_count
              ? clusterComposition(members, colors)
              : null
          } catch { composition = null }
          if (epoch !== generation) return
          if (composition) memberCache.set(memberKey, composition)
        }
        if (composition) rings[index] = { feature, composition }
      }
    }))
    if (pendingKey === key) pendingKey = ''
    if (disposed || epoch !== generation || key !== lastKey ||
        store.visualizationMode !== 'clusters' || store.clusterSettings.compositionRings === false ||
        m.getSource('points-source') !== pointSource || !m.getLayer('clusters') || !m.getLayer('cluster-count')) return
    render(m, rings.filter(Boolean))
  }

  function attach() {
    if (attached || !map.value) return
    map.value.on('idle', refresh)
    attached = true
  }

  function cleanup() {
    disposed = true
    generation++
    if (attached) map.value?.off('idle', refresh)
    attached = false
    clear()
  }

  return { invalidate, attach, refresh, cleanup }
}
