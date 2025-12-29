<template>
  <div class="select-renderer">
    <el-tag v-if="displayLabel && showTag" :type="tagType" size="small" disable-transitions>
      {{ displayLabel }}
    </el-tag>
    <span v-else>{{ displayLabel || value }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: [String, Number, Boolean],
    default: ''
  },
  column: {
    type: Object,
    required: true
  },
  row: {
    type: Object,
    default: () => ({})
  }
})

// 计算显示的文本
const displayLabel = computed(() => {
  const options = props.column.options || []
  const option = options.find(opt => opt.value === props.value)
  return option ? option.label : props.value
})

// 是否以 Tag 形式显示 (可在列配置中开启 tag: true)
const showTag = computed(() => !!props.column.tag)

// Tag 颜色逻辑 (可选配置)
const tagType = computed(() => {
  if (!showTag.value) return ''
  // 简单的默认颜色映射，也可以在 options 里配置 type
  const options = props.column.options || []
  const option = options.find(opt => opt.value === props.value)
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