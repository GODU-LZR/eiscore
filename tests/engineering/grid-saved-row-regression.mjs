import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../../shared/eis-data-grid-paging.js', import.meta.url), 'utf8')
const paging = vm.runInNewContext(`${source.replace(/import \{ computed, ref \} from 'vue'/, '').replace(/export /g, '')}\n({ createPagedGridLoader, buildPagedUrl, matchesSavedRowQuery })`, {
  ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
  URLSearchParams, setTimeout
})
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const makeLoader = (options = {}) => {
  const props = {
    apiUrl: '/rows', defaultOrder: 'created_at.desc.nullslast,id.desc',
    enableInfiniteScroll: true, pageSize: 50, autoSizeColumns: false,
    staticColumns: [], extraColumns: [], ...options.props
  }
  const gridData = { value: [] }
  const searchText = { value: '' }
  const isLoading = { value: false }
  const events = []
  const errors = []
  const loader = paging.createPagedGridLoader({
    props, gridData, searchText, isLoading, gridApi: { value: null },
    eventEmitter: (...event) => events.push(event),
    loadFieldAcl: options.loadFieldAcl || (async () => {}),
    request: options.request || (async () => []),
    buildSearchQuery: text => `name=ilike.*${text}*`,
    ElMessage: { error: message => errors.push(message) }
  })
  return { ...loader, props, gridData, searchText, isLoading, events, errors }
}

// A reload fetches data and ACL in parallel, but never exposes rows before ACL.
const acl = deferred()
let dataStarted = false
const parallel = makeLoader({
  loadFieldAcl: () => acl.promise,
  request: async () => { dataStarted = true; return [{ id: 'old' }] }
})
const initialLoad = parallel.loadData()
assert.equal(dataStarted, true)
await Promise.resolve()
assert.equal(parallel.gridData.value.length, 0)
acl.resolve()
await initialLoad
assert.equal(parallel.gridData.value[0].id, 'old')

// A confirmed insert is immediate, deduplicated, and keeps the next page aligned.
const firstPage = Array.from({ length: 50 }, (_, index) => ({ id: `old-${index}`, created_at: '2026-10-20T08:00:00Z' }))
const requests = []
const pages = makeLoader({ request: async request => {
  requests.push(request.url)
  return requests.length === 1 ? firstPage : [{ id: 'old-49' }, { id: 'next' }]
} })
await pages.loadData()
assert.equal(pages.hasMoreRows.value, true)
assert.equal(pages.prependRow({ id: 'new', amount: 20, created_at: '2026-10-21T08:00:00Z' }), true)
assert.equal(requests.length, 1, 'Confirmed insert needs no full reload')
assert.equal(pages.gridData.value[0].id, 'new')
assert.equal(pages.events.at(-1)[1].rawLoadedCount, 51)
assert.equal(pages.events.at(-1)[1].rows[0].amount, 20)
assert.equal(pages.prependRow({ id: 'new', amount: 21, created_at: '2026-10-21T08:00:00Z' }), true)
assert.equal(pages.gridData.value.filter(row => row.id === 'new').length, 1)
assert.equal(pages.prependRow({ id: 'old-10', created_at: '2026-10-22T08:00:00Z' }), false, 'an existing non-first row must reload')
await pages.loadNextPage()
assert.match(requests.at(-1), /offset=51(?:&|$)/)
assert.equal(pages.gridData.value.filter(row => row.id === 'old-49').length, 1)
assert.equal(pages.gridData.value.at(-1).id, 'next')

// Filtered/custom-sorted server queries keep their authoritative reload path.
for (const props of [
  { apiUrl: '/rows?status=eq.active' },
  { apiUrl: '/rows?limit=20' },
  { defaultOrder: 'name.asc' },
  { apiUrl: '/rows?order=name.asc' }
]) {
  const filtered = makeLoader({ props, request: async () => [{ id: 'old' }] })
  await filtered.loadData()
  assert.equal(filtered.prependRow({ id: 'new' }), false)
  assert.equal(filtered.gridData.value[0].id, 'old')
}
const searched = makeLoader({ request: async () => [{ id: 'old' }] })
await searched.loadData()
searched.searchText.value = 'needle'
assert.equal(searched.prependRow({ id: 'new' }), false)

const rowFiltered = makeLoader({ props: { rowFilter: row => row.active }, request: async () => [{ id: 'old', active: true, created_at: '2026-10-20T08:00:00Z' }] })
await rowFiltered.loadData()
assert.equal(rowFiltered.prependRow({ id: 'hidden', active: false, created_at: '2026-10-21T08:00:00Z' }), true)
assert.equal(rowFiltered.gridData.value.length, 1)
assert.equal(rowFiltered.events.at(-1)[1].rawLoadedCount, 2)

// Common category/status/date filters accept only matching server representations.
const category = makeLoader({ props: {
  apiUrl: '/rows?category=eq.fire&status=neq.deleted&entry_date=gte.2026-10-01&entry_date=lt.2026-11-01',
  staticColumns: [{ prop: 'entry_date', type: 'date' }]
}, request: async () => [{ id: 'old', category: 'fire', status: 'draft', entry_date: '2026-10-01', created_at: '2026-10-20T08:00:00Z' }] })
await category.loadData()
assert.equal(category.prependRow({ id: 'new', category: 'fire', status: 'draft', entry_date: '2026-10-21', created_at: '2026-10-21T08:00:00Z' }), true)
assert.equal(category.gridData.value[0].id, 'new')
assert.equal(category.prependRow({ id: 'outside', category: 'other', status: 'draft', entry_date: '2026-10-21' }), true)
assert.equal(category.gridData.value.some(row => row.id === 'outside'), false)
assert.equal(category.events.at(-1)[1].rawLoadedCount, 2)
assert.equal(category.prependRow({ id: 'new', category: 'other', status: 'draft', entry_date: '2026-10-21' }), false, 'an existing row that no longer matches the server filter must reload')
assert.equal(category.gridData.value.some(row => row.id === 'new'), true)
const complex = makeLoader({ props: { apiUrl: '/rows?or=(status.eq.draft,status.eq.active)' }, request: async () => [] })
await complex.loadData()
assert.equal(complex.prependRow({ id: 'new', status: 'draft' }), false)

// UUIDs are random: an explicit UUID id.desc requires the server's true page order.
const uuidOrder = makeLoader({ props: { defaultOrder: 'id.desc' }, request: async () => [{ id: 'f94b4204-13a1-4448-abee-d0845e439a21' }] })
await uuidOrder.loadData()
assert.equal(uuidOrder.prependRow({ id: '25461560-c395-4f61-a495-f95bbcbf364e' }), false)
const numericOrder = makeLoader({ props: { defaultOrder: 'id.desc' }, request: async () => [{ id: '100' }] })
await numericOrder.loadData()
assert.equal(numericOrder.prependRow({ id: '101' }), true)
assert.equal(numericOrder.prependRow({ id: '99' }), false)

const tiedCreatedAt = makeLoader({ request: async () => [{ id: '10', created_at: '2026-10-21T08:00:00Z' }] })
await tiedCreatedAt.loadData()
assert.equal(tiedCreatedAt.prependRow({ id: '11', created_at: '2026-10-21T08:00:00Z' }), true)
assert.equal(tiedCreatedAt.prependRow({ id: '9', created_at: '2026-10-21T08:00:00Z' }), false)

const subMillisecondOrder = makeLoader({ request: async () => [{ id: '100', created_at: '2026-10-21T08:00:00.123500Z' }] })
await subMillisecondOrder.loadData()
assert.equal(subMillisecondOrder.prependRow({ id: '99', created_at: '2026-10-21T08:00:00.123900Z' }), true)
assert.equal(subMillisecondOrder.prependRow({ id: '101', created_at: '2026-10-21T08:00:00.123100Z' }), false)
assert.equal(pages.prependRow({ id: 'historical', created_at: '2026-10-01T08:00:00Z' }), false)
assert.equal(paging.matchesSavedRowQuery({ name: null }, new URLSearchParams('name=is.null')), true)
assert.equal(paging.matchesSavedRowQuery({ name: undefined }, new URLSearchParams('name=is.null')), null)
assert.equal(paging.matchesSavedRowQuery({ name: null }, new URLSearchParams('name=neq.deleted')), false)
assert.equal(paging.matchesSavedRowQuery({ name: 'fire' }, new URLSearchParams('name=eq.%22fire%22')), null)
assert.equal(paging.matchesSavedRowQuery({ at: '2026-10-21T08:00:00' }, new URLSearchParams('at=gte.2026-10-01'), [{ prop: 'at', type: 'datetime' }]), null)

// Same-query reloads retain existing rows instead of clearing totals twice.
let reloadNumber = 0
const reload = deferred()
const stable = makeLoader({ request: () => ++reloadNumber === 1 ? Promise.resolve([{ id: 'old' }]) : reload.promise })
await stable.loadData()
const oldRows = stable.gridData.value
const pendingReload = stable.loadData()
assert.equal(stable.gridData.value, oldRows)
reload.reject(new Error('network unavailable'))
await pendingReload
assert.equal(stable.gridData.value, oldRows)
assert.equal(stable.isLoading.value, false)
assert.equal(stable.errors.length, 1)

// Superseding a page request must not leave further paging permanently blocked.
let requestNumber = 0
const oldPage = deferred()
const superseded = makeLoader({ request: () => {
  requestNumber += 1
  return requestNumber === 2 ? oldPage.promise : Promise.resolve(firstPage)
} })
await superseded.loadData()
const pendingPage = superseded.loadNextPage()
assert.equal(superseded.isLoadingMore.value, true)
await superseded.loadData()
assert.equal(superseded.isLoadingMore.value, false)
oldPage.resolve([{ id: 'stale' }])
await pendingPage
assert.equal(superseded.gridData.value.some(row => row.id === 'stale'), false)

console.log('PASS saved-row insertion, query/ACL boundaries, pagination, reload stability and stale-page recovery')

