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
