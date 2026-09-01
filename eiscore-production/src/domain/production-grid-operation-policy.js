// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const WORK_ORDER_EDIT_ACTION = Object.freeze({
  key: 'edit-work-order',
  label: '处理',
  type: 'primary',
  icon: 'Edit',
  title: '处理生产工单',
  sopAction: 'production-row-edit-work-order',
  sopTitle: '单行处理生产工单',
  sopDesc: '打开当前生产工单的处理抽屉。',
  sopSteps: [
    '确认当前行是要处理的生产工单。',
    '点击“处理”打开工单处理抽屉。',
    '复核工单状态、优先级、计划数量、开始日期和完成日期。',
    '保存后检查表格关注等级、工单状态和计划日期是否正确。'
  ],
  sopRisk: '工单状态会影响领料、生产检验和入库，不要误改其他工单。'
})

const WORK_ORDER_PUSH_ACTION = Object.freeze({
  key: 'push-work-order',
  label: '下推',
  type: 'success',
  icon: 'Position',
  title: '下推生产检验或生产入库',
  sopAction: 'production-row-push-work-order',
  sopTitle: '单行生产工单下推',
  sopDesc: '把当前生产工单下推到生产检验或生产入库。',
  sopSteps: [
    '确认当前行是要流转的生产工单。',
    '复核工单状态、数量、完工情况和质量要求。',
    '点击“下推”打开业务流转确认窗。',
    '选择下一环节并确认，跳转后复核生成单据。'
  ],
  sopRisk: '未生产、未检验或数量错误的工单不能直接下推。'
})

const ISSUE_EDIT_ACTION = Object.freeze({
  key: 'edit-issue',
  label: '领料',
  type: 'primary',
  icon: 'Edit',
  title: '登记生产领料',
  sopAction: 'production-row-register-issue',
  sopTitle: '单行登记领料',
  sopDesc: '登记当前工单用料明细的实际领料情况。',
  sopSteps: [
    '确认当前行是要领料的物料明细。',
    '复核物料编码、需求数量、已领数量和库存情况。',
    '点击“领料”打开登记抽屉。',
    '填写本次领料数量和备注，保存后复核缺料数量。'
  ],
  sopRisk: '领料数量会影响库存和成本，不能登记到错误物料或错误工单。'
})

const ISSUE_PUSH_ACTION = Object.freeze({
  key: 'push-issue',
  label: '下推',
  type: 'warning',
  icon: 'Position',
  title: '下推生产领料出库',
  sopAction: 'production-row-push-issue-outbound',
  sopTitle: '单行领料下推出库',
  sopDesc: '把当前工单用料明细下推到仓储出库。',
  sopSteps: [
    '确认当前行是要出库的领料明细。',
    '复核物料、需求数量、已领数量、仓库和批次。',
    '点击“下推”打开业务流转确认窗。',
    '确认后跳转仓储出库，复核出库单和库存影响。'
  ],
  sopRisk: '出库会影响库存账，缺料或批次不清时不要直接下推。'
})

const cloneAction = (action) => ({ ...action, sopSteps: [...action.sopSteps] })

export const buildProductionRowActions = ({
  row,
  appKey,
  canEditRows,
  canPushWorkOrder,
  canPushIssue
} = {}) => {
  if (!row) return []
  if (appKey === 'work_orders') {
    return [
      ...(canEditRows ? [cloneAction(WORK_ORDER_EDIT_ACTION)] : []),
      ...(canPushWorkOrder ? [cloneAction(WORK_ORDER_PUSH_ACTION)] : [])
    ]
  }
  if (appKey === 'work_order_items') {
    return [
      ...(canEditRows ? [cloneAction(ISSUE_EDIT_ACTION)] : []),
      ...(canPushIssue ? [cloneAction(ISSUE_PUSH_ACTION)] : [])
    ]
  }
  return []
}

export const formatProductionDateInput = (value) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export const buildProductionWorkOrderForm = (row = {}) => ({
  work_order_status: row.work_order_status || '待排产',
  priority: row.priority || '普通',
  planned_qty: Number(row.planned_qty || 0),
  unit: row.unit || '',
  planned_start_date: formatProductionDateInput(row.planned_start_date),
  planned_finish_date: formatProductionDateInput(row.planned_finish_date),
  remark: row.remark || ''
})

export const buildProductionIssueForm = (row = {}) => ({
  issued_qty: Number(row.issued_qty || 0),
  shortage_qty: Number(row.shortage_qty || 0),
  issue_status: row.issue_status || '未领料',
  remark: row.remark || ''
})

export const calculateProductionIssueShortage = (requiredQty, issuedQty) => {
  const required = Number(requiredQty || 0)
  const issued = Number(issuedQty || 0)
  return Math.max(required - issued, 0)
}

export const inferProductionIssueStatus = (issuedQty, requiredQty) => {
  const issued = Number(issuedQty || 0)
  const required = Number(requiredQty || 0)
  if (required > 0 && issued >= required) return '已齐套'
  if (issued > 0) return '部分领料'
  return '未领料'
}

export const buildProductionWorkOrderSavePayload = (form = {}) => ({
  work_order_status: form.work_order_status || '待排产',
  priority: form.priority || '普通',
  planned_qty: Number(form.planned_qty || 0),
  unit: form.unit || '盒',
  planned_start_date: form.planned_start_date || null,
  planned_finish_date: form.planned_finish_date || null,
  remark: form.remark || null
})

export const buildProductionIssueSavePayload = ({ form = {}, requiredQty, shortageQty } = {}) => ({
  issued_qty: Number(form.issued_qty || 0),
  shortage_qty: Number(shortageQty || 0),
  issue_status: form.issue_status || inferProductionIssueStatus(form.issued_qty, requiredQty),
  remark: form.remark || null
})

export const buildProductionIssuePushRow = (row = {}, payload = {}) => ({
  ...row,
  ...payload,
  properties: {
    ...(row.properties || {}),
    issued_qty: payload.issued_qty,
    issue_status: payload.issue_status
  }
})
