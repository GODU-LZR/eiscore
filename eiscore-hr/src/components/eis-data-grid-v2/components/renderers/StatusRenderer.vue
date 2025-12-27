<template>
  <div class="status-cell-wrapper" :style="{ color: info.color, fontWeight: info.fontWeight || 'normal' }">
    <el-icon v-if="info.icon" :size="14"><component :is="info.icon" /></el-icon>
    <span>{{ displayText }}</span>
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

<style scoped>
.status-cell-wrapper { display: flex; align-items: center; gap: 6px; height: 100%; font-size: 13px; padding-left: 4px; pointer-events: none; }
</style>
