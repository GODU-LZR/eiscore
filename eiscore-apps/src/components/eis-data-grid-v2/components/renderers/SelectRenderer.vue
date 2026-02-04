<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const display = computed(() => {
  const value = props.params?.value
  const options = props.params?.colDef?.options || []
  const match = options.find((opt) => opt.value === value || opt.label === value)
  return match?.label || value || ''
})
</script>
