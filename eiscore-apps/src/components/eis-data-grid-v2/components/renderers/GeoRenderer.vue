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

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  if (!text.startsWith('{') && !text.startsWith('[')) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const resolveAddress = (value) => {
  if (!value || typeof value !== 'object') return ''
  return (
    value.address ||
    value.ai_address ||
    value.aiAddress ||
    value.ip_address ||
    value.ipAddress ||
    value.addr ||
    value.label ||
    ''
  )
}

const displayText = computed(() => {
  if (isMasked.value) return MASKED_TEXT
  let value = props.params?.value
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    const parsed = parseMaybeJson(value)
    if (parsed) value = parsed
    else return String(value)
  }
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const address = resolveAddress(value)
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
