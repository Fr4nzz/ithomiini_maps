import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

export const useHostPlantStore = defineStore('hostPlants', () => {
  const manifest = ref(null)
  const taxa = ref([])
  const associations = ref([])
  const loading = ref(false)
  const enabled = ref(false)
  const selectedTaxonSlugs = ref([])
  const opacity = ref(0.85)
  const occurrenceCollections = shallowRef({})
  const occurrenceLoading = ref({})
  const occurrenceErrors = ref({})

  const confidenceLevels = [
    {
      key: 'high',
      label: 'High',
      description: 'Species-level direct, rearing, oviposition, authoritative, or trusted expert evidence.',
    },
    {
      key: 'medium',
      label: 'Medium',
      description: 'Genus-level or catalogue/literature evidence that is useful but not exact species-level high confidence.',
    },
    {
      key: 'low',
      label: 'Low',
      description: 'Dubious, broad, imprecise, or weak records kept for audit and exploration.',
    },
  ]

  const taxaBySlug = computed(() => {
    const map = new Map()
    for (const taxon of taxa.value) map.set(taxon.slug, taxon)
    return map
  })

  const activeTaxa = computed(() =>
    selectedTaxonSlugs.value
      .map(slug => taxaBySlug.value.get(slug))
      .filter(Boolean)
  )

  const caveat = computed(() =>
    manifest.value?.metadata?.scientific_caveat
    || 'GBIF plant occurrences are context records and do not prove local host use.'
  )

  async function fetchJson(path) {
    const basePath = import.meta.env.BASE_URL || '/'
    const response = await fetch(`${basePath}data/host_plants/${path}`)
    if (!response.ok) throw new Error(`Unable to load host plant data: ${path}`)
    return response.json()
  }

  async function loadMetadata() {
    if (manifest.value && associations.value.length > 0) return
    loading.value = true
    try {
      const [manifestJson, associationsJson] = await Promise.all([
        fetchJson('host_plant_layers_manifest.json'),
        fetchJson('host_plant_associations.json'),
      ])
      manifest.value = manifestJson
      taxa.value = manifestJson.taxa || []
      associations.value = associationsJson.associations || []
    } catch (error) {
      manifest.value = null
      taxa.value = []
      associations.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  function confidenceBucket(confidence) {
    if (confidence === 'high' || confidence === 'medium') return confidence
    if (confidence === 'low' || confidence === 'needs_check') return 'low'
    return 'unknown'
  }

  function confidencePasses(confidence, minimum = 'low') {
    const order = { high: 3, medium: 2, low: 1, unknown: 0 }
    return order[confidenceBucket(confidence)] >= order[minimum]
  }

  function normalizeConfidenceSelection(selection = 'low') {
    if (Array.isArray(selection)) {
      const selected = selection.map(confidenceBucket).filter(bucket => bucket !== 'unknown')
      return new Set(selected.length > 0 ? selected : ['high'])
    }
    if (selection === 'high') return new Set(['high'])
    if (selection === 'medium') return new Set(['high', 'medium'])
    return new Set(['high', 'medium', 'low'])
  }

  function confidenceIncluded(confidence, selection = 'low') {
    return normalizeConfidenceSelection(selection).has(confidenceBucket(confidence))
  }

  function confidenceLabel(confidence) {
    if (confidence === 'needs_check') return 'needs check'
    return confidence || 'unknown'
  }

  function confidenceCountsForAssociations(sourceAssociations) {
    const countsBySlug = new Map()
    for (const association of sourceAssociations) {
      const taxon = taxaBySlug.value.get(association.host_taxon_slug)
      if (!taxon || taxon.occurrence_count <= 0 || !['species', 'genus'].includes(taxon.rank)) continue
      const existing = countsBySlug.get(taxon.slug) || 'low'
      const bucket = confidenceBucket(association.confidence)
      const rank = { high: 3, medium: 2, low: 1, unknown: 0 }
      countsBySlug.set(taxon.slug, rank[bucket] > rank[existing] ? bucket : existing)
    }
    const counts = { high: 0, medium: 0, low: 0 }
    for (const bucket of countsBySlug.values()) {
      if (bucket === 'high') counts.high += 1
      else if (bucket === 'medium') counts.medium += 1
      else counts.low += 1
    }
    return counts
  }

  function getButterflyOptionsForHostPlants(search = '') {
    const query = (search || '').trim().toLowerCase()
    const byButterfly = new Map()
    for (const association of associations.value) {
      const name = association.butterfly_taxon
      if (!name) continue
      if (query && !name.toLowerCase().includes(query)) continue
      const list = byButterfly.get(name) || []
      list.push(association)
      byButterfly.set(name, list)
    }
    return Array.from(byButterfly.entries())
      .map(([name, butterflyAssociations]) => {
        const counts = confidenceCountsForAssociations(butterflyAssociations)
        const total = counts.high + counts.medium + counts.low
        return {
          label: name,
          value: name,
          meta: `${counts.high} high · ${counts.medium} medium · ${counts.low} low`,
          badges: [
            { key: 'high', label: `${counts.high} high` },
            { key: 'medium', label: `${counts.medium} medium` },
            { key: 'low', label: `${counts.low} low` },
          ],
          counts,
          total,
          searchText: name.toLowerCase(),
        }
      })
      .filter(option => option.total > 0)
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  function getTaxaForButterflies(butterflyTaxa, confidenceSelection = 'low') {
    const selected = new Set((butterflyTaxa || []).filter(Boolean))
    if (selected.size === 0) return []
    const bySlug = new Map()
    for (const association of associations.value) {
      if (!selected.has(association.butterfly_taxon)) continue
      if (!confidenceIncluded(association.confidence, confidenceSelection)) continue
      const taxon = taxaBySlug.value.get(association.host_taxon_slug)
      if (!taxon) continue
      if (taxon.occurrence_count <= 0 || !['species', 'genus'].includes(taxon.rank)) continue
      const entry = bySlug.get(taxon.slug) || { ...taxon, associations: [] }
      entry.associations.push(association)
      bySlug.set(taxon.slug, entry)
    }
    return Array.from(bySlug.values()).sort((a, b) =>
      a.canonical_name.localeCompare(b.canonical_name)
    )
  }

  function getOccurrenceTaxonOptionsForButterflies(butterflyTaxa, confidenceSelection = 'low') {
    const selected = (butterflyTaxa || []).filter(Boolean)
    const sourceTaxa = selected.length > 0
      ? getTaxaForButterflies(selected, confidenceSelection)
      : taxa.value.map(taxon => ({
        ...taxon,
        associations: associations.value.filter(a =>
          a.host_taxon_slug === taxon.slug && confidenceIncluded(a.confidence, confidenceSelection)
        ),
      })).filter(taxon => taxon.associations.length > 0)

    return sourceTaxa
      .filter(taxon => taxon.occurrence_count > 0 && ['species', 'genus'].includes(taxon.rank))
      .map(taxon => {
        const taxonAssociations = (taxon.associations || associations.value.filter(a => a.host_taxon_slug === taxon.slug))
          .filter(a => selected.length === 0 || confidenceIncluded(a.confidence, confidenceSelection))
        const confidence = selected.length > 0
          ? [...new Set(taxonAssociations.map(a => confidenceLabel(a.confidence)).filter(Boolean))].join(', ')
          : null
        const butterflyTaxa = [...new Set(taxonAssociations.map(a => a.butterfly_taxon).filter(Boolean))]
        const parts = [
          taxon.rank,
          taxon.family,
          confidence,
          `${taxon.occurrence_count} records`,
        ].filter(Boolean)
        return {
          label: taxon.canonical_name,
          value: taxon.slug,
          meta: parts.join(' · '),
          associatedButterflies: butterflyTaxa,
          searchText: [
            taxon.canonical_name,
            taxon.rank,
            taxon.family,
            taxon.genus,
            taxon.species,
            ...butterflyTaxa,
          ].filter(Boolean).join(' ').toLowerCase(),
        }
      })
  }

  function filterOccurrenceTaxonOptions(options, search) {
    const query = (search || '').trim().toLowerCase()
    if (!query) return options
    return options
      .filter(option => {
        const haystack = option.searchText || [option.label, option.meta].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(query)
      })
      .map(option => {
        const matchedButterflies = (option.associatedButterflies || [])
          .filter(name => name.toLowerCase().includes(query))
        if (matchedButterflies.length === 0) return option
        return {
          ...option,
          matchMeta: `Butterfly: ${matchedButterflies.slice(0, 3).join(', ')}${matchedButterflies.length > 3 ? ` +${matchedButterflies.length - 3} more` : ''}`,
        }
      })
  }

  function toggleEnabled() {
    enabled.value = !enabled.value
    if (enabled.value) loadMetadata().catch(() => {})
  }

  function setSelectedTaxa(slugs) {
    selectedTaxonSlugs.value = Array.from(new Set(slugs || []))
  }

  function toggleTaxon(slug) {
    if (selectedTaxonSlugs.value.includes(slug)) {
      selectedTaxonSlugs.value = selectedTaxonSlugs.value.filter(item => item !== slug)
    } else {
      selectedTaxonSlugs.value = [...selectedTaxonSlugs.value, slug]
    }
  }

  async function loadOccurrences(slug) {
    if (occurrenceCollections.value[slug]) return occurrenceCollections.value[slug]
    const taxon = taxaBySlug.value.get(slug)
    if (!taxon?.occurrence_file) return null
    occurrenceLoading.value = { ...occurrenceLoading.value, [slug]: true }
    occurrenceErrors.value = { ...occurrenceErrors.value, [slug]: null }
    try {
      const collection = await fetchJson(taxon.occurrence_file)
      occurrenceCollections.value = {
        ...occurrenceCollections.value,
        [slug]: collection,
      }
      return collection
    } catch (error) {
      occurrenceErrors.value = {
        ...occurrenceErrors.value,
        [slug]: error instanceof Error ? error.message : String(error),
      }
      return null
    } finally {
      occurrenceLoading.value = { ...occurrenceLoading.value, [slug]: false }
    }
  }

  return {
    manifest,
    taxa,
    associations,
    loading,
    enabled,
    selectedTaxonSlugs,
    opacity,
    occurrenceCollections,
    occurrenceLoading,
    occurrenceErrors,
    confidenceLevels,
    taxaBySlug,
    activeTaxa,
    caveat,
    loadMetadata,
    confidenceBucket,
    confidencePasses,
    confidenceCountsForAssociations,
    getButterflyOptionsForHostPlants,
    getTaxaForButterflies,
    getOccurrenceTaxonOptionsForButterflies,
    filterOccurrenceTaxonOptions,
    toggleEnabled,
    setSelectedTaxa,
    toggleTaxon,
    loadOccurrences,
  }
})
