import { ElMessage } from 'element-plus'

export function useGridClipboard(gridApi, historyHooks, selectionHooks) {
  const { history, isSystemOperation, debouncedSave, performUndoRedo, sanitizeValue, pushPendingChange } = historyHooks
  const { rangeSelection, getColIndex } = selectionHooks

  const handleGlobalPaste = async (event) => {
    if (!gridApi.value) return
    const activeEl = document.activeElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) if (!activeEl.closest('.ag-root-wrapper')) return 
    const focusedCell = gridApi.value.getFocusedCell()
    if ((!focusedCell && !rangeSelection.active) || !event.clipboardData) return

    const text = event.clipboardData.getData('text'); if (!text) return
    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n'); if (rows[rows.length-1]==='') rows.pop()
    const pasteMatrix = rows.map(row => row.split('\t'))
    if (pasteMatrix.length === 0) return

    isSystemOperation.value = true
    const transaction = { type: 'batch', changes: [] }
    const allCols = gridApi.value.getAllGridColumns()

    let startRowIdx, startColIdx;
    if (rangeSelection.active) {
        startRowIdx = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
        startColIdx = Math.min(getColIndex(rangeSelection.startColId), getColIndex(rangeSelection.endColId))
    } else {
        startRowIdx = focusedCell.rowIndex
        startColIdx = getColIndex(focusedCell.column.colId)
    }

    const applyPaste = (rowNode, col, val) => {
        const field = col.getColDef().field
        const currentVal = field.split('.').reduce((o, k) => o?.[k], rowNode.data)
        const cleanVal = sanitizeValue(field, val)
        if (String(currentVal) !== String(cleanVal)) {
            rowNode.setDataValue(field, cleanVal)
            transaction.changes.push({ rowId: rowNode.data.id, colId: field, oldValue: currentVal, newValue: cleanVal })
            pushPendingChange({ rowNode, colDef: col.getColDef(), newValue: cleanVal, oldValue: currentVal })
        }
    }

    const isSingle = pasteMatrix.length === 1 && pasteMatrix[0].length === 1
    const isRange = rangeSelection.active && (Math.abs(rangeSelection.endRowIndex - rangeSelection.startRowIndex) > 0 || Math.abs(getColIndex(rangeSelection.endColId) - getColIndex(rangeSelection.startColId)) > 0)

    if (isSingle && isRange) {
        const val = pasteMatrix[0][0].trim(); const endR = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex); const endC = Math.max(getColIndex(rangeSelection.startColId), getColIndex(rangeSelection.endColId))
        for (let r=startRowIdx; r<=endR; r++) {
            const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
            for (let c=startColIdx; c<=endC; c++) {
                const col = allCols[c]
                if (col && col.isCellEditable(rowNode)) applyPaste(rowNode, col, val)
            }
        }
    } else {
        for (let i=0; i<pasteMatrix.length; i++) {
            const rowNode = gridApi.value.getDisplayedRowAtIndex(startRowIdx + i); if (!rowNode) break
            for (let j=0; j<pasteMatrix[0].length; j++) {
                const col = allCols[startColIdx + j]
                if (col && col.isCellEditable(rowNode)) applyPaste(rowNode, col, pasteMatrix[i][j].trim())
            }
        }
    }

    if (transaction.changes.length > 0) {
        history.undoStack.push(transaction); history.redoStack = []
        ElMessage.success(`已粘贴 ${transaction.changes.length} 个单元格`)
        debouncedSave()
    }
    setTimeout(() => isSystemOperation.value = false, 50)
    event.preventDefault()
  }

  const onCellKeyDown = (e) => {
    if (!gridApi.value) return
    const evt = e.event; const key = evt.key.toLowerCase(); const ctrl = evt.ctrlKey || evt.metaKey
    
    // Undo/Redo (Uses passed performUndoRedo)
    if (ctrl && key === 'z' && !evt.shiftKey) { evt.preventDefault(); performUndoRedo('undo'); return }
    if (ctrl && (key === 'y' || (key === 'z' && evt.shiftKey))) { evt.preventDefault(); performUndoRedo('redo'); return }
    
    // Batch Delete
    if (key === 'delete' || key === 'backspace') {
        if (rangeSelection.active) {
            isSystemOperation.value = true
            const transaction = { type: 'batch', changes: [] }
            const r1 = Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex); const r2 = Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
            const c1 = Math.min(getColIndex(rangeSelection.startColId), getColIndex(rangeSelection.endColId)); const c2 = Math.max(getColIndex(rangeSelection.startColId), getColIndex(rangeSelection.endColId))
            const allCols = gridApi.value.getAllGridColumns()
            
            for(let r=r1; r<=r2; r++) {
                const rowNode = gridApi.value.getDisplayedRowAtIndex(r)
                for(let c=c1; c<=c2; c++) {
                    const col = allCols[c]
                    if (col.isCellEditable(rowNode)) {
                        const field = col.getColDef().field
                        const val = field.split('.').reduce((o,k)=>o?.[k], rowNode.data)
                        if (val !== null && val !== '') {
                            rowNode.setDataValue(field, null)
                            transaction.changes.push({ rowId: rowNode.data.id, colId: field, oldValue: val, newValue: null })
                            pushPendingChange({ rowNode, colDef: col.getColDef(), newValue: null, oldValue: val })
                        }
                    }
                }
            }
            if (transaction.changes.length) { history.undoStack.push(transaction); history.redoStack=[]; debouncedSave() }
            setTimeout(() => isSystemOperation.value = false, 50)
        } else {
            const cell = gridApi.value.getFocusedCell()
            if(cell) {
                const row = gridApi.value.getDisplayedRowAtIndex(cell.rowIndex); const col = gridApi.value.getColumn(cell.column.colId)
                if(col.isCellEditable(row)) row.setDataValue(col.getColDef().field, null)
            }
        }
    }

    // Copy
    if (ctrl && key === 'c') {
        let r1, r2, c1, c2
        if (rangeSelection.active) {
            r1=Math.min(rangeSelection.startRowIndex, rangeSelection.endRowIndex); r2=Math.max(rangeSelection.startRowIndex, rangeSelection.endRowIndex)
            c1=Math.min(getColIndex(rangeSelection.startColId), getColIndex(rangeSelection.endColId)); c2=Math.max(getColIndex(rangeSelection.startColId), getColIndex(rangeSelection.endColId))
        } else {
            const c = gridApi.value.getFocusedCell(); if(!c) return
            r1=r2=c.rowIndex; c1=c2=getColIndex(c.column.colId)
        }
        const allCols = gridApi.value.getAllGridColumns()
        let txt = ''
        for(let r=r1; r<=r2; r++) {
            const row = gridApi.value.getDisplayedRowAtIndex(r); if(!row) continue
            const cells = []
            for(let c=c1; c<=c2; c++) {
                const col = allCols[c]; if(!col) continue
                const field = col.getColDef().field
                const val = field ? field.split('.').reduce((o,k)=>o?.[k], row.data) : ''
                cells.push(val===null||val===undefined ? '' : String(val))
            }
            txt += cells.join('\t') + (r===r2 ? '' : '\n')
        }
        navigator.clipboard.writeText(txt).then(() => ElMessage.success(`已复制 ${Math.abs(r2-r1)+1} 行`)).catch(()=>ElMessage.error('复制失败'))
        evt.preventDefault()
    }
  }

  return { handleGlobalPaste, onCellKeyDown }
}