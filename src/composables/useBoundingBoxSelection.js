import { ref } from 'vue'
import { useDataStore } from '../stores/data'
import { removeLayerAndSource } from '../utils/mapHelpers'

export function useBoundingBoxSelection(map) {
  const store = useDataStore()
  const isDrawing = ref(false)

  const BBOX_SOURCE = 'bbox-selection-source'
  const BBOX_FILL = 'bbox-selection-fill'
  const BBOX_OUTLINE = 'bbox-selection-outline'

  const clearBboxVisualization = () => {
    if (!map.value) return
    removeLayerAndSource(map.value, BBOX_FILL)
    removeLayerAndSource(map.value, BBOX_OUTLINE, BBOX_SOURCE)
  }

  const updateBboxVisualization = (sw, ne) => {
    clearBboxVisualization()
    if (!map.value || !sw || !ne) return

    const polygon = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [sw.lng, sw.lat],
            [ne.lng, sw.lat],
            [ne.lng, ne.lat],
            [sw.lng, ne.lat],
            [sw.lng, sw.lat]
          ]]
        }
      }]
    }

    map.value.addSource(BBOX_SOURCE, { type: 'geojson', data: polygon })

    map.value.addLayer({
      id: BBOX_FILL,
      type: 'fill',
      source: BBOX_SOURCE,
      paint: {
        'fill-color': 'rgba(74, 222, 128, 0.1)',
        'fill-opacity': 1
      }
    })

    map.value.addLayer({
      id: BBOX_OUTLINE,
      type: 'line',
      source: BBOX_SOURCE,
      paint: {
        'line-color': 'rgba(74, 222, 128, 0.6)',
        'line-width': 2,
        'line-dasharray': [4, 4]
      }
    })
  }

  const enableDrawing = () => {
    if (!map.value) return
    isDrawing.value = true
    map.value.getCanvas().style.cursor = 'crosshair'
    map.value.dragPan.disable()

    let drawStart = null

    const onMouseDown = (e) => {
      drawStart = e.lngLat
    }

    const onMouseMove = (e) => {
      if (!drawStart) return
      const sw = {
        lng: Math.min(drawStart.lng, e.lngLat.lng),
        lat: Math.min(drawStart.lat, e.lngLat.lat)
      }
      const ne = {
        lng: Math.max(drawStart.lng, e.lngLat.lng),
        lat: Math.max(drawStart.lat, e.lngLat.lat)
      }
      updateBboxVisualization(sw, ne)
    }

    const onMouseUp = (e) => {
      if (!drawStart) return
      const sw = {
        lng: Math.min(drawStart.lng, e.lngLat.lng),
        lat: Math.min(drawStart.lat, e.lngLat.lat)
      }
      const ne = {
        lng: Math.max(drawStart.lng, e.lngLat.lng),
        lat: Math.max(drawStart.lat, e.lngLat.lat)
      }

      // Only apply if the box has meaningful size
      const lngDiff = Math.abs(ne.lng - sw.lng)
      const latDiff = Math.abs(ne.lat - sw.lat)
      if (lngDiff > 0.01 && latDiff > 0.01) {
        store.boundingBox = { sw, ne }
        updateBboxVisualization(sw, ne)
      } else {
        clearBboxVisualization()
      }

      // Cleanup handlers
      map.value.off('mousedown', onMouseDown)
      map.value.off('mousemove', onMouseMove)
      map.value.off('mouseup', onMouseUp)
      map.value.dragPan.enable()
      map.value.getCanvas().style.cursor = ''
      isDrawing.value = false
      drawStart = null
    }

    map.value.on('mousedown', onMouseDown)
    map.value.on('mousemove', onMouseMove)
    map.value.on('mouseup', onMouseUp)
  }

  const clearBoundingBox = () => {
    store.boundingBox = null
    clearBboxVisualization()
  }

  const recreateBboxVisualization = () => {
    if (store.boundingBox) {
      updateBboxVisualization(store.boundingBox.sw, store.boundingBox.ne)
    }
  }

  return {
    isDrawing,
    enableDrawing,
    clearBoundingBox,
    recreateBboxVisualization,
    clearBboxVisualization
  }
}
