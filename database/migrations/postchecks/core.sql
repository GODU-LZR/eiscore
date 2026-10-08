-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

DO $$
DECLARE
  login_definition text := pg_get_functiondef('public.login(text,text)'::regprocedure);
  insert_definition text := pg_get_functiondef('public.tg_v_users_manage_insert()'::regprocedure);
  login_config text[];
  role_row record;
  superuser_count integer;
  bypassrls_count integer;
  twin_model_default text;
BEGIN
  SELECT proconfig
    INTO login_config
  FROM pg_proc
  WHERE oid = 'public.login(text,text)'::regprocedure;

  IF position('app.jwt_secret' IN login_definition) = 0
     OR position(concat('my', '_super', '_secret') IN login_definition) > 0 THEN
    RAISE EXCEPTION 'public.login does not externalize its JWT signing secret';
  END IF;

  IF NOT coalesce(login_config, ARRAY[]::text[]) @> ARRAY['search_path=pg_catalog, public'] THEN
    RAISE EXCEPTION 'public.login does not pin its search_path';
  END IF;

  IF position('tenant_id' IN login_definition) = 0
     OR EXISTS (SELECT 1 FROM public.users WHERE tenant_id IS NULL OR btrim(tenant_id) = '') THEN
    RAISE EXCEPTION 'Harness login must bind a non-empty tenant identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'ontology_column_semantics', 'ontology_inference_rules', 'ontology_inferred_facts',
      'ontology_reasoning_runs', 'ontology_table_semantics', 'v_ontology_coverage_audit',
      'v_ontology_kg_nodes', 'v_ontology_reasoning_edges', 'v_ontology_reasoning_facts',
      'v_ontology_reasoning_health', 'v_ontology_reasoning_rule_stats',
      'v_ontology_reasoning_summary', 'v_ontology_role_access_insights',
      'v_ontology_sensitive_access_paths', 'v_ontology_table_dependency_paths',
      'v_ontology_table_impact_insights'
    ]) AS relation_name
    WHERE has_table_privilege('web_user', format('public.%I', relation_name), 'SELECT')
  ) THEN
    RAISE EXCEPTION 'raw ontology diagnostics must not be readable by web_user';
  END IF;

  IF has_function_privilege('web_user', 'public.search_ontology_kg_nodes(text,text,integer)', 'EXECUTE')
     OR has_function_privilege('web_user', 'public.query_ontology_kg_neighbors(text,text,text,integer,integer,text)', 'EXECUTE')
     OR has_function_privilege('web_user', 'public.find_ontology_kg_paths(text,text,text,text,integer,text,integer)', 'EXECUTE')
     OR has_function_privilege('web_user', 'public.explain_ontology_path(text,text,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('web_user', 'public.explain_role_ontology_access(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'raw ontology graph RPCs must remain behind the scoped Agent boundary';
  END IF;

  IF position('gen_random_bytes' IN insert_definition) = 0
     OR position(concat('123', '456') IN insert_definition) > 0 THEN
    RAISE EXCEPTION 'public.tg_v_users_manage_insert still has a fixed password fallback';
  END IF;

  FOR role_row IN
    SELECT rolname, rolcanlogin, rolinherit
    FROM pg_roles
    WHERE rolname IN ('eiscore_owner', 'eiscore_migrator', 'eiscore_authenticator', 'eiscore_agent', 'web_anon', 'web_user')
  LOOP
    IF role_row.rolname IN ('eiscore_owner', 'eiscore_migrator', 'web_anon', 'web_user') AND role_row.rolcanlogin THEN
      RAISE EXCEPTION '% must not be a login role', role_row.rolname;
    END IF;
    IF role_row.rolname IN ('eiscore_owner', 'eiscore_migrator', 'eiscore_authenticator', 'eiscore_agent')
       AND role_row.rolinherit THEN
      RAISE EXCEPTION '% must be NOINHERIT', role_row.rolname;
    END IF;
  END LOOP;

  SELECT count(*) INTO superuser_count
  FROM pg_roles
  WHERE rolname IN ('eiscore_owner', 'eiscore_migrator', 'eiscore_authenticator', 'eiscore_agent', 'web_anon', 'web_user')
    AND rolsuper;
  IF superuser_count <> 0 THEN
    RAISE EXCEPTION 'database service roles must not be superusers';
  END IF;

  SELECT count(*) INTO bypassrls_count
  FROM pg_roles
  WHERE rolname IN ('eiscore_owner', 'eiscore_migrator', 'eiscore_authenticator', 'eiscore_agent', 'web_anon', 'web_user')
    AND rolbypassrls;
  IF bypassrls_count <> 0 THEN
    RAISE EXCEPTION 'database service roles must not bypass RLS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles authenticator
    JOIN pg_auth_members m ON m.member = authenticator.oid
    JOIN pg_roles target ON target.oid = m.roleid
    WHERE authenticator.rolname = 'eiscore_authenticator' AND target.rolname = 'web_anon'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_roles authenticator
    JOIN pg_auth_members m ON m.member = authenticator.oid
    JOIN pg_roles target ON target.oid = m.roleid
    WHERE authenticator.rolname = 'eiscore_authenticator' AND target.rolname = 'web_user'
  ) THEN
    RAISE EXCEPTION 'authenticator role must be able to switch to web_anon and web_user';
  END IF;

  IF NOT has_schema_privilege('eiscore_agent', 'public', 'USAGE')
     OR NOT has_table_privilege('eiscore_agent', 'public.document_assets', 'SELECT')
     OR NOT has_function_privilege('eiscore_agent', 'public.document_intake_can_manage()', 'EXECUTE')
     OR NOT has_function_privilege('eiscore_agent', 'scm.stock_in(integer,uuid,numeric,text,text,text,text,date,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'agent role is missing its documented database access';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow')
      AND has_function_privilege('public', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'PUBLIC still has execute privileges on an application function';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow')
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) setting
        WHERE setting LIKE 'search_path=%'
      )
  ) THEN
    RAISE EXCEPTION 'a SECURITY DEFINER function does not pin search_path';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_namespace n
    WHERE n.nspname IN ('public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow')
      AND has_schema_privilege('public', n.oid, 'CREATE')
  ) THEN
    RAISE EXCEPTION 'PUBLIC can still create objects in an application schema';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname IN ('public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow')
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
      AND r.rolname <> 'eiscore_owner'
  ) OR EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname IN ('public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow')
      AND r.rolname <> 'eiscore_owner'
  ) THEN
    RAISE EXCEPTION 'an application object is not owned by eiscore_owner';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'company_site'
      AND c.relkind = 'r'
      AND c.relname = ANY (ARRAY[
        'site_config', 'site_locales', 'content_pages', 'products',
        'product_locales', 'solutions', 'cases', 'media_assets',
        'evidence_records', 'knowledge_documents', 'leads', 'lead_events',
        'audit_events', 'certificates', 'seo_metadata', 'seo_keywords',
        'seo_checks', 'geo_answer_snapshots', 'content_revisions',
        'agent_sessions', 'agent_messages', 'agent_qualification_rules',
        'opportunity_drafts', 'quote_drafts', 'sales_order_drafts',
        'production_work_order_drafts', 'sync_jobs', 'agent_audit_events'
      ])
      AND c.relrowsecurity
  ) <> 28 THEN
    RAISE EXCEPTION 'company_site must keep RLS enabled on all 28 tables';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'company_site'
      AND c.relname = ANY (ARRAY[
        'site_config', 'site_locales', 'content_pages', 'products',
        'product_locales', 'solutions', 'cases', 'media_assets',
        'evidence_records', 'knowledge_documents', 'leads', 'lead_events',
        'audit_events', 'certificates', 'seo_metadata', 'seo_keywords',
        'seo_checks', 'geo_answer_snapshots', 'content_revisions',
        'agent_sessions', 'agent_messages', 'agent_qualification_rules',
        'opportunity_drafts', 'quote_drafts', 'sales_order_drafts',
        'production_work_order_drafts', 'sync_jobs', 'agent_audit_events'
      ])
      AND p.polname = 'company_site_agent_access'
  ) <> 28 THEN
    RAISE EXCEPTION 'company_site Agent policy coverage is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'hr'
      AND c.relname IN (
        'archives', 'attendance_month_overrides', 'attendance_records',
        'attendance_shifts', 'employee_profiles', 'payroll',
        'user_employee_links'
      )
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'all HR base tables must have RLS enabled';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'hr'
      AND p.polname = 'hr_agent_access'
  ) <> 7 THEN
    RAISE EXCEPTION 'HR Agent policy coverage is incomplete';
  END IF;

  IF to_regclass('hr.user_employee_links') IS NULL
     OR to_regprocedure('hr.current_user_id()') IS NULL
     OR to_regprocedure('hr.current_employee_archive_id()') IS NULL
     OR to_regprocedure('hr.can_access_employee(bigint,text)') IS NULL
     OR to_regprocedure('hr.can_manage_employee_links()') IS NULL THEN
    RAISE EXCEPTION 'HR stable user-to-employee identity bridge is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'hr.user_employee_links'::regclass
      AND contype = 'p'
  ) OR (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = 'hr.user_employee_links'::regclass
      AND contype = 'f'
  ) <> 3 OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'hr.user_employee_links'::regclass
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'HR identity bridge keys are incomplete';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'hr'
      AND c.relname IN (
        'archives', 'employee_profiles', 'attendance_records',
        'attendance_month_overrides', 'payroll'
      )
      AND p.polcmd = 'r'
      AND position('can_access_employee' IN pg_get_expr(p.polqual, p.polrelid)) > 0
  ) <> 5 THEN
    RAISE EXCEPTION 'employee-bearing HR select policies must enforce stable row scope';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'hr'
      AND c.relname IN (
        'archives', 'attendance_month_overrides', 'attendance_records',
        'attendance_shifts', 'employee_profiles'
      )
      AND p.polname LIKE 'hr_hr_%'
  ) THEN
    RAISE EXCEPTION 'legacy generated HR policy names remain installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'hr'
      AND c.relname = 'payroll'
      AND p.polname = 'hr_payroll_select'
  ) THEN
    RAISE EXCEPTION 'payroll must have an explicit narrow select policy';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'hr'
      AND c.relname IN ('v_attendance_daily', 'v_attendance_monthly')
      AND c.reloptions @> ARRAY['security_invoker=true']::text[]
  ) <> 2 THEN
    RAISE EXCEPTION 'attendance views must use security_invoker';
  END IF;

  IF to_regclass('app_center.data_app_table_registry') IS NULL
     OR to_regclass('app_center.data_app_ddl_audit') IS NULL
     OR to_regprocedure('app_center.create_data_app_table(uuid,text,jsonb)') IS NULL
     OR to_regprocedure('app_center.create_data_app_table_legacy_v1(uuid,text,jsonb)') IS NULL
     OR to_regprocedure('app_center.apply_data_app_table_security(text)') IS NULL THEN
    RAISE EXCEPTION 'dynamic data-app DDL governance objects are incomplete';
  END IF;

  IF has_function_privilege('web_anon', 'app_center.create_data_app_table(uuid,text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('web_user', 'app_center.create_data_app_table(uuid,text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('eiscore_agent', 'app_center.create_data_app_table(uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('web_user', 'app_center.create_data_app_table_legacy_v1(uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('eiscore_agent', 'app_center.create_data_app_table_legacy_v1(uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('web_user', 'app_center.apply_data_app_table_security(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'dynamic data-app DDL function privileges are unsafe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN app_center.data_app_table_registry r
      ON r.table_schema = n.nspname AND r.table_name = c.relname
    WHERE n.nspname = 'app_data'
      AND c.relkind IN ('r', 'p')
      AND c.relname LIKE 'data_app\_%' ESCAPE '\'
      AND r.table_name IS NULL
  ) THEN
    RAISE EXCEPTION 'a legacy dynamic data-app table is missing recovery metadata';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app_center.data_app_table_registry r
    LEFT JOIN pg_class c
      ON c.oid = to_regclass(format('%I.%I', r.table_schema, r.table_name))
    WHERE c.oid IS NULL
       OR NOT c.relrowsecurity
       OR has_table_privilege('web_anon', c.oid, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'a governed dynamic data-app table is missing RLS or still grants anonymous access';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app_center.data_app_table_registry r
    WHERE r.lifecycle = 'managed' AND r.app_id IS NULL
       OR r.lifecycle = 'quarantined' AND r.app_id IS NOT NULL
  ) OR EXISTS (
    SELECT app_id
    FROM app_center.data_app_table_registry
    WHERE app_id IS NOT NULL
    GROUP BY app_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'dynamic data-app registry one-to-one binding is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app_center.data_app_table_registry r
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_policy p
      WHERE p.polrelid = to_regclass(format('%I.%I', r.table_schema, r.table_name))
        AND p.polname = 'dynamic_data_app_web_user'
    ) OR NOT EXISTS (
      SELECT 1
      FROM pg_policy p
      WHERE p.polrelid = to_regclass(format('%I.%I', r.table_schema, r.table_name))
        AND p.polname = 'dynamic_data_app_agent'
    )
  ) THEN
    RAISE EXCEPTION 'dynamic data-app RLS policy coverage is incomplete';
  END IF;

  IF to_regclass('app_data.eiscore_chain_test_records') IS NOT NULL THEN
    RAISE EXCEPTION 'the reusable full-chain test table must not remain in the installed product database';
  END IF;

  IF to_regclass('public.debug_me') IS NOT NULL THEN
    RAISE EXCEPTION 'the unaudited public JWT debug view must not remain installed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.system_configs
    WHERE key = 'ai_glm_config'
  ) THEN
    RAISE EXCEPTION 'legacy ai_glm_config must not remain in system_configs';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    WHERE p.polrelid = 'public.system_configs'::regclass
      AND p.polname = 'system_configs_web_anon_select'
      AND pg_get_expr(p.polqual, p.polrelid) LIKE '%ai_glm_config%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    WHERE p.polrelid = 'public.system_configs'::regclass
      AND p.polname = 'system_configs_web_user_manage'
      AND pg_get_expr(p.polqual, p.polrelid) LIKE '%ai_glm_config%'
      AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%ai_glm_config%'
  ) THEN
    RAISE EXCEPTION 'system_configs legacy AI key exclusion policies are incomplete';
  END IF;

  SELECT pg_get_expr(d.adbin, d.adrelid)
    INTO twin_model_default
  FROM pg_attrdef d
  JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE d.adrelid = 'app_data.twin_sessions'::regclass
    AND a.attname = 'model';

  IF twin_model_default NOT LIKE '%deepseek-harness%' THEN
    RAISE EXCEPTION 'digital twin sessions must default to DeepSeek Harness';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app_data.twin_sessions
    WHERE model IS DISTINCT FROM 'deepseek-harness'
  ) THEN
    RAISE EXCEPTION 'digital twin sessions contain a retired model marker';
  END IF;
END
$$;
