<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useMagicKeys } from '@vueuse/core'
import {
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
const dialogInput = ref(null)
const dialogOpen = ref(false)

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
    if (existing) { existing.count += 1; continue }
    options.set(value, { id: `${kind}:${value}`, value, kind, typeLabel: label, count: 1, lineage: lineageBuilder(feature), searchText: '' })
  }
  return Array.from(options.values())
    .map(item => ({ ...item, searchText: [item.value, item.typeLabel, item.lineage.family, item.lineage.tribe, item.lineage.genus, item.lineage.scientificName].filter(Boolean).join(' ').toLowerCase() }))
    .sort((a, b) => a.value.localeCompare(b.value))
}

const searchGroups = computed(() => {
  const features = store.allFeatures || []
  const taxonomy = [
    ...buildOptionMap(features, 'scientific_name', 'species', 'Species', f => ({ family: f.family, tribe: f.tribe, genus: f.genus, scientificName: f.scientific_name })),
    ...buildOptionMap(features, 'subspecies', 'subspecies', 'Subspecies', f => ({ family: f.family, tribe: f.tribe, genus: f.genus, scientificName: f.scientific_name, subspecies: f.subspecies })),
    ...buildOptionMap(features, 'genus', 'genus', 'Genus', f => ({ family: f.family, tribe: f.tribe, genus: f.genus })),
    ...buildOptionMap(features, 'tribe', 'tribe', 'Tribe', f => ({ family: f.family, tribe: f.tribe })),
    ...buildOptionMap(features, 'family', 'family', 'Family', f => ({ family: f.family })),
  ]
  const geography = buildOptionMap(features, 'country', 'country', 'Country')
  const mimicry = config.features.mimicrySelector ? buildOptionMap(features, 'mimicry_ring', 'mimicry', 'Ring') : []
  return [
    { key: 'taxonomy', heading: 'Taxonomy', items: taxonomy },
    { key: 'geography', heading: 'Geography', items: geography },
    { key: 'mimicry', heading: 'Mimicry', items: mimicry },
  ].filter(g => g.items.length > 0)
})

const setTaxonomyContext = (lineage = {}) => {
  if (lineage.family && store.filters.family !== lineage.family) store.filters.family = lineage.family
  if (lineage.tribe && store.filters.tribe !== lineage.tribe) store.filters.tribe = lineage.tribe
  if (lineage.genus && store.filters.genus !== lineage.genus) store.filters.genus = lineage.genus
}

const selectItem = (item) => {
  switch (item.kind) {
    case 'family': store.filters.family = item.value; break
    case 'tribe': if (item.lineage.family) store.filters.family = item.lineage.family; store.filters.tribe = item.value; break
    case 'genus': setTaxonomyContext(item.lineage); store.filters.genus = item.value; break
    case 'species': setTaxonomyContext(item.lineage); if (!store.filters.species.includes(item.value)) store.filters.species = [...store.filters.species, item.value]; break
    case 'subspecies': setTaxonomyContext(item.lineage); if (item.lineage.scientificName) store.filters.species = [item.lineage.scientificName]; store.filters.subspecies = [item.value]; break
    case 'country': store.filters.country = item.value; break
    case 'mimicry': if (!store.filters.mimicry.includes(item.value)) store.filters.mimicry = [...store.filters.mimicry, item.value]; break
  }
  dialogOpen.value = false
}

const keys = useMagicKeys({
  passive: false,
  onEventFired(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') event.preventDefault()
  },
})

watch(() => keys['Ctrl+K']?.value || keys['Meta+K']?.value, (pressed) => {
  if (!pressed) return
  dialogOpen.value = true
  nextTick(() => dialogInput.value?.focus?.())
})

defineExpose({ open: () => { dialogOpen.value = true } })
</script>

<template>
  <CommandDialog :open="dialogOpen" @update:open="dialogOpen = $event">
    <CommandInput
      ref="dialogInput"
      placeholder="Search species, genera, countries, mimicry rings..."
    />
    <CommandList class="cmd-list">
      <CommandEmpty>No matching filters found.</CommandEmpty>
      <template v-for="(group, i) in searchGroups" :key="group.key">
        <CommandGroup :heading="group.heading">
          <CommandItem
            v-for="item in group.items"
            :key="item.id"
            :value="item.searchText"
            class="cmd-item"
            @select="selectItem(item)"
          >
            <span class="cmd-label">{{ item.value }}</span>
            <span class="cmd-meta">{{ item.typeLabel }}</span>
            <span class="cmd-count">{{ item.count.toLocaleString() }}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator v-if="i < searchGroups.length - 1" />
      </template>
    </CommandList>
  </CommandDialog>
</template>

<style scoped>
.cmd-list { max-height: 400px; }
.cmd-item { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.cmd-label { font-weight: 500; color: var(--color-text-primary, #e0e0e0); }
.cmd-meta { font-size: 0.75rem; color: var(--color-text-muted, #666); }
.cmd-count { margin-left: auto; font-size: 0.75rem; padding: 2px 6px; border-radius: 999px; background: rgba(74, 222, 128, 0.12); color: var(--color-accent, #4ade80); font-weight: 600; }
</style>
