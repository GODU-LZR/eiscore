// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { webcrypto } from 'node:crypto'

// Exercise the real bridge, including both qiankun and DOM command channels.
const source = readFileSync(new URL('../../eiscore-base/src/utils/ai-bridge.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
  .replace('export const aiBridge = new AiBridge()', 'globalThis.aiBridge = new AiBridge()')
const listeners = new Map()
const opened = []
const legacyCalls = []
const requests = []
let accepted = true
const sandbox = {
  console, AbortController, crypto: webcrypto,
  reactive: value => value, watch: () => {},
  createAssistantModeHistory: () => ({ load: () => ({}), saveMode: value => value }),
  window: { addEventListener: (name, listener) => {
    assert.equal(listeners.has(name), false, `duplicate listener: ${name}`)
    listeners.set(name, listener)
  } },
  openHarnessAssistant: command => { opened.push(structuredClone(command)); return accepted },
  request: options => { requests.push(options); throw new Error('unexpected legacy HTTP request') },
  streamAgentEvents: options => { requests.push(options); throw new Error('unexpected legacy chat stream') }
}
runInNewContext(source, sandbox)
const bridge = sandbox.aiBridge
for (const method of ['setMode', 'openWindow', 'sendMessage']) {
  bridge[method] = (...args) => { legacyCalls.push({ method, args }) }
}

for (const command of [null, {}, { type: 'open-worker' }, { id: '', type: 'open-worker' }, { id: 'unknown', type: 'other' }]) {
  bridge.handleCommand(command)
}
assert.equal(opened.length, 0, 'invalid or unrelated commands must not open Harness')

let stateListener
const synced = []
const actions = { onGlobalStateChange: (listener, immediate) => {
  assert.equal(immediate, true)
  stateListener = listener
} }
bridge.initActions(actions, state => synced.push(state))
assert.equal(bridge.actions, actions)
const command = {
  id: 'formula-test', type: 'open-worker', prompt: '  请生成数量乘单价公式  ',
  context: { dataSample: ['private row'] }, authorization: 'must-not-forward'
}
const context = { app: 'sales', columns: ['数量', '单价'] }
const state = { context, command, user_info: { username: 'test-user' } }
stateListener(state)
listeners.get('eis-ai-command')({ detail: command })
assert.deepEqual(opened, [{ id: command.id, type: 'open-worker', prompt: command.prompt }], 'dual-channel command must hand off only one draft and no context/auth fields')
assert.equal(bridge.state.currentContext, context, 'qiankun context synchronization must remain intact')
assert.deepEqual(synced, [state], 'user/global-state callback must remain intact')

const nextContext = { app: 'hr', viewId: 'hr_user_manage' }
listeners.get('eis-ai-context')({ detail: nextContext })
assert.equal(bridge.state.currentContext, nextContext)
bridge.bindWindowEvents()
assert.equal(listeners.size, 2, 'rebinding must not duplicate command listeners')

assert.equal(bridge.handleCommand({ id: 'empty-draft', type: 'open-worker' }), true)
assert.deepEqual(opened.at(-1), { id: 'empty-draft', type: 'open-worker', prompt: '' })
bridge.handleCommand({ id: 'non-text', type: 'open-worker', prompt: { secret: 'ignored' } })
assert.equal(opened.at(-1).prompt, '', 'non-text payload must not be forwarded as a draft')
accepted = false
assert.equal(bridge.handleCommand({ id: 'rejected', type: 'open-worker', prompt: '草稿' }), false)
assert.equal(legacyCalls.length, 0, 'Harness rejection must not fall back to legacy mode, window or chat')
assert.equal(requests.length, 0, 'opening the assistant must never send a legacy request')

console.log('PASS: worker commands hand off one Harness draft across both buses without legacy requests or context leakage')
