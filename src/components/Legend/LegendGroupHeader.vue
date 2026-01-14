<script setup>
import { computed } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  speciesName: {
    type: String,
    required: true
  },
  expanded: {
    type: Boolean,
    default: true
  },
  borderColor: {
    type: String,
    default: null
  },
  count: {
    type: Number,
    default: 0
  },
  dotSize: {
    type: Number,
    default: 10
  },
  isExportMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle'])

// Format species name for display (e.g., "Mechanitis polymnia" -> "M. polymnia")
const displayName = computed(() => {
  const parts = props.speciesName.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
  }
  return props.speciesName
})

// Style for species indicator dot
const indicatorStyle = computed(() => {
  const style = {
    width: props.dotSize + 'px',
    height: props.dotSize + 'px',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    border: `2px solid ${props.borderColor || 'var(--color-text-muted, #888)'}`,
    flexShrink: 0
  }
  return style
})
</script>

<template>
  <div
    class="legend-group-header"
    :class="{ 'is-export': isExportMode }"
    @click="emit('toggle')"
  >
    <component
      :is="expanded ? ChevronDown : ChevronRight"
      v-if="!isExportMode"
      class="expand-icon"
      :size="14"
    />
    <span
      class="species-indicator"
      :style="indicatorStyle"
    />
    <span class="species-name">{{ displayName }}</span>
    <span class="subspecies-count">({{ count }})</span>
  </div>
</template>

<style scoped>
.legend-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
  user-select: none;
}

.legend-group-header:hover {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.05));
}

.expand-icon {
  color: var(--color-text-muted, #888);
  flex-shrink: 0;
}

.species-indicator {
  display: inline-block;
}

.species-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary, #fff);
  font-style: italic;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subspecies-count {
  font-size: 11px;
  color: var(--color-text-muted, #888);
  flex-shrink: 0;
}

/* Export mode - cleaner, more compact */
.legend-group-header.is-export {
  padding: 2px 4px;
  cursor: default;
}

.legend-group-header.is-export:hover {
  background: transparent;
}

.legend-group-header.is-export .species-name {
  font-size: inherit;
}

.legend-group-header.is-export .subspecies-count {
  display: none;
}
</style>
