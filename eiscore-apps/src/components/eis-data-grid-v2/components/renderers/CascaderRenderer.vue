<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const display = computed(() => {
  const value = props.params?.value
  if (Array.isArray(value)) return value.join(' / ')
  return value || ''
})
</script>
