import { reactive, ref, computed, watch, nextTick } from 'vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

// 🟢 接收 columnLockState 参数
export function useGridFormula(props, gridApi, gridData, activeSummaryConfig, currentUser, hooks, columnLockState) {
  const pinnedBottomRowData = ref([])
  const isSavingConfig = ref(false)
  const configDialog = reactive({ visible: false, title: '', type: null, colId: null, tempValue: '', expression: '', cellLabel: '' })

  const availableColumns = computed(() => [...props.staticColumns, ...props.extraColumns].map(c => ({ label: c.label, prop: c.prop })))

  // 加载配置 (包含列锁)
  const loadGridConfig = async () => {
    if (!props.viewId) return
    try {
      const res = await request({
        url: `/sys_grid_configs?view_id=eq.${props.viewId}`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' } 
      })
      if (res && res.length > 0) {
        const remoteConfig = res[0].summary_config
        if (remoteConfig) {
          Object.assign(activeSummaryConfig, remoteConfig)
          if (!activeSummaryConfig.expressions) activeSummaryConfig.expressions = {}
          if (!activeSummaryConfig.rules) activeSummaryConfig.rules = {}
          if (!activeSummaryConfig.cellLabels) {
            activeSummaryConfig.cellLabels = remoteConfig.cell_labels || remoteConfig.cellLabels || {}
          }
          
          // 🟢 恢复列锁状态
           if (props.enableColumnLock !== false && remoteConfig.column_locks) {
             Object.assign(columnLockState, remoteConfig.column_locks)
           }
          
          pinnedBottomRowData.value = calculateTotals(gridData.value)
          
          if (gridApi.value) {
             gridApi.value.refreshCells({ force: true })
             gridApi.value.redrawRows() // 重绘以应用列锁样式
          }
        }
      }
    } catch(e) {
      if (e.response && e.response.status !== 404) {
        console.warn('Failed to load grid config', e)
      }
    }
  }

  // ... (calculateRowFormulas 和 calculateTotals 保持不变) ...
  // L2: 行内公式计算
  const calculateRowFormulas = (rowNode) => {
    if (!rowNode || !rowNode.data) return false
    const formulaCols = props.extraColumns.filter(c => c.type === 'formula' && c.expression)
    if (formulaCols.length === 0) return false

    let hasChanges = false
    const rowDataMap = {}
    props.staticColumns.forEach(c => { rowDataMap[c.prop] = rowNode.data[c.prop]; rowDataMap[c.label] = rowNode.data[c.prop] })
    props.extraColumns.forEach(c => { const val = rowNode.data.properties?.[c.prop]; rowDataMap[c.prop] = val; rowDataMap[c.label] = val })

    formulaCols.forEach(col => {
      try {
        const evalExpr = col.expression.replace(/\{(.+?)\}/g, (match, key) => {
          let val = rowDataMap[key]; const num = parseFloat(val); return isNaN(num) ? 0 : num
        })
        const result = new Function(`return (${evalExpr})`)()
        if (result !== undefined && !isNaN(result) && isFinite(result)) {
          const finalVal = Number(result.toFixed(2)) 
          const currentVal = rowNode.data.properties?.[col.prop]
          if (currentVal !== finalVal) {
            if (!rowNode.data.properties) rowNode.data.properties = {}
            rowNode.data.properties[col.prop] = finalVal
            gridApi.value.refreshCells({ rowNodes: [rowNode], columns: [`properties.${col.prop}`] })
            hasChanges = true
            if (hooks.pushPendingChange) {
                hooks.pushPendingChange({
                    rowNode: rowNode,
                    colDef: { field: `properties.${col.prop}` },
                    newValue: finalVal,
                    oldValue: currentVal
                })
            }
          }
        }
      } catch (e) { }
    })
    return hasChanges
  }

  // L1 & L3: 底部合计计算
  const calculateTotals = (data) => {
    if (!data || data.length === 0) return []
    const totalRow = { id: 'bottom_total', _status: activeSummaryConfig.label, properties: {} }
    const l1Results = {} 
    const columns = [...props.staticColumns, ...props.extraColumns]
    
    columns.forEach(col => {
      const isProp = !props.staticColumns.find(c => c.prop === col.prop)
      const values = data.map(row => { const v = isProp ? row.properties?.[col.prop] : row[col.prop]; return (v === null || v === undefined || v === '') ? null : v }).filter(v => v !== null)
      let rule = activeSummaryConfig.rules[col.prop] || 'none'
      let result = null
      if (values.length > 0) {
        const numbers = values.map(Number).filter(n => !isNaN(n))
        if (rule === 'sum') result = numbers.reduce((a, b) => a + b, 0)
        else if (rule === 'avg' && numbers.length) result = numbers.reduce((a, b) => a + b, 0) / numbers.length
        else if (rule === 'count') result = values.length
        else if (rule === 'max' && numbers.length) result = Math.max(...numbers)
        else if (rule === 'min' && numbers.length) result = Math.min(...numbers)
        else if (rule === 'none') {
           const isNum = values.every(v => !isNaN(Number(v)))
           if (isNum) result = numbers.reduce((a, b) => a + b, 0); else result = values.length
        }
      }
      l1Results[col.prop] = result !== null ? result : 0
      if (rule !== 'none' && result !== null && typeof result === 'number') {
        const displayVal = Number(result.toFixed(2))
        if (isProp) totalRow.properties[col.prop] = displayVal; else totalRow[col.prop] = displayVal
      }
    })

    const valueMap = {}; Object.keys(l1Results).forEach(p => { valueMap[p] = l1Results[p]; const c = columns.find(x => x.prop === p); if(c && c.label) valueMap[c.label] = l1Results[p] })
    columns.forEach(col => {
      const expr = activeSummaryConfig.expressions?.[col.prop]
      if (expr) {
        try {
          const res = new Function(`return (${expr.replace(/\{(.+?)\}/g, (m,k) => valueMap[k]??0)})`)()
          if (res !== undefined && !isNaN(res) && isFinite(res)) {
             const d = Number(res.toFixed(2)); const isP = !props.staticColumns.find(c => c.prop === col.prop)
             if (isP) totalRow.properties[col.prop] = d; else totalRow[col.prop] = d
          }
        } catch(e){}
      }
    })
    
    columns.forEach(col => {
      const rule = activeSummaryConfig.rules[col.prop]; const hasF = !!activeSummaryConfig.expressions?.[col.prop]
      if ((!rule || rule === 'none') && !hasF) {
        const isP = !props.staticColumns.find(c => c.prop === col.prop)
        if (isP) delete totalRow.properties[col.prop]; else delete totalRow[col.prop]
      }
    })

    return [totalRow]
  }

  const openConfigDialog = (colName, colId, isAdmin) => {
    if (!isAdmin) { ElMessage.warning('只有管理员可以配置合计规则'); return }
    if (colId === '_status' || colId === 'rowCheckbox') {
      configDialog.type = 'label'; configDialog.title = '重命名合计'; configDialog.tempValue = activeSummaryConfig.label
    } else {
      const field = colId.replace('properties.', '')
      configDialog.type = 'data'; configDialog.title = `统计配置: ${colName}`; configDialog.colId = field
      configDialog.expression = activeSummaryConfig.expressions?.[field] || ''
      configDialog.tempValue = activeSummaryConfig.rules[field] || 'none'
      configDialog.cellLabel = activeSummaryConfig.cellLabels?.[field] || ''
    }
    configDialog.visible = true
  }

  const saveConfig = async (formData) => {
    if (configDialog.type === 'label') {
        activeSummaryConfig.label = formData.label
    } else {
        const field = configDialog.colId
        if (formData.rule) activeSummaryConfig.rules[field] = formData.rule; else delete activeSummaryConfig.rules[field]
        if (formData.tab === 'formula' && formData.expression && formData.expression.trim()) activeSummaryConfig.expressions[field] = formData.expression
        else delete activeSummaryConfig.expressions[field]
        if (!activeSummaryConfig.cellLabels) activeSummaryConfig.cellLabels = {}
        if (formData.cellLabel && formData.cellLabel.trim()) activeSummaryConfig.cellLabels[field] = formData.cellLabel.trim()
        else delete activeSummaryConfig.cellLabels[field]
    }
    pinnedBottomRowData.value = calculateTotals(gridData.value)
    if(gridApi.value) {
        gridApi.value.refreshCells({ rowNodes: [gridApi.value.getPinnedBottomRow(0)], force: true })
    }
    configDialog.visible = false
    
    if (props.viewId) {
        isSavingConfig.value = true
        try {
            await request({
                url: '/sys_grid_configs?on_conflict=view_id', method: 'post',
                headers: { 'Prefer': 'resolution=merge-duplicates', 'Content-Profile': 'public' }, 
                data: { 
                    view_id: props.viewId, 
                    summary_config: {
                      label: activeSummaryConfig.label,
                      rules: activeSummaryConfig.rules,
                      expressions: activeSummaryConfig.expressions,
                      cell_labels: activeSummaryConfig.cellLabels,
                      ...(props.enableColumnLock === false ? {} : { column_locks: columnLockState })
                    },
                    updated_by: currentUser.value 
                }
            })
            ElMessage.success('配置已保存')
        } catch(e) { ElMessage.error('保存失败') } 
        finally { isSavingConfig.value = false }
    }
  }

  // 🟢 监听列锁变化，自动触发保存
    watch(columnLockState, async () => {
      if (props.enableColumnLock === false) return
      // 这里的逻辑稍微有点 trick：我们复用 saveConfig 里的持久化逻辑，但不需要弹窗
      // 为了不重写一遍 request，我们可以封装一个 internalSave
      // 但为了简单，这里直接复制核心请求代码，实现“静默保存”
      if (props.viewId) {
        try {
            await request({
                url: '/sys_grid_configs?on_conflict=view_id', method: 'post',
                headers: { 'Prefer': 'resolution=merge-duplicates', 'Content-Profile': 'public' }, 
                data: { 
                    view_id: props.viewId, 
                    summary_config: {
                        label: activeSummaryConfig.label,
                        rules: activeSummaryConfig.rules,
                        expressions: activeSummaryConfig.expressions,
                        cell_labels: activeSummaryConfig.cellLabels,
                        column_locks: columnLockState
                    },
                    updated_by: currentUser.value 
                }
            })
            // 列锁变化不需要弹出成功提示，以免打扰用户，或者可以改用 console.log
        } catch(e) { console.error('Auto save locks failed', e) }
      }
  }, { deep: true })

  watch(gridData, (newData) => pinnedBottomRowData.value = calculateTotals(newData), { immediate: true })
  
  watch(() => props.extraColumns, async () => {
    await nextTick()
    if (!gridApi.value) return
    let hasGlobalChanges = false
    gridApi.value.forEachNode(node => { if (calculateRowFormulas(node)) hasGlobalChanges = true })
    if (hasGlobalChanges) {
      gridApi.value.refreshCells()
      pinnedBottomRowData.value = calculateTotals(gridData.value)
      if(hooks.triggerSave) hooks.triggerSave()
    }
  }, { deep: true })

  return {
    pinnedBottomRowData, calculateRowFormulas, calculateTotals, 
    configDialog, isSavingConfig, availableColumns, 
    openConfigDialog, saveConfig, loadGridConfig
  }
}
