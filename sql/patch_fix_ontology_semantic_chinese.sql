-- Patch: fix garbled Chinese semantic text in ontology metadata
-- Safe to run multiple times (idempotent updates).
--
-- Usage:
--   cat sql/patch_fix_ontology_semantic_chinese.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
-- PowerShell (UTF-8 safe):
--   Get-Content sql/patch_fix_ontology_semantic_chinese.sql -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

BEGIN;

SET client_encoding = 'UTF8';

-- 1) Canonical semantic names/descriptions for known core tables.
WITH fixes(table_schema, table_name, semantic_name, semantic_description, is_business) AS (
  VALUES
    ('app_center', 'apps', '应用注册', '应用中心中的应用定义主表', false),
    ('app_center', 'categories', '应用分类', '应用中心分类配置', false),
    ('app_center', 'execution_logs', '执行日志', '应用运行与操作日志', false),
    ('app_center', 'published_routes', '发布路由', '应用发布后的访问路径映射', false),
    ('app_center', 'workflow_state_mappings', '流程状态映射', '流程节点与业务状态映射配置', false),

    ('basic_auth', 'users', '认证用户', '认证域用户账号信息', false),

    ('hr', 'archives', '人事花名册', '员工花名册台账', true),
    ('hr', 'attendance_month_overrides', '月度考勤修正', '月度考勤修正规则与结果', true),
    ('hr', 'attendance_records', '考勤记录', '员工出勤与考勤记录', true),
    ('hr', 'attendance_shifts', '班次定义', '考勤班次主数据', true),
    ('hr', 'employee_profiles', '员工档案主数据', '员工扩展档案与属性信息', true),
    ('hr', 'payroll', '薪酬记录', '员工薪酬核算记录', true),

    ('public', 'departments', '组织部门', '组织架构部门信息', true),
    ('public', 'employees', '员工基础资料', '员工基础主数据', true),
    ('public', 'field_label_overrides', '字段标签覆盖', '字段显示标签覆盖配置', false),
    ('public', 'files', '文件资产', '系统文件与附件元数据', true),
    ('public', 'form_values', '表单值', '动态表单提交值', true),
    ('public', 'permissions', '权限定义', '权限码定义主表', false),
    ('public', 'positions', '岗位', '岗位主数据', true),
    ('public', 'raw_materials', '原料主数据', '原料与物料基础信息', true),
    ('public', 'role_data_scopes', '角色数据范围', '角色数据范围规则配置', false),
    ('public', 'role_permissions', '角色权限关系', '角色与权限码关系', false),
    ('public', 'roles', '角色', '系统角色定义', false),
    ('public', 'sys_dict_items', '字典项', '系统字典项明细', false),
    ('public', 'sys_dicts', '系统字典', '系统字典定义', false),
    ('public', 'sys_field_acl', '字段权限', '字段级权限控制配置', false),
    ('public', 'sys_grid_configs', '表格配置', '表格组件配置元数据', false),
    ('public', 'system_configs', '系统配置', '系统全局配置', false),
    ('public', 'user_roles', '用户角色关系', '用户与角色关系', false),
    ('public', 'users', '用户', '系统用户账号信息', false),

    ('scm', 'batch_no_rules', '批次号规则', '库存批次号生成规则', true),
    ('scm', 'inventory_batches', '库存批次', '库存批次主数据', true),
    ('scm', 'inventory_check_items', '盘点明细', '盘点单明细项目', true),
    ('scm', 'inventory_checks', '盘点单', '库存盘点主单', true),
    ('scm', 'inventory_drafts', '库存单据草稿', '入出库草稿单据', true),
    ('scm', 'inventory_transactions', '库存流水', '库存出入库流水记录', true),
    ('scm', 'warehouse_layouts', '仓库布局', '仓库货位与布局配置', true),
    ('scm', 'warehouses', '仓库', '仓库主数据', true),

    ('workflow', 'definitions', '流程定义', 'BPMN 流程定义', true),
    ('workflow', 'instance_events', '流程实例事件', '流程实例流转事件日志', true),
    ('workflow', 'instances', '流程实例', '流程运行实例', true),
    ('workflow', 'task_assignments', '任务分配规则', '流程任务候选人分配规则', true)
)
UPDATE public.ontology_table_semantics AS s
SET semantic_name = f.semantic_name,
    semantic_description = f.semantic_description,
    is_business = f.is_business,
    is_active = true,
    updated_at = now()
FROM fixes AS f
WHERE s.table_schema = f.table_schema
  AND s.table_name = f.table_name;

-- 2) Dynamic app_data tables: prefer App Center app name when available.
UPDATE public.ontology_table_semantics AS s
SET semantic_name = format('动态业务表单(%s)', COALESCE(NULLIF(trim(a.name), ''), s.table_name)),
    semantic_description = format('应用中心数据应用“%s”对应业务表', COALESCE(NULLIF(trim(a.name), ''), s.table_name)),
    semantic_domain = COALESCE(NULLIF(s.semantic_domain, ''), 'app_data'),
    semantic_class = COALESCE(NULLIF(s.semantic_class, ''), 'dynamic_data_app'),
    is_business = true,
    is_active = true,
    updated_at = now()
FROM app_center.apps AS a
WHERE s.table_schema = 'app_data'
  AND s.table_name LIKE 'data_app_%'
  AND COALESCE(a.config ->> 'table', '') = ('app_data.' || s.table_name);

-- 3) Dynamic app_data fallback for rows not linked to current app records.
UPDATE public.ontology_table_semantics AS s
SET semantic_name = format('动态业务表单(%s)', s.table_name),
    semantic_description = format('应用中心动态业务表“%s”的语义信息', s.table_name),
    semantic_domain = COALESCE(NULLIF(s.semantic_domain, ''), 'app_data'),
    semantic_class = COALESCE(NULLIF(s.semantic_class, ''), 'dynamic_data_app'),
    is_business = true,
    is_active = true,
    updated_at = now()
WHERE s.table_schema = 'app_data'
  AND s.table_name LIKE 'data_app_%'
  AND (s.semantic_name LIKE '%?%' OR s.semantic_description LIKE '%?%');

-- 4) Last safety net: if still garbled, fallback to deterministic readable labels.
UPDATE public.ontology_table_semantics AS s
SET semantic_name = CASE
                      WHEN s.table_schema = 'app_data' AND s.table_name LIKE 'data_app_%'
                        THEN format('动态业务表单(%s)', s.table_name)
                      ELSE s.table_schema || '.' || s.table_name
                    END,
    semantic_description = '语义名称已自动回退，请在本体工作台补充',
    is_active = true,
    updated_at = now()
WHERE s.semantic_name LIKE '%?%' OR s.semantic_description LIKE '%?%';

COMMIT;
