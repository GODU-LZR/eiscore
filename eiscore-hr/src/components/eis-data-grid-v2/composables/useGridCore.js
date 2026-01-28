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
import GeoRenderer from '../components/renderers/GeoRenderer.vue'
import FileRenderer from '../components/renderers/FileRenderer.vue'
import LockHeader from '../components/renderers/LockHeader.vue'
import DocumentActionRenderer from '../components/renderers/DocumentActionRenderer.vue'
import { useUserStore } from '@/stores/user'

export function useGridCore(props, activeSummaryConfig, currentUser, isCellInSelection, gridApiRef, emit) {
  const hasGridRef = gridApiRef && typeof gridApiRef === 'object' && 'value' in gridApiRef
  const gridApi = hasGridRef ? gridApiRef : ref(null)
  const eventEmitter = typeof gridApiRef === 'function' && !emit ? gridApiRef : emit
  const gridData = ref([])
  const searchText = ref('')
  const isLoading = ref(false)
  const columnLockState = reactive({})
  const fieldAcl = ref({})
  const userStore = useUserStore()
  const aclRoleId = computed(() => userStore.userInfo?.role_id || userStore.userInfo?.roleId || '')
  const aclModule = computed(() => props.aclModule || '')

  const gridComponents = {
    StatusRenderer: markRaw(StatusRenderer),
    StatusEditor: markRaw(StatusEditor),
    SelectRenderer: markRaw(SelectRenderer),
    SelectEditor: markRaw(SelectEditor),
    CascaderRenderer: markRaw(CascaderRenderer),
    CascaderEditor: markRaw(CascaderEditor),
    GeoRenderer: markRaw(GeoRenderer),
    FileRenderer: markRaw(FileRenderer),
    LockHeader: markRaw(LockHeader),
    DocumentActionRenderer: markRaw(DocumentActionRenderer)
  }

  const dictOptions = reactive({})
  const dictLoading = reactive({})

  const applyFieldAcl = (col) => {
    if (!aclModule.value || !aclRoleId.value) return {}
    const acl = fieldAcl.value[col.prop]
    if (!acl) return {}
    const result = {}
    if (acl.canView === false) result.hide = true
    if (acl.canEdit === false) result.editable = false
    return result
  }

  const loadFieldAcl = async () => {
    if (!aclModule.value || !aclRoleId.value) {
      fieldAcl.value = {}
      return
    }
    try {
      const res = await request({
        url: `/sys_field_acl?role_id=eq.${aclRoleId.value}&module=eq.${aclModule.value}`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
      const map = {}
      ;(Array.isArray(res) ? res : []).forEach((item) => {
        map[item.field_code] = { canView: item.can_view, canEdit: item.can_edit }
      })
      fieldAcl.value = map
    } catch (e) {
      fieldAcl.value = {}
    }
  }

  // 🟢 修复 2：禁止双击编辑操作列
  const isCellReadOnly = (params) => {
    const colId = params.colDef.field
    if (props.canEdit === false && !params.node.rowPinned) return true
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
    if (params.colDef?.multiLine) {
      return { ...base, whiteSpace: 'pre-line', lineHeight: '18px', paddingTop: '6px', paddingBottom: '6px' }
    }
    return base
  }

  const formatSummaryCell = (params, col) => {
    if (!params?.node?.rowPinned) {
      if (typeof col?.formatter === 'function') return col.formatter(params)
      if (Array.isArray(params.value)) return params.value.join('  ')
      return params.value
    }
    const label = activeSummaryConfig?.cellLabels?.[col?.prop]
    if (!label) return params.value
    const val = params.value
    if (val === null || val === undefined || val === '') return ''
    return `${label}: ${val}`
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
    if (eventEmitter) eventEmitter('view-document', rowData)
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

    const extraColDef = {}
    if (typeof col.valueGetter === 'function') extraColDef.valueGetter = col.valueGetter
    if (typeof col.valueSetter === 'function') extraColDef.valueSetter = col.valueSetter
    if (typeof col.valueParser === 'function') extraColDef.valueParser = col.valueParser
    if (col.multiLine) extraColDef.multiLine = true
    if (Array.isArray(col.syncFields)) extraColDef.syncFields = col.syncFields
    if (col.cellEditor) extraColDef.cellEditor = col.cellEditor
    if (col.cellEditorPopup !== undefined) extraColDef.cellEditorPopup = col.cellEditorPopup
    if (col.cellEditorPopupPosition) extraColDef.cellEditorPopupPosition = col.cellEditorPopupPosition

    const colDef = {
      headerName: col.label,
      field: field,
      type: col.type,
      editable: col.editable !== false && ((params) => !isCellReadOnly(params)),
      cellStyle: getCellStyle,
      cellClassRules: cellClassRules,
      valueFormatter: (params) => formatSummaryCell(params, col),
      headerComponent: 'LockHeader',
      headerClass: isDynamic ? 'dynamic-header' : '',
      ...widthConfig,
      ...extraColDef
    }

    const acl = applyFieldAcl(col)
    if (acl.hide) colDef.hide = true
    if (acl.editable === false) colDef.editable = false

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
        cascaderOptions: col.cascaderOptions || {},
        cascaderOptionsMap: {}
      }
    }

    if (col?.type === 'geo') {
      return {
        ...colDef,
        editable: false,
        cellRenderer: 'GeoRenderer',
        geoAddress: col.geoAddress !== false,
        geoConfig: col.geoConfig || {}
      }
    }

    if (col?.type === 'file') {
      return {
        ...colDef,
        editable: false,
        cellRenderer: 'FileRenderer',
        fileMaxCount: col.fileMaxCount ?? 3,
        fileMaxSizeMb: col.fileMaxSizeMb ?? 20,
        fileAccept: col.fileAccept || ''
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
    
    return props.showActionCol === false
      ? [checkboxCol, statusCol, ...staticCols, ...dynamicCols]
      : [checkboxCol, statusCol, ...staticCols, ...dynamicCols, actionCol]
  })

  watch([aclRoleId, aclModule], () => {
    if (gridApi.value) {
      loadFieldAcl()
      gridApi.value.refreshCells({ force: true })
    }
  })

  const loadData = async () => {
    await loadFieldAcl()
    isLoading.value = true 
    try {
      let url = props.apiUrl
      const orderClause = props.defaultOrder
      if (orderClause) {
        url = `${url}${url.includes('?') ? '&' : '?'}order=${orderClause}`
      }
      if (searchText.value) url += buildSearchQuery(searchText.value, props.staticColumns, props.extraColumns)
      const res = await request({ 
        url, 
        method: 'get',
        headers: { 'Accept-Profile': props.acceptProfile || 'hr', 'Content-Profile': props.contentProfile || 'hr' }
      })
      const rows = Array.isArray(res) ? res : []
      gridData.value = rows
      if (eventEmitter) {
        eventEmitter('data-loaded', {
          rows,
          searchText: searchText.value || ''
        })
      }
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
