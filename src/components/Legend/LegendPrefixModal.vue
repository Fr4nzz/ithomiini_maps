<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  abbreviationStyle: {
    type: String,
    default: 'first-letter'
  },
  prefixEnabled: {
    type: [Boolean, String],
    default: 'auto'
  }
})

const emit = defineEmits([
  'close',
  'update:abbreviationStyle',
  'update:prefixEnabled'
])

// Examples based on current style
const example = computed(() => {
  if (props.abbreviationStyle === 'first-three') {
    return 'Mec. pol. casabranca'
  }
  return 'M. p. casabranca'
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="prefix-modal-overlay"
      @click.self="emit('close')"
    >
      <div class="prefix-modal">
        <div class="modal-header">
          <span>Label Prefix Settings</span>
          <button class="close-button" @click="emit('close')">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Abbreviation style -->
          <div class="setting-row">
            <label class="setting-label">Abbreviation Style</label>
            <select
              class="setting-select"
              :value="abbreviationStyle"
              @change="emit('update:abbreviationStyle', $event.target.value)"
            >
              <option value="first-letter">First letter (M. p.)</option>
              <option value="first-three">First 3 letters (Mec. pol.)</option>
            </select>
          </div>

          <!-- Preview -->
          <div class="preview-row">
            <span class="preview-label">Preview:</span>
            <span class="preview-text">{{ example }}</span>
          </div>

          <!-- Prefix toggle (Always / Auto / Never) -->
          <div class="setting-row">
            <label class="setting-label">Show prefix on labels</label>
            <div class="toggle-group">
              <button
                class="toggle-option"
                :class="{ active: prefixEnabled === true }"
                @click="emit('update:prefixEnabled', true)"
              >
                Always
              </button>
              <button
                class="toggle-option"
                :class="{ active: prefixEnabled === 'auto' }"
                @click="emit('update:prefixEnabled', 'auto')"
              >
                Auto
              </button>
              <button
                class="toggle-option"
                :class="{ active: prefixEnabled === false }"
                @click="emit('update:prefixEnabled', false)"
              >
                Never
              </button>
            </div>
            <span class="hint">Auto: Show prefix when headers are hidden</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.prefix-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

.prefix-modal {
  background: var(--color-bg-secondary, #252540);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 12px;
  padding: 0;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 8px 32px var(--color-shadow-color, rgba(0, 0, 0, 0.4));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #3d3d5c);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #e0e0e0);
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #666);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s ease;
}

.close-button:hover {
  color: var(--color-text-primary, #e0e0e0);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #aaa);
}

.setting-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 13px;
  cursor: pointer;
}

.setting-select:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
}

.setting-select option {
  background: var(--color-bg-secondary, #252540);
  color: var(--color-text-primary, #e0e0e0);
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-bg-tertiary, rgba(255,255,255,0.03));
  border-radius: 6px;
}

.preview-label {
  font-size: 11px;
  color: var(--color-text-muted, #666);
}

.preview-text {
  font-size: 13px;
  color: var(--color-text-primary, #e0e0e0);
  font-style: italic;
}

.toggle-group {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border-radius: 6px;
}

.toggle-option {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted, #666);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-option:hover {
  color: var(--color-text-secondary, #aaa);
  background: rgba(255,255,255,0.03);
}

.toggle-option.active {
  background: var(--color-accent-subtle, rgba(74, 222, 128, 0.15));
  color: var(--color-accent, #4ade80);
}

.hint {
  font-size: 11px;
  color: var(--color-text-muted, #666);
  font-style: italic;
}
</style>
