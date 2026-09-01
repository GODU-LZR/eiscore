// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const BUSINESS_RECORD_ROUTE_MAP = Object.freeze({
  'public.raw_materials': (id) => `/materials/material/detail/${encodeURIComponent(id)}?source=document-intake`,
  raw_materials: (id) => `/materials/material/detail/${encodeURIComponent(id)}?source=document-intake`,
  'scm.inventory_transactions': (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inventory_transactions: (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.v_inventory_transactions': (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_inventory_transactions: (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.inventory_batches': (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inventory_batches: (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.v_inventory_current': (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_inventory_current: (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.warehouses': (id) => `/materials/warehouses?recordId=${encodeURIComponent(id)}&source=document-intake`,
  warehouses: (id) => `/materials/warehouses?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.inventory_drafts': (id) => `/materials/inventory-draft/detail/${encodeURIComponent(id)}?source=document-intake`,
  inventory_drafts: (id) => `/materials/inventory-draft/detail/${encodeURIComponent(id)}?source=document-intake`,
  purchase_demands: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=demands&source=document-intake`,
  purchase_orders: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=orders&source=document-intake`,
  purchase_arrivals: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=arrivals&source=document-intake`,
  boms: (id) => `/production/app/bom_list?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_sales_bom_production_plan: (id) => `/production/app/plans?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_production_work_orders: (id) => `/production/app/work_orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_production_work_order_items: (id) => `/production/app/work_order_items?recordId=${encodeURIComponent(id)}&source=document-intake`,
  production_inspections: (id) => `/quality/app/production_inspections?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inspection_orders: (id) => `/quality/app/inspection_orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  sales_orders: (id) => `/sales/app/orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  sales_payments: (id) => `/sales/app/payments?recordId=${encodeURIComponent(id)}&source=document-intake`
})

export const buildDocumentIntakeOverviewItems = (overview = {}) => [
  { key: 'todayFileCount', label: '今日采集', value: formatDocumentIntakeInteger(overview.todayFileCount), action: 'assets-today' },
  { key: 'successfulImportCount', label: '成功入库', value: formatDocumentIntakeInteger(overview.successfulImportCount), action: 'entry-successful' },
  { key: 'lowConfidenceCount', label: '低置信度', value: formatDocumentIntakeInteger(overview.lowConfidenceCount), action: 'entry-low-confidence' },
  { key: 'unrecognizedCount', label: '未识别', value: formatDocumentIntakeInteger(overview.unrecognizedCount), action: 'assets-unrecognized' },
  { key: 'duplicateFileCount', label: '重复文件', value: formatDocumentIntakeInteger(overview.duplicateFileCount), action: 'assets-duplicate' },
  { key: 'failedCount', label: '失败', value: formatDocumentIntakeInteger(overview.failedCount), action: 'entry-failed' },
  { key: 'activeDeviceCount', label: '在线设备', value: formatDocumentIntakeInteger(overview.activeDeviceCount), action: 'devices-active' },
  { key: 'offlineDeviceCount', label: '离线设备', value: formatDocumentIntakeInteger(overview.offlineDeviceCount), action: 'devices-offline' }
]

export const planDocumentIntakeOverviewMetric = (item) => {
  const action = String(item?.action || '')
  if (!action) return null
  if (action.startsWith('assets-')) {
    return {
      target: 'assets',
      filterPatch: {
        today: true,
        ...(action === 'assets-duplicate' ? { duplicate: 'true' } : {}),
        ...(action === 'assets-unrecognized' ? { status: 'unrecognized' } : {})
      }
    }
  }
  if (action.startsWith('entry-')) {
    return {
      target: 'entryResults',
      filterPatch: {
        today: true,
        ...(action === 'entry-successful' ? { status: 'successful' } : {}),
        ...(action === 'entry-low-confidence' ? { lowConfidence: true } : {}),
        ...(action === 'entry-failed' ? { status: 'failed' } : {})
      }
    }
  }
  if (action.startsWith('devices-')) {
    return {
      target: 'devices',
      filterPatch: { status: action === 'devices-active' ? 'active' : 'offline' }
    }
  }
  return null
}

export const getDocumentIntakeBusinessRecordTableKey = (row) => {
  const schema = String(row?.targetSchema || '').trim()
  const table = String(row?.targetTable || '').trim()
  if (schema && table) return `${schema}.${table}`
  return table || schema
}

export const buildDocumentIntakeBusinessRecordUrl = (row) => {
  const serverUrl = String(row?.businessRecordUrl || row?.business_record_url || '').trim()
  if (serverUrl) return serverUrl
  const recordId = String(row?.targetRecordId || '').trim()
  if (!recordId) return ''
  if (row?.targetKind === 'data_app' && row?.targetAppId) {
    return `/apps/app/${encodeURIComponent(row.targetAppId)}/record/${encodeURIComponent(recordId)}?source=document-intake`
  }
  const key = getDocumentIntakeBusinessRecordTableKey(row)
  const routeBuilder = BUSINESS_RECORD_ROUTE_MAP[key] || BUSINESS_RECORD_ROUTE_MAP[key.replace(/^[^.]+\./, '')]
  return routeBuilder ? routeBuilder(recordId) : ''
}

export const formatDocumentIntakeCorrectionValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

export const getDocumentIntakeRecalculationStatusLabel = (status) => ({
  pending: '待重算',
  recalculating: '重算中',
  completed: '已重算',
  failed: '重算失败',
  skipped: '无需重算'
}[status] || status || '未触发重算')

export const formatDocumentIntakeBytes = (bytes) => {
  const value = Number(bytes || 0)
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export const formatDocumentIntakeInteger = (value) => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return Math.max(0, Math.floor(numeric)).toLocaleString('zh-CN')
}

export const getDocumentIntakeAssetStatusLabel = (status) => ({
  uploaded: '已上传',
  duplicate: '重复',
  queued: '排队中',
  parsing: '解析中',
  parsed: '已解析',
  classified: '已识别',
  importing: '入库中',
  imported: '已入库',
  partial_imported: '部分入库',
  unrecognized: '未识别',
  failed: '失败',
  archived: '已归档'
}[status] || status || '-')

export const getDocumentIntakeAssetStatusTagType = (status) => ({
  duplicate: 'warning',
  failed: 'danger',
  imported: 'success',
  partial_imported: 'warning',
  unrecognized: 'info'
}[status] || '')

export const getDocumentIntakeDeviceStatusLabel = (status) => ({
  pending: '待绑定',
  active: '在线',
  offline: '离线',
  disabled: '停用'
}[status] || status || '-')

export const getDocumentIntakeDeviceStatusTagType = (status) => ({
  active: 'success',
  offline: 'warning',
  disabled: 'danger',
  pending: 'info'
}[status] || '')

export const getDocumentIntakeLogLevelLabel = (level) => ({
  error: '错误',
  warn: '警告',
  warning: '警告',
  info: '信息',
  debug: '调试'
}[String(level || '').toLowerCase()] || level || '-')

export const getDocumentIntakeLogLevelTagType = (level) => ({
  error: 'danger',
  warn: 'warning',
  warning: 'warning',
  info: 'info',
  debug: ''
}[String(level || '').toLowerCase()] || '')

export const getDocumentIntakeEntryResultStatusLabel = (status) => ({
  planned: '计划中',
  importing: '入库中',
  imported: '已入库',
  partial: '部分入库',
  failed: '失败',
  skipped_duplicate: '重复跳过',
  archived_only: '仅归档'
}[status] || status || '-')

export const getDocumentIntakeEntryResultStatusTagType = (status) => ({
  imported: 'success',
  partial: 'warning',
  failed: 'danger',
  skipped_duplicate: 'warning',
  archived_only: 'info',
  planned: 'info'
}[status] || '')

export const getDocumentIntakeTargetKindLabel = (kind) => ({
  fixed_module_table: '固定模块',
  data_app: '动态应用'
}[kind] || kind || '未识别')

export const getDocumentIntakeTargetTableLabel = (row = {}) => {
  const schema = row.targetSchema || ''
  const table = row.targetTable || ''
  if (schema && table) return `${schema}.${table}`
  return table || schema || '-'
}

export const getDocumentIntakeLinkTargetTableLabel = (row = {}) => {
  const schema = row.targetSchema || ''
  const table = row.targetTable || ''
  if (schema && table) return `${schema}.${table}`
  return table || schema || row.targetDocumentType || '-'
}

export const getDocumentIntakeAssetTargetLabel = (row = {}) => (
  row.targetDocumentType || row.appName || row.targetModule || '-'
)

export const getDocumentIntakeAssetFileTypeLabel = (row = {}) => {
  const ext = String(row.fileExt || '').replace(/^\./, '').trim()
  if (ext) return ext.toUpperCase()
  const mime = String(row.mimeType || '').trim()
  if (!mime) return '-'
  const subtype = mime.includes('/') ? mime.split('/').pop() : mime
  return subtype ? subtype.toUpperCase() : mime
}

export const getDocumentIntakeAssetGeneratedCountLabel = (row = {}) => {
  const count = Number(row.generatedDocumentCount ?? row.businessLinkCount ?? row.documentCount ?? 0)
  return Number.isFinite(count) && count > 0 ? `${count} 条` : '-'
}

export const formatDocumentIntakeConfidence = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return `${Math.round(numeric * 100)}%`
}

export const getDocumentIntakeSourceLabel = (source) => ({
  web_drag_drop: '网页拖拽',
  manual_drag_drop: '桌面拖拽',
  manual_selected_file: '手动选择',
  watch_folder: '监听目录',
  collector_desktop: '采集端'
}[source] || source || '-')

export const getDocumentIntakeOperatorSourceLabel = (source) => ({
  web_login_user: '网页登录用户',
  device_default_user: '设备默认用户'
}[source] || source || '未记录来源')

export const getDocumentIntakeWatchFolderSourceLabel = (source) => ({
  local_settings: '本机设置',
  remote_config: '远程下发'
}[source] || source || '未记录目录来源')

export const getDocumentIntakeAssetSourceFolderLabel = (row = {}) => {
  if (!row.sourceFolder) return getDocumentIntakeWatchFolderSourceLabel(row.watchFolderSource)
  return `${row.sourceFolder} · ${getDocumentIntakeWatchFolderSourceLabel(row.watchFolderSource)}`
}

export const getDocumentIntakeLogSourceFolderLabel = (row = {}) => {
  if (!row.sourceFolder && !row.watchFolderSource) return '-'
  if (!row.sourceFolder) return getDocumentIntakeWatchFolderSourceLabel(row.watchFolderSource)
  return `${row.sourceFolder} · ${getDocumentIntakeWatchFolderSourceLabel(row.watchFolderSource)}`
}
