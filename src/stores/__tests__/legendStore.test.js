import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLegendStore } from '../legend'

describe('useLegendStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with the legend visible', () => {
    const store = useLegendStore()

    expect(store.showLegend).toBe(true)
  })

  it('supports custom color add/remove', () => {
    const store = useLegendStore()

    store.setCustomColor('Tiger', '#ff6600')
    expect(store.customColors.Tiger).toBe('#ff6600')

    store.setCustomColor('Tiger', null)
    expect(store.customColors.Tiger).toBeUndefined()
  })

  it('toggles hidden items in hiddenItems', () => {
    const store = useLegendStore()

    store.toggleItemVisibility('Tiger')
    expect(store.hiddenItems).toContain('Tiger')

    store.toggleItemVisibility('Tiger')
    expect(store.hiddenItems).not.toContain('Tiger')
  })

  it('uses expected defaults for grouping and sorting', () => {
    const store = useLegendStore()

    expect(store.groupingSettings.groupBy).toBe('species')
    expect(store.sortBy).toBe('alphabetical')
  })
})
