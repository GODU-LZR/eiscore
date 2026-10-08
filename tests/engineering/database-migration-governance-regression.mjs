// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  loadAndValidateMigrationManifest,
  validateMigrationManifestData
} from '../../scripts/check-database-migrations.mjs'
import { readPublishedDb6 } from '../../scripts/database-release-test-history.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const result = loadAndValidateMigrationManifest({ repoRoot })
assert.deepEqual(result.errors, [])
assert.equal(result.migrations.length, 10)
assert.equal(result.legacySqlCount, 106)
assert.deepEqual(
  result.migrations.map((entry) => entry.id),
  Array.from({ length: 10 }, (_, index) => `runtime-v2-${String(index + 1).padStart(3, '0')}`)
)
assert.deepEqual(result.migrations.slice(0, 2).map((entry) => entry.transaction), ['runner', 'runner'])
assert.ok(result.migrations.slice(2).every((entry) => entry.transaction === 'file'))
assert.ok(result.migrations.every((entry) => entry.rollbackStrategy === 'backup-restore'))
for (const migration of result.migrations) {
  assert.equal(migration.lockTimeoutMs, 10_000)
  assert.equal(migration.statementTimeoutMs, 300_000)
  assert.equal(migration.idleTransactionTimeoutMs, 60_000)
}

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

const coreResult = loadAndValidateMigrationManifest({
  repoRoot,
  manifestPath: 'database/migrations/core.json'
})
assert.deepEqual(coreResult.errors, [])
assert.equal(coreResult.manifest.name, 'core')
assert.equal(coreResult.migrations.length, 11)
assert.deepEqual(coreResult.migrations.map((entry) => entry.id), [
  'core-001', 'core-002', 'core-003', 'core-004', 'core-005', 'core-006', 'core-007', 'core-008', 'core-009', 'core-010', 'core-011'
])

// Rehashing a rewritten published migration must not make governance pass.
const portable = (text) => text.replaceAll('\r\n', '\n')
for (const path of ['database/migrations/runtime-v2.json', 'database/migrations/company-site.json', 'database/migrations/core.json']) {
  const published = JSON.parse(readPublishedDb6(path))
  const current = JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'))
  for (const migration of published.migrations) {
    const actual = current.migrations.find(({ id }) => id === migration.id)
    assert.equal(actual?.sha256, migration.sha256, `published checksum changed: ${migration.id}`)
    assert.equal(actual?.path, migration.path, `published migration moved: ${migration.id}`)
    assert.equal(portable(readFileSync(resolve(repoRoot, migration.path), 'utf8')),
      portable(readPublishedDb6(migration.path)), `published SQL changed: ${migration.id}`)
  }
}
for (const path of ['manifest.json', 'register.sql', 'schema.sql', 'object-catalog.json']) {
  const baselinePath = `database/baselines/eiscore-db-v1/${path}`
  assert.equal(portable(readFileSync(resolve(repoRoot, baselinePath), 'utf8')),
    portable(readPublishedDb6(baselinePath)), `published baseline changed: ${path}`)
}
assert.ok(coreResult.migrations.every((entry) => entry.rollbackStrategy === 'backup-restore'))
const core009Sql = readFileSync(resolve(repoRoot, 'database/migrations/sql/core-009-retire-legacy-twin-model.sql'), 'utf8')
const corePostcheckSql = readFileSync(resolve(repoRoot, 'database/migrations/postchecks/core.sql'), 'utf8')
for (const marker of [
  "UPDATE app_data.twin_sessions",
  "SET model = 'deepseek-harness'",
  'twin_sessions_harness_model_check'
]) assert.ok(core009Sql.includes(marker), `core-009 lost Harness model guard: ${marker}`)
for (const marker of [
  'digital twin sessions must default to DeepSeek Harness',
  'digital twin sessions contain a retired model marker'
]) assert.ok(corePostcheckSql.includes(marker), `core postcheck lost Harness model guard: ${marker}`)
assert.ok([...result.migrations, ...companySiteResult.migrations, ...coreResult.migrations]
  .every((entry) => Number.isInteger(entry.lockTimeoutMs)
    && Number.isInteger(entry.statementTimeoutMs)
    && Number.isInteger(entry.idleTransactionTimeoutMs)))

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
assert.ok(mutate((value) => { delete value.migrations[0].lockTimeoutMs })
  .some((error) => error.includes('lockTimeoutMs')))
assert.ok(mutate((value) => { value.migrations[0].statementTimeoutMs = 0 })
  .some((error) => error.includes('statementTimeoutMs')))
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
for (const marker of [
  'CREATE TABLE IF NOT EXISTS eiscore_meta.database_baselines',
  'baseline_fingerprint_sha256 text NOT NULL',
  'schema_sha256 text NOT NULL',
  'object_catalog_sha256 text NOT NULL',
  'CREATE TABLE IF NOT EXISTS eiscore_meta.baseline_migration_coverage',
  'PRIMARY KEY (baseline_id, migration_id)',
  'REVOKE ALL ON TABLE eiscore_meta.database_baselines FROM PUBLIC',
  'REVOKE ALL ON TABLE eiscore_meta.baseline_migration_coverage FROM PUBLIC'
]) assert.ok(ledgerSource.includes(marker), marker)

console.log('PASS: database migration ids, order, checksums, transactions, rollback declarations, ledger and legacy inventory')
