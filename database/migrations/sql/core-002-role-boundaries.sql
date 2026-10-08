-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- DB2 role boundary.  This migration is deliberately idempotent because the
-- same SQL is also used by a fresh database bootstrap after the schema
-- baseline is restored.  Passwords are never stored here; deployment injects
-- them through scripts/configure-database-runtime-secret.sh.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_owner') THEN
    CREATE ROLE eiscore_owner NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_migrator') THEN
    CREATE ROLE eiscore_migrator NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_authenticator') THEN
    CREATE ROLE eiscore_authenticator NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_agent') THEN
    CREATE ROLE eiscore_agent NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_user') THEN
    CREATE ROLE web_user NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;

  ALTER ROLE eiscore_owner NOLOGIN NOINHERIT NOBYPASSRLS;
  ALTER ROLE eiscore_migrator NOLOGIN NOINHERIT NOBYPASSRLS;
  ALTER ROLE eiscore_authenticator NOINHERIT NOBYPASSRLS;
  ALTER ROLE eiscore_agent NOINHERIT NOBYPASSRLS;
  ALTER ROLE web_anon NOLOGIN NOINHERIT NOBYPASSRLS;
  ALTER ROLE web_user NOLOGIN NOINHERIT NOBYPASSRLS;

  GRANT eiscore_owner TO eiscore_migrator;
  GRANT web_anon TO eiscore_authenticator;
  GRANT web_user TO eiscore_authenticator;
END
$$;

DO $$
DECLARE
  schema_name text;
  object_row record;
  function_row record;
  policy_row record;
  role_list text;
  policy_command text;
  policy_sql text;
  policy_qual text;
  policy_check text;
BEGIN
  -- Object ownership is non-login and centralised in eiscore_owner.
  FOREACH schema_name IN ARRAY ARRAY['public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow'] LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
      EXECUTE format('ALTER SCHEMA %I OWNER TO eiscore_owner', schema_name);
    END IF;
  END LOOP;

  FOR object_row IN
    SELECT n.nspname AS schema_name, c.relname AS object_name,
           'TABLE' AS object_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY (ARRAY['public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow'])
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    EXECUTE format('ALTER %s %I.%I OWNER TO eiscore_owner', object_row.object_kind, object_row.schema_name, object_row.object_name);
  END LOOP;

  -- Ownership of identity/serial sequences follows their table.  Only alter
  -- standalone sequences here; PostgreSQL rejects changing a linked sequence
  -- independently from its table.
  FOR object_row IN
    SELECT n.nspname AS schema_name, c.relname AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY (ARRAY['public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow'])
      AND c.relkind = 'S'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.deptype IN ('a', 'i')
      )
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO eiscore_owner', object_row.schema_name, object_row.object_name);
  END LOOP;

  FOR function_row IN
    SELECT n.nspname AS schema_name, p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments,
           p.prokind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = ANY (ARRAY['public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow'])
  LOOP
    EXECUTE format(
      'ALTER %s %I.%I(%s) OWNER TO eiscore_owner',
      CASE WHEN function_row.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
      function_row.schema_name,
      function_row.function_name,
      function_row.arguments
    );
  END LOOP;

  -- A definer function without a fixed search_path can be redirected through
  -- a caller-controlled schema. Preserve every already-pinned function and
  -- give the remaining historical functions one audited, deterministic path.
  FOR function_row IN
    SELECT n.nspname AS schema_name, p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments,
           p.prokind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = ANY (ARRAY['public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow'])
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) setting
        WHERE setting LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER %s %I.%I(%s) SET search_path TO pg_catalog, public, app_center, app_data, company_site, hr, scm, workflow, pg_temp',
      CASE WHEN function_row.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
      function_row.schema_name,
      function_row.function_name,
      function_row.arguments
    );
  END LOOP;

  -- Keep user-facing roles non-owning and grant the migrator an explicit
  -- SET ROLE path to the owner.  Neither role is granted BYPASSRLS.
  GRANT eiscore_owner TO eiscore_migrator;
  ALTER ROLE eiscore_owner NOBYPASSRLS;
  ALTER ROLE eiscore_migrator NOBYPASSRLS;
  ALTER ROLE eiscore_authenticator NOBYPASSRLS;
  ALTER ROLE eiscore_agent NOBYPASSRLS;
  ALTER ROLE web_anon NOBYPASSRLS;
  ALTER ROLE web_user NOBYPASSRLS;

  -- The application role can only use the published schemas.  The agent is a
  -- direct SQL worker, so it receives DML (never DDL or DELETE) and sequence
  -- access; RLS remains enabled and is expanded below only where an existing
  -- web_user policy already governs the same operation.
  FOREACH schema_name IN ARRAY ARRAY['public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow'] LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO eiscore_agent', schema_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO eiscore_agent', schema_name);
      EXECUTE format('GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA %I TO eiscore_agent', schema_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE eiscore_owner IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO eiscore_agent', schema_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE eiscore_owner IN SCHEMA %I GRANT SELECT, USAGE ON SEQUENCES TO eiscore_agent', schema_name);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', schema_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE eiscore_owner IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', schema_name);
    END IF;
  END LOOP;

  -- Existing RLS policies are the application contract.  Add the service
  -- role only to policies that already target web_user; anonymous policies
  -- and policies without web_user are not widened.
  FOR policy_row IN
    SELECT p.polname, n.nspname AS schema_name, c.relname AS table_name,
           p.polroles
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY (ARRAY['public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow'])
      AND EXISTS (
        SELECT 1
        FROM unnest(p.polroles) policy_role
        JOIN pg_roles r ON r.oid = policy_role
        WHERE r.rolname = 'web_user'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(p.polroles) policy_role
        JOIN pg_roles r ON r.oid = policy_role
        WHERE r.rolname = 'eiscore_agent'
      )
  LOOP
    SELECT string_agg(
      CASE WHEN policy_role = 0 THEN 'PUBLIC' ELSE format('%I', r.rolname) END,
      ', ' ORDER BY policy_role
    )
      INTO role_list
    FROM unnest(policy_row.polroles) policy_role
    LEFT JOIN pg_roles r ON r.oid = policy_role;
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO %s, eiscore_agent',
      policy_row.polname, policy_row.schema_name, policy_row.table_name, role_list
    );
  END LOOP;

  -- Document workers do not carry a user JWT.  The service identity is
  -- recognised by session_user inside these SECURITY DEFINER predicates,
  -- while PostgREST requests continue to use their JWT claims.
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.document_intake_can_manage() RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path TO 'public', 'pg_temp'
    AS $body$
      SELECT session_user = 'eiscore_agent'
          OR public.document_current_is_admin()
          OR public.document_current_has_permission('op:document_intake.manage');
    $body$;
  $fn$;
  ALTER FUNCTION public.document_intake_can_manage() OWNER TO eiscore_owner;
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.document_intake_can_view() RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path TO 'public', 'pg_temp'
    AS $body$
      SELECT session_user = 'eiscore_agent'
          OR public.document_current_is_admin()
          OR public.document_current_has_permission('op:document_intake.view')
          OR public.document_current_has_permission('op:document_intake.manage');
    $body$;
  $fn$;
  ALTER FUNCTION public.document_intake_can_view() OWNER TO eiscore_owner;
  GRANT EXECUTE ON FUNCTION public.document_intake_can_manage() TO eiscore_agent;
  GRANT EXECUTE ON FUNCTION public.document_intake_can_view() TO eiscore_agent;
  GRANT EXECUTE ON FUNCTION scm.stock_in(integer, uuid, numeric, text, text, text, text, date, text, text) TO eiscore_agent;

  -- Workflow and app-center policies encode an administrator claim directly.
  -- Rebuild only those policies with an explicit service-role branch, keeping
  -- their original roles and predicates intact.
  FOR policy_row IN
    SELECT p.polname, n.nspname AS schema_name, c.relname AS table_name,
           p.polroles, p.polcmd, p.polpermissive,
           pg_get_expr(p.polqual, p.polrelid) AS policy_qual,
           pg_get_expr(p.polwithcheck, p.polrelid) AS policy_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('app_center', 'workflow')
      AND (position('super_admin' IN coalesce(pg_get_expr(p.polqual, p.polrelid), '')) > 0
        OR position('super_admin' IN coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) > 0)
  LOOP
    SELECT string_agg(
      CASE WHEN policy_role = 0 THEN 'PUBLIC' ELSE format('%I', r.rolname) END,
      ', ' ORDER BY policy_role
    )
      INTO role_list
    FROM unnest(policy_row.polroles) policy_role
    LEFT JOIN pg_roles r ON r.oid = policy_role;

    policy_command := CASE policy_row.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'ALL'
      WHEN 'i' THEN 'INSERT'
      WHEN 'u' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE 'ALL'
    END;
    policy_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      policy_row.polname,
      policy_row.schema_name,
      policy_row.table_name,
      CASE WHEN policy_row.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      policy_command,
      role_list
    );
    policy_qual := CASE WHEN policy_row.policy_qual IS NULL THEN NULL
      ELSE format('(session_user = ''eiscore_agent'' OR (%s))', policy_row.policy_qual) END;
    policy_check := CASE WHEN policy_row.policy_check IS NULL THEN NULL
      ELSE format('(session_user = ''eiscore_agent'' OR (%s))', policy_row.policy_check) END;

    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.polname, policy_row.schema_name, policy_row.table_name);
    IF policy_qual IS NULL AND policy_check IS NULL THEN
      EXECUTE policy_sql;
    ELSIF policy_qual IS NULL THEN
      EXECUTE policy_sql || format(' WITH CHECK %s', policy_check);
    ELSIF policy_check IS NULL THEN
      EXECUTE policy_sql || format(' USING %s', policy_qual);
    ELSE
      EXECUTE policy_sql || format(' USING %s WITH CHECK %s', policy_qual, policy_check);
    END IF;
  END LOOP;
END
$$;

-- Never let the PUBLIC role create objects in the API schema.  Existing
-- table/function privileges remain explicit in the baseline and migrations.
REVOKE CREATE ON SCHEMA public, app_center, app_data, company_site, hr, scm, workflow FROM PUBLIC;
