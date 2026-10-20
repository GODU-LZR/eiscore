-- Read-only assertions, suitable immediately after core-032 and after restore.
DO $anonymous_boundary_check$
DECLARE
  api_schemas text[] := ARRAY['public', 'hr', 'scm', 'app_center', 'workflow', 'app_data', 'company_site'];
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY(api_schemas)
      AND ((c.relkind IN ('r', 'p', 'v', 'm', 'f') AND
        (has_table_privilege('web_anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege('web_anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')))
        OR (c.relkind = 'S' AND has_sequence_privilege('web_anon', c.oid, 'USAGE,SELECT,UPDATE')))
  ) THEN
    RAISE EXCEPTION 'anonymous role retains business table, column or sequence access';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = ANY(api_schemas) AND p.prokind <> 'p'
      AND p.oid NOT IN ('public.login(text,text)'::regprocedure, 'public.login(json)'::regprocedure)
      AND has_function_privilege('web_anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'anonymous role retains a business RPC';
  END IF;
  IF NOT has_schema_privilege('web_anon', 'public', 'USAGE')
    OR NOT has_function_privilege('web_anon', 'public.login(text,text)', 'EXECUTE')
    OR NOT has_function_privilege('web_anon', 'public.login(json)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous login entry points must remain available';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE (n.nspname = ANY(api_schemas) OR d.defaclnamespace = 0)
      AND d.defaclobjtype IN ('r', 'S', 'f')
      AND a.grantee IN (0, 'web_anon'::regrole)
  ) THEN
    RAISE EXCEPTION 'anonymous/PUBLIC default grants could expose future API objects';
  END IF;
END
$anonymous_boundary_check$;
