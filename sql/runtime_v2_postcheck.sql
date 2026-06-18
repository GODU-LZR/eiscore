-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Runtime V2 post-apply security and readiness checks.

SET client_encoding = 'UTF8';

DO $$
DECLARE
  v_missing TEXT;
  v_count INTEGER;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('app_data.ontology_table_relations', to_regclass('app_data.ontology_table_relations') IS NOT NULL),
      ('public.v_ontology_kg_nodes', to_regclass('public.v_ontology_kg_nodes') IS NOT NULL),
      ('public.v_ontology_reasoning_facts', to_regclass('public.v_ontology_reasoning_facts') IS NOT NULL),
      ('public.v_ontology_reasoning_health', to_regclass('public.v_ontology_reasoning_health') IS NOT NULL),
      ('public.document_assets', to_regclass('public.document_assets') IS NOT NULL),
      ('public.document_parse_jobs', to_regclass('public.document_parse_jobs') IS NOT NULL),
      ('public.document_entry_plans', to_regclass('public.document_entry_plans') IS NOT NULL),
      ('public.agent_ontology_context(text,integer)', to_regprocedure('public.agent_ontology_context(text,integer)') IS NOT NULL),
      ('public.agent_search_ontology_kg_nodes(text,text,integer)', to_regprocedure('public.agent_search_ontology_kg_nodes(text,text,integer)') IS NOT NULL),
      ('public.agent_upsert_ontology_table_semantic(jsonb)', to_regprocedure('public.agent_upsert_ontology_table_semantic(jsonb)') IS NOT NULL),
      ('public.document_intake_can_view()', to_regprocedure('public.document_intake_can_view()') IS NOT NULL),
      ('public.document_intake_can_manage()', to_regprocedure('public.document_intake_can_manage()') IS NOT NULL)
  ) AS required(object_name, ok)
  WHERE NOT ok;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Runtime V2 required objects are missing: %', v_missing;
  END IF;

  SELECT count(*) INTO v_count
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND table_name LIKE 'ontology_%'
    AND grantee IN ('web_user', 'PUBLIC');

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Raw ontology tables still expose privileges to web_user/PUBLIC: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND table_name LIKE 'v_ontology_%'
    AND privilege_type = 'SELECT'
    AND grantee IN ('web_user', 'PUBLIC');

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Full ontology views still expose SELECT to web_user/PUBLIC: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM information_schema.routine_privileges
  WHERE specific_schema = 'public'
    AND routine_name IN (
      'search_ontology_kg_nodes',
      'query_ontology_kg_neighbors',
      'find_ontology_kg_paths',
      'explain_ontology_path',
      'explain_role_ontology_access'
    )
    AND grantee IN ('web_user', 'PUBLIC');

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Full ontology RPCs still expose EXECUTE to web_user/PUBLIC: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM (
    VALUES
      ('public.agent_ontology_context(text,integer)'),
      ('public.agent_search_ontology_kg_nodes(text,text,integer)'),
      ('public.agent_query_ontology_kg_neighbors(text,text,text,integer,integer,text)'),
      ('public.agent_find_ontology_kg_paths(text,text,text,text,integer,text,integer)'),
      ('public.agent_explain_ontology_path(text,text,text,text,integer)'),
      ('public.agent_explain_role_ontology_access(text,integer)'),
      ('public.agent_upsert_ontology_table_semantic(jsonb)'),
      ('public.document_intake_can_view()'),
      ('public.document_intake_can_manage()')
  ) AS f(signature)
  WHERE NOT has_function_privilege('web_user', f.signature, 'EXECUTE');

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'web_user is missing required safe Runtime V2 EXECUTE privileges: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'collector_devices',
      'collector_watch_folders',
      'document_import_batches',
      'document_assets',
      'document_upload_sessions',
      'document_upload_chunks',
      'document_parse_jobs',
      'document_parse_results',
      'document_classification_results',
      'document_entry_plans',
      'document_business_links',
      'document_unmapped_fields',
      'ai_business_corrections',
      'client_log_sessions',
      'client_log_events'
    )
    AND roles::text LIKE '%web_user%'
    AND (qual = 'true' OR with_check = 'true');

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Document intake RLS still has broad true policies for web_user: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.ontology_table_semantics
  WHERE semantic_name LIKE '%?%'
     OR semantic_description LIKE '%?%';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Garbled ontology table semantics remain: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.ontology_column_semantics
  WHERE semantic_name LIKE '%?%'
     OR semantic_description LIKE '%?%';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Garbled ontology column semantics remain: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.v_ontology_reasoning_health
  WHERE NOT is_healthy;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Ontology reasoning health check is not healthy: %', v_count;
  END IF;
END $$;

SELECT
  'runtime_v2_postcheck_ok' AS status,
  now() AS checked_at,
  (SELECT facts_total FROM public.v_ontology_reasoning_summary LIMIT 1) AS reasoning_facts_total,
  has_function_privilege('web_user', 'public.agent_ontology_context(text,integer)', 'EXECUTE') AS web_user_can_call_agent_context,
  has_function_privilege('web_user', 'public.document_intake_can_view()', 'EXECUTE') AS web_user_can_call_document_view_check;
