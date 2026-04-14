<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Bug,
  Image,
  Info,
  Map,
  Paintbrush,
  RefreshCw,
  Settings,
  Share2,
  Table2,
  X,
} from 'lucide-vue-next'

const props = defineProps({
  currentView: {
    type: String,
    default: 'map',
  },
})

const emit = defineEmits([
  'close',
  'change-view',
  'open-gallery',
  'open-mimicry',
  'open-export',
  'open-style',
  'open-settings',
  'open-update-database',
  'open-about',
])

const menuRef = ref(null)
const closeButtonRef = ref(null)
let previousFocusedElement = null

const navItems = [
  { key: 'map', label: 'Map View', icon: Map, action: () => emit('change-view', 'map') },
  { key: 'table', label: 'Table View', icon: Table2, action: () => emit('change-view', 'table') },
  { key: 'gallery', label: 'Gallery', icon: Image, action: () => emit('open-gallery') },
  { key: 'mimicry', label: 'Mimicry Rings', icon: Bug, action: () => emit('open-mimicry') },
  { key: 'sep-1', separator: true },
  { key: 'export', label: 'Export / Share', icon: Share2, action: () => emit('open-export') },
  { key: 'style', label: 'Map Style', icon: Paintbrush, action: () => emit('open-style') },
  { key: 'settings', label: 'Settings', icon: Settings, action: () => emit('open-settings') },
  { key: 'sep-2', separator: true },
  { key: 'update', label: 'Update Database', icon: RefreshCw, action: () => emit('open-update-database') },
  { key: 'about', label: 'About / Citation', icon: Info, action: () => emit('open-about') },
]

function getFocusableElements() {
  if (!menuRef.value) return []

  return Array.from(
    menuRef.value.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  )
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const activeElement = document.activeElement

  if (event.shiftKey && activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleNavigation(action) {
  action()
  emit('close')
}

function isActiveItem(itemKey) {
  return itemKey === props.currentView
}

onMounted(async () => {
  previousFocusedElement = document.activeElement
  document.addEventListener('keydown', handleKeydown)

  await nextTick()
  closeButtonRef.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  previousFocusedElement?.focus?.()
})
</script>

<template>
  <div
    ref="menuRef"
    class="hamburger-menu"
    role="dialog"
    aria-modal="true"
    aria-label="Mobile navigation menu"
    @click.self="emit('close')"
  >
    <div class="hamburger-menu__panel">
      <div class="hamburger-menu__header">
        <div>
          <p class="hamburger-menu__eyebrow">Navigation</p>
          <h2 class="hamburger-menu__title">Explore the atlas</h2>
        </div>

        <button
          ref="closeButtonRef"
          type="button"
          class="hamburger-menu__close"
          aria-label="Close navigation menu"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </div>

      <nav class="hamburger-menu__nav" aria-label="Mobile navigation">
        <template v-for="item in navItems" :key="item.key">
          <div v-if="item.separator" class="hamburger-menu__separator" aria-hidden="true" />

          <button
            v-else
            type="button"
            class="hamburger-menu__item"
            :class="{ 'is-active': isActiveItem(item.key) }"
            @click="handleNavigation(item.action)"
          >
            <span class="hamburger-menu__icon-wrap">
              <component :is="item.icon" :size="18" class="hamburger-menu__icon" />
            </span>
            <span class="hamburger-menu__label">{{ item.label }}</span>
            <span v-if="isActiveItem(item.key)" class="hamburger-menu__active-pill">Current</span>
          </button>
        </template>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.hamburger-menu {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  background:
    linear-gradient(180deg, rgba(4, 7, 16, 0.82) 0%, rgba(4, 7, 16, 0.72) 100%),
    rgba(0, 0, 0, 0.56);
  backdrop-filter: blur(10px);
}

.hamburger-menu__panel {
  position: relative;
  display: flex;
  width: min(86vw, 380px);
  max-width: 100%;
  height: 100%;
  flex-direction: column;
  gap: 20px;
  padding: calc(env(safe-area-inset-top, 0px) + 22px) 18px calc(env(safe-area-inset-bottom, 0px) + 24px);
  border-right: 1px solid color-mix(in srgb, var(--color-border, #3d3d5c) 78%, transparent);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent, #4ade80) 18%, transparent) 0%, transparent 38%),
    linear-gradient(165deg, color-mix(in srgb, var(--color-bg-secondary, #252540) 92%, black 8%) 0%, color-mix(in srgb, var(--color-bg-primary, #1a1a2e) 95%, black 5%) 100%);
  box-shadow: 20px 0 48px rgba(0, 0, 0, 0.34);
}

.hamburger-menu__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.hamburger-menu__eyebrow {
  margin: 0 0 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-accent, #4ade80);
}

.hamburger-menu__title {
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.1;
  color: var(--color-text-primary, #e0e0e0);
}

.hamburger-menu__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--color-border, #3d3d5c) 85%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-bg-tertiary, #2d2d4a) 86%, transparent);
  color: var(--color-text-primary, #e0e0e0);
}

.hamburger-menu__close:focus-visible,
.hamburger-menu__item:focus-visible {
  outline: 2px solid var(--color-accent, #4ade80);
  outline-offset: 2px;
}

.hamburger-menu__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 4px;
}

.hamburger-menu__separator {
  height: 1px;
  margin: 8px 4px;
  background: linear-gradient(90deg, transparent, var(--color-border, #3d3d5c), transparent);
}

.hamburger-menu__item {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: var(--color-text-secondary, #aaa);
  padding: 12px 14px;
  text-align: left;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.hamburger-menu__item:active {
  transform: scale(0.985);
}

.hamburger-menu__item:hover {
  border-color: color-mix(in srgb, var(--color-border, #3d3d5c) 88%, transparent);
  background: color-mix(in srgb, var(--color-bg-tertiary, #2d2d4a) 78%, transparent);
  color: var(--color-text-primary, #e0e0e0);
}

.hamburger-menu__item.is-active {
  border-color: color-mix(in srgb, var(--color-accent, #4ade80) 55%, transparent);
  background: color-mix(in srgb, var(--color-accent, #4ade80) 15%, var(--color-bg-tertiary, #2d2d4a));
  color: var(--color-text-primary, #e0e0e0);
}

.hamburger-menu__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-primary, #1a1a2e) 70%, transparent);
  color: inherit;
}

.hamburger-menu__label {
  flex: 1;
  font-size: 0.96rem;
  font-weight: 600;
}

.hamburger-menu__active-pill {
  padding: 5px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent, #4ade80) 20%, transparent);
  color: var(--color-accent, #4ade80);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
