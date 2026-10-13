// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getFlashHarnessEventKey,
  isFlashHarnessChangeMessage,
  isTrustedFlashHarnessMessage
} from '../../eiscore-apps/src/services/flash-builder-harness-bridge.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/FlashBuilder.vue'), 'utf8')
const bridgeSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/services/flash-builder-harness-bridge.js'), 'utf8')

assert.match(source, /:src="harnessFrameUrl"/)
assert.match(source, /const harnessFrameUrl = '\/harness-flash-embed\/#flash-builder'/)
assert.match(source, /prepareHarnessAuth\(\{ harnessWebUrl: '\/harness-flash-embed\//)
assert.match(source, /authApiPrefix: '\/harness-flash-embed-api'/)
assert.match(source, /type: 'flash:context'/)
assert.match(source, /appId: appId\.value, sessionId: harnessSessionId\.value/)
assert.match(source, /contentWindow\.postMessage\(/)
assert.match(source, /window\.location\.origin\)/)
const contextPost = source.match(/const postContext = \(\) => \{([\s\S]*?)\n\}/)?.[1] || ''
assert.notEqual(contextPost, '')
assert.doesNotMatch(contextPost, /token|authorization|bearer/i)
assert.doesNotMatch(source.match(/const harnessFrameUrl = ([^\n]+)/)?.[1] || '', /token|authorization|bearer|\?[^']+/i)

for (const required of [
  'isTrustedFlashHarnessMessage(event, {',
  'isFlashHarnessChangeMessage(data)',
  'getFlashHarnessEventKey(data)',
  'await syncDraft()',
  "refreshPreview('正在呈现最新草稿...')",
  'window.addEventListener(\'message\', handleHarnessMessage)',
  "window.removeEventListener('message', handleHarnessMessage)"
]) {
  assert.equal(source.includes(required), true, `Harness iframe contract missing: ${required}`)
}
for (const required of ["'flash:draft-changed'", "'flash:draft-write-complete'", "'flash:task-complete'"]) {
  assert.equal(bridgeSource.includes(required), true, `Harness iframe event contract missing: ${required}`)
}

for (const forbidden of [
  'new WebSocket(',
  'localStorage',
  'sessionStorage',
  'loadFlashConversations(',
  'saveFlashConversations(',
  'attachment',
  '附件'
]) {
  assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, `Harness iframe boundary leaked removed or sensitive contract: ${forbidden}`)
}

const frameWindow = {}
const validEvent = {
  origin: 'https://eiscore.test',
  source: frameWindow,
  data: { source: 'eiscore', appId: 'orders-app', sessionId: 'flash-orders-app', type: 'flash:draft-write-complete', requestId: 'req-1' }
}
assert.equal(isTrustedFlashHarnessMessage(validEvent, {
  origin: 'https://eiscore.test', frameWindow, appId: 'orders-app', sessionId: 'flash-orders-app'
}), true)
assert.equal(isTrustedFlashHarnessMessage({ ...validEvent, origin: 'https://attacker.test' }, {
  origin: 'https://eiscore.test', frameWindow, appId: 'orders-app', sessionId: 'flash-orders-app'
}), false)
assert.equal(isTrustedFlashHarnessMessage({ ...validEvent, source: {} }, {
  origin: 'https://eiscore.test', frameWindow, appId: 'orders-app', sessionId: 'flash-orders-app'
}), false)
assert.equal(isTrustedFlashHarnessMessage({ ...validEvent, data: { ...validEvent.data, appId: 'other-app' } }, {
  origin: 'https://eiscore.test', frameWindow, appId: 'orders-app', sessionId: 'flash-orders-app'
}), false)
assert.equal(isTrustedFlashHarnessMessage({ ...validEvent, data: { ...validEvent.data, sessionId: 'flash-other-app' } }, {
  origin: 'https://eiscore.test', frameWindow, appId: 'orders-app', sessionId: 'flash-orders-app'
}), false)
assert.equal(isFlashHarnessChangeMessage(validEvent.data), true)
assert.equal(isFlashHarnessChangeMessage({ ...validEvent.data, ok: false }), false)
assert.equal(getFlashHarnessEventKey(validEvent.data), 'flash:draft-write-complete:req-1')
assert.equal(getFlashHarnessEventKey({ ...validEvent.data, requestId: '' }), '')

const flashPatch = readFileSync(resolve(repoRoot, 'agent-harness/dsh-flash-web.patch.yml'), 'utf8')
assert.match(flashPatch, /id: eiscore-auth/)
assert.match(flashPatch, /id: eiscore-flash-context/)
assert.doesNotMatch(flashPatch, /digital-twin|enterprise-bi/)
const flashCompose = readFileSync(resolve(repoRoot, 'deploy/lundu/compose.harness-web.yml'), 'utf8')
assert.match(flashCompose, /EISCORE_AUTH_COOKIE_PREFIX: flash-/)
assert.match(flashCompose, /EISCORE_HARNESS_AUTH_RETURN_PATH: \/harness-flash-embed-api\/eiscore\/auth\/handoff/)
const runner = readFileSync(resolve(repoRoot, 'agent-harness/dsh-web-runner.mjs'), 'utf8')
assert.match(runner, /mapAuthCookiesToUpstream/)
assert.match(runner, /mapAuthSetCookiesToBrowser/)
assert.match(runner, /getHarnessAuthReturnPath/)
const loginView = readFileSync(resolve(repoRoot, 'eiscore-base/src/views/LoginView.vue'), 'utf8')
assert.match(loginView, /'\/harness-flash-embed-api\/eiscore\/auth\/handoff'/)
assert.match(loginView, /\/harness-flash-embed\/#flash-builder/)

console.log('PASS: FlashBuilder Harness iframe postMessage contract')
