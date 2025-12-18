import { computed } from 'vue'

/**
 * Composable for gallery data computations, grouping, and color generation
 * @param {Object} store - The data store
 * @returns {Object} Computed data and helper functions
 */
export function useGalleryData(store) {
  // Get all filtered individuals (with or without images)
  const allFilteredIndividuals = computed(() => {
    const geo = store.filteredGeoJSON
    if (!geo || !geo.features) return []
    return geo.features.map(f => f.properties)
  })

  // Get specimens with images
  const specimensWithImages = computed(() => {
    const geo = store.filteredGeoJSON
    if (!geo || !geo.features) return []
    return geo.features
      .filter(f => f.properties?.image_url)
      .map(f => f.properties)
  })

  // Group points by species for sidebar navigation
  const groupedBySpecies = computed(() => {
    return store.groupPointsBySpecies(specimensWithImages.value)
  })

  // Get species list (those with images)
  const speciesList = computed(() => {
    return store.getSpeciesWithPhotos(specimensWithImages.value)
  })

  // Total counts for sidebar stats
  const totalSpecies = computed(() => Object.keys(groupedBySpecies.value).length)
  const totalIndividuals = computed(() => specimensWithImages.value.length)

  // Search summary stats (from all filtered data, not just with images)
  const allFilteredTotal = computed(() => allFilteredIndividuals.value.length)
  const allFilteredWithoutImages = computed(() => allFilteredTotal.value - totalIndividuals.value)

  // Count total unique subspecies from all filtered data
  const totalSubspeciesCount = computed(() => {
    const subspeciesSet = new Set()
    allFilteredIndividuals.value.forEach(ind => {
      if (ind.subspecies) {
        subspeciesSet.add(`${ind.scientific_name}|${ind.subspecies}`)
      }
    })
    return subspeciesSet.size
  })

  // Generate colors for species (main colors) and subspecies (shades)
  const speciesColors = computed(() => {
    const species = Object.keys(groupedBySpecies.value)
    const colors = {}
    const baseHues = [210, 150, 30, 280, 350, 180, 60, 320, 120, 240]

    species.forEach((sp, idx) => {
      const hue = baseHues[idx % baseHues.length]
      colors[sp] = {
        main: `hsl(${hue}, 70%, 50%)`,
        border: `hsl(${hue}, 70%, 40%)`,
        bg: `hsla(${hue}, 70%, 50%, 0.15)`,
        hue
      }
    })
    return colors
  })

  // Generate subspecies shades within species color
  const getSubspeciesColor = (species, subspeciesName) => {
    const speciesColor = speciesColors.value[species]
    if (!speciesColor) return { main: '#666', border: '#555', bg: 'rgba(100, 100, 100, 0.15)' }

    const subspeciesList = groupedBySpecies.value[species]?.subspecies || {}
    const subspeciesNames = Object.keys(subspeciesList)
    const idx = subspeciesNames.indexOf(subspeciesName)
    const total = subspeciesNames.length

    // Vary lightness based on subspecies index
    const lightness = 45 + (idx / Math.max(total - 1, 1)) * 20 // Range 45-65%

    return {
      main: `hsl(${speciesColor.hue}, 60%, ${lightness}%)`,
      border: `hsl(${speciesColor.hue}, 60%, ${lightness - 10}%)`,
      bg: `hsla(${speciesColor.hue}, 60%, ${lightness}%, 0.12)`
    }
  }

  // Grouped thumbnails for the strip (hierarchical structure)
  const groupedThumbnails = computed(() => {
    const result = []

    Object.entries(groupedBySpecies.value).forEach(([speciesName, speciesData]) => {
      const speciesGroup = {
        type: 'species',
        name: speciesName,
        color: speciesColors.value[speciesName],
        subspecies: [],
        totalImages: 0
      }

      Object.entries(speciesData.subspecies).forEach(([subspeciesName, subspeciesData]) => {
        const individualsWithImages = subspeciesData.individuals.filter(i => i.image_url)
        if (individualsWithImages.length === 0) return

        speciesGroup.totalImages += individualsWithImages.length

        speciesGroup.subspecies.push({
          type: 'subspecies',
          name: subspeciesName,
          color: getSubspeciesColor(speciesName, subspeciesName),
          individuals: individualsWithImages,
          parentSpecies: speciesName
        })
      })

      // Only include species that have images
      if (speciesGroup.totalImages > 0) {
        result.push(speciesGroup)
      }
    })

    return result
  })

  return {
    // Raw data
    allFilteredIndividuals,
    specimensWithImages,
    groupedBySpecies,
    speciesList,
    // Stats
    totalSpecies,
    totalIndividuals,
    allFilteredTotal,
    allFilteredWithoutImages,
    totalSubspeciesCount,
    // Colors
    speciesColors,
    getSubspeciesColor,
    // Thumbnails
    groupedThumbnails
  }
}
