-- Patch: fix v_inventory_current status filter encoding
-- Apply after inventory_schema.sql is loaded.

DROP VIEW IF EXISTS scm.v_inventory_current;

CREATE OR REPLACE VIEW scm.v_inventory_current AS
SELECT 
    ib.id,
    ib.material_id,
    m.batch_no AS material_code,
    m.name AS material_name,
    m.category AS material_category,
    ib.batch_no,
    ib.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    ib.available_qty,
    ib.locked_qty,
    (ib.available_qty + ib.locked_qty) AS total_qty,
    ib.unit,
    ib.production_date,
    ib.expiry_date,
    ib.status,
    ib.properties,
    ib.updated_at AS last_transaction_at
FROM scm.inventory_batches ib
LEFT JOIN public.raw_materials m ON ib.material_id = m.id
LEFT JOIN scm.warehouses w ON ib.warehouse_id = w.id
;

COMMENT ON VIEW scm.v_inventory_current IS '实时库存查询视图';
