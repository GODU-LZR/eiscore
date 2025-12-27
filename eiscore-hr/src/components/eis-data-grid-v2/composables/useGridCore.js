import { ref, reactive, computed, markRaw } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { buildSearchQuery } from '@/utils/grid-query'
import StatusRenderer from '../components/renderers/StatusRenderer.vue'
import StatusEditor from '../components/renderers/StatusEditor.vue'
import LockHeader from '../components/renderers/LockHeader.vue'

export function useGridCore(props, activeSummaryConfig, currentUser) {
  const gridApi = ref(null)
  const gridData = ref([]) // 使用 ref 替代 shallowRef 以确保响应性
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
    // 公式列只读
    if (params.colDef.type === 'formula') return true
    return false
  }

  const getCellStyle = (params) => {
    const base = { 'line-height': '34px' }
    if (params.node.rowPinned) return { ...base, backgroundColor: '#ecf5ff', color: '#409EFF', fontWeight: 'bold' }
    if (params.colDef.field === '_status') return { ...base, cursor: 'pointer' }
    if (params.colDef.type === 'formula') return { ...base, backgroundColor: '#fdf6ec', color: '#606266' } 
    if (params.colDef.editable === false) return { ...base, backgroundColor: '#f5f7fa', color: '#909399' }
    return base
  }

  const handleToggleColumnLock = (colId) => {
    if (columnLockState[colId]) delete columnLockState[colId]
    else columnLockState[colId] = currentUser.value
    gridApi.value.redrawRows()
  }

  const context = reactive({ 
    componentParent: { toggleColumnLock: handleToggleColumnLock, columnLockState } 
  })

  const gridColumns = computed(() => {
    const checkboxCol = { colId: 'rowCheckbox', headerCheckboxSelection: true, checkboxSelection: true, width: 40, pinned: 'left', cellStyle: { padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }
    const statusCol = { 
      headerName: '状态', field: '_status', width: 100, pinned: 'left', 
      cellRenderer: 'StatusRenderer', cellEditor: 'StatusEditor', cellEditorPopup: true, 
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
      width: col.width, cellStyle: getCellStyle, headerComponent: 'LockHeader'
    }))
    
    const dynamicCols = props.extraColumns.map(col => ({
      headerName: col.label, field: `properties.${col.prop}`, 
      type: col.type, 
      editable: (params) => !isCellReadOnly(params),
      headerClass: 'dynamic-header', cellStyle: getCellStyle, headerComponent: 'LockHeader'
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
      // Auto size after data load
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
    loadData, handleToggleColumnLock, getCellStyle, isCellReadOnly
  }
}
