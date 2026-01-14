/**
 * Shape utilities for MapLibre GL marker visualization
 * Provides SVG definitions and loading utilities for custom marker shapes
 *
 * IMPORTANT: These shapes use SDF (Signed Distance Field) rendering which allows
 * dynamic coloring via icon-color paint property. SDF images must be single-color
 * (white) with transparent background.
 *
 * @see https://maplibre.org/maplibre-style-spec/layers/ - icon-color only works with SDF
 * @see https://docs.mapbox.com/help/troubleshooting/using-recolorable-images-in-mapbox-maps/
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE SVG DEFINITIONS (SDF-compatible: solid white, transparent background)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SVG shape definitions (32x32 viewBox)
 * All shapes are solid white (#ffffff) for SDF compatibility.
 * Color is applied at runtime via MapLibre's icon-color paint property.
 */
export const SHAPE_SVGS = {
  circle: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" fill="#ffffff"/>
  </svg>`,

  square: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="22" height="22" fill="#ffffff"/>
  </svg>`,

  triangle: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,3 30,28 2,28" fill="#ffffff"/>
  </svg>`,

  rhombus: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,3 29,16 16,29 3,16" fill="#ffffff"/>
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
 * Convert SVG string to ImageData for MapLibre addImage
 *
 * MapLibre's addImage() accepts: HTMLImageElement, ImageData, ImageBitmap,
 * or {width, height, data: Uint8Array}. We return ImageData from getImageData().
 *
 * @param {string} svgString - SVG markup string
 * @param {number} size - Image size in pixels (square)
 * @returns {Promise<ImageData>} ImageData object for MapLibre addImage
 *
 * @see https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/ - addImage method
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
      // Return ImageData, not canvas - MapLibre requires this format
      // @see https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleImageInterface/
      resolve(ctx.getImageData(0, 0, size, size))
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
 * Load all shape images into a MapLibre map instance as SDF images.
 * SDF (Signed Distance Field) images allow dynamic coloring via icon-color.
 *
 * @param {maplibregl.Map} map - MapLibre map instance
 * @param {Object} options - Loading options
 * @param {number} options.size - Image size (default 64 for retina)
 * @param {number} options.pixelRatio - Pixel ratio for retina displays (default 2)
 * @returns {Promise<void>}
 *
 * @see https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageMetadata/
 */
export async function loadShapeImages(map, options = {}) {
  const { size = 64, pixelRatio = 2 } = options

  const shapesToLoad = Object.entries(SHAPE_SVGS).filter(
    ([shapeName]) => !map.hasImage(`shape-${shapeName}`)
  )

  if (shapesToLoad.length > 0) {
    console.log(`[Shapes] Loading ${shapesToLoad.length} shape images...`)
  }

  for (const [shapeName, svgContent] of shapesToLoad) {
    const imageName = `shape-${shapeName}`
    try {
      const imageData = await svgToMapImage(svgContent, size)
      // Add as SDF image to enable icon-color paint property
      // @see https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageMetadata/
      map.addImage(imageName, imageData, { pixelRatio, sdf: true })
      console.log(`[Shapes] Loaded: ${imageName}`)
    } catch (err) {
      console.warn(`[Shapes] Failed to load: ${imageName}`, err)
    }
  }

  if (shapesToLoad.length > 0) {
    console.log(`[Shapes] All shape images loaded`)
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
 * @returns {Array|string} MapLibre match expression or literal string if no assignments
 */
export function buildShapeExpression(attributeName, shapeAssignments, defaultShape = 'circle') {
  const entries = Object.entries(shapeAssignments)

  // If no custom assignments, return a literal string (not a match expression)
  // MapLibre's match expression requires at least one value-output pair
  if (entries.length === 0) {
    return `shape-${defaultShape}`
  }

  const expression = ['match', ['get', attributeName]]

  for (const [value, shape] of entries) {
    expression.push(value, `shape-${shape}`)
  }

  // Default fallback
  expression.push(`shape-${defaultShape}`)

  return expression
}
