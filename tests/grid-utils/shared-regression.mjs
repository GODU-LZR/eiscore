// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const importSharedModule = async (relativePath, { stripVueImport = false } = {}) => {
  const sourcePath = resolve(relativePath)
  let source = await readFile(sourcePath, 'utf8')
  if (stripVueImport) {
    source = source.replace(/^import\s+\{[^}]+\}\s+from\s+'vue'\n/m, '')
  }
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return import(moduleUrl)
}

const paging = await importSharedModule('shared/eis-data-grid-paging.js', { stripVueImport: true })
const timeFilter = await importSharedModule('shared/eis-grid-time-filter.js')
const serverSummary = await importSharedModule('shared/eis-grid-server-summary.js')

assert.equal(paging.normalizePageSize('bad', 5000), 1000, 'invalid page size fallback should still be clamped')
assert.equal(paging.normalizePageSize(12), 50, 'page size should keep a safe minimum')
assert.equal(paging.normalizePageSize(1800), 1000, 'page size should keep a safe maximum')
assert.equal(paging.normalizeMaxClientRows('bad', 50), 1000, 'invalid max rows fallback should keep safe minimum')

assert.equal(
  paging.appendQuery('/api/items#grid', 'limit=10'),
  '/api/items?limit=10#grid',
  'paging query should be inserted before hash fragments'
)
assert.equal(
  paging.appendQuery('/api/items?status=eq.open#grid', '&limit=10'),
  '/api/items?status=eq.open&limit=10#grid',
  'paging query should preserve existing query and hash fragments'
)
assert.equal(paging.hasExplicitPaging('/api/items?limit=20'), true, 'explicit limit should be detected')
assert.equal(paging.hasExplicitPaging('/api/items#grid?limit=20'), false, 'hash fragment paging should not be treated as API paging')

assert.equal(
  paging.buildPagedUrl({
    baseUrl: '/api/items#grid',
    defaultOrder: 'id.desc',
    searchText: '',
    staticColumns: [],
    extraColumns: [],
    buildSearchQuery: null,
    limit: 'bad',
    offset: -10,
    enablePaging: true
  }),
  '/api/items?order=id.desc&limit=200&offset=0#grid',
  'paged URL should clamp paging values and keep hash fragments last'
)
assert.equal(
  paging.buildPagedUrl({
    baseUrl: '/api/items#grid?order=id.asc',
    defaultOrder: 'id.desc',
    searchText: '',
    staticColumns: [],
    extraColumns: [],
    buildSearchQuery: null,
    limit: 200,
    offset: 20,
    enablePaging: true
  }),
  '/api/items?order=id.desc&limit=200&offset=20#grid?order=id.asc',
  'paged URL should ignore query-like hash fragments when appending real query params'
)
assert.equal(
  paging.buildPagedUrl({
    baseUrl: '/api/items?limit=20',
    defaultOrder: 'id.desc',
    searchText: '',
    staticColumns: [],
    extraColumns: [],
    buildSearchQuery: null,
    limit: 200,
    offset: 20,
    enablePaging: true
  }),
  '/api/items?limit=20&order=id.desc',
  'paged URL should not append duplicate paging to explicit paging URLs'
)

assert.deepEqual(
  paging.mergeRowsById([{ id: 1, name: 'old' }, { id: 2, name: 'keep' }], [{ id: 1, name: 'new' }, { name: 'anonymous' }]),
  [{ id: 1, name: 'new' }, { id: 2, name: 'keep' }, { name: 'anonymous' }],
  'row merge should replace existing ids and append rows without ids'
)

const fallbackDate = new Date(2026, 5, 16)
assert.equal(timeFilter.formatDate(timeFilter.parseLocalDate('2026-02-31', fallbackDate)), '2026-06-16', 'invalid day should fall back safely')
assert.deepEqual(timeFilter.getMonthRange('2026-13', fallbackDate), ['2026-06-01', '2026-07-01'], 'invalid month should fall back safely')
assert.deepEqual(timeFilter.getYearRange('bad', fallbackDate), ['2026-01-01', '2027-01-01'], 'invalid year should fall back safely')
assert.deepEqual(
  timeFilter.buildGridTimeRange({ mode: 'custom', customRange: ['2026-06-01', '2026-02-31'], today: fallbackDate }),
  null,
  'invalid custom ranges should not generate fallback data filters'
)
assert.deepEqual(
  timeFilter.buildGridTimeRange({ mode: 'day', day: '2026-06-16', today: fallbackDate }),
  { start: '2026-06-16', end: '2026-06-17' },
  'day range should include the selected day and exclude the next day'
)
assert.deepEqual(
  timeFilter.buildGridTimeRange({ mode: 'day', day: '2026-02-31', today: fallbackDate }),
  { start: '2026-06-16', end: '2026-06-17' },
  'invalid day ranges should fully fall back to today'
)
assert.equal(
  timeFilter.buildGridTimeApiUrl('/api/orders#grid', 'order_date', { start: '2026-06-01', end: '2026-07-01' }),
  '/api/orders?order_date=gte.2026-06-01&order_date=lt.2026-07-01#grid',
  'time filters should be inserted before hash fragments'
)

assert.equal(
  serverSummary.extractApiFilterQuery('/api/orders?select=id&status=eq.open&order=id.desc&limit=20&or=(name.ilike.*%E7%A0%94%E5%8F%91*)'),
  'status=eq.open&or=(name.ilike.*研发*)',
  'server summary filters should remove pagination/sort and decode business filters'
)
assert.equal(
  serverSummary.extractApiFilterQuery('/api/orders?status=eq.open#grid?limit=20'),
  'status=eq.open',
  'server summary filters should ignore hash fragments'
)

const summaryPayload = serverSummary.buildServerSummaryPayload({
  props: {
    viewId: 'orders',
    apiUrl: '/api/orders?select=id&status=eq.open&order=id.desc&limit=20#grid',
    acceptProfile: 'sales',
    staticColumns: [{ prop: 'amount', label: '金额', type: 'currency' }],
    extraColumns: [{ prop: 'profit', label: '利润', type: 'number' }]
  },
  summaryConfig: {
    rules: { amount: 'sum' },
    expressions: { profit: '{金额} * 0.2' }
  },
  searchText: '研发',
  buildSearchQuery: (text) => `&or=(customer.ilike.*${encodeURIComponent(text)}*)`
})

assert.equal(summaryPayload.view_id, 'orders', 'summary payload should keep view id')
assert.equal(summaryPayload.api_url, '/orders', 'summary payload should trim /api prefix')
assert.equal(summaryPayload.accept_profile, 'sales', 'summary payload should keep accept profile')
assert.equal(summaryPayload.base_query, 'status=eq.open', 'summary payload should keep only business filters')
assert.equal(summaryPayload.search_query, 'or=(customer.ilike.*研发*)', 'summary payload should decode search filters')
assert.deepEqual(
  summaryPayload.columns.map((item) => ({ prop: item.prop, source: item.source, rule: item.rule })),
  [
    { prop: 'amount', source: 'column', rule: 'sum' },
    { prop: 'profit', source: 'properties', rule: 'none' }
  ],
  'summary payload should include rule and expression columns with the correct source'
)

const totalRows = serverSummary.buildServerSummaryRow({
  response: { results: { amount: { value: 1200 }, profit: { value: 0 } } },
  props: {
    staticColumns: [{ prop: 'amount', label: '金额', type: 'currency' }],
    extraColumns: [{ prop: 'profit', label: '利润', type: 'number' }]
  },
  summaryConfig: {
    label: '合计',
    rules: { amount: 'sum' },
    expressions: { profit: '{金额} * 0.2' }
  },
  evaluateFormulaExpression: (expr) => {
    assert.equal(expr, '1200 * 0.2', 'formula expression should resolve label placeholders before evaluation')
    return 240
  }
})

assert.deepEqual(totalRows, [{ id: 'bottom_total', _status: '合计(全量)', properties: { profit: 240 }, amount: 1200 }], 'summary row should evaluate static and properties totals')

console.log('PASS: grid shared utility regression')
