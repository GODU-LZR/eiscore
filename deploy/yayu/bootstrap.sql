-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
-- Run once after the governed baseline and current migrations, on a NEW database.
-- Supply the four YAYU_* variables to the psql process; never pass credentials
-- as command-line -v values or enable psql/server statement echoing.
\set ON_ERROR_STOP on
\set ECHO none

BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL log_statement = 'none';

SELECT EXISTS (
  SELECT 1 FROM public.system_configs
   WHERE key = 'deployment_identity' AND value ->> 'enterpriseId' = 'yayu'
) AS already_initialized \gset
\if :already_initialized
\echo 'Independent database already initialized; no changes applied.'
ROLLBACK;
\quit
\endif

-- Refuse an existing enterprise database, including any business/demo records.
-- Allow the static core-014 permission catalog and core-007 registrations of
-- the ten empty legacy table definitions shipped in the schema-only baseline.
DO $empty_database$
DECLARE
  relation record;
  contains_rows boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM eiscore_meta.schema_migrations WHERE migration_id = 'core-028'
  ) THEN
    RAISE EXCEPTION 'Apply the governed migrations through core-028 first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app_center.data_app_table_registry r
     WHERE r.table_schema IS DISTINCT FROM 'app_data'
        OR r.app_id IS NOT NULL
        OR r.lifecycle IS DISTINCT FROM 'quarantined'
        OR r.adopted_from IS DISTINCT FROM 'legacy_orphan'
        OR r.created_by IS DISTINCT FROM 'core-007'
        OR r.columns_snapshot IS DISTINCT FROM '[]'::jsonb
        OR r.table_name NOT IN (
          'data_app_17137de9', 'data_app_1f840d3b', 'data_app_3f3cf089',
          'data_app_51d98ca6', 'data_app_6da3f976', 'data_app_6de378ee',
          'data_app_7dd735dd', 'data_app_8966fa75', 'data_app_cd7a8401',
          'data_app_fd3f499a'
        )
  ) THEN
    RAISE EXCEPTION 'Bootstrap rejects non-baseline application table registrations';
  END IF;
  FOR relation IN
    SELECT n.nspname, c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public', 'basic_auth', 'app_center', 'app_data', 'company_site', 'hr', 'scm', 'workflow')
       AND c.relkind IN ('r', 'p')
       AND NOT (n.nspname = 'public' AND c.relname = 'permissions')
       AND NOT (n.nspname = 'app_center' AND c.relname = 'data_app_table_registry')
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)', relation.nspname, relation.relname)
      INTO contains_rows;
    IF contains_rows THEN
      RAISE EXCEPTION 'Bootstrap requires an empty database; %.% contains rows', relation.nspname, relation.relname;
    END IF;
  END LOOP;
END
$empty_database$;

\getenv admin_username YAYU_ADMIN_USERNAME
\getenv admin_password YAYU_ADMIN_PASSWORD
\getenv enterprise_id YAYU_ENTERPRISE_ID
\getenv product_name YAYU_PRODUCT_NAME

CREATE TEMP TABLE yayu_bootstrap_input (
  username text, password text, enterprise_id text, product_name text
) ON COMMIT DROP;
INSERT INTO yayu_bootstrap_input
VALUES (:'admin_username', :'admin_password', :'enterprise_id', :'product_name');
\unset admin_password

DO $bootstrap$
DECLARE
  input pg_temp.yayu_bootstrap_input%ROWTYPE;
  admin_user_id integer;
  admin_role_id uuid;
BEGIN
  SELECT * INTO STRICT input FROM pg_temp.yayu_bootstrap_input;
  IF input.enterprise_id IS DISTINCT FROM 'yayu'
     OR NULLIF(btrim(input.product_name), '') IS NULL
     OR input.username IS NULL OR input.username !~ '^[A-Za-z0-9_.@-]{3,64}$'
     OR input.password IS NULL OR length(input.password) < 24
     OR input.password <> btrim(input.password) THEN
    RAISE EXCEPTION 'Invalid bootstrap identity or credential length';
  END IF;

  INSERT INTO public.roles (code, name, description, sort, status)
  VALUES ('super_admin', '系统管理员', '独立环境初始化', 0, 'active')
  RETURNING id INTO admin_role_id;

  INSERT INTO public.permissions (code, name, module, action, status)
  VALUES
    ('module:home', '模块-工作台', '模块', '进入', 'active'),
    ('module:hr', '模块-人事', '模块', '进入', 'active'),
    ('module:mms', '模块-仓储', '模块', '进入', 'active'),
    ('module:apps', '模块-应用中心', '模块', '进入', 'active'),
    ('module:sales', '模块-销售', '模块', '进入', 'active')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id, status)
  SELECT admin_role_id, p.id, 'active' FROM public.permissions p WHERE p.status = 'active';

  -- The current login RPC compares the supplied password directly. Keep the
  -- independent generated credential private; no reusable default is shipped.
  INSERT INTO public.users (username, password, role, full_name, status, tenant_id)
  VALUES (input.username, input.password, 'super_admin', '系统管理员', 'active', input.enterprise_id)
  RETURNING id INTO admin_user_id;
  INSERT INTO public.user_roles (user_id, role_id) VALUES (admin_user_id, admin_role_id);

  INSERT INTO public.system_configs (key, value, description)
  VALUES
    ('app_settings', jsonb_build_object(
      'title', input.product_name,
      'themeColor', '#409EFF',
      'visibility', jsonb_build_object(
        'hiddenModules', jsonb_build_array('company-site', 'purchase', 'production', 'quality', 'equipment', 'decision'),
        'hiddenApps', '{}'::jsonb
      )
    ), '独立环境展示设置'),
    ('deployment_identity', jsonb_build_object(
      'enterpriseId', input.enterprise_id,
      'bootstrapVersion', 1,
      'adminUserId', admin_user_id,
      'createdAt', clock_timestamp()
    ), '独立空库初始化标记');
END
$bootstrap$;

NOTIFY pgrst, 'reload schema';
COMMIT;
\echo 'Independent database initialized; no business or demo data imported.'
