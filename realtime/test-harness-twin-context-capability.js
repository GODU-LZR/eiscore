'use strict';

const assert = require('node:assert/strict');
const { loadPluginRegistry } = require('../agent-harness/plugin-registry');
const { createHarnessGateway } = require('./harness-gateway');
const { createHarnessToolGateway } = require('./harness-tool-gateway');
const { createTwinTools } = require('./twin-tools');
const { createHarnessTwinContextExecutor } = require('./harness-twin-context-capability');

(async () => {
  const calls = [];
  const ownerBindings = [];
  const user = { id: 'u1', username: 'operator', tenant_id: 'tenant-a', token: 'jwt-a', permissions: ['twin:read'] };
  const knowledgeRows = [{ id: 'file-1', file_name: 'costs.csv', file_type: 'text/csv', file_size: 24, tags: [], summary: 'costs', content_text: 'material,amount\nsteel,42', created_at: '2026-01-01', updated_at: '2026-01-02' }];
  const executeTwinContext = createHarnessTwinContextExecutor({
    fetchSemanticContext: async () => ({ accessPolicy: { roleScoped: true }, permissions: [], fieldAcl: {}, fieldAclAvailable: true }),
    createTools: createTwinTools,
    queryForUser: (owner) => {
      ownerBindings.push(owner);
      return async (request) => {
        calls.push({ owner, request });
        return { data: knowledgeRows };
      };
    }
  });
  const toolGateway = createHarnessToolGateway({
    executeDigitalTwinContext: executeTwinContext,
    executeFlashToolCall: async () => ({ status: 200, payload: { ok: true, data: {} } })
  });
  const gateway = createHarnessGateway({
    registry: loadPluginRegistry(),
    audit: async () => {},
    auditKey: '0123456789abcdef0123456789abcdef',
    dispatch: toolGateway.execute
  });
  const execute = (tool_id, args = {}) => gateway.execute({
    plugin_id: 'digital-twin', agent_id: 'digital_twin', capability_id: 'eiscore_twin_context',
    user, payload: { tool_id, arguments: args }
  });

  const searched = await execute('search_knowledge', { query: 'costs' });
  assert.equal(searched.ok, true);
  assert.equal(searched.data.tool_id, 'search_knowledge');
  assert.equal(searched.data.result[0].id, 'file-1');
  assert.equal(calls.at(-1).request.path, '/twin_knowledge_files');
  assert.equal(calls.at(-1).request.acceptProfile, 'app_data');
  assert.equal(calls.at(-1).request.query.employee_id, 'eq.operator');

  const listed = await execute('list_knowledge');
  assert.equal(listed.ok, true);
  assert.equal(listed.data.tool_id, 'list_knowledge');
  assert.equal(Array.isArray(listed.data.result), true);
  assert.equal(calls.at(-1).request.query.employee_id, 'eq.operator');

  const read = await execute('read_knowledge_file', { id: 'file-1' });
  assert.equal(read.ok, true);
  assert.equal(read.data.tool_id, 'read_knowledge_file');
  assert.equal(read.data.result.content.includes('steel,42'), true);
  assert.equal(calls.at(-1).request.query.employee_id, 'eq.operator');
  assert.equal(ownerBindings.every((owner) => owner === user), true, 'each query must be bound to the authenticated user');

  const unknown = await execute('arbitrary_tool');
  assert.equal(unknown.code, 'HARNESS_TOOL_UNAVAILABLE');
  assert.equal(unknown.status, 404);

  const hidden = await execute('query_inventory');
  assert.equal(hidden.code, 'HARNESS_PERMISSION_DENIED');
  assert.equal(hidden.status, 403);
  assert.equal(calls.length, 3, 'unknown or ACL-hidden tools must not query PostgREST');

  console.log('PASS: Harness digital twin exposes per-user knowledge tools with object output and permission failures');
})().catch((error) => { console.error(error); process.exitCode = 1; });
