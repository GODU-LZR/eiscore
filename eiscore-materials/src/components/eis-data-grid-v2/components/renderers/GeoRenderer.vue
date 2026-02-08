<template>
  <div class="geo-renderer">
    <span>{{ displayText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])
const MASKED_TEXT = '*******'
const isMasked = computed(() => props.params?.colDef?.__aclCanView === false)

const normalizeNumber = (val) => {
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

const displayText = computed(() => {
  if (isMasked.value) return MASKED_TEXT
  const value = props.params?.value
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const address = value.address || value.addr || value.label || ''
    if (address) return String(address)
    const lng = normalizeNumber(value.lng ?? value.longitude)
    const lat = normalizeNumber(value.lat ?? value.latitude)
    if (lng !== null && lat !== null) return `${lng}, ${lat}`
  }
  return ''
})
</script>

<style scoped>
.geo-renderer {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
