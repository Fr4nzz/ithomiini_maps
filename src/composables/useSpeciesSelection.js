/**
 * Composable for species/subspecies/individual selection logic
 * Used by ImageGallery and PointPopup components
 */

import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/data'

/**
 * @param {Ref<Array>} pointsRef - Reactive reference to array of points
 * @param {Object} options - Configuration options
 * @returns {Object} Selection state and methods
 */
export function useSpeciesSelection(pointsRef, options = {}) {
  const store = useDataStore()

  const selectedSpecies = ref(null)
  const selectedSubspecies = ref(null)
  const selectedIndividualIndex = ref(0)

  // Group points by species
  const groupedBySpecies = computed(() => {
    return store.groupPointsBySpecies(pointsRef.value)
  })

  // Get sorted species list (by count, with photos first)
  const speciesList = computed(() => {
    return store.getSpeciesWithPhotos(pointsRef.value)
  })

  // Get subspecies list for selected species
  const subspeciesList = computed(() => {
    if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
      return []
    }
    const speciesGroup = groupedBySpecies.value[selectedSpecies.value]
    return Object.entries(speciesGroup.subspecies)
      .map(([name, data]) => ({
        name,
        count: data.count,
        hasPhoto: data.individuals.some(i => i.image_url)
      }))
      .sort((a, b) => {
        if (a.hasPhoto && !b.hasPhoto) return -1
        if (!a.hasPhoto && b.hasPhoto) return 1
        return b.count - a.count
      })
  })

  // Get individuals list for selected species+subspecies
  const individualsList = computed(() => {
    if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
      return pointsRef.value
    }
    const speciesGroup = groupedBySpecies.value[selectedSpecies.value]

    if (selectedSubspecies.value && speciesGroup.subspecies[selectedSubspecies.value]) {
      return speciesGroup.subspecies[selectedSubspecies.value].individuals
    }

    // Return all individuals for this species
    return Object.values(speciesGroup.subspecies)
      .flatMap(s => s.individuals)
  })

  // Current individual based on selection
  const currentIndividual = computed(() => {
    const list = individualsList.value
    if (list.length === 0) return null
    const idx = Math.min(selectedIndividualIndex.value, list.length - 1)
    return list[idx]
  })

  // Get photo for current individual (with fallback)
  const currentPhoto = computed(() => {
    if (!currentIndividual.value) return null
    return store.getPhotoForItem(currentIndividual.value)
  })

  // Handle species selection - update subspecies and individual to first available
  const selectSpecies = (species) => {
    selectedSpecies.value = species

    if (species && groupedBySpecies.value[species]) {
      // Get first subspecies for this species
      const speciesGroup = groupedBySpecies.value[species]
      const subspeciesNames = Object.keys(speciesGroup.subspecies)

      // Sort subspecies by those with photos first, then by count
      const sortedSubspecies = subspeciesNames
        .map(name => ({
          name,
          data: speciesGroup.subspecies[name],
          hasPhoto: speciesGroup.subspecies[name].individuals.some(i => i.image_url)
        }))
        .sort((a, b) => {
          if (a.hasPhoto && !b.hasPhoto) return -1
          if (!a.hasPhoto && b.hasPhoto) return 1
          return b.data.count - a.data.count
        })

      if (sortedSubspecies.length > 0) {
        selectedSubspecies.value = sortedSubspecies[0].name
      } else {
        selectedSubspecies.value = null
      }
    } else {
      selectedSubspecies.value = null
    }

    selectedIndividualIndex.value = 0
  }

  // Handle subspecies selection - update individual to first available
  const selectSubspecies = (subspecies) => {
    selectedSubspecies.value = subspecies
    selectedIndividualIndex.value = 0
  }

  // Handle individual selection
  const selectIndividual = (index) => {
    selectedIndividualIndex.value = index
  }

  // Select individual by ID
  const selectIndividualById = (id) => {
    const idx = individualsList.value.findIndex(ind => ind.id === id)
    if (idx >= 0) {
      selectedIndividualIndex.value = idx
    }
  }

  // Initialize selection from a specific point
  const initializeFromPoint = (point) => {
    if (!point) return

    const species = point.scientific_name
    if (species && groupedBySpecies.value[species]) {
      selectedSpecies.value = species

      const subspecies = point.subspecies
      const speciesGroup = groupedBySpecies.value[species]
      if (subspecies && speciesGroup.subspecies[subspecies]) {
        selectedSubspecies.value = subspecies

        // Find index of this individual within the subspecies list
        const individuals = speciesGroup.subspecies[subspecies].individuals
        const idx = individuals.findIndex(ind => ind.id === point.id)
        selectedIndividualIndex.value = idx >= 0 ? idx : 0
      } else {
        // Set first subspecies
        const subspeciesNames = Object.keys(speciesGroup.subspecies)
        if (subspeciesNames.length > 0) {
          selectedSubspecies.value = subspeciesNames[0]
        }
        selectedIndividualIndex.value = 0
      }
    }
  }

  // Initialize with first individual with photo, or just first individual
  const initializeWithPhoto = () => {
    const pointsWithPhoto = pointsRef.value.filter(p => p.image_url)
    const firstPoint = pointsWithPhoto.length > 0 ? pointsWithPhoto[0] : pointsRef.value[0]
    if (firstPoint) {
      initializeFromPoint(firstPoint)
    }
  }

  // Counts
  const totalSpecies = computed(() => Object.keys(groupedBySpecies.value).length)
  const subspeciesCount = computed(() => subspeciesList.value.length)
  const individualsCount = computed(() => individualsList.value.length)

  return {
    // State
    selectedSpecies,
    selectedSubspecies,
    selectedIndividualIndex,

    // Computed
    groupedBySpecies,
    speciesList,
    subspeciesList,
    individualsList,
    currentIndividual,
    currentPhoto,
    totalSpecies,
    subspeciesCount,
    individualsCount,

    // Methods
    selectSpecies,
    selectSubspecies,
    selectIndividual,
    selectIndividualById,
    initializeFromPoint,
    initializeWithPhoto,
  }
}
