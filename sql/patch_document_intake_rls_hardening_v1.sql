-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: document intake PostgREST RLS hardening V1.
--
-- The document workers use the postgres connection directly, so these policies
-- only scope external/web_user access through PostgREST.

SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION public.document_current_claims()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.document_current_username()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(public.document_current_claims() ->> 'username', ''),
    NULLIF(public.document_current_claims() ->> 'sub', ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.document_current_role_codes()
RETURNS TABLE(role_code TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.document_current_permissions()
RETURNS TABLE(permission_code TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.document_current_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_current_role_codes() r
    WHERE lower(r.role_code) IN ('super_admin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.document_current_has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_current_permissions() p
    WHERE p.permission_code = p_permission
  );
$$;

CREATE OR REPLACE FUNCTION public.document_intake_can_view()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.document_current_is_admin()
      OR public.document_current_has_permission('op:document_intake.view')
      OR public.document_current_has_permission('op:document_intake.manage');
$$;

CREATE OR REPLACE FUNCTION public.document_intake_can_manage()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.document_current_is_admin()
      OR public.document_current_has_permission('op:document_intake.manage');
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
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
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_select', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_insert', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_update', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_delete', table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO web_user USING (public.document_intake_can_view())',
      table_name || '_select',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO web_user WITH CHECK (public.document_intake_can_manage())',
      table_name || '_insert',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO web_user USING (public.document_intake_can_manage()) WITH CHECK (public.document_intake_can_manage())',
      table_name || '_update',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO web_user USING (public.document_intake_can_manage())',
      table_name || '_delete',
      table_name
    );
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.document_current_claims() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_current_username() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_current_role_codes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_current_permissions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_current_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_current_has_permission(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_intake_can_view() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_intake_can_manage() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.document_current_claims() TO web_user;
GRANT EXECUTE ON FUNCTION public.document_current_username() TO web_user;
GRANT EXECUTE ON FUNCTION public.document_current_role_codes() TO web_user;
GRANT EXECUTE ON FUNCTION public.document_current_permissions() TO web_user;
GRANT EXECUTE ON FUNCTION public.document_current_is_admin() TO web_user;
GRANT EXECUTE ON FUNCTION public.document_current_has_permission(TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION public.document_intake_can_view() TO web_user;
GRANT EXECUTE ON FUNCTION public.document_intake_can_manage() TO web_user;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
