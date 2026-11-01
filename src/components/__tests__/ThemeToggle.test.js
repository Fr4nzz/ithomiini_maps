// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mounted = []
afterEach(() => {
  for (const { app, host } of mounted.splice(0)) { app.unmount(); host.remove() }
})
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
})

async function mount() {
  vi.resetModules()
  const pinia = createPinia()
  setActivePinia(pinia)
  const { default: Toggle } = await import('../ThemeToggleButton.vue')
  const { default: Switch } = await import('../ThemeModeSwitch.vue')
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ components: { Toggle, Switch }, template: '<Toggle /><Switch />' })
  app.use(pinia).mount(host)
  mounted.push({ app, host })
  return host
}

describe('sun/moon theme toggle', () => {
  it('shows the mode in effect, is pressed in dark, and says whether it is the system’s or a chosen one', async () => {
    const host = await mount()
    const button = () => host.querySelector('[data-theme-toggle]')
    expect(button().getAttribute('aria-pressed')).toBe('false')
    expect(button().title).toBe('Theme: light (system)')
    button().click()
    await nextTick()
    expect(button().getAttribute('aria-pressed')).toBe('true')
    expect(button().title).toBe('Theme: dark (chosen)')
    expect(button().getAttribute('aria-label')).toBe('Dark theme')
    expect(localStorage.getItem('atlas-theme-mode')).toBe('dark')
    button().click()
    await nextTick()
    expect(button().title).toBe('Theme: light (chosen)')
  })

  it('offers «Use the system theme» only while a choice is stored, and it goes back to System', async () => {
    const host = await mount()
    expect(host.querySelector('[data-theme-system]')).toBeNull()
    host.querySelector('[data-theme-toggle]').click()
    await nextTick()
    const item = host.querySelector('[data-theme-system]')
    expect(item.textContent).toContain('Use the system theme')
    item.click()
    await nextTick()
    expect(host.querySelector('[data-theme-system]')).toBeNull()
    expect(host.querySelector('[data-theme-toggle]').title).toBe('Theme: light (system)')
  })
})
