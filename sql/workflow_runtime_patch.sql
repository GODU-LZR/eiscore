-- Patch: workflow runtime assignment enforcement + audit logs
-- Execute:
--   cat sql/workflow_runtime_patch.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

CREATE TABLE IF NOT EXISTS workflow.instance_events (
    id SERIAL PRIMARY KEY,
    instance_id INT NOT NULL REFERENCES workflow.instances(id) ON DELETE CASCADE,
    definition_id INT REFERENCES workflow.definitions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    from_task_id TEXT,
    to_task_id TEXT,
    actor_username TEXT,
    actor_role TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workflow.definitions
    ADD COLUMN IF NOT EXISTS app_id UUID REFERENCES app_center.apps(id) ON DELETE CASCADE;
ALTER TABLE workflow.definitions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE workflow.instances
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE workflow.instances
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_workflow_instance_events_definition_time
    ON workflow.instance_events(definition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_instance_events_instance_time
    ON workflow.instance_events(instance_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'task_assignments_definition_task_key'
          AND conrelid = 'workflow.task_assignments'::regclass
    ) THEN
        ALTER TABLE workflow.task_assignments
            ADD CONSTRAINT task_assignments_definition_task_key UNIQUE (definition_id, task_id);
    END IF;
END $$;

ALTER TABLE workflow.definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.instance_events ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA workflow TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow.definitions TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow.instances TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow.task_assignments TO web_user;
GRANT SELECT ON workflow.instance_events TO web_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workflow TO web_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA workflow GRANT USAGE, SELECT ON SEQUENCES TO web_user;

DROP POLICY IF EXISTS workflow_admin_all ON workflow.definitions;
DROP POLICY IF EXISTS workflow_instances_all ON workflow.instances;
DROP POLICY IF EXISTS workflow_assign_all ON workflow.task_assignments;

DROP POLICY IF EXISTS workflow_definitions_select ON workflow.definitions;
CREATE POLICY workflow_definitions_select ON workflow.definitions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS workflow_definitions_insert ON workflow.definitions;
CREATE POLICY workflow_definitions_insert ON workflow.definitions
    FOR INSERT WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_definitions_update ON workflow.definitions;
CREATE POLICY workflow_definitions_update ON workflow.definitions
    FOR UPDATE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    )
    WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_definitions_delete ON workflow.definitions;
CREATE POLICY workflow_definitions_delete ON workflow.definitions
    FOR DELETE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_instances_select ON workflow.instances;
CREATE POLICY workflow_instances_select ON workflow.instances
    FOR SELECT USING (true);

DROP POLICY IF EXISTS workflow_instances_insert ON workflow.instances;
CREATE POLICY workflow_instances_insert ON workflow.instances
    FOR INSERT WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_instances_update ON workflow.instances;
CREATE POLICY workflow_instances_update ON workflow.instances
    FOR UPDATE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    )
    WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_instances_delete ON workflow.instances;
CREATE POLICY workflow_instances_delete ON workflow.instances
    FOR DELETE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_assign_select ON workflow.task_assignments;
CREATE POLICY workflow_assign_select ON workflow.task_assignments
    FOR SELECT USING (true);

DROP POLICY IF EXISTS workflow_assign_insert ON workflow.task_assignments;
CREATE POLICY workflow_assign_insert ON workflow.task_assignments
    FOR INSERT WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_assign_update ON workflow.task_assignments;
CREATE POLICY workflow_assign_update ON workflow.task_assignments
    FOR UPDATE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    )
    WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_assign_delete ON workflow.task_assignments;
CREATE POLICY workflow_assign_delete ON workflow.task_assignments
    FOR DELETE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_events_select ON workflow.instance_events;
CREATE POLICY workflow_events_select ON workflow.instance_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS workflow_events_insert ON workflow.instance_events;
CREATE POLICY workflow_events_insert ON workflow.instance_events
    FOR INSERT WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_events_update ON workflow.instance_events;
CREATE POLICY workflow_events_update ON workflow.instance_events
    FOR UPDATE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    )
    WITH CHECK (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

DROP POLICY IF EXISTS workflow_events_delete ON workflow.instance_events;
CREATE POLICY workflow_events_delete ON workflow.instance_events
    FOR DELETE USING (
        COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role') = 'super_admin', false)
    );

CREATE OR REPLACE FUNCTION workflow.current_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION workflow.can_execute_task(
    p_definition_id INT,
    p_task_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = workflow, public
AS $$
DECLARE
    v_claims jsonb := workflow.current_claims();
    v_role TEXT := COALESCE(v_claims ->> 'app_role', '');
    v_username TEXT := COALESCE(v_claims ->> 'username', '');
    v_has_assignment BOOLEAN := false;
BEGIN
    IF p_task_id IS NULL OR btrim(p_task_id) = '' THEN
        RETURN true;
    END IF;

    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM workflow.task_assignments ta
        WHERE ta.definition_id = p_definition_id
          AND ta.task_id = p_task_id
    ) INTO v_has_assignment;

    IF NOT v_has_assignment THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM workflow.task_assignments ta
        WHERE ta.definition_id = p_definition_id
          AND ta.task_id = p_task_id
          AND (
              COALESCE(array_length(ta.candidate_roles, 1), 0) = 0
              OR v_role = ANY(ta.candidate_roles)
          )
          AND (
              COALESCE(array_length(ta.candidate_users, 1), 0) = 0
              OR v_username = ANY(ta.candidate_users)
          )
    );
END;
$$;

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
    v_created workflow.instances%ROWTYPE;
BEGIN
    IF p_definition_id IS NULL THEN
        RAISE EXCEPTION 'definition_id is required' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM workflow.definitions d WHERE d.id = p_definition_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'workflow definition % not found', p_definition_id USING ERRCODE = 'P0002';
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
        RAISE EXCEPTION '流程实例已完成，不能重复推进' USING ERRCODE = 'P0001';
    END IF;

    IF NOT workflow.can_execute_task(v_current.definition_id, v_current.current_task_id) THEN
        RAISE EXCEPTION '当前任务未分配给当前账号，无法执行' USING ERRCODE = '42501';
    END IF;

    IF NOT v_complete AND v_next_task_id IS NULL THEN
        RAISE EXCEPTION 'next_task_id is required when complete is false' USING ERRCODE = '22023';
    END IF;

    v_from_task := v_current.current_task_id;

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

REVOKE ALL ON FUNCTION workflow.current_claims() FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.can_execute_task(INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.start_workflow_instance(INT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.transition_workflow_instance(INT, TEXT, BOOLEAN, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION workflow.current_claims() TO web_user;
GRANT EXECUTE ON FUNCTION workflow.can_execute_task(INT, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.start_workflow_instance(INT, TEXT, TEXT, JSONB) TO web_user;
GRANT EXECUTE ON FUNCTION workflow.transition_workflow_instance(INT, TEXT, BOOLEAN, JSONB) TO web_user;
