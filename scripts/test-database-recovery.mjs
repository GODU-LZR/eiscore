// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadAndValidateDatabaseRelease } from './database-release-contract.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const artifactsRoot = resolve(repoRoot, 'tests/.artifacts')
const backupRoot = mkdtempSync(resolve(artifactsRoot, 'db5-recovery-'))
const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`
const sourceDb = `eiscore-db5-source-db-${suffix}`
const sourceApi = `eiscore-db5-source-api-${suffix}`
const recoveryDb = `eiscore-db5-recovery-db-${suffix}`
const recoveryApi = `eiscore-db5-recovery-api-${suffix}`
const networkName = `eiscore-db5-net-${suffix}`
const postgresImage = 'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f'
const postgrestImage = 'postgrest/postgrest@sha256:00c1ec8a9339f52a7e765cb3bd3ab5b001f0b5dd954cfb69b43b9de494a9a0aa'
const rootPassword = randomBytes(32).toString('base64url')
const postgrestPassword = randomBytes(32).toString('base64url')
const agentPassword = randomBytes(32).toString('base64url')
const jwtSecret = randomBytes(40).toString('base64url')
const maxOutput = 512 * 1024 * 1024
const executionEnv = {
  ...process.env,
  POSTGRES_PASSWORD: rootPassword,
  POSTGREST_DB_PASSWORD: postgrestPassword,
  AGENT_DB_PASSWORD: agentPassword,
  PGRST_JWT_SECRET: jwtSecret
}
const releasePath = process.env.DB_RELEASE_PATH || 'database/releases/eiscore-db-v6/manifest.json'
const release = loadAndValidateDatabaseRelease({ repoRoot, releasePath, verifySourceRevision: false })
if (release.errors.length) throw new Error(`release manifest is invalid: ${release.errors.join('; ')}`)

const execute = (program, args, { input, allowFailure = false, timeout = 600_000, env } = {}) => {
  const result = spawnSync(program, args, {
    cwd: repoRoot,
    input,
    env: env || process.env,
    encoding: 'utf8',
    maxBuffer: maxOutput,
    timeout,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${program} ${args.slice(0, 4).join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result
}
const docker = (args, options) => execute('docker', args, options)
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
const psql = (container, sql) => docker([
  'exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-At',
  '-U', 'postgres', '-d', 'eiscore'
], { input: sql })
const psqlFile = (container, path) => docker([
  'exec', container, 'psql', '-v', 'ON_ERROR_STOP=1',
  '-U', 'postgres', '-d', 'eiscore', '-f', `/repo/${path}`
])
const availablePort = () => new Promise((resolvePromise, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    server.close((error) => error ? reject(error) : resolvePromise(address.port))
  })
})
const startDatabase = async (name) => {
  docker([
    'run', '-d', '--name', name, '--network', networkName, '--read-only',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=2g',
    '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--shm-size', '256m',
    '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore',
    '-e', `POSTGRES_PASSWORD=${rootPassword}`,
    '--mount', `type=bind,source=${repoRoot},target=/repo,readonly`,
    postgresImage
  ])
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = docker(['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'eiscore'], { allowFailure: true })
    if (ready.status === 0) {
      const probe = docker([
        'exec', name, 'psql', '-v', 'ON_ERROR_STOP=1', '-At',
        '-U', 'postgres', '-d', 'eiscore', '-c', 'SELECT 1'
      ], { allowFailure: true })
      if (probe.status === 0 && probe.stdout.trim() === '1') return
    }
    await sleep(250)
  }
  throw new Error(`${name} did not become ready`)
}
const createApi = async (name, database, port) => docker([
  'create', '--name', name, '--network', networkName, '-p', `127.0.0.1:${port}:3000`,
  '-e', `PGRST_DB_URI=postgres://eiscore_authenticator:${postgrestPassword}@${database}:5432/eiscore`,
  '-e', 'PGRST_DB_SCHEMAS=app_center,app_data,company_site,hr,public,scm,workflow',
  '-e', 'PGRST_DB_ANON_ROLE=web_anon', '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
  postgrestImage
])
const releaseArgs = (apiUrl) => [
  'scripts/deploy-database-release.mjs', '--release', releasePath, '--db-container', sourceDb,
  '--api-container', sourceApi, '--api-url', apiUrl,
  '--backup-dir', backupRoot,
  '--environment', 'isolated',
  '--backup-storage-evidence', 'isolated://db5-recovery-test-tmpfs',
  '--operator', 'db5-recovery-source'
]
const runRelease = (apiUrl) => execute(process.execPath, releaseArgs(apiUrl), { env: executionEnv })
const catalogSectionHashes = (container) => JSON.parse(execute(process.execPath, [
  '--input-type=module', '-e',
  "import { DatabaseReleaseDockerAdapter } from './scripts/deploy-database-release.mjs'; import { sha256CanonicalJson } from './scripts/database-contract-catalog.mjs'; const adapter = new DatabaseReleaseDockerAdapter({dbContainer: process.argv[1], dbName: 'eiscore', dbUser: 'postgres'}); const catalog = adapter.readCatalog(); process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, sha256CanonicalJson(value)]))));",
  container
]).stdout)
const catalogFunctions = (container) => JSON.parse(execute(process.execPath, [
  '--input-type=module', '-e',
  "import { DatabaseReleaseDockerAdapter } from './scripts/deploy-database-release.mjs'; const adapter = new DatabaseReleaseDockerAdapter({dbContainer: process.argv[1], dbName: 'eiscore', dbUser: 'postgres'}); process.stdout.write(JSON.stringify(adapter.readCatalog().functions));",
  container
]).stdout)
const catalogRelations = (container) => JSON.parse(execute(process.execPath, [
  '--input-type=module', '-e',
  "import { DatabaseReleaseDockerAdapter } from './scripts/deploy-database-release.mjs'; const adapter = new DatabaseReleaseDockerAdapter({dbContainer: process.argv[1], dbName: 'eiscore', dbUser: 'postgres'}); process.stdout.write(JSON.stringify(adapter.readCatalog().relations));",
  container
]).stdout)
const backupDirectories = () => readdirSync(backupRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()

try {
  docker(['version'])
  docker(['network', 'create', networkName])
  await startDatabase(sourceDb)
  psqlFile(sourceDb, 'env/init_roles.sql')
  psqlFile(sourceDb, 'database/baselines/eiscore-db-v1/schema.sql')
  psqlFile(sourceDb, 'database/baselines/eiscore-db-v1/register.sql')
  const sourcePort = await availablePort()
  const sourceUrl = `http://127.0.0.1:${sourcePort}`
  await createApi(sourceApi, sourceDb, sourcePort)
  runRelease(sourceUrl)

  const companySiteRollback = readFileSync(resolve(
    repoRoot, 'database/migrations/rollback/company-site-001-add-published-snapshot.sql'
  ), 'utf8')
  psql(sourceDb, `
    BEGIN;
    ${companySiteRollback}
    DO $rollback_check$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'company_site'
          AND table_name = 'site_config'
          AND column_name = 'published_snapshot'
      ) THEN
        RAISE EXCEPTION 'company-site-001 rollback did not remove published_snapshot';
      END IF;
    END
    $rollback_check$;
    ROLLBACK;
  `)
  assert.equal(psql(sourceDb, `
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'company_site'
      AND table_name = 'site_config'
      AND column_name = 'published_snapshot'
      AND data_type = 'jsonb'
      AND is_nullable = 'NO';
  `).stdout.trim(), '1')

  psql(sourceDb, `
    INSERT INTO public.document_assets (original_filename, storage_path, file_hash)
    VALUES ('db5-recovery-canary.txt', '/isolated/db5-recovery-canary.txt', 'db5-recovery-canary-hash');
  `)
  runRelease(sourceUrl)
  assert.equal(backupDirectories().length, 2)
  const sourceCatalogSections = catalogSectionHashes(sourceDb)
  const operationalBackup = backupDirectories().at(-1)
  const evidencePath = resolve(backupRoot, operationalBackup, 'backup-evidence.json')
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
  assert.equal(evidence.releaseId, 'eiscore-db-v6')
  const backupAudit = execute(process.execPath, [
    'scripts/check-database-backups.mjs', `--backup-root=${backupRoot}`, '--environment=isolated',
    `--release=${releasePath}`
  ])
  const backupReport = JSON.parse(backupAudit.stdout)
  assert.equal(backupReport.status, 'healthy')
  assert.equal(backupReport.backups.length, 2)
  assert.ok(backupReport.backups[0].ageSeconds <= backupReport.recoveryPointObjectiveSeconds)

  docker(['stop', sourceApi])
  psql(sourceDb, 'DROP TABLE public.document_assets CASCADE;')
  assert.equal(psql(sourceDb, "SELECT to_regclass('public.document_assets') IS NULL;").stdout.trim(), 't')

  await startDatabase(recoveryDb)
  const recoveryPort = await availablePort()
  const recoveryUrl = `http://127.0.0.1:${recoveryPort}`
  await createApi(recoveryApi, recoveryDb, recoveryPort)
  const recovery = execute(process.execPath, [
    'scripts/restore-database-release-backup.mjs',
    '--release', releasePath,
    '--evidence', evidencePath,
    '--db-container', recoveryDb,
    '--api-container', recoveryApi,
    '--api-url', recoveryUrl,
    '--operator', 'db5-isolated-recovery-test',
    '--confirm-empty-target', 'eiscore-db-v6'
  ], { env: executionEnv, allowFailure: true })
  if (recovery.status !== 0) {
    const recoveredCatalogSections = catalogSectionHashes(recoveryDb)
    const differingSections = Object.keys(sourceCatalogSections).filter(
      (section) => sourceCatalogSections[section] !== recoveredCatalogSections[section]
    )
    const sourceFunctions = catalogFunctions(sourceDb)
    const recoveredFunctions = catalogFunctions(recoveryDb)
    const functionDrift = sourceFunctions.map((entry, index) => ({
      key: `${entry.schema}.${entry.name}(${entry.identityArguments})`,
      source: entry,
      recovered: recoveredFunctions[index]
    })).filter(({ source, recovered }) => JSON.stringify(source) !== JSON.stringify(recovered)).slice(0, 3)
    const sourceRelations = catalogRelations(sourceDb)
    const recoveredRelations = catalogRelations(recoveryDb)
    const recoveredRelationsByKey = new Map(recoveredRelations.map((entry) => [`${entry.schema}.${entry.name}`, entry]))
    const sourceRelationsByKey = new Map(sourceRelations.map((entry) => [`${entry.schema}.${entry.name}`, entry]))
    const relationDrift = [...new Set([...sourceRelationsByKey.keys(), ...recoveredRelationsByKey.keys()])]
      .map((key) => ({ key, source: sourceRelationsByKey.get(key), recovered: recoveredRelationsByKey.get(key) }))
      .filter(({ source, recovered }) => JSON.stringify(source) !== JSON.stringify(recovered)).slice(0, 5)
    throw new Error(`recovery failed: ${recovery.stderr || recovery.stdout}\nsection drift: ${JSON.stringify(
      Object.fromEntries(differingSections.map((section) => [section, {
        source: sourceCatalogSections[section], recovered: recoveredCatalogSections[section]
      }]))
    )}\nrelation drift: ${JSON.stringify(relationDrift)}\nfunction drift: ${JSON.stringify(functionDrift)}`)
  }
  assert.match(recovery.stdout, /Database recovery passed: eiscore-db-v6-/)

  assert.equal(psql(recoveryDb, `
    SELECT count(*) FROM public.document_assets
    WHERE file_hash = 'db5-recovery-canary-hash'
      AND original_filename = 'db5-recovery-canary.txt';
  `).stdout.trim(), '1')
  assert.equal(psql(recoveryDb, 'SELECT count(*) FROM eiscore_meta.database_releases;').stdout.trim(), '1')
  assert.equal(psql(recoveryDb, 'SELECT count(*) FROM eiscore_meta.database_recoveries;').stdout.trim(), '1')
  const recoveryEvidence = psql(recoveryDb, `
    SELECT release_id || '|' || database_dump_sha256 || '|' || (recovery_ms >= 0)::text
    FROM eiscore_meta.database_recoveries;
  `).stdout.trim()
  assert.equal(recoveryEvidence, `eiscore-db-v6|${evidence.databaseDump.sha256}|true`)
  assert.equal(psql(recoveryDb, `
    SELECT tableowner FROM pg_tables
    WHERE schemaname = 'eiscore_meta' AND tablename = 'database_recoveries';
  `).stdout.trim(), 'eiscore_owner')
  assert.equal(Number(psql(recoveryDb, 'SELECT recovery_ms FROM eiscore_meta.database_recoveries;').stdout.trim()) <= 7_200_000, true)

  const runtimeAuditPath = resolve(backupRoot, 'runtime-audit.json')
  const runtimeAudit = execute(process.execPath, [
    'scripts/audit-database-runtime.mjs',
    '--db-container', recoveryDb,
    '--api-container', recoveryApi,
    '--api-url', recoveryUrl,
    '--output', runtimeAuditPath,
    '--release', releasePath
  ])
  const runtimeReport = JSON.parse(runtimeAudit.stdout)
  assert.equal(runtimeReport.status, 'healthy')
  assert.equal(runtimeReport.activity.runtimeSuperuserConnections, 0)
  assert.equal(runtimeReport.activity.blockedQueries, 0)
  assert.equal(runtimeReport.roleBoundaryViolations, 0)
  assert.equal(runtimeReport.slowQuery.queryTextCaptured, false)
  assert.equal(runtimeReport.postgrest.profiles.length, 7)

  console.log('PASS: database recovery drills transactional SQL rollback, destroys the source schema, and restores v6 roles, data, DB contract and stable PostgREST into an empty stack')
} finally {
  for (const name of [sourceApi, recoveryApi, sourceDb, recoveryDb]) {
    docker(['rm', '-f', name], { allowFailure: true })
  }
  docker(['network', 'rm', networkName], { allowFailure: true })
  if (backupRoot.startsWith(`${artifactsRoot}${sep}`)) rmSync(backupRoot, { recursive: true, force: true })
}
