<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { onClickOutside, useMagicKeys } from '@vueuse/core'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useDataStore } from '@/stores/data'
import config from '@/config'

const store = useDataStore()

const inlineRoot = ref(null)
const dialogInput = ref(null)
const inlineOpen = ref(false)
const dialogOpen = ref(false)
const inlineQuery = ref('')

const isValidValue = (value) => {
  if (!value || typeof value !== 'string') return false
  const cleaned = value.trim().toLowerCase()
  return cleaned && !['unknown', 'na', 'nan', 'null', 'none'].includes(cleaned)
}

const buildOptionMap = (features, field, kind, label, lineageBuilder = () => ({})) => {
  const options = new Map()

  for (const feature of features) {
    const value = feature[field]
    if (!isValidValue(value)) continue

    const existing = options.get(value)
    if (existing) {
      existing.count += 1
      continue
    }

    options.set(value, {
      id: `${kind}:${value}`,
      value,
      kind,
      typeLabel: label,
      count: 1,
      lineage: lineageBuilder(feature),
      searchText: '',
    })
  }

  return Array.from(options.values())
    .map((item) => ({
      ...item,
      searchText: [
        item.value,
        item.typeLabel,
        item.lineage.family,
        item.lineage.tribe,
        item.lineage.genus,
        item.lineage.scientificName,
      ].filter(Boolean).join(' ').toLowerCase(),
    }))
    .sort((a, b) => a.value.localeCompare(b.value))
}

const searchGroups = computed(() => {
  const features = store.allFeatures || []

  const taxonomy = [
    ...buildOptionMap(features, 'scientific_name', 'species', 'Species', feature => ({
      family: feature.family,
      tribe: feature.tribe,
      genus: feature.genus,
      scientificName: feature.scientific_name,
    })),
    ...buildOptionMap(features, 'subspecies', 'subspecies', 'Subspecies', feature => ({
      family: feature.family,
      tribe: feature.tribe,
      genus: feature.genus,
      scientificName: feature.scientific_name,
      subspecies: feature.subspecies,
    })),
    ...buildOptionMap(features, 'genus', 'genus', 'Genus', feature => ({
      family: feature.family,
      tribe: feature.tribe,
      genus: feature.genus,
    })),
    ...buildOptionMap(features, 'tribe', 'tribe', 'Tribe', feature => ({
      family: feature.family,
      tribe: feature.tribe,
    })),
    ...buildOptionMap(features, 'family', 'family', 'Family', feature => ({
      family: feature.family,
    })),
  ]

  const geography = buildOptionMap(features, 'country', 'country', 'Country')
  const mimicry = config.features.mimicrySelector
    ? buildOptionMap(features, 'mimicry_ring', 'mimicry', 'Ring')
    : []

  return [
    { key: 'taxonomy', heading: 'Taxonomy', items: taxonomy },
    { key: 'geography', heading: 'Geography', items: geography },
    { key: 'mimicry', heading: 'Mimicry', items: mimicry },
  ].filter(group => group.items.length > 0)
})

const inlineGroups = computed(() => {
  const query = inlineQuery.value.trim().toLowerCase()

  return searchGroups.value
    .map(group => ({
      ...group,
      items: query
        ? group.items.filter(item => item.searchText.includes(query))
        : [],
    }))
    .filter(group => group.items.length > 0)
})

const setTaxonomyContext = (lineage = {}) => {
  if (lineage.family && store.filters.family !== lineage.family) {
    store.filters.family = lineage.family
  }
  if (lineage.tribe && store.filters.tribe !== lineage.tribe) {
    store.filters.tribe = lineage.tribe
  }
  if (lineage.genus && store.filters.genus !== lineage.genus) {
    store.filters.genus = lineage.genus
  }
}

const selectCommandItem = (item) => {
  switch (item.kind) {
    case 'family':
      store.filters.family = item.value
      break
    case 'tribe':
      if (item.lineage.family) store.filters.family = item.lineage.family
      store.filters.tribe = item.value
      break
    case 'genus':
      setTaxonomyContext(item.lineage)
      store.filters.genus = item.value
      break
    case 'species':
      setTaxonomyContext(item.lineage)
      if (!store.filters.species.includes(item.value)) {
        store.filters.species = [...store.filters.species, item.value]
      }
      break
    case 'subspecies':
      setTaxonomyContext(item.lineage)
      if (item.lineage.scientificName) {
        store.filters.species = [item.lineage.scientificName]
      }
      store.filters.subspecies = [item.value]
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

  inlineOpen.value = false
  inlineQuery.value = ''
  dialogOpen.value = false
}

const openDialog = async () => {
  dialogOpen.value = true
  await nextTick()
  dialogInput.value?.focus?.()
}

const keys = useMagicKeys({
  passive: false,
  onEventFired(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
    }
  },
})

watch(
  () => keys['Ctrl+K']?.value || keys['Meta+K']?.value,
  (pressed) => {
    if (!pressed) return
    openDialog()
  }
)

onClickOutside(inlineRoot, () => {
  inlineOpen.value = false
})

watch(dialogOpen, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  dialogInput.value?.focus?.()
})
</script>

<template>
  <div ref="inlineRoot" class="command-palette">
    <div class="command-palette-header">
      <div>
        <p class="command-palette-eyebrow">Cross-filter search</p>
        <h3 class="command-palette-title">Jump to any taxon, country, or mimicry ring</h3>
      </div>
      <button class="command-palette-shortcut" type="button" @click="openDialog">
        <span>Palette</span>
        <kbd>Ctrl / ⌘ K</kbd>
      </button>
    </div>

    <Command class="command-surface command-inline" :model-value="''">
      <div class="command-inline-input-shell">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          v-model="inlineQuery"
          type="text"
          class="command-inline-input"
          placeholder="Search species, genera, countries, mimicry rings…"
          @focus="inlineOpen = true"
        >
      </div>
      <div v-if="inlineOpen" class="command-results-shell">
        <div v-if="!inlineQuery.trim()" class="command-inline-hint">
          Start typing to search across taxonomy, geography, and mimicry filters.
        </div>
        <CommandList v-else class="command-results-list">
          <div v-if="inlineGroups.length === 0" class="command-empty">No matching filters found.</div>
          <template v-for="(group, groupIndex) in inlineGroups" :key="group.key">
            <CommandGroup :heading="group.heading" class="command-group">
              <CommandItem
                v-for="item in group.items"
                :key="item.id"
                :value="item.id"
                class="command-item-row"
                @select="selectCommandItem(item)"
              >
                <div class="command-item-copy">
                  <span class="command-item-label">{{ item.value }}</span>
                  <span class="command-item-meta">{{ item.typeLabel }}</span>
                  <span class="command-item-search-text">{{ item.searchText }}</span>
                </div>
                <span class="command-item-count">{{ item.count.toLocaleString() }}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator v-if="groupIndex < inlineGroups.length - 1" class="command-separator" />
          </template>
        </CommandList>
      </div>
    </Command>
  </div>

  <CommandDialog :open="dialogOpen" @update:open="dialogOpen = $event">
    <div class="command-dialog-shell">
      <div class="command-dialog-header">
        <p class="command-palette-eyebrow">Command palette</p>
        <p class="command-dialog-copy">Search every filter dimension at once, then press Enter to apply.</p>
      </div>

      <CommandInput
        ref="dialogInput"
        placeholder="Search taxonomy, geography, and mimicry…"
        class="command-input command-dialog-input"
      />

      <CommandList class="command-dialog-list">
        <CommandEmpty class="command-empty">No matching filters found.</CommandEmpty>
        <template v-for="(group, groupIndex) in searchGroups" :key="`dialog-${group.key}`">
          <CommandGroup :heading="group.heading" class="command-group">
            <CommandItem
              v-for="item in group.items"
              :key="`dialog-${item.id}`"
              :value="item.id"
              class="command-item-row"
              @select="selectCommandItem(item)"
            >
              <div class="command-item-copy">
                <span class="command-item-label">{{ item.value }}</span>
                <span class="command-item-meta">{{ item.typeLabel }}</span>
                <span class="command-item-search-text">{{ item.searchText }} {{ group.heading }}</span>
              </div>
              <span class="command-item-count">{{ item.count.toLocaleString() }}</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator v-if="groupIndex < searchGroups.length - 1" class="command-separator" />
        </template>
      </CommandList>
    </div>
  </CommandDialog>
</template>

<style scoped>
.command-palette {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--color-border, #3d3d5c) 86%, white 14%);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(74, 222, 128, 0.08), transparent 48%),
    linear-gradient(135deg, rgba(59, 130, 246, 0.08), transparent 65%),
    var(--color-bg-secondary, #252540);
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.16);
}

.command-palette-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.command-palette-eyebrow {
  margin: 0 0 4px;
  color: var(--color-accent, #4ade80);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.command-palette-title {
  margin: 0;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.9rem;
  line-height: 1.4;
}

.command-palette-shortcut {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(74, 222, 128, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary, #aaa);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.command-palette-shortcut:hover {
  border-color: rgba(74, 222, 128, 0.4);
  color: var(--color-text-primary, #e0e0e0);
}

.command-palette-shortcut kbd {
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.12);
  color: var(--color-accent, #4ade80);
  font: inherit;
}

.command-surface {
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 12px;
  background: rgba(12, 16, 24, 0.34);
  backdrop-filter: blur(10px);
}

.command-inline-input-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  min-height: 50px;
  color: var(--color-text-muted, #666);
}

.command-inline-input-shell svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.command-inline-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.88rem;
  outline: none;
}

.command-inline-input::placeholder {
  color: var(--color-text-muted, #666);
}

.command-inline {
  overflow: visible;
}

.command-results-shell {
  position: absolute;
  z-index: 20;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-secondary, #252540) 92%, black 8%);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.command-results-list,
.command-dialog-list {
  max-height: 320px;
}

.command-inline-hint {
  padding: 16px 14px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
}

.command-dialog-shell {
  display: flex;
  flex-direction: column;
}

.command-dialog-header {
  padding: 16px 16px 0;
}

.command-dialog-copy {
  margin: 0;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
}

.command-dialog-input {
  margin-top: 10px;
}

.command-group :deep([cmdk-group-heading]) {
  color: var(--color-text-muted, #666);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.command-item-row {
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
}

.command-item-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.command-item-label {
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.84rem;
  font-weight: 600;
}

.command-item-meta {
  color: var(--color-text-muted, #666);
  font-size: 0.75rem;
}

.command-item-count {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.12);
  color: var(--color-accent, #4ade80);
  font-size: 0.75rem;
  font-weight: 700;
}

.command-item-search-text {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.command-empty {
  color: var(--color-text-secondary, #aaa);
}

.command-separator {
  background: rgba(255, 255, 255, 0.06);
}

@media (max-width: 560px) {
  .command-palette-header {
    flex-direction: column;
  }

  .command-palette-shortcut {
    align-self: flex-start;
  }
}
</style>
