-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: agent-safe ontology / KG context V1.
--
-- Safety boundary:
--   1) Adds role-scoped read-only RPC functions for agents.
--   2) Adds a role-scoped ontology semantic upsert RPC for ontology admins.
--   3) Does not modify business tables, workflow runtime, ACL decisions, or
--      existing ontology workbench endpoints.
--   4) Existing full-graph ontology functions/views/tables become internal-only for
--      SECURITY DEFINER wrappers; external clients should call only functions
--      prefixed with agent_*.
--
-- Execute:
--   cat sql/patch_agent_ontology_secure_context_v1.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION public.ontology_current_claims()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

COMMENT ON FUNCTION public.ontology_current_claims() IS
    'Current PostgREST JWT claims as JSONB for ontology agent access checks';

CREATE OR REPLACE FUNCTION public.ontology_current_username()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    SELECT COALESCE(
        NULLIF(public.ontology_current_claims() ->> 'username', ''),
        NULLIF(public.ontology_current_claims() ->> 'sub', ''),
        ''
    );
$$;

COMMENT ON FUNCTION public.ontology_current_username() IS
    'Current application username from JWT claims';

CREATE OR REPLACE FUNCTION public.ontology_current_role_codes()
RETURNS TABLE(role_code TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH claims AS (
        SELECT public.ontology_current_claims() AS value
    ),
    claim_roles AS (
        SELECT NULLIF(value ->> 'app_role', '') AS role_code FROM claims
        UNION
        SELECT NULLIF(value ->> 'role_code', '') AS role_code FROM claims
    ),
    user_roles_from_matrix AS (
        SELECT r.code AS role_code
        FROM public.users u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = ur.role_id
        WHERE u.username = public.ontology_current_username()
    ),
    legacy_user_role AS (
        SELECT NULLIF(u.role, '') AS role_code
        FROM public.users u
        WHERE u.username = public.ontology_current_username()
    )
    SELECT DISTINCT role_code
    FROM (
        SELECT role_code FROM claim_roles
        UNION ALL
        SELECT role_code FROM user_roles_from_matrix
        UNION ALL
        SELECT role_code FROM legacy_user_role
    ) r
    WHERE COALESCE(role_code, '') <> '';
$$;

COMMENT ON FUNCTION public.ontology_current_role_codes() IS
    'Current application role codes from JWT claims plus persisted user role assignments';

CREATE OR REPLACE FUNCTION public.ontology_current_permissions()
RETURNS TABLE(permission_code TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH claims AS (
        SELECT public.ontology_current_claims() AS value
    ),
    claim_permissions AS (
        SELECT item AS permission_code
        FROM claims c
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(c.value -> 'permissions') = 'array' THEN c.value -> 'permissions'
                ELSE '[]'::jsonb
            END
        ) AS item
    ),
    role_permissions AS (
        SELECT p.code AS permission_code
        FROM public.ontology_current_role_codes() rc
        JOIN public.roles r ON r.code = rc.role_code
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p ON p.id = rp.permission_id
    )
    SELECT DISTINCT source.permission_code
    FROM (
        SELECT cp.permission_code FROM claim_permissions cp
        UNION ALL
        SELECT rp.permission_code FROM role_permissions rp
    ) source
    WHERE COALESCE(source.permission_code, '') <> '';

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'permissions'
          AND udt_name = '_text'
    ) THEN
        RETURN QUERY EXECUTE
            'select distinct unnest(coalesce(permissions, array[]::text[])) as permission_code
               from public.users
              where username = public.ontology_current_username()
                and coalesce(array_length(permissions, 1), 0) > 0';
    END IF;
END;
$$;

COMMENT ON FUNCTION public.ontology_current_permissions() IS
    'Current effective permission codes from JWT claims, role_permissions, and legacy users.permissions';

CREATE OR REPLACE FUNCTION public.ontology_current_is_super()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ontology_current_role_codes() r
        WHERE lower(r.role_code) IN ('super_admin', 'admin')
    );
$$;

COMMENT ON FUNCTION public.ontology_current_is_super() IS
    'Whether current application role is allowed to see the full ontology graph';

CREATE OR REPLACE FUNCTION public.ontology_current_can_manage_semantics()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH role_codes AS (
        SELECT lower(role_code) AS role_code
        FROM public.ontology_current_role_codes()
    ),
    permission_codes AS (
        SELECT lower(permission_code) AS permission_code
        FROM public.ontology_current_permissions()
    )
    SELECT EXISTS (
        SELECT 1
        FROM role_codes
        WHERE role_code IN ('super_admin', 'admin', 'ontology_admin', 'ontology_manager')
    )
    OR EXISTS (
        SELECT 1
        FROM permission_codes
        WHERE permission_code IN ('ontology:write', 'ontology.manage', 'ontology.semantic.write')
           OR permission_code LIKE '%ontology:write%'
           OR permission_code LIKE '%ontology.semantic%'
           OR (
              permission_code LIKE '%ontology%'
              AND (
                  permission_code LIKE '%write%'
                  OR permission_code LIKE '%manage%'
                  OR permission_code LIKE '%admin%'
              )
           )
    );
$$;

COMMENT ON FUNCTION public.ontology_current_can_manage_semantics() IS
    'Whether current application role can write ontology semantic metadata through agent-safe RPCs';

CREATE OR REPLACE FUNCTION public.ontology_current_accessible_apps()
RETURNS TABLE(app_id TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH perms AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    )
    SELECT DISTINCT app_id
    FROM (
        SELECT a.id::TEXT AS app_id
        FROM app_center.apps a
        CROSS JOIN super_flag s
        WHERE s.allowed
        UNION ALL
        SELECT f.object_id AS app_id
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.predicate = 'acl:canAccessApp'
          AND f.object_type = 'app'
        UNION ALL
        SELECT v.app_id::TEXT AS app_id
        FROM public.v_app_form_ontology v
        WHERE v.app_id IS NOT NULL
          AND (
              v.permission_code IN (SELECT permission_code FROM perms)
              OR ('app:' || v.acl_module) IN (SELECT permission_code FROM perms)
              OR ('module:' || v.acl_module) IN (SELECT permission_code FROM perms)
          )
    ) x
    WHERE COALESCE(app_id, '') <> '';
$$;

COMMENT ON FUNCTION public.ontology_current_accessible_apps() IS
    'Application nodes visible to the current role for agent ontology context';

CREATE OR REPLACE FUNCTION public.ontology_current_accessible_tables()
RETURNS TABLE(table_id TEXT, access_level TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH perms AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    ),
    raw_access AS (
        SELECT
            t.table_schema || '.' || t.table_name AS table_id,
            'super'::TEXT AS access_level
        FROM public.ontology_table_semantics t
        CROSS JOIN super_flag s
        WHERE s.allowed
          AND t.is_active = true
        UNION ALL
        SELECT
            f.object_id AS table_id,
            CASE
                WHEN f.predicate = 'acl:canOperateTable' THEN 'operate'
                ELSE 'read'
            END AS access_level
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.object_type = 'table'
          AND f.predicate IN ('acl:canAccessTable', 'acl:canOperateTable')
        UNION ALL
        SELECT
            v.qualified_table AS table_id,
            'read'::TEXT AS access_level
        FROM public.v_app_form_ontology v
        WHERE COALESCE(v.qualified_table, '') <> ''
          AND (
              v.app_id::TEXT IN (SELECT app_id FROM public.ontology_current_accessible_apps())
              OR v.permission_code IN (SELECT permission_code FROM perms)
              OR ('app:' || v.acl_module) IN (SELECT permission_code FROM perms)
          )
    )
    SELECT
        table_id,
        CASE
            WHEN bool_or(access_level = 'super') THEN 'super'
            WHEN bool_or(access_level = 'operate') THEN 'operate'
            ELSE 'read'
        END AS access_level
    FROM raw_access
    WHERE COALESCE(table_id, '') <> ''
    GROUP BY table_id;
$$;

COMMENT ON FUNCTION public.ontology_current_accessible_tables() IS
    'Business table nodes visible to the current role for agent ontology context';

CREATE OR REPLACE FUNCTION public.ontology_current_accessible_sensitive_columns()
RETURNS TABLE(column_id TEXT)
LANGUAGE SQL
STABLE
AS $$
    WITH role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    )
    SELECT DISTINCT column_id
    FROM (
        SELECT
            c.table_schema || '.' || c.table_name || '.' || c.column_name AS column_id
        FROM public.ontology_column_semantics c
        CROSS JOIN super_flag s
        WHERE s.allowed
          AND c.is_active = true
          AND c.is_sensitive = true
        UNION ALL
        SELECT f.object_id AS column_id
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.object_type = 'column'
          AND f.predicate = 'risk:canAccessSensitiveColumn'
    ) x
    WHERE COALESCE(column_id, '') <> '';
$$;

COMMENT ON FUNCTION public.ontology_current_accessible_sensitive_columns() IS
    'Sensitive column nodes visible to the current role for agent ontology context';

CREATE OR REPLACE FUNCTION public.ontology_agent_visible_nodes()
RETURNS TABLE(node_type TEXT, node_id TEXT)
LANGUAGE SQL
STABLE
AS $$
    WITH super_flag AS (
        SELECT public.ontology_current_is_super() AS allowed
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    permissions AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    accessible_tables AS (
        SELECT table_id FROM public.ontology_current_accessible_tables()
    ),
    visible_columns AS (
        SELECT c.table_schema || '.' || c.table_name || '.' || c.column_name AS column_id
        FROM public.ontology_column_semantics c
        JOIN accessible_tables at ON at.table_id = c.table_schema || '.' || c.table_name
        WHERE c.is_active = true
          AND (
              COALESCE(c.is_sensitive, false) = false
              OR c.table_schema || '.' || c.table_name || '.' || c.column_name IN (
                  SELECT column_id FROM public.ontology_current_accessible_sensitive_columns()
              )
          )
    )
    SELECT DISTINCT node_type, node_id
    FROM (
        SELECT n.node_type, n.node_id
        FROM public.v_ontology_kg_nodes n
        CROSS JOIN super_flag s
        WHERE s.allowed
        UNION ALL
        SELECT 'table'::TEXT, table_id FROM accessible_tables
        UNION ALL
        SELECT 'column'::TEXT, column_id FROM visible_columns
        UNION ALL
        SELECT 'app'::TEXT, app_id FROM public.ontology_current_accessible_apps()
        UNION ALL
        SELECT 'permission'::TEXT, permission_code FROM permissions
        UNION ALL
        SELECT 'role'::TEXT, role_code FROM role_codes
        UNION ALL
        SELECT 'app_action'::TEXT, f.object_id
        FROM public.v_ontology_reasoning_facts f
        JOIN role_codes r ON r.role_code = f.subject_id
        WHERE f.subject_type = 'role'
          AND f.object_type = 'app_action'
          AND f.predicate = 'acl:canOperateAppAction'
        UNION ALL
        SELECT 'semantic_domain'::TEXT, t.semantic_domain
        FROM public.ontology_table_semantics t
        JOIN accessible_tables at ON at.table_id = t.table_schema || '.' || t.table_name
        WHERE t.is_active = true
        UNION ALL
        SELECT 'semantic_class'::TEXT, t.semantic_class
        FROM public.ontology_table_semantics t
        JOIN accessible_tables at ON at.table_id = t.table_schema || '.' || t.table_name
        WHERE t.is_active = true
        UNION ALL
        SELECT 'semantic_class'::TEXT, c.semantic_class
        FROM public.ontology_column_semantics c
        JOIN visible_columns vc ON vc.column_id = c.table_schema || '.' || c.table_name || '.' || c.column_name
        WHERE c.is_active = true
        UNION ALL
        SELECT 'permission_kind'::TEXT, po.semantic_kind
        FROM public.v_permission_ontology po
        JOIN permissions p ON p.permission_code = po.code
    ) visible
    WHERE COALESCE(node_type, '') <> ''
      AND COALESCE(node_id, '') <> '';
$$;

COMMENT ON FUNCTION public.ontology_agent_visible_nodes() IS
    'Materializable node set visible to the current role for agent ontology/KG queries';

CREATE OR REPLACE FUNCTION public.ontology_agent_can_access_node(
    p_node_type TEXT,
    p_node_id TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ontology_agent_visible_nodes() n
        WHERE n.node_type = NULLIF(p_node_type, '')
          AND n.node_id = NULLIF(p_node_id, '')
    );
$$;

COMMENT ON FUNCTION public.ontology_agent_can_access_node(TEXT, TEXT) IS
    'Role-scoped node visibility predicate for agent ontology/KG queries';

CREATE OR REPLACE FUNCTION public.ontology_agent_can_access_edge(
    p_edge_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
    SELECT EXISTS (
        SELECT 1
        FROM public.v_ontology_reasoning_edges e
        JOIN visible_nodes s
          ON s.node_type = e.subject_type
         AND s.node_id = e.subject_id
        JOIN visible_nodes o
          ON o.node_type = e.object_type
         AND o.node_id = e.object_id
        WHERE e.id = p_edge_id
    );
$$;

COMMENT ON FUNCTION public.ontology_agent_can_access_edge(BIGINT) IS
    'Role-scoped edge visibility predicate for agent ontology/KG queries';

CREATE OR REPLACE FUNCTION public.agent_search_ontology_kg_nodes(
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
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
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
    JOIN visible_nodes vn
      ON vn.node_type = n.node_type
     AND vn.node_id = n.node_id
    WHERE true
      AND (NULLIF(p_node_type, '') IS NULL OR n.node_type = p_node_type)
      AND (
          NULLIF(p_query, '') IS NULL
          OR n.node_id ILIKE '%' || p_query || '%'
          OR n.node_label ILIKE '%' || p_query || '%'
          OR n.semantic_class ILIKE '%' || p_query || '%'
          OR n.semantic_domain ILIKE '%' || p_query || '%'
      )
    ORDER BY n.total_degree DESC, n.node_type, n.node_label, n.node_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 300));
$$;

COMMENT ON FUNCTION public.agent_search_ontology_kg_nodes(TEXT, TEXT, INTEGER) IS
    'Agent-safe role-scoped ontology KG node search';

CREATE OR REPLACE FUNCTION public.agent_query_ontology_kg_neighbors(
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
    confidence NUMERIC,
    path_text TEXT,
    path_nodes TEXT[],
    path_edges BIGINT[],
    evidence JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    raw_neighbors AS (
        SELECT q.*
        FROM public.query_ontology_kg_neighbors(
            p_node_type,
            p_node_id,
            p_direction,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 1), 4)),
            1000,
            p_predicate
        ) q
    )
    SELECT q.*
    FROM raw_neighbors q
    JOIN visible_nodes start_node
      ON start_node.node_type = p_node_type
     AND start_node.node_id = p_node_id
    JOIN visible_nodes from_node
      ON from_node.node_type = q.from_type
     AND from_node.node_id = q.from_id
    JOIN visible_nodes to_node
      ON to_node.node_type = q.to_type
     AND to_node.node_id = q.to_id
    JOIN public.v_ontology_reasoning_edges current_edge
      ON current_edge.id = q.edge_id
    JOIN visible_nodes current_edge_subject
      ON current_edge_subject.node_type = current_edge.subject_type
     AND current_edge_subject.node_id = current_edge.subject_id
    JOIN visible_nodes current_edge_object
      ON current_edge_object.node_type = current_edge.object_type
     AND current_edge_object.node_id = current_edge.object_id
    WHERE true
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(q.path_nodes) AS pn(node_key)
          LEFT JOIN visible_nodes path_node
            ON path_node.node_type = split_part(pn.node_key, ':', 1)
           AND path_node.node_id = regexp_replace(pn.node_key, '^[^:]+:', '')
          WHERE path_node.node_id IS NULL
      )
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(q.path_edges) AS pe(edge_id)
          JOIN public.v_ontology_reasoning_edges path_edge
            ON path_edge.id = pe.edge_id
          LEFT JOIN visible_nodes path_edge_subject
            ON path_edge_subject.node_type = path_edge.subject_type
           AND path_edge_subject.node_id = path_edge.subject_id
          LEFT JOIN visible_nodes path_edge_object
            ON path_edge_object.node_type = path_edge.object_type
           AND path_edge_object.node_id = path_edge.object_id
          WHERE path_edge_subject.node_id IS NULL
             OR path_edge_object.node_id IS NULL
      )
    ORDER BY q.depth, q.edge_direction, q.predicate, q.to_type, q.to_id, q.edge_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
$$;

COMMENT ON FUNCTION public.agent_query_ontology_kg_neighbors(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) IS
    'Agent-safe role-scoped ontology KG neighbor traversal';

CREATE OR REPLACE FUNCTION public.agent_find_ontology_kg_paths(
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
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    raw_paths AS (
        SELECT p.*
        FROM public.find_ontology_kg_paths(
            p_source_type,
            p_source_id,
            p_target_type,
            p_target_id,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 4), 4)),
            p_direction,
            GREATEST(20, LEAST(COALESCE(p_limit, 20) * 10, 200))
        ) p
    )
    SELECT p.*
    FROM raw_paths p
    JOIN visible_nodes source_node
      ON source_node.node_type = p_source_type
     AND source_node.node_id = p_source_id
    JOIN visible_nodes target_node
      ON target_node.node_type = p_target_type
     AND target_node.node_id = p_target_id
    WHERE true
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(p.path_nodes) AS pn(node_key)
          LEFT JOIN visible_nodes path_node
            ON path_node.node_type = split_part(pn.node_key, ':', 1)
           AND path_node.node_id = regexp_replace(pn.node_key, '^[^:]+:', '')
          WHERE path_node.node_id IS NULL
      )
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(p.path_edges) AS pe(edge_id)
          JOIN public.v_ontology_reasoning_edges path_edge
            ON path_edge.id = pe.edge_id
          LEFT JOIN visible_nodes path_edge_subject
            ON path_edge_subject.node_type = path_edge.subject_type
           AND path_edge_subject.node_id = path_edge.subject_id
          LEFT JOIN visible_nodes path_edge_object
            ON path_edge_object.node_type = path_edge.object_type
           AND path_edge_object.node_id = path_edge.object_id
          WHERE path_edge_subject.node_id IS NULL
             OR path_edge_object.node_id IS NULL
      )
    ORDER BY p.depth, p.path_text
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

COMMENT ON FUNCTION public.agent_find_ontology_kg_paths(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) IS
    'Agent-safe role-scoped ontology KG path search';

CREATE OR REPLACE FUNCTION public.agent_explain_ontology_path(
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
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    raw_paths AS (
        SELECT p.*
        FROM public.explain_ontology_path(
            p_subject_type,
            p_subject_id,
            p_object_type,
            p_object_id,
            GREATEST(1, LEAST(COALESCE(p_max_depth, 4), 4))
        ) p
    )
    SELECT p.*
    FROM raw_paths p
    JOIN visible_nodes subject_node
      ON subject_node.node_type = p_subject_type
     AND subject_node.node_id = p_subject_id
    JOIN visible_nodes terminal_node
      ON terminal_node.node_type = p.terminal_type
     AND terminal_node.node_id = p.terminal_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p.path_facts) AS fact(item)
        LEFT JOIN visible_nodes subject_visible
          ON subject_visible.node_type = fact.item ->> 'subject_type'
         AND subject_visible.node_id = fact.item ->> 'subject_id'
        LEFT JOIN visible_nodes object_visible
          ON object_visible.node_type = fact.item ->> 'object_type'
         AND object_visible.node_id = fact.item ->> 'object_id'
        WHERE subject_visible.node_id IS NULL
           OR object_visible.node_id IS NULL
    )
    ORDER BY p.depth, p.path_text
    LIMIT 100;
$$;

COMMENT ON FUNCTION public.agent_explain_ontology_path(TEXT, TEXT, TEXT, TEXT, INTEGER) IS
    'Agent-safe role-scoped ontology path explanation';

CREATE OR REPLACE FUNCTION public.agent_explain_role_ontology_access(
    p_role_code TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 200
)
RETURNS TABLE(
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
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_roles AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    )
    SELECT e.*
    FROM public.explain_role_ontology_access(
        CASE
            WHEN public.ontology_current_is_super() THEN NULLIF(p_role_code, '')
            ELSE NULL
        END,
        GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000))
    ) e
    WHERE public.ontology_current_is_super()
       OR e.role_code IN (SELECT role_code FROM visible_roles)
    ORDER BY
        CASE e.predicate
            WHEN 'risk:canAccessSensitiveColumn' THEN 1
            WHEN 'acl:canAccessTable' THEN 2
            WHEN 'acl:canOperateTable' THEN 3
            WHEN 'acl:canAccessApp' THEN 4
            ELSE 5
        END,
        e.role_code,
        e.target_type,
        e.target_id,
        e.fact_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;

COMMENT ON FUNCTION public.agent_explain_role_ontology_access(TEXT, INTEGER) IS
    'Agent-safe role access explanation; non-super roles can inspect only themselves';

CREATE OR REPLACE FUNCTION public.agent_ontology_context(
    p_query TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 80
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH params AS (
        SELECT
            NULLIF(p_query, '') AS query_text,
            GREATEST(10, LEAST(COALESCE(p_limit, 80), 200)) AS row_limit
    ),
    role_codes AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    permissions AS (
        SELECT permission_code FROM public.ontology_current_permissions()
    ),
    accessible_tables AS (
        SELECT table_id, access_level FROM public.ontology_current_accessible_tables()
    ),
    visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    table_rows AS (
        SELECT
            t.table_schema,
            t.table_name,
            t.semantic_name,
            t.semantic_description,
            t.semantic_domain,
            t.semantic_class,
            t.is_business,
            at.access_level,
            t.tags
        FROM accessible_tables at
        JOIN public.ontology_table_semantics t
          ON at.table_id = t.table_schema || '.' || t.table_name
        CROSS JOIN params p
        WHERE t.is_active = true
          AND (
              p.query_text IS NULL
              OR t.table_schema || '.' || t.table_name ILIKE '%' || p.query_text || '%'
              OR t.semantic_name ILIKE '%' || p.query_text || '%'
              OR t.semantic_description ILIKE '%' || p.query_text || '%'
              OR t.semantic_domain ILIKE '%' || p.query_text || '%'
              OR t.semantic_class ILIKE '%' || p.query_text || '%'
          )
        ORDER BY t.semantic_domain, t.table_schema, t.table_name
        LIMIT (SELECT row_limit FROM params)
    ),
    column_rows AS (
        SELECT
            c.table_schema,
            c.table_name,
            c.column_name,
            c.semantic_name,
            c.semantic_class,
            c.data_type,
            c.ui_type,
            c.is_sensitive,
            c.tags
        FROM public.ontology_column_semantics c
        JOIN accessible_tables at
          ON at.table_id = c.table_schema || '.' || c.table_name
        JOIN visible_nodes vn
          ON vn.node_type = 'column'
         AND vn.node_id = c.table_schema || '.' || c.table_name || '.' || c.column_name
        CROSS JOIN params p
        WHERE c.is_active = true
          AND (
              p.query_text IS NULL
              OR c.table_schema || '.' || c.table_name || '.' || c.column_name ILIKE '%' || p.query_text || '%'
              OR c.semantic_name ILIKE '%' || p.query_text || '%'
              OR c.semantic_class ILIKE '%' || p.query_text || '%'
          )
        ORDER BY c.table_schema, c.table_name, c.column_name
        LIMIT LEAST((SELECT row_limit * 8 FROM params), 1000)
    ),
    relation_rows AS (
        SELECT
            r.id,
            r.relation_type,
            r.subject_table,
            r.subject_column,
            r.predicate,
            r.object_table,
            r.object_column,
            r.bridge_table,
            r.subject_semantic_name,
            r.object_semantic_name,
            r.details
        FROM app_data.ontology_table_relations r
        JOIN accessible_tables st ON st.table_id = r.subject_table
        JOIN accessible_tables ot ON ot.table_id = r.object_table
        CROSS JOIN params p
        WHERE (
              p.query_text IS NULL
              OR r.subject_table ILIKE '%' || p.query_text || '%'
              OR r.object_table ILIKE '%' || p.query_text || '%'
              OR r.subject_semantic_name ILIKE '%' || p.query_text || '%'
              OR r.object_semantic_name ILIKE '%' || p.query_text || '%'
              OR r.predicate ILIKE '%' || p.query_text || '%'
        )
        ORDER BY r.relation_type, r.subject_table, r.object_table, r.predicate
        LIMIT LEAST((SELECT row_limit * 3 FROM params), 500)
    ),
    app_rows AS (
        SELECT DISTINCT
            v.app_id::TEXT AS app_id,
            v.app_name,
            v.app_type,
            v.permission_code,
            v.acl_module,
            v.qualified_table,
            v.semantic_name,
            v.semantic_domain,
            v.semantic_class
        FROM public.v_app_form_ontology v
        JOIN public.ontology_current_accessible_apps() a ON a.app_id = v.app_id::TEXT
        CROSS JOIN params p
        WHERE (
              p.query_text IS NULL
              OR v.app_name ILIKE '%' || p.query_text || '%'
              OR v.permission_code ILIKE '%' || p.query_text || '%'
              OR v.qualified_table ILIKE '%' || p.query_text || '%'
              OR v.semantic_name ILIKE '%' || p.query_text || '%'
        )
        ORDER BY v.app_name, v.app_id::TEXT
        LIMIT (SELECT row_limit FROM params)
    ),
    permission_rows AS (
        SELECT
            po.code,
            po.scope,
            po.semantic_kind,
            po.entity_key,
            po.action_key
        FROM public.v_permission_ontology po
        JOIN permissions p ON p.permission_code = po.code
        ORDER BY po.code
        LIMIT LEAST((SELECT row_limit * 4 FROM params), 500)
    ),
    node_rows AS (
        SELECT n.*
        FROM public.agent_search_ontology_kg_nodes(
            (SELECT query_text FROM params),
            NULL,
            (SELECT row_limit FROM params)
        ) n
    ),
    health AS (
        SELECT row_to_json(h)::jsonb AS value
        FROM public.v_ontology_reasoning_health h
        LIMIT 1
    )
    SELECT jsonb_build_object(
        'fetchedAt', NOW(),
        'source', 'agent_ontology_context_v1',
        'accessPolicy', jsonb_build_object(
            'roleScoped', true,
            'superUser', public.ontology_current_is_super(),
            'username', public.ontology_current_username(),
            'roles', COALESCE((SELECT jsonb_agg(role_code ORDER BY role_code) FROM role_codes), '[]'::jsonb),
            'permissionCount', COALESCE((SELECT COUNT(*) FROM permissions), 0),
            'sensitiveColumnPolicy', 'hide unless current role can access the column'
        ),
        'health', COALESCE((SELECT value FROM health), '{}'::jsonb),
        'tables', COALESCE((
            SELECT jsonb_agg(to_jsonb(t) ORDER BY t.semantic_domain, t.table_schema, t.table_name)
            FROM table_rows t
        ), '[]'::jsonb),
        'columns', COALESCE((
            SELECT jsonb_object_agg(table_id, columns)
            FROM (
                SELECT
                    c.table_schema || '.' || c.table_name AS table_id,
                    jsonb_agg(jsonb_build_object(
                        'col', c.column_name,
                        'name', c.semantic_name,
                        'cls', c.semantic_class,
                        'type', c.data_type,
                        'ui', c.ui_type,
                        'sensitive', c.is_sensitive
                    ) ORDER BY c.column_name) AS columns
                FROM column_rows c
                GROUP BY c.table_schema, c.table_name
            ) grouped
        ), '{}'::jsonb),
        'relations', COALESCE((
            SELECT jsonb_agg(to_jsonb(r) ORDER BY r.relation_type, r.subject_table, r.object_table)
            FROM relation_rows r
        ), '[]'::jsonb),
        'apps', COALESCE((
            SELECT jsonb_agg(to_jsonb(a) ORDER BY a.app_name, a.app_id)
            FROM app_rows a
        ), '[]'::jsonb),
        'permissions', COALESCE((
            SELECT jsonb_agg(to_jsonb(p) ORDER BY p.code)
            FROM permission_rows p
        ), '[]'::jsonb),
        'kgNodes', COALESCE((
            SELECT jsonb_agg(to_jsonb(n) ORDER BY n.total_degree DESC, n.node_type, n.node_label)
            FROM node_rows n
        ), '[]'::jsonb)
    );
$$;

COMMENT ON FUNCTION public.agent_ontology_context(TEXT, INTEGER) IS
    'Compact role-scoped ontology/KG context for all agents';

CREATE OR REPLACE FUNCTION public.agent_ontology_reasoning_facts(
    p_predicate TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 200
)
RETURNS TABLE(
    id BIGINT,
    subject_type TEXT,
    subject_id TEXT,
    subject_label TEXT,
    predicate TEXT,
    object_type TEXT,
    object_id TEXT,
    object_label TEXT,
    inference_rule TEXT,
    rule_name TEXT,
    inference_depth INTEGER,
    is_inferred BOOLEAN,
    evidence JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
    SELECT
        f.id,
        f.subject_type,
        f.subject_id,
        f.subject_label,
        f.predicate,
        f.object_type,
        f.object_id,
        f.object_label,
        f.inference_rule,
        f.rule_name,
        f.inference_depth,
        f.is_inferred,
        f.evidence
    FROM public.v_ontology_reasoning_facts f
    JOIN visible_nodes s
      ON s.node_type = f.subject_type
     AND s.node_id = f.subject_id
    JOIN visible_nodes o
      ON o.node_type = f.object_type
     AND o.node_id = f.object_id
    WHERE NULLIF(p_predicate, '') IS NULL OR f.predicate = p_predicate
    ORDER BY f.is_inferred DESC, f.inference_depth ASC, f.id ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;

COMMENT ON FUNCTION public.agent_ontology_reasoning_facts(TEXT, INTEGER) IS
    'Agent-safe role-scoped ontology reasoning facts';

CREATE OR REPLACE FUNCTION public.agent_ontology_reasoning_summary()
RETURNS TABLE(
    last_run_status TEXT,
    facts_total INTEGER,
    seed_facts INTEGER,
    inferred_facts INTEGER,
    active_rules INTEGER,
    role_app_access_facts INTEGER,
    role_table_access_facts INTEGER,
    workflow_transition_facts INTEGER,
    sensitive_exposure_facts INTEGER,
    transitive_dependency_facts INTEGER,
    last_finished_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    visible_facts AS (
        SELECT f.*
        FROM public.v_ontology_reasoning_facts f
        JOIN visible_nodes s
          ON s.node_type = f.subject_type
         AND s.node_id = f.subject_id
        JOIN visible_nodes o
          ON o.node_type = f.object_type
         AND o.node_id = f.object_id
    ),
    latest AS (
        SELECT s.last_run_status, s.last_finished_at
        FROM public.v_ontology_reasoning_summary s
        LIMIT 1
    )
    SELECT
        COALESCE((SELECT last_run_status FROM latest), 'unknown') AS last_run_status,
        COUNT(*)::INTEGER AS facts_total,
        COUNT(*) FILTER (WHERE NOT vf.is_inferred)::INTEGER AS seed_facts,
        COUNT(*) FILTER (WHERE vf.is_inferred)::INTEGER AS inferred_facts,
        (SELECT COUNT(*)::INTEGER FROM public.ontology_inference_rules r WHERE r.is_active = true) AS active_rules,
        COUNT(*) FILTER (WHERE vf.predicate = 'acl:canAccessApp')::INTEGER AS role_app_access_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'acl:canAccessTable')::INTEGER AS role_table_access_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'wf:canPerformTransition')::INTEGER AS workflow_transition_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'risk:canAccessSensitiveColumn')::INTEGER AS sensitive_exposure_facts,
        COUNT(*) FILTER (WHERE vf.predicate = 'ontology:transitivelyDependsOn')::INTEGER AS transitive_dependency_facts,
        (SELECT last_finished_at FROM latest) AS last_finished_at
    FROM visible_facts vf;
$$;

COMMENT ON FUNCTION public.agent_ontology_reasoning_summary() IS
    'Agent-safe role-scoped reasoning summary';

CREATE OR REPLACE FUNCTION public.agent_ontology_reasoning_health()
RETURNS TABLE(
    id INTEGER,
    is_healthy BOOLEAN,
    health_code TEXT,
    facts_total INTEGER,
    inferred_facts INTEGER,
    api_relations INTEGER,
    semanticized_relations INTEGER,
    ontology_columns INTEGER,
    semanticized_columns INTEGER,
    missing_relation_semantics INTEGER,
    missing_column_semantics INTEGER,
    last_run_status TEXT,
    last_finished_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH summary AS (
        SELECT * FROM public.agent_ontology_reasoning_summary()
    ),
    accessible_tables AS (
        SELECT table_id FROM public.ontology_current_accessible_tables()
    ),
    visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    relation_rows AS (
        SELECT r.*
        FROM app_data.ontology_table_relations r
        JOIN accessible_tables st ON st.table_id = r.subject_table
        JOIN accessible_tables ot ON ot.table_id = r.object_table
    ),
    column_rows AS (
        SELECT c.*
        FROM public.ontology_column_semantics c
        JOIN visible_nodes n
          ON n.node_type = 'column'
         AND n.node_id = c.table_schema || '.' || c.table_name || '.' || c.column_name
        WHERE c.is_active = true
    ),
    counts AS (
        SELECT
            (SELECT COUNT(*)::INTEGER FROM relation_rows) AS api_relations,
            (SELECT COUNT(*)::INTEGER FROM relation_rows r WHERE COALESCE(r.subject_semantic_name, '') <> '' AND COALESCE(r.object_semantic_name, '') <> '') AS semanticized_relations,
            (SELECT COUNT(*)::INTEGER FROM relation_rows r WHERE COALESCE(r.subject_semantic_name, '') = '' OR COALESCE(r.object_semantic_name, '') = '') AS missing_relation_semantics,
            (SELECT COUNT(*)::INTEGER FROM column_rows) AS ontology_columns,
            (SELECT COUNT(*)::INTEGER FROM column_rows c WHERE COALESCE(c.semantic_name, '') <> '') AS semanticized_columns,
            (SELECT COUNT(*)::INTEGER FROM column_rows c WHERE COALESCE(c.semantic_name, '') = '') AS missing_column_semantics
    )
    SELECT
        1::INTEGER AS id,
        (s.last_run_status = 'completed' AND c.missing_relation_semantics = 0 AND c.missing_column_semantics = 0) AS is_healthy,
        CASE
            WHEN s.last_run_status <> 'completed' THEN 'reasoning_not_completed'
            WHEN c.missing_relation_semantics > 0 OR c.missing_column_semantics > 0 THEN 'scoped_semantic_gaps'
            ELSE 'scoped_ok'
        END AS health_code,
        s.facts_total,
        s.inferred_facts,
        c.api_relations,
        c.semanticized_relations,
        c.ontology_columns,
        c.semanticized_columns,
        c.missing_relation_semantics,
        c.missing_column_semantics,
        s.last_run_status,
        s.last_finished_at
    FROM summary s
    CROSS JOIN counts c;
$$;

COMMENT ON FUNCTION public.agent_ontology_reasoning_health() IS
    'Agent-safe role-scoped reasoning health and semantic coverage';

CREATE OR REPLACE FUNCTION public.agent_ontology_role_access_insights(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    role_code TEXT,
    role_name TEXT,
    accessible_apps INTEGER,
    accessible_tables INTEGER,
    operable_tables INTEGER,
    sensitive_columns INTEGER,
    sensitive_tables INTEGER,
    inferred_permission_paths INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_roles AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    )
    SELECT
        v.role_code,
        v.role_name,
        v.accessible_apps,
        v.accessible_tables,
        v.operable_tables,
        v.sensitive_columns,
        v.sensitive_tables,
        v.inferred_permission_paths
    FROM public.v_ontology_role_access_insights v
    WHERE public.ontology_current_is_super()
       OR v.role_code IN (SELECT role_code FROM visible_roles)
    ORDER BY v.sensitive_columns DESC, v.accessible_apps DESC, v.role_code ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

COMMENT ON FUNCTION public.agent_ontology_role_access_insights(INTEGER) IS
    'Agent-safe role access insight rows';

CREATE OR REPLACE FUNCTION public.agent_ontology_table_impact_insights(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    table_id TEXT,
    table_label TEXT,
    sensitive_columns INTEGER,
    roles_can_access INTEGER,
    roles_can_operate INTEGER,
    direct_dependent_tables INTEGER,
    transitive_dependent_tables INTEGER,
    depends_on_tables INTEGER,
    has_reasoning_impact BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    SELECT
        v.table_id,
        v.table_label,
        v.sensitive_columns,
        v.roles_can_access,
        v.roles_can_operate,
        v.direct_dependent_tables,
        v.transitive_dependent_tables,
        v.depends_on_tables,
        v.has_reasoning_impact
    FROM public.v_ontology_table_impact_insights v
    JOIN public.ontology_current_accessible_tables() t ON t.table_id = v.table_id
    WHERE v.has_reasoning_impact = true
    ORDER BY v.transitive_dependent_tables DESC, v.roles_can_access DESC, v.table_id ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

COMMENT ON FUNCTION public.agent_ontology_table_impact_insights(INTEGER) IS
    'Agent-safe table impact insights filtered by current role table access';

CREATE OR REPLACE FUNCTION public.agent_ontology_reasoning_rule_stats(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    rule_code TEXT,
    rule_name TEXT,
    declared_predicate TEXT,
    facts_total INTEGER,
    seed_facts INTEGER,
    inferred_facts INTEGER,
    predicate_count INTEGER,
    is_active BOOLEAN,
    min_depth INTEGER,
    max_depth INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    ),
    visible_facts AS (
        SELECT f.*
        FROM public.v_ontology_reasoning_facts f
        JOIN visible_nodes s
          ON s.node_type = f.subject_type
         AND s.node_id = f.subject_id
        JOIN visible_nodes o
          ON o.node_type = f.object_type
         AND o.node_id = f.object_id
    ),
    fact_stats AS (
        SELECT
            vf.inference_rule AS rule_code,
            COUNT(*)::INTEGER AS facts_total,
            COUNT(*) FILTER (WHERE NOT vf.is_inferred)::INTEGER AS seed_facts,
            COUNT(*) FILTER (WHERE vf.is_inferred)::INTEGER AS inferred_facts,
            COUNT(DISTINCT vf.predicate)::INTEGER AS predicate_count,
            MIN(vf.inference_depth)::INTEGER AS min_depth,
            MAX(vf.inference_depth)::INTEGER AS max_depth
        FROM visible_facts vf
        GROUP BY vf.inference_rule
    )
    SELECT
        r.rule_code,
        r.rule_name,
        r.predicate AS declared_predicate,
        COALESCE(fs.facts_total, 0)::INTEGER AS facts_total,
        COALESCE(fs.seed_facts, 0)::INTEGER AS seed_facts,
        COALESCE(fs.inferred_facts, 0)::INTEGER AS inferred_facts,
        COALESCE(fs.predicate_count, 0)::INTEGER AS predicate_count,
        r.is_active,
        fs.min_depth,
        fs.max_depth
    FROM public.ontology_inference_rules r
    LEFT JOIN fact_stats fs ON fs.rule_code = r.rule_code
    WHERE public.ontology_current_is_super()
       OR COALESCE(fs.facts_total, 0) > 0
    ORDER BY COALESCE(fs.inferred_facts, 0) DESC, COALESCE(fs.facts_total, 0) DESC, r.rule_code ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

COMMENT ON FUNCTION public.agent_ontology_reasoning_rule_stats(INTEGER) IS
    'Agent-safe reasoning rule stats based on visible facts';

CREATE OR REPLACE FUNCTION public.agent_ontology_sensitive_access_paths(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    role_code TEXT,
    role_name TEXT,
    table_id TEXT,
    table_label TEXT,
    column_id TEXT,
    column_name TEXT,
    column_label TEXT,
    access_rule TEXT,
    access_predicate TEXT,
    inference_rule TEXT,
    rule_name TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
    WITH visible_roles AS (
        SELECT role_code FROM public.ontology_current_role_codes()
    ),
    visible_nodes AS MATERIALIZED (
        SELECT node_type, node_id FROM public.ontology_agent_visible_nodes()
    )
    SELECT
        v.role_code,
        v.role_name,
        v.table_id,
        v.table_label,
        v.column_id,
        v.column_name,
        v.column_label,
        v.access_rule,
        v.access_predicate,
        v.inference_rule,
        v.rule_name
    FROM public.v_ontology_sensitive_access_paths v
    JOIN public.ontology_current_accessible_tables() t ON t.table_id = v.table_id
    JOIN visible_nodes c ON c.node_type = 'column' AND c.node_id = v.column_id
    WHERE public.ontology_current_is_super()
       OR v.role_code IN (SELECT role_code FROM visible_roles)
    ORDER BY v.role_code ASC, v.table_id ASC, v.column_name ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

COMMENT ON FUNCTION public.agent_ontology_sensitive_access_paths(INTEGER) IS
    'Agent-safe sensitive access path rows';

CREATE OR REPLACE FUNCTION public.agent_upsert_ontology_table_semantic(
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, app_data, app_center, workflow, pg_temp
AS $$
DECLARE
    v_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
    v_table_schema TEXT;
    v_table_name TEXT;
    v_semantic_domain TEXT;
    v_semantic_class TEXT;
    v_semantic_name TEXT;
    v_semantic_description TEXT;
    v_is_business BOOLEAN;
    v_is_active BOOLEAN;
    v_tags JSONB;
    v_row public.ontology_table_semantics%ROWTYPE;
BEGIN
    IF NOT public.ontology_current_can_manage_semantics() THEN
        RAISE EXCEPTION 'ontology semantic write denied for current role'
            USING ERRCODE = '42501';
    END IF;

    v_table_schema := NULLIF(btrim(v_payload ->> 'table_schema'), '');
    v_table_name := NULLIF(btrim(v_payload ->> 'table_name'), '');

    IF v_table_schema IS NULL OR v_table_name IS NULL THEN
        RAISE EXCEPTION 'table_schema and table_name are required'
            USING ERRCODE = '22023';
    END IF;

    IF v_table_schema !~ '^[A-Za-z_][A-Za-z0-9_]*$'
       OR v_table_name !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN
        RAISE EXCEPTION 'table_schema or table_name is invalid'
            USING ERRCODE = '22023';
    END IF;

    v_semantic_domain := COALESCE(NULLIF(btrim(v_payload ->> 'semantic_domain'), ''), 'general');
    v_semantic_class := COALESCE(NULLIF(btrim(v_payload ->> 'semantic_class'), ''), 'entity');
    v_semantic_name := COALESCE(
        NULLIF(btrim(v_payload ->> 'semantic_name'), ''),
        NULLIF(btrim(v_payload ->> 'semantic_label'), ''),
        NULLIF(btrim(v_payload ->> 'label'), ''),
        v_table_name
    );
    v_semantic_description := COALESCE(
        NULLIF(btrim(v_payload ->> 'semantic_description'), ''),
        NULLIF(btrim(v_payload ->> 'description'), ''),
        ''
    );
    v_is_business := COALESCE((v_payload ->> 'is_business')::boolean, true);
    v_is_active := COALESCE((v_payload ->> 'is_active')::boolean, true);
    v_tags := CASE
        WHEN jsonb_typeof(v_payload -> 'tags') IS NOT NULL THEN v_payload -> 'tags'
        ELSE '[]'::jsonb
    END;

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
    VALUES (
        v_table_schema,
        v_table_name,
        v_semantic_domain,
        v_semantic_class,
        v_semantic_name,
        v_semantic_description,
        v_is_business,
        v_is_active,
        v_tags,
        now()
    )
    ON CONFLICT (table_schema, table_name)
    DO UPDATE SET
        semantic_domain = EXCLUDED.semantic_domain,
        semantic_class = EXCLUDED.semantic_class,
        semantic_name = EXCLUDED.semantic_name,
        semantic_description = EXCLUDED.semantic_description,
        is_business = EXCLUDED.is_business,
        is_active = EXCLUDED.is_active,
        tags = EXCLUDED.tags,
        updated_at = now()
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.agent_upsert_ontology_table_semantic(JSONB) IS
    'Agent-safe ontology table semantic upsert for ontology admins only';

REVOKE EXECUTE ON FUNCTION public.search_ontology_kg_nodes(TEXT, TEXT, INTEGER) FROM PUBLIC, web_user;
REVOKE EXECUTE ON FUNCTION public.query_ontology_kg_neighbors(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, web_user;
REVOKE EXECUTE ON FUNCTION public.find_ontology_kg_paths(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC, web_user;
REVOKE EXECUTE ON FUNCTION public.explain_ontology_path(TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, web_user;
REVOKE EXECUTE ON FUNCTION public.explain_role_ontology_access(TEXT, INTEGER) FROM PUBLIC, web_user;

REVOKE EXECUTE ON FUNCTION public.agent_search_ontology_kg_nodes(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_query_ontology_kg_neighbors(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_find_ontology_kg_paths(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_explain_ontology_path(TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_explain_role_ontology_access(TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_context(TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_reasoning_facts(TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_reasoning_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_reasoning_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_role_access_insights(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_table_impact_insights(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_reasoning_rule_stats(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_ontology_sensitive_access_paths(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.agent_upsert_ontology_table_semantic(JSONB) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.ontology_current_claims() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_username() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_role_codes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_permissions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_is_super() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_can_manage_semantics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_accessible_apps() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_accessible_tables() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_current_accessible_sensitive_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_agent_visible_nodes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_agent_can_access_node(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ontology_agent_can_access_edge(BIGINT) FROM PUBLIC;

REVOKE SELECT ON TABLE public.ontology_table_semantics FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.ontology_column_semantics FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.ontology_inference_rules FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.ontology_inferred_facts FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.ontology_reasoning_runs FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_coverage_audit FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_kg_nodes FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_reasoning_edges FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_reasoning_facts FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_reasoning_health FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_reasoning_rule_stats FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_reasoning_summary FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_role_access_insights FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_sensitive_access_paths FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_table_dependency_paths FROM PUBLIC, web_user;
REVOKE SELECT ON TABLE public.v_ontology_table_impact_insights FROM PUBLIC, web_user;

GRANT EXECUTE ON FUNCTION public.ontology_current_claims() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_username() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_role_codes() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_permissions() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_is_super() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_can_manage_semantics() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_accessible_apps() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_accessible_tables() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_current_accessible_sensitive_columns() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_agent_visible_nodes() TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_agent_can_access_node(TEXT, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION public.ontology_agent_can_access_edge(BIGINT) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_search_ontology_kg_nodes(TEXT, TEXT, INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_query_ontology_kg_neighbors(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_find_ontology_kg_paths(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_explain_ontology_path(TEXT, TEXT, TEXT, TEXT, INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_explain_role_ontology_access(TEXT, INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_context(TEXT, INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_reasoning_facts(TEXT, INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_reasoning_summary() TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_reasoning_health() TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_role_access_insights(INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_table_impact_insights(INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_reasoning_rule_stats(INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_ontology_sensitive_access_paths(INTEGER) TO web_user;
GRANT EXECUTE ON FUNCTION public.agent_upsert_ontology_table_semantic(JSONB) TO web_user;

COMMIT;
