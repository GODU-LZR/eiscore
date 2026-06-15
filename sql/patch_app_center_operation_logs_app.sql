-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: App Center operation log data app.
-- Execute:
--   cat sql/patch_app_center_operation_logs_app.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

BEGIN;

ALTER TABLE app_center.execution_logs
  ADD COLUMN IF NOT EXISTS operation_location JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE app_center.execution_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE app_center.execution_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE app_center.execution_logs
   SET created_at = COALESCE(created_at, executed_at, NOW()),
       updated_at = COALESCE(updated_at, executed_at, created_at, NOW())
 WHERE created_at IS NULL
    OR updated_at IS NULL;

CREATE OR REPLACE FUNCTION app_center.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS execution_logs_update_timestamp ON app_center.execution_logs;
CREATE TRIGGER execution_logs_update_timestamp
  BEFORE UPDATE ON app_center.execution_logs
  FOR EACH ROW
  EXECUTE FUNCTION app_center.update_timestamp();

CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_at
  ON app_center.execution_logs (executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_logs_operation_location_gin
  ON app_center.execution_logs USING GIN (operation_location);

COMMENT ON COLUMN app_center.execution_logs.operation_location IS 'Operation context displayed by the grid geo/location column. address records module/app/action.';
COMMENT ON COLUMN app_center.execution_logs.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN app_center.execution_logs.updated_at IS 'Record update timestamp';

GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.execution_logs TO web_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_center TO web_user;

CREATE OR REPLACE FUNCTION app_center.log_semantic_event(
  app_id UUID,
  task_id TEXT,
  status TEXT,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims JSONB := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  app_role TEXT := COALESCE(NULLIF(claims ->> 'app_role', ''), NULLIF(current_setting('request.jwt.claim.app_role', true), ''));
  actor_username TEXT := COALESCE(NULLIF(claims ->> 'username', ''), NULLIF(current_setting('request.jwt.claim.username', true), ''), 'unknown');
  normalized_status TEXT := lower(COALESCE(status, 'completed'));
  normalized_task TEXT := LEFT(COALESCE(task_id, 'semantic_auto_enrich'), 100);
BEGIN
  IF to_regclass('app_center.execution_logs') IS NULL THEN
    RETURN;
  END IF;

  IF app_role IS DISTINCT FROM 'super_admin' THEN
    RETURN;
  END IF;

  IF normalized_status NOT IN ('pending', 'running', 'completed', 'failed') THEN
    normalized_status := 'completed';
  END IF;

  INSERT INTO app_center.execution_logs (
    app_id,
    task_id,
    status,
    input_data,
    output_data,
    error_message,
    executed_by,
    executed_at,
    operation_location
  )
  VALUES (
    app_id,
    normalized_task,
    normalized_status,
    COALESCE(input_data, '{}'::jsonb),
    COALESCE(output_data, '{}'::jsonb),
    error_message,
    actor_username,
    NOW(),
    jsonb_build_object(
      'address',
      concat_ws(
        ' / ',
        '模块:应用中心',
        CASE WHEN app_id IS NULL THEN NULL ELSE '应用ID:' || app_id::text END,
        '操作:' || normalized_task
      ),
      'module', '应用中心',
      'app_id', COALESCE(app_id::text, ''),
      'action', normalized_task,
      'source', 'semantic_event'
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- audit must not block main business path
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION app_center.log_semantic_event(UUID, TEXT, TEXT, JSONB, JSONB, TEXT) TO web_user;

DO $$
DECLARE
  v_app_id UUID;
  v_module_key TEXT := 'app_operation_logs';
  v_route_path TEXT;
  v_columns JSONB;
  v_config JSONB;
BEGIN
  v_columns := jsonb_build_array(
    jsonb_build_object('field', 'executed_by', 'label', '操作人', 'type', 'text', 'isStatic', true),
    jsonb_build_object('field', 'executed_at', 'label', '操作时间', 'type', 'datetime', 'isStatic', true),
    jsonb_build_object('field', 'operation_location', 'label', '操作位置', 'type', 'geo', 'geoAddress', true, 'isStatic', true),
    jsonb_build_object('field', 'task_id', 'label', '操作事项', 'type', 'text', 'isStatic', true),
    jsonb_build_object(
      'field', 'status',
      'label', '状态',
      'type', 'select',
      'isStatic', true,
      'options', jsonb_build_array(
        jsonb_build_object('label', '待处理', 'value', 'pending'),
        jsonb_build_object('label', '运行中', 'value', 'running'),
        jsonb_build_object('label', '已完成', 'value', 'completed'),
        jsonb_build_object('label', '失败', 'value', 'failed')
      )
    ),
    jsonb_build_object('field', 'app_id', 'label', '应用ID', 'type', 'text', 'isStatic', true),
    jsonb_build_object('field', 'error_message', 'label', '错误信息', 'type', 'text', 'isStatic', true),
    jsonb_build_object('field', 'created_at', 'label', '创建日期', 'type', 'datetime', 'isStatic', true),
    jsonb_build_object('field', 'updated_at', 'label', '更新日期', 'type', 'datetime', 'isStatic', true),
    jsonb_build_object('field', 'execution_id', 'label', '执行ID', 'type', 'text', 'isStatic', true),
    jsonb_build_object('field', 'input_data', 'label', '操作参数', 'type', 'text', 'isStatic', true),
    jsonb_build_object('field', 'output_data', 'label', '操作结果', 'type', 'text', 'isStatic', true)
  );

  v_config := jsonb_build_object(
    'table', 'app_center.execution_logs',
    'columns', v_columns,
    'staticHidden', jsonb_build_array('execution_id', 'input_data', 'output_data'),
    'summary', jsonb_build_object('label', '合计', 'rules', jsonb_build_object(), 'expressions', jsonb_build_object()),
    'includeProperties', false,
    'createTable', false,
    'writeMode', 'patch',
    'primaryKey', 'id',
    'defaultOrder', 'executed_at.desc',
    'aclModule', v_module_key,
    'perm', format('app:%s', v_module_key),
    'ops', jsonb_build_object(
      'create', format('op:%s.create', v_module_key),
      'edit', format('op:%s.edit', v_module_key),
      'delete', format('op:%s.delete', v_module_key),
      'export', format('op:%s.export', v_module_key),
      'config', format('op:%s.config', v_module_key)
    ),
    'canCreate', false,
    'canEdit', false,
    'canDelete', false,
    'canExport', true,
    'canConfig', false,
    'showStatusCol', false,
    'enableRealtime', true,
    'semantics_mode', 'system_defined',
    'permission_mode', 'compat'
  );

  SELECT id INTO v_app_id
    FROM app_center.apps
   WHERE app_type = 'data'
     AND (
       name = '日志记录'
       OR COALESCE(config ->> 'systemApp', '') = 'operation_logs'
     )
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_app_id IS NULL THEN
    INSERT INTO app_center.apps (
      name,
      description,
      category_id,
      app_type,
      status,
      icon,
      version,
      config,
      created_by,
      updated_by
    )
    VALUES (
      '日志记录',
      '记录系统操作的人员、时间、模块、应用与执行结果',
      2,
      'data',
      'published',
      'Notebook',
      '1.0.0',
      v_config || jsonb_build_object('systemApp', 'operation_logs'),
      'system',
      'system'
    )
    RETURNING id INTO v_app_id;
  ELSE
    UPDATE app_center.apps
       SET name = '日志记录',
           description = '记录系统操作的人员、时间、模块、应用与执行结果',
           category_id = 2,
           app_type = 'data',
           status = 'published',
           icon = 'Notebook',
           config = v_config || jsonb_build_object('systemApp', 'operation_logs'),
           updated_by = 'system',
           updated_at = NOW()
     WHERE id = v_app_id;
  END IF;

  v_route_path := '/apps/app/' || v_app_id::text;
  INSERT INTO app_center.published_routes (app_id, route_path, mount_point, is_active)
  VALUES (v_app_id, v_route_path, '/apps', true)
  ON CONFLICT (route_path) DO UPDATE
    SET app_id = EXCLUDED.app_id,
        mount_point = EXCLUDED.mount_point,
        is_active = true;

  INSERT INTO public.permissions (code, name, module, action)
  VALUES
    ('app:' || v_module_key, '应用-日志记录', '日志记录', '进入'),
    ('op:' || v_module_key || '.create', '日志记录-新增', '日志记录', '新增'),
    ('op:' || v_module_key || '.edit', '日志记录-编辑', '日志记录', '编辑'),
    ('op:' || v_module_key || '.delete', '日志记录-删除', '日志记录', '删除'),
    ('op:' || v_module_key || '.export', '日志记录-导出', '日志记录', '导出'),
    ('op:' || v_module_key || '.config', '日志记录-配置', '日志记录', '配置')
  ON CONFLICT (code) DO UPDATE
     SET name = EXCLUDED.name,
         module = EXCLUDED.module,
         action = EXCLUDED.action,
         updated_at = NOW();

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
    FROM public.roles r
    JOIN public.permissions p
      ON p.code IN (
        'app:' || v_module_key,
        'op:' || v_module_key || '.create',
        'op:' || v_module_key || '.edit',
        'op:' || v_module_key || '.delete',
        'op:' || v_module_key || '.export',
        'op:' || v_module_key || '.config'
      )
   WHERE r.code = 'super_admin'
  ON CONFLICT DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
