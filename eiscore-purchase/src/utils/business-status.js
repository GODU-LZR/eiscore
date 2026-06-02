// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const EMPTY_POLICY = Object.freeze({
  rowStatusField: 'status',
  bizStatusField: '',
  auditStatusField: '',
  workflowStatusField: '',
  readonlyFields: [],
  editableFields: [],
  locked: false
})

export const PURCHASE_STATUS_REGISTRY = Object.freeze({
  suppliers: {
    rowStatusField: 'status',
    bizStatusField: 'supplier_status',
    auditStatusField: 'properties.audit_status',
    workflowStatusField: 'properties.workflow_status',
    lockedStatuses: ['暂停合作', 'disabled', 'locked'],
    editableWhenLocked: ['last_review_at', 'remark', 'properties.pause_reason'],
    fieldPolicies: {
      待评审: { readonlyFields: ['supplier_no', 'last_review_at'] },
      合作中: { readonlyFields: ['supplier_no'] },
      暂停合作: { readonlyFields: ['*'], editableFields: ['properties.pause_reason', 'remark'] }
    }
  },
  demands: {
    rowStatusField: 'status',
    bizStatusField: 'demand_status',
    auditStatusField: 'properties.audit_status',
    workflowStatusField: 'properties.workflow_status',
    lockedStatuses: ['已下单', '已关闭', 'disabled', 'locked'],
    editableWhenLocked: ['remark', 'preferred_supplier', 'properties.reverse_audit_reason'],
    fieldPolicies: {
      草稿: { readonlyFields: ['demand_no'] },
      待采购: { readonlyFields: ['demand_no'] },
      已下单: { readonlyFields: ['*'], editableFields: ['remark', 'properties.reverse_audit_reason'] },
      已关闭: { readonlyFields: ['*'], editableFields: ['remark', 'properties.close_reason'] }
    }
  },
  orders: {
    rowStatusField: 'status',
    bizStatusField: 'order_status',
    auditStatusField: 'properties.audit_status',
    workflowStatusField: 'properties.workflow_status',
    lockedStatuses: ['已下单', '部分到货', '已完成', '已取消', 'disabled', 'locked'],
    editableWhenLocked: ['expected_arrival_date', 'buyer_name', 'properties.delivery_risk', 'properties.reverse_audit_reason'],
    fieldPolicies: {
      草稿: { readonlyFields: ['order_no', 'source_demand_no', 'arrived_quantity', 'pending_quantity', 'arrival_progress'] },
      已下单: {
        readonlyFields: ['order_no', 'source_demand_no', 'supplier_name', 'material_name', 'quantity', 'unit', 'unit_price', 'total_amount'],
        editableFields: ['expected_arrival_date', 'buyer_name', 'properties.delivery_risk']
      },
      部分到货: {
        readonlyFields: ['*'],
        editableFields: ['expected_arrival_date', 'buyer_name', 'properties.delivery_risk']
      },
      已完成: { readonlyFields: ['*'], editableFields: ['properties.reverse_audit_reason'] },
      已取消: { readonlyFields: ['*'], editableFields: ['properties.cancel_reason'] }
    }
  },
  arrivals: {
    rowStatusField: 'status',
    bizStatusField: 'arrival_status',
    auditStatusField: 'properties.audit_status',
    workflowStatusField: 'properties.workflow_status',
    lockedStatuses: ['已入库', '异常', 'disabled', 'locked'],
    editableWhenLocked: ['properties.exception_note', 'properties.reverse_audit_reason'],
    fieldPolicies: {
      待到货: { readonlyFields: ['arrival_no', 'inbound_no'] },
      待检验: { readonlyFields: ['arrival_no', 'order_no', 'supplier_name', 'material_name', 'unit', 'inbound_no'] },
      已入库: { readonlyFields: ['*'], editableFields: ['properties.reverse_audit_reason'] },
      异常: { readonlyFields: ['*'], editableFields: ['properties.exception_note'] }
    }
  }
})

export const getByPath = (source, path) => {
  if (!source || !path) return undefined
  if (Object.prototype.hasOwnProperty.call(source, path)) return source[path]
  return String(path).split('.').reduce((current, part) => {
    if (current === null || current === undefined) return undefined
    return current[part]
  }, source)
}

const normalizeFieldKey = (field) => String(field || '').replace(/^properties\./, '')

const matchesField = (configured, field) => {
  if (!configured || !field) return false
  if (configured === '*') return true
  if (configured === field) return true
  return normalizeFieldKey(configured) === normalizeFieldKey(field)
}

const includesField = (fields, field) => (
  Array.isArray(fields) && fields.some((item) => matchesField(item, field))
)

export const resolveBusinessStatusPolicy = (appKey, row = {}) => {
  const config = PURCHASE_STATUS_REGISTRY[appKey] || null
  if (!config) return { ...EMPTY_POLICY }
  const bizStatus = getByPath(row, config.bizStatusField) || ''
  const rowStatus = getByPath(row, config.rowStatusField) || ''
  const auditStatus = getByPath(row, config.auditStatusField) || ''
  const workflowStatus = getByPath(row, config.workflowStatusField) || ''
  const statePolicy = config.fieldPolicies?.[bizStatus] || {}
  const lockSource = [bizStatus, rowStatus, auditStatus, workflowStatus].map((value) => String(value || ''))
  const reverseEditable = auditStatus === '已反审核'
  const locked = !reverseEditable && lockSource.some((value) => (config.lockedStatuses || []).includes(value))

  return {
    rowStatusField: config.rowStatusField,
    bizStatusField: config.bizStatusField,
    auditStatusField: config.auditStatusField,
    workflowStatusField: config.workflowStatusField,
    bizStatus,
    rowStatus,
    auditStatus,
    workflowStatus,
    readonlyFields: statePolicy.readonlyFields || [],
    editableFields: [
      ...(statePolicy.editableFields || []),
      ...((locked || reverseEditable) ? (config.editableWhenLocked || []) : [])
    ],
    locked,
    reverseEditable
  }
}

export const canEditPurchaseField = (appKey, row, field) => {
  if (!field || String(field).startsWith('_')) return true
  const policy = resolveBusinessStatusPolicy(appKey, row)
  if (!policy.bizStatusField) return true
  if (includesField(policy.editableFields, field)) return true
  if (includesField(policy.readonlyFields, '*') || includesField(policy.readonlyFields, field)) return false
  if (policy.locked) return false
  return true
}

export const applyPurchaseColumnPolicies = (appKey, columns = []) => (
  (Array.isArray(columns) ? columns : []).map((col) => ({
    ...col,
    statusEditable: (row) => canEditPurchaseField(appKey, row, col.prop)
  }))
)
