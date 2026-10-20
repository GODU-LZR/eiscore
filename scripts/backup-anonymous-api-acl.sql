-- Run with psql -X -At -v ON_ERROR_STOP=1 before core-032, redirect to a
-- chmod-600 SQL file outside the source tree. Emits ACLs only, never row data.
-- Replay that file as postgres to undo only this security change.
WITH scope AS (
  SELECT oid FROM pg_namespace
  WHERE nspname IN ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data', 'company_site')
), creators AS (
  SELECT DISTINCT r.oid, r.rolname FROM pg_roles r
  WHERE r.rolname IN ('postgres', 'eiscore_owner')
    OR r.oid IN (SELECT nspowner FROM pg_namespace WHERE oid IN (SELECT oid FROM scope))
    OR r.oid IN (SELECT relowner FROM pg_class WHERE relnamespace IN (SELECT oid FROM scope))
    OR r.oid IN (SELECT proowner FROM pg_proc WHERE pronamespace IN (SELECT oid FROM scope))
    OR r.oid IN (SELECT defaclrole FROM pg_default_acl WHERE defaclnamespace IN (SELECT oid FROM scope))
), grants AS (
  SELECT a.grantor, a.grantee, a.privilege_type, a.is_grantable,
    format('ON SCHEMA %I', n.nspname) target
  FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
  WHERE n.oid IN (SELECT oid FROM scope) AND n.nspname <> 'public'
  UNION ALL
  SELECT a.grantor, a.grantee, a.privilege_type, a.is_grantable,
    format('ON %s %I.%I', CASE WHEN c.relkind = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, n.nspname, c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE n.oid IN (SELECT oid FROM scope) AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
  UNION ALL
  SELECT a.grantor, a.grantee, a.privilege_type || format(' (%I)', col.attname), a.is_grantable,
    format('ON TABLE %I.%I', n.nspname, c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute col ON col.attrelid = c.oid
  CROSS JOIN LATERAL aclexplode(col.attacl) a
  WHERE n.oid IN (SELECT oid FROM scope) AND col.attnum > 0 AND NOT col.attisdropped
  UNION ALL
  SELECT a.grantor, a.grantee, a.privilege_type, a.is_grantable,
    format('ON FUNCTION %I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
  WHERE n.oid IN (SELECT oid FROM scope) AND p.prokind <> 'p'
), statements AS (
  SELECT 0 ord, 'BEGIN;' sql
  UNION ALL
  SELECT 1, format('SET LOCAL ROLE %I; GRANT %s %s TO %s%s; RESET ROLE;',
    pg_get_userbyid(grantor), privilege_type, target,
    CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantee)) END,
    CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM grants WHERE grantee IN (0, 'web_anon'::regrole)
  UNION ALL
  SELECT 2, format('ALTER DEFAULT PRIVILEGES FOR ROLE %I%s GRANT %s ON %s TO %s%s;',
    pg_get_userbyid(d.defaclrole),
    CASE WHEN d.defaclnamespace = 0 THEN '' ELSE format(' IN SCHEMA %I', n.nspname) END,
    a.privilege_type,
    CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' ELSE 'FUNCTIONS' END,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
    CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole IN (SELECT oid FROM creators)
    AND (d.defaclnamespace IN (SELECT oid FROM scope) OR d.defaclnamespace = 0)
    AND d.defaclobjtype IN ('r', 'S', 'f') AND a.grantee IN (0, 'web_anon'::regrole)
  UNION ALL
  -- No global pg_default_acl row means PostgreSQL's implicit PUBLIC EXECUTE.
  SELECT 2, format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT EXECUTE ON FUNCTIONS TO PUBLIC;', c.rolname)
  FROM creators c WHERE NOT EXISTS (
    SELECT 1 FROM pg_default_acl d WHERE d.defaclrole = c.oid
      AND d.defaclnamespace = 0 AND d.defaclobjtype = 'f'
  )
  UNION ALL
  SELECT 3, 'NOTIFY pgrst, ''reload schema'';'
  UNION ALL
  SELECT 4, 'COMMIT;'
)
SELECT sql FROM statements ORDER BY ord, sql;
