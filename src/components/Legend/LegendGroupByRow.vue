<script setup>
import { Layers, Pencil, Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  groupBy: {
    type: String,
    default: 'species'
  },
  options: {
    type: Array,
    default: () => []
  },
  showHeaders: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:groupBy',
  'open-prefix-settings',
  'toggle-headers'
])

function handleGroupByChange(e) {
  emit('update:groupBy', e.target.value)
}
</script>

<template>
  <div
    v-show="visible"
    class="legend-groupby-row"
  >
    <!-- Group By dropdown -->
    <div class="groupby-select">
      <Layers :size="14" class="icon" />
      <span class="label">Group:</span>
      <select
        :value="groupBy"
        @change="handleGroupByChange"
        class="groupby-dropdown"
      >
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- Edit button for prefix settings -->
    <button
      class="row-button"
      @click="emit('open-prefix-settings')"
      title="Label prefix settings"
    >
      <Pencil :size="12" />
    </button>

    <!-- Headers visibility toggle -->
    <button
      class="row-button headers-toggle"
      :class="{ 'headers-hidden': !showHeaders }"
      @click="emit('toggle-headers')"
      :title="showHeaders ? 'Hide group headers' : 'Show group headers'"
    >
      <Eye v-if="showHeaders" :size="14" />
      <EyeOff v-else :size="14" />
    </button>
  </div>
</template>

<style scoped>
.legend-groupby-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-tertiary, rgba(255,255,255,0.02));
  font-size: 12px;
}

.groupby-select {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 2px 6px;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 4px;
}

.groupby-select .icon {
  color: var(--color-text-muted, #666);
  flex-shrink: 0;
}

.groupby-select .label {
  color: var(--color-text-secondary, #aaa);
  font-size: 11px;
  white-space: nowrap;
}

.groupby-dropdown {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  flex: 1;
  min-width: 0;
  outline: none;
}

.groupby-dropdown option {
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
}

.row-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.row-button:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
  color: var(--color-text-primary, #e0e0e0);
}

.headers-toggle.headers-hidden {
  color: var(--color-warning, #f59e0b);
  opacity: 0.7;
}

.headers-toggle.headers-hidden:hover {
  opacity: 1;
}
</style>
