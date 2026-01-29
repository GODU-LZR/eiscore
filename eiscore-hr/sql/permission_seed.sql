-- 权限点标准化种子（module/app/op）
-- 说明：以 code 作为唯一主键，name/module/action 为展示或分类字段。
-- 执行方式（UTF-8）：cat permission_seed.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

WITH perms(code, name, module, action) AS (
  VALUES
    ('module:home', '模块-首页', '模块', '显示'),
    ('module:hr', '模块-人事', '模块', '显示'),
    ('module:mms', '模块-物料', '模块', '显示'),

    ('app:hr_employee', '应用-人事花名册', '应用', '进入'),
    ('app:hr_org', '应用-部门架构', '应用', '进入'),
    ('app:hr_attendance', '应用-考勤管理', '应用', '进入'),
    ('app:hr_change', '应用-调岗记录', '应用', '进入'),
    ('app:hr_acl', '应用-权限管理', '应用', '进入'),
    ('app:hr_user', '应用-用户管理', '应用', '进入'),
    ('app:mms_ledger', '应用-物料台账', '应用', '进入'),

    ('op:hr_employee.create', '人事花名册-新增', '人事花名册', '新增'),
    ('op:hr_employee.edit', '人事花名册-编辑', '人事花名册', '编辑'),
    ('op:hr_employee.delete', '人事花名册-删除', '人事花名册', '删除'),
    ('op:hr_employee.export', '人事花名册-导出', '人事花名册', '导出'),
    ('op:hr_employee.config', '人事花名册-配置', '人事花名册', '配置'),

    ('op:hr_org.create', '部门架构-新增', '部门架构', '新增'),
    ('op:hr_org.edit', '部门架构-编辑', '部门架构', '编辑'),
    ('op:hr_org.delete', '部门架构-删除', '部门架构', '删除'),
    ('op:hr_org.save_layout', '部门架构-保存布局', '部门架构', '保存布局'),
    ('op:hr_org.member_manage', '部门架构-成员管理', '部门架构', '成员管理'),

    ('op:hr_acl.create', '权限管理-新增', '权限管理', '新增'),
    ('op:hr_acl.edit', '权限管理-编辑', '权限管理', '编辑'),
    ('op:hr_acl.delete', '权限管理-删除', '权限管理', '删除'),

    ('op:hr_user.create', '用户管理-新增', '用户管理', '新增'),
    ('op:hr_user.edit', '用户管理-编辑', '用户管理', '编辑'),
    ('op:hr_user.delete', '用户管理-删除', '用户管理', '删除'),
    ('op:hr_user.export', '用户管理-导出', '用户管理', '导出'),
    ('op:hr_user.config', '用户管理-配置', '用户管理', '配置'),

    ('op:hr_change.create', '调岗记录-新增', '调岗记录', '新增'),
    ('op:hr_change.edit', '调岗记录-编辑', '调岗记录', '编辑'),
    ('op:hr_change.delete', '调岗记录-删除', '调岗记录', '删除'),
    ('op:hr_change.export', '调岗记录-导出', '调岗记录', '导出'),
    ('op:hr_change.config', '调岗记录-配置', '调岗记录', '配置'),

    ('op:hr_attendance.create', '考勤管理-新增', '考勤管理', '新增'),
    ('op:hr_attendance.edit', '考勤管理-编辑', '考勤管理', '编辑'),
    ('op:hr_attendance.delete', '考勤管理-删除', '考勤管理', '删除'),
    ('op:hr_attendance.export', '考勤管理-导出', '考勤管理', '导出'),
    ('op:hr_attendance.config', '考勤管理-配置', '考勤管理', '配置'),
    ('op:hr_attendance.shift_manage', '考勤管理-班次管理', '考勤管理', '班次管理'),
    ('op:hr_attendance.shift_create', '考勤管理-班次新增', '考勤管理', '班次新增')
    ,
    ('op:mms_ledger.create', '物料台账-新增', '物料台账', '新增'),
    ('op:mms_ledger.edit', '物料台账-编辑', '物料台账', '编辑'),
    ('op:mms_ledger.delete', '物料台账-删除', '物料台账', '删除'),
    ('op:mms_ledger.import', '物料台账-导入', '物料台账', '导入'),
    ('op:mms_ledger.export', '物料台账-导出', '物料台账', '导出'),
    ('op:mms_ledger.config', '物料台账-配置', '物料台账', '配置')
),
upsert AS (
  INSERT INTO public.permissions (code, name, module, action)
  SELECT code, name, module, action FROM perms
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    action = EXCLUDED.action
  RETURNING code
)
SELECT count(*) AS upserted FROM upsert;
