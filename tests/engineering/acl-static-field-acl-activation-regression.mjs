// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const sqlPath = resolve(root, 'database/migrations/sql/core-024-activate-static-field-acl.sql')
const sql = readFileSync(sqlPath, 'utf8')
const manifest = JSON.parse(readFileSync(resolve(root, 'database/migrations/core.json'), 'utf8'))
const migration = manifest.migrations.find(({ id }) => id === 'core-024')

assert.equal(migration?.path, 'database/migrations/sql/core-024-activate-static-field-acl.sql')
assert.equal(migration?.sha256, createHash('sha256').update(sql).digest('hex'))
assert.equal(migration?.transaction, 'runner')
assert.equal(migration?.rollback?.strategy, 'backup-restore')
assert.match(sql, /acl\.source_app_id IS NULL/)
assert.match(sql, /acl\.status = 'created'/)
assert.match(sql, /acl\.can_view IS TRUE/)
assert.match(sql, /role\.status IN \('active', 'locked'\)/)
assert.match(sql, /SET status = 'active'/)
assert.match(sql, /updated_at = clock_timestamp\(\)/)
assert.doesNotMatch(sql, /ALTER TABLE[\s\S]*DEFAULT 'active'/)
assert.doesNotMatch(sql, /can_edit\s*=/)

console.log('PASS: static field ACL activation is scoped and preserves pending/new-field lifecycle')
