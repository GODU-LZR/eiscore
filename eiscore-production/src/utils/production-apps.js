// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const WORK_ORDER_STATUS_OPTIONS = [
  { label: '待排产', value: '待排产' },
  { label: '已排产', value: '已排产' },
  { label: '生产中', value: '生产中' },
  { label: '已完工', value: '已完工' },
  { label: '已取消', value: '已取消' }
]

export const PRIORITY_OPTIONS = [
  { label: '低', value: '低' },
  { label: '普通', value: '普通' },
  { label: '高', value: '高' },
  { label: '紧急', value: '紧急' }
]

export const ISSUE_STATUS_OPTIONS = [
  { label: '未领料', value: '未领料' },
  { label: '部分领料', value: '部分领料' },
  { label: '已齐套', value: '已齐套' }
]

const BOM_STATUS_OPTIONS = [
  { label: '草稿', value: '草稿' },
  { label: '启用', value: '启用' },
  { label: '停用', value: '停用' },
  { label: '作废', value: '作废' }
]

const BOM_TYPE_OPTIONS = [
  { label: '生产BOM', value: '生产BOM' },
  { label: '包装BOM', value: '包装BOM' },
  { label: '研发BOM', value: '研发BOM' },
  { label: '委外BOM', value: '委外BOM' }
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

const getProperty = (key) => (params) => {
  const value = params?.data?.properties?.[key]
  return value === null || value === undefined ? '' : value
}

const readonly = { editable: false }

export const PRODUCTION_PLAN_COLUMNS = [
  { label: '成品编码', prop: 'product_material_code', ...readonly, width: 140 },
  { label: '成品名称', prop: 'product_material_name', ...readonly, minWidth: 180 },
  { label: '销售数量', prop: 'sales_qty', type: 'number', ...readonly, width: 120 },
  { label: '成品库存', prop: 'finished_available_qty', type: 'number', ...readonly, width: 120 },
  { label: '建议生产', prop: 'planned_qty', type: 'number', ...readonly, width: 120 },
  { label: '单位', prop: 'unit', ...readonly, width: 80 },
  { label: '最早交期', prop: 'earliest_delivery_date', ...readonly, width: 120 },
  { label: 'BOM编号', prop: 'bom_no', ...readonly, width: 170 },
  { label: 'BOM版本', prop: 'bom_version', ...readonly, width: 100 },
  { label: '工单数', prop: 'work_order_count', type: 'number', ...readonly, width: 100 },
  { label: '未关闭工单', prop: 'open_work_order_count', type: 'number', ...readonly, width: 120 },
  { label: '计划状态', prop: 'plan_status', ...readonly, width: 130 },
  { label: '来源订单', prop: 'source_order_nos', ...readonly, minWidth: 240 }
]

export const PRODUCTION_BOM_COLUMNS = [
  { label: '配方编号', prop: 'bom_no', editable: false, width: 180 },
  { label: '配方名称', prop: 'bom_name', minWidth: 200 },
  { label: '生产产品编码', prop: 'parent_material_code', editable: false, width: 150 },
  { label: '生产产品名称', prop: 'parent_material_name', editable: false, minWidth: 180 },
  { label: '版本', prop: 'version', width: 90 },
  { label: '一次产出', prop: 'base_qty', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '单位', prop: 'unit', width: 80 },
  { label: '配方类型', prop: 'bom_type', type: 'select', options: BOM_TYPE_OPTIONS, width: 120 },
  { label: '状态', prop: 'status', type: 'select', options: BOM_STATUS_OPTIONS, width: 100 },
  { label: '用料项', prop: 'item_count', type: 'number', editable: false, width: 100 },
  { label: '生效日期', prop: 'effective_from', width: 120 },
  { label: '备注', prop: 'remark', minWidth: 180 }
]

export const WORK_ORDER_COLUMNS = [
  { label: '工单号', prop: 'work_order_no', editable: false, width: 210 },
  { label: '成品编码', prop: 'product_material_code', editable: false, width: 140 },
  { label: '成品名称', prop: 'product_material_name', editable: false, minWidth: 180 },
  {
    label: '计划数量',
    prop: 'planned_qty',
    type: 'number',
    width: 120,
    valueParser: (params) => parseNumber(params.newValue)
  },
  { label: '单位', prop: 'unit', width: 80 },
  { label: '计划开始', prop: 'planned_start_date', width: 120 },
  { label: '计划完成', prop: 'planned_finish_date', width: 120 },
  { label: '工单状态', prop: 'work_order_status', type: 'select', options: WORK_ORDER_STATUS_OPTIONS, width: 120 },
  { label: '优先级', prop: 'priority', type: 'select', options: PRIORITY_OPTIONS, width: 100 },
  { label: 'BOM编号', prop: 'bom_no', editable: false, width: 170 },
  { label: 'BOM版本', prop: 'bom_version', editable: false, width: 100 },
  { label: '用料项', prop: 'item_count', editable: false, type: 'number', width: 100 },
  { label: '缺料项', prop: 'shortage_item_count', editable: false, type: 'number', width: 100 },
  { label: '来源订单', prop: 'source_order_nos', editable: false, minWidth: 220 },
  { label: '备注', prop: 'remark', minWidth: 180 }
]

export const WORK_ORDER_ITEM_COLUMNS = [
  { label: '工单号', prop: 'work_order_no', editable: false, width: 210 },
  { label: '成品编码', prop: 'product_material_code', editable: false, width: 140 },
  { label: '行号', prop: 'line_no', editable: false, width: 80 },
  { label: '子件编码', prop: 'component_material_code', editable: false, width: 140 },
  { label: '子件名称', prop: 'component_material_name', editable: false, minWidth: 180 },
  { label: '需求数量', prop: 'required_qty', type: 'number', width: 120, valueParser: (params) => parseNumber(params.newValue) },
  { label: '单位', prop: 'unit', width: 80 },
  { label: '已领数量', prop: 'issued_qty', type: 'number', width: 120, valueParser: (params) => parseNumber(params.newValue) },
  { label: '可用库存', prop: 'available_qty', editable: false, searchable: false, width: 120, valueGetter: getProperty('available_qty') },
  { label: '缺料数量', prop: 'shortage_qty', type: 'number', editable: false, width: 120 },
  { label: '领料状态', prop: 'issue_status', type: 'select', options: ISSUE_STATUS_OPTIONS, width: 120 },
  { label: '备注', prop: 'remark', minWidth: 180 }
]

export const PRODUCTION_APPS = [
  {
    key: 'overview',
    name: '生产总览',
    desc: '看生产建议、工单进度、齐套和缺料风险',
    route: '/overview',
    perm: 'module:production',
    icon: 'DataBoard',
    tone: 'dark',
    appType: 'overview'
  },
  {
    key: 'bom',
    name: '产品配方',
    desc: '维护生产一个产品需要哪些料、各用多少',
    route: '/bom',
    perm: 'app:mms_bom',
    icon: 'Connection',
    tone: 'slate',
    appType: 'bom',
    aclModule: 'mms_bom'
  },
  {
    key: 'bom_list',
    name: '配方清单',
    desc: '用表格快速查看和维护产品配方主信息',
    route: '/app/bom_list',
    perm: 'app:mms_bom',
    aclModule: 'mms_bom',
    apiUrl: '/v_boms',
    writeUrl: '/boms',
    writeMode: 'patch',
    viewId: 'production_bom_list',
    configKey: 'production_bom_list_cols',
    icon: 'List',
    tone: 'slate',
    staticColumns: PRODUCTION_BOM_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { base_qty: 'sum', item_count: 'sum' }
    },
    defaultExtraColumns: [],
    patchRequiredFields: ['bom_no', 'bom_name', 'parent_material_id', 'version', 'base_qty', 'unit', 'bom_type', 'status'],
    fieldDefaults: { version: 'V1', base_qty: 1, bom_type: '生产BOM', status: '草稿' },
    canCreateRows: false,
    ops: {
      create: 'op:mms_bom.create',
      edit: 'op:mms_bom.edit',
      delete: 'op:mms_bom.delete',
      export: 'op:mms_bom.export',
      config: 'op:mms_bom.edit'
    }
  },
  {
    key: 'plans',
    name: '生产建议',
    desc: '销售需求减掉成品库存后，还需要生产多少',
    route: '/app/plans',
    perm: 'app:production_plan',
    aclModule: 'production_plan',
    apiUrl: '/v_sales_bom_production_plan',
    writeUrl: '',
    writeMode: 'patch',
    viewId: 'production_plans',
    configKey: 'production_plans_cols',
    icon: 'Calendar',
    tone: 'blue',
    staticColumns: PRODUCTION_PLAN_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { sales_qty: 'sum', finished_available_qty: 'sum', planned_qty: 'sum' }
    },
    defaultExtraColumns: [],
    showStatusCol: false,
    showActionCol: false,
    canCreateRows: false,
    canEditRows: false,
    canDeleteRows: false,
    ops: {
      create: 'op:production_work_order.create',
      edit: 'op:production_work_order.edit',
      delete: '',
      export: 'op:production_work_order.export',
      config: 'op:production_work_order.edit'
    }
  },
  {
    key: 'work_orders',
    name: '生产工单',
    desc: '把生产建议转成可排产、可跟进的生产任务',
    route: '/app/work_orders',
    perm: 'app:production_work_order',
    aclModule: 'production_work_order',
    apiUrl: '/v_production_work_orders',
    writeUrl: '/production_work_orders',
    writeMode: 'patch',
    viewId: 'production_work_orders',
    configKey: 'production_work_orders_cols',
    icon: 'Tickets',
    tone: 'green',
    staticColumns: WORK_ORDER_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { planned_qty: 'sum', item_count: 'sum', shortage_item_count: 'sum' }
    },
    defaultExtraColumns: [],
    patchRequiredFields: ['work_order_no', 'product_material_id', 'product_material_code', 'product_material_name', 'bom_version', 'planned_qty', 'unit', 'work_order_status', 'priority'],
    fieldDefaults: { bom_version: 'V1', planned_qty: 0, unit: '盒', work_order_status: '待排产', priority: '普通' },
    createDisabledTip: '建议先从“生产建议”或“生产总览”生成工单，避免手工漏掉配方用料。',
    canCreateRows: false,
    ops: {
      create: 'op:production_work_order.create',
      edit: 'op:production_work_order.edit',
      delete: 'op:production_work_order.edit',
      export: 'op:production_work_order.export',
      config: 'op:production_work_order.edit'
    }
  },
  {
    key: 'work_order_items',
    name: '领料跟进',
    desc: '查看每张工单需要哪些料、缺多少、领到哪一步',
    route: '/app/work_order_items',
    perm: 'app:production_work_order',
    aclModule: 'production_work_order',
    apiUrl: '/v_production_work_order_items',
    writeUrl: '/production_work_order_items',
    writeMode: 'patch',
    viewId: 'production_work_order_items',
    configKey: 'production_work_order_items_cols',
    icon: 'List',
    tone: 'orange',
    staticColumns: WORK_ORDER_ITEM_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { required_qty: 'sum', issued_qty: 'sum', shortage_qty: 'sum' }
    },
    defaultExtraColumns: [],
    patchRequiredFields: ['work_order_id', 'line_no', 'component_material_id', 'component_material_code', 'component_material_name', 'required_qty', 'unit', 'issued_qty', 'shortage_qty', 'issue_status'],
    fieldDefaults: { required_qty: 0, issued_qty: 0, shortage_qty: 0, issue_status: '未领料' },
    canCreateRows: false,
    ops: {
      create: 'op:production_work_order.create',
      edit: 'op:production_work_order.edit',
      delete: 'op:production_work_order.edit',
      export: 'op:production_work_order.export',
      config: 'op:production_work_order.edit'
    }
  }
]

export const findProductionApp = (key) => {
  return PRODUCTION_APPS.find((app) => app.key === key)
}
