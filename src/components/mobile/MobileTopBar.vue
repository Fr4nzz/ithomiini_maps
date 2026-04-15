<script setup>
import { computed } from 'vue'
import { Menu, Search } from 'lucide-vue-next'
import { useDataStore } from '../../stores/data'

defineEmits(['open-menu', 'open-search'])

const store = useDataStore()

const recordCount = computed(() => store.filteredGeoJSON?.features?.length ?? 0)
const recordLabel = computed(() => `${recordCount.value.toLocaleString()} records`)
</script>

<template>
  <header class="mobile-top-bar">
    <button
      type="button"
      class="top-bar-button"
      aria-label="Open menu"
      @click="$emit('open-menu')"
    >
      <Menu :size="18" />
    </button>

    <div class="record-count" aria-live="polite">
      {{ recordLabel }}
    </div>

    <button
      type="button"
      class="top-bar-button"
      aria-label="Open search"
      @click="$emit('open-search')"
    >
      <Search :size="18" />
    </button>
  </header>
</template>

<style scoped>
.mobile-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  height: calc(44px + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 12px 0;
  background: rgba(26, 26, 46, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
}

.top-bar-button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary, #e0e0e0);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.top-bar-button:active {
  transform: scale(0.96);
}

.record-count {
  justify-self: center;
  min-width: 0;
  padding: 0 10px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
