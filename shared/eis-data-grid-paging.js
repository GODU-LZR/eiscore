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
    await loadFieldAcl()
    if (seq !== loadSeq) return
    resetLoadedRows()
    const url = buildDataUrl(0, canPageCurrentUrl.value)
    if (!url) {
      emitDataLoaded(false)
      return
    }

    isLoading.value = true
    try {
      const usePaging = canPageCurrentUrl.value
      const res = await request({
        url,
        method: 'get',
        headers: buildRequestHeaders()
      })
      if (seq !== loadSeq) return
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
    loadNextPage
  }
}
