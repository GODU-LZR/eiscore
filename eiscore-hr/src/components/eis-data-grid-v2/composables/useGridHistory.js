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

  const buildCompletePayload = (rowData) => {
    const payload = JSON.parse(JSON.stringify(rowData)); if (!payload.properties) payload.properties = {}; payload.updated_at = new Date().toISOString(); return payload
  }

  const debouncedSave = debounce(async () => {
    if (pendingChanges.length === 0) return
    const changesToProcess = [...pendingChanges]; pendingChanges.length = 0; isRemoteUpdating.value = true 
    try {
        const rowUpdatesMap = new Map()
        changesToProcess.forEach(({ rowNode, colDef, newValue }) => {
            const id = rowNode.data.id
            if (!rowUpdatesMap.has(id)) {
                const basePayload = buildCompletePayload(rowNode.data)
                rowUpdatesMap.set(id, { rowNode, payload: basePayload, properties: basePayload.properties })
            }
            const group = rowUpdatesMap.get(id)
            if (colDef.field === '_status') Object.assign(group.properties, rowNode.data.properties)
            else if (colDef.field.startsWith('properties.')) group.properties[colDef.field.split('.')[1]] = newValue
            else group.payload[colDef.field] = newValue
        })
        const apiPayload = Array.from(rowUpdatesMap.values()).map(g => ({ ...g.payload, version: (g.payload.version||1)+1 }))
        const affectedNodes = Array.from(rowUpdatesMap.values()).map(g => ({ node: g.rowNode, newVer: (g.payload.version||1)+1 }))
        
        if (apiPayload.length > 0) {
            await request({
                url: `${props.apiUrl}`, method: 'post',
                headers: { 'Content-Profile': 'hr', 'Prefer': 'resolution=merge-duplicates,return=representation' },
                data: apiPayload
            })
            affectedNodes.forEach(({ node, newVer }) => { node.data.version = newVer })
            gridApi.value.refreshCells({ rowNodes: affectedNodes.map(i => i.node), force: false })
            if (!isSystemOperation.value) ElMessage.success(`已保存 ${apiPayload.length} 行变更`)
        }
    } catch (e) { ElMessage.error('保存失败') } 
    finally { setTimeout(() => { isRemoteUpdating.value = false }, 50) }
  }, 100)

  const sanitizeValue = (field, value) => {
    const key = field.includes('.') ? field.split('.').pop() : field
    const textFields = ['name', 'code', 'employee_id', 'username', 'email', 'phone', 'id_card', 'address']
    const isEmpty = value === null || value === undefined || value === ''
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
    clearDependentFields(event)
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
        await ElMessageBox.confirm(`确定要删除选中的 ${selectedNodes.length} 条数据吗？`, '警告', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
        const ids = selectedNodes.map(n => n.data.id)
        await request({ url: `${props.apiUrl}?id=in.(${ids.join(',')})`, method: 'delete' })
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
