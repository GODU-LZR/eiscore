-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Jinwei-specific manufacturing domain.  The seed rows at the end are
-- explicitly marked as demo so they can be used to validate the control
-- tower without being mistaken for live orders, stock or quality releases.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS jinwei;

CREATE TABLE IF NOT EXISTS jinwei.specification_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_no TEXT NOT NULL UNIQUE,
  product_family TEXT NOT NULL,
  material TEXT NOT NULL DEFAULT '',
  construction TEXT NOT NULL DEFAULT '',
  yarn_spec TEXT NOT NULL DEFAULT '',
  mesh_size TEXT NOT NULL DEFAULT '',
  dimensions TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  finish TEXT NOT NULL DEFAULT '',
  weight_standard TEXT NOT NULL DEFAULT '',
  packing TEXT NOT NULL DEFAULT '',
  source_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (source_status IN ('observed', 'workbook', 'demo', 'pending')),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft', 'review', 'locked', 'superseded')),
  version_no INTEGER NOT NULL DEFAULT 1 CHECK (version_no > 0),
  source_ref TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jinwei.work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_code TEXT NOT NULL UNIQUE,
  center_name TEXT NOT NULL,
  route_order INTEGER NOT NULL DEFAULT 10,
  evidence_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (evidence_status IN ('observed', 'workbook', 'demo', 'pending')),
  capture_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jinwei.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT NOT NULL UNIQUE,
  specification_id UUID NOT NULL REFERENCES jinwei.specification_versions(id),
  customer_label TEXT NOT NULL DEFAULT '',
  planned_qty NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (planned_qty >= 0),
  unit TEXT NOT NULL DEFAULT '',
  delivery_batches INTEGER NOT NULL DEFAULT 1 CHECK (delivery_batches > 0),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'in_progress', 'quality_hold', 'released', 'closed')),
  source_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (source_status IN ('observed', 'workbook', 'demo', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jinwei.handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_no TEXT NOT NULL UNIQUE,
  production_order_id UUID NOT NULL REFERENCES jinwei.production_orders(id) ON DELETE CASCADE,
  from_center TEXT NOT NULL,
  to_center TEXT NOT NULL,
  item_code TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'waiting'
    CHECK (state IN ('ready', 'waiting', 'outsource', 'received', 'blocked')),
  contract_ref TEXT NOT NULL DEFAULT '',
  scanned_at TIMESTAMPTZ,
  operator_name TEXT NOT NULL DEFAULT '',
  source_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (source_status IN ('observed', 'workbook', 'demo', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jinwei.quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_no TEXT NOT NULL UNIQUE,
  production_order_id UUID NOT NULL REFERENCES jinwei.production_orders(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  lot_no TEXT NOT NULL DEFAULT '',
  standard_code TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending', 'pass', 'fail', 'conditional')),
  release_status TEXT NOT NULL DEFAULT 'hold'
    CHECK (release_status IN ('hold', 'released', 'rejected')),
  measured_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  inspector_name TEXT NOT NULL DEFAULT '',
  inspected_at TIMESTAMPTZ,
  source_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (source_status IN ('observed', 'workbook', 'demo', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jinwei.package_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code TEXT NOT NULL UNIQUE,
  production_order_id UUID NOT NULL REFERENCES jinwei.production_orders(id) ON DELETE CASCADE,
  quantity NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT '',
  net_weight NUMERIC(18, 4),
  label_version TEXT NOT NULL DEFAULT '',
  warehouse_location TEXT NOT NULL DEFAULT '',
  quality_release_status TEXT NOT NULL DEFAULT 'hold'
    CHECK (quality_release_status IN ('hold', 'released', 'rejected')),
  package_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (package_status IN ('draft', 'ready', 'in_stock', 'shipped')),
  source_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (source_status IN ('observed', 'workbook', 'demo', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION jinwei.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'specification_versions', 'work_centers', 'production_orders',
    'handoffs', 'quality_inspections', 'package_units'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON jinwei.%I', 'trg_' || table_name || '_updated_at', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON jinwei.%I FOR EACH ROW EXECUTE FUNCTION jinwei.touch_updated_at()', 'trg_' || table_name || '_updated_at', table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS jinwei_orders_status_idx
  ON jinwei.production_orders (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS jinwei_handoffs_state_idx
  ON jinwei.handoffs (state, updated_at DESC);
CREATE INDEX IF NOT EXISTS jinwei_quality_release_idx
  ON jinwei.quality_inspections (release_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS jinwei_packages_status_idx
  ON jinwei.package_units (package_status, quality_release_status, updated_at DESC);

CREATE OR REPLACE VIEW jinwei.v_control_tower AS
SELECT
  o.id,
  o.order_no,
  o.customer_label,
  o.planned_qty,
  o.unit,
  o.delivery_batches,
  o.due_date,
  o.status,
  o.source_status,
  s.spec_no,
  s.product_family,
  s.lifecycle_status AS specification_status,
  COUNT(DISTINCT h.id)::INTEGER AS handoff_count,
  COUNT(DISTINCT h.id) FILTER (WHERE h.state <> 'received')::INTEGER AS open_handoff_count,
  COUNT(DISTINCT q.id) FILTER (WHERE q.release_status = 'hold')::INTEGER AS quality_hold_count,
  COUNT(DISTINCT p.id)::INTEGER AS package_count,
  COUNT(DISTINCT p.id) FILTER (WHERE p.quality_release_status = 'released')::INTEGER AS released_package_count,
  CASE
    WHEN s.lifecycle_status <> 'locked' THEN '规格待锁定'
    WHEN COUNT(DISTINCT q.id) FILTER (WHERE q.release_status = 'hold') > 0 THEN '质量待放行'
    WHEN COUNT(DISTINCT h.id) FILTER (WHERE h.state <> 'received') > 0 THEN '交接待闭环'
    WHEN COUNT(DISTINCT p.id) = 0 THEN '待生成包装码'
    ELSE '可继续推进'
  END AS attention_state,
  GREATEST(o.updated_at, s.updated_at, COALESCE(MAX(h.updated_at), o.updated_at), COALESCE(MAX(q.updated_at), o.updated_at), COALESCE(MAX(p.updated_at), o.updated_at)) AS last_activity_at
FROM jinwei.production_orders o
JOIN jinwei.specification_versions s ON s.id = o.specification_id
LEFT JOIN jinwei.handoffs h ON h.production_order_id = o.id
LEFT JOIN jinwei.quality_inspections q ON q.production_order_id = o.id
LEFT JOIN jinwei.package_units p ON p.production_order_id = o.id
GROUP BY o.id, s.id;

GRANT USAGE ON SCHEMA jinwei TO web_user;
GRANT SELECT, INSERT, UPDATE ON
  jinwei.specification_versions,
  jinwei.work_centers,
  jinwei.production_orders,
  jinwei.handoffs,
  jinwei.quality_inspections,
  jinwei.package_units
TO web_user;
GRANT SELECT ON jinwei.v_control_tower TO web_user;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'specification_versions', 'work_centers', 'production_orders',
    'handoffs', 'quality_inspections', 'package_units'
  ] LOOP
    EXECUTE format('ALTER TABLE jinwei.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON jinwei.%I', table_name || '_web_user_select', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON jinwei.%I', table_name || '_web_user_write', table_name);
    EXECUTE format('CREATE POLICY %I ON jinwei.%I FOR SELECT TO web_user USING (true)', table_name || '_web_user_select', table_name);
    EXECUTE format('CREATE POLICY %I ON jinwei.%I FOR INSERT TO web_user WITH CHECK (true)', table_name || '_web_user_write', table_name);
    EXECUTE format('CREATE POLICY %I ON jinwei.%I FOR UPDATE TO web_user USING (true) WITH CHECK (true)', table_name || '_web_user_update', table_name);
  END LOOP;
END $$;

-- Seed only a clearly labelled snapshot for acceptance testing.  It is not
-- imported historical customer, stock or production data.
INSERT INTO jinwei.work_centers (center_code, center_name, route_order, evidence_status, capture_fields)
VALUES
  ('DRAWING', '拉丝 / 挤出', 10, 'observed', '["原料批次","机台","温度","产出 kg"]'::jsonb),
  ('WARPING', '络筒 / 整经', 20, 'observed', '["纱筒批次","根数","长度","盘头码"]'::jsonb),
  ('WEAVING', '有结 / 无结织造', 30, 'observed', '["合同","规格版本","机台","班次","产量"]'::jsonb),
  ('REPAIR', '补网 / 执头', 40, 'observed', '["缺陷类型","修补数量","人员","来源机台"]'::jsonb),
  ('SETTING', '电热 / 蒸汽定型', 50, 'workbook', '["批次","温度","时间","硬度"]'::jsonb),
  ('PACKING', '包装 / 入库', 60, 'observed', '["条/件","净重","包装码","唛头","库位"]'::jsonb)
ON CONFLICT (center_code) DO UPDATE SET
  center_name = EXCLUDED.center_name,
  route_order = EXCLUDED.route_order,
  evidence_status = EXCLUDED.evidence_status,
  capture_fields = EXCLUDED.capture_fields,
  updated_at = now();

WITH spec AS (
  INSERT INTO jinwei.specification_versions (
    spec_no, product_family, material, construction, yarn_spec, mesh_size,
    dimensions, color, finish, weight_standard, packing, source_status,
    lifecycle_status, version_no, source_ref, created_by
  ) VALUES (
    'JW-SPEC-DEMO-V1', 'knotless-net', '涤纶', '无结', 'PLY3', '3/8"',
    '400MD x 100YDS', '原白', '特硬（参数待确认）', '9.5 KG/PC（演示值）',
    '5 条/件；唇头待确认', 'demo', 'review', 1, 'jinwei-control-tower-demo', 'seed:jinwei'
  )
  ON CONFLICT (spec_no) DO UPDATE SET
    product_family = EXCLUDED.product_family,
    material = EXCLUDED.material,
    construction = EXCLUDED.construction,
    yarn_spec = EXCLUDED.yarn_spec,
    mesh_size = EXCLUDED.mesh_size,
    dimensions = EXCLUDED.dimensions,
    color = EXCLUDED.color,
    finish = EXCLUDED.finish,
    weight_standard = EXCLUDED.weight_standard,
    packing = EXCLUDED.packing,
    source_status = EXCLUDED.source_status,
    lifecycle_status = EXCLUDED.lifecycle_status,
    updated_at = now()
  RETURNING id
), order_row AS (
  INSERT INTO jinwei.production_orders (
    order_no, specification_id, customer_label, planned_qty, unit,
    delivery_batches, status, source_status
  )
  SELECT 'JW-DEMO-20260826-001', id, '演示客户（未写入正式客户档案）', 240, '条', 4, 'in_progress', 'demo'
  FROM spec
  ON CONFLICT (order_no) DO UPDATE SET
    specification_id = EXCLUDED.specification_id,
    customer_label = EXCLUDED.customer_label,
    planned_qty = EXCLUDED.planned_qty,
    unit = EXCLUDED.unit,
    delivery_batches = EXCLUDED.delivery_batches,
    status = EXCLUDED.status,
    source_status = EXCLUDED.source_status,
    updated_at = now()
  RETURNING id
)
INSERT INTO jinwei.handoffs (
  handoff_no, production_order_id, from_center, to_center, item_code,
  quantity, unit, state, contract_ref, source_status
)
SELECT 'JW-WIP-WARP-0008', id, '整经', '无结织造', '涤纶盘头', 8, '盘', 'ready', 'JW-DEMO-20260826-001', 'demo' FROM order_row
ON CONFLICT (handoff_no) DO UPDATE SET state = EXCLUDED.state, updated_at = now();

INSERT INTO jinwei.handoffs (
  handoff_no, production_order_id, from_center, to_center, item_code,
  quantity, unit, state, contract_ref, source_status
)
SELECT 'JW-WIP-NET-0016', id, '织网', '补网', '无结网片', 80, '条', 'waiting', 'JW-DEMO-20260826-001', 'demo' FROM jinwei.production_orders WHERE order_no = 'JW-DEMO-20260826-001'
ON CONFLICT (handoff_no) DO UPDATE SET state = EXCLUDED.state, updated_at = now();

INSERT INTO jinwei.handoffs (
  handoff_no, production_order_id, from_center, to_center, item_code,
  quantity, unit, state, contract_ref, source_status
)
SELECT 'JW-OUT-DYE-0003', id, '补网', '委外染色', '待染网片', 40, '条', 'outsource', 'JW-DEMO-20260826-001', 'demo' FROM jinwei.production_orders WHERE order_no = 'JW-DEMO-20260826-001'
ON CONFLICT (handoff_no) DO UPDATE SET state = EXCLUDED.state, updated_at = now();

INSERT INTO jinwei.quality_inspections (
  inspection_no, production_order_id, stage, lot_no, standard_code,
  result, release_status, measured_values, source_status
)
SELECT 'JW-QC-DEMO-0001', id, '过程检', 'JW-WIP-NET-0016', 'GB/T 6964-2010', 'pending', 'hold', '{"meshSize":"待录入","breakStrength":"待录入"}'::jsonb, 'demo'
FROM jinwei.production_orders WHERE order_no = 'JW-DEMO-20260826-001'
ON CONFLICT (inspection_no) DO UPDATE SET result = EXCLUDED.result, release_status = EXCLUDED.release_status, updated_at = now();

INSERT INTO jinwei.package_units (
  package_code, production_order_id, quantity, unit, label_version,
  quality_release_status, package_status, source_status
)
SELECT '待生成', id, 0, '条', '待确认', 'hold', 'draft', 'pending'
FROM jinwei.production_orders WHERE order_no = 'JW-DEMO-20260826-001'
ON CONFLICT (package_code) DO NOTHING;

COMMENT ON SCHEMA jinwei IS 'Jinwei netting manufacturing specifications, handoffs, quality and package traceability';
