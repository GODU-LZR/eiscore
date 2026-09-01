// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  clampSalesCockpitRate,
  formatSalesCockpitCurrency,
  normalizeSalesCockpitRows,
  sumSalesCockpitRowsBy,
  toSalesCockpitAmount
} from './sales-cockpit-presentation-policy.js'

export const buildSalesCockpitStats = ({
  customers = [],
  orders = [],
  opportunities = [],
  activeOpportunities = opportunities,
  payments = [],
  followUps = []
} = {}) => {
  const activeCustomers = normalizeSalesCockpitRows(customers)
  const activeOrders = normalizeSalesCockpitRows(orders)
  const activePayments = normalizeSalesCockpitRows(payments)
  const activeOpportunityRows = normalizeSalesCockpitRows(activeOpportunities)
  const activeFollowUps = normalizeSalesCockpitRows(followUps)
  const allOpportunities = normalizeSalesCockpitRows(opportunities)
  const orderAmount = sumSalesCockpitRowsBy(activeOrders, 'total_amount')
  const paymentAmount = sumSalesCockpitRowsBy(activePayments, 'amount')
  const opportunityAmount = sumSalesCockpitRowsBy(activeOpportunityRows, 'expected_amount')
  const weightedOpportunityAmount = activeOpportunityRows.reduce((sum, row) => (
    sum + toSalesCockpitAmount(row.expected_amount) * toSalesCockpitAmount(row.probability) / 100
  ), 0)
  const receivableBalance = sumSalesCockpitRowsBy(activeCustomers, 'receivable_balance')
    || Math.max(orderAmount - paymentAmount, 0)
  const closedOpportunities = allOpportunities.filter((row) => (
    row?.status !== 'deleted' && ['赢单', '输单'].includes(row?.stage)
  ))
  const wonOpportunities = closedOpportunities.filter((row) => row?.stage === '赢单')
  return {
    customerCount: activeCustomers.length,
    strategicCustomerCount: activeCustomers.filter((row) => ['战略客户', '重点客户'].includes(row?.level)).length,
    opportunityCount: activeOpportunityRows.length,
    orderCount: activeOrders.length,
    paymentCount: activePayments.length,
    followCount: activeFollowUps.length,
    orderAmount,
    paymentAmount,
    opportunityAmount,
    weightedOpportunityAmount,
    receivableBalance,
    avgOrderAmount: activeOrders.length ? orderAmount / activeOrders.length : 0,
    winRate: closedOpportunities.length ? Math.round((wonOpportunities.length / closedOpportunities.length) * 1000) / 10 : 0,
    paymentRate: orderAmount ? Math.round((paymentAmount / orderAmount) * 1000) / 10 : 0,
    pendingVerifyCount: activePayments.filter((row) => row?.verify_status !== '已核销').length
  }
}

export const buildSalesCockpitKpiCards = (stats = {}) => [
  { key: 'customers', label: '客户总数', value: `${stats.customerCount}`, sub: `战略/重点 ${stats.strategicCustomerCount} 家`, tone: 'blue' },
  { key: 'opportunities', label: '商机管道', value: formatSalesCockpitCurrency(stats.opportunityAmount), sub: `${stats.opportunityCount} 个活跃商机`, tone: 'indigo' },
  { key: 'weighted', label: '加权预测', value: formatSalesCockpitCurrency(stats.weightedOpportunityAmount), sub: '按赢率折算', tone: 'teal' },
  { key: 'orders', label: '有效订单', value: formatSalesCockpitCurrency(stats.orderAmount), sub: `${stats.orderCount} 笔订单`, tone: 'green' },
  { key: 'payments', label: '回款金额', value: formatSalesCockpitCurrency(stats.paymentAmount), sub: `回款率 ${stats.paymentRate}%`, tone: 'orange' },
  { key: 'receivable', label: '应收余额', value: formatSalesCockpitCurrency(stats.receivableBalance), sub: `待核销 ${stats.pendingVerifyCount} 笔`, tone: 'red' }
]

export const buildSalesOpportunityFunnel = (opportunities = []) => {
  const rows = normalizeSalesCockpitRows(opportunities)
  const stages = ['初步接洽', '需求确认', '方案报价', '商务谈判', '赢单']
  const totalAmount = sumSalesCockpitRowsBy(rows, 'expected_amount') || 1
  return stages.map((stage) => {
    const stageRows = rows.filter((row) => row?.stage === stage)
    const amount = sumSalesCockpitRowsBy(stageRows, 'expected_amount')
    return { label: stage, count: stageRows.length, amount, rate: Math.max(8, Math.round((amount / totalAmount) * 100)) }
  }).filter((item) => item.count > 0)
}

export const buildSalesOrderStageStats = (orders = []) => {
  const rows = normalizeSalesCockpitRows(orders)
  const total = rows.length || 1
  return ['草稿', '已确认', '生产中', '已发货', '已完成'].map((label) => {
    const count = rows.filter((row) => row?.order_status === label).length
    return { label, count, rate: Math.max(count ? 8 : 0, Math.round((count / total) * 100)) }
  })
}

export const buildSalesCreditUsage = ({ customers = [], receivableBalance = 0 } = {}) => {
  const totalCreditLimit = sumSalesCockpitRowsBy(normalizeSalesCockpitRows(customers), 'credit_limit')
  const rate = totalCreditLimit
    ? Math.min(100, Math.round((toSalesCockpitAmount(receivableBalance) / totalCreditLimit) * 1000) / 10)
    : 0
  return { totalCreditLimit, rate }
}

export const buildSalesPaymentGauge = (paymentRate) => {
  const rate = clampSalesCockpitRate(paymentRate)
  const total = 257.61
  const filled = total * rate / 100
  const color = rate >= 80 ? 'var(--c-green)' : rate >= 50 ? 'var(--c-amber)' : 'var(--c-red)'
  return { rate, color, dash: `${filled} ${total - filled}` }
}
