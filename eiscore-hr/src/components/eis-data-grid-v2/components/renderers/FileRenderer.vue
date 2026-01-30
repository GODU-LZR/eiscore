<template>
  <div class="file-renderer" :class="{ 'is-disabled': isPinned }" @click.stop="openDialog">
    <span>{{ displayText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null
  try {
    return JSON.parse(trimmed)
  } catch (e) {
    return null
  }
}

const toList = (value) => {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  if (typeof value === 'string') {
    const parsed = parseMaybeJson(value)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
  }
  if (typeof value === 'object') return [value]
  return [value]
}

const getName = (item) => {
  if (!item) return ''
  if (typeof item === 'string') return item
  return item.name || item.fileName || item.filename || item.title || ''
}

const isPinned = computed(() => !!props.params?.node?.rowPinned)

const displayText = computed(() => {
  if (isPinned.value) return ''
  const list = toList(props.params?.value)
  const first = list[0]
  const name = getName(first)
  if (typeof first === 'string' && first.startsWith('data:')) return '已上传'
  if (first && typeof first === 'object' && first.dataUrl) return '已上传'
  return name || (list.length ? '已上传' : '点击上传')
})

const openDialog = () => {
  if (isPinned.value) return
  props.params?.context?.componentParent?.openFileDialog?.(props.params)
}
</script>

<style scoped>
.file-renderer {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  color: #606266;
}

.file-renderer:hover {
  color: #409eff;
}

.file-renderer.is-disabled {
  cursor: default;
  color: #909399;
}

.file-renderer.is-disabled:hover {
  color: #909399;
}
</style>
