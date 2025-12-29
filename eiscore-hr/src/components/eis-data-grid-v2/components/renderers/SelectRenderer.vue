<template>
  <div class="select-renderer">
    <el-tag v-if="displayLabel && showTag" :type="tagType" size="small" disable-transitions>
      {{ displayLabel }}
    </el-tag>
    <span v-else>{{ displayLabel || rawValue }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const rawValue = computed(() => props.params.value)
const options = computed(() => props.params.colDef.options || props.params.colDef.selectOptions || [])

const normalize = (val) => {
  if (val === null || val === undefined) return ''
  return String(val)
}

const displayLabel = computed(() => {
  const target = normalize(rawValue.value)
  if (target === '') return ''
  const option = options.value.find(opt => normalize(opt.value) === target)
  return option ? option.label : rawValue.value
})

const showTag = computed(() => !!props.params.colDef.tag)

const tagType = computed(() => {
  if (!showTag.value) return ''
  const target = normalize(rawValue.value)
  if (target === '') return ''
  const option = options.value.find(opt => normalize(opt.value) === target)
  return option?.type || ''
})
</script>

<style scoped>
.select-renderer {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
