-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Scope dynamic field ACL rows to their owning App Center application.

ALTER TABLE public.sys_field_acl
  ADD COLUMN IF NOT EXISTS source_app_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sys_field_acl_source_app_id_fkey'
       AND conrelid = 'public.sys_field_acl'::regclass
  ) THEN
    ALTER TABLE public.sys_field_acl
      ADD CONSTRAINT sys_field_acl_source_app_id_fkey
      FOREIGN KEY (source_app_id)
      REFERENCES app_center.apps(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sys_field_acl_source_app_id
  ON public.sys_field_acl(source_app_id)
  WHERE source_app_id IS NOT NULL;

UPDATE public.sys_field_acl f
   SET source_app_id = a.id
  FROM app_center.apps a
 WHERE f.source_app_id IS NULL
   AND f.module = coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''));

CREATE OR REPLACE FUNCTION public.cleanup_dynamic_app_permissions(
  p_app_id uuid,
  p_module text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.sys_field_acl
   WHERE source_app_id = p_app_id;
  DELETE FROM public.permissions WHERE source_app_id = p_app_id;
END;
$$;

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
  WITH targets AS (
    SELECT r.id AS role_id, module_name AS module, fc AS field_code
      FROM public.roles r CROSS JOIN unnest(field_codes) AS fc
     WHERE fc IS NOT NULL AND fc <> '' AND r.status IN ('created', 'active')
  ), upserted AS (
    INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, status, source_app_id)
    SELECT role_id, module, field_code, true, true, 'created', owner_app_id FROM targets
    ON CONFLICT (role_id, module, field_code) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_field_acl(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'array' THEN RETURN 0; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload) item
    JOIN public.roles r ON r.code = item.value->>'role_code'
    WHERE lower(btrim(coalesce(r.status, 'active'))) = 'locked'
  ) THEN
    RAISE EXCEPTION '锁定角色不可变更字段权限，请先解除锁定' USING ERRCODE = '55000';
  END IF;
  WITH items AS (
    SELECT value->>'role_code' AS role_code,
           value->>'module' AS module,
           value->>'field_code' AS field_code,
           coalesce((value->>'can_view')::boolean, true) AS can_view,
           coalesce((value->>'can_edit')::boolean, true) AS can_edit
      FROM jsonb_array_elements(payload)
  ), upserted AS (
    INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, source_app_id)
    SELECT r.id, i.module, i.field_code, i.can_view, i.can_edit,
           (SELECT a.id FROM app_center.apps a
             WHERE coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) = i.module
             LIMIT 1)
      FROM items i JOIN public.roles r ON r.code = i.role_code
    ON CONFLICT (role_id, module, field_code) DO UPDATE
      SET can_view = excluded.can_view,
          can_edit = excluded.can_edit,
          status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

ALTER FUNCTION public.cleanup_dynamic_app_permissions(uuid, text) OWNER TO eiscore_owner;
ALTER FUNCTION public.ensure_field_acl(text, text[]) OWNER TO eiscore_owner;
ALTER FUNCTION public.upsert_field_acl(jsonb) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.cleanup_dynamic_app_permissions(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_field_acl(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_field_acl(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_field_acl(text, text[]) TO web_user;
GRANT EXECUTE ON FUNCTION public.upsert_field_acl(jsonb) TO web_user;
