import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { hostPlantRecordToFeature } from '../utils/hostPlantGallery'

export const useHostPlantStore = defineStore('hostPlants', () => {
  const manifest = ref(null)
  const taxa = ref([])
  const associations = ref([])
  const loading = ref(false)
  const enabled = ref(false)
  const selectedTaxonSlugs = ref([])
  const opacity = ref(0.85)
  const occurrenceDataset = shallowRef(null)
  const occurrenceLoading = ref(false)
  const occurrenceError = ref(null)
  const loadedOccurrenceShards = ref([])
  const occurrenceShardCache = shallowRef({})
  const galleryDataset = shallowRef(null)
  const galleryLoading = ref(false)
  const galleryError = ref(null)

  const hostIdLevels = [
    { key: 'species', label: 'Species', description: 'Exact host plant species reported.' },
    { key: 'genus', label: 'Genus', description: 'Host reported only to genus; useful clue, not exact plant.' },
    { key: 'family', label: 'Family', description: 'Broad host family only; mainly context/table use.' },
  ]

  const evidenceLevels = [
    { key: 'direct', label: 'Observed', description: 'Observed host use: eggs, larvae, feeding, oviposition, or rearing.' },
    { key: 'literature', label: 'Reported', description: 'Host use reported by a catalogue, paper, expert source, or captive/lab record without checked direct-use details.' },
    { key: 'needs_check', label: 'Needs check', description: 'Unresolved or audit-level records.' },
  ]

  const confidenceLevels = [
    { key: 'high', label: 'Confirmed', description: 'Direct or checked host-use evidence.' },
    { key: 'medium', label: 'Provisional', description: 'Credible catalogue, literature, or expert record; source trail not fully checked.' },
    { key: 'low', label: 'Tentative', description: 'Weak, broad, uncertain, captive-only, or audit-level records.' },
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

  function confidenceDisplayLabel(confidence) {
    const bucket = confidenceBucket(confidence)
    return confidenceLevels.find(level => level.key === bucket)?.label || confidenceLabel(confidence)
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


  function hostIdLevelForAssociation(association) {
    return ['species', 'genus', 'family'].includes(association?.host_id_level)
      ? association.host_id_level
      : (['species', 'genus', 'family'].includes(association?.host_taxon_rank) ? association.host_taxon_rank : 'family')
  }

  function evidenceLevelForAssociation(association) {
    if (['direct', 'literature', 'needs_check'].includes(association?.evidence_level)) return association.evidence_level
    const bucket = confidenceBucket(association?.confidence)
    if (bucket === 'high') return 'direct'
    if (bucket === 'medium') return 'literature'
    return 'needs_check'
  }

  function normalizeHostIdLevelSelection(selection = ['species']) {
    const raw = selection instanceof Set ? Array.from(selection) : (Array.isArray(selection) ? selection : [selection])
    const values = raw.filter(level => ['species', 'genus', 'family'].includes(level))
    return new Set(values.length ? values : ['species'])
  }

  function normalizeEvidenceSelection(selection = ['direct', 'literature']) {
    const raw = selection instanceof Set ? Array.from(selection) : (Array.isArray(selection) ? selection : [selection])
    const values = raw.filter(level => ['direct', 'literature', 'needs_check'].includes(level))
    return new Set(values.length ? values : ['direct', 'literature'])
  }

  function normalizeHostFilterOptions(optionsOrConfidence = {}) {
    if (Array.isArray(optionsOrConfidence) || typeof optionsOrConfidence === 'string') {
      const confidenceSelection = normalizeConfidenceSelection(optionsOrConfidence)
      const evidence = []
      if (confidenceSelection.has('high')) evidence.push('direct')
      if (confidenceSelection.has('medium')) evidence.push('literature')
      if (confidenceSelection.has('low')) evidence.push('needs_check')
      return {
        hostIdLevels: normalizeHostIdLevelSelection(['species', 'genus']),
        evidenceLevels: normalizeEvidenceSelection(evidence),
        includeNonOccurrenceBacked: false,
      }
    }
    return {
      hostIdLevels: normalizeHostIdLevelSelection(optionsOrConfidence.hostIdLevels),
      evidenceLevels: normalizeEvidenceSelection(optionsOrConfidence.evidenceLevels),
      includeNonOccurrenceBacked: Boolean(optionsOrConfidence.includeNonOccurrenceBacked),
    }
  }

  function associationMatchesHostFilters(association, hostIdSelection, evidenceSelection) {
    return normalizeHostIdLevelSelection(hostIdSelection).has(hostIdLevelForAssociation(association))
      && normalizeEvidenceSelection(evidenceSelection).has(evidenceLevelForAssociation(association))
  }

  function hostFilterCountsForAssociations(sourceAssociations) {
    const hostIdCounts = { species: 0, genus: 0, family: 0 }
    const evidenceCounts = { direct: 0, literature: 0, needs_check: 0 }
    for (const association of sourceAssociations) {
      hostIdCounts[hostIdLevelForAssociation(association)] += 1
      evidenceCounts[evidenceLevelForAssociation(association)] += 1
    }
    return { hostIdCounts, evidenceCounts }
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
        const { hostIdCounts, evidenceCounts } = hostFilterCountsForAssociations(butterflyAssociations)
        const total = butterflyAssociations.length
        return {
          label: name,
          value: name,
          meta: `${hostIdCounts.species} species · ${hostIdCounts.genus} genus · ${hostIdCounts.family} family · ${evidenceCounts.direct} observed · ${evidenceCounts.literature} reported · ${evidenceCounts.needs_check} needs check`,
          badges: [
            { key: 'species', label: `${hostIdCounts.species} species` },
            { key: 'genus', label: `${hostIdCounts.genus} genus` },
            { key: 'family', label: `${hostIdCounts.family} family` },
          ],
          counts: { ...hostIdCounts, ...evidenceCounts },
          hostIdCounts,
          evidenceCounts,
          total,
          searchText: name.toLowerCase(),
        }
      })
      .filter(option => option.total > 0)
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  function getTaxaForButterflies(butterflyTaxa, optionsOrConfidence = {}) {
    const selected = new Set((butterflyTaxa || []).filter(Boolean))
    if (selected.size === 0) return []
    const options = normalizeHostFilterOptions(optionsOrConfidence)
    const bySlug = new Map()
    for (const association of associations.value) {
      if (!selected.has(association.butterfly_taxon)) continue
      if (!associationMatchesHostFilters(association, options.hostIdLevels, options.evidenceLevels)) continue
      const taxon = taxaBySlug.value.get(association.host_taxon_slug)
      if (!taxon) continue
      if (!options.includeNonOccurrenceBacked && taxon.occurrence_count <= 0) continue
      if (!options.hostIdLevels.has(hostIdLevelForAssociation(association))) continue
      const entry = bySlug.get(taxon.slug) || { ...taxon, associations: [] }
      entry.associations.push(association)
      bySlug.set(taxon.slug, entry)
    }
    return Array.from(bySlug.values()).sort((a, b) =>
      a.canonical_name.localeCompare(b.canonical_name)
    )
  }

  function getSpeciesLevelTaxaForButterflies(butterflyTaxa) {
    const selected = new Set((butterflyTaxa || []).filter(Boolean))
    if (selected.size === 0) return []
    const bySlug = new Map()
    for (const association of associations.value) {
      if (!selected.has(association.butterfly_taxon)) continue
      const taxon = taxaBySlug.value.get(association.host_taxon_slug)
      if (!taxon) continue
      if (taxon.occurrence_count <= 0 || taxon.rank !== 'species') continue
      const entry = bySlug.get(taxon.slug) || { ...taxon, associations: [] }
      entry.associations.push(association)
      bySlug.set(taxon.slug, entry)
    }
    return Array.from(bySlug.values()).sort((a, b) =>
      a.canonical_name.localeCompare(b.canonical_name)
    )
  }

  function getOccurrenceTaxonOptionsForButterflies(butterflyTaxa, optionsOrConfidence = {}) {
    const selected = (butterflyTaxa || []).filter(Boolean)
    const options = normalizeHostFilterOptions(optionsOrConfidence)
    const sourceTaxa = selected.length > 0
      ? getTaxaForButterflies(selected, options)
      : taxa.value.map(taxon => ({
        ...taxon,
        associations: associations.value.filter(a =>
          a.host_taxon_slug === taxon.slug && associationMatchesHostFilters(a, options.hostIdLevels, options.evidenceLevels)
        ),
      })).filter(taxon => taxon.associations.length > 0)

    return sourceTaxa
      .filter(taxon => taxon.occurrence_count > 0 && ['species', 'genus'].includes(taxon.rank))
      .map(taxon => {
        const taxonAssociations = (taxon.associations || associations.value.filter(a => a.host_taxon_slug === taxon.slug))
          .filter(a => selected.length === 0 || associationMatchesHostFilters(a, options.hostIdLevels, options.evidenceLevels))
        const evidence = selected.length > 0
          ? [...new Set(taxonAssociations.map(a => evidenceLevels.find(level => level.key === evidenceLevelForAssociation(a))?.label).filter(Boolean))].join(', ')
          : null
        const butterflyTaxa = [...new Set(taxonAssociations.map(a => a.butterfly_taxon).filter(Boolean))]
        const parts = [
          taxon.rank,
          taxon.family,
          evidence,
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

  function occurrenceShardNameForFamily(family) {
    const shards = manifest.value?.metadata?.occurrence_core_shards || {}
    return shards[family] || null
  }

  function occurrenceShardNamesForSlugs(slugs = selectedTaxonSlugs.value) {
    const selected = new Set((slugs || []).filter(Boolean))
    const byTaxon = manifest.value?.metadata?.occurrence_core_shards_by_taxon || {}
    const names = new Set()
    if (Object.keys(byTaxon).length > 0) {
      const sourceSlugs = selected.size > 0 ? [...selected] : Object.keys(byTaxon)
      for (const slug of sourceSlugs) {
        const shard = byTaxon[slug]
        if (Array.isArray(shard)) shard.forEach(name => names.add(name))
        else if (shard) names.add(shard)
      }
      return [...names]
    }

    const shards = manifest.value?.metadata?.occurrence_core_shards || {}
    if (Object.keys(shards).length === 0) {
      const datasetPath = manifest.value?.metadata?.occurrence_core_dataset
        || 'host_plant_occurrence_core.json'
      names.add(datasetPath)
      return [...names]
    }
    const sourceTaxa = selected.size > 0
      ? [...selected].map(slug => taxaBySlug.value.get(slug)).filter(Boolean)
      : taxa.value
    for (const taxon of sourceTaxa) {
      const file = occurrenceShardNameForFamily(taxon.family)
      if (file) names.add(file)
    }
    return [...names]
  }

  function rebuildOccurrenceDataset() {
    const cache = occurrenceShardCache.value || {}
    const records = []
    const statsBySlug = {}
    const shardMetadata = []
    const aliasLookup = manifest.value?.metadata?.occurrence_core_aliases_by_taxon || {}
    for (const [file, dataset] of Object.entries(cache)) {
      records.push(...(dataset.records || []))
      Object.assign(statsBySlug, dataset.stats_by_slug || {})
      for (const [alias, target] of Object.entries(aliasLookup)) {
        if (dataset.stats_by_slug?.[target] && !statsBySlug[alias]) {
          statsBySlug[alias] = dataset.stats_by_slug[target]
        }
      }
      shardMetadata.push({ file, ...(dataset.metadata || {}) })
    }
    occurrenceDataset.value = {
      metadata: {
        ...(manifest.value?.metadata || {}),
        loaded_shards: Object.keys(cache),
        shard_metadata: shardMetadata,
        total_records: records.length,
      },
      stats_by_slug: statsBySlug,
      records,
    }
  }

  async function loadOccurrences(slugs = selectedTaxonSlugs.value) {
    await loadMetadata()
    const shardNames = occurrenceShardNamesForSlugs(slugs)
    const missing = shardNames.filter(name => !occurrenceShardCache.value[name])
    if (missing.length === 0) {
      if (!occurrenceDataset.value) rebuildOccurrenceDataset()
      return occurrenceDataset.value
    }
    occurrenceLoading.value = true
    occurrenceError.value = null
    try {
      const loaded = await Promise.all(missing.map(async name => {
        const dataset = await fetchJson(name)
        return [name, dataset.records
          ? dataset
          : {
              metadata: dataset.metadata || {},
              stats_by_slug: dataset.stats_by_slug || {},
              records: (dataset.features || []).map(feature => {
                const coords = feature.geometry?.coordinates || []
                return {
                  ...(feature.properties || {}),
                  id: feature.properties?.gbifID || `${feature.properties?.host_taxon_slug}-${coords.join(',')}`,
                  lat: Number(coords[1]),
                  lng: Number(coords[0]),
                }
              }),
            }]
      }))
      occurrenceShardCache.value = {
        ...occurrenceShardCache.value,
        ...Object.fromEntries(loaded),
      }
      loadedOccurrenceShards.value = Object.keys(occurrenceShardCache.value)
      rebuildOccurrenceDataset()
      return occurrenceDataset.value
    } catch (error) {
      occurrenceError.value = error instanceof Error ? error.message : String(error)
      return null
    } finally {
      occurrenceLoading.value = false
    }
  }

  async function loadGallery(slugs = selectedTaxonSlugs.value) {
    await loadMetadata()
    const byTaxon = manifest.value?.metadata?.gallery_shards_by_taxon || {}
    const selected = new Set((slugs || []).filter(Boolean))

    if (Object.keys(byTaxon).length > 0) {
      const sourceSlugs = selected.size > 0 ? [...selected] : Object.keys(byTaxon)
      const shardNames = [...new Set(sourceSlugs.flatMap(slug => {
        const shard = byTaxon[slug]
        return Array.isArray(shard) ? shard : (shard ? [shard] : [])
      }))]
      galleryLoading.value = true
      galleryError.value = null
      try {
        const datasets = await Promise.all(shardNames.map(name => fetchJson(name)))
        const statsBySlug = {}
        const items = []
        const aliasLookup = manifest.value?.metadata?.gallery_aliases_by_taxon || {}
        for (const dataset of datasets) {
          Object.assign(statsBySlug, dataset.stats_by_slug || {})
          for (const [alias, target] of Object.entries(aliasLookup)) {
            if (dataset.stats_by_slug?.[target] && !statsBySlug[alias]) {
              statsBySlug[alias] = dataset.stats_by_slug[target]
            }
          }
          items.push(...(dataset.items || dataset.records || []))
        }
        galleryDataset.value = {
          metadata: {
            ...(manifest.value?.metadata || {}),
            loaded_shards: shardNames,
            item_count: items.length,
          },
          stats_by_slug: statsBySlug,
          items,
        }
        return galleryDataset.value
      } catch (error) {
        galleryError.value = error instanceof Error ? error.message : String(error)
        return null
      } finally {
        galleryLoading.value = false
      }
    }

    if (galleryDataset.value) return galleryDataset.value
    const datasetPath = manifest.value?.metadata?.gallery_dataset || 'host_plant_gallery.json'
    galleryLoading.value = true
    galleryError.value = null
    try {
      galleryDataset.value = await fetchJson(datasetPath)
      return galleryDataset.value
    } catch (error) {
      galleryError.value = error instanceof Error ? error.message : String(error)
      return null
    } finally {
      galleryLoading.value = false
    }
  }

  function getOccurrenceCollectionForTaxa(slugs = selectedTaxonSlugs.value) {
    const selected = new Set((slugs || []).filter(Boolean))
    const features = (occurrenceDataset.value?.records || [])
      .filter(record => selected.has(record?.host_taxon_slug))
      .map(record => hostPlantRecordToFeature(record))
    return {
      type: 'FeatureCollection',
      metadata: occurrenceDataset.value?.metadata || {},
      features,
    }
  }

  function occurrenceCountForSlug(slug) {
    return (occurrenceDataset.value?.records || [])
      .filter(record => record?.host_taxon_slug === slug)
      .length
  }

  return {
    manifest,
    taxa,
    associations,
    loading,
    enabled,
    selectedTaxonSlugs,
    opacity,
    occurrenceDataset,
    occurrenceLoading,
    occurrenceError,
    loadedOccurrenceShards,
    occurrenceShardCache,
    galleryDataset,
    galleryLoading,
    galleryError,
    confidenceLevels,
    hostIdLevels,
    evidenceLevels,
    taxaBySlug,
    activeTaxa,
    caveat,
    loadMetadata,
    confidenceBucket,
    confidenceLabel,
    confidenceDisplayLabel,
    confidencePasses,
    confidenceCountsForAssociations,
    normalizeHostIdLevelSelection,
    normalizeEvidenceSelection,
    associationMatchesHostFilters,
    getButterflyOptionsForHostPlants,
    getTaxaForButterflies,
    getSpeciesLevelTaxaForButterflies,
    getOccurrenceTaxonOptionsForButterflies,
    filterOccurrenceTaxonOptions,
    toggleEnabled,
    setSelectedTaxa,
    toggleTaxon,
    loadOccurrences,
    occurrenceShardNamesForSlugs,
    loadGallery,
    getOccurrenceCollectionForTaxa,
    occurrenceCountForSlug,
  }
})
