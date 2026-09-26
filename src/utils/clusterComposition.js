const UNKNOWN_COLOR = '#6b7280'

/** Return the same visible color used by an individual map point. */
export function clusterMemberColor(properties, {
  colorBy, colorAttribute, activeColorMap, speciesColorMap,
  collapsedSpecies, shownLabels,
}) {
  const species = properties?.scientific_name
  if (colorBy === 'subspecies' && collapsedSpecies.includes(species)) {
    return speciesColorMap[species] || UNKNOWN_COLOR
  }
  const label = properties?.[colorAttribute]
  if (!label || (shownLabels.size > 0 && !shownLabels.has(label))) return UNKNOWN_COLOR
  return activeColorMap[label] || UNKNOWN_COLOR
}

/** Each input feature contributes exactly one record to the ring. */
export function clusterComposition(features, colorSettings) {
  const counts = new Map()
  for (const feature of features) {
    const color = clusterMemberColor(feature.properties || feature, colorSettings)
    counts.set(color, (counts.get(color) || 0) + 1)
  }
  const total = features.length
  return {
    total,
    segments: [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([color, count]) => ({ color, count, fraction: count / total })),
  }
}

export function clusterCircleRadius(count) {
  if (count >= 500) return 32
  if (count >= 100) return 25
  if (count >= 50) return 20
  if (count >= 20) return 16
  return 12
}

/** Draw a sharp, proportional ring with a transparent center. */
export function drawCompositionRing(segments, count) {
  const pixelRatio = 2
  const radius = clusterCircleRadius(count) - 1
  const width = 5
  const size = Math.ceil((radius + width / 2 + 2) * 2 * pixelRatio)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const center = size / 2
  context.lineWidth = width * pixelRatio
  context.lineCap = 'butt'
  let angle = -Math.PI / 2
  for (const segment of segments) {
    const next = angle + Math.PI * 2 * segment.fraction
    context.beginPath()
    context.arc(center, center, radius * pixelRatio, angle, next)
    context.strokeStyle = segment.color
    context.stroke()
    angle = next
  }
  return context.getImageData(0, 0, size, size)
}
