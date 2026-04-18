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

describe('additive multi-value taxonomy filters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedFeatures(fixture)
  })

  it('setting family does not touch existing descendants', async () => {
    const store = useFilterStore()
    store.filters.tribe = ['Ithomiini']
    store.filters.genus = ['Mechanitis']
    store.filters.species = ['Mechanitis polymnia']
    store.filters.subspecies = ['deceptus']
    await nextTick()
    store.filters.family = ['Pieridae']
    await nextTick()
    expect(store.filters.tribe).toEqual(['Ithomiini'])
    expect(store.filters.genus).toEqual(['Mechanitis'])
    expect(store.filters.species).toEqual(['Mechanitis polymnia'])
    expect(store.filters.subspecies).toEqual(['deceptus'])
  })

  it('adding a second genus accumulates instead of replacing', async () => {
    const store = useFilterStore()
    store.filters.genus = ['Mechanitis']
    store.filters.species = ['Mechanitis polymnia']
    store.filters.subspecies = ['deceptus']
    await nextTick()
    store.filters.genus = [...store.filters.genus, 'Melinaea']
    await nextTick()
    expect(store.filters.genus).toEqual(['Mechanitis', 'Melinaea'])
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

  it('removing one of multiple genera keeps species and subspecies', async () => {
    const store = useFilterStore()
    store.filters.genus = ['Mechanitis', 'Melinaea']
    store.filters.species = ['Mechanitis polymnia']
    store.filters.subspecies = ['polymnia']
    await nextTick()
    store.filters.genus = store.filters.genus.filter(g => g !== 'Melinaea')
    await nextTick()
    expect(store.filters.genus).toEqual(['Mechanitis'])
    expect(store.filters.species).toEqual(['Mechanitis polymnia'])
    expect(store.filters.subspecies).toEqual(['polymnia'])
  })
})

describe('taxonomy filters combine with OR across levels', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedFeatures(fixture)
  })

  it('genus=[Melinaea] + species=[Mechanitis polymnia] returns union, not intersection', () => {
    const store = useFilterStore()
    store.filters.source = []
    store.filters.genus = ['Melinaea']
    store.filters.species = ['Mechanitis polymnia']
    const featureIds = store.filteredGeoJSON.features.map(f => f.properties.scientific_name)
    expect(featureIds).toContain('Melinaea mothone')
    expect(featureIds).toContain('Mechanitis polymnia')
  })

  it('non-taxonomy filters still AND with taxonomy union', () => {
    setActivePinia(createPinia())
    seedFeatures([
      { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis', scientific_name: 'Mechanitis polymnia', subspecies: 'polymnia', country: 'Ecuador', source: 'Sanger Institute', lat: 0, lng: 0 },
      { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis', scientific_name: 'Mechanitis polymnia', subspecies: 'polymnia', country: 'Peru', source: 'Sanger Institute', lat: 0, lng: 0 },
      { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Melinaea', scientific_name: 'Melinaea mothone', subspecies: 'mothone', country: 'Ecuador', source: 'Sanger Institute', lat: 0, lng: 0 },
    ])
    const store = useFilterStore()
    store.filters.genus = ['Melinaea']
    store.filters.species = ['Mechanitis polymnia']
    store.filters.country = ['Ecuador']
    const countries = store.filteredGeoJSON.features.map(f => f.properties.country)
    expect(countries.every(c => c === 'Ecuador')).toBe(true)
    expect(countries.length).toBe(2)
  })
})
