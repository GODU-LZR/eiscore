-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- ACL lifecycle contract (not registered until its release review is complete).
-- Existing roles and grants remain active.  A locked role is an effective
-- read/authorization state whose configuration is frozen; created/disabled
-- roles do not authorize requests.  This migration only adds explicit
-- state/audit columns and makes the read models report them.

-- Roles: created -> active -> locked/disabled.  Existing rows are preserved as
-- active so an upgrade cannot silently revoke access.
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS status text;
UPDATE public.roles
   SET status = 'active'
 WHERE status IS NULL OR lower(btrim(status)) = '';
ALTER TABLE public.roles
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'roles_status_check'
       AND conrelid = 'public.roles'::regclass
  ) THEN
    ALTER TABLE public.roles
      ADD CONSTRAINT roles_status_check
      CHECK (status IN ('created', 'active', 'locked', 'disabled'));
  END IF;
END;
$$;

-- Permission definitions and grants have an independent active/disabled
-- state.  Keeping a disabled row is important for audit/history and avoids
-- reusing a permission id for a different meaning.
ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS status text;
UPDATE public.permissions
   SET status = 'active'
 WHERE status IS NULL OR lower(btrim(status)) = '';
ALTER TABLE public.permissions
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'permissions_status_check'
       AND conrelid = 'public.permissions'::regclass
  ) THEN
    ALTER TABLE public.permissions
      ADD CONSTRAINT permissions_status_check
      CHECK (status IN ('active', 'disabled', 'retired'));
  END IF;
END;
$$;

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.role_permissions
   SET status = 'active'
 WHERE status IS NULL OR lower(btrim(status)) = '';
UPDATE public.role_permissions
   SET updated_at = created_at
 WHERE updated_at IS NULL;
ALTER TABLE public.role_permissions
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'role_permissions_status_check'
       AND conrelid = 'public.role_permissions'::regclass
  ) THEN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_status_check
      CHECK (status IN ('created', 'active', 'locked', 'disabled'));
  END IF;
END;
$$;

ALTER TABLE public.role_data_scopes
  ADD COLUMN IF NOT EXISTS status text;
UPDATE public.role_data_scopes
   SET status = 'active'
 WHERE status IS NULL OR lower(btrim(status)) = '';
ALTER TABLE public.role_data_scopes
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'role_data_scopes_status_check'
       AND conrelid = 'public.role_data_scopes'::regclass
  ) THEN
    ALTER TABLE public.role_data_scopes
      ADD CONSTRAINT role_data_scopes_status_check
      CHECK (status IN ('created', 'active', 'locked', 'disabled'));
  END IF;
END;
$$;

ALTER TABLE public.sys_field_acl
  ADD COLUMN IF NOT EXISTS status text;
UPDATE public.sys_field_acl
   SET status = 'active'
 WHERE status IS NULL OR lower(btrim(status)) = '';
ALTER TABLE public.sys_field_acl
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sys_field_acl_status_check'
       AND conrelid = 'public.sys_field_acl'::regclass
  ) THEN
    ALTER TABLE public.sys_field_acl
      ADD CONSTRAINT sys_field_acl_status_check
      CHECK (status IN ('created', 'active', 'locked', 'disabled'));
  END IF;
END;
$$;

-- Keep locked roles immutable until they are explicitly returned to active.
-- The trusted migration/database owners can still repair or remove a role.
CREATE OR REPLACE FUNCTION public.enforce_role_acl_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
DECLARE
  prior_status text;
  next_status text;
  trusted_operator boolean := current_user IN ('postgres', 'eiscore_owner', 'eiscore_migrator');
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF lower(btrim(coalesce(OLD.status, 'active'))) = 'locked' AND NOT trusted_operator THEN
      RAISE EXCEPTION '锁定角色不可删除，请先解除锁定' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  next_status := lower(btrim(coalesce(NEW.status, 'active')));
  IF next_status NOT IN ('created', 'active', 'locked', 'disabled') THEN
    RAISE EXCEPTION '角色状态无效' USING ERRCODE = '22023';
  END IF;
  NEW.status := next_status;
  IF TG_OP = 'INSERT' THEN
    IF next_status = 'locked' THEN
      RAISE EXCEPTION '未生效角色不可直接锁定' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  prior_status := CASE WHEN TG_OP = 'UPDATE'
    THEN lower(btrim(coalesce(OLD.status, 'active')))
    ELSE NULL
  END;
  IF prior_status = 'locked' AND NOT trusted_operator THEN
    IF next_status <> 'active'
       OR (to_jsonb(NEW) - 'status' - 'updated_at')
          IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION '锁定角色不可修改，请先解除锁定' USING ERRCODE = '55000';
    END IF;
  ELSIF next_status = 'locked' AND prior_status <> 'active' AND NOT trusted_operator THEN
    RAISE EXCEPTION '未生效角色不可直接锁定' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_role_acl_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.enforce_role_acl_lifecycle() FROM PUBLIC;
DROP TRIGGER IF EXISTS tg_roles_acl_lifecycle ON public.roles;
CREATE TRIGGER tg_roles_acl_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_acl_lifecycle();

-- A locked role must also protect its grants, row scopes and field rules.  A
-- row-level trigger on each child table closes the otherwise easy bypass of
-- locking a role and then editing its ACL through a matrix endpoint.
CREATE OR REPLACE FUNCTION public.enforce_role_acl_child_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
DECLARE
  role_uuid uuid;
  role_status text;
  prior_status text;
  next_status text;
  trusted_operator boolean := current_user IN ('postgres', 'eiscore_owner', 'eiscore_migrator');
BEGIN
  role_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.role_id ELSE NEW.role_id END;
  FOR role_uuid IN
    SELECT ids.role_id
      FROM unnest(
        CASE WHEN TG_OP = 'UPDATE'
          THEN ARRAY[OLD.role_id, NEW.role_id]
          ELSE ARRAY[role_uuid]
        END
      ) AS ids(role_id)
     WHERE ids.role_id IS NOT NULL
     GROUP BY ids.role_id
  LOOP
    SELECT lower(btrim(coalesce(status, 'active')))
      INTO role_status
      FROM public.roles
     WHERE id = role_uuid;
    IF role_status = 'locked' AND NOT trusted_operator THEN
      RAISE EXCEPTION '锁定角色不可变更权限，请先解除锁定' USING ERRCODE = '55000';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  prior_status := CASE WHEN TG_OP = 'UPDATE'
    THEN lower(btrim(coalesce(OLD.status, 'active')))
    ELSE NULL
  END;
  next_status := lower(btrim(coalesce(NEW.status, 'active')));
  IF next_status NOT IN ('created', 'active', 'locked', 'disabled') THEN
    RAISE EXCEPTION '权限状态无效' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' AND next_status = 'locked' AND NOT trusted_operator THEN
    RAISE EXCEPTION '未生效权限不可直接锁定' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND prior_status = 'locked' AND NOT trusted_operator THEN
    IF next_status <> 'active'
       OR (to_jsonb(NEW) - 'status' - 'updated_at')
          IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION '锁定权限不可修改，请先解除锁定' USING ERRCODE = '55000';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND next_status = 'locked' AND NOT trusted_operator THEN
    IF prior_status <> 'active'
       OR (to_jsonb(NEW) - 'status' - 'updated_at')
          IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION '请先生效权限，再单独锁定' USING ERRCODE = '55000';
    END IF;
  END IF;
  NEW.status := next_status;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_role_acl_child_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.enforce_role_acl_child_lifecycle() FROM PUBLIC;
DROP TRIGGER IF EXISTS tg_role_permissions_acl_lifecycle ON public.role_permissions;
CREATE TRIGGER tg_role_permissions_acl_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_acl_child_lifecycle();
DROP TRIGGER IF EXISTS tg_role_data_scopes_acl_lifecycle ON public.role_data_scopes;
CREATE TRIGGER tg_role_data_scopes_acl_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON public.role_data_scopes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_acl_child_lifecycle();
DROP TRIGGER IF EXISTS tg_sys_field_acl_lifecycle ON public.sys_field_acl;
CREATE TRIGGER tg_sys_field_acl_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON public.sys_field_acl
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_acl_child_lifecycle();

-- A locked role cannot be attached to or detached from users through the
-- user-role bridge.  This closes the remaining ACL bypass outside the matrix
-- endpoints.
CREATE OR REPLACE FUNCTION public.enforce_role_user_assignment_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
DECLARE
  candidate_role uuid;
  role_status text;
  trusted_operator boolean := current_user IN ('postgres', 'eiscore_owner', 'eiscore_migrator');
BEGIN
  FOR candidate_role IN
    SELECT ids.role_id
      FROM unnest(
        CASE WHEN TG_OP = 'UPDATE'
          THEN ARRAY[OLD.role_id, NEW.role_id]
          ELSE ARRAY[CASE WHEN TG_OP = 'DELETE' THEN OLD.role_id ELSE NEW.role_id END]
        END
      ) AS ids(role_id)
     WHERE ids.role_id IS NOT NULL
     GROUP BY ids.role_id
  LOOP
    SELECT lower(btrim(coalesce(status, 'active')))
      INTO role_status
      FROM public.roles
     WHERE id = candidate_role;
    IF role_status = 'locked' AND NOT trusted_operator THEN
      RAISE EXCEPTION '锁定角色不可变更用户绑定，请先解除锁定' USING ERRCODE = '55000';
    END IF;
  END LOOP;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

ALTER FUNCTION public.enforce_role_user_assignment_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.enforce_role_user_assignment_lifecycle() FROM PUBLIC;
DROP TRIGGER IF EXISTS tg_user_roles_acl_lifecycle ON public.user_roles;
CREATE TRIGGER tg_user_roles_acl_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_user_assignment_lifecycle();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_role_permissions_updated_at') THEN
    CREATE TRIGGER tg_role_permissions_updated_at
      BEFORE UPDATE ON public.role_permissions
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$$;

-- Effective permissions exclude created/disabled roles, retired/disabled
-- definitions and disabled assignments. Locked roles keep their effective
-- permissions but remain immutable through the lifecycle triggers above.
CREATE OR REPLACE VIEW public.v_role_permissions AS
SELECT r.id AS role_id,
       r.code AS role_code,
       COALESCE(array_agg(p.code ORDER BY p.code)
         FILTER (WHERE r.status IN ('active', 'locked')
           AND p.status = 'active'
           AND rp.status IN ('active', 'locked')), ARRAY[]::text[]) AS permissions
  FROM public.roles r
  LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
  LEFT JOIN public.permissions p ON p.id = rp.permission_id
 GROUP BY r.id, r.code, r.status;

-- The role-management view keeps its original column order and appends status
-- so existing clients remain compatible while new clients can display it.
CREATE OR REPLACE VIEW public.v_roles_manage AS
SELECT id, code, name, description, sort, created_at, updated_at, status
  FROM public.roles;

CREATE OR REPLACE FUNCTION public.tg_v_roles_manage_insert()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
DECLARE
  inserted_role public.roles%ROWTYPE;
BEGIN
  INSERT INTO public.roles (code, name, description, sort, status)
  VALUES (NEW.code, NEW.name, NEW.description, NEW.sort, COALESCE(NEW.status, 'created'))
  RETURNING * INTO inserted_role;
  NEW.id := inserted_role.id;
  NEW.created_at := inserted_role.created_at;
  NEW.updated_at := inserted_role.updated_at;
  NEW.status := inserted_role.status;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_v_roles_manage_update()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
DECLARE
  updated_role public.roles%ROWTYPE;
BEGIN
  UPDATE public.roles
     SET code = NEW.code,
         name = NEW.name,
         description = NEW.description,
         sort = NEW.sort,
         status = COALESCE(NEW.status, OLD.status)
   WHERE id = OLD.id
  RETURNING * INTO updated_role;
  NEW.id := updated_role.id;
  NEW.created_at := updated_role.created_at;
  NEW.updated_at := updated_role.updated_at;
  NEW.status := updated_role.status;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_v_role_permissions_matrix_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
BEGIN
  IF NEW.granted IS DISTINCT FROM OLD.granted THEN
    IF NEW.granted THEN
      INSERT INTO public.role_permissions (role_id, permission_id, status)
      VALUES (OLD.role_id, OLD.permission_id, 'active')
      ON CONFLICT (role_id, permission_id) DO UPDATE SET status = 'active';
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
      coalesce(nullif(lower(btrim(NEW.assignment_status)), ''), 'active')
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
    coalesce(nullif(lower(btrim(NEW.scope_status)), ''), 'active')
  )
  ON CONFLICT (role_id, module) DO UPDATE
    SET scope_type = excluded.scope_type,
        dept_id = excluded.dept_id,
        status = excluded.status,
        updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER imports are web-callable and therefore cannot rely on the
-- trigger's current_user.  Reject locked roles before any ACL write.
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
    INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
    SELECT r.id, i.module, i.field_code, i.can_view, i.can_edit
      FROM items i JOIN public.roles r ON r.code = i.role_code
    ON CONFLICT (role_id, module, field_code) DO UPDATE
      SET can_view = excluded.can_view,
          can_edit = excluded.can_edit,
          status = 'active',
          updated_at = clock_timestamp()
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

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
      status = 'active', updated_at = clock_timestamp()
    RETURNING id, code
  ), role_bind AS (
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM items i JOIN public.permissions p ON p.code = i.code
      JOIN public.roles r ON i.roles IS NOT NULL
        AND r.code = ANY (SELECT jsonb_array_elements_text(i.roles))
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

ALTER FUNCTION public.tg_v_roles_manage_insert() OWNER TO eiscore_owner;
ALTER FUNCTION public.tg_v_roles_manage_update() OWNER TO eiscore_owner;
ALTER FUNCTION public.tg_v_role_permissions_matrix_update() OWNER TO eiscore_owner;
ALTER FUNCTION public.tg_v_role_data_scopes_matrix_update() OWNER TO eiscore_owner;
ALTER FUNCTION public.upsert_field_acl(jsonb) OWNER TO eiscore_owner;
ALTER FUNCTION public.upsert_permissions(jsonb) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.tg_v_roles_manage_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_v_roles_manage_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_v_role_permissions_matrix_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_v_role_data_scopes_matrix_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_field_acl(jsonb) TO web_user;
GRANT EXECUTE ON FUNCTION public.upsert_permissions(jsonb) TO web_user;

-- The built-in template RPC is SECURITY DEFINER too.  Guard it explicitly so
-- its owner identity cannot mutate any locked built-in role.
CREATE OR REPLACE FUNCTION public.apply_role_permission_templates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.roles
     WHERE code IN ('super_admin', 'hr_admin', 'hr_clerk', 'dept_manager', 'employee', 'hr_viewer')
       AND lower(btrim(coalesce(status, 'active'))) = 'locked'
  ) THEN
    RAISE EXCEPTION '锁定角色不可应用权限模板，请先解除锁定' USING ERRCODE = '55000';
  END IF;

  WITH
  s1 AS (
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON true
     WHERE r.code = 'super_admin'
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  ), s2 AS (
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
      ON p.code = 'module:hr' OR p.code LIKE 'app:hr_%' OR p.code LIKE 'op:hr_%'
     WHERE r.code = 'hr_admin'
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  ), s3 AS (
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
      ON p.code = 'module:hr' OR p.code LIKE 'app:hr_%' OR p.code ~ '^op:hr_.*\\.(create|edit)$'
     WHERE r.code = 'hr_clerk'
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  ), s4 AS (
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
      ON p.code = 'module:hr' OR p.code IN ('app:hr_employee', 'app:hr_org', 'app:hr_attendance', 'app:hr_change')
      OR p.code ~ '^op:hr_.*\\.(view|create|edit)$'
     WHERE r.code = 'dept_manager'
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  ), s5 AS (
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
      ON p.code = 'module:hr' OR p.code IN ('app:hr_employee', 'app:hr_attendance')
      OR p.code ~ '^op:hr_.*\\.view$'
     WHERE r.code = 'employee'
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  ), s6 AS (
    INSERT INTO public.role_permissions (role_id, permission_id, status)
    SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
      ON p.code IN ('module:home', 'module:hr') OR p.code IN ('app:hr_employee', 'app:hr_attendance')
      OR p.code ~ '^op:hr_.*\\.view$'
     WHERE r.code = 'hr_viewer'
    ON CONFLICT (role_id, permission_id) DO UPDATE
      SET status = 'active', updated_at = clock_timestamp()
    RETURNING 1
  )
  SELECT coalesce((SELECT count(*) FROM s1), 0) + coalesce((SELECT count(*) FROM s2), 0)
       + coalesce((SELECT count(*) FROM s3), 0) + coalesce((SELECT count(*) FROM s4), 0)
       + coalesce((SELECT count(*) FROM s5), 0) + coalesce((SELECT count(*) FROM s6), 0)
    INTO _count;
  RETURN _count;
END;
$$;

ALTER FUNCTION public.apply_role_permission_templates() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.apply_role_permission_templates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_role_permission_templates() TO web_user;

-- Matrix views append metadata only; this avoids changing the established
-- primary columns consumed by existing grid clients.
CREATE OR REPLACE VIEW public.v_role_permissions_matrix AS
SELECT (r.id::text || ':' || p.id::text) AS id,
       r.id AS role_id,
       p.id AS permission_id,
       p.code,
       p.name,
       p.module,
       p.action,
       (rp.permission_id IS NOT NULL
         AND coalesce(rp.status, 'active') IN ('active', 'locked')
         AND r.status IN ('active', 'locked')
         AND p.status = 'active') AS granted,
       r.status AS role_status,
       p.status AS permission_status,
       coalesce(rp.status, 'created') AS assignment_status,
       rp.created_at AS assignment_created_at,
       rp.updated_at AS assignment_updated_at
  FROM public.roles r
 CROSS JOIN public.permissions p
  LEFT JOIN public.role_permissions rp
    ON rp.role_id = r.id AND rp.permission_id = p.id;

-- Dynamic app modules are discovered from the canonical app ontology view.
-- Static HR/MMS modules remain for backward compatibility with pre-App Center
-- installations. Draft apps remain configurable; only archived apps are
-- excluded from the ACL matrix.
CREATE OR REPLACE VIEW public.v_role_data_scopes_matrix AS
WITH modules AS (
  SELECT static.module, static.module AS module_label
    FROM unnest(ARRAY[
      'hr_employee', 'hr_org', 'hr_attendance', 'hr_change',
      'hr_acl', 'hr_user', 'mms_ledger'
    ]::text[]) AS static(module)
  UNION
  SELECT acl_module, app_name
    FROM public.v_app_form_ontology
   WHERE nullif(btrim(acl_module), '') IS NOT NULL
     AND coalesce(status, '') <> 'archived'
), matrix AS (
  SELECT r.id AS role_id, m.module, max(m.module_label) AS module_label
    FROM public.roles r CROSS JOIN modules m
   GROUP BY r.id, m.module
)
SELECT (matrix.role_id::text || ':' || matrix.module) AS id,
       matrix.role_id,
       matrix.module,
       coalesce(rds.scope_type, 'self') AS scope_type,
       rds.dept_id,
       matrix.module_label,
       r.status AS role_status,
       coalesce(rds.status, 'created') AS scope_status,
       rds.created_at AS scope_created_at,
       rds.updated_at AS scope_updated_at
  FROM matrix
  JOIN public.roles r ON r.id = matrix.role_id
  LEFT JOIN public.role_data_scopes rds
    ON rds.role_id = matrix.role_id AND rds.module = matrix.module;

GRANT SELECT, UPDATE ON public.v_roles_manage TO web_user;
GRANT SELECT, UPDATE ON public.v_role_permissions_matrix TO web_user;
GRANT SELECT, UPDATE ON public.v_role_data_scopes_matrix TO web_user;

DROP TRIGGER IF EXISTS tg_v_role_permissions_matrix_update ON public.v_role_permissions_matrix;
CREATE TRIGGER tg_v_role_permissions_matrix_update
  INSTEAD OF UPDATE ON public.v_role_permissions_matrix
  FOR EACH ROW EXECUTE FUNCTION public.tg_v_role_permissions_matrix_update();
DROP TRIGGER IF EXISTS tg_v_role_data_scopes_matrix_update ON public.v_role_data_scopes_matrix;
CREATE TRIGGER tg_v_role_data_scopes_matrix_update
  INSTEAD OF UPDATE ON public.v_role_data_scopes_matrix
  FOR EACH ROW EXECUTE FUNCTION public.tg_v_role_data_scopes_matrix_update();

-- Keep server-side permission consumers aligned with the matrix lifecycle.
-- Claims are still accepted for compatibility, but persisted role grants and
-- row scopes only become effective for active or locked roles and active rows.
CREATE OR REPLACE FUNCTION public.document_current_role_codes()
RETURNS TABLE(role_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $$
  WITH claims AS (
    SELECT public.document_current_claims() AS value
  ), claim_roles AS (
    SELECT NULLIF(value ->> 'app_role', '') AS role_code FROM claims
    UNION
    SELECT NULLIF(value ->> 'role_code', '') AS role_code FROM claims
  ), persisted AS (
    SELECT r.code AS role_code
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id
     WHERE u.username = public.document_current_username()
       AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
       AND r.status IN ('active', 'locked')
    UNION
    SELECT u.role
      FROM public.users u
      JOIN public.roles r ON r.code = u.role
     WHERE u.username = public.document_current_username()
       AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
       AND r.status IN ('active', 'locked')
  )
  SELECT DISTINCT x.role_code
    FROM (
      SELECT c.role_code
        FROM claim_roles c
        JOIN public.roles r ON r.code = c.role_code
       WHERE r.status IN ('active', 'locked')
         AND EXISTS (
           SELECT 1 FROM public.users u
            WHERE u.username = public.document_current_username()
              AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
         )
      UNION ALL
      SELECT role_code FROM persisted
    ) x
   WHERE COALESCE(x.role_code, '') <> '';
$$;

CREATE OR REPLACE FUNCTION public.document_current_permissions()
RETURNS TABLE(permission_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claims AS (
    SELECT public.document_current_claims() AS value
  ), claim_permissions AS (
    SELECT item.permission_code AS permission_code
      FROM claims c
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(c.value -> 'permissions') = 'array'
             THEN c.value -> 'permissions' ELSE '[]'::jsonb END
       ) AS item(permission_code)
      JOIN public.permissions p ON p.code = item.permission_code
     WHERE EXISTS (
       SELECT 1
         FROM public.users u
        WHERE u.username = public.document_current_username()
          AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
     )
       AND EXISTS (
         SELECT 1 FROM public.roles r
          WHERE r.code IN (c.value ->> 'app_role', c.value ->> 'role_code')
            AND r.status IN ('active', 'locked')
        )
        AND p.status = 'active'
  ), role_permissions AS (
    SELECT p.code AS permission_code
      FROM public.document_current_role_codes() rc
      JOIN public.roles r ON r.code = rc.role_code
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
     WHERE r.status IN ('active', 'locked')
       AND rp.status IN ('active', 'locked')
       AND p.status = 'active'
  )
  SELECT DISTINCT source.permission_code
    FROM (
      SELECT cp.permission_code FROM claim_permissions cp
      UNION ALL
      SELECT rp.permission_code FROM role_permissions rp
    ) source
   WHERE COALESCE(source.permission_code, '') <> '';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
       AND column_name = 'permissions' AND udt_name = '_text'
  ) THEN
    RETURN QUERY EXECUTE
      'select distinct permission_values.permission_code
         from public.users u
         join lateral unnest(coalesce(u.permissions, array[]::text[])) AS permission_values(permission_code) on true
         join public.permissions p on p.code = permission_values.permission_code
         where u.username = public.document_current_username()
           and lower(btrim(coalesce(u.status, ''''))) in (''active'', ''locked'')
           and coalesce(array_length(u.permissions, 1), 0) > 0
           and not exists (select 1 from public.user_roles ur where ur.user_id = u.id)
          and exists (select 1 from public.roles r
                       where r.code = u.role and r.status in (''active'', ''locked''))
          and p.status = ''active''';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ontology_current_role_codes()
RETURNS TABLE(role_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, app_data, app_center, workflow, pg_temp
AS $$
  WITH claims AS (
    SELECT public.ontology_current_claims() AS value
  ), claim_roles AS (
    SELECT NULLIF(value ->> 'app_role', '') AS role_code FROM claims
    UNION
    SELECT NULLIF(value ->> 'role_code', '') AS role_code FROM claims
  ), persisted AS (
    SELECT r.code AS role_code
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id
     WHERE u.username = public.ontology_current_username()
       AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
       AND r.status IN ('active', 'locked')
    UNION
    SELECT u.role
      FROM public.users u
      JOIN public.roles r ON r.code = u.role
     WHERE u.username = public.ontology_current_username()
       AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
       AND r.status IN ('active', 'locked')
  )
  SELECT DISTINCT x.role_code
    FROM (
      SELECT c.role_code
        FROM claim_roles c
        JOIN public.roles r ON r.code = c.role_code
           WHERE r.status IN ('active', 'locked')
         AND EXISTS (
           SELECT 1 FROM public.users u
            WHERE u.username = public.ontology_current_username()
              AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
         )
      UNION ALL
      SELECT role_code FROM persisted
    ) x
   WHERE COALESCE(x.role_code, '') <> '';
$$;

CREATE OR REPLACE FUNCTION public.ontology_current_permissions()
RETURNS TABLE(permission_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, app_data, app_center, workflow, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claims AS (
    SELECT public.ontology_current_claims() AS value
  ), claim_permissions AS (
    SELECT item.permission_code AS permission_code
      FROM claims c
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(c.value -> 'permissions') = 'array'
             THEN c.value -> 'permissions' ELSE '[]'::jsonb END
       ) AS item(permission_code)
      JOIN public.permissions p ON p.code = item.permission_code
     WHERE EXISTS (
       SELECT 1 FROM public.users u
        WHERE u.username = public.ontology_current_username()
          AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked')
     )
       AND EXISTS (
         SELECT 1 FROM public.roles r
          WHERE r.code IN (c.value ->> 'app_role', c.value ->> 'role_code')
            AND r.status IN ('active', 'locked')
        )
        AND p.status = 'active'
  ), role_permissions AS (
    SELECT p.code AS permission_code
      FROM public.ontology_current_role_codes() rc
      JOIN public.roles r ON r.code = rc.role_code
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
     WHERE r.status IN ('active', 'locked')
       AND rp.status IN ('active', 'locked')
       AND p.status = 'active'
  )
  SELECT DISTINCT source.permission_code
    FROM (
      SELECT cp.permission_code FROM claim_permissions cp
      UNION ALL
      SELECT rp.permission_code FROM role_permissions rp
    ) source
   WHERE COALESCE(source.permission_code, '') <> '';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
       AND column_name = 'permissions' AND udt_name = '_text'
  ) THEN
    RETURN QUERY EXECUTE
      'select distinct permission_values.permission_code
         from public.users u
         join lateral unnest(coalesce(u.permissions, array[]::text[])) AS permission_values(permission_code) on true
         join public.permissions p on p.code = permission_values.permission_code
         where u.username = public.ontology_current_username()
           and lower(btrim(coalesce(u.status, ''''))) in (''active'', ''locked'')
           and coalesce(array_length(u.permissions, 1), 0) > 0
           and not exists (select 1 from public.user_roles ur where ur.user_id = u.id)
          and exists (select 1 from public.roles r
                       where r.code = u.role and r.status in (''active'', ''locked''))
          and p.status = ''active''';
  END IF;
END;
$$;

-- Row-level data scope checks must ignore disabled/created roles and scopes.
CREATE OR REPLACE FUNCTION hr.can_access_employee(
  p_archive_id bigint,
  p_module text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, hr, pg_temp
AS $$
DECLARE
  actor_id integer;
  actor_dept_id uuid;
  actor_archive_id integer;
BEGIN
  IF public.document_current_is_admin() THEN RETURN true; END IF;
  IF EXISTS (
    SELECT 1
      FROM public.document_current_role_codes() role_code
      JOIN public.roles role_row ON lower(role_row.code) = lower(role_code.role_code)
      JOIN public.role_data_scopes scope_row ON scope_row.role_id = role_row.id
     WHERE role_row.status IN ('active', 'locked')
       AND scope_row.status IN ('active', 'locked')
       AND scope_row.module = p_module
       AND scope_row.scope_type = 'all'
  ) THEN RETURN true; END IF;
  IF p_archive_id IS NULL OR COALESCE(btrim(p_module), '') = '' THEN RETURN false; END IF;
  actor_id := hr.current_user_id();
  IF actor_id IS NULL THEN RETURN false; END IF;
  SELECT u.dept_id, link.archive_id INTO actor_dept_id, actor_archive_id
    FROM public.users u LEFT JOIN hr.user_employee_links link ON link.user_id = u.id
   WHERE u.id = actor_id;
  IF actor_archive_id IS NOT NULL AND actor_archive_id::bigint = p_archive_id THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1
      FROM public.document_current_role_codes() role_code
      JOIN public.roles role_row ON lower(role_row.code) = lower(role_code.role_code)
      JOIN public.role_data_scopes scope_row ON scope_row.role_id = role_row.id
      JOIN hr.user_employee_links target_link ON target_link.archive_id::bigint = p_archive_id
      JOIN public.users target_user ON target_user.id = target_link.user_id
     WHERE role_row.status IN ('active', 'locked')
       AND scope_row.status IN ('active', 'locked')
       AND scope_row.module = p_module
       AND ((scope_row.scope_type = 'dept' AND target_user.dept_id = COALESCE(scope_row.dept_id, actor_dept_id))
         OR (scope_row.scope_type = 'dept_tree'
             AND COALESCE(scope_row.dept_id, actor_dept_id) IS NOT NULL
             AND target_user.dept_id IN (SELECT public.dept_tree_ids(COALESCE(scope_row.dept_id, actor_dept_id))))));
END;
$$;

-- This SECURITY DEFINER sync is called from the browser when a module is
-- opened. It must never create rows for frozen or disabled roles.
CREATE OR REPLACE FUNCTION public.ensure_field_acl(module_name text, field_codes text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $$
DECLARE _count integer := 0;
BEGIN
  IF module_name IS NULL OR module_name = '' OR field_codes IS NULL OR array_length(field_codes, 1) IS NULL THEN RETURN 0; END IF;
  WITH targets AS (
    SELECT r.id AS role_id, module_name AS module, fc AS field_code
      FROM public.roles r CROSS JOIN unnest(field_codes) AS fc
     WHERE fc IS NOT NULL AND fc <> '' AND r.status IN ('created', 'active')
  ), upserted AS (
    INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, status)
    SELECT role_id, module, field_code, true, true, 'created' FROM targets
    ON CONFLICT (role_id, module, field_code) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO _count FROM upserted;
  RETURN _count;
END;
$$;

ALTER FUNCTION public.document_current_role_codes() OWNER TO eiscore_owner;
ALTER FUNCTION public.document_current_permissions() OWNER TO eiscore_owner;
ALTER FUNCTION public.ontology_current_role_codes() OWNER TO eiscore_owner;
ALTER FUNCTION public.ontology_current_permissions() OWNER TO eiscore_owner;
ALTER FUNCTION hr.can_access_employee(bigint, text) OWNER TO eiscore_owner;
ALTER FUNCTION public.ensure_field_acl(text, text[]) OWNER TO eiscore_owner;
