import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { webcrypto } from 'node:crypto'

// Run the actual bridge class with browser/platform adapters stubbed out.
const source = readFileSync(new URL('../../eiscore-base/src/utils/ai-bridge.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
  .replace('export const aiBridge = new AiBridge()', 'globalThis.aiBridge = new AiBridge()')
const payloads = []
const requests = []
let streamBehavior = 'success'
class FixedDate extends Date {
  static now() { return 1791892412374 }
}
const sandbox = {
  console, AbortController, Date: FixedDate, crypto: webcrypto, setTimeout,
  reactive: (value) => value, watch: () => {}, getToken: () => 'current-user-jwt',
  createAssistantModeHistory: () => ({ load: () => ({}), saveMode: (value) => value }),
  shouldPrefetchGridAgentQuery: (text) => !/创建/.test(text),
  buildGridAgentQueryPayload: () => ({ operation: 'count' }),
  formatGridAgentQueryResultForPrompt: (value) => value ? `SERVER_COUNT=${value.totalCount}` : '',
  buildSmartBiContext: () => null,
  request: async (options) => { requests.push(options); return { scope: 'server', totalCount: 6 } },
  streamAgentEvents: async (options) => {
    payloads.push(structuredClone(options.payload))
    if (streamBehavior === 'denied') {
      await options.onResponse({ ok: false, status: 403, headers: { get: () => null }, text: async () => 'HARNESS_PERMISSION_DENIED' })
    }
    options.onData(JSON.stringify({ choices: [{ delta: { content: '查询成功' } }] }))
    if (streamBehavior === 'partial') throw new Error('input stream disconnected')
  }
}
runInNewContext(source, sandbox)
const bridge = sandbox.aiBridge
bridge.setMode('worker')
bridge.state.currentContext = { gridAgent: { capabilities: { serverAgentQuery: true } } }
await bridge.sendMessage('当前有多少用户')
await bridge.sendMessage('再查询一下用户')
assert.equal(payloads.length, 2)
assert.equal(payloads[0].session_id, payloads[1].session_id, 'follow-up must stay in the same Harness session')
assert.match(payloads[0].session_id, /^host-worker-/)
for (const payload of payloads) {
  assert.equal(payload.messages.at(-1).role, 'user', 'empty assistant placeholder must never carry prefetched data')
  assert.ok(payload.messages.at(-1).content.some((part) => part.text === 'SERVER_COUNT=6'))
  assert.ok(payload.messages.every((message) => message.content.length > 0))
}
assert.equal(requests.filter(({ url }) => url === '/ai/config').length, 0, 'chat must not trigger an unused optional configuration request/toast')
await bridge.sendMessage('创建一个用户')
assert.equal(requests.length, 2, 'creation must not be treated as an authorized user-count query')
assert.ok(payloads.at(-1).messages.at(-1).content.every((part) => !part.text.includes('SERVER_COUNT')))
bridge.createNewSession()
await bridge.sendMessage('当前有多少用户')
assert.notEqual(payloads[0].session_id, payloads.at(-1).session_id)
assert.equal(new Set(bridge.state.sessions.map(({ id }) => id)).size, bridge.state.sessions.length, 'sessions created within one millisecond must remain isolated')
bridge.setMode('enterprise')
await bridge.sendMessage('经营情况')
assert.match(payloads.at(-1).session_id, /^host-enterprise-/)

streamBehavior = 'denied'
const beforeDenied = payloads.length
await bridge.sendMessage('查询用户')
assert.equal(payloads.length, beforeDenied + 1, 'permission errors must not silently retry')
assert.match(bridge.getCurrentSession().messages.at(-1).content, /助手请求失败: 403.*HARNESS_PERMISSION_DENIED/)

streamBehavior = 'partial'
const beforePartial = payloads.length
await bridge.sendMessage('继续')
assert.equal(payloads.length, beforePartial + 1, 'partial replies must not be discarded and resent')
assert.match(bridge.getCurrentSession().messages.at(-1).content, /查询成功.*\[Error: input stream disconnected\]/s)

sandbox.buildGridAgentQueryPayload = () => ({ columns: [{ prop: 'id' }, { prop: 'password' }, { prop: 'email' }, { prop: 'phone' }] })
sandbox.request = async (options) => {
  requests.push(options)
  return { totalCount: 6, sample: [{ id: 1, username: 'tester', password: 'private', email: 'private', phone: 'private' }] }
}
const safeUsers = await bridge.prefetchGridAgentQuery('列出用户', { viewId: 'hr_user_manage' })
assert.deepEqual(JSON.parse(JSON.stringify(safeUsers.sample)), [{ id: 1, username: 'tester' }])
assert.deepEqual(JSON.parse(JSON.stringify(requests.at(-1).data.payload.columns)), [{ prop: 'id' }])
sandbox.buildGridAgentQueryPayload = () => ({ columns: [{ prop: 'email' }], group_by: 'email' })
const beforePrivateQuery = requests.length
assert.equal(await bridge.prefetchGridAgentQuery('按邮箱统计', { viewId: 'hr_user_manage' }), null)
assert.equal(requests.length, beforePrivateQuery, 'sensitive grouping must not reach the users RPC')

// HTTP development origins expose getRandomValues without randomUUID.
sandbox.crypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }
const beforeFallback = bridge.state.currentSessionId
bridge.createNewSession()
const firstFallback = bridge.state.currentSessionId
bridge.createNewSession()
assert.equal(new Set([beforeFallback, firstFallback, bridge.state.currentSessionId]).size, 3, 'sessions must also remain isolated without randomUUID')
console.log('PASS: host assistant stable sessions, query provenance and visible pre-completion failures')
