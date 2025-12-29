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
const optionsMap = computed(() => props.params.colDef?.cascaderOptionsMap || {})

const normalize = (val) => {
  if (val === null || val === undefined) return ''
  return String(val)
}

const displayLabel = computed(() => {
  const parentKey = normalize(parentValue.value)
  const options = optionsMap.value[parentKey] || []
  const target = normalize(rawValue.value)
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
