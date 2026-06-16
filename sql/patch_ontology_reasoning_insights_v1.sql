-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: ontology reasoning insights V1.
--
-- Safety boundary:
--   1) Read-only insight layer built on ontology reasoning facts.
--   2) Does not modify business tables, RLS, workflow runtime, ACL decisions,
--      or App Center write paths.
--   3) Creates views and a read-only SQL function for KG explanation.
--
-- Execute:
--   cat sql/patch_ontology_reasoning_insights_v1.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE VIEW public.v_ontology_reasoning_rule_stats AS
WITH fact_stats AS (
    SELECT
        f.inference_rule AS rule_code,
        COUNT(*)::INTEGER AS facts_total,
        COUNT(*) FILTER (WHERE f.is_inferred)::INTEGER AS inferred_facts,
        COUNT(*) FILTER (WHERE NOT f.is_inferred)::INTEGER AS seed_facts,
        COUNT(DISTINCT f.predicate)::INTEGER AS predicate_count,
        MIN(f.inference_depth)::INTEGER AS min_depth,
        MAX(f.inference_depth)::INTEGER AS max_depth,
        to_jsonb(array_agg(DISTINCT f.predicate ORDER BY f.predicate)) AS predicates
    FROM public.v_ontology_reasoning_facts f
    GROUP BY f.inference_rule
),
latest_run AS (
    SELECT
        r.run_id,
        r.status,
        r.started_at,
        r.finished_at,
        r.max_depth,
        r.facts_inserted
    FROM public.ontology_reasoning_runs r
    ORDER BY r.started_at DESC
    LIMIT 1
)
SELECT
    row_number() OVER (ORDER BY r.priority, r.rule_code)::INTEGER AS id,
    r.rule_code,
    r.rule_name,
    r.inference_stage,
    r.rule_kind,
    r.predicate AS declared_predicate,
    r.description,
    r.config,
    r.priority,
    r.is_active,
    COALESCE(fs.facts_total, 0)::INTEGER AS facts_total,
    COALESCE(fs.seed_facts, 0)::INTEGER AS seed_facts,
    COALESCE(fs.inferred_facts, 0)::INTEGER AS inferred_facts,
    COALESCE(fs.predicate_count, 0)::INTEGER AS predicate_count,
    COALESCE(fs.predicates, '[]'::jsonb) AS predicates,
    fs.min_depth,
    fs.max_depth,
    lr.run_id AS latest_run_id,
    lr.status AS latest_run_status,
    lr.started_at AS latest_started_at,
    lr.finished_at AS latest_finished_at,
    r.updated_at
FROM public.ontology_inference_rules r
LEFT JOIN fact_stats fs
  ON fs.rule_code = r.rule_code
LEFT JOIN latest_run lr
  ON true;

COMMENT ON VIEW public.v_ontology_reasoning_rule_stats IS
    'Per-rule ontology reasoning fact counts and latest run metadata';

CREATE OR REPLACE VIEW public.v_ontology_role_access_insights AS
WITH role_base AS (
    SELECT
        r.role_code,
        r.role_name,
        r.role_description,
        r.dept_name,
        r.permission_count,
        r.permission_semantic_kinds,
        r.data_scopes,
        r.tags
    FROM public.v_role_ontology r
),
role_counts AS (
    SELECT
        f.subject_id AS role_code,
        COUNT(DISTINCT f.object_id) FILTER (WHERE f.predicate = 'acl:canAccessApp')::INTEGER AS accessible_apps,
        COUNT(DISTINCT f.object_id) FILTER (WHERE f.predicate = 'acl:canAccessTable')::INTEGER AS accessible_tables,
        COUNT(DISTINCT f.object_id) FILTER (WHERE f.predicate = 'acl:canOperateTable')::INTEGER AS operable_tables,
        COUNT(DISTINCT f.object_id) FILTER (WHERE f.predicate = 'risk:canAccessSensitiveColumn')::INTEGER AS sensitive_columns,
        COUNT(DISTINCT (f.evidence->>'table')) FILTER (WHERE f.predicate = 'risk:canAccessSensitiveColumn')::INTEGER AS sensitive_tables,
        COUNT(DISTINCT COALESCE(f.evidence->>'permission_code', '')) FILTER (
            WHERE f.predicate IN ('acl:canAccessApp', 'acl:canAccessTable', 'acl:canOperateTable', 'acl:canOperateAppAction')
              AND COALESCE(f.evidence->>'permission_code', '') <> ''
        )::INTEGER AS inferred_permission_paths
    FROM public.v_ontology_reasoning_facts f
    WHERE f.subject_type = 'role'
    GROUP BY f.subject_id
),
latest_run AS (
    SELECT
        s.run_id,
        s.last_run_status,
        s.last_finished_at
    FROM public.v_ontology_reasoning_summary s
    LIMIT 1
)
SELECT
    row_number() OVER (ORDER BY rb.role_code)::INTEGER AS id,
    rb.role_code,
    rb.role_name,
    rb.role_description,
    rb.dept_name,
    rb.permission_count,
    rb.permission_semantic_kinds,
    rb.data_scopes,
    rb.tags,
    COALESCE(rc.accessible_apps, 0)::INTEGER AS accessible_apps,
    COALESCE(rc.accessible_tables, 0)::INTEGER AS accessible_tables,
    COALESCE(rc.operable_tables, 0)::INTEGER AS operable_tables,
    COALESCE(rc.sensitive_columns, 0)::INTEGER AS sensitive_columns,
    COALESCE(rc.sensitive_tables, 0)::INTEGER AS sensitive_tables,
    COALESCE(rc.inferred_permission_paths, 0)::INTEGER AS inferred_permission_paths,
    lr.run_id AS latest_run_id,
    lr.last_run_status,
    lr.last_finished_at
FROM role_base rb
LEFT JOIN role_counts rc
  ON rc.role_code = rb.role_code
LEFT JOIN latest_run lr
  ON true;

COMMENT ON VIEW public.v_ontology_role_access_insights IS
    'Role-centric KG access, operation, and sensitive exposure insight summary';

CREATE OR REPLACE VIEW public.v_ontology_sensitive_access_paths AS
SELECT
    f.id,
    f.id AS fact_id,
    f.subject_id AS role_code,
    COALESCE(r.role_name, f.subject_label, f.subject_id) AS role_name,
    split_part(f.object_id, '.', 1) AS table_schema,
    split_part(f.object_id, '.', 2) AS table_name,
    split_part(f.object_id, '.', 1) || '.' || split_part(f.object_id, '.', 2) AS table_id,
    COALESCE(t.semantic_name, f.evidence->>'table', split_part(f.object_id, '.', 1) || '.' || split_part(f.object_id, '.', 2)) AS table_label,
    regexp_replace(f.object_id, '^[^.]+\.[^.]+\.', '') AS column_name,
    COALESCE(c.semantic_name, f.object_label, regexp_replace(f.object_id, '^[^.]+\.[^.]+\.', '')) AS column_label,
    f.object_id AS column_id,
    f.predicate,
    f.inference_rule,
    f.rule_name,
    f.evidence->>'access_predicate' AS access_predicate,
    f.evidence->>'access_rule' AS access_rule,
    f.inference_depth,
    f.confidence,
    f.evidence,
    f.created_at
FROM public.v_ontology_reasoning_facts f
LEFT JOIN public.v_role_ontology r
  ON r.role_code = f.subject_id
LEFT JOIN public.ontology_table_semantics t
  ON t.table_schema = split_part(f.object_id, '.', 1)
 AND t.table_name = split_part(f.object_id, '.', 2)
 AND t.is_active = true
LEFT JOIN public.ontology_column_semantics c
  ON c.table_schema = split_part(f.object_id, '.', 1)
 AND c.table_name = split_part(f.object_id, '.', 2)
 AND c.column_name = regexp_replace(f.object_id, '^[^.]+\.[^.]+\.', '')
 AND c.is_active = true
WHERE f.predicate = 'risk:canAccessSensitiveColumn'
  AND f.subject_type = 'role'
  AND f.object_type = 'column';

COMMENT ON VIEW public.v_ontology_sensitive_access_paths IS
    'Detailed role-to-sensitive-column paths inferred by the ontology KG engine';

CREATE OR REPLACE VIEW public.v_ontology_table_dependency_paths AS
SELECT
    f.id,
    f.id AS fact_id,
    f.subject_id AS dependent_table_id,
    f.subject_label AS dependent_table_label,
    f.object_id AS dependency_table_id,
    f.object_label AS dependency_table_label,
    f.evidence->>'via' AS via_table_id,
    f.inference_depth AS dependency_depth,
    f.inference_rule,
    f.rule_name,
    f.evidence,
    f.created_at
FROM public.v_ontology_reasoning_facts f
WHERE f.predicate = 'ontology:transitivelyDependsOn'
  AND f.subject_type = 'table'
  AND f.object_type = 'table';

COMMENT ON VIEW public.v_ontology_table_dependency_paths IS
    'Transitive table dependency paths inferred by the ontology KG engine';

CREATE OR REPLACE VIEW public.v_ontology_table_impact_insights AS
WITH table_base AS (
    SELECT
        t.table_schema,
        t.table_name,
        t.table_schema || '.' || t.table_name AS table_id,
        t.semantic_domain,
        t.semantic_class,
        t.semantic_name AS table_label
    FROM public.ontology_table_semantics t
    WHERE t.is_active = true
),
direct_dependency_counts AS (
    SELECT
        f.object_id AS table_id,
        COUNT(DISTINCT f.subject_id)::INTEGER AS direct_dependent_tables
    FROM public.v_ontology_reasoning_facts f
    WHERE f.predicate = 'ontology:dependsOn'
      AND f.subject_type = 'table'
      AND f.object_type = 'table'
    GROUP BY f.object_id
),
transitive_dependency_counts AS (
    SELECT
        f.object_id AS table_id,
        COUNT(DISTINCT f.subject_id)::INTEGER AS transitive_dependent_tables
    FROM public.v_ontology_reasoning_facts f
    WHERE f.predicate = 'ontology:transitivelyDependsOn'
      AND f.subject_type = 'table'
      AND f.object_type = 'table'
    GROUP BY f.object_id
),
outgoing_dependency_counts AS (
    SELECT
        f.subject_id AS table_id,
        COUNT(DISTINCT f.object_id)::INTEGER AS depends_on_tables
    FROM public.v_ontology_reasoning_facts f
    WHERE f.predicate IN ('ontology:dependsOn', 'ontology:transitivelyDependsOn')
      AND f.subject_type = 'table'
      AND f.object_type = 'table'
    GROUP BY f.subject_id
),
role_access_counts AS (
    SELECT
        f.object_id AS table_id,
        COUNT(DISTINCT f.subject_id) FILTER (WHERE f.predicate = 'acl:canAccessTable')::INTEGER AS roles_can_access,
        COUNT(DISTINCT f.subject_id) FILTER (WHERE f.predicate = 'acl:canOperateTable')::INTEGER AS roles_can_operate
    FROM public.v_ontology_reasoning_facts f
    WHERE f.subject_type = 'role'
      AND f.object_type = 'table'
      AND f.predicate IN ('acl:canAccessTable', 'acl:canOperateTable')
    GROUP BY f.object_id
),
sensitive_counts AS (
    SELECT
        c.table_schema || '.' || c.table_name AS table_id,
        COUNT(*)::INTEGER AS sensitive_columns
    FROM public.ontology_column_semantics c
    WHERE c.is_active = true
      AND c.is_sensitive = true
    GROUP BY c.table_schema, c.table_name
)
SELECT
    row_number() OVER (ORDER BY tb.table_id)::INTEGER AS id,
    tb.table_schema,
    tb.table_name,
    tb.table_id,
    tb.semantic_domain,
    tb.semantic_class,
    tb.table_label,
    (COALESCE(sc.sensitive_columns, 0) > 0) AS is_sensitive,
    COALESCE(sc.sensitive_columns, 0)::INTEGER AS sensitive_columns,
    COALESCE(rac.roles_can_access, 0)::INTEGER AS roles_can_access,
    COALESCE(rac.roles_can_operate, 0)::INTEGER AS roles_can_operate,
    COALESCE(ddc.direct_dependent_tables, 0)::INTEGER AS direct_dependent_tables,
    COALESCE(tdc.transitive_dependent_tables, 0)::INTEGER AS transitive_dependent_tables,
    COALESCE(odc.depends_on_tables, 0)::INTEGER AS depends_on_tables,
    (
        COALESCE(sc.sensitive_columns, 0) > 0
        OR COALESCE(rac.roles_can_access, 0) > 0
        OR COALESCE(tdc.transitive_dependent_tables, 0) > 0
    ) AS has_reasoning_impact
FROM table_base tb
LEFT JOIN sensitive_counts sc
  ON sc.table_id = tb.table_id
LEFT JOIN role_access_counts rac
  ON rac.table_id = tb.table_id
LEFT JOIN direct_dependency_counts ddc
  ON ddc.table_id = tb.table_id
LEFT JOIN transitive_dependency_counts tdc
  ON tdc.table_id = tb.table_id
LEFT JOIN outgoing_dependency_counts odc
  ON odc.table_id = tb.table_id;

COMMENT ON VIEW public.v_ontology_table_impact_insights IS
    'Table-centric KG impact summary for dependencies, role access, and sensitive columns';

CREATE OR REPLACE VIEW public.v_ontology_reasoning_health AS
SELECT
    1::INTEGER AS id,
    s.run_id,
    s.last_run_status,
    s.last_started_at,
    s.last_finished_at,
    s.max_depth,
    s.facts_total,
    s.seed_facts,
    s.inferred_facts,
    s.active_rules,
    s.role_app_access_facts,
    s.role_table_access_facts,
    s.workflow_transition_facts,
    s.sensitive_exposure_facts,
    s.transitive_dependency_facts,
    a.api_relations,
    a.semanticized_relations,
    a.missing_relation_semantics,
    a.ontology_columns,
    a.semanticized_columns,
    a.missing_column_semantics,
    (
        COALESCE(s.last_run_status, '') = 'completed'
        AND COALESCE(a.missing_relation_semantics, 0) = 0
        AND COALESCE(a.missing_column_semantics, 0) = 0
        AND COALESCE(s.inferred_facts, 0) > 0
    ) AS is_healthy,
    CASE
        WHEN COALESCE(s.last_run_status, '') <> 'completed' THEN 'reasoning_run_not_completed'
        WHEN COALESCE(a.missing_relation_semantics, 0) > 0 THEN 'missing_relation_semantics'
        WHEN COALESCE(a.missing_column_semantics, 0) > 0 THEN 'missing_column_semantics'
        WHEN COALESCE(s.inferred_facts, 0) <= 0 THEN 'no_inferred_facts'
        ELSE 'healthy'
    END AS health_code
FROM public.v_ontology_reasoning_summary s
CROSS JOIN public.v_ontology_coverage_audit a;

COMMENT ON VIEW public.v_ontology_reasoning_health IS
    'Combined ontology reasoning run and semantic coverage health status';

CREATE OR REPLACE FUNCTION public.explain_role_ontology_access(
    p_role_code TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
    role_code TEXT,
    role_name TEXT,
    fact_id BIGINT,
    predicate TEXT,
    target_type TEXT,
    target_id TEXT,
    target_label TEXT,
    table_id TEXT,
    column_id TEXT,
    action_key TEXT,
    permission_code TEXT,
    inference_rule TEXT,
    rule_name TEXT,
    path_text TEXT,
    evidence JSONB
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        f.subject_id AS role_code,
        COALESCE(r.role_name, f.subject_label, f.subject_id) AS role_name,
        f.id AS fact_id,
        f.predicate,
        f.object_type AS target_type,
        f.object_id AS target_id,
        f.object_label AS target_label,
        CASE
            WHEN f.object_type = 'table' THEN f.object_id
            WHEN f.object_type = 'column' THEN split_part(f.object_id, '.', 1) || '.' || split_part(f.object_id, '.', 2)
            ELSE f.evidence->>'table'
        END AS table_id,
        CASE
            WHEN f.object_type = 'column' THEN f.object_id
            ELSE NULL
        END AS column_id,
        f.evidence->>'action_key' AS action_key,
        f.evidence->>'permission_code' AS permission_code,
        f.inference_rule,
        f.rule_name,
        format('%s:%s -[%s]-> %s:%s', f.subject_type, f.subject_id, f.predicate, f.object_type, f.object_id) AS path_text,
        f.evidence
    FROM public.v_ontology_reasoning_facts f
    LEFT JOIN public.v_role_ontology r
      ON r.role_code = f.subject_id
    WHERE f.subject_type = 'role'
      AND (p_role_code IS NULL OR f.subject_id = p_role_code)
      AND f.predicate IN (
          'acl:canAccessApp',
          'acl:canAccessTable',
          'acl:canOperateAppAction',
          'acl:canOperateTable',
          'risk:canAccessSensitiveColumn'
      )
    ORDER BY
        CASE f.predicate
            WHEN 'risk:canAccessSensitiveColumn' THEN 1
            WHEN 'acl:canAccessTable' THEN 2
            WHEN 'acl:canOperateTable' THEN 3
            WHEN 'acl:canAccessApp' THEN 4
            ELSE 5
        END,
        f.subject_id,
        f.object_type,
        f.object_id,
        f.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;

COMMENT ON FUNCTION public.explain_role_ontology_access(TEXT, INTEGER) IS
    'Role-centric read-only KG access explanation based on inferred ontology facts';

WITH insight_views(table_schema, table_name, semantic_domain, semantic_class, semantic_name, semantic_description, tags) AS (
    VALUES
        ('public', 'v_ontology_reasoning_rule_stats', 'ontology', 'reasoning_rule_stats_view', '本体推理规则统计', '按规则聚合推理事实数量、谓词和最近运行状态', '["ontology","reasoning","insight","rule_stats"]'::jsonb),
        ('public', 'v_ontology_role_access_insights', 'ontology', 'role_access_insight_view', '角色访问洞察', '按角色聚合应用访问、表访问、操作能力和敏感字段暴露', '["ontology","reasoning","insight","role_access"]'::jsonb),
        ('public', 'v_ontology_sensitive_access_paths', 'ontology', 'sensitive_access_path_view', '敏感字段访问路径', '角色到敏感字段的可达路径与推理证据明细', '["ontology","reasoning","risk","sensitive_access"]'::jsonb),
        ('public', 'v_ontology_table_dependency_paths', 'ontology', 'table_dependency_path_view', '表依赖路径', '表间传递依赖路径和中间表证据', '["ontology","reasoning","dependency","path"]'::jsonb),
        ('public', 'v_ontology_table_impact_insights', 'ontology', 'table_impact_insight_view', '表影响洞察', '按表聚合依赖影响、角色访问和敏感字段覆盖', '["ontology","reasoning","impact","table"]'::jsonb),
        ('public', 'v_ontology_reasoning_health', 'ontology', 'reasoning_health_view', '本体推理健康状态', '推理运行状态与语义覆盖审计的合并健康检查', '["ontology","reasoning","health","coverage"]'::jsonb)
)
INSERT INTO public.ontology_table_semantics (
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    is_business,
    is_active,
    tags,
    updated_at
)
SELECT
    table_schema,
    table_name,
    semantic_domain,
    semantic_class,
    semantic_name,
    semantic_description,
    false,
    true,
    tags,
    NOW()
FROM insight_views
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = EXCLUDED.is_business,
    is_active = true,
    tags = EXCLUDED.tags,
    updated_at = NOW();

WITH insight_views(table_schema, table_name) AS (
    VALUES
        ('public', 'v_ontology_reasoning_rule_stats'),
        ('public', 'v_ontology_role_access_insights'),
        ('public', 'v_ontology_sensitive_access_paths'),
        ('public', 'v_ontology_table_dependency_paths'),
        ('public', 'v_ontology_table_impact_insights'),
        ('public', 'v_ontology_reasoning_health')
),
column_source AS (
    SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        CASE
            WHEN c.column_name IN ('id', 'fact_id') THEN 'identifier'
            WHEN c.column_name LIKE '%_id' OR c.column_name LIKE '%_code' THEN 'reference_attribute'
            WHEN c.column_name LIKE '%_status' OR c.column_name IN ('health_code', 'predicate', 'declared_predicate', 'rule_kind', 'inference_stage') THEN 'enum_attribute'
            WHEN c.column_name LIKE '%_at' THEN 'time_attribute'
            WHEN c.column_name IN ('config', 'evidence', 'data_scopes', 'tags', 'predicates', 'permission_semantic_kinds') THEN 'json_attribute'
            WHEN c.column_name LIKE '%count%' OR c.column_name LIKE '%facts%' OR c.column_name LIKE '%tables%' OR c.column_name LIKE '%columns%' OR c.column_name LIKE '%apps%' OR c.column_name LIKE '%rules%' OR c.column_name IN ('priority', 'max_depth', 'min_depth', 'dependency_depth', 'permission_count') THEN 'derived_metric'
            WHEN c.data_type = 'boolean' THEN 'boolean_attribute'
            ELSE 'business_attribute'
        END AS semantic_class,
        CASE c.column_name
            WHEN 'id' THEN '行标识'
            WHEN 'fact_id' THEN '推理事实标识'
            WHEN 'role_code' THEN '角色编码'
            WHEN 'role_name' THEN '角色名称'
            WHEN 'table_id' THEN '表标识'
            WHEN 'column_id' THEN '字段标识'
            WHEN 'predicate' THEN '图谱谓词'
            WHEN 'declared_predicate' THEN '规则声明谓词'
            WHEN 'facts_total' THEN '事实总数'
            WHEN 'inferred_facts' THEN '推理事实数'
            WHEN 'seed_facts' THEN '种子事实数'
            WHEN 'is_healthy' THEN '是否健康'
            WHEN 'health_code' THEN '健康状态码'
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
        END AS ui_type
    FROM information_schema.columns c
    JOIN insight_views v
      ON v.table_schema = c.table_schema
     AND v.table_name = c.table_name
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
    format('%s.%s 洞察视图字段“%s”', cs.table_schema, cs.table_name, cs.semantic_name),
    cs.data_type,
    cs.ui_type,
    false,
    'ontology_reasoning_insights_v1',
    jsonb_build_array('ontology', 'reasoning', 'insight', cs.semantic_class, cs.table_name),
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

GRANT SELECT ON public.v_ontology_reasoning_rule_stats TO web_user;
GRANT SELECT ON public.v_ontology_role_access_insights TO web_user;
GRANT SELECT ON public.v_ontology_sensitive_access_paths TO web_user;
GRANT SELECT ON public.v_ontology_table_dependency_paths TO web_user;
GRANT SELECT ON public.v_ontology_table_impact_insights TO web_user;
GRANT SELECT ON public.v_ontology_reasoning_health TO web_user;
GRANT EXECUTE ON FUNCTION public.explain_role_ontology_access(TEXT, INTEGER) TO web_user;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

-- Validation summary
SELECT * FROM public.v_ontology_reasoning_health;
