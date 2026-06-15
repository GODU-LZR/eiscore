-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Nanpai production demo data for the current EISCore deployment.
-- Depends on:
--   sql/material_bom_schema.sql
--   sql/material_bom_mrp_integration.sql
--   sql/production_bom_work_orders.sql

SET client_encoding = 'UTF8';

WITH order_map AS (
  SELECT *
  FROM (
    VALUES
      ('SO-202605-001', 'MAT-FG-003'),
      ('SO-202605-002', 'MAT-FG-004'),
      ('SO-202605-003', 'MAT-FG-003'),
      ('SO-202605-004', 'MAT-FG-004'),
      ('SO-202605-005', 'MAT-FG-005'),
      ('SO-202605-006', 'MAT-FG-003'),
      ('SO-202605-007', 'MAT-FG-005'),
      ('SO-202605-008', 'MAT-FG-004')
  ) AS x(order_no, material_code)
)
UPDATE public.sales_orders so
SET product_material_id = m.id,
    product_name = m.name,
    unit = COALESCE(m.properties->>'sales_unit', m.properties->>'unit', so.unit, '盒'),
    properties = COALESCE(so.properties, '{}'::jsonb)
      || jsonb_build_object(
        'demo', true,
        'bom_enabled', true,
        'legacy_product_name', so.product_name,
        'product_material_code', m.batch_no
      )
FROM order_map x
JOIN public.raw_materials m
  ON m.batch_no = x.material_code
WHERE so.order_no = x.order_no;

WITH demo_boms AS (
  SELECT *
  FROM (
    VALUES
      (
        'BOM-MAT-FG-003-V1',
        '香辣虾仁预制菜标准BOM',
        'MAT-FG-003',
        24::numeric,
        '盒',
        '预制菜二线',
        '{"demo": true, "yield_rate": 0.96, "line": "预制菜二线"}'::jsonb
      ),
      (
        'BOM-MAT-FG-004-V1',
        '黑椒龙利鱼柳预制菜标准BOM',
        'MAT-FG-004',
        20::numeric,
        '盒',
        '预制菜一线',
        '{"demo": true, "yield_rate": 0.97, "line": "预制菜一线"}'::jsonb
      ),
      (
        'BOM-MAT-FG-005-V1',
        '蒜蓉粉丝扇贝预制菜标准BOM',
        'MAT-FG-005',
        18::numeric,
        '盒',
        '预制菜三线',
        '{"demo": true, "yield_rate": 0.95, "line": "预制菜三线"}'::jsonb
      )
  ) AS x(bom_no, bom_name, parent_material_code, base_qty, unit, production_line, properties)
)
INSERT INTO scm.boms (
  bom_no,
  bom_name,
  parent_material_id,
  version,
  base_qty,
  unit,
  bom_type,
  status,
  effective_from,
  remark,
  properties,
  created_by
)
SELECT
  x.bom_no,
  x.bom_name,
  parent.id,
  'V1',
  x.base_qty,
  x.unit,
  '生产BOM',
  '启用',
  CURRENT_DATE - 30,
  '南派演示BOM，用于销售需求转生产建议、工单和领料跟进',
  x.properties,
  'nanpai-demo'
FROM demo_boms x
JOIN public.raw_materials parent
  ON parent.batch_no = x.parent_material_code
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
    updated_at = NOW();

WITH demo_items AS (
  SELECT *
  FROM (
    VALUES
      ('BOM-MAT-FG-003-V1', 10, 'MAT-RM-006', 8.00::numeric, '千克', 0.040000::numeric, '按需领料', '主料', '{"usage": "虾仁/贝类主料替代演示"}'::jsonb),
      ('BOM-MAT-FG-003-V1', 20, 'MAT-AUX-007', 1.20::numeric, '千克', 0.020000::numeric, '按需领料', '复合调味', '{"usage": "香辣风味"}'::jsonb),
      ('BOM-MAT-FG-003-V1', 30, 'MAT-AUX-005', 0.60::numeric, '千克', 0.010000::numeric, '按需领料', '蒜蓉调味', '{"usage": "底味"}'::jsonb),
      ('BOM-MAT-FG-003-V1', 40, 'MAT-PKG-004', 24.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage": "500g真空袋"}'::jsonb),
      ('BOM-MAT-FG-003-V1', 50, 'MAT-PKG-006', 1.00::numeric, '卷', 0.000000::numeric, '按需领料', '外包装', '{"usage": "封箱"}'::jsonb),

      ('BOM-MAT-FG-004-V1', 10, 'MAT-RM-004', 10.00::numeric, '千克', 0.030000::numeric, '按需领料', '主料', '{"usage": "龙利鱼柳"}'::jsonb),
      ('BOM-MAT-FG-004-V1', 20, 'MAT-AUX-008', 1.00::numeric, '千克', 0.010000::numeric, '按需领料', '黑椒调味', '{"usage": "黑椒调味"}'::jsonb),
      ('BOM-MAT-FG-004-V1', 30, 'MAT-AUX-005', 0.30::numeric, '千克', 0.010000::numeric, '按需领料', '蒜香底味', '{"usage": "底味"}'::jsonb),
      ('BOM-MAT-FG-004-V1', 40, 'MAT-PKG-004', 20.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage": "500g真空袋"}'::jsonb),
      ('BOM-MAT-FG-004-V1', 50, 'MAT-PKG-006', 1.00::numeric, '卷', 0.000000::numeric, '按需领料', '外包装', '{"usage": "封箱"}'::jsonb),

      ('BOM-MAT-FG-005-V1', 10, 'MAT-RM-005', 9.00::numeric, '千克', 0.040000::numeric, '按需领料', '主料', '{"usage": "扇贝肉"}'::jsonb),
      ('BOM-MAT-FG-005-V1', 20, 'MAT-AUX-005', 0.80::numeric, '千克', 0.020000::numeric, '按需领料', '蒜蓉调味', '{"usage": "蒜蓉风味"}'::jsonb),
      ('BOM-MAT-FG-005-V1', 30, 'MAT-AUX-006', 4.00::numeric, '千克', 0.020000::numeric, '按需领料', '粉丝', '{"usage": "粉丝配料"}'::jsonb),
      ('BOM-MAT-FG-005-V1', 40, 'MAT-PKG-004', 18.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage": "500g真空袋"}'::jsonb),
      ('BOM-MAT-FG-005-V1', 50, 'MAT-PKG-006', 1.00::numeric, '卷', 0.000000::numeric, '按需领料', '外包装', '{"usage": "封箱"}'::jsonb)
  ) AS x(bom_no, line_no, component_material_code, qty, unit, loss_rate, issue_method, remark, properties)
)
INSERT INTO scm.bom_items (
  bom_id,
  line_no,
  component_material_id,
  qty,
  unit,
  loss_rate,
  issue_method,
  remark,
  properties
)
SELECT
  b.id,
  x.line_no,
  component.id,
  x.qty,
  x.unit,
  x.loss_rate,
  x.issue_method,
  x.remark,
  x.properties
FROM demo_items x
JOIN scm.boms b
  ON b.bom_no = x.bom_no
JOIN public.raw_materials component
  ON component.batch_no = x.component_material_code
ON CONFLICT (bom_id, line_no) DO UPDATE
SET component_material_id = EXCLUDED.component_material_id,
    qty = EXCLUDED.qty,
    unit = EXCLUDED.unit,
    loss_rate = EXCLUDED.loss_rate,
    issue_method = EXCLUDED.issue_method,
    remark = EXCLUDED.remark,
    properties = EXCLUDED.properties,
    updated_at = NOW();

SELECT *
FROM scm.create_work_orders_from_sales_bom('nanpai-demo');

SELECT pg_notify('pgrst', 'reload schema');
