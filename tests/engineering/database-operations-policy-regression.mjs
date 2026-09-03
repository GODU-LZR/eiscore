// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDatabaseRuntimeAuditArgs } from '../../scripts/audit-database-runtime.mjs'
import { parseDatabaseRestoreArgs } from '../../scripts/restore-database-release-backup.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const policy = JSON.parse(readFileSync(resolve(repoRoot, 'database/operations/policy.json'), 'utf8'))
assert.equal(policy.schemaVersion, 1)
assert.equal(policy.policyId, 'eiscore-database-operations-v1')
assert.ok(policy.backup.recoveryPointObjectiveSeconds > 0)
assert.ok(policy.recovery.recoveryTimeObjectiveSeconds > 0)
assert.ok(policy.backup.retention.daily >= 7)
assert.ok(policy.backup.retention.weekly >= 4)
assert.ok(policy.backup.retention.monthly >= 6)
assert.equal(policy.backup.productionStorageEncryptionEvidenceRequired, true)
assert.equal(policy.backup.rolePasswordsInGlobalsAllowed, false)
assert.equal(policy.recovery.requireEmptyTarget, true)
assert.equal(policy.recovery.requireDatabaseCatalogMatch, true)
assert.equal(policy.recovery.requirePostgrestContractMatch, true)
assert.equal(policy.recovery.requireDataCanary, true)
assert.equal(policy.slowQuery.captureQueryText, false)
assert.equal(policy.health.maximumRuntimeSuperuserConnections, 0)
assert.equal(policy.health.maximumRoleBoundaryViolations, 0)

assert.deepEqual(parseDatabaseRuntimeAuditArgs([
  '--db-container', 'db', '--db-name', 'app', '--db-user', 'auditor',
  '--api-container', 'api', '--api-url', 'http://127.0.0.1:3000/', '--output', 'audit.json'
]), {
  dbContainer: 'db', dbName: 'app', dbUser: 'auditor', apiContainer: 'api',
  apiUrl: 'http://127.0.0.1:3000', output: 'audit.json'
})
assert.throws(() => parseDatabaseRuntimeAuditArgs([]), /--api-url/)

const restoreSource = readFileSync(resolve(repoRoot, 'scripts/restore-database-release-backup.mjs'), 'utf8')
const recoveryPostcheck = readFileSync(resolve(repoRoot, 'database/recovery/post-restore-v2.sql'), 'utf8')
for (const marker of [
  '--confirm-empty-target', 'assertEmptyTarget', 'verifyArchive', 'bootstrapRoles',
  'normalizeRestoredCatalog', 'verifyReleasedPostgrest', 'recordRecovery'
]) assert.ok(restoreSource.includes(marker), `recovery lost ${marker}`)
assert.match(recoveryPostcheck, /ALTER %s %I\.%I\(%s\) OWNER TO eiscore_owner/)

const runtimeAudit = readFileSync(resolve(repoRoot, 'scripts/audit-database-runtime.mjs'), 'utf8')
assert.match(runtimeAudit, /pg_blocking_pids/)
assert.match(runtimeAudit, /queryTextCaptured.*false/)
assert.match(runtimeAudit, /runtimeSuperuserConnections/)
assert.match(runtimeAudit, /pg_stat_statements/)
assert.doesNotMatch(runtimeAudit, /SELECT[^\n]+query\s*(,|FROM)/i)

const recoveryLedger = readFileSync(resolve(repoRoot, 'database/recovery-ledger.sql'), 'utf8')
assert.match(recoveryLedger, /CREATE TABLE IF NOT EXISTS eiscore_meta\.database_recoveries/)
assert.match(recoveryLedger, /recovery_ms bigint NOT NULL/)
assert.match(recoveryLedger, /REVOKE ALL ON TABLE eiscore_meta\.database_recoveries FROM PUBLIC/)

const restoreOptions = parseDatabaseRestoreArgs(['--evidence', 'x', '--confirm-empty-target', 'eiscore-db-v3'])
assert.equal(restoreOptions.confirmation, 'eiscore-db-v3')

console.log('PASS: DB operations policy locks RPO/RTO, retention, restore safety, runtime health and redacted slow-query evidence')
