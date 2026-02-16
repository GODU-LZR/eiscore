<template>
  <div class="cascader-renderer">
    <span>{{ displayLabel }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])
const MASKED_TEXT = '*******'

const rawValue = computed(() => props.params.value)
const colDef = computed(() => props.params.colDef || {})
const isMasked = computed(() => props.params?.colDef?.__aclCanView === false)

const getByPath = (obj, path) => {
  if (!obj || !path) return undefined
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

const collectParentKeys = () => {
  const keys = []
  const pushKey = (key) => {
    if (!key) return
    const text = String(key)
    if (!keys.includes(text)) keys.push(text)
  }
  pushKey(colDef.value.dependsOnField)
  pushKey(colDef.value.dependsOn)
  if (colDef.value.dependsOn && !String(colDef.value.dependsOn).includes('.')) {
    pushKey(`properties.${colDef.value.dependsOn}`)
  }
  return keys
}

const resolveParentValue = () => {
  const data = props.params.node?.data || props.params.data || {}
  const keys = collectParentKeys()
  for (const key of keys) {
    const byField = getByPath(data, key)
    if (byField !== undefined) return byField
  }
  if (colDef.value.dependsOn) {
    if (data?.properties && typeof data.properties === 'object' && colDef.value.dependsOn in data.properties) {
      return data.properties[colDef.value.dependsOn]
    }
    if (colDef.value.dependsOn in data) return data[colDef.value.dependsOn]
  }
  if (props.params.api && typeof props.params.api.getValue === 'function' && props.params.node) {
    for (const key of keys) {
      const value = props.params.api.getValue(key, props.params.node)
      if (value !== undefined) return value
    }
  }
  return undefined
}

const parentValue = computed(() => resolveParentValue())
const staticMap = computed(() => colDef.value?.cascaderOptions || {})
const optionsMap = computed(() => {
  const staticKeys = Object.keys(staticMap.value || {})
  if (staticKeys.length > 0) return staticMap.value
  return colDef.value?.cascaderOptionsMap || {}
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
  return { label: String(label || value), value: value }
}

const flatOptions = computed(() => colDef.value?.cascaderFlatOptions || null)
const flatLabelField = computed(() => colDef.value?.cascaderLabelField || 'name')
const flatValueField = computed(() => colDef.value?.cascaderValueField || 'id')

const displayLabel = computed(() => {
  if (isMasked.value) return MASKED_TEXT
  const target = normalize(rawValue.value)
  if (target === '') return ''

  // 1) Try formatter first if defined on colDef
  if (typeof colDef.value?.formatter === 'function') {
    const formatted = colDef.value.formatter(props.params)
    if (formatted) return formatted
  }

  // 2) Try static options map
  const parentKey = normalize(parentValue.value).trim()
  const options = (optionsMap.value[parentKey] || optionsMap.value[normalize(parentValue.value)] || [])
    .map(normalizeOption)
    .filter(Boolean)
  const option = options.find(opt => normalize(opt.value) === target)
  if (option) return option.label

  // 3) Fallback: look up in flat warehouse list
  const flat = flatOptions.value
  if (flat) {
    const rawList = Array.isArray(flat.value) ? flat.value : (Array.isArray(flat) ? flat : [])
    const found = rawList.find(item => String(item?.[flatValueField.value] || '') === target)
    if (found) return found[flatLabelField.value] || found[flatValueField.value] || target
  }

  return rawValue.value ?? ''
})

</script>

<style scoped>
.cascader-renderer {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
