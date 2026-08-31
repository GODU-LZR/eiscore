// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const WORKFLOW_TABLE_ALIASES = {
  archives: 'hr.archives',
  hr_archives: 'hr.archives',
  employee_changes: 'hr.employee_changes',
  attendance_records: 'hr.attendance_records',
  users: 'public.users',
  raw_materials: 'public.raw_materials',
  inventory_drafts: 'scm.inventory_drafts',
  production_work_orders: 'scm.production_work_orders',
  sales_orders: 'public.sales_orders',
  purchase_demands: 'public.purchase_demands'
}

const WORKFLOW_TABLE_BINDINGS = {
  'hr.archives': 'legacy:hr_employee',
  'hr.employee_changes': 'legacy:hr_change',
  'hr.attendance_records': 'legacy:hr_attendance',
  'public.users': 'legacy:hr_user',
  'public.raw_materials': 'legacy:mms_ledger',
  'scm.inventory_drafts': 'legacy:mms_inventory_stock_in',
  'scm.production_work_orders': 'legacy:production_work_order',
  'public.sales_orders': 'legacy:sales_order',
  'public.purchase_demands': 'legacy:purchase_demand'
}

export const normalizeAiWorkflowAssociatedTable = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withoutApi = raw.replace(/^\/api\//, '').replace(/^\/api/, '').replace(/^\//, '')
  const table = withoutApi.includes('?') ? withoutApi.split('?')[0] : withoutApi
  const normalized = table.replace(/\//g, '.').trim()
  if (!normalized) return ''
  const lower = normalized.toLowerCase()
  if (WORKFLOW_TABLE_ALIASES[lower]) return WORKFLOW_TABLE_ALIASES[lower]
  if (normalized.includes('.')) return normalized
  return WORKFLOW_TABLE_ALIASES[lower] || `public.${normalized}`
}

export const resolveAiWorkflowAssociatedTable = (meta = {}, context = {}) => {
  const raw = meta?.associated_table || meta?.associatedTable || ''
  if (raw) return normalizeAiWorkflowAssociatedTable(raw)
  const fallback = context?.workflowAssociatedTable || context?.associatedTable || ''
  if (fallback) return normalizeAiWorkflowAssociatedTable(fallback)
  const apiUrl = context?.apiUrl || context?.importTarget?.apiUrl || ''
  if (!apiUrl) return ''
  const cleaned = String(apiUrl).replace(/^\/api/, '').replace(/^\//, '')
  return cleaned ? normalizeAiWorkflowAssociatedTable(`public.${cleaned}`) : ''
}

export const normalizeAiWorkflowList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/[,\s，、;；]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export const normalizeAiWorkflowBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y', '是', '需要'].includes(text)) return true
    if (['false', '0', 'no', 'n', '否', '不需要'].includes(text)) return false
  }
  return fallback
}

export const toAiWorkflowArray = (value) => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => (
      item && typeof item === 'object'
        ? { ...item, task_id: item.task_id || item.taskId || item.bpmn_task_id || key }
        : { task_id: key, value: item }
    ))
  }
  return []
}

export const normalizeAiWorkflowBindingValue = (value, associatedTable = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('legacy:')) return raw
  if (raw.startsWith('table:')) {
    const table = normalizeAiWorkflowAssociatedTable(raw.slice('table:'.length))
    return table ? `table:${table}` : ''
  }
  const table = normalizeAiWorkflowAssociatedTable(raw)
  return WORKFLOW_TABLE_BINDINGS[table] || raw
}

export const inferAiWorkflowBusinessAppId = (meta = {}, associatedTable = '') => {
  const explicit = meta.workflowBusinessAppId
    || meta.workflow_business_app_id
    || meta.business_app_id
    || meta.businessAppId
    || meta.binding
  if (explicit) return normalizeAiWorkflowBindingValue(explicit, associatedTable)
  const table = normalizeAiWorkflowAssociatedTable(associatedTable)
  return WORKFLOW_TABLE_BINDINGS[table] || (table ? `table:${table}` : '')
}

export const normalizeAiWorkflowTaskBindings = (meta = {}, globalBinding = '') => {
  const source = meta.workflowTaskBusinessAppBindings
    || meta.workflow_task_business_app_bindings
    || meta.task_business_app_bindings
    || meta.taskBusinessAppBindings
    || {}
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const next = {}
  Object.entries(source).forEach(([taskId, binding]) => {
    const key = String(taskId || '').trim()
    const value = normalizeAiWorkflowBindingValue(binding)
    if (key && value && value !== globalBinding) next[key] = value
  })
  return next
}

const buildProfileHeaders = (profile, prefer = '') => {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Profile': profile,
    'Content-Profile': profile
  }
  if (prefer) headers.Prefer = prefer
  return headers
}

export const getAiWorkflowProfileHeaders = (prefer = '') => buildProfileHeaders('workflow', prefer)

export const getAiPublicProfileHeaders = (prefer = '') => buildProfileHeaders('public', prefer)

export const getAiAppCenterProfileHeaders = (prefer = '') => buildProfileHeaders('app_center', prefer)

export const getAiFirstRow = (data) => (Array.isArray(data) ? (data[0] || null) : (data || null))

export const buildAiWorkflowAclModule = (appId) => {
  const raw = String(appId || '').replace(/-/g, '').trim()
  return raw ? `app_${raw}` : ''
}

export const buildAiWorkflowOps = (moduleKey) => {
  if (!moduleKey) return {}
  return {
    create: `op:${moduleKey}.create`,
    edit: `op:${moduleKey}.edit`,
    delete: `op:${moduleKey}.delete`,
    export: `op:${moduleKey}.export`,
    config: `op:${moduleKey}.config`,
    workflowStart: `op:${moduleKey}.workflow_start`,
    workflowTransition: `op:${moduleKey}.workflow_transition`,
    workflowComplete: `op:${moduleKey}.workflow_complete`
  }
}

export const normalizeAiWorkflowAssignmentRows = (meta = {}, definitionId) => {
  const source = meta.task_assignments || meta.taskAssignments || meta.assignments || []
  return toAiWorkflowArray(source)
    .map((item) => {
      const taskId = String(item?.task_id || item?.taskId || item?.bpmn_task_id || item?.id || '').trim()
      if (!taskId) return null
      const approvalMode = String(item?.approval_mode || item?.approvalMode || 'any').trim().toLowerCase()
      const requiredApprovals = Number(item?.required_approvals || item?.requiredApprovals || 1)
      return {
        definition_id: definitionId,
        task_id: taskId,
        candidate_roles: normalizeAiWorkflowList(item?.candidate_roles || item?.candidateRoles || item?.roles),
        candidate_users: normalizeAiWorkflowList(item?.candidate_users || item?.candidateUsers || item?.users),
        approval_mode: ['any', 'quota', 'all'].includes(approvalMode) ? approvalMode : 'any',
        required_approvals: Number.isFinite(requiredApprovals) && requiredApprovals > 0 ? Math.floor(requiredApprovals) : 1,
        require_comment: normalizeAiWorkflowBool(item?.require_comment ?? item?.requireComment, false)
      }
    })
    .filter(Boolean)
}

export const normalizeAiWorkflowStateMappingRows = (meta = {}, workflowAppId, associatedTable = '') => {
  const source = meta.state_mappings || meta.stateMappings || meta.workflow_state_mappings || meta.workflowStateMappings || []
  const fallbackTable = normalizeAiWorkflowAssociatedTable(associatedTable)
  return toAiWorkflowArray(source)
    .map((item) => {
      const taskId = String(item?.bpmn_task_id || item?.bpmnTaskId || item?.task_id || item?.taskId || item?.id || '').trim()
      const stateValue = String(item?.state_value ?? item?.stateValue ?? item?.status ?? item?.value ?? '').trim()
      if (!taskId || !stateValue) return null
      const targetTable = normalizeAiWorkflowAssociatedTable(item?.target_table || item?.targetTable || item?.table || fallbackTable)
      return {
        workflow_app_id: workflowAppId,
        bpmn_task_id: taskId,
        target_table: targetTable || fallbackTable || null,
        state_field: String(item?.state_field || item?.stateField || 'status').trim() || 'status',
        state_value: stateValue
      }
    })
    .filter((item) => item && item.target_table)
}
