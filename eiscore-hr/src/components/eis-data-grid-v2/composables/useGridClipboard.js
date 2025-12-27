import { ElMessage } from 'element-plus'

export function useGridClipboard(gridApi, historyHooks, selectionHooks) {
  const { history, isSystemOperation, debouncedSave, performUndoRedo, sanitizeValue, pushPendingChange } = historyHooks
  const { rangeSelection, getColIndex } = selectionHooks

  const handleGlobalPaste = async (event) => {
    if (!gridApi.value) return
    const activeEl = document.activeElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) if (!activeEl.closest('.ag-root-wrapper')) return 
    const focusedCell = gridApi.value.getFocusedCell()
    const hasRange = rangeSelection.active
    if (!focusedCell && !hasRange) return
    
    const clipboardData = event.clipboardData || window.clipboardData
    if (!clipboardData) return
    const text = clipboardData.getData('text')
    if (!text) return
    
    // 原始逻辑：处理换行符
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let rows = cleanText.split('\n');
    if (rows[rows.length - 1] === '') rows.pop(); 
    
    const pasteMatrix = rows.map(row => row.split('\t'));
    const pasteRowCount = pasteMatrix.length;
    const pasteColCount = pasteMatrix.length > 0 ? pasteMatrix[0].length : 0;
    if (pasteRowCount === 0) return;
    
    const allCols = gridApi.value.getAllGridColumns();
    
    // 开启事务
    isSystemOperation.value = true 
    const transaction = { type: 'batch', changes: [] }

    let startRowIdx = -1, startColIdx = -1;
    if (rangeSelection.active) {
      startRowIdx = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex);
      const sC = getColIndex(rangeSelection.startColId);
      const eC = getColIndex(rangeSelection.endColId);
      startColIdx = Math.min(sC, eC);
    } else {
      if (focusedCell) {
        startRowIdx = focusedCell.rowIndex;
        startColIdx = getColIndex(focusedCell.column.colId);
      }
    }
    if (startRowIdx === -1 || startColIdx === -1) return;

    // 辅助函数：应用更新并记录
    const applyAndRecord = (rowNode, col, rawValue) => {
      const field = col.getColDef().field
      let currentVal = field.split('.').reduce((obj, key) => obj?.[key], rowNode.data)
      const cleanValue = sanitizeValue(field, rawValue)
      
      if (String(currentVal) !== String(cleanValue)) {
         rowNode.setDataValue(field, cleanValue)
         transaction.changes.push({
           rowId: rowNode.data.id,
           colId: field,
           oldValue: currentVal,
           newValue: cleanValue
         })
         pushPendingChange({
           rowNode: rowNode,
           colDef: col.getColDef(),
           newValue: cleanValue,
           oldValue: currentVal
         })
      }
    }

    const isSingleValue = pasteRowCount === 1 && pasteColCount === 1;
    const realRangeRowCount = rangeSelection.active ? Math.abs(rangeSelection.endRowIndex - rangeSelection.startRowIndex) + 1 : 0
    const realRangeColCount = rangeSelection.active ? Math.abs(getColIndex(rangeSelection.endColId) - getColIndex(rangeSelection.startColId)) + 1 : 0
    const isMultiCellSelection = realRangeRowCount > 1 || realRangeColCount > 1;

    // 场景1：单值填充多选区域
    if (isSingleValue && isMultiCellSelection && rangeSelection.active) {
      const valToPaste = pasteMatrix[0][0].trim();
      const endRowIdx = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex);
      const sC = getColIndex(rangeSelection.startColId);
      const eC = getColIndex(rangeSelection.endColId);
      const endColIdx = Math.max(sC, eC);
      
      for (let r = startRowIdx; r <= endRowIdx; r++) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(r);
        for (let c = startColIdx; c <= endColIdx; c++) {
          const col = allCols[c];
          if (col && col.isCellEditable(rowNode)) {
            applyAndRecord(rowNode, col, valToPaste)
          }
        }
      }
    } 
    // 场景2：多对多粘贴
    else {
      for (let i = 0; i < pasteRowCount; i++) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(startRowIdx + i);
        if (!rowNode) break; 
        for (let j = 0; j < pasteColCount; j++) {
          const colIndex = startColIdx + j;
          if (colIndex < allCols.length) {
            const col = allCols[colIndex];
            const cellValue = pasteMatrix[i][j].trim();
            if (col && col.isCellEditable(rowNode)) {
               applyAndRecord(rowNode, col, cellValue)
            }
          }
        }
      }
    }

    if (transaction.changes.length > 0) {
      history.undoStack.push(transaction)
      history.redoStack = []
      ElMessage.success(`已粘贴 ${transaction.changes.length} 个单元格`)
      debouncedSave()
    }
    
    setTimeout(() => { isSystemOperation.value = false }, 100)
    event.preventDefault()
  }

  const onCellKeyDown = async (e) => {
    const event = e.event
    const key = event.key.toLowerCase();
    const isCtrl = event.ctrlKey || event.metaKey;
    
    if (!gridApi.value) return
    
    if (isCtrl && key === 'z' && !event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); 
      performUndoRedo('undo')
      return
    }

    if (isCtrl && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault(); event.stopPropagation(); 
      performUndoRedo('redo')
      return
    }

    // 批量删除
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (rangeSelection.active) {
        isSystemOperation.value = true
        const transaction = { type: 'batch', changes: [] }
        const startIdx = getColIndex(rangeSelection.startColId)
        const endIdx = getColIndex(rangeSelection.endColId)
        const minRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
        const maxRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
        const minCol = Math.min(startIdx, endIdx)
        const maxCol = Math.max(startIdx, endIdx)
        const allCols = gridApi.value.getAllGridColumns()

        for (let r = minRow; r <= maxRow; r++) {
          const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
          if (rowNode) {
            for (let c = minCol; c <= maxCol; c++) {
              const col = allCols[c]
              if (col.isCellEditable(rowNode)) {
                const field = col.getColDef().field
                let currentVal = field.split('.').reduce((obj, key) => obj?.[key], rowNode.data)
                if (currentVal !== null && currentVal !== '') {
                  rowNode.setDataValue(field, null)
                  transaction.changes.push({ rowId: rowNode.data.id, colId: field, oldValue: currentVal, newValue: null })
                  pushPendingChange({ rowNode: rowNode, colDef: col.getColDef(), newValue: null, oldValue: currentVal })
                }
              }
            }
          }
        }
        
        if (transaction.changes.length > 0) {
          history.undoStack.push(transaction); history.redoStack = []; debouncedSave()
        }
        setTimeout(() => { isSystemOperation.value = false }, 100)

      } else {
        const focusedCell = gridApi.value.getFocusedCell()
        if (focusedCell) {
          const rowNode = gridApi.value.getDisplayedRowAtIndex(focusedCell.rowIndex)
          const col = gridApi.value.getColumn(focusedCell.column.colId)
          if (col.isCellEditable(rowNode)) {
            rowNode.setDataValue(col.getColDef().field, null)
          }
        }
      }
      return
    }

    // 复制 (Ctrl+C)
    if (isCtrl && key === 'c') {
      const focusedCell = gridApi.value.getFocusedCell()
      const isRangeActive = rangeSelection.active
      if (!isRangeActive && !focusedCell) return

      let startRow, endRow, startCol, endCol
      if (isRangeActive) {
        startRow = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
        endRow = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
        const idx1 = getColIndex(rangeSelection.startColId); const idx2 = getColIndex(rangeSelection.endColId)
        startCol = Math.min(idx1, idx2); endCol = Math.max(idx1, idx2)
      } else {
        startRow = endRow = focusedCell.rowIndex
        startCol = endCol = getColIndex(focusedCell.column.colId)
      }

      const allCols = gridApi.value.getAllGridColumns()
      let clipboardText = ''

      for (let r = startRow; r <= endRow; r++) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
        if (!rowNode) continue
        let rowCells = []
        for (let c = startCol; c <= endCol; c++) {
          const col = allCols[c]
          if (!col) continue
          const field = col.getColDef().field
          let val = null
          if (field) val = field.split('.').reduce((obj, key) => obj?.[key], rowNode.data)
          const strVal = (val === null || val === undefined) ? '' : String(val)
          rowCells.push(strVal)
        }
        clipboardText += rowCells.join('\t') + (r === endRow ? '' : '\n')
      }

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(clipboardText)
        } else {
          const textArea = document.createElement("textarea")
          textArea.value = clipboardText
          textArea.style.position = "fixed"; textArea.style.left = "-9999px";
          document.body.appendChild(textArea)
          textArea.focus(); textArea.select();
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        ElMessage.success(`已复制 ${Math.abs(endRow - startRow) + 1} 行`)
      } catch(e) { ElMessage.error('复制失败') }
      
      event.preventDefault()
      return
    }
  }

  return { handleGlobalPaste, onCellKeyDown }
}
