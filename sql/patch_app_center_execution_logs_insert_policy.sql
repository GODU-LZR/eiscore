-- Enable write audit logs for app_center.execution_logs (super_admin only)

BEGIN;

ALTER TABLE app_center.execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS execution_logs_insert_policy ON app_center.execution_logs;
CREATE POLICY execution_logs_insert_policy ON app_center.execution_logs
  FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

DROP POLICY IF EXISTS execution_logs_update_policy ON app_center.execution_logs;
CREATE POLICY execution_logs_update_policy ON app_center.execution_logs
  FOR UPDATE
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

DROP POLICY IF EXISTS execution_logs_delete_policy ON app_center.execution_logs;
CREATE POLICY execution_logs_delete_policy ON app_center.execution_logs
  FOR DELETE
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.execution_logs TO web_user;

COMMIT;
