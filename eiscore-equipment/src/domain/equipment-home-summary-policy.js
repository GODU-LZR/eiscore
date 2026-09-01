// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  formatEquipmentNumber,
  toEquipmentNumber
} from './equipment-home-presentation-policy.js'

export const buildEquipmentCockpitSummary = ({
  assets = [],
  checks = [],
  issues = [],
  workOrders = [],
  plans = [],
  standards = [],
  daysUntil = () => null
} = {}) => {
  const totalHealthScore = assets.reduce((sum, row) => sum + toEquipmentNumber(row.health_score), 0)
  const totalPlanCompletion = plans.reduce((sum, row) => sum + toEquipmentNumber(row.completion_rate), 0)

  return {
    assetCount: assets.length,
    checkCount: checks.length,
    issueCount: issues.length,
    runningCount: assets.filter((row) => row.run_status === '运行').length,
    downCount: assets.filter((row) => ['停机', '维修中'].includes(row.run_status)).length,
    avgHealthScore: assets.length ? Math.round(totalHealthScore / assets.length) : 0,
    abnormalCheckCount: checks.filter((row) => row.check_result === '异常' || row.check_result === '停机').length,
    openIssueCount: issues.filter((row) => row.issue_status !== '已关闭').length,
    urgentIssueCount: issues.filter((row) => row.issue_level === '紧急' || row.issue_level === '严重').length,
    activeWorkOrderCount: workOrders.filter((row) => row.work_status !== '已完成').length,
    completedWorkOrderCount: workOrders.filter((row) => row.work_status === '已完成').length,
    totalDowntimeHours: workOrders.reduce((sum, row) => sum + toEquipmentNumber(row.downtime_hours), 0),
    overduePlanCount: plans.filter((row) => {
      if (row.plan_status === '已完成') return false
      const delta = daysUntil(row.next_execute_date)
      return delta !== null && delta < 0
    }).length,
    effectiveStandardCount: standards.filter((row) => row.standard_status === '生效').length,
    avgPlanCompletion: plans.length ? Math.round(totalPlanCompletion / plans.length) : 0
  }
}

export const calculateEquipmentRiskIndex = (summary = {}) => Math.min(99,
  toEquipmentNumber(summary.downCount) * 16 +
  toEquipmentNumber(summary.openIssueCount) * 12 +
  toEquipmentNumber(summary.urgentIssueCount) * 10 +
  toEquipmentNumber(summary.activeWorkOrderCount) * 8 +
  toEquipmentNumber(summary.overduePlanCount) * 14 +
  toEquipmentNumber(summary.abnormalCheckCount) * 6
)

export const buildEquipmentKpiRows = ({ summary = {}, colors = {} } = {}) => ([
  {
    label: '设备健康评分',
    value: summary.avgHealthScore,
    sub: `${summary.assetCount} 台设备`,
    color: summary.avgHealthScore < 80 ? colors.amber : colors.green,
    appKey: 'assets'
  },
  {
    label: '异常点检',
    value: summary.abnormalCheckCount,
    sub: `${summary.checkCount} 张点检单`,
    color: summary.abnormalCheckCount ? colors.amber : colors.green,
    appKey: 'checks'
  },
  {
    label: '未关闭异常',
    value: summary.openIssueCount,
    sub: `紧急/严重 ${summary.urgentIssueCount}`,
    color: summary.openIssueCount ? colors.red : colors.green,
    appKey: 'issues'
  },
  {
    label: '处理中工单',
    value: summary.activeWorkOrderCount,
    sub: `${formatEquipmentNumber(summary.totalDowntimeHours)}h 停机`,
    color: summary.activeWorkOrderCount ? colors.cyan : colors.green,
    appKey: 'work_orders'
  }
])

export const buildEquipmentFlowNodes = (summary = {}) => ([
  { label: '设备台账', value: summary.assetCount, appKey: 'assets' },
  { label: '异常点检', value: summary.abnormalCheckCount, appKey: 'checks' },
  { label: '异常单', value: summary.issueCount, appKey: 'issues' },
  { label: '维保中', value: summary.activeWorkOrderCount, appKey: 'work_orders' },
  { label: '已完成', value: summary.completedWorkOrderCount, appKey: 'work_orders' }
])

export const buildEquipmentWorkSummaryRows = (summary = {}) => ([
  { label: '处理中', value: summary.activeWorkOrderCount, appKey: 'work_orders' },
  { label: '停机小时', value: formatEquipmentNumber(summary.totalDowntimeHours), appKey: 'work_orders' },
  { label: '计划完成', value: `${summary.avgPlanCompletion}%`, appKey: 'plans' },
  { label: '标准生效', value: summary.effectiveStandardCount, appKey: 'standards' }
])
