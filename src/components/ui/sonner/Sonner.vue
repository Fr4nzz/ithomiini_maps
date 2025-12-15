<script setup>
import { Toaster as Sonner } from 'vue-sonner'

const props = defineProps({
  position: {
    type: String,
    default: 'bottom-right',
  },
  expand: {
    type: Boolean,
    default: false,
  },
  richColors: {
    type: Boolean,
    default: true,
  },
  closeButton: {
    type: Boolean,
    default: false,
  },
  duration: {
    type: Number,
    default: 4000,
  },
})
</script>

<template>
  <Sonner
    class="toaster group"
    :position="position"
    :expand="expand"
    :rich-colors="richColors"
    :close-button="closeButton"
    :duration="duration"
    :toast-options="{
      classes: {
        toast:
          'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-muted-foreground',
        actionButton:
          'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
        cancelButton:
          'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
      },
    }"
  />
</template>
