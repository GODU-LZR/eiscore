'use strict';

const assert = require('node:assert/strict');
const { createHarnessFlashToolCallHandler } = require('./flash-harness-ws');

const calls = [];
const sent = [];
const handler = createHarnessFlashToolCallHandler({
  resolveToolId: (value) => String(value || '').trim(),
  getToolDefinition: (toolId) => toolId === 'flash.data.grid.list'
    ? { risk_level: 'low', confirm_required: false }
    : toolId === 'flash.data.grid.update'
      ? { risk_level: 'high', confirm_required: true }
      : null,
  execute: async (request) => { calls.push(request); return { ok: true, request_id: 'gateway-request-1', code: 'OK', data: { rows: [] } }; },
  sendWsJson: (_ws, payload) => sent.push(payload)
});

(async () => {
  await handler({ user: { id: 'u1', tenant_id: 't1' } }, {
    type: 'flash:tool_call', requestId: 'ws-request-1', sessionId: 'ws-session-1',
    payload: { tool_id: 'flash.data.grid.list', arguments: { table: 'safe' } }, confirmed: false
  });
  assert.equal(calls[0].plugin_id, 'flash-builder');
  assert.equal(calls[0].capability_id, 'eiscore_flash_read');
  assert.equal(calls[0].payload.tool_id, 'flash.data.grid.list');
  assert.equal(calls[0].confirmed, false);
  assert.equal(sent[0].ok, true);
  assert.equal(sent[0].requestId, 'gateway-request-1');

  await handler({ user: { id: 'u1', tenant_id: 't1' } }, {
    type: 'flash:tool_call', request_id: 'ws-request-2', session_id: 'ws-session-1',
    tool_id: 'flash.data.grid.update', arguments: { id: 'row-1' }, confirmed: true,
    idempotency_key: 'idempotency-key-0001'
  });
  assert.equal(calls[1].capability_id, 'eiscore_flash_write');
  assert.equal(calls[1].confirmed, true);
  assert.equal(calls[1].idempotency_key, 'idempotency-key-0001');
  assert.equal(calls[1].payload.arguments.id, 'row-1');

  const disabledCalls = [];
  const disabledSent = [];
  const disabledHandler = createHarnessFlashToolCallHandler({
    enabled: false,
    resolveToolId: (value) => String(value || '').trim(),
    getToolDefinition: () => ({ risk_level: 'low', confirm_required: false }),
    execute: async (request) => { disabledCalls.push(request); return { ok: true }; },
    sendWsJson: (_ws, payload) => disabledSent.push(payload)
  });
  await disabledHandler({ user: { id: 'u1', tenant_id: 't1' } }, {
    type: 'flash:tool_call', requestId: 'disabled-request', tool_id: 'flash.data.grid.list'
  });
  assert.deepEqual(disabledCalls, []);
  assert.deepEqual(disabledSent, [{
    type: 'flash:tool_result', requestId: 'disabled-request', ok: false,
    code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled'
  }]);
  console.log('PASS: Flash WebSocket tool calls enter the Harness Flash capability gateway');
})().catch((error) => { console.error(error); process.exitCode = 1; });
