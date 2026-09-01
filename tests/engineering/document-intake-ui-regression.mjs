// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const routerSource = readSource('eiscore-base/src/router/index.js')
const viewSource = readSource('eiscore-base/src/views/DocumentIntakeCenter.vue')
const presentationPolicySource = readSource('eiscore-base/src/domain/document-intake-presentation-policy.js')
const documentIntakeUiSource = `${viewSource}\n${presentationPolicySource}`
const apiModuleUrl = pathToFileURL(resolve(repoRoot, 'eiscore-base/src/utils/document-intake-api.js')).href
const api = await import(apiModuleUrl)

assert.ok(
  routerSource.includes("path: 'document-intake'") && routerSource.includes("name: 'document-intake'"),
  'base router should expose the intelligent document intake center route.'
)
assert.ok(
  routerSource.includes("import('../views/DocumentIntakeCenter.vue')"),
  'document-intake route should lazy-load DocumentIntakeCenter.vue.'
)

for (const text of ['智能收单中心', '文件列表', '设备列表', '日志列表', '入库结果', '今日采集', '成功入库', '低置信度', '未识别', '重复文件', '在线设备', '离线设备', '重复', '非重复', '上传人', '来源设备', '文件类型', '目标业务', '生成单据', '置信度', '上传时间', '默认上传人', '最后心跳', '监听目录', '目录来源', '设备监听目录', '目录路径', '目录名称', '默认归属', '默认上传用户 ID', '默认岗位 / 角色', '新增目录', '保存目录', '取消编辑', '启用目录', '停用目录', '编辑', '删除', 'trace_id', '事件类型', '文件 hash', '用户 / 岗位', '模块', '页面 / URL', '导入批次', '业务记录', '入库日志', '修改记录', '失败行', '未匹配字段', '入库结果详情', '来源文件', '来源方式', '设备编号', '默认上传人 / 岗位', '服务器地址', '客户端版本', 'WebView版本', '复制ID']) {
  assert.ok(documentIntakeUiSource.includes(text), `DocumentIntakeCenter should render visible text: ${text}`)
}

assert.ok(
  viewSource.includes('fetchDocumentIntakeOverview') &&
    viewSource.includes('const overviewItems = computed') &&
    viewSource.includes('buildDocumentIntakeOverviewItems(overview.value)') &&
    viewSource.includes('v-for="item in overviewItems"') &&
    viewSource.includes('@click="applyOverviewMetric(item)"') &&
    viewSource.includes('role="button"') &&
    viewSource.includes('aria-label="智能收单总览"') &&
    viewSource.includes('void loadOverview()'),
  'DocumentIntakeCenter should load and render the document intake overview metrics.'
)
assert.ok(
  viewSource.includes('applyOverviewMetric') &&
    viewSource.includes('planDocumentIntakeOverviewMetric(item)') &&
    viewSource.includes('reset: resetAssetFilters') &&
    viewSource.includes('reset: resetEntryResultFilters') &&
    viewSource.includes('reset: resetDeviceFilters') &&
    viewSource.includes('Object.assign(target.filters, plan.filterPatch)') &&
    presentationPolicySource.includes("action === 'assets-duplicate'") &&
    presentationPolicySource.includes("action === 'entry-low-confidence'") &&
    presentationPolicySource.includes("action === 'devices-active'"),
  'DocumentIntakeCenter should let overview metrics jump to matching filtered lists.'
)

assert.ok(
  viewSource.includes('v-model="filters.duplicate"') && viewSource.includes('duplicateFilterOptions'),
  'DocumentIntakeCenter should provide a dedicated duplicate segmented filter.'
)
assert.ok(
  viewSource.includes('fetchDocumentIntakeAssets') && viewSource.includes('duplicate: filters.duplicate'),
  'DocumentIntakeCenter should pass the duplicate filter to the asset list API.'
)
assert.ok(
  viewSource.includes('v-model="filters.user"') &&
    viewSource.includes('v-model="filters.operatorSource"') &&
    viewSource.includes('v-model="filters.sourceFolder"') &&
    viewSource.includes('v-model="filters.watchFolderSource"') &&
    viewSource.includes('user: filters.user') &&
    viewSource.includes('operatorSource: filters.operatorSource') &&
    viewSource.includes('sourceFolder: filters.sourceFolder') &&
    viewSource.includes('watchFolderSource: filters.watchFolderSource'),
  'DocumentIntakeCenter should filter source files by uploaded user/role, operator source and watch folder source.'
)

assert.ok(
  viewSource.includes('assetSourceFolderLabel(row)') &&
    viewSource.includes('watchFolderSourceFilterOptions') &&
    viewSource.includes('watchFolderSourceLabel'),
  'DocumentIntakeCenter should display source folder path and watch folder source labels.'
)
assert.ok(
  viewSource.includes('assetFileTypeLabel(row)') &&
    viewSource.includes('assetTargetLabel(row)') &&
    viewSource.includes('assetGeneratedCountLabel(row)') &&
    viewSource.includes('formatConfidence(row.confidence)'),
  'DocumentIntakeCenter asset rows should display file type, target business, generated count, and confidence.'
)
assert.ok(
  viewSource.includes('deviceId: filters.deviceId') && viewSource.includes('clearAssetDeviceFilter'),
  'DocumentIntakeCenter should filter source files by collector device.'
)
assert.ok(
  viewSource.includes('fetchDocumentIntakeDevices') && viewSource.includes('deviceFilters.status'),
  'DocumentIntakeCenter should load devices with status and keyword filters.'
)
assert.ok(
  viewSource.includes('toggleDeviceStatus(row)') &&
    viewSource.includes('resetDeviceBindingCode(row)') &&
    viewSource.includes('openWatchFolders(row)') &&
    viewSource.includes("row.status === 'disabled' ? '启用' : '停用'") &&
    viewSource.includes('updateDocumentIntakeDeviceStatus(row.id, nextStatus)') &&
    viewSource.includes('resetDocumentIntakeDeviceBindingCode(row.id)') &&
    viewSource.includes('ElMessageBox.confirm') &&
    viewSource.includes('新授权码已复制'),
  'DocumentIntakeCenter should provide device watch folder, enable/disable and binding-code reset actions.'
)
assert.ok(
  viewSource.includes('watchFolderDrawerVisible') &&
    viewSource.includes('selectedWatchFolderDevice') &&
    viewSource.includes('watchFolders') &&
    viewSource.includes('watchFolderForm') &&
    viewSource.includes('saveWatchFolder') &&
    viewSource.includes('editWatchFolder(row)') &&
    viewSource.includes('deleteWatchFolder(row)') &&
    viewSource.includes('createDocumentIntakeDeviceWatchFolder(deviceId, payload)') &&
    viewSource.includes('updateDocumentIntakeWatchFolder(deviceId, watchFolderForm.id, payload)') &&
    viewSource.includes('deleteDocumentIntakeWatchFolder(deviceId, row.id)') &&
    viewSource.includes('fetchDocumentIntakeDeviceWatchFolders(deviceId)') &&
    viewSource.includes('updateDocumentIntakeWatchFolderStatus(deviceId, row.id, nextEnabled)') &&
    viewSource.includes('toggleWatchFolderStatus(row)'),
  'DocumentIntakeCenter should create, edit, delete and enable/disable collector watch folders in a drawer.'
)
assert.ok(
  viewSource.includes('deviceStatusFilterOptions') && viewSource.includes('v-model="deviceFilters.status"'),
  'DocumentIntakeCenter should provide a dedicated device status filter.'
)
assert.ok(
  viewSource.includes('v-model="deviceFilters.user"') &&
    viewSource.includes('v-model="deviceFilters.serverBaseUrl"') &&
    viewSource.includes('v-model="deviceFilters.clientVersion"') &&
    viewSource.includes('v-model="deviceFilters.webviewVersion"') &&
    viewSource.includes('user: deviceFilters.user') &&
    viewSource.includes('serverBaseUrl: deviceFilters.serverBaseUrl') &&
    viewSource.includes('clientVersion: deviceFilters.clientVersion') &&
    viewSource.includes('webviewVersion: deviceFilters.webviewVersion'),
  'DocumentIntakeCenter should filter devices by default user/role, server URL, client version and WebView version.'
)
assert.ok(
  viewSource.includes('showAssetsForDevice') && viewSource.includes('showLogsForDevice'),
  'DocumentIntakeCenter should let operators jump from a device to its files and logs.'
)
assert.ok(
  viewSource.includes('fetchDocumentIntakeLogs') && viewSource.includes('logFilters.traceId'),
  'DocumentIntakeCenter should load client logs with trace_id and keyword filters.'
)
assert.ok(
  viewSource.includes('v-model="logFilters.eventType"') &&
    viewSource.includes('v-model="logFilters.sourceFileHash"') &&
    viewSource.includes('v-model="logFilters.sourceFolder"') &&
    viewSource.includes('v-model="logFilters.watchFolderSource"') &&
    viewSource.includes('eventType: logFilters.eventType') &&
    viewSource.includes('sourceFileHash: logFilters.sourceFileHash') &&
    viewSource.includes('sourceFolder: logFilters.sourceFolder') &&
    viewSource.includes('watchFolderSource: logFilters.watchFolderSource'),
  'DocumentIntakeCenter should filter client logs by event type, source file hash and watch folder source.'
)
assert.ok(
  viewSource.includes('logSourceFolderLabel(row)') &&
    viewSource.includes('watch(() => logFilters.watchFolderSource, reloadLogsFromFirstPage)'),
  'DocumentIntakeCenter should display and reactively filter client logs by watch folder source.'
)
assert.ok(
  viewSource.includes('v-model="logFilters.user"') &&
    viewSource.includes('v-model="logFilters.appModule"') &&
    viewSource.includes('v-model="logFilters.route"') &&
    viewSource.includes('v-model="logFilters.batchId"') &&
    viewSource.includes('user: logFilters.user') &&
    viewSource.includes('appModule: logFilters.appModule') &&
    viewSource.includes('route: logFilters.route') &&
    viewSource.includes('batchId: logFilters.batchId'),
  'DocumentIntakeCenter should filter client logs by user, module, page and import batch.'
)
assert.ok(
  viewSource.includes('deviceId: logFilters.deviceId') && viewSource.includes('clearLogDeviceFilter'),
  'DocumentIntakeCenter should filter client logs by collector device.'
)
assert.ok(
  viewSource.includes('showAssetForLog') && viewSource.includes('row.sourceFileHash'),
  'DocumentIntakeCenter should let operators jump from logs to source files by file hash.'
)
assert.ok(
  viewSource.includes('showEntryResultsForLog') && viewSource.includes('entryResultFilters.batchId'),
  'DocumentIntakeCenter should let operators jump from logs to entry results by import batch.'
)
assert.ok(
  viewSource.includes('logLevelFilterOptions') && viewSource.includes('v-model="logFilters.level"'),
  'DocumentIntakeCenter should provide a dedicated log level filter.'
)
assert.ok(
  viewSource.includes('fetchDocumentIntakeEntryResults') && viewSource.includes('entryResultFilters.status'),
  'DocumentIntakeCenter should load entry results with status filters.'
)
assert.ok(
  viewSource.includes('showEntryResultsForAsset') && viewSource.includes('entryResultFilters.assetId'),
  'DocumentIntakeCenter should let operators filter entry results from a source file row.'
)
assert.ok(
  viewSource.includes('clearEntryResultAssetFilter') && viewSource.includes('asset-filter-tag'),
  'DocumentIntakeCenter should show and clear the active source file filter.'
)
assert.ok(
  viewSource.includes('clearEntryResultBatchFilter') && viewSource.includes('导入批次'),
  'DocumentIntakeCenter should show and clear the active import batch filter.'
)
assert.ok(
  viewSource.includes('entryResultStatusFilterOptions') && viewSource.includes('v-model="entryResultFilters.status"'),
  'DocumentIntakeCenter should provide a dedicated entry result status filter.'
)
assert.ok(
  viewSource.includes('targetKindFilterOptions') && viewSource.includes('v-model="entryResultFilters.targetKind"'),
  'DocumentIntakeCenter should provide a dedicated target kind filter.'
)
assert.ok(
  viewSource.includes('v-model="entryResultFilters.duplicate"') &&
    viewSource.includes('duplicate: entryResultFilters.duplicate') &&
    viewSource.includes('v-model="entryResultFilters.user"') &&
    viewSource.includes('user: entryResultFilters.user') &&
    viewSource.includes('v-model="entryResultFilters.deviceId"') &&
    viewSource.includes('deviceId: entryResultFilters.deviceId') &&
    viewSource.includes('v-model="entryResultFilters.operatorSource"') &&
    viewSource.includes('operatorSource: entryResultFilters.operatorSource'),
  'DocumentIntakeCenter should filter entry results by duplicate status, source device, uploaded user/role and operator source.'
)
assert.ok(
  viewSource.includes('showEntryResultsForDevice') && viewSource.includes('clearEntryResultDeviceFilter'),
  'DocumentIntakeCenter should let operators jump from a device to its entry results.'
)
assert.ok(
  viewSource.includes('fetchDocumentIntakeEntryResultDetail') && viewSource.includes('entryResultDrawerVisible'),
  'DocumentIntakeCenter should load entry result details in a drawer.'
)
assert.ok(
  viewSource.includes('const relatedLogs = computed') &&
    viewSource.includes('entryResultDetail.value?.relatedLogs') &&
    viewSource.includes(':data="relatedLogs"') &&
    viewSource.includes('logLevelTagType(row.level)') &&
    viewSource.includes('prop="traceId"'),
  'DocumentIntakeCenter should show related import logs inside the entry result detail drawer.'
)
assert.ok(
  viewSource.includes('const businessCorrections = computed') &&
    viewSource.includes('entryResultDetail.value?.businessCorrections') &&
    viewSource.includes(':data="businessCorrections"') &&
    viewSource.includes('correctionValueLabel(row.oldValue)') &&
    viewSource.includes('recalculationStatusLabel(row.recalculationStatus)') &&
    viewSource.includes('row.affectsBusinessResult ?') &&
    viewSource.includes('prop="correctedAt"'),
  'DocumentIntakeCenter should show business correction records inside the entry result detail drawer.'
)
assert.ok(
  viewSource.includes("from '@/domain/document-intake-presentation-policy.js'") &&
    viewSource.includes('buildDocumentIntakeBusinessRecordUrl as businessRecordUrl') &&
    viewSource.includes('businessRecordUrl(row)') &&
    presentationPolicySource.includes("row?.businessRecordUrl || row?.business_record_url") &&
    viewSource.includes('openBusinessRecord(row)') &&
    viewSource.includes('copyBusinessRecordId(row)'),
  'DocumentIntakeCenter should prefer server-provided business record URLs and provide open/copy actions for entry result business records.'
)
assert.ok(
  presentationPolicySource.includes('/materials/inventory-ledger?recordId=') &&
    presentationPolicySource.includes('/materials/material/detail/') &&
    presentationPolicySource.includes('/purchase/document/') &&
    presentationPolicySource.includes('/apps/app/${encodeURIComponent(row.targetAppId)}/record/'),
  'DocumentIntakeCenter should map business links to known module record routes.'
)
assert.ok(
  viewSource.includes('navigator.clipboard?.writeText') &&
    viewSource.includes('document.execCommand') &&
    viewSource.includes('业务记录 ID 已复制'),
  'DocumentIntakeCenter should copy business record IDs with a WebView-compatible fallback.'
)
assert.ok(
  viewSource.includes('@row-dblclick="openEntryResultDetail"') && viewSource.includes('@click.stop="openEntryResultDetail(row)"'),
  'DocumentIntakeCenter should let operators open entry result details from the table.'
)

assert.equal(api.normalizeDuplicateFilter(true), 'true')
assert.equal(api.normalizeDuplicateFilter(false), 'false')
assert.equal(api.normalizeDuplicateFilter(''), '')

const duplicateUrl = api.buildDocumentIntakeAssetListUrl({ duplicate: true, q: '合同', status: 'uploaded', limit: 20, offset: 40 })
assert.equal(
  duplicateUrl,
  '/agent/document-intake/admin/assets?duplicate=true&q=%E5%90%88%E5%90%8C&status=uploaded&limit=20&offset=40',
  'duplicate=true should be encoded as an explicit API query parameter.'
)

const todayDuplicateUrl = api.buildDocumentIntakeAssetListUrl({ today: true, duplicate: true, limit: 20 })
assert.equal(
  todayDuplicateUrl,
  '/agent/document-intake/admin/assets?today=true&duplicate=true&limit=20&offset=0',
  'asset overview filters should encode today=true with duplicate=true.'
)

const nonDuplicateUrl = api.buildDocumentIntakeAssetListUrl({ duplicate: false })
assert.equal(
  nonDuplicateUrl,
  '/agent/document-intake/admin/assets?duplicate=false&limit=50&offset=0',
  'duplicate=false should be encoded as an explicit API query parameter.'
)

const traceableAssetUrl = api.buildDocumentIntakeAssetListUrl({
  deviceId: 'warehouse-pc-01',
  user: '仓库员',
  operatorSource: 'web_login_user',
  sourceFolder: 'C:\\EISCore\\Watch\\warehouse',
  watchFolderSource: 'remote_config',
  limit: 10
})
assert.equal(
  traceableAssetUrl,
  '/agent/document-intake/admin/assets?deviceId=warehouse-pc-01&user=%E4%BB%93%E5%BA%93%E5%91%98&operatorSource=web_login_user&sourceFolder=C%3A%5CEISCore%5CWatch%5Cwarehouse&watchFolderSource=remote_config&limit=10&offset=0',
  'asset list traceability filters should encode source device, uploaded user/role, operator source and watch folder source.'
)

const allUrl = api.buildDocumentIntakeAssetListUrl({ duplicate: '' })
assert.equal(
  allUrl,
  '/agent/document-intake/admin/assets?limit=50&offset=0',
  'empty duplicate filter should omit duplicate from the API query.'
)

assert.equal(
  api.buildDocumentIntakeOverviewUrl(),
  '/agent/document-intake/admin/overview',
  'overview endpoint URL should point to the admin document intake overview endpoint.'
)

assert.equal(
  api.buildDocumentIntakeDeviceStatusUrl('00000000-0000-4000-8000-000000000501'),
  '/agent/document-intake/admin/devices/00000000-0000-4000-8000-000000000501/status',
  'device status update endpoint should be encoded from the device id.'
)

assert.equal(
  api.buildDocumentIntakeDeviceResetBindingCodeUrl('00000000-0000-4000-8000-000000000501'),
  '/agent/document-intake/admin/devices/00000000-0000-4000-8000-000000000501/reset-binding-code',
  'device binding-code reset endpoint should be encoded from the device id.'
)

assert.equal(
  api.buildDocumentIntakeDeviceWatchFoldersUrl('00000000-0000-4000-8000-000000000501'),
  '/agent/document-intake/admin/devices/00000000-0000-4000-8000-000000000501/watch-folders',
  'device watch folder list endpoint should be encoded from the device id.'
)

assert.equal(
  api.buildDocumentIntakeWatchFolderStatusUrl(
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000601'
  ),
  '/agent/document-intake/admin/devices/00000000-0000-4000-8000-000000000501/watch-folders/00000000-0000-4000-8000-000000000601/status',
  'watch folder status endpoint should be encoded from the device and folder ids.'
)

assert.equal(
  api.buildDocumentIntakeWatchFolderUrl(
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000601'
  ),
  '/agent/document-intake/admin/devices/00000000-0000-4000-8000-000000000501/watch-folders/00000000-0000-4000-8000-000000000601',
  'watch folder detail endpoint should be encoded from the device and folder ids.'
)

const assetDeviceUrl = api.buildDocumentIntakeAssetListUrl({ deviceId: 'warehouse-pc-01', limit: 10 })
assert.equal(
  assetDeviceUrl,
  '/agent/document-intake/admin/assets?deviceId=warehouse-pc-01&limit=10&offset=0',
  'asset device filters should be encoded for the admin asset endpoint.'
)

const deviceUrl = api.buildDocumentIntakeDeviceListUrl({ status: 'active', q: '仓库', limit: 20, offset: 20 })
assert.equal(
  deviceUrl,
  '/agent/document-intake/admin/devices?q=%E4%BB%93%E5%BA%93&status=active&limit=20&offset=20',
  'device status and keyword filters should be encoded for the admin device endpoint.'
)

const traceableDeviceUrl = api.buildDocumentIntakeDeviceListUrl({
  status: 'active',
  q: '仓库',
  user: '仓库员',
  serverBaseUrl: 'nanpai',
  clientVersion: '0.1',
  webviewVersion: '121',
  limit: 20,
  offset: 20
})
assert.equal(
  traceableDeviceUrl,
  '/agent/document-intake/admin/devices?q=%E4%BB%93%E5%BA%93&status=active&user=%E4%BB%93%E5%BA%93%E5%91%98&serverBaseUrl=nanpai&clientVersion=0.1&webviewVersion=121&limit=20&offset=20',
  'device traceability filters should be encoded for default user/role, server URL, client version and WebView version.'
)

const logUrl = api.buildDocumentIntakeLogListUrl({
  level: 'error',
  traceId: 'trace-1',
  eventType: 'webview_navigation_failed',
  sourceFileHash: 'hash-1',
  sourceFolder: 'C:\\EISCore\\Watch\\warehouse',
  watchFolderSource: 'remote_config',
  user: 'operator',
  appModule: 'collector-desktop',
  route: '/document-intake',
  batchId: 'batch-1',
  q: 'WebView',
  deviceId: 'warehouse-pc-01',
  limit: 10,
  offset: 30
})
assert.equal(
  logUrl,
  '/agent/document-intake/admin/logs?q=WebView&level=error&traceId=trace-1&deviceId=warehouse-pc-01&batchId=batch-1&eventType=webview_navigation_failed&sourceFileHash=hash-1&sourceFolder=C%3A%5CEISCore%5CWatch%5Cwarehouse&watchFolderSource=remote_config&user=operator&appModule=collector-desktop&route=%2Fdocument-intake&limit=10&offset=30',
  'log list traceability filters should encode source file, watch folder, user, module, route and device filters.'
)

const entryResultUrl = api.buildDocumentIntakeEntryResultListUrl({ status: 'partial', targetKind: 'fixed_module_table', q: '采购', limit: 10, offset: 20 })
assert.equal(
  entryResultUrl,
  '/agent/document-intake/admin/entry-results?q=%E9%87%87%E8%B4%AD&status=partial&targetKind=fixed_module_table&limit=10&offset=20',
  'entry result filters should be encoded for the admin entry result endpoint.'
)

const entryResultAssetUrl = api.buildDocumentIntakeEntryResultListUrl({ assetId: '00000000-0000-4000-8000-000000000201', limit: 10 })
assert.equal(
  entryResultAssetUrl,
  '/agent/document-intake/admin/entry-results?assetId=00000000-0000-4000-8000-000000000201&limit=10&offset=0',
  'entry result source asset filters should be encoded for the admin entry result endpoint.'
)

const entryResultBatchUrl = api.buildDocumentIntakeEntryResultListUrl({ batchId: '00000000-0000-4000-8000-000000000301', limit: 10 })
assert.equal(
  entryResultBatchUrl,
  '/agent/document-intake/admin/entry-results?batchId=00000000-0000-4000-8000-000000000301&limit=10&offset=0',
  'entry result import batch filters should be encoded for the admin entry result endpoint.'
)

const entryResultTraceUrl = api.buildDocumentIntakeEntryResultListUrl({
  today: true,
  duplicate: true,
  deviceId: 'warehouse-pc-01',
  user: '仓库员',
  operatorSource: 'web_login_user',
  lowConfidence: true,
  status: 'partial',
  targetKind: 'fixed_module_table',
  q: '采购',
  limit: 10,
  offset: 20
})
assert.equal(
  entryResultTraceUrl,
  '/agent/document-intake/admin/entry-results?today=true&q=%E9%87%87%E8%B4%AD&status=partial&targetKind=fixed_module_table&duplicate=true&deviceId=warehouse-pc-01&user=%E4%BB%93%E5%BA%93%E5%91%98&operatorSource=web_login_user&lowConfidence=true&limit=10&offset=20',
  'entry result traceability filters should be encoded for today, duplicate status, source device, uploaded user/role, operator source and low confidence.'
)

const entryResultDetailUrl = api.buildDocumentIntakeEntryResultDetailUrl('00000000-0000-4000-8000-000000000101')
assert.equal(
  entryResultDetailUrl,
  '/agent/document-intake/admin/entry-results/00000000-0000-4000-8000-000000000101',
  'entry result detail id should be encoded into the admin detail endpoint.'
)

assert.deepEqual(
  api.deviceStatusFilterOptions.map((item) => item.value),
  ['', 'pending', 'active', 'offline', 'disabled'],
  'device status filter should cover all collector device lifecycle states.'
)

assert.deepEqual(
  api.logLevelFilterOptions.map((item) => item.value),
  ['', 'error', 'warn', 'info', 'debug'],
  'log level filter should cover the client log severity levels.'
)

assert.deepEqual(
  api.entryResultStatusFilterOptions.map((item) => item.value),
  ['', 'successful', 'planned', 'importing', 'imported', 'partial', 'failed', 'skipped_duplicate', 'archived_only'],
  'entry result status filter should cover the automatic import lifecycle states.'
)

assert.deepEqual(
  api.targetKindFilterOptions.map((item) => item.value),
  ['', 'fixed_module_table', 'data_app'],
  'target kind filter should cover fixed module and dynamic app targets.'
)

assert.deepEqual(
  api.operatorSourceFilterOptions.map((item) => item.value),
  ['', 'web_login_user', 'device_default_user'],
  'operator source filter should cover web login users and device defaults.'
)

assert.deepEqual(
  api.watchFolderSourceFilterOptions.map((item) => item.value),
  ['', 'local_settings', 'remote_config'],
  'watch folder source filter should cover local settings and remote config folders.'
)

console.log('PASS: document intake UI regression')
