import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))
const loginSource = readFileSync(resolve(root, '../../../eiscore-base/src/views/LoginView.vue'), 'utf8')
const clientPath = resolve(root, '../../../eiscore-base/src/services/harness-auth-client.js')
const clientSource = readFileSync(clientPath, 'utf8')

assert.match(clientSource, /export async function refreshKnowledgeHarnessAuthState\(\)/)
assert.match(clientSource, /['"]\/harness-knowledge-embed-api\/eiscore\/auth\/start['"]/) 
assert.match(loginSource, /refreshKnowledgeHarnessAuthState/)
const refreshIndex = loginSource.indexOf('refreshKnowledgeHarnessAuthState()')
const handoffIndex = loginSource.indexOf("fetch('/company-site/auth/handoff'")
assert.ok(refreshIndex >= 0 && refreshIndex < handoffIndex, 'knowledge auth state must refresh before issuing handoff code')
assert.match(loginSource, /returnUrl\.pathname === '\/harness-knowledge-embed-api\/eiscore\/auth\/handoff'[\s\S]*?refreshKnowledgeHarnessAuthState\(\)/)

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const requests = []
globalThis.window = { location: { origin: 'https://huizong.eiscore.top' } }
globalThis.fetch = async (url, options) => {
  requests.push({ url, options })
  return { ok: true, json: async () => ({ url: 'https://huizong.eiscore.top/login' }) }
}
try {
  const { refreshKnowledgeHarnessAuthState } = await import(`${pathToFileURL(clientPath).href}?knowledge-auth-regression`)
  assert.equal(await refreshKnowledgeHarnessAuthState(), true)
  assert.deepEqual(requests, [{
    url: '/harness-knowledge-embed-api/eiscore/auth/start',
    options: { credentials: 'same-origin', method: 'POST', headers: { Accept: 'application/json' } }
  }])
} finally {
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
}

console.log('PASS: knowledge Harness refreshes its auth state before handoff; ordinary and Flash callbacks remain unchanged')
