// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref } from 'vue'
import {
  GRID_TIME_MODE_OPTIONS,
  addDays,
  addMonths,
  addYears,
  buildGridTimeApiUrl,
  buildGridTimeRange,
  buildGridTimeScopeLabel,
  formatDate,
  formatMonth,
  formatYear,
  parseLocalDate,
  resolveGridTimeField
} from './eis-grid-time-filter'

export function useEisGridAppFilters({
  app,
  staticColumns,
  moduleName,
  fallbackApiUrl = '',
  attentionFilter = null,
  attentionFilterOptions = null
}) {
  const getNow = () => new Date()
  const now = getNow()
  const gridTimeMode = ref('infinite')
  const gridDay = ref(formatDate(now))
  const gridMonth = ref(formatMonth(now))
  const gridYear = ref(formatYear(now))
  const gridCustomRange = ref([
    formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    formatDate(now)
  ])

  const gridTimeField = computed(() => resolveGridTimeField(app.value, staticColumns.value))
  const gridTimeFieldLabel = computed(() => {
    const col = (staticColumns.value || []).find((item) => item.prop === gridTimeField.value)
    return col?.label || '日期'
  })
  const gridTimeRange = computed(() => buildGridTimeRange({
    mode: gridTimeMode.value,
    day: gridDay.value,
    month: gridMonth.value,
    year: gridYear.value,
    customRange: gridCustomRange.value,
    today: getNow()
  }))
  const gridTimeScopeLabel = computed(() => {
    if (!gridTimeField.value) return '当前应用未识别到日期字段，保持全量滚动加载'
    return buildGridTimeScopeLabel({
      mode: gridTimeMode.value,
      day: gridDay.value,
      month: gridMonth.value,
      year: gridYear.value,
      customRange: gridCustomRange.value,
      fieldLabel: gridTimeFieldLabel.value
    })
  })
  const gridBaseApiUrl = computed(() => app.value?.apiUrl || fallbackApiUrl)
  const gridApiUrl = computed(() => buildGridTimeApiUrl(
    gridBaseApiUrl.value,
    gridTimeField.value,
    gridTimeMode.value === 'infinite' ? null : gridTimeRange.value
  ))
  const gridLocalLayoutKey = computed(() => {
    const viewId = app.value?.viewId || app.value?.configKey || app.value?.key || ''
    return viewId && moduleName ? `${moduleName}:${viewId}:app-grid` : ''
  })

  const activeAttentionFilterLabel = computed(() => {
    if (!attentionFilter || !attentionFilterOptions) return '全部'
    return attentionFilterOptions.value?.find((option) => option.value === attentionFilter.value)?.label || '全部'
  })
  const hasActiveGridFilters = computed(() => {
    const hasAttention = attentionFilter ? attentionFilter.value !== 'all' : false
    return gridTimeMode.value !== 'infinite' || hasAttention
  })
  const gridFilterSummary = computed(() => {
    const parts = []
    if (gridTimeMode.value !== 'infinite') {
      parts.push(gridTimeField.value ? gridTimeScopeLabel.value : '日期字段未识别')
    }
    if (attentionFilter && attentionFilter.value !== 'all') {
      parts.push(`关注：${activeAttentionFilterLabel.value}`)
    }
    return parts.length ? parts.join(' / ') : '当前：全量滚动加载'
  })

  const resetGridPeriod = () => {
    const current = getNow()
    gridDay.value = formatDate(current)
    gridMonth.value = formatMonth(current)
    gridYear.value = formatYear(current)
  }

  const resetGridTimeFilters = () => {
    const current = getNow()
    gridTimeMode.value = 'infinite'
    gridDay.value = formatDate(current)
    gridMonth.value = formatMonth(current)
    gridYear.value = formatYear(current)
    gridCustomRange.value = [
      formatDate(new Date(current.getFullYear(), current.getMonth(), 1)),
      formatDate(current)
    ]
  }

  const resetGridFilters = () => {
    resetGridTimeFilters()
    if (attentionFilter) attentionFilter.value = 'all'
  }

  const shiftGridPeriod = (step) => {
    if (gridTimeMode.value === 'day') {
      gridDay.value = formatDate(addDays(parseLocalDate(gridDay.value, getNow()), step))
      return
    }
    if (gridTimeMode.value === 'month') {
      const base = parseLocalDate(`${gridMonth.value || formatMonth(getNow())}-01`, getNow())
      gridMonth.value = formatMonth(addMonths(base, step))
      return
    }
    if (gridTimeMode.value === 'year') {
      const base = parseLocalDate(`${gridYear.value || formatYear(getNow())}-01-01`, getNow())
      gridYear.value = formatYear(addYears(base, step))
    }
  }

  return {
    gridTimeModeOptions: GRID_TIME_MODE_OPTIONS,
    gridTimeMode,
    gridDay,
    gridMonth,
    gridYear,
    gridCustomRange,
    gridTimeField,
    gridTimeFieldLabel,
    gridTimeRange,
    gridTimeScopeLabel,
    gridBaseApiUrl,
    gridApiUrl,
    gridLocalLayoutKey,
    activeAttentionFilterLabel,
    hasActiveGridFilters,
    gridFilterSummary,
    resetGridPeriod,
    resetGridTimeFilters,
    resetGridFilters,
    shiftGridPeriod
  }
}
