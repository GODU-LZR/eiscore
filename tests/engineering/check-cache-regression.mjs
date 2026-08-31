// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CHECK_CACHE_KEY,
  CHECK_COLD_MODE_KEY,
  CHECK_PENDING_KEY,
  createCheckCache
} from '../../shared/eis-check-cache.mjs'

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

const now = 1770000000000
const storage = new MemoryStorage()
const cache = createCheckCache({ storage, now: () => now })

assert.equal(cache.getCheckCache(), null)
assert.equal(cache.getColdMode(), false)
assert.deepEqual(cache.getPendingChecks(), [])

const warehouses = [{ id: 'w-1', name: '一号仓' }]
const storedCache = cache.setCheckCache({ warehouses, meta: { source: 'network' } })
assert.deepEqual(storedCache, {
  version: 1,
  updatedAt: now,
  warehouses,
  meta: { source: 'network' }
})
assert.deepEqual(JSON.parse(storage.getItem(CHECK_CACHE_KEY)), storedCache)
assert.deepEqual(cache.getCheckCache(), storedCache)

assert.equal(cache.setColdMode(true), undefined)
assert.equal(storage.getItem(CHECK_COLD_MODE_KEY), '1')
assert.equal(cache.getColdMode(), true)
cache.setColdMode(false)
assert.equal(storage.getItem(CHECK_COLD_MODE_KEY), '0')

const first = { id: 'check-1', warehouseId: 'w-1' }
const second = { id: 'check-2', warehouseId: 'w-1' }
assert.deepEqual(cache.addPendingCheck(first), [first])
assert.deepEqual(cache.addPendingCheck(second), [first, second])
assert.deepEqual(cache.removePendingChecks(['check-1']), [second])
assert.deepEqual(cache.removePendingChecks([]), [second])
assert.deepEqual(JSON.parse(storage.getItem(CHECK_PENDING_KEY)), [second])

assert.equal(cache.clearCheckCache(), undefined)
assert.equal(cache.clearPendingChecks(), undefined)
assert.equal(storage.getItem(CHECK_CACHE_KEY), null)
assert.equal(storage.getItem(CHECK_PENDING_KEY), null)

storage.setItem(CHECK_CACHE_KEY, '{invalid-json')
storage.setItem(CHECK_PENDING_KEY, '{"unexpected":true}')
assert.equal(cache.getCheckCache(), null)
assert.deepEqual(cache.getPendingChecks(), [])

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') },
  removeItem() { throw new Error('remove denied') }
}
const unavailable = createCheckCache({ storage: throwingStorage, now: () => now })
assert.equal(unavailable.getCheckCache(), null)
assert.equal(unavailable.getColdMode(), false)
assert.deepEqual(unavailable.getPendingChecks(), [])
assert.deepEqual(unavailable.setCheckCache({ warehouses }), {
  version: 1,
  updatedAt: now,
  warehouses,
  meta: {}
})
assert.deepEqual(unavailable.addPendingCheck(first), [first])
assert.doesNotThrow(() => unavailable.removePendingChecks(['check-1']))
assert.doesNotThrow(() => unavailable.clearCheckCache())
assert.doesNotThrow(() => unavailable.clearPendingChecks())

const repoRoot = resolve(import.meta.dirname, '../..')
const adapters = [
  'eiscore-materials/src/utils/check-cache.js',
  'eiscore-mobile/src/utils/check-cache.js'
]
for (const path of adapters) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8')
  assert.match(source, /createCheckCache\s*}\s*from\s*['"]@shared\/eis-check-cache\.mjs['"]/, path)
  assert.doesNotMatch(source, /\blocalStorage\b|JSON\.parse|JSON\.stringify/, path)
  for (const exportName of Object.keys(cache)) {
    assert.match(source, new RegExp(`export const ${exportName} = checkCache\\.${exportName}`), path)
  }
}

console.log('PASS: materials and mobile share safe inventory check cache semantics')
