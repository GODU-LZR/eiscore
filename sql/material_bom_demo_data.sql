-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Demo BOM data for the current materials master data.
-- Execute:
--   cat sql/material_bom_demo_data.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

WITH demo_boms AS (
    SELECT *
    FROM (
        VALUES
            (
                'BOM-MAT-FG-001-V1',
                '香煎金鲳鱼半成品标准BOM',
                'MAT-FG-001',
                'V1',
                20::numeric,
                '盒',
                '生产BOM',
                '启用',
                '演示BOM：20盒/箱，用于生产领料、采购需求和成本测算',
                '{"demo": true, "production_line": "预制菜一线", "yield_rate": 0.97}'::jsonb
            ),
            (
                'BOM-MAT-FG-002-V1',
                '蒜蓉粉丝虾半成品标准BOM',
                'MAT-FG-002',
                'V1',
                24::numeric,
                '盒',
                '生产BOM',
                '启用',
                '演示BOM：24盒/箱，用于生产领料、采购需求和成本测算',
                '{"demo": true, "production_line": "预制菜二线", "yield_rate": 0.96}'::jsonb
            )
    ) AS x(
        bom_no,
        bom_name,
        parent_material_code,
        version,
        base_qty,
        unit,
        bom_type,
        status,
        remark,
        properties
    )
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
    x.version,
    x.base_qty,
    x.unit,
    x.bom_type,
    x.status,
    CURRENT_DATE,
    x.remark,
    x.properties,
    'system'
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
    properties = EXCLUDED.properties;

WITH demo_items AS (
    SELECT *
    FROM (
        VALUES
            ('BOM-MAT-FG-001-V1', 10, 'MAT-RM-001', 10.00::numeric, '千克', 0.030000::numeric, '按需领料', '主料', '{"usage": "金鲳鱼主料"}'::jsonb),
            ('BOM-MAT-FG-001-V1', 20, 'MAT-AUX-001', 0.35::numeric, '千克', 0.010000::numeric, '按需领料', '基础调味', '{"usage": "盐渍调味"}'::jsonb),
            ('BOM-MAT-FG-001-V1', 30, 'MAT-AUX-003', 0.60::numeric, '升', 0.010000::numeric, '按需领料', '煎制用油', '{"usage": "煎制"}'::jsonb),
            ('BOM-MAT-FG-001-V1', 40, 'MAT-AUX-004', 0.80::numeric, '千克', 0.010000::numeric, '按需领料', '复合调味', '{"usage": "腌制调味"}'::jsonb),
            ('BOM-MAT-FG-001-V1', 50, 'MAT-PKG-002', 20.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage": "500g彩盒"}'::jsonb),
            ('BOM-MAT-FG-001-V1', 60, 'MAT-PKG-003', 2.00::numeric, '个', 0.000000::numeric, '按需领料', '外包装', '{"usage": "外箱"}'::jsonb),

            ('BOM-MAT-FG-002-V1', 10, 'MAT-RM-002', 6.00::numeric, '千克', 0.040000::numeric, '按需领料', '主料', '{"usage": "南美白对虾主料"}'::jsonb),
            ('BOM-MAT-FG-002-V1', 20, 'MAT-AUX-001', 0.20::numeric, '千克', 0.010000::numeric, '按需领料', '基础调味', '{"usage": "盐渍调味"}'::jsonb),
            ('BOM-MAT-FG-002-V1', 30, 'MAT-AUX-002', 0.12::numeric, '千克', 0.010000::numeric, '按需领料', '基础调味', '{"usage": "提鲜平衡"}'::jsonb),
            ('BOM-MAT-FG-002-V1', 40, 'MAT-AUX-003', 0.80::numeric, '升', 0.010000::numeric, '按需领料', '调味用油', '{"usage": "蒜蓉调味油"}'::jsonb),
            ('BOM-MAT-FG-002-V1', 50, 'MAT-AUX-004', 0.60::numeric, '千克', 0.010000::numeric, '按需领料', '复合调味', '{"usage": "蒜蓉风味调味"}'::jsonb),
            ('BOM-MAT-FG-002-V1', 60, 'MAT-PKG-001', 24.00::numeric, '个', 0.020000::numeric, '按需领料', '内包装', '{"usage": "250g真空袋"}'::jsonb),
            ('BOM-MAT-FG-002-V1', 70, 'MAT-PKG-003', 2.00::numeric, '个', 0.000000::numeric, '按需领料', '外包装', '{"usage": "外箱"}'::jsonb)
    ) AS x(
        bom_no,
        line_no,
        component_material_code,
        qty,
        unit,
        loss_rate,
        issue_method,
        remark,
        properties
    )
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
    properties = EXCLUDED.properties;

SELECT pg_notify('pgrst', 'reload schema');
