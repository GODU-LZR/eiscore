// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { normalizeSalesCockpitRows, toSalesCockpitAmount } from './sales-cockpit-presentation-policy.js'

export const buildSalesCockpitAiContext = ({
  stats = {},
  kpis = [],
  funnel = [],
  ownerPerformance = [],
  receivableCustomers = [],
  risks = [],
  actions = [],
  events = []
} = {}) => ({
  app: 'sales',
  view: 'sales_cockpit',
  viewId: 'sales_cockpit',
  profile: 'public',
  aiScene: 'sales_cockpit',
  allowImport: false,
  allowFormula: false,
  dataStats: stats,
  cockpit: {
    kpis,
    funnel,
    ownerPerformance,
    receivableCustomers: normalizeSalesCockpitRows(receivableCustomers).map((row) => ({
      customerNo: row.customer_no,
      customerName: row.name,
      ownerName: row.owner_name,
      receivableBalance: toSalesCockpitAmount(row.receivable_balance),
      creditLimit: toSalesCockpitAmount(row.credit_limit)
    })),
    risks,
    actions,
    events
  },
  moduleTips: [
    '销售驾驶舱用于面向管理层查看销售经营指标。',
    '商机管道和加权预测用于评估后续销售增长。',
    '风险预警聚合交付、商机逾期和应收问题。'
  ]
})
