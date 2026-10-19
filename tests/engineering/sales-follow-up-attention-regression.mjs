// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SALES_APPS } from '../../eiscore-sales/src/utils/sales-apps.js'
import { buildGridTimeApiUrl, buildGridTimeRange, resolveGridTimeField } from '../../shared/eis-grid-time-filter.js'
import {
  buildSalesAttentionSummary,
  buildSalesFollowUpAttentionStats,
  buildSalesFollowUpAttentionSummary,
  matchesSalesAttentionFilter,
  offsetDateText,
  todayText
} from '../../eiscore-sales/src/utils/sales-attention.js'

const repo = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repo, path), 'utf8')
const url = (path) => pathToFileURL(resolve(repo, path)).href
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const vueUrl = url('eiscore-sales/node_modules/vue/index.mjs')
const { computed, effectScope, nextTick, ref } = await import(vueUrl)
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
const matches = (row, filter) => {
  if (!filter) return true
  const expression = filter.replace(/^(and|or)=\(/, '$1(')
  const group = expression.match(/^(and|or)\((.*)\)$/s)
  if (group) {
    const values = splitConditions(group[2]).map((part) => matches(row, part))
    return group[1] === 'and' ? values.every(Boolean) : values.some(Boolean)
  }
  const clause = expression.match(/^([^.]+)\.(not\.)?(is|in|match|lt|lte|gte)\.(.*)$/s)
  assert.ok(clause, `unsupported count predicate: ${expression}`)
  const [, field, negative, operator, raw] = clause
  const value = field.startsWith('properties->>') ? row.properties?.[field.slice(13)] : row[field]
  if (operator === 'is') return negative ? value != null : value == null
  if (value == null) return false // SQL NULL stays unknown under NOT.
  const pattern = raw.replace(/^"|"$/g, '').replaceAll('[[:space:]]', '\\s')
  const result = operator === 'match' ? new RegExp(pattern).test(String(value))
    : operator === 'in' ? raw.slice(1, -1).split(',').includes(value)
      : operator === 'lt' ? value < raw : operator === 'lte' ? value <= raw : value >= raw
  return negative ? !result : result
}
const today = todayText()
const tomorrow = offsetDateText(1)
const followApp = SALES_APPS.find(({ key }) => key === 'follow_ups')
const followTimeField = resolveGridTimeField(followApp, followApp.staticColumns)
assert.equal(followTimeField, 'follow_date', 'the real follow-up config must override the misleading 跟进编号 label')
const dayApiUrl = buildGridTimeApiUrl(followApp.apiUrl, followTimeField, buildGridTimeRange({ mode: 'day', day: today }))
assert.ok(!dayApiUrl.includes('follow_no='))
assert.ok(dayApiUrl.includes(`follow_date=gte.${today}&follow_date=lt.${tomorrow}`))
const rows = []
for (const follow_result of ['待跟进', '有意向', '报价中', '已成交', '无效', '暂缓', ' 暂缓 ', null]) {
  for (const next_follow_at of [null, offsetDateText(-2), today, tomorrow, offsetDateText(2)]) {
    for (const manual of [undefined, 'critical', 'warning', 'focus', 'normal', 'silent', '__auto', ' broken ', ' warning ']) {
      rows.push({ id: rows.length + 1, follow_result, next_follow_at, properties: { attention_level: manual } })
    }
  }
}
const exactCounts = (sourceRows, options = {}) => Object.fromEntries(
  buildSalesFollowUpAttentionStats({ today, tomorrow, ...options }).map(({ key, filter }) => [key, sourceRows.filter((row) => matches(row, filter)).length])
)
const full = exactCounts(rows)
const expected = buildSalesAttentionSummary('follow_ups', rows)
assert.equal(full.total, rows.length)
assert.ok(full.total > 200)
assert.deepEqual(buildSalesFollowUpAttentionSummary(full).counts, expected.counts, 'server predicates must match the existing v5 per-row attention rules')
assert.equal(full.todo, rows.filter((row) => matchesSalesAttentionFilter('follow_ups', row, 'todo')).length)
assert.equal(exactCounts([{ follow_result: '暂缓', next_follow_at: today }]).todo, 0)
assert.equal(exactCounts([{ follow_result: null, next_follow_at: null }]).todo, 1)
const topLevelRows = rows.slice(0, 25).map((row, index) => ({ ...row, attention_level: index % 2 ? 'critical' : 'focus' }))
assert.deepEqual(buildSalesFollowUpAttentionSummary(exactCounts(topLevelRows, { topLevelAttention: true })).counts,
  buildSalesAttentionSummary('follow_ups', topLevelRows).counts, 'top-level fallback only applies when the property is null or missing')
assert.deepEqual(buildSalesFollowUpAttentionSummary().counts, { critical: null, warning: null, focus: null, silent: null, normal: null })
assert.equal(buildSalesFollowUpAttentionSummary({ total: 0 }).total, 0)

const attentionSource = read('eiscore-sales/src/composables/use-sales-follow-up-attention.js')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace('computed, onUnmounted, ref, watch', 'computed, onScopeDispose as onUnmounted, ref, watch')
  .replace("import { countStat, loadAppCardStats } from '@shared/app-card-server-stats'", `
const countStat = (key, filter) => ({ key, filter })
const loadAppCardStats = (options) => globalThis.__salesAttentionLoad(options)
`)
  .replace("from '@/utils/grid-query'", `from '${url('eiscore-sales/src/utils/grid-query.js')}'`)
  .replace("from '@/utils/sales-attention'", `from '${url('eiscore-sales/src/utils/sales-attention.js')}'`)
const { useSalesFollowUpAttention } = await import(moduleUrl(attentionSource))
const wait = async () => { await nextTick(); await new Promise((done) => setTimeout(done, 15)) }
const app = ref(followApp)
const apiUrl = ref(app.value.apiUrl)
const attentionFilter = ref('all')
const loadedRows = ref(rows.slice(0, 200))
const searchText = ref('')
const calls = []
globalThis.__salesAttentionLoad = async (options) => { calls.push(options); return full }
const scope = effectScope()
const hook = scope.run(() => useSalesFollowUpAttention({
  app, apiUrl, attentionFilter, rows: loadedRows, searchText,
  staticColumns: ref([{ prop: 'customer_name' }]), extraColumns: ref([{ prop: 'project_name' }]),
  request: async () => []
}))
await wait()
assert.equal(hook.summary.value.total, rows.length, 'the first 200 grid rows cannot limit the label count')
assert.equal(calls[0].timeout, 15000)
assert.equal(calls[0].exactCountOnly, true)
assert.equal(hook.dataApiUrl.value, apiUrl.value)
attentionFilter.value = 'todo'
await wait()
const todoFilter = buildSalesFollowUpAttentionStats({ today, tomorrow }).find(({ key }) => key === 'todo').filter
assert.equal(hook.dataApiUrl.value, `${apiUrl.value}&${todoFilter}`)
assert.equal(calls.length, 1, 'selecting an attention label must not change the full count scope')
assert.equal(hook.summary.value.total, rows.length)
hook.handleDataLoaded({ append: false })
loadedRows.value = rows.slice(0, 400)
hook.handleDataLoaded({ append: true })
await wait()
assert.equal(calls.length, 1, 'pagination must not reset labels to the new loaded sample')
assert.equal(hook.summary.value.total, rows.length)
searchText.value = '消防'
apiUrl.value += '&follow_date=gte.2026-10-01&follow_date=lt.2026-11-01'
await wait()
assert.match(calls.at(-1).apiUrl, /follow_date=gte\.2026-10-01/)
assert.ok(!calls.at(-1).apiUrl.includes('and=('), 'counts retain the date/search scope without the selected attention predicate')
assert.match(hook.dataApiUrl.value, /follow_date=gte\.2026-10-01/)
assert.match(calls.at(-1).searchQuery, /customer_name\.ilike/)
assert.match(calls.at(-1).searchQuery, /properties->>project_name\.ilike/)
const beforeReload = calls.length
hook.handleDataLoaded({ append: false })
hook.handleDataLoaded({ append: false })
await wait()
assert.equal(calls.length, beforeReload + 1, 'same-scope writes/reloads must refresh complete counts, coalescing duplicate events')
let failures = 0
globalThis.__salesAttentionLoad = async () => { failures += 1; throw new Error('timeout') }
hook.refresh()
await wait()
assert.equal(failures, 2, 'count failures retry at most once')
assert.equal(hook.summary.value.total, null, 'failure must stay unknown rather than using 200 local records or zero')
assert.equal(hook.todoCount.value, null)
const pending = []
globalThis.__salesAttentionLoad = (options) => new Promise((done) => pending.push({ options, done }))
hook.refresh()
await wait()
searchText.value = '第二个范围'
await wait()
assert.equal(pending.length, 2)
pending[1].done({ ...full, total: 9000 })
await wait()
pending[0].done({ ...full, total: 8000 })
await wait()
assert.equal(hook.summary.value.total, 9000, 'an older request cannot overwrite the current search scope')
scope.stop()
delete globalThis.__salesAttentionLoad

const pagingSource = read('shared/eis-data-grid-paging.js').replace("from 'vue'", `from '${vueUrl}'`)
const { createPagedGridLoader } = await import(moduleUrl(pagingSource))
const scenarioRows = Array.from({ length: 63 }, (_, index) => ({
  id: index + 1, follow_date: today, follow_result: index < 52 ? '已成交' : '待跟进', next_follow_at: today, properties: {}
}))
const scenarioRowsWithOutsideDates = [...scenarioRows, ...[offsetDateText(-1), tomorrow].map((follow_date, index) => ({
  id: 100 + index, follow_date, follow_result: '待跟进', next_follow_at: today, properties: {}
}))]
const inQueryScope = (sourceRows, dataUrl) => {
  const query = new URL(dataUrl, 'https://example.test').searchParams
  return sourceRows.filter((row) => [...query].every(([field, expression]) => {
    if (field === 'and') return matches(row, `and=${expression}`)
    if (field === 'follow_date') return matches(row, `${field}.${expression}`)
    return true
  }))
}
const scenarioApiUrl = ref(dayApiUrl)
const scenarioFilter = ref('all')
const scenarioLoadedRows = ref([])
const scenarioCountCalls = []
globalThis.__salesAttentionLoad = async (options) => {
  scenarioCountCalls.push(options)
  return exactCounts(inQueryScope(scenarioRowsWithOutsideDates, options.apiUrl))
}
const scenarioScope = effectScope()
const scenario = scenarioScope.run(() => useSalesFollowUpAttention({
  app, apiUrl: scenarioApiUrl, attentionFilter: scenarioFilter,
  rows: scenarioLoadedRows, searchText: ref(''), staticColumns: ref([]), extraColumns: ref([]), request: async () => []
}))
await wait()
assert.equal(scenario.summary.value.total, 63)
assert.equal(scenario.todoCount.value, 11)
const gridData = ref([])
const dataUrls = []
let dataRows = scenarioRowsWithOutsideDates
const loader = createPagedGridLoader({
  props: { get apiUrl() { return scenario.dataApiUrl.value }, enableInfiniteScroll: true, pageSize: 200, autoSizeColumns: false },
  gridData, searchText: ref(''), isLoading: ref(false), gridApi: ref(null),
  loadFieldAcl: async () => {}, buildSearchQuery: () => '', ElMessage: { error(message) { throw new Error(message) } },
  request: async ({ url: dataUrl }) => {
    dataUrls.push(dataUrl)
    const query = new URL(dataUrl, 'https://example.test').searchParams
    const filtered = inQueryScope(dataRows, dataUrl)
    const offset = Number(query.get('offset') || 0)
    return filtered.slice(offset, offset + Number(query.get('limit') || filtered.length))
  },
  eventEmitter: (_, payload) => { scenarioLoadedRows.value = payload.rawRows; scenario.handleDataLoaded(payload) }
})
scenarioFilter.value = 'todo'
await loader.loadData()
await wait()
assert.equal(gridData.value.length, 11, 'selecting todo fetches its records rather than filtering a previously loaded page')
assert.equal(scenario.summary.value.total, 63, 'the all label keeps the complete 63-row scope while todo is selected')
assert.ok(scenarioCountCalls.every((options) => options.apiUrl === scenarioApiUrl.value))
assert.ok(dataUrls.at(-1).includes(todoFilter))
assert.ok(dataUrls.at(-1).includes(`follow_date=gte.${today}`))
assert.ok(dataUrls.at(-1).includes(`follow_date=lt.${tomorrow}`))
dataRows = [...Array.from({ length: 1101 }, (_, index) => ({ id: -index - 1, follow_date: today, follow_result: '已成交', properties: {} })), ...scenarioRowsWithOutsideDates.slice(52)]
await loader.loadData()
assert.equal(gridData.value.length, 11, 'matching records beyond the first 1000 unfiltered rows must still be fetched')
scenarioFilter.value = 'all'
dataRows = scenarioRowsWithOutsideDates
await loader.loadData()
assert.equal(gridData.value.length, 63, 'clearing attention selection restores the complete date scope, excluding yesterday and tomorrow')
assert.equal(scenario.dataApiUrl.value, scenarioApiUrl.value)
app.value = { key: 'orders', apiUrl: '/sales_orders?status=neq.deleted' }
scenarioFilter.value = 'todo'
assert.equal(scenario.dataApiUrl.value, scenarioApiUrl.value, 'other sales grids retain their existing local attention filtering')
scenarioScope.stop()
delete globalThis.__salesAttentionLoad

const historySource = read('shared/eis-data-grid-v2/composables/useGridHistory.js')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("import request from '@/utils/request'", 'const request = (config) => globalThis.__salesHistoryRequest(config)')
  .replace("import { ElMessage, ElMessageBox } from 'element-plus'", 'const ElMessage = { success() {}, error() {} }; const ElMessageBox = {}')
  .replace("import { shouldCalculateLoadedSummary } from '@shared/eis-grid-calculation-policy'", 'const shouldCalculateLoadedSummary = () => false')
  .replace("import { writeGridOperationLog } from '@shared/eis-grid-operation-audit'", 'const writeGridOperationLog = () => {}')
const { useGridHistory } = await import(moduleUrl(historySource))
const saved = []
const node = { data: { id: 'row-1', follow_result: '暂缓', properties: {} } }
const history = useGridHistory({ writeMode: 'patch', writeUrl: '/sales_follow_ups' }, ref({ refreshCells() {} }), ref([]),
  { refreshTotals() {} }, {}, { debounce: (fn) => fn, onSaved: (payload) => saved.push(payload) })
let finishWrite
globalThis.__salesHistoryRequest = () => new Promise((done) => { finishWrite = done })
history.pendingChanges.push({ rowNode: node, colDef: { field: 'follow_result' }, newValue: '暂缓' })
const save = history.debouncedSave()
assert.equal(saved.length, 0, 'refresh must wait for persistence, not the immediate edit event')
finishWrite([])
await save
assert.equal(saved.length, 1)
assert.deepEqual(saved[0].rows, [node.data])
globalThis.__salesHistoryRequest = async () => { throw new Error('write failed') }
history.pendingChanges.push({ rowNode: node, colDef: { field: 'follow_result' }, newValue: '待跟进' })
await history.debouncedSave()
assert.equal(saved.length, 1, 'failed writes do not emit data-saved')
delete globalThis.__salesHistoryRequest

const gridSource = read('eiscore-sales/src/components/SalesAppGrid.vue')
assert.ok(gridSource.indexOf('const extraColumns = ref([])') < gridSource.indexOf('} = useSalesFollowUpAttention('), 'immediate watcher dependencies must be initialized before the composable')
assert.match(gridSource, /@data-saved="refreshFollowUpAttention\(\)"/)
assert.match(gridSource, /@delete-complete="refreshFollowUpAttention\(\)"/)
assert.match(gridSource, /handleFollowUpAttentionLoaded\(payload\)/)
assert.match(gridSource, /:api-url="gridDataApiUrl"/)
assert.match(gridSource, /app, apiUrl: gridApiUrl, attentionFilter,/)
assert.match(gridSource, /watch\(\[attentionFilter, gridDataApiUrl\],[\s\S]*?\{ flush: 'post' \}/, 'reload after child API props update')
console.log('PASS: follow-up exact attention counts, server filtering, full 63/todo 11 scope, >1000 rows, search/date scope, failures/races and persistence refresh')
