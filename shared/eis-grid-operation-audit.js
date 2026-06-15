// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const normalizeText = (value, fallback = '') => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  return text || fallback
}

const getCurrentUserName = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const info = raw ? JSON.parse(raw) : {}
    return normalizeText(info?.username || info?.name || info?.id, 'unknown')
  } catch {
    return 'unknown'
  }
}

const resolveProfile = (props = {}) => normalizeText(props.acceptProfile || props.profile, 'public')

const resolveWriteTarget = (props = {}) => {
  const raw = normalizeText(props.writeUrl || props.apiUrl)
  return raw.split('?')[0] || raw
}

const isOperationLogTarget = (props = {}) => {
  return resolveProfile(props) === 'app_center' && /^\/execution_logs(?:\?|$)/.test(resolveWriteTarget(props))
}

export function writeGridOperationLog({ request, props = {}, action = '表格操作', rowIds = [], fields = [] } = {}) {
  if (typeof request !== 'function') return
  if (isOperationLogTarget(props)) return

  const profile = resolveProfile(props)
  const writeTarget = resolveWriteTarget(props)
  const moduleName = normalizeText(props.aclModule || profile, '表格')
  const appName = normalizeText(props.viewId || props.localLayoutKey || writeTarget || props.apiUrl, '数据表格')
  const actionName = normalizeText(action, '表格操作').slice(0, 100)
  const cleanRowIds = Array.isArray(rowIds) ? rowIds.filter(Boolean).map(String).slice(0, 50) : []
  const cleanFields = Array.isArray(fields)
    ? Array.from(new Set(fields.filter(Boolean).map(String))).slice(0, 30)
    : []

  request({
    url: '/execution_logs',
    method: 'post',
    headers: {
      'Accept-Profile': 'app_center',
      'Content-Profile': 'app_center',
      Prefer: 'return=minimal'
    },
    data: {
      task_id: actionName,
      status: 'completed',
      input_data: {
        module: moduleName,
        app: appName,
        api_url: props.apiUrl || '',
        write_url: writeTarget,
        profile,
        row_ids: cleanRowIds,
        fields: cleanFields
      },
      output_data: {
        row_count: cleanRowIds.length,
        field_count: cleanFields.length
      },
      executed_by: getCurrentUserName(),
      executed_at: new Date().toISOString(),
      operation_location: {
        address: `模块:${moduleName} / 应用:${appName} / 操作:${actionName}`,
        module: moduleName,
        app: appName,
        action: actionName,
        route_path: typeof window !== 'undefined' ? window.location?.pathname || '' : '',
        source: 'eis_data_grid'
      }
    }
  }).catch((error) => {
    console.warn('[grid-audit] write skipped', error?.response?.data?.message || error?.message || error)
  })
}
