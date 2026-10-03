const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const path = require('path');
const { createDocumentIntakeHandlers } = require('./document-intake');
const { createDocumentParseWorker } = require('./document-parser');
const { createDocumentPlanWorker } = require('./document-planner');
const { createDocumentEntryWorker } = require('./document-entry');
const { createDocumentFixedEntryWorker } = require('./document-fixed-entry');
const { createHttpRequestHandler, normalizeAgentRequestPath } = require('./http-router');
const { createCompanyHttpModule } = require('./company-http');
const { createCompanySiteHandlers } = require('./company-site');
const { createCompanySalesHandlers } = require('./company-sales-agent');
const { createTwinResourceHttpHandlers } = require('./twin-resource-http');
const { createFlashHttpHandlers } = require('./flash-http');
const { attachWebSocketServer } = require('./websocket-server');
const { createHarnessFlashToolCallHandler } = require('./flash-harness-ws');
const { createDatabaseNotifier } = require('./database-notifier');
const { normalizeText: normalizeAiText } = require('./message-normalization');
const { FlashToolError, createFlashPostgrestAdapter } = require('./flash-postgrest-adapter');
const { createFlashToolRegistry } = require('./flash-tool-registry');
const { createFlashAuthorization } = require('./flash-authorization');
const { createFlashToolService } = require('./flash-tool-service');
const { createFlashSemanticExecutor } = require('./flash-semantic-executor');
const { loadFlashWorkspaceConfig } = require('./flash-workspace-config');
const { createFlashWorkspaceService } = require('./flash-workspace-service');
const { createAgentDatabaseConfig } = require('./database-config');
const { createHarnessRuntime } = require('./harness-runtime');
const { createHarnessSalesWriteExecutor } = require('./harness-sales-write');
const { createAiContextService } = require('./ai-context-service');
const { createTwinTools, createPersistence } = require('./twin-tools');
const { createHarnessTwinContextExecutor } = require('./harness-twin-context-capability');

const envText = (value, fallback = '') => String(value ?? fallback).trim();
const port = Number(process.env.PORT || 8078);
const wsPath = envText(process.env.WS_PATH, '/ws') || '/ws';
const rawChannel = envText(process.env.CHANNEL, 'eis_events') || 'eis_events';
const channel = /^[a-zA-Z0-9_]+$/.test(rawChannel) ? rawChannel : 'eis_events';
const workflowChannel = 'workflow_event';
const enableWorkflowAutoTransition = envText(process.env.WORKFLOW_AUTO_TRANSITION, '0') === '1';
const jwtSecret = envText(
  process.env.EISCORE_AUTH_JWT_SECRET,
  envText(process.env.PGRST_JWT_SECRET, envText(process.env.JWT_SECRET, ''))
);
const postgrestBaseUrl = envText(process.env.AGENT_POSTGREST_URL, 'http://api:3000').replace(/\/+$/, '');
const postgrestUserRole = envText(
  process.env.AGENT_POSTGREST_ROLE,
  envText(process.env.PGRST_DB_USER_ROLE, 'web_user')
) || 'web_user';
const flashToolCallTimeoutMs = Number(process.env.FLASH_TOOL_CALL_TIMEOUT_MS || 30 * 1000);
const flashToolIdempotencyTtlMs = Number(process.env.FLASH_TOOL_IDEMPOTENCY_TTL_MS || 10 * 60 * 1000);
const flashConfig = loadFlashWorkspaceConfig();

const logAgentEvent = (type, user, details = {}) => console.log('[agent-event]', JSON.stringify({ type, user: { id: user?.id || '', role: user?.role || '' }, details }));

const flashWorkspaceService = createFlashWorkspaceService({
  projectPath: flashConfig.projectPath,
  workdirConfigured: flashConfig.workdirConfigured,
  draftFileName: flashConfig.draftFileName,
  attachmentDirName: flashConfig.attachmentDirName,
  attachmentMaxBytes: flashConfig.attachmentMaxBytes,
  attachmentPreviewMaxChars: flashConfig.attachmentPreviewMaxChars,
  moduleRoot: __dirname,
  normalizeText: normalizeAiText,
  normalizeProjectPath,
  sanitizePathToken,
  FlashToolError,
  logAgentEvent
});
const {
  readDraftSource: readFlashDraftSource,
  requireNonEmptyText,
  uploadAttachment: uploadFlashAttachment,
  writeDraftSource: writeFlashDraftSource
} = flashWorkspaceService;

if (!process.env.NODE_USE_ENV_PROXY) {
  process.env.NODE_USE_ENV_PROXY = '1';
}

let shuttingDown = false;
const flashAuthorization = createFlashAuthorization({
  callPostgrestWithUser: (...args) => callPostgrestWithUser(...args)
});
const flashToolRegistry = createFlashToolRegistry({
  getVisibleToolIds: (user) => flashAuthorization.getVisibleToolIds(user)
});
const {
  getFlashToolDefinition,
  getFlashToolRegistryPayload,
  registryCount: flashSemanticToolRegistryCount,
  registryVersion: flashSemanticToolRegistryVersion,
  resolveFlashToolId
} = flashToolRegistry;

const flashToolService = createFlashToolService({
  idempotencyTtlMs: flashToolIdempotencyTtlMs,
  authorizeTool: (...args) => flashAuthorization.authorizeFlashTool(...args),
  getToolDefinition: getFlashToolDefinition,
  resolveToolId: resolveFlashToolId,
  registryVersion: flashSemanticToolRegistryVersion,
  registryCount: flashSemanticToolRegistryCount,
  executeSemanticTool: (...args) => executeFlashSemanticTool(...args),
  logAgentEvent,
  normalizeText: (...args) => normalizeAiText(...args),
  sanitizePathToken
});
const {
  executeFlashToolCall,
  normalizeToolCallBoolean
} = flashToolService;

const getRequestPath = (req) => {
  return normalizeAgentRequestPath(req?.url);
};

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
};

const sendJson = (res, status, payload, extraHeaders = {}) => {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(payload || {}));
};

const getBearerFromAuthHeader = (req) => {
  const header = req?.headers?.authorization;
  if (!header) return '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const asUser = (payload, token) => ({
  id: payload?.user_id || payload?.sub || payload?.username || payload?.email || '',
  username: payload?.username || '',
  role: payload?.app_role || payload?.role || '',
  tenant_id: payload?.tenant_id || payload?.tenantId || payload?.tenant || payload?.org_id || payload?.organization_id || '',
  permissions: Array.isArray(payload?.permissions) ? payload.permissions.map((p) => String(p)) : [],
  token: token || ''
});

const hasHarnessTenantContext = (user = {}) => Boolean(
  String(user.id || user.sub || user.username || '').trim()
  && String(user.tenant_id || user.tenantId || user.tenant || user.org_id || user.organization_id || '').trim()
  && String(user.token || '').trim()
);

const hasDocumentIntakeAdminAccess = (user = {}) => {
  const role = String(user.role || '').trim().toLowerCase();
  const roles = String(process.env.DOCUMENT_INTAKE_ADMIN_ROLES || 'super_admin,admin,document_admin,document_intake_admin')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const permissions = Array.isArray(user.permissions)
    ? user.permissions.map((value) => String(value || '').trim().toLowerCase())
    : [];
  return roles.includes(role) || permissions.some((permission) => [
    'document:admin',
    'document-intake:admin',
    'document_intake:admin',
    'admin:document-intake'
  ].includes(permission));
};

const readJsonBody = (req, maxBytes = 25 * 1024 * 1024) => {
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

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (error) => reject(error));
  });
};

const documentIntakeHandlers = createDocumentIntakeHandlers({
  sendJson,
  readJsonBody
});
const documentParseWorker = createDocumentParseWorker({ log: console });
const documentPlanWorker = createDocumentPlanWorker({ log: console });
const documentEntryWorker = createDocumentEntryWorker({ log: console });
const documentFixedEntryWorker = createDocumentFixedEntryWorker({ log: console });
let companySalesHandlers = null;

const sendWsJson = (ws, payload) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
};

const parseJsonMaybe = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const sendText = (res, status, payload, extraHeaders = {}) => {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
  res.end(String(payload || ''));
};

const flashPostgrestAdapter = createFlashPostgrestAdapter({
  baseUrl: postgrestBaseUrl,
  userRole: postgrestUserRole,
  jwtSecret,
  toolCallTimeoutMs: flashToolCallTimeoutMs,
  signJwt: (...args) => jwt.sign(...args),
  fetchImpl: (...args) => fetch(...args),
  sanitizeQueryParams,
  parseJson: parseJsonMaybe,
  normalizeText: normalizeAiText
});
const {
  bindPgQueryForUser,
  callPostgrestWithFlashTableEnsure,
  callPostgrestWithUser,
  inferFlashDataColumnsFromPayload,
  resolveDataTableTarget
} = flashPostgrestAdapter;
const aiContextService = createAiContextService({ callPostgrestWithUser, log: console });

const flashSemanticExecutor = createFlashSemanticExecutor({
  callPostgrestWithFlashTableEnsure,
  callPostgrestWithUser,
  inferFlashDataColumnsFromPayload,
  normalizeText: normalizeAiText,
  normalizeToolCallBoolean,
  readFlashDraftSource,
  requireNonEmptyText,
  resolveDataTableTarget,
  sanitizeQueryParams,
  uploadFlashAttachment,
  writeFlashDraftSource
});
const { executeFlashSemanticTool } = flashSemanticExecutor;

const streamTextAsSse = (res, text, chunkSize = 800) => {
  const output = normalizeAiText(text);
  if (!output) {
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  for (let start = 0; start < output.length; start += chunkSize) {
    const chunk = output.slice(start, start + chunkSize);
    if (!res.writableEnded) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
  }
  if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
};

const authorizeHttpRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload, token);
  if (!hasHarnessTenantContext(user)) {
    sendJson(res, 401, { code: 'HARNESS_AUTH_REQUIRED', message: 'Authenticated tenant context is required' });
    return null;
  }
  return user;
};

const authorizeAgentHttpRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload);
  user.token = token;
  if (!hasHarnessTenantContext(user)) {
    sendJson(res, 401, { code: 'HARNESS_AUTH_REQUIRED', message: 'Authenticated tenant context is required' });
    return null;
  }
  return user;
};

const handleFlashToolCallWs = createHarnessFlashToolCallHandler({
  execute: (...args) => harnessRuntime.toolGateway.execute(...args),
  getToolDefinition: flashToolRegistry.getFlashToolDefinition,
  resolveToolId: flashToolRegistry.resolveFlashToolId,
  sendWsJson,
  enabled: harnessRuntime.enabled
});

const flashHttpHandlers = createFlashHttpHandlers({
  authorizeAgentHttpRequest,
  getFlashToolRegistryPayload,
  readJsonBody,
  executeFlashToolCall,
  readFlashDraftSource,
  writeFlashDraftSource,
  uploadFlashAttachment,
  resolveFlashToolErrorStatus: (error) => error instanceof FlashToolError ? error.httpStatus : 500,
  flashAttachmentMaxBytes: flashConfig.attachmentMaxBytes,
  sendJson
});

// ═══════════════════════════════════════════════════════════════
// ── 员工数字分身 (Digital Twin) API Handlers ─────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * 数字分身授权（复用 authorizeHttpRequest 逻辑但也允许普通员工角色）
 */
const authorizeTwinRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload, token);
  if (!hasHarnessTenantContext(user)) {
    sendJson(res, 401, { code: 'HARNESS_AUTH_REQUIRED', message: 'Authenticated tenant context is required' });
    return null;
  }
  return user;
};
const executeDigitalTwinContext = createHarnessTwinContextExecutor({
  fetchSemanticContext: (user) => aiContextService.fetchSemanticContext(user),
  createTools: createTwinTools,
  queryForUser: bindPgQueryForUser
});
const executeDocumentPlan = async (user, payload = {}) => {
  const planId = String(payload.plan_id || payload.planId || '').trim();
  const assetId = String(payload.asset_id || payload.assetId || '').trim();
  if (!planId && !assetId) {
    const error = new Error('plan_id or asset_id is required');
    error.code = 'HARNESS_PLAN_ID_REQUIRED';
    error.httpStatus = 400;
    throw error;
  }
  if (planId && !/^[0-9a-f-]{36}$/i.test(planId) || assetId && !/^[0-9a-f-]{36}$/i.test(assetId)) {
    const error = new Error('plan identifier is invalid');
    error.code = 'HARNESS_PLAN_ID_INVALID';
    error.httpStatus = 400;
    throw error;
  }
  const query = {
    select: 'id,asset_id,batch_id,target_module,target_document_type,target_kind,app_id,app_name,target_schema,target_table,mode,document_count,line_count,confidence,reason,columns_snapshot,documents,status,metadata,created_at,updated_at',
    limit: planId ? '1' : '20',
    order: 'created_at.desc'
  };
  if (planId) query.id = `eq.${planId}`;
  if (assetId) query.asset_id = `eq.${assetId}`;
  const result = await callPostgrestWithUser(user, { method: 'GET', path: '/document_entry_plans', query, acceptProfile: 'public', timeoutMs: 8000 });
  return { plans: Array.isArray(result?.data) ? result.data : [] };
};
const executeSalesWrite = createHarnessSalesWriteExecutor({ getHandlers: () => companySalesHandlers });
const harnessRuntime = createHarnessRuntime({ authorizeHttpRequest, authorizeTwinRequest, readJsonBody, sendJson, setCorsHeaders, streamTextAsSse, executeFlashToolCall, executeEnterpriseSnapshot: (user, options = {}) => aiContextService.fetchBusinessSnapshot(user, options.accessContext), executeDigitalTwinContext, executeDocumentPlan, executeSalesWrite, documentEntryWorker, documentFixedEntryWorker, createTwinPersistence: (user) => createPersistence(bindPgQueryForUser(user), user.username || user.id), callPostgrestWithUser, fetchSemanticContext: (user) => aiContextService.fetchSemanticContext(user), envText });

const handleFlashHarnessTaskWs = async (ws, payload = {}) => {
  const sessionId = sanitizePathToken(payload.sessionId || payload.session_id, 'flash-default');
  if (!harnessRuntime.enabled) {
    sendWsJson(ws, { type: 'flash:harness_error', sessionId, error: 'DeepSeek Harness is disabled', code: 'HARNESS_DISABLED' });
    sendWsJson(ws, { type: 'flash:harness_done', sessionId, success: false });
    return;
  }
  const requestId = String(payload.requestId || payload.request_id || `flash_ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
    .replace(/[^a-zA-Z0-9._:-]/g, '_')
    .slice(0, 256);
  const prompt = String(payload.prompt || '').trim().slice(0, 10000);
  if (!prompt) {
    sendWsJson(ws, { type: 'flash:harness_error', sessionId, error: '请输入任务内容' });
    sendWsJson(ws, { type: 'flash:harness_done', sessionId, success: false });
    return;
  }
  const history = (Array.isArray(payload.history) ? payload.history : [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({ role: item.role, content: String(item.content || '').slice(0, 10000) }))
    .filter((item) => item.content)
    .slice(-24);
  const attachments = (Array.isArray(payload.attachments) ? payload.attachments : [])
    .slice(-12)
    .map((item) => ({
      name: String(item?.name || '').slice(0, 160),
      relativePath: String(item?.relativePath || item?.path || '').slice(0, 512),
      mimeType: String(item?.mimeType || item?.type || '').slice(0, 160),
      textPreview: String(item?.textPreview || '').slice(0, 8000)
    }))
    .filter((item) => item.name || item.relativePath || item.textPreview);
  const confirmed = payload.confirmed === true;
  const idempotencyKey = String(payload.idempotencyKey || payload.idempotency_key || '')
    .trim()
    .slice(0, 128);
  sendWsJson(ws, { type: 'flash:harness_status', sessionId, status: 'running' });
  let result;
  try {
    result = await harnessRuntime.gateway.execute({
      kind: 'chat',
      request_id: requestId,
      session_id: sessionId,
      plugin_id: 'flash-builder',
      agent_id: 'flash_builder',
      capability_id: 'eiscore_flash_read',
      confirmed,
      idempotency_key: idempotencyKey,
      user: ws.user,
      payload: {
        messages: [...history, { role: 'user', content: prompt }],
        stream: false,
        context: {
          app_id: String(payload.appId || payload.app_id || '').slice(0, 128),
          source: 'flash_builder',
          attachments
        }
      }
    });
  } catch (error) {
    result = { ok: false, code: error?.code || 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' };
  }
  if (!result?.ok) {
    sendWsJson(ws, { type: 'flash:harness_error', sessionId, error: result?.message || 'Harness task failed', code: result?.code || 'HARNESS_UPSTREAM_UNAVAILABLE' });
    sendWsJson(ws, { type: 'flash:harness_done', sessionId, success: false });
    return;
  }
  const data = result.data || {};
  const content = String(data.text || data.output_text || data.choices?.[0]?.message?.content || '').trim();
  if (content) sendWsJson(ws, { type: 'flash:harness_output', sessionId, content });
  sendWsJson(ws, { type: 'flash:harness_done', sessionId, success: true, draftChanged: undefined });
};

const handleFlashHarnessResetWs = async (ws, payload = {}) => {
  const sessionId = sanitizePathToken(payload.sessionId || payload.session_id, 'flash-default');
  sendWsJson(ws, { type: 'flash:harness_status', sessionId, status: 'reset', message: '会话已重置' });
};

const authorizeDocumentIntakeAdminRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload, token);
  if (!hasHarnessTenantContext(user)) {
    sendJson(res, 401, { code: 'HARNESS_AUTH_REQUIRED', message: 'Authenticated tenant context is required' });
    return null;
  }
  if (!hasDocumentIntakeAdminAccess(user)) {
    sendJson(res, 403, { code: 'FORBIDDEN', message: 'Document intake administration denied for current role' });
    return null;
  }
  return user;
};

const twinResourceHttpHandlers = createTwinResourceHttpHandlers({
  authorizeTwinRequest,
  bindPgQueryForUser,
  readJsonBody,
  sendJson,
  port
});

const companyQuery = (...args) => databaseNotifier.query(...args);
const companySiteHandlers = createCompanySiteHandlers({ query: companyQuery, sendJson, sendText, readJsonBody });
companySalesHandlers = createCompanySalesHandlers({ query: companyQuery, sendJson, readJsonBody });
const companyHttp = createCompanyHttpModule({
  companySiteHandlers,
  companySalesHandlers,
  getRequestPath,
  getBearerFromAuthHeader,
  verifyToken,
  asUser,
  hasTenantContext: hasHarnessTenantContext,
  readJsonBody,
  sendJson
});

const server = http.createServer(createHttpRequestHandler({
  getRequestPath,
  setCorsHeaders,
  authorizers: {
    documentIntakeAdmin: authorizeDocumentIntakeAdminRequest,
    ...companyHttp.authorizers
  },
  handlers: {
    health: (_req, res) => sendJson(res, 200, { ok: true, channel }),
    documentIntake: documentIntakeHandlers,
    ai: {},
    harness: harnessRuntime.handlers,
    flash: {
      ...flashHttpHandlers
    },
    twin: {
      ...twinResourceHttpHandlers
    },
    company: companyHttp.handlers
  }
}));

const wss = new WebSocket.Server({ server, path: wsPath });
const databaseNotifier = createDatabaseNotifier({
  wss,
  channel,
  workflowChannel,
  enableWorkflowAutoTransition,
  pgConfig: createAgentDatabaseConfig(),
  log: console
});

function extractToken(req) {
  const header = req.headers['sec-websocket-protocol'];
  if (!header) return '';
  const items = String(header)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (items.length === 0) return '';
  const bearer = items.find((v) => v.toLowerCase().startsWith('bearer '));
  if (bearer) return bearer.slice(7).trim();
  return items[items.length - 1] || '';
}

function verifyToken(token) {
  if (!token || !jwtSecret) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch (e) {
    return null;
  }
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeRelativeAgentPath(value) {
  const raw = String(value || '').replace(/\\/g, '/').trim();
  if (!raw || raw.startsWith('/')) return '';
  const normalized = path.posix.normalize(raw).replace(/^\.\/+/, '');
  if (!normalized || normalized === '.') return '';
  if (normalized.startsWith('../') || normalized.includes('/../')) return '';
  return normalized;
}

function normalizeProjectPath(value) {
  const normalized = normalizeRelativeAgentPath(value);
  return normalized.replace(/\/+$/, '');
}

function sanitizeQueryParams(query = {}) {
  const out = {};
  if (!query || typeof query !== 'object') return out;
  for (const [key, value] of Object.entries(query)) {
    const k = String(key || '').trim();
    if (!k) continue;
    if (value === undefined || value === null) continue;
    out[k] = String(value);
  }
  return out;
}

function sanitizePathToken(value, fallback = 'default') {
  const raw = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!raw) return fallback;
  return raw.slice(0, 64);
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  wss.clients.forEach((client) => client.close());
  const closeServer = new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([
    closeServer,
    databaseNotifier.shutdown(),
    documentParseWorker ? documentParseWorker.shutdown() : Promise.resolve(),
    documentPlanWorker ? documentPlanWorker.shutdown() : Promise.resolve(),
    documentEntryWorker ? documentEntryWorker.shutdown() : Promise.resolve(),
    documentFixedEntryWorker ? documentFixedEntryWorker.shutdown() : Promise.resolve()
  ]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, () => {
  databaseNotifier.start();
  documentParseWorker.start();
  documentPlanWorker.start();
  documentEntryWorker.start();
  documentFixedEntryWorker.start();
});

attachWebSocketServer({
  wss,
  extractToken,
  verifyToken,
  asUser,
  hasHarnessTenantContext,
  channel,
  normalizeStringList,
  handleFlashToolCallWs,
  handleFlashHarnessTaskWs,
  handleFlashHarnessResetWs,
  sendWsJson
});
