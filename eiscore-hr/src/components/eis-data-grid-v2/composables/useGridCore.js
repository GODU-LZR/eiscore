// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, reactive, computed, markRaw, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { buildSearchQuery } from '@/utils/grid-query'
import { createPagedGridLoader } from '@shared/eis-data-grid-paging'
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
import CheckRenderer from '../components/renderers/CheckRenderer.vue'
import CheckEditor from '../components/renderers/CheckEditor.vue'
import RowHeightHandleRenderer from '../components/renderers/RowHeightHandleRenderer.vue'
import { useUserStore } from '@/stores/user'
import {
  HR_ATTENTION_LEVEL_OPTIONS,
  attentionLevelRank,
  getManualAttentionLevel,
  normalizeAttentionLevel
} from '@/utils/hr-attention'

export function useGridCore(props, activeSummaryConfig, currentUser, isCellInSelection, gridApiRef, emit, workflowBindingRef) {
  const hasGridRef = gridApiRef && typeof gridApiRef === 'object' && 'value' in gridApiRef
  const gridApi = hasGridRef ? gridApiRef : ref(null)
  const eventEmitter = typeof gridApiRef === 'function' && !emit ? gridApiRef : emit
  const gridData = ref([])
  const searchText = ref('')
  const isLoading = ref(false)
  const columnLockState = reactive({})
  const fieldAcl = ref({})
  const workflowBinding = workflowBindingRef || ref(null)
  const userStore = useUserStore()
  const resolvedRoleId = ref('')
  const aclRoleId = computed(() => userStore.userInfo?.role_id || userStore.userInfo?.roleId || resolvedRoleId.value || '')
  const aclModule = computed(() => props.aclModule || '')
  const STATUS_TRANSITION_ACTION = 'status_transition'
  const defaultRowHeight = computed(() => Math.max(28, Math.min(120, Number(props.defaultRowHeight) || 35)))
  const rowHeightConfig = computed(() => ({
    enabled: props.enableRowHeightResize === true && !!props.localLayoutKey,
    min: Math.max(28, Math.min(120, Number(props.minRowHeight) || 32)),
    max: Math.max(48, Math.min(260, Number(props.maxRowHeight) || 160))
  }))
  const layoutStorageKey = computed(() => props.localLayoutKey ? `eis-grid-layout:${props.localLayoutKey}` : '')
  const localLayoutState = reactive({ columns: {}, rows: {} })
  let rowResizeState = null
  const ROW_HEIGHT_EDGE_HIT_SIZE = 10
  let saveColumnLayoutTimer = null
  const clampRowHeight = (value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return defaultRowHeight.value
    return Math.max(rowHeightConfig.value.min, Math.min(rowHeightConfig.value.max, Math.round(num)))
  }
  const safeReadLocalLayout = () => {
    if (!layoutStorageKey.value || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(layoutStorageKey.value)
      const parsed = raw ? JSON.parse(raw) : {}
      localLayoutState.columns = parsed && typeof parsed.columns === 'object' ? parsed.columns : {}
      localLayoutState.rows = parsed && typeof parsed.rows === 'object' ? parsed.rows : {}
    } catch (e) {
      localLayoutState.columns = {}
      localLayoutState.rows = {}
    }
  }
  const safeWriteLocalLayout = () => {
    if (!layoutStorageKey.value || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(layoutStorageKey.value, JSON.stringify({
        version: 1,
        columns: localLayoutState.columns,
        rows: localLayoutState.rows
      }))
    } catch (e) {}
  }
  safeReadLocalLayout()

  const getUserInfoSnapshot = () => {
    const info = userStore.userInfo
    if (info && typeof info === 'object' && Object.keys(info).length > 0) return info
    try {
      const raw = localStorage.getItem('user_info')
      return raw ? JSON.parse(raw) : {}
    } catch (e) {
      return {}
    }
  }

  const getPermissionList = () => {
    const info = getUserInfoSnapshot()
    const perms = info?.permissions
    return Array.isArray(perms) ? perms : []
  }

  const getRoleCode = () => {
    const info = getUserInfoSnapshot()
    return info?.app_role || info?.appRole || info?.role || ''
  }

  const hasPermission = (permission) => {
    if (!permission) return true
    if (getRoleCode() === 'super_admin') return true
    return getPermissionList().includes(permission)
  }

  const normalizeStatus = (value) => {
    if (value === null || value === undefined || value === '') return ''
    const text = String(value).toLowerCase()
    if (text === 'disabled') return 'locked'
    if (text === 'draft') return 'created'
    if (text === 'created' || text === 'active' || text === 'locked') return text
    return text
  }

  const toStoredStatus = (value) => {
    const normalized = normalizeStatus(value)
    if (normalized === 'locked') return 'disabled'
    if (normalized === 'created') return 'draft'
    return normalized
  }

  const shouldEnforceStatusTransitionPermission = () => {
    if (!aclModule.value) return false
    const prefix = `op:${aclModule.value}.${STATUS_TRANSITION_ACTION}.`
    return getPermissionList().some((item) => typeof item === 'string' && item.startsWith(prefix))
  }

  const canTransitionStatus = (fromStatus, toStatus) => {
    const from = normalizeStatus(fromStatus)
    const to = normalizeStatus(toStatus)
    if (!from || !to || from === to) return true
    if (!shouldEnforceStatusTransitionPermission()) return true
    if (!aclModule.value) return true
    const exactCode = `op:${aclModule.value}.${STATUS_TRANSITION_ACTION}.${from}_${to}`
    const wildcardCode = `op:${aclModule.value}.${STATUS_TRANSITION_ACTION}.*`
    return hasPermission(exactCode) || hasPermission(wildcardCode)
  }

  const hasOutgoingTransitionPermission = (fromStatus) => {
    if (!shouldEnforceStatusTransitionPermission()) return true
    if (!aclModule.value) return true
    const from = normalizeStatus(fromStatus) || 'created'
    const wildcardCode = `op:${aclModule.value}.${STATUS_TRANSITION_ACTION}.*`
    if (hasPermission(wildcardCode)) return true
    const prefix = `op:${aclModule.value}.${STATUS_TRANSITION_ACTION}.${from}_`
    return getPermissionList().some((item) => typeof item === 'string' && item.startsWith(prefix))
  }

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
    DocumentActionRenderer: markRaw(DocumentActionRenderer),
    CheckRenderer: markRaw(CheckRenderer),
    CheckEditor: markRaw(CheckEditor),
    RowHeightHandleRenderer: markRaw(RowHeightHandleRenderer)
  }

  const dictOptions = reactive({})
  const dictLoading = reactive({})

  const getFieldKeyFromColDef = (colDef) => {
    const field = colDef?.field || ''
    if (!field) return ''
    return field.startsWith('properties.') ? field.slice('properties.'.length) : field
  }

  const getWorkflowBinding = () => workflowBinding.value || null

  const shouldShowByWorkflow = (colDef) => {
    const binding = getWorkflowBinding()
    const visible = binding?.visibleFields
    if (!Array.isArray(visible) || visible.length === 0) return true
    const key = getFieldKeyFromColDef(colDef)
    if (!key || key.startsWith('_')) return true
    return visible.includes(key)
  }

  const canEditByWorkflow = (colDef) => {
    const binding = getWorkflowBinding()
    const editable = binding?.editableFields
    if (!Array.isArray(editable) || editable.length === 0) return true
    const key = getFieldKeyFromColDef(colDef)
    if (!key || key.startsWith('_')) return true
    return editable.includes(key)
  }

  const getFieldAcl = (colDef) => {
    if (!aclModule.value || !aclRoleId.value) return null
    const key = getFieldKeyFromColDef(colDef)
    if (!key) return null
    return fieldAcl.value?.[key] || null
  }

  const applyFieldAclVisibility = () => {
    if (!gridApi.value) return
    gridApi.value.refreshCells({ force: true })
    gridApi.value.refreshHeader()
  }

  const applyWorkflowBinding = () => {
    if (!gridApi.value) return
    const binding = getWorkflowBinding()
    if (!binding?.visibleFields?.length) return
    const columns = gridApi.value.getColumns() || []
    columns.forEach((col) => {
      const def = col.getColDef()
      const key = getFieldKeyFromColDef(def)
      if (!key || key.startsWith('_')) return
      gridApi.value.setColumnVisible(col.getColId(), binding.visibleFields.includes(key))
    })
    gridApi.value.refreshHeader()
    gridApi.value.refreshCells({ force: true })
  }

  const loadFieldAcl = async () => {
    if (!aclModule.value) {
      fieldAcl.value = {}
      return
    }
    if (!aclRoleId.value) {
      const roleCode = userStore.userInfo?.app_role || userStore.userInfo?.appRole || userStore.userInfo?.role
      if (roleCode) {
        try {
          const res = await request({
            url: `/roles?code=eq.${roleCode}`,
            method: 'get',
            headers: { 'Accept-Profile': 'public' }
          })
          if (Array.isArray(res) && res.length > 0) {
            resolvedRoleId.value = res[0].id
          }
        } catch (e) {
          resolvedRoleId.value = ''
        }
      }
    }
    if (!aclRoleId.value) {
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
      applyFieldAclVisibility()
    } catch (e) {
      fieldAcl.value = {}
    }
  }

  // 🟢 修复 2：禁止双击编辑操作列
  const isCellReadOnly = (params) => {
    const colId = params.colDef.colId || params.colDef.field
    if (props.canEdit === false && !params.node.rowPinned) return true
    if (colId === 'rowCheckbox' || params.colDef.checkboxSelection) return true
    if (colId === '_status') {
      const currentStatus = params.data?.properties?.status ?? params.data?.status
      return !hasOutgoingTransitionPermission(currentStatus)
    }
    if (colId === '_actions') return true // ⚠️ 关键：操作列必须只读！
    if (params.node.rowPinned) return true
    if (props.enableColumnLock !== false && columnLockState[colId]) return true
    if (params.data?.properties?.row_locked_by) return true
    if (params.colDef.type === 'formula') return true
    const acl = getFieldAcl(params.colDef)
    if (acl?.canView === false) return true
    if (acl?.canEdit === false) return true
    if (!shouldShowByWorkflow(params.colDef)) return true
    if (!canEditByWorkflow(params.colDef)) return true
    return false
  }

  const cellClassRules = { 
    'custom-range-selected': (params) => isCellInSelection && isCellInSelection(params),
    // 仅业务锁定或列锁定使用条纹样式，权限只读用灰底
    'cell-locked-pattern': (params) => {
      if (props.enableColumnLock === false) return false
      const colId = params.colDef.field
      if (params.data?.properties?.row_locked_by) return true
      if (colId && columnLockState[colId]) return true
      return false
    },
    'status-cell': (params) => params.colDef.field === '_status'
  }

  const resolveAttention = (row) => {
    if (!props.attentionResolver || !row || typeof props.attentionResolver !== 'function') return null
    try {
      return props.attentionResolver(row) || null
    } catch (e) {
      return null
    }
  }

  const rowClassRules = {
    'row-locked-bg': (params) => !!params.data?.properties?.row_locked_by,
    'attention-row-critical': (params) => resolveAttention(params.data)?.level === 'critical',
    'attention-row-warning': (params) => resolveAttention(params.data)?.level === 'warning',
    'attention-row-focus': (params) => resolveAttention(params.data)?.level === 'focus'
  }

  const getCellStyle = (params) => {
    const base = { 'line-height': '34px' }
    if (params.node.rowPinned) return { ...base, backgroundColor: '#ecf5ff', color: '#409EFF', fontWeight: 'bold', borderTop: '2px solid var(--el-color-primary-light-5)' }
    if (params.colDef.field === '_status') return { ...base, cursor: 'pointer' }
    if (params.colDef.isAttentionColumn) return { ...base, cursor: 'pointer' }
    if (params.data?.properties?.row_locked_by) return base
    const acl = getFieldAcl(params.colDef)
    if (acl?.canView === false) return { ...base, backgroundColor: '#f5f7fa', color: '#c0c4cc' }
    if (acl?.canView !== false && acl?.canEdit === false) return { ...base, backgroundColor: '#f5f7fa', color: '#909399' }
    if (!shouldShowByWorkflow(params.colDef)) return { ...base, backgroundColor: '#f5f7fa', color: '#c0c4cc' }
    if (!canEditByWorkflow(params.colDef)) return { ...base, backgroundColor: '#f5f7fa', color: '#909399' }
    if (params.colDef.type === 'formula') return { ...base, backgroundColor: '#fdf6ec', color: '#606266' } 
    if (params.colDef.editable === false && params.colDef.field !== '_actions') return { ...base, backgroundColor: '#f5f7fa', color: '#909399' }
    if (params.colDef?.multiLine) {
      return { ...base, whiteSpace: 'pre-line', lineHeight: '18px', paddingTop: '6px', paddingBottom: '6px' }
    }
    return base
  }

  const formatSummaryCell = (params, col) => {
    if (!params?.node?.rowPinned) {
      const acl = getFieldAcl(params.colDef)
      if (acl?.canView === false) return '*******'
      if (typeof col?.formatter === 'function') return col.formatter(params)
      if (Array.isArray(params.value)) return params.value.join('  ')
      return params.value
    }
    if (col?.type === 'check') return ''
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

  const setWorkflowBinding = (binding) => {
    workflowBinding.value = binding || null
    nextTick(() => applyWorkflowBinding())
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

  watch(workflowBinding, () => {
    applyWorkflowBinding()
  })

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
    if (props.enableColumnLock === false) return
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

  const getLayoutRowKey = (rowData) => {
    if (!rowData) return ''
    if (rowData.id !== undefined && rowData.id !== null) return String(rowData.id)
    if (rowData.employee_no) return String(rowData.employee_no)
    return ''
  }

  const getStoredRowHeight = (rowData) => {
    if (!rowHeightConfig.value.enabled) return undefined
    const key = getLayoutRowKey(rowData)
    if (!key) return undefined
    const height = Number(localLayoutState.rows?.[key])
    return Number.isFinite(height) ? clampRowHeight(height) : undefined
  }

  const applyRowHeight = (rowNode, height, persist = true) => {
    if (!rowHeightConfig.value.enabled || !rowNode || rowNode.rowPinned) return
    const nextHeight = clampRowHeight(height)
    rowNode.setRowHeight?.(nextHeight)
    gridApi.value?.onRowHeightChanged?.()
    if (persist) {
      const rowKey = getLayoutRowKey(rowNode.data)
      if (rowKey) {
        localLayoutState.rows = {
          ...localLayoutState.rows,
          [rowKey]: nextHeight
        }
        safeWriteLocalLayout()
      }
    }
  }

  const resetRowHeight = (params) => {
    if (!rowHeightConfig.value.enabled || !params?.node) return
    stopRowHeightResize()
    const rowKey = getLayoutRowKey(params.node.data)
    if (rowKey && localLayoutState.rows?.[rowKey] !== undefined) {
      const nextRows = { ...localLayoutState.rows }
      delete nextRows[rowKey]
      localLayoutState.rows = nextRows
      safeWriteLocalLayout()
    }
    params.node.__eisDefaultRowHeight = defaultRowHeight.value
    params.node.setRowHeight?.(defaultRowHeight.value)
    const api = params.api || gridApi.value
    api?.onRowHeightChanged?.()
    api?.redrawRows?.({ rowNodes: [params.node] })
  }

  const stopRowHeightResize = () => {
    if (!rowResizeState) return
    document.removeEventListener('mousemove', handleRowHeightResizeMove)
    document.removeEventListener('mouseup', handleRowHeightResizeEnd)
    document.body.classList.remove('is-resizing-grid-row')
    rowResizeState = null
  }

  function handleRowHeightResizeMove(event) {
    if (!rowResizeState?.node) return
    const delta = event.clientY - rowResizeState.startY
    applyRowHeight(rowResizeState.node, rowResizeState.startHeight + delta, false)
  }

  function handleRowHeightResizeEnd() {
    if (rowResizeState?.node) {
      const height = rowResizeState.node.rowHeight || defaultRowHeight.value
      applyRowHeight(rowResizeState.node, height, true)
    }
    stopRowHeightResize()
  }

  const startRowHeightResize = (params, event) => {
    if (!rowHeightConfig.value.enabled || !params?.node || params.node.rowPinned) return
    event?.preventDefault?.()
    const startHeight = params.node.rowHeight || getStoredRowHeight(params.data) || defaultRowHeight.value
    rowResizeState = {
      node: params.node,
      startY: event.clientY,
      startHeight
    }
    document.body.classList.add('is-resizing-grid-row')
    document.addEventListener('mousemove', handleRowHeightResizeMove)
    document.addEventListener('mouseup', handleRowHeightResizeEnd, { once: true })
  }

  const isRowHeightEdgeResizeEvent = (params) => {
    if (!rowHeightConfig.value.enabled || !params?.event || params?.node?.rowPinned) return false
    if (params.event.altKey) return true
    if (params.column?.getColId?.() === '_rowHeight') return true
    const target = params.event.target
    if (!target?.closest) return false
    const cell = target.closest('.ag-cell')
    if (!cell?.getBoundingClientRect) return false
    const rect = cell.getBoundingClientRect()
    const distanceToBottom = rect.bottom - params.event.clientY
    return distanceToBottom >= 0 && distanceToBottom <= ROW_HEIGHT_EDGE_HIT_SIZE
  }

  const applyStoredColumnWidths = () => {
    if (!gridApi.value || !props.localLayoutKey) return
    const state = Object.entries(localLayoutState.columns || {})
      .map(([colId, width]) => ({
        colId,
        width: Number(width)
      }))
      .filter(item => item.colId && Number.isFinite(item.width) && item.width >= 40)
    if (!state.length) return
    try {
      gridApi.value.applyColumnState?.({
        state,
        applyOrder: false
      })
    } catch (e) {}
  }

  const saveColumnLayout = () => {
    if (!gridApi.value || !props.localLayoutKey) return
    const state = gridApi.value.getColumnState?.()
    if (!Array.isArray(state)) return
    const nextColumns = {}
    state.forEach((item) => {
      if (!item?.colId || !Number.isFinite(Number(item.width))) return
      nextColumns[item.colId] = Math.round(Number(item.width))
    })
    localLayoutState.columns = nextColumns
    safeWriteLocalLayout()
  }

  const handleColumnResized = (event) => {
    if (!props.localLayoutKey || event?.finished !== true) return
    if (saveColumnLayoutTimer) window.clearTimeout(saveColumnLayoutTimer)
    saveColumnLayoutTimer = window.setTimeout(() => {
      saveColumnLayoutTimer = null
      saveColumnLayout()
    }, 120)
  }

  const context = reactive({ 
    componentParent: { 
        toggleColumnLock: handleToggleColumnLock, 
        columnLockState,
        viewDocument: handleViewDocument,
        startRowHeightResize,
        resetRowHeight
    } 
  })
  const SYSTEM_RELATION_TYPE_OPTIONS = [
    { label: '无源新增', value: '无源新增' },
    { label: '销售关联', value: '销售关联' },
    { label: '采购关联', value: '采购关联' },
    { label: '生产关联', value: '生产关联' },
    { label: '库存关联', value: '库存关联' },
    { label: '质量关联', value: '质量关联' },
    { label: '设备关联', value: '设备关联' },
    { label: '流程关联', value: '流程关联' },
    { label: '系统生成', value: '系统生成' }
  ]

  const formatAuditDate = (value) => {
    if (value === null || value === undefined || value === '') return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const getConfiguredColumnProps = () => new Set(
    [...(props.staticColumns || []), ...(props.extraColumns || [])]
      .map((col) => String(col?.prop || col?.field || '').trim())
      .filter(Boolean)
  )

  const getSystemStaticColumns = () => {
    const propsSet = getConfiguredColumnProps()
    const cols = []
    if (!propsSet.has('created_at')) {
      cols.push({
        label: '创建日期',
        prop: 'created_at',
        type: 'datetime',
        editable: false,
        width: 170,
        minWidth: 150,
        formatter: (params) => formatAuditDate(params.value)
      })
    }
    if (!propsSet.has('updated_at')) {
      cols.push({
        label: '更新日期',
        prop: 'updated_at',
        type: 'datetime',
        editable: false,
        width: 170,
        minWidth: 150,
        formatter: (params) => formatAuditDate(params.value)
      })
    }
    return cols
  }

  const getSystemDynamicColumns = () => {
    if (props.includeProperties === false) return []
    const propsSet = getConfiguredColumnProps()
    if (propsSet.has('relation_type')) return []
    return [{
      label: '关联类型',
      prop: 'relation_type',
      type: 'select',
      options: SYSTEM_RELATION_TYPE_OPTIONS,
      width: 130,
      minWidth: 120,
      tag: true,
      isSystem: true
    }]
  }


  const createColDef = (col, isDynamic) => {
    const field = isDynamic ? `properties.${col.prop}` : col.prop
    const colId = isDynamic ? `properties.${col.prop}` : col.prop
    const minWidth = col.minWidth ?? 150
    const storedWidth = Number(localLayoutState.columns?.[colId])
    const configuredWidth = Number.isFinite(storedWidth) && storedWidth >= 40 ? storedWidth : col.width
    const widthConfig = configuredWidth
      ? { width: configuredWidth, minWidth, suppressSizeToFit: true }
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
      colId,
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

    if (!colDef.valueFormatter) {
      colDef.valueFormatter = (params) => formatSummaryCell(params, col)
    }
    const aclSnapshot = fieldAcl.value?.[col.prop] || null
    colDef.__aclCanView = aclSnapshot?.canView !== false
    colDef.__aclCanEdit = aclSnapshot?.canEdit !== false

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

    if (col?.type === 'status') {
      return {
        ...colDef,
        cellRenderer: 'StatusRenderer',
        cellEditor: 'StatusEditor',
        cellEditorPopup: true,
        cellEditorPopupPosition: 'under'
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

    if (col?.type === 'check') {
      const parseCheckValue = (val) => {
        if (typeof val === 'boolean') return val
        if (val === null || val === undefined) return false
        const text = String(val).toLowerCase()
        if (text === 'true' || text === 't' || text === '1' || text === 'yes' || text === 'y') return true
        if (text === 'false' || text === 'f' || text === '0' || text === 'no' || text === 'n') return false
        return !!val
      }
      return {
        ...colDef,
        cellRenderer: 'CheckRenderer',
        editable: false,
        checkEditable: (params) => !isCellReadOnly(params),
        suppressClickEdit: true,
        suppressDoubleClickEdit: true,
        suppressKeyboardEvent: () => true,
        valueParser: (params) => {
          return parseCheckValue(params.newValue)
        },
        valueSetter: (params) => {
          const nextVal = parseCheckValue(params.newValue)
          if (params.data?.[field] === nextVal) return false
          params.data[field] = nextVal
          return true
        },
        width: col.width || 90,
        minWidth: col.minWidth || 80
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
        fileAccept: col.fileAccept || '',
        fileStoreMode: col.fileStoreMode || 'list'
      }
    }

    return {
      ...colDef,
      cellEditor: 'agTextCellEditor'
    }
  }

  const gridColumns = computed(() => {
    // ensure acl updates can trigger colDef recalculation
    fieldAcl.value
    const checkboxCol = { 
      colId: 'rowCheckbox', headerCheckboxSelection: true, checkboxSelection: true, 
      width: 40, minWidth: 40, maxWidth: 40, pinned: 'left', 
      resizable: false, sortable: false, filter: false, suppressHeaderMenuButton: true, 
      editable: false,
      suppressClickEdit: true,
      suppressDoubleClickEdit: true,
      suppressKeyboardEvent: () => true,
      suppressNavigable: true,
      valueGetter: () => '',
      valueSetter: () => false,
      cellStyle: { padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' } 
    }

    const rowHeightCol = {
      headerName: '',
      field: '_rowHeight',
      colId: '_rowHeight',
      width: 32,
      minWidth: 32,
      maxWidth: 32,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
      editable: false,
      suppressHeaderMenuButton: true,
      suppressRowClickSelection: true,
      suppressNavigable: true,
      valueGetter: () => '',
      valueSetter: () => false,
      cellRenderer: 'RowHeightHandleRenderer',
      cellStyle: { padding: '0', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }
    }
    
    const statusCol = { 
      headerName: '状态', field: '_status', width: 100, minWidth: 100, pinned: 'left', 
      filter: true, sortable: false, resizable: false, suppressHeaderMenuButton: false,
      editable: (params) => !params.node.rowPinned && !isCellReadOnly(params),
      cellRenderer: 'StatusRenderer', cellEditor: 'StatusEditor', cellEditorPopup: true, cellEditorPopupPosition: 'under',
      cellClassRules: cellClassRules,
      valueGetter: params => {
        if (params.node.rowPinned) return params.data?._status || activeSummaryConfig.label
        if (params.data?.properties?.row_locked_by) return 'locked'
        const hasStatus = params.data && Object.prototype.hasOwnProperty.call(params.data, 'status')
        const raw = hasStatus ? params.data?.status : params.data?.properties?.status
        if (!raw) return 'created'
        const text = String(raw).toLowerCase()
        if (text === 'disabled') return 'locked'
        if (text === 'draft' || text === 'created') return 'created'
        if (text === 'active') return 'active'
        if (text === 'locked') return 'locked'
        return raw
      },
      valueSetter: params => { 
        if(params.node.rowPinned || params.newValue===params.oldValue) return false; 
        const hasStatus = params.data && Object.prototype.hasOwnProperty.call(params.data, 'status')
        const currentRaw = hasStatus ? params.data?.status : params.data?.properties?.status
        const fromStatus = normalizeStatus(currentRaw) || 'created'
        const toStatus = normalizeStatus(params.newValue)
        if (!toStatus) return false
        if (!canTransitionStatus(fromStatus, toStatus)) {
          const code = `op:${aclModule.value}.${STATUS_TRANSITION_ACTION}.${fromStatus}_${toStatus}`
          ElMessage.warning(`无权限变更状态：缺少 ${code}`)
          return false
        }
        const allowProps = params.data && (params.data.properties || props.includeProperties !== false)
        if (allowProps) {
          if(!params.data.properties) params.data.properties={}; 
          params.data.properties.status=toStatus; 
          params.data.properties.row_locked_by = toStatus==='locked'?currentUser.value:null; 
        }
        if (hasStatus) {
          const mapped = toStoredStatus(toStatus)
          params.data.status = mapped
        }
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

    const attentionCol = {
      headerName: '关注',
      field: 'properties.attention_level',
      colId: '_attention',
      type: 'select',
      isAttentionColumn: true,
      width: 96,
      minWidth: 96,
      pinned: 'left',
      sortable: true,
      filter: true,
      resizable: false,
      editable: (params) => !params.node.rowPinned && !isCellReadOnly(params),
      singleClickEdit: true,
      suppressHeaderMenuButton: false,
      cellRenderer: 'SelectRenderer',
      cellEditor: 'SelectEditor',
      cellEditorPopup: true,
      cellEditorPopupPosition: 'under',
      options: HR_ATTENTION_LEVEL_OPTIONS,
      allowClear: false,
      valueGetter: params => {
        if (params.node.rowPinned) return ''
        return getManualAttentionLevel(params.data) || resolveAttention(params.data)?.level || 'normal'
      },
      valueParser: params => normalizeAttentionLevel(params.newValue) || null,
      valueSetter: params => {
        if (params.node.rowPinned) return false
        const nextLevel = normalizeAttentionLevel(params.newValue)
        if (!params.data.properties || typeof params.data.properties !== 'object') {
          params.data.properties = {}
        }
        const currentLevel = normalizeAttentionLevel(params.data.properties.attention_level)
        if (currentLevel === nextLevel) return false
        if (nextLevel) params.data.properties.attention_level = nextLevel
        else delete params.data.properties.attention_level
        return true
      },
      comparator: (a, b) => attentionLevelRank(normalizeAttentionLevel(a) || 'normal') - attentionLevelRank(normalizeAttentionLevel(b) || 'normal'),
      cellClassRules: {
        'attention-cell-critical': (params) => resolveAttention(params.data)?.level === 'critical',
        'attention-cell-warning': (params) => resolveAttention(params.data)?.level === 'warning',
        'attention-cell-focus': (params) => resolveAttention(params.data)?.level === 'focus',
        'attention-cell-normal': (params) => ['normal', 'silent'].includes(resolveAttention(params.data)?.level)
      },
      cellStyle: (params) => ({ ...getCellStyle(params), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' })
    }

    const staticCols = [...props.staticColumns, ...getSystemStaticColumns()].map(col => createColDef(col, false))
    const dynamicCols = [...getSystemDynamicColumns(), ...props.extraColumns].map(col => createColDef(col, true))

    const prefixCols = [
      checkboxCol,
      ...(rowHeightConfig.value.enabled ? [rowHeightCol] : []),
      ...(props.attentionResolver ? [attentionCol] : [])
    ]

    const baseCols = props.showStatusCol === false
      ? [...prefixCols, ...staticCols, ...dynamicCols]
      : [...prefixCols, statusCol, ...staticCols, ...dynamicCols]

    return props.showActionCol === false
      ? baseCols
      : [...baseCols, actionCol]
  })

  watch([aclRoleId, aclModule], () => {
    if (gridApi.value) {
      loadFieldAcl()
      gridApi.value.refreshCells({ force: true })
    }
  })

  const getRowHeight = (params) => {
    if (params?.node?.rowPinned) return defaultRowHeight.value
    if (params?.node?.__eisDefaultRowHeight) {
      const height = params.node.__eisDefaultRowHeight
      delete params.node.__eisDefaultRowHeight
      return height
    }
    return getStoredRowHeight(params?.data) || defaultRowHeight.value
  }

  const onGridReadyLayout = () => {
    safeReadLocalLayout()
    nextTick(() => {
      applyStoredColumnWidths()
      gridApi.value?.resetRowHeights?.()
    })
  }

  const { isLoadingMore, hasMoreRows, loadData, loadNextPage } = createPagedGridLoader({
    props,
    gridData,
    searchText,
    isLoading,
    gridApi,
    eventEmitter,
    loadFieldAcl,
    request,
    buildSearchQuery,
    ElMessage,
    defaultProfile: 'hr'
  })

  return {
    gridApi, gridData, gridColumns, context, gridComponents, searchText, isLoading,
    isLoadingMore, hasMoreRows, loadData, loadNextPage,
    handleToggleColumnLock, getCellStyle, isCellReadOnly, rowClassRules, columnLockState,
    setWorkflowBinding, getRowHeight, handleColumnResized, onGridReadyLayout,
    stopRowHeightResize, startRowHeightResize, resetRowHeight, isRowHeightEdgeResizeEvent
  }
}
