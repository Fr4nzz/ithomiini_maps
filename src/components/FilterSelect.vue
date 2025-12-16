<script setup>
/**
 * FilterSelect Component
 * Multi-select dropdown with search using shadcn Combobox
 */
import { Combobox } from '@/components/ui/combobox'

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
</script>

<template>
  <div class="mb-3">
    <label v-if="label" class="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
      {{ label }}
      <span v-if="showCount && options.length > 0" class="text-muted-foreground/70 font-normal">({{ options.length }})</span>
    </label>
    <Combobox
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :options="options"
      :placeholder="placeholder"
      :multiple="multiple"
      :disabled="disabled"
    />
  </div>
</template>
