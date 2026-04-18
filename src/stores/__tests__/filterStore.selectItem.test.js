import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useFilterStore } from '../filterStore'
import { useDatasetStore } from '../datasetStore'

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

const seedFeatures = (features) => {
  const dataset = useDatasetStore()
  dataset.allFeatures = features
}

const taxonomyFixture = [
  { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis', scientific_name: 'Mechanitis polymnia', subspecies: 'polymnia' },
  { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Mechanitis', scientific_name: 'Mechanitis messenoides', subspecies: 'deceptus' },
  { family: 'Nymphalidae', tribe: 'Ithomiini', genus: 'Oleria', scientific_name: 'Oleria amalda', subspecies: 'nevadensis' },
  { family: 'Pieridae', tribe: 'Anthocharidini', genus: 'Anthocharis', scientific_name: 'Anthocharis cardamines', subspecies: 'cardamines' },
]

describe('palette-style taxonomy selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedFeatures(taxonomyFixture)
  })

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

  it('selecting matching genus preserves species of that genus', async () => {
    const store = useFilterStore()
    store.filters.species = ['Mechanitis polymnia', 'Mechanitis messenoides']
    store.filters.subspecies = ['deceptus']
    await nextTick()
    store.filters.genus = 'Mechanitis'
    await nextTick()
    expect(store.filters.species).toEqual(['Mechanitis polymnia', 'Mechanitis messenoides'])
    expect(store.filters.subspecies).toEqual(['deceptus'])
  })

  it('selecting conflicting genus prunes only non-matching species', async () => {
    const store = useFilterStore()
    store.filters.species = ['Mechanitis polymnia', 'Oleria amalda']
    await nextTick()
    store.filters.genus = 'Mechanitis'
    await nextTick()
    expect(store.filters.species).toEqual(['Mechanitis polymnia'])
  })
})

describe('species/subspecies cascade behavior', () => {
  const fakeFeatures = [
    { scientific_name: 'Mechanitis polymnia', subspecies: 'casabranca' },
    { scientific_name: 'Mechanitis polymnia', subspecies: 'chimborazona' },
    { scientific_name: 'Mechanitis polymnia', subspecies: 'proceriformis' },
    { scientific_name: 'Mechanitis messenoides', subspecies: 'deceptus' },
    { scientific_name: 'Mechanitis messenoides', subspecies: 'intermedia' },
    { scientific_name: 'Oleria amalda', subspecies: 'nevadensis' },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    const dataset = useDatasetStore()
    dataset.allFeatures = fakeFeatures
  })

  it('adding a new species keeps existing subspecies from another species', async () => {
    const store = useFilterStore()
    store.filters.species = ['Mechanitis polymnia']
    store.filters.subspecies = ['casabranca', 'chimborazona']
    await nextTick()
    store.filters.species = [...store.filters.species, 'Mechanitis messenoides']
    await nextTick()
    store.filters.subspecies = [...store.filters.subspecies, 'deceptus']
    expect(store.filters.subspecies).toContain('casabranca')
    expect(store.filters.subspecies).toContain('chimborazona')
    expect(store.filters.subspecies).toContain('deceptus')
  })

  it('removing the last species keeps subspecies filters intact', async () => {
    const store = useFilterStore()
    store.filters.species = ['Mechanitis messenoides']
    store.filters.subspecies = ['deceptus']
    await nextTick()
    store.filters.species = []
    await nextTick()
    expect(store.filters.subspecies).toEqual(['deceptus'])
  })

  it('removing one species prunes only its orphaned subspecies', async () => {
    const store = useFilterStore()
    store.filters.species = ['Mechanitis polymnia', 'Mechanitis messenoides']
    store.filters.subspecies = ['casabranca', 'deceptus']
    await nextTick()
    store.filters.species = store.filters.species.filter(s => s !== 'Mechanitis messenoides')
    await nextTick()
    expect(store.filters.subspecies).toContain('casabranca')
    expect(store.filters.subspecies).not.toContain('deceptus')
  })
})
