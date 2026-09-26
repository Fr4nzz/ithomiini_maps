import { ref } from 'vue'
import maplibregl from 'maplibre-gl'
import { useDataStore } from '../stores/data'
import { useLegendStore } from '../stores/legend'
import { generateSpeciesBorderColors } from '../utils/colors'
import { withHeatmapWeights } from '../utils/heatmap'
import { readClusterLeaves } from '../utils/clusterLeaves'
import { computeClusterStats } from '../utils/clusterStats'
import { clusterMemberColor } from '../utils/clusterComposition'
import {
  generateColoredShapeImage,
  getColoredShapeImageName
} from '../utils/shapes'
import {
  removeLayerAndSource,
  generateCirclePolygon,
  getThemeAccentColor,
  colorToRgba
} from '../utils/mapHelpers'
import { generateRangePolygons, generateHexBins, invalidateRangeCache } from '../utils/rangePolygons'
import { DYNAMIC_COLORS } from '../utils/constants'
import { log } from '../utils/logger'

export function buildPointColorExpression({ colorMap, colorAttribute, speciesColorMap, collapsedSpecies, shownLabels }) {
  const entries = Object.entries(colorMap)
  let expression = entries.length === 0
    ? '#6b7280'
    : ['match', ['get', colorAttribute],
        ...entries.flatMap(([label, color]) => [
          label, shownLabels?.size > 0 && !shownLabels.has(label) ? '#6b7280' : color
        ]),
        '#6b7280']

  if (collapsedSpecies.length > 0) {
    expression = ['case', ...collapsedSpecies.flatMap(species => [
      ['==', ['get', 'scientific_name'], species], speciesColorMap[species] || '#6b7280'
    ]), expression]
  }
  return expression
}

export function buildPointSortKeyExpression(colorAttribute, shownLabels, collapsedSpecies) {
  if (shownLabels.size === 0) return 1
  const visible = ['in', ['get', colorAttribute], ['literal', Array.from(shownLabels)]]
  const colored = collapsedSpecies.length > 0
    ? ['any', ['in', ['get', 'scientific_name'], ['literal', collapsedSpecies]], visible]
    : visible
  return ['case', colored, 1, 0]
}

export function pointMarkerAppearance(properties, {
  colorBy, colorAttribute, colorMap, speciesColorMap, collapsedSpecies, shownLabels,
  speciesBorderColors, speciesBordersEnabled, shapesEnabled, getGroupShape, style,
}) {
  const species = properties.scientific_name
  const fill = clusterMemberColor(properties, {
    colorBy, colorAttribute, activeColorMap: colorMap, speciesColorMap,
    collapsedSpecies, shownLabels,
  })
  const shape = shapesEnabled ? (getGroupShape(species) || 'circle') : 'circle'
  const stroke = speciesBordersEnabled || shapesEnabled
    ? (speciesBorderColors[species] || style.borderColor)
    : style.borderColor
  return {
    shape, fill, stroke, width: style.borderWidth,
    fillOpacity: style.fillOpacity, strokeOpacity: style.borderOpacity,
  }
}

const CLUSTER_RADII = [12, 16, 20, 25, 32]
const POINT_ICON_SCALE_STOPS = [[3, 0.03], [6, 0.05], [10, 0.08], [14, 0.12]]
const POINT_CIRCLE_SCALE_STOPS = [[3, 0.375], [6, 0.625], [10, 1], [14, 1.5]]
const clusterOutlineName = radius => `cluster-outline-${radius}`

export function buildClusterOutlineExpression() {
  return ['step', ['get', 'point_count'],
    clusterOutlineName(12), 20, clusterOutlineName(16),
    50, clusterOutlineName(20), 100, clusterOutlineName(25),
    500, clusterOutlineName(32)]
}

function interpolateZoom(stops, zoom) {
  const upper = stops.findIndex(([at]) => zoom <= at)
  if (upper === -1) return stops[stops.length - 1][1]
  if (upper === 0) return stops[0][1]
  const [startZoom, startValue] = stops[upper - 1]
  const [endZoom, endValue] = stops[upper]
  return startValue + (endValue - startValue) * (zoom - startZoom) / (endZoom - startZoom)
}

/** Visible marker's outer radius (circle) or icon half-box, in screen pixels. */
export function visiblePointRadius(style, zoom, shapesEnabled = false) {
  const baseSize = style.pointSize * 0.9
  if (shapesEnabled) return 16 * baseSize * interpolateZoom(POINT_ICON_SCALE_STOPS, zoom)
  const circleRadius = baseSize * interpolateZoom(POINT_CIRCLE_SCALE_STOPS, zoom)
  const borderWidth = (style.borderWidth || 0) * interpolateZoom([[3, 0.33], [10, 1]], zoom)
  return circleRadius + borderWidth / 2
}

export function buildPointCirclePaint({ style, colorMap, colorAttribute, speciesColorMap,
  collapsedSpecies, shownLabels, speciesBordersEnabled, speciesBorderColors }) {
  const borders = Object.entries(speciesBorderColors)
  return {
    'circle-radius': ['interpolate', ['linear'], ['zoom'],
      ...POINT_CIRCLE_SCALE_STOPS.flatMap(([zoom, scale]) => [zoom, style.pointSize * 0.9 * scale])],
    'circle-color': buildPointColorExpression({
      colorMap, colorAttribute, speciesColorMap, collapsedSpecies, shownLabels,
    }),
    'circle-opacity': style.fillOpacity,
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'],
      3, style.borderWidth * 0.33, 10, style.borderWidth],
    'circle-stroke-color': speciesBordersEnabled && borders.length
      ? ['match', ['get', 'scientific_name'],
          ...borders.flatMap(([species, color]) => [species, color]), style.borderColor]
      : style.borderColor,
    'circle-stroke-opacity': style.borderOpacity,
  }
}

export function buildRangePointCirclePaint({ radii, colorMap, colorAttribute,
  speciesColorMap, collapsedSpecies, opacity, strokeWidth, strokeOpacity }) {
  return {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], ...radii.flat()],
    'circle-color': buildPointColorExpression({
      colorMap, colorAttribute, speciesColorMap, collapsedSpecies,
    }),
    'circle-opacity': opacity,
    'circle-stroke-width': strokeWidth,
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': strokeOpacity,
  }
}

function drawClusterOutline(radius) {
  const pixelRatio = 2
  const size = (radius + 3) * 2 * pixelRatio
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  context.beginPath()
  context.arc(size / 2, size / 2, (radius - 1) * pixelRatio, 0, Math.PI * 2)
  context.strokeStyle = '#ffffff'
  context.globalAlpha = 0.9
  context.lineWidth = 2 * pixelRatio
  context.stroke()
  return context.getImageData(0, 0, size, size)
}

export function useDataLayer(map, options = {}) {
  const store = useDataStore()
  const legendStore = useLegendStore()
  const { onShowPopup, onDataChanged } = options
  let dataGeneration = 0
  let clusterClickGeneration = 0

  let clusterHandlersRegistered = false
  let pointsHandlersRegistered = false
  let lastHoveredPointId = null
  let rangePopup = null
  let _lastClusterState = null
  let _lastClusterRadius = null
  let lastDataInput = null
  let lastHiddenItems = []
  let lastHiddenAttribute = null
  let lastPointsSource = null
  const registeredMarkerImages = new Set()

  const addMarkerImage = (appearance) => {
    const { shape, fill, stroke, width, fillOpacity, strokeOpacity } = appearance
    const name = getColoredShapeImageName(shape, fill, stroke, width, fillOpacity, strokeOpacity)
    if (!map.value.hasImage(name)) {
      map.value.addImage(name,
        generateColoredShapeImage(shape, fill, stroke, width, 64, fillOpacity, strokeOpacity),
        { pixelRatio: 2 })
    }
    return name
  }

  // Store current cluster extent parameters for recreation after style change
  const currentExtentParams = ref(null)
  let lastParamsUpdateTime = 0

  // Store cluster features for the selected cluster
  const currentClusterFeatures = ref(null)

  const updateClusterPointsLayer = (features) => {
    if (!map.value || !map.value.isStyleLoaded()) return

    removeLayerAndSource(map.value, 'cluster-points-layer', 'cluster-points-source')

    if (!store.clusterSettings.showClusterPoints || !features || features.length === 0) {
      currentClusterFeatures.value = null
      return
    }

    currentClusterFeatures.value = features

    const geojson = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: f.properties || {}
      }))
    }

    map.value.addSource('cluster-points-source', {
      type: 'geojson',
      data: geojson
    })

    const accentColor = getThemeAccentColor()
    const hasClustersLayer = map.value.getLayer('clusters')

    map.value.addLayer({
      id: 'cluster-points-layer',
      type: 'circle',
      source: 'cluster-points-source',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          3, 3, 6, 4, 10, 6, 14, 8
        ],
        'circle-color': accentColor,
        'circle-opacity': 0.8,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.9
      }
    }, hasClustersLayer ? 'clusters' : undefined)
  }

  const clearClusterPointsLayer = () => {
    currentClusterFeatures.value = null
    if (!map.value) return
    removeLayerAndSource(map.value, 'cluster-points-layer', 'cluster-points-source')
  }

  const recreateClusterPointsLayer = () => {
    if (currentClusterFeatures.value && store.clusterSettings.showClusterPoints) {
      updateClusterPointsLayer(currentClusterFeatures.value)
    }
  }

  const updateClusterExtentCircle = (centerLat, centerLng, radiusKm, clusterFeatures = null) => {
    if (!map.value || !map.value.isStyleLoaded()) return

    currentExtentParams.value = { centerLat, centerLng, radiusKm }
    lastParamsUpdateTime = Date.now()

    if (clusterFeatures) {
      updateClusterPointsLayer(clusterFeatures)
    }

    removeLayerAndSource(map.value, 'cluster-extent-dynamic')
    removeLayerAndSource(map.value, 'cluster-extent-dynamic-outline', 'cluster-extent-dynamic-source')

    if (radiusKm < 0.1) return

    const circleCoords = generateCirclePolygon(centerLng, centerLat, radiusKm)
    const circleGeoJSON = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoords]
        }
      }]
    }

    map.value.addSource('cluster-extent-dynamic-source', {
      type: 'geojson',
      data: circleGeoJSON
    })

    const accentColor = getThemeAccentColor()
    const fillColor = colorToRgba(accentColor, 0.1)
    const lineColor = colorToRgba(accentColor, 0.5)
    const hasClustersLayer = map.value.getLayer('clusters')

    try {
      map.value.addLayer({
        id: 'cluster-extent-dynamic',
        type: 'fill',
        source: 'cluster-extent-dynamic-source',
        paint: { 'fill-color': fillColor, 'fill-opacity': 1 }
      }, hasClustersLayer ? 'clusters' : undefined)

      map.value.addLayer({
        id: 'cluster-extent-dynamic-outline',
        type: 'line',
        source: 'cluster-extent-dynamic-source',
        paint: { 'line-color': lineColor, 'line-width': 2 }
      }, hasClustersLayer ? 'clusters' : undefined)
    } catch (err) {
      log.map.error('[ClusterExtent] Error adding layers:', err)
    }
  }

  let isStyleChanging = false

  const updateClusterExtentColors = () => {
    if (!map.value || !map.value.isStyleLoaded()) return false
    if (!map.value.getLayer('cluster-extent-dynamic')) return false

    const accentColor = getThemeAccentColor()
    const fillColor = colorToRgba(accentColor, 0.1)
    const lineColor = colorToRgba(accentColor, 0.5)

    try {
      map.value.setPaintProperty('cluster-extent-dynamic', 'fill-color', fillColor)
      map.value.setPaintProperty('cluster-extent-dynamic-outline', 'line-color', lineColor)
      return true
    } catch (err) {
      log.map.error('[ClusterExtent] Error updating colors:', err)
      return false
    }
  }

  const recreateClusterExtentCircle = () => {
    if (!currentExtentParams.value) return

    if (map.value?.getLayer('cluster-extent-dynamic')) {
      if (updateClusterExtentColors()) {
        recreateClusterPointsLayer()
        return
      }
    }

    const { centerLat, centerLng, radiusKm } = currentExtentParams.value
    updateClusterExtentCircle(centerLat, centerLng, radiusKm)
    recreateClusterPointsLayer()
  }

  const setStyleChanging = (value) => {
    isStyleChanging = value
  }

  const clearClusterExtentCircle = () => {
    const timeSinceUpdate = Date.now() - lastParamsUpdateTime

    if (isStyleChanging) return
    if (timeSinceUpdate < 200) return

    currentExtentParams.value = null
    clearClusterPointsLayer()

    if (!map.value) return
    removeLayerAndSource(map.value, 'cluster-extent-dynamic')
    removeLayerAndSource(map.value, 'cluster-extent-dynamic-outline', 'cluster-extent-dynamic-source')
  }

  const addDataLayer = (layerOptions = {}) => {
    const { skipZoom = false } = layerOptions

    if (!map.value) return

    const geojson = store.displayGeoJSON
    if (!geojson) return
    log.perf.start('addDataLayer')

    // Filter out hidden legend items from map data
    let mapData = geojson
    if (legendStore.hiddenItems.length > 0) {
      const colorAttrKey = store.colorByAttribute
      const hiddenSet = new Set(legendStore.hiddenItems)
      const visibleFeatures = geojson.features.filter(
        f => !hiddenSet.has(f.properties[colorAttrKey])
      )
      mapData = { type: 'FeatureCollection', features: visibleFeatures }
    }

    dataGeneration++
    onDataChanged?.(mapData)

    const isHeatmap = store.visualizationMode === 'heatmap'
    const isRanges = store.visualizationMode === 'ranges'
    const collapsedSpecies = store.colorBy === 'subspecies' ? legendStore.collapsedSpecies || [] : []
    const shouldCluster = store.visualizationMode === 'clusters'
    const settings = store.clusterSettings
    const clusterRadiusPixels = settings.radiusPixels
    const style = store.mapStyle
    const colorMap = store.activeColorMap
    const colorAttr = store.colorByAttribute
    const shownLabels = legendStore.shownLabels
    const shapesEnabled = legendStore.shapeSettings.enabled
    const speciesBordersEnabled = legendStore.speciesStyling.borderColor && store.colorBy === 'subspecies'
    const speciesBorderColors = speciesBordersEnabled
      ? generateSpeciesBorderColors(Object.keys(store.speciesSubspeciesMap).sort(), legendStore.speciesBorderColors)
      : legendStore.speciesBorderColors
    const activeMarkerImages = new Set()
    let sourceData = mapData

    if (isHeatmap) {
      sourceData = withHeatmapWeights(mapData)
    } else if (!isRanges && shapesEnabled) {
      sourceData = {
        type: 'FeatureCollection',
        features: mapData.features.map(feature => {
          const appearance = pointMarkerAppearance(feature.properties, {
            colorBy: store.colorBy, colorAttribute: colorAttr, colorMap,
            speciesColorMap: store.speciesColorMap, collapsedSpecies, shownLabels,
            speciesBorderColors, speciesBordersEnabled, shapesEnabled,
            getGroupShape: legendStore.getGroupShape, style,
          })
          const image = addMarkerImage(appearance)
          activeMarkerImages.add(image)
          return { ...feature, properties: { ...feature.properties, marker_icon: image } }
        })
      }
    }
    if (shouldCluster) {
      for (const radius of CLUSTER_RADII) {
        const image = clusterOutlineName(radius)
        if (!map.value.hasImage(image)) map.value.addImage(image, drawClusterOutline(radius), { pixelRatio: 2 })
        activeMarkerImages.add(image)
      }
    }

    // Check if we can update the existing source instead of full rebuild
    const existingSource = map.value.getSource('points-source')
    const nextPointLayerType = isHeatmap || isRanges ? null : (shapesEnabled ? 'symbol' : 'circle')
    // A circle-to-symbol change cannot reuse tile buckets under the same layer ID.
    const pointLayerTypeChanged = (map.value.getLayer('points-layer')?.type || null) !== nextPointLayerType
    const needsSourceRebuild = !existingSource ||
      (shouldCluster !== _lastClusterState) ||
      (clusterRadiusPixels !== _lastClusterRadius) ||
      pointLayerTypeChanged
    const hiddenItems = legendStore.hiddenItems
    const sameHiddenItems = hiddenItems.length === lastHiddenItems.length &&
      hiddenItems.every((item, index) => item === lastHiddenItems[index])
    // Custom-shape icons are baked into feature properties, so any restyle
    // produces new source data; plain circles are styled by expressions only.
    const dataChanged = sourceData !== mapData || geojson !== lastDataInput || !sameHiddenItems ||
      store.colorByAttribute !== lastHiddenAttribute || existingSource !== lastPointsSource

    if (rangePopup) { rangePopup.remove(); rangePopup = null }

    if (needsSourceRebuild) {
      // Full rebuild: remove everything and recreate
      ;['clusters', 'cluster-count', 'cluster-extent-dynamic',
        'cluster-extent-dynamic-outline', 'cluster-points-layer',
        'points-layer', 'points-highlight', 'heatmap-layer',
        'range-fill', 'range-outline', 'range-points'
      ].forEach(id => removeLayerAndSource(map.value, id))
      ;['points-source', 'cluster-extent-dynamic-source', 'cluster-points-source',
        'range-source'
      ].forEach(id => removeLayerAndSource(map.value, null, id))

      log.perf.start('addSource (full rebuild)')
      map.value.addSource('points-source', {
        type: 'geojson',
        data: sourceData,
        cluster: shouldCluster,
        clusterMaxZoom: 14,
        clusterRadius: clusterRadiusPixels,
        clusterMinPoints: 2,
        generateId: true
      })
      log.perf.end('addSource (full rebuild)')
      _lastClusterState = shouldCluster
      _lastClusterRadius = clusterRadiusPixels
    } else {
      // Style edits only need new layers. Re-sending unchanged GeoJSON makes
      // MapLibre reprocess every occurrence on its worker thread.
      if (dataChanged) {
        log.perf.start('setData (fast update)')
        existingSource.setData(sourceData)
        log.perf.end('setData (fast update)')
      }

      // Still need to rebuild layers for styling changes
      ;['clusters', 'cluster-count', 'cluster-extent-dynamic',
        'cluster-extent-dynamic-outline', 'cluster-points-layer',
        'points-layer', 'points-highlight', 'heatmap-layer',
        'range-fill', 'range-outline', 'range-points'
      ].forEach(id => {
        if (map.value.getLayer(id)) map.value.removeLayer(id)
      })
      removeLayerAndSource(map.value, null, 'range-source')
    }
    lastDataInput = geojson
    lastHiddenItems = [...hiddenItems]
    lastHiddenAttribute = store.colorByAttribute
    lastPointsSource = map.value.getSource('points-source')

    for (const image of registeredMarkerImages) {
      if (!activeMarkerImages.has(image) && map.value.hasImage(image)) map.value.removeImage(image)
    }
    registeredMarkerImages.clear()
    activeMarkerImages.forEach(image => registeredMarkerImages.add(image))

    // Heatmap visualization mode
    if (isHeatmap) {
      const heatSettings = store.heatmapSettings
      map.value.addLayer({
        id: 'heatmap-layer',
        type: 'heatmap',
        source: 'points-source',
        paint: {
          'heatmap-weight': ['get', 'heat_weight'],
          'heatmap-intensity': heatSettings.intensity,
          'heatmap-radius': heatSettings.radius,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(31, 83, 129, 0)',
            0.1, 'rgba(49, 113, 161, 0.3)',
            0.3, '#428fac',
            0.55, '#65b9ac',
            0.8, '#b8dd9b',
            1, '#f6e8a5'
          ],
          'heatmap-opacity': heatSettings.opacity
        }
      })

      if (!skipZoom) {
        fitBoundsToData(geojson)
      }
      log.perf.end('addDataLayer', `${mapData.features.length} features, shapes=${legendStore.shapeSettings.enabled}`)
      return
    }

    const addRangePointCircles = (radii, opacity, strokeWidth, strokeOpacity) => map.value.addLayer({
      id: 'range-points',
      type: 'circle',
      source: 'points-source',
      paint: buildRangePointCirclePaint({ radii, opacity, strokeWidth, strokeOpacity,
        colorMap, colorAttribute: colorAttr, speciesColorMap: store.speciesColorMap, collapsedSpecies }),
    })

    // Range polygon visualization mode
    if (isRanges) {
      const rangeSettings = store.rangeSettings
      const isHexBin = rangeSettings.method === 'hexbin'

      if (isHexBin) {
        const hexGeoJSON = generateHexBins(geojson, rangeSettings)

        if (hexGeoJSON.features.length > 0) {
          map.value.addSource('range-source', {
            type: 'geojson',
            data: hexGeoJSON
          })

          map.value.addLayer({
            id: 'range-fill',
            type: 'fill',
            source: 'range-source',
            paint: {
              'fill-color': [
                'interpolate', ['linear'], ['get', 'density'],
                0, '#FFE57F',
                0.2, '#FFCA28',
                0.4, '#FFA726',
                0.6, '#FF7043',
                0.8, '#F44336',
                1, '#C62828'
              ],
              'fill-opacity': rangeSettings.opacity
            }
          })

          map.value.addLayer({
            id: 'range-outline',
            type: 'line',
            source: 'range-source',
            paint: {
              'line-color': '#000000',
              'line-width': 0.5,
              'line-opacity': 0.15
            }
          })
        }

        if (rangeSettings.showPoints) {
          addRangePointCircles([[3, 1], [6, 2], [10, 3], [14, 5]], 0.4, 0, 0)
        }

        // Hex click popup
        map.value.off('click', 'range-fill')
        map.value.on('click', 'range-fill', (e) => {
          if (!e.features?.length) return
          const props = e.features[0].properties

          if (rangePopup) rangePopup.remove()
          rangePopup = new maplibregl.Popup({ maxWidth: '240px', className: 'custom-popup range-popup' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="padding:8px;font-size:0.85rem;">` +
              `<strong>${props.count} records</strong>` +
              `</div>`
            )
            .addTo(map.value)
        })

        map.value.on('mouseenter', 'range-fill', () => {
          map.value.getCanvas().style.cursor = 'pointer'
        })
        map.value.on('mouseleave', 'range-fill', () => {
          map.value.getCanvas().style.cursor = ''
        })

      } else {
        // Hull polygon method
        const groupBy = rangeSettings.groupBy

        // Build color map keyed by the groupBy attribute (not the legend's colorBy)
        const GROUP_ATTR = { species: 'scientific_name', subspecies: 'subspecies', genus: 'genus', mimicry: 'mimicry_ring' }
        const rangeAttr = GROUP_ATTR[groupBy] || 'scientific_name'
        const uniqueGroups = [...new Set(
          geojson.features.map(f => f.properties[rangeAttr]).filter(v => v && v !== 'Unknown' && v !== 'NA')
        )].sort()
        const rangeColorMap = {}
        uniqueGroups.forEach((name, i) => {
          rangeColorMap[name] = DYNAMIC_COLORS[i % DYNAMIC_COLORS.length]
        })

        const rangeGeoJSON = generateRangePolygons(geojson, rangeSettings, rangeColorMap)

        if (rangeGeoJSON.features.length > 0) {
          map.value.addSource('range-source', {
            type: 'geojson',
            data: rangeGeoJSON
          })

          const fillColorExpr = ['get', 'color']

          map.value.addLayer({
            id: 'range-fill',
            type: 'fill',
            source: 'range-source',
            paint: {
              'fill-color': fillColorExpr,
              'fill-opacity': rangeSettings.opacity
            }
          })

          map.value.addLayer({
            id: 'range-outline',
            type: 'line',
            source: 'range-source',
            paint: {
              'line-color': fillColorExpr,
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                3, 0.3, 8, 0.8, 14, 1.5
              ],
              'line-opacity': Math.min(0.6, rangeSettings.opacity * 0.7)
            }
          })
        }

        if (rangeSettings.showPoints) {
          addRangePointCircles([[3, 1.5], [6, 2.5], [10, 4], [14, 6]], 0.5, 0.5, 0.3)
        }

        // Hull polygon click handler
        if (rangeGeoJSON.features.length > 0) {
          map.value.off('click', 'range-fill')
          map.value.on('click', 'range-fill', (e) => {
            if (!e.features?.length) return
            const props = e.features[0].properties

            if (rangePopup) rangePopup.remove()
            rangePopup = new maplibregl.Popup({ maxWidth: '280px', className: 'custom-popup range-popup' })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="padding:8px;font-size:0.85rem;">` +
                `<strong style="font-style:italic;">${props.group_name}</strong><br/>` +
                `<span style="opacity:0.7;">${props.point_count.toLocaleString()} records</span><br/>` +
                `<span style="opacity:0.7;">${props.area_km2.toLocaleString()} km²</span>` +
                `</div>`
              )
              .addTo(map.value)
          })

          map.value.on('mouseenter', 'range-fill', () => {
            map.value.getCanvas().style.cursor = 'pointer'
          })
          map.value.on('mouseleave', 'range-fill', () => {
            map.value.getCanvas().style.cursor = ''
          })
        }
      }

      if (!skipZoom) {
        fitBoundsToData(geojson)
      }
      log.perf.end('addDataLayer', `${mapData.features.length} features, shapes=${legendStore.shapeSettings.enabled}`)
      return
    }

    if (shouldCluster) {
      // Keep the circle as the existing hit target and fill; its visible
      // outline is a symbol so locality text collides with the whole marker.
      map.value.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'points-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': [
            'step', ['get', 'point_count'],
            12, 20, 16, 50, 20, 100, 25, 500, 32
          ],
          'circle-color': '#34404b',
          'circle-opacity': 0.9,
          'circle-stroke-width': 0
        }
      })

      map.value.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'points-source',
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': buildClusterOutlineExpression(),
          'icon-padding': 0,
          'icon-allow-overlap': true,
          'icon-ignore-placement': false,
          'text-field': ['to-string', ['get', 'point_count']],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-allow-overlap': true
        },
        paint: { 'text-color': '#ffffff' }
      })
    }

    // Sort key: colored (legend) points render above grey (overflow) points
    const sortKeyExpression = buildPointSortKeyExpression(colorAttr, shownLabels, collapsedSpecies)

    const baseSize = style.pointSize * 0.9
    if (shapesEnabled) {
      map.value.addLayer({
        id: 'points-layer',
        type: 'symbol',
        source: 'points-source',
        filter: shouldCluster ? ['!', ['has', 'point_count']] : ['all'],
        layout: {
          'icon-image': ['get', 'marker_icon'],
          'icon-padding': 0,
          'icon-size': ['interpolate', ['linear'], ['zoom'],
            ...POINT_ICON_SCALE_STOPS.flatMap(([zoom, scale]) => [zoom, baseSize * scale])],
          'icon-allow-overlap': true,
          'icon-ignore-placement': style.fillOpacity === 0 && style.borderOpacity === 0,
          'symbol-sort-key': sortKeyExpression
        }
      })
    } else {
      map.value.addLayer({
        id: 'points-layer',
        type: 'circle',
        source: 'points-source',
        filter: shouldCluster ? ['!', ['has', 'point_count']] : ['all'],
        layout: { 'circle-sort-key': sortKeyExpression },
        paint: buildPointCirclePaint({
          style, colorMap, colorAttribute: colorAttr, speciesColorMap: store.speciesColorMap,
          collapsedSpecies, shownLabels, speciesBordersEnabled, speciesBorderColors,
        }),
      })
    }

    // Highlight layer (hover on individual points)
    const highlightSizeExpression = [
      'interpolate', ['linear'], ['zoom'],
      3, baseSize * 0.75,
      6, baseSize * 1.25,
      10, baseSize * 1.75,
      14, baseSize * 2.25
    ]

    map.value.addLayer({
      id: 'points-highlight',
      type: 'circle',
      source: 'points-source',
      filter: shouldCluster
        ? ['all', ['!', ['has', 'point_count']], ['==', ['id'], -1]]
        : ['==', ['id'], -1],
      paint: {
        'circle-radius': highlightSizeExpression,
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    })

    // Cluster event handlers
    if (shouldCluster) {
      if (clusterHandlersRegistered) {
        map.value.off('click', 'clusters')
        map.value.off('mouseenter', 'clusters')
        map.value.off('mouseleave', 'clusters')
      }
      clusterHandlersRegistered = true

      map.value.on('click', 'clusters', async (e) => {
        const features = map.value.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        if (!features.length) return

        const cluster = features[0]
        const coords = cluster.geometry.coordinates
        const clusterId = cluster.properties.cluster_id
        const pointCount = cluster.properties.point_count
        const clusterLng = coords[0]
        const clusterLat = coords[1]

        const source = map.value.getSource('points-source')
        const generation = dataGeneration
        const click = ++clusterClickGeneration
        let clusterFeatures
        try {
          clusterFeatures = await readClusterLeaves(source, clusterId, pointCount)
        } catch (error) {
          log.map.warn('Cluster membership is no longer available. Select the cluster again.', error)
          return
        }
        if (generation !== dataGeneration || click !== clusterClickGeneration ||
            map.value?.getSource('points-source') !== source || !clusterFeatures.length) return

        const clusterPoints = clusterFeatures.map(f => f.properties)

        if (clusterPoints.length > 0 && onShowPopup) {
          const clusterStats = computeClusterStats(clusterFeatures, clusterLat, clusterLng)
          updateClusterExtentCircle(clusterLat, clusterLng, clusterStats?.radiusKm || 0, clusterFeatures)

          onShowPopup({
            type: 'cluster',
            coordinates: { lat: clusterLat, lng: clusterLng },
            lngLat: coords,
            points: clusterPoints,
            isCluster: true,
            clusterStats
          })
        }
      })

      map.value.on('mouseenter', 'clusters', () => {
        map.value.getCanvas().style.cursor = 'pointer'
      })

      map.value.on('mouseleave', 'clusters', () => {
        map.value.getCanvas().style.cursor = ''
      })
    }

    // Individual point click
    map.value.off('click', 'points-layer')
    map.value.on('click', 'points-layer', (e) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const props = feature.properties
      const coords = feature.geometry.coordinates.slice()

      const lat = props._originalLat || coords[1]
      const lng = props._originalLng || coords[0]

      const isScattered = props._isScattered
      const scatteredSpecies = props._scatteredSpecies
      const scatteredSubspecies = props._scatteredSubspecies

      const pointsAtLocation = store.getPointsAtCoordinates(lat, lng)

      if (onShowPopup) {
        onShowPopup({
          type: 'point',
          coordinates: { lat, lng },
          lngLat: coords,
          points: pointsAtLocation.length > 0 ? pointsAtLocation : [props],
          initialSpecies: isScattered ? scatteredSpecies : null,
          initialSubspecies: isScattered ? scatteredSubspecies : null
        })
      }
    })

    // Points layer hover effects
    if (!pointsHandlersRegistered) {
      pointsHandlersRegistered = true

      map.value.on('mouseenter', 'points-layer', (e) => {
        map.value.getCanvas().style.cursor = 'pointer'

        if (e.features && e.features.length > 0) {
          const featureId = e.features[0].id
          if (featureId === lastHoveredPointId) return
          lastHoveredPointId = featureId
          const isClustering = store.clusteringEnabled
          const filter = isClustering
            ? ['all', ['!', ['has', 'point_count']], ['==', ['id'], featureId]]
            : ['==', ['id'], featureId]
          map.value.setFilter('points-highlight', filter)
        }
      })

      map.value.on('mouseleave', 'points-layer', () => {
        map.value.getCanvas().style.cursor = ''
        lastHoveredPointId = null
        const isClustering = store.clusteringEnabled
        const filter = isClustering
          ? ['all', ['!', ['has', 'point_count']], ['==', ['id'], -1]]
          : ['==', ['id'], -1]
        map.value.setFilter('points-highlight', filter)
      })
    }

    if (!skipZoom) {
      fitBoundsToData(geojson)
    }
    log.perf.end('addDataLayer', `${mapData.features.length} features, shapes=${legendStore.shapeSettings.enabled}`)
  }

  const fitBoundsToData = (geojson) => {
    if (!geojson || !geojson.features || geojson.features.length === 0) return

    if (geojson.features.length === 1) {
      const coords = geojson.features[0].geometry.coordinates
      map.value.flyTo({ center: coords, zoom: 8, duration: 1000 })
      return
    }

    const bounds = new maplibregl.LngLatBounds()
    geojson.features.forEach(f => bounds.extend(f.geometry.coordinates))

    map.value.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 12,
      duration: 1000
    })
  }

  return {
    addDataLayer,
    fitBoundsToData,
    clearClusterExtentCircle,
    recreateClusterExtentCircle,
    updateClusterExtentColors,
    setStyleChanging
  }
}
