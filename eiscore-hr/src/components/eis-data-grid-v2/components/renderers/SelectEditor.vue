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

const normalize = (val) => {
  if (val === null || val === undefined || val === '') return ''
  return String(val)
}

const options = computed(() => {
  return props.params.colDef.options || props.params.colDef.selectOptions || []
})

const displayOptions = computed(() => {
  const list = options.value
    .map((opt, idx) => {
      const label = opt.label ?? opt.value ?? ''
      const value = opt.value ?? opt.label ?? ''
      return { label, value, type: opt.type || '', key: `opt-${idx}-${String(value)}` }
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
  max-height: 260px;
  overflow-y: auto;
}
.select-editor-item.is-clear { color: #909399; }
</style>
