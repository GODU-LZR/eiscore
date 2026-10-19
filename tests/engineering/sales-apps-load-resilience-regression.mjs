import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { SALES_APPS, SALES_COCKPIT_APP } from '../../eiscore-sales/src/utils/sales-apps.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = fs.readFileSync(path.join(root, 'eiscore-sales/src/views/SalesApps.vue'), 'utf8')
const require = createRequire(new URL('../../eiscore-sales/package.json', import.meta.url))
const { computed, ref } = require('vue')
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')
const { descriptor, errors } = parse(source, { filename: 'SalesApps.vue' })
assert.deepEqual(errors, [])
compileScript(descriptor, { id: 'sales-apps-load-resilience' })
assert.deepEqual(compileTemplate({
  source: descriptor.template.content,
  filename: 'SalesApps.vue',
  id: 'sales-apps-load-resilience'
}).errors, [])

const importSource = async (filename) => import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(path.join(root, filename), 'utf8')).toString('base64')}`)
const helpers = await importSource('shared/app-card-attention.js')
const salesHelpers = await importSource('eiscore-sales/src/utils/sales-attention.js')
const statSource = fs.readFileSync(path.join(root, 'shared/app-card-server-stats.js'), 'utf8')
const statHelpers = new Function(statSource
  .replace(/^import .*$/gm, '')
  .replace(/export /g, '') + '\nreturn { combineQueryParts, countStat, filterPart, orFilter, statNumber, sumStat }')()
const scope = {
  computed, ref,
  nextTick: async () => {},
  onMounted: () => {},
  watch: () => {},
  useRouter: () => ({ push: async () => {}, currentRoute: ref({ path: '' }) }),
  ChatLineSquare: {}, DataAnalysis: {}, DataBoard: {}, Document: {}, Money: {}, Tickets: {}, TrendCharts: {}, User: {},
  SALES_APPS,
  hasPerm: () => true,
  pushAiContext: () => {},
  isAppVisible: () => true,
  useDisplayVisibility: () => ({ visibility: ref({}) }),
  ...helpers,
  ...statHelpers,
  buildSalesFollowUpAttentionStats: salesHelpers.buildSalesFollowUpAttentionStats,
  isCustomerOverCredit: salesHelpers.isCustomerOverCredit,
  isFollowUpOpen: salesHelpers.isFollowUpOpen,
  isSalesOpportunityClosed: salesHelpers.isSalesOpportunityClosed,
  isSalesOrderClosed: salesHelpers.isSalesOrderClosed,
  salesOffsetDateText: salesHelpers.offsetDateText,
  salesTodayText: salesHelpers.todayText,
  SALES_CLOSED_FOLLOW_RESULTS: salesHelpers.SALES_CLOSED_FOLLOW_RESULTS,
  SALES_FOLLOW_UP_DUE_WINDOW_DAYS: salesHelpers.SALES_FOLLOW_UP_DUE_WINDOW_DAYS,
  SALES_ORDER_DUE_WINDOW_DAYS: salesHelpers.SALES_ORDER_DUE_WINDOW_DAYS
}
const setupSource = descriptor.scriptSetup.content.replace(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*$/gm, '')
const createSubject = (request, loadAppsCardStats = async () => ({})) => {
  const bindings = { ...scope, request, loadAppsCardStats }
  return new Function(...Object.keys(bindings), setupSource + '\nreturn { loadCardData, visibleApps, salesCardStatsSpec, appRows, serverStats, cardLoadStates, cardStatsStates, cardForApp }')(...Object.values(bindings))
}
const card = (subject, key) => subject.visibleApps.value.find((app) => app.key === key).card
const metrics = (subject, key) => card(subject, key).metrics.map((metric) => metric.value)
const statsStub = (respond, calls = []) => async ({ apps, getStats, timeout }) => {
  assert.equal(timeout, 15000, 'card statistics need the same read budget as row requests')
  const requested = apps.map((app) => {
    const spec = getStats(app)
    assert.deepEqual(spec.commonStats, [], 'retry requests must not add an unused default count')
    return { key: app.key, keys: spec.stats.map((stat) => stat.key) }
  })
  calls.push(requested)
  return respond(requested, calls.length)
}
const completeStats = (requested, overrides = {}) => Object.fromEntries(requested.map(({ key, keys }) => [
  key, Object.fromEntries(keys.map((statKey) => [statKey, overrides[key]?.[statKey] ?? 0]))
]))

// Exhausted requests stay unavailable and have a finite retry budget.
const rowCalls = new Map()
const failedStatsCalls = []
const failed = createSubject(async (config) => {
  rowCalls.set(config.url, (rowCalls.get(config.url) || 0) + 1)
  assert.equal(config.silentError, true)
  assert.equal(config.suppressErrorMessage, true)
  assert.equal(config.timeout, 15000)
  throw new Error('offline')
}, statsStub(() => ({}), failedStatsCalls))
assert.ok(metrics(failed, 'customers').every((value) => value === '—'))
await failed.loadCardData()
assert.ok([...rowCalls.values()].every((count) => count === 2))
assert.equal(failedStatsCalls.length, 2)
assert.equal(failed.cardStatsStates.value.customers.attempts, 2)
assert.equal(card(failed, 'customers').statusText, '暂不可用')
assert.deepEqual(metrics(failed, 'customers'), ['—', '—'])
assert.equal(failed.cardForApp(SALES_COCKPIT_APP).statusText, '可用')
assert.deepEqual(failed.cardForApp(SALES_COCKPIT_APP).metrics.map((metric) => metric.value), ['已就绪', '可用'])

// Exact counts are useful even when all row requests fail. Retry only missing keys/apps.
const partialStatsCalls = []
const partial = createSubject(async () => { throw new Error('rows unavailable') }, statsStub((requested, attempt) => attempt === 1
  ? { customers: { total: 31 }, quotes: { total: 12 } }
  : { customers: { total: null, receivable: null } }, partialStatsCalls))
await partial.loadCardData()
assert.deepEqual(metrics(partial, 'customers'), ['31', '—'])
assert.equal(card(partial, 'customers').statusText, '部分可用')
assert.equal(partial.serverStats.value.customers.total, 31, 'null retry results must preserve successful fields')
assert.equal(partialStatsCalls.length, 2)
assert.deepEqual(partialStatsCalls[1].find((app) => app.key === 'customers').keys, ['paused', 'receivable'])
assert.ok(!partialStatsCalls[1].some((app) => app.key === 'quotes'), 'fully resolved apps must not be retried')
assert.equal(metrics(partial, 'quotes')[0], '12')

// A 200-row sample is not an exact total or amount when summary requests fail.
const truncated = createSubject(async () => Array.from({ length: 200 }, (_, id) => ({ id })))
await truncated.loadCardData()
for (const key of ['customers', 'orders', 'payments']) {
  assert.ok(metrics(truncated, key).every((value) => value === '—'), `${key} must not turn unknown totals into zero`)
  assert.equal(card(truncated, key).statusText, '暂不可用')
}

// Complete row sets still provide a valid fallback, including genuine zeroes.
const offset = salesHelpers.offsetDateText
const followRows = [
  { follow_result: '待跟进', next_follow_at: offset(-1) },
  { follow_result: '待跟进', next_follow_at: offset(0) },
  { follow_result: '待跟进', next_follow_at: offset(1) },
  { follow_result: '待跟进', next_follow_at: offset(2) },
  { follow_result: '待跟进', next_follow_at: null },
  ...['已成交', '无效', '暂缓'].flatMap((follow_result) => [
    { follow_result, next_follow_at: offset(-1) },
    { follow_result, next_follow_at: offset(0) },
    { follow_result, next_follow_at: null }
  ])
]
const fallback = createSubject(async ({ url }) => {
  if (url.startsWith('/sales_customers?')) return [{ id: 1, credit_limit: 50, receivable_balance: 100 }]
  if (url.startsWith('/sales_follow_ups?')) return followRows
  if (url.startsWith('/sales_orders?')) return [
    ...[-1, 0, 2, 3].map((days) => ({ order_status: '已确认', delivery_date: offset(days), total_amount: 100 })),
    { order_status: '已完成', delivery_date: offset(0) }
  ]
  if (url.startsWith('/sales_opportunities?')) return [{ stage: '需求确认' }, { stage: '赢单' }]
  return []
})
await fallback.loadCardData()
assert.deepEqual(metrics(fallback, 'customers'), ['1', '100'])
assert.equal(card(fallback, 'customers').score, 92)
assert.equal(card(fallback, 'customers').attentionLevel, 'critical')
assert.deepEqual(metrics(fallback, 'follow_ups'), ['2', '1', '4'])
assert.deepEqual(metrics(fallback, 'orders'), ['4', '2/1'])
assert.deepEqual(metrics(fallback, 'shipment_requests'), ['4', '2/1'])
assert.deepEqual(metrics(fallback, 'opportunities'), ['1', '50%'])
assert.deepEqual(metrics(fallback, 'payments'), ['0', '0'])
assert.equal(card(fallback, 'quotes').metrics[0].value, '0')
assert.notEqual(card(fallback, 'payments').statusText, '暂不可用')

// Successful data is retained during later row/summary failures; fresh zeroes replace it.
let mode = 'recover'
const attempts = new Map()
const refreshStatsCalls = []
const subject = createSubject(async ({ url }) => {
  const count = (attempts.get(url) || 0) + 1
  attempts.set(url, count)
  if (mode === 'fail' || (mode === 'recover' && count === 1)) throw new Error('network switch')
  if (mode === 'empty') return []
  if (mode === 'stats-fail') return Array.from({ length: 200 }, (_, id) => ({ id }))
  return [{ id: 1, customer_status: '跟进中', receivable_balance: 100 }]
}, statsStub((requested) => ['fail', 'stats-fail'].includes(mode) ? {} : completeStats(requested, mode === 'empty' ? {} : {
  customers: { total: 31, receivable: 5000 }
}), refreshStatsCalls))
await subject.loadCardData()
assert.deepEqual(metrics(subject, 'customers'), ['31', '5000'])
assert.equal(subject.cardLoadStates.value.customers.attempts, 2)
assert.equal(refreshStatsCalls.length, 1)
mode = 'fail'
await subject.loadCardData()
assert.deepEqual(metrics(subject, 'customers'), ['31', '5000'])
assert.equal(card(subject, 'customers').statusText, '部分可用')
assert.equal(subject.appRows.value.customers.length, 1)
assert.equal(card(subject, 'shipment_requests').statusText, '部分可用')
mode = 'stats-fail'
await subject.loadCardData()
assert.equal(subject.cardLoadStates.value.customers.status, 'ready')
assert.equal(card(subject, 'customers').statusText, '部分可用', 'a failed statistics refresh must not make old statistics appear current')
mode = 'empty'
await subject.loadCardData()
assert.deepEqual(metrics(subject, 'customers'), ['0', '0'])
assert.equal(subject.appRows.value.customers.length, 0)
assert.notEqual(card(subject, 'customers').statusText, '部分可用')

// Server-side criteria must match the v5 business rules used by the fallback.
const followSpec = subject.salesCardStatsSpec({ key: 'follow_ups' })
const splitConditions = (text) => {
  let depth = 0, quoted = false, start = 0
  const parts = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '"') quoted = !quoted
    if (quoted) continue
    if (text[i] === '(') depth += 1
    if (text[i] === ')') depth -= 1
    if (text[i] === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1 }
  }
  return [...parts, text.slice(start)]
}
const matchesCondition = (row, expression) => {
  const group = expression.match(/^(and|or)\((.*)\)$/s)
  if (group) {
    const values = splitConditions(group[2]).map((part) => matchesCondition(row, part))
    return group[1] === 'and' ? values.every(Boolean) : values.some(Boolean)
  }
  const clause = expression.match(/^([^.]+)\.(not\.)?(is|match|lt|lte|gte)\.(.*)$/s)
  assert.ok(clause, `unsupported card predicate: ${expression}`)
  const [, field, negative, operator, raw] = clause
  const value = row[field]
  if (operator === 'is') return negative ? value != null : value == null
  if (value == null) return false
  const result = operator === 'match' ? new RegExp(raw.replace(/^"|"$/g, '').replaceAll('[[:space:]]', '\\s')).test(String(value))
    : operator === 'lt' ? value < raw : operator === 'lte' ? value <= raw : value >= raw
  return negative ? !result : result
}
const matchesFilter = (row, filter) => [...new URLSearchParams(filter)].every(([field, expression]) =>
  matchesCondition(row, ['and', 'or'].includes(field) ? `${field}${expression}` : `${field}.${expression}`))
for (const follow_result of [null, '', '待跟进', '有意向', '已成交', '无效', '暂缓', ' 暂缓 ', ' 无效 ', ' 已成交 ']) {
  for (const next_follow_at of [offset(-1), offset(0), offset(1), offset(2), null]) {
    const row = { follow_result, next_follow_at }
    const open = salesHelpers.isFollowUpOpen(row)
    const expected = {
      due: open && next_follow_at !== null && next_follow_at >= offset(0) && next_follow_at <= offset(1),
      overdue: open && next_follow_at !== null && next_follow_at < offset(0),
      todo: open && (next_follow_at === null || next_follow_at <= offset(1))
    }
    for (const [key, value] of Object.entries(expected)) {
      const filter = followSpec.stats.find((stat) => stat.key === key).filter
      assert.equal(matchesFilter(row, filter), value, `${key} must match the grid for ${JSON.stringify(row)}`)
    }
  }
}
const orderSpec = subject.salesCardStatsSpec({ key: 'orders' })
assert.ok(decodeURIComponent(orderSpec.stats.find((stat) => stat.key === 'due').filter).includes(`delivery_date=lte.${offset(2)}`))

console.log('PASS: sales cards bound retries, preserve partial statistics, avoid truncated zeroes and retain v5 attention rules')
﻿
