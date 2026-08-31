// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AI_WORKER_FULLSCREEN_STORAGE_KEY,
  buildUserThemeStorageKey,
  createUiPreferenceStore
} from '../../shared/eis-ui-preferences.mjs'

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

assert.equal(buildUserThemeStorageKey('Admin'), 'eis_theme_admin')
assert.equal(buildUserThemeStorageKey(''), 'eis_theme_guest')

const storage = new MemoryStorage()
const preferences = createUiPreferenceStore({ storage })
assert.equal(preferences.getWorkerFullscreen(), false)
assert.equal(preferences.saveWorkerFullscreen(true), true)
assert.equal(storage.getItem(AI_WORKER_FULLSCREEN_STORAGE_KEY), '1')
assert.equal(preferences.getWorkerFullscreen(), true)
assert.equal(preferences.saveWorkerFullscreen(false), true)
assert.equal(storage.getItem(AI_WORKER_FULLSCREEN_STORAGE_KEY), '0')

for (const [stored, expected] of [
  ['dark', 'dark'], ['1', 'dark'], ['true', 'dark'],
  ['light', 'light'], ['0', 'light'], ['false', 'light'],
  ['invalid', null]
]) {
  storage.setItem(buildUserThemeStorageKey('Operator'), stored)
  assert.equal(preferences.getUserTheme('Operator'), expected)
}
assert.equal(preferences.saveUserTheme('Operator', true), true)
assert.equal(storage.getItem('eis_theme_operator'), 'dark')
assert.equal(preferences.saveUserTheme('Operator', false), true)
assert.equal(storage.getItem('eis_theme_operator'), 'light')

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createUiPreferenceStore({ storage: throwingStorage })
assert.equal(unavailable.getWorkerFullscreen(), false)
assert.equal(unavailable.getUserTheme('operator'), null)
assert.equal(unavailable.saveWorkerFullscreen(true), false)
assert.equal(unavailable.saveUserTheme('operator', true), false)

const repoRoot = resolve(import.meta.dirname, '../..')
const copilotSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(copilotSource, /getWorkerFullscreen,[\s\S]*saveWorkerFullscreen[\s\S]*from\s*['"]@shared\/eis-ui-preferences\.mjs['"]/)
assert.match(copilotSource, /saveWorkerFullscreen\(isFullscreen\.value\)/)
assert.match(copilotSource, /isFullscreen\.value = getWorkerFullscreen\(\)/)
assert.doesNotMatch(copilotSource, /eis_ai_worker_fullscreen|\blocalStorage\b|\bsessionStorage\b/)

const layoutSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(layoutSource, /buildUserThemeStorageKey,[\s\S]*getUserTheme,[\s\S]*saveUserTheme[\s\S]*from\s*['"]@shared\/eis-ui-preferences\.mjs['"]/)
assert.match(layoutSource, /const storedTheme = getUserTheme\(userThemeIdentity\.value\)/)
assert.match(layoutSource, /saveUserTheme\(userThemeIdentity\.value, val\)/)
assert.doesNotMatch(layoutSource, /localStorage\.(?:getItem|setItem)\(userThemeKey\.value/)

console.log('PASS: host theme and AI fullscreen use typed safe UI preferences')
