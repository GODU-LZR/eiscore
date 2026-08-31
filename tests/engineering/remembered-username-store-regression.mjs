// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  REMEMBERED_USERNAME_STORAGE_KEY,
  createRememberedUsernameStore
} from '../../shared/eis-remembered-username.mjs'

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial))
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()
const remembered = createRememberedUsernameStore({ storage })
assert.equal(remembered.getUsername(), '')
assert.equal(remembered.rememberUsername('  operator  '), true)
assert.equal(remembered.getUsername(), '  operator  ')
assert.equal(storage.getItem(REMEMBERED_USERNAME_STORAGE_KEY), '  operator  ')
assert.equal(remembered.forgetUsername(), true)
assert.equal(remembered.getUsername(), '')

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') },
  removeItem() { throw new Error('remove denied') }
}
const unavailable = createRememberedUsernameStore({ storage: throwingStorage })
assert.equal(unavailable.getUsername(), '')
assert.equal(unavailable.rememberUsername('operator'), false)
assert.equal(unavailable.forgetUsername(), false)

const repoRoot = resolve(import.meta.dirname, '../..')
const loginSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/LoginView.vue'), 'utf8')
assert.match(loginSource, /forgetRememberedUsername,[\s\S]*getRememberedUsername,[\s\S]*rememberUsername[\s\S]*from\s*['"]@shared\/eis-remembered-username\.mjs['"]/)
assert.match(loginSource, /const saved = getRememberedUsername\(\)/)
assert.match(loginSource, /rememberUsername\(form\.username\)/)
assert.match(loginSource, /forgetRememberedUsername\(\)/)
assert.doesNotMatch(loginSource, /mobile_remembered_user|\blocalStorage\b/)

console.log('PASS: mobile login uses safe remembered-username storage')
