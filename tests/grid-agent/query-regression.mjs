// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sourcePath = resolve('shared/eis-grid-agent-query.js')
const source = await readFile(sourcePath, 'utf8')
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const gridAgentQuery = await import(moduleUrl)

const {
  shouldPrefetchGridAgentQuery,
  inferGridAgentQueryOperation,
  buildGridAgentSearchQuery,
  pickGridAgentGroupColumn,
  buildGridAgentQueryPayload,
  formatGridAgentQueryResultForPrompt
} = gridAgentQuery

const columns = [
  { prop: 'id', label: 'ID', type: 'number' },
  { prop: 'name', label: '姓名', type: 'text' },
  { prop: 'department', label: '部门', type: 'text' },
  { prop: 'status', label: '状态', type: 'select' },
  { prop: 'hire_date', label: '入职日期', type: 'date' },
  { prop: 'salary_amount', label: '薪资金额', type: 'currency' },
  { prop: 'skill', label: '技能', type: 'text', source: 'properties' },
  { prop: 'attachment', label: '附件', type: 'file' }
]

const context = {
  apiUrl: '/api/hr/archives?select=id,name,status&status=eq.active&order=id.desc&limit=10',
  profile: 'hr',
  searchText: '研发',
  columns,
  gridAgent: {
    capabilities: { serverAgentQuery: true },
    relation: {
      apiUrl: '/api/hr/archives?select=id,name,status&status=eq.active&order=id.desc&limit=10',
      acceptProfile: 'hr'
    },
    dataAccess: {
      hasMore: true,
      searchText: '研发'
    },
    searchableColumns: columns
  }
}

assert.equal(shouldPrefetchGridAgentQuery('每个部门多少人', context), true, 'Chinese grouped count question should prefetch')
assert.equal(shouldPrefetchGridAgentQuery('请生成公式计算薪资金额', context), false, 'formula/write-like questions should not prefetch')
assert.equal(shouldPrefetchGridAgentQuery('查看最近员工明细', context), true, 'detail/sample questions should prefetch')

assert.equal(inferGridAgentQueryOperation('每个部门多少人', context), 'group_count', 'per-department headcount should be grouped')
assert.equal(inferGridAgentQueryOperation('状态统计', context), 'group_count', 'status statistics should be grouped when a status column exists')
assert.equal(inferGridAgentQueryOperation('薪资金额合计和平均值', context), 'numeric_summary', 'numeric aggregate should use numeric summary')
assert.equal(inferGridAgentQueryOperation('查看最近员工明细', context), 'sample', 'detail question should use sample operation')
assert.equal(inferGridAgentQueryOperation('帮我分析一下人员数据', context), 'overview', 'generic analysis should use overview')

assert.equal(pickGridAgentGroupColumn('每个部门多少人', columns)?.prop, 'department', 'explicit department label should pick department')
assert.equal(pickGridAgentGroupColumn('状态统计', columns)?.prop, 'status', 'explicit status label should pick status')

const searchQuery = buildGridAgentSearchQuery('研发', columns)
assert.ok(searchQuery.includes('name.ilike.*研发*'), 'search query should include normal text columns')
assert.ok(searchQuery.includes('department.ilike.*研发*'), 'search query should include department text column')
assert.ok(searchQuery.includes('properties->>skill.ilike.*研发*'), 'search query should include properties text columns')
assert.equal(searchQuery.includes('attachment'), false, 'search query should skip file columns')

const dateSearchQuery = buildGridAgentSearchQuery('2026-06-16', columns)
assert.ok(dateSearchQuery.includes('hire_date.eq.2026-06-16'), 'date-like search should match date fields exactly')

const payload = buildGridAgentQueryPayload({ context, userText: '每个部门多少人' })
assert.equal(payload.operation, 'group_count', 'payload should keep grouped count operation')
assert.equal(payload.api_url, '/hr/archives', 'payload should normalize API URL and trim /api prefix')
assert.equal(payload.accept_profile, 'hr', 'payload should keep accept profile')
assert.equal(payload.base_query, 'status=eq.active', 'payload should keep only business filters from base query')
assert.equal(payload.group_by, 'department', 'payload should group by the explicit department column')
assert.ok(payload.search_query.includes('department.ilike.*研发*'), 'payload should include decoded search query')
assert.ok(payload.columns.every((col) => col.prop !== 'attachment'), 'payload should exclude non-query columns')

const formatted = formatGridAgentQueryResultForPrompt({
  scope: 'server',
  operation: 'group_count',
  schema: 'hr',
  table: 'archives',
  searchApplied: true,
  totalCount: 12,
  groupBy: 'department',
  numericSummary: { salary_amount: { sum: 120000 } },
  sample: Array.from({ length: 10 }, (_, index) => ({ id: index + 1 })),
  durationMs: 18
})

assert.ok(formatted.includes('EISGrid 服务端受控查询结果'), 'formatted prompt should include controlled query header')
assert.ok(formatted.includes('"totalCount": 12'), 'formatted prompt should include total count')
assert.equal((formatted.match(/"id":/g) || []).length, 8, 'formatted prompt should limit samples to eight rows')

console.log('PASS: grid agent query semantic regression')
