// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import * as tabPolicy from '../../eiscore-base/src/domain/base-layout-host-tab-policy.js'
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

// Execute the actual layout handlers: removing the stored item alone would let
// an old iframe/plugin add the standalone page again through its host-tab event.
const standalone = ['/harness', '/harness/', '/harness-embed/', '/embed/digital-twin', '/embed/smart-bi', '/ai/enterprise']
const business = { key: '/sales/app/orders', path: '/sales/app/orders', title: '销售订单' }
const flash = { key: '/apps/flash-builder/1', path: '/apps/flash-builder/1', title: '闪念应用' }
const stored = [existing[0], business, flash, ...standalone.map(path => ({ key: path, path, title: 'DeepSeek Harness' }))]
const navigations = []
let saved
const context = vm.createContext({
  ref: value => ({ value }), route: { path: '/', query: {} },
  router: { push: target => { navigations.push(target); return Promise.resolve() } },
  readHostTabs: () => stored, writeHostTabs: value => { saved = value },
  enterpriseConfig: {}, isEnterprisePathEnabled: () => true, getAppRuntimeTitle: () => '',
  ENTRY_TAB_KEY: tabPolicy.HOST_ENTRY_TAB_KEY,
  buildDefaultTabKey: tabPolicy.buildDefaultHostTabKey,
  buildHostRouteId: tabPolicy.buildHostTabRouteId,
  isModuleAppPath: tabPolicy.isHostModuleAppPath,
  isModuleEntryPath: tabPolicy.isHostModuleEntryPath,
  normalizeHostPath: tabPolicy.normalizeHostTabPath,
  normalizeHostQuery: tabPolicy.normalizeHostTabQuery,
  resolveHostTabDot: tabPolicy.resolveHostTabDot,
  resolveHostTabTitlePolicy: tabPolicy.resolveHostTabTitle,
  isStandaloneBusinessHarnessPath: tabPolicy.isStandaloneBusinessHarnessPath
})
const handlers = layoutSource.slice(layoutSource.indexOf('const hostOpenTabAliasMap ='), layoutSource.indexOf('\nrestoreHostTabs()'))
vm.runInContext(handlers + '\nrestoreHostTabs(); syncHostTabsWithRoute(); globalThis.tabs = hostTabs;', context)
assert.deepEqual(Array.from(context.tabs.value, tab => tab.path), ['/', business.path, flash.path], 'restore must drop standalone Harness tabs and retain business/Flash tabs')
assert.deepEqual(Array.from(saved, tab => tab.path), ['/', business.path, flash.path], 'route sync must persist the cleaned tabs')
for (const path of standalone) {
  context.payload = { path, tabTitle: 'DeepSeek Harness', tabKey: 'custom-key' }
  vm.runInContext('handleOpenHostTabEvent({ detail: payload }); handleOpenHostTabMessage({ data: { type: "eis:open-host-tab", detail: payload } });', context)
}
assert.equal(navigations.length, 0, 'event and message must not navigate to standalone Harness pages')
assert.equal(context.tabs.value.length, 3)
vm.runInContext('route.path = "/ai/enterprise"; syncHostTabsWithRoute();', context)
assert.equal(context.tabs.value.length, 3, 'legacy assistant route must not create a duplicate tab')
context.payload = { path: '/hr/users', tabTitle: '用户管理' }
vm.runInContext('handleOpenHostTabEvent({ detail: payload });', context)
assert.equal(navigations.at(-1).path, '/hr/users')
assert.equal(context.tabs.value.at(-1).title, '用户管理')

console.log('PASS: host tabs use safe storage while preserving route normalization and filtering')
