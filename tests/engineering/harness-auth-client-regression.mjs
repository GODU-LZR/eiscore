// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { prepareHarnessAuth } from '../../packages/eiscore-platform/src/harness-auth.mjs'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
globalThis.window = { location: { origin: 'https://yayu.example' } }

try {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === '/harness-embed/') return { ok: true, json: async () => ({}) }
    if (url.endsWith('/auth/start')) return { ok: true, json: async () => ({ url: 'https://yayu.example/login?token=x' }) }
    if (url === '/company-site/auth/handoff') return { ok: true, json: async () => ({ code: 'single-use' }) }
    return { ok: true, json: async () => ({}) }
  }

  assert.equal(await prepareHarnessAuth({ harnessWebUrl: '/harness-embed/', authorization: 'Bearer token' }), true)
  assert.deepEqual(calls.map(({ url }) => url), [
    '/harness-embed/',
    '/harness-embed-api/eiscore/auth/start',
    '/company-site/auth/handoff',
    '/harness-embed-api/eiscore/auth/handoff'
  ])
  assert.equal(calls[1].options.headers.Authorization, 'Bearer token')
  assert.deepEqual(JSON.parse(calls[3].options.body), { code: 'single-use' })

  const rejectedCalls = []
  globalThis.fetch = async (url) => {
    rejectedCalls.push(url)
    if (url.endsWith('/auth/start')) return { ok: true, json: async () => ({ url: 'https://attacker.example/login' }) }
    return { ok: true, json: async () => ({}) }
  }
  assert.equal(await prepareHarnessAuth({ harnessWebUrl: '/harness-embed/' }), false)
  assert.deepEqual(rejectedCalls, ['/harness-embed/', '/harness-embed-api/eiscore/auth/start'])

  assert.equal(await prepareHarnessAuth({ harnessWebUrl: '/harness-embed/', authApiPrefix: '/other' }), false)
  console.log('PASS: shared Harness auth handshake and same-origin redirect validation')
} finally {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
}
