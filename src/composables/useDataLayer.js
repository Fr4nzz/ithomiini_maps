import { ref } from 'vue'
import maplibregl from 'maplibre-gl'
import { useDataStore } from '../stores/data'
import { useLegendStore } from '../stores/legend'
import { generateSpeciesBorderColors } from '../utils/colors'
import { computeClusterStats, haversineDistance } from '../utils/clusterStats'
import {
  generateColoredShapeImage,
  getColoredShapeImageName,
  buildColoredShapeExpression
} from '../utils/shapes'
import {
  removeLayerAndSource,
  generateCirclePolygon,
  getThemeAccentColor,
  colorToRgba
} from '../utils/mapHelpers'

export function useDataLayer(map, options = {}) {
  const store = useDataStore()
  const legendStore = useLegendStore()
  const { onShowPopup } = options

  let clusterHandlersRegistered = false
  let pointsHandlersRegistered = false

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
      console.error('[ClusterExtent] Error adding layers:', err)
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
      console.error('[ClusterExtent] Error updating colors:', err)
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

    // Remove existing layers/sources
    ;['clusters', 'cluster-count', 'cluster-extent-dynamic',
      'cluster-extent-dynamic-outline', 'cluster-points-layer',
      'points-layer', 'points-highlight'
    ].forEach(id => removeLayerAndSource(map.value, id))
    ;['points-source', 'cluster-extent-dynamic-source', 'cluster-points-source'
    ].forEach(id => removeLayerAndSource(map.value, null, id))

    const geojson = store.displayGeoJSON
    if (!geojson) return

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

    const shouldCluster = store.clusteringEnabled
    const settings = store.clusterSettings
    const clusterRadiusPixels = settings.radiusPixels

    map.value.addSource('points-source', {
      type: 'geojson',
      data: mapData,
      cluster: shouldCluster,
      clusterMaxZoom: 14,
      clusterRadius: clusterRadiusPixels,
      clusterMinPoints: 2
    })

    if (shouldCluster) {
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
          'circle-color': [
            'step', ['get', 'point_count'],
            '#4ade80', 20, '#22d3ee', 50, '#facc15', 100, '#fb923c', 500, '#ef4444'
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9
        }
      })

      map.value.addLayer({
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
        paint: { 'text-color': '#1a1a2e' }
      })
    }

    // Individual points styling
    const colorMap = store.activeColorMap
    const colorAttr = store.colorByAttribute
    const style = store.mapStyle

    // Build color expression: items in the legend get their color,
    // overflow items (in color map but not shown in legend) get grey
    const shownLabels = legendStore.shownLabels
    const colorExpression = ['match', ['get', colorAttr]]
    Object.entries(colorMap).forEach(([value, color]) => {
      colorExpression.push(value, shownLabels.size > 0 && !shownLabels.has(value) ? '#6b7280' : color)
    })
    colorExpression.push('#6b7280')

    const baseSize = style.pointSize
    const sizeExpression = [
      'interpolate', ['linear'], ['zoom'],
      3, baseSize * 0.375,
      6, baseSize * 0.625,
      10, baseSize,
      14, baseSize * 1.5
    ]

    // Build border color expression (per-species or single color)
    let borderColorExpression = style.borderColor
    if (legendStore.speciesStyling.borderColor && store.colorBy === 'subspecies') {
      const speciesList = Object.keys(store.speciesSubspeciesMap).sort()
      const speciesBorderColors = generateSpeciesBorderColors(speciesList, legendStore.speciesBorderColors)

      borderColorExpression = ['match', ['get', 'scientific_name']]
      for (const [species, color] of Object.entries(speciesBorderColors)) {
        borderColorExpression.push(species, color)
      }
      borderColorExpression.push(style.borderColor)
    }

    const useShapes = legendStore.shapeSettings.enabled

    if (useShapes) {
      // BAKED-COLOR APPROACH: pre-rendered images with borders baked in
      // @see https://github.com/maplibre/maplibre-native/issues/2175
      const attrToImageMap = new Map()

      Object.entries(colorMap).forEach(([attrValue, fillColor]) => {
        let species = null
        for (const [sp, subs] of Object.entries(store.speciesSubspeciesMap || {})) {
          if (subs.includes(attrValue)) {
            species = sp
            break
          }
        }
        if (!species && store.colorBy !== 'subspecies') {
          species = attrValue
        }

        const shape = legendStore.getGroupShape(species) || 'circle'
        const strokeColor = legendStore.speciesBorderColors[species] || style.borderColor
        const imageName = getColoredShapeImageName(shape, fillColor, strokeColor, style.borderWidth)

        if (!map.value.hasImage(imageName)) {
          const imageData = generateColoredShapeImage(shape, fillColor, strokeColor, style.borderWidth, 64)
          map.value.addImage(imageName, imageData, { pixelRatio: 2 })
        }

        attrToImageMap.set(attrValue, imageName)
      })

      const defaultImageName = getColoredShapeImageName('circle', '#6b7280', style.borderColor, style.borderWidth)
      if (!map.value.hasImage(defaultImageName)) {
        const imageData = generateColoredShapeImage('circle', '#6b7280', style.borderColor, style.borderWidth, 64)
        map.value.addImage(defaultImageName, imageData, { pixelRatio: 2 })
      }

      const iconImageExpression = buildColoredShapeExpression(attrToImageMap, colorAttr, defaultImageName)

      const iconSizeExpression = [
        'interpolate', ['linear'], ['zoom'],
        3, baseSize * 0.03,
        6, baseSize * 0.05,
        10, baseSize * 0.08,
        14, baseSize * 0.12
      ]

      map.value.addLayer({
        id: 'points-layer',
        type: 'symbol',
        source: 'points-source',
        filter: shouldCluster ? ['!', ['has', 'point_count']] : ['all'],
        layout: {
          'icon-image': iconImageExpression,
          'icon-size': iconSizeExpression,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: { 'icon-opacity': style.fillOpacity }
      })
    } else {
      map.value.addLayer({
        id: 'points-layer',
        type: 'circle',
        source: 'points-source',
        filter: shouldCluster ? ['!', ['has', 'point_count']] : ['all'],
        paint: {
          'circle-radius': sizeExpression,
          'circle-color': colorExpression,
          'circle-opacity': style.fillOpacity,
          'circle-stroke-width': [
            'interpolate', ['linear'], ['zoom'],
            3, style.borderWidth * 0.33,
            10, style.borderWidth
          ],
          'circle-stroke-color': borderColorExpression,
          'circle-stroke-opacity': style.borderOpacity
        }
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
        ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']]
        : ['==', ['get', 'id'], ''],
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

        // Proximity-based fallback for finding cluster points
        const findClusterPointsByProximity = () => {
          const allPoints = store.displayGeoJSON?.features || []
          const zoom = map.value.getZoom()
          const clusterRadiusPx = store.clusterSettings.radiusPixels
          const metersPerPixel = 40075000 * Math.cos(clusterLat * Math.PI / 180) / (256 * Math.pow(2, zoom))
          const searchRadiusKm = (clusterRadiusPx * metersPerPixel / 1000) * 2.0

          const pointsWithDistance = allPoints.map(f => {
            const [lng, lat] = f.geometry.coordinates
            const distKm = haversineDistance(clusterLat, clusterLng, lat, lng)
            return { feature: f, distance: distKm }
          }).filter(p => p.distance <= searchRadiusKm)

          pointsWithDistance.sort((a, b) => a.distance - b.distance)
          return pointsWithDistance.slice(0, pointCount).map(p => p.feature)
        }

        const source = map.value.getSource('points-source')
        let clusterFeatures = null

        if (source && typeof source.getClusterLeaves === 'function') {
          try {
            clusterFeatures = await new Promise((resolve) => {
              const timeout = setTimeout(() => resolve(null), 500)
              source.getClusterLeaves(clusterId, pointCount, 0, (error, features) => {
                clearTimeout(timeout)
                resolve(error ? null : features)
              })
            })
          } catch {
            clusterFeatures = null
          }
        }

        if (!clusterFeatures || clusterFeatures.length === 0) {
          clusterFeatures = findClusterPointsByProximity()
        }

        if (!clusterFeatures || clusterFeatures.length === 0) return

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
          const id = e.features[0].properties.id
          const isClustering = store.clusteringEnabled
          const filter = isClustering
            ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], id]]
            : ['==', ['get', 'id'], id]
          map.value.setFilter('points-highlight', filter)
        }
      })

      map.value.on('mouseleave', 'points-layer', () => {
        map.value.getCanvas().style.cursor = ''
        const isClustering = store.clusteringEnabled
        const filter = isClustering
          ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], '']]
          : ['==', ['get', 'id'], '']
        map.value.setFilter('points-highlight', filter)
      })
    }

    if (!skipZoom) {
      fitBoundsToData(geojson)
    }
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
