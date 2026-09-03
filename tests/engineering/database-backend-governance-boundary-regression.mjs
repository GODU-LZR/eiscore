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
  ['.', 3],
  ['env', 2],
  ['sql', 70],
  ['eiscore-hr/sql', 30],
  ['eiscore-materials/sql', 2]
])
assert.equal(result.legacySqlFiles, 107)
assert.equal(result.governedMigrationFiles, 11)
assert.equal(result.governedLegacySqlFiles, 10)
assert.equal(result.ungovernedLegacySqlFiles, 97)
assert.equal(result.files.length, 107)
assert.ok(result.files.every((entry) => entry.bytes > 0))
assert.ok(result.files.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256)))
assert.ok(result.files.every((entry) => entry.category !== 'data-or-operation'))
assert.deepEqual(result.categories, {
  'baseline-snapshot': 1,
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
    createTable: 152,
    createFunction: 172,
    createPolicy: 219,
    enableRls: 73,
    securityDefiner: 80,
    grants: 302,
    inserts: 312
  }
)
assert.deepEqual(result.manifests.map(({ name, count }) => [name, count]), [
  ['runtime-v2', 10],
  ['company-site', 1]
])
assert.deepEqual(result.productionCompose.runtimeSuperuserConnections, [
  { service: 'api', setting: 'PGRST_DB_URI', role: 'postgres' },
  { service: 'agent-runtime', setting: 'PGUSER', role: 'postgres' }
])
assert.deepEqual(result.productionCompose.exposedSchemas, ['public', 'hr', 'scm', 'app_center', 'workflow', 'app_data'])
assert.deepEqual(result.productionCompose.images, [
  'postgres:16',
  'postgrest/postgrest',
  'swaggerapi/swagger-ui',
  'codercom/code-server:4.108.2'
])
assert.deepEqual(result.productionCompose.initializationInputs, ['env/init_roles.sql', 'db_schema_and_data.sql'])

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
for (const phase of ['DB1', 'DB2', 'DB3', 'DB4', 'DB5']) {
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
  '所有文件均已分类',
  '仍有 97 份历史 SQL 未被迁移链接管',
  '80 处 `SECURITY DEFINER`',
  '不删除、重命名、合并或批量执行任何历史 SQL'
]) assert.ok(classification.includes(marker), `legacy SQL classification lost marker: ${marker}`)

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
assert.match(packageJson.scripts?.['db:backend:audit'] || '', /audit-database-backend\.mjs/)
assert.match(packageJson.scripts?.['test:database-backend-governance'] || '', /database-backend-governance-boundary-regression\.mjs/)
assert.match(packageJson.scripts?.['test:database-migrations'] || '', /npm run test:database-backend-governance/)

console.log('PASS: database backend governance boundary and transition debt baseline')
