// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
let activeFlashDraftAppId = '';

const resolveFlashCliWorkdir = () => {
  const candidates = [
    flashCliWorkdirConfigured,
    path.resolve(process.cwd(), '..', flashCliProjectPath),
    path.resolve(__dirname, '..', flashCliProjectPath),
    path.resolve(process.cwd(), flashCliProjectPath)
  ]
    .map((item) => envText(item, ''))
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return candidates[0] || flashCliWorkdirConfigured;
};


const resolveFlashDraftFilePath = () => {
  const workdir = resolveFlashCliWorkdir();
  const file = flashDraftFileName || 'FlashDraft.vue';
  const resolved = path.resolve(workdir, file);
  const normalizedWorkdir = path.resolve(workdir);
  if (!resolved.startsWith(normalizedWorkdir + path.sep) && resolved !== path.join(normalizedWorkdir, file)) {
    throw new Error('Flash draft path escapes workdir');
  }
  return resolved;
};

const normalizeFlashAppId = (value) => sanitizePathToken(value, '');

const resolveFlashScopedDraftFilePath = (appId) => {
  const normalizedAppId = normalizeFlashAppId(appId);
  if (!normalizedAppId) return '';
  const workdir = resolveFlashCliWorkdir();
  const baseDir = path.resolve(workdir, '.app-drafts');
  const resolved = path.resolve(baseDir, `${normalizedAppId}.vue`);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new Error('Flash scoped draft path escapes workdir');
  }
  return resolved;
};

const syncScopedDraftToPreview = async (appId) => {
  const scopedPath = resolveFlashScopedDraftFilePath(appId);
  if (!scopedPath || !fs.existsSync(scopedPath)) return false;
  const previewPath = resolveFlashDraftFilePath();
  await ensureDir(path.dirname(previewPath));
  await fs.promises.copyFile(scopedPath, previewPath);
  activeFlashDraftAppId = normalizeFlashAppId(appId);
  return true;
};

const readFlashFileFingerprintSafe = async (target, appId = '') => {
  try {
    if (!target) return null;
    const stat = await fs.promises.stat(target);
    if (!stat?.isFile?.()) return null;
    const buffer = await fs.promises.readFile(target);
    return {
      appId: normalizeFlashAppId(appId),
      path: target,
      bytes: Number(stat.size || 0),
      mtimeMs: Number(stat.mtimeMs || 0),
      sha1: crypto.createHash('sha1').update(buffer).digest('hex')
    };
  } catch {
    return null;
  }
};

const readFlashDraftFingerprintSafe = async (appId = '') => {
  const normalizedAppId = normalizeFlashAppId(appId);
  const scopedTarget = normalizedAppId ? resolveFlashScopedDraftFilePath(normalizedAppId) : '';
  const target = scopedTarget && fs.existsSync(scopedTarget) ? scopedTarget : resolveFlashDraftFilePath();
  return readFlashFileFingerprintSafe(target, normalizedAppId);
};

const readFlashDraftFingerprintsSafe = async (appId = '') => {
  const normalizedAppId = normalizeFlashAppId(appId);
  const previewPath = resolveFlashDraftFilePath();
  const scopedPath = normalizedAppId ? resolveFlashScopedDraftFilePath(normalizedAppId) : '';
  const [preview, scoped] = await Promise.all([
    readFlashFileFingerprintSafe(previewPath, normalizedAppId),
    scopedPath ? readFlashFileFingerprintSafe(scopedPath, normalizedAppId) : Promise.resolve(null)
  ]);
  return { preview, scoped };
};

const hasFlashFingerprintChanged = (before, after) => !!(
  after
  && (
    !before
    || before.sha1 !== after.sha1
    || before.bytes !== after.bytes
    || before.mtimeMs !== after.mtimeMs
  )
);

const syncPreviewDraftToScoped = async (appId) => {
  const normalizedAppId = normalizeFlashAppId(appId);
  if (!normalizedAppId) return false;
  const previewPath = resolveFlashDraftFilePath();
  const scopedPath = resolveFlashScopedDraftFilePath(normalizedAppId);
  if (!fs.existsSync(previewPath)) return false;
  await ensureDir(path.dirname(scopedPath));
  await fs.promises.copyFile(previewPath, scopedPath);
  activeFlashDraftAppId = normalizedAppId;
  return true;
};

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

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
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

function requireNonEmptyText(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    throw new FlashToolError('VALIDATION_FAILED', `${fieldName} is required`, { httpStatus: 400 });
  }
  return text;
}

async function readFlashDraftSource(appId = '') {
  const normalizedAppId = normalizeFlashAppId(appId);
  if (normalizedAppId) {
    await syncScopedDraftToPreview(normalizedAppId);
  }
  const scopedTarget = normalizedAppId ? resolveFlashScopedDraftFilePath(normalizedAppId) : '';
  const target = scopedTarget && fs.existsSync(scopedTarget) ? scopedTarget : resolveFlashDraftFilePath();
  const content = await fs.promises.readFile(target, 'utf8');
  return {
    appId: normalizedAppId,
    activeAppId: activeFlashDraftAppId,
    path: scopedTarget && target === scopedTarget
      ? normalizeProjectPath(`${flashCliProjectPath}/.app-drafts/${normalizedAppId}.vue`)
      : normalizeProjectPath(`${flashCliProjectPath}/${flashDraftFileName}`),
    content,
    bytes: Buffer.byteLength(content, 'utf8')
  };
}

async function writeFlashDraftSource(content, reason = '', user = null, appId = '') {
  const text = String(content || '');
  if (!text.trim()) {
    throw new FlashToolError('VALIDATION_FAILED', 'content is required', { httpStatus: 400 });
  }
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > 1024 * 1024) {
    throw new FlashToolError('VALIDATION_FAILED', 'content exceeds 1MB limit', { httpStatus: 400 });
  }

  const normalizedAppId = normalizeFlashAppId(appId);
  const previewTarget = resolveFlashDraftFilePath();
  const scopedTarget = normalizedAppId ? resolveFlashScopedDraftFilePath(normalizedAppId) : '';
  if (scopedTarget) {
    await ensureDir(path.dirname(scopedTarget));
    await fs.promises.writeFile(scopedTarget, text, 'utf8');
  }
  await ensureDir(path.dirname(previewTarget));
  await fs.promises.writeFile(previewTarget, text, 'utf8');
  if (normalizedAppId) activeFlashDraftAppId = normalizedAppId;
  if (user) {
    logAgentEvent('flash:draft_write', user, {
      bytes,
      appId: normalizedAppId,
      reason: normalizeAiText(reason).slice(0, 80)
    });
  }
  return {
    appId: normalizedAppId,
    activeAppId: activeFlashDraftAppId,
    path: normalizeProjectPath(`${flashCliProjectPath}/${flashDraftFileName}`),
    scopedPath: scopedTarget ? normalizeProjectPath(`${flashCliProjectPath}/.app-drafts/${normalizedAppId}.vue`) : '',
    bytes
  };
}

async function uploadFlashAttachment(body = {}, user = null) {
  const appId = sanitizePathToken(body?.appId, 'app');
  const conversationId = sanitizePathToken(body?.conversationId, 'default');
  const fileName = sanitizeUploadFileName(body?.fileName);
  const mimeType = normalizeAiText(body?.mimeType || body?.contentType).slice(0, 120) || 'application/octet-stream';
  const binary = decodeBase64Payload(body?.contentBase64 || body?.base64);

  if (!binary.length) {
    throw new FlashToolError('VALIDATION_FAILED', 'contentBase64 is required', { httpStatus: 400 });
  }
  if (binary.length > flashAttachmentMaxBytes) {
    throw new FlashToolError('VALIDATION_FAILED', `attachment exceeds ${flashAttachmentMaxBytes} bytes`, { httpStatus: 400 });
  }

  const taskWorkdir = resolveFlashCliWorkdir();
  const targetInfo = buildSafeUploadPath(taskWorkdir, appId, conversationId, fileName);
  await ensureDir(targetInfo.baseDir);

  let finalName = targetInfo.safeName;
  let targetPath = targetInfo.candidate;
  let suffix = 1;
  while (fs.existsSync(targetPath)) {
    const ext = path.extname(targetInfo.safeName);
    const stem = targetInfo.safeName.slice(0, Math.max(1, targetInfo.safeName.length - ext.length));
    finalName = `${stem}-${suffix}${ext}`;
    targetPath = path.resolve(targetInfo.baseDir, finalName);
    suffix += 1;
  }

  await fs.promises.writeFile(targetPath, binary);
  const relativePath = path.relative(path.resolve(taskWorkdir), targetPath).replace(/\\/g, '/');
  const uploadedAt = new Date().toISOString();

  let textPreview = '';
  if (isTextLikeAttachment(finalName, mimeType)) {
    try {
      const utf8 = binary.toString('utf8');
      textPreview = normalizeAiText(utf8).slice(0, flashAttachmentPreviewMaxChars);
    } catch {
      textPreview = '';
    }
  }

  if (user) {
    logAgentEvent('flash:attachment_upload', user, {
      appId,
      conversationId,
      name: finalName,
      mimeType,
      size: binary.length
    });
  }

  return {
    id: `att-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    appId,
    conversationId,
    name: finalName,
    mimeType,
    size: binary.length,
    relativePath,
    textPreview,
    uploadedAt
  };
}

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

function sanitizeUploadFileName(value) {
  const base = path.posix.basename(String(value || '').trim());
  const safe = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 96);
  if (!safe) return `upload-${Date.now()}.bin`;
  return safe;
}

function decodeBase64Payload(value) {
  const raw = String(value || '').trim();
  if (!raw) return Buffer.alloc(0);
  const payload = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  return Buffer.from(payload, 'base64');
}

function isTextLikeAttachment(fileName, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('text/')) return true;
  if (mime.includes('json') || mime.includes('xml') || mime.includes('yaml') || mime.includes('csv')) return true;
  const ext = path.extname(String(fileName || '').toLowerCase());
  const textExt = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm', '.sql', '.js', '.ts', '.vue', '.py']);
  return textExt.has(ext);
}

function buildSafeUploadPath(taskWorkdir, appId, conversationId, fileName) {
  const appPart = sanitizePathToken(appId, 'app');
  const convPart = sanitizePathToken(conversationId, 'default');
  const safeName = sanitizeUploadFileName(fileName);
  const baseDir = path.resolve(taskWorkdir, flashAttachmentDirName, appPart, convPart);
  const candidate = path.resolve(baseDir, safeName);
  const workdirResolved = path.resolve(taskWorkdir);
  if (candidate !== workdirResolved && !candidate.startsWith(`${workdirResolved}${path.sep}`)) {
    throw new Error('Attachment target escapes task workdir');
  }
  return { baseDir, candidate, safeName };
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
