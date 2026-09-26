// Color palette and mapping logic for map visualization
// Extracted from data.js for maintainability (~130 lines)

import { computed } from 'vue'
import { STATUS_COLORS, SOURCE_COLORS, DYNAMIC_COLORS } from '../utils/constants'
import { useLegendStore } from './legend'

// Both the legend and map use this rule. A collapsed species always takes its
// species color, including records with an unknown subspecies.
export function getFeatureColor(properties, subspeciesColors, speciesColors, collapsedSpecies) {
  const species = properties?.scientific_name
  if (collapsedSpecies?.includes(species)) {
    return speciesColors[species] || subspeciesColors[properties?.subspecies] || '#6b7280'
  }
  return subspeciesColors[properties?.subspecies] || '#6b7280'
}

/**
 * Composable for color mapping logic
 * @param {import('vue').Ref} colorBy - Current color-by mode
 * @param {import('vue').ComputedRef} displayGeoJSON - The displayed GeoJSON
 * @param {import('vue').ComputedRef} colorByAttribute - The attribute key for color-by
 */
export function useColorMapping(colorBy, displayGeoJSON, colorByAttribute) {

  const COLOR_PALETTES = {
    status: STATUS_COLORS,
    source: SOURCE_COLORS
  }

  const generateColorPalette = (values) => {
    const palette = {}
    values.forEach((val, idx) => {
      palette[val] = DYNAMIC_COLORS[idx % DYNAMIC_COLORS.length]
    })
    return palette
  }

  // Build species-subspecies mapping from displayed data
  const speciesSubspeciesMap = computed(() => {
    const geo = displayGeoJSON.value
    if (!geo?.features) return {}

    const map = {}
    for (const feature of geo.features) {
      const species = feature.properties.scientific_name
      const subspecies = feature.properties.subspecies

      if (!species || !subspecies) continue
      if (subspecies === 'Unknown' || subspecies === 'NA') continue

      if (!map[species]) {
        map[species] = new Set()
      }
      map[species].add(subspecies)
    }

    const result = {}
    for (const [species, subspeciesSet] of Object.entries(map)) {
      result[species] = [...subspeciesSet].sort()
    }

    return result
  })

  // Base color map without custom overrides
  const baseColorMap = computed(() => {
    const mode = colorBy.value
    const attr = colorByAttribute.value
    const geo = displayGeoJSON.value

    const displayedValues = geo?.features
      ? [...new Set(
          geo.features
            .map(f => f.properties[attr])
            .filter(v => v && v !== 'Unknown' && v !== 'NA' && v !== 'null')
        )].sort()
      : []

    let result = {}

    if (mode === 'status') {
      for (const val of displayedValues) {
        if (COLOR_PALETTES.status[val]) {
          result[val] = COLOR_PALETTES.status[val]
        }
      }
      if (Object.keys(result).length === 0) {
        result = { ...COLOR_PALETTES.status }
      }
    } else if (mode === 'source') {
      for (const val of displayedValues) {
        if (COLOR_PALETTES.source[val]) {
          result[val] = COLOR_PALETTES.source[val]
        }
      }
      if (Object.keys(result).length === 0) {
        result = { ...COLOR_PALETTES.source }
      }
    } else {
      result = generateColorPalette(displayedValues)
    }

    return result
  })

  // Active color map = base + custom overrides
  const activeColorMap = computed(() => {
    const legendStore = useLegendStore()
    const base = { ...baseColorMap.value }

    const legendCustomColors = legendStore.customColors
    for (const [label, customColor] of Object.entries(legendCustomColors)) {
      if (base[label] && customColor) {
        base[label] = customColor
      }
    }

    return base
  })

  const speciesColorMap = computed(() => {
    const species = [...new Set((displayGeoJSON.value?.features || [])
      .map(feature => feature.properties.scientific_name)
      .filter(value => value && value !== 'Unknown' && value !== 'NA'))].sort()
    const colors = generateColorPalette(species)
    const customColors = useLegendStore().customColors
    for (const name of species) {
      if (customColors[name]) colors[name] = customColors[name]
    }
    return colors
  })

  // Legend title based on colorBy
  const legendTitle = computed(() => {
    const legendStore = useLegendStore()
    if (colorBy.value === 'subspecies' &&
        legendStore.effectiveGroupBy === 'species' &&
        legendStore.collapsedSpecies.length > 0) {
      return 'Species / subspecies'
    }
    const titles = {
      'status': 'Sequencing Status',
      'subspecies': 'Subspecies',
      'species': 'Species',
      'genus': 'Genus',
      'mimicry': 'Mimicry Ring',
      'source': 'Data Source'
    }
    return titles[colorBy.value] || 'Legend'
  })

  return {
    speciesSubspeciesMap,
    baseColorMap,
    activeColorMap,
    speciesColorMap,
    legendTitle
  }
}
