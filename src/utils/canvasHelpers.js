/**
 * Canvas drawing utilities for map export
 */

/**
 * Draw a rounded rectangle path
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {number} r - Border radius
 * @returns {CanvasRenderingContext2D} The context for chaining
 */
export const roundRect = (ctx, x, y, w, h, r) => {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  return ctx
}

/**
 * Load an image from a data URL
 * @param {string} src - Image source URL
 * @returns {Promise<HTMLImageElement>} Loaded image element
 */
export const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * Calculate export region for map cropping
 * @param {number} containerWidth - Width of source canvas
 * @param {number} containerHeight - Height of source canvas
 * @param {number} targetWidth - Desired export width
 * @param {number} targetHeight - Desired export height
 * @returns {Object} Region coordinates as percentages { x, y, width, height }
 */
export const calculateExportRegion = (containerWidth, containerHeight, targetWidth, targetHeight) => {
  const targetAspectRatio = targetWidth / targetHeight
  const containerAspectRatio = containerWidth / containerHeight
  const maxPercent = 92

  let holeWidthPercent, holeHeightPercent

  if (targetAspectRatio > containerAspectRatio) {
    // Target is wider than container - constrained by width
    holeWidthPercent = maxPercent
    holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
  } else {
    // Target is taller than container - constrained by height
    holeHeightPercent = maxPercent
    holeWidthPercent = (maxPercent * targetAspectRatio) / containerAspectRatio
  }

  return {
    x: Math.max(2, (100 - holeWidthPercent) / 2),
    y: Math.max(2, (100 - holeHeightPercent) / 2),
    width: Math.min(96, holeWidthPercent),
    height: Math.min(96, holeHeightPercent)
  }
}

/**
 * Draw legend on canvas for export
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Drawing options
 */
export const drawLegendOnCanvas = (ctx, width, height, options) => {
  const { colorMap, legendSettings, exportSettings, colorBy, legendTitle } = options
  const entries = Object.entries(colorMap).slice(0, legendSettings.maxItems)
  const uiScale = exportSettings.uiScale || 1

  // Calculate resolution scale factor to match preview appearance
  const referenceHeight = 650
  const resolutionScale = height / referenceHeight
  const scale = uiScale * resolutionScale

  // Match CSS preview padding
  const sidePadding = 15 * resolutionScale * uiScale
  const topPadding = 50 * resolutionScale * uiScale
  const bottomPadding = 15 * resolutionScale * uiScale

  const itemHeight = 24 * scale
  const leftPadding = 12 * scale
  const dotSpace = 32 * scale
  const rightPadding = 12 * scale

  // Calculate legend width based on content
  const isItalic = ['species', 'subspecies', 'genus'].includes(colorBy)
  ctx.font = isItalic
    ? `italic ${13 * scale}px system-ui, sans-serif`
    : `${13 * scale}px system-ui, sans-serif`

  let maxLabelWidth = 0
  entries.forEach(([label]) => {
    const labelWidth = ctx.measureText(label).width
    if (labelWidth > maxLabelWidth) {
      maxLabelWidth = labelWidth
    }
  })

  ctx.font = `bold ${12 * scale}px system-ui, sans-serif`
  const titleWidth = ctx.measureText(legendTitle.toUpperCase()).width

  const contentWidth = Math.max(maxLabelWidth + dotSpace, titleWidth) + leftPadding + rightPadding
  const legendWidth = Math.max(180 * scale, Math.min(contentWidth, 300 * scale))
  const legendHeight = entries.length * itemHeight + 45 * scale

  // Position based on settings
  let x, y
  const pos = legendSettings.position
  if (pos === 'top-left') { x = sidePadding; y = topPadding }
  else if (pos === 'top-right') { x = width - legendWidth - sidePadding; y = topPadding }
  else if (pos === 'bottom-right') { x = width - legendWidth - sidePadding; y = height - legendHeight - bottomPadding }
  else { x = sidePadding; y = height - legendHeight - bottomPadding }

  // Background
  ctx.fillStyle = 'rgba(26, 26, 46, 0.95)'
  roundRect(ctx, x, y, legendWidth, legendHeight, 8 * scale)
  ctx.fill()

  // Title
  ctx.fillStyle = '#888'
  ctx.font = `bold ${12 * scale}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(legendTitle.toUpperCase(), x + leftPadding, y + 22 * scale)

  // Maximum width for label text
  const maxTextWidth = legendWidth - dotSpace - rightPadding

  // Items
  ctx.font = isItalic
    ? `italic ${13 * scale}px system-ui, sans-serif`
    : `${13 * scale}px system-ui, sans-serif`

  entries.forEach(([label, color], i) => {
    const itemY = y + 40 * scale + i * itemHeight

    // Dot
    ctx.beginPath()
    ctx.arc(x + 18 * scale, itemY, 5 * scale, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Label - truncate if too long
    ctx.fillStyle = '#e0e0e0'
    let displayLabel = label
    let labelWidth = ctx.measureText(displayLabel).width
    if (labelWidth > maxTextWidth) {
      while (labelWidth > maxTextWidth && displayLabel.length > 0) {
        displayLabel = displayLabel.slice(0, -1)
        labelWidth = ctx.measureText(displayLabel + '…').width
      }
      displayLabel += '…'
    }
    ctx.fillText(displayLabel, x + dotSpace, itemY + 4 * scale)
  })

  // "More" indicator
  if (Object.keys(colorMap).length > legendSettings.maxItems) {
    const moreY = y + legendHeight - 12 * scale
    ctx.fillStyle = '#666'
    ctx.font = `italic ${11 * scale}px system-ui, sans-serif`
    ctx.fillText(`+ ${Object.keys(colorMap).length - legendSettings.maxItems} more`, x + 12 * scale, moreY)
  }
}

/**
 * Draw scale bar on canvas for export
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Drawing options
 */
export const drawScaleBarOnCanvas = (ctx, width, height, options) => {
  const { legendSettings, exportSettings } = options
  const uiScale = exportSettings.uiScale || 1
  const referenceHeight = 650
  const resolutionScale = height / referenceHeight
  const scale = uiScale * resolutionScale

  const sidePadding = 15 * resolutionScale * uiScale
  const bottomPadding = 15 * resolutionScale * uiScale

  const barWidth = 100 * scale
  const barHeight = 4 * scale

  // Position: bottom-right, or bottom-left if legend is bottom-right
  let x
  if (legendSettings.position === 'bottom-right' && exportSettings.includeLegend) {
    x = sidePadding
  } else {
    x = width - barWidth - sidePadding
  }
  const y = height - bottomPadding - barHeight - 20 * scale

  // Scale bar line
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, barWidth, barHeight)

  // End caps
  ctx.fillRect(x, y - 4 * scale, 2 * scale, barHeight + 8 * scale)
  ctx.fillRect(x + barWidth - 2 * scale, y - 4 * scale, 2 * scale, barHeight + 8 * scale)

  // Text
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${11 * scale}px system-ui, sans-serif`
  ctx.textAlign = legendSettings.position === 'bottom-right' && exportSettings.includeLegend ? 'left' : 'right'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 3
  ctx.fillText(
    'Scale varies with latitude',
    legendSettings.position === 'bottom-right' && exportSettings.includeLegend ? x : x + barWidth,
    y + barHeight + 6 * scale
  )
  ctx.shadowBlur = 0
}

/**
 * Draw attribution on canvas for export
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Drawing options
 */
export const drawAttributionOnCanvas = (ctx, width, height, options) => {
  const { exportSettings } = options
  const uiScale = exportSettings.uiScale || 1
  const text = 'Ithomiini Distribution Maps | Data: Dore et al., Sanger Institute, GBIF'
  const padding = 15 * uiScale

  ctx.font = `${11 * uiScale}px system-ui, sans-serif`
  const textWidth = ctx.measureText(text).width

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  roundRect(ctx, width - textWidth - padding - 12 * uiScale, height - 28 * uiScale, textWidth + 12 * uiScale, 22 * uiScale, 4 * uiScale)
  ctx.fill()

  // Text
  ctx.fillStyle = '#aaa'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width - padding, height - 17 * uiScale)
}
