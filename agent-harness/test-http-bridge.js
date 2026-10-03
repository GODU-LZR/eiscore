'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createBridgeHandler, forwardedHeaders, normalizeInvokeResult, normalizePluginIds, PROTOCOL } = require('./http-bridge');

assert.deepEqual(forwardedHeaders({ authorization: 'Bearer secret', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1' }, 'session-1', 'req-1', 'enterprise-bi'), {
  'x-eis-harness-protocol': PROTOCOL,
  'x-eis-ai-session': 'session-1',
  'x-eis-request-id': 'req-1',
  'x-eis-plugin-id': 'enterprise-bi',
  'content-type': 'application/json'
});
assert.deepEqual([...normalizePluginIds(['worker-grid', { plugin_id: 'enterprise-bi' }, { plugin_id: '' }])], ['worker-grid', 'enterprise-bi']);
assert.deepEqual(normalizeInvokeResult({ status: 200, payload: { ok: false, code: 'HARNESS_REQUEST_REPLAY' } }), {
  status: 502,
  payload: { ok: false, code: 'HARNESS_REQUEST_REPLAY' }
});
assert.deepEqual(normalizeInvokeResult({ status: 429, payload: { ok: false, code: 'HARNESS_REQUEST_CAPACITY_EXCEEDED' } }), {
  status: 429,
  payload: { ok: false, code: 'HARNESS_REQUEST_CAPACITY_EXCEEDED' }
});

const calls = [];
(async () => {
const server = http.createServer(createBridgeHandler({
  pluginList: () => [{ plugin_id: 'enterprise-bi' }, { plugin_id: 'worker-grid' }],
  invoke: async (request) => { calls.push(request); return { status: 200, payload: { choices: [{ message: { content: 'ok' } }] } }; }
}));
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const requestAt = (targetPort, options, body) => new Promise((resolve, reject) => {
  const req = http.request({ port: targetPort, ...options }, (res) => { let data = ''; res.on('data', (chunk) => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) })); });
  req.on('error', reject); if (body) req.end(JSON.stringify(body)); else req.end();
});
const request = (options, body) => requestAt(port, options, body);

let response = await request({ method: 'GET', path: '/healthz' });
assert.equal(response.status, 200);
response = await request({ method: 'GET', path: '/readyz' });
assert.equal(response.status, 200);
assert.deepEqual(response.body.checks, {});
response = await request({ method: 'GET', path: '/v1/plugins' });
assert.equal(response.status, 426);
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'bad session', 'x-eis-request-id': 'req-bad' } }, {});
assert.equal(response.body.code, 'HARNESS_SESSION_INVALID');
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'session-owner', 'x-eis-request-id': 'req-owner', 'x-eis-plugin-id': 'enterprise-bi' } }, {});
assert.equal(response.body.code, 'HARNESS_OWNER_REQUIRED');
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'session-plugin', 'x-eis-request-id': 'req-plugin', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1' } }, {});
assert.equal(response.body.code, 'HARNESS_PLUGIN_REQUIRED');
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'session-1', 'x-eis-request-id': 'req-1', 'x-eis-plugin-id': 'enterprise-bi', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' } }, { messages: [] });
assert.equal(response.status, 200);
assert.equal(calls[0].sessionId, 'session-1');
assert.equal(calls[0].headers.authorization, undefined);
assert.equal(calls[0].headers['x-eis-owner-subject'], undefined);
assert.equal(calls[0].headers['x-eis-owner-tenant'], undefined);
assert.equal(calls[0].headers['x-eis-plugin-id'], 'enterprise-bi');
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'session-1', 'x-eis-request-id': 'req-1', 'x-eis-plugin-id': 'enterprise-bi', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' } }, { messages: [] });
assert.equal(response.body.code, 'HARNESS_REQUEST_REPLAY');
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'session-1', 'x-eis-request-id': 'req-2', 'x-eis-plugin-id': 'worker-grid', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' } }, { messages: [] });
assert.equal(response.body.code, 'HARNESS_SESSION_OWNERSHIP_DENIED');
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'session-1', 'x-eis-request-id': 'req-tenant', 'x-eis-plugin-id': 'enterprise-bi', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't2', 'content-type': 'application/json' } }, { messages: [] });
assert.equal(response.body.code, 'HARNESS_SESSION_OWNERSHIP_DENIED', 'same subject with a different tenant must not reuse a session');
response = await request({ method: 'POST', path: '/v1/chat/completions', headers: { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'session-unknown', 'x-eis-request-id': 'req-unknown', 'x-eis-plugin-id': 'unknown-plugin', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' } }, { messages: [] });
assert.equal(response.body.code, 'HARNESS_PLUGIN_UNAVAILABLE');
response = await request({ method: 'GET', path: '/metrics', headers: { 'x-eis-harness-protocol': PROTOCOL } });
assert.equal(response.status, 200);
assert.equal(response.body.sessions, 1);
assert.equal(response.body.tracked_requests, 1);
assert.equal(response.body.state_persistence, false);
await new Promise((resolve) => server.close(resolve));

let bridgeAuthCalls = 0;
const bridgeSecret = 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6';
const bridgeAuthServer = http.createServer(createBridgeHandler({
  bridgeSecret,
  pluginList: () => [{ plugin_id: 'enterprise-bi' }],
  invoke: async (request) => { bridgeAuthCalls += 1; assert.equal(request.headers['x-eis-harness-bridge-secret'], undefined); return { status: 200, payload: { ok: true } }; }
}));
await new Promise((resolve) => bridgeAuthServer.listen(0, resolve));
const bridgeAuthPort = bridgeAuthServer.address().port;
const bridgeAuthHeaders = { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-ai-session': 'bridge-auth-session', 'x-eis-request-id': 'bridge-auth-request', 'x-eis-plugin-id': 'enterprise-bi', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' };
response = await requestAt(bridgeAuthPort, { method: 'POST', path: '/v1/chat/completions', headers: bridgeAuthHeaders }, { messages: [] });
assert.equal(response.status, 401);
assert.equal(response.body.code, 'HARNESS_BRIDGE_UNAUTHORIZED');
response = await requestAt(bridgeAuthPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...bridgeAuthHeaders, 'x-eis-harness-bridge-secret': 'wrong-secret' } }, { messages: [] });
assert.equal(response.status, 401);
response = await requestAt(bridgeAuthPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...bridgeAuthHeaders, 'x-eis-harness-bridge-secret': bridgeSecret } }, { messages: [] });
assert.equal(response.status, 200);
assert.equal(bridgeAuthCalls, 1);
await new Promise((resolve) => bridgeAuthServer.close(resolve));

 let oversizedCalls = 0;
 const boundedServer = http.createServer(createBridgeHandler({
   maxBodyBytes: 32,
   maxResponseBytes: 32,
   pluginList: () => [{ plugin_id: 'enterprise-bi' }],
   invoke: async () => { oversizedCalls += 1; return { status: 200, payload: { ok: true } }; }
 }));
 await new Promise((resolve) => boundedServer.listen(0, resolve));
 const boundedPort = boundedServer.address().port;
 const boundedHeaders = { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-plugin-id': 'enterprise-bi', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' };
 response = await requestAt(boundedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...boundedHeaders, 'x-eis-ai-session': 'oversized-session', 'x-eis-request-id': 'oversized-request' } }, { payload: 'this body is larger than the configured limit' });
 assert.equal(response.status, 502);
 assert.equal(response.body.code, 'HARNESS_BODY_TOO_LARGE');
 assert.equal(oversizedCalls, 0, 'oversized request must not reach the upstream invoke');
 response = await requestAt(boundedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...boundedHeaders, 'x-eis-ai-session': 'oversized-session', 'x-eis-request-id': 'oversized-request' } }, {});
 assert.equal(response.status, 200, 'a body rejected before invoke must not reserve its replay id');
 const callsBeforeInvalidJson = oversizedCalls;
 response = await new Promise((resolve, reject) => {
   const req = http.request({ port: boundedPort, method: 'POST', path: '/v1/chat/completions', headers: { ...boundedHeaders, 'x-eis-ai-session': 'invalid-session', 'x-eis-request-id': 'invalid-request' } }, (res) => {
     let data = ''; res.on('data', (chunk) => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
   });
   req.on('error', reject); req.end('{invalid-json');
 });
 assert.equal(response.status, 502);
 assert.equal(response.body.code, 'HARNESS_BAD_REQUEST');
 assert.equal(oversizedCalls, callsBeforeInvalidJson, 'invalid JSON must not reach the upstream invoke');
 response = await requestAt(boundedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...boundedHeaders, 'x-eis-ai-session': 'bounded-session', 'x-eis-request-id': 'bounded-request' } }, {});
 assert.equal(response.status, 200);
 await new Promise((resolve) => boundedServer.close(resolve));

 const responseLimitServer = http.createServer(createBridgeHandler({
   maxResponseBytes: 32,
   pluginList: () => [{ plugin_id: 'enterprise-bi' }],
   invoke: async () => ({ status: 200, payload: { value: 'this response is larger than the configured limit' } })
 }));
 await new Promise((resolve) => responseLimitServer.listen(0, resolve));
 response = await requestAt(responseLimitServer.address().port, { method: 'POST', path: '/v1/chat/completions', headers: { ...boundedHeaders, 'x-eis-ai-session': 'response-session', 'x-eis-request-id': 'response-request' } }, {});
 assert.equal(response.status, 502);
 assert.equal(response.body.code, 'HARNESS_RESPONSE_TOO_LARGE');
 await new Promise((resolve) => responseLimitServer.close(resolve));

const unknownFailureServer = http.createServer(createBridgeHandler({
  pluginList: () => [{ plugin_id: 'enterprise-bi' }],
  invoke: async () => { throw Object.assign(new Error('secret internal stack detail'), { code: 'INTERNAL_SECRET_CODE' }); }
}));
await new Promise((resolve) => unknownFailureServer.listen(0, resolve));
response = await requestAt(unknownFailureServer.address().port, { method: 'POST', path: '/v1/chat/completions', headers: { ...boundedHeaders, 'x-eis-ai-session': 'unknown-error-session', 'x-eis-request-id': 'unknown-error-request' } }, {});
assert.equal(response.status, 502);
assert.deepEqual(response.body, { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' }, 'unknown Bridge errors must use the stable upstream failure contract');
await new Promise((resolve) => unknownFailureServer.close(resolve));

 const defaultsServer = http.createServer(createBridgeHandler({
   maxConcurrent: 0,
   maxSessions: -1,
   maxTrackedRequests: 0,
   maxBodyBytes: 0,
   maxResponseBytes: -1,
   sessionTtlMs: 0,
   pluginList: () => [{ plugin_id: 'enterprise-bi' }],
   invoke: async () => ({ status: 200, payload: { ok: true } })
 }));
 await new Promise((resolve) => defaultsServer.listen(0, resolve));
 const defaultsPort = defaultsServer.address().port;
 response = await requestAt(defaultsPort, { method: 'GET', path: '/metrics', headers: { 'x-eis-harness-protocol': PROTOCOL } });
 assert.equal(response.body.max_sessions, 1000, 'invalid session capacity must use the safe default');
 assert.equal(response.body.max_tracked_requests, 10000, 'invalid replay capacity must use the safe default');
 response = await requestAt(defaultsPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...boundedHeaders, 'x-eis-ai-session': 'defaults-session', 'x-eis-request-id': 'defaults-request' } }, {});
 assert.equal(response.status, 200, 'invalid body/response limits must use safe defaults');
 await new Promise((resolve) => defaultsServer.close(resolve));

const stateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'eiscore-harness-bridge-'));
const stateFile = path.join(stateDirectory, 'bridge-state.json');
const persistedHeaders = { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-plugin-id': 'enterprise-bi', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' };
const persistedServer = http.createServer(createBridgeHandler({
  stateFile,
  pluginList: () => [{ plugin_id: 'enterprise-bi' }],
  invoke: async () => ({ status: 200, payload: { ok: true } })
}));
await new Promise((resolve) => persistedServer.listen(0, resolve));
const persistedPort = persistedServer.address().port;
response = await requestAt(persistedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...persistedHeaders, 'x-eis-ai-session': 'persisted-session', 'x-eis-request-id': 'persisted-request' } }, { messages: [] });
assert.equal(response.status, 200);
const longRequestId = 'r'.repeat(256);
response = await requestAt(persistedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...persistedHeaders, 'x-eis-ai-session': 'long-request-session', 'x-eis-request-id': longRequestId } }, { messages: [] });
assert.equal(response.status, 200, 'maximum-length request ids must be accepted');
assert.equal((await fs.stat(stateFile)).isFile(), true);
await new Promise((resolve) => persistedServer.close(resolve));
const reloadedServer = http.createServer(createBridgeHandler({
  stateFile,
  pluginList: () => [{ plugin_id: 'enterprise-bi' }],
  invoke: async () => ({ status: 200, payload: { ok: true } })
}));
await new Promise((resolve) => reloadedServer.listen(0, resolve));
const reloadedPort = reloadedServer.address().port;
response = await requestAt(reloadedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...persistedHeaders, 'x-eis-ai-session': 'persisted-session', 'x-eis-request-id': 'persisted-request' } }, { messages: [] });
assert.equal(response.body.code, 'HARNESS_REQUEST_REPLAY', 'reloaded bridge must retain request replay protection');
response = await requestAt(reloadedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...persistedHeaders, 'x-eis-ai-session': 'long-request-session', 'x-eis-request-id': longRequestId } }, { messages: [] });
assert.equal(response.body.code, 'HARNESS_REQUEST_REPLAY', 'reloaded bridge must retain maximum-length request replay state');
response = await requestAt(reloadedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...persistedHeaders, 'x-eis-ai-session': 'persisted-session', 'x-eis-request-id': 'persisted-request-2' } }, { messages: [] });
assert.equal(response.status, 200, 'reloaded bridge must retain session ownership');
response = await requestAt(reloadedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...persistedHeaders, 'x-eis-ai-session': 'same-owner-new-session', 'x-eis-request-id': 'persisted-request' } }, { messages: [] });
assert.equal(response.body.code, 'HARNESS_REQUEST_REPLAY', 'request ids must remain idempotent across sessions for the same owner');
response = await requestAt(reloadedPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...persistedHeaders, 'x-eis-owner-subject': 'u2', 'x-eis-owner-tenant': 't2', 'x-eis-ai-session': 'other-owner-session', 'x-eis-request-id': 'persisted-request' } }, { messages: [] });
assert.equal(response.status, 200, 'request ids must be scoped to the authenticated bridge owner');
response = await requestAt(reloadedPort, { method: 'GET', path: '/metrics', headers: { 'x-eis-harness-protocol': PROTOCOL } });
assert.equal(response.body.state_persistence, true);
await new Promise((resolve) => reloadedServer.close(resolve));
await fs.rm(stateDirectory, { recursive: true, force: true });

const corruptDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'eiscore-harness-bridge-corrupt-'));
const corruptStateFile = path.join(corruptDirectory, 'bridge-state.json');
await fs.writeFile(corruptStateFile, '{"version":1,"sessions":"corrupt","requests":[]}');
const corruptServer = http.createServer(createBridgeHandler({
  stateFile: corruptStateFile,
  pluginList: () => [{ plugin_id: 'enterprise-bi' }],
  invoke: async () => ({ status: 200, payload: { ok: true } })
}));
await new Promise((resolve) => corruptServer.listen(0, resolve));
response = await requestAt(corruptServer.address().port, { method: 'GET', path: '/healthz' });
assert.equal(response.status, 503);
assert.equal(response.body.code, 'HARNESS_STATE_UNAVAILABLE', 'corrupt persisted state must fail closed');
await new Promise((resolve) => corruptServer.close(resolve));
await fs.rm(corruptDirectory, { recursive: true, force: true });

let now = 0;
const expiringServer = http.createServer(createBridgeHandler({
  maxSessions: 1,
  maxTrackedRequests: 1,
  sessionTtlMs: 10,
  clock: () => now,
  pluginList: () => [{ plugin_id: 'enterprise-bi' }],
  invoke: async () => ({ status: 200, payload: { ok: true } })
}));
await new Promise((resolve) => expiringServer.listen(0, resolve));
const expiringPort = expiringServer.address().port;
const baseHeaders = { 'x-eis-harness-protocol': PROTOCOL, 'x-eis-plugin-id': 'enterprise-bi', 'x-eis-owner-subject': 'u1', 'x-eis-owner-tenant': 't1', 'content-type': 'application/json' };
response = await requestAt(expiringPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...baseHeaders, 'x-eis-ai-session': 'session-a', 'x-eis-request-id': 'req-a' } }, { messages: [] });
assert.equal(response.status, 200);
response = await requestAt(expiringPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...baseHeaders, 'x-eis-ai-session': 'session-a', 'x-eis-request-id': 'req-b' } }, { messages: [] });
assert.equal(response.status, 429);
assert.equal(response.body.code, 'HARNESS_REQUEST_CAPACITY_EXCEEDED', 'Bridge must preserve unexpired replay records at capacity');
now = 11;
response = await requestAt(expiringPort, { method: 'POST', path: '/v1/chat/completions', headers: { ...baseHeaders, 'x-eis-ai-session': 'session-b', 'x-eis-request-id': 'req-b' } }, { messages: [] });
assert.equal(response.status, 200, 'expired sessions must release capacity');
await new Promise((resolve) => expiringServer.close(resolve));
const unavailableServer = http.createServer(createBridgeHandler({
  readiness: async () => { throw new Error('internal runtime details must not escape'); },
  invoke: async () => ({ status: 200, payload: { ok: true } })
}));
await new Promise((resolve) => unavailableServer.listen(0, resolve));
response = await requestAt(unavailableServer.address().port, { method: 'GET', path: '/readyz' });
assert.equal(response.status, 503);
assert.deepEqual(response.body, { code: 'HARNESS_NOT_READY', message: 'DeepSeek Harness is not ready' });
await new Promise((resolve) => unavailableServer.close(resolve));
const notInitializedServer = http.createServer(createBridgeHandler({
  readiness: async () => ({ ok: false, checks: { runtime: false } }),
  invoke: async () => ({ status: 200, payload: { ok: true } })
}));
await new Promise((resolve) => notInitializedServer.listen(0, resolve));
response = await requestAt(notInitializedServer.address().port, { method: 'GET', path: '/readyz' });
assert.equal(response.status, 503);
assert.deepEqual(response.body, { code: 'HARNESS_NOT_READY', message: 'DeepSeek Harness is not ready' });
await new Promise((resolve) => notInitializedServer.close(resolve));
console.log('PASS: Harness HTTP bridge protocol, session and payload boundaries');
})().catch((error) => { console.error(error); process.exitCode = 1; });
