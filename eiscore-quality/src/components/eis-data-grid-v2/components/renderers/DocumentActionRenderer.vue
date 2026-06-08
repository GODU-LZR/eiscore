<template>
  <div class="action-cell-wrapper" @mousedown.stop>
    <el-button
      v-for="action in rowActions"
      :key="action.key"
      link
      :type="action.type || 'primary'"
      size="small"
      class="action-btn"
      :disabled="action.disabled"
      @click.stop="onRowAction(action)"
    >
      <el-icon v-if="resolveIcon(action.icon)" :size="14" style="margin-right: 4px; vertical-align: middle;">
        <component :is="resolveIcon(action.icon)" />
      </el-icon>
      <span style="vertical-align: middle;">{{ action.label }}</span>
    </el-button>
    <el-button 
      v-if="!isPinned"
      link 
      type="primary" 
      size="small" 
      class="action-btn"
      @click.stop="onViewForm"
    >
      <el-icon :size="14" style="margin-right: 4px; vertical-align: middle;"><Document /></el-icon>
      <span style="vertical-align: middle;">表单</span>
    </el-button>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed } from 'vue'
import { ElButton, ElIcon } from 'element-plus'
import { CircleCheck, Document, Warning } from '@element-plus/icons-vue'

const props = defineProps(['params'])

const isPinned = computed(() => !!props.params?.node?.rowPinned)
const rowActions = computed(() => {
  if (isPinned.value) return []
  const resolver = props.params?.context?.componentParent?.resolveRowActions
  if (typeof resolver !== 'function') return []
  const actions = resolver(props.params?.data)
  return Array.isArray(actions) ? actions : []
})

const iconMap = {
  CircleCheck,
  Document,
  Warning
}

const resolveIcon = (icon) => iconMap[icon] || null

const onRowAction = (action) => {
  if (isPinned.value || action?.disabled) return
  const handler = props.params?.context?.componentParent?.rowAction
  if (typeof handler === 'function') {
    handler(action, props.params.data)
  } else {
    console.warn('rowAction method not found on componentParent')
  }
}

const onViewForm = () => {
  if (isPinned.value) return
  // 确保 Context 存在
  if (props.params.context.componentParent && props.params.context.componentParent.viewDocument) {
    props.params.context.componentParent.viewDocument(props.params.data)
  } else {
    console.warn('viewDocument method not found on componentParent')
  }
}
</script>

<style>
.action-cell-wrapper {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px;
  height: 100%;
  width: 100%;
}
.action-btn {
  padding: 4px 6px;
  display: flex;
  align-items: center;
  font-weight: 500;
  white-space: nowrap;
}
.action-btn:hover {
  background-color: var(--el-color-primary-light-9);
  border-radius: 4px;
}
</style>
