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
