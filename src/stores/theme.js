import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { themes, DEFAULT_THEME, getTheme } from '../themes/presets'
import { log } from '../utils/logger'

/**
 * Palette (emerald, ocean…) and mode (light or dark).
 *
 * The mode follows the system unless the visitor picks Light or Dark; that choice is remembered on the
 * device whether or not «Remember Settings» is on. The palette is remembered only with «Remember
 * Settings», as before. The boot script in index.html sets the same attributes before the first paint,
 * so a reload in dark never flashes light: keep MODE_KEY and the page colours there in step with this file.
 */
export const MODE_KEY = 'atlas-theme-mode'
export const MODE_PREFS = ['system', 'light', 'dark']

/** A stored value; anything unknown means «follow the system». */
export const parseModePref = (stored) => (stored === 'light' || stored === 'dark' ? stored : 'system')
export const resolveMode = (pref, systemDark) => (pref === 'system' ? (systemDark ? 'dark' : 'light') : pref)

function isPersistenceEnabled() {
  try {
    const stored = localStorage.getItem('app-persist-enabled')
    return stored ? JSON.parse(stored) : false
  } catch {
    return false
  }
}

// persistence.saveAllState() writes the palette JSON-encoded, applyTheme() writes it plain.
function getStoredTheme() {
  try {
    if (!isPersistenceEnabled()) return DEFAULT_THEME
    const stored = (localStorage.getItem('app-theme') || '').replace(/"/g, '')
    return themes[stored] ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function getStoredModePref() {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    if (stored) return parseModePref(stored)
    // Before the mode had its own key it lived in app-mode, kept only with «Remember Settings».
    return isPersistenceEnabled() ? parseModePref(localStorage.getItem('app-mode')) : 'system'
  } catch {
    return 'system'
  }
}

const systemQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

/** The page colour of a palette in a mode: the boot screen, <html> and the browser bar. */
export const pageColour = (themeName, mode) => {
  const theme = getTheme(themeName)
  return mode === 'dark' ? theme.previewBgDark : theme.previewBgLight
}

export const useThemeStore = defineStore('theme', () => {
  // Current theme name (emerald, ocean, forest, sunset, lavender)
  const currentTheme = ref(getStoredTheme())

  // 'system', 'light' or 'dark'
  const modePref = ref(getStoredModePref())
  const systemDark = ref(!!systemQuery?.matches)

  // Current mode (light or dark)
  const currentMode = computed(() => resolveMode(modePref.value, systemDark.value))

  // Available themes (for UI)
  const availableThemes = themes

  // Computed: is dark mode
  const isDarkMode = computed(() => currentMode.value === 'dark')

  /**
   * Apply theme and mode by setting data attributes on document
   */
  function applyTheme() {
    if (!getTheme(currentTheme.value) || !themes[currentTheme.value]) {
      log.data.warn(`Theme '${currentTheme.value}' not found, using default`)
      currentTheme.value = DEFAULT_THEME
    }
    const mode = currentMode.value

    if (isPersistenceEnabled()) {
      try {
        localStorage.setItem('app-theme', currentTheme.value)
      } catch {
        // Storage unavailable
      }
    }

    // Apply data attributes to root - CSS handles the rest via selectors
    const root = document.documentElement
    root.setAttribute('data-theme', currentTheme.value)
    root.setAttribute('data-mode', mode)

    // Also set classes for potential CSS selectors
    const themeClasses = Object.keys(themes).map(t => `theme-${t}`)
    root.classList.remove(...themeClasses)
    root.classList.add(`theme-${currentTheme.value}`)

    // Set dark/light class
    root.classList.remove('dark', 'light')
    root.classList.add(mode)

    // Native controls, the page behind the app and the browser bar follow the mode too.
    const colour = pageColour(currentTheme.value, mode)
    root.style.colorScheme = mode
    root.style.backgroundColor = colour
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colour)
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
   * Follow the system, or keep light or dark; remembered on this device.
   * @param {'system'|'light'|'dark'} pref
   */
  function setModePref(pref) {
    if (!MODE_PREFS.includes(pref)) return
    modePref.value = pref
    try {
      // «system» is stored too: a missing key would fall back to the legacy app-mode on reload.
      localStorage.setItem(MODE_KEY, pref)
    } catch {
      // Private mode without storage: the choice lasts for the visit.
    }
  }

  /**
   * Set mode (light or dark)
   * @param {string} mode - 'light' or 'dark'
   */
  function setMode(mode) {
    if (mode === 'light' || mode === 'dark') setModePref(mode)
  }

  /**
   * Toggle between light and dark mode
   */
  function toggleMode() {
    setModePref(currentMode.value === 'dark' ? 'light' : 'dark')
  }

  // Synchronous, so the attributes (and the CSS variables) are on the page before anything that
  // watches currentMode reads them.
  watch(currentMode, applyTheme, { flush: 'sync' })

  systemQuery?.addEventListener?.('change', (event) => { systemDark.value = event.matches })
  if (typeof window !== 'undefined') {
    // Changed in another tab
    window.addEventListener('storage', (event) => {
      if (event.key === MODE_KEY) modePref.value = parseModePref(event.newValue)
    })
  }

  // Apply theme on initialization
  applyTheme()

  return {
    currentTheme,
    currentMode,
    modePref,
    isDarkMode,
    availableThemes,
    setTheme,
    setMode,
    setModePref,
    toggleMode,
    applyTheme
  }
})
