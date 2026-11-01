# Sun/moon toggle (1 Nov 2026)
- `ThemeToggleButton.vue` replaces the two separate sun/moon buttons (map header `.mode-toggle-btn`, table toolbar `.table-mode-toggle`): always the mode in effect, press = the other one, stored in `atlas-theme-mode`; aria-label «Dark theme» + aria-pressed (pressed = dark); tooltip «Theme: light|dark (system|chosen)»; the icon's turn is Caligo's ThemeToggle animation (own code, same organisation; no third-party licence), only on press, none under prefers-reduced-motion.
- `ThemeModeSwitch.vue` (palette menus) is now one item «Use the system theme», shown only while a choice is stored. System stays the default and follows the OS live (store unchanged).
- Tests: `components/__tests__/ThemeToggle.test.js`; store tests for toggle and OS change already existed. Tests, typecheck and build pass.
- Shots: /home/franz/.local/share/ui-overhaul-20261031/theme-shots/atlas-20261101T1608 (script ../scripts/themetoggle-atlas.mjs).
