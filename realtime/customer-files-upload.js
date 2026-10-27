// SPDX-License-Identifier: AGPL-3.0-or-later

'use strict';

const crypto = require('node:crypto');

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FILE_BYTES;
const MIME_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp4: 'video/mp4', mp3: 'audio/mpeg'
});
const ALLOWED_MIMES = new Set(Object.values(MIME_BY_EXTENSION));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const fail = (code, message, httpStatus = 400) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  return error;
};

const readRawBody = (req, maxBytes) => new Promise((resolve, reject) => {
  const chunks = [];
  let total = 0;
  let oversized = false;
  req.on('data', (chunk) => {
    total += chunk.length;
    if (total > maxBytes) { oversized = true; return; }
    if (!oversized) chunks.push(Buffer.from(chunk));
  });
  req.on('end', () => oversized ? reject(fail('PAYLOAD_TOO_LARGE', 'File exceeds the 20 MiB upload limit', 413)) : resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const normalizeFilename = (value) => {
  const basename = text(value, 240).replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!basename || basename === '.' || basename === '..') throw fail('FILE_NAME_INVALID', 'A supported filename is required');
  return basename;
};

const resolveMime = (filename, requested) => {
  const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  const expected = MIME_BY_EXTENSION[extension];
  const supplied = text(requested, 120).split(';')[0].toLowerCase();
  if (!expected || !ALLOWED_MIMES.has(expected)) throw fail('FILE_TYPE_INVALID', 'This file type is not supported');
  if (supplied && supplied !== 'application/octet-stream' && supplied !== expected) throw fail('FILE_TYPE_INVALID', 'The filename and file type do not match');
  return expected;
};

const requestFileId = (req) => {
  const id = new URL(String(req.url || ''), 'http://localhost').searchParams.get('id') || '';
  if (!UUID_RE.test(id)) throw fail('FILE_ID_INVALID', 'A valid file id is required');
  return id;
};

const createCustomerFileUploadHandler = ({ authorize, sendJson, callPostgrestWithUser, fetchSemanticContext } = {}) => {
  if (typeof authorize !== 'function' || typeof sendJson !== 'function' || typeof callPostgrestWithUser !== 'function' || typeof fetchSemanticContext !== 'function') {
    throw new TypeError('Customer file upload dependencies are required');
  }

  const requireFileContext = async (user, { write = false } = {}) => {
    const context = await fetchSemanticContext(user);
    if (!context?.accessPolicy?.roleScoped || context.fieldAclAvailable !== true) throw fail('HARNESS_PERMISSION_DENIED', 'Role-scoped customer permissions are unavailable', 403);
    const permissions = new Set((Array.isArray(context.permissions) ? context.permissions : []).map((entry) => text(entry?.code || entry, 120)));
    const superUser = context.accessPolicy.superUser === true;
    if (!superUser && !permissions.has('app:sales_customer')) throw fail('HARNESS_PERMISSION_DENIED', 'Customer archive permission is not granted', 403);
    if (write && !superUser && !['op:sales_customer.create', 'op:sales_customer.edit', 'op:sales_customer.delete'].some((permission) => permissions.has(permission))) throw fail('HARNESS_PERMISSION_DENIED', 'Customer archive edit permission is not granted', 403);
    const acl = context.fieldAcl?.sales_customer?.customer_files;
    if (write ? acl?.canEdit === false : acl?.canView === false) throw fail('HARNESS_PERMISSION_DENIED', `Customer file field is not ${write ? 'editable' : 'visible'}`, 403);
    return { context, permissions, superUser };
  };

  const loadOwnedFile = async (user, fileId, { includeContent = false } = {}) => {
    const select = includeContent
      ? 'id,filename,mime_type,size_bytes,content_base64,created_at,extra'
      : 'id,filename,mime_type,size_bytes,created_at,extra';
    const response = await callPostgrestWithUser(user, {
      method: 'GET',
      path: '/files',
      query: { select, id: `eq.${fileId}`, limit: '1' },
      acceptProfile: 'public',
      timeoutMs: 8000
    });
    const row = Array.isArray(response?.data) ? response.data[0] : null;
    if (!row) throw fail('FILE_NOT_FOUND', 'File was not found', 404);
    const owner = object(row.extra);
    if (owner.source !== 'harness_customer_archive' || owner.uploaded_by !== text(user.id || user.username, 160) || owner.tenant_id !== text(user.tenant_id || user.tenantId, 160)) throw fail('FILE_FORBIDDEN', 'File does not belong to the current user and tenant', 403);
    return row;
  };

  const handleUpload = async (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    const length = Number(req.headers['content-length']);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      sendJson(res, 413, { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds the 20 MiB upload limit' });
      req.resume?.();
      return;
    }
    try {
      await requireFileContext(user, { write: true });

      const body = await readRawBody(req, MAX_BODY_BYTES);
      if (!body.length) throw fail('FILE_REQUIRED', 'File body is empty');
      const filename = normalizeFilename(decodeURIComponent(text(req.headers['x-eiscore-file-name'], 720)));
      const mimeType = resolveMime(filename, req.headers['content-type']);
      const sha256 = crypto.createHash('sha256').update(body).digest('hex');
      const response = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/files',
        body: {
          filename,
          mime_type: mimeType,
          size_bytes: body.byteLength,
          content_base64: body.toString('base64'),
          sha256,
          extra: {
            source: 'harness_customer_archive',
            uploaded_by: text(user.id || user.username, 160),
            tenant_id: text(user.tenant_id || user.tenantId, 160)
          }
        },
        acceptProfile: 'public',
        contentProfile: 'public',
        prefer: 'return=representation',
        timeoutMs: 30000
      });
      const row = Array.isArray(response?.data) ? response.data[0] : response?.data;
      if (!row?.id) throw fail('FILE_UPLOAD_FAILED', 'File could not be stored', 502);
      sendJson(res, 201, { id: row.id, filename: row.filename || filename, mime_type: row.mime_type || mimeType, size_bytes: Number(row.size_bytes || body.byteLength), created_at: row.created_at || '' });
    } catch (error) {
      const status = Number(error?.httpStatus || (error?.code === 'PAYLOAD_TOO_LARGE' ? 413 : 500));
      const code = text(error?.code || 'FILE_UPLOAD_FAILED', 80);
      sendJson(res, status, { code, message: status >= 500 ? 'File upload failed' : text(error?.message || 'File upload was rejected', 240) });
    }
  };

  const handleRead = async (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    try {
      const id = requestFileId(req);
      await requireFileContext(user);
      const row = await loadOwnedFile(user, id, { includeContent: true });
      if (!row.content_base64) throw fail('FILE_CONTENT_UNAVAILABLE', 'File content is unavailable', 404);
      sendJson(res, 200, { id: row.id, filename: row.filename, mime_type: row.mime_type, size_bytes: Number(row.size_bytes || 0), content_base64: row.content_base64, created_at: row.created_at || '' });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      sendJson(res, status, { code: text(error?.code || 'FILE_READ_FAILED', 80), message: status >= 500 ? 'File read failed' : text(error?.message || 'File read was rejected', 240) });
    }
  };

  const handleDelete = async (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    try {
      const id = requestFileId(req);
      const { permissions, superUser } = await requireFileContext(user, { write: true });
      if (!superUser && !permissions.has('op:sales_customer.edit') && !permissions.has('op:sales_customer.delete')) throw fail('HARNESS_PERMISSION_DENIED', 'Customer archive file delete permission is not granted', 403);
      await loadOwnedFile(user, id);
      await callPostgrestWithUser(user, { method: 'DELETE', path: '/files', query: { id: `eq.${id}` }, acceptProfile: 'public', contentProfile: 'public', prefer: 'return=representation', timeoutMs: 8000 });
      sendJson(res, 200, { deleted: true, id });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      sendJson(res, status, { code: text(error?.code || 'FILE_DELETE_FAILED', 80), message: status >= 500 ? 'File delete failed' : text(error?.message || 'File delete was rejected', 240) });
    }
  };

  return Object.freeze({ handleDelete, handleRead, handleUpload });
};

module.exports = { ALLOWED_MIMES, MAX_BODY_BYTES, MAX_FILE_BYTES, createCustomerFileUploadHandler, normalizeFilename, requestFileId, resolveMime };
