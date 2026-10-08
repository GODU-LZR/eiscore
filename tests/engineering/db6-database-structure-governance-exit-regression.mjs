// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { databaseReleaseManifestSha256 } from '../../scripts/database-release-contract.mjs'
import { readPublishedDb6, publishedDb6Path } from '../../scripts/database-release-test-history.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const json = (path) => JSON.parse(read(path))

// Current migration inventory is separate from the immutable DB6 evidence below.
const migrationManifests = [
  json('database/migrations/runtime-v2.json'),
  json('database/migrations/company-site.json'),
  json('database/migrations/core.json')
]
assert.equal(migrationManifests.reduce((total, manifest) => total + manifest.migrations.length, 0), 22)
assert.deepEqual(migrationManifests[2].migrations.map(({ id }) => id), [
  'core-001', 'core-002', 'core-003', 'core-004', 'core-005', 'core-006', 'core-007', 'core-008', 'core-009', 'core-010', 'core-011'
])

// This exit audit describes the original DB6 release, not approval of today's tree.
const manifest = JSON.parse(readPublishedDb6(publishedDb6Path))
const release = { manifest, manifestSha256: databaseReleaseManifestSha256(manifest) }
assert.equal(release.manifest.releaseId, 'eiscore-db-v6')
assert.equal(release.manifestSha256, '58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d')
assert.equal(release.manifest.migrationManifests.reduce((total, entry) => total + entry.migrations.length, 0), 18)
assert.deepEqual(release.manifest.migrationManifests.find(({ name }) => name === 'core').migrations.map(({ id }) => id), [
  'core-001', 'core-002', 'core-003', 'core-004', 'core-005', 'core-006', 'core-007'
])
assert.deepEqual(release.manifest.predecessors, [
  {
    id: 'eiscore-db-v1-runtime',
    databaseCatalogSha256: '4e6b7bd39b39ea421c4d021fcf6e54d2855d44bd4eb196f486d3b9a647dbbc16'
  },
  {
    id: 'eiscore-db-v3',
    databaseCatalogSha256: '2bf293da00a9519e6db05f0c18935521ecd2a60da739c02f8fa4122da4501ebe'
  },
  {
    id: 'eiscore-db-v4',
    databaseCatalogSha256: '354224cb76cef28136b0684972cbfb98b2f8c2df497adda05de00f1564f4c9a7'
  },
  {
    id: 'eiscore-db-v5',
    databaseCatalogSha256: 'b89b8858897996130c84e989a70989be4083eed145e13d8a91997ed8f127f585'
  }
])

const contract = JSON.parse(readPublishedDb6('database/contracts/eiscore-db-contract-v3.json'))
assert.deepEqual(contract.databaseCatalog.counts, {
  schemas: 7,
  relations: 199,
  functions: 168,
  types: 1,
  policies: 319,
  triggers: 83,
  roles: 6,
  memberships: 3,
  defaultPrivileges: 19,
  extensions: 2
})
assert.equal(contract.postgrestOpenApi.counts.paths, 286)
assert.equal(contract.postgrestOpenApi.counts.rpcPaths, 78)
assert.equal(contract.postgrestOpenApi.counts.definitions, 194)

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
assert.ok(plan.includes('DB0～DB8 全部退出'))

const databaseReadme = read('database/README.md')
assert.ok(databaseReadme.includes('company-site 1 个、core 10 个迁移，共 21 个不可变迁移'))
assert.ok(databaseReadme.includes('releases/eiscore-db-v6/manifest.json'))
assert.ok(databaseReadme.includes('--confirm-empty-target=eiscore-db-v6'))

console.log('PASS: DB6 database structure governance evidence and drift anchors')
