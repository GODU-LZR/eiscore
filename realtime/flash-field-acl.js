// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const { FlashToolError } = require('./flash-postgrest-adapter');

const normalizeTableId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.includes('.') ? raw : `app_data.${raw}`;
};

const resolveAclModule = (context, tableId, fallback = '') => {
  const app = (Array.isArray(context?.apps) ? context.apps : []).find((item) =>
    String(item?.qualified_table || '').toLowerCase() === tableId
  );
  if (app?.acl_module) return String(app.acl_module);
  if (fallback) return fallback;
  if (tableId === 'hr.archives') return 'hr_employee';
  if (tableId === 'public.raw_materials' || tableId.startsWith('scm.')) return 'mms_ledger';
  return '';
};

const deniedFields = (context, module, access) => Object.entries(context?.fieldAcl?.[module] || {})
  .filter(([, acl]) => acl?.[access] === false)
  .map(([field]) => field);

const requireFieldAcl = (context, module, action) => {
  if (module && context?.fieldAclAvailable !== true) {
    deny(`Field permissions are unavailable for this ${action}`);
  }
};

const includesField = (source, field) => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`).test(String(source || ''));
};

const deny = (message) => {
  throw new FlashToolError('PERMISSION_DENIED', message, { httpStatus: 403 });
};

const prepareFieldAclRead = (query = {}, context, tableInput, moduleFallback = '') => {
  const tableId = normalizeTableId(tableInput);
  const module = resolveAclModule(context, tableId, moduleFallback);
  if (!module) return { query: { ...query }, module: '' };
  requireFieldAcl(context, module, 'query');
  const hidden = deniedFields(context, module, 'canView');
  if (!hidden.length) return { query: { ...query }, module };

  const safeQuery = { ...query };
  const requested = String(safeQuery.select || '').trim();
  if (!requested || requested === '*') {
    const semanticColumns = context?.columns?.[tableId];
    const allowed = (Array.isArray(semanticColumns) ? semanticColumns : [])
      .map((column) => String(column?.col || '').trim())
      .filter((field) => field && !hidden.includes(field));
    if (!allowed.length) deny('Cannot safely select fields because field semantics are unavailable');
    safeQuery.select = [...new Set(allowed)].join(',');
  } else if (hidden.some((field) => includesField(requested, field))) {
    deny('Requested fields are not visible to the current user');
  }

  for (const [key, value] of Object.entries(safeQuery)) {
    if (hidden.some((field) => key === field || includesField(value, field))) {
      deny('Query references a field that is not visible to the current user');
    }
  }
  return { query: safeQuery, module };
};

const assertFieldAclWrite = (payload, context, tableInput, moduleFallback = '') => {
  const tableId = normalizeTableId(tableInput);
  const module = resolveAclModule(context, tableId, moduleFallback);
  if (!module) return module;
  requireFieldAcl(context, module, 'write');
  const hidden = deniedFields(context, module, 'canEdit');
  if (!hidden.length) return module;
  if (Object.keys(payload || {}).some((field) => hidden.includes(field))) {
    deny('Write payload contains fields that are not editable by the current user');
  }
  return module;
};

const stripFieldAcl = (value, context, module) => {
  requireFieldAcl(context, module, 'result filtering');
  const hidden = deniedFields(context, module, 'canView');
  if (!hidden.length) return value;
  const stripRow = (row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    const result = { ...row };
    for (const field of hidden) delete result[field];
    return result;
  };
  return Array.isArray(value) ? value.map(stripRow) : stripRow(value);
};

const filterVisibleFields = (fields, context, module, access = 'canView') => {
  requireFieldAcl(context, module, 'field filtering');
  const hidden = new Set(deniedFields(context, module, access));
  return [...new Set((Array.isArray(fields) ? fields : []).map((field) => String(field || '').trim()).filter((field) => field && !hidden.has(field)))];
};

module.exports = { assertFieldAclWrite, filterVisibleFields, prepareFieldAclRead, resolveAclModule, stripFieldAcl };
