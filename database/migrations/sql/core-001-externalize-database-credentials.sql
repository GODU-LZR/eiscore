-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Remove credentials inherited from historical schema snapshots. The JWT
-- signing value is deployment input and must be supplied as app.jwt_secret.

CREATE OR REPLACE FUNCTION public.login(username text, password text) RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO pg_catalog, public
AS $$
DECLARE
  _app_role text;
  _permissions text[];
  _user_id integer;
  token_claims json;
  _secret text := nullif(current_setting('app.jwt_secret', true), '');
BEGIN
  IF _secret IS NULL OR octet_length(_secret) < 32 THEN
    RAISE EXCEPTION 'JWT signing secret is not configured'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT u.id
    INTO _user_id
  FROM public.users u
  WHERE lower(trim(u.username)) = lower(trim(login.username))
    AND u.password = trim(login.password);

  IF _user_id IS NULL THEN
    RAISE invalid_password USING message = '账号或密码错误';
  END IF;

  SELECT array_agg(distinct pcode order by pcode)
    INTO _permissions
  FROM (
    SELECT unnest(v.permissions) AS pcode
    FROM public.user_roles ur
    JOIN public.v_role_permissions v ON v.role_id = ur.role_id
    WHERE ur.user_id = _user_id
  ) perms;

  IF _permissions IS NULL THEN
    SELECT u.permissions
      INTO _permissions
    FROM public.users u
    WHERE u.id = _user_id;
  END IF;

  SELECT v.role_code
    INTO _app_role
  FROM public.user_roles ur
  JOIN public.v_role_permissions v ON v.role_id = ur.role_id
  WHERE ur.user_id = _user_id
  ORDER BY v.role_code ASC
  LIMIT 1;

  IF _app_role IS NULL OR _app_role = '' THEN
    SELECT u.role
      INTO _app_role
    FROM public.users u
    WHERE u.id = _user_id;
  END IF;

  token_claims := json_build_object(
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'exp', extract(epoch from now() + interval '2 hours')::integer
  );

  RETURN json_build_object(
    'token', public.sign(token_claims, _secret),
    'role', 'web_user',
    'app_role', _app_role,
    'username', username,
    'permissions', coalesce(_permissions, ARRAY[]::text[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_v_users_manage_insert() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO pg_catalog, public
AS $$
DECLARE
  _user_id integer;
BEGIN
  INSERT INTO public.users (username, password, full_name, phone, email, status, sop_role)
  VALUES (
    coalesce(new.username, 'user_' || to_char(now(), 'HH24MISS')),
    coalesce(nullif(new.password, ''), encode(gen_random_bytes(32), 'hex')),
    new.full_name,
    new.phone,
    new.email,
    coalesce(new.status, 'active'),
    nullif(new.sop_role, '')
  )
  RETURNING id INTO _user_id;

  IF new.avatar IS NOT NULL THEN
    UPDATE public.users SET avatar = new.avatar WHERE id = _user_id;
  END IF;

  IF new.role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (_user_id, new.role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  new.id := _user_id;
  RETURN new;
END;
$$;
