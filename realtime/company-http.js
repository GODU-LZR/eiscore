// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const crypto = require('crypto');
const { lstatSync, readFileSync } = require('node:fs');
const { extname, relative, resolve, sep } = require('node:path');

const route = (method, match, matcher, handler, authorize) => Object.freeze({
  method,
  match,
  ...(match === 'pattern' ? { pattern: matcher } : { path: matcher }),
  handler,
  ...(authorize ? { authorize } : {})
});
const exact = (method, path, handler, authorize) => route(method, 'exact', path, handler, authorize);
const pattern = (method, matcher, handler, authorize) => route(method, 'pattern', matcher, handler, authorize);

const SITE_READ = 'companySiteRead';
const SITE_MANAGE = 'companySiteManage';
const SALES_MANAGE = 'companySalesManage';
const SALES_APPROVAL = 'companySalesApproval';

const COMPANY_HTTP_ROUTE_MANIFEST = Object.freeze([
  exact('POST', '/company-site/auth/handoff', 'company.handleCreateAuthHandoff'),
  exact('POST', '/company-site/auth/handoff/consume', 'company.handleConsumeAuthHandoff'),
  exact('GET', '/company-site/public/site-config', 'company.handleGetPublicSiteConfig'),
  pattern('GET', /^\/company-site\/public\/assets\/.+$/, 'company.handleGetPublicAsset'),
  pattern('GET', /^\/company-site\/public\/pages\/[^/]+$/, 'company.handleGetPublicPage'),
  exact('GET', '/company-site/public/products', 'company.handleGetPublicProducts'),
  pattern('GET', /^\/company-site\/public\/products\/[^/]+$/, 'company.handleGetPublicProduct'),
  exact('GET', '/company-site/public/solutions', 'company.handleGetPublicSolutions'),
  pattern('GET', /^\/company-site\/public\/solutions\/[^/]+$/, 'company.handleGetPublicSolution'),
  exact('GET', '/company-site/public/cases', 'company.handleGetPublicCases'),
  pattern('GET', /^\/company-site\/public\/cases\/[^/]+$/, 'company.handleGetPublicCase'),
  exact('GET', '/company-site/public/faq', 'company.handleGetPublicFaq'),
  pattern('GET', /^\/company-site\/public\/faq\/[^/]+$/, 'company.handleGetPublicFaqItem'),
  exact('GET', '/company-site/public/sitemap.xml', 'company.handleGetPublicSitemap'),
  exact('POST', '/company-site/public/leads', 'company.handleCreatePublicLead'),
  exact('POST', '/company-site/public/events', 'company.handleRecordPublicEvent'),
  exact('POST', '/company-site/public/download-events', 'company.handleRecordPublicEvent'),
  exact('GET', '/company-site/admin/site-config', 'company.handleGetAdminSiteConfig', SITE_READ),
  exact('PATCH', '/company-site/admin/site-config', 'company.handleUpdateAdminSiteConfig', SITE_MANAGE),
  exact('POST', '/company-site/admin/content/publish', 'company.handlePublishContent', SITE_MANAGE),
  exact('POST', '/company-site/admin/content/rollback', 'company.handleRollbackContent', SITE_MANAGE),
  pattern('GET', /^\/company-site\/admin\/content\/[^/]+\/[^/]+\/revisions$/, 'company.handleListContentRevisions', SITE_READ),
  pattern('POST', /^\/company-site\/admin\/content\/[^/]+(?:\/[^/]+)?$/, 'company.handleSaveAdminContent', SITE_MANAGE),
  pattern('PATCH', /^\/company-site\/admin\/content\/[^/]+\/[^/]+$/, 'company.handleSaveAdminContent', SITE_MANAGE),
  exact('GET', '/company-site/admin/leads', 'company.handleListAdminLeads', SITE_READ),
  exact('POST', '/company-site/admin/seo/check', 'company.handleRunSeoCheck', SITE_MANAGE),
  exact('GET', '/company-site/admin/seo/checks', 'company.handleListSeoChecks', SITE_READ),
  exact('POST', '/company-site/admin/geo/snapshots', 'company.handleRecordGeoSnapshot', SITE_MANAGE),
  exact('POST', '/company-site/admin/geo/snapshots/generate', 'company.handleGenerateGeoSnapshots', SITE_MANAGE),
  pattern('PATCH', /^\/company-site\/admin\/geo\/snapshots\/[^/]+\/review$/, 'company.handleReviewGeoSnapshot', SITE_MANAGE),
  exact('GET', '/company-site/admin/geo/snapshots', 'company.handleListGeoSnapshots', SITE_READ),
  pattern('GET', /^\/company-site\/admin\/(?:pages|products|productLocales|solutions|cases|evidence|seo|knowledge|keywords)$/, 'company.handleListAdminContent', SITE_READ),
  exact('POST', '/sales/sessions', 'company.handleCreateSalesSession'),
  pattern('POST', /^\/sales\/sessions\/[^/]+\/messages$/, 'company.handleSendSalesMessage'),
  pattern('POST', /^\/sales\/sessions\/[^/]+\/leads$/, 'company.handleCreateSalesLead'),
  pattern('POST', /^\/sales\/leads\/[^/]+\/qualify$/, 'company.handleQualifySalesLead', SALES_MANAGE),
  pattern('POST', /^\/sales\/leads\/[^/]+\/opportunity-draft$/, 'company.handleCreateOpportunityDraft', SALES_MANAGE),
  pattern('POST', /^\/sales\/opportunities\/[^/]+\/quote-draft$/, 'company.handleCreateQuoteDraft', SALES_MANAGE),
  pattern('POST', /^\/sales\/quotes\/[^/]+\/order-draft$/, 'company.handleCreateSalesOrderDraft', SALES_MANAGE),
  pattern('POST', /^\/sales\/orders\/[^/]+\/production-draft$/, 'company.handleCreateProductionDraft', SALES_MANAGE),
  pattern('POST', /^\/sales\/sync\/[^/]+\/[^/]+$/, 'company.handleSyncApprovedDraft', SALES_APPROVAL),
  pattern('POST', /^\/sales\/drafts\/[^/]+\/[^/]+\/approval$/, 'company.handleApproveDraft', SALES_APPROVAL)
]);

const text = (value) => String(value || '').trim();
const roleList = (value, fallback) => text(value || fallback)
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const decodePart = (value) => {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return '';
  }
};
const PUBLIC_ASSET_PREFIX = '/company-site/public/assets/';
const PUBLIC_ASSET_CONTENT_TYPES = Object.freeze({
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
});

function createCompanyHttpModule({
  companySiteHandlers,
  companySalesHandlers,
  getRequestPath,
  getBearerFromAuthHeader,
  verifyToken,
  asUser,
  readJsonBody,
  sendJson,
  hasTenantContext,
  now = () => Date.now(),
  env = process.env
}) {
  if (!companySiteHandlers || !companySalesHandlers) {
    throw new TypeError('Company HTTP module requires site and sales handlers');
  }

  const siteReadRoles = roleList(env.COMPANY_SITE_READ_ROLES, 'super_admin,admin,company_site_admin,site_admin,content_editor,content_reviewer,sales_manager,sales_owner,sales');
  const siteManageRoles = roleList(env.COMPANY_SITE_MANAGE_ROLES, 'super_admin,admin,company_site_admin,site_admin,content_reviewer');
  const salesRoles = roleList(env.COMPANY_SALES_ROLES, 'super_admin,admin,company_site_admin,site_admin,sales_manager,sales_owner,sales');
  const salesApprovalRoles = roleList(env.COMPANY_SALES_APPROVER_ROLES, 'super_admin,admin,company_site_admin,site_admin,sales_manager,production_manager,production_planner');
  const tenantContextGuard = typeof hasTenantContext === 'function'
    ? hasTenantContext
    : (user = {}) => Boolean(
      String(user.id || user.sub || user.username || '').trim()
      && String(user.tenant_id || user.tenantId || user.tenant || user.org_id || user.organization_id || '').trim()
      && String(user.token || '').trim()
    );
  const handoffs = new Map();
  const handoffTtlMs = Math.max(10_000, Number(env.COMPANY_AUTH_HANDOFF_TTL_MS) || 60_000);

  const pathname = (req) => getRequestPath(req);
  const partsAfter = (req, prefix) => pathname(req).slice(prefix.length).split('/').filter(Boolean).map(decodePart);
  const permissionAllows = (user, actions) => (user?.permissions || []).some((permission) => {
    const value = text(permission).toLowerCase();
    if (value === '*' || value === 'admin') return true;
    const scoped = value.includes('company_site') || value.includes('company-site') || value.includes('companysite') || value.includes('site_content');
    return scoped && actions.some((action) => value.includes(action));
  });
  const authorize = (req, res, roles, actions, requestKey, deniedMessage) => {
    const token = getBearerFromAuthHeader(req);
    const payload = verifyToken(token);
    if (!payload) {
      sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
      return false;
    }
    const user = asUser(payload, token);
    if (!tenantContextGuard(user)) {
      sendJson(res, 401, { code: 'HARNESS_AUTH_REQUIRED', message: 'Authenticated tenant context is required' });
      return false;
    }
    if (!roles.includes(text(user?.role).toLowerCase()) && !permissionAllows(user, actions)) {
      sendJson(res, 403, { code: 'FORBIDDEN', message: deniedMessage });
      return false;
    }
    req[requestKey] = user;
    return true;
  };
  const purgeHandoffs = () => {
    const current = now();
    for (const [code, entry] of handoffs.entries()) {
      if (entry.expiresAt <= current) handoffs.delete(code);
    }
  };
  const sendPublicAsset = (req, res) => {
    const assetRootInput = text(env.COMPANY_SITE_ASSET_ROOT);
    const rawSuffix = pathname(req).slice(PUBLIC_ASSET_PREFIX.length);
    const suffix = decodePart(rawSuffix);
    if (!assetRootInput || !suffix || suffix.includes('\\') || suffix.split('/').includes('..')) {
      sendJson(res, 404, { code: 'ASSET_NOT_FOUND', message: 'Public asset not found' }, { 'Cache-Control': 'no-store' });
      return;
    }
    const assetRoot = resolve(assetRootInput);
    const assetPath = resolve(assetRoot, suffix);
    const relativePath = relative(assetRoot, assetPath);
    if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
      sendJson(res, 404, { code: 'ASSET_NOT_FOUND', message: 'Public asset not found' }, { 'Cache-Control': 'no-store' });
      return;
    }
    try {
      const stats = lstatSync(assetPath);
      const contentType = PUBLIC_ASSET_CONTENT_TYPES[extname(assetPath).toLowerCase()];
      if (!stats.isFile() || stats.isSymbolicLink() || !contentType) throw new Error('Unsupported asset');
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(readFileSync(assetPath));
    } catch {
      sendJson(res, 404, { code: 'ASSET_NOT_FOUND', message: 'Public asset not found' }, { 'Cache-Control': 'no-store' });
    }
  };

  const handlers = {
    async handleCreateAuthHandoff(req, res) {
      const token = getBearerFromAuthHeader(req);
      const payload = verifyToken(token);
      const user = payload ? asUser(payload, token) : null;
      if (!payload) {
        sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' }, { 'Cache-Control': 'no-store' });
        return;
      }
      if (!tenantContextGuard(user)) {
        sendJson(res, 401, { code: 'HARNESS_AUTH_REQUIRED', message: 'Authenticated tenant context is required' }, { 'Cache-Control': 'no-store' });
        return;
      }
      purgeHandoffs();
      const code = crypto.randomBytes(32).toString('base64url');
      handoffs.set(code, { token, expiresAt: now() + handoffTtlMs });
      sendJson(res, 201, { code, expiresIn: Math.floor(handoffTtlMs / 1000) }, { 'Cache-Control': 'no-store' });
    },
    async handleConsumeAuthHandoff(req, res) {
      let body;
      try {
        body = await readJsonBody(req, 4 * 1024);
      } catch (error) {
        sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' }, { 'Cache-Control': 'no-store' });
        return;
      }
      const code = text(body?.code);
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(code)) {
        sendJson(res, 400, { code: 'INVALID_HANDOFF', message: 'Invalid login handoff code' }, { 'Cache-Control': 'no-store' });
        return;
      }
      purgeHandoffs();
      const entry = handoffs.get(code);
      handoffs.delete(code);
      const payload = entry && entry.expiresAt > now() ? verifyToken(entry.token) : null;
      const user = payload ? asUser(payload, entry.token) : null;
      if (!payload || !tenantContextGuard(user)) {
        sendJson(res, 410, { code: 'HANDOFF_EXPIRED', message: 'Login handoff has expired or was already used' }, { 'Cache-Control': 'no-store' });
        return;
      }
      sendJson(res, 200, { token: entry.token, app_role: payload.app_role || '', permissions: Array.isArray(payload.permissions) ? payload.permissions : [] }, { 'Cache-Control': 'no-store' });
    },
    handleGetPublicSiteConfig: (req, res) => companySiteHandlers.handleGetPublicSiteConfig(req, res),
    handleGetPublicAsset: (req, res) => sendPublicAsset(req, res),
    handleGetPublicPage: (req, res) => companySiteHandlers.handleGetPublicPage(req, res, partsAfter(req, '/company-site/public/pages/')[0]),
    handleGetPublicProducts: (req, res) => companySiteHandlers.handleGetPublicProducts(req, res),
    handleGetPublicProduct: (req, res) => companySiteHandlers.handleGetPublicProducts(req, res, partsAfter(req, '/company-site/public/products/')[0]),
    handleGetPublicSolutions: (req, res) => companySiteHandlers.handleGetPublicSolutions(req, res),
    handleGetPublicSolution: (req, res) => companySiteHandlers.handleGetPublicSolutions(req, res, partsAfter(req, '/company-site/public/solutions/')[0]),
    handleGetPublicCases: (req, res) => companySiteHandlers.handleGetPublicCases(req, res),
    handleGetPublicCase: (req, res) => companySiteHandlers.handleGetPublicCases(req, res, partsAfter(req, '/company-site/public/cases/')[0]),
    handleGetPublicFaq: (req, res) => companySiteHandlers.handleGetPublicFaq(req, res),
    handleGetPublicFaqItem: (req, res) => companySiteHandlers.handleGetPublicFaq(req, res, partsAfter(req, '/company-site/public/faq/')[0]),
    handleGetPublicSitemap: (req, res) => companySiteHandlers.handleGetPublicSitemap(req, res),
    handleCreatePublicLead: (req, res) => companySiteHandlers.handleCreatePublicLead(req, res),
    handleRecordPublicEvent: (req, res) => companySiteHandlers.handleRecordPublicEvent(req, res),
    handleGetAdminSiteConfig: (req, res) => companySiteHandlers.handleGetAdminSiteConfig(req, res),
    handleUpdateAdminSiteConfig: (req, res) => companySiteHandlers.handleUpdateAdminSiteConfig(req, res, req.companySiteUser),
    handlePublishContent: (req, res) => companySiteHandlers.handlePublishContent(req, res, req.companySiteUser),
    handleRollbackContent: (req, res) => companySiteHandlers.handleRollbackContent(req, res, req.companySiteUser),
    handleListContentRevisions: (req, res) => {
      const [objectType, objectId] = partsAfter(req, '/company-site/admin/content/');
      return companySiteHandlers.handleListContentRevisions(req, res, objectType, objectId);
    },
    handleSaveAdminContent: (req, res) => {
      const [objectType, objectId = ''] = partsAfter(req, '/company-site/admin/content/');
      return companySiteHandlers.handleSaveAdminContent(req, res, objectType, objectId, req.companySiteUser);
    },
    handleListAdminLeads: (req, res) => companySiteHandlers.handleListAdminLeads(req, res),
    handleRunSeoCheck: (req, res) => companySiteHandlers.handleRunSeoCheck(req, res, req.companySiteUser),
    handleListSeoChecks: (req, res) => companySiteHandlers.handleListSeoChecks(req, res),
    handleRecordGeoSnapshot: (req, res) => companySiteHandlers.handleRecordGeoSnapshot(req, res, req.companySiteUser),
    handleGenerateGeoSnapshots: (req, res) => companySiteHandlers.handleGenerateGeoSnapshots(req, res, req.companySiteUser),
    handleReviewGeoSnapshot: (req, res) => companySiteHandlers.handleReviewGeoSnapshot(
      req,
      res,
      partsAfter(req, '/company-site/admin/geo/snapshots/')[0],
      req.companySiteUser
    ),
    handleListGeoSnapshots: (req, res) => companySiteHandlers.handleListGeoSnapshots(req, res),
    handleListAdminContent: (req, res) => companySiteHandlers.handleListAdminContent(req, res, partsAfter(req, '/company-site/admin/')[0]),
    handleCreateSalesSession: (req, res) => companySalesHandlers.handleCreateSession(req, res),
    handleSendSalesMessage: (req, res) => companySalesHandlers.handleSendMessage(req, res, partsAfter(req, '/sales/sessions/')[0]),
    handleCreateSalesLead: (req, res) => companySalesHandlers.handleCreateLead(req, res, partsAfter(req, '/sales/sessions/')[0]),
    handleQualifySalesLead: (req, res) => companySalesHandlers.handleQualifyLead(req, res, partsAfter(req, '/sales/leads/')[0], req.companySalesUser),
    handleCreateOpportunityDraft: (req, res) => companySalesHandlers.handleCreateOpportunityDraft(req, res, partsAfter(req, '/sales/leads/')[0], req.companySalesUser),
    handleCreateQuoteDraft: (req, res) => companySalesHandlers.handleCreateQuoteDraft(req, res, partsAfter(req, '/sales/opportunities/')[0], req.companySalesUser),
    handleCreateSalesOrderDraft: (req, res) => companySalesHandlers.handleCreateSalesOrderDraft(req, res, partsAfter(req, '/sales/quotes/')[0], req.companySalesUser),
    handleCreateProductionDraft: (req, res) => companySalesHandlers.handleCreateProductionDraft(req, res, partsAfter(req, '/sales/orders/')[0], req.companySalesUser),
    handleSyncApprovedDraft: (req, res) => {
      const [objectType, objectId] = partsAfter(req, '/sales/sync/');
      return companySalesHandlers.handleSyncApprovedDraft(req, res, objectType, objectId, req.companySalesApprovalUser);
    },
    handleApproveDraft: (req, res) => {
      const [objectType, objectId] = partsAfter(req, '/sales/drafts/');
      return companySalesHandlers.handleApproveDraft(req, res, objectType, objectId, req.companySalesApprovalUser);
    }
  };

  return Object.freeze({
    routes: COMPANY_HTTP_ROUTE_MANIFEST,
    handlers: Object.freeze(handlers),
    authorizers: Object.freeze({
      [SITE_READ]: (req, res) => authorize(req, res, siteReadRoles, ['read', 'view', 'list', 'manage', 'admin'], 'companySiteUser', 'Company site admin access denied for current role'),
      [SITE_MANAGE]: (req, res) => authorize(req, res, siteManageRoles, ['write', 'publish', 'manage', 'admin'], 'companySiteUser', 'Company site manage access denied for current role'),
      [SALES_MANAGE]: (req, res) => authorize(req, res, salesRoles, ['sales', 'lead', 'opportunity', 'manage', 'admin'], 'companySalesUser', 'Sales Agent manage access denied for current role'),
      [SALES_APPROVAL]: (req, res) => authorize(req, res, salesApprovalRoles, ['approve', 'approval', 'sales_manager', 'production_manager'], 'companySalesApprovalUser', 'Sales Agent approval access denied for current role')
    })
  });
}

module.exports = { COMPANY_HTTP_ROUTE_MANIFEST, createCompanyHttpModule };
