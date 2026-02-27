-- Backfill column-level ontology semantics for all active ontology tables.
-- Safety:
-- 1) Only writes public.ontology_column_semantics
-- 2) Does NOT modify permissions / roles / RLS / auth logic

BEGIN;

WITH active_tables AS (
  SELECT
    s.table_schema,
    s.table_name,
    COALESCE(NULLIF(TRIM(s.semantic_name), ''), s.table_name) AS table_semantic_name,
    COALESCE(s.tags, '[]'::jsonb) AS table_tags
  FROM public.ontology_table_semantics s
  JOIN information_schema.tables t
    ON t.table_schema = s.table_schema
   AND t.table_name = s.table_name
   AND t.table_type = 'BASE TABLE'
  WHERE s.is_active = true
),
active_tables_with_mode AS (
  SELECT
    at.table_schema,
    at.table_name,
    at.table_semantic_name,
    COALESCE(
      (
        SELECT elem
        FROM jsonb_array_elements_text(at.table_tags) AS elem
        WHERE elem LIKE 'semantics:%'
        LIMIT 1
      ),
      CASE
        WHEN at.table_schema = 'app_data' THEN 'semantics:ai_defined'
        ELSE 'semantics:creator_defined'
      END
    ) AS semantics_tag
  FROM active_tables at
),
column_source AS (
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    t.table_semantic_name,
    t.semantics_tag,
    CASE
      WHEN c.column_name ~* '(status|state|type|category|level|mode|kind)$' THEN 'enum_attribute'
      WHEN c.column_name ~* '(parent|tree|path|dept|org|hierarch)' THEN 'hierarchy_attribute'
      WHEN c.column_name ~* '(lng|lat|longitude|latitude|geo|location|address)' THEN 'geo_attribute'
      WHEN c.column_name ~* '(file|attachment|image|avatar|photo|document|xml|bpmn)' THEN 'file_attribute'
      WHEN c.column_name ~* '(amount|qty|quantity|total|score|rate|percent|ratio|count|num|index)$' THEN 'derived_metric'
      ELSE 'business_attribute'
    END AS semantic_class,
    CASE
      WHEN c.column_name = 'id' THEN U&'\4E3B\952E\6807\8BC6'
      WHEN c.column_name = 'created_at' THEN U&'\521B\5EFA\65F6\95F4'
      WHEN c.column_name = 'updated_at' THEN U&'\66F4\65B0\65F6\95F4'
      WHEN c.column_name = 'created_by' THEN U&'\521B\5EFA\4EBA'
      WHEN c.column_name = 'updated_by' THEN U&'\66F4\65B0\4EBA'
      WHEN c.column_name = 'deleted_at' THEN U&'\5220\9664\65F6\95F4'
      WHEN c.column_name = 'deleted_by' THEN U&'\5220\9664\4EBA'
      WHEN c.column_name = 'dept_id' THEN U&'\90E8\95E8\6807\8BC6'
      WHEN c.column_name = 'user_id' THEN U&'\7528\6237\6807\8BC6'
      WHEN c.column_name = 'role_id' THEN U&'\89D2\8272\6807\8BC6'
      WHEN c.column_name = 'permission_id' THEN U&'\6743\9650\70B9\6807\8BC6'
      WHEN c.column_name = 'workflow_instance_id' THEN U&'\6D41\7A0B\5B9E\4F8B\6807\8BC6'
      WHEN c.column_name ~* '_id$' THEN c.column_name || U&'\FF08\5173\8054\6807\8BC6\FF09'
      ELSE c.column_name
    END AS semantic_name,
    CASE
      WHEN c.udt_name IN ('json', 'jsonb') THEN 'json'
      WHEN c.data_type IN ('timestamp without time zone', 'timestamp with time zone') THEN 'datetime'
      WHEN c.data_type = 'date' THEN 'date'
      WHEN c.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision', 'decimal') THEN 'number'
      WHEN c.data_type = 'boolean' THEN 'boolean'
      ELSE 'text'
    END AS ui_type,
    (
      c.column_name ~* '(phone|mobile|email|idcard|id_no|identity|bank|account|salary|wage|address|token|secret|password|credential|birthday|birth|contact|wechat|qq)'
    ) AS is_sensitive
  FROM information_schema.columns c
  JOIN active_tables_with_mode t
    ON t.table_schema = c.table_schema
   AND t.table_name = c.table_name
),
upserted AS (
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
  SELECT
    cs.table_schema,
    cs.table_name,
    cs.column_name,
    cs.semantic_class,
    cs.semantic_name,
    format(U&'\0025\0073 \5B57\6BB5\201C\0025\0073\201D\8BED\4E49\81EA\52A8\56DE\586B', cs.table_schema || '.' || cs.table_name, cs.semantic_name),
    cs.data_type,
    cs.ui_type,
    cs.is_sensitive,
    'history_backfill',
    jsonb_build_array(
      'ontology_backfill',
      'column',
      cs.semantic_class,
      cs.semantics_tag,
      cs.table_schema || '.' || cs.table_name
    ),
    true,
    now()
  FROM column_source cs
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
      updated_at = now()
  RETURNING table_schema, table_name, column_name
)
SELECT count(*) AS upserted_rows FROM upserted;

-- Mark stale semantics as inactive for active ontology tables.
WITH active_tables AS (
  SELECT
    s.table_schema,
    s.table_name
  FROM public.ontology_table_semantics s
  JOIN information_schema.tables t
    ON t.table_schema = s.table_schema
   AND t.table_name = s.table_name
   AND t.table_type = 'BASE TABLE'
  WHERE s.is_active = true
)
UPDATE public.ontology_column_semantics ocs
SET is_active = false,
    updated_at = now()
WHERE (ocs.table_schema, ocs.table_name) IN (
    SELECT table_schema, table_name FROM active_tables
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = ocs.table_schema
      AND c.table_name = ocs.table_name
      AND c.column_name = ocs.column_name
  );

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

-- Validation summary
SELECT
  COUNT(*) FILTER (WHERE is_active = true) AS active_column_semantics,
  COUNT(DISTINCT table_schema || '.' || table_name) FILTER (WHERE is_active = true) AS active_tables_with_semantics
FROM public.ontology_column_semantics;
