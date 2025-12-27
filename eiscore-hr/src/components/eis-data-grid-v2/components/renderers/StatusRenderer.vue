<template>
  <div class="eis-status-cell" :style="{ color: info.color, fontWeight: info.fontWeight || '500' }">
    <el-icon v-if="info.icon" :size="14" style="margin-right: 4px; display: flex; align-items: center;"><component :is="info.icon" /></el-icon>
    <span style="padding-top: 1px;">{{ displayText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElIcon } from 'element-plus'
import { Lock, CirclePlus, CircleCheck } from '@element-plus/icons-vue'

const props = defineProps(['params'])

const statusMap = {
  'created': { label: '创建', icon: CirclePlus, color: '#409EFF' },
  'active': { label: '生效', icon: CircleCheck, color: '#67C23A' },
  'locked': { label: '锁定', icon: Lock, color: '#F56C6C' },
  'total': { icon: null, color: 'var(--el-color-primary)', fontWeight: 'bold' }
}

const currStatus = computed(() => {
  if (props.params.node.rowPinned === 'bottom') return 'total'
  const data = props.params.data
  if (data?.properties?.row_locked_by) return 'locked'
  return data?.properties?.status || 'created'
})

const info = computed(() => statusMap[currStatus.value] || statusMap['created'])

const displayText = computed(() => {
  if (currStatus.value === 'total') return props.params.value
  return info.value.label
})
</script>

<style>
/* 必须是非 scoped 样式以确保在 Grid 内部生效 */
.eis-status-cell {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  padding-left: 5px;
  line-height: normal; /* 重置行高 */
}
</style>