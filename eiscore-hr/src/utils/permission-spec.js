// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

// 权限点规范：module / app / op / field
// code 是唯一事实来源；module/action 仅用于展示或分类

export const MODULE_LABELS = {
  home: '首页',
  hr: '人事',
  mms: '物料',
  materials: '物料管理',
  app: '应用中心',
  apps: '应用中心',
  sales: '销售管理',
  purchase: '采购管理',
  production: '生产管理',
  quality: '质量管理',
  equipment: '设备管理',
  decision: '决策支持',
  'company-site': '企业站点运营',
  company_site: '企业站点运营',
  bi: '智能 BI'
}

// The module matrix follows the top-level sidebar. Legacy aliases remain in
// MODULE_LABELS so existing grants can still be rendered and checked, but are
// not seeded as separate module permissions.
export const SIDEBAR_MODULE_KEYS = Object.freeze([
  'home', 'mms', 'hr', 'app', 'company-site', 'sales', 'purchase',
  'production', 'quality', 'equipment', 'decision'
])

export const SIDEBAR_MODULE_LABELS = Object.freeze({
  home: '工作台',
  mms: '仓储管理',
  hr: '人事管理',
  app: '应用中心',
  'company-site': '企业站点运营',
  sales: '销售管理',
  purchase: '采购管理',
  production: '生产管理',
  quality: '质量管理',
  equipment: '设备管理',
  decision: '决策支持'
})

export const APP_LABELS = {
  hr_employee: '人事花名册',
  hr_org: '部门架构',
  hr_attendance: '考勤管理',
  hr_change: '调岗记录',
  hr_acl: '权限管理',
  hr_user: '用户管理',
  mms_ledger: '物料台账',
  mms_batch_rule: '批次号规则',
  mms_warehouse: '仓库管理',
  mms_inventory: '库存台账',
  mms_dashboard: '库存大屏',
  mms_bom: '产品配方',
  production_plan: '生产建议',
  production_work_order: '生产工单',
  quality_dashboard: '质量总览',
  quality_inspection: '检验台账',
  quality_ncr: '质量异常',
  quality_action: '整改任务',
  quality_audit: '质量审核',
  quality_standard: '检验标准',
  equipment_dashboard: '设备总览',
  equipment_asset: '设备台账',
  equipment_check: '点检记录',
  equipment_issue: '设备异常',
  equipment_work_order: '维保工单',
  equipment_plan: '巡检计划',
  equipment_standard: '保养标准',
  sales_customer: '客户档案',
  sales_follow_up: '客户跟进',
  sales_opportunity: '销售商机',
  sales_order: '销售订单',
  sales_payment: '回款记录',
  sales_dashboard: '销售看板',
  sales_cockpit: '销售驾驶舱',
  purchase_dashboard: '采购驾驶舱',
  purchase_supplier: '供应商档案',
  purchase_demand: '采购需求',
  purchase_order: '采购订单',
  purchase_arrival: '到货跟踪'
}

export const OP_ACTION_LABELS = {
  view: '查看',
  create: '新增',
  edit: '编辑',
  delete: '删除',
  import: '导入',
  export: '导出',
  config: '配置',
  save_layout: '保存布局',
  member_manage: '成员管理',
  shift_manage: '班次管理',
  shift_create: '班次新增',
  stock_in: '入库',
  stock_out: '出库',
  workflow_start: '流程发起',
  workflow_transition: '流程流转',
  workflow_complete: '流程完结',
  status_transition: '状态变更',
  review: '审核',
  pause: '暂停',
  resume: '恢复',
  create_order: '生成订单',
  submit: '提交',
  close: '关闭',
  reopen: '重新打开',
  register_arrival: '登记到货',
  confirm: '确认',
  cancel: '取消',
  confirm_inbound: '确认入库',
  mark_exception: '标记异常',
  reverse: '反向处理',
  audit: '审计'
}

export const PERMISSION_MODULE_OPTIONS = [
  { label: '模块', value: '模块' },
  { label: '应用', value: '应用' },
  { label: MODULE_LABELS.app, value: MODULE_LABELS.app },
  { label: APP_LABELS.hr_employee, value: APP_LABELS.hr_employee },
  { label: APP_LABELS.hr_org, value: APP_LABELS.hr_org },
  { label: APP_LABELS.hr_attendance, value: APP_LABELS.hr_attendance },
  { label: APP_LABELS.hr_change, value: APP_LABELS.hr_change },
  { label: APP_LABELS.hr_acl, value: APP_LABELS.hr_acl },
  { label: APP_LABELS.hr_user, value: APP_LABELS.hr_user },
  ...Object.entries(APP_LABELS)
    .filter(([key]) => !['hr_employee', 'hr_org', 'hr_attendance', 'hr_change', 'hr_acl', 'hr_user', 'mms_ledger'].includes(key))
    .map(([key, label]) => ({ label, value: label }))
]

export const PERMISSION_ACTION_OPTIONS = [
  { label: '显示', value: '显示' },
  { label: '进入', value: '进入' },
  { label: '查看', value: '查看' },
  { label: '新增', value: '新增' },
  { label: '编辑', value: '编辑' },
  { label: '删除', value: '删除' },
  { label: '导入', value: '导入' },
  { label: '导出', value: '导出' },
  { label: '配置', value: '配置' },
  { label: '保存布局', value: '保存布局' },
  { label: '班次管理', value: '班次管理' },
  { label: '班次新增', value: '班次新增' },
  { label: '成员管理', value: '成员管理' }
  ,{ label: '入库', value: '入库' }
  ,{ label: '出库', value: '出库' }
  ,{ label: '审核', value: '审核' }
  ,{ label: '提交', value: '提交' }
  ,{ label: '确认', value: '确认' }
  ,{ label: '取消', value: '取消' }
  ,{ label: '流程流转', value: '流程流转' }
]

export const buildModulePerm = (key) => `module:${key}`
export const buildAppPerm = (key) => `app:${key}`
export const buildOpPerm = (appKey, actionKey) => `op:${appKey}.${actionKey}`
export const buildFieldPerm = (appKey, fieldKey, actionKey) => `field:${appKey}.${fieldKey}.${actionKey}`

export const parsePermissionCode = (code) => {
  if (!code || typeof code !== 'string') return null
  const parts = code.split(':')
  if (parts.length < 2) return null
  const scope = parts[0]
  const detail = parts.slice(1).join(':')
  if (scope === 'module') return { scope, key: detail }
  if (scope === 'app') return { scope, key: detail }
  if (scope === 'op') {
    const [appKey, actionKey] = detail.split('.')
    return { scope, appKey, actionKey }
  }
  if (scope === 'field') {
    const segs = detail.split('.')
    const appKey = segs[0]
    const actionKey = segs[segs.length - 1]
    const fieldKey = segs.slice(1, -1).join('.')
    return { scope, appKey, fieldKey, actionKey }
  }
  return { scope, key: detail }
}

export const formatPermissionName = (code, fallback) => {
  const parsed = parsePermissionCode(code)
  if (!parsed) return fallback || code
  if (parsed.scope === 'module') {
    return `模块-${MODULE_LABELS[parsed.key] || parsed.key}`
  }
  if (parsed.scope === 'app') {
    return `应用-${APP_LABELS[parsed.key] || parsed.key}`
  }
  if (parsed.scope === 'op') {
    const appName = APP_LABELS[parsed.appKey] || parsed.appKey
    const actionName = OP_ACTION_LABELS[parsed.actionKey] || parsed.actionKey
    return `${appName}-${actionName}`
  }
  if (parsed.scope === 'field') {
    const appName = APP_LABELS[parsed.appKey] || parsed.appKey
    const actionName = OP_ACTION_LABELS[parsed.actionKey] || parsed.actionKey
    return `${appName}-${parsed.fieldKey}-${actionName}`
  }
  return fallback || code
}
