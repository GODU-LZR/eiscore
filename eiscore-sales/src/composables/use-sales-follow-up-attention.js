// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onUnmounted, ref, watch } from 'vue'
import { countStat, loadAppCardStats } from '@shared/app-card-server-stats'
import { buildSearchQuery } from '@/utils/grid-query'
import {
  buildSalesAttentionSummary,
  buildSalesFollowUpAttentionStats,
  buildSalesFollowUpAttentionSummary,
  matchesSalesAttentionFilter,
  offsetDateText,
  todayText
} from '@/utils/sales-attention'

export function useSalesFollowUpAttention({ app, apiUrl, attentionFilter, request, rows, searchText, staticColumns, extraColumns }) {
  const serverStats = ref(null)
  const currentDay = ref(todayText())
  const searchQuery = computed(() => buildSearchQuery(searchText.value, staticColumns.value, extraColumns.value))
  const topLevelAttention = computed(() => rows.value.some((row) => Object.prototype.hasOwnProperty.call(row || {}, 'attention_level')))
  const statsSpecs = computed(() => buildSalesFollowUpAttentionStats({
    today: currentDay.value,
    tomorrow: offsetDateText(1, `${currentDay.value}T12:00:00`),
    topLevelAttention: topLevelAttention.value
  }))
  const dataApiUrl = computed(() => {
    const filter = app.value?.key === 'follow_ups'
      ? statsSpecs.value.find(({ key }) => key === attentionFilter?.value)?.filter
      : ''
    return filter ? `${apiUrl.value}${apiUrl.value.includes('?') ? '&' : '?'}${filter}` : apiUrl.value
  })
  const scope = computed(() => JSON.stringify([app.value?.key, apiUrl.value, searchQuery.value, currentDay.value, topLevelAttention.value]))
  const localSummary = computed(() => buildSalesAttentionSummary(app.value?.key, rows.value))
  const activeStats = computed(() => serverStats.value?.scope === scope.value ? serverStats.value.stats : {})
  const summary = computed(() => app.value?.key === 'follow_ups'
    ? { ...localSummary.value, ...buildSalesFollowUpAttentionSummary(activeStats.value) }
    : localSummary.value)
  const todoCount = computed(() => app.value?.key === 'follow_ups'
    ? summary.value.todo
    : rows.value.filter((row) => matchesSalesAttentionFilter(app.value?.key, row, 'todo')).length)
  let sequence = 0
  let refreshTimer = null
  let lastLoadedScope = ''
  let pendingScope = ''

  const refresh = async () => {
    const currentSequence = ++sequence
    const currentScope = scope.value
    if (app.value?.key !== 'follow_ups') return
    const currentApp = app.value
    const currentApiUrl = apiUrl.value
    const currentSearchQuery = searchQuery.value
    const specs = statsSpecs.value
    pendingScope = currentScope
    serverStats.value = null
    let stats = {}
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const missing = specs.filter(({ key }) => !Number.isFinite(stats[key]))
      if (!missing.length) break
      try {
        stats = { ...stats, ...await loadAppCardStats({
          request: (config) => request({ ...config, timeout: 15000, silentError: true, suppressErrorMessage: true }),
          app: currentApp,
          apiUrl: currentApiUrl,
          profile: 'public',
          timeout: 15000,
          exactCountOnly: true,
          searchQuery: currentSearchQuery,
          stats: missing.map(({ key, filter }) => countStat(key, filter))
        }) }
      } catch {
        // An unavailable count stays unknown; the loaded page is not a full count.
      }
      if (currentSequence !== sequence || currentScope !== scope.value) return
      serverStats.value = { scope: currentScope, stats }
    }
    if (currentSequence === sequence) pendingScope = ''
  }
  const scheduleRefresh = (delay = 0) => {
    currentDay.value = todayText()
    if (refreshTimer !== null) clearTimeout(refreshTimer)
    sequence += 1
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void refresh()
    }, delay)
  }
  const handleDataLoaded = (payload) => {
    if (payload?.append) return
    const currentScope = scope.value
    const alreadyRequested = pendingScope === currentScope || serverStats.value?.scope === currentScope
    if (lastLoadedScope === currentScope || !alreadyRequested) scheduleRefresh()
    lastLoadedScope = currentScope
  }
  watch(scope, () => scheduleRefresh(), { immediate: true })
  onUnmounted(() => {
    sequence += 1
    if (refreshTimer !== null) clearTimeout(refreshTimer)
  })
  return { summary, todoCount, dataApiUrl, refresh: scheduleRefresh, handleDataLoaded }
}
