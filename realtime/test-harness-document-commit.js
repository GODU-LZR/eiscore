'use strict';

const assert = require('node:assert/strict');
const { createHarnessDocumentCommitExecutor } = require('./harness-document-commit');

const PLAN_ID = '11111111-1111-4111-8111-111111111111';
const VERSION = '2026-09-26T00:00:00.000Z';
const IDEMPOTENCY_KEY = 'document-commit-012345';
const user = { id: 'u1', username: 'operator', tenant_id: 't1', token: 'jwt' };
const calls = [];
let plan = { id: PLAN_ID, status: 'planned', target_kind: 'data_app', target_schema: 'app_data', target_table: 'orders', metadata: {}, updated_at: VERSION };
let processed = 0;
const postgrest = async (_user, options) => {
  calls.push(options);
  if (options.method === 'PATCH') {
    plan = { ...plan, metadata: options.body.metadata };
    return { data: [plan] };
  }
  return { data: [plan] };
};
const executor = createHarnessDocumentCommitExecutor({
  callPostgrestWithUser: postgrest,
  documentEntryWorker: { async runPlan(id) { assert.equal(id, PLAN_ID); processed += 1; plan = { ...plan, status: 'committed' }; return true; } },
  documentFixedEntryWorker: { async runPlan() { throw new Error('wrong worker'); } }
});

(async () => {
  await assert.rejects(() => executor(user, {}), (error) => error.code === 'HARNESS_PLAN_ID_REQUIRED');
  await assert.rejects(() => executor(user, { plan_id: PLAN_ID }), (error) => error.code === 'HARNESS_PLAN_VERSION_REQUIRED');
  await assert.rejects(() => executor(user, { plan_id: PLAN_ID, plan_version: 'stale' }, { idempotency_key: IDEMPOTENCY_KEY }), (error) => error.code === 'HARNESS_PLAN_VERSION_MISMATCH');
  await assert.rejects(() => executor(user, { plan_id: PLAN_ID, plan_version: VERSION }), (error) => error.code === 'HARNESS_IDEMPOTENCY_REQUIRED');
  await assert.rejects(() => executor(user, { plan_id: PLAN_ID, plan_version: VERSION, idempotency_key: IDEMPOTENCY_KEY }), (error) => error.code === 'HARNESS_IDEMPOTENCY_REQUIRED');
  await assert.rejects(() => executor(user, { arguments: { plan_id: PLAN_ID, plan_version: VERSION } }, { idempotency_key: IDEMPOTENCY_KEY }), (error) => error.code === 'HARNESS_PLAN_ID_REQUIRED');
  calls.length = 0;

  const result = await executor(user, { plan_id: PLAN_ID, plan_version: VERSION }, { idempotency_key: IDEMPOTENCY_KEY });
  assert.equal(result.plan.id, PLAN_ID);
  assert.equal(result.processed, true);
  assert.equal(processed, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[1].method, 'PATCH');
  assert.equal(calls[1].body.metadata.harness_confirmation.source, 'deepseek_harness');
  assert.equal(calls[1].body.sql, undefined);
  assert.equal(calls[1].query.status, 'eq.planned');

  const replay = await executor(user, { plan_id: PLAN_ID, plan_version: VERSION }, { idempotency_key: IDEMPOTENCY_KEY });
  assert.equal(replay.idempotent_replay, true);
  assert.equal(processed, 1, 'same document idempotency key must not run the worker twice');
  await assert.rejects(() => executor(user, { plan_id: PLAN_ID, plan_version: VERSION }, { idempotency_key: 'document-commit-other' }), (error) => error.code === 'HARNESS_PLAN_NOT_PLANNED');

  let queuedWorkerCalls = 0;
  plan = { id: PLAN_ID, status: 'planned', target_kind: 'data_app', target_schema: 'app_data', target_table: 'orders', metadata: {}, updated_at: VERSION };
  const queuedExecutor = createHarnessDocumentCommitExecutor({
    callPostgrestWithUser: postgrest,
    documentEntryWorker: { async runPlan() { queuedWorkerCalls += 1; return false; } },
    documentFixedEntryWorker: { async runPlan() { throw new Error('wrong worker'); } }
  });
  const queued = await queuedExecutor(user, { plan_id: PLAN_ID, plan_version: VERSION }, { idempotency_key: IDEMPOTENCY_KEY });
  assert.equal(queued.processed, false);
  assert.equal(queued.queued, true);
  assert.equal(queuedWorkerCalls, 1);
  const queuedReplay = await queuedExecutor(user, { plan_id: PLAN_ID, plan_version: VERSION }, { idempotency_key: IDEMPOTENCY_KEY });
  assert.equal(queuedReplay.idempotent_replay, true);
  assert.equal(queuedReplay.queued, true);
  assert.equal(queuedWorkerCalls, 1, 'queued idempotency replay must not execute the worker twice');
  await assert.rejects(() => queuedExecutor(user, { plan_id: PLAN_ID, plan_version: VERSION }, { idempotency_key: 'document-commit-other' }), (error) => error.code === 'HARNESS_PLAN_COMMIT_CONFLICT');

  plan = { id: PLAN_ID, status: 'planned', target_kind: 'fixed_module_table', target_module: 'other', target_document_type: '采购入库单', metadata: {}, updated_at: VERSION };
  await assert.rejects(() => executor(user, { plan_id: PLAN_ID, plan_version: VERSION }, { idempotency_key: IDEMPOTENCY_KEY }), (error) => error.code === 'HARNESS_PLAN_TARGET_UNSUPPORTED');
  console.log('PASS: Harness document commit accepts only versioned server plans and fixed workers');
})().catch((error) => { console.error(error); process.exitCode = 1; });
