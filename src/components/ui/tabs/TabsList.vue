<script setup>
import { TabsList } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <TabsList
    :class="
      cn(
        'inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1.5 text-muted-foreground',
        props.class
      )
    "
  >
    <slot />
  </TabsList>
</template>
