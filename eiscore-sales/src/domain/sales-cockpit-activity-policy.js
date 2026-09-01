// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  formatSalesCockpitCurrency,
  formatSalesCockpitEventTime,
  normalizeSalesCockpitRows,
  parseSalesCockpitDateTime
} from './sales-cockpit-presentation-policy.js'

export const buildSalesActivityEvents = ({ orders = [], payments = [], followUps = [] } = {}) => {
  const orderEvents = normalizeSalesCockpitRows(orders).map((row) => ({
    key: 'order-' + (row.id || row.order_no),
    appKey: 'orders',
    type: '订单',
    tone: 'order',
    date: row.order_date,
    time: formatSalesCockpitEventTime(row.order_date),
    title: row.customer_name || row.order_no,
    amount: formatSalesCockpitCurrency(row.total_amount)
  }))
  const paymentEvents = normalizeSalesCockpitRows(payments).map((row) => ({
    key: 'payment-' + (row.id || row.payment_no),
    appKey: 'payments',
    type: '回款',
    tone: 'payment',
    date: row.payment_date,
    time: formatSalesCockpitEventTime(row.payment_date),
    title: row.customer_name || row.payment_no,
    amount: formatSalesCockpitCurrency(row.amount)
  }))
  const followUpEvents = normalizeSalesCockpitRows(followUps).map((row) => ({
    key: 'follow-' + (row.id || row.follow_no),
    appKey: 'follow_ups',
    type: '跟进',
    tone: 'follow',
    date: row.follow_date,
    time: formatSalesCockpitEventTime(row.follow_date),
    title: row.customer_name || row.follow_no,
    amount: row.follow_result || '-'
  }))
  return [...orderEvents, ...paymentEvents, ...followUpEvents]
    .sort((a, b) => parseSalesCockpitDateTime(b.date) - parseSalesCockpitDateTime(a.date))
    .slice(0, 12)
}
