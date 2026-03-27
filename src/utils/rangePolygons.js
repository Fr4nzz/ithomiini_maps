import concave from '@turf/concave'
import convex from '@turf/convex'
import buffer from '@turf/buffer'
import area from '@turf/area'
import bbox from '@turf/bbox'
import hexGrid from '@turf/hex-grid'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { featureCollection, point } from '@turf/helpers'

const GROUP_KEYS = {
  species: 'scientific_name',
  subspecies: 'subspecies',
  genus: 'genus',
  mimicry: 'mimicry_ring',
}

let _cache = { key: null, result: null }

function cacheKey(features, settings) {
  const len = features.length
  const first = features[0]?.properties?.id || ''
  const last = features[len - 1]?.properties?.id || ''
  return `${settings.method || 'hulls'}|${len}|${first}|${last}|${settings.groupBy}|${settings.bufferKm}|${settings.minPoints}|${settings.hexSize || 50}`
}

function groupFeatures(features, groupBy) {
  const key = GROUP_KEYS[groupBy] || GROUP_KEYS.species
  const groups = new Map()

  for (const feature of features) {
    const value = feature.properties[key]
    if (!value || value === 'Unknown' || value === 'NA' || value === 'null' || value === 'NaN') continue

    if (!groups.has(value)) {
      groups.set(value, [])
    }
    groups.get(value).push(feature)
  }

  return groups
}

// >= 10 points → concave hull (alpha shape) for tighter fit
// 3-9 points → convex hull (stable with few points)
// Concave can throw on degenerate inputs; convex is always the fallback
function generateHull(features, maxEdgeKm = 500) {
  if (features.length < 3) return null

  const points = featureCollection(
    features.map(f => point(f.geometry.coordinates))
  )

  let hull = null

  if (features.length >= 10) {
    try {
      hull = concave(points, { maxEdge: maxEdgeKm, units: 'kilometers' })
    } catch {
      // degenerate input — fall through to convex
    }
  }

  if (!hull) {
    try {
      hull = convex(points)
    } catch {
      return null
    }
  }

  return hull
}

function applyBuffer(polygon, radiusKm) {
  if (!polygon || radiusKm <= 0) return polygon

  try {
    const buffered = buffer(polygon, radiusKm, { units: 'kilometers' })
    return buffered || polygon
  } catch {
    return polygon
  }
}

function calculateAreaKm2(polygon) {
  if (!polygon) return 0
  try {
    return area(polygon) / 1_000_000
  } catch {
    return 0
  }
}

export function generateHexBins(geojson, settings) {
  if (!geojson?.features?.length) {
    return featureCollection([])
  }

  const { hexSize = 50 } = settings

  const key = cacheKey(geojson.features, { ...settings, method: 'hexbin' })
  if (_cache.key === key && _cache.result) {
    return _cache.result
  }

  const t0 = performance.now()

  const dataBbox = bbox(geojson)
  const pad = hexSize / 111 * 1.5
  const paddedBbox = [
    dataBbox[0] - pad,
    dataBbox[1] - pad,
    dataBbox[2] + pad,
    dataBbox[3] + pad,
  ]

  const grid = hexGrid(paddedBbox, hexSize, { units: 'kilometers' })

  // Spatial index: bucket points into rough grid cells for fast lookup
  const cellSize = hexSize / 111
  const pointBuckets = new Map()
  for (const feature of geojson.features) {
    const [lng, lat] = feature.geometry.coordinates
    const bx = Math.floor(lng / cellSize)
    const by = Math.floor(lat / cellSize)
    const bKey = `${bx},${by}`
    if (!pointBuckets.has(bKey)) pointBuckets.set(bKey, [])
    pointBuckets.get(bKey).push(feature)
  }

  let maxCount = 0
  const nonEmptyHexes = []

  for (const hex of grid.features) {
    const hexBbox = bbox(hex)
    const minBx = Math.floor(hexBbox[0] / cellSize) - 1
    const maxBx = Math.floor(hexBbox[2] / cellSize) + 1
    const minBy = Math.floor(hexBbox[1] / cellSize) - 1
    const maxBy = Math.floor(hexBbox[3] / cellSize) + 1

    let count = 0
    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        const candidates = pointBuckets.get(`${bx},${by}`)
        if (!candidates) continue
        for (const pt of candidates) {
          if (booleanPointInPolygon(pt, hex)) count++
        }
      }
    }

    if (count > 0) {
      hex.properties = { count }
      nonEmptyHexes.push(hex)
      if (count > maxCount) maxCount = count
    }
  }

  // Log-scale normalization so a single hotspot doesn't wash out everything else
  const logMax = Math.log1p(maxCount)
  for (const hex of nonEmptyHexes) {
    hex.properties.density = logMax > 0 ? Math.log1p(hex.properties.count) / logMax : 0
  }

  const result = featureCollection(nonEmptyHexes)
  result._maxCount = maxCount

  _cache = { key, result }

  console.log(
    `[Perf] generateHexBins: ${(performance.now() - t0).toFixed(1)}ms, ` +
    `${grid.features.length} cells → ${nonEmptyHexes.length} non-empty, max=${maxCount}`
  )

  return result
}

export function generateRangePolygons(geojson, settings, colorMap = {}) {
  if (!geojson?.features?.length) {
    return featureCollection([])
  }

  const { groupBy = 'species', bufferKm = 25, minPoints = 3 } = settings

  const key = cacheKey(geojson.features, settings)
  if (_cache.key === key && _cache.result) {
    return _cache.result
  }

  const t0 = performance.now()
  const groups = groupFeatures(geojson.features, groupBy)
  const polygonFeatures = []

  for (const [groupName, features] of groups) {
    if (features.length < Math.max(3, minPoints)) continue

    const hull = generateHull(features, 500)
    if (!hull) continue

    const buffered = applyBuffer(hull, bufferKm)
    if (!buffered) continue

    const areaKm2 = calculateAreaKm2(buffered)

    buffered.properties = {
      group_name: groupName,
      group_by: groupBy,
      point_count: features.length,
      area_km2: Math.round(areaKm2 * 100) / 100,
      color: colorMap[groupName] || '#6b7280',
    }

    polygonFeatures.push(buffered)
  }

  const result = featureCollection(polygonFeatures)

  _cache = { key, result }

  console.log(
    `[Perf] generateRangePolygons: ${(performance.now() - t0).toFixed(1)}ms, ` +
    `${groups.size} groups → ${polygonFeatures.length} polygons`
  )

  return result
}

export function invalidateRangeCache() {
  _cache = { key: null, result: null }
}
