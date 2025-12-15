<script setup>
import { TabsRoot } from 'reka-ui'

const props = defineProps({
  defaultValue: {
    type: String,
    default: undefined,
  },
  modelValue: {
    type: String,
    default: undefined,
  },
  orientation: {
    type: String,
    default: 'horizontal',
  },
  activationMode: {
    type: String,
    default: 'automatic',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <TabsRoot
    :default-value="defaultValue"
    :model-value="modelValue"
    :orientation="orientation"
    :activation-mode="activationMode"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
  </TabsRoot>
</template>
