import type { Record as DataRecord } from '@/features/data/types'

interface GeoJSONExport {
  type: 'FeatureCollection'
  metadata: {
    title: string
    version: string
    exportDate: string
    recordCount: number
    source: string
  }
  features: GeoJSON.Feature<GeoJSON.Point>[]
}

export function exportToGeoJSON(
  records: DataRecord[],
  filename: string = 'ithomiini_data',
  version: string = 'dev'
): void {
  if (records.length === 0) {
    throw new Error('No data to export')
  }

  const features: GeoJSON.Feature<GeoJSON.Point>[] = records.map((record) => ({
    type: 'Feature',
    id: record.id,
    geometry: {
      type: 'Point',
      coordinates: [record.lng, record.lat],
    },
    properties: { ...record },
  }))

  const exportData: GeoJSONExport = {
    type: 'FeatureCollection',
    metadata: {
      title: 'Ithomiini Distribution Data',
      version,
      exportDate: new Date().toISOString(),
      recordCount: features.length,
      source: 'https://fr4nzz.github.io/ithomiini_maps/',
    },
    features,
  }

  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${Date.now()}.geojson`
  link.click()

  URL.revokeObjectURL(url)
}
