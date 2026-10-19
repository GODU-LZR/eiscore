// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const summaryUrl = moduleUrl(read('shared/eis-grid-server-summary.js'))
const exactRequests = []
globalThis.__cardStatsExactRequests = exactRequests
const source = read('shared/app-card-server-stats.js')
  .replace("from './eis-grid-server-summary'", `from '${summaryUrl}'`)
  .replace("import { getSharedHttpClient } from './eis-http'", `
const getSharedHttpClient = () => ({
  requestJson: async (url, options) => {
    if (globalThis.__cardStatsExactFailure) throw new Error('exact count unavailable')
    globalThis.__cardStatsExactRequests.push(options)
    return { headers: new Headers({ 'content-range': '0-0/18' }) }
  }
})
`)
const { countStat, loadAppCardStats, loadAppsCardStats, sumStat } = await import(moduleUrl(source))

let rpcCalls = 0
const values = await loadAppCardStats({
  app: { key: 'opportunities', apiUrl: '/sales_opportunities' },
  stats: [countStat('total'), sumStat('expectedAmount', 'expected_amount')],
  request: async (config) => {
    rpcCalls += 1
    assert.equal(config.url, '/rpc/eis_grid_summary')
    throw new Error('summary RPC temporarily unavailable')
  }
})

assert.equal(rpcCalls, 1)
assert.deepEqual(values, { total: 18 }, 'exact count must survive an unavailable aggregate RPC')
assert.equal('expectedAmount' in values, false, 'failed aggregates must remain unavailable rather than becoming zero')
assert.equal(exactRequests[0].timeoutMs, undefined, 'existing consumers must keep the default timeout')

const grouped = await loadAppsCardStats({
  apps: [{ key: 'opportunities', apiUrl: '/sales_opportunities' }],
  timeout: 15000,
  getStats: () => ({ stats: [sumStat('expectedAmount', 'expected_amount')] }),
  request: async (config) => {
    assert.equal(config.timeout, 15000, 'aggregate RPC must use the supplied read timeout')
    return { results: { expected_amount: { value: 1200 } } }
  }
})
assert.equal(exactRequests.at(-1).timeoutMs, 15000, 'exact counts must use the supplied read timeout')
assert.deepEqual(grouped, { opportunities: { count: 18, expectedAmount: 1200 } })
globalThis.__cardStatsExactFailure = true
let fallbackCalls = 0
assert.deepEqual(await loadAppCardStats({
  app: { key: 'follow_ups', apiUrl: '/sales_follow_ups' },
  stats: [countStat('todo', 'or=(next_follow_at.is.null,next_follow_at.lte.2026-10-20)')],
  exactCountOnly: true,
  request: async () => {
    fallbackCalls += 1
    return { results: { todo: { value: 99 } } }
  }
}), {}, 'unsupported fallback filters must not produce an unrelated count')
assert.equal(fallbackCalls, 0)
delete globalThis.__cardStatsExactFailure
delete globalThis.__cardStatsExactRequests

console.log('PASS: app-card stats preserves exact counts when aggregate summary RPC fails')
