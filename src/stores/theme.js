import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { themes, DEFAULT_THEME, getTheme } from '../themes/presets'

// Helper to convert camelCase to kebab-case
function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

// Get stored theme or default
function getStoredTheme() {
  try {
    return localStorage.getItem('app-theme') || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export const useThemeStore = defineStore('theme', () => {
  // Current theme name
  const currentTheme = ref(getStoredTheme())

  // Available themes (for UI)
  const availableThemes = themes

  /**
   * Apply a theme by setting CSS variables on :root
   * @param {string} themeName - Name of the theme to apply
   */
  function applyTheme(themeName) {
    const theme = getTheme(themeName)
    if (!theme) {
      console.warn(`Theme '${themeName}' not found, using default`)
      themeName = DEFAULT_THEME
    }

    currentTheme.value = themeName

    // Store preference
    try {
      localStorage.setItem('app-theme', themeName)
    } catch {
      // Storage unavailable
    }

    // Apply CSS variables to root
    const root = document.documentElement
    const themeColors = getTheme(themeName).colors

    Object.entries(themeColors).forEach(([key, value]) => {
      const cssVar = `--color-${kebabCase(key)}`
      root.style.setProperty(cssVar, value)
    })

    // Add theme class for potential CSS selectors
    // Remove old theme classes first
    const themeClasses = Object.keys(themes).map(t => `theme-${t}`)
    root.classList.remove(...themeClasses)
    root.classList.add(`theme-${themeName}`)

    console.log(`Applied theme: ${themeName}`)
  }

  /**
   * Set theme and apply it
   * @param {string} themeName - Name of the theme
   */
  function setTheme(themeName) {
    if (themes[themeName]) {
      applyTheme(themeName)
    }
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
  applyTheme(currentTheme.value)

  return {
    currentTheme,
    availableThemes,
    setTheme,
    applyTheme,
    cycleTheme,
    getCurrentThemeData
  }
})
