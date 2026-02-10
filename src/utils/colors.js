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

/**
 * Generate gradient colors for items in a group.
 * @param {string[]} itemList - list of item labels
 * @param {number|number[]} hueOrHues - single base hue (number) or array of 3 anchor hues
 * @returns {Object} map of item label → hex color
 */
export function generateSpeciesGradientColors(itemList, hueOrHues) {
  const colors = {}
  const count = itemList.length

  if (Array.isArray(hueOrHues) && hueOrHues.length >= 2) {
    // Multi-hue mode: interpolate across anchor hues with varied lightness
    const anchors = hueOrHues
    const saturation = 72

    itemList.forEach((item, index) => {
      const position = count > 1 ? index / (count - 1) : 0.5

      // Interpolate hue across anchor points
      const segmentCount = anchors.length - 1
      const segmentPos = position * segmentCount
      const segIdx = Math.min(Math.floor(segmentPos), segmentCount - 1)
      const t = segmentPos - segIdx

      // Shortest-path hue interpolation
      let h0 = anchors[segIdx]
      let h1 = anchors[segIdx + 1]
      let diff = h1 - h0
      if (diff > 180) diff -= 360
      if (diff < -180) diff += 360
      const hue = ((h0 + diff * t) + 360) % 360

      // Vary lightness for additional distinction (50→38 across the range)
      const lightness = 50 - position * 12

      colors[item] = hslToHex(hue, saturation, lightness)
    })
  } else {
    // Single-hue mode (legacy): vary lightness with slight hue shift
    const baseHue = Array.isArray(hueOrHues) ? hueOrHues[0] : hueOrHues
    const saturation = 70
    const lightnessRange = [60, 45, 30]

    itemList.forEach((item, index) => {
      const position = count > 1 ? index / (count - 1) : 0.5

      let lightness
      if (position <= 0.5) {
        const tt = position * 2
        lightness = lightnessRange[0] + (lightnessRange[1] - lightnessRange[0]) * tt
      } else {
        const tt = (position - 0.5) * 2
        lightness = lightnessRange[1] + (lightnessRange[2] - lightnessRange[1]) * tt
      }

      const hueOffset = (position - 0.5) * 30
      const hue = (baseHue + hueOffset + 360) % 360

      colors[item] = hslToHex(hue, saturation, lightness)
    })
  }

  return colors
}

/**
 * Generate 3-color preview for the gradient preview bar.
 * @param {number|number[]} hueOrHues - single base hue or array of anchor hues
 * @returns {string[]} array of 3 hex colors
 */
export function generate3ColorPreview(hueOrHues) {
  if (Array.isArray(hueOrHues) && hueOrHues.length >= 2) {
    // Multi-hue: show the anchor colors at good saturation/lightness
    const anchors = hueOrHues
    const count = 3
    return Array.from({ length: count }, (_, i) => {
      const position = count > 1 ? i / (count - 1) : 0.5
      const segmentCount = anchors.length - 1
      const segmentPos = position * segmentCount
      const segIdx = Math.min(Math.floor(segmentPos), segmentCount - 1)
      const t = segmentPos - segIdx
      let h0 = anchors[segIdx]
      let h1 = anchors[segIdx + 1]
      let diff = h1 - h0
      if (diff > 180) diff -= 360
      if (diff < -180) diff += 360
      const hue = ((h0 + diff * t) + 360) % 360
      const lightness = 50 - position * 12
      return hslToHex(hue, 72, lightness)
    })
  }

  // Single hue fallback
  const baseHue = Array.isArray(hueOrHues) ? hueOrHues[0] : hueOrHues
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
