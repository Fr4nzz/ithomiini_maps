<script setup>
defineProps({
  shape: {
    type: String,
    required: true,
    validator: (v) => ['circle', 'square', 'triangle', 'diamond', 'rhombus'].includes(v)
  },
  color: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 12
  },
  borderColor: {
    type: String,
    default: undefined
  },
  borderWidth: {
    type: Number,
    default: 0
  }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32">
    <!-- Circle -->
    <circle
      v-if="shape === 'circle'"
      cx="16" cy="16" r="12"
      :fill="color"
      :stroke="borderColor"
      :stroke-width="borderWidth * 2"
    />
    <!-- Square -->
    <rect
      v-else-if="shape === 'square'"
      x="5" y="5" width="22" height="22"
      :fill="color"
      :stroke="borderColor"
      :stroke-width="borderWidth * 2"
    />
    <!-- Triangle -->
    <polygon
      v-else-if="shape === 'triangle'"
      points="16,4 29,27 3,27"
      :fill="color"
      :stroke="borderColor"
      :stroke-width="borderWidth * 2"
    />
    <!-- Rhombus (Diamond) -->
    <polygon
      v-else-if="shape === 'rhombus' || shape === 'diamond'"
      points="16,4 28,16 16,28 4,16"
      :fill="color"
      :stroke="borderColor"
      :stroke-width="borderWidth * 2"
    />
  </svg>
</template>
