import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef, markRaw, reactive, computed, watch } from 'vue'
import { parseDate } from '../utils/dateHelpers'
import { getStorage, setStorage } from '../utils/storageHelpers'
import { normalizeCountryName } from '../utils/clusterStats'
import { usePhotoLookup } from './dataPhotoLookup'
import { useScatterVisualization } from './dataPointGrouping'
import { useColorMapping } from './dataColorPalette'
import { useGoatData } from './goatData'
import { log } from '../utils/logger'

export const useDataStore = defineStore('data', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // shallowRef prevents Vue from deep-proxying 155k+ records (saves ~200MB RAM)
  const allFeatures = shallowRef([])
  const imageSupplement = shallowRef([])     // Non-Sanger records used only for photo lookups
  const loadedSources = reactive(new Set()) // Which sources have been fully loaded
  const sourceLoading = reactive(new Set()) // Which sources are currently loading
  const loading = ref(true)

  // Data manifest (loaded from data_manifest.json at startup)
  const manifest = ref(null)

  // Derived from manifest — fallback to hardcoded values if manifest fails to load
  const FALLBACK_SOURCES = {
    'Sanger Institute': { file: 'map_points_sanger.json', default: true },
    'GBIF (UNAM)': { file: 'map_points_gbif_unam.json', default: false },
    'GBIF (Other Institutions)': { file: 'map_points_gbif_other.json', default: false },
    'Dore et al. (2025)': { file: 'map_points_dore.json', default: false },
    'iNaturalist': { file: 'map_points_inaturalist.json', default: false },
  }

  // Migrate old manifest format: rename "GBIF" → "GBIF (Other Institutions)"
  const sourceConfig = computed(() => {
    const raw = manifest.value?.sources ?? FALLBACK_SOURCES
    if (raw['GBIF'] && !raw['GBIF (Other Institutions)']) {
      const migrated = { ...raw }
      migrated['GBIF (Other Institutions)'] = { ...migrated['GBIF'], file: migrated['GBIF'].file }
      delete migrated['GBIF']
      return migrated
    }
    return raw
  })
  const imageSupplementFile = computed(() => manifest.value?.image_supplement ?? 'map_points_images.json')

  // Filter visibility state (for expand/collapse)
  const showAdvancedFilters = ref(getStorage('app-show-advanced-filters', false))
  const showMimicryFilter = ref(getStorage('app-show-mimicry-filter', false))
  const showGoatFilter = ref(getStorage('app-show-goat-filter', false))

  // UI preferences
  const showThumbnail = ref(true)

  // Focus point - when set, map should zoom to this point and show popup
  const focusPoint = ref(null)

  // Gallery selection - when set, gallery should open with this pre-selected
  const gallerySelection = ref(null)

  // Clustering settings
  const clusteringEnabled = ref(getStorage('app-clustering-enabled', false))
  const clusterSettings = ref(getStorage('app-cluster-settings', {
    radiusPixels: 80,
    showClusterPoints: true,
  }))

  // Visualization mode: 'points', 'clusters', 'heatmap', or 'ranges'
  const visualizationMode = ref(getStorage('app-visualization-mode', 'points'))
  const DEFAULT_HEATMAP_SETTINGS = { radius: 15, intensity: 1.5, opacity: 0.8 }
  const heatmapSettings = ref(getStorage('app-heatmap-settings', DEFAULT_HEATMAP_SETTINGS))

  const DEFAULT_RANGE_SETTINGS = {
    method: 'hexbin',
    groupBy: 'species',
    bufferKm: 50,
    minPoints: 5,
    opacity: 0.45,
    showPoints: true,
    hexSize: 50,
  }
  const rangeSettings = ref({ ...DEFAULT_RANGE_SETTINGS, ...getStorage('app-range-settings', DEFAULT_RANGE_SETTINGS) })

  // Bounding box spatial filter (session-only, no persistence)
  const boundingBox = ref(null)

  // Scatter overlapping points settings
  const scatterOverlappingPoints = ref(getStorage('app-scatter-overlapping', false))

  // Map styling settings
  const colorBy = ref(getStorage('map-color-by', 'subspecies'))

  const mapStyle = ref(getStorage('map-style', {
    pointSize: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    fillOpacity: 0.9,
    borderOpacity: 0.85
  }))
  const styleVersion = ref(0)

  const legendSettings = ref({
    position: 'bottom-left',
    textSize: 0.8,
    showLegend: true,
    maxItems: 15
  })

  // Export settings (don't persist 'enabled' - always start with export mode off)
  const defaultExportSettings = {
    enabled: false,
    aspectRatio: '16:9',
    customWidth: 1920,
    customHeight: 1080,
    showCoordinates: true,
    includeLegend: true,
    includeScaleBar: true,
    includeAttribution: true,
    uiScale: 1.0,
    format: 'png',
    dpi: 150
  }
  const storedExportSettings = getStorage('app-export-settings', defaultExportSettings)
  storedExportSettings.enabled = false
  const exportSettings = ref(storedExportSettings)

  // Map view state (for URL sync)
  const mapView = ref(getStorage('map-view', {
    center: [-60, -5],
    zoom: 4,
    bearing: 0,
    pitch: 0
  }))

  // The Active Filters
  const filters = ref({
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PHOTO LOOKUP (extracted composable)
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    photoLookup, mimicryPhotoLookup, gbifCitation,
    rebuildPhotoLookups, addPhotosFromData, loadGbifCitation, getPhotoForItem
  } = usePhotoLookup(allFeatures, imageSupplement)

  const {
    goatSpecies, goatLoaded, goatLoading, goatMeta,
    loadGoatData, getGoatForSpecies, hasGoatData, hasDirectGoatData,
    getChromosomeNumber, formatGenomeSize, chromosomeRange,
  } = useGoatData()

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const loadMapData = async () => {
    loading.value = true
    try {
      const basePath = import.meta.env.BASE_URL || '/'

      // Load manifest first
      try {
        const manifestRes = await fetch(`${basePath}data/data_manifest.json`)
        if (manifestRes.ok) {
          manifest.value = await manifestRes.json()
        }
      } catch {
        // Manifest is optional
      }

      const config = sourceConfig.value
      const defaultSource = Object.entries(config).find(([, v]) => v.default)?.[0]
        ?? Object.keys(config)[0]
      const defaultFile = config[defaultSource]?.file

      const [defaultRes, imgRes] = await Promise.all([
        fetch(`${basePath}data/${defaultFile}`),
        fetch(`${basePath}data/${imageSupplementFile.value}`),
      ])

      if (!defaultRes.ok) {
        throw new Error(`Failed to load ${defaultSource} data: ${defaultRes.status}`)
      }

      const defaultData = await defaultRes.json()
      const imgData = imgRes.ok ? await imgRes.json() : []

      for (const item of defaultData) {
        if (item.country) item.country = normalizeCountryName(item.country)
        if (item.source !== defaultSource) item.source = defaultSource
        markRaw(item)
      }

      allFeatures.value = defaultData
      triggerRef(allFeatures)
      for (const item of imgData) markRaw(item)
      imageSupplement.value = imgData
      triggerRef(imageSupplement)
      loadedSources.add(defaultSource)
      log.data.info(`✓ Loaded ${defaultData.length} ${defaultSource} records + ${imgData.length} image supplement`)

      rebuildPhotoLookups()
      loadGbifCitation()
      loadGoatData()
      restoreFiltersFromURL()
      await loadSourcesForFilters()
    } catch (e) {
      log.data.error('❌ Failed to load data:', e)
      allFeatures.value = []
    } finally {
      loading.value = false
    }
  }

  // Pending features from batch loading — flushed once all sources in a batch finish
  let pendingBatchFeatures = []
  let activeBatchLoads = 0

  const loadSource = async (sourceName, { batch = false } = {}) => {
    if (loadedSources.has(sourceName)) return
    if (sourceLoading.has(sourceName)) return

    const config = sourceConfig.value
    const fileName = config[sourceName]?.file
    if (!fileName) return

    sourceLoading.add(sourceName)
    if (batch) activeBatchLoads++

    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/${fileName}`)
      if (!response.ok) throw new Error(`${response.status}`)

      const data = await response.json()

      for (const item of data) {
        if (item.country) item.country = normalizeCountryName(item.country)
        if (item.source !== sourceName) item.source = sourceName
        markRaw(item)
      }

      loadedSources.add(sourceName)

      if (batch) {
        pendingBatchFeatures.push(...data)
        log.data.info(`Loaded ${data.length} ${sourceName} records (batch pending: ${pendingBatchFeatures.length})`)
      } else {
        allFeatures.value.push(...data)
        triggerRef(allFeatures)
        log.data.info(`Loaded ${data.length} ${sourceName} records (total: ${allFeatures.value.length})`)
      }

      addPhotosFromData(data)
    } catch (e) {
      log.data.error(`Failed to load ${sourceName}:`, e)
    } finally {
      sourceLoading.delete(sourceName)
      if (batch) {
        activeBatchLoads--
        if (activeBatchLoads === 0 && pendingBatchFeatures.length > 0) {
          log.perf.start('batchFlush')
          allFeatures.value.push(...pendingBatchFeatures)
          triggerRef(allFeatures)
          log.perf.end('batchFlush', `${pendingBatchFeatures.length} records (total: ${allFeatures.value.length})`)
          pendingBatchFeatures = []
        }
      }
    }
  }

  const loadSourcesForFilters = async () => {
    const needed = filters.value.source.filter(s => !loadedSources.has(s))
    if (needed.length <= 1) {
      // Single source: load immediately (no batching needed)
      await Promise.all(needed.map(s => loadSource(s)))
    } else {
      // Multiple sources: batch to avoid repeated map rebuilds
      await Promise.all(needed.map(s => loadSource(s, { batch: true })))
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

    if (params.get('viz')) visualizationMode.value = params.get('viz')
    if (params.get('range_method')) rangeSettings.value.method = params.get('range_method')
    if (params.get('range_group')) rangeSettings.value.groupBy = params.get('range_group')
    if (params.get('range_buffer')) rangeSettings.value.bufferKm = Number(params.get('range_buffer'))
    if (params.get('range_min')) rangeSettings.value.minPoints = Number(params.get('range_min'))
    if (params.get('range_opacity')) rangeSettings.value.opacity = Number(params.get('range_opacity')) / 100
    if (params.get('range_hex')) rangeSettings.value.hexSize = Number(params.get('range_hex'))
  }

  const resetAllFilters = () => {
    filters.value = {
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
    }
    visualizationMode.value = 'points'
    rangeSettings.value = { ...DEFAULT_RANGE_SETTINGS }
    boundingBox.value = null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCADING COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  const getFilteredSubset = (upToLevel) => {
    let data = allFeatures.value

    if (filters.value.source.length > 0) {
      data = data.filter(i => filters.value.source.includes(i.source))
    }

    if (upToLevel >= 1 && filters.value.family !== 'All') {
      data = data.filter(i => i.family === filters.value.family)
    }
    if (upToLevel >= 2 && filters.value.tribe !== 'All') {
      data = data.filter(i => i.tribe === filters.value.tribe)
    }
    if (upToLevel >= 3 && filters.value.genus !== 'All') {
      data = data.filter(i => i.genus === filters.value.genus)
    }
    if (upToLevel >= 4 && filters.value.species.length > 0) {
      data = data.filter(i => filters.value.species.includes(i.scientific_name))
    }

    return data
  }

  const isValidValue = (val) => {
    if (!val) return false
    if (typeof val !== 'string') return false
    const cleaned = val.trim().toLowerCase()
    return cleaned &&
           cleaned !== 'unknown' &&
           cleaned !== 'na' &&
           cleaned !== 'nan' &&
           cleaned !== 'null' &&
           cleaned !== 'none'
  }

  const uniqueValuesOf = (data, field) =>
    Array.from(new Set(data.map(i => i[field]).filter(isValidValue))).sort()

  const uniqueFamilies = computed(() => uniqueValuesOf(allFeatures.value, 'family'))
  const uniqueTribes = computed(() => uniqueValuesOf(getFilteredSubset(1), 'tribe'))
  const uniqueGenera = computed(() => uniqueValuesOf(getFilteredSubset(2), 'genus'))
  const uniqueSpecies = computed(() => uniqueValuesOf(getFilteredSubset(3), 'scientific_name'))
  const uniqueSubspecies = computed(() => uniqueValuesOf(getFilteredSubset(4), 'subspecies'))

  const uniqueMimicry = computed(() => uniqueValuesOf(allFeatures.value, 'mimicry_ring'))

  const availableMimicryRings = computed(() => {
    let data = allFeatures.value

    if (filters.value.family !== 'All') data = data.filter(i => i.family === filters.value.family)
    if (filters.value.tribe !== 'All') data = data.filter(i => i.tribe === filters.value.tribe)
    if (filters.value.genus !== 'All') data = data.filter(i => i.genus === filters.value.genus)
    if (filters.value.species.length > 0) data = data.filter(i => filters.value.species.includes(i.scientific_name))
    if (filters.value.subspecies.length > 0) data = data.filter(i => filters.value.subspecies.includes(i.subspecies))

    return uniqueValuesOf(data, 'mimicry_ring')
  })

  const unavailableMimicryRings = computed(() => {
    const available = new Set(availableMimicryRings.value)
    return uniqueMimicry.value.filter(ring => !available.has(ring))
  })

  const uniqueStatuses = computed(() => uniqueValuesOf(allFeatures.value, 'sequencing_status'))
  const uniqueSources = computed(() => Object.keys(sourceConfig.value))
  const uniqueCountries = computed(() => uniqueValuesOf(allFeatures.value, 'country'))
  const uniqueCamids = computed(() => uniqueValuesOf(allFeatures.value, 'id'))

  const temporalDistribution = computed(() => {
    let data = allFeatures.value
    if (!data.length) return []

    if (filters.value.source.length > 0) {
      data = data.filter(i => filters.value.source.includes(i.source))
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
    for (let y = minYear; y <= maxYear; y++) {
      result.push({ year: y, count: yearCounts[y] || 0 })
    }
    return result
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCADE RESET WATCHERS
  // ═══════════════════════════════════════════════════════════════════════════

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

  watch(visualizationMode, (mode) => {
    clusteringEnabled.value = mode === 'clusters'
  })

  watch(() => filters.value.source, async (selectedSources) => {
    const needed = selectedSources.filter(s => !loadedSources.has(s))
    if (needed.length <= 1) {
      for (const source of needed) await loadSource(source)
    } else {
      await Promise.all(needed.map(s => loadSource(s, { batch: true })))
    }
  }, { deep: true })

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL FILTERED DATA
  // ═══════════════════════════════════════════════════════════════════════════

  const _featureCache = new Map()
  const getFeatureWrapper = (item) => {
    // Use item reference as cache key to avoid collisions when multiple
    // records share the same id (e.g. "Unknown")
    let cached = _featureCache.get(item)
    if (!cached) {
      cached = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
        properties: item
      }
      _featureCache.set(item, cached)
    }
    return cached
  }

  const filteredGeoJSON = computed(() => {
    if (!allFeatures.value.length) return null
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

    // Pre-build Sets for O(1) lookups instead of O(n) .includes() per feature
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

    const filtered = allFeatures.value.filter(item => {
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

      if (hasGoatFilter && goatLoaded.value) {
        const inGoat = hasGoatData(item.scientific_name)
        const hasDirect = hasDirectGoatData(item.scientific_name)

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
          const chrData = getChromosomeNumber(item.scientific_name)
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
      features: filtered.map(getFeatureWrapper)
    }
    log.perf.end('filteredGeoJSON', `${allFeatures.value.length} → ${filtered.length} features`)
    return result
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SCATTER VISUALIZATION (extracted composable)
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    getPointsAtCoordinates, groupPointsBySpecies, getSpeciesWithPhotos,
    coordinateGroups, scatteredPositions, displayGeoJSON, scatterVisualizationData
  } = useScatterVisualization(filteredGeoJSON, scatterOverlappingPoints, clusteringEnabled)

  // ═══════════════════════════════════════════════════════════════════════════
  // COLOR MAPPING (extracted composable)
  // ═══════════════════════════════════════════════════════════════════════════

  // Get the attribute key for the current colorBy mode
  const colorByAttribute = computed(() => {
    const mapping = {
      'status': 'sequencing_status',
      'subspecies': 'subspecies',
      'species': 'scientific_name',
      'genus': 'genus',
      'mimicry': 'mimicry_ring',
      'source': 'source'
    }
    return mapping[colorBy.value] || 'sequencing_status'
  })

  const {
    speciesSubspeciesMap, baseColorMap, activeColorMap, legendTitle
  } = useColorMapping(colorBy, displayGeoJSON, colorByAttribute)

  // ═══════════════════════════════════════════════════════════════════════════
  // URL SYNC WATCHER
  // ═══════════════════════════════════════════════════════════════════════════

  const syncURLState = () => {
    const f = filters.value
    const params = new URLSearchParams()

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

    if (visualizationMode.value !== 'points') params.set('viz', visualizationMode.value)
    if (visualizationMode.value === 'ranges') {
      const rs = rangeSettings.value
      if (rs.method !== 'hexbin') params.set('range_method', rs.method)
      if (rs.method === 'hulls' && rs.groupBy !== 'species') params.set('range_group', rs.groupBy)
      if (rs.method === 'hulls' && rs.bufferKm !== 50) params.set('range_buffer', rs.bufferKm)
      if (rs.method === 'hulls' && rs.minPoints !== 5) params.set('range_min', rs.minPoints)
      if (rs.method === 'hexbin' && rs.hexSize !== 50) params.set('range_hex', rs.hexSize)
      if (rs.opacity !== 0.45) params.set('range_opacity', Math.round(rs.opacity * 100))
    }

    const newURL = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname
    window.history.replaceState({}, '', newURL)
  }

  watch(filters, syncURLState, { deep: true })
  watch(visualizationMode, syncURLState)
  watch(rangeSettings, syncURLState, { deep: true })

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE WATCHERS
  // ═══════════════════════════════════════════════════════════════════════════

  watch(showAdvancedFilters, (val) => setStorage('app-show-advanced-filters', val))
  watch(showMimicryFilter, (val) => setStorage('app-show-mimicry-filter', val))
  watch(showGoatFilter, (val) => setStorage('app-show-goat-filter', val))
  watch(clusteringEnabled, (val) => setStorage('app-clustering-enabled', val))
  watch(clusterSettings, (val) => setStorage('app-cluster-settings', val), { deep: true })
  watch(scatterOverlappingPoints, (val) => setStorage('app-scatter-overlapping', val))
  watch(visualizationMode, (val) => setStorage('app-visualization-mode', val))
  watch(heatmapSettings, (val) => setStorage('app-heatmap-settings', val), { deep: true })
  watch(rangeSettings, (val) => setStorage('app-range-settings', val), { deep: true })
  watch(colorBy, (val) => setStorage('map-color-by', val))
  watch(mapStyle, (val) => setStorage('map-style', val), { deep: true })
  watch([colorBy, mapStyle], () => { styleVersion.value++ }, { deep: true })
  watch(mapView, (val) => setStorage('map-view', val), { deep: true })
  watch(exportSettings, (val) => {
    const toStore = { ...val }
    toStore.enabled = false
    setStorage('app-export-settings', toStore)
  }, { deep: true })

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // State
    loading,
    allFeatures,
    loadedSources,
    sourceLoading,
    filters,
    showAdvancedFilters,
    showMimicryFilter,
    showGoatFilter,
    showThumbnail,
    focusPoint,
    gallerySelection,
    clusteringEnabled,
    clusterSettings,
    visualizationMode,
    heatmapSettings,
    DEFAULT_HEATMAP_SETTINGS,
    rangeSettings,
    DEFAULT_RANGE_SETTINGS,
    boundingBox,
    scatterOverlappingPoints,
    mimicryPhotoLookup,
    gbifCitation,

    // Map styling state
    colorBy,
    mapStyle,
    styleVersion,
    legendSettings,
    exportSettings,
    mapView,

    // GoaT genomic data
    goatLoaded,
    goatLoading,
    goatMeta,
    goatSpecies,
    getGoatForSpecies,
    hasGoatData,
    hasDirectGoatData,
    getChromosomeNumber,
    formatGenomeSize,
    chromosomeRange,

    // Actions
    loadMapData,
    resetAllFilters,
    getPhotoForItem,

    // Coordinate grouping helpers
    getPointsAtCoordinates,
    groupPointsBySpecies,
    getSpeciesWithPhotos,

    // Computed (cascading options)
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

    // Computed (color mapping)
    baseColorMap,
    activeColorMap,
    colorByAttribute,
    legendTitle,
    speciesSubspeciesMap,

    // Final output
    filteredGeoJSON,
    displayGeoJSON,
    scatterVisualizationData,
  }
})
