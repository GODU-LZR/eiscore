import { reactive, ref } from 'vue'
import { debounce } from 'lodash'
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

export function useGridHistory(props, gridApi, gridData, formulaHooks) {
  const history = reactive({ undoStack: [], redoStack: [] })
  const pendingChanges = []
  const isRemoteUpdating = ref(false)
  const isSystemOperation = ref(false) // 使用 ref 以保持响应性引用

  const selectedRowsCount = ref(0)
  const includeProperties = props.includeProperties !== false
  const getWriteMode = () => props.writeMode || 'upsert'
  const resolveProfile = () => props.profile || props.contentProfile || props.acceptProfile || 'public'
  const fieldDefaults = props.fieldDefaults || {}
  const patchRequiredFields = Array.isArray(props.patchRequiredFields) ? props.patchRequiredFields : []

  const resolveWriteUrl = () => {
    if (props.writeUrl) return props.writeUrl
    if (!props.apiUrl) return ''
    const [base] = props.apiUrl.split('?')
    return base || props.apiUrl
  }

  const appendQuery = (url, query) => {
    if (!query) return url
    return `${url}${url.includes('?') ? '&' : '?'}${query}`
  }

  const buildCompletePayload = (rowData) => {
    const payload = JSON.parse(JSON.stringify(rowData))
    if (includeProperties) {
      const hasProps = Object.prototype.hasOwnProperty.call(payload, 'properties') || (props.extraColumns || []).length > 0
      if (hasProps) {
        if (!payload.properties || typeof payload.properties !== 'object') payload.properties = {}
      } else {
        delete payload.properties
      }
    } else {
      delete payload.properties
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'updated_at')) {
      payload.updated_at = new Date().toISOString()
    }
    return payload
  }

  const cloneValue = (value) => {
    if (Array.isArray(value)) return [...value]
    if (value && typeof value === 'object') return { ...value }
    return value
  }

  const applyFieldDefaults = (field, value) => {
    if (value === null || value === undefined || value === '') {
      if (Object.prototype.hasOwnProperty.call(fieldDefaults, field)) {
        return cloneValue(fieldDefaults[field])
      }
    }
    return value
  }

  const buildPatchPayload = (entry) => {
    const payload = { ...entry.payload }
    Object.keys(payload).forEach((field) => {
      payload[field] = applyFieldDefaults(field, payload[field])
    })
    patchRequiredFields.forEach((field) => {
      if (payload[field] === null || payload[field] === undefined || payload[field] === '') {
        const rowValue = entry.rowNode?.data?.[field]
        payload[field] = rowValue !== undefined ? applyFieldDefaults(field, rowValue) : applyFieldDefaults(field, null)
      }
    })
    return payload
  }

  const debouncedSave = debounce(async () => {
    if (pendingChanges.length === 0) return
    const changesToProcess = [...pendingChanges]; pendingChanges.length = 0; isRemoteUpdating.value = true 
    try {
        const writeMode = getWriteMode()
        const rowUpdatesMap = new Map()
        changesToProcess.forEach(({ rowNode, colDef, newValue }) => {
            const id = rowNode.data.id
            if (!rowUpdatesMap.has(id)) {
                if (writeMode === 'patch') {
                  rowUpdatesMap.set(id, { rowNode, payload: {}, properties: null, useProperties: includeProperties })
                } else {
                  const basePayload = buildCompletePayload(rowNode.data)
                  rowUpdatesMap.set(id, { rowNode, payload: basePayload, properties: basePayload.properties, useProperties: !!basePayload.properties })
                }
            }
            const group = rowUpdatesMap.get(id)
            if (colDef.field === '_status' && group.useProperties && rowNode.data?.properties) {
                if (writeMode === 'patch') {
                  group.payload.properties = { ...(rowNode.data.properties || {}) }
                } else {
                  Object.assign(group.properties, rowNode.data.properties)
                }
            } else if (colDef.field.startsWith('properties.') && group.useProperties) {
                const propKey = colDef.field.split('.')[1]
                if (writeMode === 'patch') {
                  if (!group.payload.properties) {
                    group.payload.properties = { ...(rowNode.data.properties || {}) }
                  }
                  group.payload.properties[propKey] = newValue
                } else {
                  group.properties[propKey] = newValue
                }
            }
            else group.payload[colDef.field] = newValue
        })
        const entries = Array.from(rowUpdatesMap.values())

        if (entries.length > 0) {
            if (writeMode === 'patch') {
              await Promise.all(entries.map(async (entry) => {
                const rowId = entry.rowNode?.data?.id
                if (!rowId) return
                if (!entry.payload || Object.keys(entry.payload).length === 0) return
                const patchPayload = buildPatchPayload(entry)
                if (!patchPayload || Object.keys(patchPayload).length === 0) return
                const patchUrl = appendQuery(resolveWriteUrl(), `id=eq.${rowId}`)
                await request({
                  url: patchUrl,
                  method: 'patch',
                  headers: { 'Content-Profile': resolveProfile(), 'Prefer': 'return=representation' },
                  data: patchPayload
                })
              }))
              gridApi.value.refreshCells({ rowNodes: entries.map(i => i.rowNode), force: false })
              if (!isSystemOperation.value) ElMessage.success(`已保存 ${entries.length} 行变更`)
            } else {
              const apiPayload = entries.map(g => {
                  const nextPayload = { ...g.payload }
                  if (Object.prototype.hasOwnProperty.call(nextPayload, 'version')) {
                    nextPayload.version = (nextPayload.version || 1) + 1
                  }
                  return nextPayload
              })
              const affectedNodes = entries.map(g => ({
                  node: g.rowNode,
                  newVer: Object.prototype.hasOwnProperty.call(g.payload, 'version') ? (g.payload.version || 1) + 1 : null
              }))
              await request({
                  url: resolveWriteUrl(), method: 'post',
                  headers: { 'Content-Profile': resolveProfile(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
                  data: apiPayload
              })
              affectedNodes.forEach(({ node, newVer }) => {
                if (newVer !== null) node.data.version = newVer
              })
              gridApi.value.refreshCells({ rowNodes: affectedNodes.map(i => i.node), force: false })
              if (!isSystemOperation.value) ElMessage.success(`已保存 ${apiPayload.length} 行变更`)
            }
        }
    } catch (e) {
      const detail = e?.response?.data?.message || e?.response?.data?.details || e?.message
      ElMessage.error(detail || '保存失败')
    } 
    finally { setTimeout(() => { isRemoteUpdating.value = false }, 50) }
  }, 100)

  const sanitizeValue = (field, value) => {
    const key = field.includes('.') ? field.split('.').pop() : field
    const textFields = ['name', 'code', 'employee_id', 'username', 'email', 'phone', 'id_card', 'address']
    const isEmpty = value === null || value === undefined || value === ''
    if (key === 'punch_times') {
      if (Array.isArray(value)) return value
      const raw = isEmpty ? '' : String(value)
      if (!raw.trim()) return []
      return raw
        .split(/[\s,;，、]+/)
        .map(item => item.trim())
        .filter(Boolean)
    }
    if (isEmpty && Object.prototype.hasOwnProperty.call(fieldDefaults, key)) {
      const fallback = fieldDefaults[key]
      if (Array.isArray(fallback)) return [...fallback]
      if (fallback && typeof fallback === 'object') return { ...fallback }
      return fallback
    }
    if (isEmpty) return textFields.includes(key) ? "" : null
    return value
  }

  const getByPath = (obj, path) => {
    if (!obj || !path) return undefined
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
  }

  const clearDependentFields = (event) => {
    if (!gridApi.value) return
    const changedField = event.colDef.field
    const cols = gridApi.value.getColumns() || []
    const dependents = cols
      .map(col => col.getColDef())
      .filter(def => def?.dependsOnField === changedField)

    if (dependents.length === 0) return

    isSystemOperation.value = true
    dependents.forEach(def => {
      const oldVal = getByPath(event.node.data, def.field)
      if (oldVal !== null && oldVal !== undefined && oldVal !== '') {
        event.node.setDataValue(def.field, null)
        pendingChanges.push({
          rowNode: event.node,
          colDef: { field: def.field },
          newValue: null,
          oldValue: oldVal
        })
      }
    })
    setTimeout(() => { isSystemOperation.value = false }, 0)
  }

  const openDependentCascader = (event) => {
    if (!gridApi.value) return
    if (!event || event.node?.rowPinned) return
    const newValue = event.newValue
    if (newValue === null || newValue === undefined || newValue === '') return
    const changedField = event.colDef.field
    const cols = gridApi.value.getColumns() || []
    const targetCol = cols.find(col => {
      const def = col.getColDef()
      return def?.dependsOnField === changedField && def?.type === 'cascader'
    })
    if (!targetCol) return
    const colId = targetCol.getColId()
    setTimeout(() => {
      gridApi.value.startEditingCell({ rowIndex: event.rowIndex, colKey: colId })
    }, 0)
  }

  const enqueueSyncFields = (event) => {
    const fields = Array.isArray(event?.colDef?.syncFields) ? event.colDef.syncFields : []
    if (fields.length === 0) return
    fields.forEach((field) => {
      const nextVal = sanitizeValue(field, getByPath(event.node.data, field))
      pendingChanges.push({
        rowNode: event.node,
        colDef: { field },
        newValue: nextVal,
        oldValue: null
      })
    })
  }

  const onCellValueChanged = (event) => {
    if (isSystemOperation.value) {
        formulaHooks.calculateRowFormulas(event.node)
        formulaHooks.pinnedBottomRowData.value = formulaHooks.calculateTotals(gridData.value)
        debouncedSave()
        return
    }

    if (event.node.rowPinned) return 
    if (isRemoteUpdating.value || event.oldValue === event.newValue) return

    const safeValue = sanitizeValue(event.colDef.field, event.newValue)
    if (safeValue !== event.newValue) {
        isRemoteUpdating.value = true
        event.node.setDataValue(event.colDef.field, safeValue)
        isRemoteUpdating.value = false
    }

    formulaHooks.calculateRowFormulas(event.node)
    formulaHooks.pinnedBottomRowData.value = formulaHooks.calculateTotals(gridData.value)

    history.redoStack = [] 
    history.undoStack.push({
        type: 'single', rowId: event.node.data.id, colId: event.colDef.field, oldValue: event.oldValue, newValue: safeValue
    })

    pendingChanges.push({ rowNode: event.node, colDef: event.colDef, newValue: safeValue, oldValue: event.oldValue })
    enqueueSyncFields(event)
    clearDependentFields(event)
    openDependentCascader(event)
    debouncedSave()
  }

  const performUndoRedo = (action) => {
    const stack = action === 'undo' ? history.undoStack : history.redoStack
    const reverseStack = action === 'undo' ? history.redoStack : history.undoStack
    if (stack.length === 0) return ElMessage.info('没有可操作记录')

    const transaction = stack.pop()
    reverseStack.push(transaction)
    isSystemOperation.value = true

    const changes = transaction.type === 'batch' ? transaction.changes : [transaction]
    changes.forEach(c => {
        const rowNode = gridApi.value.getRowNode(String(c.rowId))
        if (rowNode) {
            const val = action === 'undo' ? c.oldValue : c.newValue
            rowNode.setDataValue(c.colId, val)
            pendingChanges.push({ rowNode, colDef: { field: c.colId }, newValue: val, oldValue: action==='undo'?c.newValue:c.oldValue })
        }
    })
    
    debouncedSave()
    ElMessage.info(transaction.type==='batch' ? `${action==='undo'?'撤销':'重做'}批量操作` : `${action==='undo'?'撤销':'重做'}编辑`)
    setTimeout(() => isSystemOperation.value = false, 50)
  }

  const deleteSelectedRows = async () => {
    const selectedNodes = gridApi.value.getSelectedNodes()
    if (selectedNodes.length === 0) return
    const lockedNodes = selectedNodes.filter(n => n.data.properties?.row_locked_by)
    if (lockedNodes.length > 0) return ElMessage.warning(`选中行中有 ${lockedNodes.length} 行已被锁定，无法删除`)
    try {
        debouncedSave.cancel()
        pendingChanges.length = 0
        await ElMessageBox.confirm(`确定要删除选中的 ${selectedNodes.length} 条数据吗？`, '警告', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
        const ids = selectedNodes.map(n => n.data.id)
        const deleteUrl = appendQuery(resolveWriteUrl(), `id=in.(${ids.join(',')})`)
        await request({ url: deleteUrl, method: 'delete' })
        gridApi.value.applyTransaction({ remove: selectedNodes.map(node => node.data) })
        formulaHooks.pinnedBottomRowData.value = formulaHooks.calculateTotals(gridData.value)
        ElMessage.success('删除成功'); selectedRowsCount.value = 0; history.undoStack = []; history.redoStack = []
    } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
  }

  // 供 Formula Hook 回调使用
  const pushPendingChange = (change) => pendingChanges.push(change)

  return {
    history, isSystemOperation, pendingChanges, selectedRowsCount,
    onCellValueChanged, debouncedSave, performUndoRedo, deleteSelectedRows, pushPendingChange, sanitizeValue
  }
}
