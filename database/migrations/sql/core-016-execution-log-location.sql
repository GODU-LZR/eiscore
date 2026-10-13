-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Older database volumes were initialized before execution_logs gained the
-- operation_location column. Keep the upgrade idempotent and ask PostgREST to
-- rebuild its schema cache after the column is visible.

ALTER TABLE app_center.execution_logs
  ADD COLUMN IF NOT EXISTS operation_location JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE app_center.execution_logs
   SET operation_location = '{}'::jsonb
 WHERE operation_location IS NULL;

ALTER TABLE app_center.execution_logs
  ALTER COLUMN operation_location SET DEFAULT '{}'::jsonb,
  ALTER COLUMN operation_location SET NOT NULL;

COMMENT ON COLUMN app_center.execution_logs.operation_location IS
  'Operation context displayed by the grid operation-location column.';

GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.execution_logs TO web_user;

-- PostgREST listens on this channel and reloads its schema cache after commit.
SELECT pg_notify('pgrst', 'reload schema');
