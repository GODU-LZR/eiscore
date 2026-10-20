import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('./client-plugins/business-entry/lib/client.js', import.meta.url), 'utf8')
const listeners = new Map()
const sent = []
const requests = []
const drafts = new Map()
const sessionRoles = new Map()
const byId = {}
let counter = 0
let identity = 'owner-a'
let current
let plugin
let dispose
let renderDraft = ''
let beforeCreate
const subscribers = new Set()
const archivedSessionIds = []
const notify = () => { for (const callback of subscribers) callback() }
const parent = { postMessage: (value) => sent.push(value) }
const window = {
  parent,
  addEventListener: (type, callback) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback) },
  removeEventListener: (type, callback) => listeners.get(type)?.delete(callback),
  dispatchEvent: (event) => { for (const callback of listeners.get(event.type) || []) callback(event) },
  __ModuleLoader__: { load: (value) => { plugin = value.factory() } },
  async fetch(input, init) {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.pathname.endsWith('/business/context')) {
      assert.equal(url.pathname, '/harness-embed-api/eiscore/business/context')
      return Response.json({ owner: identity, workspaceId: 'business-ws', title: '业务助手工作区', sessions: Object.fromEntries([...sessionRoles].filter(([, value]) => value.owner === identity).map(([id, value]) => [id, value.entry])) })
    }
    const body = JSON.parse(init.body)
    const inputBody = body.payload.args.request
    const entry = new Headers(init.headers).get('x-eis-business-entry')
    requests.push({ url: url.pathname, input: inputBody, entry })
    if (url.pathname.endsWith('/create')) {
      if (beforeCreate) await beforeCreate()
      const id = `native-${++counter}`
      assert.equal(inputBody.workspaceId, 'business-ws')
      if (entry) sessionRoles.set(id, { owner: identity, entry })
      return Response.json({ result: { ok: true, value: { sessionId: id } } })
    }
    return Response.json({ result: { ok: true } })
  }
}
const nativeFetch = window.fetch
const dataset = {}
const list = { getSnapshot: () => ({ current, byId, ids: Object.keys(byId), phase: 'ready' }), subscribe: (callback) => { subscribers.add(callback); return () => subscribers.delete(callback) } }
const sessions = {
  list,
  async create(input) {
    const response = await window.fetch(new URL('https://example.test/api/session/create'), { method: 'POST', body: JSON.stringify({ type: 'client-request', method: 'session/create', payload: { args: { request: input } } }) })
    const id = (await response.json()).result.value.sessionId
    byId[id] = { id, updatedAt: counter, cwd: '/workspaces/business', blank: true }
    drafts.set(id, '')
    notify()
    return id
  },
  open(id) { current = id; renderDraft = drafts.get(id) || ''; notify() },
  binding: (id) => byId[id] && { ctx: { id }, session: { getSnapshot: () => ({ openState: 'open' }) } }
}
let originalNewCalls = 0
const workspace = { startSession() { originalNewCalls++ } }
const nativeStart = workspace.startSession
const context = {
  sessions,
  workspaces: { list: { getSnapshot: () => ({ phase: 'ready', archivedSessionIds, items: [{ workspaceId: 'business-ws', path: '/workspaces/business' }, { workspaceId: 'old-workspace' }] }) } },
  conversation: { input: { for: (ctx) => ({ state: { getSnapshot: () => ({ draft: drafts.get(ctx.id) || '' }) } }) } },
  uiWorkspace: workspace,
  on: (type, callback) => { if (type === 'dispose') dispose = callback }
}
const document = { documentElement: { dataset }, querySelector: () => ({ get innerText() { return renderDraft } }) }
vm.runInNewContext(source, { window, document, location: { pathname: '/harness-embed/', origin: 'https://example.test' }, Request, Headers, URL, AbortSignal, Event, setTimeout, requestAnimationFrame: (callback) => setTimeout(callback, 0) })
plugin.apply(context)
assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), { type: 'eiscore:harness-entry-ready', version: 1 })
const send = (entry, id, extra = {}, origin = 'https://example.test', source = parent) => window.dispatchEvent({ type: 'message', origin, source, data: { type: 'eiscore:harness-entry', version: 1, entry, id, ...extra } })
const waitFor = async (test) => {
  for (let attempt = 0; attempt < 200; attempt++) { if (test()) return; await new Promise((resolve) => setTimeout(resolve, 5)) }
  throw new Error('client condition timed out')
}
const ack = (id, status = 'applied') => sent.some((item) => item.id === id && item.status === status)
send('worker', 'bad', { token: 'forbidden-extra' })
send('worker', 'bad', {}, 'https://other.test')
send('flash', 'bad')
await new Promise((resolve) => setTimeout(resolve, 10))
assert.equal(counter, 0)

send('worker', 'worker-1')
assert.equal(dataset.eisHarnessEntryReady, 'false')
await waitFor(() => ack('worker-1'))
const workerId = current
assert.equal(dataset.eisHarnessWorkspaceId, 'business-ws')
assert.equal(dataset.eisHarnessEntrySession, workerId)
drafts.set(workerId, '员工草稿'); renderDraft = '员工草稿'
send('workbench', 'analysis-1')
assert.equal(dataset.eisHarnessEntryState, 'switching')
await waitFor(() => ack('analysis-1'))
const analysisId = current
assert.notEqual(workerId, analysisId)
assert.equal(drafts.get(analysisId), '')
drafts.set(analysisId, '分析草稿'); renderDraft = '分析草稿'
send('worker', 'worker-2')
await waitFor(() => ack('worker-2'))
assert.equal(current, workerId)
assert.equal(renderDraft, '员工草稿')
send('workbench', 'analysis-2')
await waitFor(() => ack('analysis-2'))
assert.equal(current, analysisId)
assert.equal(renderDraft, '分析草稿')

// Native New Session always creates the current role, even if another role has a blank session.
workspace.startSession('old-workspace')
await waitFor(() => dataset.eisHarnessEntryReady === 'true' && current !== analysisId)
assert.equal(originalNewCalls, 0)
assert.equal(sessionRoles.get(current).entry, 'workbench')
assert.equal(requests.at(-1).input.workspaceId, 'business-ws')

// Archiving a selected role session reuses an older live session, never archived history.
const latestAnalysisId = current
archivedSessionIds.push(latestAnalysisId)
send('workbench', 'archive-latest')
await waitFor(() => ack('archive-latest'))
assert.equal(current, analysisId)
// When every session of the requested role is archived, create a fresh same-role session.
archivedSessionIds.push(analysisId)
send('workbench', 'archive-all')
await waitFor(() => ack('archive-all'))
assert.notEqual(current, analysisId)
assert.notEqual(current, latestAnalysisId)
assert.equal(sessionRoles.get(current).entry, 'workbench')
assert.equal(archivedSessionIds.includes(current), false)

// Manual old/other-role history continues using the original persona and cannot receive host drafts.
sessions.open(workerId)
assert.equal(dataset.eisHarnessEntryReady, 'false')
assert.equal(dataset.eisHarnessHistoryRole, 'worker')
const prompt = (id) => window.fetch('https://example.test/api/session/prompt', { method: 'POST', body: JSON.stringify({ type: 'client-request', method: 'session/prompt', payload: { args: { request: { sessionId: id } } } }) })
await prompt(workerId)
assert.equal(requests.at(-1).entry, 'worker')
byId.legacy = { id: 'legacy', updatedAt: 0 }; drafts.set('legacy', '旧草稿')
sessions.open('legacy')
assert.equal(dataset.eisHarnessHistoryRole, 'legacy')
await prompt('legacy')
assert.equal(requests.at(-1).entry, null)
send('worker', 'worker-3')
await waitFor(() => ack('worker-3'))
assert.equal(current, workerId)

// An older in-flight create never wins selection or ACK after a newer entry request.
let release
beforeCreate = () => new Promise((resolve) => { release = resolve })
workspace.startSession()
await waitFor(() => release)
send('workbench', 'race-analysis')
release(); beforeCreate = undefined
await waitFor(() => ack('race-analysis'))
assert.equal(dataset.eisHarnessEntry, 'workbench')
assert.equal(sessionRoles.get(current).entry, 'workbench')

identity = 'owner-b'
send('worker', 'identity-b')
await waitFor(() => ack('identity-b'))
assert.notEqual(current, workerId)
assert.equal(sessionRoles.get(current).owner, 'owner-b')
dispose()
assert.equal(window.fetch, nativeFetch)
assert.equal(workspace.startSession, nativeStart)
assert.equal(dataset.eisHarnessEntryReady, 'false')
console.log('PASS: native workspace/session selection, archived-session fallback and recreation, independent drafts, native New Session role, history prompts, strict parent protocol, stale switch, identity reset, cleanup')
