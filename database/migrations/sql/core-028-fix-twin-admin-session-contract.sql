-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Correct the post-core-025/027 administrator session RPC contract. Keep the
-- historical migrations immutable while making the claims conversion explicit
-- and ensuring the SECURITY DEFINER function is owned by the platform owner.

CREATE OR REPLACE FUNCTION public.admin_twin_sessions(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  employee_id text,
  title text,
  summary text,
  message_count integer,
  model text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, app_data
AS $$
DECLARE
  claims jsonb := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  app_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claim.app_role', true), ''),
    NULLIF(claims ->> 'app_role', '')
  );
  bounded_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
BEGIN
  IF app_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'super_admin is required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT s.id, s.employee_id, s.title, s.summary, s.message_count,
         s.model, s.created_at, s.updated_at
    FROM app_data.twin_sessions AS s
   ORDER BY s.updated_at DESC, s.id DESC
   LIMIT bounded_limit;
END;
$$;

ALTER FUNCTION public.admin_twin_sessions(integer) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.admin_twin_sessions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_twin_sessions(integer) TO web_user;
