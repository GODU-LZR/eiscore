'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { createHarnessGateway } = require('./harness-gateway');
const { loadPluginRegistry } = require('../agent-harness/plugin-registry');
const { createJsonlAuditSink } = require('../agent-harness/audit-ledger');
const { createHarnessHttpHandlers } = require('./harness-http');
const { createHarnessChatHttpHandler } = require('./harness-chat-http');
const { createHarnessCapabilityHttpHandlers } = require('./harness-capability-http');
const { createHarnessTwinChatHttpHandler } = require('./harness-twin-chat-http');
const { createHarnessReadHttpHandlers } = require('./harness-read-http');
const { createHarnessToolGateway } = require('./harness-tool-gateway');
const { createHarnessQueryTools } = require('./harness-query-tools');
const { createHarnessDocumentCommitExecutor } = require('./harness-document-commit');
const { createHarnessContextCapabilities } = require('./harness-context-capabilities');
const { sanitizeMultimodalPayload } = require('./harness-multimodal');
const { createHarnessTwinChatExecutor } = require('./harness-twin-chat-capability');

const WORKFLOW_CONTEXT_TOOL_ALLOWLIST = Object.freeze([
  'flash.workflow.definition.list',
  'flash.workflow.instance.list',
  'flash.workflow.event.list',
  'flash.workflow.assignment.list',
  'flash.workflow.mapping.list'
]);
const WORKFLOW_WRITE_TOOL_ALLOWLIST = Object.freeze([
  'flash.workflow.definition.upsert',
  'flash.workflow.assignment.upsert',
  'flash.workflow.mapping.upsert',
  'flash.workflow.instance.start',
  'flash.workflow.instance.transition'
]);
const SALES_CONTEXT_DATASET = 'sales_orders';
const isHarnessBridgeOrigin = (value) => {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol)
      && !url.username && !url.password
      && url.pathname === '/' && !url.search && !url.hash
      && url.hostname.toLowerCase() !== 'deepseek-web'
      && !['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};
const isHarnessConfigurationReady = (env = process.env) => {
  if (String(env.EISCORE_HARNESS_ENABLED || '').toLowerCase() !== 'true') return false;
  if (!isHarnessBridgeOrigin(env.EISCORE_HARNESS_URL)) return false;
  if (!path.isAbsolute(String(env.EISCORE_HARNESS_AUDIT_FILE || ''))) return false;
  if (String(env.EISCORE_HARNESS_AUDIT_HASH_KEY || '').length < 32) return false;
  const bridgeSecret = String(env.EISCORE_HARNESS_BRIDGE_SECRET || '');
  const toolProxySecret = String(env.EISCORE_TOOL_PROXY_SECRET || '');
  if (bridgeSecret.length < 32 || toolProxySecret.length < 32) return false;
  return bridgeSecret !== toolProxySecret;
};
const BRIDGE_ERROR_CODES = new Set([
  'HARNESS_PROTOCOL_REQUIRED', 'HARNESS_CAPACITY_EXCEEDED', 'HARNESS_SESSION_INVALID',
  'HARNESS_REQUEST_INVALID', 'HARNESS_REQUEST_REPLAY', 'HARNESS_OWNER_REQUIRED',
  'HARNESS_PLUGIN_REQUIRED', 'HARNESS_PLUGIN_UNAVAILABLE', 'HARNESS_SESSION_OWNERSHIP_DENIED',
  'HARNESS_SESSION_CAPACITY_EXCEEDED', 'HARNESS_REQUEST_CAPACITY_EXCEEDED', 'HARNESS_BODY_TOO_LARGE', 'HARNESS_BAD_REQUEST',
  'HARNESS_UPSTREAM_UNAVAILABLE', 'HARNESS_TOOL_UNAVAILABLE'
]);
const TOOL_PROXY_SESSION_RE = /^[a-zA-Z0-9._:-]{1,256}$/;
const TOOL_PROXY_FORBIDDEN_KEYS = new Set([
  '__proto__', 'constructor', 'prototype',
  'api_key', 'apikey', 'authorization', 'cookie', 'cookies', 'headers', 'jwt', 'model',
  'org_id', 'organization_id', 'password', 'permissions', 'provider', 'role', 'roles',
  'schema', 'sql', 'subject', 'sub', 'tenant', 'tenant_id', 'tenantid', 'token',
  'user', 'user_id', 'userid', 'agent_id', 'agentid', 'capability_id', 'capabilityid',
  'confirmed', 'confirmed_at', 'confirmation', 'idempotency_key', 'idempotencykey',
  'request_id', 'requestid', 'session_id', 'sessionid', 'plugin_id', 'pluginid',
  'trace_id', 'traceid'
]);
const TOOL_PROXY_ERROR_CODES = new Set([
  'HARNESS_REQUEST_CANCELLED', 'HARNESS_REQUEST_INVALID', 'HARNESS_REQUEST_REPLAY',
  'HARNESS_CAPACITY_EXCEEDED', 'HARNESS_REQUEST_CAPACITY_EXCEEDED', 'HARNESS_AUDIT_UNAVAILABLE',
  'HARNESS_UPSTREAM_TIMEOUT', 'HARNESS_UPSTREAM_UNAVAILABLE', 'HARNESS_INPUT_SCHEMA_INVALID',
  'HARNESS_OUTPUT_SCHEMA_INVALID', 'HARNESS_PERMISSION_DENIED', 'HARNESS_TOOL_UNAVAILABLE',
  'HARNESS_TOOL_NOT_ALLOWED', 'HARNESS_TOOL_ID_REQUIRED', 'HARNESS_TOOL_EXECUTION_FAILED',
  'HARNESS_CONTEXT_INVALID', 'HARNESS_QUERY_INVALID', 'HARNESS_PLAN_ID_REQUIRED',
  'HARNESS_PLAN_ID_INVALID', 'HARNESS_PLAN_VERSION_REQUIRED', 'HARNESS_PLAN_NOT_FOUND',
  'HARNESS_PLAN_VERSION_MISMATCH', 'HARNESS_PLAN_NOT_PLANNED', 'HARNESS_PLAN_TARGET_UNSUPPORTED',
  'HARNESS_PLAN_COMMIT_CONFLICT', 'HARNESS_SALES_WRITE_FAILED', 'HARNESS_SALES_OPERATION_INVALID',
  'HARNESS_SALES_RESOURCE_ID_INVALID', 'HARNESS_SALES_OBJECT_TYPE_INVALID',
  'HARNESS_TWIN_PERSISTENCE_UNAVAILABLE', 'HARNESS_TWIN_PERSISTENCE_FAILED',
  'HARNESS_CONFIRMATION_REQUIRED', 'HARNESS_IDEMPOTENCY_REQUIRED', 'HARNESS_MULTIMODAL_INVALID',
  'MESSAGE_REQUIRED', 'SESSION_ID_INVALID', 'SESSION_ACCESS_DENIED',
  'TEXT_REQUIRED'
]);
const normalizeHarnessToolProxyFailure = (result = {}) => {
  const requestedCode = String(result?.code || '').trim();
  const knownCode = TOOL_PROXY_ERROR_CODES.has(requestedCode);
  const code = knownCode ? requestedCode : 'HARNESS_TOOL_EXECUTION_FAILED';
  const requestedStatus = Number(result?.status);
  let defaultStatus = 502;
  if (code === 'HARNESS_REQUEST_CANCELLED') defaultStatus = 499;
  else if (code === 'HARNESS_PERMISSION_DENIED') defaultStatus = 403;
  else if (code === 'HARNESS_TOOL_UNAVAILABLE') defaultStatus = 404;
  else if (code === 'HARNESS_REQUEST_REPLAY' || code === 'HARNESS_CONFIRMATION_REQUIRED' || code === 'HARNESS_IDEMPOTENCY_REQUIRED') defaultStatus = 409;
  else if (code === 'HARNESS_CAPACITY_EXCEEDED' || code === 'HARNESS_REQUEST_CAPACITY_EXCEEDED') defaultStatus = 429;
  else if (code === 'HARNESS_AUDIT_UNAVAILABLE') defaultStatus = 503;
  else if (code === 'HARNESS_UPSTREAM_TIMEOUT') defaultStatus = 504;
  else if (code === 'HARNESS_INPUT_SCHEMA_INVALID') defaultStatus = 400;
  const status = knownCode && Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
    ? requestedStatus
    : defaultStatus;
  let message = status >= 500 ? 'Harness tool execution failed' : 'Harness tool request rejected';
  if (code === 'HARNESS_REQUEST_CANCELLED') message = 'Harness request was cancelled';
  else if (code === 'HARNESS_REQUEST_REPLAY') message = 'Harness request has already been processed';
  else if (code === 'HARNESS_CAPACITY_EXCEEDED' || code === 'HARNESS_REQUEST_CAPACITY_EXCEEDED') message = 'Harness request capacity is full';
  else if (code === 'HARNESS_AUDIT_UNAVAILABLE') message = 'Harness audit is unavailable';
  else if (code === 'HARNESS_UPSTREAM_TIMEOUT') message = 'DeepSeek Harness request timed out';
  else if (code === 'HARNESS_UPSTREAM_UNAVAILABLE') message = 'DeepSeek Harness is unavailable';
  else if (code === 'HARNESS_INPUT_SCHEMA_INVALID') message = 'Harness capability payload does not match its contract';
  else if (code === 'HARNESS_OUTPUT_SCHEMA_INVALID') message = 'Harness capability returned an invalid result';
  else if (code === 'HARNESS_PERMISSION_DENIED') message = 'Harness capability is not permitted';
  else if (code === 'HARNESS_CONFIRMATION_REQUIRED') message = 'Explicit confirmation is required';
  else if (code === 'HARNESS_IDEMPOTENCY_REQUIRED') message = 'A 16-128 character idempotency key is required';
  return { code, status, message };
};
const normalizeHarnessBridgeResult = (response, data = {}) => {
  const embeddedFailure = data && typeof data === 'object' && data.ok === false;
  if (response.ok && !embeddedFailure) return { ok: true, status: response.status, data };
  const code = BRIDGE_ERROR_CODES.has(String(data?.code || '')) ? data.code : 'HARNESS_UPSTREAM_UNAVAILABLE';
  const embeddedStatus = Number(data?.status);
  const status = Number.isInteger(embeddedStatus) && embeddedStatus >= 400 && embeddedStatus <= 599
    ? embeddedStatus
    : (response.status >= 400 && response.status <= 599 ? response.status : 502);
  return {
    ok: false,
    status,
    data: undefined,
    code,
    message: code === 'HARNESS_UPSTREAM_UNAVAILABLE' ? 'DeepSeek Harness is unavailable' : 'DeepSeek Harness request was rejected'
  };
};
const resolveHarnessOwnerTenant = (user = {}) => String(user.tenant_id || user.tenantId || user.tenant || user.org_id || user.organization_id || '').trim();
const resolveHarnessOwnerSubject = (user = {}) => String(user.id || user.sub || user.username || '').trim();
const resolveHarnessDispatchScope = (request = {}) => {
  const subject = resolveHarnessOwnerSubject(request.user);
  const tenant = resolveHarnessOwnerTenant(request.user);
  const plugin = String(request.plugin?.plugin_id || request.plugin_id || '').trim();
  return JSON.stringify([subject, tenant, plugin]);
};
const buildHarnessBridgeHeaders = (request = {}) => ({
  'content-type': 'application/json',
  'x-eis-harness-protocol': 'eiscore-agent-v1',
  'x-eis-ai-session': String(request.session_id || request.request_id || ''),
  'x-eis-request-id': String(request.request_id || ''),
  'x-eis-plugin-id': String(request.plugin?.plugin_id || ''),
  'x-eis-owner-subject': resolveHarnessOwnerSubject(request.user),
  'x-eis-owner-tenant': resolveHarnessOwnerTenant(request.user),
  'x-eis-harness-bridge-secret': String(process.env.EISCORE_HARNESS_BRIDGE_SECRET || '')
});

const sanitizeHarnessToolArguments = (value, depth = 0) => {
  if (depth > 6) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeHarnessToolArguments(item, depth + 1));
  if (!value || typeof value !== 'object') return undefined;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = String(key).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (TOOL_PROXY_FORBIDDEN_KEYS.has(normalizedKey) || TOOL_PROXY_FORBIDDEN_KEYS.has(normalizedKey.replace(/_/g, ''))) continue;
    const safeChild = sanitizeHarnessToolArguments(child, depth + 1);
    if (safeChild !== undefined) result[key] = safeChild;
  }
  return result;
};

const sameSecret = (received, expected) => {
  const left = Buffer.from(String(received || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
};

const createHarnessToolProxyHandler = ({ registry, activeDispatches, secret, readJsonBody, sendJson, execute }) => {
  if (!registry || typeof registry.resolveCapability !== 'function') throw new TypeError('Harness tool proxy registry is required');
  if (!(activeDispatches instanceof Map)) throw new TypeError('Harness tool proxy dispatch store is required');
  if (typeof readJsonBody !== 'function' || typeof sendJson !== 'function' || typeof execute !== 'function') throw new TypeError('Harness tool proxy handlers are required');
  const configuredSecret = String(secret || '');
  return async (req, res) => {
    const providedSecret = req?.headers?.['x-eis-tool-secret'];
    if (configuredSecret.length < 32 || !sameSecret(providedSecret, configuredSecret)) {
      sendJson(res, 401, { code: 'HARNESS_TOOL_PROXY_UNAUTHORIZED', message: 'Harness tool proxy authorization failed' });
      return;
    }
    let body;
    try { body = await readJsonBody(req); } catch { sendJson(res, 400, { code: 'HARNESS_BAD_REQUEST', message: 'Invalid request body' }); return; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { sendJson(res, 400, { code: 'HARNESS_BAD_REQUEST', message: 'Invalid request body' }); return; }
    const sessionId = String(body.session_id || body.sessionId || '').trim();
    const toolName = String(body.tool_name || body.toolName || '').trim();
    if (!TOOL_PROXY_SESSION_RE.test(sessionId) || !toolName) { sendJson(res, 400, { code: 'HARNESS_BAD_REQUEST', message: 'session_id and tool_name are required' }); return; }
    const dispatch = activeDispatches.get(sessionId);
    if (!dispatch) { sendJson(res, 409, { code: 'HARNESS_SESSION_INVALID', message: 'Harness session is not active' }); return; }
    const capabilityPlugin = registry.resolveCapability(toolName);
    if (!capabilityPlugin) { sendJson(res, 404, { code: 'HARNESS_TOOL_UNAVAILABLE', message: 'Harness tool is unavailable' }); return; }
    const activePluginId = String(dispatch.request?.plugin?.plugin_id || dispatch.request?.plugin_id || '').trim();
    if (!activePluginId || capabilityPlugin.plugin_id !== activePluginId) {
      sendJson(res, 403, { code: 'HARNESS_PLUGIN_MISMATCH', message: 'Harness tool is not registered for this plugin' });
      return;
    }
    const rawArguments = body.arguments === undefined ? {} : body.arguments;
    if (!rawArguments || typeof rawArguments !== 'object' || Array.isArray(rawArguments)) { sendJson(res, 400, { code: 'HARNESS_BAD_REQUEST', message: 'Tool arguments must be an object' }); return; }
    const payload = sanitizeHarnessToolArguments(rawArguments);
    const request = dispatch.request || {};
    let result;
    try {
      result = await execute({
        request_id: `${String(request.request_id || crypto.randomUUID())}:tool:${crypto.randomUUID()}`,
        session_id: sessionId,
        plugin_id: capabilityPlugin.plugin_id,
        agent_id: capabilityPlugin.agent_id,
        capability_id: toolName,
        user: request.user,
        payload,
        confirmed: request.confirmed === true,
        idempotency_key: request.idempotency_key || request.idempotencyKey,
        signal: req.signal
      });
    } catch {
      sendJson(res, 502, { code: 'HARNESS_TOOL_EXECUTION_FAILED', message: 'Harness tool execution failed' });
      return;
    }
    if (!result?.ok) {
      const failure = normalizeHarnessToolProxyFailure(result);
      sendJson(res, failure.status, { code: failure.code, message: failure.message });
      return;
    }
    sendJson(res, 200, { ok: true, data: result.data === undefined ? {} : result.data });
  };
};

const createFixedFlashCapabilityExecutor = (executeFlashToolCall, defaultToolId, allowedToolIds, source) => {
  const allowed = new Set(allowedToolIds);
  return async (user, payload = {}, request = {}) => {
    const requestedToolId = String(payload.tool_id || payload.toolId || defaultToolId).trim();
    if (!allowed.has(requestedToolId)) {
      const error = new Error('Harness capability tool is not allowed');
      error.code = 'HARNESS_TOOL_NOT_ALLOWED';
      error.httpStatus = 403;
      throw error;
    }
    const args = payload.arguments && typeof payload.arguments === 'object' ? payload.arguments : payload.args || {};
    const result = await executeFlashToolCall(user, {
      ...payload,
      tool_id: requestedToolId,
      arguments: args,
      confirmed: request.confirmed === true,
      idempotency_key: request.idempotency_key || request.idempotencyKey,
      trace_id: request.request_id || request.requestId,
      session_id: request.session_id || request.sessionId
    }, source);
    if (result?.payload?.ok === false) {
      const error = new Error(result.payload.message || 'Tool execution failed');
      error.code = result.payload.code;
      error.httpStatus = result.status;
      throw error;
    }
    return result?.payload?.data || result?.payload;
  };
};

const executeFixedSalesContext = (queryTools) => (user, payload = {}) => queryTools.execute(user, { ...payload, dataset: SALES_CONTEXT_DATASET }, 'company-sales');

const createHarnessMultimodalExecutor = ({ bridgeUrl, fetchImpl = globalThis.fetch, buildHeaders = buildHarnessBridgeHeaders } = {}) => {
  if (typeof fetchImpl !== 'function') throw new TypeError('Harness multimodal fetch implementation is required');
  const resolvedBridgeUrl = String(bridgeUrl || '').replace(/\/+$/, '');
  return async (capabilityId, user, payload = {}, request = {}) => {
    if (!/^https?:\/\/[^/?#]+$/i.test(resolvedBridgeUrl)) throw new Error('invalid harness bridge URL');
    const response = await fetchImpl(`${resolvedBridgeUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: request.signal,
      headers: buildHeaders({ ...request, user, capability_id: capabilityId }),
      body: JSON.stringify(payload)
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    const normalized = normalizeHarnessBridgeResult(response, data);
    if (!normalized.ok) {
      const error = new Error(normalized.message);
      error.code = normalized.code;
      error.httpStatus = normalized.status;
      throw error;
    }
    return normalized.data;
  };
};

const createHarnessProviderDispatch = ({ bridgeUrl, activeDispatches, fetchImpl = globalThis.fetch } = {}) => {
  if (!(activeDispatches instanceof Map)) throw new TypeError('Harness active dispatch store is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('Harness provider fetch implementation is required');
  const resolvedBridgeUrl = String(bridgeUrl || '').replace(/\/+$/, '');
  const sessionQueues = new Map();
  const sessionScopes = new Map();
  return async (request) => {
    if (!/^https?:\/\/[^/?#]+$/i.test(resolvedBridgeUrl)) throw new Error('invalid harness bridge URL');
    const sessionId = String(request.session_id || request.request_id || '').trim();
    const scope = resolveHarnessDispatchScope(request);
    const scopeState = sessionScopes.get(sessionId);
    if (scopeState && scopeState.scope !== scope) {
      return {
        ok: false,
        status: 403,
        code: 'HARNESS_SESSION_OWNERSHIP_DENIED',
        message: 'Harness session is active for another owner or plugin'
      };
    }
    if (scopeState) scopeState.count += 1;
    else sessionScopes.set(sessionId, { scope, count: 1 });
    const previous = sessionQueues.get(sessionId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => current);
    sessionQueues.set(sessionId, tail);
    await previous;
    if (request.signal?.aborted) {
      release();
      if (sessionQueues.get(sessionId) === tail) sessionQueues.delete(sessionId);
      const currentScope = sessionScopes.get(sessionId);
      if (currentScope?.scope === scope) {
        currentScope.count -= 1;
        if (currentScope.count <= 0) sessionScopes.delete(sessionId);
      }
      throw request.signal.reason || new Error('Harness request was cancelled');
    }
    const existing = activeDispatches.get(sessionId);
    if (existing && existing.scope !== scope) {
      release();
      if (sessionQueues.get(sessionId) === tail) sessionQueues.delete(sessionId);
      const currentScope = sessionScopes.get(sessionId);
      if (currentScope?.scope === scope) {
        currentScope.count -= 1;
        if (currentScope.count <= 0) sessionScopes.delete(sessionId);
      }
      return {
        ok: false,
        status: 403,
        code: 'HARNESS_SESSION_OWNERSHIP_DENIED',
        message: 'Harness session is active for another owner or plugin'
      };
    }
    activeDispatches.set(sessionId, { request, scope, depth: 1 });
    try {
      const response = await fetchImpl(`${resolvedBridgeUrl}/v1/chat/completions`, {
        method: 'POST',
        signal: request.signal,
        headers: buildHarnessBridgeHeaders(request),
        body: JSON.stringify(sanitizeMultimodalPayload(request.capability_id, request.payload || {}))
      });
      let data = {};
      try { data = await response.json(); } catch { data = {}; }
      return normalizeHarnessBridgeResult(response, data);
    } finally {
      activeDispatches.delete(sessionId);
      release();
      if (sessionQueues.get(sessionId) === tail) sessionQueues.delete(sessionId);
      const currentScope = sessionScopes.get(sessionId);
      if (currentScope?.scope === scope) {
        currentScope.count -= 1;
        if (currentScope.count <= 0) sessionScopes.delete(sessionId);
      }
    }
  };
};

const createHarnessRuntime = ({ authorizeHttpRequest, authorizeTwinRequest, readJsonBody, sendJson, setCorsHeaders, streamTextAsSse, executeFlashToolCall, executeEnterpriseSnapshot, executeDigitalTwinContext, executeDigitalTwinChat, executeDocumentPlan, executeSalesWrite, executeEngineeringContext, executeSiteSales, documentEntryWorker, documentFixedEntryWorker, createTwinPersistence, callPostgrestWithUser, fetchSemanticContext, envText = (value, fallback = '') => String(value ?? fallback).trim() }) => {
  const registry = loadPluginRegistry();
  const enabled = isHarnessConfigurationReady(process.env);
  // A missing bridge URL must fail closed; never silently target a process-local
  // loopback service that could be an unrelated or retired runtime.
  const bridgeUrl = envText(process.env.EISCORE_HARNESS_URL, '').replace(/\/+$/, '');
  const activeDispatches = new Map();
  const audit = createJsonlAuditSink({ filePath: envText(process.env.EISCORE_HARNESS_AUDIT_FILE, '') });
  const providerDispatch = createHarnessProviderDispatch({ bridgeUrl, activeDispatches });
  const gateway = createHarnessGateway({
    registry,
    auditKey: envText(process.env.EISCORE_HARNESS_AUDIT_HASH_KEY, ''),
    audit,
    dispatch: providerDispatch
  });
  const queryTools = createHarnessQueryTools({ callPostgrestWithUser, fetchSemanticContext });
  const contextCapabilities = createHarnessContextCapabilities({ callPostgrestWithUser });
  const twinChat = executeDigitalTwinChat || createHarnessTwinChatExecutor({ createPersistence: createTwinPersistence, dispatch: gateway.execute });
  const executeDocumentCommit = createHarnessDocumentCommitExecutor({ callPostgrestWithUser, documentEntryWorker, documentFixedEntryWorker });
  const executeEnterpriseSnapshotStrict = async (user) => {
    const context = await fetchSemanticContext(user);
    if (!context) {
      const error = new Error('Role-scoped enterprise context is unavailable');
      error.code = 'HARNESS_PERMISSION_DENIED';
      error.httpStatus = 403;
      throw error;
    }
    return executeEnterpriseSnapshot(user, { accessContext: context });
  };
  const executeFlashCapability = (defaultToolId, allowedToolIds, source) => createFixedFlashCapabilityExecutor(executeFlashToolCall, defaultToolId, allowedToolIds, source);
  const executeMultimodal = createHarnessMultimodalExecutor({ bridgeUrl, fetchImpl: globalThis.fetch });
  const toolGateway = createHarnessToolGateway({
    executeFlashToolCall,
    executeEnterpriseSnapshot: executeEnterpriseSnapshotStrict,
    executeDigitalTwinContext,
    executeDigitalTwinChat: twinChat,
    executeConstrainedQuery: queryTools.execute,
    executeWorkflowContext: executeFlashCapability('flash.workflow.definition.list', WORKFLOW_CONTEXT_TOOL_ALLOWLIST, 'harness-workflow-context'),
    executeWorkflowWrite: executeFlashCapability('flash.workflow.instance.transition', WORKFLOW_WRITE_TOOL_ALLOWLIST, 'harness-workflow-write'),
    executeSalesContext: executeFixedSalesContext(queryTools),
    executeSalesWrite,
    executeDocumentPlan,
    executeDocumentCommit,
    executeEngineeringContext: executeEngineeringContext || contextCapabilities.executeEngineering,
    executeSiteSales: executeSiteSales || contextCapabilities.executeSiteSales,
    executeMultimodal
  });
  const toolExecutionGateway = createHarnessGateway({
    registry,
    auditKey: envText(process.env.EISCORE_HARNESS_AUDIT_HASH_KEY, ''),
    audit,
    dispatch: toolGateway.execute
  });
  const handleToolProxy = createHarnessToolProxyHandler({
    registry,
    activeDispatches,
    secret: envText(process.env.EISCORE_TOOL_PROXY_SECRET, ''),
    readJsonBody,
    sendJson,
    execute: toolExecutionGateway.execute
  });
  const http = createHarnessHttpHandlers({ authorize: authorizeHttpRequest, gateway: toolExecutionGateway, enabled, readJsonBody, sendJson });
  const read = createHarnessReadHttpHandlers({ authorize: authorizeHttpRequest, registry, enabled, fetchSnapshot: async (user, { signal } = {}) => {
    const result = await toolExecutionGateway.execute({ plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: 'eiscore_enterprise_snapshot', user, payload: {}, signal });
    if (!result.ok) {
      const error = new Error(result.message || 'Harness snapshot failed');
      error.code = result.code;
      error.httpStatus = result.status;
      throw error;
    }
    return result.data || {};
  }, sendJson });
  const chat = createHarnessChatHttpHandler({ authorize: authorizeHttpRequest, readJsonBody, sendJson, gateway, setCorsHeaders, streamTextAsSse, enabled });
  const capability = createHarnessCapabilityHttpHandlers({ authorize: authorizeHttpRequest, gateway, readJsonBody, sendJson, enabled });
  const twin = createHarnessTwinChatHttpHandler({ authorize: authorizeTwinRequest, readJsonBody, sendJson, gateway: toolExecutionGateway, createPersistence: createTwinPersistence, managePersistence: true, setCorsHeaders, streamTextAsSse, enabled });
  return Object.freeze({ enabled, gateway, toolGateway: toolExecutionGateway, handlers: Object.freeze({ ...http, ...read, ...capability, handleChat: chat, handleTwinChat: twin, handleToolProxy }) });
};

module.exports = {
  SALES_CONTEXT_DATASET,
  WORKFLOW_CONTEXT_TOOL_ALLOWLIST,
  WORKFLOW_WRITE_TOOL_ALLOWLIST,
  createFixedFlashCapabilityExecutor,
  createHarnessProviderDispatch,
  createHarnessToolProxyHandler,
  createHarnessMultimodalExecutor,
  createHarnessRuntime,
  isHarnessConfigurationReady,
  buildHarnessBridgeHeaders,
  executeFixedSalesContext,
  normalizeHarnessBridgeResult,
  resolveHarnessOwnerSubject,
  resolveHarnessOwnerTenant,
  resolveHarnessDispatchScope
};
