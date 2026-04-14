import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useViewStore } from '../viewStore'

describe('useViewStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts in points visualization mode', () => {
    const store = useViewStore()

    expect(store.visualizationMode).toBe('points')
  })

  it('starts with clustering disabled', () => {
    const store = useViewStore()

    expect(store.clusteringEnabled).toBe(false)
  })

  it('exposes the export settings structure', () => {
    const store = useViewStore()

    expect(store.exportSettings).toMatchObject({
      enabled: false,
      aspectRatio: '16:9',
      customWidth: 1920,
      customHeight: 1080,
      showCoordinates: true,
      includeLegend: true,
      includeScaleBar: true,
      includeAttribution: true,
      uiScale: 1,
      format: 'png',
      dpi: 150,
    })
  })

  it('defaults colorBy to subspecies', () => {
    const store = useViewStore()

    expect(store.colorBy).toBe('subspecies')
  })
})
