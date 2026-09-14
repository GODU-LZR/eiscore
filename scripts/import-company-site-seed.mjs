// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const requireFromRuntime = createRequire(resolve(repoRoot, 'realtime', 'package.json'))
const { Client } = requireFromRuntime('pg')

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...parts] = entry.replace(/^--/, '').split('=')
  return [key, parts.join('=') || true]
}))
const seedPath = resolve(repoRoot, String(args.seed || ''))
const seed = JSON.parse(readFileSync(seedPath, 'utf8'))

const fail = (message) => {
  throw new Error(message)
}
const list = (value) => Array.isArray(value) ? value : []
const json = (value, fallback) => JSON.stringify(value ?? fallback)
const ensureDraft = (records, name) => {
  for (const [index, record] of list(records).entries()) {
    if (record?.status !== 'draft') fail(`${name}[${index}] must remain draft during initialization`)
  }
}

if (seed.seedType !== 'company-site' || seed.schemaVersion !== 1) fail('Unsupported company-site seed contract')
if (seed.applyMode !== 'initialize-only' || seed.initialStatus !== 'draft') fail('Company-site seed must be initialize-only and draft')
if (seed.siteKey !== 'primary') fail('Company-site seed must target siteKey=primary')
for (const [name, records] of Object.entries(seed.content || {})) ensureDraft(records, `content.${name}`)

if (args['dry-run']) {
  console.log(`company-site seed dry-run: ${seed.enterpriseId} (${seed.site.enabledLocales.join(', ')})`)
  process.exit(0)
}

const client = new Client({
  host: process.env.EISCORE_DB_HOST || process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.EISCORE_DB_PORT || process.env.PGPORT || 5432),
  user: process.env.EISCORE_DB_USER || process.env.PGUSER,
  password: process.env.EISCORE_DB_PASSWORD || process.env.PGPASSWORD,
  database: process.env.EISCORE_DB_NAME || process.env.PGDATABASE || 'eiscore'
})

const counts = {}
const insertMany = async (name, records, insert) => {
  counts[name] = 0
  for (const record of list(records)) {
    await insert(record)
    counts[name] += 1
  }
}

await client.connect()
try {
  await client.query('BEGIN')
  const existing = await client.query('SELECT site_key FROM company_site.site_config LIMIT 1')
  if (existing.rowCount) fail('Refusing to overwrite an initialized company-site database')

  const site = seed.site || {}
  await client.query(
    `INSERT INTO company_site.site_config
      (site_key, legal_name, brand_name, brand_short_name, factory_name, domain,
       template_key, default_locale, enabled_locales, theme, contact, social_links,
       trademark, settings, seo, status, published_version, published_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
             $13::jsonb,$14::jsonb,$15::jsonb,'draft',0,'{}'::jsonb)`,
    [seed.siteKey, site.legalName, site.brandName, site.brandShortName, site.factoryName,
      site.domain, site.templateKey, site.defaultLocale, json(site.enabledLocales, []),
      json(site.theme, {}), json(site.contact, {}), json(site.socialLinks, []),
      json(site.trademark, {}), json(site.settings, {}), json(site.seo, {})]
  )

  await insertMany('locales', site.enabledLocales, async (locale) => client.query(
    `INSERT INTO company_site.site_locales
      (site_key, locale, fallback_locale, status, translation_owner)
     VALUES ($1,$2,'','draft',$3)`,
    [seed.siteKey, locale, `enterprise-pack:${seed.enterpriseId}`]
  ))

  const content = seed.content || {}
  await insertMany('pages', content.pages, async (record) => client.query(
    `INSERT INTO company_site.content_pages
      (site_key, locale, slug, page_type, title, summary, blocks, seo, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'draft',$9,$9)`,
    [seed.siteKey, record.locale, record.slug, record.pageType || 'page', record.title || '', record.summary || '',
      json(record.blocks, {}), json(record.seo, {}), `enterprise-pack:${seed.enterpriseId}`]
  ))

  const evidenceIds = new Map()
  await insertMany('evidence', content.evidence, async (record) => {
    const sourceKey = String(record.sourceKey || '').trim()
    if (!sourceKey) fail('Every evidence record must include a sourceKey')
    if (evidenceIds.has(sourceKey)) fail(`Duplicate evidence sourceKey ${sourceKey}`)
    const result = await client.query(
      `INSERT INTO company_site.evidence_records
        (site_key, claim, source_type, source_ref, evidence, verified_by, verified_at, expires_at, status)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'draft')
       RETURNING id`,
      [seed.siteKey, record.claim || '', record.sourceType || 'public_web', record.sourceRef || '',
        json(record.evidence, {}), record.verifiedBy || '', record.verifiedAt || null, record.expiresAt || null]
    )
    evidenceIds.set(sourceKey, result.rows[0].id)
  })

  const resolveEvidenceIds = (record, context) => {
    const resolved = [...list(record.evidenceIds)]
    for (const sourceKey of list(record.evidenceRefs)) {
      const evidenceId = evidenceIds.get(String(sourceKey || '').trim())
      if (!evidenceId) fail(`${context} references unknown evidence sourceKey ${sourceKey}`)
      resolved.push(evidenceId)
    }
    return [...new Set(resolved)]
  }

  const productIds = new Map()
  await insertMany('products', content.products, async (record) => {
    const result = await client.query(
      `INSERT INTO company_site.products
        (site_key, product_code, slug, category, applications, specifications, delivery, evidence_ids, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,'draft',$9,$9)
       RETURNING id`,
      [seed.siteKey, record.productCode, record.slug, record.category || '', json(record.applications, []),
        json(record.specifications, {}), json(record.delivery, {}),
        json(resolveEvidenceIds(record, `Product ${record.productCode}`), []), `enterprise-pack:${seed.enterpriseId}`]
    )
    productIds.set(record.productCode, result.rows[0].id)
  })

  await insertMany('productLocales', content.productLocales, async (record) => {
    const productId = productIds.get(record.productCode)
    if (!productId) fail(`Product locale references unknown productCode ${record.productCode}`)
    const seo = { ...(record.seo || {}) }
    if (Array.isArray(record.applications)) seo.applications = record.applications
    await client.query(
      `INSERT INTO company_site.product_locales
        (product_id, locale, name, summary, description, image_urls, seo, faq, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,'draft')`,
      [productId, record.locale, record.name || '', record.summary || '', record.description || '',
        json(record.imageUrls, []), json(seo, {}), json(record.faq, [])]
    )
  })

  await insertMany('solutions', content.solutions, async (record) => client.query(
    `INSERT INTO company_site.solutions
      (site_key, locale, slug, title, industry, scenario, content, seo, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'draft')`,
    [seed.siteKey, record.locale, record.slug, record.title || '', record.industry || '', record.scenario || '', json(record.content, {}), json(record.seo, {})]
  ))

  await insertMany('cases', content.cases, async (record) => client.query(
    `INSERT INTO company_site.cases
      (site_key, locale, slug, title, industry, scope, content, evidence_ids, public_level, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,'draft')`,
    [seed.siteKey, record.locale, record.slug, record.title || '', record.industry || '', record.scope || '',
      json(record.content, {}), json(resolveEvidenceIds(record, `Case ${record.slug}`), []), record.publicLevel || 'anonymous']
  ))

  await insertMany('knowledge', content.knowledge, async (record) => client.query(
    `INSERT INTO company_site.knowledge_documents
      (site_key, locale, document_type, title, content, citations, forbidden_claims, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,'draft',$8,$8)`,
    [seed.siteKey, record.locale, record.documentType || 'faq', record.title || '', record.content || '',
      json(record.citations, []), json(record.forbiddenClaims, []), `enterprise-pack:${seed.enterpriseId}`]
  ))

  await insertMany('seo', content.seo, async (record) => client.query(
    `INSERT INTO company_site.seo_metadata
      (site_key, locale, path, title, description, canonical, robots, keywords, structured_data, status, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,'draft',$10)`,
    [seed.siteKey, record.locale, record.path, record.title || '', record.description || '', record.canonical || '',
      record.robots || 'index,follow', json(record.keywords, []), json(record.structuredData, {}), `enterprise-pack:${seed.enterpriseId}`]
  ))

  await insertMany('keywords', content.keywords, async (record) => client.query(
    `INSERT INTO company_site.seo_keywords
      (site_key, locale, market, keyword, intent, target_path, priority, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)`,
    [seed.siteKey, record.locale, record.market || '', record.keyword, record.intent || 'informational',
      record.targetPath || '', Math.min(100, Math.max(1, Number(record.priority) || 50)), 'Initialized from a governed draft enterprise package']
  ))

  await client.query(
    `INSERT INTO company_site.audit_events
      (site_key, actor_type, actor_id, action, object_type, object_id, result_code, details)
     VALUES ($1,'system',$2,'site.initialize','site_config',$1,'OK',$3::jsonb)`,
    [seed.siteKey, `enterprise-pack:${seed.enterpriseId}`, json({ enterpriseId: seed.enterpriseId, applyMode: seed.applyMode, status: 'draft' }, {})]
  )
  await client.query('COMMIT')
  console.log(`company-site seed applied: ${seed.enterpriseId} ${JSON.stringify(counts)}`)
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error(`company-site seed failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
