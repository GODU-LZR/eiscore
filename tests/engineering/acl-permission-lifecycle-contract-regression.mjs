// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Offline migration contract; runtime application is verified separately.
const root = resolve(import.meta.dirname, '../..')
const migrationPath = resolve(root, 'database/migrations/sql/core-013-acl-lifecycle-and-dynamic-matrices.sql')
const sql = readFileSync(migrationPath, 'utf8')
const coreManifest = readFileSync(resolve(root, 'database/migrations/core.json'), 'utf8')
const ontologyRoleFunction = sql.match(/CREATE OR REPLACE FUNCTION public\.ontology_current_role_codes\(\)[\s\S]*?\$\$;/)?.[0] || ''
const childLifecycleFunction = sql.match(/CREATE OR REPLACE FUNCTION public\.enforce_role_acl_child_lifecycle\(\)[\s\S]*?\$\$;/)?.[0] || ''

const coreMigrations = JSON.parse(coreManifest).migrations
const aclMigration = coreMigrations.find(({ id }) => id === 'core-013')
assert.equal(aclMigration?.path, 'database/migrations/sql/core-013-acl-lifecycle-and-dynamic-matrices.sql')
assert.equal(aclMigration?.sha256, 'e1d8d6fb96a3ef79b0eabe40f0d338b32f435dedf62bd0edf90772cb9c718c7a')
assert.equal(aclMigration?.transaction, 'runner')
assert.equal(aclMigration?.rollback?.strategy, 'backup-restore')

for (const marker of [
  'ALTER TABLE public.roles',
  'ADD COLUMN IF NOT EXISTS status text',
  "CHECK (status IN ('created', 'active', 'locked', 'disabled'))",
  'ALTER TABLE public.permissions',
  "CHECK (status IN ('active', 'disabled', 'retired'))",
  'ALTER TABLE public.role_permissions',
  'ADD COLUMN IF NOT EXISTS updated_at timestamptz',
  'ALTER TABLE public.role_data_scopes',
  'ALTER TABLE public.sys_field_acl',
  'enforce_role_acl_lifecycle',
  'tg_roles_acl_lifecycle',
  'enforce_role_acl_child_lifecycle',
  'tg_role_permissions_acl_lifecycle',
  'tg_role_data_scopes_acl_lifecycle',
  'tg_sys_field_acl_lifecycle',
  'enforce_role_user_assignment_lifecycle',
  'tg_user_roles_acl_lifecycle',
  'v_roles_manage',
  'v_role_permissions_matrix',
  'v_role_data_scopes_matrix',
  'v_app_form_ontology',
  "coalesce(status, '') <> 'archived'",
  'assignment_created_at',
  'scope_updated_at',
  'OLD.role_id',
  'tg_v_role_permissions_matrix_update',
  'tg_v_role_data_scopes_matrix_update',
  'upsert_field_acl(payload jsonb)',
  'upsert_permissions(payload jsonb)',
  'apply_role_permission_templates()',
  '锁定角色不可变更权限'
]) assert.ok(sql.includes(marker), `ACL migration lost contract marker: ${marker}`)

assert.doesNotMatch(sql, /app_type\s*=\s*'data'/i,
  'dynamic scope matrix must not silently drop workflow/custom/flash apps')
assert.match(sql, /Existing roles and grants remain active/)
assert.match(sql, /CREATE OR REPLACE VIEW public\.v_role_permissions AS[\s\S]*FILTER \(WHERE r\.status IN \('active', 'locked'\)/)
assert.match(sql, /CREATE OR REPLACE VIEW public\.v_roles_manage AS\s+SELECT id, code, name, description, sort, created_at, updated_at, status\s+FROM public\.roles/)
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.tg_v_roles_manage_update\(\)[\s\S]*status = COALESCE\(NEW\.status, OLD\.status\)/)
assert.match(sql, /CREATE OR REPLACE VIEW public\.v_role_data_scopes_matrix AS[\s\S]*UNION[\s\S]*v_app_form_ontology/)
assert.match(sql, /v_app_form_ontology[\s\S]*coalesce\(status, ''\) <> 'archived'/)
assert.match(sql, /CREATE TRIGGER tg_role_permissions_updated_at[\s\S]*touch_updated_at/)
assert.match(sql, /CREATE TRIGGER tg_user_roles_acl_lifecycle[\s\S]*ON public\.user_roles/)
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.upsert_permissions\(payload jsonb\)[\s\S]*SECURITY DEFINER[\s\S]*锁定角色不可变更权限/)
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.apply_role_permission_templates\(\)[\s\S]*SECURITY DEFINER[\s\S]*锁定角色不可应用权限模板/)
assert.ok(childLifecycleFunction, 'ACL child lifecycle function must be present')
assert.match(childLifecycleFunction, /prior_status := CASE WHEN TG_OP = 'UPDATE'/)
assert.match(sql, /GRANT SELECT, UPDATE ON public\.v_role_data_scopes_matrix TO web_user/)
assert.match(sql, /ON CONFLICT \(role_id, module, field_code\) DO UPDATE[\s\S]*status = 'active'[\s\S]*updated_at = clock_timestamp\(\)/)
assert.match(sql, /ON CONFLICT \(code\) DO UPDATE[\s\S]*status = 'active'[\s\S]*updated_at = clock_timestamp\(\)/)
assert.match(sql, /role_bind AS \([\s\S]*ON CONFLICT \(role_id, permission_id\) DO UPDATE[\s\S]*status = 'active'[\s\S]*updated_at = clock_timestamp\(\)/)
assert.match(sql, /s1 AS \([\s\S]*ON CONFLICT \(role_id, permission_id\) DO UPDATE[\s\S]*status = 'active'[\s\S]*updated_at = clock_timestamp\(\)/)
assert.match(sql, /v_role_permissions_matrix[\s\S]*rp\.status, 'active'\) IN \('active', 'locked'\)/)
assert.match(sql, /document_current_permissions[\s\S]*rp\.status IN \('active', 'locked'\)/)
assert.match(sql, /ontology_current_permissions[\s\S]*rp\.status IN \('active', 'locked'\)/)
assert.match(sql, /document_current_permissions[\s\S]*JOIN public\.permissions p ON p\.code = item\.permission_code[\s\S]*p\.status = 'active'/)
assert.match(sql, /ontology_current_permissions[\s\S]*JOIN public\.permissions p ON p\.code = item\.permission_code[\s\S]*p\.status = 'active'/)
assert.ok(ontologyRoleFunction, 'ontology role function must be present')
assert.doesNotMatch(ontologyRoleFunction, /document_current_username\(\)/)
assert.match(sql, /document_current_permissions[\s\S]*join public\.permissions p on p\.code = permission_values\.permission_code[\s\S]*p\.status = ''active''/)
assert.match(sql, /ontology_current_permissions[\s\S]*join public\.permissions p on p\.code = permission_values\.permission_code[\s\S]*p\.status = ''active''/)
assert.match(sql, /can_access_employee[\s\S]*scope_row\.status IN \('active', 'locked'\)/)
assert.match(sql, /ensure_field_acl\(module_name text, field_codes text\[\]\)[\s\S]*r\.status IN \('created', 'active'\)/)

console.log('PASS: ACL lifecycle migration contract is additive, auditable, dynamic-module aware, and offline-only')
