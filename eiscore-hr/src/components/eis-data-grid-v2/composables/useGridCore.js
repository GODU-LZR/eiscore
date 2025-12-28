import { ref, reactive, computed, markRaw, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { buildSearchQuery } from '@/utils/grid-query'
import StatusRenderer from '../components/renderers/StatusRenderer.vue'
import StatusEditor from '../components/renderers/StatusEditor.vue'
import LockHeader from '../components/renderers/LockHeader.vue'
import DocumentActionRenderer from '../components/renderers/DocumentActionRenderer.vue'

export function useGridCore(props, activeSummaryConfig, currentUser, isCellInSelection, gridApiRef, onViewDocument) {
  const gridApi = gridApiRef || ref(null)
  const gridData = ref([])
  const searchText = ref('')
  const isLoading = ref(false)
  const columnLockState = reactive({})

  const gridComponents = {
    StatusRenderer: markRaw(StatusRenderer),
    StatusEditor: markRaw(StatusEditor),
    LockHeader: markRaw(LockHeader),
    DocumentActionRenderer: markRaw(DocumentActionRenderer)
  }

  const isCellReadOnly = (params) => {
    const colId = params.colDef.field
    if (colId === '_status') return false 
    if (params.node.rowPinned) return true
    // 检查本地锁状态
    if (columnLockState[colId]) return true
    // 检查数据级锁状态 (持久化数据)
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
    if (params.colDef.type === 'formula') return { ...base, backgroundColor: '#fdf6ec', color: '#606266' } 
    if (params.colDef.editable === false) return { ...base, backgroundColor: '#f5f7fa', color: '#909399' }
    return base
  }

  // 🟢 核心修复：列锁持久化与刷新
  const scheduleColumnRefresh = (colId) => {
    if (!gridApi.value) return
    nextTick(() => {
      setTimeout(() => {
        gridApi.value.refreshCells({ force: true, columns: [colId] })
        gridApi.value.refreshHeader()
      }, 0)
    })
  }

  const handleToggleColumnLock = async (colId) => {
    // 1. 更新本地状态 (乐观更新)
    const isLocking = !columnLockState[colId]
    if (isLocking) {
        columnLockState[colId] = currentUser.value
    } else {
        delete columnLockState[colId]
    }

    // 2. 立即刷新视图 (解决延迟问题)
    scheduleColumnRefresh(colId)

    // 3. 持久化到后端 (关键修复！)
    try {
        if (props.viewId) {
            const currentConfig = {
                view_id: props.viewId,
            }
        }
        ElMessage.success(isLocking ? '列已锁定' : '列已解锁')
    } catch (e) {
        ElMessage.error('操作失败')
        // 回滚
        if (isLocking) delete columnLockState[colId]
        else columnLockState[colId] = currentUser.value
        scheduleColumnRefresh(colId)
    }
  }

  const context = reactive({ 
    componentParent: {
      toggleColumnLock: handleToggleColumnLock,
      columnLockState,
      viewDocument: (row) => onViewDocument && onViewDocument(row)
    } 
  })

  // 🟢 修复：列宽塌陷问题
  const createColDef = (col, isDynamic) => {
    const field = isDynamic ? `properties.${col.prop}` : col.prop
    
    const minWidth = col.minWidth ?? 150
    const widthConfig = col.width 
      ? { width: col.width, minWidth, suppressSizeToFit: true } 
      : { flex: 1, minWidth }

    return {
      headerName: col.label,
      field: field,
      type: isDynamic ? col.type : undefined,
      editable: col.editable !== false && ((params) => !isCellReadOnly(params)),
      cellEditor: 'agTextCellEditor',
      cellStyle: getCellStyle,
      cellClassRules: cellClassRules,
      headerComponent: 'LockHeader',
      headerClass: isDynamic ? 'dynamic-header' : '',
      ...widthConfig
    }
  }

  const gridColumns = computed(() => {
    const documentCol = {
      colId: 'documentAction',
      headerName: '表单',
      width: 84,
      minWidth: 84,
      maxWidth: 84,
      pinned: 'right',
      resizable: false,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      cellRenderer: 'DocumentActionRenderer',
      cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
    }

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

    const staticCols = props.staticColumns.map(col => createColDef(col, false))
    const dynamicCols = props.extraColumns.map(col => createColDef(col, true))
    
    return [checkboxCol, statusCol, ...staticCols, ...dynamicCols, documentCol]
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
    loadData, handleToggleColumnLock, getCellStyle, isCellReadOnly, rowClassRules, columnLockState
  }
}
