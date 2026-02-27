-- 将“出入库协同流程”的出库节点目标状态改为生效（active）
-- 执行方式：
--   cat sql/patch_stock_io_outbound_state_active.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

DO $$
DECLARE
  v_app_name TEXT := U&'\51FA\5165\5E93\534F\540C\6D41\7A0B';
BEGIN
  UPDATE app_center.workflow_state_mappings m
  SET state_value = 'active'
  FROM app_center.apps a
  WHERE a.id = m.workflow_app_id
    AND a.name = v_app_name
    AND m.bpmn_task_id = 'Task_OutboundExecute';
END $$;

SELECT
  a.id AS app_id,
  a.name AS app_name,
  m.bpmn_task_id,
  m.target_table,
  m.state_field,
  m.state_value
FROM app_center.workflow_state_mappings m
JOIN app_center.apps a
  ON a.id = m.workflow_app_id
WHERE a.name = U&'\51FA\5165\5E93\534F\540C\6D41\7A0B'
  AND m.bpmn_task_id = 'Task_OutboundExecute'
ORDER BY m.id DESC;
