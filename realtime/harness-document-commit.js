'use strict';

const crypto = require('node:crypto');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[\s\S]{16,128}$/;

const idempotencyHash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const fail = (code, message, httpStatus = 400) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  throw error;
};

const createHarnessDocumentCommitExecutor = ({ callPostgrestWithUser, documentEntryWorker, documentFixedEntryWorker } = {}) => {
  if (typeof callPostgrestWithUser !== 'function') throw new TypeError('Document commit PostgREST adapter is required');
  if (!documentEntryWorker || typeof documentEntryWorker.runPlan !== 'function') throw new TypeError('Document entry worker is required');
  if (!documentFixedEntryWorker || typeof documentFixedEntryWorker.runPlan !== 'function') throw new TypeError('Fixed document entry worker is required');

  return async (user, payload = {}, request = {}) => {
    const input = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const planId = String(input.plan_id || input.planId || '').trim();
    const planVersion = String(input.plan_version || input.planVersion || '').trim();
    const idempotencyKey = String(request.idempotency_key || request.idempotencyKey || '').trim();
    if (!planId) fail('HARNESS_PLAN_ID_REQUIRED', 'plan_id is required');
    if (!UUID_RE.test(planId)) fail('HARNESS_PLAN_ID_INVALID', 'plan_id must be a UUID');
    if (!planVersion) fail('HARNESS_PLAN_VERSION_REQUIRED', 'plan_version is required');

    const result = await callPostgrestWithUser(user, {
      method: 'GET',
      path: '/document_entry_plans',
      query: {
        id: `eq.${planId}`,
        select: 'id,status,target_kind,target_module,target_document_type,target_schema,target_table,metadata,updated_at',
        limit: '1'
      },
      acceptProfile: 'public',
      traceId: request.request_id || request.requestId,
      timeoutMs: 8000
    });
    const plan = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (!plan) fail('HARNESS_PLAN_NOT_FOUND', 'Document plan is not available', 404);
    if (!IDEMPOTENCY_RE.test(idempotencyKey)) fail('HARNESS_IDEMPOTENCY_REQUIRED', 'A 16-128 character idempotency key is required', 409);
    const metadata = plan.metadata && typeof plan.metadata === 'object' && !Array.isArray(plan.metadata) ? plan.metadata : {};
    const confirmation = metadata.harness_confirmation && typeof metadata.harness_confirmation === 'object' && !Array.isArray(metadata.harness_confirmation)
      ? metadata.harness_confirmation
      : null;
    const requestIdempotencyHash = idempotencyHash(idempotencyKey);
    if (confirmation?.idempotency_hash && confirmation.idempotency_hash !== requestIdempotencyHash) {
      if (plan.status === 'planned' || plan.status === 'importing') {
        fail('HARNESS_PLAN_COMMIT_CONFLICT', 'Document plan is already claimed by another operation', 409);
      }
      fail('HARNESS_PLAN_NOT_PLANNED', 'Document plan is not awaiting commit', 409);
    }
    if (confirmation?.idempotency_hash === requestIdempotencyHash) {
      if (confirmation.plan_version !== planVersion) fail('HARNESS_PLAN_VERSION_MISMATCH', 'Document plan version has changed', 409);
      const queued = plan.status === 'planned' || plan.status === 'importing';
      return { plan, processed: !queued, queued, idempotent_replay: true };
    } else if (String(plan.updated_at || '') !== planVersion) {
      fail('HARNESS_PLAN_VERSION_MISMATCH', 'Document plan version has changed', 409);
    }
    if (plan.status !== 'planned') fail('HARNESS_PLAN_NOT_PLANNED', 'Document plan is not awaiting commit', 409);

    const isDataApp = plan.target_kind === 'data_app' && plan.target_schema === 'app_data' && /^[a-z][a-z0-9_]{0,62}$/.test(String(plan.target_table || ''));
    const isFixedStockIn = plan.target_kind === 'fixed_module_table'
      && plan.target_module === 'materials'
      && plan.target_document_type === '采购入库单';
    if (!isDataApp && !isFixedStockIn) fail('HARNESS_PLAN_TARGET_UNSUPPORTED', 'Document plan target is not supported', 409);

    let confirmedPlan = plan;
    if (confirmation?.idempotency_hash !== requestIdempotencyHash) {
      const harnessConfirmation = {
        source: 'deepseek_harness',
        confirmed_by: String(user?.id || user?.username || '').slice(0, 160),
        confirmed_at: new Date().toISOString(),
        plan_version: planVersion,
        idempotency_hash: requestIdempotencyHash
      };
      const update = await callPostgrestWithUser(user, {
        method: 'PATCH',
        path: '/document_entry_plans',
        query: { id: `eq.${planId}`, status: 'eq.planned', updated_at: `eq.${planVersion}` },
        body: { metadata: { ...metadata, harness_confirmation: harnessConfirmation } },
        acceptProfile: 'public',
        contentProfile: 'public',
        prefer: 'return=representation',
        traceId: request.request_id || request.requestId,
        timeoutMs: 8000
      });
      confirmedPlan = Array.isArray(update?.data) ? update.data[0] : update?.data;
      if (!confirmedPlan) fail('HARNESS_PLAN_COMMIT_CONFLICT', 'Document plan could not be confirmed', 409);
    }

    const worker = isFixedStockIn ? documentFixedEntryWorker : documentEntryWorker;
    const processed = await worker.runPlan(planId);
    const finalResult = await callPostgrestWithUser(user, {
      method: 'GET',
      path: '/document_entry_plans',
      query: { id: `eq.${planId}`, select: 'id,status,target_kind,target_module,target_document_type,target_schema,target_table,metadata,updated_at', limit: '1' },
      acceptProfile: 'public',
      traceId: request.request_id || request.requestId,
      timeoutMs: 8000
    });
    const finalPlan = Array.isArray(finalResult?.data) ? finalResult.data[0] : finalResult?.data;
    return { plan: finalPlan || confirmedPlan, processed: processed === true, queued: processed !== true };
  };
};

module.exports = { UUID_RE, createHarnessDocumentCommitExecutor };
