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

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: positiveInteger(process.env.PGPORT, 5432, { min: 1, max: 65535 }),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: positiveInteger(process.env.DOCUMENT_INTAKE_PG_POOL_MAX, 5, { min: 1, max: 50 })
});

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
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

function toUuidOrNull(value) {
  const text = normalizeText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
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
            set device_name = $3,
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
    sendJson(res, 200, { ok: true, device: result.rows[0] || null });
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

    const duplicateResult = await client.query(
      `select id, storage_path
         from public.document_assets
        where file_hash = $1
          and status <> 'duplicate'
        order by created_at asc
        limit 1`,
      [fileHash]
    );
    const duplicateOf = duplicateResult.rows[0] || null;
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
          windows_username: metadata.windows_username || ''
        }
      ]
    );
    const batch = batchResult.rows[0];

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
        storagePath,
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
          source_device_name: device.device_name
        }
      ]
    );
    const asset = assetResult.rows[0];

    if (!duplicate) {
      await client.query(
        `insert into public.document_parse_jobs (asset_id, batch_id, status, metadata)
         values ($1, $2, 'pending', $3)`,
        [asset.id, batch.id, { reason: 'created_after_upload' }]
      );
    }

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
    handleHeartbeat: (req, res) => handleHeartbeat(req, res, deps),
    handleUploadAsset: (req, res) => handleUploadAsset(req, res, deps),
    handleLogBatch: (req, res) => handleLogBatch(req, res, deps)
  };
}

module.exports = {
  createDocumentIntakeHandlers
};
