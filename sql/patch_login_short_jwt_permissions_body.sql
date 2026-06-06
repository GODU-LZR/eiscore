-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Fix oversized login JWTs that can trigger HTTP 431 on every module request.
-- Execute:
--   cat sql/patch_login_short_jwt_permissions_body.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
--
-- The JWT only carries database/app role identity. The full permission list is
-- returned in the login JSON body for frontend menu/button visibility.

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
  _secret text := 'my_super_secret_key_for_eiscore_system_2025';
BEGIN
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

CREATE OR REPLACE FUNCTION workflow.claim_permissions(
    p_claims JSONB DEFAULT workflow.current_claims()
)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_role TEXT := NULLIF(btrim(COALESCE(p_claims ->> 'app_role', '')), '');
    v_permissions TEXT[];
BEGIN
    SELECT COALESCE(
        ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(p_claims -> 'permissions', '[]'::jsonb))
        ),
        ARRAY[]::text[]
    )
    INTO v_permissions;

    IF COALESCE(array_length(v_permissions, 1), 0) > 0 THEN
        RETURN v_permissions;
    END IF;

    IF v_role IS NULL THEN
        RETURN ARRAY[]::text[];
    END IF;

    SELECT COALESCE(v.permissions, ARRAY[]::text[])
      INTO v_permissions
    FROM public.v_role_permissions v
    WHERE v.role_code = v_role
    LIMIT 1;

    RETURN COALESCE(v_permissions, ARRAY[]::text[]);
END;
$$;

REVOKE ALL ON FUNCTION workflow.claim_permissions(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow.claim_permissions(JSONB) TO web_user;
