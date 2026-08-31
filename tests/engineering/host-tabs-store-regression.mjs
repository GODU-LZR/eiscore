// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createHostTabsStore,
  HOST_TABS_STORAGE_KEY
} from '../../shared/eis-host-tabs-store.mjs'

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
}

const existing = [
  { key: '/', path: '/', query: {}, title: '首页', closable: false, dot: 'home' },
  {
    key: '/sales/app/order',
    path: '/sales/app/order',
    query: { id: 'SO-001' },
    title: '销售订单',
    closable: true,
    dot: 'sales'
  }
]
const storage = new MemoryStorage({
  [HOST_TABS_STORAGE_KEY]: JSON.stringify(existing)
})
const tabs = createHostTabsStore({ storage })
assert.deepEqual(tabs.loadTabs(), existing)
assert.equal(tabs.saveTabs(existing), true)
assert.deepEqual(JSON.parse(storage.getItem(HOST_TABS_STORAGE_KEY)), existing)

storage.setItem(HOST_TABS_STORAGE_KEY, '{invalid-json')
assert.deepEqual(tabs.loadTabs(), [])
storage.setItem(HOST_TABS_STORAGE_KEY, JSON.stringify({ invalid: true }))
assert.deepEqual(tabs.loadTabs(), [])

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createHostTabsStore({ storage: throwingStorage })
assert.deepEqual(unavailable.loadTabs(), [])
assert.equal(unavailable.saveTabs(existing), false)

const repoRoot = resolve(import.meta.dirname, '../..')
const layoutSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(layoutSource, /readHostTabs,\s*writeHostTabs\s*}\s*from\s*['"]@shared\/eis-host-tabs-store\.mjs['"]/)
assert.match(layoutSource, /const parsed = readHostTabs\(\)/)
assert.match(layoutSource, /writeHostTabs\(payload\)/)
assert.match(layoutSource, /isEnterprisePathEnabled\(path, enterpriseConfig\)/)
assert.match(layoutSource, /seenRouteIds\.has\(routeId\)/)
assert.match(layoutSource, /title === ['"]页面['"]/)
assert.doesNotMatch(layoutSource, /HOST_TABS_STORAGE_KEY|localStorage\.(?:getItem|setItem)\(/)

console.log('PASS: host tabs use safe storage while preserving route normalization and filtering')
