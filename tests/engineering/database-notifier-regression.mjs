// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const {
  createDatabaseNotifier,
  extractPayloadMeta,
  shouldSendToClient
} = require('../../realtime/database-notifier')

assert.deepEqual(extractPayloadMeta(''), { id: null, targets: [], roles: [], payload: null })
assert.deepEqual(extractPayloadMeta('{bad'), { id: null, targets: [], roles: [], payload: null })
assert.deepEqual(extractPayloadMeta(JSON.stringify({
  record_id: 42,
  users: 'u-1, u-2',
  role: ['manager', 'buyer']
})), {
  id: 42,
  targets: ['u-1', 'u-2'],
  roles: ['manager', 'buyer'],
  payload: { record_id: 42, users: 'u-1, u-2', role: ['manager', 'buyer'] }
})

const openState = 1
const baseClient = { readyState: openState, user: { id: 'u-1', role: 'manager' }, channels: new Set(['eis_events']) }
assert.equal(shouldSendToClient(baseClient, { targets: [], roles: [] }, 'eis_events', openState), true)
assert.equal(shouldSendToClient({ ...baseClient, readyState: 0 }, { targets: [], roles: [] }, 'eis_events', openState), false)
assert.equal(shouldSendToClient(baseClient, { targets: [], roles: [] }, 'other', openState), false)
assert.equal(shouldSendToClient(baseClient, { targets: ['u-1'], roles: ['other'] }, 'eis_events', openState), true)
assert.equal(shouldSendToClient(baseClient, { targets: ['u-2'], roles: ['manager'] }, 'eis_events', openState), false)
assert.equal(shouldSendToClient(baseClient, { targets: [], roles: ['manager'] }, 'eis_events', openState), true)

class FakeClient extends EventEmitter {
  constructor(config) {
    super()
    this.config = config
    this.queries = []
    this.connectCount = 0
    this.endCount = 0
  }

  async connect() {
    this.connectCount += 1
  }

  async query(sql) {
    this.queries.push(sql)
  }

  async end() {
    this.endCount += 1
  }
}

class FakeWorkflowEngine {
  constructor(config) {
    this.config = config
    this.events = []
    this.initializeCount = 0
    this.shutdownCount = 0
  }

  async initialize() {
    this.initializeCount += 1
  }

  async handleWorkflowEvent(payload) {
    this.events.push(payload)
  }

  async shutdown() {
    this.shutdownCount += 1
  }
}

const sent = new Map()
const makeWsClient = ({ id, role, channels = ['eis_events'], readyState = openState }) => ({
  readyState,
  user: { id, role },
  channels: new Set(channels),
  send: (message) => {
    const list = sent.get(id) || []
    list.push(JSON.parse(message))
    sent.set(id, list)
  }
})
const wss = {
  clients: new Set([
    makeWsClient({ id: 'u-1', role: 'manager' }),
    makeWsClient({ id: 'u-2', role: 'buyer' }),
    makeWsClient({ id: 'u-3', role: 'manager', channels: ['other'] }),
    makeWsClient({ id: 'u-4', role: 'manager', readyState: 0 })
  ])
}

const clients = []
const engines = []
const timers = []
const clearedTimers = []
const logs = []
const pgConfig = { host: 'db', port: 5432, user: 'postgres', password: 'secret', database: 'eiscore' }
const notifier = createDatabaseNotifier({
  wss,
  channel: 'eis_events',
  workflowChannel: 'workflow_event',
  enableWorkflowAutoTransition: true,
  pgConfig,
  createClient: (config) => {
    const client = new FakeClient(config)
    clients.push(client)
    return client
  },
  createWorkflowEngine: (config) => {
    const engine = new FakeWorkflowEngine(config)
    engines.push(engine)
    return engine
  },
  openState,
  setTimer: (callback, delay) => {
    const timer = { callback, delay }
    timers.push(timer)
    return timer
  },
  clearTimer: (timer) => clearedTimers.push(timer),
  now: () => '2026-08-31T00:00:00.000Z',
  log: {
    log: (...items) => logs.push(items.join(' ')),
    error: (...items) => logs.push(items.join(' '))
  }
})

assert.throws(() => notifier.query('SELECT 1'), /Database client not ready/)
await notifier.start()
assert.equal(clients.length, 1)
assert.deepEqual(clients[0].config, pgConfig)
assert.equal(clients[0].connectCount, 1)
assert.deepEqual(clients[0].queries, ['LISTEN eis_events', 'LISTEN workflow_event'])
assert.equal(engines.length, 1)
assert.equal(engines[0].initializeCount, 1)
await notifier.query('SELECT value FROM public.system_configs WHERE key = $1', ['ai_glm_config'])
assert.equal(clients[0].queries.at(-1), 'SELECT value FROM public.system_configs WHERE key = $1')

clients[0].emit('notification', {
  channel: 'eis_events',
  payload: JSON.stringify({ id: 'record-1', targets: ['u-1'], value: 7 })
})
assert.equal(sent.get('u-1').length, 1)
assert.equal(sent.has('u-2'), false)
assert.deepEqual(sent.get('u-1')[0], {
  type: 'db_notify',
  channel: 'eis_events',
  id: 'record-1',
  payload: { id: 'record-1', targets: ['u-1'], value: 7 },
  ts: '2026-08-31T00:00:00.000Z'
})

clients[0].emit('notification', {
  channel: 'eis_events',
  payload: JSON.stringify({ primary_key: 2, roles: ['buyer'] })
})
assert.equal(sent.get('u-2').length, 1)
assert.equal(sent.get('u-1').length, 1)

clients[0].emit('notification', { channel: 'workflow_event', payload: '{"id":9}' })
await new Promise((resolve) => setImmediate(resolve))
assert.deepEqual(engines[0].events, ['{"id":9}'])
assert.equal(sent.get('u-1').length, 1)

clients[0].emit('error', new Error('connection lost'))
clients[0].emit('end')
assert.equal(timers.length, 1)
assert.equal(timers[0].delay, 1000)
await timers[0].callback()
await new Promise((resolve) => setImmediate(resolve))
assert.equal(clients.length, 2)
assert.equal(clients[0].endCount, 1)
assert.equal(engines[0].shutdownCount, 1)
assert.deepEqual(clients[1].queries, ['LISTEN eis_events', 'LISTEN workflow_event'])

clients[1].emit('error', new Error('again'))
assert.equal(timers.length, 2)
await notifier.shutdown()
assert.equal(clearedTimers.length, 1)
assert.equal(clearedTimers[0], timers[1])
assert.equal(clients[1].endCount, 1)
assert.equal(engines[1].shutdownCount, 1)
await notifier.start()
assert.equal(clients.length, 2)
assert.ok(logs.some((message) => message.includes('Workflow engine initialized')))

const disabledClients = []
const disabledNotifier = createDatabaseNotifier({
  wss: { clients: new Set() },
  channel: 'eis_events',
  pgConfig,
  createClient: (config) => {
    const client = new FakeClient(config)
    disabledClients.push(client)
    return client
  },
  createWorkflowEngine: () => { throw new Error('workflow engine must stay disabled') },
  openState,
  log: { log: () => {}, error: () => {} }
})
await disabledNotifier.start()
assert.deepEqual(disabledClients[0].queries, ['LISTEN eis_events'])
await disabledNotifier.shutdown()

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/database-notifier'\)/)
assert.match(compositionRoot, /databaseNotifier\.start\(\)/)
assert.match(compositionRoot, /databaseNotifier\.shutdown\(\)/)
assert.match(compositionRoot, /databaseNotifier\.query\(/)
assert.doesNotMatch(compositionRoot, /require\('pg'\)/)
assert.doesNotMatch(compositionRoot, /require\('\.\/workflow-engine'\)/)
assert.doesNotMatch(compositionRoot, /function (connectPg|scheduleReconnect|notifyClients|extractPayloadMeta)/)
assert.ok(compositionRoot.split(/\r?\n/).length <= 6110, 'Realtime composition root must not regain notifier implementation')

console.log('PASS: database notifier preserves payload routing, channel/target/role filters, workflow dispatch, reconnect deduplication and shutdown cleanup')
