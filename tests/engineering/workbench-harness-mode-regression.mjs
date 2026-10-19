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
assert.match(source, /:src="harnessFrameUrl"/)
assert.doesNotMatch(source, /label: '数字分身'/)
assert.doesNotMatch(source, /label: '智能 BI'/)
assert.doesNotMatch(source, /eiscore:harness-feature/)
assert.doesNotMatch(source, /activeMode === 'twin'|activeMode === 'enterprise'/)

const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '')
  .replace('import.meta.env.VITE_HARNESS_WEB_URL', 'undefined')
let onModeChange
let resolveAuth
let authCalls = 0
const state = runInNewContext(`${script}\n;({ activeMode, modeOptions, harnessAuthReady, harnessAuthPending, harnessFrameFailed, prepareHarnessAuth })`, {
  ref: (value) => ({ value }),
  computed: (read) => ({ get value() { return read() } }),
  watch: (_state, callback) => { onModeChange = callback },
  useUserStore: () => ({ userInfo: { role: 'admin' } }),
  getAuthHeader: () => ({ Authorization: 'Bearer browser-test-only' }),
  prepareHarnessAuthRequest: () => {
    authCalls++
    return new Promise((resolveAuthRequest) => { resolveAuth = resolveAuthRequest })
  },
  Loading: {}, Service: {}, Share: {}
})
assert.equal(state.activeMode.value, 'flow')
assert.deepEqual(Array.from(state.modeOptions, (option) => option.value), ['harness', 'flow'])
onModeChange('flow')
assert.equal(authCalls, 0, 'business flow must not start Harness authentication')
onModeChange('harness')
assert.equal(state.harnessAuthPending.value, true)
onModeChange('flow')
onModeChange('harness')
assert.equal(authCalls, 1, 'switching while pending must not duplicate authentication')
resolveAuth(true)
await new Promise((resolveTick) => setImmediate(resolveTick))
assert.equal(state.harnessAuthReady.value, true)
onModeChange('flow')
onModeChange('harness')
assert.equal(authCalls, 1, 'switching back must preserve the authenticated iframe')
state.harnessFrameFailed.value = true
const retry = state.prepareHarnessAuth()
resolveAuth(false)
await retry
assert.equal(state.harnessAuthReady.value, false)
assert.equal(state.harnessAuthPending.value, false)
assert.equal(state.harnessFrameFailed.value, true, 'authentication failure must leave a visible retry state')
const recovered = state.prepareHarnessAuth()
resolveAuth(true)
await recovered
assert.equal(state.harnessAuthReady.value, true)
assert.equal(state.harnessFrameFailed.value, false)

console.log('PASS: unified Harness/flow modes, lazy auth, preserved iframe, failure and retry')
