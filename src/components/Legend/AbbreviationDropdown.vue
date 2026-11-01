<script setup>
import { ref, computed, nextTick } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Check } from 'lucide-vue-next'
import { generateAbbreviationOptions } from '../../utils/abbreviations'

const props = defineProps({
  speciesName: {
    type: String,
    required: true
  },
  currentValue: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'displayName', // 'displayName' or 'prefix'
    validator: (v) => ['displayName', 'prefix'].includes(v)
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  }
})

const emit = defineEmits(['select', 'apply-to-all', 'close'])

const dropdownRef = ref(null)
const customInputRef = ref(null)
const isCustomMode = ref(false)
const customValue = ref('')

// Generate abbreviation options for this species
const abbreviationOptions = computed(() => {
  return generateAbbreviationOptions(props.speciesName)
})

// Define format options based on type
const formatOptions = computed(() => {
  const opts = abbreviationOptions.value

  if (props.type === 'prefix') {
    return [
      { value: 'fullSpecies', label: opts.fullSpecies, description: 'Full species name' },
      { value: 'firstLetterGenus', label: opts.firstLetterGenus, description: '1st letter + epithet' },
      { value: 'syllableGenus', label: opts.syllableGenus, description: '1st syllable + epithet' },
      { value: 'firstLetterBoth', label: opts.firstLetterBoth, description: '1st letter of each' },
      { value: 'syllableBoth', label: opts.syllableBoth, description: '1st syllable of each' },
      { value: 'none', label: '(none)', description: 'No prefix' },
      { value: 'custom', label: 'Custom...', description: 'Enter manually', isCustom: true }
    ]
  } else {
    // displayName
    return [
      { value: 'firstLetterGenus', label: opts.firstLetterGenus, description: '1st letter + epithet' },
      { value: 'syllableGenus', label: opts.syllableGenus, description: '1st syllable + epithet' },
      { value: 'full', label: opts.full, description: 'Full name' },
      { value: 'custom', label: 'Custom...', description: 'Enter manually', isCustom: true }
    ]
  }
})

// Check which option matches current value
const currentFormat = computed(() => {
  for (const opt of formatOptions.value) {
    if (opt.value !== 'custom' && opt.label === props.currentValue) {
      return opt.value
    }
  }
  // If no match, it's a custom value
  return 'custom'
})

// Position style
const positionStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`
}))

// Handle option click
function handleOptionClick(option) {
  if (option.isCustom) {
    isCustomMode.value = true
    customValue.value = props.currentValue
    nextTick(() => {
      customInputRef.value?.focus()
      customInputRef.value?.select()
    })
  } else {
    // Emit both the value and the format key for "apply to all"
    emit('select', { value: option.label, format: option.value })
  }
}

// Handle apply to all for a preset format
function handleApplyToAll(option) {
  if (!option.isCustom) {
    emit('apply-to-all', option.value)
  }
}

// Handle custom value submit
function handleCustomSubmit() {
  const trimmed = customValue.value.trim()
  if (trimmed) {
    emit('select', { value: trimmed, format: 'custom' })
  }
  isCustomMode.value = false
}

// Handle custom cancel
function handleCustomCancel() {
  isCustomMode.value = false
}

// Handle keydown in custom input
function handleCustomKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleCustomSubmit()
  } else if (e.key === 'Escape') {
    handleCustomCancel()
  }
}

onClickOutside(dropdownRef, () => {
  emit('close')
}, { event: 'mousedown' })
</script>

<template>
  <Teleport to="body">
    <div
      ref="dropdownRef"
      class="abbreviation-dropdown"
      :style="positionStyle"
      @click.stop
    >
      <div class="dropdown-header">
        <span class="header-title">{{ type === 'prefix' ? 'Prefix Format' : 'Display Format' }}</span>
      </div>

      <div class="dropdown-options">
        <template v-if="!isCustomMode">
          <button
            v-for="option in formatOptions"
            :key="option.value"
            class="option-button"
            :class="{ 'is-active': currentFormat === option.value }"
            @click="handleOptionClick(option)"
          >
            <span class="option-label">{{ option.label }}</span>
            <span class="option-description">{{ option.description }}</span>
            <Check v-if="currentFormat === option.value" :size="14" class="check-icon" />
            <button
              v-if="!option.isCustom"
              class="apply-all-button"
              title="Apply to all groups"
              @click.stop="handleApplyToAll(option)"
            >
              All
            </button>
          </button>
        </template>

        <template v-else>
          <div class="custom-input-container">
            <input
              ref="customInputRef"
              v-model="customValue"
              type="text"
              class="custom-input"
              placeholder="Enter custom value..."
              @keydown="handleCustomKeydown"
            />
            <div class="custom-actions">
              <button class="custom-cancel" @click="handleCustomCancel">Cancel</button>
              <button class="custom-submit" @click="handleCustomSubmit">Apply</button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.abbreviation-dropdown {
  position: fixed;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px var(--color-shadow-color);
  z-index: 3000;
  min-width: 220px;
  max-width: 280px;
  overflow: hidden;
}

.dropdown-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
}

.header-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.dropdown-options {
  padding: 6px;
}

.option-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  position: relative;
}

.option-button:hover {
  background: var(--color-bg-tertiary);
}

.option-button.is-active {
  background: var(--color-accent-subtle);
}

.option-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  font-style: italic;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-description {
  font-size: 10px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.check-icon {
  color: var(--color-accent-text);
  flex-shrink: 0;
}

.apply-all-button {
  font-size: 9px;
  padding: 2px 6px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  opacity: 0;
  flex-shrink: 0;
}

.option-button:hover .apply-all-button {
  opacity: 1;
}

.apply-all-button:hover {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-text);
}

/* Custom input mode */
.custom-input-container {
  padding: 4px;
}

.custom-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  font-style: italic;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-text-primary);
  outline: none;
}

.custom-input:focus {
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}

.custom-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

.custom-cancel,
.custom-submit {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.custom-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.custom-cancel:hover {
  background: var(--color-bg-tertiary);
}

.custom-submit {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: var(--color-on-accent);
  font-weight: 500;
}

.custom-submit:hover {
  filter: brightness(1.1);
}
</style>
