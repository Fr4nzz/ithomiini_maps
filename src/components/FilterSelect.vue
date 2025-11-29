<script setup>
/**
 * FilterSelect Component
 * Multi-select dropdown with fuzzy search using vue-multiselect
 * Matches the behavior of Wings Gallery filters
 */
import VueMultiselect from 'vue-multiselect'

const props = defineProps({
  label: String,
  modelValue: [String, Array, Object, null],
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select...' },
  multiple: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  showCount: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

const updateValue = (val) => {
  emit('update:modelValue', val)
}

// Custom label for options - handles both string and object options
const customLabel = (option) => {
  if (typeof option === 'object') {
    return option.label || option.name || option.value
  }
  return option
}
</script>

<template>
  <div class="filter-wrapper">
    <label v-if="label" class="filter-label">
      {{ label }}
      <span v-if="showCount && options.length > 0" class="option-count">
        ({{ options.length }})
      </span>
    </label>
    <VueMultiselect
      :model-value="modelValue"
      @update:model-value="updateValue"
      :options="options"
      :placeholder="placeholder"
      :multiple="multiple"
      :close-on-select="!multiple"
      :searchable="true"
      :show-labels="false"
      :custom-label="customLabel"
      :allow-empty="true"
      :disabled="disabled"
      :max-height="300"
      :options-limit="500"
      class="filter-multiselect"
    >
      <template #noResult>
        <span class="no-result">No matching results</span>
      </template>
      <template #noOptions>
        <span class="no-options">No options available</span>
      </template>
    </VueMultiselect>
  </div>
</template>

<style>
/* Import vue-multiselect CSS - this needs to be global */
@import 'vue-multiselect/dist/vue-multiselect.css';
</style>

<style scoped>
.filter-wrapper {
  margin-bottom: 12px;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted, #888);
  margin-bottom: 6px;
}

.option-count {
  color: var(--color-text-muted, #666);
  font-weight: 400;
}

/* Vue-multiselect customization for dark theme */
:deep(.multiselect__tags) {
  min-height: 38px;
  padding: 6px 40px 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border, #3d3d5c);
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
}

:deep(.multiselect__tags:hover) {
  border-color: #4d4d6d;
}

:deep(.multiselect--active .multiselect__tags) {
  border-color: var(--color-accent, #4ade80);
}

:deep(.multiselect__placeholder) {
  color: var(--color-text-muted, #666);
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
}

:deep(.multiselect__single) {
  background: transparent;
  color: var(--color-text-primary, #e0e0e0);
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
}

:deep(.multiselect__input) {
  background: transparent;
  color: var(--color-text-primary, #e0e0e0);
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
}

:deep(.multiselect__input::placeholder) {
  color: var(--color-text-muted, #666);
}

:deep(.multiselect__select) {
  height: 36px;
  padding: 4px 8px;
}

:deep(.multiselect__select:before) {
  border-color: var(--color-text-muted, #666) transparent transparent;
}

/* Dropdown content */
:deep(.multiselect__content-wrapper) {
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  max-height: 280px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

:deep(.multiselect__content) {
  max-height: none;
}

:deep(.multiselect__option) {
  padding: 10px 12px;
  min-height: auto;
  font-size: 0.85rem;
  color: var(--color-text-primary, #e0e0e0);
  background: transparent;
}

:deep(.multiselect__option--highlight) {
  background: var(--color-bg-tertiary, #2d2d4a);
  color: var(--color-text-primary, #e0e0e0);
}

:deep(.multiselect__option--selected) {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-accent, #4ade80);
  font-weight: 500;
}

:deep(.multiselect__option--selected.multiselect__option--highlight) {
  background: rgba(74, 222, 128, 0.25);
}

/* Multi-select tags */
:deep(.multiselect__tag) {
  background: var(--color-accent, #4ade80);
  color: var(--color-bg-primary, #1a1a2e);
  border-radius: 4px;
  padding: 4px 26px 4px 8px;
  margin-right: 4px;
  margin-bottom: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

:deep(.multiselect__tag-icon) {
  line-height: 20px;
}

:deep(.multiselect__tag-icon:after) {
  color: var(--color-bg-primary, #1a1a2e);
}

:deep(.multiselect__tag-icon:hover) {
  background: rgba(0, 0, 0, 0.2);
}

/* No results styling */
.no-result,
.no-options {
  display: block;
  padding: 10px 12px;
  color: var(--color-text-muted, #666);
  font-size: 0.85rem;
  font-style: italic;
}

/* Disabled state */
:deep(.multiselect--disabled .multiselect__tags) {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.multiselect--disabled .multiselect__select) {
  background: none;
}
</style>
