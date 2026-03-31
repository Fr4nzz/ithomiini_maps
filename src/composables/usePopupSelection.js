import { ref, computed, watch } from 'vue'

const getSortedSubspecies = (speciesGroup) => {
  const subspeciesNames = Object.keys(speciesGroup.subspecies)
  return subspeciesNames
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
}

export function usePopupSelection(points, groupedBySpecies, speciesList, options = {}) {
  const selectedSpecies = ref(null)
  const selectedSubspecies = ref(null)
  const selectedIndividualIndex = ref(0)

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

  const individualsList = computed(() => {
    if (!selectedSpecies.value || !groupedBySpecies.value[selectedSpecies.value]) {
      return points.value
    }
    const speciesGroup = groupedBySpecies.value[selectedSpecies.value]

    if (selectedSubspecies.value && speciesGroup.subspecies[selectedSubspecies.value]) {
      return speciesGroup.subspecies[selectedSubspecies.value].individuals
    }

    return Object.values(speciesGroup.subspecies)
      .flatMap(s => s.individuals)
  })

  const currentIndividual = computed(() => {
    const list = individualsList.value
    if (list.length === 0) return null
    const idx = Math.min(selectedIndividualIndex.value, list.length - 1)
    return list[idx]
  })

  const selectSpecies = (species) => {
    selectedSpecies.value = species

    if (species && groupedBySpecies.value[species]) {
      const speciesGroup = groupedBySpecies.value[species]
      const sortedSubspecies = getSortedSubspecies(speciesGroup)

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

  const selectSubspecies = (subspecies) => {
    selectedSubspecies.value = subspecies
    selectedIndividualIndex.value = 0
  }

  const initializeSelection = () => {
    if (points.value.length === 0) return

    if (options.initialSpecies?.value && groupedBySpecies.value[options.initialSpecies.value]) {
      selectedSpecies.value = options.initialSpecies.value
      const speciesGroup = groupedBySpecies.value[options.initialSpecies.value]

      if (options.initialSubspecies?.value && speciesGroup.subspecies[options.initialSubspecies.value]) {
        selectedSubspecies.value = options.initialSubspecies.value
      } else {
        const subspeciesNames = Object.keys(speciesGroup.subspecies)
        if (subspeciesNames.length > 0) {
          selectedSubspecies.value = subspeciesNames[0]
        }
      }
      selectedIndividualIndex.value = 0
      return
    }

    const speciesWithCounts = speciesList.value
    if (speciesWithCounts.length > 0) {
      const topSpecies = speciesWithCounts[0].species
      selectedSpecies.value = topSpecies

      if (groupedBySpecies.value[topSpecies]) {
        const speciesGroup = groupedBySpecies.value[topSpecies]
        const sortedSubspecies = getSortedSubspecies(speciesGroup)

        if (sortedSubspecies.length > 0) {
          selectedSubspecies.value = sortedSubspecies[0].name

          const individuals = speciesGroup.subspecies[sortedSubspecies[0].name].individuals
          const photoIdx = individuals.findIndex(ind => ind.image_url)
          selectedIndividualIndex.value = photoIdx >= 0 ? photoIdx : 0
        }
      }
      return
    }

    const pointsWithPhoto = points.value.filter(p => p.image_url)
    const firstPoint = pointsWithPhoto.length > 0 ? pointsWithPhoto[0] : points.value[0]

    const species = firstPoint.scientific_name
    if (species && groupedBySpecies.value[species]) {
      selectedSpecies.value = species

      const subspecies = firstPoint.subspecies
      const speciesGroup = groupedBySpecies.value[species]
      if (subspecies && speciesGroup.subspecies[subspecies]) {
        selectedSubspecies.value = subspecies

        const individuals = speciesGroup.subspecies[subspecies].individuals
        const idx = individuals.findIndex(ind => ind.id === firstPoint.id)
        selectedIndividualIndex.value = idx >= 0 ? idx : 0
      } else {
        const subspeciesNames = Object.keys(speciesGroup.subspecies)
        if (subspeciesNames.length > 0) {
          selectedSubspecies.value = subspeciesNames[0]
        }
        selectedIndividualIndex.value = 0
      }
    }
  }

  watch(points, () => {
    initializeSelection()
  }, { deep: true })

  initializeSelection()

  const locationName = computed(() => {
    const point = currentIndividual.value || points.value[0]
    return point?.collection_location || point?.locality || point?.location || null
  })

  return {
    selectedSpecies,
    selectedSubspecies,
    selectedIndividualIndex,
    subspeciesList,
    individualsList,
    selectSpecies,
    selectSubspecies,
    locationName
  }
}
