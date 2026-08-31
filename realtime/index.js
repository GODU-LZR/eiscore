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

// ── 轻量本体语义上下文采集 ───────────────────────────────────
const fetchSemanticContext = async (user) => {
  const semantic = {};
  const safeQuery = async (label, opts) => {
    try {
      const result = await callPostgrestWithUser(user, { ...opts, timeoutMs: 5000 });
      return result?.data;
    } catch (e) {
      console.warn(`[semantic-ctx] ${label} failed:`, e?.message || e);
      return null;
    }
  };

  // 1. 表级语义（仅激活的）
  const tables = await safeQuery('table_semantics', {
    method: 'GET', path: '/ontology_table_semantics',
    query: { select: 'table_schema,table_name,semantic_name,semantic_description,tags', is_active: 'eq.true', order: 'table_schema.asc,table_name.asc', limit: '200' },
    acceptProfile: 'public'
  });
  if (Array.isArray(tables) && tables.length) {
    semantic.tables = tables.map(t => ({
      schema: t.table_schema,
      table: t.table_name,
      name: t.semantic_name,
      desc: t.semantic_description || '',
      tags: t.tags || []
    }));
  }

  // 2. 列级语义（仅激活的，按表分组压缩）
  const columns = await safeQuery('column_semantics', {
    method: 'GET', path: '/ontology_column_semantics',
    query: { select: 'table_schema,table_name,column_name,semantic_name,semantic_class,data_type,ui_type', is_active: 'eq.true', order: 'table_schema.asc,table_name.asc,column_name.asc', limit: '1000' },
    acceptProfile: 'public'
  });
  if (Array.isArray(columns) && columns.length) {
    const grouped = {};
    for (const c of columns) {
      const key = `${c.table_schema}.${c.table_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        col: c.column_name,
        name: c.semantic_name,
        cls: c.semantic_class || '',
        type: c.data_type || '',
        ui: c.ui_type || ''
      });
    }
    semantic.columns = grouped;
  }

  // 3. 表间关系
  const relations = await safeQuery('table_relations', {
    method: 'GET', path: '/ontology_table_relations',
    query: { select: 'subject_table,predicate,object_table,subject_semantic_name,object_semantic_name,relation_type', relation_type: 'eq.ontology', limit: '200' },
    acceptProfile: 'app_data'
  });
  if (Array.isArray(relations) && relations.length) {
    semantic.relations = relations.map(r => ({
      from: r.subject_table,
      to: r.object_table,
      predicate: r.predicate || '',
      fromName: r.subject_semantic_name || '',
      toName: r.object_semantic_name || ''
    }));
  }

  // 4. 权限语义视图（压缩输出）
  const permissions = await safeQuery('permission_ontology', {
    method: 'GET', path: '/v_permission_ontology',
    query: { select: 'code,scope,semantic_kind,entity_key,action_key', limit: '200' },
    acceptProfile: 'public'
  });
  if (Array.isArray(permissions) && permissions.length) {
    semantic.permissions = permissions.map(p => ({
      code: p.code,
      scope: p.scope,
      kind: p.semantic_kind,
      entity: p.entity_key || '',
      action: p.action_key || ''
    }));
  }

  semantic.fetchedAt = new Date().toISOString();

  const tableCnt = semantic.tables?.length || 0;
  const colCnt = columns?.length || 0;
  const relCnt = semantic.relations?.length || 0;
  const permCnt = semantic.permissions?.length || 0;
  console.log(`[semantic-ctx] user=${user?.username || '?'} => tables:${tableCnt}, columns:${colCnt}, relations:${relCnt}, permissions:${permCnt}`);

  return (tableCnt + colCnt + relCnt + permCnt) > 0 ? semantic : null;
};

// ── 企业经营助手：业务数据快照采集 ───────────────────────────
const fetchBusinessSnapshot = async (user) => {
  const snapshot = {};
  const queryFailures = [];
  const safeQuery = async (label, opts) => {
    try {
      const result = await callPostgrestWithUser(user, { ...opts, timeoutMs: 5000 });
      return result?.data;
    } catch (e) {
      const message = String(e?.message || e || 'unknown error').slice(0, 300);
      queryFailures.push({ label, message });
      console.warn(`[biz-snapshot] ${label} failed:`, message);
      return null;
    }
  };
  const toNumber = (value) => Number(value) || 0;
  const sumBy = (rows, field) => (Array.isArray(rows) ? rows.reduce((sum, row) => sum + toNumber(row?.[field]), 0) : 0);
  const avgBy = (rows, field) => {
    if (!Array.isArray(rows) || !rows.length) return 0;
    return Math.round((sumBy(rows, field) / rows.length) * 100) / 100;
  };
  const countBy = (rows, field, fallback = '未知') => {
    const counts = {};
    if (!Array.isArray(rows)) return counts;
    rows.forEach((row) => {
      const key = row?.[field] || fallback;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };
  const percent = (part, total) => {
    const denominator = toNumber(total);
    if (!denominator) return 0;
    return Math.round((toNumber(part) / denominator) * 10000) / 100;
  };

  // 1. 仓库列表（含全级别，按 level+sort 排序）
  const warehouses = await safeQuery('warehouses', {
    method: 'GET', path: '/warehouses',
    query: { select: 'id,code,name,level,status', order: 'level.asc,sort.asc', limit: '50' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(warehouses)) {
    snapshot.warehouses = { total: warehouses.length, list: warehouses.map(w => ({ code: w.code, name: w.name, level: w.level, status: w.status })) };
  }

  // 2. 库存汇总 (v_inventory_current)
  const inventory = await safeQuery('inventory', {
    method: 'GET', path: '/v_inventory_current',
    query: { select: 'warehouse_name,material_name,material_code,available_qty,unit', limit: '200', order: 'available_qty.desc' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(inventory)) {
    const totalQty = inventory.reduce((s, r) => s + (Number(r.available_qty) || 0), 0);
    const materialCount = new Set(inventory.map(r => r.material_code)).size;
    const warehouseNames = [...new Set(inventory.map(r => r.warehouse_name))];
    const top10 = inventory.slice(0, 10).map(r => ({
      warehouse: r.warehouse_name, material: r.material_name,
      code: r.material_code, qty: r.available_qty, unit: r.unit
    }));
    snapshot.inventory = { totalRecords: inventory.length, totalQty, materialCount, warehouseNames, top10 };
  }

  // 3. 最近出入库流水（使用视图 v_inventory_transactions，含物料名称和仓库名称）
  const transactions = await safeQuery('transactions', {
    method: 'GET', path: '/v_inventory_transactions',
    query: { select: 'id,transaction_type,io_type,material_name,material_code,quantity,unit,warehouse_name,transaction_date', order: 'transaction_date.desc', limit: '30' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(transactions)) {
    const inCount = transactions.filter(t => t.transaction_type === '入库').length;
    const outCount = transactions.filter(t => t.transaction_type === '出库').length;
    snapshot.recentTransactions = {
      total: transactions.length, inCount, outCount,
      latest: transactions.slice(0, 10).map(t => ({
        type: t.transaction_type, ioType: t.io_type, material: t.material_name,
        code: t.material_code, qty: t.quantity, unit: t.unit,
        warehouse: t.warehouse_name, date: t.transaction_date
      }))
    };
  }

  // 4. 物料主数据统计
  const materials = await safeQuery('materials', {
    method: 'GET', path: '/raw_materials',
    query: { select: 'id,name,category', limit: '500' },
    acceptProfile: 'public'
  });
  if (Array.isArray(materials)) {
    const categories = {};
    materials.forEach(m => { const c = m.category || '未分类'; categories[c] = (categories[c] || 0) + 1; });
    snapshot.materials = { total: materials.length, byCategory: categories };
  }

  // 5. 员工统计（真实 HR 档案在 hr.archives，public.employees 仅保留兼容样例数据）
  let employees = await safeQuery('hrArchives', {
    method: 'GET', path: '/archives',
    query: { select: 'id,department,status', limit: '500' },
    acceptProfile: 'hr'
  });
  if (!Array.isArray(employees)) {
    employees = await safeQuery('employeesFallback', {
      method: 'GET', path: '/employees',
      query: { select: 'id,department', limit: '500' },
      acceptProfile: 'public'
    });
  }
  if (Array.isArray(employees)) {
    const depts = {};
    employees.forEach(e => { const d = e.department || '未分配'; depts[d] = (depts[d] || 0) + 1; });
    snapshot.employees = { total: employees.length, byDepartment: depts };
  }

  // 6. 盘点单统计
  const checks = await safeQuery('checks', {
    method: 'GET', path: '/inventory_checks',
    query: { select: 'id,check_no,status,check_date,total_items,diff_count,created_at', order: 'created_at.desc', limit: '50' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(checks)) {
    const statusCount = {};
    checks.forEach(c => { const s = c.status || '未知'; statusCount[s] = (statusCount[s] || 0) + 1; });
    snapshot.inventoryChecks = { total: checks.length, byStatus: statusCount };
  }

  // 7. 销售快照
  const salesCustomers = await safeQuery('salesCustomers', {
    method: 'GET', path: '/sales_customers',
    query: { select: 'id,name,level,region,owner_name,customer_status,credit_limit,receivable_balance,last_follow_up_at,status', status: 'neq.deleted', order: 'created_at.desc', limit: '300' },
    acceptProfile: 'public'
  });
  const salesOrders = await safeQuery('salesOrders', {
    method: 'GET', path: '/sales_orders',
    query: { select: 'id,order_no,customer_name,product_name,quantity,total_amount,order_date,delivery_date,order_status,owner_name,status', status: 'neq.deleted', order: 'order_date.desc', limit: '300' },
    acceptProfile: 'public'
  });
  const salesOpportunities = await safeQuery('salesOpportunities', {
    method: 'GET', path: '/sales_opportunities',
    query: { select: 'id,opportunity_no,opportunity_name,customer_name,expected_amount,stage,probability,expected_close_date,owner_name,status', status: 'neq.deleted', order: 'expected_close_date.asc', limit: '200' },
    acceptProfile: 'public'
  });
  const salesPayments = await safeQuery('salesPayments', {
    method: 'GET', path: '/sales_payments',
    query: { select: 'id,payment_no,order_no,customer_name,amount,payment_date,payment_method,verify_status,handler_name,status', status: 'neq.deleted', order: 'payment_date.desc', limit: '200' },
    acceptProfile: 'public'
  });
  if ([salesCustomers, salesOrders, salesOpportunities, salesPayments].some(Array.isArray)) {
    const customers = Array.isArray(salesCustomers) ? salesCustomers : [];
    const orders = Array.isArray(salesOrders) ? salesOrders : [];
    const opportunities = Array.isArray(salesOpportunities) ? salesOpportunities : [];
    const payments = Array.isArray(salesPayments) ? salesPayments : [];
    const receivableRisk = customers
      .filter((c) => toNumber(c.receivable_balance) > 0)
      .sort((a, b) => toNumber(b.receivable_balance) - toNumber(a.receivable_balance))
      .slice(0, 8)
      .map((c) => ({
        customer: c.name,
        receivable: c.receivable_balance,
        creditLimit: c.credit_limit,
        overCredit: toNumber(c.credit_limit) > 0 && toNumber(c.receivable_balance) > toNumber(c.credit_limit)
      }));
    snapshot.sales = {
      customersTotal: customers.length,
      ordersTotal: orders.length,
      orderAmount: sumBy(orders, 'total_amount'),
      paidAmount: sumBy(payments, 'amount'),
      receivableBalance: sumBy(customers, 'receivable_balance'),
      opportunityAmount: sumBy(opportunities, 'expected_amount'),
      byOrderStatus: countBy(orders, 'order_status'),
      byOpportunityStage: countBy(opportunities, 'stage'),
      byCustomerLevel: countBy(customers, 'level'),
      receivableRisk,
      latestOrders: orders.slice(0, 8).map((o) => ({ orderNo: o.order_no, customer: o.customer_name, product: o.product_name, amount: o.total_amount, status: o.order_status, deliveryDate: o.delivery_date }))
    };
  }

  // 8. 采购快照
  const purchaseSuppliers = await safeQuery('purchaseSuppliers', {
    method: 'GET', path: '/purchase_suppliers',
    query: { select: 'id,name,level,category,lead_time_days,buyer_name,supplier_status,status', status: 'neq.deleted', order: 'created_at.desc', limit: '200' },
    acceptProfile: 'public'
  });
  const purchaseDemands = await safeQuery('purchaseDemands', {
    method: 'GET', path: '/purchase_demands',
    query: { select: 'id,demand_no,material_name,quantity,unit,required_date,source_dept,preferred_supplier,demand_status,status', status: 'neq.deleted', order: 'required_date.asc', limit: '250' },
    acceptProfile: 'public'
  });
  const purchaseOrders = await safeQuery('purchaseOrders', {
    method: 'GET', path: '/purchase_orders',
    query: { select: 'id,order_no,supplier_name,material_name,quantity,unit,total_amount,order_date,expected_arrival_date,buyer_name,order_status,status', status: 'neq.deleted', order: 'order_date.desc', limit: '250' },
    acceptProfile: 'public'
  });
  const purchaseArrivals = await safeQuery('purchaseArrivals', {
    method: 'GET', path: '/purchase_arrivals',
    query: { select: 'id,arrival_no,order_no,supplier_name,material_name,arrival_quantity,accepted_quantity,unit,arrival_date,iqc_status,arrival_status,status', status: 'neq.deleted', order: 'arrival_date.desc', limit: '250' },
    acceptProfile: 'public'
  });
  if ([purchaseSuppliers, purchaseDemands, purchaseOrders, purchaseArrivals].some(Array.isArray)) {
    const suppliers = Array.isArray(purchaseSuppliers) ? purchaseSuppliers : [];
    const demands = Array.isArray(purchaseDemands) ? purchaseDemands : [];
    const orders = Array.isArray(purchaseOrders) ? purchaseOrders : [];
    const arrivals = Array.isArray(purchaseArrivals) ? purchaseArrivals : [];
    snapshot.purchase = {
      suppliersTotal: suppliers.length,
      demandsTotal: demands.length,
      ordersTotal: orders.length,
      purchaseAmount: sumBy(orders, 'total_amount'),
      arrivalQty: sumBy(arrivals, 'arrival_quantity'),
      acceptedQty: sumBy(arrivals, 'accepted_quantity'),
      acceptanceRate: percent(sumBy(arrivals, 'accepted_quantity'), sumBy(arrivals, 'arrival_quantity')),
      avgSupplierLeadTimeDays: avgBy(suppliers, 'lead_time_days'),
      byDemandStatus: countBy(demands, 'demand_status'),
      byOrderStatus: countBy(orders, 'order_status'),
      byIqcStatus: countBy(arrivals, 'iqc_status'),
      pendingArrivals: orders
        .filter((o) => !['已到货', '已关闭', '已取消'].includes(o.order_status))
        .slice(0, 8)
        .map((o) => ({ orderNo: o.order_no, supplier: o.supplier_name, material: o.material_name, amount: o.total_amount, expectedArrivalDate: o.expected_arrival_date, status: o.order_status }))
    };
  }

  // 9. 生产快照
  const productionOrders = await safeQuery('productionOrders', {
    method: 'GET', path: '/v_production_work_orders',
    query: { select: 'work_order_no,product_material_code,product_material_name,planned_qty,unit,planned_start_date,planned_finish_date,work_order_status,priority,item_count,shortage_item_count,source_order_nos', order: 'planned_finish_date.asc', limit: '250' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(productionOrders)) {
    const allShortageOrders = productionOrders
      .filter((o) => toNumber(o.shortage_item_count) > 0)
    const shortageOrders = allShortageOrders
      .sort((a, b) => toNumber(b.shortage_item_count) - toNumber(a.shortage_item_count))
      .slice(0, 8)
      .map((o) => ({ workOrderNo: o.work_order_no, product: o.product_material_name, plannedQty: o.planned_qty, shortageItems: o.shortage_item_count, status: o.work_order_status, finishDate: o.planned_finish_date }));
    snapshot.production = {
      workOrdersTotal: productionOrders.length,
      plannedQty: sumBy(productionOrders, 'planned_qty'),
      itemCount: sumBy(productionOrders, 'item_count'),
      shortageItemCount: sumBy(productionOrders, 'shortage_item_count'),
      shortageOrderCount: allShortageOrders.length,
      byWorkOrderStatus: countBy(productionOrders, 'work_order_status'),
      byPriority: countBy(productionOrders, 'priority'),
      shortageOrders,
      latestPlans: productionOrders.slice(0, 8).map((o) => ({ workOrderNo: o.work_order_no, product: o.product_material_name, plannedQty: o.planned_qty, status: o.work_order_status, priority: o.priority, finishDate: o.planned_finish_date }))
    };
  }

  // 10. 质量快照
  const qualityInspections = await safeQuery('qualityInspections', {
    method: 'GET', path: '/quality_inspections',
    query: { select: 'id,doc_no,inspection_type,item_name,sample_qty,defect_qty,result,inspector,inspection_date,status', status: 'neq.deleted', order: 'inspection_date.desc', limit: '250' },
    acceptProfile: 'public'
  });
  const qualityNcrs = await safeQuery('qualityNcrs', {
    method: 'GET', path: '/quality_ncrs',
    query: { select: 'id,doc_no,source_type,issue_desc,severity,owner_dept,owner_name,deadline,ncr_status,status', status: 'neq.deleted', order: 'created_at.desc', limit: '200' },
    acceptProfile: 'public'
  });
  const qualityActions = await safeQuery('qualityActions', {
    method: 'GET', path: '/quality_corrective_actions',
    query: { select: 'id,action_no,ncr_doc_no,action_type,owner_dept,owner_name,due_date,action_status,status', status: 'neq.deleted', order: 'due_date.asc', limit: '200' },
    acceptProfile: 'public'
  });
  const qualityAudits = await safeQuery('qualityAudits', {
    method: 'GET', path: '/quality_audits',
    query: { select: 'id,audit_no,audit_type,audit_scope,plan_date,auditor,finding_count,audit_status,status', status: 'neq.deleted', order: 'plan_date.desc', limit: '120' },
    acceptProfile: 'public'
  });
  if ([qualityInspections, qualityNcrs, qualityActions, qualityAudits].some(Array.isArray)) {
    const inspections = Array.isArray(qualityInspections) ? qualityInspections : [];
    const ncrs = Array.isArray(qualityNcrs) ? qualityNcrs : [];
    const actions = Array.isArray(qualityActions) ? qualityActions : [];
    const audits = Array.isArray(qualityAudits) ? qualityAudits : [];
    const sampleQty = sumBy(inspections, 'sample_qty');
    const defectQty = sumBy(inspections, 'defect_qty');
    snapshot.quality = {
      inspectionsTotal: inspections.length,
      sampleQty,
      defectQty,
      defectRate: percent(defectQty, sampleQty),
      passRate: percent(inspections.filter((i) => ['合格', '让步接收'].includes(i.result)).length, inspections.length),
      ncrsTotal: ncrs.length,
      actionsTotal: actions.length,
      auditFindingCount: sumBy(audits, 'finding_count'),
      byInspectionResult: countBy(inspections, 'result'),
      byNcrSeverity: countBy(ncrs, 'severity'),
      byActionStatus: countBy(actions, 'action_status'),
      openNcrs: ncrs
        .filter((n) => n.ncr_status !== '已关闭')
        .slice(0, 8)
        .map((n) => ({ docNo: n.doc_no, issue: n.issue_desc, severity: n.severity, owner: n.owner_name || n.owner_dept, deadline: n.deadline, status: n.ncr_status }))
    };
  }

  // 11. 设备快照
  const equipmentAssets = await safeQuery('equipmentAssets', {
    method: 'GET', path: '/equipment_assets',
    query: { select: 'id,asset_no,asset_name,asset_type,location_name,asset_level,run_status,owner_dept,owner_name,next_maint_date,health_score,status', status: 'neq.deleted', order: 'created_at.desc', limit: '250' },
    acceptProfile: 'public'
  });
  const equipmentChecks = await safeQuery('equipmentChecks', {
    method: 'GET', path: '/equipment_checks',
    query: { select: 'id,check_no,asset_no,asset_name,check_type,check_item_count,abnormal_count,check_result,checker,check_date,status', status: 'neq.deleted', order: 'check_date.desc', limit: '250' },
    acceptProfile: 'public'
  });
  const equipmentIssues = await safeQuery('equipmentIssues', {
    method: 'GET', path: '/equipment_issues',
    query: { select: 'id,issue_no,asset_no,asset_name,issue_level,owner_dept,owner_name,occurred_date,deadline,issue_status,status', status: 'neq.deleted', order: 'occurred_date.desc', limit: '200' },
    acceptProfile: 'public'
  });
  const equipmentWorkOrders = await safeQuery('equipmentWorkOrders', {
    method: 'GET', path: '/equipment_work_orders',
    query: { select: 'id,work_order_no,issue_no,asset_no,asset_name,work_type,maintainer,plan_date,finish_date,downtime_hours,work_status,status', status: 'neq.deleted', order: 'plan_date.desc', limit: '200' },
    acceptProfile: 'public'
  });
  const equipmentPlans = await safeQuery('equipmentPlans', {
    method: 'GET', path: '/equipment_maintenance_plans',
    query: { select: 'id,plan_no,plan_name,asset_scope,plan_type,next_execute_date,owner_name,plan_status,completion_rate,status', status: 'neq.deleted', order: 'next_execute_date.asc', limit: '120' },
    acceptProfile: 'public'
  });
  if ([equipmentAssets, equipmentChecks, equipmentIssues, equipmentWorkOrders, equipmentPlans].some(Array.isArray)) {
    const assets = Array.isArray(equipmentAssets) ? equipmentAssets : [];
    const checksList = Array.isArray(equipmentChecks) ? equipmentChecks : [];
    const issues = Array.isArray(equipmentIssues) ? equipmentIssues : [];
    const workOrders = Array.isArray(equipmentWorkOrders) ? equipmentWorkOrders : [];
    const plans = Array.isArray(equipmentPlans) ? equipmentPlans : [];
    const abnormalChecks = checksList.filter((c) => toNumber(c.abnormal_count) > 0 || ['异常', '停机'].includes(c.check_result));
    snapshot.equipment = {
      assetsTotal: assets.length,
      avgHealthScore: avgBy(assets, 'health_score'),
      checksTotal: checksList.length,
      abnormalCheckCount: abnormalChecks.length,
      issuesTotal: issues.length,
      openIssueCount: issues.filter((i) => i.issue_status !== '已关闭').length,
      workOrdersTotal: workOrders.length,
      downtimeHours: sumBy(workOrders, 'downtime_hours'),
      maintenancePlansTotal: plans.length,
      avgPlanCompletionRate: avgBy(plans, 'completion_rate'),
      byRunStatus: countBy(assets, 'run_status'),
      byIssueLevel: countBy(issues, 'issue_level'),
      byWorkStatus: countBy(workOrders, 'work_status'),
      riskAssets: assets
        .filter((a) => a.run_status !== '运行' || toNumber(a.health_score) < 80)
        .slice(0, 8)
        .map((a) => ({ assetNo: a.asset_no, asset: a.asset_name, runStatus: a.run_status, healthScore: a.health_score, owner: a.owner_name || a.owner_dept, nextMaintDate: a.next_maint_date }))
    };
  }

  // 12. 应用列表
  const apps = await safeQuery('apps', {
    method: 'GET', path: '/apps',
    query: { select: 'id,name,app_type,status', order: 'created_at.desc', limit: '50' },
    acceptProfile: 'app_center'
  });
  if (Array.isArray(apps)) {
    snapshot.apps = { total: apps.length, list: apps.slice(0, 20).map(a => ({ name: a.name, type: a.app_type, status: a.status })) };
  }

  snapshot.snapshotTime = new Date().toISOString();
  snapshot._meta = {
    partial: queryFailures.length > 0,
    failedSourceCount: queryFailures.length,
    failedSources: queryFailures.slice(0, 12)
  };

  // 输出快照摘要日志（方便调试）
  const keys = Object.keys(snapshot).filter(k => k !== 'snapshotTime' && k !== '_meta');
  const summary = keys.map(k => {
    const v = snapshot[k];
    return `${k}:${v?.total ?? (v?.totalRecords ?? '?')}`;
  }).join(', ');
  console.log(`[biz-snapshot] user=${user?.username || '?'} partial=${queryFailures.length > 0 ? 'yes' : 'no'} => ${summary}`);

  return snapshot;
};

const buildBusinessSnapshotFallback = (error) => {
  const message = String(error?.message || error || '业务快照读取失败').slice(0, 500);
  return {
    snapshotTime: new Date().toISOString(),
    _meta: {
      partial: true,
      fallback: true,
      error: message,
      failedSourceCount: 1,
      failedSources: [{ label: 'businessSnapshot', message }]
    }
  };
};

const safeFetchBusinessSnapshot = async (user, source = 'biz-snapshot') => {
  try {
    return await fetchBusinessSnapshot(user);
  } catch (error) {
    console.warn(`[${source}] business snapshot fallback:`, error?.message || error);
    return buildBusinessSnapshotFallback(error);
  }
};

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
