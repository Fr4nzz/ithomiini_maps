<script setup>
import { ref, watch, nextTick } from 'vue'
import { Pencil } from 'lucide-vue-next'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  customLabel: {
    type: String,
    default: ''
  },
  editable: {
    type: Boolean,
    default: true
  },
  fontSize: {
    type: Number,
    default: 14
  }
})

const emit = defineEmits(['update:customLabel', 'editing-start', 'editing-end'])

const isEditing = ref(false)
const editValue = ref('')
const inputRef = ref(null)

// Display label - use custom if set, otherwise original
const displayLabel = ref(props.customLabel || props.label)

watch(() => props.customLabel, (newVal) => {
  displayLabel.value = newVal || props.label
})

watch(() => props.label, (newVal) => {
  if (!props.customLabel) {
    displayLabel.value = newVal
  }
})

function startEditing() {
  if (!props.editable) return

  isEditing.value = true
  editValue.value = displayLabel.value
  emit('editing-start')

  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
      inputRef.value.select()
    }
  })
}

function saveEdit() {
  const trimmed = editValue.value.trim()

  if (trimmed && trimmed !== props.label) {
    // Custom label set
    emit('update:customLabel', trimmed)
    displayLabel.value = trimmed
  } else {
    // Reset to original
    emit('update:customLabel', '')
    displayLabel.value = props.label
  }

  isEditing.value = false
  emit('editing-end')
}

function cancelEdit() {
  isEditing.value = false
  editValue.value = ''
  emit('editing-end')
}

function handleKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    saveEdit()
  } else if (e.key === 'Escape') {
    cancelEdit()
  }
}

function handleBlur() {
  // Small delay to allow click on other elements
  setTimeout(() => {
    if (isEditing.value) {
      saveEdit()
    }
  }, 100)
}
</script>

<template>
  <div
    class="legend-editable-label"
    :class="{ 'is-editing': isEditing, 'is-custom': customLabel }"
  >
    <!-- Editing mode -->
    <input
      v-if="isEditing"
      ref="inputRef"
      v-model="editValue"
      type="text"
      class="label-input"
      :style="{ fontSize: fontSize + 'px' }"
      @keydown="handleKeydown"
      @blur="handleBlur"
    />

    <!-- Display mode -->
    <span
      v-else
      class="label-text"
      :style="{ fontSize: fontSize + 'px' }"
      :title="customLabel ? `Original: ${label}` : label"
      @dblclick="startEditing"
    >
      {{ displayLabel }}
    </span>

    <!-- Edit indicator (shown on hover when editable) -->
    <button
      v-if="editable && !isEditing"
      class="edit-button"
      title="Click to edit label"
      @click.stop="startEditing"
    >
      <Pencil :size="12" />
    </button>
  </div>
</template>

<style scoped>
.legend-editable-label {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.label-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
  padding: 2px 0;
  border-radius: 2px;
  transition: background-color 0.15s ease;
}

.legend-editable-label:hover .label-text {
  background-color: var(--color-bg-tertiary, rgba(255,255,255,0.05));
}

.is-custom .label-text {
  font-style: italic;
}

.label-input {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--color-accent, #4ade80);
  border-radius: 3px;
  background: var(--color-bg-primary, #1a1a2e);
  color: var(--color-text-primary, #e0e0e0);
  font-family: inherit;
  outline: none;
}

.label-input:focus {
  box-shadow: 0 0 0 2px var(--color-accent-subtle, rgba(74, 222, 128, 0.2));
}

.edit-button {
  display: none;
  padding: 2px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.legend-editable-label:hover .edit-button {
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-button:hover {
  background: var(--color-bg-tertiary, rgba(255,255,255,0.1));
  color: var(--color-text-primary, #e0e0e0);
}
</style>
