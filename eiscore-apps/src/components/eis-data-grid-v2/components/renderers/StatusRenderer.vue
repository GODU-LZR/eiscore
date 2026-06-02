<template>
  <div class="status-cell-wrapper" :style="{ color: info.color, fontWeight: info.fontWeight || '500' }">
    <el-icon v-if="info.icon" :size="14" style="margin-right: 6px;"><component :is="info.icon" /></el-icon>
    <span>{{ displayText }}</span>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

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
  const raw = data?.status ?? data?.properties?.status
  if (!raw) return 'created'
  const text = String(raw).toLowerCase()
  if (text === 'disabled') return 'locked'
  if (text === 'draft') return 'created'
  if (text === 'active' || text === 'locked' || text === 'created') return text
  return raw
})

const info = computed(() => statusMap[currStatus.value] || statusMap['created'])

const displayText = computed(() => {
  if (currStatus.value === 'total') return props.params.value
  return info.value.label
})
</script>

<style>
/* 🟢 修复：完全复刻原版 inline style，且不使用 scoped */
.status-cell-wrapper {
  display: flex !important;
  align-items: center !important;
  height: 100% !important;
  width: 100% !important;
  padding-left: 4px;
  pointer-events: none;
  font-size: 13px;
  line-height: normal; /* 关键：防止文字偏上 */
}
</style>
