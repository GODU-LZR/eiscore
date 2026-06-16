-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: broaden ontology semantic coverage for newly added business forms
--        and role entities.
-- Execute:
--   cat sql/patch_ontology_semantic_coverage_v2.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

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

CREATE TABLE IF NOT EXISTS public.ontology_column_semantics (
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    semantic_class TEXT NOT NULL DEFAULT 'business_attribute',
    semantic_name TEXT NOT NULL,
    semantic_description TEXT NOT NULL DEFAULT '',
    data_type TEXT NOT NULL DEFAULT 'text',
    ui_type TEXT NOT NULL DEFAULT 'text',
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    source TEXT NOT NULL DEFAULT 'rule_fallback',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (table_schema, table_name, column_name)
);

WITH semantic_seed AS (
    SELECT *
    FROM (
        VALUES
            ('public', 'sales_customers', 'sales', 'customer', '销售客户', '客户主数据、信用额度、负责人和跟进状态', true, '["sales","customer","business_form"]'::jsonb),
            ('public', 'sales_follow_ups', 'sales', 'customer_follow_up', '客户跟进', '客户拜访、沟通结果和下次跟进计划', true, '["sales","follow_up","business_form"]'::jsonb),
            ('public', 'sales_opportunities', 'sales', 'opportunity', '销售商机', '销售机会、阶段、概率和预计金额', true, '["sales","opportunity","business_form"]'::jsonb),
            ('public', 'sales_orders', 'sales', 'sales_order', '销售订单', '客户订单、产品、交期、金额和订单状态', true, '["sales","order","business_form"]'::jsonb),
            ('public', 'sales_payments', 'sales', 'sales_payment', '销售回款', '销售订单回款、核销状态和收款方式', true, '["sales","payment","business_form"]'::jsonb),

            ('public', 'purchase_suppliers', 'purchase', 'supplier', '供应商', '供应商档案、等级、账期和采购负责人', true, '["purchase","supplier","business_form"]'::jsonb),
            ('public', 'purchase_demands', 'purchase', 'purchase_demand', '采购需求', '物料采购需求、需求部门、期望供应商和需求状态', true, '["purchase","demand","business_form"]'::jsonb),
            ('public', 'purchase_orders', 'purchase', 'purchase_order', '采购订单', '供应商订单、物料、金额、交期和订单状态', true, '["purchase","order","business_form"]'::jsonb),
            ('public', 'purchase_arrivals', 'purchase', 'purchase_arrival', '采购到货', '采购到货、验收数量、IQC 状态和入库关联', true, '["purchase","arrival","business_form"]'::jsonb),

            ('public', 'document_links', 'document_flow', 'document_link', '单据关联', '跨业务单据上下游关系、数量金额和反冲状态', true, '["document_flow","link","business_relation"]'::jsonb),
            ('public', 'document_flow_audits', 'document_flow', 'document_flow_audit', '单据流转审计', '单据生成、反冲和关联变更的审计日志', true, '["document_flow","audit"]'::jsonb),
            ('public', 'sop_learning_records', 'learning', 'sop_learning_record', 'SOP 学习记录', '用户对操作指引和模块 SOP 的学习完成记录', true, '["learning","sop","audit"]'::jsonb),

            ('app_center', 'workflow_permission_policies', 'workflow', 'workflow_permission_policy', '流程权限策略', '流程应用 V2 权限模式、校验开关和旧码兜底策略', false, '["workflow","acl","config","v2"]'::jsonb),
            ('app_center', 'workflow_transition_rules', 'workflow', 'workflow_transition_rule', '流程迁移规则', '流程任务和业务状态迁移所需的显式权限规则', false, '["workflow","transition","acl","v2"]'::jsonb),
            ('workflow', 'task_approvals', 'workflow', 'task_approval', '任务审批记录', '流程任务审批人、决策、意见和上下文载荷', true, '["workflow","approval","audit"]'::jsonb),

            ('app_data', 'twin_sessions', 'digital_twin', 'twin_session', '数字孪生会话', '数字孪生助手会话上下文', true, '["digital_twin","session"]'::jsonb),
            ('app_data', 'twin_messages', 'digital_twin', 'twin_message', '数字孪生消息', '数字孪生会话中的用户与助手消息', true, '["digital_twin","message"]'::jsonb),
            ('app_data', 'twin_knowledge_files', 'digital_twin', 'knowledge_file', '孪生知识文件', '数字孪生知识库文件和解析状态', true, '["digital_twin","knowledge","file"]'::jsonb),
            ('app_data', 'twin_tool_logs', 'digital_twin', 'tool_log', '孪生工具日志', '数字孪生工具调用和执行结果日志', true, '["digital_twin","tool","audit"]'::jsonb),

            ('public', 'ontology_table_semantics', 'ontology', 'table_semantic', '表级本体语义', '数据表、业务表单和语义视图的本体目录', false, '["ontology","metadata","table"]'::jsonb),
            ('public', 'ontology_column_semantics', 'ontology', 'column_semantic', '字段级本体语义', '数据列、字段含义、UI 类型和敏感性标注目录', false, '["ontology","metadata","column"]'::jsonb)
    ) AS v(table_schema, table_name, semantic_domain, semantic_class, semantic_name, semantic_description, is_business, tags)
    WHERE to_regclass(format('%I.%I', v.table_schema, v.table_name)) IS NOT NULL
)
INSERT INTO public.ontology_table_semantics (
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags,
    is_active,
    updated_at
)
SELECT
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags,
    true,
    NOW()
FROM semantic_seed
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = EXCLUDED.is_business,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

CREATE OR REPLACE VIEW public.v_app_form_ontology AS
WITH app_base AS (
    SELECT
        a.id AS app_id,
        a.name::TEXT AS app_name,
        COALESCE(a.description, '')::TEXT AS app_description,
        COALESCE(a.app_type, '')::TEXT AS app_type,
        COALESCE(a.status, '')::TEXT AS status,
        COALESCE(a.icon, '')::TEXT AS icon,
        COALESCE(a.version, '')::TEXT AS version,
        a.category_id,
        COALESCE(a.config, '{}'::jsonb) AS config,
        NULLIF(TRIM(COALESCE(a.config ->> 'table', '')), '') AS raw_table_ref,
        COALESCE(NULLIF(TRIM(a.config ->> 'aclModule'), ''), 'app_' || replace(a.id::TEXT, '-', '')) AS acl_module,
        NULLIF(TRIM(a.config ->> 'perm'), '') AS permission_code,
        COALESCE(NULLIF(TRIM(a.config ->> 'permission_mode'), ''), 'compat') AS permission_mode,
        COALESCE(NULLIF(TRIM(a.config ->> 'semantics_mode'), ''), 'ai_defined') AS semantics_mode,
        a.created_at,
        a.updated_at
    FROM app_center.apps a
),
normalized AS (
    SELECT
        ab.*,
        CASE
            WHEN ab.raw_table_ref LIKE '%.%' THEN split_part(ab.raw_table_ref, '.', 1)
            WHEN ab.raw_table_ref IS NOT NULL AND ab.app_type = 'data' THEN 'app_data'
            ELSE NULL
        END AS table_schema,
        CASE
            WHEN ab.raw_table_ref LIKE '%.%' THEN split_part(ab.raw_table_ref, '.', 2)
            WHEN ab.raw_table_ref IS NOT NULL AND ab.app_type = 'data' THEN ab.raw_table_ref
            ELSE NULL
        END AS table_name
    FROM app_base ab
)
SELECT
    row_number() OVER (ORDER BY n.updated_at DESC, n.app_id)::BIGINT AS id,
    n.app_id,
    n.app_name,
    n.app_description,
    n.app_type,
    n.status,
    n.icon,
    n.version,
    n.category_id,
    n.acl_module,
    n.permission_code,
    p.name AS permission_name,
    n.permission_mode,
    n.semantics_mode,
    pr.route_path,
    n.table_schema,
    n.table_name,
    CASE
        WHEN n.table_schema IS NOT NULL AND n.table_name IS NOT NULL THEN n.table_schema || '.' || n.table_name
        ELSE NULL
    END AS qualified_table,
    COALESCE(ots.semantic_domain, CASE
        WHEN n.app_type = 'workflow' THEN 'workflow'
        WHEN n.app_type = 'data' THEN 'app_data'
        WHEN n.app_type = 'custom' THEN 'app_center'
        ELSE 'app_center'
    END) AS semantic_domain,
    CASE
        WHEN n.app_type = 'workflow' THEN 'workflow_app'
        WHEN n.app_type = 'data' THEN 'dynamic_data_app'
        WHEN n.app_type = 'custom' THEN 'custom_app'
        ELSE 'app_form'
    END AS semantic_class,
    n.app_name AS semantic_name,
    COALESCE(NULLIF(n.app_description, ''), ots.semantic_description, n.app_name) AS semantic_description,
    ots.semantic_class AS table_semantic_class,
    ots.semantic_name AS table_semantic_name,
    COALESCE(ots.is_business, n.app_type IN ('workflow', 'data')) AS is_business,
    wpp.permission_mode AS workflow_policy_mode,
    wpp.legacy_fallback_enabled,
    jsonb_build_array(
        'app_center',
        'business_form',
        'app_type:' || COALESCE(NULLIF(n.app_type, ''), 'unknown'),
        'semantics:' || n.semantics_mode,
        n.app_id::TEXT
    ) || COALESCE(ots.tags, '[]'::jsonb) AS tags,
    n.created_at,
    n.updated_at
FROM normalized n
LEFT JOIN public.ontology_table_semantics ots
  ON ots.table_schema = n.table_schema
 AND ots.table_name = n.table_name
 AND ots.is_active = true
LEFT JOIN public.permissions p
  ON p.code = n.permission_code
LEFT JOIN app_center.workflow_permission_policies wpp
  ON wpp.workflow_app_id = n.app_id
LEFT JOIN LATERAL (
    SELECT r.route_path
    FROM app_center.published_routes r
    WHERE r.app_id = n.app_id
      AND r.is_active = true
    ORDER BY r.route_path
    LIMIT 1
) pr ON true;

COMMENT ON VIEW public.v_app_form_ontology IS 'Ontology projection for App Center business forms and workflow/data apps';

CREATE OR REPLACE VIEW public.v_role_ontology AS
WITH role_permissions AS (
    SELECT
        r.id AS role_id,
        array_remove(array_agg(p.code ORDER BY p.code), NULL) AS permissions,
        COUNT(p.id)::INTEGER AS permission_count,
        array_remove(array_agg(DISTINCT po.semantic_kind ORDER BY po.semantic_kind), NULL) AS permission_semantic_kinds
    FROM public.roles r
    LEFT JOIN public.role_permissions rp
      ON rp.role_id = r.id
    LEFT JOIN public.permissions p
      ON p.id = rp.permission_id
    LEFT JOIN public.v_permission_ontology po
      ON po.code = p.code
    GROUP BY r.id
),
role_scopes AS (
    SELECT
        rds.role_id,
        jsonb_agg(
            jsonb_build_object(
                'module', rds.module,
                'scope_type', rds.scope_type,
                'dept_id', rds.dept_id,
                'dept_name', d.name
            )
            ORDER BY rds.module, rds.scope_type
        ) FILTER (WHERE rds.id IS NOT NULL) AS data_scopes
    FROM public.role_data_scopes rds
    LEFT JOIN public.departments d
      ON d.id = rds.dept_id
    GROUP BY rds.role_id
)
SELECT
    r.id,
    r.id AS role_id,
    r.code AS role_code,
    r.name AS role_name,
    COALESCE(r.description, '') AS role_description,
    r.dept_id,
    d.name AS dept_name,
    'acl'::TEXT AS semantic_domain,
    'role'::TEXT AS semantic_class,
    COALESCE(NULLIF(r.name, ''), r.code) AS semantic_name,
    COALESCE(NULLIF(r.description, ''), '角色 ' || r.code) AS semantic_description,
    COALESCE(rp.permissions, ARRAY[]::TEXT[]) AS permissions,
    COALESCE(rp.permission_count, 0) AS permission_count,
    COALESCE(rp.permission_semantic_kinds, ARRAY[]::TEXT[]) AS permission_semantic_kinds,
    COALESCE(rs.data_scopes, '[]'::jsonb) AS data_scopes,
    jsonb_build_array('acl', 'role', r.code) AS tags,
    r.sort,
    r.created_at,
    r.updated_at
FROM public.roles r
LEFT JOIN public.departments d
  ON d.id = r.dept_id
LEFT JOIN role_permissions rp
  ON rp.role_id = r.id
LEFT JOIN role_scopes rs
  ON rs.role_id = r.id;

COMMENT ON VIEW public.v_role_ontology IS 'Ontology projection for role entities, granted permissions, and data scopes';

CREATE OR REPLACE VIEW public.v_role_permission_ontology AS
SELECT
    row_number() OVER (ORDER BY r.code, p.code)::BIGINT AS id,
    r.id AS role_id,
    r.code AS role_code,
    r.name AS role_name,
    p.id AS permission_id,
    p.code AS permission_code,
    p.name AS permission_name,
    'acl:grantsPermission'::TEXT AS predicate,
    po.scope,
    po.entity_key,
    po.action_key,
    po.semantic_kind,
    po.transition_from,
    po.transition_to,
    rp.created_at,
    NULL::TIMESTAMPTZ AS updated_at
FROM public.roles r
JOIN public.role_permissions rp
  ON rp.role_id = r.id
JOIN public.permissions p
  ON p.id = rp.permission_id
LEFT JOIN public.v_permission_ontology po
  ON po.code = p.code;

COMMENT ON VIEW public.v_role_permission_ontology IS 'Ontology relation projection from roles to granted permissions';

CREATE OR REPLACE VIEW public.v_ontology_coverage_audit AS
WITH api_relations AS (
    SELECT
        n.nspname AS table_schema,
        c.relname AS table_name,
        c.relkind
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'v', 'm')
      AND n.nspname IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
      AND c.relname NOT LIKE 'pg_%'
),
relation_coverage AS (
    SELECT
        ar.*,
        ots.table_name AS semanticized_table
    FROM api_relations ar
    LEFT JOIN public.ontology_table_semantics ots
      ON ots.table_schema = ar.table_schema
     AND ots.table_name = ar.table_name
     AND ots.is_active = true
),
active_columns AS (
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN public.ontology_table_semantics ots
      ON ots.table_schema = c.table_schema
     AND ots.table_name = c.table_name
     AND ots.is_active = true
    WHERE c.table_schema IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
      AND ots.table_schema IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
),
column_coverage AS (
    SELECT
        ac.*,
        ocs.column_name AS semanticized_column
    FROM active_columns ac
    LEFT JOIN public.ontology_column_semantics ocs
      ON ocs.table_schema = ac.table_schema
     AND ocs.table_name = ac.table_name
     AND ocs.column_name = ac.column_name
     AND ocs.is_active = true
)
SELECT
    1::INTEGER AS id,
    (SELECT COUNT(*) FROM relation_coverage)::INTEGER AS api_relations,
    (SELECT COUNT(*) FROM relation_coverage WHERE semanticized_table IS NOT NULL)::INTEGER AS semanticized_relations,
    (SELECT COUNT(*) FROM relation_coverage WHERE semanticized_table IS NULL)::INTEGER AS missing_relation_semantics,
    (SELECT COUNT(*) FROM column_coverage)::INTEGER AS ontology_columns,
    (SELECT COUNT(*) FROM column_coverage WHERE semanticized_column IS NOT NULL)::INTEGER AS semanticized_columns,
    (SELECT COUNT(*) FROM column_coverage WHERE semanticized_column IS NULL)::INTEGER AS missing_column_semantics,
    (SELECT COUNT(*) FROM app_center.apps)::INTEGER AS app_rows,
    (SELECT COUNT(*) FROM public.v_app_form_ontology)::INTEGER AS app_form_ontology_rows,
    (SELECT COUNT(*) FROM public.roles)::INTEGER AS role_rows,
    (SELECT COUNT(*) FROM public.v_role_ontology)::INTEGER AS role_ontology_rows,
    (SELECT COUNT(*) FROM public.permissions)::INTEGER AS permission_rows,
    (SELECT COUNT(*) FROM public.v_permission_ontology)::INTEGER AS permission_ontology_rows;

COMMENT ON VIEW public.v_ontology_coverage_audit IS 'Ontology coverage audit for API relations, columns, app forms, roles, and permissions';

WITH view_seed AS (
    SELECT *
    FROM (
        VALUES
            ('public', 'v_app_form_ontology', 'ontology', 'app_form_projection', '业务表单语义投影', '应用中心业务表单、流程应用与底层业务表的语义投影', false, '["ontology","projection","app_form"]'::jsonb),
            ('public', 'v_role_ontology', 'ontology', 'role_projection', '角色语义投影', '角色实体、授权集合和数据范围的语义投影', false, '["ontology","projection","role"]'::jsonb),
            ('public', 'v_role_permission_ontology', 'ontology', 'role_permission_projection', '角色授权语义关系', '角色到权限语义实体的授权关系投影', false, '["ontology","projection","acl"]'::jsonb),
            ('public', 'v_ontology_coverage_audit', 'ontology', 'coverage_audit', '本体覆盖率审计', 'API 关系对象、字段、业务表单、角色和权限的本体覆盖率审计', false, '["ontology","projection","audit"]'::jsonb),
            ('public', 'v_permission_ontology', 'ontology', 'permission_projection', '权限语义投影', '权限码解析后的模块、应用、操作和状态迁移语义', false, '["ontology","projection","permission"]'::jsonb),
            ('public', 'v_role_permissions', 'system', 'role_permission_summary', '角色权限汇总', '角色拥有权限码的数组汇总视图', false, '["system","acl","summary"]'::jsonb)
    ) AS v(table_schema, table_name, semantic_domain, semantic_class, semantic_name, semantic_description, is_business, tags)
    WHERE to_regclass(format('%I.%I', v.table_schema, v.table_name)) IS NOT NULL
)
INSERT INTO public.ontology_table_semantics (
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags,
    is_active,
    updated_at
)
SELECT
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags,
    true,
    NOW()
FROM view_seed
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = EXCLUDED.is_business,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

WITH api_relations AS (
    SELECT
        n.nspname AS table_schema,
        c.relname AS table_name,
        c.relkind,
        CASE
            WHEN n.nspname = 'hr' THEN 'hr'
            WHEN n.nspname = 'scm' THEN
                CASE
                    WHEN c.relname LIKE '%production%' THEN 'production'
                    WHEN c.relname LIKE '%inventory%' THEN 'mms'
                    WHEN c.relname LIKE '%bom%' THEN 'mms'
                    ELSE 'mms'
                END
            WHEN n.nspname = 'app_data' THEN
                CASE
                    WHEN c.relname LIKE '%twin%' THEN 'digital_twin'
                    WHEN c.relname LIKE '%ontology%' THEN 'ontology'
                    ELSE 'app_data'
                END
            WHEN n.nspname = 'public' THEN
                CASE
                    WHEN c.relname LIKE '%role%' THEN 'acl'
                    WHEN c.relname LIKE '%user%' THEN 'account'
                    WHEN c.relname LIKE '%bom%' THEN 'mms'
                    WHEN c.relname LIKE '%purchase%' THEN 'purchase'
                    WHEN c.relname LIKE '%field%' THEN 'system'
                    WHEN c.relname LIKE '%dict%' THEN 'system'
                    WHEN c.relname LIKE 'debug%' THEN 'system'
                    ELSE 'general'
                END
            ELSE n.nspname
        END AS semantic_domain,
        CASE
            WHEN c.relkind = 'r' THEN regexp_replace(c.relname, '[^a-z0-9_]+', '_', 'g') || '_table'
            WHEN c.relkind = 'm' THEN 'materialized_view'
            WHEN c.relname LIKE 'v_%' THEN regexp_replace(substring(c.relname FROM 3), '[^a-z0-9_]+', '_', 'g') || '_view'
            ELSE regexp_replace(c.relname, '[^a-z0-9_]+', '_', 'g') || '_view'
        END AS semantic_class,
        CASE c.relname
            WHEN 'ontology_table_relations' THEN '本体表关系'
            WHEN 'v_twin_overview' THEN '数字孪生概览'
            WHEN 'v_attendance_daily' THEN '每日考勤视图'
            WHEN 'v_attendance_monthly' THEN '月度考勤视图'
            WHEN 'debug_me' THEN '调试上下文'
            WHEN 'v_bom_explosion' THEN 'BOM 展开视图'
            WHEN 'v_bom_items' THEN 'BOM 明细视图'
            WHEN 'v_boms' THEN 'BOM 主数据视图'
            WHEN 'v_field_labels' THEN '字段标签视图'
            WHEN 'v_purchase_order_progress' THEN '采购订单进度'
            WHEN 'v_role_data_scopes_matrix' THEN '角色数据范围矩阵'
            WHEN 'v_role_permissions_matrix' THEN '角色权限矩阵'
            WHEN 'v_roles_manage' THEN '角色管理视图'
            WHEN 'v_sys_dict_items' THEN '字典项视图'
            WHEN 'v_users_manage' THEN '用户管理视图'
            WHEN 'v_inventory_current' THEN '当前库存视图'
            WHEN 'v_inventory_drafts' THEN '库存草稿视图'
            WHEN 'v_inventory_transactions' THEN '库存流水视图'
            WHEN 'v_production_work_order_items' THEN '生产工单用料视图'
            WHEN 'v_production_work_orders' THEN '生产工单视图'
            ELSE format('语义%s %s.%s', CASE WHEN c.relkind = 'r' THEN '表' ELSE '视图' END, n.nspname, c.relname)
        END AS semantic_name,
        format('API schema %s.%s 关系的本体语义投影', n.nspname, c.relname) AS semantic_description,
        (c.relkind = 'r' AND n.nspname IN ('hr', 'scm', 'app_data')) AS is_business,
        jsonb_build_array(
            'ontology',
            CASE
                WHEN c.relkind = 'r' THEN 'table'
                WHEN c.relkind = 'm' THEN 'materialized_view'
                ELSE 'view'
            END,
            n.nspname,
            c.relname
        ) AS tags
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'v', 'm')
      AND n.nspname IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
      AND c.relname NOT LIKE 'pg_%'
),
missing_relations AS (
    SELECT ar.*
    FROM api_relations ar
    LEFT JOIN public.ontology_table_semantics ots
      ON ots.table_schema = ar.table_schema
     AND ots.table_name = ar.table_name
     AND ots.is_active = true
    WHERE ots.table_name IS NULL
)
INSERT INTO public.ontology_table_semantics (
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags,
    is_active,
    updated_at
)
SELECT
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    tags,
    true,
    NOW()
FROM missing_relations
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = EXCLUDED.is_business,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

WITH covered_relations AS (
    SELECT table_schema, table_name
    FROM public.ontology_table_semantics
    WHERE is_active = true
      AND to_regclass(format('%I.%I', table_schema, table_name)) IS NOT NULL
),
column_source AS (
    SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        ots.semantic_name AS table_semantic_name,
        CASE
            WHEN c.column_name ~* '(status|state|type|category|level|mode|kind|decision)$' THEN 'enum_attribute'
            WHEN c.column_name ~* '(parent|tree|path|dept|org|hierarch)' THEN 'hierarchy_attribute'
            WHEN c.column_name ~* '(lng|lat|longitude|latitude|geo|location|address|region)' THEN 'geo_attribute'
            WHEN c.column_name ~* '(file|attachment|image|avatar|photo|document|xml|bpmn)' THEN 'file_attribute'
            WHEN c.column_name ~* '(amount|qty|quantity|total|score|rate|percent|ratio|count|num|price|balance|limit|probability|days)$' THEN 'derived_metric'
            ELSE 'business_attribute'
        END AS semantic_class,
        CASE
            WHEN c.column_name = 'id' THEN '主键标识'
            WHEN c.column_name = 'created_at' THEN '创建时间'
            WHEN c.column_name = 'updated_at' THEN '更新时间'
            WHEN c.column_name = 'created_by' THEN '创建人'
            WHEN c.column_name = 'updated_by' THEN '更新人'
            WHEN c.column_name = 'role_id' THEN '角色标识'
            WHEN c.column_name = 'permission_id' THEN '权限标识'
            WHEN c.column_name = 'workflow_app_id' THEN '流程应用标识'
            WHEN c.column_name = 'instance_id' THEN '流程实例标识'
            WHEN c.column_name = 'definition_id' THEN '流程定义标识'
            WHEN c.column_name ~* '_id$' THEN c.column_name || '（关联标识）'
            WHEN c.column_name ~* '_no$' THEN c.column_name || '（业务编号）'
            ELSE c.column_name
        END AS semantic_name,
        CASE
            WHEN c.udt_name IN ('json', 'jsonb') THEN 'json'
            WHEN c.data_type IN ('timestamp without time zone', 'timestamp with time zone') THEN 'datetime'
            WHEN c.data_type = 'date' THEN 'date'
            WHEN c.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision', 'decimal') THEN 'number'
            WHEN c.data_type = 'boolean' THEN 'boolean'
            WHEN c.data_type LIKE 'ARRAY%' OR c.udt_name LIKE '\_%' THEN 'array'
            ELSE 'text'
        END AS ui_type,
        (
            c.column_name ~* '(phone|mobile|email|idcard|id_no|identity|bank|account|salary|wage|address|token|secret|password|credential|birthday|birth|contact|wechat|qq)'
        ) AS is_sensitive
    FROM information_schema.columns c
    JOIN covered_relations cr
      ON cr.table_schema = c.table_schema
     AND cr.table_name = c.table_name
    JOIN public.ontology_table_semantics ots
      ON ots.table_schema = c.table_schema
     AND ots.table_name = c.table_name
)
INSERT INTO public.ontology_column_semantics (
    table_schema,
    table_name,
    column_name,
    semantic_class,
    semantic_name,
    semantic_description,
    data_type,
    ui_type,
    is_sensitive,
    source,
    tags,
    is_active,
    updated_at
)
SELECT
    cs.table_schema,
    cs.table_name,
    cs.column_name,
    cs.semantic_class,
    cs.semantic_name,
    format('%s.%s 字段“%s”语义自动回填', cs.table_schema, cs.table_name, cs.semantic_name),
    cs.data_type,
    cs.ui_type,
    cs.is_sensitive,
    'ontology_coverage_v2',
    jsonb_build_array(
        'ontology_coverage_v2',
        'column',
        cs.semantic_class,
        cs.table_schema || '.' || cs.table_name
    ),
    true,
    NOW()
FROM column_source cs
ON CONFLICT (table_schema, table_name, column_name) DO UPDATE
SET semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    data_type = EXCLUDED.data_type,
    ui_type = EXCLUDED.ui_type,
    is_sensitive = EXCLUDED.is_sensitive,
    source = EXCLUDED.source,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

GRANT SELECT ON public.ontology_table_semantics TO web_user;
GRANT SELECT ON public.ontology_column_semantics TO web_user;
GRANT SELECT ON public.v_app_form_ontology TO web_user;
GRANT SELECT ON public.v_role_ontology TO web_user;
GRANT SELECT ON public.v_role_permission_ontology TO web_user;
GRANT SELECT ON public.v_ontology_coverage_audit TO web_user;
GRANT SELECT ON public.v_permission_ontology TO web_user;
GRANT SELECT ON public.v_role_permissions TO web_user;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

-- Validation summary
WITH api_relations AS (
    SELECT
        n.nspname AS table_schema,
        c.relname AS table_name,
        c.relkind
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'v', 'm')
      AND n.nspname IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
      AND c.relname NOT LIKE 'pg_%'
),
relation_coverage AS (
    SELECT
        ar.*,
        ots.table_name AS semanticized_table
    FROM api_relations ar
    LEFT JOIN public.ontology_table_semantics ots
      ON ots.table_schema = ar.table_schema
     AND ots.table_name = ar.table_name
     AND ots.is_active = true
),
active_columns AS (
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN public.ontology_table_semantics ots
      ON ots.table_schema = c.table_schema
     AND ots.table_name = c.table_name
     AND ots.is_active = true
    WHERE c.table_schema IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
      AND ots.table_schema IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
),
column_coverage AS (
    SELECT
        ac.*,
        ocs.column_name AS semanticized_column
    FROM active_columns ac
    LEFT JOIN public.ontology_column_semantics ocs
      ON ocs.table_schema = ac.table_schema
     AND ocs.table_name = ac.table_name
     AND ocs.column_name = ac.column_name
     AND ocs.is_active = true
)
SELECT
    COUNT(*) AS api_relations,
    COUNT(*) FILTER (WHERE semanticized_table IS NOT NULL) AS semanticized_relations,
    COUNT(*) FILTER (WHERE semanticized_table IS NULL) AS missing_relation_semantics,
    (SELECT COUNT(*) FROM column_coverage) AS ontology_columns,
    (SELECT COUNT(*) FROM column_coverage WHERE semanticized_column IS NOT NULL) AS semanticized_columns,
    (SELECT COUNT(*) FROM column_coverage WHERE semanticized_column IS NULL) AS missing_column_semantics
FROM relation_coverage;
