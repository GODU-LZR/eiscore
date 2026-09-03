// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { loadAndValidateDatabaseRelease } from '../../scripts/database-release-contract.mjs'
import {
  loadAndValidateDatabaseBackupEvidence,
  parseDatabaseRestoreArgs
} from '../../scripts/restore-database-release-backup.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const release = loadAndValidateDatabaseRelease({ repoRoot })
assert.deepEqual(release.errors, [])
assert.deepEqual(parseDatabaseRestoreArgs([
  '--evidence', 'backup.json', '--db-container', 'recovery-db', '--db-name', 'app',
  '--db-user', 'admin', '--api-container', 'recovery-api', '--api-url', 'http://127.0.0.1:3001',
  '--operator', 'operator', '--confirm-empty-target', 'eiscore-db-v4', '--dry-run'
]), {
  evidencePath: 'backup.json', releasePath: 'database/releases/eiscore-db-v4/manifest.json',
  dbContainer: 'recovery-db', dbName: 'app', dbUser: 'admin', apiContainer: 'recovery-api',
  apiUrl: 'http://127.0.0.1:3001', operator: 'operator', confirmation: 'eiscore-db-v4', dryRun: true
})
assert.throws(() => parseDatabaseRestoreArgs(['--unknown']), /unknown argument/)

const directory = mkdtempSync(resolve(tmpdir(), 'eiscore-db5-backup-contract-'))
try {
  const dumpPath = resolve(directory, 'database.dump')
  const globalsPath = resolve(directory, 'globals-without-passwords.sql')
  const evidencePath = resolve(directory, 'backup-evidence.json')
  const dump = Buffer.from('isolated-database-dump')
  const globals = 'CREATE ROLE isolated;\n'
  const hash = (value) => createHash('sha256').update(value).digest('hex')
  writeFileSync(dumpPath, dump)
  writeFileSync(globalsPath, globals)
  writeFileSync(evidencePath, JSON.stringify({
    schemaVersion: 1,
    releaseId: release.manifest.releaseId,
    releaseManifestSha256: release.manifestSha256,
    sourceRevision: release.manifest.sourceRevision,
    databaseDump: { path: dumpPath, sha256: hash(dump), bytes: dump.length },
    globals: { path: globalsPath, sha256: hash(Buffer.from(globals)), passwordsIncluded: false },
    verifiedBy: 'pg_restore --list',
    environment: 'isolated',
    storageEncryptionEvidence: 'isolated://unit-test'
  }))
  const result = loadAndValidateDatabaseBackupEvidence({ evidencePath, release })
  assert.deepEqual(result.errors, [])
  writeFileSync(dumpPath, 'drift')
  assert.ok(loadAndValidateDatabaseBackupEvidence({ evidencePath, release }).errors.some((error) => error.includes('checksum drift')))
} finally {
  rmSync(directory, { recursive: true, force: true })
}

console.log('PASS: recovery requires exact release evidence, sibling artifacts, checksums and explicit empty-target confirmation')
