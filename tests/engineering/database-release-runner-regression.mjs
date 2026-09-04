// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildDatabaseReleaseManifest, databaseReleaseManifestSha256 } from '../../scripts/database-release-contract.mjs'
import { createDatabaseCatalog, sha256CanonicalJson } from '../../scripts/database-contract-catalog.mjs'
import {
  executeDatabaseRelease,
  parseDatabaseReleaseArgs,
  resolveDatabaseReleaseExecution,
  validateDatabaseReleasePreflight
} from '../../scripts/deploy-database-release.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot, encoding: 'utf8', windowsHide: true
}).stdout.trim()
const catalog = createDatabaseCatalog({})
const catalogSha256 = sha256CanonicalJson(catalog)
const manifest = buildDatabaseReleaseManifest({
  repoRoot,
  releaseId: 'eiscore-db-v5',
  sourceRevision: revision,
  predecessorCatalogs: [{ id: 'test-predecessor', databaseCatalogSha256: 'a'.repeat(64) }]
})
manifest.databaseContract.databaseCatalogSha256 = catalogSha256

assert.deepEqual(parseDatabaseReleaseArgs([
  '--release', 'release.json', '--db-container', 'db-test', '--db-name', 'app',
  '--db-user', 'admin', '--api-container', 'api-test', '--api-url', 'http://127.0.0.1:3210/',
  '--backup-dir', 'test-backups', '--environment', 'isolated',
  '--backup-storage-evidence', 'isolated://unit-test', '--operator', 'release-bot', '--dry-run'
]), {
  releasePath: 'release.json', dbContainer: 'db-test', dbName: 'app', dbUser: 'admin',
  apiContainer: 'api-test', apiUrl: 'http://127.0.0.1:3210/', backupDir: 'test-backups',
  environment: 'isolated', backupStorageEvidence: 'isolated://unit-test', operator: 'release-bot', dryRun: true
})
assert.throws(() => parseDatabaseReleaseArgs(['--unknown']), /unknown argument/)
assert.throws(() => parseDatabaseReleaseArgs(['--api-url']), /missing value/)

const secrets = {
  POSTGREST_DB_PASSWORD: randomBytes(32).toString('base64url'),
  AGENT_DB_PASSWORD: randomBytes(32).toString('base64url'),
  PGRST_JWT_SECRET: randomBytes(40).toString('base64url'),
  USERNAME: 'release-tester'
}
const execution = resolveDatabaseReleaseExecution({
  backupDir: 'tests/.artifacts/db5-unit', apiUrl: 'http://127.0.0.1:1/',
  environment: 'isolated', backupStorageEvidence: 'isolated://unit-test', operator: ''
}, secrets)
assert.equal(execution.operator, 'release-tester')
assert.equal(execution.apiUrl, 'http://127.0.0.1:1')
assert.throws(() => resolveDatabaseReleaseExecution({ backupDir: 'x', apiUrl: 'x', operator: 'x' }, {
  ...secrets, AGENT_DB_PASSWORD: secrets.POSTGREST_DB_PASSWORD
}), /independent/)
assert.throws(() => resolveDatabaseReleaseExecution({
  backupDir: 'x', apiUrl: '', operator: 'x', environment: 'isolated',
  backupStorageEvidence: 'isolated://unit-test'
}, secrets), /--api-url/)
assert.throws(() => resolveDatabaseReleaseExecution({
  backupDir: 'x', apiUrl: 'x', operator: 'x', environment: 'production',
  backupStorageEvidence: 'isolated://not-production'
}, secrets), /encrypted storage/)

const baselineState = {
  baselines: [{
    id: manifest.baseline.id,
    fingerprintSha256: manifest.baseline.fingerprintSha256,
    schemaSha256: manifest.baseline.schemaSha256,
    objectCatalogSha256: manifest.baseline.objectCatalogSha256
  }],
  migrations: [],
  coverage: manifest.migrationManifests.flatMap(({ migrations }) => migrations)
}
assert.deepEqual(validateDatabaseReleasePreflight({
  manifest, catalogSha256, governanceState: baselineState
}), [])
assert.ok(validateDatabaseReleasePreflight({
  manifest, catalogSha256: '0'.repeat(64), governanceState: baselineState
}).some((error) => error.includes('schema drift')))
assert.ok(validateDatabaseReleasePreflight({
  manifest, catalogSha256, governanceState: { ...baselineState, migrations: [{ id: 'unknown-001', sha256: '0'.repeat(64) }] }
}).some((error) => error.includes('unknown migration')))

const openApi = { swagger: '2.0', info: { title: 'isolated' }, paths: {}, definitions: {} }
const openApiCatalog = {
  web_anon: Object.fromEntries(manifest.databaseContract ? [
    'app_center', 'app_data', 'company_site', 'hr', 'public', 'scm', 'workflow'
  ].map((schema) => [schema, openApi]) : []),
  web_user: Object.fromEntries([
    'app_center', 'app_data', 'company_site', 'hr', 'public', 'scm', 'workflow'
  ].map((schema) => [schema, openApi]))
}
const contract = {
  databaseCatalog: { sha256: catalogSha256 },
  postgrestOpenApi: { sha256: sha256CanonicalJson(openApiCatalog) }
}
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json')
  if (request.method === 'POST' && request.url === '/rpc/ontology_current_claims') {
    const claims = JSON.parse(Buffer.from(request.headers.authorization.split('.')[1], 'base64url').toString('utf8'))
    response.end(JSON.stringify(claims))
    return
  }
  response.end(JSON.stringify(openApi))
})
await new Promise((resolvePromise, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolvePromise)
})
const port = server.address().port

class FakeAdapter {
  constructor() {
    this.events = []
    this.checksums = new Map(manifest.migrationManifests.flatMap(({ migrations }) => migrations.map(({ id, sha256 }) => [id, sha256])))
  }
  preflight() { this.events.push('preflight') }
  readCatalog() { this.events.push('catalog'); return catalog }
  readGovernanceState() { this.events.push('governance'); return baselineState }
  createBackup() {
    this.events.push('backup')
    return { databaseDump: { sha256: 'b'.repeat(64) }, evidencePath: 'isolated-backup-evidence.json' }
  }
  initializeReleaseLedger() { this.events.push('release-ledger') }
  ensureReady() { this.events.push('ready') }
  executeSql(label) { this.events.push(`sql:${label}`) }
  readChecksum(id) { return this.checksums.get(id) || '' }
  readBaselineCoverage() { return '' }
  configureRuntimeSecrets() { this.events.push('secrets') }
  async ensureApi() { this.events.push('api-ready') }
  recordRelease() { this.events.push('release-record') }
}

const adapter = new FakeAdapter()
try {
  const result = await executeDatabaseRelease({
    manifest,
    manifestSha256: databaseReleaseManifestSha256(manifest),
    contract,
    options: { apiContainer: 'isolated-api' },
    execution: {
      backupDir: 'unused', operator: 'tester', apiUrl: `http://127.0.0.1:${port}`,
      environment: 'isolated', backupStorageEvidence: 'isolated://unit-test',
      secrets: {
        jwtSecret: secrets.PGRST_JWT_SECRET,
        postgrestPassword: secrets.POSTGREST_DB_PASSWORD,
        agentPassword: secrets.AGENT_DB_PASSWORD
      }
    },
    adapter,
    log: () => {}
  })
  assert.equal(result.releaseId, manifest.releaseId)
  assert.ok(adapter.events.indexOf('backup') < adapter.events.findIndex((event) => event.startsWith('sql:migration ledger')))
  assert.ok(adapter.events.indexOf('release-ledger') < adapter.events.indexOf('secrets'))
  assert.ok(adapter.events.indexOf('secrets') < adapter.events.indexOf('api-ready'))
  assert.equal(adapter.events.at(-1), 'release-record')
} finally {
  await new Promise((resolvePromise) => server.close(resolvePromise))
}

console.log('PASS: database release job fails closed before backup and records success only after DB/PostgREST verification')
