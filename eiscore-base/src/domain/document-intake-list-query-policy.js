// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const pagination = (page, pageSize) => ({
  limit: pageSize,
  offset: (page - 1) * pageSize
})

export const buildDocumentIntakeAssetQuery = (filters, page, pageSize) => ({
  duplicate: filters.duplicate,
  q: filters.q,
  status: filters.status,
  today: filters.today,
  deviceId: filters.deviceId,
  user: filters.user,
  operatorSource: filters.operatorSource,
  sourceFolder: filters.sourceFolder,
  watchFolderSource: filters.watchFolderSource,
  ...pagination(page, pageSize)
})

export const buildDocumentIntakeDeviceQuery = (filters, page, pageSize) => ({
  status: filters.status,
  q: filters.q,
  user: filters.user,
  serverBaseUrl: filters.serverBaseUrl,
  clientVersion: filters.clientVersion,
  webviewVersion: filters.webviewVersion,
  ...pagination(page, pageSize)
})

export const buildDocumentIntakeLogQuery = (filters, page, pageSize) => ({
  level: filters.level,
  q: filters.q,
  traceId: filters.traceId,
  eventType: filters.eventType,
  sourceFileHash: filters.sourceFileHash,
  sourceFolder: filters.sourceFolder,
  watchFolderSource: filters.watchFolderSource,
  user: filters.user,
  appModule: filters.appModule,
  route: filters.route,
  batchId: filters.batchId,
  deviceId: filters.deviceId,
  ...pagination(page, pageSize)
})

export const buildDocumentIntakeEntryResultQuery = (filters, page, pageSize) => ({
  status: filters.status,
  targetKind: filters.targetKind,
  duplicate: filters.duplicate,
  q: filters.q,
  user: filters.user,
  operatorSource: filters.operatorSource,
  today: filters.today,
  lowConfidence: filters.lowConfidence,
  deviceId: filters.deviceId,
  assetId: filters.assetId,
  batchId: filters.batchId,
  ...pagination(page, pageSize)
})
