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
    if (normalized.includes('from public.collector_devices')) {
      return { rows: state.authorized ? [state.device] : [] }
    }
    if (normalized.includes('update public.collector_devices')) {
      return { rows: [{ ...state.device, status: 'active', last_seen_at: new Date().toISOString() }] }
    }
    if (normalized.includes('from public.collector_watch_folders')) {
      return { rows: state.watchFolders }
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

assert.equal(state.poolOptions.max, 5, 'invalid pool max env should fall back to 5')
assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')

function resetState() {
  state.authorized = true
  state.duplicateRows = []
  state.watchFolders = []
  state.device.metadata = {}
  state.clientQueries = []
  state.poolQueries = []
  state.assetInsertParams = []
  state.parseJobInserts = 0
  state.connected = 0
}

function makeRequest(body = Buffer.alloc(0), headers = {}) {
  const req = Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(String(body))])
  req.headers = headers
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

async function call(handler, body, headers = {}) {
  const res = {}
  await handler(makeRequest(body, headers), res)
  return res
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function multipartBody(boundary, { metadata, metadataRaw, filename = 'upload.txt', fileContent = Buffer.from('hello') } = {}) {
  const chunks = []
  const pushText = (text) => chunks.push(Buffer.from(text, 'utf8'))
  pushText(`--${boundary}\r\n`)
  pushText('Content-Disposition: form-data; name="metadata"\r\n')
  pushText('Content-Type: application/json\r\n\r\n')
  pushText(metadataRaw ?? JSON.stringify(metadata || {}))
  pushText(`\r\n--${boundary}\r\n`)
  pushText(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`)
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
        retry_interval_seconds: 20,
        max_retry_count: 7,
        allowed_extensions: ['.pdf', '.xlsx']
      },
      logs: {
        batch_size: 50,
        flush_interval_seconds: 12,
        retention_days: 15,
        high_priority_immediate: false
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
  assert.deepEqual(remoteConfig.payload.config.upload.allowedExtensions, ['.pdf', '.xlsx'])
  assert.equal(remoteConfig.payload.config.logs.batchSize, 50)
  assert.equal(remoteConfig.payload.config.logs.highPriorityImmediate, false)
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
