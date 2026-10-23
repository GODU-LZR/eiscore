-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- Split digital-twin business and enterprise-knowledge sessions/files.
-- The namespace comes from the server-signed JWT claim; absent claims retain
-- legacy business behavior while knowledge routes fail closed without a claim.

ALTER TABLE app_data.twin_sessions
  ADD COLUMN IF NOT EXISTS harness_namespace text NOT NULL DEFAULT 'business';
ALTER TABLE app_data.twin_messages
  ADD COLUMN IF NOT EXISTS harness_namespace text NOT NULL DEFAULT 'business';
ALTER TABLE app_data.twin_tool_logs
  ADD COLUMN IF NOT EXISTS harness_namespace text NOT NULL DEFAULT 'business';
ALTER TABLE app_data.twin_knowledge_files
  ADD COLUMN IF NOT EXISTS harness_namespace text NOT NULL DEFAULT 'business';

DO $twin_namespace_checks$
DECLARE
  table_name text;
  constraint_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['twin_sessions', 'twin_messages', 'twin_tool_logs', 'twin_knowledge_files'] LOOP
    constraint_name := table_name || '_harness_namespace_check';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       JOIN pg_class r ON r.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = r.relnamespace
       WHERE n.nspname = 'app_data' AND r.relname = table_name AND c.conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE app_data.%I ADD CONSTRAINT %I CHECK (harness_namespace IN (''business'', ''knowledge''))',
        table_name, constraint_name
      );
    END IF;
  END LOOP;
END
$twin_namespace_checks$;

CREATE INDEX IF NOT EXISTS idx_twin_sessions_namespace_employee
  ON app_data.twin_sessions(harness_namespace, employee_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_twin_knowledge_namespace_employee
  ON app_data.twin_knowledge_files(harness_namespace, employee_id, updated_at DESC);

DROP POLICY IF EXISTS twin_sessions_own ON app_data.twin_sessions;
CREATE POLICY twin_sessions_own ON app_data.twin_sessions FOR ALL
  USING (
    employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
    AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
  )
  WITH CHECK (
    employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
    AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
  );

DROP POLICY IF EXISTS twin_messages_own ON app_data.twin_messages;
CREATE POLICY twin_messages_own ON app_data.twin_messages FOR ALL
  USING (
    harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    AND session_id IN (
      SELECT id FROM app_data.twin_sessions
       WHERE employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
         AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    )
  )
  WITH CHECK (
    harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    AND session_id IN (
      SELECT id FROM app_data.twin_sessions
       WHERE employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
         AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    )
  );

DROP POLICY IF EXISTS twin_tool_logs_own ON app_data.twin_tool_logs;
CREATE POLICY twin_tool_logs_own ON app_data.twin_tool_logs FOR ALL
  USING (
    harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    AND session_id IN (
      SELECT id FROM app_data.twin_sessions
       WHERE employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
         AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    )
  )
  WITH CHECK (
    harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    AND session_id IN (
      SELECT id FROM app_data.twin_sessions
       WHERE employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
         AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
    )
  );

DROP POLICY IF EXISTS twin_knowledge_own ON app_data.twin_knowledge_files;
CREATE POLICY twin_knowledge_own ON app_data.twin_knowledge_files FOR ALL
  USING (
    employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
    AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
  )
  WITH CHECK (
    employee_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'username')
    AND harness_namespace = COALESCE(NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'harness_namespace', ''), 'business')
  );

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
  twin_namespace text := COALESCE(NULLIF(claims ->> 'harness_namespace', ''), 'business');
  bounded_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
BEGIN
  IF app_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'super_admin is required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT s.id, s.employee_id, s.title, s.summary, s.message_count,
         s.model, s.created_at, s.updated_at
    FROM app_data.twin_sessions AS s
   WHERE s.harness_namespace = twin_namespace
   ORDER BY s.updated_at DESC, s.id DESC
   LIMIT bounded_limit;
END;
$$;

ALTER FUNCTION public.admin_twin_sessions(integer) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION public.admin_twin_sessions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_twin_sessions(integer) TO web_user;

DO $twin_namespace_contract$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['twin_sessions', 'twin_messages', 'twin_tool_logs', 'twin_knowledge_files'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
       WHERE attrelid = format('app_data.%I', table_name)::regclass
         AND attname = 'harness_namespace' AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'digital twin namespace column missing on %', table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy
       WHERE polrelid = format('app_data.%I', table_name)::regclass
         AND polname = CASE table_name
           WHEN 'twin_knowledge_files' THEN 'twin_knowledge_own'
           ELSE table_name || '_own'
         END
         AND pg_get_expr(polqual, polrelid) LIKE '%harness_namespace%'
         AND pg_get_expr(polwithcheck, polrelid) LIKE '%harness_namespace%'
    ) THEN
      RAISE EXCEPTION 'digital twin namespace RLS is incomplete on %', table_name;
    END IF;
  END LOOP;
END
$twin_namespace_contract$;

NOTIFY pgrst, 'reload schema';
