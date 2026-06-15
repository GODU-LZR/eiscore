// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, reactive } from 'vue'

const ROW_HEIGHT_EDGE_HIT_SIZE = 10

export function createGridLocalLayout({ props, gridApi, defaultRowHeight }) {
  const layoutStorageKey = computed(() => props.localLayoutKey ? `eis-grid-layout:${props.localLayoutKey}` : '')
  const localLayoutState = reactive({ columns: {}, rows: {} })
  const rowHeightConfig = computed(() => ({
    enabled: props.enableRowHeightResize === true && !!props.localLayoutKey,
    min: Math.max(28, Math.min(120, Number(props.minRowHeight) || 32)),
    max: Math.max(48, Math.min(260, Number(props.maxRowHeight) || 160))
  }))
  let rowResizeState = null
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

  const getLayoutRowKey = (rowData) => {
    if (!rowData) return ''
    if (rowData.id !== undefined && rowData.id !== null) return String(rowData.id)
    if (rowData.doc_no) return String(rowData.doc_no)
    if (rowData.order_no) return String(rowData.order_no)
    if (rowData.work_order_no) return String(rowData.work_order_no)
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

  const stopRowHeightResize = () => {
    if (!rowResizeState) return
    document.removeEventListener('mousemove', handleRowHeightResizeMove)
    document.removeEventListener('mouseup', handleRowHeightResizeEnd)
    document.body.classList.remove('is-resizing-grid-row')
    rowResizeState = null
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

  const getStoredColumnWidth = (colId, fallback) => {
    const storedWidth = Number(localLayoutState.columns?.[colId])
    return Number.isFinite(storedWidth) && storedWidth >= 40 ? storedWidth : fallback
  }

  const applyStoredColumnWidths = () => {
    if (!gridApi.value || !props.localLayoutKey) return
    const state = Object.entries(localLayoutState.columns || {})
      .map(([colId, width]) => ({ colId, width: Number(width) }))
      .filter(item => item.colId && Number.isFinite(item.width) && item.width >= 40)
    if (!state.length) return
    try {
      gridApi.value.applyColumnState?.({ state, applyOrder: false })
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
    if (!props.localLayoutKey || event?.finished !== true || typeof window === 'undefined') return
    if (saveColumnLayoutTimer) window.clearTimeout(saveColumnLayoutTimer)
    saveColumnLayoutTimer = window.setTimeout(() => {
      saveColumnLayoutTimer = null
      saveColumnLayout()
    }, 120)
  }

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
    setTimeout(() => {
      applyStoredColumnWidths()
      gridApi.value?.resetRowHeights?.()
    }, 0)
  }

  safeReadLocalLayout()

  return {
    rowHeightConfig,
    getStoredColumnWidth,
    getRowHeight,
    handleColumnResized,
    onGridReadyLayout,
    stopRowHeightResize,
    startRowHeightResize,
    resetRowHeight,
    isRowHeightEdgeResizeEvent
  }
}
