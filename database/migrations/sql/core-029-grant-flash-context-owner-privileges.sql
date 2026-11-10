-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- The legacy Lundu database has application objects owned by postgres while
-- SECURITY DEFINER functions are owned by eiscore_owner. Grant only the
-- read-only metadata access required by flash_agent_context(); do not grant
-- business data or login privileges.

GRANT USAGE ON SCHEMA public, app_center, app_data TO eiscore_owner;
GRANT SELECT ON
  public.users,
  public.user_roles,
  public.roles,
  public.permissions,
  public.sys_field_acl,
  app_center.apps,
  app_center.data_app_table_registry
TO eiscore_owner;

DO $flash_context_registered_tables$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT DISTINCT r.table_name
    FROM app_center.data_app_table_registry r
    JOIN app_center.apps a ON a.id = r.app_id AND a.app_type = 'flash'
    WHERE r.table_schema = 'app_data' AND r.lifecycle = 'managed'
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE app_data.%I TO eiscore_owner', item.table_name);
  END LOOP;
END
$flash_context_registered_tables$;
