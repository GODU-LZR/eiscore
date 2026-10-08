--
-- PostgreSQL database dump
--

\restrict EISCOREDBBASELINEV100000000000000000000000000000000000000000000

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_center; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_center;


--
-- Name: app_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_data;


--
-- Name: basic_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA basic_auth;


--
-- Name: company_site; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA company_site;


--
-- Name: SCHEMA company_site; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA company_site IS 'Single-enterprise configurable company site, SEO/GEO knowledge and sales-agent leads';


--
-- Name: eiscore_meta; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA eiscore_meta;


--
-- Name: hr; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA hr;


--
-- Name: scm; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA scm;


--
-- Name: SCHEMA scm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA scm IS '???????-????????????';


--
-- Name: workflow; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA workflow;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: jwt_token; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.jwt_token AS (
	role text,
	exp integer,
	username text
);


--
-- Name: create_data_app_table(uuid, text, jsonb); Type: FUNCTION; Schema: app_center; Owner: -
--

CREATE FUNCTION app_center.create_data_app_table(app_id uuid, table_name text, columns jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  final_name TEXT;
  col JSONB;
  col_name TEXT;
  col_type TEXT;
  col_kind TEXT;
  col_label TEXT;
  col_semantic_class TEXT;
  app_display_name TEXT;
  app_semantics_mode TEXT;
  claims JSONB := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  actor_username TEXT := COALESCE(NULLIF(claims ->> 'username', ''), NULLIF(current_setting('request.jwt.claim.username', true), ''), 'unknown');
  audit_input JSONB;
  touched_columns TEXT[] := ARRAY['id', 'created_at', 'updated_at', 'properties']::TEXT[];
BEGIN
  IF table_name IS NULL OR length(trim(table_name)) = 0 THEN
    final_name := 'data_app_' || substring(app_id::TEXT FROM 1 FOR 8);
  ELSE
    final_name := table_name;
  END IF;

  -- sanitize identifier
  final_name := lower(regexp_replace(final_name, '[^a-z0-9_]+', '_', 'g'));
  IF final_name !~ '^[a-z]' THEN
    final_name := 't_' || final_name;
  END IF;

  audit_input := jsonb_build_object(
    'action', 'create_data_app_table',
    'app_id', app_id,
    'table_name', final_name,
    'columns_count', CASE
      WHEN columns IS NOT NULL AND jsonb_typeof(columns) = 'array' THEN jsonb_array_length(columns)
      ELSE 0
    END,
    'actor', actor_username
  );

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS app_data.%I (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), properties JSONB DEFAULT ''{}''::jsonb)',
    final_name
  );

  EXECUTE format('GRANT SELECT ON TABLE app_data.%I TO web_anon', final_name);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_data.%I TO web_user', final_name);

  EXECUTE format(
    'ALTER TABLE app_data.%I ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT ''{}''::jsonb',
    final_name
  );

  SELECT COALESCE(NULLIF(TRIM(a.name), ''), final_name)
    INTO app_display_name
    FROM app_center.apps a
   WHERE a.id = app_id
   LIMIT 1;

  SELECT COALESCE(NULLIF(TRIM(a.config ->> 'semantics_mode'), ''), 'ai_defined')
    INTO app_semantics_mode
    FROM app_center.apps a
   WHERE a.id = app_id
   LIMIT 1;

  app_display_name := COALESCE(app_display_name, final_name);
  app_semantics_mode := COALESCE(app_semantics_mode, 'ai_defined');

  PERFORM app_center.log_semantic_event(
    app_id,
    'semantic_auto_enrich',
    'running',
    audit_input,
    jsonb_build_object('stage', 'started', 'semantics_mode', app_semantics_mode),
    NULL
  );

  IF to_regclass('public.ontology_column_semantics') IS NOT NULL THEN
    INSERT INTO public.ontology_column_semantics (
      table_schema,
      table_name,
      column_name,
      semantic_class,
      semantic_name,
      semantic_description,
      data_type,
      ui_type,
      is_sensitive,
      source,
      tags,
      is_active,
      updated_at
    )
    SELECT
      'app_data',
      final_name,
      sys_col.column_name,
      sys_col.semantic_class,
      sys_col.semantic_name,
      format('???????????%s???????', sys_col.semantic_name),
      sys_col.data_type,
      sys_col.ui_type,
      false,
      'system_column_default',
      jsonb_build_array(
        'app_data',
        'column',
        'system',
        format('semantics:%s', app_semantics_mode),
        app_id::text
      ),
      true,
      now()
    FROM (
      VALUES
        ('id', 'business_attribute', '????', 'uuid', 'uuid'),
        ('created_at', 'time_attribute', '????', 'timestamp with time zone', 'datetime'),
        ('updated_at', 'time_attribute', '????', 'timestamp with time zone', 'datetime'),
        ('properties', 'json_attribute', '????', 'jsonb', 'json')
    ) AS sys_col(column_name, semantic_class, semantic_name, data_type, ui_type)
    ON CONFLICT ON CONSTRAINT ontology_column_semantics_pkey DO UPDATE
    SET semantic_class = EXCLUDED.semantic_class,
        semantic_name = EXCLUDED.semantic_name,
        semantic_description = EXCLUDED.semantic_description,
        data_type = EXCLUDED.data_type,
        ui_type = EXCLUDED.ui_type,
        is_sensitive = EXCLUDED.is_sensitive,
        source = EXCLUDED.source,
        tags = EXCLUDED.tags,
        is_active = true,
        updated_at = now();
  END IF;

  IF columns IS NULL OR jsonb_typeof(columns) <> 'array' THEN
    PERFORM app_center.log_semantic_event(
      app_id,
      'semantic_auto_enrich',
      'completed',
      audit_input,
      jsonb_build_object('table', 'app_data.' || final_name, 'semantics_mode', app_semantics_mode, 'reason', 'no_columns'),
      NULL
    );
    RETURN 'app_data.' || final_name;
  END IF;

  FOR col IN SELECT * FROM jsonb_array_elements(columns)
  LOOP
    col_name := coalesce(col->>'field', '');
    col_name := lower(regexp_replace(col_name, '[^a-z0-9_]+', '_', 'g'));
    IF col_name = '' THEN
      CONTINUE;
    END IF;
    IF col_name !~ '^[a-z]' THEN
      col_name := 'f_' || col_name;
    END IF;

    col_kind := lower(coalesce(col->>'type', 'text'));
    col_type := col_kind;
    IF col_type IN ('int', 'integer') THEN
      col_type := 'integer';
    ELSIF col_type IN ('number', 'numeric', 'float', 'double') THEN
      col_type := 'numeric';
    ELSIF col_type IN ('bool', 'boolean') THEN
      col_type := 'boolean';
    ELSIF col_type IN ('date') THEN
      col_type := 'date';
    ELSIF col_type IN ('datetime', 'timestamp', 'timestamptz') THEN
      col_type := 'timestamptz';
    ELSE
      col_type := 'text';
    END IF;

    EXECUTE format(
      'ALTER TABLE app_data.%I ADD COLUMN IF NOT EXISTS %I %s',
      final_name,
      col_name,
      col_type
    );

    IF NOT col_name = ANY(touched_columns) THEN
      touched_columns := array_append(touched_columns, col_name);
    END IF;

    IF to_regclass('public.ontology_column_semantics') IS NOT NULL THEN
      col_label := COALESCE(NULLIF(TRIM(col->>'label'), ''), col_name);
      col_semantic_class := CASE
        WHEN col_kind IN ('select', 'dropdown') THEN 'enum_attribute'
        WHEN col_kind = 'cascader' THEN 'hierarchy_attribute'
        WHEN col_kind = 'geo' THEN 'geo_attribute'
        WHEN col_kind = 'file' THEN 'file_attribute'
        WHEN col_kind = 'formula' THEN 'derived_metric'
        ELSE 'business_attribute'
      END;

      INSERT INTO public.ontology_column_semantics (
        table_schema,
        table_name,
        column_name,
        semantic_class,
        semantic_name,
        semantic_description,
        data_type,
        ui_type,
        is_sensitive,
        source,
        tags,
        is_active,
        updated_at
      )
      VALUES (
        'app_data',
        final_name,
        col_name,
        col_semantic_class,
        col_label,
        format('???%s???????', col_label),
        col_type,
        col_kind,
        (col_name ~* '(phone|mobile|idcard|id_no|bank|salary|wage|email|address|geo|location|password|secret|token)'),
        'rule_fallback',
        jsonb_build_array(
          'app_data',
          'column',
          format('ui:%s', col_kind),
          format('semantics:%s', app_semantics_mode),
          app_id::text
        ),
        true,
        now()
      )
      ON CONFLICT ON CONSTRAINT ontology_column_semantics_pkey DO UPDATE
      SET semantic_class = EXCLUDED.semantic_class,
          semantic_name = EXCLUDED.semantic_name,
          semantic_description = EXCLUDED.semantic_description,
          data_type = EXCLUDED.data_type,
          ui_type = EXCLUDED.ui_type,
          is_sensitive = EXCLUDED.is_sensitive,
          source = EXCLUDED.source,
          tags = EXCLUDED.tags,
          is_active = true,
          updated_at = now();
    END IF;
  END LOOP;

  IF to_regclass('public.ontology_column_semantics') IS NOT NULL THEN
    UPDATE public.ontology_column_semantics ocs
    SET is_active = false,
        updated_at = now()
    WHERE ocs.table_schema = 'app_data'
      AND ocs.table_name = final_name
      AND NOT (ocs.column_name = ANY(touched_columns));
  END IF;

  -- Compatibility-only ontology enrichment:
  -- keep existing ACL model unchanged, and only upsert semantic metadata.
  IF to_regclass('public.ontology_table_semantics') IS NOT NULL THEN
    INSERT INTO public.ontology_table_semantics (
      table_schema,
      table_name,
      semantic_domain,
      semantic_class,
      semantic_name,
      semantic_description,
      is_business,
      tags,
      is_active,
      updated_at
    )
    VALUES (
      'app_data',
      final_name,
      'app_data',
      'dynamic_data_app',
      format(U&'\52A8\6001\4E1A\52A1\8868\5355(%s)', app_display_name),
      format(U&'\5E94\7528\4E2D\5FC3\6570\636E\5E94\7528\201C%s\201D\5BF9\5E94\4E1A\52A1\8868', app_display_name),
      true,
      jsonb_build_array('app_data', 'dynamic', 'business', app_id::text, format('semantics:%s', app_semantics_mode)),
      true,
      now()
    )
    ON CONFLICT ON CONSTRAINT ontology_table_semantics_pkey DO UPDATE
    SET semantic_domain = EXCLUDED.semantic_domain,
        semantic_class = EXCLUDED.semantic_class,
        semantic_name = EXCLUDED.semantic_name,
        semantic_description = EXCLUDED.semantic_description,
        is_business = EXCLUDED.is_business,
        tags = EXCLUDED.tags,
        is_active = true,
        updated_at = now();
  END IF;

  PERFORM pg_notify('pgrst', 'reload schema');

  PERFORM app_center.log_semantic_event(
    app_id,
    'semantic_auto_enrich',
    'completed',
    audit_input,
    jsonb_build_object(
      'table', 'app_data.' || final_name,
      'columns_upserted', COALESCE(array_length(touched_columns, 1), 0),
      'semantics_mode', app_semantics_mode
    ),
    NULL
  );

  RETURN 'app_data.' || final_name;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    PERFORM app_center.log_semantic_event(
      app_id,
      'semantic_auto_enrich',
      'failed',
      audit_input,
      jsonb_build_object('table', 'app_data.' || COALESCE(final_name, '')),
      SQLERRM
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE;
END;
$$;


--
-- Name: generate_route_path(uuid, character varying); Type: FUNCTION; Schema: app_center; Owner: -
--

CREATE FUNCTION app_center.generate_route_path(app_id uuid, app_type character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    base_path VARCHAR;
    unique_suffix VARCHAR;
BEGIN
    base_path := '/apps/' || app_type || '/' || SUBSTRING(app_id::TEXT FROM 1 FOR 8);
    unique_suffix := '';
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM app_center.published_routes WHERE route_path = base_path || unique_suffix) LOOP
        unique_suffix := '-' || (RANDOM() * 1000)::INT;
    END LOOP;
    
    RETURN base_path || unique_suffix;
END;
$$;


--
-- Name: log_semantic_event(uuid, text, text, jsonb, jsonb, text); Type: FUNCTION; Schema: app_center; Owner: -
--

CREATE FUNCTION app_center.log_semantic_event(app_id uuid, task_id text, status text, input_data jsonb DEFAULT '{}'::jsonb, output_data jsonb DEFAULT '{}'::jsonb, error_message text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  claims JSONB := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  app_role TEXT := COALESCE(NULLIF(claims ->> 'app_role', ''), NULLIF(current_setting('request.jwt.claim.app_role', true), ''));
  actor_username TEXT := COALESCE(NULLIF(claims ->> 'username', ''), NULLIF(current_setting('request.jwt.claim.username', true), ''), 'unknown');
  normalized_status TEXT := lower(COALESCE(status, 'completed'));
BEGIN
  IF to_regclass('app_center.execution_logs') IS NULL THEN
    RETURN;
  END IF;

  IF app_role IS DISTINCT FROM 'super_admin' THEN
    RETURN;
  END IF;

  IF normalized_status NOT IN ('pending', 'running', 'completed', 'failed') THEN
    normalized_status := 'completed';
  END IF;

  INSERT INTO app_center.execution_logs (
    app_id,
    task_id,
    status,
    input_data,
    output_data,
    error_message,
    executed_by,
    executed_at,
    operation_location
  )
  VALUES (
    app_id,
    LEFT(COALESCE(task_id, 'semantic_auto_enrich'), 100),
    normalized_status,
    COALESCE(input_data, '{}'::jsonb),
    COALESCE(output_data, '{}'::jsonb),
    error_message,
    actor_username,
    now(),
    jsonb_build_object(
      'address',
      concat_ws(
        ' / ',
        '??:????',
        CASE WHEN app_id IS NULL THEN NULL ELSE '??ID:' || app_id::text END,
        '??:' || LEFT(COALESCE(task_id, 'semantic_auto_enrich'), 100)
      ),
      'module', '????',
      'app_id', COALESCE(app_id::text, ''),
      'action', LEFT(COALESCE(task_id, 'semantic_auto_enrich'), 100),
      'source', 'semantic_event'
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- audit must not block main business path
  RETURN;
END;
$$;


--
-- Name: update_timestamp(); Type: FUNCTION; Schema: app_center; Owner: -
--

CREATE FUNCTION app_center.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: validate_bpmn_xml(text); Type: FUNCTION; Schema: app_center; Owner: -
--

CREATE FUNCTION app_center.validate_bpmn_xml(xml_content text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Basic validation: check for required BPMN namespace
    RETURN xml_content LIKE '%xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"%';
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


--
-- Name: init_attendance_records(date, text); Type: FUNCTION; Schema: hr; Owner: -
--

CREATE FUNCTION hr.init_attendance_records(p_date date, p_dept_name text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
  inserted_count integer;
begin
  insert into hr.attendance_records (
    att_date,
    person_type,
    employee_id,
    employee_name,
    employee_no,
    dept_name
  )
  select
    p_date,
    'employee',
    e.id,
    e.name,
    e.employee_no,
    coalesce(e.department, '???')
  from hr.archives e
  where (p_dept_name is null or e.department = p_dept_name)
    and not exists (
      select 1
      from hr.attendance_records r
      where r.att_date = p_date
        and r.person_type = 'employee'
        and r.employee_id = e.id
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;


--
-- Name: agent_explain_ontology_path(text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text DEFAULT NULL::text, p_object_id text DEFAULT NULL::text, p_max_depth integer DEFAULT 4) RETURNS TABLE(depth integer, terminal_type text, terminal_id text, terminal_label text, path_text text, path_facts jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    raw_paths AS (
        SELECT p.*
        FROM public.explain_ontology_path(
            p_subject_type,
            p_subject_id,
            p_object_type,
            p_object_id,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 4), 4))
        ) p
    )
    SELECT p.*
    FROM raw_paths p
    JOIN visible_nodes subject_node
      ON subject_node.node_type = p_subject_type
     AND subject_node.node_id = p_subject_id
    JOIN visible_nodes terminal_node
      ON terminal_node.node_type = p.terminal_type
     AND terminal_node.node_id = p.terminal_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p.path_facts) AS fact(item)
        LEFT JOIN visible_nodes subject_visible
          ON subject_visible.node_type = fact.item ->> 'subject_type'
         AND subject_visible.node_id = fact.item ->> 'subject_id'
        LEFT JOIN visible_nodes object_visible
          ON object_visible.node_type = fact.item ->> 'object_type'
         AND object_visible.node_id = fact.item ->> 'object_id'
        WHERE subject_visible.node_id IS NULL
           OR object_visible.node_id IS NULL
    )
    ORDER BY p.depth, p.path_text
    LIMIT 100;
$$;


--
-- Name: FUNCTION agent_explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer) IS 'Agent-safe role-scoped ontology path explanation';


--
-- Name: agent_explain_role_ontology_access(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_explain_role_ontology_access(p_role_code text DEFAULT NULL::text, p_limit integer DEFAULT 200) RETURNS TABLE(role_code text, role_name text, fact_id bigint, predicate text, target_type text, target_id text, target_label text, table_id text, column_id text, action_key text, permission_code text, inference_rule text, rule_name text, path_text text, evidence jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_roles AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    )
    SELECT e.*
    FROM public.explain_role_ontology_access(
        CASE
            WHEN public.ontology_current_is_super() THEN NULLIF(p_role_code, '')
            ELSE NULL
        END,
        GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000))
    ) e
    WHERE public.ontology_current_is_super()
       OR e.role_code IN (SELECT role_code FROM visible_roles)
    ORDER BY
        CASE e.predicate
            WHEN 'risk:canAccessSensitiveColumn' THEN 1
            WHEN 'acl:canAccessTable' THEN 2
            WHEN 'acl:canOperateTable' THEN 3
            WHEN 'acl:canAccessApp' THEN 4
            ELSE 5
        END,
        e.role_code,
        e.target_type,
        e.target_id,
        e.fact_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;


--
-- Name: FUNCTION agent_explain_role_ontology_access(p_role_code text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_explain_role_ontology_access(p_role_code text, p_limit integer) IS 'Agent-safe role access explanation; non-super roles can inspect only themselves';


--
-- Name: agent_find_ontology_kg_paths(text, text, text, text, integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer DEFAULT 4, p_direction text DEFAULT 'outgoing'::text, p_limit integer DEFAULT 20) RETURNS TABLE(depth integer, source_type text, source_id text, target_type text, target_id text, target_label text, path_text text, path_nodes text[], path_edges bigint[], path_facts jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    raw_paths AS (
        SELECT p.*
        FROM public.find_ontology_kg_paths(
            p_source_type,
            p_source_id,
            p_target_type,
            p_target_id,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 4), 4)),
            p_direction,
            GREATEST(20, LEAST(COALESCE(p_limit, 20) * 10, 200))
        ) p
    )
    SELECT p.*
    FROM raw_paths p
    JOIN visible_nodes source_node
      ON source_node.node_type = p_source_type
     AND source_node.node_id = p_source_id
    JOIN visible_nodes target_node
      ON target_node.node_type = p_target_type
     AND target_node.node_id = p_target_id
    WHERE true
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(p.path_nodes) AS pn(node_key)
          LEFT JOIN visible_nodes path_node
            ON path_node.node_type = split_part(pn.node_key, ':', 1)
           AND path_node.node_id = regexp_replace(pn.node_key, '^[^:]+:', '')
          WHERE path_node.node_id IS NULL
      )
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(p.path_edges) AS pe(edge_id)
          JOIN public.v_ontology_reasoning_edges path_edge
            ON path_edge.id = pe.edge_id
          LEFT JOIN visible_nodes path_edge_subject
            ON path_edge_subject.node_type = path_edge.subject_type
           AND path_edge_subject.node_id = path_edge.subject_id
          LEFT JOIN visible_nodes path_edge_object
            ON path_edge_object.node_type = path_edge.object_type
           AND path_edge_object.node_id = path_edge.object_id
          WHERE path_edge_subject.node_id IS NULL
             OR path_edge_object.node_id IS NULL
      )
    ORDER BY p.depth, p.path_text
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;


--
-- Name: FUNCTION agent_find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer) IS 'Agent-safe role-scoped ontology KG path search';


--
-- Name: agent_ontology_context(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_context(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 80) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH params AS (
        SELECT
            NULLIF(p_query, '') AS query_text,
            GREATEST(10, LEAST(COALESCE(p_limit, 80), 200)) AS row_limit
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    permissions AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    accessible_tables AS (
        SELECT table_id, access_level FROM public.ontology_current_accessible_tables()
    ),
    visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    table_rows AS (
        SELECT
            t.table_schema,
            t.table_name,
            t.semantic_name,
            t.semantic_description,
            t.semantic_domain,
            t.semantic_class,
            t.is_business,
            at.access_level,
            t.tags
        FROM accessible_tables at
        JOIN public.ontology_table_semantics t
          ON at.table_id = t.table_schema || '.' || t.table_name
        CROSS JOIN params p
        WHERE t.is_active = true
          AND (
              p.query_text IS NULL
              OR t.table_schema || '.' || t.table_name ILIKE '%' || p.query_text || '%'
              OR t.semantic_name ILIKE '%' || p.query_text || '%'
              OR t.semantic_description ILIKE '%' || p.query_text || '%'
              OR t.semantic_domain ILIKE '%' || p.query_text || '%'
              OR t.semantic_class ILIKE '%' || p.query_text || '%'
          )
        ORDER BY t.semantic_domain, t.table_schema, t.table_name
        LIMIT (SELECT row_limit FROM params)
    ),
    column_rows AS (
        SELECT
            c.table_schema,
            c.table_name,
            c.column_name,
            c.semantic_name,
            c.semantic_class,
            c.data_type,
            c.ui_type,
            c.is_sensitive,
            c.tags
        FROM public.ontology_column_semantics c
        JOIN accessible_tables at
          ON at.table_id = c.table_schema || '.' || c.table_name
        JOIN visible_nodes vn
          ON vn.node_type = 'column'
         AND vn.node_id = c.table_schema || '.' || c.table_name || '.' || c.column_name
        CROSS JOIN params p
        WHERE c.is_active = true
          AND (
              p.query_text IS NULL
              OR c.table_schema || '.' || c.table_name || '.' || c.column_name ILIKE '%' || p.query_text || '%'
              OR c.semantic_name ILIKE '%' || p.query_text || '%'
              OR c.semantic_class ILIKE '%' || p.query_text || '%'
          )
        ORDER BY c.table_schema, c.table_name, c.column_name
        LIMIT LEAST((SELECT row_limit * 8 FROM params), 1000)
    ),
    relation_rows AS (
        SELECT
            r.id,
            r.relation_type,
            r.subject_table,
            r.subject_column,
            r.predicate,
            r.object_table,
            r.object_column,
            r.bridge_table,
            r.subject_semantic_name,
            r.object_semantic_name,
            r.details
        FROM app_data.ontology_table_relations r
        JOIN accessible_tables st ON st.table_id = r.subject_table
        JOIN accessible_tables ot ON ot.table_id = r.object_table
        CROSS JOIN params p
        WHERE (
              p.query_text IS NULL
              OR r.subject_table ILIKE '%' || p.query_text || '%'
              OR r.object_table ILIKE '%' || p.query_text || '%'
              OR r.subject_semantic_name ILIKE '%' || p.query_text || '%'
              OR r.object_semantic_name ILIKE '%' || p.query_text || '%'
              OR r.predicate ILIKE '%' || p.query_text || '%'
        )
        ORDER BY r.relation_type, r.subject_table, r.object_table, r.predicate
        LIMIT LEAST((SELECT row_limit * 3 FROM params), 500)
    ),
    app_rows AS (
        SELECT DISTINCT
            v.app_id::TEXT AS app_id,
            v.app_name,
            v.app_type,
            v.permission_code,
            v.acl_module,
            v.qualified_table,
            v.semantic_name,
            v.semantic_domain,
            v.semantic_class
        FROM public.v_app_form_ontology v
        JOIN public.ontology_current_accessible_apps() a ON a.app_id = v.app_id::TEXT
        CROSS JOIN params p
        WHERE (
              p.query_text IS NULL
              OR v.app_name ILIKE '%' || p.query_text || '%'
              OR v.permission_code ILIKE '%' || p.query_text || '%'
              OR v.qualified_table ILIKE '%' || p.query_text || '%'
              OR v.semantic_name ILIKE '%' || p.query_text || '%'
        )
        ORDER BY v.app_name, v.app_id::TEXT
        LIMIT (SELECT row_limit FROM params)
    ),
    permission_rows AS (
        SELECT
            po.code,
            po.scope,
            po.semantic_kind,
            po.entity_key,
            po.action_key
        FROM public.v_permission_ontology po
        JOIN permissions p ON p.permission_code = po.code
        ORDER BY po.code
        LIMIT LEAST((SELECT row_limit * 4 FROM params), 500)
    ),
    node_rows AS (
        SELECT n.*
        FROM public.agent_search_ontology_kg_nodes(
            (SELECT query_text FROM params),
            NULL,
            (SELECT row_limit FROM params)
        ) n
    ),
    health AS (
        SELECT row_to_json(h)::jsonb AS value
        FROM public.v_ontology_reasoning_health h
        LIMIT 1
    )
    SELECT jsonb_build_object(
        'fetchedAt', NOW(),
        'source', 'agent_ontology_context_v1',
        'accessPolicy', jsonb_build_object(
            'roleScoped', true,
            'superUser', public.ontology_current_is_super(),
            'username', public.ontology_current_username(),
            'roles', COALESCE((SELECT jsonb_agg(role_code ORDER BY role_code) FROM role_codes), '[]'::jsonb),
            'permissionCount', COALESCE((SELECT COUNT(*) FROM permissions), 0),
            'sensitiveColumnPolicy', 'hide unless current role can access the column'
        ),
        'health', COALESCE((SELECT value FROM health), '{}'::jsonb),
        'tables', COALESCE((
            SELECT jsonb_agg(to_jsonb(t) ORDER BY t.semantic_domain, t.table_schema, t.table_name)
            FROM table_rows t
        ), '[]'::jsonb),
        'columns', COALESCE((
            SELECT jsonb_object_agg(table_id, columns)
            FROM (
                SELECT
                    c.table_schema || '.' || c.table_name AS table_id,
                    jsonb_agg(jsonb_build_object(
                        'col', c.column_name,
                        'name', c.semantic_name,
                        'cls', c.semantic_class,
                        'type', c.data_type,
                        'ui', c.ui_type,
                        'sensitive', c.is_sensitive
                    ) ORDER BY c.column_name) AS columns
                FROM column_rows c
                GROUP BY c.table_schema, c.table_name
            ) grouped
        ), '{}'::jsonb),
        'relations', COALESCE((
            SELECT jsonb_agg(to_jsonb(r) ORDER BY r.relation_type, r.subject_table, r.object_table)
            FROM relation_rows r
        ), '[]'::jsonb),
        'apps', COALESCE((
            SELECT jsonb_agg(to_jsonb(a) ORDER BY a.app_name, a.app_id)
            FROM app_rows a
        ), '[]'::jsonb),
        'permissions', COALESCE((
            SELECT jsonb_agg(to_jsonb(p) ORDER BY p.code)
            FROM permission_rows p
        ), '[]'::jsonb),
        'kgNodes', COALESCE((
            SELECT jsonb_agg(to_jsonb(n) ORDER BY n.total_degree DESC, n.node_type, n.node_label)
            FROM node_rows n
        ), '[]'::jsonb)
    );
$$;


--
-- Name: FUNCTION agent_ontology_context(p_query text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_context(p_query text, p_limit integer) IS 'Compact role-scoped ontology/KG context for all agents';


--
-- Name: agent_ontology_reasoning_facts(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_reasoning_facts(p_predicate text DEFAULT NULL::text, p_limit integer DEFAULT 200) RETURNS TABLE(id bigint, subject_type text, subject_id text, subject_label text, predicate text, object_type text, object_id text, object_label text, inference_rule text, rule_name text, inference_depth integer, is_inferred boolean, evidence jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
    SELECT
        f.id,
        f.subject_type,
        f.subject_id,
        f.subject_label,
        f.predicate,
        f.object_type,
        f.object_id,
        f.object_label,
        f.inference_rule,
        f.rule_name,
        f.inference_depth,
        f.is_inferred,
        f.evidence
    FROM public.v_ontology_reasoning_facts f
    JOIN visible_nodes s
      ON s.node_type = f.subject_type
     AND s.node_id = f.subject_id
    JOIN visible_nodes o
      ON o.node_type = f.object_type
     AND o.node_id = f.object_id
    WHERE NULLIF(p_predicate, '') IS NULL OR f.predicate = p_predicate
    ORDER BY f.is_inferred DESC, f.inference_depth ASC, f.id ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;


--
-- Name: FUNCTION agent_ontology_reasoning_facts(p_predicate text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_reasoning_facts(p_predicate text, p_limit integer) IS 'Agent-safe role-scoped ontology reasoning facts';


--
-- Name: agent_ontology_reasoning_health(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_reasoning_health() RETURNS TABLE(id integer, is_healthy boolean, health_code text, facts_total integer, inferred_facts integer, api_relations integer, semanticized_relations integer, ontology_columns integer, semanticized_columns integer, missing_relation_semantics integer, missing_column_semantics integer, last_run_status text, last_finished_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH summary AS (
        SELECT * FROM public.agent_ontology_reasoning_summary()
    ),
    accessible_tables AS (
        SELECT table_id FROM public.ontology_current_accessible_tables()
    ),
    visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    relation_rows AS (
        SELECT r.*
        FROM app_data.ontology_table_relations r
        JOIN accessible_tables st ON st.table_id = r.subject_table
        JOIN accessible_tables ot ON ot.table_id = r.object_table
    ),
    column_rows AS (
        SELECT c.*
        FROM public.ontology_column_semantics c
        JOIN visible_nodes n
          ON n.node_type = 'column'
         AND n.node_id = c.table_schema || '.' || c.table_name || '.' || c.column_name
        WHERE c.is_active = true
    ),
    counts AS (
        SELECT
            (SELECT COUNT(*)::INTEGER FROM relation_rows) AS api_relations,
            (SELECT COUNT(*)::INTEGER FROM relation_rows r WHERE COALESCE(r.subject_semantic_name, '') <> '' AND COALESCE(r.object_semantic_name, '') <> '') AS semanticized_relations,
            (SELECT COUNT(*)::INTEGER FROM relation_rows r WHERE COALESCE(r.subject_semantic_name, '') = '' OR COALESCE(r.object_semantic_name, '') = '') AS missing_relation_semantics,
            (SELECT COUNT(*)::INTEGER FROM column_rows) AS ontology_columns,
            (SELECT COUNT(*)::INTEGER FROM column_rows c WHERE COALESCE(c.semantic_name, '') <> '') AS semanticized_columns,
            (SELECT COUNT(*)::INTEGER FROM column_rows c WHERE COALESCE(c.semantic_name, '') = '') AS missing_column_semantics
    )
    SELECT
        1::INTEGER AS id,
        (s.last_run_status = 'completed' AND c.missing_relation_semantics = 0 AND c.missing_column_semantics = 0) AS is_healthy,
        CASE
            WHEN s.last_run_status <> 'completed' THEN 'reasoning_not_completed'
            WHEN c.missing_relation_semantics > 0 OR c.missing_column_semantics > 0 THEN 'scoped_semantic_gaps'
            ELSE 'scoped_ok'
        END AS health_code,
        s.facts_total,
        s.inferred_facts,
        c.api_relations,
        c.semanticized_relations,
        c.ontology_columns,
        c.semanticized_columns,
        c.missing_relation_semantics,
        c.missing_column_semantics,
        s.last_run_status,
        s.last_finished_at
    FROM summary s
    CROSS JOIN counts c;
$$;


--
-- Name: FUNCTION agent_ontology_reasoning_health(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_reasoning_health() IS 'Agent-safe role-scoped reasoning health and semantic coverage';


--
-- Name: agent_ontology_reasoning_rule_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_reasoning_rule_stats(p_limit integer DEFAULT 50) RETURNS TABLE(rule_code text, rule_name text, declared_predicate text, facts_total integer, seed_facts integer, inferred_facts integer, predicate_count integer, is_active boolean, min_depth integer, max_depth integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    visible_facts AS (
        SELECT f.*
        FROM public.v_ontology_reasoning_facts f
        JOIN visible_nodes s
          ON s.node_type = f.subject_type
         AND s.node_id = f.subject_id
        JOIN visible_nodes o
          ON o.node_type = f.object_type
         AND o.node_id = f.object_id
    ),
    fact_stats AS (
        SELECT
            vf.inference_rule AS rule_code,
            COUNT(*)::INTEGER AS facts_total,
            COUNT(*) FILTER (WHERE NOT vf.is_inferred)::INTEGER AS seed_facts,
            COUNT(*) FILTER (WHERE vf.is_inferred)::INTEGER AS inferred_facts,
            COUNT(DISTINCT vf.predicate)::INTEGER AS predicate_count,
            MIN(vf.inference_depth)::INTEGER AS min_depth,
            MAX(vf.inference_depth)::INTEGER AS max_depth
        FROM visible_facts vf
        GROUP BY vf.inference_rule
    )
    SELECT
        r.rule_code,
        r.rule_name,
        r.predicate AS declared_predicate,
        COALESCE(fs.facts_total, 0)::INTEGER AS facts_total,
        COALESCE(fs.seed_facts, 0)::INTEGER AS seed_facts,
        COALESCE(fs.inferred_facts, 0)::INTEGER AS inferred_facts,
        COALESCE(fs.predicate_count, 0)::INTEGER AS predicate_count,
        r.is_active,
        fs.min_depth,
        fs.max_depth
    FROM public.ontology_inference_rules r
    LEFT JOIN fact_stats fs ON fs.rule_code = r.rule_code
    WHERE public.ontology_current_is_super()
       OR COALESCE(fs.facts_total, 0) > 0
    ORDER BY COALESCE(fs.inferred_facts, 0) DESC, COALESCE(fs.facts_total, 0) DESC, r.rule_code ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;


--
-- Name: FUNCTION agent_ontology_reasoning_rule_stats(p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_reasoning_rule_stats(p_limit integer) IS 'Agent-safe reasoning rule stats based on visible facts';


--
-- Name: agent_ontology_reasoning_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_reasoning_summary() RETURNS TABLE(last_run_status text, facts_total integer, seed_facts integer, inferred_facts integer, active_rules integer, role_app_access_facts integer, role_table_access_facts integer, workflow_transition_facts integer, sensitive_exposure_facts integer, transitive_dependency_facts integer, last_finished_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    visible_facts AS (
        SELECT f.*
        FROM public.v_ontology_reasoning_facts f
        JOIN visible_nodes s
          ON s.node_type = f.subject_type
         AND s.node_id = f.subject_id
        JOIN visible_nodes o
          ON o.node_type = f.object_type
         AND o.node_id = f.object_id
    ),
    latest AS (
        SELECT s.last_run_status, s.last_finished_at
        FROM public.v_ontology_reasoning_summary s
        LIMIT 1
    )
    SELECT
        COALESCE((SELECT last_run_status FROM latest), 'unknown') AS last_run_status,
        COUNT(*)::INTEGER AS facts_total,
        COUNT(*) FILTER (WHERE NOT vf.is_inferred)::INTEGER AS seed_facts,
        COUNT(*) FILTER (WHERE vf.is_inferred)::INTEGER AS inferred_facts,
        (SELECT COUNT(*)::INTEGER FROM public.ontology_inference_rules r WHERE r.is_active = true) AS active_rules,
        COUNT(*) FILTER (WHERE vf.predicate = 'acl:canAccessApp')::INTEGER AS role_app_access_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'acl:canAccessTable')::INTEGER AS role_table_access_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'wf:canPerformTransition')::INTEGER AS workflow_transition_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'risk:canAccessSensitiveColumn')::INTEGER AS sensitive_exposure_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'ontology:transitivelyDependsOn')::INTEGER AS transitive_dependency_facts,
        (SELECT last_finished_at FROM latest) AS last_finished_at
    FROM visible_facts vf;
$$;


--
-- Name: FUNCTION agent_ontology_reasoning_summary(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_reasoning_summary() IS 'Agent-safe role-scoped reasoning summary';


--
-- Name: agent_ontology_role_access_insights(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_role_access_insights(p_limit integer DEFAULT 50) RETURNS TABLE(role_code text, role_name text, accessible_apps integer, accessible_tables integer, operable_tables integer, sensitive_columns integer, sensitive_tables integer, inferred_permission_paths integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_roles AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    )
    SELECT
        v.role_code,
        v.role_name,
        v.accessible_apps,
        v.accessible_tables,
        v.operable_tables,
        v.sensitive_columns,
        v.sensitive_tables,
        v.inferred_permission_paths
    FROM public.v_ontology_role_access_insights v
    WHERE public.ontology_current_is_super()
       OR v.role_code IN (SELECT role_code FROM visible_roles)
    ORDER BY v.sensitive_columns DESC, v.accessible_apps DESC, v.role_code ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;


--
-- Name: FUNCTION agent_ontology_role_access_insights(p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_role_access_insights(p_limit integer) IS 'Agent-safe role access insight rows';


--
-- Name: agent_ontology_sensitive_access_paths(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_sensitive_access_paths(p_limit integer DEFAULT 50) RETURNS TABLE(role_code text, role_name text, table_id text, table_label text, column_id text, column_name text, column_label text, access_rule text, access_predicate text, inference_rule text, rule_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_roles AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
    SELECT
        v.role_code,
        v.role_name,
        v.table_id,
        v.table_label,
        v.column_id,
        v.column_name,
        v.column_label,
        v.access_rule,
        v.access_predicate,
        v.inference_rule,
        v.rule_name
    FROM public.v_ontology_sensitive_access_paths v
    JOIN public.ontology_current_accessible_tables() t ON t.table_id = v.table_id
    JOIN visible_nodes c ON c.node_type = 'column' AND c.node_id = v.column_id
    WHERE public.ontology_current_is_super()
       OR v.role_code IN (SELECT role_code FROM visible_roles)
    ORDER BY v.role_code ASC, v.table_id ASC, v.column_name ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;


--
-- Name: FUNCTION agent_ontology_sensitive_access_paths(p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_sensitive_access_paths(p_limit integer) IS 'Agent-safe sensitive access path rows';


--
-- Name: agent_ontology_table_impact_insights(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_ontology_table_impact_insights(p_limit integer DEFAULT 50) RETURNS TABLE(table_id text, table_label text, sensitive_columns integer, roles_can_access integer, roles_can_operate integer, direct_dependent_tables integer, transitive_dependent_tables integer, depends_on_tables integer, has_reasoning_impact boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    SELECT
        v.table_id,
        v.table_label,
        v.sensitive_columns,
        v.roles_can_access,
        v.roles_can_operate,
        v.direct_dependent_tables,
        v.transitive_dependent_tables,
        v.depends_on_tables,
        v.has_reasoning_impact
    FROM public.v_ontology_table_impact_insights v
    JOIN public.ontology_current_accessible_tables() t ON t.table_id = v.table_id
    WHERE v.has_reasoning_impact = true
    ORDER BY v.transitive_dependent_tables DESC, v.roles_can_access DESC, v.table_id ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;


--
-- Name: FUNCTION agent_ontology_table_impact_insights(p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_ontology_table_impact_insights(p_limit integer) IS 'Agent-safe table impact insights filtered by current role table access';


--
-- Name: agent_query_ontology_kg_neighbors(text, text, text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text DEFAULT 'both'::text, p_max_depth integer DEFAULT 1, p_limit integer DEFAULT 200, p_predicate text DEFAULT NULL::text) RETURNS TABLE(depth integer, edge_direction text, from_type text, from_id text, from_label text, predicate text, to_type text, to_id text, to_label text, edge_id bigint, edge_subject_type text, edge_subject_id text, edge_object_type text, edge_object_id text, inference_rule text, rule_name text, is_inferred boolean, confidence numeric, path_text text, path_nodes text[], path_edges bigint[], evidence jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    raw_neighbors AS (
        SELECT q.*
        FROM public.query_ontology_kg_neighbors(
            p_node_type,
            p_node_id,
            p_direction,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 1), 4)),
            1000,
            p_predicate
        ) q
    )
    SELECT q.*
    FROM raw_neighbors q
    JOIN visible_nodes start_node
      ON start_node.node_type = p_node_type
     AND start_node.node_id = p_node_id
    JOIN visible_nodes from_node
      ON from_node.node_type = q.from_type
     AND from_node.node_id = q.from_id
    JOIN visible_nodes to_node
      ON to_node.node_type = q.to_type
     AND to_node.node_id = q.to_id
    JOIN public.v_ontology_reasoning_edges current_edge
      ON current_edge.id = q.edge_id
    JOIN visible_nodes current_edge_subject
      ON current_edge_subject.node_type = current_edge.subject_type
     AND current_edge_subject.node_id = current_edge.subject_id
    JOIN visible_nodes current_edge_object
      ON current_edge_object.node_type = current_edge.object_type
     AND current_edge_object.node_id = current_edge.object_id
    WHERE true
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(q.path_nodes) AS pn(node_key)
          LEFT JOIN visible_nodes path_node
            ON path_node.node_type = split_part(pn.node_key, ':', 1)
           AND path_node.node_id = regexp_replace(pn.node_key, '^[^:]+:', '')
          WHERE path_node.node_id IS NULL
      )
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(q.path_edges) AS pe(edge_id)
          JOIN public.v_ontology_reasoning_edges path_edge
            ON path_edge.id = pe.edge_id
          LEFT JOIN visible_nodes path_edge_subject
            ON path_edge_subject.node_type = path_edge.subject_type
           AND path_edge_subject.node_id = path_edge.subject_id
          LEFT JOIN visible_nodes path_edge_object
            ON path_edge_object.node_type = path_edge.object_type
           AND path_edge_object.node_id = path_edge.object_id
          WHERE path_edge_subject.node_id IS NULL
             OR path_edge_object.node_id IS NULL
      )
    ORDER BY q.depth, q.edge_direction, q.predicate, q.to_type, q.to_id, q.edge_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
$$;


--
-- Name: FUNCTION agent_query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text) IS 'Agent-safe role-scoped ontology KG neighbor traversal';


--
-- Name: agent_search_ontology_kg_nodes(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_search_ontology_kg_nodes(p_query text DEFAULT NULL::text, p_node_type text DEFAULT NULL::text, p_limit integer DEFAULT 50) RETURNS TABLE(id integer, node_key text, node_type text, node_id text, node_label text, semantic_domain text, semantic_class text, is_sensitive boolean, outgoing_edges integer, incoming_edges integer, total_degree integer, predicate_count integer, predicates jsonb, tags jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
    SELECT
        n.id,
        n.node_key,
        n.node_type,
        n.node_id,
        n.node_label,
        n.semantic_domain,
        n.semantic_class,
        n.is_sensitive,
        n.outgoing_edges,
        n.incoming_edges,
        n.total_degree,
        n.predicate_count,
        n.predicates,
        n.tags
    FROM public.v_ontology_kg_nodes n
    JOIN visible_nodes vn
      ON vn.node_type = n.node_type
     AND vn.node_id = n.node_id
    WHERE true
      AND (NULLIF(p_node_type, '') IS NULL OR n.node_type = p_node_type)
      AND (
          NULLIF(p_query, '') IS NULL
          OR n.node_id ILIKE '%' || p_query || '%'
          OR n.node_label ILIKE '%' || p_query || '%'
          OR n.semantic_class ILIKE '%' || p_query || '%'
          OR n.semantic_domain ILIKE '%' || p_query || '%'
      )
    ORDER BY n.total_degree DESC, n.node_type, n.node_label, n.node_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 300));
$$;


--
-- Name: FUNCTION agent_search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer) IS 'Agent-safe role-scoped ontology KG node search';


--
-- Name: agent_upsert_ontology_table_semantic(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_upsert_ontology_table_semantic(p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $_$
DECLARE
    v_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
    v_table_schema TEXT;
    v_table_name TEXT;
    v_semantic_domain TEXT;
    v_semantic_class TEXT;
    v_semantic_name TEXT;
    v_semantic_description TEXT;
    v_is_business BOOLEAN;
    v_is_active BOOLEAN;
    v_tags JSONB;
    v_row public.ontology_table_semantics%ROWTYPE;
BEGIN
    IF NOT public.ontology_current_can_manage_semantics() THEN
        RAISE EXCEPTION 'ontology semantic write denied for current role'
            USING ERRCODE = '42501';
    END IF;

    v_table_schema := NULLIF(btrim(v_payload ->> 'table_schema'), '');
    v_table_name := NULLIF(btrim(v_payload ->> 'table_name'), '');

    IF v_table_schema IS NULL OR v_table_name IS NULL THEN
        RAISE EXCEPTION 'table_schema and table_name are required'
            USING ERRCODE = '22023';
    END IF;

    IF v_table_schema !~ '^[A-Za-z_][A-Za-z0-9_]*$'
       OR v_table_name !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN
        RAISE EXCEPTION 'table_schema or table_name is invalid'
            USING ERRCODE = '22023';
    END IF;

    v_semantic_domain := COALESCE(NULLIF(btrim(v_payload ->> 'semantic_domain'), ''), 'general');
    v_semantic_class := COALESCE(NULLIF(btrim(v_payload ->> 'semantic_class'), ''), 'entity');
    v_semantic_name := COALESCE(
        NULLIF(btrim(v_payload ->> 'semantic_name'), ''),
        NULLIF(btrim(v_payload ->> 'semantic_label'), ''),
        NULLIF(btrim(v_payload ->> 'label'), ''),
        v_table_name
    );
    v_semantic_description := COALESCE(
        NULLIF(btrim(v_payload ->> 'semantic_description'), ''),
        NULLIF(btrim(v_payload ->> 'description'), ''),
        ''
    );
    v_is_business := COALESCE((v_payload ->> 'is_business')::boolean, true);
    v_is_active := COALESCE((v_payload ->> 'is_active')::boolean, true);
    v_tags := CASE
        WHEN jsonb_typeof(v_payload -> 'tags') IS NOT NULL THEN v_payload -> 'tags'
        ELSE '[]'::jsonb
    END;

    INSERT INTO public.ontology_table_semantics (
        table_schema,
        table_name,
        semantic_domain,
        semantic_class,
        semantic_name,
        semantic_description,
        is_business,
        is_active,
        tags,
        updated_at
    )
    VALUES (
        v_table_schema,
        v_table_name,
        v_semantic_domain,
        v_semantic_class,
        v_semantic_name,
        v_semantic_description,
        v_is_business,
        v_is_active,
        v_tags,
        now()
    )
    ON CONFLICT (table_schema, table_name)
    DO UPDATE SET
        semantic_domain = EXCLUDED.semantic_domain,
        semantic_class = EXCLUDED.semantic_class,
        semantic_name = EXCLUDED.semantic_name,
        semantic_description = EXCLUDED.semantic_description,
        is_business = EXCLUDED.is_business,
        is_active = EXCLUDED.is_active,
        tags = EXCLUDED.tags,
        updated_at = now()
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$_$;


--
-- Name: FUNCTION agent_upsert_ontology_table_semantic(p_payload jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agent_upsert_ontology_table_semantic(p_payload jsonb) IS 'Agent-safe ontology table semantic upsert for ontology admins only';


--
-- Name: apply_role_permission_templates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_role_permission_templates() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
declare
  _count integer := 0;
begin
  with
  s1 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p on true
    where r.code = 'super_admin'
    on conflict do nothing
    returning 1
  ),
  s2 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code like 'app:hr_%'
      or p.code like 'op:hr_%'
    where r.code = 'hr_admin'
    on conflict do nothing
    returning 1
  ),
  s3 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code like 'app:hr_%'
      or p.code ~ '^op:hr_.*\\.(create|edit)$'
    where r.code = 'hr_clerk'
    on conflict do nothing
    returning 1
  ),
  s4 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code in ('app:hr_employee', 'app:hr_org', 'app:hr_attendance', 'app:hr_change')
      or p.code ~ '^op:hr_.*\\.(view|create|edit)$'
    where r.code = 'dept_manager'
    on conflict do nothing
    returning 1
  ),
  s5 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code in ('app:hr_employee', 'app:hr_attendance')
      or p.code ~ '^op:hr_.*\\.view$'
    where r.code = 'employee'
    on conflict do nothing
    returning 1
  ),
  s6 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code in ('module:home', 'module:hr')
      or p.code in ('app:hr_employee', 'app:hr_attendance')
      or p.code ~ '^op:hr_.*\\.view$'
    where r.code = 'hr_viewer'
    on conflict do nothing
    returning 1
  )
  select
    coalesce((select count(*) from s1), 0) +
    coalesce((select count(*) from s2), 0) +
    coalesce((select count(*) from s3), 0) +
    coalesce((select count(*) from s4), 0) +
    coalesce((select count(*) from s5), 0) +
    coalesce((select count(*) from s6), 0)
  into _count;

  return _count;
end;
$_$;


--
-- Name: cascade_grant_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cascade_grant_permissions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  pcode text;
  scope text;
  key text;
begin
  select code into pcode from public.permissions where id = new.permission_id;
  if pcode is null then
    return new;
  end if;

  scope := split_part(pcode, ':', 1);
  key := split_part(pcode, ':', 2);

  if scope = 'module' then
    -- grant related app/op permissions under this module
    insert into public.role_permissions (role_id, permission_id)
    select new.role_id, p.id
    from public.permissions p
    where p.code like 'app:' || key || '_%'
       or p.code like 'op:' || key || '_%'
    on conflict do nothing;

    -- set field ACL to true for module apps
    update public.sys_field_acl
      set can_view = true, can_edit = true
    where role_id = new.role_id
      and module like key || '_%';

  elsif scope = 'app' then
    -- grant related op permissions under this app
    insert into public.role_permissions (role_id, permission_id)
    select new.role_id, p.id
    from public.permissions p
    where p.code like 'op:' || key || '.%'
    on conflict do nothing;

    -- set field ACL to true for this app
    update public.sys_field_acl
      set can_view = true, can_edit = true
    where role_id = new.role_id
      and module = key;
  end if;

  return new;
end;
$$;


--
-- Name: cascade_revoke_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cascade_revoke_permissions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  pcode text;
  scope text;
  key text;
begin
  select code into pcode from public.permissions where id = old.permission_id;
  if pcode is null then
    return old;
  end if;

  scope := split_part(pcode, ':', 1);
  key := split_part(pcode, ':', 2);

  if scope = 'module' then
    -- revoke related app/op permissions under this module
    delete from public.role_permissions rp
    using public.permissions p
    where rp.role_id = old.role_id
      and rp.permission_id = p.id
      and (p.code like 'app:' || key || '_%' or p.code like 'op:' || key || '_%');

    -- set field ACL to false for module apps
    update public.sys_field_acl
      set can_view = false, can_edit = false
    where role_id = old.role_id
      and module like key || '_%';

  elsif scope = 'app' then
    -- revoke related op permissions under this app
    delete from public.role_permissions rp
    using public.permissions p
    where rp.role_id = old.role_id
      and rp.permission_id = p.id
      and p.code like 'op:' || key || '.%';

    -- set field ACL to false for this app
    update public.sys_field_acl
      set can_view = false, can_edit = false
    where role_id = old.role_id
      and module = key;
  end if;

  return old;
end;
$$;


--
-- Name: close_smart_bi_action_item_from_workflow_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_smart_bi_action_item_from_workflow_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'workflow'
    AS $_$
DECLARE
    v_action_id_text TEXT;
    v_action_id INT;
BEGIN
    IF COALESCE(NEW.event_type, '') <> 'INSTANCE_COMPLETED' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(
        i.variables ->> 'smart_bi_action_item_id',
        i.variables #>> '{smart_bi_action,action_item_id}'
    )
    INTO v_action_id_text
    FROM workflow.instances i
    WHERE i.id = NEW.instance_id
    LIMIT 1;

    IF v_action_id_text IS NULL OR v_action_id_text !~ '^[0-9]+$' THEN
        RETURN NEW;
    END IF;

    v_action_id := v_action_id_text::INT;

    UPDATE public.smart_bi_action_items
       SET workflow_definition_id = NEW.definition_id,
           workflow_instance_id = NEW.instance_id,
           status = '已闭环',
           closed_at = COALESCE(closed_at, NOW()),
           updated_at = NOW()
     WHERE id = v_action_id;

    RETURN NEW;
END;
$_$;


--
-- Name: current_app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'app_role'
$$;


--
-- Name: current_scope(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_scope(module_name text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select scope_type
  from public.role_data_scopes rds
  join public.roles r on r.id = rds.role_id
  where r.code = public.current_app_role()
    and rds.module = module_name
  limit 1
$$;


--
-- Name: current_user_dept_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_dept_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select dept_id from public.users where username = public.current_username() limit 1
$$;


--
-- Name: current_username(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_username() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'username'
$$;


--
-- Name: dept_tree_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dept_tree_ids(root_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE
    AS $$
  with recursive t as (
    select id from public.departments where id = root_id
    union all
    select d.id from public.departments d
    join t on d.parent_id = t.id
  )
  select id from t
$$;


--
-- Name: document_current_claims(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_current_claims() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;


--
-- Name: document_current_has_permission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_current_has_permission(p_permission text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_current_permissions() p
    WHERE p.permission_code = p_permission
  );
$$;


--
-- Name: document_current_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_current_is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_current_role_codes() r
    WHERE lower(r.role_code) IN ('super_admin', 'admin')
  );
$$;


--
-- Name: document_current_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_current_permissions() RETURNS TABLE(permission_code text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH claims AS (
    SELECT public.document_current_claims() AS value
  ),
  claim_permissions AS (
    SELECT item AS permission_code
    FROM claims c
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(c.value -> 'permissions') = 'array' THEN c.value -> 'permissions'
        ELSE '[]'::jsonb
      END
    ) AS item
  ),
  role_permissions AS (
    SELECT p.code AS permission_code
    FROM public.document_current_role_codes() rc
    JOIN public.roles r ON r.code = rc.role_code
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
  )
  SELECT DISTINCT source.permission_code
  FROM (
    SELECT cp.permission_code FROM claim_permissions cp
    UNION ALL
    SELECT rp.permission_code FROM role_permissions rp
  ) source
  WHERE COALESCE(source.permission_code, '') <> '';

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'permissions'
      AND udt_name = '_text'
  ) THEN
    RETURN QUERY EXECUTE
      'select distinct unnest(coalesce(permissions, array[]::text[])) as permission_code
         from public.users
        where username = public.document_current_username()
          and coalesce(array_length(permissions, 1), 0) > 0';
  END IF;
END;
$$;


--
-- Name: document_current_role_codes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_current_role_codes() RETURNS TABLE(role_code text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH claims AS (
    SELECT public.document_current_claims() AS value
  ),
  claim_roles AS (
    SELECT NULLIF(value ->> 'app_role', '') AS role_code FROM claims
    UNION
    SELECT NULLIF(value ->> 'role_code', '') AS role_code FROM claims
  ),
  matrix_roles AS (
    SELECT r.code AS role_code
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE u.username = public.document_current_username()
  ),
  legacy_role AS (
    SELECT NULLIF(u.role, '') AS role_code
    FROM public.users u
    WHERE u.username = public.document_current_username()
  )
  SELECT DISTINCT role_code
  FROM (
    SELECT role_code FROM claim_roles
    UNION ALL
    SELECT role_code FROM matrix_roles
    UNION ALL
    SELECT role_code FROM legacy_role
  ) x
  WHERE COALESCE(role_code, '') <> '';
$$;


--
-- Name: document_current_username(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_current_username() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(
    NULLIF(public.document_current_claims() ->> 'username', ''),
    NULLIF(public.document_current_claims() ->> 'sub', ''),
    ''
  );
$$;


--
-- Name: document_intake_can_manage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_intake_can_manage() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.document_current_is_admin()
      OR public.document_current_has_permission('op:document_intake.manage');
$$;


--
-- Name: document_intake_can_view(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_intake_can_view() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.document_current_is_admin()
      OR public.document_current_has_permission('op:document_intake.view')
      OR public.document_current_has_permission('op:document_intake.manage');
$$;


--
-- Name: eis_app_card_stats(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eis_app_card_stats(payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'hr', 'pg_temp'
    AS $$
declare
  stat_key text := coalesce(payload->>'stat_key', '');
  result jsonb := '{}'::jsonb;
begin
  if stat_key = 'hr_overview' then
    select jsonb_build_object(
      'missingDept', (
        select count(*)
        from hr.archives
        where nullif(btrim(coalesce(department, '')), '') is null
      ),
      'positionCount', (
        select count(distinct nullif(btrim(coalesce(position, '')), ''))
        from hr.archives
        where nullif(btrim(coalesce(position, '')), '') is not null
      ),
      'usersWithoutRole', (
        select count(*)
        from public.users u
        where not exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = u.id
        )
      )
    ) into result;
  else
    result := '{}'::jsonb;
  end if;

  return result;
end;
$$;


--
-- Name: eis_grid_agent_query(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eis_grid_agent_query(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare
  operation text := coalesce(payload->>'operation', 'count');
  api_url text := coalesce(payload->>'api_url', '');
  profile text := coalesce(payload->>'accept_profile', 'public');
  base_query text := coalesce(payload->>'base_query', '');
  search_query text := coalesce(payload->>'search_query', '');
  rel_schema text;
  rel_name text;
  rel regclass;
  columns jsonb := coalesce(payload->'columns', '[]'::jsonb);
  col jsonb;
  col_prop text;
  col_label text;
  col_source text;
  col_type text;
  group_by_prop text := payload->>'group_by';
  group_by_label text := payload->>'group_by';
  numeric_props text[] := array[]::text[];
  numeric_prop text;
  sample_limit int := greatest(1, least(50, coalesce((payload->>'sample_limit')::int, 12)));
  group_limit int := greatest(1, least(30, coalesce((payload->>'group_limit')::int, 12)));
  conditions text := '';
  condition_text text;
  filter_text text;
  condition_parts text[];
  part text;
  condition_prop text;
  condition_sql text;
  field_sql text;
  sample_select text := '';
  sample_order_sql text := '';
  sample_item text;
  sample_result jsonb := '[]'::jsonb;
  group_result jsonb := '[]'::jsonb;
  numeric_result jsonb := '{}'::jsonb;
  total_count bigint := 0;
  has_properties_column boolean := false;
  sql_text text;
  started_at timestamptz := clock_timestamp();
begin
  if operation not in ('count', 'sample', 'group_count', 'numeric_summary', 'overview') then
    raise exception 'operation % is not allowed', operation;
  end if;

  api_url := regexp_replace(api_url, '^/api', '');
  api_url := regexp_replace(api_url, '^/', '');
  api_url := split_part(api_url, '?', 1);

  rel_name := nullif(split_part(api_url, '/', 1), '');
  if rel_name is null then
    raise exception 'api_url is required';
  end if;

  if position('.' in rel_name) > 0 then
    rel_schema := split_part(rel_name, '.', 1);
    rel_name := split_part(rel_name, '.', 2);
  else
    rel_schema := profile;
  end if;

  if rel_schema not in ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data') then
    raise exception 'schema % is not allowed', rel_schema;
  end if;

  rel := to_regclass(format('%I.%I', rel_schema, rel_name));
  if rel is null then
    raise exception 'relation %.% not found', rel_schema, rel_name;
  end if;

  if jsonb_typeof(columns) is distinct from 'array' then
    columns := '[]'::jsonb;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'properties'
  ) into has_properties_column;

  if base_query <> '' then
    filter_text := regexp_replace(base_query, '^[?&]*', '');
    if filter_text <> '' then
      condition_parts := string_to_array(filter_text, '&');
      foreach part in array condition_parts loop
        part := regexp_replace(part, '=', '.');
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.neq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I <> %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.neq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.is\.(true|false|null)$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I is %s',
              condition_prop,
              regexp_replace(part, '^[^.]+\.is\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text ilike %L',
              condition_prop,
              '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
            );
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          conditions := conditions || case when conditions = '' then '' else ' and ' end || condition_sql;
        end if;
      end loop;
      if conditions <> '' then
        conditions := '(' || conditions || ')';
      end if;
    end if;
  end if;

  if search_query <> '' then
    condition_text := regexp_replace(search_query, '^[?&]*or=\(', '');
    condition_text := regexp_replace(condition_text, '\)$', '');
    if condition_text <> '' then
      filter_text := '';
      condition_parts := string_to_array(condition_text, ',');
      foreach part in array condition_parts loop
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.-?[0-9]+(\.[0-9]+)?$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text ilike %L',
              condition_prop,
              '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
            );
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          filter_text := filter_text || case when filter_text = '' then '' else ' or ' end || condition_sql;
        end if;
      end loop;
      if filter_text <> '' then
        conditions := conditions || case when conditions = '' then '' else ' and ' end || '(' || filter_text || ')';
      end if;
    end if;
  end if;

  if conditions <> '' then
    conditions := ' where ' || conditions;
  end if;

  execute format('select count(*) from %s%s', rel, conditions) into total_count;

  if operation in ('sample', 'overview') then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = rel_schema
        and table_name = rel_name
        and column_name = 'created_at'
    ) then
      sample_order_sql := ' order by created_at desc';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = rel_schema
        and table_name = rel_name
        and column_name = 'id'
    ) then
      sample_order_sql := ' order by id desc';
    end if;

    for col in select * from jsonb_array_elements(columns) limit 20 loop
      col_prop := col->>'prop';
      col_label := coalesce(col->>'label', col_prop);
      col_source := coalesce(col->>'source', 'column');
      col_type := coalesce(col->>'type', 'text');

      if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
        continue;
      end if;
      if col_type in ('file', 'geo') then
        continue;
      end if;

      if col_source = 'properties' and has_properties_column then
        sample_item := format('%L, t.properties->>%L', col_prop, col_prop);
      elsif col_source <> 'properties' then
        if not exists (
          select 1
          from information_schema.columns
          where table_schema = rel_schema
            and table_name = rel_name
            and column_name = col_prop
        ) then
          continue;
        end if;
        sample_item := format('%L, t.%I', col_prop, col_prop);
      end if;

      sample_select := sample_select || case when sample_select = '' then '' else ', ' end || sample_item;
    end loop;

    if sample_select = '' then
      sample_result := '[]'::jsonb;
    else
      sql_text := format(
        'select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(%s))), ''[]''::jsonb) from (select * from %s%s%s limit %s) t',
        sample_select,
        rel,
        conditions,
        sample_order_sql,
        sample_limit
      );
      execute sql_text into sample_result;
    end if;
  end if;

  if operation in ('group_count', 'overview') and group_by_prop is not null and group_by_prop <> '' then
    field_sql := null;
    col_source := null;
    group_by_label := group_by_prop;
    for col in select * from jsonb_array_elements(columns) loop
      if col->>'prop' = group_by_prop then
        col_source := coalesce(col->>'source', 'column');
        group_by_label := coalesce(col->>'label', group_by_prop);
        exit;
      end if;
    end loop;

    if col_source is not null and group_by_prop ~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      if col_source = 'properties' and has_properties_column then
        field_sql := format('nullif(t.properties->>%L, '''')', group_by_prop);
      elsif col_source <> 'properties' then
        if exists (
          select 1
          from information_schema.columns
          where table_schema = rel_schema
            and table_name = rel_name
            and column_name = group_by_prop
        ) then
          field_sql := format('t.%I::text', group_by_prop);
        end if;
      end if;

      if field_sql is not null then
        sql_text := format(
          $sql$
          select coalesce(jsonb_agg(jsonb_build_object('value', group_value, 'count', row_count) order by row_count desc), '[]'::jsonb)
          from (
            select coalesce(%1$s, '(空)') as group_value, count(*)::bigint as row_count
            from %2$s t
            %3$s
            group by coalesce(%1$s, '(空)')
            order by row_count desc
            limit %4$s
          ) g
          $sql$,
          field_sql,
          rel,
          conditions,
          group_limit
        );
        execute sql_text into group_result;
      end if;
    end if;
  end if;

  if operation in ('numeric_summary', 'overview') then
    for col in select * from jsonb_array_elements(columns) loop
      field_sql := null;
      col_prop := col->>'prop';
      col_label := coalesce(col->>'label', col_prop);
      col_source := coalesce(col->>'source', 'column');
      col_type := coalesce(col->>'type', 'text');

      if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
        continue;
      end if;

      if col_type not in ('number', 'currency', 'percent', 'formula') then
        continue;
      end if;

      if col_source = 'properties' and has_properties_column then
        field_sql := format('nullif(t.properties->>%L, '''')', col_prop);
      elsif col_source <> 'properties' then
        if not exists (
          select 1
          from information_schema.columns
          where table_schema = rel_schema
            and table_name = rel_name
            and column_name = col_prop
        ) then
          continue;
        end if;
        field_sql := format('t.%I', col_prop);
      end if;

      if field_sql is null then
        continue;
      end if;

      sql_text := format(
        $sql$
        select jsonb_build_object(
          'label', %1$L,
          'count', count(*)::bigint,
          'sum', coalesce(sum((%2$s)::numeric), 0),
          'avg', coalesce(avg((%2$s)::numeric), 0),
          'min', min((%2$s)::numeric),
          'max', max((%2$s)::numeric)
        )
        from %3$s t
        %4$s%5$s (%2$s)::text ~ '^-?[0-9]+(\.[0-9]+)?$'
        $sql$,
        col_label,
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end
      );
      execute sql_text into col;
      numeric_result := jsonb_set(numeric_result, array[col_prop], coalesce(col, '{}'::jsonb), true);
      numeric_props := array_append(numeric_props, col_prop);
      if array_length(numeric_props, 1) >= 12 then
        exit;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'scope', 'server',
    'tool', 'eis_grid_agent_query',
    'operation', operation,
    'schema', rel_schema,
    'table', rel_name,
    'searchApplied', conditions <> '',
    'totalCount', total_count,
    'sample', sample_result,
    'groupBy', case when group_by_prop is not null and group_by_prop <> '' then jsonb_build_object('prop', group_by_prop, 'label', group_by_label, 'rows', group_result) else null end,
    'numericSummary', numeric_result,
    'limits', jsonb_build_object('sample', sample_limit, 'group', group_limit),
    'durationMs', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
  );
end;
$_$;


--
-- Name: eis_grid_formula_eval(jsonb, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eis_grid_formula_eval(tokens jsonb, row_data jsonb, precision_value integer DEFAULT 2) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  token jsonb;
  stack numeric[] := array[]::numeric[];
  result numeric;
begin
  for token in select * from jsonb_array_elements(coalesce(tokens, '[]'::jsonb)) loop
    stack := public.eis_grid_formula_eval_token(token, row_data, stack);
  end loop;

  if array_length(stack, 1) is distinct from 1 then
    raise exception 'invalid formula result stack';
  end if;

  result := stack[1];
  if result is null then
    return null;
  end if;

  return round(result, greatest(0, least(6, precision_value)));
end;
$$;


--
-- Name: eis_grid_formula_eval_token(jsonb, jsonb, numeric[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eis_grid_formula_eval_token(token jsonb, row_data jsonb, stack numeric[]) RETURNS numeric[]
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
declare
  token_type text := token->>'type';
  token_value text := token->>'value';
  token_prop text := token->>'prop';
  token_source text := coalesce(token->>'source', 'column');
  raw_value text;
  left_value numeric;
  right_value numeric;
  next_value numeric;
begin
  if token_type = 'number' then
    stack := array_append(stack, (token->>'value')::numeric);
    return stack;
  end if;

  if token_type = 'ref' then
    if token_prop is null or token_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      stack := array_append(stack, 0);
      return stack;
    end if;

    if token_source = 'properties' then
      raw_value := row_data->'properties'->>token_prop;
    else
      raw_value := row_data->>token_prop;
    end if;

    if raw_value is null or raw_value = '' or raw_value !~ '^-?[0-9]+(\.[0-9]+)?$' then
      stack := array_append(stack, 0);
    else
      stack := array_append(stack, raw_value::numeric);
    end if;
    return stack;
  end if;

  if token_type = 'operator' then
    if token_value = 'u-' then
      if array_length(stack, 1) is null or array_length(stack, 1) < 1 then
        raise exception 'invalid formula stack for unary operator';
      end if;
      stack[array_length(stack, 1)] := -stack[array_length(stack, 1)];
      return stack;
    end if;

    if array_length(stack, 1) is null or array_length(stack, 1) < 2 then
      raise exception 'invalid formula stack for binary operator';
    end if;

    right_value := stack[array_length(stack, 1)];
    stack := stack[1:array_length(stack, 1) - 1];
    left_value := stack[array_length(stack, 1)];
    stack := stack[1:array_length(stack, 1) - 1];

    if token_value = '+' then
      next_value := left_value + right_value;
    elsif token_value = '-' then
      next_value := left_value - right_value;
    elsif token_value = '*' then
      next_value := left_value * right_value;
    elsif token_value = '/' then
      if right_value = 0 then
        stack := array_append(stack, null);
        return stack;
      end if;
      next_value := left_value / right_value;
    else
      raise exception 'unsupported operator %', token_value;
    end if;

    stack := array_append(stack, next_value);
    return stack;
  end if;

  raise exception 'unsupported token type %', token_type;
end;
$_$;


--
-- Name: eis_grid_formula_recalculate(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eis_grid_formula_recalculate(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare
  write_url text := coalesce(nullif(payload->>'write_url', ''), payload->>'api_url', '');
  profile text := coalesce(nullif(payload->>'content_profile', ''), nullif(payload->>'accept_profile', ''), 'public');
  base_query text := coalesce(payload->>'base_query', '');
  search_query text := coalesce(payload->>'search_query', '');
  cursor_id text := payload->>'cursor_id';
  target_prop text := payload->'target'->>'prop';
  target_label text := coalesce(payload->'target'->>'label', target_prop);
  tokens jsonb := coalesce(payload->'tokens', '[]'::jsonb);
  batch_size int := greatest(100, least(10000, coalesce((payload->>'batch_size')::int, 2000)));
  precision_value int := greatest(0, least(6, coalesce((payload->>'precision')::int, 2)));
  rel_schema text;
  rel_name text;
  rel regclass;
  conditions text := '';
  batch_conditions text := '';
  condition_text text;
  filter_text text;
  condition_parts text[];
  part text;
  condition_prop text;
  condition_sql text;
  token jsonb;
  field_prop text;
  field_source text;
  id_type text;
  has_properties_column boolean := false;
  updated_count int := 0;
  scanned_count int := 0;
  started_at timestamptz := clock_timestamp();
  sql_text text;
begin
  write_url := regexp_replace(write_url, '^/api', '');
  write_url := regexp_replace(write_url, '^/', '');
  write_url := split_part(write_url, '?', 1);

  rel_name := nullif(split_part(write_url, '/', 1), '');
  if rel_name is null then
    raise exception 'write_url or api_url is required';
  end if;

  if position('.' in rel_name) > 0 then
    rel_schema := split_part(rel_name, '.', 1);
    rel_name := split_part(rel_name, '.', 2);
  else
    rel_schema := profile;
  end if;

  if rel_schema not in ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data') then
    raise exception 'schema % is not allowed', rel_schema;
  end if;

  rel := to_regclass(format('%I.%I', rel_schema, rel_name));
  if rel is null then
    raise exception 'relation %.% not found', rel_schema, rel_name;
  end if;

  if target_prop is null or target_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
    raise exception 'target prop is invalid';
  end if;

  if jsonb_typeof(tokens) is distinct from 'array' or jsonb_array_length(tokens) = 0 then
    raise exception 'tokens are required';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'id'
  ) then
    raise exception 'relation %.% must have id column', rel_schema, rel_name;
  end if;

  select format('%I.%I', udt_schema, udt_name)
  into id_type
  from information_schema.columns
  where table_schema = rel_schema
    and table_name = rel_name
    and column_name = 'id';

  if id_type is null then
    raise exception 'relation %.% id column type not found', rel_schema, rel_name;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'properties'
  ) then
    raise exception 'relation %.% must have properties jsonb column', rel_schema, rel_name;
  end if;
  has_properties_column := true;

  for token in select * from jsonb_array_elements(tokens) loop
    if token->>'type' = 'operator' then
      if token->>'value' not in ('+', '-', '*', '/', 'u-') then
        raise exception 'unsupported operator %', token->>'value';
      end if;
    elsif token->>'type' = 'number' then
      if token->>'value' is null or token->>'value' !~ '^-?[0-9]+(\.[0-9]+)?$' then
        raise exception 'invalid number token';
      end if;
    elsif token->>'type' = 'ref' then
      field_prop := token->>'prop';
      field_source := coalesce(token->>'source', 'column');
      if field_prop is null or field_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
        raise exception 'invalid ref token';
      end if;
      if field_source not in ('column', 'properties') then
        raise exception 'invalid ref source %', field_source;
      end if;
      if field_source = 'column' and not exists (
        select 1
        from information_schema.columns
        where table_schema = rel_schema
          and table_name = rel_name
          and column_name = field_prop
      ) then
        raise exception 'column %.%.% not found', rel_schema, rel_name, field_prop;
      end if;
    else
      raise exception 'unsupported token type %', token->>'type';
    end if;
  end loop;

  if base_query <> '' then
    filter_text := regexp_replace(base_query, '^[?&]*', '');
    if filter_text <> '' then
      condition_parts := string_to_array(filter_text, '&');
      foreach part in array condition_parts loop
        part := regexp_replace(part, '=', '.');
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.neq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I <> %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.neq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.is\.(true|false|null)$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I is %s',
              condition_prop,
              regexp_replace(part, '^[^.]+\.is\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text ilike %L',
              condition_prop,
              '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
            );
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          conditions := conditions || case when conditions = '' then '' else ' and ' end || condition_sql;
        end if;
      end loop;
      if conditions <> '' then
        conditions := '(' || conditions || ')';
      end if;
    end if;
  end if;

  if search_query <> '' then
    condition_text := regexp_replace(search_query, '^[?&]*or=\(', '');
    condition_text := regexp_replace(condition_text, '\)$', '');
    if condition_text <> '' then
      filter_text := '';
      condition_parts := string_to_array(condition_text, ',');
      foreach part in array condition_parts loop
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.-?[0-9]+(\.[0-9]+)?$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text ilike %L',
              condition_prop,
              '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
            );
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          filter_text := filter_text || case when filter_text = '' then '' else ' or ' end || condition_sql;
        end if;
      end loop;
      if filter_text <> '' then
        conditions := conditions || case when conditions = '' then '' else ' and ' end || '(' || filter_text || ')';
      end if;
    end if;
  end if;

  if conditions <> '' then
    conditions := ' where ' || conditions;
  end if;

  batch_conditions := conditions;
  if cursor_id is not null and cursor_id <> '' then
    batch_conditions := batch_conditions
      || case when batch_conditions = '' then ' where ' else ' and ' end
      || format('id > %L::%s', cursor_id, id_type);
  end if;

  sql_text := format(
    $sql$
    with candidates as (
      select id, to_jsonb(t.*) as row_data
      from %1$s t
      %2$s
      order by id
      limit %3$s
      for update skip locked
    ),
    calculated as (
      select
        id,
        row_data,
        public.eis_grid_formula_eval(%4$L::jsonb, row_data, %5$s) as formula_value,
        case
          when (row_data->'properties'->>%6$L) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (row_data->'properties'->>%6$L)::numeric
          else null
        end as current_value
      from candidates
    ),
    changed as (
      select id, formula_value
      from calculated
      where formula_value is not null
        and current_value is distinct from formula_value
    ),
    updated as (
      update %1$s target
      set properties = jsonb_set(
        coalesce(target.properties, '{}'::jsonb),
        array[%6$L],
        to_jsonb(changed.formula_value),
        true
      )
      from changed
      where target.id = changed.id
      returning target.id
    )
    select
      (select count(*) from candidates)::int as scanned_count,
      (select count(*) from updated)::int as updated_count,
      (select id::text from candidates order by id desc limit 1) as next_cursor
    $sql$,
    rel,
    batch_conditions,
    batch_size,
    tokens::text,
    precision_value,
    target_prop
  );

  execute sql_text into scanned_count, updated_count, cursor_id;

  return jsonb_build_object(
    'scope', 'server',
    'schema', rel_schema,
    'table', rel_name,
    'target', jsonb_build_object('prop', target_prop, 'label', target_label),
    'scanned', coalesce(scanned_count, 0),
    'updated', coalesce(updated_count, 0),
    'matched', null,
    'next_cursor', cursor_id,
    'has_more', coalesce(scanned_count, 0) >= batch_size,
    'batch_size', batch_size,
    'duration_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
  );
end;
$_$;


--
-- Name: eis_grid_summary(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eis_grid_summary(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare
  api_url text := coalesce(payload->>'api_url', '');
  profile text := coalesce(payload->>'accept_profile', 'public');
  base_query text := coalesce(payload->>'base_query', '');
  search_query text := coalesce(payload->>'search_query', '');
  rel_schema text;
  rel_name text;
  rel regclass;
  col jsonb;
  col_prop text;
  col_label text;
  col_source text;
  col_rule text;
  col_type text;
  field_sql text;
  agg_sql text;
  value numeric;
  count_value bigint;
  conditions text := '';
  condition_text text;
  filter_text text;
  condition_parts text[];
  part text;
  condition_prop text;
  condition_op text;
  condition_sql text;
  numeric_condition text;
  raw_value text;
  quoted_values text;
  has_properties_column boolean := false;
  result jsonb := '{}'::jsonb;
begin
  api_url := regexp_replace(api_url, '^/api', '');
  api_url := regexp_replace(api_url, '^/', '');
  api_url := split_part(api_url, '?', 1);

  rel_name := nullif(split_part(api_url, '/', 1), '');
  if rel_name is null then
    raise exception 'api_url is required';
  end if;

  if position('.' in rel_name) > 0 then
    rel_schema := split_part(rel_name, '.', 1);
    rel_name := split_part(rel_name, '.', 2);
  else
    rel_schema := profile;
  end if;

  if rel_schema not in ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data') then
    raise exception 'schema % is not allowed', rel_schema;
  end if;

  rel := to_regclass(format('%I.%I', rel_schema, rel_name));
  if rel is null then
    raise exception 'relation %.% not found', rel_schema, rel_name;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'properties'
  ) into has_properties_column;

  if base_query <> '' then
    filter_text := regexp_replace(base_query, '^[?&]*', '');
    if filter_text <> '' then
      condition_parts := string_to_array(filter_text, '&');
      foreach part in array condition_parts loop
        part := regexp_replace(part, '=', '.');
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.neq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I <> %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.neq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.is\.(true|false|null)$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I is %s',
              condition_prop,
              regexp_replace(part, '^[^.]+\.is\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text ilike %L',
              condition_prop,
              '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.(lt|lte|gt|gte)\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          condition_op := split_part(part, '.', 2);
          raw_value := regexp_replace(part, '^[^.]+\.(lt|lte|gt|gte)\.', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I %s %L',
              condition_prop,
              case condition_op when 'lt' then '<' when 'lte' then '<=' when 'gt' then '>' else '>=' end,
              raw_value
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.in\.\(.+\)$' then
          condition_prop := split_part(part, '.', 1);
          raw_value := regexp_replace(regexp_replace(part, '^[^.]+\.in\.\(', ''), '\)$', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            select string_agg(format('%L', trim(item)), ',')
            into quoted_values
            from unnest(string_to_array(raw_value, ',')) as item
            where trim(item) <> '';
            if quoted_values is not null and quoted_values <> '' then
              condition_sql := format('%I::text in (%s)', condition_prop, quoted_values);
            end if;
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          conditions := conditions || case when conditions = '' then '' else ' and ' end || condition_sql;
        end if;
      end loop;
      if conditions <> '' then
        conditions := '(' || conditions || ')';
      end if;
    end if;
  end if;

  if search_query <> '' then
    condition_text := regexp_replace(search_query, '^[?&]*or=\(', '');
    condition_text := regexp_replace(condition_text, '\)$', '');
    if condition_text <> '' then
      filter_text := '';
      condition_parts := string_to_array(condition_text, ',');
      foreach part in array condition_parts loop
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.-?[0-9]+(\.[0-9]+)?$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.neq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I <> %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.neq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text ilike %L',
              condition_prop,
              '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.(lt|lte|gt|gte)\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          condition_op := split_part(part, '.', 2);
          raw_value := regexp_replace(part, '^[^.]+\.(lt|lte|gt|gte)\.', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I %s %L',
              condition_prop,
              case condition_op when 'lt' then '<' when 'lte' then '<=' when 'gt' then '>' else '>=' end,
              raw_value
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.in\.\(.+\)$' then
          condition_prop := split_part(part, '.', 1);
          raw_value := regexp_replace(regexp_replace(part, '^[^.]+\.in\.\(', ''), '\)$', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            select string_agg(format('%L', trim(item)), ',')
            into quoted_values
            from unnest(string_to_array(raw_value, ',')) as item
            where trim(item) <> '';
            if quoted_values is not null and quoted_values <> '' then
              condition_sql := format('%I::text in (%s)', condition_prop, quoted_values);
            end if;
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          filter_text := filter_text || case when filter_text = '' then '' else ' or ' end || condition_sql;
        end if;
      end loop;
      if filter_text <> '' then
        conditions := conditions || case when conditions = '' then '' else ' and ' end || '(' || filter_text || ')';
      end if;
    end if;
  end if;

  if conditions <> '' then
    conditions := ' where ' || conditions;
  end if;

  for col in select * from jsonb_array_elements(coalesce(payload->'columns', '[]'::jsonb)) loop
    col_prop := col->>'prop';
    col_label := coalesce(col->>'label', col_prop);
    col_source := coalesce(col->>'source', 'column');
    col_rule := coalesce(col->>'rule', 'none');
    col_type := coalesce(col->>'type', 'text');

    if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      continue;
    end if;
    if col_rule not in ('sum', 'avg', 'count', 'max', 'min', 'count_all') then
      continue;
    end if;

    if col_rule = 'count_all' then
      agg_sql := format('select count(*) from %s%s', rel, conditions);
      execute agg_sql into count_value;
      result := jsonb_set(
        result,
        array[col_prop],
        jsonb_build_object('label', col_label, 'rule', col_rule, 'value', count_value),
        true
      );
      continue;
    end if;

    if col_source = 'properties' then
      field_sql := format('nullif(properties->>%L, '''')', col_prop);
    else
      if not exists (
        select 1
        from information_schema.columns
        where table_schema = rel_schema
          and table_name = rel_name
          and column_name = col_prop
      ) then
        continue;
      end if;
      field_sql := format('%I', col_prop);
    end if;

    if col_rule = 'count' then
      agg_sql := format('select count(%s) from %s%s', field_sql, rel, conditions);
      execute agg_sql into count_value;
      result := jsonb_set(
        result,
        array[col_prop],
        jsonb_build_object('label', col_label, 'rule', col_rule, 'value', count_value),
        true
      );
      continue;
    end if;

    numeric_condition := format('(%s)::text ~ ''^-?[0-9]+(\.[0-9]+)?$''', field_sql);
    if col_rule = 'sum' then
      agg_sql := format(
        'select sum((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    elsif col_rule = 'avg' then
      agg_sql := format(
        'select avg((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    elsif col_rule = 'max' then
      agg_sql := format(
        'select max((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    elsif col_rule = 'min' then
      agg_sql := format(
        'select min((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    end if;

    execute agg_sql into value;
    result := jsonb_set(
      result,
      array[col_prop],
      jsonb_build_object('label', col_label, 'rule', col_rule, 'value', coalesce(value, 0)),
      true
    );
  end loop;

  return jsonb_build_object(
    'scope', 'server',
    'schema', rel_schema,
    'table', rel_name,
    'results', result
  );
end;
$_$;


--
-- Name: ensure_field_acl(text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_field_acl(module_name text, field_codes text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  _count integer := 0;
begin
  if module_name is null or module_name = '' then
    return 0;
  end if;
  if field_codes is null or array_length(field_codes, 1) is null then
    return 0;
  end if;

  with targets as (
    select r.id as role_id, module_name as module, fc as field_code
    from public.roles r
    cross join unnest(field_codes) as fc
  ),
  upserted as (
    insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
    select t.role_id, t.module, t.field_code, true, true
    from targets t
    on conflict (role_id, module, field_code) do nothing
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;


--
-- Name: explain_ontology_path(text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text DEFAULT NULL::text, p_object_id text DEFAULT NULL::text, p_max_depth integer DEFAULT 4) RETURNS TABLE(depth integer, terminal_type text, terminal_id text, terminal_label text, path_text text, path_facts jsonb)
    LANGUAGE sql STABLE
    AS $$
    WITH RECURSIVE walk AS (
        SELECT
            1 AS depth,
            f.object_type AS terminal_type,
            f.object_id AS terminal_id,
            f.object_label AS terminal_label,
            ARRAY[f.id]::BIGINT[] AS path_ids,
            format('%s:%s -[%s]-> %s:%s', f.subject_type, f.subject_id, f.predicate, f.object_type, f.object_id) AS path_text,
            jsonb_build_array(jsonb_build_object(
                'id', f.id,
                'subject_type', f.subject_type,
                'subject_id', f.subject_id,
                'predicate', f.predicate,
                'object_type', f.object_type,
                'object_id', f.object_id,
                'rule', f.inference_rule,
                'inferred', f.is_inferred,
                'evidence', f.evidence
            )) AS path_facts
        FROM public.ontology_inferred_facts f
        WHERE f.subject_type = p_subject_type
          AND f.subject_id = p_subject_id
        UNION ALL
        SELECT
            w.depth + 1,
            f.object_type,
            f.object_id,
            f.object_label,
            w.path_ids || f.id,
            w.path_text || format(' | %s:%s -[%s]-> %s:%s', f.subject_type, f.subject_id, f.predicate, f.object_type, f.object_id),
            w.path_facts || jsonb_build_array(jsonb_build_object(
                'id', f.id,
                'subject_type', f.subject_type,
                'subject_id', f.subject_id,
                'predicate', f.predicate,
                'object_type', f.object_type,
                'object_id', f.object_id,
                'rule', f.inference_rule,
                'inferred', f.is_inferred,
                'evidence', f.evidence
            ))
        FROM walk w
        JOIN public.ontology_inferred_facts f
          ON f.subject_type = w.terminal_type
         AND f.subject_id = w.terminal_id
        WHERE w.depth < LEAST(GREATEST(COALESCE(p_max_depth, 4), 1), 8)
          AND NOT f.id = ANY(w.path_ids)
    )
    SELECT
        w.depth,
        w.terminal_type,
        w.terminal_id,
        w.terminal_label,
        w.path_text,
        w.path_facts
    FROM walk w
    WHERE (p_object_type IS NULL OR w.terminal_type = p_object_type)
      AND (p_object_id IS NULL OR w.terminal_id = p_object_id)
    ORDER BY w.depth, w.path_text
    LIMIT 100;
$$;


--
-- Name: FUNCTION explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer) IS 'Explains reachable ontology paths from a subject through inferred facts';


--
-- Name: explain_role_ontology_access(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.explain_role_ontology_access(p_role_code text DEFAULT NULL::text, p_limit integer DEFAULT 200) RETURNS TABLE(role_code text, role_name text, fact_id bigint, predicate text, target_type text, target_id text, target_label text, table_id text, column_id text, action_key text, permission_code text, inference_rule text, rule_name text, path_text text, evidence jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        f.subject_id AS role_code,
        COALESCE(r.role_name, f.subject_label, f.subject_id) AS role_name,
        f.id AS fact_id,
        f.predicate,
        f.object_type AS target_type,
        f.object_id AS target_id,
        f.object_label AS target_label,
        CASE
            WHEN f.object_type = 'table' THEN f.object_id
            WHEN f.object_type = 'column' THEN split_part(f.object_id, '.', 1) || '.' || split_part(f.object_id, '.', 2)
            ELSE f.evidence->>'table'
        END AS table_id,
        CASE
            WHEN f.object_type = 'column' THEN f.object_id
            ELSE NULL
        END AS column_id,
        f.evidence->>'action_key' AS action_key,
        f.evidence->>'permission_code' AS permission_code,
        f.inference_rule,
        f.rule_name,
        format('%s:%s -[%s]-> %s:%s', f.subject_type, f.subject_id, f.predicate, f.object_type, f.object_id) AS path_text,
        f.evidence
    FROM public.v_ontology_reasoning_facts f
    LEFT JOIN public.v_role_ontology r
      ON r.role_code = f.subject_id
    WHERE f.subject_type = 'role'
      AND (p_role_code IS NULL OR f.subject_id = p_role_code)
      AND f.predicate IN (
          'acl:canAccessApp',
          'acl:canAccessTable',
          'acl:canOperateAppAction',
          'acl:canOperateTable',
          'risk:canAccessSensitiveColumn'
      )
    ORDER BY
        CASE f.predicate
            WHEN 'risk:canAccessSensitiveColumn' THEN 1
            WHEN 'acl:canAccessTable' THEN 2
            WHEN 'acl:canOperateTable' THEN 3
            WHEN 'acl:canAccessApp' THEN 4
            ELSE 5
        END,
        f.subject_id,
        f.object_type,
        f.object_id,
        f.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;


--
-- Name: FUNCTION explain_role_ontology_access(p_role_code text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.explain_role_ontology_access(p_role_code text, p_limit integer) IS 'Role-centric read-only KG access explanation based on inferred ontology facts';


--
-- Name: find_ontology_kg_paths(text, text, text, text, integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer DEFAULT 4, p_direction text DEFAULT 'outgoing'::text, p_limit integer DEFAULT 20) RETURNS TABLE(depth integer, source_type text, source_id text, target_type text, target_id text, target_label text, path_text text, path_nodes text[], path_edges bigint[], path_facts jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        q.depth,
        p_source_type AS source_type,
        p_source_id AS source_id,
        q.to_type AS target_type,
        q.to_id AS target_id,
        q.to_label AS target_label,
        q.path_text,
        q.path_nodes,
        q.path_edges,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', e.id,
                'subject_type', e.subject_type,
                'subject_id', e.subject_id,
                'predicate', e.predicate,
                'object_type', e.object_type,
                'object_id', e.object_id,
                'rule', e.inference_rule,
                'inferred', e.is_inferred,
                'evidence', e.evidence
            ) ORDER BY pe.ordinality)
            FROM unnest(q.path_edges) WITH ORDINALITY AS pe(edge_id, ordinality)
            JOIN public.v_ontology_reasoning_edges e
              ON e.id = pe.edge_id
        ), '[]'::jsonb) AS path_facts
    FROM public.query_ontology_kg_neighbors(
        p_source_type,
        p_source_id,
        p_direction,
        p_max_depth,
        GREATEST(20, LEAST(COALESCE(p_limit, 20) * 50, 1000)),
        NULL
    ) q
    WHERE q.to_type = p_target_type
      AND q.to_id = p_target_id
    ORDER BY q.depth, q.path_text
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;


--
-- Name: FUNCTION find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer) IS 'Find bounded ontology KG paths between two nodes';


--
-- Name: login(json); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.login(payload json) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN public.login(payload->>'username', payload->>'password');
END;
$$;


--
-- Name: login(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.login(username text, password text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  _app_role text;
  _permissions text[];
  _user_id integer;
  token_claims json;
  _secret text := nullif(current_setting('app.jwt_secret', true), '');
BEGIN
  IF _secret IS NULL OR octet_length(_secret) < 32 THEN
    RAISE EXCEPTION 'JWT signing secret is not configured'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT u.id
    INTO _user_id
  FROM public.users u
  WHERE lower(trim(u.username)) = lower(trim(login.username))
    AND u.password = trim(login.password);

  IF _user_id IS NULL THEN
    RAISE invalid_password USING message = '账号或密码错误';
  END IF;

  SELECT array_agg(distinct pcode order by pcode)
    INTO _permissions
  FROM (
    SELECT unnest(v.permissions) AS pcode
    FROM public.user_roles ur
    JOIN public.v_role_permissions v ON v.role_id = ur.role_id
    WHERE ur.user_id = _user_id
  ) perms;

  IF _permissions IS NULL THEN
    SELECT u.permissions
      INTO _permissions
    FROM public.users u
    WHERE u.id = _user_id;
  END IF;

  SELECT v.role_code
    INTO _app_role
  FROM public.user_roles ur
  JOIN public.v_role_permissions v ON v.role_id = ur.role_id
  WHERE ur.user_id = _user_id
  ORDER BY v.role_code ASC
  LIMIT 1;

  IF _app_role IS NULL OR _app_role = '' THEN
    SELECT u.role
      INTO _app_role
    FROM public.users u
    WHERE u.id = _user_id;
  END IF;

  token_claims := json_build_object(
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'exp', extract(epoch from now() + interval '2 hours')::integer
  );

  RETURN json_build_object(
    'token', public.sign(token_claims, _secret),
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'permissions', coalesce(_permissions, ARRAY[]::text[])
  );
END;
$$;


--
-- Name: normalize_field_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_field_name(raw text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  name text;
begin
  if raw is null then
    return null;
  end if;
  name := lower(trim(raw));
  if name = '' then
    return null;
  end if;
  name := regexp_replace(name, '[^a-z0-9_]+', '_', 'g');
  if name = '' then
    return null;
  end if;
  if name !~ '^[a-z]' then
    name := 'f_' || name;
  end if;
  return name;
end;
$$;


--
-- Name: notify_eis_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_eis_events() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  payload json;
begin
  payload := json_build_object(
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'id', coalesce(NEW.id, OLD.id),
    'user', current_setting('request.jwt.claim.username', true),
    'ts', now()
  );
  perform pg_notify('eis_events', payload::text);
  return coalesce(NEW, OLD);
end;
$$;


--
-- Name: ontology_agent_can_access_edge(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_agent_can_access_edge(p_edge_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
    SELECT EXISTS (
        SELECT 1
        FROM public.v_ontology_reasoning_edges e
        JOIN visible_nodes s
          ON s.node_type = e.subject_type
         AND s.node_id = e.subject_id
        JOIN visible_nodes o
          ON o.node_type = e.object_type
         AND o.node_id = e.object_id
        WHERE e.id = p_edge_id
    );
$$;


--
-- Name: FUNCTION ontology_agent_can_access_edge(p_edge_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_agent_can_access_edge(p_edge_id bigint) IS 'Role-scoped edge visibility predicate for agent ontology/KG queries';


--
-- Name: ontology_agent_can_access_node(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_agent_can_access_node(p_node_type text, p_node_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ontology_agent_visible_nodes() n
        WHERE n.node_type = NULLIF(p_node_type, '')
          AND n.node_id = NULLIF(p_node_id, '')
    );
$$;


--
-- Name: FUNCTION ontology_agent_can_access_node(p_node_type text, p_node_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_agent_can_access_node(p_node_type text, p_node_id text) IS 'Role-scoped node visibility predicate for agent ontology/KG queries';


--
-- Name: ontology_agent_visible_nodes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_agent_visible_nodes() RETURNS TABLE(node_type text, node_id text)
    LANGUAGE sql STABLE
    AS $$
    WITH super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    permissions AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    accessible_tables AS (
        SELECT table_id FROM public.ontology_current_accessible_tables()
    ),
    visible_columns AS (
        SELECT c.table_schema || '.' || c.table_name || '.' || c.column_name AS column_id
        FROM public.ontology_column_semantics c
        JOIN accessible_tables at ON at.table_id = c.table_schema || '.' || c.table_name
        WHERE c.is_active = true
          AND (
              COALESCE(c.is_sensitive, false) = false
              OR c.table_schema || '.' || c.table_name || '.' || c.column_name IN (
                  SELECT column_id FROM public.ontology_current_accessible_sensitive_columns()
              )
          )
    )
    SELECT DISTINCT node_type, node_id
    FROM (
        SELECT n.node_type, n.node_id
        FROM public.v_ontology_kg_nodes n
        CROSS JOIN super_flag s
        WHERE s.allowed
        UNION ALL
        SELECT 'table'::TEXT, table_id FROM accessible_tables
        UNION ALL
        SELECT 'column'::TEXT, column_id FROM visible_columns
        UNION ALL
        SELECT 'app'::TEXT, app_id FROM public.ontology_current_accessible_apps()
        UNION ALL
        SELECT 'permission'::TEXT, permission_code FROM permissions
        UNION ALL
        SELECT 'role'::TEXT, role_code FROM role_codes
        UNION ALL
        SELECT 'app_action'::TEXT, f.object_id
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.object_type = 'app_action'
          AND f.predicate = 'acl:canOperateAppAction'
        UNION ALL
        SELECT 'semantic_domain'::TEXT, t.semantic_domain
        FROM public.ontology_table_semantics t
        JOIN accessible_tables at ON at.table_id = t.table_schema || '.' || t.table_name
        WHERE t.is_active = true
        UNION ALL
        SELECT 'semantic_class'::TEXT, t.semantic_class
        FROM public.ontology_table_semantics t
        JOIN accessible_tables at ON at.table_id = t.table_schema || '.' || t.table_name
        WHERE t.is_active = true
        UNION ALL
        SELECT 'semantic_class'::TEXT, c.semantic_class
        FROM public.ontology_column_semantics c
        JOIN visible_columns vc ON vc.column_id = c.table_schema || '.' || c.table_name || '.' || c.column_name
        WHERE c.is_active = true
        UNION ALL
        SELECT 'permission_kind'::TEXT, po.semantic_kind
        FROM public.v_permission_ontology po
        JOIN permissions p ON p.permission_code = po.code
    ) visible
    WHERE COALESCE(node_type, '') <> ''
      AND COALESCE(node_id, '') <> '';
$$;


--
-- Name: FUNCTION ontology_agent_visible_nodes(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_agent_visible_nodes() IS 'Materializable node set visible to the current role for agent ontology/KG queries';


--
-- Name: ontology_current_accessible_apps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_accessible_apps() RETURNS TABLE(app_id text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH perms AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    )
    SELECT DISTINCT app_id
    FROM (
        SELECT a.id::TEXT AS app_id
        FROM app_center.apps a
        CROSS JOIN super_flag s
        WHERE s.allowed
        UNION ALL
        SELECT f.object_id AS app_id
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.predicate = 'acl:canAccessApp'
          AND f.object_type = 'app'
        UNION ALL
        SELECT v.app_id::TEXT AS app_id
        FROM public.v_app_form_ontology v
        WHERE v.app_id IS NOT NULL
          AND (
              v.permission_code IN (SELECT permission_code FROM perms)
              OR ('app:' || v.acl_module) IN (SELECT permission_code FROM perms)
              OR ('module:' || v.acl_module) IN (SELECT permission_code FROM perms)
          )
    ) x
    WHERE COALESCE(app_id, '') <> '';
$$;


--
-- Name: FUNCTION ontology_current_accessible_apps(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_accessible_apps() IS 'Application nodes visible to the current role for agent ontology context';


--
-- Name: ontology_current_accessible_sensitive_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_accessible_sensitive_columns() RETURNS TABLE(column_id text)
    LANGUAGE sql STABLE
    AS $$
    WITH role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    )
    SELECT DISTINCT column_id
    FROM (
        SELECT
            c.table_schema || '.' || c.table_name || '.' || c.column_name AS column_id
        FROM public.ontology_column_semantics c
        CROSS JOIN super_flag s
        WHERE s.allowed
          AND c.is_active = true
          AND c.is_sensitive = true
        UNION ALL
        SELECT f.object_id AS column_id
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.object_type = 'column'
          AND f.predicate = 'risk:canAccessSensitiveColumn'
    ) x
    WHERE COALESCE(column_id, '') <> '';
$$;


--
-- Name: FUNCTION ontology_current_accessible_sensitive_columns(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_accessible_sensitive_columns() IS 'Sensitive column nodes visible to the current role for agent ontology context';


--
-- Name: ontology_current_accessible_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_accessible_tables() RETURNS TABLE(table_id text, access_level text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH perms AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    ),
    raw_access AS (
        SELECT
            t.table_schema || '.' || t.table_name AS table_id,
            'super'::TEXT AS access_level
        FROM public.ontology_table_semantics t
        CROSS JOIN super_flag s
        WHERE s.allowed
          AND t.is_active = true
        UNION ALL
        SELECT
            f.object_id AS table_id,
            CASE
                WHEN f.predicate = 'acl:canOperateTable' THEN 'operate'
                ELSE 'read'
            END AS access_level
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.object_type = 'table'
          AND f.predicate IN ('acl:canAccessTable', 'acl:canOperateTable')
        UNION ALL
        SELECT
            v.qualified_table AS table_id,
            'read'::TEXT AS access_level
        FROM public.v_app_form_ontology v
        WHERE COALESCE(v.qualified_table, '') <> ''
          AND (
              v.app_id::TEXT IN (SELECT app_id FROM public.ontology_current_accessible_apps())
              OR v.permission_code IN (SELECT permission_code FROM perms)
              OR ('app:' || v.acl_module) IN (SELECT permission_code FROM perms)
          )
    )
    SELECT
        table_id,
        CASE
            WHEN bool_or(access_level = 'super') THEN 'super'
            WHEN bool_or(access_level = 'operate') THEN 'operate'
            ELSE 'read'
        END AS access_level
    FROM raw_access
    WHERE COALESCE(table_id, '') <> ''
    GROUP BY table_id;
$$;


--
-- Name: FUNCTION ontology_current_accessible_tables(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_accessible_tables() IS 'Business table nodes visible to the current role for agent ontology context';


--
-- Name: ontology_current_can_manage_semantics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_can_manage_semantics() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH role_codes AS (
        SELECT lower(role_code) AS role_code
        FROM public.ontology_current_role_codes()
    ),
    permission_codes AS (
        SELECT lower(permission_code) AS permission_code
        FROM public.ontology_current_permissions()
    )
    SELECT EXISTS (
        SELECT 1
        FROM role_codes
        WHERE role_code IN ('super_admin', 'admin', 'ontology_admin', 'ontology_manager')
    )
    OR EXISTS (
        SELECT 1
        FROM permission_codes
        WHERE permission_code IN ('ontology:write', 'ontology.manage', 'ontology.semantic.write')
           OR permission_code LIKE '%ontology:write%'
           OR permission_code LIKE '%ontology.semantic%'
           OR (
              permission_code LIKE '%ontology%'
              AND (
                  permission_code LIKE '%write%'
                  OR permission_code LIKE '%manage%'
                  OR permission_code LIKE '%admin%'
              )
           )
    );
$$;


--
-- Name: FUNCTION ontology_current_can_manage_semantics(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_can_manage_semantics() IS 'Whether current application role can write ontology semantic metadata through agent-safe RPCs';


--
-- Name: ontology_current_claims(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_claims() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;


--
-- Name: FUNCTION ontology_current_claims(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_claims() IS 'Current PostgREST JWT claims as JSONB for ontology agent access checks';


--
-- Name: ontology_current_is_super(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_is_super() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ontology_current_role_codes() r
        WHERE lower(r.role_code) IN ('super_admin', 'admin')
    );
$$;


--
-- Name: FUNCTION ontology_current_is_super(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_is_super() IS 'Whether current application role is allowed to see the full ontology graph';


--
-- Name: ontology_current_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_permissions() RETURNS TABLE(permission_code text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH claims AS (
        SELECT public.ontology_current_claims() AS value
    ),
    claim_permissions AS (
        SELECT item AS permission_code
        FROM claims c
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(c.value -> 'permissions') = 'array' THEN c.value -> 'permissions'
                ELSE '[]'::jsonb
            END
        ) AS item
    ),
    role_permissions AS (
        SELECT p.code AS permission_code
        FROM public.ontology_current_role_codes() rc
        JOIN public.roles r ON r.code = rc.role_code
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p ON p.id = rp.permission_id
    )
    SELECT DISTINCT source.permission_code
    FROM (
        SELECT cp.permission_code FROM claim_permissions cp
        UNION ALL
        SELECT rp.permission_code FROM role_permissions rp
    ) source
    WHERE COALESCE(source.permission_code, '') <> '';

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'permissions'
          AND udt_name = '_text'
    ) THEN
        RETURN QUERY EXECUTE
            'select distinct unnest(coalesce(permissions, array[]::text[])) as permission_code
               from public.users
              where username = public.ontology_current_username()
                and coalesce(array_length(permissions, 1), 0) > 0';
    END IF;
END;
$$;


--
-- Name: FUNCTION ontology_current_permissions(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_permissions() IS 'Current effective permission codes from JWT claims, role_permissions, and legacy users.permissions';


--
-- Name: ontology_current_role_codes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_role_codes() RETURNS TABLE(role_code text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    WITH claims AS (
        SELECT public.ontology_current_claims() AS value
    ),
    claim_roles AS (
        SELECT NULLIF(value ->> 'app_role', '') AS role_code FROM claims
        UNION
        SELECT NULLIF(value ->> 'role_code', '') AS role_code FROM claims
    ),
    user_roles_from_matrix AS (
        SELECT r.code AS role_code
        FROM public.users u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = ur.role_id
        WHERE u.username = public.ontology_current_username()
    ),
    legacy_user_role AS (
        SELECT NULLIF(u.role, '') AS role_code
        FROM public.users u
        WHERE u.username = public.ontology_current_username()
    )
    SELECT DISTINCT role_code
    FROM (
        SELECT role_code FROM claim_roles
        UNION ALL
        SELECT role_code FROM user_roles_from_matrix
        UNION ALL
        SELECT role_code FROM legacy_user_role
    ) r
    WHERE COALESCE(role_code, '') <> '';
$$;


--
-- Name: FUNCTION ontology_current_role_codes(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_role_codes() IS 'Current application role codes from JWT claims plus persisted user role assignments';


--
-- Name: ontology_current_username(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_current_username() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
    SELECT COALESCE(
        NULLIF(public.ontology_current_claims() ->> 'username', ''),
        NULLIF(public.ontology_current_claims() ->> 'sub', ''),
        ''
    );
$$;


--
-- Name: FUNCTION ontology_current_username(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ontology_current_username() IS 'Current application username from JWT claims';


--
-- Name: ontology_fact_key(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ontology_fact_key(p_subject_type text, p_subject_id text, p_predicate text, p_object_type text, p_object_id text, p_inference_rule text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT md5(concat_ws(
        '|',
        COALESCE(p_subject_type, ''),
        COALESCE(p_subject_id, ''),
        COALESCE(p_predicate, ''),
        COALESCE(p_object_type, ''),
        COALESCE(p_object_id, ''),
        COALESCE(p_inference_rule, '')
    ));
$$;


--
-- Name: purchase_fill_arrival_order_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_fill_arrival_order_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  order_row public.purchase_orders%rowtype;
begin
  if new.order_id is null and nullif(new.order_no, '') is not null then
    select *
      into order_row
    from public.purchase_orders
    where order_no = new.order_no
    limit 1;
  elsif new.order_id is not null then
    select *
      into order_row
    from public.purchase_orders
    where id = new.order_id
    limit 1;
  end if;

  if found then
    new.order_id := order_row.id;
    new.order_no := order_row.order_no;
    new.supplier_id := coalesce(new.supplier_id, order_row.supplier_id);
    new.supplier_name := coalesce(nullif(new.supplier_name, ''), order_row.supplier_name);
    new.material_name := coalesce(nullif(new.material_name, ''), order_row.material_name);
    new.unit := coalesce(nullif(new.unit, ''), order_row.unit);
  end if;

  return new;
end;
$$;


--
-- Name: purchase_normalize_arrival_quality_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_normalize_arrival_quality_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if coalesce(new.accepted_quantity, 0) > coalesce(new.arrival_quantity, 0) then
    new.accepted_quantity := coalesce(new.arrival_quantity, 0);
  end if;

  if new.arrival_status = '已入库' then
    if new.iqc_status is distinct from '让步接收' then
      new.iqc_status := '合格';
    end if;
    if coalesce(new.accepted_quantity, 0) <= 0 then
      new.accepted_quantity := coalesce(new.arrival_quantity, 0);
    end if;
    if nullif(new.inbound_no, '') is null then
      new.inbound_no := 'IN' || to_char(now(), 'YYYYMMDDHH24MISSMS');
    end if;
  elsif new.iqc_status in ('不合格') then
    new.arrival_status := '异常';
    new.accepted_quantity := 0;
  elsif new.iqc_status in ('合格', '让步接收') and coalesce(new.accepted_quantity, 0) > 0 then
    new.arrival_status := case
      when nullif(new.inbound_no, '') is not null then '已入库'
      else '待检验'
    end;
  end if;

  return new;
end;
$$;


--
-- Name: purchase_refresh_order_arrival_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_refresh_order_arrival_status(target_order_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  ordered_qty numeric(14,2);
  arrived_qty numeric(14,2);
  current_order_status text;
  current_status text;
  next_order_status text;
begin
  if target_order_id is null then
    return;
  end if;

  select quantity, order_status, status
    into ordered_qty, current_order_status, current_status
  from public.purchase_orders
  where id = target_order_id;

  if not found or current_order_status = '已取消' then
    return;
  end if;

  select coalesce(sum(arrival_quantity), 0)::numeric(14,2)
    into arrived_qty
  from public.purchase_arrivals
  where order_id = target_order_id
    and coalesce(status, 'active') <> 'deleted';

  if arrived_qty <= 0 then
    if current_order_status in ('草稿') then
      next_order_status := current_order_status;
    elsif current_order_status in ('部分到货', '已完成') then
      next_order_status := '已下单';
    else
      next_order_status := current_order_status;
    end if;
  elsif ordered_qty > 0 and arrived_qty >= ordered_qty then
    next_order_status := '已完成';
  else
    next_order_status := '部分到货';
  end if;

  update public.purchase_orders
  set order_status = next_order_status,
      status = case
        when current_status in ('disabled', 'locked') then current_status
        when arrived_qty > 0 then 'active'
        else current_status
      end,
      updated_at = now()
  where id = target_order_id
    and (
      order_status is distinct from next_order_status
      or status is distinct from case
        when current_status in ('disabled', 'locked') then current_status
        when arrived_qty > 0 then 'active'
        else current_status
      end
    );
end;
$$;


--
-- Name: purchase_refresh_order_arrival_status_from_order_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_refresh_order_arrival_status_from_order_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform public.purchase_refresh_order_arrival_status(new.id);
  return null;
end;
$$;


--
-- Name: purchase_refresh_order_arrival_status_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_refresh_order_arrival_status_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.purchase_refresh_order_arrival_status(new.order_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform public.purchase_refresh_order_arrival_status(old.order_id);
  end if;

  return null;
end;
$$;


--
-- Name: purchase_set_order_total_amount(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_set_order_total_amount() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.total_amount := round(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0), 2);
  return new;
end;
$$;


--
-- Name: query_ontology_kg_neighbors(text, text, text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text DEFAULT 'both'::text, p_max_depth integer DEFAULT 1, p_limit integer DEFAULT 200, p_predicate text DEFAULT NULL::text) RETURNS TABLE(depth integer, edge_direction text, from_type text, from_id text, from_label text, predicate text, to_type text, to_id text, to_label text, edge_id bigint, edge_subject_type text, edge_subject_id text, edge_object_type text, edge_object_id text, inference_rule text, rule_name text, is_inferred boolean, confidence numeric, path_text text, path_nodes text[], path_edges bigint[], evidence jsonb)
    LANGUAGE sql STABLE
    AS $$
    WITH RECURSIVE params AS (
        SELECT
            NULLIF(p_node_type, '') AS node_type,
            NULLIF(p_node_id, '') AS node_id,
            CASE
                WHEN lower(COALESCE(NULLIF(p_direction, ''), 'both')) IN ('outgoing', 'incoming', 'both')
                    THEN lower(COALESCE(NULLIF(p_direction, ''), 'both'))
                ELSE 'both'
            END AS direction,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 1), 4)) AS max_depth,
            GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000)) AS row_limit,
            NULLIF(p_predicate, '') AS predicate_filter
    ),
    oriented_edges AS (
        SELECT
            'outgoing'::TEXT AS edge_direction,
            e.subject_type AS from_type,
            e.subject_id AS from_id,
            e.subject_label AS from_label,
            e.object_type AS to_type,
            e.object_id AS to_id,
            e.object_label AS to_label,
            e.id AS edge_id,
            e.subject_type AS edge_subject_type,
            e.subject_id AS edge_subject_id,
            e.object_type AS edge_object_type,
            e.object_id AS edge_object_id,
            e.predicate,
            e.inference_rule,
            e.rule_name,
            e.is_inferred,
            e.confidence,
            e.evidence
        FROM public.v_ontology_reasoning_edges e
        CROSS JOIN params p
        WHERE p.direction IN ('outgoing', 'both')
          AND (p.predicate_filter IS NULL OR e.predicate = p.predicate_filter)
        UNION ALL
        SELECT
            'incoming'::TEXT AS edge_direction,
            e.object_type AS from_type,
            e.object_id AS from_id,
            e.object_label AS from_label,
            e.subject_type AS to_type,
            e.subject_id AS to_id,
            e.subject_label AS to_label,
            e.id AS edge_id,
            e.subject_type AS edge_subject_type,
            e.subject_id AS edge_subject_id,
            e.object_type AS edge_object_type,
            e.object_id AS edge_object_id,
            e.predicate,
            e.inference_rule,
            e.rule_name,
            e.is_inferred,
            e.confidence,
            e.evidence
        FROM public.v_ontology_reasoning_edges e
        CROSS JOIN params p
        WHERE p.direction IN ('incoming', 'both')
          AND (p.predicate_filter IS NULL OR e.predicate = p.predicate_filter)
    ),
    walk AS (
        SELECT
            1::INTEGER AS depth,
            oe.edge_direction,
            oe.from_type,
            oe.from_id,
            oe.from_label,
            oe.predicate,
            oe.to_type,
            oe.to_id,
            oe.to_label,
            oe.edge_id,
            oe.edge_subject_type,
            oe.edge_subject_id,
            oe.edge_object_type,
            oe.edge_object_id,
            oe.inference_rule,
            oe.rule_name,
            oe.is_inferred,
            oe.confidence,
            CASE
                WHEN oe.edge_direction = 'outgoing'
                    THEN format('%s:%s -[%s]-> %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
                ELSE format('%s:%s <-[%s]- %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
            END AS path_text,
            ARRAY[oe.from_type || ':' || oe.from_id, oe.to_type || ':' || oe.to_id]::TEXT[] AS path_nodes,
            ARRAY[oe.edge_id]::BIGINT[] AS path_edges,
            oe.evidence
        FROM oriented_edges oe
        CROSS JOIN params p
        WHERE oe.from_type = p.node_type
          AND oe.from_id = p.node_id
        UNION ALL
        SELECT
            w.depth + 1,
            oe.edge_direction,
            oe.from_type,
            oe.from_id,
            oe.from_label,
            oe.predicate,
            oe.to_type,
            oe.to_id,
            oe.to_label,
            oe.edge_id,
            oe.edge_subject_type,
            oe.edge_subject_id,
            oe.edge_object_type,
            oe.edge_object_id,
            oe.inference_rule,
            oe.rule_name,
            oe.is_inferred,
            oe.confidence,
            w.path_text || ' | ' ||
                CASE
                    WHEN oe.edge_direction = 'outgoing'
                        THEN format('%s:%s -[%s]-> %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
                    ELSE format('%s:%s <-[%s]- %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
                END AS path_text,
            w.path_nodes || (oe.to_type || ':' || oe.to_id),
            w.path_edges || oe.edge_id,
            oe.evidence
        FROM walk w
        JOIN oriented_edges oe
          ON oe.from_type = w.to_type
         AND oe.from_id = w.to_id
        CROSS JOIN params p
        WHERE w.depth < p.max_depth
          AND NOT (oe.to_type || ':' || oe.to_id) = ANY(w.path_nodes)
          AND NOT oe.edge_id = ANY(w.path_edges)
    )
    SELECT
        w.depth,
        w.edge_direction,
        w.from_type,
        w.from_id,
        w.from_label,
        w.predicate,
        w.to_type,
        w.to_id,
        w.to_label,
        w.edge_id,
        w.edge_subject_type,
        w.edge_subject_id,
        w.edge_object_type,
        w.edge_object_id,
        w.inference_rule,
        w.rule_name,
        w.is_inferred,
        w.confidence,
        w.path_text,
        w.path_nodes,
        w.path_edges,
        w.evidence
    FROM walk w
    CROSS JOIN params p
    ORDER BY w.depth, w.edge_direction, w.predicate, w.to_type, w.to_id, w.edge_id
    LIMIT (SELECT row_limit FROM params);
$$;


--
-- Name: FUNCTION query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text) IS 'Traverse ontology KG neighbors from a node with bounded depth and optional direction/predicate filters';


--
-- Name: raw_materials_set_dept_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.raw_materials_set_dept_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.dept_id is null then
    new.dept_id := public.current_user_dept_id();
  end if;
  return new;
end;
$$;


--
-- Name: refresh_ontology_inferences(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_ontology_inferences(p_max_depth integer DEFAULT 4) RETURNS TABLE(run_id uuid, facts_inserted integer, max_depth integer, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'app_data', 'app_center', 'workflow', 'pg_temp'
    AS $$
DECLARE
    v_run_id UUID := gen_random_uuid();
    v_max_depth INTEGER := LEAST(GREATEST(COALESCE(p_max_depth, 4), 0), 8);
    v_depth INTEGER;
    v_delta INTEGER;
    v_claims_text TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
    v_claims JSONB := '{}'::jsonb;
    v_app_role TEXT := '';
BEGIN
    IF v_claims_text IS NOT NULL THEN
        v_claims := v_claims_text::jsonb;
        v_app_role := COALESCE(NULLIF(v_claims ->> 'app_role', ''), NULLIF(current_setting('request.jwt.claim.app_role', true), ''));
        IF COALESCE(v_app_role, '') <> 'super_admin' THEN
            RAISE EXCEPTION 'ontology reasoning refresh requires super_admin'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    INSERT INTO public.ontology_reasoning_runs(run_id, max_depth, status)
    VALUES (v_run_id, v_max_depth, 'running');

    DELETE FROM public.ontology_inferred_facts;

    -- Table semantic type/domain facts.
    WITH facts AS (
        SELECT
            'table'::TEXT AS subject_type,
            ots.table_schema || '.' || ots.table_name AS subject_id,
            COALESCE(NULLIF(ots.semantic_name, ''), ots.table_schema || '.' || ots.table_name) AS subject_label,
            'rdf:type'::TEXT AS predicate,
            'semantic_class'::TEXT AS object_type,
            ots.semantic_class AS object_id,
            ots.semantic_class AS object_label,
            'seed_table_type'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object(
                'table_schema', ots.table_schema,
                'table_name', ots.table_name,
                'semantic_domain', ots.semantic_domain,
                'is_business', ots.is_business
            ) AS evidence
        FROM public.ontology_table_semantics ots
        WHERE ots.is_active = true
        UNION ALL
        SELECT
            'table',
            ots.table_schema || '.' || ots.table_name,
            COALESCE(NULLIF(ots.semantic_name, ''), ots.table_schema || '.' || ots.table_name),
            'ontology:hasDomain',
            'semantic_domain',
            ots.semantic_domain,
            ots.semantic_domain,
            'seed_table_domain',
            false,
            jsonb_build_object(
                'table_schema', ots.table_schema,
                'table_name', ots.table_name,
                'semantic_class', ots.semantic_class
            )
        FROM public.ontology_table_semantics ots
        WHERE ots.is_active = true
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Column semantic facts.
    WITH facts AS (
        SELECT
            'column'::TEXT AS subject_type,
            ocs.table_schema || '.' || ocs.table_name || '.' || ocs.column_name AS subject_id,
            COALESCE(NULLIF(ocs.semantic_name, ''), ocs.column_name) AS subject_label,
            'ontology:belongsTo'::TEXT AS predicate,
            'table'::TEXT AS object_type,
            ocs.table_schema || '.' || ocs.table_name AS object_id,
            COALESCE(NULLIF(ots.semantic_name, ''), ocs.table_schema || '.' || ocs.table_name) AS object_label,
            'seed_column_belongs'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object(
                'column_name', ocs.column_name,
                'semantic_class', ocs.semantic_class,
                'data_type', ocs.data_type,
                'ui_type', ocs.ui_type,
                'is_sensitive', ocs.is_sensitive
            ) AS evidence
        FROM public.ontology_column_semantics ocs
        JOIN public.ontology_table_semantics ots
          ON ots.table_schema = ocs.table_schema
         AND ots.table_name = ocs.table_name
         AND ots.is_active = true
        WHERE ocs.is_active = true
        UNION ALL
        SELECT
            'table',
            ocs.table_schema || '.' || ocs.table_name,
            COALESCE(NULLIF(ots.semantic_name, ''), ocs.table_schema || '.' || ocs.table_name),
            'data:hasSensitiveColumn',
            'column',
            ocs.table_schema || '.' || ocs.table_name || '.' || ocs.column_name,
            COALESCE(NULLIF(ocs.semantic_name, ''), ocs.column_name),
            'seed_sensitive_column',
            false,
            jsonb_build_object(
                'column_name', ocs.column_name,
                'semantic_class', ocs.semantic_class,
                'data_type', ocs.data_type,
                'ui_type', ocs.ui_type
            )
        FROM public.ontology_column_semantics ocs
        JOIN public.ontology_table_semantics ots
          ON ots.table_schema = ocs.table_schema
         AND ots.table_name = ocs.table_name
         AND ots.is_active = true
        WHERE ocs.is_active = true
          AND ocs.is_sensitive = true
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Existing ontology/fk relation facts.
    WITH facts AS (
        SELECT
            'table'::TEXT AS subject_type,
            rel.subject_table AS subject_id,
            COALESCE(NULLIF(rel.subject_semantic_name, ''), rel.subject_table) AS subject_label,
            rel.predicate,
            'table'::TEXT AS object_type,
            rel.object_table AS object_id,
            COALESCE(NULLIF(rel.object_semantic_name, ''), rel.object_table) AS object_label,
            'seed_table_relation'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object(
                'relation_type', rel.relation_type,
                'subject_column', rel.subject_column,
                'object_column', rel.object_column,
                'bridge_table', rel.bridge_table,
                'details', rel.details,
                'is_business_relation', rel.is_business_relation
            ) AS evidence
        FROM app_data.ontology_table_relations rel
        WHERE COALESCE(rel.subject_table, '') <> ''
          AND COALESCE(rel.object_table, '') <> ''
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- App / permission / role facts.
    WITH facts AS (
        SELECT
            'app'::TEXT AS subject_type,
            app.app_id::TEXT AS subject_id,
            app.app_name AS subject_label,
            'app:usesTable'::TEXT AS predicate,
            'table'::TEXT AS object_type,
            app.qualified_table AS object_id,
            COALESCE(NULLIF(app.table_semantic_name, ''), app.qualified_table) AS object_label,
            'seed_app_table'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object('app_type', app.app_type, 'acl_module', app.acl_module, 'route_path', app.route_path) AS evidence
        FROM public.v_app_form_ontology app
        WHERE COALESCE(app.qualified_table, '') <> ''
        UNION ALL
        SELECT
            'app',
            app.app_id::TEXT,
            app.app_name,
            'acl:requiresPermission',
            'permission',
            app.permission_code,
            COALESCE(NULLIF(app.permission_name, ''), app.permission_code),
            'seed_app_permission',
            false,
            jsonb_build_object('acl_module', app.acl_module, 'permission_mode', app.permission_mode, 'app_type', app.app_type)
        FROM public.v_app_form_ontology app
        WHERE COALESCE(app.permission_code, '') <> ''
        UNION ALL
        SELECT
            'permission',
            po.code,
            COALESCE(NULLIF(po.name, ''), po.code),
            'rdf:type',
            'permission_kind',
            po.semantic_kind,
            po.semantic_kind,
            'seed_permission_kind',
            false,
            jsonb_build_object(
                'scope', po.scope,
                'entity_key', po.entity_key,
                'action_key', po.action_key,
                'transition_from', po.transition_from,
                'transition_to', po.transition_to
            )
        FROM public.v_permission_ontology po
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:grantsPermission',
            'permission',
            rp.permission_code,
            COALESCE(NULLIF(rp.permission_name, ''), rp.permission_code),
            'seed_role_permission',
            false,
            jsonb_build_object(
                'semantic_kind', rp.semantic_kind,
                'entity_key', rp.entity_key,
                'action_key', rp.action_key,
                'transition_from', rp.transition_from,
                'transition_to', rp.transition_to
            )
        FROM public.v_role_permission_ontology rp
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Role-to-app/table/action inference.
    WITH facts AS (
        SELECT
            'role'::TEXT AS subject_type,
            rp.role_code AS subject_id,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code) AS subject_label,
            'acl:canAccessApp'::TEXT AS predicate,
            'app'::TEXT AS object_type,
            app.app_id::TEXT AS object_id,
            app.app_name AS object_label,
            'infer_role_can_access_app'::TEXT AS inference_rule,
            true AS is_inferred,
            jsonb_build_object('permission_code', rp.permission_code, 'app_name', app.app_name, 'acl_module', app.acl_module) AS evidence
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.permission_code = rp.permission_code
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:canOperateAppAction',
            'app_action',
            app.app_id::TEXT || ':' || COALESCE(NULLIF(rp.action_key, ''), rp.semantic_kind),
            app.app_name || ':' || COALESCE(NULLIF(rp.action_key, ''), rp.semantic_kind),
            'infer_role_can_operate_app_action',
            true,
            jsonb_build_object(
                'permission_code', rp.permission_code,
                'app_id', app.app_id,
                'app_name', app.app_name,
                'acl_module', app.acl_module,
                'action_key', rp.action_key,
                'semantic_kind', rp.semantic_kind
            )
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.acl_module = rp.entity_key
        WHERE rp.semantic_kind IN ('operation', 'workflow', 'status_transition')
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:canAccessTable',
            'table',
            app.qualified_table,
            COALESCE(NULLIF(app.table_semantic_name, ''), app.qualified_table),
            'infer_role_can_access_table',
            true,
            jsonb_build_object('permission_code', rp.permission_code, 'app_id', app.app_id, 'app_name', app.app_name)
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.permission_code = rp.permission_code
        WHERE COALESCE(app.qualified_table, '') <> ''
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:canOperateTable',
            'table',
            app.qualified_table,
            COALESCE(NULLIF(app.table_semantic_name, ''), app.qualified_table),
            'infer_role_can_operate_table',
            true,
            jsonb_build_object(
                'permission_code', rp.permission_code,
                'app_id', app.app_id,
                'app_name', app.app_name,
                'action_key', rp.action_key,
                'semantic_kind', rp.semantic_kind
            )
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.acl_module = rp.entity_key
        WHERE rp.semantic_kind IN ('operation', 'workflow', 'status_transition')
          AND COALESCE(app.qualified_table, '') <> ''
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Workflow transition inference.
    WITH facts AS (
        SELECT
            'role'::TEXT AS subject_type,
            rp.role_code AS subject_id,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code) AS subject_label,
            'wf:canPerformTransition'::TEXT AS predicate,
            'workflow_transition'::TEXT AS object_type,
            tr.workflow_app_id::TEXT || ':' ||
                COALESCE(NULLIF(tr.from_task_id, ''), COALESCE(tr.from_state, '*')) || '->' ||
                COALESCE(NULLIF(tr.to_task_id, ''), COALESCE(tr.to_state, '*')) AS object_id,
            app.app_name || ':' ||
                COALESCE(NULLIF(tr.from_state, ''), COALESCE(tr.from_task_id, '*')) || ' -> ' ||
                COALESCE(NULLIF(tr.to_state, ''), COALESCE(tr.to_task_id, '*')) AS object_label,
            'infer_workflow_transition'::TEXT AS inference_rule,
            true AS is_inferred,
            jsonb_build_object(
                'workflow_app_id', tr.workflow_app_id,
                'app_name', app.app_name,
                'from_task_id', tr.from_task_id,
                'to_task_id', tr.to_task_id,
                'from_state', tr.from_state,
                'to_state', tr.to_state,
                'required_permission', tr.required_permission
            ) AS evidence
        FROM app_center.workflow_transition_rules tr
        JOIN public.v_app_form_ontology app
          ON app.app_id = tr.workflow_app_id
        JOIN public.v_role_permission_ontology rp
          ON rp.permission_code = tr.required_permission
        WHERE tr.is_active = true
          AND COALESCE(tr.required_permission, '') <> ''
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Sensitive exposure diagnostics.
    WITH facts AS (
        SELECT
            access.subject_type,
            access.subject_id,
            access.subject_label,
            'risk:canAccessSensitiveColumn'::TEXT AS predicate,
            sensitive.object_type,
            sensitive.object_id,
            sensitive.object_label,
            'infer_sensitive_column_exposure'::TEXT AS inference_rule,
            true AS is_inferred,
            jsonb_build_object(
                'table', access.object_id,
                'access_predicate', access.predicate,
                'access_rule', access.inference_rule,
                'sensitive_column', sensitive.object_id,
                'sensitive_column_label', sensitive.object_label
            ) AS evidence
        FROM public.ontology_inferred_facts access
        JOIN public.ontology_inferred_facts sensitive
          ON sensitive.subject_type = 'table'
         AND sensitive.subject_id = access.object_id
         AND sensitive.predicate = 'data:hasSensitiveColumn'
        WHERE access.run_id = v_run_id
          AND sensitive.run_id = v_run_id
          AND access.subject_type = 'role'
          AND access.object_type = 'table'
          AND access.predicate IN ('acl:canAccessTable', 'acl:canOperateTable')
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Transitive dependency closure.
    IF EXISTS (
        SELECT 1 FROM public.ontology_inference_rules
        WHERE rule_code = 'infer_transitive_dependency' AND is_active = true
    ) THEN
        FOR v_depth IN 1..v_max_depth LOOP
            WITH facts AS (
                SELECT
                    prior.subject_type,
                    prior.subject_id,
                    prior.subject_label,
                    'ontology:transitivelyDependsOn'::TEXT AS predicate,
                    direct.object_type,
                    direct.object_id,
                    direct.object_label,
                    'infer_transitive_dependency'::TEXT AS inference_rule,
                    true AS is_inferred,
                    jsonb_build_object(
                        'via', prior.object_id,
                        'prior_fact_id', prior.id,
                        'direct_fact_id', direct.id,
                        'depth', v_depth
                    ) AS evidence
                FROM public.ontology_inferred_facts prior
                JOIN public.ontology_inferred_facts direct
                  ON direct.subject_type = prior.object_type
                 AND direct.subject_id = prior.object_id
                 AND direct.predicate = 'ontology:dependsOn'
                 AND direct.object_type = 'table'
                WHERE prior.run_id = v_run_id
                  AND direct.run_id = v_run_id
                  AND prior.subject_type = 'table'
                  AND prior.object_type = 'table'
                  AND prior.predicate IN ('ontology:dependsOn', 'ontology:transitivelyDependsOn')
                  AND prior.subject_id <> direct.object_id
            )
            INSERT INTO public.ontology_inferred_facts (
                run_id, fact_key, subject_type, subject_id, subject_label,
                predicate, object_type, object_id, object_label,
                inference_rule, inference_depth, is_inferred, evidence
            )
            SELECT
                v_run_id,
                public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
                subject_type,
                subject_id,
                subject_label,
                predicate,
                object_type,
                object_id,
                object_label,
                inference_rule,
                v_depth,
                is_inferred,
                evidence
            FROM facts
            ON CONFLICT (fact_key) DO NOTHING;

            GET DIAGNOSTICS v_delta = ROW_COUNT;
            EXIT WHEN v_delta = 0;
        END LOOP;
    END IF;

    UPDATE public.ontology_reasoning_runs r
       SET finished_at = NOW(),
           status = 'completed',
           facts_inserted = (
               SELECT COUNT(*)::INTEGER
               FROM public.ontology_inferred_facts f
               WHERE f.run_id = v_run_id
           )
     WHERE r.run_id = v_run_id;

    RETURN QUERY
    SELECT
        r.run_id,
        r.facts_inserted,
        r.max_depth,
        r.status
    FROM public.ontology_reasoning_runs r
    WHERE r.run_id = v_run_id;
EXCEPTION WHEN OTHERS THEN
    UPDATE public.ontology_reasoning_runs r
       SET finished_at = NOW(),
           status = 'failed',
           error_message = SQLERRM
     WHERE r.run_id = v_run_id;
    RAISE;
END;
$$;


--
-- Name: FUNCTION refresh_ontology_inferences(p_max_depth integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.refresh_ontology_inferences(p_max_depth integer) IS 'Refreshes read-only ontology reasoning facts without modifying business tables';


--
-- Name: safe_parse_jsonb(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.safe_parse_jsonb(raw text) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
begin
  if raw is null or trim(raw) = '' then
    return null;
  end if;
  return raw::jsonb;
exception when others then
  return null;
end;
$$;


--
-- Name: search_ontology_kg_nodes(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_ontology_kg_nodes(p_query text DEFAULT NULL::text, p_node_type text DEFAULT NULL::text, p_limit integer DEFAULT 50) RETURNS TABLE(id integer, node_key text, node_type text, node_id text, node_label text, semantic_domain text, semantic_class text, is_sensitive boolean, outgoing_edges integer, incoming_edges integer, total_degree integer, predicate_count integer, predicates jsonb, tags jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        n.id,
        n.node_key,
        n.node_type,
        n.node_id,
        n.node_label,
        n.semantic_domain,
        n.semantic_class,
        n.is_sensitive,
        n.outgoing_edges,
        n.incoming_edges,
        n.total_degree,
        n.predicate_count,
        n.predicates,
        n.tags
    FROM public.v_ontology_kg_nodes n
    WHERE (NULLIF(p_node_type, '') IS NULL OR n.node_type = p_node_type)
      AND (
          NULLIF(p_query, '') IS NULL
          OR n.node_id ILIKE '%' || p_query || '%'
          OR n.node_label ILIKE '%' || p_query || '%'
          OR n.semantic_class ILIKE '%' || p_query || '%'
          OR n.semantic_domain ILIKE '%' || p_query || '%'
      )
    ORDER BY n.total_degree DESC, n.node_type, n.node_label, n.node_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
$$;


--
-- Name: FUNCTION search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer) IS 'Search ontology KG nodes by id, label, semantic class, or semantic domain';


--
-- Name: seed_workflow_status_permissions(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_workflow_status_permissions(p_role_codes text[] DEFAULT ARRAY['super_admin'::text]) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total INTEGER := 0;
BEGIN
    WITH app_catalog AS (
        SELECT
            split_part(p.code, ':', 2) AS app_key,
            MAX(
                COALESCE(
                    NULLIF(split_part(p.name, '-', 2), ''),
                    NULLIF(p.name, ''),
                    split_part(p.code, ':', 2)
                )
            ) AS app_label
        FROM public.permissions p
        WHERE p.code LIKE 'app:%'
        GROUP BY 1
    ),
    transitions AS (
        SELECT *
        FROM (
            VALUES
                ('created', 'active', 'created', 'active'),
                ('created', 'locked', 'created', 'locked'),
                ('active', 'locked', 'active', 'locked'),
                ('active', 'created', 'active', 'created'),
                ('locked', 'active', 'locked', 'active'),
                ('locked', 'created', 'locked', 'created')
        ) AS t(from_state, to_state, from_label, to_label)
    ),
    generated AS (
        SELECT
            format('op:%s.workflow_start', a.app_key) AS code,
            format('%s-workflow-start', a.app_label) AS name,
            a.app_label AS module,
            'workflow_start' AS action
        FROM app_catalog a
        UNION ALL
        SELECT
            format('op:%s.workflow_transition', a.app_key),
            format('%s-workflow-transition', a.app_label),
            a.app_label,
            'workflow_transition'
        FROM app_catalog a
        UNION ALL
        SELECT
            format('op:%s.workflow_complete', a.app_key),
            format('%s-workflow-complete', a.app_label),
            a.app_label,
            'workflow_complete'
        FROM app_catalog a
        UNION ALL
        SELECT
            format('op:%s.status_transition.%s_%s', a.app_key, t.from_state, t.to_state),
            format('%s-status-transition-%s-to-%s', a.app_label, t.from_label, t.to_label),
            a.app_label,
            'status_transition'
        FROM app_catalog a
        CROSS JOIN transitions t
    ),
    upserted AS (
        INSERT INTO public.permissions (code, name, module, action)
        SELECT g.code, g.name, g.module, g.action
        FROM generated g
        ON CONFLICT (code) DO UPDATE
            SET name = EXCLUDED.name,
                module = EXCLUDED.module,
                action = EXCLUDED.action,
                updated_at = NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_total FROM upserted;

    WITH app_catalog AS (
        SELECT
            split_part(p.code, ':', 2) AS app_key,
            MAX(
                COALESCE(
                    NULLIF(split_part(p.name, '-', 2), ''),
                    NULLIF(p.name, ''),
                    split_part(p.code, ':', 2)
                )
            ) AS app_label
        FROM public.permissions p
        WHERE p.code LIKE 'app:%'
        GROUP BY 1
    ),
    transitions AS (
        SELECT *
        FROM (
            VALUES
                ('created', 'active'),
                ('created', 'locked'),
                ('active', 'locked'),
                ('active', 'created'),
                ('locked', 'active'),
                ('locked', 'created')
        ) AS t(from_state, to_state)
    ),
    generated AS (
        SELECT format('op:%s.workflow_start', a.app_key) AS code
        FROM app_catalog a
        UNION ALL
        SELECT format('op:%s.workflow_transition', a.app_key)
        FROM app_catalog a
        UNION ALL
        SELECT format('op:%s.workflow_complete', a.app_key)
        FROM app_catalog a
        UNION ALL
        SELECT format('op:%s.status_transition.%s_%s', a.app_key, t.from_state, t.to_state)
        FROM app_catalog a
        CROSS JOIN transitions t
    )
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM generated g
    JOIN public.permissions p ON p.code = g.code
    JOIN public.roles r ON r.code = ANY(p_role_codes)
    ON CONFLICT DO NOTHING;

    RETURN v_total;
END;
$$;


--
-- Name: FUNCTION seed_workflow_status_permissions(p_role_codes text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seed_workflow_status_permissions(p_role_codes text[]) IS 'Seed workflow/status permissions for existing app:* codes';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sign(json, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sign(payload json, secret text, algorithm text DEFAULT 'HS256'::text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
WITH
  header AS (
    SELECT url_encode(convert_to('{"alg":"' || algorithm || '","typ":"JWT"}', 'utf8')) AS data
  ),
  payload AS (
    SELECT url_encode(convert_to(payload::text, 'utf8')) AS data
  ),
  sign_data AS (
    SELECT header.data || '.' || payload.data AS data FROM header, payload
  )
SELECT
  header.data || '.' || payload.data || '.' ||
  url_encode(hmac(sign_data.data, secret, 'sha256'))
FROM header, payload, sign_data;
$$;


--
-- Name: sync_field_acl_from_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_field_acl_from_config() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  module_name text;
  dynamic_codes text[];
  static_codes text[];
  field_codes text[];
begin
  if TG_OP not in ('INSERT', 'UPDATE') then
    return NEW;
  end if;

  if NEW.key is null or NEW.key = '' then
    return NEW;
  end if;

  module_name := case NEW.key
    when 'hr_table_cols' then 'hr_employee'
    when 'hr_transfer_cols' then 'hr_change'
    when 'hr_attendance_cols' then 'hr_attendance'
    when 'materials_table_cols' then 'mms_ledger'
    else null
  end;

  if module_name is null then
    return NEW;
  end if;

  if jsonb_typeof(NEW.value) = 'array' then
    select array_agg(distinct (elem->>'prop'))
      into dynamic_codes
    from jsonb_array_elements(NEW.value) as elem
    where (elem ? 'prop') and (elem->>'prop') <> '';
  end if;

  if module_name in ('hr_employee', 'hr_change') then
    select array_agg(c.column_name order by c.ordinal_position)
      into static_codes
    from information_schema.columns c
    where c.table_schema = 'hr'
      and c.table_name = 'archives'
      and c.column_name not in ('properties','version','updated_at');
  elsif module_name = 'hr_attendance' then
    select array_agg(col order by ord) into static_codes
    from (
      select distinct on (c.column_name)
        c.column_name as col,
        min(c.ordinal_position) over (partition by c.column_name) as ord
      from information_schema.columns c
      where c.table_schema = 'hr'
        and c.table_name in ('attendance_records','attendance_month_overrides')
    ) t
    where t.col is not null;
  elsif module_name = 'mms_ledger' then
    select array_agg(c.column_name order by c.ordinal_position)
      into static_codes
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'raw_materials';
  else
    static_codes := ARRAY[]::text[];
  end if;

  field_codes := array_cat(coalesce(static_codes, ARRAY[]::text[]), coalesce(dynamic_codes, ARRAY[]::text[]));
  if array_length(field_codes, 1) is null then
    return NEW;
  end if;

  perform public.ensure_field_acl(module_name, field_codes);
  return NEW;
end;
$$;


--
-- Name: sync_smart_bi_action_item_from_workflow(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_smart_bi_action_item_from_workflow() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'workflow'
    AS $_$
DECLARE
    v_action_id_text TEXT;
    v_action_id INT;
    v_next_status TEXT;
BEGIN
    v_action_id_text := COALESCE(
        NEW.variables ->> 'smart_bi_action_item_id',
        NEW.variables #>> '{smart_bi_action,action_item_id}'
    );

    IF v_action_id_text IS NULL OR v_action_id_text !~ '^[0-9]+$' THEN
        RETURN NEW;
    END IF;

    v_action_id := v_action_id_text::INT;

    v_next_status := CASE
        WHEN COALESCE(NEW.status, '') = 'COMPLETED'
             AND COALESCE(NEW.variables ->> 'rejected', 'false') = 'true' THEN '已驳回'
        WHEN COALESCE(NEW.status, '') = 'COMPLETED' THEN '已闭环'
        WHEN NEW.current_task_id = 'Task_BIReview' THEN '待确认'
        WHEN NEW.current_task_id = 'Task_BIExecute' THEN '执行中'
        WHEN NEW.current_task_id = 'Task_BIVerify' THEN '待验证'
        ELSE NULL
    END;

    UPDATE public.smart_bi_action_items
       SET workflow_definition_id = NEW.definition_id,
           workflow_instance_id = NEW.id,
           status = COALESCE(v_next_status, status),
           closed_at = CASE
               WHEN COALESCE(NEW.status, '') = 'COMPLETED' THEN COALESCE(closed_at, NOW())
               ELSE closed_at
           END,
           updated_at = NOW()
     WHERE id = v_action_id;

    RETURN NEW;
END;
$_$;


--
-- Name: tg_v_role_data_scopes_matrix_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_role_data_scopes_matrix_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.role_data_scopes (role_id, module, scope_type, dept_id)
  values (new.role_id, new.module, coalesce(new.scope_type, 'self'), new.dept_id)
  on conflict (role_id, module) do update
    set scope_type = excluded.scope_type,
        dept_id = excluded.dept_id,
        updated_at = now();
  return new;
end;
$$;


--
-- Name: tg_v_role_permissions_matrix_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_role_permissions_matrix_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.granted is distinct from old.granted then
    if new.granted then
      insert into public.role_permissions (role_id, permission_id)
      values (old.role_id, old.permission_id)
      on conflict do nothing;
    else
      delete from public.role_permissions
      where role_id = old.role_id and permission_id = old.permission_id;
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: tg_v_roles_manage_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_roles_manage_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  delete from public.roles where id = old.id;
  return old;
end;
$$;


--
-- Name: tg_v_roles_manage_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_roles_manage_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.roles (code, name, description, sort)
  values (new.code, new.name, new.description, new.sort);
  return new;
end;
$$;


--
-- Name: tg_v_roles_manage_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_roles_manage_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.roles
  set code = new.code,
      name = new.name,
      description = new.description,
      sort = new.sort
  where id = old.id;
  return new;
end;
$$;


--
-- Name: tg_v_users_manage_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_users_manage_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  delete from public.user_roles where user_id = old.id;
  delete from public.users where id = old.id;
  return old;
end;
$$;


--
-- Name: tg_v_users_manage_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_users_manage_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  _user_id integer;
BEGIN
  INSERT INTO public.users (username, password, full_name, phone, email, status, sop_role)
  VALUES (
    coalesce(new.username, 'user_' || to_char(now(), 'HH24MISS')),
    coalesce(nullif(new.password, ''), encode(gen_random_bytes(32), 'hex')),
    new.full_name,
    new.phone,
    new.email,
    coalesce(new.status, 'active'),
    nullif(new.sop_role, '')
  )
  RETURNING id INTO _user_id;

  IF new.avatar IS NOT NULL THEN
    UPDATE public.users SET avatar = new.avatar WHERE id = _user_id;
  END IF;

  IF new.role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (_user_id, new.role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  new.id := _user_id;
  RETURN new;
END;
$$;


--
-- Name: tg_v_users_manage_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_v_users_manage_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.users
  set username = coalesce(new.username, old.username),
      full_name = new.full_name,
      phone = new.phone,
      email = new.email,
      status = coalesce(new.status, old.status),
      sop_role = nullif(new.sop_role, ''),
      avatar = new.avatar,
      updated_at = now()
  where id = old.id;

  if new.password is not null and new.password <> '' then
    update public.users set password = new.password where id = old.id;
  end if;

  if new.role_id is distinct from old.role_id then
    delete from public.user_roles where user_id = old.id;
    if new.role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (old.id, new.role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: touch_field_label_overrides(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_field_label_overrides() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_smart_bi_action_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_smart_bi_action_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- Name: touch_sop_learning_records(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_sop_learning_records() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: upsert_field_acl(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_field_acl(payload jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  _count integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return 0;
  end if;

  with items as (
    select
      (value->>'role_code')::text as role_code,
      (value->>'module')::text as module,
      (value->>'field_code')::text as field_code,
      coalesce((value->>'can_view')::boolean, true) as can_view,
      coalesce((value->>'can_edit')::boolean, true) as can_edit
    from jsonb_array_elements(payload)
  ),
  upserted as (
    insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
    select r.id, i.module, i.field_code, i.can_view, i.can_edit
    from items i
    join public.roles r on r.code = i.role_code
    on conflict (role_id, module, field_code)
    do update set
      can_view = excluded.can_view,
      can_edit = excluded.can_edit
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;


--
-- Name: upsert_permissions(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_permissions(payload jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  _count integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return 0;
  end if;

  with items as (
    select
      (value->>'code')::text as code,
      (value->>'name')::text as name,
      (value->>'module')::text as module,
      (value->>'action')::text as action,
      value->'roles' as roles
    from jsonb_array_elements(payload)
  ),
  upserted as (
    insert into public.permissions (code, name, module, action)
    select code, coalesce(name, code), module, action
    from items
    where code is not null and code <> ''
    on conflict (code) do update set
      name = excluded.name,
      module = excluded.module,
      action = excluded.action
    returning id, code
  ),
  role_bind as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from items i
    join public.permissions p on p.code = i.code
    join public.roles r on i.roles is not null and r.code = any (select jsonb_array_elements_text(i.roles))
    on conflict do nothing
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;


--
-- Name: url_encode(bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.url_encode(data bytea) RETURNS text
    LANGUAGE sql
    AS $$
    -- replace(..., E'\n', '') 用来删除换行符
    SELECT translate(replace(encode(data, 'base64'), E'\n', ''), '+/=', '-_')
$$;


--
-- Name: create_purchase_demands_from_sales_bom(integer, date, text); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.create_purchase_demands_from_sales_bom(p_product_material_id integer DEFAULT NULL::integer, p_required_date date DEFAULT NULL::date, p_requester_name text DEFAULT 'BOM-MRP'::text) RETURNS TABLE(result_demand_no text, result_material_no text, result_material_name text, result_quantity numeric, result_unit text, result_demand_status text, result_source_dept text, result_remark text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'scm', 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH shortages AS (
    SELECT
      r.component_material_id,
      r.component_material_code,
      r.component_material_name,
      MAX(r.unit) AS unit,
      SUM(r.shortage_qty)::NUMERIC(14, 2) AS shortage_qty,
      MIN(r.earliest_delivery_date) AS earliest_delivery_date,
      STRING_AGG(DISTINCT r.product_material_code, ', ' ORDER BY r.product_material_code) AS product_codes,
      STRING_AGG(DISTINCT r.source_order_nos, '; ' ORDER BY r.source_order_nos) AS source_order_nos,
      MAX(r.preferred_supplier) AS preferred_supplier
    FROM scm.v_sales_bom_mrp r
    WHERE r.shortage_qty > 0
      AND (p_product_material_id IS NULL OR r.product_material_id = p_product_material_id)
    GROUP BY r.component_material_id, r.component_material_code, r.component_material_name
  ),
  upserted AS (
    INSERT INTO public.purchase_demands (
      demand_no,
      material_no,
      material_name,
      quantity,
      unit,
      required_date,
      source_dept,
      requester_name,
      preferred_supplier,
      demand_status,
      remark,
      properties
    )
    SELECT
      CONCAT(
        'PR-BOM-',
        TO_CHAR(CURRENT_DATE, 'YYYYMMDD'),
        '-',
        REGEXP_REPLACE(s.component_material_code, '[^A-Za-z0-9]', '', 'g')
      ) AS demand_no,
      s.component_material_code,
      s.component_material_name,
      s.shortage_qty,
      s.unit,
      COALESCE(p_required_date, s.earliest_delivery_date, CURRENT_DATE + 7),
      'PMC',
      COALESCE(NULLIF(p_requester_name, ''), 'BOM-MRP'),
      s.preferred_supplier,
      '待采购',
      CONCAT('由销售订单BOM缺料自动生成；成品：', s.product_codes, '；订单：', s.source_order_nos),
      jsonb_build_object(
        'source', 'sales_bom_mrp',
        'component_material_id', s.component_material_id,
        'source_product_codes', s.product_codes,
        'source_order_nos', s.source_order_nos
      )
    FROM shortages s
    ON CONFLICT ON CONSTRAINT purchase_demands_demand_no_key DO UPDATE
    SET material_no = EXCLUDED.material_no,
        material_name = EXCLUDED.material_name,
        quantity = EXCLUDED.quantity,
        unit = EXCLUDED.unit,
        required_date = EXCLUDED.required_date,
        source_dept = EXCLUDED.source_dept,
        requester_name = EXCLUDED.requester_name,
        preferred_supplier = EXCLUDED.preferred_supplier,
        demand_status = CASE
          WHEN public.purchase_demands.demand_status IN ('已下单', '已关闭') THEN public.purchase_demands.demand_status
          ELSE EXCLUDED.demand_status
        END,
        remark = EXCLUDED.remark,
        properties = COALESCE(public.purchase_demands.properties, '{}'::jsonb) || EXCLUDED.properties,
        updated_at = NOW()
    RETURNING
      public.purchase_demands.demand_no,
      public.purchase_demands.material_no,
      public.purchase_demands.material_name,
      public.purchase_demands.quantity,
      public.purchase_demands.unit,
      public.purchase_demands.demand_status,
      public.purchase_demands.source_dept,
      public.purchase_demands.remark
  )
  SELECT * FROM upserted
  ORDER BY material_no;
END;
$$;


--
-- Name: FUNCTION create_purchase_demands_from_sales_bom(p_product_material_id integer, p_required_date date, p_requester_name text); Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON FUNCTION scm.create_purchase_demands_from_sales_bom(p_product_material_id integer, p_required_date date, p_requester_name text) IS '根据销售BOM缺料分析生成或更新采购需求';


--
-- Name: create_work_orders_from_sales_bom(text); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.create_work_orders_from_sales_bom(p_created_by text DEFAULT 'BOM-MRP'::text) RETURNS TABLE(result_work_order_no text, result_product_material_code text, result_product_material_name text, result_planned_qty numeric, result_unit text, result_work_order_status text, result_item_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'scm', 'public'
    AS $$
DECLARE
  v_plan RECORD;
  v_order scm.production_work_orders%ROWTYPE;
  v_item_count INTEGER;
BEGIN
  FOR v_plan IN
    SELECT *
    FROM scm.v_sales_bom_production_plan p
    WHERE p.planned_qty > 0
    ORDER BY p.product_material_code
  LOOP
    INSERT INTO scm.production_work_orders (
      work_order_no,
      source_type,
      source_order_nos,
      product_material_id,
      product_material_code,
      product_material_name,
      bom_id,
      bom_no,
      bom_version,
      planned_qty,
      unit,
      planned_start_date,
      planned_finish_date,
      work_order_status,
      priority,
      remark,
      properties,
      created_by
    )
    VALUES (
      CONCAT('WO-BOM-', TO_CHAR(CURRENT_DATE, 'YYYYMMDD'), '-', v_plan.product_material_code),
      'sales_bom_mrp',
      v_plan.source_order_nos,
      v_plan.product_material_id,
      v_plan.product_material_code,
      v_plan.product_material_name,
      v_plan.bom_id,
      v_plan.bom_no,
      v_plan.bom_version,
      v_plan.planned_qty,
      v_plan.unit,
      CURRENT_DATE,
      COALESCE(v_plan.earliest_delivery_date, CURRENT_DATE + 7),
      '待排产',
      CASE WHEN v_plan.earliest_delivery_date IS NOT NULL AND v_plan.earliest_delivery_date <= CURRENT_DATE + 3 THEN '高' ELSE '普通' END,
      CONCAT('由销售订单BOM需求生成；订单：', v_plan.source_order_nos),
      jsonb_build_object(
        'source', 'sales_bom_mrp',
        'source_order_nos', v_plan.source_order_nos,
        'sales_qty', v_plan.sales_qty,
        'finished_available_qty', v_plan.finished_available_qty
      ),
      COALESCE(NULLIF(p_created_by, ''), 'BOM-MRP')
    )
    ON CONFLICT (work_order_no) DO UPDATE
    SET source_order_nos = EXCLUDED.source_order_nos,
        product_material_id = EXCLUDED.product_material_id,
        product_material_code = EXCLUDED.product_material_code,
        product_material_name = EXCLUDED.product_material_name,
        bom_id = EXCLUDED.bom_id,
        bom_no = EXCLUDED.bom_no,
        bom_version = EXCLUDED.bom_version,
        planned_qty = EXCLUDED.planned_qty,
        unit = EXCLUDED.unit,
        planned_finish_date = EXCLUDED.planned_finish_date,
        priority = EXCLUDED.priority,
        remark = EXCLUDED.remark,
        properties = COALESCE(scm.production_work_orders.properties, '{}'::jsonb) || EXCLUDED.properties,
        updated_at = NOW()
    RETURNING * INTO v_order;

    DELETE FROM scm.production_work_order_items i
    WHERE i.work_order_id = v_order.id;

    INSERT INTO scm.production_work_order_items (
      work_order_id,
      line_no,
      component_material_id,
      component_material_code,
      component_material_name,
      required_qty,
      unit,
      issued_qty,
      shortage_qty,
      issue_status,
      remark,
      properties
    )
    SELECT
      v_order.id,
      ROW_NUMBER() OVER (ORDER BY e.component_material_code)::INTEGER * 10,
      e.component_material_id,
      e.component_material_code,
      e.component_material_name,
      e.required_qty,
      e.unit,
      0,
      GREATEST(e.required_qty - COALESCE(inv.available_qty, 0), 0)::NUMERIC(18, 6),
      CASE
        WHEN GREATEST(e.required_qty - COALESCE(inv.available_qty, 0), 0) > 0 THEN '部分领料'
        ELSE '已齐套'
      END,
      CASE
        WHEN GREATEST(e.required_qty - COALESCE(inv.available_qty, 0), 0) > 0 THEN '库存不足，需采购或补料'
        ELSE '库存满足'
      END,
      jsonb_build_object('available_qty', COALESCE(inv.available_qty, 0), 'source', 'bom_explosion')
    FROM scm.explode_bom(v_order.product_material_id, v_order.planned_qty, v_order.bom_version) e
    LEFT JOIN LATERAL (
      SELECT SUM(available_qty)::NUMERIC(18, 6) AS available_qty
      FROM scm.v_inventory_current current_inv
      WHERE current_inv.material_id = e.component_material_id
    ) inv ON true;

    SELECT COUNT(*)
    INTO v_item_count
    FROM scm.production_work_order_items i
    WHERE i.work_order_id = v_order.id;

    result_work_order_no := v_order.work_order_no;
    result_product_material_code := v_order.product_material_code;
    result_product_material_name := v_order.product_material_name;
    result_planned_qty := v_order.planned_qty;
    result_unit := v_order.unit;
    result_work_order_status := v_order.work_order_status;
    result_item_count := COALESCE(v_item_count, 0);
    RETURN NEXT;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION create_work_orders_from_sales_bom(p_created_by text); Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON FUNCTION scm.create_work_orders_from_sales_bom(p_created_by text) IS '根据销售BOM生产计划生成或更新生产工单及工单用料';


--
-- Name: explode_bom(integer, numeric, text); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.explode_bom(p_parent_material_id integer, p_qty numeric DEFAULT 1, p_version text DEFAULT NULL::text) RETURNS TABLE(root_bom_id uuid, root_bom_no text, root_material_id integer, root_material_code text, root_material_name text, component_material_id integer, component_material_code text, component_material_name text, unit text, required_qty numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'scm', 'public'
    AS $$
    SELECT
        e.root_bom_id,
        e.root_bom_no,
        e.root_material_id,
        e.root_material_code,
        e.root_material_name,
        e.component_material_id,
        e.component_material_code,
        e.component_material_name,
        MAX(e.unit) AS unit,
        SUM(e.required_qty * COALESCE(p_qty, 1))::NUMERIC(18, 6) AS required_qty
    FROM scm.v_bom_explosion e
    JOIN scm.boms b ON b.id = e.root_bom_id
    WHERE e.root_material_id = p_parent_material_id
      AND (p_version IS NULL OR b.version = p_version)
    GROUP BY
        e.root_bom_id,
        e.root_bom_no,
        e.root_material_id,
        e.root_material_code,
        e.root_material_name,
        e.component_material_id,
        e.component_material_code,
        e.component_material_name
    ORDER BY component_material_code;
$$;


--
-- Name: FUNCTION explode_bom(p_parent_material_id integer, p_qty numeric, p_version text); Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON FUNCTION scm.explode_bom(p_parent_material_id integer, p_qty numeric, p_version text) IS '按父项物料和生产数量展开启用BOM，聚合子件需求量';


--
-- Name: generate_batch_no(uuid, integer, text); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.generate_batch_no(p_rule_id uuid, p_material_id integer, p_manual_override text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'scm', 'public'
    AS $$
DECLARE
    v_rule RECORD;
    v_material RECORD;
    v_template TEXT;
    v_result TEXT;
    v_seq INTEGER;
    v_date_str TEXT;
BEGIN
    -- If manual override provided, validate uniqueness then return it
    IF p_manual_override IS NOT NULL AND p_manual_override != '' THEN
        IF EXISTS (SELECT 1 FROM scm.inventory_batches WHERE batch_no = p_manual_override) THEN
            RAISE EXCEPTION 'BATCH_EXISTS: %', p_manual_override;
        END IF;
        RETURN p_manual_override;
    END IF;

    -- Load rule (status check omitted to avoid encoding issues)
    SELECT * INTO v_rule
    FROM scm.batch_no_rules
    WHERE id = p_rule_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RULE_NOT_FOUND';
    END IF;

    -- Load material
    SELECT * INTO v_material FROM public.raw_materials WHERE id = p_material_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MATERIAL_NOT_FOUND';
    END IF;

    v_template := v_rule.rule_template;

    -- Replace placeholders
    v_template := REPLACE(v_template, U&'{\7269\6599\7F16\7801}', COALESCE(v_material.batch_no, 'MAT'));
    v_template := REPLACE(v_template, U&'{\7269\6599\5206\7C7B}', COALESCE(v_material.category, 'CAT'));
    v_template := REPLACE(v_template, U&'{\5206\7C7B}', COALESCE(v_material.category, 'CAT'));
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    v_template := REPLACE(v_template, U&'{\65E5\671F:YYYYMMDD}', v_date_str);

    -- Sequence
    v_seq := EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000;
    v_template := REPLACE(v_template, U&'{\5E8F\53F7:3}', LPAD(v_seq::TEXT, 3, '0'));

    v_result := v_template;

    -- Simple uniqueness check
    IF EXISTS (SELECT 1 FROM scm.inventory_batches WHERE batch_no = v_result) THEN
        v_result := v_result || '-' || LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
    END IF;

    RETURN v_result;
END;
$$;


--
-- Name: FUNCTION generate_batch_no(p_rule_id uuid, p_material_id integer, p_manual_override text); Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON FUNCTION scm.generate_batch_no(p_rule_id uuid, p_material_id integer, p_manual_override text) IS '?????-???????????';


--
-- Name: stock_adjust(integer, uuid, text, numeric, text, text, text); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.stock_adjust(p_material_id integer, p_warehouse_id uuid, p_batch_no text, p_adjust_qty numeric, p_unit text, p_remark text, p_operator text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_batch_id UUID;
    v_transaction_no TEXT;
    v_before_qty NUMERIC;
    v_after_qty NUMERIC;
BEGIN
    v_transaction_no := 'ADJ' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
    
    SELECT id, available_qty INTO v_batch_id, v_before_qty
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;
    
    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION '?????';
    END IF;
    
    -- ????
    UPDATE scm.inventory_batches
    SET available_qty = available_qty + p_adjust_qty,
        updated_at = NOW()
    WHERE id = v_batch_id
    RETURNING available_qty INTO v_after_qty;
    
    IF v_after_qty < 0 THEN
        RAISE EXCEPTION '??????????';
    END IF;
    
    -- ????
    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, before_qty, after_qty, operator, remark,
        approval_status, created_by
    ) VALUES (
        v_transaction_no, '??', p_material_id, v_batch_id, p_batch_no,
        p_warehouse_id, p_adjust_qty, p_unit, v_before_qty, v_after_qty, p_operator, p_remark,
        '???', p_operator
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_no', v_transaction_no,
        'before_qty', v_before_qty,
        'after_qty', v_after_qty
    );
END;
$$;


--
-- Name: stock_in(integer, uuid, numeric, text, text, text, text, date, text, text); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.stock_in(p_material_id integer, p_warehouse_id uuid, p_quantity numeric, p_unit text, p_batch_no text, p_transaction_no text DEFAULT NULL::text, p_operator text DEFAULT NULL::text, p_production_date date DEFAULT NULL::date, p_remark text DEFAULT NULL::text, p_io_type text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'scm', 'public'
    AS $$
DECLARE
    v_batch_id UUID;
    v_transaction_no TEXT;
    v_after_qty NUMERIC;
BEGIN
    v_transaction_no := COALESCE(p_transaction_no, 'IN' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));

    SELECT id INTO v_batch_id
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF v_batch_id IS NULL THEN
        INSERT INTO scm.inventory_batches (
            material_id, batch_no, warehouse_id, available_qty, unit,
            production_date, status, created_by
        ) VALUES (
            p_material_id, p_batch_no, p_warehouse_id, p_quantity, p_unit,
            p_production_date, U&'\6B63\5E38', p_operator
        )
        RETURNING id, available_qty INTO v_batch_id, v_after_qty;
    ELSE
        UPDATE scm.inventory_batches
        SET available_qty = available_qty + p_quantity,
            updated_at = NOW()
        WHERE id = v_batch_id
        RETURNING available_qty INTO v_after_qty;
    END IF;

    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, io_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, after_qty, operator, remark, created_by
    ) VALUES (
        v_transaction_no, U&'\5165\5E93', NULLIF(BTRIM(COALESCE(p_io_type, '')), ''), p_material_id, v_batch_id, p_batch_no,
        p_warehouse_id, p_quantity, p_unit, v_after_qty, p_operator, p_remark, p_operator
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_no', v_transaction_no,
        'batch_id', v_batch_id,
        'after_qty', v_after_qty
    );
END;
$$;


--
-- Name: stock_out(integer, uuid, numeric, text, text, text, text, text, text); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.stock_out(p_material_id integer, p_warehouse_id uuid, p_quantity numeric, p_unit text, p_batch_no text, p_transaction_no text DEFAULT NULL::text, p_operator text DEFAULT NULL::text, p_remark text DEFAULT NULL::text, p_io_type text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'scm', 'public'
    AS $$
DECLARE
    v_batch_id UUID;
    v_available_qty NUMERIC;
    v_transaction_no TEXT;
    v_after_qty NUMERIC;
BEGIN
    v_transaction_no := COALESCE(p_transaction_no, 'OUT' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));

    SELECT id, available_qty INTO v_batch_id, v_available_qty
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION 'BATCH_NOT_FOUND: %', p_batch_no;
    END IF;

    IF v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_QTY: need %, available %', p_quantity, v_available_qty;
    END IF;

    UPDATE scm.inventory_batches
    SET available_qty = available_qty - p_quantity,
        updated_at = NOW()
    WHERE id = v_batch_id
    RETURNING available_qty INTO v_after_qty;

    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, io_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, before_qty, after_qty, operator, remark, created_by
    ) VALUES (
        v_transaction_no, U&'\51FA\5E93', NULLIF(BTRIM(COALESCE(p_io_type, '')), ''), p_material_id, v_batch_id, p_batch_no,
        p_warehouse_id, -p_quantity, p_unit, v_available_qty, v_after_qty, p_operator, p_remark, p_operator
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_no', v_transaction_no,
        'batch_id', v_batch_id,
        'after_qty', v_after_qty
    );
END;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: validate_bom_item(); Type: FUNCTION; Schema: scm; Owner: -
--

CREATE FUNCTION scm.validate_bom_item() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_parent_material_id INTEGER;
BEGIN
    SELECT parent_material_id
    INTO v_parent_material_id
    FROM scm.boms
    WHERE id = NEW.bom_id;

    IF v_parent_material_id IS NULL THEN
        RAISE EXCEPTION 'BOM does not exist: %', NEW.bom_id;
    END IF;

    IF NEW.component_material_id = v_parent_material_id THEN
        RAISE EXCEPTION 'BOM component cannot be the same as parent material';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: apply_mapped_state_to_business(integer, text, text); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.apply_mapped_state_to_business(p_definition_id integer, p_task_id text, p_business_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $_$
DECLARE
    v_business_key TEXT := NULLIF(btrim(COALESCE(p_business_key, '')), '');
    v_target_table TEXT;
    v_state_field TEXT;
    v_state_value TEXT;
    v_schema_name TEXT;
    v_table_name TEXT;
    v_has_target_table BOOLEAN;
    v_has_state_field BOOLEAN;
    v_has_id_col BOOLEAN;
    v_has_business_key_col BOOLEAN;
    v_updated_count INT := 0;
BEGIN
    IF p_definition_id IS NULL OR p_task_id IS NULL OR btrim(p_task_id) = '' THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'missing_definition_or_task');
    END IF;

    SELECT
        NULLIF(btrim(m.target_table), ''),
        NULLIF(btrim(m.state_field), ''),
        NULLIF(btrim(m.state_value), '')
    INTO v_target_table, v_state_field, v_state_value
    FROM workflow.definitions d
    JOIN app_center.workflow_state_mappings m
      ON m.workflow_app_id = d.app_id
     AND m.bpmn_task_id = p_task_id
    WHERE d.id = p_definition_id
    ORDER BY m.id DESC
    LIMIT 1;

    IF v_target_table IS NULL THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'mapping_not_found');
    END IF;

    IF v_state_field IS NULL OR v_state_value IS NULL THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'mapping_incomplete', 'target_table', v_target_table);
    END IF;

    IF strpos(v_target_table, '.') > 0 THEN
        v_schema_name := split_part(v_target_table, '.', 1);
        v_table_name := split_part(v_target_table, '.', 2);
    ELSE
        v_schema_name := 'public';
        v_table_name := v_target_table;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables t
        WHERE t.table_schema = v_schema_name
          AND t.table_name = v_table_name
    ) INTO v_has_target_table;

    IF NOT v_has_target_table THEN
        RETURN jsonb_build_object(
            'applied', false,
            'reason', 'target_table_not_found',
            'target_table', format('%I.%I', v_schema_name, v_table_name)
        );
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = v_schema_name
          AND c.table_name = v_table_name
          AND c.column_name = v_state_field
    ) INTO v_has_state_field;

    IF NOT v_has_state_field THEN
        RETURN jsonb_build_object(
            'applied', false,
            'reason', 'state_field_not_found',
            'target_table', format('%I.%I', v_schema_name, v_table_name),
            'state_field', v_state_field
        );
    END IF;

    IF v_business_key IS NULL THEN
        RETURN jsonb_build_object(
            'applied', false,
            'reason', 'business_key_empty',
            'target_table', format('%I.%I', v_schema_name, v_table_name),
            'state_field', v_state_field,
            'state_value', v_state_value
        );
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = v_schema_name
          AND c.table_name = v_table_name
          AND c.column_name = 'id'
    ) INTO v_has_id_col;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = v_schema_name
          AND c.table_name = v_table_name
          AND c.column_name = 'business_key'
    ) INTO v_has_business_key_col;

    IF v_has_id_col THEN
        EXECUTE format(
            'UPDATE %I.%I SET %I = $1 WHERE id::text = $2',
            v_schema_name,
            v_table_name,
            v_state_field
        )
        USING v_state_value, v_business_key;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSIF v_has_business_key_col THEN
        EXECUTE format(
            'UPDATE %I.%I SET %I = $1 WHERE business_key::text = $2',
            v_schema_name,
            v_table_name,
            v_state_field
        )
        USING v_state_value, v_business_key;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSE
        RETURN jsonb_build_object(
            'applied', false,
            'reason', 'unsupported_key_column',
            'target_table', format('%I.%I', v_schema_name, v_table_name),
            'state_field', v_state_field,
            'state_value', v_state_value
        );
    END IF;

    RETURN jsonb_build_object(
        'applied', v_updated_count > 0,
        'updated_rows', v_updated_count,
        'target_table', format('%I.%I', v_schema_name, v_table_name),
        'state_field', v_state_field,
        'state_value', v_state_value,
        'business_key', v_business_key
    );
END;
$_$;


--
-- Name: can_execute_smart_bi_action_instance(integer); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.can_execute_smart_bi_action_instance(p_instance_id integer) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $_$
DECLARE
    v_claims JSONB := workflow.current_claims();
    v_actor_username TEXT := NULLIF(btrim(v_claims ->> 'username'), '');
    v_actor_role TEXT := NULLIF(btrim(v_claims ->> 'app_role'), '');
    v_action_id_text TEXT;
    v_action public.smart_bi_action_items%ROWTYPE;
BEGIN
    IF p_instance_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT COALESCE(
        i.variables ->> 'smart_bi_action_item_id',
        i.variables #>> '{smart_bi_action,action_item_id}',
        i.business_key
    )
    INTO v_action_id_text
    FROM workflow.instances i
    WHERE i.id = p_instance_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    SELECT ai.*
      INTO v_action
      FROM public.smart_bi_action_items ai
     WHERE ai.workflow_instance_id = p_instance_id
        OR ai.id = CASE
            WHEN COALESCE(v_action_id_text, '') ~ '^[0-9]+$' THEN v_action_id_text::INT
            ELSE NULL
        END
     ORDER BY CASE WHEN ai.workflow_instance_id = p_instance_id THEN 0 ELSE 1 END,
              ai.id DESC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN true;
    END IF;

    IF v_actor_role = 'super_admin' THEN
        RETURN true;
    END IF;

    IF NULLIF(btrim(COALESCE(v_action.owner_username, '')), '') IS NOT NULL THEN
        RETURN v_actor_username IS NOT NULL
           AND lower(v_actor_username) = lower(btrim(v_action.owner_username));
    END IF;

    IF NULLIF(btrim(COALESCE(v_action.owner_role, '')), '') IS NOT NULL THEN
        RETURN v_actor_role IS NOT NULL
           AND v_actor_role = btrim(v_action.owner_role);
    END IF;

    RETURN true;
END;
$_$;


--
-- Name: can_execute_task(integer, text); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.can_execute_task(p_definition_id integer, p_task_id text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $$
DECLARE
    v_claims jsonb := workflow.current_claims();
    v_role TEXT := COALESCE(v_claims ->> 'app_role', '');
    v_username TEXT := COALESCE(v_claims ->> 'username', '');
    v_has_assignment BOOLEAN := false;
BEGIN
    IF p_task_id IS NULL OR btrim(p_task_id) = '' THEN
        RETURN true;
    END IF;

    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM workflow.task_assignments ta
        WHERE ta.definition_id = p_definition_id
          AND ta.task_id = p_task_id
    ) INTO v_has_assignment;

    IF NOT v_has_assignment THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM workflow.task_assignments ta
        WHERE ta.definition_id = p_definition_id
          AND ta.task_id = p_task_id
          AND (
              COALESCE(array_length(ta.candidate_roles, 1), 0) = 0
              OR v_role = ANY(ta.candidate_roles)
          )
          AND (
              COALESCE(array_length(ta.candidate_users, 1), 0) = 0
              OR v_username = ANY(ta.candidate_users)
          )
    );
END;
$$;


--
-- Name: current_claims(); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.current_claims() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;


--
-- Name: check_state_transition_permission(integer, text, text, text, jsonb, boolean); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.check_state_transition_permission(p_definition_id integer, p_app_key text, p_from_task_id text, p_to_task_id text, p_claims jsonb DEFAULT workflow.current_claims(), p_allow_edit_fallback boolean DEFAULT true) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_from_state TEXT;
    v_to_state TEXT;
    v_code TEXT;
BEGIN
    IF p_app_key IS NULL OR btrim(p_app_key) = '' THEN
        RETURN true;
    END IF;

    v_from_state := workflow.resolve_mapped_state_value(p_definition_id, p_from_task_id);
    v_to_state := workflow.resolve_mapped_state_value(p_definition_id, p_to_task_id);

    IF v_from_state IS NULL OR v_to_state IS NULL OR v_from_state = v_to_state THEN
        RETURN true;
    END IF;

    v_code := format(
        'op:%s.status_transition.%s_%s',
        p_app_key,
        workflow.normalize_status_token(v_from_state),
        workflow.normalize_status_token(v_to_state)
    );

    IF workflow.claim_has_permission(p_claims, v_code) THEN
        RETURN true;
    END IF;

    IF p_allow_edit_fallback
       AND workflow.claim_has_permission(p_claims, format('op:%s.edit', p_app_key)) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;


--
-- Name: claim_has_any_permission(jsonb, text[]); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.claim_has_any_permission(p_claims jsonb, p_codes text[]) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF p_codes IS NULL OR COALESCE(array_length(p_codes, 1), 0) = 0 THEN
        RETURN true;
    END IF;

    FOREACH v_code IN ARRAY p_codes LOOP
        IF workflow.claim_has_permission(p_claims, v_code) THEN
            RETURN true;
        END IF;
    END LOOP;

    RETURN false;
END;
$$;


--
-- Name: claim_has_permission(jsonb, text); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.claim_has_permission(p_claims jsonb, p_code text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_role TEXT := COALESCE(p_claims ->> 'app_role', p_claims ->> 'role', '');
BEGIN
    IF p_code IS NULL OR btrim(p_code) = '' THEN
        RETURN true;
    END IF;

    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    RETURN p_code = ANY(workflow.claim_permissions(p_claims));
END;
$$;


--
-- Name: claim_permissions(jsonb); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.claim_permissions(p_claims jsonb DEFAULT workflow.current_claims()) RETURNS text[]
    LANGUAGE sql STABLE
    AS $$
    SELECT COALESCE(
        ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(p_claims -> 'permissions', '[]'::jsonb))
        ),
        ARRAY[]::text[]
    );
$$;


--
-- Name: normalize_status_token(text); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.normalize_status_token(p_value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT NULLIF(
        trim(BOTH '_' FROM regexp_replace(lower(COALESCE(p_value, '')), '[^a-z0-9]+', '_', 'g')),
        ''
    );
$$;


--
-- Name: notify_instance_change(); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.notify_instance_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pg_notify('workflow_event', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$;


--
-- Name: notify_instance_update(); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.notify_instance_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM pg_notify('workflow_update', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: instances; Type: TABLE; Schema: workflow; Owner: -
--

CREATE TABLE workflow.instances (
    id integer NOT NULL,
    definition_id integer,
    business_key text,
    current_task_id text,
    status text DEFAULT 'ACTIVE'::text,
    variables jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone
);


--
-- Name: reject_smart_bi_action_workflow(integer, text, jsonb); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.reject_smart_bi_action_workflow(p_instance_id integer, p_comment text DEFAULT NULL::text, p_variables jsonb DEFAULT '{}'::jsonb) RETURNS workflow.instances
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $$
BEGIN
    IF NOT workflow.can_execute_smart_bi_action_instance(p_instance_id) THEN
        RAISE EXCEPTION 'smart BI action is not assigned to current actor'
            USING ERRCODE = '42501';
    END IF;

    RETURN workflow.reject_workflow_task(
        p_instance_id,
        p_comment,
        p_variables
    );
END;
$$;


--
-- Name: reject_workflow_task(integer, text, jsonb); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.reject_workflow_task(p_instance_id integer, p_comment text DEFAULT NULL::text, p_variables jsonb DEFAULT '{}'::jsonb) RETURNS workflow.instances
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $$
DECLARE
    v_claims jsonb := workflow.current_claims();
    v_actor TEXT := NULLIF(btrim(v_claims ->> 'username'), '');
    v_actor_role TEXT := NULLIF(btrim(v_claims ->> 'app_role'), '');
    v_actor_key TEXT := COALESCE(NULLIF(btrim(v_claims ->> 'username'), ''), '__unknown__');
    v_current workflow.instances%ROWTYPE;
    v_updated workflow.instances%ROWTYPE;
    v_from_task TEXT;
    v_app_key TEXT;
    v_comment TEXT := NULLIF(
        btrim(
            COALESCE(
                p_comment,
                p_variables ->> 'approval_comment',
                p_variables ->> 'comment',
                p_variables ->> 'opinion',
                ''
            )
        ),
        ''
    );
    v_payload JSONB := COALESCE(p_variables, '{}'::jsonb);
    v_require_comment BOOLEAN := false;
    v_event_id INT;
BEGIN
    IF p_instance_id IS NULL THEN
        RAISE EXCEPTION 'instance_id is required' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_current
    FROM workflow.instances i
    WHERE i.id = p_instance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'workflow instance % not found', p_instance_id USING ERRCODE = 'P0002';
    END IF;

    IF COALESCE(v_current.status, 'ACTIVE') = 'COMPLETED' THEN
        RAISE EXCEPTION 'workflow instance already completed' USING ERRCODE = 'P0001';
    END IF;

    IF NOT workflow.can_execute_task(v_current.definition_id, v_current.current_task_id) THEN
        RAISE EXCEPTION 'current task is not assigned to current actor' USING ERRCODE = '42501';
    END IF;

    v_from_task := v_current.current_task_id;
    v_app_key := workflow.resolve_app_acl_key(v_current.definition_id);

    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' THEN
        IF NOT workflow.claim_has_any_permission(
            v_claims,
            ARRAY[
                format('op:%s.workflow_transition', v_app_key),
                format('op:%s.workflow_complete', v_app_key),
                format('op:%s.edit', v_app_key)
            ]
        ) THEN
            RAISE EXCEPTION 'workflow transition permission required'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT COALESCE(ta.require_comment, false)
    INTO v_require_comment
    FROM workflow.task_assignments ta
    WHERE ta.definition_id = v_current.definition_id
      AND ta.task_id = v_from_task
    ORDER BY ta.id DESC
    LIMIT 1;

    IF COALESCE(v_require_comment, false) AND v_comment IS NULL THEN
        RAISE EXCEPTION 'approval comment required' USING ERRCODE = '22023';
    END IF;

    IF v_from_task IS NOT NULL AND btrim(v_from_task) <> '' THEN
        INSERT INTO workflow.task_approvals (
            instance_id,
            definition_id,
            task_id,
            actor_username,
            actor_role,
            decision,
            comment,
            payload,
            created_at,
            updated_at
        )
        VALUES (
            v_current.id,
            v_current.definition_id,
            v_from_task,
            v_actor_key,
            v_actor_role,
            'rejected',
            v_comment,
            v_payload,
            NOW(),
            NOW()
        )
        ON CONFLICT (instance_id, task_id, actor_username) DO UPDATE
        SET actor_role = EXCLUDED.actor_role,
            decision = EXCLUDED.decision,
            comment = EXCLUDED.comment,
            payload = EXCLUDED.payload,
            updated_at = NOW();
    END IF;

    UPDATE workflow.instances
    SET current_task_id = NULL,
        status = 'COMPLETED',
        ended_at = COALESCE(ended_at, NOW()),
        variables = COALESCE(variables, '{}'::jsonb) || v_payload || jsonb_build_object('rejected', true)
    WHERE id = p_instance_id
    RETURNING * INTO v_updated;

    INSERT INTO workflow.instance_events (
        instance_id,
        definition_id,
        event_type,
        from_task_id,
        to_task_id,
        actor_username,
        actor_role,
        payload
    )
    VALUES (
        v_updated.id,
        v_updated.definition_id,
        'TASK_REJECTED',
        v_from_task,
        NULL,
        v_actor,
        v_actor_role,
        jsonb_build_object(
            'approval', jsonb_build_object(
                'decision', 'rejected',
                'comment', COALESCE(v_comment, '')
            )
        ) || v_payload
    )
    RETURNING id INTO v_event_id;

    UPDATE workflow.instance_events
    SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
        'state_apply',
        jsonb_build_object('applied', false, 'reason', 'workflow_rejected')
    )
    WHERE id = v_event_id;

    RETURN v_updated;
END;
$$;


--
-- Name: resolve_app_acl_key(integer); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.resolve_app_acl_key(p_definition_id integer) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    SELECT
        COALESCE(
            NULLIF(a.config ->> 'aclModule', ''),
            CASE
                WHEN a.id IS NOT NULL THEN 'app_' || replace(a.id::text, '-', '')
                ELSE NULL
            END
        ) AS app_key
    FROM workflow.definitions d
    LEFT JOIN app_center.apps a ON a.id = d.app_id
    WHERE d.id = p_definition_id
    LIMIT 1;
$$;


--
-- Name: resolve_mapped_state_value(integer, text); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.resolve_mapped_state_value(p_definition_id integer, p_task_id text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    SELECT NULLIF(btrim(m.state_value), '')
    FROM workflow.definitions d
    JOIN app_center.workflow_state_mappings m
      ON m.workflow_app_id = d.app_id
     AND m.bpmn_task_id = p_task_id
    WHERE d.id = p_definition_id
    LIMIT 1;
$$;


--
-- Name: resolve_transition_rule(integer, text, text, text); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.resolve_transition_rule(p_definition_id integer, p_from_task_id text, p_to_task_id text, p_app_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_workflow_app_id UUID;
    v_from_state TEXT;
    v_to_state TEXT;
    v_rule app_center.workflow_transition_rules%ROWTYPE;
    v_rule_found BOOLEAN := false;
    v_required_permission TEXT;
BEGIN
    SELECT d.app_id
      INTO v_workflow_app_id
      FROM workflow.definitions d
     WHERE d.id = p_definition_id
     LIMIT 1;

    v_from_state := workflow.resolve_mapped_state_value(p_definition_id, p_from_task_id);
    v_to_state := workflow.resolve_mapped_state_value(p_definition_id, p_to_task_id);

    IF v_workflow_app_id IS NOT NULL THEN
        SELECT *
          INTO v_rule
          FROM app_center.workflow_transition_rules r
         WHERE r.workflow_app_id = v_workflow_app_id
           AND r.is_active = true
           AND (r.from_task_id IS NULL OR r.from_task_id = p_from_task_id)
           AND (r.to_task_id IS NULL OR r.to_task_id = p_to_task_id)
           AND (
                r.from_state IS NULL
                OR v_from_state IS NULL
                OR workflow.normalize_status_token(r.from_state) = workflow.normalize_status_token(v_from_state)
           )
           AND (
                r.to_state IS NULL
                OR v_to_state IS NULL
                OR workflow.normalize_status_token(r.to_state) = workflow.normalize_status_token(v_to_state)
           )
         ORDER BY
           (CASE WHEN r.from_task_id IS NULL THEN 0 ELSE 1 END
            + CASE WHEN r.to_task_id IS NULL THEN 0 ELSE 1 END
            + CASE WHEN r.from_state IS NULL THEN 0 ELSE 1 END
            + CASE WHEN r.to_state IS NULL THEN 0 ELSE 1 END) DESC,
           r.id DESC
         LIMIT 1;
        v_rule_found := FOUND;
    END IF;

    IF v_rule_found THEN
        v_from_state := COALESCE(NULLIF(TRIM(v_rule.from_state), ''), v_from_state);
        v_to_state := COALESCE(NULLIF(TRIM(v_rule.to_state), ''), v_to_state);
        v_required_permission := NULLIF(TRIM(v_rule.required_permission), '');
    END IF;

    IF v_required_permission IS NULL
       AND NULLIF(TRIM(COALESCE(p_app_key, '')), '') IS NOT NULL
       AND v_from_state IS NOT NULL
       AND v_to_state IS NOT NULL
       AND v_from_state <> v_to_state THEN
        v_required_permission := format(
            'op:%s.status_transition.%s_%s',
            p_app_key,
            workflow.normalize_status_token(v_from_state),
            workflow.normalize_status_token(v_to_state)
        );
    END IF;

    RETURN jsonb_build_object(
        'found', v_rule_found,
        'rule_id', CASE WHEN v_rule_found THEN v_rule.id ELSE NULL END,
        'workflow_app_id', COALESCE(v_workflow_app_id::text, ''),
        'from_task_id', COALESCE(NULLIF(TRIM(p_from_task_id), ''), ''),
        'to_task_id', COALESCE(NULLIF(TRIM(p_to_task_id), ''), ''),
        'from_state', COALESCE(v_from_state, ''),
        'to_state', COALESCE(v_to_state, ''),
        'required_permission', COALESCE(v_required_permission, '')
    );
END;
$$;


--
-- Name: resolve_workflow_permission_policy(integer, text); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.resolve_workflow_permission_policy(p_definition_id integer, p_app_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_policy JSONB;
BEGIN
    SELECT jsonb_build_object(
        'workflow_app_id', COALESCE(a.id::text, ''),
        'acl_module', COALESCE(
            NULLIF(TRIM(p.acl_module), ''),
            NULLIF(TRIM(a.config ->> 'aclModule'), ''),
            NULLIF(TRIM(p_app_key), ''),
            ''
        ),
        'permission_mode', CASE
            WHEN lower(COALESCE(NULLIF(TRIM(p.permission_mode), ''), NULLIF(TRIM(a.config ->> 'permission_mode'), ''), 'compat')) IN ('compat', 'strict')
                THEN lower(COALESCE(NULLIF(TRIM(p.permission_mode), ''), NULLIF(TRIM(a.config ->> 'permission_mode'), ''), 'compat'))
            ELSE 'compat'
        END,
        'enforce_assignment', COALESCE(p.enforce_assignment, true),
        'enforce_workflow_op_perm', COALESCE(p.enforce_workflow_op_perm, true),
        'enforce_status_transition_perm', COALESCE(p.enforce_status_transition_perm, true),
        'legacy_fallback_enabled', COALESCE(p.legacy_fallback_enabled, true),
        'source', CASE WHEN p.id IS NULL THEN 'default' ELSE 'policy' END
    )
    INTO v_policy
    FROM workflow.definitions d
    LEFT JOIN app_center.apps a ON a.id = d.app_id
    LEFT JOIN app_center.workflow_permission_policies p ON p.workflow_app_id = a.id
    WHERE d.id = p_definition_id
    LIMIT 1;

    RETURN COALESCE(
        v_policy,
        jsonb_build_object(
            'workflow_app_id', '',
            'acl_module', COALESCE(NULLIF(TRIM(p_app_key), ''), ''),
            'permission_mode', 'compat',
            'enforce_assignment', true,
            'enforce_workflow_op_perm', true,
            'enforce_status_transition_perm', true,
            'legacy_fallback_enabled', true,
            'source', 'default'
        )
    );
END;
$$;


--
-- Name: start_workflow_instance(integer, text, text, jsonb); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.start_workflow_instance(p_definition_id integer, p_business_key text DEFAULT NULL::text, p_initial_task_id text DEFAULT NULL::text, p_variables jsonb DEFAULT '{}'::jsonb) RETURNS workflow.instances
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $$
DECLARE
    v_claims jsonb := workflow.current_claims();
    v_actor TEXT := NULLIF(btrim(v_claims ->> 'username'), '');
    v_actor_role TEXT := NULLIF(btrim(v_claims ->> 'app_role'), '');
    v_initial_task_id TEXT := NULLIF(btrim(COALESCE(p_initial_task_id, '')), '');
    v_app_key TEXT;
    v_created workflow.instances%ROWTYPE;
    v_state_apply JSONB := '{}'::jsonb;
    v_event_id INT;
BEGIN
    IF p_definition_id IS NULL THEN
        RAISE EXCEPTION 'definition_id is required' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM workflow.definitions d WHERE d.id = p_definition_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'workflow definition % not found', p_definition_id USING ERRCODE = 'P0002';
    END IF;

    v_app_key := workflow.resolve_app_acl_key(p_definition_id);
    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' THEN
        IF NOT workflow.claim_has_any_permission(
            v_claims,
            ARRAY[
                format('op:%s.workflow_start', v_app_key),
                format('op:%s.create', v_app_key)
            ]
        ) THEN
            RAISE EXCEPTION 'workflow start permission required'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_initial_task_id IS NULL THEN
        SELECT ta.task_id
        INTO v_initial_task_id
        FROM workflow.task_assignments ta
        WHERE ta.definition_id = p_definition_id
        ORDER BY ta.id ASC
        LIMIT 1;
    END IF;

    INSERT INTO workflow.instances (
        definition_id,
        business_key,
        current_task_id,
        status,
        variables,
        started_at,
        ended_at
    )
    VALUES (
        p_definition_id,
        NULLIF(btrim(COALESCE(p_business_key, '')), ''),
        v_initial_task_id,
        'ACTIVE',
        COALESCE(p_variables, '{}'::jsonb),
        NOW(),
        NULL
    )
    RETURNING * INTO v_created;

    INSERT INTO workflow.instance_events (
        instance_id,
        definition_id,
        event_type,
        from_task_id,
        to_task_id,
        actor_username,
        actor_role,
        payload
    )
    VALUES (
        v_created.id,
        v_created.definition_id,
        'INSTANCE_STARTED',
        NULL,
        v_created.current_task_id,
        v_actor,
        v_actor_role,
        jsonb_build_object(
            'business_key', v_created.business_key,
            'variables', COALESCE(p_variables, '{}'::jsonb)
        )
    )
    RETURNING id INTO v_event_id;

    v_state_apply := workflow.apply_mapped_state_to_business(
        v_created.definition_id,
        v_created.current_task_id,
        v_created.business_key
    );

    UPDATE workflow.instance_events
    SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('state_apply', v_state_apply)
    WHERE id = v_event_id;

    RETURN v_created;
END;
$$;


--
-- Name: transition_smart_bi_action_workflow(integer, text, boolean, jsonb); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.transition_smart_bi_action_workflow(p_instance_id integer, p_next_task_id text DEFAULT NULL::text, p_complete boolean DEFAULT false, p_variables jsonb DEFAULT NULL::jsonb) RETURNS workflow.instances
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $$
BEGIN
    IF NOT workflow.can_execute_smart_bi_action_instance(p_instance_id) THEN
        RAISE EXCEPTION 'smart BI action is not assigned to current actor'
            USING ERRCODE = '42501';
    END IF;

    RETURN workflow.transition_workflow_instance(
        p_instance_id,
        p_next_task_id,
        p_complete,
        p_variables
    );
END;
$$;


--
-- Name: transition_workflow_instance(integer, text, boolean, jsonb); Type: FUNCTION; Schema: workflow; Owner: -
--

CREATE FUNCTION workflow.transition_workflow_instance(p_instance_id integer, p_next_task_id text DEFAULT NULL::text, p_complete boolean DEFAULT false, p_variables jsonb DEFAULT NULL::jsonb) RETURNS workflow.instances
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'workflow', 'public'
    AS $$
DECLARE
    v_claims jsonb := workflow.current_claims();
    v_actor TEXT := NULLIF(btrim(v_claims ->> 'username'), '');
    v_actor_role TEXT := NULLIF(btrim(v_claims ->> 'app_role'), '');
    v_actor_key TEXT := COALESCE(NULLIF(btrim(v_claims ->> 'username'), ''), '__unknown__');
    v_next_task_id TEXT := NULLIF(btrim(COALESCE(p_next_task_id, '')), '');
    v_complete BOOLEAN := COALESCE(p_complete, false);
    v_current workflow.instances%ROWTYPE;
    v_updated workflow.instances%ROWTYPE;
    v_from_task TEXT;
    v_app_key TEXT;
    v_required_perm TEXT;
    v_fallback_perm TEXT;
    v_from_state TEXT;
    v_to_state TEXT;
    v_state_apply JSONB := '{}'::jsonb;
    v_event_id INT;
    v_assignment workflow.task_assignments%ROWTYPE;
    v_approval_mode TEXT := 'any';
    v_required_approvals INT := 1;
    v_require_comment BOOLEAN := false;
    v_approval_comment TEXT := NULLIF(
        btrim(
            COALESCE(
                p_variables ->> 'approval_comment',
                p_variables ->> 'comment',
                p_variables ->> 'opinion',
                ''
            )
        ),
        ''
    );
    v_approval_count INT := 0;
    v_needs_quorum BOOLEAN := false;
    v_payload JSONB := COALESCE(p_variables, '{}'::jsonb);
BEGIN
    IF p_instance_id IS NULL THEN
        RAISE EXCEPTION 'instance_id is required' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_current
    FROM workflow.instances i
    WHERE i.id = p_instance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'workflow instance % not found', p_instance_id USING ERRCODE = 'P0002';
    END IF;

    IF COALESCE(v_current.status, 'ACTIVE') = 'COMPLETED' THEN
        RAISE EXCEPTION 'workflow instance already completed' USING ERRCODE = 'P0001';
    END IF;

    IF NOT workflow.can_execute_task(v_current.definition_id, v_current.current_task_id) THEN
        RAISE EXCEPTION 'current task is not assigned to current actor' USING ERRCODE = '42501';
    END IF;

    IF NOT v_complete AND v_next_task_id IS NULL THEN
        RAISE EXCEPTION 'next_task_id is required when complete is false' USING ERRCODE = '22023';
    END IF;

    v_from_task := v_current.current_task_id;
    v_app_key := workflow.resolve_app_acl_key(v_current.definition_id);

    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' THEN
        v_required_perm := format(
            'op:%s.%s',
            v_app_key,
            CASE WHEN v_complete THEN 'workflow_complete' ELSE 'workflow_transition' END
        );
        v_fallback_perm := format('op:%s.edit', v_app_key);

        IF NOT workflow.claim_has_any_permission(
            v_claims,
            ARRAY[v_required_perm, v_fallback_perm]
        ) THEN
            RAISE EXCEPTION 'workflow transition permission required'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_complete AND NOT workflow.check_state_transition_permission(
            v_current.definition_id,
            v_app_key,
            v_from_task,
            v_next_task_id,
            v_claims,
            true
        ) THEN
            v_from_state := workflow.resolve_mapped_state_value(v_current.definition_id, v_from_task);
            v_to_state := workflow.resolve_mapped_state_value(v_current.definition_id, v_next_task_id);
            RAISE EXCEPTION 'status transition permission required (% -> %)',
                COALESCE(v_from_state, '?'),
                COALESCE(v_to_state, '?')
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT *
    INTO v_assignment
    FROM workflow.task_assignments ta
    WHERE ta.definition_id = v_current.definition_id
      AND ta.task_id = v_from_task
    ORDER BY ta.id DESC
    LIMIT 1;

    IF FOUND THEN
        v_approval_mode := lower(COALESCE(NULLIF(btrim(v_assignment.approval_mode), ''), 'any'));
        IF v_approval_mode NOT IN ('any', 'quota', 'all') THEN
            v_approval_mode := 'any';
        END IF;
        v_require_comment := COALESCE(v_assignment.require_comment, false);
        v_required_approvals := GREATEST(COALESCE(v_assignment.required_approvals, 1), 1);
        IF v_approval_mode = 'all' AND COALESCE(array_length(v_assignment.candidate_users, 1), 0) > 0 THEN
            v_required_approvals := GREATEST(array_length(v_assignment.candidate_users, 1), 1);
        END IF;
    END IF;

    IF v_require_comment AND v_approval_comment IS NULL THEN
        RAISE EXCEPTION 'approval comment required' USING ERRCODE = '22023';
    END IF;

    IF v_from_task IS NOT NULL AND btrim(v_from_task) <> '' THEN
        INSERT INTO workflow.task_approvals (
            instance_id,
            definition_id,
            task_id,
            actor_username,
            actor_role,
            decision,
            comment,
            payload,
            created_at,
            updated_at
        )
        VALUES (
            v_current.id,
            v_current.definition_id,
            v_from_task,
            v_actor_key,
            v_actor_role,
            'approved',
            v_approval_comment,
            v_payload,
            NOW(),
            NOW()
        )
        ON CONFLICT (instance_id, task_id, actor_username) DO UPDATE
        SET actor_role = EXCLUDED.actor_role,
            decision = EXCLUDED.decision,
            comment = EXCLUDED.comment,
            payload = EXCLUDED.payload,
            updated_at = NOW();
    END IF;

    v_needs_quorum := v_approval_mode IN ('quota', 'all') AND v_required_approvals > 1;
    IF v_needs_quorum AND v_from_task IS NOT NULL AND btrim(v_from_task) <> '' THEN
        SELECT COUNT(*) INTO v_approval_count
        FROM workflow.task_approvals ta
        WHERE ta.instance_id = v_current.id
          AND ta.task_id = v_from_task
          AND ta.decision = 'approved';

        IF v_approval_count < v_required_approvals THEN
            UPDATE workflow.instances
            SET variables = COALESCE(variables, '{}'::jsonb) || v_payload
            WHERE id = p_instance_id
            RETURNING * INTO v_updated;

            INSERT INTO workflow.instance_events (
                instance_id,
                definition_id,
                event_type,
                from_task_id,
                to_task_id,
                actor_username,
                actor_role,
                payload
            )
            VALUES (
                v_updated.id,
                v_updated.definition_id,
                'TASK_APPROVAL_RECORDED',
                v_from_task,
                v_from_task,
                v_actor,
                v_actor_role,
                jsonb_build_object(
                    'approval', jsonb_build_object(
                        'mode', v_approval_mode,
                        'required', v_required_approvals,
                        'approved', v_approval_count,
                        'comment', COALESCE(v_approval_comment, '')
                    )
                ) || v_payload
            )
            RETURNING id INTO v_event_id;

            v_state_apply := workflow.apply_mapped_state_to_business(
                v_updated.definition_id,
                v_from_task,
                v_updated.business_key
            );

            UPDATE workflow.instance_events
            SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('state_apply', v_state_apply)
            WHERE id = v_event_id;

            RETURN v_updated;
        END IF;
    END IF;

    IF v_complete THEN
        UPDATE workflow.instances
        SET current_task_id = NULL,
            status = 'COMPLETED',
            ended_at = COALESCE(ended_at, NOW()),
            variables = COALESCE(variables, '{}'::jsonb) || v_payload
        WHERE id = p_instance_id
        RETURNING * INTO v_updated;
    ELSE
        UPDATE workflow.instances
        SET current_task_id = v_next_task_id,
            status = 'ACTIVE',
            ended_at = NULL,
            variables = COALESCE(variables, '{}'::jsonb) || v_payload
        WHERE id = p_instance_id
        RETURNING * INTO v_updated;
    END IF;

    INSERT INTO workflow.instance_events (
        instance_id,
        definition_id,
        event_type,
        from_task_id,
        to_task_id,
        actor_username,
        actor_role,
        payload
    )
    VALUES (
        v_updated.id,
        v_updated.definition_id,
        CASE WHEN v_complete THEN 'INSTANCE_COMPLETED' ELSE 'TASK_TRANSITION' END,
        v_from_task,
        v_updated.current_task_id,
        v_actor,
        v_actor_role,
        jsonb_build_object(
            'approval', jsonb_build_object(
                'mode', v_approval_mode,
                'required', v_required_approvals,
                'approved', GREATEST(v_approval_count, 1),
                'comment', COALESCE(v_approval_comment, '')
            )
        ) || v_payload
    )
    RETURNING id INTO v_event_id;

    v_state_apply := workflow.apply_mapped_state_to_business(
        v_updated.definition_id,
        CASE WHEN v_complete THEN v_from_task ELSE v_updated.current_task_id END,
        v_updated.business_key
    );

    UPDATE workflow.instance_events
    SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('state_apply', v_state_apply)
    WHERE id = v_event_id;

    RETURN v_updated;
END;
$$;


--
-- Name: apps; Type: TABLE; Schema: app_center; Owner: -
--

CREATE TABLE app_center.apps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    category_id integer,
    app_type character varying(20) NOT NULL,
    source_code jsonb,
    config jsonb,
    bpmn_xml text,
    icon character varying(50) DEFAULT '📦'::character varying,
    status character varying(20) DEFAULT 'draft'::character varying,
    version character varying(20) DEFAULT '1.0.0'::character varying,
    created_by text,
    updated_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT apps_app_type_check CHECK (((app_type)::text = ANY (ARRAY[('workflow'::character varying)::text, ('data'::character varying)::text, ('flash'::character varying)::text, ('custom'::character varying)::text]))),
    CONSTRAINT apps_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('published'::character varying)::text, ('archived'::character varying)::text])))
);


--
-- Name: TABLE apps; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON TABLE app_center.apps IS 'Central registry for all app types';


--
-- Name: COLUMN apps.source_code; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON COLUMN app_center.apps.source_code IS 'Flash app source files (Vue components, styles)';


--
-- Name: COLUMN apps.config; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON COLUMN app_center.apps.config IS 'Data app configuration (table mappings, filters)';


--
-- Name: COLUMN apps.bpmn_xml; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON COLUMN app_center.apps.bpmn_xml IS 'Workflow BPMN definition XML';


--
-- Name: categories; Type: TABLE; Schema: app_center; Owner: -
--

CREATE TABLE app_center.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(50),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE categories; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON TABLE app_center.categories IS 'App categories (Workflow/Data/Flash/Custom)';


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: app_center; Owner: -
--

CREATE SEQUENCE app_center.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: app_center; Owner: -
--

ALTER SEQUENCE app_center.categories_id_seq OWNED BY app_center.categories.id;


--
-- Name: execution_logs; Type: TABLE; Schema: app_center; Owner: -
--

CREATE TABLE app_center.execution_logs (
    id integer NOT NULL,
    app_id uuid,
    execution_id uuid DEFAULT gen_random_uuid(),
    task_id character varying(100),
    status character varying(20),
    input_data jsonb,
    output_data jsonb,
    error_message text,
    executed_by text,
    executed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT execution_logs_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('running'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: TABLE execution_logs; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON TABLE app_center.execution_logs IS 'Runtime execution logs for workflows';


--
-- Name: execution_logs_id_seq; Type: SEQUENCE; Schema: app_center; Owner: -
--

CREATE SEQUENCE app_center.execution_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: app_center; Owner: -
--

ALTER SEQUENCE app_center.execution_logs_id_seq OWNED BY app_center.execution_logs.id;


--
-- Name: published_routes; Type: TABLE; Schema: app_center; Owner: -
--

CREATE TABLE app_center.published_routes (
    id integer NOT NULL,
    app_id uuid,
    route_path character varying(200) NOT NULL,
    mount_point character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE published_routes; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON TABLE app_center.published_routes IS 'Routes for published apps (accessible to end users)';


--
-- Name: published_routes_id_seq; Type: SEQUENCE; Schema: app_center; Owner: -
--

CREATE SEQUENCE app_center.published_routes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: published_routes_id_seq; Type: SEQUENCE OWNED BY; Schema: app_center; Owner: -
--

ALTER SEQUENCE app_center.published_routes_id_seq OWNED BY app_center.published_routes.id;


--
-- Name: workflow_permission_policies; Type: TABLE; Schema: app_center; Owner: -
--

CREATE TABLE app_center.workflow_permission_policies (
    id integer NOT NULL,
    workflow_app_id uuid NOT NULL,
    acl_module text NOT NULL,
    permission_mode text DEFAULT 'compat'::text NOT NULL,
    enforce_assignment boolean DEFAULT true NOT NULL,
    enforce_workflow_op_perm boolean DEFAULT true NOT NULL,
    enforce_status_transition_perm boolean DEFAULT true NOT NULL,
    legacy_fallback_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_permission_policies_mode_check CHECK ((permission_mode = ANY (ARRAY['compat'::text, 'strict'::text])))
);


--
-- Name: workflow_permission_policies_id_seq; Type: SEQUENCE; Schema: app_center; Owner: -
--

CREATE SEQUENCE app_center.workflow_permission_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_permission_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: app_center; Owner: -
--

ALTER SEQUENCE app_center.workflow_permission_policies_id_seq OWNED BY app_center.workflow_permission_policies.id;


--
-- Name: workflow_state_mappings; Type: TABLE; Schema: app_center; Owner: -
--

CREATE TABLE app_center.workflow_state_mappings (
    id integer NOT NULL,
    workflow_app_id uuid,
    bpmn_task_id character varying(100) NOT NULL,
    target_table character varying(100),
    state_field character varying(50),
    state_value character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    from_state text,
    mapping_mode text DEFAULT 'task_arrival'::text NOT NULL,
    CONSTRAINT workflow_state_mappings_mode_check CHECK ((mapping_mode = ANY (ARRAY['task_arrival'::text, 'transition'::text])))
);


--
-- Name: TABLE workflow_state_mappings; Type: COMMENT; Schema: app_center; Owner: -
--

COMMENT ON TABLE app_center.workflow_state_mappings IS 'Map BPMN tasks to database state transitions';


--
-- Name: workflow_state_mappings_id_seq; Type: SEQUENCE; Schema: app_center; Owner: -
--

CREATE SEQUENCE app_center.workflow_state_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_state_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: app_center; Owner: -
--

ALTER SEQUENCE app_center.workflow_state_mappings_id_seq OWNED BY app_center.workflow_state_mappings.id;


--
-- Name: workflow_transition_rules; Type: TABLE; Schema: app_center; Owner: -
--

CREATE TABLE app_center.workflow_transition_rules (
    id integer NOT NULL,
    workflow_app_id uuid NOT NULL,
    from_task_id text,
    to_task_id text,
    from_state text,
    to_state text,
    required_permission text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_transition_rules_distinct_state CHECK (((from_state IS NULL) OR (to_state IS NULL) OR (from_state <> to_state)))
);


--
-- Name: workflow_transition_rules_id_seq; Type: SEQUENCE; Schema: app_center; Owner: -
--

CREATE SEQUENCE app_center.workflow_transition_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_transition_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: app_center; Owner: -
--

ALTER SEQUENCE app_center.workflow_transition_rules_id_seq OWNED BY app_center.workflow_transition_rules.id;


--
-- Name: checkin_records; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.checkin_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb,
    name text,
    department text,
    remark text,
    checkin_time timestamp with time zone
);


--
-- Name: data_app_17137de9; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_17137de9 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb
);


--
-- Name: data_app_1f840d3b; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_1f840d3b (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb
);


--
-- Name: data_app_3f3cf089; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_3f3cf089 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb
);


--
-- Name: data_app_51d98ca6; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_51d98ca6 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb
);


--
-- Name: data_app_6da3f976; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_6da3f976 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb,
    f_1 text,
    f_2 text,
    f_3 text,
    field_2782 text,
    field_595 text
);


--
-- Name: data_app_6de378ee; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_6de378ee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb,
    f_1 text,
    f_2 text,
    f_3 text,
    f_4 text,
    f_5 text
);


--
-- Name: data_app_7dd735dd; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_7dd735dd (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb
);


--
-- Name: data_app_8966fa75; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_8966fa75 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb
);


--
-- Name: data_app_cd7a8401; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_cd7a8401 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb,
    test_one text,
    test_two text,
    test_five text,
    test_four text,
    field_1138 text,
    field_6930 text,
    field_1088 text,
    field_7446 text
);


--
-- Name: data_app_fd3f499a; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.data_app_fd3f499a (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb
);


--
-- Name: eiscore_chain_test_records; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.eiscore_chain_test_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    properties jsonb DEFAULT '{}'::jsonb,
    title text,
    status text,
    run_id text,
    amount numeric
);


--
-- Name: ontology_table_semantics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ontology_table_semantics (
    table_schema text NOT NULL,
    table_name text NOT NULL,
    semantic_domain text DEFAULT 'general'::text NOT NULL,
    semantic_class text DEFAULT 'entity'::text NOT NULL,
    semantic_name text NOT NULL,
    semantic_description text DEFAULT ''::text NOT NULL,
    is_business boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ontology_table_relations; Type: VIEW; Schema: app_data; Owner: -
--

CREATE VIEW app_data.ontology_table_relations AS
 WITH manual_ontology_relations AS (
         SELECT 'ontology'::text AS relation_type,
            'public.users'::text AS subject_table,
            ''::text AS subject_column,
            'acl:hasRole'::text AS predicate,
            'public.roles'::text AS object_table,
            ''::text AS object_column,
            'public.user_roles'::text AS bridge_table,
            'user_roles.user_id -> users.id; user_roles.role_id -> roles.id'::text AS details
        UNION ALL
         SELECT 'ontology'::text AS text,
            'public.roles'::text AS text,
            ''::text AS text,
            'acl:grantsPermission'::text AS text,
            'public.permissions'::text AS text,
            ''::text AS text,
            'public.role_permissions'::text AS text,
            'role_permissions.role_id -> roles.id; role_permissions.permission_id -> permissions.id'::text AS text
        UNION ALL
         SELECT 'ontology'::text AS text,
            'workflow.instances'::text AS text,
            'definition_id'::text AS text,
            'wf:instanceOf'::text AS text,
            'workflow.definitions'::text AS text,
            'id'::text AS text,
            ''::text AS text,
            'workflow instance belongs to workflow definition'::text AS text
        UNION ALL
         SELECT 'ontology'::text AS text,
            'workflow.instances'::text AS text,
            'current_task_id'::text AS text,
            'wf:hasCurrentTask'::text AS text,
            'workflow.task_assignments'::text AS text,
            'task_id'::text AS text,
            ''::text AS text,
            'task assignment applies with definition_id + task_id'::text AS text
        UNION ALL
         SELECT 'ontology'::text AS text,
            'workflow.task_assignments'::text AS text,
            'candidate_roles[]'::text AS text,
            'wf:assignedRole'::text AS text,
            'public.roles'::text AS text,
            'code'::text AS text,
            ''::text AS text,
            'candidate_roles stores role codes'::text AS text
        UNION ALL
         SELECT 'ontology'::text AS text,
            'workflow.task_assignments'::text AS text,
            'candidate_users[]'::text AS text,
            'wf:assignedUser'::text AS text,
            'public.users'::text AS text,
            'username'::text AS text,
            ''::text AS text,
            'candidate_users stores usernames'::text AS text
        UNION ALL
         SELECT 'ontology'::text AS text,
            'workflow.definitions'::text AS text,
            'app_id'::text AS text,
            'eiscore:linkedApp'::text AS text,
            'app_center.apps'::text AS text,
            'id'::text AS text,
            ''::text AS text,
            'workflow definition linked to App Center app'::text AS text
        UNION ALL
         SELECT 'ontology'::text AS text,
            'app_center.workflow_state_mappings'::text AS text,
            'workflow_app_id'::text AS text,
            'wf:mapsToStatus'::text AS text,
            'app_center.apps'::text AS text,
            'id'::text AS text,
            ''::text AS text,
            'state mapping belongs to workflow app'::text AS text
        UNION ALL
         SELECT 'ontology'::text AS text,
            'public.permissions'::text AS text,
            'code'::text AS text,
            'ontology:semanticProjection'::text AS text,
            'public.v_permission_ontology'::text AS text,
            'code'::text AS text,
            ''::text AS text,
            'permission codes parsed into semantic view'::text AS text
        ), fk_pairs AS (
         SELECT con.oid AS constraint_oid,
            ns_src.nspname AS src_schema,
            cls_src.relname AS src_table,
            att_src.attname AS src_column,
            ns_ref.nspname AS ref_schema,
            cls_ref.relname AS ref_table,
            att_ref.attname AS ref_column,
            src_key.ord AS key_ord
           FROM ((((((((pg_constraint con
             JOIN pg_class cls_src ON ((cls_src.oid = con.conrelid)))
             JOIN pg_namespace ns_src ON ((ns_src.oid = cls_src.relnamespace)))
             JOIN pg_class cls_ref ON ((cls_ref.oid = con.confrelid)))
             JOIN pg_namespace ns_ref ON ((ns_ref.oid = cls_ref.relnamespace)))
             JOIN LATERAL unnest(con.conkey) WITH ORDINALITY src_key(attnum, ord) ON (true))
             JOIN LATERAL unnest(con.confkey) WITH ORDINALITY ref_key(attnum, ord) ON ((ref_key.ord = src_key.ord)))
             JOIN pg_attribute att_src ON (((att_src.attrelid = con.conrelid) AND (att_src.attnum = src_key.attnum))))
             JOIN pg_attribute att_ref ON (((att_ref.attrelid = con.confrelid) AND (att_ref.attnum = ref_key.attnum))))
          WHERE ((con.contype = 'f'::"char") AND (ns_src.nspname = ANY (ARRAY['public'::name, 'app_center'::name, 'workflow'::name, 'app_data'::name, 'hr'::name, 'scm'::name])) AND (ns_ref.nspname = ANY (ARRAY['public'::name, 'app_center'::name, 'workflow'::name, 'app_data'::name, 'hr'::name, 'scm'::name])))
        ), ontology_relations AS (
         SELECT manual_ontology_relations.relation_type,
            manual_ontology_relations.subject_table,
            manual_ontology_relations.subject_column,
            manual_ontology_relations.predicate,
            manual_ontology_relations.object_table,
            manual_ontology_relations.object_column,
            manual_ontology_relations.bridge_table,
            manual_ontology_relations.details
           FROM manual_ontology_relations
        UNION ALL
         SELECT 'ontology'::text AS relation_type,
            format('%I.%I'::text, fk.src_schema, fk.src_table) AS subject_table,
            COALESCE(fk.src_column, ''::name) AS subject_column,
            'ontology:dependsOn'::text AS predicate,
            format('%I.%I'::text, fk.ref_schema, fk.ref_table) AS object_table,
            COALESCE(fk.ref_column, ''::name) AS object_column,
            ''::text AS bridge_table,
            format('business ontology inferred from foreign key: %I.%I.%I depends on %I.%I.%I'::text, fk.src_schema, fk.src_table, COALESCE(fk.src_column, '?'::name), fk.ref_schema, fk.ref_table, COALESCE(fk.ref_column, '?'::name)) AS details
           FROM ((fk_pairs fk
             JOIN public.ontology_table_semantics ss_1 ON (((ss_1.table_schema = fk.src_schema) AND (ss_1.table_name = fk.src_table) AND (ss_1.is_active = true) AND (ss_1.is_business = true))))
             JOIN public.ontology_table_semantics os_1 ON (((os_1.table_schema = fk.ref_schema) AND (os_1.table_name = fk.ref_table) AND (os_1.is_active = true) AND (os_1.is_business = true))))
        ), fk_relations AS (
         SELECT 'foreign_key'::text AS relation_type,
            format('%I.%I'::text, fk.src_schema, fk.src_table) AS subject_table,
            COALESCE(fk.src_column, ''::name) AS subject_column,
            format('fk:%s'::text, COALESCE(fk.src_column, '?'::name)) AS predicate,
            format('%I.%I'::text, fk.ref_schema, fk.ref_table) AS object_table,
            COALESCE(fk.ref_column, ''::name) AS object_column,
            ''::text AS bridge_table,
            format('%I.%I.%I -> %I.%I.%I'::text, fk.src_schema, fk.src_table, COALESCE(fk.src_column, '?'::name), fk.ref_schema, fk.ref_table, COALESCE(fk.ref_column, '?'::name)) AS details
           FROM fk_pairs fk
        ), all_relations AS (
         SELECT ontology_relations.relation_type,
            ontology_relations.subject_table,
            ontology_relations.subject_column,
            ontology_relations.predicate,
            ontology_relations.object_table,
            ontology_relations.object_column,
            ontology_relations.bridge_table,
            ontology_relations.details
           FROM ontology_relations
        UNION ALL
         SELECT fk_relations.relation_type,
            fk_relations.subject_table,
            fk_relations.subject_column,
            fk_relations.predicate,
            fk_relations.object_table,
            fk_relations.object_column,
            fk_relations.bridge_table,
            fk_relations.details
           FROM fk_relations
        )
 SELECT row_number() OVER (ORDER BY ar.relation_type, ar.subject_table, ar.predicate, ar.object_table, ar.subject_column, ar.object_column) AS id,
    ar.relation_type,
    ar.subject_table,
    ar.subject_column,
    ar.predicate,
    ar.object_table,
    ar.object_column,
    ar.bridge_table,
    ar.details,
    COALESCE(ss.semantic_name, ar.subject_table) AS subject_semantic_name,
    COALESCE(ss.semantic_class, ''::text) AS subject_semantic_class,
    COALESCE(ss.semantic_domain, ''::text) AS subject_semantic_domain,
    COALESCE(ss.is_business, false) AS subject_is_business,
    COALESCE(os.semantic_name, ar.object_table) AS object_semantic_name,
    COALESCE(os.semantic_class, ''::text) AS object_semantic_class,
    COALESCE(os.semantic_domain, ''::text) AS object_semantic_domain,
    COALESCE(os.is_business, false) AS object_is_business,
    (COALESCE(ss.is_business, false) AND COALESCE(os.is_business, false)) AS is_business_relation
   FROM ((all_relations ar
     LEFT JOIN public.ontology_table_semantics ss ON (((ss.table_schema = split_part(ar.subject_table, '.'::text, 1)) AND (ss.table_name = split_part(ar.subject_table, '.'::text, 2)) AND (ss.is_active = true))))
     LEFT JOIN public.ontology_table_semantics os ON (((os.table_schema = split_part(ar.object_table, '.'::text, 1)) AND (os.table_name = split_part(ar.object_table, '.'::text, 2)) AND (os.is_active = true))));


--
-- Name: twin_knowledge_files; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.twin_knowledge_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id text NOT NULL,
    file_name text NOT NULL,
    file_type text,
    file_size integer DEFAULT 0,
    content_text text DEFAULT ''::text,
    content_b64 text DEFAULT ''::text,
    tags text[] DEFAULT '{}'::text[],
    summary text DEFAULT ''::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: twin_messages; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.twin_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    tool_calls jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT twin_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])))
);


--
-- Name: twin_sessions; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.twin_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id text NOT NULL,
    title text DEFAULT '新对话'::text,
    model text DEFAULT 'glm-4.6v'::text,
    summary text DEFAULT ''::text,
    message_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: twin_tool_logs; Type: TABLE; Schema: app_data; Owner: -
--

CREATE TABLE app_data.twin_tool_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    message_id uuid,
    tool_name text NOT NULL,
    tool_input jsonb,
    tool_output jsonb,
    duration_ms integer,
    success boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: v_twin_overview; Type: VIEW; Schema: app_data; Owner: -
--

CREATE VIEW app_data.v_twin_overview AS
 SELECT id AS session_id,
    employee_id,
    title,
    summary,
    message_count,
    model,
    created_at,
    updated_at,
    ( SELECT count(*) AS count
           FROM app_data.twin_knowledge_files k
          WHERE (k.employee_id = s.employee_id)) AS kb_file_count
   FROM app_data.twin_sessions s
  ORDER BY updated_at DESC;


--
-- Name: users; Type: TABLE; Schema: basic_auth; Owner: -
--

CREATE TABLE basic_auth.users (
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'web_user'::text NOT NULL,
    full_name text
);


--
-- Name: agent_audit_events; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.agent_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    trace_id text NOT NULL,
    actor_type text DEFAULT 'system'::text NOT NULL,
    actor_id text DEFAULT ''::text NOT NULL,
    session_id uuid,
    tool_id text DEFAULT ''::text NOT NULL,
    input_hash text DEFAULT ''::text NOT NULL,
    result_code text DEFAULT 'OK'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_audit_events_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: agent_messages; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.agent_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content_redacted text DEFAULT ''::text NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb NOT NULL,
    tool_calls jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'tool'::text, 'system'::text]))),
    CONSTRAINT agent_messages_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: agent_qualification_rules; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.agent_qualification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    version integer NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    score_delta integer DEFAULT 0 NOT NULL,
    active_from timestamp with time zone,
    active_to timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_qualification_rules_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT agent_qualification_rules_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'active'::text, 'retired'::text]))),
    CONSTRAINT agent_qualification_rules_version_check CHECK ((version > 0))
);


--
-- Name: agent_sessions; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.agent_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    channel text DEFAULT 'website'::text NOT NULL,
    locale text DEFAULT 'zh-CN'::text NOT NULL,
    visitor_hash text DEFAULT ''::text NOT NULL,
    consent_at timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    lead_id uuid,
    owner_id text DEFAULT ''::text NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_sessions_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT agent_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'human_handoff'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: audit_events; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    trace_id text DEFAULT ''::text NOT NULL,
    idempotency_key text DEFAULT ''::text NOT NULL,
    actor_type text DEFAULT 'system'::text NOT NULL,
    actor_id text DEFAULT ''::text NOT NULL,
    action text NOT NULL,
    object_type text DEFAULT ''::text NOT NULL,
    object_id text DEFAULT ''::text NOT NULL,
    input_hash text DEFAULT ''::text NOT NULL,
    result_code text DEFAULT 'OK'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_events_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: cases; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    locale text NOT NULL,
    slug text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    industry text DEFAULT ''::text NOT NULL,
    scope text DEFAULT ''::text NOT NULL,
    delivery_date date,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    public_level text DEFAULT 'anonymous'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cases_public_level_check CHECK ((public_level = ANY (ARRAY['named'::text, 'anonymous'::text, 'internal'::text]))),
    CONSTRAINT cases_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT cases_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: certificates; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    name text NOT NULL,
    certificate_number text DEFAULT ''::text NOT NULL,
    issuer text DEFAULT ''::text NOT NULL,
    valid_from date,
    valid_to date,
    public_level text DEFAULT 'internal'::text NOT NULL,
    media_asset_id uuid,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT certificates_public_level_check CHECK ((public_level = ANY (ARRAY['public'::text, 'login'::text, 'internal'::text]))),
    CONSTRAINT certificates_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT certificates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: content_pages; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.content_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    locale text NOT NULL,
    slug text NOT NULL,
    page_type text DEFAULT 'page'::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    published_at timestamp with time zone,
    published_by text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_pages_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT content_pages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: content_revisions; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.content_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    version integer NOT NULL,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    change_summary text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_revisions_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT content_revisions_version_check CHECK ((version > 0))
);


--
-- Name: evidence_records; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.evidence_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    claim text NOT NULL,
    source_type text DEFAULT 'internal_document'::text NOT NULL,
    source_ref text DEFAULT ''::text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    verified_by text DEFAULT ''::text NOT NULL,
    verified_at timestamp with time zone,
    expires_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidence_records_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT evidence_records_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: geo_answer_snapshots; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.geo_answer_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    locale text NOT NULL,
    platform text NOT NULL,
    question text NOT NULL,
    answer text DEFAULT ''::text NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb NOT NULL,
    accuracy_status text DEFAULT 'pending'::text NOT NULL,
    checked_by text DEFAULT ''::text NOT NULL,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT geo_answer_snapshots_accuracy_status_check CHECK ((accuracy_status = ANY (ARRAY['pending'::text, 'accurate'::text, 'needs_correction'::text, 'obsolete'::text]))),
    CONSTRAINT geo_answer_snapshots_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    locale text DEFAULT 'zh-CN'::text NOT NULL,
    document_type text DEFAULT 'faq'::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb NOT NULL,
    forbidden_claims jsonb DEFAULT '[]'::jsonb NOT NULL,
    effective_from timestamp with time zone,
    expires_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_documents_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT knowledge_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: lead_events; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.lead_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    lead_id uuid,
    session_id text DEFAULT ''::text NOT NULL,
    event_name text NOT NULL,
    page_path text DEFAULT ''::text NOT NULL,
    event_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lead_events_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: leads; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_ref text NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    source text DEFAULT 'website'::text NOT NULL,
    locale text DEFAULT 'zh-CN'::text NOT NULL,
    page_path text DEFAULT ''::text NOT NULL,
    utm jsonb DEFAULT '{}'::jsonb NOT NULL,
    company_name text DEFAULT ''::text NOT NULL,
    contact_name text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    whatsapp text DEFAULT ''::text NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    product_slugs jsonb DEFAULT '[]'::jsonb NOT NULL,
    quantity text DEFAULT ''::text NOT NULL,
    target_date text DEFAULT ''::text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    consent jsonb DEFAULT '{}'::jsonb NOT NULL,
    qualification jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    owner_id text DEFAULT ''::text NOT NULL,
    source_session_id text DEFAULT ''::text NOT NULL,
    ip_hash text DEFAULT ''::text NOT NULL,
    idempotency_key text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leads_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'qualified'::text, 'assigned'::text, 'contacted'::text, 'won'::text, 'lost'::text, 'spam'::text, 'archived'::text])))
);


--
-- Name: media_assets; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    storage_key text NOT NULL,
    public_url text DEFAULT ''::text NOT NULL,
    mime_type text DEFAULT ''::text NOT NULL,
    width integer,
    height integer,
    alt_text jsonb DEFAULT '{}'::jsonb NOT NULL,
    license jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_assets_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT media_assets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: opportunity_drafts; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.opportunity_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    lead_id uuid NOT NULL,
    source_session_id uuid,
    product_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    estimated_amount numeric(18,2),
    currency text DEFAULT ''::text NOT NULL,
    stage text DEFAULT 'new'::text NOT NULL,
    qualification jsonb DEFAULT '{}'::jsonb NOT NULL,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    idempotency_key text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT opportunity_drafts_approval_status_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text, 'synced'::text, 'archived'::text]))),
    CONSTRAINT opportunity_drafts_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: product_locales; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.product_locales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    locale text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    faq jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_locales_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: production_work_order_drafts; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.production_work_order_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    sales_order_id uuid NOT NULL,
    planned_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    material_requirements jsonb DEFAULT '[]'::jsonb NOT NULL,
    capacity_risk jsonb DEFAULT '{}'::jsonb NOT NULL,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    idempotency_key text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_work_order_drafts_approval_status_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text, 'synced'::text, 'archived'::text]))),
    CONSTRAINT production_work_order_drafts_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: products; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    product_code text NOT NULL,
    slug text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    applications jsonb DEFAULT '[]'::jsonb NOT NULL,
    specifications jsonb DEFAULT '{}'::jsonb NOT NULL,
    delivery jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: quote_drafts; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.quote_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    opportunity_id uuid NOT NULL,
    currency text DEFAULT ''::text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    valid_until date,
    price_source text DEFAULT ''::text NOT NULL,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    idempotency_key text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_drafts_approval_status_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text, 'synced'::text, 'archived'::text]))),
    CONSTRAINT quote_drafts_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: sales_order_drafts; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.sales_order_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    quote_id uuid NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    delivery_date date,
    inventory_check jsonb DEFAULT '{}'::jsonb NOT NULL,
    bom_check jsonb DEFAULT '{}'::jsonb NOT NULL,
    capacity_check jsonb DEFAULT '{}'::jsonb NOT NULL,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    idempotency_key text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_order_drafts_approval_status_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text, 'synced'::text, 'archived'::text]))),
    CONSTRAINT sales_order_drafts_site_key_check CHECK ((site_key = 'primary'::text))
);


--
-- Name: seo_checks; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.seo_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    run_id uuid NOT NULL,
    path text DEFAULT ''::text NOT NULL,
    check_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seo_checks_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text]))),
    CONSTRAINT seo_checks_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT seo_checks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'ignored'::text])))
);


--
-- Name: seo_keywords; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.seo_keywords (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    locale text NOT NULL,
    market text DEFAULT ''::text NOT NULL,
    keyword text NOT NULL,
    intent text DEFAULT 'informational'::text NOT NULL,
    target_path text DEFAULT ''::text NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seo_keywords_priority_check CHECK (((priority >= 1) AND (priority <= 100))),
    CONSTRAINT seo_keywords_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT seo_keywords_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'archived'::text])))
);


--
-- Name: seo_metadata; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.seo_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    locale text NOT NULL,
    path text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    canonical text DEFAULT ''::text NOT NULL,
    robots text DEFAULT 'index,follow'::text NOT NULL,
    keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    structured_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seo_metadata_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT seo_metadata_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: site_config; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.site_config (
    site_key text DEFAULT 'primary'::text NOT NULL,
    legal_name text NOT NULL,
    brand_name text DEFAULT ''::text NOT NULL,
    brand_short_name text DEFAULT ''::text NOT NULL,
    factory_name text DEFAULT ''::text NOT NULL,
    domain text NOT NULL,
    template_key text DEFAULT 'manufacturer-editorial-v1'::text NOT NULL,
    default_locale text DEFAULT 'zh-CN'::text NOT NULL,
    enabled_locales jsonb DEFAULT '["zh-CN"]'::jsonb NOT NULL,
    theme jsonb DEFAULT '{}'::jsonb NOT NULL,
    contact jsonb DEFAULT '{}'::jsonb NOT NULL,
    social_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    trademark jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_version integer DEFAULT 0 NOT NULL,
    published_at timestamp with time zone,
    published_by text DEFAULT ''::text NOT NULL,
    published_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_config_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT site_config_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'suspended'::text, 'archived'::text])))
);


--
-- Name: site_locales; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.site_locales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    locale text NOT NULL,
    fallback_locale text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    translation_owner text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_locales_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT site_locales_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: solutions; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.solutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    slug text NOT NULL,
    locale text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    industry text DEFAULT ''::text NOT NULL,
    scenario text DEFAULT ''::text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    seo jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT solutions_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT solutions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text, 'expired'::text, 'archived'::text])))
);


--
-- Name: sync_jobs; Type: TABLE; Schema: company_site; Owner: -
--

CREATE TABLE company_site.sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text DEFAULT 'primary'::text NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    target_system text NOT NULL,
    idempotency_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    last_error text DEFAULT ''::text NOT NULL,
    source_trace_id text DEFAULT ''::text NOT NULL,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sync_jobs_retry_count_check CHECK ((retry_count >= 0)),
    CONSTRAINT sync_jobs_site_key_check CHECK ((site_key = 'primary'::text)),
    CONSTRAINT sync_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'dead_letter'::text])))
);


--
-- Name: baseline_migration_coverage; Type: TABLE; Schema: eiscore_meta; Owner: -
--

CREATE TABLE eiscore_meta.baseline_migration_coverage (
    baseline_id text NOT NULL,
    migration_id text NOT NULL,
    checksum_sha256 text NOT NULL,
    source_manifest text NOT NULL,
    CONSTRAINT baseline_migration_coverage_checksum_sha256_check CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: database_baselines; Type: TABLE; Schema: eiscore_meta; Owner: -
--

CREATE TABLE eiscore_meta.database_baselines (
    baseline_id text NOT NULL,
    baseline_fingerprint_sha256 text NOT NULL,
    schema_sha256 text NOT NULL,
    object_catalog_sha256 text NOT NULL,
    installed_by text DEFAULT CURRENT_USER NOT NULL,
    installed_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT database_baselines_baseline_fingerprint_sha256_check CHECK ((baseline_fingerprint_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT database_baselines_object_catalog_sha256_check CHECK ((object_catalog_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT database_baselines_schema_sha256_check CHECK ((schema_sha256 ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: eiscore_meta; Owner: -
--

CREATE TABLE eiscore_meta.schema_migrations (
    migration_id text NOT NULL,
    checksum_sha256 text NOT NULL,
    source_path text NOT NULL,
    rollback_strategy text NOT NULL,
    release_revision text DEFAULT 'unknown'::text NOT NULL,
    applied_by text DEFAULT CURRENT_USER NOT NULL,
    backup_evidence text NOT NULL,
    execution_ms bigint DEFAULT 0 NOT NULL,
    applied_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT schema_migrations_checksum_sha256_check CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT schema_migrations_execution_ms_check CHECK ((execution_ms >= 0))
);


--
-- Name: archives; Type: TABLE; Schema: hr; Owner: -
--

CREATE TABLE hr.archives (
    id integer NOT NULL,
    name text NOT NULL,
    employee_no text,
    department text,
    "position" text,
    phone text,
    status text DEFAULT '在职'::text,
    base_salary numeric(10,2) DEFAULT 0,
    entry_date date DEFAULT CURRENT_DATE,
    properties jsonb DEFAULT '{}'::jsonb,
    version integer DEFAULT 1,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: COLUMN archives.id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.id IS '编号';


--
-- Name: COLUMN archives.name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.name IS '姓名';


--
-- Name: COLUMN archives.employee_no; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.employee_no IS '工号';


--
-- Name: COLUMN archives.department; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.department IS '部门';


--
-- Name: COLUMN archives."position"; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives."position" IS '岗位';


--
-- Name: COLUMN archives.phone; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.phone IS '手机号';


--
-- Name: COLUMN archives.status; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.status IS '状态';


--
-- Name: COLUMN archives.base_salary; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.base_salary IS '基础工资';


--
-- Name: COLUMN archives.entry_date; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.entry_date IS '入职日期';


--
-- Name: COLUMN archives.updated_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.archives.updated_at IS '更新时间';


--
-- Name: archives_id_seq; Type: SEQUENCE; Schema: hr; Owner: -
--

CREATE SEQUENCE hr.archives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archives_id_seq; Type: SEQUENCE OWNED BY; Schema: hr; Owner: -
--

ALTER SEQUENCE hr.archives_id_seq OWNED BY hr.archives.id;


--
-- Name: attendance_month_overrides; Type: TABLE; Schema: hr; Owner: -
--

CREATE TABLE hr.attendance_month_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    att_month date NOT NULL,
    person_type text DEFAULT 'employee'::text NOT NULL,
    employee_id bigint,
    employee_name text,
    employee_no text,
    temp_name text,
    temp_phone text,
    dept_name text NOT NULL,
    person_key text GENERATED ALWAYS AS (
CASE
    WHEN (person_type = 'employee'::text) THEN ('emp:'::text || (employee_id)::text)
    ELSE ('temp:'::text || COALESCE(temp_phone, temp_name, ''::text))
END) STORED,
    total_days integer DEFAULT 0 NOT NULL,
    late_days integer DEFAULT 0 NOT NULL,
    early_days integer DEFAULT 0 NOT NULL,
    leave_days integer DEFAULT 0 NOT NULL,
    absent_days integer DEFAULT 0 NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_month_person_required CHECK ((((person_type = 'employee'::text) AND (employee_id IS NOT NULL)) OR ((person_type = 'temp'::text) AND (temp_name IS NOT NULL)))),
    CONSTRAINT attendance_month_person_type_check CHECK ((person_type = ANY (ARRAY['employee'::text, 'temp'::text])))
);


--
-- Name: COLUMN attendance_month_overrides.id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.id IS '编号';


--
-- Name: COLUMN attendance_month_overrides.att_month; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.att_month IS '月份';


--
-- Name: COLUMN attendance_month_overrides.person_type; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.person_type IS '人员类型';


--
-- Name: COLUMN attendance_month_overrides.employee_id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.employee_id IS '员工ID';


--
-- Name: COLUMN attendance_month_overrides.employee_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.employee_name IS '员工姓名';


--
-- Name: COLUMN attendance_month_overrides.employee_no; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.employee_no IS '工号';


--
-- Name: COLUMN attendance_month_overrides.temp_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.temp_name IS '临时工姓名';


--
-- Name: COLUMN attendance_month_overrides.temp_phone; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.temp_phone IS '临时工电话';


--
-- Name: COLUMN attendance_month_overrides.dept_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.dept_name IS '部门';


--
-- Name: COLUMN attendance_month_overrides.person_key; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.person_key IS '人员标识';


--
-- Name: COLUMN attendance_month_overrides.total_days; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.total_days IS '总天数';


--
-- Name: COLUMN attendance_month_overrides.late_days; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.late_days IS '迟到天数';


--
-- Name: COLUMN attendance_month_overrides.early_days; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.early_days IS '早退天数';


--
-- Name: COLUMN attendance_month_overrides.leave_days; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.leave_days IS '请假天数';


--
-- Name: COLUMN attendance_month_overrides.absent_days; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.absent_days IS '缺勤天数';


--
-- Name: COLUMN attendance_month_overrides.overtime_minutes; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.overtime_minutes IS '加班分钟';


--
-- Name: COLUMN attendance_month_overrides.remark; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.remark IS '备注';


--
-- Name: COLUMN attendance_month_overrides.created_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.created_at IS '创建时间';


--
-- Name: COLUMN attendance_month_overrides.updated_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_month_overrides.updated_at IS '更新时间';


--
-- Name: attendance_records; Type: TABLE; Schema: hr; Owner: -
--

CREATE TABLE hr.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    att_date date NOT NULL,
    person_type text DEFAULT 'employee'::text NOT NULL,
    employee_id bigint,
    employee_name text,
    employee_no text,
    temp_name text,
    temp_phone text,
    dept_id bigint,
    dept_name text NOT NULL,
    shift_id uuid,
    shift_name text,
    shift_start_time time without time zone,
    shift_end_time time without time zone,
    shift_cross_day boolean,
    late_grace_min integer,
    early_grace_min integer,
    ot_break_min integer,
    punch_times text[] DEFAULT '{}'::text[] NOT NULL,
    late_flag boolean DEFAULT false NOT NULL,
    early_flag boolean DEFAULT false NOT NULL,
    leave_flag boolean DEFAULT false NOT NULL,
    absent_flag boolean DEFAULT false NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_person_required CHECK ((((person_type = 'employee'::text) AND (employee_id IS NOT NULL)) OR ((person_type = 'temp'::text) AND (temp_name IS NOT NULL)))),
    CONSTRAINT attendance_person_type_check CHECK ((person_type = ANY (ARRAY['employee'::text, 'temp'::text])))
);


--
-- Name: COLUMN attendance_records.id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.id IS '编号';


--
-- Name: COLUMN attendance_records.att_date; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.att_date IS '日期';


--
-- Name: COLUMN attendance_records.person_type; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.person_type IS '人员类型';


--
-- Name: COLUMN attendance_records.employee_id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.employee_id IS '员工ID';


--
-- Name: COLUMN attendance_records.employee_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.employee_name IS '员工姓名';


--
-- Name: COLUMN attendance_records.employee_no; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.employee_no IS '工号';


--
-- Name: COLUMN attendance_records.temp_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.temp_name IS '临时工姓名';


--
-- Name: COLUMN attendance_records.temp_phone; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.temp_phone IS '临时工电话';


--
-- Name: COLUMN attendance_records.dept_id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.dept_id IS '部门ID';


--
-- Name: COLUMN attendance_records.dept_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.dept_name IS '部门';


--
-- Name: COLUMN attendance_records.shift_id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.shift_id IS '班次ID';


--
-- Name: COLUMN attendance_records.shift_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.shift_name IS '班次';


--
-- Name: COLUMN attendance_records.shift_start_time; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.shift_start_time IS '上班时间';


--
-- Name: COLUMN attendance_records.shift_end_time; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.shift_end_time IS '下班时间';


--
-- Name: COLUMN attendance_records.shift_cross_day; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.shift_cross_day IS '跨天班次';


--
-- Name: COLUMN attendance_records.late_grace_min; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.late_grace_min IS '迟到容忍(分)';


--
-- Name: COLUMN attendance_records.early_grace_min; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.early_grace_min IS '早退容忍(分)';


--
-- Name: COLUMN attendance_records.ot_break_min; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.ot_break_min IS '加班扣除(分)';


--
-- Name: COLUMN attendance_records.punch_times; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.punch_times IS '打卡记录';


--
-- Name: COLUMN attendance_records.late_flag; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.late_flag IS '迟到';


--
-- Name: COLUMN attendance_records.early_flag; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.early_flag IS '早退';


--
-- Name: COLUMN attendance_records.leave_flag; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.leave_flag IS '请假';


--
-- Name: COLUMN attendance_records.absent_flag; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.absent_flag IS '缺勤';


--
-- Name: COLUMN attendance_records.overtime_minutes; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.overtime_minutes IS '加班分钟';


--
-- Name: COLUMN attendance_records.remark; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.remark IS '备注';


--
-- Name: COLUMN attendance_records.created_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.created_at IS '创建时间';


--
-- Name: COLUMN attendance_records.updated_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_records.updated_at IS '更新时间';


--
-- Name: attendance_shifts; Type: TABLE; Schema: hr; Owner: -
--

CREATE TABLE hr.attendance_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    cross_day boolean DEFAULT false NOT NULL,
    late_grace_min integer DEFAULT 0 NOT NULL,
    early_grace_min integer DEFAULT 0 NOT NULL,
    ot_break_min integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN attendance_shifts.id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_shifts.id IS '编号';


--
-- Name: COLUMN attendance_shifts.name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_shifts.name IS '名称';


--
-- Name: COLUMN attendance_shifts.sort; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_shifts.sort IS '排序';


--
-- Name: COLUMN attendance_shifts.created_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_shifts.created_at IS '创建时间';


--
-- Name: COLUMN attendance_shifts.updated_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.attendance_shifts.updated_at IS '更新时间';


--
-- Name: employee_profiles; Type: TABLE; Schema: hr; Owner: -
--

CREATE TABLE hr.employee_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_id integer NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN employee_profiles.id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.employee_profiles.id IS '编号';


--
-- Name: COLUMN employee_profiles.created_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.employee_profiles.created_at IS '创建时间';


--
-- Name: COLUMN employee_profiles.updated_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.employee_profiles.updated_at IS '更新时间';


--
-- Name: payroll; Type: TABLE; Schema: hr; Owner: -
--

CREATE TABLE hr.payroll (
    id integer NOT NULL,
    archive_id integer,
    month character varying(7),
    total_amount numeric(10,2),
    status text DEFAULT '草稿'::text
);


--
-- Name: COLUMN payroll.id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.payroll.id IS '编号';


--
-- Name: COLUMN payroll.status; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.payroll.status IS '状态';


--
-- Name: payroll_id_seq; Type: SEQUENCE; Schema: hr; Owner: -
--

CREATE SEQUENCE hr.payroll_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_id_seq; Type: SEQUENCE OWNED BY; Schema: hr; Owner: -
--

ALTER SEQUENCE hr.payroll_id_seq OWNED BY hr.payroll.id;


--
-- Name: v_attendance_daily; Type: VIEW; Schema: hr; Owner: -
--

CREATE VIEW hr.v_attendance_daily AS
 SELECT id,
    att_date,
    person_type,
    employee_id,
    employee_name,
    employee_no,
    temp_name,
    temp_phone,
    dept_id,
    dept_name,
    shift_id,
    shift_name,
    shift_start_time,
    shift_end_time,
    shift_cross_day,
    late_grace_min,
    early_grace_min,
    ot_break_min,
    punch_times,
    late_flag,
    early_flag,
    leave_flag,
    absent_flag,
    overtime_minutes,
    remark,
    created_at,
    updated_at,
    array_to_string(punch_times, '  '::text) AS punch_text,
    COALESCE(array_length(punch_times, 1), 0) AS punch_count,
    ( SELECT min(t.t) AS min
           FROM unnest(r.punch_times) t(t)) AS first_punch,
    ( SELECT max(t.t) AS max
           FROM unnest(r.punch_times) t(t)) AS last_punch
   FROM hr.attendance_records r;


--
-- Name: COLUMN v_attendance_daily.id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.id IS '编号';


--
-- Name: COLUMN v_attendance_daily.employee_id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.employee_id IS '员工ID';


--
-- Name: COLUMN v_attendance_daily.employee_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.employee_name IS '员工姓名';


--
-- Name: COLUMN v_attendance_daily.employee_no; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.employee_no IS '工号';


--
-- Name: COLUMN v_attendance_daily.dept_id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.dept_id IS '部门ID';


--
-- Name: COLUMN v_attendance_daily.dept_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.dept_name IS '部门';


--
-- Name: COLUMN v_attendance_daily.remark; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.remark IS '备注';


--
-- Name: COLUMN v_attendance_daily.created_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.created_at IS '创建时间';


--
-- Name: COLUMN v_attendance_daily.updated_at; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_daily.updated_at IS '更新时间';


--
-- Name: v_attendance_monthly; Type: VIEW; Schema: hr; Owner: -
--

CREATE VIEW hr.v_attendance_monthly AS
 WITH base AS (
         SELECT (date_trunc('month'::text, (r.att_date)::timestamp with time zone))::date AS att_month,
            r.dept_name,
            r.person_type,
            r.employee_id,
            r.employee_name,
            r.employee_no,
            r.temp_name,
            r.temp_phone,
            count(*) AS total_days,
            sum((r.late_flag)::integer) AS late_days,
            sum((r.early_flag)::integer) AS early_days,
            sum((r.leave_flag)::integer) AS leave_days,
            sum((r.absent_flag)::integer) AS absent_days,
            sum(r.overtime_minutes) AS overtime_minutes
           FROM hr.attendance_records r
          GROUP BY ((date_trunc('month'::text, (r.att_date)::timestamp with time zone))::date), r.dept_name, r.person_type, r.employee_id, r.employee_name, r.employee_no, r.temp_name, r.temp_phone
        )
 SELECT base.att_month,
    base.dept_name,
    base.person_type,
    base.employee_id,
    base.employee_name,
    base.employee_no,
    base.temp_name,
    base.temp_phone,
    COALESCE((ovr.total_days)::bigint, base.total_days) AS total_days,
    COALESCE((ovr.late_days)::bigint, base.late_days) AS late_days,
    COALESCE((ovr.early_days)::bigint, base.early_days) AS early_days,
    COALESCE((ovr.leave_days)::bigint, base.leave_days) AS leave_days,
    COALESCE((ovr.absent_days)::bigint, base.absent_days) AS absent_days,
    COALESCE((ovr.overtime_minutes)::bigint, base.overtime_minutes) AS overtime_minutes,
    ovr.remark
   FROM (base
     LEFT JOIN hr.attendance_month_overrides ovr ON (((ovr.att_month = base.att_month) AND (ovr.person_key =
        CASE
            WHEN (base.person_type = 'employee'::text) THEN ('emp:'::text || (base.employee_id)::text)
            ELSE ('temp:'::text || COALESCE(base.temp_phone, base.temp_name, ''::text))
        END))));


--
-- Name: COLUMN v_attendance_monthly.dept_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_monthly.dept_name IS '部门';


--
-- Name: COLUMN v_attendance_monthly.employee_id; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_monthly.employee_id IS '员工ID';


--
-- Name: COLUMN v_attendance_monthly.employee_name; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_monthly.employee_name IS '员工姓名';


--
-- Name: COLUMN v_attendance_monthly.employee_no; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_monthly.employee_no IS '工号';


--
-- Name: COLUMN v_attendance_monthly.remark; Type: COMMENT; Schema: hr; Owner: -
--

COMMENT ON COLUMN hr.v_attendance_monthly.remark IS '备注';


--
-- Name: ai_business_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_business_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_link_id uuid,
    target_schema text,
    target_table text,
    target_record_id text,
    field_name text,
    old_value text,
    new_value text,
    correction_type text,
    affects_business_result boolean DEFAULT false NOT NULL,
    recalculation_status text,
    corrected_by text,
    corrected_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: client_log_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_log_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    event_type text NOT NULL,
    message text,
    stack text,
    device_id uuid,
    device_name text,
    user_id text,
    username text,
    role text,
    app_module text,
    route text,
    url text,
    request_url text,
    status_code integer,
    client_session_id text,
    trace_id text,
    ai_import_batch_id uuid,
    source_file_hash text,
    app_version text,
    webview_version text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_log_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_log_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_session_id text NOT NULL,
    device_id uuid,
    device_name text,
    user_id text,
    username text,
    app_version text,
    webview_version text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: collector_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collector_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_code text NOT NULL,
    device_name text NOT NULL,
    enterprise_id text NOT NULL,
    department_id text,
    default_user_id text,
    default_username text,
    default_role text,
    server_base_url text,
    device_token_hash text,
    binding_code_hash text,
    client_version text,
    webview_version text,
    status text DEFAULT 'pending'::text NOT NULL,
    last_seen_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collector_devices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'offline'::text, 'disabled'::text])))
);


--
-- Name: collector_watch_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collector_watch_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id uuid,
    folder_path text NOT NULL,
    folder_name text,
    default_user_id text,
    default_role text,
    enabled boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: debug_me; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.debug_me AS
 SELECT current_setting('request.jwt.claims'::text, true) AS full_json_data,
    ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text) AS extracted_name,
    CURRENT_USER AS db_role;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    leader_id integer,
    sort integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN departments.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.departments.id IS '编号';


--
-- Name: COLUMN departments.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.departments.name IS '名称';


--
-- Name: COLUMN departments.sort; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.departments.sort IS '排序';


--
-- Name: COLUMN departments.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.departments.status IS '状态';


--
-- Name: COLUMN departments.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.departments.created_at IS '创建时间';


--
-- Name: COLUMN departments.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.departments.updated_at IS '更新时间';


--
-- Name: document_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    device_id uuid,
    uploaded_by_user_id text,
    uploaded_by_username text,
    operator_source text,
    original_filename text NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    file_ext text,
    file_size bigint DEFAULT 0 NOT NULL,
    file_hash text NOT NULL,
    source_folder text,
    upload_source text,
    status text DEFAULT 'uploaded'::text NOT NULL,
    duplicate_of_asset_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_assets_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'duplicate'::text, 'queued'::text, 'parsing'::text, 'parsed'::text, 'classified'::text, 'importing'::text, 'imported'::text, 'partial_imported'::text, 'unrecognized'::text, 'failed'::text, 'archived'::text])))
);


--
-- Name: document_business_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_business_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    batch_id uuid,
    entry_plan_id uuid,
    target_schema text,
    target_table text,
    target_record_id text,
    target_module text,
    target_document_type text,
    target_app_id uuid,
    ai_confidence numeric(6,4),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_classification_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_classification_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    batch_id uuid,
    target_module text,
    target_document_type text,
    target_kind text,
    confidence numeric(6,4),
    reason text,
    candidates jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_classification_results_target_kind_check CHECK (((target_kind IS NULL) OR (target_kind = ANY (ARRAY['fixed_module_table'::text, 'data_app'::text]))))
);


--
-- Name: document_entry_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_entry_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    batch_id uuid,
    target_module text,
    target_document_type text,
    target_kind text,
    app_id uuid,
    app_name text,
    target_schema text,
    target_table text,
    mode text,
    document_count integer,
    line_count integer,
    confidence numeric(6,4),
    reason text,
    columns_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_entry_plans_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'importing'::text, 'imported'::text, 'partial'::text, 'failed'::text, 'skipped_duplicate'::text, 'archived_only'::text]))),
    CONSTRAINT document_entry_plans_target_kind_check CHECK (((target_kind IS NULL) OR (target_kind = ANY (ARRAY['fixed_module_table'::text, 'data_app'::text]))))
);


--
-- Name: document_flow_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_flow_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type text NOT NULL,
    source_doc_type text,
    source_doc_id uuid,
    source_doc_no text,
    target_doc_type text,
    target_doc_id uuid,
    target_doc_no text,
    reason text,
    actor_username text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_import_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_no text DEFAULT ((('DIB-'::text || to_char(now(), 'YYYYMMDDHH24MISSMS'::text)) || '-'::text) || substr((gen_random_uuid())::text, 1, 8)) NOT NULL,
    device_id uuid,
    uploaded_by_user_id text,
    source text,
    file_count integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    partial_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_import_batches_status_check CHECK ((status = ANY (ARRAY['created'::text, 'uploading'::text, 'uploaded'::text, 'parsing'::text, 'classifying'::text, 'importing'::text, 'completed'::text, 'partial'::text, 'failed'::text])))
);


--
-- Name: document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_doc_type text NOT NULL,
    source_doc_id uuid,
    source_doc_no text,
    target_doc_type text NOT NULL,
    target_doc_id uuid,
    target_doc_no text,
    relation_type text NOT NULL,
    quantity numeric(14,2),
    amount numeric(14,2),
    status text DEFAULT 'active'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reversed_by text,
    reversed_at timestamp with time zone,
    reverse_reason text
);


--
-- Name: document_parse_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_parse_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    batch_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    parser_type text,
    retry_count integer DEFAULT 0 NOT NULL,
    last_error text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_parse_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'partial'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: document_parse_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_parse_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    parse_job_id uuid,
    text_content text,
    tables jsonb DEFAULT '[]'::jsonb NOT NULL,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    ocr_result jsonb DEFAULT '{}'::jsonb NOT NULL,
    image_descriptions jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_unmapped_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_unmapped_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    batch_id uuid,
    entry_plan_id uuid,
    target_schema text,
    target_table text,
    target_record_id text,
    name text NOT NULL,
    value text,
    confidence numeric(6,4),
    source text,
    write_location text DEFAULT 'remarks'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_unmapped_fields_write_location_check CHECK ((write_location = ANY (ARRAY['column'::text, 'properties'::text, 'remarks'::text, 'ignore'::text])))
);


--
-- Name: document_upload_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_upload_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    chunk_size integer NOT NULL,
    chunk_hash text,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_upload_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_upload_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id uuid,
    file_hash text NOT NULL,
    original_filename text NOT NULL,
    mime_type text,
    file_size bigint NOT NULL,
    chunk_size integer NOT NULL,
    total_chunks integer NOT NULL,
    uploaded_chunks integer DEFAULT 0 NOT NULL,
    upload_source text,
    status text DEFAULT 'initialized'::text NOT NULL,
    storage_path text,
    last_error text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT document_upload_sessions_status_check CHECK ((status = ANY (ARRAY['initialized'::text, 'uploading'::text, 'assembled'::text, 'completed'::text, 'duplicate'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    name text NOT NULL,
    "position" text,
    department text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: COLUMN employees.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employees.id IS '编号';


--
-- Name: COLUMN employees.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employees.name IS '名称';


--
-- Name: COLUMN employees."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employees."position" IS '岗位';


--
-- Name: COLUMN employees.department; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employees.department IS '部门';


--
-- Name: COLUMN employees.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employees.created_at IS '创建时间';


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: equipment_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_no text NOT NULL,
    asset_name text NOT NULL,
    asset_type text,
    location_name text,
    asset_level text DEFAULT '一般'::text NOT NULL,
    run_status text DEFAULT '运行'::text NOT NULL,
    owner_dept text,
    owner_name text,
    commission_date date,
    last_maint_date date,
    next_maint_date date,
    health_score numeric(14,2) DEFAULT 100 NOT NULL,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_assets_health_check CHECK (((health_score >= (0)::numeric) AND (health_score <= (100)::numeric))),
    CONSTRAINT equipment_assets_level_check CHECK ((asset_level = ANY (ARRAY['关键'::text, '重要'::text, '一般'::text]))),
    CONSTRAINT equipment_assets_status_check CHECK ((run_status = ANY (ARRAY['运行'::text, '停机'::text, '维修中'::text, '待验收'::text, '报废'::text])))
);


--
-- Name: equipment_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    check_no text NOT NULL,
    asset_id uuid,
    asset_no text,
    asset_name text NOT NULL,
    check_type text DEFAULT '日常巡检'::text NOT NULL,
    check_item_count numeric(14,2) DEFAULT 0 NOT NULL,
    abnormal_count numeric(14,2) DEFAULT 0 NOT NULL,
    check_result text DEFAULT '待处理'::text NOT NULL,
    checker text,
    check_date date DEFAULT CURRENT_DATE NOT NULL,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_checks_count_check CHECK (((check_item_count >= (0)::numeric) AND (abnormal_count >= (0)::numeric) AND (abnormal_count <= check_item_count))),
    CONSTRAINT equipment_checks_result_check CHECK ((check_result = ANY (ARRAY['待处理'::text, '正常'::text, '异常'::text, '停机'::text]))),
    CONSTRAINT equipment_checks_type_check CHECK ((check_type = ANY (ARRAY['班前点检'::text, '日常巡检'::text, '专项点检'::text])))
);


--
-- Name: equipment_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_no text NOT NULL,
    asset_id uuid,
    asset_no text,
    asset_name text NOT NULL,
    source_type text,
    issue_desc text NOT NULL,
    issue_level text DEFAULT '一般'::text NOT NULL,
    owner_dept text,
    owner_name text,
    occurred_date date DEFAULT CURRENT_DATE NOT NULL,
    deadline date,
    issue_status text DEFAULT '待处理'::text NOT NULL,
    repair_action text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_issues_level_check CHECK ((issue_level = ANY (ARRAY['一般'::text, '严重'::text, '紧急'::text]))),
    CONSTRAINT equipment_issues_status_check CHECK ((issue_status = ANY (ARRAY['待处理'::text, '处理中'::text, '待验收'::text, '已关闭'::text])))
);


--
-- Name: equipment_maintenance_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_maintenance_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_no text NOT NULL,
    plan_name text NOT NULL,
    asset_scope text,
    plan_type text DEFAULT '月度保养'::text NOT NULL,
    cycle_name text,
    start_date date,
    next_execute_date date,
    owner_name text,
    plan_status text DEFAULT '计划中'::text NOT NULL,
    completion_rate numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_plans_completion_check CHECK (((completion_rate >= (0)::numeric) AND (completion_rate <= (100)::numeric))),
    CONSTRAINT equipment_plans_status_check CHECK ((plan_status = ANY (ARRAY['计划中'::text, '执行中'::text, '已完成'::text, '已暂停'::text]))),
    CONSTRAINT equipment_plans_type_check CHECK ((plan_type = ANY (ARRAY['月度保养'::text, '季度保养'::text, '年度大修'::text, '专项巡检'::text])))
);


--
-- Name: equipment_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    standard_no text NOT NULL,
    standard_name text NOT NULL,
    asset_type text,
    version text DEFAULT 'V1'::text NOT NULL,
    effective_date date,
    owner_name text,
    standard_status text DEFAULT '草稿'::text NOT NULL,
    key_items text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_standards_status_check CHECK ((standard_status = ANY (ARRAY['草稿'::text, '生效'::text, '修订中'::text, '作废'::text])))
);


--
-- Name: equipment_work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_no text NOT NULL,
    issue_id uuid,
    issue_no text,
    asset_id uuid,
    asset_no text,
    asset_name text NOT NULL,
    work_type text DEFAULT '故障维修'::text NOT NULL,
    task_desc text NOT NULL,
    maintainer text,
    plan_date date,
    finish_date date,
    downtime_hours numeric(14,2) DEFAULT 0 NOT NULL,
    work_status text DEFAULT '待派工'::text NOT NULL,
    acceptance_result text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_work_orders_downtime_check CHECK ((downtime_hours >= (0)::numeric)),
    CONSTRAINT equipment_work_orders_status_check CHECK ((work_status = ANY (ARRAY['待派工'::text, '处理中'::text, '待验收'::text, '已完成'::text]))),
    CONSTRAINT equipment_work_orders_type_check CHECK ((work_type = ANY (ARRAY['故障维修'::text, '预防保养'::text, '备件更换'::text, '校准验收'::text])))
);


--
-- Name: field_label_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_label_overrides (
    module text NOT NULL,
    field_code text NOT NULL,
    field_label text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN field_label_overrides.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.field_label_overrides.updated_at IS '更新时间';


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    content_base64 text NOT NULL,
    sha256 text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT files_check CHECK ((octet_length(decode(content_base64, 'base64'::text)) = size_bytes)),
    CONSTRAINT files_size_bytes_check CHECK (((size_bytes > 0) AND (size_bytes <= 20971520)))
);


--
-- Name: COLUMN files.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.files.id IS '编号';


--
-- Name: COLUMN files.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.files.created_at IS '创建时间';


--
-- Name: COLUMN files.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.files.updated_at IS '更新时间';


--
-- Name: form_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id text NOT NULL,
    row_id text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN form_values.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_values.id IS '编号';


--
-- Name: COLUMN form_values.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_values.created_at IS '创建时间';


--
-- Name: COLUMN form_values.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_values.updated_at IS '更新时间';


--
-- Name: ontology_column_semantics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ontology_column_semantics (
    table_schema text NOT NULL,
    table_name text NOT NULL,
    column_name text NOT NULL,
    semantic_class text DEFAULT 'business_attribute'::text NOT NULL,
    semantic_name text NOT NULL,
    semantic_description text DEFAULT ''::text NOT NULL,
    data_type text DEFAULT 'text'::text NOT NULL,
    ui_type text DEFAULT 'text'::text NOT NULL,
    is_sensitive boolean DEFAULT false NOT NULL,
    source text DEFAULT 'rule_fallback'::text NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ontology_inference_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ontology_inference_rules (
    rule_code text NOT NULL,
    rule_name text NOT NULL,
    inference_stage text DEFAULT 'rule'::text NOT NULL,
    rule_kind text DEFAULT 'sql'::text NOT NULL,
    predicate text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ontology_inference_rules_kind_check CHECK ((rule_kind = ANY (ARRAY['sql'::text, 'recursive_sql'::text, 'diagnostic'::text]))),
    CONSTRAINT ontology_inference_rules_stage_check CHECK ((inference_stage = ANY (ARRAY['seed'::text, 'rule'::text, 'closure'::text, 'diagnostic'::text])))
);


--
-- Name: ontology_inferred_facts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ontology_inferred_facts (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    fact_key text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    subject_label text DEFAULT ''::text NOT NULL,
    predicate text NOT NULL,
    object_type text NOT NULL,
    object_id text NOT NULL,
    object_label text DEFAULT ''::text NOT NULL,
    fact_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    inference_rule text,
    inference_depth integer DEFAULT 0 NOT NULL,
    confidence numeric(5,4) DEFAULT 1.0 NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_inferred boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ontology_inferred_facts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ontology_inferred_facts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ontology_inferred_facts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ontology_inferred_facts_id_seq OWNED BY public.ontology_inferred_facts.id;


--
-- Name: ontology_reasoning_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ontology_reasoning_runs (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    max_depth integer DEFAULT 3 NOT NULL,
    facts_inserted integer DEFAULT 0 NOT NULL,
    error_message text,
    created_by text DEFAULT CURRENT_USER NOT NULL,
    CONSTRAINT ontology_reasoning_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    module text,
    action text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN permissions.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.permissions.id IS '编号';


--
-- Name: COLUMN permissions.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.permissions.code IS '编码';


--
-- Name: COLUMN permissions.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.permissions.name IS '名称';


--
-- Name: COLUMN permissions.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.permissions.created_at IS '创建时间';


--
-- Name: COLUMN permissions.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.permissions.updated_at IS '更新时间';


--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    dept_id uuid,
    level text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN positions.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.positions.id IS '编号';


--
-- Name: COLUMN positions.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.positions.name IS '名称';


--
-- Name: COLUMN positions.dept_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.positions.dept_id IS '部门ID';


--
-- Name: COLUMN positions.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.positions.status IS '状态';


--
-- Name: COLUMN positions.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.positions.created_at IS '创建时间';


--
-- Name: COLUMN positions.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.positions.updated_at IS '更新时间';


--
-- Name: purchase_arrivals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_arrivals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    arrival_no text NOT NULL,
    order_id uuid,
    order_no text,
    supplier_id uuid,
    supplier_name text NOT NULL,
    material_name text NOT NULL,
    arrival_quantity numeric(14,2) DEFAULT 0 NOT NULL,
    accepted_quantity numeric(14,2) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    arrival_date date DEFAULT CURRENT_DATE NOT NULL,
    iqc_status text DEFAULT '待检'::text NOT NULL,
    inbound_no text,
    arrival_status text DEFAULT '待到货'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_demands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_demands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demand_no text NOT NULL,
    material_no text,
    material_name text NOT NULL,
    quantity numeric(14,2) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    required_date date,
    source_dept text,
    requester_name text,
    preferred_supplier text,
    demand_status text DEFAULT '草稿'::text NOT NULL,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no text NOT NULL,
    demand_id uuid,
    source_demand_no text,
    supplier_id uuid,
    supplier_name text NOT NULL,
    material_name text NOT NULL,
    quantity numeric(14,2) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_arrival_date date,
    buyer_name text,
    order_status text DEFAULT '草稿'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_no text NOT NULL,
    name text NOT NULL,
    level text DEFAULT '普通'::text NOT NULL,
    contact_name text,
    contact_phone text,
    category text,
    payment_terms text,
    lead_time_days numeric(10,2) DEFAULT 0 NOT NULL,
    buyer_name text,
    supplier_status text DEFAULT '合作中'::text NOT NULL,
    last_review_at date,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quality_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_no text NOT NULL,
    audit_type text DEFAULT '过程审核'::text NOT NULL,
    audit_scope text NOT NULL,
    plan_date date,
    auditor text,
    finding_count numeric(14,2) DEFAULT 0 NOT NULL,
    audit_status text DEFAULT '计划中'::text NOT NULL,
    conclusion text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quality_audits_finding_count_check CHECK ((finding_count >= (0)::numeric)),
    CONSTRAINT quality_audits_status_check CHECK ((audit_status = ANY (ARRAY['计划中'::text, '执行中'::text, '待整改'::text, '已关闭'::text]))),
    CONSTRAINT quality_audits_type_check CHECK ((audit_type = ANY (ARRAY['过程审核'::text, '体系审核'::text, '供应商审核'::text, '客户审核'::text])))
);


--
-- Name: quality_corrective_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_corrective_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_no text NOT NULL,
    ncr_id uuid,
    ncr_doc_no text,
    action_type text DEFAULT '纠正'::text NOT NULL,
    task_desc text NOT NULL,
    owner_dept text,
    owner_name text,
    due_date date,
    action_status text DEFAULT '待处理'::text NOT NULL,
    verify_owner text,
    verify_date date,
    verify_result text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quality_actions_status_check CHECK ((action_status = ANY (ARRAY['待处理'::text, '处理中'::text, '待验证'::text, '已完成'::text]))),
    CONSTRAINT quality_actions_type_check CHECK ((action_type = ANY (ARRAY['纠正'::text, '预防'::text, '验证'::text])))
);


--
-- Name: quality_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doc_no text NOT NULL,
    inspection_type text DEFAULT '来料检验'::text NOT NULL,
    source_doc_no text,
    item_code text,
    item_name text NOT NULL,
    source_name text,
    batch_no text,
    sample_qty numeric(14,2) DEFAULT 0 NOT NULL,
    defect_qty numeric(14,2) DEFAULT 0 NOT NULL,
    result text DEFAULT '待判定'::text NOT NULL,
    inspector text,
    inspection_date date DEFAULT CURRENT_DATE NOT NULL,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quality_inspections_qty_check CHECK (((sample_qty >= (0)::numeric) AND (defect_qty >= (0)::numeric) AND (defect_qty <= sample_qty))),
    CONSTRAINT quality_inspections_result_check CHECK ((result = ANY (ARRAY['待判定'::text, '合格'::text, '让步接收'::text, '不合格'::text]))),
    CONSTRAINT quality_inspections_type_check CHECK ((inspection_type = ANY (ARRAY['来料检验'::text, '过程巡检'::text, '首件检验'::text, '成品抽检'::text])))
);


--
-- Name: quality_ncrs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_ncrs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doc_no text NOT NULL,
    inspection_id uuid,
    source_type text DEFAULT '检验异常'::text NOT NULL,
    source_doc_no text,
    issue_desc text NOT NULL,
    severity text DEFAULT '一般'::text NOT NULL,
    owner_dept text,
    owner_name text,
    deadline date,
    ncr_status text DEFAULT '待整改'::text NOT NULL,
    corrective_action text,
    verification_result text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quality_ncrs_severity_check CHECK ((severity = ANY (ARRAY['一般'::text, '严重'::text, '关键'::text]))),
    CONSTRAINT quality_ncrs_status_check CHECK ((ncr_status = ANY (ARRAY['待整改'::text, '整改中'::text, '待验证'::text, '已关闭'::text])))
);


--
-- Name: quality_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    standard_no text NOT NULL,
    standard_name text NOT NULL,
    item_category text,
    version text DEFAULT 'V1'::text NOT NULL,
    effective_date date,
    owner_name text,
    standard_status text DEFAULT '草稿'::text NOT NULL,
    key_metrics text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quality_standards_status_check CHECK ((standard_status = ANY (ARRAY['草稿'::text, '生效'::text, '修订中'::text, '作废'::text])))
);


--
-- Name: raw_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_materials (
    id integer NOT NULL,
    batch_no text NOT NULL,
    name text NOT NULL,
    category text,
    weight_kg numeric(10,2),
    entry_date date DEFAULT CURRENT_DATE,
    created_by text,
    properties jsonb DEFAULT '{}'::jsonb,
    version integer DEFAULT 1,
    updated_at timestamp without time zone DEFAULT now(),
    dept_id uuid
);


--
-- Name: COLUMN raw_materials.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.id IS '编号';


--
-- Name: COLUMN raw_materials.batch_no; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.batch_no IS '批次号';


--
-- Name: COLUMN raw_materials.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.name IS '物料名称';


--
-- Name: COLUMN raw_materials.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.category IS '物料分类';


--
-- Name: COLUMN raw_materials.weight_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.weight_kg IS '重量(kg)';


--
-- Name: COLUMN raw_materials.entry_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.entry_date IS '入库日期';


--
-- Name: COLUMN raw_materials.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.created_by IS '创建人';


--
-- Name: COLUMN raw_materials.properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.properties IS '????';


--
-- Name: COLUMN raw_materials.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.version IS '??';


--
-- Name: COLUMN raw_materials.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.updated_at IS '????';


--
-- Name: COLUMN raw_materials.dept_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_materials.dept_id IS '??ID';


--
-- Name: raw_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raw_materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: raw_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.raw_materials_id_seq OWNED BY public.raw_materials.id;


--
-- Name: role_data_scopes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_data_scopes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    module text NOT NULL,
    scope_type text NOT NULL,
    dept_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_data_scopes_scope_chk CHECK ((scope_type = ANY (ARRAY['self'::text, 'dept'::text, 'dept_tree'::text, 'all'::text])))
);


--
-- Name: COLUMN role_data_scopes.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_data_scopes.id IS '编号';


--
-- Name: COLUMN role_data_scopes.role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_data_scopes.role_id IS '角色';


--
-- Name: COLUMN role_data_scopes.dept_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_data_scopes.dept_id IS '部门ID';


--
-- Name: COLUMN role_data_scopes.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_data_scopes.created_at IS '创建时间';


--
-- Name: COLUMN role_data_scopes.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_data_scopes.updated_at IS '更新时间';


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN role_permissions.role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_permissions.role_id IS '角色';


--
-- Name: COLUMN role_permissions.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_permissions.created_at IS '创建时间';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort integer DEFAULT 100,
    dept_id uuid
);


--
-- Name: COLUMN roles.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.id IS '编号';


--
-- Name: COLUMN roles.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.code IS '编码';


--
-- Name: COLUMN roles.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.name IS '名称';


--
-- Name: COLUMN roles.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.description IS '说明';


--
-- Name: COLUMN roles.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.created_at IS '创建时间';


--
-- Name: COLUMN roles.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.updated_at IS '更新时间';


--
-- Name: COLUMN roles.sort; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.sort IS '排序';


--
-- Name: sales_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_no text NOT NULL,
    name text NOT NULL,
    level text DEFAULT '普通客户'::text NOT NULL,
    contact_name text,
    contact_phone text,
    region text,
    owner_name text,
    customer_status text DEFAULT '跟进中'::text NOT NULL,
    credit_limit numeric(14,2) DEFAULT 0 NOT NULL,
    receivable_balance numeric(14,2) DEFAULT 0 NOT NULL,
    last_follow_up_at date,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follow_no text NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    contact_name text,
    follow_date date DEFAULT CURRENT_DATE NOT NULL,
    follow_type text DEFAULT '电话沟通'::text NOT NULL,
    follow_result text DEFAULT '待跟进'::text NOT NULL,
    next_follow_at date,
    owner_name text,
    follow_content text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    opportunity_no text NOT NULL,
    opportunity_name text NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    expected_amount numeric(14,2) DEFAULT 0 NOT NULL,
    stage text DEFAULT '初步接洽'::text NOT NULL,
    probability numeric(5,2) DEFAULT 20 NOT NULL,
    expected_close_date date,
    owner_name text,
    next_action text,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no text NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    product_name text NOT NULL,
    quantity numeric(14,2) DEFAULT 0 NOT NULL,
    unit text DEFAULT '箱'::text NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    delivery_date date,
    order_status text DEFAULT '草稿'::text NOT NULL,
    owner_name text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    product_material_id integer
);


--
-- Name: sales_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_no text NOT NULL,
    order_id uuid,
    order_no text,
    customer_id uuid,
    customer_name text NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method text DEFAULT '银行转账'::text NOT NULL,
    verify_status text DEFAULT '待核销'::text NOT NULL,
    handler_name text,
    status text DEFAULT 'active'::text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: smart_bi_action_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_bi_action_items (
    id integer NOT NULL,
    action_no text DEFAULT ((('SBI-'::text || to_char(now(), 'YYYYMMDDHH24MISS'::text)) || '-'::text) || upper(substr(md5((random())::text), 1, 4))) NOT NULL,
    title text NOT NULL,
    domain text,
    risk_level text,
    owner_role text,
    owner_name text,
    due_at timestamp with time zone,
    status text DEFAULT '待发起'::text NOT NULL,
    source_session_id text,
    source_message_time bigint,
    source_action_index integer,
    source_question text,
    report_excerpt text,
    suggestion jsonb DEFAULT '{}'::jsonb NOT NULL,
    workflow_definition_id integer,
    workflow_instance_id integer,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    owner_username text
);


--
-- Name: smart_bi_action_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.smart_bi_action_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: smart_bi_action_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.smart_bi_action_items_id_seq OWNED BY public.smart_bi_action_items.id;


--
-- Name: sop_learning_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sop_learning_records (
    id bigint NOT NULL,
    username text NOT NULL,
    guide_id text NOT NULL,
    guide_title text,
    guide_category text,
    sop_role text,
    module_name text,
    route_path text,
    step_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'seen'::text NOT NULL,
    seen_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sop_learning_records_status_chk CHECK ((status = ANY (ARRAY['seen'::text, 'completed'::text])))
);


--
-- Name: TABLE sop_learning_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sop_learning_records IS 'SOP学习与完成记录';


--
-- Name: COLUMN sop_learning_records.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.username IS '用户名';


--
-- Name: COLUMN sop_learning_records.guide_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.guide_id IS 'SOP指引ID';


--
-- Name: COLUMN sop_learning_records.guide_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.guide_title IS 'SOP标题';


--
-- Name: COLUMN sop_learning_records.guide_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.guide_category IS 'SOP分类';


--
-- Name: COLUMN sop_learning_records.sop_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.sop_role IS 'SOP岗位';


--
-- Name: COLUMN sop_learning_records.module_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.module_name IS '模块名称';


--
-- Name: COLUMN sop_learning_records.route_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.route_path IS '页面路径';


--
-- Name: COLUMN sop_learning_records.step_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.step_count IS '步骤数';


--
-- Name: COLUMN sop_learning_records.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.status IS '学习状态';


--
-- Name: COLUMN sop_learning_records.seen_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.seen_at IS '已读时间';


--
-- Name: COLUMN sop_learning_records.completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sop_learning_records.completed_at IS '完成时间';


--
-- Name: sop_learning_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sop_learning_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sop_learning_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sop_learning_records_id_seq OWNED BY public.sop_learning_records.id;


--
-- Name: sys_dict_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sys_dict_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dict_id uuid NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN sys_dict_items.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dict_items.id IS '编号';


--
-- Name: COLUMN sys_dict_items.sort; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dict_items.sort IS '排序';


--
-- Name: COLUMN sys_dict_items.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dict_items.created_at IS '创建时间';


--
-- Name: COLUMN sys_dict_items.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dict_items.updated_at IS '更新时间';


--
-- Name: sys_dicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sys_dicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dict_key text NOT NULL,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN sys_dicts.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dicts.id IS '编号';


--
-- Name: COLUMN sys_dicts.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dicts.name IS '名称';


--
-- Name: COLUMN sys_dicts.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dicts.description IS '说明';


--
-- Name: COLUMN sys_dicts.sort; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dicts.sort IS '排序';


--
-- Name: COLUMN sys_dicts.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dicts.created_at IS '创建时间';


--
-- Name: COLUMN sys_dicts.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_dicts.updated_at IS '更新时间';


--
-- Name: sys_field_acl; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sys_field_acl (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    module text NOT NULL,
    field_code text NOT NULL,
    can_view boolean DEFAULT true NOT NULL,
    can_edit boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN sys_field_acl.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_field_acl.id IS '编号';


--
-- Name: COLUMN sys_field_acl.role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_field_acl.role_id IS '角色';


--
-- Name: COLUMN sys_field_acl.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_field_acl.created_at IS '创建时间';


--
-- Name: COLUMN sys_field_acl.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_field_acl.updated_at IS '更新时间';


--
-- Name: sys_grid_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sys_grid_configs (
    view_id text NOT NULL,
    summary_config jsonb,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN sys_grid_configs.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sys_grid_configs.updated_at IS '更新时间';


--
-- Name: system_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_configs (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text
);


--
-- Name: COLUMN system_configs.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_configs.description IS '说明';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN user_roles.role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_roles.role_id IS '角色';


--
-- Name: COLUMN user_roles.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_roles.created_at IS '创建时间';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'web_user'::text NOT NULL,
    avatar text,
    permissions text[],
    full_name text,
    phone text,
    email text,
    dept_id uuid,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    position_id uuid,
    sop_role text
);


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id IS '编号';


--
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.username IS '用户名';


--
-- Name: COLUMN users.password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.password IS '密码';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.role IS '角色';


--
-- Name: COLUMN users.avatar; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.avatar IS '头像';


--
-- Name: COLUMN users.permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.permissions IS '权限集合';


--
-- Name: COLUMN users.full_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.full_name IS '姓名';


--
-- Name: COLUMN users.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.phone IS '手机号';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.email IS '邮箱';


--
-- Name: COLUMN users.dept_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.dept_id IS '部门ID';


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.status IS '状态';


--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.created_at IS '创建时间';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.updated_at IS '更新时间';


--
-- Name: COLUMN users.position_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.position_id IS '岗位ID';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: v_app_form_ontology; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_app_form_ontology AS
 WITH app_base AS (
         SELECT a.id AS app_id,
            (a.name)::text AS app_name,
            COALESCE(a.description, ''::text) AS app_description,
            (COALESCE(a.app_type, ''::character varying))::text AS app_type,
            (COALESCE(a.status, ''::character varying))::text AS status,
            (COALESCE(a.icon, ''::character varying))::text AS icon,
            (COALESCE(a.version, ''::character varying))::text AS version,
            a.category_id,
            COALESCE(a.config, '{}'::jsonb) AS config,
            NULLIF(TRIM(BOTH FROM COALESCE((a.config ->> 'table'::text), ''::text)), ''::text) AS raw_table_ref,
            COALESCE(NULLIF(TRIM(BOTH FROM (a.config ->> 'aclModule'::text)), ''::text), ('app_'::text || replace((a.id)::text, '-'::text, ''::text))) AS acl_module,
            NULLIF(TRIM(BOTH FROM (a.config ->> 'perm'::text)), ''::text) AS permission_code,
            COALESCE(NULLIF(TRIM(BOTH FROM (a.config ->> 'permission_mode'::text)), ''::text), 'compat'::text) AS permission_mode,
            COALESCE(NULLIF(TRIM(BOTH FROM (a.config ->> 'semantics_mode'::text)), ''::text), 'ai_defined'::text) AS semantics_mode,
            a.created_at,
            a.updated_at
           FROM app_center.apps a
        ), normalized AS (
         SELECT ab.app_id,
            ab.app_name,
            ab.app_description,
            ab.app_type,
            ab.status,
            ab.icon,
            ab.version,
            ab.category_id,
            ab.config,
            ab.raw_table_ref,
            ab.acl_module,
            ab.permission_code,
            ab.permission_mode,
            ab.semantics_mode,
            ab.created_at,
            ab.updated_at,
                CASE
                    WHEN (ab.raw_table_ref ~~ '%.%'::text) THEN split_part(ab.raw_table_ref, '.'::text, 1)
                    WHEN ((ab.raw_table_ref IS NOT NULL) AND (ab.app_type = 'data'::text)) THEN 'app_data'::text
                    ELSE NULL::text
                END AS table_schema,
                CASE
                    WHEN (ab.raw_table_ref ~~ '%.%'::text) THEN split_part(ab.raw_table_ref, '.'::text, 2)
                    WHEN ((ab.raw_table_ref IS NOT NULL) AND (ab.app_type = 'data'::text)) THEN ab.raw_table_ref
                    ELSE NULL::text
                END AS table_name
           FROM app_base ab
        )
 SELECT row_number() OVER (ORDER BY n.updated_at DESC, n.app_id) AS id,
    n.app_id,
    n.app_name,
    n.app_description,
    n.app_type,
    n.status,
    n.icon,
    n.version,
    n.category_id,
    n.acl_module,
    n.permission_code,
    p.name AS permission_name,
    n.permission_mode,
    n.semantics_mode,
    pr.route_path,
    n.table_schema,
    n.table_name,
        CASE
            WHEN ((n.table_schema IS NOT NULL) AND (n.table_name IS NOT NULL)) THEN ((n.table_schema || '.'::text) || n.table_name)
            ELSE NULL::text
        END AS qualified_table,
    COALESCE(ots.semantic_domain,
        CASE
            WHEN (n.app_type = 'workflow'::text) THEN 'workflow'::text
            WHEN (n.app_type = 'data'::text) THEN 'app_data'::text
            WHEN (n.app_type = 'custom'::text) THEN 'app_center'::text
            ELSE 'app_center'::text
        END) AS semantic_domain,
        CASE
            WHEN (n.app_type = 'workflow'::text) THEN 'workflow_app'::text
            WHEN (n.app_type = 'data'::text) THEN 'dynamic_data_app'::text
            WHEN (n.app_type = 'custom'::text) THEN 'custom_app'::text
            ELSE 'app_form'::text
        END AS semantic_class,
    n.app_name AS semantic_name,
    COALESCE(NULLIF(n.app_description, ''::text), ots.semantic_description, n.app_name) AS semantic_description,
    ots.semantic_class AS table_semantic_class,
    ots.semantic_name AS table_semantic_name,
    COALESCE(ots.is_business, (n.app_type = ANY (ARRAY['workflow'::text, 'data'::text]))) AS is_business,
    wpp.permission_mode AS workflow_policy_mode,
    wpp.legacy_fallback_enabled,
    (jsonb_build_array('app_center', 'business_form', ('app_type:'::text || COALESCE(NULLIF(n.app_type, ''::text), 'unknown'::text)), ('semantics:'::text || n.semantics_mode), (n.app_id)::text) || COALESCE(ots.tags, '[]'::jsonb)) AS tags,
    n.created_at,
    n.updated_at
   FROM ((((normalized n
     LEFT JOIN public.ontology_table_semantics ots ON (((ots.table_schema = n.table_schema) AND (ots.table_name = n.table_name) AND (ots.is_active = true))))
     LEFT JOIN public.permissions p ON ((p.code = n.permission_code)))
     LEFT JOIN app_center.workflow_permission_policies wpp ON ((wpp.workflow_app_id = n.app_id)))
     LEFT JOIN LATERAL ( SELECT r.route_path
           FROM app_center.published_routes r
          WHERE ((r.app_id = n.app_id) AND (r.is_active = true))
          ORDER BY r.route_path
         LIMIT 1) pr ON (true));


--
-- Name: VIEW v_app_form_ontology; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_app_form_ontology IS 'Ontology projection for App Center business forms and workflow/data apps';


--
-- Name: bom_items; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.bom_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_id uuid NOT NULL,
    line_no integer DEFAULT 10 NOT NULL,
    component_material_id integer NOT NULL,
    qty numeric(18,6) NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    loss_rate numeric(9,6) DEFAULT 0 NOT NULL,
    issue_method text DEFAULT '按需领料'::text NOT NULL,
    substitute_group text,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bom_items_issue_method_check CHECK ((issue_method = ANY (ARRAY['按需领料'::text, '倒冲领料'::text, '不发料'::text]))),
    CONSTRAINT bom_items_loss_rate_range CHECK (((loss_rate >= (0)::numeric) AND (loss_rate < (1)::numeric))),
    CONSTRAINT bom_items_qty_positive CHECK ((qty > (0)::numeric))
);


--
-- Name: TABLE bom_items; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.bom_items IS 'BOM明细表：定义父项BOM下的子件、用量、损耗和发料方式';


--
-- Name: boms; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.boms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_no text NOT NULL,
    bom_name text NOT NULL,
    parent_material_id integer NOT NULL,
    version text DEFAULT 'V1'::text NOT NULL,
    base_qty numeric(18,6) DEFAULT 1 NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    bom_type text DEFAULT '生产BOM'::text NOT NULL,
    status text DEFAULT '草稿'::text NOT NULL,
    effective_from date,
    effective_to date,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT boms_base_qty_positive CHECK ((base_qty > (0)::numeric)),
    CONSTRAINT boms_status_check CHECK ((status = ANY (ARRAY['草稿'::text, '启用'::text, '停用'::text, '作废'::text]))),
    CONSTRAINT boms_type_check CHECK ((bom_type = ANY (ARRAY['生产BOM'::text, '包装BOM'::text, '研发BOM'::text, '委外BOM'::text])))
);


--
-- Name: TABLE boms; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.boms IS 'BOM主表：定义成品/半成品与版本、状态、基准数量';


--
-- Name: v_bom_explosion; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_bom_explosion AS
 WITH RECURSIVE bom_tree AS (
         SELECT b.id AS root_bom_id,
            b.bom_no AS root_bom_no,
            b.parent_material_id AS root_material_id,
            pm.batch_no AS root_material_code,
            pm.name AS root_material_name,
            i.component_material_id,
            cm.batch_no AS component_material_code,
            cm.name AS component_material_name,
            i.qty,
            i.unit,
            i.loss_rate,
            (((i.qty * ((1)::numeric + i.loss_rate)) / NULLIF(b.base_qty, (0)::numeric)))::numeric(18,6) AS required_qty,
            1 AS level,
            ARRAY[b.parent_material_id, i.component_material_id] AS material_path
           FROM (((scm.boms b
             JOIN scm.bom_items i ON ((i.bom_id = b.id)))
             JOIN public.raw_materials pm ON ((pm.id = b.parent_material_id)))
             JOIN public.raw_materials cm ON ((cm.id = i.component_material_id)))
          WHERE (b.status = '启用'::text)
        UNION ALL
         SELECT t.root_bom_id,
            t.root_bom_no,
            t.root_material_id,
            t.root_material_code,
            t.root_material_name,
            i.component_material_id,
            cm.batch_no,
            cm.name,
            i.qty,
            i.unit,
            i.loss_rate,
            ((((t.required_qty * i.qty) * ((1)::numeric + i.loss_rate)) / NULLIF(child_bom.base_qty, (0)::numeric)))::numeric(18,6) AS "numeric",
            (t.level + 1),
            (t.material_path || i.component_material_id)
           FROM (((bom_tree t
             JOIN scm.boms child_bom ON (((child_bom.parent_material_id = t.component_material_id) AND (child_bom.status = '启用'::text))))
             JOIN scm.bom_items i ON ((i.bom_id = child_bom.id)))
             JOIN public.raw_materials cm ON ((cm.id = i.component_material_id)))
          WHERE ((t.level < 8) AND (NOT (i.component_material_id = ANY (t.material_path))))
        )
 SELECT root_bom_id,
    root_bom_no,
    root_material_id,
    root_material_code,
    root_material_name,
    component_material_id,
    component_material_code,
    component_material_name,
    qty,
    unit,
    loss_rate,
    required_qty,
    level,
    material_path
   FROM bom_tree;


--
-- Name: VIEW v_bom_explosion; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_bom_explosion IS '启用BOM多层展开视图，用于生产、采购、成本等模块';


--
-- Name: v_bom_explosion; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_bom_explosion AS
 SELECT root_bom_id,
    root_bom_no,
    root_material_id,
    root_material_code,
    root_material_name,
    component_material_id,
    component_material_code,
    component_material_name,
    qty,
    unit,
    loss_rate,
    required_qty,
    level,
    material_path
   FROM scm.v_bom_explosion;


--
-- Name: VIEW v_bom_explosion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_bom_explosion IS 'Compatibility view for BOM explosion API requests without an explicit PostgREST schema profile; source: scm.v_bom_explosion';


--
-- Name: v_bom_items; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_bom_items AS
 SELECT i.id,
    i.bom_id,
    b.bom_no,
    b.bom_name,
    b.parent_material_id,
    pm.batch_no AS parent_material_code,
    pm.name AS parent_material_name,
    i.line_no,
    i.component_material_id,
    cm.batch_no AS component_material_code,
    cm.name AS component_material_name,
    cm.category AS component_material_category,
    i.qty,
    i.unit,
    i.loss_rate,
    round((i.qty * ((1)::numeric + i.loss_rate)), 6) AS gross_qty,
    i.issue_method,
    i.substitute_group,
    i.remark,
    i.properties,
    i.created_at,
    i.updated_at
   FROM (((scm.bom_items i
     JOIN scm.boms b ON ((b.id = i.bom_id)))
     JOIN public.raw_materials pm ON ((pm.id = b.parent_material_id)))
     JOIN public.raw_materials cm ON ((cm.id = i.component_material_id)));


--
-- Name: VIEW v_bom_items; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_bom_items IS 'BOM明细查询视图，带父项与子件物料信息';


--
-- Name: v_bom_items; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_bom_items AS
 SELECT id,
    bom_id,
    bom_no,
    bom_name,
    parent_material_id,
    parent_material_code,
    parent_material_name,
    line_no,
    component_material_id,
    component_material_code,
    component_material_name,
    component_material_category,
    qty,
    unit,
    loss_rate,
    gross_qty,
    issue_method,
    substitute_group,
    remark,
    properties,
    created_at,
    updated_at
   FROM scm.v_bom_items;


--
-- Name: VIEW v_bom_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_bom_items IS 'Compatibility view for BOM item API requests without an explicit PostgREST schema profile; source: scm.v_bom_items';


--
-- Name: v_boms; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_boms AS
SELECT
    NULL::uuid AS id,
    NULL::text AS bom_no,
    NULL::text AS bom_name,
    NULL::integer AS parent_material_id,
    NULL::text AS parent_material_code,
    NULL::text AS parent_material_name,
    NULL::text AS parent_material_category,
    NULL::text AS version,
    NULL::numeric(18,6) AS base_qty,
    NULL::text AS unit,
    NULL::text AS bom_type,
    NULL::text AS status,
    NULL::date AS effective_from,
    NULL::date AS effective_to,
    NULL::text AS remark,
    NULL::jsonb AS properties,
    NULL::integer AS item_count,
    NULL::numeric(18,6) AS component_qty_total,
    NULL::text AS created_by,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS updated_at;


--
-- Name: VIEW v_boms; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_boms IS 'BOM主数据查询视图，带父项物料与明细汇总';


--
-- Name: v_boms; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_boms AS
 SELECT id,
    bom_no,
    bom_name,
    parent_material_id,
    parent_material_code,
    parent_material_name,
    parent_material_category,
    version,
    base_qty,
    unit,
    bom_type,
    status,
    effective_from,
    effective_to,
    remark,
    properties,
    item_count,
    component_qty_total,
    created_by,
    created_at,
    updated_at
   FROM scm.v_boms;


--
-- Name: VIEW v_boms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_boms IS 'Compatibility view for BOM list API requests without an explicit PostgREST schema profile; source: scm.v_boms';


--
-- Name: v_field_labels; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_field_labels AS
 WITH overrides AS (
         SELECT field_label_overrides.module,
            field_label_overrides.field_code,
            field_label_overrides.field_label,
            0 AS priority
           FROM public.field_label_overrides
        ), static_cols AS (
         SELECT 'hr_employee'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'archives'::name) AND (a.attnum > 0) AND (NOT a.attisdropped) AND (a.attname <> ALL (ARRAY['properties'::name, 'version'::name, 'updated_at'::name])))
        UNION ALL
         SELECT 'hr_change'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'archives'::name) AND (a.attnum > 0) AND (NOT a.attisdropped) AND (a.attname <> ALL (ARRAY['properties'::name, 'version'::name, 'updated_at'::name])))
        UNION ALL
         SELECT 'hr_attendance'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'attendance_records'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        UNION ALL
         SELECT 'hr_attendance'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'hr'::name) AND (c.relname = 'attendance_month_overrides'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        UNION ALL
         SELECT 'mms_ledger'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'public'::name) AND (c.relname = 'raw_materials'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        UNION ALL
         SELECT 'hr_user'::text AS module,
            a.attname AS field_code,
            COALESCE(col_description(c.oid, (a.attnum)::integer), (a.attname)::text) AS field_label,
            2 AS priority
           FROM ((pg_attribute a
             JOIN pg_class c ON ((c.oid = a.attrelid)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'public'::name) AND (c.relname = 'users'::name) AND (a.attnum > 0) AND (NOT a.attisdropped))
        ), dynamic_cols AS (
         SELECT 'hr_employee'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'hr_table_cols'::text)
        UNION ALL
         SELECT 'hr_change'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'hr_transfer_cols'::text)
        UNION ALL
         SELECT 'hr_attendance'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'hr_attendance_cols'::text)
        UNION ALL
         SELECT 'mms_ledger'::text AS module,
            (elem.value ->> 'prop'::text) AS field_code,
            (elem.value ->> 'label'::text) AS field_label,
            1 AS priority
           FROM public.system_configs sc,
            LATERAL jsonb_array_elements(sc.value) elem(value)
          WHERE (sc.key = 'materials_table_cols'::text)
        ), merged AS (
         SELECT overrides.module,
            overrides.field_code,
            overrides.field_label,
            overrides.priority
           FROM overrides
        UNION ALL
         SELECT dynamic_cols.module,
            dynamic_cols.field_code,
            dynamic_cols.field_label,
            dynamic_cols.priority
           FROM dynamic_cols
        UNION ALL
         SELECT static_cols.module,
            static_cols.field_code,
            static_cols.field_label,
            static_cols.priority
           FROM static_cols
        )
 SELECT DISTINCT ON (module, field_code) module,
    field_code,
    field_label
   FROM merged
  WHERE ((field_code IS NOT NULL) AND (field_code <> ''::text))
  ORDER BY module, field_code, priority;


--
-- Name: v_permission_ontology; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_permission_ontology AS
 WITH normalized AS (
         SELECT p.id,
            p.code,
            p.name,
            p.module,
            p.action,
            split_part(p.code, ':'::text, 1) AS scope,
            NULLIF(split_part(p.code, ':'::text, 2), ''::text) AS suffix
           FROM public.permissions p
        ), parsed AS (
         SELECT n.id,
            n.code,
            n.name,
            n.module,
            n.action,
            n.scope,
            n.suffix,
                CASE
                    WHEN (n.scope = 'module'::text) THEN n.suffix
                    ELSE NULL::text
                END AS module_key,
                CASE
                    WHEN (n.scope = 'app'::text) THEN n.suffix
                    ELSE NULL::text
                END AS app_key,
                CASE
                    WHEN (n.scope = 'op'::text) THEN NULLIF(split_part(n.suffix, '.'::text, 1), ''::text)
                    ELSE NULL::text
                END AS op_app_key,
                CASE
                    WHEN ((n.scope = 'op'::text) AND (POSITION(('.'::text) IN (n.suffix)) > 0)) THEN SUBSTRING(n.suffix FROM (POSITION(('.'::text) IN (n.suffix)) + 1))
                    ELSE NULL::text
                END AS op_action
           FROM normalized n
        )
 SELECT id,
    code,
    name,
    module,
    action,
    scope,
    COALESCE(op_app_key, app_key, module_key) AS entity_key,
    op_action AS action_key,
        CASE
            WHEN ((scope = 'op'::text) AND (op_action ~~ 'status_transition.%'::text)) THEN 'status_transition'::text
            WHEN ((scope = 'op'::text) AND (op_action ~~ 'workflow_%'::text)) THEN 'workflow'::text
            WHEN (scope = 'op'::text) THEN 'operation'::text
            WHEN (scope = 'app'::text) THEN 'app'::text
            WHEN (scope = 'module'::text) THEN 'module'::text
            ELSE 'unknown'::text
        END AS semantic_kind,
        CASE
            WHEN ((scope = 'op'::text) AND (op_action ~~ 'status_transition.%'::text)) THEN NULLIF(split_part(split_part(op_action, 'status_transition.'::text, 2), '_'::text, 1), ''::text)
            ELSE NULL::text
        END AS transition_from,
        CASE
            WHEN ((scope = 'op'::text) AND (op_action ~~ 'status_transition.%'::text)) THEN NULLIF("substring"(split_part(op_action, 'status_transition.'::text, 2), '^[^_]+_(.+)$'::text), ''::text)
            ELSE NULL::text
        END AS transition_to
   FROM parsed;


--
-- Name: VIEW v_permission_ontology; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_permission_ontology IS 'Lightweight ontology projection for permission semantics';


--
-- Name: v_role_ontology; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_role_ontology AS
 WITH role_permissions AS (
         SELECT r_1.id AS role_id,
            array_remove(array_agg(p.code ORDER BY p.code), NULL::text) AS permissions,
            (count(p.id))::integer AS permission_count,
            array_remove(array_agg(DISTINCT po.semantic_kind ORDER BY po.semantic_kind), NULL::text) AS permission_semantic_kinds
           FROM (((public.roles r_1
             LEFT JOIN public.role_permissions rp_1 ON ((rp_1.role_id = r_1.id)))
             LEFT JOIN public.permissions p ON ((p.id = rp_1.permission_id)))
             LEFT JOIN public.v_permission_ontology po ON ((po.code = p.code)))
          GROUP BY r_1.id
        ), role_scopes AS (
         SELECT rds.role_id,
            jsonb_agg(jsonb_build_object('module', rds.module, 'scope_type', rds.scope_type, 'dept_id', rds.dept_id, 'dept_name', d_1.name) ORDER BY rds.module, rds.scope_type) FILTER (WHERE (rds.id IS NOT NULL)) AS data_scopes
           FROM (public.role_data_scopes rds
             LEFT JOIN public.departments d_1 ON ((d_1.id = rds.dept_id)))
          GROUP BY rds.role_id
        )
 SELECT r.id,
    r.id AS role_id,
    r.code AS role_code,
    r.name AS role_name,
    COALESCE(r.description, ''::text) AS role_description,
    r.dept_id,
    d.name AS dept_name,
    'acl'::text AS semantic_domain,
    'role'::text AS semantic_class,
    COALESCE(NULLIF(r.name, ''::text), r.code) AS semantic_name,
    COALESCE(NULLIF(r.description, ''::text), ('角色 '::text || r.code)) AS semantic_description,
    COALESCE(rp.permissions, ARRAY[]::text[]) AS permissions,
    COALESCE(rp.permission_count, 0) AS permission_count,
    COALESCE(rp.permission_semantic_kinds, ARRAY[]::text[]) AS permission_semantic_kinds,
    COALESCE(rs.data_scopes, '[]'::jsonb) AS data_scopes,
    jsonb_build_array('acl', 'role', r.code) AS tags,
    r.sort,
    r.created_at,
    r.updated_at
   FROM (((public.roles r
     LEFT JOIN public.departments d ON ((d.id = r.dept_id)))
     LEFT JOIN role_permissions rp ON ((rp.role_id = r.id)))
     LEFT JOIN role_scopes rs ON ((rs.role_id = r.id)));


--
-- Name: VIEW v_role_ontology; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_role_ontology IS 'Ontology projection for role entities, granted permissions, and data scopes';


--
-- Name: v_ontology_coverage_audit; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_coverage_audit AS
 WITH api_relations AS (
         SELECT n.nspname AS table_schema,
            c.relname AS table_name,
            c.relkind
           FROM (pg_class c
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char"])) AND (n.nspname = ANY (ARRAY['public'::name, 'hr'::name, 'scm'::name, 'app_center'::name, 'workflow'::name, 'app_data'::name])) AND (c.relname !~~ 'pg_%'::text))
        ), relation_coverage AS (
         SELECT ar.table_schema,
            ar.table_name,
            ar.relkind,
            ots.table_name AS semanticized_table
           FROM (api_relations ar
             LEFT JOIN public.ontology_table_semantics ots ON (((ots.table_schema = ar.table_schema) AND (ots.table_name = ar.table_name) AND (ots.is_active = true))))
        ), active_columns AS (
         SELECT c.table_schema,
            c.table_name,
            c.column_name
           FROM (information_schema.columns c
             JOIN public.ontology_table_semantics ots ON (((ots.table_schema = (c.table_schema)::name) AND (ots.table_name = (c.table_name)::name) AND (ots.is_active = true))))
          WHERE (((c.table_schema)::name = ANY (ARRAY['public'::name, 'hr'::name, 'scm'::name, 'app_center'::name, 'workflow'::name, 'app_data'::name])) AND (ots.table_schema = ANY (ARRAY['public'::text, 'hr'::text, 'scm'::text, 'app_center'::text, 'workflow'::text, 'app_data'::text])))
        ), column_coverage AS (
         SELECT ac.table_schema,
            ac.table_name,
            ac.column_name,
            ocs.column_name AS semanticized_column
           FROM (active_columns ac
             LEFT JOIN public.ontology_column_semantics ocs ON (((ocs.table_schema = (ac.table_schema)::name) AND (ocs.table_name = (ac.table_name)::name) AND (ocs.column_name = (ac.column_name)::name) AND (ocs.is_active = true))))
        )
 SELECT 1 AS id,
    (( SELECT count(*) AS count
           FROM relation_coverage))::integer AS api_relations,
    (( SELECT count(*) AS count
           FROM relation_coverage
          WHERE (relation_coverage.semanticized_table IS NOT NULL)))::integer AS semanticized_relations,
    (( SELECT count(*) AS count
           FROM relation_coverage
          WHERE (relation_coverage.semanticized_table IS NULL)))::integer AS missing_relation_semantics,
    (( SELECT count(*) AS count
           FROM column_coverage))::integer AS ontology_columns,
    (( SELECT count(*) AS count
           FROM column_coverage
          WHERE (column_coverage.semanticized_column IS NOT NULL)))::integer AS semanticized_columns,
    (( SELECT count(*) AS count
           FROM column_coverage
          WHERE (column_coverage.semanticized_column IS NULL)))::integer AS missing_column_semantics,
    (( SELECT count(*) AS count
           FROM app_center.apps))::integer AS app_rows,
    (( SELECT count(*) AS count
           FROM public.v_app_form_ontology))::integer AS app_form_ontology_rows,
    (( SELECT count(*) AS count
           FROM public.roles))::integer AS role_rows,
    (( SELECT count(*) AS count
           FROM public.v_role_ontology))::integer AS role_ontology_rows,
    (( SELECT count(*) AS count
           FROM public.permissions))::integer AS permission_rows,
    (( SELECT count(*) AS count
           FROM public.v_permission_ontology))::integer AS permission_ontology_rows;


--
-- Name: VIEW v_ontology_coverage_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_coverage_audit IS 'Ontology coverage audit for API relations, columns, app forms, roles, and permissions';


--
-- Name: v_ontology_reasoning_facts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_reasoning_facts AS
 SELECT f.id,
    f.run_id,
    rr.status AS run_status,
    rr.finished_at AS run_finished_at,
    f.subject_type,
    f.subject_id,
    f.subject_label,
    f.predicate,
    f.object_type,
    f.object_id,
    f.object_label,
    f.fact_value,
    f.inference_rule,
    r.rule_name,
    r.inference_stage,
    r.rule_kind,
    f.inference_depth,
    f.confidence,
    f.evidence,
    f.is_inferred,
    f.created_at
   FROM ((public.ontology_inferred_facts f
     LEFT JOIN public.ontology_inference_rules r ON ((r.rule_code = f.inference_rule)))
     LEFT JOIN public.ontology_reasoning_runs rr ON ((rr.run_id = f.run_id)));


--
-- Name: VIEW v_ontology_reasoning_facts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_reasoning_facts IS 'Readable ontology reasoning facts with rule metadata';


--
-- Name: v_ontology_reasoning_edges; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_reasoning_edges AS
 SELECT id,
    run_id,
    subject_type,
    subject_id,
    subject_label,
    predicate,
    object_type,
    object_id,
    object_label,
    inference_rule,
    rule_name,
    inference_stage,
    inference_depth,
    confidence,
    is_inferred,
    evidence
   FROM public.v_ontology_reasoning_facts
  WHERE (object_id <> ''::text);


--
-- Name: VIEW v_ontology_reasoning_edges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_reasoning_edges IS 'Graph edge projection of ontology reasoning facts';


--
-- Name: v_ontology_kg_nodes; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_kg_nodes AS
 WITH raw_nodes AS (
         SELECT e.subject_type AS node_type,
            e.subject_id AS node_id,
            e.subject_label AS node_label,
            e.predicate,
            e.created_at
           FROM public.v_ontology_reasoning_facts e
          WHERE (e.subject_id <> ''::text)
        UNION ALL
         SELECT e.object_type AS node_type,
            e.object_id AS node_id,
            e.object_label AS node_label,
            e.predicate,
            e.created_at
           FROM public.v_ontology_reasoning_facts e
          WHERE (e.object_id <> ''::text)
        ), node_base AS (
         SELECT rn.node_type,
            rn.node_id,
            ((rn.node_type || ':'::text) || rn.node_id) AS node_key,
            max(NULLIF(rn.node_label, ''::text)) AS raw_label,
            (count(*))::integer AS fact_mentions,
            (count(DISTINCT rn.predicate))::integer AS predicate_count,
            to_jsonb(array_agg(DISTINCT rn.predicate ORDER BY rn.predicate)) AS predicates,
            max(rn.created_at) AS latest_fact_created_at
           FROM raw_nodes rn
          GROUP BY rn.node_type, rn.node_id
        ), outgoing AS (
         SELECT e.subject_type AS node_type,
            e.subject_id AS node_id,
            (count(*))::integer AS outgoing_edges
           FROM public.v_ontology_reasoning_edges e
          GROUP BY e.subject_type, e.subject_id
        ), incoming AS (
         SELECT e.object_type AS node_type,
            e.object_id AS node_id,
            (count(*))::integer AS incoming_edges
           FROM public.v_ontology_reasoning_edges e
          GROUP BY e.object_type, e.object_id
        )
 SELECT (row_number() OVER (ORDER BY nb.node_type, nb.node_id))::integer AS id,
    nb.node_key,
    nb.node_type,
    nb.node_id,
    COALESCE(NULLIF(ro.role_name, ''::text), NULLIF(app.app_name, ''::text), NULLIF(ots.semantic_name, ''::text), NULLIF(ocs.semantic_name, ''::text), NULLIF(po.name, ''::text), NULLIF(nb.raw_label, ''::text), nb.node_id) AS node_label,
    COALESCE(NULLIF(ro.semantic_domain, ''::text), NULLIF(app.semantic_domain, ''::text), NULLIF(ots.semantic_domain, ''::text), 'ontology'::text) AS semantic_domain,
        CASE
            WHEN (nb.node_type = 'table'::text) THEN COALESCE(NULLIF(ots.semantic_class, ''::text), 'table'::text)
            WHEN (nb.node_type = 'column'::text) THEN COALESCE(NULLIF(ocs.semantic_class, ''::text), 'column'::text)
            WHEN (nb.node_type = 'role'::text) THEN COALESCE(NULLIF(ro.semantic_class, ''::text), 'role'::text)
            WHEN (nb.node_type = 'app'::text) THEN COALESCE(NULLIF(app.semantic_class, ''::text), 'app'::text)
            WHEN (nb.node_type = 'permission'::text) THEN COALESCE(NULLIF(po.semantic_kind, ''::text), 'permission'::text)
            ELSE nb.node_type
        END AS semantic_class,
    COALESCE(NULLIF(ro.semantic_description, ''::text), NULLIF(app.semantic_description, ''::text), NULLIF(ots.semantic_description, ''::text), NULLIF(ocs.semantic_description, ''::text), ''::text) AS node_description,
        CASE
            WHEN (nb.node_type = 'column'::text) THEN COALESCE(ocs.is_sensitive, false)
            WHEN (nb.node_type = 'table'::text) THEN (EXISTS ( SELECT 1
               FROM public.ontology_column_semantics c
              WHERE ((c.table_schema = split_part(nb.node_id, '.'::text, 1)) AND (c.table_name = split_part(nb.node_id, '.'::text, 2)) AND (c.is_active = true) AND (c.is_sensitive = true))))
            ELSE false
        END AS is_sensitive,
    COALESCE(o.outgoing_edges, 0) AS outgoing_edges,
    COALESCE(i.incoming_edges, 0) AS incoming_edges,
    (COALESCE(o.outgoing_edges, 0) + COALESCE(i.incoming_edges, 0)) AS total_degree,
    nb.fact_mentions,
    nb.predicate_count,
    nb.predicates,
    nb.latest_fact_created_at,
    COALESCE(ro.tags, app.tags, ots.tags, ocs.tags, '[]'::jsonb) AS tags
   FROM (((((((node_base nb
     LEFT JOIN outgoing o ON (((o.node_type = nb.node_type) AND (o.node_id = nb.node_id))))
     LEFT JOIN incoming i ON (((i.node_type = nb.node_type) AND (i.node_id = nb.node_id))))
     LEFT JOIN public.v_role_ontology ro ON (((nb.node_type = 'role'::text) AND (ro.role_code = nb.node_id))))
     LEFT JOIN public.v_app_form_ontology app ON (((nb.node_type = 'app'::text) AND ((app.app_id)::text = nb.node_id))))
     LEFT JOIN public.ontology_table_semantics ots ON (((nb.node_type = 'table'::text) AND (ots.table_schema = split_part(nb.node_id, '.'::text, 1)) AND (ots.table_name = split_part(nb.node_id, '.'::text, 2)) AND (ots.is_active = true))))
     LEFT JOIN public.ontology_column_semantics ocs ON (((nb.node_type = 'column'::text) AND (ocs.table_schema = split_part(nb.node_id, '.'::text, 1)) AND (ocs.table_name = split_part(nb.node_id, '.'::text, 2)) AND (ocs.column_name = regexp_replace(nb.node_id, '^[^.]+\.[^.]+\.'::text, ''::text)) AND (ocs.is_active = true))))
     LEFT JOIN public.v_permission_ontology po ON (((nb.node_type = 'permission'::text) AND (po.code = nb.node_id))));


--
-- Name: VIEW v_ontology_kg_nodes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_kg_nodes IS 'Distinct knowledge graph nodes with semantic metadata and degree counts from ontology reasoning facts';


--
-- Name: v_ontology_reasoning_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_reasoning_summary AS
 WITH latest_run AS (
         SELECT r.run_id,
            r.started_at,
            r.finished_at,
            r.status,
            r.max_depth,
            r.facts_inserted,
            r.error_message,
            r.created_by
           FROM public.ontology_reasoning_runs r
          ORDER BY r.finished_at DESC NULLS LAST, r.started_at DESC
         LIMIT 1
        )
 SELECT 1 AS id,
    run_id,
    status AS last_run_status,
    started_at AS last_started_at,
    finished_at AS last_finished_at,
    max_depth,
    facts_inserted AS facts_total,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inferred_facts f
          WHERE (f.is_inferred = false)) AS seed_facts,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inferred_facts f
          WHERE (f.is_inferred = true)) AS inferred_facts,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inference_rules r
          WHERE (r.is_active = true)) AS active_rules,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inferred_facts f
          WHERE (f.predicate = 'acl:canAccessApp'::text)) AS role_app_access_facts,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inferred_facts f
          WHERE (f.predicate = 'acl:canAccessTable'::text)) AS role_table_access_facts,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inferred_facts f
          WHERE (f.predicate = 'wf:canPerformTransition'::text)) AS workflow_transition_facts,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inferred_facts f
          WHERE (f.predicate = 'risk:canAccessSensitiveColumn'::text)) AS sensitive_exposure_facts,
    ( SELECT (count(*))::integer AS count
           FROM public.ontology_inferred_facts f
          WHERE (f.predicate = 'ontology:transitivelyDependsOn'::text)) AS transitive_dependency_facts
   FROM latest_run lr;


--
-- Name: VIEW v_ontology_reasoning_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_reasoning_summary IS 'Latest ontology reasoning run summary and fact counts';


--
-- Name: v_ontology_reasoning_health; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_reasoning_health AS
 SELECT 1 AS id,
    s.run_id,
    s.last_run_status,
    s.last_started_at,
    s.last_finished_at,
    s.max_depth,
    s.facts_total,
    s.seed_facts,
    s.inferred_facts,
    s.active_rules,
    s.role_app_access_facts,
    s.role_table_access_facts,
    s.workflow_transition_facts,
    s.sensitive_exposure_facts,
    s.transitive_dependency_facts,
    a.api_relations,
    a.semanticized_relations,
    a.missing_relation_semantics,
    a.ontology_columns,
    a.semanticized_columns,
    a.missing_column_semantics,
    ((COALESCE(s.last_run_status, ''::text) = 'completed'::text) AND (COALESCE(a.missing_relation_semantics, 0) = 0) AND (COALESCE(a.missing_column_semantics, 0) = 0) AND (COALESCE(s.inferred_facts, 0) > 0)) AS is_healthy,
        CASE
            WHEN (COALESCE(s.last_run_status, ''::text) <> 'completed'::text) THEN 'reasoning_run_not_completed'::text
            WHEN (COALESCE(a.missing_relation_semantics, 0) > 0) THEN 'missing_relation_semantics'::text
            WHEN (COALESCE(a.missing_column_semantics, 0) > 0) THEN 'missing_column_semantics'::text
            WHEN (COALESCE(s.inferred_facts, 0) <= 0) THEN 'no_inferred_facts'::text
            ELSE 'healthy'::text
        END AS health_code
   FROM (public.v_ontology_reasoning_summary s
     CROSS JOIN public.v_ontology_coverage_audit a);


--
-- Name: VIEW v_ontology_reasoning_health; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_reasoning_health IS 'Combined ontology reasoning run and semantic coverage health status';


--
-- Name: v_ontology_reasoning_rule_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_reasoning_rule_stats AS
 WITH fact_stats AS (
         SELECT f.inference_rule AS rule_code,
            (count(*))::integer AS facts_total,
            (count(*) FILTER (WHERE f.is_inferred))::integer AS inferred_facts,
            (count(*) FILTER (WHERE (NOT f.is_inferred)))::integer AS seed_facts,
            (count(DISTINCT f.predicate))::integer AS predicate_count,
            min(f.inference_depth) AS min_depth,
            max(f.inference_depth) AS max_depth,
            to_jsonb(array_agg(DISTINCT f.predicate ORDER BY f.predicate)) AS predicates
           FROM public.v_ontology_reasoning_facts f
          GROUP BY f.inference_rule
        ), latest_run AS (
         SELECT r_1.run_id,
            r_1.status,
            r_1.started_at,
            r_1.finished_at,
            r_1.max_depth,
            r_1.facts_inserted
           FROM public.ontology_reasoning_runs r_1
          ORDER BY r_1.started_at DESC
         LIMIT 1
        )
 SELECT (row_number() OVER (ORDER BY r.priority, r.rule_code))::integer AS id,
    r.rule_code,
    r.rule_name,
    r.inference_stage,
    r.rule_kind,
    r.predicate AS declared_predicate,
    r.description,
    r.config,
    r.priority,
    r.is_active,
    COALESCE(fs.facts_total, 0) AS facts_total,
    COALESCE(fs.seed_facts, 0) AS seed_facts,
    COALESCE(fs.inferred_facts, 0) AS inferred_facts,
    COALESCE(fs.predicate_count, 0) AS predicate_count,
    COALESCE(fs.predicates, '[]'::jsonb) AS predicates,
    fs.min_depth,
    fs.max_depth,
    lr.run_id AS latest_run_id,
    lr.status AS latest_run_status,
    lr.started_at AS latest_started_at,
    lr.finished_at AS latest_finished_at,
    r.updated_at
   FROM ((public.ontology_inference_rules r
     LEFT JOIN fact_stats fs ON ((fs.rule_code = r.rule_code)))
     LEFT JOIN latest_run lr ON (true));


--
-- Name: VIEW v_ontology_reasoning_rule_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_reasoning_rule_stats IS 'Per-rule ontology reasoning fact counts and latest run metadata';


--
-- Name: v_ontology_role_access_insights; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_role_access_insights AS
 WITH role_base AS (
         SELECT r.role_code,
            r.role_name,
            r.role_description,
            r.dept_name,
            r.permission_count,
            r.permission_semantic_kinds,
            r.data_scopes,
            r.tags
           FROM public.v_role_ontology r
        ), role_counts AS (
         SELECT f.subject_id AS role_code,
            (count(DISTINCT f.object_id) FILTER (WHERE (f.predicate = 'acl:canAccessApp'::text)))::integer AS accessible_apps,
            (count(DISTINCT f.object_id) FILTER (WHERE (f.predicate = 'acl:canAccessTable'::text)))::integer AS accessible_tables,
            (count(DISTINCT f.object_id) FILTER (WHERE (f.predicate = 'acl:canOperateTable'::text)))::integer AS operable_tables,
            (count(DISTINCT f.object_id) FILTER (WHERE (f.predicate = 'risk:canAccessSensitiveColumn'::text)))::integer AS sensitive_columns,
            (count(DISTINCT (f.evidence ->> 'table'::text)) FILTER (WHERE (f.predicate = 'risk:canAccessSensitiveColumn'::text)))::integer AS sensitive_tables,
            (count(DISTINCT COALESCE((f.evidence ->> 'permission_code'::text), ''::text)) FILTER (WHERE ((f.predicate = ANY (ARRAY['acl:canAccessApp'::text, 'acl:canAccessTable'::text, 'acl:canOperateTable'::text, 'acl:canOperateAppAction'::text])) AND (COALESCE((f.evidence ->> 'permission_code'::text), ''::text) <> ''::text))))::integer AS inferred_permission_paths
           FROM public.v_ontology_reasoning_facts f
          WHERE (f.subject_type = 'role'::text)
          GROUP BY f.subject_id
        ), latest_run AS (
         SELECT s.run_id,
            s.last_run_status,
            s.last_finished_at
           FROM public.v_ontology_reasoning_summary s
         LIMIT 1
        )
 SELECT (row_number() OVER (ORDER BY rb.role_code))::integer AS id,
    rb.role_code,
    rb.role_name,
    rb.role_description,
    rb.dept_name,
    rb.permission_count,
    rb.permission_semantic_kinds,
    rb.data_scopes,
    rb.tags,
    COALESCE(rc.accessible_apps, 0) AS accessible_apps,
    COALESCE(rc.accessible_tables, 0) AS accessible_tables,
    COALESCE(rc.operable_tables, 0) AS operable_tables,
    COALESCE(rc.sensitive_columns, 0) AS sensitive_columns,
    COALESCE(rc.sensitive_tables, 0) AS sensitive_tables,
    COALESCE(rc.inferred_permission_paths, 0) AS inferred_permission_paths,
    lr.run_id AS latest_run_id,
    lr.last_run_status,
    lr.last_finished_at
   FROM ((role_base rb
     LEFT JOIN role_counts rc ON ((rc.role_code = rb.role_code)))
     LEFT JOIN latest_run lr ON (true));


--
-- Name: VIEW v_ontology_role_access_insights; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_role_access_insights IS 'Role-centric KG access, operation, and sensitive exposure insight summary';


--
-- Name: v_ontology_sensitive_access_paths; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_sensitive_access_paths AS
 SELECT f.id,
    f.id AS fact_id,
    f.subject_id AS role_code,
    COALESCE(r.role_name, f.subject_label, f.subject_id) AS role_name,
    split_part(f.object_id, '.'::text, 1) AS table_schema,
    split_part(f.object_id, '.'::text, 2) AS table_name,
    ((split_part(f.object_id, '.'::text, 1) || '.'::text) || split_part(f.object_id, '.'::text, 2)) AS table_id,
    COALESCE(t.semantic_name, (f.evidence ->> 'table'::text), ((split_part(f.object_id, '.'::text, 1) || '.'::text) || split_part(f.object_id, '.'::text, 2))) AS table_label,
    regexp_replace(f.object_id, '^[^.]+\.[^.]+\.'::text, ''::text) AS column_name,
    COALESCE(c.semantic_name, f.object_label, regexp_replace(f.object_id, '^[^.]+\.[^.]+\.'::text, ''::text)) AS column_label,
    f.object_id AS column_id,
    f.predicate,
    f.inference_rule,
    f.rule_name,
    (f.evidence ->> 'access_predicate'::text) AS access_predicate,
    (f.evidence ->> 'access_rule'::text) AS access_rule,
    f.inference_depth,
    f.confidence,
    f.evidence,
    f.created_at
   FROM (((public.v_ontology_reasoning_facts f
     LEFT JOIN public.v_role_ontology r ON ((r.role_code = f.subject_id)))
     LEFT JOIN public.ontology_table_semantics t ON (((t.table_schema = split_part(f.object_id, '.'::text, 1)) AND (t.table_name = split_part(f.object_id, '.'::text, 2)) AND (t.is_active = true))))
     LEFT JOIN public.ontology_column_semantics c ON (((c.table_schema = split_part(f.object_id, '.'::text, 1)) AND (c.table_name = split_part(f.object_id, '.'::text, 2)) AND (c.column_name = regexp_replace(f.object_id, '^[^.]+\.[^.]+\.'::text, ''::text)) AND (c.is_active = true))))
  WHERE ((f.predicate = 'risk:canAccessSensitiveColumn'::text) AND (f.subject_type = 'role'::text) AND (f.object_type = 'column'::text));


--
-- Name: VIEW v_ontology_sensitive_access_paths; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_sensitive_access_paths IS 'Detailed role-to-sensitive-column paths inferred by the ontology KG engine';


--
-- Name: v_ontology_table_dependency_paths; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_table_dependency_paths AS
 SELECT id,
    id AS fact_id,
    subject_id AS dependent_table_id,
    subject_label AS dependent_table_label,
    object_id AS dependency_table_id,
    object_label AS dependency_table_label,
    (evidence ->> 'via'::text) AS via_table_id,
    inference_depth AS dependency_depth,
    inference_rule,
    rule_name,
    evidence,
    created_at
   FROM public.v_ontology_reasoning_facts f
  WHERE ((predicate = 'ontology:transitivelyDependsOn'::text) AND (subject_type = 'table'::text) AND (object_type = 'table'::text));


--
-- Name: VIEW v_ontology_table_dependency_paths; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_table_dependency_paths IS 'Transitive table dependency paths inferred by the ontology KG engine';


--
-- Name: v_ontology_table_impact_insights; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ontology_table_impact_insights AS
 WITH table_base AS (
         SELECT t.table_schema,
            t.table_name,
            ((t.table_schema || '.'::text) || t.table_name) AS table_id,
            t.semantic_domain,
            t.semantic_class,
            t.semantic_name AS table_label
           FROM public.ontology_table_semantics t
          WHERE (t.is_active = true)
        ), direct_dependency_counts AS (
         SELECT f.object_id AS table_id,
            (count(DISTINCT f.subject_id))::integer AS direct_dependent_tables
           FROM public.v_ontology_reasoning_facts f
          WHERE ((f.predicate = 'ontology:dependsOn'::text) AND (f.subject_type = 'table'::text) AND (f.object_type = 'table'::text))
          GROUP BY f.object_id
        ), transitive_dependency_counts AS (
         SELECT f.object_id AS table_id,
            (count(DISTINCT f.subject_id))::integer AS transitive_dependent_tables
           FROM public.v_ontology_reasoning_facts f
          WHERE ((f.predicate = 'ontology:transitivelyDependsOn'::text) AND (f.subject_type = 'table'::text) AND (f.object_type = 'table'::text))
          GROUP BY f.object_id
        ), outgoing_dependency_counts AS (
         SELECT f.subject_id AS table_id,
            (count(DISTINCT f.object_id))::integer AS depends_on_tables
           FROM public.v_ontology_reasoning_facts f
          WHERE ((f.predicate = ANY (ARRAY['ontology:dependsOn'::text, 'ontology:transitivelyDependsOn'::text])) AND (f.subject_type = 'table'::text) AND (f.object_type = 'table'::text))
          GROUP BY f.subject_id
        ), role_access_counts AS (
         SELECT f.object_id AS table_id,
            (count(DISTINCT f.subject_id) FILTER (WHERE (f.predicate = 'acl:canAccessTable'::text)))::integer AS roles_can_access,
            (count(DISTINCT f.subject_id) FILTER (WHERE (f.predicate = 'acl:canOperateTable'::text)))::integer AS roles_can_operate
           FROM public.v_ontology_reasoning_facts f
          WHERE ((f.subject_type = 'role'::text) AND (f.object_type = 'table'::text) AND (f.predicate = ANY (ARRAY['acl:canAccessTable'::text, 'acl:canOperateTable'::text])))
          GROUP BY f.object_id
        ), sensitive_counts AS (
         SELECT ((c.table_schema || '.'::text) || c.table_name) AS table_id,
            (count(*))::integer AS sensitive_columns
           FROM public.ontology_column_semantics c
          WHERE ((c.is_active = true) AND (c.is_sensitive = true))
          GROUP BY c.table_schema, c.table_name
        )
 SELECT (row_number() OVER (ORDER BY tb.table_id))::integer AS id,
    tb.table_schema,
    tb.table_name,
    tb.table_id,
    tb.semantic_domain,
    tb.semantic_class,
    tb.table_label,
    (COALESCE(sc.sensitive_columns, 0) > 0) AS is_sensitive,
    COALESCE(sc.sensitive_columns, 0) AS sensitive_columns,
    COALESCE(rac.roles_can_access, 0) AS roles_can_access,
    COALESCE(rac.roles_can_operate, 0) AS roles_can_operate,
    COALESCE(ddc.direct_dependent_tables, 0) AS direct_dependent_tables,
    COALESCE(tdc.transitive_dependent_tables, 0) AS transitive_dependent_tables,
    COALESCE(odc.depends_on_tables, 0) AS depends_on_tables,
    ((COALESCE(sc.sensitive_columns, 0) > 0) OR (COALESCE(rac.roles_can_access, 0) > 0) OR (COALESCE(tdc.transitive_dependent_tables, 0) > 0)) AS has_reasoning_impact
   FROM (((((table_base tb
     LEFT JOIN sensitive_counts sc ON ((sc.table_id = tb.table_id)))
     LEFT JOIN role_access_counts rac ON ((rac.table_id = tb.table_id)))
     LEFT JOIN direct_dependency_counts ddc ON ((ddc.table_id = tb.table_id)))
     LEFT JOIN transitive_dependency_counts tdc ON ((tdc.table_id = tb.table_id)))
     LEFT JOIN outgoing_dependency_counts odc ON ((odc.table_id = tb.table_id)));


--
-- Name: VIEW v_ontology_table_impact_insights; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_ontology_table_impact_insights IS 'Table-centric KG impact summary for dependencies, role access, and sensitive columns';


--
-- Name: v_purchase_order_progress; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_purchase_order_progress AS
SELECT
    NULL::uuid AS id,
    NULL::text AS order_no,
    NULL::uuid AS demand_id,
    NULL::text AS source_demand_no,
    NULL::uuid AS supplier_id,
    NULL::text AS supplier_name,
    NULL::text AS material_name,
    NULL::numeric(14,2) AS quantity,
    NULL::text AS unit,
    NULL::numeric(14,2) AS unit_price,
    NULL::numeric(14,2) AS total_amount,
    NULL::date AS order_date,
    NULL::date AS expected_arrival_date,
    NULL::text AS buyer_name,
    NULL::text AS order_status,
    NULL::text AS status,
    NULL::jsonb AS properties,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS updated_at,
    NULL::numeric(14,2) AS arrived_quantity,
    NULL::numeric(14,2) AS pending_quantity,
    NULL::text AS arrival_progress;


--
-- Name: v_role_data_scopes_matrix; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_role_data_scopes_matrix AS
 WITH modules AS (
         SELECT unnest(ARRAY['hr_employee'::text, 'hr_org'::text, 'hr_attendance'::text, 'hr_change'::text, 'hr_acl'::text, 'hr_user'::text, 'mms_ledger'::text]) AS module
        ), matrix AS (
         SELECT r.id AS role_id,
            m.module
           FROM (public.roles r
             CROSS JOIN modules m)
        )
 SELECT (((matrix.role_id)::text || ':'::text) || matrix.module) AS id,
    matrix.role_id,
    matrix.module,
    COALESCE(rds.scope_type, 'self'::text) AS scope_type,
    rds.dept_id
   FROM (matrix
     LEFT JOIN public.role_data_scopes rds ON (((rds.role_id = matrix.role_id) AND (rds.module = matrix.module))));


--
-- Name: v_role_permission_ontology; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_role_permission_ontology AS
 SELECT row_number() OVER (ORDER BY r.code, p.code) AS id,
    r.id AS role_id,
    r.code AS role_code,
    r.name AS role_name,
    p.id AS permission_id,
    p.code AS permission_code,
    p.name AS permission_name,
    'acl:grantsPermission'::text AS predicate,
    po.scope,
    po.entity_key,
    po.action_key,
    po.semantic_kind,
    po.transition_from,
    po.transition_to,
    rp.created_at,
    NULL::timestamp with time zone AS updated_at
   FROM (((public.roles r
     JOIN public.role_permissions rp ON ((rp.role_id = r.id)))
     JOIN public.permissions p ON ((p.id = rp.permission_id)))
     LEFT JOIN public.v_permission_ontology po ON ((po.code = p.code)));


--
-- Name: VIEW v_role_permission_ontology; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_role_permission_ontology IS 'Ontology relation projection from roles to granted permissions';


--
-- Name: v_role_permissions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_role_permissions AS
 SELECT r.id AS role_id,
    r.code AS role_code,
    array_agg(p.code ORDER BY p.code) AS permissions
   FROM ((public.roles r
     LEFT JOIN public.role_permissions rp ON ((rp.role_id = r.id)))
     LEFT JOIN public.permissions p ON ((p.id = rp.permission_id)))
  GROUP BY r.id, r.code;


--
-- Name: COLUMN v_role_permissions.role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_role_permissions.role_id IS '角色';


--
-- Name: COLUMN v_role_permissions.permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_role_permissions.permissions IS '权限集合';


--
-- Name: v_role_permissions_matrix; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_role_permissions_matrix AS
 SELECT (((r.id)::text || ':'::text) || (p.id)::text) AS id,
    r.id AS role_id,
    p.id AS permission_id,
    p.code,
    p.name,
    p.module,
    p.action,
    (rp.permission_id IS NOT NULL) AS granted
   FROM ((public.roles r
     CROSS JOIN public.permissions p)
     LEFT JOIN public.role_permissions rp ON (((rp.role_id = r.id) AND (rp.permission_id = p.id))));


--
-- Name: v_roles_manage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_roles_manage AS
 SELECT id,
    code,
    name,
    description,
    sort,
    created_at,
    updated_at
   FROM public.roles r;


--
-- Name: v_sys_dict_items; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_sys_dict_items AS
 SELECT d.id AS dict_id,
    d.dict_key,
    d.name AS dict_name,
    d.enabled AS dict_enabled,
    i.id AS item_id,
    i.label,
    i.value,
    i.sort,
    i.enabled AS item_enabled,
    i.extra,
    i.created_at,
    i.updated_at
   FROM (public.sys_dicts d
     JOIN public.sys_dict_items i ON ((i.dict_id = d.id)));


--
-- Name: COLUMN v_sys_dict_items.sort; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_sys_dict_items.sort IS '排序';


--
-- Name: COLUMN v_sys_dict_items.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_sys_dict_items.created_at IS '创建时间';


--
-- Name: COLUMN v_sys_dict_items.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.v_sys_dict_items.updated_at IS '更新时间';


--
-- Name: v_users_manage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_users_manage AS
 SELECT u.id,
    u.username,
    u.full_name,
    u.phone,
    u.email,
    u.dept_id,
    u.status,
    ur.role_id,
    r.code AS role_code,
    r.name AS role_name,
    u.password,
    u.avatar,
    u.sop_role
   FROM ((public.users u
     LEFT JOIN LATERAL ( SELECT ur_1.role_id
           FROM public.user_roles ur_1
          WHERE (ur_1.user_id = u.id)
          ORDER BY ur_1.created_at DESC
         LIMIT 1) ur ON (true))
     LEFT JOIN public.roles r ON ((r.id = ur.role_id)));


--
-- Name: batch_no_rules; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.batch_no_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name text NOT NULL,
    rule_template text NOT NULL,
    reset_strategy text DEFAULT '每日'::text NOT NULL,
    applicable_categories text[],
    status text DEFAULT '启用'::text,
    example_output text,
    description text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    dept_id uuid,
    CONSTRAINT batch_no_rules_status_check CHECK ((status = ANY (ARRAY['启用'::text, '停用'::text])))
);


--
-- Name: TABLE batch_no_rules; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.batch_no_rules IS '??????????';


--
-- Name: COLUMN batch_no_rules.rule_template; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON COLUMN scm.batch_no_rules.rule_template IS '?????: {????} {??:YYYYMMDD} {??:3} {????}';


--
-- Name: inventory_batches; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.inventory_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id integer NOT NULL,
    batch_no text NOT NULL,
    warehouse_id uuid NOT NULL,
    available_qty numeric(18,4) DEFAULT 0 NOT NULL,
    locked_qty numeric(18,4) DEFAULT 0 NOT NULL,
    unit text NOT NULL,
    production_date date,
    expiry_date date,
    supplier text,
    purchase_price numeric(15,4),
    status text DEFAULT '正常'::text,
    properties jsonb DEFAULT '{}'::jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    dept_id uuid,
    CONSTRAINT inventory_batches_available_qty_check CHECK ((available_qty >= (0)::numeric)),
    CONSTRAINT inventory_batches_locked_qty_check CHECK ((locked_qty >= (0)::numeric)),
    CONSTRAINT inventory_batches_status_check CHECK ((status = ANY (ARRAY['正常'::text, '锁定'::text, '过期'::text, '耗尽'::text])))
);


--
-- Name: TABLE inventory_batches; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.inventory_batches IS '?????-???????????????';


--
-- Name: inventory_check_items; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.inventory_check_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    check_id uuid NOT NULL,
    material_id integer NOT NULL,
    batch_no text,
    warehouse_id uuid,
    book_qty numeric(18,4),
    actual_qty numeric(18,4),
    diff_qty numeric(18,4) GENERATED ALWAYS AS ((actual_qty - COALESCE(book_qty, (0)::numeric))) STORED,
    unit text,
    operator text,
    scan_time timestamp with time zone,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_checks; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.inventory_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    check_no text NOT NULL,
    warehouse_id uuid,
    check_date date NOT NULL,
    status text DEFAULT '进行中'::text,
    total_items integer DEFAULT 0,
    diff_count integer DEFAULT 0,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    dept_id uuid,
    CONSTRAINT inventory_checks_status_check CHECK ((status = ANY (ARRAY['进行中'::text, '已完成'::text, '已生成调整单'::text])))
);


--
-- Name: inventory_drafts; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.inventory_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_type text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    material_id integer NOT NULL,
    warehouse_id uuid NOT NULL,
    batch_id uuid,
    batch_no text,
    quantity numeric(18,4) NOT NULL,
    unit text NOT NULL,
    production_date date,
    remark text,
    operator text,
    transaction_no text,
    properties jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    rule_id uuid,
    io_type text,
    CONSTRAINT inventory_drafts_draft_type_check CHECK ((draft_type = ANY (ARRAY['in'::text, 'out'::text]))),
    CONSTRAINT inventory_drafts_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT inventory_drafts_status_check CHECK ((status = ANY (ARRAY['created'::text, 'active'::text, 'locked'::text])))
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_no text NOT NULL,
    transaction_type text NOT NULL,
    material_id integer NOT NULL,
    batch_no text,
    batch_id uuid,
    warehouse_id uuid,
    quantity numeric(18,4) NOT NULL,
    unit text NOT NULL,
    before_qty numeric(18,4),
    after_qty numeric(18,4),
    related_doc_type text,
    related_doc_no text,
    transaction_date timestamp with time zone DEFAULT now() NOT NULL,
    operator text,
    remark text,
    approval_status text DEFAULT '已完成'::text,
    workflow_instance_id uuid,
    properties jsonb DEFAULT '{}'::jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    dept_id uuid,
    io_type text,
    CONSTRAINT inventory_transactions_approval_status_check CHECK ((approval_status = ANY (ARRAY['待审批'::text, '已批准'::text, '已拒绝'::text, '已完成'::text]))),
    CONSTRAINT inventory_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['入库'::text, '出库'::text, '调整'::text, '调拨'::text, '锁定'::text, '解锁'::text])))
);


--
-- Name: TABLE inventory_transactions; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.inventory_transactions IS '???????-????????';


--
-- Name: production_work_order_items; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.production_work_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    line_no integer DEFAULT 10 NOT NULL,
    component_material_id integer NOT NULL,
    component_material_code text NOT NULL,
    component_material_name text NOT NULL,
    required_qty numeric(18,6) DEFAULT 0 NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    issued_qty numeric(18,6) DEFAULT 0 NOT NULL,
    shortage_qty numeric(18,6) DEFAULT 0 NOT NULL,
    issue_status text DEFAULT '未领料'::text NOT NULL,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_work_order_items_issue_status_check CHECK ((issue_status = ANY (ARRAY['未领料'::text, '部分领料'::text, '已齐套'::text]))),
    CONSTRAINT production_work_order_items_issued_qty_check CHECK ((issued_qty >= (0)::numeric)),
    CONSTRAINT production_work_order_items_required_qty_check CHECK ((required_qty >= (0)::numeric)),
    CONSTRAINT production_work_order_items_shortage_qty_check CHECK ((shortage_qty >= (0)::numeric))
);


--
-- Name: TABLE production_work_order_items; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.production_work_order_items IS '生产工单用料：由BOM展开生成，记录需求、缺料和领料状态';


--
-- Name: production_work_orders; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.production_work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_no text NOT NULL,
    source_type text DEFAULT 'sales_bom_mrp'::text NOT NULL,
    source_order_nos text,
    product_material_id integer NOT NULL,
    product_material_code text NOT NULL,
    product_material_name text NOT NULL,
    bom_id uuid,
    bom_no text,
    bom_version text DEFAULT 'V1'::text NOT NULL,
    planned_qty numeric(18,6) DEFAULT 0 NOT NULL,
    unit text DEFAULT '盒'::text NOT NULL,
    planned_start_date date,
    planned_finish_date date,
    work_order_status text DEFAULT '待排产'::text NOT NULL,
    priority text DEFAULT '普通'::text NOT NULL,
    remark text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_work_orders_priority_check CHECK ((priority = ANY (ARRAY['低'::text, '普通'::text, '高'::text, '紧急'::text]))),
    CONSTRAINT production_work_orders_qty_check CHECK ((planned_qty >= (0)::numeric)),
    CONSTRAINT production_work_orders_status_check CHECK ((work_order_status = ANY (ARRAY['待排产'::text, '已排产'::text, '生产中'::text, '已完工'::text, '已取消'::text])))
);


--
-- Name: TABLE production_work_orders; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.production_work_orders IS '生产工单：承接销售BOM需求，记录成品生产数量、状态和来源订单';


--
-- Name: warehouses; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    level integer DEFAULT 1 NOT NULL,
    sort integer DEFAULT 0,
    status text DEFAULT '启用'::text,
    manager_id integer,
    capacity numeric(15,2),
    unit text,
    properties jsonb DEFAULT '{}'::jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    dept_id uuid,
    CONSTRAINT warehouses_status_check CHECK ((status = ANY (ARRAY['启用'::text, '停用'::text])))
);


--
-- Name: TABLE warehouses; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.warehouses IS '??/??/???????';


--
-- Name: COLUMN warehouses.properties; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON COLUMN scm.warehouses.properties IS '??Canvas???????????';


--
-- Name: v_inventory_current; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_inventory_current AS
 SELECT ib.id,
    ib.material_id,
    m.batch_no AS material_code,
    m.name AS material_name,
    m.category AS material_category,
    ib.batch_no,
    ib.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    ib.available_qty,
    ib.locked_qty,
    (ib.available_qty + ib.locked_qty) AS total_qty,
    ib.unit,
    ib.production_date,
    ib.expiry_date,
    ib.status,
    ib.properties,
    ib.updated_at AS last_transaction_at
   FROM ((scm.inventory_batches ib
     LEFT JOIN public.raw_materials m ON ((ib.material_id = m.id)))
     LEFT JOIN scm.warehouses w ON ((ib.warehouse_id = w.id)));


--
-- Name: VIEW v_inventory_current; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_inventory_current IS '????????';


--
-- Name: v_inventory_drafts; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_inventory_drafts AS
 SELECT d.id,
    d.draft_type,
    d.status,
    d.io_type,
    d.material_id,
    m.batch_no AS material_code,
    m.name AS material_name,
    m.category AS material_category,
    d.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    d.batch_id,
    COALESCE(d.batch_no, ib.batch_no) AS batch_no,
    d.rule_id,
    ib.available_qty,
    d.quantity,
    d.unit,
    d.production_date,
    d.remark,
    d.operator,
    d.transaction_no,
    d.created_at,
    d.updated_at
   FROM (((scm.inventory_drafts d
     LEFT JOIN public.raw_materials m ON ((d.material_id = m.id)))
     LEFT JOIN scm.warehouses w ON ((d.warehouse_id = w.id)))
     LEFT JOIN scm.inventory_batches ib ON ((d.batch_id = ib.id)));


--
-- Name: VIEW v_inventory_drafts; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_inventory_drafts IS 'Draft stock in/out records with material, warehouse and io type details';


--
-- Name: v_inventory_transactions; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_inventory_transactions AS
 SELECT it.id,
    it.transaction_no,
    it.transaction_type,
    it.io_type,
    it.material_id,
    m.batch_no AS material_code,
    m.name AS material_name,
    m.category AS material_category,
    it.batch_no,
    it.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    it.quantity,
    it.unit,
    it.before_qty,
    it.after_qty,
    it.operator,
    it.transaction_date,
    it.remark,
    it.properties
   FROM ((scm.inventory_transactions it
     LEFT JOIN public.raw_materials m ON ((it.material_id = m.id)))
     LEFT JOIN scm.warehouses w ON ((it.warehouse_id = w.id)));


--
-- Name: VIEW v_inventory_transactions; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_inventory_transactions IS 'Inventory transaction view with material and warehouse details';


--
-- Name: v_production_work_order_items; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_production_work_order_items AS
 SELECT i.id,
    i.work_order_id,
    i.line_no,
    i.component_material_id,
    i.component_material_code,
    i.component_material_name,
    i.required_qty,
    i.unit,
    i.issued_qty,
    i.shortage_qty,
    i.issue_status,
    i.remark,
    i.properties,
    i.created_at,
    i.updated_at,
    wo.work_order_no,
    wo.product_material_id,
    wo.product_material_code,
    wo.product_material_name,
    wo.planned_qty,
    wo.work_order_status
   FROM (scm.production_work_order_items i
     JOIN scm.production_work_orders wo ON ((wo.id = i.work_order_id)));


--
-- Name: v_production_work_orders; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_production_work_orders AS
 SELECT wo.id,
    wo.work_order_no,
    wo.source_type,
    wo.source_order_nos,
    wo.product_material_id,
    wo.product_material_code,
    wo.product_material_name,
    wo.bom_id,
    wo.bom_no,
    wo.bom_version,
    wo.planned_qty,
    wo.unit,
    wo.planned_start_date,
    wo.planned_finish_date,
    wo.work_order_status,
    wo.priority,
    wo.remark,
    wo.properties,
    wo.created_by,
    wo.created_at,
    wo.updated_at,
    (COALESCE(item_stats.item_count, (0)::bigint))::integer AS item_count,
    (COALESCE(item_stats.shortage_item_count, (0)::bigint))::integer AS shortage_item_count,
    (COALESCE(item_stats.total_required_qty, (0)::numeric))::numeric(18,6) AS total_required_qty
   FROM (scm.production_work_orders wo
     LEFT JOIN LATERAL ( SELECT count(*) AS item_count,
            count(*) FILTER (WHERE (i.shortage_qty > (0)::numeric)) AS shortage_item_count,
            sum(i.required_qty) AS total_required_qty
           FROM scm.production_work_order_items i
          WHERE (i.work_order_id = wo.id)) item_stats ON (true));


--
-- Name: v_sales_bom_order_plan; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_sales_bom_order_plan AS
 WITH finished_inventory AS (
         SELECT v_inventory_current.material_id,
            (sum(v_inventory_current.available_qty))::numeric(18,6) AS available_qty,
            (sum(v_inventory_current.total_qty))::numeric(18,6) AS total_qty
           FROM scm.v_inventory_current
          GROUP BY v_inventory_current.material_id
        )
 SELECT so.id AS sales_order_id,
    so.order_no,
    so.customer_name,
    so.product_material_id,
    m.batch_no AS product_material_code,
    COALESCE(m.name, so.product_name) AS product_material_name,
    so.product_name AS sales_product_name,
    (so.quantity)::numeric(18,6) AS sales_qty,
    so.unit AS sales_unit,
    so.order_status,
    so.delivery_date,
    (COALESCE(inv.available_qty, (0)::numeric))::numeric(18,6) AS finished_available_qty,
    b.id AS bom_id,
    b.bom_no,
    b.version AS bom_version,
    b.status AS bom_status,
        CASE
            WHEN ((so.status = 'active'::text) AND (so.order_status = ANY (ARRAY['已确认'::text, '生产中'::text])) AND (so.product_material_id IS NOT NULL) AND (b.id IS NOT NULL)) THEN true
            ELSE false
        END AS mrp_included,
    so.properties,
    so.created_at,
    so.updated_at
   FROM (((public.sales_orders so
     LEFT JOIN public.raw_materials m ON ((m.id = so.product_material_id)))
     LEFT JOIN finished_inventory inv ON ((inv.material_id = so.product_material_id)))
     LEFT JOIN scm.boms b ON (((b.parent_material_id = so.product_material_id) AND (b.status = '启用'::text) AND (b.version = COALESCE((so.properties ->> 'bom_version'::text), 'V1'::text)))))
  WHERE (COALESCE(so.status, 'active'::text) <> 'deleted'::text);


--
-- Name: VIEW v_sales_bom_order_plan; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_sales_bom_order_plan IS '销售订单到成品BOM的需求映射，标记可参与MRP的订单';


--
-- Name: v_sales_bom_mrp; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_sales_bom_mrp AS
 WITH sales_demand AS (
         SELECT p_1.product_material_id,
            p_1.product_material_code,
            p_1.product_material_name,
            max(p_1.sales_unit) AS sales_unit,
            (sum(p_1.sales_qty))::numeric(18,6) AS sales_qty,
            min(p_1.delivery_date) AS earliest_delivery_date,
            string_agg(p_1.order_no, ', '::text ORDER BY p_1.order_no) AS source_order_nos
           FROM scm.v_sales_bom_order_plan p_1
          WHERE p_1.mrp_included
          GROUP BY p_1.product_material_id, p_1.product_material_code, p_1.product_material_name
        ), finished_inventory AS (
         SELECT v_inventory_current.material_id,
            (sum(v_inventory_current.available_qty))::numeric(18,6) AS available_qty,
            (sum(v_inventory_current.total_qty))::numeric(18,6) AS total_qty
           FROM scm.v_inventory_current
          GROUP BY v_inventory_current.material_id
        ), component_inventory AS (
         SELECT v_inventory_current.material_id,
            (sum(v_inventory_current.available_qty))::numeric(18,6) AS available_qty,
            (sum(v_inventory_current.total_qty))::numeric(18,6) AS total_qty
           FROM scm.v_inventory_current
          GROUP BY v_inventory_current.material_id
        ), product_plan AS (
         SELECT d.product_material_id,
            d.product_material_code,
            d.product_material_name,
            d.sales_unit,
            d.sales_qty,
            (COALESCE(fi.available_qty, (0)::numeric))::numeric(18,6) AS finished_available_qty,
            (GREATEST((d.sales_qty - COALESCE(fi.available_qty, (0)::numeric)), (0)::numeric))::numeric(18,6) AS production_qty,
            d.earliest_delivery_date,
            d.source_order_nos,
            b.id AS bom_id,
            b.bom_no,
            b.version AS bom_version
           FROM ((sales_demand d
             JOIN scm.boms b ON (((b.parent_material_id = d.product_material_id) AND (b.status = '启用'::text) AND (b.version = 'V1'::text))))
             LEFT JOIN finished_inventory fi ON ((fi.material_id = d.product_material_id)))
        )
 SELECT (row_number() OVER (ORDER BY p.product_material_code, e.component_material_code))::integer AS row_no,
    p.product_material_id,
    p.product_material_code,
    p.product_material_name,
    p.sales_qty,
    p.sales_unit,
    p.finished_available_qty,
    p.production_qty,
    p.earliest_delivery_date,
    p.source_order_nos,
    p.bom_id,
    p.bom_no,
    p.bom_version,
    e.component_material_id,
    e.component_material_code,
    e.component_material_name,
    cm.category AS component_material_category,
    e.unit,
    (e.required_qty)::numeric(18,6) AS required_qty,
    (COALESCE(ci.available_qty, (0)::numeric))::numeric(18,6) AS available_qty,
    (COALESCE(ci.total_qty, (0)::numeric))::numeric(18,6) AS total_qty,
    (GREATEST((e.required_qty - COALESCE(ci.available_qty, (0)::numeric)), (0)::numeric))::numeric(18,6) AS shortage_qty,
        CASE
            WHEN (p.production_qty <= (0)::numeric) THEN '成品库存满足'::text
            WHEN (GREATEST((e.required_qty - COALESCE(ci.available_qty, (0)::numeric)), (0)::numeric) > (0)::numeric) THEN '需采购'::text
            ELSE '库存满足'::text
        END AS mrp_status,
    NULLIF((cm.properties ->> 'supplier'::text), ''::text) AS preferred_supplier
   FROM (((product_plan p
     JOIN LATERAL scm.explode_bom(p.product_material_id, p.production_qty, p.bom_version) e(root_bom_id, root_bom_no, root_material_id, root_material_code, root_material_name, component_material_id, component_material_code, component_material_name, unit, required_qty) ON ((p.production_qty > (0)::numeric)))
     JOIN public.raw_materials cm ON ((cm.id = e.component_material_id)))
     LEFT JOIN component_inventory ci ON ((ci.material_id = e.component_material_id)))
  ORDER BY p.product_material_code, e.component_material_code;


--
-- Name: VIEW v_sales_bom_mrp; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_sales_bom_mrp IS '销售需求结合成品库存、BOM展开和子件库存后的缺料分析';


--
-- Name: v_sales_bom_production_plan; Type: VIEW; Schema: scm; Owner: -
--

CREATE VIEW scm.v_sales_bom_production_plan AS
 WITH demand AS (
         SELECT p.product_material_id,
            p.product_material_code,
            p.product_material_name,
            max(p.sales_unit) AS unit,
            (sum(p.sales_qty))::numeric(18,6) AS sales_qty,
            (max(p.finished_available_qty))::numeric(18,6) AS finished_available_qty,
            (GREATEST((sum(p.sales_qty) - max(p.finished_available_qty)), (0)::numeric))::numeric(18,6) AS planned_qty,
            min(p.delivery_date) AS earliest_delivery_date,
            string_agg(p.order_no, ', '::text ORDER BY p.order_no) AS source_order_nos
           FROM scm.v_sales_bom_order_plan p
          WHERE p.mrp_included
          GROUP BY p.product_material_id, p.product_material_code, p.product_material_name
        )
 SELECT (row_number() OVER (ORDER BY d.product_material_code))::integer AS row_no,
    d.product_material_id,
    d.product_material_code,
    d.product_material_name,
    d.sales_qty,
    d.finished_available_qty,
    d.planned_qty,
    d.unit,
    d.earliest_delivery_date,
    d.source_order_nos,
    b.id AS bom_id,
    b.bom_no,
    b.version AS bom_version,
    (COALESCE(wo.work_order_count, (0)::bigint))::integer AS work_order_count,
    (COALESCE(wo.open_work_order_count, (0)::bigint))::integer AS open_work_order_count,
        CASE
            WHEN (d.planned_qty <= (0)::numeric) THEN '成品库存满足'::text
            WHEN (COALESCE(wo.open_work_order_count, (0)::bigint) > 0) THEN '已有工单'::text
            ELSE '待生成工单'::text
        END AS plan_status
   FROM ((demand d
     JOIN scm.boms b ON (((b.parent_material_id = d.product_material_id) AND (b.status = '启用'::text) AND (b.version = 'V1'::text))))
     LEFT JOIN LATERAL ( SELECT count(*) AS work_order_count,
            count(*) FILTER (WHERE (existing.work_order_status <> ALL (ARRAY['已完工'::text, '已取消'::text]))) AS open_work_order_count
           FROM scm.production_work_orders existing
          WHERE ((existing.product_material_id = d.product_material_id) AND (existing.source_type = 'sales_bom_mrp'::text))) wo ON (true));


--
-- Name: VIEW v_sales_bom_production_plan; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON VIEW scm.v_sales_bom_production_plan IS '销售BOM生产计划：销售需求减成品库存后的生产建议';


--
-- Name: warehouse_layouts; Type: TABLE; Schema: scm; Owner: -
--

CREATE TABLE scm.warehouse_layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    canvas_width integer DEFAULT 0 NOT NULL,
    canvas_height integer DEFAULT 0 NOT NULL,
    layers jsonb DEFAULT '[]'::jsonb NOT NULL,
    rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    dept_id uuid
);


--
-- Name: TABLE warehouse_layouts; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON TABLE scm.warehouse_layouts IS '??????(?????????????)';


--
-- Name: COLUMN warehouse_layouts.layers; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON COLUMN scm.warehouse_layouts.layers IS '?????: ????????????';


--
-- Name: COLUMN warehouse_layouts.rules; Type: COMMENT; Schema: scm; Owner: -
--

COMMENT ON COLUMN scm.warehouse_layouts.rules IS '??????: ??/?????';


--
-- Name: definitions; Type: TABLE; Schema: workflow; Owner: -
--

CREATE TABLE workflow.definitions (
    id integer NOT NULL,
    name text NOT NULL,
    bpmn_xml text NOT NULL,
    app_id uuid,
    associated_table text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: definitions_id_seq; Type: SEQUENCE; Schema: workflow; Owner: -
--

CREATE SEQUENCE workflow.definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: workflow; Owner: -
--

ALTER SEQUENCE workflow.definitions_id_seq OWNED BY workflow.definitions.id;


--
-- Name: instance_events; Type: TABLE; Schema: workflow; Owner: -
--

CREATE TABLE workflow.instance_events (
    id integer NOT NULL,
    instance_id integer NOT NULL,
    definition_id integer,
    event_type text NOT NULL,
    from_task_id text,
    to_task_id text,
    actor_username text,
    actor_role text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: instance_events_id_seq; Type: SEQUENCE; Schema: workflow; Owner: -
--

CREATE SEQUENCE workflow.instance_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: instance_events_id_seq; Type: SEQUENCE OWNED BY; Schema: workflow; Owner: -
--

ALTER SEQUENCE workflow.instance_events_id_seq OWNED BY workflow.instance_events.id;


--
-- Name: instances_id_seq; Type: SEQUENCE; Schema: workflow; Owner: -
--

CREATE SEQUENCE workflow.instances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: instances_id_seq; Type: SEQUENCE OWNED BY; Schema: workflow; Owner: -
--

ALTER SEQUENCE workflow.instances_id_seq OWNED BY workflow.instances.id;


--
-- Name: task_approvals; Type: TABLE; Schema: workflow; Owner: -
--

CREATE TABLE workflow.task_approvals (
    id integer NOT NULL,
    instance_id integer NOT NULL,
    definition_id integer,
    task_id text NOT NULL,
    actor_username text NOT NULL,
    actor_role text,
    decision text DEFAULT 'approved'::text NOT NULL,
    comment text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_approvals_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
);


--
-- Name: task_approvals_id_seq; Type: SEQUENCE; Schema: workflow; Owner: -
--

CREATE SEQUENCE workflow.task_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: workflow; Owner: -
--

ALTER SEQUENCE workflow.task_approvals_id_seq OWNED BY workflow.task_approvals.id;


--
-- Name: task_assignments; Type: TABLE; Schema: workflow; Owner: -
--

CREATE TABLE workflow.task_assignments (
    id integer NOT NULL,
    definition_id integer,
    task_id text NOT NULL,
    candidate_roles text[],
    candidate_users text[],
    created_at timestamp with time zone DEFAULT now(),
    approval_mode text DEFAULT 'any'::text,
    required_approvals integer DEFAULT 1,
    require_comment boolean DEFAULT false,
    CONSTRAINT task_assignments_approval_mode_check CHECK ((approval_mode = ANY (ARRAY['any'::text, 'quota'::text, 'all'::text]))),
    CONSTRAINT task_assignments_required_approvals_check CHECK ((required_approvals >= 1))
);


--
-- Name: task_assignments_id_seq; Type: SEQUENCE; Schema: workflow; Owner: -
--

CREATE SEQUENCE workflow.task_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: workflow; Owner: -
--

ALTER SEQUENCE workflow.task_assignments_id_seq OWNED BY workflow.task_assignments.id;


--
-- Name: categories id; Type: DEFAULT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.categories ALTER COLUMN id SET DEFAULT nextval('app_center.categories_id_seq'::regclass);


--
-- Name: execution_logs id; Type: DEFAULT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.execution_logs ALTER COLUMN id SET DEFAULT nextval('app_center.execution_logs_id_seq'::regclass);


--
-- Name: published_routes id; Type: DEFAULT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.published_routes ALTER COLUMN id SET DEFAULT nextval('app_center.published_routes_id_seq'::regclass);


--
-- Name: workflow_permission_policies id; Type: DEFAULT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_permission_policies ALTER COLUMN id SET DEFAULT nextval('app_center.workflow_permission_policies_id_seq'::regclass);


--
-- Name: workflow_state_mappings id; Type: DEFAULT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_state_mappings ALTER COLUMN id SET DEFAULT nextval('app_center.workflow_state_mappings_id_seq'::regclass);


--
-- Name: workflow_transition_rules id; Type: DEFAULT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_transition_rules ALTER COLUMN id SET DEFAULT nextval('app_center.workflow_transition_rules_id_seq'::regclass);


--
-- Name: archives id; Type: DEFAULT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.archives ALTER COLUMN id SET DEFAULT nextval('hr.archives_id_seq'::regclass);


--
-- Name: payroll id; Type: DEFAULT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.payroll ALTER COLUMN id SET DEFAULT nextval('hr.payroll_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: ontology_inferred_facts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_inferred_facts ALTER COLUMN id SET DEFAULT nextval('public.ontology_inferred_facts_id_seq'::regclass);


--
-- Name: raw_materials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_materials ALTER COLUMN id SET DEFAULT nextval('public.raw_materials_id_seq'::regclass);


--
-- Name: smart_bi_action_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_bi_action_items ALTER COLUMN id SET DEFAULT nextval('public.smart_bi_action_items_id_seq'::regclass);


--
-- Name: sop_learning_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_learning_records ALTER COLUMN id SET DEFAULT nextval('public.sop_learning_records_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: definitions id; Type: DEFAULT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.definitions ALTER COLUMN id SET DEFAULT nextval('workflow.definitions_id_seq'::regclass);


--
-- Name: instance_events id; Type: DEFAULT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.instance_events ALTER COLUMN id SET DEFAULT nextval('workflow.instance_events_id_seq'::regclass);


--
-- Name: instances id; Type: DEFAULT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.instances ALTER COLUMN id SET DEFAULT nextval('workflow.instances_id_seq'::regclass);


--
-- Name: task_approvals id; Type: DEFAULT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_approvals ALTER COLUMN id SET DEFAULT nextval('workflow.task_approvals_id_seq'::regclass);


--
-- Name: task_assignments id; Type: DEFAULT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_assignments ALTER COLUMN id SET DEFAULT nextval('workflow.task_assignments_id_seq'::regclass);


--
-- Name: apps apps_pkey; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.apps
    ADD CONSTRAINT apps_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: execution_logs execution_logs_pkey; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.execution_logs
    ADD CONSTRAINT execution_logs_pkey PRIMARY KEY (id);


--
-- Name: published_routes published_routes_pkey; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.published_routes
    ADD CONSTRAINT published_routes_pkey PRIMARY KEY (id);


--
-- Name: published_routes published_routes_route_path_key; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.published_routes
    ADD CONSTRAINT published_routes_route_path_key UNIQUE (route_path);


--
-- Name: workflow_permission_policies workflow_permission_policies_app_key; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_permission_policies
    ADD CONSTRAINT workflow_permission_policies_app_key UNIQUE (workflow_app_id);


--
-- Name: workflow_permission_policies workflow_permission_policies_pkey; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_permission_policies
    ADD CONSTRAINT workflow_permission_policies_pkey PRIMARY KEY (id);


--
-- Name: workflow_state_mappings workflow_state_mappings_pkey; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_state_mappings
    ADD CONSTRAINT workflow_state_mappings_pkey PRIMARY KEY (id);


--
-- Name: workflow_state_mappings workflow_state_mappings_workflow_app_id_bpmn_task_id_key; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_state_mappings
    ADD CONSTRAINT workflow_state_mappings_workflow_app_id_bpmn_task_id_key UNIQUE (workflow_app_id, bpmn_task_id);


--
-- Name: workflow_transition_rules workflow_transition_rules_pkey; Type: CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_transition_rules
    ADD CONSTRAINT workflow_transition_rules_pkey PRIMARY KEY (id);


--
-- Name: checkin_records checkin_records_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.checkin_records
    ADD CONSTRAINT checkin_records_pkey PRIMARY KEY (id);


--
-- Name: data_app_17137de9 data_app_17137de9_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_17137de9
    ADD CONSTRAINT data_app_17137de9_pkey PRIMARY KEY (id);


--
-- Name: data_app_1f840d3b data_app_1f840d3b_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_1f840d3b
    ADD CONSTRAINT data_app_1f840d3b_pkey PRIMARY KEY (id);


--
-- Name: data_app_3f3cf089 data_app_3f3cf089_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_3f3cf089
    ADD CONSTRAINT data_app_3f3cf089_pkey PRIMARY KEY (id);


--
-- Name: data_app_51d98ca6 data_app_51d98ca6_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_51d98ca6
    ADD CONSTRAINT data_app_51d98ca6_pkey PRIMARY KEY (id);


--
-- Name: data_app_6da3f976 data_app_6da3f976_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_6da3f976
    ADD CONSTRAINT data_app_6da3f976_pkey PRIMARY KEY (id);


--
-- Name: data_app_6de378ee data_app_6de378ee_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_6de378ee
    ADD CONSTRAINT data_app_6de378ee_pkey PRIMARY KEY (id);


--
-- Name: data_app_7dd735dd data_app_7dd735dd_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_7dd735dd
    ADD CONSTRAINT data_app_7dd735dd_pkey PRIMARY KEY (id);


--
-- Name: data_app_8966fa75 data_app_8966fa75_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_8966fa75
    ADD CONSTRAINT data_app_8966fa75_pkey PRIMARY KEY (id);


--
-- Name: data_app_cd7a8401 data_app_cd7a8401_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_cd7a8401
    ADD CONSTRAINT data_app_cd7a8401_pkey PRIMARY KEY (id);


--
-- Name: data_app_fd3f499a data_app_fd3f499a_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.data_app_fd3f499a
    ADD CONSTRAINT data_app_fd3f499a_pkey PRIMARY KEY (id);


--
-- Name: eiscore_chain_test_records eiscore_chain_test_records_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.eiscore_chain_test_records
    ADD CONSTRAINT eiscore_chain_test_records_pkey PRIMARY KEY (id);


--
-- Name: twin_knowledge_files twin_knowledge_files_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.twin_knowledge_files
    ADD CONSTRAINT twin_knowledge_files_pkey PRIMARY KEY (id);


--
-- Name: twin_messages twin_messages_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.twin_messages
    ADD CONSTRAINT twin_messages_pkey PRIMARY KEY (id);


--
-- Name: twin_sessions twin_sessions_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.twin_sessions
    ADD CONSTRAINT twin_sessions_pkey PRIMARY KEY (id);


--
-- Name: twin_tool_logs twin_tool_logs_pkey; Type: CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.twin_tool_logs
    ADD CONSTRAINT twin_tool_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: basic_auth; Owner: -
--

ALTER TABLE ONLY basic_auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (username);


--
-- Name: agent_audit_events agent_audit_events_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_audit_events
    ADD CONSTRAINT agent_audit_events_pkey PRIMARY KEY (id);


--
-- Name: agent_messages agent_messages_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_messages
    ADD CONSTRAINT agent_messages_pkey PRIMARY KEY (id);


--
-- Name: agent_qualification_rules agent_qualification_rules_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_qualification_rules
    ADD CONSTRAINT agent_qualification_rules_pkey PRIMARY KEY (id);


--
-- Name: agent_qualification_rules agent_qualification_rules_site_key_version_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_qualification_rules
    ADD CONSTRAINT agent_qualification_rules_site_key_version_key UNIQUE (site_key, version);


--
-- Name: agent_sessions agent_sessions_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_sessions
    ADD CONSTRAINT agent_sessions_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: cases cases_site_key_locale_slug_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.cases
    ADD CONSTRAINT cases_site_key_locale_slug_key UNIQUE (site_key, locale, slug);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: content_pages content_pages_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.content_pages
    ADD CONSTRAINT content_pages_pkey PRIMARY KEY (id);


--
-- Name: content_pages content_pages_site_key_locale_slug_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.content_pages
    ADD CONSTRAINT content_pages_site_key_locale_slug_key UNIQUE (site_key, locale, slug);


--
-- Name: content_revisions content_revisions_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.content_revisions
    ADD CONSTRAINT content_revisions_pkey PRIMARY KEY (id);


--
-- Name: content_revisions content_revisions_site_key_object_type_object_id_version_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.content_revisions
    ADD CONSTRAINT content_revisions_site_key_object_type_object_id_version_key UNIQUE (site_key, object_type, object_id, version);


--
-- Name: evidence_records evidence_records_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.evidence_records
    ADD CONSTRAINT evidence_records_pkey PRIMARY KEY (id);


--
-- Name: geo_answer_snapshots geo_answer_snapshots_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.geo_answer_snapshots
    ADD CONSTRAINT geo_answer_snapshots_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: lead_events lead_events_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.lead_events
    ADD CONSTRAINT lead_events_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leads leads_public_ref_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.leads
    ADD CONSTRAINT leads_public_ref_key UNIQUE (public_ref);


--
-- Name: leads leads_site_key_idempotency_key_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.leads
    ADD CONSTRAINT leads_site_key_idempotency_key_key UNIQUE (site_key, idempotency_key);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_site_key_storage_key_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.media_assets
    ADD CONSTRAINT media_assets_site_key_storage_key_key UNIQUE (site_key, storage_key);


--
-- Name: opportunity_drafts opportunity_drafts_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.opportunity_drafts
    ADD CONSTRAINT opportunity_drafts_pkey PRIMARY KEY (id);


--
-- Name: opportunity_drafts opportunity_drafts_site_key_idempotency_key_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.opportunity_drafts
    ADD CONSTRAINT opportunity_drafts_site_key_idempotency_key_key UNIQUE (site_key, idempotency_key);


--
-- Name: product_locales product_locales_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.product_locales
    ADD CONSTRAINT product_locales_pkey PRIMARY KEY (id);


--
-- Name: product_locales product_locales_product_id_locale_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.product_locales
    ADD CONSTRAINT product_locales_product_id_locale_key UNIQUE (product_id, locale);


--
-- Name: production_work_order_drafts production_work_order_drafts_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.production_work_order_drafts
    ADD CONSTRAINT production_work_order_drafts_pkey PRIMARY KEY (id);


--
-- Name: production_work_order_drafts production_work_order_drafts_site_key_idempotency_key_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.production_work_order_drafts
    ADD CONSTRAINT production_work_order_drafts_site_key_idempotency_key_key UNIQUE (site_key, idempotency_key);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_site_key_product_code_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.products
    ADD CONSTRAINT products_site_key_product_code_key UNIQUE (site_key, product_code);


--
-- Name: products products_site_key_slug_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.products
    ADD CONSTRAINT products_site_key_slug_key UNIQUE (site_key, slug);


--
-- Name: quote_drafts quote_drafts_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.quote_drafts
    ADD CONSTRAINT quote_drafts_pkey PRIMARY KEY (id);


--
-- Name: quote_drafts quote_drafts_site_key_idempotency_key_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.quote_drafts
    ADD CONSTRAINT quote_drafts_site_key_idempotency_key_key UNIQUE (site_key, idempotency_key);


--
-- Name: sales_order_drafts sales_order_drafts_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.sales_order_drafts
    ADD CONSTRAINT sales_order_drafts_pkey PRIMARY KEY (id);


--
-- Name: sales_order_drafts sales_order_drafts_site_key_idempotency_key_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.sales_order_drafts
    ADD CONSTRAINT sales_order_drafts_site_key_idempotency_key_key UNIQUE (site_key, idempotency_key);


--
-- Name: seo_checks seo_checks_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_checks
    ADD CONSTRAINT seo_checks_pkey PRIMARY KEY (id);


--
-- Name: seo_keywords seo_keywords_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_keywords
    ADD CONSTRAINT seo_keywords_pkey PRIMARY KEY (id);


--
-- Name: seo_keywords seo_keywords_site_key_locale_market_keyword_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_keywords
    ADD CONSTRAINT seo_keywords_site_key_locale_market_keyword_key UNIQUE (site_key, locale, market, keyword);


--
-- Name: seo_metadata seo_metadata_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_metadata
    ADD CONSTRAINT seo_metadata_pkey PRIMARY KEY (id);


--
-- Name: seo_metadata seo_metadata_site_key_locale_path_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_metadata
    ADD CONSTRAINT seo_metadata_site_key_locale_path_key UNIQUE (site_key, locale, path);


--
-- Name: site_config site_config_domain_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.site_config
    ADD CONSTRAINT site_config_domain_key UNIQUE (domain);


--
-- Name: site_config site_config_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.site_config
    ADD CONSTRAINT site_config_pkey PRIMARY KEY (site_key);


--
-- Name: site_locales site_locales_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.site_locales
    ADD CONSTRAINT site_locales_pkey PRIMARY KEY (id);


--
-- Name: site_locales site_locales_site_key_locale_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.site_locales
    ADD CONSTRAINT site_locales_site_key_locale_key UNIQUE (site_key, locale);


--
-- Name: solutions solutions_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.solutions
    ADD CONSTRAINT solutions_pkey PRIMARY KEY (id);


--
-- Name: solutions solutions_site_key_locale_slug_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.solutions
    ADD CONSTRAINT solutions_site_key_locale_slug_key UNIQUE (site_key, locale, slug);


--
-- Name: sync_jobs sync_jobs_pkey; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.sync_jobs
    ADD CONSTRAINT sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: sync_jobs sync_jobs_site_key_target_system_idempotency_key_key; Type: CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.sync_jobs
    ADD CONSTRAINT sync_jobs_site_key_target_system_idempotency_key_key UNIQUE (site_key, target_system, idempotency_key);


--
-- Name: baseline_migration_coverage baseline_migration_coverage_pkey; Type: CONSTRAINT; Schema: eiscore_meta; Owner: -
--

ALTER TABLE ONLY eiscore_meta.baseline_migration_coverage
    ADD CONSTRAINT baseline_migration_coverage_pkey PRIMARY KEY (baseline_id, migration_id);


--
-- Name: database_baselines database_baselines_pkey; Type: CONSTRAINT; Schema: eiscore_meta; Owner: -
--

ALTER TABLE ONLY eiscore_meta.database_baselines
    ADD CONSTRAINT database_baselines_pkey PRIMARY KEY (baseline_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: eiscore_meta; Owner: -
--

ALTER TABLE ONLY eiscore_meta.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (migration_id);


--
-- Name: archives archives_employee_no_key; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.archives
    ADD CONSTRAINT archives_employee_no_key UNIQUE (employee_no);


--
-- Name: archives archives_pkey; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.archives
    ADD CONSTRAINT archives_pkey PRIMARY KEY (id);


--
-- Name: attendance_month_overrides attendance_month_overrides_pkey; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.attendance_month_overrides
    ADD CONSTRAINT attendance_month_overrides_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: attendance_shifts attendance_shifts_name_key; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.attendance_shifts
    ADD CONSTRAINT attendance_shifts_name_key UNIQUE (name);


--
-- Name: attendance_shifts attendance_shifts_pkey; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.attendance_shifts
    ADD CONSTRAINT attendance_shifts_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_archive_id_key; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.employee_profiles
    ADD CONSTRAINT employee_profiles_archive_id_key UNIQUE (archive_id);


--
-- Name: employee_profiles employee_profiles_pkey; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.employee_profiles
    ADD CONSTRAINT employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: ai_business_corrections ai_business_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_business_corrections
    ADD CONSTRAINT ai_business_corrections_pkey PRIMARY KEY (id);


--
-- Name: client_log_events client_log_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_log_events
    ADD CONSTRAINT client_log_events_pkey PRIMARY KEY (id);


--
-- Name: client_log_sessions client_log_sessions_client_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_log_sessions
    ADD CONSTRAINT client_log_sessions_client_session_id_key UNIQUE (client_session_id);


--
-- Name: client_log_sessions client_log_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_log_sessions
    ADD CONSTRAINT client_log_sessions_pkey PRIMARY KEY (id);


--
-- Name: collector_devices collector_devices_enterprise_id_device_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_devices
    ADD CONSTRAINT collector_devices_enterprise_id_device_code_key UNIQUE (enterprise_id, device_code);


--
-- Name: collector_devices collector_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_devices
    ADD CONSTRAINT collector_devices_pkey PRIMARY KEY (id);


--
-- Name: collector_watch_folders collector_watch_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_watch_folders
    ADD CONSTRAINT collector_watch_folders_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_assets document_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assets
    ADD CONSTRAINT document_assets_pkey PRIMARY KEY (id);


--
-- Name: document_business_links document_business_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_business_links
    ADD CONSTRAINT document_business_links_pkey PRIMARY KEY (id);


--
-- Name: document_classification_results document_classification_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_classification_results
    ADD CONSTRAINT document_classification_results_pkey PRIMARY KEY (id);


--
-- Name: document_entry_plans document_entry_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_entry_plans
    ADD CONSTRAINT document_entry_plans_pkey PRIMARY KEY (id);


--
-- Name: document_flow_audits document_flow_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_flow_audits
    ADD CONSTRAINT document_flow_audits_pkey PRIMARY KEY (id);


--
-- Name: document_import_batches document_import_batches_batch_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_import_batches
    ADD CONSTRAINT document_import_batches_batch_no_key UNIQUE (batch_no);


--
-- Name: document_import_batches document_import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_import_batches
    ADD CONSTRAINT document_import_batches_pkey PRIMARY KEY (id);


--
-- Name: document_links document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_pkey PRIMARY KEY (id);


--
-- Name: document_parse_jobs document_parse_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_parse_jobs
    ADD CONSTRAINT document_parse_jobs_pkey PRIMARY KEY (id);


--
-- Name: document_parse_results document_parse_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_parse_results
    ADD CONSTRAINT document_parse_results_pkey PRIMARY KEY (id);


--
-- Name: document_unmapped_fields document_unmapped_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_unmapped_fields
    ADD CONSTRAINT document_unmapped_fields_pkey PRIMARY KEY (id);


--
-- Name: document_upload_chunks document_upload_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_upload_chunks
    ADD CONSTRAINT document_upload_chunks_pkey PRIMARY KEY (id);


--
-- Name: document_upload_chunks document_upload_chunks_session_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_upload_chunks
    ADD CONSTRAINT document_upload_chunks_session_id_chunk_index_key UNIQUE (session_id, chunk_index);


--
-- Name: document_upload_sessions document_upload_sessions_device_id_file_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_upload_sessions
    ADD CONSTRAINT document_upload_sessions_device_id_file_hash_key UNIQUE (device_id, file_hash);


--
-- Name: document_upload_sessions document_upload_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_upload_sessions
    ADD CONSTRAINT document_upload_sessions_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: equipment_assets equipment_assets_asset_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_assets
    ADD CONSTRAINT equipment_assets_asset_no_key UNIQUE (asset_no);


--
-- Name: equipment_assets equipment_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_assets
    ADD CONSTRAINT equipment_assets_pkey PRIMARY KEY (id);


--
-- Name: equipment_checks equipment_checks_check_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_check_no_key UNIQUE (check_no);


--
-- Name: equipment_checks equipment_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_pkey PRIMARY KEY (id);


--
-- Name: equipment_issues equipment_issues_issue_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_issues
    ADD CONSTRAINT equipment_issues_issue_no_key UNIQUE (issue_no);


--
-- Name: equipment_issues equipment_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_issues
    ADD CONSTRAINT equipment_issues_pkey PRIMARY KEY (id);


--
-- Name: equipment_maintenance_plans equipment_maintenance_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_plans
    ADD CONSTRAINT equipment_maintenance_plans_pkey PRIMARY KEY (id);


--
-- Name: equipment_maintenance_plans equipment_maintenance_plans_plan_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_plans
    ADD CONSTRAINT equipment_maintenance_plans_plan_no_key UNIQUE (plan_no);


--
-- Name: equipment_standards equipment_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_standards
    ADD CONSTRAINT equipment_standards_pkey PRIMARY KEY (id);


--
-- Name: equipment_standards equipment_standards_standard_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_standards
    ADD CONSTRAINT equipment_standards_standard_no_key UNIQUE (standard_no);


--
-- Name: equipment_work_orders equipment_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_work_orders
    ADD CONSTRAINT equipment_work_orders_pkey PRIMARY KEY (id);


--
-- Name: equipment_work_orders equipment_work_orders_work_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_work_orders
    ADD CONSTRAINT equipment_work_orders_work_order_no_key UNIQUE (work_order_no);


--
-- Name: field_label_overrides field_label_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_label_overrides
    ADD CONSTRAINT field_label_overrides_pkey PRIMARY KEY (module, field_code);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: form_values form_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_values
    ADD CONSTRAINT form_values_pkey PRIMARY KEY (id);


--
-- Name: form_values form_values_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_values
    ADD CONSTRAINT form_values_unique UNIQUE (template_id, row_id);


--
-- Name: ontology_column_semantics ontology_column_semantics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_column_semantics
    ADD CONSTRAINT ontology_column_semantics_pkey PRIMARY KEY (table_schema, table_name, column_name);


--
-- Name: ontology_inference_rules ontology_inference_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_inference_rules
    ADD CONSTRAINT ontology_inference_rules_pkey PRIMARY KEY (rule_code);


--
-- Name: ontology_inferred_facts ontology_inferred_facts_fact_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_inferred_facts
    ADD CONSTRAINT ontology_inferred_facts_fact_key_key UNIQUE (fact_key);


--
-- Name: ontology_inferred_facts ontology_inferred_facts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_inferred_facts
    ADD CONSTRAINT ontology_inferred_facts_pkey PRIMARY KEY (id);


--
-- Name: ontology_reasoning_runs ontology_reasoning_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_reasoning_runs
    ADD CONSTRAINT ontology_reasoning_runs_pkey PRIMARY KEY (run_id);


--
-- Name: ontology_table_semantics ontology_table_semantics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_table_semantics
    ADD CONSTRAINT ontology_table_semantics_pkey PRIMARY KEY (table_schema, table_name);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: purchase_arrivals purchase_arrivals_arrival_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_arrivals
    ADD CONSTRAINT purchase_arrivals_arrival_no_key UNIQUE (arrival_no);


--
-- Name: purchase_arrivals purchase_arrivals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_arrivals
    ADD CONSTRAINT purchase_arrivals_pkey PRIMARY KEY (id);


--
-- Name: purchase_demands purchase_demands_demand_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_demands
    ADD CONSTRAINT purchase_demands_demand_no_key UNIQUE (demand_no);


--
-- Name: purchase_demands purchase_demands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_demands
    ADD CONSTRAINT purchase_demands_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_order_no_key UNIQUE (order_no);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_suppliers purchase_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_suppliers
    ADD CONSTRAINT purchase_suppliers_pkey PRIMARY KEY (id);


--
-- Name: purchase_suppliers purchase_suppliers_supplier_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_suppliers
    ADD CONSTRAINT purchase_suppliers_supplier_no_key UNIQUE (supplier_no);


--
-- Name: quality_audits quality_audits_audit_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_audit_no_key UNIQUE (audit_no);


--
-- Name: quality_audits quality_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_pkey PRIMARY KEY (id);


--
-- Name: quality_corrective_actions quality_corrective_actions_action_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_corrective_actions
    ADD CONSTRAINT quality_corrective_actions_action_no_key UNIQUE (action_no);


--
-- Name: quality_corrective_actions quality_corrective_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_corrective_actions
    ADD CONSTRAINT quality_corrective_actions_pkey PRIMARY KEY (id);


--
-- Name: quality_inspections quality_inspections_doc_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_doc_no_key UNIQUE (doc_no);


--
-- Name: quality_inspections quality_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_pkey PRIMARY KEY (id);


--
-- Name: quality_ncrs quality_ncrs_doc_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_ncrs
    ADD CONSTRAINT quality_ncrs_doc_no_key UNIQUE (doc_no);


--
-- Name: quality_ncrs quality_ncrs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_ncrs
    ADD CONSTRAINT quality_ncrs_pkey PRIMARY KEY (id);


--
-- Name: quality_standards quality_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_standards
    ADD CONSTRAINT quality_standards_pkey PRIMARY KEY (id);


--
-- Name: quality_standards quality_standards_standard_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_standards
    ADD CONSTRAINT quality_standards_standard_no_key UNIQUE (standard_no);


--
-- Name: raw_materials raw_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_materials
    ADD CONSTRAINT raw_materials_pkey PRIMARY KEY (id);


--
-- Name: role_data_scopes role_data_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_pkey PRIMARY KEY (id);


--
-- Name: role_data_scopes role_data_scopes_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_unique UNIQUE (role_id, module);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_customers sales_customers_customer_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_customers
    ADD CONSTRAINT sales_customers_customer_no_key UNIQUE (customer_no);


--
-- Name: sales_customers sales_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_customers
    ADD CONSTRAINT sales_customers_pkey PRIMARY KEY (id);


--
-- Name: sales_follow_ups sales_follow_ups_follow_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_follow_ups
    ADD CONSTRAINT sales_follow_ups_follow_no_key UNIQUE (follow_no);


--
-- Name: sales_follow_ups sales_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_follow_ups
    ADD CONSTRAINT sales_follow_ups_pkey PRIMARY KEY (id);


--
-- Name: sales_opportunities sales_opportunities_opportunity_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_opportunities
    ADD CONSTRAINT sales_opportunities_opportunity_no_key UNIQUE (opportunity_no);


--
-- Name: sales_opportunities sales_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_opportunities
    ADD CONSTRAINT sales_opportunities_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_order_no_key UNIQUE (order_no);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sales_payments sales_payments_payment_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_payment_no_key UNIQUE (payment_no);


--
-- Name: sales_payments sales_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_pkey PRIMARY KEY (id);


--
-- Name: smart_bi_action_items smart_bi_action_items_action_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_bi_action_items
    ADD CONSTRAINT smart_bi_action_items_action_no_key UNIQUE (action_no);


--
-- Name: smart_bi_action_items smart_bi_action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_bi_action_items
    ADD CONSTRAINT smart_bi_action_items_pkey PRIMARY KEY (id);


--
-- Name: sop_learning_records sop_learning_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_learning_records
    ADD CONSTRAINT sop_learning_records_pkey PRIMARY KEY (id);


--
-- Name: sop_learning_records sop_learning_records_username_guide_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_learning_records
    ADD CONSTRAINT sop_learning_records_username_guide_uq UNIQUE (username, guide_id);


--
-- Name: sys_dict_items sys_dict_items_dict_id_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_dict_items
    ADD CONSTRAINT sys_dict_items_dict_id_value_key UNIQUE (dict_id, value);


--
-- Name: sys_dict_items sys_dict_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_dict_items
    ADD CONSTRAINT sys_dict_items_pkey PRIMARY KEY (id);


--
-- Name: sys_dicts sys_dicts_dict_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_dicts
    ADD CONSTRAINT sys_dicts_dict_key_key UNIQUE (dict_key);


--
-- Name: sys_dicts sys_dicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_dicts
    ADD CONSTRAINT sys_dicts_pkey PRIMARY KEY (id);


--
-- Name: sys_field_acl sys_field_acl_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_field_acl
    ADD CONSTRAINT sys_field_acl_pkey PRIMARY KEY (id);


--
-- Name: sys_field_acl sys_field_acl_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_field_acl
    ADD CONSTRAINT sys_field_acl_unique UNIQUE (role_id, module, field_code);


--
-- Name: sys_grid_configs sys_grid_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_grid_configs
    ADD CONSTRAINT sys_grid_configs_pkey PRIMARY KEY (view_id);


--
-- Name: system_configs system_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_configs
    ADD CONSTRAINT system_configs_pkey PRIMARY KEY (key);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: batch_no_rules batch_no_rules_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.batch_no_rules
    ADD CONSTRAINT batch_no_rules_pkey PRIMARY KEY (id);


--
-- Name: batch_no_rules batch_no_rules_rule_name_key; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.batch_no_rules
    ADD CONSTRAINT batch_no_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: bom_items bom_items_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.bom_items
    ADD CONSTRAINT bom_items_pkey PRIMARY KEY (id);


--
-- Name: boms boms_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.boms
    ADD CONSTRAINT boms_pkey PRIMARY KEY (id);


--
-- Name: inventory_batches inventory_batches_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_batches
    ADD CONSTRAINT inventory_batches_pkey PRIMARY KEY (id);


--
-- Name: inventory_check_items inventory_check_items_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_check_items
    ADD CONSTRAINT inventory_check_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_checks inventory_checks_check_no_key; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_checks
    ADD CONSTRAINT inventory_checks_check_no_key UNIQUE (check_no);


--
-- Name: inventory_checks inventory_checks_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_checks
    ADD CONSTRAINT inventory_checks_pkey PRIMARY KEY (id);


--
-- Name: inventory_drafts inventory_drafts_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_drafts
    ADD CONSTRAINT inventory_drafts_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_transaction_no_key; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_transactions
    ADD CONSTRAINT inventory_transactions_transaction_no_key UNIQUE (transaction_no);


--
-- Name: production_work_order_items production_work_order_items_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.production_work_order_items
    ADD CONSTRAINT production_work_order_items_pkey PRIMARY KEY (id);


--
-- Name: production_work_orders production_work_orders_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.production_work_orders
    ADD CONSTRAINT production_work_orders_pkey PRIMARY KEY (id);


--
-- Name: production_work_orders production_work_orders_work_order_no_key; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.production_work_orders
    ADD CONSTRAINT production_work_orders_work_order_no_key UNIQUE (work_order_no);


--
-- Name: inventory_batches uk_batch_material_warehouse; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_batches
    ADD CONSTRAINT uk_batch_material_warehouse UNIQUE (material_id, batch_no, warehouse_id);


--
-- Name: warehouse_layouts warehouse_layouts_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.warehouse_layouts
    ADD CONSTRAINT warehouse_layouts_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: definitions definitions_pkey; Type: CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.definitions
    ADD CONSTRAINT definitions_pkey PRIMARY KEY (id);


--
-- Name: instance_events instance_events_pkey; Type: CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.instance_events
    ADD CONSTRAINT instance_events_pkey PRIMARY KEY (id);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: task_approvals task_approvals_instance_task_actor_key; Type: CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_approvals
    ADD CONSTRAINT task_approvals_instance_task_actor_key UNIQUE (instance_id, task_id, actor_username);


--
-- Name: task_approvals task_approvals_pkey; Type: CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_approvals
    ADD CONSTRAINT task_approvals_pkey PRIMARY KEY (id);


--
-- Name: task_assignments task_assignments_definition_task_key; Type: CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_assignments
    ADD CONSTRAINT task_assignments_definition_task_key UNIQUE (definition_id, task_id);


--
-- Name: task_assignments task_assignments_pkey; Type: CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_assignments
    ADD CONSTRAINT task_assignments_pkey PRIMARY KEY (id);


--
-- Name: idx_workflow_transition_rules_app; Type: INDEX; Schema: app_center; Owner: -
--

CREATE INDEX idx_workflow_transition_rules_app ON app_center.workflow_transition_rules USING btree (workflow_app_id, is_active);


--
-- Name: workflow_transition_rules_unique_active; Type: INDEX; Schema: app_center; Owner: -
--

CREATE UNIQUE INDEX workflow_transition_rules_unique_active ON app_center.workflow_transition_rules USING btree (workflow_app_id, COALESCE(from_task_id, ''::text), COALESCE(to_task_id, ''::text), COALESCE(from_state, ''::text), COALESCE(to_state, ''::text)) WHERE (is_active = true);


--
-- Name: idx_twin_knowledge_employee; Type: INDEX; Schema: app_data; Owner: -
--

CREATE INDEX idx_twin_knowledge_employee ON app_data.twin_knowledge_files USING btree (employee_id, updated_at DESC);


--
-- Name: idx_twin_knowledge_fts; Type: INDEX; Schema: app_data; Owner: -
--

CREATE INDEX idx_twin_knowledge_fts ON app_data.twin_knowledge_files USING gin (to_tsvector('simple'::regconfig, ((COALESCE(content_text, ''::text) || ' '::text) || COALESCE(file_name, ''::text))));


--
-- Name: idx_twin_messages_session; Type: INDEX; Schema: app_data; Owner: -
--

CREATE INDEX idx_twin_messages_session ON app_data.twin_messages USING btree (session_id, created_at);


--
-- Name: idx_twin_sessions_employee; Type: INDEX; Schema: app_data; Owner: -
--

CREATE INDEX idx_twin_sessions_employee ON app_data.twin_sessions USING btree (employee_id, updated_at DESC);


--
-- Name: idx_twin_tool_logs_session; Type: INDEX; Schema: app_data; Owner: -
--

CREATE INDEX idx_twin_tool_logs_session ON app_data.twin_tool_logs USING btree (session_id, created_at);


--
-- Name: agent_audit_trace_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX agent_audit_trace_idx ON company_site.agent_audit_events USING btree (site_key, trace_id, created_at);


--
-- Name: agent_messages_session_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX agent_messages_session_idx ON company_site.agent_messages USING btree (site_key, session_id, created_at);


--
-- Name: agent_sessions_inbox_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX agent_sessions_inbox_idx ON company_site.agent_sessions USING btree (site_key, status, updated_at DESC);


--
-- Name: geo_snapshots_lookup_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX geo_snapshots_lookup_idx ON company_site.geo_answer_snapshots USING btree (site_key, locale, platform, checked_at DESC);


--
-- Name: knowledge_public_lookup_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX knowledge_public_lookup_idx ON company_site.knowledge_documents USING btree (site_key, locale, status, updated_at DESC);


--
-- Name: lead_events_lookup_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX lead_events_lookup_idx ON company_site.lead_events USING btree (site_key, event_name, occurred_at DESC);


--
-- Name: leads_inbox_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX leads_inbox_idx ON company_site.leads USING btree (site_key, status, created_at DESC);


--
-- Name: pages_public_lookup_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX pages_public_lookup_idx ON company_site.content_pages USING btree (site_key, locale, status, slug);


--
-- Name: product_locales_public_lookup_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX product_locales_public_lookup_idx ON company_site.product_locales USING btree (locale, status, product_id);


--
-- Name: products_public_lookup_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX products_public_lookup_idx ON company_site.products USING btree (site_key, status, slug);


--
-- Name: seo_checks_lookup_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX seo_checks_lookup_idx ON company_site.seo_checks USING btree (site_key, path, severity, status, checked_at DESC);


--
-- Name: sync_jobs_ready_idx; Type: INDEX; Schema: company_site; Owner: -
--

CREATE INDEX sync_jobs_ready_idx ON company_site.sync_jobs USING btree (site_key, status, next_retry_at, created_at);


--
-- Name: idx_attendance_month_overrides_dept; Type: INDEX; Schema: hr; Owner: -
--

CREATE INDEX idx_attendance_month_overrides_dept ON hr.attendance_month_overrides USING btree (dept_name, att_month);


--
-- Name: idx_attendance_month_overrides_month; Type: INDEX; Schema: hr; Owner: -
--

CREATE INDEX idx_attendance_month_overrides_month ON hr.attendance_month_overrides USING btree (att_month);


--
-- Name: idx_attendance_records_date; Type: INDEX; Schema: hr; Owner: -
--

CREATE INDEX idx_attendance_records_date ON hr.attendance_records USING btree (att_date);


--
-- Name: idx_attendance_records_dept; Type: INDEX; Schema: hr; Owner: -
--

CREATE INDEX idx_attendance_records_dept ON hr.attendance_records USING btree (dept_name, att_date);


--
-- Name: idx_attendance_records_employee; Type: INDEX; Schema: hr; Owner: -
--

CREATE INDEX idx_attendance_records_employee ON hr.attendance_records USING btree (employee_id);


--
-- Name: idx_employee_profiles_archive_id; Type: INDEX; Schema: hr; Owner: -
--

CREATE INDEX idx_employee_profiles_archive_id ON hr.employee_profiles USING btree (archive_id);


--
-- Name: uniq_attendance_employee_day; Type: INDEX; Schema: hr; Owner: -
--

CREATE UNIQUE INDEX uniq_attendance_employee_day ON hr.attendance_records USING btree (att_date, employee_id) WHERE ((person_type = 'employee'::text) AND (employee_id IS NOT NULL));


--
-- Name: uniq_attendance_month_person; Type: INDEX; Schema: hr; Owner: -
--

CREATE UNIQUE INDEX uniq_attendance_month_person ON hr.attendance_month_overrides USING btree (att_month, person_key);


--
-- Name: uniq_attendance_temp_day_phone; Type: INDEX; Schema: hr; Owner: -
--

CREATE UNIQUE INDEX uniq_attendance_temp_day_phone ON hr.attendance_records USING btree (att_date, temp_phone) WHERE ((person_type = 'temp'::text) AND (temp_phone IS NOT NULL));


--
-- Name: idx_business_links_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_links_asset ON public.document_business_links USING btree (asset_id);


--
-- Name: idx_business_links_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_links_target ON public.document_business_links USING btree (target_schema, target_table, target_record_id);


--
-- Name: idx_client_log_events_device_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_log_events_device_created ON public.client_log_events USING btree (device_id, created_at DESC);


--
-- Name: idx_client_log_events_trace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_log_events_trace ON public.client_log_events USING btree (trace_id) WHERE ((trace_id IS NOT NULL) AND (trace_id <> ''::text));


--
-- Name: idx_client_log_events_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_log_events_type_created ON public.client_log_events USING btree (event_type, created_at DESC);


--
-- Name: idx_collector_devices_status_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collector_devices_status_seen ON public.collector_devices USING btree (status, last_seen_at DESC);


--
-- Name: idx_collector_devices_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collector_devices_token_hash ON public.collector_devices USING btree (device_token_hash) WHERE (device_token_hash IS NOT NULL);


--
-- Name: idx_departments_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_parent_id ON public.departments USING btree (parent_id);


--
-- Name: idx_document_assets_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_assets_batch ON public.document_assets USING btree (batch_id);


--
-- Name: idx_document_assets_device_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_assets_device_created ON public.document_assets USING btree (device_id, created_at DESC);


--
-- Name: idx_document_assets_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_assets_hash ON public.document_assets USING btree (file_hash);


--
-- Name: idx_document_assets_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_assets_status_created ON public.document_assets USING btree (status, created_at DESC);


--
-- Name: idx_document_batches_device_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_batches_device_created ON public.document_import_batches USING btree (device_id, created_at DESC);


--
-- Name: idx_document_flow_audits_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_flow_audits_source ON public.document_flow_audits USING btree (source_doc_type, source_doc_id);


--
-- Name: idx_document_flow_audits_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_flow_audits_target ON public.document_flow_audits USING btree (target_doc_type, target_doc_id);


--
-- Name: idx_document_links_relation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_links_relation ON public.document_links USING btree (relation_type, status);


--
-- Name: idx_document_links_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_links_source ON public.document_links USING btree (source_doc_type, source_doc_id);


--
-- Name: idx_document_links_source_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_links_source_no ON public.document_links USING btree (source_doc_type, source_doc_no);


--
-- Name: idx_document_links_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_links_target ON public.document_links USING btree (target_doc_type, target_doc_id);


--
-- Name: idx_document_links_target_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_links_target_no ON public.document_links USING btree (target_doc_type, target_doc_no);


--
-- Name: idx_equipment_assets_next_maint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_assets_next_maint ON public.equipment_assets USING btree (next_maint_date);


--
-- Name: idx_equipment_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_assets_status ON public.equipment_assets USING btree (run_status);


--
-- Name: idx_equipment_checks_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_checks_date ON public.equipment_checks USING btree (check_date DESC);


--
-- Name: idx_equipment_checks_result; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_checks_result ON public.equipment_checks USING btree (check_result);


--
-- Name: idx_equipment_issues_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_issues_deadline ON public.equipment_issues USING btree (deadline);


--
-- Name: idx_equipment_issues_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_issues_status ON public.equipment_issues USING btree (issue_status);


--
-- Name: idx_equipment_plans_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_plans_next ON public.equipment_maintenance_plans USING btree (next_execute_date);


--
-- Name: idx_equipment_standards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_standards_status ON public.equipment_standards USING btree (standard_status);


--
-- Name: idx_equipment_work_orders_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_work_orders_plan ON public.equipment_work_orders USING btree (plan_date);


--
-- Name: idx_equipment_work_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_work_orders_status ON public.equipment_work_orders USING btree (work_status);


--
-- Name: idx_files_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_created_at ON public.files USING btree (created_at);


--
-- Name: idx_form_values_row_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_values_row_id ON public.form_values USING btree (row_id);


--
-- Name: idx_ontology_inferred_facts_object; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ontology_inferred_facts_object ON public.ontology_inferred_facts USING btree (object_type, object_id);


--
-- Name: idx_ontology_inferred_facts_predicate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ontology_inferred_facts_predicate ON public.ontology_inferred_facts USING btree (predicate);


--
-- Name: idx_ontology_inferred_facts_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ontology_inferred_facts_run ON public.ontology_inferred_facts USING btree (run_id);


--
-- Name: idx_ontology_inferred_facts_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ontology_inferred_facts_subject ON public.ontology_inferred_facts USING btree (subject_type, subject_id);


--
-- Name: idx_parse_jobs_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parse_jobs_status_created ON public.document_parse_jobs USING btree (status, created_at);


--
-- Name: idx_positions_dept_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_positions_dept_id ON public.positions USING btree (dept_id);


--
-- Name: idx_purchase_arrivals_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_arrivals_order_id ON public.purchase_arrivals USING btree (order_id);


--
-- Name: idx_purchase_arrivals_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_arrivals_supplier_id ON public.purchase_arrivals USING btree (supplier_id);


--
-- Name: idx_purchase_orders_demand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_demand_id ON public.purchase_orders USING btree (demand_id);


--
-- Name: idx_purchase_orders_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders USING btree (supplier_id);


--
-- Name: idx_quality_actions_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_actions_due_date ON public.quality_corrective_actions USING btree (due_date);


--
-- Name: idx_quality_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_actions_status ON public.quality_corrective_actions USING btree (action_status);


--
-- Name: idx_quality_audits_plan_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_audits_plan_date ON public.quality_audits USING btree (plan_date);


--
-- Name: idx_quality_inspections_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_inspections_date ON public.quality_inspections USING btree (inspection_date DESC);


--
-- Name: idx_quality_inspections_result; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_inspections_result ON public.quality_inspections USING btree (result);


--
-- Name: idx_quality_ncrs_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_ncrs_deadline ON public.quality_ncrs USING btree (deadline);


--
-- Name: idx_quality_ncrs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_ncrs_status ON public.quality_ncrs USING btree (ncr_status);


--
-- Name: idx_quality_standards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_standards_status ON public.quality_standards USING btree (standard_status);


--
-- Name: idx_sales_orders_product_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_product_material_id ON public.sales_orders USING btree (product_material_id);


--
-- Name: idx_smart_bi_action_items_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_bi_action_items_owner ON public.smart_bi_action_items USING btree (owner_role, owner_username, status);


--
-- Name: idx_smart_bi_action_items_source_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_bi_action_items_source_message ON public.smart_bi_action_items USING btree (source_message_time, source_action_index);


--
-- Name: idx_smart_bi_action_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_bi_action_items_status ON public.smart_bi_action_items USING btree (status, updated_at DESC);


--
-- Name: idx_smart_bi_action_items_workflow_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_bi_action_items_workflow_instance ON public.smart_bi_action_items USING btree (workflow_instance_id);


--
-- Name: idx_sop_learning_records_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sop_learning_records_completed_at ON public.sop_learning_records USING btree (completed_at);


--
-- Name: idx_sop_learning_records_role_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sop_learning_records_role_module ON public.sop_learning_records USING btree (sop_role, module_name);


--
-- Name: idx_sop_learning_records_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sop_learning_records_username ON public.sop_learning_records USING btree (username);


--
-- Name: idx_sys_dict_items_dict_id_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sys_dict_items_dict_id_sort ON public.sys_dict_items USING btree (dict_id, sort);


--
-- Name: idx_unmapped_fields_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unmapped_fields_target ON public.document_unmapped_fields USING btree (target_schema, target_table, target_record_id);


--
-- Name: idx_upload_chunks_session_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_chunks_session_index ON public.document_upload_chunks USING btree (session_id, chunk_index);


--
-- Name: idx_upload_sessions_device_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upload_sessions_device_status ON public.document_upload_sessions USING btree (device_id, status, updated_at DESC);


--
-- Name: idx_users_dept_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_dept_id ON public.users USING btree (dept_id);


--
-- Name: idx_watch_folders_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watch_folders_device ON public.collector_watch_folders USING btree (device_id, enabled);


--
-- Name: uq_document_links_active_doc_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_document_links_active_doc_pair ON public.document_links USING btree (source_doc_type, COALESCE((source_doc_id)::text, source_doc_no, ''::text), target_doc_type, COALESCE((target_doc_id)::text, target_doc_no, ''::text), relation_type) WHERE (status = 'active'::text);


--
-- Name: uq_purchase_orders_demand_id_not_null; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_purchase_orders_demand_id_not_null ON public.purchase_orders USING btree (demand_id) WHERE (demand_id IS NOT NULL);


--
-- Name: idx_batch_no_rules_status; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_batch_no_rules_status ON scm.batch_no_rules USING btree (status);


--
-- Name: idx_bom_items_bom; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_bom_items_bom ON scm.bom_items USING btree (bom_id, line_no);


--
-- Name: idx_bom_items_component; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_bom_items_component ON scm.bom_items USING btree (component_material_id);


--
-- Name: idx_boms_parent_material; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_boms_parent_material ON scm.boms USING btree (parent_material_id);


--
-- Name: idx_boms_status; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_boms_status ON scm.boms USING btree (status);


--
-- Name: idx_check_items_check; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_check_items_check ON scm.inventory_check_items USING btree (check_id);


--
-- Name: idx_check_items_material; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_check_items_material ON scm.inventory_check_items USING btree (material_id);


--
-- Name: idx_checks_date; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_checks_date ON scm.inventory_checks USING btree (check_date);


--
-- Name: idx_checks_warehouse; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_checks_warehouse ON scm.inventory_checks USING btree (warehouse_id);


--
-- Name: idx_inventory_batches_batch; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_batches_batch ON scm.inventory_batches USING btree (batch_no);


--
-- Name: idx_inventory_batches_material; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_batches_material ON scm.inventory_batches USING btree (material_id);


--
-- Name: idx_inventory_batches_status; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_batches_status ON scm.inventory_batches USING btree (status);


--
-- Name: idx_inventory_batches_warehouse; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_batches_warehouse ON scm.inventory_batches USING btree (warehouse_id);


--
-- Name: idx_inventory_drafts_material; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_drafts_material ON scm.inventory_drafts USING btree (material_id);


--
-- Name: idx_inventory_drafts_status; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_drafts_status ON scm.inventory_drafts USING btree (status);


--
-- Name: idx_inventory_drafts_type; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_drafts_type ON scm.inventory_drafts USING btree (draft_type);


--
-- Name: idx_inventory_drafts_warehouse; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_inventory_drafts_warehouse ON scm.inventory_drafts USING btree (warehouse_id);


--
-- Name: idx_production_work_order_items_component; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_production_work_order_items_component ON scm.production_work_order_items USING btree (component_material_id);


--
-- Name: idx_production_work_order_items_order; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_production_work_order_items_order ON scm.production_work_order_items USING btree (work_order_id, line_no);


--
-- Name: idx_production_work_orders_product; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_production_work_orders_product ON scm.production_work_orders USING btree (product_material_id);


--
-- Name: idx_production_work_orders_status; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_production_work_orders_status ON scm.production_work_orders USING btree (work_order_status);


--
-- Name: idx_transactions_batch; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_transactions_batch ON scm.inventory_transactions USING btree (batch_id);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_transactions_date ON scm.inventory_transactions USING btree (transaction_date);


--
-- Name: idx_transactions_material; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_transactions_material ON scm.inventory_transactions USING btree (material_id);


--
-- Name: idx_transactions_no; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_transactions_no ON scm.inventory_transactions USING btree (transaction_no);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_transactions_type ON scm.inventory_transactions USING btree (transaction_type);


--
-- Name: idx_transactions_warehouse; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_transactions_warehouse ON scm.inventory_transactions USING btree (warehouse_id);


--
-- Name: idx_warehouse_layouts_warehouse; Type: INDEX; Schema: scm; Owner: -
--

CREATE UNIQUE INDEX idx_warehouse_layouts_warehouse ON scm.warehouse_layouts USING btree (warehouse_id);


--
-- Name: idx_warehouses_code; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_warehouses_code ON scm.warehouses USING btree (code);


--
-- Name: idx_warehouses_level; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_warehouses_level ON scm.warehouses USING btree (level);


--
-- Name: idx_warehouses_parent; Type: INDEX; Schema: scm; Owner: -
--

CREATE INDEX idx_warehouses_parent ON scm.warehouses USING btree (parent_id);


--
-- Name: uk_bom_items_bom_line; Type: INDEX; Schema: scm; Owner: -
--

CREATE UNIQUE INDEX uk_bom_items_bom_line ON scm.bom_items USING btree (bom_id, line_no);


--
-- Name: uk_boms_bom_no; Type: INDEX; Schema: scm; Owner: -
--

CREATE UNIQUE INDEX uk_boms_bom_no ON scm.boms USING btree (bom_no);


--
-- Name: uk_boms_parent_version; Type: INDEX; Schema: scm; Owner: -
--

CREATE UNIQUE INDEX uk_boms_parent_version ON scm.boms USING btree (parent_material_id, version);


--
-- Name: uk_production_work_order_items_order_line; Type: INDEX; Schema: scm; Owner: -
--

CREATE UNIQUE INDEX uk_production_work_order_items_order_line ON scm.production_work_order_items USING btree (work_order_id, line_no);


--
-- Name: idx_workflow_instance_events_definition_time; Type: INDEX; Schema: workflow; Owner: -
--

CREATE INDEX idx_workflow_instance_events_definition_time ON workflow.instance_events USING btree (definition_id, created_at DESC);


--
-- Name: idx_workflow_instance_events_instance_time; Type: INDEX; Schema: workflow; Owner: -
--

CREATE INDEX idx_workflow_instance_events_instance_time ON workflow.instance_events USING btree (instance_id, created_at DESC);


--
-- Name: idx_workflow_task_approvals_instance_task; Type: INDEX; Schema: workflow; Owner: -
--

CREATE INDEX idx_workflow_task_approvals_instance_task ON workflow.task_approvals USING btree (instance_id, task_id);


--
-- Name: idx_workflow_task_approvals_task_actor; Type: INDEX; Schema: workflow; Owner: -
--

CREATE INDEX idx_workflow_task_approvals_task_actor ON workflow.task_approvals USING btree (definition_id, task_id, actor_username);


--
-- Name: v_purchase_order_progress _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_purchase_order_progress AS
 SELECT o.id,
    o.order_no,
    o.demand_id,
    o.source_demand_no,
    o.supplier_id,
    o.supplier_name,
    o.material_name,
    o.quantity,
    o.unit,
    o.unit_price,
    o.total_amount,
    o.order_date,
    o.expected_arrival_date,
    o.buyer_name,
    o.order_status,
    o.status,
    o.properties,
    o.created_at,
    o.updated_at,
    (COALESCE(sum(a.arrival_quantity), (0)::numeric))::numeric(14,2) AS arrived_quantity,
    (GREATEST((o.quantity - COALESCE(sum(a.arrival_quantity), (0)::numeric)), (0)::numeric))::numeric(14,2) AS pending_quantity,
        CASE
            WHEN (COALESCE(sum(a.arrival_quantity), (0)::numeric) <= (0)::numeric) THEN '未到货'::text
            WHEN (COALESCE(sum(a.arrival_quantity), (0)::numeric) < o.quantity) THEN '部分到货'::text
            ELSE '已到齐'::text
        END AS arrival_progress
   FROM (public.purchase_orders o
     LEFT JOIN public.purchase_arrivals a ON (((a.order_id = o.id) AND (COALESCE(a.status, 'active'::text) <> 'deleted'::text))))
  GROUP BY o.id;


--
-- Name: v_boms _RETURN; Type: RULE; Schema: scm; Owner: -
--

CREATE OR REPLACE VIEW scm.v_boms AS
 SELECT b.id,
    b.bom_no,
    b.bom_name,
    b.parent_material_id,
    pm.batch_no AS parent_material_code,
    pm.name AS parent_material_name,
    pm.category AS parent_material_category,
    b.version,
    b.base_qty,
    b.unit,
    b.bom_type,
    b.status,
    b.effective_from,
    b.effective_to,
    b.remark,
    b.properties,
    (COALESCE(count(i.id), (0)::bigint))::integer AS item_count,
    (COALESCE(sum((i.qty * ((1)::numeric + i.loss_rate))), (0)::numeric))::numeric(18,6) AS component_qty_total,
    b.created_by,
    b.created_at,
    b.updated_at
   FROM ((scm.boms b
     JOIN public.raw_materials pm ON ((pm.id = b.parent_material_id)))
     LEFT JOIN scm.bom_items i ON ((i.bom_id = b.id)))
  GROUP BY b.id, pm.id;


--
-- Name: apps apps_update_timestamp; Type: TRIGGER; Schema: app_center; Owner: -
--

CREATE TRIGGER apps_update_timestamp BEFORE UPDATE ON app_center.apps FOR EACH ROW EXECUTE FUNCTION app_center.update_timestamp();


--
-- Name: categories categories_update_timestamp; Type: TRIGGER; Schema: app_center; Owner: -
--

CREATE TRIGGER categories_update_timestamp BEFORE UPDATE ON app_center.categories FOR EACH ROW EXECUTE FUNCTION app_center.update_timestamp();


--
-- Name: archives trg_eis_notify_hr_archives; Type: TRIGGER; Schema: hr; Owner: -
--

CREATE TRIGGER trg_eis_notify_hr_archives AFTER INSERT OR DELETE OR UPDATE ON hr.archives FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: attendance_month_overrides trg_eis_notify_hr_attendance_month_overrides; Type: TRIGGER; Schema: hr; Owner: -
--

CREATE TRIGGER trg_eis_notify_hr_attendance_month_overrides AFTER INSERT OR DELETE OR UPDATE ON hr.attendance_month_overrides FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: attendance_records trg_eis_notify_hr_attendance_records; Type: TRIGGER; Schema: hr; Owner: -
--

CREATE TRIGGER trg_eis_notify_hr_attendance_records AFTER INSERT OR DELETE OR UPDATE ON hr.attendance_records FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: attendance_shifts trg_eis_notify_hr_attendance_shifts; Type: TRIGGER; Schema: hr; Owner: -
--

CREATE TRIGGER trg_eis_notify_hr_attendance_shifts AFTER INSERT OR DELETE OR UPDATE ON hr.attendance_shifts FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: field_label_overrides tg_field_label_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_field_label_overrides_updated_at BEFORE UPDATE ON public.field_label_overrides FOR EACH ROW EXECUTE FUNCTION public.touch_field_label_overrides();


--
-- Name: permissions tg_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_permissions_updated_at BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: role_data_scopes tg_role_data_scopes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_role_data_scopes_updated_at BEFORE UPDATE ON public.role_data_scopes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: role_permissions tg_role_permissions_cascade_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_role_permissions_cascade_delete AFTER DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.cascade_revoke_permissions();


--
-- Name: role_permissions tg_role_permissions_cascade_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_role_permissions_cascade_insert AFTER INSERT ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.cascade_grant_permissions();


--
-- Name: roles tg_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sop_learning_records tg_sop_learning_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_sop_learning_records_updated_at BEFORE UPDATE ON public.sop_learning_records FOR EACH ROW EXECUTE FUNCTION public.touch_sop_learning_records();


--
-- Name: system_configs tg_sync_field_acl_configs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_sync_field_acl_configs AFTER INSERT OR UPDATE ON public.system_configs FOR EACH ROW EXECUTE FUNCTION public.sync_field_acl_from_config();


--
-- Name: sys_field_acl tg_sys_field_acl_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_sys_field_acl_updated_at BEFORE UPDATE ON public.sys_field_acl FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: v_role_data_scopes_matrix tg_v_role_data_scopes_matrix_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_role_data_scopes_matrix_update INSTEAD OF UPDATE ON public.v_role_data_scopes_matrix FOR EACH ROW EXECUTE FUNCTION public.tg_v_role_data_scopes_matrix_update();


--
-- Name: v_role_permissions_matrix tg_v_role_permissions_matrix_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_role_permissions_matrix_update INSTEAD OF UPDATE ON public.v_role_permissions_matrix FOR EACH ROW EXECUTE FUNCTION public.tg_v_role_permissions_matrix_update();


--
-- Name: v_roles_manage tg_v_roles_manage_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_roles_manage_delete INSTEAD OF DELETE ON public.v_roles_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_roles_manage_delete();


--
-- Name: v_roles_manage tg_v_roles_manage_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_roles_manage_insert INSTEAD OF INSERT ON public.v_roles_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_roles_manage_insert();


--
-- Name: v_roles_manage tg_v_roles_manage_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_roles_manage_update INSTEAD OF UPDATE ON public.v_roles_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_roles_manage_update();


--
-- Name: v_users_manage tg_v_users_manage_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_users_manage_delete INSTEAD OF DELETE ON public.v_users_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_users_manage_delete();


--
-- Name: v_users_manage tg_v_users_manage_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_users_manage_insert INSTEAD OF INSERT ON public.v_users_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_users_manage_insert();


--
-- Name: v_users_manage tg_v_users_manage_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_v_users_manage_update INSTEAD OF UPDATE ON public.v_users_manage FOR EACH ROW EXECUTE FUNCTION public.tg_v_users_manage_update();


--
-- Name: collector_devices trg_collector_devices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collector_devices_updated_at BEFORE UPDATE ON public.collector_devices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: collector_watch_folders trg_collector_watch_folders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collector_watch_folders_updated_at BEFORE UPDATE ON public.collector_watch_folders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: document_assets trg_document_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_assets_updated_at BEFORE UPDATE ON public.document_assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: document_entry_plans trg_document_entry_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_entry_plans_updated_at BEFORE UPDATE ON public.document_entry_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: document_import_batches trg_document_import_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_import_batches_updated_at BEFORE UPDATE ON public.document_import_batches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: document_links trg_document_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_links_updated_at BEFORE UPDATE ON public.document_links FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: document_parse_jobs trg_document_parse_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_parse_jobs_updated_at BEFORE UPDATE ON public.document_parse_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: document_upload_sessions trg_document_upload_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_upload_sessions_updated_at BEFORE UPDATE ON public.document_upload_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: equipment_assets trg_eis_notify_public_equipment_assets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_equipment_assets AFTER INSERT OR DELETE OR UPDATE ON public.equipment_assets FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: equipment_checks trg_eis_notify_public_equipment_checks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_equipment_checks AFTER INSERT OR DELETE OR UPDATE ON public.equipment_checks FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: equipment_issues trg_eis_notify_public_equipment_issues; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_equipment_issues AFTER INSERT OR DELETE OR UPDATE ON public.equipment_issues FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: equipment_maintenance_plans trg_eis_notify_public_equipment_maintenance_plans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_equipment_maintenance_plans AFTER INSERT OR DELETE OR UPDATE ON public.equipment_maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: equipment_standards trg_eis_notify_public_equipment_standards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_equipment_standards AFTER INSERT OR DELETE OR UPDATE ON public.equipment_standards FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: equipment_work_orders trg_eis_notify_public_equipment_work_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_equipment_work_orders AFTER INSERT OR DELETE OR UPDATE ON public.equipment_work_orders FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: quality_audits trg_eis_notify_public_quality_audits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_quality_audits AFTER INSERT OR DELETE OR UPDATE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: quality_corrective_actions trg_eis_notify_public_quality_corrective_actions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_quality_corrective_actions AFTER INSERT OR DELETE OR UPDATE ON public.quality_corrective_actions FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: quality_inspections trg_eis_notify_public_quality_inspections; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_quality_inspections AFTER INSERT OR DELETE OR UPDATE ON public.quality_inspections FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: quality_ncrs trg_eis_notify_public_quality_ncrs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_quality_ncrs AFTER INSERT OR DELETE OR UPDATE ON public.quality_ncrs FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: quality_standards trg_eis_notify_public_quality_standards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_quality_standards AFTER INSERT OR DELETE OR UPDATE ON public.quality_standards FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: raw_materials trg_eis_notify_public_raw_materials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eis_notify_public_raw_materials AFTER INSERT OR DELETE OR UPDATE ON public.raw_materials FOR EACH ROW EXECUTE FUNCTION public.notify_eis_events();


--
-- Name: equipment_assets trg_equipment_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_assets_updated_at BEFORE UPDATE ON public.equipment_assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: equipment_checks trg_equipment_checks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_checks_updated_at BEFORE UPDATE ON public.equipment_checks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: equipment_issues trg_equipment_issues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_issues_updated_at BEFORE UPDATE ON public.equipment_issues FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: equipment_maintenance_plans trg_equipment_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_plans_updated_at BEFORE UPDATE ON public.equipment_maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: equipment_standards trg_equipment_standards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_standards_updated_at BEFORE UPDATE ON public.equipment_standards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: equipment_work_orders trg_equipment_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_work_orders_updated_at BEFORE UPDATE ON public.equipment_work_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: files trg_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: purchase_arrivals trg_purchase_arrivals_fill_order_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_arrivals_fill_order_fields BEFORE INSERT OR UPDATE OF order_id, order_no ON public.purchase_arrivals FOR EACH ROW EXECUTE FUNCTION public.purchase_fill_arrival_order_fields();


--
-- Name: purchase_arrivals trg_purchase_arrivals_normalize_quality_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_arrivals_normalize_quality_fields BEFORE INSERT OR UPDATE OF arrival_quantity, accepted_quantity, iqc_status, inbound_no, arrival_status ON public.purchase_arrivals FOR EACH ROW EXECUTE FUNCTION public.purchase_normalize_arrival_quality_fields();


--
-- Name: purchase_arrivals trg_purchase_arrivals_refresh_order_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_arrivals_refresh_order_status AFTER INSERT OR DELETE OR UPDATE ON public.purchase_arrivals FOR EACH ROW EXECUTE FUNCTION public.purchase_refresh_order_arrival_status_trigger();


--
-- Name: purchase_arrivals trg_purchase_arrivals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_arrivals_updated_at BEFORE UPDATE ON public.purchase_arrivals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: purchase_demands trg_purchase_demands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_demands_updated_at BEFORE UPDATE ON public.purchase_demands FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: purchase_orders trg_purchase_orders_refresh_arrival_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_orders_refresh_arrival_status AFTER UPDATE OF quantity ON public.purchase_orders FOR EACH ROW WHEN ((old.quantity IS DISTINCT FROM new.quantity)) EXECUTE FUNCTION public.purchase_refresh_order_arrival_status_from_order_trigger();


--
-- Name: purchase_orders trg_purchase_orders_total_amount; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_orders_total_amount BEFORE INSERT OR UPDATE OF quantity, unit_price ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.purchase_set_order_total_amount();


--
-- Name: purchase_orders trg_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: purchase_suppliers trg_purchase_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_suppliers_updated_at BEFORE UPDATE ON public.purchase_suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: quality_audits trg_quality_audits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_audits_updated_at BEFORE UPDATE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: quality_corrective_actions trg_quality_corrective_actions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_corrective_actions_updated_at BEFORE UPDATE ON public.quality_corrective_actions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: quality_inspections trg_quality_inspections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_inspections_updated_at BEFORE UPDATE ON public.quality_inspections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: quality_ncrs trg_quality_ncrs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_ncrs_updated_at BEFORE UPDATE ON public.quality_ncrs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: quality_standards trg_quality_standards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_standards_updated_at BEFORE UPDATE ON public.quality_standards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: raw_materials trg_raw_materials_set_dept_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_raw_materials_set_dept_id BEFORE INSERT ON public.raw_materials FOR EACH ROW EXECUTE FUNCTION public.raw_materials_set_dept_id();


--
-- Name: sales_customers trg_sales_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_customers_updated_at BEFORE UPDATE ON public.sales_customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sales_follow_ups trg_sales_follow_ups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_follow_ups_updated_at BEFORE UPDATE ON public.sales_follow_ups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sales_opportunities trg_sales_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_opportunities_updated_at BEFORE UPDATE ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sales_orders trg_sales_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sales_payments trg_sales_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_payments_updated_at BEFORE UPDATE ON public.sales_payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: smart_bi_action_items trg_smart_bi_action_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_smart_bi_action_items_updated_at BEFORE UPDATE ON public.smart_bi_action_items FOR EACH ROW EXECUTE FUNCTION public.touch_smart_bi_action_items_updated_at();


--
-- Name: sys_dict_items trg_sys_dict_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sys_dict_items_updated_at BEFORE UPDATE ON public.sys_dict_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sys_dicts trg_sys_dicts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sys_dicts_updated_at BEFORE UPDATE ON public.sys_dicts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bom_items trg_bom_items_touch_updated_at; Type: TRIGGER; Schema: scm; Owner: -
--

CREATE TRIGGER trg_bom_items_touch_updated_at BEFORE UPDATE ON scm.bom_items FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();


--
-- Name: bom_items trg_bom_items_validate; Type: TRIGGER; Schema: scm; Owner: -
--

CREATE TRIGGER trg_bom_items_validate BEFORE INSERT OR UPDATE ON scm.bom_items FOR EACH ROW EXECUTE FUNCTION scm.validate_bom_item();


--
-- Name: boms trg_boms_touch_updated_at; Type: TRIGGER; Schema: scm; Owner: -
--

CREATE TRIGGER trg_boms_touch_updated_at BEFORE UPDATE ON scm.boms FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();


--
-- Name: production_work_order_items trg_production_work_order_items_touch_updated_at; Type: TRIGGER; Schema: scm; Owner: -
--

CREATE TRIGGER trg_production_work_order_items_touch_updated_at BEFORE UPDATE ON scm.production_work_order_items FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();


--
-- Name: production_work_orders trg_production_work_orders_touch_updated_at; Type: TRIGGER; Schema: scm; Owner: -
--

CREATE TRIGGER trg_production_work_orders_touch_updated_at BEFORE UPDATE ON scm.production_work_orders FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();


--
-- Name: instance_events trg_close_smart_bi_action_item_from_workflow_event; Type: TRIGGER; Schema: workflow; Owner: -
--

CREATE TRIGGER trg_close_smart_bi_action_item_from_workflow_event AFTER INSERT OR UPDATE OF payload ON workflow.instance_events FOR EACH ROW EXECUTE FUNCTION public.close_smart_bi_action_item_from_workflow_event();


--
-- Name: instances trg_sync_smart_bi_action_item_from_workflow; Type: TRIGGER; Schema: workflow; Owner: -
--

CREATE TRIGGER trg_sync_smart_bi_action_item_from_workflow AFTER INSERT OR UPDATE OF current_task_id, status, variables ON workflow.instances FOR EACH ROW EXECUTE FUNCTION public.sync_smart_bi_action_item_from_workflow();


--
-- Name: instances workflow_instance_trigger; Type: TRIGGER; Schema: workflow; Owner: -
--

CREATE TRIGGER workflow_instance_trigger AFTER INSERT OR UPDATE ON workflow.instances FOR EACH ROW EXECUTE FUNCTION workflow.notify_instance_update();


--
-- Name: instances workflow_instances_notify; Type: TRIGGER; Schema: workflow; Owner: -
--

CREATE TRIGGER workflow_instances_notify AFTER INSERT OR UPDATE ON workflow.instances FOR EACH ROW EXECUTE FUNCTION workflow.notify_instance_change();


--
-- Name: apps apps_category_id_fkey; Type: FK CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.apps
    ADD CONSTRAINT apps_category_id_fkey FOREIGN KEY (category_id) REFERENCES app_center.categories(id) ON DELETE SET NULL;


--
-- Name: execution_logs execution_logs_app_id_fkey; Type: FK CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.execution_logs
    ADD CONSTRAINT execution_logs_app_id_fkey FOREIGN KEY (app_id) REFERENCES app_center.apps(id) ON DELETE CASCADE;


--
-- Name: published_routes published_routes_app_id_fkey; Type: FK CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.published_routes
    ADD CONSTRAINT published_routes_app_id_fkey FOREIGN KEY (app_id) REFERENCES app_center.apps(id) ON DELETE CASCADE;


--
-- Name: workflow_permission_policies workflow_permission_policies_workflow_app_id_fkey; Type: FK CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_permission_policies
    ADD CONSTRAINT workflow_permission_policies_workflow_app_id_fkey FOREIGN KEY (workflow_app_id) REFERENCES app_center.apps(id) ON DELETE CASCADE;


--
-- Name: workflow_state_mappings workflow_state_mappings_workflow_app_id_fkey; Type: FK CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_state_mappings
    ADD CONSTRAINT workflow_state_mappings_workflow_app_id_fkey FOREIGN KEY (workflow_app_id) REFERENCES app_center.apps(id) ON DELETE CASCADE;


--
-- Name: workflow_transition_rules workflow_transition_rules_workflow_app_id_fkey; Type: FK CONSTRAINT; Schema: app_center; Owner: -
--

ALTER TABLE ONLY app_center.workflow_transition_rules
    ADD CONSTRAINT workflow_transition_rules_workflow_app_id_fkey FOREIGN KEY (workflow_app_id) REFERENCES app_center.apps(id) ON DELETE CASCADE;


--
-- Name: twin_messages twin_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.twin_messages
    ADD CONSTRAINT twin_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES app_data.twin_sessions(id) ON DELETE CASCADE;


--
-- Name: twin_tool_logs twin_tool_logs_message_id_fkey; Type: FK CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.twin_tool_logs
    ADD CONSTRAINT twin_tool_logs_message_id_fkey FOREIGN KEY (message_id) REFERENCES app_data.twin_messages(id) ON DELETE SET NULL;


--
-- Name: twin_tool_logs twin_tool_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: app_data; Owner: -
--

ALTER TABLE ONLY app_data.twin_tool_logs
    ADD CONSTRAINT twin_tool_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES app_data.twin_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_audit_events agent_audit_events_session_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_audit_events
    ADD CONSTRAINT agent_audit_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES company_site.agent_sessions(id) ON DELETE SET NULL;


--
-- Name: agent_audit_events agent_audit_events_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_audit_events
    ADD CONSTRAINT agent_audit_events_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: agent_messages agent_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_messages
    ADD CONSTRAINT agent_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES company_site.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_messages agent_messages_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_messages
    ADD CONSTRAINT agent_messages_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: agent_qualification_rules agent_qualification_rules_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_qualification_rules
    ADD CONSTRAINT agent_qualification_rules_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: agent_sessions agent_sessions_lead_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_sessions
    ADD CONSTRAINT agent_sessions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES company_site.leads(id) ON DELETE SET NULL;


--
-- Name: agent_sessions agent_sessions_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.agent_sessions
    ADD CONSTRAINT agent_sessions_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: audit_events audit_events_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.audit_events
    ADD CONSTRAINT audit_events_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE SET NULL;


--
-- Name: cases cases_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.cases
    ADD CONSTRAINT cases_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: certificates certificates_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.certificates
    ADD CONSTRAINT certificates_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: content_pages content_pages_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.content_pages
    ADD CONSTRAINT content_pages_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: content_revisions content_revisions_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.content_revisions
    ADD CONSTRAINT content_revisions_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: evidence_records evidence_records_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.evidence_records
    ADD CONSTRAINT evidence_records_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: geo_answer_snapshots geo_answer_snapshots_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.geo_answer_snapshots
    ADD CONSTRAINT geo_answer_snapshots_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.knowledge_documents
    ADD CONSTRAINT knowledge_documents_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: lead_events lead_events_lead_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.lead_events
    ADD CONSTRAINT lead_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES company_site.leads(id) ON DELETE SET NULL;


--
-- Name: lead_events lead_events_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.lead_events
    ADD CONSTRAINT lead_events_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: leads leads_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.leads
    ADD CONSTRAINT leads_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: media_assets media_assets_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.media_assets
    ADD CONSTRAINT media_assets_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: opportunity_drafts opportunity_drafts_lead_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.opportunity_drafts
    ADD CONSTRAINT opportunity_drafts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES company_site.leads(id) ON DELETE RESTRICT;


--
-- Name: opportunity_drafts opportunity_drafts_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.opportunity_drafts
    ADD CONSTRAINT opportunity_drafts_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: opportunity_drafts opportunity_drafts_source_session_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.opportunity_drafts
    ADD CONSTRAINT opportunity_drafts_source_session_id_fkey FOREIGN KEY (source_session_id) REFERENCES company_site.agent_sessions(id) ON DELETE SET NULL;


--
-- Name: product_locales product_locales_product_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.product_locales
    ADD CONSTRAINT product_locales_product_id_fkey FOREIGN KEY (product_id) REFERENCES company_site.products(id) ON DELETE CASCADE;


--
-- Name: production_work_order_drafts production_work_order_drafts_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.production_work_order_drafts
    ADD CONSTRAINT production_work_order_drafts_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES company_site.sales_order_drafts(id) ON DELETE RESTRICT;


--
-- Name: production_work_order_drafts production_work_order_drafts_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.production_work_order_drafts
    ADD CONSTRAINT production_work_order_drafts_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: products products_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.products
    ADD CONSTRAINT products_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: quote_drafts quote_drafts_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.quote_drafts
    ADD CONSTRAINT quote_drafts_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES company_site.opportunity_drafts(id) ON DELETE RESTRICT;


--
-- Name: quote_drafts quote_drafts_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.quote_drafts
    ADD CONSTRAINT quote_drafts_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: sales_order_drafts sales_order_drafts_quote_id_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.sales_order_drafts
    ADD CONSTRAINT sales_order_drafts_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES company_site.quote_drafts(id) ON DELETE RESTRICT;


--
-- Name: sales_order_drafts sales_order_drafts_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.sales_order_drafts
    ADD CONSTRAINT sales_order_drafts_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: seo_checks seo_checks_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_checks
    ADD CONSTRAINT seo_checks_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: seo_keywords seo_keywords_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_keywords
    ADD CONSTRAINT seo_keywords_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: seo_metadata seo_metadata_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.seo_metadata
    ADD CONSTRAINT seo_metadata_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: site_locales site_locales_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.site_locales
    ADD CONSTRAINT site_locales_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: solutions solutions_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.solutions
    ADD CONSTRAINT solutions_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: sync_jobs sync_jobs_site_key_fkey; Type: FK CONSTRAINT; Schema: company_site; Owner: -
--

ALTER TABLE ONLY company_site.sync_jobs
    ADD CONSTRAINT sync_jobs_site_key_fkey FOREIGN KEY (site_key) REFERENCES company_site.site_config(site_key) ON DELETE CASCADE;


--
-- Name: baseline_migration_coverage baseline_migration_coverage_baseline_id_fkey; Type: FK CONSTRAINT; Schema: eiscore_meta; Owner: -
--

ALTER TABLE ONLY eiscore_meta.baseline_migration_coverage
    ADD CONSTRAINT baseline_migration_coverage_baseline_id_fkey FOREIGN KEY (baseline_id) REFERENCES eiscore_meta.database_baselines(baseline_id) ON DELETE RESTRICT;


--
-- Name: attendance_records attendance_records_shift_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.attendance_records
    ADD CONSTRAINT attendance_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES hr.attendance_shifts(id);


--
-- Name: employee_profiles employee_profiles_archive_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.employee_profiles
    ADD CONSTRAINT employee_profiles_archive_id_fkey FOREIGN KEY (archive_id) REFERENCES hr.archives(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_archive_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: -
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_archive_id_fkey FOREIGN KEY (archive_id) REFERENCES hr.archives(id);


--
-- Name: ai_business_corrections ai_business_corrections_business_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_business_corrections
    ADD CONSTRAINT ai_business_corrections_business_link_id_fkey FOREIGN KEY (business_link_id) REFERENCES public.document_business_links(id) ON DELETE SET NULL;


--
-- Name: client_log_events client_log_events_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_log_events
    ADD CONSTRAINT client_log_events_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.collector_devices(id) ON DELETE SET NULL;


--
-- Name: client_log_sessions client_log_sessions_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_log_sessions
    ADD CONSTRAINT client_log_sessions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.collector_devices(id) ON DELETE SET NULL;


--
-- Name: collector_watch_folders collector_watch_folders_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_watch_folders
    ADD CONSTRAINT collector_watch_folders_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.collector_devices(id) ON DELETE CASCADE;


--
-- Name: departments departments_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: document_assets document_assets_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assets
    ADD CONSTRAINT document_assets_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.document_import_batches(id) ON DELETE SET NULL;


--
-- Name: document_assets document_assets_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assets
    ADD CONSTRAINT document_assets_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.collector_devices(id) ON DELETE SET NULL;


--
-- Name: document_assets document_assets_duplicate_of_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assets
    ADD CONSTRAINT document_assets_duplicate_of_asset_id_fkey FOREIGN KEY (duplicate_of_asset_id) REFERENCES public.document_assets(id) ON DELETE SET NULL;


--
-- Name: document_business_links document_business_links_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_business_links
    ADD CONSTRAINT document_business_links_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.document_assets(id) ON DELETE CASCADE;


--
-- Name: document_business_links document_business_links_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_business_links
    ADD CONSTRAINT document_business_links_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.document_import_batches(id) ON DELETE SET NULL;


--
-- Name: document_business_links document_business_links_entry_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_business_links
    ADD CONSTRAINT document_business_links_entry_plan_id_fkey FOREIGN KEY (entry_plan_id) REFERENCES public.document_entry_plans(id) ON DELETE SET NULL;


--
-- Name: document_classification_results document_classification_results_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_classification_results
    ADD CONSTRAINT document_classification_results_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.document_assets(id) ON DELETE CASCADE;


--
-- Name: document_classification_results document_classification_results_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_classification_results
    ADD CONSTRAINT document_classification_results_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.document_import_batches(id) ON DELETE SET NULL;


--
-- Name: document_entry_plans document_entry_plans_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_entry_plans
    ADD CONSTRAINT document_entry_plans_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.document_assets(id) ON DELETE CASCADE;


--
-- Name: document_entry_plans document_entry_plans_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_entry_plans
    ADD CONSTRAINT document_entry_plans_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.document_import_batches(id) ON DELETE SET NULL;


--
-- Name: document_import_batches document_import_batches_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_import_batches
    ADD CONSTRAINT document_import_batches_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.collector_devices(id) ON DELETE SET NULL;


--
-- Name: document_parse_jobs document_parse_jobs_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_parse_jobs
    ADD CONSTRAINT document_parse_jobs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.document_assets(id) ON DELETE CASCADE;


--
-- Name: document_parse_jobs document_parse_jobs_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_parse_jobs
    ADD CONSTRAINT document_parse_jobs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.document_import_batches(id) ON DELETE SET NULL;


--
-- Name: document_parse_results document_parse_results_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_parse_results
    ADD CONSTRAINT document_parse_results_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.document_assets(id) ON DELETE CASCADE;


--
-- Name: document_parse_results document_parse_results_parse_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_parse_results
    ADD CONSTRAINT document_parse_results_parse_job_id_fkey FOREIGN KEY (parse_job_id) REFERENCES public.document_parse_jobs(id) ON DELETE SET NULL;


--
-- Name: document_unmapped_fields document_unmapped_fields_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_unmapped_fields
    ADD CONSTRAINT document_unmapped_fields_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.document_assets(id) ON DELETE CASCADE;


--
-- Name: document_unmapped_fields document_unmapped_fields_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_unmapped_fields
    ADD CONSTRAINT document_unmapped_fields_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.document_import_batches(id) ON DELETE SET NULL;


--
-- Name: document_unmapped_fields document_unmapped_fields_entry_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_unmapped_fields
    ADD CONSTRAINT document_unmapped_fields_entry_plan_id_fkey FOREIGN KEY (entry_plan_id) REFERENCES public.document_entry_plans(id) ON DELETE SET NULL;


--
-- Name: document_upload_chunks document_upload_chunks_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_upload_chunks
    ADD CONSTRAINT document_upload_chunks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.document_upload_sessions(id) ON DELETE CASCADE;


--
-- Name: document_upload_sessions document_upload_sessions_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_upload_sessions
    ADD CONSTRAINT document_upload_sessions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.collector_devices(id) ON DELETE CASCADE;


--
-- Name: equipment_checks equipment_checks_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.equipment_assets(id) ON DELETE SET NULL;


--
-- Name: equipment_issues equipment_issues_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_issues
    ADD CONSTRAINT equipment_issues_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.equipment_assets(id) ON DELETE SET NULL;


--
-- Name: equipment_work_orders equipment_work_orders_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_work_orders
    ADD CONSTRAINT equipment_work_orders_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.equipment_assets(id) ON DELETE SET NULL;


--
-- Name: equipment_work_orders equipment_work_orders_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_work_orders
    ADD CONSTRAINT equipment_work_orders_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.equipment_issues(id) ON DELETE SET NULL;


--
-- Name: ontology_inferred_facts ontology_inferred_facts_inference_rule_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_inferred_facts
    ADD CONSTRAINT ontology_inferred_facts_inference_rule_fkey FOREIGN KEY (inference_rule) REFERENCES public.ontology_inference_rules(rule_code) ON DELETE SET NULL;


--
-- Name: ontology_inferred_facts ontology_inferred_facts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ontology_inferred_facts
    ADD CONSTRAINT ontology_inferred_facts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ontology_reasoning_runs(run_id) ON DELETE CASCADE;


--
-- Name: positions positions_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: purchase_arrivals purchase_arrivals_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_arrivals
    ADD CONSTRAINT purchase_arrivals_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: purchase_arrivals purchase_arrivals_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_arrivals
    ADD CONSTRAINT purchase_arrivals_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.purchase_suppliers(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_demand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_demand_id_fkey FOREIGN KEY (demand_id) REFERENCES public.purchase_demands(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.purchase_suppliers(id) ON DELETE SET NULL;


--
-- Name: quality_corrective_actions quality_corrective_actions_ncr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_corrective_actions
    ADD CONSTRAINT quality_corrective_actions_ncr_id_fkey FOREIGN KEY (ncr_id) REFERENCES public.quality_ncrs(id) ON DELETE SET NULL;


--
-- Name: quality_ncrs quality_ncrs_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_ncrs
    ADD CONSTRAINT quality_ncrs_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.quality_inspections(id) ON DELETE SET NULL;


--
-- Name: raw_materials raw_materials_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_materials
    ADD CONSTRAINT raw_materials_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: role_data_scopes role_data_scopes_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: role_data_scopes role_data_scopes_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_data_scopes
    ADD CONSTRAINT role_data_scopes_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: sales_follow_ups sales_follow_ups_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_follow_ups
    ADD CONSTRAINT sales_follow_ups_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE SET NULL;


--
-- Name: sales_opportunities sales_opportunities_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_opportunities
    ADD CONSTRAINT sales_opportunities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE SET NULL;


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE SET NULL;


--
-- Name: sales_orders sales_orders_product_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_product_material_id_fkey FOREIGN KEY (product_material_id) REFERENCES public.raw_materials(id);


--
-- Name: sales_payments sales_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.sales_customers(id) ON DELETE SET NULL;


--
-- Name: sales_payments sales_payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE SET NULL;


--
-- Name: smart_bi_action_items smart_bi_action_items_workflow_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_bi_action_items
    ADD CONSTRAINT smart_bi_action_items_workflow_definition_id_fkey FOREIGN KEY (workflow_definition_id) REFERENCES workflow.definitions(id) ON DELETE SET NULL;


--
-- Name: smart_bi_action_items smart_bi_action_items_workflow_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_bi_action_items
    ADD CONSTRAINT smart_bi_action_items_workflow_instance_id_fkey FOREIGN KEY (workflow_instance_id) REFERENCES workflow.instances(id) ON DELETE SET NULL;


--
-- Name: sys_dict_items sys_dict_items_dict_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_dict_items
    ADD CONSTRAINT sys_dict_items_dict_id_fkey FOREIGN KEY (dict_id) REFERENCES public.sys_dicts(id) ON DELETE CASCADE;


--
-- Name: sys_field_acl sys_field_acl_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sys_field_acl
    ADD CONSTRAINT sys_field_acl_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: users users_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL;


--
-- Name: batch_no_rules batch_no_rules_dept_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.batch_no_rules
    ADD CONSTRAINT batch_no_rules_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id);


--
-- Name: bom_items bom_items_bom_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.bom_items
    ADD CONSTRAINT bom_items_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES scm.boms(id) ON DELETE CASCADE;


--
-- Name: bom_items bom_items_component_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.bom_items
    ADD CONSTRAINT bom_items_component_material_id_fkey FOREIGN KEY (component_material_id) REFERENCES public.raw_materials(id);


--
-- Name: boms boms_parent_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.boms
    ADD CONSTRAINT boms_parent_material_id_fkey FOREIGN KEY (parent_material_id) REFERENCES public.raw_materials(id);


--
-- Name: inventory_batches inventory_batches_dept_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_batches
    ADD CONSTRAINT inventory_batches_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id);


--
-- Name: inventory_batches inventory_batches_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_batches
    ADD CONSTRAINT inventory_batches_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.raw_materials(id);


--
-- Name: inventory_batches inventory_batches_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_batches
    ADD CONSTRAINT inventory_batches_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES scm.warehouses(id);


--
-- Name: inventory_check_items inventory_check_items_check_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_check_items
    ADD CONSTRAINT inventory_check_items_check_id_fkey FOREIGN KEY (check_id) REFERENCES scm.inventory_checks(id) ON DELETE CASCADE;


--
-- Name: inventory_check_items inventory_check_items_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_check_items
    ADD CONSTRAINT inventory_check_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.raw_materials(id);


--
-- Name: inventory_check_items inventory_check_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_check_items
    ADD CONSTRAINT inventory_check_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES scm.warehouses(id);


--
-- Name: inventory_checks inventory_checks_dept_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_checks
    ADD CONSTRAINT inventory_checks_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id);


--
-- Name: inventory_checks inventory_checks_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_checks
    ADD CONSTRAINT inventory_checks_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES scm.warehouses(id);


--
-- Name: inventory_drafts inventory_drafts_batch_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_drafts
    ADD CONSTRAINT inventory_drafts_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES scm.inventory_batches(id);


--
-- Name: inventory_drafts inventory_drafts_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_drafts
    ADD CONSTRAINT inventory_drafts_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.raw_materials(id);


--
-- Name: inventory_drafts inventory_drafts_rule_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_drafts
    ADD CONSTRAINT inventory_drafts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES scm.batch_no_rules(id);


--
-- Name: inventory_drafts inventory_drafts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_drafts
    ADD CONSTRAINT inventory_drafts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES scm.warehouses(id);


--
-- Name: inventory_transactions inventory_transactions_batch_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_transactions
    ADD CONSTRAINT inventory_transactions_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES scm.inventory_batches(id);


--
-- Name: inventory_transactions inventory_transactions_dept_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_transactions
    ADD CONSTRAINT inventory_transactions_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id);


--
-- Name: inventory_transactions inventory_transactions_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_transactions
    ADD CONSTRAINT inventory_transactions_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.raw_materials(id);


--
-- Name: inventory_transactions inventory_transactions_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.inventory_transactions
    ADD CONSTRAINT inventory_transactions_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES scm.warehouses(id);


--
-- Name: production_work_order_items production_work_order_items_component_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.production_work_order_items
    ADD CONSTRAINT production_work_order_items_component_material_id_fkey FOREIGN KEY (component_material_id) REFERENCES public.raw_materials(id);


--
-- Name: production_work_order_items production_work_order_items_work_order_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.production_work_order_items
    ADD CONSTRAINT production_work_order_items_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES scm.production_work_orders(id) ON DELETE CASCADE;


--
-- Name: production_work_orders production_work_orders_bom_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.production_work_orders
    ADD CONSTRAINT production_work_orders_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES scm.boms(id) ON DELETE SET NULL;


--
-- Name: production_work_orders production_work_orders_product_material_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.production_work_orders
    ADD CONSTRAINT production_work_orders_product_material_id_fkey FOREIGN KEY (product_material_id) REFERENCES public.raw_materials(id);


--
-- Name: warehouse_layouts warehouse_layouts_dept_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.warehouse_layouts
    ADD CONSTRAINT warehouse_layouts_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id);


--
-- Name: warehouse_layouts warehouse_layouts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.warehouse_layouts
    ADD CONSTRAINT warehouse_layouts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES scm.warehouses(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_dept_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.warehouses
    ADD CONSTRAINT warehouses_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id);


--
-- Name: warehouses warehouses_parent_id_fkey; Type: FK CONSTRAINT; Schema: scm; Owner: -
--

ALTER TABLE ONLY scm.warehouses
    ADD CONSTRAINT warehouses_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES scm.warehouses(id) ON DELETE CASCADE;


--
-- Name: definitions definitions_app_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.definitions
    ADD CONSTRAINT definitions_app_id_fkey FOREIGN KEY (app_id) REFERENCES app_center.apps(id) ON DELETE CASCADE;


--
-- Name: instance_events instance_events_definition_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.instance_events
    ADD CONSTRAINT instance_events_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES workflow.definitions(id) ON DELETE SET NULL;


--
-- Name: instance_events instance_events_instance_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.instance_events
    ADD CONSTRAINT instance_events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES workflow.instances(id) ON DELETE CASCADE;


--
-- Name: instances instances_definition_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.instances
    ADD CONSTRAINT instances_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES workflow.definitions(id) ON DELETE CASCADE;


--
-- Name: task_approvals task_approvals_definition_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_approvals
    ADD CONSTRAINT task_approvals_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES workflow.definitions(id) ON DELETE SET NULL;


--
-- Name: task_approvals task_approvals_instance_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_approvals
    ADD CONSTRAINT task_approvals_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES workflow.instances(id) ON DELETE CASCADE;


--
-- Name: task_assignments task_assignments_definition_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: -
--

ALTER TABLE ONLY workflow.task_assignments
    ADD CONSTRAINT task_assignments_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES workflow.definitions(id) ON DELETE CASCADE;


--
-- Name: apps; Type: ROW SECURITY; Schema: app_center; Owner: -
--

ALTER TABLE app_center.apps ENABLE ROW LEVEL SECURITY;

--
-- Name: apps apps_delete_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY apps_delete_policy ON app_center.apps FOR DELETE USING (((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text) AND (COALESCE((config ->> 'systemApp'::text), ''::text) <> 'ontology_workbench'::text)));


--
-- Name: apps apps_insert_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY apps_insert_policy ON app_center.apps FOR INSERT WITH CHECK ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: apps apps_select_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY apps_select_policy ON app_center.apps FOR SELECT USING (true);


--
-- Name: apps apps_update_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY apps_update_policy ON app_center.apps FOR UPDATE USING ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: categories; Type: ROW SECURITY; Schema: app_center; Owner: -
--

ALTER TABLE app_center.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_select_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY categories_select_policy ON app_center.categories FOR SELECT USING (true);


--
-- Name: execution_logs; Type: ROW SECURITY; Schema: app_center; Owner: -
--

ALTER TABLE app_center.execution_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_logs execution_logs_delete_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY execution_logs_delete_policy ON app_center.execution_logs FOR DELETE USING ((COALESCE(NULLIF(current_setting('request.jwt.claim.app_role'::text, true), ''::text), NULLIF(((COALESCE(NULLIF(current_setting('request.jwt.claims'::text, true), ''::text), '{}'::text))::json ->> 'app_role'::text), ''::text)) = 'super_admin'::text));


--
-- Name: execution_logs execution_logs_insert_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY execution_logs_insert_policy ON app_center.execution_logs FOR INSERT WITH CHECK ((COALESCE(NULLIF(current_setting('request.jwt.claim.app_role'::text, true), ''::text), NULLIF(((COALESCE(NULLIF(current_setting('request.jwt.claims'::text, true), ''::text), '{}'::text))::json ->> 'app_role'::text), ''::text)) = 'super_admin'::text));


--
-- Name: execution_logs execution_logs_select_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY execution_logs_select_policy ON app_center.execution_logs FOR SELECT USING ((COALESCE(NULLIF(current_setting('request.jwt.claim.app_role'::text, true), ''::text), NULLIF(((COALESCE(NULLIF(current_setting('request.jwt.claims'::text, true), ''::text), '{}'::text))::json ->> 'app_role'::text), ''::text)) = 'super_admin'::text));


--
-- Name: execution_logs execution_logs_update_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY execution_logs_update_policy ON app_center.execution_logs FOR UPDATE USING ((COALESCE(NULLIF(current_setting('request.jwt.claim.app_role'::text, true), ''::text), NULLIF(((COALESCE(NULLIF(current_setting('request.jwt.claims'::text, true), ''::text), '{}'::text))::json ->> 'app_role'::text), ''::text)) = 'super_admin'::text)) WITH CHECK ((COALESCE(NULLIF(current_setting('request.jwt.claim.app_role'::text, true), ''::text), NULLIF(((COALESCE(NULLIF(current_setting('request.jwt.claims'::text, true), ''::text), '{}'::text))::json ->> 'app_role'::text), ''::text)) = 'super_admin'::text));


--
-- Name: published_routes; Type: ROW SECURITY; Schema: app_center; Owner: -
--

ALTER TABLE app_center.published_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: published_routes published_routes_delete_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY published_routes_delete_policy ON app_center.published_routes FOR DELETE USING ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: published_routes published_routes_insert_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY published_routes_insert_policy ON app_center.published_routes FOR INSERT WITH CHECK ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: published_routes published_routes_select_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY published_routes_select_policy ON app_center.published_routes FOR SELECT USING ((is_active = true));


--
-- Name: published_routes published_routes_update_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY published_routes_update_policy ON app_center.published_routes FOR UPDATE USING ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text)) WITH CHECK ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: workflow_state_mappings workflow_mappings_delete_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_mappings_delete_policy ON app_center.workflow_state_mappings FOR DELETE USING ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: workflow_state_mappings workflow_mappings_insert_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_mappings_insert_policy ON app_center.workflow_state_mappings FOR INSERT WITH CHECK ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: workflow_state_mappings workflow_mappings_select_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_mappings_select_policy ON app_center.workflow_state_mappings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM app_center.apps
  WHERE (apps.id = workflow_state_mappings.workflow_app_id))));


--
-- Name: workflow_state_mappings workflow_mappings_update_policy; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_mappings_update_policy ON app_center.workflow_state_mappings FOR UPDATE USING ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text)) WITH CHECK ((((current_setting('request.jwt.claims'::text, true))::json ->> 'app_role'::text) = 'super_admin'::text));


--
-- Name: workflow_permission_policies; Type: ROW SECURITY; Schema: app_center; Owner: -
--

ALTER TABLE app_center.workflow_permission_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_permission_policies workflow_permission_policies_delete; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_permission_policies_delete ON app_center.workflow_permission_policies FOR DELETE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: workflow_permission_policies workflow_permission_policies_insert; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_permission_policies_insert ON app_center.workflow_permission_policies FOR INSERT WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: workflow_permission_policies workflow_permission_policies_select; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_permission_policies_select ON app_center.workflow_permission_policies FOR SELECT USING (true);


--
-- Name: workflow_permission_policies workflow_permission_policies_update; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_permission_policies_update ON app_center.workflow_permission_policies FOR UPDATE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false)) WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: workflow_state_mappings; Type: ROW SECURITY; Schema: app_center; Owner: -
--

ALTER TABLE app_center.workflow_state_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_transition_rules; Type: ROW SECURITY; Schema: app_center; Owner: -
--

ALTER TABLE app_center.workflow_transition_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_transition_rules workflow_transition_rules_delete; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_transition_rules_delete ON app_center.workflow_transition_rules FOR DELETE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: workflow_transition_rules workflow_transition_rules_insert; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_transition_rules_insert ON app_center.workflow_transition_rules FOR INSERT WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: workflow_transition_rules workflow_transition_rules_select; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_transition_rules_select ON app_center.workflow_transition_rules FOR SELECT USING (true);


--
-- Name: workflow_transition_rules workflow_transition_rules_update; Type: POLICY; Schema: app_center; Owner: -
--

CREATE POLICY workflow_transition_rules_update ON app_center.workflow_transition_rules FOR UPDATE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false)) WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: twin_knowledge_files; Type: ROW SECURITY; Schema: app_data; Owner: -
--

ALTER TABLE app_data.twin_knowledge_files ENABLE ROW LEVEL SECURITY;

--
-- Name: twin_knowledge_files twin_knowledge_own; Type: POLICY; Schema: app_data; Owner: -
--

CREATE POLICY twin_knowledge_own ON app_data.twin_knowledge_files USING ((employee_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)));


--
-- Name: twin_messages; Type: ROW SECURITY; Schema: app_data; Owner: -
--

ALTER TABLE app_data.twin_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: twin_messages twin_messages_own; Type: POLICY; Schema: app_data; Owner: -
--

CREATE POLICY twin_messages_own ON app_data.twin_messages USING ((session_id IN ( SELECT twin_sessions.id
   FROM app_data.twin_sessions
  WHERE (twin_sessions.employee_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)))));


--
-- Name: twin_sessions; Type: ROW SECURITY; Schema: app_data; Owner: -
--

ALTER TABLE app_data.twin_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: twin_sessions twin_sessions_own; Type: POLICY; Schema: app_data; Owner: -
--

CREATE POLICY twin_sessions_own ON app_data.twin_sessions USING ((employee_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)));


--
-- Name: twin_tool_logs; Type: ROW SECURITY; Schema: app_data; Owner: -
--

ALTER TABLE app_data.twin_tool_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: twin_tool_logs twin_tool_logs_own; Type: POLICY; Schema: app_data; Owner: -
--

CREATE POLICY twin_tool_logs_own ON app_data.twin_tool_logs USING ((session_id IN ( SELECT twin_sessions.id
   FROM app_data.twin_sessions
  WHERE (twin_sessions.employee_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)))));


--
-- Name: agent_audit_events; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.agent_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_messages; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.agent_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_qualification_rules; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.agent_qualification_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_sessions; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.agent_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: certificates; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: content_pages; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.content_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: content_revisions; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.content_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_records; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.evidence_records ENABLE ROW LEVEL SECURITY;

--
-- Name: geo_answer_snapshots; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.geo_answer_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_documents; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.knowledge_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_events; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.lead_events ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: media_assets; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.media_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_drafts; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.opportunity_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: product_locales; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.product_locales ENABLE ROW LEVEL SECURITY;

--
-- Name: production_work_order_drafts; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.production_work_order_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.products ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_drafts; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.quote_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_order_drafts; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.sales_order_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_checks; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.seo_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_keywords; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.seo_keywords ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_metadata; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.seo_metadata ENABLE ROW LEVEL SECURITY;

--
-- Name: site_config; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.site_config ENABLE ROW LEVEL SECURITY;

--
-- Name: site_locales; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.site_locales ENABLE ROW LEVEL SECURITY;

--
-- Name: solutions; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.solutions ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_jobs; Type: ROW SECURITY; Schema: company_site; Owner: -
--

ALTER TABLE company_site.sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_business_corrections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_business_corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_business_corrections ai_business_corrections_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_business_corrections_delete ON public.ai_business_corrections FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: ai_business_corrections ai_business_corrections_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_business_corrections_insert ON public.ai_business_corrections FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: ai_business_corrections ai_business_corrections_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_business_corrections_select ON public.ai_business_corrections FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: ai_business_corrections ai_business_corrections_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_business_corrections_update ON public.ai_business_corrections FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: client_log_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_log_events ENABLE ROW LEVEL SECURITY;

--
-- Name: client_log_events client_log_events_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_events_delete ON public.client_log_events FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: client_log_events client_log_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_events_insert ON public.client_log_events FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: client_log_events client_log_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_events_select ON public.client_log_events FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: client_log_events client_log_events_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_events_update ON public.client_log_events FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: client_log_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_log_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: client_log_sessions client_log_sessions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_sessions_delete ON public.client_log_sessions FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: client_log_sessions client_log_sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_sessions_insert ON public.client_log_sessions FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: client_log_sessions client_log_sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_sessions_select ON public.client_log_sessions FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: client_log_sessions client_log_sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_log_sessions_update ON public.client_log_sessions FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: collector_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collector_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: collector_devices collector_devices_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_devices_delete ON public.collector_devices FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: collector_devices collector_devices_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_devices_insert ON public.collector_devices FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: collector_devices collector_devices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_devices_select ON public.collector_devices FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: collector_devices collector_devices_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_devices_update ON public.collector_devices FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: collector_watch_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collector_watch_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: collector_watch_folders collector_watch_folders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_watch_folders_delete ON public.collector_watch_folders FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: collector_watch_folders collector_watch_folders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_watch_folders_insert ON public.collector_watch_folders FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: collector_watch_folders collector_watch_folders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_watch_folders_select ON public.collector_watch_folders FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: collector_watch_folders collector_watch_folders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collector_watch_folders_update ON public.collector_watch_folders FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: document_assets document_assets_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_assets_delete ON public.document_assets FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_assets document_assets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_assets_insert ON public.document_assets FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_assets document_assets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_assets_select ON public.document_assets FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_assets document_assets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_assets_update ON public.document_assets FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_business_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_business_links ENABLE ROW LEVEL SECURITY;

--
-- Name: document_business_links document_business_links_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_business_links_delete ON public.document_business_links FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_business_links document_business_links_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_business_links_insert ON public.document_business_links FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_business_links document_business_links_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_business_links_select ON public.document_business_links FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_business_links document_business_links_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_business_links_update ON public.document_business_links FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_classification_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_classification_results ENABLE ROW LEVEL SECURITY;

--
-- Name: document_classification_results document_classification_results_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_classification_results_delete ON public.document_classification_results FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_classification_results document_classification_results_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_classification_results_insert ON public.document_classification_results FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_classification_results document_classification_results_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_classification_results_select ON public.document_classification_results FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_classification_results document_classification_results_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_classification_results_update ON public.document_classification_results FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_entry_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_entry_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: document_entry_plans document_entry_plans_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_entry_plans_delete ON public.document_entry_plans FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_entry_plans document_entry_plans_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_entry_plans_insert ON public.document_entry_plans FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_entry_plans document_entry_plans_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_entry_plans_select ON public.document_entry_plans FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_entry_plans document_entry_plans_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_entry_plans_update ON public.document_entry_plans FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_flow_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_flow_audits ENABLE ROW LEVEL SECURITY;

--
-- Name: document_flow_audits document_flow_audits_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_flow_audits_insert ON public.document_flow_audits FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: document_flow_audits document_flow_audits_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_flow_audits_select ON public.document_flow_audits FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: document_import_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_import_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: document_import_batches document_import_batches_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_import_batches_delete ON public.document_import_batches FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_import_batches document_import_batches_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_import_batches_insert ON public.document_import_batches FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_import_batches document_import_batches_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_import_batches_select ON public.document_import_batches FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_import_batches document_import_batches_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_import_batches_update ON public.document_import_batches FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

--
-- Name: document_links document_links_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_links_delete ON public.document_links FOR DELETE TO web_user USING (true);


--
-- Name: document_links document_links_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_links_insert ON public.document_links FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: document_links document_links_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_links_select ON public.document_links FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: document_links document_links_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_links_update ON public.document_links FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: document_parse_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_parse_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: document_parse_jobs document_parse_jobs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_jobs_delete ON public.document_parse_jobs FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_parse_jobs document_parse_jobs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_jobs_insert ON public.document_parse_jobs FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_parse_jobs document_parse_jobs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_jobs_select ON public.document_parse_jobs FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_parse_jobs document_parse_jobs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_jobs_update ON public.document_parse_jobs FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_parse_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_parse_results ENABLE ROW LEVEL SECURITY;

--
-- Name: document_parse_results document_parse_results_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_results_delete ON public.document_parse_results FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_parse_results document_parse_results_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_results_insert ON public.document_parse_results FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_parse_results document_parse_results_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_results_select ON public.document_parse_results FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_parse_results document_parse_results_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_parse_results_update ON public.document_parse_results FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_unmapped_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_unmapped_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: document_unmapped_fields document_unmapped_fields_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_unmapped_fields_delete ON public.document_unmapped_fields FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_unmapped_fields document_unmapped_fields_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_unmapped_fields_insert ON public.document_unmapped_fields FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_unmapped_fields document_unmapped_fields_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_unmapped_fields_select ON public.document_unmapped_fields FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_unmapped_fields document_unmapped_fields_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_unmapped_fields_update ON public.document_unmapped_fields FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_upload_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_upload_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: document_upload_chunks document_upload_chunks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_chunks_delete ON public.document_upload_chunks FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_upload_chunks document_upload_chunks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_chunks_insert ON public.document_upload_chunks FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_upload_chunks document_upload_chunks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_chunks_select ON public.document_upload_chunks FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_upload_chunks document_upload_chunks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_chunks_update ON public.document_upload_chunks FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_upload_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_upload_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: document_upload_sessions document_upload_sessions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_sessions_delete ON public.document_upload_sessions FOR DELETE TO web_user USING (public.document_intake_can_manage());


--
-- Name: document_upload_sessions document_upload_sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_sessions_insert ON public.document_upload_sessions FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage());


--
-- Name: document_upload_sessions document_upload_sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_sessions_select ON public.document_upload_sessions FOR SELECT TO web_user USING (public.document_intake_can_view());


--
-- Name: document_upload_sessions document_upload_sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_upload_sessions_update ON public.document_upload_sessions FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage());


--
-- Name: equipment_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_assets equipment_assets_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_assets_delete ON public.equipment_assets FOR DELETE TO web_user USING (true);


--
-- Name: equipment_assets equipment_assets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_assets_insert ON public.equipment_assets FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: equipment_assets equipment_assets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_assets_select ON public.equipment_assets FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: equipment_assets equipment_assets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_assets_update ON public.equipment_assets FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: equipment_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_checks equipment_checks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_checks_delete ON public.equipment_checks FOR DELETE TO web_user USING (true);


--
-- Name: equipment_checks equipment_checks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_checks_insert ON public.equipment_checks FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: equipment_checks equipment_checks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_checks_select ON public.equipment_checks FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: equipment_checks equipment_checks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_checks_update ON public.equipment_checks FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: equipment_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_issues ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_issues equipment_issues_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_issues_delete ON public.equipment_issues FOR DELETE TO web_user USING (true);


--
-- Name: equipment_issues equipment_issues_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_issues_insert ON public.equipment_issues FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: equipment_issues equipment_issues_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_issues_select ON public.equipment_issues FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: equipment_issues equipment_issues_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_issues_update ON public.equipment_issues FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: equipment_maintenance_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_maintenance_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_maintenance_plans equipment_plans_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_plans_delete ON public.equipment_maintenance_plans FOR DELETE TO web_user USING (true);


--
-- Name: equipment_maintenance_plans equipment_plans_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_plans_insert ON public.equipment_maintenance_plans FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: equipment_maintenance_plans equipment_plans_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_plans_select ON public.equipment_maintenance_plans FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: equipment_maintenance_plans equipment_plans_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_plans_update ON public.equipment_maintenance_plans FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: equipment_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_standards ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_standards equipment_standards_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_standards_delete ON public.equipment_standards FOR DELETE TO web_user USING (true);


--
-- Name: equipment_standards equipment_standards_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_standards_insert ON public.equipment_standards FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: equipment_standards equipment_standards_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_standards_select ON public.equipment_standards FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: equipment_standards equipment_standards_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_standards_update ON public.equipment_standards FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: equipment_work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_work_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_work_orders equipment_work_orders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_work_orders_delete ON public.equipment_work_orders FOR DELETE TO web_user USING (true);


--
-- Name: equipment_work_orders equipment_work_orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_work_orders_insert ON public.equipment_work_orders FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: equipment_work_orders equipment_work_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_work_orders_select ON public.equipment_work_orders FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: equipment_work_orders equipment_work_orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_work_orders_update ON public.equipment_work_orders FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: purchase_arrivals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_arrivals ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_arrivals purchase_arrivals_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_arrivals_delete ON public.purchase_arrivals FOR DELETE TO web_user USING (true);


--
-- Name: purchase_arrivals purchase_arrivals_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_arrivals_insert ON public.purchase_arrivals FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: purchase_arrivals purchase_arrivals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_arrivals_select ON public.purchase_arrivals FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: purchase_arrivals purchase_arrivals_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_arrivals_update ON public.purchase_arrivals FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: purchase_demands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_demands ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_demands purchase_demands_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_demands_delete ON public.purchase_demands FOR DELETE TO web_user USING (true);


--
-- Name: purchase_demands purchase_demands_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_demands_insert ON public.purchase_demands FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: purchase_demands purchase_demands_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_demands_select ON public.purchase_demands FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: purchase_demands purchase_demands_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_demands_update ON public.purchase_demands FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders purchase_orders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_delete ON public.purchase_orders FOR DELETE TO web_user USING (true);


--
-- Name: purchase_orders purchase_orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_insert ON public.purchase_orders FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: purchase_orders purchase_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_select ON public.purchase_orders FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: purchase_orders purchase_orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_update ON public.purchase_orders FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: purchase_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_suppliers purchase_suppliers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_suppliers_delete ON public.purchase_suppliers FOR DELETE TO web_user USING (true);


--
-- Name: purchase_suppliers purchase_suppliers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_suppliers_insert ON public.purchase_suppliers FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: purchase_suppliers purchase_suppliers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_suppliers_select ON public.purchase_suppliers FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: purchase_suppliers purchase_suppliers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_suppliers_update ON public.purchase_suppliers FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: quality_corrective_actions quality_actions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_actions_delete ON public.quality_corrective_actions FOR DELETE TO web_user USING (true);


--
-- Name: quality_corrective_actions quality_actions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_actions_insert ON public.quality_corrective_actions FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: quality_corrective_actions quality_actions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_actions_select ON public.quality_corrective_actions FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: quality_corrective_actions quality_actions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_actions_update ON public.quality_corrective_actions FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: quality_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_audits quality_audits_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_audits_delete ON public.quality_audits FOR DELETE TO web_user USING (true);


--
-- Name: quality_audits quality_audits_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_audits_insert ON public.quality_audits FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: quality_audits quality_audits_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_audits_select ON public.quality_audits FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: quality_audits quality_audits_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_audits_update ON public.quality_audits FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: quality_corrective_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_corrective_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_inspections quality_inspections_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_inspections_delete ON public.quality_inspections FOR DELETE TO web_user USING (true);


--
-- Name: quality_inspections quality_inspections_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_inspections_insert ON public.quality_inspections FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: quality_inspections quality_inspections_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_inspections_select ON public.quality_inspections FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: quality_inspections quality_inspections_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_inspections_update ON public.quality_inspections FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: quality_ncrs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_ncrs ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_ncrs quality_ncrs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_ncrs_delete ON public.quality_ncrs FOR DELETE TO web_user USING (true);


--
-- Name: quality_ncrs quality_ncrs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_ncrs_insert ON public.quality_ncrs FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: quality_ncrs quality_ncrs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_ncrs_select ON public.quality_ncrs FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: quality_ncrs quality_ncrs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_ncrs_update ON public.quality_ncrs FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: quality_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_standards ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_standards quality_standards_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_standards_delete ON public.quality_standards FOR DELETE TO web_user USING (true);


--
-- Name: quality_standards quality_standards_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_standards_insert ON public.quality_standards FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: quality_standards quality_standards_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_standards_select ON public.quality_standards FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: quality_standards quality_standards_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_standards_update ON public.quality_standards FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: raw_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_materials raw_materials_scope_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY raw_materials_scope_delete ON public.raw_materials FOR DELETE TO web_user USING (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END);


--
-- Name: raw_materials raw_materials_scope_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY raw_materials_scope_insert ON public.raw_materials FOR INSERT TO web_user WITH CHECK (((created_by = public.current_username()) AND ((dept_id IS NULL) OR (dept_id = public.current_user_dept_id()))));


--
-- Name: raw_materials raw_materials_scope_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY raw_materials_scope_select ON public.raw_materials FOR SELECT TO web_user USING (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END);


--
-- Name: raw_materials raw_materials_scope_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY raw_materials_scope_update ON public.raw_materials FOR UPDATE TO web_user USING (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END) WITH CHECK (
CASE public.current_scope('mms_ledger'::text)
    WHEN 'all'::text THEN true
    WHEN 'dept'::text THEN (dept_id = public.current_user_dept_id())
    WHEN 'dept_tree'::text THEN (dept_id IN ( SELECT dept_tree_ids.dept_tree_ids
       FROM public.dept_tree_ids(public.current_user_dept_id()) dept_tree_ids(dept_tree_ids)))
    WHEN 'self'::text THEN (created_by = public.current_username())
    ELSE false
END);


--
-- Name: sales_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_customers sales_customers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_customers_delete ON public.sales_customers FOR DELETE TO web_user USING (true);


--
-- Name: sales_customers sales_customers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_customers_insert ON public.sales_customers FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: sales_customers sales_customers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_customers_select ON public.sales_customers FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: sales_customers sales_customers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_customers_update ON public.sales_customers FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: sales_follow_ups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_follow_ups ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_follow_ups sales_follow_ups_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_follow_ups_delete ON public.sales_follow_ups FOR DELETE TO web_user USING (true);


--
-- Name: sales_follow_ups sales_follow_ups_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_follow_ups_insert ON public.sales_follow_ups FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: sales_follow_ups sales_follow_ups_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_follow_ups_select ON public.sales_follow_ups FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: sales_follow_ups sales_follow_ups_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_follow_ups_update ON public.sales_follow_ups FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: sales_opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_opportunities sales_opportunities_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_opportunities_delete ON public.sales_opportunities FOR DELETE TO web_user USING (true);


--
-- Name: sales_opportunities sales_opportunities_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_opportunities_insert ON public.sales_opportunities FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: sales_opportunities sales_opportunities_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_opportunities_select ON public.sales_opportunities FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: sales_opportunities sales_opportunities_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_opportunities_update ON public.sales_opportunities FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: sales_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_orders sales_orders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_orders_delete ON public.sales_orders FOR DELETE TO web_user USING (true);


--
-- Name: sales_orders sales_orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_orders_insert ON public.sales_orders FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: sales_orders sales_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_orders_select ON public.sales_orders FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: sales_orders sales_orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_orders_update ON public.sales_orders FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: sales_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_payments sales_payments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_payments_delete ON public.sales_payments FOR DELETE TO web_user USING (true);


--
-- Name: sales_payments sales_payments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_payments_insert ON public.sales_payments FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: sales_payments sales_payments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_payments_select ON public.sales_payments FOR SELECT TO web_anon, web_user USING (true);


--
-- Name: sales_payments sales_payments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_payments_update ON public.sales_payments FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: smart_bi_action_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.smart_bi_action_items ENABLE ROW LEVEL SECURITY;

--
-- Name: smart_bi_action_items smart_bi_action_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smart_bi_action_items_delete ON public.smart_bi_action_items FOR DELETE TO web_user USING (true);


--
-- Name: smart_bi_action_items smart_bi_action_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smart_bi_action_items_insert ON public.smart_bi_action_items FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: smart_bi_action_items smart_bi_action_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smart_bi_action_items_select ON public.smart_bi_action_items FOR SELECT TO web_user USING (true);


--
-- Name: smart_bi_action_items smart_bi_action_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smart_bi_action_items_update ON public.smart_bi_action_items FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: batch_no_rules; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.batch_no_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: batch_no_rules batch_no_rules_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY batch_no_rules_delete ON scm.batch_no_rules FOR DELETE TO web_user USING (true);


--
-- Name: batch_no_rules batch_no_rules_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY batch_no_rules_insert ON scm.batch_no_rules FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: batch_no_rules batch_no_rules_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY batch_no_rules_select ON scm.batch_no_rules FOR SELECT TO web_user USING (true);


--
-- Name: batch_no_rules batch_no_rules_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY batch_no_rules_update ON scm.batch_no_rules FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: bom_items; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.bom_items ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_items bom_items_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY bom_items_delete ON scm.bom_items FOR DELETE TO web_user USING (true);


--
-- Name: bom_items bom_items_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY bom_items_insert ON scm.bom_items FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: bom_items bom_items_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY bom_items_select ON scm.bom_items FOR SELECT TO web_user USING (true);


--
-- Name: bom_items bom_items_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY bom_items_update ON scm.bom_items FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: boms; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.boms ENABLE ROW LEVEL SECURITY;

--
-- Name: boms boms_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY boms_delete ON scm.boms FOR DELETE TO web_user USING (true);


--
-- Name: boms boms_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY boms_insert ON scm.boms FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: boms boms_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY boms_select ON scm.boms FOR SELECT TO web_user USING (true);


--
-- Name: boms boms_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY boms_update ON scm.boms FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: inventory_batches; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.inventory_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_batches inventory_batches_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_batches_select ON scm.inventory_batches FOR SELECT TO web_user USING (true);


--
-- Name: inventory_batches inventory_batches_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_batches_update ON scm.inventory_batches FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: inventory_check_items; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.inventory_check_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_checks; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.inventory_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_checks inventory_checks_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_checks_select ON scm.inventory_checks FOR SELECT TO web_user USING (true);


--
-- Name: inventory_drafts; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.inventory_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_drafts inventory_drafts_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_drafts_delete ON scm.inventory_drafts FOR DELETE TO web_user USING (true);


--
-- Name: inventory_drafts inventory_drafts_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_drafts_insert ON scm.inventory_drafts FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: inventory_drafts inventory_drafts_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_drafts_select ON scm.inventory_drafts FOR SELECT TO web_user USING (true);


--
-- Name: inventory_drafts inventory_drafts_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_drafts_update ON scm.inventory_drafts FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: inventory_transactions; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.inventory_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transactions inventory_transactions_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY inventory_transactions_select ON scm.inventory_transactions FOR SELECT TO web_user USING (true);


--
-- Name: production_work_order_items; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.production_work_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: production_work_order_items production_work_order_items_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_order_items_delete ON scm.production_work_order_items FOR DELETE TO web_user USING (true);


--
-- Name: production_work_order_items production_work_order_items_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_order_items_insert ON scm.production_work_order_items FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: production_work_order_items production_work_order_items_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_order_items_select ON scm.production_work_order_items FOR SELECT TO web_user USING (true);


--
-- Name: production_work_order_items production_work_order_items_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_order_items_update ON scm.production_work_order_items FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: production_work_orders; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.production_work_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: production_work_orders production_work_orders_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_orders_delete ON scm.production_work_orders FOR DELETE TO web_user USING (true);


--
-- Name: production_work_orders production_work_orders_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_orders_insert ON scm.production_work_orders FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: production_work_orders production_work_orders_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_orders_select ON scm.production_work_orders FOR SELECT TO web_user USING (true);


--
-- Name: production_work_orders production_work_orders_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY production_work_orders_update ON scm.production_work_orders FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: warehouse_layouts; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.warehouse_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_layouts warehouse_layouts_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouse_layouts_delete ON scm.warehouse_layouts FOR DELETE TO web_user USING (true);


--
-- Name: warehouse_layouts warehouse_layouts_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouse_layouts_insert ON scm.warehouse_layouts FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: warehouse_layouts warehouse_layouts_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouse_layouts_select ON scm.warehouse_layouts FOR SELECT TO web_user USING (true);


--
-- Name: warehouse_layouts warehouse_layouts_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouse_layouts_update ON scm.warehouse_layouts FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: warehouses; Type: ROW SECURITY; Schema: scm; Owner: -
--

ALTER TABLE scm.warehouses ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouses warehouses_delete; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouses_delete ON scm.warehouses FOR DELETE TO web_user USING (true);


--
-- Name: warehouses warehouses_insert; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouses_insert ON scm.warehouses FOR INSERT TO web_user WITH CHECK (true);


--
-- Name: warehouses warehouses_select; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouses_select ON scm.warehouses FOR SELECT TO web_user USING (true);


--
-- Name: warehouses warehouses_update; Type: POLICY; Schema: scm; Owner: -
--

CREATE POLICY warehouses_update ON scm.warehouses FOR UPDATE TO web_user USING (true) WITH CHECK (true);


--
-- Name: definitions; Type: ROW SECURITY; Schema: workflow; Owner: -
--

ALTER TABLE workflow.definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: instance_events; Type: ROW SECURITY; Schema: workflow; Owner: -
--

ALTER TABLE workflow.instance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: workflow; Owner: -
--

ALTER TABLE workflow.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: task_approvals; Type: ROW SECURITY; Schema: workflow; Owner: -
--

ALTER TABLE workflow.task_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignments; Type: ROW SECURITY; Schema: workflow; Owner: -
--

ALTER TABLE workflow.task_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignments workflow_assign_delete; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_assign_delete ON workflow.task_assignments FOR DELETE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: task_assignments workflow_assign_insert; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_assign_insert ON workflow.task_assignments FOR INSERT WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: task_assignments workflow_assign_select; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_assign_select ON workflow.task_assignments FOR SELECT USING (true);


--
-- Name: task_assignments workflow_assign_update; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_assign_update ON workflow.task_assignments FOR UPDATE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false)) WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: definitions workflow_definitions_delete; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_definitions_delete ON workflow.definitions FOR DELETE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: definitions workflow_definitions_insert; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_definitions_insert ON workflow.definitions FOR INSERT WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: definitions workflow_definitions_select; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_definitions_select ON workflow.definitions FOR SELECT USING (true);


--
-- Name: definitions workflow_definitions_update; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_definitions_update ON workflow.definitions FOR UPDATE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false)) WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: instance_events workflow_events_delete; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_events_delete ON workflow.instance_events FOR DELETE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: instance_events workflow_events_insert; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_events_insert ON workflow.instance_events FOR INSERT WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: instance_events workflow_events_select; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_events_select ON workflow.instance_events FOR SELECT USING (true);


--
-- Name: instance_events workflow_events_update; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_events_update ON workflow.instance_events FOR UPDATE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false)) WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: instances workflow_instances_delete; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_instances_delete ON workflow.instances FOR DELETE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: instances workflow_instances_insert; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_instances_insert ON workflow.instances FOR INSERT WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: instances workflow_instances_select; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_instances_select ON workflow.instances FOR SELECT USING (true);


--
-- Name: instances workflow_instances_update; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_instances_update ON workflow.instances FOR UPDATE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false)) WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: task_approvals workflow_task_approvals_delete; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_task_approvals_delete ON workflow.task_approvals FOR DELETE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: task_approvals workflow_task_approvals_insert; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_task_approvals_insert ON workflow.task_approvals FOR INSERT WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: task_approvals workflow_task_approvals_select; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_task_approvals_select ON workflow.task_approvals FOR SELECT USING (true);


--
-- Name: task_approvals workflow_task_approvals_update; Type: POLICY; Schema: workflow; Owner: -
--

CREATE POLICY workflow_task_approvals_update ON workflow.task_approvals FOR UPDATE USING (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false)) WITH CHECK (COALESCE((((NULLIF(current_setting('request.jwt.claims'::text, true), ''::text))::jsonb ->> 'app_role'::text) = 'super_admin'::text), false));


--
-- Name: SCHEMA app_center; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA app_center TO web_anon;
GRANT USAGE ON SCHEMA app_center TO web_user;


--
-- Name: SCHEMA app_data; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA app_data TO web_anon;
GRANT USAGE ON SCHEMA app_data TO web_user;


--
-- Name: SCHEMA hr; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA hr TO web_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT USAGE ON SCHEMA public TO web_user;


--
-- Name: SCHEMA scm; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA scm TO web_user;
GRANT USAGE ON SCHEMA scm TO web_anon;


--
-- Name: SCHEMA workflow; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA workflow TO web_user;
GRANT USAGE ON SCHEMA workflow TO web_anon;


--
-- Name: FUNCTION create_data_app_table(app_id uuid, table_name text, columns jsonb); Type: ACL; Schema: app_center; Owner: -
--

GRANT ALL ON FUNCTION app_center.create_data_app_table(app_id uuid, table_name text, columns jsonb) TO web_user;


--
-- Name: FUNCTION log_semantic_event(app_id uuid, task_id text, status text, input_data jsonb, output_data jsonb, error_message text); Type: ACL; Schema: app_center; Owner: -
--

GRANT ALL ON FUNCTION app_center.log_semantic_event(app_id uuid, task_id text, status text, input_data jsonb, output_data jsonb, error_message text) TO web_user;


--
-- Name: FUNCTION init_attendance_records(p_date date, p_dept_name text); Type: ACL; Schema: hr; Owner: -
--

GRANT ALL ON FUNCTION hr.init_attendance_records(p_date date, p_dept_name text) TO web_user;


--
-- Name: FUNCTION agent_explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer) TO web_user;


--
-- Name: FUNCTION agent_explain_role_ontology_access(p_role_code text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_explain_role_ontology_access(p_role_code text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_explain_role_ontology_access(p_role_code text, p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_ontology_context(p_query text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_context(p_query text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_context(p_query text, p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_ontology_reasoning_facts(p_predicate text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_reasoning_facts(p_predicate text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_reasoning_facts(p_predicate text, p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_ontology_reasoning_health(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_reasoning_health() FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_reasoning_health() TO web_user;


--
-- Name: FUNCTION agent_ontology_reasoning_rule_stats(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_reasoning_rule_stats(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_reasoning_rule_stats(p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_ontology_reasoning_summary(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_reasoning_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_reasoning_summary() TO web_user;


--
-- Name: FUNCTION agent_ontology_role_access_insights(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_role_access_insights(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_role_access_insights(p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_ontology_sensitive_access_paths(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_sensitive_access_paths(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_sensitive_access_paths(p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_ontology_table_impact_insights(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_ontology_table_impact_insights(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_ontology_table_impact_insights(p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text) TO web_user;


--
-- Name: FUNCTION agent_search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer) TO web_user;


--
-- Name: FUNCTION agent_upsert_ontology_table_semantic(p_payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.agent_upsert_ontology_table_semantic(p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.agent_upsert_ontology_table_semantic(p_payload jsonb) TO web_user;


--
-- Name: FUNCTION apply_role_permission_templates(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_role_permission_templates() TO web_user;


--
-- Name: FUNCTION document_current_claims(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_current_claims() FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_current_claims() TO web_user;


--
-- Name: FUNCTION document_current_has_permission(p_permission text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_current_has_permission(p_permission text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_current_has_permission(p_permission text) TO web_user;


--
-- Name: FUNCTION document_current_is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_current_is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_current_is_admin() TO web_user;


--
-- Name: FUNCTION document_current_permissions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_current_permissions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_current_permissions() TO web_user;


--
-- Name: FUNCTION document_current_role_codes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_current_role_codes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_current_role_codes() TO web_user;


--
-- Name: FUNCTION document_current_username(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_current_username() FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_current_username() TO web_user;


--
-- Name: FUNCTION document_intake_can_manage(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_intake_can_manage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_intake_can_manage() TO web_user;


--
-- Name: FUNCTION document_intake_can_view(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.document_intake_can_view() FROM PUBLIC;
GRANT ALL ON FUNCTION public.document_intake_can_view() TO web_user;


--
-- Name: FUNCTION eis_app_card_stats(payload jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.eis_app_card_stats(payload jsonb) TO web_user;


--
-- Name: FUNCTION eis_grid_agent_query(payload jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.eis_grid_agent_query(payload jsonb) TO web_user;


--
-- Name: FUNCTION eis_grid_formula_eval(tokens jsonb, row_data jsonb, precision_value integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.eis_grid_formula_eval(tokens jsonb, row_data jsonb, precision_value integer) TO web_user;


--
-- Name: FUNCTION eis_grid_formula_eval_token(token jsonb, row_data jsonb, stack numeric[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.eis_grid_formula_eval_token(token jsonb, row_data jsonb, stack numeric[]) TO web_user;


--
-- Name: FUNCTION eis_grid_formula_recalculate(payload jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.eis_grid_formula_recalculate(payload jsonb) TO web_user;


--
-- Name: FUNCTION eis_grid_summary(payload jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.eis_grid_summary(payload jsonb) TO web_user;


--
-- Name: FUNCTION ensure_field_acl(module_name text, field_codes text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ensure_field_acl(module_name text, field_codes text[]) TO web_user;


--
-- Name: FUNCTION explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.explain_ontology_path(p_subject_type text, p_subject_id text, p_object_type text, p_object_id text, p_max_depth integer) FROM PUBLIC;


--
-- Name: FUNCTION explain_role_ontology_access(p_role_code text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.explain_role_ontology_access(p_role_code text, p_limit integer) FROM PUBLIC;


--
-- Name: FUNCTION find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.find_ontology_kg_paths(p_source_type text, p_source_id text, p_target_type text, p_target_id text, p_max_depth integer, p_direction text, p_limit integer) FROM PUBLIC;


--
-- Name: FUNCTION login(payload json); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.login(payload json) TO web_anon;


--
-- Name: FUNCTION login(username text, password text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.login(username text, password text) TO web_anon;


--
-- Name: FUNCTION ontology_agent_can_access_edge(p_edge_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_agent_can_access_edge(p_edge_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_agent_can_access_edge(p_edge_id bigint) TO web_user;


--
-- Name: FUNCTION ontology_agent_can_access_node(p_node_type text, p_node_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_agent_can_access_node(p_node_type text, p_node_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_agent_can_access_node(p_node_type text, p_node_id text) TO web_user;


--
-- Name: FUNCTION ontology_agent_visible_nodes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_agent_visible_nodes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_agent_visible_nodes() TO web_user;


--
-- Name: FUNCTION ontology_current_accessible_apps(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_accessible_apps() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_accessible_apps() TO web_user;


--
-- Name: FUNCTION ontology_current_accessible_sensitive_columns(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_accessible_sensitive_columns() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_accessible_sensitive_columns() TO web_user;


--
-- Name: FUNCTION ontology_current_accessible_tables(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_accessible_tables() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_accessible_tables() TO web_user;


--
-- Name: FUNCTION ontology_current_can_manage_semantics(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_can_manage_semantics() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_can_manage_semantics() TO web_user;


--
-- Name: FUNCTION ontology_current_claims(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_claims() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_claims() TO web_user;


--
-- Name: FUNCTION ontology_current_is_super(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_is_super() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_is_super() TO web_user;


--
-- Name: FUNCTION ontology_current_permissions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_permissions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_permissions() TO web_user;


--
-- Name: FUNCTION ontology_current_role_codes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_role_codes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_role_codes() TO web_user;


--
-- Name: FUNCTION ontology_current_username(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ontology_current_username() FROM PUBLIC;
GRANT ALL ON FUNCTION public.ontology_current_username() TO web_user;


--
-- Name: FUNCTION query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.query_ontology_kg_neighbors(p_node_type text, p_node_id text, p_direction text, p_max_depth integer, p_limit integer, p_predicate text) FROM PUBLIC;


--
-- Name: FUNCTION refresh_ontology_inferences(p_max_depth integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.refresh_ontology_inferences(p_max_depth integer) TO web_user;


--
-- Name: FUNCTION search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_ontology_kg_nodes(p_query text, p_node_type text, p_limit integer) FROM PUBLIC;


--
-- Name: FUNCTION upsert_field_acl(payload jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_field_acl(payload jsonb) TO web_user;


--
-- Name: FUNCTION upsert_permissions(payload jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_permissions(payload jsonb) TO web_user;


--
-- Name: FUNCTION create_purchase_demands_from_sales_bom(p_product_material_id integer, p_required_date date, p_requester_name text); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.create_purchase_demands_from_sales_bom(p_product_material_id integer, p_required_date date, p_requester_name text) TO web_user;


--
-- Name: FUNCTION create_work_orders_from_sales_bom(p_created_by text); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.create_work_orders_from_sales_bom(p_created_by text) TO web_user;


--
-- Name: FUNCTION explode_bom(p_parent_material_id integer, p_qty numeric, p_version text); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.explode_bom(p_parent_material_id integer, p_qty numeric, p_version text) TO web_user;
GRANT ALL ON FUNCTION scm.explode_bom(p_parent_material_id integer, p_qty numeric, p_version text) TO web_anon;


--
-- Name: FUNCTION generate_batch_no(p_rule_id uuid, p_material_id integer, p_manual_override text); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.generate_batch_no(p_rule_id uuid, p_material_id integer, p_manual_override text) TO web_user;


--
-- Name: FUNCTION stock_adjust(p_material_id integer, p_warehouse_id uuid, p_batch_no text, p_adjust_qty numeric, p_unit text, p_remark text, p_operator text); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.stock_adjust(p_material_id integer, p_warehouse_id uuid, p_batch_no text, p_adjust_qty numeric, p_unit text, p_remark text, p_operator text) TO web_user;


--
-- Name: FUNCTION stock_in(p_material_id integer, p_warehouse_id uuid, p_quantity numeric, p_unit text, p_batch_no text, p_transaction_no text, p_operator text, p_production_date date, p_remark text, p_io_type text); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.stock_in(p_material_id integer, p_warehouse_id uuid, p_quantity numeric, p_unit text, p_batch_no text, p_transaction_no text, p_operator text, p_production_date date, p_remark text, p_io_type text) TO web_user;


--
-- Name: FUNCTION stock_out(p_material_id integer, p_warehouse_id uuid, p_quantity numeric, p_unit text, p_batch_no text, p_transaction_no text, p_operator text, p_remark text, p_io_type text); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.stock_out(p_material_id integer, p_warehouse_id uuid, p_quantity numeric, p_unit text, p_batch_no text, p_transaction_no text, p_operator text, p_remark text, p_io_type text) TO web_user;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.touch_updated_at() TO web_user;


--
-- Name: FUNCTION validate_bom_item(); Type: ACL; Schema: scm; Owner: -
--

GRANT ALL ON FUNCTION scm.validate_bom_item() TO web_user;


--
-- Name: FUNCTION apply_mapped_state_to_business(p_definition_id integer, p_task_id text, p_business_key text); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.apply_mapped_state_to_business(p_definition_id integer, p_task_id text, p_business_key text) FROM PUBLIC;


--
-- Name: FUNCTION can_execute_smart_bi_action_instance(p_instance_id integer); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.can_execute_smart_bi_action_instance(p_instance_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.can_execute_smart_bi_action_instance(p_instance_id integer) TO web_user;


--
-- Name: FUNCTION can_execute_task(p_definition_id integer, p_task_id text); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.can_execute_task(p_definition_id integer, p_task_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.can_execute_task(p_definition_id integer, p_task_id text) TO web_user;


--
-- Name: FUNCTION current_claims(); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.current_claims() FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.current_claims() TO web_user;


--
-- Name: FUNCTION check_state_transition_permission(p_definition_id integer, p_app_key text, p_from_task_id text, p_to_task_id text, p_claims jsonb, p_allow_edit_fallback boolean); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.check_state_transition_permission(p_definition_id integer, p_app_key text, p_from_task_id text, p_to_task_id text, p_claims jsonb, p_allow_edit_fallback boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.check_state_transition_permission(p_definition_id integer, p_app_key text, p_from_task_id text, p_to_task_id text, p_claims jsonb, p_allow_edit_fallback boolean) TO web_user;


--
-- Name: FUNCTION claim_has_any_permission(p_claims jsonb, p_codes text[]); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.claim_has_any_permission(p_claims jsonb, p_codes text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.claim_has_any_permission(p_claims jsonb, p_codes text[]) TO web_user;


--
-- Name: FUNCTION claim_has_permission(p_claims jsonb, p_code text); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.claim_has_permission(p_claims jsonb, p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.claim_has_permission(p_claims jsonb, p_code text) TO web_user;


--
-- Name: FUNCTION claim_permissions(p_claims jsonb); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.claim_permissions(p_claims jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.claim_permissions(p_claims jsonb) TO web_user;


--
-- Name: FUNCTION normalize_status_token(p_value text); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.normalize_status_token(p_value text) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.normalize_status_token(p_value text) TO web_user;


--
-- Name: TABLE instances; Type: ACL; Schema: workflow; Owner: -
--

GRANT ALL ON TABLE workflow.instances TO web_user;


--
-- Name: FUNCTION reject_smart_bi_action_workflow(p_instance_id integer, p_comment text, p_variables jsonb); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.reject_smart_bi_action_workflow(p_instance_id integer, p_comment text, p_variables jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.reject_smart_bi_action_workflow(p_instance_id integer, p_comment text, p_variables jsonb) TO web_user;


--
-- Name: FUNCTION reject_workflow_task(p_instance_id integer, p_comment text, p_variables jsonb); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.reject_workflow_task(p_instance_id integer, p_comment text, p_variables jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.reject_workflow_task(p_instance_id integer, p_comment text, p_variables jsonb) TO web_user;


--
-- Name: FUNCTION resolve_app_acl_key(p_definition_id integer); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.resolve_app_acl_key(p_definition_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.resolve_app_acl_key(p_definition_id integer) TO web_user;


--
-- Name: FUNCTION resolve_mapped_state_value(p_definition_id integer, p_task_id text); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.resolve_mapped_state_value(p_definition_id integer, p_task_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.resolve_mapped_state_value(p_definition_id integer, p_task_id text) TO web_user;


--
-- Name: FUNCTION resolve_transition_rule(p_definition_id integer, p_from_task_id text, p_to_task_id text, p_app_key text); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.resolve_transition_rule(p_definition_id integer, p_from_task_id text, p_to_task_id text, p_app_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.resolve_transition_rule(p_definition_id integer, p_from_task_id text, p_to_task_id text, p_app_key text) TO web_user;


--
-- Name: FUNCTION resolve_workflow_permission_policy(p_definition_id integer, p_app_key text); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.resolve_workflow_permission_policy(p_definition_id integer, p_app_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.resolve_workflow_permission_policy(p_definition_id integer, p_app_key text) TO web_user;


--
-- Name: FUNCTION start_workflow_instance(p_definition_id integer, p_business_key text, p_initial_task_id text, p_variables jsonb); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.start_workflow_instance(p_definition_id integer, p_business_key text, p_initial_task_id text, p_variables jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.start_workflow_instance(p_definition_id integer, p_business_key text, p_initial_task_id text, p_variables jsonb) TO web_user;


--
-- Name: FUNCTION transition_smart_bi_action_workflow(p_instance_id integer, p_next_task_id text, p_complete boolean, p_variables jsonb); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.transition_smart_bi_action_workflow(p_instance_id integer, p_next_task_id text, p_complete boolean, p_variables jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.transition_smart_bi_action_workflow(p_instance_id integer, p_next_task_id text, p_complete boolean, p_variables jsonb) TO web_user;


--
-- Name: FUNCTION transition_workflow_instance(p_instance_id integer, p_next_task_id text, p_complete boolean, p_variables jsonb); Type: ACL; Schema: workflow; Owner: -
--

REVOKE ALL ON FUNCTION workflow.transition_workflow_instance(p_instance_id integer, p_next_task_id text, p_complete boolean, p_variables jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION workflow.transition_workflow_instance(p_instance_id integer, p_next_task_id text, p_complete boolean, p_variables jsonb) TO web_user;


--
-- Name: TABLE apps; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_center.apps TO web_user;
GRANT SELECT ON TABLE app_center.apps TO web_anon;


--
-- Name: TABLE categories; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT ON TABLE app_center.categories TO web_anon;
GRANT SELECT ON TABLE app_center.categories TO web_user;


--
-- Name: SEQUENCE categories_id_seq; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE app_center.categories_id_seq TO web_user;


--
-- Name: TABLE execution_logs; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_center.execution_logs TO web_user;


--
-- Name: SEQUENCE execution_logs_id_seq; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE app_center.execution_logs_id_seq TO web_user;


--
-- Name: TABLE published_routes; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT ON TABLE app_center.published_routes TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_center.published_routes TO web_user;


--
-- Name: SEQUENCE published_routes_id_seq; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE app_center.published_routes_id_seq TO web_user;


--
-- Name: TABLE workflow_permission_policies; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_center.workflow_permission_policies TO web_user;


--
-- Name: SEQUENCE workflow_permission_policies_id_seq; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE app_center.workflow_permission_policies_id_seq TO web_user;


--
-- Name: TABLE workflow_state_mappings; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_center.workflow_state_mappings TO web_user;


--
-- Name: SEQUENCE workflow_state_mappings_id_seq; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE app_center.workflow_state_mappings_id_seq TO web_user;


--
-- Name: TABLE workflow_transition_rules; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_center.workflow_transition_rules TO web_user;


--
-- Name: SEQUENCE workflow_transition_rules_id_seq; Type: ACL; Schema: app_center; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE app_center.workflow_transition_rules_id_seq TO web_user;


--
-- Name: TABLE checkin_records; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.checkin_records TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.checkin_records TO web_user;


--
-- Name: TABLE data_app_17137de9; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_17137de9 TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_17137de9 TO web_user;


--
-- Name: TABLE data_app_1f840d3b; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_1f840d3b TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_1f840d3b TO web_user;


--
-- Name: TABLE data_app_3f3cf089; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_3f3cf089 TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_3f3cf089 TO web_user;


--
-- Name: TABLE data_app_51d98ca6; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_51d98ca6 TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_51d98ca6 TO web_user;


--
-- Name: TABLE data_app_6da3f976; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_6da3f976 TO web_user;
GRANT SELECT ON TABLE app_data.data_app_6da3f976 TO web_anon;


--
-- Name: TABLE data_app_6de378ee; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_6de378ee TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_6de378ee TO web_user;


--
-- Name: TABLE data_app_7dd735dd; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_7dd735dd TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_7dd735dd TO web_user;


--
-- Name: TABLE data_app_8966fa75; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_8966fa75 TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_8966fa75 TO web_user;


--
-- Name: TABLE data_app_cd7a8401; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_cd7a8401 TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_cd7a8401 TO web_user;


--
-- Name: TABLE data_app_fd3f499a; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.data_app_fd3f499a TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.data_app_fd3f499a TO web_user;


--
-- Name: TABLE eiscore_chain_test_records; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.eiscore_chain_test_records TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.eiscore_chain_test_records TO web_user;


--
-- Name: TABLE ontology_table_relations; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.ontology_table_relations TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.ontology_table_relations TO web_user;


--
-- Name: TABLE twin_knowledge_files; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.twin_knowledge_files TO web_anon;
GRANT ALL ON TABLE app_data.twin_knowledge_files TO web_user;


--
-- Name: TABLE twin_messages; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.twin_messages TO web_anon;
GRANT ALL ON TABLE app_data.twin_messages TO web_user;


--
-- Name: TABLE twin_sessions; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.twin_sessions TO web_anon;
GRANT ALL ON TABLE app_data.twin_sessions TO web_user;


--
-- Name: TABLE twin_tool_logs; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.twin_tool_logs TO web_anon;
GRANT ALL ON TABLE app_data.twin_tool_logs TO web_user;


--
-- Name: TABLE v_twin_overview; Type: ACL; Schema: app_data; Owner: -
--

GRANT SELECT ON TABLE app_data.v_twin_overview TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app_data.v_twin_overview TO web_user;


--
-- Name: TABLE archives; Type: ACL; Schema: hr; Owner: -
--

GRANT ALL ON TABLE hr.archives TO web_user;


--
-- Name: SEQUENCE archives_id_seq; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE hr.archives_id_seq TO web_user;


--
-- Name: TABLE attendance_month_overrides; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.attendance_month_overrides TO web_user;


--
-- Name: TABLE attendance_records; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.attendance_records TO web_user;


--
-- Name: TABLE attendance_shifts; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.attendance_shifts TO web_user;


--
-- Name: TABLE employee_profiles; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE hr.employee_profiles TO web_user;


--
-- Name: TABLE payroll; Type: ACL; Schema: hr; Owner: -
--

GRANT ALL ON TABLE hr.payroll TO web_user;


--
-- Name: SEQUENCE payroll_id_seq; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE hr.payroll_id_seq TO web_user;


--
-- Name: TABLE v_attendance_daily; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT ON TABLE hr.v_attendance_daily TO web_user;


--
-- Name: TABLE v_attendance_monthly; Type: ACL; Schema: hr; Owner: -
--

GRANT SELECT ON TABLE hr.v_attendance_monthly TO web_user;


--
-- Name: TABLE ai_business_corrections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_business_corrections TO web_user;


--
-- Name: TABLE client_log_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.client_log_events TO web_user;


--
-- Name: TABLE client_log_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.client_log_sessions TO web_user;


--
-- Name: TABLE collector_devices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.collector_devices TO web_user;


--
-- Name: TABLE collector_watch_folders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.collector_watch_folders TO web_user;


--
-- Name: TABLE debug_me; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.debug_me TO web_user;


--
-- Name: TABLE departments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.departments TO web_user;


--
-- Name: TABLE document_assets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_assets TO web_user;


--
-- Name: TABLE document_business_links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_business_links TO web_user;


--
-- Name: TABLE document_classification_results; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_classification_results TO web_user;


--
-- Name: TABLE document_entry_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_entry_plans TO web_user;


--
-- Name: TABLE document_flow_audits; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.document_flow_audits TO web_anon;
GRANT SELECT,INSERT ON TABLE public.document_flow_audits TO web_user;


--
-- Name: TABLE document_import_batches; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_import_batches TO web_user;


--
-- Name: TABLE document_links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.document_links TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_links TO web_user;


--
-- Name: TABLE document_parse_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_parse_jobs TO web_user;


--
-- Name: TABLE document_parse_results; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_parse_results TO web_user;


--
-- Name: TABLE document_unmapped_fields; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_unmapped_fields TO web_user;


--
-- Name: TABLE document_upload_chunks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_upload_chunks TO web_user;


--
-- Name: TABLE document_upload_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_upload_sessions TO web_user;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.employees TO web_anon;
GRANT ALL ON TABLE public.employees TO web_user;


--
-- Name: SEQUENCE employees_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.employees_id_seq TO web_user;


--
-- Name: TABLE equipment_assets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.equipment_assets TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.equipment_assets TO web_user;


--
-- Name: TABLE equipment_checks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.equipment_checks TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.equipment_checks TO web_user;


--
-- Name: TABLE equipment_issues; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.equipment_issues TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.equipment_issues TO web_user;


--
-- Name: TABLE equipment_maintenance_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.equipment_maintenance_plans TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.equipment_maintenance_plans TO web_user;


--
-- Name: TABLE equipment_standards; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.equipment_standards TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.equipment_standards TO web_user;


--
-- Name: TABLE equipment_work_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.equipment_work_orders TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.equipment_work_orders TO web_user;


--
-- Name: TABLE field_label_overrides; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.field_label_overrides TO web_user;


--
-- Name: TABLE files; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.files TO web_user;


--
-- Name: TABLE form_values; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.form_values TO web_user;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.permissions TO web_user;


--
-- Name: TABLE positions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.positions TO web_user;


--
-- Name: TABLE purchase_arrivals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.purchase_arrivals TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_arrivals TO web_user;


--
-- Name: TABLE purchase_demands; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.purchase_demands TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_demands TO web_user;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.purchase_orders TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_orders TO web_user;


--
-- Name: TABLE purchase_suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.purchase_suppliers TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_suppliers TO web_user;


--
-- Name: TABLE quality_audits; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.quality_audits TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quality_audits TO web_user;


--
-- Name: TABLE quality_corrective_actions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.quality_corrective_actions TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quality_corrective_actions TO web_user;


--
-- Name: TABLE quality_inspections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.quality_inspections TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quality_inspections TO web_user;


--
-- Name: TABLE quality_ncrs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.quality_ncrs TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quality_ncrs TO web_user;


--
-- Name: TABLE quality_standards; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.quality_standards TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quality_standards TO web_user;


--
-- Name: TABLE raw_materials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.raw_materials TO web_anon;
GRANT ALL ON TABLE public.raw_materials TO web_user;


--
-- Name: SEQUENCE raw_materials_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.raw_materials_id_seq TO web_user;


--
-- Name: TABLE role_data_scopes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_data_scopes TO web_user;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_permissions TO web_user;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.roles TO web_user;
GRANT SELECT ON TABLE public.roles TO web_anon;


--
-- Name: TABLE sales_customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sales_customers TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_customers TO web_user;


--
-- Name: TABLE sales_follow_ups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sales_follow_ups TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_follow_ups TO web_user;


--
-- Name: TABLE sales_opportunities; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sales_opportunities TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_opportunities TO web_user;


--
-- Name: TABLE sales_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sales_orders TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_orders TO web_user;


--
-- Name: TABLE sales_payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sales_payments TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_payments TO web_user;


--
-- Name: TABLE smart_bi_action_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.smart_bi_action_items TO web_user;


--
-- Name: SEQUENCE smart_bi_action_items_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.smart_bi_action_items_id_seq TO web_user;


--
-- Name: TABLE sop_learning_records; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sop_learning_records TO web_user;


--
-- Name: SEQUENCE sop_learning_records_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.sop_learning_records_id_seq TO web_user;


--
-- Name: TABLE sys_field_acl; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sys_field_acl TO web_user;


--
-- Name: TABLE sys_grid_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sys_grid_configs TO web_user;
GRANT SELECT ON TABLE public.sys_grid_configs TO web_anon;


--
-- Name: TABLE system_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_configs TO web_user;
GRANT SELECT ON TABLE public.system_configs TO web_anon;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_roles TO web_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.users TO web_user;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.users_id_seq TO web_user;


--
-- Name: TABLE v_app_form_ontology; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_app_form_ontology TO web_user;


--
-- Name: TABLE bom_items; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.bom_items TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.bom_items TO web_user;


--
-- Name: TABLE boms; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.boms TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.boms TO web_user;


--
-- Name: TABLE v_bom_explosion; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_bom_explosion TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_bom_explosion TO web_user;


--
-- Name: TABLE v_bom_explosion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_bom_explosion TO web_anon;
GRANT SELECT ON TABLE public.v_bom_explosion TO web_user;


--
-- Name: TABLE v_bom_items; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_bom_items TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_bom_items TO web_user;


--
-- Name: TABLE v_bom_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_bom_items TO web_anon;
GRANT SELECT ON TABLE public.v_bom_items TO web_user;


--
-- Name: TABLE v_boms; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_boms TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_boms TO web_user;


--
-- Name: TABLE v_boms; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_boms TO web_anon;
GRANT SELECT ON TABLE public.v_boms TO web_user;


--
-- Name: TABLE v_field_labels; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_field_labels TO web_user;


--
-- Name: TABLE v_permission_ontology; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_permission_ontology TO web_user;


--
-- Name: TABLE v_role_ontology; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_role_ontology TO web_user;


--
-- Name: TABLE v_purchase_order_progress; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_purchase_order_progress TO web_anon;
GRANT SELECT ON TABLE public.v_purchase_order_progress TO web_user;


--
-- Name: TABLE v_role_data_scopes_matrix; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_role_data_scopes_matrix TO web_user;


--
-- Name: TABLE v_role_permission_ontology; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_role_permission_ontology TO web_user;


--
-- Name: TABLE v_role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_role_permissions TO web_user;


--
-- Name: TABLE v_role_permissions_matrix; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,UPDATE ON TABLE public.v_role_permissions_matrix TO web_user;


--
-- Name: TABLE v_roles_manage; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_roles_manage TO web_user;


--
-- Name: TABLE v_users_manage; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_users_manage TO web_user;


--
-- Name: TABLE batch_no_rules; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.batch_no_rules TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.batch_no_rules TO web_user;


--
-- Name: TABLE inventory_batches; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.inventory_batches TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.inventory_batches TO web_user;


--
-- Name: TABLE inventory_check_items; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.inventory_check_items TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.inventory_check_items TO web_user;


--
-- Name: TABLE inventory_checks; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.inventory_checks TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.inventory_checks TO web_user;


--
-- Name: TABLE inventory_drafts; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.inventory_drafts TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.inventory_drafts TO web_user;


--
-- Name: TABLE inventory_transactions; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.inventory_transactions TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.inventory_transactions TO web_user;


--
-- Name: TABLE production_work_order_items; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.production_work_order_items TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.production_work_order_items TO web_user;


--
-- Name: TABLE production_work_orders; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.production_work_orders TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.production_work_orders TO web_user;


--
-- Name: TABLE warehouses; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.warehouses TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.warehouses TO web_user;


--
-- Name: TABLE v_inventory_current; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_inventory_current TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_inventory_current TO web_user;


--
-- Name: TABLE v_inventory_drafts; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_inventory_drafts TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_inventory_drafts TO web_user;


--
-- Name: TABLE v_inventory_transactions; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_inventory_transactions TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_inventory_transactions TO web_user;


--
-- Name: TABLE v_production_work_order_items; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_production_work_order_items TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_production_work_order_items TO web_user;


--
-- Name: TABLE v_production_work_orders; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_production_work_orders TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_production_work_orders TO web_user;


--
-- Name: TABLE v_sales_bom_order_plan; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_sales_bom_order_plan TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_sales_bom_order_plan TO web_user;


--
-- Name: TABLE v_sales_bom_mrp; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_sales_bom_mrp TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_sales_bom_mrp TO web_user;


--
-- Name: TABLE v_sales_bom_production_plan; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.v_sales_bom_production_plan TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.v_sales_bom_production_plan TO web_user;


--
-- Name: TABLE warehouse_layouts; Type: ACL; Schema: scm; Owner: -
--

GRANT SELECT ON TABLE scm.warehouse_layouts TO web_anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE scm.warehouse_layouts TO web_user;


--
-- Name: TABLE definitions; Type: ACL; Schema: workflow; Owner: -
--

GRANT ALL ON TABLE workflow.definitions TO web_user;


--
-- Name: SEQUENCE definitions_id_seq; Type: ACL; Schema: workflow; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE workflow.definitions_id_seq TO web_user;


--
-- Name: TABLE instance_events; Type: ACL; Schema: workflow; Owner: -
--

GRANT SELECT ON TABLE workflow.instance_events TO web_user;


--
-- Name: SEQUENCE instance_events_id_seq; Type: ACL; Schema: workflow; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE workflow.instance_events_id_seq TO web_user;


--
-- Name: SEQUENCE instances_id_seq; Type: ACL; Schema: workflow; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE workflow.instances_id_seq TO web_user;


--
-- Name: TABLE task_approvals; Type: ACL; Schema: workflow; Owner: -
--

GRANT SELECT ON TABLE workflow.task_approvals TO web_user;


--
-- Name: SEQUENCE task_approvals_id_seq; Type: ACL; Schema: workflow; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE workflow.task_approvals_id_seq TO web_user;


--
-- Name: TABLE task_assignments; Type: ACL; Schema: workflow; Owner: -
--

GRANT ALL ON TABLE workflow.task_assignments TO web_user;


--
-- Name: SEQUENCE task_assignments_id_seq; Type: ACL; Schema: workflow; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE workflow.task_assignments_id_seq TO web_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: app_center; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_center GRANT SELECT,USAGE ON SEQUENCES TO web_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: app_data; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_data GRANT SELECT ON TABLES TO web_anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_data GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO web_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: scm; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA scm GRANT ALL ON FUNCTIONS TO web_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: scm; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA scm GRANT SELECT ON TABLES TO web_anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA scm GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO web_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: workflow; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA workflow GRANT SELECT,USAGE ON SEQUENCES TO web_user;


--
-- PostgreSQL database dump complete
--

\unrestrict EISCOREDBBASELINEV100000000000000000000000000000000000000000000

