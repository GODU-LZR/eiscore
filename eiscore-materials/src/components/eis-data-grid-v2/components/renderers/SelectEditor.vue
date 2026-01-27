<template>
  <div class="status-editor-popup select-editor-popup" :style="{ width: cellWidth }" @mousedown.stop>
    <div
      v-for="opt in displayOptions"
      :key="opt.key"
      class="status-editor-item select-editor-item"
      :class="{ 'is-selected': isSelected(opt), 'is-clear': opt.__clear }"
      @click="onSelect(opt.value)"
    >
      <span class="status-label select-label">{{ opt.label }}</span>
      <div v-if="isSelected(opt) && !opt.__clear" class="status-check-mark select-check-mark"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps(['params'])
const internalValue = ref(props.params.value)
const cellWidth = ref(props.params.column ? props.params.column.getActualWidth() + 'px' : '100%')

const toText = (val) => {
  if (val === null || val === undefined) return ''
  return String(val)
}

const normalize = (val) => {
  if (val === null || val === undefined || val === '') return ''
  return String(val)
}

const normalizeOption = (opt) => {
  const rawLabel = opt?.label
  const rawValue = opt?.value
  const label = (rawLabel === null || rawLabel === undefined || rawLabel === '')
    ? toText(rawValue)
    : toText(rawLabel)
  const value = (rawValue === null || rawValue === undefined || rawValue === '')
    ? label
    : rawValue
  return { label, value, type: opt?.type || '' }
}

const options = computed(() => {
  return props.params.colDef.options || props.params.colDef.selectOptions || []
})

const displayOptions = computed(() => {
  const list = options.value
    .map((opt, idx) => {
      const normalized = normalizeOption(opt)
      return { ...normalized, key: `opt-${idx}-${String(normalized.value)}` }
    })
    .filter(opt => opt.label !== '')
  const allowClear = props.params.colDef.allowClear !== false
  if (!allowClear) return list
  return [{ label: '清空', value: null, __clear: true, key: '__clear' }, ...list]
})

const selectedValue = computed(() => normalize(internalValue.value))

const isSelected = (opt) => {
  if (opt.__clear) return selectedValue.value === ''
  return normalize(opt.value) === selectedValue.value
}

const onSelect = (val) => {
  internalValue.value = val
  props.params.stopEditing()
}

defineExpose({ getValue: () => internalValue.value })
</script>

<style scoped>
.select-editor-popup {
  max-height: 120px;
  overflow-y: auto;
  overflow-x: hidden;
}
.select-editor-item.is-clear { color: #909399; }
</style>
