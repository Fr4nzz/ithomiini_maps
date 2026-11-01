<script setup>
// System / Light / Dark, shown at the top of the palette menus. The choice is remembered on this
// device (stores/theme.js); System follows the operating system's setting.
import { Monitor, Sun, Moon } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
const options = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]
</script>

<template>
  <div class="mode-switch" role="radiogroup" aria-label="Colour mode">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="themeStore.modePref === option.value"
      :class="{ active: themeStore.modePref === option.value }"
      @click.stop="themeStore.setModePref(option.value)"
    >
      <component :is="option.icon" class="mode-switch-icon" aria-hidden="true" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 2px;
  margin-bottom: 6px;
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
}

.mode-switch button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 32px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.mode-switch button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.mode-switch button.active {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.mode-switch button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

.mode-switch-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

@media (pointer: coarse) {
  .mode-switch button {
    min-height: 44px;
  }
}
</style>
