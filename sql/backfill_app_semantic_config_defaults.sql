-- Backfill missing semantic/permission config for historical app_center.apps rows.
-- Rule:
--   permission_mode -> compat (if missing)
--   semantics_mode  -> ai_defined (if missing), except ontology_workbench -> none

BEGIN;

WITH current_config AS (
  SELECT
    id,
    COALESCE(config, '{}'::jsonb) AS cfg,
    NULLIF(TRIM(COALESCE(config ->> 'permission_mode', '')), '') AS permission_mode,
    NULLIF(TRIM(COALESCE(config ->> 'semantics_mode', '')), '') AS semantics_mode,
    NULLIF(TRIM(COALESCE(config ->> 'systemApp', '')), '') AS system_app
  FROM app_center.apps
),
patched AS (
  SELECT
    id,
    jsonb_set(
      jsonb_set(
        cfg,
        '{permission_mode}',
        to_jsonb(COALESCE(permission_mode, 'compat'::text)),
        true
      ),
      '{semantics_mode}',
      to_jsonb(
        COALESCE(
          semantics_mode,
          CASE
            WHEN system_app = 'ontology_workbench' THEN 'none'
            ELSE 'ai_defined'
          END
        )
      ),
      true
    ) AS new_config
  FROM current_config
  WHERE permission_mode IS NULL OR semantics_mode IS NULL
)
UPDATE app_center.apps AS a
SET config = p.new_config,
    updated_at = now()
FROM patched AS p
WHERE a.id = p.id;

COMMIT;

-- Validation:
SELECT
  COUNT(*) AS total_apps,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(config ->> 'permission_mode', '')), '') IS NULL) AS missing_permission_mode,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(config ->> 'semantics_mode', '')), '') IS NULL) AS missing_semantics_mode
FROM app_center.apps;
