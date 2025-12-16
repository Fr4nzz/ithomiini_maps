<script setup>
import { SelectRoot } from 'reka-ui'

const props = defineProps({
  defaultValue: {
    type: String,
    default: undefined,
  },
  modelValue: {
    type: String,
    default: undefined,
  },
  defaultOpen: {
    type: Boolean,
    default: false,
  },
  open: {
    type: Boolean,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    default: undefined,
  },
})

const emit = defineEmits(['update:modelValue', 'update:open'])
</script>

<template>
  <SelectRoot
    :default-value="defaultValue"
    :model-value="modelValue"
    :default-open="defaultOpen"
    :open="open"
    :disabled="disabled"
    :required="required"
    :name="name"
    @update:model-value="emit('update:modelValue', $event)"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </SelectRoot>
</template>
