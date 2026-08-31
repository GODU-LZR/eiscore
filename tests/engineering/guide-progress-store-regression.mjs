// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildGuideProgressStorageKey,
  buildGuideWelcomeStorageKey,
  createGuideProgressStore
} from '../../shared/eis-guide-progress-store.mjs'

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

assert.equal(buildGuideProgressStorageKey('Admin'), 'eis_guide_progress_v1_admin')
assert.equal(buildGuideWelcomeStorageKey('Admin'), 'eis_guide_welcome_v1_admin')

const existing = {
  'guide-legacy': '2026-08-31T00:00:00.000Z',
  'guide-current': {
    seenAt: '2026-08-31T01:00:00.000Z',
    completedAt: '2026-08-31T02:00:00.000Z'
  }
}
const storage = new MemoryStorage({
  [buildGuideProgressStorageKey('Admin')]: JSON.stringify(existing)
})
const guides = createGuideProgressStore({ storage })
assert.deepEqual(guides.loadProgress('Admin'), existing)
assert.equal(guides.saveProgress('Admin', existing), true)
assert.deepEqual(JSON.parse(storage.getItem(buildGuideProgressStorageKey('Admin'))), existing)
assert.equal(guides.markWelcomeSeen('Admin'), true)
assert.equal(storage.getItem(buildGuideWelcomeStorageKey('Admin')), '1')
assert.equal(guides.hasSeenWelcome('Admin'), true)

storage.setItem(buildGuideProgressStorageKey('Admin'), '{invalid-json')
assert.deepEqual(guides.loadProgress('Admin'), {})
storage.setItem(buildGuideProgressStorageKey('Admin'), JSON.stringify('invalid'))
assert.deepEqual(guides.loadProgress('Admin'), {})

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createGuideProgressStore({ storage: throwingStorage })
assert.deepEqual(unavailable.loadProgress('admin'), {})
assert.equal(unavailable.saveProgress('admin', existing), false)
assert.equal(unavailable.markWelcomeSeen('admin'), false)
assert.equal(unavailable.hasSeenWelcome('admin'), false)

const repoRoot = resolve(import.meta.dirname, '../..')
const layoutSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(layoutSource, /markGuideWelcomeSeen,[\s\S]*readGuideProgress,[\s\S]*writeGuideProgress[\s\S]*from\s*['"]@shared\/eis-guide-progress-store\.mjs['"]/)
assert.match(layoutSource, /const parsed = readGuideProgress\(guideUserKey\.value\)/)
assert.match(layoutSource, /writeGuideProgress\(guideUserKey\.value, guideProgress\.value \|\| {}\)/)
assert.match(layoutSource, /markGuideWelcomeSeen\(guideUserKey\.value\)/)
assert.doesNotMatch(layoutSource, /localStorage\.(?:getItem|setItem)\((?:guideProgressKey|guideWelcomeKey)\.value/)

console.log('PASS: host guide progress and welcome markers use safe per-user versioned storage')
