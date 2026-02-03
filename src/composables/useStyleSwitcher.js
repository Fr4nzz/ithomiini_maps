import { ref } from 'vue'
import { MAP_STYLES } from '../utils/mapStyles'

export function useStyleSwitcher(map, addDataLayer, callbacks = {}) {
  const currentStyle = ref('dark')
  const { recreateClusterExtentCircle, setStyleChanging, onStyleReady } = callbacks

  const switchStyle = async (styleName) => {
    if (!map.value || !MAP_STYLES[styleName]) return

    console.log('[StyleSwitch] Switching to:', styleName)

    if (setStyleChanging) {
      setStyleChanging(true)
    }

    const center = map.value.getCenter()
    const zoom = map.value.getZoom()
    const bearing = map.value.getBearing()
    const pitch = map.value.getPitch()

    currentStyle.value = styleName
    const styleConfig = MAP_STYLES[styleName]

    console.log('[StyleSwitch] Calling setStyle...')
    map.value.setStyle(styleConfig.style)

    map.value.once('style.load', () => {
      console.log('[StyleSwitch] style.load fired for:', styleName)
      console.log('[StyleSwitch]   isStyleLoaded:', map.value?.isStyleLoaded?.())

      map.value.jumpTo({ center, zoom, bearing, pitch })
      console.log('[StyleSwitch]   Calling addDataLayer...')
      addDataLayer({ skipZoom: true })

      const hasPointsLayer = !!map.value.getLayer('points-layer')
      console.log('[StyleSwitch]   After addDataLayer — points-layer exists:', hasPointsLayer)

      // Notify caller that style is ready (e.g., for re-adding boundaries)
      if (onStyleReady) {
        console.log('[StyleSwitch]   Calling onStyleReady callback...')
        onStyleReady()
      }

      map.value.once('idle', () => {
        console.log('[StyleSwitch]   Map idle for:', styleName)
        if (recreateClusterExtentCircle) {
          recreateClusterExtentCircle()
        }

        setTimeout(() => {
          if (setStyleChanging) {
            setStyleChanging(false)
          }
          console.log('[StyleSwitch]   Style change complete for:', styleName)
        }, 100)
      })
    })
  }

  return {
    currentStyle,
    switchStyle
  }
}
