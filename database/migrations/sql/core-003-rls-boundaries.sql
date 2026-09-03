-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- DB3 security follow-up.  DB2 introduced the non-owner Agent role and
-- deliberately kept company_site behind the BFF.  The schema adoption had
-- enabled RLS before policies were designed, which made every company_site
-- table deny the Agent by default.  This migration adds the smallest
-- single-enterprise policies needed by the BFF and hardens the HR tables
-- already exposed through PostgREST.

DO $company_site$
DECLARE
  table_name text;
BEGIN
  -- The BFF is the only company-site data path.  It runs as the dedicated
  -- Agent role and all current rows belong to the single primary site.
  FOREACH table_name IN ARRAY ARRAY[
    'site_config', 'site_locales', 'content_pages', 'products',
    'solutions', 'cases', 'media_assets', 'evidence_records',
    'knowledge_documents', 'leads', 'lead_events', 'audit_events',
    'certificates', 'seo_metadata', 'seo_keywords', 'seo_checks',
    'geo_answer_snapshots', 'content_revisions', 'agent_sessions',
    'agent_messages', 'agent_qualification_rules', 'opportunity_drafts',
    'quote_drafts', 'sales_order_drafts', 'production_work_order_drafts',
    'sync_jobs', 'agent_audit_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS company_site_agent_access ON company_site.%I', table_name);
    EXECUTE format($policy$
      CREATE POLICY company_site_agent_access
        ON company_site.%I
        FOR ALL TO eiscore_agent
        USING (session_user = 'eiscore_agent' AND site_key = 'primary')
        WITH CHECK (session_user = 'eiscore_agent' AND site_key = 'primary')
    $policy$, table_name);
  END LOOP;

  -- product_locales is the only table without site_key.  Its parent product
  -- is the tenant boundary and is itself protected by the policy above.
  EXECUTE 'DROP POLICY IF EXISTS company_site_agent_access ON company_site.product_locales';
  EXECUTE $policy$
    CREATE POLICY company_site_agent_access
      ON company_site.product_locales
      FOR ALL TO eiscore_agent
      USING (
        session_user = 'eiscore_agent'
        AND EXISTS (
          SELECT 1
          FROM company_site.products p
          WHERE p.id = product_locales.product_id
            AND p.site_key = 'primary'
        )
      )
      WITH CHECK (
        session_user = 'eiscore_agent'
        AND EXISTS (
          SELECT 1
          FROM company_site.products p
          WHERE p.id = product_locales.product_id
            AND p.site_key = 'primary'
        )
      )
  $policy$;
END
$company_site$;

DO $hr$
DECLARE
  table_name text;
  view_predicate text := $pred$
    public.document_current_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.document_current_permissions() p
      WHERE p.permission_code = 'module:hr'
         OR p.permission_code LIKE 'app:hr_%'
         OR p.permission_code ~ '^op:hr_.*[.]view$'
    )
  $pred$;
  manage_predicate text := $pred$
    public.document_current_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.document_current_permissions() p
      WHERE p.permission_code ~ '^op:hr_.*[.](create|edit)$'
    )
  $pred$;
  admin_manage_predicate text := $pred$
    public.document_current_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.document_current_role_codes() r
      WHERE lower(r.role_code) = 'hr_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.document_current_permissions() p
      WHERE p.permission_code ~ '^op:hr_.*[.](create|edit)$'
    )
  $pred$;
  payroll_view_predicate text := $pred$
    public.document_current_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.document_current_role_codes() r
      WHERE lower(r.role_code) = 'hr_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.document_current_permissions() p
      WHERE p.permission_code = 'op:hr_payroll.view'
    )
  $pred$;
  payroll_manage_predicate text := $pred$
    public.document_current_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.document_current_role_codes() r
      WHERE lower(r.role_code) = 'hr_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.document_current_permissions() p
      WHERE p.permission_code ~ '^op:hr_payroll[.](create|edit)$'
    )
  $pred$;
BEGIN
  -- All HR base tables retain their existing table grants, but row access is
  -- now denied unless the JWT/user permission matrix authorises the action.
  FOREACH table_name IN ARRAY ARRAY[
    'archives', 'attendance_month_overrides', 'attendance_records',
    'attendance_shifts', 'employee_profiles'
  ] LOOP
    EXECUTE format('ALTER TABLE hr.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS hr_agent_access ON hr.%I', table_name);
    EXECUTE format($policy$
      CREATE POLICY hr_agent_access
        ON hr.%I
        FOR ALL TO eiscore_agent
        USING (session_user = 'eiscore_agent')
        WITH CHECK (session_user = 'eiscore_agent')
    $policy$, table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON hr.%I', 'hr_' || table_name || '_select', table_name);
    EXECUTE format($policy$
      CREATE POLICY hr_%I_select
        ON hr.%I
        FOR SELECT TO web_user
        USING (%s)
    $policy$, 'hr_' || table_name || '_select', table_name, view_predicate);

    EXECUTE format('DROP POLICY IF EXISTS %I ON hr.%I', 'hr_' || table_name || '_insert', table_name);
    EXECUTE format($policy$
      CREATE POLICY hr_%I_insert
        ON hr.%I
        FOR INSERT TO web_user
        WITH CHECK (%s)
    $policy$, 'hr_' || table_name || '_insert', table_name, manage_predicate);

    EXECUTE format('DROP POLICY IF EXISTS %I ON hr.%I', 'hr_' || table_name || '_update', table_name);
    EXECUTE format($policy$
      CREATE POLICY hr_%I_update
        ON hr.%I
        FOR UPDATE TO web_user
        USING (%s)
        WITH CHECK (%s)
    $policy$, 'hr_' || table_name || '_update', table_name, manage_predicate, manage_predicate);

    EXECUTE format('DROP POLICY IF EXISTS %I ON hr.%I', 'hr_' || table_name || '_delete', table_name);
    EXECUTE format($policy$
      CREATE POLICY hr_%I_delete
        ON hr.%I
        FOR DELETE TO web_user
        USING (%s)
    $policy$, 'hr_' || table_name || '_delete', table_name, admin_manage_predicate);
  END LOOP;

  -- Payroll is intentionally narrower than ordinary HR data.  A generic HR
  -- viewer/clerk must not gain salary access merely from module:hr.
  EXECUTE 'ALTER TABLE hr.payroll ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS hr_agent_access ON hr.payroll';
  EXECUTE $policy$
    CREATE POLICY hr_agent_access
      ON hr.payroll
      FOR ALL TO eiscore_agent
      USING (session_user = 'eiscore_agent')
      WITH CHECK (session_user = 'eiscore_agent')
  $policy$;
  EXECUTE 'DROP POLICY IF EXISTS hr_payroll_select ON hr.payroll';
  EXECUTE format($policy$
    CREATE POLICY hr_payroll_select
      ON hr.payroll
      FOR SELECT TO web_user
      USING (%s)
  $policy$, payroll_view_predicate);
  EXECUTE 'DROP POLICY IF EXISTS hr_payroll_insert ON hr.payroll';
  EXECUTE format($policy$
    CREATE POLICY hr_payroll_insert
      ON hr.payroll
      FOR INSERT TO web_user
      WITH CHECK (%s)
  $policy$, payroll_manage_predicate);
  EXECUTE 'DROP POLICY IF EXISTS hr_payroll_update ON hr.payroll';
  EXECUTE format($policy$
    CREATE POLICY hr_payroll_update
      ON hr.payroll
      FOR UPDATE TO web_user
      USING (%s)
      WITH CHECK (%s)
  $policy$, payroll_manage_predicate, payroll_manage_predicate);
  EXECUTE 'DROP POLICY IF EXISTS hr_payroll_delete ON hr.payroll';
  EXECUTE format($policy$
    CREATE POLICY hr_payroll_delete
      ON hr.payroll
      FOR DELETE TO web_user
      USING (%s)
  $policy$, payroll_manage_predicate);

  -- PostgreSQL views otherwise execute as their owner and can bypass RLS on
  -- the underlying attendance table.  Invoker security preserves the same
  -- permission boundary when PostgREST selects the attendance views.
  EXECUTE 'ALTER VIEW hr.v_attendance_daily SET (security_invoker = true)';
  EXECUTE 'ALTER VIEW hr.v_attendance_monthly SET (security_invoker = true)';
END
$hr$;

COMMENT ON SCHEMA company_site IS
  'Single-enterprise configurable company site, SEO/GEO and sales-agent data; BFF access is constrained by company_site_agent_access';
COMMENT ON SCHEMA hr IS
  'HR data exposed through PostgREST with table-level permission RLS; payroll requires HR admin or explicit payroll permission';
