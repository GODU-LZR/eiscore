-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Keep dynamic App Center permissions in the same transaction as app CRUD.
-- The application table is the lifecycle source of truth; this trigger is
-- therefore also used by the Harness/Flash write path.

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS source_app_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'permissions_source_app_id_fkey'
       AND conrelid = 'public.permissions'::regclass
  ) THEN
    ALTER TABLE public.permissions
      ADD CONSTRAINT permissions_source_app_id_fkey
      FOREIGN KEY (source_app_id)
      REFERENCES app_center.apps(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_permissions_source_app_id
  ON public.permissions(source_app_id)
  WHERE source_app_id IS NOT NULL;

-- Recover ownership for generated app keys that predate source_app_id.  The
-- key is deterministic, so this does not guess ownership from a display name.
UPDATE public.permissions p
   SET source_app_id = a.id
  FROM app_center.apps a
 WHERE p.source_app_id IS NULL
   AND (
     p.code = 'app:' || coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''))
     OR left(p.code, length('op:' || coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) || '.'))
        = 'op:' || coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) || '.'
   );

-- A deleted app cannot be recovered from a permission row.  Remove only the
-- deterministic legacy keys whose UUID no longer exists in app_center.apps.
DELETE FROM public.permissions p
 WHERE p.source_app_id IS NULL
   AND (
     p.code ~ '^app:app_[0-9a-f]{32}$'
     OR p.code ~ '^op:app_[0-9a-f]{32}[.].+$'
   )
   AND NOT EXISTS (
     SELECT 1
       FROM app_center.apps a
      WHERE p.code = 'app:app_' || replace(a.id::text, '-', '')
         OR (left(p.code, 7) = 'op:app_' AND substring(p.code FROM 8 FOR 32) = replace(a.id::text, '-', ''))
   );

CREATE OR REPLACE FUNCTION public.sync_dynamic_app_permissions(
  p_app_id uuid,
  p_app_name text,
  p_module text,
  p_config jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  action_key text;
  action_name text;
  raw_value text;
  prefix text := 'op:' || p_module || '.';
  operation_keys text[] := ARRAY[
    'view', 'create', 'edit', 'delete', 'import', 'export', 'config',
    'workflow_start', 'workflow_transition', 'workflow_complete',
    'status_transition'
  ];
  config_key text;
  config_value jsonb;
  item jsonb;
  pair record;
  permission_code text;
  super_admin_id uuid;
BEGIN
  IF p_app_id IS NULL OR nullif(btrim(p_module), '') IS NULL THEN
    RETURN;
  END IF;

  -- App configs historically used all three names for custom operations.
  FOREACH config_key IN ARRAY ARRAY['ops', 'businessOps', 'operationPermissions'] LOOP
    config_value := coalesce(p_config -> config_key, 'null'::jsonb);
    IF jsonb_typeof(config_value) = 'array' THEN
      FOR item IN SELECT value FROM jsonb_array_elements(config_value) LOOP
        raw_value := CASE jsonb_typeof(item)
          WHEN 'object' THEN coalesce(item->>'code', item->>'permission', item->>'action', item->>'value')
          WHEN 'string' THEN item #>> '{}'
          ELSE ''
        END;
        raw_value := btrim(coalesce(raw_value, ''));
        IF left(raw_value, length(prefix)) = prefix THEN
          raw_value := substring(raw_value FROM length(prefix) + 1);
        ELSIF left(raw_value, 3) = 'op:' THEN
          raw_value := '';
        END IF;
        IF raw_value <> '' AND NOT raw_value = ANY(operation_keys) THEN
          operation_keys := operation_keys || raw_value;
        END IF;
      END LOOP;
    ELSIF jsonb_typeof(config_value) = 'object' THEN
      FOR pair IN SELECT key, value FROM jsonb_each(config_value) LOOP
        raw_value := CASE jsonb_typeof(pair.value)
          WHEN 'object' THEN coalesce(pair.value->>'code', pair.value->>'permission', pair.value->>'action', pair.value->>'value')
          WHEN 'string' THEN pair.value #>> '{}'
          WHEN 'boolean' THEN CASE WHEN (pair.value #>> '{}')::boolean THEN pair.key ELSE '' END
          ELSE ''
        END;
        raw_value := btrim(coalesce(raw_value, ''));
        IF left(raw_value, length(prefix)) = prefix THEN
          raw_value := substring(raw_value FROM length(prefix) + 1);
        ELSIF left(raw_value, 3) = 'op:' THEN
          raw_value := '';
        END IF;
        IF raw_value = '' AND jsonb_typeof(pair.value) = 'boolean'
           AND (pair.value #>> '{}')::boolean THEN
          raw_value := btrim(pair.key);
        END IF;
        IF raw_value <> '' AND NOT raw_value = ANY(operation_keys) THEN
          operation_keys := operation_keys || raw_value;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  SELECT id INTO super_admin_id FROM public.roles WHERE code = 'super_admin' LIMIT 1;

  permission_code := 'app:' || p_module;
  IF EXISTS (
    SELECT 1 FROM public.permissions
     WHERE code = permission_code
       AND source_app_id IS DISTINCT FROM p_app_id
  ) THEN
    RAISE EXCEPTION '应用权限编码冲突: %', permission_code USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.permissions (code, name, module, action, status, source_app_id)
  VALUES (permission_code, '应用-' || coalesce(nullif(p_app_name, ''), p_module), p_app_name, '进入', 'active', p_app_id)
  ON CONFLICT (code) DO UPDATE
    SET name = excluded.name, module = excluded.module, action = excluded.action,
        status = 'active', source_app_id = excluded.source_app_id,
        updated_at = clock_timestamp();
  IF super_admin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT super_admin_id, id, 'active' FROM public.permissions WHERE code = permission_code
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  FOREACH action_key IN ARRAY operation_keys LOOP
    action_name := CASE action_key
      WHEN 'view' THEN '查看'
      WHEN 'create' THEN '新增'
      WHEN 'edit' THEN '编辑'
      WHEN 'delete' THEN '删除'
      WHEN 'import' THEN '导入'
      WHEN 'export' THEN '导出'
      WHEN 'config' THEN '配置'
      WHEN 'workflow_start' THEN '流程发起'
      WHEN 'workflow_transition' THEN '流程流转'
      WHEN 'workflow_complete' THEN '流程完结'
      WHEN 'status_transition' THEN '状态变更'
      ELSE action_key
    END;
    permission_code := prefix || action_key;
    IF EXISTS (
      SELECT 1 FROM public.permissions
       WHERE code = permission_code
         AND source_app_id IS DISTINCT FROM p_app_id
    ) THEN
      RAISE EXCEPTION '应用权限编码冲突: %', permission_code USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.permissions (code, name, module, action, status, source_app_id)
    VALUES (permission_code, coalesce(nullif(p_app_name, ''), p_module) || '-' || action_name,
            p_app_name, action_key, 'active', p_app_id)
    ON CONFLICT (code) DO UPDATE
      SET name = excluded.name, module = excluded.module, action = excluded.action,
          status = 'active', source_app_id = excluded.source_app_id,
          updated_at = clock_timestamp();
    IF super_admin_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id, status)
      SELECT super_admin_id, id, 'active' FROM public.permissions WHERE code = permission_code
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Remove operations deleted from config while preserving grants for the
  -- operations that are still declared by this app.
  DELETE FROM public.permissions
   WHERE source_app_id = p_app_id
     AND code <> ALL(ARRAY['app:' || p_module] || ARRAY(SELECT prefix || value FROM unnest(operation_keys) AS value));
END;
$$;

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
   WHERE p_module IS NOT NULL AND module = p_module;
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
BEGIN
  IF TG_OP = 'DELETE' THEN
    module_key := coalesce(nullif(btrim(OLD.config ->> 'aclModule'), ''), 'app_' || replace(OLD.id::text, '-', ''));
    PERFORM public.cleanup_dynamic_app_permissions(OLD.id, module_key);
    RETURN OLD;
  END IF;

  module_key := coalesce(nullif(btrim(NEW.config ->> 'aclModule'), ''), 'app_' || replace(NEW.id::text, '-', ''));
  IF TG_OP = 'UPDATE' AND OLD.config ->> 'aclModule' IS DISTINCT FROM NEW.config ->> 'aclModule' THEN
    PERFORM public.cleanup_dynamic_app_permissions(NEW.id, coalesce(nullif(btrim(OLD.config ->> 'aclModule'), ''), 'app_' || replace(OLD.id::text, '-', '')));
  END IF;
  IF lower(coalesce(NEW.status, 'draft')) = 'archived' THEN
    PERFORM public.cleanup_dynamic_app_permissions(NEW.id, module_key);
  ELSE
    PERFORM public.sync_dynamic_app_permissions(NEW.id, NEW.name, module_key, coalesce(NEW.config, '{}'::jsonb));
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_dynamic_app_permissions(uuid, text, text, jsonb) OWNER TO eiscore_owner;
ALTER FUNCTION public.cleanup_dynamic_app_permissions(uuid, text) OWNER TO eiscore_owner;
ALTER FUNCTION public.sync_app_permission_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.sync_dynamic_app_permissions(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_dynamic_app_permissions(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_app_permission_lifecycle() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_apps_permission_lifecycle ON app_center.apps;
CREATE TRIGGER tg_apps_permission_lifecycle
  AFTER INSERT OR UPDATE OR DELETE ON app_center.apps
  FOR EACH ROW EXECUTE FUNCTION public.sync_app_permission_lifecycle();

-- Reconcile existing non-archived apps once when this migration is installed.
DO $$
DECLARE
  app_row record;
BEGIN
  FOR app_row IN SELECT id, name, config, status FROM app_center.apps LOOP
    IF lower(coalesce(app_row.status, 'draft')) = 'archived' THEN
      PERFORM public.cleanup_dynamic_app_permissions(app_row.id, coalesce(nullif(btrim(app_row.config ->> 'aclModule'), ''), 'app_' || replace(app_row.id::text, '-', '')));
    ELSE
      PERFORM public.sync_dynamic_app_permissions(app_row.id, app_row.name,
        coalesce(nullif(btrim(app_row.config ->> 'aclModule'), ''), 'app_' || replace(app_row.id::text, '-', '')),
        coalesce(app_row.config, '{}'::jsonb));
    END IF;
  END LOOP;
END;
$$;
