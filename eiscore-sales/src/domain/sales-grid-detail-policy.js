// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { isSalesOrderActive, toSalesAmount } from './sales-grid-data-policy.js'

export const getSalesRowValue = (row, prop) => {
  if (!row || !prop) return undefined
  return row[prop] ?? row.properties?.[prop]
}

export const formatSalesDetailValue = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  if (Array.isArray(value)) return value.map(formatSalesDetailValue).join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const formatSalesAmount = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return formatSalesDetailValue(value)
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const getSalesRowDisplayName = (row) => {
  if (!row) return '未选择记录'
  return row.name || row.opportunity_name || row.customer_name || row.order_no || row.payment_no || row.follow_no || row.opportunity_no || row.customer_no || row.id || '未命名记录'
}

export const buildSalesDetailItems = ({ row, columns = [] } = {}) => {
  if (!row) return []
  return columns
    .filter((col) => col.type !== 'file' && col.type !== 'geo')
    .map((col) => ({
      label: col.label,
      prop: col.prop,
      value: formatSalesDetailValue(getSalesRowValue(row, col.prop))
    }))
}

export const buildSalesDetailPropertyItems = ({ row, columns = [] } = {}) => {
  const properties = row?.properties && typeof row.properties === 'object' ? row.properties : {}
  const visibleProps = new Set(columns.map((col) => col.prop))
  return Object.entries(properties)
    .filter(([key]) => !visibleProps.has(key))
    .map(([key, value]) => ({ key, value: formatSalesDetailValue(value) }))
}

const mapOrderRelation = (row) => ({
  order_no: formatSalesDetailValue(row?.order_no),
  customer_name: formatSalesDetailValue(row?.customer_name),
  product_name: formatSalesDetailValue(row?.product_name),
  total_amount: formatSalesAmount(row?.total_amount),
  order_status: formatSalesDetailValue(row?.order_status)
})

const mapPaymentRelation = (row) => ({
  payment_no: formatSalesDetailValue(row?.payment_no),
  order_no: formatSalesDetailValue(row?.order_no),
  amount: formatSalesAmount(row?.amount),
  verify_status: formatSalesDetailValue(row?.verify_status)
})

const mapFollowRelation = (row) => ({
  follow_no: formatSalesDetailValue(row?.follow_no),
  follow_date: formatSalesDetailValue(row?.follow_date),
  follow_type: formatSalesDetailValue(row?.follow_type),
  follow_result: formatSalesDetailValue(row?.follow_result),
  next_follow_at: formatSalesDetailValue(row?.next_follow_at)
})

const mapOpportunityRelation = (row) => ({
  opportunity_no: formatSalesDetailValue(row?.opportunity_no),
  opportunity_name: formatSalesDetailValue(row?.opportunity_name),
  expected_amount: formatSalesAmount(row?.expected_amount),
  stage: formatSalesDetailValue(row?.stage),
  probability: `${formatSalesDetailValue(row?.probability)}%`
})

const mapCustomerRelation = (row) => ({
  customer_no: formatSalesDetailValue(row?.customer_no),
  name: formatSalesDetailValue(row?.name),
  level: formatSalesDetailValue(row?.level),
  receivable_balance: formatSalesAmount(row?.receivable_balance)
})

export const buildSalesDetailRelationSections = (relations = {}) => {
  const source = relations || {}
  const sections = []
  if (Array.isArray(source.orders)) {
    sections.push({
      key: 'orders',
      title: '相关订单',
      rows: source.orders.map(mapOrderRelation),
      columns: [
        { label: '订单号', prop: 'order_no' },
        { label: '产品', prop: 'product_name' },
        { label: '金额', prop: 'total_amount' },
        { label: '状态', prop: 'order_status' }
      ]
    })
  }
  if (Array.isArray(source.payments)) {
    sections.push({
      key: 'payments',
      title: '相关回款',
      rows: source.payments.map(mapPaymentRelation),
      columns: [
        { label: '回款单号', prop: 'payment_no' },
        { label: '订单号', prop: 'order_no' },
        { label: '金额', prop: 'amount' },
        { label: '核销状态', prop: 'verify_status' }
      ]
    })
  }
  if (Array.isArray(source.followUps)) {
    sections.push({
      key: 'followUps',
      title: '跟进记录',
      rows: source.followUps.map(mapFollowRelation),
      columns: [
        { label: '跟进编号', prop: 'follow_no' },
        { label: '日期', prop: 'follow_date' },
        { label: '方式', prop: 'follow_type' },
        { label: '结果', prop: 'follow_result' },
        { label: '下次跟进', prop: 'next_follow_at' }
      ]
    })
  }
  if (Array.isArray(source.opportunities)) {
    sections.push({
      key: 'opportunities',
      title: '相关商机',
      rows: source.opportunities.map(mapOpportunityRelation),
      columns: [
        { label: '商机编号', prop: 'opportunity_no' },
        { label: '商机名称', prop: 'opportunity_name' },
        { label: '预计金额', prop: 'expected_amount' },
        { label: '阶段', prop: 'stage' }
      ]
    })
  }
  if (source.order) {
    sections.push({
      key: 'order',
      title: '对应订单',
      rows: [mapOrderRelation(source.order)],
      columns: [
        { label: '订单号', prop: 'order_no' },
        { label: '客户', prop: 'customer_name' },
        { label: '产品', prop: 'product_name' },
        { label: '金额', prop: 'total_amount' }
      ]
    })
  }
  if (source.customer) {
    sections.push({
      key: 'customer',
      title: '对应客户',
      rows: [mapCustomerRelation(source.customer)],
      columns: [
        { label: '客户编码', prop: 'customer_no' },
        { label: '客户名称', prop: 'name' },
        { label: '等级', prop: 'level' },
        { label: '应收余额', prop: 'receivable_balance' }
      ]
    })
  }
  if (source.opportunity) {
    sections.push({
      key: 'opportunity',
      title: '对应商机',
      rows: [mapOpportunityRelation(source.opportunity)],
      columns: [
        { label: '商机编号', prop: 'opportunity_no' },
        { label: '商机名称', prop: 'opportunity_name' },
        { label: '预计金额', prop: 'expected_amount' },
        { label: '阶段', prop: 'stage' }
      ]
    })
  }
  return sections.filter((section) => section.rows.length > 0)
}

export const buildSalesDetailBusinessMetrics = ({ appKey, row, relations = {} } = {}) => {
  if (!row) return []
  const source = relations || {}
  const relationOrders = Array.isArray(source.orders)
    ? source.orders
    : (source.order ? [source.order] : [])
  const relationPayments = Array.isArray(source.payments) ? source.payments : []
  const orderAmount = relationOrders
    .filter(isSalesOrderActive)
    .reduce((sum, item) => sum + toSalesAmount(item.total_amount), 0)
  const paymentAmount = relationPayments
    .filter((item) => item?.status !== 'deleted')
    .reduce((sum, item) => sum + toSalesAmount(item.amount), 0)
  const receivable = Math.max(orderAmount - paymentAmount, toSalesAmount(row.receivable_balance))
  const paymentRate = orderAmount ? Math.round((paymentAmount / orderAmount) * 1000) / 10 : 0

  if (appKey === 'customers') {
    return [
      { key: 'orderAmount', label: '累计订单', value: formatSalesAmount(orderAmount) },
      { key: 'paymentAmount', label: '累计回款', value: formatSalesAmount(paymentAmount) },
      { key: 'receivable', label: '应收余额', value: formatSalesAmount(receivable) },
      { key: 'paymentRate', label: '回款率', value: `${paymentRate}%` }
    ]
  }
  if (appKey === 'orders') {
    return [
      { key: 'orderAmount', label: '订单金额', value: formatSalesAmount(row.total_amount) },
      { key: 'paymentAmount', label: '已回款', value: formatSalesAmount(paymentAmount) },
      { key: 'remain', label: '未回款', value: formatSalesAmount(Math.max(toSalesAmount(row.total_amount) - paymentAmount, 0)) },
      { key: 'paymentRate', label: '回款率', value: `${toSalesAmount(row.total_amount) ? Math.round((paymentAmount / toSalesAmount(row.total_amount)) * 1000) / 10 : 0}%` }
    ]
  }
  if (appKey === 'opportunities') {
    return [
      { key: 'expectedAmount', label: '预计金额', value: formatSalesAmount(row.expected_amount) },
      { key: 'probability', label: '赢率', value: `${toSalesAmount(row.probability)}%` },
      { key: 'weightedAmount', label: '加权金额', value: formatSalesAmount(toSalesAmount(row.expected_amount) * toSalesAmount(row.probability) / 100) },
      { key: 'stage', label: '当前阶段', value: formatSalesDetailValue(row.stage) }
    ]
  }
  if (appKey === 'follow_ups') {
    return [
      { key: 'followDate', label: '跟进日期', value: formatSalesDetailValue(row.follow_date) },
      { key: 'followResult', label: '跟进结果', value: formatSalesDetailValue(row.follow_result) },
      { key: 'nextFollow', label: '下次跟进', value: formatSalesDetailValue(row.next_follow_at) },
      { key: 'owner', label: '负责人', value: formatSalesDetailValue(row.owner_name) }
    ]
  }
  return []
}

export const buildSalesDetailSummary = ({
  appName,
  row,
  items = [],
  propertyItems = [],
  relationSections = []
} = {}) => {
  if (!row) return ''
  const lines = [`${appName}：${getSalesRowDisplayName(row)}`]
  items.forEach((item) => {
    if (item.value !== '-') lines.push(`${item.label}：${item.value}`)
  })
  if (propertyItems.length) {
    lines.push('扩展字段：')
    propertyItems.forEach((item) => lines.push(`${item.key}：${item.value}`))
  }
  if (relationSections.length) {
    lines.push('关联记录：')
    relationSections.forEach((section) => {
      lines.push(`${section.title}：${section.rows.length} 条`)
      section.rows.slice(0, 5).forEach((item) => {
        lines.push(Object.values(item).filter((value) => value !== '-').join(' / '))
      })
    })
  }
  return lines.join('\n')
}
