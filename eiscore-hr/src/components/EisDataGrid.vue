<template>
  <div class="eis-grid-wrapper" style="height: 100%; display: flex; flex-direction: column;">
    <div style="margin-bottom: 10px; display: flex; justify-content: space-between;">
      <el-input 
        v-model="searchText" 
        placeholder="全表搜索 (含扩展列)..." 
        style="width: 300px" 
        clearable
        @input="onSearch"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      
      <div style="display: flex; gap: 10px;">
        <slot name="toolbar"></slot>
      </div>
    </div>

    <div class="ag-theme-alpine" style="flex: 1; width: 100%;">
      <ag-grid-vue
        style="width: 100%; height: 100%;"
        class="ag-theme-alpine"
        :columnDefs="gridColumns"
        :rowData="gridData"
        :defaultColDef="defaultColDef"
        rowSelection="multiple"
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
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { buildSearchQuery } from '@/utils/grid-query'
import { debounce } from 'lodash'

const props = defineProps({
  apiUrl: { type: String, required: true },
  staticColumns: { type: Array, default: () => [] }, // [{ label, prop, editable }]
  extraColumns: { type: Array, default: () => [] }   // [{ label, prop }]
})

const gridApi = ref(null)
const gridData = ref([])
const searchText = ref('')

// 1. Ag-Grid 默认配置
const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  editable: true, 
  minWidth: 100,
  flex: 1,
}
const getRowId = (params) => params.data.id

// 2. 动态生成列定义
const gridColumns = computed(() => {
  // 固定列
  const staticCols = props.staticColumns.map(col => ({
    headerName: col.label,
    field: col.prop,
    editable: col.editable !== false,
    cellEditor: 'agTextCellEditor'
  }))

  // 动态列 (JSONB)
  const dynamicCols = props.extraColumns.map(col => ({
    headerName: col.label + ' (扩)',
    field: `properties.${col.prop}`, // Ag-Grid 自动处理嵌套对象
    editable: true,
    cellStyle: { color: '#409EFF' }
  }))

  return [...staticCols, ...dynamicCols]
})

// 3. 加载数据
const loadData = async () => {
  if (!gridApi.value) return
  gridApi.value.showLoadingOverlay()
  
  try {
    let url = `${props.apiUrl}?order=id.desc`
    // 搜索逻辑
    if (searchText.value) {
      url += buildSearchQuery(searchText.value, props.staticColumns, props.extraColumns)
    }
    
    // 注意：这里我们一次性加载所有数据交给 Ag-Grid 做虚拟滚动
    // 如果数据量真的超过 10万，才需要做服务端分页
    const res = await request({ url, method: 'get' })
    gridData.value = res
  } catch (e) {
    console.error(e)
    ElMessage.error('数据加载失败')
  } finally {
    gridApi.value.hideOverlay()
  }
}

// 4. 改一个存一个 (核心保存逻辑)
const onCellValueChanged = async (event) => {
  // 避免初始加载或粘贴造成的误触发（简单处理）
  if (event.oldValue === event.newValue) return

  const { data, colDef, newValue } = event
  
  try {
    let payload = {}
    
    // 判断是普通字段还是 JSON 字段
    if (colDef.field.startsWith('properties.')) {
      // 💡 对于 JSONB，这里简单地把整块 properties 发回去更新
      // Ag-Grid 已经修改了内存里的 data.properties
      payload = { properties: data.properties }
    } else {
      payload = { [colDef.field]: newValue }
    }
    
    // 乐观锁 + 更新时间
    const nextVersion = (data.version || 1) + 1
    payload.version = nextVersion
    payload.updated_at = new Date().toISOString()

    // 提交 PATCH
    const res = await request({
      url: `${props.apiUrl}?id=eq.${data.id}&version=eq.${data.version}`,
      method: 'patch',
      headers: { 
        'Content-Profile': 'hr',
        'Prefer': 'return=representation' 
      },
      data: payload
    })

    if (res && res.length > 0) {
      // 更新本地版本号，防止下次保存冲突
      data.version = nextVersion
      // 可以在这里给单元格闪烁一下绿色背景表示成功（AgGrid API支持）
    } else {
      throw new Error('版本冲突或已被删除')
    }

  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
    // 回滚单元格显示
    event.node.setDataValue(colDef.field, event.oldValue)
  }
}

// 5. 【黑科技】手动实现 Excel 粘贴 (绕过收费版限制)
// 监听 Ctrl+V
const onCellKeyDown = async (e) => {
  const event = e.event
  if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
    // 读取剪贴板
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      
      // 解析 Excel 数据 (制表符分隔列，换行符分隔行)
      const rows = text.split(/\r\n|\n|\r/).filter(row => row.trim() !== '')
      
      // 获取当前焦点单元格
      const focusedCell = gridApi.value.getFocusedCell()
      if (!focusedCell) return
      
      const startRowIndex = focusedCell.rowIndex
      const startColId = focusedCell.column.colId
      
      // 获取所有显示的列
      const allColumns = gridApi.value.getColumns()
      const startColIndex = allColumns.findIndex(c => c.colId === startColId)
      
      // 循环填充数据
      rows.forEach((rowStr, rIdx) => {
        const cells = rowStr.split('\t')
        const targetRowNode = gridApi.value.getDisplayedRowAtIndex(startRowIndex + rIdx)
        
        if (targetRowNode) {
          cells.forEach((cellValue, cIdx) => {
            const targetCol = allColumns[startColIndex + cIdx]
            if (targetCol && targetCol.isCellEditable(targetRowNode)) {
              // 更新数据，这会自动触发 onCellValueChanged 进行保存
              targetRowNode.setDataValue(targetCol.colId, cellValue.trim())
            }
          })
        }
      })
      
      ElMessage.success(`成功粘贴 ${rows.length} 行数据`)
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

// 监听动态列变化
watch(() => props.extraColumns, () => {
  // 列变化会自动触发 gridColumns 计算属性更新，Ag-Grid 会自动刷新表头
}, { deep: true })

defineExpose({ loadData })
</script>

<style>
/* 调整样式更紧凑，像 Excel */
.ag-theme-alpine {
  --ag-font-size: 13px;
  --ag-header-height: 35px;
  --ag-row-height: 32px;
  --ag-selected-row-background-color: rgba(64, 158, 255, 0.15);
  --ag-input-focus-border-color: #409EFF;
}
</style>