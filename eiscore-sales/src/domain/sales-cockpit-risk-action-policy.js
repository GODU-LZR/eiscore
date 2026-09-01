// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  formatSalesCockpitCurrency,
  formatSalesCockpitDate,
  normalizeSalesCockpitRows,
  parseSalesCockpitDateTime
} from './sales-cockpit-presentation-policy.js'

const DAY_MS = 24 * 60 * 60 * 1000

const startOfSalesCockpitDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export const buildSalesRiskItems = ({
  referenceTime,
  orders = [],
  opportunities = [],
  receivableCustomers = []
} = {}) => {
  const today = startOfSalesCockpitDay(referenceTime)
  const riskLimit = today + 3 * DAY_MS
  const delivery = normalizeSalesCockpitRows(orders)
    .filter((row) => row?.delivery_date && !['已完成', '已取消'].includes(row.order_status) && parseSalesCockpitDateTime(row.delivery_date) <= riskLimit)
    .slice(0, 3)
    .map((row) => ({
      key: `delivery-${row.id}`,
      appKey: 'orders',
      label: '交付',
      type: 'danger',
      title: row.order_no || '未编号订单',
      desc: `${row.customer_name || '-'}，交付 ${formatSalesCockpitDate(row.delivery_date)}`
    }))
  const opportunity = normalizeSalesCockpitRows(opportunities)
    .filter((row) => row?.expected_close_date && !['赢单', '输单', '搁置'].includes(row.stage) && parseSalesCockpitDateTime(row.expected_close_date) <= riskLimit)
    .slice(0, 3)
    .map((row) => ({
      key: `opportunity-${row.id}`,
      appKey: 'opportunities',
      label: '商机',
      type: parseSalesCockpitDateTime(row.expected_close_date) < today ? 'danger' : 'warning',
      title: row.opportunity_name || row.opportunity_no,
      desc: `${row.stage || '-'}，预计成交 ${formatSalesCockpitDate(row.expected_close_date)}`
    }))
  const receivable = normalizeSalesCockpitRows(receivableCustomers).slice(0, 3).map((row) => ({
    key: `receivable-${row.id}`,
    appKey: 'customers',
    label: '应收',
    type: 'warning',
    title: row.name || row.customer_no,
    desc: `应收 ${formatSalesCockpitCurrency(row.receivable_balance)}，负责人 ${row.owner_name || '-'}`
  }))
  return [...delivery, ...opportunity, ...receivable].slice(0, 8)
}

export const buildSalesActionItems = ({ referenceTime, followUps = [], opportunities = [] } = {}) => {
  const weekLimit = startOfSalesCockpitDay(referenceTime) + 7 * DAY_MS
  const followActions = normalizeSalesCockpitRows(followUps)
    .filter((row) => row?.next_follow_at && !['已成交', '无效'].includes(row.follow_result) && parseSalesCockpitDateTime(row.next_follow_at) <= weekLimit)
    .slice(0, 4)
    .map((row) => ({
      key: `follow-${row.id}`,
      appKey: 'follow_ups',
      label: '跟进',
      title: row.customer_name || row.follow_no,
      desc: `${formatSalesCockpitDate(row.next_follow_at)} ${row.follow_type || ''}，${row.owner_name || '-'}`
    }))
  const opportunityActions = normalizeSalesCockpitRows(opportunities)
    .filter((row) => row?.next_action && !['赢单', '输单', '搁置'].includes(row.stage))
    .slice(0, 4)
    .map((row) => ({
      key: `opp-${row.id}`,
      appKey: 'opportunities',
      label: '商机',
      title: row.opportunity_name || row.opportunity_no,
      desc: `${row.stage || '-'}，${row.next_action}`
    }))
  return [...opportunityActions, ...followActions].slice(0, 8)
}
