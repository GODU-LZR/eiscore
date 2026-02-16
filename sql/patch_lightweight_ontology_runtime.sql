-- Patch: lightweight ontology runtime landing (compatible with existing permission codes)
-- Execute:
--   cat sql/patch_lightweight_ontology_runtime.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

-- -----------------------------------------------------------------------------
-- 1) Ontology projection: parse permission codes to semantic fields
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_permission_ontology AS
WITH normalized AS (
    SELECT
        p.id,
        p.code,
        p.name,
        p.module,
        p.action,
        split_part(p.code, ':', 1) AS scope,
        NULLIF(split_part(p.code, ':', 2), '') AS suffix
    FROM public.permissions p
),
parsed AS (
    SELECT
        n.*,
        CASE WHEN n.scope = 'module' THEN n.suffix END AS module_key,
        CASE WHEN n.scope = 'app' THEN n.suffix END AS app_key,
        CASE WHEN n.scope = 'op' THEN NULLIF(split_part(n.suffix, '.', 1), '') END AS op_app_key,
        CASE
            WHEN n.scope = 'op' AND position('.' IN n.suffix) > 0
                THEN substring(n.suffix FROM position('.' IN n.suffix) + 1)
            ELSE NULL
        END AS op_action
    FROM normalized n
)
SELECT
    id,
    code,
    name,
    module,
    action,
    scope,
    COALESCE(op_app_key, app_key, module_key) AS entity_key,
    op_action AS action_key,
    CASE
        WHEN scope = 'op' AND op_action LIKE 'status_transition.%' THEN 'status_transition'
        WHEN scope = 'op' AND op_action LIKE 'workflow_%' THEN 'workflow'
        WHEN scope = 'op' THEN 'operation'
        WHEN scope = 'app' THEN 'app'
        WHEN scope = 'module' THEN 'module'
        ELSE 'unknown'
    END AS semantic_kind,
    CASE
        WHEN scope = 'op' AND op_action LIKE 'status_transition.%'
            THEN NULLIF(split_part(split_part(op_action, 'status_transition.', 2), '_', 1), '')
        ELSE NULL
    END AS transition_from,
    CASE
        WHEN scope = 'op' AND op_action LIKE 'status_transition.%'
            THEN NULLIF(substring(split_part(op_action, 'status_transition.', 2) FROM '^[^_]+_(.+)$'), '')
        ELSE NULL
    END AS transition_to
FROM parsed;

COMMENT ON VIEW public.v_permission_ontology IS 'Lightweight ontology projection for permission semantics';
GRANT SELECT ON public.v_permission_ontology TO web_user;

-- -----------------------------------------------------------------------------
-- 2) Permission seeding for workflow/status (non-breaking, old codes remain valid)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_workflow_status_permissions(
    p_role_codes TEXT[] DEFAULT ARRAY['super_admin']
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INTEGER := 0;
BEGIN
    WITH app_catalog AS (
        SELECT
            split_part(p.code, ':', 2) AS app_key,
            MAX(
                COALESCE(
                    NULLIF(split_part(p.name, '-', 2), ''),
                    NULLIF(p.name, ''),
                    split_part(p.code, ':', 2)
                )
            ) AS app_label
        FROM public.permissions p
        WHERE p.code LIKE 'app:%'
        GROUP BY 1
    ),
    transitions AS (
        SELECT *
        FROM (
            VALUES
                ('created', 'active', 'created', 'active'),
                ('created', 'locked', 'created', 'locked'),
                ('active', 'locked', 'active', 'locked'),
                ('active', 'created', 'active', 'created'),
                ('locked', 'active', 'locked', 'active'),
                ('locked', 'created', 'locked', 'created')
        ) AS t(from_state, to_state, from_label, to_label)
    ),
    generated AS (
        SELECT
            format('op:%s.workflow_start', a.app_key) AS code,
            format('%s-workflow-start', a.app_label) AS name,
            a.app_label AS module,
            'workflow_start' AS action
        FROM app_catalog a
        UNION ALL
        SELECT
            format('op:%s.workflow_transition', a.app_key),
            format('%s-workflow-transition', a.app_label),
            a.app_label,
            'workflow_transition'
        FROM app_catalog a
        UNION ALL
        SELECT
            format('op:%s.workflow_complete', a.app_key),
            format('%s-workflow-complete', a.app_label),
            a.app_label,
            'workflow_complete'
        FROM app_catalog a
        UNION ALL
        SELECT
            format('op:%s.status_transition.%s_%s', a.app_key, t.from_state, t.to_state),
            format('%s-status-transition-%s-to-%s', a.app_label, t.from_label, t.to_label),
            a.app_label,
            'status_transition'
        FROM app_catalog a
        CROSS JOIN transitions t
    ),
    upserted AS (
        INSERT INTO public.permissions (code, name, module, action)
        SELECT g.code, g.name, g.module, g.action
        FROM generated g
        ON CONFLICT (code) DO UPDATE
            SET name = EXCLUDED.name,
                module = EXCLUDED.module,
                action = EXCLUDED.action,
                updated_at = NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_total FROM upserted;

    WITH app_catalog AS (
        SELECT
            split_part(p.code, ':', 2) AS app_key,
            MAX(
                COALESCE(
                    NULLIF(split_part(p.name, '-', 2), ''),
                    NULLIF(p.name, ''),
                    split_part(p.code, ':', 2)
                )
            ) AS app_label
        FROM public.permissions p
        WHERE p.code LIKE 'app:%'
        GROUP BY 1
    ),
    transitions AS (
        SELECT *
        FROM (
            VALUES
                ('created', 'active'),
                ('created', 'locked'),
                ('active', 'locked'),
                ('active', 'created'),
                ('locked', 'active'),
                ('locked', 'created')
        ) AS t(from_state, to_state)
    ),
    generated AS (
        SELECT format('op:%s.workflow_start', a.app_key) AS code
        FROM app_catalog a
        UNION ALL
        SELECT format('op:%s.workflow_transition', a.app_key)
        FROM app_catalog a
        UNION ALL
        SELECT format('op:%s.workflow_complete', a.app_key)
        FROM app_catalog a
        UNION ALL
        SELECT format('op:%s.status_transition.%s_%s', a.app_key, t.from_state, t.to_state)
        FROM app_catalog a
        CROSS JOIN transitions t
    )
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM generated g
    JOIN public.permissions p ON p.code = g.code
    JOIN public.roles r ON r.code = ANY(p_role_codes)
    ON CONFLICT DO NOTHING;

    RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.seed_workflow_status_permissions(TEXT[]) IS 'Seed workflow/status permissions for existing app:* codes';

-- Seed now for super_admin to make new ontology permissions immediately usable.
SELECT public.seed_workflow_status_permissions(ARRAY['super_admin']);

-- -----------------------------------------------------------------------------
-- 3) Workflow helpers: claims + permission checks (compat mode)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION workflow.claim_permissions(
    p_claims JSONB DEFAULT workflow.current_claims()
)
RETURNS TEXT[]
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(p_claims -> 'permissions', '[]'::jsonb))
        ),
        ARRAY[]::text[]
    );
$$;

CREATE OR REPLACE FUNCTION workflow.claim_has_permission(
    p_claims JSONB,
    p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_role TEXT := COALESCE(p_claims ->> 'app_role', p_claims ->> 'role', '');
BEGIN
    IF p_code IS NULL OR btrim(p_code) = '' THEN
        RETURN true;
    END IF;

    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    RETURN p_code = ANY(workflow.claim_permissions(p_claims));
END;
$$;

CREATE OR REPLACE FUNCTION workflow.claim_has_any_permission(
    p_claims JSONB,
    p_codes TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF p_codes IS NULL OR COALESCE(array_length(p_codes, 1), 0) = 0 THEN
        RETURN true;
    END IF;

    FOREACH v_code IN ARRAY p_codes LOOP
        IF workflow.claim_has_permission(p_claims, v_code) THEN
            RETURN true;
        END IF;
    END LOOP;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION workflow.resolve_app_acl_key(
    p_definition_id INT
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT
        COALESCE(
            NULLIF(a.config ->> 'aclModule', ''),
            CASE
                WHEN a.id IS NOT NULL THEN 'app_' || replace(a.id::text, '-', '')
                ELSE NULL
            END
        ) AS app_key
    FROM workflow.definitions d
    LEFT JOIN app_center.apps a ON a.id = d.app_id
    WHERE d.id = p_definition_id
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION workflow.normalize_status_token(
    p_value TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NULLIF(
        trim(BOTH '_' FROM regexp_replace(lower(COALESCE(p_value, '')), '[^a-z0-9]+', '_', 'g')),
        ''
    );
$$;

CREATE OR REPLACE FUNCTION workflow.resolve_mapped_state_value(
    p_definition_id INT,
    p_task_id TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(btrim(m.state_value), '')
    FROM workflow.definitions d
    JOIN app_center.workflow_state_mappings m
      ON m.workflow_app_id = d.app_id
     AND m.bpmn_task_id = p_task_id
    WHERE d.id = p_definition_id
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION workflow.check_state_transition_permission(
    p_definition_id INT,
    p_app_key TEXT,
    p_from_task_id TEXT,
    p_to_task_id TEXT,
    p_claims JSONB DEFAULT workflow.current_claims(),
    p_allow_edit_fallback BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_from_state TEXT;
    v_to_state TEXT;
    v_code TEXT;
BEGIN
    IF p_app_key IS NULL OR btrim(p_app_key) = '' THEN
        RETURN true;
    END IF;

    v_from_state := workflow.resolve_mapped_state_value(p_definition_id, p_from_task_id);
    v_to_state := workflow.resolve_mapped_state_value(p_definition_id, p_to_task_id);

    IF v_from_state IS NULL OR v_to_state IS NULL OR v_from_state = v_to_state THEN
        RETURN true;
    END IF;

    v_code := format(
        'op:%s.status_transition.%s_%s',
        p_app_key,
        workflow.normalize_status_token(v_from_state),
        workflow.normalize_status_token(v_to_state)
    );

    IF workflow.claim_has_permission(p_claims, v_code) THEN
        RETURN true;
    END IF;

    IF p_allow_edit_fallback
       AND workflow.claim_has_permission(p_claims, format('op:%s.edit', p_app_key)) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) Workflow RPC with ontology-aware permission checks (compatible fallback)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION workflow.start_workflow_instance(
    p_definition_id INT,
    p_business_key TEXT DEFAULT NULL,
    p_initial_task_id TEXT DEFAULT NULL,
    p_variables JSONB DEFAULT '{}'::jsonb
)
RETURNS workflow.instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = workflow, public
AS $$
DECLARE
    v_claims jsonb := workflow.current_claims();
    v_actor TEXT := NULLIF(btrim(v_claims ->> 'username'), '');
    v_actor_role TEXT := NULLIF(btrim(v_claims ->> 'app_role'), '');
    v_initial_task_id TEXT := NULLIF(btrim(COALESCE(p_initial_task_id, '')), '');
    v_app_key TEXT;
    v_created workflow.instances%ROWTYPE;
BEGIN
    IF p_definition_id IS NULL THEN
        RAISE EXCEPTION 'definition_id is required' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM workflow.definitions d WHERE d.id = p_definition_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'workflow definition % not found', p_definition_id USING ERRCODE = 'P0002';
    END IF;

    v_app_key := workflow.resolve_app_acl_key(p_definition_id);
    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' THEN
        IF NOT workflow.claim_has_any_permission(
            v_claims,
            ARRAY[
                format('op:%s.workflow_start', v_app_key),
                format('op:%s.create', v_app_key)
            ]
        ) THEN
            RAISE EXCEPTION 'workflow start permission required'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_initial_task_id IS NULL THEN
        SELECT ta.task_id
        INTO v_initial_task_id
        FROM workflow.task_assignments ta
        WHERE ta.definition_id = p_definition_id
        ORDER BY ta.id ASC
        LIMIT 1;
    END IF;

    INSERT INTO workflow.instances (
        definition_id,
        business_key,
        current_task_id,
        status,
        variables,
        started_at,
        ended_at
    )
    VALUES (
        p_definition_id,
        NULLIF(btrim(COALESCE(p_business_key, '')), ''),
        v_initial_task_id,
        'ACTIVE',
        COALESCE(p_variables, '{}'::jsonb),
        NOW(),
        NULL
    )
    RETURNING * INTO v_created;

    INSERT INTO workflow.instance_events (
        instance_id,
        definition_id,
        event_type,
        from_task_id,
        to_task_id,
        actor_username,
        actor_role,
        payload
    )
    VALUES (
        v_created.id,
        v_created.definition_id,
        'INSTANCE_STARTED',
        NULL,
        v_created.current_task_id,
        v_actor,
        v_actor_role,
        jsonb_build_object(
            'business_key', v_created.business_key,
            'variables', COALESCE(p_variables, '{}'::jsonb)
        )
    );

    RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION workflow.transition_workflow_instance(
    p_instance_id INT,
    p_next_task_id TEXT DEFAULT NULL,
    p_complete BOOLEAN DEFAULT false,
    p_variables JSONB DEFAULT NULL
)
RETURNS workflow.instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = workflow, public
AS $$
DECLARE
    v_claims jsonb := workflow.current_claims();
    v_actor TEXT := NULLIF(btrim(v_claims ->> 'username'), '');
    v_actor_role TEXT := NULLIF(btrim(v_claims ->> 'app_role'), '');
    v_next_task_id TEXT := NULLIF(btrim(COALESCE(p_next_task_id, '')), '');
    v_complete BOOLEAN := COALESCE(p_complete, false);
    v_current workflow.instances%ROWTYPE;
    v_updated workflow.instances%ROWTYPE;
    v_from_task TEXT;
    v_app_key TEXT;
    v_required_perm TEXT;
    v_fallback_perm TEXT;
    v_from_state TEXT;
    v_to_state TEXT;
BEGIN
    IF p_instance_id IS NULL THEN
        RAISE EXCEPTION 'instance_id is required' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_current
    FROM workflow.instances i
    WHERE i.id = p_instance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'workflow instance % not found', p_instance_id USING ERRCODE = 'P0002';
    END IF;

    IF COALESCE(v_current.status, 'ACTIVE') = 'COMPLETED' THEN
        RAISE EXCEPTION 'workflow instance already completed' USING ERRCODE = 'P0001';
    END IF;

    IF NOT workflow.can_execute_task(v_current.definition_id, v_current.current_task_id) THEN
        RAISE EXCEPTION 'current task is not assigned to current actor' USING ERRCODE = '42501';
    END IF;

    IF NOT v_complete AND v_next_task_id IS NULL THEN
        RAISE EXCEPTION 'next_task_id is required when complete is false' USING ERRCODE = '22023';
    END IF;

    v_from_task := v_current.current_task_id;
    v_app_key := workflow.resolve_app_acl_key(v_current.definition_id);

    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' THEN
        v_required_perm := format(
            'op:%s.%s',
            v_app_key,
            CASE WHEN v_complete THEN 'workflow_complete' ELSE 'workflow_transition' END
        );
        v_fallback_perm := format('op:%s.edit', v_app_key);

        IF NOT workflow.claim_has_any_permission(
            v_claims,
            ARRAY[v_required_perm, v_fallback_perm]
        ) THEN
            RAISE EXCEPTION 'workflow transition permission required'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_complete AND NOT workflow.check_state_transition_permission(
            v_current.definition_id,
            v_app_key,
            v_from_task,
            v_next_task_id,
            v_claims,
            true
        ) THEN
            v_from_state := workflow.resolve_mapped_state_value(v_current.definition_id, v_from_task);
            v_to_state := workflow.resolve_mapped_state_value(v_current.definition_id, v_next_task_id);
            RAISE EXCEPTION 'status transition permission required (% -> %)',
                COALESCE(v_from_state, '?'),
                COALESCE(v_to_state, '?')
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_complete THEN
        UPDATE workflow.instances
        SET current_task_id = NULL,
            status = 'COMPLETED',
            ended_at = COALESCE(ended_at, NOW()),
            variables = COALESCE(p_variables, variables)
        WHERE id = p_instance_id
        RETURNING * INTO v_updated;
    ELSE
        UPDATE workflow.instances
        SET current_task_id = v_next_task_id,
            status = 'ACTIVE',
            ended_at = NULL,
            variables = COALESCE(p_variables, variables)
        WHERE id = p_instance_id
        RETURNING * INTO v_updated;
    END IF;

    INSERT INTO workflow.instance_events (
        instance_id,
        definition_id,
        event_type,
        from_task_id,
        to_task_id,
        actor_username,
        actor_role,
        payload
    )
    VALUES (
        v_updated.id,
        v_updated.definition_id,
        CASE WHEN v_complete THEN 'INSTANCE_COMPLETED' ELSE 'TASK_TRANSITION' END,
        v_from_task,
        v_updated.current_task_id,
        v_actor,
        v_actor_role,
        COALESCE(p_variables, '{}'::jsonb)
    );

    RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION workflow.claim_permissions(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.claim_has_permission(JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.claim_has_any_permission(JSONB, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.resolve_app_acl_key(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.normalize_status_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.resolve_mapped_state_value(INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.check_state_transition_permission(INT, TEXT, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION workflow.claim_permissions(JSONB) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.claim_has_permission(JSONB, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.claim_has_any_permission(JSONB, TEXT[]) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.resolve_app_acl_key(INT) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.normalize_status_token(TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.resolve_mapped_state_value(INT, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.check_state_transition_permission(INT, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO web_user;

REVOKE ALL ON FUNCTION workflow.start_workflow_instance(INT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.transition_workflow_instance(INT, TEXT, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow.start_workflow_instance(INT, TEXT, TEXT, JSONB) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.transition_workflow_instance(INT, TEXT, BOOLEAN, JSONB) TO web_user;
