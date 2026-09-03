-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- Immutable DB1 postcheck used only by the eiscore-db-v1 equivalence test.

DO $$
DECLARE
  login_definition text := pg_get_functiondef('public.login(text,text)'::regprocedure);
  insert_definition text := pg_get_functiondef('public.tg_v_users_manage_insert()'::regprocedure);
  login_config text[];
BEGIN
  SELECT proconfig
    INTO login_config
  FROM pg_proc
  WHERE oid = 'public.login(text,text)'::regprocedure;

  IF position('app.jwt_secret' IN login_definition) = 0
     OR position(concat('my', '_super', '_secret') IN login_definition) > 0 THEN
    RAISE EXCEPTION 'public.login does not externalize its JWT signing secret';
  END IF;

  IF NOT coalesce(login_config, ARRAY[]::text[]) @> ARRAY['search_path=pg_catalog, public'] THEN
    RAISE EXCEPTION 'public.login does not pin its search_path';
  END IF;

  IF position('gen_random_bytes' IN insert_definition) = 0
     OR position(concat('123', '456') IN insert_definition) > 0 THEN
    RAISE EXCEPTION 'public.tg_v_users_manage_insert still has a fixed password fallback';
  END IF;
END
$$;
