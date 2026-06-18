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
    .replace("import { computed, ref } from 'vue'\n\n", '')
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

await runStaleAclRaceRegression()

console.log('PASS: grid paging stale-load regression')
