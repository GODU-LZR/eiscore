'use strict';

const assert = require('node:assert/strict');
const {
  CONTEXT_SOURCE,
  createKnowledgeOntologyHttpHandlers,
  mapContext
} = require('./knowledge-ontology-http');

const context = {
  source: CONTEXT_SOURCE,
  accessPolicy: { roleScoped: true, roles: ['knowledge_reader'] },
  tables: [{
    table_schema: 'app_data',
    table_name: 'sales_orders',
    semantic_name: '销售订单',
    semantic_description: '订单主表',
    tags: ['sales'],
    access_level: 'read'
  }],
  columns: {
    'app_data.sales_orders': [{ col: 'order_no', name: '订单号', type: 'text', sensitive: false }]
  },
  relations: [{
    id: 'rel-1',
    subject_table: 'app_data.sales_orders',
    object_table: 'app_data.sales_orders',
    predicate: 'ontology:self',
    relation_type: 'ontology'
  }],
  apps: [{ app_id: 'sales_orders', name: '销售订单', app_type: 'data', status: 'published', qualified_table: 'app_data.sales_orders' }],
  files: [{ id: 'file-1', name: '订单说明.md', mime_type: 'text/markdown', updated_at: '2026-10-26T00:00:00Z', size: 12 }]
};

const mapped = mapContext(context);
assert.equal(mapped.nodes.some((item) => item.id === 'table:app_data.sales_orders'), true);
assert.equal(mapped.nodes.some((item) => item.id === 'column:app_data.sales_orders.order_no'), true);
assert.equal(mapped.nodes.some((item) => item.id === 'app:sales_orders'), true);
assert.equal(mapped.edges.some((item) => item.type === 'contains'), true);
assert.equal(mapped.edges.some((item) => item.type === 'app_table'), true);
assert.equal(mapped.files[0].name, '订单说明.md');
assert.equal(mapped.nodes.every((item) => !Object.hasOwn(item, 'token')), true);

const run = async ({ response = context, authorize = () => ({ id: 'u-1', tenant_id: 'tenant-1' }), queryError = null } = {}) => {
  let captured;
  let responsePayload;
  const handlers = createKnowledgeOntologyHttpHandlers({
    authorize,
    bindPgQueryForUser: (user) => async (options) => {
      captured = { user, options };
      if (queryError) throw queryError;
      return { data: response };
    },
    sendJson: (_res, status, payload) => { responsePayload = { status, payload }; },
    log: { warn: () => {} }
  });
  await handlers.handleKnowledgeContext({}, {});
  return { captured, responsePayload };
};

(async () => {
  const success = await run();
  assert.equal(success.responsePayload.status, 200);
  assert.deepEqual(success.responsePayload.payload.meta, { namespace: 'knowledge', profile: 'knowledge', readOnly: true });
  assert.equal(success.captured.user.harness_namespace, 'knowledge');
  assert.deepEqual(success.captured.options.body, { p_query: '', p_limit: 200 });
  assert.equal(success.captured.options.path, '/rpc/agent_ontology_context');
  assert.equal(success.captured.options.acceptProfile, 'public');
  assert.equal(success.captured.options.contentProfile, 'public');

  const denied = await run({ response: { source: CONTEXT_SOURCE, accessPolicy: { roleScoped: false } } });
  assert.deepEqual(denied.responsePayload, {
    status: 403,
    payload: { code: 'KNOWLEDGE_ONTOLOGY_SCOPE_REQUIRED', message: 'Knowledge ontology scope is unavailable' }
  });

  const unavailable = await run({ queryError: new Error('sensitive upstream details') });
  assert.deepEqual(unavailable.responsePayload, {
    status: 503,
    payload: { code: 'KNOWLEDGE_ONTOLOGY_UNAVAILABLE', message: 'Knowledge ontology is temporarily unavailable' }
  });

  let unauthorizedCalled = false;
  const unauthorized = await run({ authorize: (_req, _res) => { unauthorizedCalled = true; return null; } });
  assert.equal(unauthorizedCalled, true);
  assert.equal(unauthorized.captured, undefined);
  assert.equal(unauthorized.responsePayload, undefined);
  console.log('knowledge ontology HTTP contract regression: ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
