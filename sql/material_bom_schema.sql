-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- BOM schema for materials module.
-- Execute:
--   cat sql/material_bom_schema.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_no TEXT NOT NULL,
    bom_name TEXT NOT NULL,
    parent_material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
    version TEXT NOT NULL DEFAULT 'V1',
    base_qty NUMERIC(18, 6) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT '',
    bom_type TEXT NOT NULL DEFAULT '生产BOM',
    status TEXT NOT NULL DEFAULT '草稿',
    effective_from DATE,
    effective_to DATE,
    remark TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT boms_base_qty_positive CHECK (base_qty > 0),
    CONSTRAINT boms_status_check CHECK (status IN ('草稿', '启用', '停用', '作废')),
    CONSTRAINT boms_type_check CHECK (bom_type IN ('生产BOM', '包装BOM', '研发BOM', '委外BOM'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_boms_parent_version
    ON scm.boms(parent_material_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS uk_boms_bom_no
    ON scm.boms(bom_no);
CREATE INDEX IF NOT EXISTS idx_boms_parent_material
    ON scm.boms(parent_material_id);
CREATE INDEX IF NOT EXISTS idx_boms_status
    ON scm.boms(status);

CREATE TABLE IF NOT EXISTS scm.bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES scm.boms(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL DEFAULT 10,
    component_material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
    qty NUMERIC(18, 6) NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    loss_rate NUMERIC(9, 6) NOT NULL DEFAULT 0,
    issue_method TEXT NOT NULL DEFAULT '按需领料',
    substitute_group TEXT,
    remark TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT bom_items_qty_positive CHECK (qty > 0),
    CONSTRAINT bom_items_loss_rate_range CHECK (loss_rate >= 0 AND loss_rate < 1),
    CONSTRAINT bom_items_issue_method_check CHECK (issue_method IN ('按需领料', '倒冲领料', '不发料'))
);

CREATE INDEX IF NOT EXISTS idx_bom_items_bom
    ON scm.bom_items(bom_id, line_no);
CREATE INDEX IF NOT EXISTS idx_bom_items_component
    ON scm.bom_items(component_material_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_bom_items_bom_line
    ON scm.bom_items(bom_id, line_no);

CREATE OR REPLACE FUNCTION scm.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION scm.validate_bom_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_material_id INTEGER;
BEGIN
    SELECT parent_material_id
    INTO v_parent_material_id
    FROM scm.boms
    WHERE id = NEW.bom_id;

    IF v_parent_material_id IS NULL THEN
        RAISE EXCEPTION 'BOM does not exist: %', NEW.bom_id;
    END IF;

    IF NEW.component_material_id = v_parent_material_id THEN
        RAISE EXCEPTION 'BOM component cannot be the same as parent material';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boms_touch_updated_at ON scm.boms;
CREATE TRIGGER trg_boms_touch_updated_at
BEFORE UPDATE ON scm.boms
FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_bom_items_touch_updated_at ON scm.bom_items;
CREATE TRIGGER trg_bom_items_touch_updated_at
BEFORE UPDATE ON scm.bom_items
FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_bom_items_validate ON scm.bom_items;
CREATE TRIGGER trg_bom_items_validate
BEFORE INSERT OR UPDATE ON scm.bom_items
FOR EACH ROW EXECUTE FUNCTION scm.validate_bom_item();

CREATE OR REPLACE VIEW scm.v_boms AS
SELECT
    b.id,
    b.bom_no,
    b.bom_name,
    b.parent_material_id,
    pm.batch_no AS parent_material_code,
    pm.name AS parent_material_name,
    pm.category AS parent_material_category,
    b.version,
    b.base_qty,
    b.unit,
    b.bom_type,
    b.status,
    b.effective_from,
    b.effective_to,
    b.remark,
    b.properties,
    COALESCE(COUNT(i.id), 0)::INTEGER AS item_count,
    COALESCE(SUM(i.qty * (1 + i.loss_rate)), 0)::NUMERIC(18, 6) AS component_qty_total,
    b.created_by,
    b.created_at,
    b.updated_at
FROM scm.boms b
JOIN public.raw_materials pm ON pm.id = b.parent_material_id
LEFT JOIN scm.bom_items i ON i.bom_id = b.id
GROUP BY b.id, pm.id;

CREATE OR REPLACE VIEW scm.v_bom_items AS
SELECT
    i.id,
    i.bom_id,
    b.bom_no,
    b.bom_name,
    b.parent_material_id,
    pm.batch_no AS parent_material_code,
    pm.name AS parent_material_name,
    i.line_no,
    i.component_material_id,
    cm.batch_no AS component_material_code,
    cm.name AS component_material_name,
    cm.category AS component_material_category,
    i.qty,
    i.unit,
    i.loss_rate,
    ROUND((i.qty * (1 + i.loss_rate))::numeric, 6) AS gross_qty,
    i.issue_method,
    i.substitute_group,
    i.remark,
    i.properties,
    i.created_at,
    i.updated_at
FROM scm.bom_items i
JOIN scm.boms b ON b.id = i.bom_id
JOIN public.raw_materials pm ON pm.id = b.parent_material_id
JOIN public.raw_materials cm ON cm.id = i.component_material_id;

CREATE OR REPLACE VIEW scm.v_bom_explosion AS
WITH RECURSIVE bom_tree AS (
    SELECT
        b.id AS root_bom_id,
        b.bom_no AS root_bom_no,
        b.parent_material_id AS root_material_id,
        pm.batch_no AS root_material_code,
        pm.name AS root_material_name,
        i.component_material_id,
        cm.batch_no AS component_material_code,
        cm.name AS component_material_name,
        i.qty,
        i.unit,
        i.loss_rate,
        (i.qty * (1 + i.loss_rate) / NULLIF(b.base_qty, 0))::NUMERIC(18, 6) AS required_qty,
        1 AS level,
        ARRAY[b.parent_material_id, i.component_material_id] AS material_path
    FROM scm.boms b
    JOIN scm.bom_items i ON i.bom_id = b.id
    JOIN public.raw_materials pm ON pm.id = b.parent_material_id
    JOIN public.raw_materials cm ON cm.id = i.component_material_id
    WHERE b.status = '启用'

    UNION ALL

    SELECT
        t.root_bom_id,
        t.root_bom_no,
        t.root_material_id,
        t.root_material_code,
        t.root_material_name,
        i.component_material_id,
        cm.batch_no,
        cm.name,
        i.qty,
        i.unit,
        i.loss_rate,
        (t.required_qty * i.qty * (1 + i.loss_rate) / NULLIF(child_bom.base_qty, 0))::NUMERIC(18, 6),
        t.level + 1,
        t.material_path || i.component_material_id
    FROM bom_tree t
    JOIN scm.boms child_bom
      ON child_bom.parent_material_id = t.component_material_id
     AND child_bom.status = '启用'
    JOIN scm.bom_items i ON i.bom_id = child_bom.id
    JOIN public.raw_materials cm ON cm.id = i.component_material_id
    WHERE t.level < 8
      AND NOT i.component_material_id = ANY(t.material_path)
)
SELECT * FROM bom_tree;

CREATE OR REPLACE FUNCTION scm.explode_bom(
    p_parent_material_id INTEGER,
    p_qty NUMERIC DEFAULT 1,
    p_version TEXT DEFAULT NULL
)
RETURNS TABLE (
    root_bom_id UUID,
    root_bom_no TEXT,
    root_material_id INTEGER,
    root_material_code TEXT,
    root_material_name TEXT,
    component_material_id INTEGER,
    component_material_code TEXT,
    component_material_name TEXT,
    unit TEXT,
    required_qty NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = scm, public
AS $$
    SELECT
        e.root_bom_id,
        e.root_bom_no,
        e.root_material_id,
        e.root_material_code,
        e.root_material_name,
        e.component_material_id,
        e.component_material_code,
        e.component_material_name,
        MAX(e.unit) AS unit,
        SUM(e.required_qty * COALESCE(p_qty, 1))::NUMERIC(18, 6) AS required_qty
    FROM scm.v_bom_explosion e
    JOIN scm.boms b ON b.id = e.root_bom_id
    WHERE e.root_material_id = p_parent_material_id
      AND (p_version IS NULL OR b.version = p_version)
    GROUP BY
        e.root_bom_id,
        e.root_bom_no,
        e.root_material_id,
        e.root_material_code,
        e.root_material_name,
        e.component_material_id,
        e.component_material_code,
        e.component_material_name
    ORDER BY component_material_code;
$$;

COMMENT ON TABLE scm.boms IS 'BOM主表：定义成品/半成品与版本、状态、基准数量';
COMMENT ON TABLE scm.bom_items IS 'BOM明细表：定义父项BOM下的子件、用量、损耗和发料方式';
COMMENT ON VIEW scm.v_boms IS 'BOM主数据查询视图，带父项物料与明细汇总';
COMMENT ON VIEW scm.v_bom_items IS 'BOM明细查询视图，带父项与子件物料信息';
COMMENT ON VIEW scm.v_bom_explosion IS '启用BOM多层展开视图，用于生产、采购、成本等模块';
COMMENT ON FUNCTION scm.explode_bom(INTEGER, NUMERIC, TEXT) IS '按父项物料和生产数量展开启用BOM，聚合子件需求量';

ALTER TABLE scm.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boms_select ON scm.boms;
DROP POLICY IF EXISTS boms_insert ON scm.boms;
DROP POLICY IF EXISTS boms_update ON scm.boms;
DROP POLICY IF EXISTS boms_delete ON scm.boms;
CREATE POLICY boms_select ON scm.boms FOR SELECT TO web_user USING (true);
CREATE POLICY boms_insert ON scm.boms FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY boms_update ON scm.boms FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY boms_delete ON scm.boms FOR DELETE TO web_user USING (true);

DROP POLICY IF EXISTS bom_items_select ON scm.bom_items;
DROP POLICY IF EXISTS bom_items_insert ON scm.bom_items;
DROP POLICY IF EXISTS bom_items_update ON scm.bom_items;
DROP POLICY IF EXISTS bom_items_delete ON scm.bom_items;
CREATE POLICY bom_items_select ON scm.bom_items FOR SELECT TO web_user USING (true);
CREATE POLICY bom_items_insert ON scm.bom_items FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY bom_items_update ON scm.bom_items FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY bom_items_delete ON scm.bom_items FOR DELETE TO web_user USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON scm.boms TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON scm.bom_items TO web_user;
GRANT SELECT ON scm.v_boms TO web_user;
GRANT SELECT ON scm.v_bom_items TO web_user;
GRANT SELECT ON scm.v_bom_explosion TO web_user;
GRANT SELECT ON scm.v_boms TO web_anon;
GRANT SELECT ON scm.v_bom_items TO web_anon;
GRANT SELECT ON scm.v_bom_explosion TO web_anon;
GRANT EXECUTE ON FUNCTION scm.explode_bom(INTEGER, NUMERIC, TEXT) TO web_user;
GRANT EXECUTE ON FUNCTION scm.explode_bom(INTEGER, NUMERIC, TEXT) TO web_anon;

INSERT INTO public.permissions (code, name, module, action)
VALUES
    ('app:mms_bom', 'BOM管理', 'mms', 'app'),
    ('op:mms_bom.create', 'BOM管理-新增', 'mms_bom', 'create'),
    ('op:mms_bom.edit', 'BOM管理-编辑', 'mms_bom', 'edit'),
    ('op:mms_bom.delete', 'BOM管理-删除', 'mms_bom', 'delete'),
    ('op:mms_bom.export', 'BOM管理-导出', 'mms_bom', 'export')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    module = EXCLUDED.module,
    action = EXCLUDED.action,
    updated_at = NOW();

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin', 'mms_manager')
  AND (
    p.code = 'app:mms_bom'
    OR p.code LIKE 'op:mms\_bom.%' ESCAPE '\'
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
    ('scm', 'boms', 'mms', 'bom', 'BOM主数据', '成品/半成品BOM版本、状态和基准数量', true, '["mms","bom","master"]'::jsonb),
    ('scm', 'bom_items', 'mms', 'bom_item', 'BOM明细', 'BOM子件用量、损耗和发料方式', true, '["mms","bom","component"]'::jsonb)
ON CONFLICT (table_schema, table_name) DO UPDATE
SET semantic_domain = EXCLUDED.semantic_domain,
    semantic_class = EXCLUDED.semantic_class,
    semantic_name = EXCLUDED.semantic_name,
    semantic_description = EXCLUDED.semantic_description,
    is_business = true,
    tags = EXCLUDED.tags,
    is_active = true,
    updated_at = NOW();

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
    created_by
)
SELECT
    'BOM-MAT-FG-001-V1',
    '香煎金鲳鱼半成品标准BOM',
    id,
    'V1',
    20,
    '盒',
    '生产BOM',
    '启用',
    CURRENT_DATE,
    '演示BOM：20盒成品用量',
    'system'
FROM public.raw_materials
WHERE batch_no = 'MAT-FG-001'
ON CONFLICT (bom_no) DO NOTHING;

INSERT INTO scm.bom_items (
    bom_id,
    line_no,
    component_material_id,
    qty,
    unit,
    loss_rate,
    issue_method,
    remark
)
SELECT
    b.id,
    x.line_no,
    m.id,
    x.qty,
    x.unit,
    x.loss_rate,
    x.issue_method,
    x.remark
FROM scm.boms b
JOIN (
    VALUES
      (10, 'MAT-RM-001', 10::numeric, '千克', 0.030000::numeric, '按需领料', '主料'),
      (20, 'MAT-AUX-001', 0.35::numeric, '千克', 0.010000::numeric, '按需领料', '调味'),
      (30, 'MAT-AUX-004', 0.80::numeric, '千克', 0.010000::numeric, '按需领料', '调味'),
      (40, 'MAT-PKG-002', 20::numeric, '个', 0.020000::numeric, '按需领料', '内包装'),
      (50, 'MAT-PKG-003', 2::numeric, '个', 0.000000::numeric, '按需领料', '外箱')
) AS x(line_no, material_code, qty, unit, loss_rate, issue_method, remark)
  ON true
JOIN public.raw_materials m ON m.batch_no = x.material_code
WHERE b.bom_no = 'BOM-MAT-FG-001-V1'
  AND NOT EXISTS (
    SELECT 1
    FROM scm.bom_items existing
    WHERE existing.bom_id = b.id
      AND existing.component_material_id = m.id
  );

SELECT pg_notify('pgrst', 'reload schema');
