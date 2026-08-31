// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const WORKFLOW_STATUS_ORDER = Object.freeze(['created', 'active', 'locked'])

const WORKFLOW_STATE_LABEL_MAP = Object.freeze({
  created: '创建',
  active: '生效',
  locked: '锁定'
})

const WORKFLOW_STATE_UI_MAP = Object.freeze({
  created: { tagType: 'info', color: '#909399' },
  active: { tagType: 'success', color: '#67c23a' },
  locked: { tagType: 'danger', color: '#f56c6c' }
})

const APPROVAL_MODE_LABEL_MAP = Object.freeze({
  any: '单人通过',
  quota: '多人会签',
  all: '全员会签'
})

const WORKFLOW_STATE_CANONICAL_MAP = Object.freeze({
  created: 'created',
  draft: 'created',
  '创建': 'created',
  '新建': 'created',
  active: 'active',
  enabled: 'active',
  '生效': 'active',
  '启用': 'active',
  locked: 'locked',
  disabled: 'locked',
  '锁定': 'locked',
  '禁用': 'locked'
})

export const LEGACY_BINDING_LABEL_MAP = Object.freeze({
  'legacy:hr_employee': '人事花名册（HR）',
  'legacy:hr_user': '用户管理（HR）',
  'legacy:hr_attendance': '考勤管理（HR）',
  'legacy:hr_change': '调岗记录（HR）',
  'legacy:mms_ledger': '物料台账（MMS）',
  'legacy:mms_inventory_ledger': '库存台账（MMS）',
  'legacy:mms_inventory_stock_in': '入库（MMS）',
  'legacy:mms_inventory_stock_out': '出库（MMS）',
  'legacy:mms_inventory_current': '库存查询（MMS）',
  'legacy:mms_bom': 'BOM管理（MMS）',
  'legacy:sales_order': '销售订单',
  'legacy:purchase_demand': '采购需求',
  'legacy:production_work_order': '生产工单'
})

export const LEGACY_TABLE_BINDING_MAP = Object.freeze({
  'hr.archives': 'legacy:hr_employee',
  'hr.attendance_records': 'legacy:hr_attendance',
  'public.users': 'legacy:hr_user',
  'public.raw_materials': 'legacy:mms_ledger',
  'public.sales_orders': 'legacy:sales_order',
  'public.purchase_demands': 'legacy:purchase_demand',
  'scm.boms': 'legacy:mms_bom',
  'scm.inventory_transactions': 'legacy:mms_inventory_ledger',
  'scm.v_inventory_current': 'legacy:mms_inventory_current',
  'scm.production_work_orders': 'legacy:production_work_order'
})

export const LEGACY_BINDING_STATE_TARGET_MAP = Object.freeze({
  'legacy:hr_employee': { target_table: 'hr.archives', state_field: 'status' },
  'legacy:hr_user': { target_table: 'public.users', state_field: 'status' },
  'legacy:hr_attendance': { target_table: 'hr.attendance_records', state_field: 'status' },
  'legacy:hr_change': { target_table: 'hr.employee_changes', state_field: 'status' },
  'legacy:mms_ledger': { target_table: 'public.raw_materials', state_field: 'status' },
  'legacy:sales_order': { target_table: 'public.sales_orders', state_field: 'status' },
  'legacy:purchase_demand': { target_table: 'public.purchase_demands', state_field: 'status' },
  'legacy:production_work_order': { target_table: 'scm.production_work_orders', state_field: 'work_order_status' },
  'legacy:mms_inventory_stock_in': { target_table: 'scm.inventory_drafts', state_field: 'status' },
  'legacy:mms_inventory_stock_out': { target_table: 'scm.inventory_drafts', state_field: 'status' }
})

const WORKFLOW_RLS_PASSTHROUGH_KEYWORDS = Object.freeze([
  '只有具备流程发起权限',
  '缺少流程推进权限',
  '缺少状态迁移权限',
  '任务未分配',
  'workflow start permission required',
  'workflow transition permission required',
  'status transition rule required',
  'status transition state mapping required',
  'status transition permission required',
  'current task is not assigned to current actor',
  'approval comment required'
])

export const normalizeApprovalMode = (value) => {
  const mode = String(value || '').trim().toLowerCase()
  if (mode === 'quota' || mode === 'all') return mode
  return 'any'
}

export const normalizeRequiredApprovals = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, Math.floor(parsed))
}

export const formatApprovalMode = (value) => {
  const mode = normalizeApprovalMode(value)
  return APPROVAL_MODE_LABEL_MAP[mode] || mode
}

export const normalizePolicyBool = (value, fallback = true) => {
  if (value === true || value === false) return value
  if (value === null || value === undefined || value === '') return fallback
  const raw = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(raw)) return true
  if (['false', '0', 'no', 'off'].includes(raw)) return false
  return fallback
}

export const formatPolicyBool = (value) => (value ? '开启' : '关闭')

export const resolveWorkflowEffectivePolicy = ({ config, policy, fallbackModule } = {}) => {
  const cfg = config && typeof config === 'object' ? config : {}
  const storedPolicy = policy && typeof policy === 'object' ? policy : {}
  return {
    acl_module: String(storedPolicy.acl_module || cfg.aclModule || fallbackModule || '').trim(),
    permission_mode: String(storedPolicy.permission_mode || cfg.permission_mode || 'compat').trim().toLowerCase(),
    enforce_assignment: normalizePolicyBool(storedPolicy.enforce_assignment, true),
    enforce_workflow_op_perm: normalizePolicyBool(storedPolicy.enforce_workflow_op_perm, true),
    enforce_status_transition_perm: normalizePolicyBool(storedPolicy.enforce_status_transition_perm, true),
    legacy_fallback_enabled: normalizePolicyBool(storedPolicy.legacy_fallback_enabled, true),
    source: policy ? 'policy' : 'default'
  }
}

export const getWorkflowPolicyModeMeta = (policy) => {
  const strict = policy?.permission_mode === 'strict'
  return {
    label: strict ? 'strict' : 'compat',
    tagType: strict ? 'danger' : 'success'
  }
}

export const isWorkflowStrictPolicyEnabled = (policy) => (
  policy?.permission_mode === 'strict'
  && policy?.legacy_fallback_enabled === false
  && policy?.enforce_assignment !== false
  && policy?.enforce_workflow_op_perm !== false
  && policy?.enforce_status_transition_perm !== false
)

export const normalizeStateValue = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalized = WORKFLOW_STATE_CANONICAL_MAP[raw.toLowerCase()] || WORKFLOW_STATE_CANONICAL_MAP[raw]
  return normalized || raw
}

export const getWorkflowStateLevel = (value) => WORKFLOW_STATUS_ORDER.indexOf(normalizeStateValue(value))

export const getWorkflowStateLabel = (value) => {
  const normalized = normalizeStateValue(value)
  if (!normalized) return '未配置'
  return WORKFLOW_STATE_LABEL_MAP[normalized] || normalized
}

export const getWorkflowStateTagType = (value) => {
  const normalized = normalizeStateValue(value)
  return WORKFLOW_STATE_UI_MAP[normalized]?.tagType || 'info'
}

export const getWorkflowStateColor = (value) => {
  const normalized = normalizeStateValue(value)
  return WORKFLOW_STATE_UI_MAP[normalized]?.color || '#909399'
}

export const isStateReached = (observed, expected) => {
  const observedValue = normalizeStateValue(observed)
  const expectedValue = normalizeStateValue(expected)
  if (!observedValue || !expectedValue) return false
  if (observedValue === expectedValue) return true
  const observedLevel = getWorkflowStateLevel(observedValue)
  const expectedLevel = getWorkflowStateLevel(expectedValue)
  if (observedLevel < 0 || expectedLevel < 0) return false
  return observedLevel >= expectedLevel
}

export const formatTransitionStatePair = (fromState, toState) => {
  const fromText = getWorkflowStateLabel(fromState)
  const toText = getWorkflowStateLabel(toState)
  if (fromText === '-' && toText === '-') return '-'
  return `${fromText} -> ${toText}`
}

export const buildWorkflowTaskOptions = ({
  taskNameMap = {},
  stateMappings = [],
  taskAssignments = [],
  transitionRules = [],
  formatTaskName = (value) => String(value || '')
} = {}) => {
  const ids = new Set()
  Object.keys(taskNameMap || {}).forEach((id) => ids.add(String(id || '').trim()))
  stateMappings.forEach((item) => ids.add(String(item?.bpmn_task_id || '').trim()))
  taskAssignments.forEach((item) => ids.add(String(item?.task_id || '').trim()))
  transitionRules.forEach((item) => {
    ids.add(String(item?.from_task_id || '').trim())
    ids.add(String(item?.to_task_id || '').trim())
  })
  return Array.from(ids)
    .filter(Boolean)
    .map((id) => ({ value: id, label: formatTaskName(id) }))
    .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'zh-Hans-CN'))
}

export const buildWorkflowStateOptions = ({ stateMappings = [], transitionRules = [] } = {}) => {
  const values = new Set(WORKFLOW_STATUS_ORDER)
  stateMappings.forEach((item) => {
    values.add(String(item?.from_state || '').trim())
    values.add(String(item?.state_value || '').trim())
  })
  transitionRules.forEach((item) => {
    values.add(String(item?.from_state || '').trim())
    values.add(String(item?.to_state || '').trim())
  })
  return Array.from(values)
    .filter(Boolean)
    .map((value) => ({ value, label: getWorkflowStateLabel(value) }))
    .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'zh-Hans-CN'))
}

export const normalizeStatusTokenForPermission = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  const parts = []
  for (const char of raw) {
    if (/^[a-z0-9]$/.test(char)) {
      parts.push(char)
    } else if (/^[\s_.:-]$/.test(char)) {
      parts.push('_')
    } else {
      parts.push(`_u${char.codePointAt(0).toString(16)}_`)
    }
  }
  return parts.join('').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
}

export const buildTransitionPermission = (fromState, toState, appKey) => {
  const normalizedAppKey = String(appKey || '').trim()
  const fromToken = normalizeStatusTokenForPermission(fromState)
  const toToken = normalizeStatusTokenForPermission(toState)
  if (!normalizedAppKey || !fromToken || !toToken || fromToken === toToken) return ''
  return `op:${normalizedAppKey}.status_transition.${fromToken}_${toToken}`
}

export const buildWorkflowPolicyPayload = ({ draft, workflowAppId } = {}) => ({
  workflow_app_id: workflowAppId,
  acl_module: String(draft?.acl_module || '').trim(),
  permission_mode: draft?.permission_mode === 'strict' ? 'strict' : 'compat',
  enforce_assignment: Boolean(draft?.enforce_assignment),
  enforce_workflow_op_perm: Boolean(draft?.enforce_workflow_op_perm),
  enforce_status_transition_perm: Boolean(draft?.enforce_status_transition_perm),
  legacy_fallback_enabled: Boolean(draft?.legacy_fallback_enabled)
})

export const buildWorkflowRuleDraftState = (row, { appKey, buildSuggestedPermission } = {}) => {
  const draft = {
    from_task_id: String(row?.from_task_id || '').trim(),
    to_task_id: String(row?.to_task_id || '').trim(),
    from_state: String(row?.from_state || '').trim(),
    to_state: String(row?.to_state || '').trim(),
    required_permission: String(row?.required_permission || '').trim(),
    is_active: row ? row?.is_active !== false : true
  }
  const suggestedPermission = typeof buildSuggestedPermission === 'function'
    ? String(buildSuggestedPermission(draft.from_state, draft.to_state) || '').trim()
    : buildTransitionPermission(draft.from_state, draft.to_state, appKey)
  if (!row && suggestedPermission) draft.required_permission = suggestedPermission
  return {
    editingId: row?.id || null,
    draft,
    lastSuggestedPermission: suggestedPermission
  }
}

export const resolveWorkflowRulePermissionSync = ({
  suggestedPermission,
  currentPermission,
  lastSuggestedPermission,
  force = false
} = {}) => {
  const suggested = String(suggestedPermission || '').trim()
  if (!suggested) return null
  const current = String(currentPermission || '').trim()
  return {
    requiredPermission: force || !current || current === lastSuggestedPermission ? suggested : current,
    lastSuggestedPermission: suggested
  }
}

export const buildWorkflowRulePayloadPlan = ({ draft, workflowAppId, suggestedPermission } = {}) => {
  const fromTask = String(draft?.from_task_id || '').trim()
  const toTask = String(draft?.to_task_id || '').trim()
  const fromState = String(draft?.from_state || '').trim()
  const toState = String(draft?.to_state || '').trim()
  if (!fromTask || !toTask) return { payload: null, validationError: 'tasks', suggestedPermission: '' }
  if (!fromState || !toState) return { payload: null, validationError: 'states', suggestedPermission: '' }
  if (normalizeStatusTokenForPermission(fromState) === normalizeStatusTokenForPermission(toState)) {
    return { payload: null, validationError: 'same-state', suggestedPermission: '' }
  }
  const currentPermission = String(draft?.required_permission || '').trim()
  const normalizedSuggestion = currentPermission ? '' : String(suggestedPermission || '').trim()
  return {
    payload: {
      workflow_app_id: workflowAppId,
      from_task_id: fromTask,
      to_task_id: toTask,
      from_state: fromState,
      to_state: toState,
      required_permission: currentPermission || normalizedSuggestion || null,
      is_active: Boolean(draft?.is_active)
    },
    validationError: '',
    suggestedPermission: normalizedSuggestion
  }
}

export const getWorkflowTransitionRuleKey = (row = {}) => ([
  String(row?.from_task_id || '').trim(),
  String(row?.to_task_id || '').trim(),
  String(row?.from_state || '').trim(),
  String(row?.to_state || '').trim()
].join('\u001f'))

export const resolveWorkflowRuleUpsertPlan = ({ candidates = [], existingRules = [] } = {}) => {
  const existingMap = new Map()
  existingRules.forEach((row) => {
    const key = getWorkflowTransitionRuleKey(row)
    if (key) existingMap.set(key, row)
  })
  const toCreate = []
  const toReactivate = []
  candidates.forEach((candidate) => {
    const existing = existingMap.get(getWorkflowTransitionRuleKey(candidate))
    if (!existing) {
      toCreate.push(candidate)
      return
    }
    if (existing?.is_active === false) toReactivate.push({ existing, candidate })
  })
  return { toCreate, toReactivate }
}

const getStateMappingByTaskId = (stateMappings, taskId) => {
  const key = String(taskId || '').trim()
  if (!key) return null
  return (Array.isArray(stateMappings) ? stateMappings : [])
    .find((item) => String(item?.bpmn_task_id || '').trim() === key) || null
}

export const buildGeneratedTransitionRule = ({
  fromTaskId,
  toTaskId,
  stateMappings,
  workflowAppId,
  appKey
}) => {
  const fromTask = String(fromTaskId || '').trim()
  const toTask = String(toTaskId || '').trim()
  if (!fromTask || !toTask || fromTask === toTask) return null
  const fromMapping = getStateMappingByTaskId(stateMappings, fromTask)
  const toMapping = getStateMappingByTaskId(stateMappings, toTask)
  const fromState = String(fromMapping?.state_value || '').trim()
  const toState = String(toMapping?.state_value || '').trim()
  if (!fromState || !toState) return null
  if (normalizeStatusTokenForPermission(fromState) === normalizeStatusTokenForPermission(toState)) return null
  return {
    workflow_app_id: workflowAppId,
    from_task_id: fromTask,
    to_task_id: toTask,
    from_state: fromState,
    to_state: toState,
    required_permission: buildTransitionPermission(fromState, toState, appKey) || null,
    is_active: true
  }
}

export const buildGeneratedWorkflowTransitionRuleCandidates = ({
  stateMappings = [],
  workflowAppId,
  appKey,
  resolveNextTasks = () => []
} = {}) => {
  const seen = new Set()
  const candidates = []
  stateMappings.forEach((mapping) => {
    const fromTask = String(mapping?.bpmn_task_id || '').trim()
    if (!fromTask) return
    resolveNextTasks(fromTask).forEach((toTask) => {
      const candidate = buildGeneratedTransitionRule({
        fromTaskId: fromTask,
        toTaskId: toTask,
        stateMappings,
        workflowAppId,
        appKey
      })
      if (!candidate) return
      const key = getWorkflowTransitionRuleKey(candidate)
      if (seen.has(key)) return
      seen.add(key)
      candidates.push(candidate)
    })
  })
  return candidates
}

export const getActiveWorkflowTransitionRules = (rules = []) => (
  rules.filter((row) => row?.is_active !== false)
)

export const getMissingGeneratedWorkflowRules = ({ candidates = [], existingRules = [] } = {}) => {
  const activeKeys = new Set(
    getActiveWorkflowTransitionRules(existingRules).map((row) => getWorkflowTransitionRuleKey(row))
  )
  return candidates.filter((candidate) => !activeKeys.has(getWorkflowTransitionRuleKey(candidate)))
}

export const collectWorkflowCandidateRoleCodes = (taskAssignments = []) => {
  const roles = new Set()
  taskAssignments.forEach((item) => {
    const candidateRoles = Array.isArray(item?.candidate_roles) ? item.candidate_roles : []
    candidateRoles.forEach((itemRole) => {
      const role = String(itemRole || '').trim()
      if (role && role !== 'super_admin') roles.add(role)
    })
  })
  return Array.from(roles).sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN'))
}

export const buildCorePermissionEntries = (appKey) => {
  const normalizedAppKey = String(appKey || '').trim()
  if (!normalizedAppKey) return []
  return [
    { code: `op:${normalizedAppKey}.workflow_start`, source: '流程发起' },
    { code: `op:${normalizedAppKey}.workflow_transition`, source: '流程推进' },
    { code: `op:${normalizedAppKey}.workflow_complete`, source: '流程完结' }
  ]
}

export const collectRequiredPermissionEntries = ({ appKey, activeRules = [], missingRules = [] }) => {
  const entries = [...buildCorePermissionEntries(appKey)]
  const pushRulePermission = (rule, source) => {
    const code = String(rule?.required_permission || '').trim()
    if (code) entries.push({ code, source })
  }
  activeRules.forEach((rule) => pushRulePermission(rule, '迁移规则'))
  missingRules.forEach((rule) => pushRulePermission(rule, '建议规则'))

  const seen = new Set()
  return entries.filter((item) => {
    if (!item.code || seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}

export const normalizeWorkflowReadinessReport = (next = {}) => {
  const report = {
    requiredPermissions: next.requiredPermissions || [],
    missingRules: next.missingRules || [],
    missingPermissionDefs: next.missingPermissionDefs || [],
    roleGrantGaps: next.roleGrantGaps || [],
    warnings: next.warnings || []
  }
  const computedReady = report.missingRules.length === 0
    && report.missingPermissionDefs.length === 0
    && report.roleGrantGaps.length === 0
    && report.warnings.length === 0
  return {
    ...report,
    ready: typeof next.ready === 'boolean' ? next.ready : computedReady
  }
}

export const getMissingWorkflowPermissionDefinitions = ({
  requiredPermissions = [],
  definedCodes = [],
  skip = false
} = {}) => {
  if (skip) return []
  const defined = definedCodes instanceof Set ? definedCodes : new Set(definedCodes)
  return requiredPermissions
    .filter((item) => !defined.has(item?.code))
    .map((item) => ({ code: item?.code, source: item?.source }))
}

export const buildWorkflowRoleGrantGaps = ({ roleCodes = [], permissionCodes = [], grantRows = [] } = {}) => {
  const grantMap = new Map()
  grantRows.forEach((row) => {
    const roleCode = String(row?.role_code || '').trim()
    const permissions = Array.isArray(row?.permissions) ? row.permissions : []
    grantMap.set(roleCode, new Set(permissions.map((item) => String(item || '').trim()).filter(Boolean)))
  })
  const gaps = []
  roleCodes.forEach((roleCode) => {
    const granted = grantMap.get(roleCode) || new Set()
    const missing = permissionCodes.filter((code) => !granted.has(code))
    if (missing.length) gaps.push({ role_code: roleCode, missing_permissions: missing })
  })
  return gaps
}

export const flattenWorkflowRoleGrantGaps = (roleGrantGaps = []) => {
  const seen = new Set()
  const entries = []
  roleGrantGaps.forEach((row) => {
    const roleCode = String(row?.role_code || '').trim()
    const permissions = Array.isArray(row?.missing_permissions) ? row.missing_permissions : []
    permissions.forEach((permission) => {
      const permissionCode = String(permission || '').trim()
      const key = `${roleCode}\u0000${permissionCode}`
      if (!roleCode || !permissionCode || seen.has(key)) return
      seen.add(key)
      entries.push({ roleCode, permissionCode })
    })
  })
  return entries
}

export const summarizeWorkflowCodes = (codes) => {
  const list = (Array.isArray(codes) ? codes : []).map((item) => String(item || '').trim()).filter(Boolean)
  if (list.length <= 5) return list.join(', ')
  return `${list.slice(0, 5).join(', ')} 等 ${list.length} 项`
}

export const buildUniqueWorkflowPermissionDefPayloads = ({ items = [], buildPayload } = {}) => {
  const seen = new Set()
  return items
    .map((item) => buildPayload(item))
    .filter((row) => {
      if (!row.code || seen.has(row.code)) return false
      seen.add(row.code)
      return true
    })
}

export const buildWorkflowRolePermissionRows = ({ entries = [], roleMap, permissionMap } = {}) => {
  const seen = new Set()
  return entries
    .map((item) => ({
      role_id: roleMap?.get(item.roleCode),
      permission_id: permissionMap?.get(item.permissionCode)
    }))
    .filter((row) => {
      const key = `${row.role_id}\u0000${row.permission_id}`
      if (!row.role_id || !row.permission_id || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export const buildWorkflowRoleGrantLookupPlan = (entries = []) => {
  const source = Array.isArray(entries) ? entries : []
  const collectCodes = (field) => Array.from(new Set(source
    .map((item) => String(item?.[field] || '').trim())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  return {
    roleCodes: collectCodes('roleCode'),
    permissionCodes: collectCodes('permissionCode')
  }
}

export const buildWorkflowCodeIdMap = (rows = []) => {
  const result = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const code = String(row?.code || '').trim()
    const id = String(row?.id || '').trim()
    if (code && id) result.set(code, id)
  })
  return result
}

export const resolveWorkflowRoleGrantReferences = ({
  entries = [],
  roleCodes = [],
  permissionCodes = [],
  roleRows = [],
  permissionRows = []
} = {}) => {
  const roleMap = buildWorkflowCodeIdMap(roleRows)
  const permissionMap = buildWorkflowCodeIdMap(permissionRows)
  const missingRoles = roleCodes.filter((code) => !roleMap.has(code))
  const missingPermissions = permissionCodes.filter((code) => !permissionMap.has(code))
  return {
    missingRoles,
    missingPermissions,
    rows: buildWorkflowRolePermissionRows({ entries, roleMap, permissionMap })
  }
}

export const formatWorkflowRoleGrantReferenceError = ({ missingRoles = [], missingPermissions = [] } = {}) => {
  const parts = []
  if (missingRoles.length) parts.push(`角色不存在：${summarizeWorkflowCodes(missingRoles)}`)
  if (missingPermissions.length) parts.push(`权限定义不存在：${summarizeWorkflowCodes(missingPermissions)}`)
  return parts.length ? `补齐角色授权失败，${parts.join('；')}` : ''
}

export const normalizeWorkflowApiError = (error) => ({
  status: error?.response?.status,
  code: error?.response?.data?.code || '',
  message: error?.response?.data?.message || error?.message || '未知错误'
})

export const formatWorkflowError = (fallback, error, rlsMessage = '') => {
  const { status, code, message } = normalizeWorkflowApiError(error)
  if (status === 403 && code === '42501') {
    const normalizedMessage = String(message || '').trim()
    if (normalizedMessage && WORKFLOW_RLS_PASSTHROUGH_KEYWORDS.some((keyword) => normalizedMessage.includes(keyword))) {
      return normalizedMessage
    }
    return rlsMessage || `${fallback}（当前账号无权限）`
  }
  return `${fallback}：${message}`
}

export const resolveWorkflowPermissionDefMeta = (code, source = '') => {
  if (code.includes('.workflow_start')) {
    return { suffix: '流程发起', action: 'workflow_start' }
  }
  if (code.includes('.workflow_transition')) {
    return { suffix: '流程推进', action: 'workflow_transition' }
  }
  if (code.includes('.workflow_complete')) {
    return { suffix: '流程完结', action: 'workflow_complete' }
  }
  if (code.includes('.status_transition.')) {
    return { suffix: '状态流转', action: 'status_transition' }
  }
  const fallback = String(source || '流程权限').trim() || '流程权限'
  return { suffix: fallback, action: 'workflow_permission' }
}

export const buildPermissionDefinitionPayload = (item, { moduleName, displayName }) => {
  const code = String(item?.code || '').trim()
  const normalizedModuleName = String(moduleName || 'workflow').trim()
  const normalizedDisplayName = String(displayName || normalizedModuleName || '流程应用').trim()
  const meta = resolveWorkflowPermissionDefMeta(code, item?.source)
  return {
    code,
    name: `${normalizedDisplayName}-${meta.suffix}`,
    module: normalizedModuleName,
    action: meta.action
  }
}

export const parseSchemaTable = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return { schema: '', table: '' }
  if (raw.includes('.')) {
    const [schema, table] = raw.split('.', 2)
    return { schema: String(schema || '').trim(), table: String(table || '').trim() }
  }
  return { schema: 'public', table: raw }
}

export const resolveTaskAutoRule = (autoAdvanceRules, taskId) => {
  const key = String(taskId || '').trim()
  if (!key) return { enabled: true, triggerState: '' }
  const ruleRaw = autoAdvanceRules?.[key]
  if (!ruleRaw || typeof ruleRaw !== 'object') {
    return { enabled: true, triggerState: '' }
  }
  return {
    enabled: ruleRaw.enabled !== false,
    triggerState: normalizeStateValue(ruleRaw.trigger_state)
  }
}

export const resolveExpectedStateForRow = ({ row, mapping, autoAdvanceRules }) => {
  const taskId = String(row?.current_task_id || '').trim()
  const rule = resolveTaskAutoRule(autoAdvanceRules, taskId)
  const fromRule = normalizeStateValue(rule?.triggerState)
  if (fromRule) return fromRule
  return normalizeStateValue(mapping?.state_value)
}

export const extractBusinessDocNo = (rowData) => {
  if (!rowData || typeof rowData !== 'object') return ''
  const candidates = [
    rowData.business_doc_no,
    rowData.doc_no,
    rowData.bill_no,
    rowData.order_no,
    rowData.transaction_no,
    rowData.business_key,
    rowData.code,
    rowData.id
  ]
  for (const item of candidates) {
    const text = String(item || '').trim()
    if (text) return text
  }
  const props = rowData.properties && typeof rowData.properties === 'object' ? rowData.properties : {}
  const fromProps = String(props.workflow_business_key || '').trim()
  if (fromProps) return fromProps
  return ''
}

export const isInventoryDraftTable = (schema, table) => schema === 'scm' && table === 'inventory_drafts'

const parseIsoTime = (value) => {
  const text = String(value || '').trim()
  if (!text) return 0
  const ts = Date.parse(text)
  return Number.isFinite(ts) ? ts : 0
}

export const isAutoAdvanceSatisfied = ({
  row,
  mapping,
  taskRule,
  observedState,
  businessRow
}) => {
  const explicitTrigger = normalizeStateValue(taskRule?.triggerState)
  const mappedExpected = normalizeStateValue(mapping?.state_value)
  const expectedState = explicitTrigger || mappedExpected
  if (!expectedState) return false
  if (!isStateReached(observedState, expectedState)) return false
  if (explicitTrigger) return true

  const businessUpdatedAt = parseIsoTime(businessRow?.updated_at || businessRow?.created_at)
  const instanceEnteredAt = parseIsoTime(row?.updated_at || row?.created_at)
  if (businessUpdatedAt > 0 && instanceEnteredAt > 0 && businessUpdatedAt < instanceEnteredAt) {
    return false
  }
  return true
}

const parseJsonObject = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export const resolveWorkflowRuntimeConfig = (config) => {
  const cfg = config && typeof config === 'object' ? config : {}
  const businessAppId = String(cfg.workflowBusinessAppId || '').trim()
  const rawBindings = cfg.workflowTaskBusinessAppBindings
  const taskBindings = {}
  if (rawBindings && typeof rawBindings === 'object' && !Array.isArray(rawBindings)) {
    Object.entries(rawBindings).forEach(([taskId, binding]) => {
      const key = String(taskId || '').trim()
      const value = String(binding || '').trim()
      if (key && value) taskBindings[key] = value
    })
  }
  const rules = cfg.workflowAutoAdvanceRules
  return {
    businessAppId,
    taskBindings,
    tableBinding: businessAppId.startsWith('table:')
      ? String(businessAppId.slice('table:'.length) || '').trim()
      : '',
    legacyBinding: businessAppId.startsWith('legacy:') ? businessAppId : '',
    autoAdvanceEnabled: cfg.workflowAutoAdvanceEnabled === true,
    autoAdvanceRules: rules && typeof rules === 'object' ? rules : {}
  }
}

export const formatWorkflowBusinessBindingSummary = ({
  businessAppId,
  taskBindings,
  businessApps = []
} = {}) => {
  const bindingCount = Object.keys(taskBindings || {}).length
  if (bindingCount > 0) return `按任务绑定（${bindingCount} 个节点）`
  const targetId = String(businessAppId || '').trim()
  if (targetId.startsWith('legacy:')) {
    return LEGACY_BINDING_LABEL_MAP[targetId] || `业务应用：${targetId}`
  }
  if (targetId.startsWith('table:')) {
    return `旧按表绑定：${String(targetId.slice('table:'.length) || '').trim()}`
  }
  if (!targetId) return ''
  const matched = (Array.isArray(businessApps) ? businessApps : [])
    .find((item) => String(item?.id || '') === targetId)
  if (!matched) return '已绑定业务应用'
  const cfg = parseJsonObject(matched?.config) || {}
  const tableName = String(cfg.table || '').trim()
  return tableName ? `业务应用：${matched.name}（${tableName}）` : `业务应用：${matched.name}`
}

export const resolveConfiguredTaskBusinessBinding = ({
  taskId,
  taskName,
  taskBindings,
  globalBinding
} = {}) => {
  const key = String(taskId || '').trim()
  if (key && taskBindings?.[key]) return String(taskBindings[key] || '').trim()
  const binding = String(globalBinding || '').trim()
  if (binding === 'legacy:mms_inventory_stock_in' || binding === 'legacy:mms_inventory_stock_out') {
    const taskText = `${key} ${String(taskName || '')}`.toLowerCase()
    if (/出库|outbound|stock[_-]?out/.test(taskText)) return 'legacy:mms_inventory_stock_out'
    if (/入库|inbound|stock[_-]?in/.test(taskText)) return 'legacy:mms_inventory_stock_in'
  }
  return binding
}

export const resolveBoundStateTarget = ({ binding, businessApps = [] }) => {
  const normalizedBinding = String(binding || '').trim()
  if (normalizedBinding.startsWith('legacy:')) {
    const legacy = LEGACY_BINDING_STATE_TARGET_MAP[normalizedBinding]
    if (legacy?.target_table) {
      return {
        target_table: String(legacy.target_table),
        state_field: String(legacy.state_field || 'status')
      }
    }
  }
  if (normalizedBinding.startsWith('table:')) {
    const table = String(normalizedBinding.slice('table:'.length) || '').trim()
    if (table) return { target_table: table, state_field: 'status' }
  }
  if (normalizedBinding) {
    const target = businessApps.find((item) => String(item?.id || '') === normalizedBinding)
    const cfg = parseJsonObject(target?.config) || {}
    const table = String(cfg.table || '').trim()
    if (table) return { target_table: table, state_field: 'status' }
  }
  return { target_table: '', state_field: '' }
}

export const mergeCurrentTaskMapping = ({ taskId, stateMappings = [], binding, businessApps = [] }) => {
  const key = String(taskId || '').trim()
  if (!key) return null
  const base = stateMappings.find((item) => String(item?.bpmn_task_id || '').trim() === key) || null
  const bound = resolveBoundStateTarget({ binding, businessApps })
  if (base) {
    return {
      ...base,
      target_table: String(base?.target_table || bound.target_table || '').trim(),
      state_field: String(base?.state_field || bound.state_field || 'status').trim()
    }
  }
  if (!bound.target_table) return null
  return {
    bpmn_task_id: key,
    target_table: bound.target_table,
    state_field: bound.state_field || 'status',
    state_value: ''
  }
}

export const resolveTargetBusinessAppId = ({
  taskId,
  binding,
  stateMappings = [],
  businessApps = []
}) => {
  const normalizedBinding = String(binding || '').trim()
  if (normalizedBinding) {
    if (normalizedBinding.startsWith('legacy:')) return normalizedBinding
    if (normalizedBinding.startsWith('table:')) {
      const table = String(normalizedBinding.slice('table:'.length) || '').trim()
      if (!table) return ''
      const legacyBinding = LEGACY_TABLE_BINDING_MAP[table]
      if (legacyBinding) return legacyBinding
      const matchedByTable = businessApps.find((item) => {
        const cfg = parseJsonObject(item?.config) || {}
        return String(cfg.table || '').trim() === table
      })
      return matchedByTable?.id ? String(matchedByTable.id) : ''
    }
    return normalizedBinding
  }
  const mapping = mergeCurrentTaskMapping({ taskId, stateMappings, binding: normalizedBinding, businessApps })
  const targetTable = String(mapping?.target_table || '').trim()
  if (!targetTable) return ''
  const legacyBinding = LEGACY_TABLE_BINDING_MAP[targetTable]
  if (legacyBinding) return legacyBinding
  const matched = businessApps.find((item) => {
    const cfg = parseJsonObject(item?.config) || {}
    return String(cfg.table || '').trim() === targetTable
  })
  return matched?.id ? String(matched.id) : ''
}

export const chooseNextTaskByStateLevel = ({
  currentTaskId,
  targetLevel,
  options = [],
  stateMappings = []
}) => {
  const currentTask = String(currentTaskId || '').trim()
  if (!currentTask || targetLevel < 0) return ''
  const normalizedOptions = options.map((item) => String(item || '').trim())
  if (!normalizedOptions.length) return ''
  const preferred = stateMappings.find((item) => {
    const taskId = String(item?.bpmn_task_id || '').trim()
    if (!taskId || taskId === currentTask) return false
    if (!normalizedOptions.includes(taskId)) return false
    return getWorkflowStateLevel(item?.state_value) === targetLevel
  })
  if (preferred?.bpmn_task_id) return String(preferred.bpmn_task_id)
  return normalizedOptions[0]
}

export const resolveInventoryDraftType = (binding) => {
  if (binding === 'legacy:mms_inventory_stock_in') return 'in'
  if (binding === 'legacy:mms_inventory_stock_out') return 'out'
  return ''
}

export const buildBusinessRecordQueryPlan = ({ businessKey, instanceId, inventoryDrafts = false }) => {
  const normalizedBusinessKey = String(businessKey || '').trim()
  const normalizedInstanceId = String(instanceId || '').trim()
  const queries = []
  if (normalizedBusinessKey) {
    if (!inventoryDrafts) {
      queries.push(`id=eq.${encodeURIComponent(normalizedBusinessKey)}`)
      queries.push(`business_key=eq.${encodeURIComponent(normalizedBusinessKey)}`)
    }
    queries.push(`${encodeURIComponent('properties->>workflow_business_key')}=eq.${encodeURIComponent(normalizedBusinessKey)}`)
  }
  if (normalizedInstanceId) {
    queries.push(`${encodeURIComponent('properties->>workflow_instance_id')}=eq.${encodeURIComponent(normalizedInstanceId)}`)
    if (!inventoryDrafts) {
      queries.push(`workflow_instance_id=eq.${encodeURIComponent(normalizedInstanceId)}`)
    }
  }
  return queries
}
