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
            删除行 ({{ selectedRowsCount }})
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
        
        :undoRedoCellEditing="true"
        :undoRedoCellEditingLimit="20"
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
import { ref, computed, watch, reactive, onMounted, onUnmounted } from 'vue'
import { AgGridVue } from "ag-grid-vue3"
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { buildSearchQuery } from '@/utils/grid-query'
import { debounce } from 'lodash'

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
ModuleRegistry.registerModules([ AllCommunityModule ]);

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
  staticColumns: { type: Array, default: () => [] },
  extraColumns: { type: Array, default: () => [] }
})

const gridApi = ref(null)
const gridData = ref([])
const searchText = ref('')
const isLoading = ref(false)
const selectedRowsCount = ref(0)
const isBulkUpdating = ref(false)

const isDragging = ref(false)
const rangeSelection = reactive({
  startRowIndex: -1, startColId: null, endRowIndex: -1, endColId: null, active: false
})

const rowSelectionConfig = { mode: 'multiRow', headerCheckbox: true, checkboxes: true, enableClickSelection: true }
const defaultColDef = { sortable: true, filter: true, resizable: true, editable: true, minWidth: 100, flex: 1 }

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

const cellClassRules = { 'custom-range-selected': (params) => isCellInSelection(params) }

const getCellStyle = (params) => {
  const baseStyle = { 'line-height': '34px' }
  if (params.colDef.editable === false) return { ...baseStyle, backgroundColor: '#f5f7fa', color: '#909399' }
  return baseStyle
}

const gridColumns = computed(() => {
  const staticCols = props.staticColumns.map(col => ({
    headerName: col.label, field: col.prop, editable: col.editable !== false,
    cellEditor: 'agTextCellEditor', width: col.width, flex: col.width ? 0 : 1,
    cellStyle: getCellStyle, cellClassRules: cellClassRules 
  }))
  const dynamicCols = props.extraColumns.map(col => ({
    headerName: col.label, field: `properties.${col.prop}`, editable: true,
    headerClass: 'dynamic-header', cellStyle: getCellStyle, cellClassRules: cellClassRules
  }))
  return [...staticCols, ...dynamicCols]
})

watch(isLoading, (val) => {
  if (!gridApi.value) return
  gridApi.value.setGridOption('loading', val)
})

// 🟢 注册全局事件
onMounted(() => { 
  document.addEventListener('mouseup', onGlobalMouseUp)
  document.addEventListener('paste', handleGlobalPaste) // 监听全局粘贴
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

const onCellValueChanged = async (event) => {
  if (isBulkUpdating.value) return 
  if (event.oldValue === event.newValue) return

  const { data, colDef, newValue } = event
  const safeValue = sanitizeValue(colDef.field, newValue)
  
  try {
    const nextVersion = (data.version || 1) + 1
    const payload = buildCompletePayload(data)
    payload.version = nextVersion
    
    if (colDef.field.startsWith('properties.')) {
      const propKey = colDef.field.split('.')[1]
      payload.properties[propKey] = safeValue
    } else {
      payload[colDef.field] = safeValue
    }

    const res = await request({
      url: `${props.apiUrl}?id=eq.${data.id}&version=eq.${data.version}`,
      method: 'patch',
      headers: { 'Content-Profile': 'hr', 'Prefer': 'return=representation' },
      data: payload
    })

    if (res && res.length > 0) {
      data.version = nextVersion
      if (colDef.field.startsWith('properties.')) {
         data.properties = payload.properties
      } else {
         data[colDef.field] = safeValue
      }
      if (newValue !== safeValue) {
        event.node.setDataValue(colDef.field, safeValue)
      }
    } else {
      throw new Error('版本冲突')
    }
  } catch (e) {
    console.error(e)
    const msg = e.response?.data?.message || e.message
    ElMessage.error('保存失败: ' + msg)
    event.node.setDataValue(colDef.field, event.oldValue)
  }
}

const executeBatchUpdate = async (updates) => {
  if (updates.length === 0) return
  isBulkUpdating.value = true
  
  try {
    const rowUpdatesMap = new Map()
    
    updates.forEach(({ rowNode, colDef, value }) => {
      const safeValue = sanitizeValue(colDef.field, value)
      const id = rowNode.data.id
      if (!rowUpdatesMap.has(id)) {
        const basePayload = buildCompletePayload(rowNode.data)
        rowUpdatesMap.set(id, { 
          rowNode, 
          payload: basePayload, 
          properties: basePayload.properties 
        })
      }
      
      const group = rowUpdatesMap.get(id)
      rowNode.setDataValue(colDef.field, safeValue)
      
      if (colDef.field.startsWith('properties.')) {
        const propKey = colDef.field.split('.')[1]
        group.properties[propKey] = safeValue
      } else {
        group.payload[colDef.field] = safeValue
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
        headers: { 
          'Content-Profile': 'hr', 
          'Prefer': 'resolution=merge-duplicates,return=representation' 
        },
        data: apiPayload
      })
      
      affectedNodes.forEach(({ node, newVer }) => {
        node.data.version = newVer
      })
      
      ElMessage.success(`成功更新 ${apiPayload.length} 行数据`)
    }
    
  } catch (e) {
    console.error(e)
    const msg = e.response?.data?.message || e.message
    if (msg.includes('not-null constraint')) {
      ElMessage.error('保存失败：不能清空必填字段')
    } else {
      ElMessage.error('批量更新失败: ' + msg)
    }
    loadData() 
  } finally {
    setTimeout(() => { isBulkUpdating.value = false }, 100)
  }
}

const deleteSelectedRows = async () => {
  const selectedNodes = gridApi.value.getSelectedNodes()
  if (selectedNodes.length === 0) return

  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedNodes.length} 条数据吗？`, '警告', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
    
    const ids = selectedNodes.map(n => n.data.id)
    await request({ 
      url: `${props.apiUrl}?id=in.(${ids.join(',')})`, 
      method: 'delete' 
    })
    
    gridApi.value.applyTransaction({ remove: selectedNodes.map(node => node.data) })
    ElMessage.success('删除成功')
    selectedRowsCount.value = 0
  } catch (e) { 
    if (e !== 'cancel') ElMessage.error('删除失败: ' + e.message) 
  }
}

// 🟢 全局粘贴处理 (修复"初次粘贴无效"问题)
const handleGlobalPaste = async (event) => {
  // 1. 基础检查
  if (!gridApi.value) return

  // 2. 智能避让：如果焦点在 input/textarea 且不是 Ag-Grid 内部的编辑器，则跳过
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    // 检查这个 input 是否属于当前表格 (class: ag-root-wrapper)
    // 如果不属于(比如顶部的搜索框)，则不执行表格粘贴
    if (!activeEl.closest('.ag-root-wrapper')) {
      return 
    }
  }

  // 3. 检查是否有选中区域 (Range 或 Focus)
  const focusedCell = gridApi.value.getFocusedCell()
  const hasRange = rangeSelection.active
  
  // 如果用户完全没点过表格，不要乱贴
  if (!focusedCell && !hasRange) return

  // 4. 获取数据
  const clipboardData = event.clipboardData || window.clipboardData
  if (!clipboardData) return
  const text = clipboardData.getData('text')
  if (!text) return

  // --- 粘贴逻辑复用 ---
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
    // 即使 rangeSelection 未激活，只要有 focusCell 也可以粘贴
    if (focusedCell) {
      startRowIdx = focusedCell.rowIndex;
      startColIdx = getColIndex(focusedCell.column.colId);
    }
  }
  if (startRowIdx === -1 || startColIdx === -1) return;

  const allCols = gridApi.value.getAllGridColumns();
  const updates = [] 

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
          updates.push({ rowNode, colDef: col.getColDef(), value: valToPaste })
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
            updates.push({ rowNode, colDef: col.getColDef(), value: cellValue.trim() })
          }
        }
      }
    }
  }
  
  await executeBatchUpdate(updates)
}

const onCellKeyDown = async (e) => {
  const event = e.event
  const key = event.key
  if (!gridApi.value) return
  
  if (key === 'Delete' || key === 'Backspace') {
    const updates = []
    const addUpdate = (rowNode, col) => {
      if (col.isCellEditable(rowNode)) {
        updates.push({ rowNode, colDef: col.getColDef(), value: null })
      }
    }

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
            addUpdate(rowNode, col)
          }
        }
      }
    } else {
      const focusedCell = gridApi.value.getFocusedCell()
      if (focusedCell) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(focusedCell.rowIndex)
        const col = gridApi.value.getColumn(focusedCell.column.colId)
        addUpdate(rowNode, col)
      }
    }
    await executeBatchUpdate(updates)
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
        if (field) {
           val = field.split('.').reduce((obj, key) => obj?.[key], rowNode.data)
        }
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
</style>