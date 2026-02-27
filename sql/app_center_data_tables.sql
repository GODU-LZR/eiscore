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

CREATE TABLE IF NOT EXISTS public.ontology_column_semantics (
  table_schema TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  semantic_class TEXT NOT NULL DEFAULT 'business_attribute',
  semantic_name TEXT NOT NULL,
  semantic_description TEXT NOT NULL DEFAULT '',
  data_type TEXT NOT NULL DEFAULT 'text',
  ui_type TEXT NOT NULL DEFAULT 'text',
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'rule_fallback',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (table_schema, table_name, column_name)
);

GRANT SELECT ON public.ontology_column_semantics TO web_user;

-- Best-effort semantic audit log writer (compatibility mode).
-- It does not change ACL decisions and only records events for super_admin.
CREATE OR REPLACE FUNCTION app_center.log_semantic_event(
  app_id UUID,
  task_id TEXT,
  status TEXT,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims JSONB := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  app_role TEXT := COALESCE(NULLIF(claims ->> 'app_role', ''), NULLIF(current_setting('request.jwt.claim.app_role', true), ''));
  actor_username TEXT := COALESCE(NULLIF(claims ->> 'username', ''), NULLIF(current_setting('request.jwt.claim.username', true), ''), 'unknown');
  normalized_status TEXT := lower(COALESCE(status, 'completed'));
BEGIN
  IF to_regclass('app_center.execution_logs') IS NULL THEN
    RETURN;
  END IF;

  IF app_role IS DISTINCT FROM 'super_admin' THEN
    RETURN;
  END IF;

  IF normalized_status NOT IN ('pending', 'running', 'completed', 'failed') THEN
    normalized_status := 'completed';
  END IF;

  INSERT INTO app_center.execution_logs (
    app_id,
    task_id,
    status,
    input_data,
    output_data,
    error_message,
    executed_by,
    executed_at
  )
  VALUES (
    app_id,
    LEFT(COALESCE(task_id, 'semantic_auto_enrich'), 100),
    normalized_status,
    COALESCE(input_data, '{}'::jsonb),
    COALESCE(output_data, '{}'::jsonb),
    error_message,
    actor_username,
    now()
  );
EXCEPTION WHEN OTHERS THEN
  -- audit must not block main business path
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION app_center.log_semantic_event(UUID, TEXT, TEXT, JSONB, JSONB, TEXT) TO web_user;

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
  col_kind TEXT;
  col_label TEXT;
  col_semantic_class TEXT;
  app_display_name TEXT;
  app_semantics_mode TEXT;
  claims JSONB := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  actor_username TEXT := COALESCE(NULLIF(claims ->> 'username', ''), NULLIF(current_setting('request.jwt.claim.username', true), ''), 'unknown');
  audit_input JSONB;
  touched_columns TEXT[] := ARRAY[]::TEXT[];
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

  audit_input := jsonb_build_object(
    'action', 'create_data_app_table',
    'app_id', app_id,
    'table_name', final_name,
    'columns_count', CASE
      WHEN columns IS NOT NULL AND jsonb_typeof(columns) = 'array' THEN jsonb_array_length(columns)
      ELSE 0
    END,
    'actor', actor_username
  );

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

  SELECT COALESCE(NULLIF(TRIM(a.name), ''), final_name)
    INTO app_display_name
    FROM app_center.apps a
   WHERE a.id = app_id
   LIMIT 1;

  SELECT COALESCE(NULLIF(TRIM(a.config ->> 'semantics_mode'), ''), 'ai_defined')
    INTO app_semantics_mode
    FROM app_center.apps a
   WHERE a.id = app_id
   LIMIT 1;

  app_display_name := COALESCE(app_display_name, final_name);
  app_semantics_mode := COALESCE(app_semantics_mode, 'ai_defined');

  PERFORM app_center.log_semantic_event(
    app_id,
    'semantic_auto_enrich',
    'running',
    audit_input,
    jsonb_build_object('stage', 'started', 'semantics_mode', app_semantics_mode),
    NULL
  );

  IF columns IS NULL OR jsonb_typeof(columns) <> 'array' THEN
    PERFORM app_center.log_semantic_event(
      app_id,
      'semantic_auto_enrich',
      'completed',
      audit_input,
      jsonb_build_object('table', 'app_data.' || final_name, 'semantics_mode', app_semantics_mode, 'reason', 'no_columns'),
      NULL
    );
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

    col_kind := lower(coalesce(col->>'type', 'text'));
    col_type := col_kind;
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

    IF NOT col_name = ANY(touched_columns) THEN
      touched_columns := array_append(touched_columns, col_name);
    END IF;

    IF to_regclass('public.ontology_column_semantics') IS NOT NULL THEN
      col_label := COALESCE(NULLIF(TRIM(col->>'label'), ''), col_name);
      col_semantic_class := CASE
        WHEN col_kind IN ('select', 'dropdown') THEN 'enum_attribute'
        WHEN col_kind = 'cascader' THEN 'hierarchy_attribute'
        WHEN col_kind = 'geo' THEN 'geo_attribute'
        WHEN col_kind = 'file' THEN 'file_attribute'
        WHEN col_kind = 'formula' THEN 'derived_metric'
        ELSE 'business_attribute'
      END;

      INSERT INTO public.ontology_column_semantics (
        table_schema,
        table_name,
        column_name,
        semantic_class,
        semantic_name,
        semantic_description,
        data_type,
        ui_type,
        is_sensitive,
        source,
        tags,
        is_active,
        updated_at
      )
      VALUES (
        'app_data',
        final_name,
        col_name,
        col_semantic_class,
        col_label,
        format('字段“%s”自动语义标注', col_label),
        col_type,
        col_kind,
        (col_name ~* '(phone|mobile|idcard|id_no|bank|salary|wage|email|address|geo|location|password|secret|token)'),
        'rule_fallback',
        jsonb_build_array(
          'app_data',
          'column',
          format('ui:%s', col_kind),
          format('semantics:%s', app_semantics_mode),
          app_id::text
        ),
        true,
        now()
      )
      ON CONFLICT ON CONSTRAINT ontology_column_semantics_pkey DO UPDATE
      SET semantic_class = EXCLUDED.semantic_class,
          semantic_name = EXCLUDED.semantic_name,
          semantic_description = EXCLUDED.semantic_description,
          data_type = EXCLUDED.data_type,
          ui_type = EXCLUDED.ui_type,
          is_sensitive = EXCLUDED.is_sensitive,
          source = EXCLUDED.source,
          tags = EXCLUDED.tags,
          is_active = true,
          updated_at = now();
    END IF;
  END LOOP;

  IF to_regclass('public.ontology_column_semantics') IS NOT NULL THEN
    UPDATE public.ontology_column_semantics ocs
    SET is_active = false,
        updated_at = now()
    WHERE ocs.table_schema = 'app_data'
      AND ocs.table_name = final_name
      AND NOT (ocs.column_name = ANY(touched_columns));
  END IF;

  -- Compatibility-only ontology enrichment:
  -- keep existing ACL model unchanged, and only upsert semantic metadata.
  IF to_regclass('public.ontology_table_semantics') IS NOT NULL THEN
    INSERT INTO public.ontology_table_semantics (
      table_schema,
      table_name,
      semantic_domain,
      semantic_class,
      semantic_name,
      semantic_description,
      is_business,
      tags,
      is_active,
      updated_at
    )
    VALUES (
      'app_data',
      final_name,
      'app_data',
      'dynamic_data_app',
      format(U&'\52A8\6001\4E1A\52A1\8868\5355(%s)', app_display_name),
      format(U&'\5E94\7528\4E2D\5FC3\6570\636E\5E94\7528\201C%s\201D\5BF9\5E94\4E1A\52A1\8868', app_display_name),
      true,
      jsonb_build_array('app_data', 'dynamic', 'business', app_id::text, format('semantics:%s', app_semantics_mode)),
      true,
      now()
    )
    ON CONFLICT ON CONSTRAINT ontology_table_semantics_pkey DO UPDATE
    SET semantic_domain = EXCLUDED.semantic_domain,
        semantic_class = EXCLUDED.semantic_class,
        semantic_name = EXCLUDED.semantic_name,
        semantic_description = EXCLUDED.semantic_description,
        is_business = EXCLUDED.is_business,
        tags = EXCLUDED.tags,
        is_active = true,
        updated_at = now();
  END IF;

  PERFORM pg_notify('pgrst', 'reload schema');

  PERFORM app_center.log_semantic_event(
    app_id,
    'semantic_auto_enrich',
    'completed',
    audit_input,
    jsonb_build_object(
      'table', 'app_data.' || final_name,
      'columns_upserted', COALESCE(array_length(touched_columns, 1), 0),
      'semantics_mode', app_semantics_mode
    ),
    NULL
  );

  RETURN 'app_data.' || final_name;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    PERFORM app_center.log_semantic_event(
      app_id,
      'semantic_auto_enrich',
      'failed',
      audit_input,
      jsonb_build_object('table', 'app_data.' || COALESCE(final_name, '')),
      SQLERRM
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION app_center.create_data_app_table(UUID, TEXT, JSONB) TO web_user;
