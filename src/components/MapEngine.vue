<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDataStore } from '../stores/data'

const store = useDataStore()
const emit = defineEmits(['map-ready'])
const mapContainer = ref(null)
let map = null
let popup = null

// Legend position class based on store settings
const legendPositionClass = computed(() => {
  return `legend-${store.legendSettings.position}`
})

// Limit color map items for legend display
const limitedColorMap = computed(() => {
  const colorMap = store.activeColorMap
  const maxItems = store.legendSettings.maxItems
  const entries = Object.entries(colorMap)

  if (entries.length <= maxItems) {
    return colorMap
  }

  // Return only the first maxItems entries
  const limited = {}
  entries.slice(0, maxItems).forEach(([key, value]) => {
    limited[key] = value
  })
  return limited
})

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT PREVIEW OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

// Aspect ratio options mapping
const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1600, height: 1200 },
  '1:1': { width: 1200, height: 1200 },
  '3:2': { width: 1800, height: 1200 },
  'A4': { width: 2480, height: 3508 },
  'A4L': { width: 3508, height: 2480 },
  'custom': null
}

// Calculate export overlay dimensions based on container size and aspect ratio
const exportOverlayStyle = computed(() => {
  if (!store.exportSettings.enabled) return {}

  const ratio = store.exportSettings.aspectRatio
  let targetWidth, targetHeight

  if (ratio === 'custom') {
    targetWidth = store.exportSettings.customWidth
    targetHeight = store.exportSettings.customHeight
  } else if (ASPECT_RATIOS[ratio]) {
    targetWidth = ASPECT_RATIOS[ratio].width
    targetHeight = ASPECT_RATIOS[ratio].height
  } else {
    return {}
  }

  const aspectRatio = targetWidth / targetHeight

  // Calculate the maximum size that fits within the map container
  // while maintaining aspect ratio (using 80% of container)
  return {
    '--export-aspect-ratio': aspectRatio,
    '--export-width': targetWidth,
    '--export-height': targetHeight
  }
})

// Get bounds of the export area for coordinates display
const exportBoundsText = computed(() => {
  if (!store.exportSettings.enabled || !store.exportSettings.showCoordinates || !map) return ''

  try {
    const bounds = map.getBounds()
    if (!bounds) return ''

    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    return `${sw.lat.toFixed(4)}°, ${sw.lng.toFixed(4)}° — ${ne.lat.toFixed(4)}°, ${ne.lng.toFixed(4)}°`
  } catch (e) {
    return ''
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// MAP STYLES - Free tile sources
// ═══════════════════════════════════════════════════════════════════════════

const MAP_STYLES = {
  dark: {
    name: 'Dark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  },
  light: {
    name: 'Light',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  },
  satellite: {
    name: 'Satellite',
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics'
        }
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    }
  },
  terrain: {
    name: 'Terrain',
    style: {
      version: 8,
      sources: {
        'osm-terrain': {
          type: 'raster',
          tiles: [
            'https://tile.opentopomap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenTopoMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-terrain-layer',
          type: 'raster',
          source: 'osm-terrain',
          minzoom: 0,
          maxzoom: 17
        }
      ]
    }
  },
  streets: {
    name: 'Streets',
    style: {
      version: 8,
      sources: {
        'osm-streets': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-streets-layer',
          type: 'raster',
          source: 'osm-streets',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    }
  }
}

const currentStyle = ref('dark')

// ═══════════════════════════════════════════════════════════════════════════
// STATUS COLORS
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_COLORS = {
  'Sequenced': '#3b82f6',        // Blue
  'Tissue Available': '#10b981', // Green
  'Preserved Specimen': '#f59e0b', // Orange
  'Published': '#a855f7',        // Purple
  'GBIF Record': '#6b7280',      // Gray
  'Observation': '#22c55e',      // Green - Research Grade equivalent
  'Museum Specimen': '#8b5cf6',  // Purple
  'Living Specimen': '#14b8a6',  // Teal
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// MAP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const initMap = () => {
  const styleConfig = MAP_STYLES[currentStyle.value]
  
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: styleConfig.style,
    center: [-60, -5], // South America center (Ithomiini range)
    zoom: 4,
    attributionControl: false,
    maxZoom: 18,
    minZoom: 2
  })

  // Add controls
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-right')
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
  
  // Fullscreen control
  map.addControl(new maplibregl.FullscreenControl(), 'top-right')

  map.on('load', () => {
    addDataLayer()
    emit('map-ready', map)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA LAYER WITH SMART CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════

// Hover popup for cluster preview
let clusterHoverPopup = null

const addDataLayer = (options = {}) => {
  const { skipZoom = false } = options

  if (!map) return

  // Remove existing layers/sources if they exist
  const layersToRemove = [
    'clusters',
    'cluster-count',
    'points-layer',
    'points-highlight'
  ]
  layersToRemove.forEach(layer => {
    if (map.getLayer(layer)) map.removeLayer(layer)
  })
  if (map.getSource('points-source')) map.removeSource('points-source')

  const geojson = store.filteredGeoJSON
  if (!geojson) return

  const pointCount = geojson.features.length
  const shouldCluster = store.clusteringEnabled
  const settings = store.clusterSettings

  // Add source - use store settings for clustering
  map.addSource('points-source', {
    type: 'geojson',
    data: geojson,
    cluster: shouldCluster,
    clusterMaxZoom: settings.maxZoom,
    clusterRadius: settings.radius,
    clusterMinPoints: settings.minPoints
  })

  // Only add cluster layers if clustering is enabled
  if (shouldCluster) {
    // ─────────────────────────────────────────────────────────────────────────
    // CLUSTER CIRCLES - sized by point count
    // ─────────────────────────────────────────────────────────────────────────
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'points-source',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          12,      // 12px for count < 20
          20, 16,  // 16px for count >= 20
          50, 20,  // 20px for count >= 50
          100, 25, // 25px for count >= 100
          500, 32  // 32px for count >= 500
        ],
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#4ade80',   // Green for small clusters
          20, '#22d3ee', // Cyan
          50, '#facc15', // Yellow
          100, '#fb923c', // Orange
          500, '#ef4444'  // Red for large clusters
        ],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.9
      }
    })

    // ─────────────────────────────────────────────────────────────────────────
    // CLUSTER COUNT LABELS
    // ─────────────────────────────────────────────────────────────────────────
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'points-source',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#1a1a2e'
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INDIVIDUAL POINTS
  // ─────────────────────────────────────────────────────────────────────────

  // Build dynamic color expression based on store settings
  const colorMap = store.activeColorMap
  const colorAttr = store.colorByAttribute
  const style = store.mapStyle

  // Build MapLibre match expression for colors
  const colorExpression = ['match', ['get', colorAttr]]
  Object.entries(colorMap).forEach(([value, color]) => {
    colorExpression.push(value, color)
  })
  colorExpression.push('#6b7280') // default gray

  // Calculate point sizes based on style settings
  const baseSize = style.pointSize
  const sizeExpression = [
    'interpolate', ['linear'], ['zoom'],
    3, baseSize * 0.375,
    6, baseSize * 0.625,
    10, baseSize,
    14, baseSize * 1.5
  ]

  map.addLayer({
    id: 'points-layer',
    type: 'circle',
    source: 'points-source',
    filter: shouldCluster ? ['!', ['has', 'point_count']] : ['all'], // All points if no clustering
    paint: {
      'circle-radius': sizeExpression,
      'circle-color': colorExpression,
      'circle-opacity': style.fillOpacity,
      'circle-stroke-width': [
        'interpolate', ['linear'], ['zoom'],
        3, style.borderWidth * 0.33,
        10, style.borderWidth
      ],
      'circle-stroke-color': style.borderColor,
      'circle-stroke-opacity': style.borderOpacity
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // HIGHLIGHT LAYER (for hover on individual points)
  // ─────────────────────────────────────────────────────────────────────────
  const highlightSizeExpression = [
    'interpolate', ['linear'], ['zoom'],
    3, baseSize * 0.75,
    6, baseSize * 1.25,
    10, baseSize * 1.75,
    14, baseSize * 2.25
  ]

  map.addLayer({
    id: 'points-highlight',
    type: 'circle',
    source: 'points-source',
    filter: shouldCluster
      ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']]
      : ['==', ['get', 'id'], ''],
    paint: {
      'circle-radius': highlightSizeExpression,
      'circle-color': 'transparent',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // CLUSTER CLICK - show cluster contents popup
  // ─────────────────────────────────────────────────────────────────────────
  if (shouldCluster) {
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      if (!features.length) return

      const cluster = features[0]
      const clusterId = cluster.properties.cluster_id
      const pointCount = cluster.properties.point_count
      const coords = cluster.geometry.coordinates

      // Close existing popup
      if (popup) popup.remove()

      // Get cluster leaves (individual points)
      const source = map.getSource('points-source')

      try {
        // Get up to 100 points from the cluster for the preview
        const leaves = await new Promise((resolve, reject) => {
          source.getClusterLeaves(clusterId, 100, 0, (err, features) => {
            if (err) reject(err)
            else resolve(features)
          })
        })

        // Build cluster popup content
        const content = buildClusterPopupContent(leaves, pointCount, clusterId)

        popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: '380px',
          className: 'custom-popup cluster-popup'
        })
          .setLngLat(coords)
          .setHTML(content)
          .addTo(map)

        // Add click handler for zoom button after popup is added
        setTimeout(() => {
          const zoomBtn = document.getElementById(`zoom-cluster-${clusterId}`)
          if (zoomBtn) {
            zoomBtn.addEventListener('click', () => {
              source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return
                popup.remove()
                map.easeTo({
                  center: coords,
                  zoom: Math.min(zoom + 1, 16)
                })
              })
            })
          }
        }, 0)

      } catch (err) {
        console.error('Error getting cluster leaves:', err)
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INDIVIDUAL POINT CLICK - show popup
  // ─────────────────────────────────────────────────────────────────────────
  map.on('click', 'points-layer', (e) => {
    if (!e.features || e.features.length === 0) return

    const feature = e.features[0]
    const props = feature.properties
    const coords = feature.geometry.coordinates.slice()

    // Close existing popup
    if (popup) popup.remove()

    // Build popup content
    const content = buildPopupContent(props)

    popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '340px',
      className: 'custom-popup'
    })
      .setLngLat(coords)
      .setHTML(content)
      .addTo(map)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // HOVER EFFECTS
  // ─────────────────────────────────────────────────────────────────────────
  if (shouldCluster) {
    // Cluster hover - show preview popup with clickable points
    map.on('mouseenter', 'clusters', async (e) => {
      map.getCanvas().style.cursor = 'pointer'

      if (!e.features || !e.features.length) return

      const cluster = e.features[0]
      const clusterId = cluster.properties.cluster_id
      const pointCount = cluster.properties.point_count
      const coords = cluster.geometry.coordinates

      // Close existing hover popup
      if (clusterHoverPopup) clusterHoverPopup.remove()

      try {
        const source = map.getSource('points-source')
        // Get first 10 points for preview
        const leaves = await new Promise((resolve, reject) => {
          source.getClusterLeaves(clusterId, 10, 0, (err, features) => {
            if (err) reject(err)
            else resolve(features)
          })
        })

        const content = buildClusterHoverContent(leaves, pointCount, clusterId)

        clusterHoverPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: '280px',
          className: 'cluster-hover-popup',
          offset: 15
        })
          .setLngLat(coords)
          .setHTML(content)
          .addTo(map)

        // Add click handlers for individual points in the hover popup
        setTimeout(() => {
          leaves.forEach((leaf, idx) => {
            const btn = document.getElementById(`cluster-point-${clusterId}-${idx}`)
            if (btn) {
              btn.addEventListener('click', (evt) => {
                evt.stopPropagation()
                if (clusterHoverPopup) clusterHoverPopup.remove()
                if (popup) popup.remove()

                const props = leaf.properties
                const pointCoords = leaf.geometry.coordinates

                popup = new maplibregl.Popup({
                  closeButton: true,
                  closeOnClick: true,
                  maxWidth: '340px',
                  className: 'custom-popup'
                })
                  .setLngLat(pointCoords)
                  .setHTML(buildPopupContent(props))
                  .addTo(map)
              })
            }
          })
        }, 0)

      } catch (err) {
        console.error('Error getting cluster preview:', err)
      }
    })

    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = ''
      // Delay removal to allow clicking on popup items
      setTimeout(() => {
        if (clusterHoverPopup && !clusterHoverPopup.getElement()?.matches(':hover')) {
          clusterHoverPopup.remove()
          clusterHoverPopup = null
        }
      }, 100)
    })
  }

  map.on('mouseenter', 'points-layer', (e) => {
    map.getCanvas().style.cursor = 'pointer'

    if (e.features && e.features.length > 0) {
      const id = e.features[0].properties.id
      const filter = shouldCluster
        ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], id]]
        : ['==', ['get', 'id'], id]
      map.setFilter('points-highlight', filter)
    }
  })

  map.on('mouseleave', 'points-layer', () => {
    map.getCanvas().style.cursor = ''
    const filter = shouldCluster
      ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']]
      : ['==', ['get', 'id'], '']
    map.setFilter('points-highlight', filter)
  })

  // Fit bounds to data (with padding) - only if not skipping zoom
  if (!skipZoom) {
    fitBoundsToData(geojson)
  }

  // Log clustering status
  console.log(`📍 ${pointCount} points loaded. Clustering: ${shouldCluster ? 'ON' : 'OFF'}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER POPUP BUILDER
// ═══════════════════════════════════════════════════════════════════════════

const buildClusterPopupContent = (leaves, totalCount, clusterId) => {
  // Group by species
  const speciesCounts = {}
  const statusCounts = {}

  leaves.forEach(leaf => {
    const props = leaf.properties
    const species = props.scientific_name || 'Unknown'
    const status = props.sequencing_status || 'Unknown'

    speciesCounts[species] = (speciesCounts[species] || 0) + 1
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  // Sort species by count
  const sortedSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // Top 8 species

  let html = `<div class="cluster-popup-content">`

  // Header
  html += `
    <div class="cluster-header">
      <span class="cluster-count">${totalCount.toLocaleString()}</span>
      <span class="cluster-label">records in this area</span>
    </div>
  `

  // Species breakdown
  html += `<div class="cluster-section">
    <div class="cluster-section-title">Top Species</div>
    <div class="cluster-species-list">`

  sortedSpecies.forEach(([species, count]) => {
    const pct = Math.round((count / leaves.length) * 100)
    html += `
      <div class="cluster-species-item">
        <em>${species}</em>
        <span class="cluster-species-count">${count} (${pct}%)</span>
      </div>
    `
  })

  if (Object.keys(speciesCounts).length > 8) {
    html += `<div class="cluster-more">+ ${Object.keys(speciesCounts).length - 8} more species</div>`
  }

  html += `</div></div>`

  // Status breakdown
  html += `<div class="cluster-section">
    <div class="cluster-section-title">By Status</div>
    <div class="cluster-status-grid">`

  Object.entries(statusCounts).forEach(([status, count]) => {
    const color = STATUS_COLORS[status] || '#6b7280'
    html += `
      <div class="cluster-status-item">
        <span class="status-dot" style="background: ${color}"></span>
        <span>${status}: ${count}</span>
      </div>
    `
  })

  html += `</div></div>`

  // Zoom button
  html += `
    <button id="zoom-cluster-${clusterId}" class="cluster-zoom-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
        <path d="M11 8v6M8 11h6"/>
      </svg>
      Zoom to explore points
    </button>
  `

  html += `</div>`
  return html
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER HOVER PREVIEW BUILDER
// ═══════════════════════════════════════════════════════════════════════════

const buildClusterHoverContent = (leaves, totalCount, clusterId) => {
  let html = `<div class="cluster-hover-content">`

  // Header
  html += `
    <div class="cluster-hover-header">
      <span class="cluster-hover-count">${totalCount.toLocaleString()}</span>
      <span class="cluster-hover-label">points</span>
      <span class="cluster-hover-hint">Click cluster or point below</span>
    </div>
  `

  // List of points (clickable)
  html += `<div class="cluster-hover-list">`

  leaves.forEach((leaf, idx) => {
    const props = leaf.properties
    const species = props.scientific_name || 'Unknown'
    const status = props.sequencing_status || 'Unknown'
    const statusColor = STATUS_COLORS[status] || '#6b7280'
    const id = props.id || `#${idx + 1}`

    html += `
      <button id="cluster-point-${clusterId}-${idx}" class="cluster-hover-item">
        <span class="status-dot" style="background: ${statusColor}"></span>
        <span class="cluster-hover-species"><em>${species}</em></span>
        <span class="cluster-hover-id">${id}</span>
      </button>
    `
  })

  html += `</div>`

  // "More" indicator if there are more points
  if (totalCount > leaves.length) {
    html += `<div class="cluster-hover-more">+ ${totalCount - leaves.length} more points</div>`
  }

  html += `</div>`
  return html
}

// ═══════════════════════════════════════════════════════════════════════════
// POPUP BUILDER
// ═══════════════════════════════════════════════════════════════════════════

const buildPopupContent = (props) => {
  // Parse props (MapLibre stringifies nested objects)
  const p = typeof props === 'string' ? JSON.parse(props) : props

  const statusColor = STATUS_COLORS[p.sequencing_status] || '#6b7280'
  const showThumbnail = store.showThumbnail
  const hasImage = p.image_url && p.image_url !== 'null' && p.image_url !== ''

  let html = `<div class="popup-content">`

  // Header with species name
  html += `
    <div class="popup-header">
      <span class="status-dot" style="background: ${statusColor}"></span>
      <strong>${p.scientific_name || 'Unknown'}</strong>
    </div>
    <div class="popup-body">
  `

  // Thumbnail on the left (if enabled and available)
  if (showThumbnail && hasImage) {
    html += `
      <div class="popup-thumbnail">
        <img src="${p.image_url}" alt="Specimen ${p.id}" loading="lazy" onerror="this.style.display='none'" />
      </div>
    `
  }

  // Info section
  html += `<div class="popup-info">`

  // Subspecies
  if (p.subspecies && p.subspecies !== 'null' && p.subspecies !== 'None') {
    html += `<div class="popup-row"><span class="label">Subspecies:</span> <em>${p.subspecies}</em></div>`
  }

  // Core info
  html += `
    <div class="popup-row"><span class="label">ID:</span> ${p.id || 'N/A'}</div>
    <div class="popup-row"><span class="label">Status:</span> <span style="color: ${statusColor}">${p.sequencing_status || 'Unknown'}</span></div>
    <div class="popup-row"><span class="label">Source:</span> ${p.source || 'Unknown'}</div>
  `

  // Mimicry ring
  if (p.mimicry_ring && p.mimicry_ring !== 'Unknown' && p.mimicry_ring !== 'null') {
    html += `<div class="popup-row"><span class="label">Mimicry Ring:</span> ${p.mimicry_ring}</div>`
  }

  // Country
  if (p.country && p.country !== 'null' && p.country !== 'Unknown') {
    html += `<div class="popup-row"><span class="label">Country:</span> ${p.country}</div>`
  }

  // Coordinates
  if (p.lat && p.lng) {
    html += `<div class="popup-row"><span class="label">Coordinates:</span> ${parseFloat(p.lat).toFixed(4)}, ${parseFloat(p.lng).toFixed(4)}</div>`
  }

  html += `</div>` // close popup-info
  html += `</div>` // close popup-body
  html += `</div>` // close popup-content
  return html
}

// ═══════════════════════════════════════════════════════════════════════════
// MAP UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const fitBoundsToData = (geojson) => {
  if (!geojson || !geojson.features || geojson.features.length === 0) return

  // If only one point, just center on it
  if (geojson.features.length === 1) {
    const coords = geojson.features[0].geometry.coordinates
    map.flyTo({
      center: coords,
      zoom: 8,
      duration: 1000
    })
    return
  }

  const bounds = new maplibregl.LngLatBounds()
  
  geojson.features.forEach(f => {
    bounds.extend(f.geometry.coordinates)
  })

  map.fitBounds(bounds, {
    padding: { top: 50, bottom: 50, left: 50, right: 50 },
    maxZoom: 12,
    duration: 1000
  })
}

// Track previous data length to detect actual data changes vs just settings changes
let previousDataLength = 0

// Watch for filter changes and update the map
watch(
  () => store.filteredGeoJSON,
  (newData) => {
    if (!map || !map.isStyleLoaded()) return

    const newLength = newData?.features?.length || 0
    const dataChanged = newLength !== previousDataLength
    previousDataLength = newLength

    // Always rebuild to ensure clustering settings are applied correctly
    // Only zoom if the actual data changed (not just clustering settings)
    addDataLayer({ skipZoom: !dataChanged })
  },
  { deep: true }
)

// Watch for clustering settings changes - rebuild layers without zoom
watch(
  [() => store.clusteringEnabled, () => store.clusterSettings],
  () => {
    if (!map || !map.isStyleLoaded()) return
    // Rebuild the data layer with new clustering settings - skip zoom
    addDataLayer({ skipZoom: true })
  },
  { deep: true }
)

// Watch for color and style settings changes - rebuild layers without zoom
watch(
  [() => store.colorBy, () => store.mapStyle],
  () => {
    if (!map || !map.isStyleLoaded()) return
    // Rebuild the data layer with new color/style settings - skip zoom
    addDataLayer({ skipZoom: true })
  },
  { deep: true }
)

// ═══════════════════════════════════════════════════════════════════════════
// STYLE SWITCHER
// ═══════════════════════════════════════════════════════════════════════════

const switchStyle = (styleName) => {
  if (!map || !MAP_STYLES[styleName]) return

  // Save current view state before style change
  const center = map.getCenter()
  const zoom = map.getZoom()
  const bearing = map.getBearing()
  const pitch = map.getPitch()

  currentStyle.value = styleName
  const styleConfig = MAP_STYLES[styleName]

  map.setStyle(styleConfig.style)

  // Use a more robust approach: wait for style to be fully loaded
  const waitForStyleAndAddLayer = () => {
    if (map.isStyleLoaded()) {
      // Restore view state
      map.jumpTo({ center, zoom, bearing, pitch })
      // Re-add the data layer with current filtered data - skip zoom to preserve view
      addDataLayer({ skipZoom: true })
    } else {
      // Style not ready yet, try again
      setTimeout(waitForStyleAndAddLayer, 50)
    }
  }

  // Start checking after style.load event (or immediately for inline styles)
  map.once('style.load', () => {
    // Give it a small delay then check if truly ready
    setTimeout(waitForStyleAndAddLayer, 100)
  })

  // Fallback: also try on idle event
  map.once('idle', () => {
    if (!map.getSource('points-source')) {
      map.jumpTo({ center, zoom, bearing, pitch })
      addDataLayer({ skipZoom: true })
    }
  })
}
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map"></div>
    
    <!-- Style Switcher -->
    <div class="style-switcher">
      <button 
        v-for="(config, key) in MAP_STYLES" 
        :key="key"
        :class="{ active: currentStyle === key }"
        @click="switchStyle(key)"
        :title="config.name"
      >
        {{ config.name }}
      </button>
    </div>

    <!-- Legend -->
    <div
      v-if="store.legendSettings.showLegend"
      class="legend"
      :class="legendPositionClass"
      :style="{ fontSize: store.legendSettings.textSize + 'rem' }"
    >
      <div class="legend-title">{{ store.legendTitle }}</div>
      <div
        v-for="(color, label) in limitedColorMap"
        :key="label"
        class="legend-item"
      >
        <span class="legend-dot" :style="{ backgroundColor: color }"></span>
        <span :class="{ 'legend-label-italic': store.colorBy === 'species' || store.colorBy === 'subspecies' || store.colorBy === 'genus' }">{{ label }}</span>
      </div>
      <div v-if="Object.keys(store.activeColorMap).length > store.legendSettings.maxItems" class="legend-more">
        + {{ Object.keys(store.activeColorMap).length - store.legendSettings.maxItems }} more
      </div>
    </div>

    <!-- Export Preview Overlay -->
    <div v-if="store.exportSettings.enabled" class="export-overlay" :style="exportOverlayStyle">
      <!-- Export region with surrounding dark mask -->
      <div class="export-region">
        <!-- Corner handles -->
        <div class="export-corner export-corner-tl"></div>
        <div class="export-corner export-corner-tr"></div>
        <div class="export-corner export-corner-bl"></div>
        <div class="export-corner export-corner-br"></div>

        <!-- Export info -->
        <div class="export-info">
          <span class="export-ratio">{{ store.exportSettings.aspectRatio }}</span>
          <span v-if="store.exportSettings.showCoordinates" class="export-coords">{{ exportBoundsText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map {
  width: 100%;
  height: 100%;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLE SWITCHER
   ═══════════════════════════════════════════════════════════════════════════ */

.style-switcher {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 4px;
  background: rgba(26, 26, 46, 0.95);
  padding: 6px;
  border-radius: 8px;
  z-index: 10;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

.style-switcher button {
  padding: 6px 12px;
  background: #252540;
  border: 1px solid #3d3d5c;
  color: #aaa;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.style-switcher button:hover {
  background: #2d2d4a;
  color: #fff;
}

.style-switcher button.active {
  background: #4ade80;
  color: #1a1a2e;
  border-color: #4ade80;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEGEND
   ═══════════════════════════════════════════════════════════════════════════ */

.legend {
  position: absolute;
  background: rgba(26, 26, 46, 0.95);
  padding: 12px 16px;
  border-radius: 8px;
  z-index: 10;
  min-width: 160px;
  max-width: 220px;
  max-height: 400px;
  overflow-y: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

/* Legend positioning */
.legend-bottom-left {
  bottom: 30px;
  left: 10px;
}

.legend-bottom-right {
  bottom: 30px;
  right: 10px;
}

.legend-top-left {
  top: 60px;
  left: 10px;
}

.legend-top-right {
  top: 60px;
  right: 10px;
}

.legend-title {
  font-size: 0.875em;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #3d3d5c;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1em;
  color: #e0e0e0;
  margin-bottom: 6px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-label-italic {
  font-style: italic;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
}

.legend-more {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3d3d5c;
  font-size: 0.85em;
  color: #666;
  font-style: italic;
}

/* ═══════════════════════════════════════════════════════════════════════════
   POPUP STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

:deep(.maplibregl-popup-content) {
  background: #1a1a2e !important;
  color: #e0e0e0 !important;
  border-radius: 10px;
  padding: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  border: 1px solid #3d3d5c;
  max-width: 340px;
}

:deep(.maplibregl-popup-close-button) {
  color: #888 !important;
  font-size: 20px;
  padding: 6px 10px;
  line-height: 1;
}

:deep(.maplibregl-popup-close-button:hover) {
  color: #fff !important;
  background: transparent !important;
}

:deep(.maplibregl-popup-tip) {
  border-top-color: #1a1a2e !important;
}

:deep(.popup-content) {
  padding: 14px 18px;
}

:deep(.popup-header) {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1em;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #3d3d5c;
}

:deep(.popup-header strong) {
  font-style: italic;
  color: #fff;
}

:deep(.status-dot) {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

:deep(.popup-row) {
  font-size: 0.85em;
  margin-bottom: 5px;
  color: #ccc;
  line-height: 1.4;
}

:deep(.popup-row .label) {
  color: #888;
  margin-right: 6px;
}

:deep(.popup-body) {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

:deep(.popup-thumbnail) {
  flex-shrink: 0;
  width: 100px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  background: #252540;
  border: 1px solid #3d3d5c;
}

:deep(.popup-thumbnail img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

:deep(.popup-info) {
  flex: 1;
  min-width: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLUSTER POPUP STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

:deep(.cluster-popup-content) {
  padding: 14px 18px;
}

:deep(.cluster-header) {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #3d3d5c;
}

:deep(.cluster-count) {
  font-size: 1.4em;
  font-weight: 700;
  color: #4ade80;
}

:deep(.cluster-label) {
  font-size: 0.85em;
  color: #888;
}

:deep(.cluster-section) {
  margin-bottom: 12px;
}

:deep(.cluster-section-title) {
  font-size: 0.7em;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  margin-bottom: 6px;
}

:deep(.cluster-species-list) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.cluster-species-item) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85em;
  color: #e0e0e0;
}

:deep(.cluster-species-item em) {
  color: #fff;
}

:deep(.cluster-species-count) {
  color: #888;
  font-size: 0.9em;
}

:deep(.cluster-more) {
  font-size: 0.8em;
  color: #666;
  font-style: italic;
  margin-top: 4px;
}

:deep(.cluster-status-grid) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

:deep(.cluster-status-item) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8em;
  color: #ccc;
}

:deep(.cluster-zoom-btn) {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 6px;
  color: #4ade80;
  font-size: 0.85em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

:deep(.cluster-zoom-btn:hover) {
  background: rgba(74, 222, 128, 0.25);
  border-color: rgba(74, 222, 128, 0.5);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLUSTER HOVER POPUP STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

:deep(.cluster-hover-popup .maplibregl-popup-content) {
  padding: 0;
  background: rgba(26, 26, 46, 0.98) !important;
  border: 1px solid #4ade80;
  box-shadow: 0 4px 20px rgba(74, 222, 128, 0.2);
}

:deep(.cluster-hover-popup .maplibregl-popup-tip) {
  border-top-color: rgba(26, 26, 46, 0.98) !important;
}

:deep(.cluster-hover-content) {
  padding: 10px 12px;
  max-height: 280px;
  overflow-y: auto;
}

:deep(.cluster-hover-header) {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #3d3d5c;
  flex-wrap: wrap;
}

:deep(.cluster-hover-count) {
  font-size: 1.1em;
  font-weight: 700;
  color: #4ade80;
}

:deep(.cluster-hover-label) {
  font-size: 0.85em;
  color: #888;
}

:deep(.cluster-hover-hint) {
  font-size: 0.7em;
  color: #666;
  font-style: italic;
  margin-left: auto;
}

:deep(.cluster-hover-list) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.cluster-hover-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}

:deep(.cluster-hover-item:hover) {
  background: rgba(74, 222, 128, 0.1);
  border-color: rgba(74, 222, 128, 0.3);
}

:deep(.cluster-hover-item .status-dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

:deep(.cluster-hover-species) {
  flex: 1;
  font-size: 0.8em;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.cluster-hover-species em) {
  color: #fff;
}

:deep(.cluster-hover-id) {
  font-size: 0.7em;
  color: #666;
  font-family: monospace;
}

:deep(.cluster-hover-more) {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3d3d5c;
  font-size: 0.75em;
  color: #666;
  text-align: center;
  font-style: italic;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .style-switcher {
    top: auto;
    bottom: 100px;
    left: 10px;
    flex-wrap: wrap;
    max-width: calc(100% - 20px);
  }
  
  .style-switcher button {
    padding: 8px 10px;
    font-size: 0.7em;
  }
  
  .legend {
    bottom: 160px;
    font-size: 0.9em;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT PREVIEW OVERLAY
   ═══════════════════════════════════════════════════════════════════════════ */

.export-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-region {
  position: relative;
  max-width: 85%;
  max-height: 85%;
  aspect-ratio: var(--export-aspect-ratio);
  border: 2px dashed rgba(74, 222, 128, 0.9);
  border-radius: 4px;
  /* Use huge box-shadow to create dark overlay around the region */
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}

/* Corner handles */
.export-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #4ade80;
  background: transparent;
}

.export-corner-tl {
  top: -2px;
  left: -2px;
  border-right: none;
  border-bottom: none;
}

.export-corner-tr {
  top: -2px;
  right: -2px;
  border-left: none;
  border-bottom: none;
}

.export-corner-bl {
  bottom: -2px;
  left: -2px;
  border-right: none;
  border-top: none;
}

.export-corner-br {
  bottom: -2px;
  right: -2px;
  border-left: none;
  border-top: none;
}

/* Export info display */
.export-info {
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  align-items: center;
  background: rgba(26, 26, 46, 0.95);
  padding: 6px 12px;
  border-radius: 4px;
  white-space: nowrap;
}

.export-ratio {
  font-size: 0.8em;
  font-weight: 600;
  color: #4ade80;
}

.export-coords {
  font-size: 0.75em;
  color: #aaa;
  font-family: monospace;
}
</style>
