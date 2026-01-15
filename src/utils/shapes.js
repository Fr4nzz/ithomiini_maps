/**
 * Shape utilities for MapLibre GL marker visualization
 * Provides SVG definitions and loading utilities for custom marker shapes
 *
 * APPROACH: We generate colored shape images with borders baked in (non-SDF),
 * rather than using SDF icons with icon-halo. This is because icon-halo has
 * known bugs in MapLibre where borders don't scale properly with zoom.
 *
 * @see https://github.com/maplibre/maplibre-native/issues/2175 - icon halo bugs
 * @see https://maplibre.org/maplibre-gl-js/docs/examples/add-a-generated-icon-to-the-map/
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Available shape names
 */
export const SHAPE_NAMES = ['circle', 'square', 'triangle', 'rhombus']

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
// CANVAS SHAPE RENDERING (for baked-color images)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draw a shape on a canvas context with fill and stroke baked in.
 * This is the preferred approach because MapLibre's icon-halo has bugs
 * that cause borders to not scale properly with zoom.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {string} shapeName - Shape name (circle, square, triangle, rhombus)
 * @param {number} size - Canvas size in pixels
 * @param {string} fillColor - Fill color (hex or CSS color)
 * @param {string} strokeColor - Stroke/border color
 * @param {number} strokeWidth - Stroke width in pixels (relative to size)
 */
function drawShape(ctx, shapeName, size, fillColor, strokeColor, strokeWidth) {
  const center = size / 2
  const padding = strokeWidth + 2 // Padding from edge for stroke
  const innerSize = size - padding * 2

  ctx.fillStyle = fillColor
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()

  switch (shapeName) {
    case 'circle': {
      const radius = innerSize / 2
      ctx.arc(center, center, radius, 0, Math.PI * 2)
      break
    }
    case 'square': {
      const halfSize = innerSize / 2
      ctx.rect(center - halfSize, center - halfSize, innerSize, innerSize)
      break
    }
    case 'triangle': {
      // Equilateral-ish triangle pointing up
      const h = innerSize * 0.866 // height = side * sqrt(3)/2
      const top = center - h / 2
      const bottom = center + h / 2
      const halfBase = innerSize / 2
      ctx.moveTo(center, top)
      ctx.lineTo(center + halfBase, bottom)
      ctx.lineTo(center - halfBase, bottom)
      ctx.closePath()
      break
    }
    case 'rhombus': {
      // Diamond shape
      const half = innerSize / 2
      ctx.moveTo(center, center - half) // top
      ctx.lineTo(center + half, center) // right
      ctx.lineTo(center, center + half) // bottom
      ctx.lineTo(center - half, center) // left
      ctx.closePath()
      break
    }
    default:
      // Default to circle
      ctx.arc(center, center, innerSize / 2, 0, Math.PI * 2)
  }

  ctx.fill()
  if (strokeWidth > 0) {
    ctx.stroke()
  }
}

/**
 * Generate a colored shape image with border baked in.
 * Returns data in the format MapLibre's addImage() expects.
 *
 * @param {string} shapeName - Shape name
 * @param {string} fillColor - Fill color
 * @param {string} strokeColor - Border color
 * @param {number} strokeWidth - Border width (will be scaled to image size)
 * @param {number} size - Image size in pixels (default 64 for retina)
 * @returns {{width: number, height: number, data: Uint8Array}} Image data for MapLibre
 *
 * @see https://maplibre.org/maplibre-gl-js/docs/examples/add-a-generated-icon-to-the-map/
 */
export function generateColoredShapeImage(shapeName, fillColor, strokeColor, strokeWidth = 3, size = 64) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // Scale stroke width relative to image size
  const scaledStrokeWidth = (strokeWidth / 32) * size

  drawShape(ctx, shapeName, size, fillColor, strokeColor, scaledStrokeWidth)

  const imageData = ctx.getImageData(0, 0, size, size)
  return {
    width: size,
    height: size,
    data: new Uint8Array(imageData.data.buffer)
  }
}

/**
 * Generate a unique image name for a colored shape
 * @param {string} shapeName - Shape name
 * @param {string} fillColor - Fill color (hex)
 * @param {string} strokeColor - Stroke color (hex)
 * @param {number} strokeWidth - Stroke width (included in name for cache invalidation)
 * @returns {string} Unique image name for MapLibre
 */
export function getColoredShapeImageName(shapeName, fillColor, strokeColor, strokeWidth = 3) {
  // Normalize colors (remove # and lowercase)
  const fill = fillColor.replace('#', '').toLowerCase()
  const stroke = strokeColor.replace('#', '').toLowerCase()
  // Include stroke width (rounded to 1 decimal) for cache invalidation when border changes
  const sw = Math.round(strokeWidth * 10) / 10
  return `shape-${shapeName}-${fill}-${stroke}-w${sw}`
}

// ═══════════════════════════════════════════════════════════════════════════
// MAPLIBRE IMAGE LOADING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ensure a colored shape image exists in the map.
 * Creates it on-demand if not already loaded.
 *
 * @param {maplibregl.Map} map - MapLibre map instance
 * @param {string} shapeName - Shape name
 * @param {string} fillColor - Fill color (hex)
 * @param {string} strokeColor - Border color (hex)
 * @param {number} strokeWidth - Border width
 * @param {Object} options - Options
 * @param {number} options.size - Image size (default 64)
 * @param {number} options.pixelRatio - Pixel ratio (default 2)
 * @returns {string} The image name that was loaded/exists
 */
export function ensureColoredShapeImage(map, shapeName, fillColor, strokeColor, strokeWidth = 3, options = {}) {
  const { size = 64, pixelRatio = 2 } = options
  const imageName = getColoredShapeImageName(shapeName, fillColor, strokeColor)

  if (!map.hasImage(imageName)) {
    const imageData = generateColoredShapeImage(shapeName, fillColor, strokeColor, strokeWidth, size)
    map.addImage(imageName, imageData, { pixelRatio })
  }

  return imageName
}

/**
 * Load all required colored shape images for the current data.
 * This generates unique images for each color+shape combination.
 *
 * @param {maplibregl.Map} map - MapLibre map instance
 * @param {Array<{shape: string, fillColor: string, strokeColor: string}>} colorShapePairs - Required shape/color combinations
 * @param {number} strokeWidth - Border width
 * @param {Object} options - Loading options
 * @returns {Map<string, string>} Map of "fillColor" -> imageName for lookups
 */
export function loadColoredShapeImages(map, colorShapePairs, strokeWidth = 3, options = {}) {
  const { size = 64, pixelRatio = 2 } = options
  const colorToImageMap = new Map()
  let loadedCount = 0

  for (const { shape, fillColor, strokeColor } of colorShapePairs) {
    const imageName = getColoredShapeImageName(shape, fillColor, strokeColor)

    if (!map.hasImage(imageName)) {
      const imageData = generateColoredShapeImage(shape, fillColor, strokeColor, strokeWidth, size)
      map.addImage(imageName, imageData, { pixelRatio })
      loadedCount++
    }

    // Map the fill color to the image name for building expressions
    colorToImageMap.set(fillColor, imageName)
  }

  if (loadedCount > 0) {
    console.log(`[Shapes] Generated ${loadedCount} colored shape images`)
  }

  return colorToImageMap
}

/**
 * Remove colored shape images that are no longer needed.
 * Call this when data changes to clean up unused images.
 *
 * @param {maplibregl.Map} map - MapLibre map instance
 * @param {Set<string>} keepImages - Set of image names to keep
 */
export function cleanupUnusedShapeImages(map, keepImages) {
  // Get all current images that match our pattern
  const style = map.getStyle()
  if (!style || !style.images) return

  // Note: MapLibre doesn't expose a list of image names easily,
  // so we track them ourselves or skip cleanup for now
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
 * Build a MapLibre expression for icon-image based on colored shape images.
 * Each unique color gets its own pre-rendered image with border baked in.
 *
 * @param {Map<string, string>} colorToImageMap - Map of fillColor -> imageName
 * @param {string} colorAttributeName - GeoJSON property for color lookup
 * @param {string} defaultImageName - Default image if no match
 * @returns {Array|string} MapLibre match expression
 */
export function buildColoredShapeExpression(colorToImageMap, colorAttributeName, defaultImageName) {
  if (colorToImageMap.size === 0) {
    return defaultImageName
  }

  const expression = ['match', ['get', colorAttributeName]]

  for (const [color, imageName] of colorToImageMap) {
    expression.push(color, imageName)
  }

  // Default fallback
  expression.push(defaultImageName)

  return expression
}
