-- 为“出入库协同流程”创建/校验角色并按角色分派任务（幂等）
-- 执行方式：
--   cat sql/patch_assign_stock_io_workflow_roles.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

DO $$
DECLARE
  v_app_name TEXT := U&'\51FA\5165\5E93\534F\540C\6D41\7A0B';
  v_app_id UUID;
  v_definition_id INT;
BEGIN
  -- 1) 角色：员工（已存在则更新显示信息）
  INSERT INTO public.roles (code, name, description, sort)
  VALUES (
    'employee',
    U&'\5458\5DE5',
    U&'\901A\7528\4E1A\52A1\5458\5DE5\89D2\8272',
    120
  )
  ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW();

  -- 2) 角色：仓管
  INSERT INTO public.roles (code, name, description, sort)
  VALUES (
    'warehouse_keeper',
    U&'\4ED3\7BA1',
    U&'\4ED3\5E93\7BA1\7406\4E0E\51FA\5165\5E93\6267\884C\89D2\8272',
    130
  )
  ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW();

  SELECT id
    INTO v_app_id
  FROM app_center.apps
  WHERE name = v_app_name
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_app_id IS NULL THEN
    RAISE NOTICE 'Workflow app not found: %', v_app_name;
    RETURN;
  END IF;

  SELECT id
    INTO v_definition_id
  FROM workflow.definitions
  WHERE app_id = v_app_id
  ORDER BY id DESC
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE NOTICE 'Workflow definition not found for app_id=%', v_app_id;
    RETURN;
  END IF;

  -- 3) 按角色分派节点任务
  -- 员工：提交入库申请
  INSERT INTO workflow.task_assignments (
    definition_id, task_id, candidate_roles, candidate_users
  )
  VALUES (
    v_definition_id, 'Task_InboundRequest', ARRAY['employee']::text[], ARRAY[]::text[]
  )
  ON CONFLICT (definition_id, task_id) DO UPDATE
  SET candidate_roles = EXCLUDED.candidate_roles,
      candidate_users = EXCLUDED.candidate_users;

  -- 仓管：仓管审核入库
  INSERT INTO workflow.task_assignments (
    definition_id, task_id, candidate_roles, candidate_users
  )
  VALUES (
    v_definition_id, 'Task_InboundReview', ARRAY['warehouse_keeper']::text[], ARRAY[]::text[]
  )
  ON CONFLICT (definition_id, task_id) DO UPDATE
  SET candidate_roles = EXCLUDED.candidate_roles,
      candidate_users = EXCLUDED.candidate_users;

  -- 仓管：仓管执行出库
  INSERT INTO workflow.task_assignments (
    definition_id, task_id, candidate_roles, candidate_users
  )
  VALUES (
    v_definition_id, 'Task_OutboundExecute', ARRAY['warehouse_keeper']::text[], ARRAY[]::text[]
  )
  ON CONFLICT (definition_id, task_id) DO UPDATE
  SET candidate_roles = EXCLUDED.candidate_roles,
      candidate_users = EXCLUDED.candidate_users;
END $$;

WITH app_row AS (
  SELECT a.id AS app_id
  FROM app_center.apps a
  WHERE a.name = U&'\51FA\5165\5E93\534F\540C\6D41\7A0B'
  ORDER BY a.created_at DESC
  LIMIT 1
),
def_row AS (
  SELECT d.id AS definition_id
  FROM workflow.definitions d
  JOIN app_row a ON a.app_id = d.app_id
  ORDER BY d.id DESC
  LIMIT 1
)
SELECT
  d.definition_id,
  ta.task_id,
  ta.candidate_roles,
  ta.candidate_users
FROM def_row d
JOIN workflow.task_assignments ta
  ON ta.definition_id = d.definition_id
ORDER BY ta.task_id;
