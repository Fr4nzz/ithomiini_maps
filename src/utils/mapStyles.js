// Map style configurations - organized by theme
export const MAP_STYLES = {
  // Day themes
  light: {
    name: 'Light',
    theme: 'day',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    pair: 'dark'
  },
  'stadia-smooth': {
    name: 'Smooth',
    theme: 'day',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    pair: 'stadia-dark'
  },
  'stadia-toner-lite': {
    name: 'Toner Lite',
    theme: 'day',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/stamen_toner_lite.json',
    pair: 'stadia-toner'
  },
  terrain: {
    name: 'Terrain',
    theme: 'day',
    style: {
      version: 8,
      sources: {
        'osm-terrain': {
          type: 'raster',
          tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenTopoMap contributors'
        }
      },
      layers: [{
        id: 'osm-terrain-layer',
        type: 'raster',
        source: 'osm-terrain',
        minzoom: 0,
        maxzoom: 17
      }]
    }
  },
  'stadia-terrain': {
    name: 'Stamen Terrain',
    theme: 'day',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/stamen_terrain.json'
  },
  streets: {
    name: 'Streets',
    theme: 'day',
    style: {
      version: 8,
      sources: {
        'osm-streets': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [{
        id: 'osm-streets-layer',
        type: 'raster',
        source: 'osm-streets',
        minzoom: 0,
        maxzoom: 19
      }]
    }
  },
  satellite: {
    name: 'Satellite',
    theme: 'day',
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics'
        }
      },
      layers: [{
        id: 'esri-satellite-layer',
        type: 'raster',
        source: 'esri-satellite',
        minzoom: 0,
        maxzoom: 19
      }]
    }
  },
  // Night themes
  dark: {
    name: 'Dark',
    theme: 'night',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    pair: 'light'
  },
  'stadia-dark': {
    name: 'Smooth Dark',
    theme: 'night',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json',
    pair: 'stadia-smooth'
  },
  'stadia-toner': {
    name: 'Toner',
    theme: 'night',
    provider: 'Stadia',
    style: 'https://tiles.stadiamaps.com/styles/stamen_toner.json',
    pair: 'stadia-toner-lite'
  }
}

// Get the paired basemap for light/dark mode switching
export const getBasemapPair = (currentBasemap, targetMode) => {
  const style = MAP_STYLES[currentBasemap]
  if (!style) return currentBasemap

  const isCurrentDark = style.theme === 'night'
  const targetIsDark = targetMode === 'dark'

  if (isCurrentDark === targetIsDark) return currentBasemap
  if (style.pair && MAP_STYLES[style.pair]) return style.pair
  return currentBasemap
}

// Get styles grouped by theme (day/night)
export const getStylesByTheme = () => {
  const day = []
  const night = []

  Object.entries(MAP_STYLES).forEach(([key, config]) => {
    const item = { key, ...config }
    if (config.theme === 'night') {
      night.push(item)
    } else {
      day.push(item)
    }
  })

  return { day, night }
}
