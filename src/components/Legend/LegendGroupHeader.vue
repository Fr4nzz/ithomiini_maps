<script setup>
import { ref, computed, nextTick } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { SHAPE_OPTIONS } from '../../utils/shapes'

const props = defineProps({
  speciesName: {
    type: String,
    required: true
  },
  abbreviation: {
    type: String,
    default: ''
  },
  abbreviationVisible: {
    type: Boolean,
    default: true
  },
  customLabel: {
    type: String,
    default: ''
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
  },
  headersHidden: {
    type: Boolean,
    default: false
  },
  isLegendHovered: {
    type: Boolean,
    default: false
  },
  shape: {
    type: String,
    default: 'circle'
  }
})

const emit = defineEmits([
  'open-style-popup',
  'show-headers',
  'update:abbreviation',
  'update:abbreviation-visible',
  'update:custom-label'
])

// Editing states
const isEditingAbbrev = ref(false)
const isEditingName = ref(false)
const editAbbrevInput = ref(null)
const editNameInput = ref(null)
const tempAbbrev = ref('')
const tempName = ref('')

// Format species name for display (e.g., "Mechanitis polymnia" -> "M. polymnia")
const displayName = computed(() => {
  // Use custom label if set
  if (props.customLabel) return props.customLabel

  const parts = props.speciesName.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
  }
  return props.speciesName
})

// Style for species indicator dot/shape
const indicatorStyle = computed(() => {
  const style = {
    width: props.dotSize + 'px',
    height: props.dotSize + 'px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
  return style
})

// Get shape icon character
const shapeIcon = computed(() => {
  const shape = SHAPE_OPTIONS.find(s => s.value === props.shape)
  return shape ? shape.icon : '●'
})

// Shape color (border color or default)
const shapeColor = computed(() => props.borderColor || 'var(--color-text-muted, #888)')

// Should show clickable indicator (when legend is hovered and not in export mode)
const showClickableIndicator = computed(() =>
  props.isLegendHovered && !props.isExportMode
)

// Handle indicator click (open style popup)
function handleIndicatorClick(e) {
  e.stopPropagation()
  emit('open-style-popup', e)
}

// Handle show headers click
function handleShowHeaders(e) {
  e.stopPropagation()
  emit('show-headers')
}

// Start editing abbreviation
function startEditAbbrev(e) {
  e.stopPropagation()
  tempAbbrev.value = props.abbreviation
  isEditingAbbrev.value = true
  nextTick(() => {
    editAbbrevInput.value?.focus()
    editAbbrevInput.value?.select()
  })
}

// Finish editing abbreviation
function finishEditAbbrev() {
  if (tempAbbrev.value !== props.abbreviation) {
    emit('update:abbreviation', tempAbbrev.value)
  }
  isEditingAbbrev.value = false
}

// Cancel editing abbreviation
function cancelEditAbbrev() {
  isEditingAbbrev.value = false
}

// Toggle abbreviation visibility
function toggleAbbrevVisibility(e) {
  e.stopPropagation()
  emit('update:abbreviation-visible', !props.abbreviationVisible)
}

// Start editing species name
function startEditName(e) {
  e.stopPropagation()
  tempName.value = props.customLabel || props.speciesName
  isEditingName.value = true
  nextTick(() => {
    editNameInput.value?.focus()
    editNameInput.value?.select()
  })
}

// Finish editing species name
function finishEditName() {
  // Only emit if changed from original
  const newName = tempName.value.trim()
  if (newName !== props.speciesName) {
    emit('update:custom-label', newName)
  } else {
    emit('update:custom-label', '') // Reset to default
  }
  isEditingName.value = false
}

// Cancel editing species name
function cancelEditName() {
  isEditingName.value = false
}
</script>

<template>
  <div
    class="legend-group-header"
    :class="{
      'is-export': isExportMode,
      'is-hidden': headersHidden,
      'is-hovered': isLegendHovered
    }"
  >
    <!-- Clickable style indicator (visible on hover) -->
    <button
      v-if="showClickableIndicator"
      class="style-indicator-button"
      :style="indicatorStyle"
      @click="handleIndicatorClick"
      title="Click to customize styling for this group"
    >
      <span class="shape-icon" :style="{ color: shapeColor }">{{ shapeIcon }}</span>
    </button>
    <!-- Static indicator (when not hovered or hidden headers) -->
    <span
      v-else-if="!headersHidden || isLegendHovered"
      class="species-indicator"
      :style="{
        ...indicatorStyle,
        borderRadius: shape === 'circle' ? '50%' : '2px',
        backgroundColor: 'transparent',
        border: `2px solid ${shapeColor}`
      }"
    />

    <!-- Abbreviation (editable, with eye toggle) -->
    <span
      v-if="!headersHidden"
      class="abbreviation-container"
      :class="{ 'is-disabled': !abbreviationVisible }"
    >
      <!-- Editing mode -->
      <input
        v-if="isEditingAbbrev"
        ref="editAbbrevInput"
        v-model="tempAbbrev"
        type="text"
        class="abbrev-input"
        @blur="finishEditAbbrev"
        @keydown.enter="finishEditAbbrev"
        @keydown.escape="cancelEditAbbrev"
        @click.stop
      />
      <!-- Display mode -->
      <span
        v-else
        class="abbreviation"
        :class="{ 'is-editable': isLegendHovered && !isExportMode }"
        @click="isLegendHovered && !isExportMode && startEditAbbrev($event)"
        :title="isLegendHovered ? 'Click to edit abbreviation' : ''"
      >
        {{ abbreviation }}
      </span>

      <!-- Eye toggle for abbreviation visibility -->
      <button
        v-if="isLegendHovered && !isExportMode"
        class="abbrev-eye-toggle"
        @click="toggleAbbrevVisibility"
        :title="abbreviationVisible ? 'Hide prefix for subspecies' : 'Show prefix for subspecies'"
      >
        <Eye v-if="abbreviationVisible" :size="10" />
        <EyeOff v-else :size="10" />
      </button>
    </span>

    <!-- Species name (editable, greyed when headers hidden) -->
    <span class="species-name-container">
      <!-- Editing mode -->
      <input
        v-if="isEditingName"
        ref="editNameInput"
        v-model="tempName"
        type="text"
        class="name-input"
        @blur="finishEditName"
        @keydown.enter="finishEditName"
        @keydown.escape="cancelEditName"
        @click.stop
      />
      <!-- Display mode -->
      <span
        v-else
        class="species-name"
        :class="{
          'is-greyed': headersHidden,
          'is-editable': isLegendHovered && !isExportMode
        }"
        @click="isLegendHovered && !isExportMode && startEditName($event)"
        :title="isLegendHovered ? 'Click to edit name' : ''"
      >
        {{ displayName }}
      </span>
    </span>

    <!-- Count badge -->
    <span class="subspecies-count">({{ count }})</span>

    <!-- Show headers button (when headers are hidden and legend is hovered) -->
    <button
      v-if="headersHidden && isLegendHovered && !isExportMode"
      class="show-headers-button"
      @click="handleShowHeaders"
      title="Show group headers"
    >
      <EyeOff :size="12" />
    </button>
  </div>
</template>

<style scoped>
.legend-group-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
  user-select: none;
}

.legend-group-header:hover {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.05));
}

/* Hidden headers mode */
.legend-group-header.is-hidden {
  padding: 2px 8px;
}

.legend-group-header.is-hidden:hover {
  background: transparent;
}

/* Only show on hover when hidden */
.legend-group-header.is-hidden:not(.is-hovered) {
  display: none;
}

.legend-group-header.is-hidden.is-hovered {
  display: flex;
  opacity: 0.6;
}

.species-indicator {
  display: inline-block;
}

/* Clickable style indicator button */
.style-indicator-button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.style-indicator-button:hover {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
  transform: scale(1.1);
}

.shape-icon {
  font-size: 14px;
  line-height: 1;
}

/* Abbreviation container */
.abbreviation-container {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.abbreviation-container.is-disabled {
  opacity: 0.4;
}

.abbreviation {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted, #888);
  font-style: italic;
  padding: 1px 3px;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.abbreviation.is-editable {
  cursor: pointer;
}

.abbreviation.is-editable:hover {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
  color: var(--color-text-secondary, #aaa);
}

.abbrev-input {
  width: 50px;
  font-size: 11px;
  font-weight: 500;
  font-style: italic;
  padding: 1px 4px;
  border: 1px solid var(--color-accent, #4ade80);
  border-radius: 3px;
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
  outline: none;
}

.abbrev-eye-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  border-radius: 3px;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.abbrev-eye-toggle:hover {
  opacity: 1;
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
  color: var(--color-text-secondary, #aaa);
}

/* Species name container */
.species-name-container {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-start;
}

.species-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary, #fff);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1px 3px;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.species-name.is-greyed {
  color: var(--color-text-muted, #888);
  font-weight: 400;
}

.species-name.is-editable {
  cursor: pointer;
}

.species-name.is-editable:hover {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
}

.name-input {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  font-style: italic;
  padding: 1px 4px;
  border: 1px solid var(--color-accent, #4ade80);
  border-radius: 3px;
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
  outline: none;
  min-width: 0;
}

.subspecies-count {
  font-size: 11px;
  color: var(--color-text-muted, #888);
  flex-shrink: 0;
}

/* Show headers button */
.show-headers-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: transparent;
  border: none;
  color: var(--color-warning, #f59e0b);
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.show-headers-button:hover {
  opacity: 1;
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
}

/* Export mode - cleaner, more compact */
.legend-group-header.is-export {
  padding: 2px 4px;
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
