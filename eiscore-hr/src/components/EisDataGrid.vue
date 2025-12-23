<template>
  <div class="eis-grid-wrapper">
    <div class="grid-toolbar">
      <el-input 
        v-model="searchText" 
        placeholder="输入关键词搜索..." 
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

// 🟢 模块注册
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
ModuleRegistry.registerModules([ AllCommunityModule ]);

// 🟢 引入样式 (Legacy模式必须引入)
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"

// 🟢 汉化配置
const AG_GRID_LOCALE_CN = {
  loadingOoo: '加载中...',
  noRowsToShow: '暂无数据',
  to: '至',
  of: '共',
  page: '页',
  next: '下一页',
  last: '尾页',
  first: '首页',
  previous: '上一页',
  filterOoo: '筛选...',
  equals: '等于',
  notEqual: '不等于',
  contains: '包含',
  notContains: '不包含',
  startsWith: '开始于',
  endsWith: '结束于',
  andCondition: '并且',
  orCondition: '或者',
  copy: '复制',
  ctrlC: 'Ctrl+C',
  paste: '粘贴',
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
const isLoading = ref(false) // 🟢 新增 loading 状态

// 🟢 v35 新版选择配置
const rowSelectionConfig = { 
  mode: 'multiRow', 
  headerCheckbox: true, // 表头全选框
  checkboxes: true      // 行选框
}

// 1. Ag-Grid 默认配置
const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  editable: true, 
  minWidth: 100,
  flex: 1,
  cellStyle: { display: 'flex', alignItems: 'center' } 
}

// 🟢 修复 ID 类型警告：必须返回字符串
const getRowId = (params) => String(params.data.id)

// 2. 动态生成列定义
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
    headerClass: 'dynamic-header',
    cellStyle: { color: 'var(--el-color-primary)', display: 'flex', alignItems: 'center' }
  }))

  return [...staticCols, ...dynamicCols]
})

// 3. 加载数据
const loadData = async () => {
  isLoading.value = true // 🟢 开启 Loading
  
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
    isLoading.value = false // 🟢 关闭 Loading
  }
}

// 4. 改一个存一个
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

// 5. 粘贴功能
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
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--el-border-color-light);
}

.toolbar-actions {
  display: flex;
  gap: 12px;
}

.grid-container {
  flex: 1;
  width: 100%;
  padding: 0; 
}
</style>

<style lang="scss">
/* Ag-Grid 主题定制 */
.ag-theme-alpine {
  --ag-font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
  --ag-font-size: 14px;
  --ag-foreground-color: var(--el-text-color-primary);
  --ag-background-color: #fff;
  
  --ag-header-background-color: var(--el-fill-color-light);
  --ag-header-foreground-color: var(--el-text-color-regular);
  --ag-header-height: 40px;
  
  --ag-row-height: 40px;
  --ag-odd-row-background-color: var(--el-fill-color-lighter);
  --ag-row-hover-color: var(--el-fill-color);
  --ag-selected-row-background-color: var(--el-color-primary-light-9);
  
  --ag-border-color: var(--el-border-color-lighter);
  
  --ag-input-focus-border-color: var(--el-color-primary);
}

.ag-theme-alpine .dynamic-header {
  color: var(--el-color-primary);
  font-weight: 500;
}

.ag-root-wrapper {
  border: none !important;
}
</style>