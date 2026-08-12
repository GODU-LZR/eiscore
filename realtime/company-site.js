// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const crypto = require('crypto');

const SITE_KEY = 'primary';
const MAX_LEAD_TEXT = 500;
const MAX_EVENT_PAYLOAD_BYTES = 12 * 1024;
const PUBLIC_EVENTS = new Set([
  'page_view',
  'product_view',
  'cta_contact_click',
  'whatsapp_click',
  'email_click',
  'phone_click',
  'download_click',
  'sample_request_start',
  'language_switch',
  'login_click',
  'cta_primary',
  'cta_secondary',
  'cta_product_contact',
  'solution_contact',
  'external_channel_click',
  'lead_submit_success',
  'lead_submit_failure'
]);

const text = (value, max = MAX_LEAD_TEXT) => String(value ?? '').trim().slice(0, max);

const safeLocale = (value, fallback = 'zh-CN') => {
  const candidate = text(value, 32).replace(/_/g, '-');
  return /^[a-z]{2,3}(?:-(?:[A-Z][a-z]{1,3}|[A-Z]{2,3}))?$/.test(candidate) ? candidate : fallback;
};

const safeSlug = (value) => {
  const candidate = text(value, 160).replace(/^\/+|\/+$/g, '');
  if (!candidate || candidate.includes('..')) return '';
  return candidate;
};

const safeJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value;
  return fallback;
};

const jsonBytes = (value) => {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const normalizeHost = (value) => text(value, 255).split(',')[0].trim().split(':')[0].toLowerCase();

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const hashValue = (value) => crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');

const parseJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const firstRow = (result) => (Array.isArray(result?.rows) ? result.rows[0] || null : null);

const rows = (result) => (Array.isArray(result?.rows) ? result.rows : []);

const mapSite = (row) => ({
  siteKey: SITE_KEY,
  domain: text(row?.domain, 255),
  legalName: text(row?.legal_name, 200),
  brandName: text(row?.brand_name, 120),
  brandShortName: text(row?.brand_short_name, 120),
  factoryName: text(row?.factory_name, 120),
  template: text(row?.template_key, 120),
  defaultLocale: safeLocale(row?.default_locale),
  enabledLocales: Array.isArray(row?.enabled_locales)
    ? row.enabled_locales.map((item) => safeLocale(item)).filter(Boolean)
    : ['zh-CN'],
  theme: safeJson(row?.theme),
  contact: safeJson(row?.contact),
  socialLinks: Array.isArray(row?.social_links) ? row.social_links : [],
  trademark: safeJson(row?.trademark),
  settings: safeJson(row?.settings),
  seo: safeJson(row?.seo),
  status: text(row?.status, 32),
  publishedVersion: Number(row?.published_version || 0),
  publishedAt: row?.published_at || null
});

const mapPage = (row) => ({
  id: row?.id || '',
  locale: safeLocale(row?.locale),
  slug: safeSlug(row?.slug),
  pageType: text(row?.page_type, 64),
  title: text(row?.title, 240),
  summary: text(row?.summary, 1200),
  blocks: Array.isArray(row?.blocks) ? row.blocks : safeJson(row?.blocks, {}),
  seo: safeJson(row?.seo),
  status: text(row?.status, 32),
  version: Number(row?.version || 1),
  publishedAt: row?.published_at || null
});

const mapProduct = (row) => ({
  id: row?.id || '',
  productCode: text(row?.product_code, 100),
  slug: safeSlug(row?.slug),
  category: text(row?.category, 120),
  applications: Array.isArray(row?.applications) ? row.applications : [],
  specifications: safeJson(row?.specifications),
  delivery: safeJson(row?.delivery),
  locale: safeLocale(row?.locale),
  name: text(row?.name, 240),
  summary: text(row?.summary, 1200),
  description: text(row?.description, 6000),
  imageUrls: Array.isArray(row?.image_urls) ? row.image_urls : [],
  seo: safeJson(row?.product_seo || row?.seo),
  faq: Array.isArray(row?.faq) ? row.faq : []
});

const mapSolution = (row) => ({
  id: row?.id || '',
  locale: safeLocale(row?.locale),
  slug: safeSlug(row?.slug),
  title: text(row?.title, 240),
  industry: text(row?.industry, 160),
  scenario: text(row?.scenario, 800),
  content: safeJson(row?.content),
  seo: safeJson(row?.seo),
  status: text(row?.status, 32)
});

const mapCase = (row) => ({
  id: row?.id || '',
  locale: safeLocale(row?.locale),
  slug: safeSlug(row?.slug),
  title: text(row?.title, 240),
  industry: text(row?.industry, 160),
  scope: text(row?.scope, 1200),
  deliveryDate: row?.delivery_date || null,
  content: safeJson(row?.content),
  publicLevel: text(row?.public_level, 32),
  status: text(row?.status, 32)
});

const mapFaq = (row) => ({
  id: row?.id || '',
  locale: safeLocale(row?.locale),
  documentType: text(row?.document_type, 64),
  title: text(row?.title, 240),
  content: text(row?.content, 8000),
  citations: Array.isArray(row?.citations) ? row.citations : [],
  status: text(row?.status, 32),
  version: Number(row?.version || 1),
  updatedAt: row?.updated_at || null
});

const ADMIN_CONTENT_DEFINITIONS = {
  page: {
    table: 'content_pages',
    fields: [
      ['locale', 'locale', 'locale'], ['slug', 'slug', 'slug'], ['pageType', 'page_type', 'text'],
      ['title', 'title', 'text'], ['summary', 'summary', 'text'], ['blocks', 'blocks', 'json'], ['seo', 'seo', 'json']
    ],
    required: ['locale', 'slug', 'title']
  },
  product: {
    table: 'products',
    fields: [
      ['productCode', 'product_code', 'text'], ['slug', 'slug', 'slug'], ['category', 'category', 'text'],
      ['applications', 'applications', 'json'], ['specifications', 'specifications', 'json'],
      ['delivery', 'delivery', 'json'], ['evidenceIds', 'evidence_ids', 'json']
    ],
    required: ['productCode', 'slug']
  },
  product_locale: {
    table: 'product_locales',
    fields: [
      ['productId', 'product_id', 'id'], ['locale', 'locale', 'locale'], ['name', 'name', 'text'],
      ['summary', 'summary', 'text'], ['description', 'description', 'text'], ['imageUrls', 'image_urls', 'json'],
      ['seo', 'seo', 'json'], ['faq', 'faq', 'json']
    ],
    required: ['productId', 'locale', 'name']
  },
  solution: {
    table: 'solutions',
    fields: [
      ['locale', 'locale', 'locale'], ['slug', 'slug', 'slug'], ['title', 'title', 'text'],
      ['industry', 'industry', 'text'], ['scenario', 'scenario', 'text'], ['content', 'content', 'json'], ['seo', 'seo', 'json']
    ],
    required: ['locale', 'slug', 'title']
  },
  case: {
    table: 'cases',
    fields: [
      ['locale', 'locale', 'locale'], ['slug', 'slug', 'slug'], ['title', 'title', 'text'],
      ['industry', 'industry', 'text'], ['scope', 'scope', 'text'], ['deliveryDate', 'delivery_date', 'date'],
      ['content', 'content', 'json'], ['evidenceIds', 'evidence_ids', 'json'], ['publicLevel', 'public_level', 'text']
    ],
    required: ['locale', 'slug', 'title']
  },
  evidence: {
    table: 'evidence_records',
    fields: [
      ['claim', 'claim', 'text'], ['sourceType', 'source_type', 'text'], ['sourceRef', 'source_ref', 'text'],
      ['evidence', 'evidence', 'json'], ['verifiedBy', 'verified_by', 'text'], ['verifiedAt', 'verified_at', 'dateTime'],
      ['expiresAt', 'expires_at', 'dateTime']
    ],
    required: ['claim']
  },
  knowledge: {
    table: 'knowledge_documents',
    fields: [
      ['locale', 'locale', 'locale'], ['documentType', 'document_type', 'text'], ['title', 'title', 'text'],
      ['content', 'content', 'textLong'], ['citations', 'citations', 'json'], ['forbiddenClaims', 'forbidden_claims', 'json'],
      ['effectiveFrom', 'effective_from', 'dateTime'], ['expiresAt', 'expires_at', 'dateTime']
    ],
    required: ['locale', 'title', 'content']
  },
  seo: {
    table: 'seo_metadata',
    fields: [
      ['locale', 'locale', 'locale'], ['path', 'path', 'path'], ['title', 'title', 'text'],
      ['description', 'description', 'textLong'], ['canonical', 'canonical', 'path'], ['robots', 'robots', 'text'],
      ['keywords', 'keywords', 'json'], ['structuredData', 'structured_data', 'json']
    ],
    required: ['locale', 'path', 'title']
  }
};

const getLocaleCandidates = (requested, fallback) => {
  const out = [];
  [safeLocale(requested, ''), safeLocale(fallback, '')].forEach((value) => {
    if (value && !out.includes(value)) out.push(value);
  });
  if (!out.length) out.push('zh-CN');
  return out;
};

function createCompanySiteHandlers({ query, sendJson, sendText, readJsonBody, now = () => new Date() }) {
  if (typeof query !== 'function') throw new Error('company-site query function is required');
  if (typeof sendJson !== 'function') throw new Error('company-site sendJson function is required');
  if (typeof readJsonBody !== 'function') throw new Error('company-site readJsonBody function is required');

  const rateBuckets = new Map();

  const readUrl = (req) => new URL(req?.url || '/', 'http://company-site.local');

  const loadPublishedSite = async (req, { allowDraft = false } = {}) => {
    const url = readUrl(req);
    const requestedDomain = normalizeHost(
      url.searchParams.get('domain') || req?.headers?.host || ''
    );
    const statusSql = allowDraft ? "c.status <> 'archived'" : "c.status = 'published'";
    const result = await query(
      `SELECT c.site_key, c.legal_name, c.brand_name, c.brand_short_name,
              c.factory_name, c.domain, c.template_key, c.default_locale,
              c.enabled_locales, c.theme, c.contact, c.social_links,
              c.trademark, c.settings, c.seo, c.status,
              c.published_version, c.published_at
         FROM company_site.site_config c
        WHERE c.site_key = $1
          AND ${statusSql}
          AND ($2 = '' OR lower(c.domain) = lower($2))
        LIMIT 1`,
      [SITE_KEY, requestedDomain]
    );
    return firstRow(result);
  };

  const loadPublicContent = async (site, requestedLocale) => {
    const localeCandidates = getLocaleCandidates(requestedLocale, site.default_locale);
    const [localeResult, pageResult, productResult, solutionResult, caseResult, faqResult] = await Promise.all([
      query(
        `SELECT locale, fallback_locale, status, translation_owner
           FROM company_site.site_locales
          WHERE site_key = $1
            AND status = 'published'
            AND locale = ANY($2::text[])
          ORDER BY array_position($2::text[], locale)`,
        [SITE_KEY, localeCandidates]
      ),
      query(
        `SELECT id, locale, slug, page_type, title, summary, blocks, seo,
                status, version, published_at
           FROM company_site.content_pages
          WHERE site_key = $1
            AND status = 'published'
            AND locale = ANY($2::text[])
          ORDER BY array_position($2::text[], locale), slug`,
        [SITE_KEY, localeCandidates]
      ),
      query(
        `SELECT p.id, p.product_code, p.slug, p.category, p.applications,
                p.specifications, p.delivery, pl.locale, pl.name,
                pl.summary, pl.description, pl.image_urls, pl.seo AS product_seo,
                pl.faq
           FROM company_site.products p
           JOIN company_site.product_locales pl
             ON pl.product_id = p.id
            AND pl.status = 'published'
            AND pl.locale = ANY($2::text[])
          WHERE p.site_key = $1
            AND p.status = 'published'
          ORDER BY array_position($2::text[], pl.locale), p.product_code`,
        [SITE_KEY, localeCandidates]
      ),
      query(
        `SELECT id, locale, slug, title, industry, scenario, content, seo, status
           FROM company_site.solutions
          WHERE site_key = $1
            AND status = 'published'
            AND locale = ANY($2::text[])
          ORDER BY array_position($2::text[], locale), slug`,
        [SITE_KEY, localeCandidates]
      ),
      query(
        `SELECT id, locale, slug, title, industry, scope, delivery_date,
                content, public_level, status
           FROM company_site.cases
          WHERE site_key = $1
            AND status = 'published'
            AND public_level <> 'internal'
            AND locale = ANY($2::text[])
          ORDER BY array_position($2::text[], locale), slug`,
        [SITE_KEY, localeCandidates]
      ),
      query(
        `SELECT id, locale, document_type, title, content, citations,
                status, version, updated_at
           FROM company_site.knowledge_documents
          WHERE site_key = $1
            AND status = 'published'
            AND document_type = 'faq'
            AND locale = ANY($2::text[])
          ORDER BY array_position($2::text[], locale), title`,
        [SITE_KEY, localeCandidates]
      )
    ]);

    const pickByKey = (items, keyOf) => {
      const picked = new Map();
      for (const item of items) {
        const key = keyOf(item);
        if (!picked.has(key)) picked.set(key, item);
      }
      return [...picked.values()];
    };

    return {
      requestedLocale: localeCandidates[0],
      locales: rows(localeResult),
      pages: pickByKey(rows(pageResult), (item) => `${item.slug}`).map(mapPage),
      products: pickByKey(rows(productResult), (item) => `${item.slug}`).map(mapProduct),
      solutions: pickByKey(rows(solutionResult), (item) => `${item.slug}`).map(mapSolution),
      cases: pickByKey(rows(caseResult), (item) => `${item.slug}`).map(mapCase),
      faq: rows(faqResult).map(mapFaq)
    };
  };

  const getPublicSiteConfig = async (req, res) => {
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Published site configuration was not found' });
        return;
      }
      const url = readUrl(req);
      const content = await loadPublicContent(site, url.searchParams.get('locale'));
      sendJson(res, 200, {
        ok: true,
        site: mapSite(site),
        content
      });
    } catch (error) {
      sendJson(res, 503, { code: 'SITE_CONFIG_UNAVAILABLE', message: 'Site configuration is temporarily unavailable' });
    }
  };

  const getPublicPage = async (req, res, pageSlug = '') => {
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Published site configuration was not found' });
        return;
      }
      const url = readUrl(req);
      const locales = getLocaleCandidates(url.searchParams.get('locale'), site.default_locale);
      const result = await query(
        `SELECT id, locale, slug, page_type, title, summary, blocks, seo,
                status, version, published_at
           FROM company_site.content_pages
          WHERE site_key = $1
            AND status = 'published'
            AND slug = $2
            AND locale = ANY($3::text[])
          ORDER BY array_position($3::text[], locale)
          LIMIT 1`,
        [SITE_KEY, safeSlug(pageSlug), locales]
      );
      const page = firstRow(result);
      if (!page) {
        sendJson(res, 404, { code: 'PAGE_NOT_FOUND', message: 'Published page was not found' });
        return;
      }
      sendJson(res, 200, { ok: true, site: mapSite(site), page: mapPage(page) });
    } catch {
      sendJson(res, 503, { code: 'PAGE_UNAVAILABLE', message: 'Page is temporarily unavailable' });
    }
  };

  const getPublicCollection = async (req, res, type, slug = '') => {
    const definitions = {
      solution: {
        table: 'solutions',
        columns: 'id, locale, slug, title, industry, scenario, content, seo, status',
        mapper: mapSolution,
        pathCode: 'SOLUTION_NOT_FOUND'
      },
      case: {
        table: 'cases',
        columns: 'id, locale, slug, title, industry, scope, delivery_date, content, public_level, status',
        mapper: mapCase,
        pathCode: 'CASE_NOT_FOUND'
      },
      faq: {
        table: 'knowledge_documents',
        columns: 'id, locale, document_type, title, content, citations, status, version, updated_at',
        mapper: mapFaq,
        pathCode: 'FAQ_NOT_FOUND'
      }
    };
    const definition = definitions[type];
    if (!definition) {
      sendJson(res, 404, { code: 'CONTENT_NOT_FOUND', message: 'Public content type was not found' });
      return;
    }
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Published site configuration was not found' });
        return;
      }
      const url = readUrl(req);
      const locales = getLocaleCandidates(url.searchParams.get('locale'), site.default_locale);
      const params = [SITE_KEY, locales];
      const keyColumn = type === 'faq' ? 'id' : 'slug';
      const conditions = [
        `site_key = $1`,
        `status = 'published'`,
        `locale = ANY($2::text[])`
      ];
      if (type === 'case') conditions.push(`public_level <> 'internal'`);
      if (type === 'faq') conditions.push(`document_type = 'faq'`);
      if (slug) {
        params.push(safeSlug(slug));
        conditions.push(`${keyColumn} = $3`);
      }
      const result = await query(
        `SELECT ${definition.columns}
           FROM company_site.${definition.table}
          WHERE ${conditions.join(' AND ')}
          ORDER BY array_position($2::text[], locale), ${type === 'faq' ? 'title' : 'slug'}${slug ? '' : ' '}`,
        params
      );
      const items = rows(result).map(definition.mapper);
      if (slug && !items.length) {
        sendJson(res, 404, { code: definition.pathCode, message: 'Published content was not found' });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        site: mapSite(site),
        locale: locales[0],
        ...(slug ? { item: items[0] } : { items })
      });
    } catch {
      sendJson(res, 503, { code: 'CONTENT_UNAVAILABLE', message: 'Public content is temporarily unavailable' });
    }
  };

  const getPublicProducts = async (req, res, productSlug = '') => {
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Published site configuration was not found' });
        return;
      }
      const url = readUrl(req);
      const localeCandidates = getLocaleCandidates(url.searchParams.get('locale'), site.default_locale);
      const params = [SITE_KEY, localeCandidates];
      let slugClause = '';
      if (productSlug) {
        params.push(productSlug);
        slugClause = ' AND p.slug = $3';
      }
      const result = await query(
        `SELECT p.id, p.product_code, p.slug, p.category, p.applications,
                p.specifications, p.delivery, pl.locale, pl.name,
                pl.summary, pl.description, pl.image_urls, pl.seo AS product_seo,
                pl.faq
           FROM company_site.products p
           JOIN company_site.product_locales pl
             ON pl.product_id = p.id
            AND pl.status = 'published'
            AND pl.locale = ANY($2::text[])
          WHERE p.site_key = $1
            AND p.status = 'published'
            ${slugClause}
          ORDER BY array_position($2::text[], pl.locale), p.product_code`,
        params
      );
      const products = rows(result).map(mapProduct);
      const unique = [];
      const seen = new Set();
      for (const product of products) {
        if (seen.has(product.slug)) continue;
        seen.add(product.slug);
        unique.push(product);
      }
      if (productSlug && !unique.length) {
        sendJson(res, 404, { code: 'PRODUCT_NOT_FOUND', message: 'Published product was not found' });
        return;
      }
      sendJson(res, 200, { ok: true, site: mapSite(site), locale: localeCandidates[0], items: unique });
    } catch (error) {
      sendJson(res, 503, { code: 'PRODUCTS_UNAVAILABLE', message: 'Products are temporarily unavailable' });
    }
  };

  const getPublicSitemap = async (req, res) => {
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendText(res, 404, 'Not found');
        return;
      }
      const pages = await query(
        `SELECT slug, locale
           FROM company_site.content_pages
          WHERE site_key = $1 AND status = 'published'
          ORDER BY locale, slug`,
        [SITE_KEY]
      );
      const products = await query(
        `SELECT slug
           FROM company_site.products
          WHERE site_key = $1 AND status = 'published'
          ORDER BY slug`,
        [SITE_KEY]
      );
      const solutions = await query(
        `SELECT slug FROM company_site.solutions
          WHERE site_key = $1 AND status = 'published'
          ORDER BY slug`,
        [SITE_KEY]
      );
      const cases = await query(
        `SELECT slug FROM company_site.cases
          WHERE site_key = $1 AND status = 'published' AND public_level <> 'internal'
          ORDER BY slug`,
        [SITE_KEY]
      );
      const faq = await query(
        `SELECT 1 FROM company_site.knowledge_documents
          WHERE site_key = $1 AND status = 'published' AND document_type = 'faq'
          LIMIT 1`,
        [SITE_KEY]
      );
      const origin = `https://${text(site.domain, 255)}`;
      const urls = new Set([`${origin}/company/`]);
      for (const row of rows(pages)) {
        const slug = safeSlug(row.slug);
        if (!slug || slug === 'home') continue;
        urls.add(`${origin}/company/${slug}`);
      }
      for (const row of rows(products)) {
        const slug = safeSlug(row.slug);
        if (slug) urls.add(`${origin}/company/products/${escapeXml(slug)}`);
      }
      for (const row of rows(solutions)) {
        const slug = safeSlug(row.slug);
        if (slug) urls.add(`${origin}/company/solutions/${escapeXml(slug)}`);
      }
      for (const row of rows(cases)) {
        const slug = safeSlug(row.slug);
        if (slug) urls.add(`${origin}/company/cases/${escapeXml(slug)}`);
      }
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
        [...urls].map((url) => `<url><loc>${url}</loc></url>`).join('') +
        (firstRow(faq) ? `<url><loc>${origin}/company/faq</loc></url>` : '') +
        '</urlset>';
      sendText(res, 200, body, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
    } catch (error) {
      sendText(res, 503, 'Sitemap temporarily unavailable');
    }
  };

  const rateLimitKey = (req) => hashValue(
    `${req?.socket?.remoteAddress || 'unknown'}:${normalizeHost(req?.headers?.host || '')}`
  );

  const checkRateLimit = (req) => {
    const key = rateLimitKey(req);
    const current = now().getTime();
    const windowMs = 60 * 60 * 1000;
    const bucket = rateBuckets.get(key);
    if (!bucket || current - bucket.startedAt >= windowMs) {
      rateBuckets.set(key, { startedAt: current, count: 1 });
      return true;
    }
    if (bucket.count >= 30) return false;
    bucket.count += 1;
    return true;
  };

  const normalizeLead = (body, req) => {
    const consent = safeJson(body?.consent, {});
    const consentAccepted = body?.consent === true || consent.accepted === true || consent.accepted === 'true';
    const email = text(body?.email, 240).toLowerCase();
    const phone = text(body?.phone, 80);
    const whatsapp = text(body?.whatsapp, 80);
    const contactName = text(body?.contactName || body?.contact_name, 120);
    const companyName = text(body?.companyName || body?.company_name, 200);
    const message = text(body?.message, 4000);
    const products = Array.isArray(body?.productSlugs || body?.product_slugs)
      ? (body.productSlugs || body.product_slugs).map((item) => safeSlug(item)).filter(Boolean).slice(0, 20)
      : [];
    const utm = safeJson(body?.utm, {});
    const pagePath = text(body?.pagePath || body?.page_path, 500);
    const source = text(body?.source, 80) || 'website';
    const locale = safeLocale(body?.locale);
    const sourceSessionId = text(body?.sessionId || body?.session_id, 160);
    const rawIdempotency = text(
      body?.idempotencyKey || body?.idempotency_key || req?.headers?.['idempotency-key'],
      160
    );
    const idempotencyKey = rawIdempotency || hashValue(JSON.stringify({
      source,
      email,
      phone,
      whatsapp,
      companyName,
      products,
      message,
      day: now().toISOString().slice(0, 10),
      ip: rateLimitKey(req)
    }));
    return {
      source,
      locale,
      pagePath,
      utm,
      companyName,
      contactName,
      email,
      phone,
      whatsapp,
      country: text(body?.country, 100),
      products,
      quantity: text(body?.quantity, 120),
      targetDate: text(body?.targetDate || body?.target_date, 80),
      message,
      consent,
      consentAccepted,
      sourceSessionId,
      idempotencyKey,
      ipHash: hashValue(req?.socket?.remoteAddress || 'unknown')
    };
  };

  const createPublicLead = async (req, res) => {
    if (!checkRateLimit(req)) {
      sendJson(res, 429, { code: 'RATE_LIMITED', message: 'Too many requests' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(req, 128 * 1024);
    } catch (error) {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const lead = normalizeLead(body, req);
    if (!lead.consentAccepted) {
      sendJson(res, 400, { code: 'CONSENT_REQUIRED', message: 'Consent is required before submitting an inquiry' });
      return;
    }
    if (!lead.email && !lead.phone && !lead.whatsapp) {
      sendJson(res, 400, { code: 'CONTACT_REQUIRED', message: 'Email, phone or WhatsApp is required' });
      return;
    }
    if (!lead.contactName && !lead.companyName) {
      sendJson(res, 400, { code: 'IDENTITY_REQUIRED', message: 'Contact name or company name is required' });
      return;
    }
    if (jsonBytes(lead.utm) > 4096 || lead.products.length > 20) {
      sendJson(res, 400, { code: 'PAYLOAD_TOO_LARGE', message: 'Lead metadata is too large' });
      return;
    }
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Published site configuration was not found' });
        return;
      }
      const existing = await query(
        `SELECT id, public_ref, status FROM company_site.leads
          WHERE site_key = $1 AND idempotency_key = $2 LIMIT 1`,
        [SITE_KEY, lead.idempotencyKey]
      );
      if (firstRow(existing)) {
        sendJson(res, 200, { ok: true, deduplicated: true, lead: { publicRef: firstRow(existing).public_ref, status: firstRow(existing).status } });
        return;
      }
      const publicRef = `INQ-${now().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const inserted = await query(
        `INSERT INTO company_site.leads (
           public_ref, site_key, source, locale, page_path, utm,
           company_name, contact_name, email, phone, whatsapp, country,
           product_slugs, quantity, target_date, message, consent,
           source_session_id, ip_hash, idempotency_key
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb,
           $7, $8, $9, $10, $11, $12,
           $13::jsonb, $14, $15, $16, $17::jsonb,
           $18, $19, $20
         )
         RETURNING id, public_ref, status, created_at`,
        [
          publicRef, SITE_KEY, lead.source, lead.locale, lead.pagePath, JSON.stringify(lead.utm),
          lead.companyName, lead.contactName, lead.email, lead.phone, lead.whatsapp, lead.country,
          JSON.stringify(lead.products), lead.quantity, lead.targetDate, lead.message,
          JSON.stringify({ ...lead.consent, accepted: true, acceptedAt: now().toISOString() }),
          lead.sourceSessionId, lead.ipHash, lead.idempotencyKey
        ]
      );
      const created = firstRow(inserted);
      if (!created) throw new Error('lead insert returned no row');
      await query(
        `INSERT INTO company_site.lead_events
          (site_key, lead_id, session_id, event_name, page_path, event_payload)
         VALUES ($1, $2, $3, 'lead_submitted', $4, $5::jsonb)`,
        [SITE_KEY, created.id, lead.sourceSessionId, lead.pagePath, JSON.stringify({ source: lead.source, locale: lead.locale })]
      );
      sendJson(res, 201, {
        ok: true,
        deduplicated: false,
        lead: { publicRef: created.public_ref, status: created.status, createdAt: created.created_at }
      });
    } catch (error) {
      sendJson(res, 503, { code: 'LEAD_SUBMIT_UNAVAILABLE', message: 'Inquiry service is temporarily unavailable' });
    }
  };

  const recordPublicEvent = async (req, res) => {
    if (!checkRateLimit(req)) {
      sendJson(res, 429, { code: 'RATE_LIMITED', message: 'Too many requests' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(req, MAX_EVENT_PAYLOAD_BYTES);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const eventName = text(body?.eventName || body?.event_name, 80).toLowerCase();
    if (!PUBLIC_EVENTS.has(eventName)) {
      sendJson(res, 400, { code: 'EVENT_NOT_ALLOWED', message: 'Event is not allowed' });
      return;
    }
    const payload = safeJson(body?.payload, {});
    if (jsonBytes(payload) > MAX_EVENT_PAYLOAD_BYTES) {
      sendJson(res, 400, { code: 'PAYLOAD_TOO_LARGE', message: 'Event payload is too large' });
      return;
    }
    try {
      const site = await loadPublishedSite(req);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Published site configuration was not found' });
        return;
      }
      await query(
        `INSERT INTO company_site.lead_events
          (site_key, session_id, event_name, page_path, event_payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [SITE_KEY, text(body?.sessionId || body?.session_id, 160), eventName, text(body?.pagePath || body?.page_path, 500), JSON.stringify(payload)]
      );
      sendJson(res, 202, { ok: true });
    } catch {
      sendJson(res, 503, { code: 'EVENT_RECORD_UNAVAILABLE', message: 'Event service is temporarily unavailable' });
    }
  };

  const getAdminSiteConfig = async (req, res) => {
    try {
      const result = await query(
        `SELECT * FROM company_site.site_config WHERE site_key = $1 LIMIT 1`,
        [SITE_KEY]
      );
      const site = firstRow(result);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Site configuration was not found' });
        return;
      }
      sendJson(res, 200, { ok: true, site: mapSite(site) });
    } catch {
      sendJson(res, 503, { code: 'SITE_CONFIG_UNAVAILABLE', message: 'Site configuration is temporarily unavailable' });
    }
  };

  const updateAdminSiteConfig = async (req, res, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const scalarFields = {
      legalName: 'legal_name',
      brandName: 'brand_name',
      brandShortName: 'brand_short_name',
      factoryName: 'factory_name',
      domain: 'domain',
      template: 'template_key',
      defaultLocale: 'default_locale'
    };
    const jsonFields = {
      enabledLocales: 'enabled_locales',
      theme: 'theme',
      contact: 'contact',
      socialLinks: 'social_links',
      trademark: 'trademark',
      settings: 'settings',
      seo: 'seo'
    };
    const sets = [];
    const params = [SITE_KEY];
    Object.entries(scalarFields).forEach(([input, column]) => {
      if (body[input] === undefined) return;
      params.push(text(body[input], input === 'domain' ? 255 : 240));
      sets.push(`${column} = $${params.length}`);
    });
    Object.entries(jsonFields).forEach(([input, column]) => {
      if (body[input] === undefined || jsonBytes(body[input]) > 64 * 1024) return;
      params.push(JSON.stringify(body[input]));
      sets.push(`${column} = $${params.length}::jsonb`);
    });
    if (!sets.length) {
      sendJson(res, 400, { code: 'NO_ALLOWED_FIELDS', message: 'No configurable site fields were provided' });
      return;
    }
    sets.push("status = 'draft'", 'published_at = NULL', "published_by = ''", 'updated_at = now()');
    try {
      const result = await query(
        `UPDATE company_site.site_config
            SET ${sets.join(', ')}
          WHERE site_key = $1
          RETURNING *`,
        params
      );
      const site = firstRow(result);
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Site configuration was not found' });
        return;
      }
      await query(
        `INSERT INTO company_site.audit_events
          (site_key, actor_type, actor_id, action, object_type, object_id, result_code, details)
         VALUES ($1, 'employee', $2, 'site.config.update', 'site_config', $1, 'OK', $3::jsonb)`,
        [SITE_KEY, text(user?.id || user?.username, 160), JSON.stringify({ fields: sets.map((item) => item.split(' = ')[0]) })]
      );
      sendJson(res, 200, { ok: true, site: mapSite(site), status: site.status });
    } catch {
      sendJson(res, 503, { code: 'SITE_CONFIG_UPDATE_UNAVAILABLE', message: 'Site configuration update is temporarily unavailable' });
    }
  };

  const listAdminContent = async (req, res, objectType) => {
    const definitions = {
      pages: { table: 'content_pages', columns: 'id, site_key, locale, slug, page_type, title, summary, status, version, published_at, updated_at' },
      products: { table: 'products', columns: 'id, site_key, product_code, slug, category, applications, specifications, delivery, status, updated_at' },
      solutions: { table: 'solutions', columns: 'id, site_key, locale, slug, title, industry, scenario, status, updated_at' },
      cases: { table: 'cases', columns: 'id, site_key, locale, slug, title, industry, scope, public_level, status, updated_at' },
      evidence: { table: 'evidence_records', columns: 'id, site_key, claim, source_type, source_ref, verified_by, verified_at, expires_at, status, updated_at' },
      seo: { table: 'seo_metadata', columns: 'id, site_key, locale, path, title, description, canonical, robots, keywords, status, updated_at' },
      knowledge: { table: 'knowledge_documents', columns: 'id, site_key, locale, document_type, title, status, version, effective_from, expires_at, updated_at' }
    };
    const definition = definitions[objectType];
    if (!definition) {
      sendJson(res, 400, { code: 'CONTENT_TYPE_INVALID', message: 'Unsupported admin content type' });
      return;
    }
    const url = readUrl(req);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
    try {
      const result = await query(
        `SELECT ${definition.columns}
           FROM company_site.${definition.table}
          WHERE site_key = $1
          ORDER BY updated_at DESC
          LIMIT $2 OFFSET $3`,
        [SITE_KEY, limit, offset]
      );
      sendJson(res, 200, { ok: true, objectType, limit, offset, items: rows(result) });
    } catch {
      sendJson(res, 503, { code: 'ADMIN_CONTENT_UNAVAILABLE', message: 'Admin content is temporarily unavailable' });
    }
  };

  const listAdminLeads = async (req, res) => {
    const url = readUrl(req);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
    try {
      const result = await query(
        `SELECT id, public_ref, source, locale, page_path, company_name,
                contact_name, email, phone, whatsapp, country, product_slugs,
                quantity, target_date, message, qualification, status,
                owner_id, created_at, updated_at
           FROM company_site.leads
          WHERE site_key = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`,
        [SITE_KEY, limit, offset]
      );
      sendJson(res, 200, { ok: true, limit, offset, items: rows(result) });
    } catch {
      sendJson(res, 503, { code: 'LEADS_UNAVAILABLE', message: 'Lead list is temporarily unavailable' });
    }
  };

  const bodyValue = (body, input, column) => {
    if (body?.[input] !== undefined) return body[input];
    if (body?.[column] !== undefined) return body[column];
    return undefined;
  };

  const normalizeContentValue = (value, kind) => {
    if (kind === 'json') {
      if (jsonBytes(value) > 64 * 1024) throw new Error('JSON content is too large');
      return { value: JSON.stringify(value), sqlType: 'jsonb' };
    }
    if (kind === 'locale') return { value: safeLocale(value, ''), sqlType: 'text' };
    if (kind === 'slug') return { value: safeSlug(value), sqlType: 'text' };
    if (kind === 'id') return { value: text(value, 80), sqlType: 'text' };
    if (kind === 'date' || kind === 'dateTime') return { value: value ? text(value, 80) : null, sqlType: 'date' };
    if (kind === 'textLong') return { value: text(value, 12000), sqlType: 'text' };
    if (kind === 'path') {
      const path = text(value, 500);
      return { value: path.includes('..') ? '' : path, sqlType: 'text' };
    }
    return { value: text(value, 1200), sqlType: 'text' };
  };

  const collectContentFields = (definition, body) => {
    const values = [];
    const missing = [];
    for (const [input, column, kind] of definition.fields) {
      const raw = bodyValue(body, input, column);
      if (raw === undefined) {
        if (definition.required.includes(input)) missing.push(input);
        continue;
      }
      const normalized = normalizeContentValue(raw, kind);
      if (definition.required.includes(input) && !normalized.value) missing.push(input);
      values.push({ input, column, kind, value: normalized.value, sqlType: normalized.sqlType });
    }
    return { values, missing };
  };

  const getContentDefinition = (objectType) => ADMIN_CONTENT_DEFINITIONS[text(objectType, 40).toLowerCase()] || null;

  const getContentRow = async (definition, objectId) => {
    if (definition.table === 'product_locales') {
      const result = await query(
        `SELECT pl.*, p.site_key
           FROM company_site.product_locales pl
           JOIN company_site.products p ON p.id = pl.product_id
          WHERE pl.id = $1 AND p.site_key = $2
          LIMIT 1`,
        [objectId, SITE_KEY]
      );
      return firstRow(result);
    }
    const result = await query(
      `SELECT * FROM company_site.${definition.table} WHERE id = $1 AND site_key = $2 LIMIT 1`,
      [objectId, SITE_KEY]
    );
    return firstRow(result);
  };

  const recordContentRevision = async (objectType, row, user, changeSummary) => {
    if (!row?.id) return;
    let version = Number(row.version || 0);
    if (version < 1) {
      const next = await query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS version
           FROM company_site.content_revisions
          WHERE site_key = $1 AND object_type = $2 AND object_id = $3`,
        [SITE_KEY, objectType, row.id]
      );
      version = Math.max(Number(firstRow(next)?.version || 1), 1);
    }
    await query(
      `INSERT INTO company_site.content_revisions
        (site_key, object_type, object_id, version, snapshot, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (site_key, object_type, object_id, version) DO NOTHING`,
      [SITE_KEY, objectType, row.id, version, JSON.stringify(row), text(changeSummary, 500), text(user?.id || user?.username, 160)]
    );
  };

  const saveContentRecord = async (objectType, objectId, body, user, changeSummary = '') => {
    const definition = getContentDefinition(objectType);
    if (!definition) return { error: 'CONTENT_TYPE_INVALID' };
    const { values, missing } = collectContentFields(definition, body || {});
    const existing = objectId ? await getContentRow(definition, objectId) : null;
    if (objectId && !existing) return { error: 'CONTENT_NOT_FOUND' };
    if (missing.length && !existing) return { error: 'REQUIRED_FIELDS_MISSING', missing };
    const userId = text(user?.id || user?.username, 160);
    let saved;

    if (definition.table === 'product_locales' && !existing) {
      const productId = values.find((item) => item.input === 'productId')?.value;
      const product = await query(
        `SELECT id FROM company_site.products WHERE id = $1 AND site_key = $2 LIMIT 1`,
        [productId, SITE_KEY]
      );
      if (!firstRow(product)) return { error: 'PRODUCT_NOT_FOUND' };
    }

    if (existing) {
      await recordContentRevision(objectType, existing, user, changeSummary || 'before update');
      const params = [];
      const assignments = values
        .filter((item) => item.input !== 'productId')
        .map((item) => {
          params.push(item.value);
          return `${item.column} = $${params.length}${item.sqlType === 'jsonb' ? '::jsonb' : ''}`;
        });
      if (!assignments.length) return { error: 'NO_ALLOWED_FIELDS' };
      assignments.push("status = 'draft'", 'updated_at = now()');
      if (Object.prototype.hasOwnProperty.call(existing, 'version')) assignments.push('version = COALESCE(version, 1) + 1');
      if (Object.prototype.hasOwnProperty.call(existing, 'updated_by')) {
        params.push(userId);
        assignments.push(`updated_by = $${params.length}`);
      }
      if (definition.table === 'product_locales') {
        params.push(objectId, SITE_KEY);
        saved = firstRow(await query(
          `UPDATE company_site.product_locales pl
              SET ${assignments.join(', ')}
            WHERE pl.id = $${params.length - 1}
              AND EXISTS (
                SELECT 1 FROM company_site.products p
                 WHERE p.id = pl.product_id AND p.site_key = $${params.length}
              )
            RETURNING pl.*`,
          params
        ));
      } else {
        params.push(objectId, SITE_KEY);
        saved = firstRow(await query(
          `UPDATE company_site.${definition.table}
              SET ${assignments.join(', ')}
            WHERE id = $${params.length - 1} AND site_key = $${params.length}
            RETURNING *`,
          params
        ));
      }
    } else {
      const params = [SITE_KEY];
      const columns = ['site_key'];
      const placeholders = ['$1'];
      for (const item of values) {
        columns.push(item.column);
        params.push(item.value);
        placeholders.push(`$${params.length}${item.sqlType === 'jsonb' ? '::jsonb' : ''}`);
      }
      columns.push('status', 'version', 'created_by', 'updated_by');
      params.push('draft', 1, userId, userId);
      placeholders.push(`$${params.length - 3}`, `$${params.length - 2}`, `$${params.length - 1}`, `$${params.length}`);
      if (definition.table === 'product_locales') {
        const productIndex = values.findIndex((item) => item.input === 'productId');
        const productParam = productIndex >= 0 ? productIndex + 2 : 0;
        const localeParams = params.slice(1);
        const localePlaceholders = values.map((item, index) => `$${index + 1}${item.sqlType === 'jsonb' ? '::jsonb' : ''}`);
        localePlaceholders.push(`$${localeParams.length - 3}`, `$${localeParams.length - 2}`, `$${localeParams.length - 1}`, `$${localeParams.length}`);
        saved = firstRow(await query(
          `INSERT INTO company_site.product_locales (${columns.slice(1).join(', ')})
           VALUES (${localePlaceholders.join(', ')})
           RETURNING *`,
          localeParams
        ));
        if (!saved || !productParam) return { error: 'CONTENT_CREATE_FAILED' };
      } else {
        saved = firstRow(await query(
          `INSERT INTO company_site.${definition.table} (${columns.join(', ')})
           VALUES (${placeholders.join(', ')})
           RETURNING *`,
          params
        ));
      }
    }
    if (!saved) return { error: 'CONTENT_SAVE_FAILED' };
    const revisionRow = definition.table === 'product_locales' ? await getContentRow(definition, saved.id) : saved;
    await recordContentRevision(objectType, revisionRow, user, changeSummary || (existing ? 'update' : 'create'));
    await query(
      `INSERT INTO company_site.audit_events
        (site_key, actor_type, actor_id, action, object_type, object_id, result_code, details)
       VALUES ($1, 'employee', $2, 'content.save', $3, $4, 'OK', $5::jsonb)`,
      [SITE_KEY, userId, objectType, saved.id, JSON.stringify({ status: 'draft', changeSummary: changeSummary || '' })]
    );
    return { row: revisionRow || saved, created: !existing };
  };

  const saveAdminContent = async (req, res, objectType, objectId, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 128 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    try {
      const result = await saveContentRecord(objectType, objectId, body, user);
      if (result.error) {
        const status = result.error === 'CONTENT_NOT_FOUND' || result.error === 'PRODUCT_NOT_FOUND' ? 404 : 400;
        sendJson(res, status, { code: result.error, message: result.missing ? `Missing fields: ${result.missing.join(', ')}` : 'Content could not be saved' });
        return;
      }
      sendJson(res, result.created ? 201 : 200, { ok: true, item: result.row, status: 'draft' });
    } catch {
      sendJson(res, 503, { code: 'CONTENT_SAVE_UNAVAILABLE', message: 'Content save is temporarily unavailable' });
    }
  };

  const listContentRevisions = async (req, res, objectType, objectId) => {
    if (!getContentDefinition(objectType) || !objectId) {
      sendJson(res, 400, { code: 'VALIDATION_FAILED', message: 'objectType and objectId are required' });
      return;
    }
    try {
      const result = await query(
        `SELECT id, object_type, object_id, version, snapshot, change_summary, created_by, created_at
           FROM company_site.content_revisions
          WHERE site_key = $1 AND object_type = $2 AND object_id = $3
          ORDER BY version DESC, created_at DESC
          LIMIT 100`,
        [SITE_KEY, text(objectType, 40).toLowerCase(), objectId]
      );
      sendJson(res, 200, { ok: true, items: rows(result) });
    } catch {
      sendJson(res, 503, { code: 'CONTENT_REVISIONS_UNAVAILABLE', message: 'Content revisions are temporarily unavailable' });
    }
  };

  const rollbackContent = async (req, res, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 32 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const objectType = text(body?.objectType || body?.object_type, 40).toLowerCase();
    const objectId = text(body?.objectId || body?.object_id || body?.id, 80);
    const version = Number(body?.version);
    if (!getContentDefinition(objectType) || !objectId || !Number.isInteger(version) || version < 1) {
      sendJson(res, 400, { code: 'VALIDATION_FAILED', message: 'objectType, objectId and positive version are required' });
      return;
    }
    try {
      const result = await query(
        `SELECT snapshot FROM company_site.content_revisions
          WHERE site_key = $1 AND object_type = $2 AND object_id = $3 AND version = $4
          LIMIT 1`,
        [SITE_KEY, objectType, objectId, version]
      );
      const revision = firstRow(result);
      if (!revision) {
        sendJson(res, 404, { code: 'REVISION_NOT_FOUND', message: 'Content revision was not found' });
        return;
      }
      const saved = await saveContentRecord(objectType, objectId, parseJson(revision.snapshot, {}), user, `rollback to version ${version}`);
      if (saved.error) {
        sendJson(res, 400, { code: saved.error, message: 'Content rollback failed' });
        return;
      }
      sendJson(res, 200, { ok: true, status: 'draft', rolledBackFrom: version, item: saved.row });
    } catch {
      sendJson(res, 503, { code: 'CONTENT_ROLLBACK_UNAVAILABLE', message: 'Content rollback is temporarily unavailable' });
    }
  };

  const runSeoCheck = async (req, res, user = {}) => {
    const runId = crypto.randomUUID();
    try {
      const site = await loadPublishedSite(req, { allowDraft: true });
      if (!site) {
        sendJson(res, 404, { code: 'SITE_NOT_FOUND', message: 'Site configuration was not found' });
        return;
      }
      const [metadataResult, pageResult] = await Promise.all([
        query(
          `SELECT locale, path, title, description, canonical, robots
             FROM company_site.seo_metadata
            WHERE site_key = $1
            ORDER BY locale, path`,
          [SITE_KEY]
        ),
        query(
          `SELECT p.locale, p.slug, p.title, m.path AS metadata_path
             FROM company_site.content_pages p
             LEFT JOIN company_site.seo_metadata m
               ON m.site_key = p.site_key AND m.locale = p.locale
              AND m.path = CASE WHEN p.slug = 'home' THEN '/company/' ELSE '/company/' || p.slug END
            WHERE p.site_key = $1 AND p.status = 'published'
            ORDER BY p.locale, p.slug`,
          [SITE_KEY]
        )
      ]);
      const checks = [];
      const addCheck = (path, checkType, severity, status, details) => checks.push({ path, checkType, severity, status, details });
      if (!text(site.domain, 255)) addCheck('/company/', 'site_domain', 'critical', 'open', { message: 'Published site domain is missing' });
      for (const row of rows(metadataResult)) {
        const path = text(row.path, 500) || '/company/';
        if (!text(row.title, 240)) addCheck(path, 'meta_title', 'error', 'open', { locale: row.locale, message: 'SEO title is missing' });
        if (!text(row.description, 1200)) addCheck(path, 'meta_description', 'warning', 'open', { locale: row.locale, message: 'SEO description is missing' });
        if (!text(row.canonical, 500)) addCheck(path, 'canonical', 'error', 'open', { locale: row.locale, message: 'Canonical URL is missing' });
        if (String(row.robots || '').toLowerCase().includes('noindex')) addCheck(path, 'robots_noindex', 'warning', 'open', { locale: row.locale, message: 'Published SEO metadata is marked noindex' });
      }
      for (const row of rows(pageResult)) {
        if (!row.metadata_path) addCheck(`/company/${safeSlug(row.slug)}`, 'page_seo_metadata', 'warning', 'open', { locale: row.locale, title: row.title, message: 'Published page has no matching SEO metadata' });
      }
      if (!checks.length) addCheck('/company/', 'technical_baseline', 'info', 'resolved', { message: 'No SEO metadata issues detected by the current baseline checks' });
      for (const check of checks) {
        await query(
          `INSERT INTO company_site.seo_checks
            (site_key, run_id, path, check_type, severity, status, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [SITE_KEY, runId, check.path, check.checkType, check.severity, check.status, JSON.stringify(check.details)]
        );
      }
      await query(
        `INSERT INTO company_site.audit_events
          (site_key, actor_type, actor_id, action, object_type, object_id, result_code, details)
         VALUES ($1, 'employee', $2, 'seo.check.run', 'seo_checks', $3, 'OK', $4::jsonb)`,
        [SITE_KEY, text(user?.id || user?.username, 160), runId, JSON.stringify({ count: checks.length })]
      );
      sendJson(res, 201, { ok: true, runId, count: checks.length, checks });
    } catch {
      sendJson(res, 503, { code: 'SEO_CHECK_UNAVAILABLE', message: 'SEO technical check is temporarily unavailable' });
    }
  };

  const listSeoChecks = async (req, res) => {
    const url = readUrl(req);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
    try {
      const result = await query(
        `SELECT id, run_id, path, check_type, severity, status, details, checked_at
           FROM company_site.seo_checks
          WHERE site_key = $1
          ORDER BY checked_at DESC
          LIMIT $2`,
        [SITE_KEY, limit]
      );
      sendJson(res, 200, { ok: true, limit, items: rows(result) });
    } catch {
      sendJson(res, 503, { code: 'SEO_CHECKS_UNAVAILABLE', message: 'SEO check results are temporarily unavailable' });
    }
  };

  const recordGeoSnapshot = async (req, res, user = {}) => {
    let body = {};
    try {
      body = await readJsonBody(req, 96 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const platform = text(body?.platform, 80);
    const locale = safeLocale(body?.locale, 'zh-CN');
    const question = text(body?.question, 2000);
    const answer = text(body?.answer, 12000);
    const citations = body?.citations && typeof body.citations === 'object' ? body.citations : [];
    const accuracyStatus = text(body?.accuracyStatus || body?.accuracy_status, 32).toLowerCase() || 'pending';
    if (!platform || !question || !['pending', 'accurate', 'needs_correction', 'obsolete'].includes(accuracyStatus)) {
      sendJson(res, 400, { code: 'VALIDATION_FAILED', message: 'platform, question and a valid accuracyStatus are required' });
      return;
    }
    if (jsonBytes(citations) > 32 * 1024) {
      sendJson(res, 400, { code: 'PAYLOAD_TOO_LARGE', message: 'GEO citations are too large' });
      return;
    }
    try {
      const inserted = await query(
        `INSERT INTO company_site.geo_answer_snapshots
          (site_key, locale, platform, question, answer, citations, accuracy_status, checked_by, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now())
         RETURNING id, site_key, locale, platform, question, answer, citations, accuracy_status, checked_by, checked_at, created_at`,
        [SITE_KEY, locale, platform, question, answer, JSON.stringify(citations), accuracyStatus, text(user?.id || user?.username, 160)]
      );
      const snapshot = firstRow(inserted);
      await query(
        `INSERT INTO company_site.audit_events
          (site_key, actor_type, actor_id, action, object_type, object_id, result_code, details)
         VALUES ($1, 'employee', $2, 'geo.snapshot.record', 'geo_answer_snapshot', $3, 'OK', $4::jsonb)`,
        [SITE_KEY, text(user?.id || user?.username, 160), snapshot?.id || '', JSON.stringify({ platform, locale, accuracyStatus })]
      );
      sendJson(res, 201, { ok: true, snapshot });
    } catch {
      sendJson(res, 503, { code: 'GEO_SNAPSHOT_UNAVAILABLE', message: 'GEO snapshot service is temporarily unavailable' });
    }
  };

  const listGeoSnapshots = async (req, res) => {
    const url = readUrl(req);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
    try {
      const result = await query(
        `SELECT id, locale, platform, question, answer, citations, accuracy_status, checked_by, checked_at, created_at
           FROM company_site.geo_answer_snapshots
          WHERE site_key = $1
          ORDER BY checked_at DESC, created_at DESC
          LIMIT $2`,
        [SITE_KEY, limit]
      );
      sendJson(res, 200, { ok: true, limit, items: rows(result) });
    } catch {
      sendJson(res, 503, { code: 'GEO_SNAPSHOTS_UNAVAILABLE', message: 'GEO snapshots are temporarily unavailable' });
    }
  };

  const publishContent = async (req, res, user = {}) => {
    let body;
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
      return;
    }
    const objectType = text(body?.objectType || body?.object_type, 40).toLowerCase();
    const objectId = text(body?.id || body?.objectId || body?.object_id, 80);
    const status = text(body?.status, 32).toLowerCase();
    const allowedStatuses = new Set(['draft', 'review', 'approved', 'published', 'expired', 'archived']);
    const tableMap = {
      site_config: { table: 'site_config', siteConfig: true, publishedBy: true },
      page: { table: 'content_pages', publishedBy: true },
      product: { table: 'products', publishedBy: false },
      product_locale: { table: 'product_locales', publishedBy: false },
      solution: { table: 'solutions', publishedBy: false },
      case: { table: 'cases', publishedBy: false },
      evidence: { table: 'evidence_records', publishedBy: false },
      knowledge: { table: 'knowledge_documents', publishedBy: false }
    };
    const target = tableMap[objectType];
    if (!target || !objectId || !allowedStatuses.has(status)) {
      sendJson(res, 400, { code: 'VALIDATION_FAILED', message: 'objectType, id and a valid status are required' });
      return;
    }
    try {
      if (target.siteConfig) {
        if (objectId !== SITE_KEY || !['draft', 'published', 'suspended', 'archived'].includes(status)) {
          sendJson(res, 400, { code: 'VALIDATION_FAILED', message: 'site_config requires id=primary and a site status' });
          return;
        }
        const siteResult = await query(
          `UPDATE company_site.site_config
              SET status = $1,
                  published_version = CASE WHEN $1 = 'published' THEN published_version + 1 ELSE published_version END,
                  published_at = CASE WHEN $1 = 'published' THEN now() ELSE NULL END,
                  published_by = CASE WHEN $1 = 'published' THEN $3 ELSE '' END,
                  updated_at = now()
            WHERE site_key = $2
            RETURNING site_key, status, published_version, published_at, published_by, updated_at`,
          [status, SITE_KEY, text(user?.id || user?.username, 160)]
        );
        const site = firstRow(siteResult);
        if (!site) {
          sendJson(res, 404, { code: 'CONTENT_NOT_FOUND', message: 'Site configuration was not found' });
          return;
        }
        await query(
          `INSERT INTO company_site.audit_events
            (site_key, actor_type, actor_id, action, object_type, object_id, result_code, details)
           VALUES ($1, 'employee', $2, 'content.status.change', 'site_config', $1, 'OK', $3::jsonb)`,
          [SITE_KEY, text(user?.id || user?.username, 160), JSON.stringify({ status })]
        );
        sendJson(res, 200, { ok: true, item: site });
        return;
      }
      const params = [status, objectId, SITE_KEY];
      const publishedSql = target.publishedBy
        ? `, published_at = CASE WHEN $1 = 'published' THEN now() ELSE NULL END,
             published_by = CASE WHEN $1 = 'published' THEN $4 ELSE '' END`
        : '';
      if (target.publishedBy) params.push(text(user?.id || user?.username, 160));
      const updateSql = objectType === 'product_locale'
        ? `UPDATE company_site.product_locales pl
              SET status = $1, updated_at = now()
            WHERE pl.id = $2
              AND EXISTS (
                SELECT 1
                  FROM company_site.products p
                 WHERE p.id = pl.product_id
                   AND p.site_key = $3
              )
            RETURNING pl.id, pl.status, pl.updated_at`
        : `UPDATE company_site.${target.table}
              SET status = $1, updated_at = now()${publishedSql}
            WHERE id = $2 AND site_key = $3
            RETURNING id, status, updated_at`;
      const result = await query(
        updateSql,
        params
      );
      const updated = firstRow(result);
      if (!updated) {
        sendJson(res, 404, { code: 'CONTENT_NOT_FOUND', message: 'Content was not found for this site' });
        return;
      }
      await query(
        `INSERT INTO company_site.audit_events
          (site_key, actor_type, actor_id, action, object_type, object_id, result_code, details)
         VALUES ($1, 'employee', $2, 'content.status.change', $3, $4, 'OK', $5::jsonb)`,
        [SITE_KEY, text(user?.id || user?.username, 160), objectType, objectId, JSON.stringify({ status })]
      );
      sendJson(res, 200, { ok: true, item: updated });
    } catch {
      sendJson(res, 503, { code: 'CONTENT_PUBLISH_UNAVAILABLE', message: 'Content publishing is temporarily unavailable' });
    }
  };

  return {
    handleGetPublicSiteConfig: getPublicSiteConfig,
    handleGetPublicPage: getPublicPage,
    handleGetPublicProducts: getPublicProducts,
    handleGetPublicSolutions: (req, res, slug = '') => getPublicCollection(req, res, 'solution', slug),
    handleGetPublicCases: (req, res, slug = '') => getPublicCollection(req, res, 'case', slug),
    handleGetPublicFaq: (req, res, slug = '') => getPublicCollection(req, res, 'faq', slug),
    handleGetPublicSitemap: getPublicSitemap,
    handleCreatePublicLead: createPublicLead,
    handleRecordPublicEvent: recordPublicEvent,
    handleGetAdminSiteConfig: getAdminSiteConfig,
    handleUpdateAdminSiteConfig: updateAdminSiteConfig,
    handleListAdminContent: listAdminContent,
    handleListAdminLeads: listAdminLeads,
    handleSaveAdminContent: saveAdminContent,
    handleListContentRevisions: listContentRevisions,
    handleRollbackContent: rollbackContent,
    handleRunSeoCheck: runSeoCheck,
    handleListSeoChecks: listSeoChecks,
    handleRecordGeoSnapshot: recordGeoSnapshot,
    handleListGeoSnapshots: listGeoSnapshots,
    handlePublishContent: publishContent,
    _private: { normalizeLead, mapSite, mapPage, mapProduct, mapSolution, mapCase, mapFaq, loadPublishedSite }
  };
}

module.exports = {
  SITE_KEY,
  createCompanySiteHandlers,
  PUBLIC_EVENTS
};
