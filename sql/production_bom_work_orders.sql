-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Production work orders generated from sales BOM demand.
-- Execute:
--   cat sql/production_bom_work_orders.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.production_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_no TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'sales_bom_mrp',
  source_order_nos TEXT,
  product_material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
  product_material_code TEXT NOT NULL,
  product_material_name TEXT NOT NULL,
  bom_id UUID REFERENCES scm.boms(id) ON DELETE SET NULL,
  bom_no TEXT,
  bom_version TEXT NOT NULL DEFAULT 'V1',
  planned_qty NUMERIC(18, 6) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '盒',
  planned_start_date DATE,
  planned_finish_date DATE,
  work_order_status TEXT NOT NULL DEFAULT '待排产',
  priority TEXT NOT NULL DEFAULT '普通',
  remark TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT production_work_orders_qty_check CHECK (planned_qty >= 0),
  CONSTRAINT production_work_orders_status_check CHECK (work_order_status IN ('待排产', '已排产', '生产中', '已完工', '已取消')),
  CONSTRAINT production_work_orders_priority_check CHECK (priority IN ('低', '普通', '高', '紧急'))
);

CREATE INDEX IF NOT EXISTS idx_production_work_orders_product
  ON scm.production_work_orders(product_material_id);
CREATE INDEX IF NOT EXISTS idx_production_work_orders_status
  ON scm.production_work_orders(work_order_status);

CREATE TABLE IF NOT EXISTS scm.production_work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES scm.production_work_orders(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 10,
  component_material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
  component_material_code TEXT NOT NULL,
  component_material_name TEXT NOT NULL,
  required_qty NUMERIC(18, 6) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  issued_qty NUMERIC(18, 6) NOT NULL DEFAULT 0,
  shortage_qty NUMERIC(18, 6) NOT NULL DEFAULT 0,
  issue_status TEXT NOT NULL DEFAULT '未领料',
  remark TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT production_work_order_items_required_qty_check CHECK (required_qty >= 0),
  CONSTRAINT production_work_order_items_issued_qty_check CHECK (issued_qty >= 0),
  CONSTRAINT production_work_order_items_shortage_qty_check CHECK (shortage_qty >= 0),
  CONSTRAINT production_work_order_items_issue_status_check CHECK (issue_status IN ('未领料', '部分领料', '已齐套'))
);

CREATE INDEX IF NOT EXISTS idx_production_work_order_items_order
  ON scm.production_work_order_items(work_order_id, line_no);
CREATE INDEX IF NOT EXISTS idx_production_work_order_items_component
  ON scm.production_work_order_items(component_material_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_production_work_order_items_order_line
  ON scm.production_work_order_items(work_order_id, line_no);

DROP TRIGGER IF EXISTS trg_production_work_orders_touch_updated_at ON scm.production_work_orders;
CREATE TRIGGER trg_production_work_orders_touch_updated_at
BEFORE UPDATE ON scm.production_work_orders
FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_production_work_order_items_touch_updated_at ON scm.production_work_order_items;
CREATE TRIGGER trg_production_work_order_items_touch_updated_at
BEFORE UPDATE ON scm.production_work_order_items
FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();

CREATE OR REPLACE VIEW scm.v_sales_bom_production_plan AS
WITH demand AS (
  SELECT
    p.product_material_id,
    p.product_material_code,
    p.product_material_name,
    MAX(p.sales_unit) AS unit,
    SUM(p.sales_qty)::NUMERIC(18, 6) AS sales_qty,
    MAX(p.finished_available_qty)::NUMERIC(18, 6) AS finished_available_qty,
    GREATEST(SUM(p.sales_qty) - MAX(p.finished_available_qty), 0)::NUMERIC(18, 6) AS planned_qty,
    MIN(p.delivery_date) AS earliest_delivery_date,
    STRING_AGG(p.order_no, ', ' ORDER BY p.order_no) AS source_order_nos
  FROM scm.v_sales_bom_order_plan p
  WHERE p.mrp_included
  GROUP BY p.product_material_id, p.product_material_code, p.product_material_name
)
SELECT
  ROW_NUMBER() OVER (ORDER BY d.product_material_code)::INTEGER AS row_no,
  d.product_material_id,
  d.product_material_code,
  d.product_material_name,
  d.sales_qty,
  d.finished_available_qty,
  d.planned_qty,
  d.unit,
  d.earliest_delivery_date,
  d.source_order_nos,
  b.id AS bom_id,
  b.bom_no,
  b.version AS bom_version,
  COALESCE(wo.work_order_count, 0)::INTEGER AS work_order_count,
  COALESCE(wo.open_work_order_count, 0)::INTEGER AS open_work_order_count,
  CASE
    WHEN d.planned_qty <= 0 THEN '成品库存满足'
    WHEN COALESCE(wo.open_work_order_count, 0) > 0 THEN '已有工单'
    ELSE '待生成工单'
  END AS plan_status
FROM demand d
JOIN scm.boms b
  ON b.parent_material_id = d.product_material_id
 AND b.status = '启用'
 AND b.version = 'V1'
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS work_order_count,
    COUNT(*) FILTER (WHERE work_order_status NOT IN ('已完工', '已取消')) AS open_work_order_count
  FROM scm.production_work_orders existing
  WHERE existing.product_material_id = d.product_material_id
    AND existing.source_type = 'sales_bom_mrp'
) wo ON true;

CREATE OR REPLACE VIEW scm.v_production_work_orders AS
SELECT
  wo.*,
  COALESCE(item_stats.item_count, 0)::INTEGER AS item_count,
  COALESCE(item_stats.shortage_item_count, 0)::INTEGER AS shortage_item_count,
  COALESCE(item_stats.total_required_qty, 0)::NUMERIC(18, 6) AS total_required_qty
FROM scm.production_work_orders wo
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS item_count,
    COUNT(*) FILTER (WHERE shortage_qty > 0) AS shortage_item_count,
    SUM(required_qty) AS total_required_qty
  FROM scm.production_work_order_items i
  WHERE i.work_order_id = wo.id
) item_stats ON true;

CREATE OR REPLACE VIEW scm.v_production_work_order_items AS
SELECT
  i.*,
  wo.work_order_no,
  wo.product_material_id,
  wo.product_material_code,
  wo.product_material_name,
  wo.planned_qty,
  wo.work_order_status
FROM scm.production_work_order_items i
JOIN scm.production_work_orders wo
  ON wo.id = i.work_order_id;

DROP FUNCTION IF EXISTS scm.create_work_orders_from_sales_bom(TEXT);

CREATE OR REPLACE FUNCTION scm.create_work_orders_from_sales_bom(
  p_created_by TEXT DEFAULT 'BOM-MRP'
)
RETURNS TABLE (
  result_work_order_no TEXT,
  result_product_material_code TEXT,
  result_product_material_name TEXT,
  result_planned_qty NUMERIC,
  result_unit TEXT,
  result_work_order_status TEXT,
  result_item_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = scm, public
AS $$
DECLARE
  v_plan RECORD;
  v_order scm.production_work_orders%ROWTYPE;
  v_item_count INTEGER;
BEGIN
  FOR v_plan IN
    SELECT *
    FROM scm.v_sales_bom_production_plan p
    WHERE p.planned_qty > 0
    ORDER BY p.product_material_code
  LOOP
    INSERT INTO scm.production_work_orders (
      work_order_no,
      source_type,
      source_order_nos,
      product_material_id,
      product_material_code,
      product_material_name,
      bom_id,
      bom_no,
      bom_version,
      planned_qty,
      unit,
      planned_start_date,
      planned_finish_date,
      work_order_status,
      priority,
      remark,
      properties,
      created_by
    )
    VALUES (
      CONCAT('WO-BOM-', TO_CHAR(CURRENT_DATE, 'YYYYMMDD'), '-', v_plan.product_material_code),
      'sales_bom_mrp',
      v_plan.source_order_nos,
      v_plan.product_material_id,
      v_plan.product_material_code,
      v_plan.product_material_name,
      v_plan.bom_id,
      v_plan.bom_no,
      v_plan.bom_version,
      v_plan.planned_qty,
      v_plan.unit,
      CURRENT_DATE,
      COALESCE(v_plan.earliest_delivery_date, CURRENT_DATE + 7),
      '待排产',
      CASE WHEN v_plan.earliest_delivery_date IS NOT NULL AND v_plan.earliest_delivery_date <= CURRENT_DATE + 3 THEN '高' ELSE '普通' END,
      CONCAT('由销售订单BOM需求生成；订单：', v_plan.source_order_nos),
      jsonb_build_object(
        'source', 'sales_bom_mrp',
        'source_order_nos', v_plan.source_order_nos,
        'sales_qty', v_plan.sales_qty,
        'finished_available_qty', v_plan.finished_available_qty
      ),
      COALESCE(NULLIF(p_created_by, ''), 'BOM-MRP')
    )
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
        planned_finish_date = EXCLUDED.planned_finish_date,
        priority = EXCLUDED.priority,
        remark = EXCLUDED.remark,
        properties = COALESCE(scm.production_work_orders.properties, '{}'::jsonb) || EXCLUDED.properties,
        updated_at = NOW()
    RETURNING * INTO v_order;

    DELETE FROM scm.production_work_order_items i
    WHERE i.work_order_id = v_order.id;

    INSERT INTO scm.production_work_order_items (
      work_order_id,
      line_no,
      component_material_id,
      component_material_code,
      component_material_name,
      required_qty,
      unit,
      issued_qty,
      shortage_qty,
      issue_status,
      remark,
      properties
    )
    SELECT
      v_order.id,
      ROW_NUMBER() OVER (ORDER BY e.component_material_code)::INTEGER * 10,
      e.component_material_id,
      e.component_material_code,
      e.component_material_name,
      e.required_qty,
      e.unit,
      0,
      GREATEST(e.required_qty - COALESCE(inv.available_qty, 0), 0)::NUMERIC(18, 6),
      CASE
        WHEN GREATEST(e.required_qty - COALESCE(inv.available_qty, 0), 0) > 0 THEN '部分领料'
        ELSE '已齐套'
      END,
      CASE
        WHEN GREATEST(e.required_qty - COALESCE(inv.available_qty, 0), 0) > 0 THEN '库存不足，需采购或补料'
        ELSE '库存满足'
      END,
      jsonb_build_object('available_qty', COALESCE(inv.available_qty, 0), 'source', 'bom_explosion')
    FROM scm.explode_bom(v_order.product_material_id, v_order.planned_qty, v_order.bom_version) e
    LEFT JOIN LATERAL (
      SELECT SUM(available_qty)::NUMERIC(18, 6) AS available_qty
      FROM scm.v_inventory_current current_inv
      WHERE current_inv.material_id = e.component_material_id
    ) inv ON true;

    SELECT COUNT(*)
    INTO v_item_count
    FROM scm.production_work_order_items i
    WHERE i.work_order_id = v_order.id;

    result_work_order_no := v_order.work_order_no;
    result_product_material_code := v_order.product_material_code;
    result_product_material_name := v_order.product_material_name;
    result_planned_qty := v_order.planned_qty;
    result_unit := v_order.unit;
    result_work_order_status := v_order.work_order_status;
    result_item_count := COALESCE(v_item_count, 0);
    RETURN NEXT;
  END LOOP;
END;
$$;

ALTER TABLE scm.production_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.production_work_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_work_orders_select ON scm.production_work_orders;
DROP POLICY IF EXISTS production_work_orders_insert ON scm.production_work_orders;
DROP POLICY IF EXISTS production_work_orders_update ON scm.production_work_orders;
DROP POLICY IF EXISTS production_work_orders_delete ON scm.production_work_orders;
CREATE POLICY production_work_orders_select ON scm.production_work_orders FOR SELECT TO web_user USING (true);
CREATE POLICY production_work_orders_insert ON scm.production_work_orders FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY production_work_orders_update ON scm.production_work_orders FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY production_work_orders_delete ON scm.production_work_orders FOR DELETE TO web_user USING (true);

DROP POLICY IF EXISTS production_work_order_items_select ON scm.production_work_order_items;
DROP POLICY IF EXISTS production_work_order_items_insert ON scm.production_work_order_items;
DROP POLICY IF EXISTS production_work_order_items_update ON scm.production_work_order_items;
DROP POLICY IF EXISTS production_work_order_items_delete ON scm.production_work_order_items;
CREATE POLICY production_work_order_items_select ON scm.production_work_order_items FOR SELECT TO web_user USING (true);
CREATE POLICY production_work_order_items_insert ON scm.production_work_order_items FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY production_work_order_items_update ON scm.production_work_order_items FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY production_work_order_items_delete ON scm.production_work_order_items FOR DELETE TO web_user USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON scm.production_work_orders TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON scm.production_work_order_items TO web_user;
GRANT SELECT ON scm.v_sales_bom_production_plan TO web_user;
GRANT SELECT ON scm.v_production_work_orders TO web_user;
GRANT SELECT ON scm.v_production_work_order_items TO web_user;
GRANT SELECT ON scm.v_sales_bom_production_plan TO web_anon;
GRANT SELECT ON scm.v_production_work_orders TO web_anon;
GRANT SELECT ON scm.v_production_work_order_items TO web_anon;
GRANT EXECUTE ON FUNCTION scm.create_work_orders_from_sales_bom(TEXT) TO web_user;

INSERT INTO public.permissions (code, name, module, action)
VALUES
  ('app:production_plan', '生产计划', 'production', 'app'),
  ('app:production_work_order', '生产工单', 'production', 'app'),
  ('op:production_work_order.create', '生产工单-生成', 'production_work_order', 'create'),
  ('op:production_work_order.edit', '生产工单-编辑', 'production_work_order', 'edit'),
  ('op:production_work_order.export', '生产工单-导出', 'production_work_order', 'export')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    module = EXCLUDED.module,
    action = EXCLUDED.action,
    updated_at = NOW();

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin', 'dept_manager')
  AND (
    p.code IN ('module:production', 'app:production_plan', 'app:production_work_order')
    OR p.code LIKE 'op:production\_work\_order.%' ESCAPE '\'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.ontology_table_semantics (
  table_schema,
  table_name,
  semantic_domain,
  semantic_class,
  semantic_name,
  semantic_description,
  is_business,
  tags
)
VALUES
  ('scm', 'production_work_orders', 'production', 'work_order', '生产工单', '由销售BOM需求生成的生产工单主表', true, '["production","bom","work_order"]'::jsonb),
  ('scm', 'production_work_order_items', 'production', 'work_order_item', '生产工单用料', '生产工单BOM用料清单与齐套缺料状态', true, '["production","bom","material"]'::jsonb),
  ('scm', 'v_sales_bom_production_plan', 'production', 'production_plan', '销售BOM生产计划', '销售需求结合成品库存后的生产建议', true, '["production","sales","bom","mrp"]'::jsonb)
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = true,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

COMMENT ON TABLE scm.production_work_orders IS '生产工单：承接销售BOM需求，记录成品生产数量、状态和来源订单';
COMMENT ON TABLE scm.production_work_order_items IS '生产工单用料：由BOM展开生成，记录需求、缺料和领料状态';
COMMENT ON VIEW scm.v_sales_bom_production_plan IS '销售BOM生产计划：销售需求减成品库存后的生产建议';
COMMENT ON FUNCTION scm.create_work_orders_from_sales_bom(TEXT) IS '根据销售BOM生产计划生成或更新生产工单及工单用料';

SELECT pg_notify('pgrst', 'reload schema');
