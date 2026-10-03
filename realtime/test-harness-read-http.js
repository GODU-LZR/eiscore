'use strict';

const assert = require('node:assert/strict');
const { createHarnessReadHttpHandlers, visibleAgents } = require('./harness-read-http');
const { createHarnessHttpHandlers } = require('./harness-http');

assert.deepEqual(visibleAgents([
  { plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capabilities: ['eiscore_enterprise_query'], capability_policies: { eiscore_enterprise_query: { intent: 'query', object: 'dataset', risk: 'low', permissions: ['module:bi'], audit_required: true, timeout_ms: 30000 } }, risk: 'low' },
  { plugin_id: 'worker-grid', agent_id: 'worker_assistant', capabilities: ['eiscore_grid_query'], capability_policies: { eiscore_grid_query: { permissions: ['module:production'] } }, risk: 'low' }
], { permissions: ['module:bi'] }), [
  {
    plugin_id: 'enterprise-bi',
    agent_id: 'enterprise_analyst',
    capabilities: ['eiscore_enterprise_query'],
    capability_policies: {
      eiscore_enterprise_query: {
        intent: 'query',
        object: 'dataset',
        risk: 'low',
        permissions: ['module:bi'],
        confirm_required: false,
        idempotency_required: false,
        audit_required: true,
        timeout_ms: 30000
      }
    },
    risk: 'low'
  }
]);

const workflowReadView = visibleAgents([{
  plugin_id: 'workflow',
  agent_id: 'workflow_orchestrator',
  capabilities: ['eiscore_workflow_context', 'eiscore_workflow_write'],
  capability_policies: {
    eiscore_workflow_context: { intent: 'read', object: 'workflow', risk: 'low', permissions: ['workflow:read'], audit_required: true, timeout_ms: 60000 },
    eiscore_workflow_write: { intent: 'write', object: 'workflow', risk: 'high', permissions: ['workflow:write'], confirm_required: true, idempotency_required: true, audit_required: true, timeout_ms: 60000 }
  },
  risk: 'high'
}], { permissions: ['workflow:read'] });
assert.deepEqual(workflowReadView[0].capabilities, ['eiscore_workflow_context']);
assert.equal(workflowReadView[0].capability_policies.eiscore_workflow_context.risk, 'low');
assert.equal(workflowReadView[0].capability_policies.eiscore_workflow_context.confirm_required, false);
assert.equal(workflowReadView[0].capability_policies.eiscore_workflow_context.idempotency_required, false);
assert.equal(Object.hasOwn(workflowReadView[0].capability_policies, 'eiscore_workflow_write'), false);

const run = async (enabled) => {
  let response;
  const handlers = createHarnessReadHttpHandlers({
    authorize: () => ({ id: 'u1', tenant_id: 't1' }),
    registry: { list: () => [{ plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capabilities: [], risk: 'low' }] },
    fetchSnapshot: async () => ({}),
    enabled,
    sendJson: (_res, status, payload) => { response = { status, payload }; }
  });
  handlers.handleConfig({}, {});
  await Promise.resolve();
  return response;
};

const runSnapshot = async (enabled) => {
  let response;
  let fetches = 0;
  const handlers = createHarnessReadHttpHandlers({
    authorize: () => ({ id: 'u1', tenant_id: 't1' }),
    registry: { list: () => [] },
    fetchSnapshot: async () => { fetches += 1; return {}; },
    enabled,
    sendJson: (_res, status, payload) => { response = { status, payload }; }
  });
  await handlers.handleBusinessSnapshot({}, {});
  return { response, fetches };
};

const runDeniedSnapshot = async () => {
  let response;
  const handlers = createHarnessReadHttpHandlers({
    authorize: () => ({ id: 'u1', tenant_id: 't1' }),
    registry: { list: () => [] },
    fetchSnapshot: async () => { const error = new Error('internal details'); error.code = 'HARNESS_PERMISSION_DENIED'; error.httpStatus = 403; throw error; },
    enabled: true,
    sendJson: (_res, status, payload) => { response = { status, payload }; }
  });
  await handlers.handleBusinessSnapshot({}, {});
  return response;
};

const runMetrics = async () => {
  let response;
  const handlers = createHarnessHttpHandlers({
    authorize: () => ({ id: 'u1', tenant_id: 't1', permissions: ['module:bi'] }),
    gateway: { registry: { list: () => [
      { plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capabilities: ['eiscore_enterprise_query'], capability_policies: { eiscore_enterprise_query: { permissions: ['module:bi'] } }, risk: 'low' },
      { plugin_id: 'worker-grid', agent_id: 'worker_assistant', capabilities: ['eiscore_grid_query'], capability_policies: { eiscore_grid_query: { permissions: ['module:production'] } }, risk: 'low' }
    ] } },
    enabled: true,
    readJsonBody: async () => ({}),
    sendJson: (_res, status, payload) => { response = { status, payload }; }
  });
  handlers.handleMetrics({}, {});
  return response;
};

const runExecute = async () => {
  let response;
  let captured;
  const authenticatedUser = { id: 'real-user', tenant_id: 'real-tenant', token: 'real-jwt', permissions: ['module:bi'] };
  const handlers = createHarnessHttpHandlers({
    authorize: () => authenticatedUser,
    gateway: { execute: async (request) => { captured = request; return { ok: true, status: 200, request_id: 'request-1', data: { ok: true } }; } },
    enabled: true,
    readJsonBody: async () => ({
      plugin_id: 'enterprise-bi',
      agent_id: 'enterprise_analyst',
      capability_id: 'eiscore_enterprise_query',
      user: { id: 'forged-user', tenant_id: 'forged-tenant', token: 'forged-jwt' },
      payload: { dataset: 'sales_orders' }
    }),
    sendJson: (_res, status, payload) => { response = { status, payload }; }
  });
  await handlers.handleExecute({}, {});
  return { response, captured, authenticatedUser };
};

(async () => {
  assert.equal((await run(false)).payload.enabled, false);
  assert.equal((await run(true)).payload.enabled, true);
  const disabledSnapshot = await runSnapshot(false);
  assert.deepEqual(disabledSnapshot.response, { status: 503, payload: { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' } });
  assert.equal(disabledSnapshot.fetches, 0);
  assert.deepEqual(await runDeniedSnapshot(), { status: 403, payload: { code: 'HARNESS_PERMISSION_DENIED', message: 'Harness capability is not permitted' } });
  let snapshotSignal;
  let cancellationResponse;
  const snapshotController = new AbortController();
  const snapshotHandlers = createHarnessReadHttpHandlers({
    authorize: () => ({ id: 'u1', tenant_id: 't1' }),
    registry: { list: () => [] },
    fetchSnapshot: async (_user, { signal }) => { snapshotSignal = signal; throw Object.assign(new Error('cancelled'), { code: 'HARNESS_REQUEST_CANCELLED' }); },
    enabled: true,
    sendJson: (_res, status, payload) => { cancellationResponse = { status, payload }; }
  });
  await snapshotHandlers.handleBusinessSnapshot({ signal: snapshotController.signal }, {});
  assert.equal(snapshotSignal, snapshotController.signal);
  assert.deepEqual(cancellationResponse, { status: 499, payload: { code: 'HARNESS_REQUEST_CANCELLED', message: 'Harness request was cancelled' } });
  assert.deepEqual((await runMetrics()).payload.registry.map(({ plugin_id }) => plugin_id), ['enterprise-bi']);
  const executed = await runExecute();
  assert.deepEqual(executed.response, { status: 200, payload: { request_id: 'request-1', data: { ok: true } } });
  assert.equal(executed.captured.user, executed.authenticatedUser);
  assert.equal(executed.captured.user.id, 'real-user');
  assert.equal(executed.captured.user.tenant_id, 'real-tenant');
  assert.equal(executed.captured.user.token, 'real-jwt');
  console.log('PASS: Harness config reports the actual runtime enabled state');
})().catch((error) => { console.error(error); process.exitCode = 1; });
