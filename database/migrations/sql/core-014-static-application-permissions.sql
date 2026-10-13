-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Canonical static micro-application ACL catalog.  The web ACL page may
-- reconcile this catalog through upsert_permissions, but a fresh database
-- must contain the same application rows before the first page visit.

DO $$
DECLARE
  item record;
  action_key text;
  action_label text;
  permission_uuid uuid;
  super_admin_role_id uuid;
BEGIN
  SELECT id INTO super_admin_role_id FROM public.roles WHERE code = 'super_admin' LIMIT 1;

  FOR item IN
    SELECT * FROM (VALUES
      ('hr_employee', '人事花名册', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('hr_org', '部门架构图', ARRAY['view','create','edit','delete','save_layout','member_manage']::text[]),
      ('hr_acl', '权限管理', ARRAY['view','create','edit','delete']::text[]),
      ('hr_user', '用户管理', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('hr_change', '调岗记录', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('hr_attendance', '考勤管理', ARRAY['view','create','edit','delete','export','config','shift_manage','shift_create']::text[]),
      ('mms_ledger', '物料台账', ARRAY['view','create','edit','delete','import','export','config','workflow_transition']::text[]),
      ('mms_batch_rule', '批次号规则', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('mms_warehouse', '仓库管理', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('mms_inventory', '库存台账', ARRAY['view','create','edit','delete','import','export','config','stock_in','stock_out']::text[]),
      ('mms_dashboard', '库存大屏', ARRAY['view']::text[]),
      ('mms_bom', '产品配方', ARRAY['view','create','edit','delete','export']::text[]),
      ('production_plan', '生产建议', ARRAY['view','export','config']::text[]),
      ('production_work_order', '生产工单', ARRAY['view','create','edit','export']::text[]),
      ('quality_dashboard', '质量总览', ARRAY['view']::text[]),
      ('quality_inspection', '检验台账', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('quality_ncr', '质量异常', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('quality_action', '整改任务', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('quality_audit', '质量审核', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('quality_standard', '检验标准', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('equipment_dashboard', '设备总览', ARRAY['view']::text[]),
      ('equipment_asset', '设备台账', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('equipment_check', '点检记录', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('equipment_issue', '设备异常', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('equipment_work_order', '维保工单', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('equipment_plan', '巡检计划', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('equipment_standard', '保养标准', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('sales_customer', '客户档案', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('sales_follow_up', '客户跟进', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('sales_opportunity', '销售商机', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('sales_order', '销售订单', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('sales_payment', '回款记录', ARRAY['view','create','edit','delete','export','config']::text[]),
      ('sales_dashboard', '销售看板', ARRAY['view']::text[]),
      ('sales_cockpit', '销售驾驶舱', ARRAY['view']::text[]),
      ('purchase_dashboard', '采购驾驶舱', ARRAY['view']::text[]),
      ('purchase_supplier', '供应商档案', ARRAY['view','create','edit','delete','export','config','review','pause','resume']::text[]),
      ('purchase_demand', '采购需求', ARRAY['view','create','edit','delete','export','config','create_order','submit','close','reopen']::text[]),
      ('purchase_order', '采购订单', ARRAY['view','create','edit','delete','export','config','register_arrival','confirm','cancel']::text[]),
      ('purchase_arrival', '到货跟踪', ARRAY['view','create','edit','delete','export','config','confirm_inbound','mark_exception']::text[]),
      ('app_center', '应用中心', ARRAY['audit','config']::text[]),
      ('business_flow', '业务流程', ARRAY['view','reverse']::text[]),
      ('collector_device', '采集设备', ARRAY['manage']::text[]),
      ('document_intake', '文档采集', ARRAY['view','manage']::text[]),
      ('hr_payroll', '薪酬管理', ARRAY['view']::text[]),
      ('ontology_workbench', '本体工作台', ARRAY['config']::text[])
    ) AS catalog(app_key, app_name, actions)
  LOOP
    -- Auxiliary capabilities expose operations only; they do not represent
    -- navigable applications and therefore must not receive app:* grants.
    IF item.app_key NOT IN (
      'app_center', 'business_flow', 'collector_device', 'document_intake',
      'hr_payroll', 'ontology_workbench'
    ) THEN
      INSERT INTO public.permissions (code, name, module, action, status)
      VALUES ('app:' || item.app_key, '应用-' || item.app_name, '应用', '进入', 'active')
      ON CONFLICT (code) DO UPDATE
        SET name = excluded.name, module = excluded.module, action = excluded.action, status = 'active';

      IF super_admin_role_id IS NOT NULL THEN
        SELECT id INTO permission_uuid FROM public.permissions WHERE code = 'app:' || item.app_key;
        INSERT INTO public.role_permissions (role_id, permission_id, status)
        VALUES (super_admin_role_id, permission_uuid, 'active')
        ON CONFLICT (role_id, permission_id) DO UPDATE SET status = 'active', updated_at = clock_timestamp();
      END IF;
    END IF;

    FOREACH action_key IN ARRAY item.actions
    LOOP
      action_label := CASE action_key
        WHEN 'view' THEN '查看'
        WHEN 'create' THEN '新增'
        WHEN 'edit' THEN '编辑'
        WHEN 'delete' THEN '删除'
        WHEN 'import' THEN '导入'
        WHEN 'export' THEN '导出'
        WHEN 'config' THEN '配置'
        WHEN 'save_layout' THEN '保存布局'
        WHEN 'member_manage' THEN '成员管理'
        WHEN 'shift_manage' THEN '班次管理'
        WHEN 'shift_create' THEN '班次新增'
        WHEN 'stock_in' THEN '入库'
        WHEN 'stock_out' THEN '出库'
        WHEN 'workflow_transition' THEN '流程流转'
        WHEN 'review' THEN '审核'
        WHEN 'pause' THEN '暂停'
        WHEN 'resume' THEN '恢复'
        WHEN 'create_order' THEN '生成订单'
        WHEN 'submit' THEN '提交'
        WHEN 'close' THEN '关闭'
        WHEN 'reopen' THEN '重新打开'
        WHEN 'register_arrival' THEN '登记到货'
        WHEN 'confirm' THEN '确认'
        WHEN 'cancel' THEN '取消'
        WHEN 'confirm_inbound' THEN '确认入库'
        WHEN 'mark_exception' THEN '标记异常'
        WHEN 'reverse' THEN '反向处理'
        WHEN 'audit' THEN '审计'
        ELSE action_key
      END;
      INSERT INTO public.permissions (code, name, module, action, status)
      VALUES ('op:' || item.app_key || '.' || action_key,
              item.app_name || '-' || action_label,
              item.app_name, action_label, 'active')
      ON CONFLICT (code) DO UPDATE
        SET name = excluded.name, module = excluded.module, action = excluded.action, status = 'active';
      SELECT id INTO permission_uuid FROM public.permissions WHERE code = 'op:' || item.app_key || '.' || action_key;
      IF super_admin_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id, status)
        VALUES (super_admin_role_id, permission_uuid, 'active')
        ON CONFLICT (role_id, permission_id) DO UPDATE SET status = 'active', updated_at = clock_timestamp();
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
