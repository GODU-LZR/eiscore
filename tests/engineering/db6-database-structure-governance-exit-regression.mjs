// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadAndValidateDatabaseRelease } from '../../scripts/database-release-contract.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const json = (path) => JSON.parse(read(path))

const migrationManifests = [
  json('database/migrations/runtime-v2.json'),
  json('database/migrations/company-site.json'),
  json('database/migrations/core.json')
]
assert.equal(migrationManifests.reduce((total, manifest) => total + manifest.migrations.length, 0), 17)
assert.deepEqual(migrationManifests[2].migrations.map(({ id }) => id), [
  'core-001', 'core-002', 'core-003', 'core-004', 'core-005', 'core-006'
])

const release = loadAndValidateDatabaseRelease({ repoRoot })
assert.deepEqual(release.errors, [])
assert.equal(release.manifest.releaseId, 'eiscore-db-v4')
assert.equal(release.manifestSha256, '8113f0325ac11ca5e1fa056f35e1ceaf603b4a3709a9a71493b08f9dc85fcbda')
assert.deepEqual(release.manifest.predecessors.map(({ id }) => id), ['eiscore-db-v1-runtime', 'eiscore-db-v3'])

const contract = json('database/contracts/eiscore-db-contract-v2.json')
assert.deepEqual(contract.databaseCatalog.counts, {
  schemas: 7,
  relations: 196,
  functions: 161,
  policies: 297,
  triggers: 82,
  roles: 6,
  memberships: 3,
  defaultPrivileges: 19,
  extensions: 2
})
assert.equal(contract.postgrestOpenApi.counts.paths, 292)
assert.equal(contract.postgrestOpenApi.counts.definitions, 204)

const packageJson = json('package.json')
assert.equal(packageJson.scripts['test:database-company-site-bff:docker'], 'node scripts/test-company-site-bff.mjs')
assert.match(packageJson.scripts['test:database:docker'], /test:database-company-site-bff:docker/)
assert.match(packageJson.scripts['test:database-migrations'], /test:database-structure-exit/)

const bffTest = read('scripts/test-company-site-bff.mjs')
for (const marker of [
  "user: 'eiscore_agent'",
  '/agent/company-site/public/site-config',
  '/agent/company-site/admin/content/publish',
  '/agent/company-site/public/leads',
  '/agent/sales/sessions',
  '/approval',
  "'secondary'"
]) assert.ok(bffTest.includes(marker), `DB6 real BFF test lost marker: ${marker}`)

const audit = read('docs/engineering/DB6_DATABASE_STRUCTURE_GOVERNANCE_EXIT_AUDIT.md')
for (const marker of [
  '总体合理',
  '不是完全理想',
  '96 份历史 SQL',
  '登录用户—员工档案',
  'data_app_<hash>',
  '新业务表、视图、函数、类型和触发器不得进入 `public`',
  '三家企业生产上线批准',
  '生产备份存储/KMS',
  '生产容量'
]) assert.ok(audit.includes(marker), `DB6 exit audit lost marker: ${marker}`)

const plan = read('docs/engineering/DATABASE_BACKEND_GOVERNANCE_PLAN.md')
assert.ok(plan.includes('### DB6：数据库结构与领域权限收口（已完成）'))
assert.ok(plan.includes('DB0～DB6 全部退出'))

const databaseReadme = read('database/README.md')
assert.ok(databaseReadme.includes('company-site 1 个、core 6 个迁移，共 17 个不可变迁移'))
assert.ok(databaseReadme.includes('releases/eiscore-db-v4/manifest.json'))
assert.ok(databaseReadme.includes('--confirm-empty-target=eiscore-db-v4'))

console.log('PASS: DB6 database structure governance evidence and drift anchors')
