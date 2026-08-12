// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const {
  documentIntakePolicy,
  getDocumentIntakePolicy,
  getDocumentIntakePolicyState,
  resetDocumentIntakePolicy,
  setDocumentIntakePolicy,
  resolveEntryPlanImportPolicy
} = require('./document-intake-policy');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

const defaultStorageRoot = path.join(__dirname, 'data', 'document-intake');
const storageRoot = envText(process.env.DOCUMENT_INTAKE_STORAGE_DIR) || defaultStorageRoot;
const defaultCollectorReleaseRoot = path.join(__dirname, 'data', 'collector-releases');
const collectorReleaseRoot = envText(process.env.COLLECTOR_RELEASE_DIR) || defaultCollectorReleaseRoot;
const bootstrapBindCode = envText(process.env.COLLECTOR_BIND_AUTH_CODE, '');

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function positiveNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
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
const maxBasicParseTextBytes = positiveInteger(
  process.env.DOCUMENT_INTAKE_BASIC_PARSE_TEXT_BYTES,
  512 * 1024,
  { min: 8 * 1024, max: 2 * 1024 * 1024 }
);
const defaultCollectorAllowedExtensions = [
  '.xlsx',
  '.xls',
  '.csv',
  '.docx',
  '.doc',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.bmp',
  '.gif',
  '.webp',
  '.txt',
  '.zip',
  '.rar',
  '.7z'
];

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

function escapeLikePattern(value) {
  return String(value ?? '').replace(/[%_]/g, '\\$&');
}

const sensitiveLogKeyRegex = /^(authorization|authorization_code|authorizationCode|auth_code|authCode|bind_code|bindCode|binding_code|bindingCode|device_bind_code|deviceBindCode|cookie|set-cookie|setCookie|token|authToken|sessionToken|jwt|password|passwd|secret|client_secret|clientSecret|csrf_token|csrfToken|x-csrf-token|xCsrfToken|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|api_key|apiKey|apikey|x-api-key|xApiKey|device_token|deviceToken)$/i;
const sensitiveLogJsonValueRegex = /(?<prefix>["']?(?:authorization|authorization_code|authorizationCode|auth_code|authCode|bind_code|bindCode|binding_code|bindingCode|device_bind_code|deviceBindCode|cookie|set-cookie|setCookie|token|authToken|sessionToken|jwt|password|passwd|secret|client_secret|clientSecret|csrf_token|csrfToken|x-csrf-token|xCsrfToken|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|api_key|apiKey|apikey|x-api-key|xApiKey|device_token|deviceToken)["']?\s*:\s*["'])(?<value>[^"']*)(?<suffix>["'])/gi;
const sensitiveLogAssignmentRegex = /\b(?<key>authorization|authorization_code|authorizationCode|auth_code|authCode|bind_code|bindCode|binding_code|bindingCode|device_bind_code|deviceBindCode|cookie|set-cookie|setCookie|token|authToken|sessionToken|jwt|password|passwd|secret|client_secret|clientSecret|csrf_token|csrfToken|x-csrf-token|xCsrfToken|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|api_key|apiKey|apikey|x-api-key|xApiKey|device_token|deviceToken)\b\s*[:=]\s*(?<value>[^&\s,;}\]]+)/gi;
const sensitiveLogQueryRegex = /(?<prefix>[?&](?:authorization|authorization_code|authorizationCode|auth|auth_code|authCode|bind_code|bindCode|binding_code|bindingCode|device_bind_code|deviceBindCode|token|authToken|sessionToken|jwt|password|passwd|secret|client_secret|clientSecret|csrf_token|csrfToken|x-csrf-token|xCsrfToken|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|api_key|apiKey|apikey|device_token|deviceToken)=)(?<value>[^&#\s]+)/gi;
const sensitiveLogHeaderLineRegex = /\b(?<prefix>(?:authorization|cookie|set-cookie)\s*:\s*)(?<value>[^\r\n]+)/gi;
const bearerLogTokenRegex = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const jwtLogTokenRegex = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;
const urlUserInfoLogRegex = /(?<scheme>https?:\/\/)(?<userinfo>[^/@\s:]+:[^/@\s]+)@/gi;
const phoneLogRegex = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const idCardLogRegex = /(?<!\d)\d{6}(19|20)\d{2}(0[1-9]|1[0-2])([0-2]\d|3[0-1])\d{3}[0-9Xx](?!\d)/g;

function sanitizeLogText(value) {
  if (value === undefined || value === null) return '';
  let text = String(value);
  text = text.replace(sensitiveLogJsonValueRegex, '$<prefix>***$<suffix>');
  text = text.replace(sensitiveLogQueryRegex, '$<prefix>***');
  text = text.replace(sensitiveLogHeaderLineRegex, '$<prefix>***');
  text = text.replace(bearerLogTokenRegex, '$1 ***');
  text = text.replace(sensitiveLogAssignmentRegex, '$<key>=***');
  text = text.replace(jwtLogTokenRegex, '***');
  text = text.replace(urlUserInfoLogRegex, '$<scheme>***@');
  text = text.replace(phoneLogRegex, (match) => `${match.slice(0, 3)}****${match.slice(-4)}`);
  text = text.replace(idCardLogRegex, (match) => `${match.slice(0, 6)}********${match.slice(-4)}`);
  return text;
}

function sanitizeLogMetadata(value) {
  if (Array.isArray(value)) return value.map(sanitizeLogMetadata);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveLogKeyRegex.test(key) ? '***' : sanitizeLogMetadata(item)
      ])
    );
  }
  return typeof value === 'string' ? sanitizeLogText(value) : value;
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

function isPathInsideStorageRoot(filePath) {
  const root = path.resolve(storageRoot);
  const target = path.resolve(String(filePath || ''));
  return target === root || target.startsWith(root + path.sep);
}

function contentDispositionAttachment(filename) {
  const safeName = normalizeFilename(filename || 'document-asset.bin');
  const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'document-asset.bin';
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

function isBasicTextAsset(filename, mimeType) {
  const ext = path.extname(filename || '').toLowerCase();
  if (['.txt', '.csv', '.tsv', '.log', '.json', '.md'].includes(ext)) return true;
  const mime = normalizeText(mimeType, 160).toLowerCase();
  return mime.startsWith('text/') || ['application/json', 'application/csv'].includes(mime);
}

async function readBasicTextAsset(storagePath) {
  const handle = await fs.promises.open(storagePath, 'r');
  try {
    const buffer = Buffer.alloc(maxBasicParseTextBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBasicParseTextBytes, 0);
    return buffer.subarray(0, bytesRead).toString('utf8').replace(/\u0000/g, '').trim();
  } finally {
    await handle.close().catch(() => {});
  }
}

function collectorReleaseContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.zip') return 'application/zip';
  if (ext === '.exe') return 'application/vnd.microsoft.portable-executable';
  if (ext === '.msi') return 'application/octet-stream';
  return 'application/octet-stream';
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

function normalizeCollectorReleaseFilename(value) {
  let decoded = '';
  try {
    decoded = decodeURIComponent(String(value || '').trim());
  } catch {
    return '';
  }
  if (!decoded || decoded !== path.basename(decoded)) return '';
  if (decoded.includes('/') || decoded.includes('\\') || decoded === '.' || decoded === '..') return '';
  if (!/^[A-Za-z0-9._-]{1,220}$/.test(decoded)) return '';
  return decoded;
}

function resolveCollectorReleasePath(filename) {
  const root = path.resolve(collectorReleaseRoot);
  const fullPath = path.resolve(root, filename);
  if (fullPath !== path.join(root, filename)) return '';
  if (!fullPath.startsWith(root + path.sep)) return '';
  return fullPath;
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

function shouldAllowDuplicateReimport() {
  return documentIntakePolicy.duplicateFilePolicy === 'allow_reimport';
}

function duplicateUploadMessage(duplicate) {
  if (!duplicate) return 'Uploaded';
  if (documentIntakePolicy.duplicateFilePolicy === 'link_existing') {
    return 'Duplicate file linked to existing asset without re-importing';
  }
  return 'Duplicate file recorded without re-importing';
}

function resolveUnrecognizedFilePolicyResult() {
  const policy = documentIntakePolicy.unrecognizedFilePolicy;
  if (policy === 'reject') {
    return {
      assetStatus: 'failed',
      batchStatus: 'failed',
      action: 'reject',
      reason: 'unrecognized_file_rejected',
      manualReviewRequired: false,
      archivedOnly: false
    };
  }
  if (policy === 'archive_only') {
    return {
      assetStatus: 'archived',
      batchStatus: 'completed',
      action: 'archive_only',
      reason: 'unrecognized_file_archive_only',
      manualReviewRequired: false,
      archivedOnly: true
    };
  }
  return {
    assetStatus: 'unrecognized',
    batchStatus: 'completed',
    action: 'archive_and_review',
    reason: 'unrecognized_file_archive_and_review',
    manualReviewRequired: true,
    archivedOnly: true
  };
}

const builtinBasicDocumentClassifiers = [
  {
    targetModule: 'materials',
    targetDocumentType: '采购入库单',
    keywords: ['采购', '供应商', '送货单', '入库', '采购订单', '到货']
  },
  {
    targetModule: 'sales',
    targetDocumentType: '销售出库单',
    keywords: ['销售', '客户', '出货', '发货', '销售订单', '发票']
  },
  {
    targetModule: 'quality',
    targetDocumentType: '质检记录',
    keywords: ['质检', '检验', '合格', '不合格', '质量', '抽检']
  },
  {
    targetModule: 'production',
    targetDocumentType: '生产报工单',
    keywords: ['生产', '工单', '完工', '工序', '报工', '车间']
  },
  {
    targetModule: 'equipment',
    targetDocumentType: '设备记录',
    keywords: ['设备', '维修', '保养', '点检', '故障']
  },
  {
    targetModule: 'hr',
    targetDocumentType: '人事记录',
    keywords: ['员工', '考勤', '人事', '请假', '绩效']
  },
  {
    targetModule: 'materials',
    targetDocumentType: '物料单据',
    keywords: ['物料', '库存', '仓库', '盘点', '领料']
  }
];

function getBasicDocumentClassifiers() {
  const configuredMappings = Array.isArray(documentIntakePolicy.documentTypeMappings)
    ? documentIntakePolicy.documentTypeMappings
    : [];
  const policyClassifiers = configuredMappings
    .filter((mapping) => mapping && mapping.enabled !== false)
    .map((mapping, index) => ({
      id: mapping.id || `policy-mapping-${index + 1}`,
      name: mapping.name || mapping.targetDocumentType,
      targetModule: mapping.targetModule,
      targetDocumentType: mapping.targetDocumentType,
      targetKind: mapping.targetKind || 'fixed_module_table',
      keywords: Array.isArray(mapping.keywords) ? mapping.keywords : [],
      priority: Number.isFinite(Number(mapping.priority)) ? Number(mapping.priority) : 100,
      source: 'policy_mapping'
    }))
    .filter((mapping) => mapping.targetModule && mapping.targetDocumentType && mapping.keywords.length);

  const builtinClassifiers = builtinBasicDocumentClassifiers.map((classifier, index) => ({
    ...classifier,
    id: `builtin-keyword-${index + 1}`,
    name: classifier.targetDocumentType,
    targetKind: 'fixed_module_table',
    priority: 0,
    source: 'builtin_keyword'
  }));

  return [...policyClassifiers, ...builtinClassifiers];
}

function inferBasicDocumentClassification(text, filename) {
  const haystack = `${filename || ''}\n${text || ''}`.toLowerCase();
  const candidates = getBasicDocumentClassifiers()
    .map((classifier) => {
      const matched = classifier.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
      return {
        ...classifier,
        matched,
        score: matched.length
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) =>
      right.priority - left.priority ||
      right.score - left.score ||
      left.targetModule.localeCompare(right.targetModule)
    );

  if (!candidates.length) return null;
  const winner = candidates[0];
  const fromPolicy = winner.source === 'policy_mapping';
  return {
    targetModule: winner.targetModule,
    targetDocumentType: winner.targetDocumentType,
    targetKind: winner.targetKind || 'fixed_module_table',
    confidence: Math.min(fromPolicy ? 0.96 : 0.92, 0.62 + winner.score * 0.1 + (fromPolicy ? 0.04 : 0)),
    reason: `${fromPolicy ? '单据类型映射策略' : '基础文本解析'}命中关键词：${winner.matched.join('、')}`,
    mappingSource: winner.source,
    mappingId: winner.id,
    mappingPriority: winner.priority,
    candidates: candidates.slice(0, 5).map((candidate) => ({
      target_module: candidate.targetModule,
      target_document_type: candidate.targetDocumentType,
      target_kind: candidate.targetKind || 'fixed_module_table',
      score: candidate.score,
      matched_keywords: candidate.matched,
      mapping_source: candidate.source,
      mapping_id: candidate.id,
      mapping_priority: candidate.priority
    }))
  };
}

function countBasicTextLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
}

function extractBasicTextFields(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^([^:：=]{1,80})\s*[:：=]\s*(.{1,1000})$/);
      if (!match) return null;
      const name = normalizeText(match[1], 80);
      const value = normalizeText(match[2], 1000);
      if (!name || !value) return null;
      return {
        name,
        value,
        confidence: 0.78,
        source: `第${index + 1}行`
      };
    })
    .filter(Boolean)
    .slice(0, 100);
}

function extractBasicTextTables(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headerIndex = lines.findIndex((line) => line.includes('\t') || line.includes(','));
  if (headerIndex < 0 || headerIndex >= lines.length - 1) return [];

  const delimiter = lines[headerIndex].includes('\t') ? '\t' : lines[headerIndex].includes(',') ? ',' : '';
  if (!delimiter) return [];

  const headers = lines[headerIndex].split(delimiter).map((item) => normalizeText(item, 80)).filter(Boolean).slice(0, 40);
  if (headers.length < 2) return [];

  const rows = lines.slice(headerIndex + 1, headerIndex + 101)
    .filter((line) => line.includes(delimiter))
    .map((line) => line.split(delimiter).map((item) => normalizeText(item, 500)))
    .filter((values) => values.some(Boolean))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));

  return rows.length
    ? [{ name: 'table_1', columns: headers, rows }]
    : [];
}

function buildAiUnmappedRemarks(fields, originalFilename) {
  const normalizedFields = Array.isArray(fields)
    ? fields
      .map((field) => ({
        name: normalizeText(field?.name, 80),
        value: normalizeText(field?.value, 1000)
      }))
      .filter((field) => field.name && field.value)
      .slice(0, 100)
    : [];

  if (!normalizedFields.length) return '';

  const lines = ['【AI未匹配字段】'];
  for (const field of normalizedFields) {
    lines.push(`${field.name}：${field.value}`);
  }

  const filename = normalizeText(originalFilename, 255);
  if (filename) {
    lines.push(`来源文件：${filename}`);
  }

  return normalizeText(lines.join('\n'), 4000);
}

function buildBasicEntryPlanDocuments({ text, fields, tables, classification, lineCount, originalFilename }) {
  const aiUnmappedRemarks = buildAiUnmappedRemarks(fields, originalFilename);
  const tablesPreview = tables.map((table) => ({
    name: table.name || 'table',
    columns: Array.isArray(table.columns) ? table.columns : [],
    rows: Array.isArray(table.rows) ? table.rows : []
  })).slice(0, 2);

  return [{
    source: 'basic_text',
    source_asset_filename: originalFilename,
    target_module: classification.targetModule,
    target_document_type: classification.targetDocumentType,
    suggested_mode: lineCount > 1 ? 'one_document_with_lines' : 'one_document',
    fields: Object.fromEntries(fields.map((field) => [field.name, field.value])),
    line_items: tables[0]?.rows || [],
    tables_preview: tablesPreview,
    extracted_text_preview: normalizeText(text, 1200),
    field_mapping_status: 'basic_text_extracted',
    unmapped_fields: fields,
    unmapped_field_policy: 'remarks_or_properties',
    ai_unmapped_remarks: aiUnmappedRemarks,
    remarks: aiUnmappedRemarks,
    raw_excerpt: normalizeText(text, 2000),
    line_count: lineCount,
    properties: {
      __ai_unmapped_fields: fields,
      __ai_unmapped_write_location: aiUnmappedRemarks ? 'remarks' : ''
    }
  }];
}

async function tryProcessBasicTextParseJob(client, { parseJobId, assetId, batchId, originalFilename, mimeType, storagePath }) {
  if (!parseJobId || !assetId || !isBasicTextAsset(originalFilename, mimeType)) {
    return { processed: false };
  }

  await client.query(
    `update public.document_parse_jobs
        set status = 'running',
            parser_type = 'basic_text',
            started_at = now(),
            updated_at = now()
      where id = $1`,
    [parseJobId]
  );

  try {
    const text = await readBasicTextAsset(storagePath);
    const lineCount = countBasicTextLines(text);
    const fields = extractBasicTextFields(text);
    const tables = extractBasicTextTables(text);
    await client.query(
      `insert into public.document_parse_results (
         asset_id, parse_job_id, text_content, tables, layout, ocr_result, image_descriptions, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        assetId,
        parseJobId,
        text,
        tables,
        {
          parser: 'basic_text',
          line_count: lineCount,
          field_count: fields.length,
          table_count: tables.length,
          truncated: text.length >= maxBasicParseTextBytes
        },
        {},
        [],
        { parser: 'basic_text', original_filename: originalFilename, mime_type: mimeType }
      ]
    );

    const classification = inferBasicDocumentClassification(text, originalFilename);
    if (classification) {
      await client.query(
        `insert into public.document_classification_results (
           asset_id, batch_id, target_module, target_document_type, target_kind,
           confidence, reason, candidates, metadata
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          assetId,
          batchId,
          classification.targetModule,
          classification.targetDocumentType,
          classification.targetKind,
          classification.confidence,
          classification.reason,
          classification.candidates,
          {
            classifier: classification.mappingSource === 'policy_mapping'
              ? 'document_type_mapping_policy'
              : 'basic_text_keyword',
            mapping_source: classification.mappingSource,
            mapping_id: classification.mappingId,
            mapping_priority: classification.mappingPriority
          }
        ]
      );
      const entryPlanPolicy = resolveEntryPlanImportPolicy(classification);
      const entryPlanResult = await client.query(
        `insert into public.document_entry_plans (
           asset_id, batch_id, target_module, target_document_type, target_kind,
           mode, document_count, line_count, confidence, reason, documents, status, metadata
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         returning id`,
        [
          assetId,
          batchId,
          classification.targetModule,
          classification.targetDocumentType,
          classification.targetKind,
          lineCount > 1 ? 'one_document_with_lines' : 'one_document',
          1,
          Math.max(1, lineCount),
          classification.confidence,
          classification.reason,
          buildBasicEntryPlanDocuments({ text, fields, tables, classification, lineCount, originalFilename }),
          entryPlanPolicy.status,
          {
            planner: 'basic_text_keyword',
            document_type_mapping_source: classification.mappingSource,
            document_type_mapping_id: classification.mappingId,
            document_type_mapping_priority: classification.mappingPriority,
            auto_import_ready: entryPlanPolicy.autoImportReady,
            next_step: entryPlanPolicy.autoImportReady ? 'fixed_module_business_adapter' : 'manual_review_or_archive',
            default_auto_import_mode: documentIntakePolicy.defaultAutoImportMode,
            low_confidence_policy: documentIntakePolicy.lowConfidencePolicy,
            confidence_threshold: documentIntakePolicy.confidenceThreshold,
            low_confidence: entryPlanPolicy.lowConfidence,
            manual_review_required: entryPlanPolicy.manualReviewRequired,
            auto_import_policy_action: entryPlanPolicy.action,
            auto_import_policy_reason: entryPlanPolicy.reason,
            unmapped_field_policy: 'remarks',
            unmapped_field_count: fields.length,
            ai_unmapped_remarks: buildAiUnmappedRemarks(fields, originalFilename),
            field_count: fields.length,
            table_count: tables.length
          }
        ]
      );
      const entryPlanId = entryPlanResult.rows[0]?.id || null;
      for (const field of fields) {
        await client.query(
          `insert into public.document_unmapped_fields (
             asset_id, batch_id, entry_plan_id, name, value, confidence, source, write_location, metadata
           ) values ($1,$2,$3,$4,$5,$6,$7,'remarks',$8)`,
          [
            assetId,
            batchId,
            entryPlanId,
            field.name,
            field.value,
            field.confidence,
            field.source,
            {
              extractor: 'basic_text_key_value',
              write_location: 'remarks',
              remarks_text: buildAiUnmappedRemarks([field], originalFilename)
            }
          ]
        );
      }
      await client.query(
        `update public.document_assets
            set status = 'classified',
                updated_at = now(),
                metadata = metadata || $2::jsonb
          where id = $1`,
        [assetId, JSON.stringify({ basic_parse_status: 'classified', line_count: lineCount, field_count: fields.length, table_count: tables.length })]
      );
      await client.query(
        `update public.document_import_batches
            set status = $2,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
          where id = $1`,
        [
          batchId,
          entryPlanPolicy.autoImportReady ? 'classifying' : 'completed',
          JSON.stringify({
            auto_import_ready: entryPlanPolicy.autoImportReady,
            auto_import_policy_action: entryPlanPolicy.action,
            auto_import_policy_reason: entryPlanPolicy.reason,
            manual_review_required: entryPlanPolicy.manualReviewRequired
          })
        ]
      );
    } else {
      const unrecognizedPolicy = resolveUnrecognizedFilePolicyResult();
      await client.query(
        `update public.document_assets
            set status = $2,
                updated_at = now(),
                metadata = metadata || $3::jsonb
          where id = $1`,
        [
          assetId,
          unrecognizedPolicy.assetStatus,
          JSON.stringify({
            basic_parse_status: 'unrecognized',
            line_count: lineCount,
            unrecognized_file_policy: documentIntakePolicy.unrecognizedFilePolicy,
            unrecognized_policy_action: unrecognizedPolicy.action,
            unrecognized_policy_reason: unrecognizedPolicy.reason,
            manual_review_required: unrecognizedPolicy.manualReviewRequired,
            archived_only: unrecognizedPolicy.archivedOnly
          })
        ]
      );
      await client.query(
        `update public.document_import_batches
            set status = $2,
                finished_at = now(),
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = now()
          where id = $1`,
        [
          batchId,
          unrecognizedPolicy.batchStatus,
          JSON.stringify({
            unrecognized_file_policy: documentIntakePolicy.unrecognizedFilePolicy,
            unrecognized_policy_action: unrecognizedPolicy.action,
            unrecognized_policy_reason: unrecognizedPolicy.reason,
            manual_review_required: unrecognizedPolicy.manualReviewRequired,
            archived_only: unrecognizedPolicy.archivedOnly,
            auto_import_ready: false
          })
        ]
      );
    }

    await client.query(
      `update public.document_parse_jobs
          set status = 'success',
              finished_at = now(),
              updated_at = now(),
              metadata = metadata || $2::jsonb
        where id = $1`,
      [
        parseJobId,
        JSON.stringify({
          parser: 'basic_text',
          line_count: lineCount,
          classified: !!classification,
          unrecognized_file_policy: classification ? undefined : documentIntakePolicy.unrecognizedFilePolicy
        })
      ]
    );
    return { processed: true, classified: !!classification };
  } catch (error) {
    await client.query(
      `update public.document_parse_jobs
          set status = 'failed',
              last_error = $2,
              finished_at = now(),
              updated_at = now()
        where id = $1`,
      [parseJobId, normalizeText(error.message || 'Basic text parse failed', 1000)]
    );
    await client.query(
      `update public.document_assets
          set status = 'failed',
              updated_at = now(),
              metadata = metadata || $2::jsonb
        where id = $1`,
      [assetId, JSON.stringify({ basic_parse_status: 'failed' })]
    );
    return { processed: true, failed: true };
  }
}

function resolveUploadedByRole(metadata = {}, device = {}) {
  return normalizeText(
    metadata.uploaded_by_role ||
    metadata.uploadedByRole ||
    metadata.default_role ||
    metadata.defaultRole ||
    device.default_role ||
    '',
    160
  );
}

function resolveUploadOperatorSource(metadata = {}, owner = {}) {
  const explicit = normalizeText(metadata.operator_source || metadata.operatorSource || '', 80);
  if (explicit) return explicit;

  if (!owner.uploadedByUserId && !owner.uploadedByUsername) {
    return 'unknown';
  }

  return 'device_default_user';
}

async function createUploadAssetRecords(client, { device, metadata, originalFilename, fileHash, mimeType, fileSize, uploadSource, storagePath, duplicateOf = null, uploadMode = 'multipart' }) {
  const duplicate = !!duplicateOf;
  const uploadedByUserId = normalizeText(metadata.uploaded_by_user_id || metadata.uploadedByUserId || device.default_user_id || '', 120);
  const uploadedByUsername = normalizeText(metadata.uploaded_by_username || metadata.uploadedByUsername || device.default_username || '', 160);
  const uploadedByRole = resolveUploadedByRole(metadata, device);
  const operatorSource = resolveUploadOperatorSource(metadata, { uploadedByUserId, uploadedByUsername, uploadedByRole });
  const batchResult = await client.query(
    `insert into public.document_import_batches (
       device_id, uploaded_by_user_id, source, file_count, success_count,
       duplicate_count, status, started_at, finished_at, metadata
     ) values ($1,$2,$3,1,$4,$5,$6,now(),now(),$7)
     returning id, batch_no`,
    [
      device.id,
      uploadedByUserId,
      uploadSource,
      duplicate ? 0 : 1,
      duplicate ? 1 : 0,
      duplicate ? 'completed' : 'uploaded',
      {
        client_queue_id: metadata.client_queue_id || null,
        uploaded_by_username: uploadedByUsername,
        uploaded_by_role: uploadedByRole,
        operator_source: operatorSource,
        windows_username: metadata.windows_username || '',
        upload_mode: uploadMode,
        duplicate_file_policy: documentIntakePolicy.duplicateFilePolicy,
        duplicate_policy_action: duplicate
          ? documentIntakePolicy.duplicateFilePolicy
          : 'new_asset'
      }
    ]
  );
  const batch = batchResult.rows[0];

  const assetResult = await client.query(
    `insert into public.document_assets (
       batch_id, device_id, uploaded_by_user_id, uploaded_by_username, uploaded_by_role, operator_source,
       original_filename, storage_path, mime_type, file_ext, file_size, file_hash,
       source_folder, upload_source, status, duplicate_of_asset_id, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     returning id, status`,
    [
      batch.id,
      device.id,
      uploadedByUserId,
      uploadedByUsername,
      uploadedByRole,
      operatorSource,
      originalFilename,
      duplicate ? duplicateOf.storage_path : storagePath,
      mimeType,
      path.extname(originalFilename).slice(0, 40),
      fileSize,
      fileHash,
      normalizeText(metadata.source_folder || metadata.sourceFolder || '', 1000),
      uploadSource,
      duplicate ? 'duplicate' : 'uploaded',
      duplicateOf?.id || null,
      {
        ...asJsonObject(metadata),
        uploaded_by_role: uploadedByRole,
        source_device_code: device.device_code,
        source_device_name: device.device_name,
        upload_mode: uploadMode,
        duplicate_file_policy: documentIntakePolicy.duplicateFilePolicy,
        duplicate_policy_action: duplicate
          ? documentIntakePolicy.duplicateFilePolicy
          : (documentIntakePolicy.duplicateFilePolicy === 'allow_reimport' ? 'allow_reimport' : 'new_asset')
      }
    ]
  );
  const asset = assetResult.rows[0];

  if (!duplicate) {
    const parseJobResult = await client.query(
      `insert into public.document_parse_jobs (asset_id, batch_id, status, metadata)
       values ($1, $2, 'pending', $3)
       returning id`,
      [asset.id, batch.id, { reason: 'created_after_upload', upload_mode: uploadMode }]
    );
    await tryProcessBasicTextParseJob(client, {
      parseJobId: parseJobResult.rows[0]?.id || '',
      assetId: asset.id,
      batchId: batch.id,
      originalFilename,
      mimeType,
      storagePath
    });
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
  const text = normalizeText(value, 24).toLowerCase();
  if (!text) return null;
  if (['duplicate', 'duplicated', '重复'].includes(text)) return true;
  if (['non_duplicate', 'non-duplicate', 'not_duplicate', 'not-duplicate', '非重复'].includes(text)) return false;
  return normalizeBoolean(text, null);
}

function normalizeCorrectionValue(value, max = 4000) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, max);
    } catch {
      return '';
    }
  }
  return normalizeText(value, max);
}

function normalizeRecalculationStatus(value, affectsBusinessResult) {
  const text = normalizeText(value, 80).toLowerCase();
  if (text) return text;
  return affectsBusinessResult ? 'pending' : 'not_required';
}

function resolveRecalculationTaskStatus(affectsBusinessResult) {
  if (!affectsBusinessResult || documentIntakePolicy.businessCorrectionPolicy === 'record_only') return '';
  if (documentIntakePolicy.businessCorrectionPolicy === 'manual_review') return 'manual_review_required';
  return 'pending';
}

function normalizeTimestamp(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return normalizeText(value, 80);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function integerOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : 0;
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildActionHref(assetId) {
  return assetId ? `/document-intake/admin/assets/${assetId}` : '';
}

function buildDeviceActionHref(deviceId) {
  return deviceId ? `/document-intake/admin/devices/${deviceId}` : '';
}

function truthyMetadataFlag(value) {
  if (value === true) return true;
  const text = normalizeText(value, 20).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(text);
}

function buildAssetReviewState(row, businessLinkCount) {
  const entryMetadata = asJsonObject(row.entry_metadata);
  const entryStatus = normalizeText(row.entry_status || '', 80).toLowerCase();
  const manualReviewRequired = truthyMetadataFlag(entryMetadata.manual_review_required);
  if (manualReviewRequired) {
    return {
      status: 'review_required',
      reason: normalizeText(entryMetadata.auto_import_policy_reason || entryMetadata.auto_import_policy_action || '', 160)
    };
  }
  if (entryStatus === 'archived_only') {
    return {
      status: 'archived_only',
      reason: normalizeText(entryMetadata.auto_import_policy_reason || 'archived_only', 160)
    };
  }
  if (businessLinkCount > 0) {
    return { status: 'generated', reason: '' };
  }
  return { status: '', reason: '' };
}

function calculateOnlineStatus(row, activeWindowMinutes = 10) {
  const status = normalizeText(row?.status || '', 40).toLowerCase();
  if (status === 'disabled') return 'disabled';
  const lastSeen = row?.last_seen_at ? new Date(row.last_seen_at) : null;
  if (!lastSeen || Number.isNaN(lastSeen.getTime())) return 'offline';
  const ageMs = Date.now() - lastSeen.getTime();
  return status === 'active' && ageMs <= activeWindowMinutes * 60 * 1000 ? 'active' : 'offline';
}

function readHealthInteger(health, key) {
  const value = Number(health?.[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function buildDeviceHealthSummary(row) {
  const metadata = asJsonObject(row?.metadata);
  const heartbeatPayload = asJsonObject(metadata.heartbeat_payload || metadata.heartbeatPayload);
  const health = asJsonObject(heartbeatPayload.health || heartbeatPayload);
  const pendingUploadCount = readHealthInteger(health, 'pendingUploadCount');
  const failedUploadCount = readHealthInteger(health, 'failedUploadCount');
  const failedRetryReadyCount = readHealthInteger(health, 'failedRetryReadyCount');
  const failedRetryWaitingCount = readHealthInteger(health, 'failedRetryWaitingCount');
  const failedRetryExhaustedCount = readHealthInteger(health, 'failedRetryExhaustedCount');
  const missingLocalUploadFileCount = readHealthInteger(health, 'missingLocalUploadFileCount');
  const pendingLogCount = readHealthInteger(health, 'pendingLogCount');
  const missingWatchFolderCount = readHealthInteger(health, 'missingWatchFolderCount');
  const inaccessibleWatchFolderCount = readHealthInteger(health, 'inaccessibleWatchFolderCount');
  return {
    uploadBacklogCount: pendingUploadCount + failedUploadCount + failedRetryReadyCount + failedRetryWaitingCount + failedRetryExhaustedCount + missingLocalUploadFileCount,
    pendingUploadCount,
    failedUploadCount,
    failedRetryExhaustedCount,
    missingLocalUploadFileCount,
    pendingLogCount,
    missingWatchFolderCount,
    inaccessibleWatchFolderCount
  };
}

function mapAssetListRow(row) {
  const businessLinkCount = integerOrZero(row.business_link_count);
  const plannedDocumentCount = integerOrZero(row.document_count);
  const entryMetadata = asJsonObject(row.entry_metadata);
  const assetMetadata = asJsonObject(row.metadata);
  const reviewState = buildAssetReviewState(row, businessLinkCount);
  return {
    id: row.id,
    batchId: row.batch_id || '',
    batchNo: row.batch_no || '',
    batchStatus: row.batch_status || '',
    batchSource: row.batch_source || '',
    originalFilename: row.original_filename || '',
    deviceId: row.device_id || '',
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: normalizeText(
      row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || '',
      160
    ),
    operatorSource: row.operator_source || '',
    uploadedAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    mimeType: row.mime_type || '',
    fileExt: row.file_ext || '',
    fileSize: integerOrZero(row.file_size),
    fileHash: row.file_hash || '',
    sourceFolder: row.source_folder || '',
    uploadSource: row.upload_source || '',
    status: row.status || '',
    entryPlanId: row.entry_plan_id || '',
    entryStatus: row.entry_status || '',
    entryMetadata,
    reviewStatus: reviewState.status,
    reviewReason: reviewState.reason,
    targetModule: row.entry_target_module || row.classification_target_module || '',
    targetDocumentType: row.entry_target_document_type || row.classification_target_document_type || '',
    targetKind: row.entry_target_kind || row.classification_target_kind || '',
    generatedDocumentCount: businessLinkCount || plannedDocumentCount,
    plannedDocumentCount,
    businessLinkCount,
    unmappedFieldCount: integerOrZero(row.unmapped_field_count),
    confidence: numberOrNull(row.entry_confidence ?? row.classification_confidence),
    classificationConfidence: numberOrNull(row.classification_confidence),
    entryConfidence: numberOrNull(row.entry_confidence),
    duplicate: !!row.duplicate,
    duplicateOfAssetId: row.duplicate_of_asset_id || '',
    duplicateOfOriginalFilename: row.duplicate_of_original_filename || '',
    duplicateOfFileHash: row.duplicate_of_file_hash || '',
    duplicateOfUploadedAt: normalizeTimestamp(row.duplicate_of_uploaded_at),
    duplicateOfUploadSource: row.duplicate_of_upload_source || '',
    actionHref: buildActionHref(row.id),
    metadata: assetMetadata
  };
}

function mapAssetDetailRow(row) {
  return {
    ...mapAssetListRow(row),
    storagePath: row.storage_path || '',
    batchNo: row.batch_no || '',
    batchStatus: row.batch_status || '',
    batchSource: row.batch_source || ''
  };
}

function mapCollectorAssetStatusRow(row) {
  const businessLinkCount = integerOrZero(row.business_link_count);
  const unmappedFieldCount = integerOrZero(row.unmapped_field_count);
  const assetStatus = normalizeStatus(row.asset_status || row.status || '', 'uploaded');
  const parseStatus = normalizeStatus(row.parse_status || '', '');
  const entryStatus = normalizeStatus(row.entry_status || '', '');
  const batchStatus = normalizeStatus(row.batch_status || '', '');
  return {
    assetId: row.id || row.asset_id || '',
    batchId: row.batch_id || '',
    batchNo: row.batch_no || '',
    assetStatus,
    batchStatus,
    parseStatus,
    entryStatus,
    businessLinkCount,
    unmappedFieldCount,
    duplicate: !!row.duplicate,
    actionHref: buildActionHref(row.id || row.asset_id || ''),
    updatedAt: normalizeTimestamp(row.updated_at || row.created_at),
    message: buildCollectorAssetStatusMessage({
      assetStatus,
      batchStatus,
      parseStatus,
      entryStatus,
      businessLinkCount,
      unmappedFieldCount
    })
  };
}

function buildCollectorAssetStatusMessage(status) {
  if (status.businessLinkCount > 0) return `已生成 ${status.businessLinkCount} 条业务链接`;
  if (status.entryStatus) return `入库计划状态：${status.entryStatus}`;
  if (status.parseStatus) return `解析任务状态：${status.parseStatus}`;
  if (status.batchStatus) return `批次状态：${status.batchStatus}`;
  return `资产状态：${status.assetStatus || 'uploaded'}`;
}

function mapParseJobRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id || '',
    batchId: row.batch_id || '',
    status: row.status || '',
    parserType: row.parser_type || '',
    retryCount: integerOrZero(row.retry_count),
    lastError: row.last_error || '',
    startedAt: normalizeTimestamp(row.started_at),
    finishedAt: normalizeTimestamp(row.finished_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    metadata: asJsonObject(row.metadata)
  };
}

function mapParseResultRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id || '',
    parseJobId: row.parse_job_id || '',
    textContent: row.text_content || '',
    tables: asJsonArray(row.tables),
    layout: asJsonObject(row.layout),
    ocrResult: asJsonObject(row.ocr_result),
    imageDescriptions: asJsonArray(row.image_descriptions),
    metadata: asJsonObject(row.metadata),
    createdAt: normalizeTimestamp(row.created_at)
  };
}

function mapClassificationRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id || '',
    batchId: row.batch_id || '',
    targetModule: row.target_module || '',
    targetDocumentType: row.target_document_type || '',
    targetKind: row.target_kind || '',
    confidence: numberOrNull(row.confidence),
    reason: row.reason || '',
    candidates: asJsonArray(row.candidates),
    metadata: asJsonObject(row.metadata),
    createdAt: normalizeTimestamp(row.created_at)
  };
}

function mapEntryPlanRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id || '',
    batchId: row.batch_id || '',
    targetModule: row.target_module || '',
    targetDocumentType: row.target_document_type || '',
    targetKind: row.target_kind || '',
    appId: row.app_id || '',
    appName: row.app_name || '',
    targetSchema: row.target_schema || '',
    targetTable: row.target_table || '',
    mode: row.mode || '',
    documentCount: integerOrZero(row.document_count),
    lineCount: integerOrZero(row.line_count),
    confidence: numberOrNull(row.confidence),
    reason: row.reason || '',
    columnsSnapshot: asJsonArray(row.columns_snapshot),
    documents: asJsonArray(row.documents),
    status: row.status || '',
    metadata: asJsonObject(row.metadata),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function mapBusinessLinkRow(row) {
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
    aiConfidence: numberOrNull(row.ai_confidence),
    metadata: asJsonObject(row.metadata),
    createdAt: normalizeTimestamp(row.created_at)
  };
}

function mapBusinessSourceRow(row) {
  const assetMetadata = asJsonObject(row.asset_metadata);
  const businessLinkMetadata = asJsonObject(row.business_link_metadata);
  return {
    businessLink: {
      id: row.business_link_id || row.id || '',
      assetId: row.asset_id || '',
      batchId: row.business_link_batch_id || row.batch_id || '',
      entryPlanId: row.entry_plan_id || '',
      targetSchema: row.target_schema || '',
      targetTable: row.target_table || '',
      targetRecordId: row.target_record_id || '',
      targetModule: row.business_target_module || row.target_module || '',
      targetDocumentType: row.business_target_document_type || row.target_document_type || '',
      targetAppId: row.target_app_id || '',
      aiConfidence: numberOrNull(row.ai_confidence),
      duplicateBusinessSource: normalizeBoolean(
        row.duplicate_business_source ?? businessLinkMetadata.duplicate_business_source ?? businessLinkMetadata.duplicateBusinessSource,
        false
      ),
      metadata: businessLinkMetadata,
      createdAt: normalizeTimestamp(row.business_link_created_at)
    },
    asset: {
      id: row.asset_id || '',
      originalFilename: row.original_filename || '',
      fileHash: row.file_hash || '',
      mimeType: row.mime_type || '',
      fileExt: row.file_ext || '',
      fileSize: integerOrZero(row.file_size),
      status: row.asset_status || row.status || '',
      duplicate: !!row.duplicate,
      duplicateOfAssetId: row.duplicate_of_asset_id || '',
      sourceFolder: row.source_folder || '',
      uploadSource: row.upload_source || '',
      operatorSource: row.operator_source || '',
      uploadedByUserId: row.uploaded_by_user_id || '',
      uploadedByUsername: row.uploaded_by_username || '',
      uploadedByRole: normalizeText(
        row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || '',
        160
      ),
      uploadedAt: normalizeTimestamp(row.asset_created_at || row.created_at),
      deviceId: row.device_id || '',
      deviceCode: row.device_code || '',
      deviceName: row.device_name || '',
      batchId: row.asset_batch_id || row.batch_id || '',
      batchNo: row.batch_no || '',
      batchStatus: row.batch_status || '',
      metadata: assetMetadata,
      actionHref: buildActionHref(row.asset_id || row.id)
    }
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
    confidence: numberOrNull(row.confidence),
    source: row.source || '',
    writeLocation: row.write_location || '',
    metadata: asJsonObject(row.metadata),
    createdAt: normalizeTimestamp(row.created_at)
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
    correctedAt: normalizeTimestamp(row.corrected_at),
    metadata: asJsonObject(row.metadata)
  };
}

function mapRecalculationTaskRow(row) {
  const assetMetadata = asJsonObject(row.asset_metadata);
  return {
    id: row.id,
    correctionId: row.correction_id || '',
    businessLinkId: row.business_link_id || '',
    targetSchema: row.target_schema || '',
    targetTable: row.target_table || '',
    targetRecordId: row.target_record_id || '',
    taskType: row.task_type || '',
    status: row.status || '',
    priority: integerOrZero(row.priority),
    attemptCount: integerOrZero(row.attempt_count),
    nextAttemptAt: normalizeTimestamp(row.next_attempt_at),
    lockedAt: normalizeTimestamp(row.locked_at),
    lockedBy: row.locked_by || '',
    requestedBy: row.requested_by || '',
    requestedAt: normalizeTimestamp(row.requested_at),
    completedAt: normalizeTimestamp(row.completed_at),
    lastError: row.last_error || '',
    assetId: row.asset_id || '',
    sourceFilename: row.original_filename || row.source_filename || '',
    fileHash: row.file_hash || '',
    assetStatus: row.asset_status || '',
    uploadSource: row.upload_source || '',
    operatorSource: row.operator_source || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: normalizeText(
      row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || '',
      160
    ),
    sourceFolder: row.source_folder || '',
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    batchNo: row.batch_no || '',
    batchStatus: row.batch_status || '',
    targetModule: row.target_module || row.business_target_module || '',
    targetDocumentType: row.target_document_type || row.business_target_document_type || '',
    metadata: asJsonObject(row.metadata)
  };
}

function mapProductionWorkReportRow(row) {
  const assetMetadata = asJsonObject(row.asset_metadata);
  const businessLinkMetadata = asJsonObject(row.business_link_metadata);
  return {
    id: row.id || '',
    reportNo: row.report_no || '',
    reportDate: normalizeTimestamp(row.report_date),
    workOrderId: row.work_order_id || '',
    workOrderNo: row.work_order_no || '',
    productMaterialId: row.product_material_id === undefined || row.product_material_id === null ? null : Number(row.product_material_id),
    productMaterialCode: row.product_material_code || '',
    productMaterialName: row.product_material_name || '',
    processName: row.process_name || '',
    workshopName: row.workshop_name || '',
    productionLine: row.production_line || '',
    shiftName: row.shift_name || '',
    teamName: row.team_name || '',
    completedQty: numberOrZero(row.completed_qty),
    goodQty: numberOrZero(row.good_qty),
    defectQty: numberOrZero(row.defect_qty),
    scrapQty: numberOrZero(row.scrap_qty),
    unit: row.unit || '',
    operator: row.operator || '',
    reportStatus: row.report_status || 'active',
    remark: row.remark || '',
    properties: asJsonObject(row.properties),
    createdBy: row.created_by || '',
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    businessLinkId: row.business_link_id || '',
    duplicateBusinessSource: normalizeBoolean(
      row.duplicate_business_source ?? businessLinkMetadata.duplicate_business_source ?? businessLinkMetadata.duplicateBusinessSource,
      false
    ),
    assetId: row.asset_id || '',
    sourceFilename: row.original_filename || row.source_filename || '',
    fileHash: row.file_hash || '',
    assetStatus: row.asset_status || '',
    uploadSource: row.upload_source || '',
    operatorSource: row.operator_source || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: normalizeText(
      row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || '',
      160
    ),
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    sourceFolder: row.source_folder || '',
    batchNo: row.batch_no || '',
    batchStatus: row.batch_status || '',
    assetMetadata
  };
}

function mapQualityInspectionRow(row) {
  const assetMetadata = asJsonObject(row.asset_metadata);
  const businessLinkMetadata = asJsonObject(row.business_link_metadata);
  return {
    id: row.id || '',
    docNo: row.doc_no || '',
    inspectionType: row.inspection_type || '',
    sourceDocNo: row.source_doc_no || '',
    itemCode: row.item_code || '',
    itemName: row.item_name || '',
    sourceName: row.source_name || '',
    batchNo: row.inspection_batch_no || row.batch_no || '',
    sampleQty: numberOrZero(row.sample_qty),
    defectQty: numberOrZero(row.defect_qty),
    result: row.result || '',
    inspector: row.inspector || '',
    inspectionDate: normalizeTimestamp(row.inspection_date),
    remark: row.remark || '',
    status: row.status || '',
    properties: asJsonObject(row.properties),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    businessLinkId: row.business_link_id || '',
    duplicateBusinessSource: normalizeBoolean(
      row.duplicate_business_source ?? businessLinkMetadata.duplicate_business_source ?? businessLinkMetadata.duplicateBusinessSource,
      false
    ),
    assetId: row.asset_id || '',
    sourceFilename: row.original_filename || row.source_filename || '',
    fileHash: row.file_hash || '',
    assetStatus: row.asset_status || '',
    uploadSource: row.upload_source || '',
    operatorSource: row.operator_source || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: normalizeText(
      row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || '',
      160
    ),
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    sourceFolder: row.source_folder || '',
    importBatchNo: row.import_batch_no || '',
    batchStatus: row.import_batch_status || row.batch_status || '',
    assetMetadata
  };
}

function mapHrAttendanceSnapshotRow(row) {
  const assetMetadata = asJsonObject(row.asset_metadata);
  const businessLinkMetadata = asJsonObject(row.business_link_metadata);
  return {
    id: row.id || '',
    employeeMonthKey: row.employee_month_key || '',
    employeeId: row.employee_id || '',
    employeeNo: row.employee_no || '',
    employeeName: row.employee_name || '',
    deptName: row.dept_name || '',
    month: row.month || '',
    recordCount: integerOrZero(row.record_count),
    leaveCount: integerOrZero(row.leave_count),
    absentCount: integerOrZero(row.absent_count),
    lateCount: integerOrZero(row.late_count),
    earlyCount: integerOrZero(row.early_count),
    overtimeMinutes: integerOrZero(row.overtime_minutes),
    firstAttDate: normalizeTimestamp(row.first_att_date),
    lastAttDate: normalizeTimestamp(row.last_att_date),
    sourceTargetSchema: row.source_target_schema || '',
    sourceTargetTable: row.source_target_table || '',
    sourceTargetRecordId: row.source_target_record_id || '',
    lastTaskId: row.last_task_id || '',
    lastCorrectionId: row.last_correction_id || '',
    lastBusinessLinkId: row.last_business_link_id || '',
    duplicateBusinessSource: normalizeBoolean(
      row.duplicate_business_source ?? businessLinkMetadata.duplicate_business_source ?? businessLinkMetadata.duplicateBusinessSource,
      false
    ),
    sourceFilename: row.original_filename || '',
    fileHash: row.file_hash || '',
    assetId: row.asset_id || '',
    uploadSource: row.upload_source || '',
    operatorSource: row.operator_source || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: normalizeText(
      row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || '',
      160
    ),
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    sourceFolder: row.source_folder || '',
    batchNo: row.batch_no || '',
    batchStatus: row.batch_status || '',
    taskStatus: row.task_status || '',
    taskRequestedBy: row.task_requested_by || '',
    taskCompletedAt: normalizeTimestamp(row.task_completed_at),
    confirmationStatus: row.confirmation_status || 'pending_confirmation',
    confirmationNote: row.confirmation_note || '',
    confirmedBy: row.confirmed_by || '',
    confirmedAt: normalizeTimestamp(row.confirmed_at),
    rejectedBy: row.rejected_by || '',
    rejectedAt: normalizeTimestamp(row.rejected_at),
    rejectionReason: row.rejection_reason || '',
    payrollPrecheckStatus: row.payroll_precheck_status || 'not_requested',
    payrollPrecheckRequestedBy: row.payroll_precheck_requested_by || '',
    payrollPrecheckRequestedAt: normalizeTimestamp(row.payroll_precheck_requested_at),
    payrollPrecheckNote: row.payroll_precheck_note || '',
    summary: asJsonObject(row.summary),
    assetMetadata,
    recalculatedAt: normalizeTimestamp(row.recalculated_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function mapPayrollPrecheckAttendanceSnapshotRow(row) {
  const assetMetadata = asJsonObject(row.asset_metadata);
  const businessLinkMetadata = asJsonObject(row.business_link_metadata);
  return {
    id: row.id || row.snapshot_id || '',
    snapshotId: row.snapshot_id || row.id || '',
    employeeMonthKey: row.employee_month_key || '',
    employeeId: row.employee_id || '',
    employeeNo: row.employee_no || '',
    employeeName: row.employee_name || '',
    deptName: row.dept_name || '',
    month: row.month || '',
    recordCount: integerOrZero(row.record_count),
    leaveCount: integerOrZero(row.leave_count),
    absentCount: integerOrZero(row.absent_count),
    lateCount: integerOrZero(row.late_count),
    earlyCount: integerOrZero(row.early_count),
    overtimeMinutes: integerOrZero(row.overtime_minutes),
    firstAttDate: normalizeTimestamp(row.first_att_date),
    lastAttDate: normalizeTimestamp(row.last_att_date),
    sourceTargetSchema: row.source_target_schema || '',
    sourceTargetTable: row.source_target_table || '',
    sourceTargetRecordId: row.source_target_record_id || '',
    lastTaskId: row.last_task_id || '',
    lastCorrectionId: row.last_correction_id || '',
    lastBusinessLinkId: row.last_business_link_id || '',
    duplicateBusinessSource: normalizeBoolean(
      row.duplicate_business_source ?? businessLinkMetadata.duplicate_business_source ?? businessLinkMetadata.duplicateBusinessSource,
      false
    ),
    sourceFilename: row.original_filename || '',
    fileHash: row.file_hash || '',
    assetId: row.asset_id || '',
    uploadSource: row.upload_source || '',
    operatorSource: row.operator_source || '',
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: normalizeText(
      row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || '',
      160
    ),
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    sourceFolder: row.source_folder || '',
    batchNo: row.batch_no || '',
    batchStatus: row.batch_status || '',
    confirmationStatus: row.confirmation_status || 'confirmed',
    confirmationNote: row.confirmation_note || '',
    confirmedBy: row.confirmed_by || '',
    confirmedAt: normalizeTimestamp(row.confirmed_at),
    payrollPrecheckStatus: row.payroll_precheck_status || row.precheck_status || 'ready',
    payrollPrecheckRequestedBy: row.payroll_precheck_requested_by || '',
    payrollPrecheckRequestedAt: normalizeTimestamp(row.payroll_precheck_requested_at),
    payrollPrecheckNote: row.payroll_precheck_note || '',
    precheckStatus: row.precheck_status || 'ready',
    readOnlyReference: row.read_only_reference !== false,
    payrollMutationAllowed: row.payroll_mutation_allowed === true,
    payrollReference: asJsonObject(row.payroll_reference),
    summary: asJsonObject(row.summary),
    assetMetadata,
    recalculatedAt: normalizeTimestamp(row.recalculated_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function mapPayrollPrecheckResultRow(row) {
  const assetMetadata = asJsonObject(row.asset_metadata);
  const sourceSnapshotReference = asJsonObject(row.source_snapshot_reference);
  const businessLinkMetadata = asJsonObject(
    row.business_link_metadata ||
    sourceSnapshotReference.business_link_metadata ||
    sourceSnapshotReference.businessLinkMetadata
  );
  return {
    id: row.id || '',
    snapshotId: row.snapshot_id || '',
    employeeMonthKey: row.employee_month_key || '',
    employeeId: row.employee_id || '',
    employeeNo: row.employee_no || '',
    employeeName: row.employee_name || '',
    deptName: row.dept_name || '',
    month: row.month || '',
    recordCount: integerOrZero(row.record_count),
    leaveCount: integerOrZero(row.leave_count),
    absentCount: integerOrZero(row.absent_count),
    lateCount: integerOrZero(row.late_count),
    earlyCount: integerOrZero(row.early_count),
    overtimeMinutes: integerOrZero(row.overtime_minutes),
    firstAttDate: normalizeTimestamp(row.first_att_date),
    lastAttDate: normalizeTimestamp(row.last_att_date),
    sourceTargetSchema: row.source_target_schema || sourceSnapshotReference.source_target_schema || '',
    sourceTargetTable: row.source_target_table || sourceSnapshotReference.source_target_table || '',
    sourceTargetRecordId: row.source_target_record_id || sourceSnapshotReference.source_target_record_id || '',
    lastBusinessLinkId: row.last_business_link_id || sourceSnapshotReference.last_business_link_id || sourceSnapshotReference.lastBusinessLinkId || '',
    duplicateBusinessSource: normalizeBoolean(
      row.duplicate_business_source ??
        businessLinkMetadata.duplicate_business_source ??
        businessLinkMetadata.duplicateBusinessSource ??
        sourceSnapshotReference.duplicate_business_source ??
        sourceSnapshotReference.duplicateBusinessSource,
      false
    ),
    assetId: row.asset_id || sourceSnapshotReference.asset_id || '',
    sourceFilename: row.source_filename || sourceSnapshotReference.source_filename || row.original_filename || '',
    fileHash: row.file_hash || sourceSnapshotReference.file_hash || '',
    deviceCode: row.device_code || '',
    deviceName: row.device_name || '',
    batchNo: row.batch_no || '',
    uploadSource: row.upload_source || sourceSnapshotReference.upload_source || '',
    operatorSource: row.operator_source || sourceSnapshotReference.operator_source || '',
    uploadedByUserId: row.uploaded_by_user_id || sourceSnapshotReference.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || sourceSnapshotReference.uploaded_by_username || '',
    uploadedByRole: normalizeText(
      row.uploaded_by_role || assetMetadata.uploaded_by_role || assetMetadata.uploadedByRole || sourceSnapshotReference.uploaded_by_role || '',
      160
    ),
    sourceFolder: row.source_folder || sourceSnapshotReference.source_folder || '',
    batchStatus: row.batch_status || sourceSnapshotReference.batch_status || '',
    assetMetadata,
    trialStatus: row.trial_status || 'draft',
    calculationVersion: row.calculation_version || 'attendance-precheck-v1',
    calculationBasis: asJsonObject(row.calculation_basis),
    resultPayload: asJsonObject(row.result_payload),
    generatedBy: row.generated_by || '',
    generatedAt: normalizeTimestamp(row.generated_at),
    reviewedBy: row.reviewed_by || '',
    reviewedAt: normalizeTimestamp(row.reviewed_at),
    reviewNote: row.review_note || '',
    sourceSnapshotReference,
    noPayrollMutation: row.no_payroll_mutation !== false,
    readOnlyReference: row.read_only_reference === true,
    payrollReference: asJsonObject(row.payroll_reference),
    payrollMutationAllowed: false,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function mapClientLogRow(row) {
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
    statusCode: row.status_code === undefined || row.status_code === null ? null : Number(row.status_code),
    clientSessionId: row.client_session_id || '',
    traceId: row.trace_id || '',
    aiImportBatchId: row.ai_import_batch_id || '',
    aiImportBatchNo: row.ai_import_batch_no || row.batch_no || '',
    sourceFileHash: row.source_file_hash || '',
    sourceAssetId: row.source_asset_id || '',
    sourceAssetCount: integerOrZero(row.source_asset_count),
    assetStatus: row.asset_status || '',
    duplicate: row.duplicate === true,
    uploadedByUserId: row.uploaded_by_user_id || '',
    uploadedByUsername: row.uploaded_by_username || '',
    uploadedByRole: row.uploaded_by_role || '',
    uploadSource: row.upload_source || '',
    operatorSource: row.operator_source || '',
    sourceFolder: row.source_folder || '',
    appVersion: row.app_version || '',
    webviewVersion: row.webview_version || '',
    metadata: asJsonObject(row.metadata),
    createdAt: normalizeTimestamp(row.created_at)
  };
}

function mapWatchFolderRow(row) {
  const metadata = asJsonObject(row.metadata);
  return {
    id: row.id || '',
    deviceId: row.device_id || '',
    folderPath: row.folder_path || '',
    folderName: row.folder_name || '',
    defaultUserId: row.default_user_id || '',
    defaultUsername: row.default_username || metadata.defaultUsername || metadata.default_username || '',
    defaultRole: row.default_role || '',
    enabled: row.enabled !== false,
    metadata,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function mapDeviceRow(row, { watchFolders = [], activeWindowMinutes = 10, includeMetadata = true } = {}) {
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
    onlineStatus: calculateOnlineStatus(row, activeWindowMinutes),
    lastSeenAt: normalizeTimestamp(row.last_seen_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    watchFolderCount: integerOrZero(row.watch_folder_count),
    todayFileCount: integerOrZero(row.today_file_count),
    totalFileCount: integerOrZero(row.total_file_count),
    logCount: integerOrZero(row.log_count),
    healthSummary: buildDeviceHealthSummary(row),
    lastAssetAt: normalizeTimestamp(row.last_asset_at),
    actionHref: buildDeviceActionHref(row.id),
    watchFolders: watchFolders.map(mapWatchFolderRow),
    metadata: includeMetadata ? asJsonObject(row.metadata) : {}
  };
}

function randomBindingCode() {
  return crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase();
}

function normalizeDeviceStatus(value, fallback = 'pending') {
  const status = normalizeText(value, 40).toLowerCase();
  return ['pending', 'active', 'offline', 'disabled'].includes(status) ? status : fallback;
}

function normalizeWatchFolders(value) {
  return asJsonArray(value).slice(0, 20).map((item) => {
    const folder = asJsonObject(item);
    return {
      folderPath: normalizeText(folder.folderPath || folder.folder_path || folder.path || '', 1000),
      folderName: normalizeText(folder.folderName || folder.folder_name || folder.name || '', 200),
      defaultUserId: normalizeText(folder.defaultUserId || folder.default_user_id || '', 120),
      defaultUsername: normalizeText(folder.defaultUsername || folder.default_username || '', 160),
      defaultRole: normalizeText(folder.defaultRole || folder.default_role || '', 120),
      enabled: normalizeBoolean(folder.enabled, true)
    };
  }).filter((item) => item.folderPath);
}

async function findWatchFoldersByDevice(deviceId) {
  if (!deviceId) return [];
  const result = await query(
    `select folder_path, folder_name, default_user_id, default_username, default_role, enabled, metadata
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
  const currentPolicy = getDocumentIntakePolicy();
  const upload = asJsonObject(remote.upload);
  const logs = asJsonObject(remote.logs);
  const update = asJsonObject(remote.update);
  const remoteWatchFolders = normalizeWatchFolders(firstDefined(remote.watchFolders, remote.watch_folders));
  const storedWatchFolders = normalizeWatchFolders(watchFolderRows);
  const watchFolders = remoteWatchFolders.length ? remoteWatchFolders : storedWatchFolders;
  const autoStartEnabled = firstDefined(remote.autoStartEnabled, remote.auto_start_enabled);
  const logsEnabled = firstDefined(logs.enabled, logs.logCollectionEnabled, logs.log_collection_enabled);
  const highPriorityImmediate = firstDefined(logs.highPriorityImmediate, logs.high_priority_immediate);
  const updateAutoInstall = firstDefined(update.autoInstall, update.auto_install);
  const allowedExtensions = firstDefined(
    upload.allowedExtensions,
    upload.allowed_extensions,
    defaultCollectorAllowedExtensions
  );
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
        queueRetentionDays: positiveInteger(upload.queueRetentionDays || upload.queue_retention_days, 30, { min: 1, max: 3650 }),
        allowedExtensions: asJsonArray(allowedExtensions)
          .map((item) => normalizeText(item, 32).toLowerCase())
          .filter(Boolean)
          .slice(0, 100)
      },
      logs: {
        enabled: logsEnabled !== undefined && normalizeText(logsEnabled, 20)
          ? normalizeBoolean(logsEnabled, currentPolicy.logCollectionEnabled)
          : currentPolicy.logCollectionEnabled,
        batchSize: positiveInteger(logs.batchSize || logs.batch_size, 100, { min: 1, max: 1000 }),
        flushIntervalSeconds: positiveInteger(logs.flushIntervalSeconds || logs.flush_interval_seconds, 30, { min: 5, max: 60 * 60 }),
        retentionDays: positiveInteger(logs.retentionDays || logs.retention_days, currentPolicy.logRetentionDays, { min: 1, max: 3650 }),
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
      normalizeText(sanitizeLogText(payload.level || 'info'), 20),
      normalizeText(sanitizeLogText(payload.eventType || payload.event_type || 'collector_event'), 80),
      normalizeText(sanitizeLogText(payload.message || ''), 4000),
      normalizeText(sanitizeLogText(payload.stack || ''), 12000),
      device.id,
      normalizeText(sanitizeLogText(payload.deviceName || payload.device_name || device.device_name || ''), 200),
      normalizeText(sanitizeLogText(payload.userId || payload.user_id || ''), 120),
      normalizeText(sanitizeLogText(payload.username || ''), 160),
      normalizeText(sanitizeLogText(payload.role || ''), 120),
      normalizeText(sanitizeLogText(payload.appModule || payload.app_module || ''), 120),
      normalizeText(sanitizeLogText(payload.route || ''), 500),
      normalizeText(sanitizeLogText(payload.url || ''), 1000),
      normalizeText(sanitizeLogText(payload.requestUrl || payload.request_url || ''), 1000),
      Number.isFinite(Number(payload.statusCode ?? payload.status_code)) ? Number(payload.statusCode ?? payload.status_code) : null,
      normalizeText(sanitizeLogText(payload.clientSessionId || payload.client_session_id || ''), 120),
      normalizeText(sanitizeLogText(payload.traceId || payload.trace_id || ''), 160),
      toUuidOrNull(payload.aiImportBatchId || payload.ai_import_batch_id || ''),
      normalizeText(sanitizeLogText(payload.sourceFileHash || payload.source_file_hash || ''), 128),
      normalizeText(sanitizeLogText(payload.appVersion || payload.app_version || ''), 80),
      normalizeText(sanitizeLogText(payload.webViewVersion || payload.webview_version || ''), 120),
      sanitizeLogMetadata(payload.metadataJson || payload.metadata || {}),
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
    const webviewVersion = normalizeText(body.webViewVersion || body.webview_version || '', 120);

    if (!device) {
      const inserted = await client.query(
        `insert into public.collector_devices (
           device_code, device_name, enterprise_id, default_user_id, default_username,
           default_role, device_token_hash, client_version, webview_version, status, last_seen_at, metadata
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',now(),$10)
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
          webviewVersion,
          metadata
        ]
      );
      device = inserted.rows[0];
    } else {
      const updated = await client.query(
        `update public.collector_devices
            set device_name = $2,
                default_user_id = $3,
                default_username = $4,
                default_role = $5,
                device_token_hash = $6,
                client_version = $7,
                webview_version = coalesce(nullif($8, ''), webview_version),
                status = 'active',
                last_seen_at = now(),
                metadata = coalesce(metadata, '{}'::jsonb) || $9::jsonb,
                updated_at = now()
          where id = $1
          returning *`,
        [
          device.id,
          deviceName,
          normalizeText(body.defaultUserId || body.default_user_id || device.default_user_id || '', 120),
          normalizeText(body.defaultUsername || body.default_username || device.default_username || '', 160),
          normalizeText(body.defaultRole || body.default_role || device.default_role || '', 120),
          tokenHash,
          normalizeText(body.clientVersion || body.client_version || device.client_version || '', 80),
          webviewVersion,
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
          set status = case when status = 'disabled' then status else 'active' end,
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

    const duplicateOf = shouldAllowDuplicateReimport()
      ? null
      : await findExistingAssetByHash(client, fileHash);
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
      duplicatePolicy: documentIntakePolicy.duplicateFilePolicy,
      message: duplicateUploadMessage(duplicate)
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
    const duplicateOf = shouldAllowDuplicateReimport()
      ? null
      : await findExistingAssetByHash(client, fileHash);
    if (duplicateOf) {
      await client.query('commit');
      sendJson(res, 200, {
        duplicate: true,
        status: 'duplicate',
        duplicatePolicy: documentIntakePolicy.duplicateFilePolicy,
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
    if (shouldAllowDuplicateReimport() && ['completed', 'duplicate'].includes(session.status)) {
      await client.query(
        `update public.document_upload_sessions
            set status = 'uploading',
                storage_path = null,
                completed_at = null,
                last_error = null,
                updated_at = now()
          where id = $1`,
        [session.id]
      );
      session.status = 'uploading';
      session.storage_path = null;
      session.completed_at = null;
    }
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
      duplicatePolicy: documentIntakePolicy.duplicateFilePolicy,
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

    const duplicateOf = shouldAllowDuplicateReimport()
      ? null
      : await findExistingAssetByHash(client, session.file_hash);
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
      duplicatePolicy: documentIntakePolicy.duplicateFilePolicy,
      message: duplicate ? duplicateUploadMessage(duplicate) : 'Chunked upload completed'
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

async function findBusinessLinkForCorrection(client, { businessLinkId, targetSchema, targetTable, targetRecordId }) {
  if (businessLinkId) {
    const result = await client.query(
      `select id, target_schema, target_table, target_record_id, target_module, target_document_type, metadata
         from public.document_business_links
        where id = $1
        limit 1`,
      [businessLinkId]
    );
    return result.rows[0] || null;
  }

  if (!targetSchema || !targetTable || !targetRecordId) return null;
  const result = await client.query(
    `select id, target_schema, target_table, target_record_id, target_module, target_document_type, metadata
       from public.document_business_links
      where target_schema = $1
        and target_table = $2
        and target_record_id = $3
      order by created_at desc
      limit 1`,
    [targetSchema, targetTable, targetRecordId]
  );
  return result.rows[0] || null;
}

async function handleRecordBusinessCorrection(req, res, { sendJson, readJsonBody }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  let body = {};
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const businessLinkId = toUuidOrNull(body.businessLinkId || body.business_link_id || '');
  const rawBusinessLinkId = normalizeText(body.businessLinkId || body.business_link_id || '', 120);
  if (rawBusinessLinkId && !businessLinkId) {
    sendJson(res, 400, { code: 'CORRECTION_BUSINESS_LINK_INVALID', message: 'businessLinkId must be a UUID' });
    return;
  }

  const targetSchema = normalizeText(body.targetSchema || body.target_schema || '', 120);
  const targetTable = normalizeText(body.targetTable || body.target_table || '', 120);
  const targetRecordId = normalizeText(body.targetRecordId || body.target_record_id || body.recordId || body.record_id || '', 200);
  const fieldName = normalizeText(body.fieldName || body.field_name || '', 200);
  if (!fieldName || (!businessLinkId && (!targetSchema || !targetTable || !targetRecordId))) {
    sendJson(res, 400, {
      code: 'CORRECTION_FIELDS_REQUIRED',
      message: 'fieldName and either businessLinkId or targetSchema/targetTable/targetRecordId are required'
    });
    return;
  }

  const affectsBusinessResult = normalizeBoolean(body.affectsBusinessResult ?? body.affects_business_result, false);
  const recalculationStatus = normalizeRecalculationStatus(body.recalculationStatus || body.recalculation_status, affectsBusinessResult);
  const correctionType = normalizeText(body.correctionType || body.correction_type || 'manual_correction', 80) || 'manual_correction';
  const correctedBy = normalizeText(body.correctedBy || body.corrected_by || body.username || device.default_username || device.default_user_id || '', 160);
  const metadata = {
    ...asJsonObject(body.metadata),
    source: 'document_intake_api',
    device_id: device.id,
    device_code: device.device_code || '',
    device_name: device.device_name || '',
    business_correction_policy: documentIntakePolicy.businessCorrectionPolicy,
    trace_id: normalizeText(body.traceId || body.trace_id || '', 160) || undefined
  };
  const recalculationTaskStatus = resolveRecalculationTaskStatus(affectsBusinessResult);

  const client = await pool.connect();
  try {
    await client.query('begin');
    const businessLink = await findBusinessLinkForCorrection(client, {
      businessLinkId,
      targetSchema,
      targetTable,
      targetRecordId
    });
    if (businessLinkId && !businessLink) {
      await client.query('rollback');
      sendJson(res, 404, { code: 'BUSINESS_LINK_NOT_FOUND', message: 'Document business link was not found' });
      return;
    }

    const resolvedTargetSchema = normalizeText(businessLink?.target_schema || targetSchema, 120);
    const resolvedTargetTable = normalizeText(businessLink?.target_table || targetTable, 120);
    const resolvedTargetRecordId = normalizeText(businessLink?.target_record_id || targetRecordId, 200);

    const inserted = await client.query(
      `insert into public.ai_business_corrections (
         business_link_id, target_schema, target_table, target_record_id, field_name,
         old_value, new_value, correction_type, affects_business_result,
         recalculation_status, corrected_by, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       returning id, corrected_at`,
      [
        businessLink?.id || null,
        resolvedTargetSchema,
        resolvedTargetTable,
        resolvedTargetRecordId,
        fieldName,
        normalizeCorrectionValue(body.oldValue ?? body.old_value),
        normalizeCorrectionValue(body.newValue ?? body.new_value),
        correctionType,
        affectsBusinessResult,
        recalculationStatus,
        correctedBy,
        JSON.stringify(metadata)
      ]
    );
    const correction = inserted.rows[0];
    let recalculationTask = null;

    if (recalculationTaskStatus) {
      const taskResult = await client.query(
        `insert into public.ai_business_recalculation_tasks (
           correction_id, business_link_id, target_schema, target_table, target_record_id,
           task_type, status, priority, requested_by, metadata
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
         returning id, status, requested_at`,
        [
          correction.id,
          businessLink?.id || null,
          resolvedTargetSchema,
          resolvedTargetTable,
          resolvedTargetRecordId,
          'business_result_recalculation',
          recalculationTaskStatus,
          recalculationTaskStatus === 'manual_review_required' ? 60 : 50,
          correctedBy,
          JSON.stringify({
            source: 'document_intake_api',
            business_correction_policy: documentIntakePolicy.businessCorrectionPolicy,
            field_name: fieldName,
            correction_type: correctionType,
            affects_business_result: affectsBusinessResult,
            recalculation_status: recalculationStatus,
            trace_id: metadata.trace_id || '',
            device_id: device.id,
            device_code: device.device_code || ''
          })
        ]
      );
      recalculationTask = taskResult.rows[0] || null;
    }

    if (businessLink?.id) {
      await client.query(
        `update public.document_business_links
            set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where id = $1`,
        [
          businessLink.id,
          JSON.stringify({
            ai_review_status: 'corrected',
            last_correction_id: correction.id,
            last_corrected_at: correction.corrected_at,
            last_corrected_by: correctedBy,
            recalculation_status: recalculationStatus,
            affects_business_result: affectsBusinessResult,
            business_correction_policy: documentIntakePolicy.businessCorrectionPolicy,
            recalculation_task_id: recalculationTask?.id || null,
            recalculation_task_status: recalculationTask?.status || ''
          })
        ]
      );
    }

    await client.query('commit');
    sendJson(res, 200, {
      ok: true,
      correctionId: correction.id,
      correctedAt: correction.corrected_at,
      businessLinkId: businessLink?.id || null,
      target: {
        schema: resolvedTargetSchema,
        table: resolvedTargetTable,
        recordId: resolvedTargetRecordId
      },
      affectsBusinessResult,
      recalculationStatus,
      businessCorrectionPolicy: documentIntakePolicy.businessCorrectionPolicy,
      recalculationTask: recalculationTask
        ? {
            id: recalculationTask.id,
            status: recalculationTask.status,
            requestedAt: recalculationTask.requested_at || ''
          }
        : null
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    sendJson(res, 500, { code: 'BUSINESS_CORRECTION_FAILED', message: error.message || 'Business correction failed' });
  } finally {
    client.release();
  }
}

async function handleGetAdminOverview(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const currentPolicy = getDocumentIntakePolicy();
  const confidenceThresholdParam = url.searchParams.get('confidenceThreshold');
  const activeWindowMinutesParam = url.searchParams.get('activeWindowMinutes');
  const confidenceThreshold = positiveNumber(
    confidenceThresholdParam === null || confidenceThresholdParam === '' ? currentPolicy.confidenceThreshold : confidenceThresholdParam,
    currentPolicy.confidenceThreshold,
    { min: 0.01, max: 1 }
  );
  const activeWindowMinutes = positiveInteger(
    activeWindowMinutesParam === null || activeWindowMinutesParam === '' ? 10 : activeWindowMinutesParam,
    10,
    { min: 1, max: 24 * 60 }
  );

  try {
    const [assetMetrics, deviceMetrics, statusBreakdown, recalculationTaskMetrics] = await Promise.all([
      query(
        `with recent_assets as (
           select
             id,
             status,
             duplicate_of_asset_id,
             case
               when metadata->>'classification_confidence' ~ '^[0-9]+(\\.[0-9]+)?$'
                 then (metadata->>'classification_confidence')::numeric
               when metadata->>'entry_confidence' ~ '^[0-9]+(\\.[0-9]+)?$'
                 then (metadata->>'entry_confidence')::numeric
               else null
             end as metadata_confidence
           from public.document_assets
           where created_at >= current_date
         ),
         scored as (
           select
             a.status,
             a.duplicate_of_asset_id,
             coalesce(c.confidence, p.confidence, a.metadata_confidence) as confidence
           from recent_assets a
           left join lateral (
             select confidence
               from public.document_classification_results
              where asset_id = a.id
              order by created_at desc
              limit 1
           ) c on true
           left join lateral (
             select confidence
               from public.document_entry_plans
              where asset_id = a.id
              order by created_at desc
              limit 1
           ) p on true
         )
         select
           count(*)::integer as today_file_count,
           count(*) filter (where status in ('imported', 'partial_imported'))::integer as today_imported_count,
           count(*) filter (where status = 'classified')::integer as classified_count,
           count(*) filter (where status = 'archived')::integer as archived_count,
           count(*) filter (where confidence is not null and confidence < $1 and status not in ('duplicate', 'failed'))::integer as low_confidence_count,
           count(*) filter (where status = 'unrecognized')::integer as unrecognized_count,
           count(*) filter (where status = 'duplicate' or duplicate_of_asset_id is not null)::integer as duplicate_count,
           count(*) filter (where status = 'failed')::integer as failed_count
         from scored`,
        [confidenceThreshold]
      ),
      query(
        `select
           count(*) filter (
             where status = 'active'
               and last_seen_at >= now() - ($1::text)::interval
           )::integer as active_device_count,
           count(*) filter (
             where status <> 'disabled'
               and (
                 status <> 'active'
                 or last_seen_at is null
                 or last_seen_at < now() - ($1::text)::interval
               )
           )::integer as offline_device_count
         from public.collector_devices`,
        [`${activeWindowMinutes} minutes`]
      ),
      query(
        `select status, count(*)::integer as status_count
           from public.document_assets
          where created_at >= current_date
          group by status
          order by status`,
        []
      ),
      query(
        `select
           count(*) filter (where status in ('pending', 'manual_review_required', 'processing'))::integer as pending_recalculation_task_count,
           count(*) filter (where status = 'failed')::integer as failed_recalculation_task_count
         from public.ai_business_recalculation_tasks`,
        []
      )
    ]);

    const assetRow = assetMetrics.rows[0] || {};
    const deviceRow = deviceMetrics.rows[0] || {};
    const recalculationTaskRow = recalculationTaskMetrics.rows[0] || {};
    sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      confidenceThreshold,
      activeWindowMinutes,
      policies: {
        ...currentPolicy,
        confidenceThreshold
      },
      policyOptions: getDocumentIntakePolicyState().options,
      metrics: {
        todayFileCount: integerOrZero(assetRow.today_file_count),
        todayImportedCount: integerOrZero(assetRow.today_imported_count),
        classifiedCount: integerOrZero(assetRow.classified_count),
        archivedCount: integerOrZero(assetRow.archived_count),
        lowConfidenceCount: integerOrZero(assetRow.low_confidence_count),
        unrecognizedCount: integerOrZero(assetRow.unrecognized_count),
        duplicateCount: integerOrZero(assetRow.duplicate_count),
        failedCount: integerOrZero(assetRow.failed_count),
        activeDeviceCount: integerOrZero(deviceRow.active_device_count),
        offlineDeviceCount: integerOrZero(deviceRow.offline_device_count),
        pendingRecalculationTaskCount: integerOrZero(recalculationTaskRow.pending_recalculation_task_count),
        failedRecalculationTaskCount: integerOrZero(recalculationTaskRow.failed_recalculation_task_count)
      },
      statusBreakdown: statusBreakdown.rows.map((row) => ({
        status: row.status || '',
        count: integerOrZero(row.status_count)
      }))
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_OVERVIEW_FAILED', message: error.message || 'Failed to load document intake overview' });
  }
}

function buildAdminPolicyPayload() {
  const state = getDocumentIntakePolicyState();
  return {
    ok: true,
    policy: state.policy,
    policies: state.policy,
    options: state.options,
    policyOptions: state.options,
    source: state.source,
    policySource: state.source,
    policyFile: state.policyFile
  };
}

async function handleGetAdminPolicies(req, res, { sendJson }) {
  sendJson(res, 200, buildAdminPolicyPayload());
}

async function handleUpdateAdminPolicies(req, res, { sendJson, readJsonBody }) {
  let body = {};
  try {
    body = await readJsonBody(req, 64 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  try {
    const policyPatch = body?.policy || body?.policies || body || {};
    setDocumentIntakePolicy(policyPatch);
    sendJson(res, 200, {
      ...buildAdminPolicyPayload(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_POLICY_UPDATE_FAILED', message: error.message || 'Failed to update document intake policy' });
  }
}

async function handleResetAdminPolicies(req, res, { sendJson }) {
  try {
    resetDocumentIntakePolicy();
    sendJson(res, 200, {
      ...buildAdminPolicyPayload(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_POLICY_RESET_FAILED', message: error.message || 'Failed to reset document intake policy' });
  }
}

function normalizeDryRun(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return normalizeBoolean(value, fallback);
}

async function handleRunAdminSourceFileRetention(req, res, { sendJson, readJsonBody }) {
  let body = {};
  try {
    body = await readJsonBody(req, 64 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const policy = getDocumentIntakePolicy();
  const retentionDays = positiveInteger(
    body.retentionDays ?? body.retention_days,
    policy.sourceFileRetentionDays,
    { min: 1, max: 3650 }
  );
  const limit = positiveInteger(body.limit, 100, { min: 1, max: 1000 });
  const dryRun = normalizeDryRun(body.dryRun ?? body.dry_run, true);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const candidates = await query(
      `select id, original_filename, storage_path, file_size, created_at, metadata
         from public.document_assets
        where created_at < now() - ($1::text)::interval
          and storage_path is not null
          and storage_path <> ''
          and status <> 'duplicate'
          and coalesce(metadata->>'source_file_retention_status', '') <> 'purged'
        order by created_at asc, id asc
        limit $2`,
      [`${retentionDays} days`, limit]
    );

    const items = [];
    let deletedCount = 0;
    let missingCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    for (const row of candidates.rows) {
      const storagePath = row.storage_path || '';
      const item = {
        assetId: row.id || '',
        originalFilename: row.original_filename || '',
        storagePath,
        createdAt: row.created_at || '',
        fileSize: Number(row.file_size || 0),
        action: dryRun ? 'would_delete' : 'deleted',
        skipped: false,
        reason: ''
      };

      if (!storagePath || !isPathInsideStorageRoot(storagePath)) {
        item.action = 'skipped';
        item.skipped = true;
        item.reason = 'outside_storage_root';
        skippedCount += 1;
        items.push(item);
        continue;
      }

      let stat = null;
      try {
        stat = await fs.promises.stat(storagePath);
      } catch {
        item.action = dryRun ? 'would_mark_missing' : 'missing';
        item.reason = 'file_missing';
        missingCount += 1;
      }

      if (stat && !stat.isFile()) {
        item.action = 'skipped';
        item.skipped = true;
        item.reason = 'not_a_file';
        skippedCount += 1;
        items.push(item);
        continue;
      }

      if (!dryRun && stat?.isFile()) {
        await fs.promises.unlink(storagePath);
        deletedCount += 1;
      }

      if (!dryRun && !item.skipped) {
        await query(
          `update public.document_assets
              set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                  updated_at = now()
            where id = $1`,
          [
            row.id,
            JSON.stringify({
              source_file_retention_status: 'purged',
              source_file_retention_action: item.reason === 'file_missing' ? 'mark_missing' : 'delete_file',
              source_file_retention_days: retentionDays,
              source_file_retention_cutoff: cutoff.toISOString(),
              source_file_retention_applied_at: new Date().toISOString(),
              source_file_retention_policy: 'source_file_retention_days'
            })
          ]
        );
        updatedCount += 1;
      }

      items.push(item);
    }

    sendJson(res, 200, {
      ok: true,
      dryRun,
      retentionDays,
      cutoff: cutoff.toISOString(),
      limit,
      scannedCount: candidates.rows.length,
      deletedCount,
      missingCount,
      skippedCount,
      updatedCount,
      items
    });
  } catch (error) {
    sendJson(res, 500, { code: 'SOURCE_FILE_RETENTION_FAILED', message: error.message || 'Failed to run source file retention' });
  }
}

function buildAssetListFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const status = normalizeText(url.searchParams.get('status') || '', 50).toLowerCase();
  if (status) clauses.push(`a.status = ${addParam(status)}`);

  const duplicate = normalizeOptionalBoolean(
    url.searchParams.get('duplicate') ||
    url.searchParams.get('isDuplicate') ||
    url.searchParams.get('is_duplicate') ||
    ''
  );
  if (duplicate === true) {
    clauses.push(`(a.status = 'duplicate' or a.duplicate_of_asset_id is not null)`);
  } else if (duplicate === false) {
    clauses.push(`(a.status <> 'duplicate' and a.duplicate_of_asset_id is null)`);
  }

  const deviceId = toUuidOrNull(url.searchParams.get('deviceId') || url.searchParams.get('device_id') || '');
  if (deviceId) clauses.push(`a.device_id = ${addParam(deviceId)}::uuid`);

  const deviceCode = normalizeText(url.searchParams.get('deviceCode') || url.searchParams.get('device_code') || '', 120);
  if (deviceCode) clauses.push(`d.device_code = ${addParam(deviceCode)}`);

  const fileHash = normalizeText(url.searchParams.get('fileHash') || url.searchParams.get('file_hash') || '', 128);
  if (fileHash) clauses.push(`a.file_hash = ${addParam(fileHash)}`);

  const uploadSource = normalizeText(url.searchParams.get('uploadSource') || url.searchParams.get('upload_source') || '', 80);
  if (uploadSource) clauses.push(`a.upload_source = ${addParam(uploadSource)}`);

  const operatorSource = normalizeText(url.searchParams.get('operatorSource') || url.searchParams.get('operator_source') || '', 80);
  if (operatorSource) {
    clauses.push(`coalesce(a.operator_source, a.metadata->>'operator_source', a.metadata->>'operatorSource', '') = ${addParam(operatorSource)}`);
  }

  const sourceFolder = normalizeText(url.searchParams.get('sourceFolder') || url.searchParams.get('source_folder') || '', 1000);
  if (sourceFolder) {
    clauses.push(`a.source_folder ilike ${addParam(`%${sourceFolder.replace(/[%_]/g, '\\$&')}%`)} escape '\\'`);
  }

  const duplicateBusinessSource = normalizeOptionalBoolean(
    url.searchParams.get('duplicateBusinessSource') ||
    url.searchParams.get('duplicate_business_source') ||
    url.searchParams.get('duplicateBusiness') ||
    ''
  );
  if (duplicateBusinessSource === true) {
    clauses.push(`exists (
      select 1
        from public.document_business_links bl
       where bl.asset_id = a.id
         and lower(coalesce(bl.metadata->>'duplicate_business_source', bl.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是')
    )`);
  } else if (duplicateBusinessSource === false) {
    clauses.push(`exists (
      select 1
        from public.document_business_links bl
       where bl.asset_id = a.id
         and lower(coalesce(bl.metadata->>'duplicate_business_source', bl.metadata->>'duplicateBusinessSource', '')) not in ('true', '1', 'yes', 'y', 'on', '是')
    )`);
  }

  const uploadedBy = normalizeText(url.searchParams.get('uploadedBy') || url.searchParams.get('uploaded_by') || '', 160);
  if (uploadedBy) {
    const uploadedByParam = addParam(uploadedBy);
    clauses.push(`(
      a.uploaded_by_user_id = ${uploadedByParam}
      or a.uploaded_by_username = ${uploadedByParam}
      or coalesce(a.uploaded_by_role, a.metadata->>'uploaded_by_role', a.metadata->>'uploadedByRole', '') = ${uploadedByParam}
    )`);
  }

  const uploadedByRole = normalizeText(
    url.searchParams.get('uploadedByRole') ||
      url.searchParams.get('uploaded_by_role') ||
      url.searchParams.get('userRole') ||
      url.searchParams.get('user_role') ||
      '',
    160
  );
  if (uploadedByRole) {
    clauses.push(`coalesce(a.uploaded_by_role, a.metadata->>'uploaded_by_role', a.metadata->>'uploadedByRole', '') = ${addParam(uploadedByRole)}`);
  }

  const targetModule = normalizeText(url.searchParams.get('targetModule') || url.searchParams.get('target_module') || '', 160);
  if (targetModule) {
    const token = addParam(`%${targetModule.replace(/[%_]/g, '\\$&')}%`);
    clauses.push(`(
      exists (
        select 1
          from public.document_entry_plans ep
         where ep.asset_id = a.id
           and ep.target_module ilike ${token} escape '\\'
      )
      or exists (
        select 1
          from public.document_classification_results cr
         where cr.asset_id = a.id
           and cr.target_module ilike ${token} escape '\\'
      )
    )`);
  }

  const targetDocumentType = normalizeText(
    url.searchParams.get('targetDocumentType') ||
      url.searchParams.get('target_document_type') ||
      url.searchParams.get('documentType') ||
      url.searchParams.get('document_type') ||
      '',
    160
  );
  if (targetDocumentType) {
    const token = addParam(`%${targetDocumentType.replace(/[%_]/g, '\\$&')}%`);
    clauses.push(`(
      exists (
        select 1
          from public.document_entry_plans ep
         where ep.asset_id = a.id
           and ep.target_document_type ilike ${token} escape '\\'
      )
      or exists (
        select 1
          from public.document_classification_results cr
         where cr.asset_id = a.id
           and cr.target_document_type ilike ${token} escape '\\'
      )
    )`);
  }

  const createdFrom = toIsoOrNull(url.searchParams.get('createdFrom') || url.searchParams.get('from') || '');
  if (createdFrom) clauses.push(`a.created_at >= ${addParam(createdFrom)}::timestamptz`);

  const createdTo = toIsoOrNull(url.searchParams.get('createdTo') || url.searchParams.get('to') || '');
  if (createdTo) clauses.push(`a.created_at <= ${addParam(createdTo)}::timestamptz`);

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${search.replace(/[%_]/g, '\\$&')}%`;
    clauses.push(`(
      a.original_filename ilike ${addParam(token)} escape '\\'
      or a.file_hash ilike ${addParam(token)} escape '\\'
      or a.uploaded_by_username ilike ${addParam(token)} escape '\\'
      or coalesce(a.uploaded_by_role, a.metadata->>'uploaded_by_role', a.metadata->>'uploadedByRole', '') ilike ${addParam(token)} escape '\\'
      or d.device_code ilike ${addParam(token)} escape '\\'
      or d.device_name ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function handleListAdminAssets(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildAssetListFilters(url);

  try {
    const totalResult = await query(
      `select count(*)::integer as asset_total_count
         from public.document_assets a
         left join public.collector_devices d on d.id = a.device_id
       ${filters.whereSql}`,
      filters.params
    );

    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         a.id, a.batch_id, a.device_id, a.uploaded_by_user_id, a.uploaded_by_username,
         a.uploaded_by_role,
         a.operator_source, a.original_filename, a.mime_type, a.file_ext, a.file_size,
         a.file_hash, a.source_folder, a.upload_source, a.status, a.duplicate_of_asset_id,
         (a.status = 'duplicate' or a.duplicate_of_asset_id is not null) as duplicate,
         oa.original_filename as duplicate_of_original_filename,
         oa.file_hash as duplicate_of_file_hash,
         oa.created_at as duplicate_of_uploaded_at,
         oa.upload_source as duplicate_of_upload_source,
         a.metadata, a.created_at, a.updated_at,
         d.device_code, d.device_name,
         b.batch_no, b.status as batch_status, b.source as batch_source,
         c.target_module as classification_target_module,
         c.target_document_type as classification_target_document_type,
         c.target_kind as classification_target_kind,
         c.confidence as classification_confidence,
         p.id as entry_plan_id,
         p.target_module as entry_target_module,
         p.target_document_type as entry_target_document_type,
         p.target_kind as entry_target_kind,
         p.document_count,
         p.line_count,
         p.confidence as entry_confidence,
         p.status as entry_status,
         p.metadata as entry_metadata,
         coalesce(bl.business_link_count, 0)::integer as business_link_count,
         coalesce(uf.unmapped_field_count, 0)::integer as unmapped_field_count
       from public.document_assets a
       left join public.document_assets oa on oa.id = a.duplicate_of_asset_id
       left join public.collector_devices d on d.id = a.device_id
       left join public.document_import_batches b on b.id = a.batch_id
       left join lateral (
         select target_module, target_document_type, target_kind, confidence
           from public.document_classification_results
          where asset_id = a.id
          order by created_at desc
          limit 1
       ) c on true
       left join lateral (
         select id, target_module, target_document_type, target_kind, document_count, line_count, confidence, status, metadata
           from public.document_entry_plans
          where asset_id = a.id
          order by created_at desc
          limit 1
       ) p on true
       left join lateral (
         select count(*)::integer as business_link_count
           from public.document_business_links
          where asset_id = a.id
       ) bl on true
       left join lateral (
         select count(*)::integer as unmapped_field_count
           from public.document_unmapped_fields
          where asset_id = a.id
       ) uf on true
       ${filters.whereSql}
       order by a.created_at desc, a.id desc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      total: integerOrZero(totalResult.rows[0]?.asset_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapAssetListRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_ASSET_LIST_FAILED', message: error.message || 'Failed to load document intake assets' });
  }
}

function getAdminAssetId(req) {
  const assigned = toUuidOrNull(req?.documentIntakeAssetId || '');
  if (assigned) return assigned;
  const url = new URL(req.url || '/', 'http://localhost');
  const fromQuery = toUuidOrNull(url.searchParams.get('assetId') || url.searchParams.get('asset_id') || url.searchParams.get('id') || '');
  if (fromQuery) return fromQuery;
  const match = url.pathname.match(/\/document-intake\/admin\/assets\/([^/?#]+)/);
  if (!match) return null;
  try {
    return toUuidOrNull(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

async function handleGetAdminAssetDetail(req, res, { sendJson }) {
  const assetId = getAdminAssetId(req);
  if (!assetId) {
    sendJson(res, 400, { code: 'DOCUMENT_ASSET_ID_REQUIRED', message: 'A valid asset id is required' });
    return;
  }

  try {
    const assetResult = await query(
      `select
         a.id, a.batch_id, a.device_id, a.uploaded_by_user_id, a.uploaded_by_username,
         a.uploaded_by_role,
         a.operator_source, a.original_filename, a.storage_path, a.mime_type, a.file_ext,
         a.file_size, a.file_hash, a.source_folder, a.upload_source, a.status,
         a.duplicate_of_asset_id,
         (a.status = 'duplicate' or a.duplicate_of_asset_id is not null) as duplicate,
         oa.original_filename as duplicate_of_original_filename,
         oa.file_hash as duplicate_of_file_hash,
         oa.created_at as duplicate_of_uploaded_at,
         oa.upload_source as duplicate_of_upload_source,
         a.metadata, a.created_at, a.updated_at,
         d.device_code, d.device_name,
         b.batch_no, b.status as batch_status, b.source as batch_source,
         c.target_module as classification_target_module,
         c.target_document_type as classification_target_document_type,
         c.target_kind as classification_target_kind,
         c.confidence as classification_confidence,
         p.id as entry_plan_id,
         p.target_module as entry_target_module,
         p.target_document_type as entry_target_document_type,
         p.target_kind as entry_target_kind,
         p.document_count,
         p.line_count,
         p.confidence as entry_confidence,
         p.status as entry_status,
         p.metadata as entry_metadata,
         coalesce(bl.business_link_count, 0)::integer as business_link_count,
         coalesce(uf.unmapped_field_count, 0)::integer as unmapped_field_count
       from public.document_assets a
       left join public.document_assets oa on oa.id = a.duplicate_of_asset_id
       left join public.collector_devices d on d.id = a.device_id
       left join public.document_import_batches b on b.id = a.batch_id
       left join lateral (
         select target_module, target_document_type, target_kind, confidence
           from public.document_classification_results
          where asset_id = a.id
          order by created_at desc
          limit 1
       ) c on true
       left join lateral (
         select id, target_module, target_document_type, target_kind, document_count, line_count, confidence, status, metadata
           from public.document_entry_plans
          where asset_id = a.id
          order by created_at desc
          limit 1
       ) p on true
       left join lateral (
         select count(*)::integer as business_link_count
           from public.document_business_links
          where asset_id = a.id
       ) bl on true
       left join lateral (
         select count(*)::integer as unmapped_field_count
           from public.document_unmapped_fields
          where asset_id = a.id
       ) uf on true
       where a.id = $1`,
      [assetId]
    );
    const assetRow = assetResult.rows[0] || null;
    if (!assetRow) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_NOT_FOUND', message: 'Document asset not found' });
      return;
    }

    const [
      parseJobs,
      parseResults,
      classifications,
      entryPlans,
      businessLinks,
      unmappedFields,
      corrections,
      recalculationTasks,
      logs
    ] = await Promise.all([
      query(
        `select *
           from public.document_parse_jobs
          where asset_id = $1
          order by created_at desc`,
        [assetId]
      ),
      query(
        `select *
           from public.document_parse_results
          where asset_id = $1
          order by created_at desc`,
        [assetId]
      ),
      query(
        `select *
           from public.document_classification_results
          where asset_id = $1
          order by created_at desc`,
        [assetId]
      ),
      query(
        `select *
           from public.document_entry_plans
          where asset_id = $1
          order by created_at desc`,
        [assetId]
      ),
      query(
        `select *
           from public.document_business_links
          where asset_id = $1
          order by created_at desc`,
        [assetId]
      ),
      query(
        `select *
           from public.document_unmapped_fields
          where asset_id = $1
          order by created_at desc`,
        [assetId]
      ),
      query(
        `select c.*
           from public.ai_business_corrections c
           join public.document_business_links l on l.id = c.business_link_id
          where l.asset_id = $1
          order by c.corrected_at desc
          limit 100`,
        [assetId]
      ),
      query(
        `select t.*
           from public.ai_business_recalculation_tasks t
           join public.document_business_links l on l.id = t.business_link_id
          where l.asset_id = $1
          order by t.requested_at desc
          limit 100`,
        [assetId]
      ),
      query(
        `select
            l.*,
            $6::text as uploaded_by_user_id,
            $7::text as uploaded_by_username,
            $8::text as uploaded_by_role,
            $9::text as upload_source,
            $10::text as operator_source,
            $11::text as source_folder
           from public.client_log_events l
          where (
            ($1::uuid is not null and ai_import_batch_id = $1::uuid)
            or ($2::text <> '' and source_file_hash = $2::text)
            or (
              $3::uuid is not null
              and device_id = $3::uuid
              and created_at >= coalesce($4::timestamptz, now()) - interval '1 hour'
              and created_at <= coalesce($5::timestamptz, now()) + interval '1 day'
            )
          )
          order by created_at desc
          limit 100`,
        [
          assetRow.batch_id || null,
          assetRow.file_hash || '',
          assetRow.device_id || null,
          assetRow.created_at || null,
          assetRow.updated_at || assetRow.created_at || null,
          assetRow.uploaded_by_user_id || '',
          assetRow.uploaded_by_username || '',
          normalizeText(
            assetRow.uploaded_by_role || asJsonObject(assetRow.metadata).uploaded_by_role || asJsonObject(assetRow.metadata).uploadedByRole || '',
            160
          ),
          assetRow.upload_source || '',
          assetRow.operator_source || '',
          assetRow.source_folder || ''
        ]
      )
    ]);

    sendJson(res, 200, {
      ok: true,
      asset: mapAssetDetailRow(assetRow),
      parseJobs: parseJobs.rows.map(mapParseJobRow),
      parseResults: parseResults.rows.map(mapParseResultRow),
      classifications: classifications.rows.map(mapClassificationRow),
      entryPlans: entryPlans.rows.map(mapEntryPlanRow),
      businessLinks: businessLinks.rows.map(mapBusinessLinkRow),
      unmappedFields: unmappedFields.rows.map(mapUnmappedFieldRow),
      corrections: corrections.rows.map(mapBusinessCorrectionRow),
      recalculationTasks: recalculationTasks.rows.map(mapRecalculationTaskRow),
      logs: logs.rows.map(mapClientLogRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_ASSET_DETAIL_FAILED', message: error.message || 'Failed to load document intake asset detail' });
  }
}

function buildBusinessSourceFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const rawBusinessLinkId = normalizeText(url.searchParams.get('businessLinkId') || url.searchParams.get('business_link_id') || '', 120);
  const businessLinkId = toUuidOrNull(rawBusinessLinkId);
  if (rawBusinessLinkId && !businessLinkId) {
    return { error: { code: 'BUSINESS_LINK_ID_INVALID', message: 'businessLinkId must be a UUID' } };
  }
  if (businessLinkId) {
    clauses.push(`l.id = ${addParam(businessLinkId)}::uuid`);
  } else {
    const targetSchema = normalizeText(url.searchParams.get('targetSchema') || url.searchParams.get('target_schema') || '', 120);
    const targetTable = normalizeText(url.searchParams.get('targetTable') || url.searchParams.get('target_table') || '', 160);
    const targetRecordId = normalizeText(url.searchParams.get('targetRecordId') || url.searchParams.get('target_record_id') || url.searchParams.get('recordId') || url.searchParams.get('record_id') || '', 200);
    const targetAppId = normalizeText(url.searchParams.get('targetAppId') || url.searchParams.get('target_app_id') || url.searchParams.get('appId') || url.searchParams.get('app_id') || '', 120);

    if (targetAppId && targetRecordId) {
      clauses.push(`l.target_app_id = ${addParam(targetAppId)}`);
      clauses.push(`l.target_record_id = ${addParam(targetRecordId)}`);
    } else {
      if (!targetSchema || !targetTable || !targetRecordId) {
        return {
          error: {
            code: 'BUSINESS_SOURCE_FIELDS_REQUIRED',
            message: 'businessLinkId, targetAppId/targetRecordId, or targetSchema/targetTable/targetRecordId are required'
          }
        };
      }

      clauses.push(`l.target_schema = ${addParam(targetSchema)}`);
      clauses.push(`l.target_table = ${addParam(targetTable)}`);
      clauses.push(`l.target_record_id = ${addParam(targetRecordId)}`);
    }
  }

  const uploadSource = normalizeText(url.searchParams.get('uploadSource') || url.searchParams.get('upload_source') || '', 80);
  if (uploadSource) clauses.push(`a.upload_source = ${addParam(uploadSource)}`);

  const operatorSource = normalizeText(url.searchParams.get('operatorSource') || url.searchParams.get('operator_source') || '', 80);
  if (operatorSource) {
    clauses.push(`coalesce(a.operator_source, a.metadata->>'operator_source', a.metadata->>'operatorSource', '') = ${addParam(operatorSource)}`);
  }

  const sourceFolder = normalizeText(url.searchParams.get('sourceFolder') || url.searchParams.get('source_folder') || '', 1000);
  if (sourceFolder) {
    clauses.push(`a.source_folder ilike ${addParam(`%${sourceFolder.replace(/[%_]/g, '\\$&')}%`)} escape '\\'`);
  }

  const duplicateBusinessSource = normalizeOptionalBoolean(
    url.searchParams.get('duplicateBusinessSource') ||
    url.searchParams.get('duplicate_business_source') ||
    url.searchParams.get('duplicateBusiness') ||
    ''
  );
  if (duplicateBusinessSource === true) {
    clauses.push(`lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是')`);
  } else if (duplicateBusinessSource === false) {
    clauses.push(`lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) not in ('true', '1', 'yes', 'y', 'on', '是')`);
  }

  const uploadedBy = normalizeText(url.searchParams.get('uploadedBy') || url.searchParams.get('uploaded_by') || '', 160);
  if (uploadedBy) {
    const uploadedByParam = addParam(uploadedBy);
    clauses.push(`(
      a.uploaded_by_user_id = ${uploadedByParam}
      or a.uploaded_by_username = ${uploadedByParam}
    )`);
  }

  const uploadedByRole = normalizeText(
    url.searchParams.get('uploadedByRole') ||
    url.searchParams.get('uploaded_by_role') ||
    url.searchParams.get('role') ||
    url.searchParams.get('userRole') ||
    url.searchParams.get('user_role') ||
    '',
    160
  );
  if (uploadedByRole) {
    clauses.push(`coalesce(a.uploaded_by_role, a.metadata->>'uploaded_by_role', a.metadata->>'uploadedByRole', '') = ${addParam(uploadedByRole)}`);
  }

  return { whereSql: `where ${clauses.join(' and ')}`, params };
}

async function handleListAdminBusinessSources(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 100 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildBusinessSourceFilters(url);
  if (filters.error) {
    sendJson(res, filters.error.code === 'BUSINESS_LINK_ID_INVALID' ? 400 : 400, filters.error);
    return;
  }

  try {
    const totalResult = await query(
      `select count(*)::integer as source_total_count
         from public.document_business_links l
         join public.document_assets a on a.id = l.asset_id
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         l.id as business_link_id,
         l.asset_id,
         l.batch_id as business_link_batch_id,
         l.entry_plan_id,
         l.target_schema,
         l.target_table,
         l.target_record_id,
         l.target_module as business_target_module,
         l.target_document_type as business_target_document_type,
         l.target_app_id,
         l.ai_confidence,
         l.metadata as business_link_metadata,
         lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是') as duplicate_business_source,
         l.created_at as business_link_created_at,
         a.batch_id as asset_batch_id,
         a.device_id,
         a.uploaded_by_user_id,
         a.uploaded_by_username,
         a.uploaded_by_role,
         a.operator_source,
         a.original_filename,
         a.mime_type,
         a.file_ext,
         a.file_size,
         a.file_hash,
         a.source_folder,
         a.upload_source,
         a.status as asset_status,
         a.metadata as asset_metadata,
         a.duplicate_of_asset_id,
         (a.status = 'duplicate' or a.duplicate_of_asset_id is not null) as duplicate,
         a.created_at as asset_created_at,
         d.device_code,
         d.device_name,
         b.batch_no,
         b.status as batch_status
       from public.document_business_links l
       join public.document_assets a on a.id = l.asset_id
       left join public.collector_devices d on d.id = a.device_id
       left join public.document_import_batches b on b.id = a.batch_id
       ${filters.whereSql}
       order by l.created_at desc, l.id desc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      total: integerOrZero(totalResult.rows[0]?.source_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapBusinessSourceRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_BUSINESS_SOURCES_FAILED', message: error.message || 'Failed to load business source files' });
  }
}

function buildRecalculationTaskFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const rawCorrectionId = normalizeText(url.searchParams.get('correctionId') || url.searchParams.get('correction_id') || '', 120);
  const correctionId = toUuidOrNull(rawCorrectionId);
  if (rawCorrectionId && !correctionId) {
    return { error: { code: 'RECALCULATION_CORRECTION_ID_INVALID', message: 'correctionId must be a UUID' } };
  }
  if (correctionId) clauses.push(`t.correction_id = ${addParam(correctionId)}::uuid`);

  const rawBusinessLinkId = normalizeText(url.searchParams.get('businessLinkId') || url.searchParams.get('business_link_id') || '', 120);
  const businessLinkId = toUuidOrNull(rawBusinessLinkId);
  if (rawBusinessLinkId && !businessLinkId) {
    return { error: { code: 'RECALCULATION_BUSINESS_LINK_ID_INVALID', message: 'businessLinkId must be a UUID' } };
  }
  if (businessLinkId) clauses.push(`t.business_link_id = ${addParam(businessLinkId)}::uuid`);

  const rawAssetId = normalizeText(url.searchParams.get('assetId') || url.searchParams.get('asset_id') || '', 120);
  const assetId = toUuidOrNull(rawAssetId);
  if (rawAssetId && !assetId) {
    return { error: { code: 'RECALCULATION_ASSET_ID_INVALID', message: 'assetId must be a UUID' } };
  }
  if (assetId) clauses.push(`l.asset_id = ${addParam(assetId)}::uuid`);

  const status = normalizeText(url.searchParams.get('status') || '', 80).toLowerCase();
  if (status) clauses.push(`t.status = ${addParam(status)}`);

  const taskType = normalizeText(url.searchParams.get('taskType') || url.searchParams.get('task_type') || '', 120);
  if (taskType) clauses.push(`t.task_type = ${addParam(taskType)}`);

  const targetSchema = normalizeText(url.searchParams.get('targetSchema') || url.searchParams.get('target_schema') || '', 120);
  if (targetSchema) clauses.push(`t.target_schema = ${addParam(targetSchema)}`);

  const targetTable = normalizeText(url.searchParams.get('targetTable') || url.searchParams.get('target_table') || '', 160);
  if (targetTable) clauses.push(`t.target_table = ${addParam(targetTable)}`);

  const targetRecordId = normalizeText(url.searchParams.get('targetRecordId') || url.searchParams.get('target_record_id') || url.searchParams.get('recordId') || url.searchParams.get('record_id') || '', 200);
  if (targetRecordId) clauses.push(`t.target_record_id = ${addParam(targetRecordId)}`);

  const requestedBy = normalizeText(url.searchParams.get('requestedBy') || url.searchParams.get('requested_by') || '', 160);
  if (requestedBy) clauses.push(`t.requested_by = ${addParam(requestedBy)}`);

  const requestedFrom = toIsoOrNull(url.searchParams.get('requestedFrom') || url.searchParams.get('from') || '');
  if (requestedFrom) clauses.push(`t.requested_at >= ${addParam(requestedFrom)}::timestamptz`);

  const requestedTo = toIsoOrNull(url.searchParams.get('requestedTo') || url.searchParams.get('to') || '');
  if (requestedTo) clauses.push(`t.requested_at <= ${addParam(requestedTo)}::timestamptz`);

  appendAssetUploadOwnershipClauses(url, clauses, addParam);

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${escapeLikePattern(search)}%`;
    clauses.push(`(
      t.target_schema ilike ${addParam(token)} escape '\\'
      or t.target_table ilike ${addParam(token)} escape '\\'
      or t.target_record_id ilike ${addParam(token)} escape '\\'
      or t.requested_by ilike ${addParam(token)} escape '\\'
      or t.last_error ilike ${addParam(token)} escape '\\'
      or a.original_filename ilike ${addParam(token)} escape '\\'
      or a.file_hash ilike ${addParam(token)} escape '\\'
      or d.device_code ilike ${addParam(token)} escape '\\'
      or d.device_name ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function handleListAdminRecalculationTasks(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildRecalculationTaskFilters(url);
  if (filters.error) {
    sendJson(res, 400, filters.error);
    return;
  }

  try {
    const totalResult = await query(
      `select count(*)::integer as task_total_count
         from public.ai_business_recalculation_tasks t
         left join public.document_business_links l on l.id = t.business_link_id
         left join public.document_assets a on a.id = l.asset_id
         left join public.collector_devices d on d.id = a.device_id
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         t.id,
         t.correction_id,
         t.business_link_id,
         t.target_schema,
         t.target_table,
         t.target_record_id,
         t.task_type,
         t.status,
         t.priority,
         t.attempt_count,
         t.next_attempt_at,
         t.locked_at,
         t.locked_by,
         t.requested_by,
         t.requested_at,
         t.completed_at,
         t.last_error,
         t.metadata,
         l.asset_id,
         l.target_module,
         l.target_document_type,
         a.original_filename,
         a.file_hash,
         a.status as asset_status,
         a.source_folder,
         a.upload_source,
         a.operator_source,
         a.uploaded_by_user_id,
         a.uploaded_by_username,
         a.uploaded_by_role,
         a.metadata as asset_metadata,
         d.device_code,
         d.device_name,
         b.batch_no,
         b.status as batch_status
       from public.ai_business_recalculation_tasks t
       left join public.document_business_links l on l.id = t.business_link_id
       left join public.document_assets a on a.id = l.asset_id
       left join public.collector_devices d on d.id = a.device_id
       left join public.document_import_batches b on b.id = a.batch_id
       ${filters.whereSql}
       order by
         case t.status
           when 'failed' then 0
           when 'manual_review_required' then 1
           when 'pending' then 2
           when 'processing' then 3
           else 4
         end,
         t.priority desc,
         t.requested_at desc,
         t.id desc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      total: integerOrZero(totalResult.rows[0]?.task_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapRecalculationTaskRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_RECALCULATION_TASK_LIST_FAILED', message: error.message || 'Failed to load recalculation tasks' });
  }
}

function appendAssetUploadOwnershipClauses(url, clauses, addParam, options = {}) {
  const tableAlias = options.tableAlias || 'a';
  const metadataExpression = options.metadataExpression || `${tableAlias}.metadata`;
  const uploadSource = normalizeText(url.searchParams.get('uploadSource') || url.searchParams.get('upload_source') || '', 80);
  if (uploadSource) clauses.push(`${tableAlias}.upload_source = ${addParam(uploadSource)}`);

  const operatorSource = normalizeText(url.searchParams.get('operatorSource') || url.searchParams.get('operator_source') || '', 80);
  if (operatorSource) {
    clauses.push(`coalesce(${tableAlias}.operator_source, ${metadataExpression}->>'operator_source', ${metadataExpression}->>'operatorSource', '') = ${addParam(operatorSource)}`);
  }

  const sourceFolder = normalizeText(url.searchParams.get('sourceFolder') || url.searchParams.get('source_folder') || '', 1000);
  if (sourceFolder) {
    clauses.push(`${tableAlias}.source_folder ilike ${addParam(`%${escapeLikePattern(sourceFolder)}%`)} escape '\\'`);
  }

  const uploadedBy = normalizeText(url.searchParams.get('uploadedBy') || url.searchParams.get('uploaded_by') || '', 160);
  if (uploadedBy) {
    const uploadedByParam = addParam(uploadedBy);
    clauses.push(`(
      ${tableAlias}.uploaded_by_user_id = ${uploadedByParam}
      or ${tableAlias}.uploaded_by_username = ${uploadedByParam}
    )`);
  }

  const uploadedByRole = normalizeText(
    url.searchParams.get('uploadedByRole') ||
    url.searchParams.get('uploaded_by_role') ||
    url.searchParams.get('userRole') ||
    url.searchParams.get('user_role') ||
    '',
    160
  );
  if (uploadedByRole) {
    clauses.push(`coalesce(${tableAlias}.uploaded_by_role, ${metadataExpression}->>'uploaded_by_role', ${metadataExpression}->>'uploadedByRole', '') = ${addParam(uploadedByRole)}`);
  }
}

function buildProductionWorkReportFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const dateFrom = normalizeText(url.searchParams.get('dateFrom') || url.searchParams.get('date_from') || '', 40);
  if (dateFrom) clauses.push(`r.report_date >= ${addParam(dateFrom)}::date`);

  const dateTo = normalizeText(url.searchParams.get('dateTo') || url.searchParams.get('date_to') || '', 40);
  if (dateTo) clauses.push(`r.report_date <= ${addParam(dateTo)}::date`);

  const reportNo = normalizeText(url.searchParams.get('reportNo') || url.searchParams.get('report_no') || '', 160);
  if (reportNo) clauses.push(`r.report_no = ${addParam(reportNo)}`);

  const workOrderNo = normalizeText(url.searchParams.get('workOrderNo') || url.searchParams.get('work_order_no') || '', 160);
  if (workOrderNo) clauses.push(`r.work_order_no = ${addParam(workOrderNo)}`);

  const productMaterialCode = normalizeText(url.searchParams.get('productMaterialCode') || url.searchParams.get('materialCode') || url.searchParams.get('product_material_code') || '', 160);
  if (productMaterialCode) clauses.push(`r.product_material_code = ${addParam(productMaterialCode)}`);

  const processName = normalizeText(url.searchParams.get('processName') || url.searchParams.get('process_name') || '', 160);
  if (processName) clauses.push(`r.process_name ilike ${addParam(`%${escapeLikePattern(processName)}%`)} escape '\\'`);

  const workshopName = normalizeText(url.searchParams.get('workshopName') || url.searchParams.get('workshop_name') || '', 160);
  if (workshopName) clauses.push(`r.workshop_name ilike ${addParam(`%${escapeLikePattern(workshopName)}%`)} escape '\\'`);

  const operator = normalizeText(url.searchParams.get('operator') || url.searchParams.get('createdBy') || url.searchParams.get('created_by') || '', 160);
  if (operator) clauses.push(`(r.operator ilike ${addParam(`%${escapeLikePattern(operator)}%`)} escape '\\' or r.created_by ilike ${addParam(`%${escapeLikePattern(operator)}%`)} escape '\\')`);

  const reportStatus = normalizeText(url.searchParams.get('reportStatus') || url.searchParams.get('report_status') || '', 80);
  if (reportStatus) clauses.push(`r.report_status = ${addParam(reportStatus)}`);

  appendAssetUploadOwnershipClauses(url, clauses, addParam);

  const duplicateBusinessSource = normalizeOptionalBoolean(
    url.searchParams.get('duplicateBusinessSource') ||
      url.searchParams.get('duplicate_business_source') ||
      url.searchParams.get('duplicateBusiness') ||
      ''
  );
  if (duplicateBusinessSource === true) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是')`);
  } else if (duplicateBusinessSource === false) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) not in ('true', '1', 'yes', 'y', 'on', '是')`);
  }

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${escapeLikePattern(search)}%`;
    clauses.push(`(
      r.report_no ilike ${addParam(token)} escape '\\'
      or r.work_order_no ilike ${addParam(token)} escape '\\'
      or r.product_material_code ilike ${addParam(token)} escape '\\'
      or r.product_material_name ilike ${addParam(token)} escape '\\'
      or r.process_name ilike ${addParam(token)} escape '\\'
      or r.workshop_name ilike ${addParam(token)} escape '\\'
      or r.operator ilike ${addParam(token)} escape '\\'
      or a.original_filename ilike ${addParam(token)} escape '\\'
      or a.file_hash ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function handleListAdminProductionWorkReports(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildProductionWorkReportFilters(url);

  try {
    const tableCheck = await query(
      `select to_regclass('scm.production_work_reports')::text as table_name`,
      []
    );
    if (!tableCheck.rows[0]?.table_name) {
      sendJson(res, 200, {
        ok: true,
        unavailable: true,
        unavailableReason: 'scm.production_work_reports is not available; apply sql/patch_document_intake_production_work_reports.sql',
        total: 0,
        limit,
        offset,
        items: []
      });
      return;
    }

    const totalResult = await query(
      `select count(*)::integer as production_work_report_total_count
         from scm.production_work_reports r
         left join public.document_business_links l
           on l.target_schema = 'scm'
          and l.target_table = 'production_work_reports'
          and l.target_record_id = r.report_no
         left join public.document_assets a on a.id = l.asset_id
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         r.*,
         l.id as business_link_id,
         l.metadata as business_link_metadata,
         lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是') as duplicate_business_source,
         l.asset_id,
         a.original_filename,
         a.file_hash,
         a.status as asset_status,
         a.upload_source,
         a.operator_source,
         a.uploaded_by_user_id,
         a.uploaded_by_username,
         a.uploaded_by_role,
         a.source_folder,
         a.metadata as asset_metadata,
         d.device_code,
         d.device_name,
         b.batch_no,
         b.status as batch_status
       from scm.production_work_reports r
       left join public.document_business_links l
         on l.target_schema = 'scm'
        and l.target_table = 'production_work_reports'
        and l.target_record_id = r.report_no
       left join public.document_assets a on a.id = l.asset_id
       left join public.collector_devices d on d.id = a.device_id
       left join public.document_import_batches b on b.id = a.batch_id
       ${filters.whereSql}
       order by r.report_date desc, r.created_at desc, r.report_no desc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      unavailable: false,
      total: integerOrZero(totalResult.rows[0]?.production_work_report_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapProductionWorkReportRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_PRODUCTION_WORK_REPORT_LIST_FAILED', message: error.message || 'Failed to load production work reports' });
  }
}

function buildQualityInspectionFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const dateFrom = normalizeText(url.searchParams.get('dateFrom') || url.searchParams.get('date_from') || '', 40);
  if (dateFrom) clauses.push(`i.inspection_date >= ${addParam(dateFrom)}::date`);

  const dateTo = normalizeText(url.searchParams.get('dateTo') || url.searchParams.get('date_to') || '', 40);
  if (dateTo) clauses.push(`i.inspection_date <= ${addParam(dateTo)}::date`);

  const docNo = normalizeText(url.searchParams.get('docNo') || url.searchParams.get('doc_no') || '', 160);
  if (docNo) clauses.push(`i.doc_no = ${addParam(docNo)}`);

  const sourceDocNo = normalizeText(url.searchParams.get('sourceDocNo') || url.searchParams.get('source_doc_no') || '', 160);
  if (sourceDocNo) clauses.push(`i.source_doc_no = ${addParam(sourceDocNo)}`);

  const itemCode = normalizeText(url.searchParams.get('itemCode') || url.searchParams.get('materialCode') || url.searchParams.get('item_code') || '', 160);
  if (itemCode) clauses.push(`i.item_code = ${addParam(itemCode)}`);

  const inspectionType = normalizeText(url.searchParams.get('inspectionType') || url.searchParams.get('inspection_type') || '', 80);
  if (inspectionType) clauses.push(`i.inspection_type = ${addParam(inspectionType)}`);

  const result = normalizeText(url.searchParams.get('result') || '', 80);
  if (result) clauses.push(`i.result = ${addParam(result)}`);

  const inspector = normalizeText(url.searchParams.get('inspector') || '', 160);
  if (inspector) clauses.push(`i.inspector ilike ${addParam(`%${escapeLikePattern(inspector)}%`)} escape '\\'`);

  appendAssetUploadOwnershipClauses(url, clauses, addParam);

  const duplicateBusinessSource = normalizeOptionalBoolean(
    url.searchParams.get('duplicateBusinessSource') ||
      url.searchParams.get('duplicate_business_source') ||
      url.searchParams.get('duplicateBusiness') ||
      ''
  );
  if (duplicateBusinessSource === true) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是')`);
  } else if (duplicateBusinessSource === false) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) not in ('true', '1', 'yes', 'y', 'on', '是')`);
  }

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${escapeLikePattern(search)}%`;
    clauses.push(`(
      i.doc_no ilike ${addParam(token)} escape '\\'
      or i.source_doc_no ilike ${addParam(token)} escape '\\'
      or i.item_code ilike ${addParam(token)} escape '\\'
      or i.item_name ilike ${addParam(token)} escape '\\'
      or i.source_name ilike ${addParam(token)} escape '\\'
      or i.batch_no ilike ${addParam(token)} escape '\\'
      or i.inspector ilike ${addParam(token)} escape '\\'
      or a.original_filename ilike ${addParam(token)} escape '\\'
      or a.file_hash ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function handleListAdminQualityInspections(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildQualityInspectionFilters(url);

  try {
    const tableCheck = await query(
      `select to_regclass('public.quality_inspections')::text as table_name`,
      []
    );
    if (!tableCheck.rows[0]?.table_name) {
      sendJson(res, 200, {
        ok: true,
        unavailable: true,
        unavailableReason: 'public.quality_inspections is not available; apply sql/quality_demo_schema.sql',
        total: 0,
        limit,
        offset,
        items: []
      });
      return;
    }

    const totalResult = await query(
      `select count(distinct i.id)::integer as quality_inspection_total_count
         from public.quality_inspections i
         left join public.document_business_links l
           on l.target_schema = 'public'
          and l.target_table = 'quality_inspections'
          and l.target_record_id = i.doc_no
         left join public.document_assets a on a.id = l.asset_id
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         i.id,
         i.doc_no,
         i.inspection_type,
         i.source_doc_no,
         i.item_code,
         i.item_name,
         i.source_name,
         i.batch_no as inspection_batch_no,
         i.sample_qty,
         i.defect_qty,
         i.result,
         i.inspector,
         i.inspection_date,
         i.remark,
         i.status,
         i.properties,
         i.created_at,
         i.updated_at,
         l.id as business_link_id,
         l.metadata as business_link_metadata,
         lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是') as duplicate_business_source,
         l.asset_id,
         a.original_filename,
         a.file_hash,
         a.status as asset_status,
         a.upload_source,
         a.operator_source,
         a.uploaded_by_user_id,
         a.uploaded_by_username,
         a.uploaded_by_role,
         a.source_folder,
         a.metadata as asset_metadata,
         d.device_code,
         d.device_name,
         b.batch_no as import_batch_no,
         b.status as import_batch_status
       from public.quality_inspections i
       left join public.document_business_links l
         on l.target_schema = 'public'
        and l.target_table = 'quality_inspections'
        and l.target_record_id = i.doc_no
       left join public.document_assets a on a.id = l.asset_id
       left join public.collector_devices d on d.id = a.device_id
       left join public.document_import_batches b on b.id = a.batch_id
       ${filters.whereSql}
       order by i.inspection_date desc, i.created_at desc, i.doc_no desc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      unavailable: false,
      total: integerOrZero(totalResult.rows[0]?.quality_inspection_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapQualityInspectionRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_QUALITY_INSPECTION_LIST_FAILED', message: error.message || 'Failed to load quality inspections' });
  }
}

function buildHrAttendanceSnapshotFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const month = normalizeText(url.searchParams.get('month') || '', 20);
  if (month) clauses.push(`s.month = ${addParam(month)}`);

  const employeeNo = normalizeText(url.searchParams.get('employeeNo') || url.searchParams.get('employee_no') || '', 120);
  if (employeeNo) clauses.push(`s.employee_no = ${addParam(employeeNo)}`);

  const employeeName = normalizeText(url.searchParams.get('employeeName') || url.searchParams.get('employee_name') || '', 160);
  if (employeeName) clauses.push(`s.employee_name ilike ${addParam(`%${escapeLikePattern(employeeName)}%`)} escape '\\'`);

  const deptName = normalizeText(url.searchParams.get('deptName') || url.searchParams.get('dept_name') || '', 160);
  if (deptName) clauses.push(`s.dept_name ilike ${addParam(`%${escapeLikePattern(deptName)}%`)} escape '\\'`);

  const sourceTargetTable = normalizeText(url.searchParams.get('sourceTargetTable') || url.searchParams.get('targetTable') || url.searchParams.get('target_table') || '', 160);
  if (sourceTargetTable) clauses.push(`s.source_target_table = ${addParam(sourceTargetTable)}`);

  const sourceTargetRecordId = normalizeText(url.searchParams.get('sourceTargetRecordId') || url.searchParams.get('targetRecordId') || url.searchParams.get('target_record_id') || '', 240);
  if (sourceTargetRecordId) clauses.push(`s.source_target_record_id = ${addParam(sourceTargetRecordId)}`);

  const confirmationStatus = normalizeText(url.searchParams.get('confirmationStatus') || url.searchParams.get('confirmation_status') || '', 80);
  if (confirmationStatus) clauses.push(`s.confirmation_status = ${addParam(confirmationStatus)}`);

  const payrollPrecheckStatus = normalizeText(url.searchParams.get('payrollPrecheckStatus') || url.searchParams.get('payroll_precheck_status') || '', 80);
  if (payrollPrecheckStatus) clauses.push(`s.payroll_precheck_status = ${addParam(payrollPrecheckStatus)}`);

  appendAssetUploadOwnershipClauses(url, clauses, addParam);

  const duplicateBusinessSource = normalizeOptionalBoolean(
    url.searchParams.get('duplicateBusinessSource') ||
      url.searchParams.get('duplicate_business_source') ||
      url.searchParams.get('duplicateBusiness') ||
      ''
  );
  if (duplicateBusinessSource === true) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是')`);
  } else if (duplicateBusinessSource === false) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) not in ('true', '1', 'yes', 'y', 'on', '是')`);
  }

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${escapeLikePattern(search)}%`;
    clauses.push(`(
      s.employee_month_key ilike ${addParam(token)} escape '\\'
      or s.employee_no ilike ${addParam(token)} escape '\\'
      or s.employee_name ilike ${addParam(token)} escape '\\'
      or s.dept_name ilike ${addParam(token)} escape '\\'
      or s.source_target_record_id ilike ${addParam(token)} escape '\\'
      or a.original_filename ilike ${addParam(token)} escape '\\'
      or a.file_hash ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

function getAdminHrAttendanceSnapshotId(req) {
  const assigned = toUuidOrNull(req?.documentIntakeHrAttendanceSnapshotId || '');
  if (assigned) return assigned;
  const url = new URL(req.url || '/', 'http://localhost');
  const fromQuery = toUuidOrNull(url.searchParams.get('snapshotId') || url.searchParams.get('snapshot_id') || url.searchParams.get('id') || '');
  if (fromQuery) return fromQuery;
  const match = url.pathname.match(/\/document-intake\/admin\/hr-attendance-snapshots\/([^/?#]+)/);
  if (!match) return null;
  try {
    return toUuidOrNull(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

async function loadAdminHrAttendanceSnapshotRow(snapshotId) {
  const result = await query(
    `select
       s.*,
       t.status as task_status,
       t.requested_by as task_requested_by,
       t.completed_at as task_completed_at,
       l.metadata as business_link_metadata,
       lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是') as duplicate_business_source,
       l.asset_id,
       a.original_filename,
       a.file_hash,
       a.upload_source,
       a.operator_source,
       a.uploaded_by_user_id,
       a.uploaded_by_username,
       a.uploaded_by_role,
       a.source_folder,
       a.metadata as asset_metadata,
       d.device_code,
       d.device_name,
       b.batch_no,
       b.status as batch_status
     from hr.attendance_month_recalculation_snapshots s
     left join public.ai_business_recalculation_tasks t on t.id = s.last_task_id
     left join public.document_business_links l on l.id = s.last_business_link_id
     left join public.document_assets a on a.id = l.asset_id
     left join public.collector_devices d on d.id = a.device_id
     left join public.document_import_batches b on b.id = a.batch_id
    where s.id = $1
    limit 1`,
    [snapshotId]
  );
  return result.rows[0] || null;
}

async function handleListAdminHrAttendanceSnapshots(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildHrAttendanceSnapshotFilters(url);

  try {
    const tableCheck = await query(
      `select to_regclass('hr.attendance_month_recalculation_snapshots')::text as table_name`,
      []
    );
    if (!tableCheck.rows[0]?.table_name) {
      sendJson(res, 200, {
        ok: true,
        unavailable: true,
        unavailableReason: 'hr.attendance_month_recalculation_snapshots is not available; apply sql/patch_document_intake_hr_records.sql',
        total: 0,
        limit,
        offset,
        items: []
      });
      return;
    }

    const totalResult = await query(
      `select count(*)::integer as snapshot_total_count
         from hr.attendance_month_recalculation_snapshots s
         left join public.ai_business_recalculation_tasks t on t.id = s.last_task_id
         left join public.document_business_links l on l.id = s.last_business_link_id
         left join public.document_assets a on a.id = l.asset_id
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         s.*,
         t.status as task_status,
         t.requested_by as task_requested_by,
         t.completed_at as task_completed_at,
         l.metadata as business_link_metadata,
         lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是') as duplicate_business_source,
         l.asset_id,
         a.original_filename,
         a.file_hash,
         a.upload_source,
         a.operator_source,
         a.uploaded_by_user_id,
         a.uploaded_by_username,
         a.uploaded_by_role,
         a.source_folder,
         a.metadata as asset_metadata,
         d.device_code,
         d.device_name,
         b.batch_no,
         b.status as batch_status
       from hr.attendance_month_recalculation_snapshots s
       left join public.ai_business_recalculation_tasks t on t.id = s.last_task_id
       left join public.document_business_links l on l.id = s.last_business_link_id
       left join public.document_assets a on a.id = l.asset_id
       left join public.collector_devices d on d.id = a.device_id
       left join public.document_import_batches b on b.id = a.batch_id
       ${filters.whereSql}
       order by s.recalculated_at desc, s.updated_at desc, s.employee_month_key asc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      unavailable: false,
      total: integerOrZero(totalResult.rows[0]?.snapshot_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapHrAttendanceSnapshotRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_HR_ATTENDANCE_SNAPSHOT_LIST_FAILED', message: error.message || 'Failed to load HR attendance snapshots' });
  }
}

function buildPayrollPrecheckSnapshotFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const month = normalizeText(url.searchParams.get('month') || '', 20);
  if (month) clauses.push(`q.month = ${addParam(month)}`);

  const employeeNo = normalizeText(url.searchParams.get('employeeNo') || url.searchParams.get('employee_no') || '', 120);
  if (employeeNo) clauses.push(`q.employee_no = ${addParam(employeeNo)}`);

  const employeeName = normalizeText(url.searchParams.get('employeeName') || url.searchParams.get('employee_name') || '', 160);
  if (employeeName) clauses.push(`q.employee_name ilike ${addParam(`%${escapeLikePattern(employeeName)}%`)} escape '\\'`);

  const deptName = normalizeText(url.searchParams.get('deptName') || url.searchParams.get('dept_name') || '', 160);
  if (deptName) clauses.push(`q.dept_name ilike ${addParam(`%${escapeLikePattern(deptName)}%`)} escape '\\'`);

  const sourceTargetRecordId = normalizeText(url.searchParams.get('sourceTargetRecordId') || url.searchParams.get('targetRecordId') || url.searchParams.get('target_record_id') || '', 240);
  if (sourceTargetRecordId) clauses.push(`q.source_target_record_id = ${addParam(sourceTargetRecordId)}`);

  appendAssetUploadOwnershipClauses(url, clauses, addParam, {
    tableAlias: 'q',
    metadataExpression: 'q.asset_metadata'
  });

  const duplicateBusinessSource = normalizeOptionalBoolean(
    url.searchParams.get('duplicateBusinessSource') ||
      url.searchParams.get('duplicate_business_source') ||
      url.searchParams.get('duplicateBusiness') ||
      ''
  );
  if (duplicateBusinessSource === true) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是')`);
  } else if (duplicateBusinessSource === false) {
    clauses.push(`l.id is not null and lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) not in ('true', '1', 'yes', 'y', 'on', '是')`);
  }

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${escapeLikePattern(search)}%`;
    clauses.push(`(
      q.employee_month_key ilike ${addParam(token)} escape '\\'
      or q.employee_no ilike ${addParam(token)} escape '\\'
      or q.employee_name ilike ${addParam(token)} escape '\\'
      or q.dept_name ilike ${addParam(token)} escape '\\'
      or q.source_target_record_id ilike ${addParam(token)} escape '\\'
      or q.original_filename ilike ${addParam(token)} escape '\\'
      or q.file_hash ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function handleListAdminPayrollPrecheckSnapshots(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildPayrollPrecheckSnapshotFilters(url);

  try {
    const viewCheck = await query(
      `select to_regclass('hr.v_payroll_precheck_attendance_snapshots')::text as view_name`,
      []
    );
    if (!viewCheck.rows[0]?.view_name) {
      sendJson(res, 200, {
        ok: true,
        unavailable: true,
        unavailableReason: 'hr.v_payroll_precheck_attendance_snapshots is not available; apply sql/patch_document_intake_hr_records.sql',
        total: 0,
        limit,
        offset,
        items: []
      });
      return;
    }

    const totalResult = await query(
      `select count(*)::integer as precheck_total_count
         from hr.v_payroll_precheck_attendance_snapshots q
         left join public.document_business_links l on l.id = q.last_business_link_id
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         q.*,
         l.metadata as business_link_metadata,
         lower(coalesce(l.metadata->>'duplicate_business_source', l.metadata->>'duplicateBusinessSource', '')) in ('true', '1', 'yes', 'y', 'on', '是') as duplicate_business_source
         from hr.v_payroll_precheck_attendance_snapshots q
         left join public.document_business_links l on l.id = q.last_business_link_id
       ${filters.whereSql}
       order by q.payroll_precheck_requested_at desc, q.month desc, q.employee_month_key asc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      unavailable: false,
      total: integerOrZero(totalResult.rows[0]?.precheck_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapPayrollPrecheckAttendanceSnapshotRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_PAYROLL_PRECHECK_SNAPSHOT_LIST_FAILED', message: error.message || 'Failed to load payroll precheck attendance snapshots' });
  }
}

function buildPayrollPrecheckResultFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const month = normalizeText(url.searchParams.get('month') || '', 20);
  if (month) clauses.push(`r.month = ${addParam(month)}`);

  const employeeNo = normalizeText(url.searchParams.get('employeeNo') || url.searchParams.get('employee_no') || '', 120);
  if (employeeNo) clauses.push(`r.employee_no = ${addParam(employeeNo)}`);

  const employeeName = normalizeText(url.searchParams.get('employeeName') || url.searchParams.get('employee_name') || '', 160);
  if (employeeName) clauses.push(`r.employee_name ilike ${addParam(`%${escapeLikePattern(employeeName)}%`)} escape '\\'`);

  const deptName = normalizeText(url.searchParams.get('deptName') || url.searchParams.get('dept_name') || '', 160);
  if (deptName) clauses.push(`r.dept_name ilike ${addParam(`%${escapeLikePattern(deptName)}%`)} escape '\\'`);

  const trialStatus = normalizeText(url.searchParams.get('trialStatus') || url.searchParams.get('trial_status') || '', 80).toLowerCase();
  if (trialStatus) clauses.push(`r.trial_status = ${addParam(trialStatus)}`);

  const sourceTargetRecordId = normalizeText(url.searchParams.get('sourceTargetRecordId') || url.searchParams.get('targetRecordId') || url.searchParams.get('target_record_id') || '', 240);
  if (sourceTargetRecordId) clauses.push(`r.source_target_record_id = ${addParam(sourceTargetRecordId)}`);

  appendAssetUploadOwnershipClauses(url, clauses, addParam, {
    tableAlias: 'r',
    metadataExpression: 'r.asset_metadata'
  });

  const duplicateBusinessSource = normalizeOptionalBoolean(
    url.searchParams.get('duplicateBusinessSource') ||
      url.searchParams.get('duplicate_business_source') ||
      url.searchParams.get('duplicateBusiness') ||
      ''
  );
  const duplicateBusinessSourceExpression = `lower(coalesce(
    r.source_snapshot_reference->>'duplicate_business_source',
    r.source_snapshot_reference->>'duplicateBusinessSource',
    r.source_snapshot_reference#>>'{business_link_metadata,duplicate_business_source}',
    r.source_snapshot_reference#>>'{businessLinkMetadata,duplicateBusinessSource}',
    ''
  ))`;
  if (duplicateBusinessSource === true) {
    clauses.push(`${duplicateBusinessSourceExpression} in ('true', '1', 'yes', 'y', 'on', '是')`);
  } else if (duplicateBusinessSource === false) {
    clauses.push(`${duplicateBusinessSourceExpression} not in ('true', '1', 'yes', 'y', 'on', '是')`);
  }

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${escapeLikePattern(search)}%`;
    clauses.push(`(
      r.employee_month_key ilike ${addParam(token)} escape '\\'
      or r.employee_no ilike ${addParam(token)} escape '\\'
      or r.employee_name ilike ${addParam(token)} escape '\\'
      or r.dept_name ilike ${addParam(token)} escape '\\'
      or r.source_target_record_id ilike ${addParam(token)} escape '\\'
      or r.source_filename ilike ${addParam(token)} escape '\\'
      or r.file_hash ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function handleListAdminPayrollPrecheckResults(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildPayrollPrecheckResultFilters(url);

  try {
    const tableCheck = await query(
      `select to_regclass('hr.payroll_precheck_results')::text as table_name`,
      []
    );
    if (!tableCheck.rows[0]?.table_name) {
      sendJson(res, 200, {
        ok: true,
        unavailable: true,
        unavailableReason: 'hr.payroll_precheck_results is not available; apply sql/patch_document_intake_hr_records.sql',
        total: 0,
        limit,
        offset,
        items: []
      });
      return;
    }

    const totalResult = await query(
      `select count(*)::integer as result_total_count
         from hr.payroll_precheck_results r
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select r.*
         from hr.payroll_precheck_results r
       ${filters.whereSql}
       order by r.generated_at desc, r.month desc, r.employee_month_key asc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      unavailable: false,
      total: integerOrZero(totalResult.rows[0]?.result_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapPayrollPrecheckResultRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_PAYROLL_PRECHECK_RESULT_LIST_FAILED', message: error.message || 'Failed to load payroll precheck results' });
  }
}

async function handleListAdminPayrollReadyPrecheckResults(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildPayrollPrecheckResultFilters(url);

  try {
    const viewCheck = await query(
      `select to_regclass('hr.v_payroll_ready_precheck_results')::text as view_name`,
      []
    );
    if (!viewCheck.rows[0]?.view_name) {
      sendJson(res, 200, {
        ok: true,
        unavailable: true,
        unavailableReason: 'hr.v_payroll_ready_precheck_results is not available; apply sql/patch_document_intake_hr_records.sql',
        total: 0,
        limit,
        offset,
        items: []
      });
      return;
    }

    const totalResult = await query(
      `select count(*)::integer as ready_result_total_count
         from hr.v_payroll_ready_precheck_results r
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select r.*
         from hr.v_payroll_ready_precheck_results r
       ${filters.whereSql}
       order by r.reviewed_at desc nulls last, r.generated_at desc, r.month desc, r.employee_month_key asc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      unavailable: false,
      total: integerOrZero(totalResult.rows[0]?.ready_result_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapPayrollPrecheckResultRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_PAYROLL_READY_PRECHECK_RESULT_LIST_FAILED', message: error.message || 'Failed to load payroll ready precheck results' });
  }
}

function getAdminPayrollPrecheckResultId(req) {
  const assigned = toUuidOrNull(req?.documentIntakePayrollPrecheckResultId || '');
  if (assigned) return assigned;
  const url = new URL(req.url || '/', 'http://localhost');
  const fromQuery = toUuidOrNull(url.searchParams.get('resultId') || url.searchParams.get('result_id') || url.searchParams.get('id') || '');
  if (fromQuery) return fromQuery;
  const match = url.pathname.match(/\/document-intake\/admin\/hr-payroll-precheck-results\/([^/?#]+)/);
  if (!match) return null;
  try {
    return toUuidOrNull(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

async function handleUpdateAdminPayrollPrecheckResult(req, res, { sendJson, readJsonBody }) {
  const resultId = getAdminPayrollPrecheckResultId(req);
  if (!resultId) {
    sendJson(res, 400, { code: 'PAYROLL_PRECHECK_RESULT_ID_REQUIRED', message: 'A valid payroll precheck result id is required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const action = normalizeText(body.action || body.resultAction || body.result_action || '', 80).toLowerCase();
  const actor = normalizeText(
    body.actor || body.operator || body.reviewedBy || body.reviewed_by || req.documentIntakeAdminUser?.username || req.documentIntakeAdminUser?.id || '',
    160
  );
  const note = normalizeText(body.note || body.reviewNote || body.review_note || body.reason || body.rejectionReason || body.rejection_reason || '', 1000);
  const canonicalAction = ({
    review: 'reviewed',
    reviewed: 'reviewed',
    mark_reviewed: 'reviewed',
    approve: 'approved',
    approved: 'approved',
    pass: 'approved',
    review_passed: 'approved',
    reject: 'rejected',
    rejected: 'rejected',
    return: 'rejected',
    return_for_correction: 'rejected'
  })[action];

  if (!canonicalAction) {
    sendJson(res, 400, { code: 'UNSUPPORTED_PAYROLL_PRECHECK_RESULT_ACTION', message: 'Supported actions are review, approve and reject' });
    return;
  }
  if (canonicalAction === 'rejected' && !note) {
    sendJson(res, 400, { code: 'PAYROLL_PRECHECK_RESULT_REJECTION_REASON_REQUIRED', message: 'A rejection reason is required' });
    return;
  }

  try {
    const tableCheck = await query(
      `select to_regclass('hr.payroll_precheck_results')::text as table_name`,
      []
    );
    if (!tableCheck.rows[0]?.table_name) {
      sendJson(res, 409, {
        code: 'PAYROLL_PRECHECK_RESULT_TABLE_UNAVAILABLE',
        message: 'hr.payroll_precheck_results is not available; apply sql/patch_document_intake_hr_records.sql'
      });
      return;
    }

    const updateResult = await query(
      `update hr.payroll_precheck_results
          set trial_status = $2,
              reviewed_by = $3,
              reviewed_at = now(),
              review_note = $4,
              result_payload = coalesce(result_payload, '{}'::jsonb) || jsonb_build_object(
                'status', $2,
                'reviewed_by', $3,
                'reviewed_at', now(),
                'review_note', $4,
                'noPayrollMutation', true,
                'payrollMutationAllowed', false
              ),
              no_payroll_mutation = true,
              updated_at = now()
        where id = $1
          and no_payroll_mutation = true
        returning *`,
      [resultId, canonicalAction, actor, note]
    );
    const row = updateResult.rows[0];
    if (!row) {
      sendJson(res, 404, { code: 'PAYROLL_PRECHECK_RESULT_NOT_FOUND', message: 'Payroll precheck result not found' });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      action: canonicalAction,
      result: mapPayrollPrecheckResultRow(row)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_PAYROLL_PRECHECK_RESULT_UPDATE_FAILED', message: error.message || 'Failed to update payroll precheck result' });
  }
}

function buildPayrollPrecheckTrialPayload(snapshot, { actor, note }) {
  const generatedAt = new Date().toISOString();
  const businessLinkMetadata = asJsonObject(snapshot.business_link_metadata);
  const duplicateBusinessSource = normalizeBoolean(
    snapshot.duplicate_business_source ??
      businessLinkMetadata.duplicate_business_source ??
      businessLinkMetadata.duplicateBusinessSource,
    false
  );
  const attendanceSummary = {
    recordCount: integerOrZero(snapshot.record_count),
    leaveCount: integerOrZero(snapshot.leave_count),
    absentCount: integerOrZero(snapshot.absent_count),
    lateCount: integerOrZero(snapshot.late_count),
    earlyCount: integerOrZero(snapshot.early_count),
    overtimeMinutes: integerOrZero(snapshot.overtime_minutes),
    firstAttDate: normalizeTimestamp(snapshot.first_att_date),
    lastAttDate: normalizeTimestamp(snapshot.last_att_date)
  };
  const sourceSnapshotReference = {
    ...(asJsonObject(snapshot.payroll_reference)),
    reference_table: 'hr.attendance_month_recalculation_snapshots',
    snapshot_id: snapshot.snapshot_id || snapshot.id,
    employee_month_key: snapshot.employee_month_key || '',
    month: snapshot.month || '',
    employee_no: snapshot.employee_no || '',
    source_target_schema: snapshot.source_target_schema || '',
    source_target_table: snapshot.source_target_table || '',
    source_target_record_id: snapshot.source_target_record_id || '',
    last_business_link_id: snapshot.last_business_link_id || '',
    duplicate_business_source: duplicateBusinessSource,
    business_link_metadata: businessLinkMetadata,
    asset_id: snapshot.asset_id || '',
    source_filename: snapshot.original_filename || snapshot.source_filename || '',
    file_hash: snapshot.file_hash || '',
    batch_no: snapshot.batch_no || '',
    batch_status: snapshot.batch_status || '',
    upload_source: snapshot.upload_source || '',
    operator_source: snapshot.operator_source || '',
    uploaded_by_user_id: snapshot.uploaded_by_user_id || '',
    uploaded_by_username: snapshot.uploaded_by_username || '',
    uploaded_by_role: snapshot.uploaded_by_role || '',
    source_folder: snapshot.source_folder || '',
    read_only_reference: true,
    no_payroll_mutation: true
  };
  const calculationBasis = {
    version: 'attendance-precheck-v1',
    generatedAt,
    generatedBy: actor || '',
    note: note || '',
    noPayrollMutation: true,
    payrollMutationAllowed: false,
    attendanceSummary,
    sourceSnapshotReference
  };
  const resultPayload = {
    status: 'draft',
    formulaStatus: 'payroll_formula_not_applied',
    noPayrollMutation: true,
    payrollMutationAllowed: false,
    employeeMonthKey: snapshot.employee_month_key || '',
    attendanceSummary,
    notices: [
      'This precheck result is generated from a confirmed attendance snapshot.',
      'It does not write or mutate official payroll or monthly closing records.'
    ]
  };
  return { calculationBasis, resultPayload, sourceSnapshotReference };
}

async function handleGenerateAdminPayrollPrecheckTrial(req, res, { sendJson, readJsonBody }) {
  const snapshotId = getAdminHrAttendanceSnapshotId(req);
  if (!snapshotId) {
    sendJson(res, 400, { code: 'PAYROLL_PRECHECK_SNAPSHOT_ID_REQUIRED', message: 'A valid payroll precheck snapshot id is required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const actor = normalizeText(
    body.actor || body.operator || body.generatedBy || body.generated_by || req.documentIntakeAdminUser?.username || req.documentIntakeAdminUser?.id || '',
    160
  );
  const note = normalizeText(body.note || body.reviewNote || body.review_note || '', 1000);

  try {
    const tableCheck = await query(
      `select to_regclass('hr.payroll_precheck_results')::text as table_name`,
      []
    );
    if (!tableCheck.rows[0]?.table_name) {
      sendJson(res, 409, {
        code: 'PAYROLL_PRECHECK_RESULT_TABLE_UNAVAILABLE',
        message: 'hr.payroll_precheck_results is not available; apply sql/patch_document_intake_hr_records.sql'
      });
      return;
    }

    const viewCheck = await query(
      `select to_regclass('hr.v_payroll_precheck_attendance_snapshots')::text as view_name`,
      []
    );
    if (!viewCheck.rows[0]?.view_name) {
      sendJson(res, 409, {
        code: 'PAYROLL_PRECHECK_SNAPSHOT_VIEW_UNAVAILABLE',
        message: 'hr.v_payroll_precheck_attendance_snapshots is not available; apply sql/patch_document_intake_hr_records.sql'
      });
      return;
    }

    const snapshotResult = await query(
      `select q.*
         from hr.v_payroll_precheck_attendance_snapshots q
        where q.snapshot_id = $1
        limit 1`,
      [snapshotId]
    );
    const snapshot = snapshotResult.rows[0];
    if (!snapshot) {
      sendJson(res, 404, {
        code: 'PAYROLL_PRECHECK_SNAPSHOT_NOT_READY',
        message: 'The attendance snapshot is not confirmed and ready for payroll precheck'
      });
      return;
    }

    const { calculationBasis, resultPayload, sourceSnapshotReference } = buildPayrollPrecheckTrialPayload(snapshot, { actor, note });
    const result = await query(
      `insert into hr.payroll_precheck_results (
         snapshot_id, employee_month_key, employee_id, employee_no, employee_name, dept_name, month,
         record_count, leave_count, absent_count, late_count, early_count, overtime_minutes,
         first_att_date, last_att_date, source_target_schema, source_target_table, source_target_record_id,
         asset_id, source_filename, file_hash, device_code, device_name, batch_no,
         upload_source, operator_source, uploaded_by_user_id, uploaded_by_username, uploaded_by_role,
         source_folder, asset_metadata, batch_status,
         trial_status, calculation_version, calculation_basis, result_payload,
         generated_by, generated_at, reviewed_by, reviewed_at, review_note,
         source_snapshot_reference, no_payroll_mutation
       ) values (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,$12,$13,
         $14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23,$24,
         $25,$26,$27,$28,$29,
         $30,$31,$32,
         'draft','attendance-precheck-v1',$33,$34,
         $35,now(),null,null,$36,
         $37,true
       )
       on conflict (snapshot_id) do update
          set employee_month_key = excluded.employee_month_key,
              employee_id = excluded.employee_id,
              employee_no = excluded.employee_no,
              employee_name = excluded.employee_name,
              dept_name = excluded.dept_name,
              month = excluded.month,
              record_count = excluded.record_count,
              leave_count = excluded.leave_count,
              absent_count = excluded.absent_count,
              late_count = excluded.late_count,
              early_count = excluded.early_count,
              overtime_minutes = excluded.overtime_minutes,
              first_att_date = excluded.first_att_date,
              last_att_date = excluded.last_att_date,
              source_target_schema = excluded.source_target_schema,
              source_target_table = excluded.source_target_table,
              source_target_record_id = excluded.source_target_record_id,
              asset_id = excluded.asset_id,
              source_filename = excluded.source_filename,
              file_hash = excluded.file_hash,
              device_code = excluded.device_code,
              device_name = excluded.device_name,
              batch_no = excluded.batch_no,
              upload_source = excluded.upload_source,
              operator_source = excluded.operator_source,
              uploaded_by_user_id = excluded.uploaded_by_user_id,
              uploaded_by_username = excluded.uploaded_by_username,
              uploaded_by_role = excluded.uploaded_by_role,
              source_folder = excluded.source_folder,
              asset_metadata = excluded.asset_metadata,
              batch_status = excluded.batch_status,
              trial_status = 'draft',
              calculation_version = excluded.calculation_version,
              calculation_basis = excluded.calculation_basis,
              result_payload = excluded.result_payload,
              generated_by = excluded.generated_by,
              generated_at = now(),
              reviewed_by = null,
              reviewed_at = null,
              review_note = excluded.review_note,
              source_snapshot_reference = excluded.source_snapshot_reference,
              no_payroll_mutation = true,
              updated_at = now()
       returning *`,
      [
        snapshot.snapshot_id || snapshot.id,
        snapshot.employee_month_key || '',
        snapshot.employee_id || null,
        snapshot.employee_no || null,
        snapshot.employee_name || '',
        snapshot.dept_name || null,
        snapshot.month || '',
        integerOrZero(snapshot.record_count),
        integerOrZero(snapshot.leave_count),
        integerOrZero(snapshot.absent_count),
        integerOrZero(snapshot.late_count),
        integerOrZero(snapshot.early_count),
        integerOrZero(snapshot.overtime_minutes),
        snapshot.first_att_date || null,
        snapshot.last_att_date || null,
        snapshot.source_target_schema || null,
        snapshot.source_target_table || null,
        snapshot.source_target_record_id || null,
        toUuidOrNull(snapshot.asset_id || ''),
        snapshot.original_filename || snapshot.source_filename || null,
        snapshot.file_hash || null,
        snapshot.device_code || null,
        snapshot.device_name || null,
        snapshot.batch_no || null,
        snapshot.upload_source || null,
        snapshot.operator_source || null,
        snapshot.uploaded_by_user_id || null,
        snapshot.uploaded_by_username || null,
        snapshot.uploaded_by_role || null,
        snapshot.source_folder || null,
        asJsonObject(snapshot.asset_metadata),
        snapshot.batch_status || null,
        calculationBasis,
        resultPayload,
        actor,
        note,
        sourceSnapshotReference
      ]
    );

    sendJson(res, 200, {
      ok: true,
      action: 'generate_trial',
      result: mapPayrollPrecheckResultRow(result.rows[0])
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_PAYROLL_PRECHECK_TRIAL_FAILED', message: error.message || 'Failed to generate payroll precheck trial' });
  }
}

async function handleUpdateAdminHrAttendanceSnapshot(req, res, { sendJson, readJsonBody }) {
  const snapshotId = getAdminHrAttendanceSnapshotId(req);
  if (!snapshotId) {
    sendJson(res, 400, { code: 'HR_ATTENDANCE_SNAPSHOT_ID_REQUIRED', message: 'A valid HR attendance snapshot id is required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const action = normalizeText(body.action || body.snapshotAction || body.snapshot_action || '', 80).toLowerCase();
  const actor = normalizeText(
    body.actor || body.operator || body.reviewedBy || body.reviewed_by || req.documentIntakeAdminUser?.username || req.documentIntakeAdminUser?.id || '',
    160
  );
  const note = normalizeText(body.note || body.confirmationNote || body.confirmation_note || body.payrollPrecheckNote || body.payroll_precheck_note || '', 1000);
  const rejectionReason = normalizeText(body.rejectionReason || body.rejection_reason || body.reason || note, 1000);

  const canonicalAction = ({
    confirm: 'confirm',
    approve: 'confirm',
    confirmed: 'confirm',
    reject: 'reject',
    rejected: 'reject',
    return: 'reject',
    return_for_correction: 'reject',
    submit_payroll_precheck: 'submit_payroll_precheck',
    payroll_precheck_ready: 'submit_payroll_precheck',
    mark_payroll_precheck_ready: 'submit_payroll_precheck'
  })[action];

  if (!canonicalAction) {
    sendJson(res, 400, { code: 'UNSUPPORTED_HR_ATTENDANCE_SNAPSHOT_ACTION', message: 'Supported actions are confirm, reject and submit_payroll_precheck' });
    return;
  }
  if (canonicalAction === 'reject' && !rejectionReason) {
    sendJson(res, 400, { code: 'HR_ATTENDANCE_SNAPSHOT_REJECTION_REASON_REQUIRED', message: 'A rejection reason is required' });
    return;
  }

  try {
    const tableCheck = await query(
      `select to_regclass('hr.attendance_month_recalculation_snapshots')::text as table_name`,
      []
    );
    if (!tableCheck.rows[0]?.table_name) {
      sendJson(res, 409, {
        code: 'HR_ATTENDANCE_SNAPSHOT_TABLE_UNAVAILABLE',
        message: 'hr.attendance_month_recalculation_snapshots is not available; apply sql/patch_document_intake_hr_records.sql'
      });
      return;
    }

    let updateResult;
    if (canonicalAction === 'confirm') {
      updateResult = await query(
        `update hr.attendance_month_recalculation_snapshots
            set confirmation_status = 'confirmed',
                confirmation_note = $2,
                confirmed_by = $3,
                confirmed_at = now(),
                rejected_by = null,
                rejected_at = null,
                rejection_reason = null,
                payroll_precheck_status = case
                  when payroll_precheck_status = 'ready' then 'ready'
                  else 'not_requested'
                end,
                updated_at = now()
          where id = $1
          returning id`,
        [snapshotId, note, actor]
      );
    } else if (canonicalAction === 'reject') {
      updateResult = await query(
        `update hr.attendance_month_recalculation_snapshots
            set confirmation_status = 'rejected',
                confirmation_note = $2,
                confirmed_by = null,
                confirmed_at = null,
                rejected_by = $3,
                rejected_at = now(),
                rejection_reason = $4,
                payroll_precheck_status = 'not_requested',
                payroll_precheck_requested_by = null,
                payroll_precheck_requested_at = null,
                payroll_precheck_note = null,
                updated_at = now()
          where id = $1
          returning id`,
        [snapshotId, note || rejectionReason, actor, rejectionReason]
      );
    } else {
      updateResult = await query(
        `update hr.attendance_month_recalculation_snapshots
            set payroll_precheck_status = 'ready',
                payroll_precheck_requested_by = $2,
                payroll_precheck_requested_at = now(),
                payroll_precheck_note = $3,
                updated_at = now()
          where id = $1
            and confirmation_status = 'confirmed'
          returning id`,
        [snapshotId, actor, note]
      );
      if (!updateResult.rows[0]) {
        const current = await query(
          `select id, confirmation_status
             from hr.attendance_month_recalculation_snapshots
            where id = $1
            limit 1`,
          [snapshotId]
        );
        if (!current.rows[0]) {
          sendJson(res, 404, { code: 'HR_ATTENDANCE_SNAPSHOT_NOT_FOUND', message: 'HR attendance snapshot not found' });
          return;
        }
        sendJson(res, 409, {
          code: 'HR_ATTENDANCE_SNAPSHOT_CONFIRMATION_REQUIRED',
          message: 'Confirm the HR attendance snapshot before submitting it to payroll precheck',
          confirmationStatus: current.rows[0].confirmation_status || 'pending_confirmation'
        });
        return;
      }
    }

    if (!updateResult.rows[0]) {
      sendJson(res, 404, { code: 'HR_ATTENDANCE_SNAPSHOT_NOT_FOUND', message: 'HR attendance snapshot not found' });
      return;
    }

    const snapshot = await loadAdminHrAttendanceSnapshotRow(snapshotId);
    sendJson(res, 200, {
      ok: true,
      action: canonicalAction,
      snapshot: snapshot ? mapHrAttendanceSnapshotRow(snapshot) : null
    });
  } catch (error) {
    sendJson(res, 500, { code: 'HR_ATTENDANCE_SNAPSHOT_ACTION_FAILED', message: error.message || 'Failed to update HR attendance snapshot' });
  }
}

async function handleDownloadAdminAsset(req, res, { sendJson }) {
  const assetId = getAdminAssetId(req);
  if (!assetId) {
    sendJson(res, 400, { code: 'DOCUMENT_ASSET_ID_REQUIRED', message: 'A valid asset id is required' });
    return;
  }

  try {
    const result = await query(
      `select a.id, a.original_filename, a.storage_path, a.mime_type, a.file_size
         from public.document_assets a
        where a.id = $1
        limit 1`,
      [assetId]
    );
    const asset = result.rows[0] || null;
    if (!asset) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_NOT_FOUND', message: 'Document asset not found' });
      return;
    }

    const storagePath = asset.storage_path || '';
    if (!storagePath || !isPathInsideStorageRoot(storagePath)) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_FILE_NOT_FOUND', message: 'Document asset file not found' });
      return;
    }

    let stat;
    try {
      stat = await fs.promises.stat(storagePath);
    } catch {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_FILE_NOT_FOUND', message: 'Document asset file not found' });
      return;
    }
    if (!stat.isFile()) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_FILE_NOT_FOUND', message: 'Document asset file not found' });
      return;
    }

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': normalizeMimeType(asset.mime_type),
      'Content-Length': String(stat.size),
      'Content-Disposition': contentDispositionAttachment(asset.original_filename),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    };
    if (typeof res.writeHead === 'function') {
      res.writeHead(200, headers);
    } else {
      res.statusCode = 200;
      res.headers = headers;
    }

    if ((req.method || 'GET').toUpperCase() === 'HEAD') {
      if (typeof res.end === 'function') res.end();
      return;
    }

    if (typeof res.end !== 'function') {
      res.body = await fs.promises.readFile(storagePath);
      return;
    }

    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(storagePath);
      stream.on('error', reject);
      res.on?.('error', reject);
      res.on?.('finish', resolve);
      res.on?.('close', resolve);
      stream.pipe(res);
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_ASSET_DOWNLOAD_FAILED', message: error.message || 'Failed to download document asset' });
  }
}

async function handlePreviewAdminAsset(req, res, { sendJson }) {
  const assetId = getAdminAssetId(req);
  if (!assetId) {
    sendJson(res, 400, { code: 'DOCUMENT_ASSET_ID_REQUIRED', message: 'A valid asset id is required' });
    return;
  }

  try {
    const result = await query(
      `select a.id, a.original_filename, a.storage_path, a.mime_type, a.file_size
         from public.document_assets a
        where a.id = $1
        limit 1`,
      [assetId]
    );
    const asset = result.rows[0] || null;
    if (!asset) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_NOT_FOUND', message: 'Document asset not found' });
      return;
    }

    const storagePath = asset.storage_path || '';
    if (!storagePath || !isPathInsideStorageRoot(storagePath)) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_FILE_NOT_FOUND', message: 'Document asset file not found' });
      return;
    }

    if (!isBasicTextAsset(asset.original_filename, asset.mime_type)) {
      sendJson(res, 415, {
        code: 'DOCUMENT_ASSET_PREVIEW_UNSUPPORTED',
        message: 'This source file type does not support text preview'
      });
      return;
    }

    let stat;
    try {
      stat = await fs.promises.stat(storagePath);
    } catch {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_FILE_NOT_FOUND', message: 'Document asset file not found' });
      return;
    }
    if (!stat.isFile()) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_FILE_NOT_FOUND', message: 'Document asset file not found' });
      return;
    }

    const text = await readBasicTextAsset(storagePath);
    sendJson(res, 200, {
      ok: true,
      asset: {
        id: asset.id,
        originalFilename: asset.original_filename || '',
        mimeType: normalizeMimeType(asset.mime_type),
        fileSize: integerOrZero(stat.size)
      },
      preview: {
        text,
        truncated: stat.size > maxBasicParseTextBytes,
        maxBytes: maxBasicParseTextBytes
      }
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_ASSET_PREVIEW_FAILED', message: error.message || 'Failed to preview document asset' });
  }
}

async function handleReviewAdminAsset(req, res, { sendJson, readJsonBody }) {
  const assetId = getAdminAssetId(req);
  if (!assetId) {
    sendJson(res, 400, { code: 'DOCUMENT_ASSET_ID_REQUIRED', message: 'A valid asset id is required' });
    return;
  }

  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const action = normalizeText(body.action || body.reviewAction || body.review_action || 'approve_auto_import', 80).toLowerCase();
  if (action !== 'approve_auto_import') {
    sendJson(res, 400, { code: 'UNSUPPORTED_REVIEW_ACTION', message: 'Only approve_auto_import is supported for now' });
    return;
  }

  const reviewedBy = normalizeText(
    body.reviewedBy || body.reviewed_by || req.documentIntakeAdminUser?.username || req.documentIntakeAdminUser?.id || '',
    160
  );
  const reviewNote = normalizeText(body.reviewNote || body.review_note || body.note || '', 1000);
  const reviewedAt = new Date().toISOString();

  const client = await pool.connect();
  try {
    await client.query('begin');
    const planResult = await client.query(
      `select
         p.id, p.asset_id, p.batch_id, p.status, p.target_kind, p.target_module,
         p.target_document_type, p.metadata,
         a.batch_id as asset_batch_id, a.status as asset_status
       from public.document_entry_plans p
       join public.document_assets a on a.id = p.asset_id
      where p.asset_id = $1
      order by p.created_at desc
      limit 1
      for update of p, a`,
      [assetId]
    );
    const plan = planResult.rows[0] || null;
    if (!plan) {
      await client.query('rollback');
      sendJson(res, 404, { code: 'ENTRY_PLAN_NOT_FOUND', message: 'No entry plan found for this asset' });
      return;
    }

    const batchId = plan.batch_id || plan.asset_batch_id || null;
    const nextStep = plan.target_kind === 'data_app'
      ? 'field_mapping'
      : 'fixed_module_business_adapter';
    const metadataPatch = {
      auto_import_ready: true,
      manual_review_required: false,
      ai_review_status: 'reviewed',
      reviewed_by: reviewedBy,
      reviewed_at: reviewedAt,
      review_note: reviewNote,
      auto_import_policy_action: 'manual_review_approved',
      auto_import_policy_reason: 'admin_review_approved',
      next_step: nextStep
    };

    await client.query(
      `update public.document_entry_plans
          set status = 'planned',
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
        where id = $1`,
      [plan.id, JSON.stringify(metadataPatch)]
    );
    await client.query(
      `update public.document_assets
          set status = case
                when status in ('imported', 'partial_imported', 'duplicate', 'failed') then status
                else 'classified'
              end,
              metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = now()
        where id = $1`,
      [
        assetId,
        JSON.stringify({
          ai_review_status: 'reviewed',
          reviewed_by: reviewedBy,
          reviewed_at: reviewedAt
        })
      ]
    );
    if (batchId) {
      await client.query(
        `update public.document_import_batches
            set status = 'classifying',
                finished_at = null,
                metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
                updated_at = now()
          where id = $1`,
        [
          batchId,
          JSON.stringify({
            ai_review_status: 'reviewed',
            reviewed_asset_id: assetId,
            reviewed_entry_plan_id: plan.id,
            reviewed_by: reviewedBy,
            reviewed_at: reviewedAt
          })
        ]
      );
    }
    await client.query('commit');

    sendJson(res, 200, {
      ok: true,
      assetId,
      entryPlanId: plan.id,
      batchId,
      status: 'planned',
      reviewStatus: 'reviewed',
      autoImportReady: true,
      nextStep,
      reviewedAt,
      reviewedBy
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    sendJson(res, 500, { code: 'ASSET_REVIEW_FAILED', message: error.message || 'Asset review failed' });
  } finally {
    client.release();
  }
}

async function handleGetCollectorAssetStatus(req, res, { sendJson }) {
  const device = await authorizeDevice(req, sendJson, res);
  if (!device) return;

  const assetId = getAdminAssetId(req);
  if (!assetId) {
    sendJson(res, 400, { code: 'DOCUMENT_ASSET_ID_REQUIRED', message: 'A valid asset id is required' });
    return;
  }

  try {
    const result = await query(
      `select
         a.id, a.batch_id, a.status as asset_status, a.duplicate_of_asset_id,
         (a.status = 'duplicate' or a.duplicate_of_asset_id is not null) as duplicate,
         a.created_at, a.updated_at,
         b.batch_no, b.status as batch_status,
         pj.status as parse_status,
         p.status as entry_status,
         coalesce(bl.business_link_count, 0)::integer as business_link_count,
         coalesce(uf.unmapped_field_count, 0)::integer as unmapped_field_count
       from public.document_assets a
       left join public.document_import_batches b on b.id = a.batch_id
       left join lateral (
         select status
           from public.document_parse_jobs
          where asset_id = a.id
          order by created_at desc
          limit 1
       ) pj on true
       left join lateral (
         select status
           from public.document_entry_plans
          where asset_id = a.id
          order by created_at desc
          limit 1
       ) p on true
       left join lateral (
         select count(*)::integer as business_link_count
           from public.document_business_links
          where asset_id = a.id
       ) bl on true
       left join lateral (
         select count(*)::integer as unmapped_field_count
           from public.document_unmapped_fields
          where asset_id = a.id
       ) uf on true
      where a.id = $1
        and a.device_id = $2
      limit 1`,
      [assetId, device.id]
    );
    const row = result.rows[0] || null;
    if (!row) {
      sendJson(res, 404, { code: 'DOCUMENT_ASSET_NOT_FOUND', message: 'Document asset not found for this device' });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      asset: mapCollectorAssetStatusRow(row)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_ASSET_STATUS_FAILED', message: error.message || 'Failed to load document asset status' });
  }
}

function buildDeviceListFilters(url, { activeWindowMinutes = 10 } = {}) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const healthValue = (key) =>
    `coalesce(nullif(d.metadata #>> '{heartbeat_payload,health,${key}}', ''), nullif(d.metadata #>> '{heartbeat_payload,${key}}', ''), '0')`;
  const healthAnyNonZero = (keys) => keys.map((key) => `${healthValue(key)} <> '0'`).join(' or ');

  const status = normalizeDeviceStatus(url.searchParams.get('status') || '', '');
  if (status) clauses.push(`d.status = ${addParam(status)}`);

  const onlineStatus = normalizeText(
    url.searchParams.get('onlineStatus') ||
      url.searchParams.get('online_status') ||
      url.searchParams.get('healthStatus') ||
      url.searchParams.get('health_status') ||
      '',
    40
  ).toLowerCase();
  if (onlineStatus) {
    const activeWindowInterval = `${activeWindowMinutes} minutes`;
    if (onlineStatus === 'active' || onlineStatus === 'online') {
      clauses.push(`d.status = 'active' and d.last_seen_at >= now() - (${addParam(activeWindowInterval)}::text)::interval`);
    } else if (onlineStatus === 'offline') {
      clauses.push(`coalesce(d.status, '') <> 'disabled' and (
        coalesce(d.status, '') <> 'active'
        or d.last_seen_at is null
        or d.last_seen_at < now() - (${addParam(activeWindowInterval)}::text)::interval
      )`);
    } else if (onlineStatus === 'disabled') {
      clauses.push(`d.status = 'disabled'`);
    }
  }

  const healthIssue = normalizeText(url.searchParams.get('healthIssue') || url.searchParams.get('health_issue') || '', 80).toLowerCase();
  const uploadBacklogClause = healthAnyNonZero([
    'pendingUploadCount',
    'failedUploadCount',
    'failedRetryReadyCount',
    'failedRetryWaitingCount',
    'failedRetryExhaustedCount',
    'missingLocalUploadFileCount'
  ]);
  const healthIssueClauses = {
    any: `(${[
      uploadBacklogClause,
      healthAnyNonZero(['pendingLogCount']),
      healthAnyNonZero(['missingWatchFolderCount']),
      healthAnyNonZero(['inaccessibleWatchFolderCount'])
    ].join(' or ')})`,
    upload_backlog: `(${uploadBacklogClause})`,
    pending_upload: `(${uploadBacklogClause})`,
    failed_upload: `(${uploadBacklogClause})`,
    log_backlog: `(${healthAnyNonZero(['pendingLogCount'])})`,
    pending_log: `(${healthAnyNonZero(['pendingLogCount'])})`,
    missing_watch_folder: `(${healthAnyNonZero(['missingWatchFolderCount'])})`,
    watch_folder_missing: `(${healthAnyNonZero(['missingWatchFolderCount'])})`,
    inaccessible_watch_folder: `(${healthAnyNonZero(['inaccessibleWatchFolderCount'])})`,
    watch_folder_inaccessible: `(${healthAnyNonZero(['inaccessibleWatchFolderCount'])})`
  };
  if (healthIssueClauses[healthIssue]) clauses.push(healthIssueClauses[healthIssue]);

  const lastSeenFrom = toIsoOrNull(
    url.searchParams.get('lastSeenFrom') ||
      url.searchParams.get('last_seen_from') ||
      url.searchParams.get('lastSeenAtFrom') ||
      url.searchParams.get('last_seen_at_from') ||
      ''
  );
  if (lastSeenFrom) clauses.push(`d.last_seen_at >= ${addParam(lastSeenFrom)}::timestamptz`);

  const lastSeenTo = toIsoOrNull(
    url.searchParams.get('lastSeenTo') ||
      url.searchParams.get('last_seen_to') ||
      url.searchParams.get('lastSeenAtTo') ||
      url.searchParams.get('last_seen_at_to') ||
      ''
  );
  if (lastSeenTo) clauses.push(`d.last_seen_at <= ${addParam(lastSeenTo)}::timestamptz`);

  const enterpriseId = normalizeText(url.searchParams.get('enterpriseId') || url.searchParams.get('enterprise_id') || '', 120);
  if (enterpriseId) clauses.push(`d.enterprise_id = ${addParam(enterpriseId)}`);

  const departmentId = normalizeText(url.searchParams.get('departmentId') || url.searchParams.get('department_id') || '', 120);
  if (departmentId) clauses.push(`d.department_id = ${addParam(departmentId)}`);

  const deviceCode = normalizeText(url.searchParams.get('deviceCode') || url.searchParams.get('device_code') || '', 120);
  if (deviceCode) clauses.push(`d.device_code = ${addParam(deviceCode)}`);

  const defaultUser = normalizeText(
    url.searchParams.get('defaultUser') ||
      url.searchParams.get('default_user') ||
      url.searchParams.get('defaultUploadedBy') ||
      url.searchParams.get('default_uploaded_by') ||
      '',
    160
  );
  if (defaultUser) {
    clauses.push(`(d.default_user_id = ${addParam(defaultUser)} or d.default_username = ${addParam(defaultUser)})`);
  }

  const defaultRole = normalizeText(url.searchParams.get('defaultRole') || url.searchParams.get('default_role') || '', 160);
  if (defaultRole) clauses.push(`d.default_role = ${addParam(defaultRole)}`);

  const clientVersion = normalizeText(url.searchParams.get('clientVersion') || url.searchParams.get('client_version') || '', 80);
  if (clientVersion) {
    const token = `%${clientVersion.replace(/[%_]/g, '\\$&')}%`;
    clauses.push(`d.client_version ilike ${addParam(token)} escape '\\'`);
  }

  const webviewVersion = normalizeText(
    url.searchParams.get('webviewVersion') ||
      url.searchParams.get('webViewVersion') ||
      url.searchParams.get('webview_version') ||
      '',
    120
  );
  if (webviewVersion) {
    const token = `%${webviewVersion.replace(/[%_]/g, '\\$&')}%`;
    clauses.push(`d.webview_version ilike ${addParam(token)} escape '\\'`);
  }

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${search.replace(/[%_]/g, '\\$&')}%`;
    clauses.push(`(
      d.device_code ilike ${addParam(token)} escape '\\'
      or d.device_name ilike ${addParam(token)} escape '\\'
      or d.default_username ilike ${addParam(token)} escape '\\'
      or d.default_role ilike ${addParam(token)} escape '\\'
      or d.enterprise_id ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function fetchAdminWatchFolders(clientOrPool, deviceId) {
  const result = await clientOrPool.query(
    `select *
       from public.collector_watch_folders
      where device_id = $1
      order by created_at asc, id asc`,
    [deviceId]
  );
  return result.rows;
}

async function replaceAdminWatchFolders(client, deviceId, watchFolders) {
  await client.query('delete from public.collector_watch_folders where device_id = $1', [deviceId]);
  const normalizedFolders = normalizeWatchFolders(watchFolders);
  for (const folder of normalizedFolders) {
    await client.query(
      `insert into public.collector_watch_folders (
         device_id, folder_path, folder_name, default_user_id, default_username, default_role, enabled, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        deviceId,
        folder.folderPath,
        folder.folderName,
        folder.defaultUserId,
        folder.defaultUsername,
        folder.defaultRole,
        folder.enabled !== false,
        {}
      ]
    );
  }
  return fetchAdminWatchFolders(client, deviceId);
}

function getAdminDeviceId(req) {
  const assigned = toUuidOrNull(req?.documentIntakeDeviceId || '');
  if (assigned) return assigned;
  const url = new URL(req.url || '/', 'http://localhost');
  const fromQuery = toUuidOrNull(url.searchParams.get('deviceId') || url.searchParams.get('device_id') || url.searchParams.get('id') || '');
  if (fromQuery) return fromQuery;
  const match = url.pathname.match(/\/document-intake\/admin\/devices\/([^/?#]+)/);
  if (!match) return null;
  try {
    return toUuidOrNull(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function hasBodyField(body, camelName, snakeName = '') {
  if (!body || typeof body !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(body, camelName) ||
    (snakeName ? Object.prototype.hasOwnProperty.call(body, snakeName) : false);
}

function buildDeviceMetadata(existingMetadata, body, user, action) {
  const metadata = {
    ...asJsonObject(existingMetadata),
    ...asJsonObject(body.metadata)
  };
  const remoteConfig = firstDefined(body.remoteConfig, body.remote_config);
  if (remoteConfig !== undefined) {
    metadata.remote_config = asJsonObject(remoteConfig);
    metadata.remote_config_version = normalizeText(body.configVersion || body.config_version || '', 120) || new Date().toISOString();
  }
  const auditKey = action === 'create' ? 'created_by_admin' : 'updated_by_admin';
  metadata[auditKey] = normalizeText(user?.username || user?.id || '', 160);
  metadata[`${action}_at`] = new Date().toISOString();
  return metadata;
}

async function handleListAdminDevices(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 50, { min: 1, max: 200 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const activeWindowMinutes = positiveInteger(url.searchParams.get('activeWindowMinutes'), 10, { min: 1, max: 24 * 60 });
  const filters = buildDeviceListFilters(url, { activeWindowMinutes });

  try {
    const totalResult = await query(
      `select count(*)::integer as device_total_count
         from public.collector_devices d
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         d.id, d.device_code, d.device_name, d.enterprise_id, d.department_id,
         d.default_user_id, d.default_username, d.default_role, d.server_base_url,
         d.client_version, d.webview_version, d.status, d.last_seen_at,
         d.metadata, d.created_at, d.updated_at,
         coalesce(w.watch_folder_count, 0)::integer as watch_folder_count,
         coalesce(a.today_file_count, 0)::integer as today_file_count,
         coalesce(a.total_file_count, 0)::integer as total_file_count,
         a.last_asset_at,
         coalesce(l.log_count, 0)::integer as log_count
       from public.collector_devices d
       left join lateral (
         select count(*)::integer as watch_folder_count
           from public.collector_watch_folders
          where device_id = d.id
       ) w on true
       left join lateral (
         select
           count(*) filter (where created_at >= current_date)::integer as today_file_count,
           count(*)::integer as total_file_count,
           max(created_at) as last_asset_at
           from public.document_assets
          where device_id = d.id
       ) a on true
       left join lateral (
         select count(*)::integer as log_count
           from public.client_log_events
          where device_id = d.id
       ) l on true
       ${filters.whereSql}
       order by d.updated_at desc, d.device_code asc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      total: integerOrZero(totalResult.rows[0]?.device_total_count),
      limit,
      offset,
      activeWindowMinutes,
      items: rowsResult.rows.map((row) => mapDeviceRow(row, { activeWindowMinutes, includeMetadata: false }))
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_DEVICE_LIST_FAILED', message: error.message || 'Failed to load collector devices' });
  }
}

async function loadAdminDeviceSummary(deviceId, activeWindowMinutes = 10) {
  const result = await query(
    `select
       d.id, d.device_code, d.device_name, d.enterprise_id, d.department_id,
       d.default_user_id, d.default_username, d.default_role, d.server_base_url,
       d.client_version, d.webview_version, d.status, d.last_seen_at,
       d.metadata, d.created_at, d.updated_at,
       coalesce(w.watch_folder_count, 0)::integer as watch_folder_count,
       coalesce(a.today_file_count, 0)::integer as today_file_count,
       coalesce(a.total_file_count, 0)::integer as total_file_count,
       a.last_asset_at,
       coalesce(l.log_count, 0)::integer as log_count
     from public.collector_devices d
     left join lateral (
       select count(*)::integer as watch_folder_count
         from public.collector_watch_folders
        where device_id = d.id
     ) w on true
     left join lateral (
       select
         count(*) filter (where created_at >= current_date)::integer as today_file_count,
         count(*)::integer as total_file_count,
         max(created_at) as last_asset_at
         from public.document_assets
        where device_id = d.id
     ) a on true
     left join lateral (
       select count(*)::integer as log_count
         from public.client_log_events
        where device_id = d.id
     ) l on true
     where d.id = $1`,
    [deviceId]
  );
  const device = result.rows[0] || null;
  if (!device) return null;
  const watchFolders = await fetchAdminWatchFolders(pool, deviceId);
  return mapDeviceRow(device, { watchFolders, activeWindowMinutes });
}

async function handleGetAdminDeviceDetail(req, res, { sendJson }) {
  const deviceId = getAdminDeviceId(req);
  if (!deviceId) {
    sendJson(res, 400, { code: 'COLLECTOR_DEVICE_ID_REQUIRED', message: 'A valid device id is required' });
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const activeWindowMinutes = positiveInteger(url.searchParams.get('activeWindowMinutes'), 10, { min: 1, max: 24 * 60 });
  try {
    const device = await loadAdminDeviceSummary(deviceId, activeWindowMinutes);
    if (!device) {
      sendJson(res, 404, { code: 'COLLECTOR_DEVICE_NOT_FOUND', message: 'Collector device not found' });
      return;
    }
    sendJson(res, 200, { ok: true, device });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_DEVICE_DETAIL_FAILED', message: error.message || 'Failed to load collector device' });
  }
}

async function handleCreateAdminDevice(req, res, { sendJson, readJsonBody }) {
  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const enterpriseId = normalizeText(body.enterpriseId || body.enterprise_id || body.enterpriseCode || body.enterprise_code || '', 120);
  const deviceCode = normalizeText(body.deviceCode || body.device_code || '', 120);
  const deviceName = normalizeText(body.deviceName || body.device_name || deviceCode, 200);
  if (!enterpriseId || !deviceCode || !deviceName) {
    sendJson(res, 400, { code: 'COLLECTOR_DEVICE_FIELDS_REQUIRED', message: 'enterpriseId, deviceCode and deviceName are required' });
    return;
  }

  const authorizationCode = normalizeText(body.authorizationCode || body.authorization_code || body.bindingCode || body.binding_code || '', 200) || randomBindingCode();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const metadata = buildDeviceMetadata({}, body, req.documentIntakeAdminUser, 'create');
    const inserted = await client.query(
      `insert into public.collector_devices (
         device_code, device_name, enterprise_id, department_id, default_user_id,
         default_username, default_role, server_base_url, binding_code_hash,
         client_version, webview_version, status, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning *`,
      [
        deviceCode,
        deviceName,
        enterpriseId,
        normalizeText(body.departmentId || body.department_id || '', 120),
        normalizeText(body.defaultUserId || body.default_user_id || '', 120),
        normalizeText(body.defaultUsername || body.default_username || '', 160),
        normalizeText(body.defaultRole || body.default_role || '', 120),
        normalizeText(body.serverBaseUrl || body.server_base_url || '', 1000),
        sha256(authorizationCode),
        normalizeText(body.clientVersion || body.client_version || '', 80),
        normalizeText(body.webviewVersion || body.webview_version || '', 120),
        normalizeDeviceStatus(body.status || 'pending', 'pending'),
        metadata
      ]
    );
    const deviceRow = inserted.rows[0];
    const watchFolders = hasBodyField(body, 'watchFolders', 'watch_folders')
      ? await replaceAdminWatchFolders(client, deviceRow.id, firstDefined(body.watchFolders, body.watch_folders))
      : [];
    await client.query('commit');
    sendJson(res, 201, {
      ok: true,
      device: mapDeviceRow(deviceRow, { watchFolders }),
      authorizationCode
    });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    if (error?.code === '23505') {
      sendJson(res, 409, { code: 'COLLECTOR_DEVICE_ALREADY_EXISTS', message: 'Collector device already exists' });
    } else {
      sendJson(res, 500, { code: 'COLLECTOR_DEVICE_CREATE_FAILED', message: error.message || 'Failed to create collector device' });
    }
  } finally {
    client.release();
  }
}

async function handleUpdateAdminDevice(req, res, { sendJson, readJsonBody }) {
  const deviceId = getAdminDeviceId(req);
  if (!deviceId) {
    sendJson(res, 400, { code: 'COLLECTOR_DEVICE_ID_REQUIRED', message: 'A valid device id is required' });
    return;
  }
  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const existingResult = await client.query(
      `select *
         from public.collector_devices
        where id = $1
        for update`,
      [deviceId]
    );
    const existing = existingResult.rows[0] || null;
    if (!existing) {
      await client.query('rollback');
      sendJson(res, 404, { code: 'COLLECTOR_DEVICE_NOT_FOUND', message: 'Collector device not found' });
      return;
    }

    let status = hasBodyField(body, 'status') ? normalizeDeviceStatus(body.status, existing.status || 'pending') : existing.status;
    if (body.disabled === true || body.enabled === false) status = 'disabled';
    if (body.enabled === true && status === 'disabled') status = 'active';
    const metadata = buildDeviceMetadata(existing.metadata, body, req.documentIntakeAdminUser, 'update');
    const updated = await client.query(
      `update public.collector_devices
          set device_name = $2,
              department_id = $3,
              default_user_id = $4,
              default_username = $5,
              default_role = $6,
              server_base_url = $7,
              client_version = $8,
              webview_version = $9,
              status = $10,
              metadata = $11::jsonb,
              updated_at = now()
        where id = $1
        returning *`,
      [
        deviceId,
        normalizeText(firstDefined(body.deviceName, body.device_name, existing.device_name), 200),
        normalizeText(firstDefined(body.departmentId, body.department_id, existing.department_id), 120),
        normalizeText(firstDefined(body.defaultUserId, body.default_user_id, existing.default_user_id), 120),
        normalizeText(firstDefined(body.defaultUsername, body.default_username, existing.default_username), 160),
        normalizeText(firstDefined(body.defaultRole, body.default_role, existing.default_role), 120),
        normalizeText(firstDefined(body.serverBaseUrl, body.server_base_url, existing.server_base_url), 1000),
        normalizeText(firstDefined(body.clientVersion, body.client_version, existing.client_version), 80),
        normalizeText(firstDefined(body.webviewVersion, body.webview_version, existing.webview_version), 120),
        status,
        JSON.stringify(metadata)
      ]
    );
    const watchFolders = hasBodyField(body, 'watchFolders', 'watch_folders')
      ? await replaceAdminWatchFolders(client, deviceId, firstDefined(body.watchFolders, body.watch_folders))
      : await fetchAdminWatchFolders(client, deviceId);
    await client.query('commit');
    sendJson(res, 200, { ok: true, device: mapDeviceRow(updated.rows[0], { watchFolders }) });
  } catch (error) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    sendJson(res, 500, { code: 'COLLECTOR_DEVICE_UPDATE_FAILED', message: error.message || 'Failed to update collector device' });
  } finally {
    client.release();
  }
}

async function handleResetAdminDeviceBindCode(req, res, { sendJson, readJsonBody }) {
  const deviceId = getAdminDeviceId(req);
  if (!deviceId) {
    sendJson(res, 400, { code: 'COLLECTOR_DEVICE_ID_REQUIRED', message: 'A valid device id is required' });
    return;
  }
  let body = {};
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const authorizationCode = normalizeText(body.authorizationCode || body.authorization_code || body.bindingCode || body.binding_code || '', 200) || randomBindingCode();
  try {
    const result = await query(
      `update public.collector_devices
          set binding_code_hash = $2,
              device_token_hash = null,
              status = 'pending',
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = now()
        where id = $1
        returning id, device_code, device_name, enterprise_id, department_id,
                  default_user_id, default_username, default_role, server_base_url,
                  client_version, webview_version, status, last_seen_at, metadata, created_at, updated_at`,
      [
        deviceId,
        sha256(authorizationCode),
        JSON.stringify({
          binding_code_reset_at: new Date().toISOString(),
          binding_code_reset_by: normalizeText(req.documentIntakeAdminUser?.username || req.documentIntakeAdminUser?.id || '', 160)
        })
      ]
    );
    const device = result.rows[0] || null;
    if (!device) {
      sendJson(res, 404, { code: 'COLLECTOR_DEVICE_NOT_FOUND', message: 'Collector device not found' });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      device: mapDeviceRow(device),
      authorizationCode
    });
  } catch (error) {
    sendJson(res, 500, { code: 'COLLECTOR_DEVICE_RESET_BIND_CODE_FAILED', message: error.message || 'Failed to reset collector device authorization code' });
  }
}

function logAssetOwnershipMatchSql(assetAlias = 'a') {
  return `((
      l.ai_import_batch_id is not null
      and ${assetAlias}.batch_id = l.ai_import_batch_id
    ) or (
      l.source_file_hash is not null
      and ${assetAlias}.file_hash = l.source_file_hash
      and (l.device_id is null or ${assetAlias}.device_id = l.device_id)
    ))`;
}

function appendLogUploadOwnershipClauses(url, clauses, addParam) {
  const addAssetExistsClause = (predicate) => {
    clauses.push(`exists (
      select 1
        from public.document_assets a
       where ${logAssetOwnershipMatchSql('a')}
         and ${predicate}
    )`);
  };

  const uploadSource = normalizeText(url.searchParams.get('uploadSource') || url.searchParams.get('upload_source') || '', 80);
  if (uploadSource) addAssetExistsClause(`a.upload_source = ${addParam(uploadSource)}`);

  const operatorSource = normalizeText(url.searchParams.get('operatorSource') || url.searchParams.get('operator_source') || '', 80);
  if (operatorSource) {
    addAssetExistsClause(`coalesce(a.operator_source, a.metadata->>'operator_source', a.metadata->>'operatorSource', '') = ${addParam(operatorSource)}`);
  }

  const sourceFolder = normalizeText(url.searchParams.get('sourceFolder') || url.searchParams.get('source_folder') || '', 1000);
  if (sourceFolder) {
    const token = `%${sourceFolder.replace(/[%_]/g, '\\$&')}%`;
    clauses.push(`(
      coalesce(l.metadata->>'source_folder', l.metadata->>'sourceFolder', '') ilike ${addParam(token)} escape '\\'
      or exists (
        select 1
          from public.document_assets a
         where ${logAssetOwnershipMatchSql('a')}
           and a.source_folder ilike ${addParam(token)} escape '\\'
      )
    )`);
  }

  const uploadedBy = normalizeText(url.searchParams.get('uploadedBy') || url.searchParams.get('uploaded_by') || '', 160);
  if (uploadedBy) {
    const uploadedByParam = addParam(uploadedBy);
    addAssetExistsClause(`(a.uploaded_by_user_id = ${uploadedByParam} or a.uploaded_by_username = ${uploadedByParam})`);
  }

  const uploadedByRole = normalizeText(
    url.searchParams.get('uploadedByRole') ||
      url.searchParams.get('uploaded_by_role') ||
      '',
    160
  );
  if (uploadedByRole) {
    addAssetExistsClause(`coalesce(a.uploaded_by_role, a.metadata->>'uploaded_by_role', a.metadata->>'uploadedByRole', '') = ${addParam(uploadedByRole)}`);
  }

  const assetStatus = normalizeText(url.searchParams.get('assetStatus') || url.searchParams.get('asset_status') || '', 50).toLowerCase();
  if (assetStatus) {
    addAssetExistsClause(`a.status = ${addParam(assetStatus)}`);
  }

  const duplicate = normalizeOptionalBoolean(
    url.searchParams.get('duplicate') ||
      url.searchParams.get('isDuplicate') ||
      url.searchParams.get('is_duplicate') ||
      ''
  );
  if (duplicate === true) {
    addAssetExistsClause(`(a.status = 'duplicate' or a.duplicate_of_asset_id is not null)`);
  } else if (duplicate === false) {
    addAssetExistsClause(`(a.status <> 'duplicate' and a.duplicate_of_asset_id is null)`);
  }
}

function buildLogListFilters(url) {
  const clauses = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const deviceId = toUuidOrNull(url.searchParams.get('deviceId') || url.searchParams.get('device_id') || '');
  if (deviceId) clauses.push(`l.device_id = ${addParam(deviceId)}::uuid`);

  const deviceCode = normalizeText(url.searchParams.get('deviceCode') || url.searchParams.get('device_code') || '', 120);
  if (deviceCode) clauses.push(`d.device_code = ${addParam(deviceCode)}`);

  const username = normalizeText(url.searchParams.get('username') || url.searchParams.get('user') || '', 160);
  if (username) clauses.push(`(l.username = ${addParam(username)} or l.user_id = ${addParam(username)})`);

  const role = normalizeText(url.searchParams.get('role') || url.searchParams.get('userRole') || url.searchParams.get('user_role') || '', 120);
  if (role) clauses.push(`l.role = ${addParam(role)}`);

  const appModule = normalizeText(url.searchParams.get('appModule') || url.searchParams.get('app_module') || url.searchParams.get('module') || '', 120);
  if (appModule) clauses.push(`l.app_module = ${addParam(appModule)}`);

  const route = normalizeText(url.searchParams.get('route') || url.searchParams.get('page') || '', 500);
  if (route) clauses.push(`l.route = ${addParam(route)}`);

  const level = normalizeText(url.searchParams.get('level') || '', 20).toLowerCase();
  if (level) clauses.push(`lower(l.level) = ${addParam(level)}`);

  const eventType = normalizeText(url.searchParams.get('eventType') || url.searchParams.get('event_type') || '', 80);
  if (eventType) clauses.push(`l.event_type = ${addParam(eventType)}`);

  const fileHash = normalizeText(url.searchParams.get('fileHash') || url.searchParams.get('sourceFileHash') || url.searchParams.get('source_file_hash') || '', 128);
  if (fileHash) clauses.push(`l.source_file_hash = ${addParam(fileHash)}`);

  const batchId = toUuidOrNull(url.searchParams.get('batchId') || url.searchParams.get('aiImportBatchId') || url.searchParams.get('ai_import_batch_id') || '');
  if (batchId) clauses.push(`l.ai_import_batch_id = ${addParam(batchId)}::uuid`);

  const batchNo = normalizeText(url.searchParams.get('batchNo') || url.searchParams.get('batch') || url.searchParams.get('importBatch') || '', 160);
  if (batchNo) clauses.push(`b.batch_no ilike ${addParam(`%${batchNo.replace(/[%_]/g, '\\$&')}%`)} escape '\\'`);

  appendLogUploadOwnershipClauses(url, clauses, addParam);

  const traceId = normalizeText(url.searchParams.get('traceId') || url.searchParams.get('trace_id') || '', 160);
  if (traceId) clauses.push(`l.trace_id = ${addParam(traceId)}`);

  const clientSessionId = normalizeText(
    url.searchParams.get('clientSessionId') || url.searchParams.get('client_session_id') || url.searchParams.get('sessionId') || url.searchParams.get('session_id') || '',
    160
  );
  if (clientSessionId) clauses.push(`l.client_session_id = ${addParam(clientSessionId)}`);

  const createdFrom = toIsoOrNull(url.searchParams.get('createdFrom') || url.searchParams.get('from') || '');
  if (createdFrom) clauses.push(`l.created_at >= ${addParam(createdFrom)}::timestamptz`);

  const createdTo = toIsoOrNull(url.searchParams.get('createdTo') || url.searchParams.get('to') || '');
  if (createdTo) clauses.push(`l.created_at <= ${addParam(createdTo)}::timestamptz`);

  const search = normalizeText(url.searchParams.get('search') || url.searchParams.get('q') || '', 200);
  if (search) {
    const token = `%${search.replace(/[%_]/g, '\\$&')}%`;
    clauses.push(`(
      l.message ilike ${addParam(token)} escape '\\'
      or l.stack ilike ${addParam(token)} escape '\\'
      or l.username ilike ${addParam(token)} escape '\\'
      or l.role ilike ${addParam(token)} escape '\\'
      or l.route ilike ${addParam(token)} escape '\\'
      or l.request_url ilike ${addParam(token)} escape '\\'
      or l.client_session_id ilike ${addParam(token)} escape '\\'
      or l.trace_id ilike ${addParam(token)} escape '\\'
      or d.device_code ilike ${addParam(token)} escape '\\'
      or coalesce(l.device_name, d.device_name) ilike ${addParam(token)} escape '\\'
    )`);
  }

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params
  };
}

async function handleListAdminLogs(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const limit = positiveInteger(url.searchParams.get('limit'), 100, { min: 1, max: 500 });
  const offset = positiveInteger(url.searchParams.get('offset'), 0, { min: 0, max: 1000000 });
  const filters = buildLogListFilters(url);

  try {
    const totalResult = await query(
      `select count(*)::integer as log_total_count
         from public.client_log_events l
         left join public.collector_devices d on d.id = l.device_id
         left join public.document_import_batches b on b.id = l.ai_import_batch_id
       ${filters.whereSql}`,
      filters.params
    );
    const rowParams = [...filters.params, limit, offset];
    const limitParam = `$${filters.params.length + 1}`;
    const offsetParam = `$${filters.params.length + 2}`;
    const rowsResult = await query(
      `select
         l.id, l.level, l.event_type, l.message, l.stack, l.device_id,
         d.device_code,
         coalesce(l.device_name, d.device_name) as device_name,
         l.user_id, l.username, l.role, l.app_module, l.route, l.url,
         l.request_url, l.status_code, l.client_session_id, l.trace_id,
         l.ai_import_batch_id, b.batch_no as ai_import_batch_no,
         l.source_file_hash, l.app_version, l.webview_version,
         oa.source_asset_id, oa.source_asset_count,
         oa.asset_status, oa.duplicate,
         oa.uploaded_by_user_id, oa.uploaded_by_username, oa.uploaded_by_role,
         oa.upload_source, oa.operator_source, oa.source_folder,
         l.metadata, l.created_at
       from public.client_log_events l
       left join public.collector_devices d on d.id = l.device_id
       left join public.document_import_batches b on b.id = l.ai_import_batch_id
       left join lateral (
         select
           (array_agg(a.id order by a.created_at desc, a.id desc))[1] as source_asset_id,
           count(*)::integer as source_asset_count,
           (array_agg(a.status order by a.created_at desc, a.id desc))[1] as asset_status,
           bool_or(a.status = 'duplicate' or a.duplicate_of_asset_id is not null) as duplicate,
           string_agg(distinct nullif(a.uploaded_by_user_id, ''), ', ') as uploaded_by_user_id,
           string_agg(distinct nullif(a.uploaded_by_username, ''), ', ') as uploaded_by_username,
           string_agg(distinct nullif(coalesce(a.uploaded_by_role, a.metadata->>'uploaded_by_role', a.metadata->>'uploadedByRole'), ''), ', ') as uploaded_by_role,
           string_agg(distinct nullif(a.upload_source, ''), ', ') as upload_source,
           string_agg(distinct nullif(coalesce(a.operator_source, a.metadata->>'operator_source', a.metadata->>'operatorSource'), ''), ', ') as operator_source,
           string_agg(distinct nullif(a.source_folder, ''), ', ') as source_folder
         from public.document_assets a
        where ${logAssetOwnershipMatchSql('a')}
       ) oa on true
       ${filters.whereSql}
       order by l.created_at desc, l.id desc
       limit ${limitParam}
       offset ${offsetParam}`,
      rowParams
    );

    sendJson(res, 200, {
      ok: true,
      total: integerOrZero(totalResult.rows[0]?.log_total_count),
      limit,
      offset,
      items: rowsResult.rows.map(mapClientLogRow)
    });
  } catch (error) {
    sendJson(res, 500, { code: 'DOCUMENT_INTAKE_LOG_LIST_FAILED', message: error.message || 'Failed to load collector logs' });
  }
}

async function handleGetCollectorRelease(req, res, { sendJson }) {
  const url = new URL(req.url || '/', 'http://localhost');
  const prefix = '/document-intake/collector/releases/';
  const rawName = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
  const filename = normalizeCollectorReleaseFilename(rawName);
  if (!filename) {
    sendJson(res, 400, { code: 'COLLECTOR_RELEASE_FILE_INVALID', message: 'Invalid collector release filename' });
    return;
  }

  const releasePath = resolveCollectorReleasePath(filename);
  if (!releasePath) {
    sendJson(res, 400, { code: 'COLLECTOR_RELEASE_FILE_INVALID', message: 'Invalid collector release path' });
    return;
  }

  let stat;
  try {
    stat = await fs.promises.stat(releasePath);
  } catch {
    sendJson(res, 404, { code: 'COLLECTOR_RELEASE_NOT_FOUND', message: 'Collector release file not found' });
    return;
  }

  if (!stat.isFile()) {
    sendJson(res, 404, { code: 'COLLECTOR_RELEASE_NOT_FOUND', message: 'Collector release file not found' });
    return;
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': collectorReleaseContentType(filename),
    'Content-Length': String(stat.size),
    'Cache-Control': filename === 'update.json'
      ? 'no-store'
      : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff'
  };
  if (typeof res.writeHead === 'function') {
    res.writeHead(200, headers);
  } else {
    res.statusCode = 200;
    res.headers = headers;
  }

  if ((req.method || 'GET').toUpperCase() === 'HEAD') {
    if (typeof res.end === 'function') res.end();
    return;
  }

  if (typeof res.end !== 'function') {
    res.body = await fs.promises.readFile(releasePath);
    return;
  }

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(releasePath);
    stream.on('error', reject);
    res.on?.('error', reject);
    res.on?.('finish', resolve);
    res.on?.('close', resolve);
    stream.pipe(res);
  });
}

function createDocumentIntakeHandlers(deps) {
  return {
    handleBindDevice: (req, res) => handleBindDevice(req, res, deps),
    handleGetDeviceConfig: (req, res) => handleGetDeviceConfig(req, res, deps),
    handleHeartbeat: (req, res) => handleHeartbeat(req, res, deps),
    handleUploadAsset: (req, res) => handleUploadAsset(req, res, deps),
    handleInitChunkUpload: (req, res) => handleInitChunkUpload(req, res, deps),
    handleUploadChunk: (req, res) => handleUploadChunk(req, res, deps),
    handleCompleteChunkUpload: (req, res) => handleCompleteChunkUpload(req, res, deps),
    handleLogBatch: (req, res) => handleLogBatch(req, res, deps),
    handleGetCollectorAssetStatus: (req, res) => handleGetCollectorAssetStatus(req, res, deps),
    handleRecordBusinessCorrection: (req, res) => handleRecordBusinessCorrection(req, res, deps),
    handleGetAdminOverview: (req, res) => handleGetAdminOverview(req, res, deps),
    handleGetAdminPolicies: (req, res) => handleGetAdminPolicies(req, res, deps),
    handleUpdateAdminPolicies: (req, res) => handleUpdateAdminPolicies(req, res, deps),
    handleResetAdminPolicies: (req, res) => handleResetAdminPolicies(req, res, deps),
    handleRunAdminSourceFileRetention: (req, res) => handleRunAdminSourceFileRetention(req, res, deps),
    handleListAdminAssets: (req, res) => handleListAdminAssets(req, res, deps),
    handleGetAdminAssetDetail: (req, res) => handleGetAdminAssetDetail(req, res, deps),
    handleListAdminBusinessSources: (req, res) => handleListAdminBusinessSources(req, res, deps),
    handleListAdminRecalculationTasks: (req, res) => handleListAdminRecalculationTasks(req, res, deps),
    handleListAdminProductionWorkReports: (req, res) => handleListAdminProductionWorkReports(req, res, deps),
    handleListAdminQualityInspections: (req, res) => handleListAdminQualityInspections(req, res, deps),
    handleListAdminHrAttendanceSnapshots: (req, res) => handleListAdminHrAttendanceSnapshots(req, res, deps),
    handleListAdminPayrollPrecheckSnapshots: (req, res) => handleListAdminPayrollPrecheckSnapshots(req, res, deps),
    handleListAdminPayrollPrecheckResults: (req, res) => handleListAdminPayrollPrecheckResults(req, res, deps),
    handleListAdminPayrollReadyPrecheckResults: (req, res) => handleListAdminPayrollReadyPrecheckResults(req, res, deps),
    handleGenerateAdminPayrollPrecheckTrial: (req, res) => handleGenerateAdminPayrollPrecheckTrial(req, res, deps),
    handleUpdateAdminPayrollPrecheckResult: (req, res) => handleUpdateAdminPayrollPrecheckResult(req, res, deps),
    handleUpdateAdminHrAttendanceSnapshot: (req, res) => handleUpdateAdminHrAttendanceSnapshot(req, res, deps),
    handleDownloadAdminAsset: (req, res) => handleDownloadAdminAsset(req, res, deps),
    handlePreviewAdminAsset: (req, res) => handlePreviewAdminAsset(req, res, deps),
    handleReviewAdminAsset: (req, res) => handleReviewAdminAsset(req, res, deps),
    handleListAdminDevices: (req, res) => handleListAdminDevices(req, res, deps),
    handleGetAdminDeviceDetail: (req, res) => handleGetAdminDeviceDetail(req, res, deps),
    handleCreateAdminDevice: (req, res) => handleCreateAdminDevice(req, res, deps),
    handleUpdateAdminDevice: (req, res) => handleUpdateAdminDevice(req, res, deps),
    handleResetAdminDeviceBindCode: (req, res) => handleResetAdminDeviceBindCode(req, res, deps),
    handleListAdminLogs: (req, res) => handleListAdminLogs(req, res, deps),
    handleGetCollectorRelease: (req, res) => handleGetCollectorRelease(req, res, deps)
  };
}

module.exports = {
  createDocumentIntakeHandlers
};
