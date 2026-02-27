-- 绑定出入库流程测试账号（幂等）
-- 执行方式：
--   cat sql/patch_bind_stock_io_test_accounts.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

DO $$
DECLARE
  v_app_id UUID;
  v_module_key TEXT;
  v_employee_role_id UUID;
  v_keeper_role_id UUID;
  v_employee_user_id INT;
  v_keeper_user_id INT;
BEGIN
  SELECT id
    INTO v_app_id
  FROM app_center.apps
  WHERE name = U&'\51FA\5165\5E93\534F\540C\6D41\7A0B'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_app_id IS NULL THEN
    RAISE NOTICE 'Workflow app not found.';
    RETURN;
  END IF;

  v_module_key := 'app_' || replace(v_app_id::text, '-', '');

  -- 1) 确保角色存在
  INSERT INTO public.roles (code, name, description, sort)
  VALUES
    ('employee', U&'\5458\5DE5', U&'\901A\7528\4E1A\52A1\5458\5DE5\89D2\8272', 120),
    ('warehouse_keeper', U&'\4ED3\7BA1', U&'\4ED3\5E93\7BA1\7406\4E0E\51FA\5165\5E93\6267\884C\89D2\8272', 130)
  ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW();

  -- 2) 为出入库流程补最小权限点（只补新增，不改旧权限）
  INSERT INTO public.permissions (code, name, module, action)
  VALUES
    ('module:app', U&'\6A21\5757-\5E94\7528\4E2D\5FC3', U&'\6A21\5757', U&'\663E\793A'),
    ('app:' || v_module_key, U&'\5E94\7528-\51FA\5165\5E93\534F\540C\6D41\7A0B', U&'\51FA\5165\5E93\534F\540C\6D41\7A0B', U&'\8FDB\5165'),
    ('op:' || v_module_key || '.workflow_start', U&'\51FA\5165\5E93\534F\540C\6D41\7A0B-workflow-start', U&'\51FA\5165\5E93\534F\540C\6D41\7A0B', 'workflow_start'),
    ('op:' || v_module_key || '.workflow_transition', U&'\51FA\5165\5E93\534F\540C\6D41\7A0B-workflow-transition', U&'\51FA\5165\5E93\534F\540C\6D41\7A0B', 'workflow_transition'),
    ('op:' || v_module_key || '.workflow_complete', U&'\51FA\5165\5E93\534F\540C\6D41\7A0B-workflow-complete', U&'\51FA\5165\5E93\534F\540C\6D41\7A0B', 'workflow_complete')
  ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      module = EXCLUDED.module,
      action = EXCLUDED.action,
      updated_at = NOW();

  SELECT id INTO v_employee_role_id FROM public.roles WHERE code = 'employee' LIMIT 1;
  SELECT id INTO v_keeper_role_id FROM public.roles WHERE code = 'warehouse_keeper' LIMIT 1;

  -- 3) 最小权限授权
  -- employee：保留 module:app（既有约定） + 当前流程应用权限
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p
    ON p.code IN (
      'module:app',
      'app:' || v_module_key,
      'op:' || v_module_key || '.workflow_start',
      'op:' || v_module_key || '.workflow_transition',
      'op:' || v_module_key || '.workflow_complete'
    )
  WHERE r.code = 'employee'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- warehouse_keeper：只保留当前流程应用相关权限，避免 module:app 触发扩权
  DELETE FROM public.role_permissions rp
  USING public.roles r, public.permissions p
  WHERE rp.role_id = r.id
    AND rp.permission_id = p.id
    AND r.code = 'warehouse_keeper'
    AND (
      p.code = 'module:app'
      OR p.code LIKE 'app:%'
      OR p.code LIKE 'op:%'
    )
    AND p.code NOT IN (
      'app:' || v_module_key,
      'op:' || v_module_key || '.workflow_start',
      'op:' || v_module_key || '.workflow_transition',
      'op:' || v_module_key || '.workflow_complete'
    );

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p
    ON p.code IN (
      'app:' || v_module_key,
      'op:' || v_module_key || '.workflow_start',
      'op:' || v_module_key || '.workflow_transition',
      'op:' || v_module_key || '.workflow_complete'
    )
  WHERE r.code = 'warehouse_keeper'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- 4) 创建/更新测试账号
  INSERT INTO public.users (username, password, role, full_name, status)
  VALUES
    ('employee_test', '123456', 'employee', U&'\6D41\7A0B\6D4B\8BD5\5458\5DE5', 'active'),
    ('warehouse_test', '123456', 'warehouse_keeper', U&'\6D41\7A0B\6D4B\8BD5\4ED3\7BA1', 'active')
  ON CONFLICT (username) DO UPDATE
  SET password = EXCLUDED.password,
      role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      status = EXCLUDED.status,
      updated_at = NOW();

  SELECT id INTO v_employee_user_id FROM public.users WHERE username = 'employee_test' LIMIT 1;
  SELECT id INTO v_keeper_user_id FROM public.users WHERE username = 'warehouse_test' LIMIT 1;

  -- 5) 强制测试账号仅绑定目标角色（避免 app_role 取错）
  DELETE FROM public.user_roles ur
  USING public.roles r
  WHERE ur.role_id = r.id
    AND (
      (ur.user_id = v_employee_user_id AND r.code <> 'employee')
      OR
      (ur.user_id = v_keeper_user_id AND r.code <> 'warehouse_keeper')
    );

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES
    (v_employee_user_id, v_employee_role_id),
    (v_keeper_user_id, v_keeper_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END $$;

-- 验证结果
WITH users_target AS (
  SELECT id, username, role, full_name, status
  FROM public.users
  WHERE username IN ('employee_test', 'warehouse_test')
),
role_bind AS (
  SELECT u.username, r.code AS role_code
  FROM users_target u
  JOIN public.user_roles ur ON ur.user_id = u.id
  JOIN public.roles r ON r.id = ur.role_id
),
perm_stats AS (
  SELECT r.code AS role_code, COUNT(rp.permission_id) AS permission_count
  FROM public.roles r
  LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
  WHERE r.code IN ('employee', 'warehouse_keeper')
  GROUP BY r.code
)
SELECT
  u.username,
  u.role AS user_role_field,
  rb.role_code AS mapped_role,
  u.full_name,
  u.status,
  ps.permission_count
FROM users_target u
LEFT JOIN role_bind rb ON rb.username = u.username
LEFT JOIN perm_stats ps ON ps.role_code = rb.role_code
ORDER BY u.username;
