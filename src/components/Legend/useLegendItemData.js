// Legend item computation, grouping, sorting, and label formatting
// Extracted from Legend.vue for maintainability (~490 lines)

import { computed } from 'vue'
import { generateSpeciesBorderColors } from '../../utils/colors'
import { applyAbbreviationFormat } from '../../utils/abbreviations'
import { DYNAMIC_COLORS, SOURCE_COLORS, STATUS_COLORS } from '../../utils/constants'

// Map groupBy setting to GeoJSON property name
const groupByPropertyMap = {
  'subspecies': 'subspecies',
  'species': 'scientific_name',
  'genus': 'genus',
  'tribe': 'tribe',
  'subfamily': 'subfamily',
  'family': 'family',
  'status': 'sequencing_status',
  'mimicry': 'mimicry_ring',
  'source': 'source'
}

const DEFAULT_SOURCE_FILTER = ['Sanger Institute']

function isLegendValueValid(value) {
  return value && value !== 'Unknown' && value !== 'NA' && value !== 'null'
}

function generateColorPalette(values) {
  const palette = {}
  values.forEach((value, index) => {
    palette[value] = DYNAMIC_COLORS[index % DYNAMIC_COLORS.length]
  })
  return palette
}

function buildLegendPalette(mode, labels) {
  if (mode === 'status') {
    const palette = {}
    for (const label of labels) {
      if (STATUS_COLORS[label]) palette[label] = STATUS_COLORS[label]
    }
    return Object.keys(palette).length > 0 ? palette : { ...STATUS_COLORS }
  }

  if (mode === 'source') {
    const palette = {}
    for (const label of labels) {
      if (SOURCE_COLORS[label]) palette[label] = SOURCE_COLORS[label]
    }
    return Object.keys(palette).length > 0 ? palette : { ...SOURCE_COLORS }
  }

  return generateColorPalette(labels)
}

function hasArrayFilter(values) {
  return Array.isArray(values) && values.length > 0
}

function hasDefaultOnlySource(sourceValues) {
  return Array.isArray(sourceValues) &&
    sourceValues.length === DEFAULT_SOURCE_FILTER.length &&
    sourceValues.every((value, index) => value === DEFAULT_SOURCE_FILTER[index])
}

/**
 * Composable for legend item data computation
 * @param {Object} dataStore - Data store instance
 * @param {Object} legendStore - Legend store instance
 * @param {import('vue').ComputedRef} isExportMode - Whether export mode is active
 */
export function useLegendItemData(dataStore, legendStore, isExportMode) {

  const legendFilterMode = computed(() => {
    const filters = dataStore.filters
    if (!filters) return dataStore.colorBy

    const speciesActive = hasArrayFilter(filters.species)
    const mimicryActive = hasArrayFilter(filters.mimicry)
    const countryActive = filters.country && filters.country !== 'All'

    const hasMeaningfulFilters =
      filters.family !== 'All' ||
      filters.tribe !== 'All' ||
      filters.genus !== 'All' ||
      speciesActive ||
      hasArrayFilter(filters.subspecies) ||
      mimicryActive ||
      hasArrayFilter(filters.status) ||
      !hasDefaultOnlySource(filters.source) ||
      filters.sex !== 'all' ||
      countryActive ||
      !!filters.camidSearch ||
      !!filters.dateStart ||
      !!filters.dateEnd ||
      filters.goatCoverage !== 'all' ||
      hasArrayFilter(filters.goatDataSource) ||
      filters.goatChromosomeMin != null ||
      filters.goatChromosomeMax != null ||
      !!dataStore.boundingBox

    if (!hasMeaningfulFilters) return 'genus'
    if (speciesActive) return 'species'
    if (mimicryActive) return 'mimicry'
    if (countryActive) return 'genus'
    return dataStore.colorBy
  })

  const legendAttribute = computed(() => groupByPropertyMap[legendFilterMode.value] || dataStore.colorByAttribute)
  const legendGeoJSON = computed(() => dataStore.filteredGeoJSON || dataStore.displayGeoJSON)

  // Color map from legend source data (includes custom overrides - used for display)
  const colorMap = computed(() => {
    const geo = legendGeoJSON.value
    const attr = legendAttribute.value
    const labels = geo?.features
      ? [...new Set(
          geo.features
            .map(feature => feature.properties[attr])
            .filter(isLegendValueValid)
        )].sort()
      : []

    const palette = buildLegendPalette(legendFilterMode.value, labels)

    for (const [label, customColor] of Object.entries(legendStore.customColors)) {
      if (palette[label] && customColor) palette[label] = customColor
    }

    return palette
  })

  // Base color map (without custom overrides - used for defaultColor/reset)
  const baseColors = computed(() => {
    return buildLegendPalette(legendFilterMode.value, Object.keys(colorMap.value))
  })

  const canUseGrouping = computed(() => legendFilterMode.value === dataStore.colorBy)

  // Build item→group mapping from displayed data
  const itemGroupMap = computed(() => {
    if (!canUseGrouping.value) return {}

    const geo = legendGeoJSON.value
    if (!geo?.features) return {}

    const groupBy = legendStore.effectiveGroupBy
    const groupProperty = groupByPropertyMap[groupBy]
    if (!groupProperty) return {}

    const itemProperty = dataStore.colorByAttribute

    const map = {}
    for (const feature of geo.features) {
      const groupVal = feature.properties[groupProperty]
      const itemVal = feature.properties[itemProperty]

      if (!groupVal || !isLegendValueValid(itemVal)) continue

      if (!map[groupVal]) {
        map[groupVal] = new Set()
      }
      map[groupVal].add(itemVal)
    }

    return map
  })

  // Reverse lookup: item label → array of group names (O(1) per item)
  const itemToGroupsMap = computed(() => {
    const reverse = new Map()
    for (const [group, items] of Object.entries(itemGroupMap.value)) {
      for (const item of items) {
        if (!reverse.has(item)) reverse.set(item, [])
        reverse.get(item).push(group)
      }
    }
    return reverse
  })

  // Map subspecies label → species name
  const subspeciesSpeciesMap = computed(() => {
    const geo = legendGeoJSON.value
    if (!geo?.features || legendFilterMode.value !== 'subspecies') return {}
    const map = {}
    for (const f of geo.features) {
      const subsp = f.properties.subspecies
      const species = f.properties.scientific_name
      if (subsp && species && !map[subsp]) map[subsp] = species
    }
    return map
  })

  // Get list of groups (sorted)
  const groupList = computed(() => Object.keys(itemGroupMap.value).sort())

  // Generate border colors for groups
  const groupBorderColors = computed(() => {
    if (!legendStore.speciesStyling.borderColor) return {}
    return generateSpeciesBorderColors(groupList.value, legendStore.speciesBorderColors)
  })

  function getGroupBorderColor(groupName) {
    return groupBorderColors.value[groupName] || dataStore.mapStyle.borderColor
  }

  function hasCustomizedStyle(groupName) {
    const shape = legendStore.getGroupShape(groupName)
    const hasCustomShape = shape && shape !== 'circle'
    const hasCustomBorder = !!legendStore.speciesBorderColors[groupName]
    return hasCustomShape || hasCustomBorder
  }

  const anyGroupHasCustomStyle = computed(() => {
    return groupList.value.some(name => hasCustomizedStyle(name))
  })

  function getGroupForItem(itemLabel) {
    const groups = itemToGroupsMap.value.get(itemLabel)
    return groups ? groups[0] : null
  }

  function getGroupsForItem(itemLabel) {
    return itemToGroupsMap.value.get(itemLabel) || []
  }

  function formatLabel(itemLabel, groupName) {
    const isGroupedBySpecies = legendStore.effectiveGroupBy === 'species'

    if (dataStore.colorBy === 'subspecies' && !isGroupedBySpecies) {
      if (legendStore.prefixFormat === 'none') return itemLabel
      const species = subspeciesSpeciesMap.value[itemLabel]
      if (species) {
        const abbreviation = legendStore.getSpeciesAbbreviation(species)
        if (abbreviation) return `${abbreviation} ${itemLabel}`
      }
      return itemLabel
    }

    if (!groupName || !legendStore.isAbbreviationVisible(groupName)) {
      return itemLabel
    }

    const abbreviation = legendStore.getSpeciesAbbreviation(groupName)
    return `${abbreviation} ${itemLabel}`
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGEND COUNTS
  // ═══════════════════════════════════════════════════════════════════════════

  const legendCounts = computed(() => {
    const geo = legendGeoJSON.value
    if (!geo?.features) return {}
    const attr = legendAttribute.value
    const hidden = new Set(legendStore.hiddenItems)
    const counts = {}
    for (const feature of geo.features) {
      const val = feature.properties[attr]
      if (isLegendValueValid(val) && !hidden.has(val)) {
        counts[val] = (counts[val] || 0) + 1
      }
    }
    return counts
  })

  const legendGroupCounts = computed(() => {
    const geo = legendGeoJSON.value
    if (!geo?.features) return {}
    if (!legendStore.isGrouped || !canUseGrouping.value) return {}
    const attr = legendAttribute.value
    const groupBy = legendStore.effectiveGroupBy
    const groupProperty = groupByPropertyMap[groupBy]
    if (!groupProperty) return {}
    const hidden = new Set(legendStore.hiddenItems)
    const counts = {}
    for (const feature of geo.features) {
      const val = feature.properties[attr]
      const groupVal = feature.properties[groupProperty]
      if (isLegendValueValid(val) && !hidden.has(val) && groupVal) {
        const key = `${groupVal}\0${val}`
        counts[key] = (counts[key] || 0) + 1
      }
    }
    return counts
  })

  function getGroupItemCount(groupName, itemLabel) {
    return legendGroupCounts.value[`${groupName}\0${itemLabel}`] || 0
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SORTED ITEMS & LEGEND ITEMS
  // ═══════════════════════════════════════════════════════════════════════════

  const sortedAllItems = computed(() => {
    const sortByVal = legendStore.sortBy
    const sortOrderVal = legendStore.sortOrder
    const counts = legendCounts.value
    const entries = Object.entries(colorMap.value)

    const items = []
    const baseMap = baseColors.value
    for (const [label, color] of entries) {
      if (!legendStore.isItemVisible(label)) continue
      items.push({
        label,
        color,
        defaultColor: baseMap[label] || color,
        customLabel: legendStore.customLabels[label] || '',
        customColor: legendStore.customColors[label] || '',
        visible: true
      })
    }

    if (sortByVal === 'abundance') {
      items.sort((a, b) => {
        const countA = counts[a.label] || 0
        const countB = counts[b.label] || 0
        return sortOrderVal === 'asc' ? countA - countB : countB - countA
      })
    } else {
      items.sort((a, b) => {
        const textA = a.label.toLowerCase()
        const textB = b.label.toLowerCase()
        return sortOrderVal === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA)
      })
    }

    return items
  })

  const legendItems = computed(() => {
    let items = sortedAllItems.value.slice()

    if (!isExportMode.value) {
      const baseMap = baseColors.value
      for (const label of legendStore.hiddenItems) {
        if (colorMap.value[label]) {
          items.push({
            label,
            color: colorMap.value[label],
            defaultColor: baseMap[label] || colorMap.value[label],
            customLabel: legendStore.customLabels[label] || '',
            customColor: legendStore.customColors[label] || '',
            visible: false
          })
        }
      }
    }

    return items
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SORT HELPERS & GROUPED DATA
  // ═══════════════════════════════════════════════════════════════════════════

  function sortItemsByText(items, order) {
    return items.slice().sort((a, b) => {
      const textA = (a.displayLabel || a.label).toLowerCase()
      const textB = (b.displayLabel || b.label).toLowerCase()
      return order === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA)
    })
  }

  function sortItemsByAbundance(items, order, counts) {
    return items.slice().sort((a, b) => {
      const countA = counts[a.label] || 0
      const countB = counts[b.label] || 0
      return order === 'asc' ? countA - countB : countB - countA
    })
  }

  function groupItemsByGroup(items) {
    const byGroup = {}
    for (const item of items) {
      const groups = getGroupsForItem(item.label)
      for (const group of groups) {
        if (!byGroup[group]) byGroup[group] = []
        byGroup[group].push(item)
      }
    }
    return byGroup
  }

  function sortGroups(groups, sortBy, sortOrder, counts) {
    if (sortBy === 'abundance') {
      groups.sort((a, b) => {
        const totalA = a.items.reduce((sum, item) => sum + (counts[item.label] || 0), 0)
        const totalB = b.items.reduce((sum, item) => sum + (counts[item.label] || 0), 0)
        return sortOrder === 'asc' ? totalA - totalB : totalB - totalA
      })
    } else {
      groups.sort((a, b) => {
        const textA = a.name.toLowerCase()
        const textB = b.name.toLowerCase()
        return sortOrder === 'asc' ? textA.localeCompare(textB) : textB.localeCompare(textA)
      })
    }
    return groups
  }

  function contractSpeciesName(speciesName) {
    if (!speciesName) return ''
    const parts = speciesName.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
    }
    return speciesName
  }

  function buildGroupData(groupName, items, sortByVal, sortOrderVal, counts, multiGroupLabels) {
    let customLabel = legendStore.getSpeciesDisplayName(groupName)
    if (!customLabel && legendStore.displayNameFormat !== 'firstLetterGenus') {
      customLabel = applyAbbreviationFormat(groupName, legendStore.displayNameFormat)
    }

    const headersHidden = !legendStore.groupingSettings.showHeaders && !legendStore.isNonTaxonomyGroupBy
    const needsDisambiguation = headersHidden && multiGroupLabels

    let mappedItems = items.map(item => {
      const shouldDisambiguate = needsDisambiguation && multiGroupLabels.has(item.label)
      // When disambiguating, skip the abbreviation prefix from formatLabel
      // to avoid double species info (prefix + suffix).
      let displayLabel = shouldDisambiguate
        ? item.label
        : formatLabel(item.label, groupName)
      if (shouldDisambiguate) {
        displayLabel += ` (${contractSpeciesName(groupName)})`
      }
      return { ...item, displayLabel }
    })

    mappedItems = sortByVal === 'abundance'
      ? sortItemsByAbundance(mappedItems, sortOrderVal, counts)
      : sortItemsByText(mappedItems, sortOrderVal)

    return {
      name: groupName,
      borderColor: getGroupBorderColor(groupName),
      shape: legendStore.getGroupShape(groupName),
      abbreviation: legendStore.getSpeciesAbbreviation(groupName),
      abbreviationVisible: legendStore.isAbbreviationVisible(groupName),
      customLabel: customLabel || '',
      items: mappedItems
    }
  }

  const groupedLegendData = computed(() => {
    const sortByVal = legendStore.sortBy
    const sortOrderVal = legendStore.sortOrder
    const counts = legendCounts.value

    if (!legendStore.isGrouped || !canUseGrouping.value) {
      return { type: 'flat', items: legendItems.value.slice() }
    }

    const itemsByGroup = groupItemsByGroup(legendItems.value)

    const labelGroupCount = new Map()
    for (const [groupName, items] of Object.entries(itemsByGroup)) {
      for (const item of items) {
        labelGroupCount.set(item.label, (labelGroupCount.get(item.label) || 0) + 1)
      }
    }
    const multiGroupLabels = new Set()
    for (const [label, count] of labelGroupCount) {
      if (count > 1) multiGroupLabels.add(label)
    }

    let groups = Object.keys(itemsByGroup).map(groupName =>
      buildGroupData(groupName, itemsByGroup[groupName], sortByVal, sortOrderVal, counts,
        multiGroupLabels.size > 0 ? multiGroupLabels : null)
    )

    groups = sortGroups(groups, sortByVal, sortOrderVal, counts)

    return { type: 'grouped', groups }
  })

  // Count unique visible labels actually shown in the legend
  function countShownLabels() {
    const gld = groupedLegendData.value
    const shown = new Set()
    if (gld.type === 'grouped') {
      for (const g of gld.groups) {
        for (const item of g.items) {
          if (item.visible !== false) shown.add(item.label)
        }
      }
    } else {
      for (const item of (gld.items || [])) {
        if (item.visible !== false) shown.add(item.label)
      }
    }
    return shown
  }

  const moreCount = computed(() => {
    const totalVisible = sortedAllItems.value.length
    const shown = countShownLabels()
    return Math.max(0, totalVisible - shown.size)
  })

  const morePointCount = computed(() => {
    if (!legendStore.showCounts || moreCount.value === 0) return null
    const shown = countShownLabels()
    const counts = legendCounts.value
    let total = 0
    for (const [label, cnt] of Object.entries(counts)) {
      if (!shown.has(label)) {
        total += cnt
      }
    }
    return total
  })

  return {
    colorMap,
    baseColors,
    itemGroupMap,
    itemToGroupsMap,
    subspeciesSpeciesMap,
    groupList,
    groupBorderColors,
    getGroupBorderColor,
    hasCustomizedStyle,
    anyGroupHasCustomStyle,
    getGroupForItem,
    getGroupsForItem,
    formatLabel,
    legendCounts,
    legendGroupCounts,
    getGroupItemCount,
    sortedAllItems,
    legendItems,
    groupedLegendData,
    moreCount,
    morePointCount
  }
}
