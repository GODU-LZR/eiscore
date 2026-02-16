-- Patch: add inventory transactions view with material/warehouse info.
-- Apply after inventory_schema.sql is loaded.

CREATE OR REPLACE VIEW scm.v_inventory_transactions AS
SELECT
    it.id,
    it.transaction_no,
    it.transaction_type,
    it.material_id,
    m.batch_no AS material_code,
    m.name AS material_name,
    m.category AS material_category,
    it.batch_no,
    it.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    it.quantity,
    it.unit,
    it.before_qty,
    it.after_qty,
    it.operator,
    it.transaction_date,
    it.remark,
    it.properties
FROM scm.inventory_transactions it
LEFT JOIN public.raw_materials m ON it.material_id = m.id
LEFT JOIN scm.warehouses w ON it.warehouse_id = w.id;

COMMENT ON VIEW scm.v_inventory_transactions IS 'Inventory transaction view with material and warehouse details';

GRANT SELECT ON scm.v_inventory_transactions TO web_user;
GRANT SELECT ON scm.v_inventory_transactions TO web_anon;
