// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { ensureHarnessAuth, prepareHarnessAuth } from '../../packages/eiscore-platform/src/harness-auth.mjs'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
globalThis.window = { location: { origin: 'https://yayu.example' } }
const makeToken = (claims) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
const authorization = `Bearer ${makeToken({ sub: 'user-1', username: 'alice', app_role: 'admin', tenant_id: 'tenant-1' })}`
const currentUser = { id: 'user-1', username: 'alice', role: 'admin', tenant_id: 'tenant-1' }

try {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === '/harness-embed/') return { ok: true, json: async () => ({}) }
    if (url.endsWith('/auth/start')) return { ok: true, json: async () => ({ url: 'https://yayu.example/login?token=x' }) }
    if (url === '/company-site/auth/handoff') return { ok: true, json: async () => ({ code: 'single-use' }) }
    return { ok: true, json: async () => ({}) }
  }

  assert.equal(await prepareHarnessAuth({ harnessWebUrl: '/harness-embed/', authorization }), true)
  assert.deepEqual(calls.map(({ url }) => url), [
    '/harness-embed-api/eiscore/auth/start',
    '/company-site/auth/handoff',
    '/harness-embed-api/eiscore/auth/handoff'
  ])
  assert.equal(calls[1].options.headers.Authorization, authorization)
  assert.deepEqual(JSON.parse(calls[2].options.body), { code: 'single-use' })

  const rejectedCalls = []
  globalThis.fetch = async (url) => {
    rejectedCalls.push(url)
    if (url.endsWith('/auth/start')) return { ok: true, json: async () => ({ url: 'https://attacker.example/login' }) }
    return { ok: true, json: async () => ({}) }
  }
  assert.equal(await prepareHarnessAuth({ harnessWebUrl: '/harness-embed/' }), false)
  assert.deepEqual(rejectedCalls, ['/harness-embed-api/eiscore/auth/start'])

  assert.equal(await prepareHarnessAuth({ harnessWebUrl: '/harness-embed/', authApiPrefix: '/other' }), false)

  const statusCalls = []
  globalThis.fetch = async (url, options = {}) => {
    statusCalls.push({ url, options })
    return { ok: true, json: async () => ({ authenticated: true, user: currentUser }) }
  }
  assert.equal(await ensureHarnessAuth({ harnessWebUrl: '/harness-embed/', authorization }), true)
  assert.deepEqual(statusCalls.map(({ url }) => url), ['/harness-embed-api/eiscore/auth/status'])
  assert.equal(statusCalls[0].options.credentials, 'same-origin')
  assert.equal(statusCalls[0].options.cache, 'no-store')

  const switchedAccountCalls = []
  globalThis.fetch = async (url) => {
    switchedAccountCalls.push(url)
    if (url.endsWith('/auth/status')) return { ok: true, json: async () => ({ authenticated: true, user: { ...currentUser, id: 'user-2', username: 'bob' } }) }
    if (url.endsWith('/auth/start')) return { ok: true, json: async () => ({ url: 'https://yayu.example/login?token=x' }) }
    if (url === '/company-site/auth/handoff') return { ok: true, json: async () => ({ code: 'single-use' }) }
    return { ok: true, json: async () => ({}) }
  }
  assert.equal(await ensureHarnessAuth({ harnessWebUrl: '/harness-embed/', authorization }), true)
  assert.deepEqual(switchedAccountCalls, [
    '/harness-embed-api/eiscore/auth/status',
    '/harness-embed-api/eiscore/auth/start',
    '/company-site/auth/handoff',
    '/harness-embed-api/eiscore/auth/handoff'
  ], 'a valid cookie for another account must be replaced')

  const recoveryCalls = []
  globalThis.fetch = async (url) => {
    recoveryCalls.push(url)
    if (url.endsWith('/auth/status')) return { ok: false, json: async () => ({ authenticated: false }) }
    if (url.endsWith('/auth/start')) return { ok: true, json: async () => ({ url: 'https://yayu.example/login?token=x' }) }
    if (url === '/company-site/auth/handoff') return { ok: true, json: async () => ({ code: 'single-use' }) }
    return { ok: true, json: async () => ({}) }
  }
  assert.equal(await ensureHarnessAuth({ harnessWebUrl: '/harness-embed/', authorization }), true)
  assert.deepEqual(recoveryCalls, [
    '/harness-embed-api/eiscore/auth/status',
    '/harness-embed-api/eiscore/auth/start',
    '/company-site/auth/handoff',
    '/harness-embed-api/eiscore/auth/handoff'
  ])

  recoveryCalls.length = 0
  assert.equal(await ensureHarnessAuth({ harnessWebUrl: '/harness-embed/', authorization: 'Bearer token' }, () => false), false)
  assert.equal(recoveryCalls.length, 0, 'a stale mount must not renew another user session')

  let current = true
  const staleFlowCalls = []
  globalThis.fetch = async (url) => {
    staleFlowCalls.push(url)
    if (url.endsWith('/auth/status')) return { ok: false, json: async () => ({ authenticated: false }) }
    if (url.endsWith('/auth/start')) {
      current = false
      return { ok: true, json: async () => ({ url: 'https://yayu.example/login?token=x' }) }
    }
    return { ok: true, json: async () => ({ code: 'unused' }) }
  }
  assert.equal(await ensureHarnessAuth({ harnessWebUrl: '/harness-embed/', authorization }, () => current), false)
  assert.deepEqual(staleFlowCalls, [
    '/harness-embed-api/eiscore/auth/status',
    '/harness-embed-api/eiscore/auth/start'
  ], 'a handoff must stop when its account becomes stale')

  console.log('PASS: shared Harness auth handshake and same-origin redirect validation')
} finally {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
}
