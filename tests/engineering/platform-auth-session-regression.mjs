// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AUTH_TOKEN_KEY,
  USER_INFO_KEY,
  createAuthSession,
  isTokenExpired,
  parseJwtPayload,
  parseStoredToken
} from '../../packages/eiscore-platform/src/auth-session.mjs'
import { createSafeStorage } from '../../packages/eiscore-platform/src/safe-storage.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')

class MemoryStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries))
    this.removed = []
  }

  getItem(key) {
    return this.entries.has(key) ? this.entries.get(key) : null
  }

  setItem(key, value) {
    this.entries.set(key, String(value))
  }

  removeItem(key) {
    this.removed.push(key)
    this.entries.delete(key)
  }
}

const encodeJwt = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${header}.${body}.signature`
}

assert.equal(AUTH_TOKEN_KEY, 'auth_token')
assert.equal(USER_INFO_KEY, 'user_info')
assert.equal(parseStoredToken('plain-token'), 'plain-token')
assert.equal(parseStoredToken(JSON.stringify({ token: 'json-token' })), 'json-token')
assert.equal(parseStoredToken(JSON.stringify({ token: 42 })), '42')
assert.equal(parseStoredToken(''), '')

const unicodeToken = encodeJwt({ sub: '用户-001', name: '经纬网厂', exp: 1_800_000_000 })
assert.deepEqual(parseJwtPayload(unicodeToken), {
  sub: '用户-001',
  name: '经纬网厂',
  exp: 1_800_000_000
})
for (const token of ['', 'one.two', 'one.two.three.four', 'one.***.three', 'one.bm90LWpzb24.three']) {
  assert.equal(parseJwtPayload(token), null)
}

const boundaryNow = 1_700_000_000_000
assert.equal(isTokenExpired(encodeJwt({ exp: 1_700_000_000 }), { now: boundaryNow }), true)
assert.equal(isTokenExpired(encodeJwt({ exp: 1_700_000_001 }), { now: () => boundaryNow }), false)
assert.equal(isTokenExpired(encodeJwt({ exp: '1700000001' }), { now: boundaryNow }), true)
assert.equal(isTokenExpired(encodeJwt({}), { now: boundaryNow }), true)
assert.equal(isTokenExpired('invalid', { now: boundaryNow }), true)

{
  const storage = new MemoryStorage({
    [AUTH_TOKEN_KEY]: 'x'.repeat(8192),
    [USER_INFO_KEY]: JSON.stringify({ name: '保留用户' })
  })
  const session = createAuthSession({ storage, now: boundaryNow })
  assert.equal(session.getToken().length, 8192)
  assert.deepEqual(session.getUserInfo(), { name: '保留用户' })
  assert.deepEqual(session.getAuthHeader(), { Authorization: `Bearer ${'x'.repeat(8192)}` })
}

{
  const storage = new MemoryStorage({
    [AUTH_TOKEN_KEY]: 'x'.repeat(8193),
    [USER_INFO_KEY]: JSON.stringify({ name: '必须清理' })
  })
  const session = createAuthSession({ storage, now: boundaryNow })
  assert.equal(session.getToken(), '')
  assert.deepEqual(storage.removed, [AUTH_TOKEN_KEY, USER_INFO_KEY])
  assert.equal(storage.getItem(USER_INFO_KEY), null)
}

{
  const storage = new MemoryStorage({
    [AUTH_TOKEN_KEY]: 'old-token',
    [USER_INFO_KEY]: JSON.stringify({ name: '旧会话' })
  })
  const session = createAuthSession({ storage })
  assert.equal(session.setAuth('x'.repeat(8193), { name: '不应写入' }), false)
  assert.deepEqual(storage.removed, [AUTH_TOKEN_KEY, USER_INFO_KEY])
  assert.equal(storage.getItem(AUTH_TOKEN_KEY), null)
  assert.equal(storage.getItem(USER_INFO_KEY), null)
}

{
  const storage = new MemoryStorage()
  const session = createAuthSession({ storage, now: boundaryNow })
  const token = encodeJwt({ sub: 'employee-7', exp: 1_700_000_001 })
  assert.equal(session.setAuth(token, { id: 7, name: '君乐缘' }), true)
  assert.equal(storage.getItem(AUTH_TOKEN_KEY), JSON.stringify({ token }))
  assert.deepEqual(session.getUserInfo(), { id: 7, name: '君乐缘' })
  assert.equal(session.isAuthenticated(), true)
  assert.equal(session.clearAuth(), true)
  assert.deepEqual(storage.removed, [AUTH_TOKEN_KEY, USER_INFO_KEY])
}

{
  const storage = new MemoryStorage({ [USER_INFO_KEY]: '{invalid-json' })
  const session = createAuthSession({ storage })
  assert.equal(session.getUserInfo(), null)
}

{
  const sensitiveValue = 'must-not-appear-in-an-error'
  const throwingStorage = {
    getItem() { throw new DOMException(sensitiveValue, 'SecurityError') },
    setItem() { throw new DOMException(sensitiveValue, 'QuotaExceededError') },
    removeItem() { throw new DOMException(sensitiveValue, 'SecurityError') }
  }
  const safeStorage = createSafeStorage(throwingStorage)
  assert.equal(safeStorage.getText('sensitive-key'), null)
  assert.equal(safeStorage.getJson('sensitive-key'), null)
  assert.equal(safeStorage.setText('sensitive-key', sensitiveValue), false)
  assert.equal(safeStorage.setJson('sensitive-key', { token: sensitiveValue }), false)
  assert.equal(safeStorage.remove('sensitive-key'), false)

  const session = createAuthSession({ storage: throwingStorage })
  assert.equal(session.getToken(), '')
  assert.equal(session.getUserInfo(), null)
  assert.equal(session.getUserInfoText(), '')
  assert.equal(session.setUserInfo({ token: sensitiveValue }), false)
  assert.equal(session.setAuth(sensitiveValue, { token: sensitiveValue }), false)
  assert.equal(session.clearAuth(), false)
}

{
  const storage = new MemoryStorage()
  storage.setItem = (key, value) => {
    if (key === USER_INFO_KEY) throw new DOMException('private user data', 'QuotaExceededError')
    MemoryStorage.prototype.setItem.call(storage, key, value)
  }
  const session = createAuthSession({ storage })
  assert.equal(session.setAuth('valid-token', { id: 9 }), false)
  assert.equal(storage.getItem(AUTH_TOKEN_KEY), null)
  assert.deepEqual(storage.removed, [AUTH_TOKEN_KEY, USER_INFO_KEY])
}

for (const path of ['eiscore-base/src/utils/auth.js', 'eiscore-mobile/src/utils/auth.js']) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8')
  assert.match(source, /@eiscore\/platform\/auth-session/, `${path} must adapt the platform session`)
  assert.doesNotMatch(source, /\blocalStorage\b/, `${path} must not access browser storage directly`)
  assert.doesNotMatch(source, /\batob\b/, `${path} must not decode JWT independently`)
}

const baseAuthSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/utils/auth.js'), 'utf8')
assert.match(baseAuthSource, /loginPath\s*=\s*['"]\/login['"]/)
const mobileAuthSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/utils/auth.js'), 'utf8')
assert.match(mobileAuthSource, /window\.location\.href\s*=\s*['"]\/mobile\/login['"]/)

console.log('PASS: platform auth session and safe storage contract')
