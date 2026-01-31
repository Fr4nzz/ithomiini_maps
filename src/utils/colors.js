export const COLOR_PICKER_PALETTE = [
  // Primary row - bright colors
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
  // Secondary row - muted/pastel
  '#fca5a5', '#fdba74', '#fcd34d', '#fde047', '#bef264',
  '#86efac', '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc',
  '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc',
  '#f9a8d4', '#fda4af',
  // Neutral row
  '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4',
  '#e5e5e5', '#f5f5f5', '#ffffff', '#262626', '#000000'
]

// High-contrast border colors for distinguishing species
const SPECIES_BORDER_PALETTE = [
  '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#000000',
]

// Base hues for species color gradients (evenly distributed on color wheel)
const SPECIES_HUE_PALETTE = [
  210, 120, 30, 270, 180, 330, 60, 300, 150, 0,
]

export function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function generateSpeciesBorderColors(speciesList, existing = {}) {
  const result = { ...existing }
  let colorIndex = 0

  for (const species of speciesList) {
    if (!result[species]) {
      result[species] = SPECIES_BORDER_PALETTE[colorIndex % SPECIES_BORDER_PALETTE.length]
      colorIndex++
    }
  }

  return result
}

export function generateSpeciesBaseHues(speciesList, existing = {}) {
  const result = { ...existing }
  let hueIndex = 0

  for (const species of speciesList) {
    if (result[species] === undefined) {
      result[species] = SPECIES_HUE_PALETTE[hueIndex % SPECIES_HUE_PALETTE.length]
      hueIndex++
    }
  }

  return result
}

export function generateSpeciesGradientColors(subspeciesList, baseHue) {
  const colors = {}
  const count = subspeciesList.length
  const saturation = 70
  const lightnessRange = [60, 45, 30]

  subspeciesList.forEach((subspecies, index) => {
    const position = count > 1 ? index / (count - 1) : 0.5

    let lightness
    if (position <= 0.5) {
      const t = position * 2
      lightness = lightnessRange[0] + (lightnessRange[1] - lightnessRange[0]) * t
    } else {
      const t = (position - 0.5) * 2
      lightness = lightnessRange[1] + (lightnessRange[2] - lightnessRange[1]) * t
    }

    // Small hue variation for additional distinction (+-15 degrees max)
    const hueOffset = (position - 0.5) * 30
    const hue = (baseHue + hueOffset + 360) % 360

    colors[subspecies] = hslToHex(hue, saturation, lightness)
  })

  return colors
}

export function generate3ColorPreview(baseHue) {
  const saturation = 70
  const lightnessRange = [60, 45, 30]
  const hueOffsets = [-15, 0, 15]

  return lightnessRange.map((lightness, i) => {
    const hue = (baseHue + hueOffsets[i] + 360) % 360
    return hslToHex(hue, saturation, lightness)
  })
}

export function generateGroupedColorMap(speciesSubspeciesMap, hueAssignments, customColors = {}) {
  const colorMap = {}
  const speciesList = Object.keys(speciesSubspeciesMap).sort()
  const hues = generateSpeciesBaseHues(speciesList, hueAssignments)

  for (const species of speciesList) {
    const subspecies = speciesSubspeciesMap[species]
    const baseHue = hues[species]
    const speciesColors = generateSpeciesGradientColors(subspecies, baseHue)

    for (const ssp of subspecies) {
      colorMap[ssp] = customColors[ssp] || speciesColors[ssp]
    }
  }

  return colorMap
}
