import { useMemo } from 'react'
import { useDataStore, isValidValue, matchesFilters } from './store'
import type { Record, FilterState, DataSource, SequencingStatus } from './types'

// GeoJSON types
interface GeoJSONFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: Record
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// Helper: filter data up to a certain taxonomic level
function getFilteredSubset(
  records: Record[],
  filters: FilterState,
  upToLevel: number
): Record[] {
  let data = records

  // Always filter by source first
  if (filters.sources.length > 0) {
    data = data.filter((r) => filters.sources.includes(r.source))
  }

  if (upToLevel >= 1 && filters.family) {
    data = data.filter((r) => r.family === filters.family)
  }
  if (upToLevel >= 2 && filters.tribe) {
    data = data.filter((r) => r.tribe === filters.tribe)
  }
  if (upToLevel >= 3 && filters.genus) {
    data = data.filter((r) => r.genus === filters.genus)
  }
  if (upToLevel >= 4 && filters.species.length > 0) {
    data = data.filter((r) => filters.species.includes(r.scientific_name))
  }

  return data
}

// Selector: filtered record IDs
export function useFilteredIds(): string[] {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)

  return useMemo(() => {
    return records.filter((r) => matchesFilters(r, filters)).map((r) => r.id)
  }, [records, filters])
}

// Selector: filtered records
export function useFilteredRecords(): Record[] {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)

  return useMemo(() => {
    return records.filter((r) => matchesFilters(r, filters))
  }, [records, filters])
}

// Selector: GeoJSON for map
export function useFilteredGeoJSON(): GeoJSONFeatureCollection | null {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)

  return useMemo(() => {
    if (!records.length) return null

    const filtered = records.filter((r) => matchesFilters(r, filters))

    return {
      type: 'FeatureCollection',
      features: filtered.map((r) => ({
        type: 'Feature',
        id: r.id,
        geometry: {
          type: 'Point',
          coordinates: [r.lng, r.lat] as [number, number],
        },
        properties: r,
      })),
    }
  }, [records, filters])
}

// Selector: unique families
export function useUniqueFamilies(): string[] {
  const records = useDataStore((s) => s.records)

  return useMemo(() => {
    const set = new Set(records.map((r) => r.family).filter(isValidValue))
    return Array.from(set).sort()
  }, [records])
}

// Selector: unique tribes (based on family filter)
export function useUniqueTribes(): string[] {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)

  return useMemo(() => {
    const subset = getFilteredSubset(records, filters, 1)
    const set = new Set(subset.map((r) => r.tribe).filter(isValidValue))
    return Array.from(set).sort()
  }, [records, filters])
}

// Selector: unique genera (based on tribe filter)
export function useUniqueGenera(): string[] {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)

  return useMemo(() => {
    const subset = getFilteredSubset(records, filters, 2)
    const set = new Set(subset.map((r) => r.genus).filter(isValidValue))
    return Array.from(set).sort()
  }, [records, filters])
}

// Selector: unique species (based on genus filter)
export function useUniqueSpecies(): string[] {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)

  return useMemo(() => {
    const subset = getFilteredSubset(records, filters, 3)
    const set = new Set(subset.map((r) => r.scientific_name).filter(isValidValue))
    return Array.from(set).sort()
  }, [records, filters])
}

// Selector: unique subspecies (based on species filter)
export function useUniqueSubspecies(): string[] {
  const records = useDataStore((s) => s.records)
  const filters = useDataStore((s) => s.filters)

  return useMemo(() => {
    const subset = getFilteredSubset(records, filters, 4)
    const set = new Set(
      subset.map((r) => r.subspecies).filter((v): v is string => isValidValue(v))
    )
    return Array.from(set).sort()
  }, [records, filters])
}

// Selector: unique mimicry rings (all, non-cascading)
export function useUniqueMimicryRings(): string[] {
  const records = useDataStore((s) => s.records)

  return useMemo(() => {
    const set = new Set(
      records
        .map((r) => r.mimicry_ring)
        .filter((v): v is string => isValidValue(v) && v !== 'Unknown')
    )
    return Array.from(set).sort()
  }, [records])
}

// Selector: unique sequencing statuses
export function useUniqueStatuses(): SequencingStatus[] {
  const records = useDataStore((s) => s.records)

  return useMemo(() => {
    const set = new Set(
      records
        .map((r) => r.sequencing_status)
        .filter((v): v is SequencingStatus => isValidValue(v))
    )
    return Array.from(set).sort()
  }, [records])
}

// Selector: unique data sources
export function useUniqueSources(): DataSource[] {
  const records = useDataStore((s) => s.records)

  return useMemo(() => {
    const set = new Set(records.map((r) => r.source).filter(isValidValue))
    return Array.from(set).sort() as DataSource[]
  }, [records])
}

// Selector: unique countries
export function useUniqueCountries(): string[] {
  const records = useDataStore((s) => s.records)

  return useMemo(() => {
    const set = new Set(records.map((r) => r.country).filter(isValidValue))
    return Array.from(set).sort()
  }, [records])
}

// Selector: filtered count
export function useFilteredCount(): number {
  const filteredIds = useFilteredIds()
  return filteredIds.length
}

// Selector: total count
export function useTotalCount(): number {
  const records = useDataStore((s) => s.records)
  return records.length
}

// Selector: selected record
export function useSelectedRecord(): Record | null {
  const recordsById = useDataStore((s) => s.recordsById)
  const selectedId = useDataStore((s) => s.ui.selectedPointId)

  return useMemo(() => {
    if (!selectedId) return null
    return recordsById.get(selectedId) ?? null
  }, [recordsById, selectedId])
}
