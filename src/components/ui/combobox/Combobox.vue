<script setup>
import { ref, computed, watch } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverContent, PopoverPortal } from 'reka-ui'
import { Check, ChevronsUpDown, X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps({
  modelValue: { type: [String, Array, Object, null], default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select...' },
  multiple: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const search = ref('')

const getLabel = (option) => {
  if (typeof option === 'object' && option !== null) return option.label || option.name || option.value
  return String(option)
}

const getValue = (option) => {
  if (typeof option === 'object' && option !== null) return option.value ?? option
  return option
}

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter(opt => getLabel(opt).toLowerCase().includes(q))
})

const isSelected = (option) => {
  const val = getValue(option)
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.some(v => getValue(v) === val || v === val)
  }
  return getValue(props.modelValue) === val || props.modelValue === val
}

const toggleOption = (option) => {
  const val = getValue(option)
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = current.findIndex(v => getValue(v) === val || v === val)
    if (idx >= 0) current.splice(idx, 1)
    else current.push(val)
    emit('update:modelValue', current)
  } else {
    emit('update:modelValue', isSelected(option) ? null : val)
    open.value = false
  }
}

const displayValue = computed(() => {
  if (props.multiple) {
    const arr = Array.isArray(props.modelValue) ? props.modelValue : []
    if (arr.length === 0) return ''
    if (arr.length === 1) return getLabel(arr[0])
    return `${arr.length} selected`
  }
  return props.modelValue ? getLabel(props.modelValue) : ''
})

const clearSelection = () => {
  emit('update:modelValue', props.multiple ? [] : null)
}

watch(open, (val) => { if (!val) search.value = '' })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child :disabled="disabled">
      <button
        type="button"
        :class="cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2.5 text-sm',
          'focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-1 ring-ring'
        )"
      >
        <span :class="cn('truncate', !displayValue && 'text-muted-foreground')">
          {{ displayValue || placeholder }}
        </span>
        <div class="flex items-center gap-1">
          <X v-if="displayValue && !disabled" class="h-3.5 w-3.5 opacity-50 hover:opacity-100" @click.stop="clearSelection" />
          <ChevronsUpDown class="h-4 w-4 opacity-50" />
        </div>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="4"
        :class="cn(
          'z-50 w-[--reka-popover-trigger-width] rounded-md border bg-popover text-popover-foreground shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
        )"
      >
        <div v-if="searchable" class="p-2 border-b border-border">
          <input
            v-model="search"
            type="text"
            placeholder="Search..."
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div class="max-h-[280px] overflow-y-auto p-1">
          <div v-if="filteredOptions.length === 0" class="py-6 text-center text-sm text-muted-foreground">
            No results found
          </div>
          <button
            v-for="option in filteredOptions"
            :key="getValue(option)"
            type="button"
            :class="cn(
              'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
              'hover:bg-accent hover:text-accent-foreground',
              isSelected(option) && 'bg-accent/50'
            )"
            @click="toggleOption(option)"
          >
            <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              <Check v-if="isSelected(option)" class="h-4 w-4" />
            </span>
            <span class="truncate">{{ getLabel(option) }}</span>
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
