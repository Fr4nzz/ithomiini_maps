import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { themes, DEFAULT_THEME, DEFAULT_MODE, getTheme } from '../themes/presets'

// Get stored theme or default
function getStoredTheme() {
  try {
    return localStorage.getItem('app-theme') || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

// Get stored mode or default
function getStoredMode() {
  try {
    return localStorage.getItem('app-mode') || DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

export const useThemeStore = defineStore('theme', () => {
  // Current theme name (scientific, ocean, forest, sunset, lavender)
  const currentTheme = ref(getStoredTheme())

  // Current mode (light or dark)
  const currentMode = ref(getStoredMode())

  // Available themes (for UI)
  const availableThemes = themes

  // Computed: is dark mode
  const isDarkMode = computed(() => currentMode.value === 'dark')

  /**
   * Apply theme and mode by setting data attributes on document
   */
  function applyTheme() {
    const themeName = currentTheme.value
    const mode = currentMode.value

    const theme = getTheme(themeName)
    if (!theme) {
      console.warn(`Theme '${themeName}' not found, using default`)
      currentTheme.value = DEFAULT_THEME
    }

    // Store preferences
    try {
      localStorage.setItem('app-theme', currentTheme.value)
      localStorage.setItem('app-mode', currentMode.value)
    } catch {
      // Storage unavailable
    }

    // Apply data attributes to root - CSS handles the rest via selectors
    const root = document.documentElement
    root.setAttribute('data-theme', currentTheme.value)
    root.setAttribute('data-mode', currentMode.value)

    // Also set classes for potential CSS selectors
    const themeClasses = Object.keys(themes).map(t => `theme-${t}`)
    root.classList.remove(...themeClasses)
    root.classList.add(`theme-${currentTheme.value}`)

    // Set dark/light class
    root.classList.remove('dark', 'light')
    root.classList.add(currentMode.value)

    console.log(`Applied theme: ${currentTheme.value}, mode: ${currentMode.value}`)
  }

  /**
   * Set theme and apply it
   * @param {string} themeName - Name of the theme
   */
  function setTheme(themeName) {
    if (themes[themeName]) {
      currentTheme.value = themeName
      applyTheme()
    }
  }

  /**
   * Set mode (light or dark)
   * @param {string} mode - 'light' or 'dark'
   */
  function setMode(mode) {
    if (mode === 'light' || mode === 'dark') {
      currentMode.value = mode
      applyTheme()
    }
  }

  /**
   * Toggle between light and dark mode
   */
  function toggleMode() {
    currentMode.value = currentMode.value === 'dark' ? 'light' : 'dark'
    applyTheme()
  }

  /**
   * Cycle through available themes
   */
  function cycleTheme() {
    const themeNames = Object.keys(themes)
    const currentIndex = themeNames.indexOf(currentTheme.value)
    const nextIndex = (currentIndex + 1) % themeNames.length
    setTheme(themeNames[nextIndex])
  }

  /**
   * Get current theme object
   */
  function getCurrentThemeData() {
    return getTheme(currentTheme.value)
  }

  // Apply theme on initialization
  applyTheme()

  return {
    currentTheme,
    currentMode,
    isDarkMode,
    availableThemes,
    setTheme,
    setMode,
    toggleMode,
    applyTheme,
    cycleTheme,
    getCurrentThemeData
  }
})
