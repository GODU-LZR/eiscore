-- ========================================
-- App Center Data Tables (User-created grid apps)
-- ========================================

CREATE SCHEMA IF NOT EXISTS app_data;
GRANT USAGE ON SCHEMA app_data TO web_anon, web_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app_data TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_data TO web_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_data
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_data
  GRANT SELECT ON TABLES TO web_anon;

-- Create table for a data app (safe identifier + columns)
CREATE OR REPLACE FUNCTION app_center.create_data_app_table(
  app_id UUID,
  table_name TEXT,
  columns JSONB
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  final_name TEXT;
  col JSONB;
  col_name TEXT;
  col_type TEXT;
BEGIN
  IF table_name IS NULL OR length(trim(table_name)) = 0 THEN
    final_name := 'data_app_' || substring(app_id::TEXT FROM 1 FOR 8);
  ELSE
    final_name := table_name;
  END IF;

  -- sanitize identifier
  final_name := lower(regexp_replace(final_name, '[^a-z0-9_]+', '_', 'g'));
  IF final_name !~ '^[a-z]' THEN
    final_name := 't_' || final_name;
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS app_data.%I (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), properties JSONB DEFAULT ''{}''::jsonb)',
    final_name
  );

  EXECUTE format('GRANT SELECT ON TABLE app_data.%I TO web_anon', final_name);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_data.%I TO web_user', final_name);

  EXECUTE format(
    'ALTER TABLE app_data.%I ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT ''{}''::jsonb',
    final_name
  );

  IF columns IS NULL OR jsonb_typeof(columns) <> 'array' THEN
    RETURN 'app_data.' || final_name;
  END IF;

  FOR col IN SELECT * FROM jsonb_array_elements(columns)
  LOOP
    col_name := coalesce(col->>'field', '');
    col_name := lower(regexp_replace(col_name, '[^a-z0-9_]+', '_', 'g'));
    IF col_name = '' THEN
      CONTINUE;
    END IF;
    IF col_name !~ '^[a-z]' THEN
      col_name := 'f_' || col_name;
    END IF;

    col_type := coalesce(col->>'type', 'text');
    col_type := lower(col_type);
    IF col_type IN ('int', 'integer') THEN
      col_type := 'integer';
    ELSIF col_type IN ('number', 'numeric', 'float', 'double') THEN
      col_type := 'numeric';
    ELSIF col_type IN ('bool', 'boolean') THEN
      col_type := 'boolean';
    ELSIF col_type IN ('date') THEN
      col_type := 'date';
    ELSIF col_type IN ('datetime', 'timestamp', 'timestamptz') THEN
      col_type := 'timestamptz';
    ELSE
      col_type := 'text';
    END IF;

    EXECUTE format(
      'ALTER TABLE app_data.%I ADD COLUMN IF NOT EXISTS %I %s',
      final_name,
      col_name,
      col_type
    );
  END LOOP;

  PERFORM pg_notify('pgrst', 'reload schema');

  RETURN 'app_data.' || final_name;
END;
$$;

GRANT EXECUTE ON FUNCTION app_center.create_data_app_table(UUID, TEXT, JSONB) TO web_user;
