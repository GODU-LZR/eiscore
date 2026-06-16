-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: ontology reasoning engine V1.
--
-- Safety boundary:
--   1) Reads existing ontology / ACL / workflow metadata.
--   2) Writes only public.ontology_inference_rules,
--      public.ontology_inferred_facts, public.ontology_reasoning_runs.
--   3) Does not change existing business tables, RLS policies, workflow runtime,
--      ACL decisions, or App Center write paths.
--
-- Execute:
--   cat sql/patch_ontology_reasoning_engine_v1.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ontology_inference_rules (
    rule_code TEXT PRIMARY KEY,
    rule_name TEXT NOT NULL,
    inference_stage TEXT NOT NULL DEFAULT 'rule',
    rule_kind TEXT NOT NULL DEFAULT 'sql',
    predicate TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ontology_inference_rules_stage_check
        CHECK (inference_stage IN ('seed', 'rule', 'closure', 'diagnostic')),
    CONSTRAINT ontology_inference_rules_kind_check
        CHECK (rule_kind IN ('sql', 'recursive_sql', 'diagnostic'))
);

CREATE TABLE IF NOT EXISTS public.ontology_reasoning_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    max_depth INTEGER NOT NULL DEFAULT 3,
    facts_inserted INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_by TEXT NOT NULL DEFAULT current_user,
    CONSTRAINT ontology_reasoning_runs_status_check
        CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.ontology_inferred_facts (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.ontology_reasoning_runs(run_id) ON DELETE CASCADE,
    fact_key TEXT NOT NULL UNIQUE,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    subject_label TEXT NOT NULL DEFAULT '',
    predicate TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    object_label TEXT NOT NULL DEFAULT '',
    fact_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    inference_rule TEXT REFERENCES public.ontology_inference_rules(rule_code) ON DELETE SET NULL,
    inference_depth INTEGER NOT NULL DEFAULT 0,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_inferred BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ontology_inferred_facts_subject
    ON public.ontology_inferred_facts(subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_ontology_inferred_facts_predicate
    ON public.ontology_inferred_facts(predicate);

CREATE INDEX IF NOT EXISTS idx_ontology_inferred_facts_object
    ON public.ontology_inferred_facts(object_type, object_id);

CREATE INDEX IF NOT EXISTS idx_ontology_inferred_facts_run
    ON public.ontology_inferred_facts(run_id);

CREATE OR REPLACE FUNCTION public.ontology_fact_key(
    p_subject_type TEXT,
    p_subject_id TEXT,
    p_predicate TEXT,
    p_object_type TEXT,
    p_object_id TEXT,
    p_inference_rule TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT md5(concat_ws(
        '|',
        COALESCE(p_subject_type, ''),
        COALESCE(p_subject_id, ''),
        COALESCE(p_predicate, ''),
        COALESCE(p_object_type, ''),
        COALESCE(p_object_id, ''),
        COALESCE(p_inference_rule, '')
    ));
$$;

INSERT INTO public.ontology_inference_rules (
    rule_code,
    rule_name,
    inference_stage,
    rule_kind,
    predicate,
    description,
    config,
    priority,
    is_active,
    updated_at
)
VALUES
    ('seed_table_type', '表对象类型种子', 'seed', 'sql', 'rdf:type', '从 ontology_table_semantics 生成表对象类型事实', '{"source":"ontology_table_semantics"}'::jsonb, 10, true, NOW()),
    ('seed_table_domain', '表业务域种子', 'seed', 'sql', 'ontology:hasDomain', '从 ontology_table_semantics 生成表业务域事实', '{"source":"ontology_table_semantics"}'::jsonb, 11, true, NOW()),
    ('seed_column_belongs', '字段归属种子', 'seed', 'sql', 'ontology:belongsTo', '从 ontology_column_semantics 生成字段归属事实', '{"source":"ontology_column_semantics"}'::jsonb, 12, true, NOW()),
    ('seed_sensitive_column', '敏感字段种子', 'seed', 'sql', 'data:hasSensitiveColumn', '从 ontology_column_semantics 生成敏感字段事实', '{"source":"ontology_column_semantics"}'::jsonb, 13, true, NOW()),
    ('seed_table_relation', '表关系种子', 'seed', 'sql', 'ontology:relation', '从 ontology_table_relations 生成表间关系事实', '{"source":"app_data.ontology_table_relations"}'::jsonb, 20, true, NOW()),
    ('seed_app_table', '应用表单到业务表种子', 'seed', 'sql', 'app:usesTable', '从 v_app_form_ontology 生成应用到业务表事实', '{"source":"v_app_form_ontology"}'::jsonb, 30, true, NOW()),
    ('seed_app_permission', '应用表单权限种子', 'seed', 'sql', 'acl:requiresPermission', '从 v_app_form_ontology 生成应用入口权限事实', '{"source":"v_app_form_ontology"}'::jsonb, 31, true, NOW()),
    ('seed_permission_kind', '权限类型种子', 'seed', 'sql', 'rdf:type', '从 v_permission_ontology 生成权限语义类型事实', '{"source":"v_permission_ontology"}'::jsonb, 32, true, NOW()),
    ('seed_role_permission', '角色授权种子', 'seed', 'sql', 'acl:grantsPermission', '从 v_role_permission_ontology 生成角色授权事实', '{"source":"v_role_permission_ontology"}'::jsonb, 40, true, NOW()),
    ('infer_role_can_access_app', '角色可访问应用推理', 'rule', 'sql', 'acl:canAccessApp', '角色拥有应用入口权限时，推理为可访问该应用', '{"requires":["seed_app_permission","seed_role_permission"]}'::jsonb, 100, true, NOW()),
    ('infer_role_can_operate_app_action', '角色可执行应用动作推理', 'rule', 'sql', 'acl:canOperateAppAction', '角色拥有 op:{aclModule}.{action} 权限时，推理为可执行应用动作', '{"requires":["seed_role_permission","v_app_form_ontology"]}'::jsonb, 110, true, NOW()),
    ('infer_role_can_access_table', '角色可访问业务表推理', 'rule', 'sql', 'acl:canAccessTable', '角色可访问应用且应用绑定业务表时，推理为可访问该业务表', '{"requires":["infer_role_can_access_app","seed_app_table"]}'::jsonb, 120, true, NOW()),
    ('infer_role_can_operate_table', '角色可操作业务表推理', 'rule', 'sql', 'acl:canOperateTable', '角色可执行应用动作且应用绑定业务表时，推理为可操作该业务表', '{"requires":["infer_role_can_operate_app_action","seed_app_table"]}'::jsonb, 121, true, NOW()),
    ('infer_workflow_transition', '流程迁移授权推理', 'rule', 'sql', 'wf:canPerformTransition', '角色拥有显式迁移规则要求的权限时，推理为可执行该流程迁移', '{"requires":["workflow_transition_rules","seed_role_permission"]}'::jsonb, 130, true, NOW()),
    ('infer_sensitive_column_exposure', '敏感字段可达性推理', 'diagnostic', 'diagnostic', 'risk:canAccessSensitiveColumn', '角色可访问或操作含敏感字段的表时，推理敏感字段可达性', '{"requires":["infer_role_can_access_table","seed_sensitive_column"]}'::jsonb, 200, true, NOW()),
    ('infer_transitive_dependency', '传递依赖闭包推理', 'closure', 'recursive_sql', 'ontology:transitivelyDependsOn', '基于 ontology:dependsOn 生成表间传递依赖闭包', '{"max_depth_default":4}'::jsonb, 300, true, NOW())
ON CONFLICT (rule_code) DO UPDATE
SET rule_name = EXCLUDED.rule_name,
    inference_stage = EXCLUDED.inference_stage,
    rule_kind = EXCLUDED.rule_kind,
    predicate = EXCLUDED.predicate,
    description = EXCLUDED.description,
    config = EXCLUDED.config,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.refresh_ontology_inferences(
    p_max_depth INTEGER DEFAULT 4
)
RETURNS TABLE(run_id UUID, facts_inserted INTEGER, max_depth INTEGER, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
DECLARE
    v_run_id UUID := gen_random_uuid();
    v_max_depth INTEGER := LEAST(GREATEST(COALESCE(p_max_depth, 4), 0), 8);
    v_depth INTEGER;
    v_delta INTEGER;
    v_claims_text TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
    v_claims JSONB := '{}'::jsonb;
    v_app_role TEXT := '';
BEGIN
    IF v_claims_text IS NOT NULL THEN
        v_claims := v_claims_text::jsonb;
        v_app_role := COALESCE(NULLIF(v_claims ->> 'app_role', ''), NULLIF(current_setting('request.jwt.claim.app_role', true), ''));
        IF COALESCE(v_app_role, '') <> 'super_admin' THEN
            RAISE EXCEPTION 'ontology reasoning refresh requires super_admin'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    INSERT INTO public.ontology_reasoning_runs(run_id, max_depth, status)
    VALUES (v_run_id, v_max_depth, 'running');

    DELETE FROM public.ontology_inferred_facts;

    -- Table semantic type/domain facts.
    WITH facts AS (
        SELECT
            'table'::TEXT AS subject_type,
            ots.table_schema || '.' || ots.table_name AS subject_id,
            COALESCE(NULLIF(ots.semantic_name, ''), ots.table_schema || '.' || ots.table_name) AS subject_label,
            'rdf:type'::TEXT AS predicate,
            'semantic_class'::TEXT AS object_type,
            ots.semantic_class AS object_id,
            ots.semantic_class AS object_label,
            'seed_table_type'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object(
                'table_schema', ots.table_schema,
                'table_name', ots.table_name,
                'semantic_domain', ots.semantic_domain,
                'is_business', ots.is_business
            ) AS evidence
        FROM public.ontology_table_semantics ots
        WHERE ots.is_active = true
        UNION ALL
        SELECT
            'table',
            ots.table_schema || '.' || ots.table_name,
            COALESCE(NULLIF(ots.semantic_name, ''), ots.table_schema || '.' || ots.table_name),
            'ontology:hasDomain',
            'semantic_domain',
            ots.semantic_domain,
            ots.semantic_domain,
            'seed_table_domain',
            false,
            jsonb_build_object(
                'table_schema', ots.table_schema,
                'table_name', ots.table_name,
                'semantic_class', ots.semantic_class
            )
        FROM public.ontology_table_semantics ots
        WHERE ots.is_active = true
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Column semantic facts.
    WITH facts AS (
        SELECT
            'column'::TEXT AS subject_type,
            ocs.table_schema || '.' || ocs.table_name || '.' || ocs.column_name AS subject_id,
            COALESCE(NULLIF(ocs.semantic_name, ''), ocs.column_name) AS subject_label,
            'ontology:belongsTo'::TEXT AS predicate,
            'table'::TEXT AS object_type,
            ocs.table_schema || '.' || ocs.table_name AS object_id,
            COALESCE(NULLIF(ots.semantic_name, ''), ocs.table_schema || '.' || ocs.table_name) AS object_label,
            'seed_column_belongs'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object(
                'column_name', ocs.column_name,
                'semantic_class', ocs.semantic_class,
                'data_type', ocs.data_type,
                'ui_type', ocs.ui_type,
                'is_sensitive', ocs.is_sensitive
            ) AS evidence
        FROM public.ontology_column_semantics ocs
        JOIN public.ontology_table_semantics ots
          ON ots.table_schema = ocs.table_schema
         AND ots.table_name = ocs.table_name
         AND ots.is_active = true
        WHERE ocs.is_active = true
        UNION ALL
        SELECT
            'table',
            ocs.table_schema || '.' || ocs.table_name,
            COALESCE(NULLIF(ots.semantic_name, ''), ocs.table_schema || '.' || ocs.table_name),
            'data:hasSensitiveColumn',
            'column',
            ocs.table_schema || '.' || ocs.table_name || '.' || ocs.column_name,
            COALESCE(NULLIF(ocs.semantic_name, ''), ocs.column_name),
            'seed_sensitive_column',
            false,
            jsonb_build_object(
                'column_name', ocs.column_name,
                'semantic_class', ocs.semantic_class,
                'data_type', ocs.data_type,
                'ui_type', ocs.ui_type
            )
        FROM public.ontology_column_semantics ocs
        JOIN public.ontology_table_semantics ots
          ON ots.table_schema = ocs.table_schema
         AND ots.table_name = ocs.table_name
         AND ots.is_active = true
        WHERE ocs.is_active = true
          AND ocs.is_sensitive = true
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Existing ontology/fk relation facts.
    WITH facts AS (
        SELECT
            'table'::TEXT AS subject_type,
            rel.subject_table AS subject_id,
            COALESCE(NULLIF(rel.subject_semantic_name, ''), rel.subject_table) AS subject_label,
            rel.predicate,
            'table'::TEXT AS object_type,
            rel.object_table AS object_id,
            COALESCE(NULLIF(rel.object_semantic_name, ''), rel.object_table) AS object_label,
            'seed_table_relation'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object(
                'relation_type', rel.relation_type,
                'subject_column', rel.subject_column,
                'object_column', rel.object_column,
                'bridge_table', rel.bridge_table,
                'details', rel.details,
                'is_business_relation', rel.is_business_relation
            ) AS evidence
        FROM app_data.ontology_table_relations rel
        WHERE COALESCE(rel.subject_table, '') <> ''
          AND COALESCE(rel.object_table, '') <> ''
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- App / permission / role facts.
    WITH facts AS (
        SELECT
            'app'::TEXT AS subject_type,
            app.app_id::TEXT AS subject_id,
            app.app_name AS subject_label,
            'app:usesTable'::TEXT AS predicate,
            'table'::TEXT AS object_type,
            app.qualified_table AS object_id,
            COALESCE(NULLIF(app.table_semantic_name, ''), app.qualified_table) AS object_label,
            'seed_app_table'::TEXT AS inference_rule,
            false AS is_inferred,
            jsonb_build_object('app_type', app.app_type, 'acl_module', app.acl_module, 'route_path', app.route_path) AS evidence
        FROM public.v_app_form_ontology app
        WHERE COALESCE(app.qualified_table, '') <> ''
        UNION ALL
        SELECT
            'app',
            app.app_id::TEXT,
            app.app_name,
            'acl:requiresPermission',
            'permission',
            app.permission_code,
            COALESCE(NULLIF(app.permission_name, ''), app.permission_code),
            'seed_app_permission',
            false,
            jsonb_build_object('acl_module', app.acl_module, 'permission_mode', app.permission_mode, 'app_type', app.app_type)
        FROM public.v_app_form_ontology app
        WHERE COALESCE(app.permission_code, '') <> ''
        UNION ALL
        SELECT
            'permission',
            po.code,
            COALESCE(NULLIF(po.name, ''), po.code),
            'rdf:type',
            'permission_kind',
            po.semantic_kind,
            po.semantic_kind,
            'seed_permission_kind',
            false,
            jsonb_build_object(
                'scope', po.scope,
                'entity_key', po.entity_key,
                'action_key', po.action_key,
                'transition_from', po.transition_from,
                'transition_to', po.transition_to
            )
        FROM public.v_permission_ontology po
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:grantsPermission',
            'permission',
            rp.permission_code,
            COALESCE(NULLIF(rp.permission_name, ''), rp.permission_code),
            'seed_role_permission',
            false,
            jsonb_build_object(
                'semantic_kind', rp.semantic_kind,
                'entity_key', rp.entity_key,
                'action_key', rp.action_key,
                'transition_from', rp.transition_from,
                'transition_to', rp.transition_to
            )
        FROM public.v_role_permission_ontology rp
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Role-to-app/table/action inference.
    WITH facts AS (
        SELECT
            'role'::TEXT AS subject_type,
            rp.role_code AS subject_id,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code) AS subject_label,
            'acl:canAccessApp'::TEXT AS predicate,
            'app'::TEXT AS object_type,
            app.app_id::TEXT AS object_id,
            app.app_name AS object_label,
            'infer_role_can_access_app'::TEXT AS inference_rule,
            true AS is_inferred,
            jsonb_build_object('permission_code', rp.permission_code, 'app_name', app.app_name, 'acl_module', app.acl_module) AS evidence
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.permission_code = rp.permission_code
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:canOperateAppAction',
            'app_action',
            app.app_id::TEXT || ':' || COALESCE(NULLIF(rp.action_key, ''), rp.semantic_kind),
            app.app_name || ':' || COALESCE(NULLIF(rp.action_key, ''), rp.semantic_kind),
            'infer_role_can_operate_app_action',
            true,
            jsonb_build_object(
                'permission_code', rp.permission_code,
                'app_id', app.app_id,
                'app_name', app.app_name,
                'acl_module', app.acl_module,
                'action_key', rp.action_key,
                'semantic_kind', rp.semantic_kind
            )
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.acl_module = rp.entity_key
        WHERE rp.semantic_kind IN ('operation', 'workflow', 'status_transition')
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:canAccessTable',
            'table',
            app.qualified_table,
            COALESCE(NULLIF(app.table_semantic_name, ''), app.qualified_table),
            'infer_role_can_access_table',
            true,
            jsonb_build_object('permission_code', rp.permission_code, 'app_id', app.app_id, 'app_name', app.app_name)
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.permission_code = rp.permission_code
        WHERE COALESCE(app.qualified_table, '') <> ''
        UNION ALL
        SELECT
            'role',
            rp.role_code,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code),
            'acl:canOperateTable',
            'table',
            app.qualified_table,
            COALESCE(NULLIF(app.table_semantic_name, ''), app.qualified_table),
            'infer_role_can_operate_table',
            true,
            jsonb_build_object(
                'permission_code', rp.permission_code,
                'app_id', app.app_id,
                'app_name', app.app_name,
                'action_key', rp.action_key,
                'semantic_kind', rp.semantic_kind
            )
        FROM public.v_role_permission_ontology rp
        JOIN public.v_app_form_ontology app
          ON app.acl_module = rp.entity_key
        WHERE rp.semantic_kind IN ('operation', 'workflow', 'status_transition')
          AND COALESCE(app.qualified_table, '') <> ''
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Workflow transition inference.
    WITH facts AS (
        SELECT
            'role'::TEXT AS subject_type,
            rp.role_code AS subject_id,
            COALESCE(NULLIF(rp.role_name, ''), rp.role_code) AS subject_label,
            'wf:canPerformTransition'::TEXT AS predicate,
            'workflow_transition'::TEXT AS object_type,
            tr.workflow_app_id::TEXT || ':' ||
                COALESCE(NULLIF(tr.from_task_id, ''), COALESCE(tr.from_state, '*')) || '->' ||
                COALESCE(NULLIF(tr.to_task_id, ''), COALESCE(tr.to_state, '*')) AS object_id,
            app.app_name || ':' ||
                COALESCE(NULLIF(tr.from_state, ''), COALESCE(tr.from_task_id, '*')) || ' -> ' ||
                COALESCE(NULLIF(tr.to_state, ''), COALESCE(tr.to_task_id, '*')) AS object_label,
            'infer_workflow_transition'::TEXT AS inference_rule,
            true AS is_inferred,
            jsonb_build_object(
                'workflow_app_id', tr.workflow_app_id,
                'app_name', app.app_name,
                'from_task_id', tr.from_task_id,
                'to_task_id', tr.to_task_id,
                'from_state', tr.from_state,
                'to_state', tr.to_state,
                'required_permission', tr.required_permission
            ) AS evidence
        FROM app_center.workflow_transition_rules tr
        JOIN public.v_app_form_ontology app
          ON app.app_id = tr.workflow_app_id
        JOIN public.v_role_permission_ontology rp
          ON rp.permission_code = tr.required_permission
        WHERE tr.is_active = true
          AND COALESCE(tr.required_permission, '') <> ''
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Sensitive exposure diagnostics.
    WITH facts AS (
        SELECT
            access.subject_type,
            access.subject_id,
            access.subject_label,
            'risk:canAccessSensitiveColumn'::TEXT AS predicate,
            sensitive.object_type,
            sensitive.object_id,
            sensitive.object_label,
            'infer_sensitive_column_exposure'::TEXT AS inference_rule,
            true AS is_inferred,
            jsonb_build_object(
                'table', access.object_id,
                'access_predicate', access.predicate,
                'access_rule', access.inference_rule,
                'sensitive_column', sensitive.object_id,
                'sensitive_column_label', sensitive.object_label
            ) AS evidence
        FROM public.ontology_inferred_facts access
        JOIN public.ontology_inferred_facts sensitive
          ON sensitive.subject_type = 'table'
         AND sensitive.subject_id = access.object_id
         AND sensitive.predicate = 'data:hasSensitiveColumn'
        WHERE access.run_id = v_run_id
          AND sensitive.run_id = v_run_id
          AND access.subject_type = 'role'
          AND access.object_type = 'table'
          AND access.predicate IN ('acl:canAccessTable', 'acl:canOperateTable')
    )
    INSERT INTO public.ontology_inferred_facts (
        run_id, fact_key, subject_type, subject_id, subject_label,
        predicate, object_type, object_id, object_label,
        inference_rule, is_inferred, evidence
    )
    SELECT
        v_run_id,
        public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
        subject_type,
        subject_id,
        subject_label,
        predicate,
        object_type,
        object_id,
        object_label,
        inference_rule,
        is_inferred,
        evidence
    FROM facts
    WHERE EXISTS (
        SELECT 1 FROM public.ontology_inference_rules r
        WHERE r.rule_code = facts.inference_rule AND r.is_active = true
    )
    ON CONFLICT (fact_key) DO NOTHING;

    -- Transitive dependency closure.
    IF EXISTS (
        SELECT 1 FROM public.ontology_inference_rules
        WHERE rule_code = 'infer_transitive_dependency' AND is_active = true
    ) THEN
        FOR v_depth IN 1..v_max_depth LOOP
            WITH facts AS (
                SELECT
                    prior.subject_type,
                    prior.subject_id,
                    prior.subject_label,
                    'ontology:transitivelyDependsOn'::TEXT AS predicate,
                    direct.object_type,
                    direct.object_id,
                    direct.object_label,
                    'infer_transitive_dependency'::TEXT AS inference_rule,
                    true AS is_inferred,
                    jsonb_build_object(
                        'via', prior.object_id,
                        'prior_fact_id', prior.id,
                        'direct_fact_id', direct.id,
                        'depth', v_depth
                    ) AS evidence
                FROM public.ontology_inferred_facts prior
                JOIN public.ontology_inferred_facts direct
                  ON direct.subject_type = prior.object_type
                 AND direct.subject_id = prior.object_id
                 AND direct.predicate = 'ontology:dependsOn'
                 AND direct.object_type = 'table'
                WHERE prior.run_id = v_run_id
                  AND direct.run_id = v_run_id
                  AND prior.subject_type = 'table'
                  AND prior.object_type = 'table'
                  AND prior.predicate IN ('ontology:dependsOn', 'ontology:transitivelyDependsOn')
                  AND prior.subject_id <> direct.object_id
            )
            INSERT INTO public.ontology_inferred_facts (
                run_id, fact_key, subject_type, subject_id, subject_label,
                predicate, object_type, object_id, object_label,
                inference_rule, inference_depth, is_inferred, evidence
            )
            SELECT
                v_run_id,
                public.ontology_fact_key(subject_type, subject_id, predicate, object_type, object_id, inference_rule),
                subject_type,
                subject_id,
                subject_label,
                predicate,
                object_type,
                object_id,
                object_label,
                inference_rule,
                v_depth,
                is_inferred,
                evidence
            FROM facts
            ON CONFLICT (fact_key) DO NOTHING;

            GET DIAGNOSTICS v_delta = ROW_COUNT;
            EXIT WHEN v_delta = 0;
        END LOOP;
    END IF;

    UPDATE public.ontology_reasoning_runs r
       SET finished_at = NOW(),
           status = 'completed',
           facts_inserted = (
               SELECT COUNT(*)::INTEGER
               FROM public.ontology_inferred_facts f
               WHERE f.run_id = v_run_id
           )
     WHERE r.run_id = v_run_id;

    RETURN QUERY
    SELECT
        r.run_id,
        r.facts_inserted,
        r.max_depth,
        r.status
    FROM public.ontology_reasoning_runs r
    WHERE r.run_id = v_run_id;
EXCEPTION WHEN OTHERS THEN
    UPDATE public.ontology_reasoning_runs r
       SET finished_at = NOW(),
           status = 'failed',
           error_message = SQLERRM
     WHERE r.run_id = v_run_id;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.refresh_ontology_inferences(INTEGER) IS 'Refreshes read-only ontology reasoning facts without modifying business tables';

CREATE OR REPLACE VIEW public.v_ontology_reasoning_facts AS
SELECT
    f.id,
    f.run_id,
    rr.status AS run_status,
    rr.finished_at AS run_finished_at,
    f.subject_type,
    f.subject_id,
    f.subject_label,
    f.predicate,
    f.object_type,
    f.object_id,
    f.object_label,
    f.fact_value,
    f.inference_rule,
    r.rule_name,
    r.inference_stage,
    r.rule_kind,
    f.inference_depth,
    f.confidence,
    f.evidence,
    f.is_inferred,
    f.created_at
FROM public.ontology_inferred_facts f
LEFT JOIN public.ontology_inference_rules r
  ON r.rule_code = f.inference_rule
LEFT JOIN public.ontology_reasoning_runs rr
  ON rr.run_id = f.run_id;

COMMENT ON VIEW public.v_ontology_reasoning_facts IS 'Readable ontology reasoning facts with rule metadata';

CREATE OR REPLACE VIEW public.v_ontology_reasoning_edges AS
SELECT
    id,
    run_id,
    subject_type,
    subject_id,
    subject_label,
    predicate,
    object_type,
    object_id,
    object_label,
    inference_rule,
    rule_name,
    inference_stage,
    inference_depth,
    confidence,
    is_inferred,
    evidence
FROM public.v_ontology_reasoning_facts
WHERE object_id <> '';

COMMENT ON VIEW public.v_ontology_reasoning_edges IS 'Graph edge projection of ontology reasoning facts';

CREATE OR REPLACE VIEW public.v_ontology_reasoning_summary AS
WITH latest_run AS (
    SELECT r.*
    FROM public.ontology_reasoning_runs r
    ORDER BY r.finished_at DESC NULLS LAST, r.started_at DESC
    LIMIT 1
)
SELECT
    1::INTEGER AS id,
    lr.run_id,
    lr.status AS last_run_status,
    lr.started_at AS last_started_at,
    lr.finished_at AS last_finished_at,
    lr.max_depth,
    lr.facts_inserted AS facts_total,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inferred_facts f WHERE f.is_inferred = false) AS seed_facts,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inferred_facts f WHERE f.is_inferred = true) AS inferred_facts,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inference_rules r WHERE r.is_active = true) AS active_rules,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inferred_facts f WHERE f.predicate = 'acl:canAccessApp') AS role_app_access_facts,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inferred_facts f WHERE f.predicate = 'acl:canAccessTable') AS role_table_access_facts,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inferred_facts f WHERE f.predicate = 'wf:canPerformTransition') AS workflow_transition_facts,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inferred_facts f WHERE f.predicate = 'risk:canAccessSensitiveColumn') AS sensitive_exposure_facts,
    (SELECT COUNT(*)::INTEGER FROM public.ontology_inferred_facts f WHERE f.predicate = 'ontology:transitivelyDependsOn') AS transitive_dependency_facts
FROM latest_run lr;

COMMENT ON VIEW public.v_ontology_reasoning_summary IS 'Latest ontology reasoning run summary and fact counts';

CREATE OR REPLACE FUNCTION public.explain_ontology_path(
    p_subject_type TEXT,
    p_subject_id TEXT,
    p_object_type TEXT DEFAULT NULL,
    p_object_id TEXT DEFAULT NULL,
    p_max_depth INTEGER DEFAULT 4
)
RETURNS TABLE(
    depth INTEGER,
    terminal_type TEXT,
    terminal_id TEXT,
    terminal_label TEXT,
    path_text TEXT,
    path_facts JSONB
)
LANGUAGE SQL
STABLE
AS $$
    WITH RECURSIVE walk AS (
        SELECT
            1 AS depth,
            f.object_type AS terminal_type,
            f.object_id AS terminal_id,
            f.object_label AS terminal_label,
            ARRAY[f.id]::BIGINT[] AS path_ids,
            format('%s:%s -[%s]-> %s:%s', f.subject_type, f.subject_id, f.predicate, f.object_type, f.object_id) AS path_text,
            jsonb_build_array(jsonb_build_object(
                'id', f.id,
                'subject_type', f.subject_type,
                'subject_id', f.subject_id,
                'predicate', f.predicate,
                'object_type', f.object_type,
                'object_id', f.object_id,
                'rule', f.inference_rule,
                'inferred', f.is_inferred,
                'evidence', f.evidence
            )) AS path_facts
        FROM public.ontology_inferred_facts f
        WHERE f.subject_type = p_subject_type
          AND f.subject_id = p_subject_id
        UNION ALL
        SELECT
            w.depth + 1,
            f.object_type,
            f.object_id,
            f.object_label,
            w.path_ids || f.id,
            w.path_text || format(' | %s:%s -[%s]-> %s:%s', f.subject_type, f.subject_id, f.predicate, f.object_type, f.object_id),
            w.path_facts || jsonb_build_array(jsonb_build_object(
                'id', f.id,
                'subject_type', f.subject_type,
                'subject_id', f.subject_id,
                'predicate', f.predicate,
                'object_type', f.object_type,
                'object_id', f.object_id,
                'rule', f.inference_rule,
                'inferred', f.is_inferred,
                'evidence', f.evidence
            ))
        FROM walk w
        JOIN public.ontology_inferred_facts f
          ON f.subject_type = w.terminal_type
         AND f.subject_id = w.terminal_id
        WHERE w.depth < LEAST(GREATEST(COALESCE(p_max_depth, 4), 1), 8)
          AND NOT f.id = ANY(w.path_ids)
    )
    SELECT
        w.depth,
        w.terminal_type,
        w.terminal_id,
        w.terminal_label,
        w.path_text,
        w.path_facts
    FROM walk w
    WHERE (p_object_type IS NULL OR w.terminal_type = p_object_type)
      AND (p_object_id IS NULL OR w.terminal_id = p_object_id)
    ORDER BY w.depth, w.path_text
    LIMIT 100;
$$;

COMMENT ON FUNCTION public.explain_ontology_path(TEXT, TEXT, TEXT, TEXT, INTEGER) IS 'Explains reachable ontology paths from a subject through inferred facts';

WITH semantic_seed AS (
    SELECT *
    FROM (
        VALUES
            ('public', 'ontology_inference_rules', 'ontology', 'inference_rule', '本体推理规则', '知识图谱推理规则定义和启停配置', false, '["ontology","reasoning","rule"]'::jsonb),
            ('public', 'ontology_inferred_facts', 'ontology', 'inferred_fact', '本体推理事实', '推理刷新后生成的知识图谱事实边', false, '["ontology","reasoning","fact"]'::jsonb),
            ('public', 'ontology_reasoning_runs', 'ontology', 'reasoning_run', '本体推理运行', '推理刷新批次、状态和事实数量', false, '["ontology","reasoning","run"]'::jsonb),
            ('public', 'v_ontology_reasoning_facts', 'ontology', 'reasoning_fact_view', '本体推理事实视图', '带规则元数据的推理事实查询视图', false, '["ontology","reasoning","view"]'::jsonb),
            ('public', 'v_ontology_reasoning_edges', 'ontology', 'reasoning_edge_view', '本体推理边视图', '知识图谱边形式的推理事实视图', false, '["ontology","reasoning","graph"]'::jsonb),
            ('public', 'v_ontology_reasoning_summary', 'ontology', 'reasoning_summary_view', '本体推理摘要', '最近一次推理运行和关键事实数量摘要', false, '["ontology","reasoning","summary"]'::jsonb)
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

WITH reasoning_relations AS (
    SELECT table_schema, table_name
    FROM public.ontology_table_semantics
    WHERE is_active = true
      AND table_schema = 'public'
      AND (
          table_name IN (
              'ontology_inference_rules',
              'ontology_inferred_facts',
              'ontology_reasoning_runs',
              'v_ontology_reasoning_facts',
              'v_ontology_reasoning_edges',
              'v_ontology_reasoning_summary'
          )
      )
),
column_source AS (
    SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        CASE
            WHEN c.column_name ~* '(status|type|kind|stage|predicate)$' THEN 'enum_attribute'
            WHEN c.column_name ~* '(count|total|depth|priority)$' THEN 'derived_metric'
            WHEN c.column_name ~* '(evidence|config|facts|value)$' THEN 'json_attribute'
            WHEN c.column_name ~* '(started_at|finished_at|created_at|updated_at)$' THEN 'time_attribute'
            ELSE 'business_attribute'
        END AS semantic_class,
        CASE
            WHEN c.column_name = 'id' THEN '主键标识'
            WHEN c.column_name = 'run_id' THEN '推理运行标识'
            WHEN c.column_name = 'rule_code' THEN '推理规则编码'
            WHEN c.column_name = 'fact_key' THEN '推理事实唯一键'
            WHEN c.column_name = 'subject_type' THEN '主体类型'
            WHEN c.column_name = 'subject_id' THEN '主体标识'
            WHEN c.column_name = 'subject_label' THEN '主体名称'
            WHEN c.column_name = 'predicate' THEN '谓词'
            WHEN c.column_name = 'object_type' THEN '客体类型'
            WHEN c.column_name = 'object_id' THEN '客体标识'
            WHEN c.column_name = 'object_label' THEN '客体名称'
            WHEN c.column_name = 'inference_rule' THEN '推理规则'
            WHEN c.column_name = 'inference_depth' THEN '推理深度'
            WHEN c.column_name = 'is_inferred' THEN '是否推理生成'
            ELSE c.column_name
        END AS semantic_name,
        CASE
            WHEN c.udt_name IN ('json', 'jsonb') THEN 'json'
            WHEN c.data_type IN ('timestamp without time zone', 'timestamp with time zone') THEN 'datetime'
            WHEN c.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision', 'decimal') THEN 'number'
            WHEN c.data_type = 'boolean' THEN 'boolean'
            WHEN c.udt_name = 'uuid' THEN 'uuid'
            ELSE 'text'
        END AS ui_type
    FROM information_schema.columns c
    JOIN reasoning_relations rr
      ON rr.table_schema = c.table_schema
     AND rr.table_name = c.table_name
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
    format('%s.%s 字段“%s”推理引擎语义回填', cs.table_schema, cs.table_name, cs.semantic_name),
    cs.data_type,
    cs.ui_type,
    false,
    'ontology_reasoning_engine_v1',
    jsonb_build_array('ontology_reasoning_engine_v1', 'column', cs.semantic_class, cs.table_schema || '.' || cs.table_name),
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

WITH missing_column_source AS (
    SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        CASE
            WHEN c.column_name ~* '(status|state|type|category|level|mode|kind|decision)$' THEN 'enum_attribute'
            WHEN c.column_name ~* '(parent|tree|path|dept|org|hierarch)' THEN 'hierarchy_attribute'
            WHEN c.column_name ~* '(lng|lat|longitude|latitude|geo|location|address|region)' THEN 'geo_attribute'
            WHEN c.column_name ~* '(file|attachment|image|avatar|photo|document|xml|bpmn)' THEN 'file_attribute'
            WHEN c.column_name ~* '(amount|qty|quantity|total|score|rate|percent|ratio|count|num|price|balance|limit|probability|days)$' THEN 'derived_metric'
            WHEN c.column_name ~* '(created_at|updated_at|started_at|finished_at|seen_at|completed_at)$' THEN 'time_attribute'
            WHEN c.udt_name IN ('json', 'jsonb') THEN 'json_attribute'
            ELSE 'business_attribute'
        END AS semantic_class,
        CASE
            WHEN c.column_name = 'id' THEN '主键标识'
            WHEN c.column_name = 'created_at' THEN '创建时间'
            WHEN c.column_name = 'updated_at' THEN '更新时间'
            WHEN c.column_name = 'properties' THEN '扩展属性'
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
            WHEN c.udt_name = 'uuid' THEN 'uuid'
            WHEN c.data_type LIKE 'ARRAY%' OR c.udt_name LIKE '\_%' THEN 'array'
            ELSE 'text'
        END AS ui_type,
        (
            c.column_name ~* '(phone|mobile|email|idcard|id_no|identity|bank|account|salary|wage|address|token|secret|password|credential|birthday|birth|contact|wechat|qq)'
        ) AS is_sensitive
    FROM information_schema.columns c
    JOIN public.ontology_table_semantics ots
      ON ots.table_schema = c.table_schema
     AND ots.table_name = c.table_name
     AND ots.is_active = true
    LEFT JOIN public.ontology_column_semantics ocs
      ON ocs.table_schema = c.table_schema
     AND ocs.table_name = c.table_name
     AND ocs.column_name = c.column_name
     AND ocs.is_active = true
    WHERE c.table_schema IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data')
      AND ocs.column_name IS NULL
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
    mcs.table_schema,
    mcs.table_name,
    mcs.column_name,
    mcs.semantic_class,
    mcs.semantic_name,
    format('%s.%s 字段“%s”推理引擎覆盖兜底回填', mcs.table_schema, mcs.table_name, mcs.semantic_name),
    mcs.data_type,
    mcs.ui_type,
    mcs.is_sensitive,
    'ontology_reasoning_engine_v1_missing_fallback',
    jsonb_build_array('ontology_reasoning_engine_v1', 'missing_column_fallback', mcs.semantic_class, mcs.table_schema || '.' || mcs.table_name),
    true,
    NOW()
FROM missing_column_source mcs
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

GRANT SELECT ON public.ontology_inference_rules TO web_user;
GRANT SELECT ON public.ontology_inferred_facts TO web_user;
GRANT SELECT ON public.ontology_reasoning_runs TO web_user;
GRANT SELECT ON public.v_ontology_reasoning_facts TO web_user;
GRANT SELECT ON public.v_ontology_reasoning_edges TO web_user;
GRANT SELECT ON public.v_ontology_reasoning_summary TO web_user;
GRANT EXECUTE ON FUNCTION public.refresh_ontology_inferences(INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.explain_ontology_path(TEXT, TEXT, TEXT, TEXT, INTEGER) TO web_user;

SELECT * FROM public.refresh_ontology_inferences(4);
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

-- Validation summary
SELECT
    s.facts_total,
    s.seed_facts,
    s.inferred_facts,
    s.active_rules,
    s.role_app_access_facts,
    s.role_table_access_facts,
    s.workflow_transition_facts,
    s.sensitive_exposure_facts,
    s.transitive_dependency_facts
FROM public.v_ontology_reasoning_summary s;
