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
const text = (value, max = 240) => String(value ?? '').trim().slice(0, max);
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

const createCustomerFileUploadHandler = ({ authorize, sendJson, callPostgrestWithUser, fetchSemanticContext } = {}) => {
  if (typeof authorize !== 'function' || typeof sendJson !== 'function' || typeof callPostgrestWithUser !== 'function' || typeof fetchSemanticContext !== 'function') {
    throw new TypeError('Customer file upload dependencies are required');
  }

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
      const context = await fetchSemanticContext(user);
      if (!context?.accessPolicy?.roleScoped || context.fieldAclAvailable !== true) throw fail('HARNESS_PERMISSION_DENIED', 'Role-scoped customer permissions are unavailable', 403);
      const permissions = new Set((Array.isArray(context.permissions) ? context.permissions : []).map((entry) => text(entry?.code || entry, 120)));
      const superUser = context.accessPolicy.superUser === true;
      if (!superUser && !permissions.has('app:sales_customer')) throw fail('HARNESS_PERMISSION_DENIED', 'Customer archive permission is not granted', 403);
      if (!superUser && !['op:sales_customer.create', 'op:sales_customer.edit'].some((permission) => permissions.has(permission))) throw fail('HARNESS_PERMISSION_DENIED', 'Customer archive edit permission is not granted', 403);
      const acl = context.fieldAcl?.sales_customer?.customer_files;
      if (acl?.canEdit === false) throw fail('HARNESS_PERMISSION_DENIED', 'Customer file field is not editable', 403);

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

  return Object.freeze({ handleUpload });
};

module.exports = { ALLOWED_MIMES, MAX_BODY_BYTES, MAX_FILE_BYTES, createCustomerFileUploadHandler, normalizeFilename, resolveMime };
