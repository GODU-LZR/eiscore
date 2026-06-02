// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const FLASH_WRITE_TOOL_IDS = new Set([
  'flash.draft.write',
  'flash.attachment.upload',
  'flash.app.save',
  'flash.app.publish',
  'flash.route.upsert',
  'flash.audit.write',
  'flash.app.create',
  'flash.app.delete',
  'flash.data.table.ensure',
  'flash.data.grid.create',
  'flash.data.grid.update',
  'flash.data.grid.delete',
  'flash.workflow.definition.upsert',
  'flash.workflow.assignment.upsert',
  'flash.workflow.mapping.upsert',
  'flash.workflow.instance.start',
  'flash.workflow.instance.transition',
  'flash.hr.archive.update',
  'flash.hr.attendance.init',
  'flash.inventory.draft.create',
  'flash.inventory.batchno.generate',
  'flash.inventory.stock.in',
  'flash.inventory.stock.out',
  'flash.ontology.semantic.enrich'
])

const readAuthToken = () => {
  const raw = localStorage.getItem('auth_token')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) return String(parsed.token).trim()
  } catch {
    // fallback to raw token
  }
  return String(raw).trim()
}

const readCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      username: String(parsed?.username || parsed?.user_name || parsed?.name || '').trim(),
      appRole: String(parsed?.app_role || parsed?.role || '').trim()
    }
  } catch {
    return { username: '', appRole: '' }
  }
}

const buildTraceId = (prefix = 'flash_ui') => (
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
)

const buildIdempotencyKey = (prefix = 'flash_ui') => (
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
)

const getRuntimeAppId = () => {
  if (typeof window === 'undefined') return ''
  const searchAppId = new URLSearchParams(window.location.search || '').get('appId')
  if (searchAppId) return searchAppId
  const match = String(window.location.pathname || '').match(/\/app\/([^/?#]+)/)
  return match?.[1] || ''
}

const normalizeToolArgs = (args) => (
  args && typeof args === 'object' && !Array.isArray(args) ? args : {}
)

const getAgentToolCallUrls = () => {
  if (typeof window === 'undefined') return ['/agent/flash/tools/call']
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
  const hostname = window.location.hostname || 'localhost'
  return Array.from(new Set([
    '/agent/flash/tools/call',
    `${protocol}://${hostname}:8078/flash/tools/call`
  ]))
}

export const callFlashRuntimeTool = async (toolId, args = {}, options = {}) => {
  const id = String(toolId || '').trim()
  if (!id) throw new Error('toolId is required')
  const token = readAuthToken()
  if (!token) throw new Error('缺少登录令牌，请重新登录')

  const toolArgs = normalizeToolArgs(args)
  const actor = readCurrentUser()
  const writeTool = FLASH_WRITE_TOOL_IDS.has(id) || options.write === true
  const appId = String(options.appId || toolArgs.appId || getRuntimeAppId() || '').trim()
  const payload = {
    trace_id: options.traceId || buildTraceId(),
    tool_id: id,
    session_id: options.sessionId || `runtime_${appId || 'default'}`,
    app_id: appId,
    arguments: toolArgs,
    context: {
      source: options.source || 'flash_runtime',
      user_role: actor.appRole || 'unknown'
    }
  }

  if (writeTool) {
    payload.confirmed = options.confirmed ?? true
    payload.idempotency_key = options.idempotencyKey || buildIdempotencyKey()
  }

  let lastError = null
  for (const url of getAgentToolCallUrls()) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result?.ok === false) {
        throw new Error(String(result?.message || result?.code || `工具调用失败 (${response.status})`))
      }
      return result
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(String(lastError?.message || '工具调用失败'))
}

export const installFlashRuntimeBridge = (app) => {
  if (typeof window !== 'undefined') {
    const bridge = {
      callTool: callFlashRuntimeTool,
      call: callFlashRuntimeTool,
      getAppId: getRuntimeAppId
    }
    window.EISFlash = {
      ...(window.EISFlash || {}),
      ...bridge
    }
    window.__EIS_FLASH_RUNTIME__ = bridge
  }

  if (app?.config?.globalProperties) {
    app.config.globalProperties.$flash = {
      callTool: callFlashRuntimeTool,
      call: callFlashRuntimeTool,
      getAppId: getRuntimeAppId
    }
    app.config.globalProperties.$callFlashTool = callFlashRuntimeTool
  }
}
