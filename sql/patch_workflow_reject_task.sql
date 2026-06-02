-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: add an explicit workflow rejection RPC.
-- Usage:
--   cat sql/patch_workflow_reject_task.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

CREATE OR REPLACE FUNCTION workflow.reject_workflow_task(
    p_instance_id INT,
    p_comment TEXT DEFAULT NULL,
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
    v_actor_key TEXT := COALESCE(NULLIF(btrim(v_claims ->> 'username'), ''), '__unknown__');
    v_current workflow.instances%ROWTYPE;
    v_updated workflow.instances%ROWTYPE;
    v_from_task TEXT;
    v_app_key TEXT;
    v_comment TEXT := NULLIF(
        btrim(
            COALESCE(
                p_comment,
                p_variables ->> 'approval_comment',
                p_variables ->> 'comment',
                p_variables ->> 'opinion',
                ''
            )
        ),
        ''
    );
    v_payload JSONB := COALESCE(p_variables, '{}'::jsonb);
    v_require_comment BOOLEAN := false;
    v_event_id INT;
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

    v_from_task := v_current.current_task_id;
    v_app_key := workflow.resolve_app_acl_key(v_current.definition_id);

    IF v_app_key IS NOT NULL AND btrim(v_app_key) <> '' THEN
        IF NOT workflow.claim_has_any_permission(
            v_claims,
            ARRAY[
                format('op:%s.workflow_transition', v_app_key),
                format('op:%s.workflow_complete', v_app_key),
                format('op:%s.edit', v_app_key)
            ]
        ) THEN
            RAISE EXCEPTION 'workflow transition permission required'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT COALESCE(ta.require_comment, false)
    INTO v_require_comment
    FROM workflow.task_assignments ta
    WHERE ta.definition_id = v_current.definition_id
      AND ta.task_id = v_from_task
    ORDER BY ta.id DESC
    LIMIT 1;

    IF COALESCE(v_require_comment, false) AND v_comment IS NULL THEN
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
            'rejected',
            v_comment,
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

    UPDATE workflow.instances
    SET current_task_id = NULL,
        status = 'COMPLETED',
        ended_at = COALESCE(ended_at, NOW()),
        variables = COALESCE(variables, '{}'::jsonb) || v_payload || jsonb_build_object('rejected', true)
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
        'TASK_REJECTED',
        v_from_task,
        NULL,
        v_actor,
        v_actor_role,
        jsonb_build_object(
            'approval', jsonb_build_object(
                'decision', 'rejected',
                'comment', COALESCE(v_comment, '')
            )
        ) || v_payload
    )
    RETURNING id INTO v_event_id;

    UPDATE workflow.instance_events
    SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
        'state_apply',
        jsonb_build_object('applied', false, 'reason', 'workflow_rejected')
    )
    WHERE id = v_event_id;

    RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION workflow.reject_workflow_task(INT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow.reject_workflow_task(INT, TEXT, JSONB) TO web_user;

NOTIFY pgrst, 'reload schema';
