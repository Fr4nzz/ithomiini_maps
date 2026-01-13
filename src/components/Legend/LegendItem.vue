<script setup>
import { computed } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import LegendColorPicker from './LegendColorPicker.vue'
import LegendEditableLabel from './LegendEditableLabel.vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  defaultColor: {
    type: String,
    default: ''
  },
  customLabel: {
    type: String,
    default: ''
  },
  customColor: {
    type: String,
    default: ''
  },
  visible: {
    type: Boolean,
    default: true
  },
  editable: {
    type: Boolean,
    default: false
  },
  isExportMode: {
    type: Boolean,
    default: false
  },
  dotSize: {
    type: Number,
    default: 10
  },
  fontSize: {
    type: Number,
    default: 14
  }
})

const emit = defineEmits([
  'update:customLabel',
  'update:customColor',
  'toggle-visibility',
  'reset-color'
])

// The color to display (custom or original)
const displayColor = computed(() => props.customColor || props.color)

// The default color for reset
const originalColor = computed(() => props.defaultColor || props.color)

function handleColorUpdate(newColor) {
  emit('update:customColor', newColor)
}

function handleColorReset() {
  emit('reset-color')
}

function handleLabelUpdate(newLabel) {
  emit('update:customLabel', newLabel)
}

function toggleVisibility() {
  emit('toggle-visibility')
}
</script>

<template>
  <div
    class="legend-item"
    :class="{
      'is-hidden': !visible,
      'is-editable': editable && !isExportMode,
      'is-export': isExportMode
    }"
  >
    <!-- Color dot / picker -->
    <LegendColorPicker
      v-if="editable && !isExportMode"
      :color="displayColor"
      :default-color="originalColor"
      :size="dotSize"
      @update:color="handleColorUpdate"
      @reset="handleColorReset"
    />
    <span
      v-else
      class="legend-dot"
      :style="{
        backgroundColor: displayColor,
        width: dotSize + 'px',
        height: dotSize + 'px',
        boxShadow: `0 0 4px ${displayColor}`
      }"
    />

    <!-- Label -->
    <LegendEditableLabel
      v-if="editable && !isExportMode"
      :label="label"
      :custom-label="customLabel"
      :editable="editable"
      :font-size="fontSize"
      @update:custom-label="handleLabelUpdate"
    />
    <span
      v-else
      class="legend-label"
      :style="{ fontSize: fontSize + 'px' }"
      :title="label"
    >
      {{ customLabel || label }}
    </span>

    <!-- Visibility toggle (only in edit mode) -->
    <button
      v-if="editable && !isExportMode"
      class="visibility-toggle"
      :title="visible ? 'Hide from legend' : 'Show in legend'"
      @click.stop="toggleVisibility"
    >
      <Eye v-if="visible" :size="14" />
      <EyeOff v-else :size="14" />
    </button>
  </div>
</template>

<style scoped>
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  transition: opacity 0.2s ease;
}

.legend-item.is-hidden {
  opacity: 0.4;
}

.legend-item.is-editable:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.03));
  margin: 0 -8px;
  padding: 4px 8px;
  border-radius: 4px;
}

.legend-dot {
  flex-shrink: 0;
  border-radius: 50%;
}

.legend-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary, #e0e0e0);
}

.visibility-toggle {
  display: none;
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.legend-item.is-editable:hover .visibility-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
}

.visibility-toggle:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.1));
  color: var(--color-text-primary, #e0e0e0);
}

.legend-item.is-hidden .visibility-toggle {
  display: flex;
  color: var(--color-text-muted, #666);
}

/* Export mode - cleaner appearance */
.legend-item.is-export {
  padding: 2px 0;
}

.legend-item.is-export .legend-label {
  font-size: inherit;
}
</style>
