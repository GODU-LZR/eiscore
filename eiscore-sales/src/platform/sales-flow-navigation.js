// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { navigateEnterprisePath } from '@eiscore/platform/navigation'

export const SALES_FLOW_TARGETS = Object.freeze({
  purchaseDemand: Object.freeze({
    path: '/purchase/app/demands',
    moduleName: '采购',
    pageName: '采购需求',
    tabTitle: '采购需求'
  }),
  shipmentRequest: Object.freeze({
    path: '/sales/app/shipment_requests',
    moduleName: '销售',
    pageName: '出货申请',
    tabTitle: '出货申请'
  }),
  salesOutbound: Object.freeze({
    path: '/materials/inventory-stock-out?ioType=销售出库',
    moduleName: '仓储',
    pageName: '销售出库',
    tabTitle: '销售出库'
  })
})

export function openSalesFlowTarget(targetId, {
  navigate = navigateEnterprisePath,
  onWarning = () => {},
  ...navigationOptions
} = {}) {
  const target = SALES_FLOW_TARGETS[targetId]
  if (!target) {
    const result = { ok: false, reason: 'unknown-sales-flow-target', moduleId: '', mode: 'none' }
    onWarning('未知业务页面，无法跳转。')
    return result
  }

  const result = navigate(target.path, {
    ...navigationOptions,
    tabTitle: target.tabTitle
  })
  if (!result.ok) {
    const message = result.reason === 'module-disabled'
      ? `${target.moduleName}模块未启用，无法打开${target.pageName}。`
      : `无法打开${target.pageName}，请稍后重试。`
    onWarning(message)
  }
  return result
}
