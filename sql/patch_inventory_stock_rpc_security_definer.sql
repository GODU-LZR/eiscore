-- Patch: run stock_in/stock_out with definer privileges to bypass RLS on scm tables.
-- Apply after inventory_schema.sql is loaded.

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
SECURITY DEFINER
SET search_path = scm, public
AS $$
DECLARE
    v_batch_id UUID;
    v_transaction_no TEXT;
    v_after_qty NUMERIC;
BEGIN
    v_transaction_no := COALESCE(p_transaction_no, 'IN' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));

    SELECT id INTO v_batch_id
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF v_batch_id IS NULL THEN
        INSERT INTO scm.inventory_batches (
            material_id, batch_no, warehouse_id, available_qty, unit,
            production_date, status, created_by
        ) VALUES (
            p_material_id, p_batch_no, p_warehouse_id, p_quantity, p_unit,
            p_production_date, U&'\6B63\5E38', p_operator
        )
        RETURNING id, available_qty INTO v_batch_id, v_after_qty;
    ELSE
        UPDATE scm.inventory_batches
        SET available_qty = available_qty + p_quantity,
            updated_at = NOW()
        WHERE id = v_batch_id
        RETURNING available_qty INTO v_after_qty;
    END IF;

    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, after_qty, operator, remark, created_by
    ) VALUES (
        v_transaction_no, U&'\5165\5E93', p_material_id, v_batch_id, p_batch_no,
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
SECURITY DEFINER
SET search_path = scm, public
AS $$
DECLARE
    v_batch_id UUID;
    v_available_qty NUMERIC;
    v_transaction_no TEXT;
    v_after_qty NUMERIC;
BEGIN
    v_transaction_no := COALESCE(p_transaction_no, 'OUT' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));

    SELECT id, available_qty INTO v_batch_id, v_available_qty
    FROM scm.inventory_batches
    WHERE material_id = p_material_id
      AND batch_no = p_batch_no
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION 'BATCH_NOT_FOUND: %', p_batch_no;
    END IF;

    IF v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_QTY: need %, available %', p_quantity, v_available_qty;
    END IF;

    UPDATE scm.inventory_batches
    SET available_qty = available_qty - p_quantity,
        updated_at = NOW()
    WHERE id = v_batch_id
    RETURNING available_qty INTO v_after_qty;

    INSERT INTO scm.inventory_transactions (
        transaction_no, transaction_type, material_id, batch_id, batch_no,
        warehouse_id, quantity, unit, before_qty, after_qty, operator, remark, created_by
    ) VALUES (
        v_transaction_no, U&'\51FA\5E93', p_material_id, v_batch_id, p_batch_no,
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
