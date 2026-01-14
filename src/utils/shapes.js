/**
 * Shape utilities for MapLibre GL marker visualization
 * Provides SVG definitions and loading utilities for custom marker shapes
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE SVG DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SVG shape definitions (32x32 viewBox)
 * Each shape has a fill area and a white stroke for visibility
 */
export const SHAPE_SVGS = {
  circle: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" fill="#4ade80"/>
  </svg>`,

  square: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="22" height="22" fill="#4ade80"/>
  </svg>`,

  triangle: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,3 30,28 2,28" fill="#4ade80"/>
  </svg>`,

  rhombus: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,3 29,16 16,29 3,16" fill="#4ade80"/>
  </svg>`
}

/**
 * Shape options for UI selection
 */
export const SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle', icon: '●' },
  { value: 'square', label: 'Square', icon: '■' },
  { value: 'triangle', label: 'Triangle', icon: '▲' },
  { value: 'rhombus', label: 'Diamond', icon: '◆' }
]

/**
 * Default shape assignments by index (for auto-assignment)
 */
export const SHAPE_ROTATION = ['circle', 'triangle', 'square', 'rhombus']

// ═══════════════════════════════════════════════════════════════════════════
// SVG TO MAP IMAGE CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert SVG string to canvas-based ImageData for MapLibre
 * @param {string} svgString - SVG markup string
 * @param {number} size - Image size in pixels (square)
 * @returns {Promise<HTMLCanvasElement>} Canvas element with rendered SVG
 */
export async function svgToMapImage(svgString, size = 32) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  const svg = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(svg)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

/**
 * Generate a colored version of a shape SVG
 * @param {string} shapeName - Name of shape (circle, square, triangle, rhombus)
 * @param {string} fillColor - Hex color for fill
 * @param {string} strokeColor - Hex color for stroke (border)
 * @param {number} strokeWidth - Stroke width in pixels
 * @returns {string} SVG string with applied colors
 */
export function getColoredShapeSVG(shapeName, fillColor = '#4ade80', strokeColor = '#ffffff', strokeWidth = 2) {
  const shapes = {
    circle: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="11" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    </svg>`,

    square: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="22" height="22" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    </svg>`,

    triangle: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 29,27 3,27" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    </svg>`,

    rhombus: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 28,16 16,28 4,16" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    </svg>`
  }

  return shapes[shapeName] || shapes.circle
}

// ═══════════════════════════════════════════════════════════════════════════
// MAPLIBRE IMAGE LOADING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load all shape images into a MapLibre map instance
 * @param {maplibregl.Map} map - MapLibre map instance
 * @param {Object} options - Loading options
 * @param {number} options.size - Image size (default 64 for retina)
 * @param {number} options.pixelRatio - Pixel ratio for retina displays (default 2)
 * @returns {Promise<void>}
 */
export async function loadShapeImages(map, options = {}) {
  const { size = 64, pixelRatio = 2 } = options

  for (const [shapeName, svgContent] of Object.entries(SHAPE_SVGS)) {
    const imageName = `shape-${shapeName}`
    if (!map.hasImage(imageName)) {
      try {
        const canvas = await svgToMapImage(svgContent, size)
        map.addImage(imageName, canvas, { pixelRatio })
      } catch (err) {
        console.warn(`Failed to load shape image: ${imageName}`, err)
      }
    }
  }
}

/**
 * Check if all shape images are loaded in the map
 * @param {maplibregl.Map} map - MapLibre map instance
 * @returns {boolean} True if all shapes are loaded
 */
export function areShapeImagesLoaded(map) {
  return Object.keys(SHAPE_SVGS).every(shapeName =>
    map.hasImage(`shape-${shapeName}`)
  )
}

/**
 * Remove all shape images from the map
 * @param {maplibregl.Map} map - MapLibre map instance
 */
export function removeShapeImages(map) {
  for (const shapeName of Object.keys(SHAPE_SVGS)) {
    const imageName = `shape-${shapeName}`
    if (map.hasImage(imageName)) {
      map.removeImage(imageName)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE ASSIGNMENT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate automatic shape assignments for a list of groups
 * @param {string[]} groupList - List of group keys (e.g., species names)
 * @param {Object} existing - Existing custom assignments to preserve
 * @returns {Object} Map of groupKey -> shapeName
 */
export function generateShapeAssignments(groupList, existing = {}) {
  const result = { ...existing }
  let shapeIndex = 0

  for (const groupKey of groupList) {
    if (!result[groupKey]) {
      result[groupKey] = SHAPE_ROTATION[shapeIndex % SHAPE_ROTATION.length]
      shapeIndex++
    }
  }

  return result
}

/**
 * Build a MapLibre expression for icon-image based on shape assignments
 * @param {string} attributeName - GeoJSON property name to match against
 * @param {Object} shapeAssignments - Map of attributeValue -> shapeName
 * @param {string} defaultShape - Default shape if no match (default: 'circle')
 * @returns {Array} MapLibre match expression
 */
export function buildShapeExpression(attributeName, shapeAssignments, defaultShape = 'circle') {
  const expression = ['match', ['get', attributeName]]

  for (const [value, shape] of Object.entries(shapeAssignments)) {
    expression.push(value, `shape-${shape}`)
  }

  // Default fallback
  expression.push(`shape-${defaultShape}`)

  return expression
}
