<script setup>
import { CollapsibleRoot } from 'reka-ui'

const props = defineProps({
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
})

const emit = defineEmits(['update:open'])
</script>

<template>
  <CollapsibleRoot
    :default-open="defaultOpen"
    :open="open"
    :disabled="disabled"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </CollapsibleRoot>
</template>
