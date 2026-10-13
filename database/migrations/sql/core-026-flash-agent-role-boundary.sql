-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Give Flash its own least-privilege database identity. This migration is
-- additive and idempotent; it does not change the frozen baseline or execute
-- against an existing database until the migration runner is explicitly used.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_flash_agent') THEN
    CREATE ROLE eiscore_flash_agent NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  ALTER ROLE eiscore_flash_agent NOLOGIN NOINHERIT NOBYPASSRLS;
END
$$;
GRANT eiscore_flash_agent TO eiscore_authenticator;

-- Remove inherited access first. A missing Flash password leaves this role
-- NOLOGIN (bootstrap fails closed); deployment injects the password separately.
REVOKE ALL ON SCHEMA public, hr, scm, app_center, app_data, company_site, workflow FROM eiscore_flash_agent;
REVOKE ALL ON ALL TABLES IN SCHEMA public, hr, scm, app_center, app_data, company_site, workflow FROM eiscore_flash_agent;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public, hr, scm, app_center, app_data, company_site, workflow FROM eiscore_flash_agent;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public, hr, scm, app_center, app_data, company_site, workflow FROM eiscore_flash_agent;

GRANT USAGE ON SCHEMA public TO eiscore_flash_agent;
GRANT USAGE ON SCHEMA app_center, app_data TO eiscore_flash_agent;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.apps TO eiscore_flash_agent;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.published_routes TO eiscore_flash_agent;
GRANT SELECT, INSERT ON app_center.execution_logs TO eiscore_flash_agent;
GRANT USAGE, SELECT ON SEQUENCE app_center.execution_logs_id_seq, app_center.published_routes_id_seq TO eiscore_flash_agent;

-- Existing app-center policies are claim-oriented. These role policies keep
-- direct Flash database access limited to rows belonging to app_type=flash.
ALTER TABLE app_center.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_center.published_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_center.execution_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flash_agent_apps_select ON app_center.apps;
DROP POLICY IF EXISTS flash_agent_apps_insert ON app_center.apps;
DROP POLICY IF EXISTS flash_agent_apps_update ON app_center.apps;
DROP POLICY IF EXISTS flash_agent_apps_delete ON app_center.apps;
DROP POLICY IF EXISTS flash_agent_apps_select_base ON app_center.apps;
DROP POLICY IF EXISTS flash_agent_apps_insert_base ON app_center.apps;
DROP POLICY IF EXISTS flash_agent_apps_update_base ON app_center.apps;
DROP POLICY IF EXISTS flash_agent_apps_delete_base ON app_center.apps;
CREATE POLICY flash_agent_apps_select_base ON app_center.apps FOR SELECT TO eiscore_flash_agent USING (true);
CREATE POLICY flash_agent_apps_insert_base ON app_center.apps FOR INSERT TO eiscore_flash_agent WITH CHECK (true);
CREATE POLICY flash_agent_apps_update_base ON app_center.apps FOR UPDATE TO eiscore_flash_agent USING (true) WITH CHECK (true);
CREATE POLICY flash_agent_apps_delete_base ON app_center.apps FOR DELETE TO eiscore_flash_agent USING (true);
CREATE POLICY flash_agent_apps_select ON app_center.apps AS RESTRICTIVE FOR SELECT TO eiscore_flash_agent
  USING (app_type = 'flash');
CREATE POLICY flash_agent_apps_insert ON app_center.apps AS RESTRICTIVE FOR INSERT TO eiscore_flash_agent
  WITH CHECK (app_type = 'flash');
CREATE POLICY flash_agent_apps_update ON app_center.apps AS RESTRICTIVE FOR UPDATE TO eiscore_flash_agent
  USING (app_type = 'flash') WITH CHECK (app_type = 'flash');
CREATE POLICY flash_agent_apps_delete ON app_center.apps AS RESTRICTIVE FOR DELETE TO eiscore_flash_agent
  USING (app_type = 'flash');

DROP POLICY IF EXISTS flash_agent_routes_select ON app_center.published_routes;
DROP POLICY IF EXISTS flash_agent_routes_insert ON app_center.published_routes;
DROP POLICY IF EXISTS flash_agent_routes_update ON app_center.published_routes;
DROP POLICY IF EXISTS flash_agent_routes_delete ON app_center.published_routes;
DROP POLICY IF EXISTS flash_agent_routes_select_base ON app_center.published_routes;
DROP POLICY IF EXISTS flash_agent_routes_insert_base ON app_center.published_routes;
DROP POLICY IF EXISTS flash_agent_routes_update_base ON app_center.published_routes;
DROP POLICY IF EXISTS flash_agent_routes_delete_base ON app_center.published_routes;
CREATE POLICY flash_agent_routes_select_base ON app_center.published_routes FOR SELECT TO eiscore_flash_agent USING (true);
CREATE POLICY flash_agent_routes_insert_base ON app_center.published_routes FOR INSERT TO eiscore_flash_agent WITH CHECK (true);
CREATE POLICY flash_agent_routes_update_base ON app_center.published_routes FOR UPDATE TO eiscore_flash_agent USING (true) WITH CHECK (true);
CREATE POLICY flash_agent_routes_delete_base ON app_center.published_routes FOR DELETE TO eiscore_flash_agent USING (true);
CREATE POLICY flash_agent_routes_select ON app_center.published_routes AS RESTRICTIVE FOR SELECT TO eiscore_flash_agent
  USING (EXISTS (SELECT 1 FROM app_center.apps a WHERE a.id = app_id AND a.app_type = 'flash'));
CREATE POLICY flash_agent_routes_insert ON app_center.published_routes AS RESTRICTIVE FOR INSERT TO eiscore_flash_agent
  WITH CHECK (EXISTS (SELECT 1 FROM app_center.apps a WHERE a.id = app_id AND a.app_type = 'flash'));
CREATE POLICY flash_agent_routes_update ON app_center.published_routes AS RESTRICTIVE FOR UPDATE TO eiscore_flash_agent
  USING (EXISTS (SELECT 1 FROM app_center.apps a WHERE a.id = app_id AND a.app_type = 'flash'))
  WITH CHECK (EXISTS (SELECT 1 FROM app_center.apps a WHERE a.id = app_id AND a.app_type = 'flash'));
CREATE POLICY flash_agent_routes_delete ON app_center.published_routes AS RESTRICTIVE FOR DELETE TO eiscore_flash_agent
  USING (EXISTS (SELECT 1 FROM app_center.apps a WHERE a.id = app_id AND a.app_type = 'flash'));

DROP POLICY IF EXISTS flash_agent_execution_logs_select ON app_center.execution_logs;
DROP POLICY IF EXISTS flash_agent_execution_logs_insert ON app_center.execution_logs;
DROP POLICY IF EXISTS flash_agent_execution_logs_select_base ON app_center.execution_logs;
DROP POLICY IF EXISTS flash_agent_execution_logs_insert_base ON app_center.execution_logs;
CREATE POLICY flash_agent_execution_logs_select_base ON app_center.execution_logs FOR SELECT TO eiscore_flash_agent USING (true);
CREATE POLICY flash_agent_execution_logs_insert_base ON app_center.execution_logs FOR INSERT TO eiscore_flash_agent WITH CHECK (true);
CREATE POLICY flash_agent_execution_logs_select ON app_center.execution_logs AS RESTRICTIVE FOR SELECT TO eiscore_flash_agent
  USING (EXISTS (SELECT 1 FROM app_center.apps a WHERE a.id = app_id AND a.app_type = 'flash'));
CREATE POLICY flash_agent_execution_logs_insert ON app_center.execution_logs AS RESTRICTIVE FOR INSERT TO eiscore_flash_agent
  WITH CHECK (EXISTS (SELECT 1 FROM app_center.apps a WHERE a.id = app_id AND a.app_type = 'flash'));

-- Flash app creation uses a narrow wrapper instead of the broad business DDL
-- role. The existing owner-only implementation remains unchanged.
CREATE OR REPLACE FUNCTION app_center.create_flash_data_app_table(
  app_id uuid, table_name text, columns jsonb
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, app_center, app_data, pg_temp
AS $function$
DECLARE
  result text;
  physical_name text;
BEGIN
  IF NOT pg_has_role(session_user, 'eiscore_flash_agent', 'member') THEN
    RAISE EXCEPTION 'eiscore_flash_agent is required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_center.apps WHERE id = app_id AND app_type = 'flash') THEN
    RAISE EXCEPTION 'Flash app does not exist: %', app_id USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('request.jwt.claims', '{"app_role":"super_admin","username":"flash-agent"}', true);
  result := app_center.create_data_app_table(app_id, table_name, columns);
  physical_name := substring(result FROM 10);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_data.%I TO eiscore_flash_agent', physical_name);
  EXECUTE format('DROP POLICY IF EXISTS flash_agent_dynamic_data ON app_data.%I', physical_name);
    EXECUTE format('DROP POLICY IF EXISTS flash_agent_dynamic_data_base ON app_data.%I', physical_name);
    EXECUTE format('CREATE POLICY flash_agent_dynamic_data_base ON app_data.%I FOR ALL TO eiscore_flash_agent USING (true) WITH CHECK (true)', physical_name);
  EXECUTE format(
    'CREATE POLICY flash_agent_dynamic_data ON app_data.%I AS RESTRICTIVE FOR ALL TO eiscore_flash_agent USING (current_user = ''eiscore_flash_agent'') WITH CHECK (current_user = ''eiscore_flash_agent'')',
    physical_name
  );
  RETURN result;
END
$function$;
ALTER FUNCTION app_center.create_flash_data_app_table(uuid, text, jsonb) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION app_center.create_flash_data_app_table(uuid, text, jsonb) FROM PUBLIC, web_anon, web_user, eiscore_agent;
GRANT EXECUTE ON FUNCTION app_center.create_flash_data_app_table(uuid, text, jsonb) TO eiscore_flash_agent;
REVOKE ALL ON FUNCTION app_center.create_data_app_table(uuid, text, jsonb) FROM eiscore_flash_agent;

-- Flash authorization must not reuse the general ontology context RPC: that
-- function intentionally exposes business tables, HR/SCM apps and KG nodes.
-- This SECURITY DEFINER projection returns only Flash app metadata, registered
-- Flash tables/columns, and the minimum app-scoped permissions/field ACLs.
CREATE OR REPLACE FUNCTION public.flash_agent_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, app_center, app_data, pg_temp
AS $function$
DECLARE
  claims jsonb := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  username text := COALESCE(NULLIF(claims ->> 'username', ''), NULLIF(claims ->> 'sub', ''), '');
  role_codes jsonb := '[]'::jsonb;
  permission_codes jsonb := '[]'::jsonb;
  apps jsonb := '[]'::jsonb;
  tables jsonb := '[]'::jsonb;
  columns jsonb := '{}'::jsonb;
  field_acl jsonb := '{}'::jsonb;
BEGIN
  IF NOT pg_has_role(session_user, 'eiscore_flash_agent', 'member') THEN
    RAISE EXCEPTION 'eiscore_flash_agent is required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT role_code ORDER BY role_code), '[]'::jsonb)
    INTO role_codes
  FROM (
    SELECT NULLIF(claims ->> 'app_role', '') AS role_code
    UNION ALL SELECT NULLIF(claims ->> 'role_code', '')
    UNION ALL
    SELECT r.code
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE u.username = username
    UNION ALL
    SELECT NULLIF(u.role, '')
    FROM public.users u
    WHERE u.username = username
  ) roles
  WHERE COALESCE(role_code, '') <> '';

  SELECT COALESCE(jsonb_agg(DISTINCT code ORDER BY code), '[]'::jsonb)
    INTO permission_codes
  FROM (
    SELECT item.value #>> '{}' AS code
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(claims -> 'permissions') = 'array'
        THEN claims -> 'permissions' ELSE '[]'::jsonb END
    ) item
    UNION ALL
    SELECT p.code
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.code IN (SELECT jsonb_array_elements_text(role_codes))
    UNION ALL
    SELECT item.value #>> '{}'
    FROM public.users u
    CROSS JOIN LATERAL unnest(COALESCE(u.permissions, ARRAY[]::text[])) item(value)
    WHERE u.username = username
  ) permissions
  JOIN public.permissions active ON active.code = permissions.code AND active.status = 'active'
  WHERE permissions.code = 'module:app'
     OR permissions.code IN (
       SELECT 'app:' || COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''))
       FROM app_center.apps a WHERE a.app_type = 'flash'
     )
     OR EXISTS (
       SELECT 1
       FROM app_center.apps a
       WHERE a.app_type = 'flash'
         AND permissions.code LIKE 'op:' || COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) || '.%'
     );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'app_id', a.id::text,
      'app_name', a.name,
      'app_type', a.app_type,
      'acl_module', COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')),
      'qualified_table', NULLIF(btrim(COALESCE(a.config ->> 'table_name', a.config ->> 'tableName', a.config ->> 'table')), '')
    ) ORDER BY a.name, a.id), '[]'::jsonb)
    INTO apps
  FROM app_center.apps a
  WHERE a.app_type = 'flash'
    AND (
      claims ->> 'app_role' IN ('admin', 'super_admin')
      OR 'module:app' IN (SELECT jsonb_array_elements_text(permission_codes))
      OR ('app:' || COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''))) IN (SELECT jsonb_array_elements_text(permission_codes))
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table_schema', r.table_schema,
      'table_name', r.table_name,
      'access_level', CASE WHEN 'module:app' IN (SELECT jsonb_array_elements_text(permission_codes)) THEN 'operate' ELSE 'read' END
    ) ORDER BY r.table_name), '[]'::jsonb)
    INTO tables
  FROM app_center.data_app_table_registry r
  JOIN app_center.apps a ON a.id = r.app_id AND a.app_type = 'flash'
  WHERE r.table_schema = 'app_data' AND r.lifecycle = 'managed'
    AND a.id::text IN (SELECT value ->> 'app_id' FROM jsonb_array_elements(apps));

  SELECT COALESCE(jsonb_object_agg(table_id, cols), '{}'::jsonb)
    INTO columns
  FROM (
    SELECT r.table_schema || '.' || r.table_name AS table_id,
           jsonb_agg(jsonb_build_object(
             'col', c.column_name,
             'name', c.column_name,
             'type', c.data_type,
             'ui', c.data_type,
             'sensitive', false
           ) ORDER BY c.ordinal_position) AS cols
    FROM app_center.data_app_table_registry r
    JOIN app_center.apps a ON a.id = r.app_id AND a.app_type = 'flash'
    JOIN information_schema.columns c
      ON c.table_schema = r.table_schema AND c.table_name = r.table_name
    WHERE r.table_schema = 'app_data' AND r.lifecycle = 'managed'
      AND a.id::text IN (SELECT value ->> 'app_id' FROM jsonb_array_elements(apps))
    GROUP BY r.table_schema, r.table_name
  ) visible_columns;

  SELECT COALESCE(jsonb_object_agg(module_name, fields), '{}'::jsonb)
    INTO field_acl
  FROM (
    SELECT module_name,
           jsonb_object_agg(field_code, jsonb_build_object(
             'canView', can_view,
             'canEdit', can_edit
           ) ORDER BY field_code) AS fields
    FROM (
      SELECT acl.module AS module_name,
             acl.field_code,
             bool_or(acl.can_view) AS can_view,
             bool_or(acl.can_edit) AS can_edit
      FROM public.sys_field_acl acl
      JOIN public.roles r ON r.id = acl.role_id
      WHERE r.code IN (SELECT jsonb_array_elements_text(role_codes))
        AND acl.module IN (
          SELECT COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''))
          FROM app_center.apps a
          WHERE a.app_type = 'flash'
            AND a.id::text IN (SELECT value ->> 'app_id' FROM jsonb_array_elements(apps))
        )
        AND COALESCE(acl.status, 'active') = 'active'
      GROUP BY acl.module, acl.field_code
    ) field_rows
    GROUP BY module_name
  ) acl_rows;

  RETURN jsonb_build_object(
    'fetchedAt', clock_timestamp(),
    'source', 'flash_agent_context_v1',
    'accessPolicy', jsonb_build_object(
      'roleScoped', true,
      'superUser', claims ->> 'app_role' IN ('admin', 'super_admin'),
      'username', username,
      'roles', role_codes
    ),
    'permissions', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', value #>> '{}') ORDER BY value #>> '{}') FROM jsonb_array_elements(permission_codes)), '[]'::jsonb),
    'apps', apps,
    'tables', tables,
    'columns', columns,
    'fieldAcl', field_acl,
    'fieldAclAvailable', true
  );
END
$function$;
ALTER FUNCTION public.flash_agent_context() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.flash_agent_context() FROM PUBLIC, web_anon, web_user, eiscore_agent;
GRANT EXECUTE ON FUNCTION public.flash_agent_context() TO eiscore_flash_agent;

-- Adopt already-registered Flash tables without broadening access to Twin/BI
-- or other business tables. New tables are granted by the wrapper above.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT r.table_name
    FROM app_center.data_app_table_registry r
    JOIN app_center.apps a ON a.id = r.app_id
    WHERE r.table_schema = 'app_data' AND r.lifecycle = 'managed' AND a.app_type = 'flash'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_data.%I TO eiscore_flash_agent', item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS flash_agent_dynamic_data ON app_data.%I', item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS flash_agent_dynamic_data_base ON app_data.%I', item.table_name);
    EXECUTE format('CREATE POLICY flash_agent_dynamic_data_base ON app_data.%I FOR ALL TO eiscore_flash_agent USING (true) WITH CHECK (true)', item.table_name);
    EXECUTE format(
      'CREATE POLICY flash_agent_dynamic_data ON app_data.%I AS RESTRICTIVE FOR ALL TO eiscore_flash_agent USING (current_user = ''eiscore_flash_agent'') WITH CHECK (current_user = ''eiscore_flash_agent'')',
      item.table_name
    );
  END LOOP;
END
$$;

COMMENT ON ROLE eiscore_flash_agent IS
  'Flash Builder database identity: app registry, Flash routes/audit and registered Flash data tables only; no Twin/BI/business access';
