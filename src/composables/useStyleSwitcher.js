import { ref } from 'vue'
import { MAP_STYLES } from '../utils/mapStyles'

export function useStyleSwitcher(map, addDataLayer, extentCircleCallbacks = null) {
  const currentStyle = ref('dark')
  const { recreateClusterExtentCircle, setStyleChanging } = extentCircleCallbacks || {}

  const switchStyle = async (styleName) => {
    if (!map.value || !MAP_STYLES[styleName]) return

    if (setStyleChanging) {
      setStyleChanging(true)
    }

    // Save current view state before style change
    const center = map.value.getCenter()
    const zoom = map.value.getZoom()
    const bearing = map.value.getBearing()
    const pitch = map.value.getPitch()

    currentStyle.value = styleName
    const styleConfig = MAP_STYLES[styleName]

    map.value.setStyle(styleConfig.style)

    // Use style.load event to add data layer, then idle event to recreate extent circle
    map.value.once('style.load', () => {
      map.value.jumpTo({ center, zoom, bearing, pitch })
      addDataLayer({ skipZoom: true })

      map.value.once('idle', () => {
        if (recreateClusterExtentCircle) {
          recreateClusterExtentCircle()
        }

        setTimeout(() => {
          if (setStyleChanging) {
            setStyleChanging(false)
          }
        }, 100)
      })
    })
  }

  return {
    currentStyle,
    switchStyle
  }
}
