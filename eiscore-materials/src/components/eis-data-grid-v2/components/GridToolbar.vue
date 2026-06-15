<template>
  <div class="grid-toolbar" data-guide="grid-toolbar">
    <div class="toolbar-business-row" data-guide="grid-business-actions">
      <slot></slot>
    </div>

    <div class="toolbar-table-row">
      <el-input 
        class="toolbar-search"
        data-guide="grid-search"
        :model-value="search"
        @update:modelValue="$emit('update:search', $event)"
        placeholder="搜索全表..." 
        clearable
        @input="$emit('search')"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>

      <div class="toolbar-table-extra" data-guide="grid-table-tools">
        <slot name="table-tools"></slot>
      </div>

      <el-tooltip
        v-if="calculationState"
        :content="calculationState.detail"
        placement="top"
      >
        <el-tag
          class="calculation-tag"
          :type="calculationState.type || 'info'"
          effect="plain"
        >
          {{ calculationState.label }}
        </el-tag>
      </el-tooltip>

      <div class="table-actions" data-guide="grid-actions">
        <el-button v-if="canCreate" data-guide="grid-create" type="primary" plain icon="CirclePlus" @click="$emit('create')">新增行</el-button>
        <el-button v-if="canConfig" data-guide="grid-config" type="primary" plain icon="Operation" @click="$emit('config-columns')">列管理</el-button>
        <el-button
          v-if="canRecalculateFormulas"
          data-guide="grid-recalculate"
          type="warning"
          plain
          icon="Refresh"
          :loading="formulaRecalculating"
          @click="$emit('recalculate-formulas')"
        >
          重算公式
        </el-button>
        <el-button
          v-if="canDelete"
          data-guide="grid-delete"
          type="danger"
          plain
          icon="Delete"
          @click="$emit('delete')"
          :disabled="selectedCount === 0"
        >
          删除选中 ({{ selectedCount }})
        </el-button>
        <el-button v-if="canExport" data-guide="grid-export" plain icon="Download" @click="$emit('export')">导出</el-button>
      </div>

      <div class="tip-text" v-if="rangeInfo.active">
        已选中: {{ realRangeRowCount }} 行 x {{ realRangeColCount }} 列
      </div>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed } from 'vue'
import { ElInput, ElButton, ElIcon, ElTag, ElTooltip } from 'element-plus'
import { Search, CirclePlus, Operation, Delete, Download, Refresh } from '@element-plus/icons-vue'

const props = defineProps([
  'search',
  'selectedCount',
  'rangeInfo',
  'gridApi',
  'canCreate',
  'canConfig',
  'canDelete',
  'canExport',
  'canRecalculateFormulas',
  'formulaRecalculating',
  'calculationState'
])
const emit = defineEmits(['update:search', 'search', 'create', 'config-columns', 'recalculate-formulas', 'delete', 'export'])

const getColIndex = (colId) => {
  if (!props.gridApi) return -1
  const allCols = props.gridApi.getAllGridColumns()
  return allCols.findIndex(c => c.getColId() === colId)
}

const realRangeRowCount = computed(() => {
  if (!props.rangeInfo.active) return 0
  return Math.abs(props.rangeInfo.endRowIndex - props.rangeInfo.startRowIndex) + 1
})

const realRangeColCount = computed(() => {
  if (!props.rangeInfo.active) return 0
  const startIdx = getColIndex(props.rangeInfo.startColId)
  const endIdx = getColIndex(props.rangeInfo.endColId)
  if (startIdx === -1 || endIdx === -1) return 0
  return Math.abs(endIdx - startIdx) + 1
})
</script>

<style scoped>
.grid-toolbar {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: #f8f9fa;
}

.toolbar-business-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.toolbar-business-row:empty {
  display: none;
}

.toolbar-table-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.toolbar-search {
  width: 240px;
  max-width: 100%;
  flex: 0 1 240px;
}

.toolbar-table-extra {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.toolbar-table-extra:empty {
  display: none;
}

.table-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.tip-text {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
  white-space: nowrap;
}

.calculation-tag {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-business-row :deep(.el-button + .el-button),
.toolbar-table-extra :deep(.el-button + .el-button),
.table-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 768px) {
  .toolbar-search {
    flex-basis: 100%;
    width: 100%;
  }
}

:global(#app.dark) .grid-toolbar {
  background-color: #0b0f14;
  border-bottom-color: #1f2937;
}
:global(#app.dark) .grid-toolbar :deep(.el-input__wrapper) {
  background-color: #0f172a;
  border-color: #1f2937;
  box-shadow: none;
}
:global(#app.dark) .grid-toolbar :deep(.el-input__inner) {
  color: #f3f4f6;
}
:global(#app.dark) .grid-toolbar :deep(.el-input__prefix-inner),
:global(#app.dark) .grid-toolbar :deep(.el-input__suffix-inner) {
  color: #e5e7eb;
}
:global(#app.dark) .grid-toolbar :deep(.el-button) {
  background-color: #0f172a;
  border-color: #1f2937;
  color: #f3f4f6;
}
:global(#app.dark) .grid-toolbar :deep(.el-button.is-plain) {
  background-color: #0f172a;
  color: #f3f4f6;
}
:global(#app.dark) .grid-toolbar :deep(.el-button.is-disabled) {
  background-color: #0b0f14;
  color: #6b7280;
}
:global(#app.dark) .grid-toolbar .tip-text {
  color: #f3f4f6;
}
</style>
