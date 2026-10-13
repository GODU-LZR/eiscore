-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- ACL lifecycle correction: once an ACL role or child ACL record is locked it
-- is immutable for web operators. Database owners may still repair a record.

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

  prior_status := lower(btrim(coalesce(OLD.status, 'active')));
  IF prior_status = 'locked' AND NOT trusted_operator
     AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION '锁定角色不可修改' USING ERRCODE = '55000';
  END IF;
  IF next_status = 'locked' AND prior_status <> 'active' AND NOT trusted_operator THEN
    RAISE EXCEPTION '未生效角色不可直接锁定' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

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
  next_status := lower(btrim(coalesce(NEW.status, 'created')));
  IF next_status NOT IN ('created', 'active', 'locked', 'disabled') THEN
    RAISE EXCEPTION '权限状态无效' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' AND next_status = 'locked' AND NOT trusted_operator THEN
    RAISE EXCEPTION '未生效权限不可直接锁定' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND prior_status = 'locked' AND NOT trusted_operator
     AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION '锁定权限不可修改' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND next_status = 'locked' AND prior_status <> 'active' AND NOT trusted_operator THEN
    RAISE EXCEPTION '请先生效权限，再单独锁定' USING ERRCODE = '55000';
  END IF;
  NEW.status := next_status;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_role_acl_lifecycle() OWNER TO eiscore_owner;
ALTER FUNCTION public.enforce_role_acl_child_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.enforce_role_acl_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_role_acl_child_lifecycle() FROM PUBLIC;
