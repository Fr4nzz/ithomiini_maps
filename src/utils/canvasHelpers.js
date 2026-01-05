import { toPng } from 'html-to-image'

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

// Capture the native MapLibre ScaleControl as an image using html-to-image
// This gives us an exact visual copy of the scale bar
export const captureNativeScaleBar = async (pixelRatio = 2) => {
  try {
    const scaleElement = document.querySelector('.maplibregl-ctrl-scale')
    if (!scaleElement) {
      console.warn('Native scale bar element not found')
      return null
    }

    // Get original dimensions
    const rect = scaleElement.getBoundingClientRect()

    // Capture as PNG with higher pixel ratio for crisp rendering
    const dataUrl = await toPng(scaleElement, {
      pixelRatio: pixelRatio,
      backgroundColor: 'transparent',
    })

    return {
      dataUrl,
      width: rect.width,
      height: rect.height,
      text: scaleElement.textContent?.trim() || ''
    }
  } catch (e) {
    console.warn('Failed to capture native scale bar:', e)
    return null
  }
}

// Draw the captured native scale bar image onto the canvas
export const drawNativeScaleBarOnCanvas = async (ctx, width, height, options) => {
  const { legendSettings, exportSettings, previewHole, outputWidth } = options

  try {
    // Capture the native scale bar
    const captured = await captureNativeScaleBar(3) // Higher pixel ratio for quality
    if (!captured) {
      // Fall back to drawing custom scale bar
      return false
    }

    const uiScale = exportSettings.uiScale || 1
    const referenceHeight = 650
    const resolutionScale = height / referenceHeight
    const scale = uiScale * resolutionScale

    const sidePadding = 15 * resolutionScale * uiScale
    const bottomPadding = 20 * resolutionScale * uiScale

    // Calculate scaled dimensions for the captured image
    // Scale from preview/container pixels to output pixels
    const scaleFactor = previewHole ? (outputWidth / previewHole.width) : scale
    const scaledWidth = captured.width * scaleFactor
    const scaledHeight = captured.height * scaleFactor

    // Position the scale bar
    let x
    if (legendSettings.position === 'bottom-right' && exportSettings.includeLegend) {
      x = sidePadding
    } else {
      x = width - scaledWidth - sidePadding
    }
    const y = height - bottomPadding - scaledHeight

    // Load and draw the captured image
    const img = await loadImage(captured.dataUrl)
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

    return true
  } catch (e) {
    console.warn('Failed to draw native scale bar:', e)
    return false
  }
}

// Read scale bar values directly from MapLibre's native ScaleControl DOM element
export const getNativeScaleBarValues = () => {
  try {
    const scaleElement = document.querySelector('.maplibregl-ctrl-scale')
    if (!scaleElement) {
      return null
    }
    const text = scaleElement.textContent?.trim() || ''
    const computedStyle = window.getComputedStyle(scaleElement)
    const width = parseFloat(computedStyle.width) || 100
    return { text, width }
  } catch (e) {
    return null
  }
}

// Calculate scale bar parameters (fallback if native capture fails)
export const calculateScaleBarParams = (map, previewHole, outputWidth, maxBarWidth = 150) => {
  const nativeValues = getNativeScaleBarValues()

  if (nativeValues && nativeValues.text && nativeValues.width > 0) {
    const container = map?.getContainer()
    if (container) {
      const previewWidthInContainer = previewHole.width
      const scaleFactor = outputWidth / previewWidthInContainer
      const scaledWidth = nativeValues.width * scaleFactor

      return {
        barWidth: Math.max(50, Math.min(maxBarWidth * 1.5, scaledWidth)),
        text: nativeValues.text
      }
    }
  }

  // Fallback: calculate using haversine formula if native reading fails
  if (!map) return { barWidth: 100, text: '500 km' }

  try {
    const centerX = previewHole.x + previewHole.width / 2
    const bottomY = previewHole.y + previewHole.height * 0.9

    const scaleFactor = outputWidth / previewHole.width
    const previewBarWidth = maxBarWidth / scaleFactor

    const left = map.unproject([centerX - previewBarWidth / 2, bottomY])
    const right = map.unproject([centerX + previewBarWidth / 2, bottomY])

    // Haversine formula
    const R = 6371000
    const lat1 = left.lat * Math.PI / 180
    const lat2 = right.lat * Math.PI / 180
    const dLat = (right.lat - left.lat) * Math.PI / 180
    const dLng = (right.lng - left.lng) * Math.PI / 180

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const maxDistance = R * c

    // Round to nice number (matching MapLibre's algorithm)
    const getRoundNum = (num) => {
      const pow10 = Math.pow(10, Math.floor(Math.log10(num)))
      let d = num / pow10
      if (d >= 10) d = 10
      else if (d >= 5) d = 5
      else if (d >= 3) d = 3
      else if (d >= 2) d = 2
      else d = 1
      return pow10 * d
    }

    let distance, unit
    if (maxDistance >= 1000) {
      distance = getRoundNum(maxDistance / 1000)
      unit = 'km'
    } else {
      distance = getRoundNum(maxDistance)
      unit = 'm'
    }

    const actualDistance = unit === 'km' ? distance * 1000 : distance
    const ratio = actualDistance / maxDistance
    const barWidth = maxBarWidth * ratio

    return {
      barWidth: Math.max(50, Math.min(maxBarWidth, barWidth)),
      text: `${distance} ${unit}`
    }
  } catch (e) {
    console.warn('Scale bar calculation failed:', e)
    return { barWidth: 100, text: '500 km' }
  }
}

// Draw scale bar on canvas for export
export const drawScaleBarOnCanvas = (ctx, width, height, options) => {
  const { legendSettings, exportSettings, scaleBarText, scaleBarWidth } = options
  const uiScale = exportSettings.uiScale || 1
  const referenceHeight = 650
  const resolutionScale = height / referenceHeight
  const scale = uiScale * resolutionScale

  const sidePadding = 15 * resolutionScale * uiScale
  const bottomPadding = 15 * resolutionScale * uiScale

  // Use calculated bar width if provided, otherwise fall back to fixed 100px
  const barWidth = scaleBarWidth ? scaleBarWidth * scale : 100 * scale
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

  // Use actual scale bar text if provided, otherwise fallback
  const displayText = scaleBarText || 'Scale varies with latitude'

  ctx.fillStyle = '#fff'
  ctx.font = `bold ${11 * scale}px system-ui, sans-serif`
  ctx.textAlign = legendSettings.position === 'bottom-right' && exportSettings.includeLegend ? 'left' : 'right'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 3
  ctx.fillText(
    displayText,
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
