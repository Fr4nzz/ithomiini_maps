import { useDataStore } from '../stores/data'
import { removeLayerAndSource, generateCirclePolygon } from '../utils/mapHelpers'

export function useScatterVisualization(map) {
  const store = useDataStore()

  const buildScatterVisualizationGeoJSON = () => {
    const data = store.scatterVisualizationData

    const circleFeatures = data.circles.map((circle, index) => ({
      type: 'Feature',
      properties: { id: `circle-${index}` },
      geometry: {
        type: 'Polygon',
        coordinates: [generateCirclePolygon(circle.center[0], circle.center[1], circle.radiusKm)]
      }
    }))

    return {
      circles: { type: 'FeatureCollection', features: circleFeatures }
    }
  }

  const updateScatterVisualization = () => {
    if (!map.value || !map.value.isStyleLoaded()) return

    const layerIds = ['scatter-circles-fill', 'scatter-circles-outline']
    const sourceIds = ['scatter-circles-source']

    layerIds.forEach(id => removeLayerAndSource(map.value, id))
    sourceIds.forEach(id => removeLayerAndSource(map.value, null, id))

    if (!store.scatterOverlappingPoints) return

    const geoJSON = buildScatterVisualizationGeoJSON()
    if (geoJSON.circles.features.length === 0) return

    map.value.addSource('scatter-circles-source', {
      type: 'geojson',
      data: geoJSON.circles
    })

    const beforeLayer = map.value.getLayer('points-layer') ? 'points-layer' : undefined

    map.value.addLayer({
      id: 'scatter-circles-fill',
      type: 'fill',
      source: 'scatter-circles-source',
      paint: { 'fill-color': 'rgba(59, 130, 246, 0.08)' }
    }, beforeLayer)

    map.value.addLayer({
      id: 'scatter-circles-outline',
      type: 'line',
      source: 'scatter-circles-source',
      paint: {
        'line-color': 'rgba(59, 130, 246, 0.3)',
        'line-width': 1.5,
        'line-dasharray': [4, 4]
      }
    }, beforeLayer)
  }

  return {
    updateScatterVisualization
  }
}
