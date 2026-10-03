// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const { FlashToolError } = require('./flash-postgrest-adapter');

const createFlashToolService = ({
  idempotencyTtlMs = 10 * 60 * 1000,
  maxIdempotencyEntries = 10000,
  authorizeTool,
  getToolDefinition,
  resolveToolId,
  registryVersion,
  registryCount,
  executeSemanticTool,
  logAgentEvent,
  normalizeText,
  sanitizePathToken,
  now = Date.now,
  random = Math.random
}) => {
  const idempotencyCache = new Map();
  const idempotencyTtl = Number.isFinite(Number(idempotencyTtlMs)) && Number(idempotencyTtlMs) > 0
    ? Number(idempotencyTtlMs)
    : 10 * 60 * 1000;
  const idempotencyCapacity = Number.isInteger(Number(maxIdempotencyEntries)) && Number(maxIdempotencyEntries) > 0
    ? Number(maxIdempotencyEntries)
    : 10000;

  const toPlainObject = (value) => {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };

  const cloneJsonValue = (value) => {
    if (value === undefined) return null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };

  const generateTraceId = (prefix = 'tr') => {
    const rand = random().toString(36).slice(2, 10);
    return `${prefix}_${now()}_${rand}`;
  };

  const sanitizeIdempotencyKey = (value) => {
    const text = String(value || '').trim();
    return /^[a-zA-Z0-9._:-]{16,128}$/.test(text) ? text : '';
  };

  const sanitizeTraceId = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 128);
  };

  const normalizeToolCallBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const text = String(value || '').trim().toLowerCase();
    if (!text) return false;
    return text === '1' || text === 'true' || text === 'yes' || text === 'y';
  };

  const normalizeFlashToolCallEnvelope = (rawInput = {}) => {
    const payload = toPlainObject(rawInput);
    const args = toPlainObject(payload.arguments);
    const context = toPlainObject(payload.context);
    const traceId = sanitizeTraceId(payload.trace_id || payload.traceId || payload.trace) || generateTraceId('tr');
    const toolId = resolveToolId(payload.tool_id || payload.toolId);
    const idempotencyKey = sanitizeIdempotencyKey(payload.idempotency_key || payload.idempotencyKey);
    const sessionId = sanitizePathToken(payload.session_id || payload.sessionId || context.sessionId, 'default');
    const appId = String(payload.app_id || payload.appId || args.appId || '').trim();
    const confirmed = normalizeToolCallBoolean(
      payload.confirmed ?? payload.confirm ?? context.confirmed ?? context.confirm
    );
    return {
      traceId,
      toolId,
      idempotencyKey,
      sessionId,
      appId,
      arguments: args,
      context,
      confirmed
    };
  };

  const cleanupIdempotencyCache = (currentTime = now()) => {
    for (const [key, record] of idempotencyCache.entries()) {
      if (!record || (!record.pending && (!record.expireAt || record.expireAt <= currentTime))) {
        idempotencyCache.delete(key);
      }
    }
  };

  const makeIdempotencyCacheKey = (user, toolId, idempotencyKey) => {
    const userId = String(user?.id || 'anonymous');
    const tenantId = String(user?.tenant_id || user?.tenantId || user?.tenant || user?.org_id || user?.organization_id || '');
    return `${tenantId}:${userId}:${toolId}:${idempotencyKey}`;
  };

  const executeFlashToolCall = async (user, rawPayload = {}, source = 'http') => {
    const startedAt = now();
    const call = normalizeFlashToolCallEnvelope(rawPayload);
    if (!call.toolId) {
      const errorResponse = {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'tool_id is required',
        tool_id: '',
        trace_id: call.traceId,
        error: { reason_code: 'VALIDATION_FAILED', http_status: 400 }
      };
      return { status: 400, payload: errorResponse };
    }

    const tool = getToolDefinition(call.toolId);
    if (!tool) {
      const errorResponse = {
        ok: false,
        code: 'TOOL_NOT_FOUND',
        message: `tool_id not found: ${call.toolId}`,
        tool_id: call.toolId,
        trace_id: call.traceId,
        error: { reason_code: 'TOOL_NOT_FOUND', http_status: 404 }
      };
      return { status: 404, payload: errorResponse };
    }

    const authorization = typeof authorizeTool === 'function'
      ? await authorizeTool(user, call.toolId, call.arguments, call)
      : { allowed: true, context: null };
    if (authorization?.allowed !== true) {
      return {
        status: 403,
        payload: {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: 'Current user is not authorized for this EISCore capability',
          tool_id: call.toolId,
          trace_id: call.traceId,
          error: { reason_code: 'PERMISSION_DENIED', http_status: 403 }
        }
      };
    }

    const isWriteTool = tool.confirm_required || tool.risk_level !== 'low';
    if (isWriteTool && !call.confirmed) {
      const errorResponse = {
        ok: false,
        code: 'PERMISSION_DENIED',
        message: 'write tool requires confirmed=true',
        tool_id: call.toolId,
        trace_id: call.traceId,
        error: { reason_code: 'PERMISSION_DENIED', http_status: 403 }
      };
      return { status: 403, payload: errorResponse };
    }

    if (isWriteTool && !call.idempotencyKey) {
      const errorResponse = {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'idempotency_key is required for write tools',
        tool_id: call.toolId,
        trace_id: call.traceId,
        error: { reason_code: 'VALIDATION_FAILED', http_status: 400 }
      };
      return { status: 400, payload: errorResponse };
    }

    cleanupIdempotencyCache();
    let cacheKey = '';
    let pendingRecord = null;
    if (isWriteTool && call.idempotencyKey) {
      cacheKey = makeIdempotencyCacheKey(user, call.toolId, call.idempotencyKey);
      const cached = idempotencyCache.get(cacheKey);
      if (cached && cached.expireAt > now()) {
        const replay = cloneJsonValue(cached.payload);
        replay.meta = {
          ...(toPlainObject(replay.meta)),
          idempotent_replay: true
        };
        return { status: 200, payload: replay };
      }
      if (cached?.pending) {
        const outcome = await cached.promise;
        if (outcome.failed) {
          return {
            status: 502,
            payload: {
              ok: false,
              code: 'INTERNAL_ERROR',
              message: 'Tool execution failed',
              tool_id: call.toolId,
              trace_id: call.traceId,
              error: { reason_code: 'INTERNAL_ERROR', http_status: 502 }
            }
          };
        }
        const replay = cloneJsonValue(outcome.value.payload);
        replay.meta = { ...toPlainObject(replay.meta), idempotent_replay: true };
        return { status: outcome.value.status, payload: replay };
      }
      if (idempotencyCache.size >= idempotencyCapacity) {
        return {
          status: 429,
          payload: {
            ok: false,
            code: 'CAPACITY_EXCEEDED',
            message: 'Idempotency capacity is full; retry after existing entries expire',
            tool_id: call.toolId,
            trace_id: call.traceId,
            error: { reason_code: 'CAPACITY_EXCEEDED', http_status: 429 }
          }
        };
      }
      pendingRecord = { pending: true, promise: null, expireAt: 0 };
      idempotencyCache.set(cacheKey, pendingRecord);
    }

    try {
      const executionContext = authorization.context
        ? { ...call, authorizationContext: authorization.context }
        : call;
      const executionPromise = Promise.resolve().then(async () => {
        const result = await executeSemanticTool(call.toolId, call.arguments, user, executionContext);
        return {
          status: 200,
          payload: {
            ok: true,
            code: 'OK',
            message: normalizeText(result?.message) || 'OK',
            tool_id: call.toolId,
            trace_id: call.traceId,
            registry_version: registryVersion,
            registry_tools_count_actual: registryCount,
            data: cloneJsonValue(result?.data),
            meta: {
              risk_level: tool.risk_level,
              duration_ms: now() - startedAt,
              rows_affected: Number(result?.rowsAffected || 0),
              source
            }
          }
        };
      });
      if (pendingRecord) pendingRecord.promise = executionPromise.then(
        (value) => ({ value }),
        () => ({ failed: true })
      );
      const executed = await executionPromise;
      const responsePayload = executed.payload;
      if (cacheKey) {
        idempotencyCache.set(cacheKey, {
          pending: false,
          expireAt: now() + idempotencyTtl,
          payload: cloneJsonValue(responsePayload)
        });
      }
      logAgentEvent('flash:tool_call_ok', user, {
        tool_id: call.toolId,
        trace_id: call.traceId,
        source,
        duration_ms: responsePayload.meta.duration_ms
      });
      return executed;
    } catch (error) {
      if (cacheKey && idempotencyCache.get(cacheKey) === pendingRecord) idempotencyCache.delete(cacheKey);
      const isTypedError = error instanceof FlashToolError;
      const code = isTypedError ? error.code : 'INTERNAL_ERROR';
      const httpStatus = isTypedError ? error.httpStatus : 500;
      const responsePayload = {
        ok: false,
        code,
        message: normalizeText(error?.message) || 'Tool execution failed',
        tool_id: call.toolId,
        trace_id: call.traceId,
        registry_version: registryVersion,
        registry_tools_count_actual: registryCount,
        error: {
          reason_code: isTypedError ? error.reasonCode : code,
          http_status: httpStatus,
          data: cloneJsonValue(isTypedError ? error.data : null)
        }
      };
      logAgentEvent('flash:tool_call_fail', user, {
        tool_id: call.toolId,
        trace_id: call.traceId,
        source,
        code,
        message: responsePayload.message
      });
      return { status: httpStatus, payload: responsePayload };
    }
  };

  return Object.freeze({
    executeFlashToolCall,
    normalizeToolCallBoolean
  });
};

module.exports = {
  createFlashToolService
};
