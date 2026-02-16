-- Patch: complete RLS write policies for workflow-related app_center tables
-- Execute:
--   cat sql/workflow_rls_patch.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_center TO web_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_center GRANT USAGE, SELECT ON SEQUENCES TO web_user;

-- published_routes: keep read-open, restrict writes to super_admin
DROP POLICY IF EXISTS "published_routes_select_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_select_policy" ON app_center.published_routes
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "published_routes_insert_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_insert_policy" ON app_center.published_routes
  FOR INSERT WITH CHECK (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

DROP POLICY IF EXISTS "published_routes_update_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_update_policy" ON app_center.published_routes
  FOR UPDATE USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

DROP POLICY IF EXISTS "published_routes_delete_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_delete_policy" ON app_center.published_routes
  FOR DELETE USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

-- workflow_state_mappings: allow read for linked apps, writes for super_admin only
DROP POLICY IF EXISTS "workflow_mappings_select_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_select_policy" ON app_center.workflow_state_mappings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM app_center.apps
      WHERE apps.id = workflow_state_mappings.workflow_app_id
    )
  );

DROP POLICY IF EXISTS "workflow_mappings_insert_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_insert_policy" ON app_center.workflow_state_mappings
  FOR INSERT WITH CHECK (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

DROP POLICY IF EXISTS "workflow_mappings_update_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_update_policy" ON app_center.workflow_state_mappings
  FOR UPDATE USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );

DROP POLICY IF EXISTS "workflow_mappings_delete_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_delete_policy" ON app_center.workflow_state_mappings
  FOR DELETE USING (
    (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
  );
