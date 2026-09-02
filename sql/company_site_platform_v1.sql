-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Single-enterprise company site, SEO/GEO and sales-agent foundation.
-- The first release intentionally owns one site configuration only. A future
-- multi-tenant product would require a separate security and billing design.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS company_site;

CREATE TABLE IF NOT EXISTS company_site.site_config (
  site_key TEXT PRIMARY KEY DEFAULT 'primary' CHECK (site_key = 'primary'),
  legal_name TEXT NOT NULL,
  brand_name TEXT NOT NULL DEFAULT '',
  brand_short_name TEXT NOT NULL DEFAULT '',
  factory_name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL UNIQUE,
  template_key TEXT NOT NULL DEFAULT 'manufacturer-editorial-v1',
  default_locale TEXT NOT NULL DEFAULT 'zh-CN',
  enabled_locales JSONB NOT NULL DEFAULT '["zh-CN"]'::jsonb,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  trademark JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended', 'archived')),
  published_version INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  published_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.site_locales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  fallback_locale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  translation_owner TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, locale)
);

CREATE TABLE IF NOT EXISTS company_site.content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'page',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'expired', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  published_by TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, locale, slug)
);

CREATE TABLE IF NOT EXISTS company_site.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  applications JSONB NOT NULL DEFAULT '[]'::jsonb,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'expired', 'archived')),
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, product_code),
  UNIQUE (site_key, slug)
);

CREATE TABLE IF NOT EXISTS company_site.product_locales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES company_site.products(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  faq JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'expired', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, locale)
);

CREATE TABLE IF NOT EXISTS company_site.solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'expired', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, locale, slug)
);

CREATE TABLE IF NOT EXISTS company_site.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '',
  delivery_date DATE,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  public_level TEXT NOT NULL DEFAULT 'anonymous' CHECK (public_level IN ('named', 'anonymous', 'internal')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'expired', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, locale, slug)
);

CREATE TABLE IF NOT EXISTS company_site.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  width INTEGER,
  height INTEGER,
  alt_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  license JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'expired', 'archived')),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, storage_key)
);

CREATE TABLE IF NOT EXISTS company_site.evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'internal_document',
  source_ref TEXT NOT NULL DEFAULT '',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_by TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'expired', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  document_type TEXT NOT NULL DEFAULT 'faq',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  effective_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'expired', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref TEXT NOT NULL UNIQUE,
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'website',
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  page_path TEXT NOT NULL DEFAULT '',
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_name TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  product_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  quantity TEXT NOT NULL DEFAULT '',
  target_date TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  consent JSONB NOT NULL DEFAULT '{}'::jsonb,
  qualification JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'assigned', 'contacted', 'won', 'lost', 'spam', 'archived')),
  owner_id TEXT NOT NULL DEFAULT '',
  source_session_id TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS company_site.lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  lead_id UUID REFERENCES company_site.leads(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL DEFAULT '',
  event_name TEXT NOT NULL,
  page_path TEXT NOT NULL DEFAULT '',
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE SET NULL,
  trace_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  object_type TEXT NOT NULL DEFAULT '',
  object_id TEXT NOT NULL DEFAULT '',
  input_hash TEXT NOT NULL DEFAULT '',
  result_code TEXT NOT NULL DEFAULT 'OK',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  name TEXT NOT NULL,
  certificate_number TEXT NOT NULL DEFAULT '',
  issuer TEXT NOT NULL DEFAULT '',
  valid_from DATE,
  valid_to DATE,
  public_level TEXT NOT NULL DEFAULT 'internal' CHECK (public_level IN ('public', 'login', 'internal')),
  media_asset_id UUID,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'expired', 'archived')),
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.seo_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  canonical TEXT NOT NULL DEFAULT '',
  robots TEXT NOT NULL DEFAULT 'index,follow',
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, locale, path)
);

CREATE TABLE IF NOT EXISTS company_site.seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT '',
  keyword TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'informational',
  target_path TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, locale, market, keyword)
);

CREATE TABLE IF NOT EXISTS company_site.seo_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  check_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.geo_answer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  platform TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  accuracy_status TEXT NOT NULL DEFAULT 'pending' CHECK (accuracy_status IN ('pending', 'accurate', 'needs_correction', 'obsolete')),
  checked_by TEXT NOT NULL DEFAULT '',
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.content_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, object_type, object_id, version)
);

CREATE TABLE IF NOT EXISTS company_site.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'website',
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  visitor_hash TEXT NOT NULL DEFAULT '',
  consent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'human_handoff', 'closed', 'archived')),
  lead_id UUID REFERENCES company_site.leads(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES company_site.agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content_redacted TEXT NOT NULL DEFAULT '',
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_site.agent_qualification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_delta INTEGER NOT NULL DEFAULT 0,
  active_from TIMESTAMPTZ,
  active_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'retired')),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, version)
);

CREATE TABLE IF NOT EXISTS company_site.opportunity_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES company_site.leads(id) ON DELETE RESTRICT,
  source_session_id UUID REFERENCES company_site.agent_sessions(id) ON DELETE SET NULL,
  product_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_amount NUMERIC(18, 2),
  currency TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'new',
  qualification JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'synced', 'archived')),
  idempotency_key TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS company_site.quote_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES company_site.opportunity_drafts(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  valid_until DATE,
  price_source TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'synced', 'archived')),
  idempotency_key TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS company_site.sales_order_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES company_site.quote_drafts(id) ON DELETE RESTRICT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_date DATE,
  inventory_check JSONB NOT NULL DEFAULT '{}'::jsonb,
  bom_check JSONB NOT NULL DEFAULT '{}'::jsonb,
  capacity_check JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'synced', 'archived')),
  idempotency_key TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS company_site.production_work_order_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES company_site.sales_order_drafts(id) ON DELETE RESTRICT,
  planned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  material_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  capacity_risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'synced', 'archived')),
  idempotency_key TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS company_site.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  target_system TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'dead_letter')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error TEXT NOT NULL DEFAULT '',
  source_trace_id TEXT NOT NULL DEFAULT '',
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_key, target_system, idempotency_key)
);

CREATE TABLE IF NOT EXISTS company_site.agent_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL DEFAULT 'primary' CHECK (site_key = 'primary') REFERENCES company_site.site_config(site_key) ON DELETE CASCADE,
  trace_id TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT NOT NULL DEFAULT '',
  session_id UUID REFERENCES company_site.agent_sessions(id) ON DELETE SET NULL,
  tool_id TEXT NOT NULL DEFAULT '',
  input_hash TEXT NOT NULL DEFAULT '',
  result_code TEXT NOT NULL DEFAULT 'OK',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pages_public_lookup_idx
  ON company_site.content_pages (site_key, locale, status, slug);
CREATE INDEX IF NOT EXISTS products_public_lookup_idx
  ON company_site.products (site_key, status, slug);
CREATE INDEX IF NOT EXISTS product_locales_public_lookup_idx
  ON company_site.product_locales (locale, status, product_id);
CREATE INDEX IF NOT EXISTS leads_inbox_idx
  ON company_site.leads (site_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_events_lookup_idx
  ON company_site.lead_events (site_key, event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_public_lookup_idx
  ON company_site.knowledge_documents (site_key, locale, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS seo_checks_lookup_idx
  ON company_site.seo_checks (site_key, path, severity, status, checked_at DESC);
CREATE INDEX IF NOT EXISTS geo_snapshots_lookup_idx
  ON company_site.geo_answer_snapshots (site_key, locale, platform, checked_at DESC);
CREATE INDEX IF NOT EXISTS agent_messages_session_idx
  ON company_site.agent_messages (site_key, session_id, created_at);
CREATE INDEX IF NOT EXISTS agent_sessions_inbox_idx
  ON company_site.agent_sessions (site_key, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS agent_audit_trace_idx
  ON company_site.agent_audit_events (site_key, trace_id, created_at);
CREATE INDEX IF NOT EXISTS sync_jobs_ready_idx
  ON company_site.sync_jobs (site_key, status, next_retry_at, created_at);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'site_config', 'site_locales', 'content_pages', 'products', 'product_locales',
    'solutions', 'cases', 'media_assets', 'evidence_records', 'knowledge_documents',
    'leads', 'lead_events', 'audit_events', 'certificates', 'seo_metadata',
    'seo_keywords', 'seo_checks', 'geo_answer_snapshots', 'content_revisions',
    'agent_sessions', 'agent_messages', 'agent_qualification_rules',
    'opportunity_drafts', 'quote_drafts', 'sales_order_drafts',
    'production_work_order_drafts', 'sync_jobs', 'agent_audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE company_site.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

-- The public site is served through the company-site BFF. Do not expose these
-- tables through PostgREST until the single-site policies are reviewed.
REVOKE ALL ON ALL TABLES IN SCHEMA company_site FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA company_site FROM web_anon;
REVOKE ALL ON ALL TABLES IN SCHEMA company_site FROM web_user;
GRANT USAGE ON SCHEMA company_site TO postgres;

COMMENT ON SCHEMA company_site IS 'Single-enterprise configurable company site, SEO/GEO knowledge and sales-agent leads';
