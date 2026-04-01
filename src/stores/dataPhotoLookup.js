// Photo lookup management for species/subspecies image resolution
// Extracted from data.js for maintainability (~200 lines)

import { ref } from 'vue'
import { log } from '../utils/logger'

/**
 * Composable for photo lookup management
 * @param {import('vue').Ref} allFeatures - All loaded feature data
 * @param {import('vue').Ref} imageSupplement - Image supplement data
 */
export function usePhotoLookup(allFeatures, imageSupplement) {

  const photoLookup = ref({})
  const mimicryPhotoLookup = ref({})
  const gbifCitation = ref(null)

  /**
   * Rebuild both photo lookups from allFeatures + imageSupplement.
   * Used only on initial load; subsequent sources use addPhotosFromData().
   */
  const rebuildPhotoLookups = () => {
    buildPhotoLookup(allFeatures.value, imageSupplement.value)
    buildMimicryPhotoLookup(allFeatures.value, imageSupplement.value)
  }

  /**
   * Incrementally add photo entries from newly loaded data.
   */
  const addPhotosFromData = (data) => {
    const lookup = { ...photoLookup.value }
    let added = 0
    for (const item of data) {
      if (!item.image_url) continue
      const subspeciesKey = `${item.scientific_name || ''} ${item.subspecies || ''}`.toLowerCase().trim()
      const speciesKey = (item.scientific_name || '').toLowerCase().trim()
      if (subspeciesKey && !lookup[subspeciesKey]) {
        lookup[subspeciesKey] = { url: item.image_url, id: item.id, exact: false }
        added++
      }
      if (speciesKey && !lookup[speciesKey]) {
        lookup[speciesKey] = { url: item.image_url, id: item.id, exact: false }
        added++
      }
    }
    photoLookup.value = lookup

    const mLookup = { ...mimicryPhotoLookup.value }
    for (const item of data) {
      const ring = item.mimicry_ring
      if (!ring || ring === 'Unknown' || !item.image_url) continue
      if (!mLookup[ring]) {
        mLookup[ring] = { representatives: [], currentIndex: 0 }
      }
      const key = `${item.scientific_name}|${item.subspecies || ''}`
      const existing = mLookup[ring].representatives.some(r =>
        `${r.scientific_name}|${r.subspecies || ''}` === key
      )
      if (!existing) {
        mLookup[ring].representatives.push({
          scientific_name: item.scientific_name,
          subspecies: item.subspecies,
          image_url: item.image_url,
          source: item.source,
          id: item.id,
        })
      }
    }
    mimicryPhotoLookup.value = mLookup
    log.photo.info(`Incremental photo update: +${added} entries`)
  }

  /**
   * Build photo lookup table for finding photos by species/subspecies
   */
  const buildPhotoLookup = (...dataSources) => {
    const lookup = {}

    for (const data of dataSources) {
      for (const item of data) {
        if (!item.image_url) continue

        const subspeciesKey = `${item.scientific_name || ''} ${item.subspecies || ''}`.toLowerCase().trim()
        const speciesKey = (item.scientific_name || '').toLowerCase().trim()

        if (subspeciesKey && !lookup[subspeciesKey]) {
          lookup[subspeciesKey] = {
            url: item.image_url,
            id: item.id,
            exact: false
          }
        }
        if (speciesKey && !lookup[speciesKey]) {
          lookup[speciesKey] = {
            url: item.image_url,
            id: item.id,
            exact: false
          }
        }
      }
    }

    photoLookup.value = lookup
    log.photo.info(`Built photo lookup with ${Object.keys(lookup).length} entries`)
  }

  /**
   * Build mimicry ring photo lookup for the visual selector
   */
  const buildMimicryPhotoLookup = (...dataSources) => {
    const lookup = {}

    for (const data of dataSources) {
      for (const item of data) {
        const ring = item.mimicry_ring
        if (!ring || ring === 'Unknown' || !item.image_url) continue

        if (!lookup[ring]) {
          lookup[ring] = {
            representatives: [],
            currentIndex: 0
          }
        }

        lookup[ring].representatives.push({
          scientific_name: item.scientific_name,
          subspecies: item.subspecies,
          image_url: item.image_url,
          source: item.source,
          id: item.id
        })
      }
    }

    for (const ring of Object.keys(lookup)) {
      const reps = lookup[ring].representatives

      reps.sort((a, b) => {
        if (a.source === 'Sanger Institute' && b.source !== 'Sanger Institute') return -1
        if (a.source !== 'Sanger Institute' && b.source === 'Sanger Institute') return 1
        const nameA = `${a.scientific_name} ${a.subspecies || ''}`
        const nameB = `${b.scientific_name} ${b.subspecies || ''}`
        return nameA.localeCompare(nameB)
      })

      const seen = new Set()
      lookup[ring].representatives = reps.filter(rep => {
        const key = `${rep.scientific_name}|${rep.subspecies || ''}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    mimicryPhotoLookup.value = lookup
    log.photo.info(`Built mimicry photo lookup for ${Object.keys(lookup).length} rings`)
  }

  /**
   * Load GBIF citation data if available
   */
  const loadGbifCitation = async () => {
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/gbif_citation.json`)

      if (response.ok) {
        gbifCitation.value = await response.json()
        log.photo.info('✓ Loaded GBIF citation data')
      }
    } catch (e) {
      gbifCitation.value = null
    }
  }

  /**
   * Get photo for an item. Returns object with url and whether it's the same individual.
   */
  const getPhotoForItem = (item) => {
    if (item.image_url) {
      return { url: item.image_url, sameIndividual: true }
    }

    const subspeciesKey = `${item.scientific_name || ''} ${item.subspecies || ''}`.toLowerCase().trim()
    if (subspeciesKey && photoLookup.value[subspeciesKey]) {
      return {
        url: photoLookup.value[subspeciesKey].url,
        sameIndividual: false,
        fromId: photoLookup.value[subspeciesKey].id
      }
    }

    const speciesKey = (item.scientific_name || '').toLowerCase().trim()
    if (speciesKey && photoLookup.value[speciesKey]) {
      return {
        url: photoLookup.value[speciesKey].url,
        sameIndividual: false,
        fromId: photoLookup.value[speciesKey].id
      }
    }

    return null
  }

  return {
    photoLookup,
    mimicryPhotoLookup,
    gbifCitation,
    rebuildPhotoLookups,
    addPhotosFromData,
    loadGbifCitation,
    getPhotoForItem
  }
}
