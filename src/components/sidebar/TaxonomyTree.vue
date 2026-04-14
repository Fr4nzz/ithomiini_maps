<script setup>
import { computed, ref, watch } from 'vue'
import { TreeItem, TreeRoot, useFilter } from 'reka-ui'
import { Check, ChevronDown, ChevronRight, Minus, Search, X } from 'lucide-vue-next'
import { useDataStore } from '../../stores/data'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

const store = useDataStore()

const searchTerm = ref('')
const expandedKeys = ref(new Set())
const expansionInitialized = ref(false)

const { contains } = useFilter({ sensitivity: 'base' })

const TAXONOMY_LEVELS = ['family', 'tribe', 'genus', 'species', 'subspecies']

const isValidTaxonomyValue = (value) => {
  if (!value) return false
  if (typeof value !== 'string') return false

  const cleaned = value.trim().toLowerCase()
  return cleaned &&
    cleaned !== 'unknown' &&
    cleaned !== 'na' &&
    cleaned !== 'nan' &&
    cleaned !== 'null' &&
    cleaned !== 'none'
}

const formatSubspeciesLabel = (scientificName, subspecies) => {
  if (!isValidTaxonomyValue(subspecies) || subspecies === scientificName) {
    return `${scientificName} · no named subspecies`
  }

  return `${scientificName} ${subspecies}`
}

const makeNode = (level, key, label, taxonomy, depth, parentKey = null) => ({
  key,
  label,
  searchLabel: `${label} ${TAXONOMY_LEVELS.filter(name => taxonomy[name]).map(name => taxonomy[name]).join(' ')}`,
  level,
  taxonomy,
  depth,
  parentKey,
  count: 0,
  children: [],
  childrenMap: new Map(),
  leafKeys: [],
})

const sortNodes = (nodes) => {
  nodes.sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }))
  for (const node of nodes) {
    if (node.children.length > 0) sortNodes(node.children)
  }
  return nodes
}

const finalizeNodes = (nodes) => {
  for (const node of nodes) {
    if (node.children.length === 0) {
      node.leafKeys = [node.key]
      continue
    }

    finalizeNodes(node.children)
    node.leafKeys = node.children.flatMap(child => child.leafKeys)
  }

  return nodes
}

const treeData = computed(() => {
  const features = Array.isArray(store.allFeatures) ? store.allFeatures : []
  const families = []
  const familyMap = new Map()

  for (const feature of features) {
    const family = isValidTaxonomyValue(feature.family) ? feature.family : 'Unknown family'
    const tribe = isValidTaxonomyValue(feature.tribe) ? feature.tribe : 'Unknown tribe'
    const genus = isValidTaxonomyValue(feature.genus) ? feature.genus : 'Unknown genus'
    const species = isValidTaxonomyValue(feature.scientific_name) ? feature.scientific_name : `${genus} sp.`
    const subspecies = isValidTaxonomyValue(feature.subspecies) ? feature.subspecies : species

    const familyKey = `family:${family}`
    const tribeKey = `tribe:${family}›${tribe}`
    const genusKey = `genus:${family}›${tribe}›${genus}`
    const speciesKey = `species:${family}›${tribe}›${genus}›${species}`
    const subspeciesKey = `subspecies:${family}›${tribe}›${genus}›${species}›${subspecies}`

    let familyNode = familyMap.get(familyKey)
    if (!familyNode) {
      familyNode = makeNode('family', familyKey, family, { family }, 0)
      familyMap.set(familyKey, familyNode)
      families.push(familyNode)
    }
    familyNode.count += 1

    let tribeNode = familyNode.childrenMap.get(tribeKey)
    if (!tribeNode) {
      tribeNode = makeNode('tribe', tribeKey, tribe, { family, tribe }, 1, familyKey)
      familyNode.childrenMap.set(tribeKey, tribeNode)
      familyNode.children.push(tribeNode)
    }
    tribeNode.count += 1

    let genusNode = tribeNode.childrenMap.get(genusKey)
    if (!genusNode) {
      genusNode = makeNode('genus', genusKey, genus, { family, tribe, genus }, 2, tribeKey)
      tribeNode.childrenMap.set(genusKey, genusNode)
      tribeNode.children.push(genusNode)
    }
    genusNode.count += 1

    let speciesNode = genusNode.childrenMap.get(speciesKey)
    if (!speciesNode) {
      speciesNode = makeNode('species', speciesKey, species, { family, tribe, genus, species }, 3, genusKey)
      genusNode.childrenMap.set(speciesKey, speciesNode)
      genusNode.children.push(speciesNode)
    }
    speciesNode.count += 1

    let subspeciesNode = speciesNode.childrenMap.get(subspeciesKey)
    if (!subspeciesNode) {
      subspeciesNode = makeNode(
        'subspecies',
        subspeciesKey,
        formatSubspeciesLabel(species, subspecies),
        { family, tribe, genus, species, subspecies },
        4,
        speciesKey,
      )
      speciesNode.childrenMap.set(subspeciesKey, subspeciesNode)
      speciesNode.children.push(subspeciesNode)
    }
    subspeciesNode.count += 1
  }

  return finalizeNodes(sortNodes(families))
})

const nodeMap = computed(() => {
  const map = new Map()
  const visit = (nodes) => {
    for (const node of nodes) {
      map.set(node.key, node)
      if (node.children.length > 0) visit(node.children)
    }
  }

  visit(treeData.value)
  return map
})

const allLeafKeys = computed(() => treeData.value.flatMap(node => node.leafKeys))

watch(treeData, (nodes) => {
  if (expansionInitialized.value) return
  expandedKeys.value = new Set(nodes.map(node => node.key))
  expansionInitialized.value = true
}, { immediate: true })

const selectedLeafKeys = computed(() => {
  const hasAnyTaxonomyFilter =
    store.filters.family !== 'All' ||
    store.filters.tribe !== 'All' ||
    store.filters.genus !== 'All' ||
    store.filters.species.length > 0 ||
    store.filters.subspecies.length > 0

  if (!hasAnyTaxonomyFilter) return new Set()

  const selectedSpecies = new Set(store.filters.species)
  const selectedSubspecies = new Set(store.filters.subspecies)
  const leaves = new Set()

  for (const leafKey of allLeafKeys.value) {
    const node = nodeMap.value.get(leafKey)
    if (!node) continue

    const { family, tribe, genus, species, subspecies } = node.taxonomy
    if (store.filters.family !== 'All' && family !== store.filters.family) continue
    if (store.filters.tribe !== 'All' && tribe !== store.filters.tribe) continue
    if (store.filters.genus !== 'All' && genus !== store.filters.genus) continue
    if (selectedSpecies.size > 0 && !selectedSpecies.has(species)) continue
    if (selectedSubspecies.size > 0 && !selectedSubspecies.has(subspecies)) continue

    leaves.add(leafKey)
  }

  return leaves
})

const selectedTreeNodes = computed({
  get: () => {
    if (selectedLeafKeys.value.size === 0) return []

    const selectedNodes = []
    const visit = (nodes) => {
      for (const node of nodes) {
        if (node.leafKeys.every(key => selectedLeafKeys.value.has(key))) selectedNodes.push(node)
        if (node.children.length > 0) visit(node.children)
      }
    }

    visit(treeData.value)
    return selectedNodes
  },
  set: (nodes) => {
    const nextLeafKeys = new Set()

    for (const node of nodes ?? []) {
      for (const leafKey of node.leafKeys ?? []) nextLeafKeys.add(leafKey)
    }

    const normalizedLeafKeys = [...nextLeafKeys]
      .map(key => nodeMap.value.get(key)?.taxonomy?.subspecies)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))

    if (normalizedLeafKeys.length === allLeafKeys.value.length) {
      store.filters.family = 'All'
      store.filters.tribe = 'All'
      store.filters.genus = 'All'
      store.filters.species = []
      store.filters.subspecies = []
      return
    }

    store.filters.family = 'All'
    store.filters.tribe = 'All'
    store.filters.genus = 'All'
    store.filters.species = []
    store.filters.subspecies = normalizedLeafKeys
  },
})

const selectionSummary = computed(() => {
  const count = selectedLeafKeys.value.size
  if (count === 0) return 'Browse full taxonomy hierarchy'
  if (count === 1) {
    const firstKey = selectedLeafKeys.value.values().next().value
    return nodeMap.value.get(firstKey)?.label ?? '1 taxon selected'
  }

  return `${count.toLocaleString()} taxa selected`
})

const selectedCountLabel = computed(() => {
  const count = selectedLeafKeys.value.size
  return count > 0 ? count.toLocaleString() : null
})

const searchQuery = computed(() => searchTerm.value.trim())

const searchState = computed(() => {
  if (!searchQuery.value) return null

  const visibleKeys = new Set()
  const autoExpandedKeys = new Set()

  const visit = (nodes) => {
    let branchMatched = false

    for (const node of nodes) {
      const selfMatched = contains(node.searchLabel, searchQuery.value)
      const childMatched = node.children.length > 0 ? visit(node.children) : false

      if (selfMatched || childMatched) {
        branchMatched = true
        visibleKeys.add(node.key)
        if (childMatched) autoExpandedKeys.add(node.key)
      }
    }

    return branchMatched
  }

  visit(treeData.value)

  return {
    visibleKeys,
    autoExpandedKeys,
  }
})

const getNodeKey = node => node.key

const isNodeExpanded = (node) => {
  if (searchState.value) return searchState.value.autoExpandedKeys.has(node.key)
  return expandedKeys.value.has(node.key)
}

const areAncestorsExpanded = (node) => {
  let currentKey = node.parentKey
  while (currentKey) {
    const currentNode = nodeMap.value.get(currentKey)
    if (!currentNode) return true
    if (!isNodeExpanded(currentNode)) return false
    currentKey = currentNode.parentKey
  }
  return true
}

const visibleItems = flattenItems => flattenItems.filter((item) => {
  const node = item.value
  if (searchState.value) return searchState.value.visibleKeys.has(node.key)
  return areAncestorsExpanded(node)
})

const toggleExpanded = (key) => {
  const next = new Set(expandedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedKeys.value = next
}

const handleArrowRight = (node) => {
  if (searchState.value || node.children.length === 0 || expandedKeys.value.has(node.key)) return
  toggleExpanded(node.key)
}

const handleArrowLeft = (node) => {
  if (searchState.value || node.children.length === 0 || !expandedKeys.value.has(node.key)) return
  toggleExpanded(node.key)
}

const clearSelection = () => {
  store.filters.family = 'All'
  store.filters.tribe = 'All'
  store.filters.genus = 'All'
  store.filters.species = []
  store.filters.subspecies = []
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <button class="taxonomy-trigger" type="button" :disabled="treeData.length === 0">
        <span class="taxonomy-trigger-copy">
          <span class="taxonomy-trigger-title">Searchable tree</span>
          <span class="taxonomy-trigger-summary">{{ selectionSummary }}</span>
        </span>
        <span v-if="selectedCountLabel" class="taxonomy-trigger-count">{{ selectedCountLabel }}</span>
        <ChevronDown class="taxonomy-trigger-icon" :size="16" />
      </button>
    </PopoverTrigger>

    <PopoverContent class="taxonomy-popover" align="start" :side-offset="8">
      <div class="taxonomy-shell">
        <div class="taxonomy-toolbar">
          <label class="taxonomy-search">
            <Search :size="14" />
            <input v-model="searchTerm" type="text" placeholder="Search family, genus, species...">
            <button v-if="searchTerm" type="button" class="taxonomy-search-clear" @click="searchTerm = ''">
              <X :size="14" />
            </button>
          </label>

          <button v-if="selectedLeafKeys.size > 0" type="button" class="taxonomy-clear" @click="clearSelection">
            Clear selection
          </button>
        </div>

        <div class="taxonomy-caption">
          <span>{{ treeData.length }} families</span>
          <span>·</span>
          <span>{{ allLeafKeys.length.toLocaleString() }} terminal taxa</span>
        </div>

        <TreeRoot
          v-slot="{ flattenItems }"
          v-model="selectedTreeNodes"
          :items="treeData"
          :get-key="getNodeKey"
          multiple
          propagate-select
          class="taxonomy-tree-root"
        >
          <div v-if="treeData.length === 0" class="taxonomy-empty-state">
            Taxonomy data will appear once records are loaded.
          </div>

          <div v-else-if="visibleItems(flattenItems).length === 0" class="taxonomy-empty-state">
            No matches for “{{ searchQuery }}”.
          </div>

          <div v-else class="taxonomy-tree-scroll">
            <TreeItem
              v-for="item in visibleItems(flattenItems)"
              :key="item._id ?? item.value.key"
              v-bind="item.bind"
              v-slot="{ handleSelect, isSelected, isIndeterminate }"
              class="taxonomy-tree-item"
              :style="{ '--tree-depth': item.value.depth }"
              @keydown.right.stop.prevent="handleArrowRight(item.value)"
              @keydown.left.stop.prevent="handleArrowLeft(item.value)"
            >
              <button
                type="button"
                class="taxonomy-expander"
                :class="{ hidden: item.value.children.length === 0 }"
                tabindex="-1"
                @click.stop="toggleExpanded(item.value.key)"
              >
                <ChevronRight v-if="item.value.children.length > 0 && !isNodeExpanded(item.value)" :size="14" />
                <ChevronDown v-else-if="item.value.children.length > 0" :size="14" />
              </button>

              <button
                type="button"
                class="taxonomy-checkbox"
                tabindex="-1"
                @click.stop="handleSelect"
              >
                <Check v-if="isSelected" :size="13" />
                <Minus v-else-if="isIndeterminate" :size="13" />
              </button>

              <div class="taxonomy-node-copy">
                <span class="taxonomy-node-label">{{ item.value.label }}</span>
                <span class="taxonomy-node-meta">
                  <span class="taxonomy-node-level">{{ item.value.level }}</span>
                  <span class="taxonomy-node-count">{{ item.value.count.toLocaleString() }}</span>
                </span>
              </div>
            </TreeItem>
          </div>
        </TreeRoot>
      </div>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.taxonomy-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(74, 222, 128, 0.08), rgba(15, 23, 42, 0.2)),
    var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.taxonomy-trigger:hover:not(:disabled) {
  border-color: rgba(74, 222, 128, 0.6);
  background:
    linear-gradient(135deg, rgba(74, 222, 128, 0.12), rgba(15, 23, 42, 0.24)),
    #353558;
}

.taxonomy-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.taxonomy-trigger-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}

.taxonomy-trigger-title {
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.taxonomy-trigger-summary {
  max-width: 100%;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #aaa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.taxonomy-trigger-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.16);
  color: var(--color-accent, #4ade80);
  font-size: 0.75rem;
  font-weight: 700;
}

.taxonomy-trigger-icon {
  flex-shrink: 0;
  color: var(--color-text-secondary, #aaa);
}

:deep(.taxonomy-popover) {
  width: min(32rem, calc(100vw - 3rem));
  padding: 0;
  overflow: hidden;
  border-color: rgba(74, 222, 128, 0.16);
  background:
    radial-gradient(circle at top left, rgba(74, 222, 128, 0.08), transparent 42%),
    var(--color-bg-primary, #161625);
}

.taxonomy-shell {
  display: flex;
  flex-direction: column;
}

.taxonomy-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.taxonomy-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 999px;
  background: rgba(6, 10, 20, 0.72);
  color: var(--color-text-secondary, #aaa);
}

.taxonomy-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.82rem;
}

.taxonomy-search input::placeholder {
  color: rgba(170, 170, 170, 0.75);
}

.taxonomy-search-clear,
.taxonomy-clear,
.taxonomy-expander,
.taxonomy-checkbox {
  border: none;
  outline: none;
  cursor: pointer;
}

.taxonomy-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: transparent;
  color: inherit;
}

.taxonomy-clear {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.1);
  color: var(--color-accent, #4ade80);
  font-size: 0.75rem;
  font-weight: 700;
}

.taxonomy-caption {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 10px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.taxonomy-tree-root {
  padding: 0 8px 8px;
}

.taxonomy-tree-scroll {
  max-height: min(26rem, 60vh);
  overflow: auto;
  padding: 0 6px 6px;
}

.taxonomy-tree-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
  padding: 8px 10px 8px calc(10px + (var(--tree-depth) * 18px));
  border-radius: 10px;
  color: var(--color-text-primary, #e0e0e0);
  transition: background 0.18s ease, color 0.18s ease;
}

.taxonomy-tree-item:hover,
.taxonomy-tree-item:focus-visible {
  background: rgba(255, 255, 255, 0.05);
}

.taxonomy-tree-item[data-selected],
.taxonomy-tree-item[data-state='checked'] {
  background: rgba(74, 222, 128, 0.08);
}

.taxonomy-expander {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary, #aaa);
}

.taxonomy-expander.hidden {
  visibility: hidden;
}

.taxonomy-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  color: var(--color-accent, #4ade80);
}

.taxonomy-node-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.taxonomy-node-label {
  min-width: 0;
  font-size: 0.8rem;
  line-height: 1.3;
}

.taxonomy-node-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.taxonomy-node-level {
  color: rgba(170, 170, 170, 0.72);
  font-size: 0.67rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.taxonomy-node-count {
  min-width: 2.25rem;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary, #aaa);
  font-size: 0.75rem;
  text-align: center;
}

.taxonomy-empty-state {
  padding: 18px 14px 16px;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  text-align: center;
}
</style>
