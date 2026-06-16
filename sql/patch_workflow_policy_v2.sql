-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: workflow ontology V2 policy and explicit transition rules.
-- Execute:
--   cat sql/patch_workflow_policy_v2.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) V2 policy storage
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_center.workflow_permission_policies (
    id SERIAL PRIMARY KEY,
    workflow_app_id UUID NOT NULL REFERENCES app_center.apps(id) ON DELETE CASCADE,
    acl_module TEXT NOT NULL,
    permission_mode TEXT NOT NULL DEFAULT 'compat',
    enforce_assignment BOOLEAN NOT NULL DEFAULT true,
    enforce_workflow_op_perm BOOLEAN NOT NULL DEFAULT true,
    enforce_status_transition_perm BOOLEAN NOT NULL DEFAULT true,
    legacy_fallback_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workflow_permission_policies_app_key UNIQUE (workflow_app_id),
    CONSTRAINT workflow_permission_policies_mode_check CHECK (permission_mode IN ('compat', 'strict'))
);

CREATE TABLE IF NOT EXISTS app_center.workflow_transition_rules (
    id SERIAL PRIMARY KEY,
    workflow_app_id UUID NOT NULL REFERENCES app_center.apps(id) ON DELETE CASCADE,
    from_task_id TEXT,
    to_task_id TEXT,
    from_state TEXT,
    to_state TEXT,
    required_permission TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workflow_transition_rules_distinct_state CHECK (
        from_state IS NULL OR to_state IS NULL OR from_state <> to_state
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_transition_rules_unique_active
    ON app_center.workflow_transition_rules (
        workflow_app_id,
        COALESCE(from_task_id, ''),
        COALESCE(to_task_id, ''),
        COALESCE(from_state, ''),
        COALESCE(to_state, '')
    )
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workflow_transition_rules_app
    ON app_center.workflow_transition_rules(workflow_app_id, is_active);

ALTER TABLE app_center.workflow_state_mappings
    ADD COLUMN IF NOT EXISTS from_state TEXT;

ALTER TABLE app_center.workflow_state_mappings
    ADD COLUMN IF NOT EXISTS mapping_mode TEXT NOT NULL DEFAULT 'task_arrival';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workflow_state_mappings_mode_check'
          AND conrelid = 'app_center.workflow_state_mappings'::regclass
    ) THEN
        ALTER TABLE app_center.workflow_state_mappings
            ADD CONSTRAINT workflow_state_mappings_mode_check
            CHECK (mapping_mode IN ('task_arrival', 'transition'));
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.workflow_permission_policies TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.workflow_transition_rules TO web_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_center TO web_user;
GRANT SELECT ON public.v_role_permissions TO web_user;

ALTER TABLE app_center.workflow_permission_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_center.workflow_transition_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_permission_policies_select ON app_center.workflow_permission_policies;
CREATE POLICY workflow_permission_policies_select ON app_center.workflow_permission_policies
    FOR SELECT USING (true);

DROP POLICY IF EXISTS workflow_permission_policies_insert ON app_center.workflow_permission_policies;
CREATE POLICY workflow_permission_policies_insert ON app_center.workflow_permission_policies
    FOR INSERT WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_permission_policies_update ON app_center.workflow_permission_policies;
CREATE POLICY workflow_permission_policies_update ON app_center.workflow_permission_policies
    FOR UPDATE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    )
    WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_permission_policies_delete ON app_center.workflow_permission_policies;
CREATE POLICY workflow_permission_policies_delete ON app_center.workflow_permission_policies
    FOR DELETE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_transition_rules_select ON app_center.workflow_transition_rules;
CREATE POLICY workflow_transition_rules_select ON app_center.workflow_transition_rules
    FOR SELECT USING (true);

DROP POLICY IF EXISTS workflow_transition_rules_insert ON app_center.workflow_transition_rules;
CREATE POLICY workflow_transition_rules_insert ON app_center.workflow_transition_rules
    FOR INSERT WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_transition_rules_update ON app_center.workflow_transition_rules;
CREATE POLICY workflow_transition_rules_update ON app_center.workflow_transition_rules
    FOR UPDATE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    )
    WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_transition_rules_delete ON app_center.workflow_transition_rules;
CREATE POLICY workflow_transition_rules_delete ON app_center.workflow_transition_rules
    FOR DELETE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

-- Default every existing workflow app to the old behavior: compat + legacy fallback.
INSERT INTO app_center.workflow_permission_policies (
    workflow_app_id,
    acl_module,
    permission_mode,
    enforce_assignment,
    enforce_workflow_op_perm,
    enforce_status_transition_perm,
    legacy_fallback_enabled
)
SELECT
    a.id,
    COALESCE(
        NULLIF(TRIM(a.config ->> 'aclModule'), ''),
        'app_' || replace(a.id::text, '-', '')
    ) AS acl_module,
    CASE
        WHEN lower(COALESCE(NULLIF(TRIM(a.config ->> 'permission_mode'), ''), 'compat')) IN ('compat', 'strict')
            THEN lower(COALESCE(NULLIF(TRIM(a.config ->> 'permission_mode'), ''), 'compat'))
        ELSE 'compat'
    END AS permission_mode,
    true,
    true,
    true,
    true
FROM app_center.apps a
WHERE a.app_type = 'workflow'
ON CONFLICT (workflow_app_id) DO UPDATE
SET acl_module = EXCLUDED.acl_module,
    permission_mode = EXCLUDED.permission_mode,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 2) Workflow V2 helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION workflow.resolve_workflow_permission_policy(
    p_definition_id INT,
    p_app_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_policy JSONB;
BEGIN
    SELECT jsonb_build_object(
        'workflow_app_id', COALESCE(a.id::text, ''),
        'acl_module', COALESCE(
            NULLIF(TRIM(p.acl_module), ''),
            NULLIF(TRIM(a.config ->> 'aclModule'), ''),
            NULLIF(TRIM(p_app_key), ''),
            ''
        ),
        'permission_mode', CASE
            WHEN lower(COALESCE(NULLIF(TRIM(p.permission_mode), ''), NULLIF(TRIM(a.config ->> 'permission_mode'), ''), 'compat')) IN ('compat', 'strict')
                THEN lower(COALESCE(NULLIF(TRIM(p.permission_mode), ''), NULLIF(TRIM(a.config ->> 'permission_mode'), ''), 'compat'))
            ELSE 'compat'
        END,
        'enforce_assignment', COALESCE(p.enforce_assignment, true),
        'enforce_workflow_op_perm', COALESCE(p.enforce_workflow_op_perm, true),
        'enforce_status_transition_perm', COALESCE(p.enforce_status_transition_perm, true),
        'legacy_fallback_enabled', COALESCE(p.legacy_fallback_enabled, true),
        'source', CASE WHEN p.id IS NULL THEN 'default' ELSE 'policy' END
    )
    INTO v_policy
    FROM workflow.definitions d
    LEFT JOIN app_center.apps a ON a.id = d.app_id
    LEFT JOIN app_center.workflow_permission_policies p ON p.workflow_app_id = a.id
    WHERE d.id = p_definition_id
    LIMIT 1;

    RETURN COALESCE(
        v_policy,
        jsonb_build_object(
            'workflow_app_id', '',
            'acl_module', COALESCE(NULLIF(TRIM(p_app_key), ''), ''),
            'permission_mode', 'compat',
            'enforce_assignment', true,
            'enforce_workflow_op_perm', true,
            'enforce_status_transition_perm', true,
            'legacy_fallback_enabled', true,
            'source', 'default'
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION workflow.resolve_transition_rule(
    p_definition_id INT,
    p_from_task_id TEXT,
    p_to_task_id TEXT,
    p_app_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_workflow_app_id UUID;
    v_from_state TEXT;
    v_to_state TEXT;
    v_rule app_center.workflow_transition_rules%ROWTYPE;
    v_rule_found BOOLEAN := false;
    v_required_permission TEXT;
BEGIN
    SELECT d.app_id
      INTO v_workflow_app_id
      FROM workflow.definitions d
     WHERE d.id = p_definition_id
     LIMIT 1;

    v_from_state := workflow.resolve_mapped_state_value(p_definition_id, p_from_task_id);
    v_to_state := workflow.resolve_mapped_state_value(p_definition_id, p_to_task_id);

    IF v_workflow_app_id IS NOT NULL THEN
        SELECT *
          INTO v_rule
          FROM app_center.workflow_transition_rules r
         WHERE r.workflow_app_id = v_workflow_app_id
           AND r.is_active = true
           AND (r.from_task_id IS NULL OR r.from_task_id = p_from_task_id)
           AND (r.to_task_id IS NULL OR r.to_task_id = p_to_task_id)
           AND (
                r.from_state IS NULL
                OR v_from_state IS NULL
                OR workflow.normalize_status_token(r.from_state) = workflow.normalize_status_token(v_from_state)
           )
           AND (
                r.to_state IS NULL
                OR v_to_state IS NULL
                OR workflow.normalize_status_token(r.to_state) = workflow.normalize_status_token(v_to_state)
           )
         ORDER BY
           (CASE WHEN r.from_task_id IS NULL THEN 0 ELSE 1 END
            + CASE WHEN r.to_task_id IS NULL THEN 0 ELSE 1 END
            + CASE WHEN r.from_state IS NULL THEN 0 ELSE 1 END
            + CASE WHEN r.to_state IS NULL THEN 0 ELSE 1 END) DESC,
           r.id DESC
         LIMIT 1;
        v_rule_found := FOUND;
    END IF;

    IF v_rule_found THEN
        v_from_state := COALESCE(NULLIF(TRIM(v_rule.from_state), ''), v_from_state);
        v_to_state := COALESCE(NULLIF(TRIM(v_rule.to_state), ''), v_to_state);
        v_required_permission := NULLIF(TRIM(v_rule.required_permission), '');
    END IF;

    IF v_required_permission IS NULL
       AND NULLIF(TRIM(COALESCE(p_app_key, '')), '') IS NOT NULL
       AND v_from_state IS NOT NULL
       AND v_to_state IS NOT NULL
       AND v_from_state <> v_to_state THEN
        v_required_permission := format(
            'op:%s.status_transition.%s_%s',
            p_app_key,
            workflow.normalize_status_token(v_from_state),
            workflow.normalize_status_token(v_to_state)
        );
    END IF;

    RETURN jsonb_build_object(
        'found', v_rule_found,
        'rule_id', CASE WHEN v_rule_found THEN v_rule.id ELSE NULL END,
        'workflow_app_id', COALESCE(v_workflow_app_id::text, ''),
        'from_task_id', COALESCE(NULLIF(TRIM(p_from_task_id), ''), ''),
        'to_task_id', COALESCE(NULLIF(TRIM(p_to_task_id), ''), ''),
        'from_state', COALESCE(v_from_state, ''),
        'to_state', COALESCE(v_to_state, ''),
        'required_permission', COALESCE(v_required_permission, '')
    );
END;
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
    v_rule JSONB;
    v_from_state TEXT;
    v_to_state TEXT;
    v_code TEXT;
BEGIN
    IF p_app_key IS NULL OR btrim(p_app_key) = '' THEN
        RETURN true;
    END IF;

    v_rule := workflow.resolve_transition_rule(p_definition_id, p_from_task_id, p_to_task_id, p_app_key);
    v_from_state := NULLIF(v_rule ->> 'from_state', '');
    v_to_state := NULLIF(v_rule ->> 'to_state', '');
    v_code := NULLIF(v_rule ->> 'required_permission', '');

    IF v_from_state IS NULL OR v_to_state IS NULL OR v_from_state = v_to_state THEN
        RETURN true;
    END IF;

    IF v_code IS NULL THEN
        v_code := format(
            'op:%s.status_transition.%s_%s',
            p_app_key,
            workflow.normalize_status_token(v_from_state),
            workflow.normalize_status_token(v_to_state)
        );
    END IF;

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
-- 3) Workflow RPC with V2 policy branching
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
    v_policy JSONB;
    v_enforce_workflow_op_perm BOOLEAN := true;
    v_legacy_fallback_enabled BOOLEAN := true;
    v_required_perms TEXT[];
    v_created workflow.instances%ROWTYPE;
    v_state_apply JSONB := '{}'::jsonb;
    v_event_id INT;
BEGIN
    IF p_definition_id IS NULL THEN
        RAISE EXCEPTION 'definition_id is required' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM workflow.definitions d WHERE d.id = p_definition_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'workflow definition % not found', p_definition_id USING ERRCODE = 'P0002';
    END IF;

    v_app_key := workflow.resolve_app_acl_key(p_definition_id);
    v_policy := workflow.resolve_workflow_permission_policy(p_definition_id, v_app_key);
    v_enforce_workflow_op_perm := COALESCE((v_policy ->> 'enforce_workflow_op_perm')::boolean, true);
    v_legacy_fallback_enabled := COALESCE((v_policy ->> 'legacy_fallback_enabled')::boolean, true);

    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' AND v_enforce_workflow_op_perm THEN
        v_required_perms := ARRAY[format('op:%s.workflow_start', v_app_key)];
        IF v_legacy_fallback_enabled THEN
            v_required_perms := v_required_perms || format('op:%s.create', v_app_key);
        END IF;

        IF NOT workflow.claim_has_any_permission(v_claims, v_required_perms) THEN
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
            'variables', COALESCE(p_variables, '{}'::jsonb),
            'policy', v_policy
        )
    )
    RETURNING id INTO v_event_id;

    v_state_apply := workflow.apply_mapped_state_to_business(
        v_created.definition_id,
        v_created.current_task_id,
        v_created.business_key
    );

    UPDATE workflow.instance_events
    SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('state_apply', v_state_apply)
    WHERE id = v_event_id;

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
    v_actor_key TEXT := COALESCE(NULLIF(btrim(v_claims ->> 'username'), ''), '__unknown__');
    v_next_task_id TEXT := NULLIF(btrim(COALESCE(p_next_task_id, '')), '');
    v_complete BOOLEAN := COALESCE(p_complete, false);
    v_current workflow.instances%ROWTYPE;
    v_updated workflow.instances%ROWTYPE;
    v_from_task TEXT;
    v_app_key TEXT;
    v_policy JSONB;
    v_permission_mode TEXT := 'compat';
    v_enforce_assignment BOOLEAN := true;
    v_enforce_workflow_op_perm BOOLEAN := true;
    v_enforce_status_transition_perm BOOLEAN := true;
    v_legacy_fallback_enabled BOOLEAN := true;
    v_required_perm TEXT;
    v_fallback_perm TEXT;
    v_required_perms TEXT[];
    v_from_state TEXT;
    v_to_state TEXT;
    v_transition_rule JSONB;
    v_transition_rule_found BOOLEAN := false;
    v_transition_perm TEXT;
    v_state_apply JSONB := '{}'::jsonb;
    v_event_id INT;
    v_assignment workflow.task_assignments%ROWTYPE;
    v_approval_mode TEXT := 'any';
    v_required_approvals INT := 1;
    v_require_comment BOOLEAN := false;
    v_approval_comment TEXT := NULLIF(
        btrim(
            COALESCE(
                p_variables ->> 'approval_comment',
                p_variables ->> 'comment',
                p_variables ->> 'opinion',
                ''
            )
        ),
        ''
    );
    v_approval_count INT := 0;
    v_needs_quorum BOOLEAN := false;
    v_payload JSONB := COALESCE(p_variables, '{}'::jsonb);
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

    IF NOT v_complete AND v_next_task_id IS NULL THEN
        RAISE EXCEPTION 'next_task_id is required when complete is false' USING ERRCODE = '22023';
    END IF;

    v_from_task := v_current.current_task_id;
    v_app_key := workflow.resolve_app_acl_key(v_current.definition_id);
    v_policy := workflow.resolve_workflow_permission_policy(v_current.definition_id, v_app_key);
    v_permission_mode := COALESCE(NULLIF(v_policy ->> 'permission_mode', ''), 'compat');
    v_enforce_assignment := COALESCE((v_policy ->> 'enforce_assignment')::boolean, true);
    v_enforce_workflow_op_perm := COALESCE((v_policy ->> 'enforce_workflow_op_perm')::boolean, true);
    v_enforce_status_transition_perm := COALESCE((v_policy ->> 'enforce_status_transition_perm')::boolean, true);
    v_legacy_fallback_enabled := COALESCE((v_policy ->> 'legacy_fallback_enabled')::boolean, true);

    IF v_enforce_assignment AND NOT workflow.can_execute_task(v_current.definition_id, v_current.current_task_id) THEN
        RAISE EXCEPTION 'current task is not assigned to current actor' USING ERRCODE = '42501';
    END IF;

    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' AND v_enforce_workflow_op_perm THEN
        v_required_perm := format(
            'op:%s.%s',
            v_app_key,
            CASE WHEN v_complete THEN 'workflow_complete' ELSE 'workflow_transition' END
        );
        v_fallback_perm := format('op:%s.edit', v_app_key);
        v_required_perms := ARRAY[v_required_perm];
        IF v_legacy_fallback_enabled THEN
            v_required_perms := v_required_perms || v_fallback_perm;
        END IF;

        IF NOT workflow.claim_has_any_permission(v_claims, v_required_perms) THEN
            RAISE EXCEPTION 'workflow transition permission required'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_complete AND v_enforce_status_transition_perm THEN
            v_transition_rule := workflow.resolve_transition_rule(
                v_current.definition_id,
                v_from_task,
                v_next_task_id,
                v_app_key
            );
            v_transition_rule_found := COALESCE((v_transition_rule ->> 'found')::boolean, false);
            v_from_state := NULLIF(v_transition_rule ->> 'from_state', '');
            v_to_state := NULLIF(v_transition_rule ->> 'to_state', '');
            v_transition_perm := NULLIF(v_transition_rule ->> 'required_permission', '');

            IF v_permission_mode = 'strict' AND NOT v_transition_rule_found THEN
                RAISE EXCEPTION 'status transition rule required'
                    USING ERRCODE = '42501';
            END IF;

            IF v_permission_mode = 'strict' AND (v_from_state IS NULL OR v_to_state IS NULL) THEN
                RAISE EXCEPTION 'status transition state mapping required'
                    USING ERRCODE = '42501';
            END IF;

            IF v_from_state IS NOT NULL
               AND v_to_state IS NOT NULL
               AND v_from_state <> v_to_state THEN
                IF v_transition_perm IS NULL THEN
                    v_transition_perm := format(
                        'op:%s.status_transition.%s_%s',
                        v_app_key,
                        workflow.normalize_status_token(v_from_state),
                        workflow.normalize_status_token(v_to_state)
                    );
                END IF;

                IF NOT workflow.claim_has_permission(v_claims, v_transition_perm)
                   AND NOT (
                        v_legacy_fallback_enabled
                        AND workflow.claim_has_permission(v_claims, format('op:%s.edit', v_app_key))
                   ) THEN
                    RAISE EXCEPTION 'status transition permission required (% -> %)',
                        COALESCE(v_from_state, '?'),
                        COALESCE(v_to_state, '?')
                        USING ERRCODE = '42501';
                END IF;
            END IF;
        END IF;
    END IF;

    SELECT *
    INTO v_assignment
    FROM workflow.task_assignments ta
    WHERE ta.definition_id = v_current.definition_id
      AND ta.task_id = v_from_task
    ORDER BY ta.id DESC
    LIMIT 1;

    IF FOUND THEN
        v_approval_mode := lower(COALESCE(NULLIF(btrim(v_assignment.approval_mode), ''), 'any'));
        IF v_approval_mode NOT IN ('any', 'quota', 'all') THEN
            v_approval_mode := 'any';
        END IF;
        v_require_comment := COALESCE(v_assignment.require_comment, false);
        v_required_approvals := GREATEST(COALESCE(v_assignment.required_approvals, 1), 1);
        IF v_approval_mode = 'all' AND COALESCE(array_length(v_assignment.candidate_users, 1), 0) > 0 THEN
            v_required_approvals := GREATEST(array_length(v_assignment.candidate_users, 1), 1);
        END IF;
    END IF;

    IF v_require_comment AND v_approval_comment IS NULL THEN
        RAISE EXCEPTION 'approval comment required' USING ERRCODE = '22023';
    END IF;

    IF v_from_task IS NOT NULL AND btrim(v_from_task) <> '' THEN
        INSERT INTO workflow.task_approvals (
            instance_id,
            definition_id,
            task_id,
            actor_username,
            actor_role,
            decision,
            comment,
            payload,
            created_at,
            updated_at
        )
        VALUES (
            v_current.id,
            v_current.definition_id,
            v_from_task,
            v_actor_key,
            v_actor_role,
            'approved',
            v_approval_comment,
            v_payload,
            NOW(),
            NOW()
        )
        ON CONFLICT (instance_id, task_id, actor_username) DO UPDATE
        SET actor_role = EXCLUDED.actor_role,
            decision = EXCLUDED.decision,
            comment = EXCLUDED.comment,
            payload = EXCLUDED.payload,
            updated_at = NOW();
    END IF;

    v_needs_quorum := v_approval_mode IN ('quota', 'all') AND v_required_approvals > 1;
    IF v_needs_quorum AND v_from_task IS NOT NULL AND btrim(v_from_task) <> '' THEN
        SELECT COUNT(*) INTO v_approval_count
        FROM workflow.task_approvals ta
        WHERE ta.instance_id = v_current.id
          AND ta.task_id = v_from_task
          AND ta.decision = 'approved';

        IF v_approval_count < v_required_approvals THEN
            UPDATE workflow.instances
            SET variables = COALESCE(variables, '{}'::jsonb) || v_payload
            WHERE id = p_instance_id
            RETURNING * INTO v_updated;

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
                'TASK_APPROVAL_RECORDED',
                v_from_task,
                v_from_task,
                v_actor,
                v_actor_role,
                jsonb_build_object(
                    'approval', jsonb_build_object(
                        'mode', v_approval_mode,
                        'required', v_required_approvals,
                        'approved', v_approval_count,
                        'comment', COALESCE(v_approval_comment, '')
                    ),
                    'policy', v_policy,
                    'transition_rule', COALESCE(v_transition_rule, '{}'::jsonb)
                ) || v_payload
            )
            RETURNING id INTO v_event_id;

            v_state_apply := workflow.apply_mapped_state_to_business(
                v_updated.definition_id,
                v_from_task,
                v_updated.business_key
            );

            UPDATE workflow.instance_events
            SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('state_apply', v_state_apply)
            WHERE id = v_event_id;

            RETURN v_updated;
        END IF;
    END IF;

    IF v_complete THEN
        UPDATE workflow.instances
        SET current_task_id = NULL,
            status = 'COMPLETED',
            ended_at = COALESCE(ended_at, NOW()),
            variables = COALESCE(variables, '{}'::jsonb) || v_payload
        WHERE id = p_instance_id
        RETURNING * INTO v_updated;
    ELSE
        UPDATE workflow.instances
        SET current_task_id = v_next_task_id,
            status = 'ACTIVE',
            ended_at = NULL,
            variables = COALESCE(variables, '{}'::jsonb) || v_payload
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
        jsonb_build_object(
            'approval', jsonb_build_object(
                'mode', v_approval_mode,
                'required', v_required_approvals,
                'approved', GREATEST(v_approval_count, 1),
                'comment', COALESCE(v_approval_comment, '')
            ),
            'policy', v_policy,
            'transition_rule', COALESCE(v_transition_rule, '{}'::jsonb)
        ) || v_payload
    )
    RETURNING id INTO v_event_id;

    v_state_apply := workflow.apply_mapped_state_to_business(
        v_updated.definition_id,
        CASE WHEN v_complete THEN v_from_task ELSE v_updated.current_task_id END,
        v_updated.business_key
    );

    UPDATE workflow.instance_events
    SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('state_apply', v_state_apply)
    WHERE id = v_event_id;

    RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION workflow.resolve_workflow_permission_policy(INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.resolve_transition_rule(INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.check_state_transition_permission(INT, TEXT, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.start_workflow_instance(INT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.transition_workflow_instance(INT, TEXT, BOOLEAN, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION workflow.resolve_workflow_permission_policy(INT, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.resolve_transition_rule(INT, TEXT, TEXT, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.check_state_transition_permission(INT, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.start_workflow_instance(INT, TEXT, TEXT, JSONB) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.transition_workflow_instance(INT, TEXT, BOOLEAN, JSONB) TO web_user;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
