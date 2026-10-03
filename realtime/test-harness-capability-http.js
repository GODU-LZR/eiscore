'use strict';

const assert = require('node:assert/strict');
const { ROUTE_CAPABILITIES, createHarnessCapabilityHttpHandlers } = require('./harness-capability-http');

const calls = [];
const responses = [];
const handler = createHarnessCapabilityHttpHandlers({
  authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
  gateway: { execute: async (request) => { calls.push(request); return { ok: true, status: 200, data: { text: 'ok' } }; } },
  readJsonBody: async (req) => req.body,
  sendJson: (res, status, payload) => { responses.push({ status, payload }); res.done = true; }
});

const disabledResponses = [];
const disabledHandler = createHarnessCapabilityHttpHandlers({
  authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
  gateway: { execute: async () => { throw new Error('disabled Harness must not dispatch'); } },
  readJsonBody: async (req) => req.body,
  sendJson: (_res, status, payload) => disabledResponses.push({ status, payload }),
  enabled: false
});

(async () => {
  await handler.handleCapability({ url: '/ai/ocr', body: { capability_id: 'eiscore_multimodal_translate', image_url: 'https://example.test/a.png' } }, {});
  assert.deepEqual(responses.pop(), { status: 403, payload: { code: 'HARNESS_CAPABILITY_MISMATCH', message: 'Capability does not match endpoint' } });
  assert.equal(calls.length, 0, 'mismatched route capability must not reach the gateway');

  await handler.handleCapability({ url: '/ai/ocr', body: { image_url: 'https://example.test/a.png' } }, {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].capability_id, ROUTE_CAPABILITIES['/ai/ocr']);
  assert.equal(calls[0].plugin_id, 'enterprise-bi');

  let upstreamResponse;
  const throwingHandler = createHarnessCapabilityHttpHandlers({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
    gateway: { execute: async () => { throw new Error('database password at /etc/secrets'); } },
    readJsonBody: async (req) => req.body,
    sendJson: (_res, status, payload) => { upstreamResponse = { status, payload }; }
  });
  await throwingHandler.handleCapability({ url: '/ai/ocr', body: { image_url: 'https://example.test/a.png' } }, {});
  assert.deepEqual(upstreamResponse, { status: 502, payload: { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' } });

  await disabledHandler.handleCapability({ url: '/ai/ocr', body: { image_url: 'https://example.test/a.png' } }, {});
  assert.deepEqual(disabledResponses[0], { status: 503, payload: { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' } });

  let malformedResponse;
  const malformedHandler = createHarnessCapabilityHttpHandlers({
    authorize: () => ({ id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] }),
    gateway: { execute: async () => { throw new Error('must not dispatch'); } },
    readJsonBody: async () => null,
    sendJson: (_res, status, payload) => { malformedResponse = { status, payload }; }
  });
  await malformedHandler.handleCapability({ url: '/ai/ocr' }, {});
  assert.deepEqual(malformedResponse, { status: 400, payload: { code: 'BAD_REQUEST', message: 'Invalid request body' } });

  console.log('PASS: Harness multimodal HTTP routes enforce fixed capability identities');
})().catch((error) => { console.error(error); process.exitCode = 1; });
