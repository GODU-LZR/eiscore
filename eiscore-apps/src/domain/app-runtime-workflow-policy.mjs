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

export const getWorkflowTransitionRuleKey = (row = {}) => ([
  String(row?.from_task_id || '').trim(),
  String(row?.to_task_id || '').trim(),
  String(row?.from_state || '').trim(),
  String(row?.to_state || '').trim()
].join('\u001f'))

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
