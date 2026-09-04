// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  executeRuntimeMigrationPlan,
  loadRuntimeMigrationPlan,
  parseRuntimeMigrationArgs,
  quoteSqlLiteral,
  runRuntimeMigrations
} from '../../scripts/apply-runtime-migrations.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const plan = loadRuntimeMigrationPlan({ repoRoot })
assert.equal(plan.migrations.length, 10)
assert.equal(plan.migrations[0].transaction, 'runner')
assert.equal(plan.migrations[2].transaction, 'file')

const companySitePlan = loadRuntimeMigrationPlan({
  repoRoot,
  manifestPath: 'database/migrations/company-site.json'
})
assert.equal(companySitePlan.name, 'company-site')
assert.equal(companySitePlan.migrations.length, 1)
assert.equal(companySitePlan.migrations[0].id, 'company-site-001')
assert.equal(companySitePlan.migrations[0].rollbackStrategy, 'sql')

const corePlan = loadRuntimeMigrationPlan({
  repoRoot,
  manifestPath: 'database/migrations/core.json'
})
assert.equal(corePlan.name, 'core')
assert.equal(corePlan.migrations.length, 6)
assert.deepEqual(corePlan.migrations.map((entry) => entry.id), [
  'core-001', 'core-002', 'core-003', 'core-004', 'core-005', 'core-006'
])

assert.deepEqual(
  parseRuntimeMigrationArgs([
    '--manifest', 'database/migrations/runtime-v2.json',
    '--db-container', 'db-test',
    '--db-name', 'eiscore-test',
    '--db-user', 'release-user',
    '--backup-evidence', 'backup-42',
    '--release-revision', 'abc123',
    '--operator', 'release-bot',
    '--dry-run'
  ]),
  {
    manifestPath: 'database/migrations/runtime-v2.json',
    dbContainer: 'db-test',
    dbName: 'eiscore-test',
    dbUser: 'release-user',
    backupEvidence: 'backup-42',
    releaseRevision: 'abc123',
    operator: 'release-bot',
    dryRun: true
  }
)
assert.throws(() => parseRuntimeMigrationArgs(['--unknown']), /unknown argument/)
assert.throws(() => parseRuntimeMigrationArgs(['--manifest']), /missing value/)
assert.equal(quoteSqlLiteral("O'Brien"), "'O''Brien'")

const defaultOptions = parseRuntimeMigrationArgs([])
let adapterCreated = false
const dryLogs = []
const dryResult = runRuntimeMigrations({
  options: { ...defaultOptions, dryRun: true },
  repoRoot,
  adapterFactory: () => {
    adapterCreated = true
    throw new Error('dry-run must not create a database adapter')
  },
  env: {},
  log: (message) => dryLogs.push(message)
})
assert.equal(adapterCreated, false)
assert.equal(dryResult.dryRun, true)
assert.ok(dryLogs.some((message) => message.includes('no Docker or database connection attempted')))

assert.throws(() => runRuntimeMigrations({
  options: defaultOptions,
  repoRoot,
  adapterFactory: () => {
    adapterCreated = true
    throw new Error('missing backup evidence must fail first')
  },
  env: { USERNAME: 'tester' },
  log: () => {}
}), /backup evidence/)
assert.equal(adapterCreated, false)

assert.throws(() => runRuntimeMigrations({
  options: { ...defaultOptions, backupEvidence: 'backup-42' },
  repoRoot,
  loadPlan: () => { throw new Error('offline validation failed') },
  adapterFactory: () => {
    adapterCreated = true
    throw new Error('validation must fail before database adapter creation')
  },
  env: { USERNAME: 'tester' },
  log: () => {}
}), /offline validation failed/)
assert.equal(adapterCreated, false)

class FakeAdapter {
  constructor(checksums, { baselineCoverage = new Map(), failLabel = '' } = {}) {
    this.checksums = checksums
    this.baselineCoverage = baselineCoverage
    this.failLabel = failLabel
    this.events = []
    this.executions = []
  }

  ensureReady() {
    this.events.push('ready')
  }

  readChecksum(id) {
    this.events.push(`read:${id}`)
    return this.checksums.get(id) || ''
  }

  readBaselineCoverage(id) {
    this.events.push(`baseline:${id}`)
    return this.baselineCoverage.get(id) || ''
  }

  executeSql(label, sql) {
    this.events.push(`sql:${label}`)
    this.executions.push({ label, sql })
    if (label === this.failLabel) throw new Error(`${label} failed`)
  }
}

const existing = new Map(plan.migrations.map((migration) => [migration.id, migration.sha256]))
existing.delete(plan.migrations[1].id)
existing.delete(plan.migrations[2].id)
const adapter = new FakeAdapter(existing)
const logs = []
const result = executeRuntimeMigrationPlan({
  plan,
  adapter,
  metadata: {
    backupEvidence: "backup-'42",
    releaseRevision: 'abc123',
    operator: "O'Brien"
  },
  log: (message) => logs.push(message)
})

assert.deepEqual(result, { applied: 2, skipped: 8 })
assert.equal(adapter.events[0], 'ready')
assert.equal(adapter.events[1], 'sql:migration ledger initialization')
assert.equal(adapter.events.at(-1), 'sql:Runtime V2 postcheck')
assert.ok(logs.some((message) => message.includes('2 applied, 8 skipped, postcheck passed')))

const runnerExecution = adapter.executions.find((entry) => entry.label.includes(plan.migrations[1].id))
assert.ok(runnerExecution)
assert.equal((runnerExecution.sql.match(/^\s*BEGIN\s*;/gim) || []).length, 1)
assert.equal((runnerExecution.sql.match(/^\s*COMMIT\s*;/gim) || []).length, 1)
assert.match(runnerExecution.sql, /INSERT INTO eiscore_meta\.schema_migrations/)
assert.match(runnerExecution.sql, /backup-''42/)
assert.match(runnerExecution.sql, /O''Brien/)
assert.ok(runnerExecution.sql.indexOf('INSERT INTO eiscore_meta.schema_migrations') < runnerExecution.sql.lastIndexOf('COMMIT;'))

const fileExecution = adapter.executions.find((entry) => entry.label.includes(plan.migrations[2].id))
assert.ok(fileExecution)
assert.equal((fileExecution.sql.match(/^\s*BEGIN\s*;/gim) || []).length, 1)
assert.equal((fileExecution.sql.match(/^\s*COMMIT\s*;/gim) || []).length, 1)
assert.ok(fileExecution.sql.indexOf('INSERT INTO eiscore_meta.schema_migrations') < fileExecution.sql.lastIndexOf('COMMIT;'))

const conflictChecksums = new Map([[plan.migrations[0].id, '0'.repeat(64)]])
const conflictAdapter = new FakeAdapter(conflictChecksums)
assert.throws(() => executeRuntimeMigrationPlan({
  plan,
  adapter: conflictAdapter,
  metadata: { backupEvidence: 'backup', releaseRevision: 'abc', operator: 'tester' },
  log: () => {}
}), /migration checksum conflict/)
assert.equal(conflictAdapter.executions.some((entry) => entry.label.startsWith('migration execution')), false)
assert.equal(conflictAdapter.executions.some((entry) => entry.label === 'Runtime V2 postcheck'), false)

const baselineAdapter = new FakeAdapter(new Map(), {
  baselineCoverage: new Map(plan.migrations.map((migration) => [migration.id, migration.sha256]))
})
const baselineLogs = []
assert.deepEqual(executeRuntimeMigrationPlan({
  plan,
  adapter: baselineAdapter,
  metadata: { backupEvidence: 'baseline', releaseRevision: 'abc', operator: 'tester' },
  log: (message) => baselineLogs.push(message)
}), { applied: 0, skipped: 10 })
assert.equal(baselineAdapter.executions.some((entry) => entry.label.startsWith('migration execution')), false)
assert.equal(baselineLogs.filter((message) => message.includes('covered by installed baseline')).length, 10)

const baselineConflictAdapter = new FakeAdapter(new Map(), {
  baselineCoverage: new Map([[plan.migrations[0].id, 'f'.repeat(64)]])
})
assert.throws(() => executeRuntimeMigrationPlan({
  plan,
  adapter: baselineConflictAdapter,
  metadata: { backupEvidence: 'baseline', releaseRevision: 'abc', operator: 'tester' },
  log: () => {}
}), /baseline migration checksum conflict/)
assert.equal(baselineConflictAdapter.executions.some((entry) => entry.label.startsWith('migration execution')), false)

const postcheckAdapter = new FakeAdapter(
  new Map(plan.migrations.map((migration) => [migration.id, migration.sha256])),
  { failLabel: 'Runtime V2 postcheck' }
)
assert.throws(() => executeRuntimeMigrationPlan({
  plan,
  adapter: postcheckAdapter,
  metadata: { backupEvidence: 'backup', releaseRevision: 'abc', operator: 'tester' },
  log: () => {}
}), /postcheck failed/)

const cli = spawnSync(process.execPath, ['scripts/apply-runtime-migrations.mjs', '--dry-run'], {
  cwd: repoRoot,
  encoding: 'utf8',
  windowsHide: true
})
assert.equal(cli.status, 0, cli.stderr)
assert.match(cli.stdout, /10 governed migrations/)
assert.match(cli.stdout, /no Docker or database connection attempted/)

const shellWrapper = readFileSync(resolve(repoRoot, 'scripts/apply-runtime-patches.sh'), 'utf8')
const powershellWrapper = readFileSync(resolve(repoRoot, 'scripts/apply-runtime-patches.ps1'), 'utf8')
for (const wrapper of [shellWrapper, powershellWrapper]) {
  assert.match(wrapper, /apply-runtime-migrations\.mjs/)
  assert.doesNotMatch(wrapper, /docker\s+(exec|ps)/i)
}

console.log('PASS: Runtime V2 runner validates offline, requires backup evidence, enforces ledger checksums, preserves transactions and always postchecks')
