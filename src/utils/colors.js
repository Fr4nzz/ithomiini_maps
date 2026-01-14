// ═══════════════════════════════════════════════════════════════════════════
// COLOR UTILITIES - Single source of truth for all colors
// ═══════════════════════════════════════════════════════════════════════════

// Re-export from constants for backward compatibility
export { STATUS_COLORS, SOURCE_COLORS, DYNAMIC_COLORS, getStatusColor } from './constants'

// Import for local use
import { STATUS_COLORS, SOURCE_COLORS, DYNAMIC_COLORS } from './constants'

// ═══════════════════════════════════════════════════════════════════════════
// COLOR MANIPULATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string (with or without #)
 * @returns {Object} { r, g, b }
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

/**
 * Convert RGB to hex color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string with #
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Lighten a color by a percentage
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color
 */
export function lightenColor(hex, percent) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const factor = percent / 100
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  )
}

/**
 * Darken a color by a percentage
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
export function darkenColor(hex, percent) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const factor = 1 - percent / 100
  return rgbToHex(
    rgb.r * factor,
    rgb.g * factor,
    rgb.b * factor
  )
}

/**
 * Get color with transparency
 * @param {string} hex - Hex color
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export function colorWithAlpha(hex, alpha) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/**
 * Calculate relative luminance of a color (for contrast checking)
 * @param {string} hex - Hex color
 * @returns {number} Luminance value (0-1)
 */
export function getLuminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Determine if text should be light or dark for a background color
 * @param {string} bgHex - Background hex color
 * @returns {string} '#ffffff' or '#000000'
 */
export function getContrastTextColor(bgHex) {
  const luminance = getLuminance(bgHex)
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a color palette for a list of values
 * @param {Array} values - Array of string values
 * @param {Object} existingColors - Optional existing color assignments
 * @returns {Object} Map of value -> color
 */
export function generateColorPalette(values, existingColors = {}) {
  const palette = { ...existingColors }
  let colorIndex = 0

  values.forEach(val => {
    if (!palette[val]) {
      // Skip colors already in use
      while (Object.values(palette).includes(DYNAMIC_COLORS[colorIndex])) {
        colorIndex = (colorIndex + 1) % DYNAMIC_COLORS.length
      }
      palette[val] = DYNAMIC_COLORS[colorIndex]
      colorIndex = (colorIndex + 1) % DYNAMIC_COLORS.length
    }
  })

  return palette
}

/**
 * Get color for a value with fallback
 * @param {string} value - The value to get color for
 * @param {string} type - 'status', 'source', or 'dynamic'
 * @param {Object} customColors - Custom color overrides
 * @returns {string} Hex color
 */
export function getColorForValue(value, type = 'dynamic', customColors = {}) {
  // Check custom colors first
  if (customColors[value]) {
    return customColors[value]
  }

  // Check predefined palettes
  if (type === 'status' && STATUS_COLORS[value]) {
    return STATUS_COLORS[value]
  }
  if (type === 'source' && SOURCE_COLORS[value]) {
    return SOURCE_COLORS[value]
  }

  // Generate consistent color from value hash
  const hash = Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return DYNAMIC_COLORS[hash % DYNAMIC_COLORS.length]
}

// ═══════════════════════════════════════════════════════════════════════════
// CSS VARIABLE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate CSS variables string for status colors
 * @returns {string} CSS variable declarations
 */
export function getStatusCSSVars() {
  return Object.entries(STATUS_COLORS)
    .map(([status, color]) => {
      const key = status.toLowerCase().replace(/\s+/g, '-')
      return `--color-status-${key}: ${color};`
    })
    .join('\n')
}

/**
 * Generate CSS variables string for source colors
 * @returns {string} CSS variable declarations
 */
export function getSourceCSSVars() {
  return Object.entries(SOURCE_COLORS)
    .map(([source, color]) => {
      const key = source.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')
      return `--color-source-${key}: ${color};`
    })
    .join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE OPTIONS FOR UI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a curated list of colors for the color picker
 * Includes current dynamic colors plus additional options
 */
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
  // Neutral row (grays, with dark colors at end)
  '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4',
  '#e5e5e5', '#f5f5f5', '#ffffff', '#262626', '#000000'
]

/**
 * Default colors organized by category for color picker swatches
 */
export const COLOR_PICKER_SWATCHES = {
  status: Object.values(STATUS_COLORS),
  source: Object.values(SOURCE_COLORS),
  palette: DYNAMIC_COLORS,
  custom: COLOR_PICKER_PALETTE.slice(0, 17)
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECIES-LEVEL COLOR GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * High-contrast border colors for distinguishing species
 */
export const SPECIES_BORDER_PALETTE = [
  '#ffffff', // White
  '#ef4444', // Red
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#000000', // Black
]

/**
 * Base hues for species color gradients (evenly distributed on color wheel)
 * Each species gets a unique hue family
 */
export const SPECIES_HUE_PALETTE = [
  210,  // Blue
  120,  // Green
  30,   // Orange
  270,  // Purple
  180,  // Cyan
  330,  // Pink
  60,   // Yellow
  300,  // Magenta
  150,  // Teal
  0,    // Red
]

/**
 * Convert HSL to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string
 */
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

/**
 * Generate border colors for a list of species
 * @param {string[]} speciesList - Array of species names
 * @param {Object} existing - Existing custom color assignments
 * @returns {Object} Map of species -> border color
 */
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

/**
 * Generate base hues for a list of species
 * @param {string[]} speciesList - Array of species names
 * @param {Object} existing - Existing custom hue assignments
 * @returns {Object} Map of species -> hue (0-360)
 */
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
 * Generate subspecies colors within a species color family (gradient)
 * @param {string[]} subspeciesList - List of subspecies in this species
 * @param {number} baseHue - Base hue for the species (0-360)
 * @returns {Object} Map of subspecies -> hex color
 */
export function generateSpeciesGradientColors(subspeciesList, baseHue) {
  const colors = {}
  const count = subspeciesList.length
  const hueRange = Math.min(40, 15 * count) // Wider range for more subspecies
  const saturation = 70

  subspeciesList.forEach((subspecies, index) => {
    // Distribute hues around the base hue
    const hueOffset = count > 1
      ? ((index / (count - 1)) - 0.5) * hueRange
      : 0
    const hue = (baseHue + hueOffset + 360) % 360

    // Vary lightness for additional distinction
    const lightness = 45 + (index / Math.max(count - 1, 1)) * 15

    colors[subspecies] = hslToHex(hue, saturation, lightness)
  })

  return colors
}

/**
 * Generate complete color map for subspecies grouped by species using gradients
 * @param {Object} speciesSubspeciesMap - Map of species -> array of subspecies
 * @param {Object} hueAssignments - Map of species -> base hue (0-360)
 * @param {Object} customColors - Custom color overrides
 * @returns {Object} Map of subspecies -> hex color
 */
export function generateGroupedColorMap(speciesSubspeciesMap, hueAssignments, customColors = {}) {
  const colorMap = {}

  // Get sorted species list for consistent hue assignment
  const speciesList = Object.keys(speciesSubspeciesMap).sort()

  // Generate hues for any species without assignments
  const hues = generateSpeciesBaseHues(speciesList, hueAssignments)

  // Generate colors for each species' subspecies
  for (const species of speciesList) {
    const subspecies = speciesSubspeciesMap[species]
    const baseHue = hues[species]
    const speciesColors = generateSpeciesGradientColors(subspecies, baseHue)

    // Apply colors, respecting custom overrides
    for (const ssp of subspecies) {
      colorMap[ssp] = customColors[ssp] || speciesColors[ssp]
    }
  }

  return colorMap
}
