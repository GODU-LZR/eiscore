// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPANY_SITE_LOCALE_KEY,
  COMPANY_SITE_USERNAME_KEY,
  CUE_CONFIGURATION_KEY,
  CUE_DESIGN_KEY,
  FACTORY_DEMO_KEY,
  createCompanySiteStorage
} from '../src/domain/company-site-storage.js'
import { DEMO_STORAGE_KEY } from '../src/demo/factory-demo.js'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values
  }
}

test('company site preferences preserve the existing keys and values', () => {
  const memory = createMemoryStorage()
  const storage = createCompanySiteStorage({ storage: memory })

  assert.equal(storage.getSiteLocale(), '')
  assert.equal(storage.saveSiteLocale('en-US'), true)
  assert.equal(memory.values.get(COMPANY_SITE_LOCALE_KEY), 'en-US')
  assert.equal(storage.rememberUsername('operator'), true)
  assert.equal(storage.getRememberedUsername(), 'operator')
  assert.equal(memory.values.get(COMPANY_SITE_USERNAME_KEY), 'operator')
  assert.equal(storage.forgetUsername(), true)
  assert.equal(storage.getRememberedUsername(), '')
})

test('cue drafts and handoff metadata use safe JSON storage', () => {
  const memory = createMemoryStorage()
  const storage = createCompanySiteStorage({ storage: memory })
  const design = { designId: 'cue-1', revision: 2 }
  const configuration = { configurationId: 'cfg-1', configurationToken: 'opaque-token' }

  assert.equal(storage.saveCueDesign(design), true)
  assert.equal(storage.saveCueConfiguration(configuration), true)
  assert.deepEqual(storage.getCueDesign(), design)
  assert.deepEqual(storage.getCueConfiguration(), configuration)
  assert.equal(memory.values.has(CUE_DESIGN_KEY), true)
  assert.equal(memory.values.has(CUE_CONFIGURATION_KEY), true)
})

test('factory demo and malformed values fail closed without breaking the page', () => {
  assert.equal(FACTORY_DEMO_KEY, DEMO_STORAGE_KEY)
  const memory = createMemoryStorage({
    [CUE_DESIGN_KEY]: '{broken',
    [FACTORY_DEMO_KEY]: '{broken'
  })
  const storage = createCompanySiteStorage({ storage: memory })

  assert.equal(storage.getCueDesign(), null)
  assert.deepEqual(storage.getFactoryDemoState(), {})
  assert.equal(storage.saveFactoryDemoState({ step: 3, role: 'owner' }), true)
  assert.deepEqual(storage.getFactoryDemoState(), { step: 3, role: 'owner' })
})
