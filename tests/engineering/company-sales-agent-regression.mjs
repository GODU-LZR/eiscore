import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCompanySalesHandlers } = require('../../realtime/company-sales-agent.js');

const response = () => ({
  statusCode: 0,
  payload: null,
  headers: {},
  writeHead(status, headers) { this.statusCode = status; this.headers = headers || {}; },
  end(payload) { this.payload = payload; }
});

const request = (body = {}, url = '/') => ({
  url,
  body,
  headers: { host: 'junleyuan.eissys.top' }
});

const readPayload = (res) => JSON.parse(String(res.payload || '{}'));

const createHarness = (query, options = {}) => {
  const calls = [];
  const handler = createCompanySalesHandlers({
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params });
      return query(String(sql), params, calls);
    },
    sendJson: (res, status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    },
    readJsonBody: async (req) => req.body || {},
    answerWithAi: options.answerWithAi,
    now: () => new Date('2026-08-12T12:00:00.000Z')
  });
  return { handler, calls };
};

const site = { site_key: 'primary', domain: 'junleyuan.eissys.top', default_locale: 'zh-CN', enabled_locales: ['zh-CN'], status: 'published' };
const session = { id: '11111111-1111-4111-8111-111111111111', locale: 'zh-CN', status: 'open', consent_at: '2026-08-12T12:00:00.000Z' };

async function testSessionAndKnowledgeAnswer() {
  const { handler, calls } = createHarness((sql) => {
    if (sql.includes('FROM company_site.site_config')) return { rows: [site] };
    if (sql.includes('INSERT INTO company_site.agent_sessions')) return { rows: [session] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected session query: ${sql}`);
  });
  const sessionRes = response();
  await handler.handleCreateSession(request({ locale: 'zh-CN', consent: { accepted: true }, visitorId: 'visitor-1' }), sessionRes);
  assert.equal(sessionRes.statusCode, 201);
  assert.equal(readPayload(sessionRes).session.consentRequired, false);

  const messageHarness = createHarness((sql) => {
    if (sql.includes('FROM company_site.agent_sessions')) return { rows: [session] };
    if (sql.includes('FROM company_site.knowledge_documents')) return {
      rows: [{ id: 'doc-1', title: '采购数量', content: '采购数量和交期需要人工确认。', version: 2, updated_at: '2026-08-12T00:00:00.000Z' }]
    };
    if (sql.includes('INSERT INTO company_site.agent_messages')) return { rows: [] };
    if (sql.includes('UPDATE company_site.agent_sessions')) return { rows: [] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected message query: ${sql}`);
  });
  const messageRes = response();
  await messageHarness.handler.handleSendMessage(request({ message: '采购数量和交期怎么确认？' }), messageRes, session.id);
  assert.equal(messageRes.statusCode, 200);
  const message = readPayload(messageRes);
  assert.equal(message.needsHuman, false);
  assert.equal(message.citations[0].id, 'doc-1');
  assert.equal(messageHarness.calls.filter((call) => call.sql.includes('INSERT INTO company_site.agent_messages')).length, 1);

  const aiHarness = createHarness((sql) => {
    if (sql.includes('FROM company_site.agent_sessions')) return { rows: [session] };
    if (sql.includes('FROM company_site.knowledge_documents')) return {
      rows: [{ id: 'doc-1', title: '采购数量', content: '采购数量和交期需要人工确认。', version: 2, updated_at: '2026-08-12T00:00:00.000Z' }]
    };
    if (sql.includes('INSERT INTO company_site.agent_messages')) return { rows: [] };
    if (sql.includes('UPDATE company_site.agent_sessions')) return { rows: [] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected AI message query: ${sql}`);
  }, {
    answerWithAi: async ({ knowledge, message }) => {
      assert.equal(knowledge[0].id, 'doc-1');
      assert.equal(message, '采购数量和交期怎么确认？');
      return { answer: 'AI 已依据审核知识回答。', needsHuman: false, model: 'deepseek-v4-flash' };
    }
  });
  const aiRes = response();
  await aiHarness.handler.handleSendMessage(request({ message: '采购数量和交期怎么确认？' }), aiRes, session.id);
  assert.equal(aiRes.statusCode, 200);
  assert.equal(readPayload(aiRes).answer, 'AI 已依据审核知识回答。');
}

async function testConsentAndLeadIdempotency() {
  const noConsentSession = { ...session, consent_at: null };
  const consentHarness = createHarness((sql) => sql.includes('FROM company_site.agent_sessions') ? { rows: [noConsentSession] } : { rows: [] });
  const consentRes = response();
  await consentHarness.handler.handleSendMessage(request({ message: '你好' }), consentRes, session.id);
  assert.equal(consentRes.statusCode, 400);
  assert.equal(readPayload(consentRes).code, 'CONSENT_REQUIRED');

  const { handler, calls } = createHarness((sql) => {
    if (sql.includes('FROM company_site.agent_sessions')) return { rows: [session] };
    if (sql.includes('SELECT id, public_ref, status FROM company_site.leads')) return { rows: [{ id: 'lead-1', public_ref: 'INQ-OLD', status: 'new' }] };
    throw new Error(`duplicate lead must stop before insert: ${sql}`);
  });
  const leadRes = response();
  await handler.handleCreateLead(request({ idempotencyKey: 'lead-1', companyName: '采购方', contactName: '联系人', email: 'buyer@example.test' }), leadRes, session.id);
  assert.equal(leadRes.statusCode, 200);
  assert.equal(readPayload(leadRes).deduplicated, true);
  assert.equal(calls.filter((call) => call.sql.includes('INSERT INTO company_site.leads')).length, 0);
}

async function testLeadQualificationAndOpportunityDraft() {
  const lead = { id: 'lead-1', public_ref: 'INQ-1', status: 'new', qualification: {} };
  const qualification = createHarness((sql) => {
    if (sql.includes('SELECT id, public_ref, source')) return { rows: [lead] };
    if (sql.includes('UPDATE company_site.leads')) return { rows: [{ id: 'lead-1', public_ref: 'INQ-1', status: 'qualified', qualification: { score: 80 } }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected qualification query: ${sql}`);
  });
  const qualifyRes = response();
  await qualification.handler.handleQualifyLead(request({ score: 80, reasons: ['数量明确'] }), qualifyRes, 'lead-1', { id: 'sales-1' });
  assert.equal(qualifyRes.statusCode, 200);
  assert.equal(readPayload(qualifyRes).lead.status, 'qualified');

  const opportunity = createHarness((sql) => {
    if (sql.includes('SELECT id FROM company_site.leads')) return { rows: [lead] };
    if (sql.includes('SELECT id, approval_status FROM company_site.opportunity_drafts')) return { rows: [] };
    if (sql.includes('INSERT INTO company_site.opportunity_drafts')) return { rows: [{ id: 'opp-1', lead_id: 'lead-1', approval_status: 'draft', idempotency_key: 'opp-1' }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected opportunity query: ${sql}`);
  });
  const opportunityRes = response();
  await opportunity.handler.handleCreateOpportunityDraft(request({ idempotencyKey: 'opp-1', productItems: [{ slug: 'billiard-cues', quantity: '10' }] }), opportunityRes, 'lead-1', { id: 'sales-1' });
  assert.equal(opportunityRes.statusCode, 201);
  assert.equal(readPayload(opportunityRes).opportunity.approval_status, 'draft');
}

async function testQuoteOrderAndProductionDraftGates() {
  const quote = createHarness((sql) => {
    if (sql.includes('FROM company_site.opportunity_drafts')) return { rows: [{ id: 'opp-1', approval_status: 'approved' }] };
    if (sql.includes('FROM company_site.quote_drafts')) return { rows: [] };
    if (sql.includes('INSERT INTO company_site.quote_drafts')) return { rows: [{ id: 'quote-1', opportunity_id: 'opp-1', approval_status: 'draft', idempotency_key: 'quote-1' }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected quote query: ${sql}`);
  });
  const quoteRes = response();
  await quote.handler.handleCreateQuoteDraft(request({ idempotencyKey: 'quote-1', items: [{ slug: 'billiard-cues', quantity: 10 }] }), quoteRes, 'opp-1', { id: 'sales-1' });
  assert.equal(quoteRes.statusCode, 201);
  assert.equal(readPayload(quoteRes).quote.approval_status, 'draft');

  const order = createHarness((sql) => {
    if (sql.includes('FROM company_site.quote_drafts')) return { rows: [{ id: 'quote-1', approval_status: 'approved', items: [{ materialId: 7, productMaterialId: 8 }] }] };
    if (sql.includes('FROM company_site.sales_order_drafts')) return { rows: [] };
    if (sql.includes('FROM scm.v_inventory_current')) return { rows: [{ material_id: 7, available_qty: 10, last_transaction_at: '2026-08-12T00:00:00.000Z' }] };
    if (sql.includes('FROM scm.boms')) return { rows: [{ id: 'bom-1', parent_material_id: 8, status: '启用' }] };
    if (sql.includes('FROM scm.production_work_orders')) return { rows: [{ product_material_id: 8, product_material_code: 'FG-8', open_planned_qty: 4, open_work_order_count: 1 }] };
    if (sql.includes('INSERT INTO company_site.sales_order_drafts')) return { rows: [{ id: 'order-1', quote_id: 'quote-1', approval_status: 'draft', inventory_check: { status: 'available' }, bom_check: { status: 'available' } }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected order query: ${sql}`);
  });
  const orderRes = response();
  await order.handler.handleCreateSalesOrderDraft(request({ idempotencyKey: 'order-1' }), orderRes, 'quote-1', { id: 'sales-1' });
  assert.equal(orderRes.statusCode, 201);
  assert.equal(readPayload(orderRes).salesOrder.approval_status, 'draft');
  const orderInsert = order.calls.find((call) => call.sql.includes('INSERT INTO company_site.sales_order_drafts'));
  assert.equal(JSON.parse(orderInsert.params[6]).status, 'advisory');

  const production = createHarness((sql) => {
    if (sql.includes('FROM company_site.sales_order_drafts')) return { rows: [{ id: 'order-1', approval_status: 'approved', items: [] }] };
    if (sql.includes('FROM company_site.production_work_order_drafts')) return { rows: [] };
    if (sql.includes('INSERT INTO company_site.production_work_order_drafts')) return { rows: [{ id: 'production-1', sales_order_id: 'order-1', approval_status: 'draft' }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected production query: ${sql}`);
  });
  const productionRes = response();
  await production.handler.handleCreateProductionDraft(request({ idempotencyKey: 'production-1' }), productionRes, 'order-1', { id: 'planner-1' });
  assert.equal(productionRes.statusCode, 201);
  assert.equal(readPayload(productionRes).production.approval_status, 'draft');

  const approval = createHarness((sql) => {
    if (sql.includes('UPDATE company_site.quote_drafts')) return { rows: [{ id: 'quote-1', approval_status: 'approved', updated_by: 'manager-1' }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected approval query: ${sql}`);
  });
  const approvalRes = response();
  await approval.handler.handleApproveDraft(request({ decision: 'approve', comment: '价格与条款已核对' }), approvalRes, 'quote', 'quote-1', { id: 'manager-1' });
  assert.equal(approvalRes.statusCode, 200);
  assert.equal(readPayload(approvalRes).item.approval_status, 'approved');
}

async function testApprovedDraftSyncQueueAndOpportunityAdapter() {
  const queue = createHarness((sql) => {
    if (sql.includes('SELECT id, approval_status FROM company_site.quote_drafts')) return { rows: [{ id: 'quote-1', approval_status: 'approved' }] };
    if (sql.includes('FROM company_site.sync_jobs')) return { rows: [] };
    if (sql.includes('INSERT INTO company_site.sync_jobs')) return { rows: [{ id: 'job-1', status: 'pending', retry_count: 0 }] };
    if (sql.includes('UPDATE company_site.sync_jobs')) return { rows: [{ id: 'job-1', status: 'pending', retry_count: 0 }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected queue sync query: ${sql}`);
  });
  const queueRes = response();
  await queue.handler.handleSyncApprovedDraft(request({ confirm: true }), queueRes, 'quote', 'quote-1', { id: 'manager-1' });
  assert.equal(queueRes.statusCode, 202);
  assert.equal(readPayload(queueRes).queued, true);

  const opportunity = createHarness((sql) => {
    if (sql.includes('SELECT id, approval_status FROM company_site.opportunity_drafts')) return { rows: [{ id: 'opp-1', approval_status: 'approved' }] };
    if (sql.includes('SELECT o.id, o.product_items')) return {
      rows: [{ id: 'opp-1', product_items: [{ slug: 'billiard-cues', quantity: 10 }], estimated_amount: 1000, stage: '需求确认', qualification: { score: 80 }, lead_id: 'lead-1', public_ref: 'INQ-1', company_name: '采购方', contact_name: '联系人', email: 'buyer@example.test', phone: '13800000000', country: 'CN', message: '请报价' }]
    };
    if (sql.includes('FROM company_site.sync_jobs')) return { rows: [] };
    if (sql.includes('INSERT INTO company_site.sync_jobs')) return { rows: [{ id: 'job-2', status: 'pending', retry_count: 0 }] };
    if (sql.includes('INSERT INTO public.sales_customers')) return { rows: [{ id: 'customer-1', customer_no: 'WEB-INQ-1', name: '采购方' }] };
    if (sql.includes('INSERT INTO public.sales_opportunities')) return { rows: [{ id: 'sales-opp-1', opportunity_no: 'WEB-opp-1', stage: '需求确认' }] };
    if (sql.includes('INSERT INTO public.sales_follow_ups')) return { rows: [] };
    if (sql.includes('UPDATE company_site.opportunity_drafts')) return { rows: [] };
    if (sql.includes('UPDATE company_site.sync_jobs')) return { rows: [{ id: 'job-2', status: 'succeeded', retry_count: 0 }] };
    if (sql.includes('INSERT INTO company_site.agent_audit_events')) return { rows: [] };
    throw new Error(`unexpected opportunity sync query: ${sql}`);
  });
  const opportunityRes = response();
  await opportunity.handler.handleSyncApprovedDraft(request({ confirm: true }), opportunityRes, 'opportunity', 'opp-1', { id: 'manager-1' });
  assert.equal(opportunityRes.statusCode, 200);
  assert.equal(readPayload(opportunityRes).opportunity.opportunity_no, 'WEB-opp-1');
}

function testApprovalRouteUsesApprovalAuthorization() {
  const runtimeSource = readFileSync(new URL('../../realtime/index.js', import.meta.url), 'utf8');
  const marker = "if (pathname.startsWith('/sales/drafts/') && pathname.endsWith('/approval') && method === 'POST')";
  const start = runtimeSource.indexOf(marker);
  assert.notEqual(start, -1, 'sales draft approval route should exist');
  const block = runtimeSource.slice(start, runtimeSource.indexOf("\n  }", start) + 4);
  assert.match(block, /authorizeCompanySalesApprovalRequest\(req, res\)/);
  assert.doesNotMatch(block, /authorizeCompanySalesRequest\(req, res\)/);
}

await testSessionAndKnowledgeAnswer();
await testConsentAndLeadIdempotency();
await testLeadQualificationAndOpportunityDraft();
await testQuoteOrderAndProductionDraftGates();
await testApprovedDraftSyncQueueAndOpportunityAdapter();
testApprovalRouteUsesApprovalAuthorization();
console.log('company-sales-agent-regression: PASS');
