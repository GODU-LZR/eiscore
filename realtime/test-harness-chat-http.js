'use strict';

const assert = require('node:assert/strict');
const { DEFAULT_CHAT_CAPABILITIES, createHarnessChatHttpHandler, sanitizeChatContext, sanitizeMessages } = require('./harness-chat-http');
const { createHarnessGateway } = require('./harness-gateway');

const captured = [];
const responses = [];
const handler = createHarnessChatHttpHandler({
  authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
  readJsonBody: async (req) => req.body,
  sendJson: (_res, status, payload) => responses.push({ status, payload }),
  gateway: { execute: async (request) => { captured.push(request); return { ok: true, status: 200, data: { text: 'ok' } }; } },
  setCorsHeaders: () => {},
  streamTextAsSse: () => {}
});

const disabledResponses = [];
const disabledHandler = createHarnessChatHttpHandler({
  authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
  readJsonBody: async (req) => req.body,
  sendJson: (_res, status, payload) => disabledResponses.push({ status, payload }),
  gateway: { execute: async () => { throw new Error('disabled Harness must not dispatch'); } },
  setCorsHeaders: () => {},
  streamTextAsSse: () => {},
  enabled: false
});

(async () => {
  const context = sanitizeChatContext({
    smartBi: { reportMode: 'manual_question' },
    dataStats: { count: 3 },
    tenant_id: 'tenant-forged',
    Authorization: 'Bearer forged',
    apiUrl: 'http://internal:3000/users',
    model: 'forged-model',
    permissions: ['admin'],
    headers: { authorization: 'Bearer forged' },
     __proto__: { polluted: true },
    nested: { token: 'secret', subject: 'forged-sub', keep: 'yes' }
  });
  assert.equal(context.smartBi.reportMode, 'manual_question');
  assert.equal(context.dataStats.count, 3);
  assert.equal('tenant_id' in context, false);
  assert.equal('Authorization' in context, false);
  assert.equal('apiUrl' in context, false);
  assert.equal('model' in context, false);
  assert.equal('permissions' in context, false);
  assert.equal('headers' in context, false);
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(context.nested, { keep: 'yes' });
  assert.deepEqual(sanitizeMessages([{ role: 'user', content: [{ type: 'text', text: 'ok', token: 'drop' }, { type: 'meta', api_url: 'drop' }] }]), [{ role: 'user', content: [{ type: 'text', text: 'ok' }] }]);

  const incomingSignal = new AbortController().signal;
  await handler({ body: { messages: [{ role: 'user', content: '分析' }], context, stream: false }, signal: incomingSignal }, {});
  assert.equal(captured.length, 1);
  assert.equal(captured[0].capability_id, DEFAULT_CHAT_CAPABILITIES['enterprise-bi']);
  assert.equal(captured[0].kind, 'chat');
  assert.equal(captured[0].signal, incomingSignal, 'chat must forward the HTTP disconnect signal to the gateway');
  assert.equal(captured[0].payload.context.apiUrl, undefined);
  assert.equal(captured[0].payload.context.nested.token, undefined);

  await disabledHandler({ body: { messages: [{ role: 'user', content: '分析' }] } }, {});
  assert.deepEqual(disabledResponses[0], { status: 503, payload: { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' } });

  const workerCapture = [];
  const workerHandler = createHarnessChatHttpHandler({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:production'] }),
    readJsonBody: async (req) => req.body,
    sendJson: () => {},
    gateway: { execute: async (request) => { workerCapture.push(request); return { ok: true, status: 200, data: { text: 'ok' } }; } },
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await workerHandler({ body: { assistant_mode: 'worker', messages: [{ role: 'user', content: '排产' }] } }, {});
  assert.equal(workerCapture[0].capability_id, DEFAULT_CHAT_CAPABILITIES['worker-grid']);

  let throwingResponse;
  const throwingHandler = createHarnessChatHttpHandler({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
    readJsonBody: async () => ({ messages: [{ role: 'user', content: '分析' }] }),
    sendJson: (_res, status, payload) => { throwingResponse = { status, payload }; },
    gateway: { execute: async () => { throw new Error('database password at /etc/secrets'); } },
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await throwingHandler({}, {});
  assert.deepEqual(throwingResponse, { status: 502, payload: { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' } });

  const realDispatches = [];
  const realResponses = [];
  const realGateway = createHarnessGateway({
    audit: async () => {},
    auditKey: '0123456789abcdef0123456789abcdef',
    dispatch: async (request) => {
      realDispatches.push(request);
      return { ok: true, status: 200, data: { choices: [{ message: { role: 'assistant', content: 'ok' } }] } };
    }
  });
  const realHandler = createHarnessChatHttpHandler({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['*'] }),
    readJsonBody: async (req) => req.body,
    sendJson: (_res, status, payload) => realResponses.push({ status, payload }),
    gateway: realGateway,
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  for (const [pluginId, capabilityId] of Object.entries(DEFAULT_CHAT_CAPABILITIES)) {
    await realHandler({ body: { plugin_id: pluginId, messages: [{ role: 'user', content: 'hello' }] } }, {});
    assert.equal(realResponses.at(-1).status, 200, `${pluginId} chat must pass the real Gateway contract`);
    assert.equal(realDispatches.at(-1).capability_id, capabilityId);
    assert.equal(realDispatches.at(-1).kind, 'chat');
  }
  assert.equal(realDispatches.length, Object.keys(DEFAULT_CHAT_CAPABILITIES).length);

  let mismatchedResponse;
  let mismatchedDispatches = 0;
  const mismatchedHandler = createHarnessChatHttpHandler({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
    readJsonBody: async () => ({ plugin_id: 'enterprise-bi', capability_id: 'eiscore_twin_chat', messages: [{ role: 'user', content: '伪造能力' }] }),
    sendJson: (_res, status, payload) => { mismatchedResponse = { status, payload }; },
    gateway: { execute: async () => { mismatchedDispatches += 1; return { ok: true, data: {} }; } },
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await mismatchedHandler({}, {});
  assert.equal(mismatchedResponse.status, 403);
  assert.equal(mismatchedResponse.payload.code, 'HARNESS_CAPABILITY_MISMATCH');
  assert.equal(mismatchedDispatches, 0, 'chat capability mismatch must be rejected before dispatch');

  let unknownResponse;
  let unknownDispatches = 0;
  const unknownPluginGateway = createHarnessGateway({
    audit: async () => {},
    auditKey: '0123456789abcdef0123456789abcdef',
    dispatch: async () => { unknownDispatches += 1; return { ok: true, status: 200 }; }
  });
  const unknownPluginHandler = createHarnessChatHttpHandler({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
  readJsonBody: async () => ({ plugin_id: 'unknown-plugin', messages: [{ role: 'user', content: '分析' }] }),
    sendJson: (_res, status, payload) => { unknownResponse = { status, payload }; },
    gateway: unknownPluginGateway,
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await unknownPluginHandler({}, {});
  assert.equal(unknownResponse.status, 403);
  assert.equal(unknownResponse.payload.code, 'HARNESS_PLUGIN_UNAVAILABLE');
  assert.equal(unknownDispatches, 0, 'unknown chat plugins must be rejected before Harness dispatch');

  let malformedResponse;
  const malformedHandler = createHarnessChatHttpHandler({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
    readJsonBody: async () => { throw new Error('postgres password at /etc/secrets'); },
    sendJson: (_res, status, payload) => { malformedResponse = { status, payload }; },
    gateway: { execute: async () => { throw new Error('must not dispatch'); } },
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await malformedHandler({}, {});
  assert.deepEqual(malformedResponse, { status: 400, payload: { code: 'BAD_REQUEST', message: 'Invalid request body' } });

  let nullResponse;
  const nullHandler = createHarnessChatHttpHandler({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
    readJsonBody: async () => null,
    sendJson: (_res, status, payload) => { nullResponse = { status, payload }; },
    gateway: { execute: async () => { throw new Error('must not dispatch'); } },
    setCorsHeaders: () => {},
    streamTextAsSse: () => {}
  });
  await nullHandler({}, {});
  assert.deepEqual(nullResponse, { status: 400, payload: { code: 'BAD_REQUEST', message: 'Invalid request body' } });

  console.log('PASS: Harness chat strips authorization, tenant, model and internal URL context fields');
})().catch((error) => { console.error(error); process.exitCode = 1; });
