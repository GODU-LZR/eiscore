// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateDatabaseBaseline } from '../../scripts/check-database-baseline.mjs'
import { createPublishedDb6Snapshot } from '../../scripts/database-release-test-history.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const result = validateDatabaseBaseline({ root: repoRoot })
assert.deepEqual(result.errors, [])
assert.equal(result.manifest.baselineId, 'eiscore-db-v1')
assert.equal(result.manifest.coveredMigrations.length, 12)
assert.equal(result.manifest.contentGuarantees.businessRows, 0)
assert.equal(result.manifest.contentGuarantees.embeddedCredentials, 0)
assert.deepEqual(result.manifest.installOrder, [
  'env/init_roles.sql',
  'database/baselines/eiscore-db-v1/schema.sql',
  'database/baselines/eiscore-db-v1/register.sql',
  'scripts/configure-database-runtime-secret.sh'
])

const schema = readFileSync(resolve(repoRoot, result.manifest.schema.path), 'utf8')
assert.doesNotMatch(schema, /^-- Data for Name:/m)
assert.doesNotMatch(schema, /^COPY\s/m)
assert.doesNotMatch(schema, /OWNER TO/i)
assert.ok(result.manifest.contentGuarantees.privilegeStatements > 0)

const registration = readFileSync(resolve(repoRoot, result.manifest.registration.path), 'utf8')
assert.match(registration, /baseline_migration_coverage/)
assert.doesNotMatch(registration, /INSERT\s+INTO\s+eiscore_meta\.schema_migrations/i)

const snapshot = createPublishedDb6Snapshot()
try {
  const schemaPath = resolve(snapshot.root, result.manifest.schema.path)
  const portable = readFileSync(schemaPath, 'utf8').replaceAll('\r\n', '\n')
  for (const text of [portable, portable.replaceAll('\n', '\r\n')]) {
    writeFileSync(schemaPath, text)
    assert.deepEqual(validateDatabaseBaseline({ root: snapshot.root }).errors, [], 'line endings must not change baseline provenance')
  }
  writeFileSync(schemaPath, portable.replace('CREATE TABLE public.users', 'CREATE TABLE public.changed_users'))
  assert.ok(validateDatabaseBaseline({ root: snapshot.root }).errors.some((error) => error.includes('portable checksum drift')),
    'portable validation must still reject a schema content change')
} finally {
  snapshot.cleanup()
}

console.log('PASS: canonical database baseline hashes, contents, object catalog and migration coverage contract')
