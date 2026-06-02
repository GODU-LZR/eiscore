// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const SUPPLIER_STATUS_OPTIONS = [
  { label: '合作中', value: '合作中' },
  { label: '待评审', value: '待评审' },
  { label: '暂停合作', value: '暂停合作' }
]

const SUPPLIER_LEVEL_OPTIONS = [
  { label: '战略', value: '战略' },
  { label: '核心', value: '核心' },
  { label: '普通', value: '普通' },
  { label: '备选', value: '备选' }
]

const DEMAND_STATUS_OPTIONS = [
  { label: '草稿', value: '草稿' },
  { label: '待采购', value: '待采购' },
  { label: '已下单', value: '已下单' },
  { label: '已关闭', value: '已关闭' }
]

const ORDER_STATUS_OPTIONS = [
  { label: '草稿', value: '草稿' },
  { label: '已下单', value: '已下单' },
  { label: '部分到货', value: '部分到货' },
  { label: '已完成', value: '已完成' },
  { label: '已取消', value: '已取消' }
]

const ARRIVAL_STATUS_OPTIONS = [
  { label: '待到货', value: '待到货' },
  { label: '待检验', value: '待检验' },
  { label: '已入库', value: '已入库' },
  { label: '异常', value: '异常' }
]

const IQC_STATUS_OPTIONS = [
  { label: '待检', value: '待检' },
  { label: '合格', value: '合格' },
  { label: '让步接收', value: '让步接收' },
  { label: '不合格', value: '不合格' }
]

const DEFAULT_SUMMARY = {
  label: '总计',
  rules: {},
  expressions: {},
  cellLabels: {}
}

const parseNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const roundMoney = (value) => Math.round(parseNumber(value) * 100) / 100

const getProperty = (key) => (params) => {
  const value = params?.data?.properties?.[key]
  return value === null || value === undefined ? '' : value
}

const getBomSource = (params) => {
  const source = params?.data?.properties?.source
  if (source === 'sales_bom_mrp') return '销售BOM-MRP'
  return source || ''
}

const refreshOrderAmountCell = (params) => {
  params.api?.refreshCells?.({
    rowNodes: params.node ? [params.node] : undefined,
    columns: ['total_amount'],
    force: true
  })
}

const setOrderQuantity = (params) => {
  const nextValue = parseNumber(params.newValue)
  const currentValue = parseNumber(params.data?.quantity)
  const nextAmount = roundMoney(nextValue * parseNumber(params.data?.unit_price))
  const amountChanged = parseNumber(params.data?.total_amount) !== nextAmount
  params.data.quantity = nextValue
  params.data.total_amount = nextAmount
  refreshOrderAmountCell(params)
  return currentValue !== nextValue || amountChanged
}

const setOrderUnitPrice = (params) => {
  const nextValue = roundMoney(params.newValue)
  const currentValue = parseNumber(params.data?.unit_price)
  const nextAmount = roundMoney(parseNumber(params.data?.quantity) * nextValue)
  const amountChanged = parseNumber(params.data?.total_amount) !== nextAmount
  params.data.unit_price = nextValue
  params.data.total_amount = nextAmount
  refreshOrderAmountCell(params)
  return currentValue !== nextValue || amountChanged
}

export const SUPPLIER_COLUMNS = [
  { label: '供应商编码', prop: 'supplier_no', editable: false, width: 140 },
  { label: '供应商名称', prop: 'name', width: 190 },
  { label: '等级', prop: 'level', type: 'select', options: SUPPLIER_LEVEL_OPTIONS, width: 100 },
  { label: '联系人', prop: 'contact_name', width: 120 },
  { label: '联系电话', prop: 'contact_phone', width: 140 },
  { label: '主营品类', prop: 'category', width: 140 },
  { label: '付款条件', prop: 'payment_terms', width: 140 },
  { label: '交期(天)', prop: 'lead_time_days', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '采购负责人', prop: 'buyer_name', width: 120 },
  { label: '状态', prop: 'supplier_status', type: 'select', options: SUPPLIER_STATUS_OPTIONS, width: 120 },
  { label: '最近评审', prop: 'last_review_at', width: 120 }
]

export const DEMAND_COLUMNS = [
  { label: '需求单号', prop: 'demand_no', editable: false, width: 150 },
  { label: '物料编码', prop: 'material_no', width: 130 },
  { label: '物料名称', prop: 'material_name', width: 180 },
  { label: '需求数量', prop: 'quantity', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '单位', prop: 'unit', width: 80 },
  { label: '需求日期', prop: 'required_date', width: 120 },
  { label: '来源部门', prop: 'source_dept', width: 120 },
  { label: '申请人', prop: 'requester_name', width: 110 },
  { label: 'BOM来源', prop: 'bom_source', editable: false, searchable: false, width: 130, valueGetter: getBomSource },
  { label: '来源成品', prop: 'source_product_codes', editable: false, searchable: false, width: 180, valueGetter: getProperty('source_product_codes') },
  { label: '来源销售订单', prop: 'source_order_nos', editable: false, searchable: false, minWidth: 220, valueGetter: getProperty('source_order_nos') },
  { label: '建议供应商', prop: 'preferred_supplier', width: 160 },
  { label: '需求状态', prop: 'demand_status', type: 'select', options: DEMAND_STATUS_OPTIONS, width: 120 },
  { label: '备注', prop: 'remark', minWidth: 160 }
]

export const ORDER_COLUMNS = [
  { label: '采购单号', prop: 'order_no', editable: false, width: 150 },
  { label: '来源需求', prop: 'source_demand_no', editable: false, width: 150 },
  { label: '供应商名称', prop: 'supplier_name', width: 180 },
  { label: '物料名称', prop: 'material_name', width: 170 },
  {
    label: '数量',
    prop: 'quantity',
    type: 'number',
    width: 100,
    valueParser: (params) => parseNumber(params.newValue),
    valueSetter: setOrderQuantity,
    syncFields: ['total_amount']
  },
  { label: '单位', prop: 'unit', width: 80 },
  {
    label: '单价',
    prop: 'unit_price',
    type: 'number',
    width: 100,
    valueParser: (params) => roundMoney(params.newValue),
    valueSetter: setOrderUnitPrice,
    syncFields: ['total_amount']
  },
  { label: '订单金额', prop: 'total_amount', type: 'number', width: 120, editable: false, valueParser: (params) => roundMoney(params.newValue) },
  { label: '下单日期', prop: 'order_date', width: 120 },
  { label: '预计到货', prop: 'expected_arrival_date', width: 120 },
  { label: '采购负责人', prop: 'buyer_name', width: 120 },
  { label: '已到货', prop: 'arrived_quantity', type: 'number', width: 110, editable: false },
  { label: '待到货', prop: 'pending_quantity', type: 'number', width: 110, editable: false },
  { label: '到货进度', prop: 'arrival_progress', editable: false, width: 120 },
  { label: '订单状态', prop: 'order_status', type: 'select', options: ORDER_STATUS_OPTIONS, width: 120 }
]

export const ARRIVAL_COLUMNS = [
  { label: '到货单号', prop: 'arrival_no', editable: false, width: 150 },
  { label: '采购单号', prop: 'order_no', width: 150 },
  { label: '供应商名称', prop: 'supplier_name', width: 180 },
  { label: '物料名称', prop: 'material_name', width: 170 },
  { label: '到货数量', prop: 'arrival_quantity', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '合格数量', prop: 'accepted_quantity', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '单位', prop: 'unit', width: 80 },
  { label: '到货日期', prop: 'arrival_date', width: 120 },
  { label: 'IQC状态', prop: 'iqc_status', type: 'select', options: IQC_STATUS_OPTIONS, width: 120 },
  { label: '入库单号', prop: 'inbound_no', width: 150 },
  { label: '到货状态', prop: 'arrival_status', type: 'select', options: ARRIVAL_STATUS_OPTIONS, width: 120 }
]

export const PURCHASE_APPS = [
  {
    key: 'dashboard',
    name: '采购驾驶舱',
    desc: '采购态势、履约风险、到货节奏与供应商健康监控',
    route: '/dashboard',
    perm: 'app:purchase_dashboard',
    icon: 'Monitor',
    tone: 'indigo'
  },
  {
    key: 'suppliers',
    name: '供应商档案',
    desc: '供应商基础资料、等级、付款条件与交期管理',
    route: '/app/suppliers',
    perm: 'app:purchase_supplier',
    aclModule: 'purchase_supplier',
    apiUrl: '/purchase_suppliers',
    writeMode: 'patch',
    viewId: 'purchase_suppliers',
    configKey: 'purchase_suppliers_cols',
    icon: 'OfficeBuilding',
    tone: 'blue',
    staticColumns: SUPPLIER_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [],
    ops: {
      create: 'op:purchase_supplier.create',
      edit: 'op:purchase_supplier.edit',
      delete: 'op:purchase_supplier.delete',
      export: 'op:purchase_supplier.export',
      config: 'op:purchase_supplier.config'
    },
    businessOps: {
      reviewSupplier: 'op:purchase_supplier.review',
      pauseSupplier: 'op:purchase_supplier.pause',
      resumeSupplier: 'op:purchase_supplier.resume'
    },
    createPayload: () => ({
      supplier_no: `SUP${Date.now().toString().slice(-6)}`,
      name: '新供应商',
      level: '普通',
      contact_name: '',
      contact_phone: '',
      category: '',
      payment_terms: '月结30天',
      lead_time_days: 7,
      buyer_name: '',
      supplier_status: '待评审',
      properties: {}
    })
  },
  {
    key: 'demands',
    name: '采购需求',
    desc: '物料采购需求、来源部门、建议供应商与需求状态',
    route: '/app/demands',
    perm: 'app:purchase_demand',
    aclModule: 'purchase_demand',
    apiUrl: '/purchase_demands',
    writeMode: 'patch',
    viewId: 'purchase_demands',
    configKey: 'purchase_demands_cols',
    icon: 'Memo',
    tone: 'green',
    staticColumns: DEMAND_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { quantity: 'sum' }
    },
    defaultExtraColumns: [],
    ops: {
      create: 'op:purchase_demand.create',
      edit: 'op:purchase_demand.edit',
      delete: 'op:purchase_demand.delete',
      export: 'op:purchase_demand.export',
      config: 'op:purchase_demand.config'
    },
    businessOps: {
      createOrder: 'op:purchase_demand.create_order',
      submitDemand: 'op:purchase_demand.submit',
      closeDemand: 'op:purchase_demand.close',
      reopenDemand: 'op:purchase_demand.reopen'
    },
    createPayload: () => ({
      demand_no: `PR${Date.now().toString().slice(-8)}`,
      material_no: '',
      material_name: '待录入物料',
      quantity: 1,
      unit: 'kg',
      required_date: new Date().toISOString().slice(0, 10),
      source_dept: '',
      requester_name: '',
      preferred_supplier: '',
      demand_status: '草稿',
      remark: '',
      properties: {}
    })
  },
  {
    key: 'orders',
    name: '采购订单',
    desc: '供应商采购订单、金额、预计到货与执行状态',
    route: '/app/orders',
    perm: 'app:purchase_order',
    aclModule: 'purchase_order',
    apiUrl: '/v_purchase_order_progress',
    writeUrl: '/purchase_orders',
    writeMode: 'patch',
    viewId: 'purchase_orders',
    configKey: 'purchase_orders_cols',
    icon: 'Tickets',
    tone: 'orange',
    staticColumns: ORDER_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { quantity: 'sum', total_amount: 'sum' }
    },
    defaultExtraColumns: [
      { label: '交期风险', prop: 'delivery_risk', type: 'select', options: [
        { label: '正常', value: '正常' },
        { label: '临期', value: '临期' },
        { label: '延期', value: '延期' }
      ] },
      { label: '订单含税金额', prop: 'tax_included_amount', type: 'formula', expression: '{订单金额}*1.13' }
    ],
    ops: {
      create: 'op:purchase_order.create',
      edit: 'op:purchase_order.edit',
      delete: 'op:purchase_order.delete',
      export: 'op:purchase_order.export',
      config: 'op:purchase_order.config'
    },
    businessOps: {
      registerArrival: 'op:purchase_order.register_arrival',
      confirmOrder: 'op:purchase_order.confirm',
      cancelOrder: 'op:purchase_order.cancel'
    },
    createPayload: () => ({
      order_no: `PO${Date.now().toString().slice(-8)}`,
      supplier_name: '待选择供应商',
      material_name: '待录入物料',
      quantity: 1,
      unit: 'kg',
      unit_price: 0,
      total_amount: 0,
      order_date: new Date().toISOString().slice(0, 10),
      expected_arrival_date: null,
      buyer_name: '',
      order_status: '草稿',
      properties: {}
    })
  },
  {
    key: 'arrivals',
    name: '到货跟踪',
    desc: '采购到货、IQC结果、入库单号与异常处理',
    route: '/app/arrivals',
    perm: 'app:purchase_arrival',
    aclModule: 'purchase_arrival',
    apiUrl: '/purchase_arrivals',
    writeMode: 'patch',
    viewId: 'purchase_arrivals',
    configKey: 'purchase_arrivals_cols',
    icon: 'Box',
    tone: 'teal',
    staticColumns: ARRIVAL_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { arrival_quantity: 'sum', accepted_quantity: 'sum' }
    },
    defaultExtraColumns: [
      { label: '异常说明', prop: 'exception_note', type: 'text' }
    ],
    ops: {
      create: 'op:purchase_arrival.create',
      edit: 'op:purchase_arrival.edit',
      delete: 'op:purchase_arrival.delete',
      export: 'op:purchase_arrival.export',
      config: 'op:purchase_arrival.config'
    },
    businessOps: {
      confirmInbound: 'op:purchase_arrival.confirm_inbound',
      markException: 'op:purchase_arrival.mark_exception'
    },
    createPayload: () => ({
      arrival_no: `PA${Date.now().toString().slice(-8)}`,
      order_no: '',
      supplier_name: '待选择供应商',
      material_name: '待录入物料',
      arrival_quantity: 1,
      accepted_quantity: 0,
      unit: 'kg',
      arrival_date: new Date().toISOString().slice(0, 10),
      iqc_status: '待检',
      inbound_no: '',
      arrival_status: '待到货',
      properties: {}
    })
  }
]

export const findPurchaseApp = (key) => {
  return PURCHASE_APPS.find((app) => app.key === key)
}
