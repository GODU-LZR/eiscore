'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[\s\S]{16,128}$/;
const OPERATIONS = Object.freeze([
  'qualify_lead',
  'opportunity_draft_create',
  'quote_draft_create',
  'sales_order_draft_create',
  'production_draft_create',
  'sales_approval',
  'sales_sync_enqueue'
]);

const fail = (code, message, httpStatus = 400) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  throw error;
};

const invoke = async (handler, body, args) => {
  let response = null;
  const req = {
    url: '/harness/sales-write',
    headers: { host: 'harness.internal' },
    socket: { remoteAddress: 'harness' },
    on(event, callback) {
      if (event === 'data') callback(Buffer.from(JSON.stringify(body)));
      if (event === 'end') callback();
      return this;
    }
  };
  const res = {
    setHeader() {},
    writeHead(status) { this.status = status; },
    end(raw) {
      try { response = { status: this.status || 200, payload: raw ? JSON.parse(raw) : {} }; }
      catch { response = { status: this.status || 200, payload: {} }; }
    }
  };
  await handler(req, res, ...args);
  if (!response) fail('HARNESS_SALES_WRITE_FAILED', 'Sales write did not return a result', 502);
  if (response.status >= 400) fail(String(response.payload?.code || 'HARNESS_SALES_WRITE_FAILED'), String(response.payload?.message || 'Sales write was rejected'), response.status);
  return response.payload;
};

const createHarnessSalesWriteExecutor = ({ getHandlers } = {}) => {
  if (typeof getHandlers !== 'function') throw new TypeError('Sales handler provider is required');
  return async (user, payload = {}, request = {}) => {
    const input = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const operation = String(input.operation || input.action || '').trim();
    if (!OPERATIONS.includes(operation)) fail('HARNESS_SALES_OPERATION_INVALID', 'Sales write operation is not allowed');
    const idempotencyKey = String(request.idempotency_key || request.idempotencyKey || '').trim();
    if (!IDEMPOTENCY_RE.test(idempotencyKey)) fail('HARNESS_IDEMPOTENCY_REQUIRED', 'A 16-128 character idempotency key is required', 409);
    const handlers = getHandlers();
    if (!handlers) fail('HARNESS_TOOL_UNAVAILABLE', 'Harness sales write tool is unavailable', 404);
    const body = { ...input, idempotencyKey };
    delete body.operation;
    delete body.action;
    delete body.table;
    delete body.table_name;
    delete body.schema;
    delete body.sql;
    delete body.arguments;
    if (operation === 'sales_sync_enqueue') body.confirm = request.confirmed === true;
    const resourceId = String(input.lead_id || input.leadId || input.opportunity_id || input.opportunityId || input.quote_id || input.quoteId || input.sales_order_id || input.salesOrderId || input.object_id || input.objectId || '').trim();
    if (!UUID_RE.test(resourceId)) fail('HARNESS_SALES_RESOURCE_ID_INVALID', 'Sales resource id must be a UUID');
    const actor = user || {};
    switch (operation) {
      case 'qualify_lead':
        return invoke(handlers.handleQualifyLead, body, [resourceId, actor]);
      case 'opportunity_draft_create':
        return invoke(handlers.handleCreateOpportunityDraft, body, [resourceId, actor]);
      case 'quote_draft_create':
        return invoke(handlers.handleCreateQuoteDraft, body, [resourceId, actor]);
      case 'sales_order_draft_create':
        return invoke(handlers.handleCreateSalesOrderDraft, body, [resourceId, actor]);
      case 'production_draft_create':
        return invoke(handlers.handleCreateProductionDraft, body, [resourceId, actor]);
      case 'sales_approval': {
        const objectType = String(input.object_type || input.objectType || '').trim();
        if (!['opportunity', 'quote', 'sales_order', 'production'].includes(objectType)) fail('HARNESS_SALES_OBJECT_TYPE_INVALID', 'Sales approval object type is not allowed');
        return invoke(handlers.handleApproveDraft, body, [objectType, resourceId, actor]);
      }
      case 'sales_sync_enqueue': {
        const objectType = String(input.object_type || input.objectType || '').trim();
        if (!['opportunity', 'quote', 'sales_order', 'production'].includes(objectType)) fail('HARNESS_SALES_OBJECT_TYPE_INVALID', 'Sales sync object type is not allowed');
        return invoke(handlers.handleSyncApprovedDraft, body, [objectType, resourceId, actor]);
      }
      default:
        fail('HARNESS_SALES_OPERATION_INVALID', 'Sales write operation is not allowed');
    }
  };
};

module.exports = { OPERATIONS, UUID_RE, createHarnessSalesWriteExecutor };
