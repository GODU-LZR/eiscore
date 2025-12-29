import { ref, reactive, computed, markRaw, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { buildSearchQuery } from '@/utils/grid-query'
import StatusRenderer from '../components/renderers/StatusRenderer.vue'
import StatusEditor from '../components/renderers/StatusEditor.vue'
import SelectRenderer from '../components/renderers/SelectRenderer.vue'
import SelectEditor from '../components/renderers/SelectEditor.vue'
import CascaderRenderer from '../components/renderers/CascaderRenderer.vue'
import CascaderEditor from '../components/renderers/CascaderEditor.vue'
import LockHeader from '../components/renderers/LockHeader.vue'
import DocumentActionRenderer from '../components/renderers/DocumentActionRenderer.vue'

export function useGridCore(props, activeSummaryConfig, currentUser, isCellInSelection, emit) {
  const gridApi = ref(null)
  const gridData = ref([])
  const searchText = ref('')
  const isLoading = ref(false)
  const columnLockState = reactive({})

  const gridComponents = {
    StatusRenderer: markRaw(StatusRenderer),
    StatusEditor: markRaw(StatusEditor),
    SelectRenderer: markRaw(SelectRenderer),
    SelectEditor: markRaw(SelectEditor),
    CascaderRenderer: markRaw(CascaderRenderer),
    CascaderEditor: markRaw(CascaderEditor),
    LockHeader: markRaw(LockHeader),
    DocumentActionRenderer: markRaw(DocumentActionRenderer)
  }

  const dictOptions = reactive({})
  const dictLoading = reactive({})

  // 🟢 修复 2：禁止双击编辑操作列
  const isCellReadOnly = (params) => {
    const colId = params.colDef.field
    if (colId === '_status') return false 
    if (colId === '_actions') return true // ⚠️ 关键：操作列必须只读！
    if (params.node.rowPinned) return true
    if (columnLockState[colId]) return true
    if (params.data?.properties?.row_locked_by) return true
    if (params.colDef.type === 'formula') return true
    return false
  }

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

  const scheduleColumnRefresh = (colKey) => {
    if (!gridApi.value) return
    nextTick(() => {
      let targetCols = []
      if (colKey) {
        const cols = gridApi.value.getColumns() || []
        targetCols = cols
          .filter(col => {
            const def = col.getColDef()
            return col.getColId() === colKey || def.field === colKey
          })
          .map(col => col.getColId())
      }
      if (targetCols.length > 0) {
        gridApi.value.refreshCells({ force: true, columns: targetCols })
      } else {
        gridApi.value.refreshCells({ force: true })
      }
      gridApi.value.redrawRows()
      gridApi.value.refreshHeader()
    })
  }

  const refreshDictColumns = (dictKey) => {
    if (!gridApi.value) return
    const cols = gridApi.value.getColumns() || []
    const targetCols = cols
      .filter(col => col.getColDef()?.dictKey === dictKey)
      .map(col => col.getColId())
    if (targetCols.length > 0) {
      gridApi.value.refreshCells({ force: true, columns: targetCols })
    } else {
      gridApi.value.refreshCells({ force: true })
    }
    gridApi.value.redrawRows()
    gridApi.value.refreshHeader()
  }

  const loadDictOptions = async (dictKey) => {
    if (!dictKey || dictLoading[dictKey]) return
    dictLoading[dictKey] = true
    try {
      const res = await request({
        url: `/v_sys_dict_items?dict_key=eq.${dictKey}&dict_enabled=is.true&item_enabled=is.true&order=sort.asc&select=label,value,extra`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
      const target = dictOptions[dictKey] || []
      const nextOptions = Array.isArray(res)
        ? res.map(item => ({
          label: item.label,
          value: item.value,
          type: item.extra?.type
        }))
        : []
      target.splice(0, target.length, ...nextOptions)
      dictOptions[dictKey] = target
      refreshDictColumns(dictKey)
    } catch (e) {
      console.warn(`[Dict] Load failed: ${dictKey}`, e)
    } finally {
      dictLoading[dictKey] = false
    }
  }

  const resolveSelectOptions = (col) => {
    if (Array.isArray(col.options)) return col.options
    if (col.dictKey) {
      if (!dictOptions[col.dictKey]) dictOptions[col.dictKey] = []
      return dictOptions[col.dictKey]
    }
    return []
  }

  const isSelectColumn = (col) => {
    if (!col) return false
    if (col.type === 'select' || col.type === 'dropdown') return true
    if (Array.isArray(col.options)) return true
    if (col.dictKey) return true
    return false
  }

  const resolveDependsOnField = (col) => {
    if (!col?.dependsOn) return ''
    if (String(col.dependsOn).includes('.')) return col.dependsOn
    const isStatic = props.staticColumns.some(item => item.prop === col.dependsOn)
    return isStatic ? col.dependsOn : `properties.${col.dependsOn}`
  }

  watch(
    () => [...props.staticColumns, ...props.extraColumns],
    (cols) => {
      cols.forEach(col => {
        if (col?.dictKey) loadDictOptions(col.dictKey)
      })
    },
    { deep: true, immediate: true }
  )

  const handleToggleColumnLock = async (colKey) => {
    const isLocking = !columnLockState[colKey]
    if (isLocking) {
        columnLockState[colKey] = currentUser.value
    } else {
        delete columnLockState[colKey]
    }
    
    scheduleColumnRefresh(colKey)

    try {
        if (props.viewId) { 
            // 模拟持久化逻辑
            const temp = { view_id: props.viewId } 
        }
        ElMessage.success(isLocking ? '列已锁定' : '列已解锁')
    } catch (e) {
        ElMessage.error('操作失败')
        if (isLocking) delete columnLockState[colId]
        else columnLockState[colId] = currentUser.value
        scheduleColumnRefresh(colId)
    }
  }

  const handleViewDocument = (rowData) => {
    emit('view-document', rowData)
  }

  const context = reactive({ 
    componentParent: { 
        toggleColumnLock: handleToggleColumnLock, 
        columnLockState,
        viewDocument: handleViewDocument 
    } 
  })

  const createColDef = (col, isDynamic) => {
    const field = isDynamic ? `properties.${col.prop}` : col.prop
    const minWidth = col.minWidth ?? 150
    const widthConfig = col.width 
      ? { width: col.width, minWidth, suppressSizeToFit: true } 
      : { flex: 1, minWidth }

    const colDef = {
      headerName: col.label,
      field: field,
      type: col.type,
      editable: col.editable !== false && ((params) => !isCellReadOnly(params)),
      cellStyle: getCellStyle,
      cellClassRules: cellClassRules,
      headerComponent: 'LockHeader',
      headerClass: isDynamic ? 'dynamic-header' : '',
      ...widthConfig
    }

    if (isDynamic) {
      colDef.valueSetter = (params) => {
        if (!params.data.properties || typeof params.data.properties !== 'object') {
          params.data.properties = {}
        }
        if (params.data.properties[col.prop] === params.newValue) return false
        params.data.properties[col.prop] = params.newValue
        return true
      }
    }

    if (isSelectColumn(col)) {
      return {
        ...colDef,
        cellRenderer: 'SelectRenderer',
        cellEditor: 'SelectEditor',
        cellEditorPopup: true,
        cellEditorPopupPosition: 'under',
        options: resolveSelectOptions(col),
        dictKey: col.dictKey,
        tag: col.tag
      }
    }

    if (col?.type === 'cascader') {
      return {
        ...colDef,
        cellRenderer: 'CascaderRenderer',
        cellEditor: 'CascaderEditor',
        cellEditorPopup: true,
        cellEditorPopupPosition: 'under',
        dependsOn: col.dependsOn,
        dependsOnField: resolveDependsOnField(col),
        apiUrl: col.apiUrl,
        labelField: col.labelField || 'label',
        valueField: col.valueField || 'value',
        cascaderOptionsMap: {}
      }
    }

    return {
      ...colDef,
      cellEditor: 'agTextCellEditor'
    }
  }

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

    // 🟢 修复 1：配置操作列
    const actionCol = {
      headerName: '操作',
      field: '_actions',
      width: 100, // 稍微加宽一点以容纳文字
      minWidth: 100,
      pinned: 'right', // 固定在右侧
      sortable: false,
      filter: false,
      resizable: false,
      editable: false, // ⚠️ 再次确保不可编辑
      suppressHeaderMenuButton: true,
      suppressRowClickSelection: true, // ⚠️ 核心修复：点击此列单元格，不触发“行选中”，防止状态冲突
      cellRenderer: 'DocumentActionRenderer',
      cellStyle: { padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    }

    const staticCols = props.staticColumns.map(col => createColDef(col, false))
    const dynamicCols = props.extraColumns.map(col => createColDef(col, true))
    
    return [checkboxCol, statusCol, ...staticCols, ...dynamicCols, actionCol]
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
