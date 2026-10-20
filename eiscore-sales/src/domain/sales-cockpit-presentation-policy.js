// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const normalizeSalesCockpitRows = (value) => (Array.isArray(value) ? value : [])

export const toSalesCockpitAmount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export const sumSalesCockpitRowsBy = (rows, prop) => (
  rows.reduce((sum, row) => sum + toSalesCockpitAmount(row?.[prop]), 0)
)

export const parseSalesCockpitDateTime = (value) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export const formatSalesCockpitDate = (value) => (value ? String(value).slice(0, 10) : '-')

export const formatSalesCockpitRefreshTime = (value) => {
  if (!value) return '等待首次刷新'
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

export const formatSalesCockpitEventTime = (value) => {
  if (!value) return '--:--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--:--'
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const formatSalesCockpitAmount = (value) => {
  const amount = toSalesCockpitAmount(value)
  const abs = Math.abs(amount)
  if (abs >= 100000000) return `${(amount / 100000000).toFixed(abs >= 1000000000 ? 1 : 2)}亿`
  if (abs >= 10000) return `${(amount / 10000).toFixed(abs >= 1000000 ? 0 : 1)}万`
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export const formatSalesCockpitCurrency = (value) => `¥${formatSalesCockpitAmount(value)}`

export const clampSalesCockpitRate = (value) => (
  Math.max(0, Math.min(100, Math.round(toSalesCockpitAmount(value))))
)

export const shouldAutoScrollSalesCockpitRows = (rows, threshold = 4) => (
  Array.isArray(rows) && rows.length > threshold
)

export const formatSalesCockpitScrollDuration = (rows, secondsPerItem = 6) => (
  `${Math.max(normalizeSalesCockpitRows(rows).length * secondsPerItem, 18)}s`
)

export const selectActiveSalesCustomers = (rows) => (
  normalizeSalesCockpitRows(rows).filter((row) => row?.status !== 'deleted')
)

export const selectActiveSalesOrders = (rows) => (
  normalizeSalesCockpitRows(rows).filter((row) => row?.status !== 'deleted' && row?.order_status !== '已取消')
)

export const selectActiveSalesPayments = (rows) => (
  normalizeSalesCockpitRows(rows).filter((row) => row?.status !== 'deleted')
)

export const selectActiveSalesOpportunities = (rows) => (
  normalizeSalesCockpitRows(rows).filter((row) => row?.status !== 'deleted' && !['输单', '搁置'].includes(row?.stage))
)

export const selectActiveSalesFollowUps = (rows) => (
  normalizeSalesCockpitRows(rows).filter((row) => row?.status !== 'deleted')
)
