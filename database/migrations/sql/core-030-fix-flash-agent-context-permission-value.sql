-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- User permissions are text[]; only JWT claim permissions are jsonb.

DO $flash_agent_context_permission_value$
DECLARE
  definition text;
  rewritten text;
BEGIN
  SELECT pg_get_functiondef('public.flash_agent_context()'::regprocedure)
    INTO definition;
  rewritten := regexp_replace(
    definition,
    $pattern$SELECT\s+item\.value\s+#>>\s+'\{\}'(\s+FROM\s+public\.users\s+u\s+CROSS\s+JOIN\s+LATERAL\s+unnest)$pattern$,
    'SELECT item.value\1',
    1,
    0,
    'i'
  );
  IF rewritten = definition THEN
    RAISE EXCEPTION 'Flash permission text[] expression was not found';
  END IF;
  EXECUTE rewritten;
END
$flash_agent_context_permission_value$;
