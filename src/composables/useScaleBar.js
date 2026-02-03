import { ref } from 'vue'

export function useScaleBar(map) {
  const scaleBarText = ref('500 km')

  const updateScaleBar = () => {
    if (!map.value) return

    try {
      const zoom = map.value.getZoom()
      const center = map.value.getCenter()
      const lat = center.lat

      const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
      const distance = metersPerPixel * 100

      if (distance >= 1000) {
        const km = distance / 1000
        if (km >= 500) scaleBarText.value = Math.round(km / 100) * 100 + ' km'
        else if (km >= 50) scaleBarText.value = Math.round(km / 10) * 10 + ' km'
        else if (km >= 5) scaleBarText.value = Math.round(km) + ' km'
        else scaleBarText.value = km.toFixed(1) + ' km'
      } else {
        if (distance >= 100) scaleBarText.value = Math.round(distance / 10) * 10 + ' m'
        else scaleBarText.value = Math.round(distance) + ' m'
      }
    } catch (e) {
      scaleBarText.value = '—'
    }
  }

  return {
    scaleBarText,
    updateScaleBar
  }
}
