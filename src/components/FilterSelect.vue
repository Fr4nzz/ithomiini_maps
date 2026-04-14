<script setup>
import { computed, ref } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  useFilter,
} from 'reka-ui'
import { Check, ChevronDown, X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/data'

const props = defineProps({
  label: String,
  modelValue: [String, Array, Object, null],
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select...' },
  multiple: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
  customLabel: { type: Function, default: null },
  trackBy: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  showCount: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])

const dataStore = useDataStore()

const open = ref(false)
const searchTerm = ref('')
const inputRef = ref()

const { contains } = useFilter({ sensitivity: 'base' })

const getOptionLabel = (option) => {
  if (props.customLabel) {
    const customValue = props.customLabel(option)
    if (customValue != null) return String(customValue)
  }

  if (option && typeof option === 'object') {
    return option.label || option.name || option.value || ''
  }

  return option == null ? '' : String(option)
}

const getComparableValue = (option) => {
  if (!props.trackBy || option == null || typeof option !== 'object') return option
  return option[props.trackBy]
}

const isSameOption = (left, right) => {
  if (left == null || right == null) return left === right
  return getComparableValue(left) === getComparableValue(right)
}

const normalizedValue = computed(() => {
  if (props.multiple) return Array.isArray(props.modelValue) ? props.modelValue : []
  return props.modelValue ?? null
})

const selectionModel = computed({
  get: () => normalizedValue.value,
  set: (value) => emit('update:modelValue', value),
})

const selectedItems = computed(() => {
  if (!props.multiple) return normalizedValue.value ? [normalizedValue.value] : []
  return normalizedValue.value
})

const filteredOptions = computed(() => {
  if (!props.searchable || !searchTerm.value.trim()) return props.options
  return props.options.filter(option => contains(getOptionLabel(option), searchTerm.value))
})

const optionColorMap = computed(() => dataStore.activeColorMap || {})

const shouldShowColorDots = computed(() => {
  const colors = optionColorMap.value
  if (!colors || Object.keys(colors).length === 0) return false

  return props.options
    .filter(option => !isAllOption(option))
    .some(option => !!colors[getOptionLabel(option)])
})

const getOptionColor = (option) => {
  if (!shouldShowColorDots.value) return null
  return optionColorMap.value[getOptionLabel(option)] || null
}

const hasSelection = computed(() => selectedItems.value.length > 0)

const canClear = computed(() => {
  if (!hasSelection.value) return false
  if (props.multiple) return true
  return !isAllOption(normalizedValue.value)
})

const singleDisplayValue = (value) => {
  if (props.multiple || value == null) return ''
  return getOptionLabel(value)
}

const focusInput = () => {
  if (!props.disabled) inputRef.value?.focus()
}

const openDropdown = () => {
  if (!props.disabled) open.value = true
}

const removeItem = (itemToRemove) => {
  if (!props.multiple || props.disabled) return

  emit(
    'update:modelValue',
    selectedItems.value.filter(item => !isSameOption(item, itemToRemove)),
  )
}

const toggleMultiOption = (option) => {
  if (!props.multiple || props.disabled) return

  const exists = selectedItems.value.some(item => isSameOption(item, option))
  const nextValue = exists
    ? selectedItems.value.filter(item => !isSameOption(item, option))
    : [...selectedItems.value, option]

  emit('update:modelValue', nextValue)
  open.value = true
  focusInput()
}

const isAllOption = (option) => {
  const label = getOptionLabel(option).trim().toLowerCase()
  return label === 'all'
}

const clearSelection = () => {
  if (props.disabled) return

  searchTerm.value = ''

  if (props.multiple) {
    emit('update:modelValue', [])
    open.value = true
    focusInput()
    return
  }

  const resetValue = props.options.find(isAllOption) ?? null
  emit('update:modelValue', resetValue)
}

const handleOptionSelect = (option, event) => {
  if (!props.multiple) return
  event.preventDefault()
  toggleMultiOption(option)
}

const getOptionKey = (option, index) => {
  const comparable = getComparableValue(option)
  if (comparable != null && comparable !== '') return `${typeof comparable}-${comparable}`

  const label = getOptionLabel(option)
  if (label) return `${label}-${index}`

  return `option-${index}`
}
</script>

<template>
  <div class="mb-3">
    <label v-if="label" class="mb-1.5 flex items-center gap-1 text-[0.75rem] font-medium text-muted-foreground">
      {{ label }}
      <span v-if="showCount && options.length > 0" class="font-normal text-[hsl(var(--muted-foreground)/0.8)]">
        ({{ options.length }})
      </span>
    </label>

    <ComboboxRoot
      v-model="selectionModel"
      v-model:open="open"
      :multiple="multiple"
      :disabled="disabled"
      :by="trackBy"
      :ignore-filter="true"
      :open-on-focus="searchable"
      open-on-click
      class="w-full"
    >
      <ComboboxAnchor
        :class="cn(
          'flex min-h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground shadow-sm transition-colors',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
          disabled && 'cursor-not-allowed opacity-50',
        )"
        @click="openDropdown"
      >
        <div
          class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
          @mousedown="!disabled && searchable ? focusInput() : null"
        >
          <template v-if="multiple && hasSelection">
            <span
              v-for="(item, index) in selectedItems"
              :key="getOptionKey(item, index)"
              class="inline-flex max-w-full items-center gap-1 rounded-md bg-accent/15 px-2 py-1 text-xs font-medium text-accent"
            >
              <span class="truncate">{{ getOptionLabel(item) }}</span>
              <button
                type="button"
                class="rounded-sm text-accent/80 transition hover:text-accent focus:outline-none"
                :disabled="disabled"
                @click.stop="removeItem(item)"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </span>
          </template>

          <ComboboxInput
            ref="inputRef"
            v-model="searchTerm"
            :display-value="singleDisplayValue"
            :placeholder="multiple && hasSelection && searchable ? '' : placeholder"
            :disabled="disabled"
            :readonly="!searchable"
            :class="cn(
              'min-w-[5rem] flex-1 bg-transparent text-sm text-card-foreground outline-none placeholder:text-muted-foreground',
              multiple && hasSelection ? 'h-6 py-0' : 'h-5',
              !searchable && 'cursor-pointer',
            )"
            @focus="openDropdown"
          />
        </div>

        <button
          v-if="canClear"
          type="button"
          class="rounded-sm p-0.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground focus:outline-none"
          :disabled="disabled"
          @click.stop="clearSelection"
        >
          <X class="h-4 w-4" />
        </button>

        <ComboboxTrigger
          class="rounded-sm p-0.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground focus:outline-none"
          :disabled="disabled"
        >
          <ChevronDown :class="cn('h-4 w-4 transition-transform', open && 'rotate-180')" />
        </ComboboxTrigger>
      </ComboboxAnchor>

      <ComboboxPortal>
        <ComboboxContent
          position="popper"
          :side-offset="6"
          class="z-[70] w-[var(--reka-combobox-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-xl"
        >
          <ComboboxViewport class="max-h-[280px] p-1">
            <template v-if="options.length === 0">
              <div class="px-3 py-2 text-sm italic text-muted-foreground">
                No options available
              </div>
            </template>
            <template v-else>
              <div v-if="filteredOptions.length === 0" class="px-3 py-2 text-sm italic text-muted-foreground">
                No matching results
              </div>

              <template v-else>
                <ComboboxItem
                  v-for="(option, index) in filteredOptions"
                  :key="getOptionKey(option, index)"
                  :value="option"
                  :class="cn(
                    'relative flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm outline-none transition-colors',
                    'data-[highlighted]:bg-muted data-[highlighted]:text-popover-foreground',
                    'data-[state=checked]:bg-accent/15 data-[state=checked]:text-accent',
                  )"
                  @select="handleOptionSelect(option, $event)"
                >
                  <span class="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      v-if="getOptionColor(option)"
                      class="h-2 w-2 shrink-0 rounded-full"
                      :style="{ backgroundColor: getOptionColor(option) }"
                    />
                    <span class="min-w-0 truncate">{{ getOptionLabel(option) }}</span>
                  </span>
                  <ComboboxItemIndicator class="flex items-center justify-center text-accent">
                    <Check class="h-4 w-4" />
                  </ComboboxItemIndicator>
                </ComboboxItem>
              </template>
            </template>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>
