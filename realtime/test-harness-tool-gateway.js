'use strict';

const assert = require('node:assert/strict');
const { TOOL_GATEWAY_CAPABILITIES, createHarnessToolGateway } = require('./harness-tool-gateway');

assert.equal(TOOL_GATEWAY_CAPABILITIES.length, 18);
assert.equal(new Set(TOOL_GATEWAY_CAPABILITIES).size, TOOL_GATEWAY_CAPABILITIES.length);

(async () => {
  const calls = [];
  let snapshotCalls = 0;
  let snapshotUser = null;
  let twinCalls = 0;
  let workflowCalls = 0;
  let workflowWriteCalls = 0;
  let planCalls = 0;
  let commitCalls = 0;
  let salesWriteCalls = 0;
  let salesContextCalls = 0;
  let queryCalls = 0;
  let twinChatCalls = 0;
  const multimodalCalls = [];
  let resultEnvelopeCalls = 0;
  const readUser = { id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['flash:read'] };
  const gateway = createHarnessToolGateway({
    executeEnterpriseSnapshot: async (user) => { snapshotCalls += 1; snapshotUser = user; if (user.id === 'denied') { const error = new Error('postgres password at /etc/secrets'); error.code = 'HARNESS_PERMISSION_DENIED'; error.httpStatus = 403; throw error; } return { tenant: user.tenant_id, rows: [] }; },
    executeDigitalTwinContext: async (user, payload) => { twinCalls += 1; return { user: user.id, tool: payload.tool_id }; },
    executeDigitalTwinChat: async (user, payload) => { twinChatCalls += 1; return { user: user.id, message: payload.message }; },
    executeWorkflowContext: async (_user, payload) => { workflowCalls += 1; return { tool: payload.tool_id || 'default' }; },
    executeWorkflowWrite: async (_user, payload) => { workflowWriteCalls += 1; return { tool: payload.tool_id || 'default' }; },
    executeConstrainedQuery: async (_user, payload, pluginId) => {
      queryCalls += 1;
      if (payload.forceFailure) { resultEnvelopeCalls += 1; return { ok: false, code: 'HARNESS_PERMISSION_DENIED', status: 403, message: 'internal database detail' }; }
      return { plugin: pluginId, dataset: payload.dataset || 'materials' };
    },
    executeSalesContext: async (_user, payload) => { salesContextCalls += 1; return { dataset: payload.dataset }; },
    executeDocumentPlan: async (_user, payload) => { planCalls += 1; return { plans: [{ id: payload.plan_id || 'p1' }] }; },
    executeDocumentCommit: async (_user, payload) => { commitCalls += 1; return { committed: payload.plan_id }; },
    executeSalesWrite: async (_user, payload) => { salesWriteCalls += 1; return { operation: payload.operation }; },
    executeMultimodal: async (capability, user, payload, request) => {
      multimodalCalls.push({ capability, user, payload, request });
      if (capability === 'eiscore_multimodal_map_locate') return { choices: [{ message: { content: '深圳南山' } }] };
      return { choices: [{ message: { content: capability.endsWith('_ocr') ? '识别结果' : 'translated' } }] };
    },
    executeFlashToolCall: async (...args) => {
      calls.push(args);
      return { status: 200, payload: { ok: true, code: 'OK', message: 'ok', data: { rowsAffected: 1 } } };
    }
  });
  let result = await gateway.execute({ capability_id: 'eiscore_engineering_context', payload: {}, user: {} });
  assert.equal(result.code, 'HARNESS_TOOL_UNAVAILABLE');
  assert.equal(calls.length, 0);

  const snapshotRequestUser = { id: 'u1', tenant_id: 'tenant-a', token: 'jwt', permissions: ['module:bi'] };
  result = await gateway.execute({ capability_id: 'eiscore_enterprise_snapshot', payload: {}, user: snapshotRequestUser });
  assert.deepEqual(result.data, { tenant: 'tenant-a', rows: [] });
  assert.equal(snapshotCalls, 1);
  assert.equal(snapshotUser, snapshotRequestUser);

  result = await gateway.execute({ capability_id: 'eiscore_enterprise_snapshot', payload: {}, user: { ...snapshotRequestUser, id: 'denied' } });
  assert.equal(result.code, 'HARNESS_PERMISSION_DENIED');
  assert.equal(result.status, 403);
  assert.equal(result.message, 'Harness capability is not permitted');
  assert.equal(result.message.includes('/etc/secrets'), false);

  const leakingExecutor = createHarnessToolGateway({
    executeEnterpriseSnapshot: async () => { const error = new Error('internal SQL /var/run/postgresql'); error.code = 'DB_SECRET_123'; error.httpStatus = 418; throw error; },
    executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } })
  });
  result = await leakingExecutor.execute({ capability_id: 'eiscore_enterprise_snapshot', payload: {}, user: snapshotRequestUser });
  assert.deepEqual(result, { ok: false, code: 'HARNESS_TOOL_EXECUTION_FAILED', status: 418, message: 'Harness tool request rejected' });

  result = await gateway.execute({ capability_id: 'eiscore_twin_context', payload: { tool_id: 'query_inventory' }, user: { id: 'u2', tenant_id: 'tenant-b', token: 'jwt', permissions: ['twin:read'] } });
  assert.deepEqual(result.data, { user: 'u2', tool: 'query_inventory' });
  assert.equal(twinCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_twin_chat', payload: { message: 'hello' }, user: { id: 'u2', tenant_id: 'tenant-b', token: 'jwt', permissions: ['twin:read'] } });
  assert.deepEqual(result.data, { user: 'u2', message: 'hello' });
  assert.equal(twinChatCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_enterprise_query', payload: { dataset: 'sales_orders' }, user: { id: 'u2', tenant_id: 'tenant-b', token: 'jwt', permissions: ['module:bi'] }, plugin_id: 'enterprise-bi' });
  assert.deepEqual(result.data, { plugin: 'enterprise-bi', dataset: 'sales_orders' });
  assert.equal(queryCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_grid_query', payload: { dataset: 'materials' }, user: { id: 'u2', tenant_id: 'tenant-b', token: 'jwt', permissions: ['module:materials'] }, plugin_id: 'worker-grid' });
  assert.deepEqual(result.data, { plugin: 'worker-grid', dataset: 'materials' });
  assert.equal(queryCalls, 2);

  result = await gateway.execute({ capability_id: 'eiscore_enterprise_query', payload: { forceFailure: true }, user: snapshotRequestUser, plugin_id: 'enterprise-bi' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HARNESS_PERMISSION_DENIED');
  assert.equal(result.status, 403);
  assert.equal(result.data, undefined);
  assert.equal(result.message, 'Harness capability is not permitted');
  assert.equal(resultEnvelopeCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_workflow_context', payload: { tool_id: 'flash.workflow.definition.list' }, user: { id: 'u3', tenant_id: 'tenant-c', token: 'jwt', permissions: ['workflow:read'] } });
  assert.deepEqual(result.data, { tool: 'flash.workflow.definition.list' });
  assert.equal(workflowCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_workflow_write', payload: { tool_id: 'flash.workflow.instance.transition' }, user: { id: 'u3', tenant_id: 'tenant-c', token: 'jwt', permissions: ['workflow:write'] } });
  assert.deepEqual(result.data, { tool: 'flash.workflow.instance.transition' });
  assert.equal(workflowWriteCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_sales_context', payload: { dataset: 'sales_orders' }, user: { id: 'u5', tenant_id: 'tenant-e', token: 'jwt', permissions: ['sales:read'] } });
  assert.deepEqual(result.data, { dataset: 'sales_orders' });
  assert.equal(salesContextCalls, 1);

  const contextGateway = createHarnessToolGateway({
    executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } }),
    executeEngineeringContext: async (user, payload) => ({ context: 'engineering', view: payload.view || 'overview', data: { subject: user.id } }),
    executeSiteSales: async (user, payload) => ({ context: 'site-sales', view: payload.view || 'catalog', data: { tenant: user.tenant_id } })
  });
  result = await contextGateway.execute({ capability_id: 'eiscore_engineering_context', payload: { view: 'work-orders' }, user: { id: 'u6', tenant_id: 'tenant-f', token: 'jwt', permissions: ['engineering:read'] } });
  assert.deepEqual(result.data, { context: 'engineering', view: 'work-orders', data: { subject: 'u6' } });
  result = await contextGateway.execute({ capability_id: 'eiscore_site_sales', payload: { view: 'catalog' }, user: { id: 'visitor-1', tenant_id: 'public', token: 'anonymous-session', permissions: ['site:sales'] } });
  assert.deepEqual(result.data, { context: 'site-sales', view: 'catalog', data: { tenant: 'public' } });

  result = await gateway.execute({ capability_id: 'eiscore_document_plan', payload: { plan_id: 'plan-1' }, user: { id: 'u4', tenant_id: 'tenant-d', token: 'jwt', permissions: ['document:read'] } });
  assert.deepEqual(result.data, { plans: [{ id: 'plan-1' }] });
  assert.equal(planCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_document_commit', payload: { plan_id: 'plan-1' }, user: { id: 'u4', tenant_id: 'tenant-d', token: 'jwt', permissions: ['document:write'] }, confirmed: true, idempotency_key: '0123456789abcdef' });
  assert.deepEqual(result.data, { committed: 'plan-1' });
  assert.equal(commitCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_sales_write', payload: { operation: 'opportunity_draft_create' }, user: { id: 'u5', tenant_id: 'tenant-e', token: 'jwt', permissions: ['sales:write'] }, confirmed: true, idempotency_key: '0123456789abcdef' });
  assert.deepEqual(result.data, { operation: 'opportunity_draft_create' });
  assert.equal(salesWriteCalls, 1);

  result = await gateway.execute({ capability_id: 'eiscore_multimodal_translate', payload: { text: 'hello', token: 'forged' }, user: snapshotRequestUser, plugin_id: 'enterprise-bi' });
  assert.equal(result.code, 'HARNESS_MULTIMODAL_INVALID');
  assert.equal(multimodalCalls.length, 0);
  result = await gateway.execute({ capability_id: 'eiscore_multimodal_translate', payload: { text: 'hello' }, user: snapshotRequestUser, plugin_id: 'enterprise-bi' });
  assert.deepEqual(result.data, { text: 'translated' });
  assert.equal(multimodalCalls[0].capability, 'eiscore_multimodal_translate');
  assert.equal(multimodalCalls[0].payload.messages[1].content, 'hello');
  assert.equal(multimodalCalls[0].payload.token, undefined);
  result = await gateway.execute({ capability_id: 'eiscore_multimodal_ocr', payload: { image_url: 'https://example.test/a.png' }, user: snapshotRequestUser, plugin_id: 'enterprise-bi' });
  assert.deepEqual(result.data, { text: '识别结果' });
  result = await gateway.execute({ capability_id: 'eiscore_multimodal_map_locate', payload: { image_url: 'https://example.test/map.png', lat: 22.5, lng: 113.9 }, user: snapshotRequestUser, plugin_id: 'enterprise-bi' });
  assert.deepEqual(result.data, { address: '深圳南山' });
  assert.equal(multimodalCalls.length, 3);
  const multimodalFailureGateway = createHarnessToolGateway({
    executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } }),
    executeMultimodal: async () => ({ ok: false, code: 'HARNESS_PERMISSION_DENIED', status: 403 })
  });
  result = await multimodalFailureGateway.execute({ capability_id: 'eiscore_multimodal_ocr', payload: { image_url: 'https://example.test/a.png' }, user: snapshotRequestUser, plugin_id: 'enterprise-bi' });
  assert.deepEqual(result, { ok: false, code: 'HARNESS_PERMISSION_DENIED', status: 403, message: 'Harness capability is not permitted' });

  result = await gateway.execute({
    capability_id: 'eiscore_flash_read',
    request_id: 'req-read',
    session_id: 'session-read',
    payload: { tool_id: 'flash.app.list', arguments: { limit: 5 } },
    user: readUser
  });
  assert.equal(result.ok, true);
  assert.equal(calls[0][0], readUser);
  assert.equal(calls[0][1].tool_id, 'flash.app.list');
  assert.deepEqual(calls[0][1].arguments, { limit: 5 });
  assert.equal(calls[0][1].trace_id, 'req-read');
  assert.equal(calls[0][2], 'harness');

  result = await gateway.execute({
    capability_id: 'eiscore_flash_write',
    request_id: 'req-write',
    confirmed: true,
    idempotency_key: '0123456789abcdef',
    payload: { tool_id: 'flash.app.create', arguments: { name: 'demo' } },
    user: { id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['flash:write'] }
  });
  assert.equal(result.ok, true);
  assert.equal(calls[1][1].tool_id, 'flash.app.create');
  assert.equal(calls[1][1].confirmed, true);
  assert.equal(calls[1][1].idempotency_key, '0123456789abcdef');
  result = await gateway.execute({
    capability_id: 'eiscore_flash_write',
    payload: { tool_id: 'flash.app.create', confirmed: true, idempotency_key: 'forged-by-payload' },
    user: { id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['flash:write'] }
  });
  assert.equal(result.ok, true);
  assert.equal(calls[2][1].confirmed, false);
  assert.equal(calls[2][1].idempotency_key, '');

  const capacityGateway = createHarnessToolGateway({
    executeFlashToolCall: async () => ({ status: 429, payload: { ok: false, code: 'CAPACITY_EXCEEDED', message: 'internal cache detail' } })
  });
  result = await capacityGateway.execute({ capability_id: 'eiscore_flash_write', payload: { tool_id: 'flash.app.create' }, user: readUser });
  assert.equal(result.code, 'HARNESS_CAPACITY_EXCEEDED');
  assert.equal(result.status, 429);
  assert.equal(result.message, 'Harness tool request rejected');

  console.log('PASS: Harness local Tool Gateway capability dispatch and context binding');
})().catch((error) => { console.error(error); process.exitCode = 1; });
