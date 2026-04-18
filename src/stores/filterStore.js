import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { parseDate } from '../utils/dateHelpers'
import { getStorage, setStorage } from '../utils/storageHelpers'
import { isValidValue } from '../utils/validation'
import { useDatasetStore } from './datasetStore'
import { log } from '../utils/logger'

export const useFilterStore = defineStore('filters', () => {
  const datasetStore = useDatasetStore()

  const showAdvancedFilters = ref(getStorage('app-show-advanced-filters', false))
  const showMimicryFilter = ref(getStorage('app-show-mimicry-filter', false))
  const showGoatFilter = ref(getStorage('app-show-goat-filter', false))
  const focusPoint = ref(null)
  const gallerySelection = ref(null)
  const boundingBox = ref(null)

  const defaultFilters = () => ({
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

  const filters = ref(defaultFilters())

  const loadSourcesForFilters = async () => {
    const needed = filters.value.source.filter(source => !datasetStore.loadedSources.has(source))
    if (needed.length <= 1) {
      await Promise.all(needed.map(source => datasetStore.loadSource(source)))
    } else {
      await Promise.all(needed.map(source => datasetStore.loadSource(source, { batch: true })))
    }
  }

  const restoreFiltersFromURL = () => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('family')) { filters.value.family = params.get('family'); showAdvancedFilters.value = true }
    if (params.get('tribe')) { filters.value.tribe = params.get('tribe'); showAdvancedFilters.value = true }
    if (params.get('genus')) { filters.value.genus = params.get('genus'); showAdvancedFilters.value = true }
    if (params.get('sp')) filters.value.species = params.get('sp').split(',')
    if (params.get('ssp')) filters.value.subspecies = params.get('ssp').split(',')
    if (params.get('mim')) { filters.value.mimicry = params.get('mim').split(','); showMimicryFilter.value = true }
    if (params.get('status')) filters.value.status = params.get('status').split(',')
    if (params.get('source')) filters.value.source = params.get('source').split(',')
    if (params.get('country')) filters.value.country = params.get('country')
    if (params.get('sex')) filters.value.sex = params.get('sex')
    if (params.get('cam')) filters.value.camidSearch = params.get('cam')
    if (params.get('from')) filters.value.dateStart = params.get('from')
    if (params.get('to')) filters.value.dateEnd = params.get('to')
    if (params.get('goat')) { filters.value.goatCoverage = params.get('goat'); showGoatFilter.value = true }
    if (params.get('goat_src')) { filters.value.goatDataSource = params.get('goat_src').split(','); showGoatFilter.value = true }
    if (params.get('chr_min')) { filters.value.goatChromosomeMin = Number(params.get('chr_min')); showGoatFilter.value = true }
    if (params.get('chr_max')) { filters.value.goatChromosomeMax = Number(params.get('chr_max')); showGoatFilter.value = true }
  }

  const resetAllFilters = () => {
    filters.value = defaultFilters()
    boundingBox.value = null
  }

  const getFilteredSubset = (upToLevel) => {
    let data = datasetStore.allFeatures

    if (filters.value.source.length > 0) {
      data = data.filter(item => filters.value.source.includes(item.source))
    }

    if (upToLevel >= 1 && filters.value.family !== 'All') {
      data = data.filter(item => item.family === filters.value.family)
    }
    if (upToLevel >= 2 && filters.value.tribe !== 'All') {
      data = data.filter(item => item.tribe === filters.value.tribe)
    }
    if (upToLevel >= 3 && filters.value.genus !== 'All') {
      data = data.filter(item => item.genus === filters.value.genus)
    }
    if (upToLevel >= 4 && filters.value.species.length > 0) {
      data = data.filter(item => filters.value.species.includes(item.scientific_name))
    }

    return data
  }

  const uniqueValuesOf = (data, field) =>
    Array.from(new Set(data.map(item => item[field]).filter(isValidValue))).sort()

  const uniqueFamilies = computed(() => uniqueValuesOf(datasetStore.allFeatures, 'family'))
  const uniqueTribes = computed(() => uniqueValuesOf(getFilteredSubset(1), 'tribe'))
  const uniqueGenera = computed(() => uniqueValuesOf(getFilteredSubset(2), 'genus'))
  const uniqueSpecies = computed(() => uniqueValuesOf(getFilteredSubset(3), 'scientific_name'))
  const uniqueSubspecies = computed(() => uniqueValuesOf(getFilteredSubset(4), 'subspecies'))
  const uniqueMimicry = computed(() => uniqueValuesOf(datasetStore.allFeatures, 'mimicry_ring'))

  const availableMimicryRings = computed(() => {
    let data = datasetStore.allFeatures

    if (filters.value.family !== 'All') data = data.filter(item => item.family === filters.value.family)
    if (filters.value.tribe !== 'All') data = data.filter(item => item.tribe === filters.value.tribe)
    if (filters.value.genus !== 'All') data = data.filter(item => item.genus === filters.value.genus)
    if (filters.value.species.length > 0) data = data.filter(item => filters.value.species.includes(item.scientific_name))
    if (filters.value.subspecies.length > 0) data = data.filter(item => filters.value.subspecies.includes(item.subspecies))

    return uniqueValuesOf(data, 'mimicry_ring')
  })

  const unavailableMimicryRings = computed(() => {
    const available = new Set(availableMimicryRings.value)
    return uniqueMimicry.value.filter(ring => !available.has(ring))
  })

  const uniqueStatuses = computed(() => uniqueValuesOf(datasetStore.allFeatures, 'sequencing_status'))
  const uniqueSources = computed(() => Object.keys(datasetStore.sourceConfig))
  const uniqueCountries = computed(() => uniqueValuesOf(datasetStore.allFeatures, 'country'))
  const uniqueCamids = computed(() => uniqueValuesOf(datasetStore.allFeatures, 'id'))

  const temporalDistribution = computed(() => {
    let data = datasetStore.allFeatures
    if (!data.length) return []

    if (filters.value.source.length > 0) {
      data = data.filter(item => filters.value.source.includes(item.source))
    }

    const yearCounts = {}
    let minYear = Infinity
    let maxYear = -Infinity

    for (const item of data) {
      const dateStr = item.observation_date || item.date || item.preservation_date
      const d = parseDate(dateStr)
      if (!d) continue
      const year = d.getFullYear()
      yearCounts[year] = (yearCounts[year] || 0) + 1
      if (year < minYear) minYear = year
      if (year > maxYear) maxYear = year
    }

    if (minYear === Infinity) return []

    const result = []
    for (let year = minYear; year <= maxYear; year++) {
      result.push({ year, count: yearCounts[year] || 0 })
    }
    return result
  })

  watch(() => filters.value.family, () => {
    filters.value.tribe = 'All'
    filters.value.genus = 'All'
    filters.value.species = []
    filters.value.subspecies = []
  })

  watch(() => filters.value.tribe, () => {
    filters.value.genus = 'All'
    filters.value.species = []
    filters.value.subspecies = []
  })

  watch(() => filters.value.genus, () => {
    filters.value.species = []
    filters.value.subspecies = []
  })

  watch(() => filters.value.species, () => {
    filters.value.subspecies = []
  }, { deep: true })

  watch(() => filters.value.source, async (selectedSources) => {
    const needed = selectedSources.filter(source => !datasetStore.loadedSources.has(source))
    if (needed.length <= 1) {
      for (const source of needed) await datasetStore.loadSource(source)
    } else {
      await Promise.all(needed.map(source => datasetStore.loadSource(source, { batch: true })))
    }
  }, { deep: true })

  const _featureCache = new Map()
  const getFeatureWrapper = (item) => {
    let cached = _featureCache.get(item)
    if (!cached) {
      cached = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
        properties: item,
      }
      _featureCache.set(item, cached)
    }
    return cached
  }

  const filteredGeoJSON = computed(() => {
    if (!datasetStore.allFeatures.length) return null
    log.perf.start('filteredGeoJSON')

    let searchTerms = null
    if (filters.value.camidSearch) {
      searchTerms = filters.value.camidSearch
        .toUpperCase()
        .split(/[\s,\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
      if (searchTerms.length === 0) searchTerms = null
    }

    const speciesSet = filters.value.species.length > 0 ? new Set(filters.value.species) : null
    const subspeciesSet = filters.value.subspecies.length > 0 ? new Set(filters.value.subspecies) : null
    const mimicrySet = filters.value.mimicry.length > 0 ? new Set(filters.value.mimicry) : null
    const statusSet = filters.value.status.length > 0 ? new Set(filters.value.status) : null
    const sourceSet = filters.value.source.length > 0 ? new Set(filters.value.source) : null

    const f = filters.value
    const bb = boundingBox.value
    const hasDateFilter = f.dateStart || f.dateEnd
    const dateStart = f.dateStart ? new Date(f.dateStart) : null
    const dateEnd = f.dateEnd ? new Date(f.dateEnd) : null

    const hasGoatFilter = f.goatCoverage !== 'all' || f.goatDataSource.length > 0 ||
      f.goatChromosomeMin != null || f.goatChromosomeMax != null
    const goatDataSourceSet = f.goatDataSource.length > 0 ? new Set(f.goatDataSource) : null

    const filtered = datasetStore.allFeatures.filter(item => {
      if (searchTerms) {
        const itemId = (item.id || '').toUpperCase()
        if (!searchTerms.some(term => itemId.includes(term))) return false
      }

      if (f.family !== 'All' && item.family !== f.family) return false
      if (f.tribe !== 'All' && item.tribe !== f.tribe) return false
      if (f.genus !== 'All' && item.genus !== f.genus) return false
      if (speciesSet && !speciesSet.has(item.scientific_name)) return false
      if (subspeciesSet && !subspeciesSet.has(item.subspecies)) return false
      if (mimicrySet && !mimicrySet.has(item.mimicry_ring)) return false
      if (statusSet && !statusSet.has(item.sequencing_status)) return false
      if (sourceSet && !sourceSet.has(item.source)) return false
      if (f.country !== 'All' && item.country !== f.country) return false
      if (f.sex !== 'all') {
        if (f.sex === 'male' && item.sex !== 'male') return false
        if (f.sex === 'female' && item.sex !== 'female') return false
      }

      if (hasDateFilter) {
        const itemDateStr = item.observation_date || item.date || item.preservation_date
        const d = parseDate(itemDateStr)
        if (!d) return false
        if (dateStart && d < dateStart) return false
        if (dateEnd && d > dateEnd) return false
      }

      if (bb) {
        if (item.lng < bb.sw.lng || item.lng > bb.ne.lng ||
            item.lat < bb.sw.lat || item.lat > bb.ne.lat) return false
      }

      if (hasGoatFilter && datasetStore.goatLoaded) {
        const inGoat = datasetStore.hasGoatData(item.scientific_name)
        const hasDirect = datasetStore.hasDirectGoatData(item.scientific_name)

        if (f.goatCoverage === 'in_goat' && !inGoat) return false
        if (f.goatCoverage === 'not_in_goat' && inGoat) return false

        if (goatDataSourceSet) {
          const wantDirect = goatDataSourceSet.has('direct')
          const wantEstimated = goatDataSourceSet.has('estimated')
          const wantNone = goatDataSourceSet.has('none')

          let passes = false
          if (wantDirect && hasDirect) passes = true
          if (wantEstimated && inGoat && !hasDirect) passes = true
          if (wantNone && !inGoat) passes = true
          if (!passes) return false
        }

        if (f.goatChromosomeMin != null || f.goatChromosomeMax != null) {
          const chrData = datasetStore.getChromosomeNumber(item.scientific_name)
          if (!chrData) return false
          const chrVal = chrData.value
          if (f.goatChromosomeMin != null && chrVal < f.goatChromosomeMin) return false
          if (f.goatChromosomeMax != null && chrVal > f.goatChromosomeMax) return false
        }
      }

      return true
    })

    const result = {
      type: 'FeatureCollection',
      features: filtered.map(getFeatureWrapper),
    }
    log.perf.end('filteredGeoJSON', `${datasetStore.allFeatures.length} → ${filtered.length} features`)
    return result
  })

  const appendFilterURLParams = (params) => {
    const f = filters.value

    if (f.family !== 'All') params.set('family', f.family)
    if (f.tribe !== 'All') params.set('tribe', f.tribe)
    if (f.genus !== 'All') params.set('genus', f.genus)
    if (f.species.length > 0) params.set('sp', f.species.join(','))
    if (f.subspecies.length > 0) params.set('ssp', f.subspecies.join(','))
    if (f.mimicry.length > 0) params.set('mim', f.mimicry.join(','))
    if (f.status.length > 0) params.set('status', f.status.join(','))
    if (f.source.length > 0 && !(f.source.length === 1 && f.source[0] === 'Sanger Institute')) {
      params.set('source', f.source.join(','))
    }
    if (f.country !== 'All') params.set('country', f.country)
    if (f.sex !== 'all') params.set('sex', f.sex)
    if (f.camidSearch) params.set('cam', f.camidSearch)
    if (f.dateStart) params.set('from', f.dateStart)
    if (f.dateEnd) params.set('to', f.dateEnd)
    if (f.goatCoverage !== 'all') params.set('goat', f.goatCoverage)
    if (f.goatDataSource.length > 0) params.set('goat_src', f.goatDataSource.join(','))
    if (f.goatChromosomeMin != null) params.set('chr_min', f.goatChromosomeMin)
    if (f.goatChromosomeMax != null) params.set('chr_max', f.goatChromosomeMax)
  }

  watch(showAdvancedFilters, value => setStorage('app-show-advanced-filters', value))
  watch(showMimicryFilter, value => setStorage('app-show-mimicry-filter', value))
  watch(showGoatFilter, value => setStorage('app-show-goat-filter', value))

  return {
    filters,
    showAdvancedFilters,
    showMimicryFilter,
    showGoatFilter,
    focusPoint,
    gallerySelection,
    boundingBox,
    uniqueFamilies,
    uniqueTribes,
    uniqueGenera,
    uniqueSpecies,
    uniqueSubspecies,
    uniqueMimicry,
    availableMimicryRings,
    unavailableMimicryRings,
    uniqueStatuses,
    uniqueSources,
    uniqueCountries,
    uniqueCamids,
    temporalDistribution,
    filteredGeoJSON,
    loadSourcesForFilters,
    restoreFiltersFromURL,
    resetAllFilters,
    appendFilterURLParams,
  }
})
