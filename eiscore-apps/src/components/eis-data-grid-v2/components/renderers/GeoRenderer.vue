<template>
  <span>{{ displayText }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const displayText = computed(() => {
  const value = props.params?.value
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const address = value.address || value.addr || value.label || ''
    if (address) return String(address)
    const lng = value.lng ?? value.longitude
    const lat = value.lat ?? value.latitude
    if (lng !== undefined && lat !== undefined) return `${lng}, ${lat}`
  }
  return ''
})
</script>
