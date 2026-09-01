// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  isPurchaseArrivalPushable,
  isPurchaseDemandPushable,
  isPurchaseOrderPushable
} from './purchase-grid-flow-policy.js'

export const PURCHASE_FLOW_NEXT_STEPS = Object.freeze({
  DEMAND_TO_ORDER: 'purchase_order',
  ORDER_TO_ARRIVAL: 'purchase_arrival',
  ARRIVAL_TO_INBOUND: 'inventory_inbound'
})

export const buildPurchaseRowActions = ({
  appKey,
  row,
  canPushDemand = false,
  canPushOrder = false,
  canPushArrival = false
} = {}) => {
  if (!row) return []
  if (appKey === 'demands') {
    return canPushDemand && isPurchaseDemandPushable(row)
      ? [{
          key: 'push-demand-order',
          label: '下单',
          type: 'success',
          icon: 'Position',
          sopAction: 'purchase-row-push-demand-order',
          sopTitle: '单行需求下单',
          sopDesc: '把当前这一条采购需求下推为采购订单。',
          sopSteps: [
            '先确认当前行是要下单的采购需求。',
            '复核供应商、物料、数量、需求日期和需求状态。',
            '点击“下单”打开业务流转确认窗。',
            '确认后跳转采购订单并搜索新生成或已关联订单。'
          ],
          sopRisk: '单行下推仍会创建采购订单，不能用错供应商或数量。'
        }]
      : []
  }
  if (appKey === 'orders') {
    return canPushOrder && isPurchaseOrderPushable(row)
      ? [{
          key: 'push-order-arrival',
          label: '到货',
          type: 'success',
          icon: 'Position',
          sopAction: 'purchase-row-push-order-arrival',
          sopTitle: '单行订单到货',
          sopDesc: '把当前采购订单下推为到货跟踪记录。',
          sopSteps: [
            '先确认当前行是要跟踪到货的采购订单。',
            '复核订单号、供应商、物料、订单数量和预计到货日期。',
            '点击“到货”打开业务流转确认窗。',
            '确认后跳转到货跟踪并复核到货状态。'
          ],
          sopRisk: '错误下推会影响收货计划和后续质检。'
        }]
      : []
  }
  if (appKey === 'arrivals') {
    return canPushArrival && isPurchaseArrivalPushable(row)
      ? [{
          key: 'push-arrival-inbound',
          label: '入库',
          type: 'warning',
          icon: 'Box',
          sopAction: 'purchase-row-push-arrival-inbound',
          sopTitle: '单行到货入库',
          sopDesc: '把当前到货记录下推为采购入库。',
          sopSteps: [
            '先确认当前到货记录可以入库。',
            '复核到货数量、质检状态、批次、仓库和库位。',
            '点击“入库”打开业务流转确认窗。',
            '确认后跳转仓储入库，检查库存影响。'
          ],
          sopRisk: '入库会影响库存账，异常、不合格或数量未确认记录不能直接入库。'
        }]
      : []
  }
  return []
}

const FLOW_DIALOG_CONFIGS = Object.freeze({
  [PURCHASE_FLOW_NEXT_STEPS.DEMAND_TO_ORDER]: {
    mode: 'demands',
    emptyMessage: '请先在表格中选择要下推的采购需求',
    invalidMessage: '已下单、已关闭或已锁定的采购需求不能下推采购订单',
    permissionMessage: '当前账号没有下推采购订单权限'
  },
  [PURCHASE_FLOW_NEXT_STEPS.ORDER_TO_ARRIVAL]: {
    mode: 'orders',
    emptyMessage: '请先在表格中选择要下推的采购订单',
    invalidMessage: '该采购订单当前状态不能登记到货',
    permissionMessage: '当前账号没有登记到货权限'
  },
  [PURCHASE_FLOW_NEXT_STEPS.ARRIVAL_TO_INBOUND]: {
    mode: 'arrivals',
    emptyMessage: '请先在表格中选择要下推入库的到货单',
    invalidMessage: '该到货单已入库、异常或不合格，不能直接入库',
    permissionMessage: '当前账号没有确认采购入库权限'
  }
})

export const getPurchaseFlowDialogConfig = (nextStep) => FLOW_DIALOG_CONFIGS[nextStep] || null

export const buildPurchaseToolbarFlowPlan = ({ nextStep, rows } = {}) => {
  const config = getPurchaseFlowDialogConfig(nextStep)
  const selection = Array.isArray(rows) ? rows : []
  if (!config) return { ok: false, message: '请选择要下推的下一流程' }
  if (!selection.length) return { ok: false, message: config.emptyMessage }
  if (nextStep === PURCHASE_FLOW_NEXT_STEPS.DEMAND_TO_ORDER && selection.some((row) => !isPurchaseDemandPushable(row))) {
    return { ok: false, message: config.invalidMessage }
  }
  return { ok: true, nextStep, mode: config.mode, rows: selection }
}

export const buildPurchaseRowFlowPlan = ({ nextStep, row, permitted } = {}) => {
  const config = getPurchaseFlowDialogConfig(nextStep)
  if (!config || !row) return { ok: false, silent: true }
  if (!permitted) return { ok: false, message: config.permissionMessage }
  let pushable = false
  if (nextStep === PURCHASE_FLOW_NEXT_STEPS.DEMAND_TO_ORDER) pushable = isPurchaseDemandPushable(row)
  if (nextStep === PURCHASE_FLOW_NEXT_STEPS.ORDER_TO_ARRIVAL) pushable = isPurchaseOrderPushable(row)
  if (nextStep === PURCHASE_FLOW_NEXT_STEPS.ARRIVAL_TO_INBOUND) pushable = isPurchaseArrivalPushable(row)
  if (!pushable) return { ok: false, message: config.invalidMessage }
  return { ok: true, nextStep, mode: config.mode, rows: [row] }
}

export const getPurchaseFlowNextStepForAction = (actionKey) => ({
  'push-demand-order': PURCHASE_FLOW_NEXT_STEPS.DEMAND_TO_ORDER,
  'push-order-arrival': PURCHASE_FLOW_NEXT_STEPS.ORDER_TO_ARRIVAL,
  'push-arrival-inbound': PURCHASE_FLOW_NEXT_STEPS.ARRIVAL_TO_INBOUND
})[actionKey] || ''

export const getPurchaseFlowPermission = ({ nextStep, canPushDemand, canPushOrder, canPushArrival } = {}) => {
  if (nextStep === PURCHASE_FLOW_NEXT_STEPS.DEMAND_TO_ORDER) return Boolean(canPushDemand)
  if (nextStep === PURCHASE_FLOW_NEXT_STEPS.ORDER_TO_ARRIVAL) return Boolean(canPushOrder)
  if (nextStep === PURCHASE_FLOW_NEXT_STEPS.ARRIVAL_TO_INBOUND) return Boolean(canPushArrival)
  return false
}

export const parsePurchaseRealtimePayload = (event) => {
  if (!event) return null
  if (event.payload && typeof event.payload === 'string') {
    try {
      return JSON.parse(event.payload)
    } catch {
      return null
    }
  }
  return event.payload && typeof event.payload === 'object' ? event.payload : null
}

export const shouldReloadPurchaseRealtimeEvent = (event, apiUrl) => {
  const payload = parsePurchaseRealtimePayload(event)
  if (!payload) return false
  const tableName = String(apiUrl || '').replace(/^\//, '').split('?')[0]
  return payload.schema === 'public' && payload.table === tableName
}
