<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  minWidth: {
    type: Number,
    default: 150
  },
  maxWidth: {
    type: Number,
    default: 400
  },
  minHeight: {
    type: Number,
    default: 100
  },
  maxHeight: {
    type: Number,
    default: 600
  }
})

const emit = defineEmits(['resize-start', 'resize', 'resize-end'])

const isResizing = ref(false)
const startPos = ref({ x: 0, y: 0 })
const startSize = ref({ width: 0, height: 0 })

function handleMouseDown(e) {
  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  startPos.value = { x: e.clientX, y: e.clientY }

  // Get current size from parent
  const parent = e.target.closest('.legend-container')
  if (parent) {
    startSize.value = {
      width: parent.offsetWidth,
      height: parent.offsetHeight
    }
  }

  emit('resize-start', startSize.value)

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e) {
  if (!isResizing.value) return

  const deltaX = e.clientX - startPos.value.x
  const deltaY = e.clientY - startPos.value.y

  const newWidth = Math.min(
    props.maxWidth,
    Math.max(props.minWidth, startSize.value.width + deltaX)
  )

  const newHeight = Math.min(
    props.maxHeight,
    Math.max(props.minHeight, startSize.value.height + deltaY)
  )

  emit('resize', { width: newWidth, height: newHeight })
}

function handleMouseUp() {
  if (isResizing.value) {
    isResizing.value = false
    emit('resize-end')
  }

  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// Touch support
function handleTouchStart(e) {
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
      target: e.target
    })
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 1 && isResizing.value) {
    const touch = e.touches[0]
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    })
  }
}

function handleTouchEnd() {
  handleMouseUp()
}

onMounted(() => {
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
})
</script>

<template>
  <div
    class="resize-handle"
    :class="{ 'is-resizing': isResizing }"
    @mousedown="handleMouseDown"
    @touchstart.prevent="handleTouchStart"
  >
    <svg
      viewBox="0 0 10 10"
      class="resize-icon"
    >
      <path
        d="M 8 2 L 2 8 M 8 5 L 5 8 M 8 8 L 8 8"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  </div>
</template>

<style scoped>
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #666);
  border-radius: 0 0 8px 0;
  transition: all 0.15s ease;
  z-index: 5;
}

.resize-handle:hover {
  color: var(--color-text-secondary, #aaa);
  background: var(--color-bg-tertiary, rgba(255,255,255,0.05));
}

.resize-handle.is-resizing {
  color: var(--color-accent, #4ade80);
}

.resize-icon {
  width: 10px;
  height: 10px;
}
</style>
