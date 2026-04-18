import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, watchEffect } from 'vue'
import { useDatasetStore } from '../datasetStore'

describe('useDatasetStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with empty arrays for feature collections', () => {
    const store = useDatasetStore()

    expect(store.allFeatures).toEqual([])
    expect(store.imageSupplement).toEqual([])
  })

  it('uses shallow refs for large arrays', async () => {
    const store = useDatasetStore()

    store.allFeatures = [{ nested: { count: 1 } }]

    let runs = 0
    let observed = null
    const stop = watchEffect(() => {
      runs += 1
      observed = store.allFeatures[0]?.nested.count ?? null
    })

    expect(runs).toBe(1)

    store.allFeatures[0].nested.count = 2
    await nextTick()

    expect(runs).toBe(1)
    expect(observed).toBe(1)

    store.allFeatures = [{ nested: { count: 3 } }]
    await nextTick()

    expect(runs).toBe(2)
    expect(observed).toBe(3)

    stop()
  })

  it('tracks loaded sources in a Set', () => {
    const store = useDatasetStore()

    expect(store.loadedSources.size).toBe(0)

    store.loadedSources.add('Sanger Institute')

    expect(store.loadedSources.has('Sanger Institute')).toBe(true)
    expect(store.loadedSources.size).toBe(1)
  })

  it('exposes the fallback source config structure', () => {
    const store = useDatasetStore()

    expect(store.sourceConfig).toMatchObject({
      'Sanger Institute': { file: 'map_points_sanger.json', default: true },
      'GBIF (UNAM)': { file: 'map_points_gbif_unam.json', default: false },
      'GBIF (Other Institutions)': { file: 'map_points_gbif_other.json', default: false },
      'Dore et al. (2025)': { file: 'map_points_dore.json', default: false },
      iNaturalist: { file: 'map_points_inaturalist.json', default: false },
    })
  })
})
