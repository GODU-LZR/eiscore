-- Patch: replace ontology data-grid app with local ontology workbench app
-- Execute:
--   cat sql/patch_add_ontology_relations_app.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

CREATE OR REPLACE VIEW app_data.ontology_table_relations AS
WITH ontology_relations AS (
    SELECT
        'ontology'::text AS relation_type,
        'public.users'::text AS subject_table,
        ''::text AS subject_column,
        'acl:hasRole'::text AS predicate,
        'public.roles'::text AS object_table,
        ''::text AS object_column,
        'public.user_roles'::text AS bridge_table,
        'user_roles.user_id -> users.id; user_roles.role_id -> roles.id'::text AS details
    UNION ALL
    SELECT
        'ontology', 'public.roles', '', 'acl:grantsPermission', 'public.permissions', '', 'public.role_permissions',
        'role_permissions.role_id -> roles.id; role_permissions.permission_id -> permissions.id'
    UNION ALL
    SELECT
        'ontology', 'workflow.instances', 'definition_id', 'wf:instanceOf', 'workflow.definitions', 'id', '', 'workflow instance belongs to workflow definition'
    UNION ALL
    SELECT
        'ontology', 'workflow.instances', 'current_task_id', 'wf:hasCurrentTask', 'workflow.task_assignments', 'task_id', '', 'task assignment applies with definition_id + task_id'
    UNION ALL
    SELECT
        'ontology', 'workflow.task_assignments', 'candidate_roles[]', 'wf:assignedRole', 'public.roles', 'code', '', 'candidate_roles stores role codes'
    UNION ALL
    SELECT
        'ontology', 'workflow.task_assignments', 'candidate_users[]', 'wf:assignedUser', 'public.users', 'username', '', 'candidate_users stores usernames'
    UNION ALL
    SELECT
        'ontology', 'workflow.definitions', 'app_id', 'eiscore:linkedApp', 'app_center.apps', 'id', '', 'workflow definition linked to App Center app'
    UNION ALL
    SELECT
        'ontology', 'app_center.workflow_state_mappings', 'workflow_app_id', 'wf:mapsToStatus', 'app_center.apps', 'id', '', 'state mapping belongs to workflow app'
    UNION ALL
    SELECT
        'ontology', 'public.permissions', 'code', 'ontology:semanticProjection', 'public.v_permission_ontology', 'code', '', 'permission codes parsed into semantic view'
),
fk_relations AS (
    SELECT
        'foreign_key'::text AS relation_type,
        format('%I.%I', tc.table_schema, tc.table_name) AS subject_table,
        COALESCE(kcu.column_name, '') AS subject_column,
        format('fk:%s', COALESCE(kcu.column_name, '?')) AS predicate,
        format('%I.%I', ccu.table_schema, ccu.table_name) AS object_table,
        COALESCE(ccu.column_name, '') AS object_column,
        ''::text AS bridge_table,
        format(
            '%I.%I.%I -> %I.%I.%I',
            tc.table_schema,
            tc.table_name,
            COALESCE(kcu.column_name, '?'),
            ccu.table_schema,
            ccu.table_name,
            COALESCE(ccu.column_name, '?')
        ) AS details
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema IN ('public', 'app_center', 'workflow', 'app_data', 'hr', 'scm')
)
SELECT
    row_number() OVER (
        ORDER BY relation_type, subject_table, predicate, object_table, subject_column, object_column
    )::bigint AS id,
    relation_type,
    subject_table,
    subject_column,
    predicate,
    object_table,
    object_column,
    bridge_table,
    details
FROM (
    SELECT * FROM ontology_relations
    UNION ALL
    SELECT * FROM fk_relations
) AS all_relations;

GRANT USAGE ON SCHEMA app_data TO web_user;
GRANT SELECT ON app_data.ontology_table_relations TO web_user;

DO $$
DECLARE
    v_old_ids UUID[];
    v_old_id UUID;
    v_old_module TEXT;
    v_new_app_id UUID;
    v_module_key TEXT;
    v_route_path TEXT;
    v_perm_payload JSONB;
BEGIN
    SELECT array_agg(a.id)
      INTO v_old_ids
      FROM app_center.apps a
     WHERE a.app_type = 'data'
       AND COALESCE(a.config ->> 'table', '') = 'app_data.ontology_table_relations';

    IF v_old_ids IS NOT NULL THEN
        FOREACH v_old_id IN ARRAY v_old_ids LOOP
            v_old_module := 'app_' || replace(v_old_id::text, '-', '');

            DELETE FROM public.role_permissions rp
            USING public.permissions p
            WHERE rp.permission_id = p.id
              AND p.code IN (
                  format('app:%s', v_old_module),
                  format('op:%s.create', v_old_module),
                  format('op:%s.edit', v_old_module),
                  format('op:%s.delete', v_old_module),
                  format('op:%s.export', v_old_module),
                  format('op:%s.config', v_old_module)
              );

            DELETE FROM public.permissions
            WHERE code IN (
                format('app:%s', v_old_module),
                format('op:%s.create', v_old_module),
                format('op:%s.edit', v_old_module),
                format('op:%s.delete', v_old_module),
                format('op:%s.export', v_old_module),
                format('op:%s.config', v_old_module)
            );

            DELETE FROM app_center.apps WHERE id = v_old_id;
        END LOOP;
    END IF;

    SELECT a.id
      INTO v_new_app_id
      FROM app_center.apps a
     WHERE a.name = 'Ontology Workbench'
       AND a.app_type = 'custom'
     ORDER BY a.created_at DESC
     LIMIT 1;

    IF v_new_app_id IS NULL THEN
        INSERT INTO app_center.apps (
            name,
            description,
            category_id,
            app_type,
            source_code,
            config,
            bpmn_xml,
            icon,
            status,
            version,
            created_by,
            updated_by
        )
        VALUES (
            'Ontology Workbench',
            'Local themed interface for ontology and table relationships.',
            2,
            'custom',
            NULL,
            '{}'::jsonb,
            NULL,
            'DataAnalysis',
            'published',
            '1.0.0',
            'system',
            'system'
        )
        RETURNING id INTO v_new_app_id;
    END IF;

    v_module_key := 'app_' || replace(v_new_app_id::text, '-', '');
    v_route_path := '/apps/ontology-relations/' || v_new_app_id::text;

    UPDATE app_center.apps
       SET description = 'Local themed interface for ontology and table relationships.',
           category_id = 2,
           app_type = 'custom',
           icon = 'DataAnalysis',
           status = 'published',
           config = jsonb_build_object(
               'aclModule', v_module_key,
               'perm', format('app:%s', v_module_key),
               'ops', jsonb_build_object(
                   'refresh', format('op:%s.refresh', v_module_key),
                   'inspect', format('op:%s.inspect', v_module_key)
               )
           ),
           updated_by = 'system',
           updated_at = NOW()
     WHERE id = v_new_app_id;

    DELETE FROM app_center.published_routes
     WHERE app_id = v_new_app_id
       AND route_path <> v_route_path;

    INSERT INTO app_center.published_routes (app_id, route_path, mount_point, is_active)
    VALUES (v_new_app_id, v_route_path, '/apps', true)
    ON CONFLICT (route_path) DO UPDATE
      SET app_id = EXCLUDED.app_id,
          mount_point = EXCLUDED.mount_point,
          is_active = true;

    v_perm_payload := jsonb_build_array(
        jsonb_build_object(
            'code', format('app:%s', v_module_key),
            'name', 'App-Ontology Workbench',
            'module', 'Ontology Workbench',
            'action', 'enter',
            'roles', jsonb_build_array('super_admin')
        ),
        jsonb_build_object(
            'code', format('op:%s.refresh', v_module_key),
            'name', 'Ontology Workbench-Refresh',
            'module', 'Ontology Workbench',
            'action', 'refresh',
            'roles', jsonb_build_array('super_admin')
        ),
        jsonb_build_object(
            'code', format('op:%s.inspect', v_module_key),
            'name', 'Ontology Workbench-Inspect',
            'module', 'Ontology Workbench',
            'action', 'inspect',
            'roles', jsonb_build_array('super_admin')
        )
    );

    PERFORM public.upsert_permissions(v_perm_payload);
END $$;
