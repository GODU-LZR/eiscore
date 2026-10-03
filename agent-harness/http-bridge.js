'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PROTOCOL = 'eiscore-agent-v1';
const BRIDGE_ERROR_CODES = new Set([
  'HARNESS_BODY_TOO_LARGE', 'HARNESS_BAD_REQUEST', 'HARNESS_RESPONSE_TOO_LARGE',
  'HARNESS_RUNTIME_UNAVAILABLE', 'HARNESS_RUNTIME_EXIT', 'HARNESS_RUNTIME_CLOSED',
  'HARNESS_RUNTIME_RPC_TIMEOUT', 'HARNESS_RUNTIME_RPC_ERROR', 'HARNESS_PROMPT_TIMEOUT',
  'HARNESS_SESSION_BUSY', 'HARNESS_IMAGE_URL_UNSUPPORTED'
]);
const positiveInteger = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const json = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
};
const validSession = (value) => /^[a-zA-Z0-9._:-]{1,256}$/.test(String(value || ''));
const validReplayKey = (value) => /^[a-zA-Z0-9._:-]{1,1024}$/.test(String(value || ''));
const hashIdentity = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const sameSecret = (received, expected) => {
  const left = Buffer.from(String(received || ''));
  const right = Buffer.from(String(expected || ''));
  return right.length >= 32 && left.length === right.length && crypto.timingSafeEqual(left, right);
};
const forwardedHeaders = (headers, sessionId, requestId, plugin) => ({
  'x-eis-harness-protocol': PROTOCOL,
  'x-eis-ai-session': sessionId,
  'x-eis-request-id': requestId,
  'x-eis-plugin-id': plugin,
  'content-type': String(headers?.['content-type'] || 'application/json')
});
const normalizePluginIds = (plugins) => new Set((Array.isArray(plugins) ? plugins : [])
  .map((plugin) => typeof plugin === 'string' ? plugin : plugin?.plugin_id)
  .map((plugin) => String(plugin || '').trim())
  .filter(Boolean));
const normalizeInvokeResult = (result) => {
  const payload = result?.payload || result || { ok: true };
  const embeddedFailure = payload && typeof payload === 'object' && payload.ok === false;
  const candidateStatus = Number(result?.status || payload?.status || 200);
  const status = embeddedFailure
    ? (Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 502)
    : (Number.isInteger(candidateStatus) && candidateStatus >= 200 && candidateStatus <= 599 ? candidateStatus : 502);
  return { status, payload };
};
const readBody = (req, limit = 2 * 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0; let settled = false;
  const fail = (error) => { if (!settled) { settled = true; reject(error); } };
  req.on('data', (chunk) => {
    if (settled) return;
    size += chunk.length;
    if (size > limit) {
      fail(Object.assign(new Error('body too large'), { code: 'HARNESS_BODY_TOO_LARGE' }));
      req.resume();
    } else chunks.push(chunk);
  });
  req.on('end', () => {
    if (settled) return;
    try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); settled = true; resolve(body); }
    catch { fail(Object.assign(new Error('invalid json'), { code: 'HARNESS_BAD_REQUEST' })); }
  });
  req.on('error', fail);
});

const normalizeState = (value) => {
  if (!value || typeof value !== 'object' || value.version !== 1 || !Array.isArray(value.sessions) || !Array.isArray(value.requests)) throw new Error('invalid bridge state');
  const sessions = new Map();
  for (const entry of value.sessions) {
    if (!Array.isArray(entry) || entry.length !== 2 || !validSession(entry[0])) throw new Error('invalid bridge session state');
    const [key, session] = entry;
    if (!session || typeof session !== 'object' || !/^[a-f0-9]{64}:[a-f0-9]{64}$/.test(String(session.owner)) || !String(session.plugin || '').trim() || !Number.isFinite(Number(session.lastUsedAt))) throw new Error('invalid bridge session state');
    sessions.set(String(key), { owner: String(session.owner), plugin: String(session.plugin).trim(), lastUsedAt: Number(session.lastUsedAt) });
  }
  const requests = new Map();
  for (const entry of value.requests) {
    if (!Array.isArray(entry) || entry.length !== 2 || !validReplayKey(entry[0]) || !Number.isFinite(Number(entry[1]))) throw new Error('invalid bridge request state');
    requests.set(String(entry[0]), Number(entry[1]));
  }
  return { sessions, requests };
};

const createBridgeHandler = ({ invoke, pluginList = () => [], readiness = async () => ({ ok: true }), maxConcurrent = 16, maxSessions = 1000, maxTrackedRequests = 10000, maxBodyBytes = 2 * 1024 * 1024, maxResponseBytes = 2 * 1024 * 1024, sessionTtlMs = 24 * 60 * 60 * 1000, stateFile = '', bridgeSecret = '', clock = () => Date.now() } = {}) => {
  if (typeof invoke !== 'function') throw new TypeError('Bridge invoke is required');
  if (typeof readiness !== 'function') throw new TypeError('Bridge readiness is required');
  if (stateFile && !path.isAbsolute(stateFile)) throw new TypeError('Bridge stateFile must be absolute');
  const concurrencyLimit = positiveInteger(maxConcurrent, 16);
  const sessionLimit = positiveInteger(maxSessions, 1000);
  const bodyLimit = positiveInteger(maxBodyBytes, 2 * 1024 * 1024);
  const responseLimit = positiveInteger(maxResponseBytes, 2 * 1024 * 1024);
  const ttl = positiveInteger(sessionTtlMs, 24 * 60 * 60 * 1000);
  let active = 0;
  const sessions = new Map();
  const requests = new Map();
  const replayCapacity = positiveInteger(maxTrackedRequests, 10000);
  let stateError = null;
  let stateReady;
  let persistChain = Promise.resolve();
  const snapshot = () => ({ version: 1, sessions: [...sessions.entries()], requests: [...requests.entries()] });
  const persist = () => {
    if (!stateFile) return Promise.resolve();
    persistChain = persistChain.then(async () => {
      const directory = path.dirname(stateFile);
      await fs.mkdir(directory, { recursive: true });
      const temporary = `${stateFile}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(snapshot()), { encoding: 'utf8', mode: 0o600 });
        await fs.rename(temporary, stateFile);
      } finally {
        await fs.rm(temporary, { force: true }).catch(() => {});
      }
    }).catch((error) => { stateError = error; throw error; });
    return persistChain;
  };
  stateReady = (async () => {
    if (!stateFile) return;
    try {
      const saved = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      const loaded = normalizeState(saved);
      for (const [key, value] of loaded.sessions) sessions.set(key, value);
      for (const [key, value] of loaded.requests) requests.set(key, value);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      stateError = error;
    }
  })();
  return async (req, res) => {
    await stateReady;
    if (stateError) return json(res, 503, { code: 'HARNESS_STATE_UNAVAILABLE', message: 'Harness state is unavailable' });
    if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true, protocol: PROTOCOL });
    if (req.method === 'GET' && req.url === '/readyz') {
      try {
        const result = await readiness();
        if (result?.ok !== true) return json(res, 503, { code: 'HARNESS_NOT_READY', message: 'DeepSeek Harness is not ready' });
        return json(res, 200, { ok: true, protocol: PROTOCOL, checks: result?.checks || {} });
      } catch {
        return json(res, 503, { code: 'HARNESS_NOT_READY', message: 'DeepSeek Harness is not ready' });
      }
    }
    if (req.method === 'GET' && req.url === '/v1/plugins') {
      if (req.headers['x-eis-harness-protocol'] !== PROTOCOL) return json(res, 426, { code: 'HARNESS_PROTOCOL_REQUIRED' });
      return json(res, 200, { protocol: PROTOCOL, plugins: pluginList() });
    }
    if (req.method === 'GET' && req.url === '/metrics') {
      if (req.headers['x-eis-harness-protocol'] !== PROTOCOL) return json(res, 426, { code: 'HARNESS_PROTOCOL_REQUIRED' });
      return json(res, 200, { protocol: PROTOCOL, active, sessions: sessions.size, tracked_requests: requests.size, max_sessions: sessionLimit, max_tracked_requests: replayCapacity, state_persistence: Boolean(stateFile) });
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return json(res, 404, { code: 'NOT_FOUND' });
    if (req.headers['x-eis-harness-protocol'] !== PROTOCOL) return json(res, 426, { code: 'HARNESS_PROTOCOL_REQUIRED' });
    if (bridgeSecret && !sameSecret(req.headers['x-eis-harness-bridge-secret'], bridgeSecret)) return json(res, 401, { code: 'HARNESS_BRIDGE_UNAUTHORIZED' });
    if (active >= concurrencyLimit) return json(res, 429, { code: 'HARNESS_CAPACITY_EXCEEDED', message: 'Harness capacity exceeded' });
    const sessionId = String(req.headers['x-eis-ai-session'] || crypto.randomUUID());
    if (!validSession(sessionId)) return json(res, 400, { code: 'HARNESS_SESSION_INVALID' });
    const requestId = String(req.headers['x-eis-request-id'] || '');
    if (!requestId || !validSession(requestId)) return json(res, 400, { code: 'HARNESS_REQUEST_INVALID' });
    const now = clock();
    let changed = false;
    for (const [key, seenAt] of requests) if (now - seenAt > ttl) { requests.delete(key); changed = true; }
    for (const [key, session] of sessions) if (now - session.lastUsedAt > ttl) { sessions.delete(key); changed = true; }
    if (changed) {
      try {
        await persist();
      } catch {
        return json(res, 503, { code: 'HARNESS_STATE_UNAVAILABLE', message: 'Harness state is unavailable' });
      }
    }
    const ownerSubject = String(req.headers['x-eis-owner-subject'] || '').trim();
    const ownerTenant = String(req.headers['x-eis-owner-tenant'] || '').trim();
    if (!ownerSubject || !ownerTenant) return json(res, 401, { code: 'HARNESS_OWNER_REQUIRED' });
    const plugin = String(req.headers['x-eis-plugin-id'] || '').trim();
    if (!plugin) return json(res, 400, { code: 'HARNESS_PLUGIN_REQUIRED' });
    if (!normalizePluginIds(pluginList()).has(plugin)) return json(res, 404, { code: 'HARNESS_PLUGIN_UNAVAILABLE', message: 'Harness plugin is unavailable' });
    const owner = `${hashIdentity(ownerSubject)}:${hashIdentity(ownerTenant)}`;
    const replayKey = `${owner}:${plugin}:${requestId}`;
    if (requests.has(requestId) || requests.has(`legacy:${requestId}`) || requests.has(replayKey)) return json(res, 409, { code: 'HARNESS_REQUEST_REPLAY' });
    const existing = sessions.get(sessionId);
    if (existing && (existing.owner !== owner || existing.plugin !== plugin)) return json(res, 403, { code: 'HARNESS_SESSION_OWNERSHIP_DENIED' });
    if (!existing && sessions.size >= sessionLimit) return json(res, 429, { code: 'HARNESS_SESSION_CAPACITY_EXCEEDED' });
    if (requests.size >= replayCapacity) return json(res, 429, { code: 'HARNESS_REQUEST_CAPACITY_EXCEEDED' });
    requests.set(replayKey, now);
    if (!existing) sessions.set(sessionId, { owner, plugin, lastUsedAt: now });
    const previousLastUsedAt = existing?.lastUsedAt;
    if (existing) existing.lastUsedAt = now;
    try {
      await persist();
    } catch {
      requests.delete(replayKey);
      if (!existing) sessions.delete(sessionId);
      else existing.lastUsedAt = previousLastUsedAt;
      return json(res, 503, { code: 'HARNESS_STATE_UNAVAILABLE', message: 'Harness state is unavailable' });
    }
    active += 1;
    try {
      const body = await readBody(req, bodyLimit);
      const result = await invoke({ body, sessionId, requestId, headers: forwardedHeaders(req.headers, sessionId, requestId, plugin) });
      const normalized = normalizeInvokeResult(result);
      const responseBody = JSON.stringify(normalized.payload);
      if (Buffer.byteLength(responseBody) > responseLimit) throw Object.assign(new Error('response too large'), { code: 'HARNESS_RESPONSE_TOO_LARGE' });
      res.writeHead(normalized.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(responseBody);
    } catch (error) {
      if (error?.code === 'HARNESS_BODY_TOO_LARGE' || error?.code === 'HARNESS_BAD_REQUEST') {
        requests.delete(replayKey);
        if (!existing) sessions.delete(sessionId);
        else existing.lastUsedAt = previousLastUsedAt;
        try { await persist(); } catch { return json(res, 503, { code: 'HARNESS_STATE_UNAVAILABLE', message: 'Harness state is unavailable' }); }
      }
      const code = BRIDGE_ERROR_CODES.has(String(error?.code || ''))
        ? String(error.code)
        : 'HARNESS_UPSTREAM_UNAVAILABLE';
      return json(res, 502, { code, message: 'DeepSeek Harness is unavailable' });
    } finally { active -= 1; }
  };
};

const startBridge = ({ port = Number(process.env.PORT || 3080), ...options } = {}) => {
  const server = http.createServer(createBridgeHandler(options));
  server.listen(port);
  return server;
};

module.exports = { BRIDGE_ERROR_CODES, PROTOCOL, createBridgeHandler, forwardedHeaders, normalizeInvokeResult, normalizePluginIds, startBridge, validSession };
