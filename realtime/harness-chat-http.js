'use strict';

const { applyHarnessOutputPolicy } = require('./harness-output-policy');

const CONTEXT_FORBIDDEN_KEYS = new Set([
  '__proto__', 'constructor', 'prototype',
  'api_key', 'apikey', 'api_url', 'apiurl', 'authorization', 'base_url', 'baseurl',
  'cookie', 'cookies', 'headers', 'jwt', 'model', 'org_id', 'organization_id', 'password', 'permissions', 'postgrest_url', 'provider',
  'role', 'roles', 'subject', 'sub', 'tenant', 'tenant_id', 'tenantid', 'token', 'user', 'user_id', 'userid', 'write_url', 'writeurl'
]);
const MAX_CONTEXT_DEPTH = 5;
const MAX_CONTEXT_CHARS = 24000;

const sanitizeMessageContent = (content) => {
  if (typeof content === 'string') return content.slice(0, 10000);
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (!part || typeof part !== 'object') return null;
    if (part.type === 'text' && typeof part.text === 'string') return { type: 'text', text: part.text.slice(0, 10000) };
    if (part.type === 'image_url') {
      const url = part.image_url?.url || part.url;
      return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url) ? { type: 'image_url', image_url: { url: url.slice(0, 4 * 1024 * 1024) } } : null;
    }
    return null;
  }).filter(Boolean).slice(0, 32);
};

const sanitizeMessages = (messages) => (Array.isArray(messages) ? messages : [])
  .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
  .map((message) => ({ role: message.role, content: sanitizeMessageContent(message.content) }))
  .filter((message) => message.content && (!Array.isArray(message.content) || message.content.length > 0))
  .slice(-24);

const sanitizeChatContext = (value, depth = 0) => {
  if (depth > MAX_CONTEXT_DEPTH) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeChatContext(item, depth + 1)).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return undefined;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = String(key).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (CONTEXT_FORBIDDEN_KEYS.has(normalizedKey) || CONTEXT_FORBIDDEN_KEYS.has(normalizedKey.replace(/_/g, ''))) continue;
    const safeValue = sanitizeChatContext(item, depth + 1);
    if (safeValue !== undefined) result[key] = safeValue;
  }
  const serialized = JSON.stringify(result);
  return serialized.length <= MAX_CONTEXT_CHARS ? result : { context_truncated: true };
};

const resolvePlugin = (body = {}) => {
  const requested = String(body.plugin_id || body.pluginId || '').trim();
  if (requested) return requested;
  const mode = String(body.assistant_mode || body.assistantMode || body.mode || '').trim().toLowerCase();
  if (mode === 'worker') return 'worker-grid';
  if (mode === 'workflow') return 'workflow';
  return 'enterprise-bi';
};

const DEFAULT_CHAT_CAPABILITIES = Object.freeze({
  'enterprise-bi': 'eiscore_enterprise_query',
  'worker-grid': 'eiscore_grid_query',
  'digital-twin': 'eiscore_twin_chat',
  workflow: 'eiscore_workflow_context',
  'company-sales': 'eiscore_sales_context',
  'document-intake': 'eiscore_document_plan',
  'flash-builder': 'eiscore_flash_read',
  engineering: 'eiscore_engineering_context',
  'independent-site-sales': 'eiscore_site_sales'
});

const resolveAgent = (plugin) => ({
  'enterprise-bi': 'enterprise_analyst',
  'worker-grid': 'worker_assistant',
  workflow: 'workflow_orchestrator',
  'digital-twin': 'digital_twin',
  'company-sales': 'company_sales_agent',
  'document-intake': 'document_intake',
  'flash-builder': 'flash_builder',
  engineering: 'engineering',
  'independent-site-sales': 'site_sales'
}[plugin] || 'enterprise_analyst');

const createHarnessChatHttpHandler = ({ authorize, readJsonBody, sendJson, gateway, setCorsHeaders, streamTextAsSse, enabled = true }) => async (req, res) => {
  const user = authorize(req, res);
  if (!user) return;
  if (!enabled) { sendJson(res, 503, { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' }); return; }
  let body;
  try { body = await readJsonBody(req); } catch (error) { sendJson(res, 400, { code: 'BAD_REQUEST', message: error?.message === 'Payload too large' ? 'Payload too large' : 'Invalid request body' }); return; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) { sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid request body' }); return; }
  const pluginId = resolvePlugin(body);
  const agentId = resolveAgent(pluginId);
  const capabilityId = String(DEFAULT_CHAT_CAPABILITIES[pluginId] || '').trim();
  if (!capabilityId) {
    sendJson(res, 403, { code: 'HARNESS_PLUGIN_UNAVAILABLE', message: 'Harness plugin is unavailable' });
    return;
  }
  const requestedCapability = String(body.capability_id || body.capabilityId || '').trim();
  if (requestedCapability && requestedCapability !== capabilityId) {
    sendJson(res, 403, { code: 'HARNESS_CAPABILITY_MISMATCH', message: 'Capability does not match assistant mode' });
    return;
  }
  let result;
  try {
    result = await gateway.execute({
      kind: 'chat',
      request_id: body.request_id || body.requestId,
      session_id: body.session_id || body.sessionId,
      plugin_id: pluginId,
      agent_id: agentId,
      capability_id: capabilityId,
      confirmed: body.confirmed === true,
      idempotency_key: body.idempotency_key || body.idempotencyKey,
      signal: req.signal,
      user,
      payload: {
        messages: sanitizeMessages(body.messages),
        stream: body.stream === true,
        ...(body.context && typeof body.context === 'object' ? { context: sanitizeChatContext(body.context) } : {})
      }
    });
  } catch {
    sendJson(res, 502, { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' });
    return;
  }
  if (!result.ok) { sendJson(res, result.status || 502, { code: result.code, message: result.message }); return; }
  const responseData = applyHarnessOutputPolicy({ data: result.data || {}, pluginId }).data;
  if (body.stream === true) {
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Eis-Ai-Backend': 'harness', 'X-Eis-Ai-Agent': agentId });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    streamTextAsSse(res, responseData?.text || responseData?.output_text || responseData?.choices?.[0]?.message?.content || '');
    return;
  }
  sendJson(res, 200, responseData, { 'X-Eis-Ai-Backend': 'harness', 'X-Eis-Ai-Agent': agentId });
};

module.exports = { CONTEXT_FORBIDDEN_KEYS, DEFAULT_CHAT_CAPABILITIES, createHarnessChatHttpHandler, resolveAgent, resolvePlugin, sanitizeChatContext, sanitizeMessageContent, sanitizeMessages };
