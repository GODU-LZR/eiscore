// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import {
  AUTH_TOKEN_KEY,
  USER_INFO_KEY,
  createAuthSession
} from '../../packages/eiscore-platform/src/auth-session.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')

class MemoryStorage {
  constructor() {
    this.entries = new Map()
  }

  getItem(key) { return this.entries.has(key) ? this.entries.get(key) : null }
  setItem(key, value) { this.entries.set(key, String(value)) }
  removeItem(key) { this.entries.delete(key) }
}

{
  const storage = new MemoryStorage()
  const session = createAuthSession({ storage, tokenStorageFormat: 'plain' })
  assert.equal(session.setAuth('desktop-plain-token', { id: 'operator-1' }), true)
  assert.equal(storage.getItem(AUTH_TOKEN_KEY), 'desktop-plain-token')
  assert.equal(storage.getItem(USER_INFO_KEY), JSON.stringify({ id: 'operator-1' }))
  assert.equal(session.getToken(), 'desktop-plain-token')
  assert.deepEqual(session.getUserInfo(), { id: 'operator-1' })
  assert.equal(session.getUserInfoText(), JSON.stringify({ id: 'operator-1' }))
  assert.equal(session.setUserInfo({ id: 'operator-2', permissions: ['orders.read'] }), true)
  assert.deepEqual(session.getUserInfo(), { id: 'operator-2', permissions: ['orders.read'] })
}

assert.throws(
  () => createAuthSession({ storage: new MemoryStorage(), tokenStorageFormat: 'unsupported' }),
  (error) => error instanceof TypeError && error.message === 'Unsupported auth token storage format'
)

const authAdapter = readFileSync(resolve(repoRoot, 'eiscore-base/src/utils/auth.js'), 'utf8')
assert.match(authAdapter, /createAuthSession\(\{\s*tokenStorageFormat:\s*['"]plain['"]\s*\}\)/)
for (const name of ['setAuth', 'getUserInfo', 'getUserInfoText', 'setUserInfo']) {
  assert.match(authAdapter, new RegExp(`export const ${name}\\b`))
}

const userStore = readFileSync(resolve(repoRoot, 'eiscore-base/src/stores/user.js'), 'utf8')
for (const name of ['getToken', 'getUserInfo', 'setAuth', 'clearAuthStorage']) {
  assert.match(userStore, new RegExp(`\\b${name}\\b`))
}
assert.doesNotMatch(userStore, /\blocalStorage\b/)
assert.match(userStore, /const token = ref\(getToken\(\)\)/)
assert.match(userStore, /const userInfo = ref\(getUserInfo\(\) \|\| \{\}\)/)
assert.match(userStore, /setAuth\(userData\.token, userData\.user\)/)
assert.match(userStore, /clearAuthStorage\(\)/)

for (const storageAvailable of [true, false]) {
  const storage = new MemoryStorage()
  const session = createAuthSession({ storage, tokenStorageFormat: 'plain' })
  session.setAuth('old-token', { id: 'old-user' })
  if (!storageAvailable) storage.setItem = () => { throw new Error('storage unavailable') }
  const storeSource = userStore.replace(/^import[\s\S]*?from [^\n]+\n/gm, '').replace('export const', 'const')
  const store = runInNewContext(`${storeSource}\nuseUserStore()`, {
    defineStore: (_name, setup) => setup,
    ref: (value) => ({ value }),
    getToken: session.getToken,
    getUserInfo: session.getUserInfo,
    setAuth: session.setAuth,
    clearAuthStorage: session.clearAuth
  })
  const user = { id: 'new-user' }
  let navigated = false
  if (storageAvailable) {
    store.login({ token: 'new-token', user })
    assert.equal(store.token.value, 'new-token')
    assert.equal(store.userInfo.value, user)
    assert.equal(session.getToken(), 'new-token')
  } else {
    assert.throws(() => {
      store.login({ token: 'new-token', user })
      navigated = true
    }, /登录信息保存失败.*浏览器存储.*联系管理员/)
    assert.equal(navigated, false, 'failed desktop login must stop before success/navigation')
    assert.equal(store.token.value, '')
    assert.equal(Object.keys(store.userInfo.value).length, 0)
    assert.equal(session.getToken(), '')
    assert.equal(session.getUserInfo(), null)
  }
}

console.log('PASS: base user store plain-token session migration')
