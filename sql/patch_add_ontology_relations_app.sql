-- Patch: replace ontology data-grid app with local ontology workbench app
-- Execute:
--   cat sql/patch_add_ontology_relations_app.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS public.ontology_table_semantics (
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    semantic_domain TEXT NOT NULL DEFAULT 'general',
    semantic_class TEXT NOT NULL DEFAULT 'entity',
    semantic_name TEXT NOT NULL,
    semantic_description TEXT NOT NULL DEFAULT '',
    is_business BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (table_schema, table_name)
);

INSERT INTO public.ontology_table_semantics (
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags
)
SELECT *
FROM (
    VALUES
        ('hr', 'employee_profiles', 'hr', 'employee_profile', '员工档案主数据', '员工个人、组织与岗位基础信息', true, '["hr","employee","master"]'::jsonb),
        ('hr', 'archives', 'hr', 'employee_archive', '人事花名册', '员工全生命周期档案信息', true, '["hr","employee","archive"]'::jsonb),
        ('hr', 'attendance_records', 'hr', 'attendance_record', '考勤记录', '员工每日考勤明细', true, '["hr","attendance"]'::jsonb),
        ('hr', 'attendance_shifts', 'hr', 'attendance_shift', '班次定义', '考勤班次与时间规则', true, '["hr","attendance","shift"]'::jsonb),
        ('hr', 'attendance_month_overrides', 'hr', 'attendance_override', '月度考勤修正', '月度考勤修正规则与补录', true, '["hr","attendance"]'::jsonb),
        ('hr', 'payroll', 'hr', 'payroll_item', '薪酬记录', '员工薪酬核算与结果记录', true, '["hr","payroll"]'::jsonb),

        ('scm', 'warehouses', 'mms', 'warehouse', '仓库', '仓库与库区基础信息', true, '["mms","warehouse"]'::jsonb),
        ('scm', 'warehouse_layouts', 'mms', 'warehouse_layout', '仓库布局', '仓库可视化布局与货位结构', true, '["mms","warehouse","layout"]'::jsonb),
        ('scm', 'batch_no_rules', 'mms', 'batch_rule', '批次号规则', '物料批次号生成与编码规则', true, '["mms","batch"]'::jsonb),
        ('scm', 'inventory_batches', 'mms', 'inventory_batch', '库存批次', '批次级库存台账', true, '["mms","inventory","batch"]'::jsonb),
        ('scm', 'inventory_transactions', 'mms', 'inventory_transaction', '库存流水', '入库出库领退料业务流水', true, '["mms","inventory","transaction"]'::jsonb),
        ('scm', 'inventory_drafts', 'mms', 'inventory_draft', '库存单据草稿', '库存业务草稿与暂存数据', true, '["mms","inventory","draft"]'::jsonb),
        ('scm', 'inventory_checks', 'mms', 'inventory_check', '盘点单', '库存盘点业务单据', true, '["mms","inventory","check"]'::jsonb),
        ('scm', 'inventory_check_items', 'mms', 'inventory_check_item', '盘点明细', '盘点单行项目与差异结果', true, '["mms","inventory","check"]'::jsonb),

        ('workflow', 'definitions', 'workflow', 'workflow_definition', '流程定义', 'BPMN 流程定义主表', true, '["workflow","definition"]'::jsonb),
        ('workflow', 'instances', 'workflow', 'workflow_instance', '流程实例', '流程运行实例', true, '["workflow","instance"]'::jsonb),
        ('workflow', 'task_assignments', 'workflow', 'task_assignment', '任务分配规则', '流程节点与候选人分配', true, '["workflow","task"]'::jsonb),
        ('workflow', 'instance_events', 'workflow', 'workflow_event', '流程事件日志', '流程流转与操作审计日志', true, '["workflow","event","audit"]'::jsonb),

        ('public', 'employees', 'hr', 'employee_basic', '员工基础资料', '员工基础信息（公共域）', true, '["hr","employee"]'::jsonb),
        ('public', 'departments', 'hr', 'department', '组织部门', '部门层级与组织结构', true, '["hr","org"]'::jsonb),
        ('public', 'positions', 'hr', 'position', '岗位', '岗位定义与岗位归属', true, '["hr","org","position"]'::jsonb),
        ('public', 'raw_materials', 'mms', 'material_master', '原料主数据', '原料主数据（公共域）', true, '["mms","material","master"]'::jsonb),
        ('public', 'files', 'system', 'file_asset', '文件资产', '附件与文件对象存储索引', true, '["file","asset"]'::jsonb),
        ('public', 'form_values', 'system', 'form_value', '表单值', '动态表单值存储', true, '["form","value"]'::jsonb),

        ('app_center', 'apps', 'system', 'app_registry', '应用注册表', '应用中心应用元数据', false, '["system","config"]'::jsonb),
        ('app_center', 'categories', 'system', 'app_category', '应用分类', '应用中心分类配置', false, '["system","config"]'::jsonb),
        ('app_center', 'execution_logs', 'system', 'app_execution_log', '执行日志', '应用运行执行日志', false, '["system","log"]'::jsonb),
        ('app_center', 'published_routes', 'system', 'app_route', '发布路由', '应用发布路由配置', false, '["system","route"]'::jsonb),
        ('app_center', 'workflow_state_mappings', 'system', 'workflow_state_mapping', '流程状态映射', '流程节点到业务状态映射', false, '["system","workflow","config"]'::jsonb),

        ('public', 'permissions', 'system', 'permission', '权限定义', '权限码与权限元数据', false, '["system","acl"]'::jsonb),
        ('public', 'roles', 'system', 'role', '角色定义', '系统角色定义', false, '["system","acl"]'::jsonb),
        ('public', 'user_roles', 'system', 'user_role', '用户角色关系', '用户与角色绑定', false, '["system","acl"]'::jsonb),
        ('public', 'role_permissions', 'system', 'role_permission', '角色权限关系', '角色与权限绑定', false, '["system","acl"]'::jsonb),
        ('public', 'role_data_scopes', 'system', 'role_scope', '角色数据域', '角色数据权限范围', false, '["system","acl"]'::jsonb),
        ('public', 'sys_field_acl', 'system', 'field_acl', '字段权限', '字段级权限配置', false, '["system","acl"]'::jsonb),
        ('public', 'sys_dicts', 'system', 'dict', '字典主表', '系统字典定义', false, '["system","dict"]'::jsonb),
        ('public', 'sys_dict_items', 'system', 'dict_item', '字典项', '系统字典枚举项', false, '["system","dict"]'::jsonb),
        ('public', 'system_configs', 'system', 'system_config', '系统配置', '系统级配置项', false, '["system","config"]'::jsonb),
        ('public', 'field_label_overrides', 'system', 'field_label_override', '字段显示名覆盖', '字段显示名称覆盖配置', false, '["system","config"]'::jsonb),
        ('public', 'sys_grid_configs', 'system', 'grid_config', '表格配置', '表格视图与列配置', false, '["system","config"]'::jsonb),
        ('public', 'users', 'system', 'system_user', '系统用户', '系统账户信息', false, '["system","account"]'::jsonb),
        ('basic_auth', 'users', 'system', 'auth_user', '认证用户', '认证模块用户信息', false, '["system","account"]'::jsonb)
) AS seed(
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags
)
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = EXCLUDED.is_business,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

INSERT INTO public.ontology_table_semantics (
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags
)
SELECT
    'app_data' AS table_schema,
    t.table_name,
    'app_data' AS semantic_domain,
    'dynamic_data_app' AS semantic_class,
    format(U&'\52A8\6001\4E1A\52A1\8868\5355(%s)', t.table_name) AS semantic_name,
    U&'\5E94\7528\4E2D\5FC3\52A8\6001\751F\6210\7684\6570\636E\4E1A\52A1\8868' AS semantic_description,
    true AS is_business,
    '["app_data","dynamic","business"]'::jsonb AS tags
FROM information_schema.tables t
WHERE t.table_schema = 'app_data'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name LIKE 'data_app_%'
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = true,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

CREATE OR REPLACE VIEW app_data.ontology_table_relations AS
WITH manual_ontology_relations AS (
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
fk_pairs AS (
    SELECT
        con.oid AS constraint_oid,
        ns_src.nspname AS src_schema,
        cls_src.relname AS src_table,
        att_src.attname AS src_column,
        ns_ref.nspname AS ref_schema,
        cls_ref.relname AS ref_table,
        att_ref.attname AS ref_column,
        src_key.ord AS key_ord
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class cls_src
      ON cls_src.oid = con.conrelid
    JOIN pg_catalog.pg_namespace ns_src
      ON ns_src.oid = cls_src.relnamespace
    JOIN pg_catalog.pg_class cls_ref
      ON cls_ref.oid = con.confrelid
    JOIN pg_catalog.pg_namespace ns_ref
      ON ns_ref.oid = cls_ref.relnamespace
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS src_key(attnum, ord)
      ON true
    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ref_key(attnum, ord)
      ON ref_key.ord = src_key.ord
    JOIN pg_catalog.pg_attribute att_src
      ON att_src.attrelid = con.conrelid
     AND att_src.attnum = src_key.attnum
    JOIN pg_catalog.pg_attribute att_ref
      ON att_ref.attrelid = con.confrelid
     AND att_ref.attnum = ref_key.attnum
    WHERE con.contype = 'f'
      AND ns_src.nspname IN ('public', 'app_center', 'workflow', 'app_data', 'hr', 'scm')
      AND ns_ref.nspname IN ('public', 'app_center', 'workflow', 'app_data', 'hr', 'scm')
),
ontology_relations AS (
    SELECT * FROM manual_ontology_relations
    UNION ALL
    SELECT
        'ontology'::text AS relation_type,
        format('%I.%I', fk.src_schema, fk.src_table) AS subject_table,
        COALESCE(fk.src_column, '') AS subject_column,
        'ontology:dependsOn'::text AS predicate,
        format('%I.%I', fk.ref_schema, fk.ref_table) AS object_table,
        COALESCE(fk.ref_column, '') AS object_column,
        ''::text AS bridge_table,
        format(
            'business ontology inferred from foreign key: %I.%I.%I depends on %I.%I.%I',
            fk.src_schema,
            fk.src_table,
            COALESCE(fk.src_column, '?'),
            fk.ref_schema,
            fk.ref_table,
            COALESCE(fk.ref_column, '?')
        ) AS details
    FROM fk_pairs fk
    JOIN public.ontology_table_semantics ss
      ON ss.table_schema = fk.src_schema
     AND ss.table_name = fk.src_table
     AND ss.is_active = true
     AND ss.is_business = true
    JOIN public.ontology_table_semantics os
      ON os.table_schema = fk.ref_schema
     AND os.table_name = fk.ref_table
     AND os.is_active = true
     AND os.is_business = true
),
fk_relations AS (
    SELECT
        'foreign_key'::text AS relation_type,
        format('%I.%I', fk.src_schema, fk.src_table) AS subject_table,
        COALESCE(fk.src_column, '') AS subject_column,
        format('fk:%s', COALESCE(fk.src_column, '?')) AS predicate,
        format('%I.%I', fk.ref_schema, fk.ref_table) AS object_table,
        COALESCE(fk.ref_column, '') AS object_column,
        ''::text AS bridge_table,
        format(
            '%I.%I.%I -> %I.%I.%I',
            fk.src_schema,
            fk.src_table,
            COALESCE(fk.src_column, '?'),
            fk.ref_schema,
            fk.ref_table,
            COALESCE(fk.ref_column, '?')
        ) AS details
    FROM fk_pairs fk
),
all_relations AS (
    SELECT * FROM ontology_relations
    UNION ALL
    SELECT * FROM fk_relations
)
SELECT
    row_number() OVER (
        ORDER BY ar.relation_type, ar.subject_table, ar.predicate, ar.object_table, ar.subject_column, ar.object_column
    )::bigint AS id,
    ar.relation_type,
    ar.subject_table,
    ar.subject_column,
    ar.predicate,
    ar.object_table,
    ar.object_column,
    ar.bridge_table,
    ar.details,
    COALESCE(ss.semantic_name, ar.subject_table) AS subject_semantic_name,
    COALESCE(ss.semantic_class, '') AS subject_semantic_class,
    COALESCE(ss.semantic_domain, '') AS subject_semantic_domain,
    COALESCE(ss.is_business, false) AS subject_is_business,
    COALESCE(os.semantic_name, ar.object_table) AS object_semantic_name,
    COALESCE(os.semantic_class, '') AS object_semantic_class,
    COALESCE(os.semantic_domain, '') AS object_semantic_domain,
    COALESCE(os.is_business, false) AS object_is_business,
    (COALESCE(ss.is_business, false) AND COALESCE(os.is_business, false)) AS is_business_relation
FROM all_relations ar
LEFT JOIN public.ontology_table_semantics ss
  ON ss.table_schema = split_part(ar.subject_table, '.', 1)
 AND ss.table_name = split_part(ar.subject_table, '.', 2)
 AND ss.is_active = true
LEFT JOIN public.ontology_table_semantics os
  ON os.table_schema = split_part(ar.object_table, '.', 1)
 AND os.table_name = split_part(ar.object_table, '.', 2)
 AND os.is_active = true;

GRANT SELECT ON public.ontology_table_semantics TO web_user;
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
    v_app_name_zh TEXT := convert_from(decode('e69cace4bd93e585b3e7b3bbe5b7a5e4bd9ce58fb0', 'hex'), 'UTF8');
    v_app_desc_zh TEXT := convert_from(decode('e69cace59cb0e58fafe8a786e58c96e69cace4bd93e585b3e7b3bbe5b7a5e4bd9ce58fb0efbc8ce794a8e4ba8ee5b195e7a4bae8a1a8e4b98be997b4e79a84e585b3e7b3bbe38082', 'hex'), 'UTF8');
    v_perm_app_zh TEXT := convert_from(decode('e5ba94e794a82de69cace4bd93e585b3e7b3bbe5b7a5e4bd9ce58fb0', 'hex'), 'UTF8');
    v_perm_refresh_zh TEXT := convert_from(decode('e69cace4bd93e585b3e7b3bbe5b7a5e4bd9ce58fb02de588b7e696b0', 'hex'), 'UTF8');
    v_perm_inspect_zh TEXT := convert_from(decode('e69cace4bd93e585b3e7b3bbe5b7a5e4bd9ce58fb02de69fa5e79c8be585b3e7b3bb', 'hex'), 'UTF8');
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
     WHERE (
              a.name IN ('Ontology Workbench', v_app_name_zh)
              OR COALESCE(a.config ->> 'systemApp', '') = 'ontology_workbench'
           )
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
            v_app_name_zh,
            v_app_desc_zh,
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
       SET name = v_app_name_zh,
           description = v_app_desc_zh,
           category_id = 2,
           app_type = 'custom',
           icon = 'DataAnalysis',
           status = 'published',
           config = jsonb_build_object(
               'systemApp', 'ontology_workbench',
               'readonlyName', v_app_name_zh,
               'readonlyDescription', v_app_desc_zh,
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
            'name', v_perm_app_zh,
            'module', v_app_name_zh,
            'action', 'enter',
            'roles', jsonb_build_array('super_admin')
        ),
        jsonb_build_object(
            'code', format('op:%s.refresh', v_module_key),
            'name', v_perm_refresh_zh,
            'module', v_app_name_zh,
            'action', 'refresh',
            'roles', jsonb_build_array('super_admin')
        ),
        jsonb_build_object(
            'code', format('op:%s.inspect', v_module_key),
            'name', v_perm_inspect_zh,
            'module', v_app_name_zh,
            'action', 'inspect',
            'roles', jsonb_build_array('super_admin')
        )
    );

    PERFORM public.upsert_permissions(v_perm_payload);
    PERFORM pg_notify('pgrst', 'reload schema');
END $$;
