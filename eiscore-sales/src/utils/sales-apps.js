// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const CUSTOMER_LEVEL_OPTIONS = [
  { label: '战略客户', value: '战略客户' },
  { label: '重点客户', value: '重点客户' },
  { label: '普通客户', value: '普通客户' },
  { label: '潜在客户', value: '潜在客户' }
]

const CUSTOMER_STATUS_OPTIONS = [
  { label: '跟进中', value: '跟进中' },
  { label: '已成交', value: '已成交' },
  { label: '暂停合作', value: '暂停合作' }
]

const ORDER_STATUS_OPTIONS = [
  { label: '草稿', value: '草稿' },
  { label: '已确认', value: '已确认' },
  { label: '生产中', value: '生产中' },
  { label: '已发货', value: '已发货' },
  { label: '已完成', value: '已完成' },
  { label: '已取消', value: '已取消' }
]

const PAYMENT_STATUS_OPTIONS = [
  { label: '待核销', value: '待核销' },
  { label: '部分核销', value: '部分核销' },
  { label: '已核销', value: '已核销' }
]

const FOLLOW_TYPE_OPTIONS = [
  { label: '电话沟通', value: '电话沟通' },
  { label: '微信沟通', value: '微信沟通' },
  { label: '上门拜访', value: '上门拜访' },
  { label: '视频会议', value: '视频会议' },
  { label: '展会接洽', value: '展会接洽' },
  { label: '其他', value: '其他' }
]

const FOLLOW_RESULT_OPTIONS = [
  { label: '待跟进', value: '待跟进' },
  { label: '有意向', value: '有意向' },
  { label: '报价中', value: '报价中' },
  { label: '样品确认', value: '样品确认' },
  { label: '已成交', value: '已成交' },
  { label: '暂缓', value: '暂缓' },
  { label: '无效', value: '无效' }
]

const OPPORTUNITY_STAGE_OPTIONS = [
  { label: '初步接洽', value: '初步接洽' },
  { label: '需求确认', value: '需求确认' },
  { label: '方案报价', value: '方案报价' },
  { label: '商务谈判', value: '商务谈判' },
  { label: '赢单', value: '赢单' },
  { label: '输单', value: '输单' },
  { label: '搁置', value: '搁置' }
]

const DEFAULT_SUMMARY = {
  label: '总计',
  rules: {},
  expressions: {},
  cellLabels: {}
}

const getProperty = (key) => (params) => {
  const value = params?.data?.properties?.[key]
  return value === null || value === undefined ? '' : value
}

export const CUSTOMER_COLUMNS = [
  { label: '客户编码', prop: 'customer_no', editable: false, width: 140 },
  { label: '客户名称', prop: 'name', width: 180 },
  { label: '客户等级', prop: 'level', type: 'select', options: CUSTOMER_LEVEL_OPTIONS, width: 120 },
  { label: '联系人', prop: 'contact_name', width: 120 },
  { label: '联系电话', prop: 'contact_phone', width: 140 },
  { label: '所属区域', prop: 'region', width: 140 },
  { label: '销售负责人', prop: 'owner_name', width: 120 },
  { label: '客户状态', prop: 'customer_status', type: 'select', options: CUSTOMER_STATUS_OPTIONS, width: 120 },
  { label: '信用额度', prop: 'credit_limit', type: 'number', width: 120 },
  { label: '应收余额', prop: 'receivable_balance', type: 'number', width: 120 },
  { label: '最近跟进', prop: 'last_follow_up_at', width: 140 }
]

export const ORDER_COLUMNS = [
  { label: '订单号', prop: 'order_no', editable: false, width: 150 },
  { label: '客户名称', prop: 'customer_name', width: 180 },
  { label: 'BOM物料', prop: 'product_material_code', editable: false, searchable: false, width: 130, valueGetter: getProperty('product_material_code') },
  { label: '产品名称', prop: 'product_name', width: 160 },
  {
    label: '数量',
    prop: 'quantity',
    type: 'number',
    width: 100,
    syncFields: ['total_amount'],
    valueSetter: (params) => {
      const nextValue = Number(params.newValue || 0)
      const quantity = Number.isFinite(nextValue) ? nextValue : 0
      const unitPrice = Number(params.data.unit_price || 0)
      const nextAmount = quantity * (Number.isFinite(unitPrice) ? unitPrice : 0)
      const changed = Number(params.data.quantity || 0) !== quantity || Number(params.data.total_amount || 0) !== nextAmount
      params.data.quantity = quantity
      params.data.total_amount = nextAmount
      return changed
    }
  },
  { label: '单位', prop: 'unit', width: 80 },
  {
    label: '单价',
    prop: 'unit_price',
    type: 'number',
    width: 100,
    syncFields: ['total_amount'],
    valueSetter: (params) => {
      const nextValue = Number(params.newValue || 0)
      const unitPrice = Number.isFinite(nextValue) ? nextValue : 0
      const quantity = Number(params.data.quantity || 0)
      const nextAmount = (Number.isFinite(quantity) ? quantity : 0) * unitPrice
      const changed = Number(params.data.unit_price || 0) !== unitPrice || Number(params.data.total_amount || 0) !== nextAmount
      params.data.unit_price = unitPrice
      params.data.total_amount = nextAmount
      return changed
    }
  },
  {
    label: '订单金额',
    prop: 'total_amount',
    type: 'number',
    width: 120,
    valueGetter: (params) => {
      const data = params?.data || {}
      return Number(data.quantity || 0) * Number(data.unit_price || 0)
    },
    valueSetter: (params) => {
      const nextValue = Number(params.newValue || 0)
      if (Number(params.data.total_amount || 0) === nextValue) return false
      params.data.total_amount = Number.isFinite(nextValue) ? nextValue : 0
      return true
    }
  },
  { label: '订单日期', prop: 'order_date', width: 120 },
  { label: '交付日期', prop: 'delivery_date', width: 120 },
  { label: '订单状态', prop: 'order_status', type: 'select', options: ORDER_STATUS_OPTIONS, width: 120 },
  { label: '销售负责人', prop: 'owner_name', width: 120 }
]

export const PAYMENT_COLUMNS = [
  { label: '回款单号', prop: 'payment_no', editable: false, width: 150 },
  { label: '订单号', prop: 'order_no', width: 150 },
  { label: '客户名称', prop: 'customer_name', width: 180 },
  { label: '回款金额', prop: 'amount', type: 'number', width: 120 },
  { label: '回款日期', prop: 'payment_date', width: 120 },
  { label: '回款方式', prop: 'payment_method', type: 'select', options: [
    { label: '银行转账', value: '银行转账' },
    { label: '承兑汇票', value: '承兑汇票' },
    { label: '现金', value: '现金' },
    { label: '其他', value: '其他' }
  ], width: 120 },
  { label: '核销状态', prop: 'verify_status', type: 'select', options: PAYMENT_STATUS_OPTIONS, width: 120 },
  { label: '经办人', prop: 'handler_name', width: 120 }
]

export const FOLLOW_UP_COLUMNS = [
  { label: '跟进编号', prop: 'follow_no', editable: false, width: 150 },
  { label: '客户名称', prop: 'customer_name', width: 180 },
  { label: '联系人', prop: 'contact_name', width: 120 },
  { label: '跟进日期', prop: 'follow_date', width: 120 },
  { label: '跟进方式', prop: 'follow_type', type: 'select', options: FOLLOW_TYPE_OPTIONS, width: 120 },
  { label: '跟进结果', prop: 'follow_result', type: 'select', options: FOLLOW_RESULT_OPTIONS, width: 120 },
  { label: '下次跟进', prop: 'next_follow_at', width: 120 },
  { label: '负责人', prop: 'owner_name', width: 120 },
  { label: '跟进纪要', prop: 'follow_content', width: 220, multiLine: true }
]

export const OPPORTUNITY_COLUMNS = [
  { label: '商机编号', prop: 'opportunity_no', editable: false, width: 150 },
  { label: '商机名称', prop: 'opportunity_name', width: 180 },
  { label: '客户名称', prop: 'customer_name', width: 180 },
  { label: '预计金额', prop: 'expected_amount', type: 'number', width: 120 },
  { label: '阶段', prop: 'stage', type: 'select', options: OPPORTUNITY_STAGE_OPTIONS, width: 120 },
  { label: '赢率(%)', prop: 'probability', type: 'number', width: 100 },
  { label: '预计成交', prop: 'expected_close_date', width: 120 },
  { label: '负责人', prop: 'owner_name', width: 120 },
  { label: '下次动作', prop: 'next_action', width: 180 },
  { label: '备注', prop: 'remark', width: 220, multiLine: true }
]

export const SALES_APPS = [
  {
    key: 'customers',
    name: '客户档案',
    desc: '客户基础资料、负责人、信用额度与应收余额',
    route: '/app/customers',
    perm: 'app:sales_customer',
    aclModule: 'sales_customer',
    apiUrl: '/sales_customers?status=neq.deleted',
    writeUrl: '/sales_customers',
    writeMode: 'patch',
    viewId: 'sales_customers',
    configKey: 'sales_customers_cols',
    icon: 'User',
    tone: 'blue',
    enableDetail: false,
    staticColumns: CUSTOMER_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { credit_limit: 'sum', receivable_balance: 'sum' }
    },
    ops: {
      create: 'op:sales_customer.create',
      edit: 'op:sales_customer.edit',
      delete: 'op:sales_customer.delete',
      export: 'op:sales_customer.export',
      config: 'op:sales_customer.config'
    },
    createPayload: () => ({
      customer_no: `CUST${Date.now().toString().slice(-6)}`,
      name: '新客户',
      level: '普通客户',
      contact_name: '',
      contact_phone: '',
      region: '',
      owner_name: '',
      customer_status: '跟进中',
      credit_limit: 0,
      receivable_balance: 0,
      properties: {}
    })
  },
  {
    key: 'follow_ups',
    name: '客户跟进',
    desc: '客户拜访、沟通纪要、跟进结果与下次行动',
    route: '/app/follow_ups',
    perm: 'app:sales_follow_up',
    aclModule: 'sales_follow_up',
    apiUrl: '/sales_follow_ups?status=neq.deleted',
    writeUrl: '/sales_follow_ups',
    writeMode: 'patch',
    viewId: 'sales_follow_ups',
    configKey: 'sales_follow_ups_cols',
    icon: 'ChatLineSquare',
    tone: 'cyan',
    enableDetail: false,
    staticColumns: FOLLOW_UP_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: {}
    },
    ops: {
      create: 'op:sales_follow_up.create',
      edit: 'op:sales_follow_up.edit',
      delete: 'op:sales_follow_up.delete',
      export: 'op:sales_follow_up.export',
      config: 'op:sales_follow_up.config'
    },
    createPayload: () => ({
      follow_no: `FU${Date.now().toString().slice(-8)}`,
      customer_name: '待选择客户',
      contact_name: '',
      follow_date: new Date().toISOString().slice(0, 10),
      follow_type: '电话沟通',
      follow_result: '待跟进',
      next_follow_at: '',
      owner_name: '',
      follow_content: '',
      properties: {}
    })
  },
  {
    key: 'opportunities',
    name: '销售商机',
    desc: '客户需求、预计金额、销售阶段与成交概率',
    route: '/app/opportunities',
    perm: 'app:sales_opportunity',
    aclModule: 'sales_opportunity',
    apiUrl: '/sales_opportunities?status=neq.deleted',
    writeUrl: '/sales_opportunities',
    writeMode: 'patch',
    viewId: 'sales_opportunities',
    configKey: 'sales_opportunities_cols',
    icon: 'TrendCharts',
    tone: 'indigo',
    enableDetail: false,
    staticColumns: OPPORTUNITY_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { expected_amount: 'sum' }
    },
    ops: {
      create: 'op:sales_opportunity.create',
      edit: 'op:sales_opportunity.edit',
      delete: 'op:sales_opportunity.delete',
      export: 'op:sales_opportunity.export',
      config: 'op:sales_opportunity.config'
    },
    createPayload: () => ({
      opportunity_no: `OPP${Date.now().toString().slice(-8)}`,
      opportunity_name: '新商机',
      customer_name: '待选择客户',
      expected_amount: 0,
      stage: '初步接洽',
      probability: 20,
      expected_close_date: '',
      owner_name: '',
      next_action: '',
      remark: '',
      properties: {}
    })
  },
  {
    key: 'orders',
    name: '销售订单',
    desc: '订单明细、交付计划、订单状态与销售金额',
    route: '/app/orders',
    perm: 'app:sales_order',
    aclModule: 'sales_order',
    apiUrl: '/sales_orders?status=neq.deleted',
    writeUrl: '/sales_orders',
    writeMode: 'patch',
    viewId: 'sales_orders',
    configKey: 'sales_orders_cols',
    icon: 'Tickets',
    tone: 'green',
    enableDetail: false,
    staticColumns: ORDER_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { quantity: 'sum', total_amount: 'sum' }
    },
    ops: {
      create: 'op:sales_order.create',
      edit: 'op:sales_order.edit',
      delete: 'op:sales_order.delete',
      export: 'op:sales_order.export',
      config: 'op:sales_order.config'
    },
    createPayload: () => ({
      order_no: `SO${Date.now().toString().slice(-8)}`,
      customer_name: '待选择客户',
      product_name: '待录入产品',
      quantity: 1,
      unit: '箱',
      unit_price: 0,
      total_amount: 0,
      order_date: new Date().toISOString().slice(0, 10),
      delivery_date: '',
      order_status: '草稿',
      owner_name: '',
      properties: {}
    })
  },
  {
    key: 'shipment_requests',
    name: '销售出货申请',
    desc: '基于销售订单跟进交付、下推和出货申请处理',
    route: '/app/orders',
    perm: 'app:sales_order',
    icon: 'Tickets',
    tone: 'purple'
  },
  {
    key: 'payments',
    name: '回款记录',
    desc: '订单回款、核销状态与资金到账跟踪',
    route: '/app/payments',
    perm: 'app:sales_payment',
    aclModule: 'sales_payment',
    apiUrl: '/sales_payments?status=neq.deleted',
    writeUrl: '/sales_payments',
    writeMode: 'patch',
    viewId: 'sales_payments',
    configKey: 'sales_payments_cols',
    icon: 'Money',
    tone: 'orange',
    enableDetail: false,
    staticColumns: PAYMENT_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { amount: 'sum' }
    },
    ops: {
      create: 'op:sales_payment.create',
      edit: 'op:sales_payment.edit',
      delete: 'op:sales_payment.delete',
      export: 'op:sales_payment.export',
      config: 'op:sales_payment.config'
    },
    createPayload: () => ({
      payment_no: `PAY${Date.now().toString().slice(-8)}`,
      order_no: '',
      customer_name: '',
      amount: 0,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: '银行转账',
      verify_status: '待核销',
      handler_name: '',
      properties: {}
    })
  }
]

export const SALES_COCKPIT_APP = {
  key: 'cockpit',
  name: '销售驾驶舱',
  desc: '经营指标、销售漏斗、回款进度与风险预警',
  route: '/cockpit',
  perm: 'app:sales_cockpit',
  icon: 'DataBoard',
  tone: 'dark'
}

export const findSalesApp = (key) => {
  const found = SALES_APPS.find((app) => app.key === key)
  if (found?.apiUrl) return found
  if (key === 'shipment_requests') {
    const source = SALES_APPS.find((app) => app.key === 'orders')
    return source
      ? {
        ...source,
        key: 'shipment_requests',
        name: '销售出货申请',
        desc: '基于销售订单跟进交付、下推和出货申请处理',
        route: '/app/shipment_requests',
        viewId: 'sales_shipment_requests',
        configKey: 'sales_shipment_requests_cols'
      }
      : found
  }
  return found
}
