'use strict';

const assert = require('node:assert/strict');
const { createHarnessSalesWriteExecutor } = require('./harness-sales-write');

const ID = '11111111-1111-4111-8111-111111111111';
const user = { id: 'u1', tenant_id: 't1', permissions: ['sales:write'] };
const calls = [];
const handlers = Object.fromEntries([
  ['handleQualifyLead', 'qualify'],
  ['handleCreateOpportunityDraft', 'opportunity'],
  ['handleCreateQuoteDraft', 'quote'],
  ['handleCreateSalesOrderDraft', 'order'],
  ['handleCreateProductionDraft', 'production'],
  ['handleApproveDraft', 'approval'],
  ['handleSyncApprovedDraft', 'sync']
].map(([name, operation]) => [name, async (req, res, ...args) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk.toString(); });
  req.on('end', () => {});
  calls.push([operation, args, JSON.parse(raw || '{}')]);
  res.writeHead(200);
  res.end(JSON.stringify({ ok: true, operation }));
}]));

(async () => {
  const executor = createHarnessSalesWriteExecutor({ getHandlers: () => handlers });
  await assert.rejects(() => executor(user, { operation: 'drop_table', table: 'public.users' }, { idempotency_key: '0123456789abcdef' }), (error) => error.code === 'HARNESS_SALES_OPERATION_INVALID');
  await assert.rejects(() => executor(user, { operation: 'opportunity_draft_create', lead_id: ID }), (error) => error.code === 'HARNESS_IDEMPOTENCY_REQUIRED');
  await assert.rejects(() => executor(user, { operation: 'opportunity_draft_create', lead_id: ID, idempotency_key: '0123456789abcdef' }), (error) => error.code === 'HARNESS_IDEMPOTENCY_REQUIRED');
  await assert.rejects(() => executor(user, { arguments: { operation: 'opportunity_draft_create', lead_id: ID } }, { idempotency_key: '0123456789abcdef' }), (error) => error.code === 'HARNESS_SALES_OPERATION_INVALID');
  await assert.rejects(() => executor(user, { operation: 'opportunity_draft_create', lead_id: ID }, { idempotency_key: 'short' }), (error) => error.code === 'HARNESS_IDEMPOTENCY_REQUIRED');
  await assert.rejects(() => executor(user, { operation: 'sales_approval', object_type: 'quote', object_id: 'not-uuid' }, { idempotency_key: '0123456789abcdef' }), (error) => error.code === 'HARNESS_SALES_RESOURCE_ID_INVALID');

  const result = await executor(user, { operation: 'opportunity_draft_create', lead_id: ID, sql: 'drop table' }, { idempotency_key: '0123456789abcdef' });
  assert.deepEqual(result, { ok: true, operation: 'opportunity' });
  assert.equal(calls[0][0], 'opportunity');
  assert.equal(calls[0][1][0], ID);
  assert.equal(calls[0][1][1], user);
  assert.equal(calls[0][2].idempotencyKey, '0123456789abcdef');
  assert.equal(calls[0][2].sql, undefined);

  await executor(user, { operation: 'sales_approval', object_type: 'quote', object_id: ID, decision: 'approve' }, { idempotency_key: '0123456789abcdef' });
  assert.equal(calls[1][0], 'approval');
  assert.equal(calls[1][1][0], 'quote');
  await executor(user, { operation: 'sales_sync_enqueue', object_type: 'production', object_id: ID }, { confirmed: true, idempotency_key: '0123456789abcdef' });
  assert.equal(calls[2][0], 'sync');
  assert.equal(calls[2][2].confirm, true);
  await executor(user, { operation: 'sales_sync_enqueue', object_type: 'production', object_id: ID, confirm: true }, { confirmed: false, idempotency_key: 'fedcba9876543210' });
  assert.equal(calls[3][2].confirm, false);
  console.log('PASS: Harness sales writes use fixed operations and existing business handlers');
})().catch((error) => { console.error(error); process.exitCode = 1; });
