-- Patch: add inventory draft table for staged stock in/out.
-- Apply after inventory_schema.sql is loaded.

CREATE TABLE IF NOT EXISTS scm.inventory_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_type TEXT NOT NULL CHECK (draft_type IN ('in', 'out')),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'locked')),
    material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
    warehouse_id UUID NOT NULL REFERENCES scm.warehouses(id),
    batch_id UUID REFERENCES scm.inventory_batches(id),
    batch_no TEXT,
    rule_id UUID REFERENCES scm.batch_no_rules(id),
    quantity NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    production_date DATE,
    remark TEXT,
    operator TEXT,
    transaction_no TEXT,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_drafts_type ON scm.inventory_drafts(draft_type);
CREATE INDEX IF NOT EXISTS idx_inventory_drafts_status ON scm.inventory_drafts(status);
CREATE INDEX IF NOT EXISTS idx_inventory_drafts_material ON scm.inventory_drafts(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_drafts_warehouse ON scm.inventory_drafts(warehouse_id);

ALTER TABLE scm.inventory_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_drafts_select ON scm.inventory_drafts;
CREATE POLICY inventory_drafts_select ON scm.inventory_drafts FOR SELECT TO web_user USING (true);

DROP POLICY IF EXISTS inventory_drafts_insert ON scm.inventory_drafts;
CREATE POLICY inventory_drafts_insert ON scm.inventory_drafts FOR INSERT TO web_user WITH CHECK (true);

DROP POLICY IF EXISTS inventory_drafts_update ON scm.inventory_drafts;
CREATE POLICY inventory_drafts_update ON scm.inventory_drafts FOR UPDATE TO web_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS inventory_drafts_delete ON scm.inventory_drafts;
CREATE POLICY inventory_drafts_delete ON scm.inventory_drafts FOR DELETE TO web_user USING (true);

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
