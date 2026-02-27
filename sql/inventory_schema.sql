-- ========================================
-- 物料台账模块数据库架构
-- 作者: EISCore Team
-- 日期: 2026-02-05
-- 用途: 库存管理、批次追溯、仓库管理、盘点
-- ========================================

-- 创建 scm schema (如果不存在)
CREATE SCHEMA IF NOT EXISTS scm;

-- ========================================
-- 1. 批次号规则配置表
-- ========================================
CREATE TABLE IF NOT EXISTS scm.batch_no_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,                -- 规则名称: "默认批次号规则"
    rule_template TEXT NOT NULL,                   -- 模板: "{物料编码}-{日期:YYYYMMDD}-{序号:3}"
    reset_strategy TEXT NOT NULL DEFAULT '每日',   -- 序列重置策略: 每日/每月/连续
    applicable_categories TEXT[],                  -- 适用物料分类编码数组
    status TEXT DEFAULT '启用' CHECK (status IN ('启用', '停用')),
    example_output TEXT,                           -- 示例输出: "MAT001-20260205-001"
    description TEXT,                              -- 规则说明
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    dept_id UUID REFERENCES public.departments(id)
);

CREATE INDEX idx_batch_no_rules_status ON scm.batch_no_rules(status);
COMMENT ON TABLE scm.batch_no_rules IS '批次号生成规则配置表';
COMMENT ON COLUMN scm.batch_no_rules.rule_template IS '支持占位符: {物料编码} {日期:YYYYMMDD} {序号:3} {物料分类}';

-- ========================================
-- 2. 仓库/库位表（树形结构）
-- ========================================
CREATE TABLE IF NOT EXISTS scm.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,                     -- 仓库编码: WH001, WH001.A, WH001.A.01
    name TEXT NOT NULL,                            -- 名称: 成品仓, 一区, 货位A01
    parent_id UUID REFERENCES scm.warehouses(id) ON DELETE CASCADE, -- 父级ID
    level INTEGER NOT NULL DEFAULT 1,              -- 层级: 1=仓库, 2=库区, 3=库位
    sort INTEGER DEFAULT 0,                        -- 排序
    status TEXT DEFAULT '启用' CHECK (status IN ('启用', '停用')),
    manager_id INTEGER,                            -- 仓管员ID (关联员工表)
    capacity NUMERIC(15,2),                        -- 容量(可选)
    unit TEXT,                                     -- 容量单位
    properties JSONB DEFAULT '{}',                 -- 扩展属性: {x:10, y:5, width:2, height:3, temperature:"常温"}
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    dept_id UUID REFERENCES public.departments(id)
);

CREATE INDEX idx_warehouses_parent ON scm.warehouses(parent_id);
CREATE INDEX idx_warehouses_code ON scm.warehouses(code);
CREATE INDEX idx_warehouses_level ON scm.warehouses(level);

COMMENT ON TABLE scm.warehouses IS '仓库/库区/库位三级结构表';
COMMENT ON COLUMN scm.warehouses.properties IS '存储Canvas布局坐标、温湿度要求等';

-- ========================================
-- 2.1 仓库布局表（用于大屏可视化）
-- ========================================
CREATE TABLE IF NOT EXISTS scm.warehouse_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES scm.warehouses(id) ON DELETE CASCADE,
    canvas_width INTEGER NOT NULL DEFAULT 0,
    canvas_height INTEGER NOT NULL DEFAULT 0,
    layers JSONB NOT NULL DEFAULT '[]',
    rules JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    dept_id UUID REFERENCES public.departments(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_layouts_warehouse ON scm.warehouse_layouts(warehouse_id);

COMMENT ON TABLE scm.warehouse_layouts IS '仓库布局配置(按库区分层，绑定仓库树节点)';
COMMENT ON COLUMN scm.warehouse_layouts.layers IS '布局层信息: 按库区分层与形状绑定数据';
COMMENT ON COLUMN scm.warehouse_layouts.rules IS '布局渲染规则: 颜色/容量阈值等';

-- ========================================
-- 3. 库存批次表
-- ========================================
CREATE TABLE IF NOT EXISTS scm.inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
    batch_no TEXT NOT NULL,                        -- 批次号
    warehouse_id UUID NOT NULL REFERENCES scm.warehouses(id),
    
    -- 数量管理
    available_qty NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
    locked_qty NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (locked_qty >= 0),
    
    unit TEXT NOT NULL,                            -- 单位
    
    -- 批次属性
    production_date DATE,                          -- 生产日期
    expiry_date DATE,                              -- 过期日期
    supplier TEXT,                                 -- 供应商
    purchase_price NUMERIC(15,4),                  -- 采购单价
    
    status TEXT DEFAULT '正常' CHECK (status IN ('正常', '锁定', '过期', '耗尽')),
    
    properties JSONB DEFAULT '{}',                 -- 扩展属性(质检数据等)
    
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    dept_id UUID REFERENCES public.departments(id),
    
    CONSTRAINT uk_batch_material_warehouse UNIQUE (material_id, batch_no, warehouse_id)
);

CREATE INDEX idx_inventory_batches_material ON scm.inventory_batches(material_id);
CREATE INDEX idx_inventory_batches_warehouse ON scm.inventory_batches(warehouse_id);
CREATE INDEX idx_inventory_batches_batch ON scm.inventory_batches(batch_no);
CREATE INDEX idx_inventory_batches_status ON scm.inventory_batches(status);

COMMENT ON TABLE scm.inventory_batches IS '库存批次表-存储各批次的可用数量和锁定数量';

-- ========================================
-- 4. 库存流水表
-- ========================================
CREATE TABLE IF NOT EXISTS scm.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_no TEXT NOT NULL UNIQUE,           -- 单据号: IN20260205001
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('入库', '出库', '调整', '调拨', '锁定', '解锁')),
    
    material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
    batch_no TEXT,                                 -- 批次号(冗余字段)
    batch_id UUID REFERENCES scm.inventory_batches(id),
    
    warehouse_id UUID REFERENCES scm.warehouses(id),
    
    -- 数量变化
    quantity NUMERIC(18,4) NOT NULL,               -- 变动数量(正数=增加,负数=减少)
    unit TEXT NOT NULL,
    
    before_qty NUMERIC(18,4),                      -- 变动前数量(可选)
    after_qty NUMERIC(18,4),                       -- 变动后数量(可选)
    
    -- 关联信息
    related_doc_type TEXT,                         -- 关联单据类型: 采购单/销售单/生产单
    related_doc_no TEXT,                           -- 关联单据号
    
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operator TEXT,                                 -- 操作人
    remark TEXT,                                   -- 备注
    
    -- 审批流程预留
    approval_status TEXT DEFAULT '已完成' CHECK (approval_status IN ('待审批', '已批准', '已拒绝', '已完成')),
    workflow_instance_id UUID,                     -- 关联工作流实例
    
    properties JSONB DEFAULT '{}',                 -- 扩展属性(Excel导入信息等)
    
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    dept_id UUID REFERENCES public.departments(id)
);

CREATE INDEX idx_transactions_material ON scm.inventory_transactions(material_id);
CREATE INDEX idx_transactions_batch ON scm.inventory_transactions(batch_id);
CREATE INDEX idx_transactions_warehouse ON scm.inventory_transactions(warehouse_id);
CREATE INDEX idx_transactions_date ON scm.inventory_transactions(transaction_date);
CREATE INDEX idx_transactions_type ON scm.inventory_transactions(transaction_type);
CREATE INDEX idx_transactions_no ON scm.inventory_transactions(transaction_no);

COMMENT ON TABLE scm.inventory_transactions IS '库存事务流水表-所有库存变动记录';

-- ========================================
-- 5. 盘点单表
-- ========================================
CREATE TABLE IF NOT EXISTS scm.inventory_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_no TEXT NOT NULL UNIQUE,                 -- 盘点单号
    warehouse_id UUID REFERENCES scm.warehouses(id),
    check_date DATE NOT NULL,                      -- 盘点日期
    status TEXT DEFAULT '进行中' CHECK (status IN ('进行中', '已完成', '已生成调整单')),
    total_items INTEGER DEFAULT 0,                 -- 盘点条目数
    diff_count INTEGER DEFAULT 0,                  -- 差异条目数
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    dept_id UUID REFERENCES public.departments(id)
);

CREATE INDEX idx_checks_warehouse ON scm.inventory_checks(warehouse_id);
CREATE INDEX idx_checks_date ON scm.inventory_checks(check_date);

-- ========================================
-- 6. 盘点明细表
-- ========================================
CREATE TABLE IF NOT EXISTS scm.inventory_check_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES scm.inventory_checks(id) ON DELETE CASCADE,
    material_id INTEGER NOT NULL REFERENCES public.raw_materials(id),
    batch_no TEXT,
    warehouse_id UUID REFERENCES scm.warehouses(id),
    
    book_qty NUMERIC(18,4),                        -- 账面数量
    actual_qty NUMERIC(18,4),                      -- 实盘数量
    diff_qty NUMERIC(18,4) GENERATED ALWAYS AS (actual_qty - COALESCE(book_qty, 0)) STORED,
    
    unit TEXT,
    operator TEXT,                                 -- 盘点人
    scan_time TIMESTAMPTZ,                         -- 扫码时间
    remark TEXT,
    
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_check_items_check ON scm.inventory_check_items(check_id);
CREATE INDEX idx_check_items_material ON scm.inventory_check_items(material_id);

-- ========================================
-- 7. 实时库存视图
-- ========================================
CREATE OR REPLACE VIEW scm.v_inventory_current AS
SELECT 
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
    ib.updated_at AS last_transaction_at
FROM scm.inventory_batches ib
LEFT JOIN public.raw_materials m ON ib.material_id = m.id
LEFT JOIN scm.warehouses w ON ib.warehouse_id = w.id
;

COMMENT ON VIEW scm.v_inventory_current IS '实时库存查询视图';

-- ========================================
-- 8. RPC函数 - 生成批次号
-- ========================================
CREATE OR REPLACE FUNCTION scm.generate_batch_no(
    p_rule_id UUID,
    p_material_id INTEGER,
    p_manual_override TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_rule RECORD;
    v_material RECORD;
    v_template TEXT;
    v_result TEXT;
    v_seq INTEGER;
    v_date_str TEXT;
BEGIN
    -- 如果手动输入，直接验证唯一性后返回
    IF p_manual_override IS NOT NULL AND p_manual_override != '' THEN
        -- 检查是否已存在
        IF EXISTS (SELECT 1 FROM scm.inventory_batches WHERE batch_no = p_manual_override) THEN
            RAISE EXCEPTION '批次号 % 已存在', p_manual_override;
        END IF;
        RETURN p_manual_override;
    END IF;
    
    -- 加载规则
    SELECT * INTO v_rule FROM scm.batch_no_rules WHERE id = p_rule_id AND status = '启用';
    IF NOT FOUND THEN
        RAISE EXCEPTION '批次号规则不存在或已停用';
    END IF;
    
    -- 加载物料信息
    SELECT * INTO v_material FROM public.raw_materials WHERE id = p_material_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '物料不存在';
    END IF;
    
    v_template := v_rule.rule_template;
    
    -- 替换占位符: {物料编码}
    v_template := REPLACE(v_template, '{物料编码}', COALESCE(v_material.batch_no, 'MAT'));
    
    -- 替换占位符: {物料分类} (兼容旧模板 {分类})
    v_template := REPLACE(v_template, '{物料分类}', COALESCE(v_material.category, 'CAT'));
    v_template := REPLACE(v_template, '{分类}', COALESCE(v_material.category, 'CAT'));
    
    -- 替换占位符: {日期:YYYYMMDD}
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    v_template := REPLACE(v_template, '{日期:YYYYMMDD}', v_date_str);
    
    -- 替换占位符: {序号:3} (生成序列号)
    -- 简化实现: 使用时间戳后6位作为序号
    v_seq := EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000;
    v_template := REPLACE(v_template, '{序号:3}', LPAD(v_seq::TEXT, 3, '0'));
    
    v_result := v_template;
    
    -- 验证唯一性(简单重试)
    IF EXISTS (SELECT 1 FROM scm.inventory_batches WHERE batch_no = v_result) THEN
        v_result := v_result || '-' || LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
    END IF;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION scm.generate_batch_no IS '生成批次号-支持模板规则和手动输入';

-- ========================================
-- 9. RPC函数 - 入库
-- ========================================
CREATE OR REPLACE FUNCTION scm.stock_in(
    p_material_id INTEGER,
    p_warehouse_id UUID,
    p_quantity NUMERIC,
    p_unit TEXT,
    p_batch_no TEXT,
    p_transaction_no TEXT DEFAULT NULL,
    p_operator TEXT DEFAULT NULL,
    p_production_date DATE DEFAULT NULL,
    p_remark TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_batch_id UUID;
    v_transaction_no TEXT;
    v_after_qty NUMERIC;
BEGIN
    -- 生成单据号
    v_transaction_no := COALESCE(p_transaction_no, 'IN' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));
    
    -- 查找或创建批次
    SELECT id INTO v_batch_id
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;
    
    IF v_batch_id IS NULL THEN
        -- 创建新批次
        INSERT INTO scm.inventory_batches (
            material_id, batch_no, warehouse_id, available_qty, unit,
            production_date, status, created_by
        ) VALUES (
            p_material_id, p_batch_no, p_warehouse_id, p_quantity, p_unit,
            p_production_date, '正常', p_operator
        )
        RETURNING id, available_qty INTO v_batch_id, v_after_qty;
    ELSE
        -- 更新现有批次
        UPDATE scm.inventory_batches
        SET available_qty = available_qty + p_quantity,
            updated_at = NOW()
        WHERE id = v_batch_id
        RETURNING available_qty INTO v_after_qty;
    END IF;
    
    -- 记录流水
    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, after_qty, operator, remark, created_by
    ) VALUES (
        v_transaction_no, '入库', p_material_id, v_batch_id, p_batch_no,
        p_warehouse_id, p_quantity, p_unit, v_after_qty, p_operator, p_remark, p_operator
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_no', v_transaction_no,
        'batch_id', v_batch_id,
        'after_qty', v_after_qty
    );
END;
$$;

COMMENT ON FUNCTION scm.stock_in IS '入库操作-原子化事务';

-- ========================================
-- 10. RPC函数 - 出库
-- ========================================
CREATE OR REPLACE FUNCTION scm.stock_out(
    p_material_id INTEGER,
    p_warehouse_id UUID,
    p_quantity NUMERIC,
    p_unit TEXT,
    p_batch_no TEXT,
    p_transaction_no TEXT DEFAULT NULL,
    p_operator TEXT DEFAULT NULL,
    p_remark TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_batch_id UUID;
    v_available_qty NUMERIC;
    v_transaction_no TEXT;
    v_after_qty NUMERIC;
BEGIN
    -- 生成单据号
    v_transaction_no := COALESCE(p_transaction_no, 'OUT' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));
    
    -- 锁定批次记录
    SELECT id, available_qty INTO v_batch_id, v_available_qty
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;
    
    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION '批次不存在: %', p_batch_no;
    END IF;
    
    IF v_available_qty < p_quantity THEN
        RAISE EXCEPTION '可用库存不足: 需要% 可用%', p_quantity, v_available_qty;
    END IF;
    
    -- 扣减库存
    UPDATE scm.inventory_batches
    SET available_qty = available_qty - p_quantity,
        updated_at = NOW()
    WHERE id = v_batch_id
    RETURNING available_qty INTO v_after_qty;
    
    -- 记录流水
    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, before_qty, after_qty, operator, remark, created_by
    ) VALUES (
        v_transaction_no, '出库', p_material_id, v_batch_id, p_batch_no,
        p_warehouse_id, -p_quantity, p_unit, v_available_qty, v_after_qty, p_operator, p_remark, p_operator
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_no', v_transaction_no,
        'batch_id', v_batch_id,
        'after_qty', v_after_qty
    );
END;
$$;

COMMENT ON FUNCTION scm.stock_out IS '出库操作-防超卖锁定';

-- ========================================
-- 11. RPC函数 - 库存调整
-- ========================================
CREATE OR REPLACE FUNCTION scm.stock_adjust(
    p_material_id INTEGER,
    p_warehouse_id UUID,
    p_batch_no TEXT,
    p_adjust_qty NUMERIC,
    p_unit TEXT,
    p_remark TEXT,
    p_operator TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_batch_id UUID;
    v_transaction_no TEXT;
    v_before_qty NUMERIC;
    v_after_qty NUMERIC;
BEGIN
    v_transaction_no := 'ADJ' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
    
    SELECT id, available_qty INTO v_batch_id, v_before_qty
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;
    
    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION '批次不存在';
    END IF;
    
    -- 更新数量
    UPDATE scm.inventory_batches
    SET available_qty = available_qty + p_adjust_qty,
        updated_at = NOW()
    WHERE id = v_batch_id
    RETURNING available_qty INTO v_after_qty;
    
    IF v_after_qty < 0 THEN
        RAISE EXCEPTION '调整后数量不能为负数';
    END IF;
    
    -- 记录流水
    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, before_qty, after_qty, operator, remark,
        approval_status, created_by
    ) VALUES (
        v_transaction_no, '调整', p_material_id, v_batch_id, p_batch_no,
        p_warehouse_id, p_adjust_qty, p_unit, v_before_qty, v_after_qty, p_operator, p_remark,
        '已完成', p_operator
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_no', v_transaction_no,
        'before_qty', v_before_qty,
        'after_qty', v_after_qty
    );
END;
$$;

-- ========================================
-- 12. 权限配置
-- ========================================

-- 授予web_anon只读权限
GRANT USAGE ON SCHEMA scm TO web_anon;
GRANT SELECT ON ALL TABLES IN SCHEMA scm TO web_anon;
GRANT SELECT ON scm.v_inventory_current TO web_anon;

-- 授予web_user CRUD权限
GRANT USAGE ON SCHEMA scm TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA scm TO web_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA scm TO web_user;
GRANT SELECT ON scm.v_inventory_current TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON scm.warehouse_layouts TO web_user;

-- 默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA scm GRANT SELECT ON TABLES TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA scm GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA scm GRANT EXECUTE ON FUNCTIONS TO web_user;

-- 启用RLS
ALTER TABLE scm.batch_no_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.warehouse_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.inventory_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm.inventory_check_items ENABLE ROW LEVEL SECURITY;

-- RLS策略(示例-暂时允许所有)
CREATE POLICY batch_no_rules_select ON scm.batch_no_rules FOR SELECT TO web_user USING (true);
CREATE POLICY batch_no_rules_insert ON scm.batch_no_rules FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY batch_no_rules_update ON scm.batch_no_rules FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY batch_no_rules_delete ON scm.batch_no_rules FOR DELETE TO web_user USING (true);
CREATE POLICY warehouses_select ON scm.warehouses FOR SELECT TO web_user USING (true);
CREATE POLICY warehouses_insert ON scm.warehouses FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY warehouses_update ON scm.warehouses FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY warehouses_delete ON scm.warehouses FOR DELETE TO web_user USING (true);
CREATE POLICY warehouse_layouts_select ON scm.warehouse_layouts FOR SELECT TO web_user USING (true);
CREATE POLICY warehouse_layouts_insert ON scm.warehouse_layouts FOR INSERT TO web_user WITH CHECK (true);
CREATE POLICY warehouse_layouts_update ON scm.warehouse_layouts FOR UPDATE TO web_user USING (true) WITH CHECK (true);
CREATE POLICY warehouse_layouts_delete ON scm.warehouse_layouts FOR DELETE TO web_user USING (true);
CREATE POLICY inventory_batches_select ON scm.inventory_batches FOR SELECT TO web_user USING (true);
CREATE POLICY inventory_transactions_select ON scm.inventory_transactions FOR SELECT TO web_user USING (true);

-- ========================================
-- 完成
-- ========================================
COMMENT ON SCHEMA scm IS '供应链管理模块-包含库存、仓库、批次管理';
