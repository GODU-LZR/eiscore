// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { HR_APPS } from '@/utils/hr-apps'
import { MODULE_LABELS, OP_ACTION_LABELS, SIDEBAR_MODULE_KEYS, SIDEBAR_MODULE_LABELS } from '@/utils/permission-spec'

const ops = (key, actions = ['create', 'edit', 'delete', 'export', 'config']) => Object.fromEntries(
  actions.map((action) => [action, `op:${key}.${action}`])
)

// Keep this catalog dependency-free: HR is built as an independent qiankun app
// and cannot import the other apps' alias-based utility modules safely.
export const STATIC_APP_CATALOG = [
  ...HR_APPS.map(app => {
    const key = app.aclModule || app.key
    return {
      ...app,
      key,
      ops: {
        view: `op:${key}.view`,
        ...(key === 'hr_org' ? { delete: `op:${key}.delete` } : {}),
        ...(app.ops || {})
      }
    }
  }),
  { key: 'mms_ledger', name: '物料台账', perm: 'app:mms_ledger', ops: ops('mms_ledger', ['view', 'create', 'edit', 'delete', 'import', 'export', 'config', 'workflow_transition']) },
  { key: 'mms_batch_rule', name: '批次号规则', perm: 'app:mms_batch_rule', ops: ops('mms_batch_rule', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'mms_warehouse', name: '仓库管理', perm: 'app:mms_warehouse', ops: ops('mms_warehouse', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'mms_inventory', name: '库存台账', perm: 'app:mms_inventory', ops: ops('mms_inventory', ['view', 'create', 'edit', 'delete', 'import', 'export', 'config', 'stock_in', 'stock_out']) },
  { key: 'mms_dashboard', name: '库存大屏', perm: 'app:mms_dashboard', ops: ops('mms_dashboard', ['view']) },
  { key: 'mms_bom', name: '产品配方', perm: 'app:mms_bom', ops: ops('mms_bom', ['view', 'create', 'edit', 'delete', 'export']) },
  { key: 'production_plan', name: '生产建议', perm: 'app:production_plan', ops: ops('production_plan', ['view', 'export', 'config']) },
  { key: 'production_work_order', name: '生产工单', perm: 'app:production_work_order', ops: ops('production_work_order', ['view', 'create', 'edit', 'export']) },
  { key: 'quality_dashboard', name: '质量总览', perm: 'app:quality_dashboard', ops: ops('quality_dashboard', ['view']) },
  { key: 'quality_inspection', name: '检验台账', perm: 'app:quality_inspection', ops: ops('quality_inspection', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'quality_ncr', name: '质量异常', perm: 'app:quality_ncr', ops: ops('quality_ncr', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'quality_action', name: '整改任务', perm: 'app:quality_action', ops: ops('quality_action', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'quality_audit', name: '质量审核', perm: 'app:quality_audit', ops: ops('quality_audit', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'quality_standard', name: '检验标准', perm: 'app:quality_standard', ops: ops('quality_standard', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'equipment_dashboard', name: '设备总览', perm: 'app:equipment_dashboard', ops: ops('equipment_dashboard', ['view']) },
  { key: 'equipment_asset', name: '设备台账', perm: 'app:equipment_asset', ops: ops('equipment_asset', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'equipment_check', name: '点检记录', perm: 'app:equipment_check', ops: ops('equipment_check', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'equipment_issue', name: '设备异常', perm: 'app:equipment_issue', ops: ops('equipment_issue', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'equipment_work_order', name: '维保工单', perm: 'app:equipment_work_order', ops: ops('equipment_work_order', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'equipment_plan', name: '巡检计划', perm: 'app:equipment_plan', ops: ops('equipment_plan', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'equipment_standard', name: '保养标准', perm: 'app:equipment_standard', ops: ops('equipment_standard', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'sales_customer', name: '客户档案', perm: 'app:sales_customer', ops: ops('sales_customer', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'sales_follow_up', name: '客户跟进', perm: 'app:sales_follow_up', ops: ops('sales_follow_up', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'sales_opportunity', name: '销售商机', perm: 'app:sales_opportunity', ops: ops('sales_opportunity', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'sales_order', name: '销售订单', perm: 'app:sales_order', ops: ops('sales_order', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'sales_payment', name: '回款记录', perm: 'app:sales_payment', ops: ops('sales_payment', ['view', 'create', 'edit', 'delete', 'export', 'config']) },
  { key: 'sales_dashboard', name: '销售看板', perm: 'app:sales_dashboard', ops: ops('sales_dashboard', ['view']) },
  { key: 'sales_cockpit', name: '销售驾驶舱', perm: 'app:sales_cockpit', ops: ops('sales_cockpit', ['view']) },
  { key: 'purchase_dashboard', name: '采购驾驶舱', perm: 'app:purchase_dashboard', ops: ops('purchase_dashboard', ['view']) },
  { key: 'purchase_supplier', name: '供应商档案', perm: 'app:purchase_supplier', ops: ops('purchase_supplier', ['view', 'create', 'edit', 'delete', 'export', 'config', 'review', 'pause', 'resume']) },
  { key: 'purchase_demand', name: '采购需求', perm: 'app:purchase_demand', ops: ops('purchase_demand', ['view', 'create', 'edit', 'delete', 'export', 'config', 'create_order', 'submit', 'close', 'reopen']) },
  { key: 'purchase_order', name: '采购订单', perm: 'app:purchase_order', ops: ops('purchase_order', ['view', 'create', 'edit', 'delete', 'export', 'config', 'register_arrival', 'confirm', 'cancel']) },
  { key: 'purchase_arrival', name: '到货跟踪', perm: 'app:purchase_arrival', ops: ops('purchase_arrival', ['view', 'create', 'edit', 'delete', 'export', 'config', 'confirm_inbound', 'mark_exception']) }
]

export const AUXILIARY_OPERATION_CATALOG = [
  ['app_center', '应用中心', ['audit', 'config']],
  ['business_flow', '业务流程', ['view', 'reverse']],
  ['collector_device', '采集设备', ['manage']],
  ['document_intake', '文档采集', ['view', 'manage']],
  ['hr_payroll', '薪酬管理', ['view']],
  ['ontology_workbench', '本体工作台', ['config']]
].map(([key, name, actions]) => ({ key, name, ops: ops(key, actions) }))

const buildModulePermissions = () => {
  return SIDEBAR_MODULE_KEYS.map((key) => ({
    code: `module:${key}`,
    name: `模块-${SIDEBAR_MODULE_LABELS[key] || MODULE_LABELS[key] || key}`,
    module: '模块',
    action: '显示'
  }))
}

const buildAppPermissions = (apps) => {
  return apps
    .filter(app => app?.perm)
    .map((app) => ({
      code: app.perm,
      name: `应用-${app.name || app.perm}`,
      module: '应用',
      action: '进入'
    }))
}

const buildOpPermissions = (apps) => {
  const list = []
  apps.forEach((app) => {
    const ops = app?.ops || {}
    Object.values(ops).forEach((code) => {
      if (!code) return
      const parts = String(code).split(':')
      if (parts.length < 2) return
      const detail = parts.slice(1).join(':')
      const [appKey, actionKey] = detail.split('.')
      const actionLabel = OP_ACTION_LABELS[actionKey] || actionKey
      list.push({
        code,
        name: `${app.name || appKey}-${actionLabel}`,
        module: app.name || appKey,
        action: actionLabel
      })
    })
  })
  return list
}

export const buildPermissionPayload = () => {
  const apps = Array.isArray(STATIC_APP_CATALOG) ? STATIC_APP_CATALOG : []
  return [
    ...buildModulePermissions(),
    ...buildAppPermissions(apps),
    ...buildOpPermissions([...apps, ...AUXILIARY_OPERATION_CATALOG])
  ]
}
