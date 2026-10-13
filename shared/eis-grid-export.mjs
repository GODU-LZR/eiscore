// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export function formatSelectLabel(value, options = []) {
  if (value === null || value === undefined || value === '') return ''
  const target = String(value)
  for (const option of options) {
    const label = option?.label === null || option?.label === undefined || option?.label === ''
      ? String(option?.value ?? '')
      : String(option.label)
    const optionValue = option?.value === null || option?.value === undefined || option?.value === ''
      ? label
      : String(option.value)
    if (optionValue === target) return label
  }
  return value
}

export function formatStatusLabel(value) {
  if (value === null || value === undefined || value === '') return ''
  const labels = {
    created: '创建',
    active: '生效',
    locked: '锁定',
    disabled: '停用'
  }
  return labels[String(value).toLowerCase()] || value
}

function safeFileNamePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function resolveSystemName() {
  const config = globalThis?.__EISCORE_ENTERPRISE_CONFIG__
  const configured = config?.enterprise?.displayName || config?.branding?.productName
  if (configured) return safeFileNamePart(configured)
  if (typeof document !== 'undefined' && document.title) return safeFileNamePart(document.title)
  return ''
}

export function exportGridCsv(api, { appName = '' } = {}) {
  if (!api) return
  const columnKeys = api.getAllDisplayedColumns().filter(column => {
    const definition = column.getColDef()
    const fields = [definition.field, column.getColId()]
    return definition.context?.suppressCsvExport !== true &&
      !fields.some(field => String(field ?? '').split('.').at(-1).toLowerCase() === 'password')
  })
  // AG Grid treats an empty columnKeys array as "all columns".
  if (!columnKeys.length) return
  const systemName = resolveSystemName()
  const tableName = safeFileNamePart(appName)
  const fileName = systemName && tableName
    ? `${systemName}-${tableName}.csv`
    : (tableName ? `${tableName}.csv` : '导出数据.csv')
  api.exportDataAsCsv({ fileName, columnKeys })
}
