-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Read-only administrator view of Harness-backed digital-twin sessions.
-- Ordinary users continue to use twin_sessions_own through PostgREST.

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
  claims jsonb := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}'::jsonb);
  app_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claim.app_role', true), ''),
    NULLIF(claims ->> 'app_role', '')
  );
  bounded_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
BEGIN
  IF app_role <> 'super_admin' THEN
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

REVOKE ALL ON FUNCTION public.admin_twin_sessions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_twin_sessions(integer) TO web_user;
