// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BASE_MICRO_APP_KEYS,
  getBaseModuleKeyFromPath,
  getBaseModuleLoadingTitle,
  getVisibleBaseMicroAppKeys,
  pickBaseMicroAppWarmUrls,
  rankBaseMicroAppWarmUrl,
  sortBaseMicroAppWarmUrls
} from '../../eiscore-base/src/domain/base-layout-micro-app-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.deepEqual(BASE_MICRO_APP_KEYS, ['materials', 'hr', 'apps', 'company-site', 'sales', 'purchase', 'production', 'quality', 'equipment', 'decision'])
assert.equal(getBaseModuleLoadingTitle('materials'), '仓储管理')
assert.equal(getBaseModuleLoadingTitle('decision'), '决策支持')
assert.equal(getBaseModuleLoadingTitle('company-site'), '企业站点运营')
assert.equal(getBaseModuleLoadingTitle('unknown'), '模块')
assert.equal(getBaseModuleKeyFromPath('/sales/app/orders?x=1'), 'sales')
assert.equal(getBaseModuleKeyFromPath('/unknown#apps'), '')
assert.deepEqual(getVisibleBaseMicroAppKeys({ apps: true, materials: true, sales: 0, decision: 1 }), ['materials', 'apps', 'decision'])

const urls = [
  '/apps/assets/charts-core-a.js',
  '/apps/assets/AppRuntime-a.js',
  '/apps/assets/vendor-misc-a.js',
  '/apps/index.html',
  '/apps/assets/runtime-a.js',
  '/apps/assets/style-a.css',
  '/sales/index.html'
]
assert.deepEqual(pickBaseMicroAppWarmUrls('apps', { urls }), [
  '/apps/index.html',
  '/apps/assets/runtime-a.js',
  '/apps/assets/vendor-misc-a.js',
  '/apps/assets/style-a.css',
  '/apps/assets/AppRuntime-a.js',
  '/apps/assets/charts-core-a.js'
])
assert.deepEqual(pickBaseMicroAppWarmUrls('unknown', { urls }), [])
assert.deepEqual(pickBaseMicroAppWarmUrls('apps', null), [])
assert.equal(rankBaseMicroAppWarmUrl('/apps/index.html'), 0)
assert.equal(rankBaseMicroAppWarmUrl('/apps/assets/bpmn-a.js'), 8)
assert.deepEqual(sortBaseMicroAppWarmUrls(['/x/b.js', '/x/a.js']), ['/x/a.js', '/x/b.js'])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/base-layout-micro-app-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'from \'element-plus\'', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `base layout micro-app policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/base-layout-micro-app-policy['"]/)
for (const removedDefinition of [
  'const MICRO_APP_KEYS =',
  'const MICRO_APP_ENTRY_PREFIX =',
  'const getModuleLoadingTitle =',
  'const sortWarmUrls =',
  'const pickMicroAppWarmUrls =',
  'const moduleKeyFromPath ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `base layout reintroduced ${removedDefinition}`)
}
for (const requiredUse of ['getBaseModuleLoadingTitle(', 'pickBaseMicroAppWarmUrls(', 'getBaseModuleKeyFromPath(', 'getVisibleBaseMicroAppKeys({']) {
  assert.equal(pageSource.includes(requiredUse), true, `base layout lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3701)

console.log('PASS: base layout micro-app policy preserves loading titles, warm ordering, manifest filtering and visibility order')
