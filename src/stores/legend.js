import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDataStore } from './data'
import { applyAbbreviationFormat } from '../utils/abbreviations'
import { getStorage, setStorage } from '../utils/storageHelpers'

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

  // Size ('auto' means auto-fit to content)
  const size = ref(getStorage('legend-size', { width: 'auto', height: 'auto' }))

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

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUPING SETTINGS (for subspecies grouped by species)
  // ═══════════════════════════════════════════════════════════════════════════

  // Extended grouping options
  const groupingSettings = ref(getStorage('legend-grouping', {
    enabled: true,                     // Enable grouping
    groupBy: 'species',                // 'none' | 'species' | 'genus' | 'tribe' | 'subfamily' | 'family'
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
  // DISPLAY NAME FORMAT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  // Global format for display names in group headers
  // Values: 'firstLetterGenus' | 'syllableGenus' | 'full' | 'custom' (per-species)
  const displayNameFormat = ref(getStorage('legend-display-name-format', 'full'))

  // Global format for prefix abbreviations (shown before subspecies)
  // Values: 'fullSpecies' | 'firstLetterBoth' | 'syllableBoth' | 'none' | 'custom' (per-species)
  const prefixFormat = ref(getStorage('legend-prefix-format', 'fullSpecies'))

  // Per-species custom display names (overrides global format)
  // Format: { 'Mechanitis polymnia': 'M. polymnia', ... }
  const speciesDisplayNames = ref(getStorage('legend-species-display-names', {}))

  // ═══════════════════════════════════════════════════════════════════════════
  // SORTING SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  // Sort by: 'alphabetical' (by display text) | 'abundance' (by count)
  const sortBy = ref(getStorage('legend-sort-by', 'alphabetical'))

  // Sort order: 'asc' | 'desc'
  const sortOrder = ref(getStorage('legend-sort-order', 'asc'))

  // ═══════════════════════════════════════════════════════════════════════════
  // WRAP/OUTDENT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  // Whether to wrap long labels with hanging indent (outdent) instead of ellipsis
  const wrapLabels = ref(getStorage('legend-wrap-labels', true))

  // Whether to show individual counts per legend item
  const showCounts = ref(getStorage('legend-show-counts', true))

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if grouping is applicable - works for any colorBy mode
  const canGroup = computed(() => {
    return groupingSettings.value.enabled &&
           effectiveGroupBy.value !== 'none'
  })

  // Should display grouped
  const isGrouped = computed(() => canGroup.value)

  // The actual groupBy value to use (validates against current colorBy)
  const effectiveGroupBy = computed(() => {
    const options = groupByOptions.value
    const current = groupingSettings.value.groupBy
    if (current === 'none') return 'none'
    if (options.some(o => o.value === current)) return current
    // Fall back to first valid non-'none' option
    const first = options.find(o => o.value !== 'none')
    return first ? first.value : 'none'
  })

  // Available groupBy options based on current colorBy
  // Grouping is available for ALL colorBy modes - you can group any attribute
  // by a taxonomy level or cross-dimension (e.g., status grouped by species)
  const groupByOptions = computed(() => {
    const dataStore = getDataStore()
    const colorBy = dataStore.colorBy
    const options = [{ value: 'none', label: 'None' }]

    // Taxonomy hierarchy: subspecies < species < genus < tribe < subfamily < family
    // For taxonomy colorBy modes: can group by any HIGHER level
    // For non-taxonomy colorBy modes (status, mimicry, source): can group by any taxonomy level
    const taxonomyOptions = [
      { value: 'subspecies', label: 'Subspecies' },
      { value: 'species', label: 'Species' },
      { value: 'genus', label: 'Genus' },
      { value: 'tribe', label: 'Tribe' },
      { value: 'subfamily', label: 'Subfamily' },
      { value: 'family', label: 'Family' }
    ]
    const taxonomyRank = { 'subspecies': 0, 'species': 1, 'genus': 2, 'tribe': 3, 'subfamily': 4, 'family': 5 }

    if (colorBy in taxonomyRank) {
      // Taxonomy colorBy: only allow grouping by HIGHER levels
      const currentRank = taxonomyRank[colorBy]
      for (const opt of taxonomyOptions) {
        if (taxonomyRank[opt.value] > currentRank) {
          options.push(opt)
        }
      }
    } else {
      // Non-taxonomy colorBy (status, mimicry, source): allow grouping by any taxonomy level
      options.push(...taxonomyOptions)
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
           Object.keys(speciesBorderColors.value).length > 0 ||
           Object.keys(speciesBaseHues.value).length > 0 ||
           Object.keys(speciesGradientEnabled.value).length > 0 ||
           Object.keys(speciesAbbreviations.value).length > 0 ||
           Object.keys(speciesAbbreviationVisible.value).length > 0 ||
           Object.keys(groupShapes.value).length > 0 ||
           Object.keys(speciesDisplayNames.value).length > 0 ||
           // Grouping settings changed from defaults
           groupingSettings.value.showHeaders !== false ||
           groupingSettings.value.prefixEnabled !== 'auto' ||
           groupingSettings.value.abbreviationStyle !== 'first-letter' ||
           // Species styling enabled
           speciesStyling.value.borderColor !== false ||
           speciesStyling.value.colorGradient !== false ||
           // Display name/prefix formats changed from defaults
           displayNameFormat.value !== 'full' ||
           prefixFormat.value !== 'fullSpecies' ||
           // Sorting/wrap changed from defaults
           sortBy.value !== 'alphabetical' ||
           sortOrder.value !== 'asc' ||
           wrapLabels.value !== true ||
           showCounts.value !== true
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Helper: reset a ref and persist it in one call
  function resetRef(r, key, value) {
    r.value = value
    setStorage(key, value)
  }

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

  function resetCustomizations() {
    // Label/color customizations
    resetRef(customLabels, 'legend-custom-labels', {})
    resetRef(customColors, 'legend-custom-colors', {})
    resetRef(hiddenItems, 'legend-hidden-items', [])

    // Species styling customizations
    resetRef(speciesBorderColors, 'legend-species-borders', {})
    resetRef(speciesBaseHues, 'legend-species-hues', {})
    resetRef(speciesGradientEnabled, 'legend-species-gradient-enabled', {})
    resetRef(speciesAbbreviations, 'legend-species-abbreviations', {})
    resetRef(speciesAbbreviationVisible, 'legend-species-abbrev-visible', {})
    resetRef(groupShapes, 'legend-group-shapes', {})

    // Grouping settings (preserve enabled/groupBy, reset display options)
    Object.assign(groupingSettings.value, { showHeaders: false, prefixEnabled: 'auto', abbreviationStyle: 'first-letter' })
    setStorage('legend-grouping', groupingSettings.value)

    // Species styling flags
    resetRef(speciesStyling, 'legend-species-styling', { borderColor: false, colorGradient: false })

    // Display name format
    resetRef(displayNameFormat, 'legend-display-name-format', 'full')
    resetRef(prefixFormat, 'legend-prefix-format', 'fullSpecies')
    resetRef(speciesDisplayNames, 'legend-species-display-names', {})

    // Sorting
    resetRef(sortBy, 'legend-sort-by', 'alphabetical')
    resetRef(sortOrder, 'legend-sort-order', 'asc')

    // Wrap labels & counts
    resetRef(wrapLabels, 'legend-wrap-labels', true)
    resetRef(showCounts, 'legend-show-counts', true)
  }

  function resetPosition() {
    resetRef(position, 'legend-position', { x: 40, y: null })
  }

  function resetSize() {
    resetRef(size, 'legend-size', { width: 'auto', height: 'auto' })
  }

  function resetAll() {
    resetCustomizations()
    resetPosition()
    resetSize()
    resetSpeciesStyling()
    resetShapeSettings()
    resetRef(textScale, 'legend-text-scale', 1)
    resetRef(dotScale, 'legend-dot-scale', 1)
    resetRef(maxItems, 'legend-max-items', 15)
    resetRef(stickyEdges, 'legend-sticky', true)
    resetRef(groupingSettings, 'legend-grouping', {
      enabled: true,
      groupBy: 'species',
      abbreviationStyle: 'first-letter',
      showHeaders: false,
      prefixEnabled: 'auto',
    })
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
    resetRef(speciesStyling, 'legend-species-styling', { borderColor: false, colorGradient: false })
    resetRef(speciesBorderColors, 'legend-species-borders', {})
    resetRef(speciesBaseHues, 'legend-species-hues', {})
    resetRef(speciesGradientEnabled, 'legend-species-gradient-enabled', {})
    resetRef(speciesAbbreviations, 'legend-species-abbreviations', {})
    resetRef(speciesAbbreviationVisible, 'legend-species-abbrev-visible', {})
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ABBREVIATION ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Get default abbreviation for a species based on current prefix format
  function getDefaultAbbreviation(species) {
    const format = prefixFormat.value
    if (format === 'none') return ''
    if (format === 'fullSpecies') return species
    // Use applyAbbreviationFormat for other formats
    const result = applyAbbreviationFormat(species, format)
    if (result) return result
    // Fallback: first letter of each word
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
  // DISPLAY NAME FORMAT ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Set global display name format (applies to all species)
  function setDisplayNameFormat(format) {
    displayNameFormat.value = format
    // When changing to a preset format, clear all custom display names
    if (format !== 'custom') {
      speciesDisplayNames.value = {}
      setStorage('legend-species-display-names', {})
    }
    setStorage('legend-display-name-format', format)
  }

  // Set global prefix format (applies to all species)
  function setPrefixFormat(format) {
    prefixFormat.value = format
    // When changing to a preset format, clear all custom abbreviations
    if (format !== 'custom') {
      speciesAbbreviations.value = {}
      setStorage('legend-species-abbreviations', {})
    }
    setStorage('legend-prefix-format', format)
  }

  // Set custom display name for a single species
  function setSpeciesDisplayName(species, displayName) {
    if (displayName && displayName.trim()) {
      speciesDisplayNames.value[species] = displayName.trim()
      // When setting custom per-species, switch to custom mode
      displayNameFormat.value = 'custom'
      setStorage('legend-display-name-format', 'custom')
    } else {
      delete speciesDisplayNames.value[species]
    }
    setStorage('legend-species-display-names', speciesDisplayNames.value)
  }

  // Get display name for a species (uses global format or custom per-species)
  function getSpeciesDisplayName(species) {
    // First check for per-species custom name
    if (speciesDisplayNames.value[species]) {
      return speciesDisplayNames.value[species]
    }
    // If no custom name, return null to indicate use global format
    return null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SORTING ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function setSortBy(value) {
    sortBy.value = value
    setStorage('legend-sort-by', value)
  }

  function setSortOrder(value) {
    sortOrder.value = value
    setStorage('legend-sort-order', value)
  }

  function toggleSortOrder() {
    const newOrder = sortOrder.value === 'asc' ? 'desc' : 'asc'
    setSortOrder(newOrder)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRAP LABEL ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function setWrapLabels(enabled) {
    wrapLabels.value = enabled
    setStorage('legend-wrap-labels', enabled)
  }

  function toggleWrapLabels() {
    setWrapLabels(!wrapLabels.value)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOW COUNTS ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function setShowCounts(enabled) {
    showCounts.value = enabled
    setStorage('legend-show-counts', enabled)
  }

  function toggleShowCounts() {
    setShowCounts(!showCounts.value)
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
    resetRef(shapeSettings, 'legend-shape-settings', { enabled: false, assignBy: 'species' })
    resetRef(groupShapes, 'legend-group-shapes', {})
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

    // Grouping state
    groupingSettings,
    speciesStyling,
    speciesBorderColors,
    speciesBaseHues,
    speciesGradientEnabled,
    speciesAbbreviations,
    speciesAbbreviationVisible,

    // Shape state
    shapeSettings,
    groupShapes,

    // Display name format state
    displayNameFormat,
    prefixFormat,
    speciesDisplayNames,

    // Sorting state
    sortBy,
    sortOrder,

    // Wrap labels state
    wrapLabels,

    // Show counts state
    showCounts,

    // Computed
    hasCustomizations,
    isGrouped,
    effectiveGroupBy,
    groupByOptions,
    canGroup,

    // Actions
    updatePosition,
    updateSize,
    setTextScale,
    setDotScale,
    setMaxItems,
    setStickyEdges,
    setCustomLabel,
    setCustomColor,
    toggleItemVisibility,
    isItemVisible,
    resetCustomizations,
    setGroupingEnabled,
    setGroupBy,
    setShowHeaders,
    setSpeciesBorderColor,
    setSpeciesBaseHue,
    setSpeciesGradientEnabledForSpecies,
    isSpeciesGradientEnabled,
    getSpeciesAbbreviation,
    setSpeciesAbbreviation,
    isAbbreviationVisible,
    setAbbreviationVisible,
    toggleAbbreviationVisible,
    setDisplayNameFormat,
    setPrefixFormat,
    setSpeciesDisplayName,
    getSpeciesDisplayName,
    setSortBy,
    setSortOrder,
    setGroupShape,
    getGroupShape,
    toggleWrapLabels,
    toggleShowCounts
  }
})
