<script setup>
import { TooltipRoot } from 'reka-ui'

const props = defineProps({
  defaultOpen: {
    type: Boolean,
    default: false,
  },
  open: {
    type: Boolean,
    default: undefined,
  },
  delayDuration: {
    type: Number,
    default: 200,
  },
})

const emit = defineEmits(['update:open'])
</script>

<template>
  <TooltipRoot
    :default-open="defaultOpen"
    :open="open"
    :delay-duration="delayDuration"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </TooltipRoot>
</template>
