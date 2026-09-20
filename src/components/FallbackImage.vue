<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { notifyTierFailed } from '../utils/imageProxy'

const props = defineProps({
  candidates: {
    type: Array,
    default: () => [],
  },
  alt: {
    type: String,
    default: '',
  },
  loading: {
    type: String,
    default: 'lazy',
  },
})

const emit = defineEmits(['load', 'error'])

const currentUrl = ref('')
let loadAttempt = 0
let fallbackTimer = null
let activeProbes = []

const normalizedCandidates = computed(() => {
  const seen = new Set()
  return props.candidates.filter(url => {
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
})

function clearFallbackTimer() {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
}

function clearActiveProbes() {
  activeProbes.forEach(img => {
    img.onload = null
    img.onerror = null
    img.src = ''
  })
  activeProbes = []
}

function probeFallbacks(attemptId) {
  const remaining = normalizedCandidates.value.filter(url => url !== currentUrl.value)
  if (remaining.length === 0) return

  clearActiveProbes()
  let settled = false
  remaining.forEach(url => {
    const img = new Image()
    activeProbes.push(img)
    img.referrerPolicy = 'no-referrer'
    img.onload = () => {
      if (settled || attemptId !== loadAttempt) return
      settled = true
      clearActiveProbes()
      notifyTierFailed(currentUrl.value)
      currentUrl.value = url
    }
    img.onerror = () => notifyTierFailed(url)
    img.src = url
  })
}

function scheduleFallbackProbe(attemptId) {
  clearFallbackTimer()
  if (normalizedCandidates.value.length < 2) return
  fallbackTimer = setTimeout(() => probeFallbacks(attemptId), 3000)
}

function startLoad() {
  loadAttempt += 1
  clearFallbackTimer()
  clearActiveProbes()
  currentUrl.value = normalizedCandidates.value[0] || ''
  scheduleFallbackProbe(loadAttempt)
}

function onLoad(event) {
  clearFallbackTimer()
  clearActiveProbes()
  emit('load', event)
}

function onError(event) {
  notifyTierFailed(currentUrl.value)
  const idx = normalizedCandidates.value.indexOf(currentUrl.value)
  const nextUrl = normalizedCandidates.value[idx + 1]
  if (nextUrl) {
    currentUrl.value = nextUrl
    scheduleFallbackProbe(loadAttempt)
    return
  }
  clearFallbackTimer()
  clearActiveProbes()
  emit('error', event)
}

watch(normalizedCandidates, startLoad, { immediate: true })

onUnmounted(() => {
  loadAttempt += 1
  clearFallbackTimer()
  clearActiveProbes()
})
</script>

<template>
  <img
    v-if="currentUrl"
    :src="currentUrl"
    :alt="alt"
    :loading="loading"
    decoding="async"
    referrerpolicy="no-referrer"
    @load="onLoad"
    @error="onError"
  />
</template>
