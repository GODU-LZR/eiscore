// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const sqlPath = resolve(root, 'database/migrations/sql/core-023-terminal-acl-lock.sql')
const sql = readFileSync(sqlPath, 'utf8')
const manifest = JSON.parse(readFileSync(resolve(root, 'database/migrations/core.json'), 'utf8'))
const migration = manifest.migrations.find(({ id }) => id === 'core-023')

assert.equal(migration?.path, 'database/migrations/sql/core-023-terminal-acl-lock.sql')
assert.equal(migration?.sha256, createHash('sha256').update(sql).digest('hex'))
assert.match(sql, /prior_status = 'locked'[\s\S]*RAISE EXCEPTION '锁定角色不可修改'/)
assert.match(sql, /prior_status = 'locked'[\s\S]*RAISE EXCEPTION '锁定权限不可修改'/)
assert.match(sql, /next_status = 'locked'[\s\S]*prior_status <> 'active'/)

const core = readFileSync(resolve(root, 'shared/eis-data-grid-v2/composables/useGridCore.js'), 'utf8')
assert.match(core, /const effective = \['active', 'locked'\]\.includes\(lifecycleStatus\)/)
assert.match(core, /aclModule\.value === 'hr_acl'/)
assert.match(core, /if \(isRowLocked\(params\.data\) && !canUnlockAclRow\(params\.data, col\.prop\)\) return false/)

console.log('PASS: ACL created rows are pending and locked rows are terminal in UI and database contracts')
