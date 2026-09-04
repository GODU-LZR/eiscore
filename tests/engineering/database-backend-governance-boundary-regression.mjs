// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { analyzeProductionCompose, auditDatabaseBackend } from '../../scripts/audit-database-backend.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const result = auditDatabaseBackend({ repoRoot })

assert.equal(result.schemaVersion, 1)
assert.deepEqual(result.legacyRoots.map(({ path, count }) => [path, count]), [
  ['.', 2],
  ['env', 2],
  ['sql', 70],
  ['eiscore-hr/sql', 30],
  ['eiscore-materials/sql', 2]
])
assert.equal(result.legacySqlFiles, 106)
assert.equal(result.governedMigrationFiles, 17)
assert.equal(result.governedLegacySqlFiles, 10)
assert.equal(result.ungovernedLegacySqlFiles, 96)
assert.equal(result.resolvedLegacySqlFiles, 96)
assert.equal(result.unresolvedLegacySqlFiles, 0)
assert.deepEqual(result.resolution.errors, [])
assert.match(result.resolution.sha256, /^[0-9a-f]{64}$/)
assert.deepEqual(result.resolution.finalDispositions, {
  'covered-by-baseline': 73,
  'customer-data': 6,
  'demo-fixture': 9,
  duplicate: 2,
  'operations-only': 1,
  'reference-seed': 3,
  'still-required': 1,
  'superseded-by-migration': 1
})
assert.equal(result.resolution.entries.filter((entry) => entry.executable).length, 2)
assert.equal(result.files.length, 106)
assert.ok(result.files.every((entry) => entry.bytes > 0))
assert.ok(result.files.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256)))
assert.ok(result.files.every((entry) => entry.category !== 'data-or-operation'))
assert.deepEqual(result.categories, {
  'customer-seed': 6,
  'demo-or-test': 9,
  'environment-bootstrap': 4,
  'governed-migration': 10,
  'legacy-patch': 39,
  postcheck: 1,
  'reference-seed': 3,
  'schema-fragment': 34
})
assert.deepEqual(result.duplicateContentGroups, [
  ['env/init_roles.sql', 'init_roles.sql'],
  ['env/insert_ai_config.sql', 'insert_ai_config.sql']
])
assert.deepEqual(
  Object.fromEntries(Object.keys(result.files[0].signals).map((key) => [
    key,
    result.files.reduce((total, entry) => total + entry.signals[key], 0)
  ])),
  {
    createTable: 127,
    createFunction: 141,
    createPolicy: 215,
    enableRls: 72,
    securityDefiner: 73,
    grants: 250,
    inserts: 293
  }
)
assert.deepEqual(result.manifests.map(({ name, count }) => [name, count]), [
  ['runtime-v2', 10],
  ['company-site', 1],
  ['core', 6]
])
assert.deepEqual(result.productionCompose.runtimeSuperuserConnections, [])
assert.deepEqual(result.productionCompose.exposedSchemas, ['public', 'hr', 'scm', 'app_center', 'workflow', 'app_data'])
assert.deepEqual(result.productionCompose.images, [
  'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f',
  'postgrest/postgrest@sha256:00c1ec8a9339f52a7e765cb3bd3ab5b001f0b5dd954cfb69b43b9de494a9a0aa',
  'swaggerapi/swagger-ui@sha256:080804ac62c9d5d358662cc6f0db96ba0be76af7af393014a1a1305d967298cc',
  'codercom/code-server@sha256:31ad23cda720476e7eb3371a9b02fd7a5738843f6ef43beef97e9edf1960fc47'
])
assert.deepEqual(result.productionCompose.initializationInputs, [
  'database/bootstrap/roles-v2.sql',
  'database/baselines/eiscore-db-v1/schema.sql',
  'database/baselines/eiscore-db-v1/register.sql',
  'database/migrations/sql/core-002-role-boundaries.sql',
  'scripts/configure-database-runtime-secrets-v2.sh'
])

const hardenedCompose = `
    image: postgres:16.6@sha256:abc
      PGRST_DB_URI: "postgres://eiscore_authenticator:secret@db:5432/eiscore"
      PGRST_DB_SCHEMAS: "api"
      PGUSER: eiscore_agent
`
assert.deepEqual(analyzeProductionCompose(hardenedCompose).runtimeSuperuserConnections, [])

const adr = readFileSync(resolve(repoRoot, 'docs/engineering/adr/0013-database-backend-release-governance.md'), 'utf8')
for (const marker of [
  '状态：接受',
  'PostgreSQL 与 PostgREST 作为后端发布单元',
  '不得以 `postgres` 或其他超级用户运行',
  '空库基线加迁移',
  'Schema Drift',
  'G4.1～G4.4 暂停'
]) assert.ok(adr.includes(marker), `ADR-0013 lost marker: ${marker}`)

const plan = readFileSync(resolve(repoRoot, 'docs/engineering/DATABASE_BACKEND_GOVERNANCE_PLAN.md'), 'utf8')
assert.match(plan, /### DB0：决策与现状基线（已完成）/)
for (const phase of ['DB1', 'DB2', 'DB3', 'DB4', 'DB5', 'DB6']) {
  assert.ok(plan.includes(`### ${phase}：`), `database governance plan lost phase ${phase}`)
}
assert.match(plan, /G4\.1～G4\.4 暂停/)

const exitAudit = readFileSync(resolve(repoRoot, 'docs/engineering/DB0_EXIT_AUDIT.md'), 'utf8')
for (const marker of [
  'DB0 已完成',
  '97 份尚未进入可信迁移链',
  '两个超级用户运行连接',
  '空库路径与升级路径',
  '不能把当前双仓库工作树描述为完全干净'
]) assert.ok(exitAudit.includes(marker), `DB0 exit audit lost marker: ${marker}`)

const classification = readFileSync(resolve(repoRoot, 'database/LEGACY_SQL_CLASSIFICATION.md'), 'utf8')
for (const marker of [
  '迁移期只读库存，不是执行清单',
  '所有仍在工作树中的文件均已分类',
  '96 份历史 SQL 不进入迁移链',
  'legacy-sql-resolution.json',
  '73 处 `SECURITY DEFINER`',
  '历史 SQL 仍不删除、重命名、合并或批量执行'
]) assert.ok(classification.includes(marker), `legacy SQL classification lost marker: ${marker}`)

const resolutionLedger = JSON.parse(readFileSync(resolve(repoRoot, 'database/legacy-sql-resolution.json'), 'utf8'))
assert.equal(resolutionLedger.entries.length, 96)
assert.equal(resolutionLedger.defaultExecutionPolicy, 'deny')

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
assert.match(packageJson.scripts?.['db:backend:audit'] || '', /audit-database-backend\.mjs/)
assert.match(packageJson.scripts?.['test:database-backend-governance'] || '', /database-backend-governance-boundary-regression\.mjs/)
assert.match(packageJson.scripts?.['test:database-migrations'] || '', /npm run test:database-backend-governance/)

console.log('PASS: database backend governance boundary and transition debt baseline')
