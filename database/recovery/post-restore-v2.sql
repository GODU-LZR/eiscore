-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- pg_dump restores extension members by recreating the extension as the
-- restore operator. Reapply the v2 function-owner invariant before contract
-- verification without replaying an already-ledgered migration.

DO $$
DECLARE
  function_row record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eiscore_owner') THEN
    RAISE EXCEPTION 'eiscore_owner is required before post-restore normalization';
  END IF;

  FOR function_row IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments,
           p.prokind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner_role ON owner_role.oid = p.proowner
    WHERE n.nspname IN ('public', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow')
      AND owner_role.rolname <> 'eiscore_owner'
  LOOP
    EXECUTE format(
      'ALTER %s %I.%I(%s) OWNER TO eiscore_owner',
      CASE WHEN function_row.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
      function_row.schema_name,
      function_row.function_name,
      function_row.arguments
    );
  END LOOP;
END
$$;

-- PostgreSQL restores identity-sequence ACLs after relation ownership and can
-- materialize only USAGE for the new owner even though a fresh core-007
-- install exposes the owner's canonical SELECT/UPDATE/USAGE ACL. Normalize
-- that archive-order difference before catalog comparison.
DO $$
BEGIN
  IF to_regclass('app_center.data_app_ddl_audit_id_seq') IS NOT NULL THEN
    GRANT ALL PRIVILEGES ON SEQUENCE app_center.data_app_ddl_audit_id_seq TO eiscore_owner;
  END IF;
END
$$;

-- pg_restore can omit a dependent asset foreign key when its archive order
-- was produced before the document-assets relation was present.  The v1
-- baseline and current runtime catalog require these links, so restore them
-- idempotently before contract verification.  A data violation intentionally
-- fails recovery instead of weakening the relationship.
DO $$
DECLARE
  foreign_key record;
BEGIN
  FOR foreign_key IN
    SELECT * FROM (VALUES
      ('document_business_links', 'document_business_links_asset_id_fkey'),
      ('document_classification_results', 'document_classification_results_asset_id_fkey'),
      ('document_entry_plans', 'document_entry_plans_asset_id_fkey'),
      ('document_parse_jobs', 'document_parse_jobs_asset_id_fkey'),
      ('document_parse_results', 'document_parse_results_asset_id_fkey')
    ) AS required(table_name, constraint_name)
  LOOP
    IF to_regclass(format('public.%I', foreign_key.table_name)) IS NOT NULL
       AND to_regclass('public.document_assets') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM pg_constraint constraint_row
         JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
         JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
         WHERE schema_row.nspname = 'public'
           AND table_row.relname = foreign_key.table_name
           AND constraint_row.conname = foreign_key.constraint_name
       ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (asset_id) REFERENCES public.document_assets(id) ON DELETE CASCADE',
        foreign_key.table_name, foreign_key.constraint_name
      );
    END IF;
  END LOOP;
END
$$;
