// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DISPLAY_VISIBILITY_STORAGE_KEY,
  createDisplayVisibilityStore,
  normalizeDisplayVisibility
} from '../../shared/eis-display-visibility-store.mjs'

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

assert.deepEqual(normalizeDisplayVisibility({
  hiddenModules: [' sales ', 'sales', '', null],
  hiddenApps: {
    ' apps ': [' config ', 'config', ''],
    '': ['ignored'],
    hr: 'invalid'
  }
}), {
  hiddenModules: ['sales'],
  hiddenApps: { apps: ['config'], hr: [] }
})

const storage = new MemoryStorage({
  [DISPLAY_VISIBILITY_STORAGE_KEY]: JSON.stringify({
    hiddenModules: [' quality ', 'quality'],
    hiddenApps: { equipment: [' checks '] }
  })
})
const visibilityStore = createDisplayVisibilityStore({ storage })
assert.deepEqual(visibilityStore.getVisibility(), {
  hiddenModules: ['quality'],
  hiddenApps: { equipment: ['checks'] }
})
assert.deepEqual(visibilityStore.saveVisibility({
  hiddenModules: [' purchase ', 'purchase'],
  hiddenApps: { sales: [' orders ', 'orders'] }
}), {
  hiddenModules: ['purchase'],
  hiddenApps: { sales: ['orders'] }
})
assert.deepEqual(JSON.parse(storage.getItem(DISPLAY_VISIBILITY_STORAGE_KEY)), {
  hiddenModules: ['purchase'],
  hiddenApps: { sales: ['orders'] }
})

storage.setItem(DISPLAY_VISIBILITY_STORAGE_KEY, '{invalid-json')
assert.deepEqual(visibilityStore.getVisibility(), { hiddenModules: [], hiddenApps: {} })

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createDisplayVisibilityStore({ storage: throwingStorage })
assert.deepEqual(unavailable.getVisibility(), { hiddenModules: [], hiddenApps: {} })
assert.deepEqual(unavailable.saveVisibility({ hiddenModules: ['hr'] }), {
  hiddenModules: ['hr'],
  hiddenApps: {}
})

const repoRoot = resolve(import.meta.dirname, '../..')
const controlSource = readFileSync(resolve(repoRoot, 'shared/eis-display-control.js'), 'utf8')
assert.match(controlSource, /from\s*['"]\.\/eis-display-visibility-store\.mjs['"]/)
assert.match(controlSource, /readStoredDisplayVisibility/)
assert.match(controlSource, /persistDisplayVisibility\(visibility\)/)
assert.match(controlSource, /window\.dispatchEvent\(new CustomEvent\(DISPLAY_VISIBILITY_UPDATED_EVENT/)
assert.match(controlSource, /window\.addEventListener\(['"]storage['"], handleStorage\)/)
assert.doesNotMatch(controlSource, /\blocalStorage\b|\bsessionStorage\b/)

console.log('PASS: display visibility preserves normalized cache and cross-window event integration')
