#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const dataDir = path.join(projectRoot, 'public', 'data')
const cachePath = path.join(dataDir, 'gbif_taxonomy_cache.json')
const manifestPath = path.join(dataDir, 'data_manifest.json')
const outputPath = path.join(dataDir, 'taxonomy_synonyms.json')

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))

const stripAuthor = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : String(name).trim()
}

const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null
const sourceFiles = new Set()
for (const source of Object.values(manifest?.sources || {})) {
  if (source?.file) sourceFiles.add(source.file)
}
if (sourceFiles.size === 0) {
  for (const file of fs.readdirSync(dataDir)) {
    if (/^map_points_.*\.json$/.test(file)) sourceFiles.add(file)
  }
}

const acceptedSpecies = new Set()
for (const file of sourceFiles) {
  const fullPath = path.join(dataDir, file)
  if (!fs.existsSync(fullPath)) continue
  for (const row of readJson(fullPath)) {
    if (row?.scientific_name) acceptedSpecies.add(row.scientific_name)
  }
}

const cache = readJson(cachePath)
const synonyms = []
for (const [synonymKey, synonym] of Object.entries(cache.synonyms || {})) {
  if (synonym.rank !== 'SPECIES') continue
  const accepted = stripAuthor(synonym.acceptedName || '')
  const synonymName = stripAuthor(synonym.canonicalName || synonymKey)
  if (!accepted || !synonymName || synonymName.toLowerCase() === accepted.toLowerCase()) continue
  if (!acceptedSpecies.has(accepted)) continue
  synonyms.push({
    synonym: synonymName,
    accepted,
    key: synonym.key,
    acceptedKey: synonym.acceptedKey,
  })
}

synonyms.sort((a, b) => a.accepted.localeCompare(b.accepted) || a.synonym.localeCompare(b.synonym))

fs.writeFileSync(outputPath, `${JSON.stringify({
  metadata: {
    generated_at: new Date().toISOString(),
    source: 'public/data/gbif_taxonomy_cache.json',
    accepted_species_count: acceptedSpecies.size,
    synonym_count: synonyms.length,
  },
  synonyms,
}, null, 2)}\n`)

console.log(`Wrote ${synonyms.length} species synonyms to ${outputPath}`)
