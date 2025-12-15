<script setup>
/**
 * FilterSelect Component
 * Multi-select dropdown with fuzzy search using vue-multiselect
 */
import VueMultiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'

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

const updateValue = (val) => emit('update:modelValue', val)

const customLabel = (option) => {
  if (typeof option === 'object') return option.label || option.name || option.value
  return option
}
</script>

<template>
  <div class="mb-3">
    <label v-if="label" class="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
      {{ label }}
      <span v-if="showCount && options.length > 0" class="text-muted-foreground/70 font-normal">({{ options.length }})</span>
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
    >
      <template #noResult>
        <span class="block px-3 py-2.5 text-muted-foreground text-sm italic">No matching results</span>
      </template>
      <template #noOptions>
        <span class="block px-3 py-2.5 text-muted-foreground text-sm italic">No options available</span>
      </template>
    </VueMultiselect>
  </div>
</template>
