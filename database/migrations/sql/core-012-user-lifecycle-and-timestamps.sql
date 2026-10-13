-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- Existing data and published migrations remain unchanged. Only future users
-- default to created; legacy disabled is not reinterpreted as an active lock.

ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'created';

CREATE OR REPLACE FUNCTION hr.enforce_user_lifecycle() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO pg_catalog, public, hr
AS $$
DECLARE
  prior_status text;
  next_status text;
  trusted_operator boolean := current_user IN ('postgres', 'eiscore_owner', 'eiscore_migrator');
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF lower(btrim(coalesce(OLD.status, ''))) = 'locked' THEN
      RAISE EXCEPTION '锁定用户不可删除，请先单独解除锁定' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  next_status := lower(btrim(coalesce(NEW.status, 'created')));
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF next_status NOT IN ('created', 'draft', 'active', 'locked', 'disabled') THEN
      RAISE EXCEPTION '用户状态无效' USING ERRCODE = '22023';
    END IF;
    NEW.status := next_status;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF next_status = 'locked' THEN
      RAISE EXCEPTION '未生效用户不可直接锁定' USING ERRCODE = '55000';
    END IF;
    IF next_status = 'active'
       AND NOT trusted_operator
       AND NOT public.document_current_is_admin()
       AND NOT public.document_current_has_permission('op:hr_user.edit') THEN
      RAISE EXCEPTION '无权限直接生效用户，请先创建' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;

  prior_status := lower(btrim(coalesce(OLD.status, '')));
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT trusted_operator
     AND NOT public.document_current_is_admin()
     AND NOT public.document_current_has_permission('op:hr_user.edit') THEN
    RAISE EXCEPTION '无权限变更用户状态' USING ERRCODE = '42501';
  END IF;

  IF prior_status = 'locked' THEN
    IF next_status = 'locked' AND to_jsonb(NEW) = to_jsonb(OLD) THEN
      RETURN OLD;
    END IF;
    IF next_status <> 'active'
       OR (to_jsonb(NEW) - 'status' - 'updated_at')
          IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION '锁定用户不可修改，请先单独解除锁定' USING ERRCODE = '55000';
    END IF;
  ELSIF next_status = 'locked' THEN
    IF prior_status <> 'active' THEN
      RAISE EXCEPTION '未生效用户不可直接锁定' USING ERRCODE = '55000';
    END IF;
    IF (to_jsonb(NEW) - 'status' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION '请单独锁定用户，再次编辑需先解除锁定' USING ERRCODE = '55000';
    END IF;
  END IF;

  -- Client timestamps are never authoritative, including direct /users writes.
  NEW.created_at := OLD.created_at;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
ALTER FUNCTION hr.enforce_user_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION hr.enforce_user_lifecycle() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_users_lifecycle ON public.users;
CREATE TRIGGER tg_users_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION hr.enforce_user_lifecycle();

CREATE OR REPLACE FUNCTION hr.enforce_user_role_lifecycle() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO pg_catalog, public, hr
AS $$
DECLARE
  affected_ids integer[];
  target_user record;
  trusted_operator boolean := current_user IN ('postgres', 'eiscore_owner', 'eiscore_migrator');
BEGIN
  affected_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.user_id]
    WHEN 'DELETE' THEN ARRAY[OLD.user_id]
    ELSE ARRAY[OLD.user_id, NEW.user_id]
  END;
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  IF TG_WHEN = 'BEFORE' THEN
    -- Serialize role edits with locking/unlocking the parent user. Ordered
    -- locks also cover moving a binding from one user to another.
    FOR target_user IN
      SELECT id, status FROM public.users
      WHERE id = ANY(affected_ids) ORDER BY id FOR UPDATE
    LOOP
      IF lower(btrim(coalesce(target_user.status, ''))) = 'locked' THEN
        RAISE EXCEPTION '锁定用户不可变更角色，请先单独解除锁定' USING ERRCODE = '55000';
      END IF;
      IF NOT trusted_operator
         AND NOT public.document_current_is_admin()
         AND NOT public.document_current_has_permission('op:hr_user.edit')
         AND NOT (lower(btrim(coalesce(target_user.status, ''))) IN ('created', 'draft')
                  AND public.document_current_has_permission('op:hr_user.create')) THEN
        RAISE EXCEPTION '无权限变更用户角色' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  ELSE
    -- AFTER excludes ON CONFLICT DO NOTHING, so duplicate bindings do not
    -- manufacture an update date. Cascaded deletes find no parent row.
    UPDATE public.users SET updated_at = clock_timestamp()
    WHERE id = ANY(affected_ids);
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
ALTER FUNCTION hr.enforce_user_role_lifecycle() OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION hr.enforce_user_role_lifecycle() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_user_roles_lifecycle ON public.user_roles;
CREATE TRIGGER tg_user_roles_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION hr.enforce_user_role_lifecycle();
DROP TRIGGER IF EXISTS tg_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER tg_user_roles_updated_at AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION hr.enforce_user_role_lifecycle();

CREATE OR REPLACE VIEW public.v_users_manage AS
SELECT u.id, u.username, u.full_name, u.phone, u.email, u.dept_id, u.status,
       ur.role_id, r.code AS role_code, r.name AS role_name,
       u.password, u.avatar, u.sop_role, u.created_at, u.updated_at
FROM public.users u
LEFT JOIN LATERAL (
  SELECT role_id FROM public.user_roles WHERE user_id = u.id
  ORDER BY created_at DESC LIMIT 1
) ur ON true
LEFT JOIN public.roles r ON r.id = ur.role_id;

CREATE OR REPLACE FUNCTION public.tg_v_users_manage_insert() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO pg_catalog, public
AS $$
DECLARE
  inserted_user public.users%ROWTYPE;
BEGIN
  INSERT INTO public.users (username, password, full_name, phone, email, dept_id, status, sop_role, avatar)
  VALUES (
    coalesce(NEW.username, 'user_' || to_char(now(), 'HH24MISS')),
    coalesce(nullif(NEW.password, ''), encode(gen_random_bytes(32), 'hex')),
    NEW.full_name, NEW.phone, NEW.email, NEW.dept_id, coalesce(NEW.status, 'created'),
    nullif(NEW.sop_role, ''), NEW.avatar
  ) RETURNING * INTO inserted_user;
  IF NEW.role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (inserted_user.id, NEW.role_id) ON CONFLICT DO NOTHING;
  END IF;
  SELECT updated_at INTO inserted_user.updated_at FROM public.users WHERE id = inserted_user.id;
  NEW.id := inserted_user.id;
  NEW.status := inserted_user.status;
  NEW.created_at := inserted_user.created_at;
  NEW.updated_at := inserted_user.updated_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_v_users_manage_update() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO pg_catalog, public
AS $$
DECLARE
  updated_user public.users%ROWTYPE;
BEGIN
  -- Check view-only fields before the users update: unlocking must not permit
  -- a simultaneous role change after the table trigger sees an active user.
  IF lower(btrim(coalesce(OLD.status, ''))) = 'locked'
     AND (NEW.role_id IS DISTINCT FROM OLD.role_id
          OR NEW.dept_id IS DISTINCT FROM OLD.dept_id
          OR NEW.role_code IS DISTINCT FROM OLD.role_code
          OR NEW.role_name IS DISTINCT FROM OLD.role_name) THEN
    RAISE EXCEPTION '锁定用户不可修改，请先单独解除锁定' USING ERRCODE = '55000';
  END IF;
  UPDATE public.users
  SET username = coalesce(NEW.username, OLD.username), full_name = NEW.full_name,
      phone = NEW.phone, email = NEW.email, dept_id = NEW.dept_id,
      status = coalesce(NEW.status, OLD.status),
      sop_role = nullif(NEW.sop_role, ''), avatar = NEW.avatar,
      password = coalesce(nullif(NEW.password, ''), OLD.password)
  WHERE id = OLD.id RETURNING * INTO updated_user;

  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.id;
    IF NEW.role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (OLD.id, NEW.role_id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  SELECT updated_at INTO updated_user.updated_at FROM public.users WHERE id = OLD.id;
  NEW.created_at := updated_user.created_at;
  NEW.updated_at := updated_user.updated_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.login(username text, password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  _app_role text;
  _permissions text[];
  _user_id integer;
  _tenant_id text;
  token_claims json;
  _secret text := nullif(current_setting('app.jwt_secret', true), '');
BEGIN
  IF _secret IS NULL OR octet_length(_secret) < 32 THEN
    RAISE EXCEPTION 'JWT signing secret is not configured'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT u.id, u.tenant_id INTO _user_id, _tenant_id
  FROM public.users u
  WHERE lower(trim(u.username)) = lower(trim(login.username))
    AND u.password = trim(login.password)
    AND lower(btrim(coalesce(u.status, ''))) IN ('active', 'locked');
  IF _user_id IS NULL THEN
    RAISE invalid_password USING message = '账号或密码错误，或用户尚未生效/已停用';
  END IF;

  SELECT array_agg(distinct pcode order by pcode) INTO _permissions
  FROM (
    SELECT unnest(v.permissions) AS pcode
    FROM public.user_roles ur
    JOIN public.v_role_permissions v ON v.role_id = ur.role_id
    WHERE ur.user_id = _user_id
  ) perms;
  IF _permissions IS NULL THEN
    SELECT u.permissions INTO _permissions FROM public.users u WHERE u.id = _user_id;
  END IF;
  SELECT v.role_code INTO _app_role
  FROM public.user_roles ur JOIN public.v_role_permissions v ON v.role_id = ur.role_id
  WHERE ur.user_id = _user_id ORDER BY v.role_code ASC LIMIT 1;
  IF _app_role IS NULL OR _app_role = '' THEN
    SELECT u.role INTO _app_role FROM public.users u WHERE u.id = _user_id;
  END IF;
  token_claims := json_build_object(
    'role', 'web_user', 'app_role', _app_role, 'username', username,
    'tenant_id', _tenant_id, 'permissions', coalesce(_permissions, ARRAY[]::text[]),
    'exp', extract(epoch from now() + interval '2 hours')::integer
  );
  RETURN json_build_object(
    'token', public.sign(token_claims, _secret), 'role', 'web_user',
    'app_role', _app_role, 'username', username, 'tenant_id', _tenant_id,
    'permissions', coalesce(_permissions, ARRAY[]::text[])
  );
END;
$$;
