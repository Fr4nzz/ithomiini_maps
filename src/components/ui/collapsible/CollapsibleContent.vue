<script setup>
import { CollapsibleContent } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <CollapsibleContent
    :class="cn('overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down', props.class)"
  >
    <slot />
  </CollapsibleContent>
</template>
