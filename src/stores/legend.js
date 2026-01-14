import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePersistenceStore } from './persistence'
import { useDataStore } from './data'

// Helper to get/set localStorage with fallback (uses persistence store)
const getStorage = (key, defaultValue) => {
  const persistenceStore = usePersistenceStore()
  return persistenceStore.get(key, defaultValue)
}

const setStorage = (key, value) => {
  const persistenceStore = usePersistenceStore()
  persistenceStore.set(key, value)
}

export const useLegendStore = defineStore('legend', () => {
  // Lazy getter for data store (avoid circular dependency)
  let _dataStore = null
  const getDataStore = () => {
    if (!_dataStore) _dataStore = useDataStore()
    return _dataStore
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // POSITION & SIZE STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // Position (x, y coordinates for free positioning)
  const position = ref(getStorage('legend-position', { x: 40, y: null }))

  // Size
  const size = ref(getStorage('legend-size', { width: 200, height: 'auto' }))

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  const showLegend = ref(true)
  const textScale = ref(getStorage('legend-text-scale', 1))
  const dotScale = ref(getStorage('legend-dot-scale', 1))
  const maxItems = ref(getStorage('legend-max-items', 15))

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIOR SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  const stickyEdges = ref(getStorage('legend-sticky', true))
  const snapThreshold = ref(20) // pixels

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMIZATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Custom labels (overrides for auto-generated labels)
  // Format: { 'originalLabel': 'customLabel' }
  const customLabels = ref(getStorage('legend-custom-labels', {}))

  // Custom colors (overrides for auto-generated colors)
  // Format: { 'label': '#hexcolor' }
  const customColors = ref(getStorage('legend-custom-colors', {}))

  // Hidden items (labels to hide from legend)
  const hiddenItems = ref(getStorage('legend-hidden-items', []))

  // Item order (for custom reordering, array of labels)
  const itemOrder = ref(getStorage('legend-item-order', []))

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUPING SETTINGS (for subspecies grouped by species)
  // ═══════════════════════════════════════════════════════════════════════════

  // Grouping options
  const groupingSettings = ref(getStorage('legend-grouping', {
    enabled: true,                     // Default: grouped view when applicable
    labelFormat: 'subspecies-only',    // 'subspecies-only' | 'abbreviated' (M. p. casabranca)
  }))

  // Species-level styling options
  const speciesStyling = ref(getStorage('legend-species-styling', {
    borderColor: false,                // Per-species border colors on map
    colorGradient: false,              // Color families per species
  }))

  // Per-species border colors (auto-generated or custom)
  // Format: { 'Mechanitis polymnia': '#ffffff', ... }
  const speciesBorderColors = ref(getStorage('legend-species-borders', {}))

  // Per-species base hues for gradient generation
  // Format: { 'Mechanitis polymnia': 210, ... } (hue values 0-360)
  const speciesBaseHues = ref(getStorage('legend-species-hues', {}))

  // Track which species groups are expanded/collapsed
  // Format: { 'Mechanitis polymnia': true, ... }
  const expandedGroups = ref({})

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if grouping is applicable (only for subspecies mode)
  const canGroup = computed(() => {
    const dataStore = getDataStore()
    return dataStore.colorBy === 'subspecies'
  })

  // Should display grouped
  const isGrouped = computed(() => canGroup.value && groupingSettings.value.enabled)

  // Check if there are any customizations
  const hasCustomizations = computed(() => {
    return Object.keys(customLabels.value).length > 0 ||
           Object.keys(customColors.value).length > 0 ||
           hiddenItems.value.length > 0 ||
           itemOrder.value.length > 0
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function updatePosition(x, y) {
    position.value = { x, y }
    setStorage('legend-position', position.value)
  }

  function updateSize(width, height) {
    size.value = { width, height }
    setStorage('legend-size', size.value)
  }

  function setTextScale(scale) {
    textScale.value = scale
    setStorage('legend-text-scale', scale)
  }

  function setDotScale(scale) {
    dotScale.value = scale
    setStorage('legend-dot-scale', scale)
  }

  function setMaxItems(max) {
    maxItems.value = max
    setStorage('legend-max-items', max)
  }

  function setStickyEdges(enabled) {
    stickyEdges.value = enabled
    setStorage('legend-sticky', enabled)
  }

  function setCustomLabel(originalLabel, customLabel) {
    if (customLabel && customLabel !== originalLabel) {
      customLabels.value[originalLabel] = customLabel
    } else {
      // Remove custom label if it matches original or is empty
      delete customLabels.value[originalLabel]
    }
    setStorage('legend-custom-labels', customLabels.value)
  }

  function getDisplayLabel(originalLabel) {
    return customLabels.value[originalLabel] || originalLabel
  }

  function setCustomColor(label, color) {
    if (color) {
      customColors.value[label] = color
    } else {
      delete customColors.value[label]
    }
    setStorage('legend-custom-colors', customColors.value)
  }

  function getDisplayColor(label, defaultColor) {
    return customColors.value[label] || defaultColor
  }

  function toggleItemVisibility(label) {
    const index = hiddenItems.value.indexOf(label)
    if (index > -1) {
      hiddenItems.value.splice(index, 1)
    } else {
      hiddenItems.value.push(label)
    }
    setStorage('legend-hidden-items', hiddenItems.value)
  }

  function isItemVisible(label) {
    return !hiddenItems.value.includes(label)
  }

  function setItemOrder(order) {
    itemOrder.value = order
    setStorage('legend-item-order', order)
  }

  function resetCustomizations() {
    customLabels.value = {}
    customColors.value = {}
    hiddenItems.value = []
    itemOrder.value = []
    setStorage('legend-custom-labels', {})
    setStorage('legend-custom-colors', {})
    setStorage('legend-hidden-items', [])
    setStorage('legend-item-order', [])
  }

  function resetPosition() {
    position.value = { x: 40, y: null }
    setStorage('legend-position', position.value)
  }

  function resetSize() {
    size.value = { width: 200, height: 'auto' }
    setStorage('legend-size', size.value)
  }

  function resetAll() {
    resetCustomizations()
    resetPosition()
    resetSize()
    resetSpeciesStyling()
    textScale.value = 1
    dotScale.value = 1
    maxItems.value = 15
    stickyEdges.value = true
    groupingSettings.value = { enabled: true, labelFormat: 'subspecies-only' }
    setStorage('legend-text-scale', 1)
    setStorage('legend-dot-scale', 1)
    setStorage('legend-max-items', 15)
    setStorage('legend-sticky', true)
    setStorage('legend-grouping', groupingSettings.value)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUPING ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function setGroupingEnabled(enabled) {
    groupingSettings.value.enabled = enabled
    setStorage('legend-grouping', groupingSettings.value)
  }

  function setLabelFormat(format) {
    groupingSettings.value.labelFormat = format
    setStorage('legend-grouping', groupingSettings.value)
  }

  function toggleGroupExpanded(species) {
    expandedGroups.value[species] = !expandedGroups.value[species]
  }

  function isGroupExpanded(species) {
    // Default to expanded if not set
    return expandedGroups.value[species] !== false
  }

  function expandAllGroups() {
    expandedGroups.value = {}
  }

  function collapseAllGroups(speciesList) {
    const collapsed = {}
    speciesList.forEach(species => {
      collapsed[species] = false
    })
    expandedGroups.value = collapsed
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIES STYLING ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function setSpeciesBorderColorEnabled(enabled) {
    speciesStyling.value.borderColor = enabled
    setStorage('legend-species-styling', speciesStyling.value)
  }

  function setSpeciesGradientEnabled(enabled) {
    speciesStyling.value.colorGradient = enabled
    setStorage('legend-species-styling', speciesStyling.value)
  }

  function setSpeciesBorderColor(species, color) {
    if (color) {
      speciesBorderColors.value[species] = color
    } else {
      delete speciesBorderColors.value[species]
    }
    setStorage('legend-species-borders', speciesBorderColors.value)
  }

  function setSpeciesBaseHue(species, hue) {
    if (hue !== null && hue !== undefined) {
      speciesBaseHues.value[species] = hue
    } else {
      delete speciesBaseHues.value[species]
    }
    setStorage('legend-species-hues', speciesBaseHues.value)
  }

  function resetSpeciesStyling() {
    speciesStyling.value = { borderColor: false, colorGradient: false }
    speciesBorderColors.value = {}
    speciesBaseHues.value = {}
    expandedGroups.value = {}
    setStorage('legend-species-styling', speciesStyling.value)
    setStorage('legend-species-borders', {})
    setStorage('legend-species-hues', {})
  }

  return {
    // State
    position,
    size,
    showLegend,
    textScale,
    dotScale,
    maxItems,
    stickyEdges,
    snapThreshold,
    customLabels,
    customColors,
    hiddenItems,
    itemOrder,

    // Grouping state
    groupingSettings,
    speciesStyling,
    speciesBorderColors,
    speciesBaseHues,
    expandedGroups,

    // Computed
    hasCustomizations,
    canGroup,
    isGrouped,

    // Actions
    updatePosition,
    updateSize,
    setTextScale,
    setDotScale,
    setMaxItems,
    setStickyEdges,
    setCustomLabel,
    getDisplayLabel,
    setCustomColor,
    getDisplayColor,
    toggleItemVisibility,
    isItemVisible,
    setItemOrder,
    resetCustomizations,
    resetPosition,
    resetSize,
    resetAll,

    // Grouping actions
    setGroupingEnabled,
    setLabelFormat,
    toggleGroupExpanded,
    isGroupExpanded,
    expandAllGroups,
    collapseAllGroups,

    // Species styling actions
    setSpeciesBorderColorEnabled,
    setSpeciesGradientEnabled,
    setSpeciesBorderColor,
    setSpeciesBaseHue,
    resetSpeciesStyling
  }
})
