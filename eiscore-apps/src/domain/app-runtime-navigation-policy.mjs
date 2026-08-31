// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { LEGACY_BINDING_LABEL_MAP } from './app-runtime-workflow-policy.mjs'

export const resolveLegacyBusinessRoute = (bindingKey, businessKey) => {
  const key = String(bindingKey || '').trim()
  const rowKey = String(businessKey || '').trim()
  const isNumericKey = /^\d+$/.test(rowKey)

  if (key === 'legacy:hr_employee') {
    if (isNumericKey) return { path: `/hr/employee/detail/${rowKey}`, query: { appKey: 'a' } }
    return { path: '/hr/employee' }
  }
  if (key === 'legacy:hr_change') {
    if (isNumericKey) return { path: `/hr/employee/detail/${rowKey}`, query: { appKey: 'b' } }
    return { path: '/hr/app/b' }
  }
  if (key === 'legacy:hr_attendance') return { path: '/hr/app/c' }
  if (key === 'legacy:hr_user') return { path: '/hr/users' }
  if (key === 'legacy:mms_ledger') {
    if (isNumericKey) return { path: `/materials/material/detail/${rowKey}`, query: { appKey: 'a' } }
    return { path: '/materials/app/a' }
  }
  if (key === 'legacy:mms_inventory_ledger') return { path: '/materials/inventory-ledger' }
  if (key === 'legacy:mms_inventory_stock_in') return { path: '/materials/inventory-stock-in' }
  if (key === 'legacy:mms_inventory_stock_out') return { path: '/materials/inventory-stock-out' }
  if (key === 'legacy:mms_inventory_current') return { path: '/materials/inventory-current' }
  if (key === 'legacy:mms_bom') return { path: '/materials/bom' }
  if (key === 'legacy:sales_order') return { path: '/sales/app/orders' }
  if (key === 'legacy:purchase_demand') return { path: '/purchase/app/demands' }
  if (key === 'legacy:production_work_order') return { path: '/production/app/work_orders' }
  return null
}

export const toHostRoutePath = (path) => {
  const raw = String(path || '').trim()
  if (!raw) return ''
  const hostedPrefixes = [
    '/app/',
    '/workflow-designer/',
    '/flash-builder/',
    '/data-app/',
    '/config-center/',
    '/ontology-relations/'
  ]
  return hostedPrefixes.some((prefix) => raw.startsWith(prefix)) ? `/apps${raw}` : raw
}

export const buildEnterpriseTargetHref = (target, { hostPath = false } = {}) => {
  const rawPath = String(target?.path || '').trim()
  const path = hostPath ? toHostRoutePath(rawPath) : rawPath
  if (!path) return ''
  const queryObj = target?.query && typeof target.query === 'object' ? target.query : {}
  const query = new URLSearchParams(
    Object.entries(queryObj)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()
  return `${path}${query ? `?${query}` : ''}`
}

export const resolveBindingDisplayName = (binding, businessApps = []) => {
  const key = String(binding || '').trim()
  if (!key) return '业务处理'
  if (key.startsWith('legacy:')) return LEGACY_BINDING_LABEL_MAP[key] || '业务处理'
  const matched = (Array.isArray(businessApps) ? businessApps : [])
    .find((item) => String(item?.id || '').trim() === key)
  return String(matched?.name || '').trim() || '业务处理'
}

export const buildWorkflowRouteQuery = ({ row, definitionId, workflowAppId } = {}) => {
  const query = {}
  const instanceId = String(row?.id || '').trim()
  const businessKey = String(row?.business_key || '').trim()
  const taskId = String(row?.current_task_id || '').trim()
  const resolvedDefinitionId = String(row?.definition_id || definitionId || '').trim()
  const resolvedWorkflowAppId = String(workflowAppId || '').trim()
  if (instanceId) query.wf_instance = instanceId
  if (businessKey) query.wf_key = businessKey
  if (taskId) query.wf_task = taskId
  if (resolvedDefinitionId) query.wf_definition = resolvedDefinitionId
  if (resolvedWorkflowAppId) query.wf_app = resolvedWorkflowAppId
  query.wf_from = 'workflow_runtime'
  return query
}

const mergeTargetQuery = (target, workflowQuery) => ({
  ...target,
  query: {
    ...(target?.query && typeof target.query === 'object' ? target.query : {}),
    ...workflowQuery
  }
})

export const buildWorkflowOpenNavigationPlan = ({
  row,
  targetBinding,
  definitionId,
  workflowAppId
} = {}) => {
  const binding = String(targetBinding || '').trim()
  if (!binding) return null
  const workflowQuery = buildWorkflowRouteQuery({ row, definitionId, workflowAppId })
  if (binding.startsWith('legacy:')) {
    const legacy = resolveLegacyBusinessRoute(binding, row?.business_key)
    if (!legacy?.path) return null
    return { target: mergeTargetQuery(legacy, workflowQuery), allowCrossMicro: true }
  }
  return {
    target: { path: `/app/${binding}`, query: workflowQuery },
    allowCrossMicro: false
  }
}

export const buildWorkflowRecordNavigationPlan = ({
  row,
  targetBinding,
  recordId,
  boundDraftType,
  definitionId,
  workflowAppId
} = {}) => {
  const normalizedRecordId = String(recordId || '').trim()
  if (!normalizedRecordId) return null
  const binding = String(targetBinding || '').trim()
  const workflowQuery = buildWorkflowRouteQuery({ row, definitionId, workflowAppId })

  if (binding === 'legacy:mms_inventory_stock_in' || binding === 'legacy:mms_inventory_stock_out') {
    const draftType = String(boundDraftType || '').trim()
      || (binding === 'legacy:mms_inventory_stock_out' ? 'out' : 'in')
    return {
      target: {
        path: `/materials/inventory-draft/detail/${encodeURIComponent(normalizedRecordId)}`,
        query: { ...workflowQuery, draftType }
      },
      allowCrossMicro: true
    }
  }

  if (binding.startsWith('legacy:')) {
    const legacy = resolveLegacyBusinessRoute(binding, row?.business_key)
    if (legacy?.path) {
      return { target: mergeTargetQuery(legacy, workflowQuery), allowCrossMicro: true }
    }
  }

  if (!binding) return null
  return {
    target: {
      path: `/app/${binding}`,
      query: { ...workflowQuery, wf_row_id: normalizedRecordId }
    },
    allowCrossMicro: false
  }
}

export const buildWorkflowRecordTabKey = ({ row, recordId, workflowAppId } = {}) => (
  `${String(workflowAppId || '').trim() || 'workflow'}:${row?.id || ''}:${String(recordId || '').trim()}:record`
)
