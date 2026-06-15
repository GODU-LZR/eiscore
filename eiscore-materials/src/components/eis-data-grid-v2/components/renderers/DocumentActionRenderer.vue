<template>
  <div class="action-cell-wrapper" @mousedown.stop>
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
import { Document } from '@element-plus/icons-vue'

const props = defineProps(['params'])

const isPinned = computed(() => !!props.params?.node?.rowPinned)

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
  height: 100%;
  width: 100%;
}
.action-btn {
  padding: 4px 8px;
  display: flex;
  align-items: center;
  font-weight: 500;
}
.action-btn:hover {
  background-color: var(--el-color-primary-light-9);
  border-radius: 4px;
}
</style>
