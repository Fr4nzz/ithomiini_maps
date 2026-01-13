// Theme presets for Ithomiini Maps
// Each theme defines CSS variable values that are applied to :root

export const themes = {
  dark: {
    name: 'Dark Scientific',
    description: 'Default dark theme optimized for scientific data visualization',
    colors: {
      bgPrimary: '#1a1a2e',
      bgSecondary: '#252540',
      bgTertiary: '#2d2d4a',
      bgOverlay: 'rgba(26, 26, 46, 0.95)',
      border: '#3d3d5c',
      borderLight: '#4a4a6a',
      textPrimary: '#e0e0e0',
      textSecondary: '#aaa',
      textMuted: '#666',
      accent: '#4ade80',
      accentHover: '#5eeb94',
      accentSubtle: 'rgba(74, 222, 128, 0.1)',
      danger: '#ef4444',
      dangerHover: '#f87171',
      warning: '#f59e0b',
      info: '#3b82f6',
      success: '#10b981',
      // Shadow colors for dark theme
      shadowColor: 'rgba(0, 0, 0, 0.3)',
      shadowColorLight: 'rgba(0, 0, 0, 0.15)'
    }
  },

  light: {
    name: 'Light Mode',
    description: 'Clean light theme for bright environments',
    colors: {
      bgPrimary: '#f5f5f5',
      bgSecondary: '#ffffff',
      bgTertiary: '#e8e8e8',
      bgOverlay: 'rgba(255, 255, 255, 0.95)',
      border: '#d0d0d0',
      borderLight: '#e0e0e0',
      textPrimary: '#1a1a2e',
      textSecondary: '#555',
      textMuted: '#888',
      accent: '#10b981',
      accentHover: '#059669',
      accentSubtle: 'rgba(16, 185, 129, 0.1)',
      danger: '#dc2626',
      dangerHover: '#ef4444',
      warning: '#d97706',
      info: '#2563eb',
      success: '#059669',
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      shadowColorLight: 'rgba(0, 0, 0, 0.05)'
    }
  },

  ocean: {
    name: 'Ocean Blue',
    description: 'Cool blue-tinted dark theme inspired by the deep sea',
    colors: {
      bgPrimary: '#0f172a',
      bgSecondary: '#1e293b',
      bgTertiary: '#334155',
      bgOverlay: 'rgba(15, 23, 42, 0.95)',
      border: '#475569',
      borderLight: '#64748b',
      textPrimary: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textMuted: '#64748b',
      accent: '#38bdf8',
      accentHover: '#7dd3fc',
      accentSubtle: 'rgba(56, 189, 248, 0.1)',
      danger: '#f87171',
      dangerHover: '#fca5a5',
      warning: '#fbbf24',
      info: '#60a5fa',
      success: '#34d399',
      shadowColor: 'rgba(0, 0, 0, 0.4)',
      shadowColorLight: 'rgba(0, 0, 0, 0.2)'
    }
  },

  forest: {
    name: 'Forest Green',
    description: 'Natural green theme inspired by tropical forests',
    colors: {
      bgPrimary: '#14201a',
      bgSecondary: '#1c2b23',
      bgTertiary: '#243830',
      bgOverlay: 'rgba(20, 32, 26, 0.95)',
      border: '#3d5c4a',
      borderLight: '#4a6b58',
      textPrimary: '#e0ebe5',
      textSecondary: '#a0c0aa',
      textMuted: '#607860',
      accent: '#22c55e',
      accentHover: '#4ade80',
      accentSubtle: 'rgba(34, 197, 94, 0.1)',
      danger: '#ef4444',
      dangerHover: '#f87171',
      warning: '#eab308',
      info: '#06b6d4',
      success: '#22c55e',
      shadowColor: 'rgba(0, 0, 0, 0.35)',
      shadowColorLight: 'rgba(0, 0, 0, 0.18)'
    }
  },

  sunset: {
    name: 'Sunset',
    description: 'Warm theme with orange and purple tones',
    colors: {
      bgPrimary: '#1f1520',
      bgSecondary: '#2d1f2d',
      bgTertiary: '#3d2a3d',
      bgOverlay: 'rgba(31, 21, 32, 0.95)',
      border: '#5c3d5c',
      borderLight: '#6b4a6b',
      textPrimary: '#f5e6f0',
      textSecondary: '#c0a0b0',
      textMuted: '#806070',
      accent: '#f97316',
      accentHover: '#fb923c',
      accentSubtle: 'rgba(249, 115, 22, 0.1)',
      danger: '#ef4444',
      dangerHover: '#f87171',
      warning: '#fbbf24',
      info: '#a78bfa',
      success: '#4ade80',
      shadowColor: 'rgba(0, 0, 0, 0.35)',
      shadowColorLight: 'rgba(0, 0, 0, 0.18)'
    }
  }
}

// Default theme
export const DEFAULT_THEME = 'dark'

// Get theme by name with fallback to default
export function getTheme(name) {
  return themes[name] || themes[DEFAULT_THEME]
}

// Get list of available theme names
export function getThemeNames() {
  return Object.keys(themes)
}

// Get theme options for select dropdowns
export function getThemeOptions() {
  return Object.entries(themes).map(([key, theme]) => ({
    value: key,
    label: theme.name,
    description: theme.description
  }))
}
