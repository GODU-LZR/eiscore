-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Preserve a static application's existing no-rule default on first catalog
-- initialization. Never activate existing grants or newly discovered fields
-- in an already configured role/module, and keep dynamic apps pending.

CREATE OR REPLACE FUNCTION public.ensure_field_acl(module_name text, field_codes text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $$
DECLARE
  _count integer := 0;
  owner_app_id uuid;
BEGIN
  IF module_name IS NULL OR module_name = '' OR field_codes IS NULL OR array_length(field_codes, 1) IS NULL THEN
    RETURN 0;
  END IF;
  SELECT a.id INTO owner_app_id
    FROM app_center.apps a
   WHERE coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) = module_name
   LIMIT 1;

  -- Compute one status per role before inserting the entire supplied catalog.
  WITH role_defaults AS MATERIALIZED (
    SELECT r.id AS role_id,
           CASE WHEN owner_app_id IS NULL AND r.status = 'active'
                     AND EXISTS (
                       SELECT 1 FROM public.permissions p
                        WHERE p.code = 'app:' || module_name
                          AND p.source_app_id IS NULL AND p.status = 'active'
                     )
                     AND NOT EXISTS (
                       SELECT 1 FROM public.sys_field_acl f
                        WHERE f.role_id = r.id AND f.module = module_name
                     )
                THEN 'active' ELSE 'created' END AS initial_status
      FROM public.roles r
     WHERE r.status IN ('created', 'active')
  ), targets AS (
    SELECT r.role_id, module_name AS module, fc AS field_code, r.initial_status
      FROM role_defaults r CROSS JOIN unnest(field_codes) AS fc
     WHERE fc IS NOT NULL AND fc <> ''
  ), inserted AS (
    INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, status, source_app_id)
    SELECT role_id, module, field_code, true, true, initial_status, owner_app_id FROM targets
    ON CONFLICT (role_id, module, field_code) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO _count FROM inserted;
  RETURN _count;
END;
$$;

ALTER FUNCTION public.ensure_field_acl(text, text[]) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.ensure_field_acl(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_field_acl(text, text[]) TO web_user;
