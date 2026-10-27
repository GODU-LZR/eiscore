// SPDX-License-Identifier: AGPL-3.0-or-later

'use strict';

const crypto = require('node:crypto');
const { assertFieldAclWrite, filterVisibleFields, prepareFieldAclRead, stripFieldAcl } = require('./flash-field-acl');

const CUSTOMER_TABLE = 'public.sales_customers';
const CUSTOMER_MODULE = 'sales_customer';
const MAX_LIMIT = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TEXT_RE = /^[^\u0000-\u001f\u007f]{1,240}$/;

const READ_FIELDS = Object.freeze([
  'id', 'customer_no', 'name', 'level', 'contact_name', 'contact_phone', 'region',
  'owner_name', 'customer_status', 'credit_limit', 'receivable_balance',
  'last_follow_up_at', 'status', 'properties', 'created_at', 'updated_at'
]);
const WRITE_FIELDS = Object.freeze([
  'customer_no', 'name', 'level', 'contact_name', 'contact_phone', 'region',
  'owner_name', 'customer_status', 'credit_limit', 'last_follow_up_at', 'properties'
]);
const FILTER_FIELDS = Object.freeze(['id', 'customer_no', 'name', 'contact_name', 'region', 'owner_name', 'customer_status', 'status']);
const RESERVED_PROPERTY_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const PERMISSIONS = Object.freeze(['module:sales', 'app:sales_customer', 'app:sales_dashboard']);

const text = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const fail = (code, message, httpStatus = 400) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  throw error;
};
const isUuid = (value) => UUID_RE.test(text(value, 80));
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const permissionsFor = (context) => new Set((Array.isArray(context?.permissions) ? context.permissions : [])
  .map((item) => text(item?.code || item, 120).toLowerCase()).filter(Boolean));
const canViewCustomerFiles = (context) => context?.fieldAcl?.[CUSTOMER_MODULE]?.customer_files?.canView !== false;
const canEditCustomerFiles = (context) => context?.fieldAcl?.[CUSTOMER_MODULE]?.customer_files?.canEdit !== false;

const createHarnessCustomerRecordsExecutor = ({ callPostgrestWithUser, fetchSemanticContext, now = () => new Date() } = {}) => {
  if (typeof callPostgrestWithUser !== 'function') throw new TypeError('Customer records PostgREST adapter is required');
  if (typeof fetchSemanticContext !== 'function') throw new TypeError('Customer records semantic context loader is required');

  const requireAccess = async (user) => {
    const context = await fetchSemanticContext(user);
    if (!context?.accessPolicy?.roleScoped || context.fieldAclAvailable !== true) {
      fail('HARNESS_PERMISSION_DENIED', 'Role-scoped customer permissions are unavailable', 403);
    }
    const isSuperUser = context.accessPolicy.superUser === true;
    const permissions = permissionsFor(context);
    if (!isSuperUser && !PERMISSIONS.some((permission) => permissions.has(permission))) {
      fail('HARNESS_PERMISSION_DENIED', 'Customer archive permission is not granted', 403);
    }
    return { context, isSuperUser };
  };

  const normalizeFields = (select) => {
    const requested = Array.isArray(select) ? select.map((item) => text(item, 80)) : text(select, 2000).split(',').map((item) => item.trim()).filter(Boolean);
    const fields = requested.length ? requested : READ_FIELDS;
    if (fields.some((field) => !READ_FIELDS.includes(field))) fail('HARNESS_CUSTOMER_QUERY_INVALID', 'Requested customer field is outside the contract');
    return [...new Set(fields)];
  };

  const buildFilters = (filters) => {
    const result = {};
    for (const [field, raw] of Object.entries(object(filters))) {
      if (!FILTER_FIELDS.includes(field) || Array.isArray(raw) || typeof raw === 'object') fail('HARNESS_CUSTOMER_QUERY_INVALID', 'Customer filter is outside the contract');
      const value = text(raw, 200);
      if (!value || /[\r\n;&,(){}]/.test(value)) fail('HARNESS_CUSTOMER_QUERY_INVALID', 'Customer filter value is invalid');
      result[field] = `eq.${value}`;
    }
    return result;
  };

  const read = async (user, input) => {
    const { context } = await requireAccess(user, false);
    const fields = normalizeFields(input.select);
    const visible = filterVisibleFields(fields, context, CUSTOMER_MODULE);
    if (!visible.length) fail('HARNESS_PERMISSION_DENIED', 'No requested customer fields are visible', 403);
    const query = { select: visible.join(','), limit: String(Math.min(Math.max(Number(input.limit) || 20, 1), MAX_LIMIT)), order: 'created_at.desc', ...buildFilters(input.filters) };
    const customerId = text(input.customer_id || input.customerId || input.id, 80);
    if (customerId) {
      if (!isUuid(customerId)) fail('HARNESS_CUSTOMER_RESOURCE_ID_INVALID', 'customer_id must be a UUID');
      query.id = `eq.${customerId}`;
      query.limit = '1';
    }
    const order = text(input.order, 100);
    if (order) {
      const [field, direction = 'asc'] = order.split('.');
      if (!READ_FIELDS.includes(field) || !['asc', 'desc'].includes(direction)) fail('HARNESS_CUSTOMER_QUERY_INVALID', 'Customer order is outside the contract');
      query.order = `${field}.${direction}`;
    }
    const fieldPolicy = prepareFieldAclRead(query, context, CUSTOMER_TABLE, CUSTOMER_MODULE);
    const response = await callPostgrestWithUser(user, { method: 'GET', path: '/sales_customers', query: fieldPolicy.query, acceptProfile: 'public', timeoutMs: 8000 });
    const rows = Array.isArray(response?.data) ? response.data : [];
    const visibleRows = stripFieldAcl(rows, context, CUSTOMER_MODULE);
    if (!canViewCustomerFiles(context)) {
      for (const row of visibleRows) {
        if (row?.properties && typeof row.properties === 'object' && !Array.isArray(row.properties)) {
          const properties = { ...row.properties };
          delete properties.customer_files;
          row.properties = properties;
        }
      }
    }
    return { operation: 'query', dataset: 'sales_customers', rows: visibleRows, limit: Number(query.limit), fileContentAvailable: false };
  };

  const normalizeProperties = (value) => {
    const properties = object(value);
    const output = {};
    for (const [key, item] of Object.entries(properties)) {
      const safeKey = text(key, 80);
      if (!safeKey || RESERVED_PROPERTY_KEYS.has(safeKey) || !/^[^\u0000-\u001f\u007f]{1,80}$/.test(safeKey)) fail('HARNESS_CUSTOMER_WRITE_INVALID', 'Customer property name is invalid');
      if (typeof item === 'string') output[safeKey] = item.slice(0, 20000);
      else if (typeof item === 'number' || typeof item === 'boolean' || item === null) output[safeKey] = item;
      else if (Array.isArray(item)) output[safeKey] = item.slice(0, 20);
      else if (item && typeof item === 'object') output[safeKey] = item;
    }
    return output;
  };

  const assertCustomerFileFieldWrite = (values, context) => {
    if (Object.hasOwn(values?.properties || {}, 'customer_files') && !canEditCustomerFiles(context)) {
      fail('HARNESS_PERMISSION_DENIED', 'Customer file field is not editable', 403);
    }
  };

  const normalizeValues = (input, { creating = false } = {}) => {
    const raw = object(input.values);
    const values = {};
    for (const [field, value] of Object.entries(raw)) {
      if (!WRITE_FIELDS.includes(field)) fail('HARNESS_CUSTOMER_WRITE_INVALID', `Customer field ${field} is not writable`);
      if (field === 'properties') values.properties = normalizeProperties(value);
      else if (field === 'credit_limit') {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || number > 1e12) fail('HARNESS_CUSTOMER_WRITE_INVALID', 'Credit limit is invalid');
        values[field] = number;
      } else if (field === 'last_follow_up_at') {
        const date = text(value, 20);
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('HARNESS_CUSTOMER_WRITE_INVALID', 'Follow-up date is invalid');
        values[field] = date || null;
      } else {
        const safe = text(value, field === 'name' ? 240 : 160);
        if (field === 'name' && !safe) fail('HARNESS_CUSTOMER_WRITE_INVALID', 'Customer name is required');
        if (safe && !SAFE_TEXT_RE.test(safe)) fail('HARNESS_CUSTOMER_WRITE_INVALID', 'Customer text field is invalid');
        values[field] = safe || null;
      }
    }
    if (creating && !values.name) fail('HARNESS_CUSTOMER_WRITE_INVALID', 'Customer name is required');
    return values;
  };

  const write = async (user, input, request) => {
    const operation = text(input.operation || input.action, 40);
    const creating = operation === 'create';
    const deleting = operation === 'delete';
    const updating = operation === 'update' || operation === 'attach_file';
    if (!['create', 'update', 'delete', 'attach_file'].includes(operation)) fail('HARNESS_CUSTOMER_OPERATION_INVALID', 'Customer operation is not allowed');
    const { context } = await requireAccess(user);
    const permissionByOperation = {
      create: 'op:sales_customer.create',
      update: 'op:sales_customer.edit',
      delete: 'op:sales_customer.delete',
      attach_file: 'op:sales_customer.edit'
    };
    if (context.accessPolicy.superUser !== true && !permissionsFor(context).has(permissionByOperation[operation])) fail('HARNESS_PERMISSION_DENIED', 'Customer archive operation permission is not granted', 403);
    const id = text(input.customer_id || input.customerId || input.id, 80);
    if (!creating && !isUuid(id)) fail('HARNESS_CUSTOMER_RESOURCE_ID_INVALID', 'customer_id must be a UUID');
    if (operation === 'attach_file') {
      if (!canEditCustomerFiles(context)) {
        fail('HARNESS_PERMISSION_DENIED', 'Customer file field is not editable', 403);
      }
      const fileId = text(input.file_id || input.fileId || input.file_ref, 80);
      if (!isUuid(fileId)) fail('HARNESS_CUSTOMER_FILE_INVALID', 'file_ref must be a UUID');
      const file = await callPostgrestWithUser(user, { method: 'GET', path: '/files', query: { select: 'id,filename,mime_type,size_bytes,sha256,created_at,extra', id: `eq.${fileId}`, limit: '1' }, acceptProfile: 'public', timeoutMs: 8000 });
      const fileRow = Array.isArray(file?.data) ? file.data[0] : null;
      if (!fileRow) fail('HARNESS_CUSTOMER_FILE_NOT_FOUND', 'Uploaded file was not found', 404);
      const owner = object(fileRow.extra);
      if (owner.source !== 'harness_customer_archive' || owner.uploaded_by !== text(user?.id || user?.username, 160) || owner.tenant_id !== text(user?.tenant_id || user?.tenantId, 160)) {
        fail('HARNESS_CUSTOMER_FILE_FORBIDDEN', 'File does not belong to the current user and tenant', 403);
      }
      if (Number(fileRow.size_bytes) > 20 * 1024 * 1024) fail('HARNESS_CUSTOMER_FILE_INVALID', 'Uploaded file exceeds the 20 MiB limit');
      const current = await callPostgrestWithUser(user, { method: 'GET', path: '/sales_customers', query: { select: 'id,properties,updated_at', id: `eq.${id}`, status: 'neq.deleted', limit: '1' }, acceptProfile: 'public', timeoutMs: 8000 });
      const row = Array.isArray(current?.data) ? current.data[0] : null;
      if (!row) fail('HARNESS_CUSTOMER_NOT_FOUND', 'Customer was not found', 404);
      const properties = normalizeProperties(row.properties);
      const list = Array.isArray(properties.customer_files) ? properties.customer_files.slice(0, 20) : [];
      if (!list.some((item) => item?.id === fileId)) list.push({ id: fileId, name: fileRow.filename, type: fileRow.mime_type, size: Number(fileRow.size_bytes), url: `file:${fileId}`, category: text(input.category || '未分类', 80), classificationReason: text(input.classification_reason || input.classificationReason || '', 500), source: 'harness', contentAvailable: false, attachedAt: now().toISOString() });
      properties.customer_files = list;
      return updateCustomer(user, id, { properties }, row.updated_at, request, context);
    }
    if (deleting) return updateCustomer(user, id, { status: 'deleted' }, input.expected_updated_at || input.expectedUpdatedAt, request, context);
    const values = normalizeValues(input, { creating });
    if (creating && !values.customer_no) {
      const idempotencyKey = text(request.idempotency_key || request.idempotencyKey, 128);
      if (idempotencyKey.length < 16) fail('HARNESS_IDEMPOTENCY_REQUIRED', 'Customer creation requires an idempotency key', 409);
      values.customer_no = `AI-${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 24).toUpperCase()}`;
    }
    if (creating) {
      assertCustomerFileFieldWrite(values, context);
      assertFieldAclWrite(values, context, CUSTOMER_TABLE, CUSTOMER_MODULE);
      const response = await callPostgrestWithUser(user, { method: 'POST', path: '/sales_customers', body: values, acceptProfile: 'public', contentProfile: 'public', prefer: 'return=representation', timeoutMs: 10000 });
      return { operation, row: Array.isArray(response?.data) ? response.data[0] : response?.data, fileContentAvailable: false };
    }
    return updateCustomer(user, id, values, input.expected_updated_at || input.expectedUpdatedAt, request, context);
  };

  const updateCustomer = async (user, id, values, expectedUpdatedAt, request, context) => {
    assertCustomerFileFieldWrite(values, context);
    assertFieldAclWrite(values, context, CUSTOMER_TABLE, CUSTOMER_MODULE);
    if (!expectedUpdatedAt) fail('HARNESS_CUSTOMER_CONFLICT', 'expected_updated_at is required for customer changes', 409);
    const query = { id: `eq.${id}`, status: 'neq.deleted' };
    const stamp = text(expectedUpdatedAt, 80);
    if (!stamp || /[\r\n;&,(){}]/.test(stamp)) fail('HARNESS_CUSTOMER_CONFLICT', 'expected_updated_at is invalid', 409);
    query.updated_at = `eq.${stamp}`;
    const response = await callPostgrestWithUser(user, { method: 'PATCH', path: '/sales_customers', query, body: values, acceptProfile: 'public', contentProfile: 'public', prefer: 'return=representation', timeoutMs: 10000 });
    const rows = Array.isArray(response?.data) ? response.data : [];
    if (!rows.length) fail('HARNESS_CUSTOMER_CONFLICT', 'Customer changed or was deleted; reload before retrying', 409);
    return { operation: 'update', row: rows[0], fileContentAvailable: false };
  };

  return Object.freeze({ execute: async (user, input = {}, request = {}) => {
    const operation = text(input.operation || input.action, 40);
    if (operation === 'query' || operation === 'list' || operation === 'read') return read(user, input);
    return write(user, input, request);
  }, fields: READ_FIELDS, writeFields: WRITE_FIELDS });
};

module.exports = { CUSTOMER_MODULE, READ_FIELDS, WRITE_FIELDS, createHarnessCustomerRecordsExecutor };
