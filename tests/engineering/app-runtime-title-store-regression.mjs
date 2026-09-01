// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  APP_RUNTIME_TITLE_STORAGE_KEY,
  createAppRuntimeTitleStore
} from '../../shared/eis-app-runtime-title-store.mjs'

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

const storage = new MemoryStorage()
const titles = createAppRuntimeTitleStore({ storage })
assert.equal(titles.getTitle(''), '')
assert.equal(titles.getTitle('app-1'), '')
assert.equal(titles.rememberTitle('', '应用一'), false)
assert.equal(titles.rememberTitle('app-1', '  应用一  '), true)
assert.equal(titles.getTitle(' app-1 '), '应用一')
assert.equal(titles.rememberTitle('app-2', '应用二'), true)
assert.deepEqual(JSON.parse(storage.getItem(APP_RUNTIME_TITLE_STORAGE_KEY)), {
  'app-1': '应用一',
  'app-2': '应用二'
})

storage.setItem(APP_RUNTIME_TITLE_STORAGE_KEY, '{invalid-json')
assert.equal(titles.getTitle('app-1'), '')
assert.equal(titles.rememberTitle('app-3', '应用三'), true)
assert.deepEqual(JSON.parse(storage.getItem(APP_RUNTIME_TITLE_STORAGE_KEY)), { 'app-3': '应用三' })
storage.setItem(APP_RUNTIME_TITLE_STORAGE_KEY, JSON.stringify(['invalid-map']))
assert.equal(titles.getTitle('0'), '')

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createAppRuntimeTitleStore({ storage: throwingStorage })
assert.equal(unavailable.getTitle('app-1'), '')
assert.equal(unavailable.rememberTitle('app-1', '应用一'), false)

const repoRoot = resolve(import.meta.dirname, '../..')
const dashboardSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/AppDashboard.vue'), 'utf8')
assert.match(dashboardSource, /rememberAppRuntimeTitle\s*}\s*from\s*['"]@shared\/eis-app-runtime-title-store\.mjs['"]/)
assert.match(dashboardSource, /rememberAppRuntimeTitle\(id,\s*title\)/)
assert.doesNotMatch(dashboardSource, /APP_RUNTIME_TITLE_STORAGE_KEY|\blocalStorage\b/)

const layoutSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(layoutSource, /getAppRuntimeTitle\s*}\s*from\s*['"]@shared\/eis-app-runtime-title-store\.mjs['"]/)
assert.match(layoutSource, /getRuntimeTitle:\s*getAppRuntimeTitle/)
assert.doesNotMatch(layoutSource, /APP_RUNTIME_TITLE_STORAGE_KEY/)

console.log('PASS: app dashboard and host tabs share safe runtime title storage')
