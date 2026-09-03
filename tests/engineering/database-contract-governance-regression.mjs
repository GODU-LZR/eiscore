// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const contract = JSON.parse(read('database/contracts/eiscore-db-contract-v2.json'))
const packageJson = JSON.parse(read('package.json'))
const contractTest = read('scripts/test-database-contracts.mjs')
const catalogSource = read('scripts/database-contract-catalog.mjs')
const ciSource = read('.github/workflows/ci.yml')
const sha256Pattern = /^[0-9a-f]{64}$/

assert.equal(contract.schemaVersion, 1)
assert.equal(contract.contractId, 'eiscore-db-contract-v2')
assert.match(contract.postgresImage, /@sha256:[0-9a-f]{64}$/)
assert.match(contract.postgrestImage, /@sha256:[0-9a-f]{64}$/)
assert.deepEqual(contract.exposedSchemas, [
  'app_center', 'app_data', 'company_site', 'hr', 'public', 'scm', 'workflow'
])
assert.match(contract.baseline.fingerprintSha256, sha256Pattern)
assert.match(contract.databaseCatalog.sha256, sha256Pattern)
assert.match(contract.postgrestOpenApi.sha256, sha256Pattern)
assert.deepEqual(Object.keys(contract.postgrestOpenApi.roleSha256), ['web_anon', 'web_user'])
assert.ok(Object.values(contract.postgrestOpenApi.roleSha256).every((hash) => sha256Pattern.test(hash)))
assert.deepEqual(Object.keys(contract.postgrestOpenApi.schemaSha256), ['web_anon', 'web_user'])
for (const schemaHashes of Object.values(contract.postgrestOpenApi.schemaSha256)) {
  assert.deepEqual(Object.keys(schemaHashes), contract.exposedSchemas)
  assert.ok(Object.values(schemaHashes).every((hash) => sha256Pattern.test(hash)))
}
for (const count of Object.values(contract.databaseCatalog.counts)) assert.ok(count > 0)
assert.equal(contract.postgrestOpenApi.counts.roles, 2)
assert.equal(contract.postgrestOpenApi.counts.schemaProfiles, contract.exposedSchemas.length * 2)
assert.ok(contract.postgrestOpenApi.counts.paths > 0)
assert.ok(contract.postgrestOpenApi.counts.rpcPaths > 0)

for (const section of [
  'schemas', 'relations', 'functions', 'policies', 'triggers', 'roles',
  'memberships', 'defaultPrivileges', 'extensions', 'databaseSettingNames'
]) assert.match(catalogSource, new RegExp(`\\b${section}:`), `catalog lost ${section}`)

for (const marker of [
  'fresh install and role-upgrade catalogs differ',
  'repeated migrations changed the database contract',
  "NOTIFY pgrst, 'reload schema'",
  'schema-cache reload changed the API contract',
  '/rpc/ontology_current_claims',
  'PGRST202',
  "'content-profile': 'public'",
  "'accept-profile': schema",
  "'--tmpfs'",
  'target=/repo,readonly'
]) assert.ok(contractTest.includes(marker), `database contract gate lost marker: ${marker}`)
assert.doesNotMatch(contractTest, /:remote/)

assert.match(packageJson.scripts?.['test:database-contracts:docker'] || '', /test-database-contracts\.mjs/)
for (const command of [
  'test:database-baseline:docker', 'test:database-roles:docker',
  'test:database-contracts:docker', 'test:database-release:docker'
]) assert.ok(packageJson.scripts?.['test:database:docker']?.includes(command), `database suite lost ${command}`)
assert.match(ciSource, /run: npm run test:database:docker/)

console.log('PASS: versioned database/PostgREST contract and default CI integration')
