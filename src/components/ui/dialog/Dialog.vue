<script setup>
import { DialogRoot } from 'reka-ui'

const props = defineProps({
  defaultOpen: {
    type: Boolean,
    default: false,
  },
  open: {
    type: Boolean,
    default: undefined,
  },
  modal: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:open'])
</script>

<template>
  <DialogRoot
    :default-open="defaultOpen"
    :open="open"
    :modal="modal"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </DialogRoot>
</template>
