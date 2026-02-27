-- 创建/更新“出入库协同流程”应用（幂等）
-- 执行方式：
--   cat sql/patch_create_stock_io_workflow_app.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

DO $$
DECLARE
  v_app_name TEXT := U&'\51FA\5165\5E93\534F\540C\6D41\7A0B';
  v_app_desc TEXT := U&'\7528\4E8E\6D4B\8BD5\5165\5E93\7533\8BF7\3001\4ED3\7BA1\5BA1\6838\4E0E\51FA\5E93\6267\884C\7684\6D41\7A0B\5E94\7528';
  v_app_id UUID;
  v_definition_id INT;
  v_bpmn_xml TEXT := $bpmn$
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_StockIO_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_StockIO_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_StockIO" name="&#x5F00;&#x59CB;">
      <bpmn:outgoing>Flow_Start_To_Request</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_InboundRequest" name="&#x63D0;&#x4EA4;&#x5165;&#x5E93;&#x7533;&#x8BF7;">
      <bpmn:incoming>Flow_Start_To_Request</bpmn:incoming>
      <bpmn:outgoing>Flow_Request_To_Review</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_InboundReview" name="&#x4ED3;&#x7BA1;&#x5BA1;&#x6838;&#x5165;&#x5E93;">
      <bpmn:incoming>Flow_Request_To_Review</bpmn:incoming>
      <bpmn:outgoing>Flow_Review_To_Outbound</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_OutboundExecute" name="&#x4ED3;&#x7BA1;&#x6267;&#x884C;&#x51FA;&#x5E93;">
      <bpmn:incoming>Flow_Review_To_Outbound</bpmn:incoming>
      <bpmn:outgoing>Flow_Outbound_To_End</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="EndEvent_StockIO" name="&#x7ED3;&#x675F;">
      <bpmn:incoming>Flow_Outbound_To_End</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Start_To_Request" sourceRef="StartEvent_StockIO" targetRef="Task_InboundRequest" />
    <bpmn:sequenceFlow id="Flow_Request_To_Review" sourceRef="Task_InboundRequest" targetRef="Task_InboundReview" />
    <bpmn:sequenceFlow id="Flow_Review_To_Outbound" sourceRef="Task_InboundReview" targetRef="Task_OutboundExecute" />
    <bpmn:sequenceFlow id="Flow_Outbound_To_End" sourceRef="Task_OutboundExecute" targetRef="EndEvent_StockIO" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_StockIO_1">
    <bpmndi:BPMNPlane id="BPMNPlane_StockIO_1" bpmnElement="Process_StockIO_1">
      <bpmndi:BPMNShape id="Shape_StartEvent_StockIO" bpmnElement="StartEvent_StockIO">
        <dc:Bounds x="120" y="210" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_InboundRequest" bpmnElement="Task_InboundRequest">
        <dc:Bounds x="220" y="188" width="140" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_InboundReview" bpmnElement="Task_InboundReview">
        <dc:Bounds x="430" y="188" width="140" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_OutboundExecute" bpmnElement="Task_OutboundExecute">
        <dc:Bounds x="640" y="188" width="140" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_EndEvent_StockIO" bpmnElement="EndEvent_StockIO">
        <dc:Bounds x="850" y="210" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow_Start_To_Request" bpmnElement="Flow_Start_To_Request">
        <di:waypoint x="156" y="228" />
        <di:waypoint x="220" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_Request_To_Review" bpmnElement="Flow_Request_To_Review">
        <di:waypoint x="360" y="228" />
        <di:waypoint x="430" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_Review_To_Outbound" bpmnElement="Flow_Review_To_Outbound">
        <di:waypoint x="570" y="228" />
        <di:waypoint x="640" y="228" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_Outbound_To_End" bpmnElement="Flow_Outbound_To_End">
        <di:waypoint x="780" y="228" />
        <di:waypoint x="850" y="228" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
$bpmn$;
BEGIN
  SELECT a.id
    INTO v_app_id
  FROM app_center.apps a
  WHERE a.name = v_app_name
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_app_id IS NULL THEN
    INSERT INTO app_center.apps (
      name, description, category_id, app_type, status, icon, version, config, bpmn_xml, created_by, updated_by
    )
    VALUES (
      v_app_name,
      v_app_desc,
      1,
      'workflow',
      'published',
      'Goods',
      '1.0.0',
      '{}'::jsonb,
      v_bpmn_xml,
      'admin',
      'admin'
    )
    RETURNING id INTO v_app_id;
  ELSE
    UPDATE app_center.apps
    SET description = v_app_desc,
        category_id = 1,
        app_type = 'workflow',
        status = 'published',
        icon = 'Goods',
        bpmn_xml = v_bpmn_xml,
        updated_by = 'admin',
        updated_at = NOW()
    WHERE id = v_app_id;
  END IF;

  SELECT d.id
    INTO v_definition_id
  FROM workflow.definitions d
  WHERE d.app_id = v_app_id
  ORDER BY d.id DESC
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    INSERT INTO workflow.definitions (name, bpmn_xml, app_id, associated_table, updated_at)
    VALUES (v_app_name, v_bpmn_xml, v_app_id, 'scm.inventory_drafts', NOW())
    RETURNING id INTO v_definition_id;
  ELSE
    UPDATE workflow.definitions
    SET name = v_app_name,
        bpmn_xml = v_bpmn_xml,
        associated_table = 'scm.inventory_drafts',
        updated_at = NOW()
    WHERE id = v_definition_id;
  END IF;

  INSERT INTO app_center.workflow_state_mappings (
    workflow_app_id, bpmn_task_id, target_table, state_field, state_value
  )
  VALUES
    (v_app_id, 'Task_InboundRequest', 'scm.inventory_drafts', 'status', 'created'),
    (v_app_id, 'Task_InboundReview', 'scm.inventory_drafts', 'status', 'active'),
    (v_app_id, 'Task_OutboundExecute', 'scm.inventory_drafts', 'status', 'active')
  ON CONFLICT (workflow_app_id, bpmn_task_id) DO UPDATE
  SET target_table = EXCLUDED.target_table,
      state_field = EXCLUDED.state_field,
      state_value = EXCLUDED.state_value;

  UPDATE app_center.apps a
  SET config = COALESCE(a.config, '{}'::jsonb) || jsonb_build_object(
      'workflowDefinitionId', v_definition_id,
      'workflowBusinessAppId', 'legacy:mms_inventory_stock_in',
      'workflowAutoAdvanceEnabled', true,
      'workflowDesignerPanelMode', 'simple',
      'table', 'scm.inventory_drafts'
    ),
    updated_at = NOW(),
    updated_by = 'admin'
  WHERE a.id = v_app_id;

  INSERT INTO app_center.published_routes (app_id, route_path, mount_point, is_active)
  VALUES (v_app_id, '/apps/app/' || v_app_id::text, '/apps', true)
  ON CONFLICT (route_path) DO UPDATE
  SET is_active = EXCLUDED.is_active,
      mount_point = EXCLUDED.mount_point;
END $$;

SELECT
  a.id,
  a.name,
  a.status,
  (a.config ->> 'workflowDefinitionId') AS workflow_definition_id,
  (a.config ->> 'workflowBusinessAppId') AS workflow_business_app_id,
  pr.route_path
FROM app_center.apps a
LEFT JOIN app_center.published_routes pr
  ON pr.app_id = a.id
  AND pr.is_active = true
WHERE a.name = U&'\51FA\5165\5E93\534F\540C\6D41\7A0B'
ORDER BY a.created_at DESC
LIMIT 1;
