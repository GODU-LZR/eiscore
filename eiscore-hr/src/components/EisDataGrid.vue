<template>
  <div class="eis-grid-wrapper">
    <div class="grid-toolbar">
      <el-input 
        v-model="searchText" 
        placeholder="全表搜索..." 
        style="width: 260px" 
        clearable
        @input="onSearch"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      
      <div class="toolbar-actions">
        <slot name="toolbar"></slot>
      </div>
    </div>

    <div class="grid-container">
      <ag-grid-vue
        style="width: 100%; height: 100%;"
        class="ag-theme-alpine"
        :columnDefs="gridColumns"
        :rowData="gridData"
        :defaultColDef="defaultColDef"
        :localeText="AG_GRID_LOCALE_CN"
        :theme="'legacy'" 
        :rowSelection="rowSelectionConfig"
        :loading="isLoading"
        :animateRows="true"
        :getRowId="getRowId"
        :suppressClipboardPaste="false"
        :enterNavigatesVertically="true" 
        :enterNavigatesVerticallyAfterEdit="true"
        @grid-ready="onGridReady"
        @cell-value-changed="onCellValueChanged"
        @cell-key-down="onCellKeyDown"
      >
      </ag-grid-vue>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { AgGridVue } from "ag-grid-vue3"
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { buildSearchQuery } from '@/utils/grid-query'
import { debounce } from 'lodash'

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
ModuleRegistry.registerModules([ AllCommunityModule ]);

import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"

// 全量汉化配置
const AG_GRID_LOCALE_CN = {
  loadingOoo: '数据加载中...',
  noRowsToShow: '暂无数据',
  to: '至',
  of: '共',
  page: '页',
  next: '下一页',
  last: '尾页',
  first: '首页',
  previous: '上一页',
  filterOoo: '筛选...',
  applyFilter: '应用',
  clearFilter: '清除',
  resetFilter: '重置',
  cancelFilter: '取消',
  equals: '等于',
  notEqual: '不等于',
  contains: '包含',
  notContains: '不包含',
  startsWith: '开始于',
  endsWith: '结束于',
  blank: '为空',
  notBlank: '不为空',
  lessThan: '小于',
  greaterThan: '大于',
  lessThanOrEqual: '小于等于',
  greaterThanOrEqual: '大于等于',
  inRange: '在范围内',
  inRangeStart: '从',
  inRangeEnd: '到',
  andCondition: '并且',
  orCondition: '或者',
  pinColumn: '冻结列',
  pinLeft: '冻结到左侧',
  pinRight: '冻结到右侧',
  noPin: '取消冻结',
  autosizeThiscolumn: '自动调整列宽',
  autosizeAllColumns: '自动调整所有列宽',
  resetColumns: '重置列设置',
  copy: '复制 (Ctrl+C)',
  paste: '粘贴 (Ctrl+V)',
  ctrlC: 'Ctrl+C',
  ctrlV: 'Ctrl+V'
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

const rowSelectionConfig = { 
  mode: 'multiRow', 
  headerCheckbox: true, 
  checkboxes: true      
}

const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  editable: true, 
  minWidth: 100,
  flex: 1,
  // 仅设置行高居中，不破坏边框
  cellStyle: { 'line-height': '34px' } 
}

const getRowId = (params) => String(params.data.id)

// 动态生成列定义
const gridColumns = computed(() => {
  const staticCols = props.staticColumns.map(col => ({
    headerName: col.label,
    field: col.prop,
    editable: col.editable !== false,
    cellEditor: 'agTextCellEditor',
    width: col.width,
    flex: col.width ? 0 : 1
  }))

  const dynamicCols = props.extraColumns.map(col => ({
    headerName: col.label,
    field: `properties.${col.prop}`, 
    editable: true,
    // 🟢 关键点：headerClass 用于 CSS 样式，但去掉了颜色的强制指定
    headerClass: 'dynamic-header',
    cellStyle: { 'line-height': '34px' }
  }))

  return [...staticCols, ...dynamicCols]
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

const onCellValueChanged = async (event) => {
  if (event.oldValue === event.newValue) return

  const { data, colDef, newValue } = event
  try {
    let payload = {}
    if (colDef.field.startsWith('properties.')) {
      payload = { properties: data.properties }
    } else {
      payload = { [colDef.field]: newValue }
    }
    
    const nextVersion = (data.version || 1) + 1
    payload.version = nextVersion
    payload.updated_at = new Date().toISOString()

    const res = await request({
      url: `${props.apiUrl}?id=eq.${data.id}&version=eq.${data.version}`,
      method: 'patch',
      headers: { 'Content-Profile': 'hr', 'Prefer': 'return=representation' },
      data: payload
    })

    if (res && res.length > 0) {
      data.version = nextVersion
    } else {
      throw new Error('数据版本冲突，请刷新后重试')
    }
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
    event.node.setDataValue(colDef.field, event.oldValue)
  }
}

const onCellKeyDown = async (e) => {
  const event = e.event
  if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      
      if (!gridApi.value) return 
      const focusedCell = gridApi.value.getFocusedCell()
      if (!focusedCell) return
      
      const rows = text.split(/\r\n|\n|\r/).filter(row => row.trim() !== '')
      const startRowIndex = focusedCell.rowIndex
      const startColId = focusedCell.column.colId
      const allColumns = gridApi.value.getColumns()
      const startColIndex = allColumns.findIndex(c => c.colId === startColId)
      
      rows.forEach((rowStr, rIdx) => {
        const cells = rowStr.split('\t')
        const targetRowNode = gridApi.value.getDisplayedRowAtIndex(startRowIndex + rIdx)
        if (targetRowNode) {
          cells.forEach((cellValue, cIdx) => {
            const targetCol = allColumns[startColIndex + cIdx]
            if (targetCol && targetCol.isCellEditable(targetRowNode)) {
              targetRowNode.setDataValue(targetCol.colId, cellValue.trim())
            }
          })
        }
      })
      ElMessage.success(`成功粘贴 ${rows.length} 条数据`)
    } catch (err) {
      console.error('粘贴失败', err)
    }
  }
}

const onSearch = debounce(() => loadData(), 300)

const onGridReady = (params) => {
  gridApi.value = params.api
  loadData()
}

watch(() => props.extraColumns, () => {}, { deep: true })
defineExpose({ loadData })
</script>

<style scoped lang="scss">
.eis-grid-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 4px;
}
.grid-toolbar {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: #f8f9fa;
}
.toolbar-actions { display: flex; gap: 12px; }
.grid-container { flex: 1; width: 100%; padding: 0; }
</style>

<style lang="scss">
/* Ag-Grid Excel 风格精细化定制 */
.ag-theme-alpine {
  /* 基础字体 */
  --ag-font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --ag-font-size: 13px;
  --ag-foreground-color: #303133; /* 内容全黑 */
  
  /* 颜色 */
  --ag-background-color: #fff;
  --ag-header-background-color: #f1f3f4; /* 浅灰表头 */
  --ag-header-foreground-color: #606266; /* 表头文字：标准灰黑 */
  
  /* 尺寸 */
  --ag-header-height: 32px;
  --ag-row-height: 35px;
  
  /* 边框 */
  --ag-borders: solid 1px;
  --ag-border-color: #dcdfe6;
  --ag-row-border-color: #e4e7ed;
  
  /* 交互 */
  --ag-row-hover-color: #f5f7fa;
  --ag-selected-row-background-color: rgba(64, 158, 255, 0.1);
  --ag-input-focus-border-color: var(--el-color-primary);
  
  --ag-range-selection-border-color: var(--el-color-primary);
  --ag-range-selection-border-style: solid;
}

/* 🟢 修复：删除了 color: var(--el-color-primary) */
.ag-theme-alpine .dynamic-header {
  font-weight: 600; /* 仅保留加粗，颜色继承默认的 #606266 */
}

/* 强制显示竖向网格线 */
.ag-theme-alpine .ag-cell {
  border-right: 1px solid var(--ag-border-color);
}

.ag-root-wrapper {
  border: 1px solid var(--el-border-color-light) !important;
}
</style>