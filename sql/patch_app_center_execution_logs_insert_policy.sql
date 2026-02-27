-- Enable write audit logs for app_center.execution_logs (super_admin only)
-- Compatible with both request.jwt.claim.app_role and request.jwt.claims JSON.

BEGIN;

ALTER TABLE app_center.execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS execution_logs_select_policy ON app_center.execution_logs;
CREATE POLICY execution_logs_select_policy ON app_center.execution_logs
  FOR SELECT
  USING (
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.app_role', true), ''),
      NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::json ->> 'app_role'), '')
    ) = 'super_admin'
  );

DROP POLICY IF EXISTS execution_logs_insert_policy ON app_center.execution_logs;
CREATE POLICY execution_logs_insert_policy ON app_center.execution_logs
  FOR INSERT
  WITH CHECK (
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.app_role', true), ''),
      NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::json ->> 'app_role'), '')
    ) = 'super_admin'
  );

DROP POLICY IF EXISTS execution_logs_update_policy ON app_center.execution_logs;
CREATE POLICY execution_logs_update_policy ON app_center.execution_logs
  FOR UPDATE
  USING (
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.app_role', true), ''),
      NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::json ->> 'app_role'), '')
    ) = 'super_admin'
  )
  WITH CHECK (
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.app_role', true), ''),
      NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::json ->> 'app_role'), '')
    ) = 'super_admin'
  );

DROP POLICY IF EXISTS execution_logs_delete_policy ON app_center.execution_logs;
CREATE POLICY execution_logs_delete_policy ON app_center.execution_logs
  FOR DELETE
  USING (
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.app_role', true), ''),
      NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::json ->> 'app_role'), '')
    ) = 'super_admin'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.execution_logs TO web_user;

COMMIT;
