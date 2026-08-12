import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync(new URL('../../sql/company_site_platform_v1.sql', import.meta.url), 'utf8');
const seed = fs.readFileSync(new URL('../../sql/company_site_junleyuan_seed.sql', import.meta.url), 'utf8');

const requiredTables = [
  'site_config', 'site_locales', 'content_pages', 'products', 'product_locales',
  'solutions', 'cases', 'media_assets', 'evidence_records', 'knowledge_documents',
  'leads', 'lead_events', 'audit_events', 'certificates', 'seo_metadata',
  'seo_keywords', 'seo_checks', 'geo_answer_snapshots', 'content_revisions',
  'agent_sessions', 'agent_messages', 'agent_qualification_rules',
  'opportunity_drafts', 'quote_drafts', 'sales_order_drafts',
  'production_work_order_drafts', 'sync_jobs', 'agent_audit_events'
];

for (const table of requiredTables) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS company_site\\.${table}\\s*\\(`), `missing table ${table}`);
}

const fixedTenantTables = requiredTables.filter((table) => !['site_config', 'product_locales'].includes(table));
for (const table of fixedTenantTables) {
  const start = schema.indexOf(`CREATE TABLE IF NOT EXISTS company_site.${table}`);
  const end = schema.indexOf('\n);', start);
  const definition = schema.slice(start, end);
  assert.match(definition, /site_key TEXT NOT NULL DEFAULT 'primary'/, `${table} must carry site_key`);
  assert.match(definition, /CHECK \(site_key = 'primary'\)/, `${table} must enforce the single tenant`);
}

assert.match(schema, /REVOKE ALL ON ALL TABLES IN SCHEMA company_site FROM web_anon/);
assert.match(schema, /REVOKE ALL ON ALL TABLES IN SCHEMA company_site FROM web_user/);
assert.match(schema, /ALTER TABLE company_site\.%I ENABLE ROW LEVEL SECURITY/);
assert.match(seed, /'primary'/);
assert.match(seed, /junleyuan\.eissys\.top/);
assert.match(seed, /台州君乐缘体育用品有限公司/);
assert.match(seed, /COMMIT;/);

console.log(`company-site-schema-regression: PASS (${requiredTables.length} tables)`);
