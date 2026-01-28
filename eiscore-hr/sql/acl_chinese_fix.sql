BEGIN;
-- Roles (Chinese)
UPDATE public.roles
SET name = CASE code
  WHEN 'super_admin' THEN '超级管理员'
  WHEN 'hr_admin' THEN '人事管理员'
  WHEN 'hr_clerk' THEN '人事文员'
  WHEN 'dept_manager' THEN '部门主管'
  WHEN 'employee' THEN '员工'
  WHEN 'hr_viewer' THEN '人事只读'
  ELSE name
END,
    description = CASE code
  WHEN 'super_admin' THEN '拥有全部权限'
  WHEN 'hr_admin' THEN '人事模块全权限'
  WHEN 'hr_clerk' THEN '人事模块编辑权限'
  WHEN 'dept_manager' THEN '部门管理权限'
  WHEN 'employee' THEN '普通员工权限'
  WHEN 'hr_viewer' THEN '仅查看权限'
  ELSE description
END;

-- Permissions (hr:*) Chinese names and normalized module/action
UPDATE public.permissions
SET module = CASE split_part(split_part(code, ':', 2), '.', 1)
    WHEN 'employee' THEN '人事花名册'
    WHEN 'org' THEN '部门架构'
    WHEN 'change' THEN '调岗记录'
    WHEN 'attendance' THEN '考勤管理'
    WHEN 'payroll' THEN '薪酬管理'
    WHEN 'profile' THEN '人事档案'
    WHEN 'acl' THEN '权限管理'
    ELSE module
  END,
  action = CASE split_part(code, '.', 2)
    WHEN 'view' THEN '查看'
    WHEN 'create' THEN '新增'
    WHEN 'edit' THEN '编辑'
    WHEN 'delete' THEN '删除'
    WHEN 'export' THEN '导出'
    WHEN 'config' THEN '配置'
    ELSE action
  END,
  name =
    (CASE split_part(split_part(code, ':', 2), '.', 1)
      WHEN 'employee' THEN '花名册'
      WHEN 'org' THEN '组织架构'
      WHEN 'change' THEN '调岗'
      WHEN 'attendance' THEN '考勤'
      WHEN 'payroll' THEN '薪酬'
      WHEN 'profile' THEN '档案'
      WHEN 'acl' THEN '权限'
      ELSE split_part(split_part(code, ':', 2), '.', 1)
    END) ||
    (CASE split_part(code, '.', 2)
      WHEN 'view' THEN '查看'
      WHEN 'create' THEN '新增'
      WHEN 'edit' THEN '编辑'
      WHEN 'delete' THEN '删除'
      WHEN 'export' THEN '导出'
      WHEN 'config' THEN '配置'
      ELSE ''
    END)
WHERE code LIKE 'hr:%';

COMMIT;
