'use strict';

const assert = require('node:assert/strict');
const { createHarnessGateway } = require('./harness-gateway');

const audits = [];
let dispatched = 0;
const gateway = createHarnessGateway({
  audit: async (event) => audits.push(event),
  dispatch: async (request) => {
    dispatched += 1;
    if (request.kind === 'chat') return { ok: true, status: 200, data: { choices: [{ message: { role: 'assistant', content: 'ok' } }] } };
    if (request.capability_id === 'eiscore_twin_context') return { ok: true, status: 200, data: { tool_id: 'query_inventory', result: [] } };
    if (request.capability_id === 'eiscore_twin_chat') return { ok: true, status: 200, data: { choices: [{ message: { role: 'assistant', content: 'ok' } }] } };
    if (request.capability_id === 'eiscore_enterprise_query') return { ok: true, status: 200, data: { dataset: 'sales_orders', rows: [], limit: 20 } };
    return { ok: true, status: 200, data: { capability: request.capability_id } };
  },
  auditKey: '0123456789abcdef0123456789abcdef'
});
const user = { id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['module:bi'] };

(async () => {
let result = await gateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_query',
  user,
  payload: { dataset: 'sales_orders', select: 'id,order_no' }
});
assert.equal(result.ok, true);
assert.equal(dispatched, 1);
assert.equal(audits.at(-1).decision, 'completed');
assert.equal(audits.filter((event) => event.decision === 'allowed').length, 1);
assert.equal(audits.at(-1).subject_hash.length, 64);
assert.equal(audits.at(-1).intent, 'query_business_dataset');
assert.equal(audits.at(-1).object, 'enterprise_dataset');
assert.equal(audits.at(-1).risk, 'low');
assert.equal(audits.at(-1).audit_required, true);
assert.equal(audits.at(-1).timeout_ms, 30000);
for (const event of audits) {
  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes('jwt'), false);
  assert.equal(serialized.includes('sales_orders'), false);
}

result = await gateway.execute({
  kind: 'chat',
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_query',
  user,
  payload: { messages: [{ role: 'user', content: '分析销售' }], stream: false, context: { reportMode: 'manual_question' } }
});
assert.equal(result.ok, true);
assert.equal(dispatched, 2);

const chatCases = [
  ['worker-grid', 'worker_assistant', 'eiscore_grid_query', ['module:production']],
  ['digital-twin', 'digital_twin', 'eiscore_twin_chat', ['twin:read']],
  ['workflow', 'workflow_orchestrator', 'eiscore_workflow_context', ['workflow:read']],
  ['company-sales', 'company_sales_agent', 'eiscore_sales_context', ['sales:read']],
  ['document-intake', 'document_intake', 'eiscore_document_plan', ['document:read']],
  ['flash-builder', 'flash_builder', 'eiscore_flash_read', ['flash:read']],
  ['engineering', 'engineering', 'eiscore_engineering_context', ['engineering:read']],
  ['independent-site-sales', 'site_sales', 'eiscore_site_sales', ['site:sales']]
];
for (const [plugin_id, agent_id, capability_id, permissions] of chatCases) {
  result = await gateway.execute({
    kind: 'chat', plugin_id, agent_id, capability_id,
    user: { ...user, permissions },
    payload: { messages: [{ role: 'user', content: 'hello' }], stream: false, context: {} }
  });
  assert.equal(result.ok, true, `${capability_id} chat payload should pass its chat contract`);
}
const chatDispatches = dispatched;
result = await gateway.execute({
  kind: 'chat', plugin_id: 'worker-grid', agent_id: 'worker_assistant', capability_id: 'eiscore_grid_query',
  user: { ...user, permissions: ['module:production'] },
  payload: { messages: [{ role: 'user', content: 'hello' }], provider: 'forged' }
});
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal(result.status, 400);
assert.equal(result.message, 'Harness capability payload does not match its contract');
assert.equal(dispatched, chatDispatches, 'undeclared chat fields must be rejected before dispatch');

result = await gateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user,
  payload: []
});
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal(dispatched, chatDispatches);

const invalidQueryOutputGateway = createHarnessGateway({
  audit: async () => {},
  dispatch: async () => ({ ok: true, status: 200, data: { dataset: 'sales_orders', rows: [], limit: '20' } }),
  auditKey: '0123456789abcdef0123456789abcdef'
});
result = await invalidQueryOutputGateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_query',
  user,
  payload: { dataset: 'sales_orders' }
});
assert.equal(result.code, 'HARNESS_OUTPUT_SCHEMA_INVALID');
assert.equal(result.status, 502);

result = await gateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_query',
  user,
  payload: { dataset: 'sales_orders', authorization: 'Bearer secret' }
});
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal(dispatched, chatDispatches);

result = await gateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_multimodal_translate',
  user,
  payload: { text: 'hello', provider: 'forged' }
});
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal(dispatched, chatDispatches, 'multimodal schema rejects undeclared provider fields before dispatch');

const multimodalSchemaCalls = [];
const multimodalSchemaGateway = createHarnessGateway({
  audit: async () => {},
  auditKey: '0123456789abcdef0123456789abcdef',
  dispatch: async (request) => {
    multimodalSchemaCalls.push(request)
    const data = request.capability_id === 'eiscore_multimodal_map_locate' ? { address: 'Shenzhen' } : { text: 'ok' }
    return { ok: true, status: 200, data }
  }
});
for (const [capability_id, payload] of [
  ['eiscore_multimodal_translate', { text: 'hello', prompt: 'translate' }],
  ['eiscore_multimodal_ocr', { imageUrl: 'https://example.test/scan.png' }],
  ['eiscore_multimodal_map_locate', { image_url: 'https://example.test/map.png', lat: 22.5, lng: 113.9 }]
]) {
  result = await multimodalSchemaGateway.execute({ plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id, user, payload });
  assert.equal(result.ok, true, `${capability_id} valid payload should match its contract`);
}
result = await multimodalSchemaGateway.execute({
  plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: 'eiscore_multimodal_ocr', user,
  payload: { image_url: 'https://example.test/scan.png', tenant_id: 'forged' }
});
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal(multimodalSchemaCalls.length, 3, 'invalid multimodal payload must be rejected before dispatch');

const contextSchemaGateway = createHarnessGateway({
  audit: async () => {},
  auditKey: '0123456789abcdef0123456789abcdef',
  dispatch: async (request) => ({ ok: true, status: 200, data: { context: request.capability_id === 'eiscore_site_sales' ? 'site_sales' : 'engineering', view: 'equipment', data: {} } })
});
for (const [plugin_id, agent_id, capability_id] of [
  ['engineering', 'engineering', 'eiscore_engineering_context'],
  ['independent-site-sales', 'site_sales', 'eiscore_site_sales']
]) {
  result = await contextSchemaGateway.execute({ plugin_id, agent_id, capability_id, user: { ...user, permissions: plugin_id === 'engineering' ? ['engineering:read'] : ['site:sales'] }, payload: { view: 'equipment' } });
  assert.equal(result.ok, true, `${capability_id} valid view should match its contract`);
  result = await contextSchemaGateway.execute({ plugin_id, agent_id, capability_id, user: { ...user, permissions: plugin_id === 'engineering' ? ['engineering:read'] : ['site:sales'] }, payload: { sql: 'select 1' } });
  assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
}

const documentSchemaGateway = createHarnessGateway({
  audit: async () => {},
  auditKey: '0123456789abcdef0123456789abcdef',
  dispatch: async (request) => {
    if (request.capability_id === 'eiscore_document_plan') return { ok: true, status: 200, data: { plans: [] } };
    if (request.capability_id === 'eiscore_document_commit') return { ok: true, status: 200, data: { plan: {}, processed: true, queued: false } };
    if (request.capability_id === 'eiscore_sales_context') return { ok: true, status: 200, data: { dataset: 'sales_orders', rows: [], limit: 5 } };
    return { ok: true, status: 200, data: { result: {} } };
  }
});
result = await documentSchemaGateway.execute({ plugin_id: 'digital-twin', agent_id: 'digital_twin', capability_id: 'eiscore_twin_context', user: { ...user, permissions: ['twin:read'] }, payload: {} });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
result = await documentSchemaGateway.execute({ plugin_id: 'digital-twin', agent_id: 'digital_twin', capability_id: 'eiscore_twin_chat', user: { ...user, permissions: ['twin:read'] }, payload: {} });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
result = await documentSchemaGateway.execute({ plugin_id: 'document-intake', agent_id: 'document_intake', capability_id: 'eiscore_document_plan', user: { ...user, permissions: ['document:read'] }, payload: { plan_id: '11111111-1111-4111-8111-111111111111' } });
assert.equal(result.ok, true);
result = await documentSchemaGateway.execute({ plugin_id: 'document-intake', agent_id: 'document_intake', capability_id: 'eiscore_document_plan', user: { ...user, permissions: ['document:read'] }, payload: { sql: 'select 1' } });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
result = await documentSchemaGateway.execute({ plugin_id: 'document-intake', agent_id: 'document_intake', capability_id: 'eiscore_document_commit', user: { ...user, permissions: ['document:write'] }, confirmed: true, idempotency_key: 'document-commit-012345', payload: { plan_id: '11111111-1111-4111-8111-111111111111', plan_version: 'v1' } });
assert.equal(result.ok, true);
result = await documentSchemaGateway.execute({ plugin_id: 'document-intake', agent_id: 'document_intake', capability_id: 'eiscore_document_commit', user: { ...user, permissions: ['document:write'] }, confirmed: true, idempotency_key: 'document-empty-0123456', payload: {} });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
const documentReplayGateway = createHarnessGateway({
  audit: async () => {},
  auditKey: '0123456789abcdef0123456789abcdef',
  dispatch: async () => ({ ok: true, status: 200, data: { plan: {}, processed: true, queued: false, idempotent_replay: true } })
});
result = await documentReplayGateway.execute({ plugin_id: 'document-intake', agent_id: 'document_intake', capability_id: 'eiscore_document_commit', user: { ...user, permissions: ['document:write'] }, confirmed: true, idempotency_key: 'document-replay-012345', payload: { plan_id: '11111111-1111-4111-8111-111111111111', plan_version: 'v1' } });
assert.equal(result.ok, true);
result = await documentSchemaGateway.execute({ plugin_id: 'document-intake', agent_id: 'document_intake', capability_id: 'eiscore_document_commit', user: { ...user, permissions: ['document:write'] }, confirmed: true, idempotency_key: 'document-commit-012345', payload: { plan_id: '11111111-1111-4111-8111-111111111111', plan_version: 'v1', sql: 'drop table' } });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');

for (const [plugin_id, agent_id, capability_id, permissions, payload] of [
  ['workflow', 'workflow_orchestrator', 'eiscore_workflow_context', ['workflow:read'], { tool_id: 'flash.workflow.definition.list' }],
  ['workflow', 'workflow_orchestrator', 'eiscore_workflow_write', ['workflow:write'], { tool_id: 'flash.workflow.instance.transition', arguments: {} }],
  ['company-sales', 'company_sales_agent', 'eiscore_sales_context', ['sales:read'], { dataset: 'sales_orders', select: 'id,order_no', limit: 5 }],
  ['company-sales', 'company_sales_agent', 'eiscore_sales_write', ['sales:write'], { action: 'sales_approval', objectType: 'quote', objectId: '11111111-1111-4111-8111-111111111111', decision: 'approve' }]
]) {
  result = await documentSchemaGateway.execute({ plugin_id, agent_id, capability_id, user: { ...user, permissions }, confirmed: capability_id.endsWith('_write'), idempotency_key: capability_id.endsWith('_write') ? 'workflow-write-012345' : undefined, payload });
  assert.equal(result.ok, true, `${capability_id} valid payload should match its contract`);
}
result = await documentSchemaGateway.execute({ plugin_id: 'workflow', agent_id: 'workflow_orchestrator', capability_id: 'eiscore_workflow_context', user: { ...user, permissions: ['workflow:read'] }, payload: { sql: 'select 1' } });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
result = await documentSchemaGateway.execute({ plugin_id: 'company-sales', agent_id: 'company_sales_agent', capability_id: 'eiscore_sales_context', user: { ...user, permissions: ['sales:read'] }, payload: { dataset: 'employees' } });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
result = await documentSchemaGateway.execute({ plugin_id: 'company-sales', agent_id: 'company_sales_agent', capability_id: 'eiscore_sales_write', user: { ...user, permissions: ['sales:write'] }, confirmed: true, idempotency_key: 'sales-write-01234567', payload: { operation: 'sales_approval', object_type: 'quote', object_id: '11111111-1111-4111-8111-111111111111', decision: 'approve', sql: 'drop table' } });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
result = await documentSchemaGateway.execute({ plugin_id: 'flash-builder', agent_id: 'flash_builder', capability_id: 'eiscore_flash_read', user: { ...user, permissions: ['flash:read'] }, payload: { toolId: 'flash.app.list', args: { limit: 5 } } });
assert.equal(result.ok, true);
result = await documentSchemaGateway.execute({ plugin_id: 'flash-builder', agent_id: 'flash_builder', capability_id: 'eiscore_flash_read', user: { ...user, permissions: ['flash:read'] }, payload: { tool_id: 'flash.app.list', toolId: 'flash.app.list' } });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
result = await documentSchemaGateway.execute({ plugin_id: 'flash-builder', agent_id: 'flash_builder', capability_id: 'eiscore_flash_write', user: { ...user, permissions: ['flash:write'] }, confirmed: true, idempotency_key: 'flash-write-01234567', payload: { tool_id: 'flash.app.create', arguments: { name: 'demo' }, confirmed: true, idempotency_key: 'forged-by-model', sql: 'drop table' } });
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');

result = await gateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user,
  payload: { unexpected: true }
});
assert.equal(result.code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal(dispatched, chatDispatches);

const invalidOutputGateway = createHarnessGateway({
  audit: async () => {},
  dispatch: async () => ({ ok: true, status: 200, data: 'scalar-result' }),
  auditKey: '0123456789abcdef0123456789abcdef'
});
result = await invalidOutputGateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user
});
assert.equal(result.code, 'HARNESS_OUTPUT_SCHEMA_INVALID');
assert.equal(result.status, 502);

const strictPlugin = {
  plugin_id: 'strict-plugin',
  agent_id: 'strict-agent',
  capabilities: ['strict-capability'],
  permissions: ['strict:read'],
  timeout_ms: 30000,
  audit_required: true,
  capability_policies: {
    'strict-capability': {
      intent: 'strict_read',
      object: 'strict_object',
      risk: 'low',
      permissions: ['strict:read'],
      input_schema: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' } } },
      output_schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
      audit_required: true,
      timeout_ms: 30000
    }
  }
};
const strictGateway = createHarnessGateway({
  registry: { getById: () => strictPlugin, getByAgent: () => strictPlugin, resolveCapability: () => strictPlugin },
  audit: async () => {},
  dispatch: async () => ({ ok: true, status: 200, data: { ok: true } }),
  auditKey: '0123456789abcdef0123456789abcdef'
});
const strictRequest = (payload) => ({ plugin_id: 'strict-plugin', agent_id: 'strict-agent', capability_id: 'strict-capability', user: { id: 'u1', tenant_id: 't1', token: 'jwt', permissions: ['strict:read'] }, payload });
assert.equal((await strictGateway.execute(strictRequest({}))).code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal((await strictGateway.execute(strictRequest({ name: 7 }))).code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal((await strictGateway.execute(strictRequest({ name: 'ok', extra: true }))).code, 'HARNESS_INPUT_SCHEMA_INVALID');
assert.equal((await strictGateway.execute(strictRequest({ name: 'ok' }))).ok, true);

const missingOutputGateway = createHarnessGateway({
  audit: async () => {},
  dispatch: async () => ({ ok: true, status: 200 }),
  auditKey: '0123456789abcdef0123456789abcdef'
});
result = await missingOutputGateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user
});
assert.equal(result.code, 'HARNESS_OUTPUT_SCHEMA_INVALID');

const invalidFailureStatusGateway = createHarnessGateway({
  audit: async () => {},
  dispatch: async () => ({ ok: false, status: 200, code: 'HARNESS_TOOL_EXECUTION_FAILED', message: 'internal detail' }),
  auditKey: '0123456789abcdef0123456789abcdef'
});
result = await invalidFailureStatusGateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user
});
assert.equal(result.ok, false);
assert.equal(result.status, 502, 'failed Harness dispatches must never return a 2xx status');

const unknownFailureGateway = createHarnessGateway({
  audit: async () => {},
  dispatch: async () => ({ ok: false, status: 500, code: 'DB_INTERNAL', message: 'postgres password at /etc/secrets' }),
  auditKey: '0123456789abcdef0123456789abcdef'
});
result = await unknownFailureGateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user
});
assert.deepEqual({ ok: result.ok, status: result.status, code: result.code, message: result.message }, {
  ok: false,
  status: 500,
  code: 'HARNESS_UPSTREAM_UNAVAILABLE',
  message: 'DeepSeek Harness is unavailable'
}, 'Gateway must normalize unknown dispatch errors before HTTP handlers expose them');

result = await gateway.execute({ plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', user });
assert.equal(result.code, 'HARNESS_CAPABILITY_REQUIRED');
assert.equal(dispatched, chatDispatches);

result = await gateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'digital_twin',
  capability_id: 'eiscore_enterprise_snapshot',
  user
});
assert.equal(result.code, 'HARNESS_AGENT_MISMATCH');
assert.equal(dispatched, chatDispatches, 'agent identity mismatch must be rejected before dispatch');

result = await gateway.execute({
  plugin_id: 'unknown-plugin',
  capability_id: 'eiscore_enterprise_snapshot',
  user
});
assert.equal(result.code, 'HARNESS_PLUGIN_MISMATCH');
assert.equal(dispatched, chatDispatches, 'unknown plugin must not fall through capability resolution');

result = await gateway.execute({ plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: 'eiscore_enterprise_snapshot', user: { ...user, tenant_id: '' } });
assert.equal(result.code, 'HARNESS_AUTH_REQUIRED');
assert.equal(dispatched, chatDispatches);

result = await gateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user,
  request_id: `${'x'.repeat(257)}`
});
assert.equal(result.code, 'HARNESS_REQUEST_INVALID');
assert.equal(result.status, 400);
assert.equal(dispatched, chatDispatches, 'invalid request ids must be rejected before dispatch');

result = await gateway.execute({ plugin_id: 'workflow', agent_id: 'workflow_orchestrator', capability_id: 'eiscore_workflow_write', user: { ...user, permissions: ['workflow:write'] } });
assert.equal(result.code, 'HARNESS_CONFIRMATION_REQUIRED');
result = await gateway.execute({ plugin_id: 'workflow', agent_id: 'workflow_orchestrator', capability_id: 'eiscore_workflow_write', user: { ...user, permissions: ['workflow:write'] }, confirmed: true, idempotency_key: 'short' });
assert.equal(result.code, 'HARNESS_IDEMPOTENCY_REQUIRED');
result = await gateway.execute({ plugin_id: 'workflow', agent_id: 'workflow_orchestrator', capability_id: 'eiscore_workflow_write', user: { ...user, permissions: ['workflow:write'] }, confirmed: true, idempotency_key: '0123456789abcdef' });
assert.equal(result.ok, true);
assert.equal(dispatched, chatDispatches + 1);
const idempotentWriteRequest = {
  plugin_id: 'workflow',
  agent_id: 'workflow_orchestrator',
  capability_id: 'eiscore_workflow_write',
  user: { ...user, permissions: ['workflow:write'] },
  confirmed: true,
  idempotency_key: 'gateway-idempotency-0123'
};
result = await gateway.execute({ ...idempotentWriteRequest, request_id: 'write-idempotency-a' });
assert.equal(result.ok, true);
const dispatchedBeforeIdempotencyReplay = dispatched;
result = await gateway.execute({ ...idempotentWriteRequest, request_id: 'write-idempotency-b' });
assert.equal(result.code, 'HARNESS_REQUEST_REPLAY', 'a write idempotency key must reserve the capability operation across request ids');
assert.equal(dispatched, dispatchedBeforeIdempotencyReplay);
result = await gateway.execute({
  ...idempotentWriteRequest,
  request_id: 'write-idempotency-other-tenant',
  user: { ...idempotentWriteRequest.user, id: 'u2', tenant_id: 't2' }
});
assert.equal(result.ok, true, 'idempotency keys must remain isolated by authenticated tenant and subject');
assert.equal(dispatched, dispatchedBeforeIdempotencyReplay + 1);

const replayRequest = { plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: 'eiscore_enterprise_snapshot', user, request_id: 'replay-request-1' };
result = await gateway.execute(replayRequest);
assert.equal(result.ok, true);
const dispatchedBeforeReplay = dispatched;
result = await gateway.execute(replayRequest);
assert.equal(result.code, 'HARNESS_REQUEST_REPLAY');
assert.equal(result.status, 409);
assert.equal(dispatched, dispatchedBeforeReplay);
assert.equal(audits.at(-1).code, 'HARNESS_REQUEST_REPLAY');
result = await gateway.execute({ ...replayRequest, user: { ...user, id: 'u2', tenant_id: 't2' } });
assert.equal(result.ok, true, 'the same request id must be isolated by authenticated tenant and subject');
assert.equal(dispatched, dispatchedBeforeReplay + 1);

let replayNow = 0;
const expiringGateway = createHarnessGateway({
  clock: () => replayNow,
  requestTtlMs: 10,
  audit: async () => {},
  dispatch: async () => ({ ok: true, status: 200, data: {} }),
  auditKey: '0123456789abcdef0123456789abcdef'
});
const expiringRequest = { plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: 'eiscore_enterprise_snapshot', user, request_id: 'replay-expiring' };
assert.equal((await expiringGateway.execute(expiringRequest)).ok, true);
replayNow = 11;
assert.equal((await expiringGateway.execute(expiringRequest)).ok, true);

let boundedReplayNow = 0;
let boundedDispatches = 0;
const boundedReplayGateway = createHarnessGateway({
  clock: () => boundedReplayNow,
  requestTtlMs: 10,
  maxTrackedRequests: 1,
  audit: async () => {},
  dispatch: async () => { boundedDispatches += 1; return { ok: true, status: 200, data: {} }; },
  auditKey: '0123456789abcdef0123456789abcdef'
});
const boundedReplayRequest = (request_id) => ({ ...expiringRequest, request_id });
assert.equal((await boundedReplayGateway.execute(boundedReplayRequest('bounded-a'))).ok, true);
result = await boundedReplayGateway.execute(boundedReplayRequest('bounded-b'));
assert.equal(result.code, 'HARNESS_CAPACITY_EXCEEDED');
assert.equal(result.status, 429);
assert.equal(boundedDispatches, 1, 'replay records at capacity must be retained rather than evicted');
boundedReplayNow = 11;
assert.equal((await boundedReplayGateway.execute(boundedReplayRequest('bounded-b'))).ok, true, 'expired replay records must release bounded capacity');
assert.equal(boundedDispatches, 2);

const failingAuditGateway = createHarnessGateway({ audit: async () => { throw new Error('ledger down'); }, dispatch: async () => ({ ok: true }), auditKey: '0123456789abcdef0123456789abcdef' });
result = await failingAuditGateway.execute({ plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: 'eiscore_enterprise_snapshot', user });
assert.equal(result.code, 'HARNESS_AUDIT_UNAVAILABLE');

let defaultAuditDispatches = 0;
const missingSink = createHarnessGateway({
  dispatch: async () => { defaultAuditDispatches += 1; },
  auditKey: '0123456789abcdef0123456789abcdef'
});
result = await missingSink.execute({ plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: 'eiscore_enterprise_snapshot', user });
assert.equal(result.code, 'HARNESS_AUDIT_UNAVAILABLE');
assert.equal(defaultAuditDispatches, 0);

const timeoutPlugin = { plugin_id: 'timeout-plugin', agent_id: 'timeout-agent', capabilities: ['timeout-capability'], permissions: [], timeout_ms: 20 };
const timeoutAudits = [];
const timeoutGateway = createHarnessGateway({
  registry: { getById: () => timeoutPlugin, getByAgent: () => timeoutPlugin, resolveCapability: () => timeoutPlugin },
  audit: async (event) => timeoutAudits.push(event),
  dispatch: () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100)),
  auditKey: '0123456789abcdef0123456789abcdef'
});
const timeoutRequest = { plugin_id: 'timeout-plugin', agent_id: 'timeout-agent', capability_id: 'timeout-capability', user, request_id: 'timeout-replay-1' };
result = await timeoutGateway.execute(timeoutRequest);
assert.equal(result.code, 'HARNESS_UPSTREAM_TIMEOUT');
assert.equal(result.status, 504);
assert.equal(timeoutAudits.at(-1).code, 'HARNESS_UPSTREAM_TIMEOUT');
result = await timeoutGateway.execute(timeoutRequest);
assert.equal(result.code, 'HARNESS_REQUEST_REPLAY', 'timed-out request IDs must remain reserved for reconciliation');
assert.equal(result.status, 409);
assert.equal(timeoutAudits.at(-1).code, 'HARNESS_REQUEST_REPLAY');

const cancellationController = new AbortController();
const cancellationAudits = [];
let dispatchSignal;
const cancellationGateway = createHarnessGateway({
  audit: async (event) => cancellationAudits.push(event),
  dispatch: ({ signal }) => {
    dispatchSignal = signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  },
  auditKey: '0123456789abcdef0123456789abcdef'
});
const cancellationResult = cancellationGateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user,
  request_id: 'cancel-replay-1',
  signal: cancellationController.signal
});
await new Promise((resolve) => setImmediate(resolve));
cancellationController.abort();
result = await cancellationResult;
assert.equal(dispatchSignal.aborted, true, 'request cancellation must abort the Harness dispatch signal');
assert.equal(result.code, 'HARNESS_REQUEST_CANCELLED');
assert.equal(result.status, 499);
assert.equal(cancellationAudits.at(-1).code, 'HARNESS_REQUEST_CANCELLED');
result = await cancellationGateway.execute({
  plugin_id: 'enterprise-bi',
  agent_id: 'enterprise_analyst',
  capability_id: 'eiscore_enterprise_snapshot',
  user,
  request_id: 'cancel-replay-1'
});
assert.equal(result.code, 'HARNESS_REQUEST_REPLAY', 'cancelled request IDs must remain reserved for reconciliation');
assert.equal(result.status, 409);
assert.equal(cancellationAudits.at(-1).code, 'HARNESS_REQUEST_REPLAY');

console.log('PASS: Harness gateway auth, capability, confirmation, idempotency and audit boundaries');
})().catch((error) => { console.error(error); process.exitCode = 1; });
