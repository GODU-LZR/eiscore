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
  EISCORE_TOOL_PROXY_SECRET: 'HarnessProxy9_Vt8Yp2Kx7Mq5Rw9Nc3Hz6'
})) {
  previousEnv.set(key, process.env[key]);
  process.env[key] = value;
}

const user = { id: 'u1', tenant_id: 'tenant-a', token: 'jwt-a', permissions: ['engineering:read', 'site:sales'] };
const postgrestCalls = [];

(async () => {
try {
  const runtime = createHarnessRuntime({
    authorizeHttpRequest: () => user,
    authorizeTwinRequest: () => user,
    readJsonBody: async () => ({}),
    sendJson: () => {},
    setCorsHeaders: () => {},
    streamTextAsSse: () => {},
    executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } }),
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
  console.log('PASS: Harness runtime defaults wire engineering and site-sales contexts through user-bound PostgREST');
} finally {
  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(path.dirname(auditFile), { recursive: true, force: true });
}
})().catch((error) => { console.error(error); process.exitCode = 1; });
