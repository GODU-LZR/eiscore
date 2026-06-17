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
  state.uploadSessions = new Map()
  state.uploadChunks = new Map()
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
