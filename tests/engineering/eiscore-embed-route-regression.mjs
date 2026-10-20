// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import fs from 'node:fs'

const router = fs.readFileSync(new URL('../../eiscore-base/src/router/index.js', import.meta.url), 'utf8')
const login = fs.readFileSync(new URL('../../eiscore-base/src/views/LoginView.vue', import.meta.url), 'utf8')
const embed = fs.readFileSync(new URL('../../eiscore-base/src/views/EmbedView.vue', import.meta.url), 'utf8')
const harness = fs.readFileSync(new URL('../../eiscore-base/src/views/HarnessView.vue', import.meta.url), 'utf8')

assert.match(router, /path: '\/embed\/:feature\(harness\)'/)
assert.match(router, /path: '\/harness'/)
assert.match(router, /HarnessView\.vue/)
assert.match(router, /next\(\{ path: '\/login', query: \{ redirect: to\.fullPath \} \}\)/)
assert.match(router, /const safeRedirect/)
assert.match(login, /const safeRedirect/)
assert.match(login, /router\.push\(safeRedirect\)/)
assert.match(embed, /frameUrl/)
assert.match(embed, /prepareHarnessAuth/)
assert.doesNotMatch(embed, /DigitalTwinView|AiCopilot/)
assert.match(embed, /postMessage\(\{ source: 'eiscore', type: 'ready', feature \}/)
assert.match(harness, /src="\/harness-embed\//)
assert.match(harness, /DeepSeek Harness 工作台/)
assert.match(harness, /prepareHarnessAuth/)
assert.match(harness, /v-if="harnessReady && !harnessFailed"/)
assert.match(harness, /authorization: getAuthHeader\(\)\.Authorization/)

const mobileHarness = fs.readFileSync(new URL('../../eiscore-mobile/src/views/HarnessView.vue', import.meta.url), 'utf8')
assert.match(mobileHarness, /@eiscore\/platform\/harness-auth/)
assert.match(mobileHarness, /prepareHarnessAuth\(/)
assert.doesNotMatch(mobileHarness, /fetch\('\/harness-embed-api\/eiscore\/auth\/start'/)

console.log('PASS: EISCore iframe embed route contract')
