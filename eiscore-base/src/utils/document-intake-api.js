// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getAuthHeader } from './auth.js'

export const DOCUMENT_INTAKE_ASSETS_ENDPOINT = '/agent/document-intake/admin/assets'
export const DOCUMENT_INTAKE_DEVICES_ENDPOINT = '/agent/document-intake/admin/devices'
export const DOCUMENT_INTAKE_LOGS_ENDPOINT = '/agent/document-intake/admin/logs'
export const DOCUMENT_INTAKE_ENTRY_RESULTS_ENDPOINT = '/agent/document-intake/admin/entry-results'
export const DOCUMENT_INTAKE_OVERVIEW_ENDPOINT = '/agent/document-intake/admin/overview'

export const duplicateFilterOptions = [
  { label: '全部', value: '' },
  { label: '重复', value: 'true' },
  { label: '非重复', value: 'false' }
]

export const deviceStatusFilterOptions = [
  { label: '全部设备', value: '' },
  { label: '待绑定', value: 'pending' },
  { label: '在线', value: 'active' },
  { label: '离线', value: 'offline' },
  { label: '停用', value: 'disabled' }
]

export const logLevelFilterOptions = [
  { label: '全部日志', value: '' },
  { label: '错误', value: 'error' },
  { label: '警告', value: 'warn' },
  { label: '信息', value: 'info' },
  { label: '调试', value: 'debug' }
]

export const entryResultStatusFilterOptions = [
  { label: '全部结果', value: '' },
  { label: '成功入库', value: 'successful' },
  { label: '计划中', value: 'planned' },
  { label: '入库中', value: 'importing' },
  { label: '已入库', value: 'imported' },
  { label: '部分入库', value: 'partial' },
  { label: '失败', value: 'failed' },
  { label: '重复跳过', value: 'skipped_duplicate' },
  { label: '仅归档', value: 'archived_only' }
]

export const targetKindFilterOptions = [
  { label: '全部目标', value: '' },
  { label: '固定模块', value: 'fixed_module_table' },
  { label: '动态应用', value: 'data_app' }
]

export const operatorSourceFilterOptions = [
  { label: '全部来源', value: '' },
  { label: '网页登录用户', value: 'web_login_user' },
  { label: '设备默认用户', value: 'device_default_user' }
]

export const watchFolderSourceFilterOptions = [
  { label: '全部目录来源', value: '' },
  { label: '本机设置', value: 'local_settings' },
  { label: '远程下发', value: 'remote_config' }
]

export function normalizeDuplicateFilter(value) {
  if (value === true || value === 'true') return 'true'
  if (value === false || value === 'false') return 'false'
  return ''
}

export function buildDocumentIntakeAssetListUrl(filters = {}) {
  const params = new URLSearchParams()
  const duplicate = normalizeDuplicateFilter(filters.duplicate)
  const q = String(filters.q || filters.keyword || '').trim()
  const status = String(filters.status || '').trim()
  const deviceId = String(filters.deviceId || filters.device_id || '').trim()
  const user = String(filters.user || filters.userId || filters.user_id || filters.username || '').trim()
  const operatorSource = String(filters.operatorSource || filters.operator_source || '').trim()
  const sourceFolder = String(filters.sourceFolder || filters.source_folder || '').trim()
  const watchFolderSource = String(filters.watchFolderSource || filters.watch_folder_source || '').trim()
  const today = filters.today === true || filters.today === 'true' ? 'true' : ''
  const limit = Number.isFinite(Number(filters.limit)) ? Number(filters.limit) : 50
  const offset = Number.isFinite(Number(filters.offset)) ? Number(filters.offset) : 0

  if (today) params.set('today', today)
  if (duplicate) params.set('duplicate', duplicate)
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  if (deviceId) params.set('deviceId', deviceId)
  if (user) params.set('user', user)
  if (operatorSource) params.set('operatorSource', operatorSource)
  if (sourceFolder) params.set('sourceFolder', sourceFolder)
  if (watchFolderSource) params.set('watchFolderSource', watchFolderSource)
  params.set('limit', String(Math.min(200, Math.max(1, Math.floor(limit)))))
  params.set('offset', String(Math.max(0, Math.floor(offset))))

  return `${DOCUMENT_INTAKE_ASSETS_ENDPOINT}?${params.toString()}`
}

export function buildDocumentIntakeDeviceListUrl(filters = {}) {
  const params = new URLSearchParams()
  const q = String(filters.q || filters.keyword || '').trim()
  const status = String(filters.status || '').trim()
  const user = String(filters.user || filters.userId || filters.user_id || filters.username || '').trim()
  const serverBaseUrl = String(filters.serverBaseUrl || filters.server_base_url || filters.server || '').trim()
  const clientVersion = String(filters.clientVersion || filters.client_version || '').trim()
  const webviewVersion = String(filters.webviewVersion || filters.webViewVersion || filters.webview_version || '').trim()
  const limit = Number.isFinite(Number(filters.limit)) ? Number(filters.limit) : 50
  const offset = Number.isFinite(Number(filters.offset)) ? Number(filters.offset) : 0

  if (q) params.set('q', q)
  if (status) params.set('status', status)
  if (user) params.set('user', user)
  if (serverBaseUrl) params.set('serverBaseUrl', serverBaseUrl)
  if (clientVersion) params.set('clientVersion', clientVersion)
  if (webviewVersion) params.set('webviewVersion', webviewVersion)
  params.set('limit', String(Math.min(200, Math.max(1, Math.floor(limit)))))
  params.set('offset', String(Math.max(0, Math.floor(offset))))

  return `${DOCUMENT_INTAKE_DEVICES_ENDPOINT}?${params.toString()}`
}

export function buildDocumentIntakeLogListUrl(filters = {}) {
  const params = new URLSearchParams()
  const q = String(filters.q || filters.keyword || '').trim()
  const level = String(filters.level || '').trim()
  const traceId = String(filters.traceId || filters.trace_id || '').trim()
  const deviceId = String(filters.deviceId || filters.device_id || '').trim()
  const batchId = String(filters.batchId || filters.batch_id || '').trim()
  const eventType = String(filters.eventType || filters.event_type || '').trim()
  const sourceFileHash = String(filters.sourceFileHash || filters.source_file_hash || filters.fileHash || filters.file_hash || '').trim()
  const sourceFolder = String(filters.sourceFolder || filters.source_folder || '').trim()
  const watchFolderSource = String(filters.watchFolderSource || filters.watch_folder_source || '').trim()
  const user = String(filters.user || filters.userId || filters.user_id || filters.username || '').trim()
  const appModule = String(filters.appModule || filters.app_module || filters.module || '').trim()
  const route = String(filters.route || filters.page || filters.url || '').trim()
  const limit = Number.isFinite(Number(filters.limit)) ? Number(filters.limit) : 50
  const offset = Number.isFinite(Number(filters.offset)) ? Number(filters.offset) : 0

  if (q) params.set('q', q)
  if (level) params.set('level', level)
  if (traceId) params.set('traceId', traceId)
  if (deviceId) params.set('deviceId', deviceId)
  if (batchId) params.set('batchId', batchId)
  if (eventType) params.set('eventType', eventType)
  if (sourceFileHash) params.set('sourceFileHash', sourceFileHash)
  if (sourceFolder) params.set('sourceFolder', sourceFolder)
  if (watchFolderSource) params.set('watchFolderSource', watchFolderSource)
  if (user) params.set('user', user)
  if (appModule) params.set('appModule', appModule)
  if (route) params.set('route', route)
  params.set('limit', String(Math.min(200, Math.max(1, Math.floor(limit)))))
  params.set('offset', String(Math.max(0, Math.floor(offset))))

  return `${DOCUMENT_INTAKE_LOGS_ENDPOINT}?${params.toString()}`
}

export function buildDocumentIntakeEntryResultListUrl(filters = {}) {
  const params = new URLSearchParams()
  const q = String(filters.q || filters.keyword || '').trim()
  const status = String(filters.status || '').trim()
  const targetKind = String(filters.targetKind || filters.target_kind || '').trim()
  const duplicate = normalizeDuplicateFilter(filters.duplicate)
  const deviceId = String(filters.deviceId || filters.device_id || '').trim()
  const user = String(filters.user || filters.userId || filters.user_id || filters.username || '').trim()
  const operatorSource = String(filters.operatorSource || filters.operator_source || '').trim()
  const assetId = String(filters.assetId || filters.asset_id || '').trim()
  const batchId = String(filters.batchId || filters.batch_id || '').trim()
  const lowConfidence = filters.lowConfidence === true || filters.low_confidence === true || filters.lowConfidence === 'true' || filters.low_confidence === 'true' ? 'true' : ''
  const today = filters.today === true || filters.today === 'true' ? 'true' : ''
  const limit = Number.isFinite(Number(filters.limit)) ? Number(filters.limit) : 50
  const offset = Number.isFinite(Number(filters.offset)) ? Number(filters.offset) : 0

  if (today) params.set('today', today)
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  if (targetKind) params.set('targetKind', targetKind)
  if (duplicate) params.set('duplicate', duplicate)
  if (deviceId) params.set('deviceId', deviceId)
  if (user) params.set('user', user)
  if (operatorSource) params.set('operatorSource', operatorSource)
  if (assetId) params.set('assetId', assetId)
  if (batchId) params.set('batchId', batchId)
  if (lowConfidence) params.set('lowConfidence', lowConfidence)
  params.set('limit', String(Math.min(200, Math.max(1, Math.floor(limit)))))
  params.set('offset', String(Math.max(0, Math.floor(offset))))

  return `${DOCUMENT_INTAKE_ENTRY_RESULTS_ENDPOINT}?${params.toString()}`
}

export function buildDocumentIntakeEntryResultDetailUrl(id) {
  const value = String(id || '').trim()
  return `${DOCUMENT_INTAKE_ENTRY_RESULTS_ENDPOINT}/${encodeURIComponent(value)}`
}

export function buildDocumentIntakeOverviewUrl() {
  return DOCUMENT_INTAKE_OVERVIEW_ENDPOINT
}

export function buildDocumentIntakeDeviceStatusUrl(id) {
  const value = String(id || '').trim()
  return `${DOCUMENT_INTAKE_DEVICES_ENDPOINT}/${encodeURIComponent(value)}/status`
}

export function buildDocumentIntakeDeviceResetBindingCodeUrl(id) {
  const value = String(id || '').trim()
  return `${DOCUMENT_INTAKE_DEVICES_ENDPOINT}/${encodeURIComponent(value)}/reset-binding-code`
}

export function buildDocumentIntakeDeviceWatchFoldersUrl(id) {
  const value = String(id || '').trim()
  return `${DOCUMENT_INTAKE_DEVICES_ENDPOINT}/${encodeURIComponent(value)}/watch-folders`
}

export function buildDocumentIntakeWatchFolderStatusUrl(deviceId, folderId) {
  const deviceValue = String(deviceId || '').trim()
  const folderValue = String(folderId || '').trim()
  return `${DOCUMENT_INTAKE_DEVICES_ENDPOINT}/${encodeURIComponent(deviceValue)}/watch-folders/${encodeURIComponent(folderValue)}/status`
}

export function buildDocumentIntakeWatchFolderUrl(deviceId, folderId) {
  const deviceValue = String(deviceId || '').trim()
  const folderValue = String(folderId || '').trim()
  return `${DOCUMENT_INTAKE_DEVICES_ENDPOINT}/${encodeURIComponent(deviceValue)}/watch-folders/${encodeURIComponent(folderValue)}`
}

export async function fetchDocumentIntakeOverview() {
  const response = await fetch(buildDocumentIntakeOverviewUrl(), {
    method: 'GET',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `智能收单总览加载失败：${response.status}`)
  }
  return response.json()
}

export async function updateDocumentIntakeDeviceStatus(id, status) {
  const response = await fetch(buildDocumentIntakeDeviceStatusUrl(id), {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `设备状态更新失败：${response.status}`)
  }
  return response.json()
}

export async function resetDocumentIntakeDeviceBindingCode(id) {
  const response = await fetch(buildDocumentIntakeDeviceResetBindingCodeUrl(id), {
    method: 'POST',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `设备授权码重置失败：${response.status}`)
  }
  return response.json()
}

export async function fetchDocumentIntakeDeviceWatchFolders(id) {
  const response = await fetch(buildDocumentIntakeDeviceWatchFoldersUrl(id), {
    method: 'GET',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `监听目录加载失败：${response.status}`)
  }
  return response.json()
}

export async function createDocumentIntakeDeviceWatchFolder(deviceId, payload) {
  const response = await fetch(buildDocumentIntakeDeviceWatchFoldersUrl(deviceId), {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `监听目录新增失败：${response.status}`)
  }
  return response.json()
}

export async function updateDocumentIntakeWatchFolder(deviceId, folderId, payload) {
  const response = await fetch(buildDocumentIntakeWatchFolderUrl(deviceId, folderId), {
    method: 'PATCH',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `监听目录保存失败：${response.status}`)
  }
  return response.json()
}

export async function updateDocumentIntakeWatchFolderStatus(deviceId, folderId, enabled) {
  const response = await fetch(buildDocumentIntakeWatchFolderStatusUrl(deviceId, folderId), {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ enabled: !!enabled })
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `监听目录状态更新失败：${response.status}`)
  }
  return response.json()
}

export async function deleteDocumentIntakeWatchFolder(deviceId, folderId) {
  const response = await fetch(buildDocumentIntakeWatchFolderUrl(deviceId, folderId), {
    method: 'DELETE',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `监听目录删除失败：${response.status}`)
  }
  return response.json()
}

export async function fetchDocumentIntakeAssets(filters = {}) {
  const response = await fetch(buildDocumentIntakeAssetListUrl(filters), {
    method: 'GET',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `资产列表加载失败：${response.status}`)
  }
  return response.json()
}

export async function fetchDocumentIntakeDevices(filters = {}) {
  const response = await fetch(buildDocumentIntakeDeviceListUrl(filters), {
    method: 'GET',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `设备列表加载失败：${response.status}`)
  }
  return response.json()
}

export async function fetchDocumentIntakeLogs(filters = {}) {
  const response = await fetch(buildDocumentIntakeLogListUrl(filters), {
    method: 'GET',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `日志列表加载失败：${response.status}`)
  }
  return response.json()
}

export async function fetchDocumentIntakeEntryResults(filters = {}) {
  const response = await fetch(buildDocumentIntakeEntryResultListUrl(filters), {
    method: 'GET',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `入库结果加载失败：${response.status}`)
  }
  return response.json()
}

export async function fetchDocumentIntakeEntryResultDetail(id) {
  const response = await fetch(buildDocumentIntakeEntryResultDetailUrl(id), {
    method: 'GET',
    headers: getAuthHeader()
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `入库结果详情加载失败：${response.status}`)
  }
  return response.json()
}
