// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const sourcePath = path.join(repoRoot, 'shared/eis-data-grid-paging.js')

function ref(value) {
  return { value }
}

function computed(getter) {
  return {
    get value() {
      return getter()
    }
  }
}

function loadGridPagingModule() {
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace(/^import\s+\{\s*computed,\s*ref\s*\}\s+from\s+['"]vue['"]\r?\n\r?\n/m, '')
    .replace(/\bexport const\b/g, 'const')
    .replace(/\bexport function\b/g, 'function')

  return Function('computed', 'ref', `${source}\nreturn { createPagedGridLoader, buildPagedUrl }\n`)(computed, ref)
}

const { createPagedGridLoader } = loadGridPagingModule()

async function runStaleAclRaceRegression() {
  const props = {
    apiUrl: '/archives?select=id,employee_no',
    defaultOrder: 'id.desc',
    staticColumns: [{ prop: 'employee_no' }],
    extraColumns: [],
    enableInfiniteScroll: true,
    pageSize: 50,
    maxClientRows: 1000,
    acceptProfile: 'hr',
    contentProfile: 'hr'
  }
  const gridData = ref([{ id: 'seed', employee_no: 'seed' }])
  const searchText = ref('')
  const isLoading = ref(false)
  const gridApi = ref(null)
  const events = []
  let loadFieldAclCalls = 0
  let releaseFirstAcl

  const loader = createPagedGridLoader({
    props,
    gridData,
    searchText,
    isLoading,
    gridApi,
    eventEmitter: (name, payload) => events.push({ name, payload }),
    loadFieldAcl: async () => {
      loadFieldAclCalls += 1
      if (loadFieldAclCalls === 1) {
        await new Promise((resolve) => {
          releaseFirstAcl = resolve
        })
      }
    },
    request: async ({ url }) => {
      if (url.includes('needle')) {
        return [{ id: 'fresh', employee_no: 'needle' }]
      }
      return [{ id: 'stale', employee_no: 'stale' }]
    },
    buildSearchQuery: (query) => `employee_no=ilike.*${encodeURIComponent(query)}*`,
    ElMessage: {
      error(message) {
        throw new Error(`unexpected grid load error: ${message}`)
      }
    },
    defaultProfile: 'hr'
  })

  const staleLoad = loader.loadData()
  searchText.value = 'needle'
  await loader.loadData()
  assert.deepEqual(gridData.value, [{ id: 'fresh', employee_no: 'needle' }])

  releaseFirstAcl()
  await staleLoad
  assert.deepEqual(
    gridData.value,
    [{ id: 'fresh', employee_no: 'needle' }],
    'stale grid load must not clear or replace the latest search results after ACL resolves late'
  )
  assert.equal(events.at(-1)?.payload?.searchText, 'needle')
}

async function runCreatedUuidRowPrependRegression() {
  const props = {
    apiUrl: '/sales_customers?status=neq.deleted',
    defaultOrder: 'created_at.desc.nullslast,id.desc',
    staticColumns: [],
    extraColumns: [],
    enableInfiniteScroll: true,
    pageSize: 50,
    maxClientRows: 1000,
    acceptProfile: 'public',
    contentProfile: 'public'
  }
  const gridData = ref([])
  const searchText = ref('')
  const isLoading = ref(false)
  const requests = []
  const loader = createPagedGridLoader({
    props,
    gridData,
    searchText,
    isLoading,
    gridApi: ref(null),
    eventEmitter: () => {},
    loadFieldAcl: async () => {},
    request: async ({ url }) => {
      requests.push(url)
      return [{
        id: 'aaaa0000-0000-4000-8000-000000000001',
        created_at: '2026-10-23T10:00:00.000Z',
        status: 'active'
      }]
    },
    buildSearchQuery: () => '',
    ElMessage: { error: (message) => { throw new Error(message) } },
    defaultProfile: 'public'
  })

  await loader.loadData()
  assert.match(requests[0], /order=created_at\.desc\.nullslast,id\.desc/)
  const created = {
    id: 'ffff0000-0000-4000-8000-000000000001',
    created_at: '2026-10-24T10:00:00.000Z',
    status: 'active'
  }

  assert.equal(loader.prependRow(created), true, 'created UUID row should prepend under created_at order')
  assert.deepEqual(gridData.value.map((row) => row.id), [created.id, 'aaaa0000-0000-4000-8000-000000000001'])
  assert.equal(requests.length, 1, 'prepending a created UUID row must not issue a full list reload')

  const microsecondLoader = createPagedGridLoader({
    props,
    gridData: ref([]),
    searchText: ref(''),
    isLoading: ref(false),
    gridApi: ref(null),
    eventEmitter: () => {},
    loadFieldAcl: async () => {},
    request: async () => [{
      id: 'bbbb0000-0000-4000-8000-000000000001',
      created_at: '2026-10-24T10:00:00.123123Z',
      status: 'active'
    }],
    buildSearchQuery: () => '',
    ElMessage: { error: (message) => { throw new Error(message) } },
    defaultProfile: 'public'
  })
  await microsecondLoader.loadData()
  assert.equal(microsecondLoader.prependRow({
    id: 'aaaa0000-0000-4000-8000-000000000001',
    created_at: '2026-10-24T10:00:00.123456Z',
    status: 'active'
  }), true, 'a newer microsecond timestamp should prepend even within one JavaScript millisecond')
}

await runStaleAclRaceRegression()
await runCreatedUuidRowPrependRegression()

console.log('PASS: grid paging stale-load and created UUID row regressions')
