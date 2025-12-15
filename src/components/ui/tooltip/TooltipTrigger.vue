<script setup>
import { TooltipTrigger } from 'reka-ui'

const props = defineProps({
  asChild: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <TooltipTrigger :as-child="asChild">
    <slot />
  </TooltipTrigger>
</template>
