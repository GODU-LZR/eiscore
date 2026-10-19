// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/views/HomeView.vue'), 'utf8')

assert.match(source, /label: 'DeepSeek Harness', value: 'harness'/)
assert.match(source, /label: '业务流程', value: 'flow'/)
assert.match(source, /v-show="activeMode === 'harness'" class="harness-wrapper"/)
assert.match(source, /<HarnessWorkspaceSlot :active="activeMode === 'harness'"\s*\/>/)
assert.doesNotMatch(source, /<iframe\b|prepareHarnessAuth|harnessAuthReady|harnessAuthPending/)
assert.doesNotMatch(source, /label: '数字分身'/)
assert.doesNotMatch(source, /label: '智能 BI'/)
assert.doesNotMatch(source, /eiscore:harness-feature/)
assert.doesNotMatch(source, /activeMode === 'twin'|activeMode === 'enterprise'/)

const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '')
const userStore = { userInfo: { role: 'admin' } }
const state = runInNewContext(`${script}\n;({ activeMode, modeOptions, activeModeMeta, isAdmin })`, {
  ref: (value) => ({ value }),
  computed: (read) => ({ get value() { return read() } }),
  useUserStore: () => userStore,
  Service: {}, Share: {}
})
assert.equal(state.activeMode.value, 'flow')
assert.deepEqual(Array.from(state.modeOptions, (option) => option.value), ['harness', 'flow'])
assert.deepEqual(Array.from(state.modeOptions, (option) => option.label), ['DeepSeek Harness', '业务流程'])
assert.equal(state.activeModeMeta.value.title, '业务流程')
state.activeMode.value = 'harness'
assert.equal(state.activeModeMeta.value.title, 'DeepSeek Harness')
state.activeMode.value = 'flow'
assert.equal(state.activeModeMeta.value.title, '业务流程')
assert.match(source, /v-if="isAdmin"[\s\S]*?class="mode-switcher"/)
for (const userInfo of [{ role: 'super_admin' }, { role: 'system_admin' }, { role: ' ADMIN ' }, { app_role: 'admin' }, { appRole: 'admin' }]) {
  userStore.userInfo = userInfo
  assert.equal(state.isAdmin.value, true, `admin boundary rejected ${JSON.stringify(userInfo)}`)
}
for (const userInfo of [null, {}, { role: 'user' }, { role: 'manager' }, { role: 'superadmin' }, { role: 'user', app_role: 'admin' }]) {
  userStore.userInfo = userInfo
  assert.equal(state.isAdmin.value, false, `admin boundary widened to ${JSON.stringify(userInfo)}`)
}
assert.match(source, /v-show="activeMode === 'flow'"[\s\S]*?<BusinessFlowMap\s*\/>/)
assert.doesNotMatch(source, /<div v-if="activeMode === '(?:flow|harness)'"/)

console.log('PASS: default flow, two modes, original administrator boundary and geometry-only shared Harness slot')
