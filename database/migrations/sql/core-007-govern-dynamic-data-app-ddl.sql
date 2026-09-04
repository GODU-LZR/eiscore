-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Govern the only product RPC that performs caller-influenced DDL. Existing
-- dynamic tables are retained, registered and made authenticated-only. The
-- previous implementation remains as an inaccessible compatibility helper so
-- its ontology enrichment behaviour is preserved without exposing its unsafe
-- authorization and ACL choices.

CREATE TABLE app_center.data_app_table_registry (
  table_name text PRIMARY KEY,
  table_schema text NOT NULL DEFAULT 'app_data',
  app_id uuid UNIQUE REFERENCES app_center.apps(id) ON DELETE RESTRICT,
  lifecycle text NOT NULL DEFAULT 'managed',
  columns_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  physical_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  adopted_from text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_app_table_registry_schema_check CHECK (table_schema = 'app_data'),
  CONSTRAINT data_app_table_registry_name_check CHECK (
    table_name ~ '^[a-z][a-z0-9_]*$' AND octet_length(table_name) <= 63
  ),
  CONSTRAINT data_app_table_registry_lifecycle_check CHECK (
    lifecycle IN ('managed', 'quarantined')
  ),
  CONSTRAINT data_app_table_registry_binding_check CHECK (
    (lifecycle = 'managed' AND app_id IS NOT NULL)
    OR (lifecycle = 'quarantined' AND app_id IS NULL)
  ),
  CONSTRAINT data_app_table_registry_columns_check CHECK (
    jsonb_typeof(columns_snapshot) = 'array'
    AND jsonb_typeof(physical_columns) = 'array'
  )
);

CREATE TABLE app_center.data_app_ddl_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES app_center.apps(id) ON DELETE RESTRICT,
  table_schema text NOT NULL,
  table_name text NOT NULL,
  operation text NOT NULL,
  requested_columns jsonb NOT NULL,
  actor text NOT NULL,
  actor_session_role text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_app_ddl_audit_schema_check CHECK (table_schema = 'app_data'),
  CONSTRAINT data_app_ddl_audit_operation_check CHECK (operation IN ('create', 'alter', 'adopt')),
  CONSTRAINT data_app_ddl_audit_columns_check CHECK (jsonb_typeof(requested_columns) = 'array')
);

ALTER TABLE app_center.data_app_table_registry OWNER TO eiscore_owner;
ALTER TABLE app_center.data_app_ddl_audit OWNER TO eiscore_owner;
REVOKE ALL ON TABLE app_center.data_app_table_registry FROM PUBLIC, web_anon, web_user, eiscore_agent;
REVOKE ALL ON TABLE app_center.data_app_ddl_audit FROM PUBLIC, web_anon, web_user, eiscore_agent;
REVOKE ALL ON SEQUENCE app_center.data_app_ddl_audit_id_seq FROM PUBLIC, web_anon, web_user, eiscore_agent;

DO $adopt_existing$
DECLARE
  candidate record;
  matched_app_id uuid;
  matched_count integer;
  binding_source text;
  physical jsonb;
BEGIN
  FOR candidate IN
    SELECT DISTINCT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app_data'
      AND c.relkind IN ('r', 'p')
      AND (
        c.relname LIKE 'data_app\_%' ESCAPE '\'
        OR EXISTS (
          SELECT 1
          FROM app_center.apps a
          CROSS JOIN LATERAL (
            SELECT CASE
              WHEN config_value LIKE 'app_data.%' THEN substring(config_value FROM 10)
              ELSE config_value
            END AS configured_table
            FROM (VALUES (COALESCE(
              NULLIF(trim(a.config ->> 'table_name'), ''),
              NULLIF(trim(a.config ->> 'tableName'), ''),
              NULLIF(trim(a.config ->> 'table'), ''),
              NULLIF(trim(a.config ->> 'data_table'), ''),
              NULLIF(trim(a.config ->> 'dataTable'), '')
            ))) value(config_value)
          ) configured
          WHERE configured.configured_table = c.relname
        )
      )
  LOOP
    matched_app_id := NULL;
    binding_source := 'legacy_orphan';

    SELECT count(*), min(a.id::text)::uuid
      INTO matched_count, matched_app_id
    FROM app_center.apps a
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN config_value LIKE 'app_data.%' THEN substring(config_value FROM 10)
        ELSE config_value
      END AS configured_table
      FROM (VALUES (COALESCE(
        NULLIF(trim(a.config ->> 'table_name'), ''),
        NULLIF(trim(a.config ->> 'tableName'), ''),
        NULLIF(trim(a.config ->> 'table'), ''),
        NULLIF(trim(a.config ->> 'data_table'), ''),
        NULLIF(trim(a.config ->> 'dataTable'), '')
      ))) value(config_value)
    ) configured
    WHERE configured.configured_table = candidate.table_name;

    IF matched_count = 1 THEN
      binding_source := 'app_config';
    ELSE
      SELECT count(*), min(a.id::text)::uuid
        INTO matched_count, matched_app_id
      FROM app_center.apps a
      WHERE 'data_app_' || substring(a.id::text FROM 1 FOR 8) = candidate.table_name;
      IF matched_count = 1 THEN
        binding_source := 'deterministic_name';
      ELSE
        matched_app_id := NULL;
      END IF;
    END IF;

    -- If one legacy app resolves to more than one physical table, keep its
    -- first binding and quarantine every additional table instead of guessing.
    IF matched_app_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM app_center.data_app_table_registry r WHERE r.app_id = matched_app_id
    ) THEN
      matched_app_id := NULL;
      binding_source := 'legacy_orphan';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'field', a.attname,
      'sql_type', format_type(a.atttypid, a.atttypmod)
    ) ORDER BY a.attnum), '[]'::jsonb)
      INTO physical
    FROM pg_attribute a
    WHERE a.attrelid = format('app_data.%I', candidate.table_name)::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped;

    INSERT INTO app_center.data_app_table_registry (
      table_name, app_id, lifecycle, columns_snapshot, physical_columns,
      adopted_from, created_by
    ) VALUES (
      candidate.table_name,
      matched_app_id,
      CASE WHEN matched_app_id IS NULL THEN 'quarantined' ELSE 'managed' END,
      '[]'::jsonb,
      physical,
      binding_source,
      'core-007'
    );

    EXECUTE format('REVOKE ALL ON TABLE app_data.%I FROM PUBLIC, web_anon', candidate.table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_data.%I TO web_user', candidate.table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE app_data.%I TO eiscore_agent', candidate.table_name);
    EXECUTE format('ALTER TABLE app_data.%I ENABLE ROW LEVEL SECURITY', candidate.table_name);
    EXECUTE format('DROP POLICY IF EXISTS dynamic_data_app_web_user ON app_data.%I', candidate.table_name);
    EXECUTE format(
      'CREATE POLICY dynamic_data_app_web_user ON app_data.%I FOR ALL TO web_user USING (true) WITH CHECK (true)',
      candidate.table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS dynamic_data_app_agent ON app_data.%I', candidate.table_name);
    EXECUTE format(
      'CREATE POLICY dynamic_data_app_agent ON app_data.%I FOR ALL TO eiscore_agent USING (session_user = ''eiscore_agent'') WITH CHECK (session_user = ''eiscore_agent'')',
      candidate.table_name
    );
  END LOOP;
END
$adopt_existing$;

ALTER FUNCTION app_center.create_data_app_table(uuid, text, jsonb)
  RENAME TO create_data_app_table_legacy_v1;
ALTER FUNCTION app_center.create_data_app_table_legacy_v1(uuid, text, jsonb)
  OWNER TO eiscore_owner;
ALTER FUNCTION app_center.create_data_app_table_legacy_v1(uuid, text, jsonb)
  SET search_path TO pg_catalog, public, app_center, app_data, pg_temp;
REVOKE ALL ON FUNCTION app_center.create_data_app_table_legacy_v1(uuid, text, jsonb)
  FROM PUBLIC, web_anon, web_user, eiscore_agent;

CREATE FUNCTION app_center.apply_data_app_table_security(target_table text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO pg_catalog, app_center, app_data, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM app_center.data_app_table_registry r
    WHERE r.table_name = target_table
      AND r.table_schema = 'app_data'
      AND r.lifecycle = 'managed'
      AND r.app_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'dynamic data table is not managed: app_data.%', target_table
      USING ERRCODE = '42501';
  END IF;

  EXECUTE format('REVOKE ALL ON TABLE app_data.%I FROM PUBLIC, web_anon', target_table);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_data.%I TO web_user', target_table);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE app_data.%I TO eiscore_agent', target_table);
  EXECUTE format('ALTER TABLE app_data.%I ENABLE ROW LEVEL SECURITY', target_table);
  EXECUTE format('DROP POLICY IF EXISTS dynamic_data_app_web_user ON app_data.%I', target_table);
  EXECUTE format(
    'CREATE POLICY dynamic_data_app_web_user ON app_data.%I FOR ALL TO web_user USING (true) WITH CHECK (true)',
    target_table
  );
  EXECUTE format('DROP POLICY IF EXISTS dynamic_data_app_agent ON app_data.%I', target_table);
  EXECUTE format(
    'CREATE POLICY dynamic_data_app_agent ON app_data.%I FOR ALL TO eiscore_agent USING (session_user = ''eiscore_agent'') WITH CHECK (session_user = ''eiscore_agent'')',
    target_table
  );
END
$function$;

ALTER FUNCTION app_center.apply_data_app_table_security(text) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION app_center.apply_data_app_table_security(text)
  FROM PUBLIC, web_anon, web_user, eiscore_agent;

CREATE FUNCTION app_center.create_data_app_table(app_id uuid, table_name text, columns jsonb) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO pg_catalog, public, app_center, app_data, pg_temp
AS $function$
DECLARE
  requested_app_id alias FOR $1;
  requested_table_name alias FOR $2;
  requested_columns alias FOR $3;
  app_row app_center.apps%ROWTYPE;
  claims jsonb := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  actor text;
  configured_table text;
  bound_table text;
  final_name text;
  default_name text;
  existing_app_id uuid;
  existing_lifecycle text;
  registry_entry_found boolean;
  relation_existed boolean;
  normalized_columns jsonb := COALESCE(requested_columns, '[]'::jsonb);
  column_item jsonb;
  column_name text;
  column_kind text;
  expected_type text;
  actual_type text;
  seen_columns text[] := ARRAY[]::text[];
  physical jsonb;
  operation_name text;
BEGIN
  IF session_user <> 'eiscore_agent'
     AND COALESCE(claims ->> 'app_role', current_setting('request.jwt.claim.app_role', true), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'super_admin or eiscore_agent is required to configure a dynamic data app'
      USING ERRCODE = '42501';
  END IF;

  IF requested_app_id IS NULL THEN
    RAISE EXCEPTION 'app_id is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO app_row FROM app_center.apps a WHERE a.id = requested_app_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'data app does not exist: %', requested_app_id USING ERRCODE = '22023';
  END IF;
  IF app_row.app_type NOT IN ('data', 'flash') THEN
    RAISE EXCEPTION 'app % has unsupported dynamic table type: %', requested_app_id, app_row.app_type
      USING ERRCODE = '22023';
  END IF;

  SELECT r.table_name INTO bound_table
  FROM app_center.data_app_table_registry r
  WHERE r.app_id = requested_app_id;

  configured_table := COALESCE(
    NULLIF(trim(app_row.config ->> 'table_name'), ''),
    NULLIF(trim(app_row.config ->> 'tableName'), ''),
    NULLIF(trim(app_row.config ->> 'table'), ''),
    NULLIF(trim(app_row.config ->> 'data_table'), ''),
    NULLIF(trim(app_row.config ->> 'dataTable'), '')
  );
  IF configured_table LIKE 'app_data.%' THEN
    configured_table := substring(configured_table FROM 10);
  ELSIF configured_table LIKE '%.%' THEN
    RAISE EXCEPTION 'dynamic app config may only target the app_data schema' USING ERRCODE = '22023';
  END IF;

  default_name := 'data_app_' || substring(requested_app_id::text FROM 1 FOR 8);
  final_name := NULLIF(trim(requested_table_name), '');
  IF final_name LIKE 'app_data.%' THEN
    final_name := substring(final_name FROM 10);
  ELSIF final_name LIKE '%.%' THEN
    RAISE EXCEPTION 'dynamic table may only use the app_data schema' USING ERRCODE = '22023';
  END IF;
  final_name := COALESCE(final_name, bound_table, configured_table, default_name);

  IF final_name !~ '^[a-z][a-z0-9_]*$' OR octet_length(final_name) > 63 THEN
    RAISE EXCEPTION 'table_name must be a lowercase SQL identifier of at most 63 bytes'
      USING ERRCODE = '22023';
  END IF;
  IF bound_table IS NOT NULL AND bound_table <> final_name THEN
    RAISE EXCEPTION 'app % is already bound to app_data.%', requested_app_id, bound_table
      USING ERRCODE = '23505';
  END IF;
  IF configured_table IS NOT NULL AND configured_table <> final_name THEN
    RAISE EXCEPTION 'requested table conflicts with the app configuration: app_data.%', configured_table
      USING ERRCODE = '23505';
  END IF;

  IF jsonb_typeof(normalized_columns) <> 'array' OR jsonb_array_length(normalized_columns) > 100 THEN
    RAISE EXCEPTION 'columns must be an array containing at most 100 entries' USING ERRCODE = '22023';
  END IF;

  FOR column_item IN SELECT value FROM jsonb_array_elements(normalized_columns)
  LOOP
    IF jsonb_typeof(column_item) <> 'object' THEN
      RAISE EXCEPTION 'every column descriptor must be an object' USING ERRCODE = '22023';
    END IF;
    column_name := trim(COALESCE(column_item ->> 'field', ''));
    IF column_name !~ '^[a-z][a-z0-9_]*$' OR octet_length(column_name) > 63 THEN
      RAISE EXCEPTION 'column field must be a lowercase SQL identifier of at most 63 bytes'
        USING ERRCODE = '22023';
    END IF;
    IF column_name = ANY (ARRAY['id', 'created_at', 'updated_at', 'properties']) THEN
      RAISE EXCEPTION 'column field is reserved: %', column_name USING ERRCODE = '22023';
    END IF;
    IF column_name = ANY (seen_columns) THEN
      RAISE EXCEPTION 'duplicate column field: %', column_name USING ERRCODE = '22023';
    END IF;
    seen_columns := array_append(seen_columns, column_name);
  END LOOP;

  SELECT r.app_id, r.lifecycle INTO existing_app_id, existing_lifecycle
  FROM app_center.data_app_table_registry r
  WHERE r.table_name = final_name
  FOR UPDATE;
  registry_entry_found := FOUND;

  relation_existed := to_regclass(format('app_data.%I', final_name)) IS NOT NULL;
  IF registry_entry_found THEN
    IF existing_app_id IS NOT NULL AND existing_app_id <> requested_app_id THEN
      RAISE EXCEPTION 'app_data.% is already bound to another app', final_name USING ERRCODE = '23505';
    END IF;
    IF existing_app_id IS NULL AND final_name <> default_name AND final_name IS DISTINCT FROM configured_table THEN
      RAISE EXCEPTION 'quarantined legacy table cannot be claimed without an app config or deterministic name'
        USING ERRCODE = '42501';
    END IF;
    UPDATE app_center.data_app_table_registry AS registry
    SET app_id = requested_app_id,
        lifecycle = 'managed',
        columns_snapshot = normalized_columns,
        adopted_from = CASE WHEN existing_lifecycle = 'quarantined' THEN 'claimed_legacy' ELSE adopted_from END,
        updated_at = now()
    WHERE registry.table_name = final_name;
    operation_name := CASE WHEN existing_lifecycle = 'quarantined' THEN 'adopt' ELSE 'alter' END;
  ELSE
    IF relation_existed THEN
      RAISE EXCEPTION 'existing table app_data.% is outside the dynamic DDL registry', final_name
        USING ERRCODE = '42501';
    END IF;
    INSERT INTO app_center.data_app_table_registry (
      table_name, app_id, lifecycle, columns_snapshot, physical_columns,
      adopted_from, created_by
    ) VALUES (
      final_name, requested_app_id, 'managed', normalized_columns, '[]'::jsonb,
      'create_data_app_table',
      COALESCE(NULLIF(claims ->> 'username', ''), session_user)
    );
    operation_name := 'create';
  END IF;

  PERFORM app_center.create_data_app_table_legacy_v1(requested_app_id, final_name, normalized_columns);

  -- ADD COLUMN IF NOT EXISTS must never conceal an incompatible pre-existing
  -- type. Validate every requested field after the compatibility helper runs;
  -- any mismatch rolls the whole DDL transaction back.
  FOR column_item IN SELECT value FROM jsonb_array_elements(normalized_columns)
  LOOP
    column_name := column_item ->> 'field';
    column_kind := lower(COALESCE(column_item ->> 'type', 'text'));
    expected_type := CASE
      WHEN column_kind IN ('int', 'integer') THEN 'integer'
      WHEN column_kind IN ('number', 'numeric', 'float', 'double') THEN 'numeric'
      WHEN column_kind IN ('bool', 'boolean') THEN 'boolean'
      WHEN column_kind = 'date' THEN 'date'
      WHEN column_kind IN ('datetime', 'timestamp', 'timestamptz') THEN 'timestamp with time zone'
      ELSE 'text'
    END;
    SELECT format_type(a.atttypid, a.atttypmod) INTO actual_type
    FROM pg_attribute a
    WHERE a.attrelid = format('app_data.%I', final_name)::regclass
      AND a.attname = column_name
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF actual_type IS DISTINCT FROM expected_type THEN
      RAISE EXCEPTION 'column type conflict for app_data.%.%: expected %, found %',
        final_name, column_name, expected_type, COALESCE(actual_type, '<missing>')
        USING ERRCODE = '42804';
    END IF;
  END LOOP;

  PERFORM app_center.apply_data_app_table_security(final_name);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'field', a.attname,
    'sql_type', format_type(a.atttypid, a.atttypmod)
  ) ORDER BY a.attnum), '[]'::jsonb)
    INTO physical
  FROM pg_attribute a
  WHERE a.attrelid = format('app_data.%I', final_name)::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  UPDATE app_center.data_app_table_registry AS registry
  SET physical_columns = physical,
      updated_at = now()
  WHERE registry.table_name = final_name;

  UPDATE app_center.apps
  SET config = (COALESCE(config, '{}'::jsonb)
      - 'table_name' - 'tableName' - 'data_table' - 'dataTable')
      || jsonb_build_object('table', 'app_data.' || final_name),
      updated_by = COALESCE(NULLIF(claims ->> 'username', ''), session_user),
      updated_at = now()
  WHERE id = requested_app_id;

  actor := COALESCE(NULLIF(claims ->> 'username', ''), session_user);
  INSERT INTO app_center.data_app_ddl_audit (
    app_id, table_schema, table_name, operation, requested_columns,
    actor, actor_session_role
  ) VALUES (
    requested_app_id, 'app_data', final_name, operation_name,
    normalized_columns, actor, session_user
  );

  RETURN 'app_data.' || final_name;
END
$function$;

ALTER FUNCTION app_center.create_data_app_table(uuid, text, jsonb) OWNER TO eiscore_owner;
REVOKE ALL ON FUNCTION app_center.create_data_app_table(uuid, text, jsonb)
  FROM PUBLIC, web_anon;
GRANT EXECUTE ON FUNCTION app_center.create_data_app_table(uuid, text, jsonb)
  TO web_user, eiscore_agent;

COMMENT ON TABLE app_center.data_app_table_registry IS
  'Recovery-grade one-app/one-table inventory for dynamic app_data DDL; unbound legacy tables stay quarantined';
COMMENT ON TABLE app_center.data_app_ddl_audit IS
  'Successful governed dynamic DDL operations; rejected attempts remain visible in PostgreSQL error logs';
COMMENT ON FUNCTION app_center.create_data_app_table(uuid, text, jsonb) IS
  'Governed dynamic data-app DDL: super_admin/eiscore_agent only, registered binding, validated identifiers and authenticated-only RLS';
