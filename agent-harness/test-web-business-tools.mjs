import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'

const envNames = ['EISCORE_HARNESS_CAPABILITY_PROFILE', 'EISCORE_GATEWAY_URL', 'DSH_PROVIDER', 'DSH_MODEL']
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]))
const authKey = Symbol.for('eiscore.dsh.auth-bridge')
const originalAuth = globalThis[authKey]
const originalFetch = globalThis.fetch
const calls = []
const approvals = []
const sessionId = 'business-web-session'
let token = 'test-business-user-token'
let approval

try {
  process.env.EISCORE_HARNESS_CAPABILITY_PROFILE = 'business'
  process.env.EISCORE_GATEWAY_URL = 'http://business-runtime:8078'
  const tools = []
  const runtime = await import(`./eiscore-tools.mjs?business-web-test=${Date.now()}`)
  runtime.apply({ tools: { register: tool => tools.push(tool) }, get: name => name === 'approval' ? approval : undefined })
  assert.equal(tools.length, 16)
  assert.deepEqual(tools.map(tool => tool.name), [...runtime.capabilities])
  assert.ok(tools.every(tool => !tool.name.startsWith('eiscore_flash_')))
  const read = tools.find(tool => tool.name === 'eiscore_enterprise_snapshot')
  const write = tools.find(tool => tool.name === 'eiscore_sales_write')
  assert.ok(read && write)
  const exec = { agent: { session: { id: sessionId } }, callId: 'sales-write-call', signal: new AbortController().signal }
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options, body: JSON.parse(options.body) })
    return Response.json({ data: { accepted: true } })
  }
  for (const bridge of [undefined, {}, { toolToken: () => '' }]) {
    if (bridge === undefined) delete globalThis[authKey]
    else globalThis[authKey] = bridge
    await assert.rejects(read.execute({}, exec), /session authentication is required/)
  }
  assert.equal(calls.length, 0, 'Missing user authentication never falls back to the service proxy')
  globalThis[authKey] = { toolToken: id => { assert.equal(id, sessionId); return token } }
  assert.deepEqual(await read.execute({}, exec), { accepted: true })
  const first = calls[0]
  assert.equal(first.url, 'http://business-runtime:8078/ai/harness/execute')
  assert.equal(first.options.method, 'POST')
  assert.equal(first.options.headers.authorization, `Bearer ${token}`)
  assert.equal(first.options.signal, exec.signal)
  assert.equal(first.body.session_id, sessionId)
  assert.equal(first.body.plugin_id, 'enterprise-bi')
  assert.equal(first.body.agent_id, 'enterprise_analyst')
  assert.equal(first.body.capability_id, read.name)
  assert.equal(first.body.mode, 'standard')
  assert.deepEqual(first.body.payload, {})
  assert.equal(first.body.confirmed, undefined)
  assert.equal(first.body.idempotency_key, undefined)

  const payload = { operation: 'qualify_lead', lead_id: 'lead-one', score: 80 }
  await assert.rejects(write.execute(payload, exec), /not approved/)
  approval = { request: async request => { approvals.push(request); return 'denied' } }
  await assert.rejects(write.execute(payload, exec), /not approved/)
  assert.equal(calls.length, 1, 'Unapproved writes never reach the gateway')
  approval = { request: async request => { approvals.push(request); return 'allowed-once' } }
  assert.deepEqual(await write.execute(payload, exec), { accepted: true })
  const approved = calls[1]
  assert.equal(approved.url, first.url)
  assert.equal(approved.options.headers.authorization, `Bearer ${token}`)
  assert.equal(approved.body.session_id, sessionId)
  assert.equal(approved.body.plugin_id, 'company-sales')
  assert.equal(approved.body.agent_id, 'company_sales_agent')
  assert.equal(approved.body.capability_id, write.name)
  assert.deepEqual(approved.body.payload, payload)
  assert.equal(approved.body.confirmed, true)
  assert.match(approved.body.idempotency_key, /^[0-9a-f]{64}$/)
  assert.match(approved.body.request_id, /^[0-9a-f-]{36}$/i)
  assert.equal(approvals.at(-1).agent, exec.agent)
  assert.equal(approvals.at(-1).toolName, write.name)
  assert.equal(approvals.at(-1).callId, exec.callId)
  await write.execute(payload, exec)
  assert.equal(calls[2].body.idempotency_key, approved.body.idempotency_key, 'A retried approved tool call keeps its idempotency key')
  assert.notEqual(calls[2].body.request_id, approved.body.request_id)
  token = ''
  const beforeLogout = calls.length
  const beforeLogoutApproval = approvals.length
  await assert.rejects(read.execute({}, exec), /session authentication is required/)
  await assert.rejects(write.execute(payload, exec), /session authentication is required/)
  assert.equal(calls.length, beforeLogout)
  assert.equal(approvals.length, beforeLogoutApproval, 'Logout is checked before requesting write approval')

  const genericTools = ['bash', 'pwsh', 'jobs', 'fs', 'fs-search', 'skill', 'subagent', 'subagent-control', 'subagent-list-agents', 'subagent-fork', 'workflow', 'todo', 'goal', 'ralph', 'str-replace-editor', 'web']
  const sdkRoot = process.env.EISCORE_DSH_SDK_ROOT
  const interpolate = sdkRoot
    ? (await import(pathToFileURL(resolve(sdkRoot, '@deepseek-ai/cordis-plugin-loader/lib/index.js')).href)).interpolate
    : null
  for (const name of ['dsh-web.patch.yml', 'dsh-flash-web.patch.yml']) {
    const patch = readFileSync(new URL(name, import.meta.url), 'utf8')
    for (const id of genericTools) assert.match(patch, new RegExp(`(?:^|\\n)- id: tool-${id}\\r?\\n  disabled: true(?:\\r?\\n|$)`), `${name} disables generic tool ${id}`)
    for (const id of ['agent-presets', 'ui-agent-preset', 'session-log-download', 'cordis-client-runner', 'ui-cordis']) assert.match(patch, new RegExp(`(?:^|\\n)- id: ${id}\\r?\\n  disabled: true(?:\\r?\\n|$)`), `${name} disables ${id}`)
    const model = patch.match(/(?:^|\n)- id: agent-default-model\r?\n  config:\r?\n    provider: !!js ([^\r\n]+)\r?\n    model: !!js ([^\r\n]+)/)
    assert.ok(model, `${name} supplies evaluated provider/model overrides`)
    for (const [env, expected] of [
      [{}, ['deepseek-official', 'deepseek-flash']],
      [{ DSH_PROVIDER: 'test-provider', DSH_MODEL: 'test-model' }, ['test-provider', 'test-model']]
    ]) {
      assert.deepEqual(model.slice(1).map(expression => vm.runInNewContext(expression, { process: { env } })), expected)
      if (interpolate) {
        for (const key of ['DSH_PROVIDER', 'DSH_MODEL']) {
          if (env[key] === undefined) delete process.env[key]
          else process.env[key] = env[key]
        }
        assert.deepEqual(model.slice(1).map(expression => interpolate({}, { __jsExpr: expression })), expected)
      }
    }
  }
  console.log(`PASS: business Web authentication, policy identity, approved sales writes, logout, restricted patches and model overrides${interpolate ? ' (actual SDK interpolation)' : ''}`)
} finally {
  globalThis.fetch = originalFetch
  if (originalAuth === undefined) delete globalThis[authKey]
  else globalThis[authKey] = originalAuth
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name]
    else process.env[name] = originalEnv[name]
  }
}
