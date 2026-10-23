'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHarnessRuntime } = require('./harness-runtime');

const previousEnv = new Map();
const auditFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eiscore-harness-runtime-')), 'audit.jsonl');
for (const [key, value] of Object.entries({
  EISCORE_HARNESS_ENABLED: 'false',
  EISCORE_HARNESS_URL: '',
  EISCORE_HARNESS_AUDIT_FILE: auditFile,
  EISCORE_HARNESS_AUDIT_HASH_KEY: 'HarnessAudit9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_HARNESS_BRIDGE_SECRET: 'HarnessBridge9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  EISCORE_TOOL_PROXY_SECRET: 'HarnessProxy9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6',
  RUNTIME_PROFILE: 'business'
})) {
  previousEnv.set(key, process.env[key]);
  process.env[key] = value;
}

const user = { id: 'u1', tenant_id: 'tenant-a', token: 'jwt-a', permissions: ['engineering:read', 'site:sales'] };
const postgrestCalls = [];
const flashCalls = [];
const workflowCalls = [];

(async () => {
try {
  const runtime = createHarnessRuntime({
    authorizeHttpRequest: () => user,
    authorizeTwinRequest: () => user,
    readJsonBody: async () => ({}),
    sendJson: () => {},
    setCorsHeaders: () => {},
    streamTextAsSse: () => {},
    executeFlashToolCall: async (...args) => { flashCalls.push(args); return { status: 200, payload: { ok: true, data: {} } }; },
    executeWorkflowToolCall: async (requestUser, payload, request) => {
      workflowCalls.push({ requestUser, payload, request });
      return { message: '流程定义查询成功', data: { items: [] }, rowsAffected: 0 };
    },
    executeEnterpriseSnapshot: async () => ({}),
    executeDigitalTwinContext: async () => ({}),
    executeDigitalTwinChat: async () => ({}),
    executeDocumentPlan: async () => ({ plans: [] }),
    executeSalesWrite: async () => ({}),
    documentEntryWorker: { runPlan: async () => true },
    documentFixedEntryWorker: { runPlan: async () => true },
    createTwinPersistence: () => ({}),
    callPostgrestWithUser: async (requestUser, request) => {
      postgrestCalls.push({ requestUser, request });
      return { data: [{ id: request.path }] };
    },
    fetchSemanticContext: async () => ({ accessPolicy: { roleScoped: true }, fieldAclAvailable: true, permissions: user.permissions })
  });
  assert.equal(runtime.enabled, false);

  const workflow = await runtime.toolGateway.execute({
    request_id: 'runtime-workflow-1',
    plugin_id: 'workflow',
    agent_id: 'workflow_orchestrator',
    capability_id: 'eiscore_workflow_context',
    user: { ...user, permissions: ['workflow:read'] },
    payload: { tool_id: 'flash.workflow.definition.list', arguments: { appId: 'business-app' } }
  });
  assert.equal(workflow.ok, true);
  assert.deepEqual(workflow.data, { items: [] });
  assert.equal(workflowCalls.length, 1, 'Business workflow must use its dedicated semantic executor');
  assert.equal(flashCalls.length, 0, 'Business workflow must not call the Flash tool service');
  assert.equal(workflowCalls[0].payload.tool_id, 'flash.workflow.definition.list');

  const engineering = await runtime.toolGateway.execute({
    request_id: 'runtime-engineering-1',
    plugin_id: 'engineering',
    agent_id: 'engineering',
    capability_id: 'eiscore_engineering_context',
    user,
    payload: { view: 'equipment' }
  });
  assert.equal(engineering.ok, true);
  assert.equal(engineering.data.context, 'engineering');
  assert.equal(engineering.data.view, 'equipment');
  assert.deepEqual(engineering.data.data.assets, [{ id: '/equipment_assets' }]);

  const siteSales = await runtime.toolGateway.execute({
    request_id: 'runtime-site-sales-1',
    plugin_id: 'independent-site-sales',
    agent_id: 'site_sales',
    capability_id: 'eiscore_site_sales',
    user,
    payload: { view: 'catalog' }
  });
  assert.equal(siteSales.ok, true);
  assert.equal(siteSales.data.context, 'site_sales');
  assert.equal(siteSales.data.view, 'catalog');
  assert.deepEqual(siteSales.data.data.products, [{ id: '/products' }]);
  assert.equal(postgrestCalls.length, 4);
  for (const call of postgrestCalls) {
    assert.equal(call.requestUser, user);
    assert.equal(call.request.query.tenant_id, undefined);
    assert.equal(call.request.request, undefined);
  }
  assert.equal(postgrestCalls.at(-1).request.query.site_key, 'eq.primary');
  assert.equal(postgrestCalls.at(-1).request.query.status, 'eq.published');

  process.env.RUNTIME_PROFILE = 'knowledge';
  const previousKnowledgeHarnessUrl = process.env.EISCORE_HARNESS_URL;
  process.env.EISCORE_HARNESS_URL = 'http://harness-bridge:3080';
  const previousFetch = globalThis.fetch;
  const knowledgeBridgeRequests = [];
  const knowledgePersistenceOwners = [];
  globalThis.fetch = async (_url, options) => {
    knowledgeBridgeRequests.push(options);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'knowledge answer' } }] }) };
  };
  try {
    const knowledgeRuntime = createHarnessRuntime({
      authorizeHttpRequest: () => user,
      authorizeTwinRequest: () => user,
      readJsonBody: async () => ({}),
      sendJson: () => {},
      setCorsHeaders: () => {},
      streamTextAsSse: () => {},
      executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } }),
      executeDigitalTwinContext: async (requestUser) => ({ tool_id: 'digital_twin.context.read', result: { namespace: requestUser.harness_namespace } }),
      createTwinPersistence: (requestUser) => {
        knowledgePersistenceOwners.push(requestUser);
        return {
          async createSession() { return '22222222-2222-4222-8222-222222222222'; },
          async getSession() { return { id: '22222222-2222-4222-8222-222222222222' }; },
          async loadHistory() { return []; },
          async saveMessage() {}
        };
      }
    });
    assert.equal(knowledgeRuntime.runtimeProfile, 'knowledge');
    assert.equal(knowledgeRuntime.handlers.handleTwinChat, knowledgeRuntime.handlers.handleKnowledgeTwinChat);

    const knowledgeChat = await knowledgeRuntime.gateway.execute({
      request_id: 'knowledge-profile-chat',
      plugin_id: 'digital-twin',
      agent_id: 'digital_twin',
      capability_id: 'eiscore_twin_chat',
      user: { ...user, permissions: ['twin:read'], harness_namespace: 'business' },
      payload: { message: '问知识库' }
    });
    assert.equal(knowledgeChat.ok, true);
    assert.equal(knowledgePersistenceOwners[0].harness_namespace, 'knowledge', 'knowledge runtime must sign twin persistence as knowledge');
    assert.equal(knowledgeBridgeRequests[0].headers['x-eis-harness-namespace'], 'knowledge', 'knowledge runtime bridge dispatch must not fall into business namespace');

    const forbiddenBusinessCapability = await knowledgeRuntime.gateway.execute({
      request_id: 'knowledge-profile-enterprise-query',
      plugin_id: 'enterprise-bi',
      agent_id: 'enterprise_analyst',
      capability_id: 'eiscore_enterprise_query',
      user: { ...user, permissions: ['enterprise:read'] },
      payload: { dataset: 'sales' }
    });
    assert.equal(forbiddenBusinessCapability.status, 404);
    assert.equal(forbiddenBusinessCapability.code, 'HARNESS_TOOL_UNAVAILABLE');
  } finally {
    process.env.EISCORE_HARNESS_URL = previousKnowledgeHarnessUrl;
    globalThis.fetch = previousFetch;
  }

  process.env.RUNTIME_PROFILE = 'unknown';
  const unknownRuntime = createHarnessRuntime({
    authorizeHttpRequest: () => user,
    authorizeTwinRequest: () => user,
    readJsonBody: async () => ({}),
    sendJson: () => {},
    setCorsHeaders: () => {},
    streamTextAsSse: () => {},
    executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } })
  });
  assert.equal(unknownRuntime.runtimeProfile, 'unknown');
  assert.equal(unknownRuntime.enabled, false, 'unknown runtime profiles must disable Harness');
  const unknownResponses = [];
  const disabledUnknownRuntime = createHarnessRuntime({
    authorizeHttpRequest: () => user,
    authorizeTwinRequest: () => user,
    readJsonBody: async () => ({}),
    sendJson: (_res, status, payload) => unknownResponses.push({ status, payload }),
    setCorsHeaders: () => {},
    streamTextAsSse: () => {},
    executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } })
  });
  await disabledUnknownRuntime.handlers.handleExecute({ body: {} }, {});
  assert.deepEqual(unknownResponses.at(-1), {
    status: 503,
    payload: { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' }
  });
  const unknownCapability = await unknownRuntime.gateway.execute({
    request_id: 'unknown-profile-capability',
    plugin_id: 'enterprise-bi',
    capability_id: 'eiscore_enterprise_snapshot',
    user,
    payload: {}
  });
  assert.deepEqual(unknownCapability, {
    ok: false,
    status: 404,
    code: 'HARNESS_TOOL_UNAVAILABLE',
    message: 'Harness tool capability is not available'
  });
  console.log('PASS: Harness runtime defaults wire engineering and site-sales contexts through user-bound PostgREST');
} finally {
  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(path.dirname(auditFile), { recursive: true, force: true });
}
})().catch((error) => { console.error(error); process.exitCode = 1; });
