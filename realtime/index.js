const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const path = require('path');
// Document intake/workers create PostgreSQL pools at module load. Keep these
// requires behind the business-profile boundary so Flash never initializes a
// database-backed document runtime just by starting its process.
const { createHttpRequestHandler, normalizeAgentRequestPath, FLASH_HTTP_ROUTE_MANIFEST, BUSINESS_HTTP_ROUTE_MANIFEST } = require('./http-router');
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
const { createFlashSemanticExecutor, BUSINESS_WORKFLOW_TOOL_IDS } = require('./flash-semantic-executor');
const { loadFlashWorkspaceConfig } = require('./flash-workspace-config');
const { createFlashWorkspaceService } = require('./flash-workspace-service');
const { createAgentDatabaseConfig } = require('./database-config');
const { createHarnessRuntime } = require('./harness-runtime');
const { createHarnessSalesWriteExecutor } = require('./harness-sales-write');
const { createHarnessCustomerRecordsExecutor } = require('./customer-records');
const { createCustomerFileUploadHandler } = require('./customer-files-upload');
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
const runtimeProfile = envText(process.env.RUNTIME_PROFILE, 'business').toLowerCase() || 'business';
const flashRuntime = runtimeProfile === 'flash';
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
const asUser = (payload, token) => {
  const role = payload?.app_role || payload?.role || '';
  const permissions = Array.isArray(payload?.permissions) ? payload.permissions.map((p) => String(p)) : [];
  // The platform treats super_admin as a wildcard role. Keep the JWT compact
  // while preserving that established authorization contract for Harness.
  if (String(role).trim().toLowerCase() === 'super_admin' && !permissions.includes('*')) permissions.push('*');
  return {
    id: payload?.user_id || payload?.sub || payload?.username || payload?.email || '',
    username: payload?.username || '',
    role,
    tenant_id: payload?.tenant_id || payload?.tenantId || payload?.tenant || payload?.org_id || payload?.organization_id || '',
    permissions,
    token: token || ''
  };
};

const hasHarnessTenantContext = (user = {}) => Boolean(
  String(user.id || user.sub || user.username || '').trim()
  && String(user.tenant_id || user.tenantId || user.tenant || user.org_id || user.organization_id || '').trim()
  && String(user.token || '').trim()
);
const hasTwinAdminAccess = (user = {}) => String(user.role || '').trim().toLowerCase() === 'super_admin';

const authorizeTwinAdminRequest = (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return null;
  if (!hasTwinAdminAccess(user)) {
    sendJson(res, 403, { code: 'FORBIDDEN', message: 'Super administrator access is required' });
    return null;
  }
  return user;
};

// Keep the admin read audit in the existing durable agent audit ledger. The
// function is invoked only after startup, once databaseNotifier is mounted.
async function auditTwinAdminView(toolId, user, details = {}) {
  await databaseNotifier.query(
    `INSERT INTO company_site.agent_audit_events
      (site_key, trace_id, actor_type, actor_id, tool_id, input_hash, result_code, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    ['primary', `twin_admin_${Date.now()}`, 'employee', user?.id || user?.username || '', toolId, '', 'OK', JSON.stringify(details)]
  );
}

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

const documentModules = flashRuntime ? null : {
  createDocumentIntakeHandlers: require('./document-intake').createDocumentIntakeHandlers,
  createDocumentParseWorker: require('./document-parser').createDocumentParseWorker,
  createDocumentPlanWorker: require('./document-planner').createDocumentPlanWorker,
  createDocumentEntryWorker: require('./document-entry').createDocumentEntryWorker,
  createDocumentFixedEntryWorker: require('./document-fixed-entry').createDocumentFixedEntryWorker
};
const documentIntakeHandlers = flashRuntime ? {} : documentModules.createDocumentIntakeHandlers({ sendJson, readJsonBody });
const documentParseWorker = flashRuntime ? null : documentModules.createDocumentParseWorker({ log: console });
const documentPlanWorker = flashRuntime ? null : documentModules.createDocumentPlanWorker({ log: console });
const documentEntryWorker = flashRuntime ? null : documentModules.createDocumentEntryWorker({ log: console });
const documentFixedEntryWorker = flashRuntime ? null : documentModules.createDocumentFixedEntryWorker({ log: console });
let companySalesHandlers = flashRuntime ? {} : null;

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
const aiContextService = flashRuntime ? null : createAiContextService({ callPostgrestWithUser, log: console });

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
const businessWorkflowSemanticExecutor = createFlashSemanticExecutor({
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
  writeFlashDraftSource,
  allowedToolIds: BUSINESS_WORKFLOW_TOOL_IDS
});
const { executeFlashSemanticTool } = flashSemanticExecutor;
const { executeFlashSemanticTool: executeBusinessWorkflowTool } = businessWorkflowSemanticExecutor;

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

const notifyCustomerRealtime = (userId, tenantId, event) => {
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (String(client.user?.id || '') !== userId || String(client.user?.tenant_id || '') !== tenantId) return;
    sendWsJson(client, event);
  });
};

const customerRecords = flashRuntime ? null : createHarnessCustomerRecordsExecutor({
  callPostgrestWithUser,
  fetchSemanticContext: (user) => aiContextService.fetchSemanticContext(user),
  notifyCustomerRecordUpdated: ({ userId, tenantId, customerId, operation }) => {
    notifyCustomerRealtime(userId, tenantId, {
      type: 'customer_record_updated',
      customer_id: customerId,
      operation,
      ts: new Date().toISOString()
    });
  },
  notifyCustomerFilesUpdated: ({ userId, tenantId, customerId }) => {
    notifyCustomerRealtime(userId, tenantId, {
      type: 'customer_files_updated',
      customer_id: customerId,
      ts: new Date().toISOString()
    });
  }
});
const executeCustomerQuery = customerRecords?.execute
  ? (user, payload = {}, request = {}) => customerRecords.execute(user, { ...payload, operation: 'query' }, request)
  : null;
const executeCustomerWrite = customerRecords?.execute
  ? (user, payload = {}, request = {}) => customerRecords.execute(user, payload, request)
  : null;
const customerFileUploadHandlers = flashRuntime ? { disabled: true } : createCustomerFileUploadHandler({
  authorize: authorizeHttpRequest,
  sendJson,
  callPostgrestWithUser,
  fetchSemanticContext: (user) => aiContextService.fetchSemanticContext(user)
});

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

// Placeholder - will be initialized after harnessRuntime is created
let handleFlashToolCallWs;

const flashHttpHandlers = createFlashHttpHandlers({
  authorizeAgentHttpRequest,
  authorizeFlashTool: (...args) => flashAuthorization.authorizeFlashTool(...args),
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
const executeDigitalTwinContext = flashRuntime ? null : createHarnessTwinContextExecutor({
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
const executeSalesWrite = flashRuntime ? null : createHarnessSalesWriteExecutor({ getHandlers: () => companySalesHandlers });
const publicSiteSalesUser = Object.freeze({
  id: envText(process.env.COMPANY_SITE_HARNESS_SUBJECT, 'public-site-sales'),
  tenant_id: envText(process.env.COMPANY_SITE_HARNESS_TENANT, 'public-site'),
  token: envText(process.env.COMPANY_SITE_HARNESS_TOKEN, `public-site-sales:${process.pid}:${Date.now()}`),
  permissions: ['site:sales']
});
const harnessRuntime = createHarnessRuntime({ authorizeHttpRequest, authorizeTwinRequest, readJsonBody, sendJson, setCorsHeaders, streamTextAsSse, executeFlashToolCall, executeWorkflowToolCall: flashRuntime ? null : async (user, payload = {}, source = '') => executeBusinessWorkflowTool(payload.tool_id || payload.toolId, payload.arguments || payload.args || {}, user, { traceId: payload.trace_id || payload.traceId, appId: payload.app_id || payload.appId, context: payload.context || {}, source }), executeEnterpriseSnapshot: flashRuntime ? null : (user, options = {}) => aiContextService.fetchBusinessSnapshot(user, options.accessContext), executeDigitalTwinContext, executeDocumentPlan: flashRuntime ? null : executeDocumentPlan, executeSalesWrite, executeCustomerQuery, executeCustomerWrite, executeSiteSales: flashRuntime ? null : async (_user, payload = {}) => {
  const view = envText(payload?.view || payload?.view_id, 'site');
  const locale = envText(payload?.locale, 'zh-CN');
  if (!['site', 'catalog', 'knowledge'].includes(view)) {
    const error = new Error('Harness context view is unavailable');
    error.code = 'HARNESS_CONTEXT_INVALID';
    error.httpStatus = 400;
    throw error;
  }

  let result;
  if (view === 'site') {
    // Expose the published public snapshot only; unpublished/internal settings stay in the BFF.
    result = await companyQuery(
      `SELECT published.site_key, published.legal_name, published.brand_name,
              published.brand_short_name, published.factory_name, published.domain,
              published.template_key, published.default_locale,
              published.enabled_locales, published.theme, published.contact,
              published.social_links, published.trademark, published.seo,
              published.status, published.published_version, published.published_at
         FROM company_site.site_config c
        CROSS JOIN LATERAL jsonb_populate_record(
          NULL::company_site.site_config,
          CASE
            WHEN c.status = 'published' THEN to_jsonb(c) - 'published_snapshot'
            ELSE c.published_snapshot
          END
        ) AS published
        WHERE c.site_key = $1
          AND (c.status = 'published' OR c.status = 'draft')
          AND published.status = 'published'
        LIMIT 1`,
      ['primary']
    );
  } else if (view === 'catalog') {
    result = await companyQuery(
      `SELECT p.id, p.product_code, p.slug, p.category, p.applications,
              p.specifications, p.delivery, pl.locale, pl.name,
              pl.summary, pl.description, pl.image_urls, pl.seo, pl.faq
         FROM company_site.products p
         JOIN company_site.product_locales pl
           ON pl.product_id = p.id
          AND pl.status = 'published'
          AND pl.locale = ANY($2::text[])
        WHERE p.site_key = $1
          AND p.status = 'published'
        ORDER BY array_position($2::text[], pl.locale), p.product_code
        LIMIT 100`,
      ['primary', locale === 'zh-CN' ? ['zh-CN'] : [locale, 'zh-CN']]
    );
  } else {
    result = await companyQuery(
      `SELECT id, locale, document_type, title, content, citations,
              forbidden_claims, version, updated_at
         FROM company_site.knowledge_documents
        WHERE site_key = $1
          AND status = 'published'
          AND locale = ANY($2::text[])
        ORDER BY updated_at DESC
        LIMIT 30`,
      ['primary', locale === 'zh-CN' ? ['zh-CN'] : [locale, 'zh-CN']]
    );
  }
  return { context: 'site_sales', view, data: { [view === 'site' ? 'site' : view === 'catalog' ? 'products' : 'knowledge']: Array.isArray(result?.rows) ? result.rows : [] } };
}, documentEntryWorker, documentFixedEntryWorker, createTwinPersistence: flashRuntime ? null : (user) => createPersistence(bindPgQueryForUser(user), user.username || user.id), callPostgrestWithUser, fetchSemanticContext: (user) => aiContextService.fetchSemanticContext(user), envText });

// Now initialize handleFlashToolCallWs after harnessRuntime is available
handleFlashToolCallWs = createHarnessFlashToolCallHandler({
  execute: (...args) => harnessRuntime.toolGateway.execute(...args),
  getToolDefinition: flashToolRegistry.getFlashToolDefinition,
  resolveToolId: flashToolRegistry.resolveFlashToolId,
  sendWsJson,
  enabled: harnessRuntime.enabled
});

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
  authorizeTwinAdminRequest,
  bindPgQueryForUser,
  readJsonBody,
  sendJson,
  port,
  audit: (toolId, user, details) => auditTwinAdminView(toolId, user, details)
});

const companyQuery = (...args) => databaseNotifier.query(...args);
const companySiteHandlers = flashRuntime
  ? { disabled: true }
  : createCompanySiteHandlers({ query: companyQuery, sendJson, sendText, readJsonBody });
companySalesHandlers = flashRuntime ? { disabled: true } : createCompanySalesHandlers({
  query: companyQuery,
  sendJson,
  readJsonBody,
  streamTextAsSse,
  executeHarness: async ({ session, sessionId, message, history = [], requestId, signal }) => {
    if (!harnessRuntime.enabled) return { ok: false, status: 503, code: 'HARNESS_DISABLED' };
    return harnessRuntime.gateway.execute({
      kind: 'chat',
      request_id: requestId,
      session_id: sessionId,
      plugin_id: 'independent-site-sales',
      agent_id: 'site_sales',
      capability_id: 'eiscore_site_sales',
      user: publicSiteSalesUser,
      signal,
      payload: {
        messages: [...history, { role: 'user', content: message }],
        stream: false,
        context: { source: 'public_company_site', locale: session?.locale || 'zh-CN' }
      }
    });
  }
});
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
  routes: flashRuntime ? FLASH_HTTP_ROUTE_MANIFEST : BUSINESS_HTTP_ROUTE_MANIFEST,
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
    customerFiles: customerFileUploadHandlers,
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
const databaseNotifier = flashRuntime
  ? {
    start: () => {},
    shutdown: async () => {},
    query: () => { throw new Error('Database notifier is unavailable in Flash runtime'); }
  }
  : createDatabaseNotifier({
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
  if (!flashRuntime) {
    documentParseWorker.start();
    documentPlanWorker.start();
    documentEntryWorker.start();
    documentFixedEntryWorker.start();
  }
});

attachWebSocketServer({
  wss,
  extractToken,
  verifyToken,
  asUser,
  hasHarnessTenantContext,
  channel,
  runtimeProfile,
  normalizeStringList,
  handleFlashToolCallWs,
  handleFlashHarnessTaskWs,
  handleFlashHarnessResetWs,
  sendWsJson
});
