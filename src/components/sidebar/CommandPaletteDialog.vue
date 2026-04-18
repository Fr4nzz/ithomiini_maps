<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useMagicKeys, onClickOutside } from '@vueuse/core'
import { useDataStore } from '@/stores/data'
import { isValidValue } from '@/utils/validation'
import config from '@/config'

const store = useDataStore()
const dialogOpen = ref(false)
const inputRef = ref(null)
const rootRef = ref(null)
const listRef = ref(null)
const query = ref('')
const activeIndex = ref(0)

const MAX_RESULTS = 50
const MAX_SUGGESTIONS = 3
const LEVEL_BONUS = {
  species: 100, subspecies: 95, genus: 80, tribe: 70, family: 60, country: 50, mimicry: 40,
}
const GROUP_ORDER = ['taxonomy', 'geography', 'mimicry']

const buildOptionMap = (features, field, kind, typeLabel, lineageBuilder = () => ({})) => {
  const options = new Map()
  for (const feature of features) {
    const value = feature[field]
    if (!isValidValue(value)) continue
    const existing = options.get(value)
    if (existing) { existing.count += 1; continue }
    options.set(value, {
      id: `${kind}:${value}`,
      value,
      kind,
      typeLabel,
      count: 1,
      lineage: lineageBuilder(feature),
    })
  }
  return Array.from(options.values())
}

const buildSubspeciesMap = (features) => {
  const options = new Map()
  for (const feature of features) {
    const sub = feature.subspecies
    const species = feature.scientific_name
    if (!isValidValue(sub) || !isValidValue(species)) continue
    const key = `${species}|${sub}`
    const existing = options.get(key)
    if (existing) { existing.count += 1; continue }
    options.set(key, {
      id: `subspecies:${key}`,
      value: sub,
      displayValue: `${species} ${sub}`,
      speciesName: species,
      kind: 'subspecies',
      typeLabel: 'Subspecies',
      count: 1,
      lineage: { family: feature.family, tribe: feature.tribe, genus: feature.genus, scientificName: species },
    })
  }
  return Array.from(options.values())
}

const allItems = computed(() => {
  const features = store.allFeatures || []
  const items = [
    ...buildOptionMap(features, 'scientific_name', 'species', 'Species', f => ({
      family: f.family, tribe: f.tribe, genus: f.genus, scientificName: f.scientific_name,
    })),
    ...buildSubspeciesMap(features),
    ...buildOptionMap(features, 'genus', 'genus', 'Genus', f => ({ family: f.family, tribe: f.tribe, genus: f.genus })),
    ...buildOptionMap(features, 'tribe', 'tribe', 'Tribe', f => ({ family: f.family, tribe: f.tribe })),
    ...buildOptionMap(features, 'family', 'family', 'Family', f => ({ family: f.family })),
    ...buildOptionMap(features, 'country', 'country', 'Country'),
    ...(config.features.mimicrySelector
      ? buildOptionMap(features, 'mimicry_ring', 'mimicry', 'Mimicry ring')
      : []),
  ]
  return items
})

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = a[i - 1] === b[j - 1] ? row[j - 1] : 1 + Math.min(row[j - 1], row[j], prev)
      prev = temp
    }
    row[0] = i
  }
  return row[b.length]
}

const WORD_BREAK = /[\s\-_/]/
const isWordStart = (hay, idx) => idx === 0 || WORD_BREAK.test(hay[idx - 1])

function scoreItem(item, queryLower) {
  const haystacks = item.kind === 'subspecies'
    ? [item.value.toLowerCase(), item.displayValue.toLowerCase()]
    : [item.value.toLowerCase()]

  let bestScore = -Infinity
  let matchField = null
  let matchIndex = -1

  for (const hay of haystacks) {
    const idx = hay.indexOf(queryLower)
    if (idx === -1) continue
    let score = isWordStart(hay, idx) ? 1000 : 200
    score += LEVEL_BONUS[item.kind] || 0
    score += Math.log10(item.count + 1) * 5
    if (score > bestScore) {
      bestScore = score
      matchField = hay
      matchIndex = idx
    }
  }

  if (bestScore === -Infinity) return null
  return { item, score: bestScore, matchField, matchIndex, matchLength: queryLower.length }
}

const ranked = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return { groups: [], suggestions: [] }

  const hits = []
  for (const item of allItems.value) {
    const scored = scoreItem(item, q)
    if (scored) hits.push(scored)
  }
  hits.sort((a, b) => b.score - a.score)

  const limited = hits.slice(0, MAX_RESULTS)

  const hitIds = new Set(hits.map(h => h.item.id))
  const distances = []
  for (const item of allItems.value) {
    if (hitIds.has(item.id)) continue
    const hay = (item.kind === 'subspecies' ? item.displayValue : item.value).toLowerCase()
    const tokens = hay.split(/[\s\-_/]+/).filter(Boolean)
    let best = Infinity
    for (const tok of tokens) {
      const d = levenshtein(q, tok.slice(0, Math.max(q.length, tok.length)))
      if (d < best) best = d
    }
    if (best > 0 && best <= 2) distances.push({ item, dist: best })
  }
  distances.sort((a, b) => a.dist - b.dist || b.item.count - a.item.count)
  const suggestions = []
  const seen = new Set()
  for (const { item } of distances) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    suggestions.push({ item, score: 0, matchField: null, matchIndex: -1, matchLength: 0 })
    if (suggestions.length >= MAX_SUGGESTIONS) break
  }
  const byGroup = { taxonomy: [], geography: [], mimicry: [] }
  for (const hit of limited) {
    if (hit.item.kind === 'country') byGroup.geography.push(hit)
    else if (hit.item.kind === 'mimicry') byGroup.mimicry.push(hit)
    else byGroup.taxonomy.push(hit)
  }
  const groups = GROUP_ORDER
    .map(key => ({
      key,
      heading: key === 'taxonomy' ? 'Taxonomy' : key === 'geography' ? 'Geography' : 'Mimicry',
      items: byGroup[key],
    }))
    .filter(g => g.items.length > 0)

  return { groups, suggestions }
})

const flatResults = computed(() => {
  const list = []
  for (const group of ranked.value.groups) {
    for (const hit of group.items) list.push(hit)
  }
  for (const hit of ranked.value.suggestions) list.push(hit)
  return list
})

watch(flatResults, () => { activeIndex.value = 0 })

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (s) => s.replace(/[&<>"']/g, c => HTML_ESCAPES[c])

function highlight(text, hit) {
  const q = query.value.trim().toLowerCase()
  if (!q) return escapeHtml(text)
  const idx = text.toLowerCase().indexOf(q)
  if (idx < 0) return escapeHtml(text)
  const len = hit?.matchLength ?? q.length
  return escapeHtml(text.slice(0, idx))
    + '<strong>' + escapeHtml(text.slice(idx, idx + len)) + '</strong>'
    + escapeHtml(text.slice(idx + len))
}

async function clearConflictingTaxonomy(lineage) {
  const { family, tribe, genus } = lineage
  if (family && store.filters.family !== 'All' && store.filters.family !== family) {
    store.filters.family = 'All'
    await nextTick()
    return
  }
  if (tribe && store.filters.tribe !== 'All' && store.filters.tribe !== tribe) {
    store.filters.tribe = 'All'
    await nextTick()
    return
  }
  if (genus && store.filters.genus !== 'All' && store.filters.genus !== genus) {
    store.filters.genus = 'All'
    await nextTick()
  }
}

async function selectItem(item) {
  switch (item.kind) {
    case 'family':
      store.filters.family = item.value
      break
    case 'tribe':
      if (item.lineage.family) store.filters.family = item.lineage.family
      await nextTick()
      store.filters.tribe = item.value
      break
    case 'genus':
      if (item.lineage.family) store.filters.family = item.lineage.family
      if (item.lineage.tribe) store.filters.tribe = item.lineage.tribe
      await nextTick()
      store.filters.genus = item.value
      break
    case 'species':
      await clearConflictingTaxonomy(item.lineage)
      if (!store.filters.species.includes(item.value)) {
        store.filters.species = [...store.filters.species, item.value]
      }
      break
    case 'subspecies':
      await clearConflictingTaxonomy(item.lineage)
      if (item.speciesName && !store.filters.species.includes(item.speciesName)) {
        store.filters.species = [...store.filters.species, item.speciesName]
      }
      await nextTick()
      if (!store.filters.subspecies.includes(item.value)) {
        store.filters.subspecies = [...store.filters.subspecies, item.value]
      }
      break
    case 'country':
      store.filters.country = item.value
      break
    case 'mimicry':
      if (!store.filters.mimicry.includes(item.value)) {
        store.filters.mimicry = [...store.filters.mimicry, item.value]
      }
      break
  }
  query.value = ''
}

const activeFilters = computed(() => {
  const chips = []
  const f = store.filters
  if (f.family !== 'All') chips.push({ key: `family:${f.family}`, label: f.family, type: 'Family', remove: () => { store.filters.family = 'All' } })
  if (f.tribe !== 'All') chips.push({ key: `tribe:${f.tribe}`, label: f.tribe, type: 'Tribe', remove: () => { store.filters.tribe = 'All' } })
  if (f.genus !== 'All') chips.push({ key: `genus:${f.genus}`, label: f.genus, type: 'Genus', remove: () => { store.filters.genus = 'All' } })
  for (const s of f.species) chips.push({ key: `species:${s}`, label: s, type: 'Species', remove: () => { store.filters.species = store.filters.species.filter(v => v !== s) } })
  for (const s of f.subspecies) chips.push({ key: `subsp:${s}`, label: s, type: 'Subspecies', remove: () => { store.filters.subspecies = store.filters.subspecies.filter(v => v !== s) } })
  for (const m of f.mimicry) chips.push({ key: `mim:${m}`, label: m, type: 'Mimicry', remove: () => { store.filters.mimicry = store.filters.mimicry.filter(v => v !== m) } })
  if (f.country !== 'All') chips.push({ key: `country:${f.country}`, label: f.country, type: 'Country', remove: () => { store.filters.country = 'All' } })
  for (const s of f.status) chips.push({ key: `status:${s}`, label: s, type: 'Status', remove: () => { store.filters.status = store.filters.status.filter(v => v !== s) } })
  if (f.sex !== 'all') chips.push({ key: `sex:${f.sex}`, label: f.sex, type: 'Sex', remove: () => { store.filters.sex = 'all' } })
  if (f.camidSearch) chips.push({ key: 'camid', label: 'CAMIDs', type: 'Search', remove: () => { store.filters.camidSearch = '' } })
  if (f.dateStart || f.dateEnd) chips.push({ key: 'date', label: 'Date range', type: 'Time', remove: () => { store.filters.dateStart = null; store.filters.dateEnd = null } })
  return chips
})

function handleKeydown(e) {
  const total = flatResults.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (total === 0) return
    activeIndex.value = (activeIndex.value + 1) % total
    scrollActiveIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (total === 0) return
    activeIndex.value = (activeIndex.value - 1 + total) % total
    scrollActiveIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const hit = flatResults.value[activeIndex.value]
    if (hit) selectItem(hit.item)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    dialogOpen.value = false
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listRef.value?.querySelector('[data-active="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

const keys = useMagicKeys({
  passive: false,
  onEventFired(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') event.preventDefault()
  },
})

watch(() => keys['Ctrl+K']?.value || keys['Meta+K']?.value, (pressed) => {
  if (!pressed) return
  dialogOpen.value = !dialogOpen.value
})

function handleGlobalKeydown(e) {
  if (!dialogOpen.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    dialogOpen.value = false
  }
}

watch(dialogOpen, async (open) => {
  if (!open) {
    query.value = ''
    activeIndex.value = 0
    window.removeEventListener('keydown', handleGlobalKeydown, true)
    return
  }
  window.addEventListener('keydown', handleGlobalKeydown, true)
  await nextTick()
  inputRef.value?.focus()
})

onClickOutside(rootRef, () => {
  if (dialogOpen.value) dialogOpen.value = false
})

defineExpose({ open: () => { dialogOpen.value = true } })
</script>

<template>
  <Teleport to="body">
    <Transition name="cmd-fade">
      <div v-if="dialogOpen" class="cmd-overlay" @keydown="handleKeydown">
        <div ref="rootRef" class="cmd-dialog">
          <div class="cmd-main">
            <div class="cmd-input-wrap">
              <svg class="cmd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref="inputRef"
                v-model="query"
                type="text"
                class="cmd-input"
                placeholder="Search species, genera, subspecies, countries, mimicry rings..."
                autocomplete="off"
                spellcheck="false"
              >
              <button class="cmd-close" @click="dialogOpen = false" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div ref="listRef" class="cmd-list">
              <div v-if="!query.trim()" class="cmd-hint">
                Start typing to search taxonomy, geography, and mimicry filters. Use ↑↓ to navigate, Enter to apply.
              </div>
              <template v-else-if="ranked.groups.length === 0 && ranked.suggestions.length === 0">
                <div class="cmd-hint cmd-hint--empty">No matches found.</div>
              </template>
              <template v-else>
                <template v-for="group in ranked.groups" :key="group.key">
                  <div class="cmd-group-heading">{{ group.heading }}</div>
                  <button
                    v-for="hit in group.items"
                    :key="hit.item.id"
                    :data-active="flatResults.indexOf(hit) === activeIndex"
                    class="cmd-item"
                    :class="{ 'cmd-item--active': flatResults.indexOf(hit) === activeIndex }"
                    @mouseenter="activeIndex = flatResults.indexOf(hit)"
                    @click="selectItem(hit.item)"
                  >
                    <span class="cmd-item-label">
                      <template v-if="hit.item.kind === 'subspecies'">
                        <em class="cmd-species">{{ hit.item.speciesName }}</em>
                        <span v-html="highlight(hit.item.value, hit)" />
                      </template>
                      <template v-else>
                        <span v-html="highlight(hit.item.value, hit)" />
                      </template>
                    </span>
                    <span class="cmd-item-type">{{ hit.item.typeLabel }}</span>
                    <span class="cmd-item-count">{{ hit.item.count.toLocaleString() }}</span>
                  </button>
                </template>

                <template v-if="ranked.suggestions.length > 0">
                  <div class="cmd-group-heading cmd-group-heading--suggest">Did you mean?</div>
                  <button
                    v-for="hit in ranked.suggestions"
                    :key="`sug-${hit.item.id}`"
                    :data-active="flatResults.indexOf(hit) === activeIndex"
                    class="cmd-item cmd-item--suggest"
                    :class="{ 'cmd-item--active': flatResults.indexOf(hit) === activeIndex }"
                    @mouseenter="activeIndex = flatResults.indexOf(hit)"
                    @click="selectItem(hit.item)"
                  >
                    <span class="cmd-item-label">
                      <template v-if="hit.item.kind === 'subspecies'">
                        <em class="cmd-species">{{ hit.item.speciesName }}</em>
                        {{ hit.item.value }}
                      </template>
                      <template v-else>{{ hit.item.value }}</template>
                    </span>
                    <span class="cmd-item-type">{{ hit.item.typeLabel }}</span>
                    <span class="cmd-item-count">{{ hit.item.count.toLocaleString() }}</span>
                  </button>
                </template>
              </template>
            </div>
          </div>

          <aside class="cmd-sidebar" v-if="activeFilters.length > 0">
            <div class="cmd-sidebar-title">Active filters ({{ activeFilters.length }})</div>
            <div class="cmd-chips">
              <button
                v-for="chip in activeFilters"
                :key="chip.key"
                class="cmd-chip"
                :title="`Remove ${chip.type}: ${chip.label}`"
                @click="chip.remove()"
              >
                <span class="cmd-chip-type">{{ chip.type }}</span>
                <span class="cmd-chip-label">{{ chip.label }}</span>
                <svg class="cmd-chip-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </aside>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmd-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}

.cmd-dialog {
  display: flex;
  gap: 16px;
  width: min(920px, 94vw);
  max-height: 70vh;
  padding: 0;
}

.cmd-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.cmd-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
}

.cmd-search-icon {
  width: 18px;
  height: 18px;
  color: var(--color-text-muted, #666);
  flex-shrink: 0;
}

.cmd-input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.95rem;
}

.cmd-input::placeholder { color: var(--color-text-muted, #666); }

.cmd-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.cmd-close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary, #e0e0e0);
}

.cmd-close svg { width: 16px; height: 16px; }

.cmd-list {
  overflow-y: auto;
  padding: 6px 0 10px;
  flex: 1;
}

.cmd-hint {
  padding: 20px 16px;
  color: var(--color-text-muted, #888);
  font-size: 0.85rem;
}

.cmd-hint--empty { color: var(--color-text-secondary, #aaa); }

.cmd-group-heading {
  padding: 10px 16px 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted, #666);
}

.cmd-group-heading--suggest {
  color: var(--color-accent, #4ade80);
}

.cmd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: 0;
  background: transparent;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}

.cmd-item--active,
.cmd-item:focus-visible {
  background: rgba(74, 222, 128, 0.12);
  outline: 0;
}

.cmd-item :deep(strong) {
  font-weight: 700;
  color: var(--color-accent, #4ade80);
}

.cmd-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.cmd-species {
  color: var(--color-text-secondary, #aaa);
  font-style: italic;
  font-size: 0.85rem;
}

.cmd-item-type {
  font-size: 0.72rem;
  color: var(--color-text-muted, #666);
  flex-shrink: 0;
}

.cmd-item-count {
  margin-left: auto;
  padding: 2px 8px;
  min-width: 32px;
  text-align: center;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.1);
  color: var(--color-accent, #4ade80);
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
}

.cmd-item--suggest { opacity: 0.85; }

.cmd-sidebar {
  width: 240px;
  flex-shrink: 0;
  max-height: 70vh;
  padding: 14px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow-y: auto;
}

.cmd-sidebar-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted, #666);
  margin-bottom: 10px;
}

.cmd-chips {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cmd-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}

.cmd-chip:hover {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.cmd-chip-type {
  font-size: 0.68rem;
  text-transform: uppercase;
  color: var(--color-text-muted, #666);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.cmd-chip-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cmd-chip-x {
  width: 12px;
  height: 12px;
  color: var(--color-text-muted, #666);
  flex-shrink: 0;
}

.cmd-chip:hover .cmd-chip-x { color: #ef4444; }

.cmd-fade-enter-active,
.cmd-fade-leave-active { transition: opacity 0.18s; }

.cmd-fade-enter-from,
.cmd-fade-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .cmd-dialog { flex-direction: column; max-height: 85vh; }
  .cmd-sidebar { width: auto; max-height: 200px; }
}
</style>
