// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const migration = readFileSync(resolve(root, 'database/migrations/sql/core-017-dynamic-app-permission-lifecycle.sql'), 'utf8')
const correctiveMigration = readFileSync(resolve(root, 'database/migrations/sql/core-018-preserve-dynamic-app-acl-state.sql'), 'utf8')
const fieldAclMigration = readFileSync(resolve(root, 'database/migrations/sql/core-019-scope-dynamic-field-acl.sql'), 'utf8')
const effectiveModuleMigration = readFileSync(resolve(root, 'database/migrations/sql/core-020-dynamic-field-acl-effective-module.sql'), 'utf8')
const assertions = String.raw`
DO $$
DECLARE
  app_id uuid := gen_random_uuid();
  test_role_id uuid := gen_random_uuid();
  app_module text;
  permission_count integer;
BEGIN
  INSERT INTO app_center.apps (id, name, app_type, status, config)
  VALUES (app_id, 'Lifecycle Test', 'flash', 'draft', '{"ops":{"special_action":true}}'::jsonb);
  SELECT count(*) INTO permission_count FROM public.permissions WHERE source_app_id = app_id;
  IF permission_count <> 13 OR NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE source_app_id = app_id AND code = 'op:app_' || replace(app_id::text, '-', '') || '.special_action'
  ) THEN RAISE EXCEPTION 'create/custom operation sync failed: % rows', permission_count; END IF;
  IF (SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE p.source_app_id = app_id) <> 13 THEN
    RAISE EXCEPTION 'super admin role grants were not created';
  END IF;

  app_module := 'app_' || replace(app_id::text, '-', '');
  PERFORM public.ensure_field_acl(app_module, ARRAY['name']);
  IF NOT EXISTS (SELECT 1 FROM public.sys_field_acl WHERE source_app_id = app_id AND module = app_module AND field_code = 'name') THEN
    RAISE EXCEPTION 'dynamic field ACL ownership was not recorded: module %, app %, matches %, total module rows %',
      app_module, app_id,
      (SELECT count(*) FROM public.sys_field_acl WHERE source_app_id = app_id AND module = app_module AND field_code = 'name'),
      (SELECT count(*) FROM public.sys_field_acl WHERE module = app_module AND field_code = 'name');
  END IF;
  INSERT INTO public.roles (id, code, name, description, sort, status)
  VALUES (test_role_id, 'dynamic_app_test_' || replace(app_id::text, '-', ''), 'Lifecycle Test Role', '', 999, 'active');
  INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, status, source_app_id)
  VALUES (test_role_id, app_module, 'name', true, true, 'created', app_id);
  UPDATE public.sys_field_acl
     SET can_view = false, can_edit = false, status = 'disabled'
   WHERE source_app_id = app_id AND module = app_module AND role_id = test_role_id AND field_code = 'name';
  RAISE NOTICE 'pre rename field acl: %', (SELECT can_view::text || '/' || can_edit::text || '/' || status FROM public.sys_field_acl
    WHERE source_app_id = app_id AND module = app_module AND role_id = test_role_id AND field_code = 'name');
  IF (SELECT can_view OR can_edit OR status <> 'disabled' FROM public.sys_field_acl
       WHERE source_app_id = app_id AND module = app_module AND role_id = test_role_id AND field_code = 'name') THEN
    RAISE EXCEPTION 'field ACL fixture update failed: %',
      (SELECT can_view::text || '/' || can_edit::text || '/' || status FROM public.sys_field_acl
        WHERE source_app_id = app_id AND module = app_module AND role_id = test_role_id AND field_code = 'name');
  END IF;
  INSERT INTO public.sys_field_acl (role_id, module, field_code, can_view, can_edit, status)
  VALUES (test_role_id, app_module, 'shared_static', true, false, 'active');
  INSERT INTO public.role_permissions (role_id, permission_id, status)
  SELECT test_role_id, id, CASE WHEN action = 'edit' THEN 'disabled' ELSE 'active' END
    FROM public.permissions WHERE source_app_id = app_id;
  UPDATE public.permissions SET status = 'disabled'
   WHERE source_app_id = app_id AND code = 'op:' || app_module || '.view';
  UPDATE public.role_permissions rp
     SET status = 'disabled'
    FROM public.permissions p
   WHERE rp.permission_id = p.id AND rp.role_id = test_role_id
     AND p.source_app_id = app_id AND p.code = 'op:' || app_module || '.view';
  PERFORM public.upsert_permissions(jsonb_build_array(jsonb_build_object(
    'code', 'op:' || app_module || '.view',
    'name', 'Lifecycle Test-查看',
    'module', 'Lifecycle Test',
    'action', 'view',
    'roles', jsonb_build_array('dynamic_app_test_' || replace(app_id::text, '-', ''))
  )));
  IF (SELECT status FROM public.permissions WHERE source_app_id = app_id AND code = 'op:' || app_module || '.view') <> 'disabled'
     OR (SELECT rp.status FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = test_role_id AND p.source_app_id = app_id AND p.code = 'op:' || app_module || '.view') <> 'disabled' THEN
    RAISE EXCEPTION 'ACL catalog refresh reactivated a disabled permission or role grant';
  END IF;
  UPDATE public.sys_field_acl
     SET can_view = false, can_edit = false, status = 'disabled'
   WHERE source_app_id = app_id AND module = app_module
     AND role_id = test_role_id AND field_code = 'name';

  -- Frontend normalisation from a missing aclModule to its deterministic
  -- fallback is not a real module rename and must preserve field ACL state.
  UPDATE app_center.apps
     SET config = jsonb_build_object('aclModule', app_module, 'ops', jsonb_build_object('special_action', true))
   WHERE id = app_id;
  IF (SELECT can_view OR can_edit OR status <> 'disabled' FROM public.sys_field_acl
       WHERE source_app_id = app_id AND module = app_module AND role_id = test_role_id AND field_code = 'name') THEN
    RAISE EXCEPTION 'fallback aclModule normalisation changed field ACL state';
  END IF;

  UPDATE app_center.apps SET name = 'Lifecycle Test Renamed' WHERE id = app_id;
  RAISE NOTICE 'after metadata field acl: %', (SELECT can_view::text || '/' || can_edit::text || '/' || status FROM public.sys_field_acl
    WHERE source_app_id = app_id AND module = app_module AND role_id = test_role_id AND field_code = 'name');
  IF (SELECT status FROM public.permissions WHERE source_app_id = app_id AND code = 'op:' || app_module || '.view') <> 'disabled' THEN
    RAISE EXCEPTION 'app metadata update reactivated a manually disabled permission';
  END IF;
  IF (SELECT rp.status FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = test_role_id AND p.source_app_id = app_id AND p.action = 'edit') <> 'disabled' THEN
    RAISE EXCEPTION 'app metadata update changed a role assignment state';
  END IF;

  UPDATE app_center.apps SET config = '{"ops":{"other_action":true}}'::jsonb WHERE id = app_id;
  RAISE NOTICE 'after ops field acl: %', (SELECT can_view::text || '/' || can_edit::text || '/' || status FROM public.sys_field_acl
    WHERE source_app_id = app_id AND module = app_module AND role_id = test_role_id AND field_code = 'name');
  IF EXISTS (SELECT 1 FROM public.permissions WHERE source_app_id = app_id AND code LIKE '%.special_action')
     OR NOT EXISTS (SELECT 1 FROM public.permissions WHERE source_app_id = app_id AND code LIKE '%.other_action') THEN
    RAISE EXCEPTION 'custom operation reconciliation failed';
  END IF;

  UPDATE app_center.apps SET config = '{"aclModule":"lifecycle_renamed","ops":{"other_action":true}}'::jsonb WHERE id = app_id;
  RAISE NOTICE 'post rename field acl: %', (SELECT can_view::text || '/' || can_edit::text || '/' || status FROM public.sys_field_acl
    WHERE source_app_id = app_id AND module = 'lifecycle_renamed' AND role_id = test_role_id AND field_code = 'name');
  IF EXISTS (SELECT 1 FROM public.permissions WHERE source_app_id = app_id
      AND (code = 'app:app_' || replace(app_id::text, '-', '')
        OR code LIKE 'op:app_' || replace(app_id::text, '-', '') || '.%'))
     OR NOT EXISTS (SELECT 1 FROM public.permissions WHERE source_app_id = app_id AND code = 'app:lifecycle_renamed') THEN
    RAISE EXCEPTION 'ACL module rename reconciliation failed';
  END IF;
  IF (SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = test_role_id AND p.source_app_id = app_id) <> 12 THEN
    RAISE EXCEPTION 'ACL module rename discarded role assignments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_field_acl WHERE source_app_id = app_id AND module = 'lifecycle_renamed' AND field_code = 'name') THEN
    RAISE EXCEPTION 'ACL module rename discarded dynamic field ACL: %',
      (SELECT coalesce(string_agg(module || ':' || field_code || ':' || coalesce(source_app_id::text, 'null'), ','), '<none>')
         FROM public.sys_field_acl WHERE role_id = test_role_id);
  END IF;
  IF (SELECT can_view OR can_edit OR status <> 'disabled' FROM public.sys_field_acl
       WHERE source_app_id = app_id AND module = 'lifecycle_renamed' AND role_id = test_role_id AND field_code = 'name') THEN
    RAISE EXCEPTION 'ACL module rename changed field ACL state: %',
      (SELECT can_view::text || '/' || can_edit::text || '/' || status
         FROM public.sys_field_acl WHERE source_app_id = app_id AND module = 'lifecycle_renamed' AND role_id = test_role_id AND field_code = 'name');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_field_acl
       WHERE source_app_id IS NULL AND module = app_module AND field_code = 'shared_static') THEN
    RAISE EXCEPTION 'ACL module rename removed an unowned field ACL row';
  END IF;

  UPDATE app_center.apps SET status = 'archived' WHERE id = app_id;
  IF (SELECT count(*) FROM public.permissions WHERE source_app_id = app_id AND status = 'retired') <> 13 THEN
    RAISE EXCEPTION 'archived app permission definitions were not retired';
  END IF;
  IF (SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = test_role_id AND p.source_app_id = app_id) <> 12 THEN
    RAISE EXCEPTION 'archiving discarded role assignments';
  END IF;
  UPDATE app_center.apps SET status = 'draft' WHERE id = app_id;
  IF (SELECT count(*) FROM public.permissions WHERE source_app_id = app_id) <> 13 THEN
    RAISE EXCEPTION 'unarchived app permissions were not restored';
  END IF;
  IF (SELECT p.status FROM public.permissions p WHERE p.source_app_id = app_id AND p.code = 'op:lifecycle_renamed.view') <> 'disabled' THEN
    RAISE EXCEPTION 'unarchive did not restore the prior disabled permission state';
  END IF;
  IF (SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = test_role_id AND p.source_app_id = app_id) <> 12 THEN
    RAISE EXCEPTION 'unarchive discarded role assignments';
  END IF;
  UPDATE app_center.apps SET status = 'archived' WHERE id = app_id;
  UPDATE app_center.apps
     SET config = '{"aclModule":"lifecycle_archived_rename","ops":{"other_action":true}}'::jsonb
   WHERE id = app_id;
  UPDATE app_center.apps SET status = 'draft' WHERE id = app_id;
  IF (SELECT count(*) FROM public.permissions WHERE source_app_id = app_id AND code LIKE 'app:lifecycle_archived_rename') <> 1
     OR (SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = test_role_id AND p.source_app_id = app_id) <> 12 THEN
    RAISE EXCEPTION 'archived ACL module rename did not preserve permission grants';
  END IF;
  IF (SELECT count(*) FROM public.sys_field_acl WHERE source_app_id = app_id
       AND module = 'lifecycle_archived_rename' AND role_id = test_role_id AND field_code = 'name') <> 1 THEN
    RAISE EXCEPTION 'archived ACL module rename did not preserve field ACL';
  END IF;

  DELETE FROM app_center.apps WHERE id = app_id;
  IF EXISTS (SELECT 1 FROM public.permissions WHERE source_app_id = app_id)
     OR EXISTS (SELECT 1 FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE p.source_app_id = app_id)
     OR EXISTS (SELECT 1 FROM public.sys_field_acl WHERE source_app_id = app_id) THEN
    RAISE EXCEPTION 'app deletion left permission rows or grants';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_field_acl
       WHERE source_app_id IS NULL AND module = app_module AND field_code = 'shared_static') THEN
    RAISE EXCEPTION 'app deletion removed an unowned field ACL row';
  END IF;
  DELETE FROM public.sys_field_acl WHERE role_id = test_role_id AND field_code = 'shared_static';
  DELETE FROM public.roles WHERE id = test_role_id;
END;
$$;
`

const sql = `BEGIN;\n${migration}\n${correctiveMigration}\n${fieldAclMigration}\n${effectiveModuleMigration}\n${assertions}\nROLLBACK;\n`
const result = spawnSync('docker', [
  'exec', '-i', 'eiscore-db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'eiscore'
], { input: sql, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
if (result.error) throw result.error
if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'permission lifecycle database test failed')
process.stdout.write(result.stdout)
process.stdout.write('PASS: dynamic app permission lifecycle transaction rolled back without persistent test rows\n')
