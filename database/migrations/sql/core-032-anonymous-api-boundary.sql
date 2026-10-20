-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- Anonymous visitors use the company-site BFF; the only anonymous database
-- entry point is login. Do not depend on every business table having RLS.
DO $anonymous_boundary$
DECLARE
  api_schemas text[] := ARRAY['public', 'hr', 'scm', 'app_center', 'workflow', 'app_data', 'company_site'];
  schema_name text;
  creator_name text;
  column_grant record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid = m.member WHERE r.rolname = 'web_anon'
  ) THEN
    RAISE EXCEPTION 'web_anon must not inherit or assume another database role';
  END IF;

  FOREACH schema_name IN ARRAY api_schemas LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC, web_anon', schema_name);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC, web_anon', schema_name);
    EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC, web_anon', schema_name);
    -- Table REVOKE does not remove an independently granted column privilege.
    FOR column_grant IN
      SELECT c.relname, a.attname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = schema_name AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attacl IS NOT NULL
    LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE %I.%I FROM PUBLIC, web_anon',
        column_grant.attname, schema_name, column_grant.relname);
    END LOOP;
    IF schema_name <> 'public' THEN
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC, web_anon', schema_name);
    END IF;
  END LOOP;

  -- Old bootstrap scripts set postgres defaults; migrated objects belong to
  -- eiscore_owner. Include any other current API object/default-ACL creator.
  FOR creator_name IN
    SELECT DISTINCT r.rolname
    FROM pg_roles r
    WHERE r.rolname IN ('postgres', 'eiscore_owner')
      OR r.oid IN (SELECT nspowner FROM pg_namespace WHERE nspname = ANY(api_schemas))
      OR r.oid IN (SELECT c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ANY(api_schemas))
      OR r.oid IN (SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ANY(api_schemas))
      OR r.oid IN (SELECT d.defaclrole FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace WHERE n.nspname = ANY(api_schemas))
  LOOP
    -- A schema-level REVOKE cannot cancel a global default grant. New RPCs
    -- must explicitly grant web_user/Agent execution, as core-002 intended.
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES FROM PUBLIC, web_anon', creator_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM PUBLIC, web_anon', creator_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, web_anon', creator_name);
    FOREACH schema_name IN ARRAY api_schemas LOOP
      IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC, web_anon', creator_name, schema_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM PUBLIC, web_anon', creator_name, schema_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, web_anon', creator_name, schema_name);
      END IF;
    END LOOP;
  END LOOP;
END
$anonymous_boundary$;

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT EXECUTE ON FUNCTION public.login(text, text), public.login(json) TO web_anon;
NOTIFY pgrst, 'reload schema';
