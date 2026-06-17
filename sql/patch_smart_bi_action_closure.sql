-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: Smart BI action closure loop.
-- Creates a business action table and a built-in BPMN workflow that routes
-- Smart BI recommendations through the existing workflow approval center.
--
-- Usage:
--   cat sql/patch_smart_bi_action_closure.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

CREATE TABLE IF NOT EXISTS public.smart_bi_action_items (
    id SERIAL PRIMARY KEY,
    action_no TEXT NOT NULL DEFAULT (
        'SBI-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(md5(random()::text), 1, 4))
    ),
    title TEXT NOT NULL,
    domain TEXT,
    risk_level TEXT,
    owner_role TEXT,
    owner_name TEXT,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT '待发起',
    source_session_id TEXT,
    source_message_time BIGINT,
    source_action_index INT,
    source_question TEXT,
    report_excerpt TEXT,
    suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
    workflow_definition_id INT REFERENCES workflow.definitions(id) ON DELETE SET NULL,
    workflow_instance_id INT REFERENCES workflow.instances(id) ON DELETE SET NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    CONSTRAINT smart_bi_action_items_action_no_key UNIQUE (action_no)
);

CREATE INDEX IF NOT EXISTS idx_smart_bi_action_items_status
    ON public.smart_bi_action_items(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_bi_action_items_source_message
    ON public.smart_bi_action_items(source_message_time, source_action_index);
CREATE INDEX IF NOT EXISTS idx_smart_bi_action_items_workflow_instance
    ON public.smart_bi_action_items(workflow_instance_id);

ALTER TABLE public.smart_bi_action_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_bi_action_items TO web_user;
GRANT USAGE, SELECT ON SEQUENCE public.smart_bi_action_items_id_seq TO web_user;

DROP POLICY IF EXISTS smart_bi_action_items_select ON public.smart_bi_action_items;
CREATE POLICY smart_bi_action_items_select ON public.smart_bi_action_items
    FOR SELECT TO web_user USING (true);

DROP POLICY IF EXISTS smart_bi_action_items_insert ON public.smart_bi_action_items;
CREATE POLICY smart_bi_action_items_insert ON public.smart_bi_action_items
    FOR INSERT TO web_user WITH CHECK (true);

DROP POLICY IF EXISTS smart_bi_action_items_update ON public.smart_bi_action_items;
CREATE POLICY smart_bi_action_items_update ON public.smart_bi_action_items
    FOR UPDATE TO web_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS smart_bi_action_items_delete ON public.smart_bi_action_items;
CREATE POLICY smart_bi_action_items_delete ON public.smart_bi_action_items
    FOR DELETE TO web_user USING (true);

CREATE OR REPLACE FUNCTION public.touch_smart_bi_action_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_bi_action_items_updated_at ON public.smart_bi_action_items;
CREATE TRIGGER trg_smart_bi_action_items_updated_at
BEFORE UPDATE ON public.smart_bi_action_items
FOR EACH ROW
EXECUTE FUNCTION public.touch_smart_bi_action_items_updated_at();

DO $$
DECLARE
    v_app_name TEXT := '智能BI经营闭环流程';
    v_app_desc TEXT := '用于将智能BI行动建议转为审批中心待办，并跟踪确认、执行、验证和闭环状态。';
    v_app_id UUID;
    v_definition_id INT;
    v_category_id INT;
    v_bpmn_xml TEXT := $bpmn$
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_SmartBIActionClosure_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_SmartBIActionClosure_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_BIAction" name="开始">
      <bpmn:outgoing>Flow_Start_To_Review</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_BIReview" name="确认经营建议">
      <bpmn:incoming>Flow_Start_To_Review</bpmn:incoming>
      <bpmn:outgoing>Flow_Review_To_Execute</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_BIExecute" name="负责人执行整改">
      <bpmn:incoming>Flow_Review_To_Execute</bpmn:incoming>
      <bpmn:outgoing>Flow_Execute_To_Verify</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_BIVerify" name="验证闭环结果">
      <bpmn:incoming>Flow_Execute_To_Verify</bpmn:incoming>
      <bpmn:outgoing>Flow_Verify_To_End</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="EndEvent_BIAction" name="结束">
      <bpmn:incoming>Flow_Verify_To_End</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Start_To_Review" sourceRef="StartEvent_BIAction" targetRef="Task_BIReview" />
    <bpmn:sequenceFlow id="Flow_Review_To_Execute" sourceRef="Task_BIReview" targetRef="Task_BIExecute" />
    <bpmn:sequenceFlow id="Flow_Execute_To_Verify" sourceRef="Task_BIExecute" targetRef="Task_BIVerify" />
    <bpmn:sequenceFlow id="Flow_Verify_To_End" sourceRef="Task_BIVerify" targetRef="EndEvent_BIAction" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_SmartBIActionClosure_1">
    <bpmndi:BPMNPlane id="BPMNPlane_SmartBIActionClosure_1" bpmnElement="Process_SmartBIActionClosure_1">
      <bpmndi:BPMNShape id="Shape_StartEvent_BIAction" bpmnElement="StartEvent_BIAction">
        <dc:Bounds x="120" y="210" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_BIReview" bpmnElement="Task_BIReview">
        <dc:Bounds x="220" y="188" width="140" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_BIExecute" bpmnElement="Task_BIExecute">
        <dc:Bounds x="430" y="188" width="140" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_BIVerify" bpmnElement="Task_BIVerify">
        <dc:Bounds x="640" y="188" width="140" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_EndEvent_BIAction" bpmnElement="EndEvent_BIAction">
        <dc:Bounds x="850" y="210" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow_Start_To_Review" bpmnElement="Flow_Start_To_Review">
        <di:waypoint x="156" y="228" />
        <di:waypoint x="220" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_Review_To_Execute" bpmnElement="Flow_Review_To_Execute">
        <di:waypoint x="360" y="228" />
        <di:waypoint x="430" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_Execute_To_Verify" bpmnElement="Flow_Execute_To_Verify">
        <di:waypoint x="570" y="228" />
        <di:waypoint x="640" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_Verify_To_End" bpmnElement="Flow_Verify_To_End">
        <di:waypoint x="780" y="228" />
        <di:waypoint x="850" y="228" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
$bpmn$;
BEGIN
    SELECT id INTO v_category_id
      FROM app_center.categories
     ORDER BY sort_order ASC, id ASC
     LIMIT 1;

    SELECT id INTO v_app_id
      FROM app_center.apps
     WHERE name = v_app_name
       AND app_type = 'workflow'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_app_id IS NULL THEN
        INSERT INTO app_center.apps (
            name, description, category_id, app_type, status, icon, version,
            config, bpmn_xml, created_by, updated_by
        )
        VALUES (
            v_app_name, v_app_desc, v_category_id, 'workflow', 'published', 'DataAnalysis',
            '1.0.0',
            jsonb_build_object(
                'table', 'public.smart_bi_action_items',
                'workflowBusinessAppId', 'table:public.smart_bi_action_items',
                'workflowAutoAdvanceEnabled', false,
                'workflowDesignerPanelMode', 'simple',
                'smartBiClosureWorkflow', true
            ),
            v_bpmn_xml, 'system', 'system'
        )
        RETURNING id INTO v_app_id;
    ELSE
        UPDATE app_center.apps
           SET description = v_app_desc,
               category_id = COALESCE(category_id, v_category_id),
               status = 'published',
               icon = 'DataAnalysis',
               bpmn_xml = v_bpmn_xml,
               config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
                   'table', 'public.smart_bi_action_items',
                   'workflowBusinessAppId', 'table:public.smart_bi_action_items',
                   'workflowAutoAdvanceEnabled', false,
                   'workflowDesignerPanelMode', 'simple',
                   'smartBiClosureWorkflow', true
               ),
               updated_by = 'system',
               updated_at = NOW()
         WHERE id = v_app_id;
    END IF;

    SELECT id INTO v_definition_id
      FROM workflow.definitions
     WHERE app_id = v_app_id
     ORDER BY id DESC
     LIMIT 1;

    IF v_definition_id IS NULL THEN
        INSERT INTO workflow.definitions (name, bpmn_xml, app_id, associated_table, updated_at)
        VALUES (v_app_name, v_bpmn_xml, v_app_id, 'public.smart_bi_action_items', NOW())
        RETURNING id INTO v_definition_id;
    ELSE
        UPDATE workflow.definitions
           SET name = v_app_name,
               bpmn_xml = v_bpmn_xml,
               associated_table = 'public.smart_bi_action_items',
               updated_at = NOW()
         WHERE id = v_definition_id;
    END IF;

    UPDATE app_center.apps
       SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
           'workflowDefinitionId', v_definition_id,
           'workflowBusinessAppId', 'table:public.smart_bi_action_items',
           'table', 'public.smart_bi_action_items',
           'smartBiClosureWorkflow', true
       ),
       updated_at = NOW()
     WHERE id = v_app_id;

    DELETE FROM workflow.task_assignments
     WHERE definition_id = v_definition_id
       AND task_id IN ('Task_BIReview', 'Task_BIExecute', 'Task_BIVerify');

    INSERT INTO workflow.task_assignments (
        definition_id, task_id, candidate_roles, candidate_users,
        approval_mode, required_approvals, require_comment
    )
    VALUES
        (v_definition_id, 'Task_BIReview', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'any', 1, false),
        (v_definition_id, 'Task_BIExecute', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'any', 1, true),
        (v_definition_id, 'Task_BIVerify', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'any', 1, true);

    INSERT INTO app_center.workflow_state_mappings (
        workflow_app_id, bpmn_task_id, target_table, state_field, state_value
    )
    VALUES
        (v_app_id, 'Task_BIReview', 'public.smart_bi_action_items', 'status', '待确认'),
        (v_app_id, 'Task_BIExecute', 'public.smart_bi_action_items', 'status', '执行中'),
        (v_app_id, 'Task_BIVerify', 'public.smart_bi_action_items', 'status', '待验证')
    ON CONFLICT (workflow_app_id, bpmn_task_id) DO UPDATE
       SET target_table = EXCLUDED.target_table,
           state_field = EXCLUDED.state_field,
           state_value = EXCLUDED.state_value;

    IF to_regclass('app_center.workflow_permission_policies') IS NOT NULL THEN
        INSERT INTO app_center.workflow_permission_policies (
            workflow_app_id,
            acl_module,
            permission_mode,
            enforce_assignment,
            enforce_workflow_op_perm,
            enforce_status_transition_perm,
            legacy_fallback_enabled
        )
        VALUES (
            v_app_id,
            'smart_bi_action_closure',
            'compat',
            true,
            false,
            false,
            true
        )
        ON CONFLICT (workflow_app_id) DO UPDATE
           SET acl_module = EXCLUDED.acl_module,
               permission_mode = EXCLUDED.permission_mode,
               enforce_assignment = EXCLUDED.enforce_assignment,
               enforce_workflow_op_perm = EXCLUDED.enforce_workflow_op_perm,
               enforce_status_transition_perm = EXCLUDED.enforce_status_transition_perm,
               legacy_fallback_enabled = EXCLUDED.legacy_fallback_enabled,
               updated_at = NOW();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_smart_bi_action_item_from_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, workflow
AS $$
DECLARE
    v_action_id_text TEXT;
    v_action_id INT;
    v_next_status TEXT;
BEGIN
    v_action_id_text := COALESCE(
        NEW.variables ->> 'smart_bi_action_item_id',
        NEW.variables #>> '{smart_bi_action,action_item_id}'
    );

    IF v_action_id_text IS NULL OR v_action_id_text !~ '^[0-9]+$' THEN
        RETURN NEW;
    END IF;

    v_action_id := v_action_id_text::INT;

    v_next_status := CASE
        WHEN COALESCE(NEW.status, '') = 'COMPLETED' THEN '已闭环'
        WHEN NEW.current_task_id = 'Task_BIReview' THEN '待确认'
        WHEN NEW.current_task_id = 'Task_BIExecute' THEN '执行中'
        WHEN NEW.current_task_id = 'Task_BIVerify' THEN '待验证'
        ELSE NULL
    END;

    UPDATE public.smart_bi_action_items
       SET workflow_definition_id = NEW.definition_id,
           workflow_instance_id = NEW.id,
           status = COALESCE(v_next_status, status),
           closed_at = CASE
               WHEN COALESCE(NEW.status, '') = 'COMPLETED' THEN COALESCE(closed_at, NOW())
               ELSE closed_at
           END,
           updated_at = NOW()
     WHERE id = v_action_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_smart_bi_action_item_from_workflow ON workflow.instances;
CREATE TRIGGER trg_sync_smart_bi_action_item_from_workflow
AFTER INSERT OR UPDATE OF current_task_id, status, variables ON workflow.instances
FOR EACH ROW
EXECUTE FUNCTION public.sync_smart_bi_action_item_from_workflow();

CREATE OR REPLACE FUNCTION public.close_smart_bi_action_item_from_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, workflow
AS $$
DECLARE
    v_action_id_text TEXT;
    v_action_id INT;
BEGIN
    IF COALESCE(NEW.event_type, '') <> 'INSTANCE_COMPLETED' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(
        i.variables ->> 'smart_bi_action_item_id',
        i.variables #>> '{smart_bi_action,action_item_id}'
    )
    INTO v_action_id_text
    FROM workflow.instances i
    WHERE i.id = NEW.instance_id
    LIMIT 1;

    IF v_action_id_text IS NULL OR v_action_id_text !~ '^[0-9]+$' THEN
        RETURN NEW;
    END IF;

    v_action_id := v_action_id_text::INT;

    UPDATE public.smart_bi_action_items
       SET workflow_definition_id = NEW.definition_id,
           workflow_instance_id = NEW.instance_id,
           status = '已闭环',
           closed_at = COALESCE(closed_at, NOW()),
           updated_at = NOW()
     WHERE id = v_action_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_smart_bi_action_item_from_workflow_event ON workflow.instance_events;
CREATE TRIGGER trg_close_smart_bi_action_item_from_workflow_event
AFTER INSERT OR UPDATE OF payload ON workflow.instance_events
FOR EACH ROW
EXECUTE FUNCTION public.close_smart_bi_action_item_from_workflow_event();

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

SELECT
    to_regclass('public.smart_bi_action_items') IS NOT NULL AS smart_bi_action_items_ready,
    EXISTS (
        SELECT 1
          FROM workflow.definitions
         WHERE name = '智能BI经营闭环流程'
    ) AS smart_bi_closure_workflow_ready,
    has_table_privilege('web_user', 'public.smart_bi_action_items', 'INSERT') AS web_user_can_insert_smart_bi_actions,
    has_table_privilege('web_user', 'public.smart_bi_action_items', 'UPDATE') AS web_user_can_update_smart_bi_actions;
