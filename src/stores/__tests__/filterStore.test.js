import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useDatasetStore } from '../datasetStore'
import { useFilterStore } from '../filterStore'

const makeFeature = (overrides = {}) => ({
  id: 'CAM001',
  scientific_name: 'Mechanitis menophilus',
  subspecies: 'nevadensis',
  family: 'Nymphalidae',
  tribe: 'Ithomiini',
  genus: 'Mechanitis',
  mimicry_ring: 'Tiger',
  sequencing_status: 'Sequenced',
  source: 'Sanger Institute',
  country: 'Ecuador',
  sex: 'male',
  lat: -1,
  lng: -78,
  date: '2023-05-15',
  observation_date: '2023-05-15',
  ...overrides,
})

describe('useFilterStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with the expected default filter state', () => {
    const datasetStore = useDatasetStore()
    const filterStore = useFilterStore()

    expect(datasetStore.loadedSources.size).toBe(0)
    expect(filterStore.filters).toMatchObject({
      family: 'All',
      tribe: 'All',
      genus: 'All',
      species: [],
      subspecies: [],
      mimicry: [],
      status: [],
      source: ['Sanger Institute'],
      sex: 'all',
      country: 'All',
      camidSearch: '',
      dateStart: null,
      dateEnd: null,
      goatCoverage: 'all',
      goatDataSource: [],
      goatChromosomeMin: null,
      goatChromosomeMax: null,
    })
  })

  it('resetAllFilters resets everything', () => {
    const filterStore = useFilterStore()

    filterStore.filters.family = 'Nymphalidae'
    filterStore.filters.tribe = 'Ithomiini'
    filterStore.filters.genus = 'Mechanitis'
    filterStore.filters.species = ['Mechanitis menophilus']
    filterStore.filters.subspecies = ['nevadensis']
    filterStore.filters.mimicry = ['Tiger']
    filterStore.filters.status = ['Sequenced']
    filterStore.filters.source = ['GBIF (UNAM)']
    filterStore.filters.sex = 'female'
    filterStore.filters.country = 'Ecuador'
    filterStore.filters.camidSearch = 'CAM001'
    filterStore.filters.dateStart = '2023-01-01'
    filterStore.filters.dateEnd = '2023-12-31'
    filterStore.filters.goatCoverage = 'in_goat'
    filterStore.filters.goatDataSource = ['direct']
    filterStore.filters.goatChromosomeMin = 10
    filterStore.filters.goatChromosomeMax = 20
    filterStore.boundingBox = { sw: { lng: -80, lat: -10 }, ne: { lng: -70, lat: 0 } }

    filterStore.resetAllFilters()

    expect(filterStore.filters).toMatchObject({
      family: 'All',
      tribe: 'All',
      genus: 'All',
      species: [],
      subspecies: [],
      mimicry: [],
      status: [],
      source: ['Sanger Institute'],
      sex: 'all',
      country: 'All',
      camidSearch: '',
      dateStart: null,
      dateEnd: null,
      goatCoverage: 'all',
      goatDataSource: [],
      goatChromosomeMin: null,
      goatChromosomeMax: null,
    })
    expect(filterStore.boundingBox).toBeNull()
  })

  it('clears dependent filters when family changes', async () => {
    const filterStore = useFilterStore()

    filterStore.filters.tribe = 'Ithomiini'
    filterStore.filters.genus = 'Mechanitis'
    filterStore.filters.species = ['Mechanitis menophilus']
    filterStore.filters.subspecies = ['nevadensis']

    filterStore.filters.family = 'Nymphalidae'
    await nextTick()

    expect(filterStore.filters.tribe).toBe('All')
    expect(filterStore.filters.genus).toBe('All')
    expect(filterStore.filters.species).toEqual([])
    expect(filterStore.filters.subspecies).toEqual([])
  })

  it('computes unique species and subspecies from mock data', () => {
    const datasetStore = useDatasetStore()
    const filterStore = useFilterStore()

    datasetStore.allFeatures = [
      makeFeature({ id: 'CAM001', scientific_name: 'Mechanitis menophilus', subspecies: 'nevadensis' }),
      makeFeature({ id: 'CAM002', scientific_name: 'Mechanitis menophilus', subspecies: 'Unknown' }),
      makeFeature({ id: 'CAM003', scientific_name: 'Mechanitis polymnia', subspecies: 'casabranca' }),
      makeFeature({ id: 'CAM004', scientific_name: 'Mechanitis polymnia', subspecies: 'NA' }),
    ]

    expect(filterStore.uniqueSpecies).toEqual([
      'Mechanitis menophilus',
      'Mechanitis polymnia',
    ])
    expect(filterStore.uniqueSubspecies).toEqual([
      'casabranca',
      'nevadensis',
    ])
  })

  it('filters GeoJSON with the active filter state', () => {
    const datasetStore = useDatasetStore()
    const filterStore = useFilterStore()

    datasetStore.allFeatures = [
      makeFeature({
        id: 'CAM001',
        scientific_name: 'Mechanitis menophilus',
        subspecies: 'nevadensis',
        mimicry_ring: 'Tiger',
        sequencing_status: 'Sequenced',
        sex: 'male',
        lat: -1.2,
        lng: -78.5,
      }),
      makeFeature({
        id: 'CAM002',
        scientific_name: 'Mechanitis menophilus',
        subspecies: 'nevadensis',
        mimicry_ring: 'Tiger',
        sequencing_status: 'Sequenced',
        sex: 'female',
        lat: -1.25,
        lng: -78.45,
      }),
    ]

    filterStore.filters.family = 'Nymphalidae'
    filterStore.filters.tribe = 'Ithomiini'
    filterStore.filters.genus = 'Mechanitis'
    filterStore.filters.species = ['Mechanitis menophilus']
    filterStore.filters.subspecies = ['nevadensis']
    filterStore.filters.mimicry = ['Tiger']
    filterStore.filters.status = ['Sequenced']
    filterStore.filters.country = 'Ecuador'
    filterStore.filters.sex = 'male'
    filterStore.filters.camidSearch = 'cam001'

    const geojson = filterStore.filteredGeoJSON

    expect(geojson).toMatchObject({ type: 'FeatureCollection' })
    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0].properties.id).toBe('CAM001')
    expect(geojson.features[0].geometry.coordinates).toEqual([-78.5, -1.2])
  })
})
