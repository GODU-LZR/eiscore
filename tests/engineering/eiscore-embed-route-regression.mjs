// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import fs from 'node:fs'

const router = fs.readFileSync(new URL('../../eiscore-base/src/router/index.js', import.meta.url), 'utf8')
const login = fs.readFileSync(new URL('../../eiscore-base/src/views/LoginView.vue', import.meta.url), 'utf8')
const embed = fs.readFileSync(new URL('../../eiscore-base/src/views/EmbedView.vue', import.meta.url), 'utf8')

assert.match(router, /path: '\/embed\/:feature\(digital-twin\|smart-bi\)'/)
assert.match(router, /next\(\{ path: '\/login', query: \{ redirect: to\.fullPath \} \}\)/)
assert.match(router, /const safeRedirect/)
assert.match(login, /const safeRedirect/)
assert.match(login, /router\.push\(safeRedirect\)/)
assert.match(embed, /DigitalTwinView v-if="feature === 'digital-twin'"/)
assert.match(embed, /AiCopilot v-else mode="enterprise" :auto-open="true"/)
assert.match(embed, /postMessage\(\{ source: 'eiscore', type: 'ready', feature \}/)

console.log('PASS: EISCore iframe embed route contract')
