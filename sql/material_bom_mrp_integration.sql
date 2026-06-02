-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- BOM integration with sales demand, inventory availability and purchase demand.
-- Execute:
--   cat sql/material_bom_mrp_integration.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

CREATE SCHEMA IF NOT EXISTS scm;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS product_material_id INTEGER REFERENCES public.raw_materials(id);

CREATE INDEX IF NOT EXISTS idx_sales_orders_product_material_id
  ON public.sales_orders(product_material_id);

UPDATE public.sales_orders so
SET product_material_id = m.id,
    product_name = m.name,
    unit = COALESCE(m.properties->>'unit', so.unit, '盒'),
    properties = COALESCE(so.properties, '{}'::jsonb)
      || jsonb_build_object(
        'bom_enabled', true,
        'legacy_product_name', so.product_name,
        'product_material_code', m.batch_no
      )
FROM (
  VALUES
    ('SO-202605-001', 'MAT-FG-001'),
    ('SO-202605-002', 'MAT-FG-002'),
    ('SO-202605-003', 'MAT-FG-001'),
    ('SO-202605-004', 'MAT-FG-001'),
    ('SO-202605-005', 'MAT-FG-002'),
    ('SO-202605-006', 'MAT-FG-001'),
    ('SO-202605-007', 'MAT-FG-002'),
    ('SO-202605-008', 'MAT-FG-001')
) AS x(order_no, material_code)
JOIN public.raw_materials m
  ON m.batch_no = x.material_code
WHERE so.order_no = x.order_no;

CREATE OR REPLACE VIEW scm.v_sales_bom_order_plan AS
WITH finished_inventory AS (
  SELECT
    material_id,
    SUM(available_qty)::NUMERIC(18, 6) AS available_qty,
    SUM(total_qty)::NUMERIC(18, 6) AS total_qty
  FROM scm.v_inventory_current
  GROUP BY material_id
)
SELECT
  so.id AS sales_order_id,
  so.order_no,
  so.customer_name,
  so.product_material_id,
  m.batch_no AS product_material_code,
  COALESCE(m.name, so.product_name) AS product_material_name,
  so.product_name AS sales_product_name,
  so.quantity::NUMERIC(18, 6) AS sales_qty,
  so.unit AS sales_unit,
  so.order_status,
  so.delivery_date,
  COALESCE(inv.available_qty, 0)::NUMERIC(18, 6) AS finished_available_qty,
  b.id AS bom_id,
  b.bom_no,
  b.version AS bom_version,
  b.status AS bom_status,
  CASE
    WHEN so.status = 'active'
     AND so.order_status IN ('已确认', '生产中')
     AND so.product_material_id IS NOT NULL
     AND b.id IS NOT NULL
    THEN true
    ELSE false
  END AS mrp_included,
  so.properties,
  so.created_at,
  so.updated_at
FROM public.sales_orders so
LEFT JOIN public.raw_materials m
  ON m.id = so.product_material_id
LEFT JOIN finished_inventory inv
  ON inv.material_id = so.product_material_id
LEFT JOIN scm.boms b
  ON b.parent_material_id = so.product_material_id
 AND b.status = '启用'
 AND b.version = COALESCE(so.properties->>'bom_version', 'V1')
WHERE COALESCE(so.status, 'active') <> 'deleted';

CREATE OR REPLACE VIEW scm.v_sales_bom_mrp AS
WITH sales_demand AS (
  SELECT
    p.product_material_id,
    p.product_material_code,
    p.product_material_name,
    MAX(p.sales_unit) AS sales_unit,
    SUM(p.sales_qty)::NUMERIC(18, 6) AS sales_qty,
    MIN(p.delivery_date) AS earliest_delivery_date,
    STRING_AGG(p.order_no, ', ' ORDER BY p.order_no) AS source_order_nos
  FROM scm.v_sales_bom_order_plan p
  WHERE p.mrp_included
  GROUP BY p.product_material_id, p.product_material_code, p.product_material_name
),
finished_inventory AS (
  SELECT
    material_id,
    SUM(available_qty)::NUMERIC(18, 6) AS available_qty,
    SUM(total_qty)::NUMERIC(18, 6) AS total_qty
  FROM scm.v_inventory_current
  GROUP BY material_id
),
component_inventory AS (
  SELECT
    material_id,
    SUM(available_qty)::NUMERIC(18, 6) AS available_qty,
    SUM(total_qty)::NUMERIC(18, 6) AS total_qty
  FROM scm.v_inventory_current
  GROUP BY material_id
),
product_plan AS (
  SELECT
    d.product_material_id,
    d.product_material_code,
    d.product_material_name,
    d.sales_unit,
    d.sales_qty,
    COALESCE(fi.available_qty, 0)::NUMERIC(18, 6) AS finished_available_qty,
    GREATEST(d.sales_qty - COALESCE(fi.available_qty, 0), 0)::NUMERIC(18, 6) AS production_qty,
    d.earliest_delivery_date,
    d.source_order_nos,
    b.id AS bom_id,
    b.bom_no,
    b.version AS bom_version
  FROM sales_demand d
  JOIN scm.boms b
    ON b.parent_material_id = d.product_material_id
   AND b.status = '启用'
   AND b.version = 'V1'
  LEFT JOIN finished_inventory fi
    ON fi.material_id = d.product_material_id
)
SELECT
  ROW_NUMBER() OVER (ORDER BY p.product_material_code, e.component_material_code)::INTEGER AS row_no,
  p.product_material_id,
  p.product_material_code,
  p.product_material_name,
  p.sales_qty,
  p.sales_unit,
  p.finished_available_qty,
  p.production_qty,
  p.earliest_delivery_date,
  p.source_order_nos,
  p.bom_id,
  p.bom_no,
  p.bom_version,
  e.component_material_id,
  e.component_material_code,
  e.component_material_name,
  cm.category AS component_material_category,
  e.unit,
  e.required_qty::NUMERIC(18, 6) AS required_qty,
  COALESCE(ci.available_qty, 0)::NUMERIC(18, 6) AS available_qty,
  COALESCE(ci.total_qty, 0)::NUMERIC(18, 6) AS total_qty,
  GREATEST(e.required_qty - COALESCE(ci.available_qty, 0), 0)::NUMERIC(18, 6) AS shortage_qty,
  CASE
    WHEN p.production_qty <= 0 THEN '成品库存满足'
    WHEN GREATEST(e.required_qty - COALESCE(ci.available_qty, 0), 0) > 0 THEN '需采购'
    ELSE '库存满足'
  END AS mrp_status,
  NULLIF(cm.properties->>'supplier', '') AS preferred_supplier
FROM product_plan p
JOIN LATERAL scm.explode_bom(p.product_material_id, p.production_qty, p.bom_version) e
  ON p.production_qty > 0
JOIN public.raw_materials cm
  ON cm.id = e.component_material_id
LEFT JOIN component_inventory ci
  ON ci.material_id = e.component_material_id
ORDER BY p.product_material_code, e.component_material_code;

DROP FUNCTION IF EXISTS scm.create_purchase_demands_from_sales_bom(INTEGER, DATE, TEXT);

CREATE OR REPLACE FUNCTION scm.create_purchase_demands_from_sales_bom(
  p_product_material_id INTEGER DEFAULT NULL,
  p_required_date DATE DEFAULT NULL,
  p_requester_name TEXT DEFAULT 'BOM-MRP'
)
RETURNS TABLE (
  result_demand_no TEXT,
  result_material_no TEXT,
  result_material_name TEXT,
  result_quantity NUMERIC,
  result_unit TEXT,
  result_demand_status TEXT,
  result_source_dept TEXT,
  result_remark TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = scm, public
AS $$
BEGIN
  RETURN QUERY
  WITH shortages AS (
    SELECT
      r.component_material_id,
      r.component_material_code,
      r.component_material_name,
      MAX(r.unit) AS unit,
      SUM(r.shortage_qty)::NUMERIC(14, 2) AS shortage_qty,
      MIN(r.earliest_delivery_date) AS earliest_delivery_date,
      STRING_AGG(DISTINCT r.product_material_code, ', ' ORDER BY r.product_material_code) AS product_codes,
      STRING_AGG(DISTINCT r.source_order_nos, '; ' ORDER BY r.source_order_nos) AS source_order_nos,
      MAX(r.preferred_supplier) AS preferred_supplier
    FROM scm.v_sales_bom_mrp r
    WHERE r.shortage_qty > 0
      AND (p_product_material_id IS NULL OR r.product_material_id = p_product_material_id)
    GROUP BY r.component_material_id, r.component_material_code, r.component_material_name
  ),
  upserted AS (
    INSERT INTO public.purchase_demands (
      demand_no,
      material_no,
      material_name,
      quantity,
      unit,
      required_date,
      source_dept,
      requester_name,
      preferred_supplier,
      demand_status,
      remark,
      properties
    )
    SELECT
      CONCAT(
        'PR-BOM-',
        TO_CHAR(CURRENT_DATE, 'YYYYMMDD'),
        '-',
        REGEXP_REPLACE(s.component_material_code, '[^A-Za-z0-9]', '', 'g')
      ) AS demand_no,
      s.component_material_code,
      s.component_material_name,
      s.shortage_qty,
      s.unit,
      COALESCE(p_required_date, s.earliest_delivery_date, CURRENT_DATE + 7),
      'PMC',
      COALESCE(NULLIF(p_requester_name, ''), 'BOM-MRP'),
      s.preferred_supplier,
      '待采购',
      CONCAT('由销售订单BOM缺料自动生成；成品：', s.product_codes, '；订单：', s.source_order_nos),
      jsonb_build_object(
        'source', 'sales_bom_mrp',
        'component_material_id', s.component_material_id,
        'source_product_codes', s.product_codes,
        'source_order_nos', s.source_order_nos
      )
    FROM shortages s
    ON CONFLICT ON CONSTRAINT purchase_demands_demand_no_key DO UPDATE
    SET material_no = EXCLUDED.material_no,
        material_name = EXCLUDED.material_name,
        quantity = EXCLUDED.quantity,
        unit = EXCLUDED.unit,
        required_date = EXCLUDED.required_date,
        source_dept = EXCLUDED.source_dept,
        requester_name = EXCLUDED.requester_name,
        preferred_supplier = EXCLUDED.preferred_supplier,
        demand_status = CASE
          WHEN public.purchase_demands.demand_status IN ('已下单', '已关闭') THEN public.purchase_demands.demand_status
          ELSE EXCLUDED.demand_status
        END,
        remark = EXCLUDED.remark,
        properties = COALESCE(public.purchase_demands.properties, '{}'::jsonb) || EXCLUDED.properties,
        updated_at = NOW()
    RETURNING
      public.purchase_demands.demand_no,
      public.purchase_demands.material_no,
      public.purchase_demands.material_name,
      public.purchase_demands.quantity,
      public.purchase_demands.unit,
      public.purchase_demands.demand_status,
      public.purchase_demands.source_dept,
      public.purchase_demands.remark
  )
  SELECT * FROM upserted
  ORDER BY material_no;
END;
$$;

COMMENT ON VIEW scm.v_sales_bom_order_plan IS '销售订单到成品BOM的需求映射，标记可参与MRP的订单';
COMMENT ON VIEW scm.v_sales_bom_mrp IS '销售需求结合成品库存、BOM展开和子件库存后的缺料分析';
COMMENT ON FUNCTION scm.create_purchase_demands_from_sales_bom(INTEGER, DATE, TEXT) IS '根据销售BOM缺料分析生成或更新采购需求';

GRANT SELECT ON scm.v_sales_bom_order_plan TO web_user;
GRANT SELECT ON scm.v_sales_bom_mrp TO web_user;
GRANT SELECT ON scm.v_sales_bom_order_plan TO web_anon;
GRANT SELECT ON scm.v_sales_bom_mrp TO web_anon;
GRANT EXECUTE ON FUNCTION scm.create_purchase_demands_from_sales_bom(INTEGER, DATE, TEXT) TO web_user;

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
  ('scm', 'v_sales_bom_order_plan', 'mms', 'sales_bom_order_plan', '销售BOM需求映射', '销售订单与成品BOM、成品库存的映射视图', true, '["mms","bom","sales","mrp"]'::jsonb),
  ('scm', 'v_sales_bom_mrp', 'mms', 'sales_bom_mrp', '销售BOM缺料分析', '销售需求结合BOM展开和库存后的缺料分析视图', true, '["mms","bom","sales","inventory","purchase","mrp"]'::jsonb)
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = true,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

SELECT pg_notify('pgrst', 'reload schema');
