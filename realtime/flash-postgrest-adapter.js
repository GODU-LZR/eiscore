// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

class FlashToolError extends Error {
  constructor(code, message, options = {}) {
    super(message || code || 'Flash tool error');
    this.name = 'FlashToolError';
    this.code = String(code || 'INTERNAL_ERROR');
    this.httpStatus = Number(options.httpStatus || 500);
    this.reasonCode = String(options.reasonCode || this.code);
    this.data = options.data === undefined ? null : options.data;
  }
}

const createFlashPostgrestAdapter = ({
  baseUrl,
  userRole,
  jwtSecret,
  toolCallTimeoutMs,
  signJwt,
  fetchImpl,
  sanitizeQueryParams,
  parseJson,
  normalizeText,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  scheduleTimeout = setTimeout,
  cancelTimeout = clearTimeout
}) => {
  const isValidDbObjectName = (value) => {
    const text = String(value || '').trim();
    if (!text) return false;
    return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(text);
  };

  const resolveDataTableTarget = (tableInput) => {
    const raw = String(tableInput || '').trim();
    if (!raw) {
      throw new FlashToolError('VALIDATION_FAILED', 'table is required', { httpStatus: 400 });
    }
    if (!isValidDbObjectName(raw)) {
      throw new FlashToolError('VALIDATION_FAILED', 'table is invalid', { httpStatus: 400 });
    }
    const [schema, table] = raw.includes('.') ? raw.split('.', 2) : ['app_data', raw];
    if (!schema || !table || !isValidDbObjectName(`${schema}.${table}`)) {
      throw new FlashToolError('VALIDATION_FAILED', 'table is invalid', { httpStatus: 400 });
    }
    return { schema, table };
  };

  const isPostgrestSchemaCacheMiss = (error) => {
    const text = `${error?.message || ''} ${JSON.stringify(error?.data || {})}`.toLowerCase();
    return (
      text.includes('schema cache') ||
      text.includes('could not find the table') ||
      text.includes('could not find the column') ||
      text.includes('pgrst200') ||
      text.includes('pgrst204') ||
      text.includes('pgrst205')
    );
  };

  const inferFlashDataColumnsFromPayload = (payload = {}) => {
    const out = [];
    const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    for (const [key, value] of Object.entries(record)) {
      if (!key || ['id', 'created_at', 'updated_at', 'properties'].includes(key)) continue;
      let type = 'text';
      if (typeof value === 'number') type = Number.isInteger(value) ? 'integer' : 'numeric';
      if (typeof value === 'boolean') type = 'boolean';
      if (value instanceof Date) type = 'timestamptz';
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}t/i.test(value)) type = 'timestamptz';
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) type = 'date';
      out.push({ field: key, label: key, type });
    }
    return out;
  };

  const mapPostgrestErrorCode = (status, payload) => {
    if (status === 400) return 'VALIDATION_FAILED';
    if (status === 401 || status === 403) {
      const code = String(payload?.code || '').trim();
      const message = String(payload?.message || '').toLowerCase();
      if (code === '42501' || message.includes('permission denied')) return 'RLS_DENIED';
      return 'PERMISSION_DENIED';
    }
    if (status === 404) return 'BAD_REQUEST';
    if (status === 409) return 'CONFLICT';
    if (status === 408 || status === 504) return 'TIMEOUT';
    if (status >= 500) return 'UPSTREAM_ERROR';
    return 'UPSTREAM_ERROR';
  };

  const buildPostgrestPath = (pathname = '/', query = {}) => {
    const basePath = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${pathname}`;
    const params = new URLSearchParams();
    const cleaned = sanitizeQueryParams(query);
    for (const [key, value] of Object.entries(cleaned)) {
      params.set(key, value);
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const buildPostgrestUserToken = (user) => {
    if (!jwtSecret || !userRole) return user?.token || '';
    const payload = {
      sub: String(user?.id || user?.username || ''),
      username: String(user?.username || ''),
      role: userRole,
      app_role: String(user?.role || ''),
      permissions: Array.isArray(user?.permissions) ? user.permissions : []
    };
    try {
      return signJwt(payload, jwtSecret, { expiresIn: '15m' });
    } catch {
      return user?.token || '';
    }
  };

  const callPostgrestWithUser = async (user, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    const requestPath = buildPostgrestPath(options.path, options.query);
    const url = `${baseUrl}${requestPath}`;
    const headers = {
      Authorization: `Bearer ${buildPostgrestUserToken(user)}`,
      Accept: 'application/json'
    };
    if (options.acceptProfile) headers['Accept-Profile'] = options.acceptProfile;
    if (options.traceId) headers['X-Trace-Id'] = options.traceId;
    if (options.prefer) headers.Prefer = options.prefer;

    // PostgREST resolves the target schema from Content-Profile for every write method,
    // including writes without a body such as DELETE.
    if (options.contentProfile) headers['Content-Profile'] = options.contentProfile;

    let body;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeout = Number(options.timeoutMs || toolCallTimeoutMs);
    const timeoutHandle = scheduleTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new FlashToolError('TIMEOUT', `Tool upstream timeout after ${timeout}ms`, { httpStatus: 504 });
      }
      throw new FlashToolError('UPSTREAM_ERROR', error?.message || 'Tool upstream request failed', { httpStatus: 502 });
    } finally {
      cancelTimeout(timeoutHandle);
    }

    const rawText = await response.text();
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    let payload = null;
    if (rawText) {
      if (contentType.includes('json')) payload = parseJson(rawText);
      if (payload === null) payload = { raw: rawText };
    }

    if (!response.ok) {
      const reasonCode = mapPostgrestErrorCode(response.status, payload || {});
      const message = normalizeText(payload?.message || payload?.details || payload?.hint) ||
        `PostgREST request failed (${response.status})`;
      throw new FlashToolError(reasonCode, message, {
        httpStatus: response.status,
        data: payload
      });
    }

    return {
      status: response.status,
      data: payload,
      path: requestPath
    };
  };

  const reloadPostgrestSchemaCache = async (user, traceId = '') => {
    try {
      await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/rpc/reload_schema_cache',
        acceptProfile: 'public',
        contentProfile: 'public',
        traceId,
        timeoutMs: 5000
      });
    } catch {
      // Not every database has the helper RPC; create_data_app_table already NOTIFYs pgrst.
    }
  };

  const ensureFlashDataTable = async (user, target, appId, columns = [], traceId = '') => {
    if (!target || target.schema !== 'app_data') return false;
    const normalizedAppId = String(appId || '').trim();
    if (!normalizedAppId) return false;
    await callPostgrestWithUser(user, {
      method: 'POST',
      path: '/rpc/create_data_app_table',
      body: {
        app_id: normalizedAppId,
        table_name: target.table,
        columns: Array.isArray(columns) ? columns : []
      },
      acceptProfile: 'app_center',
      contentProfile: 'app_center',
      traceId,
      timeoutMs: 20000
    });
    await reloadPostgrestSchemaCache(user, traceId);
    await wait(450);
    return true;
  };

  const callPostgrestWithFlashTableEnsure = async (user, target, appId, options = {}, ensureColumns = []) => {
    try {
      return await callPostgrestWithUser(user, options);
    } catch (error) {
      const ensured = await ensureFlashDataTable(user, target, appId, ensureColumns, options.traceId);
      if (!ensured || !isPostgrestSchemaCacheMiss(error)) throw error;
      let lastError = error;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          return await callPostgrestWithUser(user, options);
        } catch (retryError) {
          lastError = retryError;
          if (!isPostgrestSchemaCacheMiss(retryError)) throw retryError;
          await wait(350 + attempt * 250);
        }
      }
      throw lastError;
    }
  };

  const bindPgQueryForUser = (user) => {
    return (options) => callPostgrestWithUser(user, options);
  };

  return Object.freeze({
    bindPgQueryForUser,
    callPostgrestWithFlashTableEnsure,
    callPostgrestWithUser,
    inferFlashDataColumnsFromPayload,
    resolveDataTableTarget
  });
};

module.exports = {
  FlashToolError,
  createFlashPostgrestAdapter
};
