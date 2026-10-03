'use strict';

const crypto = require('node:crypto');
const { loadPluginRegistry } = require('../agent-harness/plugin-registry');

const stableError = (code, status, message) => Object.freeze({ ok: false, code, status, message });
const text = (value) => String(value ?? '').trim();
const GATEWAY_ERROR_CODES = new Set([
  'HARNESS_CAPABILITY_REQUIRED', 'HARNESS_PLUGIN_UNAVAILABLE', 'HARNESS_AUTH_REQUIRED',
  'HARNESS_PLUGIN_MISMATCH', 'HARNESS_AGENT_MISMATCH', 'HARNESS_CAPABILITY_MISMATCH',
  'HARNESS_INPUT_SCHEMA_INVALID', 'HARNESS_PERMISSION_DENIED', 'HARNESS_WRITE_SHADOW_FORBIDDEN',
  'HARNESS_CONFIRMATION_REQUIRED', 'HARNESS_IDEMPOTENCY_REQUIRED', 'HARNESS_AUDIT_UNAVAILABLE',
  'HARNESS_REQUEST_INVALID', 'HARNESS_REQUEST_REPLAY', 'HARNESS_CAPACITY_EXCEEDED',
  'HARNESS_OUTPUT_SCHEMA_INVALID', 'HARNESS_REQUEST_CANCELLED', 'HARNESS_UPSTREAM_TIMEOUT',
  'HARNESS_UPSTREAM_UNAVAILABLE', 'HARNESS_TOOL_UNAVAILABLE', 'HARNESS_TOOL_NOT_ALLOWED',
  'HARNESS_TOOL_ID_REQUIRED', 'HARNESS_TOOL_EXECUTION_FAILED', 'HARNESS_CONTEXT_INVALID',
  'HARNESS_QUERY_INVALID', 'HARNESS_PLAN_ID_REQUIRED', 'HARNESS_PLAN_ID_INVALID',
  'HARNESS_PLAN_VERSION_REQUIRED', 'HARNESS_PLAN_NOT_FOUND', 'HARNESS_PLAN_VERSION_MISMATCH',
  'HARNESS_PLAN_NOT_PLANNED', 'HARNESS_PLAN_TARGET_UNSUPPORTED', 'HARNESS_PLAN_COMMIT_CONFLICT',
  'HARNESS_SALES_WRITE_FAILED', 'HARNESS_SALES_OPERATION_INVALID', 'HARNESS_SALES_RESOURCE_ID_INVALID',
  'HARNESS_SALES_OBJECT_TYPE_INVALID', 'HARNESS_TWIN_PERSISTENCE_UNAVAILABLE',
  'HARNESS_TWIN_PERSISTENCE_FAILED', 'HARNESS_MULTIMODAL_INVALID', 'HARNESS_SESSION_ID_INVALID',
  'HARNESS_SESSION_ACCESS_DENIED', 'HARNESS_REQUEST_CAPACITY_EXCEEDED', 'MESSAGE_REQUIRED',
  'SESSION_ID_INVALID', 'SESSION_ACCESS_DENIED', 'TEXT_REQUIRED'
]);
const stableDispatchMessage = (code, status) => {
  if (code === 'HARNESS_UPSTREAM_UNAVAILABLE') return 'DeepSeek Harness is unavailable';
  if (code === 'HARNESS_UPSTREAM_TIMEOUT') return 'DeepSeek Harness request timed out';
  if (code === 'HARNESS_REQUEST_CANCELLED') return 'Harness request was cancelled';
  if (code === 'HARNESS_PERMISSION_DENIED') return 'Harness capability is not permitted';
  if (code === 'HARNESS_CONFIRMATION_REQUIRED') return 'Explicit confirmation is required';
  if (code === 'HARNESS_IDEMPOTENCY_REQUIRED') return 'A 16-128 character idempotency key is required';
  if (code === 'HARNESS_REQUEST_REPLAY') return 'Harness request has already been processed';
  if (code === 'HARNESS_CAPACITY_EXCEEDED' || code === 'HARNESS_REQUEST_CAPACITY_EXCEEDED') return 'Harness request capacity is full';
  if (code === 'HARNESS_TOOL_EXECUTION_FAILED') return status >= 500 ? 'Harness tool execution failed' : 'Harness tool request rejected';
  return 'Harness request was rejected';
};
const normalizeDispatchFailure = (result) => {
  if (!result || typeof result !== 'object' || result.ok !== false) return result;
  const statusValue = Number(result.status);
  const status = Number.isInteger(statusValue) && statusValue >= 400 && statusValue <= 599 ? statusValue : 502;
  const requestedCode = text(result.code);
  const code = GATEWAY_ERROR_CODES.has(requestedCode) ? requestedCode : 'HARNESS_UPSTREAM_UNAVAILABLE';
  return { ...result, ok: false, status, code, message: stableDispatchMessage(code, status) };
};
const validRequestId = (value) => /^[a-zA-Z0-9._:-]{1,256}$/.test(String(value || ''));
const digest = (value, key) => crypto.createHmac('sha256', key).update(text(value)).digest('hex');
const timeoutError = (timeoutMs) => {
  const error = new Error(`Harness upstream timed out after ${timeoutMs}ms`);
  error.code = 'HARNESS_UPSTREAM_TIMEOUT';
  error.httpStatus = 504;
  return error;
};
const policyFor = (plugin, capabilityId) => plugin?.capability_policies?.[capabilityId] || plugin;
const isWrite = (plugin, capabilityId) => {
  const policy = policyFor(plugin, capabilityId);
  return policy?.confirm_required === true || policy?.idempotency_required === true || policy?.risk === 'high' || policy?.risk === 'critical';
};
const isObjectPayload = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const schemaError = (code, message, status = 400) => stableError(code, status, message);
const matchesSchemaType = (value, type) => ({
  object: isObjectPayload(value),
  array: Array.isArray(value),
  string: typeof value === 'string',
  number: typeof value === 'number' && Number.isFinite(value),
  integer: Number.isInteger(value),
  boolean: typeof value === 'boolean',
  null: value === null
}[type] ?? true);
const validateSchema = (schema, value, path = '$') => {
  if (!schema || typeof schema !== 'object') return null;
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => Object.is(candidate, value))) return `${path} is not an allowed value`;
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const matches = schema.oneOf.filter((candidate) => validateSchema(candidate, value, path) === null).length;
    if (matches !== 1) return `${path} does not match exactly one capability schema`;
    return null;
  }
  if (schema.type && !matchesSchemaType(value, schema.type)) return `${path} must be ${schema.type}`;
  if (schema.type === 'object') {
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) if (!(key in value)) return `${path}.${key} is required`;
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(properties, key)) return `${path}.${key} is not allowed`;
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const error = validateSchema(child, value[key], `${path}.${key}`);
        if (error) return error;
      }
    }
  }
  if (schema.type === 'array' && schema.items) {
    for (let index = 0; index < value.length; index += 1) {
      const error = validateSchema(schema.items, value[index], `${path}[${index}]`);
      if (error) return error;
    }
  }
  return null;
};

const createHarnessGateway = ({
  registry = loadPluginRegistry(),
  dispatch,
  audit = async () => { throw new Error('Harness audit sink is required'); },
  auditKey = process.env.EISCORE_HARNESS_AUDIT_HASH_KEY || '',
  clock = () => Date.now(),
  requestId = () => crypto.randomUUID(),
  requestTtlMs = 24 * 60 * 60 * 1000,
  maxTrackedRequests = 10000
} = {}) => {
  if (typeof dispatch !== 'function') throw new TypeError('Harness gateway dispatch is required');
  const normalizedAuditKey = text(auditKey);
  if (normalizedAuditKey && normalizedAuditKey.length < 16) throw new TypeError('Harness audit key must be at least 16 characters');
  const auditKeyAvailable = normalizedAuditKey.length >= 16;
  const replayTtlMs = Number.isFinite(Number(requestTtlMs)) && Number(requestTtlMs) > 0
    ? Number(requestTtlMs)
    : 24 * 60 * 60 * 1000;
  const replayCapacity = Number.isInteger(Number(maxTrackedRequests)) && Number(maxTrackedRequests) > 0
    ? Number(maxTrackedRequests)
    : 10000;
  const requests = new Map();
  const idempotencies = new Map();

  const claimRequestId = (scope, id, idempotencyKey = '') => {
    const now = clock();
    for (const [seenId, entry] of requests) {
      if (now - entry.seenAt <= replayTtlMs) continue;
      requests.delete(seenId);
      if (entry.idempotencyReplayKey) idempotencies.delete(entry.idempotencyReplayKey);
    }
    const replayKey = JSON.stringify(['request', scope, id]);
    const idempotencyReplayKey = idempotencyKey
      ? JSON.stringify(['idempotency', scope, idempotencyKey])
      : '';
    if (requests.has(replayKey)) return 'replay';
    if (idempotencyReplayKey && idempotencies.has(idempotencyReplayKey)) return 'replay';
    if (requests.size >= replayCapacity) return 'capacity';
    requests.set(replayKey, { seenAt: now, idempotencyReplayKey });
    if (idempotencyReplayKey) idempotencies.set(idempotencyReplayKey, replayKey);
    return 'claimed';
  };

  const authorize = (request = {}) => {
    const capabilityId = text(request.capability_id || request.capabilityId);
    if (!capabilityId) return stableError('HARNESS_CAPABILITY_REQUIRED', 400, 'Harness capability is required');
    const plugin = registry.getById(request.plugin_id) || registry.getByAgent(request.agent_id) || registry.resolveCapability(capabilityId);
    if (!plugin) return stableError('HARNESS_PLUGIN_UNAVAILABLE', 404, 'Harness plugin is unavailable');
    const user = request.user || {};
    const tenantId = text(user.tenant_id || user.tenantId || user.tenant || user.org_id || user.organization_id);
    const subject = text(user.id || user.sub || user.username);
    if (!subject || !tenantId || !text(user.token)) return stableError('HARNESS_AUTH_REQUIRED', 401, 'Authenticated tenant context is required');
    if (request.plugin_id && request.plugin_id !== plugin.plugin_id) return stableError('HARNESS_PLUGIN_MISMATCH', 403, 'Plugin identity mismatch');
    if (request.agent_id && request.agent_id !== plugin.agent_id) return stableError('HARNESS_AGENT_MISMATCH', 403, 'Agent identity mismatch');
    if (!plugin.capabilities.includes(capabilityId)) return stableError('HARNESS_CAPABILITY_MISMATCH', 403, 'Capability is not registered for plugin');
    const policy = policyFor(plugin, capabilityId);
    const isChatRequest = request.kind === 'chat';
    const inputSchema = isChatRequest ? (policy?.chat_input_schema || policy?.input_schema) : policy?.input_schema;
    const inputSchemaError = validateSchema(inputSchema, request.payload === undefined ? {} : request.payload);
    if (inputSchemaError) return schemaError('HARNESS_INPUT_SCHEMA_INVALID', 'Harness capability payload does not match its contract', 400);
    const requiredPermissions = policy.permissions || plugin.permissions;
    const permissions = new Set(Array.isArray(user.permissions) ? user.permissions.map(String) : []);
    if (requiredPermissions.length && !permissions.has('*') && !requiredPermissions.some((permission) => permissions.has(permission))) {
      return stableError('HARNESS_PERMISSION_DENIED', 403, 'Harness capability is not permitted');
    }
    if (isWrite(plugin, capabilityId)) {
      if (request.shadow === true) return stableError('HARNESS_WRITE_SHADOW_FORBIDDEN', 409, 'Write capabilities cannot run in shadow mode');
      if (request.confirmed !== true) return stableError('HARNESS_CONFIRMATION_REQUIRED', 409, 'Explicit confirmation is required');
      const key = text(request.idempotency_key || request.idempotencyKey);
      if (key.length < 16 || key.length > 128) return stableError('HARNESS_IDEMPOTENCY_REQUIRED', 409, 'A 16-128 character idempotency key is required');
    }
    return { ok: true, plugin, subject, tenantId };
  };

  const execute = async (request = {}) => {
    const requestedId = text(request.request_id || request.requestId);
    const requestIdValid = !requestedId || validRequestId(requestedId);
    const id = requestIdValid && requestedId ? requestedId : requestId();
    if (!auditKeyAvailable) return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness audit is unavailable');
    const auth = authorize(request);
    const capabilityId = text(request.capability_id || request.capabilityId);
    const policy = auth.plugin ? policyFor(auth.plugin, capabilityId) : null;
    const auditBase = {
      schema: 'eiscore-harness-audit.v1',
      request_id: id,
      plugin_id: auth.plugin?.plugin_id || text(request.plugin_id),
      agent_id: auth.plugin?.agent_id || text(request.agent_id),
      capability_id: capabilityId,
      intent: text(policy?.intent),
      object: text(policy?.object),
      risk: text(policy?.risk || auth.plugin?.risk),
      audit_required: policy?.audit_required === true || auth.plugin?.audit_required === true,
      timeout_ms: Number(policy?.timeout_ms || auth.plugin?.timeout_ms || 0),
      subject_hash: auth.subject ? digest(auth.subject, normalizedAuditKey) : '',
      tenant_hash: auth.tenantId ? digest(auth.tenantId, normalizedAuditKey) : '',
      idempotency_hash: text(request.idempotency_key || request.idempotencyKey) ? digest(request.idempotency_key || request.idempotencyKey, normalizedAuditKey) : '',
      started_at: new Date(clock()).toISOString()
    };
    if (requestedId && !validRequestId(requestedId)) {
      try { await audit({ ...auditBase, decision: 'denied', status: 400, code: 'HARNESS_REQUEST_INVALID', finished_at: new Date(clock()).toISOString() }); }
      catch { return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness audit is unavailable'); }
      return { ...stableError('HARNESS_REQUEST_INVALID', 400, 'Harness request id is invalid'), request_id: id };
    }
    if (!auth.ok) {
      try { await audit({ ...auditBase, decision: 'denied', status: auth.status, code: auth.code, finished_at: new Date(clock()).toISOString() }); }
      catch { return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness audit is unavailable'); }
      return { ...auth, request_id: id };
    }
    try {
      await audit({ ...auditBase, decision: 'allowed', status: 200 });
    } catch {
      return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness audit is unavailable');
    }
    const replayScope = JSON.stringify([auth.tenantId, auth.subject, auth.plugin.plugin_id, capabilityId]);
    const idempotencyKey = isWrite(auth.plugin, capabilityId)
      ? text(request.idempotency_key || request.idempotencyKey)
      : '';
    const requestClaim = claimRequestId(replayScope, id, idempotencyKey);
    if (requestClaim === 'replay') {
      try { await audit({ ...auditBase, decision: 'denied', status: 409, code: 'HARNESS_REQUEST_REPLAY', finished_at: new Date(clock()).toISOString() }); }
      catch { return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness audit is unavailable'); }
      return { ...stableError('HARNESS_REQUEST_REPLAY', 409, 'Harness request has already been processed'), request_id: id };
    }
    if (requestClaim === 'capacity') {
      try { await audit({ ...auditBase, decision: 'denied', status: 429, code: 'HARNESS_CAPACITY_EXCEEDED', finished_at: new Date(clock()).toISOString() }); }
      catch { return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness audit is unavailable'); }
      return { ...stableError('HARNESS_CAPACITY_EXCEEDED', 429, 'Harness request capacity is full'), request_id: id };
    }
    try {
      const timeoutMs = Number(policy.timeout_ms || auth.plugin.timeout_ms || 30000);
      const controller = new AbortController();
      let timeoutHandle;
      let cancelRequest;
      const cancellationPromise = new Promise((_, reject) => { cancelRequest = reject; });
      const onRequestAbort = () => {
        const error = new Error('Harness request was cancelled');
        error.code = 'HARNESS_REQUEST_CANCELLED';
        error.httpStatus = 499;
        controller.abort(error);
        cancelRequest(error);
      };
      if (request.signal?.aborted) controller.abort(Object.assign(new Error('Harness request was cancelled'), { code: 'HARNESS_REQUEST_CANCELLED', httpStatus: 499 }));
      else request.signal?.addEventListener('abort', onRequestAbort, { once: true });
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const error = timeoutError(timeoutMs);
          controller.abort(error);
          reject(error);
        }, timeoutMs);
      });
      let result;
      try {
        if (request.signal?.aborted) throw Object.assign(new Error('Harness request was cancelled'), { code: 'HARNESS_REQUEST_CANCELLED', httpStatus: 499 });
        result = await Promise.race([
          dispatch({ ...request, request_id: id, plugin: auth.plugin, user: request.user, signal: controller.signal }),
          timeoutPromise,
          cancellationPromise
        ]);
      } finally {
        clearTimeout(timeoutHandle);
        request.signal?.removeEventListener('abort', onRequestAbort);
      }
      const rawSafe = normalizeDispatchFailure(result && typeof result === 'object' ? result : { data: result });
      const outputSchema = request.kind === 'chat' ? (policy?.chat_output_schema || policy?.output_schema) : policy?.output_schema;
      const outputInvalid = rawSafe.ok !== false && (
        rawSafe.data === undefined || validateSchema(outputSchema, rawSafe.data)
      );
      const safe = outputInvalid
        ? { ...rawSafe, ok: false, status: 502, code: 'HARNESS_OUTPUT_SCHEMA_INVALID', message: 'Harness capability returned an invalid result' }
        : rawSafe;
      const safeStatus = safe.ok === false
        ? (Number.isInteger(Number(safe.status)) && Number(safe.status) >= 400 && Number(safe.status) <= 599 ? Number(safe.status) : 502)
        : (Number.isInteger(Number(safe.status)) && Number(safe.status) >= 200 && Number(safe.status) <= 599 ? Number(safe.status) : 200);
      try {
        await audit({ ...auditBase, decision: safe.ok === false ? 'error' : 'completed', status: safeStatus, code: safe.code || '', finished_at: new Date(clock()).toISOString() });
      } catch {
        return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness result requires reconciliation with the same idempotency key');
      }
      return { ok: safe.ok !== false, request_id: id, status: safeStatus, data: safe.data, code: safe.code, message: safe.message };
    } catch (error) {
      const code = error?.code === 'HARNESS_REQUEST_CANCELLED'
        ? 'HARNESS_REQUEST_CANCELLED'
        : (error?.code === 'HARNESS_UPSTREAM_TIMEOUT' || error?.name === 'AbortError' ? 'HARNESS_UPSTREAM_TIMEOUT' : 'HARNESS_UPSTREAM_UNAVAILABLE');
      const status = code === 'HARNESS_REQUEST_CANCELLED' ? 499 : (code === 'HARNESS_UPSTREAM_TIMEOUT' ? 504 : 502);
      try { await audit({ ...auditBase, decision: 'error', status, code, finished_at: new Date(clock()).toISOString() }); }
      catch { return stableError('HARNESS_AUDIT_UNAVAILABLE', 503, 'Harness audit is unavailable'); }
      return stableError(code, status, code === 'HARNESS_REQUEST_CANCELLED' ? 'Harness request was cancelled' : (code === 'HARNESS_UPSTREAM_TIMEOUT' ? 'DeepSeek Harness request timed out' : 'DeepSeek Harness is unavailable'));
    }
  };

  return Object.freeze({ authorize, execute, registry });
};

module.exports = { createHarnessGateway, digest, isWrite, policyFor, stableError };
