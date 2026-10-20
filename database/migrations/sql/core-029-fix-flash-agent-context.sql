-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Correct Flash authorization context name resolution and text[] permissions.
-- CREATE OR REPLACE preserves this function's owner and existing grants.

CREATE OR REPLACE FUNCTION public.flash_agent_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app_center', 'app_data', 'pg_temp'
AS $function$
DECLARE
  claims jsonb := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  actor_username text := COALESCE(NULLIF(claims ->> 'username', ''), NULLIF(claims ->> 'sub', ''), '');
  role_codes jsonb := '[]'::jsonb;
  permission_codes jsonb := '[]'::jsonb;
  apps jsonb := '[]'::jsonb;
  tables jsonb := '[]'::jsonb;
  columns jsonb := '{}'::jsonb;
  field_acl jsonb := '{}'::jsonb;
BEGIN
  IF NOT pg_has_role(session_user, 'eiscore_flash_agent', 'member') THEN
    RAISE EXCEPTION 'eiscore_flash_agent is required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT role_code ORDER BY role_code), '[]'::jsonb)
    INTO role_codes
  FROM (
    SELECT NULLIF(claims ->> 'app_role', '') AS role_code
    UNION ALL SELECT NULLIF(claims ->> 'role_code', '')
    UNION ALL
    SELECT r.code
    FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE u.username = actor_username
    UNION ALL
    SELECT NULLIF(u.role, '')
    FROM public.users u
    WHERE u.username = actor_username
  ) roles
  WHERE COALESCE(role_code, '') <> '';

  SELECT COALESCE(jsonb_agg(DISTINCT permissions.code ORDER BY permissions.code), '[]'::jsonb)
    INTO permission_codes
  FROM (
    SELECT item.value #>> '{}' AS code
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(claims -> 'permissions') = 'array'
        THEN claims -> 'permissions' ELSE '[]'::jsonb END
    ) item
    UNION ALL
    SELECT p.code
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.code IN (SELECT jsonb_array_elements_text(role_codes))
    UNION ALL
    SELECT item.value
    FROM public.users u
    CROSS JOIN LATERAL unnest(COALESCE(u.permissions, ARRAY[]::text[])) item(value)
    WHERE u.username = actor_username
  ) permissions
  JOIN public.permissions active ON active.code = permissions.code AND active.status = 'active'
  WHERE permissions.code = 'module:app'
     OR permissions.code IN (
       SELECT 'app:' || COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''))
       FROM app_center.apps a WHERE a.app_type = 'flash'
     )
     OR EXISTS (
       SELECT 1
       FROM app_center.apps a
       WHERE a.app_type = 'flash'
         AND permissions.code LIKE 'op:' || COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')) || '.%'
     );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'app_id', a.id::text,
      'app_name', a.name,
      'app_type', a.app_type,
      'acl_module', COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', '')),
      'qualified_table', NULLIF(btrim(COALESCE(a.config ->> 'table_name', a.config ->> 'tableName', a.config ->> 'table')), '')
    ) ORDER BY a.name, a.id), '[]'::jsonb)
    INTO apps
  FROM app_center.apps a
  WHERE a.app_type = 'flash'
    AND (
      claims ->> 'app_role' IN ('admin', 'super_admin')
      OR 'module:app' IN (SELECT jsonb_array_elements_text(permission_codes))
      OR ('app:' || COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''))) IN (SELECT jsonb_array_elements_text(permission_codes))
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table_schema', r.table_schema,
      'table_name', r.table_name,
      'access_level', CASE WHEN 'module:app' IN (SELECT jsonb_array_elements_text(permission_codes)) THEN 'operate' ELSE 'read' END
    ) ORDER BY r.table_name), '[]'::jsonb)
    INTO tables
  FROM app_center.data_app_table_registry r
  JOIN app_center.apps a ON a.id = r.app_id AND a.app_type = 'flash'
  WHERE r.table_schema = 'app_data' AND r.lifecycle = 'managed'
    AND a.id::text IN (SELECT value ->> 'app_id' FROM jsonb_array_elements(apps));

  SELECT COALESCE(jsonb_object_agg(table_id, cols), '{}'::jsonb)
    INTO columns
  FROM (
    SELECT r.table_schema || '.' || r.table_name AS table_id,
           jsonb_agg(jsonb_build_object(
             'col', c.column_name,
             'name', c.column_name,
             'type', c.data_type,
             'ui', c.data_type,
             'sensitive', false
           ) ORDER BY c.ordinal_position) AS cols
    FROM app_center.data_app_table_registry r
    JOIN app_center.apps a ON a.id = r.app_id AND a.app_type = 'flash'
    JOIN information_schema.columns c
      ON c.table_schema = r.table_schema AND c.table_name = r.table_name
    WHERE r.table_schema = 'app_data' AND r.lifecycle = 'managed'
      AND a.id::text IN (SELECT value ->> 'app_id' FROM jsonb_array_elements(apps))
    GROUP BY r.table_schema, r.table_name
  ) visible_columns;

  SELECT COALESCE(jsonb_object_agg(module_name, fields), '{}'::jsonb)
    INTO field_acl
  FROM (
    SELECT module_name,
           jsonb_object_agg(field_code, jsonb_build_object(
             'canView', can_view,
             'canEdit', can_edit
           ) ORDER BY field_code) AS fields
    FROM (
      SELECT acl.module AS module_name,
             acl.field_code,
             bool_or(acl.can_view) AS can_view,
             bool_or(acl.can_edit) AS can_edit
      FROM public.sys_field_acl acl
      JOIN public.roles r ON r.id = acl.role_id
      WHERE r.code IN (SELECT jsonb_array_elements_text(role_codes))
        AND acl.module IN (
          SELECT COALESCE(NULLIF(btrim(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::text, '-', ''))
          FROM app_center.apps a
          WHERE a.app_type = 'flash'
            AND a.id::text IN (SELECT value ->> 'app_id' FROM jsonb_array_elements(apps))
        )
        AND COALESCE(acl.status, 'active') = 'active'
      GROUP BY acl.module, acl.field_code
    ) field_rows
    GROUP BY module_name
  ) acl_rows;

  RETURN jsonb_build_object(
    'fetchedAt', clock_timestamp(),
    'source', 'flash_agent_context_v1',
    'accessPolicy', jsonb_build_object(
      'roleScoped', true,
      'superUser', claims ->> 'app_role' IN ('admin', 'super_admin'),
      'username', actor_username,
      'roles', role_codes
    ),
    'permissions', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', value #>> '{}') ORDER BY value #>> '{}') FROM jsonb_array_elements(permission_codes)), '[]'::jsonb),
    'apps', apps,
    'tables', tables,
    'columns', columns,
    'fieldAcl', field_acl,
    'fieldAclAvailable', true
  );
END
$function$;
