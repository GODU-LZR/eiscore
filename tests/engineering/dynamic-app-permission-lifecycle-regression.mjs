// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const migrationPath = resolve(root, 'database/migrations/sql/core-017-dynamic-app-permission-lifecycle.sql')
const sql = readFileSync(migrationPath, 'utf8')
const correctivePath = resolve(root, 'database/migrations/sql/core-018-preserve-dynamic-app-acl-state.sql')
const correctiveSql = readFileSync(correctivePath, 'utf8')
const fieldAclPath = resolve(root, 'database/migrations/sql/core-019-scope-dynamic-field-acl.sql')
const fieldAclSql = readFileSync(fieldAclPath, 'utf8')
const effectiveModulePath = resolve(root, 'database/migrations/sql/core-020-dynamic-field-acl-effective-module.sql')
const effectiveModuleSql = readFileSync(effectiveModulePath, 'utf8')
const manifest = JSON.parse(readFileSync(resolve(root, 'database/migrations/core.json'), 'utf8'))
const migration = manifest.migrations.find(({ id }) => id === 'core-017')
const correctiveMigration = manifest.migrations.find(({ id }) => id === 'core-018')
const fieldAclMigration = manifest.migrations.find(({ id }) => id === 'core-019')
const effectiveModuleMigration = manifest.migrations.find(({ id }) => id === 'core-020')

assert.equal(migration?.path, 'database/migrations/sql/core-017-dynamic-app-permission-lifecycle.sql')
assert.equal(migration?.transaction, 'runner')
assert.equal(migration?.rollback?.strategy, 'backup-restore')
assert.equal(migration?.sha256, createHash('sha256').update(readFileSync(migrationPath)).digest('hex'))
assert.equal(correctiveMigration?.path, 'database/migrations/sql/core-018-preserve-dynamic-app-acl-state.sql')
assert.equal(correctiveMigration?.transaction, 'runner')
assert.equal(correctiveMigration?.rollback?.strategy, 'backup-restore')
assert.equal(correctiveMigration?.sha256, createHash('sha256').update(readFileSync(correctivePath)).digest('hex'))
assert.equal(fieldAclMigration?.path, 'database/migrations/sql/core-019-scope-dynamic-field-acl.sql')
assert.equal(fieldAclMigration?.sha256, createHash('sha256').update(readFileSync(fieldAclPath)).digest('hex'))
assert.equal(effectiveModuleMigration?.path, 'database/migrations/sql/core-020-dynamic-field-acl-effective-module.sql')
assert.equal(effectiveModuleMigration?.sha256, createHash('sha256').update(readFileSync(effectiveModulePath)).digest('hex'))
for (const marker of [
  'ADD COLUMN IF NOT EXISTS source_app_id uuid',
  'permissions_source_app_id_fkey',
  'ON DELETE CASCADE',
  'sync_dynamic_app_permissions',
  'cleanup_dynamic_app_permissions',
  'sync_app_permission_lifecycle',
  'tg_apps_permission_lifecycle',
  'operationPermissions',
  'status, source_app_id',
  'lower(coalesce(NEW.status, \'draft\')) = \'archived\''
]) assert.ok(sql.includes(marker), `dynamic app permission lifecycle lost contract marker: ${marker}`)
assert.match(sql, /CREATE TRIGGER tg_apps_permission_lifecycle\s+AFTER INSERT OR UPDATE OR DELETE ON app_center\.apps/)
assert.match(sql, /DELETE FROM public\.permissions\s+WHERE source_app_id = p_app_id/)
assert.match(correctiveSql, /pg_advisory_xact_lock\(lock_key\)/)
assert.match(correctiveSql, /status = 'retired'/)
assert.match(correctiveSql, /prior_status ->> p\.code IN \('disabled', 'retired'\)/)
assert.match(correctiveSql, /cleanup_dynamic_app_permissions\(OLD\.id, module_key\)/)
assert.match(correctiveSql, /app_archive_status text/)
assert.match(correctiveSql, /Move permission codes in place/)
assert.match(fieldAclSql, /ADD COLUMN IF NOT EXISTS source_app_id uuid/)
assert.match(fieldAclSql, /sys_field_acl_source_app_id_fkey/)
assert.match(fieldAclSql, /source_app_id = p_app_id/)
assert.match(fieldAclSql, /CREATE OR REPLACE FUNCTION public\.ensure_field_acl\(module_name text, field_codes text\[\]\)/)
assert.match(effectiveModuleSql, /old_module_key IS DISTINCT FROM module_key/)
assert.match(effectiveModuleSql, /source_app_id = NEW\.id/)
assert.match(effectiveModuleSql, /字段权限更新必须同时提供 can_view 和 can_edit/)
assert.match(effectiveModuleSql, /ON CONFLICT \(role_id, permission_id\) DO NOTHING/)

const adr = readFileSync(resolve(root, 'docs/engineering/adr/0018-dynamic-app-permission-lifecycle.md'), 'utf8')
assert.match(adr, /Status\s+\n\s*Accepted/)
assert.match(adr, /same[\s\S]*transaction as create\/update\/delete/)

console.log('PASS: dynamic App Center permission lifecycle contract')
