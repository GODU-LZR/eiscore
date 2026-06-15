-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Keep login JWT signing secret aligned with PostgREST PGRST_JWT_SECRET.
-- Execute with:
--   psql -v jwt_secret="<PGRST_JWT_SECRET>" -U postgres -d eiscore < sql/patch_login_jwt_secret_setting.sql

\if :{?jwt_secret}
\else
  \echo 'jwt_secret psql variable is required'
  \quit 1
\endif

ALTER DATABASE eiscore SET app.jwt_secret TO :'jwt_secret';

CREATE OR REPLACE FUNCTION public.login(username text, password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _app_role text;
  _permissions text[];
  _user_id integer;
  token_claims json;
  _secret text := NULLIF(current_setting('app.jwt_secret', true), '');
BEGIN
  IF _secret IS NULL THEN
    RAISE EXCEPTION 'JWT signing secret is not configured';
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

GRANT EXECUTE ON FUNCTION public.login(text, text) TO web_anon;

CREATE OR REPLACE FUNCTION public.login(payload json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.login(payload->>'username', payload->>'password');
END;
$$;

GRANT EXECUTE ON FUNCTION public.login(json) TO web_anon;

NOTIFY pgrst, 'reload schema';
