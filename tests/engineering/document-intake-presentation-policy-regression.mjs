// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const policyPath = resolve(repoRoot, 'eiscore-base/src/domain/document-intake-presentation-policy.js')
const viewPath = resolve(repoRoot, 'eiscore-base/src/views/DocumentIntakeCenter.vue')
const policySource = readFileSync(policyPath, 'utf8')
const viewSource = readFileSync(viewPath, 'utf8')
const policy = await import(pathToFileURL(policyPath).href)

const overviewItems = policy.buildDocumentIntakeOverviewItems({
  todayFileCount: 1234.9,
  successfulImportCount: -1,
  lowConfidenceCount: '8',
  unrecognizedCount: Number.NaN,
  duplicateFileCount: 2,
  failedCount: 3,
  activeDeviceCount: 4,
  offlineDeviceCount: 5
})
assert.equal(overviewItems.length, 8)
assert.deepEqual(
  overviewItems.map(({ key, label, action }) => ({ key, label, action })),
  [
    { key: 'todayFileCount', label: '今日采集', action: 'assets-today' },
    { key: 'successfulImportCount', label: '成功入库', action: 'entry-successful' },
    { key: 'lowConfidenceCount', label: '低置信度', action: 'entry-low-confidence' },
    { key: 'unrecognizedCount', label: '未识别', action: 'assets-unrecognized' },
    { key: 'duplicateFileCount', label: '重复文件', action: 'assets-duplicate' },
    { key: 'failedCount', label: '失败', action: 'entry-failed' },
    { key: 'activeDeviceCount', label: '在线设备', action: 'devices-active' },
    { key: 'offlineDeviceCount', label: '离线设备', action: 'devices-offline' }
  ]
)
assert.deepEqual(overviewItems.map(({ value }) => value), ['1,234', '0', '8', '0', '2', '3', '4', '5'])

const businessUrl = policy.buildDocumentIntakeBusinessRecordUrl
assert.equal(businessUrl({ businessRecordUrl: '/server/url', targetRecordId: 'ignored' }), '/server/url')
assert.equal(businessUrl({ business_record_url: '/snake/url', targetRecordId: 'ignored' }), '/snake/url')
assert.equal(
  businessUrl({ targetKind: 'data_app', targetAppId: 'app/a', targetRecordId: 'record b' }),
  '/apps/app/app%2Fa/record/record%20b?source=document-intake'
)

const knownRoutes = [
  ['public', 'raw_materials', '/materials/material/detail/id%2F1?source=document-intake'],
  ['scm', 'inventory_transactions', '/materials/inventory-ledger?recordId=id%2F1&source=document-intake'],
  ['scm', 'inventory_batches', '/materials/inventory-current?recordId=id%2F1&source=document-intake'],
  ['scm', 'warehouses', '/materials/warehouses?recordId=id%2F1&source=document-intake'],
  ['scm', 'inventory_drafts', '/materials/inventory-draft/detail/id%2F1?source=document-intake'],
  ['custom', 'purchase_orders', '/purchase/document/id%2F1?appKey=orders&source=document-intake'],
  ['custom', 'boms', '/production/app/bom_list?recordId=id%2F1&source=document-intake'],
  ['custom', 'v_production_work_orders', '/production/app/work_orders?recordId=id%2F1&source=document-intake'],
  ['custom', 'production_inspections', '/quality/app/production_inspections?recordId=id%2F1&source=document-intake'],
  ['custom', 'sales_orders', '/sales/app/orders?recordId=id%2F1&source=document-intake']
]
for (const [targetSchema, targetTable, expected] of knownRoutes) {
  assert.equal(businessUrl({ targetSchema, targetTable, targetRecordId: 'id/1' }), expected)
}
assert.equal(policy.getDocumentIntakeBusinessRecordTableKey({ targetSchema: ' scm ', targetTable: ' warehouses ' }), 'scm.warehouses')
assert.equal(businessUrl({ targetSchema: 'unknown', targetTable: 'unknown_table', targetRecordId: 'id' }), '')
assert.equal(businessUrl({ targetTable: 'sales_orders' }), '')

const assertMappings = (fn, expected) => {
  for (const [input, output] of Object.entries(expected)) assert.equal(fn(input), output)
}
assertMappings(policy.getDocumentIntakeAssetStatusLabel, {
  uploaded: '已上传', duplicate: '重复', queued: '排队中', parsing: '解析中', parsed: '已解析', classified: '已识别',
  importing: '入库中', imported: '已入库', partial_imported: '部分入库', unrecognized: '未识别', failed: '失败', archived: '已归档'
})
assertMappings(policy.getDocumentIntakeAssetStatusTagType, {
  duplicate: 'warning', failed: 'danger', imported: 'success', partial_imported: 'warning', unrecognized: 'info'
})
assertMappings(policy.getDocumentIntakeDeviceStatusLabel, { pending: '待绑定', active: '在线', offline: '离线', disabled: '停用' })
assertMappings(policy.getDocumentIntakeDeviceStatusTagType, { active: 'success', offline: 'warning', disabled: 'danger', pending: 'info' })
assertMappings(policy.getDocumentIntakeLogLevelLabel, { error: '错误', warn: '警告', warning: '警告', info: '信息', debug: '调试' })
assertMappings(policy.getDocumentIntakeLogLevelTagType, { error: 'danger', warn: 'warning', warning: 'warning', info: 'info', debug: '' })
assertMappings(policy.getDocumentIntakeEntryResultStatusLabel, {
  planned: '计划中', importing: '入库中', imported: '已入库', partial: '部分入库', failed: '失败',
  skipped_duplicate: '重复跳过', archived_only: '仅归档'
})
assertMappings(policy.getDocumentIntakeEntryResultStatusTagType, {
  imported: 'success', partial: 'warning', failed: 'danger', skipped_duplicate: 'warning', archived_only: 'info', planned: 'info'
})
assertMappings(policy.getDocumentIntakeRecalculationStatusLabel, {
  pending: '待重算', recalculating: '重算中', completed: '已重算', failed: '重算失败', skipped: '无需重算'
})
assertMappings(policy.getDocumentIntakeSourceLabel, {
  web_drag_drop: '网页拖拽', manual_drag_drop: '桌面拖拽', manual_selected_file: '手动选择', watch_folder: '监听目录', collector_desktop: '采集端'
})
assertMappings(policy.getDocumentIntakeOperatorSourceLabel, { web_login_user: '网页登录用户', device_default_user: '设备默认用户' })
assertMappings(policy.getDocumentIntakeWatchFolderSourceLabel, { local_settings: '本机设置', remote_config: '远程下发' })

assert.equal(policy.formatDocumentIntakeBytes(0), '0 B')
assert.equal(policy.formatDocumentIntakeBytes(1024), '1.0 KB')
assert.equal(policy.formatDocumentIntakeBytes(1024 ** 2), '1.0 MB')
assert.equal(policy.formatDocumentIntakeBytes(1024 ** 3), '1.0 GB')
assert.equal(policy.formatDocumentIntakeCorrectionValue(null), '-')
assert.equal(policy.formatDocumentIntakeCorrectionValue(false), 'false')
assert.equal(policy.formatDocumentIntakeConfidence(0.876), '88%')
assert.equal(policy.formatDocumentIntakeConfidence('unknown'), 'unknown')
assert.equal(policy.getDocumentIntakeTargetKindLabel('fixed_module_table'), '固定模块')
assert.equal(policy.getDocumentIntakeTargetKindLabel('data_app'), '动态应用')
assert.equal(policy.getDocumentIntakeTargetTableLabel({ targetSchema: 'scm', targetTable: 'warehouses' }), 'scm.warehouses')
assert.equal(policy.getDocumentIntakeLinkTargetTableLabel({ targetDocumentType: '采购单' }), '采购单')
assert.equal(policy.getDocumentIntakeAssetTargetLabel({ appName: '动态应用' }), '动态应用')
assert.equal(policy.getDocumentIntakeAssetFileTypeLabel({ fileExt: '.xlsx', mimeType: 'ignored/type' }), 'XLSX')
assert.equal(policy.getDocumentIntakeAssetFileTypeLabel({ mimeType: 'application/pdf' }), 'PDF')
assert.equal(policy.getDocumentIntakeAssetGeneratedCountLabel({ generatedDocumentCount: 3 }), '3 条')
assert.equal(policy.getDocumentIntakeAssetGeneratedCountLabel({ businessLinkCount: 0, documentCount: 2 }), '-')
assert.equal(policy.getDocumentIntakeAssetSourceFolderLabel({ sourceFolder: 'C:/Watch', watchFolderSource: 'remote_config' }), 'C:/Watch · 远程下发')
assert.equal(policy.getDocumentIntakeLogSourceFolderLabel({ watchFolderSource: 'local_settings' }), '本机设置')
assert.equal(policy.getDocumentIntakeLogSourceFolderLabel({}), '-')

assert.doesNotMatch(policySource, /from\s*['"](?:vue|element-plus|@element-plus\/icons-vue)['"]/)
assert.doesNotMatch(policySource, /\b(?:window|navigator|globalThis|document)\s*\./)
assert.doesNotMatch(policySource, /\b(?:localStorage|sessionStorage|XMLHttpRequest)\b|\bfetch\s*\(|\bRequest\s*\(/)
assert.doesNotMatch(policySource, /\bnew\s+Date\b|\bDate\s*\.|\b(?:setTimeout|setInterval)\s*\(/)
assert.ok(viewSource.includes("from '@/domain/document-intake-presentation-policy.js'"))
assert.ok(viewSource.includes('buildDocumentIntakeOverviewItems(overview.value)'))
assert.ok(viewSource.includes('buildDocumentIntakeBusinessRecordUrl as businessRecordUrl'))
assert.ok(viewSource.includes('const url = businessRecordUrl(row)'))
assert.ok(viewSource.split(/\r?\n/).length <= 2446, 'DocumentIntakeCenter must not grow beyond its pre-extraction baseline')

console.log('PASS: document intake presentation policy regression')
