// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  buildDatabaseReleaseManifest,
  databaseReleaseManifestSha256,
  loadAndValidateDatabaseRelease,
  validateDatabaseReleaseManifest
} from '../../scripts/database-release-contract.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot, encoding: 'utf8', windowsHide: true
}).stdout.trim()
const predecessorCatalogs = [{ id: 'eiscore-db-v1-runtime', databaseCatalogSha256: 'a'.repeat(64) }]
const manifest = buildDatabaseReleaseManifest({
  repoRoot,
  releaseId: 'eiscore-db-v4',
  sourceRevision: revision,
  predecessorCatalogs
})

assert.deepEqual(validateDatabaseReleaseManifest({
  repoRoot,
  manifest,
  verifySourceRevision: false
}).errors, [])
assert.match(databaseReleaseManifestSha256(manifest), /^[0-9a-f]{64}$/)
assert.deepEqual(manifest.migrationManifests.map(({ name }) => name), ['runtime-v2', 'company-site', 'core'])
assert.deepEqual(manifest.migrationManifests.map(({ terminal }) => terminal.id), [
  'runtime-v2-010', 'company-site-001', 'core-004'
])
assert.ok(manifest.artifacts.some(({ path }) => path === 'database/release-ledger.sql'))
assert.ok(manifest.artifacts.some(({ path }) => path === 'database/contracts/eiscore-db-contract-v2.json'))
assert.ok(manifest.artifacts.some(({ purpose }) => purpose === 'verification-only'))

const fixedRelease = loadAndValidateDatabaseRelease({ repoRoot })
assert.deepEqual(fixedRelease.errors, [])
assert.equal(fixedRelease.manifest.releaseId, 'eiscore-db-v4')
assert.equal(fixedRelease.manifest.sourceRevision, '50e86666cad0b7e8054f37d42551bc9e41b2a406')
assert.equal(fixedRelease.manifestSha256, '2d7464401915e92a460584c20119d9aa2c770147b9c6276195a7f7b7fbb8899a')

const mutation = (callback) => {
  const value = structuredClone(manifest)
  callback(value)
  return validateDatabaseReleaseManifest({ repoRoot, manifest: value, verifySourceRevision: false }).errors
}
assert.ok(mutation((value) => { value.images.postgres = 'postgres:16' }).some((error) => error.includes('digest-pinned')))
assert.ok(mutation((value) => { value.releasePolicy.backupRequired = false }).some((error) => error.includes('backup')))
assert.ok(mutation((value) => { value.predecessors[0].databaseCatalogSha256 = '0' }).some((error) => error.includes('predecessor')))
assert.ok(mutation((value) => { value.artifacts[0].portableSha256 = '0'.repeat(64) }).some((error) => error.includes('artifact drift')))
assert.ok(mutation((value) => { value.migrationManifests[2].terminal.id = 'core-999' }).some((error) => error.includes('terminal migration drift')))
assert.ok(mutation((value) => { value.databaseContract.postgrestOpenApiSha256 = '0'.repeat(64) }).some((error) => error.includes('PostgREST contract checksum drift')))

const ledgerSql = await import('node:fs').then(({ readFileSync }) => readFileSync(
  resolve(repoRoot, 'database/release-ledger.sql'), 'utf8'
))
for (const marker of [
  'CREATE TABLE IF NOT EXISTS eiscore_meta.database_releases',
  'release_id text PRIMARY KEY',
  'manifest_sha256 text NOT NULL',
  'source_revision text NOT NULL',
  'backup_evidence jsonb NOT NULL',
  'REVOKE ALL ON TABLE eiscore_meta.database_releases FROM PUBLIC'
]) assert.ok(ledgerSql.includes(marker), marker)

console.log('PASS: database release descriptor binds source, images, baseline, migrations, contract and fail-closed policy')
