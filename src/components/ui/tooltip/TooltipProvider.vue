<script setup>
import { TooltipProvider } from 'reka-ui'

const props = defineProps({
  delayDuration: {
    type: Number,
    default: 200,
  },
  skipDelayDuration: {
    type: Number,
    default: 300,
  },
  disableHoverableContent: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <TooltipProvider
    :delay-duration="delayDuration"
    :skip-delay-duration="skipDelayDuration"
    :disable-hoverable-content="disableHoverableContent"
  >
    <slot />
  </TooltipProvider>
</template>
