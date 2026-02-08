<template>
  <div class="select-renderer">
    <span>{{ displayText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])
const MASKED_TEXT = '*******'

const rawValue = computed(() => props.params.value)
const options = computed(() => props.params.colDef.options || props.params.colDef.selectOptions || [])
const isMasked = computed(() => props.params?.colDef?.__aclCanView === false)

const normalize = (val) => {
  if (val === null || val === undefined) return ''
  return String(val)
}

const normalizeOption = (opt) => {
  const rawLabel = opt?.label
  const rawValue = opt?.value
  const label = (rawLabel === null || rawLabel === undefined || rawLabel === '')
    ? normalize(rawValue)
    : normalize(rawLabel)
  const value = (rawValue === null || rawValue === undefined || rawValue === '')
    ? label
    : rawValue
  return { label, value, type: opt?.type || '' }
}

const normalizedOptions = computed(() => options.value.map(normalizeOption))

const displayLabel = computed(() => {
  if (isMasked.value) return MASKED_TEXT
  const target = normalize(rawValue.value)
  if (target === '') return ''
  const option = normalizedOptions.value.find(opt => normalize(opt.value) === target)
  return option ? option.label : rawValue.value
})

const displayText = computed(() => displayLabel.value || rawValue.value)

</script>

<style scoped>
.select-renderer {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
