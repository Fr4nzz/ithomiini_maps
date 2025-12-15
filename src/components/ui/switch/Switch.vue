<script setup>
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  defaultChecked: {
    type: Boolean,
    default: undefined,
  },
  checked: {
    type: Boolean,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    default: undefined,
  },
  value: {
    type: String,
    default: 'on',
  },
  id: {
    type: String,
    default: undefined,
  },
  class: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:checked'])
</script>

<template>
  <SwitchRoot
    :default-checked="defaultChecked"
    :checked="checked"
    :disabled="disabled"
    :required="required"
    :name="name"
    :value="value"
    :id="id"
    :class="
      cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        props.class
      )
    "
    @update:checked="emit('update:checked', $event)"
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
        )
      "
    />
  </SwitchRoot>
</template>
