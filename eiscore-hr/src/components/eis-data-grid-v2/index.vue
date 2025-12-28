<template>
  <div class="eis-grid-wrapper">
    <GridToolbar
      v-model:search="searchText"
      :selected-count="selectedRowsCount"
      :range-info="rangeSelection"
      :grid-api="gridApi"
      @search="loadData"
      @create="$emit('create')"
      @config-columns="$emit('config-columns')"
      @delete="deleteSelectedRows"
      @export="gridApi && gridApi.exportDataAsCsv({ fileName: '导出数据.csv' })"
    >
      <slot name="toolbar"></slot>
    </GridToolbar>

    <div class="eis-grid-container" @mouseleave="onGridMouseLeave">
      <ag-grid-vue
        ref="agGridRef"
        style="width: 100%; height: 100%;"
        class="ag-theme-alpine no-user-select"
        :columnDefs="gridColumns"
        :rowData="gridData"
        :pinnedBottomRowData="pinnedBottomRowData"
        :defaultColDef="defaultColDef"
        :localeText="AG_GRID_LOCALE_CN"
        :theme="'legacy'" 
        :rowSelection="rowSelectionConfig"
        :animateRows="true"
        :getRowId="getRowId"
        
        :context="context" 
        :components="gridComponents"
        
        :undoRedoCellEditing="false" 
        :enableCellChangeFlash="true"
        :suppressClipboardPaste="true" 
        :enterNavigatesVertically="true" 
        :enterNavigatesVerticallyAfterEdit="true"
        :suppressRowHoverHighlight="true"
        :enableRangeSelection="false"
        :preventDefaultOnContextMenu="true" 
        
        :rowClassRules="rowClassRules" 
        
        @grid-ready="onGridReady"
        @cell-value-changed="onCellValueChanged"
        @cell-key-down="onCellKeyDown"
        @selection-changed="onSelectionChanged"
        
        @cell-mouse-down="onCellMouseDown"
        @cell-mouse-over="onCellMouseOver"
        @cell-double-clicked="onCellDoubleClicked"
      >
      </ag-grid-vue>

      <ConfigDialog
        v-model:visible="configDialog.visible"
        :title="configDialog.title"
        :type="configDialog.type"
        :col-id="configDialog.colId"
        :current-rule="configDialog.tempValue"
        :current-expression="configDialog.expression"
        :current-label="activeSummaryConfig.label"
        :columns="availableColumns"
        :loading="isSavingConfig"
        @save="saveConfig"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, defineProps, defineEmits, defineExpose, ref, reactive } from 'vue'
import { AgGridVue } from "ag-grid-vue3"
import { useUserStore } from '@/stores/user' 
import { useGridCore } from './composables/useGridCore'
import { useGridFormula } from './composables/useGridFormula'
import { useGridHistory } from './composables/useGridHistory'
import { useGridSelection } from './composables/useGridSelection'
import { useGridClipboard } from './composables/useGridClipboard'

import GridToolbar from './components/GridToolbar.vue'
import ConfigDialog from './components/ConfigDialog.vue'

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([ AllCommunityModule ])

import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"

const AG_GRID_LOCALE_CN = {
  loadingOoo: '数据加载中...', noRowsToShow: '暂无数据', to: '至', of: '共', page: '页',
  next: '下一页', last: '尾页', first: '首页', previous: '上一页',
  filterOoo: '筛选...', applyFilter: '应用', clearFilter: '清除', resetFilter: '重置', cancelFilter: '取消',
  equals: '等于', notEqual: '不等于', contains: '包含', notContains: '不包含',
  startsWith: '开始于', endsWith: '结束于', blank: '为空', notBlank: '不为空',
  lessThan: '小于', greaterThan: '大于', lessThanOrEqual: '小于等于', greaterThanOrEqual: '大于等于',
  inRange: '在范围内', inRangeStart: '从', inRangeEnd: '到',
  andCondition: '并且', orCondition: '或者',
  pinColumn: '冻结列', pinLeft: '冻结到左侧', pinRight: '冻结到右侧', noPin: '取消冻结',
  autosizeThiscolumn: '自动调整列宽', autosizeAllColumns: '自动调整所有列宽', resetColumns: '重置列设置',
  copy: '复制 (Ctrl+C)', paste: '粘贴 (Ctrl+V)', ctrlC: 'Ctrl+C', ctrlV: 'Ctrl+V',
  export: '导出', csvExport: '导出 CSV'
}

const props = defineProps({
  apiUrl: { type: String, required: true },
  viewId: { type: String, required: false, default: null },
  staticColumns: { type: Array, default: () => [] },
  extraColumns: { type: Array, default: () => [] },
  summary: { type: Object, default: () => ({ label: '合计', rules: {}, expressions: {} }) }
})

const emit = defineEmits(['create', 'config-columns', 'view-document'])
const userStore = useUserStore()
const currentUser = userStore.userInfo?.username || 'Admin'
const isAdmin = currentUser === 'Admin'

const gridApi = ref(null)
const selectedRowsCount = ref(0)

// 1. Selection
const { 
  rangeSelection, isDragging, onCellMouseDown, onCellMouseOver, onSelectionChanged, 
  onGlobalMouseMove, onGlobalMouseUp, getColIndex, isCellInSelection 
} = useGridSelection(gridApi, selectedRowsCount)

// 2. Core
const activeSummaryConfig = reactive({ label: '合计', rules: {}, expressions: {}, ...props.summary })
const { 
  gridData, gridColumns, context, gridComponents, searchText, isLoading, 
  loadData, handleToggleColumnLock, getCellStyle, isCellReadOnly, rowClassRules,
  columnLockState // 🟢 导出状态
} = useGridCore(
  props,
  activeSummaryConfig,
  { value: currentUser },
  isCellInSelection,
  gridApi,
  (row) => emit('view-document', row)
)

// 3. Formula (传入 columnLockState 以便持久化)
const formulaDependencyHooks = {} 
const { 
  pinnedBottomRowData, calculateRowFormulas, calculateTotals, 
  configDialog, isSavingConfig, availableColumns, 
  openConfigDialog, saveConfig, loadGridConfig 
} = useGridFormula(props, gridApi, gridData, activeSummaryConfig, { value: currentUser }, formulaDependencyHooks, columnLockState)

// 4. History
const { 
  history, isSystemOperation, 
  onCellValueChanged, deleteSelectedRows, pushPendingChange, sanitizeValue,
  debouncedSave, performUndoRedo 
} = useGridHistory(props, gridApi, gridData, { calculateRowFormulas, calculateTotals, pinnedBottomRowData })

formulaDependencyHooks.pushPendingChange = pushPendingChange
formulaDependencyHooks.triggerSave = debouncedSave

// 5. Clipboard
const { handleGlobalPaste, onCellKeyDown } = useGridClipboard(gridApi, {
  history, isSystemOperation, debouncedSave, performUndoRedo, sanitizeValue, pushPendingChange
}, { rangeSelection, getColIndex })

const defaultColDef = { 
  sortable: true, filter: true, resizable: true, minWidth: 100, 
  editable: (params) => !isCellReadOnly(params),
  suppressKeyboardEvent: (params) => {
    const e = params.event; const k = e.key.toLowerCase(); const c = e.ctrlKey || e.metaKey;
    if (c && (k === 'z' || k === 'y')) return true;
    return false;
  }
}
const rowSelectionConfig = { mode: 'multiRow', headerCheckbox: false, checkboxes: false, enableClickSelection: true }
const getRowId = (params) => String(params.data.id)

const onGridReady = (params) => { 
  gridApi.value = params.api; 
  loadData();
  loadGridConfig();
}

const onGridMouseLeave = () => {}
const onCellDoubleClicked = (params) => {
  if (params.node.rowPinned !== 'bottom') return
  if (!isAdmin) { return }
  const colId = params.column.colId
  const colName = params.colDef.headerName
  openConfigDialog(colName, colId, isAdmin)
}

onMounted(() => { 
  document.addEventListener('mouseup', onGlobalMouseUp)
  document.addEventListener('mousemove', onGlobalMouseMove) 
  document.addEventListener('paste', handleGlobalPaste)
})
onUnmounted(() => { 
  document.removeEventListener('mouseup', onGlobalMouseUp)
  document.removeEventListener('mousemove', onGlobalMouseMove)
  document.removeEventListener('paste', handleGlobalPaste)
})

defineExpose({ loadData })
</script>

<style scoped lang="scss">
.eis-grid-wrapper { height: 100%; display: flex; flex-direction: column; background-color: #fff; border-radius: 4px; }
.eis-grid-container { flex: 1; width: 100%; padding: 0; }
</style>

<style lang="scss">
/* 🟢 修复：全局样式，对齐原版 */
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar { width: 16px; height: 16px; }
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb { background-color: var(--el-color-primary-light-5); border-radius: 8px; border: 3px solid transparent; background-clip: content-box; }
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb:hover, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover { background-color: var(--el-color-primary); }
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-track, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track { background-color: #f5f7fa; box-shadow: inset 0 0 4px rgba(0,0,0,0.05); }
.ag-theme-alpine .ag-body-viewport { overflow-y: scroll !important; }

.ag-theme-alpine { --ag-font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; --ag-font-size: 13px; --ag-foreground-color: #303133; --ag-background-color: #fff; --ag-header-background-color: #f1f3f4; --ag-header-foreground-color: #606266; --ag-header-height: 32px; --ag-row-height: 35px; --ag-borders: solid 1px; --ag-border-color: #dcdfe6; --ag-row-border-color: #e4e7ed; --ag-row-hover-color: #f5f7fa; --ag-selected-row-background-color: rgba(64, 158, 255, 0.1); --ag-input-focus-border-color: var(--el-color-primary); --ag-range-selection-border-color: var(--el-color-primary); --ag-range-selection-border-style: solid; }
.no-user-select { user-select: none; }
.ag-theme-alpine .dynamic-header { font-weight: 600; }
.ag-theme-alpine .ag-cell { border-right: 1px solid var(--ag-border-color); }
.ag-root-wrapper { border: 1px solid var(--el-border-color-light) !important; }

.custom-range-selected { background-color: rgba(0, 120, 215, 0.15) !important; border: 1px solid rgba(0, 120, 215, 0.6) !important; z-index: 1; }
.cell-locked-pattern { background-image: repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 10px, #ffffff 10px, #ffffff 20px); color: #a8abb2; cursor: not-allowed; }
.row-locked-bg { background-color: #fafafa !important; }

.custom-header-wrapper { display: flex !important; align-items: center !important; width: 100%; height: 100%; justify-content: space-between; overflow: hidden; }
.custom-header-main { display: flex !important; align-items: center !important; flex: 1; overflow: hidden; cursor: pointer; padding-right: 8px; min-width: 0; }
.custom-header-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: 13px; color: #606266; }
.custom-header-tools { display: flex !important; align-items: center !important; gap: 2px; flex-shrink: 0; }
.custom-header-icon { display: flex !important; align-items: center !important; padding: 4px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.custom-header-icon:hover { background-color: #e6e8eb; }
.header-unlock-icon, .menu-btn { opacity: 0; transition: opacity 0.2s; }
.custom-header-wrapper:hover .header-unlock-icon, .custom-header-wrapper:hover .menu-btn { opacity: 1; }

.status-editor-popup { background-color: #fff; border-radius: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); border: 1px solid #e4e7ed; overflow: hidden; padding: 4px 0; z-index: 9999; }
.status-editor-item { display: flex !important; align-items: center !important; padding: 8px 12px; cursor: pointer; transition: background-color 0.2s; font-size: 13px; color: #606266; position: relative; }
.status-editor-item:hover { background-color: #f5f7fa; }
.status-editor-item.is-selected { background-color: #ecf5ff; color: #409EFF; font-weight: 500; }
.status-label { margin-left: 0; flex: 1; }
.status-check-mark { width: 6px; height: 6px; border-radius: 50%; background-color: #409EFF; }
</style>
