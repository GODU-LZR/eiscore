<template>
  <div class="eis-grid-wrapper">
    <GridToolbar
      v-model:search="searchText"
      :selected-count="selectedRowsCount"
      :range-info="rangeSelection"
      :grid-api="gridApi"
      :can-create="canCreate"
      :can-config="canConfig"
      :can-delete="canDelete"
      :can-export="canExport"
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
        :class="['ag-theme-alpine', 'no-user-select', { 'ag-theme-dark': isDark }]"
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
        @cell-value-changed="handleCellValueChanged"
        @cell-key-down="onCellKeyDown"
        @selection-changed="onSelectionChanged"
        @column-header-clicked="onColumnHeaderClicked"
        @row-selected="onRowSelected"
        
        @cell-mouse-down="onCellMouseDown"
        @cell-mouse-over="onCellMouseOver"
        @cell-mouse-out="handleCellMouseOut"
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
        :current-cell-label="configDialog.cellLabel"
        :columns="availableColumns"
        :loading="isSavingConfig"
        @save="saveConfig"
      />

      <GeoDialog
        v-model:visible="geoDialog.visible"
        :params="geoDialog.params"
        @submit="handleGeoSubmit"
      />

      <FileDialog
        v-model:visible="fileDialog.visible"
        :params="fileDialog.params"
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
import GeoDialog from './components/GeoDialog.vue'
import FileDialog from './components/FileDialog.vue'

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
  writeUrl: { type: String, default: '' },
  includeProperties: { type: Boolean, default: true },
  writeMode: { type: String, default: 'upsert' },
  fieldDefaults: { type: Object, default: () => ({}) },
  patchRequiredFields: { type: Array, default: () => [] },
  viewId: { type: String, required: false, default: null },
  staticColumns: { type: Array, default: () => [] },
  extraColumns: { type: Array, default: () => [] },
  summary: { type: Object, default: () => ({ label: '合计', rules: {}, expressions: {} }) },
  defaultOrder: { type: String, default: 'id.desc' },
  acceptProfile: { type: String, default: 'hr' },
  contentProfile: { type: String, default: 'hr' },
  aclModule: { type: String, default: '' },
  showActionCol: { type: Boolean, default: true },
  autoSizeColumns: { type: Boolean, default: true },
  canCreate: { type: Boolean, default: true },
  canEdit: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: true },
  canExport: { type: Boolean, default: true },
  canConfig: { type: Boolean, default: true }
})

// 🟢 声明事件：增加 view-document
const emit = defineEmits(['create', 'config-columns', 'view-document', 'data-loaded', 'cell-value-changed'])
const userStore = useUserStore()
const currentUser = userStore.userInfo?.username || 'Admin'
const isAdmin = String(currentUser).toLowerCase() === 'admin'

const agGridRef = ref(null)
const gridApi = ref(null)
const selectedRowsCount = ref(0)
const geoDialog = reactive({ visible: false, params: null })
const fileDialog = reactive({ visible: false, params: null })
const isDark = ref(false)
let themeObserver = null

// 1. Selection
const selectionHooks = useGridSelection(gridApi, selectedRowsCount, agGridRef)
const { 
  rangeSelection, isDragging, onCellMouseDown, onCellMouseOver, onSelectionChanged, 
  onGlobalMouseMove, onGlobalMouseUp, getColIndex, isCellInSelection,
  selectColumnRange, selectRowRange
} = selectionHooks

// 2. Core (传入 emit)
const activeSummaryConfig = reactive({ label: '合计', rules: {}, expressions: {}, ...props.summary })
const { 
  gridData, gridColumns, context, gridComponents, searchText, isLoading, 
  loadData, handleToggleColumnLock, getCellStyle, isCellReadOnly, rowClassRules,
  columnLockState 
} = useGridCore(props, activeSummaryConfig, { value: currentUser }, isCellInSelection, gridApi, emit) // 🟢 关键修复：共享 gridApi

const openFileDialog = (params) => {
  if (!params || params.node?.rowPinned) return
  fileDialog.params = params
  fileDialog.visible = true
}

context.componentParent.openFileDialog = openFileDialog
context.componentParent.onHeaderLabelClick = (params, event) => {
  if (!params?.column) return
  selectColumnRange(params.column.getColId())
}

// 3. Formula
const formulaDependencyHooks = {} 
const { 
  pinnedBottomRowData, calculateRowFormulas, calculateTotals, 
  configDialog, isSavingConfig, availableColumns, 
  openConfigDialog, saveConfig, loadGridConfig 
} = useGridFormula(props, gridApi, gridData, activeSummaryConfig, { value: currentUser }, formulaDependencyHooks, columnLockState)

// 4. History
const historyHooks = useGridHistory(props, gridApi, gridData, { calculateRowFormulas, calculateTotals, pinnedBottomRowData })
const { 
  history, isSystemOperation, 
  onCellValueChanged, deleteSelectedRows, pushPendingChange, sanitizeValue,
  debouncedSave, performUndoRedo 
} = historyHooks

const handleCellValueChanged = (params) => {
  onCellValueChanged(params)
  emit('cell-value-changed', params)
}

// 注入公式依赖，解决循环依赖问题
formulaDependencyHooks.pushPendingChange = pushPendingChange
formulaDependencyHooks.triggerSave = debouncedSave

// 5. Clipboard (修复参数传递)
const { handleGlobalPaste, onCellKeyDown } = useGridClipboard(gridApi, historyHooks, selectionHooks)

const defaultColDef = { 
  sortable: true, filter: true, resizable: true, minWidth: 100,
  wrapHeaderText: true,
  autoHeaderHeight: true,
  editable: (params) => !isCellReadOnly(params),
  suppressKeyboardEvent: (params) => {
    const e = params.event; const k = e.key.toLowerCase(); const c = e.ctrlKey || e.metaKey;
    if (c && (k === 'z' || k === 'y')) return true;
    return false;
  }
}
const rowSelectionConfig = { mode: 'multiRow', headerCheckbox: false, checkboxes: false, enableClickSelection: true }
const getRowId = (params) => {
  const data = params.data || {}
  if (data.id !== undefined && data.id !== null) return String(data.id)
  if (data.att_month && (data.employee_id || data.temp_phone || data.temp_name)) {
    const key = data.employee_id || data.temp_phone || data.temp_name
    return `${data.att_month}-${key}`
  }
  return String(params.rowIndex ?? '')
}

const onGridReady = (params) => { 
  gridApi.value = params.api; 
  loadData();
  loadGridConfig();
}

const syncTheme = () => {
  isDark.value = document.documentElement.classList.contains('dark')
}

onMounted(() => {
  syncTheme()
  themeObserver = new MutationObserver(syncTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
})

const onGridMouseLeave = () => {}
const onCellDoubleClicked = (params) => {
  if (!params) return
  if (params.node?.rowPinned === 'bottom') {
    if (!isAdmin) return
    const colId = params.column.colId
    const colName = params.colDef.headerName
    openConfigDialog(colName, colId, isAdmin)
    return
  }
  if (params.node?.rowPinned) return
  if (params.colDef?.type === 'check') {
    const editable = typeof params.colDef.editable === 'function'
      ? params.colDef.editable(params)
      : params.colDef.editable !== false
    if (!editable) return
    const current = !!params.value
    params.node.setDataValue(params.colDef.field, !current)
    return
  }
  if (params.colDef?.type === 'geo') {
    geoDialog.params = params
    geoDialog.visible = true
  }
}

const onColumnHeaderClicked = (params) => {
  const event = params?.event
  const colId = params?.column?.getColId?.()
  if (!event || !colId) return
  const target = event.target
  if (!target || !target.closest) return
  if (!target.closest('.custom-header-label')) return
  selectColumnRange(colId)
}

const onRowSelected = (params) => {
  const event = params?.event
  if (!event) return
  const target = event.target
  if (!target || !target.closest) return
  const isCheckbox = target.closest('.ag-selection-checkbox') || target.closest('.ag-checkbox-input-wrapper') || target.closest('input[type=\"checkbox\"]')
  if (!isCheckbox) return
  selectRowRange(params.node?.rowIndex)
}

const handleCellMouseOut = (params) => {
  if (!params || params.node?.rowPinned) return
  const colDef = params.colDef || {}
  if (colDef.type !== 'check') return
  if (!gridApi.value) return
  if (gridApi.value.getEditingCells().length > 0) {
    gridApi.value.stopEditing()
  }
}

const handleGeoSubmit = (payload) => {
  if (!geoDialog.params?.node || !geoDialog.params?.colDef) return
  const colKey = geoDialog.params.colDef.field
  geoDialog.params.node.setDataValue(colKey, payload)
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
/* 🟢 确保之前的全局样式修复保留 */
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar { width: 16px; height: 16px; }
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb { background-color: var(--el-color-primary-light-5); border-radius: 8px; border: 3px solid transparent; background-clip: content-box; }
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb:hover, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover { background-color: var(--el-color-primary); }
.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-track, .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track { background-color: #f5f7fa; box-shadow: inset 0 0 4px rgba(0,0,0,0.05); }
.ag-theme-alpine .ag-body-viewport { overflow-y: scroll !important; }

.ag-theme-alpine { --ag-font-family: 'Helvetica Neue', Helvetica, Arial, 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei', sans-serif; --ag-font-size: 13px; --ag-foreground-color: #303133; --ag-background-color: #fff; --ag-header-background-color: #f1f3f4; --ag-header-foreground-color: #606266; --ag-header-height: 52px; --ag-row-height: 35px; --ag-borders: solid 1px; --ag-border-color: #dcdfe6; --ag-row-border-color: #e4e7ed; --ag-row-hover-color: #f5f7fa; --ag-selected-row-background-color: rgba(64, 158, 255, 0.1); --ag-input-focus-border-color: var(--el-color-primary); --ag-range-selection-border-color: var(--el-color-primary); --ag-range-selection-border-style: solid; }
.no-user-select { user-select: none; }
.ag-theme-alpine .dynamic-header { font-weight: 600; }
.ag-theme-alpine .ag-cell { border-right: 1px solid var(--ag-border-color); }
.ag-root-wrapper { border: 1px solid var(--el-border-color-light) !important; }

.custom-range-selected { background-color: rgba(0, 120, 215, 0.15) !important; border: 1px solid rgba(0, 120, 215, 0.6) !important; z-index: 1; }
.cell-locked-pattern { background-image: repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 10px, #ffffff 10px, #ffffff 20px); color: #a8abb2; cursor: not-allowed; }
.row-locked-bg { background-color: #fafafa !important; }

.custom-header-wrapper { display: flex !important; align-items: flex-start !important; width: 100%; height: 100%; justify-content: space-between; overflow: visible; }
.custom-header-main { display: flex !important; align-items: flex-start !important; flex: 1; overflow: visible; cursor: pointer; padding-right: 8px; min-width: 0; }
.custom-header-label { overflow: visible; text-overflow: clip; white-space: normal; font-weight: 600; font-size: 13px; color: var(--ag-header-foreground-color); line-height: 16px; word-break: break-all; }
.custom-header-tools { display: flex !important; align-items: center !important; gap: 2px; flex-shrink: 0; }
.custom-header-icon { display: flex !important; align-items: center !important; padding: 4px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.custom-header-icon:hover { background-color: #e6e8eb; }
.header-unlock-icon, .menu-btn { opacity: 0; transition: opacity 0.2s; }
.custom-header-wrapper:hover .header-unlock-icon, .custom-header-wrapper:hover .menu-btn { opacity: 1; }
.ag-theme-alpine .perm-granted-header .custom-header-main { overflow: visible; }
.ag-theme-alpine .perm-granted-header .custom-header-label { overflow: visible; text-overflow: clip; white-space: nowrap; }
.ag-theme-alpine .ag-header-cell-label { align-items: flex-start; overflow: visible !important; }
.ag-theme-alpine .ag-header-cell { overflow: visible !important; }
.ag-theme-alpine .ag-header-cell-text { white-space: normal !important; line-height: 16px; word-break: break-all; overflow: visible !important; text-overflow: clip !important; }

.ag-theme-alpine.ag-theme-dark {
  --ag-foreground-color: #f3f4f6;
  --ag-background-color: #0b0f14;
  --ag-header-background-color: #111827;
  --ag-header-foreground-color: #f9fafb;
  --ag-border-color: #1f2937;
  --ag-row-border-color: #1f2937;
  --ag-row-background-color: #0b0f14;
  --ag-odd-row-background-color: #0b0f14;
  --ag-row-hover-color: rgba(148, 163, 184, 0.18);
  --ag-selected-row-background-color: rgba(56, 139, 253, 0.28);
  --ag-input-focus-border-color: #60a5fa;
}
.ag-theme-alpine.ag-theme-dark .ag-row,
.ag-theme-alpine.ag-theme-dark .ag-row-odd,
.ag-theme-alpine.ag-theme-dark .ag-row-even {
  background-color: #0b0f14;
}
.ag-theme-alpine.ag-theme-dark .ag-body-viewport::-webkit-scrollbar-track,
.ag-theme-alpine.ag-theme-dark .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
  background-color: #0b0f14;
  box-shadow: inset 0 0 4px rgba(0,0,0,0.5);
}
.ag-theme-alpine.ag-theme-dark .ag-body-viewport::-webkit-scrollbar-thumb,
.ag-theme-alpine.ag-theme-dark .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.45);
}
.ag-theme-alpine.ag-theme-dark .ag-body-viewport::-webkit-scrollbar-thumb:hover,
.ag-theme-alpine.ag-theme-dark .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover {
  background-color: rgba(148, 163, 184, 0.7);
}

.status-editor-popup { background-color: #fff; border-radius: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); border: 1px solid #e4e7ed; overflow: hidden; padding: 4px 0; z-index: 9999; }
.status-editor-popup.select-editor-popup { max-height: 120px; overflow-y: auto; overflow-x: hidden; }
.status-editor-item { display: flex !important; align-items: center !important; padding: 8px 12px; cursor: pointer; transition: background-color 0.2s; font-size: 13px; color: #606266; position: relative; }
.status-editor-item:hover { background-color: #f5f7fa; }
.status-editor-item.is-selected { background-color: #ecf5ff; color: #409EFF; font-weight: 500; }
.status-label { margin-left: 0; flex: 1; }
.status-check-mark { width: 6px; height: 6px; border-radius: 50%; background-color: #409EFF; }

.ag-theme-alpine .ag-cell-inline-editing {
  padding: 0 !important;
}

.ag-theme-alpine .ag-cell-inline-editing .ag-input-field-input {
  width: 100%;
  height: 100%;
  line-height: 34px;
  padding: 0 8px;
  box-sizing: border-box;
}

.ag-theme-alpine .ag-cell-inline-editing .ag-cell-edit-wrapper {
  height: 100%;
  display: flex;
  align-items: stretch;
}

.ag-theme-alpine .ag-cell-inline-editing .ag-input-field {
  width: 100%;
  height: 100%;
}
</style>
