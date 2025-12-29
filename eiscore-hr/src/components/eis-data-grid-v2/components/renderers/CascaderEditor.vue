<template>
  <div class="status-editor-popup select-editor-popup cascader-editor-popup" :style="{ width: cellWidth }" @mousedown.stop>
    <div
      v-for="opt in displayOptions"
      :key="opt.key"
      class="status-editor-item select-editor-item"
      :class="{ 'is-selected': isSelected(opt), 'is-clear': opt.__clear, 'is-disabled': opt.__disabled }"
      @click="onSelect(opt)"
    >
      <span class="status-label select-label">{{ opt.label }}</span>
      <div v-if="isSelected(opt) && !opt.__clear" class="status-check-mark select-check-mark"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import request from '@/utils/request'

const props = defineProps(['params'])
const internalValue = ref(props.params.value)
const cellWidth = ref(props.params.column ? props.params.column.getActualWidth() + 'px' : '100%')
const options = ref([])
const loading = ref(false)

const colDef = props.params.colDef || {}

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
  pushKey(colDef.dependsOnField)
  pushKey(colDef.dependsOn)
  if (colDef.dependsOn && !String(colDef.dependsOn).includes('.')) {
    pushKey(`properties.${colDef.dependsOn}`)
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
  if (colDef.dependsOn) {
    if (data?.properties && typeof data.properties === 'object' && colDef.dependsOn in data.properties) {
      return data.properties[colDef.dependsOn]
    }
    if (colDef.dependsOn in data) return data[colDef.dependsOn]
  }
  if (props.params.api && typeof props.params.api.getValue === 'function' && props.params.node) {
    for (const key of keys) {
      const value = props.params.api.getValue(key, props.params.node)
      if (value !== undefined) return value
    }
  }
  return undefined
}

const parentValue = ref(resolveParentValue())
const apiUrl = colDef.apiUrl || ''
const labelField = colDef.labelField || 'label'
const valueField = colDef.valueField || 'value'
const queryField = colDef.dependsOn || ''
const staticOptionsMap = computed(() => colDef.cascaderOptions || {})
const hasStaticMap = computed(() => Object.keys(staticOptionsMap.value || {}).length > 0)

const hasParent = computed(() => parentValue.value !== null && parentValue.value !== undefined && parentValue.value !== '')

const isDisabled = computed(() => !hasParent.value || (!hasStaticMap.value && !apiUrl))

const ensureCache = () => {
  if (!colDef.cascaderOptionsMap) colDef.cascaderOptionsMap = {}
  return colDef.cascaderOptionsMap
}

const buildUrl = (baseUrl, field, value, labelKey, valueKey) => {
  const url = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`
  const sep = url.includes('?') ? '&' : '?'
  const query = `${encodeURIComponent(field)}=eq.${encodeURIComponent(value)}`
  const select = `select=${encodeURIComponent(`${labelKey},${valueKey}`)}`
  const order = `order=${encodeURIComponent(labelKey)}.asc`
  return `${url}${sep}${query}&${select}&${order}`
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

const loadOptions = async (val) => {
  if (hasStaticMap.value) {
    const key = String(val).trim()
    const list = staticOptionsMap.value[key] || staticOptionsMap.value[String(val)] || []
    options.value = list
      .map(normalizeOption)
      .filter(Boolean)
    return
  }
  if (!apiUrl || !queryField) {
    options.value = []
    return
  }
  const cache = ensureCache()
  const key = String(val)
  if (cache[key]) {
    options.value = cache[key]
    return
  }
  loading.value = true
  try {
    const res = await request({ url: buildUrl(apiUrl, queryField, val, labelField, valueField), method: 'get' })
    const nextOptions = Array.isArray(res)
      ? res.map(item => ({ label: item[labelField], value: item[valueField] }))
      : []
    cache[key] = nextOptions
    options.value = nextOptions
  } catch (e) {
    options.value = []
  } finally {
    loading.value = false
  }
}

const normalize = (val) => {
  if (val === null || val === undefined || val === '') return ''
  return String(val)
}

const allowClear = computed(() => colDef.allowClear !== false)

const displayOptions = computed(() => {
  const selected = normalize(internalValue.value)
  const buildClear = () => ({
    label: '清空',
    value: null,
    __clear: true,
    key: '__clear'
  })
  if (!hasParent.value) {
    const list = []
    if (allowClear.value && selected !== '') list.push(buildClear())
    list.push({ label: '请先选择上一级', value: null, __disabled: true, key: '__need_parent' })
    return list
  }
  if (loading.value) {
    return [{ label: '加载中...', value: null, __disabled: true, key: '__loading' }]
  }
  const list = options.value
    .map((opt, idx) => {
      const normalized = normalizeOption(opt)
      if (!normalized) return null
      return { ...normalized, key: `opt-${idx}-${String(normalized.value)}` }
    })
    .filter(Boolean)
  if (list.length === 0) {
    return [{ label: '没有可选项', value: null, __disabled: true, key: '__empty' }]
  }
  if (!allowClear.value) return list
  return [buildClear(), ...list]
})

const refreshOptions = async () => {
  parentValue.value = resolveParentValue()
  if (!hasParent.value) {
    options.value = []
    internalValue.value = null
    return
  }
  await loadOptions(parentValue.value)
  const target = normalize(internalValue.value)
  if (target) {
    const exists = options.value.some(opt => normalize(opt.value) === target)
    if (!exists) internalValue.value = null
  }
}

onMounted(() => {
  refreshOptions()
})

const isSelected = (opt) => {
  if (opt.__clear) return normalize(internalValue.value) === ''
  return normalize(opt.value) === normalize(internalValue.value)
}

const onSelect = (opt) => {
  if (opt.__disabled) return
  if (isDisabled.value && !opt.__clear) return
  internalValue.value = opt.value
  props.params.stopEditing()
}

defineExpose({ getValue: () => internalValue.value })
</script>

<style scoped>
.cascader-editor-popup .status-editor-item.is-disabled {
  color: #b4b4b4;
  cursor: not-allowed;
}
</style>
