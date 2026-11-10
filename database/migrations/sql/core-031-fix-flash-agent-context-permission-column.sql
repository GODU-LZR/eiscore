-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Qualify the permission aggregate after joining public.permissions active;
-- the unqualified code name is ambiguous in PostgreSQL.

DO $flash_agent_context_permission_column$
DECLARE
  definition text;
  rewritten text;
BEGIN
  SELECT pg_get_functiondef('public.flash_agent_context()'::regprocedure)
    INTO definition;
  rewritten := replace(
    definition,
    'jsonb_agg(DISTINCT code ORDER BY code)',
    'jsonb_agg(DISTINCT permissions.code ORDER BY permissions.code)'
  );
  IF rewritten = definition THEN
    RAISE EXCEPTION 'Flash permission aggregate expression was not found';
  END IF;
  EXECUTE rewritten;
END
$flash_agent_context_permission_column$;
