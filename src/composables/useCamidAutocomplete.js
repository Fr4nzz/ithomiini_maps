import { ref, computed } from 'vue'

/**
 * Composable for CAMID search with multi-value autocomplete functionality
 * @param {Object} store - The data store with filters and uniqueCamids
 * @returns {Object} Autocomplete state and handlers
 */
export function useCamidAutocomplete(store) {
  // Local state
  const camidInput = ref('')
  const camidTextarea = ref(null)
  const showCamidDropdown = ref(false)
  const selectedSuggestionIndex = ref(-1)
  const currentWordInfo = ref({ word: '', start: 0, end: 0 })
  let debounceTimer = null

  // Get the current word at cursor position for autocomplete
  const getCurrentWord = (text, cursorPos) => {
    // Find word boundaries (split by comma, space, newline)
    const beforeCursor = text.slice(0, cursorPos)
    const afterCursor = text.slice(cursorPos)

    // Find start of current word (last separator before cursor)
    const startMatch = beforeCursor.match(/[\s,\n]*([^\s,\n]*)$/)
    const wordStart = startMatch ? cursorPos - startMatch[1].length : cursorPos

    // Find end of current word (first separator after cursor)
    const endMatch = afterCursor.match(/^([^\s,\n]*)/)
    const wordEnd = cursorPos + (endMatch ? endMatch[1].length : 0)

    const word = text.slice(wordStart, wordEnd)
    return { word, start: wordStart, end: wordEnd }
  }

  // Filtered CAMID suggestions based on current word
  const camidSuggestions = computed(() => {
    const query = currentWordInfo.value.word.trim().toUpperCase()
    if (!query || query.length < 2) return []

    // Filter and limit to 15 suggestions for performance
    const matches = []
    for (const id of store.uniqueCamids) {
      if (id.toUpperCase().includes(query)) {
        matches.push(id)
        if (matches.length >= 15) break
      }
    }
    return matches
  })

  const handleCamidInput = (e) => {
    const textarea = e.target
    const value = textarea.value
    const cursorPos = textarea.selectionStart

    camidInput.value = value
    currentWordInfo.value = getCurrentWord(value, cursorPos)
    showCamidDropdown.value = currentWordInfo.value.word.length >= 2
    selectedSuggestionIndex.value = -1

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      store.filters.camidSearch = value.trim().toUpperCase()
    }, 300)
  }

  const selectCamid = (camid) => {
    const { start, end } = currentWordInfo.value
    const before = camidInput.value.slice(0, start)
    const after = camidInput.value.slice(end)

    // Insert selected CAMID, add separator if there's more text after
    const separator = after.trim() ? '' : ' '
    camidInput.value = before + camid + separator + after

    // Update the store filter
    store.filters.camidSearch = camidInput.value.trim().toUpperCase()

    showCamidDropdown.value = false
    selectedSuggestionIndex.value = -1

    // Focus back and position cursor after inserted CAMID
    if (camidTextarea.value) {
      const newCursorPos = start + camid.length + separator.length
      camidTextarea.value.focus()
      camidTextarea.value.setSelectionRange(newCursorPos, newCursorPos)
    }
  }

  const handleCamidKeydown = (e) => {
    // Update current word on cursor movement
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      setTimeout(() => {
        const textarea = e.target
        currentWordInfo.value = getCurrentWord(textarea.value, textarea.selectionStart)
        showCamidDropdown.value = currentWordInfo.value.word.length >= 2
      }, 0)
      return
    }

    if (!showCamidDropdown.value || camidSuggestions.value.length === 0) return

    if (e.key === 'ArrowDown' && !e.altKey) {
      e.preventDefault()
      selectedSuggestionIndex.value = Math.min(
        selectedSuggestionIndex.value + 1,
        camidSuggestions.value.length - 1
      )
    } else if (e.key === 'ArrowUp' && !e.altKey) {
      e.preventDefault()
      selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1)
    } else if (e.key === 'Enter' && selectedSuggestionIndex.value >= 0) {
      e.preventDefault()
      selectCamid(camidSuggestions.value[selectedSuggestionIndex.value])
    } else if (e.key === 'Tab' && camidSuggestions.value.length > 0) {
      e.preventDefault()
      const idx = selectedSuggestionIndex.value >= 0 ? selectedSuggestionIndex.value : 0
      selectCamid(camidSuggestions.value[idx])
    } else if (e.key === 'Escape') {
      showCamidDropdown.value = false
    }
  }

  const handleCamidBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      showCamidDropdown.value = false
    }, 150)
  }

  const handleCamidClick = (e) => {
    const textarea = e.target
    currentWordInfo.value = getCurrentWord(textarea.value, textarea.selectionStart)
    showCamidDropdown.value = currentWordInfo.value.word.length >= 2
  }

  return {
    // State
    camidInput,
    camidTextarea,
    showCamidDropdown,
    selectedSuggestionIndex,
    camidSuggestions,
    // Handlers
    handleCamidInput,
    selectCamid,
    handleCamidKeydown,
    handleCamidBlur,
    handleCamidClick
  }
}
