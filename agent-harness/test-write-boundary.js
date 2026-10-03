'use strict';

const assert = require('node:assert/strict');
const { createHarnessGateway } = require('../realtime/harness-gateway');

const key = '0123456789abcdef0123456789abcdef';
const writeUser = { id: 'user-1', tenant_id: 'tenant-a', token: 'jwt', permissions: ['workflow:write'] };
const writeRequest = (overrides = {}) => ({
  plugin_id: 'workflow',
  agent_id: 'workflow_orchestrator',
  capability_id: 'eiscore_workflow_write',
  user: writeUser,
  ...overrides
});

(async () => {
  let dispatches = 0;
  const events = [];
  const gateway = createHarnessGateway({
    audit: async (event) => events.push(event),
    dispatch: async () => { dispatches += 1; return { ok: true, status: 200, data: { accepted: true } }; },
    auditKey: key
  });

  let result = await gateway.execute(writeRequest({ user: { ...writeUser, tenant_id: '' } }));
  assert.equal(result.code, 'HARNESS_AUTH_REQUIRED');
  assert.equal(dispatches, 0);

  result = await gateway.execute(writeRequest({ user: { ...writeUser, permissions: ['module:bi'] } }));
  assert.equal(result.code, 'HARNESS_PERMISSION_DENIED');
  result = await gateway.execute(writeRequest({ capability_id: 'eiscore_sales_write' }));
  assert.equal(result.code, 'HARNESS_CAPABILITY_MISMATCH');
  result = await gateway.execute(writeRequest({ confirmed: true, idempotency_key: '0123456789abcdef', shadow: true }));
  assert.equal(result.code, 'HARNESS_WRITE_SHADOW_FORBIDDEN');
  result = await gateway.execute(writeRequest({ capability_id: undefined, capabilityId: 'eiscore_workflow_write' }));
  assert.equal(result.code, 'HARNESS_CONFIRMATION_REQUIRED');
  result = await gateway.execute(writeRequest({ idempotency_key: '0123456789abcdef' }));
  assert.equal(result.code, 'HARNESS_CONFIRMATION_REQUIRED');
  result = await gateway.execute(writeRequest({ confirmed: true, idempotency_key: 'short' }));
  assert.equal(result.code, 'HARNESS_IDEMPOTENCY_REQUIRED');

  result = await gateway.execute(writeRequest({ confirmed: true, idempotency_key: '0123456789abcdef' }));
  assert.equal(result.ok, true);
  assert.equal(dispatches, 1);
  assert.equal(events.filter((event) => event.decision === 'allowed').length, 1);
  assert.equal(events.filter((event) => event.decision === 'completed').length, 1);
  assert.equal(events.filter((event) => event.decision === 'error').length, 0);

  let legacyCalls = 0;
  const unavailable = createHarnessGateway({
    audit: async () => {},
    dispatch: async () => { legacyCalls += 1; throw new Error('upstream down'); },
    auditKey: key
  });
  result = await unavailable.execute(writeRequest({ confirmed: true, idempotency_key: 'abcdef0123456789' }));
  assert.equal(result.code, 'HARNESS_UPSTREAM_UNAVAILABLE');
  assert.equal(legacyCalls, 1);

  let terminalEvents = [];
  const terminalAuditFailure = createHarnessGateway({
    audit: async (event) => { terminalEvents.push(event); if (event.decision === 'completed') throw new Error('ledger unavailable'); },
    dispatch: async () => ({ ok: true, status: 200, data: { accepted: true } }),
    auditKey: key
  });
  result = await terminalAuditFailure.execute(writeRequest({ confirmed: true, idempotency_key: 'fedcba9876543210' }));
  assert.equal(result.code, 'HARNESS_AUDIT_UNAVAILABLE');
  assert.deepEqual(terminalEvents.map((event) => event.decision), ['allowed', 'completed']);

  const missingKey = createHarnessGateway({ audit: async () => {}, dispatch: async () => { throw new Error('must not dispatch'); }, auditKey: '' });
  result = await missingKey.execute(writeRequest({ confirmed: true, idempotency_key: '0123456789abcdef' }));
  assert.equal(result.code, 'HARNESS_AUDIT_UNAVAILABLE');

  console.log('PASS: Harness write confirmation, permission, idempotency, shadow and audit boundaries');
})().catch((error) => { console.error(error); process.exitCode = 1; });
