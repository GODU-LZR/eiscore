<template>
  <span :class="['status-chip', statusClass]">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps(['params'])

const label = computed(() => {
  const value = props.params?.value || ''
  if (value === 'locked') return '锁定'
  if (value === 'active') return '启用'
  if (value === 'created' || value === 'draft') return '草稿'
  return value || '未知'
})

const statusClass = computed(() => {
  const value = props.params?.value || ''
  if (value === 'locked') return 'is-locked'
  if (value === 'active') return 'is-active'
  return 'is-draft'
})
</script>

<style scoped>
.status-chip {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  background: #f5f7fa;
  color: #606266;
}
.status-chip.is-active { background: #f0f9eb; color: #67c23a; }
.status-chip.is-locked { background: #fef0f0; color: #f56c6c; }
</style>
