import { ref, reactive, computed, markRaw } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { buildSearchQuery } from '@/utils/grid-query'
import StatusRenderer from '../components/renderers/StatusRenderer.vue'
import StatusEditor from '../components/renderers/StatusEditor.vue'
import LockHeader from '../components/renderers/LockHeader.vue'

export function useGridCore(props, activeSummaryConfig, currentUser, isCellInSelection) {
  const gridApi = ref(null)
  const gridData = ref([])
  const searchText = ref('')
  const isLoading = ref(false)
  const columnLockState = reactive({})

  const gridComponents = {
    StatusRenderer: markRaw(StatusRenderer),
    StatusEditor: markRaw(StatusEditor),
    LockHeader: markRaw(LockHeader)
  }

  const isCellReadOnly = (params) => {
    const colId = params.colDef.field
    if (colId === '_status') return false 
    if (params.node.rowPinned) return true
    if (columnLockState[colId]) return true
    if (params.data?.properties?.row_locked_by) return true
    if (params.colDef.type === 'formula') return true
    return false
  }

  // 样式规则
  const cellClassRules = { 
    'custom-range-selected': (params) => isCellInSelection && isCellInSelection(params),
    'cell-locked-pattern': (params) => isCellReadOnly(params),
    'status-cell': (params) => params.colDef.field === '_status'
  }

  const rowClassRules = { 'row-locked-bg': (params) => !!params.data?.properties?.row_locked_by }

  const getCellStyle = (params) => {
    const base = { 'line-height': '34px' }
    if (params.node.rowPinned) return { ...base, backgroundColor: '#ecf5ff', color: '#409EFF', fontWeight: 'bold', borderTop: '2px solid var(--el-color-primary-light-5)' }
    if (params.colDef.field === '_status') return { ...base, cursor: 'pointer' }
    // 公式列样式
    if (params.colDef.type === 'formula') return { ...base, backgroundColor: '#fdf6ec', color: '#606266' } 
    if (params.colDef.editable === false) return { ...base, backgroundColor: '#f5f7fa', color: '#909399' }
    return base
  }

  // 🟢 修复：强制刷新，解决列锁样式延迟
  const handleToggleColumnLock = (colId) => {
    if (columnLockState[colId]) {
      delete columnLockState[colId]
      ElMessage.success('列已解锁')
    } else {
      columnLockState[colId] = currentUser.value
      ElMessage.success('列已锁定')
    }
    if (gridApi.value) {
      gridApi.value.redrawRows()
      // 强制刷新所有单元格样式
      gridApi.value.refreshCells({ force: true, columns: [colId] })
    }
  }

  const context = reactive({ 
    componentParent: { toggleColumnLock: handleToggleColumnLock, columnLockState } 
  })

  const gridColumns = computed(() => {
    const checkboxCol = { 
      colId: 'rowCheckbox', headerCheckboxSelection: true, checkboxSelection: true, 
      width: 40, minWidth: 40, maxWidth: 40, pinned: 'left', 
      resizable: false, sortable: false, filter: false, suppressHeaderMenuButton: true, 
      cellStyle: { padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' } 
    }
    
    const statusCol = { 
      headerName: '状态', field: '_status', width: 100, minWidth: 100, pinned: 'left', 
      filter: true, sortable: false, resizable: false, suppressHeaderMenuButton: false,
      editable: (params) => !params.node.rowPinned,
      cellRenderer: 'StatusRenderer', cellEditor: 'StatusEditor', cellEditorPopup: true, cellEditorPopupPosition: 'under',
      cellClassRules: cellClassRules,
      valueGetter: params => params.node.rowPinned ? activeSummaryConfig.label : (params.data.properties?.row_locked_by ? 'locked' : params.data.properties?.status || 'created'), 
      valueSetter: params => { 
        if(params.node.rowPinned || params.newValue===params.oldValue) return false; 
        if(!params.data.properties) params.data.properties={}; 
        params.data.properties.status=params.newValue; 
        params.data.properties.row_locked_by = params.newValue==='locked'?currentUser.value:null; 
        return true; 
      } 
    }

    const staticCols = props.staticColumns.map(col => ({
      headerName: col.label, field: col.prop, 
      editable: col.editable!==false && (params => !isCellReadOnly(params)), 
      width: col.width, 
      // 🟢 修复：找回 flex 逻辑，防止列头塌缩
      flex: col.width ? 0 : 1, 
      cellStyle: getCellStyle, 
      cellClassRules: cellClassRules,
      headerComponent: 'LockHeader'
    }))
    
    const dynamicCols = props.extraColumns.map(col => ({
      headerName: col.label, field: `properties.${col.prop}`, 
      type: col.type, 
      editable: (params) => !isCellReadOnly(params),
      headerClass: 'dynamic-header', 
      cellStyle: getCellStyle, 
      cellClassRules: cellClassRules,
      headerComponent: 'LockHeader'
    }))
    
    return [checkboxCol, statusCol, ...staticCols, ...dynamicCols]
  })

  const loadData = async () => {
    isLoading.value = true 
    try {
      let url = `${props.apiUrl}?order=id.desc`
      if (searchText.value) url += buildSearchQuery(searchText.value, props.staticColumns, props.extraColumns)
      const res = await request({ url, method: 'get' })
      gridData.value = res
      setTimeout(() => { 
        if (gridApi.value) {
          const allColIds = gridApi.value.getColumns().map(c => c.getColId())
          gridApi.value.autoSizeColumns(allColIds, false) 
        }
      }, 100)
    } catch (e) { ElMessage.error('数据加载失败') } 
    finally { isLoading.value = false }
  }

  return {
    gridApi, gridData, gridColumns, context, gridComponents, searchText, isLoading,
    loadData, handleToggleColumnLock, getCellStyle, isCellReadOnly, rowClassRules
  }
}