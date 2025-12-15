<script setup>
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [0],
  },
  defaultValue: {
    type: Array,
    default: () => [0],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  orientation: {
    type: String,
    default: 'horizontal',
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 100,
  },
  step: {
    type: Number,
    default: 1,
  },
  minStepsBetweenThumbs: {
    type: Number,
    default: 0,
  },
  class: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <SliderRoot
    :model-value="modelValue"
    :default-value="defaultValue"
    :disabled="disabled"
    :orientation="orientation"
    :min="min"
    :max="max"
    :step="step"
    :min-steps-between-thumbs="minStepsBetweenThumbs"
    :class="
      cn(
        'relative flex w-full touch-none select-none items-center',
        props.class
      )
    "
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SliderTrack
      class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20"
    >
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      v-for="(_, index) in modelValue"
      :key="index"
      class="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
