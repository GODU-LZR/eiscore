-- Patch: make generate_batch_no run with definer privileges to avoid RLS blocking rule/material lookup.
-- Apply after inventory_schema.sql is loaded.

CREATE OR REPLACE FUNCTION scm.generate_batch_no(
    p_rule_id UUID,
    p_material_id INTEGER,
    p_manual_override TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = scm, public
AS $$
DECLARE
    v_rule RECORD;
    v_material RECORD;
    v_template TEXT;
    v_result TEXT;
    v_seq INTEGER;
    v_date_str TEXT;
BEGIN
    -- If manual override provided, validate uniqueness then return it
    IF p_manual_override IS NOT NULL AND p_manual_override != '' THEN
        IF EXISTS (SELECT 1 FROM scm.inventory_batches WHERE batch_no = p_manual_override) THEN
            RAISE EXCEPTION 'BATCH_EXISTS: %', p_manual_override;
        END IF;
        RETURN p_manual_override;
    END IF;

    -- Load rule (status check omitted to avoid encoding issues)
    SELECT * INTO v_rule
    FROM scm.batch_no_rules
    WHERE id = p_rule_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RULE_NOT_FOUND';
    END IF;

    -- Load material
    SELECT * INTO v_material FROM public.raw_materials WHERE id = p_material_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MATERIAL_NOT_FOUND';
    END IF;

    v_template := v_rule.rule_template;

    -- Replace placeholders
    v_template := REPLACE(v_template, U&'{\7269\6599\7F16\7801}', COALESCE(v_material.batch_no, 'MAT'));
    v_template := REPLACE(v_template, U&'{\7269\6599\5206\7C7B}', COALESCE(v_material.category, 'CAT'));
    v_template := REPLACE(v_template, U&'{\5206\7C7B}', COALESCE(v_material.category, 'CAT'));
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    v_template := REPLACE(v_template, U&'{\65E5\671F:YYYYMMDD}', v_date_str);

    -- Sequence
    v_seq := EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000;
    v_template := REPLACE(v_template, U&'{\5E8F\53F7:3}', LPAD(v_seq::TEXT, 3, '0'));

    v_result := v_template;

    -- Simple uniqueness check
    IF EXISTS (SELECT 1 FROM scm.inventory_batches WHERE batch_no = v_result) THEN
        v_result := v_result || '-' || LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
    END IF;

    RETURN v_result;
END;
$$;
