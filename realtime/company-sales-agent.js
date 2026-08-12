// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const crypto = require('crypto');

const SITE_KEY = 'primary';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_JSON_BYTES = 32 * 1024;

const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);

const safeLocale = (value, fallback = 'zh-CN') => {
  const candidate = text(value, 32).replace(/_/g, '-');
  return /^[a-z]{2,3}(?:-(?:[A-Z][a-z]{1,3}|[A-Z]{2,3}))?$/.test(candidate) ? candidate : fallback;
};

const safeJson = (value, fallback = {}) => (value && typeof value === 'object' ? value : fallback);

const jsonBytes = (value) => {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const firstRow = (result) => (Array.isArray(result?.rows) ? result.rows[0] || null : null);
const rows = (result) => (Array.isArray(result?.rows) ? result.rows : []);
const hashValue = (value) => crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const getLocaleCandidates = (requested) => {
  const locale = safeLocale(requested, 'zh-CN');
  return locale === 'zh-CN' ? [locale] : [locale, 'zh-CN'];
};

const normalizeMessage = (value) => text(value, MAX_MESSAGE_LENGTH);

const tokenize = (value) => normalizeMessage(value)
  .toLowerCase()
  .split(/[\s,，。！？!?;；:：/\\()[\]{}"'“”‘’]+/)
  .map((token) => token.trim())
  .filter((token) => token.length >= 2)
  .slice(0, 12);

const containsKnowledgeTerm = (message, document) => {
  const title = String(document?.title || '').toLowerCase();
  const content = String(document?.content || '').toLowerCase();
  const normalized = String(message || '').toLowerCase();
  const terms = tokenize(message);
  const cjkSegments = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const cjkTerms = cjkSegments.flatMap((segment) => {
    const out = [];
    for (let index = 0; index < segment.length - 1; index += 1) out.push(segment.slice(index, index + 2));
    return out;
  });
  const candidates = [...terms, ...cjkTerms];
  if (!candidates.length) return false;
  return candidates.some((term) => title.includes(term) || content.includes(term));
};

const parseContact = (body) => ({
  companyName: text(body?.companyName || body?.company_name, 200),
  contactName: text(body?.contactName || body?.contact_name, 120),
  email: text(body?.email, 240).toLowerCase(),
  phone: text(body?.phone, 80),
  whatsapp: text(body?.whatsapp, 80),
  country: text(body?.country, 100),
  productSlugs: Array.isArray(body?.productSlugs || body?.product_slugs)
    ? (body.productSlugs || body.product_slugs).map((item) => text(item, 160)).filter(Boolean).slice(0, 20)
    : [],
  quantity: text(body?.quantity, 120),
  targetDate: text(body?.targetDate || body?.target_date, 80),
  message: text(body?.message, 4000)
});

const createCompanySalesHandlers = ({ query, sendJson, readJsonBody, answerWithAi = null, now = () => new Date() }) => {
  if (typeof query !== 'function') throw new Error('company-sales query function is required');
  if (typeof sendJson !== 'function') throw new Error('company-sales sendJson function is required');
  if (typeof readJsonBody !== 'function') throw new Error('company-sales readJsonBody function is required');

  const rateBuckets = new Map();
  const checkRateLimit = (req, res) => {
    const key = hashValue(`${req?.socket?.remoteAddress || 'unknown'}:${text(req?.headers?.host, 255)}`);
    const current = now().getTime();
    const bucket = rateBuckets.get(key);
    if (!bucket || current - bucket.startedAt >= 60 * 60 * 1000) {
      rateBuckets.set(key, { startedAt: current, count: 1 });
      return true;
    }
    if (bucket.count >= 60) {
      sendJson(res, 429, { code: 'RATE_LIMITED', message: 'Too many sales Agent requests' });
      return false;
    }
    bucket.count += 1;
    return true;
  };

  const loadPublishedSite = async (req) => {
    const host = text(req?.headers?.host, 255).split(',')[0].split(':')[0].toLowerCase();
    const result = await query(
      `SELECT site_key, domain, default_locale, enabled_locales, status
         FROM company_site.site_config
        WHERE site_key = $1
          AND status = 'published'
          AND ($2 = '' OR lower(domain) = lower($2))
        LIMIT 1`,
      [SITE_KEY, host]
    );
    return firstRow(result);
  };

  const loadSession = async (sessionId) => {
    const result = await query(
      `SELECT id, site_key, channel, locale, consent_at, status, lead_id, owner_id
         FROM company_site.agent_sessions
        WHERE id = $1 AND site_key = $2
        LIMIT 1`,
      [sessionId, SITE_KEY]
    );
    return firstRow(result);
  };

  const audit = async ({ traceId, actorType = 'system', actorId = '', sessionId = null, toolId, input, resultCode = 'OK', details = {} }) => {
    await query(
      `INSERT INTO company_site.agent_audit_events
        (site_key, trace_id, actor_type, actor_id, session_id, tool_id, input_hash, result_code, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [SITE_KEY, text(traceId, 128), text(actorType, 32), text(actorId, 160), sessionId || null, text(toolId, 120), hashValue(JSON.stringify(input || {})), text(resultCode, 64), JSON.stringify(details || {})]
    );
  };

  const createSession = async (req, res) => {
    if (!checkRateLimit(req, res)) return;
    let body = {};
    try {
      body = await readJsonBody(req, 32 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Published site configuration was not found' });
        return;
      }
      const accepted = body?.consent === true || body?.consent?.accepted === true || body?.consent?.accepted === 'true';
      const sessionId = text(body?.sessionId || body?.session_id, 80);
      if (sessionId) {
        const existing = await loadSession(sessionId);
        if (existing) {
          sendJson(res, 200, { ok: true, session: { id: existing.id, locale: existing.locale, status: existing.status, resumed: true } });
          return;
        }
      }
      const inserted = await query(
        `INSERT INTO company_site.agent_sessions
          (site_key, channel, locale, visitor_hash, consent_at, status)
         VALUES ($1, $2, $3, $4, $5, 'open')
         RETURNING id, locale, status, created_at`,
        [SITE_KEY, text(body?.channel, 40) || 'website', safeLocale(body?.locale, site.default_locale || 'zh-CN'), hashValue(text(body?.visitorId || body?.visitor_id, 160)), accepted ? now() : null]
      );
      const session = firstRow(inserted);
      if (!session) throw new Error('session insert returned no row');
      await audit({ traceId: `sales_session_${session.id}`, sessionId: session.id, toolId: 'sales.session.create', input: { channel: body?.channel, locale: body?.locale }, details: { consent: accepted } });
      sendJson(res, 201, { ok: true, session: { id: session.id, locale: session.locale, status: session.status, consentRequired: !accepted } });
    } catch {
      sendJson(res, 503, { code: 'SALES_SESSION_UNAVAILABLE', message: 'Sales Agent is temporarily unavailable' });
    }
  };

  const sendMessage = async (req, res, sessionId) => {
    if (!checkRateLimit(req, res)) return;
    let body = {};
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const message = normalizeMessage(body?.message);
    if (!message) {
      sendJson(res, 400, { code: 'MESSAGE_REQUIRED', message: 'message is required' });
      return;
    }
    const session = await loadSession(sessionId);
    if (!session) {
      sendJson(res, 404, { code: 'SESSION_NOT_FOUND', message: 'Sales session was not found' });
      return;
    }
    if (!session.consent_at) {
      sendJson(res, 400, { code: 'CONSENT_REQUIRED', message: 'Consent is required before starting a sales conversation' });
      return;
    }
    const locales = getLocaleCandidates(session.locale);
    const knowledgeResult = await query(
      `SELECT id, title, content, citations, forbidden_claims, version, updated_at
         FROM company_site.knowledge_documents
        WHERE site_key = $1
          AND status = 'published'
          AND locale = ANY($2::text[])
        ORDER BY updated_at DESC
        LIMIT 30`,
      [SITE_KEY, locales]
    );
    const matched = rows(knowledgeResult).filter((item) => containsKnowledgeTerm(message, item)).slice(0, 3);
    const citations = matched.map((item) => ({ id: item.id, title: item.title, version: item.version, updatedAt: item.updated_at }));
    let generated = null;
    if (matched.length && typeof answerWithAi === 'function') {
      try {
        generated = await answerWithAi({
          message,
          locale: session.locale,
          knowledge: matched.map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            citations: item.citations,
            forbiddenClaims: item.forbidden_claims,
            version: item.version,
            updatedAt: item.updated_at
          }))
        });
      } catch {
        generated = null;
      }
    }
    const answer = generated?.answer || (matched.length
      ? matched.map((item) => item.content).join('\n\n')
      : '我已记录你的问题。当前公开知识中没有足够依据确认这个事项，销售人员会人工跟进；请同时留下产品、数量、目标日期和联系方式。');
    const handoff = generated?.needsHuman === true || matched.length === 0;
    await query(
      `INSERT INTO company_site.agent_messages (site_key, session_id, role, content_redacted, citations, tool_calls)
       VALUES ($1, $2, 'user', $3, '[]'::jsonb, '[]'::jsonb),
              ($1, $2, 'assistant', $4, $5::jsonb, '[]'::jsonb)`,
      [SITE_KEY, sessionId, message, answer, JSON.stringify(citations)]
    );
    await query(
      `UPDATE company_site.agent_sessions
          SET status = CASE WHEN $2 THEN 'human_handoff' ELSE status END,
              last_message_at = $3,
              updated_at = $3
        WHERE id = $1 AND site_key = $4`,
      [sessionId, handoff, now(), SITE_KEY]
    );
    await audit({ traceId: `sales_message_${sessionId}_${Date.now()}`, sessionId, toolId: 'sales.message.answer', input: { message }, details: { citations: citations.length, handoff, aiModel: text(generated?.model, 120), aiUsed: Boolean(generated?.answer) } });
    sendJson(res, 200, { ok: true, session: { id: sessionId, status: handoff ? 'human_handoff' : session.status }, answer, citations, needsHuman: handoff });
  };

  const createLeadFromSession = async (req, res, sessionId) => {
    if (!checkRateLimit(req, res)) return;
    let body = {};
    try {
      body = await readJsonBody(req, 128 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const session = await loadSession(sessionId);
    if (!session) {
      sendJson(res, 404, { code: 'SESSION_NOT_FOUND', message: 'Sales session was not found' });
      return;
    }
    if (!session.consent_at && !(body?.consent === true || body?.consent?.accepted === true)) {
      sendJson(res, 400, { code: 'CONSENT_REQUIRED', message: 'Consent is required before creating a lead' });
      return;
    }
    const contact = parseContact(body);
    if (!contact.companyName && !contact.contactName) {
      sendJson(res, 400, { code: 'IDENTITY_REQUIRED', message: 'Contact name or company name is required' });
      return;
    }
    if (!contact.email && !contact.phone && !contact.whatsapp) {
      sendJson(res, 400, { code: 'CONTACT_REQUIRED', message: 'Email, phone or WhatsApp is required' });
      return;
    }
    if (jsonBytes(contact.productSlugs) > MAX_JSON_BYTES) {
      sendJson(res, 400, { code: 'PAYLOAD_TOO_LARGE', message: 'Lead metadata is too large' });
      return;
    }
    const idempotencyKey = text(body?.idempotencyKey || body?.idempotency_key, 160) || hashValue(`${sessionId}:${contact.email}:${contact.phone}:${contact.companyName}`);
    try {
      const existing = await query(
        `SELECT id, public_ref, status FROM company_site.leads
          WHERE site_key = $1 AND idempotency_key = $2 LIMIT 1`,
        [SITE_KEY, idempotencyKey]
      );
      if (firstRow(existing)) {
        sendJson(res, 200, { ok: true, deduplicated: true, lead: firstRow(existing) });
        return;
      }
      const publicRef = `INQ-${now().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const sourceSessionId = text(body?.sourceSessionId || body?.source_session_id, 80);
      const inserted = await query(
        `INSERT INTO company_site.leads
          (public_ref, site_key, source, locale, page_path, utm,
           company_name, contact_name, email, phone, whatsapp, country,
           product_slugs, quantity, target_date, message, consent,
           source_session_id, ip_hash, idempotency_key)
         VALUES ($1, $2, 'sales_agent', $3, $4, '{}'::jsonb,
           $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14,
           $15::jsonb, $16, '', $17)
         RETURNING id, public_ref, status, created_at`,
        [publicRef, SITE_KEY, session.locale, text(body?.pagePath || body?.page_path, 500), contact.companyName, contact.contactName, contact.email, contact.phone, contact.whatsapp, contact.country, JSON.stringify(contact.productSlugs), contact.quantity, contact.targetDate, contact.message, JSON.stringify({ accepted: true, acceptedAt: now().toISOString(), purpose: 'sales_agent' }), sessionId, idempotencyKey]
      );
      const lead = firstRow(inserted);
      if (!lead) throw new Error('lead insert returned no row');
      await query(
        `INSERT INTO company_site.lead_events (site_key, lead_id, session_id, event_name, page_path, event_payload)
         VALUES ($1, $2, $3, 'agent_lead_created', $4, $5::jsonb)`,
        [SITE_KEY, lead.id, sessionId, text(body?.pagePath || body?.page_path, 500), JSON.stringify({ source: 'sales_agent' })]
      );
      await query(
        `UPDATE company_site.agent_sessions SET lead_id = $2, updated_at = $3 WHERE id = $1 AND site_key = $4`,
        [sessionId, lead.id, now(), SITE_KEY]
      );
      await audit({ traceId: `sales_lead_${lead.id}`, sessionId, toolId: 'sales.lead.create_draft', input: contact, details: { publicRef: lead.public_ref } });
      sendJson(res, 201, { ok: true, deduplicated: false, lead });
    } catch {
      sendJson(res, 503, { code: 'SALES_LEAD_UNAVAILABLE', message: 'Sales lead service is temporarily unavailable' });
    }
  };

  const qualifyLead = async (req, res, leadId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 32 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    try {
      const result = await query(
        `SELECT id, public_ref, source, country, product_slugs, quantity,
                target_date, email, phone, whatsapp, qualification, status
           FROM company_site.leads
          WHERE id = $1 AND site_key = $2
          LIMIT 1`,
        [leadId, SITE_KEY]
      );
      const lead = firstRow(result);
      if (!lead) {
        sendJson(res, 404, { code: 'LEAD_NOT_FOUND', message: 'Lead was not found' });
        return;
      }
      const score = Math.max(0, Math.min(100, Number(body?.score ?? lead.qualification?.score ?? 0)));
      const reasons = Array.isArray(body?.reasons) ? body.reasons.map((item) => text(item, 240)).filter(Boolean).slice(0, 20) : [];
      const qualification = { ...safeJson(lead.qualification), score, reasons, qualifiedAt: now().toISOString(), qualifiedBy: text(user?.id || user?.username, 160) };
      const updated = await query(
        `UPDATE company_site.leads
            SET qualification = $1::jsonb,
                status = CASE WHEN status IN ('new', 'qualified') THEN 'qualified' ELSE status END,
                updated_at = now()
          WHERE id = $2 AND site_key = $3
          RETURNING id, public_ref, status, qualification, updated_at`,
        [JSON.stringify(qualification), leadId, SITE_KEY]
      );
      const item = firstRow(updated);
      await audit({ traceId: `sales_qualify_${leadId}`, actorType: 'employee', actorId: user?.id || user?.username, toolId: 'sales.lead.qualify', input: { leadId, score, reasons }, details: { status: item?.status || '' } });
      sendJson(res, 200, { ok: true, lead: item });
    } catch {
      sendJson(res, 503, { code: 'LEAD_QUALIFY_UNAVAILABLE', message: 'Lead qualification is temporarily unavailable' });
    }
  };

  const createOpportunityDraft = async (req, res, leadId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const idempotencyKey = text(body?.idempotencyKey || body?.idempotency_key, 160);
    if (!idempotencyKey) {
      sendJson(res, 400, { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'idempotencyKey is required for a draft opportunity' });
      return;
    }
    if (jsonBytes(body?.productItems) > MAX_JSON_BYTES) {
      sendJson(res, 400, { code: 'PAYLOAD_TOO_LARGE', message: 'Opportunity payload is too large' });
      return;
    }
    try {
      const leadResult = await query(`SELECT id FROM company_site.leads WHERE id = $1 AND site_key = $2 LIMIT 1`, [leadId, SITE_KEY]);
      if (!firstRow(leadResult)) {
        sendJson(res, 404, { code: 'LEAD_NOT_FOUND', message: 'Lead was not found' });
        return;
      }
      const existing = await query(`SELECT id, approval_status FROM company_site.opportunity_drafts WHERE site_key = $1 AND idempotency_key = $2 LIMIT 1`, [SITE_KEY, idempotencyKey]);
      if (firstRow(existing)) {
        sendJson(res, 200, { ok: true, deduplicated: true, opportunity: firstRow(existing) });
        return;
      }
      const sourceSessionId = text(body?.sourceSessionId || body?.source_session_id, 80);
      const inserted = await query(
        `INSERT INTO company_site.opportunity_drafts
          (site_key, lead_id, source_session_id, product_items, estimated_amount, currency, stage, qualification, approval_status, idempotency_key, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, 'draft', $9, $10, $10)
         RETURNING id, lead_id, approval_status, idempotency_key, created_at`,
        [SITE_KEY, leadId, isUuid(sourceSessionId) ? sourceSessionId : null, JSON.stringify(Array.isArray(body?.productItems) ? body.productItems.slice(0, 50) : []), body?.estimatedAmount ?? null, text(body?.currency, 12), text(body?.stage, 64) || 'new', JSON.stringify(safeJson(body?.qualification)), idempotencyKey, text(user?.id || user?.username, 160)]
      );
      const opportunity = firstRow(inserted);
      await audit({ traceId: `sales_opportunity_${opportunity?.id || leadId}`, actorType: 'employee', actorId: user?.id || user?.username, toolId: 'sales.opportunity.draft.create', input: body, resultCode: 'DRAFT_CREATED', details: { leadId } });
      sendJson(res, 201, { ok: true, deduplicated: false, opportunity });
    } catch {
      sendJson(res, 503, { code: 'OPPORTUNITY_UNAVAILABLE', message: 'Opportunity draft service is temporarily unavailable' });
    }
  };

  const createQuoteDraft = async (req, res, opportunityId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const idempotencyKey = text(body?.idempotencyKey || body?.idempotency_key, 160);
    if (!idempotencyKey) {
      sendJson(res, 400, { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'idempotencyKey is required for a draft quote' });
      return;
    }
    try {
      const opportunityResult = await query(
        `SELECT id, approval_status FROM company_site.opportunity_drafts
          WHERE id = $1 AND site_key = $2 LIMIT 1`,
        [opportunityId, SITE_KEY]
      );
      const opportunity = firstRow(opportunityResult);
      if (!opportunity) {
        sendJson(res, 404, { code: 'OPPORTUNITY_NOT_FOUND', message: 'Opportunity draft was not found' });
        return;
      }
      if (!['approved', 'synced'].includes(String(opportunity.approval_status || ''))) {
        sendJson(res, 409, { code: 'OPPORTUNITY_APPROVAL_REQUIRED', message: 'Opportunity approval is required before creating a quote draft' });
        return;
      }
      const existing = await query(
        `SELECT id, approval_status FROM company_site.quote_drafts
          WHERE site_key = $1 AND idempotency_key = $2 LIMIT 1`,
        [SITE_KEY, idempotencyKey]
      );
      if (firstRow(existing)) {
        sendJson(res, 200, { ok: true, deduplicated: true, quote: firstRow(existing) });
        return;
      }
      const inserted = await query(
        `INSERT INTO company_site.quote_drafts
          (site_key, opportunity_id, currency, items, valid_until, price_source, approval_status, idempotency_key, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'draft', $7, $8, $8)
         RETURNING id, opportunity_id, approval_status, idempotency_key, created_at`,
        [SITE_KEY, opportunityId, text(body?.currency, 12), JSON.stringify(Array.isArray(body?.items) ? body.items.slice(0, 100) : []), body?.validUntil || body?.valid_until || null, text(body?.priceSource || body?.price_source, 240), idempotencyKey, text(user?.id || user?.username, 160)]
      );
      const quote = firstRow(inserted);
      await audit({ traceId: `sales_quote_${quote?.id || opportunityId}`, actorType: 'employee', actorId: user?.id || user?.username, toolId: 'sales.quote.draft.create', input: body, resultCode: 'DRAFT_CREATED', details: { opportunityId } });
      sendJson(res, 201, { ok: true, deduplicated: false, quote });
    } catch {
      sendJson(res, 503, { code: 'QUOTE_UNAVAILABLE', message: 'Quote draft service is temporarily unavailable' });
    }
  };

  const readInventoryCheck = async (items) => {
    const requested = (Array.isArray(items) ? items : [])
      .map((item) => ({
        materialId: Number(item?.materialId || item?.material_id),
        requestedQty: Number(item?.quantity || item?.qty || item?.requiredQty || item?.required_qty || 0)
      }))
      .filter((item) => Number.isInteger(item.materialId) && item.materialId > 0);
    const materialIds = [...new Set(requested.map((item) => item.materialId))];
    if (!materialIds.length) return { status: 'not_requested', checkedAt: now().toISOString(), items: [] };
    try {
      const result = await query(
        `SELECT material_id, MAX(material_code) AS material_code,
                MAX(material_name) AS material_name,
                SUM(available_qty) AS available_qty,
                SUM(locked_qty) AS locked_qty,
                SUM(total_qty) AS total_qty,
                MAX(unit) AS unit, MAX(last_transaction_at) AS last_transaction_at
           FROM scm.v_inventory_current
          WHERE material_id = ANY($1::int[])
          GROUP BY material_id
          ORDER BY material_id`,
        [materialIds]
      );
      const availableById = new Map(rows(result).map((item) => [Number(item.material_id), item]));
      const checkedItems = requested.map((request) => {
        const inventory = availableById.get(request.materialId) || {};
        const availableQty = Number(inventory.available_qty || 0);
        const shortageQty = Math.max(request.requestedQty - availableQty, 0);
        const checkStatus = inventory.material_id ? (shortageQty > 0 ? 'shortage' : 'available') : 'material_not_found';
        return {
          ...inventory,
          material_id: request.materialId,
          requested_qty: request.requestedQty,
          available_qty: availableQty,
          shortage_qty: shortageQty,
          check_status: checkStatus
        };
      });
      return {
        status: checkedItems.some((item) => item.check_status === 'material_not_found')
          ? 'material_not_found'
          : (checkedItems.some((item) => item.check_status === 'shortage') ? 'shortage' : 'available'),
        checkedAt: now().toISOString(),
        items: checkedItems
      };
    } catch {
      return { status: 'unavailable', checkedAt: now().toISOString(), items: [], reason: 'inventory_source_unavailable' };
    }
  };

  const readBomCheck = async (items) => {
    const requested = (Array.isArray(items) ? items : [])
      .map((item) => ({
        productMaterialId: Number(item?.productMaterialId || item?.product_material_id),
        productMaterialCode: text(item?.productMaterialCode || item?.product_material_code, 160),
        requestedQty: Number(item?.quantity || item?.qty || item?.plannedQty || item?.planned_qty || 0)
      }))
      .filter((item) => (Number.isInteger(item.productMaterialId) && item.productMaterialId > 0) || item.productMaterialCode);
    const materialIds = [...new Set(requested.map((item) => item.productMaterialId).filter((value) => Number.isInteger(value) && value > 0))];
    const materialCodes = [...new Set(requested.map((item) => item.productMaterialCode).filter(Boolean))];
    if (!materialIds.length && !materialCodes.length) return { status: 'not_requested', checkedAt: now().toISOString(), items: [] };
    try {
      const result = await query(
        `SELECT b.id, b.bom_no, b.parent_material_id, pm.batch_no AS product_material_code,
                b.version, b.base_qty, b.unit, b.status,
                bi.line_no, bi.component_material_id, bi.qty, bi.unit AS component_unit,
                bi.loss_rate, rm.batch_no AS component_material_code,
                rm.name AS component_material_name
           FROM scm.boms b
           LEFT JOIN public.raw_materials pm ON pm.id = b.parent_material_id
           LEFT JOIN scm.bom_items bi ON bi.bom_id = b.id
           LEFT JOIN public.raw_materials rm ON rm.id = bi.component_material_id
          WHERE b.status = '启用'
            AND (
              b.parent_material_id = ANY($1::int[])
              OR b.parent_material_id IN (
                SELECT id FROM public.raw_materials WHERE batch_no = ANY($2::text[])
              )
            )
          ORDER BY b.parent_material_id, b.version DESC, bi.line_no`,
        [materialIds, materialCodes]
      );
      const bomItems = rows(result);
      const checkedItems = requested.map((request) => {
        const components = bomItems.filter((item) =>
          (request.productMaterialId > 0 && Number(item.parent_material_id) === request.productMaterialId) ||
          (request.productMaterialCode && text(item.product_material_code, 160) === request.productMaterialCode)
        );
        return { ...request, bom_found: components.length > 0, components };
      });
      return {
        status: checkedItems.every((item) => item.bom_found) ? 'available' : 'missing_bom',
        checkedAt: now().toISOString(),
        items: checkedItems,
        source: 'scm.boms+scm.bom_items'
      };
    } catch {
      return { status: 'unavailable', checkedAt: now().toISOString(), items: [], reason: 'bom_source_unavailable' };
    }
  };

  const readCapacityCheck = async (items, deliveryDate = null) => {
    const requested = (Array.isArray(items) ? items : [])
      .map((item) => ({
        productMaterialId: Number(item?.productMaterialId || item?.product_material_id),
        productMaterialCode: text(item?.productMaterialCode || item?.product_material_code, 160),
        requestedQty: Number(item?.quantity || item?.qty || item?.plannedQty || item?.planned_qty || 0)
      }))
      .filter((item) => (Number.isInteger(item.productMaterialId) && item.productMaterialId > 0) || item.productMaterialCode);
    const materialIds = [...new Set(requested.map((item) => item.productMaterialId).filter((value) => Number.isInteger(value) && value > 0))];
    const materialCodes = [...new Set(requested.map((item) => item.productMaterialCode).filter(Boolean))];
    if (!materialIds.length && !materialCodes.length) {
      return { status: 'not_requested', checkedAt: now().toISOString(), items: [], reason: 'product_material_scope_required' };
    }
    try {
      const result = await query(
        `SELECT product_material_id, product_material_code, product_material_name,
                SUM(planned_qty) AS open_planned_qty,
                COUNT(*)::int AS open_work_order_count,
                MIN(planned_finish_date) AS earliest_finish_date,
                MAX(updated_at) AS source_updated_at
           FROM scm.production_work_orders
          WHERE work_order_status NOT IN ('已完工', '已取消')
            AND ($1::date IS NULL OR planned_start_date IS NULL OR planned_start_date <= $1::date)
            AND ($2::date IS NULL OR planned_finish_date IS NULL OR planned_finish_date <= $2::date)
            AND (
              product_material_id = ANY($3::int[])
              OR product_material_code = ANY($4::text[])
            )
          GROUP BY product_material_id, product_material_code, product_material_name`,
        [deliveryDate || null, deliveryDate || null, materialIds, materialCodes]
      );
      const loadRows = rows(result);
      const loadById = new Map(loadRows.map((item) => [Number(item.product_material_id), item]));
      const loadByCode = new Map(loadRows.map((item) => [text(item.product_material_code, 160), item]));
      const checkedItems = requested.map((request) => ({
        ...request,
        ...((request.productMaterialId > 0 ? loadById.get(request.productMaterialId) : loadByCode.get(request.productMaterialCode)) || {}),
        planning_status: 'requires_planning_confirmation'
      }));
      return {
        status: 'advisory',
        checkedAt: now().toISOString(),
        deliveryDate: deliveryDate || null,
        capacityLimit: null,
        source: 'scm.production_work_orders',
        risk: 'No approved capacity limit is configured; planner confirmation is required before any delivery commitment.',
        items: checkedItems
      };
    } catch {
      return { status: 'unavailable', checkedAt: now().toISOString(), items: [], reason: 'capacity_source_unavailable' };
    }
  };

  const createSalesOrderDraft = async (req, res, quoteId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 96 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const idempotencyKey = text(body?.idempotencyKey || body?.idempotency_key, 160);
    if (!idempotencyKey) {
      sendJson(res, 400, { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'idempotencyKey is required for a sales order draft' });
      return;
    }
    try {
      const quoteResult = await query(
        `SELECT id, approval_status, items, currency
           FROM company_site.quote_drafts
          WHERE id = $1 AND site_key = $2 LIMIT 1`,
        [quoteId, SITE_KEY]
      );
      const quote = firstRow(quoteResult);
      if (!quote) {
        sendJson(res, 404, { code: 'QUOTE_NOT_FOUND', message: 'Quote draft was not found' });
        return;
      }
      if (!['approved', 'synced'].includes(String(quote.approval_status || ''))) {
        sendJson(res, 409, { code: 'QUOTE_APPROVAL_REQUIRED', message: 'Quote approval is required before creating a sales order draft' });
        return;
      }
      const existing = await query(`SELECT id, approval_status FROM company_site.sales_order_drafts WHERE site_key = $1 AND idempotency_key = $2 LIMIT 1`, [SITE_KEY, idempotencyKey]);
      if (firstRow(existing)) {
        sendJson(res, 200, { ok: true, deduplicated: true, salesOrder: firstRow(existing) });
        return;
      }
      const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : (Array.isArray(quote.items) ? quote.items : []);
      const deliveryDate = body?.deliveryDate || body?.delivery_date || null;
      const [inventoryCheck, bomCheck, capacityCheck] = await Promise.all([
        readInventoryCheck(items),
        readBomCheck(items),
        readCapacityCheck(items, deliveryDate)
      ]);
      const inserted = await query(
        `INSERT INTO company_site.sales_order_drafts
          (site_key, quote_id, items, delivery_date, inventory_check, bom_check, capacity_check, approval_status, idempotency_key, created_by, updated_by)
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7::jsonb, 'draft', $8, $9, $9)
         RETURNING id, quote_id, approval_status, inventory_check, bom_check, capacity_check, idempotency_key, created_at`,
        [SITE_KEY, quoteId, JSON.stringify(items), deliveryDate, JSON.stringify(inventoryCheck), JSON.stringify(bomCheck), JSON.stringify(capacityCheck), idempotencyKey, text(user?.id || user?.username, 160)]
      );
      const salesOrder = firstRow(inserted);
      await audit({ traceId: `sales_order_${salesOrder?.id || quoteId}`, actorType: 'employee', actorId: user?.id || user?.username, toolId: 'sales.order.draft.create', input: { quoteId, items, deliveryDate }, resultCode: 'DRAFT_CREATED', details: { inventory: inventoryCheck.status, bom: bomCheck.status, capacity: capacityCheck.status } });
      sendJson(res, 201, { ok: true, deduplicated: false, salesOrder });
    } catch {
      sendJson(res, 503, { code: 'SALES_ORDER_UNAVAILABLE', message: 'Sales order draft service is temporarily unavailable' });
    }
  };

  const createProductionDraft = async (req, res, salesOrderId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 96 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const idempotencyKey = text(body?.idempotencyKey || body?.idempotency_key, 160);
    if (!idempotencyKey) {
      sendJson(res, 400, { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'idempotencyKey is required for a production draft' });
      return;
    }
    try {
      const orderResult = await query(`SELECT id, approval_status, items FROM company_site.sales_order_drafts WHERE id = $1 AND site_key = $2 LIMIT 1`, [salesOrderId, SITE_KEY]);
      const order = firstRow(orderResult);
      if (!order) {
        sendJson(res, 404, { code: 'SALES_ORDER_NOT_FOUND', message: 'Sales order draft was not found' });
        return;
      }
      if (order.approval_status !== 'approved') {
        sendJson(res, 409, { code: 'SALES_ORDER_APPROVAL_REQUIRED', message: 'Sales order approval is required before creating a production draft' });
        return;
      }
      const existing = await query(`SELECT id, approval_status FROM company_site.production_work_order_drafts WHERE site_key = $1 AND idempotency_key = $2 LIMIT 1`, [SITE_KEY, idempotencyKey]);
      if (firstRow(existing)) {
        sendJson(res, 200, { ok: true, deduplicated: true, production: firstRow(existing) });
        return;
      }
      const inserted = await query(
        `INSERT INTO company_site.production_work_order_drafts
          (site_key, sales_order_id, planned_items, material_requirements, capacity_risk, approval_status, idempotency_key, created_by, updated_by)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, 'draft', $6, $7, $7)
         RETURNING id, sales_order_id, approval_status, idempotency_key, created_at`,
        [SITE_KEY, salesOrderId, JSON.stringify(Array.isArray(body?.plannedItems) ? body.plannedItems : (Array.isArray(order.items) ? order.items : [])), JSON.stringify(Array.isArray(body?.materialRequirements) ? body.materialRequirements : []), JSON.stringify(safeJson(body?.capacityRisk)), idempotencyKey, text(user?.id || user?.username, 160)]
      );
      const production = firstRow(inserted);
      await audit({ traceId: `production_draft_${production?.id || salesOrderId}`, actorType: 'employee', actorId: user?.id || user?.username, toolId: 'production.work_order_draft.create', input: body, resultCode: 'DRAFT_CREATED', details: { salesOrderId } });
      sendJson(res, 201, { ok: true, deduplicated: false, production });
    } catch {
      sendJson(res, 503, { code: 'PRODUCTION_DRAFT_UNAVAILABLE', message: 'Production draft service is temporarily unavailable' });
    }
  };

  const syncApprovedDraft = async (req, res, objectType, objectId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 96 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const type = text(objectType, 40).toLowerCase();
    const tableMap = {
      opportunity: 'opportunity_drafts',
      quote: 'quote_drafts',
      sales_order: 'sales_order_drafts',
      production: 'production_work_order_drafts'
    };
    if (!tableMap[type] || !objectId) {
      sendJson(res, 400, { code: 'VALIDATION_FAILED', message: 'A supported draft type and id are required' });
      return;
    }
    if (body?.confirm !== true) {
      sendJson(res, 400, { code: 'CONFIRMATION_REQUIRED', message: 'Explicit confirmation is required before syncing a business draft' });
      return;
    }
    const targetSystem = text(body?.targetSystem || body?.target_system, 120) || 'eiscore';
    const idempotencyKey = text(body?.idempotencyKey || body?.idempotency_key, 160) || `${type}:${objectId}:${targetSystem}:v1`;
    const actorId = text(user?.id || user?.username, 160);
    const traceId = `sales_sync_${type}_${objectId}`;
    try {
      const draftResult = await query(
        `SELECT id, approval_status FROM company_site.${tableMap[type]}
          WHERE id = $1 AND site_key = $2 LIMIT 1`,
        [objectId, SITE_KEY]
      );
      const draft = firstRow(draftResult);
      if (!draft) {
        sendJson(res, 404, { code: 'DRAFT_NOT_FOUND', message: 'Draft was not found for this site' });
        return;
      }
      if (draft.approval_status !== 'approved') {
        sendJson(res, 409, { code: 'DRAFT_APPROVAL_REQUIRED', message: 'The draft must be approved before syncing' });
        return;
      }
      const existingJob = await query(
        `SELECT id, status, retry_count, last_error
           FROM company_site.sync_jobs
          WHERE site_key = $1 AND target_system = $2 AND idempotency_key = $3
          LIMIT 1`,
        [SITE_KEY, targetSystem, idempotencyKey]
      );
      if (firstRow(existingJob)) {
        sendJson(res, 200, { ok: true, deduplicated: true, syncJob: firstRow(existingJob) });
        return;
      }
      const jobResult = await query(
        `INSERT INTO company_site.sync_jobs
          (site_key, object_type, object_id, target_system, idempotency_key, status, source_trace_id)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING id, object_type, object_id, target_system, idempotency_key, status, retry_count, created_at`,
        [SITE_KEY, type, objectId, targetSystem, idempotencyKey, traceId]
      );
      const syncJob = firstRow(jobResult);

      const markJob = async (status, errorMessage = '') => {
        const result = await query(
          `UPDATE company_site.sync_jobs
              SET status = $1,
                  retry_count = CASE WHEN $1 = 'failed' THEN retry_count + 1 ELSE retry_count END,
                  last_error = $2,
                  updated_at = now()
            WHERE id = $3
            RETURNING id, status, retry_count, last_error, updated_at`,
          [status, text(errorMessage, 1000), syncJob?.id]
        );
        return firstRow(result) || { id: syncJob?.id, status, last_error: text(errorMessage, 1000) };
      };

      if (type === 'quote' || type === 'production') {
        const queued = await markJob('pending');
        await audit({ traceId, actorType: 'employee', actorId, toolId: `sales.${type}.sync.enqueue`, input: { objectId, targetSystem, idempotencyKey }, resultCode: 'QUEUED', details: { targetSystem } });
        sendJson(res, 202, { ok: true, queued: true, syncJob: queued, message: 'This draft is queued for a system adapter and has not changed a formal EISCore document.' });
        return;
      }

      const syncCustomer = async (lead) => {
        const customerNo = `WEB-${text(lead.public_ref, 80)}`.slice(0, 120);
        const customerResult = await query(
          `INSERT INTO public.sales_customers
            (customer_no, name, level, contact_name, contact_phone, region, owner_name, customer_status, properties)
           VALUES ($1, $2, '潜在客户', $3, $4, $5, $6, '跟进中', $7::jsonb)
           ON CONFLICT (customer_no) DO UPDATE SET
             name = EXCLUDED.name,
             contact_name = EXCLUDED.contact_name,
             contact_phone = EXCLUDED.contact_phone,
             region = EXCLUDED.region,
             owner_name = EXCLUDED.owner_name,
             properties = COALESCE(public.sales_customers.properties, '{}'::jsonb) || EXCLUDED.properties,
             updated_at = now()
           RETURNING id, customer_no, name`,
          [customerNo, text(lead.company_name || lead.contact_name, 240) || '官网询盘客户', text(lead.contact_name, 120), text(lead.phone || lead.whatsapp, 80), text(lead.country, 100), actorId, JSON.stringify({ source: 'company_site', leadId: lead.id, publicRef: lead.public_ref, email: lead.email || '' })]
        );
        return firstRow(customerResult);
      };

      if (type === 'opportunity') {
        const source = await query(
          `SELECT o.id, o.product_items, o.estimated_amount, o.currency, o.stage,
                  o.qualification, l.id AS lead_id, l.public_ref, l.company_name,
                  l.contact_name, l.email, l.phone, l.whatsapp, l.country, l.message
             FROM company_site.opportunity_drafts o
             JOIN company_site.leads l ON l.id = o.lead_id AND l.site_key = o.site_key
            WHERE o.id = $1 AND o.site_key = $2
            LIMIT 1`,
          [objectId, SITE_KEY]
        );
        const sourceRow = firstRow(source);
        if (!sourceRow) throw new Error('Opportunity source data was not found');
        const customer = await syncCustomer(sourceRow);
        const opportunityNo = `WEB-${String(sourceRow.id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100)}`;
        const opportunityResult = await query(
          `INSERT INTO public.sales_opportunities
            (opportunity_no, opportunity_name, customer_id, customer_name, expected_amount, stage, probability, owner_name, next_action, remark, properties)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '销售确认官网询盘', $9, $10::jsonb)
           ON CONFLICT (opportunity_no) DO UPDATE SET
             opportunity_name = EXCLUDED.opportunity_name,
             customer_id = EXCLUDED.customer_id,
             customer_name = EXCLUDED.customer_name,
             expected_amount = EXCLUDED.expected_amount,
             stage = EXCLUDED.stage,
             owner_name = EXCLUDED.owner_name,
             remark = EXCLUDED.remark,
             properties = COALESCE(public.sales_opportunities.properties, '{}'::jsonb) || EXCLUDED.properties,
             updated_at = now()
           RETURNING id, opportunity_no, customer_id, customer_name, stage`,
          [opportunityNo, `官网询盘 ${sourceRow.public_ref}`, customer?.id || null, text(sourceRow.company_name || sourceRow.contact_name, 240) || '官网询盘客户', sourceRow.estimated_amount || 0, text(sourceRow.stage, 80) || '初步接洽', Math.max(0, Math.min(100, Number(sourceRow.qualification?.score || 20))), actorId, text(sourceRow.message, 2000), JSON.stringify({ source: 'company_site', draftId: sourceRow.id, leadId: sourceRow.lead_id, productItems: sourceRow.product_items })]
        );
        await query(
          `INSERT INTO public.sales_follow_ups
            (follow_no, customer_id, customer_name, contact_name, follow_type, follow_result, owner_name, follow_content, properties)
           VALUES ($1, $2, $3, $4, '官网询盘', '待跟进', $5, $6, $7::jsonb)
           ON CONFLICT (follow_no) DO UPDATE SET
             customer_id = EXCLUDED.customer_id,
             customer_name = EXCLUDED.customer_name,
             contact_name = EXCLUDED.contact_name,
             owner_name = EXCLUDED.owner_name,
             follow_content = EXCLUDED.follow_content,
             properties = COALESCE(public.sales_follow_ups.properties, '{}'::jsonb) || EXCLUDED.properties,
             updated_at = now()`,
          [`WEB-FU-${String(sourceRow.id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100)}`, customer?.id || null, text(sourceRow.company_name || sourceRow.contact_name, 240) || '官网询盘客户', text(sourceRow.contact_name, 120), actorId, text(sourceRow.message, 2000), JSON.stringify({ source: 'company_site', opportunityId: firstRow(opportunityResult)?.id || '' })]
        );
        await query(
          `UPDATE company_site.opportunity_drafts SET approval_status = 'synced', updated_by = $2, updated_at = now() WHERE id = $1 AND site_key = $3`,
          [objectId, actorId, SITE_KEY]
        );
        const completed = await markJob('succeeded');
        await audit({ traceId, actorType: 'employee', actorId, toolId: 'sales.opportunity.sync', input: { objectId, targetSystem, idempotencyKey }, resultCode: 'SYNCED', details: { customerId: customer?.id || '', opportunityNo } });
        sendJson(res, 200, { ok: true, deduplicated: false, syncJob: completed, customer, opportunity: firstRow(opportunityResult) });
        return;
      }

      const source = await query(
        `SELECT so.id, so.items, so.delivery_date, q.currency, q.opportunity_id,
                o.estimated_amount, l.public_ref, l.company_name, l.contact_name,
                l.email, l.phone, l.whatsapp, l.country, l.id AS lead_id
           FROM company_site.sales_order_drafts so
           JOIN company_site.quote_drafts q ON q.id = so.quote_id AND q.site_key = so.site_key
           JOIN company_site.opportunity_drafts o ON o.id = q.opportunity_id AND o.site_key = q.site_key
           JOIN company_site.leads l ON l.id = o.lead_id AND l.site_key = o.site_key
          WHERE so.id = $1 AND so.site_key = $2
          LIMIT 1`,
        [objectId, SITE_KEY]
      );
      const sourceRow = firstRow(source);
      if (!sourceRow) throw new Error('Sales order source data was not found');
      const customer = await syncCustomer(sourceRow);
      const items = Array.isArray(sourceRow.items) ? sourceRow.items : [];
      const firstItem = items[0] || {};
      const quantity = Number(firstItem.quantity || firstItem.qty || 0) || 0;
      const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount || item.totalAmount || 0) || 0), 0) || Number(sourceRow.estimated_amount || 0) || 0;
      const orderNo = `WEB-${text(sourceRow.public_ref, 80)}-${String(objectId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`.slice(0, 120);
      const orderResult = await query(
        `INSERT INTO public.sales_orders
          (order_no, customer_id, customer_name, product_name, quantity, unit, unit_price, total_amount, delivery_date, order_status, owner_name, properties)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '草稿', $10, $11::jsonb)
         ON CONFLICT (order_no) DO UPDATE SET
           customer_id = EXCLUDED.customer_id,
           customer_name = EXCLUDED.customer_name,
           product_name = EXCLUDED.product_name,
           quantity = EXCLUDED.quantity,
           total_amount = EXCLUDED.total_amount,
           delivery_date = EXCLUDED.delivery_date,
           owner_name = EXCLUDED.owner_name,
           properties = COALESCE(public.sales_orders.properties, '{}'::jsonb) || EXCLUDED.properties,
           updated_at = now()
         RETURNING id, order_no, customer_id, customer_name, order_status`,
        [orderNo, customer?.id || null, text(sourceRow.company_name || sourceRow.contact_name, 240) || '官网询盘客户', text(firstItem.productName || firstItem.name || firstItem.product_name || firstItem.slug, 240) || '官网询盘产品', quantity, text(firstItem.unit, 40) || '件', quantity > 0 ? totalAmount / quantity : 0, totalAmount, sourceRow.delivery_date || null, actorId, JSON.stringify({ source: 'company_site', draftId: sourceRow.id, leadId: sourceRow.lead_id, items })]
      );
      await query(
        `UPDATE company_site.sales_order_drafts SET approval_status = 'synced', updated_by = $2, updated_at = now() WHERE id = $1 AND site_key = $3`,
        [objectId, actorId, SITE_KEY]
      );
      const completed = await markJob('succeeded');
      await audit({ traceId, actorType: 'employee', actorId, toolId: 'sales.order.sync', input: { objectId, targetSystem, idempotencyKey }, resultCode: 'SYNCED', details: { customerId: customer?.id || '', orderNo } });
      sendJson(res, 200, { ok: true, deduplicated: false, syncJob: completed, customer, salesOrder: firstRow(orderResult) });
    } catch (error) {
      try {
        await query(
          `UPDATE company_site.sync_jobs
              SET status = 'failed', retry_count = retry_count + 1, last_error = $1, updated_at = now()
            WHERE site_key = $2 AND target_system = $3 AND idempotency_key = $4`,
          [text(error?.message || 'sync failed', 1000), SITE_KEY, targetSystem, idempotencyKey]
        );
      } catch {
        // Preserve the public failure response if the sync ledger is unavailable.
      }
      await audit({ traceId, actorType: 'employee', actorId, toolId: `sales.${type}.sync`, input: { objectId, targetSystem, idempotencyKey }, resultCode: 'SYNC_FAILED', details: { error: text(error?.message || 'sync failed', 500) } }).catch(() => {});
      sendJson(res, 503, { code: 'DRAFT_SYNC_UNAVAILABLE', message: 'Draft synchronization is temporarily unavailable' });
    }
  };

  const approveDraft = async (req, res, objectType, objectId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 32 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const definitions = {
      opportunity: 'opportunity_drafts',
      quote: 'quote_drafts',
      sales_order: 'sales_order_drafts',
      production: 'production_work_order_drafts'
    };
    const table = definitions[objectType];
    const decision = text(body?.decision, 16).toLowerCase();
    if (!table || !objectId || !['approve', 'reject'].includes(decision)) {
      sendJson(res, 400, { code: 'VALIDATION_FAILED', message: 'objectType, objectId and decision=approve|reject are required' });
      return;
    }
    const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
    try {
      const updated = await query(
        `UPDATE company_site.${table}
            SET approval_status = $1,
                updated_by = $2,
                updated_at = now()
          WHERE id = $3 AND site_key = $4
          RETURNING id, approval_status, updated_by, updated_at`,
        [nextStatus, text(user?.id || user?.username, 160), objectId, SITE_KEY]
      );
      const item = firstRow(updated);
      if (!item) {
        sendJson(res, 404, { code: 'DRAFT_NOT_FOUND', message: 'Draft was not found for this site' });
        return;
      }
      await audit({ traceId: `sales_approval_${objectType}_${objectId}`, actorType: 'employee', actorId: user?.id || user?.username, toolId: `sales.${objectType}.approval`, input: { objectType, objectId, decision, comment: text(body?.comment, 1000) }, resultCode: nextStatus.toUpperCase(), details: { comment: text(body?.comment, 1000) } });
      sendJson(res, 200, { ok: true, item });
    } catch {
      sendJson(res, 503, { code: 'DRAFT_APPROVAL_UNAVAILABLE', message: 'Draft approval is temporarily unavailable' });
    }
  };

  return {
    handleCreateSession: createSession,
    handleSendMessage: async (req, res, sessionId) => {
      try {
        await sendMessage(req, res, sessionId);
      } catch {
        sendJson(res, 503, { code: 'SALES_MESSAGE_UNAVAILABLE', message: 'Sales Agent message service is temporarily unavailable' });
      }
    },
    handleCreateLead: async (req, res, sessionId) => {
      try {
        await createLeadFromSession(req, res, sessionId);
      } catch {
        sendJson(res, 503, { code: 'SALES_LEAD_UNAVAILABLE', message: 'Sales lead service is temporarily unavailable' });
      }
    },
    handleQualifyLead: qualifyLead,
    handleCreateOpportunityDraft: createOpportunityDraft,
    handleCreateQuoteDraft: createQuoteDraft,
    handleCreateSalesOrderDraft: createSalesOrderDraft,
    handleCreateProductionDraft: createProductionDraft,
    handleSyncApprovedDraft: syncApprovedDraft,
    handleApproveDraft: approveDraft,
    _private: { parseContact, tokenize, containsKnowledgeTerm, isUuid }
  };
};

module.exports = { SITE_KEY, createCompanySalesHandlers };
