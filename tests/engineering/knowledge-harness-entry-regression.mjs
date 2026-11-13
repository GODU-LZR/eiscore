import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const loadSource = (path) => readFile(resolve(root, path), 'utf8')

const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const calls = []
const respond = (ok, payload = {}) => ({
  ok,
  async json() { return payload }
})

globalThis.window = { location: { origin: 'https://huizong.example.test' } }
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options })
  if (String(url).endsWith('/eiscore/auth/start')) {
    return respond(true, { url: 'https://huizong.example.test/login?dsh_return=%2Fhandoff' })
  }
  if (url === '/company-site/auth/handoff') return respond(true, { code: 'one-time-code' })
  if (String(url).endsWith('/eiscore/auth/handoff')) return respond(true)
  return respond(true)
}

let auth
try {
  auth = await import(`${pathToFileURL(resolve(root, 'eiscore-base/src/services/harness-auth-client.js')).href}?regression=${Date.now()}`)

  assert.equal(await auth.prepareHarnessAuth({
    harnessWebUrl: '/harness-knowledge-embed/',
    authApiPrefix: '/harness-knowledge-embed-api',
    authorization: 'Bearer test-session'
  }), true, 'knowledge Harness authentication should complete')
  assert.deepEqual(calls.map(({ url }) => url), [
    '/harness-knowledge-embed-api/eiscore/auth/start',
    '/company-site/auth/handoff',
    '/harness-knowledge-embed-api/eiscore/auth/handoff'
  ], 'knowledge auth should hand off without probing the protected HTML entry')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-session')
  assert.equal(calls[2].options.body, JSON.stringify({ code: 'one-time-code' }))

  calls.length = 0
  assert.equal(await auth.prepareHarnessAuth({ authApiPrefix: '/untrusted-auth-prefix' }), false)
  assert.equal(calls.length, 0, 'unsupported auth prefixes must not issue requests')

  calls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    return respond(true, { url: 'https://other.example.test/login' })
  }
  assert.equal(await auth.prepareHarnessAuth({
    authApiPrefix: '/harness-knowledge-embed-api',
    authorization: 'Bearer test-session'
  }), false, 'cross-origin login URLs must be rejected')
  assert.equal(calls.length, 1, 'cross-origin login must stop before creating a handoff')

  calls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/eiscore/auth/start')) {
      return respond(true, { url: 'https://huizong.example.test/login' })
    }
    if (url === '/company-site/auth/handoff') return respond(true, { code: 'one-time-code' })
    return respond(false)
  }
  assert.equal(await auth.prepareHarnessAuth({
    authApiPrefix: '/harness-knowledge-embed-api',
    authorization: 'Bearer test-session'
  }), false, 'a failed Harness bridge must not report successful authentication')

  calls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/eiscore/auth/start')) {
      return respond(true, { url: 'https://huizong.example.test/login' })
    }
    if (url === '/company-site/auth/handoff') return respond(true, { code: 'one-time-code' })
    return respond(true)
  }
  assert.equal(await auth.prepareHarnessAuth({
    harnessWebUrl: '/harness-embed/',
    authApiPrefix: '/harness-embed-api',
    authorization: 'Bearer test-session'
  }), true, 'the ordinary Harness handoff should remain supported')
  assert.equal(calls[0].url, '/harness-embed/')
  assert.equal(calls[0].options.method, 'GET', 'ordinary Harness should preserve its HTML preflight')
  assert.equal(calls.length, 4)

  calls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/eiscore/auth/start')) {
      return respond(true, { url: 'https://huizong.example.test/login' })
    }
    if (url === '/company-site/auth/handoff') return respond(true, { code: 'one-time-code' })
    return respond(true)
  }
  assert.equal(await auth.prepareHarnessAuth({
    harnessWebUrl: '/harness-flash-embed/',
    authApiPrefix: '/harness-flash-embed-api',
    authorization: 'Bearer test-session'
  }), true, 'the Flash Harness handoff should remain supported')
  assert.equal(calls[0].url, '/harness-flash-embed/')
  assert.equal(calls[0].options.method, 'GET', 'Flash Harness should preserve its HTML preflight')
  assert.equal(calls.length, 4)

  calls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    return respond(true)
  }
  assert.equal(await auth.completeHarnessAuth({
    code: 'one-time-code',
    callbackPath: '/harness-knowledge-embed-api/eiscore/auth/handoff'
  }), true, 'the knowledge auth callback should remain supported')
  assert.deepEqual(calls.map(({ url }) => url), ['/harness-knowledge-embed-api/eiscore/auth/handoff'])
} finally {
  if (fetchDescriptor) Object.defineProperty(globalThis, 'fetch', fetchDescriptor)
  else delete globalThis.fetch
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
  else delete globalThis.window
}

const dashboard = await loadSource('eiscore-apps/src/views/AppDashboard.vue')
const routes = await loadSource('eiscore-apps/src/router/index.js')
const appMain = await loadSource('eiscore-apps/src/main.js')
const knowledgeView = await loadSource('eiscore-apps/src/views/EnterpriseKnowledgeWorkbench.vue')

assert.match(dashboard, /key: 'enterprise-knowledge'[\s\S]*?name: '企业知识库'[\s\S]*?metrics: \[\]/)
assert.match(dashboard, /key: 'ontology-workbench'[\s\S]*?name: '大脑本体知识库'[\s\S]*?metrics: \[\]/)
assert.match(dashboard, /entry\.key === 'enterprise-knowledge'[\s\S]*?router\.push\('\/enterprise-knowledge'\)/)
assert.match(dashboard, /visible: canManage\.value[\s\S]*?isAppVisible\(displayVisibility\.value, 'apps', entry\.key\)/)
assert.match(routes, /path: '\/enterprise-knowledge\/:appId\?'[\s\S]*?name: 'EnterpriseKnowledgeWorkbench'[\s\S]*?EnterpriseKnowledgeWorkbench\.vue[\s\S]*?requiresManage: true/)
assert.match(routes, /path: '\/ontology-relations\/:appId\?'[\s\S]*?name: 'OntologyWorkbench'[\s\S]*?OntologyWorkbench\.vue[\s\S]*?requiresManage: true/)
assert.match(appMain, /to\.meta\?\.requiresManage && !canAccessAppCenterManage\(\)/)
assert.match(knowledgeView, /src="\/harness-knowledge-embed\/#digital-twin"/)
assert.match(knowledgeView, /height:\s*100%/)
assert.match(knowledgeView, /min-height:\s*calc\(100vh\s*-\s*32px\)/)

console.log('PASS: isolated knowledge Harness entry, auth handoff, and ontology entry coexist')
