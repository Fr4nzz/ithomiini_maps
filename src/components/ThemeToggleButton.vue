<script setup>
// Sun/moon button: always the mode in effect; a press picks the other one and remembers it on this
// device (stores/theme.js). System is the default and the way back is the palette menu's
// «Use the system theme» (ThemeModeSwitch.vue). The icon's turn is the one on Caligo's ThemeToggle
// (rapidspeciation/caligo, same organisation), played on each press only and not under reduced motion.
import { nextTick, ref } from 'vue'
import { Sun, Moon } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
const flipped = ref(false)

const title = () => `Theme: ${themeStore.isDarkMode ? 'dark' : 'light'} (${themeStore.modePref === 'system' ? 'system' : 'chosen'})`

function toggle() {
  themeStore.toggleMode()
  flipped.value = false
  // The flag is cleared when the turn ends (or at once under reduced motion), so an OS swap later does not replay it.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  nextTick(() => { flipped.value = true })
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :class="{ 'is-flipped': flipped, 'is-light': !themeStore.isDarkMode }"
    :title="title()"
    aria-label="Dark theme"
    :aria-pressed="themeStore.isDarkMode"
    data-theme-toggle
    @click="toggle"
    @animationend="flipped = false"
  >
    <Moon v-if="themeStore.isDarkMode" class="mode-icon" aria-hidden="true" />
    <Sun v-else class="mode-icon" aria-hidden="true" />
  </button>
</template>

<style scoped>
.mode-icon {
  width: var(--theme-toggle-icon-size, 18px);
  height: var(--theme-toggle-icon-size, 18px);
  color: var(--theme-toggle-icon, var(--color-accent-text));
}

.theme-toggle.is-flipped .mode-icon {
  animation: theme-turn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes theme-turn {
  from { transform: rotate(-90deg) scale(0.6); opacity: 0; }
  to { transform: none; opacity: 1; }
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .theme-toggle.is-flipped .mode-icon { animation: none; }
}
</style>
