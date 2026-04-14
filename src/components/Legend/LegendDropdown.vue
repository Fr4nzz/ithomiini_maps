<script setup>
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { computePopupPosition } from '../../composables/usePopupPosition'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  groups: {
    type: Array,
    default: () => []
    // Array of { label: string, options: [{ value: string, label: string }] }
  }
})

const emit = defineEmits(['update:modelValue', 'open', 'close'])

const isOpen = ref(false)
const triggerRef = ref(null)
const panelRef = ref(null)
const panelStyle = ref({})

// Find the label of the currently selected option
const selectedLabel = computed(() => {
  for (const group of props.groups) {
    for (const opt of group.options) {
      if (opt.value === props.modelValue) return opt.label
    }
  }
  return props.modelValue || '—'
})

function toggleOpen(e) {
  e.stopPropagation()
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

function open() {
  if (isOpen.value || !triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const pos = computePopupPosition(rect, {
    placement: 'bottom',
    offset: 4,
    popupWidth: 180,
    popupHeight: 280
  })
  panelStyle.value = {
    left: pos.left,
    top: pos.top
  }
  isOpen.value = true
  emit('open')
  nextTick(() => {
    document.addEventListener('mousedown', handleClickOutside)
  })
}

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  emit('close')
  document.removeEventListener('mousedown', handleClickOutside)
}

function selectOption(value) {
  emit('update:modelValue', value)
  close()
}

function handleClickOutside(e) {
  if (panelRef.value && panelRef.value.contains(e.target)) return
  if (triggerRef.value && triggerRef.value.contains(e.target)) return
  close()
}

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})

defineExpose({ open, close, toggleOpen })
</script>

<template>
  <div class="legend-dropdown">
    <button
      ref="triggerRef"
      class="dropdown-trigger"
      @click="toggleOpen"
    >
      <span class="trigger-text">{{ selectedLabel }}</span>
      <ChevronDown :size="10" class="trigger-chevron" :class="{ open: isOpen }" />
    </button>

    <Teleport to="body">
      <Transition name="dropdown-fade">
        <div
          v-if="isOpen"
          ref="panelRef"
          class="legend-dropdown-panel"
          :style="panelStyle"
          @click.stop
        >
          <template v-for="(group, gi) in groups" :key="gi">
            <div v-if="group.label" class="dropdown-group-label">{{ group.label }}</div>
            <button
              v-for="opt in group.options"
              :key="opt.value"
              class="dropdown-option"
              :class="{ selected: opt.value === modelValue }"
              @click="selectOption(opt.value)"
            >
              {{ opt.label }}
            </button>
            <div v-if="group.label && gi < groups.length - 1" class="dropdown-divider" />
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.legend-dropdown {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: transparent;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 12px;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.15s ease;
  white-space: nowrap;
  max-width: 120px;
}

.dropdown-trigger:hover {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.05));
}

.trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted, #666);
  transition: transform 0.15s ease;
}

.trigger-chevron.open {
  transform: rotate(180deg);
}
</style>

<style>
/* Panel is teleported to body, so no scoped */
.legend-dropdown-panel {
  position: fixed;
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 3000;
  min-width: 160px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
}

.legend-dropdown-panel .dropdown-group-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #666);
  padding: 6px 10px 2px;
  user-select: none;
}

.legend-dropdown-panel .dropdown-option {
  display: block;
  width: 100%;
  padding: 5px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary, #aaa);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.1s ease;
}

.legend-dropdown-panel .dropdown-option:hover {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.08));
  color: var(--color-text-primary, #e0e0e0);
}

.legend-dropdown-panel .dropdown-option.selected {
  color: var(--color-accent, #4ade80);
  background: rgba(74, 222, 128, 0.1);
}

.legend-dropdown-panel .dropdown-divider {
  height: 1px;
  background: var(--color-border, #3d3d5c);
  margin: 4px 6px;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.12s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
}
</style>
