<script setup>
import { computed, inject, watch } from 'vue'
import { useDataStore } from '@/stores/data'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import FilterTab from '@/components/sidebar/FilterTab.vue'
import CommandPalette from '@/components/sidebar/CommandPalette.vue'

const emit = defineEmits(['open-mimicry', 'snap-change'])

const mobileLayout = inject('mobileLayout', null)
const store = useDataStore()

const SNAP_POINTS = [0.15, 0.5, 0.9]
const GBIF_CHILDREN = ['iNaturalist', 'GBIF (UNAM)', 'GBIF (Other Institutions)']

const sheetOpen = computed({
  get: () => mobileLayout?.activeSheet?.value === 'filter',
  set: (value) => {
    if (!mobileLayout) return
    if (value) {
      mobileLayout.activeSheet.value = 'filter'
      if (!SNAP_POINTS.includes(mobileLayout.sheetSnapPoint.value)) {
        mobileLayout.sheetSnapPoint.value = 0.5
      }
      return
    }
    mobileLayout.closeSheet()
  },
})

const activeSnapPoint = computed({
  get: () => mobileLayout?.sheetSnapPoint?.value ?? 0.15,
  set: (value) => {
    if (!mobileLayout || typeof value !== 'number') return
    mobileLayout.sheetSnapPoint.value = value
  },
})

const isPeek = computed(() => activeSnapPoint.value <= 0.15)
const isHalf = computed(() => activeSnapPoint.value > 0.15 && activeSnapPoint.value < 0.9)
const isFull = computed(() => activeSnapPoint.value >= 0.9)

const filteredRecords = computed(() => store.filteredGeoJSON?.features?.length ?? 0)
const totalRecords = computed(() => store.allFeatures.length)

const parsedCamidCount = computed(() => {
  if (!store.filters.camidSearch) return 0
  return store.filters.camidSearch
    .split(/[\s,\n]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .length
})

const goatFilterCount = computed(() => {
  let count = 0
  if (store.filters.goatCoverage !== 'all') count += 1
  count += store.filters.goatDataSource.length
  if (store.filters.goatChromosomeMin != null) count += 1
  if (store.filters.goatChromosomeMax != null) count += 1
  return count
})

const activeFilterCount = computed(() => {
  let count = 0
  if (parsedCamidCount.value) count += parsedCamidCount.value
  count += store.filters.species.length
  count += store.filters.subspecies.length
  count += store.filters.mimicry.length
  count += store.filters.status.length
  if (store.filters.family !== 'All') count += 1
  if (store.filters.tribe !== 'All') count += 1
  if (store.filters.genus !== 'All') count += 1
  if (!(store.filters.source.length === 1 && store.filters.source[0] === 'Sanger Institute')) count += store.filters.source.length
  if (store.filters.country !== 'All') count += 1
  if (store.filters.sex !== 'all') count += 1
  if (store.filters.dateStart) count += 1
  if (store.filters.dateEnd) count += 1
  count += goatFilterCount.value
  if (store.boundingBox) count += 1
  return count
})

const sourceOptions = computed(() => {
  const counts = new Map()

  for (const feature of store.allFeatures) {
    counts.set(feature.source, (counts.get(feature.source) ?? 0) + 1)
  }

  return store.uniqueSources
    .filter(source => !GBIF_CHILDREN.includes(source))
    .map(source => ({
      value: source,
      kind: 'source',
      count: counts.get(source) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
})

const statusOptions = computed(() => {
  const counts = new Map()

  for (const feature of store.allFeatures) {
    counts.set(feature.sequencing_status, (counts.get(feature.sequencing_status) ?? 0) + 1)
  }

  return store.uniqueStatuses
    .map(status => ({
      value: status,
      kind: 'status',
      count: counts.get(status) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
})

const quickFilterChips = computed(() => [...statusOptions.value, ...sourceOptions.value])

const isChipActive = (chip) => {
  if (chip.kind === 'status') return store.filters.status.includes(chip.value)
  if (chip.kind === 'source') return store.filters.source.includes(chip.value)
  return false
}

const toggleChip = (chip) => {
  if (chip.kind === 'status') {
    store.filters.status = store.filters.status.includes(chip.value)
      ? store.filters.status.filter(value => value !== chip.value)
      : [...store.filters.status, chip.value]
    return
  }

  if (chip.kind === 'source') {
    store.filters.source = store.filters.source.includes(chip.value)
      ? store.filters.source.filter(value => value !== chip.value)
      : [...store.filters.source, chip.value]
  }
}

watch(activeSnapPoint, (value) => {
  emit('snap-change', value)
})
</script>

<template>
  <Drawer
    v-model:open="sheetOpen"
    v-model:active-snap-point="activeSnapPoint"
    :snap-points="SNAP_POINTS"
    :modal="false"
    direction="bottom"
    should-scale-background="false"
  >
    <DrawerOverlay class="mobile-filter-sheet-overlay" />

    <DrawerContent
      class="mobile-filter-sheet"
      :class="{ 'mobile-filter-sheet--full': isFull }"
      @pointer-down-outside.prevent
      @interact-outside.prevent
    >
      <div class="mobile-filter-sheet__body">
        <section v-show="isPeek" class="mobile-filter-sheet__state mobile-filter-sheet__state--peek">
          <div class="mobile-filter-sheet__hero">
            <p class="mobile-filter-sheet__eyebrow">Filters ready</p>
            <h2>Swipe up to filter</h2>
            <p>
              {{ activeFilterCount }} active · {{ filteredRecords.toLocaleString() }} of {{ totalRecords.toLocaleString() }} records
            </p>
          </div>
        </section>

        <section v-show="isHalf" class="mobile-filter-sheet__state mobile-filter-sheet__state--half">
          <div class="mobile-filter-sheet__intro">
            <div>
              <p class="mobile-filter-sheet__eyebrow">Quick search</p>
              <h2>Dial in the map without losing context</h2>
            </div>
            <span class="mobile-filter-sheet__summary">{{ activeFilterCount }} active</span>
          </div>

          <CommandPalette />

          <div class="mobile-filter-sheet__quick-filters">
            <div class="mobile-filter-sheet__quick-header">
              <h3>Most used filters</h3>
              <span>{{ filteredRecords.toLocaleString() }} matching</span>
            </div>

            <div class="mobile-filter-sheet__chip-grid">
              <button
                v-for="chip in quickFilterChips"
                :key="`${chip.kind}:${chip.value}`"
                type="button"
                class="mobile-filter-sheet__chip"
                :class="{ 'is-active': isChipActive(chip) }"
                @click="toggleChip(chip)"
              >
                <span class="mobile-filter-sheet__chip-label">{{ chip.value }}</span>
                <span class="mobile-filter-sheet__chip-meta">{{ chip.count.toLocaleString() }}</span>
              </button>
            </div>
          </div>
        </section>

        <section v-show="isFull" class="mobile-filter-sheet__state mobile-filter-sheet__state--full">
          <FilterTab @open-mimicry="emit('open-mimicry')" />
        </section>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.mobile-filter-sheet-overlay {
  background: transparent;
  pointer-events: none;
}

.mobile-filter-sheet {
  max-height: 92dvh;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;
  border-radius: 24px 24px 0 0;
  background: rgba(26, 26, 46, 0.88);
  backdrop-filter: blur(16px);
  box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.3);
  color: hsl(var(--foreground));
}

.mobile-filter-sheet--full {
  background: hsl(var(--card));
  backdrop-filter: none;
}

.mobile-filter-sheet__body {
  overflow-y: auto;
  max-height: calc(92dvh - 18px);
  padding: 0 16px 24px;
}

.mobile-filter-sheet__state {
  min-height: 100%;
}

.mobile-filter-sheet__state--peek {
  padding: 10px 4px 18px;
}

.mobile-filter-sheet__hero,
.mobile-filter-sheet__intro {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}

.mobile-filter-sheet__hero {
  align-items: start;
  flex-direction: column;
}

.mobile-filter-sheet__eyebrow {
  margin: 0 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-accent, #4ade80);
}

.mobile-filter-sheet__hero h2,
.mobile-filter-sheet__intro h2 {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.15;
  color: var(--color-text-primary, #e0e0e0);
}

.mobile-filter-sheet__hero p:last-child,
.mobile-filter-sheet__summary,
.mobile-filter-sheet__quick-header span {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-text-secondary, #aaaaaa);
}

.mobile-filter-sheet__state--half {
  display: grid;
  gap: 14px;
  padding-bottom: 8px;
}

.mobile-filter-sheet__summary {
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  white-space: nowrap;
}

.mobile-filter-sheet__quick-filters {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.mobile-filter-sheet__quick-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mobile-filter-sheet__quick-header h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-primary, #e0e0e0);
}

.mobile-filter-sheet__chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.mobile-filter-sheet__chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary, #e0e0e0);
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.mobile-filter-sheet__chip:active {
  transform: scale(0.98);
}

.mobile-filter-sheet__chip.is-active {
  border-color: color-mix(in srgb, var(--color-accent, #4ade80) 55%, white);
  background: color-mix(in srgb, var(--color-accent, #4ade80) 18%, transparent);
}

.mobile-filter-sheet__chip-label {
  font-size: 0.84rem;
  font-weight: 600;
}

.mobile-filter-sheet__chip-meta {
  font-size: 0.76rem;
  color: var(--color-text-secondary, #aaaaaa);
}

.mobile-filter-sheet__state--full {
  padding-bottom: 12px;
}

:deep(.mobile-filter-sheet__state--full .filter-tab) {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

:deep(.mobile-filter-sheet > .mx-auto.mt-4.h-2.w-\[100px\].rounded-full.bg-muted) {
  width: 54px;
  height: 5px;
  margin-top: 14px;
  margin-bottom: 10px;
  background: rgba(148, 163, 184, 0.72);
}

@media (max-width: 380px) {
  .mobile-filter-sheet__intro,
  .mobile-filter-sheet__quick-header {
    align-items: start;
    flex-direction: column;
  }
}
</style>
