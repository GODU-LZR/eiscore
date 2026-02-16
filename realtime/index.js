const http = require('http');
const WebSocket = require('ws');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { AgentConversation, FileWatcher } = require('./agent-core');
const { WorkflowEngine } = require('./workflow-engine');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

const port = Number(process.env.PORT || 8078);
const wsPath = envText(process.env.WS_PATH, '/ws') || '/ws';
const rawChannel = envText(process.env.CHANNEL, 'eis_events') || 'eis_events';
const channel = /^[a-zA-Z0-9_]+$/.test(rawChannel) ? rawChannel : 'eis_events';
const workflowChannel = 'workflow_event';
const enableWorkflowAutoTransition = envText(process.env.WORKFLOW_AUTO_TRANSITION, '0') === '1';
const jwtSecret = envText(process.env.PGRST_JWT_SECRET, envText(process.env.JWT_SECRET, ''));
const aiConfigKey = envText(process.env.AI_CONFIG_KEY, 'ai_glm_config') || 'ai_glm_config';
const aiConfigTtlMs = Number(process.env.AI_CONFIG_TTL_MS || 30 * 1000);
const aiUpstreamTimeoutMs = Number(process.env.AI_UPSTREAM_TIMEOUT_MS || 120 * 1000);
const flashCliEnabled = envText(process.env.FLASH_CLINE_ENABLED, 'true').toLowerCase() !== 'false';
const flashCliCommand = envText(process.env.FLASH_CLINE_COMMAND, '/app/node_modules/.bin/cline');
const flashCliProjectPath = envText(process.env.FLASH_CLINE_PROJECT_PATH, 'eiscore-apps/src/views/drafts');
const flashCliWorkdirConfigured = envText(
  process.env.FLASH_CLINE_WORKDIR,
  path.posix.join('/workspace', flashCliProjectPath)
);
const flashCliConfigRoot = envText(process.env.FLASH_CLINE_CONFIG_ROOT, '/tmp/flash-cline');
const flashCliTaskTimeoutMs = Number(process.env.FLASH_CLINE_TASK_TIMEOUT_MS || 8 * 60 * 1000);
const flashCliAuthTimeoutMs = Number(process.env.FLASH_CLINE_AUTH_TIMEOUT_MS || 30 * 1000);
const flashCliProvider = envText(process.env.FLASH_CLINE_PROVIDER, 'openai');
const flashCliHistoryLimit = Number(process.env.FLASH_CLINE_HISTORY_LIMIT || 10);
const flashCliBuildValidateEnabled = envText(process.env.FLASH_CLINE_BUILD_VALIDATE, 'true').toLowerCase() !== 'false';
const flashCliBuildWorkdirConfigured = envText(process.env.FLASH_CLINE_BUILD_WORKDIR, '/workspace/eiscore-apps');
const flashCliBuildTimeoutMs = Number(process.env.FLASH_CLINE_BUILD_TIMEOUT_MS || 180 * 1000);
const flashCliInstallTimeoutMs = Number(process.env.FLASH_CLINE_INSTALL_TIMEOUT_MS || 120 * 1000);
const flashCliSelfHealMaxRounds = Math.max(0, Number(process.env.FLASH_CLINE_SELF_HEAL_ROUNDS || 3));
const flashCliAutoInstallDeps = envText(process.env.FLASH_CLINE_AUTO_INSTALL_DEPS, 'true').toLowerCase() !== 'false';
const flashDraftFileName = envText(process.env.FLASH_DRAFT_FILE, 'FlashDraft.vue');
const runtimeNodeMajor = Number.parseInt(String(process.versions.node || '0').split('.')[0], 10) || 0;
const flashCliRuntimeReady = runtimeNodeMajor >= 20;

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

const resolveFlashBuildWorkdir = (taskWorkdir) => {
  const directCandidates = [
    flashCliBuildWorkdirConfigured,
    taskWorkdir,
    path.resolve(taskWorkdir, '..'),
    path.resolve(taskWorkdir, '..', '..'),
    path.resolve(taskWorkdir, '..', '..', '..'),
    path.resolve(process.cwd(), '..', 'eiscore-apps'),
    path.resolve(__dirname, '..', 'eiscore-apps')
  ]
    .map((item) => envText(item, ''))
    .filter(Boolean);

  for (const candidate of directCandidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    } catch {
      // ignore
    }
  }
  return directCandidates[0] || flashCliBuildWorkdirConfigured;
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

// In proxy-based environments, Node fetch reads proxy vars when this flag is enabled.
if (!process.env.NODE_USE_ENV_PROXY) {
  process.env.NODE_USE_ENV_PROXY = '1';
}

let pgClient = null;
let reconnectTimer = null;
let shuttingDown = false;
let workflowEngine = null;
let aiConfigCache = null;
let aiConfigLoadedAt = 0;

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

const asUser = (payload) => ({
  id: payload?.user_id || payload?.sub || payload?.username || payload?.email || '',
  role: payload?.app_role || payload?.role || '',
  permissions: Array.isArray(payload?.permissions) ? payload.permissions.map((p) => String(p)) : []
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

const normalizeAiText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  if (typeof value === 'object') {
    return String(value.text || '').trim();
  }
  return String(value).trim();
};

const normalizeMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'worker' || mode === 'enterprise' || mode === 'workflow') return mode;
  return '';
};

const normalizeMessageContent = (content) => {
  if (typeof content === 'string') {
    return content.slice(0, 10000);
  }
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'text') {
      const text = normalizeAiText(item.text);
      if (text) parts.push({ type: 'text', text: text.slice(0, 10000) });
      continue;
    }
    if (item.type === 'image_url') {
      const url = normalizeAiText(item?.image_url?.url || item?.url);
      if (url) parts.push({ type: 'image_url', image_url: { url } });
    }
  }
  return parts.length > 0 ? parts : '';
};

const sanitizeConversationMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  const normalized = [];
  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const role = String(item.role || '').toLowerCase();
    // Force system prompt ownership to backend route layer.
    if (role !== 'user' && role !== 'assistant') continue;
    const content = normalizeMessageContent(item.content);
    if (!content || (Array.isArray(content) && content.length === 0)) continue;
    normalized.push({ role, content });
  }
  return normalized.slice(-24);
};

const extractLatestUserText = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const content = message?.content;
    if (typeof content === 'string') {
      return normalizeAiText(content);
    }
    if (Array.isArray(content)) {
      const text = content
        .filter((part) => part?.type === 'text')
        .map((part) => normalizeAiText(part?.text))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) return text;
    }
  }
  return '';
};

const hasAnyKeyword = (text, patterns) => {
  if (!text) return false;
  return patterns.some((p) => p.test(text));
};

const WORKFLOW_INTENT_PATTERNS = [
  /流程|审批|节点|流转|编排|BPMN|workflow|流程图|发布流程|办理路径/i
];

const ENTERPRISE_INTENT_PATTERNS = [
  /经营|报表|收入|利润|毛利|同比|环比|趋势|分析|看板|图表|echarts|KPI|指标/i
];

const FORM_INTENT_PATTERNS = [
  /表单|模板|单据|表格模板|form[-_ ]?template|form/i
];

const MATERIALS_INTENT_PATTERNS = [
  /物料|库存|出入库|台账|分类|批次|仓库/i
];

const detectIntent = (latestUserText, context = {}) => {
  const text = normalizeAiText(latestUserText);
  const aiScene = String(context?.aiScene || '').toLowerCase();

  if (hasAnyKeyword(text, WORKFLOW_INTENT_PATTERNS) || aiScene.includes('workflow')) {
    return 'workflow';
  }
  if (hasAnyKeyword(text, FORM_INTENT_PATTERNS) || aiScene.includes('form')) {
    return 'form';
  }
  if (hasAnyKeyword(text, ENTERPRISE_INTENT_PATTERNS)) {
    return 'enterprise_report';
  }
  if (hasAnyKeyword(text, MATERIALS_INTENT_PATTERNS)) {
    return 'materials_ops';
  }
  return 'general';
};

const canUseWorkflowAgent = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'admin') return true;
  return (user?.permissions || []).some((perm) => String(perm).toLowerCase().includes('workflow'));
};

const resolveDefaultModeByRole = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role.includes('viewer') || role.includes('operator') || role.includes('worker')) {
    return 'worker';
  }
  return 'enterprise';
};

const AGENT_LABELS = {
  enterprise_analyst: '企业经营分析智能体',
  worker_assistant: '企业工作助手智能体',
  workflow_orchestrator: '流程编排智能体'
};

const AGENT_RUNTIME_DEFAULTS = {
  enterprise_analyst: {
    temperature: 0.2,
    top_p: 0.8,
    max_tokens: 4096,
    thinking: { type: 'enabled' },
    tools_whitelist: ['echarts']
  },
  worker_assistant: {
    temperature: 0.3,
    top_p: 0.9,
    max_tokens: 4096,
    thinking: { type: 'enabled' },
    tools_whitelist: ['form-template', 'translate', 'map-locate']
  },
  workflow_orchestrator: {
    temperature: 0.1,
    top_p: 0.7,
    max_tokens: 6144,
    thinking: { type: 'enabled' },
    tools_whitelist: ['workflow-meta', 'bpmn-xml', 'mermaid']
  }
};

const pickFirstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const normalizeFiniteNumber = (value, fallback, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (min !== undefined && num < min) return fallback;
  if (max !== undefined && num > max) return fallback;
  return num;
};

const getAgentConfigMap = (cfg) => {
  const value = cfg?.agents || cfg?.agent_profiles || {};
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
};

const normalizeToolsWhitelist = (value, fallback = []) => {
  const list = normalizeStringList(value ?? fallback)
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(list));
};

const resolveAgentRuntimeConfig = (cfg, agentId) => {
  const defaults = AGENT_RUNTIME_DEFAULTS[agentId] || AGENT_RUNTIME_DEFAULTS.enterprise_analyst;
  const customMap = getAgentConfigMap(cfg);
  const custom = (customMap[agentId] && typeof customMap[agentId] === 'object') ? customMap[agentId] : {};
  const thinkingValue = pickFirstDefined(custom.thinking, cfg?.thinking, defaults.thinking);

  return {
    id: agentId,
    label: AGENT_LABELS[agentId] || agentId,
    model: normalizeAiText(
      pickFirstDefined(custom.model, cfg?.model, 'glm-4.6v')
    ) || 'glm-4.6v',
    temperature: normalizeFiniteNumber(
      pickFirstDefined(custom.temperature, defaults.temperature),
      defaults.temperature,
      0,
      2
    ),
    top_p: normalizeFiniteNumber(
      pickFirstDefined(custom.top_p, custom.topP, defaults.top_p),
      defaults.top_p,
      0,
      1
    ),
    max_tokens: normalizeFiniteNumber(
      pickFirstDefined(custom.max_tokens, custom.maxTokens, defaults.max_tokens),
      defaults.max_tokens,
      1,
      65535
    ),
    thinking: (thinkingValue && typeof thinkingValue === 'object')
      ? thinkingValue
      : defaults.thinking,
    tools_whitelist: normalizeToolsWhitelist(
      pickFirstDefined(custom.tools_whitelist, custom.tool_whitelist, custom.allowed_tools, custom.toolWhitelist),
      defaults.tools_whitelist
    )
  };
};

const buildAgentCatalog = (user, cfg) => {
  const ids = ['enterprise_analyst', 'worker_assistant', 'workflow_orchestrator'];
  return ids.map((id) => {
    const runtime = resolveAgentRuntimeConfig(cfg, id);
    const enabled = id === 'workflow_orchestrator' ? canUseWorkflowAgent(user) : true;
    return {
      id,
      label: runtime.label,
      enabled,
      model: runtime.model,
      temperature: runtime.temperature,
      top_p: runtime.top_p,
      max_tokens: runtime.max_tokens,
      tools_whitelist: runtime.tools_whitelist
    };
  });
};

const buildAgentSystemPrompt = ({ agentId, context, user, intent }) => {
  const safeContext = context && typeof context === 'object'
    ? JSON.stringify(context, null, 2).slice(0, 3000)
    : '';

  const contextBlock = safeContext
    ? `\n\n【业务上下文】\n${safeContext}`
    : '';

  if (agentId === 'workflow_orchestrator') {
    return `你是流程编排智能体。你的职责是把业务需求转换成可落地的流程定义。\n\n【硬性规则】\n1. 必须输出 Mermaid 流程图（\`\`\`mermaid）。\n2. 必须输出 BPMN XML（\`\`\`bpmn-xml）。\n3. 必须输出流程元信息（\`\`\`workflow-meta），包含 name 与 associated_table。\n4. 禁止输出经营分析图表（如 ECharts）和无关内容。\n5. 语气简洁，优先可执行结果。\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${contextBlock}`;
  }

  if (agentId === 'enterprise_analyst') {
    return `你是企业经营分析智能体。你的职责是输出“专业但通俗易懂”的经营分析报告，并给出可执行建议。\n\n【表达风格】\n1. 用业务语言解释指标含义，尽量少术语；若必须用术语，紧跟一句白话解释。\n2. 先给一句结论，再给证据（数据/图表），最后给行动建议。\n3. 每条建议都要可落地（负责人/时点/目标方向）。\n\n【硬性规则】\n1. 回答开头禁止客套语（如“好的/收到/我将”），直接进入“经营分析报告”或“摘要”。\n2. 默认输出结构：摘要 -> 核心指标解读 -> 图表洞察 -> 风险与机会 -> 执行建议。\n3. 图文并茂：当有数据时，优先给 2-4 个图（趋势、结构、对比、相关性）。\n4. 输出 ECharts 时只允许 \`\`\`echarts 代码块，且必须是严格 JSON：双引号、无注释、无尾逗号、禁止函数（如 formatter/itemStyle.color function）。\n5. 严禁输出 BPMN XML、workflow-meta、流程编排内容，除非用户明确要求“流程编排/BPMN审批流设计”。\n6. 结论必须业务可执行，避免空话。\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${contextBlock}`;
  }

  return `你是企业一线工作助手。你的职责是帮助用户整理数据、填表、导入、解释字段。\n\n【硬性规则】\n1. 用通俗语句分步骤回答。\n2. 默认不输出流程编排内容（BPMN/workflow-meta），除非用户明确提出流程编排需求。\n3. 当用户要求表单模板时，输出 form-template 代码块。\n4. 关注可直接录入系统的字段结果。\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${contextBlock}`;
};

const resolveAgentRoute = ({ user, body, messages }) => {
  const requestedMode = normalizeMode(body?.assistant_mode || body?.assistantMode || body?.mode);
  const context = (body?.context && typeof body.context === 'object') ? body.context : {};
  const latestUserText = extractLatestUserText(messages);
  const intent = detectIntent(latestUserText, context);
  const fallbackMode = resolveDefaultModeByRole(user);
  const mode = requestedMode || fallbackMode;

  let agentId = mode === 'worker' ? 'worker_assistant' : 'enterprise_analyst';
  if (intent === 'workflow') {
    agentId = canUseWorkflowAgent(user) ? 'workflow_orchestrator' : agentId;
  } else if (mode === 'workflow') {
    agentId = canUseWorkflowAgent(user) ? 'workflow_orchestrator' : 'enterprise_analyst';
  } else if (mode === 'enterprise') {
    agentId = 'enterprise_analyst';
  } else if (mode === 'worker') {
    agentId = 'worker_assistant';
  }

  return {
    requestedMode: mode,
    intent,
    agentId,
    context,
    latestUserText
  };
};

const composeAgentMessages = ({ route, user, messages }) => {
  const systemPrompt = buildAgentSystemPrompt({
    agentId: route.agentId,
    context: route.context,
    user,
    intent: route.intent
  });
  return [{ role: 'system', content: systemPrompt }, ...messages];
};

const extractCompletionText = (data) => {
  const choice = data?.choices?.[0] || {};
  return normalizeAiText(choice?.message?.content || choice?.delta?.content || data?.output_text || '');
};

const cleanModelText = (text) => {
  const trimmed = normalizeAiText(text);
  if (!trimmed) return '';
  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^["“]|["”]$/g, '')
    .trim();
};

const WORKFLOW_LEAK_PATTERNS = [
  /```[\t ]*bpmn-xml/i,
  /```[\t ]*workflow-meta/i,
  /```[\t ]*mermaid/i,
  /<bpmn[\s:>]/i,
  /\bworkflow-meta\b/i
];

const shouldApplyEnterpriseOutputGuard = (route) => {
  return route?.agentId === 'enterprise_analyst' && route?.intent !== 'workflow';
};

const containsWorkflowLeak = (text) => {
  const value = normalizeAiText(text);
  if (!value) return false;
  return WORKFLOW_LEAK_PATTERNS.some((pattern) => pattern.test(value));
};

const replaceCompletionText = (data, text) => {
  const safeText = normalizeAiText(text);
  if (!safeText) return data || {};
  const cloned = (data && typeof data === 'object')
    ? JSON.parse(JSON.stringify(data))
    : {};
  if (!Array.isArray(cloned.choices) || cloned.choices.length === 0) {
    cloned.choices = [{ index: 0, message: { role: 'assistant', content: safeText }, finish_reason: 'stop' }];
    return cloned;
  }
  const first = cloned.choices[0] || {};
  if (first.message && typeof first.message === 'object') {
    first.message.content = safeText;
  } else if (first.delta && typeof first.delta === 'object') {
    first.delta.content = safeText;
  } else {
    first.message = { role: 'assistant', content: safeText };
  }
  cloned.choices[0] = first;
  return cloned;
};

const aiAllowedRoles = normalizeStringList(process.env.AI_ALLOWED_ROLES || '').map((role) => String(role).toLowerCase());
const aiAllowAll = String(process.env.AI_ALLOW_ALL || 'true').toLowerCase() !== 'false';

const canUseAi = (user) => {
  if (aiAllowAll) return true;
  if (aiAllowedRoles.length === 0) return true;
  const role = String(user?.role || '').toLowerCase();
  return aiAllowedRoles.includes(role);
};

const getAiConfig = async () => {
  if (!pgClient) throw new Error('Database client not ready');
  const now = Date.now();
  if (aiConfigCache && (now - aiConfigLoadedAt) < aiConfigTtlMs) {
    return aiConfigCache;
  }
  const result = await pgClient.query(
    'SELECT value FROM public.system_configs WHERE key = $1 LIMIT 1',
    [aiConfigKey]
  );
  const cfg = result?.rows?.[0]?.value;
  aiConfigCache = (cfg && typeof cfg === 'object') ? cfg : null;
  aiConfigLoadedAt = now;
  return aiConfigCache;
};

const getToolName = (tool) => {
  if (!tool || typeof tool !== 'object') return '';
  const value = tool?.function?.name || tool?.name || tool?.id || tool?.type || '';
  return String(value).trim().toLowerCase();
};

const applyToolWhitelist = (payload, whitelist) => {
  if (!payload || !Array.isArray(payload.tools)) return;
  const normalized = normalizeToolsWhitelist(whitelist);
  if (normalized.length === 0) {
    delete payload.tools;
    return;
  }
  if (normalized.includes('*')) return;
  payload.tools = payload.tools.filter((tool) => normalized.includes(getToolName(tool)));
  if (payload.tools.length === 0) {
    delete payload.tools;
  }
};

const buildUpstreamPayload = (incoming, cfg, forceStream = false, agentRuntime = null) => {
  const payload = (incoming && typeof incoming === 'object') ? { ...incoming } : {};
  delete payload.api_key;
  delete payload.api_url;
  delete payload.assistant_mode;
  delete payload.assistantMode;
  delete payload.mode;
  delete payload.context;
  delete payload.agent;
  delete payload.agent_id;
  delete payload.agent_target;

  if (!payload.model) payload.model = agentRuntime?.model || cfg?.model || 'glm-4.6v';
  if (payload.temperature === undefined && Number.isFinite(agentRuntime?.temperature)) {
    payload.temperature = agentRuntime.temperature;
  }
  if (payload.top_p === undefined && Number.isFinite(agentRuntime?.top_p)) {
    payload.top_p = agentRuntime.top_p;
  }
  if (payload.max_tokens === undefined && Number.isFinite(agentRuntime?.max_tokens)) {
    payload.max_tokens = agentRuntime.max_tokens;
  }
  if (forceStream) payload.stream = true;
  if (payload.thinking === undefined && agentRuntime?.thinking) payload.thinking = agentRuntime.thinking;
  if (payload.thinking === undefined && cfg?.thinking) payload.thinking = cfg.thinking;
  applyToolWhitelist(payload, agentRuntime?.tools_whitelist);
  return payload;
};

const readResponseText = async (response) => {
  try {
    return await response.text();
  } catch (e) {
    return '';
  }
};

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryUpstream = (result) => {
  if (!result || result.ok) return false;
  const status = Number(result.status || 0);
  if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
  const message = normalizeAiText(result?.payload?.message).toLowerCase();
  return /timeout|upstream|network|failed/.test(message);
};

const callAiUpstream = async (incomingPayload, options = {}) => {
  const forceStream = options?.forceStream === true;
  const cfg = options?.cfg || await getAiConfig();
  const agentRuntime = options?.agentRuntime || null;
  if (!cfg?.api_url || !cfg?.api_key) {
    return {
      ok: false,
      status: 503,
      payload: { code: 'AI_CONFIG_MISSING', message: 'AI configuration is missing in system_configs.ai_glm_config' }
    };
  }

  const payload = buildUpstreamPayload(incomingPayload, cfg, forceStream, agentRuntime);
  const streamMode = !!payload.stream;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiUpstreamTimeoutMs);
  let upstreamRes = null;
  try {
    upstreamRes = await fetch(cfg.api_url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    return {
      ok: false,
      status: 502,
      payload: {
        code: 'AI_UPSTREAM_ERROR',
        message: isTimeout
          ? `AI upstream timeout after ${aiUpstreamTimeoutMs}ms`
          : (error?.message || 'AI upstream request failed'),
        detail: ''
      }
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!upstreamRes.ok) {
    const detail = (await readResponseText(upstreamRes)).slice(0, 2000);
    return {
      ok: false,
      status: upstreamRes.status || 502,
      payload: {
        code: 'AI_UPSTREAM_ERROR',
        message: 'AI upstream request failed',
        detail
      }
    };
  }

  if (!streamMode) {
    const raw = await readResponseText(upstreamRes);
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        data = { raw };
      }
    }
    return { ok: true, stream: false, data, config: cfg, payload };
  }

  return { ok: true, stream: streamMode, response: upstreamRes, config: cfg, payload };
};

const callAiUpstreamWithRetry = async (incomingPayload, options = {}, retryConfig = {}) => {
  const maxRetries = Number(retryConfig.maxRetries);
  const retries = Number.isFinite(maxRetries) && maxRetries > 0 ? Math.floor(maxRetries) : 2;
  const baseDelayMs = Number(retryConfig.baseDelayMs);
  const delay = Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? Math.floor(baseDelayMs) : 320;

  let attempt = 0;
  let result = await callAiUpstream(incomingPayload, options);
  while (attempt < retries && shouldRetryUpstream(result)) {
    attempt += 1;
    const jitter = Math.floor(Math.random() * 80);
    await waitMs(delay * attempt + jitter);
    result = await callAiUpstream(incomingPayload, options);
  }
  return result;
};

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

const deriveOpenAiBaseUrl = (apiUrl) => {
  const raw = envText(apiUrl, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.endsWith('/chat/completions')) {
      parsed.pathname = parsed.pathname.replace(/\/chat\/completions$/, '');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
  }
};

const resolveClineBin = () => {
  const candidates = [
    flashCliCommand,
    '/app/node_modules/.bin/cline',
    'cline'
  ];
  for (const candidate of candidates) {
    const cmd = envText(candidate, '');
    if (!cmd) continue;
    if (cmd.includes('/') && fs.existsSync(cmd)) return cmd;
    if (!cmd.includes('/')) return cmd;
  }
  return 'cline';
};

const runSpawnCapture = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || '/app',
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (typeof options.onSpawn === 'function') {
      try {
        options.onSpawn(child);
      } catch {
        // ignore callback errors
      }
    }

    let stdout = '';
    let stderr = '';
    let timer = null;
    let killedByTimeout = false;

    if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        killedByTimeout = true;
        child.kill('SIGKILL');
      }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
      if (stdout.length > 8000) stdout = stdout.slice(-8000);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (typeof options.onDone === 'function') {
        try {
          options.onDone(child);
        } catch {
          // ignore callback errors
        }
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (typeof options.onDone === 'function') {
        try {
          options.onDone(child);
        } catch {
          // ignore callback errors
        }
      }
      resolve({
        code: Number(code || 0),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut: killedByTimeout
      });
    });
  });
};

const summarizeCommandOutput = (stdout, stderr, maxChars = 1800) => {
  const text = `${String(stdout || '')}\n${String(stderr || '')}`.trim();
  if (!text) return '';
  const compact = text
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .trim();
  if (compact.length <= maxChars) return compact;
  return compact.slice(-maxChars);
};

const normalizeImportSpecifier = (value) => {
  const text = String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/[?#].*$/, '')
    .trim();
  return text;
};

const specifierToPackageName = (specifier) => {
  const target = normalizeImportSpecifier(specifier);
  if (!target) return '';
  if (
    target.startsWith('.') ||
    target.startsWith('/') ||
    target.startsWith('@/') ||
    target.startsWith('~/') ||
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('data:') ||
    target.startsWith('node:') ||
    target.startsWith('virtual:')
  ) {
    return '';
  }

  if (target.startsWith('@')) {
    const parts = target.split('/').filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return '';
  }

  return target.split('/')[0] || '';
};

const collectMissingPackagesFromBuildLog = (logText) => {
  const text = String(logText || '');
  if (!text) return [];
  const patterns = [
    /Cannot find package ['"]([^'"\r\n]+)['"]/gi,
    /Cannot find module ['"]([^'"\r\n]+)['"]/gi,
    /Failed to resolve import ["']([^"'\r\n]+)["']/gi,
    /Could not resolve ["']([^"'\r\n]+)["']/gi
  ];

  const names = new Set();
  patterns.forEach((pattern) => {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const pkg = specifierToPackageName(match[1]);
      if (pkg) names.add(pkg);
      match = pattern.exec(text);
    }
  });
  return Array.from(names).slice(0, 6);
};

const isDraftScopedBuildFailure = (logText) => {
  const text = String(logText || '');
  if (!text) return false;
  if (/FlashDraft\.vue/i.test(text)) return true;
  if (/src\/views\/drafts\//i.test(text)) return true;
  const normalizedProject = normalizeProjectPath(flashCliProjectPath);
  if (normalizedProject && text.includes(normalizedProject)) return true;
  return false;
};

const detectPackageManager = (workdir) => {
  const files = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm']
  ];
  for (const [name, manager] of files) {
    try {
      if (fs.existsSync(path.join(workdir, name))) return manager;
    } catch {
      // ignore
    }
  }
  return 'npm';
};

const runBuildCommand = async (workdir, manager, options = {}) => {
  const selected = manager || detectPackageManager(workdir);
  if (selected === 'pnpm') {
    return runSpawnCapture('pnpm', ['build'], {
      cwd: workdir,
      timeoutMs: flashCliBuildTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  if (selected === 'yarn') {
    return runSpawnCapture('yarn', ['build'], {
      cwd: workdir,
      timeoutMs: flashCliBuildTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  return runSpawnCapture('npm', ['run', 'build'], {
    cwd: workdir,
    timeoutMs: flashCliBuildTimeoutMs,
    onSpawn: options.onSpawn,
    onDone: options.onDone
  });
};

const runInstallCommand = async (workdir, manager, packages, options = {}) => {
  const list = Array.isArray(packages) ? packages.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!list.length) return { code: 0, stdout: '', stderr: '', timedOut: false };
  const selected = manager || detectPackageManager(workdir);
  if (selected === 'pnpm') {
    return runSpawnCapture('pnpm', ['add', ...list], {
      cwd: workdir,
      timeoutMs: flashCliInstallTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  if (selected === 'yarn') {
    return runSpawnCapture('yarn', ['add', ...list], {
      cwd: workdir,
      timeoutMs: flashCliInstallTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  return runSpawnCapture('npm', ['install', '--save', '--no-audit', '--no-fund', ...list], {
    cwd: workdir,
    timeoutMs: flashCliInstallTimeoutMs,
    onSpawn: options.onSpawn,
    onDone: options.onDone
  });
};

const runWithManagerFallback = async (fn, manager) => {
  const primary = manager || 'npm';
  try {
    const result = await fn(primary);
    return { manager: primary, result };
  } catch (error) {
    const missingBinary = String(error?.message || '').includes('ENOENT');
    if (!missingBinary || primary === 'npm') throw error;
    const fallbackResult = await fn('npm');
    return { manager: 'npm', result: fallbackResult };
  }
};

const parseClineCapturedEvents = (rawText) => {
  const lines = String(rawText || '').split(/\r?\n/);
  const assistantChunks = [];
  let taskId = '';
  let errorText = '';

  lines.forEach((line) => {
    const parsed = parseJsonMaybe(line);
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.type === 'task_started' && parsed.taskId) {
      taskId = String(parsed.taskId);
      return;
    }
    if (!errorText && parsed.type === 'error') {
      errorText = normalizeAiText(parsed.message || parsed.text || '');
      return;
    }
    if (parsed.type === 'say') {
      const sayText = normalizeAiText(parsed.text);
      if (!shouldForwardClineSay(parsed.say, sayText)) return;
      assistantChunks.push(sayText);
    }
  });

  return { assistantChunks, taskId, errorText };
};

const buildFlashSelfHealPrompt = (originalPrompt, buildLog) => {
  const safePrompt = normalizeAiText(originalPrompt) || '继续修复当前草稿';
  const safeLog = summarizeCommandOutput(buildLog, '', 1600) || '构建失败但未返回详细日志。';
  return [
    '上一轮生成后执行前端构建失败，请直接修复问题直到构建通过。',
    '仅允许修改当前草稿目录文件，不要触碰路由、鉴权、基座。',
    '若错误来自导入路径/语法/类型，请直接修复代码。',
    '禁止输出思考过程、上下文复述、环境信息。',
    `原始需求：${safePrompt}`,
    '构建失败摘要：',
    safeLog
  ].join('\n');
};

const runFlashBuildSelfHeal = async ({
  ws,
  sessionId,
  session,
  clineBin,
  configDir,
  model,
  prompt,
  taskWorkdir
}) => {
  if (!flashCliBuildValidateEnabled) {
    return { success: true, skipped: true };
  }

  const buildWorkdir = resolveFlashBuildWorkdir(taskWorkdir);
  const packageJson = path.join(buildWorkdir, 'package.json');
  if (!fs.existsSync(packageJson)) {
    return { success: true, skipped: true };
  }

  let manager = detectPackageManager(buildWorkdir);
  const installedPackages = new Set();
  let round = 0;
  let lastBuildLog = '';
  const bindSessionProcess = {
    onSpawn: (child) => {
      session.process = child;
    },
    onDone: (child) => {
      if (session.process === child) {
        session.process = null;
      }
    }
  };

  while (round <= flashCliSelfHealMaxRounds) {
    sendWsJson(ws, {
      type: 'flash:cline_status',
      sessionId,
      status: 'validating',
      message: round === 0 ? '正在校验草稿编译结果...' : `正在验证修复结果（第 ${round} 轮）...`
    });

    const buildRun = await runWithManagerFallback(
      (selected) => runBuildCommand(buildWorkdir, selected, bindSessionProcess),
      manager
    );
    manager = buildRun.manager;
    const buildResult = buildRun.result;

    if (!buildResult.timedOut && Number(buildResult.code || 0) === 0) {
      if (installedPackages.size > 0) {
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'deps_installed',
          message: `已自动安装依赖：${Array.from(installedPackages).join(', ')}`
        });
      }
      return { success: true, installedPackages: Array.from(installedPackages), rounds: round };
    }

    lastBuildLog = summarizeCommandOutput(buildResult.stdout, buildResult.stderr, 2200);
    const missingPackages = flashCliAutoInstallDeps
      ? collectMissingPackagesFromBuildLog(lastBuildLog).filter((pkg) => !installedPackages.has(pkg))
      : [];
    const draftScopedFailure = isDraftScopedBuildFailure(lastBuildLog);

    if (!draftScopedFailure && missingPackages.length === 0) {
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'validate_warn',
        message: '检测到非草稿历史构建错误，已跳过阻塞式修复，不影响当前草稿输出。'
      });
      return { success: true, skipped: true };
    }

    if (missingPackages.length > 0) {
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'installing',
        message: `检测到缺失依赖，自动安装：${missingPackages.join(', ')}`
      });

      const installRun = await runWithManagerFallback(
        (selected) => runInstallCommand(buildWorkdir, selected, missingPackages, bindSessionProcess),
        manager
      );
      manager = installRun.manager;
      const installResult = installRun.result;
      if (installResult.timedOut || Number(installResult.code || 0) !== 0) {
        const installError = summarizeCommandOutput(installResult.stdout, installResult.stderr, 800);
        return {
          success: false,
          error: `自动安装依赖失败：${installError || 'unknown error'}`
        };
      }
      missingPackages.forEach((pkg) => installedPackages.add(pkg));
      continue;
    }

    if (round >= flashCliSelfHealMaxRounds) {
      return {
        success: false,
        error: `自动修复后仍构建失败：${lastBuildLog || 'no build output'}`
      };
    }

    round += 1;
    sendWsJson(ws, {
      type: 'flash:cline_status',
      sessionId,
      status: 'self_heal',
      message: `检测到构建失败，正在自动修复（${round}/${flashCliSelfHealMaxRounds}）...`
    });

    const repairPrompt = buildFlashSelfHealPrompt(prompt, lastBuildLog);
    const repairArgs = buildFlashCliArgs({
      configDir,
      model,
      taskId: session.taskId,
      prompt: repairPrompt,
      workdir: taskWorkdir
    });
    const repairResult = await runSpawnCapture(clineBin, repairArgs, {
      cwd: '/app',
      timeoutMs: flashCliTaskTimeoutMs,
      onSpawn: bindSessionProcess.onSpawn,
      onDone: bindSessionProcess.onDone
    });
    const repairEvents = parseClineCapturedEvents(`${repairResult.stdout}\n${repairResult.stderr}`);
    if (repairEvents.taskId) {
      session.taskId = repairEvents.taskId;
    }
    repairEvents.assistantChunks.forEach((chunk) => {
      sendWsJson(ws, {
        type: 'flash:cline_output',
        sessionId,
        role: 'assistant',
        content: chunk,
        eventType: 'say',
        say: 'self_heal'
      });
    });

    if (repairResult.timedOut) {
      return {
        success: false,
        error: `自动修复超时（>${flashCliTaskTimeoutMs}ms）`
      };
    }
    if (Number(repairResult.code || 0) !== 0) {
      const repairError = repairEvents.errorText || summarizeCommandOutput(repairResult.stdout, repairResult.stderr, 900);
      return {
        success: false,
        error: `自动修复失败：${repairError || 'unknown error'}`
      };
    }
  }

  return {
    success: false,
    error: `自动修复达到上限（${flashCliSelfHealMaxRounds}）仍未通过构建`
  };
};

const clampFlashHistory = (history) => {
  if (!Array.isArray(history)) return [];
  const items = history
    .map((item) => {
      const role = String(item?.role || '').toLowerCase();
      const content = normalizeAiText(item?.content);
      if ((role !== 'user' && role !== 'assistant') || !content) return null;
      return { role, content: content.slice(0, 1600) };
    })
    .filter(Boolean);
  const limit = Number.isFinite(flashCliHistoryLimit) && flashCliHistoryLimit > 0
    ? Math.floor(flashCliHistoryLimit)
    : 10;
  return items.slice(-limit);
};

const buildFlashCliPrompt = (prompt, history = []) => {
  const cleanPrompt = normalizeAiText(prompt);
  const lines = [
    '你是闪念应用开发助手，只允许在当前工作目录内编辑应用草稿。',
    '硬性约束：只能修改 FlashDraft.vue 及其同目录草稿文件，不要触碰路由/鉴权/核心基座文件。',
    '输出要求：先给结果，再给关键变更点，尽量简洁。',
    '严禁输出思考过程、任务计划、系统提示、工作目录、环境信息和历史上下文原文。',
    '禁止出现“用户要求”“当前用户请求”“以下是最近上下文”“从环境信息来看”等复述语句。'
  ];

  if (history.length > 0) {
    lines.push('以下是最近上下文：');
    history.forEach((item, idx) => {
      lines.push(`${idx + 1}. [${item.role}] ${item.content}`);
    });
  }

  lines.push('当前用户请求：');
  lines.push(cleanPrompt || '请继续优化当前草稿。');
  return lines.join('\n');
};

const shouldForwardClineSay = (sayType, text) => {
  const key = String(sayType || '').trim().toLowerCase();
  if (!text) return false;
  const blocked = new Set([
    'task',
    'reasoning',
    'tool',
    'task_progress',
    'api_req_started',
    'api_req_finished',
    'api_req_retried',
    'api_req_completed',
    'command',
    'command_output'
  ]);
  if (blocked.has(key)) return false;
  if (text.includes('<environment_details>') || text.includes('<task>')) return false;
  return true;
};

const parseClineRetryMessage = (event) => {
  if (event?.type !== 'say' || event?.say !== 'error_retry') return '';
  const parsed = parseJsonMaybe(event?.text);
  if (!parsed) return '上游请求失败，正在重试...';
  const attempt = Number(parsed.attempt || 0);
  const maxAttempts = Number(parsed.maxAttempts || 0);
  if (attempt > 0 && maxAttempts > 0) {
    return `上游请求失败，自动重试 ${attempt}/${maxAttempts}...`;
  }
  return '上游请求失败，正在重试...';
};

const createFlashCliSession = () => ({
  taskId: '',
  running: false,
  process: null
});

const killFlashCliSessionProcess = (session) => {
  if (!session?.process) return;
  try {
    session.process.kill('SIGKILL');
  } catch {
    // ignore
  } finally {
    session.process = null;
    session.running = false;
  }
};

const buildFlashCliArgs = ({ configDir, model, taskId, prompt, workdir }) => {
  const args = [
    'task',
    '--json',
    '--act',
    '--yolo',
    '--timeout',
    String(Math.max(30, Math.floor(flashCliTaskTimeoutMs / 1000))),
    '--config',
    configDir,
    '--cwd',
    workdir
  ];
  if (model) {
    args.push('--model', model);
  }
  if (taskId) {
    args.push('-T', taskId);
  }
  args.push(prompt);
  return args;
};

const ENTERPRISE_FILLER_LINE_RE = /^(好的|当然|收到|已收到|明白|了解|下面|以下|我将|我会|先给出|先汇总|请查看|这里是).{0,100}(经营分析|经营报告|分析报告|报告|图表|洞察|结论)/;
const ENTERPRISE_FILLER_SENTENCE_RE = /(好的|当然|收到|已收到|明白|了解)[，,。！!\s].{0,90}(经营分析|经营报告|分析报告|报告)/g;
const ECHARTS_FENCE_RE_GLOBAL = /```[\t ]*echarts[^\r\n]*\r?\n([\s\S]*?)```/gi;
const ECHARTS_FENCE_RE_SINGLE = /```[\t ]*echarts[^\r\n]*\r?\n([\s\S]*?)```/i;

const stripEnterprisePreambleText = (rawText) => {
  const source = normalizeAiText(rawText);
  if (!source) return '';

  const lines = source.split(/\r?\n/);
  const cleaned = [];
  let removedLineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleaned.push(line);
      continue;
    }
    if (
      removedLineCount < 5 &&
      ENTERPRISE_FILLER_LINE_RE.test(trimmed) &&
      trimmed.length <= 180 &&
      !trimmed.startsWith('```')
    ) {
      removedLineCount += 1;
      continue;
    }
    cleaned.push(line.replace(ENTERPRISE_FILLER_SENTENCE_RE, '').trimEnd());
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const sanitizeJsonLikeText = (raw) => {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  cleaned = cleaned.replace(/^\uFEFF/, '');
  cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
  cleaned = cleaned.replace(/^\s*[^={[]*=\s*/, '');

  const firstBrace = cleaned.search(/[{[]/);
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  const lastCurly = cleaned.lastIndexOf('}');
  const lastSquare = cleaned.lastIndexOf(']');
  const lastBrace = Math.max(lastCurly, lastSquare);
  if (lastBrace > 0) cleaned = cleaned.slice(0, lastBrace + 1);
  return cleaned.trim();
};

const parseJsonSafe = (raw) => {
  const text = sanitizeJsonLikeText(raw);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/'/g, '"'));
    } catch {
      return null;
    }
  }
};

const stripFunctionValueBlocks = (input) => {
  const text = String(input || '');
  if (!text.includes(': function')) return text;
  let out = '';
  let cursor = 0;
  while (cursor < text.length) {
    const fnToken = text.indexOf(': function', cursor);
    if (fnToken < 0) {
      out += text.slice(cursor);
      break;
    }

    out += text.slice(cursor, fnToken) + ': null';
    let i = fnToken + 1;
    const keyword = text.indexOf('function', i);
    if (keyword < 0) {
      cursor = fnToken + 1;
      continue;
    }
    i = keyword + 'function'.length;
    while (i < text.length && text[i] !== '{') i += 1;
    if (i >= text.length) {
      cursor = text.length;
      break;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
    }
    cursor = i;
  }
  return out;
};

const normalizeEchartsOption = (option) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
  const cloned = JSON.parse(JSON.stringify(option));

  if (cloned.series && !Array.isArray(cloned.series)) {
    cloned.series = [cloned.series];
  }
  if (!Array.isArray(cloned.series)) return null;
  cloned.series = cloned.series.filter((item) => item && typeof item === 'object');
  if (cloned.series.length === 0) return null;

  cloned.series = cloned.series.map((series) => {
    const next = { ...series };
    if (!normalizeAiText(next.type)) next.type = 'line';
    return next;
  });

  const needsAxis = cloned.series.some((series) => {
    const type = String(series.type || '').toLowerCase();
    return ['line', 'bar', 'scatter'].includes(type);
  });
  if (needsAxis) {
    if (!cloned.xAxis) cloned.xAxis = { type: 'category', data: [] };
    if (!cloned.yAxis) cloned.yAxis = { type: 'value' };
  }
  if (!cloned.tooltip) {
    cloned.tooltip = { trigger: needsAxis ? 'axis' : 'item' };
  }

  return cloned;
};

const validateEchartsOption = (option) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return false;
  if (!Array.isArray(option.series) || option.series.length === 0) return false;
  return option.series.every((series) => {
    if (!series || typeof series !== 'object') return false;
    return !!normalizeAiText(series.type);
  });
};

const buildFallbackEchartsOption = () => ({
  animation: false,
  grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
  xAxis: { type: 'category', show: false, data: [''] },
  yAxis: { type: 'value', show: false },
  tooltip: { show: false },
  series: [{
    name: '',
    type: 'line',
    data: [0],
    showSymbol: false,
    lineStyle: { opacity: 0 },
    itemStyle: { opacity: 0 },
    areaStyle: { opacity: 0 }
  }]
});

const extractEchartsBlocks = (text) => {
  const source = normalizeAiText(text);
  if (!source) return [];
  ECHARTS_FENCE_RE_GLOBAL.lastIndex = 0;
  const blocks = [];
  let match;
  while ((match = ECHARTS_FENCE_RE_GLOBAL.exec(source)) !== null) {
    blocks.push({
      start: match.index,
      end: ECHARTS_FENCE_RE_GLOBAL.lastIndex,
      full: match[0],
      body: match[1] || ''
    });
  }
  return blocks;
};

const extractEchartsJsonPayload = (rawText) => {
  const source = normalizeAiText(rawText);
  if (!source) return '';
  const blockMatch = source.match(ECHARTS_FENCE_RE_SINGLE);
  if (blockMatch?.[1]) return blockMatch[1].trim();
  const firstCurly = source.indexOf('{');
  const lastCurly = source.lastIndexOf('}');
  if (firstCurly >= 0 && lastCurly > firstCurly) {
    return source.slice(firstCurly, lastCurly + 1);
  }
  return source.trim();
};

const repairEchartsBlockWithAi = async ({ cfg, agentRuntime, latestUserText, rawBlock, reason }) => {
  const question = normalizeAiText(latestUserText).slice(0, 1200);
  const source = normalizeAiText(rawBlock).slice(0, 8000);
  if (!source) return null;

  const guardPrompt = [
    '你是 ECharts JSON 修复器。',
    '只输出严格合法的 JSON 对象，不要输出解释，不要输出 markdown 代码块。',
    '输出必须可直接 JSON.parse，并可被 ECharts setOption 使用。',
    '必须包含非空 series 数组；每个 series 必须有 type。',
    '禁止注释、禁止尾逗号、禁止单引号键名。',
    '禁止输出任何函数（formatter、itemStyle.color function 等）；需要格式化时改为静态字符串或数组。'
  ].join('\n');

  const upstream = await callAiUpstreamWithRetry({
    stream: false,
    messages: [
      { role: 'system', content: guardPrompt },
      {
        role: 'user',
        content: `用户问题：${question || '（未提供）'}\n修复原因：${normalizeAiText(reason) || 'JSON不可解析'}\n原始 ECharts 内容：\n${source}`
      }
    ]
  }, { cfg, agentRuntime, forceStream: false }, { maxRetries: 3, baseDelayMs: 260 });

  if (!upstream.ok || upstream.stream) return null;
  const candidate = stripFunctionValueBlocks(
    extractEchartsJsonPayload(cleanModelText(extractCompletionText(upstream.data)))
  );
  const parsed = parseJsonSafe(candidate);
  const normalized = normalizeEchartsOption(parsed);
  if (!validateEchartsOption(normalized)) return null;
  return normalized;
};

const normalizeEnterpriseEchartsBlocks = async ({ rawText, cfg, agentRuntime, latestUserText }) => {
  const source = normalizeAiText(rawText);
  if (!source) return { text: '', changed: false };
  const blocks = extractEchartsBlocks(source);
  if (blocks.length === 0) return { text: source, changed: false };

  let cursor = 0;
  let output = '';
  let changed = false;

  for (const block of blocks) {
    output += source.slice(cursor, block.start);
    cursor = block.end;

    let option = normalizeEchartsOption(parseJsonSafe(stripFunctionValueBlocks(block.body)));
    if (!validateEchartsOption(option)) {
      for (let attempt = 0; attempt < 6 && !validateEchartsOption(option); attempt += 1) {
        option = await repairEchartsBlockWithAi({
          cfg,
          agentRuntime,
          latestUserText,
          rawBlock: block.body,
          reason: `ECharts JSON parse/validate failed (attempt ${attempt + 1})`
        });
      }
    }
    if (!validateEchartsOption(option)) {
      option = buildFallbackEchartsOption();
    }

    const replacement = `\`\`\`echarts\n${JSON.stringify(option, null, 2)}\n\`\`\``;
    if (replacement !== block.full) changed = true;
    output += replacement;
  }

  output += source.slice(cursor);
  return { text: output, changed };
};

const rewriteEnterpriseResponse = async ({ cfg, agentRuntime, latestUserText, rawAnswer }) => {
  const answer = normalizeAiText(rawAnswer).slice(0, 20000);
  if (!answer) return '';
  const question = normalizeAiText(latestUserText).slice(0, 4000);
  const guardPrompt = [
    '你是企业经营分析智能体的输出守卫。',
    '你需要把回答改写为经营分析结果，禁止任何流程编排相关内容。',
    '严格删除：BPMN XML、workflow-meta、Mermaid流程图、审批节点定义。',
    '去掉客套开场语（如“好的、收到、我将…”），直接给报告正文。',
    '保持原回答中的经营分析结论和可执行建议。',
    '只输出最终正文，不要解释你做了什么。'
  ].join('\n');

  const upstream = await callAiUpstreamWithRetry({
    stream: false,
    messages: [
      { role: 'system', content: guardPrompt },
      {
        role: 'user',
        content: `用户问题：${question || '（未提供）'}\n\n原始回答：\n${answer}`
      }
    ]
  }, { cfg, agentRuntime, forceStream: false }, { maxRetries: 1, baseDelayMs: 240 });

  if (!upstream.ok || upstream.stream) return '';
  return cleanModelText(extractCompletionText(upstream.data));
};

const applyEnterpriseOutputGuard = async ({ data, route, cfg, agentRuntime }) => {
  if (!shouldApplyEnterpriseOutputGuard(route)) {
    return { guardedData: data, guardApplied: false };
  }

  const rawText = extractCompletionText(data);
  let guardedText = normalizeAiText(rawText);
  if (!guardedText) {
    return { guardedData: data, guardApplied: false };
  }

  let guardApplied = false;

  if (containsWorkflowLeak(guardedText)) {
    const rewritten = await rewriteEnterpriseResponse({
      cfg,
      agentRuntime,
      latestUserText: route?.latestUserText,
      rawAnswer: guardedText
    });
    if (rewritten) {
      guardedText = rewritten;
      guardApplied = true;
    }
  }

  const noPreambleText = stripEnterprisePreambleText(guardedText);
  if (noPreambleText && noPreambleText !== guardedText) {
    guardedText = noPreambleText;
    guardApplied = true;
  }

  const chartGuarded = await normalizeEnterpriseEchartsBlocks({
    rawText: guardedText,
    cfg,
    agentRuntime,
    latestUserText: route?.latestUserText
  });
  if (chartGuarded.changed && chartGuarded.text) {
    guardedText = chartGuarded.text;
    guardApplied = true;
  }

  if (!guardApplied) {
    return { guardedData: data, guardApplied: false };
  }

  return {
    guardedData: replaceCompletionText(data, guardedText),
    guardApplied: true
  };
};

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
  const user = asUser(payload);
  if (!canUseAi(user)) {
    sendJson(res, 403, { code: 'FORBIDDEN', message: 'AI access denied for current role' });
    return null;
  }
  return user;
};

const handleAiConfig = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  try {
    const cfg = await getAiConfig();
    const agents = buildAgentCatalog(user, cfg);
    sendJson(res, 200, {
      enabled: !!(cfg?.api_url && cfg?.api_key),
      model: cfg?.model || 'glm-4.6v',
      provider: cfg?.provider || 'glm',
      stream: true,
      agents
    });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_CONFIG_LOAD_FAILED', message: error.message || 'Failed to load AI config' });
  }
};

const handleAiAgents = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;
  try {
    const cfg = await getAiConfig();
    const agents = buildAgentCatalog(user, cfg);
    sendJson(res, 200, { role: user.role || '', agents });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_CONFIG_LOAD_FAILED', message: error.message || 'Failed to load AI config' });
  }
};

const handleAiChat = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  try {
    const cfg = await getAiConfig();
    const sanitizedMessages = sanitizeConversationMessages(body?.messages);
    const route = resolveAgentRoute({ user, body, messages: sanitizedMessages });
    const agentRuntime = resolveAgentRuntimeConfig(cfg, route.agentId);
    const useStream = body?.stream === true;
    const requiresGuard = shouldApplyEnterpriseOutputGuard(route);
    const upstreamPayload = {
      ...body,
      messages: composeAgentMessages({ route, user, messages: sanitizedMessages })
    };
    console.log('[ai-route]', JSON.stringify({
      role: user.role || '',
      mode: route.requestedMode,
      intent: route.intent,
      agent: route.agentId,
      model: agentRuntime.model,
      guard: requiresGuard,
      sample: route.latestUserText.slice(0, 120)
    }));

    const upstream = await callAiUpstreamWithRetry(upstreamPayload, {
      forceStream: useStream && !requiresGuard,
      cfg,
      agentRuntime
    }, {
      maxRetries: 2,
      baseDelayMs: 320
    });
    if (!upstream.ok) {
      sendJson(res, upstream.status, upstream.payload);
      return;
    }

    if (!upstream.stream) {
      const guarded = await applyEnterpriseOutputGuard({
        data: upstream.data || {},
        route,
        cfg,
        agentRuntime
      });
      const headers = {
        'X-Eis-Ai-Agent': route.agentId,
        'X-Eis-Ai-Intent': route.intent,
        'X-Eis-Ai-Guard': guarded.guardApplied ? 'rewrite' : 'pass'
      };

      if (!useStream) {
        sendJson(res, 200, guarded.guardedData || {}, headers);
        return;
      }

      setCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...headers
      });
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      streamTextAsSse(res, extractCompletionText(guarded.guardedData || {}));
      return;
    }

    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Eis-Ai-Agent': route.agentId,
      'X-Eis-Ai-Intent': route.intent,
      'X-Eis-Ai-Guard': 'stream-pass'
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const stream = upstream.response.body;
    if (!stream || typeof stream.getReader !== 'function') {
      sendJson(res, 502, { code: 'AI_STREAM_FAILED', message: 'AI upstream stream is unavailable' });
      return;
    }

    const reader = stream.getReader();
    const abortStream = () => {
      reader.cancel().catch(() => {});
    };
    req.on('close', abortStream);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && !res.writableEnded) {
          res.write(Buffer.from(value));
        }
      }
      if (!res.writableEnded) res.end();
    } catch (e) {
      if (!res.writableEnded) {
        res.write('data: {"error":"stream_failed"}\n\n');
        res.end();
      }
    } finally {
      req.off('close', abortStream);
      try {
        reader.releaseLock();
      } catch (err) {
        // ignore
      }
    }
  } catch (error) {
    sendJson(res, 500, { code: 'AI_CHAT_FAILED', message: error.message || 'AI chat failed' });
  }
};

const handleAiTranslate = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const text = normalizeAiText(body?.text);
  if (!text) {
    sendJson(res, 400, { code: 'TEXT_REQUIRED', message: 'text is required' });
    return;
  }

  const systemPrompt = normalizeAiText(body?.prompt) ||
    '你是翻译助手。把用户输入翻译成简洁、自然的中文地址，只输出翻译结果，不要添加任何解释。若输入已是中文，原样输出。';

  try {
    const upstream = await callAiUpstreamWithRetry({
      model: body?.model,
      stream: false,
      thinking: body?.thinking || { type: 'disabled' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    }, { forceStream: false }, { maxRetries: 1, baseDelayMs: 260 });

    if (!upstream.ok) {
      sendJson(res, upstream.status, upstream.payload);
      return;
    }

    const translated = cleanModelText(extractCompletionText(upstream.data));
    sendJson(res, 200, { text: translated || text });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_TRANSLATE_FAILED', message: error.message || 'Translate failed' });
  }
};

const handleAiMapLocate = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const imageUrl = normalizeAiText(body?.imageUrl || body?.image_url);
  const lat = body?.lat;
  const lng = body?.lng;
  if (!imageUrl) {
    sendJson(res, 400, { code: 'IMAGE_REQUIRED', message: 'imageUrl is required' });
    return;
  }

  const prompt = normalizeAiText(body?.prompt) ||
    `请根据地图截图上的中文地名，且以蓝色圆点为用户当前位置，找出离蓝点最近的街道级位置。输出严格格式的中文位置：“省-市-区/县/县级市-街道/乡镇”。必须包含街道级；如果无法确定街道，请用“某街道”或“附近街道”占位，但仍要输出四段。只输出位置，不要解释，不要多余的话。坐标：${lng},${lat}`;

  try {
    const upstream = await callAiUpstreamWithRetry({
      model: body?.model,
      stream: false,
      thinking: body?.thinking || { type: 'disabled' },
      messages: [
        { role: 'system', content: '你是位置识别助手，只输出中文位置名称。' },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ]
    }, { forceStream: false }, { maxRetries: 1, baseDelayMs: 260 });

    if (!upstream.ok) {
      sendJson(res, upstream.status, upstream.payload);
      return;
    }

    const address = cleanModelText(extractCompletionText(upstream.data));
    sendJson(res, 200, { address });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_MAP_LOCATE_FAILED', message: error.message || 'Map locate failed' });
  }
};

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
  return user;
};

const handleFlashDraftGet = async (req, res) => {
  const user = authorizeAgentHttpRequest(req, res);
  if (!user) return;
  try {
    const target = resolveFlashDraftFilePath();
    const content = await fs.promises.readFile(target, 'utf8');
    sendJson(res, 200, {
      path: normalizeProjectPath(`${flashCliProjectPath}/${flashDraftFileName}`),
      content,
      bytes: Buffer.byteLength(content, 'utf8')
    });
  } catch (error) {
    sendJson(res, 500, {
      code: 'FLASH_DRAFT_READ_FAILED',
      message: error?.message || 'Read flash draft failed'
    });
  }
};

const handleFlashDraftWrite = async (req, res) => {
  const user = authorizeAgentHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const content = String(body?.content || '');
  if (!content.trim()) {
    sendJson(res, 400, { code: 'CONTENT_REQUIRED', message: 'content is required' });
    return;
  }
  if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) {
    sendJson(res, 400, { code: 'CONTENT_TOO_LARGE', message: 'content exceeds 1MB limit' });
    return;
  }

  try {
    const target = resolveFlashDraftFilePath();
    await ensureDir(path.dirname(target));
    await fs.promises.writeFile(target, content, 'utf8');
    logAgentEvent('flash:draft_write', user, {
      bytes: Buffer.byteLength(content, 'utf8'),
      reason: normalizeAiText(body?.reason).slice(0, 80)
    });
    sendJson(res, 200, {
      ok: true,
      path: normalizeProjectPath(`${flashCliProjectPath}/${flashDraftFileName}`),
      bytes: Buffer.byteLength(content, 'utf8')
    });
  } catch (error) {
    sendJson(res, 500, {
      code: 'FLASH_DRAFT_WRITE_FAILED',
      message: error?.message || 'Write flash draft failed'
    });
  }
};

const server = http.createServer(async (req, res) => {
  const method = String(req.method || 'GET').toUpperCase();
  const pathname = getRequestPath(req);

  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/health') {
    sendJson(res, 200, { ok: true, channel });
    return;
  }

  if (pathname === '/ai/config' && method === 'GET') {
    await handleAiConfig(req, res);
    return;
  }

  if (pathname === '/ai/agents' && method === 'GET') {
    await handleAiAgents(req, res);
    return;
  }

  if (pathname === '/ai/chat/completions' && method === 'POST') {
    await handleAiChat(req, res);
    return;
  }

  if (pathname === '/ai/translate' && method === 'POST') {
    await handleAiTranslate(req, res);
    return;
  }

  if (pathname === '/ai/map-locate' && method === 'POST') {
    await handleAiMapLocate(req, res);
    return;
  }

  if (pathname === '/flash/draft' && method === 'GET') {
    await handleFlashDraftGet(req, res);
    return;
  }

  if (pathname === '/flash/draft' && method === 'POST') {
    await handleFlashDraftWrite(req, res);
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server, path: wsPath });

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

function sanitizeWritePolicy(rawPolicy) {
  const policy = (rawPolicy && typeof rawPolicy === 'object') ? rawPolicy : {};
  const allowedFiles = Array.isArray(policy.allowedFiles)
    ? policy.allowedFiles.map(normalizeRelativeAgentPath).filter(Boolean)
    : [];
  const allowedDirs = Array.isArray(policy.allowedDirs)
    ? policy.allowedDirs
      .map(normalizeRelativeAgentPath)
      .map((item) => item.replace(/\/+$/, ''))
      .filter(Boolean)
    : [];
  return { allowedFiles, allowedDirs };
}

function resolveDefaultWritePolicy(projectPath) {
  const normalizedProject = normalizeProjectPath(projectPath);
  if (normalizedProject === 'eiscore-apps/src/views/drafts') {
    return { allowedFiles: ['FlashDraft.vue'], allowedDirs: [] };
  }
  if (normalizedProject === 'eiscore-apps') {
    return { allowedFiles: ['src/views/drafts/FlashDraft.vue'], allowedDirs: [] };
  }
  return { allowedFiles: [], allowedDirs: [] };
}

const agentAllowedRoles = normalizeStringList(process.env.AGENT_ALLOWED_ROLES || 'super_admin')
  .map((role) => String(role).toLowerCase());
const agentAllowedProjects = normalizeStringList(
  process.env.AGENT_ALLOWED_PROJECTS ||
    'eiscore-apps/src/views/drafts,eiscore-apps,eiscore-base,eiscore-hr,eiscore-materials,realtime,scripts,sql,env,nginx,docs'
)
  .map((item) => normalizeProjectPath(item))
  .filter(Boolean);
const agentAllowAll = String(process.env.AGENT_ALLOW_ALL || '').toLowerCase() === 'true';

function canUseAgent(user) {
  if (agentAllowAll) return true;
  const role = String(user?.role || '').toLowerCase();
  return agentAllowedRoles.includes(role);
}

function isAllowedProject(projectPath) {
  const normalized = normalizeProjectPath(projectPath);
  if (!normalized) return false;
  return agentAllowedProjects.some((allowed) => (
    normalized === allowed || normalized.startsWith(`${allowed}/`)
  ));
}

function logAgentEvent(type, user, details) {
  const payload = {
    ts: new Date().toISOString(),
    type,
    user: { id: user?.id || '', role: user?.role || '' },
    details: details || {}
  };
  console.log('[agent]', JSON.stringify(payload));
}

function normalizeAgentTaskErrorMessage(error) {
  const text = String(error?.message || '').trim();
  if (!text) return 'Agent task execution failed';
  const lower = text.toLowerCase();
  if (lower.includes('connection error') || lower.includes('network error') || lower.includes('socket hang up')) {
    return 'AI upstream connection error';
  }
  if (lower.includes('timeout')) {
    return 'AI upstream timeout';
  }
  return text.slice(0, 300);
}

function createAgentTaskAiInvoker(cfg) {
  return async ({ model, maxTokens, systemPrompt, messages }) => {
    const payload = {
      model: String(model || cfg?.model || 'glm-4.6v').trim() || 'glm-4.6v',
      max_tokens: Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : 8192,
      stream: false,
      messages: [
        { role: 'system', content: normalizeAiText(systemPrompt) || '' },
        ...(Array.isArray(messages) ? messages : [])
          .map((item) => {
            const role = String(item?.role || '').trim();
            const content = normalizeAiText(item?.content);
            if (!role || !content) return null;
            return { role, content };
          })
          .filter(Boolean)
      ]
    };

    const upstream = await callAiUpstreamWithRetry(payload, {
      forceStream: false,
      cfg
    }, {
      maxRetries: 2,
      baseDelayMs: 320
    });

    if (!upstream.ok) {
      const detailText = normalizeAiText(upstream?.payload?.detail);
      const message = normalizeAiText(upstream?.payload?.message) || 'AI upstream request failed';
      const error = new Error(detailText ? `${message}: ${detailText}` : message);
      error.code = upstream?.payload?.code || 'AI_UPSTREAM_ERROR';
      error.status = Number(upstream?.status || 502);
      throw error;
    }

    const text = cleanModelText(extractCompletionText(upstream.data));
    if (!text) {
      throw new Error('AI upstream returned empty content');
    }
    return text;
  };
}

async function runFlashClineTask(ws, payload = {}) {
  if (!flashCliEnabled) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: 'Cline CLI shell mode is disabled by server policy'
    });
    return;
  }
  if (!flashCliRuntimeReady) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: `Node.js ${process.versions.node} is not supported by Cline CLI (requires >=20)`
    });
    return;
  }

  if (!canUseAgent(ws.user)) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: 'Forbidden: agent access denied'
    });
    logAgentEvent('flash:cline_denied', ws.user, { reason: 'role_denied' });
    return;
  }

  const normalizedProject = normalizeProjectPath(flashCliProjectPath) || 'eiscore-apps/src/views/drafts';
  if (!isAllowedProject(normalizedProject)) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: 'Forbidden: flash project path not allowed'
    });
    logAgentEvent('flash:cline_denied', ws.user, { reason: 'project_denied', projectPath: normalizedProject });
    return;
  }

  const sessionId = String(payload?.sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
  try {
  if (!ws.flashCliSessions) ws.flashCliSessions = new Map();
  if (!ws.flashCliSessions.has(sessionId)) {
    ws.flashCliSessions.set(sessionId, createFlashCliSession());
  }
  const session = ws.flashCliSessions.get(sessionId);
  if (session.running || session.process) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: '上一条请求尚未完成，请稍后再试'
    });
    return;
  }

  const prompt = normalizeAiText(payload?.prompt);
  if (!prompt) {
    sendWsJson(ws, { type: 'flash:cline_error', sessionId, error: 'Prompt is required' });
    return;
  }

  const cfg = await getAiConfig();
  if (!cfg?.api_key || !cfg?.api_url) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: 'AI configuration is missing in system_configs.ai_glm_config'
    });
    return;
  }

  const clineBin = resolveClineBin();
  const model = envText(payload?.model, envText(cfg?.model, 'gpt-4o'));
  const history = clampFlashHistory(payload?.history);
  const composedPrompt = buildFlashCliPrompt(prompt, history);
  const configDir = path.posix.join(flashCliConfigRoot, sessionId);
  const taskWorkdir = resolveFlashCliWorkdir();

  await ensureDir(configDir);
  await ensureDir(taskWorkdir);

  const baseUrl = deriveOpenAiBaseUrl(cfg.api_url);
  const authArgs = [
    'auth',
    '-p',
    flashCliProvider,
    '-k',
    String(cfg.api_key),
    '-m',
    model,
    '--config',
    configDir
  ];
  if (baseUrl) {
    authArgs.push('-b', baseUrl);
  }

  const authResult = await runSpawnCapture(clineBin, authArgs, {
    cwd: '/app',
    timeoutMs: flashCliAuthTimeoutMs
  });
  if (authResult.timedOut || authResult.code !== 0) {
    const authError = normalizeAiText(authResult.stderr || authResult.stdout || 'Cline auth failed');
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: `Cline auth failed: ${authError}`
    });
    logAgentEvent('flash:cline_auth_failed', ws.user, {
      sessionId,
      error: authError.slice(0, 400)
    });
    return;
  }

  const taskArgs = buildFlashCliArgs({
    configDir,
    model,
    taskId: session.taskId,
    prompt: composedPrompt,
    workdir: taskWorkdir
  });

  const child = spawn(clineBin, taskArgs, {
    cwd: '/app',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  session.running = true;
  session.process = child;
  let assistantChunks = [];
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let timeoutTriggered = false;
  const startedAt = Date.now();

  logAgentEvent('flash:cline_start', ws.user, {
    sessionId,
    model,
    workdir: taskWorkdir
  });
  sendWsJson(ws, {
    type: 'flash:cline_status',
    sessionId,
    status: 'running',
    message: 'Cline CLI 正在处理...'
  });

  const timeoutTimer = setTimeout(() => {
    timeoutTriggered = true;
    killFlashCliSessionProcess(session);
  }, flashCliTaskTimeoutMs);

  const flushCliLine = (line, source) => {
    const text = String(line || '').trim();
    if (!text) return;
    const parsed = parseJsonMaybe(text);
    if (!parsed) {
      if (source === 'stderr') {
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'log',
          message: text.slice(0, 240)
        });
      }
      return;
    }

    if (parsed.type === 'task_started' && parsed.taskId) {
      session.taskId = String(parsed.taskId);
      return;
    }

    if (parsed.type === 'error') {
      const errorText = normalizeAiText(parsed.message || parsed.text || 'Cline task failed');
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId,
        error: errorText
      });
      return;
    }

    const retryText = parseClineRetryMessage(parsed);
    if (retryText) {
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'retry',
        message: retryText
      });
      return;
    }

    if (parsed.type === 'ask' && parsed.ask === 'api_req_failed') {
      const askError = normalizeAiText(parsed.text || 'AI upstream request failed');
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId,
        error: askError
      });
      return;
    }

    if (parsed.type === 'say') {
      const sayText = normalizeAiText(parsed.text);
      if (!shouldForwardClineSay(parsed.say, sayText)) return;
      assistantChunks.push(sayText);
      sendWsJson(ws, {
        type: 'flash:cline_output',
        sessionId,
        role: 'assistant',
        content: sayText,
        eventType: 'say',
        say: parsed.say || ''
      });
    }
  };

  const consumeOutput = (chunk, source) => {
    const data = String(chunk || '');
    if (source === 'stdout') {
      stdoutBuffer += data;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      lines.forEach((line) => flushCliLine(line, source));
      return;
    }
    stderrBuffer += data;
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() || '';
    lines.forEach((line) => flushCliLine(line, source));
  };

  child.stdout.on('data', (chunk) => consumeOutput(chunk, 'stdout'));
  child.stderr.on('data', (chunk) => consumeOutput(chunk, 'stderr'));

  child.on('error', (error) => {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: normalizeAiText(error?.message || 'Cline process error')
    });
  });

  child.on('close', (code) => {
    (async () => {
      clearTimeout(timeoutTimer);
      if (stdoutBuffer.trim()) flushCliLine(stdoutBuffer, 'stdout');
      if (stderrBuffer.trim()) flushCliLine(stderrBuffer, 'stderr');

      let success = !timeoutTriggered && Number(code || 0) === 0;
      let exitCode = Number(code || 0);
      const elapsedMs = Date.now() - startedAt;
      const summary = assistantChunks.filter(Boolean).join('\n\n').trim();

      if (summary) {
        sendWsJson(ws, {
          type: 'flash:cline_summary',
          sessionId,
          role: 'assistant',
          content: summary
        });
      }
      if (timeoutTriggered) {
        sendWsJson(ws, {
          type: 'flash:cline_error',
          sessionId,
          error: `Cline task timeout after ${flashCliTaskTimeoutMs}ms`
        });
      } else if (success) {
        const healResult = await runFlashBuildSelfHeal({
          ws,
          sessionId,
          session,
          clineBin,
          configDir,
          model,
          prompt,
          taskWorkdir
        });
        if (!healResult.success) {
          success = false;
          exitCode = 2;
          sendWsJson(ws, {
            type: 'flash:cline_error',
            sessionId,
            error: healResult.error || '草稿构建校验失败'
          });
        }
      }

      session.running = false;
      session.process = null;
      sendWsJson(ws, {
        type: 'flash:cline_done',
        sessionId,
        success,
        exitCode,
        elapsedMs
      });
      logAgentEvent('flash:cline_done', ws.user, {
        sessionId,
        success,
        exitCode,
        elapsedMs
      });
    })().catch((error) => {
      session.running = false;
      session.process = null;
      const safeError = normalizeAiText(error?.message || 'Cline task post-check failed');
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId,
        error: safeError
      });
      sendWsJson(ws, {
        type: 'flash:cline_done',
        sessionId,
        success: false,
        exitCode: 2,
        elapsedMs: Date.now() - startedAt
      });
      logAgentEvent('flash:cline_done', ws.user, {
        sessionId,
        success: false,
        exitCode: 2,
        elapsedMs: Date.now() - startedAt,
        error: safeError
      });
    });
  });
  } catch (error) {
    const safeError = normalizeAiText(error?.message || 'Cline task failed');
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: safeError
    });
    logAgentEvent('flash:cline_failed', ws.user, {
      sessionId,
      error: safeError.slice(0, 400)
    });
  }
}

function extractPayloadMeta(rawPayload) {
  if (!rawPayload) return { id: null, targets: [], roles: [] };
  try {
    const parsed = JSON.parse(rawPayload);
    const id = parsed?.id ?? parsed?.record_id ?? parsed?.primary_key ?? null;
    const targets = normalizeStringList(parsed?.targets || parsed?.user_ids || parsed?.users);
    const roles = normalizeStringList(parsed?.roles || parsed?.role || parsed?.app_role);
    return { id, targets, roles };
  } catch {
    return { id: null, targets: [], roles: [] };
  }
}

function shouldSendToClient(client, meta, channelName) {
  if (client.readyState !== WebSocket.OPEN) return false;
  if (client.channels && !client.channels.has(channelName)) return false;
  if (meta.targets?.length) {
    return meta.targets.includes(String(client.user?.id || ''));
  }
  if (meta.roles?.length) {
    return meta.roles.includes(String(client.user?.role || ''));
  }
  return true;
}

function notifyClients(signal, meta) {
  const data = JSON.stringify(signal);
  wss.clients.forEach((client) => {
    if (shouldSendToClient(client, meta, signal.channel)) {
      client.send(data);
    }
  });
}

async function connectPg() {
  if (shuttingDown) return;
  if (pgClient) {
    try {
      await pgClient.end();
    } catch (err) {
      // ignore
    }
    pgClient = null;
  }

  pgClient = new Client({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres'
  });

  pgClient.on('notification', (msg) => {
    if (enableWorkflowAutoTransition && msg.channel === workflowChannel && workflowEngine) {
      workflowEngine.handleWorkflowEvent(msg.payload).catch((error) => {
        console.error('❌ Workflow notify error:', error.message);
      });
      return;
    }
    const meta = extractPayloadMeta(msg.payload);
    notifyClients(
      {
        type: 'db_notify',
        channel: msg.channel,
        id: meta.id,
        ts: new Date().toISOString()
      },
      meta
    );
  });

  pgClient.on('error', () => scheduleReconnect());
  pgClient.on('end', () => scheduleReconnect());

  try {
    await pgClient.connect();
    await pgClient.query(`LISTEN ${channel}`);
    if (enableWorkflowAutoTransition) {
      await pgClient.query(`LISTEN ${workflowChannel}`);

      // Optional auto-transition engine. Disabled by default to avoid overriding
      // explicit workflow state changes made by RPC endpoints/UI actions.
      workflowEngine = new WorkflowEngine({
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'postgres'
      });
      await workflowEngine.initialize();
      console.log('✅ Workflow engine initialized (auto-transition enabled)');
    } else {
      workflowEngine = null;
      console.log('ℹ️ Workflow auto-transition is disabled');
    }
  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (shuttingDown) return;
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectPg();
  }, 1000);
}

function shutdown() {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  wss.clients.forEach((client) => client.close());
  server.close(() => process.exit(0));
  if (pgClient) {
    pgClient.end().catch(() => process.exit(0));
  }
  if (workflowEngine) {
    workflowEngine.shutdown().catch(() => process.exit(0));
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, () => {
  connectPg();
});

wss.on('connection', (ws, req) => {
  const token = extractToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    ws.close(1008, 'unauthorized');
    return;
  }
  ws.user = {
    id: payload.user_id || payload.sub || payload.username || payload.email || '',
    role: payload.app_role || payload.role || ''
  };
  ws.channels = new Set([channel]);
  ws.agentConversation = null; // Will be initialized on agent:task
  ws.fileWatcher = null;
  ws.flashCliSessions = new Map();

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(String(message));
      if (!data || typeof data !== 'object') return;

      // Database notification subscriptions
      if (data.type === 'subscribe') {
        const list = normalizeStringList(data.channels);
        if (list.length) ws.channels = new Set(list);
        return;
      }
      if (data.type === 'unsubscribe') {
        const list = normalizeStringList(data.channels);
        list.forEach((ch) => ws.channels.delete(ch));
        return;
      }

      if (data.type === 'flash:cline_task') {
        await runFlashClineTask(ws, data);
        return;
      }

      if (data.type === 'flash:cline_stop') {
        const sessionId = String(data?.sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
        const session = ws.flashCliSessions?.get(sessionId);
        if (session) {
          killFlashCliSessionProcess(session);
          sendWsJson(ws, {
            type: 'flash:cline_status',
            sessionId,
            status: 'stopped',
            message: '已停止当前 Cline 任务'
          });
        }
        return;
      }

      if (data.type === 'flash:cline_reset') {
        const sessionId = String(data?.sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
        const session = ws.flashCliSessions?.get(sessionId);
        if (session) {
          killFlashCliSessionProcess(session);
          session.taskId = '';
        } else if (ws.flashCliSessions) {
          ws.flashCliSessions.set(sessionId, createFlashCliSession());
        }
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'reset',
          message: '会话已重置'
        });
        return;
      }

      // Agent: Start new task
      if (data.type === 'agent:task') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath: data.projectPath || '' });
          return;
        }
        const projectPath = normalizeProjectPath(data.projectPath) || 'eiscore-apps';
        if (!isAllowedProject(projectPath)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: project path not allowed'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath });
          return;
        }
        const cfg = await getAiConfig();
        if (!cfg?.api_url || !cfg?.api_key) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'AI configuration is missing in system_configs.ai_glm_config'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath, reason: 'ai_config_missing' });
          return;
        }
        const requestedPolicy = sanitizeWritePolicy(data.writePolicy);
        const defaultPolicy = resolveDefaultWritePolicy(projectPath);
        const hasRequestedRules = requestedPolicy.allowedFiles.length > 0 || requestedPolicy.allowedDirs.length > 0;
        const writePolicy = hasRequestedRules ? requestedPolicy : defaultPolicy;

        logAgentEvent('agent:task_start', ws.user, {
          projectPath,
          writePolicy
        });
        ws.agentConversation = new AgentConversation(projectPath, {
          writePolicy,
          model: cfg?.model || 'glm-4.6v',
          aiInvoker: createAgentTaskAiInvoker(cfg)
        });
        
        // Setup file watcher for HMR feedback
        if (ws.fileWatcher) ws.fileWatcher.stop();
        ws.fileWatcher = new FileWatcher(projectPath, (changeEvent) => {
          ws.send(JSON.stringify({
            type: 'agent:file_change',
            data: changeEvent
          }));
        });
        ws.fileWatcher.start();

        ws.send(JSON.stringify({
          type: 'agent:status',
          status: 'thinking',
          message: 'Processing your request...'
        }));

        try {
          // Execute task asynchronously
          const result = await ws.agentConversation.executeTask(data.prompt);
          ws.send(JSON.stringify({
            type: 'agent:result',
            success: result.success,
            executionLog: result.executionLog,
            totalTurns: result.totalTurns
          }));
          logAgentEvent('agent:task_result', ws.user, {
            projectPath,
            success: result.success,
            totalTurns: result.totalTurns
          });
        } catch (taskError) {
          const safeError = normalizeAgentTaskErrorMessage(taskError);
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: safeError,
            code: 'AGENT_TASK_FAILED'
          }));
          logAgentEvent('agent:task_failed', ws.user, {
            projectPath,
            error: safeError
          });
        }
        return;
      }

      // Agent: Execute specific tool
      if (data.type === 'agent:tool_use') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:tool_denied', ws.user, { tool: data.toolCall?.tool });
          return;
        }
        if (!ws.agentConversation) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'No active conversation. Send agent:task first.'
          }));
          return;
        }

        const result = await ws.agentConversation.executeToolCall(data.toolCall);
        ws.send(JSON.stringify({
          type: 'agent:tool_result',
          result
        }));
        logAgentEvent('agent:tool_result', ws.user, {
          tool: data.toolCall?.tool,
          success: result?.success !== false
        });
        return;
      }

      // Agent: Execute terminal command (limited)
      if (data.type === 'agent:terminal') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:terminal_denied', ws.user, { command: data.command || '' });
          return;
        }
        if (!ws.agentConversation) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'No active conversation.'
          }));
          return;
        }

        const result = await ws.agentConversation.tools.executeCommand(data.command);
        ws.send(JSON.stringify({
          type: 'agent:terminal_result',
          result
        }));
        logAgentEvent('agent:terminal_result', ws.user, {
          success: result?.success !== false
        });
        return;
      }

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    if (ws.fileWatcher) {
      ws.fileWatcher.stop();
    }
    if (ws.flashCliSessions) {
      ws.flashCliSessions.forEach((session) => killFlashCliSessionProcess(session));
      ws.flashCliSessions.clear();
    }
  });
});
