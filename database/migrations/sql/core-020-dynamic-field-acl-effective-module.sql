-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Close the App Center field-ACL lifecycle after core-017..019.
-- A missing aclModule and its deterministic fallback are the same module;
-- normalising that value must never delete and recreate field ACL rows.

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
  DELETE FROM public.sys_field_acl WHERE source_app_id = p_app_id;
  DELETE FROM public.permissions WHERE source_app_id = p_app_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_app_permission_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  module_key text;
  old_module_key text;
  prior_status jsonb;
  lock_key bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    module_key := coalesce(nullif(btrim(OLD.config ->> 'aclModule'), ''), 'app_' || replace(OLD.id::text, '-', ''));
    PERFORM public.cleanup_dynamic_app_permissions(OLD.id, module_key);
    RETURN OLD;
  END IF;

  module_key := coalesce(nullif(btrim(NEW.config ->> 'aclModule'), ''), 'app_' || replace(NEW.id::text, '-', ''));
  IF TG_OP = 'UPDATE' THEN
    old_module_key := coalesce(nullif(btrim(OLD.config ->> 'aclModule'), ''), 'app_' || replace(OLD.id::text, '-', ''));
  END IF;

  FOR lock_key IN
    SELECT DISTINCT hashtextextended(value, 0)
      FROM unnest(ARRAY[module_key, old_module_key]) AS module_keys(value)
     WHERE value IS NOT NULL
     ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(lock_key);
  END LOOP;

  IF TG_OP = 'UPDATE' AND old_module_key IS DISTINCT FROM module_key THEN
    UPDATE public.permissions
       SET code = CASE
         WHEN code = 'app:' || old_module_key THEN 'app:' || module_key
         ELSE 'op:' || module_key || substring(code FROM length('op:' || old_module_key) + 1)
       END,
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND (code = 'app:' || old_module_key
         OR left(code, length('op:' || old_module_key || '.')) = 'op:' || old_module_key || '.');
    UPDATE public.sys_field_acl
       SET module = module_key,
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND module = old_module_key;
  END IF;

  IF lower(coalesce(NEW.status, 'draft')) = 'archived' THEN
    UPDATE public.permissions
       SET app_archive_status = status,
           status = 'retired',
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND app_archive_status IS NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(coalesce(OLD.status, 'draft')) = 'archived' THEN
    UPDATE public.permissions
       SET status = coalesce(app_archive_status, status),
           app_archive_status = NULL,
           updated_at = clock_timestamp()
     WHERE source_app_id = NEW.id
       AND status = 'retired';
  END IF;

  SELECT coalesce(jsonb_object_agg(code, status), '{}'::jsonb)
    INTO prior_status
    FROM public.permissions
   WHERE source_app_id = NEW.id;

  PERFORM public.sync_dynamic_app_permissions(
    NEW.id, NEW.name, module_key, coalesce(NEW.config, '{}'::jsonb)
  );

  UPDATE public.permissions p
     SET status = prior_status ->> p.code,
         updated_at = clock_timestamp()
   WHERE p.source_app_id = NEW.id
     AND prior_status ? p.code
     AND prior_status ->> p.code IN ('disabled', 'retired');
  RETURN NEW;
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
  item jsonb;
  role_id uuid;
  module_name text;
  field_name text;
  changed integer := 0;
  owner_app_id uuid;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'array' THEN RETURN 0; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload) item
    JOIN public.roles r ON r.code = item.value->>'role_code'
    WHERE lower(btrim(coalesce(r.status, 'active'))) = 'locked'
  ) THEN
    RAISE EXCEPTION '锁定角色不可变更字段权限，请先解除锁定' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload) item
    WHERE NOT (item.value ? 'can_view') OR NOT (item.value ? 'can_edit')
  ) THEN
    RAISE EXCEPTION '字段权限更新必须同时提供 can_view 和 can_edit' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload) LOOP
    SELECT r.id, item->>'module', item->>'field_code'
      INTO role_id, module_name, field_name
      FROM public.roles r
     WHERE r.code = item->>'role_code';
    SELECT a.id INTO owner_app_id
      FROM app_center.apps a
     WHERE coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) = module_name
     LIMIT 1;
    INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, source_app_id)
    VALUES (role_id, module_name, field_name,
            (item->>'can_view')::boolean, (item->>'can_edit')::boolean, owner_app_id)
    ON CONFLICT (role_id, module, field_code) DO UPDATE
      SET can_view = EXCLUDED.can_view,
          can_edit = EXCLUDED.can_edit,
          status = 'active',
          updated_at = clock_timestamp();
    changed := changed + 1;
  END LOOP;
  RETURN changed;
END;
$$;

-- The ACL page uses this RPC to ensure catalog rows exist.  Refreshing the
-- page must not reactivate a permission or grant that an administrator
-- explicitly disabled.
CREATE OR REPLACE FUNCTION public.upsert_permissions(payload jsonb)
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
    SELECT 1
      FROM jsonb_array_elements(payload) item
      CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(item.value->'roles', '[]'::jsonb)) AS role_items(role_code)
      JOIN public.roles r ON r.code = role_items.role_code
     WHERE lower(btrim(coalesce(r.status, 'active'))) = 'locked'
  ) THEN
    RAISE EXCEPTION '锁定角色不可变更权限，请先解除锁定' USING ERRCODE = '55000';
  END IF;
  WITH items AS (
    SELECT value->>'code' AS code, value->>'name' AS name,
           value->>'module' AS module, value->>'action' AS action,
           value->'roles' AS roles
      FROM jsonb_array_elements(payload)
  ), upserted AS (
    INSERT INTO public.permissions (code, name, module, action)
    SELECT code, coalesce(name, code), module, action FROM items
     WHERE code IS NOT NULL AND code <> ''
    ON CONFLICT (code) DO UPDATE SET name = excluded.name,
      module = excluded.module, action = excluded.action,
      updated_at = clock_timestamp()
    RETURNING id
  ), role_bind AS (
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM items i JOIN public.permissions p ON p.code = i.code
      JOIN public.roles r ON i.roles IS NOT NULL
        AND r.code = ANY (SELECT jsonb_array_elements_text(i.roles))
    ON CONFLICT (role_id, permission_id) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

ALTER FUNCTION public.cleanup_dynamic_app_permissions(uuid, text) OWNER TO eiscore_owner;
ALTER FUNCTION public.sync_app_permission_lifecycle() OWNER TO eiscore_owner;
ALTER FUNCTION public.ensure_field_acl(text, text[]) OWNER TO eiscore_owner;
ALTER FUNCTION public.upsert_field_acl(jsonb) OWNER TO eiscore_owner;
ALTER FUNCTION public.upsert_permissions(jsonb) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.cleanup_dynamic_app_permissions(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_app_permission_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_field_acl(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_field_acl(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_permissions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_field_acl(text, text[]) TO web_user;
GRANT EXECUTE ON FUNCTION public.upsert_field_acl(jsonb) TO web_user;
GRANT EXECUTE ON FUNCTION public.upsert_permissions(jsonb) TO web_user;
