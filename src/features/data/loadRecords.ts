import { useQuery } from '@tanstack/react-query'
import { recordsSchema } from './schema'
import type { Record } from './types'

// Fetch records from the JSON file
async function fetchRecords(): Promise<Record[]> {
  // In development, Vite serves from root even with base set
  // In production (GitHub Pages), we need the base path
  const isDev = import.meta.env.DEV
  const basePath = isDev ? '/' : (import.meta.env.BASE_URL || '/')
  const response = await fetch(`${basePath}data/map_points.json`)

  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Validate with Zod schema
  const parsed = recordsSchema.safeParse(data)
  if (!parsed.success) {
    console.warn('Data validation warnings:', parsed.error.issues)
    // Return data anyway for flexibility (some fields might be missing in dev)
    return data as Record[]
  }

  return parsed.data as Record[]
}

// React Query hook for loading records
export function useRecords() {
  return useQuery({
    queryKey: ['records'],
    queryFn: fetchRecords,
  })
}
