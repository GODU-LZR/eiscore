-- Patch: add rule_id to inventory_drafts and refresh view.
-- Apply after patch_inventory_drafts.sql.

ALTER TABLE scm.inventory_drafts
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES scm.batch_no_rules(id);

DROP VIEW IF EXISTS scm.v_inventory_drafts;

CREATE OR REPLACE VIEW scm.v_inventory_drafts AS
SELECT
    d.id,
    d.draft_type,
    d.status,
    d.material_id,
    m.batch_no AS material_code,
    m.name AS material_name,
    m.category AS material_category,
    d.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    d.batch_id,
    COALESCE(d.batch_no, ib.batch_no) AS batch_no,
    d.rule_id,
    ib.available_qty,
    d.quantity,
    d.unit,
    d.production_date,
    d.remark,
    d.operator,
    d.transaction_no,
    d.created_at,
    d.updated_at
FROM scm.inventory_drafts d
LEFT JOIN public.raw_materials m ON d.material_id = m.id
LEFT JOIN scm.warehouses w ON d.warehouse_id = w.id
LEFT JOIN scm.inventory_batches ib ON d.batch_id = ib.id;

COMMENT ON VIEW scm.v_inventory_drafts IS 'Draft stock in/out records with material and warehouse details';

GRANT SELECT ON scm.v_inventory_drafts TO web_user;
GRANT SELECT ON scm.v_inventory_drafts TO web_anon;
