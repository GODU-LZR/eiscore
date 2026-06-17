-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: ontology graph query V1.
--
-- Safety boundary:
--   1) Read-only graph query layer built on ontology reasoning facts.
--   2) Does not modify business tables, RLS, workflow runtime, ACL decisions,
--      or App Center write paths.
--   3) Creates one node view and read-only SQL functions for neighbor/path
--      traversal over the inferred knowledge graph.
--
-- Execute:
--   cat sql/patch_ontology_graph_query_v1.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE VIEW public.v_ontology_kg_nodes AS
WITH raw_nodes AS (
    SELECT
        e.subject_type AS node_type,
        e.subject_id AS node_id,
        e.subject_label AS node_label,
        e.predicate,
        e.created_at
    FROM public.v_ontology_reasoning_facts e
    WHERE e.subject_id <> ''
    UNION ALL
    SELECT
        e.object_type AS node_type,
        e.object_id AS node_id,
        e.object_label AS node_label,
        e.predicate,
        e.created_at
    FROM public.v_ontology_reasoning_facts e
    WHERE e.object_id <> ''
),
node_base AS (
    SELECT
        rn.node_type,
        rn.node_id,
        rn.node_type || ':' || rn.node_id AS node_key,
        MAX(NULLIF(rn.node_label, '')) AS raw_label,
        COUNT(*)::INTEGER AS fact_mentions,
        COUNT(DISTINCT rn.predicate)::INTEGER AS predicate_count,
        to_jsonb(array_agg(DISTINCT rn.predicate ORDER BY rn.predicate)) AS predicates,
        MAX(rn.created_at) AS latest_fact_created_at
    FROM raw_nodes rn
    GROUP BY rn.node_type, rn.node_id
),
outgoing AS (
    SELECT
        e.subject_type AS node_type,
        e.subject_id AS node_id,
        COUNT(*)::INTEGER AS outgoing_edges
    FROM public.v_ontology_reasoning_edges e
    GROUP BY e.subject_type, e.subject_id
),
incoming AS (
    SELECT
        e.object_type AS node_type,
        e.object_id AS node_id,
        COUNT(*)::INTEGER AS incoming_edges
    FROM public.v_ontology_reasoning_edges e
    GROUP BY e.object_type, e.object_id
)
SELECT
    row_number() OVER (ORDER BY nb.node_type, nb.node_id)::INTEGER AS id,
    nb.node_key,
    nb.node_type,
    nb.node_id,
    COALESCE(
        NULLIF(ro.role_name, ''),
        NULLIF(app.app_name, ''),
        NULLIF(ots.semantic_name, ''),
        NULLIF(ocs.semantic_name, ''),
        NULLIF(po.name, ''),
        NULLIF(nb.raw_label, ''),
        nb.node_id
    ) AS node_label,
    COALESCE(
        NULLIF(ro.semantic_domain, ''),
        NULLIF(app.semantic_domain, ''),
        NULLIF(ots.semantic_domain, ''),
        'ontology'
    ) AS semantic_domain,
    CASE
        WHEN nb.node_type = 'table' THEN COALESCE(NULLIF(ots.semantic_class, ''), 'table')
        WHEN nb.node_type = 'column' THEN COALESCE(NULLIF(ocs.semantic_class, ''), 'column')
        WHEN nb.node_type = 'role' THEN COALESCE(NULLIF(ro.semantic_class, ''), 'role')
        WHEN nb.node_type = 'app' THEN COALESCE(NULLIF(app.semantic_class, ''), 'app')
        WHEN nb.node_type = 'permission' THEN COALESCE(NULLIF(po.semantic_kind, ''), 'permission')
        ELSE nb.node_type
    END AS semantic_class,
    COALESCE(
        NULLIF(ro.semantic_description, ''),
        NULLIF(app.semantic_description, ''),
        NULLIF(ots.semantic_description, ''),
        NULLIF(ocs.semantic_description, ''),
        ''
    ) AS node_description,
    CASE
        WHEN nb.node_type = 'column' THEN COALESCE(ocs.is_sensitive, false)
        WHEN nb.node_type = 'table' THEN EXISTS (
            SELECT 1
            FROM public.ontology_column_semantics c
            WHERE c.table_schema = split_part(nb.node_id, '.', 1)
              AND c.table_name = split_part(nb.node_id, '.', 2)
              AND c.is_active = true
              AND c.is_sensitive = true
        )
        ELSE false
    END AS is_sensitive,
    COALESCE(o.outgoing_edges, 0)::INTEGER AS outgoing_edges,
    COALESCE(i.incoming_edges, 0)::INTEGER AS incoming_edges,
    (COALESCE(o.outgoing_edges, 0) + COALESCE(i.incoming_edges, 0))::INTEGER AS total_degree,
    nb.fact_mentions,
    nb.predicate_count,
    nb.predicates,
    nb.latest_fact_created_at,
    COALESCE(ro.tags, app.tags, ots.tags, ocs.tags, '[]'::jsonb) AS tags
FROM node_base nb
LEFT JOIN outgoing o
  ON o.node_type = nb.node_type
 AND o.node_id = nb.node_id
LEFT JOIN incoming i
  ON i.node_type = nb.node_type
 AND i.node_id = nb.node_id
LEFT JOIN public.v_role_ontology ro
  ON nb.node_type = 'role'
 AND ro.role_code = nb.node_id
LEFT JOIN public.v_app_form_ontology app
  ON nb.node_type = 'app'
 AND app.app_id::TEXT = nb.node_id
LEFT JOIN public.ontology_table_semantics ots
  ON nb.node_type = 'table'
 AND ots.table_schema = split_part(nb.node_id, '.', 1)
 AND ots.table_name = split_part(nb.node_id, '.', 2)
 AND ots.is_active = true
LEFT JOIN public.ontology_column_semantics ocs
  ON nb.node_type = 'column'
 AND ocs.table_schema = split_part(nb.node_id, '.', 1)
 AND ocs.table_name = split_part(nb.node_id, '.', 2)
 AND ocs.column_name = regexp_replace(nb.node_id, '^[^.]+\.[^.]+\.', '')
 AND ocs.is_active = true
LEFT JOIN public.v_permission_ontology po
  ON nb.node_type = 'permission'
 AND po.code = nb.node_id;

COMMENT ON VIEW public.v_ontology_kg_nodes IS
    'Distinct knowledge graph nodes with semantic metadata and degree counts from ontology reasoning facts';

CREATE OR REPLACE FUNCTION public.search_ontology_kg_nodes(
    p_query TEXT DEFAULT NULL,
    p_node_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    id INTEGER,
    node_key TEXT,
    node_type TEXT,
    node_id TEXT,
    node_label TEXT,
    semantic_domain TEXT,
    semantic_class TEXT,
    is_sensitive BOOLEAN,
    outgoing_edges INTEGER,
    incoming_edges INTEGER,
    total_degree INTEGER,
    predicate_count INTEGER,
    predicates JSONB,
    tags JSONB
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        n.id,
        n.node_key,
        n.node_type,
        n.node_id,
        n.node_label,
        n.semantic_domain,
        n.semantic_class,
        n.is_sensitive,
        n.outgoing_edges,
        n.incoming_edges,
        n.total_degree,
        n.predicate_count,
        n.predicates,
        n.tags
    FROM public.v_ontology_kg_nodes n
    WHERE (NULLIF(p_node_type, '') IS NULL OR n.node_type = p_node_type)
      AND (
          NULLIF(p_query, '') IS NULL
          OR n.node_id ILIKE '%' || p_query || '%'
          OR n.node_label ILIKE '%' || p_query || '%'
          OR n.semantic_class ILIKE '%' || p_query || '%'
          OR n.semantic_domain ILIKE '%' || p_query || '%'
      )
    ORDER BY n.total_degree DESC, n.node_type, n.node_label, n.node_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
$$;

COMMENT ON FUNCTION public.search_ontology_kg_nodes(TEXT, TEXT, INTEGER) IS
    'Search ontology KG nodes by id, label, semantic class, or semantic domain';

CREATE OR REPLACE FUNCTION public.query_ontology_kg_neighbors(
    p_node_type TEXT,
    p_node_id TEXT,
    p_direction TEXT DEFAULT 'both',
    p_max_depth INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 200,
    p_predicate TEXT DEFAULT NULL
)
RETURNS TABLE(
    depth INTEGER,
    edge_direction TEXT,
    from_type TEXT,
    from_id TEXT,
    from_label TEXT,
    predicate TEXT,
    to_type TEXT,
    to_id TEXT,
    to_label TEXT,
    edge_id BIGINT,
    edge_subject_type TEXT,
    edge_subject_id TEXT,
    edge_object_type TEXT,
    edge_object_id TEXT,
    inference_rule TEXT,
    rule_name TEXT,
    is_inferred BOOLEAN,
    confidence NUMERIC(5,4),
    path_text TEXT,
    path_nodes TEXT[],
    path_edges BIGINT[],
    evidence JSONB
)
LANGUAGE SQL
STABLE
AS $$
    WITH RECURSIVE params AS (
        SELECT
            NULLIF(p_node_type, '') AS node_type,
            NULLIF(p_node_id, '') AS node_id,
            CASE
                WHEN lower(COALESCE(NULLIF(p_direction, ''), 'both')) IN ('outgoing', 'incoming', 'both')
                    THEN lower(COALESCE(NULLIF(p_direction, ''), 'both'))
                ELSE 'both'
            END AS direction,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 1), 4)) AS max_depth,
            GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000)) AS row_limit,
            NULLIF(p_predicate, '') AS predicate_filter
    ),
    oriented_edges AS (
        SELECT
            'outgoing'::TEXT AS edge_direction,
            e.subject_type AS from_type,
            e.subject_id AS from_id,
            e.subject_label AS from_label,
            e.object_type AS to_type,
            e.object_id AS to_id,
            e.object_label AS to_label,
            e.id AS edge_id,
            e.subject_type AS edge_subject_type,
            e.subject_id AS edge_subject_id,
            e.object_type AS edge_object_type,
            e.object_id AS edge_object_id,
            e.predicate,
            e.inference_rule,
            e.rule_name,
            e.is_inferred,
            e.confidence,
            e.evidence
        FROM public.v_ontology_reasoning_edges e
        CROSS JOIN params p
        WHERE p.direction IN ('outgoing', 'both')
          AND (p.predicate_filter IS NULL OR e.predicate = p.predicate_filter)
        UNION ALL
        SELECT
            'incoming'::TEXT AS edge_direction,
            e.object_type AS from_type,
            e.object_id AS from_id,
            e.object_label AS from_label,
            e.subject_type AS to_type,
            e.subject_id AS to_id,
            e.subject_label AS to_label,
            e.id AS edge_id,
            e.subject_type AS edge_subject_type,
            e.subject_id AS edge_subject_id,
            e.object_type AS edge_object_type,
            e.object_id AS edge_object_id,
            e.predicate,
            e.inference_rule,
            e.rule_name,
            e.is_inferred,
            e.confidence,
            e.evidence
        FROM public.v_ontology_reasoning_edges e
        CROSS JOIN params p
        WHERE p.direction IN ('incoming', 'both')
          AND (p.predicate_filter IS NULL OR e.predicate = p.predicate_filter)
    ),
    walk AS (
        SELECT
            1::INTEGER AS depth,
            oe.edge_direction,
            oe.from_type,
            oe.from_id,
            oe.from_label,
            oe.predicate,
            oe.to_type,
            oe.to_id,
            oe.to_label,
            oe.edge_id,
            oe.edge_subject_type,
            oe.edge_subject_id,
            oe.edge_object_type,
            oe.edge_object_id,
            oe.inference_rule,
            oe.rule_name,
            oe.is_inferred,
            oe.confidence,
            CASE
                WHEN oe.edge_direction = 'outgoing'
                    THEN format('%s:%s -[%s]-> %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
                ELSE format('%s:%s <-[%s]- %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
            END AS path_text,
            ARRAY[oe.from_type || ':' || oe.from_id, oe.to_type || ':' || oe.to_id]::TEXT[] AS path_nodes,
            ARRAY[oe.edge_id]::BIGINT[] AS path_edges,
            oe.evidence
        FROM oriented_edges oe
        CROSS JOIN params p
        WHERE oe.from_type = p.node_type
          AND oe.from_id = p.node_id
        UNION ALL
        SELECT
            w.depth + 1,
            oe.edge_direction,
            oe.from_type,
            oe.from_id,
            oe.from_label,
            oe.predicate,
            oe.to_type,
            oe.to_id,
            oe.to_label,
            oe.edge_id,
            oe.edge_subject_type,
            oe.edge_subject_id,
            oe.edge_object_type,
            oe.edge_object_id,
            oe.inference_rule,
            oe.rule_name,
            oe.is_inferred,
            oe.confidence,
            w.path_text || ' | ' ||
                CASE
                    WHEN oe.edge_direction = 'outgoing'
                        THEN format('%s:%s -[%s]-> %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
                    ELSE format('%s:%s <-[%s]- %s:%s', oe.from_type, oe.from_id, oe.predicate, oe.to_type, oe.to_id)
                END AS path_text,
            w.path_nodes || (oe.to_type || ':' || oe.to_id),
            w.path_edges || oe.edge_id,
            oe.evidence
        FROM walk w
        JOIN oriented_edges oe
          ON oe.from_type = w.to_type
         AND oe.from_id = w.to_id
        CROSS JOIN params p
        WHERE w.depth < p.max_depth
          AND NOT (oe.to_type || ':' || oe.to_id) = ANY(w.path_nodes)
          AND NOT oe.edge_id = ANY(w.path_edges)
    )
    SELECT
        w.depth,
        w.edge_direction,
        w.from_type,
        w.from_id,
        w.from_label,
        w.predicate,
        w.to_type,
        w.to_id,
        w.to_label,
        w.edge_id,
        w.edge_subject_type,
        w.edge_subject_id,
        w.edge_object_type,
        w.edge_object_id,
        w.inference_rule,
        w.rule_name,
        w.is_inferred,
        w.confidence,
        w.path_text,
        w.path_nodes,
        w.path_edges,
        w.evidence
    FROM walk w
    CROSS JOIN params p
    ORDER BY w.depth, w.edge_direction, w.predicate, w.to_type, w.to_id, w.edge_id
    LIMIT (SELECT row_limit FROM params);
$$;

COMMENT ON FUNCTION public.query_ontology_kg_neighbors(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) IS
    'Traverse ontology KG neighbors from a node with bounded depth and optional direction/predicate filters';

CREATE OR REPLACE FUNCTION public.find_ontology_kg_paths(
    p_source_type TEXT,
    p_source_id TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_max_depth INTEGER DEFAULT 4,
    p_direction TEXT DEFAULT 'outgoing',
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    depth INTEGER,
    source_type TEXT,
    source_id TEXT,
    target_type TEXT,
    target_id TEXT,
    target_label TEXT,
    path_text TEXT,
    path_nodes TEXT[],
    path_edges BIGINT[],
    path_facts JSONB
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        q.depth,
        p_source_type AS source_type,
        p_source_id AS source_id,
        q.to_type AS target_type,
        q.to_id AS target_id,
        q.to_label AS target_label,
        q.path_text,
        q.path_nodes,
        q.path_edges,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', e.id,
                'subject_type', e.subject_type,
                'subject_id', e.subject_id,
                'predicate', e.predicate,
                'object_type', e.object_type,
                'object_id', e.object_id,
                'rule', e.inference_rule,
                'inferred', e.is_inferred,
                'evidence', e.evidence
            ) ORDER BY pe.ordinality)
            FROM unnest(q.path_edges) WITH ORDINALITY AS pe(edge_id, ordinality)
            JOIN public.v_ontology_reasoning_edges e
              ON e.id = pe.edge_id
        ), '[]'::jsonb) AS path_facts
    FROM public.query_ontology_kg_neighbors(
        p_source_type,
        p_source_id,
        p_direction,
        p_max_depth,
        GREATEST(20, LEAST(COALESCE(p_limit, 20) * 50, 1000)),
        NULL
    ) q
    WHERE q.to_type = p_target_type
      AND q.to_id = p_target_id
    ORDER BY q.depth, q.path_text
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

COMMENT ON FUNCTION public.find_ontology_kg_paths(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) IS
    'Find bounded ontology KG paths between two nodes';

WITH graph_views(table_schema, table_name, semantic_domain, semantic_class, semantic_name, semantic_description, tags) AS (
    VALUES
        ('public', 'v_ontology_kg_nodes', 'ontology', 'kg_node_view', '知识图谱节点视图', '从推理事实聚合出的知识图谱节点、语义元数据和度数统计', '["ontology","reasoning","kg","node"]'::jsonb)
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
FROM graph_views
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = EXCLUDED.is_business,
    is_active = true,
    tags = EXCLUDED.tags,
    updated_at = NOW();

WITH graph_views(table_schema, table_name) AS (
    VALUES ('public', 'v_ontology_kg_nodes')
),
column_source AS (
    SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        CASE
            WHEN c.column_name IN ('id') THEN 'identifier'
            WHEN c.column_name IN ('node_key', 'node_type', 'node_id') THEN 'identifier'
            WHEN c.column_name LIKE '%_id' OR c.column_name LIKE '%_key' OR c.column_name LIKE '%_type' THEN 'reference_attribute'
            WHEN c.column_name IN ('semantic_domain', 'semantic_class') THEN 'enum_attribute'
            WHEN c.column_name LIKE '%edges%' OR c.column_name LIKE '%degree%' OR c.column_name LIKE '%count%' OR c.column_name LIKE '%mentions%' THEN 'derived_metric'
            WHEN c.column_name LIKE '%_at' THEN 'time_attribute'
            WHEN c.column_name IN ('tags', 'predicates') THEN 'json_attribute'
            WHEN c.data_type = 'boolean' THEN 'boolean_attribute'
            ELSE 'business_attribute'
        END AS semantic_class,
        CASE c.column_name
            WHEN 'id' THEN '行标识'
            WHEN 'node_key' THEN '节点键'
            WHEN 'node_type' THEN '节点类型'
            WHEN 'node_id' THEN '节点标识'
            WHEN 'node_label' THEN '节点名称'
            WHEN 'semantic_domain' THEN '语义域'
            WHEN 'semantic_class' THEN '语义类别'
            WHEN 'is_sensitive' THEN '是否敏感'
            WHEN 'outgoing_edges' THEN '出边数量'
            WHEN 'incoming_edges' THEN '入边数量'
            WHEN 'total_degree' THEN '总度数'
            WHEN 'predicate_count' THEN '谓词数量'
            WHEN 'predicates' THEN '谓词集合'
            WHEN 'latest_fact_created_at' THEN '最近事实时间'
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
    JOIN graph_views v
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
    format('%s.%s 图谱查询字段“%s”', cs.table_schema, cs.table_name, cs.semantic_name),
    cs.data_type,
    cs.ui_type,
    false,
    'ontology_graph_query_v1',
    jsonb_build_array('ontology', 'reasoning', 'kg', cs.semantic_class, cs.table_name),
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

GRANT SELECT ON public.v_ontology_kg_nodes TO web_user;
GRANT EXECUTE ON FUNCTION public.search_ontology_kg_nodes(TEXT, TEXT, INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.query_ontology_kg_neighbors(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION public.find_ontology_kg_paths(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO web_user;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

-- Validation examples
SELECT node_type, node_id, node_label, total_degree
FROM public.v_ontology_kg_nodes
ORDER BY total_degree DESC, node_type, node_id
LIMIT 10;

SELECT *
FROM public.query_ontology_kg_neighbors('role', 'super_admin', 'outgoing', 1, 10);
