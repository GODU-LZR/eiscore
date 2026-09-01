// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const createDocumentIntakeAssetFilters = () => ({
  duplicate: '',
  q: '',
  status: '',
  today: false,
  deviceId: '',
  deviceName: '',
  user: '',
  operatorSource: '',
  sourceFolder: '',
  watchFolderSource: ''
})

export const createDocumentIntakeDeviceFilters = () => ({
  status: '',
  q: '',
  user: '',
  serverBaseUrl: '',
  clientVersion: '',
  webviewVersion: ''
})

export const createDocumentIntakeLogFilters = () => ({
  level: '',
  q: '',
  traceId: '',
  eventType: '',
  sourceFileHash: '',
  sourceFolder: '',
  watchFolderSource: '',
  user: '',
  appModule: '',
  route: '',
  batchId: '',
  deviceId: '',
  deviceName: ''
})

export const createDocumentIntakeEntryResultFilters = () => ({
  status: '',
  targetKind: '',
  duplicate: '',
  q: '',
  user: '',
  operatorSource: '',
  today: false,
  lowConfidence: false,
  deviceId: '',
  deviceName: '',
  assetId: '',
  assetName: '',
  batchId: '',
  batchLabel: ''
})

const deviceIdentity = (row) => {
  const id = row?.id || row?.deviceCode
  if (!id) return null
  return { id, name: row.deviceName || row.deviceCode || id }
}

export const planDocumentIntakeEntryResultsForAsset = (row) => {
  if (!row?.id) return null
  return {
    target: 'entryResults',
    filterPatch: { assetId: row.id, assetName: row.originalFilename || row.id }
  }
}

export const planDocumentIntakeEntryResultsForLog = (row) => {
  if (!row?.aiImportBatchId) return null
  return {
    target: 'entryResults',
    filterPatch: { batchId: row.aiImportBatchId, batchLabel: row.aiImportBatchId }
  }
}

export const planDocumentIntakeEntryResultsForDevice = (row) => {
  const device = deviceIdentity(row)
  if (!device) return null
  return {
    target: 'entryResults',
    filterPatch: { deviceId: device.id, deviceName: device.name }
  }
}

export const planDocumentIntakeAssetsForDevice = (row) => {
  const device = deviceIdentity(row)
  if (!device) return null
  return {
    target: 'assets',
    filterPatch: { deviceId: device.id, deviceName: device.name }
  }
}

export const planDocumentIntakeLogsForDevice = (row) => {
  const device = deviceIdentity(row)
  if (!device) return null
  return {
    target: 'logs',
    filterPatch: { deviceId: device.id, deviceName: device.name }
  }
}

export const planDocumentIntakeAssetForLog = (row) => {
  if (!row?.sourceFileHash) return null
  return { target: 'assets', filterPatch: { q: row.sourceFileHash } }
}
