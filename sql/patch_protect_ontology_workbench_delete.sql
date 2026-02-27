-- Patch: protect ontology workbench app from deletion
-- Execute:
--   cat sql/patch_protect_ontology_workbench_delete.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

BEGIN;

DROP POLICY IF EXISTS "apps_delete_policy" ON app_center.apps;
CREATE POLICY "apps_delete_policy" ON app_center.apps
    FOR DELETE USING (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
        AND COALESCE(config ->> 'systemApp', '') <> 'ontology_workbench'
    );

COMMIT;

