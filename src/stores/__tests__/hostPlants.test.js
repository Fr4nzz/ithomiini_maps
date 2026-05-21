import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHostPlantStore } from '../hostPlants'

const manifest = {
  metadata: {
    scientific_caveat: 'Plant records are context only.',
    gbif_download_doi: null,
    gbif_download_doi_note: 'No DOI minted.',
  },
  taxa: [
    {
      canonical_name: 'Prestonia coalita',
      slug: 'species_prestonia_coalita',
      rank: 'species',
      family: 'Apocynaceae',
      occurrence_file: 'occurrences/species_prestonia_coalita.geojson',
      occurrence_count: 2,
    },
    {
      canonical_name: 'Solanum',
      slug: 'genus_solanum',
      rank: 'genus',
      family: 'Solanaceae',
      occurrence_file: 'occurrences/genus_solanum.geojson',
      occurrence_count: 4,
    },
    {
      canonical_name: 'Solanaceae',
      slug: 'family_solanaceae',
      rank: 'family',
      family: 'Solanaceae',
      occurrence_file: 'occurrences/family_solanaceae.geojson',
      occurrence_count: 7,
    },
  ],
}

const associations = {
  associations: [
    {
      butterfly_taxon: 'Aeria elara',
      host_taxon_slug: 'species_prestonia_coalita',
      host_taxon_name: 'Prestonia coalita',
      confidence: 'high',
      caveats: 'Check primary source.',
    },
    {
      butterfly_taxon: 'Callithomia alexirrhoe',
      host_taxon_slug: 'genus_solanum',
      host_taxon_name: 'Solanum',
      confidence: 'needs_check',
    },
    {
      butterfly_taxon: 'Callithomia alexirrhoe',
      host_taxon_slug: 'family_solanaceae',
      host_taxon_name: 'Solanaceae',
      confidence: 'medium',
    },
  ],
}

describe('useHostPlantStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('loads manifest and association metadata without loading occurrences', async () => {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes('manifest') ? manifest : associations,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const store = useHostPlantStore()
    await store.loadMetadata()

    expect(store.taxa).toHaveLength(3)
    expect(store.associations).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(call => call[0])).not.toContain(
      '/data/host_plants/occurrences/species_prestonia_coalita.geojson'
    )
  })

  it('returns host taxa associated with selected butterflies', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes('manifest') ? manifest : associations,
    })))
    const store = useHostPlantStore()
    await store.loadMetadata()

    const taxa = store.getTaxaForButterflies(['Aeria elara'])

    expect(taxa).toHaveLength(1)
    expect(taxa[0].canonical_name).toBe('Prestonia coalita')
    expect(taxa[0].associations[0].confidence).toBe('high')
  })

  it('does not return fallback host taxa when no butterfly is selected', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes('manifest') ? manifest : associations,
    })))
    const store = useHostPlantStore()
    await store.loadMetadata()

    expect(store.getTaxaForButterflies([])).toEqual([])
  })

  it('builds selectable occurrence-backed host taxon options for the filter UI', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes('manifest') ? manifest : associations,
    })))
    const store = useHostPlantStore()
    await store.loadMetadata()

    expect(store.getOccurrenceTaxonOptionsForButterflies(['Aeria elara'])).toMatchObject([
      {
        label: 'Prestonia coalita',
        value: 'species_prestonia_coalita',
        meta: 'species · Apocynaceae · high · 2 records',
      },
    ])
    expect(store.getOccurrenceTaxonOptionsForButterflies([])).toMatchObject([
      {
        label: 'Prestonia coalita',
        value: 'species_prestonia_coalita',
        meta: 'species · Apocynaceae · 2 records',
      },
      {
        label: 'Solanum',
        value: 'genus_solanum',
        meta: 'genus · Solanaceae · 4 records',
      },
    ])
  })

  it('builds butterfly search options with confidence counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes('manifest') ? manifest : associations,
    })))
    const store = useHostPlantStore()
    await store.loadMetadata()

    expect(store.getButterflyOptionsForHostPlants()).toEqual([
      expect.objectContaining({
        label: 'Aeria elara',
        meta: '1 high · 0 medium · 0 low',
      }),
      expect.objectContaining({
        label: 'Callithomia alexirrhoe',
        meta: '0 high · 0 medium · 1 low',
      }),
    ])
  })

  it('applies confidence thresholds to butterfly-expanded host taxa', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes('manifest') ? manifest : associations,
    })))
    const store = useHostPlantStore()
    await store.loadMetadata()

    expect(store.getTaxaForButterflies(['Callithomia alexirrhoe'], 'medium')).toEqual([])
    expect(store.getTaxaForButterflies(['Callithomia alexirrhoe'], 'low')).toHaveLength(1)
  })

  it('matches host taxon options by associated butterfly species search text', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes('manifest') ? manifest : associations,
    })))
    const store = useHostPlantStore()
    await store.loadMetadata()

    const options = store.getOccurrenceTaxonOptionsForButterflies([])
    const matches = store.filterOccurrenceTaxonOptions(options, 'callithomia alexirrhoe')

    expect(matches).toEqual([
      expect.objectContaining({
        label: 'Solanum',
        value: 'genus_solanum',
        matchMeta: 'Butterfly: Callithomia alexirrhoe',
      }),
    ])
    expect(matches.some(option => option.value === 'family_solanaceae')).toBe(false)
  })

  it('lazy-loads and caches occurrence files for selected taxa', async () => {
    const occurrence = { type: 'FeatureCollection', features: [{ type: 'Feature' }] }
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      json: async () => {
        if (String(url).includes('manifest')) return manifest
        if (String(url).includes('associations')) return associations
        return occurrence
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const store = useHostPlantStore()
    await store.loadMetadata()
    await store.loadOccurrences('species_prestonia_coalita')
    await store.loadOccurrences('species_prestonia_coalita')

    expect(store.occurrenceCollections.species_prestonia_coalita.features).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('occurrences'))).toHaveLength(1)
  })
})
