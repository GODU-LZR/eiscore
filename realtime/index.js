// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const path = require('path');
const { createDocumentIntakeHandlers } = require('./document-intake');
const { createDocumentParseWorker } = require('./document-parser');
const { createDocumentPlanWorker } = require('./document-planner');
const { createDocumentEntryWorker } = require('./document-entry');
const { createDocumentFixedEntryWorker } = require('./document-fixed-entry');
const { createHttpRequestHandler } = require('./http-router');
const { createTwinResourceHttpHandlers } = require('./twin-resource-http');
const { createAiHttpHandlers } = require('./ai-http');
const { createAiChatHttpHandler } = require('./ai-chat-http');
const { createFlashHttpHandlers } = require('./flash-http');
const { createTwinChatHttpHandler } = require('./twin-chat-http');
const { attachWebSocketServer } = require('./websocket-server');
const { createAgentTaskService } = require('./agent-task-service');
const { createAgentAccessService } = require('./agent-access-service');
const { createDatabaseNotifier } = require('./database-notifier');
const { createAiRuntimeService } = require('./ai-runtime-service');
const { createAiOcrService } = require('./ai-ocr-service');
const { createAiOutputGuard } = require('./ai-output-guard');
const { createAiContextService } = require('./ai-context-service');
const {
  buildAgentCatalog,
  cleanModelText,
  composeAgentMessages,
  extractCompletionText,
  extractStreamDeltaText,
  normalizeAiText,
  normalizeToolsWhitelist,
  resolveAgentRoute,
  resolveAgentRuntimeConfig,
  sanitizeConversationMessages
} = require('./ai-agent-policy');
const { FlashToolError, createFlashPostgrestAdapter } = require('./flash-postgrest-adapter');
const { createFlashToolRegistry } = require('./flash-tool-registry');
const { createFlashToolService } = require('./flash-tool-service');
const { createFlashSemanticExecutor } = require('./flash-semantic-executor');
const { createFlashClineRuntime } = require('./flash-cline-runtime');
const { createFlashClineService } = require('./flash-cline-service');
const { loadFlashClineConfig } = require('./flash-cline-config');
const { createFlashWorkspaceService } = require('./flash-workspace-service');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

const port = Number(process.env.PORT || 8078);
const wsPath = envText(process.env.WS_PATH, '/ws') || '/ws';
const rawChannel = envText(process.env.CHANNEL, 'eis_events') || 'eis_events';
const channel = /^[a-zA-Z0-9_]+$/.test(rawChannel) ? rawChannel : 'eis_events';
const workflowChannel = 'workflow_event';
const enableWorkflowAutoTransition = envText(process.env.WORKFLOW_AUTO_TRANSITION, '0') === '1';
const jwtSecret = envText(process.env.PGRST_JWT_SECRET, envText(process.env.JWT_SECRET, ''));
const aiConfigKey = envText(process.env.AI_CONFIG_KEY, 'ai_glm_config') || 'ai_glm_config';
const aiVisionConfigKey = envText(process.env.AI_VISION_CONFIG_KEY, 'ai_vision_config') || 'ai_vision_config';
const aiConfigTtlMs = Number(process.env.AI_CONFIG_TTL_MS || 30 * 1000);
const aiUpstreamTimeoutMs = Number(process.env.AI_UPSTREAM_TIMEOUT_MS || 120 * 1000);
const aiHttpProxyUrl = envText(
  process.env.AI_HTTP_PROXY_URL,
  envText(process.env.HTTPS_PROXY, envText(process.env.HTTP_PROXY, ''))
);
const postgrestBaseUrl = envText(process.env.AGENT_POSTGREST_URL, 'http://api:3000').replace(/\/+$/, '');
const postgrestUserRole = envText(
  process.env.AGENT_POSTGREST_ROLE,
  envText(process.env.PGRST_DB_USER_ROLE, 'web_user')
) || 'web_user';
const flashToolCallTimeoutMs = Number(process.env.FLASH_TOOL_CALL_TIMEOUT_MS || 30 * 1000);
const flashToolIdempotencyTtlMs = Number(process.env.FLASH_TOOL_IDEMPOTENCY_TTL_MS || 10 * 60 * 1000);
const flashClineConfig = loadFlashClineConfig({ port });
const {
  enabled: flashCliEnabled,
  command: flashCliCommand,
  projectPath: flashCliProjectPath,
  workdirConfigured: flashCliWorkdirConfigured,
  configRoot: flashCliConfigRoot,
  taskTimeoutMs: flashCliTaskTimeoutMs,
  authTimeoutMs: flashCliAuthTimeoutMs,
  provider: flashCliProvider,
  historyLimit: flashCliHistoryLimit,
  buildValidateEnabled: flashCliBuildValidateEnabled,
  buildWorkdirConfigured: flashCliBuildWorkdirConfigured,
  buildTimeoutMs: flashCliBuildTimeoutMs,
  installTimeoutMs: flashCliInstallTimeoutMs,
  selfHealMaxRounds: flashCliSelfHealMaxRounds,
  autoInstallDeps: flashCliAutoInstallDeps,
  draftFileName: flashDraftFileName,
  attachmentDirName: flashAttachmentDirName,
  attachmentMaxBytes: flashAttachmentMaxBytes,
  attachmentPreviewMaxChars: flashAttachmentPreviewMaxChars,
  semanticCliScript: flashSemanticCliScript,
  agentBaseUrl: flashAgentBaseUrl
} = flashClineConfig;

const agentAccessService = createAgentAccessService({
  normalizeProjectPath,
  normalizeRelativeAgentPath,
  normalizeText: normalizeAiText,
  cleanModelText,
  extractCompletionText,
  callAiUpstreamWithRetry: (...args) => callAiUpstreamWithRetry(...args)
});
const {
  canUseAgent,
  createAgentTaskAiInvoker,
  isAllowedProject,
  logAgentEvent,
  normalizeAgentTaskErrorMessage,
  resolveDefaultWritePolicy,
  sanitizeWritePolicy
} = agentAccessService;

const flashWorkspaceService = createFlashWorkspaceService({
  projectPath: flashCliProjectPath,
  workdirConfigured: flashCliWorkdirConfigured,
  draftFileName: flashDraftFileName,
  attachmentDirName: flashAttachmentDirName,
  attachmentMaxBytes: flashAttachmentMaxBytes,
  attachmentPreviewMaxChars: flashAttachmentPreviewMaxChars,
  moduleRoot: __dirname,
  normalizeText: normalizeAiText,
  normalizeProjectPath,
  sanitizePathToken,
  FlashToolError,
  logAgentEvent
});
const {
  ensureDir,
  hasFingerprintChanged: hasFlashFingerprintChanged,
  normalizeAppId: normalizeFlashAppId,
  readDraftFingerprintsSafe: readFlashDraftFingerprintsSafe,
  readDraftSource: readFlashDraftSource,
  requireNonEmptyText,
  resolveWorkdir: resolveFlashCliWorkdir,
  sanitizeUploadFileName,
  syncPreviewDraftToScoped,
  syncScopedDraftToPreview,
  uploadAttachment: uploadFlashAttachment,
  writeDraftSource: writeFlashDraftSource
} = flashWorkspaceService;

// In proxy-based environments, Node fetch reads proxy vars when this flag is enabled.
if (!process.env.NODE_USE_ENV_PROXY) {
  process.env.NODE_USE_ENV_PROXY = '1';
}

let shuttingDown = false;

const flashToolRegistry = createFlashToolRegistry();
const {
  getFlashToolDefinition,
  getFlashToolRegistryPayload,
  registryCount: flashSemanticToolRegistryCount,
  registryVersion: flashSemanticToolRegistryVersion,
  resolveFlashToolId
} = flashToolRegistry;

const flashToolService = createFlashToolService({
  idempotencyTtlMs: flashToolIdempotencyTtlMs,
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
  const rawPath = String(req?.url || '/').split('?')[0] || '/';
  if (rawPath === '/agent') return '/';
  if (rawPath.startsWith('/agent/')) return rawPath.slice('/agent'.length);
  return rawPath;
};

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
  permissions: Array.isArray(payload?.permissions) ? payload.permissions.map((p) => String(p)) : [],
  token: token || ''
});

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

const aiAllowedRoles = normalizeStringList(process.env.AI_ALLOWED_ROLES || '').map((role) => String(role).toLowerCase());
const aiAllowAll = String(process.env.AI_ALLOW_ALL || 'true').toLowerCase() !== 'false';

const canUseAi = (user) => {
  if (aiAllowAll) return true;
  if (aiAllowedRoles.length === 0) return true;
  const role = String(user?.role || '').toLowerCase();
  return aiAllowedRoles.includes(role);
};

const aiRuntimeService = createAiRuntimeService({
  queryConfig: (...args) => databaseNotifier.query(...args),
  configKey: aiConfigKey,
  visionConfigKey: aiVisionConfigKey,
  configTtlMs: aiConfigTtlMs,
  upstreamTimeoutMs: aiUpstreamTimeoutMs,
  proxyUrl: aiHttpProxyUrl,
  normalizeText: normalizeAiText,
  normalizeToolsWhitelist,
  log: console
});
const {
  getAiConfig,
  getAiVisionConfig,
  callAiUpstreamWithRetry,
  callAiVisionUpstreamWithRetry,
  iterateAiStreamChunks,
  waitMs
} = aiRuntimeService;

const aiOcrService = createAiOcrService({
  getAiVisionConfig,
  callAiVisionUpstreamWithRetry,
  normalizeText: normalizeAiText,
  cleanModelText,
  extractCompletionText
});
const {
  runImageOcr,
  enrichMessagesWithOcr
} = aiOcrService;

const aiOutputGuard = createAiOutputGuard({
  normalizeText: normalizeAiText,
  callAiUpstreamWithRetry,
  cleanModelText,
  extractCompletionText
});
const {
  shouldApplyEnterpriseOutputGuard,
  applyEnterpriseOutputGuard
} = aiOutputGuard;

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

const flashPostgrestAdapter = createFlashPostgrestAdapter({
  baseUrl: postgrestBaseUrl,
  userRole: postgrestUserRole,
  jwtSecret,
  toolCallTimeoutMs: flashToolCallTimeoutMs,
  signJwt: (...args) => jwt.sign(...args),
  fetchImpl: (...args) => fetch(...args),
  sanitizeQueryParams,
  parseJson: parseJsonMaybe,
  normalizeText: normalizeAiText,
  wait: waitMs
});
const {
  bindPgQueryForUser,
  callPostgrestWithFlashTableEnsure,
  callPostgrestWithUser,
  inferFlashDataColumnsFromPayload,
  resolveDataTableTarget
} = flashPostgrestAdapter;

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

const flashClineRuntime = createFlashClineRuntime({
  command: flashCliCommand,
  projectPath: flashCliProjectPath,
  buildWorkdirConfigured: flashCliBuildWorkdirConfigured,
  taskTimeoutMs: flashCliTaskTimeoutMs,
  buildTimeoutMs: flashCliBuildTimeoutMs,
  installTimeoutMs: flashCliInstallTimeoutMs,
  selfHealMaxRounds: flashCliSelfHealMaxRounds,
  autoInstallDeps: flashCliAutoInstallDeps,
  historyLimit: flashCliHistoryLimit,
  attachmentPreviewMaxChars: flashAttachmentPreviewMaxChars,
  agentBaseUrl: flashAgentBaseUrl,
  semanticCliScript: flashSemanticCliScript,
  httpProxyUrl: aiHttpProxyUrl,
  buildValidateEnabled: flashCliBuildValidateEnabled,
  normalizeText: normalizeAiText,
  normalizeProjectPath,
  normalizeRelativeAgentPath,
  sanitizeUploadFileName,
  parseJsonMaybe,
  sendWsJson
});
flashClineRuntime.ensureBashCompat();
const {
  buildFlashCliArgs,
  buildFlashCliEnv,
  buildFlashCliPrompt,
  clampFlashHistory,
  deriveOpenAiBaseUrl,
  normalizeFlashAttachmentList,
  normalizeFlashCliError,
  parseClineRetryMessage,
  resolveClineBin,
  runFlashBuildSelfHeal,
  runSpawnCapture,
  shouldForwardClineSay
} = flashClineRuntime;

const writeSsePayload = (res, payload) => {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};

const writeSseDone = (res) => {
  if (!res.writableEnded) {
    res.write('data: [DONE]\n\n');
    res.end();
  }
};

const streamTextAsSse = (res, text, chunkSize = 800) => {
  const output = normalizeAiText(text);
  if (!output) {
    writeSseDone(res);
    return;
  }
  for (let start = 0; start < output.length; start += chunkSize) {
    const chunk = output.slice(start, start + chunkSize);
    writeSsePayload(res, { choices: [{ delta: { content: chunk } }] });
  }
  writeSseDone(res);
};

const authorizeHttpRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload, token);
  if (!canUseAi(user)) {
    sendJson(res, 403, { code: 'FORBIDDEN', message: 'AI access denied for current role' });
    return null;
  }
  return user;
};

const aiContextService = createAiContextService({
  callPostgrestWithUser
});
const {
  fetchSemanticContext,
  safeFetchBusinessSnapshot
} = aiContextService;

const aiHttpHandlers = createAiHttpHandlers({
  authorizeHttpRequest,
  getAiConfig,
  getAiVisionConfig,
  buildAgentCatalog,
  safeFetchBusinessSnapshot,
  readJsonBody,
  normalizeAiText,
  callAiUpstreamWithRetry,
  callAiVisionUpstreamWithRetry,
  runImageOcr,
  cleanModelText,
  extractCompletionText,
  sendJson
});

const handleAiChat = createAiChatHttpHandler({
  authorizeHttpRequest,
  readJsonBody,
  sendJson,
  getAiConfig,
  sanitizeConversationMessages,
  enrichMessagesWithOcr,
  resolveAgentRoute,
  fetchSemanticContext,
  safeFetchBusinessSnapshot,
  resolveAgentRuntimeConfig,
  shouldApplyEnterpriseOutputGuard,
  composeAgentMessages,
  callAiUpstreamWithRetry,
  applyEnterpriseOutputGuard,
  setCorsHeaders,
  streamTextAsSse,
  extractCompletionText
});


const authorizeAgentHttpRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload);
  if (!canUseAgent(user)) {
    sendJson(res, 403, { code: 'FORBIDDEN', message: 'Agent access denied for current role' });
    return null;
  }
  user.token = token;
  return user;
};

const handleFlashToolCallWs = async (ws, payload) => {
  if (!canUseAgent(ws.user)) {
    sendWsJson(ws, {
      type: 'flash:tool_result',
      ok: false,
      code: 'PERMISSION_DENIED',
      message: 'Forbidden: agent access denied'
    });
    return;
  }
  const requestId = String(payload?.requestId || payload?.request_id || '').trim();
  const body = payload?.payload && typeof payload.payload === 'object' ? payload.payload : payload;
  const result = await executeFlashToolCall(ws.user, body, 'ws');
  sendWsJson(ws, {
    type: 'flash:tool_result',
    requestId,
    ...result.payload
  });
};

const flashHttpHandlers = createFlashHttpHandlers({
  authorizeAgentHttpRequest,
  getFlashToolRegistryPayload,
  readJsonBody,
  executeFlashToolCall,
  readFlashDraftSource,
  writeFlashDraftSource,
  uploadFlashAttachment,
  resolveFlashToolErrorStatus: (error) => error instanceof FlashToolError ? error.httpStatus : 500,
  flashAttachmentMaxBytes,
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
  return asUser(payload, token);
};

const authorizeDocumentIntakeAdminRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  return asUser(payload, token);
};

const handleTwinChat = createTwinChatHttpHandler({
  authorizeTwinRequest,
  readJsonBody,
  normalizeAiText,
  sendJson,
  getAiConfig,
  bindPgQueryForUser,
  fetchSemanticContext,
  callAiUpstreamWithRetry,
  setCorsHeaders,
  extractCompletionText,
  waitMs,
  writeSsePayload,
  iterateAiStreamChunks,
  extractStreamDeltaText,
  writeSseDone,
  aiUpstreamTimeoutMs
});

const twinResourceHttpHandlers = createTwinResourceHttpHandlers({
  authorizeTwinRequest,
  bindPgQueryForUser,
  readJsonBody,
  sendJson,
  port
});

const server = http.createServer(createHttpRequestHandler({
  getRequestPath,
  setCorsHeaders,
  authorizers: {
    documentIntakeAdmin: authorizeDocumentIntakeAdminRequest
  },
  handlers: {
    health: (_req, res) => sendJson(res, 200, { ok: true, channel }),
    documentIntake: documentIntakeHandlers,
    ai: {
      ...aiHttpHandlers,
      handleChat: handleAiChat
    },
    flash: {
      ...flashHttpHandlers
    },
    twin: {
      handleChat: handleTwinChat,
      ...twinResourceHttpHandlers
    }
  }
}));

const wss = new WebSocket.Server({ server, path: wsPath });
const databaseNotifier = createDatabaseNotifier({
  wss,
  channel,
  workflowChannel,
  enableWorkflowAutoTransition,
  pgConfig: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres'
  },
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

const agentTaskService = createAgentTaskService({
  canUseAgent,
  logAgentEvent,
  normalizeProjectPath,
  isAllowedProject,
  getAiConfig,
  sanitizeWritePolicy,
  resolveDefaultWritePolicy,
  createAgentTaskAiInvoker,
  normalizeAgentTaskErrorMessage
});

const flashClineService = createFlashClineService({
  enabled: flashCliEnabled,
  nodeVersion: process.versions.node,
  projectPath: flashCliProjectPath,
  configRoot: flashCliConfigRoot,
  taskTimeoutMs: flashCliTaskTimeoutMs,
  authTimeoutMs: flashCliAuthTimeoutMs,
  provider: flashCliProvider,
  registryVersion: flashSemanticToolRegistryVersion,
  registryCount: flashSemanticToolRegistryCount,
  runtime: flashClineRuntime,
  normalizeText: normalizeAiText,
  normalizeAppId: normalizeFlashAppId,
  normalizeProjectPath,
  isAllowedProject,
  canUseAgent,
  getAiConfig,
  resolveTaskWorkdir: resolveFlashCliWorkdir,
  ensureDir,
  syncScopedDraftToPreview,
  readDraftFingerprintsSafe: readFlashDraftFingerprintsSafe,
  syncPreviewDraftToScoped,
  hasFingerprintChanged: hasFlashFingerprintChanged,
  sendWsJson,
  logAgentEvent
});
const {
  createFlashCliSession,
  killFlashCliSessionProcess,
  runFlashClineTask
} = flashClineService;

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
  channel,
  normalizeStringList,
  handleFlashToolCallWs,
  runFlashClineTask,
  killFlashCliSessionProcess,
  sendWsJson,
  createFlashCliSession,
  agentTaskService
});
