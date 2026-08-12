import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCompanySiteHandlers } = require('../../realtime/company-site.js');

const siteRow = (overrides = {}) => ({
  site_key: 'primary',
  legal_name: '台州君乐缘体育用品有限公司',
  brand_name: '君乐缘台球',
  brand_short_name: '君乐缘',
  factory_name: '君乐缘台球工厂',
  domain: 'junleyuan.eissys.top',
  template_key: 'manufacturer-editorial-v1',
  default_locale: 'zh-CN',
  enabled_locales: ['zh-CN'],
  theme: { primaryColor: '#163b36' },
  contact: { email: 'sales@example.test' },
  social_links: [],
  trademark: { status: 'pending_confirmation' },
  settings: {},
  seo: { title: '君乐缘台球工厂' },
  status: 'published',
  published_version: 1,
  published_at: '2026-08-12T00:00:00.000Z',
  ...overrides
});

const request = ({ url = '/', body = {}, host = 'junleyuan.eissys.top', ip = '198.51.100.10' } = {}) => ({
  url,
  headers: { host, 'idempotency-key': body.idempotencyKey || '' },
  socket: { remoteAddress: ip },
  body
});

const response = () => ({
  statusCode: 0,
  headers: {},
  payload: null,
  writeHead(status, headers) {
    this.statusCode = status;
    this.headers = headers || {};
  },
  end(body) {
    this.payload = body;
  }
});

const createHarness = ({ query, now } = {}) => {
  const calls = [];
  const handler = createCompanySiteHandlers({
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params });
      return query ? query(String(sql), params, calls) : { rows: [] };
    },
    sendJson: (res, status, payload, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
      res.end(JSON.stringify(payload));
    },
    sendText: (res, status, payload, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      res.end(String(payload));
    },
    readJsonBody: async (req) => req.body || {},
    now: now || (() => new Date('2026-08-12T12:00:00.000Z'))
  });
  return { handler, calls };
};

const readPayload = (res) => JSON.parse(String(res.payload || '{}'));

async function testPublishedSiteOnly() {
  const { handler, calls } = createHarness({
    query: (sql) => {
      if (sql.includes('FROM company_site.site_config')) return { rows: [siteRow()] };
      if (sql.includes('FROM company_site.site_locales')) return { rows: [{ locale: 'zh-CN', status: 'published' }] };
      if (sql.includes('FROM company_site.content_pages')) {
        return {
          rows: [{ id: 'page-1', locale: 'zh-CN', slug: 'home', page_type: 'home', title: '首页', status: 'published', version: 3 }]
        };
      }
      if (sql.includes('FROM company_site.products')) return { rows: [] };
      if (sql.includes('FROM company_site.solutions')) return { rows: [] };
      if (sql.includes('FROM company_site.cases')) return { rows: [] };
      if (sql.includes('FROM company_site.knowledge_documents')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    }
  });
  const res = response();
  await handler.handleGetPublicSiteConfig(request({ url: '/company-site/public/site-config?locale=zh-CN' }), res);
  assert.equal(res.statusCode, 200);
  const payload = readPayload(res);
  assert.equal(payload.site.siteKey, 'primary');
  assert.equal(payload.content.pages[0].status, 'published');
  assert.match(calls.find((call) => call.sql.includes('FROM company_site.content_pages')).sql, /status = 'published'/);

  const unpublishedHarness = createHarness({
    query: (sql) => sql.includes('FROM company_site.site_config') ? { rows: [] } : { rows: [] }
  });
  const unpublishedRes = response();
  await unpublishedHarness.handler.handleGetPublicSiteConfig(request(), unpublishedRes);
  assert.equal(unpublishedRes.statusCode, 404);
  assert.equal(readPayload(unpublishedRes).code, 'SITE_NOT_FOUND');
}

async function testPublicProductsAndSitemap() {
  const { handler } = createHarness({
    query: (sql) => {
      if (sql.includes('FROM company_site.site_config')) return { rows: [siteRow()] };
      if (sql.includes('FROM company_site.products p')) {
        return {
          rows: [{
            id: 'product-1', product_code: 'JL-001', slug: 'maple-cue', category: '台球杆',
            applications: ['俱乐部'], specifications: { material: '枫木' }, delivery: { leadTime: '待确认' },
            locale: 'zh-CN', name: '枫木台球杆', summary: '已发布产品', description: '产品说明',
            image_urls: [], product_seo: { title: '枫木台球杆' }, faq: []
          }]
        };
      }
      if (sql.includes('SELECT slug, locale')) return { rows: [{ slug: 'about', locale: 'zh-CN' }] };
      if (sql.includes('SELECT slug') && sql.includes('FROM company_site.products')) return { rows: [{ slug: 'maple-cue' }] };
      if (sql.includes('FROM company_site.solutions')) return { rows: [] };
      if (sql.includes('FROM company_site.cases')) return { rows: [] };
      if (sql.includes('FROM company_site.knowledge_documents')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    }
  });
  const productsRes = response();
  await handler.handleGetPublicProducts(request({ url: '/company-site/public/products?locale=zh-CN' }), productsRes);
  assert.equal(productsRes.statusCode, 200);
  assert.equal(readPayload(productsRes).items[0].slug, 'maple-cue');

  const sitemapRes = response();
  await handler.handleGetPublicSitemap(request({ url: '/company-site/public/sitemap.xml' }), sitemapRes);
  assert.equal(sitemapRes.statusCode, 200);
  assert.equal(sitemapRes.headers['Content-Type'], 'application/xml; charset=utf-8');
  assert.match(String(sitemapRes.payload), /https:\/\/junleyuan\.eissys\.top\/company\/products\/maple-cue/);
}

async function testPublicPagesSolutionsCasesAndFaq() {
  const { handler } = createHarness({
    query: (sql) => {
      if (sql.includes('FROM company_site.site_config')) return { rows: [siteRow()] };
      if (sql.includes('FROM company_site.content_pages')) {
        return { rows: [{ id: 'about-1', locale: 'zh-CN', slug: 'about', page_type: 'about', title: '关于企业', summary: '公开介绍', blocks: {}, seo: {}, status: 'published', version: 2 }] };
      }
      if (sql.includes('FROM company_site.solutions')) {
        return { rows: [{ id: 'solution-1', locale: 'zh-CN', slug: 'club-project', title: '俱乐部项目配套', industry: '台球俱乐部', scenario: '项目采购', content: { description: '采购清单' }, seo: {}, status: 'published' }] };
      }
      if (sql.includes('FROM company_site.cases')) {
        return { rows: [{ id: 'case-1', locale: 'zh-CN', slug: 'factory-field-record', title: '工厂现场', industry: '制造现场', scope: '现场资料', content: {}, public_level: 'anonymous', status: 'published' }] };
      }
      if (sql.includes('FROM company_site.knowledge_documents')) {
        return { rows: [{ id: 'faq-1', locale: 'zh-CN', document_type: 'faq', title: 'FAQ', content: '标准回答', citations: [], status: 'published', version: 1, updated_at: '2026-08-12T00:00:00.000Z' }] };
      }
      throw new Error(`unexpected public content query: ${sql}`);
    }
  });

  const pageRes = response();
  await handler.handleGetPublicPage(request({ url: '/company-site/public/pages/about?locale=zh-CN' }), pageRes, 'about');
  assert.equal(pageRes.statusCode, 200);
  assert.equal(readPayload(pageRes).page.slug, 'about');

  const solutionsRes = response();
  await handler.handleGetPublicSolutions(request({ url: '/company-site/public/solutions?locale=zh-CN' }), solutionsRes);
  assert.equal(solutionsRes.statusCode, 200);
  assert.equal(readPayload(solutionsRes).items[0].slug, 'club-project');

  const casesRes = response();
  await handler.handleGetPublicCases(request({ url: '/company-site/public/cases?locale=zh-CN' }), casesRes);
  assert.equal(casesRes.statusCode, 200);
  assert.equal(readPayload(casesRes).items[0].publicLevel, 'anonymous');

  const faqRes = response();
  await handler.handleGetPublicFaq(request({ url: '/company-site/public/faq?locale=zh-CN' }), faqRes);
  assert.equal(faqRes.statusCode, 200);
  assert.equal(readPayload(faqRes).items[0].documentType, 'faq');
}

async function testLeadValidationAndIdempotency() {
  const invalidHarness = createHarness({
    query: () => { throw new Error('validation should not query the database'); }
  });
  const consentRes = response();
  await invalidHarness.handler.handleCreatePublicLead(request({ body: { companyName: '采购方', email: 'buyer@example.test' } }), consentRes);
  assert.equal(consentRes.statusCode, 400);
  assert.equal(readPayload(consentRes).code, 'CONSENT_REQUIRED');

  const contactRes = response();
  await invalidHarness.handler.handleCreatePublicLead(request({ body: { companyName: '采购方', consent: true } }), contactRes);
  assert.equal(contactRes.statusCode, 400);
  assert.equal(readPayload(contactRes).code, 'CONTACT_REQUIRED');

  const { handler, calls } = createHarness({
    query: (sql) => {
      if (sql.includes('FROM company_site.site_config')) return { rows: [siteRow()] };
      if (sql.includes('SELECT id, public_ref, status')) return { rows: [{ id: 'lead-1', public_ref: 'INQ-OLD', status: 'new' }] };
      throw new Error(`duplicate request must stop before insert: ${sql}`);
    }
  });
  const duplicateRes = response();
  await handler.handleCreatePublicLead(request({
    body: {
      idempotencyKey: 'lead-repeat-1', companyName: '采购方', contactName: '采购联系人',
      email: 'buyer@example.test', consent: { accepted: true }
    }
  }), duplicateRes);
  assert.equal(duplicateRes.statusCode, 200);
  assert.equal(readPayload(duplicateRes).deduplicated, true);
  assert.equal(calls.filter((call) => call.sql.includes('INSERT INTO company_site.leads')).length, 0);
}

async function testEventAllowList() {
  const { handler, calls } = createHarness({
    query: (sql) => sql.includes('FROM company_site.site_config') ? { rows: [siteRow()] } : { rows: [] }
  });
  const deniedRes = response();
  await handler.handleRecordPublicEvent(request({ body: { eventName: 'internal_customer_export' } }), deniedRes);
  assert.equal(deniedRes.statusCode, 400);
  assert.equal(readPayload(deniedRes).code, 'EVENT_NOT_ALLOWED');

  const allowedRes = response();
  await handler.handleRecordPublicEvent(request({ body: { eventName: 'product_view', pagePath: '/company/products/maple-cue' } }), allowedRes);
  assert.equal(allowedRes.statusCode, 202);
  assert.equal(calls.filter((call) => call.sql.includes('INSERT INTO company_site.lead_events')).length, 1);
}

async function testPublishScopesProductLocaleToParentSite() {
  const { handler, calls } = createHarness({
    query: (sql) => {
      if (sql.includes('UPDATE company_site.product_locales')) {
        assert.match(sql, /EXISTS \(/);
        assert.match(sql, /p\.site_key = \$3/);
        assert.doesNotMatch(sql, /pl\.site_key/);
        return { rows: [{ id: 'locale-1', status: 'published', updated_at: '2026-08-12T12:00:00.000Z' }] };
      }
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      throw new Error(`unexpected publish query: ${sql}`);
    }
  });
  const res = response();
  await handler.handlePublishContent(request({ body: { objectType: 'product_locale', id: 'locale-1', status: 'published' } }), res, { id: 'reviewer-1' });
  assert.equal(res.statusCode, 200);
  assert.equal(readPayload(res).item.status, 'published');
  const updateCall = calls.find((call) => call.sql.includes('UPDATE company_site.product_locales'));
  assert.deepEqual(updateCall.params, ['published', 'locale-1', 'primary']);
}

async function testPublishRegularPageKeepsSiteScopeAndAudit() {
  const { handler, calls } = createHarness({
    query: (sql) => {
      if (sql.includes('UPDATE company_site.content_pages')) return { rows: [{ id: 'page-1', status: 'published', updated_at: '2026-08-12T12:00:00.000Z' }] };
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      throw new Error(`unexpected publish query: ${sql}`);
    }
  });
  const res = response();
  await handler.handlePublishContent(request({ body: { objectType: 'page', id: 'page-1', status: 'published' } }), res, { id: 'reviewer-1' });
  assert.equal(res.statusCode, 200);
  const updateCall = calls.find((call) => call.sql.includes('UPDATE company_site.content_pages'));
  assert.match(updateCall.sql, /WHERE id = \$2 AND site_key = \$3/);
  assert.deepEqual(updateCall.params, ['published', 'page-1', 'primary', 'reviewer-1']);
  assert.equal(calls.filter((call) => call.sql.includes('INSERT INTO company_site.audit_events')).length, 1);
}

async function testAdminConfigContentAndSitePublish() {
  const { handler } = createHarness({
    query: (sql) => {
      if (sql.includes('UPDATE company_site.site_config') && sql.includes('RETURNING *')) return { rows: [siteRow({ status: 'draft', published_version: 1 })] };
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      if (sql.includes('FROM company_site.seo_metadata')) return { rows: [{ id: 'seo-1', site_key: 'primary', path: '/company/', status: 'published' }] };
      throw new Error(`unexpected admin config query: ${sql}`);
    }
  });
  const updateRes = response();
  await handler.handleUpdateAdminSiteConfig(request({ body: { brandName: '配置品牌', theme: { primaryColor: '#111111' } } }), updateRes, { id: 'admin-1' });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(readPayload(updateRes).status, 'draft');

  const seoRes = response();
  await handler.handleListAdminContent(request({ url: '/company-site/admin/seo?limit=10' }), seoRes, 'seo');
  assert.equal(seoRes.statusCode, 200);
  assert.equal(readPayload(seoRes).items[0].path, '/company/');

  const publishHarness = createHarness({
    query: (sql) => {
      if (sql.includes('UPDATE company_site.site_config') && sql.includes('published_version')) return { rows: [{ site_key: 'primary', status: 'published', published_version: 2 }] };
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      throw new Error(`unexpected site publish query: ${sql}`);
    }
  });
  const publishRes = response();
  await publishHarness.handler.handlePublishContent(request({ body: { objectType: 'site_config', id: 'primary', status: 'published' } }), publishRes, { id: 'reviewer-1' });
  assert.equal(publishRes.statusCode, 200);
  assert.equal(readPayload(publishRes).item.status, 'published');
}

async function testAdminContentSaveRevisionAndRollback() {
  const page = {
    id: 'page-1', site_key: 'primary', locale: 'zh-CN', slug: 'about', page_type: 'about',
    title: '关于企业', summary: '介绍', blocks: [], seo: {}, status: 'draft', version: 1
  };
  const createHarnessForPage = createHarness({
    query: (sql) => {
      if (sql.includes('INSERT INTO company_site.content_pages')) return { rows: [page] };
      if (sql.includes('INSERT INTO company_site.content_revisions')) return { rows: [] };
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      throw new Error(`unexpected content create query: ${sql}`);
    }
  });
  const createRes = response();
  await createHarnessForPage.handler.handleSaveAdminContent(request({ body: {
    locale: 'zh-CN', slug: 'about', pageType: 'about', title: '关于企业', summary: '介绍', blocks: []
  } }), createRes, 'page', '', { id: 'editor-1' });
  assert.equal(createRes.statusCode, 201);
  assert.equal(readPayload(createRes).status, 'draft');
  assert.equal(createHarnessForPage.calls.filter((call) => call.sql.includes('INSERT INTO company_site.content_revisions')).length, 1);

  const updated = { ...page, title: '关于君乐缘', version: 2 };
  const updateHarness = createHarness({
    query: (sql) => {
      if (sql.includes('SELECT * FROM company_site.content_pages')) return { rows: [page] };
      if (sql.includes('UPDATE company_site.content_pages')) return { rows: [updated] };
      if (sql.includes('INSERT INTO company_site.content_revisions')) return { rows: [] };
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      throw new Error(`unexpected content update query: ${sql}`);
    }
  });
  const updateRes = response();
  await updateHarness.handler.handleSaveAdminContent(request({ body: { title: '关于君乐缘' } }), updateRes, 'page', 'page-1', { id: 'editor-1' });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(readPayload(updateRes).item.title, '关于君乐缘');
  assert.equal(updateHarness.calls.filter((call) => call.sql.includes('INSERT INTO company_site.content_revisions')).length, 2);

  const rollbackHarness = createHarness({
    query: (sql) => {
      if (sql.includes('SELECT snapshot FROM company_site.content_revisions')) return { rows: [{ snapshot: page }] };
      if (sql.includes('SELECT * FROM company_site.content_pages')) return { rows: [updated] };
      if (sql.includes('UPDATE company_site.content_pages')) return { rows: [{ ...updated, title: '关于企业', version: 3, status: 'draft' }] };
      if (sql.includes('INSERT INTO company_site.content_revisions')) return { rows: [] };
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      throw new Error(`unexpected content rollback query: ${sql}`);
    }
  });
  const rollbackRes = response();
  await rollbackHarness.handler.handleRollbackContent(request({ body: { objectType: 'page', objectId: 'page-1', version: 1 } }), rollbackRes, { id: 'reviewer-1' });
  assert.equal(rollbackRes.statusCode, 200);
  assert.equal(readPayload(rollbackRes).status, 'draft');
  assert.equal(readPayload(rollbackRes).rolledBackFrom, 1);
}

async function testSeoCheckAndGeoSnapshotOperations() {
  const { handler, calls } = createHarness({
    query: (sql) => {
      if (sql.includes('FROM company_site.site_config')) return { rows: [siteRow()] };
      if (sql.includes('FROM company_site.seo_metadata')) return { rows: [{ locale: 'zh-CN', path: '/company/', title: '', description: '', canonical: '', robots: 'index,follow' }] };
      if (sql.includes('FROM company_site.content_pages')) return { rows: [{ locale: 'zh-CN', slug: 'about', title: '关于企业', metadata_path: null }] };
      if (sql.includes('INSERT INTO company_site.seo_checks')) return { rows: [] };
      if (sql.includes('INSERT INTO company_site.geo_answer_snapshots')) return { rows: [{ id: 'geo-1', platform: 'deepseek', accuracy_status: 'pending' }] };
      if (sql.includes('SELECT id, run_id, path')) return { rows: [{ id: 'check-1', severity: 'warning' }] };
      if (sql.includes('SELECT id, locale, platform')) return { rows: [{ id: 'geo-1', platform: 'deepseek', accuracy_status: 'pending' }] };
      if (sql.includes('INSERT INTO company_site.audit_events')) return { rows: [] };
      throw new Error(`unexpected SEO/GEO query: ${sql}`);
    }
  });
  const seoRes = response();
  await handler.handleRunSeoCheck(request(), seoRes, { id: 'seo-operator' });
  assert.equal(seoRes.statusCode, 201);
  assert.ok(readPayload(seoRes).count >= 3);
  assert.ok(calls.filter((call) => call.sql.includes('INSERT INTO company_site.seo_checks')).length >= 3);

  const checksRes = response();
  await handler.handleListSeoChecks(request({ url: '/company-site/admin/seo/checks?limit=10' }), checksRes);
  assert.equal(checksRes.statusCode, 200);
  assert.equal(readPayload(checksRes).items[0].id, 'check-1');

  const geoRes = response();
  await handler.handleRecordGeoSnapshot(request({ body: {
    platform: 'deepseek', locale: 'zh-CN', question: '君乐缘是谁？', answer: '待核验', citations: [], accuracyStatus: 'pending'
  } }), geoRes, { id: 'seo-operator' });
  assert.equal(geoRes.statusCode, 201);
  assert.equal(readPayload(geoRes).snapshot.id, 'geo-1');

  const geoListRes = response();
  await handler.handleListGeoSnapshots(request({ url: '/company-site/admin/geo/snapshots?limit=10' }), geoListRes);
  assert.equal(geoListRes.statusCode, 200);
  assert.equal(readPayload(geoListRes).items[0].platform, 'deepseek');
}

await testPublishedSiteOnly();
await testPublicProductsAndSitemap();
await testPublicPagesSolutionsCasesAndFaq();
await testLeadValidationAndIdempotency();
await testEventAllowList();
await testPublishScopesProductLocaleToParentSite();
await testPublishRegularPageKeepsSiteScopeAndAudit();
await testAdminConfigContentAndSitePublish();
await testAdminContentSaveRevisionAndRollback();
await testSeoCheckAndGeoSnapshotOperations();

console.log('company-site-handlers-regression: PASS');
