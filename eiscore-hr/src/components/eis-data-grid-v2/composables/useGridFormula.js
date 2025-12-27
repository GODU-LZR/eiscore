import { reactive, ref, computed, watch, nextTick } from 'vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

export function useGridFormula(props, gridApi, gridData, activeSummaryConfig, currentUser, hooks) {
  const pinnedBottomRowData = ref([])
  const isSavingConfig = ref(false)
  const configDialog = reactive({ visible: false, title: '', type: null, colId: null, tempValue: '', expression: '' })

  const availableColumns = computed(() => [...props.staticColumns, ...props.extraColumns].map(c => ({ label: c.label, prop: c.prop })))

  // L2: 行内公式
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
            // 更新视图
            gridApi.value.refreshCells({ rowNodes: [rowNode], columns: [`properties.${col.prop}`] })
            hasChanges = true
            // 通知 History 模块记录变更
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

  // L1 & L3: 底部合计
  const calculateTotals = (data) => {
    if (!data || data.length === 0) return []
    const totalRow = { id: 'bottom_total', _status: activeSummaryConfig.label, properties: {} }
    const l1Results = {} 
    const columns = [...props.staticColumns, ...props.extraColumns]
    
    // L1
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

    // L2 底部公式
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
    
    // L3 清理
    columns.forEach(col => {
      const rule = activeSummaryConfig.rules[col.prop]; const hasF = !!activeSummaryConfig.expressions?.[col.prop]
      if ((!rule || rule === 'none') && !hasF) {
        const isP = !props.staticColumns.find(c => c.prop === col.prop)
        if (isP) delete totalRow.properties[col.prop]; else delete totalRow[col.prop]
      }
    })
    return [totalRow]
  }

  // Config Dialog Logic
  const openConfigDialog = (colName, colId, isAdmin) => {
    if (!isAdmin) { ElMessage.warning('只有管理员可以配置合计规则'); return }
    if (colId === '_status' || colId === 'rowCheckbox') {
      configDialog.type = 'label'; configDialog.title = '重命名合计'; configDialog.tempValue = activeSummaryConfig.label
    } else {
      const field = colId.replace('properties.', '')
      configDialog.type = 'data'; configDialog.title = `统计配置: ${colName}`; configDialog.colId = field
      configDialog.expression = activeSummaryConfig.expressions?.[field] || ''
      configDialog.tempValue = activeSummaryConfig.rules[field] || 'none'
    }
    configDialog.visible = true
  }

  const saveConfig = async (formData) => {
    if (configDialog.type === 'label') {
        activeSummaryConfig.label = formData.label
    } else {
        const field = configDialog.colId
        if (formData.rule) activeSummaryConfig.rules[field] = formData.rule; else delete activeSummaryConfig.rules[field]
        if (formData.tab === 'formula' && formData.expression.trim()) activeSummaryConfig.expressions[field] = formData.expression
        else delete activeSummaryConfig.expressions[field]
    }
    pinnedBottomRowData.value = calculateTotals(gridData.value)
    configDialog.visible = false
    
    // Persist
    if (props.viewId) {
        isSavingConfig.value = true
        try {
            await request({
                url: '/sys_grid_configs?on_conflict=view_id', method: 'post',
                headers: { 'Prefer': 'resolution=merge-duplicates', 'Content-Profile': 'public' }, 
                data: { view_id: props.viewId, summary_config: activeSummaryConfig, updated_by: currentUser.value }
            })
            ElMessage.success('配置已保存')
        } catch(e) { ElMessage.error('保存失败') } 
        finally { isSavingConfig.value = false }
    }
  }

  // Watchers
  watch(gridData, (newData) => pinnedBottomRowData.value = calculateTotals(newData), { immediate: true })
  
  // 监听列配置变化，全表重算
  watch(() => props.extraColumns, async () => {
    await nextTick()
    if (!gridApi.value) return
    let hasGlobalChanges = false
    gridApi.value.forEachNode(node => { if (calculateRowFormulas(node)) hasGlobalChanges = true })
    if (hasGlobalChanges) {
      gridApi.value.refreshCells()
      pinnedBottomRowData.value = calculateTotals(gridData.value)
      // 需要触发保存，这里由外部 hook 调用 debouncedSave
      if(hooks.triggerSave) hooks.triggerSave()
    }
  }, { deep: true })

  return {
    pinnedBottomRowData, calculateRowFormulas, calculateTotals, 
    configDialog, isSavingConfig, availableColumns, 
    openConfigDialog, saveConfig
  }
}
