'use strict';

const assert = require('node:assert/strict');
const {
  SALES_CONTEXT_DATASET,
  WORKFLOW_CONTEXT_TOOL_ALLOWLIST,
  WORKFLOW_WRITE_TOOL_ALLOWLIST,
  createFixedFlashCapabilityExecutor,
  createHarnessProviderDispatch,
  isHarnessConfigurationReady,
  createHarnessMultimodalExecutor,
  createHarnessToolProxyHandler,
  executeFixedSalesContext,
  buildHarnessBridgeHeaders,
  normalizeHarnessBridgeResult,
  resolveHarnessDispatchScope,
  resolveHarnessOwnerTenant
} = require('./harness-runtime');

assert.deepEqual(normalizeHarnessBridgeResult({ ok: false, status: 500 }, { code: 'DB_INTERNAL', message: 'postgres password at /etc/secrets' }), {
  ok: false,
  status: 500,
  data: undefined,
  code: 'HARNESS_UPSTREAM_UNAVAILABLE',
  message: 'DeepSeek Harness is unavailable'
});
assert.deepEqual(normalizeHarnessBridgeResult({ ok: false, status: 409 }, { code: 'HARNESS_REQUEST_REPLAY', message: 'internal detail' }), {
  ok: false,
  status: 409,
  data: undefined,
  code: 'HARNESS_REQUEST_REPLAY',
  message: 'DeepSeek Harness request was rejected'
});
assert.deepEqual(normalizeHarnessBridgeResult({ ok: true, status: 200 }, { ok: false, code: 'HARNESS_REQUEST_REPLAY', status: 409, message: 'internal detail' }), {
  ok: false,
  status: 409,
  data: undefined,
  code: 'HARNESS_REQUEST_REPLAY',
  message: 'DeepSeek Harness request was rejected'
});
assert.deepEqual(normalizeHarnessBridgeResult({ ok: true, status: 200 }, { ok: false, code: 'HARNESS_REQUEST_CAPACITY_EXCEEDED', status: 429, message: 'internal detail' }), {
  ok: false,
  status: 429,
  data: undefined,
  code: 'HARNESS_REQUEST_CAPACITY_EXCEEDED',
  message: 'DeepSeek Harness request was rejected'
});
assert.deepEqual(normalizeHarnessBridgeResult({ ok: false, status: 502 }, { code: 'HARNESS_TOOL_UNAVAILABLE', status: 502, message: 'internal detail' }), {
  ok: false,
  status: 502,
  data: undefined,
  code: 'HARNESS_TOOL_UNAVAILABLE',
  message: 'DeepSeek Harness request was rejected'
});
assert.deepEqual(normalizeHarnessBridgeResult({ ok: true, status: 200 }, { ok: false, code: 'HARNESS_REQUEST_REPLAY', status: 200, message: 'invalid embedded status' }), {
  ok: false,
  status: 502,
  data: undefined,
  code: 'HARNESS_REQUEST_REPLAY',
  message: 'DeepSeek Harness request was rejected'
});
const previousBridgeSecret = process.env.EISCORE_HARNESS_BRIDGE_SECRET;
process.env.EISCORE_HARNESS_BRIDGE_SECRET = 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6';
const bridgeHeaders = buildHarnessBridgeHeaders({
  session_id: 'session-1',
  request_id: 'request-1',
  plugin: { plugin_id: 'digital-twin' },
  user: { id: 'user-1', tenant_id: 'tenant-1' },
  token: 'must-not-forward'
});
assert.equal(bridgeHeaders.authorization, undefined);
assert.equal(bridgeHeaders['x-eis-ai-session'], 'session-1');
assert.equal(bridgeHeaders['x-eis-request-id'], 'request-1');
assert.equal(bridgeHeaders['x-eis-plugin-id'], 'digital-twin');
assert.equal(bridgeHeaders['x-eis-owner-subject'], 'user-1');
assert.equal(bridgeHeaders['x-eis-owner-tenant'], 'tenant-1');
assert.equal(bridgeHeaders['x-eis-harness-bridge-secret'], 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6');
assert.equal(buildHarnessBridgeHeaders({ user: { sub: 'jwt-subject', tenant_id: 'tenant-2' } })['x-eis-owner-subject'], 'jwt-subject');
assert.equal(buildHarnessBridgeHeaders({ user: { id: 'canonical-id', sub: 'forged-subject', tenant_id: 'tenant-2' } })['x-eis-owner-subject'], 'canonical-id');

const readyHarnessEnvironment = {
  EISCORE_HARNESS_ENABLED: 'true',
  EISCORE_HARNESS_URL: 'http://harness-bridge:3080',
  EISCORE_HARNESS_AUDIT_FILE: '/var/lib/eiscore/harness-audit.jsonl',
  EISCORE_HARNESS_AUDIT_HASH_KEY: 'HarnessAudit9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_HARNESS_BRIDGE_SECRET: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_TOOL_PROXY_SECRET: 'HarnessProxy9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6'
};
assert.equal(isHarnessConfigurationReady(readyHarnessEnvironment), true);
assert.equal(isHarnessConfigurationReady({ ...readyHarnessEnvironment, EISCORE_TOOL_PROXY_SECRET: readyHarnessEnvironment.EISCORE_HARNESS_BRIDGE_SECRET }), false);
for (const key of ['EISCORE_HARNESS_URL', 'EISCORE_HARNESS_AUDIT_FILE', 'EISCORE_HARNESS_AUDIT_HASH_KEY', 'EISCORE_HARNESS_BRIDGE_SECRET', 'EISCORE_TOOL_PROXY_SECRET']) {
  const incomplete = { ...readyHarnessEnvironment };
  delete incomplete[key];
  assert.equal(isHarnessConfigurationReady(incomplete), false);
}
for (const url of ['http://127.0.0.1:3080', 'http://localhost:3080', 'http://deepseek-web:3080/v1', 'not-a-url']) {
  assert.equal(isHarnessConfigurationReady({ ...readyHarnessEnvironment, EISCORE_HARNESS_URL: url }), false);
}
assert.equal(isHarnessConfigurationReady({ ...readyHarnessEnvironment, EISCORE_HARNESS_ENABLED: 'false' }), false);
if (previousBridgeSecret === undefined) delete process.env.EISCORE_HARNESS_BRIDGE_SECRET;
else process.env.EISCORE_HARNESS_BRIDGE_SECRET = previousBridgeSecret;

(async () => {
  const missingBridgeDispatch = createHarnessProviderDispatch({
    bridgeUrl: '',
    activeDispatches: new Map(),
    fetchImpl: async () => { throw new Error('missing bridge must not fetch'); }
  });
  await assert.rejects(
    () => missingBridgeDispatch({ session_id: 'missing-bridge', request_id: 'missing-bridge-request', plugin: { plugin_id: 'enterprise-bi' }, user: { id: 'u1', tenant_id: 't1' }, payload: { messages: [] } }),
    /invalid harness bridge URL/
  );

  const missingBridgeMultimodal = createHarnessMultimodalExecutor({
    bridgeUrl: '',
    fetchImpl: async () => { throw new Error('missing bridge must not fetch'); }
  });
  await assert.rejects(
    () => missingBridgeMultimodal('eiscore_multimodal_ocr', { id: 'u1', tenant_id: 't1' }, {}, { request_id: 'missing-mm' }),
    /invalid harness bridge URL/
  );

  const activeProviderDispatches = new Map();
  const providerCalls = [];
  const providerResolvers = [];
  const providerDispatch = createHarnessProviderDispatch({
    bridgeUrl: 'http://127.0.0.1:3080',
    activeDispatches: activeProviderDispatches,
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      providerCalls.push({ body, request: activeProviderDispatches.get('shared-session')?.request });
      await new Promise((resolve) => providerResolvers.push(resolve));
      return { ok: true, status: 200, json: async () => ({ text: body.messages[0].content }) };
    }
  });
  const firstProviderRequest = { request_id: 'provider-1', session_id: 'shared-session', plugin: { plugin_id: 'enterprise-bi' }, user: { id: 'u1', tenant_id: 't1' }, capability_id: 'eiscore_enterprise_query', confirmed: false, payload: { messages: [{ role: 'user', content: 'first' }] } };
  const secondProviderRequest = { ...firstProviderRequest, request_id: 'provider-2', confirmed: true, idempotency_key: 'second-idempotency-key', payload: { messages: [{ role: 'user', content: 'second' }] } };
  const firstProviderResult = providerDispatch(firstProviderRequest);
  const secondProviderResult = providerDispatch(secondProviderRequest);
  const foreignProviderResult = await providerDispatch({
    ...firstProviderRequest,
    request_id: 'provider-foreign',
    plugin: { plugin_id: 'digital-twin' },
    user: { id: 'u2', tenant_id: 't2' },
    payload: { messages: [{ role: 'user', content: 'foreign' }] }
  });
  assert.deepEqual(foreignProviderResult, {
    ok: false,
    status: 403,
    code: 'HARNESS_SESSION_OWNERSHIP_DENIED',
    message: 'Harness session is active for another owner or plugin'
  });
  assert.equal(providerCalls.length, 1, 'foreign same-session requests must not reach the provider');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerCalls.length, 1, 'same-session Provider requests must be serialized before fetch');
  assert.equal(providerCalls[0].request, firstProviderRequest);
  providerResolvers.shift()();
  assert.equal((await firstProviderResult).data.text, 'first');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerCalls.length, 2);
  assert.equal(providerCalls[1].request, secondProviderRequest, 'Tool Proxy context must switch to the request that is actually prompting');
  assert.equal(providerCalls[1].request.confirmed, true);
  assert.equal(providerCalls[1].request.idempotency_key, 'second-idempotency-key');
  providerResolvers.shift()();
  assert.equal((await secondProviderResult).data.text, 'second');
  assert.equal(activeProviderDispatches.size, 0);

  const multimodalRequests = [];
  const multimodalExecutor = createHarnessMultimodalExecutor({
    bridgeUrl: 'http://127.0.0.1:3080',
    fetchImpl: async (url, options) => {
      multimodalRequests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ocr result' } }] }) };
    }
  });
  const multimodalData = await multimodalExecutor(
    'eiscore_multimodal_ocr',
    { id: 'user-1', tenant_id: 'tenant-1' },
    { capability_id: 'eiscore_multimodal_ocr', messages: [{ role: 'user', content: [] }], stream: false },
    { request_id: 'request-mm', session_id: 'session-mm', plugin: { plugin_id: 'enterprise-bi' } }
  );
  assert.deepEqual(multimodalData, { choices: [{ message: { content: 'ocr result' } }] });
  assert.equal(multimodalRequests[0].url, 'http://127.0.0.1:3080/v1/chat/completions');
  assert.equal(multimodalRequests[0].options.headers['x-eis-plugin-id'], 'enterprise-bi');
  assert.equal(multimodalRequests[0].options.headers.authorization, undefined);

  const calls = [];
  const executeFlashToolCall = async (...args) => {
    calls.push(args);
    return { status: 200, payload: { ok: true, data: { ok: true } } };
  };
  const read = createFixedFlashCapabilityExecutor(
    executeFlashToolCall,
    'flash.workflow.definition.list',
    WORKFLOW_CONTEXT_TOOL_ALLOWLIST,
    'test-workflow-context'
  );
  await read({ id: 'u1' }, { tool_id: 'flash.workflow.instance.list' });
  assert.equal(calls[0][1].tool_id, 'flash.workflow.instance.list');
  assert.deepEqual(calls[0][1].arguments, {});
  await assert.rejects(
    () => read({ id: 'u1' }, { tool_id: 'flash.app.list' }),
    (error) => error.code === 'HARNESS_TOOL_NOT_ALLOWED' && error.httpStatus === 403
  );

  const write = createFixedFlashCapabilityExecutor(
    executeFlashToolCall,
    'flash.workflow.instance.transition',
    WORKFLOW_WRITE_TOOL_ALLOWLIST,
    'test-workflow-write'
  );
  await write({ id: 'u1' }, { tool_id: 'flash.workflow.instance.start' });
  assert.equal(calls[1][1].tool_id, 'flash.workflow.instance.start');
  assert.equal(calls[1][1].confirmed, false);
  assert.equal(calls[1][1].idempotency_key, undefined);
  await write({ id: 'u1' }, { tool_id: 'flash.workflow.instance.start', confirmed: true, idempotency_key: 'forged-by-payload' }, { confirmed: true, idempotency_key: 'server-owned-key-01' });
  assert.equal(calls[2][1].confirmed, true);
  assert.equal(calls[2][1].idempotency_key, 'server-owned-key-01');
  await assert.rejects(
    () => write({ id: 'u1' }, { tool_id: 'flash.workflow.definition.list' }),
    (error) => error.code === 'HARNESS_TOOL_NOT_ALLOWED' && error.httpStatus === 403
  );

  let queryCall;
  const sales = executeFixedSalesContext({
    execute: async (...args) => {
      queryCall = args;
      return { dataset: args[1].dataset };
    }
  });
  const result = await sales({ id: 'u1' }, { dataset: 'employees', select: ['id'] });
  assert.equal(result.dataset, SALES_CONTEXT_DATASET);
  assert.equal(queryCall[1].dataset, SALES_CONTEXT_DATASET);
  assert.equal(queryCall[2], 'company-sales');
  assert.equal(resolveHarnessOwnerTenant({ tenantId: 'tenant-b' }), 'tenant-b');
  assert.equal(resolveHarnessOwnerTenant({ tenant: 'tenant-c' }), 'tenant-c');
  assert.equal(resolveHarnessOwnerTenant({ tenant_id: 'tenant-a', tenantId: 'forged' }), 'tenant-a');
  assert.notEqual(
    resolveHarnessDispatchScope({ plugin: { plugin_id: 'enterprise-bi' }, user: { id: 'u1', tenant_id: 't1' } }),
    resolveHarnessDispatchScope({ plugin: { plugin_id: 'enterprise-bi' }, user: { id: 'u2', tenant_id: 't1' } })
  );
  assert.notEqual(
    resolveHarnessDispatchScope({ plugin: { plugin_id: 'enterprise-bi' }, user: { id: 'a\u0000b', tenant_id: 'c' } }),
    resolveHarnessDispatchScope({ plugin: { plugin_id: 'enterprise-bi' }, user: { id: 'a', tenant_id: 'b\u0000c' } }),
    'session scopes must remain collision-resistant when identity fields contain delimiters'
  );

  const proxyCalls = [];
  const proxyRegistry = {
    resolveCapability: (name) => name === 'eiscore_enterprise_snapshot'
      ? { plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst' }
      : name === 'eiscore_sales_write'
        ? { plugin_id: 'company-sales', agent_id: 'company_sales_agent' }
        : null
  };
  const activeDispatches = new Map([['dsh-session-1', {
    request: {
      request_id: 'request-1',
      plugin: { plugin_id: 'enterprise-bi' },
      user: { id: 'user-1', tenant_id: 'tenant-1', token: 'jwt-secret' },
      confirmed: false,
      idempotency_key: ''
    },
    depth: 1
  }]]);
  const proxyReadJson = async (req) => req.body;
  const proxySendJson = (res, status, payload) => { res.status = status; res.payload = payload; };
  const proxy = createHarnessToolProxyHandler({
    registry: proxyRegistry,
    activeDispatches,
    secret: '01234567890123456789012345678901',
    readJsonBody: proxyReadJson,
    sendJson: proxySendJson,
    execute: async (request) => { proxyCalls.push(request); return { ok: true, status: 200, data: { accepted: true } }; }
  });
  const denied = {};
  await proxy({ headers: {}, body: {} }, denied);
  assert.equal(denied.status, 401);
  const missingSession = {};
  await proxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'unknown', tool_name: 'eiscore_enterprise_snapshot' } }, missingSession);
  assert.equal(missingSession.status, 409);
  const mismatch = {};
  await proxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'dsh-session-1', tool_name: 'eiscore_sales_write', arguments: {} } }, mismatch);
  assert.equal(mismatch.status, 403);
  const readonly = {};
  await proxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'dsh-session-1', tool_name: 'eiscore_enterprise_snapshot', arguments: { tenant_id: 'forged', token: 'forged', query: 'sales' } } }, readonly);
  assert.equal(readonly.status, 200);
  assert.equal(proxyCalls[0].user.tenant_id, 'tenant-1');
  assert.equal(proxyCalls[0].user.token, 'jwt-secret');
  assert.equal(proxyCalls[0].payload.tenant_id, undefined);
  assert.equal(proxyCalls[0].payload.token, undefined);
  assert.equal(proxyCalls[0].payload.query, 'sales');
  const prototypePayload = {};
  await proxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: JSON.parse('{"session_id":"dsh-session-1","tool_name":"eiscore_enterprise_snapshot","arguments":{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true},"query":"safe"}}') }, prototypePayload);
  assert.equal(prototypePayload.status, 200);
  assert.equal(proxyCalls[1].payload.query, 'safe');
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.hasOwn(proxyCalls[1].payload, '__proto__'), false);
  assert.equal(Object.hasOwn(proxyCalls[1].payload, 'constructor'), false);
  assert.equal(Object.hasOwn(proxyCalls[1].payload, 'prototype'), false);
  activeDispatches.get('dsh-session-1').request.plugin = { plugin_id: 'company-sales' };
  activeDispatches.get('dsh-session-1').request.confirmed = true;
  activeDispatches.get('dsh-session-1').request.idempotency_key = 'idempotency-key-0001';
  const proxyWrite = {};
  await proxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'dsh-session-1', tool_name: 'eiscore_sales_write', arguments: { order_id: 'order-1', confirmed: true, idempotency_key: 'forged-by-model', session_id: 'forged-session' } } }, proxyWrite);
  assert.equal(proxyWrite.status, 200);
  assert.equal(proxyCalls.length, 3);
  assert.equal(proxyCalls[2].confirmed, true);
  assert.equal(proxyCalls[2].idempotency_key, 'idempotency-key-0001');
  assert.equal(proxyCalls[2].payload.confirmed, undefined);
  assert.equal(proxyCalls[2].payload.idempotency_key, undefined);
  assert.equal(proxyCalls[2].payload.session_id, undefined);
  const unknownFailureProxy = createHarnessToolProxyHandler({
    registry: proxyRegistry,
    activeDispatches,
    secret: '01234567890123456789012345678901',
    readJsonBody: proxyReadJson,
    sendJson: proxySendJson,
    execute: async () => ({ ok: false, status: 403, code: 'DB_SECRET_123', message: 'postgres password at /etc/secrets' })
  });
  const unknownFailure = {};
  await unknownFailureProxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'dsh-session-1', tool_name: 'eiscore_sales_write', arguments: {} } }, unknownFailure);
  assert.equal(unknownFailure.status, 502);
  assert.deepEqual(unknownFailure.payload, {
    code: 'HARNESS_TOOL_EXECUTION_FAILED',
    message: 'Harness tool execution failed'
  });
  const permissionFailureProxy = createHarnessToolProxyHandler({
    registry: proxyRegistry,
    activeDispatches,
    secret: '01234567890123456789012345678901',
    readJsonBody: proxyReadJson,
    sendJson: proxySendJson,
    execute: async () => ({ ok: false, status: 418, code: 'HARNESS_PERMISSION_DENIED', message: 'internal permission detail' })
  });
  const permissionFailure = {};
  await permissionFailureProxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'dsh-session-1', tool_name: 'eiscore_sales_write', arguments: {} } }, permissionFailure);
  assert.equal(permissionFailure.status, 418);
  assert.deepEqual(permissionFailure.payload, {
    code: 'HARNESS_PERMISSION_DENIED',
    message: 'Harness capability is not permitted'
  });
  const replayProxy = createHarnessToolProxyHandler({
    registry: proxyRegistry,
    activeDispatches,
    secret: '01234567890123456789012345678901',
    readJsonBody: proxyReadJson,
    sendJson: proxySendJson,
    execute: async () => ({ ok: false, status: 409, code: 'HARNESS_REQUEST_REPLAY', message: 'internal replay detail' })
  });
  const replayFailure = {};
  await replayProxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'dsh-session-1', tool_name: 'eiscore_sales_write', arguments: {} } }, replayFailure);
  assert.equal(replayFailure.status, 409);
  assert.deepEqual(replayFailure.payload, {
    code: 'HARNESS_REQUEST_REPLAY',
    message: 'Harness request has already been processed'
  });
  const capacityProxy = createHarnessToolProxyHandler({
    registry: proxyRegistry,
    activeDispatches,
    secret: '01234567890123456789012345678901',
    readJsonBody: proxyReadJson,
    sendJson: proxySendJson,
    execute: async () => ({ ok: false, status: 200, code: 'HARNESS_REQUEST_CAPACITY_EXCEEDED', message: 'internal capacity detail' })
  });
  const capacityFailure = {};
  await capacityProxy({ headers: { 'x-eis-tool-secret': '01234567890123456789012345678901' }, body: { session_id: 'dsh-session-1', tool_name: 'eiscore_sales_write', arguments: {} } }, capacityFailure);
  assert.equal(capacityFailure.status, 429);
  assert.deepEqual(capacityFailure.payload, {
    code: 'HARNESS_REQUEST_CAPACITY_EXCEEDED',
    message: 'Harness request capacity is full'
  });

  console.log('PASS: Harness runtime capability and sales dataset boundaries');
})().catch((error) => { console.error(error); process.exitCode = 1; });
