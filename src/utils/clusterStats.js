/**
 * Cluster Statistics Utility
 * Computes aggregated statistics for clustered points including geographic radius
 */

// Country name to ISO 3166-1 alpha-2 code mapping
const COUNTRY_CODES = {
  'Argentina': 'AR',
  'Bolivia': 'BO',
  'Brazil': 'BR',
  'Chile': 'CL',
  'Colombia': 'CO',
  'Costa Rica': 'CR',
  'Ecuador': 'EC',
  'El Salvador': 'SV',
  'French Guiana': 'GF',
  'Guatemala': 'GT',
  'Guyana': 'GY',
  'Honduras': 'HN',
  'Mexico': 'MX',
  'Nicaragua': 'NI',
  'Panama': 'PA',
  'Paraguay': 'PY',
  'Peru': 'PE',
  'Suriname': 'SR',
  'Trinidad and Tobago': 'TT',
  'Uruguay': 'UY',
  'Venezuela': 'VE',
  'United States': 'US',
  'Belize': 'BZ',
  'Cuba': 'CU',
  'Dominican Republic': 'DO',
  'Haiti': 'HT',
  'Jamaica': 'JM',
  'Puerto Rico': 'PR',
  'Unknown': '??'
}

/**
 * Calculate haversine distance between two points in kilometers
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Get country code from country name
 */
export const getCountryCode = (countryName) => {
  if (!countryName) return null
  return COUNTRY_CODES[countryName] || countryName.substring(0, 2).toUpperCase()
}

/**
 * Format countries with codes and truncation
 * e.g., "2 (EC, CO)" or "4 (EC, CO, PE, +1)"
 */
export const formatCountries = (countries, maxDisplay = 3) => {
  if (!countries || countries.length === 0) return null

  const codes = countries.map(c => getCountryCode(c)).filter(Boolean)
  const count = codes.length

  if (count === 0) return null
  if (count === 1) return codes[0]

  if (count <= maxDisplay) {
    return `${count} (${codes.join(', ')})`
  }

  const displayed = codes.slice(0, maxDisplay - 1)
  const remaining = count - displayed.length
  return `${count} (${displayed.join(', ')}, +${remaining})`
}

/**
 * Compute cluster statistics from an array of points
 */
export const computeClusterStats = (points, centerLat, centerLng) => {
  const startTime = performance.now()

  if (!points || points.length === 0) {
    return null
  }

  console.log(`[Perf] computeClusterStats: Processing ${points.length} points`)

  // Unique locations (by coordinate pairs)
  const locationSet = new Set()
  const countrySet = new Set()
  let maxDistance = 0
  let farthestPoint = null

  // Species and subspecies counts
  const speciesMap = new Map() // species -> { count, subspecies: Map }

  // Sex counts
  let maleCount = 0
  let femaleCount = 0
  let unknownSexCount = 0

  for (const point of points) {
    // Get coordinates - handle both GeoJSON features and flat properties
    let lat, lng
    if (point.geometry?.coordinates) {
      [lng, lat] = point.geometry.coordinates
    } else if (point.lat !== undefined && point.lng !== undefined) {
      lat = point.lat
      lng = point.lng
    } else if (point.latitude !== undefined && point.longitude !== undefined) {
      lat = point.latitude
      lng = point.longitude
    }

    // Get properties
    const props = point.properties || point

    // Unique locations
    if (lat !== undefined && lng !== undefined) {
      locationSet.add(`${lat.toFixed(4)},${lng.toFixed(4)}`)

      // Calculate distance from cluster center
      const distance = haversineDistance(centerLat, centerLng, lat, lng)
      if (distance > maxDistance) {
        maxDistance = distance
        farthestPoint = { lat, lng }
      }
    }

    // Countries
    if (props.country && props.country !== 'Unknown') {
      countrySet.add(props.country)
    }

    // Species and subspecies
    const species = props.scientific_name || props.species
    const subspecies = props.subspecies || '(No subspecies)'

    if (species) {
      if (!speciesMap.has(species)) {
        speciesMap.set(species, { count: 0, subspecies: new Map() })
      }
      const speciesData = speciesMap.get(species)
      speciesData.count++

      if (!speciesData.subspecies.has(subspecies)) {
        speciesData.subspecies.set(subspecies, { count: 0, hasPhoto: false })
      }
      const subspData = speciesData.subspecies.get(subspecies)
      subspData.count++
      if (props.image_url) {
        subspData.hasPhoto = true
      }
    }

    // Sex counts
    const sex = props.sex?.toLowerCase()
    if (sex === 'male') maleCount++
    else if (sex === 'female') femaleCount++
    else unknownSexCount++
  }

  // Find most common species and its most common subspecies
  let mostCommonSpecies = null
  let mostCommonSubspecies = null
  let maxSpeciesCount = 0

  for (const [species, data] of speciesMap) {
    if (data.count > maxSpeciesCount) {
      maxSpeciesCount = data.count
      mostCommonSpecies = species

      // Find most common subspecies for this species
      let maxSubspCount = 0
      for (const [subsp, subspData] of data.subspecies) {
        if (subspData.count > maxSubspCount) {
          maxSubspCount = subspData.count
          mostCommonSubspecies = subsp
        }
      }
    }
  }

  // Sort countries alphabetically
  const countries = Array.from(countrySet).sort()

  const elapsed = performance.now() - startTime
  console.log(`[Perf] computeClusterStats: Completed in ${elapsed.toFixed(2)}ms - ${locationSet.size} locations, ${speciesMap.size} species`)

  return {
    // Location info
    locationCount: locationSet.size,
    countries,
    countriesFormatted: formatCountries(countries),
    centerLat,
    centerLng,

    // Geographic radius
    radiusKm: maxDistance,
    farthestPoint,

    // Counts
    speciesCount: speciesMap.size,
    individualCount: points.length,
    maleCount,
    femaleCount,
    unknownSexCount,

    // Most common for default image selection
    mostCommonSpecies,
    mostCommonSubspecies,

    // Raw data for further processing
    speciesMap
  }
}

/**
 * Convert radius in km to meters (for MapLibre circle-radius in meters)
 */
export const kmToMeters = (km) => km * 1000

/**
 * Calculate the radius in pixels for a given geographic radius at a specific zoom level and latitude
 * This is used to draw accurate geographic circles on the map
 */
export const geoRadiusToPixels = (radiusKm, zoom, latitude) => {
  // At zoom 0, the world is 256 pixels wide
  // Each zoom level doubles the size
  const worldPixelSize = 256 * Math.pow(2, zoom)

  // Earth's circumference at the equator is ~40075 km
  // At a given latitude, the circumference is multiplied by cos(latitude)
  const earthCircumferenceAtLat = 40075 * Math.cos(latitude * Math.PI / 180)

  // Pixels per km at this zoom and latitude
  const pixelsPerKm = worldPixelSize / earthCircumferenceAtLat

  return radiusKm * pixelsPerKm
}
