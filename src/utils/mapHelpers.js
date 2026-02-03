// Remove a map layer and its source if they exist
export function removeLayerAndSource(map, layerId, sourceId) {
  if (layerId && map.getLayer(layerId)) map.removeLayer(layerId)
  if (sourceId && map.getSource(sourceId)) map.removeSource(sourceId)
}

// Generate a circle polygon approximation for a given center and radius in km
export function generateCirclePolygon(centerLng, centerLat, radiusKm, points = 64) {
  const coords = []
  const kmPerDegreeLat = 111.32
  const kmPerDegreeLng = 111.32 * Math.cos(centerLat * Math.PI / 180)

  for (let i = 0; i <= points; i++) {
    const angle = (2 * Math.PI * i) / points
    const latOffset = (radiusKm / kmPerDegreeLat) * Math.cos(angle)
    const lngOffset = (radiusKm / kmPerDegreeLng) * Math.sin(angle)
    coords.push([centerLng + lngOffset, centerLat + latOffset])
  }

  return coords
}

// Get theme accent color from CSS variables
export function getThemeAccentColor() {
  const style = getComputedStyle(document.documentElement)
  const accentColor = style.getPropertyValue('--color-accent').trim()
  return accentColor || '#4ade80'
}

// Convert hex or CSS color to rgba with alpha
export function colorToRgba(color, alpha) {
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${alpha})`)
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16)
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16)
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return `rgba(74, 222, 128, ${alpha})`
}
