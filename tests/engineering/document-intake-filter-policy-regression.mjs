// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const policyPath = resolve(repoRoot, 'eiscore-base/src/domain/document-intake-filter-policy.js')
const viewPath = resolve(repoRoot, 'eiscore-base/src/views/DocumentIntakeCenter.vue')
const policySource = readFileSync(policyPath, 'utf8')
const viewSource = readFileSync(viewPath, 'utf8')
const policy = await import(pathToFileURL(policyPath).href)

assert.deepEqual(policy.createDocumentIntakeAssetFilters(), {
  duplicate: '', q: '', status: '', today: false, deviceId: '', deviceName: '', user: '', operatorSource: '', sourceFolder: '', watchFolderSource: ''
})
assert.deepEqual(policy.createDocumentIntakeDeviceFilters(), {
  status: '', q: '', user: '', serverBaseUrl: '', clientVersion: '', webviewVersion: ''
})
assert.deepEqual(policy.createDocumentIntakeLogFilters(), {
  level: '', q: '', traceId: '', eventType: '', sourceFileHash: '', sourceFolder: '', watchFolderSource: '', user: '', appModule: '', route: '', batchId: '', deviceId: '', deviceName: ''
})
assert.deepEqual(policy.createDocumentIntakeEntryResultFilters(), {
  status: '', targetKind: '', duplicate: '', q: '', user: '', operatorSource: '', today: false, lowConfidence: false,
  deviceId: '', deviceName: '', assetId: '', assetName: '', batchId: '', batchLabel: ''
})
assert.notEqual(policy.createDocumentIntakeAssetFilters(), policy.createDocumentIntakeAssetFilters())

assert.deepEqual(policy.planDocumentIntakeEntryResultsForAsset({ id: 'asset-1', originalFilename: '采购单.pdf' }), {
  target: 'entryResults', filterPatch: { assetId: 'asset-1', assetName: '采购单.pdf' }
})
assert.deepEqual(policy.planDocumentIntakeEntryResultsForLog({ aiImportBatchId: 'batch-1' }), {
  target: 'entryResults', filterPatch: { batchId: 'batch-1', batchLabel: 'batch-1' }
})
assert.deepEqual(policy.planDocumentIntakeEntryResultsForDevice({ id: 'device-1', deviceCode: 'code-1', deviceName: '仓库电脑' }), {
  target: 'entryResults', filterPatch: { deviceId: 'device-1', deviceName: '仓库电脑' }
})
assert.deepEqual(policy.planDocumentIntakeAssetsForDevice({ deviceCode: 'code-1' }), {
  target: 'assets', filterPatch: { deviceId: 'code-1', deviceName: 'code-1' }
})
assert.deepEqual(policy.planDocumentIntakeLogsForDevice({ id: 'device-1', deviceCode: 'code-1' }), {
  target: 'logs', filterPatch: { deviceId: 'device-1', deviceName: 'code-1' }
})
assert.deepEqual(policy.planDocumentIntakeAssetForLog({ sourceFileHash: 'sha256-1' }), {
  target: 'assets', filterPatch: { q: 'sha256-1' }
})

for (const planner of [
  policy.planDocumentIntakeEntryResultsForAsset,
  policy.planDocumentIntakeEntryResultsForLog,
  policy.planDocumentIntakeEntryResultsForDevice,
  policy.planDocumentIntakeAssetsForDevice,
  policy.planDocumentIntakeLogsForDevice,
  policy.planDocumentIntakeAssetForLog
]) {
  assert.equal(planner(), null)
}

assert.doesNotMatch(policySource, /from\s*['"](?:vue|element-plus|@element-plus\/icons-vue)['"]/)
assert.doesNotMatch(policySource, /\b(?:window|navigator|globalThis|document)\s*\./)
assert.doesNotMatch(policySource, /\b(?:localStorage|sessionStorage|XMLHttpRequest)\b|\bfetch\s*\(|\bRequest\s*\(/)
assert.doesNotMatch(policySource, /\bnew\s+Date\b|\bDate\s*\.|\b(?:setTimeout|setInterval)\s*\(/)
assert.ok(viewSource.includes("from '@/domain/document-intake-filter-policy.js'"))
for (const delegate of [
  'planDocumentIntakeEntryResultsForAsset(row)',
  'planDocumentIntakeEntryResultsForLog(row)',
  'planDocumentIntakeEntryResultsForDevice(row)',
  'planDocumentIntakeAssetsForDevice(row)',
  'planDocumentIntakeLogsForDevice(row)',
  'planDocumentIntakeAssetForLog(row)'
]) assert.ok(viewSource.includes(delegate), `missing page delegate: ${delegate}`)
assert.ok(viewSource.includes('const applyDocumentIntakeFilterPlan = (plan) =>'))
assert.ok(viewSource.includes('Object.assign(target.filters, plan.filterPatch)'))
assert.ok(viewSource.split(/\r?\n/).length <= 2051, 'DocumentIntakeCenter must not grow beyond its filter-policy baseline')

console.log('PASS: document intake filter policy regression')
