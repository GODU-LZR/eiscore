<template>
  <div class="compact-filter">
    <el-popover
      placement="bottom-start"
      trigger="click"
      width="420"
      popper-class="app-grid-filter-popover"
    >
      <template #reference>
        <el-button type="primary" plain icon="Filter">
          筛选
        </el-button>
      </template>

      <div class="filter-panel">
        <div class="filter-section">
          <div class="filter-section-title">{{ timeFieldLabel || '日期' }}</div>
          <el-radio-group v-model="timeModeProxy" class="filter-radio-group">
            <el-radio-button
              v-for="option in timeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>

          <div v-if="timeMode !== 'infinite' && timeField" class="time-pager-control">
            <el-button
              v-if="timeMode !== 'custom'"
              size="small"
              plain
              @click="$emit('shift-period', -1)"
            >
              上一段
            </el-button>

            <el-date-picker
              v-if="timeMode === 'day'"
              v-model="dayProxy"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              placeholder="选择日期"
              :clearable="false"
              class="time-picker"
            />
            <el-date-picker
              v-else-if="timeMode === 'month'"
              v-model="monthProxy"
              type="month"
              value-format="YYYY-MM"
              format="YYYY-MM"
              placeholder="选择月份"
              :clearable="false"
              class="time-picker"
            />
            <el-date-picker
              v-else-if="timeMode === 'year'"
              v-model="yearProxy"
              type="year"
              value-format="YYYY"
              format="YYYY"
              placeholder="选择年份"
              :clearable="false"
              class="time-picker time-picker-year"
            />
            <el-date-picker
              v-else
              v-model="customRangeProxy"
              type="daterange"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              range-separator="至"
              class="time-range-picker"
            />

            <el-button
              v-if="timeMode !== 'custom'"
              size="small"
              plain
              @click="$emit('reset-period')"
            >
              当前
            </el-button>
            <el-button
              v-if="timeMode !== 'custom'"
              size="small"
              plain
              @click="$emit('shift-period', 1)"
            >
              下一段
            </el-button>
          </div>

          <div class="filter-scope-line">
            {{ timeField ? timeScopeLabel : '当前应用未识别到日期字段，保持全量滚动加载' }}
          </div>
        </div>

        <div v-if="attentionOptions.length" class="filter-section">
          <div class="filter-section-title">关注状态</div>
          <el-radio-group v-model="attentionFilterProxy" class="filter-radio-group">
            <el-radio-button
              v-for="option in attentionOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </el-popover>

    <el-tag
      class="filter-summary-tag"
      :type="hasActiveFilters ? 'primary' : 'info'"
      effect="plain"
    >
      {{ filterSummary }}
    </el-tag>

    <el-button
      v-if="hasActiveFilters"
      type="primary"
      link
      @click="$emit('reset-filters')"
    >
      重置
    </el-button>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed } from 'vue'

const props = defineProps({
  timeOptions: { type: Array, default: () => [] },
  timeMode: { type: String, default: 'infinite' },
  day: { type: String, default: '' },
  month: { type: String, default: '' },
  year: { type: String, default: '' },
  customRange: { type: Array, default: () => [] },
  timeField: { type: String, default: '' },
  timeFieldLabel: { type: String, default: '日期' },
  timeScopeLabel: { type: String, default: '全量滚动加载' },
  attentionFilter: { type: String, default: 'all' },
  attentionOptions: { type: Array, default: () => [] },
  filterSummary: { type: String, default: '当前：全量滚动加载' },
  hasActiveFilters: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update:timeMode',
  'update:day',
  'update:month',
  'update:year',
  'update:customRange',
  'update:attentionFilter',
  'shift-period',
  'reset-period',
  'reset-filters'
])

const timeModeProxy = computed({
  get: () => props.timeMode,
  set: (value) => emit('update:timeMode', value)
})
const dayProxy = computed({
  get: () => props.day,
  set: (value) => emit('update:day', value)
})
const monthProxy = computed({
  get: () => props.month,
  set: (value) => emit('update:month', value)
})
const yearProxy = computed({
  get: () => props.year,
  set: (value) => emit('update:year', value)
})
const customRangeProxy = computed({
  get: () => props.customRange,
  set: (value) => emit('update:customRange', value)
})
const attentionFilterProxy = computed({
  get: () => props.attentionFilter,
  set: (value) => emit('update:attentionFilter', value)
})
</script>

<style scoped>
.compact-filter {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.filter-summary-tag {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-section + .filter-section {
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.filter-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  white-space: nowrap;
}

.filter-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-radio-group :deep(.el-radio-button) {
  margin-right: 0;
}

.filter-radio-group :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  line-height: 1;
  border-left: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.time-pager-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.time-pager-control :deep(.el-button + .el-button) {
  margin-left: 0;
}

.time-picker {
  width: 152px;
}

.time-picker-year {
  width: 120px;
}

.time-range-picker {
  width: 100%;
}

.filter-scope-line {
  font-size: 12px;
  color: #909399;
}
</style>
