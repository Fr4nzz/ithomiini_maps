import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useFilterStore } from '../filterStore'

async function clearConflictingTaxonomy(filters, lineage) {
  const { family, tribe, genus } = lineage
  if (family && filters.family !== 'All' && filters.family !== family) {
    filters.family = 'All'
    await nextTick()
    return
  }
  if (tribe && filters.tribe !== 'All' && filters.tribe !== tribe) {
    filters.tribe = 'All'
    await nextTick()
    return
  }
  if (genus && filters.genus !== 'All' && filters.genus !== genus) {
    filters.genus = 'All'
    await nextTick()
  }
}

describe('palette-style taxonomy selection', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps existing taxonomy filter when lineage matches', async () => {
    const store = useFilterStore()
    store.filters.genus = 'Mechanitis'
    await nextTick()
    await clearConflictingTaxonomy(store.filters, {
      family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis',
    })
    expect(store.filters.genus).toBe('Mechanitis')
  })

  it('clears conflicting family when lineage differs', async () => {
    const store = useFilterStore()
    store.filters.family = 'Pieridae'
    await nextTick()
    await clearConflictingTaxonomy(store.filters, {
      family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis',
    })
    expect(store.filters.family).toBe('All')
  })

  it('clears conflicting genus and cascades to reset species', async () => {
    const store = useFilterStore()
    store.filters.genus = 'Mechanitis'
    store.filters.species = ['Mechanitis polymnia']
    await nextTick()
    await clearConflictingTaxonomy(store.filters, {
      family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Oleria',
    })
    expect(store.filters.genus).toBe('All')
    expect(store.filters.species).toEqual([])
  })

  it('resolves blocking bug: palette species selection with conflicting genus filter', async () => {
    const store = useFilterStore()
    store.filters.genus = 'Mechanitis'
    await nextTick()
    const palettedSpeciesLineage = {
      family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Oleria',
    }
    await clearConflictingTaxonomy(store.filters, palettedSpeciesLineage)
    store.filters.species = [...store.filters.species, 'Oleria amalda']
    expect(store.filters.genus).toBe('All')
    expect(store.filters.species).toContain('Oleria amalda')
  })
})
