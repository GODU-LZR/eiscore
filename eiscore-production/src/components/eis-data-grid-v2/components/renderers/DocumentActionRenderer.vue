<template>
  <div class="action-cell-wrapper" @mousedown.stop>
    <el-button
      v-for="action in rowActions"
      :key="action.key"
      link
      :type="action.type || 'primary'"
      size="small"
      class="action-btn"
      :data-sop-action="action.sopAction || action.key"
      :data-sop-title="action.sopTitle || action.title || action.label"
      :data-sop-desc="action.sopDesc || action.title || ''"
      :data-sop-steps="formatSopSteps(action.sopSteps)"
      :data-sop-risk="action.sopRisk || ''"
      :data-sop-flow="action.sopFlow || null"
      :data-sop-flow-title="action.sopFlowTitle || null"
      :data-sop-flow-desc="action.sopFlowDesc || null"
      :data-sop-flow-steps="formatSopSteps(action.sopFlowSteps)"
      :data-sop-flow-risk="action.sopFlowRisk || null"
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
      data-sop-action="open-row-form"
      data-sop-title="打开表单"
      data-sop-desc="查看或维护当前行的完整业务表单。"
      data-sop-steps="先确认当前行是要处理的记录|点击表单打开详情|按表单字段从上到下复核并补齐信息|保存前检查状态、数量、日期、负责人和附件"
      data-sop-risk="表单保存后会影响当前记录，保存前要确认不是误选行。"
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
import { CircleCheck, Document, Edit, Position, Warning } from '@element-plus/icons-vue'

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
  Edit,
  Position,
  Warning
}

const resolveIcon = (icon) => iconMap[icon] || null

const formatSopSteps = (steps) => Array.isArray(steps) ? steps.filter(Boolean).join('|') : (steps || '')

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
