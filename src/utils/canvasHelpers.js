// Draw a rounded rectangle path
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

// Load an image from a data URL
export const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

// Calculate export region for map cropping (returns percentages)
export const calculateExportRegion = (containerWidth, containerHeight, targetWidth, targetHeight) => {
  const targetAspectRatio = targetWidth / targetHeight
  const containerAspectRatio = containerWidth / containerHeight
  const maxPercent = 92

  let holeWidthPercent, holeHeightPercent

  if (targetAspectRatio > containerAspectRatio) {
    holeWidthPercent = maxPercent
    holeHeightPercent = (maxPercent / targetAspectRatio) * containerAspectRatio
  } else {
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

// Draw legend on canvas for export
export const drawLegendOnCanvas = (ctx, width, height, options) => {
  const { colorMap, legendSettings, exportSettings, colorBy, legendTitle } = options
  const entries = Object.entries(colorMap).slice(0, legendSettings.maxItems)
  const uiScale = exportSettings.uiScale || 1

  const referenceHeight = 650
  const resolutionScale = height / referenceHeight
  const scale = uiScale * resolutionScale

  const sidePadding = 15 * resolutionScale * uiScale
  const topPadding = 50 * resolutionScale * uiScale
  const bottomPadding = 15 * resolutionScale * uiScale

  const itemHeight = 24 * scale
  const leftPadding = 12 * scale
  const dotSpace = 32 * scale
  const rightPadding = 12 * scale

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

  let x, y
  const pos = legendSettings.position
  if (pos === 'top-left') { x = sidePadding; y = topPadding }
  else if (pos === 'top-right') { x = width - legendWidth - sidePadding; y = topPadding }
  else if (pos === 'bottom-right') { x = width - legendWidth - sidePadding; y = height - legendHeight - bottomPadding }
  else { x = sidePadding; y = height - legendHeight - bottomPadding }

  ctx.fillStyle = 'rgba(26, 26, 46, 0.95)'
  roundRect(ctx, x, y, legendWidth, legendHeight, 8 * scale)
  ctx.fill()

  ctx.fillStyle = '#888'
  ctx.font = `bold ${12 * scale}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(legendTitle.toUpperCase(), x + leftPadding, y + 22 * scale)

  const maxTextWidth = legendWidth - dotSpace - rightPadding

  ctx.font = isItalic
    ? `italic ${13 * scale}px system-ui, sans-serif`
    : `${13 * scale}px system-ui, sans-serif`

  entries.forEach(([label, color], i) => {
    const itemY = y + 40 * scale + i * itemHeight

    ctx.beginPath()
    ctx.arc(x + 18 * scale, itemY, 5 * scale, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

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

  if (Object.keys(colorMap).length > legendSettings.maxItems) {
    const moreY = y + legendHeight - 12 * scale
    ctx.fillStyle = '#666'
    ctx.font = `italic ${11 * scale}px system-ui, sans-serif`
    ctx.fillText(`+ ${Object.keys(colorMap).length - legendSettings.maxItems} more`, x + 12 * scale, moreY)
  }
}

// Draw scale bar on canvas for export
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

  let x
  if (legendSettings.position === 'bottom-right' && exportSettings.includeLegend) {
    x = sidePadding
  } else {
    x = width - barWidth - sidePadding
  }
  const y = height - bottomPadding - barHeight - 20 * scale

  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, barWidth, barHeight)

  ctx.fillRect(x, y - 4 * scale, 2 * scale, barHeight + 8 * scale)
  ctx.fillRect(x + barWidth - 2 * scale, y - 4 * scale, 2 * scale, barHeight + 8 * scale)

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

// Draw attribution on canvas for export
export const drawAttributionOnCanvas = (ctx, width, height, options) => {
  const { exportSettings } = options
  const uiScale = exportSettings.uiScale || 1
  const text = 'Ithomiini Distribution Maps | Data: Dore et al., Sanger Institute, GBIF'
  const padding = 15 * uiScale

  ctx.font = `${11 * uiScale}px system-ui, sans-serif`
  const textWidth = ctx.measureText(text).width

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  roundRect(ctx, width - textWidth - padding - 12 * uiScale, height - 28 * uiScale, textWidth + 12 * uiScale, 22 * uiScale, 4 * uiScale)
  ctx.fill()

  ctx.fillStyle = '#aaa'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width - padding, height - 17 * uiScale)
}
