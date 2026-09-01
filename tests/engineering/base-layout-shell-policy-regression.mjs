// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BASE_DEFAULT_AVATAR,
  BASE_WORKER_ASSISTANT_HIDDEN_ROUTES,
  buildBaseAvatarRenderSrc,
  getBaseGuideProgressSyncPresentation,
  isBaseWorkerAssistantVisible,
  resolveBaseAsideTheme
} from '../../eiscore-base/src/domain/base-layout-shell-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(buildBaseAvatarRenderSrc('', 3), `${BASE_DEFAULT_AVATAR}?t=3`)
assert.equal(buildBaseAvatarRenderSrc('data:image/png;base64,abc', 4), 'data:image/png;base64,abc#t=4')
assert.equal(buildBaseAvatarRenderSrc('https://img.example/avatar.png', 5), 'https://img.example/avatar.png?t=5')
assert.equal(buildBaseAvatarRenderSrc('https://img.example/avatar.png?v=1', 6), 'https://img.example/avatar.png?v=1&t=6')
assert.equal(buildBaseAvatarRenderSrc('file:avatar-1', 7), 'file:avatar-1')

assert.deepEqual(getBaseGuideProgressSyncPresentation('syncing'), { label: '同步中', tagType: 'warning' })
assert.deepEqual(getBaseGuideProgressSyncPresentation('synced'), { label: '已同步', tagType: 'success' })
assert.deepEqual(getBaseGuideProgressSyncPresentation('local'), { label: '本地记录', tagType: 'info' })
assert.deepEqual(getBaseGuideProgressSyncPresentation('unexpected'), { label: '本地记录', tagType: 'info' })

const mixCalls = []
const mixColor = (...args) => {
  mixCalls.push(args)
  return args.join('|')
}
assert.deepEqual(resolveBaseAsideTheme({ primaryColor: '#123456', isDark: true, mixColor }), {
  menuBg: '#001529',
  menuText: '#fff',
  menuActiveText: '#123456',
  logoBg: '#002140',
  headerBg: '#001529'
})
assert.deepEqual(mixCalls, [])
assert.deepEqual(resolveBaseAsideTheme({ primaryColor: '#123456', isDark: false, mixColor }), {
  menuBg: '#123456',
  menuText: '#ffffff',
  menuActiveText: '#ffffff',
  logoBg: '#123456|#000000|0.1',
  headerBg: '#123456|#ffffff|0.85'
})
assert.deepEqual(mixCalls, [
  ['#123456', '#000000', 0.1],
  ['#123456', '#ffffff', 0.85]
])

assert.deepEqual(BASE_WORKER_ASSISTANT_HIDDEN_ROUTES, [
  '/materials/inventory-dashboard',
  '/sales/cockpit',
  '/purchase/dashboard',
  '/quality/dashboard',
  '/equipment/dashboard'
])
for (const path of ['/', '/ai/enterprise', '/ai/enterprise/chat', '/sales/cockpit', '/sales/cockpit/detail']) {
  assert.equal(isBaseWorkerAssistantVisible(path), false, `assistant should be hidden on ${path}`)
}
for (const path of ['/sales/cockpits', '/sales/orders', '/apps/', '/materials/inventory-dashboard-v2']) {
  assert.equal(isBaseWorkerAssistantVisible(path), true, `assistant should remain visible on ${path}`)
}

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/base-layout-shell-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'from \'element-plus\'', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `base layout shell policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/base-layout-shell-policy['"]/)
for (const removedDefinition of [
  'const defaultAvatar =',
  'const avatarSrc =',
  'const WORKER_ASSISTANT_HIDDEN_ROUTES =',
  'const isPathInRouteGroup ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `base layout reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'buildBaseAvatarRenderSrc(',
  'getBaseGuideProgressSyncPresentation(',
  'resolveBaseAsideTheme({',
  'isBaseWorkerAssistantVisible('
]) {
  assert.equal(pageSource.includes(requiredUse), true, `base layout lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3659)

console.log('PASS: base layout shell policy preserves avatar refresh, guide sync state, aside theme and assistant visibility')
