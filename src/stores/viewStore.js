import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getStorage, setStorage } from '../utils/storageHelpers'
import { useScatterVisualization } from './dataPointGrouping'
import { useColorMapping } from './dataColorPalette'
import { useFilterStore } from './filterStore'

export const useViewStore = defineStore('view', () => {
  const filterStore = useFilterStore()
  const { filteredGeoJSON: filteredGeoJSONRef } = storeToRefs(filterStore)

  const clusteringEnabled = ref(getStorage('app-clustering-enabled', false))
  const clusterSettings = ref(getStorage('app-cluster-settings', {
    radiusPixels: 80,
    showClusterPoints: true,
  }))

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
  const scatterOverlappingPoints = ref(getStorage('app-scatter-overlapping', false))
  const colorBy = ref(getStorage('map-color-by', 'subspecies'))

  const mapStyle = ref(getStorage('map-style', {
    pointSize: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    fillOpacity: 0.9,
    borderOpacity: 0.85,
  }))
  const styleVersion = ref(0)

  const legendSettings = ref({
    position: 'bottom-left',
    textSize: 0.8,
    showLegend: true,
    maxItems: 15,
  })

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
    dpi: 150,
  }
  const storedExportSettings = getStorage('app-export-settings', defaultExportSettings)
  storedExportSettings.enabled = false
  const exportSettings = ref(storedExportSettings)

  const mapView = ref(getStorage('map-view', {
    center: [-60, -5],
    zoom: 4,
    bearing: 0,
    pitch: 0,
  }))

  watch(visualizationMode, mode => {
    clusteringEnabled.value = mode === 'clusters'
  })

  const {
    getPointsAtCoordinates,
    groupPointsBySpecies,
    getSpeciesWithPhotos,
    coordinateGroups,
    scatteredPositions,
    displayGeoJSON,
    scatterVisualizationData,
  } = useScatterVisualization(filteredGeoJSONRef, scatterOverlappingPoints, clusteringEnabled)

  const colorByAttribute = computed(() => {
    const mapping = {
      status: 'sequencing_status',
      subspecies: 'subspecies',
      species: 'scientific_name',
      genus: 'genus',
      mimicry: 'mimicry_ring',
      source: 'source',
    }
    return mapping[colorBy.value] || 'sequencing_status'
  })

  const {
    speciesSubspeciesMap,
    baseColorMap,
    activeColorMap,
    legendTitle,
  } = useColorMapping(colorBy, displayGeoJSON, colorByAttribute)

  const appendVisualizationURLParams = (params) => {
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
  }

  const syncURLState = () => {
    const params = new URLSearchParams()
    filterStore.appendFilterURLParams(params)
    appendVisualizationURLParams(params)

    const newURL = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname
    window.history.replaceState({}, '', newURL)
  }

  const restoreVisualizationFromURL = () => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('viz')) visualizationMode.value = params.get('viz')
    if (params.get('range_method')) rangeSettings.value.method = params.get('range_method')
    if (params.get('range_group')) rangeSettings.value.groupBy = params.get('range_group')
    if (params.get('range_buffer')) rangeSettings.value.bufferKm = Number(params.get('range_buffer'))
    if (params.get('range_min')) rangeSettings.value.minPoints = Number(params.get('range_min'))
    if (params.get('range_opacity')) rangeSettings.value.opacity = Number(params.get('range_opacity')) / 100
    if (params.get('range_hex')) rangeSettings.value.hexSize = Number(params.get('range_hex'))
  }

  const resetVisualizationState = () => {
    visualizationMode.value = 'points'
    rangeSettings.value = { ...DEFAULT_RANGE_SETTINGS }
  }

  watch(() => filterStore.filters, syncURLState, { deep: true })
  watch(visualizationMode, syncURLState)
  watch(rangeSettings, syncURLState, { deep: true })

  watch(clusteringEnabled, value => setStorage('app-clustering-enabled', value))
  watch(clusterSettings, value => setStorage('app-cluster-settings', value), { deep: true })
  watch(scatterOverlappingPoints, value => setStorage('app-scatter-overlapping', value))
  watch(visualizationMode, value => setStorage('app-visualization-mode', value))
  watch(heatmapSettings, value => setStorage('app-heatmap-settings', value), { deep: true })
  watch(rangeSettings, value => setStorage('app-range-settings', value), { deep: true })
  watch(colorBy, value => setStorage('map-color-by', value))
  watch(mapStyle, value => setStorage('map-style', value), { deep: true })
  watch([colorBy, mapStyle], () => { styleVersion.value++ }, { deep: true })
  watch(mapView, value => setStorage('map-view', value), { deep: true })
  watch(exportSettings, value => {
    const toStore = { ...value }
    toStore.enabled = false
    setStorage('app-export-settings', toStore)
  }, { deep: true })

  return {
    clusteringEnabled,
    clusterSettings,
    visualizationMode,
    DEFAULT_HEATMAP_SETTINGS,
    heatmapSettings,
    DEFAULT_RANGE_SETTINGS,
    rangeSettings,
    scatterOverlappingPoints,
    colorBy,
    mapStyle,
    styleVersion,
    legendSettings,
    exportSettings,
    mapView,
    getPointsAtCoordinates,
    groupPointsBySpecies,
    getSpeciesWithPhotos,
    coordinateGroups,
    scatteredPositions,
    displayGeoJSON,
    scatterVisualizationData,
    colorByAttribute,
    speciesSubspeciesMap,
    baseColorMap,
    activeColorMap,
    legendTitle,
    appendVisualizationURLParams,
    restoreVisualizationFromURL,
    resetVisualizationState,
  }
})
