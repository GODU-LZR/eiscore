// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const addCount = (target, key) => {
  const text = key === null || key === undefined || key === '' ? '未设置' : String(key)
  target[text] = (target[text] || 0) + 1
}

export const toSalesAmount = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export const getSalesDateTime = (value) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export const isSalesOrderActive = (row) => row?.order_status !== '已取消' && row?.status !== 'deleted'

export const isSalesRowActive = (row) => row?.status !== 'deleted'

export const getSalesCustomerKey = (row) => {
  if (!row) return ''
  return row.customer_id || row.id || row.customer_name || row.name || ''
}

export const calculateSalesCustomerReceivable = (customer, rows) => {
  const customerId = customer?.id || ''
  const customerName = customer?.name || ''
  const orderAmount = rows.orders
    .filter((row) => isSalesOrderActive(row))
    .filter((row) => (customerId && row.customer_id === customerId) || (!row.customer_id && row.customer_name === customerName) || row.customer_name === customerName)
    .reduce((sum, row) => sum + toSalesAmount(row.total_amount), 0)
  const paymentAmount = rows.payments
    .filter((row) => row?.status !== 'deleted')
    .filter((row) => (customerId && row.customer_id === customerId) || (!row.customer_id && row.customer_name === customerName) || row.customer_name === customerName)
    .reduce((sum, row) => sum + toSalesAmount(row.amount), 0)
  return Math.max(orderAmount - paymentAmount, 0)
}

export const buildSalesDataStats = (appKey, rows, { now = new Date() } = {}) => {
  const stats = { totalCount: 0, sampleSize: 0, statusCounts: {}, ownerCounts: {}, regionCounts: {} }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  stats.sampleSize = rows.length

  if (appKey === 'customers') {
    stats.levelCounts = {}
    stats.totalCreditLimit = 0
    stats.totalReceivableBalance = 0
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.customer_status || row?.status)
      addCount(stats.levelCounts, row?.level)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      addCount(stats.regionCounts, row?.region || row?.properties?.region)
      stats.totalCreditLimit += toSalesAmount(row?.credit_limit)
      stats.totalReceivableBalance += toSalesAmount(row?.receivable_balance)
    })
    return stats
  }

  if (appKey === 'orders') {
    stats.totalQuantity = 0
    stats.totalAmount = 0
    stats.deliveryRiskCounts = {}
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.order_status || row?.status)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      addCount(stats.deliveryRiskCounts, row?.properties?.delivery_risk || row?.properties?.交付风险)
      stats.totalQuantity += toSalesAmount(row?.quantity)
      stats.totalAmount += toSalesAmount(row?.total_amount)
    })
    return stats
  }

  if (appKey === 'payments') {
    stats.totalAmount = 0
    stats.methodCounts = {}
    stats.handlerCounts = {}
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.verify_status || row?.status)
      addCount(stats.methodCounts, row?.payment_method)
      addCount(stats.handlerCounts, row?.handler_name || row?.properties?.handler_name)
      stats.totalAmount += toSalesAmount(row?.amount)
    })
    return stats
  }

  if (appKey === 'opportunities') {
    stats.totalExpectedAmount = 0
    stats.totalWeightedAmount = 0
    stats.stageCounts = {}
    stats.overdueOpportunityCount = 0
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.stage || row?.status)
      addCount(stats.stageCounts, row?.stage)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      const expectedAmount = toSalesAmount(row?.expected_amount)
      stats.totalExpectedAmount += expectedAmount
      stats.totalWeightedAmount += expectedAmount * toSalesAmount(row?.probability) / 100
      if (row?.expected_close_date && !['赢单', '输单', '搁置'].includes(row.stage) && getSalesDateTime(row.expected_close_date) < today.getTime()) {
        stats.overdueOpportunityCount += 1
      }
    })
    return stats
  }

  if (appKey === 'follow_ups') {
    stats.resultCounts = {}
    stats.typeCounts = {}
    stats.overdueFollowCount = 0
    stats.upcomingFollowCount = 0
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const upcomingLimit = today.getTime() + 3 * 24 * 60 * 60 * 1000
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.follow_result || row?.status)
      addCount(stats.resultCounts, row?.follow_result)
      addCount(stats.typeCounts, row?.follow_type)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      const nextTime = getSalesDateTime(row?.next_follow_at)
      if (nextTime && nextTime < today.getTime() && !['已成交', '无效'].includes(row?.follow_result)) {
        stats.overdueFollowCount += 1
      } else if (nextTime && nextTime <= upcomingLimit && !['已成交', '无效'].includes(row?.follow_result)) {
        stats.upcomingFollowCount += 1
      }
    })
    return stats
  }

  rows.forEach((row) => {
    addCount(stats.statusCounts, row?.properties?.status || row?.status)
    addCount(stats.ownerCounts, row?.owner_name || row?.handler_name || row?.properties?.owner_name)
    addCount(stats.regionCounts, row?.region || row?.properties?.region)
  })
  return stats
}

export const buildSalesDataSample = (rows, columns, limit = 50) => {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, limit).map((row) => {
    const item = {}
    columns.forEach((col) => {
      const prop = col.prop
      if (!prop || col.type === 'file' || col.type === 'geo') return
      const value = row?.[prop] ?? row?.properties?.[prop]
      if (value !== undefined && value !== null && value !== '') item[prop] = value
    })
    if (row?.id !== undefined) item.id = row.id
    return item
  })
}
