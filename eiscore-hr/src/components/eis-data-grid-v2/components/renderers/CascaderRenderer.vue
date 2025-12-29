<template>
  <div class="cascader-renderer">
    <span>{{ displayLabel }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const rawValue = computed(() => props.params.value)
const parentValue = computed(() => getByPath(props.params.data, props.params.colDef?.dependsOnField))
const staticMap = computed(() => props.params.colDef?.cascaderOptions || {})
const optionsMap = computed(() => {
  const staticKeys = Object.keys(staticMap.value || {})
  if (staticKeys.length > 0) return staticMap.value
  return props.params.colDef?.cascaderOptionsMap || {}
})

const normalize = (val) => {
  if (val === null || val === undefined) return ''
  return String(val)
}

const normalizeOption = (item) => {
  if (item === null || item === undefined) return null
  if (typeof item === 'string' || typeof item === 'number') {
    const text = String(item)
    return { label: text, value: text }
  }
  const label = item.label ?? item.value ?? ''
  const value = item.value ?? item.label ?? ''
  const text = String(label || value)
  return { label: text, value: text }
}

const displayLabel = computed(() => {
  const parentKey = normalize(parentValue.value)
  const options = (optionsMap.value[parentKey] || [])
    .map(normalizeOption)
    .filter(Boolean)
  const target = normalize(rawValue.value)
  if (target === '') return ''
  const option = options.find(opt => normalize(opt.value) === target)
  return option ? option.label : (rawValue.value ?? '')
})

const getByPath = (obj, path) => {
  if (!obj || !path) return undefined
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}
</script>

<style scoped>
.cascader-renderer {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
