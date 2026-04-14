<script setup>
import { computed, inject } from 'vue'
import { Filter, PaintBucket, MoreHorizontal } from 'lucide-vue-next'
import { useDataStore } from '../../stores/data'

defineEmits(['open-filter', 'open-legend', 'open-more'])

const mobileLayout = inject('mobileLayout', null)
const store = useDataStore()

const isVisible = computed(() => mobileLayout?.showActionBar?.value ?? true)

const activeFilterCount = computed(() => {
  const filters = store.filters
  if (!filters) return 0

  let count = 0
  if (filters.family !== 'All') count += 1
  if (filters.tribe !== 'All') count += 1
  if (filters.genus !== 'All') count += 1
  if (filters.species.length > 0) count += 1
  if (filters.subspecies.length > 0) count += 1
  if (filters.mimicry.length > 0) count += 1
  if (filters.status.length > 0) count += 1
  if (filters.source.length !== 1 || filters.source[0] !== 'Sanger Institute') count += 1
  if (filters.sex !== 'all') count += 1
  if (filters.country !== 'All') count += 1
  if (filters.camidSearch) count += 1
  if (filters.dateStart || filters.dateEnd) count += 1
  if (filters.goatCoverage !== 'all') count += 1
  if (filters.goatDataSource.length > 0) count += 1
  if (filters.goatChromosomeMin != null || filters.goatChromosomeMax != null) count += 1

  return count
})

const pills = [
  { label: 'Filter', icon: Filter, event: 'open-filter' },
  { label: 'Legend', icon: PaintBucket, event: 'open-legend' },
  { label: 'More', icon: MoreHorizontal, event: 'open-more' },
]
</script>

<template>
  <div
    class="mobile-action-bar"
    :class="{ 'mobile-action-bar--hidden': !isVisible }"
    aria-label="Mobile actions"
  >
    <button
      v-for="pill in pills"
      :key="pill.label"
      type="button"
      class="action-pill"
      @click="$emit(pill.event)"
    >
      <component :is="pill.icon" :size="16" />
      <span>{{ pill.label }}</span>
      <span
        v-if="pill.label === 'Filter' && activeFilterCount > 0"
        class="filter-badge"
        aria-label="Active filters"
      >
        {{ activeFilterCount > 9 ? '9+' : activeFilterCount }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.mobile-action-bar {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 10;
  display: flex;
  gap: 8px;
  justify-content: center;
  width: calc(100% - 24px);
  transform: translateX(-50%);
  transition: opacity 0.22s ease, transform 0.22s ease;
  pointer-events: auto;
}

.mobile-action-bar--hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
  pointer-events: none;
}

.action-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(26, 26, 46, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
  transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.action-pill:active {
  transform: translateY(1px) scale(0.98);
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}
</style>
