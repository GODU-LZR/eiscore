// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const DEFAULT_CLIENT_SUMMARY_ROW_LIMIT = 5000
export const DEFAULT_CLIENT_ROW_FORMULA_LIMIT = 5000

const toSafeInteger = (value, fallback) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.floor(num)
}

export function getClientSummaryRowLimit(props = {}) {
  return toSafeInteger(props.clientSummaryRowLimit, DEFAULT_CLIENT_SUMMARY_ROW_LIMIT)
}

export function getClientRowFormulaLimit(props = {}) {
  return toSafeInteger(props.clientRowFormulaLimit, DEFAULT_CLIENT_ROW_FORMULA_LIMIT)
}

export function isServerCalculationScope(props = {}) {
  return props.summaryScope !== 'loaded'
}

export function canUseServerSummary(props = {}) {
  return isServerCalculationScope(props) && !!props.apiUrl && !!props.viewId
}

export function shouldCalculateLoadedSummary(props = {}, rowCount = 0) {
  const count = toSafeInteger(rowCount, 0)
  return count <= getClientSummaryRowLimit(props)
}

export function shouldRecalculateLoadedRowFormulas(props = {}, rowCount = 0) {
  const count = toSafeInteger(rowCount, 0)
  return count <= getClientRowFormulaLimit(props)
}

export function buildGridCalculationState({
  props = {},
  rowCount = 0,
  serverSummaryState = {},
  formulaRecalculateState = {},
  canRecalculateFormulas = false
} = {}) {
  const count = toSafeInteger(rowCount, 0)
  const serverScope = canUseServerSummary(props)
  const localSummaryAllowed = shouldCalculateLoadedSummary(props, count)
  const localFormulaAllowed = shouldRecalculateLoadedRowFormulas(props, count)
  const serverSummaryReady = serverSummaryState.available === true
  const serverSummaryLoading = serverSummaryState.loading === true
  const formulaRecalculating = formulaRecalculateState.loading === true

  let label = '已加载行计算'
  let type = 'info'
  let detail = `当前前端仅计算已加载的 ${count} 行。`
  let scope = 'loaded'

  if (serverScope) {
    scope = 'server'
    if (serverSummaryLoading) {
      label = '全量汇总计算中'
      type = 'warning'
      detail = '正在使用服务端 RPC 按当前视图和搜索条件进行全量汇总。'
    } else if (serverSummaryReady) {
      label = '服务端全量汇总'
      type = 'success'
      detail = '底部合计来自服务端全量汇总，不受前端已加载行数限制。'
    } else if (!localSummaryAllowed) {
      label = '大数据服务端模式'
      type = 'warning'
      detail = `已加载 ${count} 行，超过前端合计阈值 ${getClientSummaryRowLimit(props)} 行；等待服务端汇总或检查 RPC。`
    } else {
      label = '服务端优先'
      type = serverSummaryState.error ? 'danger' : 'info'
      detail = serverSummaryState.error
        ? `服务端汇总暂不可用，当前仅显示已加载行计算：${serverSummaryState.error}`
        : '优先使用服务端全量汇总，服务端不可用时仅回退到已加载行。'
    }
  } else if (!localSummaryAllowed) {
    label = '已停止前端合计'
    type = 'warning'
    detail = `已加载 ${count} 行，超过前端合计阈值 ${getClientSummaryRowLimit(props)} 行；请使用服务端汇总或缩小筛选范围。`
  }

  if (formulaRecalculating) {
    label = `重算公式：${formulaRecalculateState.current || '处理中'}`
    type = 'warning'
    detail = `已扫描 ${formulaRecalculateState.scanned || 0} 行，已更新 ${formulaRecalculateState.updated || 0} 行。`
  }

  return {
    label,
    type,
    detail,
    scope,
    rowCount: count,
    serverSummary: serverScope,
    serverSummaryReady,
    serverSummaryLoading,
    localSummaryAllowed,
    localFormulaAllowed,
    canRecalculateFormulas: !!canRecalculateFormulas
  }
}
