// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const policyPath = resolve(repoRoot, 'eiscore-base/src/domain/document-intake-list-query-policy.js')
const viewPath = resolve(repoRoot, 'eiscore-base/src/views/DocumentIntakeCenter.vue')
const policySource = readFileSync(policyPath, 'utf8')
const viewSource = readFileSync(viewPath, 'utf8')
const policy = await import(pathToFileURL(policyPath).href)

assert.deepEqual(policy.buildDocumentIntakeAssetQuery({
  duplicate: 'true', q: 'asset', status: 'imported', today: true, deviceId: 'device-1', user: 'operator',
  operatorSource: 'web_login_user', sourceFolder: 'D:/Inbox', watchFolderSource: 'remote_config'
}, 3, 20), {
  duplicate: 'true', q: 'asset', status: 'imported', today: true, deviceId: 'device-1', user: 'operator',
  operatorSource: 'web_login_user', sourceFolder: 'D:/Inbox', watchFolderSource: 'remote_config', limit: 20, offset: 40
})
assert.deepEqual(policy.buildDocumentIntakeDeviceQuery({
  status: 'active', q: 'collector', user: 'operator', serverBaseUrl: 'https://eis.example',
  clientVersion: '1.0', webviewVersion: '121'
}, 2, 50), {
  status: 'active', q: 'collector', user: 'operator', serverBaseUrl: 'https://eis.example',
  clientVersion: '1.0', webviewVersion: '121', limit: 50, offset: 50
})
assert.deepEqual(policy.buildDocumentIntakeLogQuery({
  level: 'warn', q: 'failed', traceId: 'trace-1', eventType: 'upload_failed', sourceFileHash: 'hash-1',
  sourceFolder: 'D:/Inbox', watchFolderSource: 'local_settings', user: 'operator', appModule: 'base',
  route: '/document-intake', batchId: 'batch-1', deviceId: 'device-1'
}, 4, 25), {
  level: 'warn', q: 'failed', traceId: 'trace-1', eventType: 'upload_failed', sourceFileHash: 'hash-1',
  sourceFolder: 'D:/Inbox', watchFolderSource: 'local_settings', user: 'operator', appModule: 'base',
  route: '/document-intake', batchId: 'batch-1', deviceId: 'device-1', limit: 25, offset: 75
})
assert.deepEqual(policy.buildDocumentIntakeEntryResultQuery({
  status: 'partial', targetKind: 'data_app', duplicate: 'false', q: 'order', user: 'operator',
  operatorSource: 'device_default_user', today: false, lowConfidence: true, deviceId: 'device-1',
  assetId: 'asset-1', batchId: 'batch-1'
}, '2', '10'), {
  status: 'partial', targetKind: 'data_app', duplicate: 'false', q: 'order', user: 'operator',
  operatorSource: 'device_default_user', today: false, lowConfidence: true, deviceId: 'device-1',
  assetId: 'asset-1', batchId: 'batch-1', limit: '10', offset: 10
})

assert.doesNotMatch(policySource, /from\s*['"](?:vue|element-plus|@element-plus\/icons-vue)['"]/)
assert.doesNotMatch(policySource, /\b(?:window|navigator|globalThis|document)\s*\./)
assert.doesNotMatch(policySource, /\b(?:localStorage|sessionStorage|XMLHttpRequest)\b|\bfetch\s*\(|\bRequest\s*\(/)
assert.doesNotMatch(policySource, /\bnew\s+Date\b|\bDate\s*\.|\b(?:setTimeout|setInterval)\s*\(/)
assert.ok(viewSource.includes("from '@/domain/document-intake-list-query-policy.js'"))
for (const delegate of [
  'buildDocumentIntakeAssetQuery(filters, page.value, pageSize.value)',
  'buildDocumentIntakeDeviceQuery(deviceFilters, devicePage.value, devicePageSize.value)',
  'buildDocumentIntakeLogQuery(logFilters, logPage.value, logPageSize.value)',
  'buildDocumentIntakeEntryResultQuery(entryResultFilters, entryResultPage.value, entryResultPageSize.value)'
]) assert.ok(viewSource.includes(delegate), `missing page delegate: ${delegate}`)
assert.ok(viewSource.split(/\r?\n/).length <= 1973, 'DocumentIntakeCenter must not grow beyond its list-query baseline')

console.log('PASS: document intake list query policy regression')
