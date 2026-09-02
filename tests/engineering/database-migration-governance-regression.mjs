// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  loadAndValidateMigrationManifest,
  validateMigrationManifestData
} from '../../scripts/check-database-migrations.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const result = loadAndValidateMigrationManifest({ repoRoot })
assert.deepEqual(result.errors, [])
assert.equal(result.migrations.length, 10)
assert.equal(result.legacySqlCount, 107)
assert.deepEqual(
  result.migrations.map((entry) => entry.id),
  Array.from({ length: 10 }, (_, index) => `runtime-v2-${String(index + 1).padStart(3, '0')}`)
)
assert.deepEqual(result.migrations.slice(0, 2).map((entry) => entry.transaction), ['runner', 'runner'])
assert.ok(result.migrations.slice(2).every((entry) => entry.transaction === 'file'))
assert.ok(result.migrations.every((entry) => entry.rollbackStrategy === 'backup-restore'))

const companySiteResult = loadAndValidateMigrationManifest({
  repoRoot,
  manifestPath: 'database/migrations/company-site.json'
})
assert.deepEqual(companySiteResult.errors, [])
assert.equal(companySiteResult.manifest.name, 'company-site')
assert.equal(companySiteResult.migrations.length, 1)
assert.equal(companySiteResult.migrations[0].id, 'company-site-001')
assert.equal(companySiteResult.migrations[0].rollbackStrategy, 'sql')
assert.equal(
  companySiteResult.migrations[0].rollbackPath,
  'database/migrations/rollback/company-site-001-add-published-snapshot.sql'
)
assert.equal(companySiteResult.legacySqlCount, 0)

const mutate = (callback) => {
  const value = structuredClone(result.manifest)
  callback(value)
  return validateMigrationManifestData(value, { repoRoot }).errors
}

assert.ok(mutate((value) => { value.migrations[1].id = 'runtime-v2-099' })
  .some((error) => error.includes('id must be runtime-v2-002')))
assert.ok(mutate((value) => { value.migrations[1].id = value.migrations[0].id })
  .some((error) => error.includes('duplicate migration id')))
assert.ok(mutate((value) => { value.migrations[0].sha256 = '0'.repeat(64) })
  .some((error) => error.includes('checksum drift')))
assert.ok(mutate((value) => { value.migrations[0].path = '../package.json' })
  .some((error) => error.includes('path must be a file inside the repository')))
assert.ok(mutate((value) => { value.migrations[0].path = 'sql/does-not-exist.sql' })
  .some((error) => error.includes('migration file does not exist')))
assert.ok(mutate((value) => { value.migrations[2].transaction = 'runner' })
  .some((error) => error.includes('must not contain BEGIN/COMMIT')))
assert.ok(mutate((value) => { value.migrations[3].rollback.backupRequired = false })
  .some((error) => error.includes('backup-restore rollback')))
assert.ok(mutate((value) => { value.legacyInventory[2].expectedSqlFiles -= 1 })
  .some((error) => error.includes('inventory drift')))
assert.ok(mutate((value) => { value.postcheck = 'sql/does-not-exist.sql' })
  .some((error) => error.includes('postcheck does not exist')))
assert.ok(mutate((value) => { [value.migrations[0], value.migrations[1]] = [value.migrations[1], value.migrations[0]] })
  .some((error) => error.includes('id must be') || error.includes('differs')))

const ledgerSource = readFileSync(resolve(repoRoot, 'database/migration-ledger.sql'), 'utf8')
for (const column of [
  'migration_id text PRIMARY KEY',
  'checksum_sha256 text NOT NULL',
  'source_path text NOT NULL',
  'rollback_strategy text NOT NULL',
  'release_revision text NOT NULL',
  'applied_by text NOT NULL',
  'backup_evidence text NOT NULL',
  'execution_ms bigint NOT NULL',
  'applied_at timestamptz NOT NULL'
]) {
  assert.ok(ledgerSource.includes(column), column)
}
assert.match(ledgerSource, /REVOKE ALL ON SCHEMA eiscore_meta FROM PUBLIC/)
assert.match(ledgerSource, /REVOKE ALL ON TABLE eiscore_meta\.schema_migrations FROM PUBLIC/)
assert.match(ledgerSource, /ADD COLUMN IF NOT EXISTS backup_evidence text/)
assert.match(ledgerSource, /ALTER COLUMN backup_evidence SET NOT NULL/)

console.log('PASS: database migration ids, order, checksums, transactions, rollback declarations, ledger and legacy inventory')
