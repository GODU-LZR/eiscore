-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Keep the data-scope matrix aligned with the canonical HR department tree and
-- the complete application catalog.  Departments remain authoritative in
-- public.departments; this view only projects the selected department for a
-- role/module row.  The HR ACL client reads /departments for the full tree.

CREATE OR REPLACE VIEW public.v_role_data_scopes_matrix AS
WITH static_modules(module, module_label) AS (
  VALUES
    ('hr_employee', '人事花名册'),
    ('hr_org', '部门架构图'),
    ('hr_acl', '权限管理'),
    ('hr_user', '用户管理'),
    ('hr_change', '调岗记录'),
    ('hr_attendance', '考勤管理'),
    ('hr_payroll', '薪酬管理'),
    ('mms_ledger', '物料台账'),
    ('mms_batch_rule', '批次号规则'),
    ('mms_warehouse', '仓库管理'),
    ('mms_inventory', '库存台账'),
    ('mms_dashboard', '库存大屏'),
    ('mms_bom', '产品配方'),
    ('production_plan', '生产建议'),
    ('production_work_order', '生产工单'),
    ('quality_dashboard', '质量总览'),
    ('quality_inspection', '检验台账'),
    ('quality_ncr', '质量异常'),
    ('quality_action', '整改任务'),
    ('quality_audit', '质量审核'),
    ('quality_standard', '检验标准'),
    ('equipment_dashboard', '设备总览'),
    ('equipment_asset', '设备台账'),
    ('equipment_check', '点检记录'),
    ('equipment_issue', '设备异常'),
    ('equipment_work_order', '维保工单'),
    ('equipment_plan', '巡检计划'),
    ('equipment_standard', '保养标准'),
    ('sales_customer', '客户档案'),
    ('sales_follow_up', '客户跟进'),
    ('sales_opportunity', '销售商机'),
    ('sales_order', '销售订单'),
    ('sales_payment', '回款记录'),
    ('sales_dashboard', '销售看板'),
    ('sales_cockpit', '销售驾驶舱'),
    ('purchase_dashboard', '采购驾驶舱'),
    ('purchase_supplier', '供应商档案'),
    ('purchase_demand', '采购需求'),
    ('purchase_order', '采购订单'),
    ('purchase_arrival', '到货跟踪')
), modules AS (
  SELECT module, module_label FROM static_modules
  UNION
  SELECT acl_module, app_name
    FROM public.v_app_form_ontology
   WHERE nullif(btrim(acl_module), '') IS NOT NULL
     AND coalesce(status, '') <> 'archived'
  UNION
  -- Apps without a generated ontology (for example a newly created flash
  -- app) still need a data-scope row.  The App Center key is deterministic
  -- and matches the ACL/field matrix key used by the frontend.
  SELECT coalesce(nullif(btrim(a.config ->> 'aclModule'), ''),
                  'app_' || replace(a.id::text, '-', '')) AS module,
         a.name AS module_label
    FROM app_center.apps a
   WHERE coalesce(a.status, '') <> 'archived'
), matrix AS (
  SELECT r.id AS role_id, m.module, max(m.module_label) AS module_label
    FROM public.roles r
    CROSS JOIN modules m
   GROUP BY r.id, m.module
)
SELECT (matrix.role_id::text || ':' || matrix.module) AS id,
       matrix.role_id,
       matrix.module,
       coalesce(rds.scope_type, 'self') AS scope_type,
       rds.dept_id,
       matrix.module_label,
       r.status AS role_status,
       coalesce(rds.status, 'created') AS scope_status,
       rds.created_at AS scope_created_at,
       rds.updated_at AS scope_updated_at,
       d.name AS dept_name,
       d.parent_id AS dept_parent_id,
       d.status AS dept_status,
       d.sort AS dept_sort
  FROM matrix
  JOIN public.roles r ON r.id = matrix.role_id
  LEFT JOIN public.role_data_scopes rds
    ON rds.role_id = matrix.role_id AND rds.module = matrix.module
  LEFT JOIN public.departments d ON d.id = rds.dept_id;

GRANT SELECT, UPDATE ON public.v_role_data_scopes_matrix TO web_user;

DROP TRIGGER IF EXISTS tg_v_role_data_scopes_matrix_update ON public.v_role_data_scopes_matrix;
CREATE TRIGGER tg_v_role_data_scopes_matrix_update
  INSTEAD OF UPDATE ON public.v_role_data_scopes_matrix
  FOR EACH ROW EXECUTE FUNCTION public.tg_v_role_data_scopes_matrix_update();
