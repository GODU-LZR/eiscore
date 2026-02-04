<template>
  <span>{{ displayText }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const displayText = computed(() => {
  const value = props.params?.value
  if (!value) return ''
  if (Array.isArray(value)) return `文件(${value.length})`
  if (typeof value === 'object') return '文件(1)'
  return String(value)
})
</script>
