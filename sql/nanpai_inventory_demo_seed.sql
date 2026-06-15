-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Focused Nanpai inventory demo data for remote deployment.
-- This script is idempotent and only touches demo rows identified by codes below.

SET client_encoding = 'UTF8';

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO scm.batch_no_rules (
  rule_name, rule_template, reset_strategy, applicable_categories, status,
  example_output, description, created_by
)
VALUES
  (
    '南派默认批次号规则',
    '{物料编码}-{日期:YYYYMMDD}-{序号:3}',
    '每日',
    ARRAY['RM-FISH','RM-SHELLFISH','AUX-SAUCE','AUX-NOODLE','PKG-BAG','PKG-COLD','PKG-TAPE','FG-SHRIMP','FG-FISH','FG-SHELLFISH'],
    '启用',
    'MAT-RM-004-20260609-001',
    '南派食品演示环境默认批次规则，适用于原料、辅料、包材和成品。',
    'system'
  ),
  (
    '冷链物料批次号规则',
    'CL-{物料分类}-{日期:YYYYMMDD}-{序号:3}',
    '每日',
    ARRAY['RM-FISH','RM-SHELLFISH','FG-SHRIMP','FG-FISH','FG-SHELLFISH'],
    '启用',
    'CL-RM-FISH-20260609-001',
    '冷链原料和冷冻成品专用批次号规则。',
    'system'
  )
ON CONFLICT (rule_name) DO UPDATE
SET rule_template = EXCLUDED.rule_template,
    reset_strategy = EXCLUDED.reset_strategy,
    applicable_categories = EXCLUDED.applicable_categories,
    status = EXCLUDED.status,
    example_output = EXCLUDED.example_output,
    description = EXCLUDED.description,
    updated_at = now();

WITH demo_materials(batch_no, name, category, weight_kg, entry_date, created_by, properties) AS (
  VALUES
    ('MAT-RM-004', '龙利鱼柳', 'RM-FISH', 760::numeric, '2026-05-24'::date, 'system', '{"demo":true,"supplier":"海南深海食材","storage":"-18C冷冻","quality_standard":"去刺鱼柳","unit":"千克"}'::jsonb),
    ('MAT-RM-005', '扇贝肉', 'RM-SHELLFISH', 420::numeric, '2026-05-25'::date, 'system', '{"demo":true,"supplier":"大连湾海产","storage":"-18C冷冻","quality_standard":"去壳净肉","unit":"千克"}'::jsonb),
    ('MAT-RM-006', '青口贝', 'RM-SHELLFISH', 380::numeric, '2026-05-25'::date, 'system', '{"demo":true,"supplier":"福建蓝海贝业","storage":"-18C冷冻","quality_standard":"半壳清洗","unit":"千克"}'::jsonb),
    ('MAT-AUX-005', '蒜蓉酱', 'AUX-SAUCE', 180::numeric, '2026-05-20'::date, 'system', '{"demo":true,"supplier":"广东味源香料有限公司","storage":"常温避光","unit":"千克"}'::jsonb),
    ('MAT-AUX-006', '粉丝', 'AUX-NOODLE', 260::numeric, '2026-05-20'::date, 'system', '{"demo":true,"supplier":"佛山优谷淀粉厂","storage":"常温干燥","unit":"千克"}'::jsonb),
    ('MAT-AUX-007', '香辣酱', 'AUX-SAUCE', 150::numeric, '2026-05-21'::date, 'system', '{"demo":true,"supplier":"广东味源香料有限公司","storage":"常温避光","unit":"千克"}'::jsonb),
    ('MAT-AUX-008', '黑椒调味酱', 'AUX-SAUCE', 130::numeric, '2026-05-21'::date, 'system', '{"demo":true,"supplier":"广州鲜味蛋白科技","storage":"常温避光","unit":"千克"}'::jsonb),
    ('MAT-PKG-004', '真空袋 500g', 'PKG-BAG', 96::numeric, '2026-05-18'::date, 'system', '{"demo":true,"supplier":"江门绿田包装材料","spec":"500g透明耐冻袋","unit":"个"}'::jsonb),
    ('MAT-PKG-005', '冰袋', 'PKG-COLD', 80::numeric, '2026-05-18'::date, 'system', '{"demo":true,"supplier":"惠州冷链物流配套","spec":"120g冷链冰袋","unit":"个"}'::jsonb),
    ('MAT-PKG-006', '封箱胶带', 'PKG-TAPE', 55::numeric, '2026-05-18'::date, 'system', '{"demo":true,"supplier":"江门绿田包装材料","spec":"48mm透明胶带","unit":"卷"}'::jsonb),
    ('MAT-FG-003', '香辣虾仁预制菜', 'FG-SHRIMP', 300::numeric, '2026-05-26'::date, 'system', '{"demo":true,"shelf_life_days":270,"line":"预制菜二线","sales_unit":"盒","unit":"盒"}'::jsonb),
    ('MAT-FG-004', '黑椒龙利鱼柳预制菜', 'FG-FISH', 260::numeric, '2026-05-26'::date, 'system', '{"demo":true,"shelf_life_days":270,"line":"预制菜一线","sales_unit":"盒","unit":"盒"}'::jsonb),
    ('MAT-FG-005', '蒜蓉粉丝扇贝预制菜', 'FG-SHELLFISH', 180::numeric, '2026-05-26'::date, 'system', '{"demo":true,"shelf_life_days":240,"line":"预制菜三线","sales_unit":"盒","unit":"盒"}'::jsonb)
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

WITH root_warehouses(code, name, sort, capacity, unit, properties) AS (
  VALUES
    ('RM', '原辅料仓', 10, 6000::numeric, '千克', '{"demo":true,"layout_enabled":true,"purpose":"水产原料及辅料","temperature":"-18C/常温分区"}'::jsonb),
    ('PKG', '包材仓', 20, 23000::numeric, '个', '{"demo":true,"layout_enabled":true,"purpose":"内外包装材料","temperature":"常温"}'::jsonb),
    ('FG', '成品仓', 30, 4200::numeric, '盒', '{"demo":true,"layout_enabled":true,"purpose":"成品冷冻存储","temperature":"-18C"}'::jsonb)
)
INSERT INTO scm.warehouses (code, name, parent_id, level, sort, status, capacity, unit, properties, created_by)
SELECT code, name, NULL, 1, sort, '启用', capacity, unit, properties, 'system'
FROM root_warehouses
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level,
    sort = EXCLUDED.sort,
    status = EXCLUDED.status,
    capacity = EXCLUDED.capacity,
    unit = EXCLUDED.unit,
    properties = COALESCE(scm.warehouses.properties, '{}'::jsonb) || EXCLUDED.properties,
    updated_at = now();

WITH area_specs(code, name, parent_code, sort, capacity, unit, properties) AS (
  VALUES
    ('RM-COLD', '原料冷冻库区', 'RM', 11, 4300::numeric, '千克', '{"demo":true,"area":"A区","temperature":"-18C","humidityMax":70}'::jsonb),
    ('RM-AUX', '辅料常温库区', 'RM', 14, 1200::numeric, '千克', '{"demo":true,"area":"B区","temperature":"常温","humidityMax":65}'::jsonb),
    ('PKG-INNER', '内包装库区', 'PKG', 31, 12000::numeric, '个', '{"demo":true,"area":"A区","temperature":"常温","humidityMax":70}'::jsonb),
    ('PKG-COLD', '冷链包材库区', 'PKG', 33, 8000::numeric, '个', '{"demo":true,"area":"B区","temperature":"常温","humidityMax":70}'::jsonb),
    ('FG-STD', '常规成品库区', 'FG', 21, 1800::numeric, '盒', '{"demo":true,"area":"C区","temperature":"-18C"}'::jsonb),
    ('FG-NEW', '新品成品库区', 'FG', 23, 2400::numeric, '盒', '{"demo":true,"area":"D区","temperature":"-18C"}'::jsonb)
)
INSERT INTO scm.warehouses (code, name, parent_id, level, sort, status, capacity, unit, properties, created_by)
SELECT a.code, a.name, p.id, 2, a.sort, '启用', a.capacity, a.unit, a.properties, 'system'
FROM area_specs a
JOIN scm.warehouses p ON p.code = a.parent_code
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level,
    sort = EXCLUDED.sort,
    status = EXCLUDED.status,
    capacity = EXCLUDED.capacity,
    unit = EXCLUDED.unit,
    properties = COALESCE(scm.warehouses.properties, '{}'::jsonb) || EXCLUDED.properties,
    updated_at = now();

WITH location_specs(code, name, parent_code, sort, capacity, unit, properties) AS (
  VALUES
    ('RM-A01', '原料冷冻A01库位', 'RM-COLD', 12, 2200::numeric, '千克', '{"demo":true,"temperature":"-18C","layout_zone":"冷冻原料主库位"}'::jsonb),
    ('RM-A02', '原料冷冻A02库位', 'RM-COLD', 13, 1800::numeric, '千克', '{"demo":true,"temperature":"-18C","layout_zone":"冷冻原料新品库位"}'::jsonb),
    ('RM-B01', '辅料B01库位', 'RM-AUX', 15, 2200::numeric, '千克', '{"demo":true,"temperature":"常温","layout_zone":"辅料常温主库位"}'::jsonb),
    ('PKG-A01', '包材A01库位', 'PKG-INNER', 32, 25000::numeric, '个', '{"demo":true,"temperature":"常温","layout_zone":"内包装主库位"}'::jsonb),
    ('PKG-A02', '包材A02库位', 'PKG-COLD', 34, 24000::numeric, '个', '{"demo":true,"temperature":"常温","layout_zone":"冷链包材主库位"}'::jsonb),
    ('FG-C01', '成品C01库位', 'FG-STD', 22, 1800::numeric, '盒', '{"demo":true,"temperature":"-18C","layout_zone":"常规成品主库位"}'::jsonb),
    ('FG-C02', '成品C02库位', 'FG-NEW', 24, 2600::numeric, '盒', '{"demo":true,"temperature":"-18C","layout_zone":"新品成品库位"}'::jsonb)
)
INSERT INTO scm.warehouses (code, name, parent_id, level, sort, status, capacity, unit, properties, created_by)
SELECT l.code, l.name, p.id, 3, l.sort, '启用', l.capacity, l.unit, l.properties, 'system'
FROM location_specs l
JOIN scm.warehouses p ON p.code = l.parent_code
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level,
    sort = EXCLUDED.sort,
    status = EXCLUDED.status,
    capacity = EXCLUDED.capacity,
    unit = EXCLUDED.unit,
    properties = COALESCE(scm.warehouses.properties, '{}'::jsonb) || EXCLUDED.properties,
    updated_at = now();

WITH materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  WHERE batch_no IN (
    'MAT-RM-004','MAT-RM-005','MAT-RM-006','MAT-AUX-005','MAT-AUX-006','MAT-AUX-007','MAT-AUX-008',
    'MAT-PKG-004','MAT-PKG-005','MAT-PKG-006','MAT-FG-003','MAT-FG-004','MAT-FG-005'
  )
  ORDER BY batch_no, id
),
warehouses AS (
  SELECT id, code FROM scm.warehouses
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
  SELECT id, code FROM scm.warehouses
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
       jsonb_build_object('demo', true, 'source', 'nanpai_inventory_demo_seed'),
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
warehouses AS (
  SELECT id, code FROM scm.warehouses
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
  SELECT id, code FROM scm.warehouses
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
  SELECT id, check_no FROM scm.inventory_checks
),
materials AS (
  SELECT DISTINCT ON (batch_no) id, batch_no
  FROM public.raw_materials
  ORDER BY batch_no, id
),
warehouses AS (
  SELECT id, code FROM scm.warehouses
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

DROP POLICY IF EXISTS inventory_transactions_insert ON scm.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_update ON scm.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_delete ON scm.inventory_transactions;
CREATE POLICY inventory_transactions_insert ON scm.inventory_transactions FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY inventory_transactions_update ON scm.inventory_transactions FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY inventory_transactions_delete ON scm.inventory_transactions FOR DELETE TO web_user USING (true);

DROP POLICY IF EXISTS inventory_checks_select ON scm.inventory_checks;
DROP POLICY IF EXISTS inventory_checks_insert ON scm.inventory_checks;
DROP POLICY IF EXISTS inventory_checks_update ON scm.inventory_checks;
DROP POLICY IF EXISTS inventory_checks_delete ON scm.inventory_checks;
CREATE POLICY inventory_checks_select ON scm.inventory_checks FOR SELECT TO web_user USING (true);
CREATE POLICY inventory_checks_insert ON scm.inventory_checks FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY inventory_checks_update ON scm.inventory_checks FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY inventory_checks_delete ON scm.inventory_checks FOR DELETE TO web_user USING (true);

DROP POLICY IF EXISTS inventory_check_items_select ON scm.inventory_check_items;
DROP POLICY IF EXISTS inventory_check_items_insert ON scm.inventory_check_items;
DROP POLICY IF EXISTS inventory_check_items_update ON scm.inventory_check_items;
DROP POLICY IF EXISTS inventory_check_items_delete ON scm.inventory_check_items;
CREATE POLICY inventory_check_items_select ON scm.inventory_check_items FOR SELECT TO web_user USING (true);
CREATE POLICY inventory_check_items_insert ON scm.inventory_check_items FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY inventory_check_items_update ON scm.inventory_check_items FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY inventory_check_items_delete ON scm.inventory_check_items FOR DELETE TO web_user USING (true);

GRANT USAGE ON SCHEMA scm TO web_anon, web_user;
GRANT SELECT ON ALL TABLES IN SCHEMA scm TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA scm TO web_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA scm TO web_user;

CREATE OR REPLACE VIEW public.batch_no_rules AS SELECT * FROM scm.batch_no_rules;
CREATE OR REPLACE VIEW public.warehouses AS SELECT * FROM scm.warehouses;
CREATE OR REPLACE VIEW public.warehouse_layouts AS SELECT * FROM scm.warehouse_layouts;
CREATE OR REPLACE VIEW public.inventory_batches AS SELECT * FROM scm.inventory_batches;
CREATE OR REPLACE VIEW public.inventory_transactions AS SELECT * FROM scm.inventory_transactions;
CREATE OR REPLACE VIEW public.inventory_drafts AS SELECT * FROM scm.inventory_drafts;
CREATE OR REPLACE VIEW public.inventory_checks AS SELECT * FROM scm.inventory_checks;
CREATE OR REPLACE VIEW public.inventory_check_items AS SELECT * FROM scm.inventory_check_items;
CREATE OR REPLACE VIEW public.v_inventory_current AS SELECT * FROM scm.v_inventory_current;
CREATE OR REPLACE VIEW public.v_inventory_transactions AS SELECT * FROM scm.v_inventory_transactions;
CREATE OR REPLACE VIEW public.v_inventory_drafts AS SELECT * FROM scm.v_inventory_drafts;

GRANT SELECT ON
  public.batch_no_rules,
  public.warehouses,
  public.warehouse_layouts,
  public.inventory_batches,
  public.inventory_transactions,
  public.inventory_drafts,
  public.inventory_checks,
  public.inventory_check_items,
  public.v_inventory_current,
  public.v_inventory_transactions,
  public.v_inventory_drafts
TO web_anon, web_user;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
