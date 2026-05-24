<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: [String, Number],
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: 'Search...',
  },
  monospace: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const search = ref('')
const isOpen = ref(false)

const selectedOption = computed(() =>
  props.options.find(option => String(option.value) === String(props.modelValue))
)

watch(selectedOption, (option) => {
  if (!isOpen.value) search.value = option?.label || ''
}, { immediate: true })

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query || query === selectedOption.value?.label?.toLowerCase()) {
    return props.options.slice(0, 80)
  }
  return props.options
    .filter(option => {
      const haystack = [
        option.label,
        option.meta,
        option.searchText,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query)
    })
    .slice(0, 80)
})

function open() {
  isOpen.value = true
  if (!selectedOption.value || search.value === selectedOption.value.label) {
    search.value = ''
  }
}

function closeSoon() {
  window.setTimeout(() => {
    isOpen.value = false
    search.value = selectedOption.value?.label || ''
  }, 120)
}

function selectOption(option) {
  emit('update:modelValue', option?.value || null)
  search.value = option?.label || ''
  isOpen.value = false
}
</script>

<template>
  <div class="gallery-search-select" :class="{ open: isOpen, monospace }">
    <input
      :value="search"
      :placeholder="selectedOption?.label || placeholder"
      class="gallery-search-input"
      @focus="open"
      @input="search = $event.target.value; isOpen = true"
      @blur="closeSoon"
      @keydown.esc.prevent="isOpen = false"
    />
    <svg class="select-caret" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m7 10 5 5 5-5z"/>
    </svg>
    <div v-if="isOpen" class="gallery-search-menu">
      <button
        v-for="option in filteredOptions"
        :key="option.value"
        type="button"
        class="gallery-search-option"
        :class="{ selected: String(option.value) === String(modelValue) }"
        @mousedown.prevent="selectOption(option)"
      >
        <span class="option-label">{{ option.label }}</span>
        <span v-if="option.meta" class="option-meta">{{ option.meta }}</span>
      </button>
      <div v-if="filteredOptions.length === 0" class="gallery-search-empty">
        No matching results
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-search-select {
  position: relative;
}

.gallery-search-input {
  width: 100%;
  padding: 8px 28px 8px 10px;
  background: #252540;
  border: 1px solid #3d3d5c;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.8rem;
  font-style: italic;
  cursor: text;
  transition: all 0.2s;
}

.monospace .gallery-search-input {
  font-family: monospace;
  font-style: normal;
}

.gallery-search-input:hover {
  border-color: #5d5d7c;
}

.gallery-search-input:focus {
  outline: none;
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

.select-caret {
  position: absolute;
  right: 8px;
  top: 50%;
  width: 16px;
  height: 16px;
  color: #9ca3af;
  pointer-events: none;
  transform: translateY(-50%);
}

.gallery-search-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  background: #20203a;
  border: 1px solid #3d3d5c;
  border-radius: 6px;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
}

.gallery-search-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #e0e0e0;
  text-align: left;
  cursor: pointer;
}

.gallery-search-option:hover,
.gallery-search-option.selected {
  background: rgba(74, 222, 128, 0.12);
}

.option-label {
  font-size: 0.8rem;
}

.option-meta {
  color: #9ca3af;
  font-size: 0.68rem;
}

.gallery-search-empty {
  padding: 10px;
  color: #888;
  font-size: 0.76rem;
  font-style: italic;
}
</style>
