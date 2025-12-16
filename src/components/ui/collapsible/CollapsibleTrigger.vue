<script setup>
import { CollapsibleTrigger } from 'reka-ui'

const props = defineProps({
  asChild: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <CollapsibleTrigger :as-child="asChild">
    <slot />
  </CollapsibleTrigger>
</template>
