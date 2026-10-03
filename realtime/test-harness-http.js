'use strict';

const assert = require('node:assert/strict');
const { createHarnessHttpHandlers } = require('./harness-http');

const authenticatedUser = { id: 'canonical-user', tenant_id: 'tenant-a', token: 'jwt-a', permissions: ['module:bi'] };
const requests = [];
const responses = [];
const handler = createHarnessHttpHandlers({
  authorize: () => authenticatedUser,
  enabled: true,
  readJsonBody: async (req) => req.body,
  gateway: { execute: async (request) => { requests.push(request); return { ok: true, status: 200, request_id: 'request-1', data: { accepted: true } }; } },
  sendJson: (_res, status, payload) => responses.push({ status, payload })
});

const failureHandler = createHarnessHttpHandlers({
  authorize: () => authenticatedUser,
  enabled: true,
  readJsonBody: async (req) => req.body,
  gateway: { execute: async () => ({ ok: false, status: 502, code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' }) },
  sendJson: (_res, status, payload) => responses.push({ status, payload })
});
const throwingHandler = createHarnessHttpHandlers({
  authorize: () => authenticatedUser,
  enabled: true,
  readJsonBody: async (req) => req.body,
  gateway: { execute: async () => { throw new Error('database password at /etc/secrets'); } },
  sendJson: (_res, status, payload) => responses.push({ status, payload })
});
let disabledGatewayCalls = 0;
const disabledHandler = createHarnessHttpHandlers({
  authorize: () => authenticatedUser,
  enabled: false,
  readJsonBody: async (req) => req.body,
  gateway: { execute: async () => { disabledGatewayCalls += 1; throw new Error('disabled Harness must not dispatch'); } },
  sendJson: (_res, status, payload) => responses.push({ status, payload })
});

(async () => {
  await handler.handleExecute({ body: {
    plugin_id: 'enterprise-bi',
    agent_id: 'enterprise_analyst',
    capability_id: 'eiscore_enterprise_query',
    user: { id: 'attacker', tenant_id: 'tenant-b', token: 'forged-jwt' },
    payload: { tenant_id: 'tenant-b', user_id: 'attacker' },
    dispatch: 'forged-dispatch'
  } }, {});
  assert.deepEqual(requests[0].user, authenticatedUser, 'request body user must not override the authenticated subject');
  assert.equal(requests[0].payload.tenant_id, 'tenant-b', 'payload remains untrusted input for capability validation');
  assert.equal(requests[0].dispatch, undefined, 'clients must not inject a dispatch function');
  assert.deepEqual(responses.pop(), { status: 200, payload: { request_id: 'request-1', data: { accepted: true } } });

  await failureHandler.handleExecute({ body: { plugin_id: 'enterprise-bi', capability_id: 'eiscore_enterprise_query', payload: {} } }, {});
  assert.deepEqual(responses.pop(), { status: 502, payload: { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' } });
  await throwingHandler.handleExecute({ body: { plugin_id: 'enterprise-bi', capability_id: 'eiscore_enterprise_query', payload: {} } }, {});
  assert.deepEqual(responses.pop(), { status: 502, payload: { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' } });
  await disabledHandler.handleExecute({ body: { plugin_id: 'enterprise-bi', capability_id: 'eiscore_enterprise_query', payload: {} } }, {});
  assert.deepEqual(responses.pop(), { status: 503, payload: { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' } });
  assert.equal(disabledGatewayCalls, 0, 'disabled Harness must fail closed before Gateway dispatch');
  await handler.handleExecute({ body: null }, {});
  assert.deepEqual(responses.pop(), { status: 400, payload: { code: 'BAD_REQUEST', message: 'Invalid request body' } });
  await handler.handleExecute({ body: [] }, {});
  assert.deepEqual(responses.pop(), { status: 400, payload: { code: 'BAD_REQUEST', message: 'Invalid request body' } });
  console.log('PASS: Harness execute HTTP boundary preserves authenticated identity and stable failures');
})().catch((error) => { console.error(error); process.exitCode = 1; });
