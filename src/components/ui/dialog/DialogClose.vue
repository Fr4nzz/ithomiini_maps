<script setup>
import { DialogClose } from 'reka-ui'

const props = defineProps({
  asChild: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <DialogClose :as-child="asChild">
    <slot />
  </DialogClose>
</template>
