// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const migrationPath = resolve(root, 'database/migrations/sql/core-021-acl-lifecycle-correction.sql')
const sql = readFileSync(migrationPath, 'utf8')
const manifest = JSON.parse(readFileSync(resolve(root, 'database/migrations/core.json'), 'utf8'))
const migration = manifest.migrations.find(({ id }) => id === 'core-021')
const sha256 = createHash('sha256').update(sql).digest('hex')

assert.equal(migration?.path, 'database/migrations/sql/core-021-acl-lifecycle-correction.sql')
assert.equal(migration?.sha256, sha256)
assert.equal(migration?.transaction, 'runner')
assert.equal(migration?.rollback?.strategy, 'backup-restore')

for (const table of ['role_permissions', 'role_data_scopes', 'sys_field_acl']) {
  assert.match(sql, new RegExp(`ALTER TABLE public\\.${table}[\\s\\S]*ALTER COLUMN status SET DEFAULT 'created'`))
}
assert.match(sql, /tg_v_role_permissions_matrix_update[\s\S]*VALUES \(OLD\.role_id, OLD\.permission_id, 'created'\)/)
assert.match(sql, /tg_v_role_data_scopes_matrix_update[\s\S]*coalesce\(nullif\(lower\(btrim\(NEW\.scope_status\)\), ''\), 'created'\)/)
assert.match(sql, /upsert_field_acl[\s\S]*INSERT INTO public\.sys_field_acl[\s\S]*'created'[\s\S]*ON CONFLICT[\s\S]*updated_at = clock_timestamp\(\)/)
assert.doesNotMatch(sql, /upsert_field_acl[\s\S]*SET[\s\S]*status = 'active'/)
assert.match(sql, /upsert_permissions[\s\S]*INSERT INTO public\.role_permissions[\s\S]*'created'[\s\S]*ON CONFLICT \(role_id, permission_id\) DO NOTHING/)
assert.match(sql, /upsert_permissions[\s\S]*ON CONFLICT \(code\) DO UPDATE SET name = excluded\.name,[\s\S]*updated_at = clock_timestamp\(\)/)
assert.doesNotMatch(sql, /upsert_permissions[\s\S]*status = 'active'/)
assert.match(sql, /sync_dynamic_app_permissions[\s\S]*SELECT super_admin_id, id, 'created'[\s\S]*ON CONFLICT \(role_id, permission_id\) DO NOTHING/)

console.log('PASS: ACL correction preserves lifecycle states and creates new rows as created')
