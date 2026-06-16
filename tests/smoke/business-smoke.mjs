// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHttpClient, isRemoteTarget, normalizePositiveInteger } from '../engineering/http-client.mjs'

const require = createRequire(import.meta.url)

const BASE_URL = (process.env.EISCORE_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')
const AGENT_WS_URL = process.env.EISCORE_AGENT_WS_URL || 'ws://localhost:8078/ws'
const USERNAME = process.env.EISCORE_SMOKE_USERNAME || 'admin'
const PASSWORD = process.env.EISCORE_SMOKE_PASSWORD || '123456'
const RESULT_FILE = process.env.EISCORE_SMOKE_RESULT || ''
const SKIP_AI = process.env.EISCORE_SMOKE_SKIP_AI === '1'
const SKIP_WS = process.env.EISCORE_SMOKE_SKIP_WS === '1'
const AI_TIMEOUT_MS = normalizePositiveInteger(process.env.EISCORE_SMOKE_AI_TIMEOUT_MS, 60000, { min: 1000, max: 180000 })
const IS_REMOTE_TARGET = isRemoteTarget(BASE_URL)
const REQUEST_ATTEMPTS = normalizePositiveInteger(
  process.env.EISCORE_SMOKE_REQUEST_ATTEMPTS,
  IS_REMOTE_TARGET ? 3 : 1,
  { min: 1, max: 8 }
)
const http = createHttpClient({
  baseUrl: BASE_URL,
  requestAttempts: REQUEST_ATTEMPTS,
  timeoutMs: 15000,
  retryUnsafeMethods: true
})

const generatedAt = new Date().toISOString()
const results = []
let token = ''
let aiModel = process.env.EISCORE_SMOKE_AI_MODEL || ''

function addResult(name, pass, detail, statusCode = null) {
  results.push({ name, pass, detail, statusCode })
}

function loadWebSocketClient() {
  try {
    return require('../../realtime/node_modules/ws')
  } catch {
    if (globalThis.WebSocket) return globalThis.WebSocket
    throw new Error('WebSocket client unavailable. Run `npm --prefix realtime ci` or use Node with global WebSocket support.')
  }
}

async function request(path, { method = 'GET', headers = {}, body, timeout = 15000 } = {}) {
  return http.requestResponse(path, { method, headers, body, timeout })
}

async function expect(name, fn) {
  try {
    await fn()
  } catch (error) {
    addResult(name, false, error?.message || String(error), null)
  }
}

async function ensureJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text || '{}')
  } catch {
    throw new Error(`JSON parse failed: ${text.slice(0, 200)}`)
  }
}

function ensureArray(value, msg) {
  if (!Array.isArray(value)) throw new Error(msg || 'Expected array')
}

function authHeaders() {
  return { Authorization: `Bearer ${token}` }
}

function connectWebSocketWithToken(url, authToken, timeout = 8000) {
  const WebSocketClient = loadWebSocketClient()
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocketClient(url, ['bearer', authToken])
    const timer = setTimeout(() => {
      try {
        ws.terminate?.()
        ws.close?.()
      } catch {}
      reject(new Error('WebSocket open timeout'))
    }, timeout)

    ws.onopen = () => {
      clearTimeout(timer)
      resolvePromise(ws)
    }
    ws.onerror = (event) => {
      clearTimeout(timer)
      reject(event?.error || new Error('WebSocket error'))
    }

    if (typeof ws.on === 'function') {
      ws.on('open', ws.onopen)
      ws.on('error', ws.onerror)
      ws.on('close', (code, reason) => {
        clearTimeout(timer)
        if (code !== 1000) {
          reject(new Error(`WebSocket closed early: code=${code}, reason=${String(reason || '')}`))
        }
      })
    }
  })
}

await expect('01 host home returns 200', async () => {
  const res = await request('/')
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  addResult('01 host home returns 200', true, 'GET / => 200', res.status)
})

await expect('02 materials deep link returns host HTML', async () => {
  const res = await request('/materials/apps', { headers: { Accept: 'text/html' } })
  const html = await res.text()
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  if (!html.includes('<div id="app"></div>')) throw new Error('Host index marker not found')
  addResult('02 materials deep link returns host HTML', true, 'GET /materials/apps => host index', res.status)
})

await expect('03 hr deep link returns host HTML', async () => {
  const res = await request('/hr/employee', { headers: { Accept: 'text/html' } })
  const html = await res.text()
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  if (!html.includes('<div id="app"></div>')) throw new Error('Host index marker not found')
  addResult('03 hr deep link returns host HTML', true, 'GET /hr/employee => host index', res.status)
})

await expect('04 apps deep link returns host HTML', async () => {
  const res = await request('/apps/', { headers: { Accept: 'text/html' } })
  const html = await res.text()
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  if (!html.includes('<div id="app"></div>')) throw new Error('Host index marker not found')
  addResult('04 apps deep link returns host HTML', true, 'GET /apps/ => host index', res.status)
})

await expect('05 login returns JWT token', async () => {
  const res = await request('/api/rpc/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  })
  const json = await ensureJson(res)
  token = json.token || ''
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json).slice(0, 180)}`)
  if (!token || token.length < 100) throw new Error('Token missing or too short')
  addResult('05 login returns JWT token', true, `token_len=${token.length}`, res.status)
})

await expect('06 invalid password is rejected', async () => {
  const res = await request('/api/rpc/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: 'bad-password' })
  })
  if (res.status === 200) throw new Error('Unexpected 200 on invalid password')
  addResult('06 invalid password is rejected', true, `status=${res.status}`, res.status)
})

await expect('07 public.roles is readable', async () => {
  const res = await request('/api/roles?code=eq.super_admin', {
    headers: { ...authHeaders(), 'Accept-Profile': 'public' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'roles should be array')
  if (rows.length === 0) throw new Error('super_admin role not found')
  addResult('07 public.roles is readable', true, `rows=${rows.length}`, res.status)
})

await expect('08 app_settings is readable', async () => {
  const res = await request('/api/system_configs?key=eq.app_settings', {
    headers: { ...authHeaders(), 'Accept-Profile': 'public' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'system_configs should be array')
  addResult('08 app_settings is readable', true, `rows=${rows.length}`, res.status)
})

await expect('09 ai_glm_config is readable', async () => {
  const res = await request('/api/system_configs?key=eq.ai_glm_config', {
    headers: { ...authHeaders(), 'Accept-Profile': 'public' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'ai config rows should be array')
  const value = rows?.[0]?.value
  if (!value?.api_url || !value?.api_key) throw new Error('ai_glm_config missing api_url/api_key')
  addResult('09 ai_glm_config is readable', true, `${value.provider || 'unknown'} / ${value.model || 'unknown'}`, res.status)
})

await expect('10 sys_field_acl is readable', async () => {
  const res = await request('/api/sys_field_acl?module=eq.hr_employee&limit=5', {
    headers: { ...authHeaders(), 'Accept-Profile': 'public' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'sys_field_acl rows should be array')
  addResult('10 sys_field_acl is readable', true, `rows=${rows.length}`, res.status)
})

await expect('11 raw_materials is readable', async () => {
  const res = await request('/api/raw_materials?select=id,name&order=id.desc&limit=3', {
    headers: { ...authHeaders(), 'Accept-Profile': 'public' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'raw_materials rows should be array')
  addResult('11 raw_materials is readable', true, `rows=${rows.length}`, res.status)
})

await expect('12 hr.archives is readable', async () => {
  const res = await request('/api/archives?select=id,name,employee_no&order=id.desc&limit=3', {
    headers: { ...authHeaders(), 'Accept-Profile': 'hr' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'archives rows should be array')
  addResult('12 hr.archives is readable', true, `rows=${rows.length}`, res.status)
})

await expect('13 app_center.apps is readable', async () => {
  const res = await request('/api/apps?select=id,name,app_type,status&order=updated_at.desc&limit=5', {
    headers: { ...authHeaders(), 'Accept-Profile': 'app_center' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'apps rows should be array')
  addResult('13 app_center.apps is readable', true, `rows=${rows.length}`, res.status)
})

await expect('14 workflow.definitions alias is readable', async () => {
  const res = await request('/api/workflow.definitions?select=id,name&order=id.desc&limit=3', {
    headers: { ...authHeaders(), 'Accept-Profile': 'workflow' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'definitions rows should be array')
  addResult('14 workflow.definitions alias is readable', true, `rows=${rows.length}`, res.status)
})

await expect('15 workflow.definitions canonical path is readable', async () => {
  const res = await request('/api/definitions?select=id,name&order=id.desc&limit=3', {
    headers: { ...authHeaders(), 'Accept-Profile': 'workflow' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'definitions rows should be array')
  addResult('15 workflow.definitions canonical path is readable', true, `rows=${rows.length}`, res.status)
})

await expect('16 workflow_state_mappings is readable', async () => {
  const res = await request('/api/workflow_state_mappings?select=id,workflow_app_id,bpmn_task_id,state_value&limit=5', {
    headers: { ...authHeaders(), 'Accept-Profile': 'app_center' }
  })
  const rows = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  ensureArray(rows, 'workflow_state_mappings rows should be array')
  addResult('16 workflow_state_mappings is readable', true, `rows=${rows.length}`, res.status)
})

await expect('17 agent health returns ok', async () => {
  const res = await request('/agent/health')
  const json = await ensureJson(res)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  if (!json?.ok) throw new Error('agent health ok=false')
  addResult('17 agent health returns ok', true, `channel=${json.channel || ''}`, res.status)
})

if (!SKIP_AI) {
  await expect('18 ai config rejects missing token', async () => {
    const res = await request('/agent/ai/config')
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
    addResult('18 ai config rejects missing token', true, 'status=401', res.status)
  })

  await expect('19 ai config accepts token', async () => {
    const res = await request('/agent/ai/config', { headers: { ...authHeaders() } })
    const json = await ensureJson(res)
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
    if (!json || typeof json !== 'object') throw new Error('Invalid ai config response')
    aiModel = aiModel || json.model || ''
    addResult('19 ai config accepts token', true, `enabled=${!!json.enabled}, model=${json.model || ''}`, res.status)
  })

  await expect('20 ai chat non-stream returns content', async () => {
    const res = await request('/agent/ai/chat/completions', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(aiModel ? { model: aiModel } : {}),
        stream: false,
        messages: [
          { role: 'system', content: 'Return a short answer.' },
          { role: 'user', content: 'Say ok.' }
        ]
      }),
      timeout: AI_TIMEOUT_MS
    })
    const json = await ensureJson(res)
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json).slice(0, 120)}`)
    const content = json?.choices?.[0]?.message?.content || ''
    if (!content) throw new Error('AI content empty')
    addResult('20 ai chat non-stream returns content', true, `content_len=${String(content).length}`, res.status)
  })

  await expect('21 ai chat stream returns SSE data', async () => {
    const res = await request('/agent/ai/chat/completions', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(aiModel ? { model: aiModel } : {}),
        stream: true,
        messages: [
          { role: 'system', content: 'Return a short answer.' },
          { role: 'user', content: 'Say ok.' }
        ]
      }),
      timeout: AI_TIMEOUT_MS
    })
    if (res.status !== 200) {
      const txt = await res.text()
      throw new Error(`Expected 200, got ${res.status}: ${txt.slice(0, 120)}`)
    }
    if (!res.body) throw new Error('Missing stream body')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const chunks = []
    let count = 0
    while (count < 3) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value, { stream: true }))
      count += 1
    }
    await reader.cancel()
    const merged = chunks.join('')
    if (!merged.includes('data:')) throw new Error(`Stream does not contain SSE data: ${merged.slice(0, 120)}`)
    addResult('21 ai chat stream returns SSE data', true, `chunk_count=${count}`, res.status)
  })
} else {
  addResult('18-21 ai checks skipped', true, 'EISCORE_SMOKE_SKIP_AI=1', null)
}

if (!SKIP_WS) {
  await expect('22 realtime WebSocket authenticates and subscribes', async () => {
    const ws = await connectWebSocketWithToken(AGENT_WS_URL, token)
    const payload = JSON.stringify({ type: 'subscribe', channels: ['eis_events'] })
    if (typeof ws.send === 'function') ws.send(payload)
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300))
    if (typeof ws.close === 'function') ws.close(1000, 'done')
    addResult('22 realtime WebSocket authenticates and subscribes', true, 'ws open/subscribe/close ok', 101)
  })
} else {
  addResult('22 realtime WebSocket skipped', true, 'EISCORE_SMOKE_SKIP_WS=1', null)
}

await expect('23 agent health is reachable through host proxy', async () => {
  const res = await request('/agent/health', { timeout: 8000 })
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  addResult('23 agent health is reachable through host proxy', true, 'host /agent/health ok', res.status)
})

const total = results.length
const passCount = results.filter((r) => r.pass).length
const failCount = total - passCount

const output = {
  generatedAt,
  baseUrl: BASE_URL,
  agentWsUrl: AGENT_WS_URL,
  summary: { total, pass: passCount, fail: failCount },
  results
}

const text = `${JSON.stringify(output, null, 2)}\n`
console.log(text)

if (RESULT_FILE) {
  const target = resolve(RESULT_FILE)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text, 'utf8')
}

if (failCount > 0) process.exitCode = 1
