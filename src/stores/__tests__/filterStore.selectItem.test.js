import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useFilterStore } from '../filterStore'
import { useDatasetStore } from '../datasetStore'

const seedFeatures = (features) => {
  const dataset = useDatasetStore()
  dataset.allFeatures = features
}

const fixture = [
  { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis', scientific_name: 'Mechanitis polymnia', subspecies: 'polymnia' },
  { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis', scientific_name: 'Mechanitis messenoides', subspecies: 'deceptus' },
  { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Melinaea', scientific_name: 'Melinaea mothone', subspecies: 'mothone' },
]

describe('additive taxonomy filters (no auto-cascade)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedFeatures(fixture)
  })

  it('setting family does not touch existing descendants', async () => {
    const store = useFilterStore()
    store.filters.tribe = 'Ithomiini'
    store.filters.genus = 'Mechanitis'
    store.filters.species = ['Mechanitis polymnia']
    store.filters.subspecies = ['deceptus']
    await nextTick()
    store.filters.family = 'Pieridae'
    await nextTick()
    expect(store.filters.tribe).toBe('Ithomiini')
    expect(store.filters.genus).toBe('Mechanitis')
    expect(store.filters.species).toEqual(['Mechanitis polymnia'])
    expect(store.filters.subspecies).toEqual(['deceptus'])
  })

  it('setting an unrelated genus does not remove species or subspecies', async () => {
    const store = useFilterStore()
    store.filters.species = ['Mechanitis polymnia']
    store.filters.subspecies = ['deceptus']
    await nextTick()
    store.filters.genus = 'Melinaea'
    await nextTick()
    expect(store.filters.genus).toBe('Melinaea')
    expect(store.filters.species).toEqual(['Mechanitis polymnia'])
    expect(store.filters.subspecies).toEqual(['deceptus'])
  })

  it('removing a species does not clear its subspecies', async () => {
    const store = useFilterStore()
    store.filters.species = ['Mechanitis messenoides']
    store.filters.subspecies = ['deceptus']
    await nextTick()
    store.filters.species = []
    await nextTick()
    expect(store.filters.subspecies).toEqual(['deceptus'])
  })

  it('clearing a genus via X does not touch species or subspecies', async () => {
    const store = useFilterStore()
    store.filters.genus = 'Mechanitis'
    store.filters.species = ['Mechanitis polymnia']
    store.filters.subspecies = ['polymnia']
    await nextTick()
    store.filters.genus = 'All'
    await nextTick()
    expect(store.filters.species).toEqual(['Mechanitis polymnia'])
    expect(store.filters.subspecies).toEqual(['polymnia'])
  })
})
