import { ref, computed } from 'vue'

/**
 * GoaT (Genomes on a Tree) data composable.
 * Loads species-keyed genomic data eagerly on app start.
 * Provides lookup functions and filter helpers for the data store.
 */
export function useGoatData() {
  const goatSpecies = ref({})
  const goatLoaded = ref(false)
  const goatLoading = ref(false)
  const goatMeta = ref(null)

  const loadGoatData = async () => {
    if (goatLoaded.value || goatLoading.value) return
    goatLoading.value = true

    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/goat_lepidoptera.json`)
      if (!response.ok) {
        console.warn(`GoaT data not available (${response.status}) — filters will be disabled`)
        return
      }

      const data = await response.json()
      goatSpecies.value = data.species || {}
      goatMeta.value = {
        fetchedAt: data.fetchedAt,
        source: data.source,
        citation: data.citation,
        totalSpecies: data.totalSpecies,
        speciesWithDirectData: data.speciesWithDirectData,
      }
      goatLoaded.value = true
      console.log(`✓ GoaT data loaded: ${Object.keys(goatSpecies.value).length} species`)
    } catch (e) {
      console.warn('GoaT data not available:', e.message)
    } finally {
      goatLoading.value = false
    }
  }

  const getGoatForSpecies = (scientificName) => {
    if (!scientificName || !goatLoaded.value) return null
    return goatSpecies.value[scientificName] || null
  }

  const hasGoatData = (scientificName) => {
    return !!goatSpecies.value[scientificName]
  }

  const hasDirectGoatData = (scientificName) => {
    const data = goatSpecies.value[scientificName]
    if (!data) return false
    for (const key of Object.keys(data)) {
      if (key === 'taxon_id') continue
      if (data[key]?.source === 'direct') return true
    }
    return false
  }

  const getChromosomeNumber = (scientificName) => {
    const data = goatSpecies.value[scientificName]
    if (!data?.chromosome_number) return null
    return data.chromosome_number
  }

  const formatGenomeSize = (valueBp) => {
    if (valueBp == null) return null
    const mbp = valueBp / 1_000_000
    if (mbp >= 1000) return `${(mbp / 1000).toFixed(1)} Gbp`
    if (mbp >= 1) return `${mbp.toFixed(0)} Mbp`
    return `${(valueBp / 1000).toFixed(0)} Kbp`
  }

  const chromosomeRange = computed(() => {
    if (!goatLoaded.value) return { min: 0, max: 100 }
    let min = Infinity
    let max = -Infinity
    for (const sp of Object.values(goatSpecies.value)) {
      const cn = sp.chromosome_number?.value
      if (cn != null && typeof cn === 'number') {
        if (cn < min) min = cn
        if (cn > max) max = cn
      }
    }
    if (min === Infinity) return { min: 0, max: 100 }
    return { min, max }
  })

  return {
    goatSpecies,
    goatLoaded,
    goatLoading,
    goatMeta,
    loadGoatData,
    getGoatForSpecies,
    hasGoatData,
    hasDirectGoatData,
    getChromosomeNumber,
    formatGenomeSize,
    chromosomeRange,
  }
}
