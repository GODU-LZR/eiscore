<template>
  <div class="eis-grid-wrapper">
    <div class="grid-toolbar">
      <div class="left-tools">
        <el-input 
          v-model="searchText" 
          placeholder="搜索全表..." 
          style="width: 240px" 
          clearable
          @input="onSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        
        <el-button-group class="ml-2">
          <el-button type="danger" plain icon="Delete" @click="deleteSelectedRows" :disabled="selectedRowsCount === 0">
            删除选中行 ({{ selectedRowsCount }})
          </el-button>
          <el-button plain icon="Download" @click="exportData">
            导出表格
          </el-button>
        </el-button-group>

        <div class="tip-text" v-if="rangeSelection.active">
          已选中: {{ realRangeRowCount }} 行 x {{ realRangeColCount }} 列
        </div>
      </div>
      
      <div class="toolbar-actions">
        <slot name="toolbar"></slot>
      </div>
    </div>

    <div class="grid-container" @mouseleave="onGridMouseLeave">
      <ag-grid-vue
        ref="agGridRef"
        style="width: 100%; height: 100%;"
        class="ag-theme-alpine no-user-select"
        :columnDefs="gridColumns"
        :rowData="gridData"
        :defaultColDef="defaultColDef"
        :localeText="AG_GRID_LOCALE_CN"
        :theme="'legacy'" 
        :rowSelection="rowSelectionConfig"
        :animateRows="true"
        :getRowId="getRowId"
        
        :context="context" 
        :components="gridComponents"
        
        :undoRedoCellEditing="true"
        :undoRedoCellEditingLimit="50"
        :enableCellChangeFlash="true"
        :suppressClipboardPaste="true" 
        :enterNavigatesVertically="true" 
        :enterNavigatesVerticallyAfterEdit="true"
        
        @grid-ready="onGridReady"
        @cell-value-changed="onCellValueChanged"
        @cell-key-down="onCellKeyDown"
        @selection-changed="onSelectionChanged"
        
        @cell-mouse-down="onCellMouseDown"
        @cell-mouse-over="onCellMouseOver"
        @cell-context-menu="onCellContextMenu"
      >
      </ag-grid-vue>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, onMounted, onUnmounted, defineComponent, h, markRaw } from 'vue'
import { AgGridVue } from "ag-grid-vue3"
import request from '@/utils/request'
import { ElMessage, ElMessageBox, ElTooltip, ElIcon } from 'element-plus'
import { Lock, Unlock, Search, Delete, Download } from '@element-plus/icons-vue'
import { buildSearchQuery } from '@/utils/grid-query'
import { debounce } from 'lodash'
import { useUserStore } from '@/stores/user' 

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
ModuleRegistry.registerModules([ AllCommunityModule ]);

import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"

// --- 🟢 自定义组件定义区 ---

// 1. 行头锁图标渲染器
const LockActionRenderer = defineComponent({
  props: ['params'],
  setup(props) {
    const isLocked = computed(() => !!props.params.data?.properties?.row_locked_by)
    const lockedBy = computed(() => props.params.data?.properties?.row_locked_by || '系统')
    
    const onClick = (e) => {
      e.stopPropagation() 
      const handler = props.params?.context?.componentParent?.toggleRowLock || props.params?.onClickLock
      if (handler) {
        handler(props.params.data)
      }
    }

    return () => h('div', { 
      class: 'lock-action-cell', 
      onClick: onClick,
      style: { cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }
    }, [
      isLocked.value 
        ? h(ElTooltip, { content: `该行被 [${lockedBy.value}] 锁定`, placement: 'right' }, { default: () => h(ElIcon, { color: '#F56C6C', size: 16 }, { default: () => h(Lock) }) })
        : h(ElIcon, { class: 'unlock-icon-hover', size: 16, color: '#DCDFE6' }, { default: () => h(Unlock) })
    ])
  }
})

// 2. 自定义表头组件
const LockHeader = defineComponent({
  props: ['params'],
  setup(props) {
    const colId = props.params.column.colId
    // 通过 context 获取状态
    const gridComp = props.params.context.componentParent
    const lockInfo = computed(() => gridComp.columnLockState[colId])
    const isLocked = computed(() => !!lockInfo.value)
    
    const sortState = ref(props.params.column.getSort())
    const onSortChanged = () => {
      sortState.value = props.params.column.getSort()
    }
    const onLabelClick = () => {
      props.params.progressSort()
    }
    
    const onLockClick = (e) => {
      e.stopPropagation()
      gridComp.toggleColumnLock(colId)
    }

    const onMenuClick = (e) => {
      e.stopPropagation()
      if (props.params.showColumnMenu) {
        props.params.showColumnMenu(e.currentTarget)
      }
    }

    onMounted(() => {
      props.params.column.addEventListener('sortChanged', onSortChanged)
    })
    onUnmounted(() => {
      props.params.column.removeEventListener('sortChanged', onSortChanged)
    })

    return () => h('div', { class: 'custom-header-wrapper' }, [
      h('span', { class: 'custom-header-label', onClick: onLabelClick }, props.params.displayName),
      h('span', { class: 'custom-header-icons' }, [
        h('span', { class: 'ag-header-icon ag-header-cell-menu-button', onClick: onMenuClick }, [
          h('span', { class: 'ag-icon ag-icon-menu' })
        ]),
        h('span', { class: 'ag-header-icon ag-sort-indicator-icon' }, [
          h('span', { class: `ag-icon ag-icon-${sortState.value || 'none'}` })
        ])
      ]),
      h('span', { class: 'custom-header-lock', onClick: onLockClick }, [
        isLocked.value
          ? h(ElTooltip, { content: `该列被 [${lockInfo.value}] 锁定`, placement: 'top' }, { default: () => h(ElIcon, { color: '#F56C6C' }, { default: () => h(Lock) }) })
          : h(ElIcon, { class: 'header-unlock-icon', color: '#909399' }, { default: () => h(Unlock) })
      ])
    ])
  }
})

// --- 🟢 主逻辑区 ---

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
  staticColumns: { type: Array, default: () => [] },
  extraColumns: { type: Array, default: () => [] }
})

const userStore = useUserStore()
const currentUser = computed(() => userStore.userInfo?.username || 'Admin')

const gridApi = ref(null)
const gridData = ref([])
const searchText = ref('')
const isLoading = ref(false)
const selectedRowsCount = ref(0)
const pendingChanges = [] 
const isRemoteUpdating = ref(false) 

const columnLockState = reactive({})

const isDragging = ref(false)
const rangeSelection = reactive({
  startRowIndex: -1, startColId: null, endRowIndex: -1, endColId: null, active: false
})

const rowSelectionConfig = { mode: 'multiRow', headerCheckbox: true, checkboxes: true, enableClickSelection: true }

const isCellReadOnly = (params) => {
  const colId = params.colDef.field
  const rowData = params.data
  if (columnLockState[colId]) return true
  if (rowData?.properties?.row_locked_by) return true
  return false
}

const defaultColDef = { 
  sortable: true, filter: true, resizable: true, minWidth: 100, flex: 1,
  editable: (params) => !isCellReadOnly(params)
}

const getRowId = (params) => String(params.data.id)

const getColIndex = (colId) => {
  if (!gridApi.value) return -1
  const allCols = gridApi.value.getAllGridColumns()
  return allCols.findIndex(c => c.getColId() === colId)
}

const isCellInSelection = (params) => {
  if (!rangeSelection.active) return false
  const rowIndex = params.node.rowIndex
  const colId = params.column.colId
  const startColIdx = getColIndex(rangeSelection.startColId)
  const endColIdx = getColIndex(rangeSelection.endColId)
  const currentColIdx = getColIndex(colId)
  if (startColIdx === -1 || endColIdx === -1 || currentColIdx === -1) return false
  
  const minRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
  const maxRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)
  return rowIndex >= minRow && rowIndex <= maxRow && currentColIdx >= minCol && currentColIdx <= maxCol
}

const cellClassRules = { 
  'custom-range-selected': (params) => isCellInSelection(params),
  'cell-locked-pattern': (params) => isCellReadOnly(params)
}

const getCellStyle = (params) => {
  const baseStyle = { 'line-height': '34px' }
  if (params.colDef.editable === false) return { ...baseStyle, backgroundColor: '#f5f7fa', color: '#909399' }
  return baseStyle
}

const updateRowDataCache = (nextData) => {
  const index = gridData.value.findIndex((row) => String(row.id) === String(nextData.id))
  if (index !== -1) {
    gridData.value.splice(index, 1, nextData)
  }
}

// --- 锁定逻辑实现 ---

const handleToggleRowLock = async (rowData) => {
  if (!gridApi.value) return
  const isLocked = !!rowData.properties?.row_locked_by
  const newLockState = isLocked ? null : currentUser.value
  
  const rowNode = gridApi.value.getRowNode(String(rowData.id))
  const nextProperties = { ...(rowData.properties || {}), row_locked_by: newLockState }
  const nextData = { ...rowData, properties: nextProperties }
  if (rowNode) {
    rowNode.setData(nextData)
    updateRowDataCache(nextData)
    gridApi.value.refreshCells({ rowNodes: [rowNode], force: true })
  }

  try {
    const payload = buildCompletePayload(nextData)
    await request({
      url: `${props.apiUrl}?id=eq.${rowData.id}`,
      method: 'patch',
      headers: { 'Content-Profile': 'hr', 'Prefer': 'return=representation' },
      data: payload
    })
    ElMessage.success(isLocked ? '已解锁该行' : '已锁定该行')
  } catch (e) {
    ElMessage.error('锁定操作失败')
    const rollbackProperties = { ...(rowData.properties || {}), row_locked_by: isLocked ? currentUser.value : null }
    const rollbackData = { ...rowData, properties: rollbackProperties }
    if (rowNode) {
      rowNode.setData(rollbackData)
      updateRowDataCache(rollbackData)
      gridApi.value.refreshCells({ rowNodes: [rowNode], force: true })
    }
  }
}

const handleToggleColumnLock = (colId) => {
  if (columnLockState[colId]) {
    delete columnLockState[colId]
    ElMessage.success('列已解锁')
  } else {
    columnLockState[colId] = currentUser.value
    ElMessage.success('列已锁定')
  }
  gridApi.value.refreshCells({ force: true })
  gridApi.value.refreshHeader()
}

// 🟢 关键：Context 对象，必须传给 Ag-Grid
const context = markRaw({
  componentParent: {
    toggleRowLock: handleToggleRowLock,
    toggleColumnLock: handleToggleColumnLock,
    columnLockState 
  }
})

const gridComponents = {
  LockActionRenderer,
  LockHeader
}

const gridColumns = computed(() => {
  const actionCol = {
    headerName: '',
    field: '_row_lock_status',
    width: 50,
    pinned: 'left',
    filter: false,
    sortable: false,
    resizable: false,
    editable: false,
    cellRenderer: 'LockActionRenderer',
    cellRendererParams: {
      onClickLock: handleToggleRowLock
    },
    cellStyle: { 'display': 'flex', 'justify-content': 'center', 'align-items': 'center', 'padding': 0 }
  }

  const staticCols = props.staticColumns.map(col => ({
    headerName: col.label, field: col.prop, 
    editable: col.editable !== false ? (params) => !isCellReadOnly(params) : false,
    cellEditor: 'agTextCellEditor', width: col.width, flex: col.width ? 0 : 1,
    cellStyle: getCellStyle, 
    cellClassRules: cellClassRules,
    headerComponent: 'LockHeader'
  }))
  
  const dynamicCols = props.extraColumns.map(col => ({
    headerName: col.label, field: `properties.${col.prop}`, 
    editable: (params) => !isCellReadOnly(params),
    headerClass: 'dynamic-header', 
    cellStyle: getCellStyle, 
    cellClassRules: cellClassRules,
    headerComponent: 'LockHeader'
  }))
  
  return [actionCol, ...staticCols, ...dynamicCols]
})

watch(isLoading, (val) => {
  if (!gridApi.value) return
  gridApi.value.setGridOption('loading', val)
})

onMounted(() => { 
  document.addEventListener('mouseup', onGlobalMouseUp)
  document.addEventListener('paste', handleGlobalPaste)
})

onUnmounted(() => { 
  document.removeEventListener('mouseup', onGlobalMouseUp)
  document.removeEventListener('paste', handleGlobalPaste)
})

const onGlobalMouseUp = () => { if (isDragging.value) isDragging.value = false }

const onCellMouseDown = (params) => {
  if (params.event.button !== 0) return 
  isDragging.value = true
  rangeSelection.startRowIndex = params.node.rowIndex
  rangeSelection.startColId = params.column.colId
  rangeSelection.endRowIndex = params.node.rowIndex
  rangeSelection.endColId = params.column.colId
  rangeSelection.active = true
  gridApi.value.refreshCells({ force: true })
}

const onCellMouseOver = (params) => {
  if (!isDragging.value) return
  if (rangeSelection.endRowIndex !== params.node.rowIndex || rangeSelection.endColId !== params.column.colId) {
    rangeSelection.endRowIndex = params.node.rowIndex
    rangeSelection.endColId = params.column.colId
    gridApi.value.refreshCells({ force: true }) 
  }
}

const onGridMouseLeave = () => { }
const onCellContextMenu = () => { isDragging.value = false }

const realRangeRowCount = computed(() => {
  if (!rangeSelection.active) return 0
  return Math.abs(rangeSelection.endRowIndex - rangeSelection.startRowIndex) + 1
})
const realRangeColCount = computed(() => {
  if (!rangeSelection.active) return 0
  const startIdx = getColIndex(rangeSelection.startColId)
  const endIdx = getColIndex(rangeSelection.endColId)
  if (startIdx === -1 || endIdx === -1) return 0
  return Math.abs(endIdx - startIdx) + 1
})

const loadData = async () => {
  isLoading.value = true 
  try {
    let url = `${props.apiUrl}?order=id.desc`
    if (searchText.value) {
      url += buildSearchQuery(searchText.value, props.staticColumns, props.extraColumns)
    }
    const res = await request({ url, method: 'get' })
    gridData.value = res
  } catch (e) {
    console.error(e)
    ElMessage.error('数据加载失败')
  } finally {
    isLoading.value = false 
  }
}

const buildCompletePayload = (rowData) => {
  const payload = JSON.parse(JSON.stringify(rowData))
  if (!payload.properties) payload.properties = {}
  payload.updated_at = new Date().toISOString()
  return payload
}

const sanitizeValue = (field, value) => {
  const key = field.includes('.') ? field.split('.').pop() : field
  const textFields = ['name', 'code', 'employee_id', 'username', 'email', 'phone', 'id_card', 'address']
  const isEmpty = value === null || value === undefined || value === ''
  if (isEmpty) {
    if (textFields.includes(key)) return "" 
    return null 
  }
  return value
}

const onCellValueChanged = (event) => {
  if (isRemoteUpdating.value || event.oldValue === event.newValue) return
  const safeValue = sanitizeValue(event.colDef.field, event.newValue)
  
  if (safeValue !== event.newValue) {
    isRemoteUpdating.value = true
    event.node.setDataValue(event.colDef.field, safeValue)
    isRemoteUpdating.value = false
  }

  pendingChanges.push({
    rowNode: event.node,
    colDef: event.colDef,
    newValue: safeValue,
    oldValue: event.oldValue
  })
  debouncedSave()
}

const debouncedSave = debounce(async () => {
  if (pendingChanges.length === 0) return
  const changesToProcess = [...pendingChanges]
  pendingChanges.length = 0
  
  isRemoteUpdating.value = true 
  
  try {
    const rowUpdatesMap = new Map()
    changesToProcess.forEach(({ rowNode, colDef, newValue }) => {
      const id = rowNode.data.id
      if (!rowUpdatesMap.has(id)) {
        const basePayload = buildCompletePayload(rowNode.data)
        rowUpdatesMap.set(id, { 
          rowNode, payload: basePayload, properties: basePayload.properties 
        })
      }
      const group = rowUpdatesMap.get(id)
      if (colDef.field.startsWith('properties.')) {
        const propKey = colDef.field.split('.')[1]
        group.properties[propKey] = newValue
      } else {
        group.payload[colDef.field] = newValue
      }
    })
    
    const apiPayload = []
    const affectedNodes = []
    for (const group of rowUpdatesMap.values()) {
      group.payload.version = (group.payload.version || 1) + 1
      apiPayload.push(group.payload)
      affectedNodes.push({ node: group.rowNode, newVer: group.payload.version })
    }
    
    if (apiPayload.length > 0) {
      await request({
        url: `${props.apiUrl}`, 
        method: 'post',
        headers: { 'Content-Profile': 'hr', 'Prefer': 'resolution=merge-duplicates,return=representation' },
        data: apiPayload
      })
      affectedNodes.forEach(({ node, newVer }) => { node.data.version = newVer })
      ElMessage.success(`已保存 ${apiPayload.length} 行变更`)
    }
  } catch (e) {
    console.error(e)
    const msg = e.response?.data?.message || e.message
    ElMessage.error('保存失败，正在回滚... (' + msg + ')')
    for (let i = changesToProcess.length - 1; i >= 0; i--) {
      const change = changesToProcess[i]
      change.rowNode.setDataValue(change.colDef.field, change.oldValue)
    }
  } finally {
    setTimeout(() => { isRemoteUpdating.value = false }, 50)
  }
}, 100)

const deleteSelectedRows = async () => {
  const selectedNodes = gridApi.value.getSelectedNodes()
  if (selectedNodes.length === 0) return

  const lockedNodes = selectedNodes.filter(n => n.data.properties?.row_locked_by)
  if (lockedNodes.length > 0) {
    return ElMessage.warning(`选中行中有 ${lockedNodes.length} 行已被锁定，无法删除`)
  }

  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedNodes.length} 条数据吗？`, '警告', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
    
    const ids = selectedNodes.map(n => n.data.id)
    await request({ url: `${props.apiUrl}?id=in.(${ids.join(',')})`, method: 'delete' })
    gridApi.value.applyTransaction({ remove: selectedNodes.map(node => node.data) })
    ElMessage.success('删除成功')
    selectedRowsCount.value = 0
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败: ' + e.message) }
}

const handleGlobalPaste = async (event) => {
  if (!gridApi.value) return
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    if (!activeEl.closest('.ag-root-wrapper')) return 
  }

  const focusedCell = gridApi.value.getFocusedCell()
  const hasRange = rangeSelection.active
  if (!focusedCell && !hasRange) return

  const clipboardData = event.clipboardData || window.clipboardData
  if (!clipboardData) return
  const text = clipboardData.getData('text')
  if (!text) return

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let rows = cleanText.split('\n');
  if (rows[rows.length - 1] === '') rows.pop(); 

  const pasteMatrix = rows.map(row => row.split('\t'));
  const pasteRowCount = pasteMatrix.length;
  const pasteColCount = pasteMatrix.length > 0 ? pasteMatrix[0].length : 0;
  if (pasteRowCount === 0) return;

  const isSingleValue = pasteRowCount === 1 && pasteColCount === 1;
  const isMultiCellSelection = realRangeRowCount.value > 1 || realRangeColCount.value > 1;

  let startRowIdx = -1, startColIdx = -1;
  if (rangeSelection.active) {
    startRowIdx = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex);
    const sC = getColIndex(rangeSelection.startColId);
    const eC = getColIndex(rangeSelection.endColId);
    startColIdx = Math.min(sC, eC);
  } else {
    if (focusedCell) {
      startRowIdx = focusedCell.rowIndex;
      startColIdx = getColIndex(focusedCell.column.colId);
    }
  }
  if (startRowIdx === -1 || startColIdx === -1) return;

  const allCols = gridApi.value.getAllGridColumns();

  if (isSingleValue && isMultiCellSelection && rangeSelection.active) {
    const valToPaste = pasteMatrix[0][0].trim();
    const endRowIdx = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex);
    const sC = getColIndex(rangeSelection.startColId);
    const eC = getColIndex(rangeSelection.endColId);
    const endColIdx = Math.max(sC, eC);

    for (let r = startRowIdx; r <= endRowIdx; r++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(r);
      for (let c = startColIdx; c <= endColIdx; c++) {
        const col = allCols[c];
        if (col && col.isCellEditable(rowNode)) {
          rowNode.setDataValue(col.getColDef().field, valToPaste)
        }
      }
    }
  } else {
    for (let i = 0; i < pasteRowCount; i++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(startRowIdx + i);
      if (!rowNode) break; 
      for (let j = 0; j < pasteColCount; j++) {
        const colIndex = startColIdx + j;
        if (colIndex < allCols.length) {
          const col = allCols[colIndex];
          const cellValue = pasteMatrix[i][j];
          if (col && col.isCellEditable(rowNode)) {
            rowNode.setDataValue(col.getColDef().field, cellValue.trim())
          }
        }
      }
    }
  }
}

const onCellKeyDown = async (e) => {
  const event = e.event
  const key = event.key
  if (!gridApi.value) return
  
  if (key === 'Delete' || key === 'Backspace') {
    if (rangeSelection.active) {
      const startIdx = getColIndex(rangeSelection.startColId)
      const endIdx = getColIndex(rangeSelection.endColId)
      const minRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      const maxRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      const minCol = Math.min(startIdx, endIdx)
      const maxCol = Math.max(startIdx, endIdx)
      const allCols = gridApi.value.getAllGridColumns()

      for (let r = minRow; r <= maxRow; r++) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
        if (rowNode) {
          for (let c = minCol; c <= maxCol; c++) {
            const col = allCols[c]
            if (col.isCellEditable(rowNode)) {
              rowNode.setDataValue(col.getColDef().field, null)
            }
          }
        }
      }
    } else {
      const focusedCell = gridApi.value.getFocusedCell()
      if (focusedCell) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(focusedCell.rowIndex)
        const col = gridApi.value.getColumn(focusedCell.column.colId)
        if (col.isCellEditable(rowNode)) {
          rowNode.setDataValue(col.getColDef().field, null)
        }
      }
    }
    return
  }

  if ((event.ctrlKey || event.metaKey) && key === 'c') {
    const focusedCell = gridApi.value.getFocusedCell()
    const isRangeActive = rangeSelection.active
    if (!isRangeActive && !focusedCell) return

    let startRow, endRow, startCol, endCol
    if (isRangeActive) {
      startRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      endRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
      const idx1 = getColIndex(rangeSelection.startColId)
      const idx2 = getColIndex(rangeSelection.endColId)
      startCol = Math.min(idx1, idx2)
      endCol = Math.max(idx1, idx2)
    } else {
      startRow = endRow = focusedCell.rowIndex
      startCol = endCol = getColIndex(focusedCell.column.colId)
    }

    const allCols = gridApi.value.getAllGridColumns()
    let clipboardText = ''

    for (let r = startRow; r <= endRow; r++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
      if (!rowNode) continue
      let rowCells = []
      for (let c = startCol; c <= endCol; c++) {
        const col = allCols[c]
        if (!col) continue
        const field = col.getColDef().field
        let val = null
        if (field) val = field.split('.').reduce((obj, key) => obj?.[key], rowNode.data)
        const strVal = (val === null || val === undefined) ? '' : String(val)
        rowCells.push(strVal)
      }
      clipboardText += rowCells.join('\t') + (r === endRow ? '' : '\n')
    }

    const copyToClipboard = async (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text)
        } else {
          const textArea = document.createElement("textarea")
          textArea.value = text
          textArea.style.position = "fixed"; textArea.style.left = "-9999px";
          document.body.appendChild(textArea)
          textArea.focus(); textArea.select();
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        ElMessage.success(`已复制 ${Math.abs(endRow - startRow) + 1} 行`)
      } catch(e) { ElMessage.error('复制失败') }
    }
    
    await copyToClipboard(clipboardText)
    event.preventDefault()
    return
  }
}

const onSelectionChanged = () => {
  const selectedNodes = gridApi.value.getSelectedNodes()
  selectedRowsCount.value = selectedNodes.length
}
const exportData = () => { gridApi.value.exportDataAsCsv({ fileName: '导出数据.csv' }) }
const onSearch = debounce(() => loadData(), 300)
const onGridReady = (params) => { gridApi.value = params.api; loadData() }
watch(() => props.extraColumns, () => {}, { deep: true })
defineExpose({ loadData })
</script>

<style scoped lang="scss">
.eis-grid-wrapper { height: 100%; display: flex; flex-direction: column; background-color: #fff; border-radius: 4px; }
.grid-toolbar { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--el-border-color-light); background-color: #f8f9fa; }
.left-tools { display: flex; align-items: center; }
.ml-2 { margin-left: 8px; }
.tip-text { margin-left: 12px; font-size: 12px; color: #909399; font-family: monospace; }
.toolbar-actions { display: flex; gap: 12px; }
.grid-container { flex: 1; width: 100%; padding: 0; }
</style>

<style lang="scss">
.ag-theme-alpine { --ag-font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; --ag-font-size: 13px; --ag-foreground-color: #303133; --ag-background-color: #fff; --ag-header-background-color: #f1f3f4; --ag-header-foreground-color: #606266; --ag-header-height: 32px; --ag-row-height: 35px; --ag-borders: solid 1px; --ag-border-color: #dcdfe6; --ag-row-border-color: #e4e7ed; --ag-row-hover-color: #f5f7fa; --ag-selected-row-background-color: rgba(64, 158, 255, 0.1); --ag-input-focus-border-color: var(--el-color-primary); --ag-range-selection-border-color: var(--el-color-primary); --ag-range-selection-border-style: solid; }
.no-user-select { user-select: none; }
.ag-theme-alpine .dynamic-header { font-weight: 600; }
.ag-theme-alpine .ag-cell { border-right: 1px solid var(--ag-border-color); }
.ag-root-wrapper { border: 1px solid var(--el-border-color-light) !important; }
.custom-range-selected { background-color: rgba(0, 120, 215, 0.15) !important; border: 1px solid rgba(0, 120, 215, 0.6) !important; z-index: 1; }

.cell-locked-pattern {
  background-image: linear-gradient(45deg, #f0f0f0 25%, #fafafa 25%, #fafafa 50%, #f0f0f0 50%, #f0f0f0 75%, #fafafa 75%, #fafafa 100%);
  background-size: 10px 10px;
  color: #909399;
}

.custom-header-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
}
.custom-header-label {
  cursor: pointer;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.custom-header-lock {
  cursor: pointer;
  margin-left: 4px;
  display: flex;
  align-items: center;
}
.header-unlock-icon {
  opacity: 0;
  transition: opacity 0.2s;
}
.custom-header-wrapper:hover .header-unlock-icon {
  opacity: 1;
}
.unlock-icon-hover {
  opacity: 0;
  transition: opacity 0.2s;
}
.lock-action-cell:hover .unlock-icon-hover {
  opacity: 1;
}
</style>