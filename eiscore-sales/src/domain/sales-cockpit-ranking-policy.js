// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { normalizeSalesCockpitRows, toSalesCockpitAmount } from './sales-cockpit-presentation-policy.js'

export const selectSalesReceivableCustomers = (customers = []) => (
  [...normalizeSalesCockpitRows(customers)]
    .filter((row) => toSalesCockpitAmount(row?.receivable_balance) > 0)
    .sort((a, b) => toSalesCockpitAmount(b.receivable_balance) - toSalesCockpitAmount(a.receivable_balance))
    .slice(0, 6)
)

export const calculateSalesReceivableRate = (customer, customers = []) => {
  const max = Math.max(...normalizeSalesCockpitRows(customers).map((row) => (
    toSalesCockpitAmount(row?.receivable_balance)
  )), 0)
  if (!max) return 0
  return Math.max(8, Math.round((toSalesCockpitAmount(customer?.receivable_balance) / max) * 100))
}

export const buildSalesOwnerPerformance = ({ orders = [], opportunities = [] } = {}) => {
  const owners = new Map()
  const ensure = (owner) => {
    const key = owner || '未设置'
    if (!owners.has(key)) {
      owners.set(key, { owner: key, orderCount: 0, orderAmount: 0, opportunityCount: 0, opportunityAmount: 0 })
    }
    return owners.get(key)
  }
  normalizeSalesCockpitRows(orders).forEach((row) => {
    const item = ensure(row.owner_name)
    item.orderCount += 1
    item.orderAmount += toSalesCockpitAmount(row.total_amount)
  })
  normalizeSalesCockpitRows(opportunities).forEach((row) => {
    const item = ensure(row.owner_name)
    item.opportunityCount += 1
    item.opportunityAmount += toSalesCockpitAmount(row.expected_amount)
  })
  return Array.from(owners.values())
    .sort((a, b) => (b.orderAmount + b.opportunityAmount * 0.4) - (a.orderAmount + a.opportunityAmount * 0.4))
    .slice(0, 6)
}

export const buildSalesOwnerRanking = (performance = []) => {
  const rows = normalizeSalesCockpitRows(performance)
  const max = Math.max(...rows.map((row) => toSalesCockpitAmount(row.orderAmount)), 0)
  return rows.map((row, index) => ({
    ...row,
    rank: String(index + 1).padStart(2, '0'),
    rate: max ? Math.max(8, Math.round((toSalesCockpitAmount(row.orderAmount) / max) * 100)) : 0
  }))
}
