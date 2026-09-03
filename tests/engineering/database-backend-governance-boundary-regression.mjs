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
for (const phase of ['DB0', 'DB1', 'DB2', 'DB3', 'DB4', 'DB5']) {
  assert.ok(plan.includes(`### ${phase}：`), `database governance plan lost phase ${phase}`)
}
assert.match(plan, /G4\.1～G4\.4 暂停/)

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
assert.match(packageJson.scripts?.['db:backend:audit'] || '', /audit-database-backend\.mjs/)
assert.match(packageJson.scripts?.['test:database-backend-governance'] || '', /database-backend-governance-boundary-regression\.mjs/)
assert.match(packageJson.scripts?.['test:database-migrations'] || '', /npm run test:database-backend-governance/)

console.log('PASS: database backend governance boundary and transition debt baseline')
