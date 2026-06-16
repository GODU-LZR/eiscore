// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  createHttpClient,
  isRemoteTarget,
  normalizePositiveInteger,
  shouldRetryMethod,
  shouldRetryStatus
} from './http-client.mjs'

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  })
}

assert.equal(normalizePositiveInteger('bad', 3, { min: 1, max: 8 }), 3, 'invalid numbers should use fallback')
assert.equal(normalizePositiveInteger(0, 3, { min: 1, max: 8 }), 3, 'zero should use fallback')
assert.equal(normalizePositiveInteger(20, 3, { min: 1, max: 8 }), 8, 'numbers should be clamped to max')
assert.equal(isRemoteTarget('http://localhost:8080'), false, 'localhost should be local')
assert.equal(isRemoteTarget('https://nanpai.eissys.top'), true, 'public HTTPS hosts should be remote')
assert.equal(shouldRetryStatus(502), true, 'gateway errors should be retryable')
assert.equal(shouldRetryStatus(429), true, 'rate limits should be retryable')
assert.equal(shouldRetryStatus(403), false, 'authorization failures should not be retryable')
assert.equal(shouldRetryMethod('GET'), true, 'GET should be retryable')
assert.equal(shouldRetryMethod('POST'), false, 'unsafe methods should not retry by default')
assert.equal(shouldRetryMethod('POST', true), true, 'unsafe retries should require explicit opt-in')

{
  const calls = []
  const client = createHttpClient({
    baseUrl: 'https://nanpai.eissys.top/',
    requestAttempts: 3,
    retryDelayMs: 1,
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body })
      return calls.length === 1
        ? jsonResponse({ error: 'temporary' }, 502)
        : jsonResponse({ ok: true }, 200)
    }
  })
  const out = await client.requestJson('/api/roles', { method: 'GET' })
  assert.equal(out.status, 200, 'GET should retry after 502 and return the successful response')
  assert.equal(out.data.ok, true, 'JSON responses should be parsed')
  assert.equal(calls.length, 2, 'GET should use a second attempt')
  assert.equal(calls[0].url, 'https://nanpai.eissys.top/api/roles', 'base URL should be normalized')
}

{
  const calls = []
  const client = createHttpClient({
    baseUrl: 'https://nanpai.eissys.top',
    requestAttempts: 3,
    retryDelayMs: 1,
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body })
      return jsonResponse({ error: 'do not retry writes' }, 502)
    }
  })
  const out = await client.requestJson('/api/apps', { method: 'POST', body: { name: 'x' } })
  assert.equal(out.status, 502, 'POST should return the first retryable response by default')
  assert.equal(calls.length, 1, 'POST should not be retried by default')
  assert.equal(calls[0].body, '{"name":"x"}', 'object bodies should be JSON encoded')
}

{
  const calls = []
  const formBody = new URLSearchParams({ q: '研发' })
  const client = createHttpClient({
    baseUrl: 'https://nanpai.eissys.top',
    requestAttempts: 1,
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body })
      return jsonResponse({ ok: true }, 200)
    }
  })
  const out = await client.requestJson('/api/search', { method: 'POST', body: formBody })
  assert.equal(out.status, 200, 'URLSearchParams bodies should be accepted')
  assert.equal(calls[0].body, formBody, 'native body types should pass through without JSON encoding')
}

{
  const calls = []
  const client = createHttpClient({
    baseUrl: 'https://nanpai.eissys.top',
    requestAttempts: 3,
    retryDelayMs: 1,
    retryUnsafeMethods: true,
    fetchImpl: async () => {
      calls.push(true)
      return calls.length < 3 ? jsonResponse({ error: 'temporary' }, 503) : jsonResponse({ ok: true }, 200)
    }
  })
  const out = await client.requestJson('/api/rpc/login', { method: 'POST', body: { username: 'admin' } })
  assert.equal(out.status, 200, 'explicit unsafe retry opt-in should retry POST')
  assert.equal(calls.length, 3, 'POST should retry only when explicitly enabled')
}

{
  const calls = []
  const client = createHttpClient({
    baseUrl: 'https://nanpai.eissys.top',
    requestAttempts: 3,
    retryDelayMs: 1,
    fetchImpl: async () => {
      calls.push(true)
      if (calls.length === 1) throw new Error('network reset')
      return new Response('plain text', { status: 200 })
    }
  })
  const out = await client.requestJson('/api/plain', { method: 'GET' })
  assert.equal(out.status, 200, 'GET should retry after a network error')
  assert.equal(out.data, 'plain text', 'non-JSON responses should be returned as text data')
  assert.equal(calls.length, 2, 'network retry should use a second attempt')
}

console.log('PASS: engineering HTTP client regression')
