-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Corrective ACL lifecycle migration.  The ACL catalog is reconciled whenever
-- the permission page opens, so reconciliation must never turn an existing
-- created/locked/disabled row back into an effective row.  New grants and
-- scope/field records begin in created and require an explicit activation.

-- Direct REST inserts use the same lifecycle default as the matrix views.
ALTER TABLE public.role_permissions
  ALTER COLUMN status SET DEFAULT 'created';
ALTER TABLE public.role_data_scopes
  ALTER COLUMN status SET DEFAULT 'created';
ALTER TABLE public.sys_field_acl
  ALTER COLUMN status SET DEFAULT 'created';

CREATE OR REPLACE FUNCTION public.tg_v_role_permissions_matrix_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
BEGIN
  IF NEW.granted IS DISTINCT FROM OLD.granted THEN
    IF NEW.granted THEN
      -- Checking a permission creates an assignment; activation remains an
      -- explicit lifecycle action in the assignment_status column.
      INSERT INTO public.role_permissions (role_id, permission_id, status)
      VALUES (OLD.role_id, OLD.permission_id, 'created')
      ON CONFLICT (role_id, permission_id) DO UPDATE
        SET status = 'created', updated_at = clock_timestamp();
    ELSE
      UPDATE public.role_permissions
         SET status = 'disabled', updated_at = clock_timestamp()
       WHERE role_id = OLD.role_id AND permission_id = OLD.permission_id;
    END IF;
  ELSIF NEW.assignment_status IS DISTINCT FROM OLD.assignment_status
        AND OLD.assignment_status IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    VALUES (
      OLD.role_id,
      OLD.permission_id,
      coalesce(nullif(lower(btrim(NEW.assignment_status)), ''), 'created')
    )
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = excluded.status, updated_at = clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_v_role_data_scopes_matrix_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.role_data_scopes (role_id, module, scope_type, dept_id, status)
  VALUES (
    NEW.role_id,
    NEW.module,
    coalesce(NEW.scope_type, 'self'),
    NEW.dept_id,
    coalesce(nullif(lower(btrim(NEW.scope_status)), ''), 'created')
  )
  ON CONFLICT (role_id, module) DO UPDATE
    SET scope_type = excluded.scope_type,
        dept_id = excluded.dept_id,
        status = excluded.status,
        updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

-- Field ACL reconciliation changes field values only.  It must preserve an
-- administrator's explicit lifecycle state on an existing field row.
CREATE OR REPLACE FUNCTION public.upsert_field_acl(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'array' THEN
    RETURN 0;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(payload) item
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
    INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, status, source_app_id)
    SELECT r.id, i.module, i.field_code, i.can_view, i.can_edit, 'created',
           (SELECT a.id FROM app_center.apps a
             WHERE coalesce(nullif(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) = i.module
             LIMIT 1)
      FROM items i JOIN public.roles r ON r.code = i.role_code
    ON CONFLICT (role_id, module, field_code) DO UPDATE
      SET can_view = excluded.can_view,
          can_edit = excluded.can_edit,
          updated_at = clock_timestamp()
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

-- Permission catalog reconciliation is metadata-only for existing rows.  A
-- missing role assignment is created but not effective until activated.
CREATE OR REPLACE FUNCTION public.upsert_permissions(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'array' THEN
    RETURN 0;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(payload) item
      CROSS JOIN LATERAL jsonb_array_elements_text(
        coalesce(item.value->'roles', '[]'::jsonb)
      ) AS role_items(role_code)
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
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT r.id, p.id, 'created'
      FROM items i
      JOIN public.permissions p ON p.code = i.code
      JOIN public.roles r ON i.roles IS NOT NULL
        AND r.code = ANY (SELECT jsonb_array_elements_text(i.roles))
    ON CONFLICT (role_id, permission_id) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

-- Dynamic App Center permissions use the same non-destructive reconciliation
-- rules.  Existing definition and assignment states are preserved; newly
-- discovered super-admin assignments begin in created.
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
     WHERE code = permission_code AND source_app_id IS DISTINCT FROM p_app_id
  ) THEN
    RAISE EXCEPTION '应用权限编码冲突: %', permission_code USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.permissions (code, name, module, action, status, source_app_id)
  VALUES (permission_code, '应用-' || coalesce(nullif(p_app_name, ''), p_module), p_app_name, '进入', 'active', p_app_id)
  ON CONFLICT (code) DO UPDATE
    SET name = excluded.name, module = excluded.module, action = excluded.action,
        source_app_id = excluded.source_app_id, updated_at = clock_timestamp();
  IF super_admin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT super_admin_id, id, 'created' FROM public.permissions WHERE code = permission_code
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
       WHERE code = permission_code AND source_app_id IS DISTINCT FROM p_app_id
    ) THEN
      RAISE EXCEPTION '应用权限编码冲突: %', permission_code USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.permissions (code, name, module, action, status, source_app_id)
    VALUES (permission_code, coalesce(nullif(p_app_name, ''), p_module) || '-' || action_name,
            p_app_name, action_key, 'active', p_app_id)
    ON CONFLICT (code) DO UPDATE
      SET name = excluded.name, module = excluded.module, action = excluded.action,
          source_app_id = excluded.source_app_id, updated_at = clock_timestamp();
    IF super_admin_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id, status)
      SELECT super_admin_id, id, 'created' FROM public.permissions WHERE code = permission_code
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;

  DELETE FROM public.permissions
   WHERE source_app_id = p_app_id
     AND code <> ALL(ARRAY['app:' || p_module] || ARRAY(SELECT prefix || value FROM unnest(operation_keys) AS value));
END;
$$;

ALTER FUNCTION public.tg_v_role_permissions_matrix_update() OWNER TO eiscore_owner;
ALTER FUNCTION public.tg_v_role_data_scopes_matrix_update() OWNER TO eiscore_owner;
ALTER FUNCTION public.upsert_field_acl(jsonb) OWNER TO eiscore_owner;
ALTER FUNCTION public.upsert_permissions(jsonb) OWNER TO eiscore_owner;
ALTER FUNCTION public.sync_dynamic_app_permissions(uuid, text, text, jsonb) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.tg_v_role_permissions_matrix_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_v_role_data_scopes_matrix_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_field_acl(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_permissions(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_dynamic_app_permissions(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_field_acl(jsonb) TO web_user;
GRANT EXECUTE ON FUNCTION public.upsert_permissions(jsonb) TO web_user;
