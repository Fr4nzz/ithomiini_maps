import { ref } from 'vue'
import { MAP_STYLES } from '../utils/mapStyles'

export function useStyleSwitcher(map, addDataLayer, callbacks = {}) {
  const currentStyle = ref('dark')
  const { recreateClusterExtentCircle, setStyleChanging, onStyleReady } = callbacks

  const switchStyle = async (styleName) => {
    if (!map.value || !MAP_STYLES[styleName]) return

    if (setStyleChanging) {
      setStyleChanging(true)
    }

    const center = map.value.getCenter()
    const zoom = map.value.getZoom()
    const bearing = map.value.getBearing()
    const pitch = map.value.getPitch()

    currentStyle.value = styleName
    const styleConfig = MAP_STYLES[styleName]

    map.value.setStyle(styleConfig.style)

    map.value.once('style.load', () => {
      map.value.jumpTo({ center, zoom, bearing, pitch })
      addDataLayer({ skipZoom: true })

      // Notify caller that style is ready (e.g., for re-adding boundaries)
      if (onStyleReady) {
        onStyleReady()
      }

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
