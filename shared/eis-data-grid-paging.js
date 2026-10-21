// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref } from 'vue'

export const DEFAULT_GRID_PAGE_SIZE = 200
export const DEFAULT_GRID_MAX_CLIENT_ROWS = 5000

export function normalizePageSize(value, fallback = DEFAULT_GRID_PAGE_SIZE) {
  const num = Number(value)
  const fallbackNum = Number(fallback)
  const safeFallback = Number.isFinite(fallbackNum) && fallbackNum > 0 ? fallbackNum : DEFAULT_GRID_PAGE_SIZE
  if (!Number.isFinite(num) || num <= 0) return Math.max(50, Math.min(1000, Math.floor(safeFallback)))
  return Math.max(50, Math.min(1000, Math.floor(num)))
}

export function normalizeMaxClientRows(value, fallback = DEFAULT_GRID_MAX_CLIENT_ROWS) {
  const num = Number(value)
  const fallbackNum = Number(fallback)
  const safeFallback = Number.isFinite(fallbackNum) && fallbackNum > 0 ? fallbackNum : DEFAULT_GRID_MAX_CLIENT_ROWS
  if (!Number.isFinite(num) || num <= 0) return Math.max(1000, Math.floor(safeFallback))
  return Math.max(1000, Math.floor(num))
}

export function hasExplicitPaging(url) {
  const text = String(url || '').split('#')[0]
  return /(?:[?&])(limit|offset)=/i.test(text)
}

export function appendQuery(url, paramText) {
  if (!paramText) return url
  const cleanParam = String(paramText).replace(/^[?&]+/, '')
  if (!cleanParam) return url
  const text = String(url || '')
  const hashIndex = text.indexOf('#')
  const base = hashIndex >= 0 ? text.slice(0, hashIndex) : text
  const hash = hashIndex >= 0 ? text.slice(hashIndex) : ''
  return `${base}${base.includes('?') ? '&' : '?'}${cleanParam}${hash}`
}

export function buildPagedUrl({
  baseUrl,
  defaultOrder,
  searchText,
  staticColumns,
  extraColumns,
  buildSearchQuery,
  limit,
  offset,
  enablePaging
}) {
  let url = String(baseUrl || '').trim()
  if (!url) return ''

  if (defaultOrder && !/(?:[?&])order=/i.test(String(url || '').split('#')[0])) {
    url = appendQuery(url, `order=${defaultOrder}`)
  }

  if (searchText && typeof buildSearchQuery === 'function') {
    url = appendQuery(url, buildSearchQuery(searchText, staticColumns, extraColumns))
  }

  if (enablePaging && !hasExplicitPaging(url)) {
    const safeLimit = normalizePageSize(limit, DEFAULT_GRID_PAGE_SIZE)
    const safeOffset = Math.max(0, Math.floor(Number(offset) || 0))
    url = appendQuery(url, `limit=${safeLimit}&offset=${safeOffset}`)
  }

  return url
}

export function filterVisibleRows(rows, rowFilter) {
  if (!Array.isArray(rows)) return []
  if (typeof rowFilter !== 'function') return rows
  return rows.filter((row) => {
    try {
      return rowFilter(row)
    } catch (e) {
      return true
    }
  })
}

export function mergeRowsById(currentRows, incomingRows) {
  const current = Array.isArray(currentRows) ? currentRows : []
  const incoming = Array.isArray(incomingRows) ? incomingRows : []
  if (!incoming.length) return current

  const next = [...current]
  const indexById = new Map()
  next.forEach((row, index) => {
    if (row?.id !== undefined && row?.id !== null) {
      indexById.set(String(row.id), index)
    }
  })

  incoming.forEach((row) => {
    if (row?.id !== undefined && row?.id !== null) {
      const key = String(row.id)
      if (indexById.has(key)) {
        next[indexById.get(key)] = row
        return
      }
      indexById.set(key, next.length)
    }
    next.push(row)
  })

  return next
}

export function matchesSavedRowQuery(row, query, columns = []) {
  for (const [field, filter] of query) {
    if (['select', 'order'].includes(field)) continue
    if (!/^[a-zA-Z_][\w]*$/.test(field) || !Object.prototype.hasOwnProperty.call(row, field)) return null
    const separator = filter.indexOf('.')
    const operator = filter.slice(0, separator)
    const expected = filter.slice(separator + 1)
    const value = row[field]
    if (value === undefined) return null
    if (operator === 'is' && ['null', 'true', 'false'].includes(expected)) {
      const target = expected === 'null' ? null : expected === 'true'
      if (value !== target) return false
      continue
    }
    if (!['eq', 'neq', 'gte', 'lte', 'gt', 'lt'].includes(operator) || /["\\]/.test(expected)) return null
    if (value === null) return false
    if (typeof value === 'object') return null
    const type = columns.find(column => column?.prop === field)?.type
    let left = value
    let right = expected
    if (typeof value === 'number' || ['number', 'decimal', 'currency', 'percent'].includes(type)) {
      left = Number(value)
      right = Number(expected)
      if (!Number.isFinite(left) || !Number.isFinite(right)) return null
    } else if (['date', 'datetime'].includes(type)) {
      const pattern = type === 'date'
        ? /^\d{4}-\d{2}-\d{2}$/
        : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i
      if (!pattern.test(String(value)) || !pattern.test(expected)) return null
      left = Date.parse(value)
      right = Date.parse(expected)
      if (!Number.isFinite(left) || !Number.isFinite(right)) return null
    } else if (typeof value === 'boolean') {
      if (!['true', 'false'].includes(expected)) return null
      right = expected === 'true'
    } else {
      if (!['eq', 'neq'].includes(operator)) return null
      left = String(value)
    }
    const matches = operator === 'eq' ? left === right
      : operator === 'neq' ? left !== right
        : operator === 'gte' ? left >= right
          : operator === 'lte' ? left <= right
            : operator === 'gt' ? left > right : left < right
    if (!matches) return false
  }
  return true
}

export function createPagedGridLoader({
  props,
  gridData,
  searchText,
  isLoading,
  gridApi,
  eventEmitter,
  loadFieldAcl,
  request,
  buildSearchQuery,
  ElMessage,
  defaultProfile = 'hr'
}) {
  const isLoadingMore = ref(false)
  const hasMoreRows = ref(false)
  const pageOffset = ref(0)
  const lastRawRows = ref([])
  const pageSize = computed(() => normalizePageSize(props.pageSize, DEFAULT_GRID_PAGE_SIZE))
  const maxClientRows = computed(() => normalizeMaxClientRows(props.maxClientRows, DEFAULT_GRID_MAX_CLIENT_ROWS))
  const minInitialRows = computed(() => Math.min(100, pageSize.value))
  const canPageCurrentUrl = computed(() => !!props.enableInfiniteScroll && !!props.apiUrl && !hasExplicitPaging(props.apiUrl))
  let loadSeq = 0
  let loadedQueryKey = ''

  const buildDataUrl = (offset = 0, usePaging = canPageCurrentUrl.value) => buildPagedUrl({
    baseUrl: props.apiUrl,
    defaultOrder: props.defaultOrder,
    searchText: searchText.value,
    staticColumns: props.staticColumns,
    extraColumns: props.extraColumns,
    buildSearchQuery,
    limit: pageSize.value,
    offset,
    enablePaging: usePaging
  })

  const buildRequestHeaders = () => {
    const acceptProfile = props.acceptProfile || props.profile || defaultProfile
    const contentProfile = props.contentProfile || props.profile || acceptProfile || defaultProfile
    return {
      'Accept-Profile': acceptProfile,
      'Content-Profile': contentProfile
    }
  }

  const getQueryKey = () => JSON.stringify([buildDataUrl(0), buildRequestHeaders()])

  const emitDataLoaded = (append = false) => {
    if (!eventEmitter) return
    eventEmitter('data-loaded', {
      rows: gridData.value,
      rawRows: lastRawRows.value,
      searchText: searchText.value || '',
      append,
      loadedCount: gridData.value.length,
      rawLoadedCount: lastRawRows.value.length,
      hasMore: hasMoreRows.value,
      pageSize: pageSize.value,
      maxClientRows: maxClientRows.value
    })
  }

  const scheduleInitialAutoSize = () => {
    if (props.autoSizeColumns === false) return
    setTimeout(() => {
      if (gridApi.value) {
        const cols = gridApi.value.getAllGridColumns?.() || gridApi.value.getColumns?.() || []
        if (cols.length) {
          const allColIds = cols.map(c => c.getColId())
          gridApi.value.autoSizeColumns(allColIds, false)
        }
      }
    }, 100)
  }

  const resetLoadedRows = () => {
    hasMoreRows.value = false
    pageOffset.value = 0
    lastRawRows.value = []
    gridData.value = []
  }

  const loadData = async () => {
    const seq = ++loadSeq
    const queryKey = getQueryKey()
    isLoading.value = true
    isLoadingMore.value = false
    if (queryKey !== loadedQueryKey) resetLoadedRows()
    try {
      const url = buildDataUrl(0, canPageCurrentUrl.value)
      const [, res] = await Promise.all([
        loadFieldAcl(),
        url ? request({ url, method: 'get', headers: buildRequestHeaders() }) : Promise.resolve([])
      ])
      if (seq !== loadSeq) return
      if (!url) {
        resetLoadedRows()
        loadedQueryKey = queryKey
        emitDataLoaded(false)
        return
      }

      const usePaging = canPageCurrentUrl.value
      const rows = Array.isArray(res) ? res : []
      const visibleRows = filterVisibleRows(rows, props.rowFilter)
      gridData.value = visibleRows
      lastRawRows.value = rows
      pageOffset.value = rows.length
      hasMoreRows.value = usePaging && rows.length >= pageSize.value && gridData.value.length < maxClientRows.value

      let fillAttempts = 0
      while (
        hasMoreRows.value &&
        gridData.value.length < minInitialRows.value &&
        fillAttempts < 4
      ) {
        fillAttempts += 1
        const nextRes = await request({
          url: buildDataUrl(pageOffset.value, true),
          method: 'get',
          headers: buildRequestHeaders()
        })
        if (seq !== loadSeq) return
        const nextRows = Array.isArray(nextRes) ? nextRes : []
        const nextVisibleRows = filterVisibleRows(nextRows, props.rowFilter)
        lastRawRows.value = mergeRowsById(lastRawRows.value, nextRows)
        gridData.value = mergeRowsById(gridData.value, nextVisibleRows)
        pageOffset.value += nextRows.length
        hasMoreRows.value = nextRows.length >= pageSize.value && gridData.value.length < maxClientRows.value
      }

      loadedQueryKey = queryKey
      emitDataLoaded(false)
      scheduleInitialAutoSize()
    } catch (e) {
      if (seq !== loadSeq) return
      const detail = e?.response?.data?.message || e?.response?.data?.details || e?.message
      ElMessage.error(detail ? `数据加载失败：${detail}` : '数据加载失败')
      if (eventEmitter) eventEmitter('data-load-error', e)
    } finally {
      if (seq === loadSeq) isLoading.value = false
    }
  }

  const prependRow = (row) => {
    if (!row || typeof row !== 'object' || row.id === undefined || row.id === null) return false
    if (isLoading.value || isLoadingMore.value || !loadedQueryKey || loadedQueryKey !== getQueryKey()) return false
    if (String(searchText.value || '').trim() || hasExplicitPaging(props.apiUrl)) return false

    const query = new URLSearchParams(String(props.apiUrl || '').split('?')[1]?.split('#')[0] || '')
    const matchesQuery = matchesSavedRowQuery(row, query, props.staticColumns)
    if (matchesQuery === null) return false
    if (!matchesQuery) return true
    const order = query.get('order') || props.defaultOrder || ''
    if (!/^(?:id\.desc|created_at\.desc(?:\.nullslast)?(?:,id\.desc)?)$/i.test(order)) return false

    const key = String(row.id)
    const existed = lastRawRows.value.some(item => String(item?.id) === key)
    const first = lastRawRows.value[0]
    if (order.toLowerCase() === 'id.desc') {
      const isIntegerId = value => typeof value === 'number'
        ? Number.isSafeInteger(value)
        : typeof value === 'string' && /^-?(?:0|[1-9]\d*)$/.test(value)
      if (!isIntegerId(row.id) || (first && !isIntegerId(first.id))) return false
      if (!existed && first && BigInt(row.id) < BigInt(first.id)) return false
    } else if (!existed && first) {
      const createdAt = Date.parse(row.created_at)
      const firstCreatedAt = Date.parse(first.created_at)
      if (!Number.isFinite(createdAt) || !Number.isFinite(firstCreatedAt) || createdAt <= firstCreatedAt) return false
    }
    const rawRows = [row, ...lastRawRows.value.filter(item => String(item?.id) !== key)]
    lastRawRows.value = rawRows
    gridData.value = [
      ...filterVisibleRows([row], props.rowFilter),
      ...gridData.value.filter(item => String(item?.id) !== key)
    ]
    if (!existed) pageOffset.value += 1
    emitDataLoaded(false)
    return true
  }

  const loadNextPage = async () => {
    if (!canPageCurrentUrl.value || !hasMoreRows.value || isLoading.value || isLoadingMore.value) return
    if (gridData.value.length >= maxClientRows.value) {
      hasMoreRows.value = false
      return
    }

    const seq = loadSeq
    isLoadingMore.value = true
    try {
      const res = await request({
        url: buildDataUrl(pageOffset.value, true),
        method: 'get',
        headers: buildRequestHeaders()
      })
      if (seq !== loadSeq) return
      const rows = Array.isArray(res) ? res : []
      const visibleRows = filterVisibleRows(rows, props.rowFilter)
      lastRawRows.value = mergeRowsById(lastRawRows.value, rows)
      gridData.value = mergeRowsById(gridData.value, visibleRows)
      pageOffset.value += rows.length
      hasMoreRows.value = rows.length >= pageSize.value && gridData.value.length < maxClientRows.value
      emitDataLoaded(true)
    } catch (e) {
      const detail = e?.response?.data?.message || e?.response?.data?.details || e?.message
      ElMessage.error(detail ? `继续加载失败：${detail}` : '继续加载失败')
      if (eventEmitter) eventEmitter('data-load-error', e)
    } finally {
      if (seq === loadSeq) isLoadingMore.value = false
    }
  }

  return {
    isLoadingMore,
    hasMoreRows,
    loadData,
    loadNextPage,
    prependRow
  }
}
