<script setup>
import { DialogTrigger } from 'reka-ui'

const props = defineProps({
  asChild: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <DialogTrigger :as-child="asChild">
    <slot />
  </DialogTrigger>
</template>
