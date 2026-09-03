// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const artifactsRoot = resolve(repoRoot, 'tests/.artifacts')
const backupRoot = mkdtempSync(resolve(artifactsRoot, 'db4-release-'))
const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`
const databaseContainer = `eiscore-db4-db-${suffix}`
const apiContainer = `eiscore-db4-api-${suffix}`
const networkName = `eiscore-db4-net-${suffix}`
const postgresImage = 'postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f'
const postgrestImage = 'postgrest/postgrest@sha256:00c1ec8a9339f52a7e765cb3bd3ab5b001f0b5dd954cfb69b43b9de494a9a0aa'
const rootPassword = randomBytes(32).toString('base64url')
const postgrestPassword = randomBytes(32).toString('base64url')
const agentPassword = randomBytes(32).toString('base64url')
const jwtSecret = randomBytes(40).toString('base64url')
const releaseManifestSha256 = 'aed30ee9d2a55c615974e4cfa782acebcbc93ae3748e9f8e9f79ac9979bd7074'
const core002Sha256 = 'fbcda56cea86589f4ffd40ee273456ee1bac84a3b10890eca4cd04218723dafc'
const maxOutput = 256 * 1024 * 1024

const execute = (program, args, { input, allowFailure = false, timeout = 300_000 } = {}) => {
  const result = spawnSync(program, args, {
    cwd: repoRoot,
    input,
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
const psql = (sql) => docker([
  'exec', '-i', databaseContainer, 'psql', '-v', 'ON_ERROR_STOP=1', '-At',
  '-U', 'postgres', '-d', 'eiscore'
], { input: sql })
const psqlFile = (path) => docker([
  'exec', databaseContainer, 'psql', '-v', 'ON_ERROR_STOP=1',
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
const waitForDatabase = async () => {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = docker([
      'exec', databaseContainer, 'pg_isready', '-U', 'postgres', '-d', 'eiscore'
    ], { allowFailure: true })
    if (ready.status === 0) return
    await sleep(250)
  }
  throw new Error('isolated DB4 predecessor database did not become ready')
}
const releaseArgs = (apiUrl) => [
  'scripts/deploy-database-release.mjs',
  '--db-container', databaseContainer,
  '--db-name', 'eiscore',
  '--db-user', 'postgres',
  '--api-container', apiContainer,
  '--api-url', apiUrl,
  '--backup-dir', backupRoot,
  '--operator', 'db4-isolated-release-test'
]
const releaseEnv = {
  ...process.env,
  POSTGRES_PASSWORD: rootPassword,
  POSTGREST_DB_PASSWORD: postgrestPassword,
  AGENT_DB_PASSWORD: agentPassword,
  PGRST_JWT_SECRET: jwtSecret
}
// execute() intentionally owns the stable process contract; release execution
// needs an explicit environment without changing command-line secret exposure.
const executeRelease = (apiUrl, allowFailure = false) => {
  const result = spawnSync(process.execPath, releaseArgs(apiUrl), {
    cwd: repoRoot,
    env: releaseEnv,
    encoding: 'utf8',
    maxBuffer: maxOutput,
    timeout: 600_000,
    windowsHide: true
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result
}
const backupDirectories = () => readdirSync(backupRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

try {
  docker(['version'])
  docker(['network', 'create', networkName])
  docker([
    'run', '-d', '--name', databaseContainer, '--network', networkName, '--read-only',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=2g',
    '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--shm-size', '256m',
    '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=eiscore',
    '-e', `POSTGRES_PASSWORD=${rootPassword}`,
    '--mount', `type=bind,source=${repoRoot},target=/repo,readonly`,
    postgresImage
  ])
  await waitForDatabase()
  psqlFile('env/init_roles.sql')
  psqlFile('database/baselines/eiscore-db-v1/schema.sql')
  psqlFile('database/baselines/eiscore-db-v1/register.sql')

  const apiPort = await availablePort()
  const apiUrl = `http://127.0.0.1:${apiPort}`
  docker([
    'create', '--name', apiContainer, '--network', networkName,
    '-p', `127.0.0.1:${apiPort}:3000`,
    '-e', `PGRST_DB_URI=postgres://eiscore_authenticator:${postgrestPassword}@${databaseContainer}:5432/eiscore`,
    '-e', 'PGRST_DB_SCHEMAS=app_center,app_data,company_site,hr,public,scm,workflow',
    '-e', 'PGRST_DB_ANON_ROLE=web_anon', '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
    postgrestImage
  ])

  const first = executeRelease(apiUrl)
  assert.match(first.stdout, /Preflight passed: 13a49b00/)
  assert.match(first.stdout, /core migration execution passed: 1 applied, 1 skipped/)
  assert.match(first.stdout, /Database release passed: eiscore-db-v2/)
  assert.equal(backupDirectories().length, 1)

  const firstEvidencePath = resolve(backupRoot, backupDirectories()[0].name, 'backup-evidence.json')
  const evidence = JSON.parse(readFileSync(firstEvidencePath, 'utf8'))
  assert.equal(evidence.releaseManifestSha256, releaseManifestSha256)
  assert.equal(evidence.databaseDump.sha256, sha256File(evidence.databaseDump.path))
  assert.equal(evidence.globals.sha256, sha256File(evidence.globals.path))
  assert.equal(evidence.globals.passwordsIncluded, false)
  assert.ok(existsSync(evidence.databaseDump.path))

  const releaseRow = psql(`
    SELECT release_id || '|' || manifest_sha256 || '|' || source_revision
    FROM eiscore_meta.database_releases;
  `).stdout.trim()
  assert.equal(
    releaseRow,
    `eiscore-db-v2|${releaseManifestSha256}|0ae0c946f0747f15041d5cf6ba6e1fe2f3251ca3`
  )
  assert.equal(psql(`
    SELECT tableowner FROM pg_tables
    WHERE schemaname = 'eiscore_meta' AND tablename = 'database_releases';
  `).stdout.trim(), 'eiscore_owner')

  const second = executeRelease(apiUrl)
  assert.match(second.stdout, /core migration execution passed: 0 applied, 2 skipped/)
  assert.equal(backupDirectories().length, 2)
  assert.equal(psql('SELECT count(*) FROM eiscore_meta.database_releases;').stdout.trim(), '1')

  psql('CREATE TABLE public.db4_schema_drift_probe(id integer);')
  const beforeDriftAttempt = backupDirectories().length
  const drift = executeRelease(apiUrl, true)
  assert.notEqual(drift.status, 0)
  assert.match(`${drift.stdout}\n${drift.stderr}`, /schema drift: unrecognized database catalog/)
  assert.equal(backupDirectories().length, beforeDriftAttempt, 'schema drift must fail before backup')
  psql('DROP TABLE public.db4_schema_drift_probe;')

  psql("UPDATE eiscore_meta.schema_migrations SET checksum_sha256 = repeat('0', 64) WHERE migration_id = 'core-002';")
  const beforeConflictAttempt = backupDirectories().length
  const conflict = executeRelease(apiUrl, true)
  assert.notEqual(conflict.status, 0)
  assert.match(`${conflict.stdout}\n${conflict.stderr}`, /migration ledger checksum conflict: core-002/)
  assert.equal(backupDirectories().length, beforeConflictAttempt, 'ledger conflict must fail before backup')
  psql(`UPDATE eiscore_meta.schema_migrations SET checksum_sha256 = '${core002Sha256}' WHERE migration_id = 'core-002';`)

  console.log('PASS: DB4 release artifact upgrades, backs up, verifies DB/PostgREST, repeats, and fails closed on drift/conflict')
} finally {
  docker(['rm', '-f', apiContainer], { allowFailure: true })
  docker(['rm', '-f', databaseContainer], { allowFailure: true })
  docker(['network', 'rm', networkName], { allowFailure: true })
  const relativeBackup = backupRoot.startsWith(`${artifactsRoot}${sep}`)
  if (relativeBackup) rmSync(backupRoot, { recursive: true, force: true })
}
