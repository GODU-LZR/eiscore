// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'

const require = createRequire(import.meta.url)
const Module = require('node:module')

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eiscore-document-intake-'))
process.env.DOCUMENT_INTAKE_STORAGE_DIR = tmpRoot
process.env.DOCUMENT_INTAKE_MAX_UPLOAD_BYTES = 'not-a-number'
process.env.DOCUMENT_INTAKE_PG_POOL_MAX = 'also-not-a-number'
process.env.PGPORT = 'bad-port'

const state = {
  poolOptions: null,
  authorized: true,
  device: {
    id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    default_user_id: 'u_1',
    default_username: 'operator',
    default_role: 'warehouse',
    status: 'active',
    metadata: {}
  },
  duplicateRows: [],
  watchFolders: [],
  assetRows: [],
  deviceRows: [],
  logRows: [],
  entryResultRows: [],
  entryResultDetailRow: null,
  overviewRow: null,
  businessLinkRows: [],
  unmappedFieldRows: [],
  businessCorrectionRows: [],
  uploadSessions: new Map(),
  uploadChunks: new Map(),
  clientQueries: [],
  poolQueries: [],
  assetInsertParams: [],
  parseJobInserts: 0,
  connected: 0
}

class FakeClient {
  async query(sql, params = []) {
    state.clientQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (['begin', 'commit', 'rollback'].includes(normalized)) return { rows: [] }
    if (normalized.includes('select id, storage_path') && normalized.includes('from public.document_assets')) {
      return { rows: state.duplicateRows }
    }
    if (normalized.includes('insert into public.document_import_batches')) {
      return { rows: [{ id: 'batch-1', batch_no: 'DIB-TEST' }] }
    }
    if (normalized.includes('insert into public.document_assets')) {
      state.assetInsertParams.push(params)
      return { rows: [{ id: 'asset-1', status: params[12] || 'uploaded' }] }
    }
    if (normalized.includes('insert into public.document_parse_jobs')) {
      state.parseJobInserts += 1
      return { rows: [] }
    }
    if (normalized.includes('insert into public.document_upload_sessions')) {
      const existing = [...state.uploadSessions.values()].find((session) => session.device_id === params[0] && session.file_hash === params[1])
      const session = existing || {
        id: `00000000-0000-4000-8000-${String(state.uploadSessions.size + 1).padStart(12, '0')}`,
        device_id: params[0],
        file_hash: params[1]
      }
      Object.assign(session, {
        original_filename: params[2],
        mime_type: params[3],
        file_size: params[4],
        chunk_size: params[5],
        total_chunks: params[6],
        upload_source: params[7],
        status: session.status === 'completed' ? 'completed' : 'uploading',
        uploaded_chunks: state.uploadChunks.get(session.id)?.size || 0,
        metadata: params[8] || {}
      })
      state.uploadSessions.set(session.id, session)
      return { rows: [session] }
    }
    if (normalized.includes('select * from public.document_upload_sessions')) {
      const session = state.uploadSessions.get(params[0])
      return { rows: session && session.device_id === params[1] ? [session] : [] }
    }
    if (
      normalized.includes('select chunk_index, chunk_size, chunk_hash, storage_path') &&
      normalized.includes('from public.document_upload_chunks') &&
      normalized.includes('chunk_index = $2')
    ) {
      const chunks = state.uploadChunks.get(params[0]) || new Map()
      const chunk = chunks.get(params[1])
      return { rows: chunk ? [chunk] : [] }
    }
    if (normalized.includes('insert into public.document_upload_chunks')) {
      const [sessionId, chunkIndex, chunkSize, chunkHash, storagePath] = params
      if (!state.uploadChunks.has(sessionId)) state.uploadChunks.set(sessionId, new Map())
      state.uploadChunks.get(sessionId).set(chunkIndex, {
        session_id: sessionId,
        chunk_index: chunkIndex,
        chunk_size: chunkSize,
        chunk_hash: chunkHash,
        storage_path: storagePath
      })
      return { rows: [] }
    }
    if (normalized.includes('select count(*)::integer as count') && normalized.includes('from public.document_upload_chunks')) {
      return { rows: [{ count: state.uploadChunks.get(params[0])?.size || 0 }] }
    }
    if (normalized.includes('select chunk_index, chunk_size, chunk_hash, storage_path') && normalized.includes('from public.document_upload_chunks')) {
      let chunks = [...(state.uploadChunks.get(params[0]) || new Map()).values()]
      if (params.length > 1) chunks = chunks.filter((chunk) => chunk.chunk_index === params[1])
      return { rows: chunks.sort((a, b) => a.chunk_index - b.chunk_index) }
    }
    if (normalized.includes('select chunk_index') && normalized.includes('from public.document_upload_chunks')) {
      const chunks = [...(state.uploadChunks.get(params[0]) || new Map()).values()]
      return { rows: chunks.sort((a, b) => a.chunk_index - b.chunk_index).map((chunk) => ({ chunk_index: chunk.chunk_index })) }
    }
    if (normalized.includes('update public.document_upload_sessions')) {
      const session = state.uploadSessions.get(params[0])
      if (session) {
        if (normalized.includes('set uploaded_chunks = $2')) session.uploaded_chunks = params[1]
        if (normalized.includes('set status = $2')) {
          session.status = params[1]
          session.storage_path = params[2] || session.storage_path
        }
      }
      return { rows: [] }
    }
    if (normalized.includes('update public.collector_devices')) {
      return { rows: [{ ...state.device, status: 'active', last_seen_at: new Date().toISOString() }] }
    }
    throw new Error(`Unexpected client query: ${normalized}`)
  }

  release() {}
}

class FakePool {
  constructor(options) {
    state.poolOptions = options
  }

  async query(sql, params = []) {
    state.poolQueries.push({ sql, params })
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.includes('today_file_count') && normalized.includes('active_device_count')) {
      return {
        rows: [state.overviewRow || {
          today_file_count: 0,
          successful_import_count: 0,
          low_confidence_count: 0,
          unrecognized_count: 0,
          duplicate_file_count: 0,
          failed_count: 0,
          active_device_count: 0,
          offline_device_count: 0,
          low_confidence_threshold: '0.8',
          generated_at: '2026-06-16T00:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('select count(*)::integer as total') && normalized.includes('from public.collector_devices d')) {
      return { rows: [{ total: state.deviceRows.length }] }
    }
    if (normalized.includes('from public.collector_devices d') && normalized.includes('order by coalesce')) {
      return { rows: state.deviceRows }
    }
    if (normalized.includes('select count(*)::integer as total') && normalized.includes('from public.client_log_events e')) {
      return { rows: [{ total: state.logRows.length }] }
    }
    if (normalized.includes('from public.client_log_events e') && normalized.includes('order by e.created_at desc')) {
      return { rows: state.logRows }
    }
    if (normalized.includes('select count(*)::integer as total') && normalized.includes('from public.document_entry_plans p')) {
      return { rows: [{ total: state.entryResultRows.length }] }
    }
    if (
      normalized.includes('select p.id') &&
      normalized.includes('from public.document_entry_plans p') &&
      normalized.includes('order by coalesce(p.updated_at, p.created_at)')
    ) {
      return { rows: state.entryResultRows }
    }
    if (normalized.includes('from public.document_entry_plans p') && normalized.includes('where p.id = $1')) {
      return { rows: state.entryResultDetailRow ? [state.entryResultDetailRow] : [] }
    }
    if (normalized.includes('from public.document_business_links') && normalized.includes('where entry_plan_id = $1')) {
      return { rows: state.businessLinkRows }
    }
    if (normalized.includes('from public.document_unmapped_fields') && normalized.includes('where entry_plan_id = $1')) {
      return { rows: state.unmappedFieldRows }
    }
    if (normalized.includes('from public.ai_business_corrections c')) {
      return { rows: state.businessCorrectionRows }
    }
    if (normalized.includes('from public.collector_devices') && !normalized.includes('from public.document_assets a')) {
      return { rows: state.authorized ? [state.device] : [] }
    }
    if (normalized.includes('update public.collector_devices') && normalized.includes('set status = $2')) {
      return {
        rows: [{
          id: params[0],
          device_code: 'warehouse-pc-01',
          device_name: 'Warehouse PC 01',
          status: params[1],
          updated_at: '2026-06-16T14:00:00.000Z'
        }]
      }
    }
    if (normalized.includes('update public.collector_devices') && normalized.includes('binding_code_hash = $2')) {
      return {
        rows: [{
          id: params[0],
          device_code: 'warehouse-pc-01',
          device_name: 'Warehouse PC 01',
          status: 'pending',
          updated_at: '2026-06-16T14:05:00.000Z'
        }]
      }
    }
    if (normalized.includes('update public.collector_devices')) {
      return { rows: [{ ...state.device, status: 'active', last_seen_at: new Date().toISOString() }] }
    }
    if (normalized.includes('insert into public.collector_watch_folders')) {
      return {
        rows: [{
          id: '00000000-0000-4000-8000-000000000602',
          device_id: params[0],
          folder_path: params[1],
          folder_name: params[2],
          default_user_id: params[3],
          default_role: params[4],
          enabled: params[5],
          metadata: params[6] || {},
          created_at: '2026-06-16T14:20:00.000Z',
          updated_at: '2026-06-16T14:20:00.000Z'
        }]
      }
    }
    if (normalized.includes('update public.collector_watch_folders') && normalized.includes('folder_path = case')) {
      return {
        rows: [{
          id: params[0],
          device_id: params[1],
          folder_path: params[2] ? params[3] : 'D:\\EISCore\\Inbox',
          folder_name: params[4] ? params[5] : '仓库收单',
          default_user_id: params[6] ? params[7] : 'u_1',
          default_role: params[8] ? params[9] : '仓库员',
          enabled: params[10] ? params[11] : true,
          metadata: params[12] || {},
          created_at: '2026-06-16T08:00:00.000Z',
          updated_at: '2026-06-16T14:15:00.000Z'
        }]
      }
    }
    if (normalized.includes('update public.collector_watch_folders')) {
      return {
        rows: [{
          id: params[0],
          device_id: params[1],
          folder_path: 'D:\\EISCore\\Inbox',
          folder_name: '仓库收单',
          default_user_id: 'u_1',
          default_role: '仓库员',
          enabled: params[2],
          metadata: params[3] || {},
          created_at: '2026-06-16T08:00:00.000Z',
          updated_at: '2026-06-16T14:10:00.000Z'
        }]
      }
    }
    if (normalized.includes('delete from public.collector_watch_folders')) {
      return {
        rows: [{
          id: params[0],
          device_id: params[1],
          folder_path: 'D:\\EISCore\\Inbox',
          folder_name: '仓库收单',
          default_user_id: 'u_1',
          default_role: '仓库员',
          enabled: false,
          metadata: {},
          created_at: '2026-06-16T08:00:00.000Z',
          updated_at: '2026-06-16T14:15:00.000Z'
        }]
      }
    }
    if (normalized.includes('from public.collector_watch_folders')) {
      return { rows: state.watchFolders }
    }
    if (normalized.includes('select count(*)::integer as total') && normalized.includes('from public.document_assets a')) {
      return { rows: [{ total: state.assetRows.length }] }
    }
    if (normalized.includes('from public.document_assets a') && normalized.includes('left join public.collector_devices')) {
      return { rows: state.assetRows }
    }
    if (normalized.includes('insert into public.client_log_events')) {
      return { rows: [] }
    }
    throw new Error(`Unexpected pool query: ${normalized}`)
  }

  async connect() {
    state.connected += 1
    return new FakeClient()
  }
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') return { Pool: FakePool }
  return originalLoad.call(this, request, parent, isMain)
}

const modulePath = '../../realtime/document-intake.js'
delete require.cache[require.resolve(modulePath)]
const { createDocumentIntakeHandlers } = require(modulePath)
Module._load = originalLoad
const realtimeIndexSource = await fs.readFile(path.resolve(import.meta.dirname, '../../realtime/index.js'), 'utf8')
const { HTTP_ROUTE_MANIFEST } = require('../../realtime/http-router.js')

assert.equal(state.poolOptions.max, 5, 'invalid pool max env should fall back to 5')
assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')
const describeRoute = (entry) => [
  entry.method,
  entry.match,
  entry.match === 'pattern' ? entry.pattern.source : entry.path,
  entry.handler
]
const documentIntakeAdminRoutes = HTTP_ROUTE_MANIFEST
  .filter((entry) => entry.authorize === 'documentIntakeAdmin')
  .map(describeRoute)

assert.deepEqual(documentIntakeAdminRoutes, [
  ['GET', 'exact', '/document-intake/admin/overview', 'documentIntake.handleGetOverview'],
  ['GET', 'exact', '/document-intake/admin/assets', 'documentIntake.handleListAssets'],
  ['GET', 'exact', '/document-intake/admin/devices', 'documentIntake.handleListDevices'],
  ['GET', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders$/.source, 'documentIntake.handleListDeviceWatchFolders'],
  ['POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders$/.source, 'documentIntake.handleCreateWatchFolder'],
  ['PATCH', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+$/.source, 'documentIntake.handleUpdateWatchFolder'],
  ['DELETE', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+$/.source, 'documentIntake.handleDeleteWatchFolder'],
  ['POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+\/status$/.source, 'documentIntake.handleUpdateWatchFolderStatus'],
  ['POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/status$/.source, 'documentIntake.handleUpdateDeviceStatus'],
  ['POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/reset-binding-code$/.source, 'documentIntake.handleResetDeviceBindingCode'],
  ['GET', 'exact', '/document-intake/admin/logs', 'documentIntake.handleListLogs'],
  ['GET', 'exact', '/document-intake/admin/entry-results', 'documentIntake.handleListEntryResults'],
  ['GET', 'prefix', '/document-intake/admin/entry-results/', 'documentIntake.handleGetEntryResultDetail']
])
assert.match(realtimeIndexSource, /documentIntakeAdmin:\s*authorizeDocumentIntakeAdminRequest/)
assert.match(realtimeIndexSource, /documentIntake:\s*documentIntakeHandlers/)
assert.match(realtimeIndexSource, /const hasDocumentIntakeAdminAccess = /)
assert.match(realtimeIndexSource, /authorizeDocumentIntakeAdminRequest[\s\S]+hasHarnessTenantContext\(user\)/)
assert.match(realtimeIndexSource, /authorizeDocumentIntakeAdminRequest[\s\S]+hasDocumentIntakeAdminAccess\(user\)/)

function resetState() {
  state.authorized = true
  state.duplicateRows = []
  state.watchFolders = []
  state.assetRows = []
  state.deviceRows = []
  state.logRows = []
  state.entryResultRows = []
  state.entryResultDetailRow = null
  state.overviewRow = null
  state.businessLinkRows = []
  state.unmappedFieldRows = []
  state.businessCorrectionRows = []
  state.uploadSessions = new Map()
  state.uploadChunks = new Map()
  state.device.metadata = {}
  state.clientQueries = []
  state.poolQueries = []
  state.assetInsertParams = []
  state.parseJobInserts = 0
  state.connected = 0
}

function makeRequest(body = Buffer.alloc(0), headers = {}, url = '/') {
  const req = Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(String(body))])
  req.headers = headers
  req.url = url
  return req
}

async function collectBody(req, maxBytes = 1024 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('Payload too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  return text ? JSON.parse(text) : {}
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.payload = payload
}

const handlers = createDocumentIntakeHandlers({ sendJson, readJsonBody: collectBody })

async function call(handler, body, headers = {}, url = '/') {
  const res = {}
  await handler(makeRequest(body, headers, url), res)
  return res
}

async function callUrl(handler, url, headers = {}) {
  const res = {}
  await handler(makeRequest('', headers, url), res)
  return res
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function multipartBody(boundary, { metadata, metadataRaw, filename = 'upload.txt', fileContent = Buffer.from('hello'), fileField = 'file' } = {}) {
  const chunks = []
  const pushText = (text) => chunks.push(Buffer.from(text, 'utf8'))
  pushText(`--${boundary}\r\n`)
  pushText('Content-Disposition: form-data; name="metadata"\r\n')
  pushText('Content-Type: application/json\r\n\r\n')
  pushText(metadataRaw ?? JSON.stringify(metadata || {}))
  pushText(`\r\n--${boundary}\r\n`)
  pushText(`Content-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\n`)
  pushText('Content-Type: text/plain\r\n\r\n')
  chunks.push(fileContent)
  pushText(`\r\n--${boundary}--\r\n`)
  return Buffer.concat(chunks)
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(fullPath))
    if (entry.isFile()) files.push(fullPath)
  }
  return files
}

try {
  resetState()
  state.overviewRow = {
    today_file_count: 12,
    successful_import_count: 8,
    low_confidence_count: 2,
    unrecognized_count: 1,
    duplicate_file_count: 3,
    failed_count: 4,
    active_device_count: 5,
    offline_device_count: 6,
    low_confidence_threshold: '0.8',
    generated_at: '2026-06-16T13:00:00.000Z'
  }
  const overview = await callUrl(handlers.handleGetOverview, '/document-intake/admin/overview')
  assert.equal(overview.statusCode, 200, 'overview endpoint should return document intake summary metrics')
  assert.equal(overview.payload.overview.todayFileCount, 12)
  assert.equal(overview.payload.overview.successfulImportCount, 8)
  assert.equal(overview.payload.overview.lowConfidenceCount, 2)
  assert.equal(overview.payload.overview.unrecognizedCount, 1)
  assert.equal(overview.payload.overview.duplicateFileCount, 3)
  assert.equal(overview.payload.overview.failedCount, 4)
  assert.equal(overview.payload.overview.activeDeviceCount, 5)
  assert.equal(overview.payload.overview.offlineDeviceCount, 6)
  assert.equal(overview.payload.overview.lowConfidenceThreshold, 0.8)
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('date_trunc') && entry.sql.includes('today_file_count') && entry.sql.includes('successful_import_count')),
    'overview should aggregate today files, import results and device status in one query'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes("p.status in ('imported', 'partial'") && entry.sql.includes("a.status = 'duplicate' or a.duplicate_of_asset_id is not null")),
    'overview should count successful imports and duplicate files with the documented status rules'
  )

  resetState()
  state.assetRows = [{
    id: 'asset-today',
    batch_id: 'batch-today',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    original_filename: '今日采集.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    file_ext: '.xlsx',
    file_size: 1024,
    file_hash: 'e'.repeat(64),
    upload_source: 'watch_folder',
    status: 'uploaded',
    duplicate_of_asset_id: null,
    metadata: {},
    created_at: '2026-06-16T08:30:00.000Z',
    updated_at: '2026-06-16T08:31:00.000Z'
  }]
  const todayAssets = await callUrl(handlers.handleListAssets, '/document-intake/admin/assets?today=true&limit=20')
  assert.equal(todayAssets.statusCode, 200, 'asset list should support today overview filters')
  assert.equal(todayAssets.payload.assets[0].id, 'asset-today')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes("a.created_at >= date_trunc('day', now())")),
    'asset list today filter should constrain assets to the current day'
  )

  resetState()
  const missingFields = await call(
    handlers.handleBindDevice,
    JSON.stringify({ enterpriseCode: 'tenant001' }),
    { 'content-type': 'application/json' }
  )
  assert.equal(missingFields.statusCode, 400, 'bind should reject missing device/code fields')
  assert.equal(missingFields.payload.code, 'BIND_FIELDS_REQUIRED')
  assert.equal(state.connected, 0, 'bind validation should fail before opening a DB transaction')

  resetState()
  state.authorized = false
  const unauthorized = await call(handlers.handleHeartbeat, '{}', { authorization: 'Bearer bad-token' })
  assert.equal(unauthorized.statusCode, 401, 'heartbeat should require a valid device token')
  assert.equal(unauthorized.payload.code, 'UNAUTHORIZED_DEVICE')

  resetState()
  state.device.metadata = {
    remote_config: {
      version: 'cfg-v2',
      default_user_id: 'u_remote',
      default_username: 'remote-user',
      default_role: '远程仓库员',
      auto_start_enabled: true,
      heartbeat_interval_seconds: 45,
      watch_folders: [
        {
          folder_path: 'D:\\EISCore\\Inbox',
          folder_name: '仓库收单',
          default_user_id: 'u_folder',
          default_role: '仓库员',
          enabled: true
        }
      ],
      upload: {
        max_file_bytes: 10 * 1024 * 1024,
        chunk_size_bytes: 1024 * 1024,
        retry_interval_seconds: 20,
        max_retry_count: 7,
        allowed_extensions: ['.pdf', '.xlsx']
      },
      logs: {
        batch_size: 50,
        flush_interval_seconds: 12,
        retention_days: 15,
        high_priority_immediate: false
      },
      update: {
        enabled: true,
        manifest_url: 'https://example.test/eiscore-collector/update.json',
        check_interval_hours: 6,
        auto_install: false,
        installer_arguments: '/quiet /norestart'
      }
    }
  }
  const remoteConfig = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(remoteConfig.statusCode, 200, 'device config endpoint should return remote config')
  assert.equal(remoteConfig.payload.configVersion, 'cfg-v2')
  assert.equal(remoteConfig.payload.config.defaultUserId, 'u_remote')
  assert.equal(remoteConfig.payload.config.defaultUsername, 'remote-user')
  assert.equal(remoteConfig.payload.config.defaultRole, '远程仓库员')
  assert.equal(remoteConfig.payload.config.autoStartEnabled, true)
  assert.equal(remoteConfig.payload.config.heartbeatIntervalSeconds, 45)
  assert.equal(remoteConfig.payload.config.watchFolders[0].folderPath, 'D:\\EISCore\\Inbox')
  assert.equal(remoteConfig.payload.config.upload.maxFileBytes, 10 * 1024 * 1024)
  assert.equal(remoteConfig.payload.config.upload.chunkSizeBytes, 1024 * 1024)
  assert.deepEqual(remoteConfig.payload.config.upload.allowedExtensions, ['.pdf', '.xlsx'])
  assert.equal(remoteConfig.payload.config.logs.batchSize, 50)
  assert.equal(remoteConfig.payload.config.logs.highPriorityImmediate, false)
  assert.equal(remoteConfig.payload.config.update.enabled, true)
  assert.equal(remoteConfig.payload.config.update.manifestUrl, 'https://example.test/eiscore-collector/update.json')
  assert.equal(remoteConfig.payload.config.update.checkIntervalHours, 6)
  assert.equal(remoteConfig.payload.config.update.autoInstall, false)
  assert.equal(remoteConfig.payload.config.update.installerArguments, '/quiet /norestart')
  assert.equal(remoteConfig.payload.device.deviceTokenHash, undefined, 'device config should not leak token hashes')

  resetState()
  state.device.metadata = {
    remote_config: {
      autoStartEnabled: 'false',
      logs: { highPriorityImmediate: false }
    }
  }
  const camelBooleanConfig = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(camelBooleanConfig.statusCode, 200, 'device config should accept camelCase boolean flags')
  assert.equal(camelBooleanConfig.payload.config.autoStartEnabled, false)
  assert.equal(camelBooleanConfig.payload.config.logs.highPriorityImmediate, false)

  resetState()
  state.watchFolders = [{
    folder_path: 'E:\\EISCore\\DefaultInbox',
    folder_name: '默认收单',
    default_user_id: 'u_table',
    default_role: '表配置角色',
    enabled: true
  }]
  const defaultConfig = await call(handlers.handleGetDeviceConfig, '', { authorization: 'Bearer good-token' })
  assert.equal(defaultConfig.statusCode, 200, 'device config endpoint should work without remote metadata')
  assert.equal(defaultConfig.payload.configVersion, 'default')
  assert.equal(defaultConfig.payload.config.defaultUserId, 'u_1')
  assert.equal(defaultConfig.payload.config.watchFolders.length, 1)
  assert.equal(defaultConfig.payload.config.watchFolders[0].folderPath, 'E:\\EISCore\\DefaultInbox')
  assert.equal(defaultConfig.payload.config.watchFolders[0].defaultUserId, 'u_table')
  assert.equal(defaultConfig.payload.config.upload.maxFileBytes, 256 * 1024 * 1024)

  resetState()
  state.watchFolders = [{ folder_path: 'F:\\HeartbeatInbox', folder_name: '心跳目录', enabled: true }]
  const heartbeatWithConfig = await call(
    handlers.handleHeartbeat,
    JSON.stringify({ clientVersion: '1.2.3' }),
    { authorization: 'Bearer good-token' }
  )
  assert.equal(
    heartbeatWithConfig.statusCode,
    200,
    `heartbeat should still succeed: ${JSON.stringify(heartbeatWithConfig.payload)}`
  )
  assert.equal(heartbeatWithConfig.payload.config.watchFolders[0].folderPath, 'F:\\HeartbeatInbox')

  resetState()
  state.assetRows = [{
    id: 'asset-duplicate',
    batch_id: 'batch-1',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    original_filename: 'duplicate.pdf',
    mime_type: 'application/pdf',
    file_ext: '.pdf',
    file_size: 1024,
    file_hash: 'a'.repeat(64),
    upload_source: 'web_drag_drop',
    status: 'duplicate',
    duplicate_of_asset_id: 'asset-original',
    target_module: 'purchase',
    target_document_type: '采购入库单',
    target_kind: 'fixed_module_table',
    app_name: '',
    target_schema: 'public',
    target_table: 'purchase_receipts',
    entry_status: 'imported',
    document_count: 1,
    line_count: 3,
    confidence: '0.9100',
    business_link_count: 2,
    metadata: {
      uploaded_by_role: '仓库员',
      source_folder: 'C:\\EISCore\\Watch\\warehouse',
      watch_folder_source: 'remote_config'
    },
    created_at: '2026-06-16T08:00:00.000Z',
    updated_at: '2026-06-16T08:01:00.000Z'
  }]
  const duplicateAssets = await callUrl(handlers.handleListAssets, '/document-intake/admin/assets?duplicate=true&limit=20')
  assert.equal(duplicateAssets.statusCode, 200, 'asset list should support duplicate=true')
  assert.equal(duplicateAssets.payload.assets.length, 1)
  assert.equal(duplicateAssets.payload.assets[0].duplicate, true)
  assert.equal(duplicateAssets.payload.assets[0].uploadedByRole, '仓库员')
  assert.equal(duplicateAssets.payload.assets[0].targetDocumentType, '采购入库单')
  assert.equal(duplicateAssets.payload.assets[0].targetTable, 'purchase_receipts')
  assert.equal(duplicateAssets.payload.assets[0].generatedDocumentCount, 2)
  assert.equal(duplicateAssets.payload.assets[0].confidence, 0.91)
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes("a.status = 'duplicate' or a.duplicate_of_asset_id is not null")),
    'duplicate=true should match duplicate status or duplicate source id'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('left join lateral') && entry.sql.includes('from public.document_entry_plans p') && entry.sql.includes('business_link_count')),
    'asset list should include the latest entry summary for target business, generated count, and confidence'
  )

  resetState()
  state.assetRows = [{
    id: 'asset-normal',
    batch_id: 'batch-2',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_2',
    uploaded_by_username: 'reviewer',
    operator_source: 'device_default_user',
    original_filename: 'normal.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    file_ext: '.xlsx',
    file_size: 2048,
    file_hash: 'b'.repeat(64),
    upload_source: 'watch_folder',
    status: 'uploaded',
    duplicate_of_asset_id: null,
    metadata: {},
    created_at: '2026-06-16T09:00:00.000Z',
    updated_at: '2026-06-16T09:01:00.000Z'
  }]
  const nonDuplicateAssets = await callUrl(handlers.handleListAssets, '/document-intake/admin/assets?duplicate=false&q=normal')
  assert.equal(nonDuplicateAssets.statusCode, 200, 'asset list should support duplicate=false')
  assert.equal(nonDuplicateAssets.payload.assets[0].duplicate, false)
  assert.equal(nonDuplicateAssets.payload.assets[0].originalFilename, 'normal.xlsx')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes("a.status <> 'duplicate' and a.duplicate_of_asset_id is null")),
    'duplicate=false should exclude duplicate status and duplicate source id'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('left join public.collector_devices'))?.params,
    ['%normal%', 50, 0],
    'keyword filter should keep limit and offset parameters stable'
  )

  resetState()
  state.assetRows = [{
    id: 'asset-by-device',
    batch_id: 'batch-device',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'watch_folder',
    original_filename: 'device-source.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    file_ext: '.xlsx',
    file_size: 4096,
    file_hash: 'c'.repeat(64),
    upload_source: 'watch_folder',
    status: 'uploaded',
    duplicate_of_asset_id: null,
    metadata: {
      uploaded_by_role: '仓库员',
      source_folder: 'C:\\EISCore\\Watch\\warehouse',
      watch_folder_source: 'remote_config'
    },
    created_at: '2026-06-16T09:30:00.000Z',
    updated_at: '2026-06-16T09:31:00.000Z'
  }]
  const deviceAssets = await callUrl(handlers.handleListAssets, '/document-intake/admin/assets?deviceId=warehouse-pc-01&limit=10')
  assert.equal(deviceAssets.statusCode, 200, 'asset list should support device filters')
  assert.equal(deviceAssets.payload.assets[0].deviceCode, 'warehouse-pc-01')
  assert.equal(deviceAssets.payload.assets[0].originalFilename, 'device-source.xlsx')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.document_assets a') && entry.sql.includes('a.device_id::text = $1')),
    'asset list should filter by device id or code'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.collector_devices fd') && entry.sql.includes('fd.device_code = $1')),
    'asset list should allow filtering by collector device code'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by a.created_at desc'))?.params,
    ['warehouse-pc-01', 10, 0],
    'asset device filter should keep device, limit and offset parameters stable'
  )

  resetState()
  state.assetRows = [{
    id: 'asset-traceable',
    batch_id: 'batch-traceable',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    original_filename: 'traceable-source.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    file_ext: '.xlsx',
    file_size: 4096,
    file_hash: 'd'.repeat(64),
    upload_source: 'web_drag_drop',
    status: 'uploaded',
    duplicate_of_asset_id: null,
    metadata: {
      uploaded_by_role: '仓库员',
      source_folder: 'C:\\EISCore\\Watch\\warehouse',
      watch_folder_source: 'remote_config'
    },
    created_at: '2026-06-16T09:40:00.000Z',
    updated_at: '2026-06-16T09:41:00.000Z'
  }]
  const traceableAssets = await callUrl(
    handlers.handleListAssets,
    '/document-intake/admin/assets?user=%E4%BB%93%E5%BA%93%E5%91%98&operatorSource=web_login_user&sourceFolder=warehouse&watchFolderSource=remote_config&limit=10'
  )
  assert.equal(traceableAssets.statusCode, 200, 'asset list should support uploaded user/role, operator source and watch folder filters')
  assert.equal(traceableAssets.payload.assets[0].uploadedByRole, '仓库员')
  assert.equal(traceableAssets.payload.assets[0].operatorSource, 'web_login_user')
  assert.equal(traceableAssets.payload.assets[0].sourceFolder, 'C:\\EISCore\\Watch\\warehouse')
  assert.equal(traceableAssets.payload.assets[0].watchFolderSource, 'remote_config')
  assert.ok(
    state.poolQueries.some((entry) =>
      entry.sql.includes('a.uploaded_by_user_id ilike $1') &&
      entry.sql.includes('a.uploaded_by_username ilike $1') &&
      entry.sql.includes("coalesce(a.metadata->>'uploaded_by_role', '') ilike $1") &&
      entry.sql.includes('a.operator_source = $2') &&
      entry.sql.includes("coalesce(a.metadata->>'source_folder', '') ilike $3") &&
      entry.sql.includes("coalesce(a.metadata->>'watch_folder_source', '') = $4")
    ),
    'asset list should filter by uploaded user id/name/role, operator source and watch folder source'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by a.created_at desc'))?.params,
    ['%仓库员%', 'web_login_user', '%warehouse%', 'remote_config', 10, 0],
    'asset traceability filters should keep user, source, folder, limit and offset parameters stable'
  )

  resetState()
  const badDuplicateFilter = await callUrl(handlers.handleListAssets, '/document-intake/admin/assets?duplicate=maybe')
  assert.equal(badDuplicateFilter.statusCode, 400, 'asset list should reject invalid duplicate values')
  assert.equal(badDuplicateFilter.payload.code, 'BAD_QUERY')
  assert.equal(state.poolQueries.length, 0, 'invalid duplicate filter should fail before querying')

  resetState()
  state.deviceRows = [{
    id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    enterprise_id: 'tenant001',
    department_id: 'warehouse',
    default_user_id: 'u_1',
    default_username: 'operator',
    default_role: '仓库员',
    server_base_url: 'https://nanpai.eissys.top',
    client_version: '0.1.0',
    webview_version: '121.0',
    status: 'active',
    last_seen_at: '2026-06-16T10:00:00.000Z',
    metadata: { windows_username: 'LAPTOP\\Twist' },
    created_at: '2026-06-16T09:00:00.000Z',
    updated_at: '2026-06-16T10:00:00.000Z'
  }]
  const activeDevices = await callUrl(handlers.handleListDevices, '/document-intake/admin/devices?status=active&q=warehouse&limit=20')
  assert.equal(activeDevices.statusCode, 200, 'device list should support status and keyword filters')
  assert.equal(activeDevices.payload.devices.length, 1)
  assert.equal(activeDevices.payload.devices[0].deviceCode, 'warehouse-pc-01')
  assert.equal(activeDevices.payload.devices[0].defaultRole, '仓库员')
  assert.equal(activeDevices.payload.devices[0].serverBaseUrl, 'https://nanpai.eissys.top')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.collector_devices d') && entry.sql.includes('d.status = $1')),
    'device list should filter by collector device status'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by coalesce'))?.params,
    ['active', '%warehouse%', 20, 0],
    'device list should keep status, keyword, limit and offset parameters stable'
  )

  resetState()
  state.deviceRows = [{
    id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    enterprise_id: 'tenant001',
    department_id: 'warehouse',
    default_user_id: 'u_1',
    default_username: 'operator',
    default_role: '仓库员',
    server_base_url: 'https://nanpai.eissys.top',
    client_version: '0.1.0',
    webview_version: '121.0',
    status: 'active',
    last_seen_at: '2026-06-16T10:00:00.000Z',
    metadata: { windows_username: 'LAPTOP\\Twist' },
    created_at: '2026-06-16T09:00:00.000Z',
    updated_at: '2026-06-16T10:00:00.000Z'
  }]
  const traceableDevices = await callUrl(
    handlers.handleListDevices,
    '/document-intake/admin/devices?status=active&user=%E4%BB%93%E5%BA%93%E5%91%98&serverBaseUrl=nanpai&clientVersion=0.1&webviewVersion=121&limit=20'
  )
  assert.equal(traceableDevices.statusCode, 200, 'device list should support user, server and version filters')
  assert.equal(traceableDevices.payload.devices[0].defaultRole, '仓库员')
  assert.equal(traceableDevices.payload.devices[0].clientVersion, '0.1.0')
  assert.equal(traceableDevices.payload.devices[0].webviewVersion, '121.0')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('d.default_user_id ilike $2') && entry.sql.includes('d.default_username ilike $2') && entry.sql.includes('d.default_role ilike $2')),
    'device list should filter by default user id, username or role'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('d.server_base_url ilike $3')),
    'device list should filter by server base URL'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('d.client_version ilike $4')),
    'device list should filter by client version'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('d.webview_version ilike $5')),
    'device list should filter by WebView version'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by coalesce'))?.params,
    ['active', '%仓库员%', '%nanpai%', '%0.1%', '%121%', 20, 0],
    'device list traceability filters should keep status, user, server, versions, limit and offset parameters stable'
  )

  resetState()
  const adminDeviceId = '00000000-0000-4000-8000-000000000501'
  const disableDevice = await call(
    handlers.handleUpdateDeviceStatus,
    JSON.stringify({ status: 'disabled', reason: '现场暂停使用' }),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/status`
  )
  assert.equal(disableDevice.statusCode, 200, 'admin should be able to disable collector devices')
  assert.equal(disableDevice.payload.device.status, 'disabled')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('set status = $2') && entry.params[2]?.admin_status_updated_at),
    'device status updates should write the status and trace metadata'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('set status = $2'))?.params.slice(0, 2),
    [adminDeviceId, 'disabled'],
    'device status update should keep device id and next status parameters stable'
  )

  resetState()
  const invalidDeviceStatus = await call(
    handlers.handleUpdateDeviceStatus,
    JSON.stringify({ status: 'offline' }),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/status`
  )
  assert.equal(invalidDeviceStatus.statusCode, 400, 'device status updates should only allow active or disabled')
  assert.equal(invalidDeviceStatus.payload.code, 'DEVICE_STATUS_INVALID')
  assert.equal(state.poolQueries.length, 0, 'invalid device status should fail before querying')

  resetState()
  const resetBindingCode = await call(
    handlers.handleResetDeviceBindingCode,
    '',
    {},
    `/document-intake/admin/devices/${adminDeviceId}/reset-binding-code`
  )
  assert.equal(resetBindingCode.statusCode, 200, 'admin should be able to reset collector device binding codes')
  assert.equal(resetBindingCode.payload.device.status, 'pending')
  assert.match(resetBindingCode.payload.bindingCode, /^[a-f0-9]{24}$/)
  const resetQuery = state.poolQueries.find((entry) => entry.sql.includes('binding_code_hash = $2'))
  assert.ok(resetQuery, 'reset binding code should update binding_code_hash')
  assert.equal(resetQuery.params[0], adminDeviceId)
  assert.equal(resetQuery.params[1].length, 64)
  assert.notEqual(resetQuery.params[1], resetBindingCode.payload.bindingCode, 'reset should store only the code hash')
  assert.ok(
    resetQuery.sql.includes('device_token_hash = null') && resetQuery.sql.includes("status = 'pending'"),
    'reset binding code should invalidate old tokens and require re-binding'
  )

  resetState()
  const watchFolderId = '00000000-0000-4000-8000-000000000601'
  state.watchFolders = [{
    id: watchFolderId,
    device_id: adminDeviceId,
    folder_path: 'D:\\EISCore\\Inbox',
    folder_name: '仓库收单',
    default_user_id: 'u_1',
    default_role: '仓库员',
    enabled: true,
    metadata: {},
    created_at: '2026-06-16T08:00:00.000Z',
    updated_at: '2026-06-16T08:05:00.000Z'
  }]
  const watchFolderList = await callUrl(
    handlers.handleListDeviceWatchFolders,
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders`
  )
  assert.equal(watchFolderList.statusCode, 200, 'admin should be able to list device watch folders')
  assert.equal(watchFolderList.payload.watchFolders.length, 1)
  assert.equal(watchFolderList.payload.watchFolders[0].folderPath, 'D:\\EISCore\\Inbox')
  assert.equal(watchFolderList.payload.watchFolders[0].defaultRole, '仓库员')
  assert.equal(watchFolderList.payload.watchFolders[0].enabled, true)
  const watchFolderListQuery = state.poolQueries.find((entry) => entry.sql.includes('from public.collector_watch_folders'))
  assert.ok(watchFolderListQuery, 'watch folder list should query collector_watch_folders')
  assert.equal(watchFolderListQuery.params[0], adminDeviceId)
  assert.ok(
    !watchFolderListQuery.sql.includes('enabled is true'),
    'admin watch folder list should include disabled folders for management'
  )

  resetState()
  const disableWatchFolder = await call(
    handlers.handleUpdateWatchFolderStatus,
    JSON.stringify({ enabled: false }),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders/${watchFolderId}/status`
  )
  assert.equal(disableWatchFolder.statusCode, 200, 'admin should be able to disable a watch folder')
  assert.equal(disableWatchFolder.payload.watchFolder.enabled, false)
  const watchFolderUpdateQuery = state.poolQueries.find((entry) => entry.sql.includes('update public.collector_watch_folders'))
  assert.ok(watchFolderUpdateQuery, 'watch folder status update should update collector_watch_folders')
  assert.deepEqual(
    watchFolderUpdateQuery.params.slice(0, 3),
    [watchFolderId, adminDeviceId, false],
    'watch folder status update should keep folder id, device id and enabled parameters stable'
  )
  assert.ok(
    watchFolderUpdateQuery.params[3]?.admin_enabled_updated_at,
    'watch folder status updates should write trace metadata'
  )

  resetState()
  const invalidWatchFolderStatus = await call(
    handlers.handleUpdateWatchFolderStatus,
    JSON.stringify({ enabled: 'maybe' }),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders/${watchFolderId}/status`
  )
  assert.equal(invalidWatchFolderStatus.statusCode, 400, 'watch folder status updates should require a boolean enabled value')
  assert.equal(invalidWatchFolderStatus.payload.code, 'WATCH_FOLDER_ENABLED_REQUIRED')
  assert.equal(state.poolQueries.length, 0, 'invalid watch folder enabled value should fail before querying')

  resetState()
  const createdWatchFolder = await call(
    handlers.handleCreateWatchFolder,
    JSON.stringify({
      folderPath: 'E:\\EISCore\\Purchase',
      folderName: '采购收单',
      defaultUserId: 'u_purchase',
      defaultRole: '采购员',
      enabled: true
    }),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders`
  )
  assert.equal(createdWatchFolder.statusCode, 201, 'admin should be able to create watch folders')
  assert.equal(createdWatchFolder.payload.watchFolder.folderPath, 'E:\\EISCore\\Purchase')
  assert.equal(createdWatchFolder.payload.watchFolder.defaultRole, '采购员')
  const createWatchFolderQuery = state.poolQueries.find((entry) => entry.sql.includes('insert into public.collector_watch_folders'))
  assert.ok(createWatchFolderQuery, 'watch folder create should insert into collector_watch_folders')
  assert.deepEqual(
    createWatchFolderQuery.params.slice(0, 6),
    [adminDeviceId, 'E:\\EISCore\\Purchase', '采购收单', 'u_purchase', '采购员', true],
    'watch folder create should keep device, path, name, owner and enabled parameters stable'
  )
  assert.ok(
    createWatchFolderQuery.params[6]?.admin_created_at,
    'watch folder create should write trace metadata'
  )

  resetState()
  state.watchFolders = [{ id: watchFolderId }]
  const duplicateWatchFolder = await call(
    handlers.handleCreateWatchFolder,
    JSON.stringify({ folderPath: 'D:\\EISCore\\Inbox' }),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders`
  )
  assert.equal(duplicateWatchFolder.statusCode, 409, 'watch folder create should reject duplicate paths on the same device')
  assert.equal(duplicateWatchFolder.payload.code, 'WATCH_FOLDER_DUPLICATE')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('lower(folder_path) = lower($2)')),
    'watch folder create should check duplicate paths case-insensitively before insert'
  )

  resetState()
  const updatedWatchFolder = await call(
    handlers.handleUpdateWatchFolder,
    JSON.stringify({
      folderPath: 'E:\\EISCore\\Purchase',
      folderName: '采购收单',
      defaultUserId: 'u_purchase',
      defaultRole: '采购员',
      enabled: false
    }),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders/${watchFolderId}`
  )
  assert.equal(updatedWatchFolder.statusCode, 200, 'admin should be able to edit watch folder defaults')
  assert.equal(updatedWatchFolder.payload.watchFolder.folderName, '采购收单')
  assert.equal(updatedWatchFolder.payload.watchFolder.defaultUserId, 'u_purchase')
  assert.equal(updatedWatchFolder.payload.watchFolder.enabled, false)
  const editWatchFolderQuery = state.poolQueries.find((entry) => entry.sql.includes('folder_path = case'))
  assert.ok(editWatchFolderQuery, 'watch folder edit should update collector_watch_folders')
  assert.deepEqual(
    editWatchFolderQuery.params.slice(0, 12),
    [watchFolderId, adminDeviceId, true, 'E:\\EISCore\\Purchase', true, '采购收单', true, 'u_purchase', true, '采购员', true, false],
    'watch folder edit should keep patch flags and field values stable'
  )
  assert.ok(editWatchFolderQuery.params[12]?.admin_updated_at, 'watch folder edit should write trace metadata')

  resetState()
  const emptyWatchFolderPatch = await call(
    handlers.handleUpdateWatchFolder,
    JSON.stringify({}),
    { 'content-type': 'application/json' },
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders/${watchFolderId}`
  )
  assert.equal(emptyWatchFolderPatch.statusCode, 400, 'empty watch folder patches should be rejected')
  assert.equal(emptyWatchFolderPatch.payload.code, 'WATCH_FOLDER_PATCH_EMPTY')
  assert.equal(state.poolQueries.length, 0, 'empty watch folder patches should fail before querying')

  resetState()
  const deletedWatchFolder = await callUrl(
    handlers.handleDeleteWatchFolder,
    `/document-intake/admin/devices/${adminDeviceId}/watch-folders/${watchFolderId}`
  )
  assert.equal(deletedWatchFolder.statusCode, 200, 'admin should be able to delete watch folders')
  assert.equal(deletedWatchFolder.payload.watchFolder.id, watchFolderId)
  const deleteWatchFolderQuery = state.poolQueries.find((entry) => entry.sql.includes('delete from public.collector_watch_folders'))
  assert.ok(deleteWatchFolderQuery, 'watch folder delete should remove from collector_watch_folders')
  assert.deepEqual(
    deleteWatchFolderQuery.params,
    [watchFolderId, adminDeviceId],
    'watch folder delete should keep folder id and device id parameters stable'
  )

  resetState()
  state.logRows = [{
    id: 'log-1',
    level: 'error',
    event_type: 'webview_navigation_failed',
    message: 'WebView navigation failed for intake shell',
    stack: 'Error: network timeout',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    user_id: 'u_1',
    username: 'operator',
    role: '仓库员',
    app_module: 'collector-desktop',
    route: '/document-intake',
    url: 'https://nanpai.eissys.top/document-intake',
    request_url: 'https://nanpai.eissys.top/agent/document-intake/assets/upload',
    status_code: 502,
    client_session_id: 'session-1',
    trace_id: 'trace-1',
    ai_import_batch_id: 'batch-1',
    source_file_hash: 'hash-1',
    app_version: '0.1.0',
    webview_version: '120',
    metadata: {
      redacted: true,
      source_folder: 'C:\\EISCore\\Watch\\warehouse',
      watch_folder_source: 'remote_config'
    },
    created_at: '2026-06-16T11:00:00.000Z'
  }]
  const logList = await callUrl(handlers.handleListLogs, '/document-intake/admin/logs?level=error&traceId=trace-1&eventType=webview_navigation_failed&user=operator&appModule=collector&route=document-intake&batchId=batch-1&sourceFileHash=hash-1&sourceFolder=warehouse&watchFolderSource=remote_config&q=webview&limit=10')
  assert.equal(logList.statusCode, 200, 'log list should support all traceability filters')
  assert.equal(logList.payload.logs.length, 1)
  assert.equal(logList.payload.logs[0].eventType, 'webview_navigation_failed')
  assert.equal(logList.payload.logs[0].deviceCode, 'warehouse-pc-01')
  assert.equal(logList.payload.logs[0].statusCode, 502)
  assert.equal(logList.payload.logs[0].traceId, 'trace-1')
  assert.equal(logList.payload.logs[0].aiImportBatchId, 'batch-1')
  assert.equal(logList.payload.logs[0].sourceFileHash, 'hash-1')
  assert.equal(logList.payload.logs[0].sourceFolder, 'C:\\EISCore\\Watch\\warehouse')
  assert.equal(logList.payload.logs[0].watchFolderSource, 'remote_config')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.client_log_events e') && entry.sql.includes('lower(e.level) = $1')),
    'log list should filter by normalized log level'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('e.event_type = $2')),
    'log list should filter by event type'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('e.user_id ilike $3') && entry.sql.includes('e.username ilike $3') && entry.sql.includes('e.role ilike $3')),
    'log list should filter by user id, username or role'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('e.app_module ilike $4')),
    'log list should filter by app module'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('e.route ilike $5') && entry.sql.includes('e.url ilike $5') && entry.sql.includes('e.request_url ilike $5')),
    'log list should filter by page route, page URL or request URL'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('e.trace_id = $6')),
    'log list should filter by trace_id'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('e.ai_import_batch_id::text = $7')),
    'log list should filter by import batch id'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('e.source_file_hash ilike $8')),
    'log list should filter by source file hash'
  )
  assert.ok(
    state.poolQueries.some((entry) =>
      entry.sql.includes("coalesce(e.metadata->>'source_folder', '') ilike $9") &&
      entry.sql.includes("coalesce(e.metadata->>'watch_folder_source', '') = $10")
    ),
    'log list should filter by watch folder path and source'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by e.created_at desc'))?.params,
    ['error', 'webview_navigation_failed', '%operator%', '%collector%', '%document-intake%', 'trace-1', 'batch-1', '%hash-1%', '%warehouse%', 'remote_config', '%webview%', 10, 0],
    'log list should keep all traceability, watch folder, keyword, limit and offset parameters stable'
  )

  resetState()
  state.logRows = [{
    id: 'log-device',
    level: 'warn',
    event_type: 'watch_folder_retry',
    message: 'watch folder retry for warehouse pc',
    stack: '',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    user_id: 'u_1',
    username: 'operator',
    role: '仓库员',
    app_module: 'collector-desktop',
    route: '',
    url: '',
    request_url: '',
    status_code: null,
    client_session_id: 'session-device',
    trace_id: 'trace-device',
    ai_import_batch_id: null,
    source_file_hash: '',
    app_version: '0.1.0',
    webview_version: '120',
    metadata: {},
    created_at: '2026-06-16T11:05:00.000Z'
  }]
  const deviceLogs = await callUrl(handlers.handleListLogs, '/document-intake/admin/logs?deviceId=warehouse-pc-01&limit=10')
  assert.equal(deviceLogs.statusCode, 200, 'log list should support device filters')
  assert.equal(deviceLogs.payload.logs[0].deviceCode, 'warehouse-pc-01')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.client_log_events e') && entry.sql.includes('e.device_id::text = $1 or d.device_code = $1')),
    'log list should filter by device id or code'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by e.created_at desc'))?.params,
    ['warehouse-pc-01', 10, 0],
    'log device filter should keep device, limit and offset parameters stable'
  )

  resetState()
  state.entryResultRows = [{
    id: 'plan-1',
    asset_id: 'asset-1',
    batch_id: 'batch-1',
    target_module: 'materials',
    target_document_type: '采购入库单',
    target_kind: 'fixed_module_table',
    app_id: null,
    app_name: '',
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    mode: 'auto_import',
    document_count: 1,
    line_count: 3,
    confidence: '0.8600',
    reason: '采购入库资料',
    status: 'partial',
    metadata: {
      imported_at: '2026-06-16T11:30:00.000Z',
      imported_count: 2,
      rejected_count: 1,
      target_record_ids: ['txn-1', 'txn-2']
    },
    created_at: '2026-06-16T11:10:00.000Z',
    updated_at: '2026-06-16T11:30:00.000Z',
    original_filename: '采购入库单.xlsx',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    asset_status: 'partial_imported',
    duplicate_of_asset_id: null,
    asset_metadata: { uploaded_by_role: '仓库员' },
    business_link_count: 2,
    unmapped_field_count: 4
  }]
  const entryResults = await callUrl(handlers.handleListEntryResults, '/document-intake/admin/entry-results?status=partial&targetKind=fixed_module_table&q=采购&limit=10')
  assert.equal(entryResults.statusCode, 200, 'entry result list should support status, target kind and keyword filters')
  assert.equal(entryResults.payload.entryResults.length, 1)
  assert.equal(entryResults.payload.entryResults[0].targetDocumentType, '采购入库单')
  assert.equal(entryResults.payload.entryResults[0].uploadedByRole, '仓库员')
  assert.equal(entryResults.payload.entryResults[0].importedCount, 2)
  assert.equal(entryResults.payload.entryResults[0].rejectedCount, 1)
  assert.equal(entryResults.payload.entryResults[0].businessLinkCount, 2)
  assert.equal(entryResults.payload.entryResults[0].unmappedFieldCount, 4)
  assert.equal(entryResults.payload.entryResults[0].duplicate, false)
  assert.deepEqual(entryResults.payload.entryResults[0].targetRecordIds, ['txn-1', 'txn-2'])
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.document_entry_plans p') && entry.sql.includes('p.status = $1')),
    'entry result list should filter by entry plan status'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('p.target_kind = $2')),
    'entry result list should filter by target kind'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by coalesce(p.updated_at, p.created_at)'))?.params,
    ['partial', 'fixed_module_table', '%采购%', 10, 0],
    'entry result list should keep status, target kind, keyword, limit and offset parameters stable'
  )

  resetState()
  state.entryResultRows = [{
    id: 'plan-traceable',
    asset_id: 'asset-traceable',
    batch_id: 'batch-traceable',
    target_module: 'materials',
    target_document_type: '采购入库单',
    target_kind: 'fixed_module_table',
    app_id: null,
    app_name: '',
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    mode: 'auto_import',
    document_count: 1,
    line_count: 2,
    confidence: '0.9300',
    reason: '按设备和上传人追溯',
    status: 'partial',
    metadata: { imported_count: 1, rejected_count: 1, target_record_ids: ['txn-traceable'] },
    created_at: '2026-06-16T11:40:00.000Z',
    updated_at: '2026-06-16T11:45:00.000Z',
    original_filename: '重复采购入库单.xlsx',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    asset_status: 'duplicate',
    duplicate_of_asset_id: 'asset-original',
    asset_metadata: { uploaded_by_role: '仓库员' },
    business_link_count: 1,
    unmapped_field_count: 2
  }]
  const traceableEntryResults = await callUrl(
    handlers.handleListEntryResults,
    '/document-intake/admin/entry-results?duplicate=true&deviceId=warehouse-pc-01&user=%E4%BB%93%E5%BA%93%E5%91%98&operatorSource=web_login_user&status=partial&targetKind=fixed_module_table&limit=10'
  )
  assert.equal(traceableEntryResults.statusCode, 200, 'entry result list should support duplicate, device, user and source filters')
  assert.equal(traceableEntryResults.payload.entryResults[0].duplicate, true)
  assert.equal(traceableEntryResults.payload.entryResults[0].deviceCode, 'warehouse-pc-01')
  assert.equal(traceableEntryResults.payload.entryResults[0].uploadedByRole, '仓库员')
  assert.equal(traceableEntryResults.payload.entryResults[0].operatorSource, 'web_login_user')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes("a.status = 'duplicate' or a.duplicate_of_asset_id is not null")),
    'entry result duplicate=true should match duplicate asset status or duplicate source id'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('a.device_id::text = $1') && entry.sql.includes('fd.device_code = $1')),
    'entry result list should filter by source device id or code'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('a.uploaded_by_user_id ilike $2') && entry.sql.includes("a.metadata->>'uploaded_by_role'")),
    'entry result list should filter by uploaded user id, username or role'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('a.operator_source = $3')),
    'entry result list should filter by operator source'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by coalesce(p.updated_at, p.created_at)'))?.params,
    ['warehouse-pc-01', '%仓库员%', 'web_login_user', 'partial', 'fixed_module_table', 10, 0],
    'entry result traceability filters should keep device, user, source, status, target kind, limit and offset parameters stable'
  )

  resetState()
  const badEntryResultDuplicateFilter = await callUrl(handlers.handleListEntryResults, '/document-intake/admin/entry-results?duplicate=maybe')
  assert.equal(badEntryResultDuplicateFilter.statusCode, 400, 'entry result list should reject invalid duplicate values')
  assert.equal(badEntryResultDuplicateFilter.payload.code, 'BAD_QUERY')
  assert.equal(state.poolQueries.length, 0, 'invalid entry result duplicate filter should fail before querying')

  resetState()
  const badEntryResultAssetFilter = await callUrl(handlers.handleListEntryResults, '/document-intake/admin/entry-results?assetId=not-a-uuid')
  assert.equal(badEntryResultAssetFilter.statusCode, 400, 'entry result list should reject invalid asset ids')
  assert.equal(badEntryResultAssetFilter.payload.code, 'BAD_QUERY')
  assert.equal(state.poolQueries.length, 0, 'invalid entry result asset filter should fail before querying')

  resetState()
  const assetFilterId = '00000000-0000-4000-8000-000000000201'
  state.entryResultRows = [{
    id: 'plan-by-asset',
    asset_id: assetFilterId,
    batch_id: 'batch-asset',
    target_module: 'materials',
    target_document_type: '采购入库单',
    target_kind: 'fixed_module_table',
    app_id: null,
    app_name: '',
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    mode: 'auto_import',
    document_count: 1,
    line_count: 1,
    confidence: '0.9000',
    reason: '按来源文件追溯',
    status: 'imported',
    metadata: { imported_count: 1, target_record_ids: ['txn-asset'] },
    created_at: '2026-06-16T12:00:00.000Z',
    updated_at: '2026-06-16T12:01:00.000Z',
    original_filename: '按文件追溯.xlsx',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    asset_status: 'imported',
    duplicate_of_asset_id: null,
    asset_metadata: { uploaded_by_role: '仓库员' },
    business_link_count: 1,
    unmapped_field_count: 0
  }]
  const entryResultsByAsset = await callUrl(handlers.handleListEntryResults, `/document-intake/admin/entry-results?assetId=${assetFilterId}&limit=10`)
  assert.equal(entryResultsByAsset.statusCode, 200, 'entry result list should support source asset filters')
  assert.equal(entryResultsByAsset.payload.entryResults[0].assetId, assetFilterId)
  assert.equal(entryResultsByAsset.payload.entryResults[0].targetRecordIds[0], 'txn-asset')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.document_entry_plans p') && entry.sql.includes('p.asset_id = $1')),
    'entry result list should filter by source asset id'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by coalesce(p.updated_at, p.created_at)'))?.params,
    [assetFilterId, 10, 0],
    'entry result asset filter should keep asset id, limit and offset parameters stable'
  )

  resetState()
  const badEntryResultBatchFilter = await callUrl(handlers.handleListEntryResults, '/document-intake/admin/entry-results?batchId=not-a-uuid')
  assert.equal(badEntryResultBatchFilter.statusCode, 400, 'entry result list should reject invalid batch ids')
  assert.equal(badEntryResultBatchFilter.payload.code, 'BAD_QUERY')
  assert.equal(state.poolQueries.length, 0, 'invalid entry result batch filter should fail before querying')

  resetState()
  const batchFilterId = '00000000-0000-4000-8000-000000000301'
  state.entryResultRows = [{
    id: 'plan-by-batch',
    asset_id: '00000000-0000-4000-8000-000000000302',
    batch_id: batchFilterId,
    target_module: 'materials',
    target_document_type: '采购入库单',
    target_kind: 'fixed_module_table',
    app_id: null,
    app_name: '',
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    mode: 'auto_import',
    document_count: 1,
    line_count: 2,
    confidence: '0.9200',
    reason: '按日志批次追溯',
    status: 'imported',
    metadata: { imported_count: 2, target_record_ids: ['txn-batch-1', 'txn-batch-2'] },
    created_at: '2026-06-16T12:10:00.000Z',
    updated_at: '2026-06-16T12:11:00.000Z',
    original_filename: '按批次追溯.xlsx',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    asset_status: 'imported',
    duplicate_of_asset_id: null,
    asset_metadata: { uploaded_by_role: '仓库员' },
    business_link_count: 2,
    unmapped_field_count: 0
  }]
  const entryResultsByBatch = await callUrl(handlers.handleListEntryResults, `/document-intake/admin/entry-results?batchId=${batchFilterId}&limit=10`)
  assert.equal(entryResultsByBatch.statusCode, 200, 'entry result list should support import batch filters')
  assert.equal(entryResultsByBatch.payload.entryResults[0].batchId, batchFilterId)
  assert.equal(entryResultsByBatch.payload.entryResults[0].targetRecordIds[0], 'txn-batch-1')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.document_entry_plans p') && entry.sql.includes('p.batch_id = $1')),
    'entry result list should filter by import batch id'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by coalesce(p.updated_at, p.created_at)'))?.params,
    [batchFilterId, 10, 0],
    'entry result batch filter should keep batch id, limit and offset parameters stable'
  )

  resetState()
  state.entryResultRows = [{
    id: 'plan-overview-success',
    asset_id: '00000000-0000-4000-8000-000000000402',
    batch_id: '00000000-0000-4000-8000-000000000401',
    target_module: 'materials',
    target_document_type: '采购入库单',
    target_kind: 'fixed_module_table',
    app_id: null,
    app_name: '',
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    mode: 'auto_import',
    document_count: 1,
    line_count: 1,
    confidence: '0.7600',
    reason: '总览卡片联动筛选',
    status: 'partial',
    metadata: { imported_count: 1, target_record_ids: ['txn-overview'] },
    created_at: '2026-06-16T12:20:00.000Z',
    updated_at: '2026-06-16T12:21:00.000Z',
    original_filename: '总览低置信度.xlsx',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    asset_status: 'imported',
    duplicate_of_asset_id: null,
    asset_metadata: { uploaded_by_role: '仓库员' },
    business_link_count: 1,
    unmapped_field_count: 0
  }]
  const overviewEntryResults = await callUrl(handlers.handleListEntryResults, '/document-intake/admin/entry-results?today=true&status=successful&lowConfidence=true&limit=10')
  assert.equal(overviewEntryResults.statusCode, 200, 'entry result list should support overview successful and low-confidence filters')
  assert.equal(overviewEntryResults.payload.entryResults[0].status, 'partial')
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes("coalesce(p.updated_at, p.created_at) >= date_trunc('day', now())")),
    'entry result today filter should constrain plans to the current day'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes("p.status in ('imported', 'partial')")),
    'entry result successful filter should include imported and partial plans'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('p.confidence is not null and p.confidence < 0.8')),
    'entry result low-confidence filter should use the overview confidence threshold'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('order by coalesce(p.updated_at, p.created_at)'))?.params,
    [10, 0],
    'entry result overview filters should not add unnecessary SQL parameters'
  )

  resetState()
  const entryPlanId = '00000000-0000-4000-8000-000000000101'
  const invalidEntryDetail = await callUrl(handlers.handleGetEntryResultDetail, '/document-intake/admin/entry-results/not-a-uuid')
  assert.equal(invalidEntryDetail.statusCode, 400, 'entry result detail should reject invalid ids')
  assert.equal(invalidEntryDetail.payload.code, 'ENTRY_RESULT_ID_REQUIRED')
  assert.equal(state.poolQueries.length, 0, 'invalid entry result detail should fail before querying')

  const detailFileHash = 'd'.repeat(64)
  state.entryResultDetailRow = {
    id: entryPlanId,
    asset_id: 'asset-1',
    batch_id: 'batch-1',
    target_module: 'materials',
    target_document_type: '采购入库单',
    target_kind: 'fixed_module_table',
    app_id: null,
    app_name: '',
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    mode: 'auto_import',
    document_count: 1,
    line_count: 3,
    confidence: '0.8600',
    reason: '采购入库资料',
    columns_snapshot: [{ field: 'material_code', label: '物料编码' }],
    documents: [{ source: '采购入库单.xlsx', line_count: 3 }],
    status: 'partial',
    metadata: {
      imported_at: '2026-06-16T11:30:00.000Z',
      imported_count: 2,
      rejected_count: 1,
      target_record_ids: ['txn-1', 'txn-2'],
      rejected_rows: [{ source: 'sheet1:row:4', reason: '物料编码缺失' }]
    },
    created_at: '2026-06-16T11:10:00.000Z',
    updated_at: '2026-06-16T11:30:00.000Z',
    original_filename: '采购入库单.xlsx',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    file_hash: detailFileHash,
    uploaded_by_user_id: 'u_1',
    uploaded_by_username: 'operator',
    operator_source: 'web_login_user',
    asset_status: 'partial_imported',
    duplicate_of_asset_id: null,
    asset_metadata: { uploaded_by_role: '仓库员' },
    business_link_count: 2,
    unmapped_field_count: 1
  }
  state.businessLinkRows = [{
    id: 'link-1',
    asset_id: 'asset-1',
    batch_id: 'batch-1',
    entry_plan_id: entryPlanId,
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    target_record_id: 'txn-1',
    target_module: 'materials',
    target_document_type: '采购入库单',
    target_app_id: null,
    ai_confidence: '0.8600',
    metadata: { stock_in_result: { batch_no: 'B20260616' } },
    created_at: '2026-06-16T11:20:00.000Z'
  }, {
    id: 'link-2',
    asset_id: 'asset-1',
    batch_id: 'batch-1',
    entry_plan_id: entryPlanId,
    target_schema: 'custom',
    target_table: 'special_documents',
    target_record_id: 'custom-1',
    target_module: 'apps',
    target_document_type: '自定义单据',
    target_app_id: null,
    ai_confidence: '0.7700',
    metadata: { business_record_url: '/apps/app/custom-docs/record/custom-1?source=document-intake' },
    created_at: '2026-06-16T11:21:00.000Z'
  }]
  state.unmappedFieldRows = [{
    id: 'field-1',
    asset_id: 'asset-1',
    batch_id: 'batch-1',
    entry_plan_id: entryPlanId,
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    target_record_id: 'txn-1',
    name: '供应商',
    value: '南派供应链',
    confidence: '0.7500',
    source: 'sheet1:row:2',
    write_location: 'remarks',
    metadata: { reason: 'stock_in RPC 暂未提供独立字段' },
    created_at: '2026-06-16T11:21:00.000Z'
  }]
  state.businessCorrectionRows = [{
    id: 'correction-1',
    business_link_id: 'link-1',
    target_schema: 'scm',
    target_table: 'inventory_transactions',
    target_record_id: 'txn-1',
    field_name: 'quantity',
    old_value: '10',
    new_value: '12',
    correction_type: 'manual_update',
    affects_business_result: true,
    recalculation_status: 'completed',
    corrected_by: '仓库主管',
    corrected_at: '2026-06-16T12:00:00.000Z',
    metadata: { reason: '实收数量复核' }
  }]
  state.logRows = [{
    id: 'log-detail-1',
    level: 'info',
    event_type: 'document_entry_completed',
    message: '采购入库单自动入库完成 2 条，失败 1 条',
    stack: '',
    device_id: 'device-1',
    device_code: 'warehouse-pc-01',
    device_name: 'Warehouse PC 01',
    user_id: 'u_1',
    username: 'operator',
    role: '仓库员',
    app_module: 'document-intake-worker',
    route: 'document-fixed-entry',
    url: '',
    request_url: '',
    status_code: null,
    client_session_id: 'session-entry',
    trace_id: 'trace-entry-detail',
    ai_import_batch_id: 'batch-1',
    source_file_hash: detailFileHash,
    app_version: '0.1.0',
    webview_version: '',
    metadata: { imported_count: 2, rejected_count: 1 },
    created_at: '2026-06-16T11:31:00.000Z'
  }]
  const entryDetail = await callUrl(handlers.handleGetEntryResultDetail, `/document-intake/admin/entry-results/${entryPlanId}`)
  assert.equal(entryDetail.statusCode, 200, 'entry result detail should return traceability details')
  assert.equal(entryDetail.payload.entryResult.id, entryPlanId)
  assert.equal(entryDetail.payload.entryResult.fileHash, detailFileHash)
  assert.equal(entryDetail.payload.entryResult.columnsSnapshot[0].field, 'material_code')
  assert.equal(entryDetail.payload.businessLinks[0].targetRecordId, 'txn-1')
  assert.equal(entryDetail.payload.businessLinks[0].aiConfidence, 0.86)
  assert.equal(
    entryDetail.payload.businessLinks[0].businessRecordUrl,
    '/materials/inventory-ledger?recordId=txn-1&source=document-intake',
    'business link should include a server-generated business record URL for known target tables'
  )
  assert.equal(
    entryDetail.payload.businessLinks[1].businessRecordUrl,
    '/apps/app/custom-docs/record/custom-1?source=document-intake',
    'business link metadata should be able to override the business record URL'
  )
  assert.equal(entryDetail.payload.unmappedFields[0].name, '供应商')
  assert.equal(entryDetail.payload.unmappedFields[0].writeLocation, 'remarks')
  assert.equal(entryDetail.payload.businessCorrections[0].fieldName, 'quantity')
  assert.equal(entryDetail.payload.businessCorrections[0].oldValue, '10')
  assert.equal(entryDetail.payload.businessCorrections[0].newValue, '12')
  assert.equal(entryDetail.payload.businessCorrections[0].affectsBusinessResult, true)
  assert.equal(entryDetail.payload.businessCorrections[0].recalculationStatus, 'completed')
  assert.equal(entryDetail.payload.businessCorrections[0].correctedBy, '仓库主管')
  assert.equal(entryDetail.payload.relatedLogs[0].eventType, 'document_entry_completed')
  assert.equal(entryDetail.payload.relatedLogs[0].traceId, 'trace-entry-detail')
  assert.equal(entryDetail.payload.relatedLogs[0].sourceFileHash, detailFileHash)
  assert.equal(entryDetail.payload.rejectedRows[0].reason, '物料编码缺失')
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('where p.id = $1'))?.params,
    [entryPlanId],
    'entry result detail should query by the requested entry plan id'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.client_log_events e') && entry.sql.includes('e.ai_import_batch_id::text = $1') && entry.sql.includes('e.source_file_hash = $2')),
    'entry result detail should query related import logs by import batch id and source file hash'
  )
  assert.ok(
    state.poolQueries.some((entry) => entry.sql.includes('from public.ai_business_corrections c') && entry.sql.includes('bl.entry_plan_id = $1') && entry.sql.includes('c.business_link_id = bl.id')),
    'entry result detail should query business correction records through its business links'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('from public.ai_business_corrections c'))?.params,
    [entryPlanId],
    'entry result detail correction query should keep the entry plan id parameter stable'
  )
  assert.deepEqual(
    state.poolQueries.find((entry) => entry.sql.includes('from public.client_log_events e') && entry.sql.includes('limit 100'))?.params,
    ['batch-1', detailFileHash],
    'entry result detail log query should keep batch id and file hash parameters stable'
  )

  resetState()
  const boundary = '----eiscore-test-boundary'
  const fileContent = Buffer.from('hello collector')
  const badHash = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: { original_filename: '../unsafe:name.txt', file_hash: 'bad-hash' },
      filename: '../unsafe:name.txt',
      fileContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(badHash.statusCode, 400, 'upload should reject mismatched client hash')
  assert.equal(badHash.payload.code, 'FILE_HASH_MISMATCH')
  assert.equal(state.connected, 0, 'hash mismatch should fail before opening an upload transaction')

  resetState()
  const badMetadata = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, { metadataRaw: '{"bad":', fileContent }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(badMetadata.statusCode, 400, 'upload should reject malformed metadata JSON')
  assert.equal(badMetadata.payload.code, 'BAD_METADATA')

  resetState()
  const goodUpload = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: {
        original_filename: '../unsafe:name.txt',
        file_hash: sha256(fileContent),
        file_size: 999999,
        uploaded_by_username: 'operator'
      },
      filename: '../unsafe:name.txt',
      fileContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(goodUpload.statusCode, 200, 'valid upload should succeed')
  assert.equal(goodUpload.payload.duplicate, false)
  assert.equal(state.assetInsertParams.length, 1, 'valid upload should insert one asset')
  assert.equal(state.assetInsertParams[0][5], 'unsafe_name.txt', 'stored filename should be sanitized')
  assert.equal(state.assetInsertParams[0][9], fileContent.length, 'server should store the real uploaded byte length')
  assert.equal(state.parseJobInserts, 1, 'new uploads should create a parse job')
  assert.equal((await listFiles(tmpRoot)).length, 1, 'new uploads should be written to storage')

  resetState()
  const chunkSize = 256 * 1024
  const chunkedContent = Buffer.alloc(chunkSize * 2 + 17)
  for (let index = 0; index < chunkedContent.length; index += 1) {
    chunkedContent[index] = index % 251
  }
  const chunkedHash = sha256(chunkedContent)

  const badChunkHashInit = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      original_filename: 'chunked.pdf',
      file_hash: 'not-a-sha256',
      file_size: chunkedContent.length,
      chunk_size: chunkSize,
      total_chunks: 3
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(badChunkHashInit.statusCode, 400, 'chunk init should reject invalid file hashes')
  assert.equal(badChunkHashInit.payload.code, 'CHUNK_INIT_FIELDS_REQUIRED')
  assert.equal(state.connected, 0, 'invalid chunk init should fail before opening a DB transaction')

  const badChunkCountInit = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      original_filename: 'chunked.pdf',
      file_hash: chunkedHash,
      file_size: chunkedContent.length,
      chunk_size: chunkSize,
      total_chunks: 2
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(badChunkCountInit.statusCode, 400, 'chunk init should reject mismatched chunk counts')
  assert.equal(badChunkCountInit.payload.code, 'CHUNK_COUNT_MISMATCH')

  resetState()
  const initChunk = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      original_filename: 'chunked.pdf',
      file_hash: chunkedHash,
      file_size: chunkedContent.length,
      mime_type: 'application/pdf',
      upload_source: 'watch_folder',
      chunk_size: chunkSize,
      total_chunks: 3,
      metadata: {
        uploaded_by_username: 'operator',
        client_queue_id: 42
      }
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(initChunk.statusCode, 200, `chunk init should succeed: ${JSON.stringify(initChunk.payload)}`)
  assert.equal(initChunk.payload.duplicate, false)
  assert.equal(initChunk.payload.totalChunks, 3)
  assert.deepEqual(initChunk.payload.missingChunks, [0, 1, 2])

  const incompleteChunk = await call(
    handlers.handleCompleteChunkUpload,
    JSON.stringify({ session_id: initChunk.payload.sessionId }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(incompleteChunk.statusCode, 409, 'chunk complete should reject missing parts')
  assert.equal(incompleteChunk.payload.code, 'UPLOAD_CHUNKS_MISSING')
  assert.deepEqual(incompleteChunk.payload.missingChunks, [0, 1, 2])

  const uploadChunk = async (index, bytes) => call(
    handlers.handleUploadChunk,
    multipartBody(boundary, {
      metadata: {
        session_id: initChunk.payload.sessionId,
        chunk_index: index,
        chunk_hash: sha256(bytes)
      },
      filename: `chunk-${index}.part`,
      fileContent: bytes,
      fileField: 'chunk'
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )

  state.connected = 0
  const mismatchedChunkHash = await call(
    handlers.handleUploadChunk,
    multipartBody(boundary, {
      metadata: {
        session_id: initChunk.payload.sessionId,
        chunk_index: 0,
        chunk_hash: '0'.repeat(64)
      },
      filename: 'chunk-0.part',
      fileContent: chunkedContent.subarray(0, chunkSize),
      fileField: 'chunk'
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(mismatchedChunkHash.statusCode, 400, 'chunk upload should reject bad client hashes')
  assert.equal(mismatchedChunkHash.payload.code, 'CHUNK_HASH_MISMATCH')
  assert.equal(state.connected, 0, 'chunk hash mismatch should fail before opening an upload transaction')

  const chunk0 = await uploadChunk(0, chunkedContent.subarray(0, chunkSize))
  assert.equal(chunk0.statusCode, 200, `chunk 0 should upload: ${JSON.stringify(chunk0.payload)}`)
  assert.equal(chunk0.payload.duplicate, false)
  assert.equal(chunk0.payload.uploadedChunks, 1)
  const duplicateChunk0 = await uploadChunk(0, chunkedContent.subarray(0, chunkSize))
  assert.equal(duplicateChunk0.statusCode, 200, 'same chunk should be idempotent')
  assert.equal(duplicateChunk0.payload.duplicate, true)
  assert.equal(duplicateChunk0.payload.uploadedChunks, 1)
  const conflictingChunk0 = Buffer.from(chunkedContent.subarray(0, chunkSize))
  conflictingChunk0[0] = (conflictingChunk0[0] + 1) % 255
  const chunkConflict = await uploadChunk(0, conflictingChunk0)
  assert.equal(chunkConflict.statusCode, 409, 'different bytes for an uploaded chunk should conflict')
  assert.equal(chunkConflict.payload.code, 'CHUNK_CONFLICT')
  const wrongSizeChunk = await uploadChunk(1, chunkedContent.subarray(chunkSize, chunkSize * 2 - 1))
  assert.equal(wrongSizeChunk.statusCode, 400, 'non-final chunks must match configured chunk size')
  assert.equal(wrongSizeChunk.payload.code, 'CHUNK_SIZE_MISMATCH')
  const chunk1 = await uploadChunk(1, chunkedContent.subarray(chunkSize, chunkSize * 2))
  assert.equal(chunk1.statusCode, 200, `chunk 1 should upload: ${JSON.stringify(chunk1.payload)}`)
  const chunk2 = await uploadChunk(2, chunkedContent.subarray(chunkSize * 2))
  assert.equal(chunk2.statusCode, 200, `chunk 2 should upload: ${JSON.stringify(chunk2.payload)}`)

  const resumeInit = await call(
    handlers.handleInitChunkUpload,
    JSON.stringify({
      originalFilename: 'chunked.pdf',
      fileHash: chunkedHash,
      fileSize: chunkedContent.length,
      mimeType: 'application/pdf',
      uploadSource: 'watch_folder',
      chunkSize,
      totalChunks: 3
    }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.deepEqual(resumeInit.payload.uploadedChunks, [0, 1, 2], 'chunk init should report uploaded chunks for resume')
  assert.deepEqual(resumeInit.payload.missingChunks, [], 'chunk init should report no missing chunks after upload')

  const completeChunk = await call(
    handlers.handleCompleteChunkUpload,
    JSON.stringify({ session_id: initChunk.payload.sessionId }),
    { authorization: 'Bearer good-token', 'content-type': 'application/json' }
  )
  assert.equal(completeChunk.statusCode, 200, `chunk complete should succeed: ${JSON.stringify(completeChunk.payload)}`)
  assert.equal(completeChunk.payload.duplicate, false)
  assert.equal(completeChunk.payload.status, 'uploaded')
  assert.equal(state.assetInsertParams.at(-1)[5], 'chunked.pdf')
  assert.equal(state.assetInsertParams.at(-1)[9], chunkedContent.length)
  assert.equal(state.assetInsertParams.at(-1)[10], chunkedHash)
  assert.equal(state.parseJobInserts, 1, 'chunked complete should create one parse job')

  resetState()
  state.duplicateRows = [{ id: 'asset-original', storage_path: '/already/stored.txt' }]
  const duplicateUpload = await call(
    handlers.handleUploadAsset,
    multipartBody(boundary, {
      metadata: { file_hash: sha256(fileContent) },
      fileContent
    }),
    { authorization: 'Bearer good-token', 'content-type': `multipart/form-data; boundary=${boundary}` }
  )
  assert.equal(duplicateUpload.statusCode, 200, 'duplicate upload should still return success')
  assert.equal(duplicateUpload.payload.duplicate, true)
  assert.equal(state.parseJobInserts, 0, 'duplicate uploads should not create a parse job')

  console.log('PASS: document intake regression')
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true })
}
