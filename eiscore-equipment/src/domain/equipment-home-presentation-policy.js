// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const toEquipmentNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export const formatEquipmentNumber = (value) => {
  const num = toEquipmentNumber(value)
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

export const calculateEquipmentPercent = (value, total) => {
  const base = toEquipmentNumber(total)
  if (base <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((toEquipmentNumber(value) / base) * 100)))
}

export const countEquipmentRowsBy = (rows = [], key, fallback = '未分类') => {
  const map = new Map()
  rows.forEach((row) => {
    const label = row?.[key] || fallback
    map.set(label, (map.get(label) || 0) + 1)
  })
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }))
}

export const buildEquipmentStatusRows = ({ assets = [], colors = {} } = {}) => {
  const palette = {
    运行: colors.green,
    停机: colors.red,
    维修中: colors.amber,
    待验收: colors.cyan,
    报废: colors.violet
  }
  const counts = countEquipmentRowsBy(assets, 'run_status')
  return ['运行', '停机', '维修中', '待验收', '报废'].map((label) => ({
    label,
    value: counts.find((item) => item.label === label)?.value || 0,
    color: palette[label]
  }))
}

export const buildEquipmentAssetTypeRows = ({ assets = [], colors = {} } = {}) => {
  const rows = countEquipmentRowsBy(assets, 'asset_type')
  const maxValue = Math.max(...rows.map((item) => item.value), 1)
  const palette = [colors.primary, colors.green, colors.cyan, colors.amber, colors.violet]
  return rows
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({
      ...item,
      pct: calculateEquipmentPercent(item.value, maxValue),
      color: palette[index % palette.length]
    }))
}

export const buildEquipmentHealthRiskRows = (assets = []) => assets
  .slice()
  .sort((a, b) => {
    const aDown = ['停机', '维修中'].includes(a.run_status) ? 0 : 1
    const bDown = ['停机', '维修中'].includes(b.run_status) ? 0 : 1
    if (aDown !== bDown) return aDown - bDown
    return toEquipmentNumber(a.health_score) - toEquipmentNumber(b.health_score)
  })
  .slice(0, 6)

export const buildEquipmentPlanProgressRows = (plans = []) => plans
  .slice()
  .sort((a, b) => {
    const aDone = a.plan_status === '已完成'
    const bDone = b.plan_status === '已完成'
    if (aDone !== bDone) return aDone ? 1 : -1
    return toEquipmentNumber(a.completion_rate) - toEquipmentNumber(b.completion_rate)
  })
  .map((row) => ({
    ...row,
    progress: Math.max(0, Math.min(100, Math.round(toEquipmentNumber(row.completion_rate))))
  }))
  .slice(0, 5)

export const buildEquipmentStandardCoverageRows = ({ assets = [], standards = [] } = {}) => {
  const assetTypes = countEquipmentRowsBy(assets, 'asset_type')
  const effectiveTypes = new Set(standards
    .filter((row) => row.standard_status === '生效')
    .map((row) => row.asset_type || '未分类'))
  if (assetTypes.length > 0) {
    return assetTypes
      .map((item) => {
        const effective = effectiveTypes.has(item.label) ? item.value : 0
        return {
          label: item.label,
          total: item.value,
          effective,
          pct: calculateEquipmentPercent(effective, item.value)
        }
      })
      .sort((a, b) => a.pct - b.pct || b.total - a.total)
  }
  const standardTypes = countEquipmentRowsBy(standards, 'asset_type')
  return standardTypes
    .map((item) => {
      const effective = standards.filter((row) => (row.asset_type || '未分类') === item.label && row.standard_status === '生效').length
      return {
        label: item.label,
        total: item.value,
        effective,
        pct: calculateEquipmentPercent(effective, item.value)
      }
    })
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
}

export const buildEquipmentVisibleWorkOrders = (workOrders = []) => workOrders
  .slice()
  .sort((a, b) => {
    const aActive = a.work_status !== '已完成'
    const bActive = b.work_status !== '已完成'
    if (aActive !== bActive) return aActive ? -1 : 1
    return String(a.plan_date || '').localeCompare(String(b.plan_date || ''))
  })
  .slice(0, 5)

export const buildEquipmentIssueLevelRows = (issues = []) => ([
  {
    label: '紧急',
    value: issues.filter((row) => row.issue_status !== '已关闭' && row.issue_level === '紧急').length,
    level: 'danger'
  },
  {
    label: '严重',
    value: issues.filter((row) => row.issue_status !== '已关闭' && row.issue_level === '严重').length,
    level: 'warn'
  },
  {
    label: '一般',
    value: issues.filter((row) => row.issue_status !== '已关闭' && !['紧急', '严重'].includes(row.issue_level)).length,
    level: 'info'
  }
])

export const resolveEquipmentStatusTone = (status) => {
  if (['正常', '运行', '已完成', '已关闭', '生效'].includes(status)) return 'ok'
  if (['停机', '异常', '紧急', '严重', '报废'].includes(status)) return 'danger'
  if (['待处理', '处理中', '待验收', '维修中', '执行中', '计划中'].includes(status)) return 'warn'
  return 'info'
}
