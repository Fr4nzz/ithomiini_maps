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

  // Extended grouping options
  const groupingSettings = ref(getStorage('legend-grouping', {
    enabled: true,                     // Enable grouping
    groupBy: 'species',                // 'none' | 'species' | 'genus' | 'tribe' | 'subfamily' | 'family'
    labelFormat: 'abbreviated',        // 'full' | 'abbreviated'
    abbreviationStyle: 'first-letter', // 'first-letter' | 'first-three'
    showHeaders: false,                // Headers visible (default hidden)
    prefixEnabled: 'auto',             // true | false | 'auto' (smart default)
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

  // Per-species gradient enabled (whether to use color gradient for subspecies)
  // Format: { 'Mechanitis polymnia': true, ... }
  const speciesGradientEnabled = ref(getStorage('legend-species-gradient-enabled', {}))

  // Per-species custom abbreviations
  // Format: { 'Mechanitis polymnia': 'M. p.', ... }
  const speciesAbbreviations = ref(getStorage('legend-species-abbreviations', {}))

  // Per-species abbreviation visibility (whether to show prefix for subspecies)
  // Format: { 'Mechanitis polymnia': true, ... } - true = show abbreviation prefix
  const speciesAbbreviationVisible = ref(getStorage('legend-species-abbrev-visible', {}))

  // Track which species groups are expanded/collapsed
  // Format: { 'Mechanitis polymnia': true, ... }
  const expandedGroups = ref({})

  // ═══════════════════════════════════════════════════════════════════════════
  // SHAPE SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  // Shape configuration
  const shapeSettings = ref(getStorage('legend-shape-settings', {
    enabled: false,                    // Use shapes on map
    assignBy: 'species',               // 'species' | 'genus' | 'mimicry' | 'custom'
  }))

  // Per-group shapes (custom assignments)
  // Format: { 'Mechanitis polymnia': 'triangle', ... }
  const groupShapes = ref(getStorage('legend-group-shapes', {}))

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if grouping is applicable - only when colorBy is subspecies
  const canGroup = computed(() => {
    const dataStore = getDataStore()
    return dataStore.colorBy === 'subspecies' && groupingSettings.value.enabled
  })

  // Should display grouped - only subspecies can be grouped by species
  const isGrouped = computed(() => canGroup.value)

  // Available groupBy options based on current colorBy
  const groupByOptions = computed(() => {
    const dataStore = getDataStore()
    const colorBy = dataStore.colorBy
    const options = [{ value: 'none', label: 'None' }]

    if (colorBy === 'subspecies') {
      options.push(
        { value: 'species', label: 'Species' },
        { value: 'genus', label: 'Genus' },
        { value: 'tribe', label: 'Tribe' },
        { value: 'subfamily', label: 'Subfamily' },
        { value: 'family', label: 'Family' }
      )
    } else if (colorBy === 'species') {
      options.push(
        { value: 'genus', label: 'Genus' },
        { value: 'tribe', label: 'Tribe' },
        { value: 'subfamily', label: 'Subfamily' },
        { value: 'family', label: 'Family' }
      )
    } else if (colorBy === 'genus') {
      options.push(
        { value: 'tribe', label: 'Tribe' },
        { value: 'subfamily', label: 'Subfamily' },
        { value: 'family', label: 'Family' }
      )
    }

    return options
  })

  // Smart prefix behavior: show prefix when headers are hidden (auto mode)
  const shouldShowPrefix = computed(() => {
    const prefixEnabled = groupingSettings.value.prefixEnabled
    if (prefixEnabled === 'auto') {
      // Auto: show prefix when headers hidden
      return !groupingSettings.value.showHeaders
    }
    return prefixEnabled === true
  })

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
    resetShapeSettings()
    textScale.value = 1
    dotScale.value = 1
    maxItems.value = 15
    stickyEdges.value = true
    groupingSettings.value = {
      enabled: true,
      groupBy: 'species',
      labelFormat: 'abbreviated',
      abbreviationStyle: 'first-letter',
      showHeaders: false,
      prefixEnabled: 'auto',
    }
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

  function setGroupBy(value) {
    groupingSettings.value.groupBy = value
    setStorage('legend-grouping', groupingSettings.value)
  }

  function setLabelFormat(format) {
    groupingSettings.value.labelFormat = format
    setStorage('legend-grouping', groupingSettings.value)
  }

  function setAbbreviationStyle(style) {
    groupingSettings.value.abbreviationStyle = style
    setStorage('legend-grouping', groupingSettings.value)
  }

  function setShowHeaders(show) {
    groupingSettings.value.showHeaders = show
    setStorage('legend-grouping', groupingSettings.value)
  }

  function toggleHeaders() {
    groupingSettings.value.showHeaders = !groupingSettings.value.showHeaders
    setStorage('legend-grouping', groupingSettings.value)
  }

  function setPrefixEnabled(value) {
    // value can be true, false, or 'auto'
    groupingSettings.value.prefixEnabled = value
    setStorage('legend-grouping', groupingSettings.value)
  }

  function toggleGroupExpanded(groupKey) {
    expandedGroups.value[groupKey] = !expandedGroups.value[groupKey]
  }

  function isGroupExpanded(groupKey) {
    // Default to expanded if not set
    return expandedGroups.value[groupKey] !== false
  }

  function expandAllGroups() {
    expandedGroups.value = {}
  }

  function collapseAllGroups(groupList) {
    const collapsed = {}
    groupList.forEach(group => {
      collapsed[group] = false
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
      // Auto-enable per-species border colors when user sets one
      if (!speciesStyling.value.borderColor) {
        speciesStyling.value.borderColor = true
        setStorage('legend-species-styling', speciesStyling.value)
      }
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

  // Set whether gradient is enabled for a specific species
  function setSpeciesGradientEnabledForSpecies(species, enabled) {
    if (enabled) {
      speciesGradientEnabled.value[species] = true
    } else {
      delete speciesGradientEnabled.value[species]
    }
    setStorage('legend-species-gradient-enabled', speciesGradientEnabled.value)
  }

  // Check if gradient is enabled for a specific species
  function isSpeciesGradientEnabled(species) {
    return speciesGradientEnabled.value[species] === true
  }

  function resetSpeciesStyling() {
    speciesStyling.value = { borderColor: false, colorGradient: false }
    speciesBorderColors.value = {}
    speciesBaseHues.value = {}
    speciesGradientEnabled.value = {}
    speciesAbbreviations.value = {}
    speciesAbbreviationVisible.value = {}
    expandedGroups.value = {}
    setStorage('legend-species-styling', speciesStyling.value)
    setStorage('legend-species-borders', {})
    setStorage('legend-species-hues', {})
    setStorage('legend-species-gradient-enabled', {})
    setStorage('legend-species-abbreviations', {})
    setStorage('legend-species-abbrev-visible', {})
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ABBREVIATION ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Get default abbreviation for a species (first letter of each word)
  function getDefaultAbbreviation(species) {
    const parts = species.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}. ${parts[1][0]}.`
    }
    return species.slice(0, 3) + '.'
  }

  // Get the abbreviation for a species (custom or default)
  function getSpeciesAbbreviation(species) {
    return speciesAbbreviations.value[species] || getDefaultAbbreviation(species)
  }

  // Set a custom abbreviation for a species
  function setSpeciesAbbreviation(species, abbrev) {
    const defaultAbbrev = getDefaultAbbreviation(species)
    if (abbrev && abbrev !== defaultAbbrev) {
      speciesAbbreviations.value[species] = abbrev
    } else {
      // Remove custom abbreviation to use default
      delete speciesAbbreviations.value[species]
    }
    setStorage('legend-species-abbreviations', speciesAbbreviations.value)
  }

  // Check if abbreviation prefix should be shown for a species
  function isAbbreviationVisible(species) {
    // If not explicitly set, default based on whether headers are shown
    if (speciesAbbreviationVisible.value[species] === undefined) {
      // Default: show abbreviation when headers are hidden
      return !groupingSettings.value.showHeaders
    }
    return speciesAbbreviationVisible.value[species]
  }

  // Set abbreviation visibility for a species
  function setAbbreviationVisible(species, visible) {
    speciesAbbreviationVisible.value[species] = visible
    setStorage('legend-species-abbrev-visible', speciesAbbreviationVisible.value)
  }

  // Toggle abbreviation visibility for a species
  function toggleAbbreviationVisible(species) {
    const current = isAbbreviationVisible(species)
    setAbbreviationVisible(species, !current)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHAPE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function setShapesEnabled(enabled) {
    shapeSettings.value.enabled = enabled
    setStorage('legend-shape-settings', shapeSettings.value)
  }

  function setShapeAssignBy(assignBy) {
    shapeSettings.value.assignBy = assignBy
    setStorage('legend-shape-settings', shapeSettings.value)
  }

  function setGroupShape(groupKey, shape) {
    if (shape && shape !== 'circle') {
      groupShapes.value[groupKey] = shape
      // Auto-enable shapes when user assigns a non-circle shape
      if (!shapeSettings.value.enabled) {
        shapeSettings.value.enabled = true
        setStorage('legend-shape-settings', shapeSettings.value)
      }
    } else {
      // Remove to use default circle
      delete groupShapes.value[groupKey]
    }
    setStorage('legend-group-shapes', groupShapes.value)
  }

  function getGroupShape(groupKey) {
    return groupShapes.value[groupKey] || 'circle'
  }

  function resetShapeSettings() {
    shapeSettings.value = { enabled: false, assignBy: 'species' }
    groupShapes.value = {}
    setStorage('legend-shape-settings', shapeSettings.value)
    setStorage('legend-group-shapes', {})
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
    speciesGradientEnabled,
    speciesAbbreviations,
    speciesAbbreviationVisible,
    expandedGroups,

    // Shape state
    shapeSettings,
    groupShapes,

    // Computed
    hasCustomizations,
    canGroup,
    isGrouped,
    groupByOptions,
    shouldShowPrefix,

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
    setGroupBy,
    setLabelFormat,
    setAbbreviationStyle,
    setShowHeaders,
    toggleHeaders,
    setPrefixEnabled,
    toggleGroupExpanded,
    isGroupExpanded,
    expandAllGroups,
    collapseAllGroups,

    // Species styling actions
    setSpeciesBorderColorEnabled,
    setSpeciesGradientEnabled,
    setSpeciesBorderColor,
    setSpeciesBaseHue,
    setSpeciesGradientEnabledForSpecies,
    isSpeciesGradientEnabled,
    resetSpeciesStyling,

    // Abbreviation actions
    getDefaultAbbreviation,
    getSpeciesAbbreviation,
    setSpeciesAbbreviation,
    isAbbreviationVisible,
    setAbbreviationVisible,
    toggleAbbreviationVisible,

    // Shape actions
    setShapesEnabled,
    setShapeAssignBy,
    setGroupShape,
    getGroupShape,
    resetShapeSettings
  }
})
