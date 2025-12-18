/**
 * Composable for modal state management
 */

import { ref } from 'vue'

/**
 * Create a single modal controller
 * @param {boolean} initialState - Initial open state
 * @returns {Object} Modal state and methods
 */
export function useModal(initialState = false) {
  const isOpen = ref(initialState)

  const open = () => { isOpen.value = true }
  const close = () => { isOpen.value = false }
  const toggle = () => { isOpen.value = !isOpen.value }

  return { isOpen, open, close, toggle }
}

/**
 * Create multiple modal controllers
 * @param {Array<string>} names - Array of modal names
 * @returns {Object} Object with modal controllers keyed by name
 */
export function useMultipleModals(names) {
  const modals = {}

  names.forEach(name => {
    modals[name] = useModal()
  })

  // Helper to close all modals
  modals.closeAll = () => {
    names.forEach(name => {
      modals[name].close()
    })
  }

  // Helper to check if any modal is open
  modals.isAnyOpen = () => {
    return names.some(name => modals[name].isOpen.value)
  }

  return modals
}
