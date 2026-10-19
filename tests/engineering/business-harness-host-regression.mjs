// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { isStandaloneBusinessHarnessPath } from '../../eiscore-base/src/domain/base-layout-host-tab-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (name) => readFileSync(resolve(repoRoot, `eiscore-base/src/components/harness/${name}.vue`), 'utf8')
const frameSource = read('BusinessHarnessFrame')
const hostSource = read('BusinessHarnessHost')
const slotSource = read('HarnessWorkspaceSlot')
const tick = () => new Promise((done) => setImmediate(done))
const authSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/services/business-harness-auth.js'), 'utf8')
  .replace(/^import[^\n]+\n/gm, '')
  .replace(/^export /gm, '')

function authQueue() {
  const calls = []
  const { prepareBusinessHarnessAuth } = runInNewContext(`${authSource}\n;({ prepareBusinessHarnessAuth })`, {
    prepareHarnessAuth: (options) => new Promise((resolveAuth, reject) => calls.push({ options, resolve: resolveAuth, reject }))
  })
  return { calls, prepareBusinessHarnessAuth }
}

// Execute the real setup scripts; only Vue scheduling and browser effects are substituted.
function setup(source, names, context = {}) {
  const watchers = []
  const lifecycle = { mounted: [], unmount: [], activated: [], deactivated: [] }
  const listeners = []
  const timers = new Map()
  let timerId = 0
  const valueOf = (target) => Array.isArray(target) ? target.map(valueOf) : typeof target === 'function' ? target() : target.value
  const changed = (next, previous) => Array.isArray(next) ? next.some((value, i) => !Object.is(value, previous[i])) : !Object.is(next, previous)
  const sandbox = {
    ref: (value) => ({ value }),
    computed: (readValue) => ({ get value() { return readValue() } }),
    watch: (target, callback, options = {}) => {
      const previous = valueOf(target)
      watchers.push({ target, callback, previous })
      if (options.immediate) callback(previous)
    },
    onMounted: (callback) => lifecycle.mounted.push(callback),
    onBeforeUnmount: (callback) => lifecycle.unmount.push(callback),
    onActivated: (callback) => lifecycle.activated.push(callback),
    onDeactivated: (callback) => lifecycle.deactivated.push(callback),
    setTimeout: (callback) => { const id = ++timerId; timers.set(id, callback); return id },
    clearTimeout: (id) => timers.delete(id),
    window: {
      location: { origin: 'https://host.test' },
      addEventListener: (type, callback, capture) => listeners.push({ type, callback, capture }),
      removeEventListener: (type, callback, capture) => {
        const index = listeners.findIndex((entry) => entry.type === type && entry.callback === callback && entry.capture === capture)
        assert.notEqual(index, -1, 'listener removal must match registration')
        listeners.splice(index, 1)
      }
    },
    ...context
  }
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '')
    .replaceAll('import.meta.env.VITE_HARNESS_WEB_URL', 'undefined')
  const state = runInNewContext(`${script}\n;({ ${names} })`, sandbox)
  const flush = () => {
    for (let pass = 0; pass < 10; pass++) {
      let ran = false
      for (const watcher of watchers) {
        const next = valueOf(watcher.target)
        if (!changed(next, watcher.previous)) continue
        const previous = watcher.previous
        watcher.previous = next
        watcher.callback(next, previous)
        ran = true
      }
      if (!ran) return
    }
    assert.fail('watchers did not settle')
  }
  const runTimers = () => {
    const batch = [...timers]
    for (const [id, callback] of batch) {
      if (!timers.delete(id)) continue
      callback()
    }
  }
  return { state, sandbox, listeners, timers, lifecycle, flush, runTimers }
}

function frameHarness(active = false, queue = authQueue(), token = 'identity-a') {
  const props = { active }
  const user = { token }
  const shared = { pendingDraft: null }
  const calls = queue.calls
  const sent = []
  const contentWindow = { postMessage: (message, origin) => sent.push({ message, origin }) }
  const runtime = setup(frameSource, 'frame, ready, pending, failed, draftDeliveryFailed, prepare, deliverDraft, receiveDraftResult', {
    defineProps: () => props,
    useUserStore: () => user,
    getAuthHeader: () => user.token ? { Authorization: `Bearer ${user.token}` } : {},
    prepareBusinessHarnessAuth: queue.prepareBusinessHarnessAuth,
    businessHarnessState: shared,
    Loading: {}
  })
  runtime.state.frame.value = { contentWindow }
  runtime.lifecycle.mounted.forEach((callback) => callback())
  return { ...runtime, props, user, shared, calls, sent, contentWindow }
}

// The former Home auth contract lives here: lazy, no duplicate request, preserve, fail, retry.
{
  const test = frameHarness()
  assert.equal(test.calls.length, 0, 'hidden panel must not authenticate')
  test.props.active = true
  test.flush()
  await tick()
  assert.equal(test.calls.length, 1)
  assert.equal(test.state.pending.value, true)
  assert.equal(test.calls[0].options.harnessWebUrl, '/harness-embed/')
  assert.equal(test.calls[0].options.authorization, 'Bearer identity-a')
  test.props.active = false
  test.flush()
  test.props.active = true
  test.flush()
  await test.state.prepare()
  assert.equal(test.calls.length, 1, 'pending switches and retry clicks cannot duplicate auth')
  test.calls[0].resolve(true)
  await tick()
  assert.equal(test.state.ready.value, true)
  assert.equal(test.state.pending.value, false)
  test.props.active = false
  test.flush()
  test.props.active = true
  test.flush()
  assert.equal(test.calls.length, 1, 'reopening must preserve the authenticated iframe')
  test.state.failed.value = true
  const failure = test.state.prepare()
  await tick()
  test.calls[1].resolve(false)
  await failure
  assert.equal(test.state.ready.value, false)
  assert.equal(test.state.pending.value, false)
  assert.equal(test.state.failed.value, true)
  test.props.active = false
  test.flush()
  test.props.active = true
  test.flush()
  assert.equal(test.calls.length, 2, 'failed auth waits for explicit retry')
  const thrown = test.state.prepare()
  await tick()
  test.calls[2].reject(new Error('transport failure'))
  await thrown
  assert.equal(test.state.failed.value, true, 'transport failure must remain recoverable')
  const retry = test.state.prepare()
  await tick()
  test.calls[3].resolve(true)
  await retry
  assert.equal(test.state.ready.value, true)
  assert.equal(test.state.failed.value, false)
}

// An old identity or an unmounted component must never win an async auth race.
{
  const test = frameHarness(true)
  await tick()
  test.user.token = 'identity-b'
  test.flush()
  await tick()
  assert.equal(test.calls.length, 1, 'identity handoffs must not overlap')
  test.calls[0].resolve(true)
  await tick()
  assert.equal(test.calls.length, 2)
  assert.equal(test.calls[1].options.authorization, 'Bearer identity-b')
  assert.equal(test.state.ready.value, false)
  assert.equal(test.state.pending.value, true, 'old result cannot finish current auth')
  test.calls[1].resolve(false)
  await tick()
  assert.equal(test.state.failed.value, true)
  const retry = test.state.prepare()
  await tick()
  test.lifecycle.unmount.forEach((callback) => callback())
  assert.equal(test.listeners.length, 0, 'message listener must be removed')
  test.calls[2].resolve(true)
  await retry
  assert.equal(test.state.ready.value, false, 'unmounted request cannot revive the iframe')
}
{
  const test = frameHarness()
  test.user.token = 'identity-b'
  test.flush()
  assert.equal(test.calls.length, 0, 'identity changes must stay lazy while hidden')
}
{
  const test = frameHarness(true)
  await tick()
  test.shared.pendingDraft = { id: 'identity-a-draft', prompt: 'Keep this private' }
  test.flush()
  assert.equal(test.timers.size, 1)
  test.user.token = 'identity-b'
  test.flush()
  assert.equal(test.timers.size, 0, 'identity changes must stop the old draft delivery')
  test.user.token = 'identity-c'
  test.flush()
  test.calls[0].resolve(true)
  await tick()
  assert.equal(test.calls.length, 2, 'superseded queued identities must skip handoff')
  assert.equal(test.calls[1].options.authorization, 'Bearer identity-c')
  test.calls[1].resolve(true)
  await tick()
  assert.equal(test.state.ready.value, true)
  test.user.token = ''
  test.flush()
  await tick()
  assert.equal(test.calls.length, 2, 'no token must not initiate a cookie handoff')
  assert.equal(test.state.failed.value, true)
  assert.equal(test.state.ready.value, false)
}

// The same service queue survives component destruction and serializes a new identity.
{
  const queue = authQueue()
  const previous = frameHarness(true, queue, 'identity-before-unmount')
  await tick()
  assert.equal(queue.calls.length, 1)
  previous.lifecycle.unmount.forEach((callback) => callback())
  const current = frameHarness(true, queue, 'identity-after-unmount')
  await tick()
  assert.equal(queue.calls.length, 1, 'a fresh frame must wait for the old cookie handoff')
  assert.equal(current.state.pending.value, true)
  queue.calls[0].resolve(true)
  await tick()
  assert.equal(queue.calls.length, 2)
  assert.equal(queue.calls[1].options.authorization, 'Bearer identity-after-unmount')
  assert.equal(previous.state.ready.value, false, 'old instance cannot revive after unmount')
  assert.equal(current.state.ready.value, false)
  queue.calls[1].resolve(true)
  await tick()
  assert.equal(current.state.ready.value, true)
}
{
  const queue = authQueue()
  const abandoned = frameHarness(true, queue, 'abandoned-before-handoff')
  abandoned.lifecycle.unmount.forEach((callback) => callback())
  const current = frameHarness(true, queue, 'current-identity')
  await tick()
  assert.equal(queue.calls.length, 1, 'an unmounted queued instance must be skipped')
  assert.equal(queue.calls[0].options.authorization, 'Bearer current-identity')
  queue.calls[0].resolve(true)
  await tick()
  assert.equal(abandoned.state.ready.value, false)
  assert.equal(current.state.ready.value, true)
}
{
  const queue = authQueue()
  const first = queue.prepareBusinessHarnessAuth({ authorization: 'Bearer failed' })
  const rejection = assert.rejects(first, /handoff rejected/)
  let isCurrent = true
  const cancelled = queue.prepareBusinessHarnessAuth({ authorization: 'Bearer superseded' }, () => isCurrent)
  const next = queue.prepareBusinessHarnessAuth({ authorization: 'Bearer next' })
  await tick()
  assert.equal(queue.calls.length, 1)
  isCurrent = false
  queue.calls[0].reject(new Error('handoff rejected'))
  await rejection
  assert.equal(await cancelled, false, 'isCurrent is checked when queued work starts')
  await tick()
  assert.equal(queue.calls.length, 2, 'a rejection cannot stall the shared queue')
  assert.equal(queue.calls[1].options.authorization, 'Bearer next')
  queue.calls[1].resolve(false)
  assert.equal(await next, false)
  const recovered = queue.prepareBusinessHarnessAuth({ authorization: 'Bearer recovered' })
  await tick()
  queue.calls[2].resolve(true)
  assert.equal(await recovered, true, 'a false auth result must also allow subsequent work')
}
for (const view of ['HarnessView', 'EmbedView']) {
  const source = readFileSync(resolve(repoRoot, `eiscore-base/src/views/${view}.vue`), 'utf8')
  assert.match(source, /prepareBusinessHarnessAuth as prepareHarnessAuth(?:Request)?[^\n]*from ['"]@\/services\/business-harness-auth['"]/, `${view} must use the same business handoff queue`)
  for (const scenario of ['success', 'queued-unmount', 'queued-token', 'active-unmount', 'active-token']) {
    const queue = authQueue()
    const user = { token: 'view-identity' }
    const messages = []
    const queued = scenario.startsWith('queued-')
    const blocker = queued ? queue.prepareBusinessHarnessAuth({ authorization: 'Bearer blocking' }) : null
    if (queued) await tick()
    const test = setup(source, 'harnessReady, harnessFailed', {
      getAuthHeader: () => user.token ? { Authorization: `Bearer ${user.token}` } : {},
      prepareHarnessAuth: queue.prepareBusinessHarnessAuth,
      useRoute: () => ({ params: { feature: 'smart-bi' } }),
      window: { parent: { postMessage: (message, origin) => messages.push({ message, origin }) } }
    })
    const mounted = test.lifecycle.mounted.map((callback) => callback())
    await tick()
    assert.equal(queue.calls.length, 1)
    assert.equal(test.state.harnessReady.value, false)
    if (scenario.endsWith('unmount')) test.lifecycle.unmount.forEach((callback) => callback())
    if (scenario.endsWith('token')) user.token = 'replacement-identity'
    queue.calls[0].resolve(true)
    if (blocker) await blocker
    await Promise.all(mounted)
    assert.equal(queue.calls.length, 1, `${view} ${scenario}: expired queued work must not start another handoff`)
    assert.equal(test.state.harnessReady.value, scenario === 'success', `${view} ${scenario}: only a current mounted identity may become ready`)
    assert.equal(test.state.harnessFailed.value, false)
    const expectedMessages = scenario === 'success' && view === 'EmbedView' ? 1 : 0
    assert.equal(messages.length, expectedMessages, `${view} ${scenario}: stale auth cannot emit ready to the parent`)
    if (expectedMessages) {
      assert.deepEqual(JSON.parse(JSON.stringify(messages[0].message)), { source: 'eiscore', type: 'ready', feature: 'smart-bi' })
    }
  }
}

// Only the exact frame and origin may acknowledge a draft. No message sends the prompt.
{
  const test = frameHarness(true)
  const draft = { id: 'command-a', prompt: 'Inspect this record' }
  test.shared.pendingDraft = draft
  test.flush()
  assert.equal(test.sent.length, 1)
  assert.equal(test.sent[0].origin, 'https://host.test')
  assert.deepEqual(JSON.parse(JSON.stringify(test.sent[0].message)), { type: 'eiscore:harness-draft', version: 1, ...draft })
  const ack = { type: 'eiscore:harness-draft-result', version: 1, id: draft.id, status: 'applied' }
  const receive = (data, overrides = {}) => test.state.receiveDraftResult({ origin: 'https://host.test', source: test.contentWindow, data, ...overrides })
  for (const [data, overrides] of [
    [ack, { origin: 'https://foreign.test' }], [ack, { source: {} }],
    [{ ...ack, type: 'unrelated' }], [{ ...ack, version: 2 }],
    [{ ...ack, id: 'other-command' }], [{ ...ack, status: 'sent' }],
    [{ ...ack, status: 'failed' }], [null]
  ]) {
    receive(data, overrides)
    assert.equal(test.shared.pendingDraft, draft, 'invalid ack must preserve pending draft')
  }
  receive(ack)
  assert.equal(test.shared.pendingDraft, null)
  assert.equal(test.timers.size, 0)
  test.shared.pendingDraft = { id: 'command-b', prompt: 'Another draft' }
  test.flush()
  receive({ ...ack, id: 'command-b', status: 'queued' })
  assert.equal(test.shared.pendingDraft, null, 'the receiving UI owns its safely queued draft')
  assert.equal(test.sent.every(({ message }) => !('send' in message) && !('submit' in message)), true)
  test.shared.pendingDraft = { id: 'command-c', prompt: 'Keep until acknowledged' }
  test.flush()
  for (let i = 0; i < 9; i++) test.runTimers()
  assert.equal(test.state.draftDeliveryFailed.value, true)
  assert.equal(test.timers.size, 0, 'delivery retries must be bounded')
  assert.equal(test.shared.pendingDraft.id, 'command-c', 'timeout cannot lose the draft')
  test.state.deliverDraft()
  assert.equal(test.state.draftDeliveryFailed.value, false)
  test.props.active = false
  test.flush()
  assert.equal(test.timers.size, 0, 'hidden panels must stop delivery timers')
  const count = test.sent.length
  test.state.deliverDraft()
  assert.equal(test.sent.length, count)
  test.lifecycle.unmount.forEach((callback) => callback())
  assert.equal(test.timers.size, 0)
  assert.equal(test.listeners.length, 0)
}

// One fixed frame is retained through visibility/fullscreen/geometry changes.
assert.equal((hostSource.match(/<BusinessHarnessFrame\b/g) || []).length, 1)
assert.match(hostSource, /<section v-show="visible"/)
assert.match(hostSource, /<BusinessHarnessFrame v-if="started && !excluded" :active="visible"/)
assert.doesNotMatch(hostSource, /<Teleport\b|appendChild\(|replaceChild\(|<iframe\b/)
assert.equal((frameSource.match(/<iframe\b/g) || []).length, 1)
assert.match(frameSource, /<iframe v-if="ready && !failed"/)
assert.match(hostSource, /<HarnessFullscreenButton :fullscreen="fullscreen" @toggle="toggleFullscreen"/)
assert.match(readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8'), /<HarnessFullscreenButton/)
{
  const props = { workerVisible: true }
  const route = { path: '/sales/orders' }
  const user = { token: 'identity-a' }
  const shared = { assistantOpen: false, workspace: null, pendingDraft: null }
  const saved = []
  const observations = []
  let resetCalls = 0
  const reset = () => { resetCalls++; shared.assistantOpen = false; shared.pendingDraft = null }
  const test = setup(hostSource, 'visible, workspaceVisible, excluded, started, fullscreen, workspaceStyle, toggleFullscreen, measureWorkspace', {
    defineProps: () => props,
    useRoute: () => route,
    useUserStore: () => user,
    getWorkerFullscreen: () => false,
    saveWorkerFullscreen: (value) => saved.push(value),
    businessHarnessState: shared,
    resetBusinessHarness: reset,
    isStandaloneBusinessHarnessPath,
    ResizeObserver: class {
      observe(element) { observations.push(element) }
      disconnect() { observations.push('disconnect') }
    }
  })
  test.lifecycle.mounted.forEach((callback) => callback())
  const triggerCondition = hostSource.match(/<button v-if="([^"]+)"/)[1]
  const triggerVisible = () => runInNewContext(triggerCondition, {
    workerVisible: props.workerVisible,
    excluded: test.state.excluded.value,
    workspaceVisible: test.state.workspaceVisible.value,
    businessHarnessState: shared
  })
  assert.equal(test.state.visible.value, false)
  assert.equal(test.state.started.value, false)
  assert.equal(triggerVisible(), true)
  shared.assistantOpen = true
  test.flush()
  assert.equal(triggerVisible(), false)
  assert.equal(test.state.visible.value, true)
  assert.equal(test.state.started.value, true)
  test.state.toggleFullscreen()
  assert.equal(test.state.fullscreen.value, true)
  test.state.toggleFullscreen()
  assert.deepEqual(saved, [true, false])
  shared.assistantOpen = false
  test.flush()
  assert.equal(test.state.visible.value, false)
  assert.equal(test.state.started.value, true, 'close keeps frame mounted')
  route.path = '/hr/users'
  test.flush()
  assert.equal(test.state.started.value, true, 'business route changes keep frame mounted')
  route.path = '/'
  shared.workspace = { getBoundingClientRect: () => ({ top: 123, left: 45, width: 900, height: 600 }) }
  test.flush()
  assert.equal(test.state.workspaceVisible.value, true)
  assert.equal(test.state.visible.value, true)
  assert.equal(triggerVisible(), false)
  assert.equal(test.state.workspaceStyle.value.top, '123px')
  assert.equal(test.state.workspaceStyle.value.left, '45px')
  assert.equal(test.state.workspaceStyle.value.width, '900px')
  assert.equal(test.state.workspaceStyle.value.height, '600px')
  assert.equal(observations.includes(shared.workspace), true)
  shared.workspace = null
  test.flush()
  assert.equal(test.state.visible.value, false)
  assert.equal(Object.keys(test.state.workspaceStyle.value).length, 0)
  assert.equal(test.state.started.value, true, 'switching to flow preserves the same iframe')
  shared.assistantOpen = true
  shared.pendingDraft = { id: 'private' }
  route.path = '/apps/flash-builder/demo'
  test.flush()
  assert.equal(test.state.excluded.value, true)
  assert.equal(test.state.visible.value, false)
  assert.equal(triggerVisible(), false, 'Flash must not expose a business assistant trigger')
  assert.equal(test.state.started.value, false, 'Flash never retains a mounted business iframe')
  assert.equal(shared.pendingDraft, null)
  route.path = '/apps/flash-builders'
  test.flush()
  assert.equal(test.state.excluded.value, false, 'Flash path matching must have a segment boundary')
  props.workerVisible = false
  assert.equal(triggerVisible(), false)
  props.workerVisible = true
  shared.assistantOpen = true
  test.flush()
  user.token = 'identity-b'
  test.flush()
  assert.equal(shared.assistantOpen, false)
  assert.equal(test.state.visible.value, false)
  route.path = '/harness'
  test.flush()
  assert.equal(test.state.excluded.value, true)
  assert.equal(test.state.started.value, false, 'standalone Harness must not duplicate the shared iframe')
  assert.ok(resetCalls >= 3)
  assert.equal(test.listeners.length, 2)
  test.lifecycle.unmount.forEach((callback) => callback())
  assert.equal(test.listeners.length, 0, 'resize and capture scroll listeners must be removed')
  assert.equal(observations.at(-1), 'disconnect')
}

// A cached Home can relinquish its slot without unregistering a newer outlet.
assert.doesNotMatch(slotSource, /<iframe\b|Teleport|appendChild\(|prepareHarnessAuth/)
{
  const props = { active: false }
  const shared = { workspace: null }
  const test = setup(slotSource, 'outlet', { defineProps: () => props, businessHarnessState: shared })
  const element = {}
  test.state.outlet.value = element
  test.flush()
  assert.equal(shared.workspace, null)
  props.active = true
  test.flush()
  assert.equal(shared.workspace, element)
  test.lifecycle.deactivated.forEach((callback) => callback())
  assert.equal(shared.workspace, null)
  test.lifecycle.activated.forEach((callback) => callback())
  assert.equal(shared.workspace, element)
  const newerOutlet = {}
  shared.workspace = newerOutlet
  test.lifecycle.deactivated.forEach((callback) => callback())
  assert.equal(shared.workspace, newerOutlet, 'stale slot cannot unregister its successor')
  test.lifecycle.activated.forEach((callback) => callback())
  props.active = false
  test.flush()
  assert.equal(shared.workspace, null)
  props.active = true
  test.flush()
  test.lifecycle.unmount.forEach((callback) => callback())
  assert.equal(shared.workspace, null)
}

// Run the real controller: malformed commands cannot open or smuggle context into the shared host.
{
  const controllerSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/services/business-harness-controller.js'), 'utf8')
    .replace(/^import[^\n]+\n/gm, '')
    .replace(/^export /gm, '')
  const location = { pathname: '/sales/orders' }
  let sends = 0
  const controller = runInNewContext(`${controllerSource}\n;({ businessHarnessState, openHarnessAssistant, resetBusinessHarness })`, {
    shallowReactive: (value) => value,
    location,
    fetch: () => { sends++ },
    window: { postMessage: () => { sends++ } }
  })
  const { businessHarnessState: state, openHarnessAssistant: open, resetBusinessHarness: reset } = controller
  const workspace = {}
  state.workspace = workspace
  for (const command of [
    { type: 'open-enterprise' }, { type: 'close-worker' }, { type: true },
    { prompt: null }, { prompt: 42 }, { prompt: {} }, { prompt: [] },
    { prompt: 'x'.repeat(12001), id: 'too-long' },
    { prompt: 'A draft without an id' }, { prompt: 'Draft', id: '' },
    { prompt: 'Draft', id: 'x'.repeat(129) }
  ]) {
    assert.equal(open(command), false, `invalid command accepted: ${JSON.stringify(command).slice(0, 100)}`)
    assert.equal(state.assistantOpen, false)
    assert.equal(state.pendingDraft, null)
    assert.equal(state.workspace, workspace)
  }
  assert.equal(open({ type: 'open-worker', id: 'valid-command', prompt: 'Review this record', context: { privateRow: 'must not be retained' }, token: 'must not be retained', autoSend: true }), true)
  assert.equal(state.assistantOpen, true)
  assert.deepEqual(JSON.parse(JSON.stringify(state.pendingDraft)), { id: 'valid-command', prompt: 'Review this record' })
  assert.deepEqual(Object.keys(state).sort(), ['assistantOpen', 'pendingDraft', 'workspace'])
  const preserved = state.pendingDraft
  assert.equal(open({ type: 'unexpected', context: { privateRow: 'discard' } }), false)
  assert.equal(state.pendingDraft, preserved, 'rejected commands must not overwrite an existing draft')
  assert.equal(sends, 0, 'opening or storing a draft must never submit it')
  reset()
  assert.equal(state.assistantOpen, false)
  assert.equal(state.pendingDraft, null)
  assert.equal(state.workspace, workspace, 'reset must retain the mounted workspace outlet')
  assert.equal(open({ id: 'x'.repeat(128), prompt: 'x'.repeat(12000) }), true)
  assert.equal(state.pendingDraft.prompt.length, 12000)
  reset()
  for (const pathname of ['/apps/flash-builder', '/apps/flash-builder/', '/apps/flash-builder/project']) {
    location.pathname = pathname
    assert.equal(open({ type: 'open-worker', id: 'flash', prompt: 'Stay isolated' }), false)
    assert.equal(state.assistantOpen, false)
    assert.equal(state.pendingDraft, null)
  }
  location.pathname = '/apps/flash-builders'
  assert.equal(open(), true, 'Flash matching must stop at the path segment boundary')
  assert.equal(state.pendingDraft, null, 'opening without a prompt cannot fabricate a draft')
  assert.equal(sends, 0)
}

console.log('PASS: shared Harness lazy auth/races/retry, draft boundary and bounded delivery, persistent host/fullscreen, isolated routes, slot lifecycle and command controller')
