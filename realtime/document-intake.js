// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

const defaultStorageRoot = path.join(__dirname, 'data', 'document-intake');
const storageRoot = envText(process.env.DOCUMENT_INTAKE_STORAGE_DIR) || defaultStorageRoot;
const bootstrapBindCode = envText(process.env.COLLECTOR_BIND_AUTH_CODE, '');

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

const maxUploadBytes = positiveInteger(
  process.env.DOCUMENT_INTAKE_MAX_UPLOAD_BYTES,
  256 * 1024 * 1024,
  { min: 1024 * 1024, max: 1024 * 1024 * 1024 }
);
const maxChunkBytes = positiveInteger(
  process.env.DOCUMENT_INTAKE_MAX_CHUNK_BYTES,
  8 * 1024 * 1024,
  { min: 256 * 1024, max: 64 * 1024 * 1024 }
);

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: positiveInteger(process.env.PGPORT, 5432, { min: 1, max: 65535 }),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: positiveInteger(process.env.DOCUMENT_INTAKE_PG_POOL_MAX, 5, { min: 1, max: 50 })
});

function sha256(value) {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.isBuffer(value) ? value : String(value || ''));
  return hash.digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeStatus(value, fallback = 'uploaded') {
  const text = normalizeText(value, 50).toLowerCase();
  return text || fallback;
}

function normalizeFilename(value) {
  const raw = path.basename(String(value || '').replace(/\\/g, '/')).trim();
  const cleaned = raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 180);
  return cleaned || `upload-${Date.now()}.bin`;
}

function normalizeMimeType(value) {
  return normalizeText(value, 160) || 'application/octet-stream';
}

function asJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function toUuidOrNull(value) {
  const text = normalizeText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function isUuid(value) {
  return !!toUuidOrNull(value);
}

function toIsoOrNull(value) {
  const text = normalizeText(value, 80);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getBearerToken(req) {
  const header = req?.headers?.authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseContentDisposition(value = '') {
  const out = {};
  const parts = String(value).split(';').map((item) => item.trim()).filter(Boolean);
  out.type = parts.shift() || '';
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    let val = part.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundaryText = boundaryMatch?.[1] || boundaryMatch?.[2] || '';
  if (!boundaryText) throw new Error('Multipart boundary is missing');

  const boundary = Buffer.from(`--${boundaryText}`);
  const boundaryWithPrefix = Buffer.from(`\r\n--${boundaryText}`);
  const headerSeparator = Buffer.from('\r\n\r\n');
  const crlf = Buffer.from('\r\n');
  const parts = {};

  let cursor = buffer.indexOf(boundary);
  if (cursor < 0) throw new Error('Multipart boundary not found');

  while (cursor >= 0 && cursor < buffer.length) {
    cursor += boundary.length;
    if (buffer.slice(cursor, cursor + 2).toString() === '--') break;
    if (buffer.slice(cursor, cursor + 2).equals(crlf)) cursor += 2;

    const headerEnd = buffer.indexOf(headerSeparator, cursor);
    if (headerEnd < 0) break;

    const rawHeaders = buffer.slice(cursor, headerEnd).toString('utf-8');
    const headers = {};
    for (const line of rawHeaders.split(/\r\n/)) {
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }

    const disposition = parseContentDisposition(headers['content-disposition'] || '');
    const name = disposition.name || '';
    if (!name) break;

    const contentStart = headerEnd + headerSeparator.length;
    let nextBoundary = buffer.indexOf(boundaryWithPrefix, contentStart);
    if (nextBoundary < 0) nextBoundary = buffer.indexOf(boundary, contentStart);
    if (nextBoundary < 0) break;

    const content = buffer.slice(contentStart, nextBoundary);
    parts[name] = {
      name,
      filename: disposition.filename || '',
      contentType: headers['content-type'] || '',
      data: content
    };

    cursor = nextBoundary + (buffer.slice(nextBoundary, nextBoundary + 2).equals(crlf) ? 2 : 0);
  }

  return parts;
}

function readJsonPart(part) {
  if (!part) return {};
  const text = part.data.toString('utf-8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

async function ensureDirectory(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function buildStoragePath(deviceId, fileHash, originalFilename) {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const devicePart = normalizeFilename(deviceId || 'unknown-device').slice(0, 80);
  const ext = path.extname(originalFilename).slice(0, 16);
  const basename = `${fileHash || crypto.randomUUID()}${ext}`;
  const dir = path.join(storageRoot, y, m, d, devicePart);
  return { dir, fullPath: path.join(dir, basename) };
}

function buildChunkPath(deviceId, sessionId, chunkIndex) {
  const devicePart = normalizeFilename(deviceId || 'unknown-device').slice(0, 80);
  const sessionPart = normalizeFilename(sessionId || 'unknown-session').slice(0, 80);
  const dir = path.join(storageRoot, 'chunks', devicePart, sessionPart);
  return { dir, fullPath: path.join(dir, `${String(chunkIndex).padStart(8, '0')}.part`) };
}

function isSha256Hex(value) {
  return /^[a-f0-9]{64}$/i.test(normalizeText(value, 80));
}

function normalizePositiveNumber(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function assembleChunks(chunkRows, targetPath) {
  await ensureDirectory(path.dirname(targetPath));
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(targetPath, { flags: 'w' });
    out.on('error', reject);
    out.on('finish', resolve);

    const pipeOne = (index) => {
      if (index >= chunkRows.length) {
        out.end();
        return;
      }
      const input = fs.createReadStream(chunkRows[index].storage_path);
      input.on('error', reject);
      input.on('end', () => pipeOne(index + 1));
      input.pipe(out, { end: false });
    };

    pipeOne(0);
  });
}

async function findExistingAssetByHash(client, fileHash) {
  const duplicateResult = await client.query(
    `select id, storage_path
       from public.document_assets
      where file_hash = $1
        and status <> 'duplicate'
      order by created_at asc
      limit 1`,
    [fileHash]
  );
  return duplicateResult.rows[0] || null;
}

async function createUploadAssetRecords(client, { device, metadata, originalFilename, fileHash, mimeType, fileSize, uploadSource, storagePath, duplicateOf = null, uploadMode = 'multipart' }) {
  const duplicate = !!duplicateOf;
  const batchResult = await client.query(
    `insert into public.document_import_batches (
       device_id, uploaded_by_user_id, source, file_count, success_count,
       duplicate_count, status, started_at, finished_at, metadata
     ) values ($1,$2,$3,1,$4,$5,$6,now(),now(),$7)
     returning id, batch_no`,
    [
      device.id,
      normalizeText(metadata.uploaded_by_user_id || device.default_user_id || '', 120),
      uploadSource,
      duplicate ? 0 : 1,
      duplicate ? 1 : 0,
      duplicate ? 'completed' : 'uploaded',
      {
        client_queue_id: metadata.client_queue_id || null,
        uploaded_by_username: metadata.uploaded_by_username || device.default_username || '',
        operator_source: metadata.operator_source || '',
        windows_username: metadata.windows_username || '',
        upload_mode: uploadMode
      }
    ]
  );
  const batch = batchResult.rows[0];

  const assetResult = await client.query(
    `insert into public.document_assets (
       batch_id, device_id, uploaded_by_user_id, uploaded_by_username, operator_source,
       original_filename, storage_path, mime_type, file_ext, file_size, file_hash,
       upload_source, status, duplicate_of_asset_id, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     returning id, status`,
    [
      batch.id,
      device.id,
      normalizeText(metadata.uploaded_by_user_id || device.default_user_id || '', 120),
      normalizeText(metadata.uploaded_by_username || device.default_username || '', 160),
      normalizeText(metadata.operator_source || 'device_default_user', 80),
      originalFilename,
      duplicate ? duplicateOf.storage_path : storagePath,
      mimeType,
      path.extname(originalFilename).slice(0, 40),
      fileSize,
      fileHash,
      uploadSource,
      duplicate ? 'duplicate' : 'uploaded',
      duplicateOf?.id || null,
      {
        ...asJsonObject(metadata),
        source_device_code: device.device_code,
        source_device_name: device.device_name,
        upload_mode: uploadMode
      }
    ]
  );
  const asset = assetResult.rows[0];

  if (!duplicate) {
    await client.query(
      `insert into public.document_parse_jobs (asset_id, batch_id, status, metadata)
       values ($1, $2, 'pending', $3)`,
      [asset.id, batch.id, { reason: 'created_after_upload', upload_mode: uploadMode }]
    );
  }

  return { asset, batch, duplicate };
}

async function getUploadSessionForUpdate(client, sessionId, deviceId) {
  const result = await client.query(
    `select *
       from public.document_upload_sessions
      where id = $1
        and device_id = $2
      for update`,
    [sessionId, deviceId]
  );
  return result.rows[0] || null;
}

async function countUploadedChunks(client, sessionId) {
  const result = await client.query(
    `select count(*)::integer as uploaded_chunks
       from public.document_upload_chunks
      where session_id = $1`,
    [sessionId]
  );
  return Number(result.rows[0]?.uploaded_chunks || 0);
}

async function markUploadSession(client, sessionId, status, extra = {}) {
  const result = await client.query(
    `update public.document_upload_sessions
        set status = $2,
            uploaded_chunks = coalesce($3::integer, uploaded_chunks),
            storage_path = coalesce($4::text, storage_path),
            last_error = $5::text,
            metadata = coalesce(metadata, '{}'::jsonb) || $6::jsonb,
            completed_at = case when $2 in ('completed','duplicate','failed') then now() else completed_at end,
            updated_at = now()
      where id = $1
      returning *`,
    [
      sessionId,
      status,
      Number.isFinite(Number(extra.uploadedChunks)) ? Number(extra.uploadedChunks) : null,
      extra.storagePath || null,
      extra.lastError || '',
      extra.metadata || {}
    ]
  );
  return result.rows[0] || null;
}

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function findDeviceByToken(token) {
  if (!token) return null;
  const tokenHash = sha256(token);
  const result = await query(
    `select *
       from public.collector_devices
      where device_token_hash = $1
        and status <> 'disabled'
      limit 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function authorizeDevice(req, sendJson, res) {
  const token = getBearerToken(req);
  const device = await findDeviceByToken(token);
  if (!device) {
    sendJson(res, 401, { code: 'UNAUTHORIZED_DEVICE', message: 'Invalid or missing device token' });
    return null;
  }
  return device;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const text = normalizeText(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', '启用', '是'].includes(text)) return true;
  if (['false', '0', 'no', 'n', 'off', '停用', '否'].includes(text)) return false;
  return fallback;
}

function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { ok: true, value: null };
  }
  const text = normalizeText(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', '启用', '是'].includes(text)) return { ok: true, value: true };
  if (['false', '0', 'no', 'n', 'off', '停用', '否'].includes(text)) return { ok: true, value: false };
  return { ok: false, value: null };
}

function buildAssetListFilters(searchParams) {
  const params = [];
  const where = [];
  const today = normalizeOptionalBoolean(searchParams.get('today'));
  if (!today.ok) {
    return { error: 'today must be true or false' };
  }
  if (today.value === true) {
    where.push("a.created_at >= date_trunc('day', now())");
  }

  const duplicate = normalizeOptionalBoolean(searchParams.get('duplicate'));
  if (!duplicate.ok) {
    return { error: 'duplicate must be true or false' };
  }
  if (duplicate.value === true) {
    where.push("(a.status = 'duplicate' or a.duplicate_of_asset_id is not null)");
  } else if (duplicate.value === false) {
    where.push("(a.status <> 'duplicate' and a.duplicate_of_asset_id is null)");
  }

  const deviceId = normalizeText(searchParams.get('deviceId') || searchParams.get('device_id') || '', 120);
  if (deviceId) {
    params.push(deviceId);
    where.push(`(
      a.device_id::text = $${params.length}
      or exists (
        select 1
          from public.collector_devices fd
         where fd.id = a.device_id
           and fd.device_code = $${params.length}
      )
    )`);
  }

  const status = normalizeText(searchParams.get('status') || '', 80);
  if (status) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }

  const user = normalizeText(
    searchParams.get('user') ||
    searchParams.get('userId') ||
    searchParams.get('user_id') ||
    searchParams.get('username') ||
    '',
    120
  );
  if (user) {
    params.push(`%${user}%`);
    where.push(`(
      a.uploaded_by_user_id ilike $${params.length}
      or a.uploaded_by_username ilike $${params.length}
      or coalesce(a.metadata->>'uploaded_by_role', '') ilike $${params.length}
    )`);
  }

  const operatorSource = normalizeText(searchParams.get('operatorSource') || searchParams.get('operator_source') || '', 80);
  if (operatorSource) {
    params.push(operatorSource);
    where.push(`a.operator_source = $${params.length}`);
  }

  const sourceFolder = normalizeText(searchParams.get('sourceFolder') || searchParams.get('source_folder') || '', 240);
  if (sourceFolder) {
    params.push(`%${sourceFolder}%`);
    where.push(`coalesce(a.metadata->>'source_folder', '') ilike $${params.length}`);
  }

  const watchFolderSource = normalizeText(searchParams.get('watchFolderSource') || searchParams.get('watch_folder_source') || '', 80);
  if (watchFolderSource) {
    params.push(watchFolderSource);
    where.push(`coalesce(a.metadata->>'watch_folder_source', '') = $${params.length}`);
  }

  const keyword = normalizeText(searchParams.get('q') || searchParams.get('keyword') || '', 120);
  if (keyword) {
    params.push(`%${keyword}%`);
    where.push(`(a.original_filename ilike $${params.length} or a.file_hash ilike $${params.length})`);
  }

  return {
    whereSql: where.length ? `where ${where.join(' and ')}` : '',
    params
  };
}

function buildDeviceListFilters(searchParams) {
  const params = [];
  const where = [];
  const status = normalizeText(searchParams.get('status') || '', 40).toLowerCase();
  if (status) {
    params.push(status);
    where.push(`d.status = $${params.length}`);
  }

  const keyword = normalizeText(searchParams.get('q') || searchParams.get('keyword') || '', 120);
  if (keyword) {
    params.push(`%${keyword}%`);
    where.push(`(
      d.device_code ilike $${params.length}
      or d.device_name ilike $${params.length}
      or d.enterprise_id ilike $${params.length}
      or d.default_username ilike $${params.length}
      or d.default_role ilike $${params.length}
    )`);
  }

  const user = normalizeText(
    searchParams.get('user') ||
    searchParams.get('userId') ||
    searchParams.get('user_id') ||
    searchParams.get('username') ||
    '',
    120
  );
  if (user) {
    params.push(`%${user}%`);
    where.push(`(
      d.default_user_id ilike $${params.length}
      or d.default_username ilike $${params.length}
      or d.default_role ilike $${params.length}
    )`);
  }

  const serverBaseUrl = normalizeText(
    searchParams.get('serverBaseUrl') ||
    searchParams.get('server_base_url') ||
    searchParams.get('server') ||
    '',
    240
  );
  if (serverBaseUrl) {
    params.push(`%${serverBaseUrl}%`);
    where.push(`d.server_base_url ilike $${params.length}`);
  }

  const clientVersion = normalizeText(searchParams.get('clientVersion') || searchParams.get('client_version') || '', 80);
  if (clientVersion) {
    params.push(`%${clientVersion}%`);
    where.push(`d.client_version ilike $${params.length}`);
  }

  const webviewVersion = normalizeText(
    searchParams.get('webviewVersion') ||
    searchParams.get('webViewVersion') ||
    searchParams.get('webview_version') ||
    '',
    120
  );
  if (webviewVersion) {
    params.push(`%${webviewVersion}%`);
    where.push(`d.webview_version ilike $${params.length}`);
  }

  return {
    whereSql: where.length ? `where ${where.join(' and ')}` : '',
    params
  };
}

function buildLogListFilters(searchParams) {
  const params = [];
  const where = [];

  const level = normalizeText(searchParams.get('level') || '', 40).toLowerCase();
  if (level) {
    params.push(level);
    where.push(`lower(e.level) = $${params.length}`);
  }

  const eventType = normalizeText(searchParams.get('eventType') || searchParams.get('event_type') || '', 120);
  if (eventType) {
    params.push(eventType);
    where.push(`e.event_type = $${params.length}`);
  }

  const deviceId = normalizeText(searchParams.get('deviceId') || searchParams.get('device_id') || '', 120);
  if (deviceId) {
    params.push(deviceId);
    where.push(`(e.device_id::text = $${params.length} or d.device_code = $${params.length})`);
  }

  const user = normalizeText(
    searchParams.get('user') ||
    searchParams.get('userId') ||
    searchParams.get('user_id') ||
    searchParams.get('username') ||
    '',
    120
  );
  if (user) {
    params.push(`%${user}%`);
    where.push(`(e.user_id ilike $${params.length} or e.username ilike $${params.length} or e.role ilike $${params.length})`);
  }

  const appModule = normalizeText(searchParams.get('appModule') || searchParams.get('app_module') || searchParams.get('module') || '', 120);
  if (appModule) {
    params.push(`%${appModule}%`);
    where.push(`e.app_module ilike $${params.length}`);
  }

  const route = normalizeText(searchParams.get('route') || searchParams.get('page') || searchParams.get('url') || '', 240);
  if (route) {
    params.push(`%${route}%`);
    where.push(`(e.route ilike $${params.length} or e.url ilike $${params.length} or e.request_url ilike $${params.length})`);
  }

  const traceId = normalizeText(searchParams.get('traceId') || searchParams.get('trace_id') || '', 160);
  if (traceId) {
    params.push(traceId);
    where.push(`e.trace_id = $${params.length}`);
  }

  const batchId = normalizeText(searchParams.get('batchId') || searchParams.get('batch_id') || '', 120);
  if (batchId) {
    params.push(batchId);
    where.push(`e.ai_import_batch_id::text = $${params.length}`);
  }

  const sourceFileHash = normalizeText(
    searchParams.get('sourceFileHash') ||
    searchParams.get('source_file_hash') ||
    searchParams.get('fileHash') ||
    searchParams.get('file_hash') ||
    '',
    128
  );
  if (sourceFileHash) {
    params.push(`%${sourceFileHash}%`);
    where.push(`e.source_file_hash ilike $${params.length}`);
  }

  const sourceFolder = normalizeText(searchParams.get('sourceFolder') || searchParams.get('source_folder') || '', 240);
  if (sourceFolder) {
    params.push(`%${sourceFolder}%`);
    where.push(`coalesce(e.metadata->>'source_folder', '') ilike $${params.length}`);
  }

  const watchFolderSource = normalizeText(searchParams.get('watchFolderSource') || searchParams.get('watch_folder_source') || '', 80);
  if (watchFolderSource) {
    params.push(watchFolderSource);
    where.push(`coalesce(e.metadata->>'watch_folder_source', '') = $${params.length}`);
  }

  const keyword = normalizeText(searchParams.get('q') || searchParams.get('keyword') || '', 160);
  if (keyword) {
    params.push(`%${keyword}%`);
    where.push(`(
      e.message ilike $${params.length}
      or e.event_type ilike $${params.length}
      or e.trace_id ilike $${params.length}
      or e.username ilike $${params.length}
      or e.client_session_id ilike $${params.length}
      or d.device_code ilike $${params.length}
      or d.device_name ilike $${params.length}
    )`);
  }

  return {
    whereSql: where.length ? `where ${where.join(' and ')}` : '',
    params
  };
}

function buildEntryResultListFilters(searchParams) {
  const params = [];
  const where = [];

  const today = normalizeOptionalBoolean(searchParams.get('today'));
  if (!today.ok) {
    return { error: 'today must be true or false' };
  }
  if (today.value === true) {
    where.push("coalesce(p.updated_at, p.created_at) >= date_trunc('day', now())");
  }

  const assetIdText = normalizeText(searchParams.get('assetId') || searchParams.get('asset_id') || '', 80);
  if (assetIdText) {
    const assetId = toUuidOrNull(assetIdText);
    if (!assetId) return { error: 'assetId must be a valid uuid' };
    params.push(assetId);
    where.push(`p.asset_id = $${params.length}`);
  }

  const batchIdText = normalizeText(searchParams.get('batchId') || searchParams.get('batch_id') || '', 80);
  if (batchIdText) {
    const batchId = toUuidOrNull(batchIdText);
    if (!batchId) return { error: 'batchId must be a valid uuid' };
    params.push(batchId);
    where.push(`p.batch_id = $${params.length}`);
  }

  const duplicate = normalizeOptionalBoolean(searchParams.get('duplicate'));
  if (!duplicate.ok) {
    return { error: 'duplicate must be true or false' };
  }
  if (duplicate.value === true) {
    where.push("(a.status = 'duplicate' or a.duplicate_of_asset_id is not null)");
  } else if (duplicate.value === false) {
    where.push("(a.status <> 'duplicate' and a.duplicate_of_asset_id is null)");
  }

  const deviceId = normalizeText(searchParams.get('deviceId') || searchParams.get('device_id') || '', 120);
  if (deviceId) {
    params.push(deviceId);
    where.push(`(
      a.device_id::text = $${params.length}
      or exists (
        select 1
          from public.collector_devices fd
         where fd.id = a.device_id
           and fd.device_code = $${params.length}
      )
    )`);
  }

  const user = normalizeText(
    searchParams.get('user') ||
    searchParams.get('userId') ||
    searchParams.get('user_id') ||
    searchParams.get('username') ||
    '',
    120
  );
  if (user) {
    params.push(`%${user}%`);
    where.push(`(
      a.uploaded_by_user_id ilike $${params.length}
      or a.uploaded_by_username ilike $${params.length}
      or coalesce(a.metadata->>'uploaded_by_role', '') ilike $${params.length}
    )`);
  }

  const operatorSource = normalizeText(searchParams.get('operatorSource') || searchParams.get('operator_source') || '', 80);
  if (operatorSource) {
    params.push(operatorSource);
    where.push(`a.operator_source = $${params.length}`);
  }

  const lowConfidence = normalizeOptionalBoolean(searchParams.get('lowConfidence') || searchParams.get('low_confidence'));
  if (!lowConfidence.ok) {
    return { error: 'lowConfidence must be true or false' };
  }
  if (lowConfidence.value === true) {
    where.push('p.confidence is not null and p.confidence < 0.8');
  } else if (lowConfidence.value === false) {
    where.push('(p.confidence is null or p.confidence >= 0.8)');
  }

  const status = normalizeText(searchParams.get('status') || '', 40).toLowerCase();
  if (status) {
    if (status === 'successful') {
      where.push("p.status in ('imported', 'partial')");
    } else {
      params.push(status);
      where.push(`p.status = $${params.length}`);
    }
  }

  const targetKind = normalizeText(searchParams.get('targetKind') || searchParams.get('target_kind') || '', 80);
  if (targetKind) {
    params.push(targetKind);
    where.push(`p.target_kind = $${params.length}`);
  }

  const keyword = normalizeText(searchParams.get('q') || searchParams.get('keyword') || '', 160);
  if (keyword) {
    params.push(`%${keyword}%`);
    where.push(`(
      a.original_filename ilike $${params.length}
      or a.uploaded_by_username ilike $${params.length}
      or a.uploaded_by_user_id ilike $${params.length}
      or coalesce(a.metadata->>'uploaded_by_role', '') ilike $${params.length}
      or a.operator_source ilike $${params.length}
      or p.target_module ilike $${params.length}
      or p.target_document_type ilike $${params.length}
      or p.target_table ilike $${params.length}
      or p.app_name ilike $${params.length}
      or p.reason ilike $${params.length}
    )`);
  }

  return {
    whereSql: where.length ? `where ${where.join(' and ')}` : '',
    params
  };
}

function normalizeWatchFolders(value) {
  return asJsonArray(value).slice(0, 20).map((item) => {
    const folder = asJsonObject(item);
    return {
      folderPath: normalizeText(folder.folderPath || folder.folder_path || folder.path || '', 1000),
      folderName: normalizeText(folder.folderName || folder.folder_name || folder.name || '', 200),
      defaultUserId: normalizeText(folder.defaultUserId || folder.default_user_id || '', 120),
      defaultRole: normalizeText(folder.defaultRole || folder.default_role || '', 120),
      enabled: normalizeBoolean(folder.enabled, true)
    };
  }).filter((item) => item.folderPath);
}

async function findWatchFoldersByDevice(deviceId) {
  if (!deviceId) return [];
  const result = await query(
    `select folder_path, folder_name, default_user_id, default_role, enabled
       from public.collector_watch_folders
      where device_id = $1
        and enabled is true
      order by created_at asc, id asc
      limit 20`,
    [deviceId]
  );
  return result.rows;
}

function buildDeviceConfig(device, watchFolderRows = []) {
  const metadata = asJsonObject(device?.metadata);
  const remote = asJsonObject(metadata.remote_config || metadata.remoteConfig);
  const upload = asJsonObject(remote.upload);
  const logs = asJsonObject(remote.logs);
  const update = asJsonObject(remote.update);
  const remoteWatchFolders = normalizeWatchFolders(firstDefined(remote.watchFolders, remote.watch_folders));
  const storedWatchFolders = normalizeWatchFolders(watchFolderRows);
  const watchFolders = remoteWatchFolders.length ? remoteWatchFolders : storedWatchFolders;
  const autoStartEnabled = firstDefined(remote.autoStartEnabled, remote.auto_start_enabled);
  const highPriorityImmediate = firstDefined(logs.highPriorityImmediate, logs.high_priority_immediate);
  const updateAutoInstall = firstDefined(update.autoInstall, update.auto_install);
  const configVersion = normalizeText(
    remote.version || metadata.remote_config_version || device.updated_at || device.last_seen_at || '',
    120
  ) || 'default';

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    configVersion,
    device: {
      deviceId: device.id,
      deviceCode: device.device_code || '',
      deviceName: device.device_name || '',
      defaultUserId: device.default_user_id || '',
      defaultUsername: device.default_username || '',
      defaultRole: device.default_role || '',
      status: device.status || ''
    },
    config: {
      defaultUserId: normalizeText(remote.defaultUserId || remote.default_user_id || device.default_user_id || '', 120),
      defaultUsername: normalizeText(remote.defaultUsername || remote.default_username || device.default_username || '', 160),
      defaultRole: normalizeText(remote.defaultRole || remote.default_role || device.default_role || '', 120),
      autoStartEnabled: autoStartEnabled !== undefined && normalizeText(autoStartEnabled, 20)
        ? normalizeBoolean(autoStartEnabled, false)
        : null,
      heartbeatIntervalSeconds: positiveInteger(remote.heartbeatIntervalSeconds || remote.heartbeat_interval_seconds, 60, { min: 15, max: 60 * 60 }),
      watchFolders,
      upload: {
        maxFileBytes: positiveInteger(upload.maxFileBytes || upload.max_file_bytes, maxUploadBytes, { min: 1024 * 1024, max: 1024 * 1024 * 1024 }),
        chunkSizeBytes: positiveInteger(upload.chunkSizeBytes || upload.chunk_size_bytes, maxChunkBytes, { min: 256 * 1024, max: maxChunkBytes }),
        retryIntervalSeconds: positiveInteger(upload.retryIntervalSeconds || upload.retry_interval_seconds, 15, { min: 5, max: 60 * 60 }),
        maxRetryCount: positiveInteger(upload.maxRetryCount || upload.max_retry_count, 10, { min: 1, max: 100 }),
        allowedExtensions: asJsonArray(upload.allowedExtensions || upload.allowed_extensions)
          .map((item) => normalizeText(item, 32).toLowerCase())
          .filter(Boolean)
          .slice(0, 100)
      },
      logs: {
        batchSize: positiveInteger(logs.batchSize || logs.batch_size, 100, { min: 1, max: 1000 }),
        flushIntervalSeconds: positiveInteger(logs.flushIntervalSeconds || logs.flush_interval_seconds, 30, { min: 5, max: 60 * 60 }),
        retentionDays: positiveInteger(logs.retentionDays || logs.retention_days, 30, { min: 1, max: 3650 }),
        highPriorityImmediate: normalizeBoolean(highPriorityImmediate, true)
      },
      update: {
        enabled: normalizeBoolean(update.enabled, false),
        manifestUrl: normalizeText(update.manifestUrl || update.manifest_url || '', 1000),
        checkIntervalHours: positiveInteger(update.checkIntervalHours || update.check_interval_hours, 24, { min: 1, max: 24 * 30 }),
        autoInstall: normalizeBoolean(updateAutoInstall, false),
        installerArguments: normalizeText(update.installerArguments || update.installer_arguments || '', 500)
      }
    }
  };
}

function mapAssetListRow(row) {
  const metadata = asJsonObject(row.metadata);
  const documentCount = Number(row.document_count || 0);
  const businessLinkCount = Number(row.business_link_count || 0);
  return {
    id: row.id,
    batchId: row.batch_id || '',
    deviceId: row.device_id || '',
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: metadata.uploaded_by_role || '',
    operatorSource: row.operator_source || '',
    sourceFolder: metadata.source_folder || '',
    watchFolderSource: metadata.watch_folder_source || '',
    originalFilename: row.original_filename || '',
    mimeType: row.mime_type || '',
    fileExt: row.file_ext || '',
    fileSize: Number(row.file_size || 0),
    fileHash: row.file_hash || '',
    uploadSource: row.upload_source || '',
    status: row.status || '',
    duplicate: row.status === 'duplicate' || !!row.duplicate_of_asset_id,
    duplicateOfAssetId: row.duplicate_of_asset_id || '',
    targetModule: row.target_module || '',
    targetDocumentType: row.target_document_type || '',
    targetKind: row.target_kind || '',
    appName: row.app_name || '',
    targetSchema: row.target_schema || '',
    targetTable: row.target_table || '',
    entryStatus: row.entry_status || '',
    documentCount,
    lineCount: Number(row.line_count || 0),
    businessLinkCount,
    generatedDocumentCount: businessLinkCount || documentCount,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    metadata
  };
}

function mapDeviceListRow(row) {
  const metadata = asJsonObject(row.metadata);
  return {
    id: row.id,
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    enterpriseId: row.enterprise_id || '',
    departmentId: row.department_id || '',
    defaultUserId: row.default_user_id || '',
    defaultUsername: row.default_username || '',
    defaultRole: row.default_role || '',
    serverBaseUrl: row.server_base_url || '',
    clientVersion: row.client_version || '',
    webviewVersion: row.webview_version || '',
    status: row.status || '',
    lastSeenAt: row.last_seen_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    metadata
  };
}

function mapDeviceAdminActionRow(row) {
  return {
    id: row.id,
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    status: row.status || '',
    updatedAt: row.updated_at || ''
  };
}

function mapWatchFolderRow(row) {
  return {
    id: row.id || '',
    deviceId: row.device_id || '',
    folderPath: row.folder_path || '',
    folderName: row.folder_name || '',
    defaultUserId: row.default_user_id || '',
    defaultRole: row.default_role || '',
    enabled: !!row.enabled,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    metadata: asJsonObject(row.metadata)
  };
}

function mapLogListRow(row) {
  const metadata = asJsonObject(row.metadata);
  return {
    id: row.id,
    level: row.level || '',
    eventType: row.event_type || '',
    message: row.message || '',
    stack: row.stack || '',
    deviceId: row.device_id || '',
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    userId: row.user_id || '',
    username: row.username || '',
    role: row.role || '',
    appModule: row.app_module || '',
    route: row.route || '',
    url: row.url || '',
    requestUrl: row.request_url || '',
    statusCode: row.status_code === null || row.status_code === undefined ? null : Number(row.status_code),
    clientSessionId: row.client_session_id || '',
    traceId: row.trace_id || '',
    aiImportBatchId: row.ai_import_batch_id || '',
    sourceFileHash: row.source_file_hash || '',
    sourceFolder: metadata.source_folder || '',
    watchFolderSource: metadata.watch_folder_source || '',
    appVersion: row.app_version || '',
    webviewVersion: row.webview_version || '',
    createdAt: row.created_at || '',
    metadata
  };
}

function mapEntryResultListRow(row) {
  const metadata = asJsonObject(row.metadata);
  const assetMetadata = asJsonObject(row.asset_metadata);
  const targetRecordIds = Array.isArray(metadata.target_record_ids) ? metadata.target_record_ids : [];
  const businessLinkCount = Number(row.business_link_count || 0);
  const importedCount = Number.isFinite(Number(metadata.imported_count))
    ? Number(metadata.imported_count)
    : businessLinkCount;
  const rejectedCount = Number.isFinite(Number(metadata.rejected_count))
    ? Number(metadata.rejected_count)
    : 0;

  return {
    id: row.id,
    assetId: row.asset_id || '',
    batchId: row.batch_id || '',
    originalFilename: row.original_filename || '',
    fileHash: row.file_hash || '',
    deviceId: row.device_id || '',
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: assetMetadata.uploaded_by_role || '',
    operatorSource: row.operator_source || '',
    assetStatus: row.asset_status || '',
    duplicate: row.asset_status === 'duplicate' || !!row.duplicate_of_asset_id,
    duplicateOfAssetId: row.duplicate_of_asset_id || '',
    targetModule: row.target_module || '',
    targetDocumentType: row.target_document_type || '',
    targetKind: row.target_kind || '',
    appId: row.app_id || '',
    appName: row.app_name || '',
    targetSchema: row.target_schema || '',
    targetTable: row.target_table || '',
    mode: row.mode || '',
    documentCount: Number(row.document_count || 0),
    lineCount: Number(row.line_count || 0),
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    reason: row.reason || '',
    status: row.status || '',
    importedCount,
    rejectedCount,
    businessLinkCount,
    unmappedFieldCount: Number(row.unmapped_field_count || 0),
    targetRecordIds,
    importedAt: metadata.imported_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    metadata
  };
}

function mapEntryResultDetailRow(row) {
  return {
    ...mapEntryResultListRow(row),
    columnsSnapshot: asJsonArray(row.columns_snapshot),
    documents: asJsonArray(row.documents)
  };
}

const businessRecordRouteBuilders = {
  'public.raw_materials': (id) => `/materials/material/detail/${encodeURIComponent(id)}?source=document-intake`,
  raw_materials: (id) => `/materials/material/detail/${encodeURIComponent(id)}?source=document-intake`,
  'scm.inventory_transactions': (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inventory_transactions: (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.v_inventory_transactions': (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_inventory_transactions: (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.inventory_batches': (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inventory_batches: (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.v_inventory_current': (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_inventory_current: (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.warehouses': (id) => `/materials/warehouses?recordId=${encodeURIComponent(id)}&source=document-intake`,
  warehouses: (id) => `/materials/warehouses?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.inventory_drafts': (id) => `/materials/inventory-draft/detail/${encodeURIComponent(id)}?source=document-intake`,
  inventory_drafts: (id) => `/materials/inventory-draft/detail/${encodeURIComponent(id)}?source=document-intake`,
  purchase_demands: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=demands&source=document-intake`,
  purchase_orders: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=orders&source=document-intake`,
  purchase_arrivals: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=arrivals&source=document-intake`,
  boms: (id) => `/production/app/bom_list?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_sales_bom_production_plan: (id) => `/production/app/plans?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_production_work_orders: (id) => `/production/app/work_orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_production_work_order_items: (id) => `/production/app/work_order_items?recordId=${encodeURIComponent(id)}&source=document-intake`,
  production_inspections: (id) => `/quality/app/production_inspections?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inspection_orders: (id) => `/quality/app/inspection_orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  sales_orders: (id) => `/sales/app/orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  sales_payments: (id) => `/sales/app/payments?recordId=${encodeURIComponent(id)}&source=document-intake`
};

function buildBusinessRecordUrl(row, metadata) {
  const overrideUrl = normalizeText(
    metadata.businessRecordUrl ||
    metadata.business_record_url ||
    metadata.recordUrl ||
    metadata.record_url ||
    '',
    1000
  );
  if (overrideUrl) return overrideUrl;

  const recordId = normalizeText(row.target_record_id || '', 240);
  if (!recordId) return '';

  const targetKind = normalizeText(row.target_kind || metadata.targetKind || metadata.target_kind || '', 120);
  const targetAppId = normalizeText(row.target_app_id || metadata.targetAppId || metadata.target_app_id || '', 120);
  if (targetKind === 'data_app' && targetAppId) {
    return `/apps/app/${encodeURIComponent(targetAppId)}/record/${encodeURIComponent(recordId)}?source=document-intake`;
  }

  const schema = normalizeText(row.target_schema || '', 120);
  const table = normalizeText(row.target_table || '', 160);
  const key = schema && table ? `${schema}.${table}` : (table || schema);
  const routeBuilder = businessRecordRouteBuilders[key] || businessRecordRouteBuilders[key.replace(/^[^.]+\./, '')];
  return routeBuilder ? routeBuilder(recordId) : '';
}

function mapBusinessLinkRow(row) {
  const metadata = asJsonObject(row.metadata);
  return {
    id: row.id,
    assetId: row.asset_id || '',
    batchId: row.batch_id || '',
    entryPlanId: row.entry_plan_id || '',
    targetSchema: row.target_schema || '',
    targetTable: row.target_table || '',
    targetRecordId: row.target_record_id || '',
    targetModule: row.target_module || '',
    targetDocumentType: row.target_document_type || '',
    targetAppId: row.target_app_id || '',
    aiConfidence: row.ai_confidence === null || row.ai_confidence === undefined ? null : Number(row.ai_confidence),
    businessRecordUrl: buildBusinessRecordUrl(row, metadata),
    metadata,
    createdAt: row.created_at || ''
  };
}

function mapUnmappedFieldRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id || '',
    batchId: row.batch_id || '',
    entryPlanId: row.entry_plan_id || '',
    targetSchema: row.target_schema || '',
    targetTable: row.target_table || '',
    targetRecordId: row.target_record_id || '',
    name: row.name || '',
    value: row.value || '',
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    source: row.source || '',
    writeLocation: row.write_location || '',
    metadata: asJsonObject(row.metadata),
    createdAt: row.created_at || ''
  };
}

function mapBusinessCorrectionRow(row) {
  return {
    id: row.id,
    businessLinkId: row.business_link_id || '',
    targetSchema: row.target_schema || '',
    targetTable: row.target_table || '',
    targetRecordId: row.target_record_id || '',
    fieldName: row.field_name || '',
    oldValue: row.old_value || '',
    newValue: row.new_value || '',
    correctionType: row.correction_type || '',
    affectsBusinessResult: !!row.affects_business_result,
    recalculationStatus: row.recalculation_status || '',
    correctedBy: row.corrected_by || '',
    correctedAt: row.corrected_at || '',
    metadata: asJsonObject(row.metadata)
  };
}

function mapOverviewRow(row = {}) {
  const lowConfidenceThreshold = Number(row.low_confidence_threshold || 0.8);
  return {
    todayFileCount: Number(row.today_file_count || 0),
    successfulImportCount: Number(row.successful_import_count || 0),
    lowConfidenceCount: Number(row.low_confidence_count || 0),
    unrecognizedCount: Number(row.unrecognized_count || 0),
    duplicateFileCount: Number(row.duplicate_file_count || 0),
    failedCount: Number(row.failed_count || 0),
    activeDeviceCount: Number(row.active_device_count || 0),
    offlineDeviceCount: Number(row.offline_device_count || 0),
    lowConfidenceThreshold,
    generatedAt: row.generated_at || new Date().toISOString()
  };
}

async function handleGetOverview(req, res, { sendJson }) {
  try {
    const result = await query(
      `select
          (select count(*)::integer
             from public.document_assets a
            where a.created_at >= date_trunc('day', now())) as today_file_count,
          (select count(*)::integer
             from public.document_entry_plans p
            where p.status in ('imported', 'partial')
              and coalesce(p.updated_at, p.created_at) >= date_trunc('day', now())) as successful_import_count,
          (select count(*)::integer
             from public.document_entry_plans p
            where p.confidence is not null
              and p.confidence < 0.8
              and p.created_at >= date_trunc('day', now())) as low_confidence_count,
          (select count(*)::integer
             from public.document_assets a
            where a.status in ('unrecognized', 'archived_only')
              and a.created_at >= date_trunc('day', now())) as unrecognized_count,
          (select count(*)::integer
             from public.document_assets a
            where (a.status = 'duplicate' or a.duplicate_of_asset_id is not null)
              and a.created_at >= date_trunc('day', now())) as duplicate_file_count,
          (select count(*)::integer
             from public.document_assets a
            where a.status = 'failed'
              and a.created_at >= date_trunc('day', now())) +
          (select count(*)::integer
             from public.document_entry_plans p
            where p.status = 'failed'
              and coalesce(p.updated_at, p.created_at) >= date_trunc('day', now())) as failed_count,
          (select count(*)::integer
             from public.collector_devices d
            where d.status = 'active') as active_device_count,
          (select count(*)::integer
             from public.collector_devices d
            where d.status = 'offline') as offline_device_count,
          0.8::numeric as low_confidence_threshold,
          now() as generated_at`
    );
    sendJson(res, 200, {
      ok: true,
      overview: mapOverviewRow(result.rows[0])
    });
  } catch (error) {
    sendJson(res, 500, { code: 'OVERVIEW_FAILED', message: error.message || 'Overview failed' });
  }
}

async function handleListAssets(req, res, { sendJson }) {
  let url;
  try {
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    url = new URL('/', 'http://localhost');
  }

  const filters = buildAssetListFilters(url.searchParams);
  if (filters.error) {
    sendJson(res, 400, { code: 'BAD_QUERY', message: filters.error });
    return;
  }

  const limit = positiveInteger(url.searchParams.has('limit') ? url.searchParams.get('limit') : undefined, 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.has('offset') ? url.searchParams.get('offset') : undefined, 0, { min: 0, max: 100000 });
  const listParams = [...filters.params, limit, offset];
  const limitIndex = filters.params.length + 1;
  const offsetIndex = filters.params.length + 2;

  try {
    const countResult = await query(
      `select count(*)::integer as total
         from public.document_assets a
        ${filters.whereSql}`,
      filters.params
    );
    const assetsResult = await query(
      `select
          a.id,
          a.batch_id,
          a.device_id,
          d.device_code,
          d.device_name,
          a.uploaded_by_user_id,
          a.uploaded_by_username,
          a.operator_source,
          a.original_filename,
          a.mime_type,
          a.file_ext,
          a.file_size,
          a.file_hash,
          a.upload_source,
          a.status,
          a.duplicate_of_asset_id,
          a.metadata,
          latest_entry.target_module,
          latest_entry.target_document_type,
          latest_entry.target_kind,
          latest_entry.app_name,
          latest_entry.target_schema,
          latest_entry.target_table,
          latest_entry.entry_status,
          latest_entry.document_count,
          latest_entry.line_count,
          latest_entry.confidence,
          coalesce(latest_entry.business_link_count, 0) as business_link_count,
          a.created_at,
          a.updated_at
         from public.document_assets a
         left join public.collector_devices d on d.id = a.device_id
         left join lateral (
           select
              p.target_module,
              p.target_document_type,
              p.target_kind,
              p.app_name,
              p.target_schema,
              p.target_table,
              p.status as entry_status,
              p.document_count,
              p.line_count,
              p.confidence,
              coalesce(bl.business_link_count, 0) as business_link_count
             from public.document_entry_plans p
             left join lateral (
               select count(*)::integer as business_link_count
                 from public.document_business_links bl
                where bl.entry_plan_id = p.id
             ) bl on true
            where p.asset_id = a.id
            order by coalesce(p.updated_at, p.created_at) desc, p.id desc
            limit 1
         ) latest_entry on true
        ${filters.whereSql}
        order by a.created_at desc, a.id desc
        limit $${limitIndex} offset $${offsetIndex}`,
      listParams
    );

    sendJson(res, 200, {
      ok: true,
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset,
      assets: assetsResult.rows.map(mapAssetListRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'ASSET_LIST_FAILED', message: error.message || 'Asset list failed' });
  }
}

async function handleListDevices(req, res, { sendJson }) {
  let url;
  try {
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    url = new URL('/', 'http://localhost');
  }

  const filters = buildDeviceListFilters(url.searchParams);
  const limit = positiveInteger(url.searchParams.has('limit') ? url.searchParams.get('limit') : undefined, 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.has('offset') ? url.searchParams.get('offset') : undefined, 0, { min: 0, max: 100000 });
  const listParams = [...filters.params, limit, offset];
  const limitIndex = filters.params.length + 1;
  const offsetIndex = filters.params.length + 2;

  try {
    const countResult = await query(
      `select count(*)::integer as total
         from public.collector_devices d
        ${filters.whereSql}`,
      filters.params
    );
    const devicesResult = await query(
      `select
          d.id,
          d.device_code,
          d.device_name,
          d.enterprise_id,
          d.department_id,
          d.default_user_id,
          d.default_username,
          d.default_role,
          d.server_base_url,
          d.client_version,
          d.webview_version,
          d.status,
          d.last_seen_at,
          d.metadata,
          d.created_at,
          d.updated_at
         from public.collector_devices d
        ${filters.whereSql}
        order by coalesce(d.last_seen_at, d.updated_at, d.created_at) desc, d.device_code asc
        limit $${limitIndex} offset $${offsetIndex}`,
      listParams
    );

    sendJson(res, 200, {
      ok: true,
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset,
      devices: devicesResult.rows.map(mapDeviceListRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DEVICE_LIST_FAILED', message: error.message || 'Device list failed' });
  }
}

function deviceIdFromAdminPath(req) {
  let url;
  try {
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    url = new URL('/', 'http://localhost');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const devicesIndex = parts.findIndex((part, index) => part === 'devices' && parts[index - 1] === 'admin');
  return toUuidOrNull(parts[devicesIndex + 1] || '');
}

function watchFolderIdFromAdminPath(req) {
  let url;
  try {
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    url = new URL('/', 'http://localhost');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const watchFoldersIndex = parts.findIndex((part) => part === 'watch-folders');
  return toUuidOrNull(parts[watchFoldersIndex + 1] || '');
}

function bodyHasAny(body, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body || {}, key));
}

function bodyText(body, camelKey, snakeKey, max = 500) {
  if (Object.prototype.hasOwnProperty.call(body || {}, camelKey)) return normalizeText(body[camelKey], max);
  if (snakeKey && Object.prototype.hasOwnProperty.call(body || {}, snakeKey)) return normalizeText(body[snakeKey], max);
  return undefined;
}

function normalizeWatchFolderPayload(body, { requireFolderPath = false } = {}) {
  const folderPath = bodyText(body, 'folderPath', 'folder_path', 1000);
  if (requireFolderPath && !folderPath) {
    return { error: 'folderPath is required' };
  }
  if (folderPath !== undefined && !folderPath) {
    return { error: 'folderPath cannot be empty' };
  }

  let enabled;
  if (bodyHasAny(body, 'enabled')) {
    enabled = normalizeOptionalBoolean(body.enabled);
    if (!enabled.ok || enabled.value === null) {
      return { error: 'enabled must be true or false' };
    }
  }

  return {
    folderPath,
    folderName: bodyText(body, 'folderName', 'folder_name', 200),
    defaultUserId: bodyText(body, 'defaultUserId', 'default_user_id', 120),
    defaultRole: bodyText(body, 'defaultRole', 'default_role', 120),
    enabled: enabled?.value
  };
}

async function handleListDeviceWatchFolders(req, res, { sendJson }) {
  const deviceId = deviceIdFromAdminPath(req);
  if (!deviceId) {
    sendJson(res, 400, { code: 'DEVICE_ID_REQUIRED', message: 'A valid device id is required' });
    return;
  }

  try {
    const result = await query(
      `select id, device_id, folder_path, folder_name, default_user_id, default_role, enabled, metadata, created_at, updated_at
         from public.collector_watch_folders
        where device_id = $1
        order by enabled desc, created_at asc, id asc
        limit 200`,
      [deviceId]
    );
    sendJson(res, 200, {
      ok: true,
      deviceId,
      watchFolders: result.rows.map(mapWatchFolderRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'WATCH_FOLDER_LIST_FAILED', message: error.message || 'Watch folder list failed' });
  }
}

async function ensureDeviceExists(deviceId) {
  const result = await query(
    `select id
       from public.collector_devices
      where id = $1
      limit 1`,
    [deviceId]
  );
  return !!result.rows[0];
}

async function findWatchFolderByPath(deviceId, folderPath, excludeFolderId = '') {
  const params = [deviceId, folderPath];
  const excludeSql = excludeFolderId ? 'and id <> $3' : '';
  if (excludeFolderId) params.push(excludeFolderId);
  const result = await query(
    `select id
       from public.collector_watch_folders
      where device_id = $1
        and lower(folder_path) = lower($2)
        ${excludeSql}
      limit 1`,
    params
  );
  return result.rows[0] || null;
}

async function handleCreateWatchFolder(req, res, { sendJson, readJsonBody }) {
  const deviceId = deviceIdFromAdminPath(req);
  if (!deviceId) {
    sendJson(res, 400, { code: 'DEVICE_ID_REQUIRED', message: 'A valid device id is required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const payload = normalizeWatchFolderPayload(body, { requireFolderPath: true });
  if (payload.error) {
    sendJson(res, 400, { code: 'WATCH_FOLDER_INVALID', message: payload.error });
    return;
  }

  try {
    if (!(await ensureDeviceExists(deviceId))) {
      sendJson(res, 404, { code: 'DEVICE_NOT_FOUND', message: 'Device not found' });
      return;
    }
    const existing = await findWatchFolderByPath(deviceId, payload.folderPath);
    if (existing) {
      sendJson(res, 409, { code: 'WATCH_FOLDER_DUPLICATE', message: 'Watch folder path already exists for this device' });
      return;
    }

    const result = await query(
      `insert into public.collector_watch_folders (
          device_id,
          folder_path,
          folder_name,
          default_user_id,
          default_role,
          enabled,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        returning id, device_id, folder_path, folder_name, default_user_id, default_role, enabled, metadata, created_at, updated_at`,
      [
        deviceId,
        payload.folderPath,
        payload.folderName || '',
        payload.defaultUserId || '',
        payload.defaultRole || '',
        payload.enabled ?? true,
        {
          admin_created_at: new Date().toISOString()
        }
      ]
    );
    sendJson(res, 201, { ok: true, watchFolder: mapWatchFolderRow(result.rows[0]) });
  } catch (error) {
    sendJson(res, 500, { code: 'WATCH_FOLDER_CREATE_FAILED', message: error.message || 'Watch folder create failed' });
  }
}

async function handleUpdateWatchFolder(req, res, { sendJson, readJsonBody }) {
  const deviceId = deviceIdFromAdminPath(req);
  const folderId = watchFolderIdFromAdminPath(req);
  if (!deviceId || !folderId) {
    sendJson(res, 400, { code: 'WATCH_FOLDER_ID_REQUIRED', message: 'Valid device and watch folder ids are required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const payload = normalizeWatchFolderPayload(body);
  if (payload.error) {
    sendJson(res, 400, { code: 'WATCH_FOLDER_INVALID', message: payload.error });
    return;
  }
  if (!bodyHasAny(body, 'folderPath', 'folder_path', 'folderName', 'folder_name', 'defaultUserId', 'default_user_id', 'defaultRole', 'default_role', 'enabled')) {
    sendJson(res, 400, { code: 'WATCH_FOLDER_PATCH_EMPTY', message: 'At least one watch folder field is required' });
    return;
  }

  try {
    if (payload.folderPath) {
      const existing = await findWatchFolderByPath(deviceId, payload.folderPath, folderId);
      if (existing) {
        sendJson(res, 409, { code: 'WATCH_FOLDER_DUPLICATE', message: 'Watch folder path already exists for this device' });
        return;
      }
    }

    const result = await query(
      `update public.collector_watch_folders
          set folder_path = case when $3::boolean then $4 else folder_path end,
              folder_name = case when $5::boolean then $6 else folder_name end,
              default_user_id = case when $7::boolean then $8 else default_user_id end,
              default_role = case when $9::boolean then $10 else default_role end,
              enabled = case when $11::boolean then $12 else enabled end,
              metadata = coalesce(metadata, '{}'::jsonb) || $13::jsonb,
              updated_at = now()
        where id = $1
          and device_id = $2
        returning id, device_id, folder_path, folder_name, default_user_id, default_role, enabled, metadata, created_at, updated_at`,
      [
        folderId,
        deviceId,
        payload.folderPath !== undefined,
        payload.folderPath || '',
        payload.folderName !== undefined,
        payload.folderName ?? '',
        payload.defaultUserId !== undefined,
        payload.defaultUserId ?? '',
        payload.defaultRole !== undefined,
        payload.defaultRole ?? '',
        payload.enabled !== undefined,
        payload.enabled ?? false,
        {
          admin_updated_at: new Date().toISOString()
        }
      ]
    );
    const row = result.rows[0] || null;
    if (!row) {
      sendJson(res, 404, { code: 'WATCH_FOLDER_NOT_FOUND', message: 'Watch folder not found' });
      return;
    }
    sendJson(res, 200, { ok: true, watchFolder: mapWatchFolderRow(row) });
  } catch (error) {
    sendJson(res, 500, { code: 'WATCH_FOLDER_UPDATE_FAILED', message: error.message || 'Watch folder update failed' });
  }
}

async function handleUpdateWatchFolderStatus(req, res, { sendJson, readJsonBody }) {
  const deviceId = deviceIdFromAdminPath(req);
  const folderId = watchFolderIdFromAdminPath(req);
  if (!deviceId || !folderId) {
    sendJson(res, 400, { code: 'WATCH_FOLDER_ID_REQUIRED', message: 'Valid device and watch folder ids are required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const enabled = normalizeOptionalBoolean(body.enabled);
  if (!enabled.ok || enabled.value === null) {
    sendJson(res, 400, { code: 'WATCH_FOLDER_ENABLED_REQUIRED', message: 'enabled must be true or false' });
    return;
  }

  try {
    const result = await query(
      `update public.collector_watch_folders
          set enabled = $3,
              metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
              updated_at = now()
        where id = $1
          and device_id = $2
        returning id, device_id, folder_path, folder_name, default_user_id, default_role, enabled, metadata, created_at, updated_at`,
      [
        folderId,
        deviceId,
        enabled.value,
        {
          admin_enabled_updated_at: new Date().toISOString()
        }
      ]
    );
    const row = result.rows[0] || null;
    if (!row) {
      sendJson(res, 404, { code: 'WATCH_FOLDER_NOT_FOUND', message: 'Watch folder not found' });
      return;
    }
    sendJson(res, 200, { ok: true, watchFolder: mapWatchFolderRow(row) });
  } catch (error) {
    sendJson(res, 500, { code: 'WATCH_FOLDER_STATUS_UPDATE_FAILED', message: error.message || 'Watch folder status update failed' });
  }
}

async function handleDeleteWatchFolder(req, res, { sendJson }) {
  const deviceId = deviceIdFromAdminPath(req);
  const folderId = watchFolderIdFromAdminPath(req);
  if (!deviceId || !folderId) {
    sendJson(res, 400, { code: 'WATCH_FOLDER_ID_REQUIRED', message: 'Valid device and watch folder ids are required' });
    return;
  }

  try {
    const result = await query(
      `delete from public.collector_watch_folders
        where id = $1
          and device_id = $2
        returning id, device_id, folder_path, folder_name, default_user_id, default_role, enabled, metadata, created_at, updated_at`,
      [folderId, deviceId]
    );
    const row = result.rows[0] || null;
    if (!row) {
      sendJson(res, 404, { code: 'WATCH_FOLDER_NOT_FOUND', message: 'Watch folder not found' });
      return;
    }
    sendJson(res, 200, { ok: true, watchFolder: mapWatchFolderRow(row) });
  } catch (error) {
    sendJson(res, 500, { code: 'WATCH_FOLDER_DELETE_FAILED', message: error.message || 'Watch folder delete failed' });
  }
}

async function handleUpdateDeviceStatus(req, res, { sendJson, readJsonBody }) {
  const deviceId = deviceIdFromAdminPath(req);
  if (!deviceId) {
    sendJson(res, 400, { code: 'DEVICE_ID_REQUIRED', message: 'A valid device id is required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const status = normalizeText(body.status || '', 40).toLowerCase();
  if (!['active', 'disabled'].includes(status)) {
    sendJson(res, 400, { code: 'DEVICE_STATUS_INVALID', message: 'status must be active or disabled' });
    return;
  }

  try {
    const result = await query(
      `update public.collector_devices
          set status = $2,
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = now()
        where id = $1
        returning id, device_code, device_name, status, updated_at`,
      [
        deviceId,
        status,
        {
          admin_status_updated_at: new Date().toISOString(),
          admin_status_update_reason: normalizeText(body.reason || '', 500)
        }
      ]
    );
    const row = result.rows[0] || null;
    if (!row) {
      sendJson(res, 404, { code: 'DEVICE_NOT_FOUND', message: 'Device not found' });
      return;
    }
    sendJson(res, 200, { ok: true, device: mapDeviceAdminActionRow(row) });
  } catch (error) {
    sendJson(res, 500, { code: 'DEVICE_STATUS_UPDATE_FAILED', message: error.message || 'Device status update failed' });
  }
}

async function handleResetDeviceBindingCode(req, res, { sendJson }) {
  const deviceId = deviceIdFromAdminPath(req);
  if (!deviceId) {
    sendJson(res, 400, { code: 'DEVICE_ID_REQUIRED', message: 'A valid device id is required' });
    return;
  }

  const bindingCode = crypto.randomBytes(12).toString('hex');
  try {
    const result = await query(
      `update public.collector_devices
          set binding_code_hash = $2,
              device_token_hash = null,
              status = 'pending',
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = now()
        where id = $1
        returning id, device_code, device_name, status, updated_at`,
      [
        deviceId,
        sha256(bindingCode),
        {
          binding_code_reset_at: new Date().toISOString()
        }
      ]
    );
    const row = result.rows[0] || null;
    if (!row) {
      sendJson(res, 404, { code: 'DEVICE_NOT_FOUND', message: 'Device not found' });
      return;
    }
    sendJson(res, 200, { ok: true, bindingCode, device: mapDeviceAdminActionRow(row) });
  } catch (error) {
    sendJson(res, 500, { code: 'DEVICE_BINDING_CODE_RESET_FAILED', message: error.message || 'Device binding code reset failed' });
  }
}

async function handleListLogs(req, res, { sendJson }) {
  let url;
  try {
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    url = new URL('/', 'http://localhost');
  }

  const filters = buildLogListFilters(url.searchParams);
  const limit = positiveInteger(url.searchParams.has('limit') ? url.searchParams.get('limit') : undefined, 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.has('offset') ? url.searchParams.get('offset') : undefined, 0, { min: 0, max: 100000 });
  const listParams = [...filters.params, limit, offset];
  const limitIndex = filters.params.length + 1;
  const offsetIndex = filters.params.length + 2;

  try {
    const countResult = await query(
      `select count(*)::integer as total
         from public.client_log_events e
         left join public.collector_devices d on d.id = e.device_id
        ${filters.whereSql}`,
      filters.params
    );
    const logsResult = await query(
      `select
          e.id,
          e.level,
          e.event_type,
          e.message,
          e.stack,
          e.device_id,
          d.device_code,
          coalesce(d.device_name, e.device_name) as device_name,
          e.user_id,
          e.username,
          e.role,
          e.app_module,
          e.route,
          e.url,
          e.request_url,
          e.status_code,
          e.client_session_id,
          e.trace_id,
          e.ai_import_batch_id,
          e.source_file_hash,
          e.app_version,
          e.webview_version,
          e.metadata,
          e.created_at
         from public.client_log_events e
         left join public.collector_devices d on d.id = e.device_id
        ${filters.whereSql}
        order by e.created_at desc, e.id desc
        limit $${limitIndex} offset $${offsetIndex}`,
      listParams
    );

    sendJson(res, 200, {
      ok: true,
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset,
      logs: logsResult.rows.map(mapLogListRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'LOG_LIST_FAILED', message: error.message || 'Log list failed' });
  }
}

async function handleListEntryResults(req, res, { sendJson }) {
  let url;
  try {
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    url = new URL('/', 'http://localhost');
  }

  const filters = buildEntryResultListFilters(url.searchParams);
  if (filters.error) {
    sendJson(res, 400, { code: 'BAD_QUERY', message: filters.error });
    return;
  }
  const limit = positiveInteger(url.searchParams.has('limit') ? url.searchParams.get('limit') : undefined, 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.has('offset') ? url.searchParams.get('offset') : undefined, 0, { min: 0, max: 100000 });
  const listParams = [...filters.params, limit, offset];
  const limitIndex = filters.params.length + 1;
  const offsetIndex = filters.params.length + 2;

  try {
    const countResult = await query(
      `select count(*)::integer as total
         from public.document_entry_plans p
         join public.document_assets a on a.id = p.asset_id
        ${filters.whereSql}`,
      filters.params
    );
    const results = await query(
      `select
          p.id,
          p.asset_id,
          p.batch_id,
          p.target_module,
          p.target_document_type,
          p.target_kind,
          p.app_id,
          p.app_name,
          p.target_schema,
          p.target_table,
          p.mode,
          p.document_count,
          p.line_count,
          p.confidence,
          p.reason,
          p.status,
          p.metadata,
          p.created_at,
          p.updated_at,
          a.original_filename,
          a.device_id,
          d.device_code,
          d.device_name,
          a.uploaded_by_user_id,
          a.uploaded_by_username,
          a.operator_source,
          a.file_hash,
          a.status as asset_status,
          a.duplicate_of_asset_id,
          a.metadata as asset_metadata,
          coalesce(bl.business_link_count, 0) as business_link_count,
          coalesce(uf.unmapped_field_count, 0) as unmapped_field_count
         from public.document_entry_plans p
         join public.document_assets a on a.id = p.asset_id
         left join public.collector_devices d on d.id = a.device_id
         left join lateral (
           select count(*)::integer as business_link_count
             from public.document_business_links bl
            where bl.entry_plan_id = p.id
         ) bl on true
         left join lateral (
           select count(*)::integer as unmapped_field_count
             from public.document_unmapped_fields uf
            where uf.entry_plan_id = p.id
         ) uf on true
        ${filters.whereSql}
        order by coalesce(p.updated_at, p.created_at) desc, p.id desc
        limit $${limitIndex} offset $${offsetIndex}`,
      listParams
    );

    sendJson(res, 200, {
      ok: true,
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset,
      entryResults: results.rows.map(mapEntryResultListRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'ENTRY_RESULT_LIST_FAILED', message: error.message || 'Entry result list failed' });
  }
}

async function handleGetEntryResultDetail(req, res, { sendJson }) {
  let url;
  try {
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    url = new URL('/', 'http://localhost');
  }

  const idFromPath = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  const entryPlanId = toUuidOrNull(url.searchParams.get('id') || idFromPath);
  if (!entryPlanId) {
    sendJson(res, 400, { code: 'ENTRY_RESULT_ID_REQUIRED', message: 'A valid entry result id is required' });
    return;
  }

  try {
    const detailResult = await query(
      `select
          p.id,
          p.asset_id,
          p.batch_id,
          p.target_module,
          p.target_document_type,
          p.target_kind,
          p.app_id,
          p.app_name,
          p.target_schema,
          p.target_table,
          p.mode,
          p.document_count,
          p.line_count,
          p.confidence,
          p.reason,
          p.columns_snapshot,
          p.documents,
          p.status,
          p.metadata,
          p.created_at,
          p.updated_at,
          a.original_filename,
          a.device_id,
          d.device_code,
          d.device_name,
          a.uploaded_by_user_id,
          a.uploaded_by_username,
          a.operator_source,
          a.file_hash,
          a.status as asset_status,
          a.duplicate_of_asset_id,
          a.metadata as asset_metadata,
          coalesce(bl.business_link_count, 0) as business_link_count,
          coalesce(uf.unmapped_field_count, 0) as unmapped_field_count
         from public.document_entry_plans p
         join public.document_assets a on a.id = p.asset_id
         left join public.collector_devices d on d.id = a.device_id
         left join lateral (
           select count(*)::integer as business_link_count
             from public.document_business_links bl
            where bl.entry_plan_id = p.id
         ) bl on true
         left join lateral (
           select count(*)::integer as unmapped_field_count
             from public.document_unmapped_fields uf
            where uf.entry_plan_id = p.id
         ) uf on true
        where p.id = $1
        limit 1`,
      [entryPlanId]
    );
    const row = detailResult.rows[0] || null;
    if (!row) {
      sendJson(res, 404, { code: 'ENTRY_RESULT_NOT_FOUND', message: 'Entry result not found' });
      return;
    }

    const businessLinks = await query(
      `select
          id,
          asset_id,
          batch_id,
          entry_plan_id,
          target_schema,
          target_table,
          target_record_id,
          target_module,
          target_document_type,
          target_app_id,
          ai_confidence,
          metadata,
          created_at
         from public.document_business_links
        where entry_plan_id = $1
        order by created_at asc, id asc
        limit 200`,
      [entryPlanId]
    );
    const unmappedFields = await query(
      `select
          id,
          asset_id,
          batch_id,
          entry_plan_id,
          target_schema,
          target_table,
          target_record_id,
          name,
          value,
          confidence,
          source,
          write_location,
          metadata,
          created_at
         from public.document_unmapped_fields
        where entry_plan_id = $1
        order by created_at asc, id asc
        limit 500`,
      [entryPlanId]
    );
    const businessCorrections = await query(
      `select
          c.id,
          c.business_link_id,
          c.target_schema,
          c.target_table,
          c.target_record_id,
          c.field_name,
          c.old_value,
          c.new_value,
          c.correction_type,
          c.affects_business_result,
          c.recalculation_status,
          c.corrected_by,
          c.corrected_at,
          c.metadata
         from public.ai_business_corrections c
        where exists (
          select 1
            from public.document_business_links bl
           where bl.entry_plan_id = $1
             and (
               c.business_link_id = bl.id
               or (
                 coalesce(c.target_schema, '') = coalesce(bl.target_schema, '')
                 and coalesce(c.target_table, '') = coalesce(bl.target_table, '')
                 and coalesce(c.target_record_id, '') = coalesce(bl.target_record_id, '')
               )
             )
        )
        order by c.corrected_at desc, c.id desc
        limit 200`,
      [entryPlanId]
    );
    const relatedLogConditions = [];
    const relatedLogParams = [];
    const batchId = normalizeText(row.batch_id || '', 120);
    const fileHash = normalizeText(row.file_hash || '', 128);
    if (batchId) {
      relatedLogParams.push(batchId);
      relatedLogConditions.push(`e.ai_import_batch_id::text = $${relatedLogParams.length}`);
    }
    if (fileHash) {
      relatedLogParams.push(fileHash);
      relatedLogConditions.push(`e.source_file_hash = $${relatedLogParams.length}`);
    }
    const relatedLogs = relatedLogConditions.length
      ? await query(
        `select
            e.id,
            e.level,
            e.event_type,
            e.message,
            e.stack,
            e.device_id,
            d.device_code,
            coalesce(d.device_name, e.device_name) as device_name,
            e.user_id,
            e.username,
            e.role,
            e.app_module,
            e.route,
            e.url,
            e.request_url,
            e.status_code,
            e.client_session_id,
            e.trace_id,
            e.ai_import_batch_id,
            e.source_file_hash,
            e.app_version,
            e.webview_version,
            e.metadata,
            e.created_at
           from public.client_log_events e
           left join public.collector_devices d on d.id = e.device_id
          where (${relatedLogConditions.join(' or ')})
          order by e.created_at desc, e.id desc
          limit 100`,
        relatedLogParams
      )
      : { rows: [] };
    const metadata = asJsonObject(row.metadata);
    sendJson(res, 200, {
      ok: true,
      entryResult: mapEntryResultDetailRow(row),
      businessLinks: businessLinks.rows.map(mapBusinessLinkRow),
      unmappedFields: unmappedFields.rows.map(mapUnmappedFieldRow),
      businessCorrections: businessCorrections.rows.map(mapBusinessCorrectionRow),
      relatedLogs: relatedLogs.rows.map(mapLogListRow),
      rejectedRows: asJsonArray(metadata.rejected_rows)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'ENTRY_RESULT_DETAIL_FAILED', message: error.message || 'Entry result detail failed' });
  }
}

async function insertClientLog(device, event) {
  const payload = asJsonObject(event);
  await query(
    `insert into public.client_log_events (
       level, event_type, message, stack, device_id, device_name, user_id, username, role,
       app_module, route, url, request_url, status_code, client_session_id, trace_id,
       ai_import_batch_id, source_file_hash, app_version, webview_version, metadata, created_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,coalesce($22::timestamptz, now())
     )`,
    [
      normalizeText(payload.level || 'info', 20),
      normalizeText(payload.eventType || payload.event_type || 'collector_event', 80),
      normalizeText(payload.message || '', 4000),
      normalizeText(payload.stack || '', 12000),
      device.id,
      normalizeText(payload.deviceName || payload.device_name || device.device_name || '', 200),
      normalizeText(payload.userId || payload.user_id || '', 120),
      normalizeText(payload.username || '', 160),
      normalizeText(payload.role || '', 120),
      normalizeText(payload.appModule || payload.app_module || '', 120),
      normalizeText(payload.route || '', 500),
      normalizeText(payload.url || '', 1000),
      normalizeText(payload.requestUrl || payload.request_url || '', 1000),
      Number.isFinite(Number(payload.statusCode ?? payload.status_code)) ? Number(payload.statusCode ?? payload.status_code) : null,
      normalizeText(payload.clientSessionId || payload.client_session_id || '', 120),
      normalizeText(payload.traceId || payload.trace_id || '', 160),
      toUuidOrNull(payload.aiImportBatchId || payload.ai_import_batch_id || ''),
      normalizeText(payload.sourceFileHash || payload.source_file_hash || '', 128),
      normalizeText(payload.appVersion || payload.app_version || '', 80),
      normalizeText(payload.webViewVersion || payload.webview_version || '', 120),
      payload.metadataJson || payload.metadata || {},
      toIsoOrNull(payload.createdAt || payload.created_at || '')
    ]
  );
}

async function handleBindDevice(req, res, { sendJson, readJsonBody }) {
  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const authorizationCode = normalizeText(body.authorizationCode || body.authorization_code || '', 200);
  const enterpriseCode = normalizeText(body.enterpriseCode || body.enterprise_code || '', 120);
  const deviceCode = normalizeText(body.deviceCode || body.device_code || '', 120);
  const deviceName = normalizeText(body.deviceName || body.device_name || deviceCode, 200);
  if (!authorizationCode || !enterpriseCode || !deviceCode) {
    sendJson(res, 400, { code: 'BIND_FIELDS_REQUIRED', message: 'enterpriseCode, deviceCode and authorizationCode are required' });
    return;
  }

  const authHash = sha256(authorizationCode);
  const client = await pool.connect();
  try {
    await client.query('begin');

    const existing = await client.query(
      `select *
         from public.collector_devices
        where enterprise_id = $1
          and device_code = $2
        for update`,
      [enterpriseCode, deviceCode]
    );
    let device = existing.rows[0] || null;
    const matchesStoredCode = device?.binding_code_hash && device.binding_code_hash === authHash;
    const matchesBootstrapCode = bootstrapBindCode && authorizationCode === bootstrapBindCode;

    if (!matchesStoredCode && !matchesBootstrapCode) {
      await client.query('rollback');
      sendJson(res, 403, { code: 'BIND_CODE_INVALID', message: 'Device authorization code is invalid' });
      return;
    }

    const deviceToken = randomToken();
    const tokenHash = sha256(deviceToken);
    const metadata = {
      windows_username: normalizeText(body.windowsUsername || body.windows_username || '', 240),
      bind_source: matchesStoredCode ? 'device_binding_code' : 'bootstrap_bind_code'
    };

    if (!device) {
      const inserted = await client.query(
        `insert into public.collector_devices (
           device_code, device_name, enterprise_id, default_user_id, default_username,
           default_role, device_token_hash, client_version, status, last_seen_at, metadata
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,'active',now(),$9)
         returning *`,
        [
          deviceCode,
          deviceName,
          enterpriseCode,
          normalizeText(body.defaultUserId || body.default_user_id || '', 120),
          normalizeText(body.defaultUsername || body.default_username || '', 160),
          normalizeText(body.defaultRole || body.default_role || '', 120),
          tokenHash,
          normalizeText(body.clientVersion || body.client_version || '', 80),
          metadata
        ]
      );
      device = inserted.rows[0];
    } else {
      const updated = await client.query(
        `update public.collector_devices
            set enterprise_id = $2,
                device_name = $3,
                default_user_id = $4,
                default_username = $5,
                default_role = $6,
                device_token_hash = $7,
                client_version = $8,
                status = 'active',
                last_seen_at = now(),
                metadata = coalesce(metadata, '{}'::jsonb) || $9::jsonb,
                updated_at = now()
          where id = $1
          returning *`,
        [
          device.id,
          enterpriseCode,
          deviceName,
          normalizeText(body.defaultUserId || body.default_user_id || device.default_user_id || '', 120),
          normalizeText(body.defaultUsername || body.default_username || device.default_username || '', 160),
          normalizeText(body.defaultRole || body.default_role || device.default_role || '', 120),
          tokenHash,
          normalizeText(body.clientVersion || body.client_version || device.client_version || '', 80),
          metadata
        ]
      );
      device = updated.rows[0];
    }

    await client.query('commit');
    sendJson(res, 200, {
      deviceId: device.id,
      deviceToken,
      deviceCode: device.device_code,
      deviceName: device.device_name,
      defaultUserId: device.default_user_id || '',
      defaultUsername: device.default_username || '',
      defaultRole: device.default_role || ''
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    sendJson(res, 500, { code: 'DEVICE_BIND_FAILED', message: error.message || 'Device bind failed' });
  } finally {
    client.release();
  }
}

async function handleGetDeviceConfig(req, res, { sendJson }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  try {
    const watchFolders = await findWatchFoldersByDevice(device.id);
    sendJson(res, 200, buildDeviceConfig(device, watchFolders));
  } catch (error) {
    sendJson(res, 500, { code: 'DEVICE_CONFIG_FAILED', message: error.message || 'Device config failed' });
  }
}

async function handleHeartbeat(req, res, { sendJson }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  let body = {};
  try {
    const chunks = await readRawBody(req, 1024 * 1024);
    body = chunks.length ? JSON.parse(chunks.toString('utf-8')) : {};
  } catch {
    body = {};
  }

  try {
    const result = await query(
      `update public.collector_devices
          set status = 'active',
              client_version = coalesce(nullif($2, ''), client_version),
              webview_version = coalesce(nullif($3, ''), webview_version),
              last_seen_at = now(),
              metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb,
              updated_at = now()
        where id = $1
        returning id, device_code, device_name, status, last_seen_at`,
      [
        device.id,
        normalizeText(body.client_version || body.clientVersion || '', 80),
        normalizeText(body.webview_version || body.webViewVersion || '', 120),
        {
          windows_username: normalizeText(body.windows_username || body.windowsUsername || '', 240),
          heartbeat_payload: asJsonObject(body)
        }
      ]
    );
    const updatedDevice = result.rows[0] || null;
    const watchFolders = updatedDevice ? await findWatchFoldersByDevice(device.id) : [];
    const configPayload = updatedDevice ? buildDeviceConfig({ ...device, ...updatedDevice }, watchFolders) : null;
    sendJson(res, 200, {
      ok: true,
      serverTime: configPayload?.serverTime || new Date().toISOString(),
      configVersion: configPayload?.configVersion || 'default',
      device: configPayload?.device || updatedDevice,
      config: configPayload?.config || null
    });
  } catch (error) {
    sendJson(res, 500, { code: 'HEARTBEAT_FAILED', message: error.message || 'Heartbeat failed' });
  }
}

async function handleUploadAsset(req, res, { sendJson }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  let parts = {};
  try {
    const raw = await readRawBody(req, maxUploadBytes);
    parts = parseMultipart(raw, req.headers['content-type'] || '');
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_MULTIPART', message: error.message || 'Invalid multipart body' });
    return;
  }

  const filePart = parts.file;
  if (!filePart?.data?.length) {
    sendJson(res, 400, { code: 'FILE_REQUIRED', message: 'file is required' });
    return;
  }

  let metadata = {};
  try {
    metadata = readJsonPart(parts.metadata);
  } catch {
    sendJson(res, 400, { code: 'BAD_METADATA', message: 'metadata must be valid JSON' });
    return;
  }

  const originalFilename = normalizeFilename(metadata.original_filename || filePart.filename);
  const serverFileHash = sha256(filePart.data);
  const clientFileHash = normalizeText(metadata.file_hash || '', 128);
  if (clientFileHash && clientFileHash !== serverFileHash) {
    sendJson(res, 400, { code: 'FILE_HASH_MISMATCH', message: 'file_hash does not match uploaded file content' });
    return;
  }
  const fileHash = serverFileHash;
  const mimeType = normalizeMimeType(metadata.mime_type || filePart.contentType);
  const fileSize = filePart.data.length;
  const uploadSource = normalizeText(metadata.upload_source || 'collector_desktop', 80);

  const client = await pool.connect();
  try {
    await client.query('begin');

    const duplicateOf = await findExistingAssetByHash(client, fileHash);
    const duplicate = !!duplicateOf;

    let storagePath = duplicateOf?.storage_path || '';
    if (!duplicate) {
      const target = buildStoragePath(device.id, fileHash, originalFilename);
      await ensureDirectory(target.dir);
      await fs.promises.writeFile(target.fullPath, filePart.data, { flag: 'wx' }).catch(async (error) => {
        if (error?.code === 'EEXIST') return;
        throw error;
      });
      storagePath = target.fullPath;
    }

    const { asset, batch } = await createUploadAssetRecords(client, {
      device,
      metadata,
      originalFilename,
      fileHash,
      mimeType,
      fileSize,
      uploadSource,
      storagePath,
      duplicateOf,
      uploadMode: 'multipart'
    });

    await client.query('commit');
    sendJson(res, 200, {
      assetId: asset.id,
      batchId: batch.id,
      batchNo: batch.batch_no,
      duplicate,
      status: duplicate ? 'duplicate' : 'uploaded',
      message: duplicate ? 'Duplicate file recorded without re-importing' : 'Uploaded'
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    sendJson(res, 500, { code: 'ASSET_UPLOAD_FAILED', message: error.message || 'Asset upload failed' });
  } finally {
    client.release();
  }
}

async function handleInitChunkUpload(req, res, { sendJson, readJsonBody }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const originalFilename = normalizeFilename(body.originalFilename || body.original_filename || '');
  const fileHash = normalizeText(body.fileHash || body.file_hash || '', 128).toLowerCase();
  const fileSize = normalizePositiveNumber(body.fileSize || body.file_size, 0, { min: 0, max: maxUploadBytes });
  const requestedChunkSize = normalizePositiveNumber(body.chunkSize || body.chunk_size, maxChunkBytes, { min: 256 * 1024, max: maxChunkBytes });
  const totalChunks = normalizePositiveNumber(body.totalChunks || body.total_chunks, Math.ceil(fileSize / requestedChunkSize), { min: 1, max: 100000 });
  const mimeType = normalizeMimeType(body.mimeType || body.mime_type || '');
  const uploadSource = normalizeText(body.uploadSource || body.upload_source || 'collector_desktop_chunked', 80);
  const metadata = asJsonObject(body.metadata);

  if (!originalFilename || !isSha256Hex(fileHash) || !fileSize) {
    sendJson(res, 400, { code: 'CHUNK_INIT_FIELDS_REQUIRED', message: 'originalFilename, fileHash and fileSize are required' });
    return;
  }
  if (fileSize > maxUploadBytes) {
    sendJson(res, 413, { code: 'FILE_TOO_LARGE', message: 'fileSize exceeds server limit' });
    return;
  }
  if (totalChunks !== Math.ceil(fileSize / requestedChunkSize)) {
    sendJson(res, 400, { code: 'CHUNK_COUNT_MISMATCH', message: 'totalChunks does not match fileSize/chunkSize' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const duplicateOf = await findExistingAssetByHash(client, fileHash);
    if (duplicateOf) {
      await client.query('commit');
      sendJson(res, 200, {
        duplicate: true,
        status: 'duplicate',
        assetId: duplicateOf.id,
        sessionId: '',
        uploadedChunks: [],
        missingChunks: [],
        chunkSize: requestedChunkSize,
        totalChunks
      });
      return;
    }

    const sessionResult = await client.query(
      `insert into public.document_upload_sessions (
         device_id, file_hash, original_filename, mime_type, file_size,
         chunk_size, total_chunks, upload_source, status, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,'uploading',$9)
       on conflict (device_id, file_hash) do update
          set original_filename = excluded.original_filename,
              mime_type = excluded.mime_type,
              file_size = excluded.file_size,
              chunk_size = excluded.chunk_size,
              total_chunks = excluded.total_chunks,
              upload_source = excluded.upload_source,
              status = case
                when public.document_upload_sessions.status in ('completed', 'duplicate') then public.document_upload_sessions.status
                else 'uploading'
              end,
              metadata = excluded.metadata,
              last_error = null,
              updated_at = now()
       returning *`,
      [
        device.id,
        fileHash,
        originalFilename,
        mimeType,
        fileSize,
        requestedChunkSize,
        totalChunks,
        uploadSource,
        {
          ...metadata,
          client_queue_id: body.clientQueueId || body.client_queue_id || metadata.client_queue_id || null
        }
      ]
    );
    const session = sessionResult.rows[0];
    const chunks = await client.query(
      `select chunk_index
         from public.document_upload_chunks
        where session_id = $1
        order by chunk_index asc`,
      [session.id]
    );
    const uploadedChunks = chunks.rows.map((row) => Number(row.chunk_index));
    const uploadedSet = new Set(uploadedChunks);
    const missingChunks = [];
    for (let index = 0; index < totalChunks; index += 1) {
      if (!uploadedSet.has(index)) missingChunks.push(index);
    }
    await client.query(
      `update public.document_upload_sessions
          set uploaded_chunks = $2,
              updated_at = now()
        where id = $1`,
      [session.id, uploadedChunks.length]
    );
    await client.query('commit');
    sendJson(res, 200, {
      duplicate: false,
      status: session.status || 'uploading',
      sessionId: session.id,
      uploadedChunks,
      missingChunks,
      chunkSize: requestedChunkSize,
      totalChunks
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    sendJson(res, 500, { code: 'CHUNK_INIT_FAILED', message: error.message || 'Chunk init failed' });
  } finally {
    client.release();
  }
}

async function handleUploadChunk(req, res, { sendJson }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  let parts = {};
  try {
    const raw = await readRawBody(req, maxChunkBytes + 1024 * 1024);
    parts = parseMultipart(raw, req.headers['content-type'] || '');
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_CHUNK_MULTIPART', message: error.message || 'Invalid chunk multipart body' });
    return;
  }

  const chunkPart = parts.chunk;
  if (!chunkPart?.data?.length) {
    sendJson(res, 400, { code: 'CHUNK_REQUIRED', message: 'chunk is required' });
    return;
  }
  if (chunkPart.data.length > maxChunkBytes) {
    sendJson(res, 413, { code: 'CHUNK_TOO_LARGE', message: 'chunk exceeds server limit' });
    return;
  }

  let metadata = {};
  try {
    metadata = readJsonPart(parts.metadata);
  } catch {
    sendJson(res, 400, { code: 'BAD_CHUNK_METADATA', message: 'metadata must be valid JSON' });
    return;
  }

  const sessionId = toUuidOrNull(metadata.sessionId || metadata.session_id || '');
  const chunkIndex = Number(metadata.chunkIndex ?? metadata.chunk_index);
  const chunkHash = normalizeText(metadata.chunkHash || metadata.chunk_hash || '', 128).toLowerCase();
  if (!sessionId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    sendJson(res, 400, { code: 'CHUNK_FIELDS_REQUIRED', message: 'sessionId and chunkIndex are required' });
    return;
  }
  const actualChunkHash = sha256(chunkPart.data);
  if (chunkHash && chunkHash !== actualChunkHash) {
    sendJson(res, 400, { code: 'CHUNK_HASH_MISMATCH', message: 'chunkHash does not match uploaded chunk content' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const sessionResult = await client.query(
      `select *
         from public.document_upload_sessions
        where id = $1
          and device_id = $2
        for update`,
      [sessionId, device.id]
    );
    const session = sessionResult.rows[0] || null;
    if (!session) {
      await client.query('rollback');
      sendJson(res, 404, { code: 'UPLOAD_SESSION_NOT_FOUND', message: 'Upload session not found' });
      return;
    }
    if (['completed', 'duplicate', 'cancelled'].includes(session.status)) {
      await client.query('rollback');
      sendJson(res, 409, { code: 'UPLOAD_SESSION_CLOSED', message: `Upload session is ${session.status}` });
      return;
    }
    if (chunkIndex >= Number(session.total_chunks)) {
      await client.query('rollback');
      sendJson(res, 400, { code: 'CHUNK_INDEX_OUT_OF_RANGE', message: 'chunkIndex exceeds totalChunks' });
      return;
    }

    const isLast = chunkIndex === Number(session.total_chunks) - 1;
    const expectedSize = isLast
      ? Number(session.file_size) - Number(session.chunk_size) * (Number(session.total_chunks) - 1)
      : Number(session.chunk_size);
    if (chunkPart.data.length !== expectedSize) {
      await client.query('rollback');
      sendJson(res, 400, { code: 'CHUNK_SIZE_MISMATCH', message: 'chunk size does not match upload session' });
      return;
    }

    const existingChunkResult = await client.query(
      `select chunk_index, chunk_size, chunk_hash, storage_path
         from public.document_upload_chunks
        where session_id = $1
          and chunk_index = $2
        for update`,
      [session.id, chunkIndex]
    );
    const existingChunk = existingChunkResult.rows[0] || null;
    if (existingChunk) {
      const existingHash = normalizeText(existingChunk.chunk_hash || '', 128).toLowerCase();
      const existingSize = Number(existingChunk.chunk_size);
      if (existingHash !== actualChunkHash || existingSize !== chunkPart.data.length) {
        await client.query('rollback');
        sendJson(res, 409, {
          code: 'CHUNK_CONFLICT',
          message: 'uploaded chunk conflicts with an existing chunk for this session'
        });
        return;
      }
    }

    const target = buildChunkPath(device.id, session.id, chunkIndex);
    await ensureDirectory(target.dir);
    await fs.promises.writeFile(target.fullPath, chunkPart.data);
    await client.query(
      `insert into public.document_upload_chunks (
         session_id, chunk_index, chunk_size, chunk_hash, storage_path
       ) values ($1,$2,$3,$4,$5)
       on conflict (session_id, chunk_index) do update
          set chunk_size = excluded.chunk_size,
              chunk_hash = excluded.chunk_hash,
              storage_path = excluded.storage_path`,
      [session.id, chunkIndex, chunkPart.data.length, actualChunkHash, target.fullPath]
    );
    const countResult = await client.query(
      `select count(*)::integer as count
         from public.document_upload_chunks
        where session_id = $1`,
      [session.id]
    );
    const uploadedCount = Number(countResult.rows[0]?.count || 0);
    await client.query(
      `update public.document_upload_sessions
          set uploaded_chunks = $2,
              status = 'uploading',
              last_error = null,
              updated_at = now()
        where id = $1`,
      [session.id, uploadedCount]
    );
    await client.query('commit');
    sendJson(res, 200, {
      ok: true,
      sessionId: session.id,
      chunkIndex,
      duplicate: !!existingChunk,
      uploadedChunks: uploadedCount,
      totalChunks: Number(session.total_chunks)
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    sendJson(res, 500, { code: 'CHUNK_UPLOAD_FAILED', message: error.message || 'Chunk upload failed' });
  } finally {
    client.release();
  }
}

async function handleCompleteChunkUpload(req, res, { sendJson, readJsonBody }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const sessionId = toUuidOrNull(body.sessionId || body.session_id || '');
  if (!sessionId) {
    sendJson(res, 400, { code: 'SESSION_ID_REQUIRED', message: 'sessionId is required' });
    return;
  }

  const client = await pool.connect();
  let assembledPath = '';
  try {
    await client.query('begin');
    const sessionResult = await client.query(
      `select *
         from public.document_upload_sessions
        where id = $1
          and device_id = $2
        for update`,
      [sessionId, device.id]
    );
    const session = sessionResult.rows[0] || null;
    if (!session) {
      await client.query('rollback');
      sendJson(res, 404, { code: 'UPLOAD_SESSION_NOT_FOUND', message: 'Upload session not found' });
      return;
    }

    const chunksResult = await client.query(
      `select chunk_index, chunk_size, chunk_hash, storage_path
         from public.document_upload_chunks
        where session_id = $1
        order by chunk_index asc`,
      [session.id]
    );
    const chunks = chunksResult.rows;
    const missingChunks = [];
    const byIndex = new Map(chunks.map((row) => [Number(row.chunk_index), row]));
    for (let index = 0; index < Number(session.total_chunks); index += 1) {
      if (!byIndex.has(index)) missingChunks.push(index);
    }
    if (missingChunks.length) {
      await client.query('rollback');
      sendJson(res, 409, { code: 'UPLOAD_CHUNKS_MISSING', message: 'Upload chunks are missing', missingChunks });
      return;
    }

    const duplicateOf = await findExistingAssetByHash(client, session.file_hash);
    let finalStoragePath = duplicateOf?.storage_path || '';
    if (!duplicateOf) {
      const target = buildStoragePath(device.id, session.file_hash, session.original_filename);
      assembledPath = target.fullPath;
      await assembleChunks(chunks, target.fullPath);
      const assembledHash = await hashFile(target.fullPath);
      const stat = await fs.promises.stat(target.fullPath);
      if (assembledHash !== session.file_hash || stat.size !== Number(session.file_size)) {
        await fs.promises.rm(target.fullPath, { force: true }).catch(() => {});
        await client.query(
          `update public.document_upload_sessions
              set status = 'failed',
                  last_error = $2,
                  updated_at = now()
            where id = $1`,
          [session.id, 'assembled file hash or size mismatch']
        );
        await client.query('commit');
        sendJson(res, 400, { code: 'ASSEMBLED_FILE_MISMATCH', message: 'assembled file hash or size mismatch' });
        return;
      }
      finalStoragePath = target.fullPath;
    }

    const metadata = asJsonObject(session.metadata);
    const { asset, batch, duplicate } = await createUploadAssetRecords(client, {
      device,
      metadata,
      originalFilename: session.original_filename,
      fileHash: session.file_hash,
      mimeType: session.mime_type,
      fileSize: Number(session.file_size),
      uploadSource: session.upload_source || 'collector_desktop_chunked',
      storagePath: finalStoragePath,
      duplicateOf,
      uploadMode: 'chunked'
    });
    await client.query(
      `update public.document_upload_sessions
          set status = $2,
              storage_path = $3,
              uploaded_chunks = total_chunks,
              completed_at = now(),
              last_error = null,
              updated_at = now()
        where id = $1`,
      [session.id, duplicate ? 'duplicate' : 'completed', finalStoragePath]
    );
    await client.query('commit');
    sendJson(res, 200, {
      assetId: asset.id,
      batchId: batch.id,
      batchNo: batch.batch_no,
      duplicate,
      status: duplicate ? 'duplicate' : 'uploaded',
      message: duplicate ? 'Duplicate file recorded without re-importing' : 'Chunked upload completed'
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    if (assembledPath) await fs.promises.rm(assembledPath, { force: true }).catch(() => {});
    sendJson(res, 500, { code: 'CHUNK_COMPLETE_FAILED', message: error.message || 'Chunk complete failed' });
  } finally {
    client.release();
  }
}

async function handleLogBatch(req, res, { sendJson, readJsonBody }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  let body = {};
  try {
    body = await readJsonBody(req, 8 * 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
  if (!events.length) {
    sendJson(res, 200, { ok: true, inserted: 0 });
    return;
  }

  try {
    for (const event of events) {
      await insertClientLog(device, event);
    }
    sendJson(res, 200, { ok: true, inserted: events.length });
  } catch (error) {
    sendJson(res, 500, { code: 'CLIENT_LOG_UPLOAD_FAILED', message: error.message || 'Client log upload failed' });
  }
}

function createDocumentIntakeHandlers(deps) {
  return {
    handleBindDevice: (req, res) => handleBindDevice(req, res, deps),
    handleGetOverview: (req, res) => handleGetOverview(req, res, deps),
    handleListAssets: (req, res) => handleListAssets(req, res, deps),
    handleListDevices: (req, res) => handleListDevices(req, res, deps),
    handleListDeviceWatchFolders: (req, res) => handleListDeviceWatchFolders(req, res, deps),
    handleCreateWatchFolder: (req, res) => handleCreateWatchFolder(req, res, deps),
    handleUpdateWatchFolder: (req, res) => handleUpdateWatchFolder(req, res, deps),
    handleUpdateWatchFolderStatus: (req, res) => handleUpdateWatchFolderStatus(req, res, deps),
    handleDeleteWatchFolder: (req, res) => handleDeleteWatchFolder(req, res, deps),
    handleUpdateDeviceStatus: (req, res) => handleUpdateDeviceStatus(req, res, deps),
    handleResetDeviceBindingCode: (req, res) => handleResetDeviceBindingCode(req, res, deps),
    handleListLogs: (req, res) => handleListLogs(req, res, deps),
    handleListEntryResults: (req, res) => handleListEntryResults(req, res, deps),
    handleGetEntryResultDetail: (req, res) => handleGetEntryResultDetail(req, res, deps),
    handleGetDeviceConfig: (req, res) => handleGetDeviceConfig(req, res, deps),
    handleHeartbeat: (req, res) => handleHeartbeat(req, res, deps),
    handleUploadAsset: (req, res) => handleUploadAsset(req, res, deps),
    handleInitChunkUpload: (req, res) => handleInitChunkUpload(req, res, deps),
    handleUploadChunk: (req, res) => handleUploadChunk(req, res, deps),
    handleCompleteChunkUpload: (req, res) => handleCompleteChunkUpload(req, res, deps),
    handleLogBatch: (req, res) => handleLogBatch(req, res, deps)
  };
}

module.exports = {
  createDocumentIntakeHandlers
};
