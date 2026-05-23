export function parseJsonProperty(value, fallback = null) {
  if (typeof value !== 'string') return value || fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function getHostPlantImage(occurrence = {}) {
  const media = parseJsonProperty(occurrence.media, [])
  const direct = Array.isArray(media) ? media.find(item => item?.url) : null
  const fallback = parseJsonProperty(occurrence.fallback_media, null)
  if (direct?.url) return { ...direct, fallback: false }
  if (fallback?.url) return { ...fallback, fallback: true }
  return null
}

export function gbifOccurrenceUrl(id) {
  return id ? `https://www.gbif.org/occurrence/${id}` : null
}

export function hostPlantRecordToFeature(record = {}) {
  const lat = Number(record.lat ?? record.decimalLatitude)
  const lng = Number(record.lng ?? record.decimalLongitude)
  const imageUrl = record.image_url || null
  const properties = {
    ...record,
    decimalLatitude: lat,
    decimalLongitude: lng,
  }
  if (imageUrl && !properties.media) {
    properties.media = [{ url: imageUrl }]
  }
  if (imageUrl && !properties.fallback_media && record.image_is_fallback) {
    properties.fallback_media = { url: imageUrl }
  }
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    properties,
  }
}

export function selectHostPlantGalleryFeatures(features = [], selectedSlugs = []) {
  const selected = new Set((selectedSlugs || []).filter(Boolean))
  if (selected.size > 0) {
    return features.filter(feature => selected.has(feature?.properties?.host_taxon_slug))
  }
  return features
}

export function dedupeHostPlantGalleryImages(items = []) {
  const seen = new Map()
  for (const item of items) {
    if (!item.image_url) continue
    const key = [
      item.host_taxon_slug || item.scientific_name,
      item.subspecies,
      item.image_url,
    ].join('|')
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, {
        ...item,
        duplicate_image_record_count: 1,
        duplicate_image_gbif_ids: item.gbifID ? [item.gbifID] : [],
      })
      continue
    }
    existing.duplicate_image_record_count += 1
    if (item.gbifID) existing.duplicate_image_gbif_ids.push(item.gbifID)
  }
  return Array.from(seen.values())
}

export function normalizeHostPlantGalleryItem(feature, taxon, associations = []) {
  const occurrence = feature?.properties || {}
  const coordinates = feature?.geometry?.coordinates || []
  const image = getHostPlantImage(occurrence)
  const hostName = taxon?.canonical_name || occurrence.host_taxon_name || occurrence.species || occurrence.scientificName
  const occurrenceGroup = occurrence.species
    || occurrence.scientificName
    || occurrence.taxonRank
    || occurrence.host_taxon_rank
    || 'GBIF occurrences'
  const butterflyTaxa = Array.isArray(associations)
    ? [...new Set(
      associations
        .filter(association => association.host_taxon_slug === occurrence.host_taxon_slug)
        .map(association => association.butterfly_taxon)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b))
    : associations.get(occurrence.host_taxon_slug) || []

  return {
    id: occurrence.gbifID || `${occurrence.host_taxon_slug}-${coordinates.join(',')}`,
    gbifID: occurrence.gbifID,
    image_url: image?.url || null,
    image_is_fallback: Boolean(image?.fallback),
    scientific_name: hostName,
    subspecies: occurrenceGroup,
    observation_date: occurrence.eventDate || null,
    source: occurrence.datasetName || occurrence.publisher || 'GBIF',
    sequencing_status: null,
    country: occurrence.country || null,
    collection_location: occurrence.locality || occurrence.stateProvince || null,
    lat: Number(coordinates[1]),
    lng: Number(coordinates[0]),
    observation_url: gbifOccurrenceUrl(occurrence.gbifID),
    host_taxon_slug: occurrence.host_taxon_slug,
    host_taxon_rank: taxon?.rank || occurrence.host_taxon_rank || null,
    host_family: taxon?.family || occurrence.family || null,
    associated_butterflies: butterflyTaxa,
    gallery_kind: 'host-plants',
  }
}

export function normalizeHostPlantCoreRecord(feature, taxon = {}) {
  const occurrence = feature?.properties || {}
  const coordinates = feature?.geometry?.coordinates || []
  const image = getHostPlantImage(occurrence)
  const gbifID = occurrence.gbifID
  const hostName = taxon?.canonical_name || occurrence.host_taxon_name || occurrence.species || occurrence.scientificName
  const occurrenceGroup = occurrence.species
    || occurrence.scientificName
    || occurrence.taxonRank
    || occurrence.host_taxon_rank
    || 'GBIF occurrences'

  return {
    id: gbifID || `${occurrence.host_taxon_slug}-${coordinates.join(',')}`,
    gbifID,
    host_taxon_slug: occurrence.host_taxon_slug,
    host_taxon_rank: taxon?.rank || occurrence.host_taxon_rank || null,
    host_taxon_name: taxon?.canonical_name || occurrence.host_taxon_name || null,
    host_family: taxon?.family || occurrence.family || null,
    scientific_name: hostName,
    scientificName: occurrence.scientificName || hostName,
    subspecies: occurrenceGroup,
    species: occurrence.species || null,
    genus: occurrence.genus || null,
    family: occurrence.family || taxon?.family || null,
    taxonRank: occurrence.taxonRank || null,
    taxonomicStatus: occurrence.taxonomicStatus || null,
    taxonKey: occurrence.taxonKey ?? null,
    acceptedTaxonKey: occurrence.acceptedTaxonKey ?? null,
    speciesKey: occurrence.speciesKey ?? null,
    resolved_taxon_key: occurrence.resolved_taxon_key ?? null,
    observation_date: occurrence.eventDate || null,
    eventDate: occurrence.eventDate || null,
    source: occurrence.datasetName || occurrence.publisher || 'GBIF',
    datasetName: occurrence.datasetName || null,
    publisher: occurrence.publisher || null,
    country: occurrence.country || null,
    collection_location: occurrence.locality || occurrence.stateProvince || null,
    locality: occurrence.locality || null,
    stateProvince: occurrence.stateProvince || null,
    lat: Number(coordinates[1]),
    lng: Number(coordinates[0]),
    coordinateUncertaintyInMeters: occurrence.coordinateUncertaintyInMeters || null,
    basisOfRecord: occurrence.basisOfRecord || null,
    license: occurrence.license || null,
    image_url: image?.url || null,
    image_is_fallback: Boolean(image?.fallback),
    observation_url: gbifOccurrenceUrl(gbifID),
    gallery_kind: 'host-plants',
  }
}
