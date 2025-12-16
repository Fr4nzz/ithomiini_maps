import { z } from 'zod'

// Sequencing status schema
export const sequencingStatusSchema = z.enum([
  'Sequenced',
  'Tissue Available',
  'Preserved Specimen',
  'Published',
])

// Data source schema
export const dataSourceSchema = z.enum([
  'Dore et al. (2025)',
  'Sanger Institute',
  'GBIF',
])

// Record schema for validation
export const recordSchema = z.object({
  id: z.string(),
  scientific_name: z.string(),
  genus: z.string(),
  species: z.string(),
  subspecies: z.string().nullable(),
  family: z.string(),
  tribe: z.string(),
  lat: z.number(),
  lng: z.number(),
  mimicry_ring: z.string().nullable(),
  sequencing_status: sequencingStatusSchema.nullable(),
  source: dataSourceSchema,
  country: z.string(),
  image_url: z.string().nullable(),
  collection_location: z.string().nullable(),
  observation_date: z.string().nullable(),
})

// Array of records
export const recordsSchema = z.array(recordSchema)

// Type inference from schema
export type RecordFromSchema = z.infer<typeof recordSchema>
