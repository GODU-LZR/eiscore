-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Expanded EISCore demo data.
-- Execute:
--   cat sql/demo_data_expand_20260529.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Organization / people demo data.
WITH demo_positions(id, name, dept_id, level) AS (
  VALUES
    ('00000000-0000-4001-8000-000000000016'::uuid, '生产计划员', '00000000-0000-4000-8000-000000000006'::uuid, 'P3'),
    ('00000000-0000-4001-8000-000000000017'::uuid, '渠道销售', '00000000-0000-4000-8000-000000000008'::uuid, 'P2'),
    ('00000000-0000-4001-8000-000000000018'::uuid, '采购专员', '00000000-0000-4000-8000-000000000004'::uuid, 'P2'),
    ('00000000-0000-4001-8000-000000000019'::uuid, '质检员', '00000000-0000-4000-8000-000000000007'::uuid, 'P2'),
    ('00000000-0000-4001-8000-000000000020'::uuid, '成本会计', '00000000-0000-4000-8000-000000000009'::uuid, 'P3'),
    ('00000000-0000-4001-8000-000000000021'::uuid, '设备维修员', '00000000-0000-4000-8000-000000000006'::uuid, 'P2')
)
INSERT INTO public.positions (id, name, dept_id, level, status)
SELECT id, name, dept_id, level, 'active'
FROM demo_positions
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    dept_id = EXCLUDED.dept_id,
    level = EXCLUDED.level,
    status = EXCLUDED.status,
    updated_at = now();

WITH demo_people(employee_no, name, department, position, phone, base_salary, entry_date, status, profile) AS (
  VALUES
    ('NP2024020', '许计划', '生产一部', '生产计划员', '13800000021', 6600::numeric, '2026-03-18'::date, '在职', '{"education":"本科","bank":"招商银行广州分行","bank_account":"6225880000000020","address":"广州市番禺区南派食品园区宿舍","emergency_contact":"家属许女士"}'::jsonb),
    ('NP2024021', '高渠道', '销售部', '渠道销售', '13800000022', 6200::numeric, '2026-04-02'::date, '在职', '{"education":"大专","bank":"工商银行广州分行","bank_account":"6222020000000021","address":"广州市海珠区客户服务公寓","emergency_contact":"家属高先生"}'::jsonb),
    ('NP2024022', '罗采购', '采购部', '采购专员', '13800000023', 5900::numeric, '2026-04-09'::date, '在职', '{"education":"本科","bank":"建设银行广州分行","bank_account":"6217000000000022","address":"广州市白云区采购宿舍","emergency_contact":"家属罗女士"}'::jsonb),
    ('NP2024023', '马质检', '质量部', '质检员', '13800000024', 5600::numeric, '2026-04-15'::date, '在职', '{"education":"大专","bank":"农业银行广州分行","bank_account":"6228480000000023","address":"广州市番禺区质检宿舍","emergency_contact":"家属马先生"}'::jsonb),
    ('NP2024024', '邓成本', '财务部', '成本会计', '13800000025', 7200::numeric, '2026-02-21'::date, '在职', '{"education":"本科","bank":"招商银行广州分行","bank_account":"6225880000000024","address":"广州市天河区财务公寓","emergency_contact":"家属邓女士"}'::jsonb),
    ('NP2024025', '朱设备', '生产一部', '设备维修员', '13800000026', 6100::numeric, '2026-05-06'::date, '在职', '{"education":"中专","bank":"工商银行广州分行","bank_account":"6222020000000025","address":"广州市番禺区生产宿舍","emergency_contact":"家属朱先生"}'::jsonb),
    ('NP2024026', '沈电商', '销售部', '渠道销售', '13800000027', 6000::numeric, '2026-05-10'::date, '在职', '{"education":"本科","bank":"建设银行广州分行","bank_account":"6217000000000026","address":"广州市越秀区电商公寓","emergency_contact":"家属沈女士"}'::jsonb),
    ('NP2024027', '蒋冷链', '仓储部', '冷库管理员', '13800000028', 5900::numeric, '2026-05-12'::date, '在职', '{"education":"大专","bank":"农业银行广州分行","bank_account":"6228480000000027","address":"广州市番禺区冷链宿舍","emergency_contact":"家属蒋先生"}'::jsonb),
    ('NP2024028', '叶研发', '质量部', '研发助理', '13800000029', 6300::numeric, '2026-05-27'::date, '待开通账号', '{"education":"本科","bank":"招商银行广州分行","bank_account":"6225880000000028","address":"广州市番禺区研发宿舍","emergency_contact":"家属叶女士"}'::jsonb),
    ('NP2024029', '赖包装', '生产一部', '分拣包装员', '13800000030', 5100::numeric, '2026-05-19'::date, '在职', '{"education":"高中","bank":"工商银行广州分行","bank_account":"6222020000000029","address":"广州市番禺区生产宿舍","emergency_contact":"家属赖先生"}'::jsonb),
    ('NP2024030', '宋入职', '人事行政部', '人事专员', '13800000031', 5800::numeric, '2026-05-28'::date, '待入职', '{"education":"本科","bank":"建设银行广州分行","bank_account":"6217000000000030","address":"广州市番禺区待分配宿舍","emergency_contact":"家属宋女士"}'::jsonb),
    ('NP2024031', '夏检验', '质量部', '来料检验员', '13800000032', 5650::numeric, '2026-05-22'::date, '在职', '{"education":"大专","bank":"农业银行广州分行","bank_account":"6228480000000031","address":"广州市番禺区质检宿舍","emergency_contact":"家属夏先生"}'::jsonb)
)
INSERT INTO hr.archives (name, employee_no, department, position, phone, status, base_salary, entry_date, properties)
SELECT name, employee_no, department, position, phone, status, base_salary, entry_date,
       jsonb_build_object('demo', true, 'source', 'demo_data_expand_20260529')
FROM demo_people
ON CONFLICT (employee_no) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    phone = EXCLUDED.phone,
    status = EXCLUDED.status,
    base_salary = EXCLUDED.base_salary,
    entry_date = EXCLUDED.entry_date,
    properties = COALESCE(hr.archives.properties, '{}'::jsonb) || EXCLUDED.properties,
    updated_at = now();

WITH demo_people(name, department, position) AS (
  VALUES
    ('许计划', '生产一部', '生产计划员'),
    ('高渠道', '销售部', '渠道销售'),
    ('罗采购', '采购部', '采购专员'),
    ('马质检', '质量部', '质检员'),
    ('邓成本', '财务部', '成本会计'),
    ('朱设备', '生产一部', '设备维修员'),
    ('沈电商', '销售部', '渠道销售'),
    ('蒋冷链', '仓储部', '冷库管理员'),
    ('叶研发', '质量部', '研发助理'),
    ('赖包装', '生产一部', '分拣包装员'),
    ('宋入职', '人事行政部', '人事专员'),
    ('夏检验', '质量部', '来料检验员')
)
INSERT INTO public.employees (name, position, department)
SELECT d.name, d.position, d.department
FROM demo_people d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.employees e
  WHERE e.name = d.name
    AND COALESCE(e.position, '') = d.position
    AND COALESCE(e.department, '') = d.department
);

WITH demo_people(employee_no, profile) AS (
  VALUES
    ('NP2024020', '{"education":"本科","bank":"招商银行广州分行","bank_account":"6225880000000020","address":"广州市番禺区南派食品园区宿舍","emergency_contact":"家属许女士"}'::jsonb),
    ('NP2024021', '{"education":"大专","bank":"工商银行广州分行","bank_account":"6222020000000021","address":"广州市海珠区客户服务公寓","emergency_contact":"家属高先生"}'::jsonb),
    ('NP2024022', '{"education":"本科","bank":"建设银行广州分行","bank_account":"6217000000000022","address":"广州市白云区采购宿舍","emergency_contact":"家属罗女士"}'::jsonb),
    ('NP2024023', '{"education":"大专","bank":"农业银行广州分行","bank_account":"6228480000000023","address":"广州市番禺区质检宿舍","emergency_contact":"家属马先生"}'::jsonb),
    ('NP2024024', '{"education":"本科","bank":"招商银行广州分行","bank_account":"6225880000000024","address":"广州市天河区财务公寓","emergency_contact":"家属邓女士"}'::jsonb),
    ('NP2024025', '{"education":"中专","bank":"工商银行广州分行","bank_account":"6222020000000025","address":"广州市番禺区生产宿舍","emergency_contact":"家属朱先生"}'::jsonb),
    ('NP2024026', '{"education":"本科","bank":"建设银行广州分行","bank_account":"6217000000000026","address":"广州市越秀区电商公寓","emergency_contact":"家属沈女士"}'::jsonb),
    ('NP2024027', '{"education":"大专","bank":"农业银行广州分行","bank_account":"6228480000000027","address":"广州市番禺区冷链宿舍","emergency_contact":"家属蒋先生"}'::jsonb),
    ('NP2024028', '{"education":"本科","bank":"招商银行广州分行","bank_account":"6225880000000028","address":"广州市番禺区研发宿舍","emergency_contact":"家属叶女士"}'::jsonb),
    ('NP2024029', '{"education":"高中","bank":"工商银行广州分行","bank_account":"6222020000000029","address":"广州市番禺区生产宿舍","emergency_contact":"家属赖先生"}'::jsonb),
    ('NP2024030', '{"education":"本科","bank":"建设银行广州分行","bank_account":"6217000000000030","address":"广州市番禺区待分配宿舍","emergency_contact":"家属宋女士"}'::jsonb),
    ('NP2024031', '{"education":"大专","bank":"农业银行广州分行","bank_account":"6228480000000031","address":"广州市番禺区质检宿舍","emergency_contact":"家属夏先生"}'::jsonb)
)
INSERT INTO hr.employee_profiles (archive_id, payload)
SELECT a.id, p.profile || jsonb_build_object('demo', true, 'source', 'demo_data_expand_20260529')
FROM demo_people p
JOIN hr.archives a ON a.employee_no = p.employee_no
ON CONFLICT (archive_id) DO UPDATE
SET payload = EXCLUDED.payload,
    updated_at = now();

WITH demo_users(username, full_name, phone, email, dept_id, position_id, role_code) AS (
  VALUES
    ('production_planner', '许计划', '13800000021', 'xujihua@nanpai.demo', '00000000-0000-4000-8000-000000000006'::uuid, '00000000-0000-4001-8000-000000000016'::uuid, 'dept_manager'),
    ('channel_sales', '高渠道', '13800000022', 'gaoqudao@nanpai.demo', '00000000-0000-4000-8000-000000000008'::uuid, '00000000-0000-4001-8000-000000000017'::uuid, 'sales_manager'),
    ('buyer_clerk', '罗采购', '13800000023', 'luocaigou@nanpai.demo', '00000000-0000-4000-8000-000000000004'::uuid, '00000000-0000-4001-8000-000000000018'::uuid, 'purchase_manager'),
    ('qc_clerk', '马质检', '13800000024', 'mazhijian@nanpai.demo', '00000000-0000-4000-8000-000000000007'::uuid, '00000000-0000-4001-8000-000000000019'::uuid, 'quality_inspector'),
    ('finance_staff', '邓成本', '13800000025', 'dengchengben@nanpai.demo', '00000000-0000-4000-8000-000000000009'::uuid, '00000000-0000-4001-8000-000000000020'::uuid, 'finance_viewer')
)
INSERT INTO public.users (username, password, role, full_name, phone, email, dept_id, position_id, status)
SELECT username, '123456', 'web_user', full_name, phone, email, dept_id, position_id, 'active'
FROM demo_users
ON CONFLICT (username) DO UPDATE
SET full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    dept_id = EXCLUDED.dept_id,
    position_id = EXCLUDED.position_id,
    status = EXCLUDED.status,
    updated_at = now();

WITH demo_users(username, role_code) AS (
  VALUES
    ('production_planner', 'dept_manager'),
    ('channel_sales', 'sales_manager'),
    ('buyer_clerk', 'purchase_manager'),
    ('qc_clerk', 'quality_inspector'),
    ('finance_staff', 'finance_viewer')
)
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM demo_users d
JOIN public.users u ON u.username = d.username
JOIN public.roles r ON r.code = d.role_code
ON CONFLICT DO NOTHING;

-- 2. Material master, warehouses, inventory and BOM data.
WITH demo_materials(batch_no, name, category, weight_kg, entry_date, created_by, properties) AS (
  VALUES
    ('MAT-RM-004', '龙利鱼柳', 'RM-FISH', 760::numeric, '2026-05-24'::date, 'system', '{"demo":true,"supplier":"海南深海食材","storage":"-18C冷冻","quality_standard":"去刺鱼柳"}'::jsonb),
    ('MAT-RM-005', '扇贝肉', 'RM-SHELLFISH', 420::numeric, '2026-05-25'::date, 'system', '{"demo":true,"supplier":"大连湾海产","storage":"-18C冷冻","quality_standard":"去壳净肉"}'::jsonb),
    ('MAT-RM-006', '青口贝', 'RM-SHELLFISH', 380::numeric, '2026-05-25'::date, 'system', '{"demo":true,"supplier":"福建蓝海贝业","storage":"-18C冷冻","quality_standard":"半壳清洗"}'::jsonb),
    ('MAT-AUX-005', '蒜蓉酱', 'AUX-SAUCE', 180::numeric, '2026-05-20'::date, 'system', '{"demo":true,"supplier":"广东味源香料有限公司","storage":"常温避光"}'::jsonb),
    ('MAT-AUX-006', '粉丝', 'AUX-NOODLE', 260::numeric, '2026-05-20'::date, 'system', '{"demo":true,"supplier":"佛山优谷淀粉厂","storage":"常温干燥"}'::jsonb),
    ('MAT-AUX-007', '香辣酱', 'AUX-SAUCE', 150::numeric, '2026-05-21'::date, 'system', '{"demo":true,"supplier":"广东味源香料有限公司","storage":"常温避光"}'::jsonb),
    ('MAT-AUX-008', '黑椒调味酱', 'AUX-SAUCE', 130::numeric, '2026-05-21'::date, 'system', '{"demo":true,"supplier":"广州鲜味蛋白科技","storage":"常温避光"}'::jsonb),
    ('MAT-PKG-004', '真空袋 500g', 'PKG-BAG', 96::numeric, '2026-05-18'::date, 'system', '{"demo":true,"supplier":"江门绿田包装材料","spec":"500g透明耐冻袋"}'::jsonb),
    ('MAT-PKG-005', '冰袋', 'PKG-COLD', 80::numeric, '2026-05-18'::date, 'system', '{"demo":true,"supplier":"惠州冷链物流配套","spec":"120g冷链冰袋"}'::jsonb),
    ('MAT-PKG-006', '封箱胶带', 'PKG-TAPE', 55::numeric, '2026-05-18'::date, 'system', '{"demo":true,"supplier":"江门绿田包装材料","spec":"48mm透明胶带"}'::jsonb),
    ('MAT-FG-003', '香辣虾仁预制菜', 'FG-SHRIMP', 300::numeric, '2026-05-26'::date, 'system', '{"demo":true,"shelf_life_days":270,"line":"预制菜二线","sales_unit":"盒"}'::jsonb),
    ('MAT-FG-004', '黑椒龙利鱼柳预制菜', 'FG-FISH', 260::numeric, '2026-05-26'::date, 'system', '{"demo":true,"shelf_life_days":270,"line":"预制菜一线","sales_unit":"盒"}'::jsonb),
    ('MAT-FG-005', '蒜蓉粉丝扇贝预制菜', 'FG-SHELLFISH', 180::numeric, '2026-05-26'::date, 'system', '{"demo":true,"shelf_life_days":240,"line":"预制菜三线","sales_unit":"盒"}'::jsonb)
),
updated AS (
  UPDATE public.raw_materials m
  SET name = d.name,
      category = d.category,
      weight_kg = d.weight_kg,
      entry_date = d.entry_date,
      created_by = d.created_by,
      properties = COALESCE(m.properties, '{}'::jsonb) || d.properties,
      updated_at = now()
  FROM demo_materials d
  WHERE m.batch_no = d.batch_no
  RETURNING m.batch_no
)
INSERT INTO public.raw_materials (batch_no, name, category, weight_kg, entry_date, created_by, properties)
SELECT d.batch_no, d.name, d.category, d.weight_kg, d.entry_date, d.created_by, d.properties
FROM demo_materials d
WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE u.batch_no = d.batch_no)
  AND NOT EXISTS (SELECT 1 FROM public.raw_materials m WHERE m.batch_no = d.batch_no);

WITH parent AS (
  SELECT code, id
  FROM scm.warehouses
  WHERE code IN ('RM-COLD', 'PKG', 'FG')
),
demo_warehouses(code, name, parent_code, level, sort, capacity, unit, properties) AS (
  VALUES
    ('RM-A02', '原料冷冻A02库位', 'RM-COLD', 3, 31, 1200::numeric, '千克', '{"demo":true,"temperature":"-18C","zone":"海产原料"}'::jsonb),
    ('PKG-A02', '包材A02库位', 'PKG', 3, 21, 15000::numeric, '个', '{"demo":true,"temperature":"常温","zone":"冷链包材"}'::jsonb),
    ('FG-C02', '成品C02库位', 'FG', 3, 21, 2200::numeric, '盒', '{"demo":true,"temperature":"-18C","zone":"新品成品"}'::jsonb)
)
INSERT INTO scm.warehouses (code, name, parent_id, level, sort, status, capacity, unit, properties, created_by)
SELECT d.code, d.name, p.id, d.level, d.sort, '启用', d.capacity, d.unit, d.properties, 'system'
FROM demo_warehouses d
LEFT JOIN parent p ON p.code = d.parent_code
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level,
    sort = EXCLUDED.sort,
    status = EXCLUDED.status,
    capacity = EXCLUDED.capacity,
    unit = EXCLUDED.unit,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  ORDER BY batch_no, id
),
warehouses AS (
  SELECT id, code
  FROM scm.warehouses
),
demo_batches(material_code, batch_no, warehouse_code, available_qty, locked_qty, unit, production_date, expiry_date, supplier, purchase_price, status, properties) AS (
  VALUES
    ('MAT-RM-004', 'RM-20260524-001', 'RM-A02', 520::numeric, 30::numeric, '千克', '2026-05-24'::date, '2027-05-24'::date, '海南深海食材', 38.50::numeric, '正常', '{"demo":true,"trace_no":"TR-RM-004-001","quality_status":"合格"}'::jsonb),
    ('MAT-RM-005', 'RM-20260525-001', 'RM-A02', 280::numeric, 20::numeric, '千克', '2026-05-25'::date, '2027-05-25'::date, '大连湾海产', 52.00::numeric, '正常', '{"demo":true,"trace_no":"TR-RM-005-001","quality_status":"合格"}'::jsonb),
    ('MAT-RM-006', 'RM-20260525-002', 'RM-A02', 450::numeric, 30::numeric, '千克', '2026-05-25'::date, '2027-03-25'::date, '福建蓝海贝业', 28.00::numeric, '正常', '{"demo":true,"trace_no":"TR-RM-006-001","quality_status":"待复检"}'::jsonb),
    ('MAT-AUX-005', 'AUX-20260520-001', 'RM-B01', 120::numeric, 5::numeric, '千克', '2026-05-20'::date, '2026-11-20'::date, '广东味源香料有限公司', 18.60::numeric, '正常', '{"demo":true,"quality_status":"合格"}'::jsonb),
    ('MAT-AUX-006', 'AUX-20260520-002', 'RM-B01', 260::numeric, 0::numeric, '千克', '2026-05-20'::date, '2027-05-20'::date, '佛山优谷淀粉厂', 8.20::numeric, '正常', '{"demo":true,"quality_status":"合格"}'::jsonb),
    ('MAT-AUX-007', 'AUX-20260521-001', 'RM-B01', 90::numeric, 8::numeric, '千克', '2026-05-21'::date, '2026-11-21'::date, '广东味源香料有限公司', 22.50::numeric, '正常', '{"demo":true,"quality_status":"合格"}'::jsonb),
    ('MAT-AUX-008', 'AUX-20260521-002', 'RM-B01', 70::numeric, 5::numeric, '千克', '2026-05-21'::date, '2026-11-21'::date, '广州鲜味蛋白科技', 24.80::numeric, '正常', '{"demo":true,"quality_status":"合格"}'::jsonb),
    ('MAT-PKG-004', 'PKG-20260518-001', 'PKG-A02', 6500::numeric, 500::numeric, '个', '2026-05-18'::date, NULL::date, '江门绿田包装材料', 0.36::numeric, '正常', '{"demo":true,"quality_status":"合格"}'::jsonb),
    ('MAT-PKG-005', 'PKG-20260518-002', 'PKG-A02', 4200::numeric, 200::numeric, '个', '2026-05-18'::date, NULL::date, '惠州冷链物流配套', 0.28::numeric, '正常', '{"demo":true,"quality_status":"合格"}'::jsonb),
    ('MAT-PKG-006', 'PKG-20260518-003', 'PKG-A02', 9000::numeric, 300::numeric, '卷', '2026-05-18'::date, NULL::date, '江门绿田包装材料', 2.80::numeric, '正常', '{"demo":true,"quality_status":"合格"}'::jsonb),
    ('MAT-FG-003', 'FG-20260527-001', 'FG-C02', 180::numeric, 40::numeric, '盒', '2026-05-27'::date, '2027-02-21'::date, '自产', 0::numeric, '正常', '{"demo":true,"quality_status":"成品放行","line":"预制菜二线"}'::jsonb),
    ('MAT-FG-004', 'FG-20260527-002', 'FG-C02', 260::numeric, 30::numeric, '盒', '2026-05-27'::date, '2027-02-21'::date, '自产', 0::numeric, '正常', '{"demo":true,"quality_status":"成品放行","line":"预制菜一线"}'::jsonb),
    ('MAT-FG-005', 'FG-20260528-001', 'FG-C02', 120::numeric, 20::numeric, '盒', '2026-05-28'::date, '2027-01-23'::date, '自产', 0::numeric, '正常', '{"demo":true,"quality_status":"成品待抽检","line":"预制菜三线"}'::jsonb)
)
INSERT INTO scm.inventory_batches (
  material_id, batch_no, warehouse_id, available_qty, locked_qty, unit,
  production_date, expiry_date, supplier, purchase_price, status, properties, created_by
)
SELECT m.id, d.batch_no, w.id, d.available_qty, d.locked_qty, d.unit,
       d.production_date, d.expiry_date, d.supplier, d.purchase_price, d.status, d.properties, 'system'
FROM demo_batches d
JOIN materials m ON m.batch_no = d.material_code
JOIN warehouses w ON w.code = d.warehouse_code
ON CONFLICT (material_id, batch_no, warehouse_id) DO UPDATE
SET available_qty = EXCLUDED.available_qty,
    locked_qty = EXCLUDED.locked_qty,
    unit = EXCLUDED.unit,
    production_date = EXCLUDED.production_date,
    expiry_date = EXCLUDED.expiry_date,
    supplier = EXCLUDED.supplier,
    purchase_price = EXCLUDED.purchase_price,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  ORDER BY batch_no, id
),
warehouses AS (
  SELECT id, code
  FROM scm.warehouses
),
batches AS (
  SELECT b.*, m.batch_no AS material_code, w.code AS warehouse_code
  FROM scm.inventory_batches b
  JOIN public.raw_materials m ON m.id = b.material_id
  JOIN scm.warehouses w ON w.id = b.warehouse_id
),
demo_tx(transaction_no, transaction_type, io_type, material_code, batch_no, warehouse_code, quantity, unit, before_qty, after_qty, related_doc_type, related_doc_no, transaction_date, operator, remark) AS (
  VALUES
    ('TX-IN-DEMO-20260524-001', '入库', '采购入库', 'MAT-RM-004', 'RM-20260524-001', 'RM-A02', 550::numeric, '千克', 0::numeric, 550::numeric, '采购入库单', 'PO-202606-001', '2026-05-24 10:20:00+08'::timestamptz, '陈仓', '龙利鱼柳采购入库'),
    ('TX-IN-DEMO-20260525-001', '入库', '采购入库', 'MAT-RM-005', 'RM-20260525-001', 'RM-A02', 300::numeric, '千克', 0::numeric, 300::numeric, '采购入库单', 'PO-202606-002', '2026-05-25 11:15:00+08'::timestamptz, '陈仓', '扇贝肉采购入库'),
    ('TX-IN-DEMO-20260525-002', '入库', '采购入库', 'MAT-RM-006', 'RM-20260525-002', 'RM-A02', 480::numeric, '千克', 0::numeric, 480::numeric, '采购入库单', 'PO-202606-003', '2026-05-25 15:30:00+08'::timestamptz, '蒋冷链', '青口贝采购入库'),
    ('TX-IN-DEMO-20260527-001', '入库', '生产入库', 'MAT-FG-003', 'FG-20260527-001', 'FG-C02', 220::numeric, '盒', 0::numeric, 220::numeric, '生产入库单', 'WO-DEMO-202606-001', '2026-05-27 18:10:00+08'::timestamptz, '许计划', '香辣虾仁首批生产入库'),
    ('TX-IN-DEMO-20260527-002', '入库', '生产入库', 'MAT-FG-004', 'FG-20260527-002', 'FG-C02', 290::numeric, '盒', 0::numeric, 290::numeric, '生产入库单', 'WO-DEMO-202606-002', '2026-05-27 18:40:00+08'::timestamptz, '许计划', '黑椒龙利鱼柳生产入库'),
    ('TX-OUT-DEMO-20260528-001', '出库', '销售出库', 'MAT-FG-003', 'FG-20260527-001', 'FG-C02', 40::numeric, '盒', 220::numeric, 180::numeric, '销售出库单', 'SO-202606-001', '2026-05-28 09:30:00+08'::timestamptz, '高渠道', '香辣虾仁样板客户首批发货'),
    ('TX-LOCK-DEMO-20260528-001', '锁定', '订单锁定', 'MAT-FG-005', 'FG-20260528-001', 'FG-C02', 20::numeric, '盒', 140::numeric, 120::numeric, '销售订单', 'SO-202606-003', '2026-05-28 16:00:00+08'::timestamptz, '沈电商', '电商预售订单锁定库存')
)
INSERT INTO scm.inventory_transactions (
  transaction_no, transaction_type, io_type, material_id, batch_no, batch_id, warehouse_id,
  quantity, unit, before_qty, after_qty, related_doc_type, related_doc_no, transaction_date,
  operator, remark, approval_status, properties, created_by
)
SELECT d.transaction_no, d.transaction_type, d.io_type, m.id, d.batch_no, b.id, w.id,
       d.quantity, d.unit, d.before_qty, d.after_qty, d.related_doc_type, d.related_doc_no,
       d.transaction_date, d.operator, d.remark, '已完成',
       jsonb_build_object('demo', true, 'source', 'demo_data_expand_20260529'),
       'system'
FROM demo_tx d
JOIN materials m ON m.batch_no = d.material_code
JOIN warehouses w ON w.code = d.warehouse_code
LEFT JOIN batches b
  ON b.material_code = d.material_code
 AND b.batch_no = d.batch_no
 AND b.warehouse_code = d.warehouse_code
ON CONFLICT (transaction_no) DO UPDATE
SET transaction_type = EXCLUDED.transaction_type,
    io_type = EXCLUDED.io_type,
    material_id = EXCLUDED.material_id,
    batch_no = EXCLUDED.batch_no,
    batch_id = EXCLUDED.batch_id,
    warehouse_id = EXCLUDED.warehouse_id,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    before_qty = EXCLUDED.before_qty,
    after_qty = EXCLUDED.after_qty,
    related_doc_type = EXCLUDED.related_doc_type,
    related_doc_no = EXCLUDED.related_doc_no,
    transaction_date = EXCLUDED.transaction_date,
    operator = EXCLUDED.operator,
    remark = EXCLUDED.remark,
    approval_status = EXCLUDED.approval_status,
    properties = EXCLUDED.properties;

WITH materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  ORDER BY batch_no, id
),
demo_boms(bom_no, bom_name, parent_code, version, base_qty, unit, bom_type, status, remark, properties) AS (
  VALUES
    ('BOM-MAT-FG-003-V1', '香辣虾仁预制菜标准BOM', 'MAT-FG-003', 'V1', 30::numeric, '盒', '生产BOM', '启用', '演示BOM：30盒批量，用于销售订单、生产工单和缺料分析', '{"demo":true,"production_line":"预制菜二线","yield_rate":0.95}'::jsonb),
    ('BOM-MAT-FG-004-V1', '黑椒龙利鱼柳预制菜标准BOM', 'MAT-FG-004', 'V1', 20::numeric, '盒', '生产BOM', '启用', '演示BOM：20盒批量，用于鱼柳新品生产', '{"demo":true,"production_line":"预制菜一线","yield_rate":0.96}'::jsonb),
    ('BOM-MAT-FG-005-V1', '蒜蓉粉丝扇贝预制菜标准BOM', 'MAT-FG-005', 'V1', 24::numeric, '盒', '生产BOM', '启用', '演示BOM：24盒批量，用于贝类预制菜生产', '{"demo":true,"production_line":"预制菜三线","yield_rate":0.94}'::jsonb)
)
INSERT INTO scm.boms (
  bom_no, bom_name, parent_material_id, version, base_qty, unit, bom_type,
  status, effective_from, remark, properties, created_by
)
SELECT d.bom_no, d.bom_name, m.id, d.version, d.base_qty, d.unit, d.bom_type,
       d.status, '2026-05-29'::date, d.remark, d.properties, 'system'
FROM demo_boms d
JOIN materials m ON m.batch_no = d.parent_code
ON CONFLICT (bom_no) DO UPDATE
SET bom_name = EXCLUDED.bom_name,
    parent_material_id = EXCLUDED.parent_material_id,
    version = EXCLUDED.version,
    base_qty = EXCLUDED.base_qty,
    unit = EXCLUDED.unit,
    bom_type = EXCLUDED.bom_type,
    status = EXCLUDED.status,
    effective_from = EXCLUDED.effective_from,
    remark = EXCLUDED.remark,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  ORDER BY batch_no, id
),
demo_items(bom_no, line_no, component_code, qty, unit, loss_rate, issue_method, remark, properties) AS (
  VALUES
    ('BOM-MAT-FG-003-V1', 10, 'MAT-RM-002', 8.50::numeric, '千克', 0.040000::numeric, '按需领料', '虾仁主料', '{"usage":"虾仁主料"}'::jsonb),
    ('BOM-MAT-FG-003-V1', 20, 'MAT-AUX-007', 1.20::numeric, '千克', 0.015000::numeric, '按需领料', '香辣调味', '{"usage":"香辣风味"}'::jsonb),
    ('BOM-MAT-FG-003-V1', 30, 'MAT-AUX-003', 0.90::numeric, '升', 0.010000::numeric, '按需领料', '调味用油', '{"usage":"炒制调味"}'::jsonb),
    ('BOM-MAT-FG-003-V1', 40, 'MAT-PKG-001', 30.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage":"250g真空袋"}'::jsonb),
    ('BOM-MAT-FG-003-V1', 50, 'MAT-PKG-005', 6.00::numeric, '个', 0.000000::numeric, '按需领料', '冷链辅料', '{"usage":"冰袋"}'::jsonb),
    ('BOM-MAT-FG-003-V1', 60, 'MAT-PKG-003', 3.00::numeric, '个', 0.000000::numeric, '按需领料', '外包装', '{"usage":"外箱"}'::jsonb),
    ('BOM-MAT-FG-004-V1', 10, 'MAT-RM-004', 12.00::numeric, '千克', 0.035000::numeric, '按需领料', '龙利鱼柳主料', '{"usage":"鱼柳主料"}'::jsonb),
    ('BOM-MAT-FG-004-V1', 20, 'MAT-AUX-008', 0.90::numeric, '千克', 0.010000::numeric, '按需领料', '黑椒调味', '{"usage":"黑椒风味"}'::jsonb),
    ('BOM-MAT-FG-004-V1', 30, 'MAT-AUX-003', 0.60::numeric, '升', 0.010000::numeric, '按需领料', '煎制用油', '{"usage":"煎制"}'::jsonb),
    ('BOM-MAT-FG-004-V1', 40, 'MAT-PKG-004', 20.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage":"500g真空袋"}'::jsonb),
    ('BOM-MAT-FG-004-V1', 50, 'MAT-PKG-005', 4.00::numeric, '个', 0.000000::numeric, '按需领料', '冷链辅料', '{"usage":"冰袋"}'::jsonb),
    ('BOM-MAT-FG-004-V1', 60, 'MAT-PKG-003', 2.00::numeric, '个', 0.000000::numeric, '按需领料', '外包装', '{"usage":"外箱"}'::jsonb),
    ('BOM-MAT-FG-005-V1', 10, 'MAT-RM-005', 7.20::numeric, '千克', 0.050000::numeric, '按需领料', '扇贝主料', '{"usage":"扇贝肉"}'::jsonb),
    ('BOM-MAT-FG-005-V1', 20, 'MAT-AUX-005', 1.10::numeric, '千克', 0.015000::numeric, '按需领料', '蒜蓉风味', '{"usage":"蒜蓉酱"}'::jsonb),
    ('BOM-MAT-FG-005-V1', 30, 'MAT-AUX-006', 2.40::numeric, '千克', 0.020000::numeric, '按需领料', '粉丝辅料', '{"usage":"粉丝"}'::jsonb),
    ('BOM-MAT-FG-005-V1', 40, 'MAT-PKG-002', 24.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage":"彩盒"}'::jsonb),
    ('BOM-MAT-FG-005-V1', 50, 'MAT-PKG-005', 5.00::numeric, '个', 0.000000::numeric, '按需领料', '冷链辅料', '{"usage":"冰袋"}'::jsonb),
    ('BOM-MAT-FG-005-V1', 60, 'MAT-PKG-003', 2.00::numeric, '个', 0.000000::numeric, '按需领料', '外包装', '{"usage":"外箱"}'::jsonb)
)
INSERT INTO scm.bom_items (
  bom_id, line_no, component_material_id, qty, unit, loss_rate,
  issue_method, remark, properties
)
SELECT b.id, d.line_no, m.id, d.qty, d.unit, d.loss_rate,
       d.issue_method, d.remark, d.properties
FROM demo_items d
JOIN scm.boms b ON b.bom_no = d.bom_no
JOIN materials m ON m.batch_no = d.component_code
ON CONFLICT (bom_id, line_no) DO UPDATE
SET component_material_id = EXCLUDED.component_material_id,
    qty = EXCLUDED.qty,
    unit = EXCLUDED.unit,
    loss_rate = EXCLUDED.loss_rate,
    issue_method = EXCLUDED.issue_method,
    remark = EXCLUDED.remark,
    properties = EXCLUDED.properties,
    updated_at = now();

-- 3. Sales / purchase demo data.
WITH demo_customers(customer_no, name, level, contact_name, contact_phone, region, owner_name, customer_status, credit_limit, receivable_balance, last_follow_up_at, properties) AS (
  VALUES
    ('CUST-009', '广州湾区盒马鲜配', '战略客户', '叶青', '13800010009', '华南一区', '高渠道', '已成交', 760000::numeric, 68000::numeric, '2026-05-28'::date, '{"demo":true,"industry":"新零售","channel":"前置仓"}'::jsonb),
    ('CUST-010', '深圳海岸预制菜集采', '重点客户', '王骏', '13800010010', '华南一区', '沈电商', '跟进中', 420000::numeric, 0::numeric, '2026-05-27'::date, '{"demo":true,"industry":"餐饮集采","channel":"团餐"}'::jsonb),
    ('CUST-011', '成都川味连锁餐饮', '重点客户', '周颖', '13800010011', '西南一区', '高渠道', '已成交', 360000::numeric, 52000::numeric, '2026-05-26'::date, '{"demo":true,"industry":"连锁餐饮","channel":"餐饮"}'::jsonb),
    ('CUST-012', '北京社区团购平台', '战略客户', '刘洋', '13800010012', '华北一区', '沈电商', '跟进中', 880000::numeric, 0::numeric, '2026-05-29'::date, '{"demo":true,"industry":"社区团购","channel":"电商"}'::jsonb),
    ('CUST-013', '厦门冷链团餐配送', '普通客户', '林辉', '13800010013', '华南二区', '高渠道', '已成交', 180000::numeric, 24500::numeric, '2026-05-25'::date, '{"demo":true,"industry":"团餐配送","channel":"B端"}'::jsonb),
    ('CUST-014', '武汉城市生鲜联盟', '潜在客户', '赵航', '13800010014', '华中一区', '吴销售', '跟进中', 220000::numeric, 0::numeric, '2026-05-24'::date, '{"demo":true,"industry":"生鲜联盟","channel":"批发"}'::jsonb),
    ('CUST-015', '重庆火锅食材供应链', '重点客户', '唐宁', '13800010015', '西南二区', '高渠道', '已成交', 510000::numeric, 77000::numeric, '2026-05-23'::date, '{"demo":true,"industry":"火锅食材","channel":"餐饮"}'::jsonb),
    ('CUST-016', '天津校园餐饮配送', '普通客户', '韩冰', '13800010016', '华北二区', '沈电商', '跟进中', 160000::numeric, 0::numeric, '2026-05-22'::date, '{"demo":true,"industry":"校园餐饮","channel":"团餐"}'::jsonb)
)
INSERT INTO public.sales_customers (
  customer_no, name, level, contact_name, contact_phone, region, owner_name,
  customer_status, credit_limit, receivable_balance, last_follow_up_at, status, properties
)
SELECT customer_no, name, level, contact_name, contact_phone, region, owner_name,
       customer_status, credit_limit, receivable_balance, last_follow_up_at, 'active', properties
FROM demo_customers
ON CONFLICT (customer_no) DO UPDATE
SET name = EXCLUDED.name,
    level = EXCLUDED.level,
    contact_name = EXCLUDED.contact_name,
    contact_phone = EXCLUDED.contact_phone,
    region = EXCLUDED.region,
    owner_name = EXCLUDED.owner_name,
    customer_status = EXCLUDED.customer_status,
    credit_limit = EXCLUDED.credit_limit,
    receivable_balance = EXCLUDED.receivable_balance,
    last_follow_up_at = EXCLUDED.last_follow_up_at,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH customers AS (
  SELECT id, customer_no, name
  FROM public.sales_customers
),
materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no, name
  FROM public.raw_materials
  ORDER BY batch_no, id
),
demo_orders(order_no, customer_no, product_code, quantity, unit, unit_price, order_date, delivery_date, order_status, owner_name, properties) AS (
  VALUES
    ('SO-202606-001', 'CUST-009', 'MAT-FG-003', 360::numeric, '盒', 118::numeric, '2026-05-28'::date, '2026-06-04'::date, '已确认', '高渠道', '{"demo":true,"bom_version":"V1","delivery_risk":"正常","channel":"前置仓"}'::jsonb),
    ('SO-202606-002', 'CUST-010', 'MAT-FG-004', 420::numeric, '盒', 128::numeric, '2026-05-29'::date, '2026-06-06'::date, '生产中', '沈电商', '{"demo":true,"bom_version":"V1","delivery_risk":"临期","channel":"团餐"}'::jsonb),
    ('SO-202606-003', 'CUST-011', 'MAT-FG-005', 300::numeric, '盒', 136::numeric, '2026-05-29'::date, '2026-06-05'::date, '已确认', '高渠道', '{"demo":true,"bom_version":"V1","delivery_risk":"正常","channel":"连锁餐饮"}'::jsonb),
    ('SO-202606-004', 'CUST-012', 'MAT-FG-001', 620::numeric, '盒', 168::numeric, '2026-05-29'::date, '2026-06-03'::date, '生产中', '沈电商', '{"demo":true,"bom_version":"V1","delivery_risk":"临期","channel":"社区团购"}'::jsonb),
    ('SO-202606-005', 'CUST-013', 'MAT-FG-003', 240::numeric, '盒', 116::numeric, '2026-05-30'::date, '2026-06-08'::date, '草稿', '高渠道', '{"demo":true,"bom_version":"V1","delivery_risk":"正常","channel":"团餐"}'::jsonb),
    ('SO-202606-006', 'CUST-015', 'MAT-FG-005', 520::numeric, '盒', 132::numeric, '2026-05-30'::date, '2026-06-07'::date, '已确认', '高渠道', '{"demo":true,"bom_version":"V1","delivery_risk":"正常","channel":"火锅食材"}'::jsonb),
    ('SO-202606-007', 'CUST-014', 'MAT-FG-004', 160::numeric, '盒', 126::numeric, '2026-05-31'::date, '2026-06-12'::date, '草稿', '吴销售', '{"demo":true,"bom_version":"V1","delivery_risk":"正常","channel":"批发"}'::jsonb),
    ('SO-202606-008', 'CUST-016', 'MAT-FG-002', 280::numeric, '盒', 96::numeric, '2026-05-31'::date, '2026-06-10'::date, '已确认', '沈电商', '{"demo":true,"bom_version":"V1","delivery_risk":"正常","channel":"校园餐饮"}'::jsonb)
)
INSERT INTO public.sales_orders (
  order_no, customer_id, customer_name, product_name, quantity, unit, unit_price,
  total_amount, order_date, delivery_date, order_status, owner_name, status, properties,
  product_material_id
)
SELECT d.order_no, c.id, c.name, m.name, d.quantity, d.unit, d.unit_price,
       round(d.quantity * d.unit_price, 2), d.order_date, d.delivery_date,
       d.order_status, d.owner_name, 'active', d.properties, m.id
FROM demo_orders d
JOIN customers c ON c.customer_no = d.customer_no
JOIN materials m ON m.batch_no = d.product_code
ON CONFLICT (order_no) DO UPDATE
SET customer_id = EXCLUDED.customer_id,
    customer_name = EXCLUDED.customer_name,
    product_name = EXCLUDED.product_name,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    unit_price = EXCLUDED.unit_price,
    total_amount = EXCLUDED.total_amount,
    order_date = EXCLUDED.order_date,
    delivery_date = EXCLUDED.delivery_date,
    order_status = EXCLUDED.order_status,
    owner_name = EXCLUDED.owner_name,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    product_material_id = EXCLUDED.product_material_id,
    updated_at = now();

WITH customers AS (
  SELECT id, customer_no, name, contact_name
  FROM public.sales_customers
),
demo_follow(follow_no, customer_no, follow_date, follow_type, follow_result, next_follow_at, owner_name, follow_content, properties) AS (
  VALUES
    ('FU-202606-001', 'CUST-009', '2026-05-28'::date, '客户拜访', '确认首批订单', '2026-06-02'::date, '高渠道', '确认香辣虾仁新品铺货节奏，首批发华南前置仓。', '{"demo":true,"priority":"高","next_action":"跟进到货签收"}'::jsonb),
    ('FU-202606-002', 'CUST-010', '2026-05-29'::date, '电话沟通', '待报价', '2026-06-01'::date, '沈电商', '客户关注鱼柳规格和冷链配送成本，需补充报价明细。', '{"demo":true,"priority":"中","next_action":"补充成本报价"}'::jsonb),
    ('FU-202606-003', 'CUST-011', '2026-05-29'::date, '样品反馈', '口味通过', '2026-06-03'::date, '高渠道', '川味连锁确认扇贝样品口味，要求按门店铺货分批交付。', '{"demo":true,"priority":"高","next_action":"确认分批交付计划"}'::jsonb),
    ('FU-202606-004', 'CUST-012', '2026-05-29'::date, '视频会议', '方案评估', '2026-06-02'::date, '沈电商', '社区团购平台要求提供促销期备货能力说明。', '{"demo":true,"priority":"高","next_action":"输出产能说明"}'::jsonb),
    ('FU-202606-005', 'CUST-014', '2026-05-30'::date, '电话沟通', '待跟进', '2026-06-05'::date, '吴销售', '客户对黑椒鱼柳有兴趣，待内部试吃反馈。', '{"demo":true,"priority":"低","next_action":"寄送试吃样品"}'::jsonb)
)
INSERT INTO public.sales_follow_ups (
  follow_no, customer_id, customer_name, contact_name, follow_date, follow_type,
  follow_result, next_follow_at, owner_name, follow_content, status, properties
)
SELECT d.follow_no, c.id, c.name, c.contact_name, d.follow_date, d.follow_type,
       d.follow_result, d.next_follow_at, d.owner_name, d.follow_content, 'active', d.properties
FROM demo_follow d
JOIN customers c ON c.customer_no = d.customer_no
ON CONFLICT (follow_no) DO UPDATE
SET customer_id = EXCLUDED.customer_id,
    customer_name = EXCLUDED.customer_name,
    contact_name = EXCLUDED.contact_name,
    follow_date = EXCLUDED.follow_date,
    follow_type = EXCLUDED.follow_type,
    follow_result = EXCLUDED.follow_result,
    next_follow_at = EXCLUDED.next_follow_at,
    owner_name = EXCLUDED.owner_name,
    follow_content = EXCLUDED.follow_content,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH customers AS (
  SELECT id, customer_no, name
  FROM public.sales_customers
),
demo_opps(opportunity_no, opportunity_name, customer_no, expected_amount, stage, probability, expected_close_date, owner_name, next_action, remark, properties) AS (
  VALUES
    ('OPP-202606-001', '华南前置仓新品铺货', 'CUST-009', 180000::numeric, '商务谈判', 80::numeric, '2026-06-08'::date, '高渠道', '跟进二批订单预测', '香辣虾仁新品已形成首批订单。', '{"demo":true,"source":"老客复购","competition":"区域竞品促销"}'::jsonb),
    ('OPP-202606-002', '深圳团餐鱼柳项目', 'CUST-010', 135000::numeric, '方案报价', 55::numeric, '2026-06-12'::date, '沈电商', '补充成本报价', '客户关注冷链配送成本。', '{"demo":true,"source":"客户跟进","competition":"进口鱼柳供应商"}'::jsonb),
    ('OPP-202606-003', '北京社区团购促销档', 'CUST-012', 260000::numeric, '需求确认', 45::numeric, '2026-06-15'::date, '沈电商', '输出产能说明', '需说明促销档产能和交付节奏。', '{"demo":true,"source":"展会线索","competition":"同类预制菜品牌"}'::jsonb),
    ('OPP-202606-004', '重庆火锅配菜长期供货', 'CUST-015', 210000::numeric, '签约推进', 70::numeric, '2026-06-10'::date, '高渠道', '确认月度预测', '火锅食材供应链关注扇贝和虾仁组合。', '{"demo":true,"source":"转介绍","competition":"本地冷冻品商"}'::jsonb)
)
INSERT INTO public.sales_opportunities (
  opportunity_no, opportunity_name, customer_id, customer_name, expected_amount,
  stage, probability, expected_close_date, owner_name, next_action, remark, status, properties
)
SELECT d.opportunity_no, d.opportunity_name, c.id, c.name, d.expected_amount,
       d.stage, d.probability, d.expected_close_date, d.owner_name,
       d.next_action, d.remark, 'active', d.properties
FROM demo_opps d
JOIN customers c ON c.customer_no = d.customer_no
ON CONFLICT (opportunity_no) DO UPDATE
SET opportunity_name = EXCLUDED.opportunity_name,
    customer_id = EXCLUDED.customer_id,
    customer_name = EXCLUDED.customer_name,
    expected_amount = EXCLUDED.expected_amount,
    stage = EXCLUDED.stage,
    probability = EXCLUDED.probability,
    expected_close_date = EXCLUDED.expected_close_date,
    owner_name = EXCLUDED.owner_name,
    next_action = EXCLUDED.next_action,
    remark = EXCLUDED.remark,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH orders AS (
  SELECT id, order_no, customer_id, customer_name
  FROM public.sales_orders
),
demo_pay(payment_no, order_no, amount, payment_date, payment_method, verify_status, handler_name, properties) AS (
  VALUES
    ('PAY-202606-001', 'SO-202606-001', 18000::numeric, '2026-05-29'::date, '银行转账', '已核销', '邓成本', '{"demo":true,"payment_note":"首批铺货预付款"}'::jsonb),
    ('PAY-202606-002', 'SO-202606-003', 12000::numeric, '2026-05-30'::date, '银行转账', '待核销', '邓成本', '{"demo":true,"payment_note":"扇贝订单预付款"}'::jsonb),
    ('PAY-202606-003', 'SO-202606-004', 30000::numeric, '2026-05-30'::date, '承兑汇票', '待核销', '孙会计', '{"demo":true,"payment_note":"社区团购促销定金"}'::jsonb)
)
INSERT INTO public.sales_payments (
  payment_no, order_id, order_no, customer_id, customer_name, amount,
  payment_date, payment_method, verify_status, handler_name, status, properties
)
SELECT d.payment_no, o.id, o.order_no, o.customer_id, o.customer_name, d.amount,
       d.payment_date, d.payment_method, d.verify_status, d.handler_name, 'active', d.properties
FROM demo_pay d
JOIN orders o ON o.order_no = d.order_no
ON CONFLICT (payment_no) DO UPDATE
SET order_id = EXCLUDED.order_id,
    order_no = EXCLUDED.order_no,
    customer_id = EXCLUDED.customer_id,
    customer_name = EXCLUDED.customer_name,
    amount = EXCLUDED.amount,
    payment_date = EXCLUDED.payment_date,
    payment_method = EXCLUDED.payment_method,
    verify_status = EXCLUDED.verify_status,
    handler_name = EXCLUDED.handler_name,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH demo_suppliers(supplier_no, name, level, contact_name, contact_phone, category, payment_terms, lead_time_days, buyer_name, supplier_status, last_review_at, properties) AS (
  VALUES
    ('SUP-006', '湛江海丰水产', '战略', '陈海', '13900020006', '海鱼原料', '月结30天', 2::numeric, '罗采购', '合作中', '2026-05-20'::date, '{"demo":true,"score":93,"cert":"HACCP"}'::jsonb),
    ('SUP-007', '阳江蓝湾水产', '核心', '梁湾', '13900020007', '虾类原料', '月结30天', 3::numeric, '罗采购', '合作中', '2026-05-21'::date, '{"demo":true,"score":91,"cert":"HACCP"}'::jsonb),
    ('SUP-008', '海南深海食材', '核心', '唐海', '13900020008', '鱼柳原料', '月结45天', 4::numeric, '罗采购', '合作中', '2026-05-22'::date, '{"demo":true,"score":88,"cert":"SC"}'::jsonb),
    ('SUP-009', '大连湾海产', '核心', '孙贝', '13900020009', '贝类原料', '月结30天', 5::numeric, '黄采购', '合作中', '2026-05-22'::date, '{"demo":true,"score":89,"cert":"HACCP"}'::jsonb),
    ('SUP-010', '福建蓝海贝业', '普通', '何蓝', '13900020010', '贝类原料', '到票30天', 4::numeric, '黄采购', '待评审', '2026-05-18'::date, '{"demo":true,"score":76,"cert":"SC"}'::jsonb),
    ('SUP-011', '中山彩印包装', '战略', '吴彩', '13900020011', '彩盒包装', '月结45天', 6::numeric, '周采购', '合作中', '2026-05-19'::date, '{"demo":true,"score":92,"cert":"FSC"}'::jsonb),
    ('SUP-012', '广州冷链辅材', '普通', '许冷', '13900020012', '冷链辅材', '月结30天', 3::numeric, '周采购', '合作中', '2026-05-23'::date, '{"demo":true,"score":84,"cert":"ISO9001"}'::jsonb)
)
INSERT INTO public.purchase_suppliers (
  supplier_no, name, level, contact_name, contact_phone, category, payment_terms,
  lead_time_days, buyer_name, supplier_status, last_review_at, status, properties
)
SELECT supplier_no, name, level, contact_name, contact_phone, category, payment_terms,
       lead_time_days, buyer_name, supplier_status, last_review_at, 'active', properties
FROM demo_suppliers
ON CONFLICT (supplier_no) DO UPDATE
SET name = EXCLUDED.name,
    level = EXCLUDED.level,
    contact_name = EXCLUDED.contact_name,
    contact_phone = EXCLUDED.contact_phone,
    category = EXCLUDED.category,
    payment_terms = EXCLUDED.payment_terms,
    lead_time_days = EXCLUDED.lead_time_days,
    buyer_name = EXCLUDED.buyer_name,
    supplier_status = EXCLUDED.supplier_status,
    last_review_at = EXCLUDED.last_review_at,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH demo_demands(demand_no, material_no, material_name, quantity, unit, required_date, source_dept, requester_name, preferred_supplier, demand_status, remark, properties) AS (
  VALUES
    ('PR-202606-001', 'MAT-RM-004', '龙利鱼柳', 480::numeric, '千克', '2026-06-03'::date, '生产一部', '许计划', '海南深海食材', '已下单', '黑椒龙利鱼柳订单备料', '{"demo":true,"source_order":"SO-202606-002"}'::jsonb),
    ('PR-202606-002', 'MAT-RM-005', '扇贝肉', 360::numeric, '千克', '2026-06-04'::date, '生产一部', '许计划', '大连湾海产', '已下单', '扇贝预制菜订单备料', '{"demo":true,"source_order":"SO-202606-003,SO-202606-006"}'::jsonb),
    ('PR-202606-003', 'MAT-AUX-005', '蒜蓉酱', 120::numeric, '千克', '2026-06-02'::date, '生产一部', '许计划', '广东味源香料有限公司', '待采购', '蒜蓉粉丝扇贝调味补料', '{"demo":true,"source":"bom_shortage"}'::jsonb),
    ('PR-202606-004', 'MAT-AUX-007', '香辣酱', 90::numeric, '千克', '2026-06-02'::date, '生产一部', '许计划', '广东味源香料有限公司', '待采购', '香辣虾仁调味补料', '{"demo":true,"source":"bom_shortage"}'::jsonb),
    ('PR-202606-005', 'MAT-PKG-004', '真空袋 500g', 5000::numeric, '个', '2026-06-05'::date, '生产一部', '罗采购', '江门绿田包装材料', '已下单', '鱼柳内包装补货', '{"demo":true,"source":"safety_stock"}'::jsonb),
    ('PR-202606-006', 'MAT-PKG-005', '冰袋', 3500::numeric, '个', '2026-06-05'::date, '仓储部', '蒋冷链', '广州冷链辅材', '待采购', '冷链发货辅料补货', '{"demo":true,"source":"cold_chain"}'::jsonb),
    ('PR-202606-007', 'MAT-PKG-003', '外箱', 1800::numeric, '个', '2026-06-06'::date, '仓储部', '陈仓', '江门绿田包装材料', '待采购', '多品类外箱补货', '{"demo":true,"source":"safety_stock"}'::jsonb)
)
INSERT INTO public.purchase_demands (
  demand_no, material_no, material_name, quantity, unit, required_date,
  source_dept, requester_name, preferred_supplier, demand_status, remark, status, properties
)
SELECT demand_no, material_no, material_name, quantity, unit, required_date,
       source_dept, requester_name, preferred_supplier, demand_status, remark, 'active', properties
FROM demo_demands
ON CONFLICT (demand_no) DO UPDATE
SET material_no = EXCLUDED.material_no,
    material_name = EXCLUDED.material_name,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    required_date = EXCLUDED.required_date,
    source_dept = EXCLUDED.source_dept,
    requester_name = EXCLUDED.requester_name,
    preferred_supplier = EXCLUDED.preferred_supplier,
    demand_status = EXCLUDED.demand_status,
    remark = EXCLUDED.remark,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH demands AS (
  SELECT id, demand_no
  FROM public.purchase_demands
),
suppliers AS (
  SELECT id, supplier_no, name
  FROM public.purchase_suppliers
),
demo_po(order_no, demand_no, supplier_no, material_name, quantity, unit, unit_price, order_date, expected_arrival_date, buyer_name, order_status, properties) AS (
  VALUES
    ('PO-202606-001', 'PR-202606-001', 'SUP-008', '龙利鱼柳', 480::numeric, '千克', 38.50::numeric, '2026-05-29'::date, '2026-06-02'::date, '罗采购', '已下单', '{"demo":true,"contract":"CT-202606-001"}'::jsonb),
    ('PO-202606-002', 'PR-202606-002', 'SUP-009', '扇贝肉', 360::numeric, '千克', 52.00::numeric, '2026-05-29'::date, '2026-06-03'::date, '黄采购', '部分到货', '{"demo":true,"contract":"CT-202606-002"}'::jsonb),
    ('PO-202606-003', 'PR-202606-005', 'SUP-003', '真空袋 500g', 5000::numeric, '个', 0.36::numeric, '2026-05-30'::date, '2026-06-05'::date, '周采购', '已下单', '{"demo":true,"contract":"CT-202606-003"}'::jsonb),
    ('PO-202606-004', 'PR-202606-006', 'SUP-012', '冰袋', 3500::numeric, '个', 0.28::numeric, '2026-05-30'::date, '2026-06-04'::date, '周采购', '草稿', '{"demo":true,"contract":"CT-202606-004"}'::jsonb)
)
INSERT INTO public.purchase_orders (
  order_no, demand_id, source_demand_no, supplier_id, supplier_name, material_name,
  quantity, unit, unit_price, total_amount, order_date, expected_arrival_date,
  buyer_name, order_status, status, properties
)
SELECT d.order_no, pr.id, d.demand_no, s.id, s.name, d.material_name,
       d.quantity, d.unit, d.unit_price, round(d.quantity * d.unit_price, 2),
       d.order_date, d.expected_arrival_date, d.buyer_name, d.order_status, 'active', d.properties
FROM demo_po d
JOIN demands pr ON pr.demand_no = d.demand_no
JOIN suppliers s ON s.supplier_no = d.supplier_no
ON CONFLICT (order_no) DO UPDATE
SET demand_id = EXCLUDED.demand_id,
    source_demand_no = EXCLUDED.source_demand_no,
    supplier_id = EXCLUDED.supplier_id,
    supplier_name = EXCLUDED.supplier_name,
    material_name = EXCLUDED.material_name,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    unit_price = EXCLUDED.unit_price,
    total_amount = EXCLUDED.total_amount,
    order_date = EXCLUDED.order_date,
    expected_arrival_date = EXCLUDED.expected_arrival_date,
    buyer_name = EXCLUDED.buyer_name,
    order_status = EXCLUDED.order_status,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

WITH orders AS (
  SELECT id, order_no, supplier_id, supplier_name, material_name, unit
  FROM public.purchase_orders
),
demo_arrivals(arrival_no, order_no, arrival_quantity, accepted_quantity, arrival_date, iqc_status, inbound_no, arrival_status, properties) AS (
  VALUES
    ('ARR-202606-001', 'PO-202606-001', 260::numeric, 260::numeric, '2026-06-01'::date, '合格', 'IN-20260601-001', '已入库', '{"demo":true,"temperature":"-18C","vehicle":"粤A-DEMO1"}'::jsonb),
    ('ARR-202606-002', 'PO-202606-002', 180::numeric, 170::numeric, '2026-06-02'::date, '让步接收', 'IN-20260602-001', '已入库', '{"demo":true,"temperature":"-18C","vehicle":"辽B-DEMO2","deduction":"外箱破损10kg"}'::jsonb),
    ('ARR-202606-003', 'PO-202606-003', 3000::numeric, 3000::numeric, '2026-06-04'::date, '待检', NULL, '待检验', '{"demo":true,"vehicle":"粤J-DEMO3"}'::jsonb)
)
INSERT INTO public.purchase_arrivals (
  arrival_no, order_id, order_no, supplier_id, supplier_name, material_name,
  arrival_quantity, accepted_quantity, unit, arrival_date, iqc_status,
  inbound_no, arrival_status, status, properties
)
SELECT d.arrival_no, o.id, o.order_no, o.supplier_id, o.supplier_name, o.material_name,
       d.arrival_quantity, d.accepted_quantity, o.unit, d.arrival_date,
       d.iqc_status, d.inbound_no, d.arrival_status, 'active', d.properties
FROM demo_arrivals d
JOIN orders o ON o.order_no = d.order_no
ON CONFLICT (arrival_no) DO UPDATE
SET order_id = EXCLUDED.order_id,
    order_no = EXCLUDED.order_no,
    supplier_id = EXCLUDED.supplier_id,
    supplier_name = EXCLUDED.supplier_name,
    material_name = EXCLUDED.material_name,
    arrival_quantity = EXCLUDED.arrival_quantity,
    accepted_quantity = EXCLUDED.accepted_quantity,
    unit = EXCLUDED.unit,
    arrival_date = EXCLUDED.arrival_date,
    iqc_status = EXCLUDED.iqc_status,
    inbound_no = EXCLUDED.inbound_no,
    arrival_status = EXCLUDED.arrival_status,
    status = EXCLUDED.status,
    properties = EXCLUDED.properties,
    updated_at = now();

-- 4. Production work orders generated around demo sales/BOM.
WITH materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no, name
  FROM public.raw_materials
  ORDER BY batch_no, id
),
demo_orders(work_order_no, source_order_nos, product_code, bom_no, planned_qty, unit, planned_start_date, planned_finish_date, work_order_status, priority, remark, properties) AS (
  VALUES
    ('WO-DEMO-202606-001', 'SO-202606-001, SO-202606-005', 'MAT-FG-003', 'BOM-MAT-FG-003-V1', 760::numeric, '盒', '2026-05-30'::date, '2026-06-03'::date, '生产中', '高', '香辣虾仁订单合并生产', '{"demo":true,"line":"预制菜二线","shift":"早班"}'::jsonb),
    ('WO-DEMO-202606-002', 'SO-202606-002, SO-202606-007', 'MAT-FG-004', 'BOM-MAT-FG-004-V1', 580::numeric, '盒', '2026-05-31'::date, '2026-06-05'::date, '已排产', '普通', '黑椒龙利鱼柳订单生产', '{"demo":true,"line":"预制菜一线","shift":"中班"}'::jsonb),
    ('WO-DEMO-202606-003', 'SO-202606-003, SO-202606-006', 'MAT-FG-005', 'BOM-MAT-FG-005-V1', 820::numeric, '盒', '2026-05-31'::date, '2026-06-06'::date, '待排产', '紧急', '蒜蓉粉丝扇贝订单生产', '{"demo":true,"line":"预制菜三线","shift":"早班"}'::jsonb),
    ('WO-DEMO-202606-004', 'SO-202606-004', 'MAT-FG-001', 'BOM-MAT-FG-001-V1', 300::numeric, '盒', '2026-05-29'::date, '2026-06-02'::date, '已完工', '高', '金鲳鱼促销订单补货', '{"demo":true,"line":"预制菜一线","shift":"夜班"}'::jsonb)
)
INSERT INTO scm.production_work_orders (
  work_order_no, source_type, source_order_nos, product_material_id,
  product_material_code, product_material_name, bom_id, bom_no, bom_version,
  planned_qty, unit, planned_start_date, planned_finish_date, work_order_status,
  priority, remark, properties, created_by
)
SELECT d.work_order_no, 'sales_bom_mrp', d.source_order_nos, m.id,
       m.batch_no, m.name, b.id, b.bom_no, b.version,
       d.planned_qty, d.unit, d.planned_start_date, d.planned_finish_date,
       d.work_order_status, d.priority, d.remark, d.properties, 'system'
FROM demo_orders d
JOIN materials m ON m.batch_no = d.product_code
JOIN scm.boms b ON b.bom_no = d.bom_no
ON CONFLICT (work_order_no) DO UPDATE
SET source_order_nos = EXCLUDED.source_order_nos,
    product_material_id = EXCLUDED.product_material_id,
    product_material_code = EXCLUDED.product_material_code,
    product_material_name = EXCLUDED.product_material_name,
    bom_id = EXCLUDED.bom_id,
    bom_no = EXCLUDED.bom_no,
    bom_version = EXCLUDED.bom_version,
    planned_qty = EXCLUDED.planned_qty,
    unit = EXCLUDED.unit,
    planned_start_date = EXCLUDED.planned_start_date,
    planned_finish_date = EXCLUDED.planned_finish_date,
    work_order_status = EXCLUDED.work_order_status,
    priority = EXCLUDED.priority,
    remark = EXCLUDED.remark,
    properties = EXCLUDED.properties,
    updated_at = now();

DELETE FROM scm.production_work_order_items i
USING scm.production_work_orders wo
WHERE i.work_order_id = wo.id
  AND wo.work_order_no LIKE 'WO-DEMO-202606-%';

WITH inv AS (
  SELECT material_id, SUM(available_qty)::numeric AS available_qty
  FROM scm.inventory_batches
  WHERE COALESCE(status, '正常') <> '耗尽'
  GROUP BY material_id
),
calc AS (
  SELECT
    wo.id AS work_order_id,
    bi.line_no,
    bi.component_material_id,
    cm.batch_no AS component_material_code,
    cm.name AS component_material_name,
    round((bi.qty * wo.planned_qty / NULLIF(b.base_qty, 0)) * (1 + COALESCE(bi.loss_rate, 0)), 6) AS required_qty,
    bi.unit,
    wo.work_order_status,
    COALESCE(inv.available_qty, 0) AS available_qty,
    bi.remark
  FROM scm.production_work_orders wo
  JOIN scm.boms b ON b.id = wo.bom_id
  JOIN scm.bom_items bi ON bi.bom_id = b.id
  JOIN public.raw_materials cm ON cm.id = bi.component_material_id
  LEFT JOIN inv ON inv.material_id = bi.component_material_id
  WHERE wo.work_order_no LIKE 'WO-DEMO-202606-%'
)
INSERT INTO scm.production_work_order_items (
  work_order_id, line_no, component_material_id, component_material_code,
  component_material_name, required_qty, unit, issued_qty, shortage_qty,
  issue_status, remark, properties
)
SELECT
  work_order_id,
  line_no,
  component_material_id,
  component_material_code,
  component_material_name,
  required_qty,
  unit,
  CASE
    WHEN work_order_status = '已完工' THEN required_qty
    WHEN work_order_status = '生产中' THEN round(required_qty * 0.45, 6)
    ELSE 0
  END AS issued_qty,
  CASE
    WHEN work_order_status = '已完工' THEN 0
    ELSE GREATEST(required_qty - available_qty, 0)
  END AS shortage_qty,
  CASE
    WHEN work_order_status = '已完工' THEN '已齐套'
    WHEN GREATEST(required_qty - available_qty, 0) > 0 THEN '部分领料'
    ELSE '已齐套'
  END AS issue_status,
  CASE
    WHEN work_order_status = '已完工' THEN '已完工消耗'
    WHEN GREATEST(required_qty - available_qty, 0) > 0 THEN '库存不足，需采购或补料'
    ELSE '库存满足'
  END AS remark,
  jsonb_build_object('demo', true, 'available_qty', available_qty, 'source', 'demo_data_expand_20260529')
FROM calc;

-- 5. Inventory drafts, checks and workflow runtime demo data.
WITH materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  ORDER BY batch_no, id
),
warehouses AS (
  SELECT id, code
  FROM scm.warehouses
),
batches AS (
  SELECT b.id, m.batch_no AS material_code, b.batch_no, w.code AS warehouse_code
  FROM scm.inventory_batches b
  JOIN public.raw_materials m ON m.id = b.material_id
  JOIN scm.warehouses w ON w.id = b.warehouse_id
),
demo_drafts(id, draft_type, status, material_code, warehouse_code, batch_no, quantity, unit, production_date, remark, operator, transaction_no, io_type, properties) AS (
  VALUES
    ('00000000-0000-4006-8000-000000000101'::uuid, 'in', 'active', 'MAT-RM-004', 'RM-A02', 'RM-20260601-001', 300::numeric, '千克', '2026-06-01'::date, '演示：龙利鱼柳采购到货待复核', '罗采购', 'DR-IN-20260601-001', '采购入库', '{"demo":true,"supplier":"海南深海食材","workflow_business_key":"00000000-0000-4006-8000-000000000101"}'::jsonb),
    ('00000000-0000-4006-8000-000000000102'::uuid, 'out', 'locked', 'MAT-FG-003', 'FG-C02', 'FG-20260527-001', 160::numeric, '盒', '2026-05-27'::date, '演示：香辣虾仁销售出库已锁定', '高渠道', 'DR-OUT-20260601-001', '销售出库', '{"demo":true,"customer":"广州湾区盒马鲜配","workflow_business_key":"00000000-0000-4006-8000-000000000102"}'::jsonb),
    ('00000000-0000-4006-8000-000000000103'::uuid, 'out', 'active', 'MAT-RM-005', 'RM-A02', 'RM-20260525-001', 95::numeric, '千克', '2026-05-25'::date, '演示：扇贝生产领料待审批', '许计划', 'DR-OUT-20260601-002', '生产领料', '{"demo":true,"work_order":"WO-DEMO-202606-003","workflow_business_key":"00000000-0000-4006-8000-000000000103"}'::jsonb)
)
INSERT INTO scm.inventory_drafts (
  id, draft_type, status, material_id, warehouse_id, batch_id, batch_no,
  quantity, unit, production_date, remark, operator, transaction_no, properties,
  io_type
)
SELECT d.id, d.draft_type, d.status, m.id, w.id, b.id, d.batch_no,
       d.quantity, d.unit, d.production_date, d.remark, d.operator,
       d.transaction_no, d.properties, d.io_type
FROM demo_drafts d
JOIN materials m ON m.batch_no = d.material_code
JOIN warehouses w ON w.code = d.warehouse_code
LEFT JOIN batches b
  ON b.material_code = d.material_code
 AND b.batch_no = d.batch_no
 AND b.warehouse_code = d.warehouse_code
ON CONFLICT (id) DO UPDATE
SET draft_type = EXCLUDED.draft_type,
    status = EXCLUDED.status,
    material_id = EXCLUDED.material_id,
    warehouse_id = EXCLUDED.warehouse_id,
    batch_id = EXCLUDED.batch_id,
    batch_no = EXCLUDED.batch_no,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    production_date = EXCLUDED.production_date,
    remark = EXCLUDED.remark,
    operator = EXCLUDED.operator,
    transaction_no = EXCLUDED.transaction_no,
    properties = EXCLUDED.properties,
    io_type = EXCLUDED.io_type,
    updated_at = now();

WITH warehouses AS (
  SELECT id, code
  FROM scm.warehouses
),
demo_checks(check_no, warehouse_code, check_date, status, total_items, diff_count, created_by, completed_at) AS (
  VALUES
    ('CHK-202606-001', 'RM-A02', '2026-06-01'::date, '已完成', 4, 1, '蒋冷链', '2026-06-01 17:30:00+08'::timestamptz),
    ('CHK-202606-002', 'FG-C02', '2026-06-02'::date, '进行中', 3, 0, '陈仓', NULL::timestamptz)
)
INSERT INTO scm.inventory_checks (
  check_no, warehouse_id, check_date, status, total_items, diff_count,
  created_by, completed_at
)
SELECT d.check_no, w.id, d.check_date, d.status, d.total_items, d.diff_count,
       d.created_by, d.completed_at
FROM demo_checks d
JOIN warehouses w ON w.code = d.warehouse_code
ON CONFLICT (check_no) DO UPDATE
SET warehouse_id = EXCLUDED.warehouse_id,
    check_date = EXCLUDED.check_date,
    status = EXCLUDED.status,
    total_items = EXCLUDED.total_items,
    diff_count = EXCLUDED.diff_count,
    created_by = EXCLUDED.created_by,
    completed_at = EXCLUDED.completed_at;

DELETE FROM scm.inventory_check_items i
USING scm.inventory_checks c
WHERE i.check_id = c.id
  AND c.check_no IN ('CHK-202606-001', 'CHK-202606-002');

WITH checks AS (
  SELECT id, check_no
  FROM scm.inventory_checks
),
materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  ORDER BY batch_no, id
),
warehouses AS (
  SELECT id, code
  FROM scm.warehouses
),
demo_items(check_no, material_code, batch_no, warehouse_code, book_qty, actual_qty, unit, operator, scan_time, remark, properties) AS (
  VALUES
    ('CHK-202606-001', 'MAT-RM-004', 'RM-20260524-001', 'RM-A02', 520::numeric, 520::numeric, '千克', '蒋冷链', '2026-06-01 10:20:00+08'::timestamptz, '账实一致', '{"demo":true}'::jsonb),
    ('CHK-202606-001', 'MAT-RM-005', 'RM-20260525-001', 'RM-A02', 280::numeric, 276::numeric, '千克', '蒋冷链', '2026-06-01 10:35:00+08'::timestamptz, '抽盘少4kg，待复核', '{"demo":true,"diff_reason":"抽盘差异"}'::jsonb),
    ('CHK-202606-001', 'MAT-RM-006', 'RM-20260525-002', 'RM-A02', 450::numeric, 450::numeric, '千克', '蒋冷链', '2026-06-01 10:50:00+08'::timestamptz, '账实一致', '{"demo":true}'::jsonb),
    ('CHK-202606-002', 'MAT-FG-003', 'FG-20260527-001', 'FG-C02', 180::numeric, 180::numeric, '盒', '陈仓', '2026-06-02 09:10:00+08'::timestamptz, '进行中', '{"demo":true}'::jsonb),
    ('CHK-202606-002', 'MAT-FG-004', 'FG-20260527-002', 'FG-C02', 260::numeric, 260::numeric, '盒', '陈仓', '2026-06-02 09:25:00+08'::timestamptz, '进行中', '{"demo":true}'::jsonb),
    ('CHK-202606-002', 'MAT-FG-005', 'FG-20260528-001', 'FG-C02', 120::numeric, 120::numeric, '盒', '陈仓', '2026-06-02 09:40:00+08'::timestamptz, '进行中', '{"demo":true}'::jsonb)
)
INSERT INTO scm.inventory_check_items (
  check_id, material_id, batch_no, warehouse_id, book_qty, actual_qty,
  unit, operator, scan_time, remark, properties
)
SELECT c.id, m.id, d.batch_no, w.id, d.book_qty, d.actual_qty,
       d.unit, d.operator, d.scan_time, d.remark, d.properties
FROM demo_items d
JOIN checks c ON c.check_no = d.check_no
JOIN materials m ON m.batch_no = d.material_code
JOIN warehouses w ON w.code = d.warehouse_code;

-- HR attendance and payroll data for the new demo staff.
WITH active_archives AS (
  SELECT id, employee_no, name, department, position, base_salary
  FROM hr.archives
  WHERE COALESCE(status, '在职') IN ('在职', '待开通账号', '待入职')
),
days AS (
  SELECT generate_series('2026-05-27'::date, '2026-06-05'::date, '1 day')::date AS att_date
),
rows AS (
  SELECT
    d.att_date,
    a.id AS employee_id,
    a.employee_no,
    a.name,
    a.department,
    CASE WHEN a.department = '生产一部' THEN '早班' ELSE '白班' END AS shift_name,
    CASE
      WHEN extract(isodow FROM d.att_date) IN (6, 7) THEN ARRAY[]::text[]
      WHEN (a.id + extract(day FROM d.att_date)::int) % 11 = 0 THEN ARRAY['08:48','17:42']::text[]
      WHEN (a.id + extract(day FROM d.att_date)::int) % 13 = 0 THEN ARRAY['08:23','16:55']::text[]
      ELSE ARRAY['08:22','17:45']::text[]
    END AS punch_times,
    CASE WHEN extract(isodow FROM d.att_date) NOT IN (6, 7) AND (a.id + extract(day FROM d.att_date)::int) % 11 = 0 THEN true ELSE false END AS late_flag,
    CASE WHEN extract(isodow FROM d.att_date) NOT IN (6, 7) AND (a.id + extract(day FROM d.att_date)::int) % 13 = 0 THEN true ELSE false END AS early_flag,
    CASE WHEN extract(isodow FROM d.att_date) IN (6, 7) THEN '周末休息' ELSE NULL END AS remark
  FROM active_archives a
  CROSS JOIN days d
)
INSERT INTO hr.attendance_records (
  att_date, person_type, employee_id, employee_name, employee_no, dept_name,
  shift_name, shift_start_time, shift_end_time, shift_cross_day,
  late_grace_min, early_grace_min, ot_break_min, punch_times,
  late_flag, early_flag, leave_flag, absent_flag, overtime_minutes, remark
)
SELECT att_date, 'employee', employee_id, name, employee_no, department,
       shift_name, '08:30'::time, '17:30'::time, false,
       10, 10, 30, punch_times, late_flag, early_flag, false, false,
       CASE WHEN department = '生产一部' AND extract(isodow FROM att_date) NOT IN (6, 7) THEN 45 ELSE 0 END,
       remark
FROM rows
ON CONFLICT (att_date, employee_id) WHERE (person_type = 'employee' AND employee_id IS NOT NULL)
DO UPDATE SET employee_name = EXCLUDED.employee_name,
              employee_no = EXCLUDED.employee_no,
              dept_name = EXCLUDED.dept_name,
              shift_name = EXCLUDED.shift_name,
              punch_times = EXCLUDED.punch_times,
              late_flag = EXCLUDED.late_flag,
              early_flag = EXCLUDED.early_flag,
              overtime_minutes = EXCLUDED.overtime_minutes,
              remark = EXCLUDED.remark,
              updated_at = now();

WITH payroll_rows AS (
  SELECT
    id AS archive_id,
    '2026-06'::varchar AS month,
    round(base_salary + CASE
      WHEN department = '销售部' THEN 1200
      WHEN department = '生产一部' THEN 650
      WHEN department = '采购部' THEN 700
      WHEN department = '仓储部' THEN 500
      ELSE 450
    END, 2) AS total_amount,
    CASE
      WHEN department IN ('仓储部', '销售部') THEN '已确认'
      ELSE '草稿'
    END AS status
  FROM hr.archives
  WHERE COALESCE(status, '在职') IN ('在职', '待开通账号', '待入职')
),
updated AS (
  UPDATE hr.payroll p
  SET total_amount = r.total_amount,
      status = r.status
  FROM payroll_rows r
  WHERE p.archive_id = r.archive_id
    AND p.month = r.month
  RETURNING p.archive_id, p.month
)
INSERT INTO hr.payroll (archive_id, month, total_amount, status)
SELECT r.archive_id, r.month, r.total_amount, r.status
FROM payroll_rows r
WHERE NOT EXISTS (
  SELECT 1
  FROM updated u
  WHERE u.archive_id = r.archive_id
    AND u.month = r.month
);

-- Workflow instances and events for onboarding / inventory collaboration.
WITH target_instances(definition_name, business_key, current_task_id, status, variables, started_at, ended_at) AS (
  SELECT '入职流程', a.id::text, 'Task_HRReview', 'ACTIVE',
         jsonb_build_object('title', a.position || a.name || '入职', 'priority', '普通', 'applicant', '宋入职', 'demo', true, 'source', 'demo_data_expand_20260529'),
         '2026-05-28 09:10:00+08'::timestamptz, NULL::timestamptz
  FROM hr.archives a
  WHERE a.employee_no = 'NP2024030'
  UNION ALL
  SELECT '入职流程', a.id::text, 'Task_AccountProvision', 'ACTIVE',
         jsonb_build_object('title', a.position || a.name || '入职', 'priority', '高', 'applicant', '林静', 'demo', true, 'source', 'demo_data_expand_20260529'),
         '2026-05-27 10:00:00+08'::timestamptz, NULL::timestamptz
  FROM hr.archives a
  WHERE a.employee_no = 'NP2024028'
  UNION ALL
  SELECT '出入库协同流程', '00000000-0000-4006-8000-000000000101', 'Task_InboundReview', 'ACTIVE',
         '{"title":"龙利鱼柳采购入库","amount":"300kg","source":"采购部","demo":true,"source_seed":"demo_data_expand_20260529"}'::jsonb,
         '2026-06-01 09:00:00+08'::timestamptz, NULL::timestamptz
  UNION ALL
  SELECT '出入库协同流程', '00000000-0000-4006-8000-000000000102', 'Task_OutboundExecute', 'ACTIVE',
         '{"title":"香辣虾仁销售出库","amount":"160盒","source":"销售部","demo":true,"source_seed":"demo_data_expand_20260529"}'::jsonb,
         '2026-06-01 10:30:00+08'::timestamptz, NULL::timestamptz
  UNION ALL
  SELECT '出入库协同流程', '00000000-0000-4006-8000-000000000103', 'Task_OutboundExecute', 'ACTIVE',
         '{"title":"扇贝生产领料","amount":"95kg","source":"生产一部","demo":true,"source_seed":"demo_data_expand_20260529"}'::jsonb,
         '2026-06-01 14:15:00+08'::timestamptz, NULL::timestamptz
),
target_with_def AS (
  SELECT d.id AS definition_id, t.business_key, t.current_task_id, t.status, t.variables, t.started_at, t.ended_at
  FROM target_instances t
  JOIN workflow.definitions d ON d.name = t.definition_name
),
updated AS (
  UPDATE workflow.instances i
  SET current_task_id = t.current_task_id,
      status = t.status,
      variables = t.variables,
      started_at = t.started_at,
      ended_at = t.ended_at
  FROM target_with_def t
  WHERE i.definition_id = t.definition_id
    AND i.business_key = t.business_key
  RETURNING i.id
)
INSERT INTO workflow.instances (
  definition_id, business_key, current_task_id, status, variables, started_at, ended_at
)
SELECT definition_id, business_key, current_task_id, status, variables, started_at, ended_at
FROM target_with_def t
WHERE NOT EXISTS (
  SELECT 1
  FROM workflow.instances i
  WHERE i.definition_id = t.definition_id
    AND i.business_key = t.business_key
);

DELETE FROM workflow.task_approvals a
USING workflow.instances i
WHERE a.instance_id = i.id
  AND a.payload->>'source' = 'demo_data_expand_20260529';

DELETE FROM workflow.instance_events e
USING workflow.instances i
WHERE e.instance_id = i.id
  AND e.payload->>'source' = 'demo_data_expand_20260529';

WITH instances AS (
  SELECT i.id, d.name AS definition_name, i.business_key
  FROM workflow.instances i
  JOIN workflow.definitions d ON d.id = i.definition_id
  WHERE i.variables->>'source' = 'demo_data_expand_20260529'
     OR i.variables->>'source_seed' = 'demo_data_expand_20260529'
),
event_rows(instance_id, definition_id, event_type, from_task_id, to_task_id, actor_username, actor_role, payload, created_at) AS (
  SELECT i.id, wi.definition_id, 'INSTANCE_STARTED', NULL, 'Task_Submit', 'hr_clerk', 'hr_clerk',
         jsonb_build_object('business_key', i.business_key, 'source', 'demo_data_expand_20260529'),
         wi.started_at
  FROM instances i
  JOIN workflow.instances wi ON wi.id = i.id
  WHERE i.definition_name = '入职流程'
  UNION ALL
  SELECT i.id, wi.definition_id, 'TASK_TRANSITION', 'Task_Submit', 'Task_HRReview', 'hr_clerk', 'hr_clerk',
         '{"approval":{"comment":"入职资料已收齐，提交人事复核"},"source":"demo_data_expand_20260529"}'::jsonb,
         wi.started_at + interval '2 hours'
  FROM instances i
  JOIN workflow.instances wi ON wi.id = i.id
  WHERE i.definition_name = '入职流程'
  UNION ALL
  SELECT i.id, wi.definition_id, 'TASK_TRANSITION', 'Task_HRReview', 'Task_AccountProvision', 'hr_admin', 'hr_admin',
         '{"approval":{"comment":"岗位和薪资确认，进入账号开通"},"source":"demo_data_expand_20260529"}'::jsonb,
         wi.started_at + interval '1 day'
  FROM instances i
  JOIN workflow.instances wi ON wi.id = i.id
  WHERE i.definition_name = '入职流程'
    AND wi.current_task_id = 'Task_AccountProvision'
  UNION ALL
  SELECT i.id, wi.definition_id, 'INSTANCE_STARTED', NULL, 'Task_InboundRequest',
         CASE
           WHEN wi.variables->>'source' = '销售部' THEN 'channel_sales'
           WHEN wi.variables->>'source' = '生产一部' THEN 'production_planner'
           ELSE 'buyer_clerk'
         END,
         CASE
           WHEN wi.variables->>'source' = '销售部' THEN 'sales_manager'
           WHEN wi.variables->>'source' = '生产一部' THEN 'dept_manager'
           ELSE 'purchase_manager'
         END,
         jsonb_build_object('business_key', i.business_key, 'source', 'demo_data_expand_20260529'),
         wi.started_at
  FROM instances i
  JOIN workflow.instances wi ON wi.id = i.id
  WHERE i.definition_name = '出入库协同流程'
  UNION ALL
  SELECT i.id, wi.definition_id, 'TASK_TRANSITION', 'Task_InboundRequest',
         CASE
           WHEN wi.current_task_id = 'Task_OutboundExecute' THEN 'Task_OutboundExecute'
           ELSE 'Task_InboundReview'
         END,
         'warehouse_keeper', 'warehouse_keeper',
         '{"approval":{"comment":"仓储已接单并锁定批次"},"source":"demo_data_expand_20260529"}'::jsonb,
         wi.started_at + interval '45 minutes'
  FROM instances i
  JOIN workflow.instances wi ON wi.id = i.id
  WHERE i.definition_name = '出入库协同流程'
)
INSERT INTO workflow.instance_events (
  instance_id, definition_id, event_type, from_task_id, to_task_id,
  actor_username, actor_role, payload, created_at
)
SELECT instance_id, definition_id, event_type, from_task_id, to_task_id,
       actor_username, actor_role, payload, created_at
FROM event_rows;

WITH instances AS (
  SELECT i.id, i.definition_id, d.name AS definition_name, i.current_task_id
  FROM workflow.instances i
  JOIN workflow.definitions d ON d.id = i.definition_id
  WHERE i.variables->>'source' = 'demo_data_expand_20260529'
     OR i.variables->>'source_seed' = 'demo_data_expand_20260529'
),
approval_rows(instance_id, definition_id, task_id, actor_username, actor_role, decision, comment, payload, created_at) AS (
  SELECT id, definition_id, 'Task_Submit', 'hr_clerk', 'hr_clerk', 'approved', '资料完整，提交初审', '{"source":"demo_data_expand_20260529"}'::jsonb, '2026-05-28 11:10:00+08'::timestamptz
  FROM instances
  WHERE definition_name = '入职流程'
  UNION ALL
  SELECT id, definition_id, 'Task_HRReview', 'hr_admin', 'hr_admin', 'approved', '岗位与薪资确认', '{"source":"demo_data_expand_20260529"}'::jsonb, '2026-05-28 16:20:00+08'::timestamptz
  FROM instances
  WHERE definition_name = '入职流程'
    AND current_task_id = 'Task_AccountProvision'
  UNION ALL
  SELECT id, definition_id, 'Task_InboundRequest', 'buyer_clerk', 'purchase_manager', 'approved', '采购到货提交仓储复核', '{"source":"demo_data_expand_20260529"}'::jsonb, '2026-06-01 09:45:00+08'::timestamptz
  FROM instances
  WHERE definition_name = '出入库协同流程'
    AND current_task_id = 'Task_InboundReview'
  UNION ALL
  SELECT id, definition_id, 'Task_InboundReview', 'warehouse_keeper', 'warehouse_keeper', 'approved', '已锁定库存，等待出库执行', '{"source":"demo_data_expand_20260529"}'::jsonb, '2026-06-01 11:20:00+08'::timestamptz
  FROM instances
  WHERE definition_name = '出入库协同流程'
    AND current_task_id = 'Task_OutboundExecute'
)
INSERT INTO workflow.task_approvals (
  instance_id, definition_id, task_id, actor_username, actor_role,
  decision, comment, payload, created_at, updated_at
)
SELECT instance_id, definition_id, task_id, actor_username, actor_role,
       decision, comment, payload, created_at, created_at
FROM approval_rows;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
