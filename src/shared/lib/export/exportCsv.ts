import type { Record as DataRecord } from '@/features/data/types'

const CSV_COLUMNS = [
  'id',
  'scientific_name',
  'genus',
  'species',
  'subspecies',
  'family',
  'tribe',
  'mimicry_ring',
  'sequencing_status',
  'source',
  'country',
  'collection_location',
  'observation_date',
  'lat',
  'lng',
  'image_url',
] as const

function escapeCSV(value: unknown): string {
  let str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function exportToCSV(
  records: DataRecord[],
  filename: string = 'ithomiini_data'
): void {
  if (records.length === 0) {
    throw new Error('No data to export')
  }

  const header = CSV_COLUMNS.join(',')
  const rows = records.map((record) =>
    CSV_COLUMNS.map((col) => escapeCSV(record[col as keyof DataRecord])).join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${Date.now()}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
