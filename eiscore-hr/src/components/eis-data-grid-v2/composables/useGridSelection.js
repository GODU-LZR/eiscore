import { reactive, ref } from 'vue'

export function useGridSelection(gridApi, selectedRowsCount) {
  const rangeSelection = reactive({ startRowIndex: -1, startColId: null, endRowIndex: -1, endColId: null, active: false })
  const isDragging = ref(false)
  const mouseX = ref(0)
  const mouseY = ref(0)
  let autoScrollRaf = null

  const getColIndex = (colId) => gridApi.value ? gridApi.value.getAllGridColumns().findIndex(c => c.getColId() === colId) : -1

  const onGlobalMouseMove = (e) => { mouseX.value = e.clientX; mouseY.value = e.clientY }

  const autoScroll = () => {
    if (!isDragging.value || !gridApi.value) return
    const viewport = document.querySelector('.ag-body-viewport'); if (!viewport) return
    const rect = viewport.getBoundingClientRect(); const buffer = 50; const speed = 15
    let scrollX = 0; let scrollY = 0
    if (mouseY.value < rect.top + buffer) scrollY = -speed; else if (mouseY.value > rect.bottom - buffer) scrollY = speed
    if (mouseX.value < rect.left + buffer) scrollX = -speed; else if (mouseX.value > rect.right - buffer) scrollX = speed
    if (scrollY !== 0) viewport.scrollTop += scrollY
    if (scrollX !== 0) {
        const hViewport = document.querySelector('.ag-body-horizontal-scroll-viewport')
        if (hViewport) hViewport.scrollLeft += scrollX; else viewport.scrollLeft += scrollX
    }
    if (scrollX !== 0 || scrollY !== 0) {
        const target = document.elementFromPoint(mouseX.value, mouseY.value)
        if (target) {
            const cell = target.closest('.ag-cell')
            if (cell) {
                const rowId = cell.getAttribute('row-id'); const colId = cell.getAttribute('col-id')
                if (rowId && colId) {
                    const rowNode = gridApi.value.getRowNode(rowId)
                    if (rowNode) {
                        rangeSelection.endRowIndex = rowNode.rowIndex; rangeSelection.endColId = colId
                        gridApi.value.refreshCells({ force: false })
                    }
                }
            }
        }
    }
    autoScrollRaf = requestAnimationFrame(autoScroll)
  }

  const onCellMouseDown = (params) => {
    if (params.event.button === 2) return 
    if (params.colDef.field === '_status') {
        const editingCells = gridApi.value.getEditingCells()
        if (editingCells.length > 0) { gridApi.value.stopEditing(); return }
    }
    isDragging.value = true; autoScroll()
    rangeSelection.startRowIndex = params.node.rowIndex; rangeSelection.startColId = params.column.colId
    rangeSelection.endRowIndex = params.node.rowIndex; rangeSelection.endColId = params.column.colId
    rangeSelection.active = true
    gridApi.value.refreshCells({ force: false })
  }

  const onCellMouseOver = (params) => {
    if (!isDragging.value) return
    rangeSelection.endRowIndex = params.node.rowIndex; rangeSelection.endColId = params.column.colId
    gridApi.value.refreshCells({ force: false }) 
    gridApi.value.ensureIndexVisible(params.node.rowIndex)
    gridApi.value.ensureColumnVisible(params.column)
  }

  const onGlobalMouseUp = () => {
    if (isDragging.value) { isDragging.value = false; if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf) }
  }

  const onSelectionChanged = () => {
    const selectedNodes = gridApi.value.getSelectedNodes()
    selectedRowsCount.value = selectedNodes.length
  }

  return {
    rangeSelection, isDragging, onCellMouseDown, onCellMouseOver, onSelectionChanged,
    onGlobalMouseMove, onGlobalMouseUp, getColIndex
  }
}
