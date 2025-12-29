<template>
  <div class="cascader-editor-wrapper" @mousedown.stop>
    <el-select
      ref="selectRef"
      v-model="internalValue"
      size="small"
      :disabled="isDisabled"
      :placeholder="placeholderText"
      style="width: 100%"
      filterable
      clearable
      automatic-dropdown
      @change="handleChange"
      @visible-change="handleVisibleChange"
    >
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <div v-if="tips" class="cascader-tip">{{ tips }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import request from '@/utils/request'

const props = defineProps(['params'])
const internalValue = ref(props.params.value)
const selectRef = ref(null)
const options = ref([])
const loading = ref(false)

const colDef = props.params.colDef || {}
const parentField = colDef.dependsOnField
const parentValue = computed(() => getByPath(props.params.data, parentField))
const apiUrl = colDef.apiUrl || ''
const labelField = colDef.labelField || 'label'
const valueField = colDef.valueField || 'value'
const queryField = colDef.dependsOn || ''

const hasParent = computed(() => parentValue.value !== null && parentValue.value !== undefined && parentValue.value !== '')

const isDisabled = computed(() => !hasParent.value || !apiUrl)

const placeholderText = computed(() => {
  if (!hasParent.value) return '请先选择上一级'
  if (loading.value) return '加载中...'
  return colDef.headerName || '请选择'
})

const tips = computed(() => {
  if (!hasParent.value) return '先选上一级，下面才会有可选项'
  if (!loading.value && options.value.length === 0) return '没有可选项'
  return ''
})

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

const loadOptions = async (val) => {
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

watch(parentValue, (val) => {
  if (!hasParent.value) {
    options.value = []
    internalValue.value = null
    return
  }
  loadOptions(val)
}, { immediate: true })

onMounted(() => {
  nextTick(() => {
    selectRef.value?.focus()
    if (selectRef.value?.toggleMenu) selectRef.value.toggleMenu()
  })
})

const handleChange = (val) => {
  internalValue.value = val
  props.params.stopEditing()
}

const handleVisibleChange = (visible) => {
  if (!visible) {
    props.params.stopEditing()
  }
}

const getByPath = (obj, path) => {
  if (!obj || !path) return undefined
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

defineExpose({ getValue: () => internalValue.value })
</script>

<style scoped>
.cascader-editor-wrapper {
  width: 100%;
}
.cascader-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
:deep(.el-input__wrapper) {
  box-shadow: none !important;
  padding: 0 8px;
}
</style>
